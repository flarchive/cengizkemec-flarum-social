<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_room_categories', function (Blueprint $table) {
    $table->increments('id');
    $table->string('name', 100);
    $table->string('icon', 60)->nullable();
    $table->text('description')->nullable();
    $table->integer('sort_order')->default(0);
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();

    $table->index('sort_order');
});
