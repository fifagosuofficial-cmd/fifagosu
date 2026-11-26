#!/usr/bin/env python3
"""
피파고수 챔피언스 평균 평점 수집 — 전적 진단의 '평점 낮음(!)' 기준을 하루 1회 만들어요.

  python crawler/rating.py                         # 공개 중계(https://fifagosu.com/api)로 수집 → data/rating.json
  python crawler/rating.py --seed 닉네임 --seed 닉네임2
  python crawler/rating.py --dry-run               # 네트워크 없이 모의 응답으로 흐름만 확인(파일 저장 안 함)

넥슨 Open API 에는 '등급별 평균 평점'이 없고, 전체 경기 목록(/fconline/v1/match)도 쓸 수 없어서
'눈덩이 표본'으로 모아요.
  1) 시드 구단주의 최근 경기 상세를 받아요.
  2) 경기에 나온 상대 구단주를 후보에 넣고, 등급(division)이 가장 높은(숫자가 작은) 사람부터 다시 최근 경기를 받아요.
     → 낮은 등급에서 시작해도 높은 등급 상대 쪽으로 타고 올라가요.
  3) 경기 당시 등급이 챔피언스 이상(division ≤ 900)인 쪽의 선수 평점만 모아 포지션별 평균을 내요.
     출전하지 않은 교체(spPosition 28 또는 평점 0)·몰수 경기(matchEndType ≠ 0)는 빼고, 같은 경기는 한 번만 셉니다.
  4) 어떤 포지션 묶음의 표본이 30개보다 적으면 기준을 슈퍼 챌린지(division ≤ 1000)까지 넓히고 basis 에 표시해요.

예의: 호출 사이 0.4초 쉬고, 하루 경기 상세는 최대 400개(경기 종류별 절반)만 받아요.
중계 서버(Cloudflare Pages Functions)가 응답을 캐시해서 넥슨 서버 부담도 줄어요.
실패하거나 표본이 너무 적으면 이전 data/rating.json 을 그대로 둬요.
"""
from __future__ import annotations

import argparse
import datetime as dt
import heapq
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("FG_DATA", ROOT / "data"))
API = os.environ.get("FG_API", "https://fifagosu.com/api")
KST = dt.timezone(dt.timedelta(hours=9))
MATCH_TYPES = ("50", "52")             # 공식경기 · 감독모드
SEEDS = ["Lampard8"]
CHAMP = 900                            # 챔피언스 이상(800 슈퍼챔피언스, 900 챔피언스)
WIDE = 1000                            # 표본이 모자랄 때 넓히는 기준(슈퍼 챌린지)
MIN_N = 30                             # 그룹·포지션별 최소 표본
MAX_DETAILS = 400                      # 하루 경기 상세 상한(두 경기 종류 합)
PER_USER = 10                          # 한 구단주에게서 받는 최근 경기 수
MIN_MATCHES = 20                       # 이보다 적게 모이면 그 경기 종류는 이전 값 유지
DELAY = 0.4
SUB = 28

POS_CODE = ['GK', 'SW', 'RWB', 'RB', 'RCB', 'CB', 'LCB', 'LB', 'LWB', 'RDM', 'CDM', 'LDM', 'RM', 'RCM', 'CM', 'LCM',
            'LM', 'RAM', 'CAM', 'LAM', 'RF', 'CF', 'LF', 'RW', 'RS', 'ST', 'LS', 'LW', 'SUB']
GROUPS = {
    "GK": ["GK"], "CB": ["SW", "RCB", "CB", "LCB"], "FB": ["RB", "LB", "RWB", "LWB"],
    "DM": ["RDM", "CDM", "LDM"], "CM": ["RCM", "CM", "LCM"], "WM": ["RM", "LM"],
    "AM": ["RAM", "CAM", "LAM"], "W": ["RW", "LW", "RF", "LF"], "ST": ["RS", "ST", "LS", "CF"],
}
GROUP_OF = {POS_CODE.index(p): g for g, ps in GROUPS.items() for p in ps}


def log(*a):
    print(time.strftime("%H:%M:%S"), "[rating]", *a, flush=True)


class Budget(Exception):
    """하루 호출 상한에 닿음"""


class Api:
    """공개 중계(/api) 호출기. get 은 테스트에서 모의 함수로 바꿔 끼워요: get(path) → (status, json)"""

    def __init__(self, base=API, get=None, delay=DELAY, max_details=MAX_DETAILS, sleep=time.sleep):
        self.base = base.rstrip("/")
        self.delay = delay
        self.sleep = sleep
        self.max_details = max_details
        self.calls = 0
        self.details = 0
        self._get = get or self._http

    def _http(self, path):
        import requests
        r = requests.get(self.base + path, timeout=30,
                         headers={"User-Agent": "fifagosu-rating/1.0 (+https://fifagosu.com)"})
        try:
            body = r.json()
        except ValueError:
            body = None
        return r.status_code, body

    def get(self, path):
        for i in range(4):
            if self.calls:
                self.sleep(self.delay)
            self.calls += 1
            status, body = self._get(path)
            if status == 429:
                self.sleep(3 * (i + 1))
                continue
            if status != 200:
                raise RuntimeError(f"HTTP {status} {path.split('?')[0]}")
            return body
        raise RuntimeError("429 반복 " + path.split("?")[0])

    def ouid(self, nickname):
        from urllib.parse import quote
        try:
            return (self.get("/fconline/v1/id?nickname=" + quote(nickname)) or {}).get("ouid")
        except RuntimeError as e:
            log("닉네임 조회 실패:", nickname, e)
            return None

    def match_ids(self, ouid, mt, limit=PER_USER):
        return self.get(f"/fconline/v1/user/match?ouid={ouid}&matchtype={mt}&offset=0&limit={limit}") or []

    def match_details(self, ids, cap):
        """경기 상세를 10개씩 묶어서 받음(cap = 이번 경기 종류에서 더 받을 수 있는 개수)"""
        out = []
        ids = list(ids)[:max(0, cap)]
        for i in range(0, len(ids), 10):
            if self.details >= self.max_details:
                raise Budget()
            chunk = ids[i:i + 10][:self.max_details - self.details]
            arr = self.get("/matches?ids=" + ",".join(chunk)) or []
            self.details += len(chunk)
            out.extend(d for d in arr if d)
        return out


# Numerators and denominators are accumulated from actual completed matches.
def metric_pair(num, den=1):
    if not isinstance(num, (int, float)) or not isinstance(den, (int, float)) or num < 0 or den <= 0:
        return None
    return (num, den)


def player_metrics(st):
    return {
        "goal": metric_pair(st.get("goal")), "assist": metric_pair(st.get("assist")),
        "finish": metric_pair(st.get("goal"), st.get("shoot")),
        "pass": metric_pair(st.get("passSuccess"), st.get("passTry")),
        "dribble": metric_pair(st.get("dribbleSuccess"), st.get("dribbleTry")),
        "duel": metric_pair(st.get("ballPossesionSuccess"), st.get("ballPossesionTry")),
        "aerial": metric_pair(st.get("aerialSuccess"), st.get("aerialTry")),
        "tackle": metric_pair(st.get("tackle"), st.get("tackleTry")),
        "intercept": metric_pair(st.get("intercept")), "block": metric_pair(st.get("block")),
        "rating": metric_pair(st.get("spRating")),
    }


def side_metrics(side, opp):
    sh, osh = side.get("shoot") or {}, opp.get("shoot") or {}
    ps, df = side.get("pass") or {}, side.get("defence") or {}
    result = (side.get("matchDetail") or {}).get("matchResult")
    return {
        "goals": metric_pair(sh.get("goalTotal")), "against": metric_pair(osh.get("goalTotal")),
        "shots": metric_pair(sh.get("shootTotal")),
        "on_target": metric_pair(sh.get("effectiveShootTotal"), sh.get("shootTotal")),
        "finish": metric_pair(sh.get("goalTotal"), sh.get("shootTotal")),
        "pass": metric_pair(ps.get("passSuccess"), ps.get("passTry")),
        "through": metric_pair(ps.get("throughPassSuccess"), ps.get("throughPassTry")),
        "tackle": metric_pair(df.get("tackleSuccess"), df.get("tackleTry")),
        "block": metric_pair(df.get("blockSuccess"), df.get("blockTry")),
        "win": metric_pair(int(result == "승")) if result in ("승", "무", "패") else None,
    }


def add_metrics(store, key, metrics):
    group = store.setdefault(key, {"n": 0, "m": {}})
    group["n"] += 1
    for k, pair in metrics.items():
        if pair is None:
            continue
        v = group["m"].setdefault(k, [0, 0, 0])
        v[0] += pair[0]
        v[1] += pair[1]
        v[2] += 1


def summarize_metrics(store, min_n=30):
    return {str(key): {"n": group["n"], "metrics": {
        k: {"avg": round(v[0] / v[1], 6), "n": v[2], "den": v[1]}
        for k, v in group["m"].items() if v[1] > 0 and v[2] >= min_n
    }} for key, group in store.items() if group["n"] >= min_n}


class Agg:
    """등급 기준(≤900, ≤1000)별 포지션 평점 합계"""

    def __init__(self):
        self.s = {CHAMP: {}, WIDE: {}}
        self.game = {}
        self.roles = {}

    def add(self, basis, pos, rating):
        for b in (CHAMP, WIDE):
            if basis <= b:
                for key in (("g", GROUP_OF.get(pos)), ("p", pos)):
                    if key[1] is None:
                        continue
                    t = self.s[b].setdefault(key, [0.0, 0])
                    t[0] += rating
                    t[1] += 1

    def pick(self, key):
        for b in (CHAMP, WIDE):
            t = self.s[b].get(key)
            if t and t[1] >= MIN_N:
                return {"avg": round(t[0] / t[1], 2), "n": t[1], "basis": f"≤{b}"}
        return None

    def result(self):
        groups = {g: v for g in GROUPS if (v := self.pick(("g", g)))}
        pos = {str(p): v for p in range(SUB) if (v := self.pick(("p", p)))}
        return {"groups": groups, "pos": pos, "performance": {"groups": summarize_metrics(self.roles), "cohorts": summarize_metrics(self.game), "updated": dt.datetime.now(KST).isoformat(timespec="seconds")}}


def side_ok(side):
    md = side.get("matchDetail") or {}
    return md.get("matchEndType", 0) == 0


def add_match(agg, d):
    """경기 하나를 집계에 넣고, 다음에 방문할 (division, ouid) 후보를 돌려줌"""
    mi = d.get("matchInfo") or []
    if len(mi) != 2:
        return [], False
    nxt = [(s.get("division") or 9999, s.get("ouid")) for s in mi if s.get("ouid")]
    if not all(side_ok(s) for s in mi):
        return nxt, False
    used = False
    for i, s in enumerate(mi):
        div = s.get("division")
        if not isinstance(div, int) or div <= 0 or div >= 9999:
            continue
        metrics = side_metrics(s, mi[1-i])
        add_metrics(agg.game, str(div), metrics)
        if div <= CHAMP:
            add_metrics(agg.game, "champ", metrics)
        if div > WIDE:
            continue
        for p in s.get("player") or []:
            pos = p.get("spPosition")
            r = (p.get("status") or {}).get("spRating") or 0
            if pos is None or pos == SUB or pos < 0 or pos >= SUB or r <= 0:
                continue
            agg.add(div, pos, float(r))
            if div <= CHAMP and pos in GROUP_OF:
                add_metrics(agg.roles, GROUP_OF[pos], player_metrics(p.get("status") or {}))
            used = True
    return nxt, used


def champion_cards(d):
    """정상 종료된 공식 1:1 경기에서 챔피언스 이상(division ≤ 900)이 쓴 카드 ID."""
    mi = d.get("matchInfo") or []
    if len(mi) != 2 or not all(side_ok(s) for s in mi):
        return []
    cards = []
    for side in mi:
        div = side.get("division")
        if not div or div > CHAMP:
            continue
        for player in side.get("player") or []:
            pos, spid = player.get("spPosition"), player.get("spId")
            if pos is None or pos < 0 or pos >= SUB or not spid:
                continue
            cards.append(int(spid))
    return cards


def collect(api, mt, seeds, cap):
    """경기 종류 하나에 대해 눈덩이 표본 수집 → (Agg, 통계)"""
    agg = Agg()
    heap, queued, visited, seen = [], set(), set(), set()
    for nick in seeds:
        o = api.ouid(nick)
        if o and o not in queued:
            heapq.heappush(heap, (9998, len(queued), o))     # 시드는 등급을 몰라도 먼저 방문
            queued.add(o)
    used_matches = taken = 0
    ranker_matches = {}
    while heap and taken < cap:
        _, _, ouid = heapq.heappop(heap)
        if ouid in visited:
            continue
        visited.add(ouid)
        try:
            ids = [m for m in api.match_ids(ouid, mt) if m not in seen]
        except RuntimeError as e:
            log("경기 목록 실패:", e)
            continue
        if not ids:
            continue
        try:
            details = api.match_details(ids, cap - taken)
        except Budget:
            break
        except RuntimeError as e:
            log("경기 상세 실패:", e)
            continue
        taken += len(ids[:cap - taken])
        for d in details:
            mid = d.get("matchId")
            if not mid or mid in seen:
                continue
            seen.add(mid)
            if mt == "50":
                cards = champion_cards(d)
                if cards:
                    match_date = d.get("matchDate") or ""
                    try:
                        parsed = dt.datetime.fromisoformat(match_date.replace("Z", "+00:00"))
                        match_date = parsed.astimezone(KST).date().isoformat()
                    except (TypeError, ValueError):
                        match_date = dt.datetime.now(KST).date().isoformat()
                    ranker_matches[str(mid)] = {"date": match_date, "cards": cards}
            nxt, used = add_match(agg, d)
            used_matches += used
            for div, o in nxt:
                if o not in queued:
                    queued.add(o)
                    heapq.heappush(heap, (div, len(queued), o))
    return agg, {"users": len(visited), "matches": len(seen), "used": used_matches,
                 "ranker_matches": ranker_matches}


def save_ranker_usage(data, fresh_matches, today=None):
    """최근 7일간 챔피언스 이상 공식경기에서 실제 사용된 카드 표본을 보존해요."""
    data = Path(data)
    today = today or dt.datetime.now(KST).date().isoformat()
    path = data / "market" / "ranker_usage.json"
    try:
        previous = json.loads(path.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        previous = {}
    matches = previous.get("matches") or {}
    for mid, row in (fresh_matches or {}).items():
        matches.setdefault(str(mid), row)
    cutoff = dt.date.fromisoformat(today) - dt.timedelta(days=6)
    matches = {mid: row for mid, row in matches.items()
               if row.get("date") and dt.date.fromisoformat(row["date"]) >= cutoff}
    counts = {}
    for row in matches.values():
        for spid in row.get("cards") or []:
            key = str(spid)
            counts[key] = counts.get(key, 0) + 1
    cards = [{"id": int(spid), "uses": n} for spid, n in counts.items()]
    cards.sort(key=lambda x: (-x["uses"], x["id"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps({"updated": dt.datetime.now(KST).isoformat(timespec="seconds"),
                               "start": cutoff.isoformat(), "end": today,
                               "matches": matches, "cards": cards},
                              ensure_ascii=False, separators=(",", ":")), "utf-8")
    tmp.replace(path)
    return cards


def run(api, seeds, data=DATA, out_name="rating.json", save=True):
    data = Path(data)
    path = data / out_name
    try:
        prev = json.loads(path.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        prev = {}
    out = {"updated": dt.datetime.now(KST).isoformat(timespec="seconds"), "src": {"users": 0, "matches": 0}}
    per = max(1, api.max_details // len(MATCH_TYPES))
    changed = False
    ranker_matches = {}
    for mt in MATCH_TYPES:
        try:
            agg, st = collect(api, mt, seeds, per)
        except Exception as e:  # noqa: BLE001 — 한 종류가 실패해도 다른 종류·이전 값은 지켜요
            log(f"{mt} 수집 실패:", e.__class__.__name__, str(e)[:160])
            agg, st = None, {"users": 0, "matches": 0, "used": 0, "ranker_matches": {}}
        if mt == "50":
            ranker_matches = st.get("ranker_matches") or {}
        res = agg.result() if agg else {"groups": {}}
        if st["used"] >= MIN_MATCHES and res["groups"]:
            out[mt] = res
            out[mt]["n"] = st["used"]
            changed = True
            log(f"{mt}: 구단주 {st['users']}명 · 경기 {st['matches']}개(집계 {st['used']}) · 그룹 {len(res['groups'])}개")
        elif mt in prev:
            out[mt] = prev[mt]
            log(f"{mt}: 표본 부족({st['used']}경기) — 이전 값 유지")
        out["src"]["users"] += st["users"]
        out["src"]["matches"] += st["matches"]
    out["src"]["calls"] = api.calls
    if save:
        cards = save_ranker_usage(data, ranker_matches)
        if cards:
            log(f"챔피언스 이상 공식경기 사용 카드: {len(cards)}종 · 최근 7일")
    if not changed:
        log("새로 모은 표본이 부족해 파일을 바꾸지 않아요")
        return prev or None
    if save:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), "utf-8")
        tmp.replace(path)
        log(f"저장: {path} (호출 {api.calls}회 · 경기 상세 {api.details}개)")
    return out


# ---------------------------------------------------------------- 모의 응답(--dry-run · 테스트)

def mock_get(n_users=60, seed=7):
    """그럴듯한 가짜 중계: 구단주마다 등급이 있고, 경기마다 상대가 정해져 있어요."""
    import random
    rnd = random.Random(seed)
    users = {f"u{i:03d}": (800 if i < 5 else 900 if i < 25 else 1000 if i < 40 else 2000) for i in range(n_users)}
    form = [0, 3, 4, 6, 7, 10, 13, 15, 23, 25, 27]          # GK RB RCB LCB LB CDM RCM LCM RW ST LW
    matches = {}

    def make(mid, a, b):
        def side(o, res):
            div = users[o]
            base = 7.1 if div <= 900 else 6.8
            pl = [{"spPosition": p, "spId": 100000000 + p, "status": {"spRating": round(base + rnd.uniform(-0.6, 0.6), 1)}} for p in form]
            pl.append({"spPosition": SUB, "spId": 1, "status": {"spRating": 0}})
            return {"ouid": o, "division": div, "matchDetail": {"matchEndType": 0, "matchResult": res}, "player": pl}
        return {"matchId": mid, "matchInfo": [side(a, "승"), side(b, "패")]}

    keys = list(users)
    by_user = {u: [] for u in keys}
    for i in range(n_users * 6):
        a, b = rnd.sample(keys, 2)
        mid = f"{i:024x}"
        matches[mid] = make(mid, a, b)
        by_user[a].append(mid)
        by_user[b].append(mid)
    nick = {"Lampard8": "u030"}

    def get(path):
        from urllib.parse import parse_qs, urlparse, unquote
        u = urlparse(path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/fconline/v1/id":
            o = nick.get(unquote(q.get("nickname", "")))
            return (200, {"ouid": o}) if o else (404, {"message": "없음"})
        if u.path == "/fconline/v1/user/match":
            return 200, by_user.get(q["ouid"], [])[:int(q.get("limit", 10))]
        if u.path == "/matches":
            return 200, [matches.get(i) for i in q["ids"].split(",")]
        return 404, None
    return get


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default=API, help="공개 중계 주소 (기본 %(default)s)")
    ap.add_argument("--data", default=str(DATA))
    ap.add_argument("--seed", action="append", default=[], help="시작 닉네임(여러 번 가능). 환경변수 RATING_SEEDS(쉼표)도 읽어요")
    ap.add_argument("--max-details", type=int, default=MAX_DETAILS)
    ap.add_argument("--delay", type=float, default=DELAY)
    ap.add_argument("--dry-run", action="store_true", help="모의 응답으로 흐름만 확인(저장 안 함)")
    a = ap.parse_args(argv)
    seeds = SEEDS + a.seed + [s.strip() for s in os.environ.get("RATING_SEEDS", "").split(",") if s.strip()]
    seeds = list(dict.fromkeys(seeds))
    if a.dry_run:
        api = Api("mock", get=mock_get(), delay=0, max_details=a.max_details, sleep=lambda s: None)
        out = run(api, seeds, a.data, save=False)
        print(json.dumps(out, ensure_ascii=False, indent=1)[:1500])
        return 0
    api = Api(a.api, delay=a.delay, max_details=a.max_details)
    try:
        run(api, seeds, a.data)
    except Exception as e:  # noqa: BLE001 — 평점 기준은 없어도 사이트가 동작(이전 파일 유지)
        log("실패(이전 파일 유지):", e.__class__.__name__, str(e)[:200])
    try:
        import derive
        import fgcrawl
        import market_history
        data = Path(a.data)
        if not (data / "market" / "ranker_usage.json").exists():
            save_ranker_usage(data, {})
        market_history.update(data, fgcrawl.Client())
        derive.step_market(data, dt.datetime.now(KST).date().isoformat())
    except Exception as e:  # noqa: BLE001 — 시세 차트 오류가 평점 수집을 실패시키지 않게 해요
        log("홈 시세 차트 갱신 실패(기존 데이터 유지):", e.__class__.__name__, str(e)[:180])
    return 0


if __name__ == "__main__":
    sys.exit(main())
