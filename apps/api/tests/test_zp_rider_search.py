"""Run from apps/api: python -m unittest discover -s tests -v."""

import unittest
from unittest.mock import Mock

from zwiftpower import ZwiftPower, rider_search_rows


def row(zwid, name, events=0, div=0, divw=0, flag="dk", tname=""):
    return {"zwid": zwid, "name": name, "events": events, "div": div, "divw": divw, "flag": flag, "tname": tname,
            "ftp": "300", "w": "80.0", "age": "40-49"}


class RiderSearchRowsTest(unittest.TestCase):
    def test_public_fields_only_and_names_unescaped(self):
        [rider] = rider_search_rows([row(124587, "Andreas Kj&aelig;r", div=20, tname="DZR")], "kjær")
        self.assertEqual(rider, {"zwiftId": 124587, "name": "Andreas Kjær", "country": "DK", "category": "B", "team": "DZR"})

    def test_exact_then_prefix_then_most_active(self):
        rows = [
            row(1, "Hans Christian Kjaer", events=50),
            row(2, "Christian Kjaerbo", events=5),
            row(3, "Christian Kjaer", events=1),
            row(4, "Christian Kjaerulf", events=90),
        ]
        self.assertEqual([r["zwiftId"] for r in rider_search_rows(rows, "christian  kjaer")], [3, 4, 2, 1])

    def test_women_category_and_missing_values(self):
        [rider] = rider_search_rows([row(9, "Anna", divw=40, flag="")], "anna")
        self.assertEqual(rider["category"], "D")
        self.assertIsNone(rider["country"])
        self.assertIsNone(rider["team"])

    def test_limit_and_rows_without_id(self):
        rows = [row(i, f"Rider {i}") for i in range(1, 30)] + [row(None, "No id")]
        self.assertEqual(len(rider_search_rows(rows, "rider", limit=10)), 10)


class SearchRidersTest(unittest.TestCase):
    def test_short_queries_do_not_call_zwiftpower(self):
        zp = ZwiftPower("u", "p")
        zp.session = Mock()
        self.assertEqual(zp.search_riders(" abc "), [])
        zp.session.get.assert_not_called()

    def test_calls_rider_list_search(self):
        zp = ZwiftPower("u", "p")
        zp.session = Mock()
        zp.session.get.return_value.json.return_value = {"data": [row(5, "Christian Kjaer")]}
        self.assertEqual(zp.search_riders("Christian Kj")[0]["zwiftId"], 5)
        args, kwargs = zp.session.get.call_args
        self.assertEqual(kwargs["params"], {"do": "rider_list", "search": "Christian Kj"})


if __name__ == "__main__":
    unittest.main()
