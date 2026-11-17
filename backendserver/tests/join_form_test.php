<?php
declare(strict_types=1);
/**
 * Register Form (/join) rules. Needs the local API on 127.0.0.1:8090 with at least one member.
 * Usage: php backendserver/tests/join_form_test.php <sponsor Account ID or referral code>
 */
const BASE = 'http://127.0.0.1:8090/api/member';
$sponsor = $argv[1] ?? exit("sponsor code required\n");
$fail = 0;
function call(string $method, string $path, ?array $body = null): array {
    $ch = curl_init(BASE . $path);
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body)]);
    $r = json_decode((string) curl_exec($ch), true) ?? [];
    curl_close($ch);
    return $r;
}
function check(string $name, bool $ok): void { global $fail; if (!$ok) $fail++; echo ($ok ? 'ok    ' : 'FAIL  ') . "$name\n"; }
$n = random_int(10000000, 99999999);
$u = call('GET', '/username/new')['data'] ?? [];
$base = ['name' => 'Join Form', 'password' => '1111', 'confirm_password' => '1111', 'accepted_terms' => 1, 'referral_code' => $sponsor,
    'username' => $u['username'] ?? '', 'username_token' => $u['username_token'] ?? ''];

$r = call('POST', '/register', $base + ['phone' => "013$n", 'email' => "j$n@example.com", 'team' => 'R']);
check('joins without blood group, NID, district, post code or address', ($r['ok'] ?? false) === true);
$r = call('POST', '/register', $base + ['phone' => "014$n", 'team' => 'L']);
check('email is still required', ($r['error'] ?? '') === 'email required');
$r = call('POST', '/register', $base + ['phone' => "015$n", 'email' => "k$n@example.com", 'team' => 'L', 'blood_group' => 'ZZ']);
check('a given blood group must still be valid', ($r['error'] ?? '') === 'Invalid blood group');
$r = call('POST', '/register', ['referral_code' => 'NO-SUCH-CODE'] + $base + ['phone' => "016$n", 'email' => "m$n@example.com", 'team' => 'L']);
check('unknown typed sponsor is rejected', ($r['error'] ?? '') === 'Invalid referral code');
exit($fail ? 1 : 0);
