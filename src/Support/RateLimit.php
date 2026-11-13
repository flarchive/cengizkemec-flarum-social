<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\DirectMessage;
use CengizKemec\Social\Models\Message;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Room;
use Flarum\User\User;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;

/**
 * Lightweight spam protection backed by the database. No unsafe client trust.
 */
class RateLimit
{
    public function __construct(protected TranslatorInterface $translator)
    {
    }

    public function assertPosts(User $actor): void
    {
        $this->assertRecentCount(Post::query()->where('user_id', $actor->id), 5, 60, 'post');
    }

    public function assertComments(User $actor): void
    {
        $this->assertRecentCount(Comment::query()->where('user_id', $actor->id), 10, 60, 'comment');
    }

    public function assertMessages(User $actor): void
    {
        $this->assertRecentCount(Message::query()->where('user_id', $actor->id), 20, 60, 'message');
    }

    public function assertDirectMessages(User $actor, int $maxPerMinute): void
    {
        $this->assertRecentCount(
            DirectMessage::query()->where('user_id', $actor->id),
            max(2, $maxPerMinute),
            60,
            'direct_message'
        );
    }

    public function assertRoomCreation(User $actor, int $cooldownSeconds): void
    {
        $last = Room::query()->where('owner_id', $actor->id)->latest('created_at')->first();

        if ($last && $last->created_at && $last->created_at->gt(\Illuminate\Support\now()->subSeconds($cooldownSeconds))) {
            throw new ValidationException([
                'room' => $this->translator->trans('cengizkemec-social.api.errors.room_cooldown', [
                    'seconds' => $cooldownSeconds,
                ]),
            ]);
        }
    }

    protected function assertRecentCount($query, int $max, int $seconds, string $key): void
    {
        if ($query->where('created_at', '>', \Illuminate\Support\now()->subSeconds($seconds))->count() >= $max) {
            throw new ValidationException([
                $key => $this->translator->trans('cengizkemec-social.api.errors.rate_limited'),
            ]);
        }
    }
}
