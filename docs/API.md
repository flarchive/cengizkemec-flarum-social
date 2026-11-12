# HTTP API

All endpoints are under `/api/social`. Browser requests use Flarum's session cookie and CSRF token; server-to-server requests may use `Authorization: Token <token>`.

## Public/read

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/social/bootstrap` | Config, current user, permissions, rooms, channels, stats |
| GET | `/social/feed` | Feed with `filter`, `page[offset]`, `page[limit]` |
| GET | `/social/posts/{id}` | Single post and comments |
| GET | `/social/media` | Media library |
| GET | `/social/media/{id}/file` | Access-controlled media bytes |
| GET | `/social/rooms` | Rooms and categories |
| GET | `/social/rooms/{id-or-slug}` | Room details |
| GET | `/social/invites/{token}` | Resolve a room invite link (guests get `requiresLogin`) |
| GET | `/social/channels/{id}/messages` | Channel history |
| GET | `/social/profile/{username}` | Public profile |
| GET | `/social/explore` | Trends, creators, rooms, media |
| GET | `/social/search?q=` | Search |
| POST | `/social/presence/janitor` | Purge eligible empty temporary rooms (CSRF protected) |

## Writes

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/social/posts` | Create post |
| PATCH/DELETE | `/social/posts/{id}` | Edit/delete post |
| POST | `/social/posts/{id}/react` | React |
| POST | `/social/posts/{id}/bookmark` | Bookmark |
| POST | `/social/rooms` | Create temporary room |
| PATCH/DELETE | `/social/rooms/{id}` | Edit/delete room |
| POST | `/social/rooms/{id}/{action}` | join, leave, heartbeat, invite, invite_link, revoke_invite_link, kick, ban, mute, close, transfer |
| POST | `/social/channels/{id}/messages` | Send channel message |
| GET/POST | `/social/dm/...` | Fallback direct messages |
| GET | `/social/notifications` | Notifications |
| GET | `/social/bookmarks` | Bookmarks |
| POST | `/social/realtime/token` | Optional Centrifugo token |

Admin endpoints are under `/api/social/admin` and require a Flarum administrator.

## Room slugs

`GET /social/rooms/{value}` accepts either the numeric ID or the room slug. The frontend uses slugs for room links. Room actions and admin edits continue to use numeric IDs.

## Errors

Errors use `{ "errors": [{ "status": "...", "code": "...", "detail": "..." }] }`. Guest writes return `401`, permission failures `403`, missing records `404`, and unconfigured voice `503 voice_not_configured`.
