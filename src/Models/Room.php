<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends AbstractModel
{
    protected $table = 'social_rooms';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'capacity' => 'integer',
        'is_voice' => 'boolean',
        'is_text' => 'boolean',
        'is_locked' => 'boolean',
        'allow_screen_share' => 'boolean',
        'force_muted' => 'boolean',
        'allowed_groups' => 'array',
        'participant_count' => 'integer',
        'sort_order' => 'integer',
        'expires_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return BelongsTo<RoomCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(RoomCategory::class, 'category_id');
    }

    /** @return HasMany<TextChannel, $this> */
    public function channels(): HasMany
    {
        return $this->hasMany(TextChannel::class, 'room_id');
    }

    /** @return HasMany<RoomParticipant, $this> */
    public function participants(): HasMany
    {
        return $this->hasMany(RoomParticipant::class, 'room_id');
    }

    public function isPermanent(): bool
    {
        return $this->type === 'permanent';
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
