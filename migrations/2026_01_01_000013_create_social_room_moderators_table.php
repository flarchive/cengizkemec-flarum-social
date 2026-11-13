<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_room_moderators', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('room_id');
    $table->unsignedInteger('user_id');
    $table->dateTime('created_at')->nullable();

    $table->unique(['room_id', 'user_id']);
});
