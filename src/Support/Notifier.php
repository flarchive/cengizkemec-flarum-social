<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\SocialNotification;
use Flarum\User\User;

class Notifier
{
    public const TYPES = [
        'comment' => 'notify_comment',
        'reaction' => 'notify_reaction',
        'mention' => 'notify_mention',
        'follow' => 'notify_follow',
        'friend' => 'notify_friend',
        'invite' => 'notify_invite',
        'moderation' => 'notify_moderation',
        'message' => 'notify_message',
    ];

    public function __construct(protected SocialSettings $settings)
    {
    }

    public function notify(
        User $recipient,
        string $type,
        ?User $actor,
        string $subjectType,
        int $subjectId,
        array $data = []
    ): ?SocialNotification {
        if ($recipient->isGuest()) {
            return null;
        }

        if ($actor !== null && $actor->id === $recipient->id) {
            return null;
        }

        $settingKey = self::TYPES[$type] ?? null;

        if ($settingKey !== null && ! $this->settings->bool($settingKey)) {
            return null;
        }

        $notification = new SocialNotification();
        $notification->user_id = $recipient->id;
        $notification->actor_id = $actor?->id;
        $notification->type = $type;
        $notification->subject_type = $subjectType;
        $notification->subject_id = $subjectId;
        $notification->data = $data;
        $notification->created_at = \Illuminate\Support\now();
        $notification->save();

        return $notification;
    }

    public function unreadCount(User $actor): int
    {
        if ($actor->isGuest()) {
            return 0;
        }

        return SocialNotification::query()
            ->where('user_id', $actor->id)
            ->whereNull('read_at')
            ->count();
    }
}
