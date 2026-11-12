<?php

namespace CengizKemec\Social\Media;

use CengizKemec\Social\Models\Media;
use CengizKemec\Social\Support\SocialSettings;
use Flarum\Foundation\Config;
use Flarum\Foundation\Paths;
use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Support\Str;
use League\Flysystem\Filesystem;
use League\Flysystem\Local\LocalFilesystemAdapter;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Stores media outside the database. Public and private access is always
 * mediated by the API controller, so a file URL can never leak a private post.
 */
class MediaStorage
{
    public const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'application/pdf' => 'pdf',
        'text/plain' => 'txt',
        'text/csv' => 'csv',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'application/vnd.ms-powerpoint' => 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
        'application/vnd.oasis.opendocument.text' => 'odt',
        'application/vnd.oasis.opendocument.spreadsheet' => 'ods',
    ];

    protected ?Filesystem $filesystem = null;

    public function __construct(
        protected SocialSettings $settings,
        protected TranslatorInterface $translator,
        protected Paths $paths,
        protected Config $config
    ) {
    }

    public function filesystem(): Filesystem
    {
        if ($this->filesystem) {
            return $this->filesystem;
        }

        if ($this->settings->get('storage_driver') === 's3') {
            if (! class_exists(\League\Flysystem\AwsS3V3\AwsS3V3Adapter::class) || ! class_exists(\Aws\S3\S3Client::class)) {
                throw new ValidationException([
                    'storage' => 'S3 storage requires league/flysystem-aws-s3-v3 and aws/aws-sdk-php.',
                ]);
            }

            $client = new \Aws\S3\S3Client([
                'version' => 'latest',
                'region' => $this->settings->get('s3_region') ?: 'us-east-1',
                'endpoint' => $this->settings->get('s3_endpoint') ?: null,
                'use_path_style_endpoint' => $this->settings->bool('s3_path_style'),
                'credentials' => [
                    'key' => $this->settings->get('s3_key'),
                    'secret' => $this->settings->get('s3_secret'),
                ],
            ]);

            $adapter = new \League\Flysystem\AwsS3V3\AwsS3V3Adapter(
                $client,
                $this->settings->get('s3_bucket'),
                'social-media'
            );

            return $this->filesystem = new Filesystem($adapter);
        }

        $root = $this->paths->storage.'/social-media';
        @mkdir($root, 0775, true);

        return $this->filesystem = new Filesystem(new LocalFilesystemAdapter($root));
    }

    public function store(User $actor, UploadedFileInterface $file): Media
    {
        if (! $this->settings->bool('uploads')) {
            throw new ValidationException(['file' => $this->translator->trans('cengizkemec-social.api.errors.uploads_disabled')]);
        }

        if ($file->getError() !== UPLOAD_ERR_OK) {
            throw new ValidationException(['file' => $this->translator->trans('cengizkemec-social.api.errors.upload_failed')]);
        }

        // Reject oversized uploads before copying them into a temporary file.
        $largestLimit = max(
            $this->settings->int('max_image_mb'),
            $this->settings->int('max_video_mb'),
            $this->settings->int('max_document_mb')
        );

        if ($largestLimit > 0 && $file->getSize() !== null && $file->getSize() > $largestLimit * 1024 * 1024) {
            throw new ValidationException([
                'file' => $this->translator->trans('cengizkemec-social.api.errors.file_too_large', ['max' => $largestLimit]),
            ]);
        }

        $temp = $this->copyToTemp($file);
        $size = filesize($temp);

        try {
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($temp) ?: 'application/octet-stream';
            $extension = self::MIME_EXTENSIONS[$mime] ?? null;
            $allowed = $this->settings->list('allowed_mimes');

            if ($extension === null || (! empty($allowed) && ! in_array($mime, $allowed, true))) {
                throw new ValidationException(['file' => $this->translator->trans('cengizkemec-social.api.errors.mime_not_allowed', ['mime' => $mime])]);
            }

            $type = Str::startsWith($mime, 'image/') ? 'image' : (Str::startsWith($mime, 'video/') ? 'video' : 'document');
            $maxMb = match ($type) {
                'image' => $this->settings->int('max_image_mb'),
                'video' => $this->settings->int('max_video_mb'),
                default => $this->settings->int('max_document_mb'),
            };

            if ($maxMb > 0 && $size > $maxMb * 1024 * 1024) {
                throw new ValidationException([
                    'file' => $this->translator->trans('cengizkemec-social.api.errors.file_too_large', ['max' => $maxMb]),
                ]);
            }

            $quotaMb = $this->settings->int('user_quota_mb');
            if ($quotaMb > 0) {
                $used = (int) Media::query()->where('user_id', $actor->id)->sum('size');
                if ($used + $size > $quotaMb * 1024 * 1024) {
                    throw new ValidationException(['file' => $this->translator->trans('cengizkemec-social.api.errors.quota_exceeded')]);
                }
            }

            $width = null;
            $height = null;

            if ($type === 'image') {
                [$width, $height] = @getimagesize($temp) ?: [null, null];
                $maxDimension = $this->settings->int('max_image_dimension');
                if ($maxDimension > 0 && (($width ?? 0) > $maxDimension || ($height ?? 0) > $maxDimension)) {
                    throw new ValidationException([
                        'file' => $this->translator->trans('cengizkemec-social.api.errors.image_dimensions', ['max' => $maxDimension]),
                    ]);
                }
            }

            $relative = gmdate('Y/m/d').'/'.bin2hex(random_bytes(20)).'.'.$extension;
            $stream = fopen($temp, 'rb');

            try {
                $this->filesystem()->writeStream($relative, $stream);
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }

            $thumbnail = null;

            if ($type === 'image') {
                $thumbnail = $this->createThumbnail($temp, $relative);
            }

            $media = new Media();
            $media->user_id = $actor->id;
            $media->disk = $this->settings->get('storage_driver') === 's3' ? 's3' : 'local';
            $media->path = $relative;
            $media->thumbnail_path = $thumbnail;
            $originalName = preg_replace('/[\x00-\x1F\x7F"\\\\\/]+/', '', basename((string) ($file->getClientFilename() ?: 'upload.'.$extension)));
            $media->original_name = Str::limit($originalName ?: 'upload.'.$extension, 240, '');
            $media->mime = $mime;
            $media->extension = $extension;
            $media->type = $type;
            $media->size = $size;
            $media->width = $width;
            $media->height = $height;
            $media->visibility = 'private';
            $media->status = 'temporary';
            $media->expires_at = \Illuminate\Support\now()->addHours(max(1, $this->settings->int('temporary_ttl_hours')));
            $media->created_at = \Illuminate\Support\now();
            $media->updated_at = \Illuminate\Support\now();
            $media->save();

            return $media;
        } finally {
            @unlink($temp);
        }
    }

    public function deleteFiles(Media $media): void
    {
        $files = array_filter([$media->path, $media->thumbnail_path]);

        foreach ($files as $path) {
            try {
                if ($this->filesystem()->fileExists($path)) {
                    $this->filesystem()->delete($path);
                }
            } catch (\Throwable $e) {
                // A missing object must never abort the database cleanup.
            }
        }
    }

    /**
     * @return array{stream: resource, mime: string, size: int, name: string}
     */
    public function read(Media $media, bool $thumbnail = false): array
    {
        $path = $thumbnail && $media->thumbnail_path ? $media->thumbnail_path : $media->path;

        if (! $this->filesystem()->fileExists($path)) {
            throw new \RuntimeException('Media file not found');
        }

        $stream = $this->filesystem()->readStream($path);

        if (! is_resource($stream)) {
            throw new \RuntimeException('Media file not readable');
        }

        $size = (int) $this->filesystem()->fileSize($path);
        $mime = $thumbnail ? 'image/jpeg' : $media->mime;

        return [
            'stream' => $stream,
            'mime' => $mime,
            'size' => $size,
            'name' => $thumbnail ? 'thumbnail.jpg' : ($media->original_name ?: basename($path)),
        ];
    }

    public function url(Media $media, bool $thumbnail = false): string
    {
        $base = rtrim((string) $this->config->url(), '/');

        return $base.'/api/social/media/'.$media->id.'/file'.($thumbnail && $media->thumbnail_path ? '?thumb=1' : '');
    }

    public function localRoot(): string
    {
        return $this->paths->storage.'/social-media';
    }

    public function stats(): array
    {
        $files = 0;
        $bytes = 0;
        $root = $this->localRoot();

        if ($this->settings->get('storage_driver') !== 's3' && is_dir($root)) {
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS));

            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $files++;
                    $bytes += $file->getSize();
                }
            }
        }

        return [
            'files' => $files,
            'bytes' => $bytes,
            'driver' => $this->settings->get('storage_driver'),
        ];
    }

    protected function copyToTemp(UploadedFileInterface $file): string
    {
        $temp = tempnam(sys_get_temp_dir(), 'fsocial_');
        $stream = $file->getStream();

        if ($stream->isSeekable()) {
            $stream->rewind();
        }

        $out = fopen($temp, 'wb');

        while (! $stream->eof()) {
            fwrite($out, $stream->read(8192));
        }

        fclose($out);

        return $temp;
    }

    protected function createThumbnail(string $source, string $relative): ?string
    {
        if (! function_exists('imagecreatefromstring')) {
            return null;
        }

        $contents = @file_get_contents($source);

        if ($contents === false) {
            return null;
        }

        $image = @imagecreatefromstring($contents);

        if (! $image) {
            return null;
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $targetWidth = min(max(160, $this->settings->int('thumbnail_width')), $width);
        $targetHeight = (int) max(1, round($height * ($targetWidth / max(1, $width))));

        $thumb = imagecreatetruecolor($targetWidth, $targetHeight);

        // Flatten transparency onto white so JPEG thumbnails are predictable.
        $white = imagecolorallocate($thumb, 255, 255, 255);
        imagefill($thumb, 0, 0, $white);
        imagecopyresampled($thumb, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        $temp = tempnam(sys_get_temp_dir(), 'fsthumb_');
        imagejpeg($thumb, $temp, 82);

        $thumbnailPath = 'thumbs/'.preg_replace('/\.[^.]+$/', '', $relative).'.jpg';
        $stream = fopen($temp, 'rb');

        try {
            $this->filesystem()->writeStream($thumbnailPath, $stream);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
            @unlink($temp);
            imagedestroy($image);
            imagedestroy($thumb);
        }

        return $thumbnailPath;
    }
}
