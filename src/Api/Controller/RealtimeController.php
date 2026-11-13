<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\TextChannel;
use CengizKemec\Social\Realtime\Centrifugo;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class RealtimeController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected Centrifugo $realtime
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        if ($this->routeName($request) === 'social.realtime.auth') {
            return $this->authorize($request);
        }

        $actor = $this->actor($request);
        $actor->assertRegistered();

        if (! $this->realtime->enabled()) {
            return $this->json(['errors' => [[
                'status' => '503',
                'code' => 'realtime_disabled',
                'detail' => $this->translator->trans('cengizkemec-social.api.errors.realtime_disabled'),
            ]]], 503);
        }

        $channel = (string) ($request->getQueryParams()['channel'] ?? $this->body($request)['channel'] ?? '');

        if (! $this->allowed($channel, $request)) {
            return $this->forbidden('realtime_channel_forbidden');
        }

        if ($this->realtime->driver() === 'pusher') {
            return $this->json(['data' => [
                'driver' => 'pusher',
                'key' => $this->settings->get('flarum-pusher.app_key'),
                'cluster' => $this->settings->get('flarum-pusher.app_cluster'),
                'host' => $this->settings->get('flarum-pusher.server_hostname'),
                'channel' => $this->realtime->mapChannel($channel),
            ]]);
        }

        return $this->json(['data' => $this->realtime->tokens($actor, $channel)]);
    }

    protected function authorize(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        if (! $this->realtime->enabled() || $this->realtime->driver() !== 'pusher') {
            return $this->forbidden('realtime_channel_forbidden');
        }

        $body = $request->getParsedBody();

        if (! is_array($body) || empty($body)) {
            $body = [];
            parse_str((string) $request->getBody(), $body);
        }

        $socketId = (string) ($body['socket_id'] ?? '');
        $mappedChannel = (string) ($body['channel_name'] ?? '');
        $channel = $this->realtime->logicalChannel($mappedChannel);

        if ($socketId === '' || $channel === null || ! $this->allowed($channel, $request)) {
            return $this->forbidden('realtime_channel_forbidden');
        }

        $auth = $this->realtime->pusherAuth($socketId, $mappedChannel);

        if (! $auth) {
            return $this->json([
                'errors' => [[
                    'status' => '503',
                    'code' => 'pusher_auth_failed',
                    'detail' => $this->translator->trans('cengizkemec-social.api.errors.realtime_disabled'),
                ]],
            ], 503);
        }

        return $this->json($auth);
    }

    protected function allowed(string $channel, ServerRequestInterface $request): bool
    {
        $actor = $this->actor($request);

        if (in_array($channel, ['social:feed', 'social:rooms', 'social:stories'], true)) {
            return true;
        }

        if (preg_match('/^social:post:(\d+)$/', $channel, $m)) {
            $post = Post::query()->find((int) $m[1]);

            return $post && $this->access->canViewPost($post, $actor);
        }

        if (preg_match('/^social:room:(\d+)$/', $channel, $m)) {
            $room = Room::query()->find((int) $m[1]);

            return $room && $this->access->canViewRoom($room, $actor);
        }

        if (preg_match('/^social:channel:(\d+)$/', $channel, $m)) {
            $channelModel = TextChannel::query()->find((int) $m[1]);

            return $channelModel && $this->access->canReadChannelMessages($channelModel, $actor);
        }

        if (preg_match('/^social:dm:(\d+)$/', $channel, $m)) {
            return $this->access->canAccessDirectConversation((int) $m[1], $actor);
        }

        return false;
    }
}
