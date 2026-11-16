<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class Report extends AbstractModel
{
    protected $table = 'social_reports';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'resolved_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public const STATUS_OPEN = 'open';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_DISMISSED = 'dismissed';
}
