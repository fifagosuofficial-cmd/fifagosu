import sqlite3
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_community", ROOT / "site/build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

def test_community_schema_member_deletion():
    db = sqlite3.connect(":memory:")
    db.executescript((ROOT / "community/schema.sql").read_text("utf-8"))
    db.execute("INSERT INTO members(id,provider,subject,nickname,created,policy,age_confirmed) VALUES('u','google','sub','test',1,'2026-11-v1',1)")
    db.execute("INSERT INTO sessions VALUES('hash','u',100)")
    db.execute("INSERT INTO squads(member_id,name,payload,created) VALUES('u','a','{}',1)")
    db.execute("INSERT INTO value_history(squad_id,bp,observed) VALUES(1,100,1)")
    db.execute("INSERT INTO favorites VALUES('u',123,1,'player')")
    db.execute("INSERT INTO feedback(member_id,kind,body,created) VALUES('u','bug','a',1)")
    db.execute("INSERT INTO diagnoses(member_id,nickname,body,created) VALUES('u','a','b',1)")
    db.execute("DELETE FROM members WHERE id='u'")
    for table in ("sessions","squads","value_history","favorites","feedback","diagnoses"):
        assert db.execute("SELECT count(*) FROM "+table).fetchone()[0] == 0

def test_community_pages_and_seo(tmp_path):
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    for name in ("board","mypage","admin"):
        html = (out / name / "index.html").read_text("utf-8")
        assert 'data-screen="'+name+'"' in html
        assert "community.js" in html
        if name != "board":
            assert 'name="robots" content="noindex"' in html
    home = (out / "index.html").read_text("utf-8")
    assert "선수 거래소" in home and 'href="board/"' in home
    sm = (out / "sitemap.xml").read_text("utf-8")
    assert "https://fifagosu.com/board/" in sm and "https://fifagosu.com/admin/" not in sm

def test_board_compact_columns_and_view_counter(tmp_path):
    db = sqlite3.connect(":memory:")
    db.executescript((ROOT / "community/schema.sql").read_text("utf-8"))
    db.execute("INSERT INTO posts(category,prefix,title,body,created) VALUES('free','normal','title','body',1)")
    assert db.execute("SELECT views FROM posts").fetchone()[0] == 0
    db.execute("UPDATE posts SET views=views+1 WHERE id=1 AND hidden=0")
    assert db.execute("SELECT views FROM posts").fetchone()[0] == 1
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    html = (out / "board/index.html").read_text("utf-8")
    for col in ("분류", "제목", "글쓴이", "날짜", "조회", "순추천"):
        assert f'<th scope="col">{col}</th>' in html
    assert '<tbody id="fcPosts">' in html
    assert 'id="fcPreviewHint"' in html
    assert 'id="fcBoardList"' in html
    assert 'id="fcComposer"' in html
    assert 'id="fcSearchMode"' in html
    assert 'id="fcRank"' in html

def test_simplified_navigation_and_retired_calculator(tmp_path):
    from bs4 import BeautifulSoup
    out = tmp_path / "site"
    out.mkdir()
    (out / "calc.html").write_text("old", encoding="utf-8")
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    expected = ["홈", "소식", "전적 진단", "선수 거래소", "AI 스쿼드", "게시판", "카드 검색", "강화·현질 효율", "킥킥"]
    for file in ("index.html", "board/index.html", "news/index.html", "press/index.html", "patch/index.html", "sim/index.html"):
        doc = BeautifulSoup((out / file).read_text("utf-8"), "html.parser")
        assert [a.get_text(strip=True) for a in doc.select("nav.menu > a")] == expected
        assert doc.select_one("a.fg-account-icon")["aria-label"] == "마이페이지"
        assert doc.select_one(".fg-diag-icon")
        if file.startswith(("news/", "press/", "patch/")):
            assert [a.get_text(strip=True) for a in doc.select(".fg-news-switch a")] == ["공식 소식", "축구 뉴스", "패치노트"]
    assert not (out / "calc.html").exists()
    assert "/calc /sim/ 301" in (out / "_redirects").read_text("utf-8")
    assert "https://fifagosu.com/calc" not in (out / "sitemap.xml").read_text("utf-8")

def test_ad_slots_are_ready_but_do_not_load_network_without_ids(tmp_path):
    from bs4 import BeautifulSoup
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    expected = {
        "index.html": "home-1",
        "diag.html": "diag-1",
        "cards.html": "cards-1",
        "sim/index.html": "sim-1",
        "trade/index.html": "trade-1",
        "guide/index.html": "guide-1",
        "news/index.html": "news-1",
        "patch/index.html": "patch-1",
        "squad/index.html": "squad-1",
        "board/index.html": "board-1",
    }
    for file, slot in expected.items():
        doc = BeautifulSoup((out / file).read_text("utf-8"), "html.parser")
        assert doc.select_one(f'aside[data-ad-slot="{slot}"][aria-label="광고"]')
        assert doc.select_one('script[src*="assets/js/ads.js"]')
    home = (out / "index.html").read_text("utf-8")
    assert '"enabled": true' in home
    assert 'name="google-adsense-account" content="ca-pub-2025317658537963"' in home
    assert "adsbygoogle.js?client=ca-pub-2025317658537963" in home
    assert (out / "ads.txt").read_text("utf-8") == "google.com, pub-2025317658537963, DIRECT, f08c47fec0942fa0\n"
    assert "adsbygoogle.js?client=" not in (out / "admin/index.html").read_text("utf-8")
    loader = (out / "assets/js/ads.js").read_text("utf-8")
    assert "pagead2.googlesyndication.com" in loader
    assert "cfg.enabled===true" in loader

def test_member_policies_match_active_login_and_ad_placeholders(tmp_path):
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    privacy = (out / "privacy.html").read_text("utf-8")
    terms = (out / "terms.html").read_text("utf-8")
    assert "Google 로그인" in privacy
    assert "회원가입·로그인 기능이 없고" not in privacy
    assert "현재 미시행" not in privacy + terms
    assert "Google AdSense 사이트 연결 및 검토" in privacy
    assert "fifagosu@gmail.com" in privacy

def test_forum_detail_list_and_rank_assets(tmp_path):
    from bs4 import BeautifulSoup
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    board = BeautifulSoup((out / "board/index.html").read_text("utf-8"), "html.parser")
    assert board.select_one("#fcPost").find_next_sibling("h2")["id"] == "fcListTitle"
    assert board.select_one("#fcListTitle").find_next_sibling("nav")["id"] == "fcTabs"
    assert board.select_one("#fcTabs").find_next_sibling("section")["id"] == "fcBoardList"
    admin = BeautifulSoup((out / "admin/index.html").read_text("utf-8"), "html.parser")
    assert admin.select_one("#fcAdminRefresh")
    assert admin.select_one(".fc-admin-layout #fcAdminTabs")
    for grade in (0,1,3,5,8,11,13):
        svg = (out / f"assets/ranks/cat-{grade}.svg").read_text("utf-8")
        assert f"+{grade}</text>" in svg
        assert 'shape-rendering="crispEdges"' in svg

def test_three_ad_positions_public_only(tmp_path):
    from bs4 import BeautifulSoup
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    for file in ("index.html","diag.html","cards.html","market/index.html","sim/index.html","trade/index.html","guide/index.html","news/index.html","press/index.html","patch/index.html","squad/index.html","board/index.html"):
        doc = BeautifulSoup((out / file).read_text("utf-8"),"html.parser")
        assert doc.select_one('[data-ad-layout="public"]')
        for side in ("side-left","side-right"):
            assert len(doc.select(f'[data-ad-slot="{side}"][hidden]')) == 1
    for file in ("mypage/index.html","admin/index.html","privacy.html","terms.html","contact.html","404.html"):
        doc = BeautifulSoup((out / file).read_text("utf-8"),"html.parser")
        assert not doc.select('[data-ad-layout="public"]')
        assert not doc.select('[data-ad-slot]')

def test_page_specific_middle_ad_positions(tmp_path):
    from bs4 import BeautifulSoup
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    soup = lambda file: BeautifulSoup((out / file).read_text("utf-8"),"html.parser")
    doc = soup("index.html")
    for slot, after in (("diag-1","dSecs"),("cards-1","cRes"),("trade-1","trList")):
        assert doc.select_one(f'[data-ad-slot="{slot}"]').find_next_sibling()["id"] == after
    for panel, slot in (("simEff","sim-1"),("simEnh","sim-enh-1"),("simPack","sim-pack-1"),("simCash","sim-cash-1")):
        assert len(doc.select(f'#{panel} [data-ad-slot="{slot}"]')) == 1
    assert len(doc.select('#v-sim > [data-ad-slot]')) == 0
    board = soup("board/index.html")
    assert len(board.select('#fcBoardList > #fcBoardAd')) == 1
    assert len(board.select('[data-ad-slot="board-1"]')) == 1
    sq = soup("squad/index.html")
    assert sq.select_one('[data-ad-slot="squad-1"]').find_next_sibling()["id"] == "sqOutput"

def test_live_beta_notice_removed_but_offline_preview_retained(tmp_path):
    from bs4 import BeautifulSoup
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    doc = BeautifulSoup((out / "diag.html").read_text("utf-8"), "html.parser")
    assert doc.select_one("#notice[hidden]")
    assert "Data based on NEXON Open API" in doc.footer.get_text()
    js = (out / "assets/js/app.js").read_text("utf-8")
    assert "<b>베타</b>" not in js
    assert "$('notice').hidden=true" in js and "$('notice').hidden=false" in js


def test_search_engine_verification_in_static_head(tmp_path):
    from bs4 import BeautifulSoup
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    doc = BeautifulSoup((out / "index.html").read_text("utf-8"), "html.parser")
    for name, value in (("naver-site-verification", "1b853471d768b6c30cf0aba8a7944ddb34d5fd1a"), ("google-site-verification", "X-kRhBDl5EnO8iYJM1nWJVYUGEXoG_-fLkRei9spe7k")):
        tags = doc.select(f'head meta[name="{name}"]')
        assert len(tags) == 1 and tags[0]["content"] == value
    assert doc.select_one('head meta[name="google-adsense-account"]')
    assert "https://fifagosu.com/" in (out / "sitemap.xml").read_text("utf-8")


def test_kickkick_menu_visible_with_and_without_news(tmp_path, monkeypatch):
    from bs4 import BeautifulSoup
    data = tmp_path / "missing"
    out = tmp_path / "site"
    original = build.load_news
    for has_news in (False, True):
        if has_news:
            monkeypatch.setattr(build, "load_news", lambda *_: {"updated": "", "official": [], "press": [], "world": [], "patches": [], "events": [], "patch": {"items": []}, "check": None, "upd": None, "all_official": [], "all_press": [], "board": [], "boards": {"official": [], "press": []}, "cats": [], "kcats": {"official": [], "press": []}, "counts": {}})
        else:
            monkeypatch.setattr(build, "load_news", original)
        build.main(["--data", str(data), "--out", str(out)])
        doc = BeautifulSoup((out / "index.html").read_text("utf-8"), "html.parser")
        assert bool(doc.select_one("#v-home .mk-news")) == has_news
        links = doc.select("nav.menu a[href=\"fun/\"]")
        assert len(links) == 1 and links[0].get_text(strip=True) == "킥킥"
        assert not doc.select("#v-home a.funlink")
        assert doc.select_one("#smEMatAuto").has_attr("checked")
