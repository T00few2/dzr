"""Run from apps/api: python -m unittest discover -s tests -v."""

import os
import unittest
from datetime import datetime
from unittest.mock import Mock, patch

# Import the production code without initializing Firebase credentials or clients.
with patch("firebase_admin.initialize_app"), patch("firebase_admin.firestore.client"), patch("dotenv.load_dotenv"):
    import firebase
    import main

from zwiftpower import ZwiftPower


UPGRADE_FIELDS = ("upgradedZPCategory", "upgradedZwiftRacingCategory", "upgradedZRSCategory")


def rider(rider_id, upgraded=False):
    return {
        "riderId": rider_id,
        "name": f"Rider {rider_id}",
        "zpCategory": "B" if upgraded else "C",
        "race": {"current": {"mixed": {"number": 7 if upgraded else 8}}},
        "racingScore": 600 if upgraded else 400,
    }


class HighlightFilterTests(unittest.TestCase):
    def setUp(self):
        self.addCleanup(patch.stopall)
        patch("requests.sessions.Session.request", side_effect=AssertionError("Unexpected HTTP request")).start()
        snapshots = {
            "2026-10-23": {"data": {"riders": [rider(42), rider("43"), rider(44)]}},
            "2026-10-24": {"data": {"riders": [rider("42", True), rider(43, True), rider(44, True)]}},
        }
        db = patch.object(firebase, "db").start()
        db.collection.return_value.document.side_effect = lambda date: Mock(
            get=lambda: Mock(exists=True, to_dict=lambda: snapshots[date])
        )
        patch.object(main, "_club_member_zwift_ids_cache", None).start()
        patch.object(main, "_club_member_zwift_ids_cache_ts", None).start()
        patch.object(main, "_club_member_role_id_cache", None).start()
        self.clock = patch.object(main.time, "time", return_value=1000).start()
        patch.dict(os.environ, {"DISCORD_GUILD_ID": "guild", "DISCORD_BOT_TOKEN": "unused"}).start()
        self.membership = {"membership": {"clubMemberRoleId": "club"}}
        self.settings = patch.object(firebase, "get_document", side_effect=self._membership_settings).start()
        self.users = patch.object(firebase, "get_collection", return_value=[
            {"discordId": "both", "zwiftId": "42"},
            {"discordId": "verified", "zwiftId": 43},
            {"discordId": "club", "zwiftId": "44"},
            {"discordId": "neither", "zwiftId": "45"},
            {"discordId": "unlinked"},
        ]).start()
        self.members = patch.object(main.DiscordAPI, "get_all_members", return_value=[
            {"discordID": "both", "role_ids": ["verified", "club"]},
            {"discordID": "verified", "role_ids": ["verified"]},
            {"discordID": "club", "role_ids": ["club"]},
            {"discordID": "neither", "role_ids": []},
            {"discordID": "unlinked", "role_ids": ["verified", "club"]},
        ]).start()
        self.commentator = patch.object(main, "ZwiftCommentator").start()
        self.commentator.return_value.generate_upgrade_comment.return_value = "Upgrade highlights"
        self.commentator.return_value.generate_commentary.return_value = "Weekly results"
        self.commentator.return_value.send_to_discord_api.return_value = {"success": True}
        self.weekly_session = Mock()
        self.weekly_session.get.return_value.json.side_effect = lambda: {
            "data": [{"zwid": i} for i in [42, 43, 44, 45]]
        }
        patch.object(main, "get_authenticated_session", return_value=self.weekly_session).start()
        self.analyze = patch.object(ZwiftPower, "analyze_team_results", return_value={}).start()

    def _membership_settings(self, collection, doc_id):
        self.assertEqual((collection, doc_id), ("system_settings", "global"))
        return self.membership

    def post(self, path):
        with patch.object(main, "require_api_or_401", return_value=None), patch.object(main, "datetime") as clock:
            clock.now.return_value = datetime(2026, 10, 24, 12)
            return main.app.test_client().post(path)

    def test_upgrade_filter_distinguishes_unrestricted_empty_and_selected_riders(self):
        for allowed, expected in [(None, [42, 43, 44]), (set(), []), ({"42"}, [42]), ({"99"}, [])]:
            with self.subTest(allowed=allowed):
                result = firebase.compare_rider_categories("261024", "261023", allowed_rider_ids=allowed)
                for field in UPGRADE_FIELDS:
                    self.assertEqual([row["riderId"] for row in result[field]], expected)

    def test_weekly_results_use_the_same_empty_allowlist_rule(self):
        zp = ZwiftPower("unused", "unused")
        zp.session = Mock()
        for allowed, expected in [(None, [42, "43"]), (set(), []), ({"42"}, [42]), ({"99"}, [])]:
            with self.subTest(allowed=allowed):
                zp.session.get.return_value.json.return_value = {"data": [{"zwid": 42}, {"zwid": "43"}]}
                result = zp.get_team_results(11939, allowed_zwids=allowed)
                self.assertEqual([row["zwid"] for row in result["data"]], expected)

    def test_highlights_select_club_members_with_a_linked_zwift_id(self):
        self.assertEqual(main._get_club_member_zwift_ids(), {"42", "44"})

    def test_verified_role_does_not_affect_selection_or_cache(self):
        with patch.object(main, "VERIFIED_MEMBER_ROLE_ID", ""):
            self.assertEqual(main._get_club_member_zwift_ids(), {"42", "44"})
        with patch.object(main, "VERIFIED_MEMBER_ROLE_ID", "changed"):
            self.assertEqual(main._get_club_member_zwift_ids(), {"42", "44"})
            self.members.assert_called_once()
            self.assertEqual(main._get_club_member_zwift_ids(force_refresh=True), {"42", "44"})

    def test_both_commentary_endpoints_share_one_cached_audience(self):
        daily = "/generate_and_post_upgrades"
        weekly = "/generate_and_post_commentary/11939"
        for order in [(daily, weekly), (weekly, daily)]:
            with self.subTest(order=order):
                main._club_member_zwift_ids_cache = None
                self.members.reset_mock()
                for endpoint in order:
                    self.assertEqual(self.post(endpoint).status_code, 200)
                self.members.assert_called_once()

    def test_membership_setting_controls_selection(self):
        self.membership["membership"]["clubMemberRoleId"] = "other-club"
        self.members.return_value[1]["role_ids"].append("other-club")
        self.assertEqual(main._get_club_member_zwift_ids(), {"43"})

    def test_membership_role_change_refreshes_the_cached_audience(self):
        self.assertEqual(main._get_club_member_zwift_ids(), {"42", "44"})
        self.membership["membership"]["clubMemberRoleId"] = "other-club"
        self.members.return_value[1]["role_ids"].append("other-club")
        self.assertEqual(main._get_club_member_zwift_ids(), {"43"})
        self.assertEqual(self.members.call_count, 2)

    def test_empty_club_role_skips_lookups_and_caches_no_riders(self):
        cases = [
            {"membership": {"clubMemberRoleId": None}},
            {"membership": {"clubMemberRoleId": ""}},
            {"membership": {"clubMemberRoleId": "  "}},
            {"membership": {}},
            {},
            None,
        ]
        for membership in cases:
            with self.subTest(membership=membership):
                self.membership = membership
                self.assertEqual(main._get_club_member_zwift_ids(force_refresh=True), set())
                self.assertEqual(main._club_member_zwift_ids_cache, set())
                self.assertEqual(main._club_member_role_id_cache, "")
                self.assertEqual(main._club_member_zwift_ids_cache_ts, self.clock.return_value)
        self.users.assert_not_called()
        self.members.assert_not_called()

    def test_membership_settings_errors_select_no_riders(self):
        self.settings.side_effect = RuntimeError("Settings unavailable")
        self.assertEqual(main._get_club_member_zwift_ids(), set())
        self.assertEqual(main._club_member_role_id_cache, "")
        self.users.assert_not_called()
        self.members.assert_not_called()

    def test_club_role_ignores_surrounding_whitespace(self):
        self.membership["membership"]["clubMemberRoleId"] = " club "
        self.assertEqual(main._get_club_member_zwift_ids(), {"42", "44"})

    def test_member_lookup_errors_select_no_riders(self):
        for lookup in [self.users, self.members]:
            with self.subTest(lookup=lookup):
                main._club_member_zwift_ids_cache = None
                lookup.side_effect = RuntimeError("Lookup unavailable")
                self.assertEqual(main._get_club_member_zwift_ids(), set())
                lookup.side_effect = None

    def test_role_changes_are_seen_on_forced_refresh_and_cache_expiry(self):
        self.assertEqual(main._get_club_member_zwift_ids(), {"42", "44"})
        roles = self.members.return_value[0]["role_ids"]
        roles.remove("club")
        self.assertEqual(main._get_club_member_zwift_ids(), {"42", "44"})
        self.assertEqual(main._get_club_member_zwift_ids(force_refresh=True), {"44"})
        roles.append("club")
        self.clock.return_value += main.MEMBER_ZWIFT_IDS_CACHE_TTL_SECONDS
        self.assertEqual(main._get_club_member_zwift_ids(), {"42", "44"})
        self.assertEqual(self.members.call_count, 3)

    def test_upgrade_endpoint_only_passes_eligible_riders_to_the_commentator(self):
        response = self.post("/generate_and_post_upgrades")
        self.assertEqual(response.status_code, 200)
        generate = self.commentator.return_value.generate_upgrade_comment
        generate.assert_called_once()
        for field in UPGRADE_FIELDS:
            self.assertEqual([row["riderId"] for row in generate.call_args.args[0][field]], [42, 44])
        self.commentator.return_value.send_to_discord_api.assert_called_once()

    def test_both_endpoints_skip_generation_and_posting_when_no_one_is_eligible(self):
        self.members.return_value = [{"discordID": "verified", "role_ids": ["verified"]}]
        for endpoint, message in [
            ("/generate_and_post_upgrades", "No upgrades today."),
            ("/generate_and_post_commentary/11939", "No eligible results found."),
        ]:
            with self.subTest(endpoint=endpoint):
                response = self.post(endpoint)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.get_json()["message"], message)
        self.commentator.assert_not_called()
        self.analyze.assert_not_called()

    def test_weekly_commentary_only_includes_club_members(self):
        response = self.post("/generate_and_post_commentary/11939")
        self.assertEqual(response.status_code, 200)
        self.analyze.assert_called_once()
        self.assertEqual([row["zwid"] for row in self.analyze.call_args.args[0]["data"]], [42, 44])
        self.commentator.return_value.generate_commentary.assert_called_once()

    def test_weekly_commentary_skips_when_eligible_members_have_no_race_results(self):
        self.weekly_session.get.return_value.json.side_effect = lambda: {"data": [{"zwid": 43}]}
        response = self.post("/generate_and_post_commentary/11939")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["message"], "No eligible results found.")
        self.analyze.assert_not_called()
        self.commentator.assert_not_called()


if __name__ == "__main__":
    unittest.main()
