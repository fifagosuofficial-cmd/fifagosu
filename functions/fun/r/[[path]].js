/**
 * 킥킥 결과 링크 미리보기 (Cloudflare Pages Functions)
 * /fun/r/?d=<base64url>  →  정적 /fun/index.html 을 그대로 내보내되,
 *   - <head> 맨 앞에 <base href="/fun/"> 를 넣어 상대 경로(../index.html, 사진 등)가 /fun/ 기준으로 동작하게 하고
 *   - d 가 올바르면 og:title / og:description / og:url / twitter:title / twitter:description / <title> 을 결과 문구로 바꿔요.
 * 카톡·페이스북 크롤러는 JS를 실행하지 않아서, 결과가 미리보기에 보이려면 서버 쪽에서 메타를 넣어야 해요.
 * 실패해도 절대 500을 내지 않아요(기본 HTML, 그것도 안 되면 /fun/?d=… 로 이동).
 *
 * d = base64url(UTF-8 "v1|종류|…")  — fun/index.html 의 parseD 와 같은 규칙(바꿀 땐 둘 다)
 *   name : v1|name|입력이름|답변코드10|k|별명     duo : v1|duo|A|B|라벨
 *   유형형: v1|manager·fan·club|결과키|유형명      go  : v1|go|ifplayer·balance·blur·price|라벨
 */

const BAD = /[^가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 .,!?%()'·×~#-]/g;
const clean = (s) => String(s ?? '').replace(BAD, '').replace(/\s+/g, ' ').trim();
const TYPE_APPS = { manager: '내가 감독이라면?', fan: '축구 팬 유형 테스트', club: '나랑 닮은 축구 구단' };
const GO_APPS = { ifplayer: '내가 축구선수라면?', balance: '축구 밸런스 게임', blur: '흐린 사진 보고 선수 맞히기', price: '내 몸값, 이적료로 환산하면?' };

// 이름 처리(성 떼기): fun/index.html 이름 생성기의 callName 과 같은 규칙
const SURN = new Set('김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경사부');
const BOK = ['남궁', '황보', '제갈', '선우', '독고', '사공', '서문'];
export function callName(raw) {
  if (/^[가-힣]+$/.test(raw)) {
    if (raw.length === 3 && SURN.has(raw[0])) return raw.slice(1);
    if (raw.length === 4 && BOK.includes(raw.slice(0, 2))) return raw.slice(2);
  }
  return raw;
}

export function b64urlDecode(d) {
  if (!/^[A-Za-z0-9_-]{4,400}$/.test(d || '')) return null;
  try {
    const bin = atob(d.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** d → { kind, title, desc } 또는 null(형식 오류·다른 버전·허용 안 된 앱) */
export function parseD(d) {
  const raw = b64urlDecode(d);
  if (raw == null) return null;
  const f = raw.split('|');
  if (f[0] !== 'v1') return null;
  const nm = (x) => { x = clean(x).replace(/\s/g, ''); return x.length >= 1 && x.length <= 6 ? x : null; };
  const tx = (x, n) => { x = clean(x); return x && x.length <= n ? x : null; };
  if (f[1] === 'name' && f.length === 6) {
    const n = nm(f[2]), nick = tx(f[5], 24);
    if (!n || !/^[0-3]{10}$/.test(f[3]) || !/^[0-2]$/.test(f[4]) || !nick) return null;
    return { kind: 'name', title: `${callName(n)}의 축구 별명은 '${nick}'`, desc: '질문 10개 답하면 너다운 별명이 나와요. 너는 뭐 나와?' };
  }
  if (f[1] === 'duo' && f.length === 5) {
    const a = nm(f[2]), b = nm(f[3]), l = tx(f[4], 30);
    if (!a || !b || !l) return null;
    return { kind: 'duo', title: `${a} × ${b} 투톱 궁합 ${l}`, desc: '친구 이름 넣고 10초 만에 궁합 보기' };
  }
  if (TYPE_APPS[f[1]] && f.length === 4) {
    const l = tx(f[3], 30);
    if (!/^[a-z0-9]{1,10}$/.test(f[2]) || !l) return null;
    return { kind: 'type', title: `나는 '${l}' — ${TYPE_APPS[f[1]]}`, desc: '1분이면 너도 나와요. 해볼래?' };
  }
  if (f[1] === 'go' && f.length === 4 && GO_APPS[f[2]]) {
    const l = tx(f[3], 30);
    if (!l) return null;
    return { kind: 'go', title: `'${l}' — ${GO_APPS[f[2]]}`, desc: '킥킥에서 너도 해봐' };
  }
  return null;
}

/** HTMLRewriter 체인 만들기 (테스트에서 스텁 HTMLRewriter 로도 돌릴 수 있게 분리) */
export function rewrite(Rewriter, res, meta, pageUrl) {
  let rw = new Rewriter().on('head', { element(e) { e.prepend('<base href="/fun/">', { html: true }); } });
  if (meta) {
    const set = (v) => ({ element(e) { e.setAttribute('content', v); } });
    rw = rw
      .on('meta[property="og:title"]', set(meta.title))
      .on('meta[property="og:description"]', set(meta.desc))
      .on('meta[name="twitter:title"]', set(meta.title))
      .on('meta[name="twitter:description"]', set(meta.desc))
      .on('meta[property="og:url"]', set(pageUrl))
      .on('title', { element(e) { e.setInnerContent(`${meta.title} | 킥킥`); } });
  }
  return rw.transform(res);
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' };
  let asset = null;
  try {
    asset = await env.ASSETS.fetch(new Request(new URL('/fun/', url), { method: 'GET' }));
    if (!asset.ok) throw new Error('asset ' + asset.status);
    let meta = null;
    try { meta = parseD(url.searchParams.get('d') || ''); } catch { meta = null; }
    const base = new Response(asset.body, { status: 200, headers });
    return rewrite(HTMLRewriter, base, meta, url.toString());
  } catch {
    // 메타 넣기에 실패하면 원본 HTML 에 <base> 만이라도, 그것도 안 되면 /fun/?d=… 로 이동
    try {
      const again = await env.ASSETS.fetch(new Request(new URL('/fun/', url), { method: 'GET' }));
      if (again.ok) return rewrite(HTMLRewriter, new Response(again.body, { status: 200, headers }), null, url.toString());
    } catch { /* 아래로 */ }
    return Response.redirect(new URL('/fun/' + url.search, url).toString(), 302);
  }
}
