"""crawler/news.py 테스트 — 실제 넥슨·RSS 응답 형식을 줄인 고정 샘플로 확인해요."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "crawler"))
import news  # noqa: E402

FX = Path(__file__).resolve().parent / "fixtures"
read = lambda n: (FX / n).read_text("utf-8")


def test_notice_list_skips_pinned():
    rows = news.parse_notice_list(read("news_list.html"))
    assert [r["sn"] for r in rows] == [6383, 6373]
    assert rows[1]["sort"] == "점검" and news.nx_cat(rows[1]["sort"], rows[1]["title"]) == "check"


def test_notice_view_summary():
    v = news.parse_notice_view(read("news_view.html"))
    assert v["date"] == "2026-11-14"
    s = v["summary"]
    assert 5 <= len(s) <= 10
    assert not any(t.startswith("안녕하세요") or t == "감사합니다." for t in s)
    assert not any("초과 BP 이득" in t for t in s)          # 취소선 내용 제외
    assert not any("────" in t for t in s)
    assert any(t.startswith("1. 11/14") for t in s)
    assert all(len(t) <= 90 for t in s)


def test_update_and_events():
    u = news.parse_update_list(read("news_update.html"))
    assert u[0] == {"title": "2026 ROSTER UPDATE", "url": "https://events.fconline.nexon.com/261029/s/Update", "date": "2026-10-29"}
    ev = news.parse_event_list(read("news_events.html"))
    assert [e["title"] for e in ev] == ["MAKE YOUR 신특 설문조사", "이번 주는 버닝 위크!"]      # 종료된 이벤트 제외
    assert ev[1]["end"] == "2026-11-25" and "utm_" not in ev[1]["url"]


def test_rss_football_split_and_trim():
    items = news.parse_rss(read("news_rss.xml"), "인터풋볼", "football")
    assert len(items) == 2                                   # [포토] 제외
    assert items[0]["cat"] == "world"                        # 해외 리그 기사 ('국가대표'만으로는 국내 아님)
    assert items[1]["cat"] == "korea" and items[1]["date"] == "2026-11-21T05:00:00+09:00"
    assert items[0]["summary"] == []
    assert items[0]["date"] == "2026-11-21T15:00:00+09:00" and items[0]["kind"] == "press"


def test_rss_keyword_filter():
    items = news.parse_rss(read("news_rss_game.xml"), "경향게임스", "fcgame", news.FEEDS[2][3])
    assert [i["title"] for i in items] == ["넥슨 'FC 온라인', 신규 클래스 26UP 출시"]


class FakeHttp:
    count = 0
    def get(self, url):
        self.count += 1
        if "notice/list" in url: return read("news_list.html")
        if "notice/view" in url: return read("news_view.html")
        if "update/list" in url: return read("news_update.html")
        if "events/list" in url: return read("news_events.html")
        if "khgames" in url or "gametoc" in url: return read("news_rss_game.xml")
        if "footballist" in url: raise OSError("down")
        return read("news_rss.xml")


def test_run_merge_and_incremental(tmp_path):
    r = news.run(tmp_path, FakeHttp())
    feed = json.loads((tmp_path / "news" / "feed.json").read_text(encoding="utf-8"))
    cats = {x["cat"] for x in feed["items"]}
    assert {"notice", "check", "update", "korea", "fcgame"} <= cats
    assert any("풋볼리스트" in e for e in r["errors"])          # 한 출처가 죽어도 나머지는 저장
    assert all(x["label"] and x["url"] and x["source"] for x in feed["items"])
    assert json.loads((tmp_path / "news" / "events.json").read_text(encoding="utf-8"))["items"][0]["title"]
    h = FakeHttp(); r2 = news.run(tmp_path, h)
    # 이미 읽은 공지 본문은 다시 안 읽음 (+1은 이벤트 목록 2쪽 확인 요청)
    assert r2["added"] == 0 and h.count == 4 + len(news.FEEDS)


def test_rss_header_variants():
    xml = """<rss><channel><item><title>아스널 희소식</title><link>http://a/1</link><description>[풋볼리스트] 김진혁 기자= 아스널에 희소식이 전해졌다.</description><pubDate>2026-11-21 13:30:00</pubDate></item></channel></rss>"""
    assert news.parse_rss(xml, "풋볼리스트", "football")[0]["summary"] == []
