"""Read-only smoke test of the deployed chat and feedback interface."""
import base64, hashlib, json, os, ssl, time, urllib.request
from http.client import HTTPSConnection

HOST = "fifagosu.com"
def get(path):
    req = urllib.request.Request("https://" + HOST + path, headers={"User-Agent":"FIFAGOSU-deploy-smoke/1.0","Cache-Control":"no-cache"})
    with urllib.request.urlopen(req, timeout=15) as res:
        return res.read().decode("utf-8")
def verify():
    stamp = str(time.time_ns())
    for path in ("/", "/board/", "/diag", "/fun/"):
        html = get(path + "?fgverify=" + stamp)
        assert html.count('id="fgChatToggle"') == 1, path
        assert 'aria-labelledby="fgChatTitle" hidden' in html, path
        assert '피파고수에게 건의하기' in html, path
        assert 'name="consent"' not in html.split('id="fgContactDialog"',1)[1].split("</dialog>",1)[0], path
        print("Public UI OK:", path)
    diag = get("/diag?fgverify=" + stamp)
    assert 'id="dStyleDialog"' in diag
    assert '<details id="dQuick" class="dquick-menu">' in diag
    assert 'id="dFavCount"' in diag and '<div class="dquick" id="dQuick"' not in diag
    app = get("/assets/js/app.js?fgverify=" + stamp)
    assert "function dPlayStyle(" in app and "나의 플레이스타일" in app and "diag-owner-tiers" in app
    css = get("/assets/css/main.css?fgverify=" + stamp)
    assert ".diag-tier-row" in css and ".dr-style-open" in css
    assert ".dquick-menu:not([open])>.dquick-popover{display:none}" in css
    assert "countEl.hidden=n===0" in app
    print("Public compact favorites menu OK")
    print("Public diagnosis layout and playstyle assets OK")
    assert "function dTimingEvidence(" in app and "function dTimingAdvice(" in app and "function dRateGap(" in app
    assert "뚜렷하게 반복되는 약점은 확인되지 않았어요" in app
    print("Public evidence-based diagnosis advice OK")
    assert "function dCoachWeak(" in app and "지금 <b>${streak}연패" in app and "개선 점검" not in app[app.index("function dAdvice("):app.index("function dRenderTip(")]
    print("Public conversational coach advice OK")
    js = get("/assets/js/social.js?fgverify=" + stamp)
    assert "setChatOpen(chat.hidden)" in js and 'node("time"' not in js
    state = json.loads(get("/api/community/live-chat"))
    assert state.get("version") == 2 and state.get("canWrite") is False, state
    key = base64.b64encode(os.urandom(16)).decode()
    conn = HTTPSConnection(HOST, timeout=15, context=ssl.create_default_context())
    try:
        conn.request("GET", "/api/community/live-chat/socket-v2", headers={"Origin":"https://" + HOST,"Connection":"Upgrade","Upgrade":"websocket","Sec-WebSocket-Version":"13","Sec-WebSocket-Key":key})
        res = conn.getresponse()
        assert res.status == 101, res.status
        expected = base64.b64encode(hashlib.sha1((key+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
        assert res.getheader("Sec-WebSocket-Accept") == expected
        print("Public WebSocket handshake OK (101)")
    finally:
        conn.close()
for attempt in range(5):
    try:
        verify()
        break
    except Exception as e:
        print("Smoke attempt", attempt+1, type(e).__name__, str(e)[:200], flush=True)
        if attempt == 4:
            raise
        time.sleep(5)
