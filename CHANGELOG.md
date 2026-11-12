# Changelog

All notable changes to Flarum Social are documented here.

## 1.1.6 - 2026-11-12

- Screen sharing now sends a realtime notification to every participant connected to the voice room: a toast names the sharer, a short sound cue plays, and **View** opens the room on the voice tab. Members can opt into desktop notifications for background alerts.
- Added a Discord-style ping graph to the connection-info panel. It keeps the last five minutes of latency and shows current, minimum, average and maximum values.
- Added **Keep microphone open in the background** to personal voice settings. Browsers cannot capture push-to-talk keys while another window has focus; this option keeps the microphone active when the tab loses focus, while the default behaviour now safely releases a stuck push-to-talk state when the tab is hidden.
- Added an ACP-selectable **AFK room** and **AFK timeout**. Inactive members are moved to the AFK room after the configured period with microphone and sound disabled, and can return to their previous room from the notification.
- Added **Move up / Move down** controls for rooms and categories in the ACP, backed by reorder endpoints.
- LiveKit rooms now use the human-readable room name plus a numeric suffix (for example `Genel Sohbet 1 (#1)`) so the LiveKit dashboard matches the names members see. Old `social-room-*` webhook names remain supported.
- Live-tested on `warthunder.tr` with two temporary accounts: voice join, screen-share toast, ping graph and AFK move all worked. Temporary accounts and test settings were removed afterwards.
- English and Turkish locale parity is maintained at 813 keys.
- No database changes are required.

## 1.1.5 - 2026-11-12

- Replaced the browser `prompt()` used for editing room categories with an inline Flarum ACP form (name and icon fields plus Save/Cancel).
- Added the author homepage to `composer.json`, so both the extension-page author link and the ACP credit link for **Cengiz Kemec** open `https://cengizkemec.com.tr/`.
- No database changes are required.

## 1.1.4 - 2026-11-12

- Removed Flarum's residual `.App` top padding on Social pages so the Social header sits directly at the top instead of leaving a blank 52px strip.
- Fixed the visual header jump when SPA-navigating between the forum and Social; the Flarum header and Social header now hand over cleanly in both directions.
- Added a story viewers list. Story owners and staff can click the eye counter to see members who viewed the story, with avatar, display name, role colour and view time.
- Non-owners receive `403` when requesting another member's story viewer list.
- Verified the forum sidebar **Sosyal** link and the Social header **Forum** link in both directions with no console errors.
- Live-tested story viewers with two temporary member accounts on `warthunder.tr`; the test story and accounts were removed afterwards.
- No database changes are required.

## 1.1.3 - 2026-11-12

- Changed the self-profile action from “Flarum profilinde düzenle” to **“Profilini düzenle”** and the English equivalent to **“Edit profile”** so members do not need to know the forum software.
- Removed user-facing Flarum wording from the profile cover hint, guest posting prompt, community description and native-message label.
- Kept technical Flarum references only in administrator settings, permissions and documentation.

## 1.1.2 - 2026-11-12

- Replaced the Social header's Font Awesome brand icon with the forum's own light or dark-mode logo from Flarum's Appearance settings.
- Fixed the FoF News / announcement area becoming two side-by-side blocks: all announcements now share one grid cell and one stable block height.
- Made the announcement card behave like the forum's news fader: lines rotate in place, the page height does not jump, and shorter announcements keep the same reserved space.
- Kept the forum announcement HTML, links and styling intact while displaying the block at full Social width.
- Verified the changes on the live `warthunder.tr` installation with the dark theme logo and the rotating announcements.

## 1.1.1 - 2026-11-12

- Made the Social header match the War Thunder theme: compact single-row navigation, uppercase condensed links, theme text colours and a red top rule in both dark and light modes.
- Grouped all FoF Links into one **Community** dropdown and removed the duplicate Forum link, so the Social header no longer wraps into a second row.
- Changed the default Social navigation placement to the Flarum side menu; administrators can add a header link through FoF Links if they want one.
- Replaced hard-coded red Social sidebar and right-rail link colours with theme-aware text colours. Member names in online/offline and top lists now use their Flarum group colour when available.
- Fixed the FoF News / announcement area: the configured HTML card is now shown at full width with its complete content instead of being clipped to one line.
- Fixed room URLs to use readable slugs (`/social/rooms/general`, `/social/rooms/squadron`, ...) and added a backfill for existing installations. New installations seed slugged rooms directly.
- Added native support for `tryhackx/flarum-cover-studio` covers through its companion relation, in addition to `sycho/flarum-profile-cover`.
- Live-tested the header, announcement, room pages, profile cover and slug routing on `warthunder.tr` in both dark and light mode.
- English and Turkish locale parity is maintained at 781 keys.

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
