<?php

namespace CengizKemec\Social\Cleanup;

use CengizKemec\Social\Media\MediaStorage;
use CengizKemec\Social\Models\CleanupLog;
use CengizKemec\Social\Models\DirectMessage;
use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\MediaReference;
use CengizKemec\Social\Models\Message;
use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\RoomBan;
use CengizKemec\Social\Models\RoomInvitation;
use CengizKemec\Social\Models\RoomModerator;
use CengizKemec\Social\Models\RoomParticipant;
use CengizKemec\Social\Models\Story;
use CengizKemec\Social\Models\StoryView;
use CengizKemec\Social\Models\TextChannel;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\VoiceActivityTracker;

class CleanupService
{
    public function __construct(
        protected SocialSettings $settings,
        protected MediaStorage $storage,
        protected VoiceActivityTracker $voiceActivity
    ) {
    }

    /**
     * @return array<string, int|bool>
     */
    public function run(bool $dryRun = false, string $only = 'all'): array
    {
        $started = microtime(true);
        $stats = [
            'dry_run' => $dryRun,
            'stories_expired' => 0,
            'temporary_media_deleted' => 0,
            'orphaned_media_deleted' => 0,
            'media_deleted' => 0,
            'bytes_freed' => 0,
            'rooms_deleted' => 0,
            'participants_pruned' => 0,
            'dm_messages_deleted' => 0,
            'media_kept_referenced' => 0,
        ];

        if ($only === 'all' || $only === 'stories') {
            $stats = array_merge($stats, $this->cleanupStories($dryRun));
        }

        if ($only === 'all' || $only === 'media') {
            $stats = array_merge($stats, $this->cleanupMedia($dryRun));
        }

        if ($only === 'all' || $only === 'rooms') {
            $stats = array_merge($stats, $this->cleanupRooms($dryRun));
        }

        if ($only === 'all' || $only === 'messages') {
            $stats = array_merge($stats, $this->cleanupDirectMessages($dryRun));
        }

        $stats['duration_ms'] = (int) round((microtime(true) - $started) * 1000);

        if (! $dryRun) {
            $log = new CleanupLog();
            $log->type = $only;
            $log->dry_run = false;
            $log->stats = $stats;
            $log->duration_ms = $stats['duration_ms'];
            $log->created_at = \Illuminate\Support\now();
            $log->save();
        }

        return $stats;
    }

    protected function cleanupStories(bool $dryRun): array
    {
        $stats = ['stories_expired' => 0];
        $stories = Story::query()->where('expires_at', '<', \Illuminate\Support\now())->limit($this->batch())->get();

        foreach ($stories as $story) {
            if ($story->media_id) {
                $this->expireUnreferencedMedia($story->media_id);
            }

            StoryView::query()->where('story_id', $story->id)->delete();
            MediaReference::query()->where('reference_type', 'story')->where('reference_id', $story->id)->delete();

            if (! $dryRun) {
                $story->delete();
            }

            $stats['stories_expired']++;
        }

        return $stats;
    }

    protected function cleanupMedia(bool $dryRun): array
    {
        $stats = [
            'temporary_media_deleted' => 0,
            'orphaned_media_deleted' => 0,
            'media_deleted' => 0,
            'bytes_freed' => 0,
            'media_kept_referenced' => 0,
        ];

        $media = Media::query()
            ->where(function ($query) {
                $query->whereIn('status', ['temporary', 'orphaned', 'active'])
                    ->orWhereNotNull('expires_at');
            })
            ->orderBy('id')
            ->limit($this->batch())
            ->get();

        foreach ($media as $item) {
            $references = MediaReference::query()->where('media_id', $item->id)->count();

            if ($references > 0) {
                $stats['media_kept_referenced']++;
                continue;
            }

            $expiredTemporary = $item->status === 'temporary'
                && $item->expires_at !== null
                && $item->expires_at->isPast();

            $orphanExpired = in_array($item->status, ['orphaned', 'active'], true)
                && $item->last_referenced_at === null
                && $item->created_at !== null
                && $item->created_at->lt(\Illuminate\Support\now()->subDays(max(1, $this->settings->int('orphan_grace_days'))));

            $retentionExpired = $this->retentionExpired($item);

            if (! $expiredTemporary && ! $orphanExpired && ! $retentionExpired) {
                if ($item->status === 'active' && $item->last_referenced_at !== null && $item->last_referenced_at->lt(\Illuminate\Support\now()->subDays(max(1, $this->settings->int('orphan_grace_days'))))) {
                    if (! $dryRun) {
                        $item->status = 'orphaned';
                        $item->expires_at = \Illuminate\Support\now()->addDays(max(1, $this->settings->int('orphan_grace_days')));
                        $item->updated_at = \Illuminate\Support\now();
                        $item->save();
                    }
                }

                continue;
            }

            if (! $dryRun) {
                $this->storage->deleteFiles($item);
                $item->delete();
            }

            $stats['media_deleted']++;
            $stats['bytes_freed'] += (int) $item->size;

            if ($expiredTemporary) {
                $stats['temporary_media_deleted']++;
            } else {
                $stats['orphaned_media_deleted']++;
            }
        }

        return $stats;
    }

    protected function cleanupRooms(bool $dryRun): array
    {
        $stats = ['rooms_deleted' => 0, 'participants_pruned' => 0];

        RoomParticipant::query()
            ->where('last_seen_at', '<', \Illuminate\Support\now()->subMinutes(5))
            ->get()
            ->each(function (RoomParticipant $participant) use (&$stats, $dryRun) {
                if (! $dryRun) {
                    if ($participant->user && $participant->room) {
                        $this->voiceActivity->record($participant->user, $participant->room, $participant->joined_at, $participant->last_seen_at ?: \Illuminate\Support\now());
                    }

                    $participant->delete();
                }
                $stats['participants_pruned']++;
            });

        if (! $dryRun) {
            Room::query()->each(function (Room $room) {
                $room->participant_count = $room->participants()
                    ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(2))
                    ->count();
                $room->save();
            });
        }

        $rooms = Room::query()
            ->where('type', 'temporary')
            ->where('expires_at', '<', \Illuminate\Support\now())
            ->limit($this->batch())
            ->get();

        foreach ($rooms as $room) {
            if (! $dryRun) {
                $this->deleteRoomRecord($room);
            }

            $stats['rooms_deleted']++;
        }

        if (! $dryRun) {
            $stats['rooms_deleted'] += $this->purgeEmptyTemporaryRooms();
        }

        return $stats;
    }

    /**
     * Delete temporary rooms that have been empty for the configured grace
     * period. Called by the presence janitor, bootstrap and the scheduler so
     * short-lived voice rooms disappear quickly after the last member leaves.
     */
    public function purgeEmptyTemporaryRooms(?int $seconds = null): int
    {
        $systemSeconds = max(5, $seconds ?? $this->settings->int('temporary_room_empty_seconds'));
        $userSeconds = $seconds !== null
            ? $systemSeconds
            : max(60, $this->settings->int('user_room_empty_expiry_minutes') * 60);
        $systemCutoff = \Illuminate\Support\now()->subSeconds($systemSeconds);
        $userCutoff = \Illuminate\Support\now()->subSeconds($userSeconds);
        $stale = \Illuminate\Support\now()->subMinutes(2);
        $deleted = 0;

        Room::query()
            ->where('type', 'temporary')
            ->where('status', 'active')
            ->where(function ($query) use ($systemCutoff, $userCutoff) {
                $query->where(function ($system) use ($systemCutoff) {
                    $system->whereNull('owner_id')
                        ->where('created_at', '<=', $systemCutoff)
                        ->where(function ($activity) use ($systemCutoff) {
                            $activity->whereNull('last_activity_at')->orWhere('last_activity_at', '<=', $systemCutoff);
                        });
                })->orWhere(function ($user) use ($userCutoff) {
                    $user->whereNotNull('owner_id')
                        ->where('created_at', '<=', $userCutoff)
                        ->where(function ($activity) use ($userCutoff) {
                            $activity->whereNull('last_activity_at')->orWhere('last_activity_at', '<=', $userCutoff);
                        });
                });
            })
            ->orderBy('id')
            ->chunkById(100, function ($rooms) use (&$deleted, $stale) {
                foreach ($rooms as $room) {
                    $live = $room->participants()
                        ->where('last_seen_at', '>', $stale)
                        ->count();

                    if ($live > 0) {
                        if ((int) $room->participant_count !== $live) {
                            $room->participant_count = $live;
                            $room->save();
                        }

                        continue;
                    }

                    $this->deleteRoomRecord($room);
                    $deleted++;
                }
            });

        return $deleted;
    }

    protected function deleteRoomRecord(Room $room): void
    {
        $channelIds = TextChannel::query()->where('room_id', $room->id)->pluck('id');

        $room->participants()->with('user')->get()->each(function (RoomParticipant $participant) use ($room) {
            if ($participant->user) {
                $this->voiceActivity->record($participant->user, $room, $participant->joined_at, $participant->last_seen_at ?: \Illuminate\Support\now());
            }
        });

        Message::query()->whereIn('channel_id', $channelIds)->delete();
        TextChannel::query()->where('room_id', $room->id)->delete();
        RoomParticipant::query()->where('room_id', $room->id)->delete();
        RoomModerator::query()->where('room_id', $room->id)->delete();
        RoomInvitation::query()->where('room_id', $room->id)->delete();
        \CengizKemec\Social\Models\RoomInviteLink::query()->where('room_id', $room->id)->delete();
        RoomBan::query()->where('room_id', $room->id)->delete();
        $room->delete();
    }

    protected function cleanupDirectMessages(bool $dryRun): array
    {
        $days = $this->settings->int('dm_retention_days');
        $stats = ['dm_messages_deleted' => 0];

        if ($days <= 0) {
            return $stats;
        }

        $messages = DirectMessage::query()
            ->where('created_at', '<', \Illuminate\Support\now()->subDays($days))
            ->limit($this->batch())
            ->get();

        foreach ($messages as $message) {
            if (! $dryRun) {
                MediaReference::query()->where('reference_type', 'direct_message')->where('reference_id', $message->id)->delete();
                $message->delete();
            }
            $stats['dm_messages_deleted']++;
        }

        return $stats;
    }

    protected function expireUnreferencedMedia(int $mediaId): void
    {
        $media = Media::query()->find($mediaId);

        if (! $media) {
            return;
        }

        $remaining = MediaReference::query()
            ->where('media_id', $mediaId)
            ->where(function ($query) {
                $query->where('reference_type', '!=', 'story');
            })
            ->count();

        if ($remaining === 0) {
            $hours = max(0, $this->settings->int('story_retention_hours'));

            $media->status = 'orphaned';
            $media->expires_at = $hours > 0 ? \Illuminate\Support\now()->addHours($hours) : \Illuminate\Support\now();
            $media->last_referenced_at = \Illuminate\Support\now();
            $media->updated_at = \Illuminate\Support\now();
            $media->save();
        }
    }

    protected function retentionExpired(Media $media): bool
    {
        $days = match ($media->type) {
            'image' => $this->settings->int('image_retention_days'),
            'video' => $this->settings->int('video_retention_days'),
            default => $this->settings->int('document_retention_days'),
        };

        if ($days <= 0 || $media->last_referenced_at === null) {
            return false;
        }

        return $media->last_referenced_at->lt(\Illuminate\Support\now()->subDays($days));
    }

    protected function batch(): int
    {
        return max(25, min(1000, $this->settings->int('cleanup_batch_size')));
    }
}
