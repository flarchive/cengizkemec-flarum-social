<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class MessageRead extends AbstractModel
{
    protected $table = 'social_message_reads';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'last_read_at' => 'datetime',
    ];
}
