# Security Policy

## Supported versions

Security fixes are provided for the latest release line.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Contact the maintainer privately with:

- affected version,
- reproduction steps,
- impact assessment,
- any suggested fix.

## Security model

- Social uses Flarum's native users, sessions, access tokens, permissions and CSRF protection.
- Guests can read only content that the administrator exposes as public. Every write endpoint calls `assertRegistered()` and the relevant policy checks on the server.
- Media files are served through access-controlled Social endpoints; private media is never exposed by a public storage URL unless an administrator explicitly configures a public CDN base URL for public files only.
- LiveKit tokens are signed server-side with the configured API secret. The secret is never sent to the browser.
- LiveKit/Centrifugo webhooks are verified server-side.
- Temporary-room cleanup only deletes rooms that have no live participants.
- YouTube/X embeds are generated as sandboxed third-party iframes. Link previews are delegated to the installed link-preview extension, which is responsible for SSRF protection of outbound metadata requests.
- Administrators should use HTTPS/WSS, keep LiveKit and Centrifugo secrets private, and configure a reverse proxy with request-size limits.
