<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_media_references', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('media_id');
    $table->string('reference_type', 40);
    $table->unsignedInteger('reference_id');
    $table->dateTime('created_at')->nullable();

    $table->unique(['media_id', 'reference_type', 'reference_id'], 'social_media_refs_unique');
    $table->index(['reference_type', 'reference_id'], 'social_media_refs_subject');
    $table->index('media_id');
});
