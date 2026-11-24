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
