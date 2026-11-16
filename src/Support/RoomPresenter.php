<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\RoomParticipant;
use CengizKemec\Social\Models\TextChannel;
use Flarum\User\User;

class RoomPresenter
{
    public function __construct(
        protected Access $access,
        protected SocialSettings $settings,
        protected UserPresenter $users
    ) {
    }

    public function present(Room $room, ?User $actor, bool $detailed = false): array
    {
        $isGuest = $actor === null || $actor->isGuest();
        $showCounts = ! $isGuest || $this->settings->bool('guest_show_participant_counts');
        $liveCount = $room->participants()
            ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
            ->count();

        $channels = [];

        if (! $isGuest || $this->settings->bool('guest_public_community')) {
            $channels = TextChannel::query()
                ->where('room_id', $room->id)
                ->orderBy('position')
                ->get()
                ->filter(fn (TextChannel $channel) => $this->access->canViewChannel($channel, $actor ?? new \Flarum\User\Guest()))
                ->map(fn (TextChannel $channel) => [
                    'id' => (int) $channel->id,
                    'slug' => $channel->slug,
                    'name' => $channel->name,
                    'description' => $channel->description,
                    'icon' => $channel->icon,
                    'visibility' => $channel->visibility,
                    'isLocked' => (bool) $channel->is_locked,
                ])
                ->values()
                ->all();
        }

        $data = [
            'id' => (int) $room->id,
            'slug' => $room->slug ?: 'room-'.$room->id,
            'name' => $room->name,
            'description' => $room->description,
            'icon' => $room->icon,
            'type' => $room->type,
            'visibility' => $room->visibility,
            'categoryId' => $room->category_id ? (int) $room->category_id : null,
            'capacity' => (int) $room->capacity,
            'participantCount' => $showCounts ? $liveCount : null,
            'isVoice' => (bool) $room->is_voice,
            'isText' => (bool) $room->is_text,
            'isLocked' => (bool) $room->is_locked,
            'hasPassword' => $room->password_hash !== null,
            'allowScreenShare' => (bool) $room->allow_screen_share,
            'forceMuted' => true,
            'owner' => $room->owner ? $this->users->basic($room->owner) : null,
            'createdAt' => $room->created_at?->toIso8601String(),
            'expiresAt' => $room->expires_at?->toIso8601String(),
            'channels' => $channels,
            'canJoin' => $actor && ! $actor->isGuest() ? $this->access->canJoinRoom($room, $actor) : false,
            'canManage' => $actor && ! $actor->isGuest() ? $this->access->canManageRoom($room, $actor) : false,
            'passwordRequired' => $room->password_hash !== null,
        ];

        if ($detailed && $actor && ! $actor->isGuest()) {
            $data['participants'] = RoomParticipant::query()
                ->with('user')
                ->where('room_id', $room->id)
                ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
                ->orderBy('joined_at')
                ->get()
                ->map(fn (RoomParticipant $participant) => array_merge(
                    $this->users->basic($participant->user),
                    [
                        'role' => $participant->role,
                        'muted' => (bool) $participant->muted,
                        'joinedAt' => $participant->joined_at?->toIso8601String(),
                    ]
                ))
                ->all();
        }

        return $data;
    }
}
