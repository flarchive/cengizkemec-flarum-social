<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_room_invitations', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('room_id');
    $table->unsignedInteger('inviter_id');
    $table->unsignedInteger('invitee_id');
    $table->string('status', 20)->default('pending');
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->unique(['room_id', 'invitee_id']);
    $table->index(['invitee_id', 'status']);
});
