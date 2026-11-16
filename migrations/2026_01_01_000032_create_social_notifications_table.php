<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_notifications', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('actor_id')->nullable();
    $table->string('type', 40);
    $table->string('subject_type', 40)->nullable();
    $table->unsignedInteger('subject_id')->nullable();
    $table->json('data')->nullable();
    $table->dateTime('read_at')->nullable();
    $table->dateTime('created_at')->nullable();

    $table->index(['user_id', 'read_at', 'created_at']);
    $table->index(['subject_type', 'subject_id']);
});
