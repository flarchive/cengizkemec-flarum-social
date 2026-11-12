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

    public function enabled(): bool
    {
        return $this->settings->bool('realtime_enabled')
            && $this->settings->get('centrifugo_url') !== ''
            && $this->settings->get('centrifugo_token_hmac_secret') !== '';
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
        if (! $this->enabled() || $this->settings->get('centrifugo_api_url') === '' || $this->settings->get('centrifugo_api_key') === '') {
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
}
