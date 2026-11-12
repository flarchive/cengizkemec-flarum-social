<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class DirectParticipant extends AbstractModel
{
    protected $table = 'social_direct_participants';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'last_read_at' => 'datetime',
    ];
}
