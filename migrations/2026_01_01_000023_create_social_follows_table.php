<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_follows', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('follower_id');
    $table->unsignedInteger('following_id');
    $table->dateTime('created_at')->nullable();

    $table->unique(['follower_id', 'following_id']);
    $table->index('following_id');
});
