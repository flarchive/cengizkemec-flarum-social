# Flarum Social 1.1.16

Restores Flarum Social as a standalone extension.

## Changes

- Removed the temporary **WTTRDesktop** bridge that was added in 1.1.15.
- The **War Thunder Türkiye desktop application** is a separate project. It does not add code, routes, permissions or dependencies to Flarum Social.
- Social feed, rooms, categories, voice, messaging, realtime and moderation behavior are unchanged.
- No database changes are required.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum cache:clear
php flarum assets:publish
```

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
