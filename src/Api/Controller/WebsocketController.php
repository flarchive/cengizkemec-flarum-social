<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\TextChannel;
use CengizKemec\Social\Realtime\FlarumRealtime;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Signs Social's private channels for Flarum's realtime websocket.
 *
 * Flarum's own /api/websocket/auth endpoint only knows about Flarum channels.
 * Social uses the same socket and app secret, but checks Social's post, room,
 * channel and DM permissions here before returning a signature.
 */
class WebsocketController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected FlarumRealtime $realtime
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        return $this->authorize($request);
    }

    protected function authorize(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);

        if (! $this->realtime->enabled()) {
            return $this->json(['errors' => [[
                'status' => '503',
                'code' => 'websocket_disabled',
                'detail' => $this->translator->trans('cengizkemec-social.api.errors.websocket_disabled'),
            ]]], 503);
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
            return $this->forbidden('websocket_channel_forbidden');
        }

        $auth = $this->realtime->authorize($socketId, $mappedChannel);

        if (! $auth) {
            return $this->json([
                'errors' => [[
                    'status' => '503',
                    'code' => 'websocket_auth_failed',
                    'detail' => $this->translator->trans('cengizkemec-social.api.errors.websocket_disabled'),
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
