<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_messages', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('channel_id');
    $table->unsignedInteger('user_id');
    $table->text('body')->nullable();
    $table->unsignedInteger('parent_id')->nullable();
    $table->dateTime('edited_at')->nullable();
    $table->dateTime('deleted_at')->nullable();
    $table->dateTime('created_at')->nullable();

    $table->index(['channel_id', 'id']);
    $table->index('user_id');
    $table->index('created_at');
});
