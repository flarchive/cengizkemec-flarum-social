<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_voice_activity', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('room_id');
    $table->unsignedBigInteger('seconds')->default(0);
    $table->unsignedInteger('sessions')->default(0);
    $table->dateTime('updated_at')->nullable();

    $table->unique(['user_id', 'room_id']);
    $table->index('seconds');
    $table->index('room_id');
});
