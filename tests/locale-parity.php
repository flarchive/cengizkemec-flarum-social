<?php

/**
 * Verifies that English and Turkish locale files have identical key trees.
 * Usage: php tests/locale-parity.php
 *
 * This intentionally uses a tiny indentation parser so the check runs on any
 * PHP installation without the optional yaml extension or Flarum vendor tree.
 */

function keysFromFile(string $file): array
{
    $lines = file($file, FILE_IGNORE_NEW_LINES);
    $keys = [];
    $stack = [];

    foreach ($lines as $line) {
        if (trim($line) === '' || str_starts_with(ltrim($line), '#')) {
            continue;
        }

        if (! preg_match('/^(\s*)([^:#]+):\s*(.*)$/', $line, $matches)) {
            continue;
        }

        $indent = strlen($matches[1]);
        $key = trim($matches[2]);
        $value = trim($matches[3]);

        while ($stack && end($stack)['indent'] >= $indent) {
            array_pop($stack);
        }

        $path = array_map(fn ($item) => $item['key'], $stack);
        $path[] = $key;

        if ($value === '') {
            $stack[] = ['indent' => $indent, 'key' => $key];
            continue;
        }

        $keys[] = implode('.', $path);
    }

    return $keys;
}

$root = dirname(__DIR__);
$en = keysFromFile($root.'/locale/en.yml');
$tr = keysFromFile($root.'/locale/tr.yml');

sort($en);
sort($tr);

$missingInTr = array_values(array_diff($en, $tr));
$missingInEn = array_values(array_diff($tr, $en));

if ($missingInTr) {
    echo "Missing in tr.yml:\n  ".implode("\n  ", $missingInTr)."\n";
}

if ($missingInEn) {
    echo "Missing in en.yml:\n  ".implode("\n  ", $missingInEn)."\n";
}

$failed = count($missingInTr) + count($missingInEn);

echo $failed === 0
    ? 'Locale parity OK: '.count($en)." keys in each file.\n"
    : "Locale parity failed: {$failed} difference(s).\n";

exit($failed === 0 ? 0 : 1);
