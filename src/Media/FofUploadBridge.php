<?php

namespace CengizKemec\Social\Media;

use CengizKemec\Social\Support\SocialSettings;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Contracts\Bus\Dispatcher;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Optional bridge to fof/upload. When enabled, Social stores new uploads with
 * the forum's existing upload adapters (local, S3, Imgur, ...) instead of its
 * own media filesystem, so both features share limits and storage.
 */
class FofUploadBridge
{
    public function __construct(
        protected SocialSettings $settings,
        protected ExtensionManager $extensions,
        protected Dispatcher $bus
    ) {
    }

    public function available(User $actor): bool
    {
        if (! $this->settings->bool('use_fof_upload')) {
            return false;
        }

        if (! class_exists(\FoF\Upload\Commands\Upload::class) || ! class_exists(\FoF\Upload\File::class)) {
            return false;
        }

        try {
            if (! $this->extensions->isEnabled('fof-upload')) {
                return false;
            }
        } catch (\Throwable $e) {
            return false;
        }

        return $actor->can('fof-upload.upload');
    }

    /**
     * @return \FoF\Upload\File|null
     */
    public function upload(User $actor, UploadedFileInterface $file): mixed
    {
        if (! $this->available($actor)) {
            return null;
        }

        $files = $this->bus->dispatch(
            new \FoF\Upload\Commands\Upload(collect([$file]), $actor, false, false)
        );

        if (is_object($files) && method_exists($files, 'first')) {
            return $files->first();
        }

        return null;
    }
}
