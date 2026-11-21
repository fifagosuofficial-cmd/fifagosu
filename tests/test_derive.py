"""crawler/derive.py 테스트 — 네트워크 없이 고정 샘플로 확인해요."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "crawler"))
import derive  # noqa: E402


def put_list(data, recs):
    shards = {}
    for r in recs:
        shards.setdefault(r["spid"] % 200, {})[str(r["spid"])] = r
    for n, d in shards.items():
        p = data / "list" / f"{n}.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        old = json.loads(p.read_text()) if p.exists() else {}
        old.update(d)
        p.write_text(json.dumps(old))


def rec(spid, date, base=1_000_000, p11=None, p13=None):
    price = [base * (g + 1) for g in range(13)]
    price[10], price[12] = p11, p13
    return {"spid": spid, "price": price, "at": f"{date}T03:30:00+09:00"}


def hist(data, spid):
    return json.loads((data / "hist" / f"{spid % 200}.json").read_text()).get(str(spid))


def meta(ids):
    return {"spid": [{"id": i, "name": f"p{i}"} for i in ids], "seasonid": [{"seasonId": 100}]}


def test_sig3():
    assert derive.sig3(1234567) == 1230000
    assert derive.sig3(999) == 999
    assert derive.sig3(None) is None and derive.sig3(0) == 0


def test_meta_baseline_and_new(tmp_path):
    r = derive.step_meta(tmp_path, "2026-11-21", meta([1, 2, 3]))
    assert r["baseline"] == "created" and r["new_cards"] == 0
    r = derive.step_meta(tmp_path, "2026-11-22", meta([1, 2, 3, 4]))
    assert r["new_cards"] == 1
    assert json.loads((tmp_path / "meta" / "new_today.json").read_text())["ids"] == [4]
    assert derive.step_meta(tmp_path, "2026-11-23", None)["meta"] == "skip"


def test_new_card_cap(tmp_path):
    derive.step_meta(tmp_path, "2026-11-21", meta([1]))
    r = derive.step_meta(tmp_path, "2026-11-22", meta(range(1, 5000)))
    assert r["baseline"] == "held"
    assert json.loads((tmp_path / "meta" / "spid_ids.json").read_text())["ids"] == [1]


def test_history_days_and_nulls(tmp_path):
    put_list(tmp_path, [rec(101, "2026-11-21"), rec(202, "2026-11-21", p11=5_555_555)])
    derive.step_history(tmp_path, "2026-11-21")
    h = hist(tmp_path, 101)
    assert h[0] == [1_000_000] and h[1] == [5_000_000] and h[2] == [8_000_000]
    assert h[3] is None and h[4] is None                 # 11·13강이 비면 줄 생략
    assert hist(tmp_path, 202)[3] == [5_560_000]           # 유효숫자 3자리
    # 다음 날: 101만 갱신, 202는 갱신 안 됨 → null
    put_list(tmp_path, [rec(101, "2026-11-22", base=2_000_000), rec(303, "2026-11-22")])
    derive.step_history(tmp_path, "2026-11-22")
    assert hist(tmp_path, 101)[0] == [1_000_000, 2_000_000]
    assert hist(tmp_path, 202)[0] == [1_000_000, None]
    assert hist(tmp_path, 303)[0] == [None, 1_000_000]
    d = json.loads((tmp_path / "hist" / "dates.json").read_text())
    assert d["dates"] == ["2026-11-21", "2026-11-22"] and d["grades"] == [1, 5, 8, 11, 13]


def test_same_day_rerun_overwrites(tmp_path):
    put_list(tmp_path, [rec(101, "2026-11-21")])
    derive.step_history(tmp_path, "2026-11-21")
    put_list(tmp_path, [rec(101, "2026-11-21", base=3_000_000)])
    derive.step_history(tmp_path, "2026-11-21")
    assert hist(tmp_path, 101)[0] == [3_000_000]


def test_drop_guard(tmp_path):
    put_list(tmp_path, [rec(i, "2026-11-21") for i in range(1, 11)])
    derive.step_history(tmp_path, "2026-11-21")
    put_list(tmp_path, [rec(1, "2026-11-22"), rec(2, "2026-11-22")])     # 10장 → 2장
    assert derive.step_history(tmp_path, "2026-11-22")["hist"] == "held"
    assert json.loads((tmp_path / "hist" / "dates.json").read_text())["dates"] == ["2026-11-21"]


def test_keep_90_days(tmp_path, monkeypatch):
    monkeypatch.setattr(derive, "KEEP_DAYS", 3)
    for day in range(21, 26):
        put_list(tmp_path, [rec(101, f"2026-11-{day}", base=day * 1000)])
        derive.step_history(tmp_path, f"2026-11-{day}")
    assert hist(tmp_path, 101)[0] == [23000, 24000, 25000]
    assert json.loads((tmp_path / "hist" / "dates.json").read_text())["dates"] == ["2026-11-23", "2026-11-24", "2026-11-25"]


def test_rules_copy(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "grade_bonus.json").write_text('{"bonus":[0]}')
    assert derive.step_rules(tmp_path / "data", src)["rules"] == 1
    assert (tmp_path / "data" / "rules" / "grade_bonus.json").exists()


def test_run_no_meta(tmp_path):
    put_list(tmp_path, [rec(101, "2026-11-21")])
    s = derive.run(tmp_path, "2026-11-21", no_meta=True)
    assert s["hist"] == "ok" and s["meta"] == "skip" and (tmp_path / "run.json").exists()


def test_market_summary_movers_popular_and_new(tmp_path):
        if True:
            d = tmp_path
            (d / "hist").mkdir(); (d / "list").mkdir(); (d / "meta").mkdir()
            derive.save(d / "hist" / "dates.json", {"dates": ["2026-11-21", "2026-11-22"], "counts": [3, 3], "grades": derive.GRADES})
            def lst(k, name, games, p1):
                return {"spid": k, "name": name, "ovr": 120, "pos": [["ST", 120]], "games": games,
                        "price": [p1 * (i + 1) for i in range(13)]}
            listed = {"100000001": lst(100000001, "올라", 300, 120_000_000),
                      "100000002": lst(100000002, "내려", 200, 80_000_000),
                      "100000003": lst(100000003, "싸구려", 500, 1_000_000)}
            hist = {"100000001": [[100_000_000, 120_000_000], None, None, None, None],
                    "100000002": [[100_000_000, 80_000_000], None, None, None, None],
                    "100000003": [[900_000, 1_000_000], None, None, None, None]}
            for k, v in listed.items():
                derive.save(d / "list" / f"{int(k) % 200}.json", {k: v})
                derive.save(d / "hist" / f"{int(k) % 200}.json", {k: hist[k]})
            derive.save(d / "meta" / "new_today.json", {"date": "2026-11-22", "ids": [300000009]})
            derive.save(d / "meta" / "spid.json", [{"id": 300000009, "name": "신입"}])
            res = derive.step_market(d, "2026-11-22")
            assert res["market"] == "ok"
            out = json.loads((d / "market" / "summary.json").read_text("utf-8"))
            g1 = out["byGrade"]["1"]
            assert [x["n"] for x in g1["risers"]] == ["올라"]
            assert g1["risers"][0]["c"] == 20.0
            assert [x["n"] for x in g1["fallers"]] == ["내려"]
            assert g1["popular"][0]["n"] == "싸구려"          # 인기 순위는 가격 필터 없이 사용량 기준
            assert out["newCards"][0]["n"] == "신입"
            assert out["index"]["up"] == 1
