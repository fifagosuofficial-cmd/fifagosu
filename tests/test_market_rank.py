import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "crawler"))
from market_rank import merge_market_moves, rank_market_moves  # noqa: E402


def card(card_id, first, last, games=100, observations=4, new_date=None,
         prices=None, grade=None):
    return {
        "id": card_id,
        "first": first,
        "last": last,
        "games": games,
        "observations": observations,
        "new_date": new_date,
        "prices": prices,
        "grade": grade,
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


def test_independent_pct_and_delta_ranks_use_full_valid_pool():
    rows = [
        card(1, 100, 102, observations=2),
        card(2, 100, 150, observations=2),
        card(3, 1_000_000, 1_000_100, observations=2),
    ]
    result = rank_market_moves(rows, "2026-11-25", top=None)
    assert result["risers"] == []  # composite still needs three observations
    by_id = {item["id"]: item for item in result["items"]}
    assert by_id[2]["rp"] == 1 and by_id[1]["rp"] == 2
    assert by_id[3]["rd"] == 1
    assert all(item["impact"] is None for item in result["items"])


def test_usage_is_not_a_filter_weight_or_mover_output_field():
    rows = [
        card(1, 100_000_000, 110_000_000, games=0),
        card(2, 100_000_000, 110_000_000, games=100_000),
    ]
    result = rank_market_moves(rows, "2026-11-25")
    assert [item["id"] for item in result["risers"]] == [1, 2]
    assert all("u" not in item for item in result["risers"])


def test_impact_weights_recent_persistence_at_twenty_percent():
    rows = [
        card(1, 100, 130, prices=[100, 115, 130], grade=1),
        card(2, 100, 130, prices=[100, 140, 130], grade=2),
    ]
    result = rank_market_moves(rows, "2026-11-25")
    first, second = result["risers"]
    assert first["id"] == 1 and first["persistence"] == 100
    assert first["trend"] == "3일 상승세"
    assert second["persistence"] == 50
    assert first["impact"] - second["impact"] == 10


def test_merge_all_grades_limits_same_card_to_two_and_uses_grade_tie_break():
    def move(card_id, grade):
        return {"id": card_id, "g": grade, "impact": 80, "d": 100, "c": 10}
    buckets = {
        str(grade): {"risers": [move(1, grade)], "fallers": [], "moved": 1}
        for grade in (1, 5, 8)
    }
    buckets["2"] = {"risers": [move(2, 2)], "fallers": [], "moved": 1}
    result = merge_market_moves(buckets, top=10, max_per_card=2)
    assert [(item["id"], item["g"]) for item in result["risers"]] == [
        (1, 8), (1, 5), (2, 2)
    ]
    assert result["moved"] == 4
