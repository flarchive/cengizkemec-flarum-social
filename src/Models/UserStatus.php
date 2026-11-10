<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class UserStatus extends AbstractModel
{
    protected $table = 'social_user_status';
    protected $primaryKey = 'user_id';
    public $incrementing = false;
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'last_online_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
