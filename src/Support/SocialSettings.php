<?php

namespace CengizKemec\Social\Support;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Typed access to all extension settings, with defaults registered in extend.php.
 */
class SocialSettings
{
    public const PREFIX = 'cengizkemec-social.';

    public const DEFAULTS = [
        'enabled' => true,
        'navigation' => true,
        'enable_feed' => true,
        'enable_voice' => true,
        'enable_text' => true,
        'enable_media' => true,
        'enable_messages' => true,
        'enable_stories' => true,
        'enable_user_rooms' => true,
        'enable_friends' => true,

        'guest_access' => true,
        'guest_require_login_feed' => false,
        'guest_public_posts' => true,
        'guest_public_profiles' => true,
        'guest_public_media' => true,
        'guest_public_community' => true,
        'guest_show_room_names' => true,
        'guest_show_participant_counts' => true,
        'guest_hide_private_rooms' => true,
        'guest_require_login_interactions' => true,
        'accent_color' => '#5865F2',
        'use_flarum_theme' => true,
        'custom_css' => '',
        'aside_order' => 'online,offline,leaderboards,hashtags,voiceRooms,widgets,forumLatest,stats',
        'sidebar' => true,
        'compact' => false,
        'mobile_bottom_nav' => true,
        'avatar_display' => true,
        'participant_display' => true,
        'leaderboard_limit' => 10,
        'nav_position' => 'sidebar',
        'forum_voice_widget' => true,
        'forum_social_menu' => true,
        'forum_categories_in_social' => true,

        'max_post_length' => 5000,
        'allow_comments' => true,
        'allow_replies' => true,
        'allow_reactions' => true,
        'allow_mentions' => true,
        'allow_hashtags' => true,
        'allow_sharing' => true,
        'allow_bookmarks' => true,
        'feed_per_page' => 15,
        'allow_edit' => true,
        'edit_window_minutes' => 30,
        'allow_delete' => true,
        'stories_ttl_hours' => 24,

        'uploads' => true,
        'max_image_mb' => 10,
        'max_video_mb' => 100,
        'max_document_mb' => 20,
        'max_attachments' => 6,
        'max_image_dimension' => 8000,
        'allowed_mimes' => 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf',
        'thumbnail_width' => 640,
        'storage_driver' => 'local',
        's3_key' => '',
        's3_secret' => '',
        's3_region' => '',
        's3_bucket' => '',
        's3_endpoint' => '',
        's3_path_style' => true,
        's3_public_url' => '',
        'user_quota_mb' => 0,

        'cleanup_enabled' => true,
        'image_retention_days' => 180,
        'video_retention_days' => 90,
        'document_retention_days' => 60,
        'story_retention_hours' => 0,
        'temporary_ttl_hours' => 24,
        'orphan_grace_days' => 7,
        'cleanup_batch_size' => 200,

        'livekit_url' => '',
        'livekit_api_key' => '',
        'livekit_api_secret' => '',
        'turn_url' => '',
        'turn_username' => '',
        'turn_credential' => '',
        'default_room_capacity' => 25,
        'max_room_capacity' => 60,
        'default_muted' => true,
        'push_to_talk' => true,
        'ptt_key' => 'AltLeft',
        'noise_suppression' => true,
        'echo_cancellation' => true,
        'auto_gain_control' => true,
        'screen_sharing' => true,
        'max_screen_shares' => 2,
        'voice_reconnect' => true,
        'voice_sounds' => true,

        'allow_user_rooms' => true,
        'user_room_max_per_user' => 3,
        'user_room_max_capacity' => 25,
        'user_room_lifetime_hours' => 12,
        'user_room_max_lifetime_hours' => 72,
        'user_room_empty_expiry_minutes' => 30,
        'temporary_room_empty_seconds' => 10,
        'user_room_cooldown_seconds' => 120,
        'user_room_owner_disconnect' => 'keep',
        'user_room_allow_private' => true,
        'user_room_allow_invites' => true,
        'user_room_allowed_groups' => '',

        'message_max_length' => 2000,
        'message_history_per_page' => 30,
        'message_attachments' => 3,
        'search_enabled' => true,

        'dm_enabled' => true,
        'dm_friend_only' => false,
        'dm_blocking' => true,
        'dm_retention_days' => 0,
        'dm_rate_limit' => 20,
        'dm_allowed_groups' => '',

        'realtime_enabled' => false,
        'centrifugo_url' => '',
        'centrifugo_api_url' => '',
        'centrifugo_api_key' => '',
        'centrifugo_token_hmac_secret' => '',
        'realtime_fallback_seconds' => 15,

        'reports_enabled' => true,
        'auto_hide_report_threshold' => 0,
        'notify_comment' => true,
        'notify_reaction' => true,
        'notify_mention' => true,
        'notify_follow' => true,
        'notify_friend' => true,
        'notify_invite' => true,
        'notify_moderation' => true,
        'notify_message' => true,
    ];

    public function __construct(protected SettingsRepositoryInterface $settings)
    {
    }

    public function get(string $key, mixed $fallback = null): mixed
    {
        $value = $this->settings->get(self::PREFIX.$key);

        if ($value === null || $value === '') {
            if (array_key_exists($key, self::DEFAULTS)) {
                return self::DEFAULTS[$key];
            }

            return $fallback;
        }

        return $value;
    }

    public function bool(string $key): bool
    {
        return filter_var($this->get($key), FILTER_VALIDATE_BOOLEAN);
    }

    public function int(string $key): int
    {
        return (int) $this->get($key);
    }

    public function list(string $key): array
    {
        $value = $this->get($key);

        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || trim($value) === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $value))));
    }

    /**
     * Public configuration safe to expose to the browser.
     */
    public function publicConfig(): array
    {
        return [
            'enabled' => $this->bool('enabled'),
            'guestAccess' => $this->bool('guest_access'),
            'features' => [
                'feed' => $this->bool('enable_feed'),
                'voice' => $this->bool('enable_voice'),
                'text' => $this->bool('enable_text'),
                'media' => $this->bool('enable_media'),
                'messages' => $this->bool('enable_messages'),
                'stories' => $this->bool('enable_stories'),
                'userRooms' => $this->bool('enable_user_rooms'),
                'friends' => $this->bool('enable_friends'),
                'realtime' => $this->bool('realtime_enabled') && $this->get('centrifugo_url') !== '',
                'livekit' => $this->bool('enable_voice') && $this->get('livekit_url') !== '',
            ],
            'appearance' => [
                'accent' => $this->get('accent_color'),
                'useFlarumTheme' => $this->bool('use_flarum_theme'),
                'asideOrder' => $this->get('aside_order'),
                'sidebar' => $this->bool('sidebar'),
                'compact' => $this->bool('compact'),
                'mobileBottomNav' => $this->bool('mobile_bottom_nav'),
                'avatarDisplay' => $this->bool('avatar_display'),
                'navPosition' => $this->get('nav_position'),
            ],
            'guest' => [
                'feedVisible' => ! $this->bool('guest_require_login_feed'),
                'publicPosts' => $this->bool('guest_public_posts'),
                'publicProfiles' => $this->bool('guest_public_profiles'),
                'publicMedia' => $this->bool('guest_public_media'),
                'publicCommunity' => $this->bool('guest_public_community'),
                'showRoomNames' => $this->bool('guest_show_room_names'),
                'showParticipantCounts' => $this->bool('guest_show_participant_counts'),
                'hidePrivateRooms' => $this->bool('guest_hide_private_rooms'),
            ],
            'feed' => [
                'perPage' => max(5, min(50, $this->int('feed_per_page'))),
                'maxLength' => $this->int('max_post_length'),
                'comments' => $this->bool('allow_comments'),
                'reactions' => $this->bool('allow_reactions'),
                'bookmarks' => $this->bool('allow_bookmarks'),
                'stories' => $this->bool('enable_stories'),
            ],
            'media' => [
                'uploads' => $this->bool('uploads'),
                'maxImageMb' => $this->int('max_image_mb'),
                'maxVideoMb' => $this->int('max_video_mb'),
                'maxDocumentMb' => $this->int('max_document_mb'),
                'maxAttachments' => $this->int('max_attachments'),
                'allowedMimes' => $this->list('allowed_mimes'),
            ],
            'voice' => [
                'url' => $this->get('livekit_url'),
                'defaultMuted' => true,
                'pushToTalk' => $this->bool('push_to_talk'),
                'pttKey' => $this->get('ptt_key'),
                'noiseSuppression' => $this->bool('noise_suppression'),
                'echoCancellation' => $this->bool('echo_cancellation'),
                'autoGainControl' => $this->bool('auto_gain_control'),
                'screenSharing' => $this->bool('screen_sharing'),
                'maxScreenShares' => (int) $this->get('max_screen_shares'),
                'reconnect' => $this->bool('voice_reconnect'),
                'sounds' => $this->bool('voice_sounds'),
                'turn' => [
                    'urls' => $this->get('turn_url') ? [$this->get('turn_url')] : [],
                    'username' => $this->get('turn_username'),
                    'credential' => $this->get('turn_credential'),
                ],
            ],
            'realtime' => [
                'enabled' => $this->bool('realtime_enabled') && $this->get('centrifugo_url') !== '',
                'url' => $this->get('centrifugo_url'),
                'fallbackSeconds' => max(5, $this->int('realtime_fallback_seconds')),
            ],
            'limits' => [
                'messageMaxLength' => $this->int('message_max_length'),
                'userRoomMax' => $this->int('user_room_max_per_user'),
                'userRoomCapacity' => $this->int('user_room_max_capacity'),
                'temporaryRoomEmptySeconds' => max(5, $this->int('temporary_room_empty_seconds')),
                'roomCapacity' => $this->int('default_room_capacity'),
                'maxRoomCapacity' => $this->int('max_room_capacity'),
                'userRoomLifetime' => $this->int('user_room_lifetime_hours'),
            ],
            'dm' => [
                'enabled' => $this->bool('dm_enabled'),
                'friendOnly' => $this->bool('dm_friend_only'),
            ],
            'locale' => [
                'default' => 'auto',
                'supported' => ['en', 'tr'],
            ],
        ];
    }
}
