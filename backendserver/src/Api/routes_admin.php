<?php
declare(strict_types=1);

use LifeOS\Auth;
use LifeOS\DB;
use LifeOS\Http;
use LifeOS\HttpError;
use LifeOS\Engine\Commission;

/** Admin API. */

$router->post('/api/admin/login', function () {
    $b = Http::body();
    // Admins sign in with their email or their username (admin_users.name).
    $login = trim((string) ($b['email'] ?? ''));
    $a = $login === '' ? null : DB::one('SELECT * FROM admin_users WHERE email = ? OR name = ? ORDER BY (email = ?) DESC, id LIMIT 1', [$login, $login, $login]);
    if (!$a || !password_verify((string) ($b['password'] ?? ''), (string) ($a['password'] ?? ''))) {
        throw new HttpError('Invalid credentials', 401);
    }
    Http::ok(['token' => Auth::issue('a', (int) $a['id']), 'admin' => ['id' => (int) $a['id'], 'name' => $a['name'], 'email' => $a['email']]]);
});

$router->get('/api/admin/overview', function () {
    Auth::admin();
    Http::ok([
        'members' => (int) DB::val('SELECT COUNT(*) FROM users'),
        'active_members' => (int) DB::val('SELECT COUNT(*) FROM lo_tree WHERE is_active = 1'),
        'activations_pending' => (int) DB::val("SELECT COUNT(*) FROM lo_activations WHERE payment_status = 'PENDING'"),
        'matching_paid_total' => (float) DB::val("SELECT COALESCE(SUM(amount),0) FROM lo_ledger WHERE ledger_type = 'MATCHING' AND status = 'PAID'"),
        'pools' => DB::all('SELECT * FROM lo_pools'),
        'withdrawals_pending' => (int) DB::val("SELECT COUNT(*) FROM lo_withdrawals WHERE status = 'PENDING'"),
    ]);
});

$router->get('/api/admin/members', function () {
    Auth::admin();
    $q = '%' . ($_GET['q'] ?? '') . '%';
    Http::ok(DB::all(
        'SELECT u.id, u.life_id, u.phone, u.email, u.status, u.created_at, t.is_active, t.lifetime_matchings
         FROM users u LEFT JOIN lo_tree t ON t.user_id = u.id
         WHERE u.life_id LIKE ? OR u.phone LIKE ? ORDER BY u.id DESC LIMIT 200',
        [$q, $q]
    ));
});

$router->post('/api/admin/members/{id}/status', function ($p) {
    Auth::admin();
    $b = Http::body();
    $status = strtolower((string) ($b['status'] ?? ''));
    if (!in_array($status, ['active', 'suspended', 'pending'], true)) throw new HttpError('Invalid status');
    if (!DB::one('SELECT id FROM users WHERE id = ?', [(int) $p['id']])) throw new HttpError('Member not found', 404);
    DB::run('UPDATE users SET status = ? WHERE id = ?', [$status, (int) $p['id']]);
    Http::ok();
});

function adminAudit(array $admin, string $action, int $userId): void
{
    DB::run('INSERT INTO lo_admin_audit (admin_id, action, user_id, ip) VALUES (?, ?, ?, ?)',
        [(int) $admin['id'], $action, $userId, substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45)]);
}

// Admin sets a new login password for any member (no current password needed).
$router->post('/api/admin/members/{id}/password', function ($p) {
    $admin = Auth::admin();
    $pw = (string) (Http::body()['password'] ?? '');
    if (strlen($pw) < 6 || strlen($pw) > 72) throw new HttpError('New password must be 6–72 characters', 422);
    $id = (int) $p['id'];
    if (!DB::one('SELECT id FROM users WHERE id = ?', [$id])) throw new HttpError('Member not found', 404);
    DB::run('UPDATE users SET pin_hash = ? WHERE id = ?', [password_hash($pw, PASSWORD_DEFAULT), $id]);
    adminAudit($admin, 'SET_PASSWORD', $id);
    Http::ok(['changed' => true]);
});

// One-click login: a short-lived member session for a separate browser tab; the admin session is untouched.
$router->post('/api/admin/members/{id}/login-as', function ($p) {
    $admin = Auth::admin();
    $u = DB::one('SELECT id, life_id, status FROM users WHERE id = ?', [(int) $p['id']]);
    if (!$u) throw new HttpError('Member not found', 404);
    if ($u['status'] === 'suspended') throw new HttpError('Account is suspended — set it Active first', 403);
    adminAudit($admin, 'LOGIN_AS', (int) $u['id']);
    Http::ok(['token' => Auth::issue('m', (int) $u['id'], 60 * 60 * 4, ['imp' => (int) $admin['id']]), 'life_id' => $u['life_id']]);
});

// Payment gateway / manual confirmation: only SUCCESS triggers commissions.
$router->post('/api/admin/activations/{id}/confirm', function ($p) {
    Auth::admin();
    $b = Http::body();
    $status = $b['status'] ?? '';
    if (!in_array($status, ['SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'], true)) throw new HttpError('Invalid status');
    $ref = $b['payment_ref'] ?? null;
    DB::tx(function () use ($p, $status, $ref) {
        $act = DB::one('SELECT * FROM lo_activations WHERE id = ? FOR UPDATE', [(int) $p['id']]);
        if (!$act) throw new HttpError('Activation not found', 404);
        if (in_array($act['payment_status'], ['CANCELLED', 'REFUNDED'], true)) return; // final states
        if ($act['payment_status'] === 'SUCCESS') {
            // Refund/chargeback after success: audited reversal, never deletion.
            if (in_array($status, ['CANCELLED', 'REFUNDED'], true)) Commission::reverseActivation((int) $p['id'], $status);
            return; // duplicate SUCCESS notification ignored
        }
        if ($ref) {
            // Unique payment_ref: same gateway trx can never confirm twice.
            DB::run('UPDATE lo_activations SET payment_ref = ? WHERE id = ?', [$ref, (int) $p['id']]);
        }
        DB::run('UPDATE lo_activations SET payment_status = ? WHERE id = ?', [$status, (int) $p['id']]);
        if ($status === 'SUCCESS') Commission::processActivation((int) $p['id']);
    });
    Http::ok();
});

$router->get('/api/admin/withdrawals', function () {
    Auth::admin();
    Http::ok(DB::all(
        'SELECT w.*, u.life_id, u.phone FROM lo_withdrawals w JOIN users u ON u.id = w.user_id ORDER BY w.id DESC LIMIT 200'
    ));
});

$router->post('/api/admin/withdrawals/{id}/process', function ($p) {
    Auth::admin();
    $b = Http::body();
    if (!in_array($b['status'] ?? '', ['APPROVED', 'REJECTED'], true)) throw new HttpError('Invalid status');
    DB::tx(function () use ($p, $b) {
        $w = DB::one('SELECT status FROM lo_withdrawals WHERE id = ? FOR UPDATE', [(int) $p['id']]);
        if (!$w) throw new HttpError('Withdrawal not found', 404);
        if ($w['status'] !== 'PENDING') throw new HttpError('Withdrawal already processed', 409);
        DB::run('UPDATE lo_withdrawals SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ?',
            [$b['status'], $b['note'] ?? null, (int) $p['id']]);
    });
    Http::ok();
});

// ---- Mobile recharge requests: admin releases or rejects the held balance ----
$router->get('/api/admin/recharges', function () {
    Auth::admin();
    Http::ok(DB::all('SELECT r.*, u.life_id, u.phone AS member_phone FROM lo_recharges r JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT 200'));
});

$router->post('/api/admin/recharges/{id}/process', function ($p) {
    Auth::admin();
    $b = Http::body();
    if (!in_array($b['status'] ?? '', ['PAID', 'REJECTED'], true)) throw new HttpError('Invalid status');
    DB::tx(function () use ($p, $b) {
        $r = DB::one('SELECT status FROM lo_recharges WHERE id = ? FOR UPDATE', [(int) $p['id']]);
        if (!$r) throw new HttpError('Recharge request not found', 404);
        if ($r['status'] !== 'PENDING') throw new HttpError('Recharge request already processed', 409);
        DB::run('UPDATE lo_recharges SET status = ?, admin_note = ?, processed_at = NOW() WHERE id = ?',
            [$b['status'], mb_substr(trim((string) ($b['note'] ?? '')), 0, 255) ?: null, (int) $p['id']]);
    });
    Http::ok();
});

// ---- Balance transfer audit trail ----
$router->get('/api/admin/transfers', function () {
    Auth::admin();
    Http::ok(DB::all('SELECT t.*, a.life_id AS from_life_id, b.life_id AS to_life_id
        FROM lo_transfers t JOIN users a ON a.id = t.from_user_id JOIN users b ON b.id = t.to_user_id
        ORDER BY t.id DESC LIMIT 200'));
});

const ADMIN_SETTING_KEYS = ['matching_paused', 'daily_matching_cap', 'withdraw_min', 'withdraw_max', 'withdraw_charge_pct',
    'site_name', 'site_slogan', 'site_url', 'site_email', 'login_status', 'signup_status', 'withdrawal_status', 'profile_edit_status',
    'transfer_status', 'transfer_min', 'transfer_max', 'recharge_status', 'recharge_min', 'recharge_max'];


$router->get('/api/admin/settings', function () {
    Auth::admin();
    $out = [];
    foreach (DB::all('SELECT k, v FROM lo_settings') as $r) if (in_array($r['k'], ADMIN_SETTING_KEYS, true)) $out[$r['k']] = $r['v'];
    Http::ok($out);
});

$router->post('/api/admin/settings', function ($p) {
    Auth::admin();
    $b = Http::body();
    $validated = [];
    foreach (ADMIN_SETTING_KEYS as $k) {
        if (!isset($b[$k])) continue;
        $raw = (string) $b[$k];
        // Plan rule: daily matching cap can be lowered but never raised above ৳5,000.
        if ($k === 'daily_matching_cap') {
            $v = (float) $b[$k];
            if (!is_finite($v) || $v < 0 || $v > \LifeOS\Engine\Plan::DAILY_MATCHING_CAP) throw new HttpError('daily_matching_cap must be between 0 and 5000', 422);
        }
        if (in_array($k, ['matching_paused', 'login_status', 'signup_status', 'withdrawal_status', 'profile_edit_status'], true) && !in_array($raw, ['0', '1'], true)) throw new HttpError("$k must be 0 or 1", 422);
        if (in_array($k, ['withdraw_min', 'withdraw_max'], true) && (!is_numeric($raw) || (float) $raw < 0)) throw new HttpError("$k must be a positive number", 422);
        if ($k === 'withdraw_charge_pct' && (!is_numeric($raw) || (float) $raw < 0 || (float) $raw > 100)) throw new HttpError('withdraw_charge_pct must be between 0 and 100', 422);
        if (strlen($raw) > 255) throw new HttpError("$k is too long", 422);
        $validated[$k] = $raw;
    }
    $current = [];
    foreach (DB::all('SELECT k, v FROM lo_settings') as $row) $current[$row['k']] = $row['v'];
    $limits = array_replace($current, $validated);
    if ((float) ($limits['withdraw_max'] ?? 25000) > 0 && (float) ($limits['withdraw_min'] ?? 500) > (float) ($limits['withdraw_max'] ?? 25000)) throw new HttpError('Minimum withdrawal must not exceed maximum', 422);
    DB::tx(function () use ($validated) {
        foreach ($validated as $k => $raw) DB::run('INSERT INTO lo_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [$k, $raw]);
    });
    Http::ok();
});

// Rank & Reward fulfillment: a reached member's gift is paid from the RANK pool only,
// idempotent on the reference, and never borrows from another category.
$router->post('/api/admin/ranks/{id}/reward', function ($p) {
    Auth::admin();
    $b = Http::body();
    $userId = (int) $p['id'];
    $amount = (float) ($b['amount'] ?? 0);
    $reference = trim((string) ($b['reference'] ?? ''));
    if (!is_finite($amount) || $amount <= 0) throw new HttpError('amount must be positive', 422);
    if ($reference === '' || strlen($reference) > 60) throw new HttpError('reference required (max 60 chars)', 422);
    $rank = DB::one('SELECT r.name FROM lo_user_ranks ur JOIN lo_ranks r ON r.id = ur.rank_id WHERE ur.user_id = ? AND r.required_matchings > 0 ORDER BY r.required_matchings DESC LIMIT 1', [$userId]);
    if (!$rank) throw new HttpError('Member has no achieved rank', 422);
    Commission::poolSpend('RANK', $amount, 'RR-U' . $userId . '-' . $reference, 'Rank reward (' . $rank['name'] . ') for user ' . $userId);
    Http::ok(['user_id' => $userId, 'rank' => $rank['name'], 'amount' => $amount, 'reference' => $reference]);
});

$router->get('/api/admin/matching-events', function () {
    Auth::admin();
    Http::ok(DB::all('SELECT * FROM lo_matching_events ORDER BY id DESC LIMIT 300'));
});

$router->post('/api/admin/adjustments', function () {
    Auth::admin();
    $b = Http::body();
    if (empty($b['user_id']) || !isset($b['amount'])) throw new HttpError('user_id and amount required');
    DB::run(
        'INSERT INTO lo_ledger (payout_code, user_id, ledger_type, amount, note) VALUES (?,?,?,?,?)',
        ['ADJ-' . strtoupper(bin2hex(random_bytes(8))), (int) $b['user_id'], 'ADJUSTMENT', (float) $b['amount'], $b['note'] ?? 'Admin adjustment']
    );
    Http::ok();
});

// Daily statement closing: once per member per past day; a closed statement is never recalculated.
$router->post('/api/admin/statements/close', function () {
    Auth::admin();
    $b = Http::body();
    $date = (string) ($b['date'] ?? (string) DB::val('SELECT CURRENT_DATE() - INTERVAL 1 DAY'));
    $closed = \LifeOS\Engine\Statements::close($date);
    Http::ok(['date' => $date, 'statements_closed' => $closed]);
});

// ---------- Admin panel reports & content ----------

/** Shared date/user filters for report endpoints: from, to (Y-m-d) and q (Life ID / phone). */
function adminFilters(string $dateCol, ?string $userCol = 'u'): array
{
    $w = []; $p = [];
    foreach (['from' => '>=', 'to' => '<='] as $k => $op) {
        $d = (string) ($_GET[$k] ?? '');
        if ($d === '') continue;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) throw new HttpError("Invalid $k date", 422);
        $w[] = "DATE($dateCol) $op ?"; $p[] = $d;
    }
    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q !== '' && $userCol) { $w[] = "($userCol.life_id LIKE ? OR $userCol.phone LIKE ?)"; $p[] = "%$q%"; $p[] = "%$q%"; }
    return [$w ? ' WHERE ' . implode(' AND ', $w) : '', $p];
}

const ADMIN_NAME_SQL = '(SELECT name FROM user_profiles up WHERE up.user_id = u.id ORDER BY up.id LIMIT 1)';

$router->get('/api/admin/company-info', function () {
    Auth::admin();
    $sum = fn(string $t) => (float) DB::val("SELECT COALESCE(SUM(amount),0) FROM lo_ledger WHERE ledger_type = ? AND status = 'PAID'", [$t]);
    $w = fn(string $s) => (float) DB::val('SELECT COALESCE(SUM(amount),0) FROM lo_withdrawals WHERE status = ?', [$s]);
    Http::ok([
        'members' => (int) DB::val('SELECT COUNT(*) FROM users'),
        'active_members' => (int) DB::val('SELECT COUNT(*) FROM lo_tree WHERE is_active = 1'),
        'sales_count' => (int) DB::val("SELECT COUNT(*) FROM lo_sales WHERE status <> 'REVERSED'"),
        'sales_amount' => (float) DB::val("SELECT COALESCE(SUM(fee),0) FROM lo_activations WHERE payment_status = 'SUCCESS'"),
        'activations_pending' => (int) DB::val("SELECT COUNT(*) FROM lo_activations WHERE payment_status = 'PENDING'"),
        'bonus' => ['CASHBACK' => $sum('CASHBACK'), 'REFERRAL' => $sum('REFERRAL'), 'MATCHING' => $sum('MATCHING'), 'GENERATION' => $sum('GENERATION'), 'RANK' => $sum('RANK'), 'ADJUSTMENT' => $sum('ADJUSTMENT')],
        'withdraw' => ['APPROVED' => $w('APPROVED'), 'PENDING' => $w('PENDING'), 'REJECTED' => $w('REJECTED'),
            'charges' => (float) DB::val("SELECT COALESCE(SUM(charge),0) FROM lo_withdrawals WHERE status = 'APPROVED'")],
        'pools' => DB::all('SELECT * FROM lo_pools'),
        'matching_split' => \LifeOS\Engine\MatchingStats::split(),
    ]);
});

$router->get('/api/admin/plan', function () {
    Auth::admin();
    $P = \LifeOS\Engine\Plan::class;
    Http::ok([
        'fee' => $P::FEE, 'allocations' => $P::ALLOCATIONS, 'generation' => $P::GENERATION,
        'max_matching_events' => $P::MAX_MATCHING_EVENTS, 'daily_matching_cap' => $P::DAILY_MATCHING_CAP,
        'matching_total_limit' => $P::MATCHING_TOTAL_LIMIT,
    ]);
});

$router->get('/api/admin/ranks', function () {
    Auth::admin();
    Http::ok(DB::all('SELECT r.id, r.name, r.required_matchings, (SELECT COUNT(*) FROM lo_user_ranks ur WHERE ur.rank_id = r.id) AS achieved FROM lo_ranks r ORDER BY r.id'));
});

$router->get('/api/admin/rank-achievers', function () {
    Auth::admin();
    [$where, $p] = adminFilters('ur.achieved_at');
    Http::ok(DB::all('SELECT ur.user_id, ur.achieved_at, r.name AS rank_name, u.life_id, u.phone, ' . ADMIN_NAME_SQL . ' AS name
        FROM lo_user_ranks ur JOIN lo_ranks r ON r.id = ur.rank_id JOIN users u ON u.id = ur.user_id' . ($where ? $where . ' AND' : ' WHERE') . ' r.required_matchings > 0
        ORDER BY ur.achieved_at DESC LIMIT 500', $p));
});

// Admin Member List: server-side filters, sorting and paging over every member, with filter-wide counts.
$router->get('/api/admin/member-list', function () {
    Auth::admin();
    $g = fn(string $k) => trim((string) ($_GET[$k] ?? ''));
    $w = []; $p = [];
    foreach (['from' => '>=', 'to' => '<='] as $k => $op) {
        if ($g($k) === '') continue;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $g($k))) throw new HttpError("Invalid $k date", 422);
        $w[] = "u.created_at $op ?"; $p[] = $g($k) . ($op === '>=' ? ' 00:00:00' : ' 23:59:59');
    }
    $q = $g('q');
    if ($q !== '') {
        if (mb_strlen($q) > 80) throw new HttpError('Search is too long', 422);
        $like = '%' . addcslashes($q, '%_\\') . '%';
        $w[] = '(u.life_id = ? OR u.life_id LIKE ? OR u.username LIKE ? OR u.phone LIKE ? OR u.email LIKE ? OR u.referral_code = ?
                 OR EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = u.id AND up.name LIKE ?))';
        array_push($p, \LifeOS\Username::normalize($q), $like, $like, $like, $like, $q, $like);
    }
    if (($st = strtolower($g('status'))) !== '') {
        if (!in_array($st, ['active', 'pending', 'suspended'], true)) throw new HttpError('Invalid status', 422);
        $w[] = 'u.status = ?'; $p[] = $st;
    }
    if (($ta = $g('tree_active')) !== '') { $w[] = 'COALESCE(t.is_active, 0) = ?'; $p[] = $ta === '1' ? 1 : 0; }
    if (($side = strtoupper($g('side'))) !== '') {
        if (!in_array($side, ['L', 'R'], true)) throw new HttpError('Invalid side', 422);
        $w[] = 't.placement_side = ?'; $p[] = $side;
    }
    if (($sp = $g('sponsor')) !== '') {
        $w[] = 't.sponsor_id = (SELECT s.id FROM users s WHERE s.life_id = ? OR s.username = ? OR s.referral_code = ? ORDER BY s.id LIMIT 1)';
        array_push($p, \LifeOS\Username::normalize($sp), $sp, $sp);
    }
    $rankSql = '(SELECT ur.rank_id FROM lo_user_ranks ur JOIN lo_ranks r ON r.id = ur.rank_id WHERE ur.user_id = u.id ORDER BY r.required_matchings DESC LIMIT 1)';
    if (($rk = $g('rank')) !== '') {
        if ($rk === 'none') $w[] = "$rankSql IS NULL";
        else { $w[] = "$rankSql = ?"; $p[] = (int) $rk; }
    }
    if (($fmt = $g('id_format')) === 'old') $w[] = "u.life_id REGEXP '^LID-2026-[0-9A-F]{6}$'";
    elseif ($fmt === 'new') $w[] = "u.life_id REGEXP '^LID-2026-[0-9]{8}$'";
    elseif ($fmt === 'other') $w[] = "u.life_id NOT REGEXP '^LID-2026-'";
    $mm = $g('min_matching');
    if ($mm !== '') { $w[] = 'COALESCE(t.lifetime_matchings, 0) >= ?'; $p[] = max(0, (int) $mm); }
    $where = $w ? ' WHERE ' . implode(' AND ', $w) : '';
    $from = ' FROM users u LEFT JOIN lo_tree t ON t.user_id = u.id';

    $sorts = ['new' => 'u.id DESC', 'old' => 'u.id ASC', 'matching' => 'COALESCE(t.lifetime_matchings,0) DESC, u.id ASC',
              'life_id' => 'u.life_id ASC', 'directs' => 'directs DESC, u.id ASC'];
    $order = $sorts[$g('sort')] ?? $sorts['new'];
    $export = $g('export') === '1';
    $per = $export ? 20000 : min(500, max(10, (int) ($g('per') ?: 50)));
    $page = $export ? 1 : max(1, (int) ($g('page') ?: 1));
    $offset = ($page - 1) * $per;

    $rows = DB::all('SELECT u.id, u.life_id, u.username, u.phone, u.email, u.status, u.created_at, ' . ADMIN_NAME_SQL . ' AS name,
        COALESCE(t.is_active, 0) AS is_active, COALESCE(t.lifetime_matchings, 0) AS lifetime_matchings, t.placement_side,
        (SELECT s.life_id FROM users s WHERE s.id = t.sponsor_id) AS sponsor_life_id,
        (SELECT s.life_id FROM users s WHERE s.id = t.placement_parent_id) AS placement_life_id,
        (SELECT COUNT(*) FROM lo_tree c WHERE c.sponsor_id = u.id) AS directs,
        (SELECT r.name FROM lo_ranks r WHERE r.id = ' . $rankSql . ') AS rank_name' . $from . $where .
        " ORDER BY $order LIMIT $per OFFSET $offset", $p);
    if ($export) { Http::ok(['rows' => $rows]); return; }
    $c = DB::one("SELECT COUNT(*) AS total, SUM(u.status = 'active') AS active, SUM(u.status = 'pending') AS pending,
        SUM(u.status = 'suspended') AS suspended, SUM(COALESCE(t.is_active,0) = 1) AS tree_active" . $from . $where, $p) ?? [];
    Http::ok(['rows' => $rows, 'page' => $page, 'per' => $per, 'offset' => $offset,
        'counts' => array_map('intval', $c + ['total' => 0]),
        'ranks' => DB::all('SELECT id, name FROM lo_ranks ORDER BY required_matchings')]);
});

// Bulk status change from the Member List (same rules as the single change).
$router->post('/api/admin/members/bulk-status', function () {
    $admin = Auth::admin();
    $b = Http::body();
    $status = strtolower((string) ($b['status'] ?? ''));
    if (!in_array($status, ['active', 'suspended', 'pending'], true)) throw new HttpError('Invalid status', 422);
    $ids = array_values(array_unique(array_filter(array_map('intval', (array) ($b['ids'] ?? [])), fn($i) => $i > 0)));
    if (!$ids || count($ids) > 500) throw new HttpError('Choose 1–500 members', 422);
    $n = DB::tx(function () use ($ids, $status, $admin) {
        $n = 0;
        foreach ($ids as $id) {
            if (!DB::one('SELECT id FROM users WHERE id = ? FOR UPDATE', [$id])) continue;
            $n += DB::run('UPDATE users SET status = ? WHERE id = ? AND status <> ?', [$status, $id, $status]);
            adminAudit($admin, 'STATUS_' . strtoupper($status), $id);
        }
        return $n;
    });
    Http::ok(['changed' => $n]);
});

$router->get('/api/admin/member-report', function () {
    Auth::admin();
    [$where, $p] = adminFilters('u.created_at');
    $rows = DB::all("SELECT u.id, u.life_id, u.created_at, " . ADMIN_NAME_SQL . " AS name,
        (SELECT life_id FROM users s JOIN lo_tree t ON s.id = t.sponsor_id WHERE t.user_id = u.id) AS sponsor_life_id,
        (SELECT COUNT(*) FROM lo_tree c WHERE c.sponsor_id = u.id) AS directs,
        (SELECT COALESCE(SUM(fee),0) FROM lo_activations a WHERE a.user_id = u.id AND a.payment_status = 'SUCCESS') AS purchased,
        (SELECT COALESCE(SUM(amount),0) FROM lo_ledger l WHERE l.user_id = u.id AND l.status = 'PAID' AND l.ledger_type <> 'CASHBACK') AS earned,
        (SELECT COALESCE(SUM(amount + charge),0) FROM lo_withdrawals w WHERE w.user_id = u.id AND w.status IN ('PENDING','APPROVED')) AS withdrawn
        FROM users u" . $where . " ORDER BY u.id DESC LIMIT 500", $p);
    foreach ($rows as &$r) $r['balance'] = round((float) $r['earned'] - (float) $r['withdrawn'], 2);
    Http::ok(array_values(array_filter($rows, fn($r) => $r['balance'] > 0 || !empty($_GET['all']))));
});

$router->get('/api/admin/activations', function () {
    Auth::admin();
    [$where, $p] = adminFilters('a.created_at');
    $st = (string) ($_GET['status'] ?? '');
    if ($st !== '') {
        if (!in_array($st, ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'], true)) throw new HttpError('Invalid status', 422);
        $where .= ($where ? ' AND' : ' WHERE') . ' a.payment_status = ?'; $p[] = $st;
    }
    Http::ok(DB::all('SELECT a.id, a.activation_code, a.payment_ref, a.payment_status, a.fee, a.bv, a.processed, a.created_at, a.processed_at, u.life_id, u.phone, ' . ADMIN_NAME_SQL . ' AS name
        FROM lo_activations a JOIN users u ON u.id = a.user_id' . $where . ' ORDER BY a.id DESC LIMIT 500', $p));
});

$router->get('/api/admin/joining-report', function () {
    Auth::admin();
    [$where, $p] = adminFilters('u.created_at');
    Http::ok(DB::all('SELECT u.id, u.life_id, u.phone, u.created_at, u.status, ' . ADMIN_NAME_SQL . ' AS name, u.referred_by
        FROM users u' . $where . ' ORDER BY u.id DESC LIMIT 500', $p));
});

$router->get('/api/admin/sales-report', function () {
    Auth::admin();
    [$where, $p] = adminFilters('s.created_at');
    Http::ok(DB::all('SELECT s.id, s.sale_code, s.created_at, s.matching_count, s.matching_paid, s.generation_paid, s.status, a.fee, a.bv, a.payment_ref, u.life_id, ' . ADMIN_NAME_SQL . ' AS name
        FROM lo_sales s JOIN lo_activations a ON a.id = s.activation_id JOIN users u ON u.id = s.user_id' . $where . ' ORDER BY s.id DESC LIMIT 500', $p));
});

$router->get('/api/admin/ledger', function () {
    Auth::admin();
    [$where, $p] = adminFilters('l.created_at');
    $t = (string) ($_GET['type'] ?? '');
    if ($t !== '') {
        if (!in_array($t, ['CASHBACK', 'REFERRAL', 'MATCHING', 'GENERATION', 'RANK', 'ADJUSTMENT', 'WITHDRAW'], true)) throw new HttpError('Invalid type', 422);
        $where .= ($where ? ' AND' : ' WHERE') . ' l.ledger_type = ?'; $p[] = $t;
    }
    Http::ok(DB::all('SELECT l.id, l.payout_code, l.ledger_type, l.amount, l.level, l.status, l.note, l.created_at, u.life_id, ' . ADMIN_NAME_SQL . ' AS name
        FROM lo_ledger l JOIN users u ON u.id = l.user_id' . $where . ' ORDER BY l.id DESC LIMIT 1000', $p));
});

// Balance Add report: every admin-made addition (D Wallet ADMIN_ADD deposits and E Wallet ADJ- ledger rows), newest first.
$router->get('/api/admin/balance-add', function () {
    Auth::admin();
    [$where, $p] = adminFilters('t.created_at');
    $wallet = (string) ($_GET['wallet'] ?? '');
    if ($wallet !== '') {
        if (!in_array($wallet, ['DEPOSIT', 'ADJUSTMENT'], true)) throw new HttpError('Invalid wallet', 422);
        $where .= ($where ? ' AND' : ' WHERE') . ' t.wallet = ?'; $p[] = $wallet;
    }
    $rows = DB::all("SELECT t.trx_code, t.wallet, t.amount, t.note, t.created_at, u.life_id, u.phone, " . ADMIN_NAME_SQL . " AS name
        FROM (
            SELECT d.deposit_code AS trx_code, 'DEPOSIT' AS wallet, d.amount, d.note, d.created_at, d.user_id FROM lo_deposits d WHERE d.kind = 'ADMIN_ADD'
            UNION ALL
            SELECT l.payout_code AS trx_code, 'ADJUSTMENT' AS wallet, l.amount, l.note, l.created_at, l.user_id FROM lo_ledger l WHERE l.ledger_type = 'ADJUSTMENT' AND l.payout_code LIKE 'ADJ-%'
        ) t JOIN users u ON u.id = t.user_id" . $where . ' ORDER BY t.created_at DESC, t.trx_code DESC LIMIT 1000', $p);
    Http::ok($rows);
});

// Balance Add: credits a member through an audited ADJUSTMENT ledger row (never edits balances directly).
$router->post('/api/admin/balance-add', function () {
    $admin = Auth::admin();
    $b = Http::body();
    $amount = (float) ($b['amount'] ?? 0);
    if (!is_finite($amount) || $amount == 0.0 || abs($amount) > 1000000) throw new HttpError('Enter a valid amount', 422);
    $u = DB::one('SELECT id, life_id FROM users WHERE life_id = ?', [\LifeOS\Username::normalize((string) ($b['life_id'] ?? ''))]);
    if (!$u) throw new HttpError('Member not found', 404);
    if (($b['wallet'] ?? '') === 'DEPOSIT') {
        $code = 'DEP-' . strtoupper(bin2hex(random_bytes(8)));
        DB::tx(function () use ($u, $amount, $code, $admin, $b) {
            DB::one('SELECT id FROM users WHERE id = ? FOR UPDATE', [(int) $u['id']]);
            if ($amount < 0 && \LifeOS\Engine\Wallet::deposit((int) $u['id']) + $amount < -1e-9) throw new HttpError('Deposit wallet cannot go below zero', 422);
            DB::run("INSERT INTO lo_deposits (deposit_code, user_id, kind, amount, note) VALUES (?,?,'ADMIN_ADD',?,?)",
                [$code, (int) $u['id'], $amount, mb_substr('By ' . $admin['name'] . ': ' . trim((string) ($b['note'] ?? 'Deposit')), 0, 255)]);
        });
        Http::ok(['payout_code' => $code, 'life_id' => $u['life_id'], 'amount' => $amount, 'wallet' => 'DEPOSIT']);
        return;
    }
    $code = 'ADJ-' . strtoupper(bin2hex(random_bytes(8)));
    DB::run('INSERT INTO lo_ledger (payout_code, user_id, ledger_type, amount, note) VALUES (?,?,?,?,?)',
        [$code, (int) $u['id'], 'ADJUSTMENT', $amount, mb_substr('By ' . $admin['name'] . ': ' . trim((string) ($b['note'] ?? 'Balance add')), 0, 255)]);
    Http::ok(['payout_code' => $code, 'life_id' => $u['life_id'], 'amount' => $amount]);
});

$router->get('/api/admin/notices', function () {
    Auth::admin();
    $kind = ($_GET['kind'] ?? 'NOTICE') === 'SCROLL' ? 'SCROLL' : 'NOTICE';
    Http::ok(DB::all('SELECT * FROM lo_notices WHERE kind = ? ORDER BY id DESC', [$kind]));
});

$router->post('/api/admin/notices', function () {
    $admin = Auth::admin();
    $b = Http::body();
    $kind = ($b['kind'] ?? 'NOTICE') === 'SCROLL' ? 'SCROLL' : 'NOTICE';
    $content = trim((string) ($b['content'] ?? ''));
    if ($content === '' || strlen($content) > 20000) throw new HttpError('Content is required', 422);
    $dates = [];
    foreach (['show_from', 'show_to'] as $k) {
        $d = (string) ($b[$k] ?? '');
        if ($d !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) throw new HttpError("Invalid $k", 422);
        $dates[] = $d ?: null;
    }
    \LifeOS\PanelPolicy::dates($dates[0], $dates[1]);
    $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 190) ?: null;
    if (!empty($b['id'])) {
        if (!DB::one('SELECT id FROM lo_notices WHERE id = ? AND kind = ?', [(int) $b['id'], $kind])) throw new HttpError('Notice not found', 404);
        DB::run('UPDATE lo_notices SET title = ?, content = ?, show_from = ?, show_to = ?, updated_by = ? WHERE id = ? AND kind = ?',
            [$title, $content, $dates[0], $dates[1], $admin['name'], (int) $b['id'], $kind]);
        Http::ok(['id' => (int) $b['id']]);
    }
    Http::ok(['id' => DB::insert('INSERT INTO lo_notices (kind, title, content, show_from, show_to, updated_by) VALUES (?,?,?,?,?,?)',
        [$kind, $title, $content, $dates[0], $dates[1], $admin['name']])]);
});

$router->post('/api/admin/notices/{id}/toggle', function ($p) {
    Auth::admin();
    if (!DB::one('SELECT id FROM lo_notices WHERE id = ?', [(int) $p['id']])) throw new HttpError('Notice not found', 404);
    DB::run('UPDATE lo_notices SET is_visible = 1 - is_visible WHERE id = ?', [(int) $p['id']]);
    Http::ok();
});

$router->post('/api/admin/notices/{id}/delete', function ($p) {
    Auth::admin();
    if (!DB::run('DELETE FROM lo_notices WHERE id = ?', [(int) $p['id']])) throw new HttpError('Notice not found', 404);
    Http::ok();
});

$router->post('/api/admin/password', function () {
    $admin = Auth::admin();
    $b = Http::body();
    if (!password_verify((string) ($b['current'] ?? ''), (string) ($admin['password'] ?? ''))) throw new HttpError('Current password is wrong', 422);
    $new = (string) ($b['new'] ?? '');
    if (strlen($new) < 8 || strlen($new) > 72) throw new HttpError('New password must be 8–72 characters', 422);
    DB::run('UPDATE admin_users SET password = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), (int) $admin['id']]);
    Http::ok();
});

$router->get('/api/admin/me', function () {
    $admin = Auth::admin();
    // Sliding renewal: an admin who keeps using the panel is never signed out.
    Http::ok(['id' => (int) $admin['id'], 'name' => $admin['name'], 'email' => $admin['email'], 'token' => Auth::issue('a', (int) $admin['id'])]);
});

// ---------- Daily closing, system error log and audited placement corrections ----------
$router->get('/api/admin/daily-closings', function () {
    Auth::admin();
    Http::ok([
        'closings' => DB::all('SELECT * FROM lo_daily_closings ORDER BY closing_date DESC LIMIT 60'),
        'open_today' => (int) DB::val("SELECT COUNT(*) FROM lo_activations WHERE processed = 1 AND closed = 0"),
        'waiting_payment_step' => (int) DB::val("SELECT COUNT(*) FROM lo_activations WHERE payment_status = 'SUCCESS' AND processed = 0"),
    ]);
});

$router->get('/api/admin/system-errors', function () {
    Auth::admin();
    Http::ok(DB::all('SELECT e.*, u.life_id FROM lo_system_errors e LEFT JOIN users u ON u.id = e.user_id ORDER BY e.id DESC LIMIT 300'));
});

function adminMemberId(string $ref): int
{
    $ref = trim($ref);
    if ($ref === '' || mb_strlen($ref) > 40) throw new HttpError('Account ID required', 422);
    $id = DB::val('SELECT id FROM users WHERE life_id = ? OR username = ? ORDER BY id LIMIT 1', [\LifeOS\Username::normalize($ref), $ref]);
    if ($id === false || $id === null) throw new HttpError("Account $ref not found", 404);
    return (int) $id;
}

/** True when $candidate sits inside $root's placement (binary) subtree, including $root itself. */
function inPlacementSubtree(int $root, int $candidate): bool
{
    $cur = $candidate; $guard = 0;
    while ($cur && $guard++ < 200000) {
        if ($cur === $root) return true;
        $cur = (int) (DB::val('SELECT placement_parent_id FROM lo_tree WHERE user_id = ?', [$cur]) ?: 0);
    }
    return false;
}

// Moves a member (with the whole team below) into an EMPTY Left/Right slot. Admin-only, reason required,
// audited with old and new position. Already settled volume and paid commission are never recalculated.
$router->post('/api/admin/placement/move', function () {
    $admin = Auth::admin();
    $b = Http::body();
    $reason = trim((string) ($b['reason'] ?? ''));
    $side = strtoupper((string) ($b['side'] ?? ''));
    if (!in_array($side, ['L', 'R'], true)) throw new HttpError('Side must be L or R', 422);
    if (mb_strlen($reason) < 5 || mb_strlen($reason) > 255) throw new HttpError('Reason (5–255 characters) is required', 422);
    $uid = adminMemberId((string) ($b['member'] ?? ''));
    $pid = adminMemberId((string) ($b['parent'] ?? ''));
    $out = DB::tx(function () use ($admin, $uid, $pid, $side, $reason) {
        DB::one('SELECT id FROM lo_placement_lock WHERE id = 1 FOR UPDATE');
        $node = DB::one('SELECT * FROM lo_tree WHERE user_id = ? FOR UPDATE', [$uid]);
        $parent = DB::one('SELECT * FROM lo_tree WHERE user_id = ? FOR UPDATE', [$pid]);
        if (!$node || !$parent) throw new HttpError('Tree node missing', 404);
        if ($node['placement_parent_id'] === null) throw new HttpError('The top account cannot be moved', 422);
        if (inPlacementSubtree($uid, $pid)) throw new HttpError('New position is inside this member\'s own team', 422);
        $slot = $side === 'L' ? 'left_child_id' : 'right_child_id';
        if ($parent[$slot] !== null) throw new HttpError('That position is not empty', 409);
        $oldParent = (int) $node['placement_parent_id'];
        $oldSlot = $node['placement_side'] === 'L' ? 'left_child_id' : 'right_child_id';
        DB::run("UPDATE lo_tree SET $oldSlot = NULL WHERE user_id = ? AND $oldSlot = ?", [$oldParent, $uid]);
        DB::run("UPDATE lo_tree SET $slot = ? WHERE user_id = ?", [$uid, $pid]);
        DB::run('UPDATE lo_tree SET placement_parent_id = ?, placement_side = ? WHERE user_id = ?', [$pid, $side, $uid]);
        DB::run('UPDATE users SET placement_id = ?, position = ? WHERE id = ?', [$pid, $side === 'L' ? 'left' : 'right', $uid]);
        DB::run('INSERT INTO lo_placement_audit (admin_id, user_id, old_parent_id, old_side, new_parent_id, new_side, reason) VALUES (?,?,?,?,?,?,?)',
            [(int) $admin['id'], $uid, $oldParent, $node['placement_side'], $pid, $side, $reason]);
        return ['moved' => true];
    });
    adminAudit($admin, 'PLACEMENT_MOVE', $uid);
    Http::ok($out);
});

// Sponsor correction (enrollment tree). Admin-only, reason required, audited; cannot create a sponsor loop.
$router->post('/api/admin/sponsor/change', function () {
    $admin = Auth::admin();
    $b = Http::body();
    $reason = trim((string) ($b['reason'] ?? ''));
    if (mb_strlen($reason) < 5 || mb_strlen($reason) > 255) throw new HttpError('Reason (5–255 characters) is required', 422);
    $uid = adminMemberId((string) ($b['member'] ?? ''));
    $sid = adminMemberId((string) ($b['sponsor'] ?? ''));
    if ($uid === $sid) throw new HttpError('A member cannot sponsor themselves', 422);
    DB::tx(function () use ($admin, $uid, $sid, $reason) {
        DB::one('SELECT id FROM lo_placement_lock WHERE id = 1 FOR UPDATE');
        $node = DB::one('SELECT sponsor_id FROM lo_tree WHERE user_id = ? FOR UPDATE', [$uid]);
        if (!$node) throw new HttpError('Tree node missing', 404);
        $cur = $sid; $guard = 0;
        while ($cur && $guard++ < 200000) {
            if ($cur === $uid) throw new HttpError('New sponsor is inside this member\'s own sponsor team', 422);
            $cur = (int) (DB::val('SELECT sponsor_id FROM lo_tree WHERE user_id = ?', [$cur]) ?: 0);
        }
        DB::run('UPDATE lo_tree SET sponsor_id = ? WHERE user_id = ?', [$sid, $uid]);
        DB::run('UPDATE users SET referred_by = (SELECT life_id FROM (SELECT life_id FROM users WHERE id = ?) s) WHERE id = ?', [$sid, $uid]);
        DB::run('INSERT INTO lo_placement_audit (admin_id, user_id, old_sponsor_id, new_sponsor_id, reason) VALUES (?,?,?,?,?)',
            [(int) $admin['id'], $uid, $node['sponsor_id'], $sid, $reason]);
    });
    adminAudit($admin, 'SPONSOR_CHANGE', $uid);
    Http::ok(['changed' => true]);
});

$router->get('/api/admin/placement/audit', function () {
    Auth::admin();
    Http::ok(DB::all('SELECT a.*, u.life_id, au.name AS admin_name,
        (SELECT life_id FROM users WHERE id = a.old_parent_id) AS old_parent, (SELECT life_id FROM users WHERE id = a.new_parent_id) AS new_parent,
        (SELECT life_id FROM users WHERE id = a.old_sponsor_id) AS old_sponsor, (SELECT life_id FROM users WHERE id = a.new_sponsor_id) AS new_sponsor
        FROM lo_placement_audit a JOIN users u ON u.id = a.user_id LEFT JOIN admin_users au ON au.id = a.admin_id ORDER BY a.id DESC LIMIT 200'));
});
