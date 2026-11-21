#!/usr/bin/env python3
"""
피파고수 소식 수집기 — FC온라인 공식 소식 + 축구·게임 뉴스를 모아 data/news/ 에 저장해요.

  python crawler/news.py              # 하루 4번 GitHub Actions(news.yml)에서 실행

저작권 원칙
  - 넥슨 공지: 제목·날짜·분류 + 본문에서 핵심 줄(날짜·대상·변경점 등) 최대 10줄을 뽑아 정리, 원문 링크 필수.
  - 언론 기사: 제목 + 언론사가 RSS로 공식 배포한 요약(최대 220자) + 출처·원문 링크만. 본문·사진은 가져오지 않아요.

만드는 파일
  data/news/feed.json    {updated, items:[{id, cat, title, summary:[줄…], source, url, date, tags, kind}]}
  data/news/events.json  {updated, items:[{title, url, start, end}]}  진행 중인 넥슨 이벤트
"""
from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import html
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("FG_DATA", ROOT / "data"))
KST = dt.timezone(dt.timedelta(hours=9))
NX = "https://fconline.nexon.com"
UA = os.environ.get("FG_UA", "Mozilla/5.0 (compatible; FIFAGOSU-NewsBot/1.0; +https://fifagosu.pages.dev/about)")
KEEP = 400                 # 보관할 게시글 수
MAX_VIEWS = 15             # 한 번에 새로 읽을 넥슨 공지 본문 수
DELAY = float(os.environ.get("FG_NEWS_DELAY", 1.5))
SUMMARY_CHARS = 220

# 언론 RSS: (출처 이름, 주소, 기본 분류, 키워드 필터(정규식, 없으면 전부))
FEEDS = [
    ("인터풋볼", "https://www.interfootball.co.kr/rss/allArticle.xml", "football", None),
    ("풋볼리스트", "https://www.footballist.co.kr/rss/allArticle.xml", "football", None),
    ("경향게임스", "https://www.khgames.co.kr/rss/allArticle.xml", "fcgame", r"FC\s?온라인|피파\s?온라인|EA\s?SPORTS\s?FC|FC\s?모바일|피파"),
    ("게임톡", "https://www.gametoc.co.kr/rss/allArticle.xml", "fcgame", r"FC\s?온라인|피파\s?온라인|EA\s?SPORTS\s?FC|FC\s?모바일|피파"),
]
DOMESTIC = re.compile(r"K리그|K1|K2|한국 대표팀|대한민국 대표팀|대표팀 소집|A매치|홍명보|코리아컵|WK리그|울산|전북|포항|FC서울|수원|대구FC|광주FC|강원FC|제주|인천|대전|김천|경남FC|부천|안양")
CAT_LABEL = {"notice": "공지", "check": "점검", "update": "업데이트", "event": "이벤트",
             "fcgame": "FC온라인 기사", "world": "해외축구", "korea": "국내축구"}
SKIP_LINE = re.compile(r"^(안녕하세요|감사합니다|이용에 불편|앞으로도|항상 .*노력|많은 관심|구단주님들의 .*부탁)|[─━═\-=_]{6,}")
KEY_LINE = re.compile(r"^(■|□|▶|▷|●|◆|◇|※|★|☞|-|·|\d+\)|\d+\.|\[|【)|기간|일시|일정|대상|보상|내용|방법|변경|추가|수정|점검|출시|적용|오픈|종료|지급")


def log(*a):
    print(time.strftime("%H:%M:%S"), "[news]", *a, flush=True)


def load(p, default):
    try:
        return json.loads(Path(p).read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save(p, obj):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), "utf-8")
    tmp.replace(p)


def now_iso():
    return dt.datetime.now(KST).isoformat(timespec="seconds")


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(s or "")).strip()


def uid(url):
    return hashlib.sha1(url.encode()).hexdigest()[:12]


# ---------------------------------------------------------------- 넥슨 공식 소식

def nx_cat(sort, title):
    if sort == "점검" or "점검" in title[:20]:
        return "check"
    if sort == "이벤트":
        return "event"
    return "notice"


def parse_notice_list(text):
    """공지 목록 → [{sn, sort, title}] (상단 고정 공지 'tr notice'는 오래된 글이라 뺌)"""
    soup = BeautifulSoup(text, "html.parser")
    out = []
    for tr in soup.select(".list_wrap .tr"):
        if "notice" in (tr.get("class") or []):
            continue
        a = tr.select_one("a[href*='n4ArticleSN']")
        if not a:
            continue
        m = re.search(r"n4ArticleSN=(\d+)", a["href"], re.I)
        sort = clean(tr.select_one(".sort").get_text()) if tr.select_one(".sort") else "공지"
        title = clean(tr.select_one(".subject").get_text()) if tr.select_one(".subject") else ""
        if m and title:
            out.append({"sn": int(m.group(1)), "sort": sort, "title": title})
    return out


def summarize_lines(body_el, limit=10):
    """공지 본문 → 핵심 줄 5~10개 (취소선 내용·인사말·구분선 제외, 줄마다 최대 90자)"""
    for s in body_el.select("s, strike, del, script, style, img"):
        s.decompose()
    lines = []
    for p in body_el.find_all(["p", "li", "div", "br", "h3", "h4"]):
        if p.name == "br":
            continue
        if p.find(["p", "div", "li"]):
            continue
        t = clean(p.get_text(" "))
        if t and not SKIP_LINE.search(t) and t not in lines:
            lines.append(t)
    if not lines:
        lines = [clean(x) for x in body_el.get_text("\n").split("\n") if clean(x) and not SKIP_LINE.search(clean(x))]
    core = lambda t: re.sub(r"^(■|□|▶|▷|●|◆|◇|※|★|☞|∙|·|-|\d+\)|\d+\.)\s*", "", t)
    lines = [t for t in lines if len(core(t)) >= 9]      # '1. 이벤트 기간' 같은 제목만 있는 짧은 줄 제외
    keys = [i for i, t in enumerate(lines) if KEY_LINE.search(t)]
    pick = keys[:limit]
    if len(pick) < 5:   # 핵심 줄이 적으면 앞쪽 문장으로 채움
        pick = sorted(set(pick) | set(range(min(len(lines), limit))))[:limit]
    return [t if len(t) <= 90 else t[:88] + "…" for t in (lines[i] for i in sorted(pick))]


def parse_notice_view(text):
    soup = BeautifulSoup(text, "html.parser")
    date = soup.select_one(".view_header .date")
    body = soup.select_one(".content_body")
    d = None
    if date:
        m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", date.get_text())
        d = f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None
    return {"date": d, "summary": summarize_lines(body) if body else []}


def parse_update_list(text):
    soup = BeautifulSoup(text, "html.parser")
    out = []
    for a in soup.select(".list_wrap .tr a"):
        y, d = a.select_one(".year"), a.select_one(".day")
        sub = a.select_one(".subject")
        if not (y and d and sub):
            continue
        mm, dd = clean(d.get_text()).split(".")[:2]
        url = re.sub(r"[?&]utm_[^&]+", "", a["href"]).rstrip("?&")
        out.append({"title": clean(sub.get_text()), "url": url, "date": f"{clean(y.get_text())}-{mm.zfill(2)}-{dd.zfill(2)}"})
    return out


def parse_event_list(text):
    soup = BeautifulSoup(text, "html.parser")
    out = []
    for a in soup.select(".list_wrap .tr a"):
        st = a.select_one(".state")
        if st and "proceeding" not in (st.get("class") or []):
            continue
        sub, date = a.select_one(".subject"), a.select_one(".date")
        m = re.search(r"(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})", date.get_text() if date else "")
        if sub and m:
            url = re.sub(r"[?&]utm_[^&]+", "", a["href"]).rstrip("?&")
            out.append({"title": clean(sub.get_text()), "url": url, "start": m.group(1), "end": m.group(2)})
    return out


# ---------------------------------------------------------------- 언론 RSS

def parse_date(s):
    s = (s or "").strip()
    m = re.match(r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})", s)
    if m:
        return f"{m.group(1)}T{m.group(2)}:00+09:00"
    try:
        return email.utils.parsedate_to_datetime(s).astimezone(KST).isoformat(timespec="seconds")
    except (TypeError, ValueError):
        return None


def parse_rss(text, source, base_cat, keyword=None):
    root = ET.fromstring(text.encode("utf-8") if isinstance(text, str) else text)
    kw = re.compile(keyword) if keyword else None
    out = []
    for it in root.iter("item"):
        title = clean(it.findtext("title"))
        link = (it.findtext("link") or "").strip()
        desc = clean(re.sub(r"<[^>]+>", " ", it.findtext("description") or ""))
        desc = re.sub(r"^\[[^\]]{2,30}\]\s*([^=\s]{1,10}\s?기자=\s*)?", "", desc)   # [매체=기자] / [매체] 기자= 머리말 제거
        desc = re.sub(r"([.!?\"”’])(?=[가-힣A-Z\"“‘])", r"\1 ", desc)   # RSS가 붙여 쓴 문장 사이 띄우기
        if not title or not link or (kw and not kw.search(title + " " + desc)):
            continue
        if title.startswith("[포토]") or title.startswith("[영상]"):
            continue
        cat = base_cat
        if base_cat == "football":
            cat = "korea" if DOMESTIC.search(title) else "world"
        summary = desc if len(desc) <= SUMMARY_CHARS else desc[:SUMMARY_CHARS].rsplit(" ", 1)[0] + "…"
        out.append({"id": uid(link), "cat": cat, "kind": "press", "title": title, "summary": [summary] if summary else [],
                    "source": source, "url": link, "date": parse_date(it.findtext("pubDate"))})
    return out


# ---------------------------------------------------------------- 실행

class Http:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"})
        self.last = 0.0
        self.count = 0

    def get(self, url):
        left = self.last + DELAY - time.time()
        if left > 0:
            time.sleep(left)
        self.last = time.time()
        self.count += 1
        r = self.s.get(url, timeout=30)
        r.raise_for_status()
        r.encoding = r.encoding if r.encoding and r.encoding.lower() != "iso-8859-1" else "utf-8"
        return r.text


def merge(old, new):
    by = {x["id"]: x for x in old}
    for x in new:
        by[x["id"]] = {**by.get(x["id"], {}), **x}
    items = sorted(by.values(), key=lambda x: x.get("date") or "", reverse=True)
    return items[:KEEP]


def run(data=DATA, http=None):
    data = Path(data)
    http = http or Http()
    feed = load(data / "news" / "feed.json", {"items": []})
    known = {x["id"]: x for x in feed["items"]}
    new, errors = [], []

    # 1) 넥슨 공지: 목록 → 새 글만 본문 읽어 핵심 줄 정리
    try:
        rows = parse_notice_list(http.get(NX + "/news/notice/list"))
        todo = [r for r in rows if uid(f"{NX}/news/notice/view?n4ArticleSN={r['sn']}") not in known][:MAX_VIEWS]
        for r in rows:
            url = f"{NX}/news/notice/view?n4ArticleSN={r['sn']}"
            i = uid(url)
            if i in known:      # 이미 있는 글은 제목(갱신 표기 등)만 최신으로
                new.append({**known[i], "title": r["title"]})
                continue
            if r not in todo:
                continue
            try:
                v = parse_notice_view(http.get(url))
            except Exception as e:  # noqa: BLE001
                errors.append(f"notice {r['sn']}: {e.__class__.__name__}")
                continue
            new.append({"id": i, "cat": nx_cat(r["sort"], r["title"]), "kind": "official", "title": r["title"],
                        "summary": v["summary"], "source": "FC온라인 공식", "url": url,
                        "date": (v["date"] + "T00:00:00+09:00") if v["date"] else now_iso()})
    except Exception as e:  # noqa: BLE001
        errors.append(f"notice list: {e.__class__.__name__}")

    # 2) 업데이트 페이지(제목·날짜만, 원문은 넥슨 이벤트 페이지)
    try:
        for u in parse_update_list(http.get(NX + "/news/update/list"))[:10]:
            new.append({"id": uid(u["url"]), "cat": "update", "kind": "official", "title": u["title"],
                        "summary": [], "source": "FC온라인 공식", "url": u["url"], "date": u["date"] + "T00:00:00+09:00"})
    except Exception as e:  # noqa: BLE001
        errors.append(f"update list: {e.__class__.__name__}")

    # 3) 진행 중 이벤트
    events = None
    try:
        events = parse_event_list(http.get(NX + "/news/events/list"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"events: {e.__class__.__name__}")

    # 4) 언론 RSS
    for name, url, cat, kw in FEEDS:
        try:
            new += parse_rss(http.get(url), name, cat, kw)[:30]
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e.__class__.__name__}")

    items = merge(feed["items"], new)
    for x in items:
        x["label"] = CAT_LABEL.get(x["cat"], x["cat"])
    save(data / "news" / "feed.json", {"updated": now_iso(), "items": items})
    if events is not None:
        save(data / "news" / "events.json", {"updated": now_iso(), "items": events})
    added = len([x for x in new if x["id"] not in known])
    log(f"새 글 {added}개 · 전체 {len(items)}개 · 진행 중 이벤트 {len(events or [])}개 · 요청 {http.count}회"
        + (f" · 오류 {errors}" if errors else ""))
    return {"added": added, "total": len(items), "errors": errors}


if __name__ == "__main__":
    r = run()
    sys.exit(0)
