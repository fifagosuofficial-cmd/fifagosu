import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "crawler"))
import fgcrawl  # noqa: E402

FX = HERE / "fixtures"


def test_parse_list_rows():
    rows = fgcrawl.parse_list((FX / "list_rows.html").read_text("utf-8"))
    assert [r["spid"] for r in rows] == [100190042, 886005471]
    m = rows[0]
    assert m["name"] == "마라도나" and m["season"] == "ICONTM"
    assert m["ovr"] == 127 and m["pay"] == 33
    assert m["pos"] == [["CAM", 127], ["CF", 127]]
    assert m["foot"] == {"l": 5, "r": 3, "main": "L"}
    assert m["price"][0] == 85_800_000 and m["price"][12] == 149_000_000_000 and len(m["price"]) == 13
    assert m["score"] == 6.5 and m["games"] == 114
    l = rows[1]
    assert l["foot"]["main"] == "R" and l["price"][0] == 29_600 and l["price"][1] is None
    assert l["score"] is None and l["games"] == 0


def test_parse_list_empty():
    assert fgcrawl.parse_list((FX / "empty.html").read_text("utf-8")) == []


def test_parse_preview():
    d = fgcrawl.parse_preview((FX / "preview.html").read_text("utf-8"), 886005471)
    assert d["name"] == "프랭크 램파드" and d["ovr"] == 114 and d["pay"] == 29
    assert d["pos"] == [["CM", 114], ["CAM", 114]]
    assert d["birth"] == "1978.06.20" and d["height"] == 184 and d["weight"] == 89 and d["body"] == "보통"
    assert d["skill"] == 4 and d["foot"] == {"l": 4, "r": 5, "main": "R"} and d["rep"] == "월드클래스"
    assert d["nation"] == "잉글랜드" and d["nationId"] == 14 and d["teamId"] == 130823 and d["leagueId"] == 2028
    assert d["traits"] == [["커맨더", 59], ["중거리 슛 선호", 16], ["패스 마스터", 27], ["긴 패스 선호", 15], ["플레이 메이커", 18]]
    assert d["summary"] == [["스피드", 108], ["슛", 116], ["패스", 115], ["드리블", 112], ["수비", 96], ["피지컬", 109]]
    assert len(d["stats"]) == 34 and all(v is not None for v in d["stats"].values())
    assert d["stats"]["sprintspeed"] == 108 and d["stats"]["dribbling"] == 111 and d["stats"]["gkpositioning"] == 16
    assert d["clubs"][1] == ["2014 ~ 2015", "맨체스터 시티", 1]
    assert d["adaptation"] == 1          # 데이터센터 기본(n1Grow=0) = 적응도 1단계
    assert fgcrawl.parse_preview((FX / "preview.html").read_text("utf-8"), 886005471, 2)["adaptation"] == 2


class FakeClient:
    """OVR 범위로만 걸러 주는 가짜 데이터센터: 450장(같은 OVR 210장 포함)"""
    def __init__(self):
        self.cards = [(i, 60 + (i % 50)) for i in range(240)] + [(1000 + i, 100) for i in range(210)]
        self.count = 0
        self.bytes = 0

    def post(self, path, form):
        self.count += 1
        lo, hi = int(form["n4OvrMin"]), int(form["n4OvrMax"])
        plo, phi = int(form["n4SalaryMin"]), int(form["n4SalaryMax"])
        blo, bhi = int(form["n4BirthYearMin"]), int(form["n4BirthYearMax"])
        hit = [(s, o) for s, o in self.cards
               if lo <= o <= hi and plo <= (s % 96) + 4 <= phi and blo <= 1950 + (s % 60) <= bhi][:200]
        return "".join(
            f'<div class="tr"><a data-no="{878000000 + s}" class="btn_preview"></a><div class="name">p{s}</div>'
            f'<div class="td td_ar"><span class="pay">{(s % 96) + 4}</span></div>'
            f'<div class="td td_ar "><span><span class="skillData_x"> {o} </span></span></div>'
            f'<div class="td td_ar_bp"><span class="span_bp1" alt="1,000">1</span></div></div>' for s, o in hit)


def test_list_season_partitions_past_cap():
    fc = FakeClient()
    got, complete, trunc = fgcrawl.list_season(fc, 878, time.time() + 60)
    assert complete and trunc == 0
    assert len(got) == 450


def test_store_and_index(tmp_path, monkeypatch):
    monkeypatch.setattr(fgcrawl, "DATA", tmp_path)
    st = fgcrawl.Store(tmp_path)
    for r in fgcrawl.parse_list((FX / "list_rows.html").read_text("utf-8")):
        st.put("list", r)
    st.put("detail", fgcrawl.parse_preview((FX / "preview.html").read_text("utf-8"), 886005471))
    st.save()
    st2 = fgcrawl.Store(tmp_path)
    assert st2.has("list", 100190042) and st2.has("detail", 886005471) and not st2.has("detail", 100190042)
    fgcrawl.cmd_index(st2)
    idx = json.loads((tmp_path / "index.json").read_text("utf-8"))
    assert idx["c"]["100190042"] == [127, "CAM", 33, 85_800_000, 114, 0]
    assert idx["c"]["886005471"][-1] == 1


def test_fetch_traits_parses_new_group():
    class R:  # 데이터센터 검색 화면 일부
        encoding = None
        text = "".join(f"<a onclick=\"DataCenter.SetAbilitySearch('{n}', 'strTrait1'); fn_CheckSearchCount();\">{n}</a>"
                       for n in ["", "크로스 포쳐", "트릭스터", "체이서", "예리한 감아차기", "승부욕"])
    class S:
        def get(self, *a, **k): return R()
    class C: s = S()
    tr = fgcrawl.fetch_traits(C())
    assert tr["new"] == ["크로스 포쳐", "트릭스터", "체이서"] and tr["all"][-1] == "승부욕"


def test_adaptation_rule_matches_datacenter():
    """2026-11-21 실측: 수집 기준 적응도 1, 단계마다 +1"""
    import json
    rule = json.loads((Path(__file__).resolve().parent.parent / "crawler" / "rules" / "adaptation_bonus.json").read_text("utf-8"))
    assert rule["baseLevel"] == 1 and rule["bonusFromBase"] == [None, 0, 1, 2, 3, 4] and rule["verified"] is True
