#!/usr/bin/env python3
"""
피파고수 데이터 수집기 (FC온라인 데이터센터 → data/*.json)

  python crawler/fgcrawl.py daily            # 매일 실행용: 시세(인기 시즌 또는 주 1회 전체) → 능력치 → 인덱스
  python crawler/fgcrawl.py list --mode hot  # 인기 시즌만 시세·OVR 갱신
  python crawler/fgcrawl.py list --mode full # 전체 시즌 시세·OVR 갱신
  python crawler/fgcrawl.py detail --max 500 # 아직 없는 카드의 세부 능력치 수집
  python crawler/fgcrawl.py index            # 사이트용 인덱스(data/index.json)만 다시 만들기

넥슨 서버에 부담을 주지 않도록 요청 사이에 기본 1.5초 쉬고(FG_DELAY), 차단 신호(403·429)가
연속으로 오면 그때까지 받은 것을 저장하고 멈춥니다. 중간에 끊겨도 다음 실행에서 이어서 받습니다.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import random
import re
import sys
import time
from pathlib import Path
from urllib.parse import parse_qsl

import requests
from bs4 import BeautifulSoup

BASE = "https://fconline.nexon.com"
META_SEASON = "https://open.api.nexon.com/static/fconline/meta/seasonid.json"
ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("FG_DATA", ROOT / "data"))
SHARDS = 200
LIST_CAP = 200          # 데이터센터 목록은 한 번에 최대 200장까지만 돌려줌
KST = dt.timezone(dt.timedelta(hours=9))

# 데이터센터 선수 검색 폼 기본값(사이트가 보내는 값 그대로)
LIST_FORM = dict(parse_qsl(
    "n8PlayerGrade1Min=0&n8PlayerGrade1Max=999900000&n1Confederation=0&n4LeagueId=0&strSeason=&strPosition="
    "&strPhysical=&preferredfoot=0&n1FootAblity=0&n1SkillMove=0&n1InterationalRep=0&n4BirthMonth=0&n4BirthDay=0"
    "&n4TeamId=0&n4NationId=0&strAbility1=&strAbility2=&strAbility3=&strTrait1=&strTrait2=&strTrait3="
    "&strTraitNon1=&strTraitNon2=&strTraitNon3=&n1Strong=1&n1Grow=0&n1TeamColor=0&strSkill1=sprintspeed"
    "&strSkill2=acceleration&strSkill3=strength&strSkill4=stamina&strSearchStatus=off&strOrderby=&teamcolorid=0"
    "&strTeamColorCategory=&n1History=0&n4PlayYear=0&IsSummaryPlayer=0&strPlayerName=&strTeamName="
    "&strNationName=&strTeamColorName=&n4OvrMin=0&n4OvrMax=200&n4SalaryMin=4&n4SalaryMax=99&n1Ability1Min=40"
    "&n1Ability1Max=200&n1Ability2Min=40&n1Ability2Max=200&n1Ability3Min=40&n1Ability3Max=200"
    "&n4BirthYearMin=1900&n4BirthYearMax=2010&n4HeightMin=140&n4HeightMax=250&n4WeightMin=40&n4WeightMax=200"
    "&n4AvgPointMin=0&n4AvgPointMax=10&n4PageNo=1",
    keep_blank_values=True))

# 세부 능력치 34개(데이터센터 표시 순서) → 저장 키
STAT_KEYS = [
    ("속력", "sprintspeed"), ("가속력", "acceleration"), ("골 결정력", "finishing"), ("슛 파워", "shotpower"),
    ("중거리 슛", "longshots"), ("위치 선정", "positioning"), ("발리슛", "volleys"), ("페널티 킥", "penalties"),
    ("짧은 패스", "shortpassing"), ("시야", "vision"), ("크로스", "crossing"), ("긴 패스", "longpassing"),
    ("프리킥", "freekick"), ("커브", "curve"), ("드리블", "dribbling"), ("볼 컨트롤", "ballcontrol"),
    ("민첩성", "agility"), ("밸런스", "balance"), ("반응 속도", "reactions"), ("대인 수비", "marking"),
    ("태클", "standingtackle"), ("가로채기", "interceptions"), ("헤더", "heading"), ("슬라이딩 태클", "slidingtackle"),
    ("몸싸움", "strength"), ("스태미너", "stamina"), ("적극성", "aggression"), ("점프", "jumping"),
    ("침착성", "composure"), ("GK 다이빙", "gkdiving"), ("GK 핸들링", "gkhandling"), ("GK 킥", "gkkicking"),
    ("GK 반응속도", "gkreflexes"), ("GK 위치 선정", "gkpositioning"),
]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def now_iso():
    return dt.datetime.now(KST).isoformat(timespec="seconds")


def to_int(s, default=None):
    if s is None:
        return default
    m = re.search(r"-?\d[\d,]*", str(s))
    return int(m.group(0).replace(",", "")) if m else default


# ---------------------------------------------------------------- HTTP

class Blocked(Exception):
    """넥슨이 차단 신호를 계속 보내면 멈추기 위한 예외"""


class Client:
    def __init__(self, delay=None):
        self.delay = float(os.environ.get("FG_DELAY", delay or 1.5))
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": os.environ.get("FG_UA", "Mozilla/5.0 (compatible; FIFAGOSU-DataBot/1.0)"),
            "X-Requested-With": "XMLHttpRequest",
            "Referer": BASE + "/datacenter",
            "Accept-Language": "ko-KR,ko;q=0.9",
        })
        self.last = 0.0
        self.count = 0
        self.bytes = 0

    def _wait(self):
        gap = self.delay + random.uniform(0, self.delay * 0.3)
        left = self.last + gap - time.time()
        if left > 0:
            time.sleep(left)
        self.last = time.time()

    def post(self, path, data, timeout=60):
        blocked = 0
        for attempt in range(5):
            self._wait()
            try:
                r = self.s.post(BASE + path, data=data, timeout=timeout)
            except requests.RequestException as e:
                log("  네트워크 오류:", e.__class__.__name__, "재시도", attempt + 1)
                time.sleep(5 * (attempt + 1))
                continue
            self.count += 1
            self.bytes += len(r.content)
            if r.status_code == 200:
                r.encoding = "utf-8"
                return r.text
            if r.status_code in (403, 429, 503):
                blocked += 1
                log(f"  차단 신호 {r.status_code} ({blocked}/3) — {30 * blocked}초 쉬고 재시도")
                if blocked >= 3:
                    raise Blocked(f"HTTP {r.status_code}")
                time.sleep(30 * blocked)
                continue
            log("  HTTP", r.status_code, "재시도", attempt + 1)
            time.sleep(3 * (attempt + 1))
        raise RuntimeError(f"{path} 요청 실패")

    def get(self, path, timeout=60):
        """GET도 POST와 같은 대기·재시도·차단 감지 규칙을 사용해요."""
        blocked = 0
        for attempt in range(5):
            self._wait()
            try:
                r = self.s.get(BASE + path, timeout=timeout)
            except requests.RequestException as e:
                log("  네트워크 오류:", e.__class__.__name__, "재시도", attempt + 1)
                time.sleep(5 * (attempt + 1))
                continue
            self.count += 1
            self.bytes += len(r.content)
            if r.status_code == 200:
                r.encoding = "utf-8"
                return r.text
            if r.status_code in (403, 429, 503):
                blocked += 1
                log(f"  차단 신호 {r.status_code} ({blocked}/3) — {30 * blocked}초 쉬고 재시도")
                if blocked >= 3:
                    raise Blocked(f"HTTP {r.status_code}")
                time.sleep(30 * blocked)
                continue
            log("  HTTP", r.status_code, "재시도", attempt + 1)
            time.sleep(3 * (attempt + 1))
        raise RuntimeError(f"{path} 요청 실패")


# ---------------------------------------------------------------- 파싱

def _foot(el):
    """'L5 - R3' (strong=주발) → {"l":5,"r":3,"main":"L"}"""
    if el is None:
        return None
    txt = el.get_text(" ", strip=True)
    m = re.search(r"L\s*(\d)\D+R\s*(\d)", txt)
    if not m:
        return None
    strong = el.find("strong")
    main = "L" if strong and strong.get_text(strip=True).startswith("L") else "R"
    return {"l": int(m.group(1)), "r": int(m.group(2)), "main": main}


def _season_key(img):
    if img is None or not img.get("src"):
        return None
    return img["src"].rsplit("/", 1)[-1].split("?")[0].rsplit(".", 1)[0]


def parse_list(html: str) -> list[dict]:
    """데이터센터 PlayerList 응답 → 카드 요약 목록(OVR·포지션·급여·주발·강화별 시세·평점)"""
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for tr in soup.select("div.tr"):
        if "empty" in (tr.get("class") or []) or "loading" in (tr.get("class") or []):
            continue
        btn = tr.select_one(".btn_preview[data-no]")
        bp = tr.select_one(".td_ar_bp")
        spid = to_int(btn["data-no"]) if btn else None
        if spid is None and bp:
            m = re.search(r"bp_(\d+)", " ".join(bp.get("class", [])))
            spid = int(m.group(1)) if m else None
        if not spid:
            continue
        name = tr.select_one(".info_top .name") or tr.select_one(".name")
        pos = []
        for p in tr.select(".info_middle .position"):
            t, v = p.select_one(".txt"), p.select("span")
            val = to_int(v[-1].get_text()) if v else None
            if t:
                pos.append([t.get_text(strip=True), val])
        pay = tr.select_one(".pay")
        ovr = None
        for td in tr.select("div.td.td_ar"):
            if td.select_one(".pay"):
                continue
            sp = td.select_one("span[class^=skillData]")
            if sp is not None and not sp.get("data-type"):
                ovr = to_int(sp.get_text())
                break
        prices = []
        for g in range(1, 14):
            s = bp.select_one(f".span_bp{g}") if bp else None
            prices.append(to_int(s.get("alt")) if s is not None and s.get("alt") else None)
        score, games = None, 0
        sc = tr.select_one(".td_ar_score")
        if sc:
            txt = sc.get_text(" ", strip=True)
            m = re.match(r"([\d.]+)", txt)
            score = float(m.group(1)) if m else None
            em = sc.find("em")
            games = to_int(em.get_text(), 0) if em else 0
        out.append({
            "spid": spid,
            "name": name.get_text(strip=True) if name else "",
            "season": _season_key(tr.select_one(".season img")),
            "ovr": ovr if ovr is not None else (pos[0][1] if pos else None),
            "pos": pos,
            "pay": to_int(pay.get_text()) if pay else None,
            "foot": _foot(tr.select_one(".foot")),
            "price": prices,
            "score": score,
            "games": games,
        })
    return out


def parse_preview(html: str, spid: int, adaptation: int = 1) -> dict | None:
    """데이터센터 PlayerPreView 응답 → 세부 정보(신체·개인기·특성·요약/세부 능력치·클럽 경력)"""
    soup = BeautifulSoup(html, "html.parser")
    stats_el = soup.select(".content_bottom li.ab")
    if not stats_el:
        return None
    labels = {}
    for li in stats_el:
        t, v = li.select_one(".txt"), li.select_one(".value")
        if t and v:
            labels.setdefault(t.get_text(strip=True), []).append(to_int(v.get_text()))
    # '드리블'은 요약(content_middle)과 세부 모두에 있어서 세부만 따로 모음
    stats, used = {}, {}
    for label, key in STAT_KEYS:
        vals = labels.get(label, [])
        i = used.get(label, 0)
        stats[key] = vals[i] if i < len(vals) else None
        used[label] = i + 1
    # 요약 능력치 6개: 필드 선수는 스피드·슛·패스…, 골키퍼는 다이빙·핸들링…이라 [이름, 값] 그대로 저장
    summary = []
    for li in soup.select(".content_middle li.ab"):
        t, v = li.select_one(".txt"), li.select_one(".value")
        if t and v:
            summary.append([t.get_text(strip=True), to_int(v.get_text())])

    def txt(sel):
        e = soup.select_one(sel)
        return e.get_text(" ", strip=True) if e else None

    pos = []
    for p in soup.select(".info_ab .position"):
        t, v = p.select_one(".txt"), p.select_one(".value")
        if t:
            pos.append([t.get_text(strip=True), to_int(v.get_text()) if v else None])
    skill = soup.select_one(".etc.skill span")
    team = soup.select_one(".playerCardInfoSort .team img")
    league = soup.select_one(".playerCardInfoSort .league img")
    nation_img = soup.select_one(".playerCardInfoSort .nation img") or soup.select_one(".etc.nation img")
    clubs = []
    for li in soup.select(".data_detail_club li"):
        y, c, r = li.select_one(".year"), li.select_one(".club"), li.select_one(".rent")
        if c:
            clubs.append([y.get_text(strip=True) if y else "", c.get_text(strip=True),
                          1 if r and r.get_text(strip=True) else 0])
    return {
        "spid": spid,
        "adaptation": max(1, min(5, int(adaptation))),
        "name": txt(".info_name .name") or txt(".name"),
        "ovr": to_int(txt(".playerCardInfoSide .ovr")),
        "pay": to_int(txt(".pay_side")),
        "pos": pos,
        "birth": (txt(".etc.birth") or "").strip() or None,
        "height": to_int(txt(".etc.height")),
        "weight": to_int(txt(".etc.weight")),
        "body": txt(".etc.physical"),
        "skill": skill.get_text(strip=True).count("★") if skill else None,
        "foot": _foot(soup.select_one(".etc.foot")),
        "rep": txt(".info_etc .etc.season"),
        "nation": txt(".etc.nation .txt"),
        "nationId": to_int(re.search(r"/(\d+)\.png", nation_img["src"]).group(1)) if nation_img and re.search(r"/(\d+)\.png", nation_img.get("src", "")) else None,
        "leagueId": to_int(re.search(r"/d(\d+)\.png", league["src"]).group(1)) if league and re.search(r"/d(\d+)\.png", league.get("src", "")) else None,
        "teamId": to_int(re.search(r"/d(\d+)\.png", team["src"]).group(1)) if team and re.search(r"/d(\d+)\.png", team.get("src", "")) else None,
        # 특성: [이름, 아이콘 번호] — 아이콘은 넥슨 CDN traits/trait_icon_{번호:02d}.png
        "traits": [[s.select_one(".desc").get_text(strip=True),
                    to_int(re.search(r"trait_icon_(\d+)", s.img["src"]).group(1)) if s.img and re.search(r"trait_icon_(\d+)", s.img.get("src", "")) else None]
                   for s in soup.select(".skill_wrap > span") if s.select_one(".desc")],
        "summary": summary,
        "stats": stats,
        "clubs": clubs,
    }


# ---------------------------------------------------------------- 저장

def shard_of(spid):
    return int(spid) % SHARDS


class Store:
    def __init__(self, root=DATA):
        self.root = Path(root)
        self.state_path = self.root / "state.json"
        self.state = self._load(self.state_path, {"seasons": {}, "full_at": None, "hot": []})
        self._shards = {"list": {}, "detail": {}}
        self._dirty = {"list": set(), "detail": set()}

    @staticmethod
    def _load(p, default):
        try:
            return json.loads(Path(p).read_text("utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return default

    def shard(self, kind, n):
        if n not in self._shards[kind]:
            self._shards[kind][n] = self._load(self.root / kind / f"{n}.json", {})
        return self._shards[kind][n]

    def all(self, kind):
        d = {}
        for n in range(SHARDS):
            d.update(self.shard(kind, n))
        return d

    def put(self, kind, rec):
        n = shard_of(rec["spid"])
        self.shard(kind, n)[str(rec["spid"])] = rec
        self._dirty[kind].add(n)

    def has(self, kind, spid):
        return str(spid) in self.shard(kind, shard_of(spid))

    def save(self):
        for kind, ns in self._dirty.items():
            (self.root / kind).mkdir(parents=True, exist_ok=True)
            for n in sorted(ns):
                p = self.root / kind / f"{n}.json"
                tmp = p.with_suffix(".tmp")
                tmp.write_text(json.dumps(self._shards[kind][n], ensure_ascii=False, separators=(",", ":")), "utf-8")
                tmp.replace(p)
            ns.clear()
        self.root.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(self.state, ensure_ascii=False, indent=1), "utf-8")


# ---------------------------------------------------------------- 수집

def fetch_seasons():
    r = requests.get(META_SEASON, timeout=30)
    r.raise_for_status()
    return [s["seasonId"] for s in r.json()]


def list_season(client, sid, deadline):
    """한 시즌을 OVR → 급여 → 출생연도 범위로 쪼개 가며 200장 제한 안에서 모두 받음"""
    got = {}
    todo = [((0, 200), (4, 99), (1900, 2010))]
    truncated = 0
    while todo:
        if time.time() > deadline:
            return got, False, truncated
        ovr, pay, by = todo.pop()
        form = dict(LIST_FORM, strSeason=f",{sid},", n4OvrMin=ovr[0], n4OvrMax=ovr[1],
                    n4SalaryMin=pay[0], n4SalaryMax=pay[1], n4BirthYearMin=by[0], n4BirthYearMax=by[1])
        rows = parse_list(client.post("/datacenter/PlayerList", form))
        if len(rows) >= LIST_CAP:
            for rng, i in ((ovr, 0), (pay, 1), (by, 2)):
                if rng[1] > rng[0]:
                    mid = (rng[0] + rng[1]) // 2
                    for half in ((rng[0], mid), (mid + 1, rng[1])):
                        parts = [ovr, pay, by]
                        parts[i] = half
                        todo.append(tuple(parts))
                    break
            else:
                truncated += 1     # 더 쪼갤 수 없음(같은 OVR·급여·출생연도 200장 이상) — 받은 만큼만 저장
                for r in rows:
                    got[r["spid"]] = r
            continue
        for r in rows:
            got[r["spid"]] = r
    return got, True, truncated


def hot_seasons(store, n):
    games = {}
    for rec in store.all("list").values():
        sid = rec["spid"] // 1_000_000
        games[sid] = games.get(sid, 0) + (rec.get("games") or 0)
    ranked = [s for s, _ in sorted(games.items(), key=lambda x: -x[1]) if games[s] > 0]
    return ranked[:n]


def cmd_list(client, store, mode, minutes, hot_n=30):
    deadline = time.time() + minutes * 60
    all_seasons = fetch_seasons()
    known = set(int(s) for s in store.state["seasons"])
    if mode == "full":
        # 전체 갱신은 하루에 다 못 끝나도 됨: 이번 회차 시작 이후 아직 갱신 안 된 시즌만 이어서 받음
        start = store.state.get("full_started") or now_iso()
        store.state["full_started"] = start
        seasons = [s for s in sorted(all_seasons, key=lambda s: store.state["seasons"].get(str(s), ""))
                   if store.state["seasons"].get(str(s), "") < start]
    else:
        new = [s for s in all_seasons if s not in known]             # 처음 보는 시즌은 항상 포함
        seasons = new + [s for s in hot_seasons(store, hot_n) if s not in new]
    log(f"시세 수집({mode}): {len(seasons)}개 시즌")
    done = 0
    for sid in seasons:
        if time.time() > deadline:
            log("시간 예산 소진 — 다음 실행에서 이어서")
            break
        got, complete, trunc = list_season(client, sid, deadline)
        stamp = now_iso()
        for rec in got.values():
            rec["at"] = stamp
            store.put("list", rec)
        if complete:
            store.state["seasons"][str(sid)] = stamp
            done += 1
        log(f"  시즌 {sid}: {len(got)}장{'' if complete else ' (중단)'}{f', 200장 초과 구간 {trunc}개' if trunc else ''}"
            f" · 누적 요청 {client.count}회 {client.bytes / 1e6:.0f}MB")
        store.save()
    if mode == "full" and done == len(seasons):
        store.state["full_at"] = now_iso()
        store.state.pop("full_started", None)
    store.state["hot"] = hot_seasons(store, hot_n)
    store.save()
    return done


def cmd_detail(client, store, max_n, minutes):
    deadline = time.time() + minutes * 60
    listed = store.all("list")
    queue = [r for k, r in listed.items() if not store.has("detail", k)]
    queue.sort(key=lambda r: (-(r.get("games") or 0), -(r["spid"] // 1_000_000)))
    log(f"능력치 수집: 대기 {len(queue)}장 중 최대 {max_n}장")
    n = 0
    for r in queue[:max_n]:
        if time.time() > deadline:
            log("시간 예산 소진 — 다음 실행에서 이어서")
            break
        html = client.post("/datacenter/PlayerPreView",
                           {"spid": r["spid"], "n1strong": 1, "n1Grow": 0, "n1TeamColor": 0})   # n1Grow=0 → 적응도 1단계
        rec = parse_preview(html, r["spid"], adaptation=1)
        if rec:
            rec["at"] = now_iso()
            store.put("detail", rec)
            n += 1
        if n and n % 100 == 0:
            store.save()
            log(f"  {n}장 저장 · 요청 {client.count}회")
    store.save()
    log(f"능력치 {n}장 수집 완료")
    return n


def fetch_traits(client):
    """데이터센터 검색 화면의 특성 목록: '예리한 감아차기' 앞에 따로 묶인 것이 신규 특성"""
    r = client.s.get(BASE + "/datacenter", timeout=60)
    r.encoding = "utf-8"
    names = []
    for m in re.finditer(r"SetAbilitySearch\('([^']+)',\s*'strTrait1'\)", r.text):
        if m.group(1) not in names:
            names.append(m.group(1))
    if "예리한 감아차기" not in names:
        return None
    cut = names.index("예리한 감아차기")
    return {"new": names[:cut], "all": names, "at": now_iso()}


def cmd_index(store):
    """사이트가 검색 결과에 OVR·급여·1강 시세를 바로 보여주도록 작은 인덱스를 만듦"""
    listed = store.all("list")
    detail_keys = set(store.all("detail").keys())
    c = {}
    for k, r in listed.items():
        p1 = r["price"][0] if r.get("price") else None
        main = r["pos"][0][0] if r.get("pos") else None
        c[k] = [r.get("ovr"), main, r.get("pay"), p1, r.get("games") or 0, 1 if k in detail_keys else 0]
    idx = {"updated": now_iso(), "fields": ["ovr", "pos", "pay", "price1", "games", "hasDetail"],
           "seasons": store.state["seasons"], "c": c}
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "index.json").write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")), "utf-8")
    log(f"인덱스: {len(c)}장")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("list"); a.add_argument("--mode", choices=["hot", "full"], default="hot")
    a.add_argument("--minutes", type=float, default=30); a.add_argument("--hot", type=int, default=30)
    d = sub.add_parser("detail"); d.add_argument("--max", type=int, default=2000); d.add_argument("--minutes", type=float, default=30)
    sub.add_parser("index")
    y = sub.add_parser("daily"); y.add_argument("--minutes", type=float, default=50)
    y.add_argument("--hot", type=int, default=30)
    args = ap.parse_args(argv)

    store = Store()
    client = Client()
    try:
        if args.cmd == "list":
            cmd_list(client, store, args.mode, args.minutes, args.hot)
        elif args.cmd == "detail":
            cmd_detail(client, store, args.max, args.minutes)
        elif args.cmd == "daily":
            full_at = store.state.get("full_at")
            stale = (store.state.get("full_started") is not None or not full_at
                     or (dt.datetime.now(KST) - dt.datetime.fromisoformat(full_at)).days >= 7)
            t0 = time.time()
            cmd_list(client, store, "hot", args.minutes * 0.3, args.hot)      # 인기 시즌 시세는 매일
            if stale:                                                         # 주 1회 전체 갱신(여러 날에 나눠 진행)
                cmd_list(client, store, "full", args.minutes * 0.4, args.hot)
            left = args.minutes - (time.time() - t0) / 60
            if left > 2:
                cmd_detail(client, store, 100000, left - 1)
        if args.cmd in ("daily", "list"):
            try:
                tr = fetch_traits(client)
                if tr:
                    (DATA / "traits.json").write_text(json.dumps(tr, ensure_ascii=False), "utf-8")
                    log(f"특성 목록: 신규 {len(tr['new'])}종 / 전체 {len(tr['all'])}종")
            except Exception as e:  # 특성 목록은 없어도 사이트가 기본값으로 동작
                log("특성 목록 갱신 실패:", e)
        if args.cmd != "index":
            log(f"요청 {client.count}회 · {client.bytes / 1e6:.1f}MB")
    except Blocked as e:
        log("넥슨 서버가 요청을 막았어요:", e, "— 받은 데이터만 저장하고 종료")
        store.save()
    cmd_index(store)
    if args.cmd == "daily":
        # 파생 데이터(메타 정적화·신규 카드 기준선·시세 이력·규칙표). 실패해도 수집 결과는 그대로 저장돼요.
        try:
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            import derive
            derive.run(DATA, client=client)
        except Exception as e:  # noqa: BLE001
            log("파생 데이터 만들기 실패:", e)


if __name__ == "__main__":
    sys.exit(main())
