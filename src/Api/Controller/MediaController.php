<?php

namespace CengizKemec\Social\Api\Controller;

use CengizKemec\Social\Media\MediaManager;
use CengizKemec\Social\Media\MediaStorage;
use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Models\MediaReference;
use CengizKemec\Social\Support\Access;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Laminas\Diactoros\Response;
use Laminas\Diactoros\Stream;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;

class MediaController extends AbstractSocialController
{
    public function __construct(
        Access $access,
        SocialSettings $settings,
        TranslatorInterface $translator,
        protected MediaStorage $storage,
        protected MediaManager $media
    ) {
        parent::__construct($access, $settings, $translator);
    }

    protected function dispatch(ServerRequestInterface $request): ResponseInterface
    {
        return match ($this->routeName($request)) {
            'social.media.index' => $this->index($request),
            'social.media.upload' => $this->upload($request),
            'social.media.file' => $this->file($request),
            'social.media.delete' => $this->delete($request),
            default => $this->notFound(),
        };
    }

    protected function index(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);

        if (! $this->access->canViewMedia($actor)) {
            return $this->forbidden('media_forbidden');
        }

        $type = (string) ($request->getQueryParams()['type'] ?? '');
        $scope = (string) ($request->getQueryParams()['scope'] ?? 'library');
        [$offset, $limit] = $this->pagination($request, 24, 60);

        $query = Media::query()->with('user');

        if ($actor->isGuest()) {
            $query->where('status', 'active')->where('visibility', 'public');
        } elseif ($scope === 'mine') {
            $query->where('user_id', $actor->id);
        } else {
            $query->where(function ($query) use ($actor) {
                $query->where('user_id', $actor->id)
                    ->orWhere(function ($query) {
                        $query->where('status', 'active')->where('visibility', 'public');
                    });
            });
        }

        if (in_array($type, ['image', 'video', 'document'], true)) {
            $query->where('type', $type);
        }

        $query->orderByDesc('created_at');
        $total = (clone $query)->count();
        $items = $query->skip($offset)->take($limit)->get();

        return $this->json([
            'data' => $items->map(fn (Media $media) => $this->media->present($media))->all(),
            'meta' => [
                'total' => $total,
                'offset' => $offset,
                'limit' => $limit,
                'hasMore' => $offset + $items->count() < $total,
            ],
        ]);
    }

    protected function upload(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();
        $actor->assertCan('social.uploadMedia');

        if (! $this->settings->bool('enable_media') || $this->access->isRestricted($actor)) {
            throw new PermissionDeniedException();
        }

        $files = $request->getUploadedFiles();
        $file = $files['file'] ?? $files['media'] ?? null;

        if (! $file instanceof UploadedFileInterface) {
            $this->validationError('no_file');
        }

        $media = $this->storage->store($actor, $file);

        $this->audit('social.media.uploaded', [
            'media_id' => (int) $media->id,
            'type' => $media->type,
            'mime' => $media->mime,
            'size' => (int) $media->size,
            'visibility' => $media->visibility,
        ]);

        return $this->json([
            'data' => array_merge($this->media->present($media), [
                'expiresAt' => $media->expires_at?->toIso8601String(),
            ]),
        ], 201);
    }

    protected function file(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $media = Media::query()->find((int) $this->routeParam($request, 'id'));

        if (! $media) {
            return $this->notFound('media_not_found');
        }

        if (! $this->media->canView($media, $actor)) {
            return $this->forbidden('media_forbidden');
        }

        $thumbnail = (bool) ($request->getQueryParams()['thumb'] ?? false);

        try {
            $payload = $this->storage->read($media, $thumbnail);
        } catch (\Throwable $e) {
            return $this->notFound('media_file_missing');
        }

        $stream = $payload['stream'];
        $size = $payload['size'];
        $range = $request->getHeaderLine('Range');
        $status = 200;
        $safeName = preg_replace('/[\x00-\x1F\x7F"\\\\\/]+/', '', basename((string) $payload['name'])) ?: 'download';

        $headers = [
            'Content-Type' => $payload['mime'],
            'Content-Disposition' => 'inline; filename="'.$safeName.'"',
            'Cache-Control' => $media->visibility === 'public' && ! $actor->isGuest()
                ? 'public, max-age=86400'
                : 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
            'Accept-Ranges' => 'bytes',
        ];

        if ($range !== '' && preg_match('/bytes=(\d*)-(\d*)/', $range, $matches)) {
            $start = $matches[1] !== '' ? (int) $matches[1] : 0;
            $end = $matches[2] !== '' ? (int) $matches[2] : $size - 1;
            $end = min($end, $size - 1);
            $length = max(0, $end - $start + 1);

            if ($start <= $end && $length > 0) {
                if (fseek($stream, $start) === 0) {
                    $chunk = fread($stream, $length);
                    fclose($stream);
                    $stream = fopen('php://temp', 'r+b');
                    fwrite($stream, $chunk);
                    rewind($stream);

                    $status = 206;
                    $headers['Content-Range'] = sprintf('bytes %d-%d/%d', $start, $end, $size);
                    $headers['Content-Length'] = (string) strlen($chunk);
                    $size = strlen($chunk);
                }
            }
        }

        if ($status === 200) {
            $headers['Content-Length'] = (string) $size;
        }

        $body = $status === 206 || $range !== '' ? new Stream($stream) : new Stream($stream);

        return new Response($body, $status, $headers);
    }

    protected function delete(ServerRequestInterface $request): ResponseInterface
    {
        $actor = $this->actor($request);
        $actor->assertRegistered();

        $media = Media::query()->find((int) $this->routeParam($request, 'id'));

        if (! $media) {
            return $this->notFound('media_not_found');
        }

        if ((int) $media->user_id !== (int) $actor->id && ! $this->access->isStaff($actor)) {
            throw new PermissionDeniedException();
        }

        if (! $actor->can('social.deleteOwnMedia') && ! $this->access->isStaff($actor)) {
            throw new PermissionDeniedException();
        }

        if (MediaReference::query()->where('media_id', $media->id)->exists()) {
            $this->validationError('media_in_use');
        }

        $this->storage->deleteFiles($media);
        $this->audit('social.media.deleted', ['media_id' => (int) $media->id, 'type' => $media->type]);
        $media->delete();

        return $this->json(['data' => ['id' => (int) $media->id, 'deleted' => true]]);
    }
}
