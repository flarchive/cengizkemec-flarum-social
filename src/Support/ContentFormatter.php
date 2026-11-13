<?php

namespace CengizKemec\Social\Support;

use Flarum\Formatter\Formatter;
use Flarum\User\User;

/**
 * Uses Flarum's own s9e TextFormatter so Social posts, comments and messages
 * understand the same Markdown / BBCode / rich-text input as the rest of the
 * forum (including FoF formatting extensions).
 */
class ContentFormatter
{
    public function __construct(protected Formatter $formatter)
    {
    }

    public function html(?string $body, ?User $actor = null): ?string
    {
        if ($body === null || trim($body) === '') {
            return null;
        }

        try {
            $xml = $this->formatter->parse($body, null, $actor);

            return $this->formatter->render($xml);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
