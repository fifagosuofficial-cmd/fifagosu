from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_mobile_navigation_is_balanced_and_trade_is_promoted():
    base = (ROOT / "site/templates/base.html").read_text("utf-8")
    index = (ROOT / "site/templates/index.html").read_text("utf-8")
    css = (ROOT / "site/assets/css/main.css").read_text("utf-8")
    for html in (base, index):
        assert html.index("전적 진단") < html.index("선수 거래소") < html.index("AI 스쿼드")
        assert 'data-mobile-label="강화·현질"' in html
    assert "grid-template-columns:repeat(4,minmax(0,1fr))" in css
    assert ".nav-sim-label::after" in css


def test_ai_squad_keeps_help_accessible_and_caps_result_width():
    html = (ROOT / "site/templates/squad.html").read_text("utf-8")
    css = (ROOT / "site/assets/css/squad.css").read_text("utf-8")
    js = (ROOT / "site/assets/js/squad.js").read_text("utf-8")
    assert '<details class="sq-help"><summary>추천 기준 안내</summary>' in html
    assert "#sqOutput{max-width:760px" in css
    assert ".sq-pitch{max-width:760px;min-width:0}" in css
    assert "@media(max-width:600px)" in css
    assert ".sq-fields{grid-template-columns:minmax(0,1fr)" in css
    assert "width:clamp(54px,15vw,68px)" in css
    assert html.count("sq-mobile-details") >= 2
    assert '<span class="sq-tool-icon" aria-hidden="true">↔</span>' in js
    assert '<span class="sq-tool-icon" aria-hidden="true">×</span>' in js
    assert ".sq-tool-icon{" in css


def test_diagnosis_report_is_one_responsive_container():
    html = (ROOT / "site/templates/index.html").read_text("utf-8")
    css = (ROOT / "site/assets/css/main.css").read_text("utf-8")
    shell = html.index('id="dReportShell"')
    summary = html.index('id="dSum"')
    report = html.index('id="dReport"')
    assert shell < summary < report
    assert ".diag-report-shell .dsum" in css
    assert ".diag-report-shell .dr-insights" in css


def test_home_market_explains_percent_and_absolute_delta_rule():
    html = (ROOT / "site/templates/index.html").read_text("utf-8")
    js = (ROOT / "site/assets/js/app.js").read_text("utf-8")
    assert "변동률 3% 이상 · 절대 변동액 상위 20% · 관측 3회 이상" in html
    assert "전체 시즌·전체 강화 카드의 실제 시세 변동 기준" in html
    assert "인기 카드 1강 시세" in html and "1강 시장 흐름" in html
    assert "data-mg" not in html and 'id="dRecent"' not in html
    assert "b.dataset.grade||1" in js
    assert "사용 10경기" not in html
