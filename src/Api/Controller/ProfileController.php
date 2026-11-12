<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Follow;
use CengizKemec\Social\Models\Friendship;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\UserPreference;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\UserPresenter;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class ProfileController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected UserPresenter $users,
        protected Notifier $notifier,
        protected \CengizKemec\Social\Support\PostPresenter $posts
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        return match ($this->routeName($request)) {
            'social.profile.show' => $this->show($request),
            'social.profile.follow' => $this->follow($request),
            'social.profile.unfollow' => $this->unfollow($request),
            'social.profile.update' => $this->update($request),
            'social.profile.followers' => $this->relationList($request, 'followers'),
            'social.profile.following' => $this->relationList($request, 'following'),
            default => $this->notFound(),
        };
    }

    protected function findProfile(ServerRequestInterface $request): ?User
    {
        $username = (string) $this->routeParam($request, 'username');

        return User::query()->where('username', $username)->first();
    }

    protected function show(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $user = $this->findProfile($request);

        if (! $user) {
            return $this->notFound('user_not_found');
        }

        if (! $this->access->canViewProfiles($actor)) {
            return $this->forbidden('profile_forbidden');
        }

        $preference = UserPreference::query()->find($user->id);
        $privacy = $preference->privacy ?? 'public';

        if ($actor->isGuest() && $privacy !== 'public') {
            return $this->forbidden('profile_forbidden');
        }

        if ($privacy === 'private' && ! $actor->isAdmin() && (int) $actor->id !== (int) $user->id) {
            return $this->forbidden('profile_forbidden');
        }

        $query = Post::query()
            ->with('user')
            ->where('user_id', $user->id)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->limit(12);
        $this->access->scopePosts($query, $actor);
        $recent = $query->get();

        $friendship = null;

        if (! $actor->isGuest()) {
            $friendship = Friendship::query()
                ->where(function ($query) use ($actor, $user) {
                    $query->where('user_id', $actor->id)->where('friend_id', $user->id);
                })
                ->orWhere(function ($query) use ($actor, $user) {
                    $query->where('user_id', $user->id)->where('friend_id', $actor->id);
                })
                ->first();
        }

        return $this->json([
            'data' => array_merge($this->users->full($user, $actor), [
                'friendshipStatus' => $friendship?->status,
                'friendshipId' => $friendship?->id,
                'canMessage' => ! $actor->isGuest() && $this->access->canMessageUser($user, $actor),
                'recentPosts' => $this->posts->presentMany($recent, $actor),
            ]),
        ]);
    }

    protected function follow(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $actor->assertCan('social.follow');

        if ($this->access->isRestricted($actor)) {
            throw new PermissionDeniedException();
        }

        $user = $this->findProfile($request);

        if (! $user || $user->id === $actor->id) {
            $this->validationError('user_not_found');
        }

        $exists = Follow::query()->where('follower_id', $actor->id)->where('following_id', $user->id)->first();

        if (! $exists) {
            $follow = new Follow();
            $follow->follower_id = $actor->id;
            $follow->following_id = $user->id;
            $follow->created_at = \Illuminate\Support\now();
            $follow->save();
            $this->audit('social.follow.created', ['target_user_id' => (int) $user->id]);
            $this->notifier->notify($user, 'follow', $actor, 'user', $user->id);
        }

        return $this->json(['data' => ['following' => true]]);
    }

    protected function unfollow(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $user = $this->findProfile($request);

        if (! $user) {
            return $this->notFound('user_not_found');
        }

        Follow::query()->where('follower_id', $actor->id)->where('following_id', $user->id)->delete();

        $this->audit('social.follow.deleted', ['target_user_id' => (int) $user->id]);

        return $this->json(['data' => ['following' => false]]);
    }

    protected function update(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        if ($this->access->isRestricted($actor)) {
            throw new PermissionDeniedException();
        }

        $body = $this->body($request);

        $preference = UserPreference::query()->firstOrNew(['user_id' => $actor->id]);

        if (array_key_exists('headline', $body)) {
            $preference->headline = $this->cleanString($body['headline'], 160) ?: null;
        }

        if (array_key_exists('bio', $body)) {
            $preference->bio = $this->cleanString($body['bio'], 2000) ?: null;
        }

        if (array_key_exists('custom_status', $body)) {
            $preference->custom_status = $this->cleanString($body['custom_status'], 120) ?: null;
        }

        if (array_key_exists('cover_url', $body)) {
            $url = $this->cleanString($body['cover_url'], 255);

            if ($url !== '') {
                $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

                if (! filter_var($url, FILTER_VALIDATE_URL) || ! in_array($scheme, ['http', 'https'], true)) {
                    $this->validationError('invalid_url');
                }
            }

            $preference->cover_url = $url ?: null;
        }

        if (array_key_exists('privacy', $body) && in_array($body['privacy'], ['public', 'members', 'private'], true)) {
            $preference->privacy = $body['privacy'];
        }

        if (array_key_exists('voice_settings', $body) && is_array($body['voice_settings'])) {
            $settings = is_array($preference->settings) ? $preference->settings : [];
            $voice = is_array($settings['voice'] ?? null) ? $settings['voice'] : [];
            $incoming = $body['voice_settings'];

            foreach (['pushToTalk', 'sounds', 'defaultMuted', 'noiseSuppression', 'echoCancellation', 'autoGainControl'] as $flag) {
                if (array_key_exists($flag, $incoming)) {
                    $voice[$flag] = (bool) $incoming[$flag];
                }
            }

            if (array_key_exists('pttKey', $incoming)) {
                $key = preg_replace('/[^A-Za-z0-9]/', '', (string) $incoming['pttKey']);

                if ($key !== '') {
                    $voice['pttKey'] = mb_substr($key, 0, 32);
                }
            }

            $settings['voice'] = $voice;
            $preference->settings = $settings;
        }

        $preference->updated_at = \Illuminate\Support\now();
        $preference->save();

        $this->audit('social.profile.updated', ['privacy' => $preference->privacy]);

        return $this->json(['data' => $this->users->full($actor->fresh(), $actor)]);
    }

    protected function relationList(ServerRequestInterface $request, string $type): ResponseInterface
    {
        $actor = $this->actor($request);
        $user = $this->findProfile($request);

        if (! $user || ! $this->access->canViewProfiles($actor)) {
            return $this->notFound('user_not_found');
        }

        $preference = UserPreference::query()->find($user->id);
        $privacy = $preference->privacy ?? 'public';

        if ($actor->isGuest() && $privacy !== 'public') {
            return $this->forbidden('profile_forbidden');
        }

        if ($privacy === 'private' && ! $actor->isAdmin() && (int) $actor->id !== (int) $user->id) {
            return $this->forbidden('profile_forbidden');
        }

        $query = $type === 'followers'
            ? Follow::query()->where('following_id', $user->id)
            : Follow::query()->where('follower_id', $user->id);

        $ids = $query->limit(100)->get()->map(fn (Follow $follow) => $type === 'followers' ? $follow->follower_id : $follow->following_id);

        $users = User::query()->whereIn('id', $ids)->get()->map(fn (User $item) => $this->users->basic($item))->all();

        return $this->json(['data' => $users]);
    }
}
