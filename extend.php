<?php

use CengizKemec\Social\Api\Controller;
use CengizKemec\Social\Console\CleanupCommand;
use CengizKemec\Social\Console\PurgeRoomsCommand;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Extend;
use Flarum\Extend\Conditional;

$settings = new Extend\Settings();

foreach (SocialSettings::DEFAULTS as $key => $value) {
    $settings->default(SocialSettings::PREFIX.$key, $value);
}

$settings
    ->serializeToForum('socialEnabled', SocialSettings::PREFIX.'enabled', fn ($value) => $value === null || $value === '' ? true : filter_var($value, FILTER_VALIDATE_BOOLEAN))
    ->serializeToForum('socialNavigation', SocialSettings::PREFIX.'navigation', fn ($value) => $value === null || $value === '' ? true : filter_var($value, FILTER_VALIDATE_BOOLEAN))
    ->serializeToForum('socialNavPosition', SocialSettings::PREFIX.'nav_position')
    ->serializeToForum('socialForumVoiceWidget', SocialSettings::PREFIX.'forum_voice_widget', fn ($value) => $value === null || $value === '' ? true : filter_var($value, FILTER_VALIDATE_BOOLEAN))
    ->serializeToForum('socialForumMenu', SocialSettings::PREFIX.'forum_social_menu', fn ($value) => $value === null || $value === '' ? true : filter_var($value, FILTER_VALIDATE_BOOLEAN))
    ->serializeToForum('socialForumCategories', SocialSettings::PREFIX.'forum_categories_in_social', fn ($value) => $value === null || $value === '' ? true : filter_var($value, FILTER_VALIDATE_BOOLEAN))
    ->serializeToForum('socialVoiceEnabled', SocialSettings::PREFIX.'enable_voice', fn ($value) => $value === null || $value === '' ? true : filter_var($value, FILTER_VALIDATE_BOOLEAN))
    ->serializeToForum('socialAccentColor', SocialSettings::PREFIX.'accent_color')
    ->serializeToForum('socialCustomCss', SocialSettings::PREFIX.'custom_css');

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->jsDirectory(__DIR__.'/js/dist/forum')
        ->css(__DIR__.'/less/forum.less')
        ->route('/social', 'social.index')
        ->route('/social/explore', 'social.explore')
        ->route('/social/feed', 'social.feed')
        ->route('/social/media', 'social.media')
        ->route('/social/rooms', 'social.rooms')
        ->route('/social/rooms/{id}', 'social.room')
        ->route('/social/messages', 'social.messages')
        ->route('/social/messages/{id}', 'social.messages.conversation')
        ->route('/social/notifications', 'social.notifications')
        ->route('/social/bookmarks', 'social.bookmarks')
        ->route('/social/profile/{username}', 'social.profile')
        ->route('/social/post/{id}', 'social.post')
        ->route('/social/channels/{id}', 'social.channel'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    // Turn shared YouTube and X/Twitter links into embeds using the same s9e
    // TextFormatter instance as Flarum core. If another media-embed extension
    // is installed, adding an already configured site is harmless.
    (new Extend\Formatter())->configure(function (\s9e\TextFormatter\Configurator $configurator) {
        foreach (['youtube', 'twitter'] as $site) {
            try {
                $configurator->MediaEmbed->add($site);
            } catch (\Throwable $e) {
                // Keep formatting available even when a site definition is
                // missing in an older s9e release.
            }
        }
    }),

    (new Extend\ServiceProvider())->register(\CengizKemec\Social\LocaleServiceProvider::class),

    (new Extend\Csrf())->exemptRoute('social.voice.webhook'),

    $settings,

    (new Extend\Console())
        ->command(CleanupCommand::class)
        ->command(PurgeRoomsCommand::class)
        ->schedule(CleanupCommand::class, function ($event) {
            $event->hourly()->withoutOverlapping();
        })
        ->schedule(PurgeRoomsCommand::class, function ($event) {
            $event->everyMinute()->withoutOverlapping();
        }),

    (new Extend\Routes('api'))
        ->get('/social/bootstrap', 'social.bootstrap', Controller\BootstrapController::class)
        ->get('/social/feed', 'social.feed', Controller\FeedController::class)

        ->post('/social/posts', 'social.posts.create', Controller\PostController::class)
        ->get('/social/posts/{id}', 'social.posts.show', Controller\PostController::class)
        ->patch('/social/posts/{id}', 'social.posts.update', Controller\PostController::class)
        ->delete('/social/posts/{id}', 'social.posts.delete', Controller\PostController::class)
        ->post('/social/posts/{id}/pin', 'social.posts.pin', Controller\PostController::class)
        ->post('/social/posts/{id}/react', 'social.posts.react', Controller\ReactionController::class)
        ->post('/social/posts/{id}/bookmark', 'social.posts.bookmark', Controller\BookmarkController::class)
        ->post('/social/posts/{id}/report', 'social.reports.post', Controller\ReportController::class)

        ->get('/social/posts/{id}/comments', 'social.comments.index', Controller\CommentController::class)
        ->post('/social/posts/{id}/comments', 'social.comments.create', Controller\CommentController::class)
        ->patch('/social/comments/{id}', 'social.comments.update', Controller\CommentController::class)
        ->delete('/social/comments/{id}', 'social.comments.delete', Controller\CommentController::class)
        ->post('/social/comments/{id}/react', 'social.comments.react', Controller\ReactionController::class)
        ->post('/social/comments/{id}/report', 'social.reports.comment', Controller\ReportController::class)

        ->get('/social/media', 'social.media.index', Controller\MediaController::class)
        ->post('/social/media', 'social.media.upload', Controller\MediaController::class)
        ->get('/social/media/{id}/file', 'social.media.file', Controller\MediaController::class)
        ->delete('/social/media/{id}', 'social.media.delete', Controller\MediaController::class)
        ->post('/social/media/{id}/report', 'social.reports.media', Controller\ReportController::class)

        ->post('/social/presence/janitor', 'social.presence.janitor', Controller\RoomController::class)
        ->get('/social/rooms', 'social.rooms.index', Controller\RoomController::class)
        ->post('/social/rooms', 'social.rooms.create', Controller\RoomController::class)
        ->get('/social/rooms/{id}', 'social.rooms.show', Controller\RoomController::class)
        ->get('/social/invites/{token}', 'social.invites.show', Controller\RoomController::class)
        ->patch('/social/rooms/{id}', 'social.rooms.update', Controller\RoomController::class)
        ->delete('/social/rooms/{id}', 'social.rooms.delete', Controller\RoomController::class)
        ->post('/social/rooms/{id}/{action}', 'social.rooms.action', Controller\RoomController::class)

        ->get('/social/channels/{id}/messages', 'social.channels.messages', Controller\ChannelController::class)
        ->post('/social/channels/{id}/messages', 'social.channels.send', Controller\ChannelController::class)
        ->post('/social/channels/{id}/read', 'social.channels.read', Controller\ChannelController::class)
        ->post('/social/channels/{id}/typing', 'social.channels.typing', Controller\ChannelController::class)
        ->patch('/social/messages/{id}', 'social.messages.update', Controller\ChannelController::class)
        ->delete('/social/messages/{id}', 'social.messages.delete', Controller\ChannelController::class)
        ->post('/social/messages/{id}/report', 'social.reports.message', Controller\ReportController::class)

        ->get('/social/dm/conversations', 'social.dm.conversations.index', Controller\DirectMessageController::class)
        ->post('/social/dm/conversations', 'social.dm.conversations.create', Controller\DirectMessageController::class)
        ->get('/social/dm/conversations/{id}/messages', 'social.dm.messages.index', Controller\DirectMessageController::class)
        ->post('/social/dm/conversations/{id}/messages', 'social.dm.messages.send', Controller\DirectMessageController::class)
        ->post('/social/dm/conversations/{id}/read', 'social.dm.read', Controller\DirectMessageController::class)
        ->patch('/social/dm/messages/{id}', 'social.dm.messages.update', Controller\DirectMessageController::class)
        ->delete('/social/dm/messages/{id}', 'social.dm.messages.delete', Controller\DirectMessageController::class)

        ->get('/social/notifications', 'social.notifications.index', Controller\NotificationController::class)
        ->post('/social/notifications/read', 'social.notifications.read', Controller\NotificationController::class)
        ->get('/social/bookmarks', 'social.bookmarks.index', Controller\BookmarkController::class)

        ->get('/social/stories', 'social.stories.index', Controller\StoryController::class)
        ->post('/social/stories', 'social.stories.create', Controller\StoryController::class)
        ->get('/social/stories/{id}/views', 'social.stories.views', Controller\StoryController::class)
        ->post('/social/stories/{id}/view', 'social.stories.view', Controller\StoryController::class)
        ->delete('/social/stories/{id}', 'social.stories.delete', Controller\StoryController::class)

        ->get('/social/profile/{username}', 'social.profile.show', Controller\ProfileController::class)
        ->patch('/social/me/profile', 'social.profile.update', Controller\ProfileController::class)
        ->post('/social/profile/{username}/follow', 'social.profile.follow', Controller\ProfileController::class)
        ->delete('/social/profile/{username}/follow', 'social.profile.unfollow', Controller\ProfileController::class)
        ->get('/social/profile/{username}/followers', 'social.profile.followers', Controller\ProfileController::class)
        ->get('/social/profile/{username}/following', 'social.profile.following', Controller\ProfileController::class)

        ->get('/social/explore', 'social.explore', Controller\ExploreController::class)
        ->get('/social/search', 'social.search', Controller\ExploreController::class)

        ->get('/social/friends', 'social.friends.index', Controller\FriendshipController::class)
        ->post('/social/friends/{id}', 'social.friends.request', Controller\FriendshipController::class)
        ->post('/social/friends/{id}/accept', 'social.friends.accept', Controller\FriendshipController::class)
        ->post('/social/friends/{id}/decline', 'social.friends.decline', Controller\FriendshipController::class)
        ->delete('/social/friends/{id}', 'social.friends.remove', Controller\FriendshipController::class)
        ->post('/social/friends/{id}/block', 'social.friends.block', Controller\FriendshipController::class)
        ->delete('/social/friends/{id}/block', 'social.friends.unblock', Controller\FriendshipController::class)

        ->post('/social/realtime/token', 'social.realtime.token', Controller\RealtimeController::class)
        ->post('/social/livekit/webhook', 'social.voice.webhook', Controller\LiveKitWebhookController::class)

        ->get('/social/admin/overview', 'social.admin.overview', Controller\AdminController::class)
        ->get('/social/admin/reports', 'social.admin.reports.index', Controller\AdminController::class)
        ->post('/social/admin/reports/{id}/resolve', 'social.admin.reports.resolve', Controller\AdminController::class)
        ->post('/social/admin/cleanup', 'social.admin.cleanup.run', Controller\AdminController::class)
        ->get('/social/admin/cleanup/logs', 'social.admin.cleanup.logs', Controller\AdminController::class)
        ->get('/social/admin/moderation/logs', 'social.admin.moderation.logs', Controller\AdminController::class)
        ->post('/social/admin/users/{id}/restrict', 'social.admin.users.restrict', Controller\AdminController::class)

        ->get('/social/admin/rooms', 'social.admin.rooms.index', Controller\AdminRoomController::class)
        ->post('/social/admin/rooms', 'social.admin.rooms.create', Controller\AdminRoomController::class)
        ->patch('/social/admin/rooms/{id}', 'social.admin.rooms.update', Controller\AdminRoomController::class)
        ->delete('/social/admin/rooms/{id}', 'social.admin.rooms.delete', Controller\AdminRoomController::class)
        ->post('/social/admin/categories', 'social.admin.categories.create', Controller\AdminRoomController::class)
        ->patch('/social/admin/categories/{id}', 'social.admin.categories.update', Controller\AdminRoomController::class)
        ->delete('/social/admin/categories/{id}', 'social.admin.categories.delete', Controller\AdminRoomController::class)
        ->post('/social/admin/channels', 'social.admin.channels.create', Controller\AdminRoomController::class)
        ->patch('/social/admin/channels/{id}', 'social.admin.channels.update', Controller\AdminRoomController::class)
        ->delete('/social/admin/channels/{id}', 'social.admin.channels.delete', Controller\AdminRoomController::class),

    (new Conditional())->whenExtensionEnabled('flarum-audit', function () {
        return [
            (new \Flarum\Audit\Extend\Audit())
                ->register(
                    'social.post.created',
                    'social.post.updated',
                    'social.post.deleted',
                    'social.post.pinned',
                    'social.comment.created',
                    'social.comment.updated',
                    'social.comment.deleted',
                    'social.media.uploaded',
                    'social.media.deleted',
                    'social.room.created',
                    'social.room.updated',
                    'social.room.deleted',
                    'social.room.member_invited',
                    'social.room.member_moderated',
                    'social.room.moderator_changed',
                    'social.room.closed',
                    'social.room.reopened',
                    'social.room.transferred',
                    'social.room.invite_link_created',
                    'social.room.invite_link_revoked',
                    'social.room.invite_redeemed',
                    'social.report.created',
                    'social.report.resolved',
                    'social.profile.updated',
                    'social.follow.created',
                    'social.follow.deleted',
                    'social.story.created',
                    'social.story.deleted',
                    'social.channel.message_sent',
                    'social.channel.message_updated',
                    'social.channel.message_deleted',
                    'social.dm.message_sent',
                    'social.dm.message_deleted',
                    'social.friend.requested',
                    'social.friend.accepted',
                    'social.friend.declined',
                    'social.friend.removed',
                    'social.friend.blocked',
                    'social.friend.unblocked'
                ),
        ];
    }),
];
