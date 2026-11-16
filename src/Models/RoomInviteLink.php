<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class RoomInviteLink extends AbstractModel
{
    protected $table = 'social_room_invite_links';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'max_uses' => 'integer',
        'uses' => 'integer',
    ];

    public function room()
    {
        return $this->belongsTo(Room::class, 'room_id');
    }

    public function creator()
    {
        return $this->belongsTo(\Flarum\User\User::class, 'creator_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isExhausted(): bool
    {
        return $this->max_uses > 0 && $this->uses >= $this->max_uses;
    }
}
