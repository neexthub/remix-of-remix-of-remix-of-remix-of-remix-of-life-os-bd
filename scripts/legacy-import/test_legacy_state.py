import unittest

from legacy_state import tree_record, sponsor_reference


class LegacyStateTests(unittest.TestCase):
    def test_direction_marker_does_not_break_original_sponsor(self):
        self.assertEqual(sponsor_reference('\u200eLID-2026-2769D6'), 'LID-2026-2769D6')

    def test_old_matching_is_preserved(self):
        self.assertEqual(tree_record(89, 87, 87, "L", 91, None, "active", 8596)[7], 8596)

    def test_active_member_stays_active(self):
        self.assertEqual(tree_record(89, 87, 87, "L", 91, None, "active", 8596)[6], 1)

    def test_pending_member_stays_inactive(self):
        self.assertEqual(tree_record(92, 89, 91, "R", None, None, "pending", 0)[6], 0)

    def test_sponsor_and_placement_are_separate(self):
        self.assertEqual(tree_record(92, 89, 91, "R", None, None, "active", 12)[1:4], (89, 91, "R"))


if __name__ == "__main__":
    unittest.main()