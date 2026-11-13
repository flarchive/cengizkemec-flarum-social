<?php

namespace CengizKemec\Social\Voice;

use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Support\Jwt;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Foundation\ValidationException;
use Flarum\User\User;

class LiveKit
{
    public function __construct(protected SocialSettings $settings)
    {
    }

    public function configured(): bool
    {
        return $this->settings->get('livekit_url') !== ''
            && $this->settings->get('livekit_api_key') !== ''
            && $this->settings->get('livekit_api_secret') !== '';
    }

    public function roomName(Room $room): string
    {
        // The LiveKit dashboard lists this value directly, so show the same
        // human-readable room name members see in Social. The numeric suffix
        // keeps rooms unique even when two rooms share a name.
        $name = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $room->name) ?: 'Room');
        $name = function_exists('mb_substr') ? mb_substr($name, 0, 120) : substr($name, 0, 120);

        return $name.' (#'.$room->id.')';
    }

    public function identity(User $user): string
    {
        return 'user-'.$user->id;
    }

    /**
     * @return array{url: string, token: string, identity: string, room: string}
     */
    public function token(User $user, Room $room, bool $canScreenShare): array
    {
        if (! $this->configured()) {
            throw new ValidationException([
                'voice' => 'Voice rooms are not configured by the administrator.',
            ]);
        }

        $now = time();
        $roomName = $this->roomName($room);
        $sources = ['microphone'];

        if ($canScreenShare) {
            $sources[] = 'screen_share';
            $sources[] = 'screen_share_audio';
        }

        $payload = [
            'iss' => $this->settings->get('livekit_api_key'),
            'sub' => $this->identity($user),
            'name' => $user->display_name,
            'nbf' => $now - 10,
            'iat' => $now,
            'exp' => $now + 3600,
            'metadata' => json_encode([
                'user_id' => $user->id,
                'username' => $user->username,
                'avatar_url' => $user->avatar_url,
                'room_id' => $room->id,
            ]),
            'video' => [
                'roomJoin' => true,
                'room' => $roomName,
                'canPublish' => true,
                'canSubscribe' => true,
                'canPublishData' => true,
                'canPublishSources' => $sources,
                'canUpdateOwnMetadata' => true,
            ],
        ];

        return [
            'url' => rtrim($this->settings->get('livekit_url'), '/'),
            'token' => Jwt::encode($payload, $this->settings->get('livekit_api_secret')),
            'identity' => $this->identity($user),
            'room' => $roomName,
        ];
    }

    protected function apiToken(?string $roomName = null): string
    {
        $now = time();
        $video = [
            'roomAdmin' => true,
            'roomCreate' => true,
            'roomList' => true,
        ];

        if ($roomName !== null) {
            $video['room'] = $roomName;
        }

        return Jwt::encode([
            'iss' => $this->settings->get('livekit_api_key'),
            'sub' => 'flarum-social-server',
            'nbf' => $now - 10,
            'iat' => $now,
            'exp' => $now + 120,
            'video' => $video,
        ], $this->settings->get('livekit_api_secret'));
    }

    protected function apiUrl(): string
    {
        $url = rtrim($this->settings->get('livekit_url'), '/');

        return preg_replace('/^ws/', 'http', $url);
    }

    protected function apiPost(string $method, array $payload): ?array
    {
        if (! $this->configured()) {
            return null;
        }

        try {
            $client = new \GuzzleHttp\Client();
            $response = $client->post($this->apiUrl().'/twirp/livekit.RoomService/'.$method, [
                'headers' => [
                    'Authorization' => 'Bearer '.$this->apiToken($payload['room'] ?? null),
                    'Content-Type' => 'application/json',
                ],
                'json' => $payload,
                'timeout' => 5,
            ]);

            $decoded = json_decode((string) $response->getBody(), true);

            return is_array($decoded) ? $decoded : [];
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function removeParticipant(string $roomName, string $identity): bool
    {
        return $this->apiPost('RemoveParticipant', [
            'room' => $roomName,
            'identity' => $identity,
        ]) !== null;
    }

    public function deleteRoom(string $roomName): bool
    {
        return $this->apiPost('DeleteRoom', ['room' => $roomName]) !== null;
    }

    public function muteParticipant(string $roomName, string $identity, bool $muted = true): bool
    {
        $participants = $this->apiPost('ListParticipants', ['room' => $roomName]);

        if (! $participants) {
            return false;
        }

        foreach ($participants['participants'] ?? [] as $participant) {
            if (($participant['identity'] ?? null) !== $identity) {
                continue;
            }

            foreach ($participant['tracks'] ?? [] as $track) {
                if (($track['type'] ?? '') !== 'AUDIO') {
                    continue;
                }

                $this->apiPost('MutePublishedTrack', [
                    'room' => $roomName,
                    'identity' => $identity,
                    'track_sid' => $track['sid'] ?? '',
                    'muted' => $muted,
                ]);
            }

            return true;
        }

        return false;
    }

    public function sendData(string $roomName, array $payload): bool
    {
        return $this->apiPost('SendData', [
            'room' => $roomName,
            'data' => base64_encode(json_encode($payload)),
            'kind' => 'RELIABLE',
            'topic' => 'social',
        ]) !== null;
    }

    public function verifyWebhook(string $authorization, string $body): ?array
    {
        if (! str_starts_with($authorization, 'Bearer ')) {
            return null;
        }

        $token = substr($authorization, 7);
        $payload = Jwt::decode($token, $this->settings->get('livekit_api_secret'));

        if (! is_array($payload)) {
            return null;
        }

        $claims = $payload;
        $now = time();

        // A LiveKit participant access token is signed with the same API
        // secret, so a signature alone does not prove this is a webhook.
        // Webhook tokens carry a body hash and the configured issuer.
        if (($claims['iss'] ?? null) !== $this->settings->get('livekit_api_key')) {
            return null;
        }

        if (isset($claims['exp']) && (int) $claims['exp'] < $now - 30) {
            return null;
        }

        if (isset($claims['nbf']) && (int) $claims['nbf'] > $now + 30) {
            return null;
        }

        $expectedHash = $claims['sha256'] ?? null;

        if ($expectedHash === null || ! hash_equals((string) $expectedHash, base64_encode(hash('sha256', $body, true)))) {
            return null;
        }

        $decoded = json_decode($body, true);

        return is_array($decoded) ? $decoded : null;
    }
}
