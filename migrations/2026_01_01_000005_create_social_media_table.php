<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_media', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->string('disk', 40)->default('social-public');
    $table->string('path', 255);
    $table->string('thumbnail_path', 255)->nullable();
    $table->string('original_name', 255)->nullable();
    $table->string('mime', 100);
    $table->string('extension', 20);
    $table->string('type', 20)->default('image');
    $table->unsignedBigInteger('size')->default(0);
    $table->unsignedInteger('width')->nullable();
    $table->unsignedInteger('height')->nullable();
    $table->unsignedInteger('duration')->nullable();
    $table->string('visibility', 20)->default('private');
    $table->string('status', 20)->default('temporary');
    $table->dateTime('expires_at')->nullable();
    $table->dateTime('last_referenced_at')->nullable();
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->index(['user_id', 'created_at']);
    $table->index(['status', 'expires_at']);
    $table->index(['visibility', 'status']);
});
