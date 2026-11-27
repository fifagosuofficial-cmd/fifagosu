from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_mobile_navigation_is_balanced_and_trade_is_promoted():
    base = (ROOT / "site/templates/base.html").read_text("utf-8")
    index = (ROOT / "site/templates/index.html").read_text("utf-8")
    css = (ROOT / "site/assets/css/main.css").read_text("utf-8")
    for html in (base, index):
        assert html.index("전적 진단") < html.index("선수 거래소") < html.index("AI 스쿼드")
        assert 'data-mobile-label="강화·현질"' in html
    assert ".fg-nav-shell nav.menu{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))" in css
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
    assert "종합 순위만 변동률 3% 이상·절대 변동액 상위 20%·관측 3회 이상" in html
    assert "전체 시즌·전체 강화 카드의 실제 시세 변동 기준" in html
    assert 'data-market-grade' in html and 'data-market-season' in html
    assert 'data-market-sort="impact"' in html and 'data-market-sort="pct"' in html
    assert 'data-market-sort="delta"' in html and "TOP 100 더보기" in html
    assert "b.dataset.grade||1" in js or "row.dataset.grade||1" in js
    assert "사용 10경기" not in html


def test_market_detail_is_lazy_and_new_seasons_are_rehydrated():
    html = (ROOT / "site/templates/index.html").read_text("utf-8")
    js = (ROOT / "site/assets/js/app.js").read_text("utf-8")
    css = (ROOT / "site/assets/css/main.css").read_text("utf-8")
    assert 'id="v-market"' in html and 'data-limit="100"' in html
    assert "fetch(`/market-data/${day}.json`)" in js
    assert "if(detail&&!root.closest('main').hidden&&!started)" in js
    assert "hydrateSeasonBadges();" in js
    assert "s.seasonImg||''" in js
    assert ".market-dashboard .mk-panel{display:grid;grid-template-columns:repeat(2" in css
    assert "@media(max-width:760px)" in css


def test_market_table_fits_narrow_screens_without_sparkline():
    template = (ROOT / "site/templates/_market.html").read_text("utf-8")
    js = (ROOT / "site/assets/js/app.js").read_text("utf-8")
    css = (ROOT / "site/assets/css/main.css").read_text("utf-8")
    assert 'class="mk-spark"' not in template and 'class="mk-spark"' not in js
    assert 'class="mk-mobile-delta"' in template and 'class="mk-mobile-delta"' in js
    assert '.mk-stock-table{width:100%;min-width:0;' in css
    assert '.mk-stock-table .mk-delta{display:none}' in css
    assert '.mk-stock-table .mk-mobile-delta{display:block;' in css
    assert '.mk-stock-table{min-width:480px}' not in css


def test_diagnosis_nav_has_compact_callout_and_respects_motion_preference():
    css = (ROOT / "site/assets/css/main.css").read_text("utf-8")
    for name in ("base.html", "index.html"):
        html = (ROOT / "site/templates" / name).read_text("utf-8")
        assert 'class="core nav-diag-feature"' in html
        assert '<span class="fg-diag-bubble" aria-hidden="true">내 약점 찾기!</span>' in html
    assert "@keyframes fg-diag-glow" in css
    assert "animation:fg-diag-glow 2.6s ease-in-out infinite" in css
    assert "fg-diag-float" not in css
    glow = css.split("@keyframes fg-diag-glow", 1)[1].split("@media", 1)[0]
    assert "box-shadow:" in glow and "transform:" not in glow
    assert "13px 2px" in glow
    assert "@media(prefers-reduced-motion:reduce)" in css
    assert ".fg-nav-shell nav.menu{padding-top:20px!important}" in css


def test_mobile_fee_controls_keep_all_discounts_in_one_row():
    html = (ROOT / "site/templates/index.html").read_text("utf-8")
    css = (ROOT / "site/assets/css/main.css").read_text("utf-8")
    for control in ("smfPc", "smfTop", "smfCoupon", "smfRate"):
        assert html.count(f'id="{control}"') == 1
    assert ".sim-fee-bar{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto" in css
    assert ".sim-fee-bar .sfb-out{width:auto;margin:0" in css


def test_floating_chat_is_shared_and_minimal():
    base = (ROOT / "site/templates/base.html").read_text("utf-8")
    index = (ROOT / "site/templates/index.html").read_text("utf-8")
    partial = (ROOT / "site/templates/_social.html").read_text("utf-8")
    css = (ROOT / "site/assets/css/social.css").read_text("utf-8")
    js = (ROOT / "site/assets/js/social.js").read_text("utf-8")
    build = (ROOT / "site/build.py").read_text("utf-8")
    assert '{% include "_social.html" %}' in base
    assert 'id="fgLiveChat"' not in index and 'fg-chat-shortcut' not in index
    assert 'id="fgChatToggle"' in partial and 'aria-expanded="false"' in partial
    assert 'aria-labelledby="fgChatTitle" hidden' in partial
    assert 'type="checkbox"' not in partial
    assert '피파고수에게 건의하기' in partial
    assert '.fg-floating-chat{position:fixed;right:' in css and 'bottom:max(' in css
    assert 'fg-chat-avatar' in js and 'node("time"' not in js
    assert '/assets/ranks/cat-' in js and 'grade+"강냥"' in js
    assert '최근 200개 대화는 이 브라우저에만 저장됩니다.' not in js
    assert 'return chat&&!document.hidden&&!chat.hidden' in js
    assert 'setChatOpen(chat.hidden)' in js
    assert '_social.html' in build
