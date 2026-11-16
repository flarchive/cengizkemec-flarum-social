<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;
use Illuminate\Support\Str;

return [
    'up' => function (Builder $schema) {
        $schema->table('social_text_channels', function (Blueprint $table) {
            $table->string('slug', 120)->nullable()->after('name');
            $table->string('icon', 60)->default('fas fa-hashtag')->after('slug');
            $table->json('allowed_groups')->nullable()->after('icon');
        });

        $connection = $schema->getConnection();
        $used = [];

        foreach ($connection->table('social_text_channels')->orderBy('id')->get() as $channel) {
            $base = mb_substr(Str::slug($channel->name) ?: 'channel', 0, 90);
            $slug = $base;
            $i = 2;

            while (isset($used[$slug]) || $connection->table('social_text_channels')->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$i++;
            }

            $used[$slug] = true;
            $connection->table('social_text_channels')->where('id', $channel->id)->update(['slug' => $slug]);
        }

        $schema->table('social_text_channels', function (Blueprint $table) {
            $table->unique('slug');
        });
    },
    'down' => function (Builder $schema) {
        $schema->table('social_text_channels', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn(['slug', 'icon', 'allowed_groups']);
        });
    },
];
