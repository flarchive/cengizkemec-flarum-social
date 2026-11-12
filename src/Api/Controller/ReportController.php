<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\Message;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Report;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\ModerationLogService;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class ReportController extends AbstractSocialController
{
    protected const REASONS = ['spam', 'abuse', 'harassment', 'nsfw', 'other'];

    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected MediaManager $media,
        protected Notifier $notifier,
        protected ModerationLogService $logs
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->bool('reports_enabled')) {
            return $this->forbidden('reports_disabled');
        }

        $actor = $this->actor($request);
        $actor->assertRegistered();

        $route = $this->routeName($request);
        $id = (int) $this->routeParam($request, 'id');
        $type = match ($route) {
            'social.reports.post' => 'post',
            'social.reports.comment' => 'comment',
            'social.reports.media' => 'media',
            'social.reports.message' => 'message',
            default => null,
        };

        if ($type === null) {
            return $this->notFound();
        }

        $subject = $this->findSubject($type, $id, $actor);

        if (! $subject) {
            return $this->notFound($type.'_not_found');
        }

        $body = $this->body($request);
        $requestedReason = $body['reason'] ?? 'other';
        $reason = in_array($requestedReason, self::REASONS, true) ? $requestedReason : 'other';
        $details = $this->cleanString($body['details'] ?? '', 1000);

        $exists = Report::query()
            ->where('reporter_id', $actor->id)
            ->where('reportable_type', $type)
            ->where('reportable_id', $id)
            ->where('status', Report::STATUS_OPEN)
            ->exists();

        if ($exists) {
            $this->validationError('already_reported');
        }

        $report = new Report();
        $report->reporter_id = $actor->id;
        $report->reportable_type = $type;
        $report->reportable_id = $id;
        $report->reason = $reason;
        $report->details = $details ?: null;
        $report->status = Report::STATUS_OPEN;
        $report->created_at = \Illuminate\Support\now();
        $report->save();

        $this->audit('social.report.created', [
            'report_id' => (int) $report->id,
            'type' => $type,
            'subject_id' => $id,
            'reason' => $reason,
        ]);

        $this->logs->log($actor, 'report.created', $type, $id, ['report_id' => $report->id, 'reason' => $reason]);

        return $this->json([
            'data' => ['id' => (int) $report->id, 'status' => $report->status],
        ], 201);
    }

    protected function findSubject(string $type, int $id, $actor): ?object
    {
        return match ($type) {
            'post' => ($post = Post::query()->find($id)) && $this->access->canViewPost($post, $actor) ? $post : null,
            'comment' => ($comment = Comment::query()->find($id))
                && ($post = Post::query()->find($comment->post_id))
                && $this->access->canViewPost($post, $actor) ? $comment : null,
            'media' => ($media = Media::query()->find($id)) && $this->media->canView($media, $actor) ? $media : null,
            'message' => ($message = Message::query()->find($id))
                && $message->channel
                && $this->access->canReadChannelMessages($message->channel, $actor) ? $message : null,
            default => null,
        };
    }
}
