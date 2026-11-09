<?php
declare(strict_types=1);
/**
 * E wallet -> D wallet swap (4%), fixed 10% E wallet withdrawal charge, and old-site login compatibility.
 * Run on a fresh local DB with the API up (same setup as run_tests.php).
 */
require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/captcha_helpers.php';
use LifeOS\DB;

const BASE = 'http://127.0.0.1:8090';
$fail = 0; $n = 0;
function check(string $name, bool $ok, string $d = ''): void { global $fail, $n; $n++; if (!$ok) $fail++; echo ($ok ? 'ok    ' : 'FAIL  ') . "$name $d\n"; }
function api(string $m, string $p, ?array $b = null, ?string $t = null): array {
    $ch = curl_init(BASE . $p);
    $h = ['Content-Type: application/json']; if ($t) $h[] = "Authorization: Bearer $t";
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $m, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $h, CURLOPT_POSTFIELDS => $b === null ? null : json_encode($b)]);
    $raw = (string) curl_exec($ch); $s = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    return ['status' => $s, 'json' => json_decode($raw, true) ?? [], 'raw' => $raw];
}
function mk(string $life, string $phone, string $pw): int {
    DB::run("DELETE FROM users WHERE life_id = ?", [$life]);
    return DB::insert("INSERT INTO users (life_id, membership_no, referral_code, phone, pin_hash, transaction_password_hash, status, accepted_terms, rank_id) VALUES (?,?,?,?,?,?,'active',1,1)",
        [$life, 'LMP-' . substr(md5($life), 0, 6), 'LIFE-' . substr(md5($life), 6, 5), $phone, password_hash($pw, PASSWORD_DEFAULT), password_hash('5555', PASSWORD_DEFAULT)]);
}
function login(string $u, string $pw): array { return api('POST', '/api/member/login', ['username' => $u, 'password' => $pw] + captchaBody()); }

$a = mk('LID-2099-ABC123', '01799990000', 'pass1');
$b = mk('LID-2099-ABC124', '01799990000', 'pass2');
DB::run("INSERT INTO lo_ledger (payout_code, user_id, ledger_type, amount, status, note) VALUES (?, ?, 'ADJUSTMENT', 2000, 'PAID', 'test fund')", ['T-FUND-' . $a, $a]);

// ---- Login compatibility ----
check('Life ID without dashes logs in', login('LID2099ABC123', 'pass1')['status'] === 200);
check('Password with surrounding spaces logs in', login('LID-2099-ABC123', ' pass1 ')['status'] === 200);
$shared = login('01799990000', 'pass2');
check('Shared phone resolves to the account whose password matches', $shared['status'] === 200 && ($shared['json']['data']['life_id'] ?? ($shared['json']['data']['member']['life_id'] ?? '')) !== 'LID-2099-ABC123', substr($shared['raw'], 0, 120));
check('Wrong password still rejected', login('LID-2099-ABC123', 'nope')['status'] === 401);

$tok = login('LID-2099-ABC123', 'pass1')['json']['data']['token'] ?? '';
$w = fn () => api('GET', '/api/member/wallet', null, $tok)['json']['data'];

// ---- E -> D swap, 4% charge ----
check('Swap needs the correct transaction password', api('POST', '/api/member/wallet-swap', ['amount' => 100, 'transaction_password' => '0000'], $tok)['status'] === 403);
$s = api('POST', '/api/member/wallet-swap', ['amount' => 1000, 'transaction_password' => '5555'], $tok);
check('Swap 1000 charges 40 and credits 960', $s['status'] === 200 && (float) $s['json']['data']['charge'] === 40.0 && (float) $s['json']['data']['credited'] === 960.0, $s['raw']);
$x = $w();
check('E wallet 2000 -> 1000 after swap', abs($x['withdrawable'] - 1000) < 0.001, (string) $x['withdrawable']);
check('D wallet receives 960', abs($x['deposit_balance'] - 960) < 0.001, (string) $x['deposit_balance']);
check('Swap above E wallet balance rejected', api('POST', '/api/member/wallet-swap', ['amount' => 1000.01, 'transaction_password' => '5555'], $tok)['status'] === 422);
check('Swap history lists the swap', count(api('GET', '/api/member/wallet-swap', null, $tok)['json']['data'] ?? []) === 1);

// ---- E wallet withdrawal, fixed 10% charge reserved with the amount ----
$r = api('POST', '/api/member/withdrawals', ['method' => 'bKash', 'account_number' => '01700000000', 'amount' => 500], $tok);
check('Withdrawal 500 accepted', $r['status'] === 200, $r['raw']);
check('Withdrawal charge recorded as 50 (10%)', (float) DB::val('SELECT charge FROM lo_withdrawals WHERE id = ?', [(int) ($r['json']['data']['withdrawal_id'] ?? 0)]) === 50.0);
check('E wallet 1000 -> 450 (amount + charge)', abs($w()['withdrawable'] - 450) < 0.001, (string) $w()['withdrawable']);
check('Settings report 10% charge', api('GET', '/api/member/settings', null, $tok)['json']['data']['withdraw_charge_pct'] === '10');

echo "\n$n checks, $fail failures\n";
exit($fail ? 1 : 0);
