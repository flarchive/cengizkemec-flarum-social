<?php

use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $db = $schema->getConnection();
        $now = date('Y-m-d H:i:s');

        $memberPermissions = [
            'social.view',
            'social.viewPublicPosts',
            'social.viewMemberPosts',
            'social.viewMedia',
            'social.createPost',
            'social.comment',
            'social.react',
            'social.bookmark',
            'social.follow',
            'social.uploadMedia',
            'social.deleteOwnMedia',
            'social.createStory',
            'social.useText',
            'social.useVoice',
            'social.sendMessage',
            'social.sendDirectMessage',
            'social.createRoom',
            'social.joinRoom',
            'social.createPrivateRoom',
            'social.createTextChannel',
            'social.shareScreen',
            'social.friendRequest',
        ];

        $moderatorPermissions = array_merge($memberPermissions, [
            'social.moderatePosts',
            'social.moderateMedia',
            'social.moderateReports',
            'social.moderateVoice',
            'social.manageRooms',
            'social.manageAllRooms',
            'social.viewModerationLogs',
        ]);

        $guestPermissions = [
            'social.view',
            'social.viewPublicPosts',
            'social.viewMedia',
        ];

        $rows = [];

        foreach ([2 => $guestPermissions, 3 => $memberPermissions, 4 => $moderatorPermissions] as $groupId => $permissions) {
            foreach ($permissions as $permission) {
                $rows[] = ['group_id' => $groupId, 'permission' => $permission];
            }
        }

        $db->table('group_permission')->insertOrIgnore($rows);

        if ($db->table('social_room_categories')->count() > 0) {
            return;
        }

        $categories = [
            [
                'name' => 'WAR THUNDER',
                'icon' => 'fas fa-jet-fighter',
                'description' => 'Squadrons, training and events.',
                'sort_order' => 10,
            ],
            [
                'name' => 'COMMUNITY',
                'icon' => 'fas fa-comments',
                'description' => 'General chat, support and the social lounge.',
                'sort_order' => 20,
            ],
            [
                'name' => 'STAFF',
                'icon' => 'fas fa-shield-halved',
                'description' => 'Private staff and moderation rooms.',
                'sort_order' => 30,
            ],
        ];

        $categoryIds = [];

        foreach ($categories as $category) {
            $categoryIds[$category['name']] = $db->table('social_room_categories')->insertGetId(array_merge($category, [
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }

        $rooms = [
            ['WAR THUNDER', 'General', 'Hang out with the squadron.', 'fas fa-headset', 'public', 30, 10],
            ['WAR THUNDER', 'Squadron', 'Squadron coordination and sorties.', 'fas fa-plane', 'members', 20, 20],
            ['WAR THUNDER', 'Training', 'Training flights and workshops.', 'fas fa-graduation-cap', 'members', 20, 30],
            ['WAR THUNDER', 'Event', 'Event voice stage.', 'fas fa-calendar-star', 'members', 60, 40],
            ['COMMUNITY', 'General Chat', 'The main community voice room.', 'fas fa-comments', 'public', 60, 50],
            ['COMMUNITY', 'Support', 'Get help from the community team.', 'fas fa-life-ring', 'members', 15, 60],
            ['COMMUNITY', 'Social Lounge', 'Music, chill and late-night talks.', 'fas fa-mug-hot', 'public', 40, 70],
            ['STAFF', 'Administration', 'Private administration room.', 'fas fa-user-shield', 'staff', 10, 80],
            ['STAFF', 'Moderators', 'Moderator coordination.', 'fas fa-gavel', 'staff', 15, 90],
            ['STAFF', 'Private Meetings', 'Confidential staff meetings.', 'fas fa-lock', 'staff', 10, 100],
        ];

        foreach ($rooms as [$category, $name, $description, $icon, $visibility, $capacity, $sort]) {
            $roomId = $db->table('social_rooms')->insertGetId([
                'category_id' => $categoryIds[$category],
                'owner_id' => null,
                'type' => 'permanent',
                'name' => $name,
                'description' => $description,
                'icon' => $icon,
                'visibility' => $visibility,
                'capacity' => $capacity,
                'is_voice' => true,
                'is_text' => true,
                'force_muted' => true,
                'allowed_groups' => $visibility === 'staff' ? json_encode([1, 4]) : null,
                'sort_order' => $sort,
                'status' => 'active',
                'last_activity_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $db->table('social_text_channels')->insert([
                'room_id' => $roomId,
                'name' => 'general',
                'description' => $name.' text chat',
                'visibility' => $visibility === 'public' ? 'public' : 'members',
                'position' => 0,
                'is_default' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $channels = [
            ['general', 'General discussion for the whole community.', 'public', 10],
            ['support', 'Ask questions and get help.', 'members', 20],
            ['social-lounge', 'Off-topic conversation and fun.', 'members', 30],
        ];

        foreach ($channels as [$name, $description, $visibility, $position]) {
            $db->table('social_text_channels')->insert([
                'room_id' => null,
                'name' => $name,
                'description' => $description,
                'visibility' => $visibility,
                'position' => $position,
                'is_default' => $name === 'general',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    },
    'down' => function (Builder $schema) {
        $db = $schema->getConnection();
        $db->table('group_permission')->where('permission', 'like', 'social.%')->delete();
    },
];
