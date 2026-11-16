<?php

namespace CengizKemec\Social\Media;

use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\DirectMessage;
use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\MediaReference;
use CengizKemec\Social\Models\Message;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Story;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\User\User;

class MediaManager
{
    protected const RANK = ['public' => 0, 'members' => 1, 'followers' => 2, 'private' => 3];

    public function __construct(
        protected MediaStorage $storage,
        protected Access $access,
        protected SocialSettings $settings
    ) {
    }

    public function present(Media $media, bool $thumbnail = false): array
    {
        return [
            'id' => (int) $media->id,
            'type' => $media->type,
            'mime' => $media->mime,
            'name' => $media->original_name,
            'size' => (int) $media->size,
            'width' => $media->width,
            'height' => $media->height,
            'duration' => $media->duration,
            'url' => $this->storage->url($media),
            'thumbUrl' => $media->thumbnail_path ? $this->storage->url($media, true) : null,
            'visibility' => $media->visibility,
            'userId' => (int) $media->user_id,
        ];
    }

    /**
     * Attach media to a piece of content. Only the uploader can attach a file.
     */
    public function attach(Media $media, User $actor, string $referenceType, int $referenceId, string $visibility): void
    {
        if ((int) $media->user_id !== (int) $actor->id && ! $this->access->isStaff($actor)) {
            throw new \Flarum\User\Exception\PermissionDeniedException();
        }

        MediaReference::query()->firstOrCreate(
            [
                'media_id' => $media->id,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
            ],
            ['created_at' => \Illuminate\Support\now()]
        );

        $media->status = 'active';
        $media->visibility = $this->safeVisibility($media);
        $media->expires_at = null;
        $media->last_referenced_at = \Illuminate\Support\now();
        $media->updated_at = \Illuminate\Support\now();
        $media->save();
    }

    public function attachIds(array $mediaIds, User $actor, string $referenceType, int $referenceId, string $visibility, int $max = 6): void
    {
        $ids = array_values(array_unique(array_map('intval', $mediaIds)));

        if (count($ids) > $max) {
            throw new \Flarum\Foundation\ValidationException([
                'media' => app('translator')->trans('cengizkemec-social.api.errors.attachment_limit', ['max' => $max]),
            ]);
        }

        if (empty($ids)) {
            return;
        }

        $media = Media::query()->whereIn('id', $ids)->get();

        foreach ($media as $item) {
            $this->attach($item, $actor, $referenceType, $referenceId, $visibility);
        }
    }

    public function detach(string $referenceType, int $referenceId): void
    {
        $mediaIds = MediaReference::query()
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->pluck('media_id')
            ->unique();

        MediaReference::query()
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->delete();

        foreach (Media::query()->whereIn('id', $mediaIds)->get() as $media) {
            $remaining = MediaReference::query()->where('media_id', $media->id)->count();

            if ($remaining > 0) {
                $media->visibility = $this->safeVisibility($media);
                $media->last_referenced_at = \Illuminate\Support\now();
            } else {
                $media->status = 'orphaned';
                $media->last_referenced_at = \Illuminate\Support\now();
                $media->expires_at = \Illuminate\Support\now()->addDays(max(1, $this->settings->int('orphan_grace_days')));
            }

            $media->updated_at = \Illuminate\Support\now();
            $media->save();
        }
    }

    public function refreshForReference(string $referenceType, int $referenceId): void
    {
        $mediaIds = MediaReference::query()
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->pluck('media_id');

        foreach (Media::query()->whereIn('id', $mediaIds)->get() as $media) {
            $media->visibility = $this->safeVisibility($media);
            $media->updated_at = \Illuminate\Support\now();
            $media->save();
        }
    }

    public function mediaFor(string $referenceType, int $referenceId): array
    {
        $media = Media::query()
            ->whereIn('id', MediaReference::query()
                ->where('reference_type', $referenceType)
                ->where('reference_id', $referenceId)
                ->select('media_id'))
            ->get();

        return $media->map(fn (Media $item) => $this->present($item))->all();
    }

    public function canView(Media $media, User $actor): bool
    {
        if (! $this->settings->bool('enable_media')) {
            return false;
        }

        if (! $actor->isGuest() && ((int) $media->user_id === (int) $actor->id || $this->access->isStaff($actor))) {
            return true;
        }

        if ($media->status !== 'active') {
            return false;
        }

        if ($media->visibility === 'public') {
            return $this->access->canViewMedia($actor)
                && (! $actor->isGuest() || $this->settings->bool('guest_public_media'));
        }

        if ($actor->isGuest()) {
            return false;
        }

        $references = MediaReference::query()->where('media_id', $media->id)->get();

        if ($media->visibility === 'members') {
            // Channel media is stored as "members", but a channel inside a
            // private room must still be checked against the channel ACL.
            if ($references->isEmpty()) {
                return false;
            }

            foreach ($references as $reference) {
                if ($this->canViewReference($reference, $actor)) {
                    return true;
                }
            }

            return false;
        }

        foreach ($references as $reference) {
            if ($this->canViewReference($reference, $actor)) {
                return true;
            }
        }

        return false;
    }

    protected function canViewReference(MediaReference $reference, User $actor): bool
    {
        return match ($reference->reference_type) {
            'post' => ($post = Post::query()->find($reference->reference_id)) && $this->access->canViewPost($post, $actor),
            'comment' => ($comment = Comment::query()->find($reference->reference_id))
                && ($post = Post::query()->find($comment->post_id))
                && $this->access->canViewPost($post, $actor),
            'channel_message' => ($message = Message::query()->find($reference->reference_id))
                && ($channel = $message->channel)
                && $this->access->canReadChannelMessages($channel, $actor),
            'direct_message' => ($message = DirectMessage::query()->find($reference->reference_id))
                && $this->access->canAccessDirectConversation($message->conversation_id, $actor),
            'story' => ($story = Story::query()->find($reference->reference_id))
                && $story->expires_at->isFuture()
                && ($actor->isAdmin() || (int) $story->user_id === (int) $actor->id || $story->visibility !== 'private'),
            'profile' => ! $actor->isGuest(),
            default => false,
        };
    }

    protected function safeVisibility(Media $media): string
    {
        $references = MediaReference::query()->where('media_id', $media->id)->get();

        $rank = 'public';

        foreach ($references as $reference) {
            $visibility = $this->referenceVisibility($reference->reference_type, $reference->reference_id);

            if (self::RANK[$visibility] > self::RANK[$rank]) {
                $rank = $visibility;
            }
        }

        return $rank;
    }

    protected function referenceVisibility(string $type, int $id): string
    {
        return match ($type) {
            'post' => Post::query()->find($id)?->visibility ?? 'private',
            'comment' => Post::query()->find(Comment::query()->find($id)?->post_id)?->visibility ?? 'private',
            'channel_message' => 'members',
            'direct_message' => 'private',
            'story' => Story::query()->find($id)?->visibility ?? 'private',
            'profile' => 'members',
            default => 'private',
        };
    }
}
