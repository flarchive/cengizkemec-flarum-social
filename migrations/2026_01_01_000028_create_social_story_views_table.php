<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_story_views', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('story_id');
    $table->unsignedInteger('user_id');
    $table->dateTime('created_at')->nullable();

    $table->unique(['story_id', 'user_id']);
});
