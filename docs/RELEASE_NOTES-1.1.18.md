# Flarum Social 1.1.18

Flarum Realtime is now Social's default realtime transport, while Pusher remains available as an option.

## Highlights

- **Flarum Realtime by default.** When `flarum/realtime` is enabled, Social shares Flarum's WebSocket connection and publishes room, channel, direct-message, comment and story updates through Flarum's own daemon. No separate Centrifugo server, API URL, API key or HMAC secret is required.
- **Pusher is still an option.** Forums that already use `flarum/pusher` can select **Pusher** as the realtime driver. Social reuses the existing app credentials and, when available, the shared Pusher socket.
- **One realtime setting.** The old Social realtime enable switch, Centrifugo fields and polling interval setting are gone. The only remaining choice is **ACP → Flarum Social → Messages → Realtime driver**.
- **Private channels stay private.** Social's `private-social-*` channels are signed by `POST /api/social/websocket/auth` after Social checks the viewer's post, room, channel or DM permission. Flarum's own channels continue to use their extension auth endpoints.
- **Automatic fallback.** If neither transport is available, Social keeps using periodic refresh for channel messages and direct messages.
- **Smaller bundle.** Removed the bundled `centrifuge` JavaScript dependency and the old token endpoint.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

Then open **Administration → Flarum Social → Messages** and confirm **Realtime driver** is **Flarum Realtime**. If the forum uses `flarum/pusher`, choose **Pusher** instead.

No database changes are required.
