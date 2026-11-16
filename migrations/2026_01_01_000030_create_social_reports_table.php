<?php

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('social_reports', function (Blueprint $table) {
    $table->increments('id');
    $table->unsignedInteger('reporter_id');
    $table->string('reportable_type', 40);
    $table->unsignedInteger('reportable_id');
    $table->string('reason', 40);
    $table->text('details')->nullable();
    $table->string('status', 20)->default('open');
    $table->unsignedInteger('resolved_by')->nullable();
    $table->dateTime('resolved_at')->nullable();
    $table->dateTime('created_at')->nullable();

    $table->index(['status', 'created_at']);
    $table->index(['reportable_type', 'reportable_id']);
    $table->index('reporter_id');
});
