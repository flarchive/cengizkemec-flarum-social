<?php

namespace CengizKemec\Social\Support;

use Flarum\User\User;
use Illuminate\Support\Collection;

class ContentParser
{
    public function __construct(protected Notifier $notifier)
    {
    }

    public function hashtags(string $body): array
    {
        preg_match_all('/#([\p{L}\p{N}_]{2,50})/u', $body, $matches);

        $tags = array_map(fn ($tag) => mb_strtolower($tag), $matches[1] ?? []);
        $tags = array_values(array_unique($tags));

        return array_slice($tags, 0, 20);
    }

    /**
     * @return Collection<int, User>
     */
    public function mentionedUsers(string $body): Collection
    {
        preg_match_all('/(?<![\w@])@([A-Za-z0-9_.-]{2,30})/u', $body, $matches);
        $usernames = array_values(array_unique($matches[1] ?? []));

        if (empty($usernames)) {
            return collect();
        }

        return User::query()
            ->whereIn('username', $usernames)
            ->limit(10)
            ->get();
    }

    public function notifyMentions(
        string $body,
        User $actor,
        string $subjectType,
        int $subjectId,
        array $data = []
    ): void {
        foreach ($this->mentionedUsers($body) as $user) {
            $this->notifier->notify($user, 'mention', $actor, $subjectType, $subjectId, $data);
        }
    }

    public function excerpt(?string $body, int $length = 140): string
    {
        $body = trim(preg_replace('/\s+/', ' ', (string) $body));

        return mb_strlen($body) > $length ? mb_substr($body, 0, $length - 1).'…' : $body;
    }
}
