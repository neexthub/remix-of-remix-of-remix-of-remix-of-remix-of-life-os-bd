<?php
declare(strict_types=1);
namespace LifeOS;

use LifeOS\Engine\Wallet;

/** Server-to-server cashback debit for the Life OS BD merchant application. */
final class Merchant
{
    public static function enabled(): bool
    {
        return DB::val("SELECT v FROM lo_settings WHERE k = 'merchant_api_status'") === '1';
    }

    public static function key(): array
    {
        $header = (string) ($_SERVER['HTTP_X_MERCHANT_KEY'] ?? '');
        if ($header === '') {
            $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
            if (preg_match('/^Bearer\s+(\S+)$/i', $auth, $m)) $header = $m[1];
        }
        if (!preg_match('/\Alosm_[a-f0-9]{48}\z/', $header)) throw new HttpError('Invalid merchant API key', 401);
        $key = DB::one("SELECT * FROM lo_merchant_api_keys WHERE key_hash = ? AND status = 'ACTIVE'", [hash('sha256', $header)]);
        if (!$key) throw new HttpError('Invalid or revoked merchant API key', 401);
        return $key;
    }

    public static function amount(mixed $raw): float
    {
        if (!is_int($raw) && !is_float($raw) && !is_string($raw)) throw new HttpError('amount must be a positive number', 422);
        $text = trim((string) $raw);
        if (!preg_match('/\A\d+(?:\.\d{1,3})?\z/', $text)) throw new HttpError('amount allows at most 3 decimal places', 422);
        $amount = round((float) $text, 3);
        if (!is_finite($amount) || $amount <= 0 || $amount > 1000000) throw new HttpError('amount must be between 0.001 and 1000000', 422);
        return $amount;
    }

    public static function requestId(mixed $raw): string
    {
        if (!is_string($raw) || !preg_match('/\A[A-Za-z0-9._:-]{8,80}\z/', $raw)) throw new HttpError('request_id must be 8–80 letters, numbers, dot, underscore, colon or dash', 422);
        return $raw;
    }

    public static function response(array $row, bool $duplicate = false): array
    {
        return [
            'status' => 'SUCCESS', 'debit_code' => $row['debit_code'], 'request_id' => $row['request_id'],
            'life_id' => $row['life_id'], 'amount' => (float) $row['amount'],
            'cashback_balance_after' => (float) $row['balance_after'], 'duplicate' => $duplicate,
            'message' => 'Cashback debit confirmed. Credit the merchant-app account exactly once.',
        ];
    }

    public static function debit(array $body): array
    {
        if (!self::enabled()) throw new HttpError('Merchant cashback API is disabled', 403);
        $key = self::key();
        $requestId = self::requestId($body['request_id'] ?? null);
        $login = trim((string) ($body['life_id'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $amount = self::amount($body['amount'] ?? null);
        if ($login === '' || strlen($login) > 80 || $password === '' || strlen($password) > 72) throw new HttpError('life_id and password are required', 422);
        $dashed = Username::normalize($login);
        $requestHash = hash('sha256', $dashed . '|' . number_format($amount, 3, '.', ''));

        return DB::tx(function () use ($key, $requestId, $login, $dashed, $password, $amount, $requestHash) {
            $existing = DB::one('SELECT * FROM lo_merchant_cashback_debits WHERE merchant_key_id = ? AND request_id = ? FOR UPDATE', [(int) $key['id'], $requestId]);
            if ($existing) {
                if (!hash_equals((string) $existing['request_hash'], $requestHash)) throw new HttpError('request_id was already used for a different member or amount', 409);
                return self::response($existing, true);
            }
            // Lock before checking the password and computed balance so concurrent calls cannot overspend it.
            $users = DB::all('SELECT * FROM users WHERE life_id = ? OR life_id = ? ORDER BY id LIMIT 2', [$login, $dashed]);
            $user = null;
            foreach ($users as $row) {
                if (password_verify($password, (string) $row['pin_hash']) || (trim($password) !== $password && password_verify(trim($password), (string) $row['pin_hash']))) { $user = $row; break; }
            }
            if (!$user) throw new HttpError('Invalid member credentials', 401);
            DB::one('SELECT id FROM users WHERE id = ? FOR UPDATE', [(int) $user['id']]);
            // A concurrent retry may have committed while this request waited for the member lock.
            $existing = DB::one('SELECT * FROM lo_merchant_cashback_debits WHERE merchant_key_id = ? AND request_id = ?', [(int) $key['id'], $requestId]);
            if ($existing) {
                if (!hash_equals((string) $existing['request_hash'], $requestHash)) throw new HttpError('request_id was already used for a different member or amount', 409);
                return self::response($existing, true);
            }
            if ($user['status'] === 'suspended') throw new HttpError('Member account is suspended', 403);
            $available = Wallet::service((int) $user['id']);
            if ($amount > $available + 1e-9) throw new HttpError('Insufficient cashback balance', 422);
            $after = round($available - $amount, 3);
            $code = 'MCB-' . strtoupper(bin2hex(random_bytes(12)));
            DB::insert('INSERT INTO lo_merchant_cashback_debits (debit_code, merchant_key_id, user_id, life_id, request_id, request_hash, amount, balance_after, ip) VALUES (?,?,?,?,?,?,?,?,?)', [
                $code, (int) $key['id'], (int) $user['id'], $user['life_id'], $requestId, $requestHash, $amount, $after, substr(Http::ip(), 0, 45),
            ]);
            DB::run('UPDATE lo_merchant_api_keys SET last_used_at = NOW() WHERE id = ?', [(int) $key['id']]);
            return self::response(['debit_code' => $code, 'request_id' => $requestId, 'life_id' => $user['life_id'], 'amount' => $amount, 'balance_after' => $after]);
        });
    }
}
