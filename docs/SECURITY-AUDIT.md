# Security audit — Flarum Social 1.1.2

Date: 2026-11-12
Target: Flarum 2.0.2, PHP 8.4, MariaDB 11.8, extension `cengizkemec-social`, LiveKit server on localhost and `warthunder.tr`.

This is a practical audit of the extension surface plus a live HTTP test matrix. It is not a formal third-party penetration test.

## Result summary

- Guest, member, restricted-member and administrator authorization boundaries were exercised.
- CSRF protection is enforced by Flarum on session-authenticated API requests.
- Guest writes are rejected after authentication/authorization checks.
- Private posts, profiles, rooms, channel media and direct conversations were denied to unrelated members/guests.
- Admin-only routes returned 403 for members.
- Media MIME validation, access-controlled file delivery and deletion ownership were checked.
- XSS probes against posts, links and formatted HTML were neutralized.
- SQL-injection probes in search/hashtags returned normal results without errors.
- LiveKit webhook signature, issuer, expiry and body hash are checked.

## Fixes made during the audit

- Required the LiveKit issuer and body hash on webhooks, preventing a signed participant access token from being replayed as a webhook.
- Added webhook `exp`/`nbf` checks.
- Restricted heartbeats to actual participants, so arbitrary users cannot keep empty temporary rooms alive.
- Removed GET side effects from the janitor; it is now a CSRF-protected POST.
- Blocked restricted users from media upload, following, joining rooms, reactions, bookmarks and stories.
- Fixed channel visibility checks for guests so channels inside hidden rooms are not discoverable.
- Fixed media ownership checks for channel messages in private rooms.
- Sanitized uploaded names and `Content-Disposition` filenames against control characters/header injection.
- Added early upload-size rejection before copying into a temporary file.
- Added comment edit-window enforcement.
- Added profile/relation-list privacy checks for private profiles.
- Protected global administrators from room-level moderation by non-administrators.
- Added `Cache-Control: private, no-store` to the bootstrap response containing the CSRF token.

## LiveKit and screen-sharing validation

The extension was tested against real LiveKit servers, not only signed tokens:

- LiveKit server `--dev` at `ws://127.0.0.1:7880` with the development key/secret.
- Two native Flarum users (admin and member1) joined the same public voice room.
- Admin clicked **Share screen** in the Social UI and allowed desktop capture.
- The admin local preview reported 1920x1080, readyState 4 and playing.
- member1 received the remote `screen_share` track, attached it to the Social video element, and reported 960x540, readyState 4, playing, with the sharer label `admin`.
- A synthetic remote screen-share test also confirmed explicit subscription and rendering of a remote share at 800x450.
- A media lightbox open/close test produced no JavaScript console errors.
- ACP text/password fields for LiveKit, TURN, S3, Centrifugo and group-ID settings rendered correctly; the ACP save-and-revert test passed.
- No `__LiveKitRoom` or `__socialVoice` integration-test hooks remain in the production bundle.

- A live deployment test on `warthunder.tr` used two temporary member accounts in the General room. Both joined voice, microphone was enabled, the sharer produced a 1920x1080 local screen-share preview, and the second member received the 960x540 remote share with no browser console errors.
- The live deployment's `Permissions-Policy` was corrected from `microphone=()` to `microphone=(self), camera=(self), display-capture=(self)` so voice capture is permitted on the HTTPS origin. Temporary test accounts were removed afterwards.

This closes the previous "LiveKit was not running" gap for local voice transport and screen sharing. Centrifugo realtime delivery and TURN traversal still need a staging test on the target network.

## Live access-control matrix

| Test | Actor | Expected | Observed |
| --- | --- | --- | --- |
| `GET /api/social/bootstrap` | guest | 200 | 200 |
| `GET /api/social/feed` | guest | 200 | 200 |
| `POST /api/social/posts` without CSRF | guest | 400 CSRF | 400 |
| `POST /api/social/posts` with guest CSRF | guest | 401 | 401 |
| `GET /api/social/admin/overview` | guest/member | 403 | 403 |
| `GET /api/social/admin/rooms` | admin | 200 | 200 |
| Private post | guest/member | 403 | 403 |
| Private post | owner/admin | 200 | 200 |
| Private profile and follower lists | guest/other member | 403 | 403 |
| Private profile and follower lists | owner/admin | 200 | 200 |
| Private room | guest/other member | 403 | 403 |
| Private room | owner/admin | 200 | 200 |
| Kick a global administrator | non-admin room owner | 403 | 403 |
| Heartbeat without joining | member | 403 | 403 |
| Private channel media | unrelated member | 403 | 403 |
| Private channel media | owner/admin | 200 | 200 |
| DM conversation messages | non-participant | 403 | 403 |
| Admin report resolution | member | 403 | 403 |
| Admin report resolution | admin | 200 | 200 |
| Restricted member join/comment/upload | member | 403 | 403 |
| Member edit/delete another member's post/comment | member | 403 | 403 |

## Other checks

- **CSRF:** authenticated session POST without `X-CSRF-Token` returned 400; with the current token returned 201. Token is refreshed after login/registration/logout.
- **XSS:** `<script>` and `onerror` payloads were escaped by s9e; no script/image nodes executed in the rendered feed; `javascript:` Markdown links were removed.
- **SQL injection:** search `q=' OR 1=1 --` and hashtag payloads returned 200 with normal empty results. Pagination limits are clamped.
- **Media:** PHP upload rejected (422), restricted uploader rejected (403), guest temporary file rejected (403), owner/admin allowed. Range requests and `nosniff` are implemented.
- **Slugs:** custom admin slug accepted; numeric legacy URLs still resolve.
- **Cleanup:** empty temporary room deleted after the configured grace period; permanent rooms and their counts remain.
- **Locale parity:** 781 keys in both `en.yml` and `tr.yml`.
- **Build/lint:** production build completed with only webpack size/runtime warnings; all PHP files passed `php -l`.

## Residual risks and deployment notes

1. **Centrifugo and TURN traversal were not tested end-to-end.** LiveKit voice transport and screen sharing were validated on localhost with the development server. Centrifugo realtime delivery and TURN traversal still need a staging test with the production network and credentials.
2. **Custom CSS is trusted administrator content.** It is inserted through `style.textContent` (no HTML breakout), but CSS can still alter layout, hide warnings, or load external resources.
3. **FoF link previews are third-party outbound requests.** SSRF/allowlist protection belongs to that extension; keep it updated.
4. **TURN credentials are delivered to voice clients.** Use short-lived TURN credentials or a TURN service that supports them; do not reuse a long-lived secret elsewhere.
5. **Rate limiting is database-backed and per-minute.** It is not a substitute for a WAF or edge rate limits under sustained abuse.
6. **Temporary-room cleanup depends on a request or cron.** Configure the scheduler; use a 10-second external timer if exact idle behavior is required with no open browser.
7. **Uploads are MIME-checked but not malware-scanned.** Add ClamAV or an object-scanning service if untrusted documents are allowed.
8. **No Content-Security-Policy is added by the extension.** Use your web server/theme CSP and account for the YouTube/X iframes and optional link-preview images.
9. **Admin sessions are powerful.** Protect ACP access with HTTPS, strong administrator credentials and Flarum's normal security updates.

## Repeatable checks

```bash
php tests/locale-parity.php
powershell -File tests/http-smoke.ps1 -BaseUrl https://forum.example.com \
  -AdminToken "$ADMIN_TOKEN" -MemberToken "$MEMBER_TOKEN"
```

For deeper testing, configure a staging LiveKit/Centrifugo instance and rerun the voice/realtime cases with real credentials.
