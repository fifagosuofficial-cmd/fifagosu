#!/usr/bin/env python3
"""
피파고수 사이트 빌드 — site/ 소스 → dist/ (배포 폴더)

  python site/build.py --data data --out dist     (저장소 루트에서)

- 주소는 site/config.json 의 SITE_URL 한 곳에서만 관리해요(canonical·sitemap·OG·robots 모두 여기서 생성).
- data/ 는 읽기만 해요. functions/·data/ 를 dist/ 로 복사하는 건 워크플로가 해요.
- 파일 수가 MAX_FILES(18,000)를 넘으면 빌드 실패(Cloudflare Pages 사이트당 20,000개 한도 보호).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import shutil
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
KST = dt.timezone(dt.timedelta(hours=9))

# 고정 페이지: (출력 파일, 템플릿, 경로, 제목, 설명, sitemap 포함 여부)
PAGES = [
    ("index.html", "index.html", "/", "피파고수 — FC온라인 전적 진단·전체 카드 검색",
     "FC온라인 공식경기·감독모드 최근 30~100경기로 약점을 진단하고, 모든 시즌 선수 카드를 검색하세요. "
     "강화별 시세·능력치, BP·강화 계산기, 시스템 가이드까지.", True),
    ("about.html", "pages/about.html", "/about", "피파고수 소개", "피파고수가 어떤 사이트인지, 데이터는 어디서 오는지 소개해요.", True),
    ("privacy.html", "pages/privacy.html", "/privacy", "개인정보처리방침 — 피파고수", "피파고수의 개인정보 처리 방침이에요.", True),
    ("terms.html", "pages/terms.html", "/terms", "이용약관 — 피파고수", "피파고수 이용약관이에요.", True),
    ("contact.html", "pages/contact.html", "/contact", "문의 — 피파고수", "피파고수에 의견·오류 제보를 보내는 방법이에요.", True),
    ("404.html", "404.html", "/404", "페이지를 찾을 수 없어요 — 피파고수", "요청한 페이지가 없어요.", False),
]
# 그대로 복사하는 폴더(저장소 루트 기준 → dist 기준)
COPY = [("site/assets", "assets"), ("site/preview", "preview"), ("site/brand", "site/brand"), ("fun", "fun")]


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="dist")
    a = ap.parse_args(argv)
    cfg = json.loads((SITE / "config.json").read_text(encoding="utf-8"))
    site_url = cfg["SITE_URL"].rstrip("/")
    out = (ROOT / a.out) if not Path(a.out).is_absolute() else Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    for src, dst in COPY:
        s = ROOT / src
        if s.exists():
            shutil.copytree(s, out / dst, dirs_exist_ok=True)

    # 정적 파일이 바뀌면 브라우저 캐시를 새로 받게 하는 버전 값
    h = hashlib.sha1()
    for p in sorted((SITE / "assets").rglob("*")) + sorted((SITE / "preview").rglob("*")):
        if p.is_file():
            h.update(p.read_bytes())
    ver = h.hexdigest()[:8]

    env = Environment(loader=FileSystemLoader(SITE / "templates"), undefined=StrictUndefined,
                      autoescape=False, keep_trailing_newline=True)
    common = dict(SITE_URL=site_url, ver=ver, cfg=cfg, contact=cfg.get("CONTACT_EMAIL") or "",
                  updated=dt.datetime.now(KST).strftime("%Y-%m-%d"), og_title=None, og_description=None)
    sitemap = []
    for fname, tpl, path, title, desc, in_map in PAGES:
        root = "/" if fname == "404.html" else ""      # 404는 어느 경로에서든 열리므로 절대 경로
        html = env.get_template(tpl).render(**common, title=title, description=desc, root=root,
                                            canonical=site_url + ("/" if path == "/" else path),
                                            noindex=not in_map)
        (out / fname).write_text(html, encoding="utf-8")
        if in_map:
            sitemap.append(site_url + ("/" if path == "/" else path))
    if (out / "fun" / "index.html").exists():
        sitemap.append(site_url + "/fun/")

    (out / "robots.txt").write_text(
        "User-agent: *\nDisallow: /api/\nDisallow: /user/\nDisallow: /preview/\n\n"
        f"Sitemap: {site_url}/sitemap.xml\n", encoding="utf-8")
    today = dt.datetime.now(KST).strftime("%Y-%m-%d")
    urls = "".join(f"<url><loc>{u}</loc><lastmod>{today}</lastmod></url>" for u in sitemap)
    (out / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n',
        encoding="utf-8")
    # 옛 주소 호환: /index.html → /
    (out / "_redirects").write_text("/index.html / 301\n", encoding="utf-8")

    n = sum(1 for p in out.rglob("*") if p.is_file())
    data_dir = ROOT / a.data
    if data_dir.exists() and not (out / "data").exists():
        n += sum(1 for p in data_dir.rglob("*.json"))   # 워크플로가 나중에 복사할 data 파일도 미리 셈
    print(f"빌드 완료: {out} · 파일 {n}개 · ver {ver} · SITE_URL {site_url}")
    if n > cfg.get("MAX_FILES", 18000):
        print(f"파일 수가 상한 {cfg['MAX_FILES']}개를 넘었어요. 배포를 중단해요.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
