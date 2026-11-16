# Flarum Social 1.1.10

Mobile navigation polish.

## Highlights

- **Social mobile navigation is now visible.** Flarum's `acpl/mobile-tab` bottom bar is hidden while a Social page is active, so the Social bar with Feed, Explore, Rooms, Messages/Login and Profile is no longer covered on phones.
- **No impact on the rest of the forum.** Flarum's mobile tab bar and navigation drawer button return immediately on normal forum pages such as `/all`.
- **Live-tested at 390×844:** Social bottom navigation is visible, Flarum's tab bar is hidden on Social, the drawer opens correctly, and the expected bars return on forum routes.
- No database migrations and no configuration changes are required.

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
