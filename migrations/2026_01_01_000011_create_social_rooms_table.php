<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_rooms', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('category_id')->nullable();
    $table->unsignedInteger('owner_id')->nullable();
    $table->string('type', 20)->default('permanent');
    $table->string('name', 100);
    $table->text('description')->nullable();
    $table->string('icon', 60)->nullable();
    $table->string('visibility', 20)->default('public');
    $table->string('password_hash', 255)->nullable();
    $table->unsignedInteger('capacity')->default(25);
    $table->boolean('is_voice')->default(true);
    $table->boolean('is_text')->default(true);
    $table->boolean('is_locked')->default(false);
    $table->boolean('allow_screen_share')->default(true);
    $table->boolean('force_muted')->default(true);
    $table->json('allowed_groups')->nullable();
    $table->unsignedInteger('participant_count')->default(0);
    $table->integer('sort_order')->default(0);
    $table->string('status', 20)->default('active');
    $table->dateTime('expires_at')->nullable();
    $table->dateTime('last_activity_at')->nullable();
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->index(['type', 'status']);
    $table->index(['category_id', 'sort_order']);
    $table->index('owner_id');
    $table->index('expires_at');
});
