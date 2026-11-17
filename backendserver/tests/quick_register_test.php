<?php
declare(strict_types=1);
/**
 * Login-page quick sign-up rules. Needs the local API on 127.0.0.1:8090 with at least one member.
 * Usage: php backendserver/tests/quick_register_test.php <sponsor Account ID or referral code>
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
$tag = (string) random_int(100000, 999999);
$base = ['quick' => 1, 'name' => 'Quick', 'password' => '1111', 'confirm_password' => '1111', 'referral_code' => $sponsor];

$r = call('POST', '/register', $base + ['phone' => "p$tag", 'email' => "e$tag", 'team' => 'L']);
check('free-form phone/email accepted (no format check)', ($r['ok'] ?? false) === true);
$r = call('POST', '/register', $base + ['phone' => "p$tag", 'email' => "x$tag", 'team' => 'R']);
check('same phone rejected', ($r['error'] ?? '') === 'Phone already registered');
$r = call('POST', '/register', $base + ['phone' => "q$tag", 'email' => "e$tag", 'team' => 'R']);
check('same email rejected', ($r['error'] ?? '') === 'Email already registered');
$r = call('POST', '/register', $base + ['phone' => "r$tag", 'email' => "r$tag"]);
check('Left/Right is required', ($r['error'] ?? '') === 'Choose Left or Right team');
$r = call('POST', '/register', ['referral_code' => ''] + $base + ['phone' => "s$tag", 'email' => "s$tag", 'team' => 'L']);
check('referral code is required', ($r['error'] ?? '') === 'referral_code required');
$r = call('GET', "/register/check?phone=p$tag&email=none$tag");
check('check reports taken phone and free email', ($r['data']['phone_taken'] ?? null) === true && ($r['data']['email_taken'] ?? null) === false);
exit($fail ? 1 : 0);
