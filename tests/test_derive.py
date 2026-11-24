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
            pool = json.loads((d / "market" / "pool.json").read_text("utf-8"))["items"]
            assert len(pool) == 3 and len(pool[0][3]) == 13


def test_diag_market_compact_trends_and_actual_periods(tmp_path):
    d = tmp_path
    derive.save(d / "market" / "all_card_history_dates.json", {
        "basis": "full-list-snapshots",
        "dates": ["2026-10-20", "2026-11-16", "2026-11-22", "2026-11-23"],
        "counts": [2, 2, 2, 2],
    })
    derive.save(d / "market" / "all_card_history" / "1.json", {
        "100000001": {
            "1": [["2026-10-20", 100], ["2026-11-16", 110],
                  ["2026-11-22", 120], ["2026-11-23", 150]],
            "5": [["2026-11-22", 1000], ["2026-11-23", 1000]],
            "8": [["2026-11-23", 8000]],
        },
        # 최신 전체 스냅샷의 가격이 없으면 과거 가격을 현재가로 재사용하지 않아요.
        "100000201": {"1": [["2026-11-22", 999]]},
    })
    result = derive.step_diag_market(d, "2026-11-24")
    assert result == {"diag_market": "ok", "diag_market_cards": 1,
                      "diag_market_date": "2026-11-23"}
    manifest = json.loads((d / "diag" / "market.json").read_text("utf-8"))
    assert manifest["requestedDays"] == [1, 7, 30]
    assert manifest["grades"] == [1, 5, 8]
    assert manifest["historyFrom"] == "2026-10-20" and manifest["historyTo"] == "2026-11-23"
    cards = json.loads((d / "diag" / "market-1.json").read_text("utf-8"))["cards"]
    one, five, eight = cards["100000001"]
    assert one == [150, 25.0, 36.4, 50.0, 1, 7, 34]
    assert five == [1000, 0.0, None, None, 1, None, None]
    assert eight == [8000, None, None, None, None, None, None]
    assert "100000201" not in cards


def test_diag_market_waits_for_full_history_and_skips_same_date(tmp_path):
    assert derive.step_diag_market(tmp_path, "2026-11-24")["diag_market"] == "waiting-full-scan"
    derive.save(tmp_path / "market" / "all_card_history_dates.json", {
        "basis": "full-list-snapshots", "dates": ["2026-11-23"], "counts": [1]})
    derive.save(tmp_path / "market" / "all_card_history" / "1.json", {
        "100000001": {"1": [["2026-11-23", 100]]}})
    assert derive.step_diag_market(tmp_path, "2026-11-24")["diag_market"] == "ok"
    again = derive.step_diag_market(tmp_path, "2026-11-24")
    assert again["diag_market"] == "skip" and again["diag_market_cards"] == 1


def test_pcode_roundtrip():
    assert derive.pcode(124_000_000) == 6124 and derive.pdecode(6124) == 124_000_000
    assert derive.pcode(1290) == 1129 and derive.pdecode(1129) == 1290
    assert derive.pcode(1_234_567) == 4123 and derive.pdecode(4123) == 1_230_000
    assert derive.pcode(55) == 55 and derive.pcode(0) == 0 and derive.pcode(None) == 0


def test_reco_groups_traits_and_budget(tmp_path):
    d = tmp_path
    def card(spid, name, pos, p1, games=10):
        return {"spid": spid, "name": name, "pos": pos, "pay": 20, "games": games,
                "price": [p1 * (i + 1) for i in range(13)]}
    recs = [card(100000001, "센터백", [["CB", 110], ["CDM", 105]], 50_000_000),
            card(100000002, "풀백겸", [["RB", 104], ["CB", 101], ["LB", 106]], 9_000_000),
            card(100000003, "시세없음", [["CB", 120]], 0),
            card(100000004, "공격수", [["ST", 118], ["CF", 119]], 200_000_000)]
    put_list(d, recs)
    derive.save(d / "detail" / "1.json", {"100000001": {"height": 192, "weight": 88,
                "traits": [["타이탄", 60], ["강철몸", 5], ["블로커", 61]]}})
    derive.save(d / "traits.json", {"new": ["타이탄", "블로커"]})
    res = derive.step_reco(d)
    assert res["reco"] == "ok"
    cb = json.loads((d / "reco" / "CB.json").read_text("utf-8"))
    assert cb["fields"][:3] == ["spid", "name", "ovr"]
    rows = {x[0]: x for x in cb["items"]}
    assert set(rows) == {100000001, 100000002}            # 시세 0 카드는 제외
    r = rows[100000001]
    assert r[2] == 110 and r[4:7] == [192, 88, 2]          # 그룹 OVR · 키 · 몸무게 · 신규 특성 2개
    assert derive.pdecode(r[3][0]) == 50_000_000 and len(r[3]) == 13
    assert [cb["traits"][i][0] for i in r[7]] == ["타이탄", "강철몸", "블로커"] and cb["traits"][0][2] == 1
    assert rows[100000002][4] == 0 and rows[100000002][7] == []   # 상세 없는 카드는 키 0
    fb = json.loads((d / "reco" / "FB.json").read_text("utf-8"))
    assert fb["items"][0][2] == 106                         # RB 104·LB 106 중 큰 값
    st = json.loads((d / "reco" / "ST.json").read_text("utf-8"))
    assert st["items"][0][2] == 119 and st["traits"] == []
    # 크기 제한: 같은 가격대 카드가 많으면 구간마다 OVR 상위만 남김
    put_list(d, [card(200000000 + i, f"c{i}", [["CB", 60 + i % 50]], 1_000_000) for i in range(400)])
    derive.step_reco(d, max_bytes=8000)
    cb = json.loads((d / "reco" / "CB.json").read_text("utf-8"))
    assert len((d / "reco" / "CB.json").read_bytes()) <= 8000 and cb["perBucket"] >= 1
    ovrs = [x[2] for x in cb["items"] if x[0] >= 200000000]
    assert 0 < len(ovrs) < 400
    assert sorted(ovrs, reverse=True) == sorted((60 + i % 50 for i in range(400)), reverse=True)[:len(ovrs)]   # 낮은 OVR부터 빠짐
    assert 100000001 in {x[0] for x in cb["items"]}         # 다른 가격대 카드는 남음


def test_opponent_teamcolors_season_and_unknown(tmp_path):
    d = tmp_path
    derive.save(d / "teamcolor" / "teamcolors.json", {"items": [
        {"name": "Old", "type": "club", "clubId": 1},
        {"name": "New", "type": "club", "clubId": 2, "aliases": ["New FC"]},
        {"name": "Nation", "type": "nation", "nationId": 3},
    ]})
    derive.save(d / "meta" / "seasonid.json", [
        {"seasonId": 100, "className": "25 UCL"},
        {"seasonId": 101, "className": "ICON"},
    ])
    detail = {"nationId": 3, "clubs": [["2010 ~ 2015", "Old"], ["2024 ~", "New FC"]]}
    for card, row in [(100000001, detail), (101000002, detail),
                      (101000003, dict(detail, teamId=1))]:
        derive.save(d / "detail" / f"{card % 200}.json", {str(card): row})
    result = derive.step_opponent_teamcolors(d, "2026-11-24")
    assert result["opponent_teamcolor_cards"] == 3
    out = json.loads((d / "diag" / "opponent-teamcolors.json").read_text("utf-8"))
    names = lambda card: {out["names"][i] for i in out["cards"][str(card)]}
    assert names(100000001) == {"New", "Nation"}
    assert names(101000002) == {"Nation"}
    assert names(101000003) == {"Old", "Nation"}


def test_opponent_teamcolors_missing_metadata(tmp_path):
    assert derive.step_opponent_teamcolors(tmp_path, "2026-11-24")["opponent_teamcolors"] == "waiting-teamcolors"
