<?php

use Illuminate\Database\Schema\Builder;
use Illuminate\Support\Str;

return [
    'up' => function (Builder $schema) {
        $db = $schema->getConnection();
        $used = [];

        foreach ($db->table('social_rooms')->orderBy('id')->get() as $room) {
            $current = trim((string) ($room->slug ?? ''));
            $defaultIdSlug = 'room-'.$room->id;

            if ($current !== '' && $current !== $defaultIdSlug) {
                $used[$current] = true;
                continue;
            }

            $base = mb_substr(Str::slug($room->name ?: 'room') ?: 'room', 0, 90);
            $slug = $base;
            $i = 2;

            while (isset($used[$slug]) || $db->table('social_rooms')->where('slug', $slug)->where('id', '!=', $room->id)->exists()) {
                $slug = $base.'-'.$i++;
            }

            $used[$slug] = true;
            $db->table('social_rooms')->where('id', $room->id)->update(['slug' => $slug]);
        }
    },
    'down' => function (Builder $schema) {
        // Slugs are public URLs. Keep them when rolling back.
    },
];
