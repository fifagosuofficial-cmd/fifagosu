#!/usr/bin/env python3
"""FC온라인 데이터센터 카드별 시세 그래프를 최근 7일치로 보존해요."""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

KST = dt.timezone(dt.timedelta(hours=9))
SHARDS = 200
GRADES = (1, 5, 8)
MAX_CARDS = 100
RANKER_RANGE = (1, 1000)

RANKER_FORM = {
    "n1Confederation": "0", "n4LeagueId": "0", "strSeason": "", "strPosition": "",
    "n4TeamId": "0", "n4NationId": "0", "n1Strong": "1", "n1Grow": "0",
    "n1TeamColor": "0", "strOrderby": "total_ap descending", "strOrderbyDetail": "",
    "n1History": "0", "n4PlayYear": "0", "teamcolorid": "0", "strTeamColorCategory": "",
    "n4RankerMin": str(RANKER_RANGE[0]), "n4RankerMax": str(RANKER_RANGE[1]),
    "n1PlayType": "50", "n4OvrMin": "0", "n4OvrMax": "200",
    "n4SalaryMin": "4", "n4SalaryMax": "99", "n4PageNo": "1",
}


def _load(path, default):
    try:
        return json.loads(Path(path).read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def _save(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), "utf-8")
    temp.replace(path)


def _list_cards(data):
    listed = {}
    for shard in range(SHARDS):
        listed.update(_load(data / "list" / f"{shard}.json", {}))
    return listed


def _array(script, key):
    match = re.search(r'"' + re.escape(key) + r'"\s*:\s*\[(.*?)\]', script, re.S)
    if not match:
        return []
    values = []
    for quoted, plain in re.findall(r'"([^"]*)"|(-?\d+(?:\.\d+)?|null|undefined)', match.group(1)):
        raw = quoted if quoted else plain
        if raw in ("null", "undefined", ""):
            values.append(None)
        else:
            try:
                values.append(int(float(raw)))
            except ValueError:
                values.append(None)
    return values


def _chart(html, today):
    start = html.find("var json1")
    start = html.find("{", start)
    if start < 0:
        raise ValueError("가격 그래프 json1 응답을 찾지 못했어요")
    times, prices = _array(html[start:], "time"), _array(html[start:], "value")
    if not times or len(times) != len(prices):
        raise ValueError("가격 그래프 날짜·가격 배열이 올바르지 않아요")

    parsed = [re.fullmatch(r"\s*(\d{1,2})\.(\d{1,2})\s*", str(x or "")) for x in times]
    labels = [(int(m.group(1)), int(m.group(2))) for m in parsed if m]
    if not labels:
        raise ValueError("가격 그래프 날짜 형식을 읽지 못했어요")
    end_year = today.year if labels[-1] <= (today.month, today.day) else today.year - 1
    year = end_year - (1 if labels[0] > labels[-1] else 0)
    prior = None
    points = []
    for label, price in zip(times, prices):
        if not label:
            continue
        match = re.fullmatch(r"\s*(\d{1,2})\.(\d{1,2})\s*", str(label))
        if not match:
            continue
        month, day = map(int, match.groups())
        md = (month, day)
        if prior is not None and md < prior:
            year += 1
        prior = md
        try:
            day_key = dt.date(year, month, day).isoformat()
        except ValueError:
            continue
        points.append([day_key, price])

    # PlayerPriceGraph can lag today's crawl date. Keep the eight daily points spanning
    # the latest chart date and the exact date seven days before it.
    if not points:
        return []
    floor = dt.date.fromisoformat(points[-1][0]) - dt.timedelta(days=7)
    return [[d, p] for d, p in points if d >= floor.isoformat() and p is not None]


def _ranker_usage(html, data):
    soup = BeautifulSoup(html, "html.parser")
    cards = []
    for row in soup.select("div.tr"):
        if "empty" in (row.get("class") or []) or "loading" in (row.get("class") or []):
            continue
        detail = row.select_one(".btn_detail_link")
        onclick = row.get("onclick") or (detail.get("onclick") if detail else "")
        match = re.search(r"val\(['\"](\d+)['\"]\)|GetPlayerDetail\(this,\s*(\d+)", onclick)
        if not match:
            continue
        spid = int(match.group(1) or match.group(2))
        appearances = row.select_one(".td.p_at")
        uses = 0
        if appearances:
            number = re.search(r"\d[\d,]*", appearances.get_text(" ", strip=True))
            uses = int(number.group(0).replace(",", "")) if number else 0
        if uses:
            cards.append({"id": spid, "uses": uses})
    cards.sort(key=lambda x: (-x["uses"], x["id"]))
    if cards:
        _save(data / "market" / "ranker_top_usage.json", {
            "updated": dt.datetime.now(KST).isoformat(timespec="seconds"),
            "source": "FC온라인 데이터센터 선수 기록 검색",
            "rankRange": list(RANKER_RANGE), "matchType": "50", "cards": cards[:200],
        })
    return cards


def update(data, client, today=None):
    """랭커 사용 상위 100개 카드의 1·5·8강 차트를 하루 한 번 갱신해요."""
    data = Path(data)
    today = today or dt.datetime.now(KST).date()
    if isinstance(today, str):
        today = dt.date.fromisoformat(today)
    direct = []
    basis = "champion-match-sample"
    try:
        client.s.headers["Referer"] = "https://fconline.nexon.com/datacenter/PlayerStat"
        direct_html = client.post("/datacenter/PlayerRankerStatList", RANKER_FORM, timeout=90)
        direct = _ranker_usage(direct_html, data)
    except Exception as error:  # noqa: BLE001 — division-verified matches remain as a fallback
        print(f"[market-history] 상위 랭커 사용량 조회 실패: {error.__class__.__name__}", flush=True)
    listed = _list_cards(data)
    exact_usage = _load(data / "market" / "ranker_usage.json", {})
    exact_cards = [x for x in exact_usage.get("cards", []) if str(x.get("id")) in listed]
    direct = [x for x in direct if str(x.get("id")) in listed]
    if len(exact_cards) >= 30:
        ranked = exact_cards
        basis = "champion-match-sample"
    elif direct:
        ranked = direct
        basis = "official-rank-1-1000"
    else:
        ranked = exact_cards
    if not ranked:
        return {"cards": 0, "requests": 0, "status": "no-ranker-sample"}

    ranked = [x for x in ranked if str(x.get("id")) in listed and int(x.get("uses") or 0) > 0][:MAX_CARDS]
    if not ranked:
        return {"cards": 0, "requests": 0, "status": "no-listed-cards"}

    path = data / "market" / "ranker_prices.json"
    store = _load(path, {"cards": {}})
    previous = store.get("cards") or {}
    cards = {}
    requests = 0
    stopped = False
    for row in ranked:
        spid = int(row["id"])
        key = str(spid)
        item = {"uses": int(row.get("uses") or 0), "grades": {}}
        old = previous.get(key) or {}
        for grade in GRADES:
            try:
                html = client.post("/datacenter/PlayerPriceGraph",
                                   {"spid": spid, "n1strong": grade, "rd": str(requests + 1)},
                                   timeout=90)
                item["grades"][str(grade)] = _chart(html, today)
                requests += 1
                if requests % 30 == 0:
                    print(f"[market-history] 시세 그래프 {requests}회 수집", flush=True)
                day_keys = [p[0] for rows in item["grades"].values() for p in rows if p and p[0]]
                item["asOf"] = max(day_keys) if day_keys else None
                cards[key] = item
                _save(path, {"updated": dt.datetime.now(KST).isoformat(timespec="seconds"), "basis": basis,
                             "cards": {**previous, **cards}})
            except Exception as error:  # noqa: BLE001 — partial data remains usable and the next run retries
                print(f"[market-history] {spid} {grade}강 조회 중단: {error.__class__.__name__}", flush=True)
                for missing in GRADES:
                    item["grades"].setdefault(str(missing), old.get("grades", {}).get(str(missing), []))
                day_keys = [p[0] for rows in item["grades"].values() for p in rows if p and p[0]]
                item["asOf"] = max(day_keys) if day_keys else old.get("asOf")
                cards[key] = item
                stopped = True
                break
        if stopped:
            break

    # Keep only the current sample so the price history stays small in the data branch.
    final = {str(x["id"]): cards.get(str(x["id"])) or previous.get(str(x["id"]))
             for x in ranked if cards.get(str(x["id"])) or previous.get(str(x["id"]))}
    _save(path, {"updated": dt.datetime.now(KST).isoformat(timespec="seconds"),
                 "basis": basis, "cards": final})
    return {"cards": len(final), "requests": requests, "status": "partial" if stopped else "ok",
            "basis": basis}
