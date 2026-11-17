<?php
declare(strict_types=1);
/**
 * Account ID rules. Needs the local API on 127.0.0.1:8090 (same database as backendserver/config) with at least one member.
 * Usage: php backendserver/tests/member_id_format_test.php <sponsor Account ID or referral code>
 */
const BASE = 'http://127.0.0.1:8090/api/member';
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/captcha_helpers.php';
use LifeOS\Username;

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

check('LO12345678 maps to LID-2026-12345678', Username::normalize('LO12345678') === 'LID-2026-12345678');
check('dashless old ID keeps its letters', Username::normalize('lid2026937ccc') === 'LID-2026-937CCC');

$preview = call('GET', '/username/new')['data'] ?? [];
check('Register Form preview is a 6-digit number', (bool) preg_match('/^[1-9]\d{5}$/', (string) ($preview['username'] ?? '')));
$n = random_int(10000000, 99999999);
$r = call('POST', '/register', ['name' => 'ID Format', 'phone' => "017$n", 'email' => "id$n@example.com", 'password' => 'pass1234', 'confirm_password' => 'pass1234',
    'accepted_terms' => 1, 'referral_code' => $sponsor, 'team' => 'L', 'username' => $preview['username'] ?? '', 'username_token' => $preview['username_token'] ?? '']);
check('saved Account ID equals the ID shown on the form', ($r['data']['life_id'] ?? null) === ($preview['username'] ?? 'x') && ($r['data']['username'] ?? null) === ($preview['username'] ?? 'x'));
$login = call('POST', '/login', ['username' => $preview['username'] ?? '', 'password' => 'pass1234'] + captchaBody());
check('member logs in with that Account ID', !empty($login['data']['token']));
$sp = call('GET', '/sponsor?code=' . urlencode((string) ($preview['username'] ?? '')) . '&team=R');
check('the new ID works as a sponsor code', ($sp['data']['life_id'] ?? null) === ($preview['username'] ?? 'x'));
exit($fail ? 1 : 0);
