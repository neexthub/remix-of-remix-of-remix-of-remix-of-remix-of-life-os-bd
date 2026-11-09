<?php
declare(strict_types=1);

use LifeOS\Auth;
use LifeOS\DB;
use LifeOS\Http;
use LifeOS\HttpError;
use LifeOS\Merchant;
use LifeOS\ServerUrls;

$router->get('/api/admin/merchant-api', function () {
    Auth::admin();
    $base = ServerUrls::backendBase();
    Http::ok([
        'enabled' => Merchant::enabled(),
        'endpoint' => $base . '/api/public/merchant/cashback/debit',
        'status_endpoint' => $base . '/api/public/merchant/cashback/status',
        'keys' => DB::all('SELECT id, name, key_prefix, status, created_at, last_used_at, revoked_at FROM lo_merchant_api_keys ORDER BY id DESC LIMIT 100'),
        'debits' => DB::all('SELECT d.id, d.debit_code, d.request_id, d.life_id, d.amount, d.balance_after, d.created_at, k.name AS merchant_name FROM lo_merchant_cashback_debits d JOIN lo_merchant_api_keys k ON k.id = d.merchant_key_id ORDER BY d.id DESC LIMIT 200'),
    ]);
});

$router->post('/api/admin/merchant-api/keys', function () {
    $admin = Auth::admin();
    $name = trim((string) (Http::body()['name'] ?? ''));
    if (mb_strlen($name) < 2 || mb_strlen($name) > 100) throw new HttpError('Merchant name must be 2–100 characters', 422);
    $plain = 'losm_' . bin2hex(random_bytes(24));
    $id = DB::insert('INSERT INTO lo_merchant_api_keys (name, key_prefix, key_hash, created_by) VALUES (?,?,?,?)', [$name, substr($plain, 0, 13), hash('sha256', $plain), (int) $admin['id']]);
    adminAudit($admin, 'MERCHANT_KEY_CREATE:' . $id, 0);
    // The database stores only SHA-256. This plaintext is returned once and cannot be recovered later.
    Http::ok(['id' => $id, 'name' => $name, 'api_key' => $plain, 'notice' => 'Copy this key now. It will not be shown again.']);
});

$router->post('/api/admin/merchant-api/keys/{id}/revoke', function ($p) {
    $admin = Auth::admin();
    $id = (int) $p['id'];
    if (!DB::run("UPDATE lo_merchant_api_keys SET status = 'REVOKED', revoked_at = NOW() WHERE id = ? AND status = 'ACTIVE'", [$id])) throw new HttpError('Active API key not found', 404);
    adminAudit($admin, 'MERCHANT_KEY_REVOKE:' . $id, 0);
    Http::ok(['revoked' => true]);
});

$router->post('/api/admin/merchant-api/toggle', function () {
    $admin = Auth::admin();
    $enabled = Http::body()['enabled'] ?? null;
    if (!is_bool($enabled)) throw new HttpError('enabled must be true or false', 422);
    if ($enabled && !DB::one("SELECT id FROM lo_merchant_api_keys WHERE status = 'ACTIVE' LIMIT 1")) throw new HttpError('Create an API key before enabling the merchant API', 422);
    DB::run("INSERT INTO lo_settings (k, v) VALUES ('merchant_api_status', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [$enabled ? '1' : '0']);
    adminAudit($admin, 'MERCHANT_API_' . ($enabled ? 'ENABLE' : 'DISABLE'), 0);
    Http::ok(['enabled' => $enabled]);
});

$router->post('/api/public/merchant/cashback/debit', function () {
    header('Cache-Control: no-store');
    Http::ok(Merchant::debit(Http::body()));
});

$router->get('/api/public/merchant/cashback/status', function () {
    header('Cache-Control: no-store');
    if (!Merchant::enabled()) throw new HttpError('Merchant cashback API is disabled', 403);
    $key = Merchant::key();
    $requestId = Merchant::requestId($_GET['request_id'] ?? null);
    $row = DB::one('SELECT * FROM lo_merchant_cashback_debits WHERE merchant_key_id = ? AND request_id = ?', [(int) $key['id'], $requestId]);
    if (!$row) throw new HttpError('Cashback debit not found', 404);
    Http::ok(Merchant::response($row, true));
});
