<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_text_channels', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('room_id')->nullable();
    $table->string('name', 100);
    $table->text('description')->nullable();
    $table->string('visibility', 20)->default('members');
    $table->integer('position')->default(0);
    $table->boolean('is_default')->default(false);
    $table->boolean('is_locked')->default(false);
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->index(['room_id', 'position']);
    $table->unique(['room_id', 'name']);
});
