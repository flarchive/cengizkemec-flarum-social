<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_message_reads', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('channel_id')->nullable();
    $table->unsignedInteger('conversation_id')->nullable();
    $table->unsignedInteger('last_read_message_id')->default(0);
    $table->dateTime('last_read_at')->nullable();

    $table->unique(['user_id', 'channel_id'], 'social_reads_channel_unique');
    $table->unique(['user_id', 'conversation_id'], 'social_reads_conversation_unique');
});
