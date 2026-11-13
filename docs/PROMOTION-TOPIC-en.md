# Flarum Social 1.1.10 — Turn your Flarum forum into a living community space

Flarum Social keeps everything you already love about Flarum and adds a Discord-style social layer on top: a community feed, media library, voice rooms, screen sharing, text channels, stories, direct messages and a full admin experience.

**Live example:** [warthunder.tr/social](https://warthunder.tr/social)  
**GitHub:** [cengizkemec/flarum-social](https://github.com/cengizkemec/flarum-social)  
**Latest release:** [v1.1.10](https://github.com/cengizkemec/flarum-social/releases/tag/v1.1.10)

![Flarum Social community overview](https://raw.githubusercontent.com/cengizkemec/flarum-social/main/docs/promotion/01-social-explore.jpg)

Flarum Social is built on top of Flarum's existing users, groups, permissions and moderation tools. There is no separate account system and no parallel community to maintain: your forum remains the source of truth.

## Feature highlights

### Community feed

A familiar social feed with posts, comments, reactions, bookmarks, hashtags and @mentions. Members can attach images, videos and documents, and links are turned into preview cards automatically.

### Media library

Drag-and-drop uploads, multi-file selection and paste-from-clipboard support. Images get thumbnails, videos get an inline player, documents get download links and every file opens in a full-screen viewer.

### Voice rooms

Real-time voice chat powered by LiveKit. Microphone, deafen, push-to-talk, per-member volume, Discord-style join/leave sounds and live connection quality.

![Flarum Social voice room](https://raw.githubusercontent.com/cengizkemec/flarum-social/main/docs/promotion/03-social-voice-room.jpg)

### Screen sharing

Members can share their screen directly inside a voice room. Everyone in the room can watch the live stream, the sharer gets a local preview, and the video can be opened full screen. When sharing starts, other participants receive a toast notification, a short sound cue and — if enabled — a desktop notification.

### Connection diagnostics

A Discord-style ping graph shows the last five minutes of latency, with current, minimum, average and maximum values, connection quality, connected duration and server hostname.

### AFK handling

Administrators choose an AFK voice room and timeout in the ACP. Inactive members are moved there automatically with microphone and audio disabled, and can return to their previous room from the notification.

### Text channels and rooms

Permanent and temporary rooms, categories, text channels, password-protected rooms, invite links, capacity limits and room-level moderation.

![Flarum Social rooms](https://raw.githubusercontent.com/cengizkemec/flarum-social/main/docs/promotion/02-social-rooms.jpg)

### Direct messages and stories

Direct messages integrate with Flarum's native messaging stack when `flarum/messages` is enabled. Stories last 24 hours and include a viewer list and owner controls.

### Profiles and social graph

Profile covers, bios, followers, following, friend requests, role colours, online status and recent activity.

![Flarum Social profile](https://raw.githubusercontent.com/cengizkemec/flarum-social/main/docs/promotion/02-social-profile.jpg)

### Notifications

In-app notifications, optional real-time delivery through Centrifugo, and desktop notifications for events such as screen sharing.

### Mobile experience

A dedicated Social mobile bottom bar, a touch-friendly navigation drawer, full-screen media viewer and layouts designed for small screens.

![Flarum Social on mobile](https://raw.githubusercontent.com/cengizkemec/flarum-social/main/docs/promotion/06-social-mobile.jpg)

![Flarum Social mobile navigation drawer](https://raw.githubusercontent.com/cengizkemec/flarum-social/main/docs/promotion/05-social-mobile-menu.jpg)

### Administration and moderation

A complete ACP experience: room and category manager, drag-free up/down ordering, permissions, moderation logs, reports, cleanup tools and voice/media settings.

### Integrations

- **FoF Upload** optional shared media storage
- **FoF Links**, **FoF News Widget**, **FoF Profile Cover** and **FoF Widgets** support
- **flarum/messages** for native direct messages
- **Centrifugo** for real-time channels
- **S3-compatible** media storage
- **PWA** and mobile installation support
- English and Turkish localization

## What's new in 1.1.10

- Flarum's own mobile tab bar no longer covers Social's mobile navigation on phones.
- Social's Feed / Explore / Rooms / Messages / Profile bar is visible on small screens again.
- Flarum's mobile navigation returns normally on regular forum pages.
- No database changes.

## Requirements

- Flarum 2.0 or newer
- PHP 8.3 or newer
- A LiveKit server for voice rooms and screen sharing
- Optional: Centrifugo, S3-compatible storage, FoF Upload

## Installation

```bash
composer require cengizkemec/flarum-social
php flarum migrate
php flarum assets:publish
php flarum cache:clear
```

Then enable the extension and configure it from **ACP → Flarum Social**.

## Who is it for?

- Gaming communities and squadrons
- Streamers and content creators
- Local communities and teams
- Any Flarum forum that wants a Discord-like hub without leaving the forum

Try the live community at [warthunder.tr/social](https://warthunder.tr/social) to see the feed, media, rooms and voice features working together on a real forum.

Feedback, bug reports and contributions are welcome on GitHub. The project is **MIT licensed** and actively maintained.

**GitHub:** [github.com/cengizkemec/flarum-social](https://github.com/cengizkemec/flarum-social)  
**Releases:** [github.com/cengizkemec/flarum-social/releases](https://github.com/cengizkemec/flarum-social/releases)
