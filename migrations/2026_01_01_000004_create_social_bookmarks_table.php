<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_bookmarks', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('post_id');
    $table->dateTime('created_at')->nullable();

    $table->unique(['user_id', 'post_id']);
    $table->index('post_id');
});
