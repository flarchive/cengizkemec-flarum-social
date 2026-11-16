<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Follow;
use CengizKemec\Social\Models\Friendship;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\UserPresenter;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class FriendshipController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected UserPresenter $users,
        protected Notifier $notifier
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        if (! $this->settings->bool('enable_friends') || ! $actor->can('social.friendRequest')) {
            throw new PermissionDeniedException();
        }

        return match ($this->routeName($request)) {
            'social.friends.index' => $this->index($request, $actor),
            'social.friends.request' => $this->requestFriend($request, $actor),
            'social.friends.accept' => $this->accept($request, $actor),
            'social.friends.decline' => $this->decline($request, $actor),
            'social.friends.remove' => $this->remove($request, $actor),
            'social.friends.block' => $this->block($request, $actor),
            'social.friends.unblock' => $this->unblock($request, $actor),
            default => $this->notFound(),
        };
    }

    protected function index(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $incoming = Friendship::query()
            ->where('friend_id', $actor->id)
            ->where('status', Friendship::STATUS_PENDING)
            ->get()
            ->map(fn (Friendship $friendship) => [
                'id' => (int) $friendship->id,
                'user' => $this->users->basic(User::query()->find($friendship->user_id)),
                'createdAt' => $friendship->created_at?->toIso8601String(),
            ])->filter(fn ($item) => $item['user'] !== null)->values()->all();

        $outgoing = Friendship::query()
            ->where('user_id', $actor->id)
            ->where('status', Friendship::STATUS_PENDING)
            ->get()
            ->map(fn (Friendship $friendship) => [
                'id' => (int) $friendship->id,
                'user' => $this->users->basic(User::query()->find($friendship->friend_id)),
                'createdAt' => $friendship->created_at?->toIso8601String(),
            ])->filter(fn ($item) => $item['user'] !== null)->values()->all();

        $friends = Friendship::query()
            ->where('status', Friendship::STATUS_ACCEPTED)
            ->where(function ($query) use ($actor) {
                $query->where('user_id', $actor->id)->orWhere('friend_id', $actor->id);
            })
            ->get()
            ->map(function (Friendship $friendship) use ($actor) {
                $otherId = (int) $friendship->user_id === (int) $actor->id ? $friendship->friend_id : $friendship->user_id;

                return [
                    'id' => (int) $friendship->id,
                    'user' => $this->users->basic(User::query()->find($otherId)),
                ];
            })->filter(fn ($item) => $item['user'] !== null)->values()->all();

        $blocked = Friendship::query()
            ->where('user_id', $actor->id)
            ->where('status', Friendship::STATUS_BLOCKED)
            ->get()
            ->map(fn (Friendship $friendship) => [
                'id' => (int) $friendship->id,
                'user' => $this->users->basic(User::query()->find($friendship->friend_id)),
            ])->filter(fn ($item) => $item['user'] !== null)->values()->all();

        return $this->json([
            'data' => [
                'incoming' => $incoming,
                'outgoing' => $outgoing,
                'friends' => $friends,
                'blocked' => $blocked,
            ],
        ]);
    }

    protected function requestFriend(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $target = User::query()->find((int) $this->routeParam($request, 'id'));

        if (! $target || $target->isGuest() || $target->id === $actor->id) {
            $this->validationError('user_not_found');
        }

        $existing = Friendship::query()
            ->where(function ($query) use ($actor, $target) {
                $query->where('user_id', $actor->id)->where('friend_id', $target->id);
            })
            ->orWhere(function ($query) use ($actor, $target) {
                $query->where('user_id', $target->id)->where('friend_id', $actor->id);
            })
            ->first();

        if ($existing && $existing->status === Friendship::STATUS_BLOCKED) {
            throw new PermissionDeniedException();
        }

        if ($existing && $existing->status === Friendship::STATUS_ACCEPTED) {
            return $this->json(['data' => ['status' => 'accepted']]);
        }

        if ($existing && $existing->status === Friendship::STATUS_PENDING) {
            return $this->json(['data' => ['status' => 'pending']]);
        }

        $friendship = $existing ?: new Friendship();
        $friendship->user_id = $actor->id;
        $friendship->friend_id = $target->id;
        $friendship->status = Friendship::STATUS_PENDING;
        $friendship->created_at = $friendship->created_at ?: \Illuminate\Support\now();
        $friendship->updated_at = \Illuminate\Support\now();
        $friendship->save();

        $this->audit('social.friend.requested', ['friendship_id' => (int) $friendship->id, 'target_user_id' => (int) $target->id]);

        $this->notifier->notify($target, 'friend', $actor, 'friendship', $friendship->id);

        return $this->json(['data' => ['id' => (int) $friendship->id, 'status' => 'pending']], 201);
    }

    protected function accept(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $friendship = Friendship::query()
            ->where('id', (int) $this->routeParam($request, 'id'))
            ->where('friend_id', $actor->id)
            ->where('status', Friendship::STATUS_PENDING)
            ->first();

        if (! $friendship) {
            return $this->notFound();
        }

        $friendship->status = Friendship::STATUS_ACCEPTED;
        $friendship->acted_by = $actor->id;
        $friendship->updated_at = \Illuminate\Support\now();
        $friendship->save();

        $this->audit('social.friend.accepted', ['friendship_id' => (int) $friendship->id]);

        $this->notifier->notify(User::query()->find($friendship->user_id), 'friend', $actor, 'friendship', $friendship->id, [
            'accepted' => true,
        ]);

        return $this->json(['data' => ['id' => (int) $friendship->id, 'status' => 'accepted']]);
    }

    protected function decline(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $friendship = Friendship::query()
            ->where('id', (int) $this->routeParam($request, 'id'))
            ->where('friend_id', $actor->id)
            ->where('status', Friendship::STATUS_PENDING)
            ->first();

        if (! $friendship) {
            return $this->notFound();
        }

        $friendship->status = Friendship::STATUS_DECLINED;
        $friendship->acted_by = $actor->id;
        $friendship->updated_at = \Illuminate\Support\now();
        $friendship->save();

        $this->audit('social.friend.declined', ['friendship_id' => (int) $friendship->id]);

        return $this->json(['data' => ['status' => 'declined']]);
    }

    protected function remove(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $friendship = Friendship::query()
            ->where('id', (int) $this->routeParam($request, 'id'))
            ->where(function ($query) use ($actor) {
                $query->where('user_id', $actor->id)->orWhere('friend_id', $actor->id);
            })
            ->first();

        if (! $friendship) {
            return $this->notFound();
        }

        $friendship->delete();

        $this->audit('social.friend.removed', ['friendship_id' => (int) $friendship->id]);

        return $this->json(['data' => ['deleted' => true]]);
    }

    protected function block(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        $target = User::query()->find((int) $this->routeParam($request, 'id'));

        if (! $target || $target->isGuest() || $target->id === $actor->id) {
            $this->validationError('user_not_found');
        }

        Friendship::query()
            ->where(function ($query) use ($actor, $target) {
                $query->where('user_id', $actor->id)->where('friend_id', $target->id);
            })
            ->orWhere(function ($query) use ($actor, $target) {
                $query->where('user_id', $target->id)->where('friend_id', $actor->id);
            })
            ->delete();

        $friendship = new Friendship();
        $friendship->user_id = $actor->id;
        $friendship->friend_id = $target->id;
        $friendship->status = Friendship::STATUS_BLOCKED;
        $friendship->acted_by = $actor->id;
        $friendship->created_at = \Illuminate\Support\now();
        $friendship->updated_at = \Illuminate\Support\now();
        $friendship->save();

        $this->audit('social.friend.blocked', ['friendship_id' => (int) $friendship->id, 'target_user_id' => (int) $target->id]);

        Follow::query()
            ->where(function ($query) use ($actor, $target) {
                $query->where('follower_id', $actor->id)->where('following_id', $target->id);
            })
            ->orWhere(function ($query) use ($actor, $target) {
                $query->where('follower_id', $target->id)->where('following_id', $actor->id);
            })
            ->delete();

        return $this->json(['data' => ['blocked' => true]]);
    }

    protected function unblock(ServerRequestInterface $request, User $actor): ResponseInterface
    {
        Friendship::query()
            ->where('user_id', $actor->id)
            ->where('friend_id', (int) $this->routeParam($request, 'id'))
            ->where('status', Friendship::STATUS_BLOCKED)
            ->delete();

        $this->audit('social.friend.unblocked', ['target_user_id' => (int) $this->routeParam($request, 'id')]);

        return $this->json(['data' => ['blocked' => false]]);
    }
}
