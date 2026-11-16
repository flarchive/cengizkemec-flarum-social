<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\Bookmark;
use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\MediaReference;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Reaction;
use Flarum\User\User;
use Illuminate\Support\Collection;

class PostPresenter
{
    public function __construct(
        protected UserPresenter $users,
        protected MediaManager $media,
        protected Access $access,
        protected SocialSettings $settings,
        protected ContentFormatter $formatter
    ) {
    }

    /**
     * @param Collection<int, Post> $posts
     */
    public function presentMany(Collection $posts, ?User $actor): array
    {
        if ($posts->isEmpty()) {
            return [];
        }

        $ids = $posts->pluck('id')->all();

        $mediaReferences = MediaReference::query()
            ->where('reference_type', 'post')
            ->whereIn('reference_id', $ids)
            ->get()
            ->groupBy('reference_id');

        $media = Media::query()
            ->whereIn('id', $mediaReferences->flatten()->pluck('media_id')->all())
            ->get()
            ->keyBy('id');

        $reactionRows = Reaction::query()
            ->where('reactable_type', 'post')
            ->whereIn('reactable_id', $ids)
            ->get();

        $reactionsByPost = $reactionRows->groupBy('reactable_id');
        $actorReactions = $actor && ! $actor->isGuest()
            ? $reactionRows->where('user_id', $actor->id)->keyBy('reactable_id')
            : collect();

        $bookmarks = $actor && ! $actor->isGuest()
            ? Bookmark::query()->where('user_id', $actor->id)->whereIn('post_id', $ids)->pluck('post_id')->flip()
            : collect();

        return $posts->map(function (Post $post) use ($mediaReferences, $media, $reactionsByPost, $actorReactions, $bookmarks, $actor) {
            $postMedia = collect($mediaReferences->get($post->id, []))
                ->map(fn ($reference) => $media->get($reference->media_id))
                ->filter()
                ->map(fn (Media $item) => $this->media->present($item))
                ->values()
                ->all();

            $summary = [];
            foreach ($reactionsByPost->get($post->id, []) as $reaction) {
                $summary[$reaction->type] = ($summary[$reaction->type] ?? 0) + 1;
            }

            $isOwner = $actor && ! $actor->isGuest() && (int) $post->user_id === (int) $actor->id;
            $staff = $actor && ! $actor->isGuest() && $this->access->isStaff($actor);
            $canEdit = $isOwner
                && $this->settings->bool('allow_edit')
                && ($staff || $post->created_at === null || $post->created_at->gt(\Illuminate\Support\now()->subMinutes(max(1, $this->settings->int('edit_window_minutes')))));

            return [
                'id' => (int) $post->id,
                'body' => $post->body,
                'bodyHtml' => $this->formatter->html($post->body, $actor),
                'visibility' => $post->visibility,
                'isPinned' => (bool) $post->is_pinned,
                'isAnnouncement' => (bool) $post->is_announcement,
                'commentsCount' => (int) $post->comments_count,
                'reactionsCount' => (int) $post->reactions_count,
                'reactionSummary' => $summary,
                'reacted' => $actorReactions->has($post->id) ? $actorReactions->get($post->id)->type : null,
                'bookmarked' => $bookmarks->has($post->id),
                'createdAt' => $this->iso($post->created_at),
                'editedAt' => $this->iso($post->edited_at),
                'user' => $this->users->basic($post->user),
                'media' => $postMedia,
                'canEdit' => $canEdit,
                'canDelete' => $isOwner ? $this->settings->bool('allow_delete') : $staff,
                'canPin' => $staff || ($actor && ! $actor->isGuest() && $actor->can('social.moderatePosts')),
                'canReact' => $actor && ! $actor->isGuest() && $this->access->canReact($actor),
                'canComment' => $actor && ! $actor->isGuest() && $this->access->canComment($actor),
                'canBookmark' => $actor && ! $actor->isGuest() && $this->access->canBookmark($actor),
                'canReport' => $actor && ! $actor->isGuest() && $this->settings->bool('reports_enabled'),
            ];
        })->all();
    }

    protected function iso(?object $date): ?string
    {
        return $date ? $date->toIso8601String() : null;
    }
}
