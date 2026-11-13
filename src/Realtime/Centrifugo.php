<?php

namespace CengizKemec\Social\Realtime;

use CengizKemec\Social\Support\Jwt;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\User\User;
use GuzzleHttp\Client;
use Illuminate\Contracts\Log\Log;

class Centrifugo
{
    public function __construct(
        protected SocialSettings $settings,
        protected Client $http,
        protected \Psr\Log\LoggerInterface $logger
    ) {
    }

    public function driver(): string
    {
        $driver = (string) $this->settings->get('realtime_driver');

        return $driver === 'pusher' ? 'pusher' : 'centrifugo';
    }

    public function enabled(): bool
    {
        if (! $this->settings->bool('realtime_enabled')) {
            return false;
        }

        if ($this->driver() === 'pusher') {
            return $this->settings->get('flarum-pusher.app_id') !== ''
                && $this->settings->get('flarum-pusher.app_key') !== ''
                && $this->settings->get('flarum-pusher.app_secret') !== '';
        }

        return $this->settings->get('centrifugo_url') !== ''
            && $this->settings->get('centrifugo_token_hmac_secret') !== '';
    }

    public function mapChannel(string $channel): string
    {
        return 'private-'.str_replace(':', '-', $channel);
    }

    public function logicalChannel(string $mapped): ?string
    {
        if (preg_match('/^private-social-(feed|rooms|stories)$/', $mapped, $matches)) {
            return 'social:'.$matches[1];
        }

        if (preg_match('/^private-social-(post|room|channel|dm)-(\d+)$/', $mapped, $matches)) {
            return 'social:'.$matches[1].':'.$matches[2];
        }

        return null;
    }

    public function channelForRoom(int $roomId): string
    {
        return 'social:room:'.$roomId;
    }

    public function channelForChannel(int $channelId): string
    {
        return 'social:channel:'.$channelId;
    }

    public function channelForConversation(int $conversationId): string
    {
        return 'social:dm:'.$conversationId;
    }

    /**
     * @return array{url: string, token: string, subscriptionToken: string, channel: string}
     */
    public function tokens(User $user, string $channel): array
    {
        $secret = $this->settings->get('centrifugo_token_hmac_secret');
        $exp = time() + 3600;

        $connectionToken = Jwt::encode([
            'sub' => (string) $user->id,
            'exp' => $exp,
            'info' => json_encode([
                'id' => $user->id,
                'username' => $user->username,
                'displayName' => $user->display_name,
                'avatarUrl' => $user->avatar_url,
            ]),
        ], $secret);

        $subscriptionToken = Jwt::encode([
            'sub' => (string) $user->id,
            'channel' => $channel,
            'exp' => $exp,
        ], $secret);

        return [
            'url' => $this->settings->get('centrifugo_url'),
            'token' => $connectionToken,
            'subscriptionToken' => $subscriptionToken,
            'channel' => $channel,
        ];
    }

    public function publish(string $channel, array $payload): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        if ($this->driver() === 'pusher') {
            return $this->publishPusher($channel, $payload);
        }

        if ($this->settings->get('centrifugo_api_url') === '' || $this->settings->get('centrifugo_api_key') === '') {
            return false;
        }

        try {
            $response = $this->http->post(rtrim($this->settings->get('centrifugo_api_url'), '/').'/api/publish', [
                'headers' => [
                    'X-API-Key' => $this->settings->get('centrifugo_api_key'),
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'channel' => $channel,
                    'data' => $payload,
                ],
                'timeout' => 2,
            ]);

            return $response->getStatusCode() >= 200 && $response->getStatusCode() < 300;
        } catch (\Throwable $e) {
            $this->logger->warning('flarum-social: Centrifugo publish failed', ['message' => $e->getMessage()]);

            return false;
        }
    }

    protected function pusher(): ?object
    {
        if (! class_exists(\Pusher\Pusher::class)) {
            return null;
        }

        try {
            return app(\Pusher\Pusher::class);
        } catch (\Throwable $e) {
            return null;
        }
    }

    protected function publishPusher(string $channel, array $payload): bool
    {
        $pusher = $this->pusher();

        if (! $pusher) {
            return false;
        }

        try {
            $pusher->trigger($this->mapChannel($channel), 'social', $payload);

            return true;
        } catch (\Throwable $e) {
            $this->logger->warning('flarum-social: Pusher publish failed', ['message' => $e->getMessage()]);

            return false;
        }
    }

    public function pusherAuth(string $socketId, string $mappedChannel): ?array
    {
        $pusher = $this->pusher();

        if (! $pusher) {
            return null;
        }

        try {
            $payload = json_decode((string) $pusher->socket_auth($mappedChannel, $socketId), true);

            return is_array($payload) ? $payload : null;
        } catch (\Throwable $e) {
            $this->logger->warning('flarum-social: Pusher auth failed', ['message' => $e->getMessage()]);

            return null;
        }
    }
}
