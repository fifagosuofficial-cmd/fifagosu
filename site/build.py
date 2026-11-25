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
sys.path.insert(0, str(ROOT / "crawler"))
from market_rank import MAX_SAFE_INTEGER, merge_market_moves, rank_market_moves  # noqa: E402
from news_classify import clean_news_items  # noqa: E402

# 고정 페이지: (출력 파일, 템플릿, 경로, 제목, 설명, sitemap 포함 여부, 추가 값)
MAIN_T = "index.html"
VIEW_PAGES = [
    ("sim/index.html", "/sim/", "sim", "FC온라인 강화·현질 효율 — 강화 손익·팩 기댓값 계산 | 피파고수",
     "선수를 골라 강화 확률대로 강화해 보고, 웹 상점 판매 팩을 넥슨 공개 확률표 그대로 열어 BP·선수 가치·실수령 수익까지 계산해요."),
    ("trade/index.html", "/trade/", "trade", "FC온라인 선수 거래소 — 팝니다·삽니다 희망가 게시판 | 피파고수",
     "FC온라인 선수 카드를 팔고 싶은 가격, 사고 싶은 가격을 올리고 피파고수 시세와 비교해 보세요."),
    ("market/index.html", "/market/", "market", "FC온라인 시세 급등락 TOP 100 | 피파고수",
     "실제 수집 시세로 계산한 FC온라인 급등·급락 TOP 100을 기간·강화·시즌·등락률·BP 변동액별로 확인하세요."),
    ("index.html", "/", "home", "피파고수 — FC온라인 전적 진단·전체 카드 검색",
     "FC온라인 공식경기·감독모드 최근 30~100경기로 약점을 진단하고, 모든 시즌 선수 카드를 검색하세요. "
  "강화별 시세·능력치, AI 스쿼드, 강화·현질 효율, 게시판까지."),
    ("diag.html", "/diag", "diag", "FC온라인 전적 진단 — 최근 경기로 내 팀 약점 찾기 | 피파고수",
     "구단주 닉네임만 넣으면 공식경기·감독모드 최근 30~100경기를 분석해 득점·실점 패턴과 약점을 알려줘요."),
    ("cards.html", "/cards", "cards", "FC온라인 선수 카드 검색 — OVR·능력치·강화별 시세 | 피파고수",
     "FC온라인 전체 시즌 선수 카드를 검색하고 OVR, 세부 능력치 34개, 1~13강 강화별 시세를 확인하세요."),
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
    ("board/index.html", "community.html", "/board/", "FC온라인 게시판 | 피파고수", "스쿼드 평가, 선수 후기, 자유게시판", True),
    ("mypage/index.html", "community.html", "/mypage/", "마이페이지 | 피파고수", "회원 전용 개인 보관함", False),
    ("admin/index.html", "community.html", "/admin/", "관리자 | 피파고수", "운영 관리", False),
    ("squad/index.html", "squad.html", "/squad/", "FC온라인 AI 스쿼드 추천 — 예산·급여 맞춤 | 피파고수",
     "보유 BP와 급여, 팀컬러, 포메이션에 맞춘 선수 조합을 자동으로 추천해요.", True),
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
    items = clean_news_items(feed["items"])
    if items != feed["items"]:
        print(f"news cleanup: {len(feed['items'])} -> {len(items)}")
        feed["items"] = items
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
    world = [x for x in press if x["cat"] == "world"]
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
    """Build-time safeguard: always show 1-grade popularity from the full card list."""
    if not market or not market.get("byGrade"):
        return market
    listed = {}
    for shard in range(200):
        listed.update(_load(data_dir / "list" / f"{shard}.json") or {})
    ranked = sorted(
        ((int(card_id), rec) for card_id, rec in listed.items() if int(rec.get("games") or 0) > 0),
        key=lambda item: (-int(item[1].get("games") or 0), item[0]),
    )
    for grade in (1,):
        bucket = market["byGrade"].setdefault(str(grade), {})
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
    market["popularLabel"] = "상위 랭커 사용 경기 수 TOP 10"
    return market


def market_period_views(data_dir, market):
    """Read full-scan history once; compare exact calendar-day endpoints, never substitute dates."""
    if not market or not market.get("byGrade"):
        return market
    meta = _load(data_dir / "market" / "all_card_history_dates.json") or {}
    raw_dates = meta.get("dates") or []
    dates = sorted(set(raw_dates)) if meta.get("basis") == "full-list-snapshots" else []
    counts_by_date = {date: count for date, count in zip(raw_dates, meta.get("counts") or [])
                      if type(count) is int and count >= 0}
    end = dates[-1] if dates else market["date"]
    end_day = dt.date.fromisoformat(end)
    grades = list(range(1, 14))
    minimum = market.get("indexMinimum", 30)
    listed, history = {}, {}
    for shard in range(200):
        listed.update(_load(data_dir / "list" / f"{shard}.json") or {})
        history.update(_load(data_dir / "market" / "all_card_history" / f"{shard}.json") or {})
    new_dates = {}
    for item in ((_load(data_dir / "market" / "new_cards.json") or {}).get("items") or []):
        if item.get("id") is not None:
            new_dates[int(item["id"])] = item.get("d")
    today_new = _load(data_dir / "meta" / "new_today.json") or {}
    if today_new.get("date"):
        for card_id in today_new.get("ids", []):
            new_dates[int(card_id)] = today_new["date"]
    periods, payloads = {}, {}
    for days in (1, 3, 7):
        start = (end_day - dt.timedelta(days=days)).isoformat()
        ready = end in dates and start in dates
        buckets, period_items, index, index_sample = {}, [], None, 0
        for grade in grades:
            changes, candidates, index_changes = [], [], []
            if ready:
                for card_id, rec in listed.items():
                    rows = history.get(str(card_id), {}).get(str(grade), [])
                    prices = dict(rows)
                    first, last = prices.get(start), prices.get(end)
                    if type(first) is not int or type(last) is not int or not (0 < first <= MAX_SAFE_INTEGER and 0 < last <= MAX_SAFE_INTEGER):
                        continue
                    pos = (rec.get("pos") or [[None, None]])[0]
                    price_history = [[date, value] for date, value in rows
                                     if start <= date <= end and type(value) is int
                                     and 0 < value <= MAX_SAFE_INTEGER]
                    item = {"id": int(card_id), "n": rec.get("name") or "", "s": int(card_id)//1000000,
                            "o": rec.get("ovr") or (pos[1] if len(pos)>1 else None), "p": pos[0],
                            "v": last, "pv": first, "c": round((last-first)/first*100,1),
                            "d": last-first, "u": int(rec.get("games") or 0), "g": grade,
                            "fromDate": start, "toDate": end, "h": price_history}
                    changes.append(item)
                    valid_prices = [value for date, value in rows if date <= end and
                                    type(value) is int and 0 < value <= MAX_SAFE_INTEGER]
                    candidates.append({"id": int(card_id), "first": first, "last": last,
                                       "grade": grade,
                                       "games": int(rec.get("games") or 0),
                                       "observations": len(valid_prices), "prices": valid_prices[-3:],
                                       "new_date": new_dates.get(int(card_id)), "item": item})
                    if min(first, last) >= 30000:
                        index_changes.append(item)
            ranked_moves = rank_market_moves(candidates, end, None)
            period_items.extend(ranked_moves["items"])
            by_id = {x["id"]: x for x in changes}
            popular = []
            for p in market["byGrade"].get(str(grade), {}).get("popular", []):
                item = {k: v for k, v in p.items() if k not in ("pv","c","fromDate","toDate")}
                if p["id"] in by_id:
                    item.update({k: v for k, v in by_id[p["id"]].items() if k in ("v","pv","c","d","u","fromDate","toDate")})
                popular.append(item)
            buckets[str(grade)] = {**{key: value for key, value in ranked_moves.items()
                                      if key != "items"}, "popular": popular}
            if grade == 1:
                vals = sorted(x["c"] for x in index_changes)
                sample = len(vals)
                index_sample = sample
                if sample >= minimum:
                    index = {"median": round((vals[(sample-1)//2]+vals[sample//2])/2,1),
                             "n": sample, "up": sum(v>0 for v in vals), "down": sum(v<0 for v in vals)}
        # The per-grade ranker computes the composite score, while these rank
        # numbers are assigned once across every grade so each sort represents
        # the full valid candidate pool before season/grade UI filtering.
        for direction in (1, -1):
            directed = [item for item in period_items if item["d"] * direction > 0]
            orders = {
                "rp": sorted(directed, key=lambda item: (-abs(item["d"]/item["pv"]), -abs(item["d"]),
                                                          -int(item.get("g") or 0), item["id"])),
                "rd": sorted(directed, key=lambda item: (-abs(item["d"]), -abs(item["d"]/item["pv"]),
                                                          -int(item.get("g") or 0), item["id"])),
                "ri": sorted((item for item in directed if item["impact"] is not None),
                             key=lambda item: (-item["impact"], -abs(item["d"]), -abs(item["c"]),
                                               -int(item.get("g") or 0), item["id"])),
            }
            for key, ordered in orders.items():
                for rank, item in enumerate(ordered, 1):
                    item[key] = rank
        integrated = merge_market_moves(buckets, top=10, max_per_card=2)
        default_sort = "impact" if integrated["risers"] or integrated["fallers"] else "pct"
        if default_sort == "pct":
            def fallback(direction):
                ordered = sorted((item for item in period_items if item["d"] * direction > 0),
                                 key=lambda item: (-abs(item["d"]/item["pv"]), -abs(item["d"]),
                                                   -int(item.get("g") or 0), item["id"]))
                return ordered[:10]
            integrated = {**integrated, "risers": fallback(1), "fallers": fallback(-1)}
        periods[str(days)] = {"index": index, "byGrade": buckets,
                              "risers": integrated["risers"],
                              "fallers": integrated["fallers"],
                              "popular": buckets.get("1", {}).get("popular", []),
                              "prev": start, "date": end,
                              "ready": ready, "sample": index_sample,
                              "historyDays": len([d for d in dates if start<=d<=end]),
                              "required": days+1, "defaultSort": default_sort,
                              "fallback": default_sort == "pct" and bool(period_items),
                              "totalCards": counts_by_date.get(end, len(listed)),
                              "compared": sum(bucket.get("analyzed", 0) for bucket in buckets.values()),
                              "up": sum(item["d"] > 0 for item in period_items),
                              "down": sum(item["d"] < 0 for item in period_items)}
        payloads[str(days)] = {
            "ready": ready, "date": end, "prev": start,
            "historyDays": periods[str(days)]["historyDays"], "required": days + 1,
            "totalCards": periods[str(days)]["totalCards"], "index": index,
            "defaultSort": default_sort, "fallback": periods[str(days)]["fallback"],
            "items": period_items if ready else [],
        }
    market["periods"] = periods
    market["grades"] = grades
    market["_rankPayloads"] = payloads
    return market



def squad_catalog(data_dir, out):
    """Build compact, position-specific recommendation catalogs from real snapshots.
    No external calls. Club career is a candidate eligibility, not verified activation.
    """
    positions = "GK CB LB RB CDM CM CAM LM RM LW RW ST CF LWB RWB".split()
    stat_keys = "sprintspeed acceleration finishing shotpower longshots positioning shortpassing vision crossing longpassing dribbling ballcontrol agility balance reactions marking standingtackle interceptions heading strength stamina gkdiving gkhandling gkreflexes gkpositioning jumping curve aggression composure slidingtackle gkkicking volleys penalties freekick".split()
    def norm(x):
        return re.sub(r"[\s·.\-]", "", str(x or "")).casefold()
    raw = _load(data_dir / "teamcolor/teamcolors.json") or {}
    teams = raw if isinstance(raw, list) else raw.get("items", [])
    clubs, nations, club_ids, nation_ids, eligible = {}, {}, {}, {}, {}
    for t in teams:
        kind = t.get("type")
        if kind not in ("club", "nation") or not t.get("name") or not t.get("id"):
            continue
        tid = int(t["id"])
        eligible[tid] = {"id": tid, "name": t["name"], "kind": kind}
        target = clubs if kind == "club" else nations
        for name in [t["name"], *(t.get("aliases") or [])]:
            if norm(name):
                target.setdefault(norm(name), set()).add(tid)
        key = t.get("clubId" if kind == "club" else "nationId")
        if key:
            (club_ids if kind == "club" else nation_ids).setdefault(str(key), set()).add(tid)
    seasons, restricted = {}, set()
    for s in _load(data_dir / "meta/seasonid.json") or []:
        label = str(s.get("className") or "")
        if "제한" in label or "bound" in label.lower():
            restricted.add(str(s.get("seasonId")))
        m = re.fullmatch(r"(.*?)\s*\((.*)\)", label)
        names = [label, m.group(1), m.group(2)] if m else [label]
        seasons[str(s.get("seasonId"))] = set().union(*(clubs.get(norm(x), set()) for x in names))
    by_pos = {p: [] for p in positions}
    counts = {}
    dates = set()
    for shard in range(200):
        listed = _load(data_dir / "list" / f"{shard}.json") or {}
        detail = _load(data_dir / "detail" / f"{shard}.json") or {}
        for key, l in listed.items():
            if not isinstance(l, dict):
                continue
            try:
                spid = int(key)
                pay = int(l.get("pay") or (detail.get(key) or {}).get("pay") or 0)
            except (TypeError, ValueError):
                continue
            if spid <= 0 or str(spid // 1000000) in restricted or not 0 < pay <= 100:
                continue
            prices = [v if type(v) is int and 0 < v <= 9007199254740991 else None for v in (l.get("price") or [])[:13]]
            if not any(prices):
                continue
            d = detail.get(key) or {}
            name = l.get("name") or d.get("name")
            if not name:
                continue
            ids = set(seasons.get(str(spid // 1000000), set()))
            ids |= club_ids.get(str(d.get("teamId")), set()) | nation_ids.get(str(d.get("nationId")), set())
            ids |= nations.get(norm(str(d.get("nation") or "").split(",")[0]), set())
            for club in d.get("clubs") or []:
                if isinstance(club, list) and len(club) > 1:
                    ids |= clubs.get(norm(club[1]), set())
            for tid in ids:
                counts[tid] = counts.get(tid, 0) + 1
            foot = d.get("foot") or l.get("foot") or {}
            weak = min(foot.get("l") or 0, foot.get("r") or 0) or None
            stats = d.get("stats") or {}
            sv = [stats.get(k) if type(stats.get(k)) is int else None for k in stat_keys]
            at = str(l.get("at") or "")
            if at:
                dates.add(at[:10])
            seen = set()
            for p in (l.get("pos") or d.get("pos") or []):
                if not isinstance(p, list) or len(p) < 2 or p[0] not in by_pos or p[0] in seen or type(p[1]) is not int or p[1] <= 0:
                    continue
                seen.add(p[0])
                traits = [str(t[0] if isinstance(t, list) and t else t) for t in (d.get("traits") or []) if t]
                games = l.get("games")
                by_pos[p[0]].append([spid, name, l.get("season") or str(spid // 1000000), pay, p[1], prices, weak, sv, sorted(ids), at, games if type(games) is int and games >= 0 else None, d.get("height"), traits])
    target = out / "assets" / "squad-data"
    target.mkdir(parents=True, exist_ok=True)
    def write(name, value):
        (target / name).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for pos, rows in by_pos.items():
        write(pos + ".json", rows)
    write("bonuses.json", {"teams": teams, "adaptation": _load(data_dir / "rules/adaptation_bonus.json") or {},
                           "wave": _load(data_dir / "rules/grade_teamcolor.json") or {}})
    write("manifest.json", {"schema": 2, "stats": stat_keys, "popularity": "data-center-card-games", "positions": {p: len(r) for p, r in by_pos.items()},
                           "teams": sorted([{**t, "cards": counts.get(i, 0)} for i,t in eligible.items() if counts.get(i, 0)], key=lambda t: t["name"]),
                           "dateFrom": min(dates) if dates else None, "dateTo": max(dates) if dates else None})


def material_catalog(data_dir, out):
    """Exact collected prices, cheapest two distinct players per enhanced OVR.
    Allows excluding the target player from ordinary-material calculations.
    Market execution/availability is not established by a snapshot.
    """
    bonus = (_load(data_dir / "rules/grade_bonus.json") or {}).get("bonus")
    by_ovr, dates = {}, set()
    restricted = {str(x.get("seasonId")) for x in (_load(data_dir / "meta/seasonid.json") or [])
                  if "제한" in str(x.get("className", "")) or "bound" in str(x.get("className", "")).lower()}
    if isinstance(bonus, list) and len(bonus) >= 14 and all(type(v) is int and v >= 0 for v in bonus[:14]):
        for shard in range(200):
            for key, card in (_load(data_dir / "list" / f"{shard}.json") or {}).items():
                if not str(key).isdigit() or not isinstance(card, dict):
                    continue
                spid, base = int(key), card.get("ovr")
                if spid <= 0 or str(spid // 1000000) in restricted or type(base) is not int or base <= 0 or not card.get("name"):
                    continue
                for grade, price in enumerate((card.get("price") or [])[:13], 1):
                    if type(price) is not int or not 0 < price <= 9007199254740991:
                        continue
                    ovr = base + bonus[grade]
                    row = [spid, card["name"], grade, ovr, price]
                    choices = by_ovr.setdefault(ovr, {})
                    pid = spid % 1000000
                    if pid not in choices or price < choices[pid][4]:
                        choices[pid] = row
                if card.get("at"):
                    dates.add(str(card["at"])[:10])
    items = [row for o in sorted(by_ovr) for row in sorted(by_ovr[o].values(), key=lambda r: (r[4], r[0], r[2]))[:2]]
    target = out / "assets" / "material-data"
    target.mkdir(parents=True, exist_ok=True)
    (target / "prices.json").write_text(json.dumps({"schema": 1, "date": max(dates) if dates else None, "items": items}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    rules = _load(data_dir / "rules" / "boost_points.json") or {"schema": 1, "verified": False, "rows": []}
    (target / "rules.json").write_text(json.dumps(rules, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def configure_fun_ads(out, cfg, ver):
    """Adapt the standalone KickKick HTML at build time, preserving its game source."""
    path = out / "fun" / "index.html"
    if not path.is_file():
        return
    html = path.read_text("utf-8")
    def replace_once(old, new):
        nonlocal html
        if html.count(old) != 1:
            raise ValueError("KickKick ad integration marker missing or duplicated: " + old[:80])
        html = html.replace(old, new, 1)
    replace_once('<body>\n<div class="wrap">', '<body data-view="fun">\n<div class="wrap" data-ad-layout="public">\n'
                 '<aside class="fg-ad-rail fg-ad-left" data-ad-slot="fun-left" aria-label="광고" hidden></aside>\n'
                 '<aside class="fg-ad-rail fg-ad-right" data-ad-slot="fun-right" aria-label="광고" hidden></aside>')
    replace_once('<div class="ad" id="adBot" hidden></div>', '<div class="ad" id="adBot" hidden><aside id="funAdCenter" data-ad-slot="fun-center" aria-label="광고" hidden></aside></div>')
    start = html.index("/* =================== 광고 (구글 애드센스)")
    end = html.index("/* =================== 테마", start)
    html = html[:start] + '''/* Shared manual ad loader: no refresh on each quiz question. */
function renderAds(opt={}){
  const center=$('adBot');
  document.querySelector('.wrap').dataset.adScreen='content';
  const show=!!opt.result||!!$('app').querySelector('.hub-hero');
  center.hidden=!show;
  document.dispatchEvent(new Event('fg:ad-layout'));
}
''' + html[end:]
    replace_once("function failView(err){", "function failView(err){\n  $('adBot').hidden=true;document.querySelector('.wrap').dataset.adScreen='error';document.dispatchEvent(new Event('fg:ad-layout'));")
    config = json.dumps(cfg.get("ads", {}), ensure_ascii=True).replace("<", "\\u003c")
    replace_once("</head>", f'<link rel="stylesheet" href="/assets/css/fun-ads.css?v={ver}">\n'
                 f'<script>window.FG_AD_CONFIG={config};</script>\n'
                 f'<script defer src="/assets/js/ads.js?v={ver}"></script>\n'
                 f'<script defer src="/assets/js/traffic.js?v={ver}"></script>\n</head>')
    path.write_text(html, encoding="utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="dist")
    a = ap.parse_args(argv)
    cfg = json.loads((SITE / "config.json").read_text(encoding="utf-8"))
    site_url = cfg["SITE_URL"].rstrip("/")
    out = (ROOT / a.out) if not Path(a.out).is_absolute() else Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    # Remove obsolete generated calculator page from incremental local builds.
    (out / "calc.html").unlink(missing_ok=True)

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
    configure_fun_ads(out, cfg, ver)

    env = Environment(loader=FileSystemLoader(SITE / "templates"), undefined=StrictUndefined,
                      autoescape=False, keep_trailing_newline=True)
    data_dir = (ROOT / a.data) if not Path(a.data).is_absolute() else Path(a.data)
    squad_catalog(data_dir, out)
    material_catalog(data_dir, out)
    today = dt.datetime.now(KST).strftime("%Y-%m-%d")
    news = load_news(data_dir, today)
    market = refresh_popular_market_cards(data_dir, _load(data_dir / "market" / "summary.json"))
    market = market_period_views(data_dir, market)
    run = _load(data_dir / "run.json") or {}
    if market:
        market["collectedAt"] = run.get("at", "") if run.get("date") == market.get("date") else ""
    market_seasons = {int(s["seasonId"]): s for s in (_load(data_dir / "meta/seasonid.json") or []) if "seasonId" in s}
    market_payloads = market.pop("_rankPayloads", {}) if market else {}
    market_data_dir = out / "market-data"
    market_data_dir.mkdir(parents=True, exist_ok=True)
    for days, payload in market_payloads.items():
        (market_data_dir / f"{days}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if market and not market.get("byGrade"):
        market = None
    common = dict(news=news, market=market, market_seasons=market_seasons, SITE_URL=site_url, ver=ver, cfg=cfg, contact=cfg.get("CONTACT_EMAIL") or "",
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
               view=fname.split("/")[0] if fname in ("squad/index.html","board/index.html","mypage/index.html","admin/index.html") else "",
               bkind="press" if fname.startswith("press/") else "official")
    if (out / "fun" / "index.html").exists():
        sitemap.append(site_url + "/fun/")

    ads_client = cfg.get("ads", {}).get("adsense_client", "")
    if ads_client.startswith("ca-pub-") and ads_client[7:].isdigit():
        (out / "ads.txt").write_text(f"google.com, {ads_client[3:]}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    else:
        (out / "ads.txt").unlink(missing_ok=True)
    (out / "robots.txt").write_text(
        "User-agent: *\nDisallow: /api/\nDisallow: /user/\nDisallow: /preview/\nDisallow: /mypage/\nDisallow: /admin/\n\n"
        f"Sitemap: {site_url}/sitemap.xml\n", encoding="utf-8")
    today = dt.datetime.now(KST).strftime("%Y-%m-%d")
    urls = "".join(f"<url><loc>{u}</loc><lastmod>{today}</lastmod></url>" for u in sitemap)
    (out / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n',
        encoding="utf-8")
    # 옛 주소 호환: /index.html → /
    (out / "_redirects").write_text("/index.html / 301\n/guide/patch /patch/ 301\n/calc /sim/ 301\n/calc.html /sim/ 301\n", encoding="utf-8")

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
