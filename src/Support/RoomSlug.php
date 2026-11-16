<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\Room;
use Illuminate\Support\Str;

class RoomSlug
{
    public static function normalize(string $value): string
    {
        return mb_substr(Str::slug($value) ?: 'room', 0, 100);
    }

    public static function unique(string $name, ?int $ignoreId = null): string
    {
        $base = self::normalize($name);
        $slug = $base;
        $i = 2;

        while (self::exists($slug, $ignoreId)) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    public static function exists(string $slug, ?int $ignoreId = null): bool
    {
        $query = Room::query()->where('slug', $slug);

        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

        return $query->exists();
    }
}
