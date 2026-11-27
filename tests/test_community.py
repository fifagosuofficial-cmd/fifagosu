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
    assert "선수 거래소" in home and 'href="/board/"' in home
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
    for col in ("분류", "제목", "글쓴이", "날짜", "조회", "추천"):
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
        bubble = doc.select_one("nav.menu > a.nav-diag-feature .fg-diag-bubble")
        assert bubble and bubble.get_text(strip=True) == "내 약점 찾기!"
        assert bubble.get("aria-hidden") == "true"
        bubble.decompose()  # Decorative callout is not part of the navigation label.
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
        links = doc.select("nav.menu a[href=\"/fun/\"]")
        assert len(links) == 1 and links[0].get_text(strip=True) == "킥킥"
        assert not doc.select("#v-home a.funlink")
        assert doc.select_one("#smEMatAuto").has_attr("checked")


def test_member_consent_disclosures(tmp_path):
    from bs4 import BeautifulSoup
    out=tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    doc=BeautifulSoup((out / "mypage/index.html").read_text("utf-8"),"html.parser")
    notice=doc.select_one("#fcConsentNotice").get_text()
    assert all(k in notice for k in ("목적","항목","보유기간","거부권","2026-11-v2"))
    assert not doc.select_one('input[name="game_name_consent"]')
    assert not doc.select_one('input[name="game_name"]')
    assert doc.select_one('input[name="nickname"]')
    privacy=(out / "privacy.html").read_text("utf-8")
    assert "Time Travel" in privacy and "2026-11-v2" in privacy


def test_kickkick_ad_layout_and_nav_icon(tmp_path):
    from bs4 import BeautifulSoup
    out=tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    for name in ("index.html","board/index.html","news/index.html"):
        doc=BeautifulSoup((out / name).read_text("utf-8"),"html.parser")
        assert doc.select_one("nav.menu > a:last-child .fg-fun-icon")
        assert doc.select_one("nav.menu > a:last-child").get_text(strip=True)=="킥킥"
    html=(out / "fun/index.html").read_text("utf-8")
    doc=BeautifulSoup(html,"html.parser")
    assert doc.body["data-view"]=="fun"
    xp = doc.select_one('#arcTabs a[href="#/games"] .arc-xp-bubble')
    assert xp and xp.get_text(strip=True) == "포인트 획득 기회!"
    assert doc.select_one('body>.wrap[data-ad-layout="public"]')
    for slot in ("fun-left","fun-right","fun-center"):
        assert doc.select_one(f'[data-ad-slot="{slot}"][hidden]')
    assert doc.select_one('script[src*="/assets/js/ads.js"]')
    assert doc.select_one('link[href*="fun-ads.css"]')
    assert "const ADS=" not in html and "adsbygoogle.js?client=" not in html
    assert "center.hidden=!show" in html
    assert "fun-center" in html and "FG_AD_CONFIG" in html

def test_admin_traffic_integration():
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    src = (root / "site/assets/js/traffic.js").read_text("utf-8")
    assert "fg-traffic-off" in src and "globalPrivacyControl" in src
    assert "traffic.js" in (root / "site/templates/base.html").read_text("utf-8")
    assert "traffic.js" in (root / "site/build.py").read_text("utf-8")
    assert "data-fg-traffic-toggle" in (root / "site/templates/pages/privacy.html").read_text("utf-8")
    assert "fc-admin-link" in (root / "site/templates/community.html").read_text("utf-8")
    assert "admin/traffic?range=" in (root / "site/assets/js/community.js").read_text("utf-8")

def test_member_welcome_in_main_and_kickkick(tmp_path):
    from bs4 import BeautifulSoup
    out=tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    for name in ("index.html", "board/index.html", "mypage/index.html", "admin/index.html", "fun/index.html"):
        doc=BeautifulSoup((out / name).read_text("utf-8"), "html.parser")
        assert doc.select_one(".fg-account-group .fg-welcome[hidden] .fg-welcome-rank")
        assert doc.select_one(".fg-welcome-name")
        assert doc.select_one(".fg-welcome-xp")
        assert doc.select_one(".fg-account-group .fg-account-icon")
        assert doc.select_one('script[src*="welcome.js"]')
        assert doc.select_one('link[href*="welcome.css"]')

def test_arcade_and_mypage_link(tmp_path):
    from pathlib import Path
    root=Path(__file__).resolve().parents[1]
    source=(root/"fun/index.html").read_text("utf-8")
    from bs4 import BeautifulSoup
    tab = BeautifulSoup(source, "html.parser").select_one('#arcTabs a[href="#/games"]')
    assert tab and tab.get_text(strip=True).startswith("미니게임")
    assert tab.select_one(".arc-xp-bubble").get_text(strip=True) == "포인트 획득 기회!"
    assert 'href="#/" aria-current="page">축구테스트</a>' in source
    assert 'window.FGArcade.mount' in source
    assert 'view!="mypage"' in (root/"site/templates/community.html").read_text("utf-8")


def test_board_header_uses_common_nav_width():
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    main = (root / "site/assets/css/main.css").read_text("utf-8")
    board = (root / "site/assets/css/community.css").read_text("utf-8")
    assert "body[data-view=board] .fg-nav-shell{max-width:1600px}" not in main
    assert 'body[data-view="board"] nav.menu{max-width:' not in board
    assert 'body[data-view="board"] .top .row,' not in board


def test_primary_menu_links_survive_spa_path_changes(tmp_path):
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    expected = ["/", "/news/", "/diag", "/trade/", "/squad/", "/board/", "/cards", "/sim/", "/fun/"]
    for file in ("index.html", "diag.html", "sim/index.html", "trade/index.html", "guide/index.html", "board/index.html", "news/index.html", "squad/index.html"):
        doc = BeautifulSoup((out / file).read_text("utf-8"), "html.parser")
        hrefs = [a["href"] for a in doc.select("nav.menu > a")]
        assert hrefs == expected, file
        for route in ("/", "/diag", "/sim/", "/trade/", "/guide/", "/board/"):
            assert [urljoin("https://fifagosu.com" + route, href) for href in hrefs] == ["https://fifagosu.com" + href for href in expected]
        assert doc.select_one(".fg-account-icon")["href"] == "/mypage/"


def test_kickkick_markup_matches_all_primary_pages():
    from bs4 import BeautifulSoup
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    for filename in ("base.html", "index.html"):
        source = (root / "site" / "templates" / filename).read_text(encoding="utf-8")
        soup = BeautifulSoup(source, "html.parser")
        link = soup.select_one("nav.menu a.nav-fun")
        assert link and link.select_one(".fg-fun-copy small[aria-hidden=true]") is not None
        assert link.get_text(strip=True) == "킥킥"


def test_daily_report_uses_actual_dates_and_values():
    m = {"date":"2026-11-27","periods":{"1":{"ready":True,"date":"2026-11-27","prev":"2026-11-26","sample":10,"up":6,"down":3,"defaultSort":"impact","risers":[{"id":1000001,"n":"테스트","s":1,"g":5,"v":120,"pv":100}],"fallers":[]}},"fgIndex":{"points":[{"date":"2026-11-26","value":1000},{"date":"2026-11-27","value":1020}]}}
    r = build.market_report(m, {1:{"className":"TEST (테스트)"}})
    assert r["ready"] and r["indexChange"] == 2 and r["flat"] == 1
    assert r["risers"][0]["pct"] == 20 and r["risers"][0]["season"] == "TEST"
    m["fgIndex"]["points"].pop()
    assert build.market_report(m,{})["index"] is None
    assert not build.market_report(None,{})["ready"]
