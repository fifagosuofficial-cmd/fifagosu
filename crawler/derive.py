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
  run.json                             오늘 실행 요약

데이터센터 요청은 하나도 늘지 않아요(이미 받은 13단계 시세에서 고르기만 함).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import sys
import time
from pathlib import Path

import requests

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
DROP_GUARD = 0.8                     # 오늘 갱신 카드 수가 어제의 80% 미만이면 이력 저장 중단
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
        log(f"갱신 카드가 {prev}장 → {n_today}장으로 20% 넘게 줄어 이력 저장을 멈춰요(차단·부분 수집 의심)")
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
    summary.update(step_rules(data))
    summary.update(step_teamcolors(data, client))
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
