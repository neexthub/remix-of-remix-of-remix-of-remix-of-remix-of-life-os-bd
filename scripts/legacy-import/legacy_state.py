"""Read-only legacy member state: matching counts are not wallet balances."""


def matching_count(value):
    return max(0, int(value or 0))


def sponsor_reference(value):
    # Old copy/pasted referral codes include invisible direction markers.
    import unicodedata
    return ''.join(c for c in (value or '').strip() if unicodedata.category(c) != 'Cf')


def tree_record(uid, sponsor, parent, side, left, right, status, total_pairs):
    return (uid, sponsor, parent, side, left, right,
            1 if status == "active" else 0, matching_count(total_pairs))