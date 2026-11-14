<?php
declare(strict_types=1);

namespace LifeOS\Engine;

use LifeOS\Config;
use LifeOS\DB;
use LifeOS\HttpError;

/**
 * Minute runner.
 *  1. Instant phase: every verified, unprocessed SUCCESS activation gets its sale, cashback and direct referral.
 *  2. Daily closing (Bangladesh midnight): activations of each finished Dhaka day are frozen and closed in order —
 *     generation (10 levels), enrollment + binary matching, daily cap, central selection, carry update — then the
 *     day's Minor Link counters are reset and the closing is recorded. Major Link carry stays in lo_tree.
 *  3. Immutable statements for fully closed days.
 * Never invents sale events; each call is time-bounded so a host proxy limit cannot cut a transaction.
 */
final class Settlement
{
    public static function run(bool $execute = false, int $batch = 100, bool $testLab = false, float $budget = 40.0): array
    {
        if ($batch < 1 || $batch > 1000) throw new HttpError('Batch must be between 1 and 1000', 422);
        if ($testLab && !\LifeOS\TestLab::enabled()) throw new HttpError('Test lab is disabled', 403);
        if ($execute && !$testLab && Config::get('commission_cron_enabled', false) !== true) {
            throw new HttpError('Commission cron execution requires approved server configuration', 403);
        }
        if ($execute && !$testLab && DB::val("SELECT v FROM lo_settings WHERE k='financial_release_approved'") !== '1') {
            throw new HttpError('Financial release has not been approved', 403);
        }
        $lock = 'lifeos:settlement:' . (string) DB::val('SELECT DATABASE()');
        if ((int) DB::val('SELECT GET_LOCK(?, 0)', [$lock]) !== 1) return ['status' => 'busy'];
        $t0 = microtime(true);
        try {
            $today = (string) DB::val('SELECT CURRENT_DATE()');
            $ids = DB::all("SELECT id FROM lo_activations WHERE payment_status = 'SUCCESS' AND processed = 0 ORDER BY id LIMIT $batch");
            $closingDays = DB::all("SELECT business_date AS day, COUNT(*) AS n FROM lo_activations
                WHERE processed = 1 AND closed = 0 AND business_date < ? GROUP BY business_date ORDER BY business_date", [$today]);
            $dates = self::statementDays($batch, $today);
            $result = ['status' => $execute ? 'executed' : 'dry-run', 'eligible_activations' => count($ids),
                'closing_pending' => array_sum(array_map(fn ($r) => (int) $r['n'], $closingDays)),
                'closing_days' => count($closingDays),
                'unfinished_days' => count($dates) + count($closingDays), 'processed' => 0, 'closed' => 0,
                'days_closed' => 0, 'statements_closed' => 0, 'failed' => 0];
            if (!$execute) return $result;

            foreach ($ids as $row) {
                if (microtime(true) - $t0 > $budget) break;
                try {
                    Commission::processActivation((int) $row['id']);
                    $result['processed']++;
                } catch (\Throwable $error) {
                    // Never print user data, configuration, SQL, credentials or exception messages.
                    $result['failed']++;
                    self::logFailure((int) $row['id'], 'INSTANT_PHASE_FAILED');
                }
            }

            foreach ($closingDays as $dayRow) {
                $day = (string) $dayRow['day'];
                DB::run("INSERT IGNORE INTO lo_daily_closings (closing_date, status, started_at) VALUES (?, 'RUNNING', NOW())", [$day]);
                $stuck = false;
                while (microtime(true) - $t0 <= $budget) {
                    $rows = DB::all("SELECT id FROM lo_activations WHERE processed = 1 AND closed = 0 AND business_date = ? ORDER BY id LIMIT $batch", [$day]);
                    if (!$rows) break;
                    $progress = 0;
                    foreach ($rows as $row) {
                        if (microtime(true) - $t0 > $budget) break;
                        try {
                            $c = Commission::closeActivation((int) $row['id']);
                            $result['closed']++; $progress++;
                            DB::run('UPDATE lo_daily_closings SET activations = activations + 1, matching_events = matching_events + ?,
                                matching_paid = matching_paid + ?, generation_paid = generation_paid + ? WHERE closing_date = ?',
                                [$c['events'], $c['matching'], $c['generation'], $day]);
                        } catch (\Throwable $error) {
                            $result['failed']++;
                            self::logFailure((int) $row['id'], 'CLOSING_FAILED');
                            $stuck = true;
                            break; // keep the day's order: retry the same activation on the next run
                        }
                    }
                    if ($stuck || $progress === 0) break;
                }
                if ($stuck || !self::finishDay($day)) break; // later days wait until this day is fully closed
                $result['days_closed']++;
            }
            // A finished day without any activation still records its closing (Minor Link reset).
            $yesterday = (string) DB::val('SELECT ? - INTERVAL 1 DAY', [$today]);
            self::finishDay($yesterday);

            foreach (self::statementDays($batch, $today) as $row) {
                try { $result['statements_closed'] += Statements::close((string) $row['day']); }
                catch (\Throwable $error) { $result['failed']++; }
            }
            return $result;
        } finally {
            DB::val('SELECT RELEASE_LOCK(?)', [$lock]);
        }
    }

    /** Marks a day closed once none of its activations remain open; resets that day's Minor Link counters. */
    private static function finishDay(string $day): bool
    {
        if (DB::one('SELECT id FROM lo_activations WHERE processed = 1 AND closed = 0 AND business_date = ? LIMIT 1', [$day])) return false;
        DB::tx(function () use ($day) {
            DB::run("INSERT INTO lo_daily_closings (closing_date, status, started_at, finished_at) VALUES (?, 'DONE', NOW(), NOW())
                     ON DUPLICATE KEY UPDATE status = 'DONE', finished_at = COALESCE(finished_at, NOW())", [$day]);
            DB::run('DELETE FROM lo_daily_volume WHERE vol_date <= ?', [$day]);
        });
        return true;
    }

    /** Past days with matching events and no statement, only when that day's closing has fully finished. */
    private static function statementDays(int $batch, string $today): array
    {
        return DB::all("SELECT DISTINCT DATE(e.created_at) AS day FROM lo_matching_events e
            LEFT JOIN lo_statements s ON s.user_id = e.beneficiary_id AND s.statement_date = DATE(e.created_at)
            WHERE e.created_at < ? AND s.statement_code IS NULL
              AND NOT EXISTS (SELECT 1 FROM lo_activations a WHERE a.processed = 1 AND a.closed = 0 AND a.business_date = DATE(e.created_at))
            ORDER BY day LIMIT $batch", [$today]);
    }

    private static function logFailure(int $activationId, string $code): void
    {
        try { Commission::logError($activationId, null, $code, 'Commission step failed and will be retried by the next run'); }
        catch (\Throwable $ignored) {}
    }
}
