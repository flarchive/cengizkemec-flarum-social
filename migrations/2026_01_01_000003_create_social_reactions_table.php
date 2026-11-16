<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_reactions', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->string('reactable_type', 30);
    $table->unsignedInteger('reactable_id');
    $table->string('type', 20)->default('like');
    $table->dateTime('created_at')->nullable();

    $table->unique(['user_id', 'reactable_type', 'reactable_id'], 'social_reactions_unique');
    $table->index(['reactable_type', 'reactable_id', 'type'], 'social_reactions_subject');
});
