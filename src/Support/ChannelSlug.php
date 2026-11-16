<?php

namespace CengizKemec\Social\Support;

use CengizKemec\Social\Models\TextChannel;
use Illuminate\Support\Str;

class ChannelSlug
{
    public static function normalize(string $value): string
    {
        return mb_substr(Str::slug($value) ?: 'channel', 0, 100);
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
        $query = TextChannel::query()->where('slug', $slug);

        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

        return $query->exists();
    }
}
