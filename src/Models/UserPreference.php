<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class UserPreference extends AbstractModel
{
    protected $table = 'social_user_preferences';
    protected $primaryKey = 'user_id';
    public $incrementing = false;
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'settings' => 'array',
        'restricted_until' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
