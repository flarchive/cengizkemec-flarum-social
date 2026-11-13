<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\Follow;
use CengizKemec\Social\Models\UserPreference;
use CengizKemec\Social\Models\UserStatus;
use Flarum\User\User;

class UserPresenter
{
    protected array $preferences = [];

    protected function preference(User $user): ?UserPreference
    {
        if (! array_key_exists((int) $user->id, $this->preferences)) {
            $this->preferences[(int) $user->id] = UserPreference::query()->find($user->id);
        }

        return $this->preferences[(int) $user->id];
    }

    /**
     * The profile-cover extension stores a relative filename. Resolve it
     * through the extension's own disk so Social and Flarum show the same URL.
     */
    protected function nativeCover(User $user): ?string
    {
        // Cover Studio stores its URL in a companion relation and already
        // returns a fully-qualified URL. Prefer it when a cover is active.
        try {
            $coverStudio = $user->coverStudioData ?? null;

            if ($coverStudio && ! empty($coverStudio->cover_file_id) && ! empty($coverStudio->cover_url)) {
                return (string) $coverStudio->cover_url;
            }
        } catch (\Throwable $e) {
            // Cover Studio is optional.
        }

        $cover = $user->cover ?? null;

        if (! $cover) {
            return null;
        }

        if (preg_match('#^(https?:)?//#i', $cover) || str_starts_with($cover, '/')) {
            return $cover;
        }

        try {
            return resolve(\Illuminate\Contracts\Filesystem\Factory::class)
                ->disk('sycho-profile-cover')
                ->url($cover);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Return the highest-priority visible group colour, if the group has one.
     * Social uses it only as a name accent; it never replaces the theme's
     * readable text colour when a group has no colour.
     */
    protected function role(User $user): array
    {
        try {
            $group = $user->groups
                ->filter(fn ($group) => ! empty($group->color))
                ->sortByDesc('position')
                ->first();

            if (! $group) {
                return [null, null];
            }

            $color = trim((string) $group->color);

            return [
                preg_match('/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $color) ? $color : null,
                $group->name_singular ?: null,
            ];
        } catch (\Throwable $e) {
            return [null, null];
        }
    }

    public function basic(User $user): array
    {
        $lastSeen = $user->last_seen_at;
        $preferences = $this->preference($user);
        $nativeCover = $this->nativeCover($user);
        $nativeBio = isset($user->bio) ? trim(strip_tags((string) $user->bio)) : null;
        [$roleColor, $roleName] = $this->role($user);

        return [
            'id' => (int) $user->id,
            'username' => $user->username,
            'displayName' => $user->display_name,
            'avatarUrl' => $user->avatar_url,
            'coverUrl' => $nativeCover ?: ($preferences->cover_url ?? null),
            'bio' => $nativeBio ?: ($preferences->bio ?? null),
            'roleColor' => $roleColor,
            'roleName' => $roleName,
            'online' => $lastSeen !== null && $lastSeen->gt(\Illuminate\Support\now()->subMinutes(5)),
            'isAdmin' => $user->isAdmin(),
        ];
    }

    public function full(User $user, ?User $actor = null): array
    {
        $preferences = $this->preference($user);
        $status = UserStatus::query()->find($user->id);
        $data = $this->basic($user);
        $nativeBio = isset($user->bio) ? trim(strip_tags((string) $user->bio)) : null;
        $nativeCover = $this->nativeCover($user);

        $data = array_merge($data, [
            'headline' => $preferences->headline ?? null,
            'bio' => $nativeBio ?: ($preferences->bio ?? null),
            'coverUrl' => $nativeCover ?: ($preferences->cover_url ?? null),
            'customStatus' => $preferences->custom_status ?? null,
            'privacy' => $preferences->privacy ?? 'public',
            'joinedAt' => $user->joined_at?->toIso8601String(),
            'lastOnlineAt' => $status?->last_online_at?->toIso8601String() ?? $user->last_seen_at?->toIso8601String(),
            'followersCount' => Follow::query()->where('following_id', $user->id)->count(),
            'followingCount' => Follow::query()->where('follower_id', $user->id)->count(),
            'postsCount' => \CengizKemec\Social\Models\Post::query()
                ->where('user_id', $user->id)
                ->whereNull('deleted_at')
                ->count(),
            'isFollowing' => $actor && ! $actor->isGuest()
                ? Follow::query()->where('follower_id', $actor->id)->where('following_id', $user->id)->exists()
                : false,
            'isSelf' => $actor && ! $actor->isGuest() && $actor->id === $user->id,
            'canMessage' => $actor && ! $actor->isGuest() && $actor->id !== $user->id,
        ]);

        if ($actor && ! $actor->isGuest() && (int) $actor->id === (int) $user->id) {
            $settings = $preferences->settings ?? [];
            $data['voiceSettings'] = is_array($settings['voice'] ?? null) ? $settings['voice'] : [];
        }

        return $data;
    }
}
