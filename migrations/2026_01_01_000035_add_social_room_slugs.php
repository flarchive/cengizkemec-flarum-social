<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;
use Illuminate\Support\Str;

return [
    'up' => function (Builder $schema) {
        $schema->table('social_rooms', function (Blueprint $table) {
            $table->string('slug', 120)->nullable()->after('name');
        });

        $connection = $schema->getConnection();
        $used = [];

        foreach ($connection->table('social_rooms')->orderBy('id')->get() as $room) {
            $base = mb_substr(Str::slug($room->name) ?: 'room', 0, 90);
            $slug = $base;
            $i = 2;

            while (isset($used[$slug]) || $connection->table('social_rooms')->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$i++;
            }

            $used[$slug] = true;
            $connection->table('social_rooms')->where('id', $room->id)->update(['slug' => $slug]);
        }

        $schema->table('social_rooms', function (Blueprint $table) {
            $table->unique('slug');
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('social_rooms', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    },
];
