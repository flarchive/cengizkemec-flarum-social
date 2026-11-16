<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\ModerationLog;
use Flarum\User\User;

class ModerationLogService
{
    public function log(User $actor, string $action, ?string $targetType = null, ?int $targetId = null, array $meta = []): ModerationLog
    {
        $log = new ModerationLog();
        $log->actor_id = $actor->id;
        $log->action = $action;
        $log->target_type = $targetType;
        $log->target_id = $targetId;
        $log->meta = $meta;
        $log->created_at = \Illuminate\Support\now();
        $log->save();

        return $log;
    }
}
