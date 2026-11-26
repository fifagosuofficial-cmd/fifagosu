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
        assert v["ready"] and v["index"]["breadth"] == 100
        assert v["index"]["display"] == "+100.0"
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

def test_market_breadth_counts_exact_directions_instead_of_median():
    # An overwhelming number of flat cards must not pin a directional index to zero.
    assert build.market_breadth(60, 40, 10000)["breadth"] == 20
    assert build.market_breadth(40, 60, 10000)["breadth"] == -20
    assert build.market_breadth(50, 50, 10000)["breadth"] == 0
    assert build.market_breadth(0, 0, 10000)["display"] == "0.0"
    assert build.market_breadth(50001, 50000, 100001)["display"] == "+<0.1"
    assert build.market_breadth(50000, 50001, 100001)["display"] == "-<0.1"
    assert build.market_breadth(1, 0, 1) is None


def test_market_breadth_uses_the_same_all_grade_counts_as_home(tmp_path):
    dates = ["2026-11-25", "2026-11-26"]
    put(tmp_path, "market/all_card_history_dates.json", {"basis": "full-list-snapshots", "dates": dates})
    rows = {
        "100000001": {"1": [100, 101], "2": [1000, 999], "5": [1000, 1100]},
        "100000002": {"1": [100000, 100000], "8": [200, 201], "13": [100, 100]},
        "100000003": {"1": [10000, 10001], "8": [200, 199]},
    }
    put(tmp_path, "list/1.json", {key: {"name": key} for key in rows})
    put(tmp_path, "market/all_card_history/1.json", {
        key: {grade: list(zip(dates, prices)) for grade, prices in grades.items()} for key, grades in rows.items()})
    market = {"date": dates[-1], "indexMinimum": 1, "byGrade": {"1": {"popular": []}}}
    out = build.market_period_views(tmp_path, market)
    period = out["periods"]["1"]
    ix = period["index"]
    assert (period["up"], period["down"]) == (4, 2)
    assert (ix["up"], ix["down"], ix["flat"], ix["compared"]) == (4, 2, 2, 8)
    assert ix["display"] == "+33.3"
    assert out["_rankPayloads"]["1"]["index"] == ix
    assert out["periods"]["3"]["index"] is None

def test_fg_index_chain_persists_and_never_duplicates_or_invents_dates(tmp_path):
    from fg_index import build_index, persist
    dates = ["2026-11-24", "2026-11-25", "2026-11-26"]
    cards = {str(i): {"name": str(i)} for i in range(1, 41)}
    prices = {k: {"1": list(zip(dates, [100, 110, 90] if int(k)<=30 else [100, 90, 110]))} for k in cards}
    put(tmp_path,"market/all_card_history_dates.json",{"basis":"full-list-snapshots","dates":dates})
    put(tmp_path,"list/0.json",cards)
    put(tmp_path,"market/all_card_history/0.json",prices)
    result = build_index(tmp_path)
    assert [p["date"] for p in result["points"]] == dates
    assert [p["value"] for p in result["points"]] == [1000, 1050, 997.5]
    assert result["points"][-1]["up"] == 10 and result["points"][-1]["down"] == 30
    persist(tmp_path)
    assert build_index(tmp_path) == result
    # The previous price window rolls away, but the historical index archive stays.
    next_dates = ["2026-11-26", "2026-11-28"]
    put(tmp_path,"market/all_card_history_dates.json",{"basis":"full-list-snapshots","dates":next_dates})
    put(tmp_path,"market/all_card_history/0.json",{k:{"1":list(zip(next_dates,[100,110]))} for k in cards})
    appended = build_index(tmp_path)
    assert appended["points"][:3] == result["points"]
    assert appended["points"][-1]["date"] == "2026-11-28"
    assert appended["points"][-1]["from"] == "2026-11-26"
    assert appended["points"][-1]["value"] == 1097.25
    assert "2026-11-27" not in [p["date"] for p in appended["points"]]


def test_fg_index_market_sample_matches_daily_home_counts(tmp_path):
    from fg_index import build_index
    dates = ["2026-11-25", "2026-11-26"]
    listed = {"1":{"name":"A"},"2":{"name":"B"}}
    hist = {"1":{"1":list(zip(dates,[100,110])),"5":list(zip(dates,[200,190]))},"2":{"8":list(zip(dates,[100,120]))}}
    result = build_index(tmp_path,hist,dates,listed,{"2":"2026-11-25"},1)
    assert result["points"][-1]["value"] == 1000
    assert result["points"][-1]["sample"] == 2
