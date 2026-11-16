# Flarum Social 1.1.1

Flarum Social is a Discord-inspired community layer for Flarum 2.0: feed, media, profiles, voice rooms, text channels, native Flarum messages, moderation and a complete admin panel.

This release is a theme-compatibility and live-site polish update for the War Thunder community installation.

## Highlights

- **Theme-matched Social header.** The header is now a compact single row with uppercase condensed links, theme text colours in both dark and light mode, and the same red top rule as the forum header.
- **One Community dropdown.** FoF Links are grouped into a single **Community** menu; the duplicate Forum link is removed and the header no longer wraps into a second row.
- **Social link only in the side menu.** The default navigation placement is now the Flarum side menu. A header link can still be added through FoF Links.
- **Readable right rail.** Online/offline members, top lists and latest forum topics use theme text colours instead of hard-coded red. Member names use their Flarum group colour when the group has one, so admin, moderator, sponsor and other role colours remain visible.
- **Full-width announcement.** The FoF News / announcement HTML card now displays at full width with its complete content instead of being clipped to a single line.
- **Readable room URLs.** Existing rooms are backfilled to `/social/rooms/general`, `/social/rooms/squadron`, `/social/rooms/general-chat` and so on. New installations seed the same slugs directly.
- **Cover Studio support.** Native covers from `tryhackx/flarum-cover-studio` are resolved through its companion relation, alongside the existing `sycho/flarum-profile-cover` support.
- **Live validation.** Header, announcement, room pages, profile covers and slug routing were tested on the live `warthunder.tr` installation in dark and light mode.

## Screenshots

| Community feed | Rooms and categories |
| --- | --- |
| ![Community feed](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.1/docs/screenshots/feed.png) | ![Rooms](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.1/docs/screenshots/rooms.png) |

| Screen sharing in a voice room | Profile hover card |
| --- | --- |
| ![Screen sharing](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.1/docs/screenshots/screen-sharing.png) | ![Profile hover](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.1/docs/screenshots/profile-hover.png) |

| Native Flarum messages | Social profile with native cover |
| --- | --- |
| ![Messages](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.1/docs/screenshots/messages.png) | ![Profile](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.1/docs/screenshots/profile.png) |

| ACP overview | Voice settings |
| --- | --- |
| ![ACP overview](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.1/docs/screenshots/admin-overview.png) | ![Voice settings](https://raw.githubusercontent.com/cengizkemec/flarum-social/v1.1.1/docs/screenshots/admin-voice.png) |

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

The new migration backfills readable room slugs for existing installations. Existing settings under `cengizkemec-social.*` are preserved.

## Validation

- Production Webpack build completed with only the usual size/runtime warnings.
- PHP lint passed for all PHP files.
- English/Turkish locale parity: **781 keys**.
- Live dark and light theme checks passed for header, announcement, room pages, right rail and role colours.
- Live voice test with two member accounts on `warthunder.tr`: both joined the General room, microphone was enabled, the sharer saw a 1920x1080 local screen-share preview, and the second member received the 960x540 remote screen share with no browser console errors.
- The deployment's Permissions-Policy now allows `microphone`, `camera` and `display-capture` for the same origin while keeping geolocation disabled.
- `/social/rooms/general` and the other slug URLs load the expected room; legacy numeric URLs remain supported by the room API.
- Cover Studio cover URL is returned by the Social profile API.
- Existing security matrix and guest write protections remain unchanged. See [SECURITY-AUDIT.md](https://github.com/cengizkemec/flarum-social/blob/v1.1.1/docs/SECURITY-AUDIT.md).

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
