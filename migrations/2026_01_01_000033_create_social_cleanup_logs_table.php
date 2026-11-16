<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_cleanup_logs', function (Blueprint $table) {
    $table->increments('id');
    $table->string('type', 30)->default('media');
    $table->boolean('dry_run')->default(false);
    $table->json('stats')->nullable();
    $table->unsignedInteger('duration_ms')->default(0);
    $table->dateTime('created_at')->nullable();

    $table->index('created_at');
});
