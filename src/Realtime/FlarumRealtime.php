<?php

namespace CengizKemec\Social\Realtime;

use Flarum\Extension\ExtensionManager;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Container\Container;
use Psr\Log\LoggerInterface;
use Pusher\Pusher;

/**
 * Bridges Social's private channels onto a Flarum realtime transport.
 *
 * The default transport is Flarum's bundled `flarum/realtime` daemon. As an
 * option, Social can keep using an existing `flarum/pusher` app. Social does
 * not ship its own realtime server, app credentials or token endpoint: it
 * reuses whichever Flarum extension is configured and only signs Social's
 * `private-social-*` channels through Social's permission checks.
 *
 * When neither transport is available, every method fails soft so Social
 * keeps working through its polling fallbacks.
 */
class FlarumRealtime
{
    public const DRIVER_FLARUM = 'flarum';
    public const DRIVER_PUSHER = 'pusher';

    protected ?bool $available = null;
    protected ?bool $flarumAvailable = null;
    protected ?bool $pusherAvailable = null;
    protected ?Pusher $pusherInstance = null;

    public function __construct(
        protected Container $container,
        protected ExtensionManager $extensions,
        protected SettingsRepositoryInterface $settings,
        protected LoggerInterface $logger
    ) {
    }

    public function driver(): string
    {
        $selected = (string) $this->settings->get('cengizkemec-social.realtime_driver');

        if ($selected === self::DRIVER_PUSHER) {
            if ($this->pusherAvailable()) {
                return self::DRIVER_PUSHER;
            }

            // The selected Pusher app is gone but flarum/realtime is present
            // (the two extensions conflict). Move to the bundled transport
            // automatically so realtime keeps working after an upgrade.
            return $this->flarumAvailable() ? self::DRIVER_FLARUM : self::DRIVER_PUSHER;
        }

        if ($this->flarumAvailable()) {
            return self::DRIVER_FLARUM;
        }

        // Existing Pusher forums that have not saved the new setting yet keep
        // working without an ACP change.
        return $this->pusherAvailable() ? self::DRIVER_PUSHER : self::DRIVER_FLARUM;
    }

    public function enabled(): bool
    {
        if ($this->available !== null) {
            return $this->available;
        }

        return $this->available = $this->driver() === self::DRIVER_PUSHER
            ? $this->pusherAvailable()
            : $this->flarumAvailable();
    }

    protected function flarumAvailable(): bool
    {
        if ($this->flarumAvailable !== null) {
            return $this->flarumAvailable;
        }

        try {
            return $this->flarumAvailable = class_exists(Pusher::class)
                && class_exists(\Flarum\Realtime\Websocket\Settings::class)
                && $this->extensions->isEnabled('flarum-realtime');
        } catch (\Throwable $e) {
            return $this->flarumAvailable = false;
        }
    }

    protected function pusherAvailable(): bool
    {
        if ($this->pusherAvailable !== null) {
            return $this->pusherAvailable;
        }

        try {
            return $this->pusherAvailable = class_exists(Pusher::class)
                && $this->extensions->isEnabled('flarum-pusher')
                && $this->settings->get('flarum-pusher.app_id') !== ''
                && $this->settings->get('flarum-pusher.app_key') !== ''
                && $this->settings->get('flarum-pusher.app_secret') !== '';
        } catch (\Throwable $e) {
            return $this->pusherAvailable = false;
        }
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

    public function publish(string $channel, array $payload): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        try {
            $this->pusher()->trigger($this->mapChannel($channel), 'social', $payload);

            return true;
        } catch (\Throwable $e) {
            $this->logger->warning('flarum-social: realtime publish failed', [
                'driver' => $this->driver(),
                'channel' => $channel,
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Sign a private Social channel for the shared realtime socket.
     *
     * @return array{auth: string}|null
     */
    public function authorize(string $socketId, string $mappedChannel): ?array
    {
        if (! $this->enabled() || $socketId === '' || $mappedChannel === '') {
            return null;
        }

        try {
            $payload = json_decode($this->pusher()->authorizeChannel($mappedChannel, $socketId), true);

            return is_array($payload) && isset($payload['auth']) ? $payload : null;
        } catch (\Throwable $e) {
            $this->logger->warning('flarum-social: realtime channel authorization failed', [
                'driver' => $this->driver(),
                'channel' => $mappedChannel,
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    protected function pusher(): Pusher
    {
        return $this->pusherInstance ??= $this->container->make(Pusher::class);
    }
}
