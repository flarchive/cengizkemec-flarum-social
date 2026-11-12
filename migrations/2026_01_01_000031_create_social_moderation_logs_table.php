<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_moderation_logs', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('actor_id');
    $table->string('action', 60);
    $table->string('target_type', 40)->nullable();
    $table->unsignedInteger('target_id')->nullable();
    $table->json('meta')->nullable();
    $table->dateTime('created_at')->nullable();

    $table->index(['target_type', 'target_id']);
    $table->index('created_at');
});
