# Flarum Social 1.1.5

Small ACP polish release.

## Highlights

- **Category editing stays inside Flarum.** The browser `prompt()` dialog for editing a room category was replaced with an inline ACP form. Edit the category name and icon directly in the room manager, then Save or Cancel.
- **Author link fixed.** Both **Cengiz Kemec** links in the extension admin page and the ACP credit now open `https://cengizkemec.com.tr/`.
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
