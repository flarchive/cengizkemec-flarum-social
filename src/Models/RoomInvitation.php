<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class RoomInvitation extends AbstractModel
{
    protected $table = 'social_room_invitations';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
