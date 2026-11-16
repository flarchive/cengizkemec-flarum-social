<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_posts', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->text('body')->nullable();
    $table->string('visibility', 20)->default('public');
    $table->boolean('is_pinned')->default(false);
    $table->boolean('is_announcement')->default(false);
    $table->unsignedInteger('comments_count')->default(0);
    $table->unsignedInteger('reactions_count')->default(0);
    $table->json('hashtags')->nullable();
    $table->json('mentions')->nullable();
    $table->dateTime('edited_at')->nullable();
    $table->dateTime('deleted_at')->nullable();
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->index(['user_id', 'created_at']);
    $table->index(['visibility', 'created_at']);
    $table->index('created_at');
    $table->index('deleted_at');
});
