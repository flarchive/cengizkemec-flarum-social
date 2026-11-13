# Flarum Social 1.1.4

This release fixes the forum/Social header handover and adds a story viewers list.

## Highlights

- **Clean forum ↔ Social transitions.** Removed Flarum's residual 52px `.App` top padding on Social pages. The Social header now starts at the top instead of leaving a blank strip, and returning to the forum restores the normal Flarum header.
- **Story viewers.** The story owner (and staff) can click the eye counter inside a story to open a list of members who viewed it. The list shows avatar, display name, username, role colour when available and the view time.
- **Viewer privacy.** Non-owners cannot request another member's viewer list; the endpoint returns `403`.
- **Live tested.** The viewer list and permission checks were tested on the live `warthunder.tr` installation with two temporary member accounts and removed afterwards.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum migrate
php flarum cache:clear
php flarum assets:publish
```

No database schema changes are required.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
