<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class StoryView extends AbstractModel
{
    protected $table = 'social_story_views';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
