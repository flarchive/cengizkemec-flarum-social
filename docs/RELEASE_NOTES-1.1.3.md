# Flarum Social 1.1.3

Small user-facing language update.

- The self-profile button now says **Profilini düzenle** in Turkish and **Edit profile** in English instead of mentioning Flarum.
- Removed Flarum wording from the profile cover hint, guest posting prompt, community description and native-message label.
- Administrator settings, permission labels and developer documentation continue to use the correct Flarum terminology.

No database changes are required.

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
