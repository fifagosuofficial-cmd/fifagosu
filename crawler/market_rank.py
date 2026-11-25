"""FC Online market movers ranked by practical market impact.

This module only consumes already collected card-list and history data.  It is
shared by the daily derive step and the static 1/3/7-day site build so both
surfaces apply the same eligibility and ranking rules without extra requests.
"""
from __future__ import annotations

import datetime as dt
import math


MAX_SAFE_INTEGER = 9_007_199_254_740_991
MIN_OBSERVATIONS = 3
MIN_CHANGE_PCT = 3.0
TOP_DELTA_FRACTION = 0.20
NEW_CARD_COOLDOWN_DAYS = 2


def _positive_safe_integer(value):
    return isinstance(value, int) and not isinstance(value, bool) and 0 < value <= MAX_SAFE_INTEGER


def _top_fraction_threshold(values, fraction):
    """Smallest value included in the largest ``fraction`` of a sample."""
    ordered = sorted(values, reverse=True)
    index = max(0, min(len(ordered) - 1, math.ceil(len(ordered) * fraction) - 1))
    return ordered[index]


def _percentile_rank(values, value):
    return sum(item <= value for item in values) / len(values) * 100


def _persistence(prices, direction):
    """Score whether the last two price movements continued the main move."""
    valid = [value for value in (prices or []) if _positive_safe_integer(value)][-3:]
    if len(valid) < 3:
        return 0
    movements = (valid[1] - valid[0], valid[2] - valid[1])
    return sum(movement * direction > 0 for movement in movements) * 50


def _days_since(as_of, value):
    if not value:
        return None
    try:
        return (dt.date.fromisoformat(as_of) - dt.date.fromisoformat(value)).days
    except (TypeError, ValueError):
        return None


def rank_market_moves(candidates, as_of, top=10):
    """Filter and rank signed market changes.

    Each candidate is a mapping with ``id``, ``first``, ``last`` and
    ``observations`` plus an optional ``new_date`` and ``item`` payload.  The
    returned item preserves that payload and adds the stable JSON fields used by
    the site: ``v``, ``pv``, ``c``, ``d`` and ``impact``.  Player usage is not
    an eligibility rule or ranking factor for price movers.
    """
    base = []
    for candidate in candidates:
        first, last = candidate.get("first"), candidate.get("last")
        observations = candidate.get("observations")
        if not (_positive_safe_integer(first) and _positive_safe_integer(last)):
            continue
        if not isinstance(observations, int) or observations < MIN_OBSERVATIONS:
            continue
        age = _days_since(as_of, candidate.get("new_date"))
        if age is not None and 0 <= age <= NEW_CARD_COOLDOWN_DAYS:
            continue
        try:
            card_id = int(candidate["id"])
        except (KeyError, TypeError, ValueError):
            continue
        base.append({**candidate, "id": card_id})

    if not base:
        return {"risers": [], "fallers": [], "moved": 0,
                "deltaThreshold": None, "pctThreshold": MIN_CHANGE_PCT}

    absolute_deltas = [abs(candidate["last"] - candidate["first"]) for candidate in base]
    absolute_pcts = [abs((candidate["last"] - candidate["first"]) / candidate["first"] * 100)
                     for candidate in base]
    delta_threshold = _top_fraction_threshold(absolute_deltas, TOP_DELTA_FRACTION)

    qualified = []
    for candidate in base:
        first, last = candidate["first"], candidate["last"]
        delta = last - first
        pct = delta / first * 100
        if abs(pct) < MIN_CHANGE_PCT or abs(delta) < delta_threshold:
            continue
        persistence = _persistence(candidate.get("prices"), 1 if delta > 0 else -1)
        impact = (_percentile_rank(absolute_pcts, abs(pct)) * .4
                  + _percentile_rank(absolute_deltas, abs(delta)) * .4
                  + persistence * .2)
        item = dict(candidate.get("item") or {})
        item.pop("u", None)
        item.update(id=candidate["id"], v=last, pv=first, c=round(pct, 1), d=delta,
                    impact=round(impact, 4), persistence=persistence)
        if isinstance(candidate.get("grade"), int):
            item["g"] = candidate["grade"]
        if persistence == 100:
            item["trend"] = "3일 상승세" if delta > 0 else "3일 하락세"
        elif persistence == 50:
            item["trend"] = "상승 흐름" if delta > 0 else "하락 흐름"
        else:
            item["trend"] = "등락 혼조"
        qualified.append(item)

    key = lambda item: (-item["impact"], -abs(item["d"]), -abs(item["c"]),
                        -int(item.get("g") or 0), item["id"])
    risers = sorted((item for item in qualified if item["d"] > 0), key=key)
    fallers = sorted((item for item in qualified if item["d"] < 0), key=key)
    if top is not None:
        risers, fallers = risers[:top], fallers[:top]
    return {"risers": risers, "fallers": fallers, "moved": len(qualified),
            "deltaThreshold": delta_threshold, "pctThreshold": MIN_CHANGE_PCT}


def merge_market_moves(by_grade, top=10, max_per_card=2):
    """Merge grade rankings while limiting duplicate grades of one card."""
    key = lambda item: (-item["impact"], -abs(item["d"]), -abs(item["c"]),
                        -int(item.get("g") or 0), item["id"])

    def merge(direction):
        candidates = sorted(
            (item for bucket in by_grade.values() for item in bucket.get(direction, [])),
            key=key,
        )
        counts, result = {}, []
        for item in candidates:
            card_id = item["id"]
            if counts.get(card_id, 0) >= max_per_card:
                continue
            counts[card_id] = counts.get(card_id, 0) + 1
            result.append(item)
            if len(result) >= top:
                break
        return result

    return {
        "risers": merge("risers"),
        "fallers": merge("fallers"),
        "moved": sum(int(bucket.get("moved") or 0) for bucket in by_grade.values()),
    }
