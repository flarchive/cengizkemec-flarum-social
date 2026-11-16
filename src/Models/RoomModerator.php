<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class RoomModerator extends AbstractModel
{
    protected $table = 'social_room_moderators';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
