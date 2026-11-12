"""Read-only full-tree checks. Requires LIFEOS_TEST_API and LIFEOS_TEST_MEMBER_TOKEN.

Never creates members, changes money, or runs commissions; safe against an authorised live session.
"""
import json
import os
import urllib.request


def read(path):
    request = urllib.request.Request(os.environ['LIFEOS_TEST_API'].rstrip('/') + '/member' + path,
                                    headers={'Authorization': 'Bearer ' + os.environ['LIFEOS_TEST_MEMBER_TOKEN'],
                                             'User-Agent': 'LifeOS-Tree-ReadOnly-Test/1.0'})
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)['data']


overview = read('/tree/binary?overview=1')
nodes = {row[0]: row for row in overview['members']}
root = nodes[overview['root_id']]


def leg(child):
    seen = set()
    stack = [] if child is None else [child]
    active = 0
    while stack:
        uid = stack.pop()
        assert uid not in seen, 'Cycle or duplicate member'
        seen.add(uid)
        row = nodes[uid]
        active += bool(row[3])
        stack.extend(c for c in row[4:6] if c is not None)
    return len(seen), active


left, left_active = leg(root[4])
right, right_active = leg(root[5])
assert left + right + 1 == len(nodes), 'Overview must include every reachable member'
detail = read('/tree/binary?details=1')
assert (detail['left_total'], detail['right_total']) == (left, right)
assert (detail['left_active'], detail['right_active']) == (left_active, right_active)
assert detail['left'] is None and detail['right'] is None, 'Details must not recursively download nodes'
directs = read('/tree/enrollment')['directs']
assert all('name' in row for row in directs), 'Sponsor API must return profile names'
print(f'Full-tree and active-count checks passed: {len(nodes)} members, {left_active}/{right_active} active legs; sponsor names returned.')