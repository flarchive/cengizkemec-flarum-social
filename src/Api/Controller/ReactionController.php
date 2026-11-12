<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Reaction;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class ReactionController extends AbstractSocialController
{
    protected const ALLOWED = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];

    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected Notifier $notifier
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        if (! $this->access->canReact($actor)) {
            throw new PermissionDeniedException();
        }

        $route = $this->routeName($request);
        $id = (int) $this->routeParam($request, 'id');
        $type = (string) ($this->body($request)['type'] ?? 'like');
        $isPost = $route === 'social.posts.react';

        if (! in_array($type, self::ALLOWED, true)) {
            $this->validationError('invalid_reaction');
        }

        if ($isPost) {
            $subject = Post::query()->with('user')->find($id);

            if (! $subject || $subject->deleted_at !== null || ! $this->access->canViewPost($subject, $actor)) {
                return $this->notFound('post_not_found');
            }

            $existing = Reaction::query()
                ->where('user_id', $actor->id)
                ->where('reactable_type', 'post')
                ->where('reactable_id', $subject->id)
                ->first();
            $owner = $subject->user;
            $subjectType = 'post';
            $subjectId = $subject->id;
        } else {
            $subject = Comment::query()->with('user')->find($id);
            $post = $subject ? Post::query()->find($subject->post_id) : null;

            if (! $subject || $subject->deleted_at !== null || ! $post || ! $this->access->canViewPost($post, $actor)) {
                return $this->notFound('comment_not_found');
            }

            $existing = Reaction::query()
                ->where('user_id', $actor->id)
                ->where('reactable_type', 'comment')
                ->where('reactable_id', $subject->id)
                ->first();
            $owner = $subject->user;
            $subjectType = 'comment';
            $subjectId = $subject->id;
        }

        $reacted = null;

        if ($existing && $existing->type === $type) {
            $existing->delete();
        } else {
            if ($existing) {
                $existing->delete();
            }

            $reaction = new Reaction();
            $reaction->user_id = $actor->id;
            $reaction->reactable_type = $subjectType;
            $reaction->reactable_id = $subjectId;
            $reaction->type = $type;
            $reaction->created_at = \Illuminate\Support\now();
            $reaction->save();

            $reacted = $type;

            $this->notifier->notify($owner, 'reaction', $actor, $subjectType, $subjectId, [
                'reaction' => $type,
            ]);
        }

        $count = Reaction::query()
            ->where('reactable_type', $subjectType)
            ->where('reactable_id', $subjectId)
            ->count();

        $summary = Reaction::query()
            ->where('reactable_type', $subjectType)
            ->where('reactable_id', $subjectId)
            ->get()
            ->groupBy('type')
            ->map(fn ($items) => $items->count())
            ->all();

        if ($subjectType === 'post') {
            $subject->reactions_count = $count;
            $subject->updated_at = \Illuminate\Support\now();
            $subject->save();
        } else {
            $subject->reactions_count = $count;
            $subject->updated_at = \Illuminate\Support\now();
            $subject->save();
        }

        return $this->json([
            'data' => [
                'targetType' => $subjectType,
                'targetId' => $subjectId,
                'reacted' => $reacted,
                'reactionsCount' => $count,
                'reactionSummary' => $summary,
            ],
        ]);
    }
}
