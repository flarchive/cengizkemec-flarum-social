<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class ModerationLog extends AbstractModel
{
    protected $table = 'social_moderation_logs';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
    ];
}
