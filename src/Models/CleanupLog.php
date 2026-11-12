<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class CleanupLog extends AbstractModel
{
    protected $table = 'social_cleanup_logs';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'dry_run' => 'boolean',
        'stats' => 'array',
        'duration_ms' => 'integer',
        'created_at' => 'datetime',
    ];
}
