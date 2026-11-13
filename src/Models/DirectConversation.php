<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class DirectConversation extends AbstractModel
{
    protected $table = 'social_direct_conversations';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'last_message_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
