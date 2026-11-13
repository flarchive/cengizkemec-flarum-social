# Flarum Social 1.1.9

Mobile navigation fix.

## Highlights

- **Mobile menu now opens correctly.** Flarum's global fixed drawer button was sitting on top of the Social menu button in the top-left corner, so taps opened Flarum's empty drawer instead of the Social navigation. The global button is now hidden inside Social, while normal forum pages keep it.
- **Immediate drawer feedback.** Opening the Social drawer, closing it from the overlay and following a drawer link now redraw explicitly, so the panel never waits for an unrelated periodic refresh.
- **Broader toggle fix.** Flarum 2 route pages do not run Mithril's automatic event redraw. A scoped click redraw inside `.SocialApp` restores immediate rendering for simple toggles such as tabs, post menus and reaction pickers.
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
