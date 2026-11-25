#!/usr/bin/env python3
"""
피파고수 파생 데이터 (D1-2 · D1-3) — 수집이 끝난 data/ 로 매일 한 번 만들어요.

  python crawler/derive.py                 # 메타 정적화 + 신규 카드 기준선 + 시세 이력 + 규칙표 복사
  python crawler/derive.py --no-meta       # 넥슨 메타 다운로드 생략(테스트·오프라인)

만드는 파일 (모두 data/ 아래, data 브랜치에 함께 저장돼요)
  meta/spid.json, meta/seasonid.json   넥슨 Open API 카드·시즌 목록 사본 (사이트가 /api 대신 바로 읽음)
  meta/spid_ids.json                   신규 카드 감지 기준선 (아직 발표하지 않음)
  hist/dates.json                      이력 날짜 목록·날짜별 갱신 카드 수
  hist/{spid%200}.json                 {spid: [[1강…], [5강…], [8강…], [11강…], [13강…]]} 날짜 순서와 같은 위치
  rules/*.json                         crawler/rules/ 손 관리 규칙표 사본
  market/summary.json                  홈 '오늘의 시장': 강화별 급등·급락·인기 TOP, 시장 지수, 신규 카드
  diag/market.json, market-{0..199}.json 전적 진단: 카드별 현재 시세와 1·7·30일 등락 조회
  diag/opponent-teamcolors.json       전적 진단: 상대 카드 ID별 시즌 소속 클럽·국가 팀컬러
  reco/{GK,CB,FB,DM,CM,WM,AM,W,ST}.json 전적 진단 '대체 추천' 후보(포지션 묶음별, 그룹당 약 300KB 이하)
  run.json                             오늘 실행 요약

데이터센터 요청은 하나도 늘지 않아요(이미 받은 13단계 시세에서 고르기만 함).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import shutil
import sys
import time
from pathlib import Path

import requests

try:
    from .market_rank import MAX_SAFE_INTEGER, rank_market_moves
except ImportError:  # python crawler/derive.py 실행 경로
    from market_rank import MAX_SAFE_INTEGER, rank_market_moves

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("FG_DATA", ROOT / "data"))
RULES_SRC = Path(__file__).resolve().parent / "rules"
SHARDS = 200
KST = dt.timezone(dt.timedelta(hours=9))
META_URLS = {
    "spid": "https://open.api.nexon.com/static/fconline/meta/spid.json",
    "seasonid": "https://open.api.nexon.com/static/fconline/meta/seasonid.json",
}
GRADES = [1, 5, 8, 11, 13]          # 실사용 강화 단계 (마스터플랜 1-1 #5)
KEEP_DAYS = 90
DROP_GUARD = 0.8                     # Skip a suspicious partial legacy snapshot.
NEW_CARD_CAP = 3000                  # 하루 신규 카드가 이보다 많으면 이상으로 보고 기준선을 덮지 않음


def log(*a):
    print(time.strftime("%H:%M:%S"), "[derive]", *a, flush=True)


def load(p, default):
    try:
        return json.loads(Path(p).read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save(p, obj):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), "utf-8")
    tmp.replace(p)


def sig3(x):
    """유효숫자 3자리 반올림: 1,234,567 → 1,230,000 (이력 용량 절약, 화면 표시 단위와 같음)"""
    if not x:
        return x
    x = int(x)
    d = len(str(abs(x))) - 3
    return int(round(x, -d)) if d > 0 else x


def today_kst():
    return dt.datetime.now(KST).strftime("%Y-%m-%d")


# ---------------------------------------------------------------- 메타 정적화 + 신규 카드 기준선

def fetch_meta(get=None, tries=3):
    get = get or (lambda url: requests.get(url, timeout=60))
    out = {}
    for name, url in META_URLS.items():
        for i in range(tries):
            try:
                r = get(url)
                r.raise_for_status()
                out[name] = r.json()
                break
            except Exception as e:  # noqa: BLE001 — 네트워크·파싱 오류 모두 재시도
                log(f"메타 {name} 받기 실패({i + 1}/{tries}):", e.__class__.__name__)
                time.sleep(3 * (i + 1))
        else:
            return None
    return out


def step_meta(data, date, meta):
    """메타 사본 저장 + spid 기준선. 메타를 못 받은 날은 비교·저장을 모두 건너뜀."""
    res = {"meta": "skip", "new_cards": None}
    if meta is None:
        log("메타를 받지 못해 오늘은 신규 카드 비교를 건너뛰어요")
        return res
    save(data / "meta" / "spid.json", meta["spid"])
    save(data / "meta" / "seasonid.json", meta["seasonid"])
    ids = sorted({int(x["id"]) for x in meta["spid"]})
    base_p = data / "meta" / "spid_ids.json"
    base = load(base_p, None)
    if base is None:
        save(base_p, {"date": date, "count": len(ids), "ids": ids})
        log(f"신규 카드 기준선 처음 저장: {len(ids)}장 (오늘은 발표 안 함)")
        return {"meta": "ok", "new_cards": 0, "baseline": "created"}
    new = sorted(set(ids) - set(base["ids"]))
    res = {"meta": "ok", "new_cards": len(new)}
    if len(new) > NEW_CARD_CAP:
        log(f"신규 카드가 {len(new)}장으로 비정상적으로 많아요 — 기준선을 덮지 않아요")
        res["baseline"] = "held"
        return res
    if new:
        save(data / "meta" / "new_today.json", {"date": date, "ids": new})
    save(base_p, {"date": date, "count": len(set(base["ids"]) | set(ids)),
                  "ids": sorted(set(base["ids"]) | set(ids))})
    log(f"신규 카드 {len(new)}장 감지 (발표는 기준선 7일 이후 켜요)")
    return res


# ---------------------------------------------------------------- 시세 이력

def updated_today(data, date):
    """오늘(한국 날짜) 실제로 시세가 갱신된 카드만: {spid: [1강, 5강, 8강, 11강, 13강]}"""
    got = {}
    for n in range(SHARDS):
        for k, r in load(data / "list" / f"{n}.json", {}).items():
            if (r.get("at") or "")[:10] != date:
                continue
            p = r.get("price") or []
            got[k] = [sig3(p[g - 1]) if len(p) >= g else None for g in GRADES]
    return got


def step_history(data, date):
    hdir = data / "hist"
    meta = load(hdir / "dates.json", {"dates": [], "counts": []})
    dates, counts = meta["dates"], meta["counts"]
    today = updated_today(data, date)
    n_today = len(today)
    res = {"hist_cards": n_today, "hist": "skip"}
    if n_today == 0:
        log("오늘 갱신된 카드가 없어 이력을 저장하지 않아요")
        return res
    same_day = bool(dates) and dates[-1] == date
    prev = counts[-2] if same_day and len(counts) >= 2 else (counts[-1] if counts and not same_day else None)
    if prev and n_today < prev * DROP_GUARD:
        log(f"Partial legacy history held ({n_today} updated versus {prev} previously).")
        res["hist"] = "held"
        return res
    if same_day:
        idx = len(dates) - 1
        counts[idx] = n_today
    else:
        dates.append(date)
        counts.append(n_today)
        idx = len(dates) - 1
    drop = max(0, len(dates) - KEEP_DAYS)      # 90일 넘는 날짜는 앞에서 잘라냄 (주 1점 보관은 90일 찬 뒤 추가)
    if drop:
        del dates[:drop], counts[:drop]
        idx -= drop
    width = len(dates)

    by_shard = {}
    for k, v in today.items():
        by_shard.setdefault(int(k) % SHARDS, {})[k] = v
    max_bytes = 0
    for n in range(SHARDS):
        p = hdir / f"{n}.json"
        shard = load(p, {})
        todays = by_shard.get(n, {})
        if not shard and not todays:
            continue
        for k in set(shard) | set(todays):
            rows = shard.get(k) or [None] * len(GRADES)
            vals = todays.get(k)
            new_rows = []
            for gi in range(len(GRADES)):
                row = list(rows[gi]) if rows[gi] else [None] * (width - (0 if same_day else 1) + drop)
                if drop:
                    row = row[drop:]
                row += [None] * (width - len(row))        # 새 날짜 칸
                row = row[:width]
                row[idx] = vals[gi] if vals else (row[idx] if same_day else None)
                new_rows.append(row if any(x is not None for x in row) else None)
            if all(r is None for r in new_rows):
                shard.pop(k, None)
            else:
                shard[k] = new_rows
        save(p, shard)
        max_bytes = max(max_bytes, p.stat().st_size)
    save(hdir / "dates.json", {"dates": dates, "counts": counts, "grades": GRADES})
    res.update(hist="ok", hist_days=width, hist_max_shard_kb=round(max_bytes / 1024))
    log(f"시세 이력 저장: {date} · 카드 {n_today}장 · {width}일치 · 가장 큰 샤드 {max_bytes / 1024:.0f}KB")
    return res


# ---------------------------------------------------------------- 시장 요약 (홈 '오늘의 시장 브리핑')

MARKET_GRADES = [1, 5, 8]            # 홈에서 고를 수 있는 강화 기준 (GRADES 안의 값)
MARKET_MIN_PRICE = 5_000_000         # 이보다 싼 카드는 등락률이 튀기 쉬워 순위에서 제외
MARKET_MIN_GAMES = 10                # 거래·사용이 거의 없는 카드 제외
MARKET_TOP = 10
NEW_KEEP_DAYS = 14
MARKET_RANKER_CAP = 100              # 챔피언스 이상 공식경기 사용량 상위 카드만 가격 그래프 조회
MARKET_INDEX_MIN = 30                # 표본이 이보다 적으면 시장지수는 숨겨요
MARKET_WEEK_PRICE_MIN = 30_000      # 저가 카드의 시세 왜곡을 줄이는 비교 하한
MARKET_COMPARE_DAYS = 1             # 최신 기록일과 바로 이전 기록일을 비교
DIAG_TREND_DAYS = [1, 7, 30]        # 전적 진단 자산 표에서 보여 줄 비교 기간


def _item(k, r, v, pv):
    pos = (r.get("pos") or [[None, None]])[0]
    out = {"id": int(k), "n": r.get("name") or "", "s": int(k) // 1_000_000,
           "o": r.get("ovr") or (pos[1] if len(pos) > 1 else None), "p": pos[0], "v": v}
    if pv:
        out.update(pv=pv, c=round((v - pv) / pv * 100, 1))
    return out


def step_market_history(data, date):
    """완료된 전체 목록 스캔만 시장 비교용 일별 스냅샷으로 보관해요."""
    data = Path(data)
    market_dir = data / "market"
    card_dir = market_dir / "all_card_history"
    meta_path = market_dir / "all_card_history_dates.json"
    state = load(data / "state.json", {})
    full_at = state.get("full_at") or ""
    if state.get("full_snapshot_date") != date or full_at[:10] != date:
        log("전체 카드 스캔이 아직 끝나지 않아 시장 이력 저장을 건너뜁니다")
        return {"market_history_days": 0, "market_history_cards": 0, "market_history": "waiting-full-scan"}

    meta = load(meta_path, None)
    if not meta or meta.get("basis") != "full-list-snapshots":
        # 기존 이력은 날짜마다 다른 카드가 갱신된 부분 수집 결과라 전일 비교에 사용하지 않아요.
        meta = {"basis": "full-list-snapshots", "dates": [], "counts": []}
        log("부분 수집 시장 이력을 초기화하고 전체 스냅샷부터 다시 쌓습니다")

    dates = meta.get("dates") or []
    counts = meta.get("counts") or []
    today = updated_today(data, date)
    if not today:
        return {"market_history_days": len(dates), "market_history_cards": 0}
    if date not in dates:
        dates.append(date)
        counts.append(0)
    idx = dates.index(date)
    by_shard = {}
    for key, values in today.items():
        by_shard.setdefault(int(key) % SHARDS, {})[key] = values
    for n, rows in by_shard.items():
        path = card_dir / f"{n}.json"
        shard = load(path, {})
        for key, values in rows.items():
            grades = shard.setdefault(key, {})
            for grade in MARKET_GRADES:
                gi = GRADES.index(grade)
                value = values[gi] if len(values) > gi else None
                if value is None:
                    continue
                points = grades.setdefault(str(grade), [])
                replacement = [date, int(value)]
                if any(point[0] == date for point in points):
                    points[:] = [point for point in points if point[0] != date]
                points.append(replacement)
                points.sort(key=lambda point: point[0])
                cutoff = (dt.date.fromisoformat(date) - dt.timedelta(days=KEEP_DAYS - 1)).isoformat()
                grades[str(grade)] = [point for point in points if point[0] >= cutoff]
        save(path, shard)
    counts[idx] = len(today)
    meta["basis"] = "full-list-snapshots"
    meta["dates"] = dates[-KEEP_DAYS:]
    meta["counts"] = counts[-KEEP_DAYS:]
    save(meta_path, meta)
    return {"market_history_days": len(meta["dates"]), "market_history_cards": len(today)}


def step_diag_market(data, date):
    """전체 목록 이력만 읽어 전적 진단용 카드별 시세 등락 파일을 만들어요.

    ``diag/market-{spid % 200}.json``의 강화별 행은
    ``[현재가, 1일%, 7일%, 30일%, 실제1일, 실제7일, 실제30일]`` 순서예요.
    요청 날짜의 스냅샷이 없으면 그 이전의 가장 가까운 전체 스냅샷을 쓰고
    실제 비교 일수를 함께 기록합니다. 가격이나 비교점이 없으면 0이 아니라
    ``null``로 저장해요. 기존 이력만 읽으므로 외부 요청은 늘지 않습니다.
    """
    data = Path(data)
    meta = load(data / "market" / "all_card_history_dates.json", {})
    if meta.get("basis") != "full-list-snapshots":
        return {"diag_market": "waiting-full-scan", "diag_market_cards": 0}
    dates = sorted({x for x in (meta.get("dates") or []) if x})
    if not dates:
        return {"diag_market": "waiting-full-scan", "diag_market_cards": 0}
    as_of = dates[-1]
    as_of_date = dt.date.fromisoformat(as_of)
    out_dir = data / "diag"
    manifest_path = out_dir / "market.json"
    old_manifest = load(manifest_path, {})
    if (old_manifest.get("date") == as_of
            and old_manifest.get("requestedDays") == DIAG_TREND_DAYS
            and old_manifest.get("grades") == MARKET_GRADES):
        return {"diag_market": "skip", "diag_market_cards": old_manifest.get("cards", 0),
                "diag_market_date": as_of}

    total = 0
    written = set()
    for shard_no in range(SHARDS):
        source = load(data / "market" / "all_card_history" / f"{shard_no}.json", {})
        cards = {}
        for card_id, grade_rows in source.items():
            grade_out = []
            has_row = False
            for grade in MARKET_GRADES:
                prices = {}
                for point in (grade_rows or {}).get(str(grade), []):
                    if not isinstance(point, list) or len(point) < 2 or not point[0] or point[1] is None:
                        continue
                    try:
                        day = dt.date.fromisoformat(point[0])
                        value = int(point[1])
                    except (TypeError, ValueError):
                        continue
                    if value > 0 and day <= as_of_date:
                        prices[day] = value
                current = prices.get(as_of_date)
                if not current:
                    grade_out.append(None)
                    continue
                changes, actual_days = [], []
                price_dates = sorted(prices)
                for requested in DIAG_TREND_DAYS:
                    target = as_of_date - dt.timedelta(days=requested)
                    prior = [day for day in price_dates if day <= target]
                    if not prior:
                        changes.append(None)
                        actual_days.append(None)
                        continue
                    start = prior[-1]
                    previous = prices[start]
                    changes.append(round((current - previous) / previous * 100, 1) if previous else None)
                    actual_days.append((as_of_date - start).days)
                grade_out.append([current, *changes, *actual_days])
                has_row = True
            if has_row:
                cards[str(card_id)] = grade_out
        if cards:
            save(out_dir / f"market-{shard_no}.json", {"date": as_of, "cards": cards})
            written.add(shard_no)
            total += len(cards)

    # 예전 산출물에만 남은 샤드는 현재 카드로 오인되지 않게 비워 둬요.
    if out_dir.exists():
        for path in out_dir.glob("market-*.json"):
            try:
                shard_no = int(path.stem.split("-")[-1])
            except ValueError:
                continue
            if shard_no not in written:
                save(path, {"date": as_of, "cards": {}})

    manifest = {
        "date": as_of,
        "basis": "full-list-snapshots",
        "requestedDays": DIAG_TREND_DAYS,
        "grades": MARKET_GRADES,
        "historyDays": len(dates),
        "historyFrom": dates[0],
        "historyTo": as_of,
        "cards": total,
        "shards": SHARDS,
        "schema": "row=[price,pct1,pct7,pct30,actualDays1,actualDays7,actualDays30]",
    }
    save(manifest_path, manifest)
    log(f"전적 진단 시세 조회: {as_of} · {total}장 · {len(dates)}개 전체 스냅샷")
    return {"diag_market": "ok", "diag_market_cards": total, "diag_market_date": as_of}


def step_market(data, date):
    """시세 이력에서 오늘 등락 TOP·인기 카드·시장 지수·신규 카드를 뽑아 market/summary.json 하나로 저장.
    데이터센터 요청은 늘지 않아요(이미 저장한 list·hist만 읽음)."""
    if (Path(data) / "market" / "ranker_usage.json").exists():
        return step_ranker_market(data, date)
    hdir = data / "hist"
    meta = load(hdir / "dates.json", {"dates": []})
    dates = meta.get("dates") or []
    listed = {}
    for n in range(SHARDS):
        listed.update(load(data / "list" / f"{n}.json", {}))
    res = {"market": "skip"}
    if not listed:
        return res
    last = len(dates) - 1
    hist = {}
    if dates and dates[-1] == date:
        for n in range(SHARDS):
            hist.update(load(hdir / f"{n}.json", {}))
    by_grade = {}
    idx_pcts = []
    popular_keys = sorted(listed, key=lambda k: -(listed[k].get("games") or 0))[:300]
    for g in MARKET_GRADES:
        gi = GRADES.index(g)
        moves = []
        for k, rows in hist.items():
            row = rows[gi] if rows and len(rows) > gi else None
            if not row or len(row) <= last or not row[last]:
                continue
            prev = next((row[i] for i in range(last - 1, max(-1, last - 8), -1) if row[i]), None)
            r = listed.get(k)
            if not prev or not r:
                continue
            if row[last] < MARKET_MIN_PRICE or (r.get("games") or 0) < MARKET_MIN_GAMES:
                continue
            moves.append(_item(k, r, row[last], prev))
        moves.sort(key=lambda x: x["c"])
        risers = [x for x in reversed(moves) if x["c"] > 0][:MARKET_TOP]
        fallers = [x for x in moves if x["c"] < 0][:MARKET_TOP]
        mv = {x["id"]: x for x in moves}
        popular = []
        for k in popular_keys[:MARKET_TOP * 2]:
            r = listed[k]
            p = r.get("price") or []
            v = p[g - 1] if len(p) >= g else None
            if not v:
                continue
            popular.append(mv.get(int(k)) or _item(k, r, v, None))
            if len(popular) >= MARKET_TOP:
                break
        by_grade[str(g)] = {"risers": risers, "fallers": fallers, "popular": popular, "moved": len(moves)}
        if g == 1:
            pk = {int(k) for k in popular_keys}
            idx_pcts = [x["c"] for x in moves if x["id"] in pk]
    index = None
    if idx_pcts:
        sp = sorted(idx_pcts)
        index = {"median": sp[len(sp) // 2], "avg": round(sum(sp) / len(sp), 2), "n": len(sp),
                 "up": sum(1 for x in sp if x > 0), "down": sum(1 for x in sp if x < 0), "flat": sum(1 for x in sp if x == 0)}
    # 신규 카드: 오늘 감지분을 14일 동안 보관
    newp = data / "market" / "new_cards.json"
    keep = load(newp, {"items": []})["items"]
    today_new = load(data / "meta" / "new_today.json", {})
    if today_new.get("date") == date:
        names = {int(x["id"]): x.get("name", "") for x in load(data / "meta" / "spid.json", [])}
        have = {x["id"] for x in keep}
        for i in today_new.get("ids", []):
            if i not in have:
                r = listed.get(str(i)) or {}
                keep.append({"id": i, "n": r.get("name") or names.get(i, ""), "s": i // 1_000_000,
                             "o": r.get("ovr"), "d": date})
    cut = (dt.date.fromisoformat(date) - dt.timedelta(days=NEW_KEEP_DAYS)).isoformat()
    keep = [x for x in keep if x["d"] >= cut]
    keep.sort(key=lambda x: (x["d"], x.get("o") or 0), reverse=True)
    save(newp, {"items": keep})
    out = {"date": date, "prev": dates[-2] if len(dates) >= 2 else None, "days": len(dates),
           "grades": MARKET_GRADES, "index": index, "byGrade": by_grade,
           "newCards": keep[:24], "newCount": len(keep),
           "rule": f"{MARKET_MIN_PRICE // 10000:,}만 BP 이상·사용 {MARKET_MIN_GAMES}경기 이상 카드, 직전 기록일 대비"}
    save(data / "market" / "summary.json", out)
    # 팩 오픈 시뮬용 시세 풀: '기준가 TOP N'을 실제 선수로 바꾸려면 강화별 가격 순위가 필요해요.
    priced = [(k, r) for k, r in listed.items() if r.get("price")]
    # 팩의 '기준가 TOP N'은 (선수 × 강화) 조합 순위라서, 저강 대형 팩(예: Top Price 6530 (1강), 26PL Top Price 5500 (1~11강))까지
    # 맞추려면 시세가 있는 카드를 모두 담아야 해요. (예전엔 상위 7,000+4,000장만 담아 순위가 모자랐어요)
    keep_ids = {k for k, _ in priced}
    pool = [[int(k), listed[k].get("name") or "", listed[k].get("ovr") or 0,
             [sig3(x) if x else 0 for x in (listed[k].get("price") or [])[:13]]] for k in keep_ids]
    save(data / "market" / "pool.json", {"date": date, "items": pool})
    res = {"market": "ok", "market_moved": by_grade.get("1", {}).get("moved", 0), "market_new": len(keep)}
    log(f"시장 요약: 1강 등락 집계 {res['market_moved']}장 · 신규 카드 {len(keep)}장")
    return res


def step_ranker_market(data, date):
    """?? ?? ????? ?? ?? ???? ?????? ????? ????."""
    data = Path(data)
    listed = {}
    history = {}
    for n in range(SHARDS):
        listed.update(load(data / "list" / f"{n}.json", {}))
        history.update(load(data / "market" / "all_card_history" / f"{n}.json", {}))

    # 메인 "인기 카드"는 챔피언스/상위 랭커 표본이 아니라, 수집한 전체
    # 선수카드 목록의 사용 경기 수를 기준으로 보여 준다.
    ranked = [
        {"id": int(card_id), "uses": int(rec.get("games") or 0)}
        for card_id, rec in listed.items()
        if int(rec.get("games") or 0) > 0
    ]
    ranked.sort(key=lambda item: (-item["uses"], item["id"]))
    popular_label = "전체 카드 사용 경기 수 TOP 10 기준"

    newp = data / "market" / "new_cards.json"
    keep = load(newp, {"items": []}).get("items") or []
    today_new = load(data / "meta" / "new_today.json", {})
    new_dates = {int(item["id"]): item.get("d") for item in keep if item.get("id") is not None}
    if today_new.get("date"):
        for spid in today_new.get("ids", []):
            new_dates[int(spid)] = today_new["date"]

    history_meta = load(data / "market" / "all_card_history_dates.json", {"dates": []})
    history_dates = history_meta.get("dates") or []
    latest_history_date = min(dt.date.fromisoformat(date), dt.date.fromisoformat(history_dates[-1])) if history_dates else dt.date.fromisoformat(date)

    def compute_moves():
        """최신 기록일과 바로 이전 기록일의 공통 가격으로 등락을 계산해요."""
        moves_by_grade = {}
        index_pcts_by_grade = {g: [] for g in MARKET_GRADES}
        if len(history_dates) < 2:
            return moves_by_grade, index_pcts_by_grade, None, None

        end = latest_history_date
        earlier_dates = [dt.date.fromisoformat(day) for day in history_dates
                         if dt.date.fromisoformat(day) < end]
        if not earlier_dates:
            return moves_by_grade, index_pcts_by_grade, None, None
        start = max(earlier_dates)

        def daily(card_id, grade):
            rows = history.get(str(card_id)) or {}
            prices = {}
            for day, value in rows.get(str(grade), []):
                if not day or value is None:
                    continue
                try:
                    prices[dt.date.fromisoformat(day)] = int(value)
                except (TypeError, ValueError):
                    continue
            first, last = prices.get(start), prices.get(end)
            if not first or not last:
                return None
            observations = sum(
                type(value) is int and 0 < value <= MAX_SAFE_INTEGER
                for _, value in rows.get(str(grade), [])
            )
            return start, first, end, last, round((last - first) / first * 100, 1), observations

        for grade in MARKET_GRADES:
            display_moves = []
            candidates = []
            for key, rec in listed.items():
                change = daily(key, grade)
                if not change:
                    continue
                start, first, end, last, pct, observations = change
                item = _item(key, rec, last, first)
                item.update(c=pct, d=last - first, u=int(rec.get("games") or 0),
                            fromDate=start.isoformat(), toDate=end.isoformat())
                display_moves.append(item)
                candidates.append({"id": int(key), "first": first, "last": last,
                                   "games": int(rec.get("games") or 0),
                                   "observations": observations,
                                   "new_date": new_dates.get(int(key)), "item": item})
                if first >= MARKET_WEEK_PRICE_MIN and last >= MARKET_WEEK_PRICE_MIN:
                    index_pcts_by_grade[grade].append(pct)

            ranked_moves = rank_market_moves(candidates, end.isoformat(), MARKET_TOP)
            moves_by_grade[str(grade)] = {
                **ranked_moves, "_moves": {x["id"]: x for x in display_moves}
            }

        return moves_by_grade, index_pcts_by_grade, start, end

    by_grade, index_pcts_by_grade, start_date, as_of_date = compute_moves()
    index_pcts = index_pcts_by_grade[1]

    # 인기 목록은 공식 1:1 상위 랭커 사용량 기준을 유지해요.
    for grade in MARKET_GRADES:
        bucket = by_grade.setdefault(str(grade), {"risers": [], "fallers": [], "moved": 0, "_moves": {}})
        moved = bucket.pop("_moves", {})
        popular = []
        for ranked_card in ranked:
            card_id = int(ranked_card["id"])
            rec = listed.get(str(card_id))
            values = (rec or {}).get("price") or []
            value = values[grade - 1] if len(values) >= grade else None
            if not rec or not value:
                continue
            item = dict(moved.get(card_id) or _item(str(card_id), rec, value, None))
            item["u"] = int(ranked_card.get("uses") or 0)
            popular.append(item)
            if len(popular) >= MARKET_TOP:
                break
        bucket["popular"] = popular

    index = None
    if len(index_pcts) >= MARKET_INDEX_MIN:
        values = sorted(index_pcts)
        med = values[len(values) // 2] if len(values) % 2 else round((values[len(values) // 2 - 1] + values[len(values) // 2]) / 2, 1)
        index = {"median": med, "avg": round(sum(values) / len(values), 2), "n": len(values),
                 "up": sum(x > 0 for x in values), "down": sum(x < 0 for x in values),
                 "flat": sum(x == 0 for x in values)}

    if today_new.get("date") == date:
        names = {int(x["id"]): x.get("name", "") for x in load(data / "meta" / "spid.json", [])}
        have = {x["id"] for x in keep}
        for spid in today_new.get("ids", []):
            if spid not in have:
                rec = listed.get(str(spid)) or {}
                keep.append({"id": spid, "n": rec.get("name") or names.get(spid, ""),
                             "s": spid // 1_000_000, "o": rec.get("ovr"), "d": date})
    cutoff = (dt.date.fromisoformat(date) - dt.timedelta(days=NEW_KEEP_DAYS)).isoformat()
    keep = [x for x in keep if x.get("d", "") >= cutoff]
    keep.sort(key=lambda x: (x.get("d", ""), x.get("o") or 0), reverse=True)
    save(newp, {"items": keep})

    as_of_key = as_of_date.isoformat() if as_of_date else (history_dates[-1] if history_dates else date)
    start_key = start_date.isoformat() if start_date else None
    sample_size = len(index_pcts)
    out = {"date": as_of_key, "prev": start_key, "days": MARKET_COMPARE_DAYS,
           "grades": MARKET_GRADES, "index": index, "indexSample": sample_size,
           "indexMinimum": MARKET_INDEX_MIN, "historyDays": len(history_dates),
           "historyRequiredDays": 2, "byGrade": by_grade,
           "newCards": keep[:24], "newCount": len(keep),
           "rankLabel": "\uC804\uCCB4 \uC218\uC9D1 \uC120\uC218\uCE74\uB4DC \uAE30\uC900", "popularLabel": popular_label,
           "rule": f"\uB7AD\uD0B9: 500\uB9CC BP\u00B7\uAC00\uACA9\uB300 \uD558\uD55C\u00B7\uC0AC\uC6A9 10\uACBD\uAE30\u00B7\uAD00\uCE21 3\uD68C \uC774\uC0C1 \uC2DC\uC7A5 \uC601\uD5A5\uB3C4 \u00B7 \uC9C0\uC218: \uAE30\uC874 3\uB9CC BP \uC720\uD6A8\uD45C\uBCF8 {MARKET_INDEX_MIN}\uC7A5"}
    save(data / "market" / "summary.json", out)

    priced = [(k, r) for k, r in listed.items() if r.get("price")]
    pool = [[int(k), listed[k].get("name") or "", listed[k].get("ovr") or 0,
             [sig3(x) if x else 0 for x in (listed[k].get("price") or [])[:13]]] for k, _ in priced]
    save(data / "market" / "pool.json", {"date": date, "items": pool})
    res = {"market": "ok", "market_moved": by_grade.get("1", {}).get("moved", 0),
           "market_new": len(keep), "market_index_sample": sample_size}
    log(f"\uC77C\uAC04 \uC2DC\uC7A5 \uC694\uC57D: \uC804\uCCB4 \uC120\uC218\uCE74\uB4DC 1\uAC15 \uC720\uD6A8 \uD45C\uBCF8 {sample_size}\uC7A5 \u00B7 \uCD94\uC138 \uCE74\uB4DC {by_grade.get('1', {}).get('moved', 0)}\uC7A5 \u00B7 \uC778\uAE30 \uCE74\uB4DC \uD45C\uBCF8 {len(ranked)}\uC7A5")
    return res


# ---------------------------------------------------------------- 전적 진단 '대체 추천' 후보 (data/reco/{그룹}.json)

# 데이터센터 포지션 이름 → 진단 화면의 포지션 묶음 (crawler/rating.py 의 GROUPS 와 같은 묶음)
RECO_GROUP = {
    "GK": "GK", "SW": "CB", "CB": "CB", "RCB": "CB", "LCB": "CB",
    "RB": "FB", "LB": "FB", "RWB": "FB", "LWB": "FB",
    "CDM": "DM", "RDM": "DM", "LDM": "DM", "CM": "CM", "RCM": "CM", "LCM": "CM",
    "RM": "WM", "LM": "WM", "CAM": "AM", "RAM": "AM", "LAM": "AM",
    "RW": "W", "LW": "W", "RF": "W", "LF": "W", "ST": "ST", "RS": "ST", "LS": "ST", "CF": "ST",
}
RECO_GROUPS = ["GK", "CB", "FB", "DM", "CM", "WM", "AM", "W", "ST"]
RECO_MAX_BYTES = 450_000             # 그룹 파일 하나의 목표 크기(진단 화면에서 한 번 받는 양, gzip 약 1/3)
RECO_FIELDS = ["spid", "name", "ovr", "price", "height", "weight", "newTraits", "traits", "pay", "games", "teamcolors"]


def _tnorm(s):
    return re.sub(r"[\s·.\-]", "", str(s or "")).lower()


def reco_teamcolor_index(data):
    """소속 팀컬러(클럽·국가) 목록과 매칭표. app.js tcOptionsFor 와 같은 규칙:
    nationId·clubId(현재 팀) 일치, 또는 클럽 경력 이름·국가 이름이 팀컬러 이름과 같으면 소속."""
    raw = load(data / "teamcolor" / "teamcolors.json", {})
    items = raw if isinstance(raw, list) else (raw.get("items") or raw.get("teamcolors") or [])
    tcs = [x for x in items if str(x.get("type")) in ("club", "nation")]
    by_name, by_nat, by_club = {}, {}, {}
    for i, x in enumerate(tcs):
        for n in [x.get("name")] + list(x.get("aliases") or []):
            if n:
                by_name.setdefault(_tnorm(n), set()).add(i)
        if x.get("nationId"):
            by_nat.setdefault(int(x["nationId"]), set()).add(i)
        if x.get("clubId"):
            by_club.setdefault(int(x["clubId"]), set()).add(i)

    def of(d):
        out = set()
        nat = str(d.get("nation") or "").split(",")[0].strip()
        names = [c[1] for c in (d.get("clubs") or []) if isinstance(c, list) and len(c) > 1] + [nat]
        for n in names:
            out |= by_name.get(_tnorm(n), set()) if n else set()
        try:
            out |= by_nat.get(int(d.get("nationId") or 0), set())
            out |= by_club.get(int(d.get("teamId") or 0), set())
        except (TypeError, ValueError):
            pass
        return sorted(out)
    return [x.get("name") for x in tcs], of


def _season_years(name):
    """카드 시즌명에서 실제 연도만 보수적으로 추출해요."""
    text = str(name or "").strip()
    to_year = lambda value: int(value) + (2000 if int(value) < 100 else 0)
    ranged = re.search(r"(?<!\d)(20\d{2}|\d{2})\s*[-~/]\s*(20\d{2}|\d{2})(?!\d)", text)
    if ranged:
        start, end = to_year(ranged.group(1)), to_year(ranged.group(2))
        return list(range(min(start, end), max(start, end) + 1))
    single = re.match(r"^\s*(20\d{2}|\d{2})(?=\D|$)", text)
    return [to_year(single.group(1))] if single else []


def _club_period_contains(period, season_years):
    """`2015 ~ 2025`, `2025 ~` 형태의 경력에 카드 시즌 연도가 포함되는지 확인해요."""
    years = [int(x) for x in re.findall(r"(?<!\d)(?:19|20)\d{2}(?!\d)", str(period or ""))]
    if not years or not season_years:
        return False
    start = years[0]
    end = years[1] if len(years) > 1 else (9999 if "~" in str(period) else start)
    return any(start <= year <= end for year in season_years)


def step_opponent_teamcolors(data, date):
    """공식 팀컬러 이름과 카드 시즌·클럽 경력·국적을 연결한 추정용 매핑.
    시즌 팀컬러는 공식 명칭과 시즌 메타 명칭이 정확히 대응할 때만 추가합니다.
    클럽 경력은 적용 가능 후보이며 실제 활성 팀컬러를 의미하지 않습니다.
    """
    data = Path(data)
    raw = load(data / "teamcolor" / "teamcolors.json", {})
    items = raw if isinstance(raw, list) else (raw.get("items") or raw.get("teamcolors") or [])
    if not items:
        return {"opponent_teamcolors": "waiting-teamcolors", "opponent_teamcolor_cards": 0}

    names, kinds, name_index = [], [], {}
    def name_ix(value, kind):
        key = (_tnorm(value), kind)
        if key not in name_index:
            name_index[key] = len(names)
            names.append(value)
            kinds.append(kind)
        return name_index[key]

    season_rows = load(data / "meta" / "seasonid.json", [])
    season_by_id, season_tc_ids = {}, set()
    for row in season_rows:
        if row.get("seasonId") is None:
            continue
        label = str(row.get("className") or "")
        m = re.fullmatch(r"(.*?)\s*\((.*)\)", label)
        labels = {_tnorm(x) for x in ([label, m.group(1), m.group(2)] if m else [label]) if x}
        matches = [tc for tc in items if tc.get("name") and tc.get("type") in ("club", "special")
                   and _tnorm(tc["name"]) in labels]
        if not matches:
            continue
        # 공식 클럽형/스페셜형에 같은 시즌 이름이 중복되면 하나로 통합.
        official = sorted(matches, key=lambda tc: (tc.get("type") != "club", tc["name"]))[0]
        ix = name_ix(official["name"], "season")
        season_by_id[str(row["seasonId"])] = ix
        season_tc_ids.update(_tnorm(tc["name"]) for tc in matches)

    by_club_id, by_nation_id, club_by_name, nation_by_name = {}, {}, {}, {}
    for tc in items:
        kind = str(tc.get("type"))
        if not tc.get("name") or kind not in ("club", "nation"):
            continue
        if kind == "club" and _tnorm(tc["name"]) in season_tc_ids:
            continue
        ix = name_ix(str(tc["name"]), kind)
        target = club_by_name if kind == "club" else nation_by_name
        for value in [tc.get("name"), *(tc.get("aliases") or [])]:
            if value:
                target.setdefault(_tnorm(value), set()).add(ix)
        try:
            ident = int(tc.get("clubId" if kind == "club" else "nationId") or 0)
        except (TypeError, ValueError):
            ident = 0
        if ident:
            (by_club_id if kind == "club" else by_nation_id).setdefault(ident, set()).add(ix)

    cards = {}
    stats = {"detail": 0, "mapped": 0, "clubExact": 0, "clubCareer": 0, "seasonMatched": len(season_by_id)}
    for shard_no in range(SHARDS):
        for card_id, detail in load(data / "detail" / f"{shard_no}.json", {}).items():
            if not isinstance(detail, dict) or not detail:
                continue
            stats["detail"] += 1
            mapped = set()
            for key, index in [("nationId", by_nation_id), ("teamId", by_club_id)]:
                try:
                    found = index.get(int(detail.get(key) or 0), set())
                except (TypeError, ValueError):
                    found = set()
                mapped |= found
                if key == "teamId" and found:
                    stats["clubExact"] += 1
            nation = str(detail.get("nation") or "").split(",")[0].strip()
            if nation:
                mapped |= nation_by_name.get(_tnorm(nation), set())
            career = set()
            for club in detail.get("clubs") or []:
                if isinstance(club, list) and len(club) > 1:
                    career |= club_by_name.get(_tnorm(club[1]), set())
            if career:
                stats["clubCareer"] += 1
                mapped |= career
            if mapped:
                cards[str(card_id)] = sorted(mapped)
                stats["mapped"] += 1

    out = {"date": date, "basis": "official-names+card-season+club-career+nation-v2",
           "names": names, "kinds": kinds, "seasonById": season_by_id, "cards": cards, "stats": stats}
    save(data / "diag" / "opponent-teamcolors.json", out)
    log(f"상대 팀컬러 매핑: 상세 {stats['detail']}장 · 매핑 {stats['mapped']}장 · 시즌 {len(season_by_id)}개")
    return {"opponent_teamcolors": "ok", "opponent_teamcolor_cards": stats["mapped"]}


def pcode(v):
    """시세를 유효숫자 3자리 정수 코드로: 지수×1000 + 가수 (124,000,000 → 6124, 1,290 → 1129). 0은 0.
    화면에서 (c % 1000) × 10^(c // 1000) 으로 되돌려요."""
    if not v or v <= 0:
        return 0
    v = sig3(int(v))
    e = 0
    while v >= 1000:
        v //= 10
        e += 1
    return e * 1000 + v


def pdecode(c):
    return (c % 1000) * 10 ** (c // 1000) if c else 0


def step_reco(data, max_bytes=None):
    """data/list(시세·포지션별 OVR) + data/detail(키·몸무게·특성)로 포지션 묶음별 대체 추천 후보를 만들어요.
    - 시세가 있는 카드만. 그룹 OVR = 그 카드의 포지션별 OVR 중 그 묶음 포지션의 최댓값
    - 파일이 너무 커지지 않게 1강 시세 구간(1/4 자릿수)마다 그룹 OVR 상위 N장만 남김 → 싼 카드 쓰는 사람도 같은 가격대 후보가 있어요
    데이터센터 요청은 늘지 않아요."""
    max_bytes = max_bytes or RECO_MAX_BYTES
    listed, detail = {}, {}
    for n in range(SHARDS):
        listed.update(load(data / "list" / f"{n}.json", {}))
        detail.update(load(data / "detail" / f"{n}.json", {}))
    res = {"reco": "skip"}
    if not listed:
        return res
    new_set = set(load(data / "traits.json", {}).get("new") or [])
    tc_names, tc_of = reco_teamcolor_index(data)
    traits, tix = [], {}

    def trait_ids(lst):
        out = []
        for t in lst or []:
            name, icon = (t[0], t[1] if len(t) > 1 else None) if isinstance(t, list) else (t, None)
            if name not in tix:
                tix[name] = len(traits)
                traits.append([name, icon, 1 if name in new_set else 0])
            out.append(tix[name])
        return out

    by_group = {g: [] for g in RECO_GROUPS}
    for k, r in listed.items():
        price = r.get("price") or []
        if not price or not price[0]:
            continue
        best = {}
        for p in r.get("pos") or []:
            g = RECO_GROUP.get(p[0]) if p else None
            if g and len(p) > 1 and p[1]:
                best[g] = max(best.get(g, 0), int(p[1]))
        if not best:
            continue
        d = detail.get(k) or {}
        tid = trait_ids(d.get("traits"))
        new_n = sum(1 for i in tid if traits[i][2])
        for g, ovr in best.items():
            by_group[g].append([int(k), r.get("name") or d.get("name") or "", ovr,
                                [pcode(x) for x in price[:13]] + [0] * max(0, 13 - len(price)),
                                int(d.get("height") or 0), int(d.get("weight") or 0), new_n, tid,
                                int(r.get("pay") or d.get("pay") or 0), int(r.get("games") or 0), tc_of(d)])
    out_dir = data / "reco"
    sizes = {}
    for g, rows in by_group.items():
        buckets = {}
        for row in rows:
            p1 = pdecode(row[3][0])
            b = int(math.log10(p1) * 4) if p1 > 0 else 0
            buckets.setdefault(b, []).append(row)
        for lst in buckets.values():
            lst.sort(key=lambda x: (-x[2], -(1 if x[4] else 0), -x[9], x[0]))

        def build(n):
            items = [x for lst in buckets.values() for x in lst[:n]]
            items.sort(key=lambda x: (-x[2], x[0]))
            used = sorted({i for x in items for i in x[7]})
            remap = {o: i for i, o in enumerate(used)}
            items = [x[:7] + [[remap[i] for i in x[7]]] + x[8:] for x in items]
            tused = sorted({i for x in items for i in x[10]})
            tmap = {o: i for i, o in enumerate(tused)}
            items = [x[:10] + [[tmap[i] for i in x[10]]] for x in items]
            obj = {"g": g, "updated": dt.datetime.now(KST).isoformat(timespec="seconds"), "fields": RECO_FIELDS,
                   "price": "code: (c%1000)*10**(c//1000), 1~13강", "traits": [traits[i] for i in used],
                   "teamcolors": [tc_names[i] for i in tused], "total": len(rows), "items": items}
            return obj, len(json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))

        longest = max((len(v) for v in buckets.values()), default=0)
        obj, size = build(longest)
        if size > max_bytes:                  # 구간당 장수를 이분 탐색으로 줄여 목표 크기에 맞춤
            lo, hi = 1, longest
            while lo < hi:
                mid = (lo + hi + 1) // 2
                if build(mid)[1] <= max_bytes - 64:   # perBucket 표시 자리
                    lo = mid
                else:
                    hi = mid - 1
            obj, size = build(lo)
            obj["perBucket"] = lo
        save(out_dir / f"{g}.json", obj)
        sizes[g] = [len(obj["items"]), round(size / 1024)]
    res = {"reco": "ok", "reco_groups": sizes}
    log("대체 추천 후보:", " · ".join(f"{g} {v[0]}장 {v[1]}KB" for g, v in sizes.items()))
    return res


# ---------------------------------------------------------------- 규칙표 복사

def step_rules(data, src=RULES_SRC):
    dst = data / "rules"
    dst.mkdir(parents=True, exist_ok=True)
    files = sorted(src.glob("*.json")) if src.exists() else []
    for f in files:
        shutil.copy2(f, dst / f.name)
    return {"rules": len(files)}


# ---------------------------------------------------------------- 실행

def step_teamcolors(data, client=None):
    """공식 팀컬러 전체 목록을 하루 1회 갱신해요. 문제면 기존 데이터는 유지합니다."""
    if client is None:
        return {"teamcolors_status": "skip"}
    try:
        import teamcolor
        p = Path(data) / "teamcolor" / "teamcolors.json"
        old = load(p, {})
        result = teamcolor.collect(client, data, old)
        log(f"공식 팀컬러 목록 갱신: {result['teamcolors']}건")
        return result
    except Exception as e:  # 파생 수집 실패는 기존 일일 선수 수집을 훼손하지 않아요.
        log("팀컬러 목록 갱신 실패(기존 파일 유지):", e.__class__.__name__, str(e)[:180])
        return {"teamcolors_status": "held", "teamcolors_error": e.__class__.__name__}


def run(data=DATA, date=None, meta_get=None, no_meta=False, client=None):
    data = Path(data)
    date = date or today_kst()
    summary = {"date": date, "at": dt.datetime.now(KST).isoformat(timespec="seconds")}
    summary.update(step_meta(data, date, None if no_meta else fetch_meta(meta_get)))
    summary.update(step_history(data, date))
    try:
        market_history = step_market_history(data, date)
        summary.update(market_history)
    except Exception as e:
        log("All-card market history save failed:", e.__class__.__name__, str(e)[:180])
        summary["market_history"] = "error"
    try:
        summary.update(step_diag_market(data, date))
    except Exception as e:  # 진단용 조회 파일 실패가 기존 시장 데이터 저장을 막지 않게
        log("전적 진단 시세 조회 생성 실패:", e.__class__.__name__, str(e)[:180])
        summary["diag_market"] = "error"
    if summary.get("market_history") == "waiting-full-scan":
        summary["market"] = "waiting-full-scan"
    else:
        try:
            summary.update(step_market(data, date))
        except Exception as e:  # 홈 요약 실패가 수집 저장을 막지 않게
            log("시장 요약 실패:", e.__class__.__name__, str(e)[:180])
            summary["market"] = "error"
    try:
        summary.update(step_reco(data))
    except Exception as e:  # 추천 후보 실패도 수집 저장을 막지 않게(이전 파일 유지)
        log("대체 추천 후보 실패:", e.__class__.__name__, str(e)[:180])
        summary["reco"] = "error"
    summary.update(step_rules(data))
    summary.update(step_teamcolors(data, client))
    try:
        summary.update(step_opponent_teamcolors(data, date))
    except Exception as e:  # 상대 팀컬러 파생 실패가 기존 수집·배포를 막지 않게
        log("상대 팀컬러 매핑 생성 실패:", e.__class__.__name__, str(e)[:180])
        summary["opponent_teamcolors"] = "error"
    if client is not None:
        try:
            import verify_adaptation
            summary.update(verify_adaptation.verify(client, data))
        except Exception as e:  # 적응도 검증 오류는 데이터 수집 성공에 영향을 주지 않아요.
            log("적응도 검증 실패:", e.__class__.__name__, str(e)[:180])
            summary["adaptation_probe"] = "error"
    save(data / "run.json", summary)
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as f:
            f.write("### 피파고수 파생 데이터\n\n| 항목 | 값 |\n|---|---|\n")
            for k, v in summary.items():
                f.write(f"| {k} | {v} |\n")
    return summary


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default=str(DATA))
    ap.add_argument("--date", help="테스트용 날짜(YYYY-MM-DD, 기본 오늘 한국 날짜)")
    ap.add_argument("--no-meta", action="store_true")
    a = ap.parse_args(argv)
    print(json.dumps(run(a.data, a.date, no_meta=a.no_meta), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
