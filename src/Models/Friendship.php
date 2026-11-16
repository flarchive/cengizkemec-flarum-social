<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class Friendship extends AbstractModel
{
    protected $table = 'social_friendships';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_DECLINED = 'declined';
    public const STATUS_BLOCKED = 'blocked';
}
