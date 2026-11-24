import importlib.util
from pathlib import Path
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("domain_build", ROOT / "site/build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
DOMAIN = "https://fifagosu.com"


def test_domain_metadata_and_sitemap(tmp_path):
    out = tmp_path / "dist"
    build.main(["--data", str(tmp_path / "empty-data"), "--out", str(out)])
    for name, route in [("index.html", "/"), ("diag.html", "/diag"),
                        ("cards.html", "/cards"), ("press/index.html", "/press/"),
                        ("sim/index.html", "/sim/"), ("fun/index.html", "/fun/")]:
        doc = BeautifulSoup((out / name).read_text("utf-8"), "html.parser")
        assert doc.select_one('link[rel="canonical"]')["href"] == DOMAIN + route
        assert doc.select_one('meta[property="og:url"]')["content"] == DOMAIN + route
        assert doc.select_one('meta[property="og:image"]')["content"].startswith(DOMAIN + "/")
    sitemap = ET.parse(out / "sitemap.xml")
    urls = [x.text for x in sitemap.findall(".//{*}loc")]
    assert urls and all(x.startswith(DOMAIN + "/") for x in urls)
    assert DOMAIN + "/diag" in urls
    assert "Sitemap: " + DOMAIN + "/sitemap.xml" in (out / "robots.txt").read_text("utf-8")
    assert "fifagosu.pages.dev" not in (out / "fun/index.html").read_text("utf-8")
