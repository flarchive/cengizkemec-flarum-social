<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class Follow extends AbstractModel
{
    protected $table = 'social_follows';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
