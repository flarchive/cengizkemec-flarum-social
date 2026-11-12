<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\Message;
use CengizKemec\Social\Models\MessageRead;
use CengizKemec\Social\Models\TextChannel;
use CengizKemec\Social\Realtime\Centrifugo;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\ContentFormatter;
use CengizKemec\Social\Support\ContentParser;
use CengizKemec\Social\Support\RateLimit;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\UserPresenter;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class ChannelController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected UserPresenter $users,
        protected MediaManager $media,
        protected ContentParser $parser,
        protected ContentFormatter $formatter,
        protected RateLimit $rateLimit,
        protected Centrifugo $realtime
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        return match ($this->routeName($request)) {
            'social.channels.messages' => $this->messages($request),
            'social.channels.send' => $this->send($request),
            'social.channels.read' => $this->read($request),
            'social.channels.typing' => $this->typing($request),
            'social.messages.update' => $this->update($request),
            'social.messages.delete' => $this->delete($request),
            default => $this->notFound(),
        };
    }

    protected function channel(ServerRequestInterface $request): ?TextChannel
    {
        $id = (int) ($this->routeParam($request, 'id') ?: $this->routeParam($request, 'channel_id'));
        $channel = TextChannel::query()->with('room')->find($id);

        if (! $channel) {
            return null;
        }

        if ($channel->room && ($channel->room->is_locked || $channel->room->isExpired())) {
            return null;
        }

        return $channel;
    }

    protected function messages(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $actor->assertCan('social.useText');

        $channel = $this->channel($request);

        if (! $channel || ! $this->access->canReadChannelMessages($channel, $actor)) {
            return $this->forbidden('channel_forbidden');
        }

        $limit = min(100, max(10, (int) ($request->getQueryParams()['limit'] ?? $this->settings->int('message_history_per_page'))));
        $before = (int) ($request->getQueryParams()['before'] ?? 0);

        $query = Message::query()->with('user')->where('channel_id', $channel->id)->whereNull('deleted_at');

        if ($before > 0) {
            $query->where('id', '<', $before);
        }

        $messages = $query->orderByDesc('id')->limit($limit + 1)->get();
        $hasMore = $messages->count() > $limit;
        $messages = $messages->take($limit)->reverse()->values();

        return $this->json([
            'data' => $messages->map(fn (Message $message) => $this->presentMessage($message, $actor))->all(),
            'meta' => [
                'hasMore' => $hasMore,
                'channelId' => (int) $channel->id,
                'channelName' => $channel->name,
            ],
        ]);
    }

    protected function send(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $actor->assertCan('social.sendMessage');

        $channel = $this->channel($request);

        if (! $channel || ! $this->access->canReadChannelMessages($channel, $actor)) {
            return $this->forbidden('channel_forbidden');
        }

        if ($channel->is_locked) {
            $this->validationError('channel_locked');
        }

        $body = $this->body($request);
        $text = $this->cleanString($body['body'] ?? '', $this->settings->int('message_max_length'));
        $mediaIds = $this->intArray($body['media_ids'] ?? []);

        if ($text === '' && empty($mediaIds)) {
            $this->validationError('message_empty');
        }

        if (mb_strlen($text) > $this->settings->int('message_max_length')) {
            $this->validationError('message_too_long');
        }

        $this->rateLimit->assertMessages($actor);

        $message = new Message();
        $message->channel_id = $channel->id;
        $message->user_id = $actor->id;
        $message->body = $text;
        $message->parent_id = isset($body['parent_id']) ? (int) $body['parent_id'] : null;
        $message->created_at = \Illuminate\Support\now();
        $message->save();

        $this->audit('social.channel.message_sent', [
            'channel_id' => (int) $channel->id,
            'message_id' => (int) $message->id,
        ]);

        if (! empty($mediaIds)) {
            $this->media->attachIds($mediaIds, $actor, 'channel_message', $message->id, 'members', $this->settings->int('message_attachments'));
        }

        $message->load('user');

        if ($this->settings->bool('allow_mentions') && $text !== '') {
            $this->parser->notifyMentions($text, $actor, 'message', $message->id, [
                'excerpt' => $this->parser->excerpt($text),
                'channel_id' => $channel->id,
                'message_id' => $message->id,
            ]);
        }

        $presented = $this->presentMessage($message, $actor);

        $this->realtime->publish($this->realtime->channelForChannel($channel->id), [
            'type' => 'message.created',
            'message' => $presented,
            'channel_id' => (int) $channel->id,
        ]);

        return $this->json(['data' => $presented], 201);
    }

    protected function read(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $channel = $this->channel($request);

        if (! $channel || ! $this->access->canReadChannelMessages($channel, $actor)) {
            return $this->forbidden('channel_forbidden');
        }

        $messageId = (int) ($this->body($request)['message_id'] ?? 0);

        $read = MessageRead::query()->firstOrNew(['user_id' => $actor->id, 'channel_id' => $channel->id]);
        $read->last_read_message_id = $messageId ?: (int) Message::query()->where('channel_id', $channel->id)->max('id');
        $read->last_read_at = \Illuminate\Support\now();
        $read->save();

        return $this->json(['data' => ['read' => true, 'lastReadMessageId' => (int) $read->last_read_message_id]]);
    }

    protected function typing(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $channel = $this->channel($request);

        if (! $channel || ! $this->access->canReadChannelMessages($channel, $actor)) {
            return $this->forbidden('channel_forbidden');
        }

        $this->realtime->publish($this->realtime->channelForChannel($channel->id), [
            'type' => 'typing',
            'user' => $this->users->basic($actor),
            'channel_id' => (int) $channel->id,
        ]);

        return $this->json(['data' => ['ok' => true]]);
    }

    protected function update(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $message = Message::query()->with('user', 'channel.room')->find((int) $this->routeParam($request, 'id'));

        if (! $message || $message->deleted_at !== null) {
            return $this->notFound('message_not_found');
        }

        if ((int) $message->user_id !== (int) $actor->id && ! $this->access->isStaff($actor)) {
            throw new PermissionDeniedException();
        }

        if ((int) $message->user_id !== (int) $actor->id) {
            throw new PermissionDeniedException();
        }

        $text = $this->cleanString($this->body($request)['body'] ?? '', $this->settings->int('message_max_length'));

        if ($text === '') {
            $this->validationError('message_empty');
        }

        $message->body = $text;
        $message->edited_at = \Illuminate\Support\now();
        $message->save();

        $this->audit('social.channel.message_updated', ['message_id' => (int) $message->id]);

        $presented = $this->presentMessage($message, $actor);
        $this->realtime->publish($this->realtime->channelForChannel($message->channel_id), [
            'type' => 'message.updated',
            'message' => $presented,
        ]);

        return $this->json(['data' => $presented]);
    }

    protected function delete(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $message = Message::query()->with('channel.room')->find((int) $this->routeParam($request, 'id'));

        if (! $message || $message->deleted_at !== null) {
            return $this->notFound('message_not_found');
        }

        $isOwner = (int) $message->user_id === (int) $actor->id;

        if (! $isOwner && ! $this->access->isStaff($actor)) {
            throw new PermissionDeniedException();
        }

        $message->deleted_at = \Illuminate\Support\now();
        $message->save();
        $this->media->detach('channel_message', $message->id);

        $this->audit('social.channel.message_deleted', ['message_id' => (int) $message->id]);

        $this->realtime->publish($this->realtime->channelForChannel($message->channel_id), [
            'type' => 'message.deleted',
            'message_id' => (int) $message->id,
            'channel_id' => (int) $message->channel_id,
        ]);

        return $this->json(['data' => ['id' => (int) $message->id, 'deleted' => true]]);
    }

    protected function presentMessage(Message $message, User $actor): array
    {
        return [
            'id' => (int) $message->id,
            'channelId' => (int) $message->channel_id,
            'parentId' => $message->parent_id ? (int) $message->parent_id : null,
            'body' => $message->body,
            'bodyHtml' => $this->formatter->html($message->body, $actor),
            'createdAt' => $message->created_at?->toIso8601String(),
            'editedAt' => $message->edited_at?->toIso8601String(),
            'user' => $this->users->basic($message->user),
            'media' => $this->media->mediaFor('channel_message', $message->id),
            'canEdit' => ! $actor->isGuest() && (int) $message->user_id === (int) $actor->id,
            'canDelete' => ! $actor->isGuest() && ((int) $message->user_id === (int) $actor->id || $this->access->isStaff($actor)),
        ];
    }
}
