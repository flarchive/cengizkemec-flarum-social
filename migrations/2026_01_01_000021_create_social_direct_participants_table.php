<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_direct_participants', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('conversation_id');
    $table->unsignedInteger('user_id');
    $table->dateTime('last_read_at')->nullable();

    $table->unique(['conversation_id', 'user_id']);
    $table->index('user_id');
});
