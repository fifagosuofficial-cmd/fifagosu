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
    for col in ("분류", "제목", "글쓴이", "날짜", "조회", "추천"):
        assert f'<th scope="col">{col}</th>' in html
    assert '<tbody id="fcPosts">' in html
    assert 'id="fcPreviewHint"' in html

def test_simplified_navigation_and_retired_calculator(tmp_path):
    from bs4 import BeautifulSoup
    out = tmp_path / "site"
    out.mkdir()
    (out / "calc.html").write_text("old", encoding="utf-8")
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    expected = ["홈", "소식", "전적 진단", "AI 스쿼드", "게시판", "카드 검색", "강화·현질 효율", "선수 거래소"]
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
    assert '"enabled": false' in home
    assert "ca-pub-" not in home
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
    assert "외부 광고·방문자 분석 스크립트는 실행하지 않습니다" in privacy
    assert "fifagosu@gmail.com" in privacy
