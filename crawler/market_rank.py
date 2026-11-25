"""FC Online market movers ranked by practical market impact.

This module only consumes already collected card-list and history data.  It is
shared by the daily derive step and the static 1/3/7-day site build so both
surfaces apply the same eligibility and ranking rules without extra requests.
"""
from __future__ import annotations

import datetime as dt
import math
from statistics import median


MAX_SAFE_INTEGER = 9_007_199_254_740_991
MIN_GAMES = 10
MIN_PRICE = 5_000_000
MIN_PRICE_SAMPLE = 30
MIN_OBSERVATIONS = 3
MIN_DELTA = 1_000_000
MIN_DELTA_RATE = 0.01
NEW_CARD_COOLDOWN_DAYS = 2


def _positive_safe_integer(value):
    return isinstance(value, int) and not isinstance(value, bool) and 0 < value <= MAX_SAFE_INTEGER


def _nearest_rank(values, fraction):
    """Return a deterministic nearest-rank percentile from a non-empty list."""
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil(len(ordered) * fraction) - 1))
    return ordered[index]


def _days_since(as_of, value):
    if not value:
        return None
    try:
        return (dt.date.fromisoformat(as_of) - dt.date.fromisoformat(value)).days
    except (TypeError, ValueError):
        return None


def rank_market_moves(candidates, as_of, top=10):
    """Filter and rank signed market changes.

    Each candidate is a mapping with ``id``, ``first``, ``last``, ``games`` and
    ``observations`` plus an optional ``new_date`` and ``item`` payload.  The
    returned item preserves that payload and adds the stable JSON fields used by
    the site: ``v``, ``pv``, ``c``, ``d``, ``u`` and ``impact``.
    """
    base = []
    for candidate in candidates:
        first, last = candidate.get("first"), candidate.get("last")
        games = candidate.get("games")
        observations = candidate.get("observations")
        if not (_positive_safe_integer(first) and _positive_safe_integer(last)):
            continue
        if not isinstance(games, int) or isinstance(games, bool) or games < MIN_GAMES:
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
        base.append({**candidate, "id": card_id, "games": games})

    if not base:
        return {"risers": [], "fallers": [], "moved": 0,
                "priceFloor": MIN_PRICE, "priceMedian": None, "gamesP90": None}

    prices = [candidate["last"] for candidate in base]
    price_floor = MIN_PRICE
    if len(prices) >= MIN_PRICE_SAMPLE:
        price_floor = max(MIN_PRICE, _nearest_rank(prices, 0.20))
    price_median = median(prices)
    games_p90 = _nearest_rank([candidate["games"] for candidate in base], 0.90)
    popularity_denominator = math.log1p(games_p90) if games_p90 > 0 else 1.0

    qualified = []
    for candidate in base:
        first, last, games = candidate["first"], candidate["last"], candidate["games"]
        delta = last - first
        if min(first, last) < price_floor:
            continue
        if abs(delta) < max(MIN_DELTA, math.ceil(first * MIN_DELTA_RATE)):
            continue
        pct = delta / first * 100
        price_weight = min(2.0, math.sqrt(last / price_median)) if price_median else 1.0
        popularity_weight = 0.75 + 0.25 * min(1.0, math.log1p(games) / popularity_denominator)
        impact = abs(pct) * price_weight * popularity_weight
        item = dict(candidate.get("item") or {})
        item.update(id=candidate["id"], v=last, pv=first, c=round(pct, 1), d=delta,
                    u=games, impact=round(impact, 4))
        qualified.append(item)

    key = lambda item: (-item["impact"], -abs(item["d"]), -item["u"], item["id"])
    risers = sorted((item for item in qualified if item["d"] > 0), key=key)[:top]
    fallers = sorted((item for item in qualified if item["d"] < 0), key=key)[:top]
    return {"risers": risers, "fallers": fallers, "moved": len(qualified),
            "priceFloor": price_floor, "priceMedian": int(price_median), "gamesP90": games_p90}
