import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location("site_build", Path(__file__).resolve().parents[1] / "site" / "build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def put(root, name, obj):
    p = root / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj), encoding="utf-8")


def test_market_periods_exact_dates_and_missing_history(tmp_path):
    dates = ["2026-11-17", "2026-11-21", "2026-11-23", "2026-11-24"]
    put(tmp_path, "market/all_card_history_dates.json", {"basis": "full-list-snapshots", "dates": dates})
    put(tmp_path, "list/1.json", {"100000001": {"name": "A", "games": 100, "price": [20000000]}})
    put(tmp_path, "market/all_card_history/1.json", {"100000001": {"1": list(zip(dates, [10000000, 12500000, 16000000, 20000000]))}})
    market = {"date": dates[-1], "grades": [1], "indexMinimum": 1, "byGrade": {"1": {"popular": [{"id": 100000001, "v": 20000000, "c": 999}]}}}
    views = build.market_period_views(tmp_path, market)["periods"]
    for day, pct in [("1", 25), ("3", 60), ("7", 100)]:
        v = views[day]
        assert v["ready"] and v["index"]["median"] == pct
        assert v["byGrade"]["1"]["risers"][0]["c"] == pct
        assert v["risers"][0]["g"] == 1
        assert v["byGrade"]["1"]["popular"][0]["c"] == pct
        assert v["popular"][0]["id"] == 100000001
    put(tmp_path, "market/all_card_history_dates.json", {"basis": "full-list-snapshots", "dates": dates[-2:]})
    views = build.market_period_views(tmp_path, market)["periods"]
    assert views["1"]["ready"]
    assert not views["3"]["ready"] and not views["7"]["ready"]
    assert views["3"]["index"] is None and "c" not in views["3"]["byGrade"]["1"]["popular"][0]


def test_market_periods_merge_all_grades_but_cap_same_card_at_two(tmp_path):
    dates = ["2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]
    put(tmp_path, "market/all_card_history_dates.json", {"basis": "full-list-snapshots", "dates": dates})
    prices = [20000000, 30000000, 40000000]
    put(tmp_path, "list/1.json", {"100000001": {"name": "A", "games": 100, "price": prices}})
    put(tmp_path, "market/all_card_history/1.json", {"100000001": {
        "1": list(zip(dates, [10000000, 11000000, 12000000, 14000000])),
        "2": list(zip(dates, [20000000, 22000000, 24000000, 29000000])),
        "3": list(zip(dates, [30000000, 33000000, 36000000, 45000000])),
    }})
    market = {"date": dates[-1], "grades": [1, 2, 3], "indexMinimum": 1,
              "byGrade": {"1": {"popular": []}, "2": {"popular": []}, "3": {"popular": []}}}
    rows = build.market_period_views(tmp_path, market)["periods"]["1"]["risers"]
    assert len([row for row in rows if row["id"] == 100000001]) == 2
    assert all(1 <= row["g"] <= 13 for row in rows)


def test_market_payload_keeps_full_candidates_and_real_history(tmp_path):
    dates = ["2026-11-24", "2026-11-25"]
    put(tmp_path, "market/all_card_history_dates.json", {
        "basis": "full-list-snapshots", "dates": dates, "counts": [2, 2]})
    put(tmp_path, "list/1.json", {
        "100000001": {"name": "A", "games": 0, "price": [200]},
        "101000001": {"name": "B", "games": 0, "price": [100]},
    })
    put(tmp_path, "market/all_card_history/1.json", {
        "100000001": {"1": list(zip(dates, [100, 200]))},
        "101000001": {"1": list(zip(dates, [200, 100]))},
    })
    market = {"date": dates[-1], "indexMinimum": 1,
              "byGrade": {"1": {"popular": []}}}
    result = build.market_period_views(tmp_path, market)
    period = result["periods"]["1"]
    payload = result["_rankPayloads"]["1"]
    assert period["ready"] and period["fallback"] and period["defaultSort"] == "pct"
    assert payload["totalCards"] == 2 and len(payload["items"]) == 2
    assert payload["items"][0]["h"] == [["2026-11-24", 100], ["2026-11-25", 200]]
    assert payload["items"][0]["impact"] is None
