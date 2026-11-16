<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DirectMessage extends AbstractModel
{
    protected $table = 'social_direct_messages';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'edited_at' => 'datetime',
        'deleted_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
