# Troubleshooting

## "Invalid API key" when joining voice

This comes from LiveKit, not Flarum. The browser received a token signed with an API key/secret that the configured LiveKit server does not recognise. Check that the URL, API key and secret in **ACP → Flarum Social → Voice** are exactly the values used by the LiveKit server. Test credentials or placeholder values (`wss://test.livekit.cloud`, `testkey`, `testsecret`) always fail. If voice is not configured, clear all three fields and Social will show "Voice is not configured".

Localhost is not the cause as long as the browser can reach the LiveKit URL and the credentials match. Use `ws://127.0.0.1:7880` for a local server or `wss://...` in production.

## Two headers

Social hides Flarum's header components on `/social` routes and renders its own integrated header. If a custom theme still shows two headers, check that its header is not fixed outside `#header` and that the theme does not override `.SocialPage-body #header { display: none }`.

## SPA navigation reloads the page

Social intercepts same-origin anchor clicks and routes them through Mithril. Links to `/admin`, `/api`, `/assets` and `/logout` intentionally use full navigation. Third-party links with `target="_blank"`, `download`, modifier keys or external origins are left alone.

## Messages opens the fallback inbox

Enable `flarum/messages` in the Flarum admin panel. Social detects the extension at runtime and redirects `/social/messages` to the native `/messages` page. If it is disabled, the built-in DM fallback is used.

## FoF widgets are missing

Install and enable `fof/forum-widgets-core`. Social renders widgets placed in `start_top`, `start_bottom`, `end` or `bottom` in the right rail. News lines come from `fof/news-widget`; Social does not maintain its own news list. Clear the Flarum cache after enabling the extensions.

## YouTube/X links do not embed

The shared s9e formatter must be rebuilt after installation or upgrades:

```bash
php flarum cache:clear
php flarum assets:publish
```

Only public single-video/tweet URLs supported by s9e are embedded. Plain links remain links.

## Temporary room disappears too quickly

Increase `temporary_room_empty_seconds` in the ACP rooms group. Ensure browser tabs are not frozen for long periods and that the janitor command/cron is running. The room must have had no live participant during the grace period.

## Media uploads fail

Check `uploads`, `max_image_mb`, `max_video_mb`, `max_document_mb`, allowed MIME types, PHP upload limits and `user_quota_mb`. S3 mode additionally requires the Flysystem/S3 packages and correct bucket credentials.

## ACP content touches the left navigation

The extension adds responsive padding to the Social admin page. Clear the cached CSS and rebuild assets after updating:

```bash
php flarum cache:clear
```
