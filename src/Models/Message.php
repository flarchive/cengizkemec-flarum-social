<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends AbstractModel
{
    protected $table = 'social_messages';
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

    /** @return BelongsTo<TextChannel, $this> */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(TextChannel::class, 'channel_id');
    }
}
