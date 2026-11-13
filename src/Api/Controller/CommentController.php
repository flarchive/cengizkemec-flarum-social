<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Realtime\Centrifugo;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\CommentPresenter;
use CengizKemec\Social\Support\ContentParser;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\RateLimit;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class CommentController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected CommentPresenter $presenter,
        protected MediaManager $media,
        protected ContentParser $parser,
        protected Notifier $notifier,
        protected RateLimit $rateLimit,
        protected Centrifugo $realtime
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        return match ($this->routeName($request)) {
            'social.comments.index' => $this->index($request),
            'social.comments.create' => $this->create($request),
            'social.comments.update' => $this->update($request),
            'social.comments.delete' => $this->delete($request),
            default => $this->notFound(),
        };
    }

    protected function index(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $post = Post::query()->find((int) $this->routeParam($request, 'id'));

        if (! $post || $post->deleted_at !== null) {
            return $this->notFound('post_not_found');
        }

        if (! $this->access->canViewPost($post, $actor)) {
            return $this->forbidden('post_forbidden');
        }

        [$offset, $limit] = $this->pagination($request, 30, 100);
        $query = Comment::query()
            ->with('user')
            ->where('post_id', $post->id)
            ->whereNull('deleted_at')
            ->orderBy('id');
        $total = (clone $query)->count();
        $comments = $query->skip($offset)->take($limit)->get();

        return $this->json([
            'data' => $this->presenter->presentMany($comments, $actor),
            'meta' => [
                'total' => $total,
                'offset' => $offset,
                'limit' => $limit,
                'hasMore' => $offset + $comments->count() < $total,
            ],
        ]);
    }

    protected function create(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $actor->assertCan('social.comment');

        if (! $this->access->canComment($actor)) {
            throw new PermissionDeniedException();
        }

        $post = Post::query()->with('user')->find((int) $this->routeParam($request, 'id'));

        if (! $post || $post->deleted_at !== null) {
            return $this->notFound('post_not_found');
        }

        if (! $this->access->canViewPost($post, $actor)) {
            return $this->forbidden('post_forbidden');
        }

        $body = $this->body($request);
        $text = $this->cleanString($body['body'] ?? '', 2000);
        $mediaIds = $this->intArray($body['media_ids'] ?? []);

        if ($text === '' && empty($mediaIds)) {
            $this->validationError('comment_empty');
        }

        if ($this->settings->int('max_post_length') > 0 && mb_strlen($text) > 2000) {
            $this->validationError('comment_too_long');
        }

        $parentId = isset($body['parent_id']) ? (int) $body['parent_id'] : null;

        if ($parentId !== null) {
            if (! $this->settings->bool('allow_replies')) {
                throw new PermissionDeniedException();
            }

            $parent = Comment::query()->where('post_id', $post->id)->whereNull('deleted_at')->find($parentId);

            if (! $parent) {
                $this->validationError('invalid_parent');
            }
        }

        $this->rateLimit->assertComments($actor);

        $comment = new Comment();
        $comment->post_id = $post->id;
        $comment->parent_id = $parentId;
        $comment->user_id = $actor->id;
        $comment->body = $text;
        $comment->created_at = \Illuminate\Support\now();
        $comment->updated_at = \Illuminate\Support\now();
        $comment->save();

        $this->audit('social.comment.created', [
            'comment_id' => (int) $comment->id,
            'post_id' => (int) $post->id,
            'parent_id' => $parentId,
        ]);

        $post->comments_count = Comment::query()->where('post_id', $post->id)->whereNull('deleted_at')->count();
        $post->updated_at = \Illuminate\Support\now();
        $post->save();

        if (! empty($mediaIds)) {
            $this->media->attachIds($mediaIds, $actor, 'comment', $comment->id, $post->visibility, $this->settings->int('max_attachments'));
        }

        $comment->load('user');
        $presented = $this->presenter->presentMany(collect([$comment]), $actor)[0];

        $data = [
            'excerpt' => $this->parser->excerpt($text),
            'post_id' => $post->id,
            'comment_id' => $comment->id,
        ];

        $this->notifier->notify($post->user, 'comment', $actor, 'post', $post->id, $data);

        if ($parentId) {
            $parent = Comment::query()->find($parentId);
            if ($parent) {
                $this->notifier->notify($parent->user, 'comment', $actor, 'comment', $parent->id, $data);
            }
        }

        if ($this->settings->bool('allow_mentions') && $text !== '') {
            $this->parser->notifyMentions($text, $actor, 'comment', $comment->id, $data);
        }

        $this->realtime->publish('social:post:'.$post->id, [
            'type' => 'comment.created',
            'comment' => $presented,
            'post_id' => $post->id,
        ]);

        return $this->json(['data' => $presented, 'post' => ['commentsCount' => $post->comments_count]], 201);
    }

    protected function update(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $comment = Comment::query()->with('user')->find((int) $this->routeParam($request, 'id'));

        if (! $comment || $comment->deleted_at !== null) {
            return $this->notFound('comment_not_found');
        }

        if ((int) $comment->user_id !== (int) $actor->id) {
            throw new PermissionDeniedException();
        }

        if (! $this->settings->bool('allow_edit')) {
            throw new PermissionDeniedException();
        }

        $window = max(1, $this->settings->int('edit_window_minutes'));

        if ($comment->created_at && $comment->created_at->lt(\Illuminate\Support\now()->subMinutes($window))) {
            return $this->forbidden('edit_window_expired');
        }

        $body = $this->body($request);
        $text = $this->cleanString($body['body'] ?? $comment->body, 2000);

        if ($text === '') {
            $this->validationError('comment_empty');
        }

        $comment->body = $text;
        $comment->edited_at = \Illuminate\Support\now();
        $comment->updated_at = \Illuminate\Support\now();
        $comment->save();

        $this->audit('social.comment.updated', ['comment_id' => (int) $comment->id]);

        return $this->json([
            'data' => $this->presenter->presentMany(collect([$comment]), $actor)[0],
        ]);
    }

    protected function delete(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $comment = Comment::query()->find((int) $this->routeParam($request, 'id'));

        if (! $comment || $comment->deleted_at !== null) {
            return $this->notFound('comment_not_found');
        }

        $isOwner = (int) $comment->user_id === (int) $actor->id;
        $staff = $this->access->isStaff($actor) || $actor->can('social.moderatePosts');

        if (! $isOwner && ! $staff) {
            throw new PermissionDeniedException();
        }

        $comment->deleted_at = \Illuminate\Support\now();
        $comment->updated_at = \Illuminate\Support\now();
        $comment->save();

        $this->audit('social.comment.deleted', [
            'comment_id' => (int) $comment->id,
            'by_staff' => (bool) $staff,
        ]);

        $this->media->detach('comment', $comment->id);

        $post = Post::query()->find($comment->post_id);

        if ($post) {
            $post->comments_count = Comment::query()->where('post_id', $post->id)->whereNull('deleted_at')->count();
            $post->updated_at = \Illuminate\Support\now();
            $post->save();
        }

        $this->realtime->publish('social:post:'.$comment->post_id, [
            'type' => 'comment.deleted',
            'comment_id' => $comment->id,
            'post_id' => $comment->post_id,
        ]);

        return $this->json([
            'data' => ['id' => (int) $comment->id, 'deleted' => true],
            'post' => ['commentsCount' => $post?->comments_count ?? 0],
        ]);
    }
}
