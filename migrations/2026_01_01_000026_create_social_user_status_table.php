<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_user_status', function (Blueprint $table) {
    $table->unsignedInteger('user_id')->primary();
    $table->dateTime('last_online_at')->nullable();
    $table->string('status', 40)->default('offline');
    $table->dateTime('updated_at')->nullable();

    $table->index('last_online_at');
});
