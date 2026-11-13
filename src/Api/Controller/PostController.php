<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Realtime\Centrifugo;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\ContentParser;
use CengizKemec\Social\Support\PostPresenter;
use CengizKemec\Social\Support\RateLimit;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class PostController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected PostPresenter $presenter,
        protected MediaManager $media,
        protected ContentParser $parser,
        protected RateLimit $rateLimit,
        protected Centrifugo $realtime
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        return match ($this->routeName($request)) {
            'social.posts.create' => $this->create($request),
            'social.posts.show' => $this->show($request),
            'social.posts.update' => $this->update($request),
            'social.posts.delete' => $this->delete($request),
            'social.posts.pin' => $this->pin($request),
            default => $this->notFound(),
        };
    }

    protected function show(ServerRequestInterface $request): ResponseInterface
    {
        $post = Post::query()->with('user')->find((int) $this->routeParam($request, 'id'));

        if (! $post || $post->deleted_at !== null) {
            return $this->notFound('post_not_found');
        }

        if (! $this->access->canViewPost($post, $this->actor($request))) {
            return $this->forbidden('post_forbidden');
        }

        return $this->json([
            'data' => $this->presenter->presentMany(collect([$post]), $this->actor($request))[0],
        ]);
    }

    protected function create(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $actor->assertCan('social.createPost');

        if (! $this->access->canCreatePosts($actor)) {
            throw new PermissionDeniedException();
        }

        $body = $this->body($request);
        $text = $this->cleanString($body['body'] ?? '', $this->settings->int('max_post_length'));
        $mediaIds = $this->intArray($body['media_ids'] ?? []);

        if ($text === '' && empty($mediaIds)) {
            $this->validationError('post_empty');
        }

        if ($this->settings->int('max_post_length') > 0 && mb_strlen($text) > $this->settings->int('max_post_length')) {
            $this->validationError('post_too_long', ['max' => $this->settings->int('max_post_length')]);
        }

        $this->rateLimit->assertPosts($actor);

        $visibility = $this->visibility($body['visibility'] ?? 'public');

        $post = new Post();
        $post->user_id = $actor->id;
        $post->body = $text;
        $post->visibility = $visibility;
        $post->hashtags = $this->settings->bool('allow_hashtags') ? $this->parser->hashtags($text) : null;
        $post->mentions = $this->settings->bool('allow_mentions')
            ? $this->parser->mentionedUsers($text)->pluck('username')->all()
            : null;
        $post->is_announcement = $actor->can('social.moderatePosts') && ! empty($body['is_announcement']);
        $post->created_at = \Illuminate\Support\now();
        $post->updated_at = \Illuminate\Support\now();
        $post->save();

        $this->audit('social.post.created', [
            'post_id' => (int) $post->id,
            'visibility' => $visibility,
            'has_media' => ! empty($mediaIds),
        ]);

        if (! empty($mediaIds)) {
            $this->media->attachIds($mediaIds, $actor, 'post', $post->id, $visibility, $this->settings->int('max_attachments'));
        }

        $post->load('user');

        if ($this->settings->bool('allow_mentions') && $text !== '') {
            $this->parser->notifyMentions($text, $actor, 'post', $post->id, [
                'excerpt' => $this->parser->excerpt($text),
                'post_id' => $post->id,
            ]);
        }

        $presented = $this->presenter->presentMany(collect([$post]), $actor)[0];

        if ($visibility === 'public') {
            $this->realtime->publish('social:feed', ['type' => 'post.created', 'post' => $presented]);
        }

        return $this->json(['data' => $presented], 201);
    }

    protected function update(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $post = Post::query()->with('user')->find((int) $this->routeParam($request, 'id'));

        if (! $post || $post->deleted_at !== null) {
            return $this->notFound('post_not_found');
        }

        if ((int) $post->user_id !== (int) $actor->id) {
            throw new PermissionDeniedException();
        }

        if (! $this->settings->bool('allow_edit')) {
            throw new PermissionDeniedException();
        }

        $window = max(1, $this->settings->int('edit_window_minutes'));

        if (! $this->access->isStaff($actor) && $post->created_at && $post->created_at->lt(\Illuminate\Support\now()->subMinutes($window))) {
            return $this->forbidden('edit_window_expired');
        }

        $body = $this->body($request);
        $text = $this->cleanString($body['body'] ?? $post->body, $this->settings->int('max_post_length'));
        $existingMedia = $this->media->mediaFor('post', $post->id);
        $mediaProvided = array_key_exists('media_ids', $body);
        $mediaIds = $this->intArray($body['media_ids'] ?? []);

        if ($text === '' && ! $mediaProvided && empty($existingMedia)) {
            $this->validationError('post_empty');
        }

        if ($text === '' && $mediaProvided && empty($mediaIds)) {
            $this->validationError('post_empty');
        }

        $visibility = array_key_exists('visibility', $body) ? $this->visibility($body['visibility']) : $post->visibility;

        $post->body = $text;
        $post->visibility = $visibility;
        $post->hashtags = $this->settings->bool('allow_hashtags') ? $this->parser->hashtags($text) : null;
        $post->mentions = $this->settings->bool('allow_mentions')
            ? $this->parser->mentionedUsers($text)->pluck('username')->all()
            : null;
        $post->edited_at = \Illuminate\Support\now();
        $post->updated_at = \Illuminate\Support\now();
        $post->save();

        $this->audit('social.post.updated', [
            'post_id' => (int) $post->id,
            'visibility' => $visibility,
        ]);

        if ($mediaProvided) {
            $this->media->detach('post', $post->id);

            if (! empty($mediaIds)) {
                $this->media->attachIds($mediaIds, $actor, 'post', $post->id, $visibility, $this->settings->int('max_attachments'));
            }
        } else {
            $this->media->refreshForReference('post', $post->id);
        }

        $presented = $this->presenter->presentMany(collect([$post->fresh('user')]), $actor)[0];

        if ($visibility === 'public') {
            $this->realtime->publish('social:feed', ['type' => 'post.updated', 'post' => $presented]);
        }

        return $this->json(['data' => $presented]);
    }

    protected function delete(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $post = Post::query()->find((int) $this->routeParam($request, 'id'));

        if (! $post || $post->deleted_at !== null) {
            return $this->notFound('post_not_found');
        }

        $isOwner = (int) $post->user_id === (int) $actor->id;
        $staff = $this->access->isStaff($actor) || $actor->can('social.moderatePosts');

        if (! $isOwner && ! $staff) {
            throw new PermissionDeniedException();
        }

        if ($isOwner && ! $staff && ! $this->settings->bool('allow_delete')) {
            throw new PermissionDeniedException();
        }

        $post->deleted_at = \Illuminate\Support\now();
        $post->updated_at = \Illuminate\Support\now();
        $post->save();

        $this->audit('social.post.deleted', [
            'post_id' => (int) $post->id,
            'by_staff' => (bool) $staff,
        ]);

        $this->media->detach('post', $post->id);

        foreach (Comment::query()->where('post_id', $post->id)->get() as $comment) {
            $this->media->detach('comment', $comment->id);
        }

        $this->realtime->publish('social:feed', ['type' => 'post.deleted', 'post_id' => $post->id]);

        return $this->json(['data' => ['id' => (int) $post->id, 'deleted' => true]]);
    }

    protected function pin(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $actor->assertCan('social.moderatePosts');

        $post = Post::query()->with('user')->find((int) $this->routeParam($request, 'id'));

        if (! $post || $post->deleted_at !== null) {
            return $this->notFound('post_not_found');
        }

        $post->is_pinned = ! $post->is_pinned;
        $post->updated_at = \Illuminate\Support\now();
        $post->save();

        $this->audit('social.post.pinned', [
            'post_id' => (int) $post->id,
            'pinned' => (bool) $post->is_pinned,
        ]);

        return $this->json([
            'data' => $this->presenter->presentMany(collect([$post]), $actor)[0],
        ]);
    }

    protected function visibility(mixed $value): string
    {
        $value = is_string($value) ? $value : 'public';

        if (! in_array($value, ['public', 'members', 'followers', 'private'], true)) {
            $this->validationError('invalid_visibility');
        }

        return $value;
    }
}
