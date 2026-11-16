# Flarum Social 1.1.15

Desktop bridge for the War Thunder Türkiye Windows application.

## Highlights

- **`WTTRDesktop` bridge.** The forum now exposes a small bridge used by the desktop app:
  - `WTTRDesktop.openAuth('login' | 'register')`
  - `WTTRDesktop.setPTT(true | false)`
  - `WTTRDesktop.getVoiceSettings()`
  - `WTTRDesktop.getState()`
- **Direct push-to-talk.** `setPTT` enables or disables the active Social voice microphone through the existing voice session. The desktop app no longer relies on synthetic keyboard events, so push-to-talk works even when the app is unfocused and regardless of the site’s configured PTT key.
- **Integrated sign-in.** `openAuth` opens the existing login or registration modal, so the desktop app reuses the normal Flarum session, password and security verification flow.
- **No extra privileges.** The bridge only calls UI actions that are already available to the current page and voice session.
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
