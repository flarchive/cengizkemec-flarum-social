<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Cleanup\CleanupService;
use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Media\MediaStorage;
use CengizKemec\Social\Models\CleanupLog;
use CengizKemec\Social\Models\Comment;
use CengizKemec\Social\Models\DirectMessage;
use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\MediaReference;
use CengizKemec\Social\Models\Message;
use CengizKemec\Social\Models\ModerationLog;
use CengizKemec\Social\Models\Post;
use CengizKemec\Social\Models\Report;
use CengizKemec\Social\Models\Room;
use CengizKemec\Social\Models\RoomParticipant;
use CengizKemec\Social\Models\UserPreference;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\ModerationLogService;
use CengizKemec\Social\Support\Notifier;
use CengizKemec\Social\Support\SocialSettings;
use CengizKemec\Social\Support\UserPresenter;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

class AdminController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected UserPresenter $users,
        protected MediaManager $media,
        protected MediaStorage $storage,
        protected CleanupService $cleanup,
        protected Notifier $notifier,
        protected ModerationLogService $logs
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertAdmin();

        return match ($this->routeName($request)) {
            'social.admin.overview' => $this->overview($request),
            'social.admin.reports.index' => $this->reports($request),
            'social.admin.reports.resolve' => $this->resolveReport($request),
            'social.admin.cleanup.run' => $this->runCleanup($request),
            'social.admin.cleanup.logs' => $this->cleanupLogs($request),
            'social.admin.moderation.logs' => $this->moderationLogs($request),
            'social.admin.users.restrict' => $this->restrictUser($request),
            default => $this->notFound(),
        };
    }

    protected function overview(ServerRequestInterface $request): ResponseInterface
    {
        $storage = $this->storage->stats();

        return $this->json([
            'data' => [
                'users' => [
                    'total' => User::query()->count(),
                    'active30d' => User::query()->where('last_seen_at', '>', \Illuminate\Support\now()->subDays(30))->count(),
                    'restricted' => UserPreference::query()->where('restricted_until', '>', \Illuminate\Support\now())->count(),
                ],
                'posts' => Post::query()->whereNull('deleted_at')->count(),
                'comments' => Comment::query()->whereNull('deleted_at')->count(),
                'messages' => Message::query()->whereNull('deleted_at')->count(),
                'directMessages' => DirectMessage::query()->whereNull('deleted_at')->count(),
                'rooms' => [
                    'permanent' => Room::query()->where('type', 'permanent')->where('status', 'active')->count(),
                    'temporary' => Room::query()->where('type', 'temporary')->where('status', 'active')->count(),
                    'participants' => RoomParticipant::query()->where('last_seen_at', '>', \Illuminate\Support\now()->subMinutes(5))->count(),
                ],
                'media' => [
                    'records' => Media::query()->count(),
                    'expired' => Media::query()->whereNotNull('expires_at')->where('expires_at', '<', \Illuminate\Support\now())->count(),
                    'bytes' => (int) Media::query()->sum('size'),
                    'storage' => $storage,
                ],
                'reports' => [
                    'open' => Report::query()->where('status', Report::STATUS_OPEN)->count(),
                ],
                'realtime' => [
                    'enabled' => $this->settings->bool('realtime_enabled'),
                    'configured' => $this->settings->get('centrifugo_url') !== '' && $this->settings->get('centrifugo_token_hmac_secret') !== '',
                ],
                'livekit' => [
                    'configured' => $this->settings->get('livekit_url') !== '' && $this->settings->get('livekit_api_key') !== '',
                ],
                'cleanup' => [
                    'enabled' => $this->settings->bool('cleanup_enabled'),
                    'lastRun' => CleanupLog::query()->latest('created_at')->first()?->toArray(),
                ],
            ],
        ]);
    }

    protected function reports(ServerRequestInterface $request): ResponseInterface
    {
        $status = (string) ($request->getQueryParams()['status'] ?? 'open');
        [$offset, $limit] = $this->pagination($request, 30, 100);

        $query = Report::query()->orderByDesc('created_at');

        if (in_array($status, ['open', 'resolved', 'dismissed'], true)) {
            $query->where('status', $status);
        }

        $total = (clone $query)->count();
        $reports = $query->skip($offset)->take($limit)->get();

        $reporters = User::query()->whereIn('id', $reports->pluck('reporter_id'))->get()->keyBy('id');

        return $this->json([
            'data' => $reports->map(fn (Report $report) => [
                'id' => (int) $report->id,
                'reporter' => $reporters->has($report->reporter_id) ? $this->users->basic($reporters->get($report->reporter_id)) : null,
                'type' => $report->reportable_type,
                'subjectId' => (int) $report->reportable_id,
                'reason' => $report->reason,
                'details' => $report->details,
                'status' => $report->status,
                'excerpt' => $this->reportExcerpt($report),
                'createdAt' => $report->created_at?->toIso8601String(),
            ])->all(),
            'meta' => [
                'total' => $total,
                'offset' => $offset,
                'limit' => $limit,
                'hasMore' => $offset + $reports->count() < $total,
            ],
        ]);
    }

    protected function resolveReport(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $report = Report::query()->find((int) $this->routeParam($request, 'id'));

        if (! $report) {
            return $this->notFound('report_not_found');
        }

        $body = $this->body($request);
        $requestedStatus = $body['status'] ?? 'resolved';
        $status = in_array($requestedStatus, ['resolved', 'dismissed'], true) ? $requestedStatus : 'resolved';
        $requestedAction = $body['action'] ?? 'none';
        $action = in_array($requestedAction, ['none', 'delete'], true) ? $requestedAction : 'none';

        if ($action === 'delete') {
            $this->deleteReportedContent($report);
        }

        $report->status = $status;
        $report->resolved_by = $actor->id;
        $report->resolved_at = \Illuminate\Support\now();
        $report->save();

        $this->logs->log($actor, 'report.'.$status, $report->reportable_type, $report->reportable_id, [
            'report_id' => $report->id,
            'action' => $action,
        ]);
        $this->audit('social.report.resolved', [
            'report_id' => (int) $report->id,
            'status' => $status,
            'action' => $action,
        ]);

        $reporter = User::query()->find($report->reporter_id);

        if ($reporter) {
            $this->notifier->notify($reporter, 'moderation', $actor, 'report', $report->id, ['status' => $status]);
        }

        return $this->json(['data' => ['id' => (int) $report->id, 'status' => $status]]);
    }

    protected function deleteReportedContent(Report $report): void
    {
        switch ($report->reportable_type) {
            case 'post':
                $post = Post::query()->find($report->reportable_id);
                if ($post) {
                    $post->deleted_at = \Illuminate\Support\now();
                    $post->updated_at = \Illuminate\Support\now();
                    $post->save();
                    $this->media->detach('post', $post->id);
                }
                break;
            case 'comment':
                $comment = Comment::query()->find($report->reportable_id);
                if ($comment) {
                    $comment->deleted_at = \Illuminate\Support\now();
                    $comment->updated_at = \Illuminate\Support\now();
                    $comment->save();
                    $this->media->detach('comment', $comment->id);
                }
                break;
            case 'message':
                $message = Message::query()->find($report->reportable_id);
                if ($message) {
                    $message->deleted_at = \Illuminate\Support\now();
                    $message->save();
                    $this->media->detach('channel_message', $message->id);
                }
                break;
            case 'media':
                $media = Media::query()->find($report->reportable_id);
                if ($media) {
                    MediaReference::query()->where('media_id', $media->id)->delete();
                    $this->storage->deleteFiles($media);
                    $media->delete();
                }
                break;
        }
    }

    protected function runCleanup(ServerRequestInterface $request): ResponseInterface
    {
        $body = $this->body($request);
        $dryRun = (bool) ($body['dry_run'] ?? true);
        $only = in_array($body['only'] ?? 'all', ['all', 'media', 'rooms', 'stories', 'messages'], true) ? $body['only'] : 'all';
        $stats = $this->cleanup->run($dryRun, $only);

        return $this->json(['data' => $stats]);
    }

    protected function cleanupLogs(ServerRequestInterface $request): ResponseInterface
    {
        $logs = CleanupLog::query()->orderByDesc('created_at')->limit(30)->get()->map(fn (CleanupLog $log) => [
            'id' => (int) $log->id,
            'type' => $log->type,
            'dryRun' => (bool) $log->dry_run,
            'stats' => $log->stats,
            'durationMs' => (int) $log->duration_ms,
            'createdAt' => $log->created_at?->toIso8601String(),
        ])->all();

        return $this->json(['data' => $logs]);
    }

    protected function moderationLogs(ServerRequestInterface $request): ResponseInterface
    {
        [$offset, $limit] = $this->pagination($request, 50, 100);
        $logs = ModerationLog::query()->orderByDesc('created_at')->skip($offset)->take($limit)->get();
        $actors = User::query()->whereIn('id', $logs->pluck('actor_id'))->get()->keyBy('id');

        return $this->json([
            'data' => $logs->map(fn (ModerationLog $log) => [
                'id' => (int) $log->id,
                'actor' => $actors->has($log->actor_id) ? $this->users->basic($actors->get($log->actor_id)) : null,
                'action' => $log->action,
                'targetType' => $log->target_type,
                'targetId' => $log->target_id ? (int) $log->target_id : null,
                'meta' => $log->meta ?? [],
                'createdAt' => $log->created_at?->toIso8601String(),
            ])->all(),
        ]);
    }

    protected function restrictUser(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $target = User::query()->find((int) $this->routeParam($request, 'id'));

        if (! $target || $target->isAdmin()) {
            $this->validationError('user_not_found');
        }

        $body = $this->body($request);
        $lift = (bool) ($body['lift'] ?? false);
        $hours = max(1, (int) ($body['duration_hours'] ?? 24));
        $reason = $this->cleanString($body['reason'] ?? '', 255) ?: null;

        $preference = UserPreference::query()->firstOrNew(['user_id' => $target->id]);
        $preference->restricted_until = $lift ? null : \Illuminate\Support\now()->addHours($hours);
        $preference->restriction_reason = $lift ? null : $reason;
        $preference->updated_at = \Illuminate\Support\now();
        $preference->save();

        $this->logs->log($actor, $lift ? 'user.unrestricted' : 'user.restricted', 'user', $target->id, [
            'hours' => $hours,
            'reason' => $reason,
        ]);

        if (! $lift) {
            $this->notifier->notify($target, 'moderation', $actor, 'user', $target->id, ['reason' => $reason]);
        }

        return $this->json(['data' => [
            'userId' => (int) $target->id,
            'restricted' => ! $lift,
            'restrictedUntil' => $preference->restricted_until?->toIso8601String(),
        ]]);
    }

    protected function reportExcerpt(Report $report): ?string
    {
        return match ($report->reportable_type) {
            'post' => Post::query()->find($report->reportable_id)?->body,
            'comment' => Comment::query()->find($report->reportable_id)?->body,
            'media' => Media::query()->find($report->reportable_id)?->original_name,
            'message' => Message::query()->find($report->reportable_id)?->body,
            default => null,
        };
    }
}
