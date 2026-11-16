# Flarum Social 1.1.6

Voice notifications, connection diagnostics, AFK handling and room ordering.

## Highlights

- **Screen-share notifications.** When a member starts sharing, everyone connected to the voice room receives a toast with the sharer's name and a **View** action, plus a short sound cue. An optional desktop notification covers members who have the browser in the background.
- **Ping graph.** Connection info now shows a Discord-style graph of the last five minutes of latency, with current, minimum, average and maximum values.
- **Background microphone.** Browsers cannot capture push-to-talk keys when another application has focus. The new personal setting keeps the microphone open when the tab is in the background; without it, push-to-talk is safely released when the tab is hidden.
- **AFK room.** Administrators choose an AFK voice room and timeout in **ACP → Flarum Social → Voice**. Inactive members are moved to that room with microphone and sound disabled and can return to their previous room from the notification.
- **Room ordering.** The ACP room manager now has up/down controls for rooms and categories, so sort values no longer need to be edited by hand.
- **Readable LiveKit names.** Rooms appear in the LiveKit dashboard as `Genel Sohbet 1 (#1)` instead of `social-room-1`. Existing `social-room-*` webhook names continue to work.

## Upgrade

```bash
composer update cengizkemec/flarum-social
php flarum cache:clear
php flarum assets:publish
```

No database migrations are required. The AFK room is disabled until a voice room is selected in the ACP.

## Author

Created by [Cengiz Kemec](https://cengizkemec.com.tr/).

## License

MIT.
