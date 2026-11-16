<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\Story;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\PostPresenter;
use CengizKemec\Social\Support\RoomPresenter;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\UserPresenter;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class ExploreController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected UserPresenter $users,
        protected PostPresenter $posts,
        protected RoomPresenter $rooms,
        protected \CengizKemec\Social\Media\MediaManager $mediaManager
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->access->canViewCommunity($this->actor($request))) {
            return $this->forbidden('community_forbidden');
        }

        return $this->routeName($request) === 'social.search'
            ? $this->search($request)
            : $this->explore($request);
    }

    protected function explore(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);

        $postQuery = Post::query()->whereNull('deleted_at');
        $this->access->scopePosts($postQuery, $actor);

        $recent = (clone $postQuery)->orderByDesc('created_at')->limit(200)->get();
        $hashtags = [];

        foreach ($recent as $post) {
            foreach ($post->hashtags ?? [] as $tag) {
                $hashtags[$tag] = ($hashtags[$tag] ?? 0) + 1;
            }
        }

        arsort($hashtags);
        $trending = collect($hashtags)->take(12)->map(fn ($count, $tag) => ['tag' => $tag, 'count' => $count])->values()->all();

        $topCreators = (clone $postQuery)
            ->select('user_id')
            ->selectRaw('COUNT(*) as post_count')
            ->groupBy('user_id')
            ->orderByDesc('post_count')
            ->limit(8)
            ->get()
            ->map(function ($row) {
                $user = User::query()->find($row->user_id);

                return $user ? array_merge($this->users->basic($user), ['postsCount' => (int) $row->post_count]) : null;
            })
            ->filter()
            ->values()
            ->all();

        $rooms = Room::query()
            ->where('status', 'active')
            ->orderByDesc('participant_count')
            ->limit(8)
            ->get()
            ->filter(fn (Room $room) => $this->access->canViewRoom($room, $actor))
            ->map(fn (Room $room) => $this->rooms->present($room, $actor))
            ->values()
            ->all();

        $recentMedia = Media::query()
            ->where('status', 'active')
            ->where('visibility', 'public')
            ->orderByDesc('created_at')
            ->limit(12)
            ->get()
            ->map(fn (Media $item) => $this->mediaManager->present($item))
            ->all();

        return $this->json([
            'data' => [
                'trendingHashtags' => $trending,
                'topCreators' => $topCreators,
                'activeRooms' => $rooms,
                'recentMedia' => $recentMedia,
                'stats' => [
                    'posts' => (clone $postQuery)->count(),
                    'members' => User::query()->where('is_email_confirmed', true)->count(),
                    'activeStories' => Story::query()->where('expires_at', '>', \Illuminate\Support\now())->count(),
                ],
            ],
        ]);
    }

    protected function search(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);

        if (! $this->settings->bool('search_enabled')) {
            return $this->json(['data' => ['posts' => [], 'users' => [], 'rooms' => []]]);
        }

        $q = trim((string) ($request->getQueryParams()['q'] ?? ''));

        if (mb_strlen($q) < 2) {
            return $this->json(['data' => ['posts' => [], 'users' => [], 'rooms' => []]]);
        }

        $escaped = addcslashes(mb_substr($q, 0, 100), '%_\\');

        $postQuery = Post::query()->with('user')->whereNull('deleted_at');
        $this->access->scopePosts($postQuery, $actor);
        $postQuery->where(function ($query) use ($escaped) {
            $query->where('body', 'like', '%'.$escaped.'%')
                ->orWhere('hashtags', 'like', '%'.mb_strtolower($escaped).'%');
        });
        $posts = $postQuery->orderByDesc('created_at')->limit(10)->get();

        $users = User::query()
            ->where('username', 'like', '%'.$escaped.'%')
            ->where('is_email_confirmed', true)
            ->limit(10)
            ->get()
            ->map(fn (User $user) => $this->users->basic($user))
            ->all();

        $rooms = Room::query()
            ->where('status', 'active')
            ->where('name', 'like', '%'.$escaped.'%')
            ->limit(10)
            ->get()
            ->filter(fn (Room $room) => $this->access->canViewRoom($room, $actor))
            ->map(fn (Room $room) => $this->rooms->present($room, $actor))
            ->values()
            ->all();

        return $this->json([
            'data' => [
                'posts' => $this->posts->presentMany($posts, $actor),
                'users' => $users,
                'rooms' => $rooms,
            ],
        ]);
    }
}
