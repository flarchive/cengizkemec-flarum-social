<?php

namespace CengizKemec\Social\Models;

use Flarum\Database\AbstractModel;

class VoiceActivity extends AbstractModel
{
    protected $table = 'social_voice_activity';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'seconds' => 'integer',
        'sessions' => 'integer',
        'updated_at' => 'datetime',
    ];
}
