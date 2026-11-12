<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\Reaction;
use Flarum\User\User;
use Illuminate\Support\Collection;

class CommentPresenter
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
     * @param Collection<int, Comment> $comments
     */
    public function presentMany(Collection $comments, ?User $actor): array
    {
        if ($comments->isEmpty()) {
            return [];
        }

        $ids = $comments->pluck('id')->all();
        $reactions = Reaction::query()
            ->where('reactable_type', 'comment')
            ->whereIn('reactable_id', $ids)
            ->get();

        $byComment = $reactions->groupBy('reactable_id');
        $actorReactions = $actor && ! $actor->isGuest()
            ? $reactions->where('user_id', $actor->id)->keyBy('reactable_id')
            : collect();

        return $comments->map(function (Comment $comment) use ($byComment, $actorReactions, $actor) {
            $summary = [];

            foreach ($byComment->get($comment->id, []) as $reaction) {
                $summary[$reaction->type] = ($summary[$reaction->type] ?? 0) + 1;
            }

            $isOwner = $actor && ! $actor->isGuest() && (int) $comment->user_id === (int) $actor->id;
            $staff = $actor && ! $actor->isGuest() && $this->access->isStaff($actor);
            $canEdit = $isOwner
                && $this->settings->bool('allow_edit')
                && ($staff || $comment->created_at === null || $comment->created_at->gt(\Illuminate\Support\now()->subMinutes(max(1, $this->settings->int('edit_window_minutes')))));

            return [
                'id' => (int) $comment->id,
                'postId' => (int) $comment->post_id,
                'parentId' => $comment->parent_id ? (int) $comment->parent_id : null,
                'body' => $comment->body,
                'bodyHtml' => $this->formatter->html($comment->body, $actor),
                'reactionsCount' => (int) $comment->reactions_count,
                'reactionSummary' => $summary,
                'reacted' => $actorReactions->has($comment->id) ? $actorReactions->get($comment->id)->type : null,
                'createdAt' => $comment->created_at?->toIso8601String(),
                'editedAt' => $comment->edited_at?->toIso8601String(),
                'user' => $this->users->basic($comment->user),
                'media' => $this->media->mediaFor('comment', $comment->id),
                'canEdit' => $canEdit,
                'canDelete' => $isOwner ? $this->settings->bool('allow_delete') : $staff,
                'canReact' => $actor && ! $actor->isGuest() && $this->access->canReact($actor),
                'canReport' => $actor && ! $actor->isGuest() && $this->settings->bool('reports_enabled'),
            ];
        })->all();
    }
}
