<?php
declare(strict_types=1);
/**
 * Daily closing rules (disposable LOCAL database only, e.g. LT_DB=lifeos_dc):
 * referral instant; generation + matching only at the Dhaka-midnight closing; one final matching
 * credit per beneficiary per sale; Total Matching/Rank count approved matching only; Major Link carry
 * kept, Minor Link daily counter reset; pending/failed/reversed payments never pay; error log.
 * Usage: php backendserver/tests/daily_closing_test.php
 */
require dirname(__DIR__) . '/src/bootstrap.php';
use LifeOS\DB;
use LifeOS\HttpError;
use LifeOS\Engine\Commission;
use LifeOS\Engine\Placement;
use LifeOS\Engine\Settlement;

$cfg = \LifeOS\Config::get('db');
if (!in_array($cfg['host'], ['127.0.0.1', 'localhost'], true)) { fwrite(STDERR, "Refusing: not a local database\n"); exit(2); }
if ((int) DB::val('SELECT COUNT(*) FROM users') > 0) { fwrite(STDERR, "Refusing: use an empty database\n"); exit(2); }

$fail = 0; $pass = 0;
function check(string $name, bool $ok, string $detail = ''): void {
    global $fail, $pass; $ok ? $pass++ : $fail++;
    echo ($ok ? 'ok    ' : 'FAIL  ') . $name . ($ok || $detail === '' ? '' : "  [$detail]") . "\n";
}
function member(string $name, ?int $sponsor, ?string $team): int {
    static $n = 0; $n++;
    $life = sprintf('LDC%05d', $n);
    $id = DB::insert('INSERT INTO users (life_id, membership_no, referral_code, phone, pin_hash, status, accepted_terms, username) VALUES (?,?,?,?,?,"active",1,?)',
        [$life, $life, "DC$n", sprintf('0199%07d', $n), 'x', "dc$n"]);
    DB::insert('INSERT INTO user_wallets (user_id) VALUES (?)', [$id]);
    DB::insert('INSERT INTO user_profiles (user_id, name) VALUES (?, ?)', [$id, $name]);
    Placement::ensureNode($id, $sponsor);
    if ($sponsor !== null) Placement::place($id, $sponsor, $team);
    return $id;
}
function pay(int $uid, string $status = 'SUCCESS'): int {
    static $n = 0; $n++;
    return DB::insert('INSERT INTO lo_activations (activation_code, user_id, payment_ref, payment_status) VALUES (?,?,?,?)', ["ACT-DC$n", $uid, "TRX-DC$n", $status]);
}
function ledger(int $uid, string $type): float { return (float) DB::val("SELECT COALESCE(SUM(amount),0) FROM lo_ledger WHERE user_id = ? AND ledger_type = ? AND status = 'PAID'", [$uid, $type]); }
/** Simulates Dhaka midnight: today's activations become yesterday's and the minute runner closes them. */
function midnight(): array {
    DB::run('UPDATE lo_activations SET business_date = business_date - INTERVAL 1 DAY WHERE processed = 1 AND closed = 0');
    DB::run('UPDATE lo_daily_volume SET vol_date = vol_date - INTERVAL 1 DAY');
    $total = ['closed' => 0, 'failed' => 0];
    do { $r = Settlement::run(true, 100); $total['closed'] += $r['closed']; $total['failed'] += $r['failed']; } while ($r['closed'] > 0);
    return $total;
}
DB::run("INSERT INTO lo_settings (k, v) VALUES ('financial_release_approved', '1') ON DUPLICATE KEY UPDATE v = '1'");

// ---- Activation rules ----
$root = member('Root', null, null);
Commission::processActivation(pay($root)); midnight();
$a = member('A', $root, 'L');
$pending = pay($a, 'PENDING');
try { Commission::processActivation($pending); $ok = false; } catch (HttpError $e) { $ok = $e->status === 422; }
check('Pending payment never activates', $ok && (int) DB::val('SELECT is_active FROM lo_tree WHERE user_id = ?', [$a]) === 0);
$r = Settlement::run(true);
check('Minute runner ignores pending payment', (int) DB::val('SELECT processed FROM lo_activations WHERE id = ?', [$pending]) === 0 && ledger($root, 'REFERRAL') === 0.0);
DB::run("UPDATE lo_activations SET payment_status = 'FAILED' WHERE id = ?", [$pending]);
Settlement::run(true);
check('Failed payment never pays commission', ledger($root, 'REFERRAL') === 0.0);

$actA = pay($a);
try { DB::insert('INSERT INTO lo_activations (activation_code, user_id, payment_ref, payment_status) VALUES (?,?,?,?)', ['ACT-DUP', $a, 'TRX-DC3', 'SUCCESS']); $dup = false; }
catch (\PDOException $e) { $dup = true; }
check('Same Transaction ID cannot be used twice', $dup);
Settlement::run(true);
$rowA = DB::one('SELECT * FROM lo_activations WHERE id = ?', [$actA]);
check('SUCCESS payment activates at once (Pending -> Active)', (int) DB::val('SELECT is_active FROM lo_tree WHERE user_id = ?', [$a]) === 1);
check('Activation time, date, Transaction ID and status stored', $rowA['processed_at'] !== null && $rowA['business_date'] !== null && $rowA['payment_ref'] === 'TRX-DC3' && $rowA['payment_status'] === 'SUCCESS');
check('Direct referral ৳200 paid instantly', ledger($root, 'REFERRAL') === 200.0, (string) ledger($root, 'REFERRAL'));
Commission::processActivation($actA);
check('Replay of the same activation never pays twice', ledger($root, 'REFERRAL') === 200.0 && (int) DB::val('SELECT COUNT(*) FROM lo_sales WHERE activation_id = ?', [$actA]) === 1);
check('No generation or matching before midnight', ledger($root, 'GENERATION') === 0.0 && ledger($root, 'MATCHING') === 0.0 && (int) $rowA['closed'] === 0);
$vol = DB::one('SELECT * FROM lo_daily_volume WHERE user_id = ?', [$root]);
check('Today\'s new left volume counted for upline (Minor/Major daily counter)', $vol && (int) $vol['left_new'] === 1 && (int) $vol['right_new'] === 0);
$r = Settlement::run(true);
check('Today\'s activations are not closed before Bangladesh midnight', $r['closed'] === 0 && (int) DB::val('SELECT closed FROM lo_activations WHERE id = ?', [$actA]) === 0);
midnight();
check('Generation GEN-01 paid at midnight closing', ledger($root, 'GENERATION') === 50.0 && (int) DB::val("SELECT COUNT(*) FROM lo_ledger WHERE user_id = ? AND ledger_type = 'GENERATION' AND note LIKE 'GEN-01%'", [$root]) === 1);
check('Closing recorded as DONE and Minor Link daily counter reset', DB::val("SELECT status FROM lo_daily_closings ORDER BY closing_date DESC LIMIT 1") === 'DONE' && (int) DB::val('SELECT COUNT(*) FROM lo_daily_volume') === 0);
check('Major Link carry kept after closing (left 1, right 0)', (float) DB::val('SELECT left_carry FROM lo_tree WHERE user_id = ?', [$root]) === 1.0 && (float) DB::val('SELECT right_carry FROM lo_tree WHERE user_id = ?', [$root]) === 0.0);

// ---- Matching: right-side sale pairs with the kept left carry; one final credit per beneficiary ----
$b = member('B', $root, 'R');
Commission::processActivation(pay($b));
check('Matching waits for midnight', ledger($root, 'MATCHING') === 0.0);
midnight();
$events = DB::all('SELECT * FROM lo_matching_events WHERE beneficiary_id = ?', [$root]);
check('Root gets exactly ONE matching credit for the sale (binary + enrollment never both)', count($events) === 1 && ledger($root, 'MATCHING') === 150.0, json_encode(array_map(fn ($e) => [$e['selected_type'], $e['actual_payout']], $events)));
check('Both bills calculated, one selected', (float) $events[0]['binary_bill'] === 150.0 && (float) $events[0]['enrollment_bill'] === 150.0 && $events[0]['selected_type'] !== null);
check('Minor Link is zero after closing (both carries consumed)', (float) DB::val('SELECT left_carry + right_carry FROM lo_tree WHERE user_id = ?', [$root]) === 0.0);
check('Total Matching = Rank Matching = approved matching (1)', (int) DB::val('SELECT lifetime_matchings FROM lo_tree WHERE user_id = ?', [$root]) === 1 && (\LifeOS\Engine\Rank::current($root)['name'] ?? '') === 'Member');
check('Matching event dated on the business day', substr((string) $events[0]['created_at'], 11) === '23:59:59');

// Daily cap: a flushed (cap-exceeded) event is not approved and does not count toward Total Matching / Rank.
$c = member('C', $a, 'L');
$d = member('D', $b, 'R');
Commission::processActivation(pay($c));
Commission::processActivation(pay($d));
DB::run("UPDATE lo_settings SET v = '0' WHERE k = 'daily_matching_cap'");
$before = (int) DB::val('SELECT lifetime_matchings FROM lo_tree WHERE user_id = ?', [$root]);
midnight();
$flushed = (int) DB::val("SELECT COUNT(*) FROM lo_matching_events WHERE beneficiary_id = ? AND payout_status = 'FLUSHED'", [$root]);
check('Cap reached: event flushed, not paid', $flushed === 1 && ledger($root, 'MATCHING') === 150.0, "flushed=$flushed");
check('Flushed matching never raises Total Matching', (int) DB::val('SELECT lifetime_matchings FROM lo_tree WHERE user_id = ?', [$root]) === $before);
DB::run("UPDATE lo_settings SET v = '5000' WHERE k = 'daily_matching_cap'");

// ---- Generation: 10 levels only ----
$chain = [$root]; $prev = $root;
for ($i = 1; $i <= 11; $i++) { $prev = member("G$i", $prev, 'L'); $chain[] = $prev; Commission::processActivation(pay($prev)); }
midnight();
$x = member('X', $prev, 'L');
$gBefore = array_map(fn ($u) => ledger($u, 'GENERATION'), $chain);
Commission::processActivation(pay($x));
midnight();
$paidLevels = [];
foreach (array_reverse($chain) as $i => $u) { $diff = ledger($u, 'GENERATION') - $gBefore[array_search($u, $chain, true)]; if ($diff > 0) $paidLevels[$i + 1] = $diff; }
check('Generation paid to exactly 10 levels with plan rates', $paidLevels === [1 => 50.0, 2 => 30.0, 3 => 25.0, 4 => 20.0, 5 => 18.0, 6 => 15.0, 7 => 12.0, 8 => 10.0, 9 => 10.0, 10 => 10.0], json_encode($paidLevels));

// ---- Reversal before midnight: referral reversed, no generation/matching at closing ----
$y = member('Y', $root, 'L');
$actY = pay($y);
Commission::processActivation($actY);
$gen = ledger($root, 'GENERATION');
Commission::reverseActivation($actY, 'REFUNDED');
midnight();
check('Refunded before midnight: no generation/matching created', ledger($root, 'GENERATION') === $gen && (int) DB::val('SELECT COUNT(*) FROM lo_matching_events WHERE activation_id = ?', [$actY]) === 0);
check('Refunded activation closed and referral reversed', (int) DB::val('SELECT closed FROM lo_activations WHERE id = ?', [$actY]) === 1 && (float) DB::val("SELECT COALESCE(SUM(amount),0) FROM lo_ledger WHERE activation_id = ? AND user_id = ? AND ledger_type IN ('REFERRAL','ADJUSTMENT')", [$actY, $root]) === 0.0);

// ---- System error log: activation with no commission ----
$orphan = member('Orphan', null, null);
Commission::processActivation(pay($orphan));
midnight();
check('Activation without any commission recorded in System Error Log', (int) DB::val("SELECT COUNT(*) FROM lo_system_errors WHERE user_id = ? AND code IN ('REFERRAL_NOT_PAID','NO_COMMISSION')", [$orphan]) === 2);

echo "\n$pass passed, $fail failed\n";
exit($fail ? 1 : 0);
