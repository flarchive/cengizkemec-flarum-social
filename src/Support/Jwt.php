<?php

namespace CengizKemec\Social\Support;

/**
 * Minimal, dependency-free Ed25519-free LiveKit HS256 JWT signer.
 * The API secret never leaves the server.
 */
class Jwt
{
    public static function encode(array $payload, string $secret): string
    {
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $segments = [
            self::base64Url(json_encode($header, JSON_UNESCAPED_SLASHES)),
            self::base64Url(json_encode($payload, JSON_UNESCAPED_SLASHES)),
        ];

        $signature = hash_hmac('sha256', implode('.', $segments), $secret, true);
        $segments[] = self::base64Url($signature);

        return implode('.', $segments);
    }

    public static function decode(string $token, string $secret): ?array
    {
        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $signature] = $parts;
        $expected = self::base64Url(hash_hmac('sha256', $header.'.'.$payload, $secret, true));

        if (! hash_equals($expected, $signature)) {
            return null;
        }

        $decoded = json_decode(self::base64UrlDecode($payload), true);

        return is_array($decoded) ? $decoded : null;
    }

    public static function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    public static function base64UrlDecode(string $value): string
    {
        return base64_decode(strtr($value, '-_', '+/')) ?: '';
    }
}
