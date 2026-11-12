<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_direct_messages', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('conversation_id');
    $table->unsignedInteger('user_id');
    $table->text('body');
    $table->dateTime('edited_at')->nullable();
    $table->dateTime('deleted_at')->nullable();
    $table->dateTime('created_at')->nullable();

    $table->index(['conversation_id', 'id']);
    $table->index('user_id');
});
