<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_user_preferences', function (Blueprint $table) {
    $table->unsignedInteger('user_id')->primary();
    $table->string('headline', 160)->nullable();
    $table->text('bio')->nullable();
    $table->string('cover_url', 255)->nullable();
    $table->string('custom_status', 120)->nullable();
    $table->string('privacy', 20)->default('public');
    $table->dateTime('restricted_until')->nullable();
    $table->string('restriction_reason', 255)->nullable();
    $table->json('settings')->nullable();
    $table->dateTime('updated_at')->nullable();
});
