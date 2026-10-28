"""Run from apps/api: python -m unittest discover -s tests -v."""

import unittest

from zwiftpower import event_search_rows

ZRL = "Zwift Racing League 26/27: Fast &amp; Fresh : Open Cherry League Division 1 - Race 5"


def row(zid, name, tm, km=0, laps=0):
    return {"zid": str(zid), "t": name, "tm": tm, "km": km, "laps": str(laps), "f_list": [], "signups": "99"}


class EventSearchRowsTest(unittest.TestCase):
    def test_every_word_must_match_and_names_are_unescaped(self):
        rows = [row(1, ZRL, 1793080800, laps=2), row(2, "ROAD TO ZWIFT RACING LEAGUE", 1793059260), row(3, "Tour of Watopia", 1793080800)]
        events = event_search_rows(rows, "zwift racing league race 5")
        self.assertEqual(events, [{"zwiftEventId": 1, "name": ZRL.replace("&amp;", "&"), "startUtc": "2026-10-27T06:00:00Z", "distanceKm": None, "laps": 2}])

    def test_time_window_order_and_duplicates(self):
        rows = [row(5, "Crit", 300, km=23685), row(4, "Crit", 200), row(4, "Crit", 200), row(6, "Crit", 900)]
        events = event_search_rows(rows, "crit", start_after=100, start_before=400)
        self.assertEqual([e["zwiftEventId"] for e in events], [4, 5])
        self.assertEqual(events[1]["distanceKm"], 23.7)


if __name__ == "__main__":
    unittest.main()
