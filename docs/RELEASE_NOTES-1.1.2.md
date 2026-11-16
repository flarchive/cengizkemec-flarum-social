# Flarum Social 1.1.2

This release polishes the Social shell for the live War Thunder installation.

## Highlights

- **Forum logo in Social.** The Social header now uses the same light or dark-mode forum logo configured in Flarum's Appearance settings. The old Font Awesome brand icon remains only as a fallback when no logo is configured.
- **One stable announcement block.** The FoF News / announcement fader no longer shows two announcements side by side or changes the page height while rotating.
- **Matches the forum fader.** All lines share one grid cell and one reserved height; the current line fades in place while the block keeps its size, so the feed below never jumps.
- **Full-width announcement.** The configured forum HTML card keeps its links and styling and uses the full Social content width.

## Live validation

- The dark-mode forum logo renders correctly in the Social header.
- The announcement container is 201px high and stays 201px when switching between the long and short announcements.
- Both announcement lines occupy the same grid cell at full width; there are no left/right duplicate blocks.
- No browser console errors on the live `/social` page.
- Existing room slugs, role-coloured member names, native covers and voice/screen-share configuration remain unchanged.

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
