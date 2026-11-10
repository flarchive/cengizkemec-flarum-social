# Changelog

All notable changes to Flarum Social are documented here.

## 1.1.0 - 2026-11-10

- Screen sharing now subscribes to remote screen-share publications explicitly and renders the active share for every member connected to the voice room, not only the sharer.
- Added the sharer's name to the video, a local preview for the sharer, muted local preview to prevent echo, and click-to-fullscreen playback.
- Verified screen sharing end-to-end with two native Flarum users on a real LiveKit development server: the viewer received and rendered the remote screen-share track.
- Fixed ACP settings rendering for LiveKit, TURN, S3, Centrifugo and group-ID fields; URLs and keys are text fields and secrets are password fields, so they can be entered and saved from the admin panel.
- Hid the duplicate **Join voice** button in the room sidebar while the current user is already connected.
- Fixed the media lightbox fragment-key error and verified carousel navigation without console errors.
- Native Flarum profile covers are resolved through the profile-cover filesystem disk and shown in the Social profile and hover card.
- Added the author credit link to `https://cengizkemec.com.tr/` in the ACP.
- Added release screenshots and expanded installation, configuration and security documentation.
- English and Turkish locale parity is maintained at 780 keys.

## 1.0.1 - 2026-11-09

- Authentication now always uses Flarum's native login and sign-up modals. The separate Social login/register pages were removed.
- Text-room guests are taken straight to the native Flarum login modal.
- Added Discord-style shareable voice-room invite links with expiry, maximum uses and password/group bypass for invited members.
- Added native `flarum/messages` integration inside the Social messages layout (dialog list, thread, composer, native permissions and realtime).
- Added Instagram-style story rings, viewed state, progress bars, tap zones, keyboard navigation, auto-advance and captions.
- Added a media lightbox carousel with previous/next arrows, keyboard navigation, dots and swipe gestures.
- Added Social Statistics and configurable right-rail widget order in the ACP.
- Added an optional voice-room bubble widget to Flarum's forum index sidebar, toggleable from the ACP.
- Added FoF Links compatibility to the Social header, including link groups and visibility rules.
- Added user cover images to the hover profile card and Flarum-user bio/cover synchronisation when those extensions are present.
- Social header search moved to the right to make room for extra links; the language selector now follows Flarum's `show_language_selector` setting.
- Improved screen-share errors with browser-permission guidance.
- Added comments count to bootstrap statistics and cover fallbacks to the user presenter.
- Added optional `flarum/audit` integration for posts, comments, media, rooms, invite links, reports, profiles, stories, messages and friendship actions.
- Added Flarum forum categories to the Social menu and an ACP toggle for them.
- Added a forum-sidebar Social channel directory with categories, voice rooms and text channels.
- Added category assignment for standalone text channels and grouped category display in the Social menu and Rooms page.
- Added multi-file, drag-and-drop and clipboard-image uploads to text channels.
- Added a shared feed/comment hover profile card with cover, profile link, message and friend actions.
- Kept profile customisation in Flarum; Social now prefers native bio/cover/avatar fields and links self-profile editing to the Flarum profile.
- Fixed overlapping/extra header links by compacting the Social header and keeping the FoF Links dropdown inline.
- Completed English and Turkish translations for all new UI.

## 1.0.0 - 2026-11-09

Initial release.

- Public social feed with posts, comments, reactions, bookmarks, stories and media.
- Discord-style Social shell with integrated Flarum authentication and one header.
- Permanent and temporary rooms, left-sidebar voice room shortcuts, live participant lists and counts.
- LiveKit voice sessions with a persistent panel, mute/deafen, push-to-talk, per-user PTT key and voice sound preferences.
- Text channels, direct messages, notifications, profiles and follows/friends.
- Moderation reports, cleanup service, console commands and scheduled temporary-room pruning.
- ACP overview, settings, room/category/channel manager, reports and cleanup logs.
- English and Turkish translations.
- Markdown/BBCode/rich-text rendering, automatic YouTube/X embeds and optional link-preview compatibility.
- Seamless SPA navigation and native Flarum login/registration modals.
- Slug URLs for rooms and configurable slugs in the admin room editor.
- Optional Flarum Messages, FoF forum widgets/news and link-preview integrations.
- Right-rail widgets and latest forum discussions on Social pages.
