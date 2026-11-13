<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        $schema->table('social_text_channels', function (Blueprint $table) {
            $table->unsignedInteger('category_id')->nullable()->after('room_id');
            $table->index('category_id');
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('social_text_channels', function (Blueprint $table) {
            $table->dropIndex(['category_id']);
            $table->dropColumn('category_id');
        });
    },
];
