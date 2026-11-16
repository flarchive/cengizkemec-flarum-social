<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Bookmark;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\PostPresenter;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class BookmarkController extends AbstractSocialController
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
        if ($this->routeName($request) === 'social.bookmarks.index') {
            return $this->index($request);
        }

        $actor = $this->actor($request);
        $actor->assertRegistered();

        if (! $this->access->canBookmark($actor)) {
            throw new PermissionDeniedException();
        }

        $post = Post::query()->find((int) $this->routeParam($request, 'id'));

        if (! $post || $post->deleted_at !== null || ! $this->access->canViewPost($post, $actor)) {
            return $this->notFound('post_not_found');
        }

        $bookmark = Bookmark::query()
            ->where('user_id', $actor->id)
            ->where('post_id', $post->id)
            ->first();

        if ($bookmark) {
            $bookmark->delete();
            $bookmarked = false;
        } else {
            $bookmark = new Bookmark();
            $bookmark->user_id = $actor->id;
            $bookmark->post_id = $post->id;
            $bookmark->created_at = \Illuminate\Support\now();
            $bookmark->save();
            $bookmarked = true;
        }

        return $this->json(['data' => ['postId' => (int) $post->id, 'bookmarked' => $bookmarked]]);
    }

    protected function index(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        [$offset, $limit] = $this->pagination($request, 20, 50);

        $query = Post::query()
            ->with('user')
            ->whereNull('deleted_at')
            ->whereIn('id', Bookmark::query()->where('user_id', $actor->id)->select('post_id'))
            ->orderByDesc('created_at');
        $this->access->scopePosts($query, $actor);

        $total = (clone $query)->count();
        $posts = $query->skip($offset)->take($limit)->get();

        return $this->json([
            'data' => $this->presenter->presentMany($posts, $actor),
            'meta' => [
                'total' => $total,
                'offset' => $offset,
                'limit' => $limit,
                'hasMore' => $offset + $posts->count() < $total,
            ],
        ]);
    }
}
