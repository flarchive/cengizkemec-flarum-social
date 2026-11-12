<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_room_bans', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('room_id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('actor_id');
    $table->text('reason')->nullable();
    $table->dateTime('expires_at')->nullable();
    $table->dateTime('created_at')->nullable();

    $table->unique(['room_id', 'user_id']);
    $table->index(['room_id', 'expires_at']);
});
