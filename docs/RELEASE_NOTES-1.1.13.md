# Flarum Social 1.1.13

Share Flarum's Pusher connection and reduce idle realtime connections.

## Highlights

- **One Pusher socket per user.** When `flarum/pusher` is enabled and uses the same Pusher app, Social reuses Flarum's existing socket through `app.pusher`. Previously Social opened a second WebSocket connection alongside Flarum's connection.
- **Social permissions are unchanged.** Only `private-social-*` channel authorizations are routed to `POST /api/social/realtime/auth`. Flarum's `private-user*` channels continue to use `POST /api/pusher/auth`, so Social permissions and Flarum notifications remain independent.
- **Idle sockets close automatically.** If Social has to create its own Pusher socket because Flarum's socket is unavailable or uses a different app, it disconnects after 15 seconds without an active Social channel and reconnects on demand.
- **Clean logout.** Logging out unsubscribes Social channels without disconnecting Flarum's shared socket.
- **Live verified.** A single `wss://ws-eu.pusher.com` connection carried `public`, `private-user*` and `private-social-channel-*` at the same time. Typing events arrived through the shared socket, and leaving Social removed only the Social channel.

## Live maintenance

`fof/anti-spam` was updated from 2.0.1 to 2.0.2 on `warthunder.tr`; no migrations were required.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum cache:clear
php flarum assets:publish
```

No database migrations and no configuration changes are required.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
