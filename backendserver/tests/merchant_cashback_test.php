<?php
declare(strict_types=1);
/** Run against the isolated local API/database, never against a live member database. */
require __DIR__ . '/../src/bootstrap.php';
use LifeOS\DB;
use LifeOS\Engine\Wallet;
const BASE = 'http://127.0.0.1:8090';
$fail = 0; $tests = 0;
function check(string $name, bool $ok, string $detail = ''): void { global $fail, $tests; $tests++; if (!$ok) $fail++; echo ($ok ? 'ok    ' : 'FAIL  ') . $name . ($detail ? " — $detail" : '') . "\n"; }
function request(string $method, string $path, ?array $body = null, array $headers = []): array {
    $ch = curl_init(BASE . $path);
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers), CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body)]);
    $raw = (string) curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return ['status' => $status, 'json' => json_decode($raw, true) ?? [], 'raw' => $raw];
}
function admin(string $method, string $path, ?array $body, string $token): array { return request($method, $path, $body, ["Authorization: Bearer $token"]); }
function merchant(string $path, ?array $body, string $key, string $method = 'POST'): array { return request($method, $path, $body, ["X-Merchant-Key: $key"]); }

$login = admin('POST', '/api/admin/login', ['email' => 'admin@lifeos.test', 'password' => 'admin123'], '');
$token = $login['json']['data']['token'] ?? '';
check('Admin login for isolated merchant tests', $token !== '');
$life = 'LID-2099-MRC001';
DB::run('DELETE FROM users WHERE life_id = ?', [$life]);
$uid = DB::insert("INSERT INTO users (life_id, membership_no, referral_code, phone, pin_hash, status, accepted_terms) VALUES (?,?,?,?,?,'active',1)", [$life, 'MRC-2099-1', 'MRC-TEST-1', '01799991111', password_hash('member-pass', PASSWORD_DEFAULT)]);
DB::insert("INSERT INTO lo_ledger (payout_code, user_id, ledger_type, amount, status, note) VALUES (?,?,'CASHBACK',1000,'PAID','merchant test fund')", ['MCB-FUND-' . $uid, $uid]);
DB::insert("INSERT INTO lo_ledger (payout_code, user_id, ledger_type, amount, status, note) VALUES (?,?,'ADJUSTMENT',500,'PAID','unchanged E wallet')", ['MCB-E-' . $uid, $uid]);
DB::insert("INSERT INTO lo_deposits (deposit_code, user_id, kind, amount, note) VALUES (?,?,'ADMIN_ADD',80,'unchanged D wallet')", ['MCB-D-' . $uid, $uid]);

$created = admin('POST', '/api/admin/merchant-api/keys', ['name' => 'Isolated Merchant QA'], $token);
$key = $created['json']['data']['api_key'] ?? '';
check('Admin generates a merchant API key', $created['status'] === 200 && preg_match('/^losm_[a-f0-9]{48}$/', $key) === 1, $created['raw']);
$keyId = (int) ($created['json']['data']['id'] ?? 0);
check('Only the key hash is stored', DB::val('SELECT key_hash FROM lo_merchant_api_keys WHERE id = ?', [$keyId]) === hash('sha256', $key));
$listed = admin('GET', '/api/admin/merchant-api', null, $token);
check('Admin list never exposes plaintext or hash', !str_contains($listed['raw'], $key) && !str_contains($listed['raw'], hash('sha256', $key)));
check('Admin URLs use current host', ($listed['json']['data']['endpoint'] ?? '') === 'http://127.0.0.1:8090/api/public/merchant/cashback/debit', $listed['raw']);
$body = ['life_id' => $life, 'password' => 'member-pass', 'amount' => 250, 'request_id' => 'QA-ORDER-000001'];
check('Disabled merchant API rejects debit', merchant('/api/public/merchant/cashback/debit', $body, $key)['status'] === 403);
$enabled = admin('POST', '/api/admin/merchant-api/toggle', ['enabled' => true], $token);
check('Admin enables the API after key creation', $enabled['status'] === 200 && ($enabled['json']['data']['enabled'] ?? false) === true);
check('Wrong API key is rejected', merchant('/api/public/merchant/cashback/debit', $body, 'losm_' . str_repeat('0', 48))['status'] === 401);
check('Wrong member password is rejected', merchant('/api/public/merchant/cashback/debit', array_merge($body, ['password' => 'wrong']), $key)['status'] === 401);
$debit = merchant('/api/public/merchant/cashback/debit', ['life_id' => 'LID2099MRC001', 'password' => ' member-pass ', 'amount' => 250, 'request_id' => 'QA-ORDER-000001'], $key);
check('Dashless Life ID debit succeeds', $debit['status'] === 200 && ($debit['json']['data']['status'] ?? '') === 'SUCCESS', $debit['raw']);
check('Debit leaves exactly 750 cashback', abs((float) ($debit['json']['data']['cashback_balance_after'] ?? 0) - 750) < 0.001 && abs(Wallet::service($uid) - 750) < 0.001);
check('Merchant debit does not touch E wallet', abs(Wallet::available($uid) - 500) < 0.001);
check('Merchant debit does not touch D wallet', abs(Wallet::deposit($uid) - 80) < 0.001);
$replay = merchant('/api/public/merchant/cashback/debit', $body, $key);
check('Identical retry returns original debit as duplicate', $replay['status'] === 200 && ($replay['json']['data']['duplicate'] ?? false) === true && ($replay['json']['data']['debit_code'] ?? '') === ($debit['json']['data']['debit_code'] ?? ''), $replay['raw']);
check('Retry cannot deduct twice', abs(Wallet::service($uid) - 750) < 0.001 && (int) DB::val('SELECT COUNT(*) FROM lo_merchant_cashback_debits WHERE user_id = ?', [$uid]) === 1);
$conflict = merchant('/api/public/merchant/cashback/debit', array_merge($body, ['amount' => 251]), $key);
check('Same request ID with changed amount is rejected', $conflict['status'] === 409, $conflict['raw']);
$tooMuch = ['life_id' => $life, 'password' => 'member-pass', 'amount' => 750.001, 'request_id' => 'QA-ORDER-000002'];
check('Amount above available cashback is rejected', merchant('/api/public/merchant/cashback/debit', $tooMuch, $key)['status'] === 422);
check('Failed debit creates no success record', merchant('/api/public/merchant/cashback/status?request_id=QA-ORDER-000002', null, $key, 'GET')['status'] === 404);
$status = merchant('/api/public/merchant/cashback/status?request_id=QA-ORDER-000001', null, $key, 'GET');
check('Status endpoint recovers the original debit', $status['status'] === 200 && ($status['json']['data']['amount'] ?? 0) == 250, $status['raw']);
check('Invalid request ID is rejected', merchant('/api/public/merchant/cashback/debit', array_merge($body, ['request_id' => 'short']), $key)['status'] === 422);
check('More than three decimal places is rejected', merchant('/api/public/merchant/cashback/debit', array_merge($body, ['request_id' => 'QA-ORDER-000003', 'amount' => 1.2345]), $key)['status'] === 422);
DB::run("UPDATE users SET status='suspended' WHERE id = ?", [$uid]);
check('Suspended member cannot spend cashback', merchant('/api/public/merchant/cashback/debit', array_merge($body, ['request_id' => 'QA-ORDER-000004']), $key)['status'] === 403);
DB::run("UPDATE users SET status='active' WHERE id = ?", [$uid]);
$revoked = admin('POST', "/api/admin/merchant-api/keys/$keyId/revoke", [], $token);
check('Admin revokes the key', $revoked['status'] === 200);
check('Revoked key cannot debit', merchant('/api/public/merchant/cashback/debit', array_merge($body, ['request_id' => 'QA-ORDER-000005']), $key)['status'] === 401);
admin('POST', '/api/admin/merchant-api/toggle', ['enabled' => false], $token);
DB::run('DELETE FROM users WHERE id = ?', [$uid]);
DB::run('DELETE FROM lo_merchant_api_keys WHERE id = ?', [$keyId]);
echo "\n$tests checks, $fail failures\n";
exit($fail ? 1 : 0);
