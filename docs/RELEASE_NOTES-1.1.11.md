# Flarum Social 1.1.11

Permanent realtime through the existing Flarum Pusher app.

## Highlights

- **Pusher realtime driver.** Social can now use the `flarum/pusher` extension that is already installed and configured on the forum. It reuses the existing app key, secret, cluster and optional host, so no self-hosted realtime server or tunnel is required.
- **Realtime driver setting.** A new option in **ACP → Flarum Social → Messages and realtime** lets administrators choose **Pusher** or **Centrifugo**. Existing Centrifugo installations keep working; Pusher is the recommended option when `flarum/pusher` is configured.
- **Private channels only.** Social maps its logical channels to Pusher private channels such as `private-social-room-1`. The new `POST /api/social/realtime/auth` endpoint validates the current user against Social's post, room, channel and DM permissions before signing the channel authorization.
- **Live verified.** On `warthunder.tr`, a private `private-social-feed` subscription was authorized, a server publication was sent through the Social Pusher driver, and the event was received successfully. The live site now uses Pusher; the temporary Centrifugo quick-tunnel process and its cron entries were removed.
- No database migrations and no configuration changes are required beyond selecting the driver.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum cache:clear
php flarum assets:publish
```

Then choose **Pusher** in **ACP → Flarum Social → Messages and realtime** if `flarum/pusher` is configured. The existing Pusher app credentials are used automatically.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
