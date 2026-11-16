# Flarum Social 1.1.0

Flarum Social is a Discord-inspired community layer for Flarum 2.0: a public social feed, media library, profiles, voice rooms, text channels, native Flarum messages, moderation and a complete admin panel.

This release focuses on reliable voice-room screen sharing, a fix for credential fields in the ACP, native profile covers and production documentation.

## Highlights

- **Screen sharing for every voice-room member.** Remote screen-share publications are subscribed explicitly and rendered in the voice stage for all connected participants. The sharer gets a local preview, other members see the sharer's name, and clicking the video opens full screen.
- **Two-user LiveKit validation.** Tested with two native Flarum users in the same room on a real LiveKit development server: the viewer received and rendered the remote screen-share track.
- **ACP credential fields fixed.** LiveKit, TURN, S3, Centrifugo and group-ID settings now render as text or password inputs instead of switches, so administrators can enter and save credentials from the panel.
- **Native profile covers.** The Social profile and hover card resolve Flarum profile-cover filenames through the extension's filesystem disk and display the same cover as the forum profile.
- **Room UI polish.** The duplicate **Join voice** button is hidden while the current user is connected, and the text-channel visibility label uses the correct translation namespace.
- **Media lightbox fix.** Removed the fragment-key error and verified carousel navigation without console errors.
- **Release documentation.** Added screenshots, expanded installation/configuration instructions and a new security-validation section.

## Screenshots

| Community feed | Rooms and categories |
| --- | --- |
| ![Community feed](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/feed.png) | ![Rooms](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/rooms.png) |

| Screen sharing in a voice room | Profile hover card |
| --- | --- |
| ![Screen sharing](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/screen-sharing.png) | ![Profile hover](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/profile-hover.png) |

| Native Flarum messages | Social profile with native cover |
| --- | --- |
| ![Messages](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/messages.png) | ![Profile](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/profile.png) |

| ACP overview | Voice settings |
| --- | --- |
| ![ACP overview](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/admin-overview.png) | ![Voice settings](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/admin-voice.png) |

| Admin room manager | Forum sidebar widgets |
| --- | --- |
| ![Room manager](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/admin-rooms.png) | ![Forum widgets](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/forum-widgets.png) |

| Media lightbox | Mobile layout |
| --- | --- |
| ![Media lightbox](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/media-lightbox.png) | ![Mobile](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.0/docs/screenshots/mobile.png) |

All screenshots are in [docs/screenshots](https://github.com/cengizkemec/flarum-social/tree/v1.1.0/docs/screenshots).

## Requirements

- Flarum 2.0.x
- PHP 8.3+
- MySQL 8+, MariaDB 10.6+, PostgreSQL 13+ or SQLite
- HTTPS in production for microphone and screen-capture permissions
- Optional: LiveKit server for voice and screen sharing
- Optional: Centrifugo for realtime messages
- Optional: S3-compatible storage for media

## Installation

Add the repository to the Flarum root `composer.json`:

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

Install and enable:

```bash
composer require cengizkemec/flarum-social:^1.1
php flarum extension:enable cengizkemec-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

Open `/social`. The extension is enabled by default; configure it from **Administration -> Flarum Social**.

Full instructions, local-path setup, file permissions and upgrade steps: [docs/INSTALLATION.md](https://github.com/cengizkemec/flarum-social/blob/v1.1.0/docs/INSTALLATION.md).

## Configuration

### LiveKit voice and screen sharing

1. Open **Administration -> Flarum Social -> Voice**.
2. Enter the LiveKit WebSocket URL, API key and API secret.
3. Use `ws://127.0.0.1:7880` with the development key/secret only for local testing.
4. In production use a public `wss://` URL, a real secret and TURN or an accessible UDP range.
5. Enable screen sharing globally and per room, and grant `social.shareScreen` to the appropriate groups.

The browser must be able to reach the LiveKit URL directly. The API secret is server-side only and is not included in the browser bundle.

### Native messages

Enable `flarum/messages` to use Flarum's native dialogs, message stream, permissions, notifications and realtime delivery inside the Social messages layout. The Social direct-message fallback remains available when the official extension is disabled.

### Forum menu and widgets

- **Show Flarum forum categories in the Social menu** adds the forum's primary categories under **Forum** in the Social sidebar.
- **Show voice rooms widget in the forum sidebar** adds a compact live-room widget to Flarum's own index.
- **Show Social channel categories in the forum sidebar** adds the Social category/voice/text-channel directory.
- FoF Links are mirrored in the Social header, and the search box stays on the right.
- FoF widgets and the FoF news fader can render inside the Social right rail and top area.

### Profile data

Social displays the Flarum display name, username, avatar, bio and cover. Profile editing remains in Flarum. When a profile-cover extension is installed, its cover filename is resolved through the extension's disk, so the forum profile and Social profile show the same image.

### Optional integrations

- `flarum/audit`: writes Social actions to the native audit log.
- `flarum/messages`: native inbox integration.
- `fof/forum-widgets-core`, `fof/news-widget`, `fof/links`: widgets, news fader and header links.
- `datlechin/flarum-link-preview`: link preview cards for external URLs.
- S3-compatible media storage through the ACP or `config.php`.

## Security and permissions

- Guests can browse public content, but every Social write endpoint requires a registered Flarum user, CSRF protection and the relevant permission.
- Social uses Flarum users, sessions, groups, policies and login/registration modals. It does not create a second account system.
- Private posts, profiles, rooms, channels, media and direct conversations are denied to unrelated members and guests.
- Profile editing, avatar changes, cover changes and passwords remain Flarum-native.
- LiveKit webhooks require the configured issuer, a body hash, and valid expiry/not-before claims.
- Temporary-room heartbeats are limited to actual participants; the janitor endpoint is a CSRF-protected POST.
- Uploaded media is MIME-checked and served through access-controlled endpoints. Do not expose the media directory directly.
- Custom CSS is administrator-controlled content inserted with `textContent`; only trusted staff should edit it.

The full access-control matrix and residual deployment notes are in [docs/SECURITY-AUDIT.md](https://github.com/cengizkemec/flarum-social/blob/v1.1.0/docs/SECURITY-AUDIT.md).

## Validation performed for this release

- Production Webpack build completed; only the usual size/runtime warnings.
- All PHP files passed `php -l`.
- English/Turkish locale parity: **780 keys** in each file.
- HTTP smoke suite: **5/5 passed**.
- Guest admin endpoint: **403**.
- Invalid invite token: **404**.
- Guest write requests: **400/401**.
- Media lightbox opened and closed without JavaScript console errors.
- ACP text/password fields rendered correctly; save and revert test passed.
- Real LiveKit screen-sharing test with two native Flarum users:
  - sharer local preview: 1920x1080, playing;
  - viewer remote preview: 960x540, playing, labelled with the sharer's name;
  - both sessions reported two connected participants.
- Synthetic remote screen-share subscription test: viewer received and rendered an 800x450 share.
- No `__LiveKitRoom` or `__socialVoice` test hooks remain in the production bundle.

Centrifugo realtime delivery and TURN traversal have not been tested on a production network; use a staging environment for those.

## Upgrade from 1.0.x

```bash
composer update cengizkemec/flarum-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

Settings are stored under `cengizkemec-social.*` and are preserved.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
