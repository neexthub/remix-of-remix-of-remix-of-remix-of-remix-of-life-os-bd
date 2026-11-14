"""Rebuild the Life OS database from the old site's full database, keeping new-site work on old members.

Runs entirely inside one MySQL server (cross-database INSERT ... SELECT), so the 1.9 GB old database
(profile images, 992k wallet history rows) never leaves the host.
  OLD = old site database (every table and row is carried over as-is, except admin accounts)
  CUR = current new-site database (admin, settings, notices, audit, new-site password/profile edits,
        deposits and activations of OLD members; members created after the restore are dropped)
  NEW = empty target database
Phase "build" runs while the site still uses CUR. Phase "finish" runs after the site is switched to NEW
(so migration 013 has already added the daily-closing columns): legacy carry, matching counts, ranks
and the old cashback/service balances.
Usage: python rebuild_v3.py build|finish  (EXEC=local|live, OLD_DB/CUR_DB/NEW_DB, MAX_OLD_ID)
"""
import os
import sys
import time

OLD = os.environ.get("OLD_DB", "old_lifeos")
CUR = os.environ.get("CUR_DB", "restore_l")
NEW = os.environ.get("NEW_DB", "v3_l")
MAX_OLD = int(os.environ.get("MAX_OLD_ID", "72824"))
CHUNK_ROWS = int(os.environ.get("CHUNK_ROWS", "60000"))
# Tables that always come from the new site (engine, admin, settings). Old admin logins are never imported.
FROM_CUR = {"users", "user_profiles", "admin_users", "admin_roles"}
IMAGE_COLUMNS = ["photo_base64", "nid_front_base64", "nid_back_base64", "selfie_base64", "comp_signature"]
# Legacy users columns restored from the old site (the earlier import zeroed loans/points).
OLD_USER_COLUMNS = ["points", "activation_points", "loan_recovery_active", "loan_amount", "loan_paid",
                    "left_count", "right_count", "total_pairs", "consumed_rank_pairs", "rank_id"]


class Local:
    def __init__(self):
        import pymysql
        self.db = pymysql.connect(unix_socket=os.environ.get("MYSQL_SOCKET", "/tmp/mdb/run/m.sock"), user="root",
                                  charset="utf8mb4", autocommit=True, cursorclass=pymysql.cursors.DictCursor)
        with self.db.cursor() as c:
            c.execute("SET time_zone = '+06:00'")

    def rows(self, sql):
        with self.db.cursor() as c:
            c.execute(sql)
            return list(c.fetchall())

    def run(self, sql):
        with self.db.cursor() as c:
            return c.execute(sql)


class Live:
    def __init__(self):
        sys.path.insert(0, os.environ.get("CP_DIR", "/tmp/browser/live"))
        import cp
        self.cp = cp

    def rows(self, sql):
        return self.cp.q(sql)["rows"]

    def run(self, sql):
        for attempt in range(4):
            try:
                return self.cp.q(sql, write=True)["affected"]
            except Exception as error:
                if attempt == 3 or "HTTP 4" in str(error):
                    raise
                print("  retry after:", str(error)[:160])
                time.sleep(5 * (attempt + 1))


X = Local() if os.environ.get("EXEC", "local") == "local" else Live()


def tables(db):
    return [r["t"] for r in X.rows(f"SELECT table_name AS t FROM information_schema.tables WHERE table_schema='{db}' AND table_type='BASE TABLE' ORDER BY table_name")]


def cols(db, t):
    return [r["c"] for r in X.rows(f"SELECT column_name AS c FROM information_schema.columns WHERE table_schema='{db}' AND table_name='{t}' ORDER BY ordinal_position")]


def count(db, t, where=""):
    return int(X.rows(f"SELECT COUNT(*) AS n FROM `{db}`.`{t}` {where}")[0]["n"])


def copy(src, t, where="", key=None):
    """INSERT IGNORE NEW.t (common columns) SELECT FROM src.t, chunked on a numeric key."""
    common = [c for c in cols(NEW, t) if c in set(cols(src, t))]
    cl = ", ".join(f"`{c}`" for c in common)
    base = f"INSERT IGNORE INTO `{NEW}`.`{t}` ({cl}) SELECT {cl} FROM `{src}`.`{t}`"
    total = count(src, t, where)
    key = key or ("id" if "id" in common else "user_id" if "user_id" in common else None)
    if total <= CHUNK_ROWS or key is None:
        n = X.run(f"{base} {where}")
    else:
        lo, hi = (int(v or 0) for v in X.rows(f"SELECT MIN(`{key}`) AS a, MAX(`{key}`) AS b FROM `{src}`.`{t}`")[0].values())
        span = max(1, int((hi - lo + 1) * CHUNK_ROWS / max(total, 1)))
        n, start = 0, lo
        while start <= hi:
            cond = f"`{key}` >= {start} AND `{key}` < {start + span}"
            n += X.run(f"{base} {where + ' AND ' if where else 'WHERE '}{cond}")
            start += span
    print(f"  {t}: {n} rows from {src}")
    return n


def build():
    if tables(NEW) and os.environ.get("RESUME") != "1":
        sys.exit(f"{NEW} is not empty; refusing (RESUME=1 continues an interrupted build; every step is idempotent)")
    cur_t, old_t = tables(CUR), tables(OLD)
    for t in cur_t:
        X.run(f"CREATE TABLE IF NOT EXISTS `{NEW}`.`{t}` LIKE `{CUR}`.`{t}`")
    for t in old_t:
        if t not in cur_t:
            X.run(f"CREATE TABLE IF NOT EXISTS `{NEW}`.`{t}` LIKE `{OLD}`.`{t}`")
    print(f"created {len(set(cur_t) | set(old_t))} tables")

    # New-site data (engine tables, admin, settings, audit): only rows of old members are kept.
    for t in cur_t:
        if not (t.startswith("lo_") or t in FROM_CUR):
            continue
        c = cols(CUR, t)
        if t == "users":
            where = f"WHERE id <= {MAX_OLD}"
        elif t == "lo_admin_audit" or "user_id" in c:
            where = f"WHERE user_id <= {MAX_OLD}"
        else:
            where = ""
        if count(CUR, t, where):
            copy(CUR, t, where)
    # Child pointers to removed members are cleared (their slots become free again).
    X.run(f"UPDATE `{NEW}`.lo_tree SET left_child_id = NULL WHERE left_child_id > {MAX_OLD}")
    X.run(f"UPDATE `{NEW}`.lo_tree SET right_child_id = NULL WHERE right_child_id > {MAX_OLD}")
    X.run(f"UPDATE `{NEW}`.lo_tree SET sponsor_id = NULL WHERE sponsor_id > {MAX_OLD}")

    # Every other table: the old site's complete data, row for row (wallets with their exact balances).
    for t in old_t:
        if t in FROM_CUR or t.startswith("lo_"):
            continue
        if count(OLD, t):
            copy(OLD, t)

    # Old-site legacy user columns (loans, points, counters) restored exactly.
    ucols = [c for c in OLD_USER_COLUMNS if c in cols(NEW, "users") and c in cols(OLD, "users")]
    X.run(f"UPDATE `{NEW}`.users n JOIN `{OLD}`.users o ON o.id = n.id SET " + ", ".join(f"n.`{c}` = o.`{c}`" for c in ucols) + ", n.updated_at = n.updated_at")
    # Profile images from the old site, unless the member uploaded a new one on the new site.
    latest = (f"SELECT p.* FROM `{OLD}`.user_profiles p JOIN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER "
              f"(PARTITION BY user_id ORDER BY updated_at DESC, id DESC) rn FROM `{OLD}`.user_profiles) x WHERE rn = 1) k ON k.id = p.id")
    img = [c for c in IMAGE_COLUMNS if c in cols(NEW, "user_profiles")]
    for start in range(0, MAX_OLD + 1, 1500):
        X.run(f"UPDATE `{NEW}`.user_profiles n JOIN ({latest} WHERE p.user_id >= {start} AND p.user_id < {start + 1500}) o ON o.user_id = n.user_id SET "
              + ", ".join(f"n.`{c}` = COALESCE(n.`{c}`, o.`{c}`)" for c in img) + ", n.updated_at = n.updated_at")
    # Second pass: an image kept only on an older duplicate profile row is still carried over.
    for start in range(0, MAX_OLD + 1, 1500):
        X.run(f"UPDATE `{NEW}`.user_profiles n JOIN `{OLD}`.user_profiles o ON o.user_id = n.user_id AND o.user_id >= {start} AND o.user_id < {start + 1500} SET "
              + ", ".join(f"n.`{c}` = COALESCE(n.`{c}`, o.`{c}`)" for c in img) + ", n.updated_at = n.updated_at")
    # Old admin accounts/roles are archived (they can never sign in to the new admin panel).
    for t in ("admin_users", "admin_roles"):
        X.run(f"CREATE TABLE IF NOT EXISTS `{NEW}`.legacy_{t} LIKE `{OLD}`.{t}")
        X.run(f"INSERT IGNORE INTO `{NEW}`.legacy_{t} SELECT * FROM `{OLD}`.{t}")
    # Older duplicate profile rows of the old site are archived, never dropped.
    X.run(f"CREATE TABLE IF NOT EXISTS `{NEW}`.legacy_user_profiles_history LIKE `{OLD}`.user_profiles")
    X.run(f"INSERT IGNORE INTO `{NEW}`.legacy_user_profiles_history SELECT p.* FROM `{OLD}`.user_profiles p WHERE p.id NOT IN "
          f"(SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id DESC) rn FROM `{OLD}`.user_profiles) x WHERE rn = 1)")
    print("build complete")


def sync():
    """Right before the switch: member edits made on the current site during the build are copied again,
    and every updated_at is restored from the current site (build-time UPDATEs must not alter it)."""
    since = os.environ["SINCE"]
    for t, key in (("users", "id"), ("user_profiles", "id")):
        skip = {key, "updated_at"} | (set(OLD_USER_COLUMNS) if t == "users" else set(IMAGE_COLUMNS))
        common = [c for c in cols(NEW, t) if c in set(cols(CUR, t)) and c not in skip]
        sets = ", ".join(f"n.`{c}` = c.`{c}`" for c in common)
        if t == "user_profiles":
            sets += ", " + ", ".join(f"n.`{c}` = COALESCE(c.`{c}`, n.`{c}`)" for c in IMAGE_COLUMNS if c in common or c in cols(NEW, t))
        n = X.run(f"UPDATE `{NEW}`.`{t}` n JOIN `{CUR}`.`{t}` c ON c.`{key}` = n.`{key}` SET {sets}, n.updated_at = c.updated_at WHERE c.updated_at >= '{since}'")
        print(f"  {t}: {n} rows edited since {since} re-synced")
        for start in range(0, MAX_OLD + 2000, 20000):
            X.run(f"UPDATE `{NEW}`.`{t}` n JOIN `{CUR}`.`{t}` c ON c.`{key}` = n.`{key}` SET n.updated_at = c.updated_at WHERE n.`{key}` >= {start} AND n.`{key}` < {start + 20000} AND n.updated_at <> c.updated_at")
    for t in ("lo_activations", "lo_deposits", "lo_admin_audit"):
        n = copy(CUR, t, f"WHERE user_id <= {MAX_OLD}")
    print("sync complete")


def finish():
    """Runs on NEW after migration 013 (site switched)."""
    assert "legacy_binary_matchings" in cols(NEW, "lo_tree"), "migration 013 not applied yet"
    # Old matching counts: binary pairs (old total_pairs) + paid enrollment matchings; both feed Total = Rank Matching.
    X.run(f"""UPDATE `{NEW}`.lo_tree t JOIN `{NEW}`.users u ON u.id = t.user_id
        LEFT JOIN (SELECT upline_user_id AS uid, COUNT(*) AS n FROM `{NEW}`.matching_events WHERE status = 'paid' GROUP BY upline_user_id) e ON e.uid = t.user_id
        SET t.legacy_binary_matchings = GREATEST(u.total_pairs, 0),
            t.legacy_enrollment_matchings = COALESCE(e.n, 0),
            t.lifetime_matchings = GREATEST(u.total_pairs, 0) + COALESCE(e.n, 0),
            t.left_consumed = GREATEST(u.total_pairs, 0), t.right_consumed = GREATEST(u.total_pairs, 0),
            t.left_carry = IF(t.is_active = 1 AND u.left_count > u.right_count, GREATEST(u.left_count - u.total_pairs, 0), 0),
            t.right_carry = IF(t.is_active = 1 AND u.right_count > u.left_count, GREATEST(u.right_count - u.total_pairs, 0), 0)""")
    # Old activations are already settled: never paid again by the new engine.
    X.run(f"UPDATE `{NEW}`.lo_activations SET closed = 1, closed_at = COALESCE(closed_at, processed_at), business_date = COALESCE(business_date, DATE(COALESCE(processed_at, created_at))) WHERE processed = 1")
    # Ranks follow the approved matching count (keeps any higher earned rank already recorded).
    n = X.run(f"""INSERT IGNORE INTO `{NEW}`.lo_user_ranks (user_id, rank_id)
        SELECT t.user_id, r.id FROM `{NEW}`.lo_tree t JOIN `{NEW}`.lo_ranks r ON r.required_matchings <= t.lifetime_matchings WHERE t.is_active = 1""")
    print("rank rows added:", n)
    # Old cashback and service balances become visible, spendable service credit (exact amounts, once).
    for column, label in (("cashback_balance", "Old site cashback balance"), ("service_balance", "Old site service balance")):
        tag = "OLD-CASHBACK-" if column == "cashback_balance" else "OLD-SERVICE-"
        n = X.run(f"""INSERT IGNORE INTO `{NEW}`.lo_ledger (payout_code, user_id, ledger_type, amount, note)
            SELECT CONCAT('{tag}', w.user_id), w.user_id, 'CASHBACK', w.`{column}`, '{label}'
            FROM `{NEW}`.user_wallets w JOIN `{NEW}`.users u ON u.id = w.user_id WHERE w.`{column}` > 0""")
        print(f"{label}: {n} rows")
    # Old main balance is withdrawable; pending/frozen old balances must be zero (verified) or reviewed by hand.
    n = X.run(f"""INSERT IGNORE INTO `{NEW}`.lo_ledger (payout_code, user_id, ledger_type, amount, note)
        SELECT CONCAT('OLD-BALANCE-', w.user_id), w.user_id, 'ADJUSTMENT', w.balance, 'Old site main balance'
        FROM `{NEW}`.user_wallets w JOIN `{NEW}`.users u ON u.id = w.user_id WHERE w.balance > 0""")
    held = X.rows(f"SELECT COUNT(*) AS n FROM `{NEW}`.user_wallets WHERE pending_balance <> 0 OR frozen_balance <> 0 OR balance < 0")[0]["n"]
    print(f"Old site main balance: {n} rows; wallets with pending/frozen/negative needing review: {held}")
    print("finish complete")


if __name__ == "__main__":
    {"build": build, "sync": sync, "finish": finish}[sys.argv[1]]()
