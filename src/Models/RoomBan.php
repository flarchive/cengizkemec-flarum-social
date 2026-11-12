<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class RoomBan extends AbstractModel
{
    protected $table = 'social_room_bans';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
    ];
}
