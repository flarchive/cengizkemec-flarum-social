<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TextChannel extends AbstractModel
{
    protected $table = 'social_text_channels';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'position' => 'integer',
        'is_default' => 'boolean',
        'is_locked' => 'boolean',
        'allowed_groups' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class, 'room_id');
    }

    /** @return BelongsTo<RoomCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(RoomCategory::class, 'category_id');
    }
}
