import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "crawler"))
from market_rank import rank_market_moves  # noqa: E402


def card(card_id, first, last, games=100, observations=4, new_date=None):
    return {
        "id": card_id,
        "first": first,
        "last": last,
        "games": games,
        "observations": observations,
        "new_date": new_date,
        "item": {"n": str(card_id)},
    }


def test_requires_three_percent_and_top_twenty_percent_absolute_delta():
    rows = [card(i, 100_000_000, 100_000_000 + i * 1_000_000) for i in range(1, 11)]
    rows.append(card(99, 100_000_000, 500_000_000, observations=2))
    result = rank_market_moves(rows, "2026-11-25")
    assert result["pctThreshold"] == 3.0
    assert result["deltaThreshold"] == 9_000_000
    assert [item["id"] for item in result["risers"]] == [10, 9]


def test_no_fixed_current_price_floor_when_absolute_change_is_significant():
    rows = [card(i, 100_000_000, 100_000_000 + i * 1_000_000) for i in range(1, 6)]
    rows.append(card(6, 1_000_000, 6_000_000))
    result = rank_market_moves(rows, "2026-11-25")
    assert result["deltaThreshold"] == 5_000_000
    assert {item["id"] for item in result["risers"]} == {5, 6}


def test_new_cards_wait_two_full_days_before_ranking():
    rows = [
        card(1, 10_000_000, 12_000_000, new_date="2026-11-23"),
        card(2, 10_000_000, 12_000_000, new_date="2026-11-22"),
    ]
    result = rank_market_moves(rows, "2026-11-25")
    assert [item["id"] for item in result["risers"]] == [2]


def test_usage_is_not_a_filter_weight_or_mover_output_field():
    rows = [
        card(1, 100_000_000, 110_000_000, games=0),
        card(2, 100_000_000, 110_000_000, games=100_000),
    ]
    result = rank_market_moves(rows, "2026-11-25")
    assert [item["id"] for item in result["risers"]] == [1, 2]
    assert all("u" not in item for item in result["risers"])
