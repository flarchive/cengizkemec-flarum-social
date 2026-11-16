<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\RoomParticipant;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\VoiceActivityTracker;
use CengizKemec\Social\Voice\LiveKit;
use Flarum\Locale\TranslatorInterface;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class LiveKitWebhookController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected LiveKit $livekit,
        protected VoiceActivityTracker $voiceActivity
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->livekit->configured()) {
            return new EmptyResponse(404);
        }

        $authorization = $request->getHeaderLine('Authorization');
        $body = (string) $request->getBody();
        $event = $this->livekit->verifyWebhook($authorization, $body);

        if (! $event) {
            return new EmptyResponse(401);
        }

        $eventType = $event['event'] ?? '';
        $roomName = $event['room']['name'] ?? '';
        $identity = $event['participant']['identity'] ?? '';
        $roomId = null;

        if (preg_match('/\(#(\d+)\)$/u', $roomName, $matches)) {
            $roomId = (int) $matches[1];
        } elseif (preg_match('/^social-room-(\d+)(?:-|$)/', $roomName, $matches)) {
            // Rooms created by earlier releases used the old identifier.
            $roomId = (int) $matches[1];
        }

        if ($roomId === null) {
            return new EmptyResponse(200);
        }

        $room = Room::query()->find($roomId);

        if (! $room) {
            return new EmptyResponse(200);
        }

        if ($eventType === 'participant_joined' && preg_match('/^user-(\d+)$/', $identity, $userMatch)) {
            $participant = RoomParticipant::query()->firstOrNew([
                'room_id' => $room->id,
                'user_id' => (int) $userMatch[1],
            ]);
            $participant->role = $participant->role ?: ($room->owner_id === (int) $userMatch[1] ? 'owner' : 'member');
            $participant->muted = true;
            $participant->joined_at = $participant->joined_at ?: \Illuminate\Support\now();
            $participant->last_seen_at = \Illuminate\Support\now();
            $participant->save();
        } elseif ($eventType === 'participant_left' && preg_match('/^user-(\d+)$/', $identity, $userMatch)) {
            $participant = RoomParticipant::query()
                ->where('room_id', $room->id)
                ->where('user_id', (int) $userMatch[1])
                ->first();

            if ($participant && $participant->user) {
                $this->voiceActivity->record($participant->user, $room, $participant->joined_at, \Illuminate\Support\now());
                $participant->delete();
            }
        } elseif ($eventType === 'room_finished') {
            $room->participants()->with('user')->get()->each(function (RoomParticipant $participant) use ($room) {
                if ($participant->user) {
                    $this->voiceActivity->record($participant->user, $room, $participant->joined_at, $participant->last_seen_at ?: \Illuminate\Support\now());
                }
            });
            RoomParticipant::query()->where('room_id', $room->id)->delete();
        }

        $room->participant_count = RoomParticipant::query()
            ->where('room_id', $room->id)
            ->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(5))
            ->count();
        $room->last_activity_at = \Illuminate\Support\now();
        $room->save();

        return new EmptyResponse(200);
    }
}
