# Flarum Social 1.1.8

Optional FoF Upload storage for Social media.

## Highlights

- **FoF Upload compatibility.** A new opt-in setting in **ACP → Flarum Social → Media** lets Social store new uploads through the forum's existing `fof/upload` adapters. Files appear in the FoF Upload media library and use the same local, S3 or other configured storage.
- **Safe fallback.** If FoF Upload is disabled, unavailable or the member lacks its upload permission, Social falls back to its own media storage automatically.
- **Social rules stay in force.** Attachment records, visibility, per-type size limits, user quotas and cleanup remain owned by Social. Deleting a Social attachment does not remove the underlying FoF file, because it may still be referenced from a forum post.
- The setting is disabled by default, so existing installations keep their current storage behaviour until an administrator enables it.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum cache:clear
php flarum assets:publish
```

No database migrations are required.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
