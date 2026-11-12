# Contributing

Thanks for improving Flarum Social.

## Development

1. Install the extension in a Flarum 2.0 development installation.
2. Run `cd js && npm install && npm run dev`.
3. Run `php flarum cache:clear` after PHP changes and `php flarum assets:publish` after rebuilding JS/CSS.
4. Keep `js/dist` committed; the Composer package ships prebuilt assets.

## Code style

- PHP: PSR-12, strict typing where practical, no changes to Flarum core.
- TypeScript/Mithril: follow the surrounding component style. Do not add Mithril `key` props to only some children of a fragment.
- Every user-facing string belongs in `locale/en.yml` and `locale/tr.yml`. Keep both files at key parity.
- Do not add hardcoded URLs, credentials or environment-specific values.

## Tests before a pull request

```bash
php tests/locale-parity.php
php -l path/to/changed-file.php
cd js && npm run build
```

Run the HTTP smoke test against a real Flarum installation when changing routes, permissions, media or voice.

## Pull requests

Describe what changed, how it was tested, and any deployment requirements. Include screenshots for visible UI changes.
