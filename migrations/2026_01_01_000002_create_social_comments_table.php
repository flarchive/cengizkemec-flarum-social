<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_comments', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('post_id');
    $table->unsignedInteger('parent_id')->nullable();
    $table->unsignedInteger('user_id');
    $table->text('body');
    $table->unsignedInteger('reactions_count')->default(0);
    $table->dateTime('edited_at')->nullable();
    $table->dateTime('deleted_at')->nullable();
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->index(['post_id', 'created_at']);
    $table->index('parent_id');
    $table->index('user_id');
});
