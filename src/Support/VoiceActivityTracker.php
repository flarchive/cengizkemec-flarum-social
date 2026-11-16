<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\VoiceActivity;
use Flarum\User\User;
use Illuminate\Support\Carbon;

class VoiceActivityTracker
{
    public function record(User $user, Room $room, mixed $joinedAt, mixed $endAt = null): void
    {
        $end = $endAt ? Carbon::parse($endAt) : Carbon::now();
        $start = $joinedAt ? Carbon::parse($joinedAt) : $end;
        $seconds = (int) $start->diffInSeconds($end);

        if ($seconds <= 0) {
            return;
        }

        // A frozen tab must not turn into days of fake activity.
        $seconds = min($seconds, 12 * 3600);

        $activity = VoiceActivity::query()->firstOrNew([
            'user_id' => $user->id,
            'room_id' => $room->id,
        ]);

        $activity->seconds = (int) $activity->seconds + $seconds;
        $activity->sessions = (int) $activity->sessions + 1;
        $activity->updated_at = Carbon::now();
        $activity->save();
    }
}
