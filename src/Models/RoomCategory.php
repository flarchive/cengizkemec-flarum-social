<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoomCategory extends AbstractModel
{
    protected $table = 'social_room_categories';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'sort_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** @return HasMany<Room, $this> */
    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class, 'category_id');
    }
}
