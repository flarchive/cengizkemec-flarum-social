<?php

namespace CengizKemec\Social\Support;

use Flarum\Audit\AuditLogger;
use Flarum\Extension\ExtensionManager;

/**
 * Optional bridge to flarum/audit. Social keeps working when the audit
 * extension is absent; in that case every call is a no-op.
 */
class Audit
{
    public function __construct(protected ExtensionManager $extensions)
    {
    }

    public function log(string $action, array $payload = []): void
    {
        if (! $this->extensions->isEnabled('flarum-audit') || ! class_exists(AuditLogger::class)) {
            return;
        }

        AuditLogger::log($action, $payload);
    }
}
