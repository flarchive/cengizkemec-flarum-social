<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_stories', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->string('type', 20)->default('text');
    $table->unsignedInteger('media_id')->nullable();
    $table->text('body')->nullable();
    $table->string('visibility', 20)->default('members');
    $table->unsignedInteger('views_count')->default(0);
    $table->dateTime('expires_at');
    $table->dateTime('created_at')->nullable();

    $table->index(['user_id', 'expires_at']);
    $table->index('expires_at');
});
