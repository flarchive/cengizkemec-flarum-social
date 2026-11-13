<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class MediaReference extends AbstractModel
{
    protected $table = 'social_media_references';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
