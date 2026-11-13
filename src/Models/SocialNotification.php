<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class SocialNotification extends AbstractModel
{
    protected $table = 'social_notifications';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
        'created_at' => 'datetime',
    ];
}
