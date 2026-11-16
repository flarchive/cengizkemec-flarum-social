# Flarum Social 1.1.7

Background push-to-talk fix.

## Highlights

- If a push-to-talk keyup event was lost because the browser moved to another window, returning to the tab now restores the muted push-to-talk state instead of leaving the microphone open. This complements the **Keep microphone open in the background** setting added in 1.1.6.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum cache:clear
php flarum assets:publish
```

No database changes are required.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
