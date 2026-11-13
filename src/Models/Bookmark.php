<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class Bookmark extends AbstractModel
{
    protected $table = 'social_bookmarks';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
