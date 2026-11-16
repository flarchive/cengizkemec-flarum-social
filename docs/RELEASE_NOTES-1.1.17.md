# Flarum Social 1.1.17

Text channels now have the same management depth as rooms, and forum widgets respect their ACP switches.

## Changes

- Added **URL slug**, **Font Awesome icon**, **creation timestamp**, **group permissions** and a full edit modal to text channels in **ACP → Flarum Social → Rooms**.
- Text channels can be standalone or attached to a room, moved between rooms, locked, sorted and restricted to selected Flarum groups.
- Room text channels are now listed in the channel manager. Rooms with more than one text channel show a channel switcher in the forum.
- Text-channel links use `/social/channels/your-slug`; old numeric links still work.
- Added optional **unlimited capacity** for rooms. Set the checkbox in the room editor; the forum displays `∞` instead of `0 / 60`.
- Replaced comma-separated group IDs with a group checklist for room and channel permissions.
- Fixed disabled forum-sidebar widgets still appearing. A saved empty switch value is now correctly treated as **off**, not as the enabled default.
- Existing text channels are backfilled with unique slugs during migration.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

## Database

`social_text_channels` gains `slug`, `icon` and `allowed_groups`.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
