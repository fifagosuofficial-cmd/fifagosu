"""crawler/rating.py 테스트 — 네트워크 없이 모의 응답으로 확인해요."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "crawler"))
import rating  # noqa: E402


def side(ouid, div, ratings, end=0):
    """ratings: [(spPosition, spRating)]"""
    return {"ouid": ouid, "division": div, "matchDetail": {"matchEndType": end},
            "player": [{"spPosition": p, "status": {"spRating": r}} for p, r in ratings]}


def api_of(get, max_details=400):
    return rating.Api("mock", get=get, delay=0, max_details=max_details, sleep=lambda s: None)


def test_add_match_filters_subs_zero_and_low_division():
    agg = rating.Agg()
    d = {"matchId": "m1", "matchInfo": [
        side("a", 900, [(5, 7.0), (28, 6.0), (25, 0)]),      # CB 7.0 만 집계 (교체·미출전 제외)
        side("b", 2000, [(5, 9.9)])]}                         # 월드클래스 쪽은 집계 안 함
    nxt, used = rating.add_match(agg, d)
    assert used and sorted(nxt) == [(900, "a"), (2000, "b")]
    assert agg.s[900][("g", "CB")] == [7.0, 1] and agg.s[900][("p", 5)] == [7.0, 1]
    assert ("g", "ST") not in agg.s[900]


def test_add_match_skips_forfeit():
    agg = rating.Agg()
    d = {"matchId": "m1", "matchInfo": [side("a", 800, [(5, 7.0)], end=1), side("b", 800, [(5, 7.0)], end=2)]}
    nxt, used = rating.add_match(agg, d)
    assert not used and len(nxt) == 2 and agg.s[900] == {}


def test_basis_widens_when_few_samples():
    agg = rating.Agg()
    for _ in range(10):
        agg.add(900, 5, 7.0)          # 챔피언스 CB 10개
    for _ in range(25):
        agg.add(1000, 5, 6.0)         # 슈퍼 챌린지 CB 25개 → 합 35개
    for _ in range(40):
        agg.add(800, 0, 6.5)          # GK 40개
    r = agg.result()
    assert r["groups"]["GK"] == {"avg": 6.5, "n": 40, "basis": "≤900"}
    assert r["groups"]["CB"]["basis"] == "≤1000" and r["groups"]["CB"]["n"] == 35
    assert r["groups"]["CB"]["avg"] == round((70 + 150) / 35, 2)
    assert "ST" not in r["groups"] and "0" in r["pos"]


def test_collect_climbs_to_higher_division_and_dedups():
    # 시드(3000) → 상대 x(2000)·y(900) 중 y(챔피언스)를 먼저 방문해야 해요
    order = []
    m = {
        "m1": {"matchId": "m1", "matchInfo": [side("seed", 3000, [(5, 5.0)]), side("x", 2000, [(5, 6.0)])]},
        "m2": {"matchId": "m2", "matchInfo": [side("seed", 3000, [(5, 5.0)]), side("y", 900, [(5, 7.0)])]},
        "m3": {"matchId": "m3", "matchInfo": [side("y", 900, [(5, 7.4)]), side("z", 800, [(5, 7.2)])]},
    }
    lists = {"seed": ["m1", "m2"], "y": ["m2", "m3"], "x": ["m1"], "z": ["m3"]}

    def get(path):
        if path.startswith("/fconline/v1/id"):
            return 200, {"ouid": "seed"}
        if path.startswith("/fconline/v1/user/match"):
            o = path.split("ouid=")[1].split("&")[0]
            order.append(o)
            return 200, lists[o]
        if path.startswith("/matches"):
            return 200, [m[i] for i in path.split("ids=")[1].split(",")]
        return 404, None

    agg, st = rating.collect(api_of(get), "52", ["seed"], cap=50)
    assert order[:2] == ["seed", "y"]           # 높은 등급 쪽으로 타고 올라감
    assert order.index("z") < order.index("x")  # 슈퍼챔피언스(800)가 월드클래스(2000)보다 먼저
    assert st["matches"] == 3                   # m2 는 두 번 받지 않음
    t = agg.s[900][("g", "CB")]
    assert t[1] == 3 and abs(t[0] - (7.0 + 7.4 + 7.2)) < 1e-9


def test_detail_budget_is_respected():
    calls = {"n": 0}

    def get(path):
        if path.startswith("/fconline/v1/id"):
            return 200, {"ouid": "s"}
        if path.startswith("/fconline/v1/user/match"):
            o = path.split("ouid=")[1].split("&")[0]
            return 200, [f"{o}-{i}" for i in range(10)]
        if path.startswith("/matches"):
            ids = path.split("ids=")[1].split(",")
            calls["n"] += len(ids)
            return 200, [{"matchId": i, "matchInfo": [side("s", 900, [(5, 7)]), side(i + "o", 800, [(5, 7)])]} for i in ids]
        return 404, None

    api = api_of(get, max_details=25)
    rating.collect(api, "50", ["s"], cap=25)
    assert calls["n"] <= 25 and api.details <= 25


def test_run_keeps_previous_when_sample_too_small(tmp_path):
    prev = {"updated": "old", "52": {"groups": {"CB": {"avg": 7.0, "n": 100, "basis": "≤900"}}}}
    (tmp_path / "rating.json").write_text(json.dumps(prev), "utf-8")

    def get(path):                                # 시드 닉네임부터 실패
        return 404, None

    out = rating.run(api_of(get), ["nobody"], tmp_path)
    assert out == prev
    assert json.loads((tmp_path / "rating.json").read_text("utf-8")) == prev


def test_run_with_mock_relay_writes_file(tmp_path):
    api = api_of(rating.mock_get(), max_details=200)
    out = rating.run(api, ["Lampard8"], tmp_path)
    saved = json.loads((tmp_path / "rating.json").read_text("utf-8"))
    assert saved["52"]["groups"]["CB"]["basis"] == "≤900"
    assert 6.5 < saved["52"]["groups"]["CB"]["avg"] < 7.6
    assert saved["src"]["matches"] > 0 and out["50"]["n"] >= rating.MIN_MATCHES
    assert api.details <= 200
