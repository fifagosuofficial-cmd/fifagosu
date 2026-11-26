"""Persistent, synthetic market breadth index; never invent missing price observations."""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

from market_rank import MAX_SAFE_INTEGER

BASIS = "fg-breadth-chain-v1"
BASE = 1000.0


def load(path, default):
    try:
        return json.loads(path.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def valid(value):
    return type(value) is int and 0 < value <= MAX_SAFE_INTEGER


def new_card_dates(data):
    result = {}
    for item in (load(data / "market/new_cards.json", {}).get("items") or []):
        if item.get("id") is not None:
            result[str(item["id"])] = item.get("d")
    today = load(data / "meta/new_today.json", {})
    if today.get("date"):
        result.update({str(key): today["date"] for key in today.get("ids", [])})
    return result


def build_index(data, history=None, dates=None, listed=None, new_dates=None, minimum=30):
    data = Path(data)
    if dates is None:
        meta = load(data / "market/all_card_history_dates.json", {})
        dates = meta.get("dates", []) if meta.get("basis") == "full-list-snapshots" else []
    dates = sorted(set(dates))
    saved = load(data / "market/fg_index.json", {})
    points = list(saved.get("points", [])) if saved.get("basis") == BASIS else []
    # Published points are immutable; repeated builds never compound the same date twice.
    if points:
        last = points[-1]["date"]
    elif dates:
        last = dates[0]
        points = [{"date": last, "value": BASE, "up": None, "down": None, "sample": None}]
    else:
        return {"basis": BASIS, "points": [], "latestSnapshot": None}
    # If the preceding snapshot is no longer available, don't fabricate a bridge.
    pairs = [(a, b) for a, b in zip(dates, dates[1:]) if b > last]
    if not pairs or pairs[0][0] != last:
        return {"basis": BASIS, "points": points, "latestSnapshot": dates[-1] if dates else None}
    new_dates = new_card_dates(data) if new_dates is None else {str(k): v for k, v in new_dates.items()}
    counts = [[0, 0, 0] for _ in pairs]
    endpoints = [dt.date.fromisoformat(b) for _, b in pairs]
    def scan(rows, eligible):
        for card_id, grade_rows in rows.items():
            if eligible is not None and card_id not in eligible:
                continue
            debut = new_dates.get(str(card_id))
            try:
                debut = dt.date.fromisoformat(debut) if debut else None
            except (TypeError, ValueError):
                debut = None
            allowed = [not debut or not 0 <= (end - debut).days <= 2 for end in endpoints]
            for grade in range(1, 14):
                prices = dict(grade_rows.get(str(grade), []))
                for i, (a, b) in enumerate(pairs):
                    if not allowed[i]:
                        continue
                    first, second = prices.get(a), prices.get(b)
                    if valid(first) and valid(second):
                        counts[i][0] += second > first
                        counts[i][1] += second < first
                        counts[i][2] += 1
    if history is not None:
        scan(history, listed)
    else:
        for shard in range(200):
            scan(load(data / "market/all_card_history" / f"{shard}.json", {}),
                 load(data / "list" / f"{shard}.json", {}))
    for (a, b), (up, down, sample) in zip(pairs, counts):
        if sample < minimum:
            break
        breadth = (up - down) / (up + down) if up + down else 0
        # 100% rising/falling moves this synthetic index by +/-10%, not actual BP returns.
        value = round(points[-1]["value"] * (1 + breadth / 10), 8)
        points.append({"date": b, "value": value, "up": up, "down": down,
                       "sample": sample, "from": a})
    return {"basis": BASIS, "points": points, "latestSnapshot": dates[-1] if dates else None}


def persist(data):
    data = Path(data)
    result = build_index(data)
    if result["points"]:
        path = data / "market/fg_index.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), "utf-8")
        tmp.replace(path)
    print(f"FG INDEX: {len(result['points'])} actual snapshot points")


if __name__ == "__main__":
    persist(sys.argv[1] if len(sys.argv) > 1 else "data")
