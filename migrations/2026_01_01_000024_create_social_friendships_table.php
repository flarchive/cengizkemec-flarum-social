<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_friendships', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('friend_id');
    $table->string('status', 20)->default('pending');
    $table->unsignedInteger('acted_by')->nullable();
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->unique(['user_id', 'friend_id']);
    $table->index(['friend_id', 'status']);
});
