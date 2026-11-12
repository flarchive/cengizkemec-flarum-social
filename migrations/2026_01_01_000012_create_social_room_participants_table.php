<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_room_participants', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('room_id');
    $table->unsignedInteger('user_id');
    $table->string('role', 20)->default('member');
    $table->boolean('muted')->default(true);
    $table->dateTime('joined_at')->nullable();
    $table->dateTime('last_seen_at')->nullable();

    $table->unique(['room_id', 'user_id']);
    $table->index(['room_id', 'last_seen_at']);
    $table->index('user_id');
});
