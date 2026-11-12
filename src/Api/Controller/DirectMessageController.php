<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\DirectConversation;
use CengizKemec\Social\Models\DirectMessage;
use CengizKemec\Social\Models\DirectParticipant;
use CengizKemec\Social\Realtime\Centrifugo;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\ContentFormatter;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\RateLimit;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\UserPresenter;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class DirectMessageController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected UserPresenter $users,
        protected MediaManager $media,
        protected ContentFormatter $formatter,
        protected Notifier $notifier,
        protected RateLimit $rateLimit,
        protected Centrifugo $realtime
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        if (! $this->access->canUseDirectMessages($actor)) {
            throw new PermissionDeniedException();
        }

        return match ($this->routeName($request)) {
            'social.dm.conversations.index' => $this->conversations($request, $actor),
            'social.dm.conversations.create' => $this->createConversation($request, $actor),
            'social.dm.messages.index' => $this->messages($request, $actor),
            'social.dm.messages.send' => $this->send($request, $actor),
            'social.dm.read' => $this->read($request, $actor),
            'social.dm.messages.update' => $this->update($request, $actor),
            'social.dm.messages.delete' => $this->delete($request, $actor),
            default => $this->notFound(),
        };
    }

    protected function conversations(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $participantRows = DirectParticipant::query()
            ->where('user_id', $actor->id)
            ->orderByDesc('id')
            ->get();

        $conversations = DirectConversation::query()
            ->whereIn('id', $participantRows->pluck('conversation_id'))
            ->orderByDesc('last_message_at')
            ->limit(50)
            ->get();

        $data = $conversations->map(function (DirectConversation $conversation) use ($actor, $participantRows) {
            $participants = DirectParticipant::query()
                ->where('conversation_id', $conversation->id)
                ->get();
            $other = $participants->first(fn (DirectParticipant $item) => (int) $item->user_id !== (int) $actor->id);
            $otherUser = $other ? User::query()->find($other->user_id) : null;
            $myRead = $participantRows->firstWhere('conversation_id', $conversation->id);
            $lastMessage = DirectMessage::query()
                ->where('conversation_id', $conversation->id)
                ->whereNull('deleted_at')
                ->orderByDesc('id')
                ->first();

            return [
                'id' => (int) $conversation->id,
                'user' => $otherUser ? $this->users->basic($otherUser) : null,
                'lastMessage' => $lastMessage?->body,
                'lastMessageAt' => $conversation->last_message_at?->toIso8601String(),
                'unreadCount' => $myRead?->last_read_at
                    ? DirectMessage::query()
                        ->where('conversation_id', $conversation->id)
                        ->where('created_at', '>', $myRead->last_read_at)
                        ->where('user_id', '!=', $actor->id)
                        ->count()
                    : DirectMessage::query()->where('conversation_id', $conversation->id)->where('user_id', '!=', $actor->id)->count(),
            ];
        })->all();

        return $this->json(['data' => $data]);
    }

    protected function createConversation(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $target = User::query()->find((int) ($this->body($request)['user_id'] ?? 0));

        if (! $target || ! $this->access->canMessageUser($target, $actor)) {
            $this->validationError('cannot_message_user');
        }

        $myConversationIds = DirectParticipant::query()->where('user_id', $actor->id)->pluck('conversation_id');
        $existing = null;

        foreach ($myConversationIds as $conversationId) {
            $participants = DirectParticipant::query()->where('conversation_id', $conversationId)->pluck('user_id');

            if ($participants->count() === 2 && $participants->contains($target->id)) {
                $existing = DirectConversation::query()->find($conversationId);
                break;
            }
        }

        if (! $existing) {
            $conversation = new DirectConversation();
            $conversation->created_by = $actor->id;
            $conversation->last_message_at = \Illuminate\Support\now();
            $conversation->created_at = \Illuminate\Support\now();
            $conversation->updated_at = \Illuminate\Support\now();
            $conversation->save();

            foreach ([$actor->id, $target->id] as $userId) {
                $participant = new DirectParticipant();
                $participant->conversation_id = $conversation->id;
                $participant->user_id = $userId;
                $participant->save();
            }

            $existing = $conversation;
        }

        return $this->json([
            'data' => [
                'id' => (int) $existing->id,
                'user' => $this->users->basic($target),
            ],
        ], 201);
    }

    protected function messages(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $conversationId = (int) $this->routeParam($request, 'id');

        if (! $this->access->canAccessDirectConversation($conversationId, $actor)) {
            return $this->forbidden('conversation_forbidden');
        }

        $limit = min(100, max(10, (int) ($request->getQueryParams()['limit'] ?? 30)));
        $before = (int) ($request->getQueryParams()['before'] ?? 0);
        $query = DirectMessage::query()
            ->with('user')
            ->where('conversation_id', $conversationId)
            ->whereNull('deleted_at');

        if ($before > 0) {
            $query->where('id', '<', $before);
        }

        $messages = $query->orderByDesc('id')->limit($limit + 1)->get();
        $hasMore = $messages->count() > $limit;
        $messages = $messages->take($limit)->reverse()->values();

        DirectParticipant::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $actor->id)
            ->update(['last_read_at' => \Illuminate\Support\now()]);

        return $this->json([
            'data' => $messages->map(fn (DirectMessage $message) => $this->presentMessage($message, $actor))->all(),
            'meta' => ['hasMore' => $hasMore, 'conversationId' => $conversationId],
        ]);
    }

    protected function send(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $conversationId = (int) $this->routeParam($request, 'id');

        if (! $this->access->canAccessDirectConversation($conversationId, $actor)) {
            return $this->forbidden('conversation_forbidden');
        }

        $others = DirectParticipant::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', '!=', $actor->id)
            ->get();

        foreach ($others as $other) {
            $recipient = User::query()->find($other->user_id);

            if (! $recipient || ! $this->access->canMessageUser($recipient, $actor)) {
                throw new PermissionDeniedException();
            }
        }

        $body = $this->body($request);
        $text = $this->cleanString($body['body'] ?? '', 2000);
        $mediaIds = $this->intArray($body['media_ids'] ?? []);

        if ($text === '' && empty($mediaIds)) {
            $this->validationError('message_empty');
        }

        $this->rateLimit->assertDirectMessages($actor, $this->settings->int('dm_rate_limit'));

        $message = new DirectMessage();
        $message->conversation_id = $conversationId;
        $message->user_id = $actor->id;
        $message->body = $text;
        $message->created_at = \Illuminate\Support\now();
        $message->save();

        if (! empty($mediaIds)) {
            $this->media->attachIds($mediaIds, $actor, 'direct_message', $message->id, 'private', $this->settings->int('message_attachments'));
        }

        $conversation = DirectConversation::query()->find($conversationId);
        $conversation->last_message_at = \Illuminate\Support\now();
        $conversation->updated_at = \Illuminate\Support\now();
        $conversation->save();

        $this->audit('social.dm.message_sent', [
            'conversation_id' => (int) $conversation->id,
            'message_id' => (int) $message->id,
        ]);

        $message->load('user');
        $presented = $this->presentMessage($message, $actor);

        foreach ($others as $other) {
            $this->notifier->notify(User::query()->find($other->user_id), 'message', $actor, 'direct_message', $message->id, [
                'conversation_id' => $conversationId,
                'excerpt' => mb_substr($text, 0, 140),
            ]);
        }

        $this->realtime->publish($this->realtime->channelForConversation($conversationId), [
            'type' => 'dm.created',
            'message' => $presented,
            'conversation_id' => $conversationId,
        ]);

        return $this->json(['data' => $presented], 201);
    }

    protected function read(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $conversationId = (int) $this->routeParam($request, 'id');

        if (! $this->access->canAccessDirectConversation($conversationId, $actor)) {
            return $this->forbidden('conversation_forbidden');
        }

        DirectParticipant::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $actor->id)
            ->update(['last_read_at' => \Illuminate\Support\now()]);

        return $this->json(['data' => ['read' => true]]);
    }

    protected function update(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $message = DirectMessage::query()->with('user')->find((int) $this->routeParam($request, 'id'));

        if (! $message || $message->deleted_at !== null) {
            return $this->notFound('message_not_found');
        }

        if ((int) $message->user_id !== (int) $actor->id) {
            throw new PermissionDeniedException();
        }

        $text = $this->cleanString($this->body($request)['body'] ?? '', 2000);

        if ($text === '') {
            $this->validationError('message_empty');
        }

        $message->body = $text;
        $message->edited_at = \Illuminate\Support\now();
        $message->save();

        return $this->json(['data' => $this->presentMessage($message, $actor)]);
    }

    protected function delete(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $message = DirectMessage::query()->find((int) $this->routeParam($request, 'id'));

        if (! $message || $message->deleted_at !== null) {
            return $this->notFound('message_not_found');
        }

        if ((int) $message->user_id !== (int) $actor->id) {
            throw new PermissionDeniedException();
        }

        $message->deleted_at = \Illuminate\Support\now();
        $message->save();
        $this->media->detach('direct_message', $message->id);

        $this->audit('social.dm.message_deleted', ['message_id' => (int) $message->id]);

        return $this->json(['data' => ['id' => (int) $message->id, 'deleted' => true]]);
    }

    protected function presentMessage(DirectMessage $message, User $actor): array
    {
        return [
            'id' => (int) $message->id,
            'conversationId' => (int) $message->conversation_id,
            'body' => $message->body,
            'bodyHtml' => $this->formatter->html($message->body, $actor),
            'createdAt' => $message->created_at?->toIso8601String(),
            'editedAt' => $message->edited_at?->toIso8601String(),
            'user' => $this->users->basic($message->user),
            'media' => $this->media->mediaFor('direct_message', $message->id),
            'canEdit' => (int) $message->user_id === (int) $actor->id,
            'canDelete' => (int) $message->user_id === (int) $actor->id,
        ];
    }
}
