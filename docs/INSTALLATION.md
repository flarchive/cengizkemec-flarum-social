# Installation

This guide covers a production Flarum 2.0 installation, a local development checkout, LiveKit, permissions, cleanup and upgrades.

## Requirements

- Flarum 2.0.x
- PHP 8.3 or newer with the extensions required by Flarum
- MySQL 8+, MariaDB 10.6+, PostgreSQL 13+ or SQLite
- HTTPS in production. Browsers only allow microphone and screen capture on secure origins, except for `localhost`.
- Node.js 20+ only when rebuilding the bundled JavaScript from source.
- Optional: a LiveKit server for voice and screen sharing.
- Optional: Centrifugo for realtime channel and direct-message delivery.
- Optional: S3-compatible object storage for media.

## Composer installation

Add the GitHub repository to the root `composer.json` of the Flarum installation:

```json
{
  "repositories": [
    {
      "type": "vcs",
      "url": "https://github.com/cengizkemec/flarum-social"
    }
  ]
}
```

Then install the extension and run the Flarum setup commands from the Flarum root:

```bash
composer require cengizkemec/flarum-social:^1.1
php flarum extension:enable cengizkemec-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

The extension id is `cengizkemec-social`. The package ships production `js/dist` assets, so Node.js is not required on the server.

## Local path installation

For development, copy or clone the extension into `packages/cengizkemec/flarum-social` and add a path repository:

```json
{
  "repositories": [
    {
      "type": "path",
      "url": "packages/cengizkemec/flarum-social",
      "options": {
        "symlink": true
      }
    }
  ]
}
```

Then run:

```bash
composer require cengizkemec/flarum-social:@dev
php flarum extension:enable cengizkemec-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

After changing JavaScript or translations, rebuild from the extension directory:

```bash
cd js
npm install
npm run build
cd ..
cd /path/to/flarum
php flarum cache:clear
php flarum assets:publish
```

## File permissions

The web server user must be able to read the extension and write Flarum's runtime directories:

- `storage/` must be writable.
- `public/assets/` must be writable when using local media storage.
- `public/assets/covers/` must be writable when a profile-cover extension stores native covers.
- Uploaded media is served through access-controlled Social endpoints. Do not expose the `storage/social-media` directory directly.

## First-run checklist

1. Open **Administration -> Flarum Social** and confirm the extension is enabled.
2. Review **General** settings: navigation placement, Social sidebar, compact layout and mobile bottom navigation.
3. Review **Guest access**. Guests can browse public content, but every Social write endpoint still requires a registered Flarum user and CSRF protection.
4. Open **Rooms** and create the permanent voice rooms and text channels you need. Assign categories and choose public, members, staff or private visibility.
5. Open **Voice** and enter the LiveKit WebSocket URL, API key and API secret if voice is wanted.
6. Optionally enable `flarum/messages`, `flarum/audit`, `fof/forum-widgets-core`, `fof/news-widget`, `fof/links` or `datlechin/flarum-link-preview`; Social detects them automatically.
7. Grant the `social.*` permissions to the appropriate groups in **Administration -> Permissions**.
8. Visit `/social` as an administrator and as a normal member.
9. Join a voice room, share a screen from one account and confirm that another account in the same room sees the video.

## LiveKit

LiveKit is optional. Social uses it for voice rooms and screen sharing.

### Local development

Run the official LiveKit server in development mode:

```bash
livekit-server --dev --bind 127.0.0.1
```

The development server uses:

- WebSocket URL: `ws://127.0.0.1:7880`
- API key: `devkey`
- API secret: `secret`

Enter those values in **Administration -> Flarum Social -> Voice**. Keep the URL reachable from the browser that will join the room.

### Production

Run LiveKit with a configuration file and a real key/secret pair. Use TLS and a public `wss://` URL, and configure TURN or a public IP/UDP range for restrictive networks. A typical deployment has:

- `wss://livekit.example.com` exposed through a reverse proxy with WebSocket upgrade support.
- UDP ports for WebRTC media, or a TURN/TLS service.
- The LiveKit API secret stored only in the server-side Social settings. It is never included in the browser bundle.
- A secret that is different from development credentials.

The browser must be able to reach the LiveKit URL directly. Do not configure a private container hostname such as `http://livekit:7880` unless every user's browser can resolve it.

### Screen sharing

Screen sharing requires a secure origin in production. On `http://localhost` browsers allow it for development. The ACP has global and per-room controls, and the `social.shareScreen` permission decides who can publish. When a participant shares:

1. Social publishes the screen-share video and audio tracks to LiveKit.
2. Every connected participant subscribes to the remote screen-share publication.
3. The voice stage renders the video for everyone, with a local preview for the sharer.
4. Clicking the video opens full screen.
5. Turning off the local preview does not mute the shared audio for other listeners.

## Centrifugo (optional)

Without Centrifugo, Social falls back to periodic refresh for channel messages and direct messages. To enable realtime delivery, install Centrifugo and enter its WebSocket URL, HTTP API URL, API key and HMAC secret in **Administration -> Flarum Social -> Messages & realtime**. Keep the API key and HMAC secret server-side.

## Scheduled cleanup

The scheduler runs a one-minute temporary-room safety net:

```cron
* * * * * cd /var/www/flarum && php flarum schedule:run
```

Browser presence heartbeats normally remove an empty temporary room within ten seconds. For cleanup even when no browser is open, run `php flarum social:purge-rooms` from a supervisor or systemd timer more frequently.

## Upgrading

Back up the database and uploaded files, then run:

```bash
composer update cengizkemec/flarum-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

Review [CHANGELOG.md](../CHANGELOG.md) for behavioural changes. The ACP settings are stored under the `cengizkemec-social.*` namespace and are preserved across upgrades.

## Verification

From the Flarum root:

```bash
php flarum info
php tests/locale-parity.php
powershell -File tests/http-smoke.ps1 -BaseUrl http://localhost:8080
```

For a production check, open `/social` as a guest, sign in with a normal member account, join a voice room from two browsers and verify that a screen share appears in both sessions. Also confirm that guest write requests are rejected and that `/api/social/admin/overview` returns `403` for non-administrators.

See [SECURITY-AUDIT.md](SECURITY-AUDIT.md) for the access-control matrix and deployment notes.
