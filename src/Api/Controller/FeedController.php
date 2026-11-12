<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\MediaReference;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\PostPresenter;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Illuminate\Database\Eloquent\Builder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class FeedController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected PostPresenter $presenter
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $queryParams = $request->getQueryParams();
        $filter = (string) ($queryParams['filter'] ?? 'latest');
        $filter = in_array($filter, ['latest', 'popular', 'following', 'media', 'mine', 'announcements'], true) ? $filter : 'latest';

        if ($actor->isGuest() && in_array($filter, ['following', 'mine'], true)) {
            return $this->json([
                'data' => [],
                'meta' => [
                    'total' => 0,
                    'loginRequired' => true,
                    'filter' => $filter,
                ],
            ]);
        }

        if (! $this->access->canViewFeed($actor)) {
            return $this->json([
                'data' => [],
                'meta' => [
                    'total' => 0,
                    'loginRequired' => true,
                    'filter' => $filter,
                ],
            ]);
        }

        $query = Post::query()->with('user');
        $this->access->scopePosts($query, $actor);

        if ($filter === 'mine') {
            $query->where('user_id', $actor->id);
        } elseif ($filter === 'following') {
            $query->where(function (Builder $query) use ($actor) {
                $query->where('user_id', $actor->id)
                    ->orWhereIn('user_id', \CengizKemec\Social\Models\Follow::query()
                        ->where('follower_id', $actor->id)
                        ->select('following_id'));
            });
        } elseif ($filter === 'media') {
            $query->whereIn('id', MediaReference::query()
                ->where('reference_type', 'post')
                ->whereIn('media_id', Media::query()->whereIn('type', ['image', 'video'])->select('id'))
                ->select('reference_id'));
        } elseif ($filter === 'announcements') {
            $query->where('is_announcement', true);
        }

        $search = trim((string) ($queryParams['q'] ?? ''));

        if ($search !== '' && $this->settings->bool('search_enabled')) {
            $search = mb_substr($search, 0, 100);
            $escaped = addcslashes($search, '%_\\');
            $query->where(function (Builder $query) use ($escaped) {
                $query->where('body', 'like', '%'.$escaped.'%')
                    ->orWhere('hashtags', 'like', '%"'.mb_strtolower(ltrim($escaped, '#')).'"%');
            });
        }

        $hashtag = trim((string) ($queryParams['hashtag'] ?? ''));

        if ($hashtag !== '') {
            $hashtag = mb_strtolower(ltrim($hashtag, '#'));
            $query->where('hashtags', 'like', '%"'.addcslashes($hashtag, '%_\\').'"%');
        }

        $username = trim((string) ($queryParams['username'] ?? ''));

        if ($username !== '') {
            $user = \Flarum\User\User::query()->where('username', $username)->first();

            if ($user) {
                $query->where('user_id', $user->id);
            } else {
                return $this->json(['data' => [], 'meta' => ['total' => 0, 'filter' => $filter]]);
            }
        }

        if ($filter === 'popular') {
            $query->orderByRaw('(reactions_count + comments_count) DESC')->orderByDesc('created_at');
        } else {
            $query->orderByDesc('is_pinned')->orderByDesc('created_at');
        }

        [$offset, $limit] = $this->pagination($request, $this->settings->int('feed_per_page'), 50);
        $total = (clone $query)->count();
        $posts = $query->skip($offset)->take($limit)->get();

        return $this->json([
            'data' => $this->presenter->presentMany($posts, $actor),
            'meta' => [
                'total' => $total,
                'offset' => $offset,
                'limit' => $limit,
                'filter' => $filter,
                'hasMore' => $offset + $posts->count() < $total,
            ],
        ]);
    }
}
