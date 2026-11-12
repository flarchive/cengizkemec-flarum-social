# Cleanup and retention

Social has two cleanup layers.

## Temporary rooms

A temporary room is eligible for deletion when:

- it has no participants seen within the last two minutes;
- its `last_activity_at` is older than `temporary_room_empty_seconds` (default 10);
- it is older than that grace period.

Eligible rooms are deleted by the browser-driven presence janitor every ten seconds, by bootstrap requests, and by `php flarum social:purge-rooms`. The scheduler runs the command every minute as a safety net when no browser is open. Exact ten-second deletion when the whole site is idle requires an external timer running the command every ten seconds.

## Media and stories

`php flarum social:cleanup` handles:

- expired stories;
- temporary media;
- orphaned media after the grace period;
- retention limits for images, videos and documents;
- old direct messages (when retention is enabled).

The command supports `--dry-run` and `--only=media|rooms|stories|messages`. Automatic cleanup is controlled by `cleanup_enabled`; `--force` overrides it.

## Logs

Cleanup runs are recorded in `social_cleanup_logs` and can be inspected from the ACP overview/cleanup tabs.
