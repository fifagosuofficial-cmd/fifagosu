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
    put(tmp_path, "list/1.json", {"100000001": {"name": "A", "price": [200000]}})
    put(tmp_path, "market/all_card_history/1.json", {"100000001": {"1": list(zip(dates, [100000, 125000, 160000, 200000]))}})
    market = {"date": dates[-1], "grades": [1], "indexMinimum": 1, "byGrade": {"1": {"popular": [{"id": 100000001, "v": 200000, "c": 999}]}}}
    views = build.market_period_views(tmp_path, market)["periods"]
    for day, pct in [("1", 25), ("3", 60), ("7", 100)]:
        v = views[day]
        assert v["ready"] and v["index"]["median"] == pct
        assert v["byGrade"]["1"]["risers"][0]["c"] == pct
        assert v["byGrade"]["1"]["popular"][0]["c"] == pct
    put(tmp_path, "market/all_card_history_dates.json", {"basis": "full-list-snapshots", "dates": dates[-2:]})
    views = build.market_period_views(tmp_path, market)["periods"]
    assert views["1"]["ready"]
    assert not views["3"]["ready"] and not views["7"]["ready"]
    assert views["3"]["index"] is None and "c" not in views["3"]["byGrade"]["1"]["popular"][0]
