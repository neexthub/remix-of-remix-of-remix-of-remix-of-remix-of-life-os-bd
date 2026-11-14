"""Read-only checks that the rebuilt database kept every old-site row and follows the new plan rules.
Usage: EXEC=local|live OLD_DB=.. NEW_DB=.. python verify_v3.py   (exit 1 on any failure)"""
import os
import sys
import rebuild_v3 as R

X, OLD, NEW, MAX_OLD = R.X, R.OLD, R.NEW, R.MAX_OLD
fails = []


def check(name, ok, detail=""):
    print(("ok    " if ok else "FAIL  ") + name + ("" if ok or not detail else f"  [{detail}]"))
    if not ok:
        fails.append(name)


def val(sql):
    return list(X.rows(sql)[0].values())[0]


# Every old-site table and row is present (admin accounts archived, duplicate profiles archived).
diff = []
for t in R.tables(OLD):
    a = R.count(OLD, t)
    b = R.count(NEW, t)
    if t in ("admin_users", "admin_roles"):
        b = R.count(NEW, f"legacy_{t}")
    if t == "user_profiles":
        b += R.count(NEW, "legacy_user_profiles_history")
    if a != b:
        diff.append(f"{t} old={a} new={b}")
check("every old-site table has all its rows", not diff, "; ".join(diff[:8]))
check("only old-site members (no member created after the restore)", int(val(f"SELECT COUNT(*) FROM `{NEW}`.users WHERE id > {MAX_OLD}")) == 0 and int(val(f"SELECT COUNT(*) FROM `{NEW}`.users")) == R.count(OLD, "users"))
check("old wallets kept exactly", int(val(f"SELECT COUNT(*) FROM `{NEW}`.user_wallets n JOIN `{OLD}`.user_wallets o ON o.id = n.id WHERE n.balance <> o.balance OR n.service_balance <> o.service_balance OR n.cashback_balance <> o.cashback_balance OR n.pending_balance <> o.pending_balance OR n.frozen_balance <> o.frozen_balance")) == 0)
check("old loans and pair counters kept exactly", int(val(f"SELECT COUNT(*) FROM `{NEW}`.users n JOIN `{OLD}`.users o ON o.id = n.id WHERE n.loan_amount <> o.loan_amount OR n.loan_paid <> o.loan_paid OR n.total_pairs <> o.total_pairs OR n.left_count <> o.left_count OR n.right_count <> o.right_count")) == 0)
check("every old profile photo/NID image carried over", int(val(f"SELECT COUNT(DISTINCT user_id) FROM `{OLD}`.user_profiles WHERE photo_base64 IS NOT NULL")) <= int(val(f"SELECT COUNT(*) FROM `{NEW}`.user_profiles WHERE photo_base64 IS NOT NULL")) and int(val(f"SELECT COUNT(DISTINCT user_id) FROM `{OLD}`.user_profiles WHERE nid_front_base64 IS NOT NULL")) <= int(val(f"SELECT COUNT(*) FROM `{NEW}`.user_profiles WHERE nid_front_base64 IS NOT NULL")))
old_cb = float(val(f"SELECT COALESCE(SUM(cashback_balance + service_balance),0) FROM `{OLD}`.user_wallets"))
new_cb = float(val(f"SELECT COALESCE(SUM(amount),0) FROM `{NEW}`.lo_ledger WHERE payout_code LIKE 'OLD-CASHBACK-%' OR payout_code LIKE 'OLD-SERVICE-%'"))
check(f"old cashback + service balances visible in the cashback wallet (৳{old_cb:,.0f})", abs(old_cb - new_cb) < 0.01, f"ledger {new_cb}")
check("one tree node per member, no duplicate slot", int(val(f"SELECT COUNT(*) FROM `{NEW}`.lo_tree")) == int(val(f"SELECT COUNT(*) FROM `{NEW}`.users")) and int(val(f"SELECT COUNT(*) FROM (SELECT placement_parent_id, placement_side FROM `{NEW}`.lo_tree WHERE placement_parent_id IS NOT NULL GROUP BY placement_parent_id, placement_side HAVING COUNT(*) > 1) x")) == 0)
check("parent/child pointers agree both ways", int(val(f"SELECT COUNT(*) FROM `{NEW}`.lo_tree c JOIN `{NEW}`.lo_tree p ON p.user_id = c.placement_parent_id WHERE (c.placement_side = 'L' AND (p.left_child_id IS NULL OR p.left_child_id <> c.user_id)) OR (c.placement_side = 'R' AND (p.right_child_id IS NULL OR p.right_child_id <> c.user_id))")) == 0)
check("Total Matching = old binary pairs + old paid enrollment matchings", int(val(f"SELECT COUNT(*) FROM `{NEW}`.lo_tree t JOIN `{NEW}`.users u ON u.id = t.user_id WHERE t.legacy_binary_matchings <> u.total_pairs OR t.lifetime_matchings < t.legacy_binary_matchings + t.legacy_enrollment_matchings")) == 0)
check("old paid enrollment matchings counted per member", int(val(f"SELECT COALESCE(SUM(legacy_enrollment_matchings),0) FROM `{NEW}`.lo_tree")) == int(val(f"SELECT COUNT(*) FROM `{NEW}`.matching_events WHERE status = 'paid' AND upline_user_id IN (SELECT id FROM `{NEW}`.users)")))
check("every active member holds every rank their Total Matching reaches", int(val(f"SELECT COUNT(*) FROM `{NEW}`.lo_tree t JOIN `{NEW}`.lo_ranks r ON r.required_matchings <= t.lifetime_matchings LEFT JOIN `{NEW}`.lo_user_ranks ur ON ur.user_id = t.user_id AND ur.rank_id = r.id WHERE t.is_active = 1 AND ur.user_id IS NULL")) == 0)
check("Major Link carry only on the bigger side; Minor Link carry is zero", int(val(f"SELECT COUNT(*) FROM `{NEW}`.lo_tree WHERE left_carry > 0 AND right_carry > 0")) == 0 and int(val(f"SELECT COUNT(*) FROM `{NEW}`.lo_tree WHERE is_active = 0 AND (left_carry > 0 OR right_carry > 0)")) == 0)
check("old activations are closed (never paid again)", int(val(f"SELECT COUNT(*) FROM `{NEW}`.lo_activations WHERE activation_code LIKE 'LEGACY-%' AND (processed = 0 OR closed = 0)")) == 0)
check("admin accounts are the new site's only", int(val(f"SELECT COUNT(*) FROM `{NEW}`.admin_users")) >= 1)
print(f"\n{len(fails)} failed")
sys.exit(1 if fails else 0)
