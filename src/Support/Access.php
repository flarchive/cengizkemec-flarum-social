<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\Follow;
use CengizKemec\Social\Models\Friendship;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\RoomBan;
use CengizKemec\Social\Models\TextChannel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Central place for all social authorization and visibility decisions.
 * Frontend checks are only cosmetic; every method here is used server-side.
 */
class Access
{
    public function __construct(protected SocialSettings $settings)
    {
    }

    public function enabled(): bool
    {
        return $this->settings->bool('enabled');
    }

    public function isGuest(User $actor): bool
    {
        return $actor->isGuest();
    }

    public function canViewCommunity(User $actor): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        if (! $this->isGuest($actor)) {
            return true;
        }

        return $this->settings->bool('guest_access')
            && $this->settings->bool('guest_public_community');
    }

    public function canViewFeed(User $actor): bool
    {
        if (! $this->enabled() || ! $this->settings->bool('enable_feed')) {
            return false;
        }

        if ($this->isGuest($actor)) {
            return $this->settings->bool('guest_access')
                && ! $this->settings->bool('guest_require_login_feed')
                && $this->settings->bool('guest_public_posts');
        }

        return true;
    }

    public function canViewProfiles(User $actor): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        if ($this->isGuest($actor)) {
            return $this->settings->bool('guest_access')
                && $this->settings->bool('guest_public_profiles');
        }

        return true;
    }

    public function canViewMedia(User $actor): bool
    {
        if (! $this->enabled() || ! $this->settings->bool('enable_media')) {
            return false;
        }

        if ($this->isGuest($actor)) {
            return $this->settings->bool('guest_access')
                && $this->settings->bool('guest_public_media');
        }

        return true;
    }

    public function canUseVoice(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && $this->settings->bool('enable_voice')
            && ! $this->isRestricted($actor)
            && $actor->can('social.useVoice');
    }

    public function canUseText(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && $this->settings->bool('enable_text')
            && ! $this->isRestricted($actor)
            && $actor->can('social.useText');
    }

    public function canSendMessages(User $actor): bool
    {
        return $this->canUseText($actor) && $actor->can('social.sendMessage');
    }

    public function canUseDirectMessages(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && $this->settings->bool('enable_messages')
            && $this->settings->bool('dm_enabled')
            && ! $this->isRestricted($actor)
            && $actor->can('social.sendDirectMessage');
    }

    public function isRestricted(User $actor): bool
    {
        if ($this->isGuest($actor)) {
            return false;
        }

        $preference = \CengizKemec\Social\Models\UserPreference::query()->find($actor->id);

        return $preference !== null
            && $preference->restricted_until !== null
            && $preference->restricted_until->isFuture();
    }

    public function canCreatePosts(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && $this->settings->bool('enable_feed')
            && ! $this->isRestricted($actor)
            && $actor->can('social.createPost');
    }

    public function canComment(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && $this->settings->bool('allow_comments')
            && ! $this->isRestricted($actor)
            && $actor->can('social.comment');
    }

    public function canReact(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && $this->settings->bool('allow_reactions')
            && ! $this->isRestricted($actor)
            && $actor->can('social.react');
    }

    public function canBookmark(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && $this->settings->bool('allow_bookmarks')
            && ! $this->isRestricted($actor)
            && $actor->can('social.bookmark');
    }

    public function canCreateStory(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && $this->settings->bool('enable_stories')
            && ! $this->isRestricted($actor)
            && $actor->can('social.createStory');
    }

    public function canCreateRoom(User $actor): bool
    {
        if ($this->isGuest($actor) || ! $this->enabled() || ! $this->settings->bool('enable_user_rooms') || ! $this->settings->bool('allow_user_rooms') || $this->isRestricted($actor)) {
            return false;
        }

        if (! $actor->can('social.createRoom')) {
            return false;
        }

        return $this->isInAllowedGroups($actor, $this->settings->list('user_room_allowed_groups'));
    }

    public function canJoinRooms(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->enabled()
            && ! $this->isRestricted($actor)
            && $actor->can('social.joinRoom');
    }

    public function isStaff(User $actor): bool
    {
        return ! $this->isGuest($actor)
            && ($actor->isAdmin()
                || $actor->can('social.moderatePosts')
                || $actor->can('social.manageRooms')
                || $actor->can('social.manageAllRooms'));
    }

    public function isInAllowedGroups(User $actor, array $groups): bool
    {
        if (empty($groups)) {
            return true;
        }

        $ids = $actor->groups->pluck('id')->map(fn ($id) => (int) $id)->all();

        return count(array_intersect($ids, array_map('intval', $groups))) > 0;
    }

    /**
     * Apply post visibility to an Eloquent query.
     */
    public function scopePosts(Builder $query, User $actor): Builder
    {
        $query->whereNull('deleted_at');

        if ($this->isGuest($actor)) {
            if (! $this->canViewFeed($actor) || ! $actor->can('social.viewPublicPosts')) {
                return $query->whereRaw('1 = 0');
            }

            return $query->where('visibility', 'public');
        }

        if ($this->isStaff($actor)) {
            return $query;
        }

        return $query->where(function (Builder $query) use ($actor) {
            $query->where('user_id', $actor->id);

            if ($actor->can('social.viewPublicPosts')) {
                $query->orWhere('visibility', 'public');
            }

            if ($actor->can('social.viewMemberPosts')) {
                $query->orWhere('visibility', 'members');
            }

            $query->orWhere(function (Builder $query) use ($actor) {
                $query->where('visibility', 'followers')
                    ->whereIn('user_id', Follow::query()
                        ->where('follower_id', $actor->id)
                        ->select('following_id'));
            });
        });
    }

    public function canViewPost(Post $post, User $actor): bool
    {
        if (! $this->enabled() || $post->deleted_at !== null) {
            return false;
        }

        if (! $this->isGuest($actor) && ($post->user_id === $actor->id || $this->isStaff($actor))) {
            return true;
        }

        if ($post->visibility === 'public') {
            return $this->isGuest($actor)
                ? $this->canViewFeed($actor) && $actor->can('social.viewPublicPosts')
                : $actor->can('social.viewPublicPosts');
        }

        if ($this->isGuest($actor)) {
            return false;
        }

        if ($post->visibility === 'members') {
            return $actor->can('social.viewMemberPosts');
        }

        if ($post->visibility === 'followers') {
            return Follow::query()
                ->where('follower_id', $actor->id)
                ->where('following_id', $post->user_id)
                ->exists();
        }

        return false;
    }

    public function canViewRoom(Room $room, User $actor): bool
    {
        if (! $this->enabled() || $room->status !== 'active' || $room->isExpired()) {
            return false;
        }

        if ($this->isGuest($actor)) {
            return $room->visibility === 'public'
                && $this->settings->bool('guest_access')
                && $this->settings->bool('guest_public_community')
                && $this->settings->bool('guest_show_room_names');
        }

        // A room manager, member or invited member can open the room even if
        // the room's group restriction would otherwise hide it. This is what
        // makes shareable invite links work like Discord invites.
        if ($this->canManageRoom($room, $actor)
            || $room->participants()->where('user_id', $actor->id)->exists()
            || \CengizKemec\Social\Models\RoomInvitation::query()
                ->where('room_id', $room->id)
                ->where('invitee_id', $actor->id)
                ->whereIn('status', ['pending', 'accepted'])
                ->exists()
            || $this->isStaff($actor)) {
            return true;
        }

        if (! $this->isInAllowedGroups($actor, $room->allowed_groups ?? [])) {
            return false;
        }

        if ($room->visibility === 'public' || $room->visibility === 'members') {
            return true;
        }

        if ($room->visibility === 'staff') {
            return $this->isStaff($actor);
        }

        if ($room->visibility === 'private' || $room->visibility === 'invite') {
            return false;
        }

        return false;
    }

    public function canJoinRoom(Room $room, User $actor): bool
    {
        if (! $this->canJoinRooms($actor) || ! $this->canViewRoom($room, $actor)) {
            return false;
        }

        if ($room->is_locked || $room->status !== 'active') {
            return false;
        }

        if (RoomBan::query()
            ->where('room_id', $room->id)
            ->where('user_id', $actor->id)
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', \Illuminate\Support\now());
            })
            ->exists()) {
            return false;
        }

        return true;
    }

    public function canManageRoom(Room $room, User $actor): bool
    {
        if ($this->isGuest($actor)) {
            return false;
        }

        if ($actor->isAdmin() || $actor->can('social.manageAllRooms')) {
            return true;
        }

        if ($room->owner_id === $actor->id) {
            return true;
        }

        if (\CengizKemec\Social\Models\RoomModerator::query()
            ->where('room_id', $room->id)
            ->where('user_id', $actor->id)
            ->exists()) {
            return true;
        }

        return $actor->can('social.manageRooms') && $room->type === 'temporary';
    }

    public function canViewChannel(TextChannel $channel, User $actor): bool
    {
        if ($channel->room_id) {
            $room = $channel->room;

            // Guests must not discover public channels inside rooms that are
            // otherwise hidden from them.
            if (! $room || ! $this->canViewRoom($room, $actor)) {
                return false;
            }
        }

        if ($this->isGuest($actor)) {
            return $channel->visibility === 'public'
                && $this->settings->bool('guest_public_community')
                && $this->settings->bool('guest_show_room_names');
        }

        if ($channel->visibility === 'staff') {
            return $this->isStaff($actor);
        }

        return $channel->visibility === 'public' || $channel->visibility === 'members';
    }

    public function canReadChannelMessages(TextChannel $channel, User $actor): bool
    {
        return ! $this->isGuest($actor)
            && $this->settings->bool('enable_text')
            && $this->canViewChannel($channel, $actor)
            && ($actor->can('social.useText') && $actor->can('social.sendMessage'));
    }

    public function canAccessDirectConversation(int $conversationId, User $actor): bool
    {
        if ($this->isGuest($actor) || ! $this->canUseDirectMessages($actor)) {
            return false;
        }

        return \CengizKemec\Social\Models\DirectParticipant::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $actor->id)
            ->exists();
    }

    public function canMessageUser(User $recipient, User $actor): bool
    {
        if ($recipient->isGuest() || $recipient->id === $actor->id || ! $this->canUseDirectMessages($actor)) {
            return false;
        }

        if ($this->settings->bool('dm_friend_only')) {
            $friends = Friendship::query()
                ->where('status', Friendship::STATUS_ACCEPTED)
                ->where(function ($query) use ($actor, $recipient) {
                    $query->where('user_id', $actor->id)->where('friend_id', $recipient->id);
                })
                ->orWhere(function ($query) use ($actor, $recipient) {
                    $query->where('user_id', $recipient->id)->where('friend_id', $actor->id)->where('status', Friendship::STATUS_ACCEPTED);
                })
                ->exists();

            if (! $friends) {
                return false;
            }
        }

        if ($this->settings->bool('dm_blocking')) {
            $blocked = Friendship::query()
                ->where('status', Friendship::STATUS_BLOCKED)
                ->where(function ($query) use ($actor, $recipient) {
                    $query->where('user_id', $actor->id)->where('friend_id', $recipient->id);
                })
                ->orWhere(function ($query) use ($actor, $recipient) {
                    $query->where('user_id', $recipient->id)->where('friend_id', $actor->id)->where('status', Friendship::STATUS_BLOCKED);
                })
                ->exists();

            if ($blocked) {
                return false;
            }
        }

        return $this->isInAllowedGroups($actor, $this->settings->list('dm_allowed_groups'));
    }

    public function requireRegistered(User $actor): void
    {
        $actor->assertRegistered();
    }

    public function requireEnabled(): void
    {
        if (! $this->enabled()) {
            throw new \Flarum\User\Exception\PermissionDeniedException();
        }
    }
}
