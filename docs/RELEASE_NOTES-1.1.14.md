# Flarum Social 1.1.14

Member rooms now have visible, configurable categories.

## Highlights

- **User-room categories setting.** Under **ACP → Flarum Social → Rooms**, enter one or more category IDs in **User-room categories (IDs)**. Members can only create rooms in those categories. Leave the field empty to keep the previous behaviour and allow any category.
- **Category selector in the create-room modal.** The selected category is validated on the server and stored on the room, so member rooms appear under that category instead of always being uncategorized.
- **Visible empty categories.** Categories reserved for member rooms now appear in the Social sidebar, the forum Social menu and the Rooms page even before the first room is created.
- **Fixed information note.** Each member-room category shows a short note explaining that members can create their own room there, with a **Create your own room** button. Guests see a login prompt instead.
- **Category IDs in the ACP.** The category list now displays each category’s ID next to its name, making the new setting easy to configure.
- **Member rooms stay alive.** Member-owned rooms were incorrectly removed after the short temporary-room grace period (10 seconds by default). They now use the configured **Delete empty temporary rooms after** value (30 minutes by default).
- No database changes are required.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum cache:clear
php flarum assets:publish
```

Then open **ACP → Flarum Social → Rooms** and fill **User-room categories (IDs)**. For example, enter `8` for the category whose ID is shown as `#8` in the category list.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
