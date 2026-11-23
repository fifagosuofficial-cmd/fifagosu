#!/usr/bin/env python3
"""
피파고수 사이트 빌드 — site/ 소스 → dist/ (배포 폴더)

  python site/build.py --data data --out dist     (저장소 루트에서)

- 주소는 site/config.json 의 SITE_URL 한 곳에서만 관리해요(canonical·sitemap·OG·robots 모두 여기서 생성).
- data/ 는 읽기 전용으로 쓰되, 기존 언론 RSS 요약 제거 마이그레이션은 feed.json에 저장해요.
- functions/·data/ 를 dist/ 로 복사하는 건 워크플로가 해요.
- 파일 수가 MAX_FILES(18,000)를 넘으면 빌드 실패(Cloudflare Pages 사이트당 20,000개 한도 보호).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
KST = dt.timezone(dt.timedelta(hours=9))

# 고정 페이지: (출력 파일, 템플릿, 경로, 제목, 설명, sitemap 포함 여부, 추가 값)
MAIN_T = "index.html"
VIEW_PAGES = [
    ("sim/index.html", "/sim/", "sim", "FC온라인 강화·현질 효율 — 강화 손익·팩 기댓값 계산 | 피파고수",
     "선수를 골라 강화 확률대로 강화해 보고, 웹 상점 판매 팩을 넥슨 공개 확률표 그대로 열어 BP·선수 가치·실수령 수익까지 계산해요."),
    ("trade/index.html", "/trade/", "trade", "FC온라인 선수 거래소 — 팝니다·삽니다 희망가 게시판 | 피파고수",
     "FC온라인 선수 카드를 팔고 싶은 가격, 사고 싶은 가격을 올리고 피파고수 시세와 비교해 보세요."),
    ("index.html", "/", "home", "피파고수 — FC온라인 전적 진단·전체 카드 검색",
     "FC온라인 공식경기·감독모드 최근 30~100경기로 약점을 진단하고, 모든 시즌 선수 카드를 검색하세요. "
  "강화별 시세·능력치, BP·강화 계산기, 게임 가이드까지."),
    ("diag.html", "/diag", "diag", "FC온라인 전적 진단 — 최근 경기로 내 팀 약점 찾기 | 피파고수",
     "구단주 닉네임만 넣으면 공식경기·감독모드 최근 30~100경기를 분석해 득점·실점 패턴과 약점을 알려줘요."),
    ("cards.html", "/cards", "cards", "FC온라인 선수 카드 검색 — OVR·능력치·강화별 시세 | 피파고수",
     "FC온라인 전체 시즌 선수 카드를 검색하고 OVR, 세부 능력치 34개, 1~13강 강화별 시세를 확인하세요."),
    ("calc.html", "/calc", "calc", "FC온라인 BP·강화 계산기 — 강화 비용·확률·판매 수수료 | 피파고수",
     "FC온라인 강화 단계별 OVR 상승, 강화 성공 확률, 판매 수수료를 계산해요."),
    ("guide/index.html", "/guide/", "guide", "FC온라인 게임 가이드 — 등급·감독모드·강화·팀컬러 | 피파고수",
     "FC온라인 공식경기 등급, 감독모드, 강화, 팀컬러, 시즌, 급여·이적시장 규칙을 정리했어요."),
]
GUIDE_PAGES = [
    ("official", "FC온라인 공식경기 등급 정리 — 승급 점수·시즌 보상", "유망주부터 슈퍼 챔피언스까지 FC온라인 공식경기 등급과 승급 점수, 시즌 규칙을 정리했어요."),
    ("manager", "FC온라인 감독모드 공략 — 전술·선수 고르기", "FC온라인 감독모드 상위권 전술 경향, 포지션별 신체 기준, 순위 보상을 정리했어요."),
    ("grade", "FC온라인 강화 정리 — 단계별 OVR 상승·성공 확률", "FC온라인 1~13강 강화 단계별 OVR 상승값, 성공 확률, 카드 색을 정리했어요."),
    ("tc", "FC온라인 팀컬러 정리 — 소속·특성·강화 팀컬러", "FC온라인 클럽·국가 팀컬러, 특성 팀컬러, 강화 팀컬러(물결) 조건과 보너스를 정리했어요."),
    ("season", "FC온라인 시즌과 선수 카드 — spid·시즌 배지", "같은 선수도 시즌마다 다른 카드인 이유와 선수 고유 ID(spid), 시즌 이미지를 설명해요."),
    ("market", "FC온라인 급여·이적시장 — 급여 상한·판매 수수료 구조", "FC온라인 급여가 무엇이고 어떻게 맞추는지, 이적시장 거래와 판매 수수료가 어떻게 계산되는지 설명해요."),
]
PAGES = [
    ("patch/index.html", "patch.html", "/patch/", "FC온라인 패치노트 — 업데이트·밸런스·개선 내역 | 피파고수",
     "FC온라인 공식 업데이트·패치·밸런스 조정 공지를 날짜순으로 모아 핵심만 요약했어요. 매일 자동 갱신.", True),
    ("news/index.html", "news.html", "/news/", "FC온라인 소식 — 공지·점검·업데이트·이벤트 | 피파고수",
     "넥슨 FC온라인 공식 공지·점검·업데이트·이벤트를 핵심만 요약해 하루 4번 모아 보여줘요.", True),
    ("press/index.html", "news.html", "/press/", "축구 뉴스 — 해외축구·국내축구·FC온라인 기사 | 피파고수",
     "EPL·라리가 등 해외축구와 K리그 국내축구, FC온라인 관련 기사 제목과 원문 링크를 모아요.", True),
    ("about.html", "pages/about.html", "/about", "피파고수 소개", "피파고수가 어떤 사이트인지, 데이터는 어디서 오는지 소개해요.", True),
    ("privacy.html", "pages/privacy.html", "/privacy", "개인정보처리방침 — 피파고수", "피파고수의 개인정보 처리 방침이에요.", True),
    ("terms.html", "pages/terms.html", "/terms", "이용약관 — 피파고수", "피파고수 이용약관이에요.", True),
    ("contact.html", "pages/contact.html", "/contact", "문의 — 피파고수", "피파고수에 의견·오류 제보를 보내는 방법이에요.", True),
    ("404.html", "404.html", "/404", "페이지를 찾을 수 없어요 — 피파고수", "요청한 페이지가 없어요.", False),
]
# 그대로 복사하는 폴더(저장소 루트 기준 → dist 기준)
COPY = [("site/assets", "assets"), ("site/preview", "preview"), ("site/brand", "site/brand"), ("fun", "fun")]


OFFICIAL = {"notice", "check", "update", "event"}
PATCH_RE = re.compile(r"업데이트|패치|밸런스|개선|변경|ROSTER|CLASS|오류 수정|수정 사항")
CATS = [("notice", "공지"), ("check", "점검"), ("update", "업데이트"), ("event", "이벤트"),
        ("fcgame", "FC온라인 기사"), ("world", "해외축구"), ("korea", "국내축구")]
PRESS = {"fcgame", "world", "korea"}


def load_news(data_dir, today):
    """data/news/feed.json·events.json → 템플릿용 값. 파일이 없으면 None(예전 홈 그대로)."""
    feed = _load(data_dir / "news" / "feed.json")
    if not feed or not feed.get("items"):
        return None
    ev = (_load(data_dir / "news" / "events.json") or {}).get("items", [])
    items = feed["items"]
    # RSS에 남아 있는 과거 언론사 요약도 게시 페이지·공개 데이터에서 지워요.
    cleaned = False
    for item in items:
        if (item.get("kind") == "press" or item.get("cat") in PRESS) and item.get("summary"):
            item["summary"] = []
            cleaned = True
    if cleaned:
        feed_path = data_dir / "news" / "feed.json"
        tmp = feed_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(feed_path)
    official = [x for x in items if x["cat"] in OFFICIAL and x["cat"] != "update"]
    updates = [x for x in items if x["cat"] == "update"]
    press = [x for x in items if x["cat"] in PRESS]
    patch = _load(data_dir / "news" / "patch.json") or {"updated": "", "items": []}
    check = next((x for x in official if x["cat"] == "check"), None)
    if check:
        t = check["title"]
        state = "done" if re.search(r"완료|조기 오픈|종료", t) else "plan"
        short = re.sub(r"^\([^)]*\)\s*", "", t)
        check = {**check, "state": state, "state_label": "완료" if state == "done" else "예정", "short": short}
    events = []
    for e in ev:
        if e["end"] < today:
            continue
        try:
            s_, e_, t_ = (dt.date.fromisoformat(x) for x in (e["start"], e["end"], today))
            pct = max(4, min(100, round((t_ - s_).days / max(1, (e_ - s_).days) * 100)))
        except ValueError:
            pct = 50
        events.append({**e, "pct": pct})
    events.sort(key=lambda e: e["end"])
    timeline = sorted(official + updates[:1], key=lambda x: x.get("date") or "", reverse=True)
    world = [x for x in press if x["cat"] == "world"] or press
    patches = sorted([x for x in items if x["cat"] == "update" or (x["cat"] in ("notice", "check") and PATCH_RE.search(x["title"]))],
                     key=lambda x: x.get("date") or "", reverse=True)
    return {"updated": feed.get("updated", ""), "official": timeline[:8], "press": press[:7], "world": world[:8], "patches": patches, "events": events, "patch": patch,
            "check": check, "upd": updates[0] if updates else None,
            "all_official": sorted(official + updates, key=lambda x: x.get("date") or "", reverse=True)[:150],
            "all_press": press[:150],
            "board": sorted(items, key=lambda x: x.get("date") or "", reverse=True),
            "boards": {k: sorted([x for x in items if (x["cat"] in PRESS) == (k == "press")], key=lambda x: x.get("date") or "", reverse=True)
                       for k in ("official", "press")},
            "cats": [(c, l) for c, l in CATS if any(x["cat"] == c for x in items)],
            "kcats": {k: sorted([(c, l) for c, l in CATS if (c in PRESS) == (k == "press") and any(x["cat"] == c for x in items)],
                                key=lambda t: ["world", "korea", "fcgame"].index(t[0]) if t[0] in PRESS else 0)
                      for k in ("official", "press")},
            "counts": {c: sum(1 for x in items if x["cat"] == c) for c, _ in CATS}}


def _load(p):
    try:
        return json.loads(Path(p).read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def refresh_popular_market_cards(data_dir, market):
    """Build-time safeguard: always show popularity from the full card list."""
    if not market or not market.get("byGrade"):
        return market
    listed = {}
    for shard in range(200):
        listed.update(_load(data_dir / "list" / f"{shard}.json") or {})
    ranked = sorted(
        ((int(card_id), rec) for card_id, rec in listed.items() if int(rec.get("games") or 0) > 0),
        key=lambda item: (-int(item[1].get("games") or 0), item[0]),
    )
    for grade in market.get("grades") or []:
        bucket = market["byGrade"].get(str(grade))
        if not bucket:
            continue
        moves = {int(item["id"]): item for kind in ("risers", "fallers") for item in bucket.get(kind, [])}
        popular = []
        for card_id, rec in ranked:
            prices = rec.get("price") or []
            value = prices[grade - 1] if len(prices) >= grade else None
            if not value:
                continue
            pos = (rec.get("pos") or [[None, None]])[0]
            item = {"id": card_id, "n": rec.get("name") or "", "s": card_id // 1_000_000,
                    "o": rec.get("ovr") or (pos[1] if len(pos) > 1 else None), "p": pos[0],
                    "v": value, "u": int(rec.get("games") or 0)}
            item.update({k: v for k, v in moves.get(card_id, {}).items()
                         if k in ("pv", "c", "fromDate", "toDate")})
            popular.append(item)
            if len(popular) == 10:
                break
        bucket["popular"] = popular
    market["popularLabel"] = "전체 선수카드 사용량 기준"
    return market


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
    data_dir = (ROOT / a.data) if not Path(a.data).is_absolute() else Path(a.data)
    today = dt.datetime.now(KST).strftime("%Y-%m-%d")
    news = load_news(data_dir, today)
    market = refresh_popular_market_cards(data_dir, _load(data_dir / "market" / "summary.json"))
    if market and not market.get("byGrade"):
        market = None
    common = dict(news=news, market=market, SITE_URL=site_url, ver=ver, cfg=cfg, contact=cfg.get("CONTACT_EMAIL") or "",
                  updated=dt.datetime.now(KST).strftime("%Y-%m-%d"), og_title=None, og_description=None)
    sitemap = []
    titles = json.dumps({v: t for _, _, v, t, _ in VIEW_PAGES}, ensure_ascii=False)
    url = lambda path: site_url + ("/" if path == "/" else path)

    def render(fname, tpl, path, title, desc, in_map, root="", **extra):
        ctx = dict(common, title=title, description=desc, root=root, canonical=url(path),
                   noindex=not in_map, view=extra.pop("view", ""), guide_only=extra.pop("guide_only", ""),
                   titles=titles, **extra)
        f = out / fname
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(env.get_template(tpl).render(**ctx), encoding="utf-8")
        if in_map:
            sitemap.append(url(path))

    for fname, path, view, title, desc in VIEW_PAGES:
        render(fname, MAIN_T, path, title, desc, True, view=view, root="../" if "/" in fname else "")
    for slug, title, desc in GUIDE_PAGES:
        render(f"guide/{slug}.html", MAIN_T, f"/guide/{slug}", title + " | 피파고수", desc, True,
               root="../", view="guide", guide_only="g-" + slug)
    # 게시글 페이지: /news/{id} — 공식 소식만 검색 색인, 언론사 상세 페이지는 noindex 처리해요.
    if news:
        for board in news["boards"].values():
          for i, x in enumerate(board):
            same = [y for y in board if y["cat"] == x["cat"] and y["id"] != x["id"]][:5]
            post = {**x, "prev": board[i + 1] if i + 1 < len(board) else None,
                    "next": board[i - 1] if i > 0 else None, "related": same}
            press = x["cat"] in PRESS
            desc = x["title"] if press else (" ".join(x.get("summary") or []) or x["title"])
            desc = desc[:150]
            render(f"news/{x['id']}.html", "post.html", f"/news/{x['id']}", f"{x['title']} | 피파고수 {'뉴스' if press else '소식'}",
                   desc, x["kind"] == "official", root="../", post=post, active="press" if press else "news",
                   board_url="press/" if press else "news/", board_name="뉴스 게시판" if press else "소식 게시판")
    for fname, tpl, path, title, desc, in_map in PAGES:
        render(fname, tpl, path, title, desc, in_map, root="/" if fname == "404.html" else ("../" if "/" in fname else ""),
               active=fname.split("/")[0] if fname.startswith(("news/", "press/", "patch/")) else "",
               bkind="press" if fname.startswith("press/") else "official")
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
    (out / "_redirects").write_text("/index.html / 301\n/guide/patch /patch/ 301\n", encoding="utf-8")

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
