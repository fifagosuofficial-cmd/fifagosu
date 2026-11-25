from crawler.market_rank import rank_market_moves


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


def test_cheap_percent_spike_and_thin_cards_are_excluded():
    rows = [
        card(1, 1_000_000, 3_000_000, games=500),
        card(2, 10_000_000, 12_000_000, games=9),
        card(3, 10_000_000, 12_000_000, observations=2),
        card(4, 20_000_000, 24_000_000),
    ]
    result = rank_market_moves(rows, "2026-11-25")
    assert [item["id"] for item in result["risers"]] == [4]
    assert result["risers"][0]["d"] == 4_000_000
    assert result["risers"][0]["u"] == 100


def test_new_cards_wait_two_full_days_before_ranking():
    rows = [
        card(1, 10_000_000, 12_000_000, new_date="2026-11-23"),
        card(2, 10_000_000, 12_000_000, new_date="2026-11-22"),
    ]
    result = rank_market_moves(rows, "2026-11-25")
    assert [item["id"] for item in result["risers"]] == [2]


def test_market_impact_uses_value_and_usage_not_percent_alone():
    rows = [
        card(1, 10_000_000, 15_000_000, games=10),
        card(2, 100_000_000, 140_000_000, games=500),
        card(3, 80_000_000, 60_000_000, games=300),
    ]
    result = rank_market_moves(rows, "2026-11-25")
    assert [item["id"] for item in result["risers"]][:2] == [2, 1]
    assert [item["id"] for item in result["fallers"]] == [3]
