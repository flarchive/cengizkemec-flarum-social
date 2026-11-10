# Configuration

All settings live in **Administration → Flarum Social**. Settings are stored under the `cengizkemec-social.*` namespace.

## Rooms

- **Create voice room** opens the room editor with voice and text chat enabled and the default capacity filled in.
- **URL slug** controls `/social/rooms/<slug>`. Leave it blank and Social generates a unique slug from the room name. Updating a slug leaves the old numeric URL working but changes shared slug links.
- **Capacity** must be between 2 and the global `max_room_capacity`. The editor shows the allowed range, blocks saving invalid values, and the server clamps the value again.
- **Voice/text/screen sharing** flags control what the room exposes.
- **Allowed group IDs** restrict access to Flarum groups. Empty means all groups.

Temporary user-created rooms are pruned after the configured empty grace period. Permanent rooms created in the ACP are never auto-deleted and keep showing live participant counts.

## Voice

- **Default/maximum room capacity** sets the global bounds used by the room editor.
- **Push to talk** and **PTT key** are global defaults. Each member can override the key, enable or disable push-to-talk, turn sound cues on/off, choose join-muted, and adjust noise suppression, echo cancellation and automatic gain in the Social voice settings dialog (sliders button).
- **Voice sounds** controls Discord-style join/leave/mute/deafen cues. They are synthesized with the Web Audio API and need no audio assets.
- **LiveKit URL / API key / API secret** must match the LiveKit server. These are rendered as normal text and password fields in the ACP, so credentials can be entered and saved without touching the database. An invalid key error means the secret does not match the server, not that localhost is unsupported.
- **Enable screen sharing** and **Maximum simultaneous screen shares** control the global screen-share policy. Room editors also have a per-room screen-share switch. The `social.shareScreen` permission decides which groups may publish.
- **Automatically reconnect voice** lets the client recover from a short network interruption without leaving the room.

### Screen sharing

A screen share is a LiveKit screen-share publication, not a screenshot. Every participant in the room subscribes to the remote video, so all members can watch the same active share. The sharer gets a local preview; other members see the sharer's name on the video. Click the video to open full screen. Screen-share audio is attached separately, so the muted local preview does not silence the shared audio for other listeners.

To verify locally:

1. Start a LiveKit server and enter its URL, key and secret in the ACP.
2. Open the same voice room in two different browsers, signed in as two different Flarum users.
3. Join voice in both.
4. Click **Share screen** in one browser and allow capture.
5. Confirm the local preview appears in the sharing browser and the sharer's video appears in the other browser.
6. Click the video in the viewing browser and confirm full screen works.

Browsers block screen capture on insecure origins. Use `https://` in production; `http://localhost` is accepted for local testing.

## Messages

Enable `flarum/messages` to use Flarum's native inbox. Social renders the native dialogs and message stream inside its own layout, using Flarum's dialog models, permissions, notifications and realtime delivery. When the official extension is disabled, the Social DM fallback is used instead.

## Forum categories and sidebar

The Social left menu can show Flarum's primary forum categories under **Forum**, linking to the normal tag pages. Turn this off with **Show Flarum forum categories in the Social menu** (`forum_categories_in_social`).

The forum's own index sidebar can show two optional Social blocks:

- **Show voice rooms widget in the forum sidebar** (`forum_voice_widget`) adds a compact live-room bubble widget.
- **Show Social channel categories in the forum sidebar** (`forum_social_menu`) adds a Discord/FoF-Blog-style directory with Social categories, voice rooms and text channels.

Both are enabled by default and can be switched off independently.

## Text channels and drag-and-drop

Text channels support multi-file attachment selection, drag-and-drop uploads over the channel area, and pasted clipboard images. Files are uploaded through the normal Social media pipeline and then posted as a message with attachments. The channel input and category assignment are managed from **ACP → Flarum Social → Rooms**.

## Audit

When `flarum/audit` is enabled, Social logs its own actions through the Audit extension. Actions include post/comment creation and deletion, media uploads and deletions, room creation/updates/deletion, room invite links, reports, profile updates, follows, stories, channel messages and friendship changes. Logging is optional: when Audit is disabled the helper is a no-op and Social continues normally.

## Invite links

Room managers can open a room's menu and choose **Invite link**. Links use a random token, can expire after 1 hour, 24 hours or 7 days (or never), and can be limited by number of uses. Opening a link grants the visitor an accepted room invitation; guests are sent to Flarum's native login modal first and the invitation is redeemed after login. Invite links bypass room passwords and group restrictions for the invited member, like Discord invites.

## Appearance and custom CSS

Social inherits Flarum's body/control/text variables and primary theme colours. Administrators can add extra rules in **ACP → Flarum Social → General → Custom CSS**. The value is inserted through a `<style>` element with `textContent`, so CSS cannot break out into HTML; it is still administrator-controlled code and should only be edited by trusted staff. Scope rules under `.SocialApp` when possible.

Top lists show the configured number of members/items (`leaderboard_limit`, default 10, range 1–20). They cover most posts, most likes, top posts, voice regulars and voice rooms.

## Widgets and news

`fof/forum-widgets-core` widgets using `start_top`, `start_bottom`, `end` and `bottom` placements appear in the Social right rail. `fof/news-widget` lines appear in the full-width top fader. Social never seeds its own news lines.

The right rail order is configurable with `aside_order`, a comma-separated list of widget keys:

`online, offline, leaderboards, hashtags, voiceRooms, widgets, forumLatest, stats`

For example, `stats,online,leaderboards,hashtags,voiceRooms,stats` puts Social Statistics first. Unknown keys are ignored and any widget left out is appended at the end. The **Social Statistics** widget has its own heading and shows posts, comments, members, rooms, media and voice participants.

Enable **Show voice rooms widget in the forum sidebar** (`forum_voice_widget`) to add a compact bubble widget to Flarum's own index sidebar. It lists rooms with live participants and links to the Social room.

Links created with `fof/links` are mirrored in the Social header, including groups and the same guest/restricted visibility rules. The Social search box sits on the right so additional header links have room.

## Link previews

When `datlechin/flarum-link-preview` is enabled, the first non-media URL in a Social post is sent to its public preview endpoint and rendered as a card. YouTube and X/Twitter URLs are converted to iframes by the shared s9e formatter instead.

## SEO

Social updates the document title, canonical URL and Open Graph title/description/url on route changes. It does not modify FoF SEO; both can be enabled together.
