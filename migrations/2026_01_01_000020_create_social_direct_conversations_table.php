<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_direct_conversations', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('created_by');
    $table->dateTime('last_message_at')->nullable();
    $table->dateTime('created_at')->nullable();
    $table->dateTime('updated_at')->nullable();
});
