<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\SocialNotification;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\UserPresenter;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class NotificationController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected UserPresenter $users
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        if ($this->routeName($request) === 'social.notifications.read') {
            return $this->read($request, $actor);
        }

        return $this->index($request, $actor);
    }

    protected function index(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        [$offset, $limit] = $this->pagination($request, 30, 100);
        $unreadOnly = (bool) ($request->getQueryParams()['unread'] ?? false);

        $query = SocialNotification::query()
            ->where('user_id', $actor->id)
            ->orderByDesc('created_at');

        if ($unreadOnly) {
            $query->whereNull('read_at');
        }

        $total = (clone $query)->count();
        $notifications = $query->skip($offset)->take($limit)->get();
        $actorIds = $notifications->pluck('actor_id')->filter()->unique();
        $actors = User::query()->whereIn('id', $actorIds)->get()->keyBy('id');

        return $this->json([
            'data' => $notifications->map(function (SocialNotification $notification) use ($actors) {
                $actor = $notification->actor_id ? $actors->get($notification->actor_id) : null;

                return [
                    'id' => (int) $notification->id,
                    'type' => $notification->type,
                    'actor' => $actor ? $this->users->basic($actor) : null,
                    'subjectType' => $notification->subject_type,
                    'subjectId' => $notification->subject_id ? (int) $notification->subject_id : null,
                    'data' => $notification->data ?? [],
                    'read' => $notification->read_at !== null,
                    'createdAt' => $notification->created_at?->toIso8601String(),
                ];
            })->all(),
            'meta' => [
                'total' => $total,
                'offset' => $offset,
                'limit' => $limit,
                'hasMore' => $offset + $notifications->count() < $total,
                'unreadCount' => SocialNotification::query()->where('user_id', $actor->id)->whereNull('read_at')->count(),
            ],
        ]);
    }

    protected function read(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $body = $this->body($request);
        $ids = $this->intArray($body['ids'] ?? []);
        $all = (bool) ($body['all'] ?? false);

        $query = SocialNotification::query()
            ->where('user_id', $actor->id)
            ->whereNull('read_at');

        if (! $all && ! empty($ids)) {
            $query->whereIn('id', $ids);
        }

        $query->update(['read_at' => \Illuminate\Support\now()]);

        return $this->json([
            'data' => [
                'unreadCount' => SocialNotification::query()
                    ->where('user_id', $actor->id)
                    ->whereNull('read_at')
                    ->count(),
            ],
        ]);
    }
}
