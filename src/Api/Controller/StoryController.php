<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\Story;
use CengizKemec\Social\Models\StoryView;
use CengizKemec\Social\Realtime\Centrifugo;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\UserPresenter;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class StoryController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected UserPresenter $users,
        protected MediaManager $media,
        protected Centrifugo $realtime
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        return match ($this->routeName($request)) {
            'social.stories.index' => $this->index($request),
            'social.stories.create' => $this->create($request),
            'social.stories.view' => $this->view($request),
            'social.stories.delete' => $this->delete($request),
            default => $this->notFound(),
        };
    }

    protected function index(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);

        if (! $this->settings->bool('enable_stories')) {
            return $this->json(['data' => []]);
        }

        if ($actor->isGuest() && (! $this->settings->bool('guest_access') || ! $this->settings->bool('guest_public_media'))) {
            return $this->json(['data' => []]);
        }

        $stories = Story::query()
            ->with(['user', 'media'])
            ->where('expires_at', '>', \Illuminate\Support\now())
            ->orderBy('created_at')
            ->limit(200)
            ->get()
            ->filter(fn (Story $story) => $this->canViewStory($story, $actor))
            ->values();

        $viewed = $actor->isGuest()
            ? collect()
            : StoryView::query()->where('user_id', $actor->id)->whereIn('story_id', $stories->pluck('id'))->pluck('story_id')->flip();

        $grouped = $stories->groupBy('user_id')->map(function ($items, $userId) use ($viewed, $actor) {
            $first = $items->first();

            return [
                'user' => $this->users->basic($first->user),
                'stories' => $items->map(fn (Story $story) => [
                    'id' => (int) $story->id,
                    'type' => $story->type,
                    'body' => $story->body,
                    'media' => $story->media ? $this->media->present($story->media) : null,
                    'createdAt' => $story->created_at?->toIso8601String(),
                    'expiresAt' => $story->expires_at?->toIso8601String(),
                    'viewsCount' => (int) $story->views_count,
                    'viewed' => $viewed->has($story->id),
                    'canDelete' => ! $actor->isGuest() && ((int) $story->user_id === (int) $actor->id || $this->access->isStaff($actor)),
                ])->all(),
            ];
        })->values()->all();

        return $this->json(['data' => $grouped]);
    }

    protected function create(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        if (! $this->access->canCreateStory($actor)) {
            throw new PermissionDeniedException();
        }

        $body = $this->body($request);
        $requestedType = $body['type'] ?? 'text';
        $type = in_array($requestedType, ['text', 'image', 'video'], true) ? $requestedType : 'text';
        $text = $this->cleanString($body['body'] ?? '', 1000);
        $mediaId = (int) ($body['media_id'] ?? 0);
        $media = $mediaId ? Media::query()->find($mediaId) : null;

        if ($type !== 'text' && (! $media || (int) $media->user_id !== (int) $actor->id)) {
            $this->validationError('story_media_required');
        }

        if ($type === 'text' && $text === '') {
            $this->validationError('story_empty');
        }

        $requestedVisibility = $body['visibility'] ?? 'members';
        $visibility = in_array($requestedVisibility, ['public', 'members', 'private'], true)
            ? $requestedVisibility
            : 'members';

        $ttl = max(1, $this->settings->int('stories_ttl_hours'));

        $story = new Story();
        $story->user_id = $actor->id;
        $story->type = $type;
        $story->media_id = $media?->id;
        $story->body = $text ?: null;
        $story->visibility = $visibility;
        $story->views_count = 0;
        $story->expires_at = \Illuminate\Support\now()->addHours($ttl);
        $story->created_at = \Illuminate\Support\now();
        $story->save();

        if ($media) {
            $this->media->attach($media, $actor, 'story', $story->id, $visibility);
        }

        $this->realtime->publish('social:stories', ['type' => 'story.created', 'story_id' => $story->id]);
        $this->audit('social.story.created', [
            'story_id' => (int) $story->id,
            'type' => $story->type,
            'visibility' => $visibility,
            'has_media' => (bool) $media,
        ]);

        return $this->json([
            'data' => [
                'id' => (int) $story->id,
                'type' => $story->type,
                'body' => $story->body,
                'media' => $media ? $this->media->present($media) : null,
                'expiresAt' => $story->expires_at?->toIso8601String(),
            ],
        ], 201);
    }

    protected function view(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $story = Story::query()->with('user')->find((int) $this->routeParam($request, 'id'));

        if (! $story || $story->expires_at->isPast() || ! $this->canViewStory($story, $actor)) {
            return $this->notFound('story_not_found');
        }

        if (! $actor->isGuest()) {
            $view = StoryView::query()->firstOrCreate(
                ['story_id' => $story->id, 'user_id' => $actor->id],
                ['created_at' => \Illuminate\Support\now()]
            );

            if ($view->wasRecentlyCreated) {
                $story->views_count = $story->views_count + 1;
                $story->save();
            }
        }

        return $this->json(['data' => ['viewed' => true, 'viewsCount' => (int) $story->views_count]]);
    }

    protected function delete(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $story = Story::query()->find((int) $this->routeParam($request, 'id'));

        if (! $story) {
            return $this->notFound('story_not_found');
        }

        if ((int) $story->user_id !== (int) $actor->id && ! $this->access->isStaff($actor)) {
            throw new PermissionDeniedException();
        }

        StoryView::query()->where('story_id', $story->id)->delete();
        $this->media->detach('story', $story->id);
        $story->delete();

        $this->audit('social.story.deleted', ['story_id' => (int) $story->id]);

        return $this->json(['data' => ['id' => (int) $story->id, 'deleted' => true]]);
    }

    protected function canViewStory(Story $story, User $actor): bool
    {
        if ($story->expires_at->isPast()) {
            return false;
        }

        if (! $actor->isGuest() && ((int) $story->user_id === (int) $actor->id || $this->access->isStaff($actor))) {
            return true;
        }

        if ($story->visibility === 'public') {
            return ! $actor->isGuest() || ($this->settings->bool('guest_access') && $this->settings->bool('guest_public_media'));
        }

        return ! $actor->isGuest() && $story->visibility === 'members';
    }
}
