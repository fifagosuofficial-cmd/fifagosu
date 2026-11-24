import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_for_squad", ROOT / "site/build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def put(root, name, data):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def test_squad_catalog_uses_exact_prices_and_confirmable_eligibility(tmp_path):
    data, out = tmp_path / "data", tmp_path / "out"
    put(data, "teamcolor/teamcolors.json", {"items": [
        {"id": 11, "name": "클럽 A", "type": "club", "clubId": 12},
        {"id": 21, "name": "국가 B", "type": "nation", "nationId": 22},
        {"id": 31, "name": "관계 C", "type": "relation"},
    ]})
    put(data, "list/1.json", {"1000001": {"name": "선수", "pay": 20, "pos": [["ST", 110], ["CF", 108]],
        "price": [123456789, None, 0, -5, 987654321], "at": "2026-11-24T10:00:00+09:00"},
        "1000201": {"name": "가격없음", "pay": 10, "pos": [["ST", 99]], "price": [0]}})
    put(data, "detail/1.json", {"1000001": {"nationId": 22, "clubs": [["2019", "클럽 A"]], "stats": {"finishing": 114}, "foot": {"l": 4, "r": 5}}})
    build.squad_catalog(data, out)
    catalog = out / "assets/squad-data"
    rows = json.loads((catalog / "ST.json").read_text("utf-8"))
    assert len(rows) == 1
    assert rows[0][5] == [123456789, None, None, None, 987654321]
    assert rows[0][6] == 4 and rows[0][8] == [11, 21]
    manifest = json.loads((catalog / "manifest.json").read_text("utf-8"))
    assert manifest["positions"]["ST"] == 1 and manifest["dateTo"] == "2026-11-24"
    assert rows[0][7][manifest["stats"].index("finishing")] == 114
    assert {t["id"] for t in manifest["teams"]} == {11, 21}


def test_squad_page_and_manifest_build_without_data(tmp_path):
    out = tmp_path / "site"
    build.main(["--data", str(tmp_path / "missing"), "--out", str(out)])
    html = (out / "squad/index.html").read_text("utf-8")
    assert "AI 스쿼드" in html and 'https://fifagosu.com/squad/' in html
    assert "squad.js" in html and "https://fifagosu.com/squad/" in (out / "sitemap.xml").read_text("utf-8")
    assert (out / "assets/squad-data/manifest.json").is_file()
