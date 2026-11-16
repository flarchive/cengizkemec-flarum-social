# Localization

Social ships complete English and Turkish locale files in `locale/en.yml` and `locale/tr.yml`. Both files must contain the same keys.

- All extension strings are under `cengizkemec-social`.
- User-facing strings in PHP and TypeScript use `app.translator.trans('cengizkemec-social...')` or `$translator->trans(...)`.
- Route titles, guest prompts, admin labels, voice settings and errors are translated.
- Turkish is registered by the extension's locale service provider even when a separate Turkish core language pack is not installed. Core Flarum strings still follow the core locale packs.
- Language can be changed from the Social header selector or Flarum's normal language selector. Changing language reloads the page because Flarum loads locale bundles at boot.

Run the parity check:

```bash
php tests/locale-parity.php
```

To add a language, copy `locale/en.yml`, translate values without changing keys, and ensure the Flarum locale is installed/registered.
