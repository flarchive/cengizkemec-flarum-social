# Flarum Social 1.1.12

Category and channel creation fixes in the ACP.

## Highlights

- **Enter now adds categories.** The inline category form is a real form, so typing a name and pressing Enter submits it. Previously only clicking **Add category** worked.
- **Clear validation.** Submitting an empty category or channel name now shows a translated error alert instead of silently doing nothing.
- **No duplicate submissions.** The add buttons show a loading state and are disabled while the request is in flight. Successful additions show a confirmation alert.
- **Correct category order.** New categories are appended with `max(sort_order) + 10`, so they no longer land in the middle of a category list that was reordered to 0, 10, 20, and so on.
- **Clearer icon field.** The category icon input is now labelled, constrained in width and shows the `fas fa-folder` placeholder. It can no longer be mistaken for the category name field.
- **Empty category hint.** The ACP explains that a new category appears in the Social menu after a room or channel is assigned to it.
- Channel creation now has the same Enter-key support, validation and duplicate-submit protection.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum cache:clear
php flarum assets:publish
```

No database migrations and no configuration changes are required.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
