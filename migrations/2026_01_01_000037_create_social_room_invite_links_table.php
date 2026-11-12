<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_room_invite_links', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('room_id');
    $table->unsignedInteger('creator_id');
    $table->string('token', 64)->unique();
    $table->dateTime('expires_at')->nullable();
    $table->unsignedInteger('max_uses')->default(0);
    $table->unsignedInteger('uses')->default(0);
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->index('room_id');
});
