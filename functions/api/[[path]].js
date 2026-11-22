/**
 * 피파고수 API 중계 (Cloudflare Pages Functions)
 * 브라우저 → /api/... → 넥슨 Open API(open.api.nexon.com)
 * - API 키는 Cloudflare 환경 변수 NEXON_API_KEY 에만 두고 브라우저에는 노출하지 않아요(약관 제5조 ①).
 * - 허용된 경로만 중계하고, 응답을 캐시해서 넥슨 서버 호출 수를 줄여요(약관 제5조 ⑧ 과부하 금지).
 *
 * 묶음 경로(D1-5) — 진단 1회의 브라우저 요청 수를 줄여 Functions 하루 한도(10만 건)를 아껴요.
 *   /api/summary?nickname=&matchtype=50&limit=30  닉네임 → {ouid, basic, maxdivision, matches:[경기ID]}
 *   /api/matches?ids=a,b,c (최대 10개)              경기 상세 배열(실패한 경기는 null)
 *   30경기 진단: 기존 약 36회 → summary 1 + matches 3 = 4회
 */
const NEXON = 'https://open.api.nexon.com';
const ALLOW = [
  /^\/fconline\/v1\/id$/,
  /^\/fconline\/v1\/user\/(basic|maxdivision|match)$/,
  /^\/fconline\/v1\/match-detail$/,
  /^\/static\/fconline\/meta\/(spid|seasonid|spposition|division|matchtype)\.json$/,
  /^\/fconline\/v1\/ranker-stats$/,          // TOP 10,000 랭커가 쓴 같은 선수·포지션의 20경기 평균 (약점 진단 비교 기준)
];
const MATCH_TYPES = new Set(['30', '40', '50', '52', '60', '204', '214']);
const MAX_IDS = 10;
const ID_RE = /^[0-9a-f]{16,40}$/i;

// 경로별 캐시 시간(초)
const ttlFor = (p) =>
  p.startsWith('/static/') ? 6 * 3600 :          // 카드·시즌 목록: 6시간
  p.endsWith('/match-detail') ? 7 * 86400 :     // 끝난 경기 상세는 바뀌지 않음
  p.endsWith('/user/match') ? 60 :              // 최근 경기 목록: 1분
  p.endsWith('/ranker-stats') ? 12 * 3600 :     // 랭커 평균은 자주 안 바뀜: 12시간
  600;                                          // 닉네임·기본정보·최고등급: 10분

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

/** 넥슨 호출 + Cache API. 같은 주소는 일반 중계·묶음 경로가 캐시를 함께 써요. */
async function cachedFetch(env, waitUntil, pathWithQuery) {
  const path = pathWithQuery.split('?')[0];
  const target = NEXON + pathWithQuery;
  const cache = caches.default;
  const key = new Request(target);
  const hit = await cache.match(key);
  if (hit) return hit;
  const up = await fetch(target, { headers: { 'x-nxopen-api-key': env.NEXON_API_KEY } });
  const ttl = ttlFor(path);
  const res = new Response(up.body, {
    status: up.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': up.ok ? `public, max-age=${ttl}` : 'no-store',
    },
  });
  if (up.ok) waitUntil(cache.put(key, res.clone()));
  return res;
}

async function summary(url, env, waitUntil) {
  const nick = (url.searchParams.get('nickname') || '').trim();
  const mt = url.searchParams.get('matchtype') || '50';
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '30', 10) || 30));
  if (!nick || nick.length > 30) return json(400, { code: 'bad_nick', message: '닉네임을 확인해 주세요.' });
  if (!MATCH_TYPES.has(mt)) return json(400, { code: 'bad_type', message: '지원하지 않는 경기 종류예요.' });

  const idRes = await cachedFetch(env, waitUntil, '/fconline/v1/id?nickname=' + encodeURIComponent(nick));
  if (idRes.status === 429) return json(429, { code: 'rate', message: '요청이 많아 잠시 막혔어요.' });
  if (!idRes.ok) return json(404, { code: 'no_user', message: '해당 닉네임의 구단주를 찾지 못했어요.' });
  const { ouid } = await idRes.json();
  if (!ouid) return json(404, { code: 'no_user', message: '해당 닉네임의 구단주를 찾지 못했어요.' });

  const [b, m, l] = await Promise.all([
    cachedFetch(env, waitUntil, '/fconline/v1/user/basic?ouid=' + ouid),
    cachedFetch(env, waitUntil, '/fconline/v1/user/maxdivision?ouid=' + ouid),
    cachedFetch(env, waitUntil, `/fconline/v1/user/match?ouid=${ouid}&matchtype=${mt}&offset=0&limit=${limit}`),
  ]);
  if ([b, m, l].some((r) => r.status === 429)) return json(429, { code: 'rate', message: '요청이 많아 잠시 막혔어요.' });
  if (!l.ok) return json(502, { code: 'upstream', message: `넥슨 API 응답 오류(${l.status})예요.` });
  return json(200, {
    ouid,
    basic: b.ok ? await b.json() : null,
    maxdivision: m.ok ? await m.json() : [],
    matches: await l.json(),
  }, { 'cache-control': 'no-store' });
}

async function matches(url, env, waitUntil) {
  const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
  if (!ids.length || ids.length > MAX_IDS || !ids.every((x) => ID_RE.test(x)))
    return json(400, { code: 'bad_ids', message: `경기 ID는 1~${MAX_IDS}개까지 보낼 수 있어요.` });
  const parts = await Promise.all(ids.map(async (id) => {
    try {
      const r = await cachedFetch(env, waitUntil, '/fconline/v1/match-detail?matchid=' + id);
      if (r.status === 429) return 'RATE';
      return r.ok ? await r.text() : 'null';
    } catch {
      return 'null';
    }
  }));
  if (parts.every((p) => p === 'RATE')) return json(429, { code: 'rate', message: '요청이 많아 잠시 막혔어요.' });
  // 각 응답을 다시 파싱하지 않고 그대로 이어 붙여요(CPU 시간 절약)
  const body = '[' + parts.map((p) => (p === 'RATE' ? 'null' : p)).join(',') + ']';
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}


/* ---------- 확률형 아이템(넥슨 공식 공개 페이지) 중계: 팩 오픈 시뮬레이터용 ----------
 *  /api/prob          → 판매 중 아이템 목록 [{sn,name}]
 *  /api/prob?sn=123   → {sn,name,period,rows:[{n,amt,p}]}  (p는 % 숫자)
 *  출처: https://iteminfo.nexon.com/probability/fco  — 6시간 캐시로 호출 최소화 */
const PROB = 'https://iteminfo.nexon.com/probability/fco';
const strip = (h) => h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
async function prob(url, waitUntil) {
  const sn = url.searchParams.get('sn');
  if (sn && !/^\d{1,8}$/.test(sn)) return json(400, { message: '잘못된 아이템 번호예요.' });
  const cache = caches.default;
  const key = new Request('https://fifagosu.cache/prob/' + (sn || 'list'));
  const hit = await cache.match(key);
  if (hit) return hit;
  const up = await fetch(PROB + (sn ? '?sn=' + sn : ''), { headers: { 'user-agent': 'Mozilla/5.0 (compatible; fifagosu-prob/1.0; +https://fifagosu.pages.dev)', 'accept-language': 'ko-KR,ko;q=0.9' } });
  if (!up.ok) return json(502, { message: `넥슨 확률 페이지 응답 오류(${up.status})예요.` });
  const html = await up.text();
  let body;
  if (!sn) {
    const items = []; const seen = new Set();
    for (const m of html.matchAll(/href="\/probability\/fco\?sn=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      if (seen.has(m[1])) continue; seen.add(m[1]);
      items.push({ sn: +m[1], name: strip(m[2]) });
    }
    if (!items.length) return json(502, { message: '확률 목록을 읽지 못했어요.' });
    body = { source: PROB, items };
  } else {
    const name = strip((html.match(/<h3 class="name">([\s\S]*?)<\/h3>/) || [])[1] || '');
    const period = strip((html.match(/판매 or 획득 가능 기간\s*:\s*([^<]*)/) || [])[1] || '');
    const tbody = (html.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1] || '';
    const rows = []; let carry = '';
    for (const tr of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...tr[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map((c) => ({ a: c[1], t: strip(c[2]) }));
      if (cells.length < 2) continue;
      const pct = parseFloat(cells[cells.length - 1].t.replace('%', ''));
      const amt = cells[cells.length - 2].t;
      let names = cells.slice(0, -2);
      if (names.length && /rowspan/.test(names[0].a) && /rating/.test(names[0].a + 'rating')) carry = names[0].t;
      let n = names.map((c) => c.t).filter(Boolean).join(' · ');
      if (carry && !n.startsWith(carry) && names.length === 1 && /TOP|기준가|순위/.test(n)) n = carry + ' · ' + n;
      rows.push({ n, amt, p: isFinite(pct) ? pct : 0 });
    }
    if (!rows.length) return json(502, { message: '확률표를 읽지 못했어요.' });
    body = { source: PROB + '?sn=' + sn, sn: +sn, name, period, rows };
  }
  const res = json(200, body, { 'cache-control': 'public, max-age=21600' });
  waitUntil(cache.put(key, res.clone()));
  return res;
}

/* 웹 상점 판매 목록 (이미지·이름·가격·기간) — /api/shop, 6시간 캐시. 출처: https://shop.fconline.nexon.com/ */
async function shop(waitUntil) {
  const cache = caches.default;
  const key = new Request('https://fifagosu.cache/shop/list');
  const hit = await cache.match(key);
  if (hit) return hit;
  // 상품 목록은 메인 HTML이 아니라 /Shop/List 조각(탭 1: 일반 상품, 탭 3: 기타)으로 따로 내려와요. 탭 2(마일리지)는 제외.
  const hdr = { headers: { 'user-agent': 'Mozilla/5.0 (compatible; fifagosu-shop/1.0; +https://fifagosu.pages.dev)', 'accept-language': 'ko-KR,ko;q=0.9', 'x-requested-with': 'XMLHttpRequest' } };
  const pages = await Promise.all([1, 3].map((t) => fetch(`https://shop.fconline.nexon.com/Shop/List?n1TabType=${t}&n1OrderType=1&n1PageNo=1&strSType=[]`, hdr).then((r) => (r.ok ? r.text() : '')).catch(() => '')));
  const html = pages.join('\n');
  if (!html) return json(502, { message: '넥슨 웹 상점 응답 오류예요.' });
  const items = []; const seen = new Set();
  for (const blk of html.split('class="product-inner').slice(1)) {
    const pid = (blk.match(/strPid=(\d+)/) || [])[1];
    if (!pid || seen.has(pid)) continue;
    const img = (blk.match(/<div class="thumb">\s*<img src="([^"]+)"/) || [])[1] || '';
    const name = strip((blk.match(/<p class="text">([\s\S]*?)<\/p>/) || [])[1] || '');
    const price = strip((blk.match(/<p class="price[^"]*">([\s\S]*?)<\/p>/) || [])[1] || '');
    const date = strip((blk.match(/<div class="date[^"]*">([\s\S]*?)<\/div>/) || [])[1] || '');
    if (!name) continue;
    seen.add(pid);
    items.push({ pid: +pid, name, img, price, date });
  }
  if (!items.length) return json(502, { message: '상점 목록을 읽지 못했어요.' });
  const res = json(200, { source: 'https://shop.fconline.nexon.com/', items }, { 'cache-control': 'public, max-age=21600' });
  waitUntil(cache.put(key, res.clone()));
  return res;
}

/* 패키지 구성품 — /api/shop?pid=44730 → {pid, parts:[{name,count,img}]}, 6시간 캐시.
   웹 상점 상품 상세(/Shop/View, 로그인 없이 공개)의 '구성품' 목록을 읽어요. 구성품 이름은 넥슨 확률표 아이템 이름과 같아요. */
async function shopParts(pid, waitUntil) {
  if (!/^\d{1,9}$/.test(pid)) return json(400, { message: '상품 번호를 확인해 주세요.' });
  const cache = caches.default;
  const key = new Request('https://fifagosu.cache/shop/view/' + pid);
  const hit = await cache.match(key);
  if (hit) return hit;
  const up = await fetch('https://shop.fconline.nexon.com/Shop/View?strPid=' + pid, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; fifagosu-shop/1.0; +https://fifagosu.pages.dev)', 'accept-language': 'ko-KR,ko;q=0.9' } }).catch(() => null);
  if (!up || !up.ok) return json(502, { message: '넥슨 웹 상점 응답 오류예요.' });
  const html = await up.text();
  const list = (html.split('<ul class="product">')[1] || '').split('</ul>')[0];
  const parts = [];
  for (const m of list.matchAll(/<li class=['"]item['"]>([\s\S]*?)<\/li>/g)) {
    const b = m[1];
    const name = strip((b.match(/class=['"]text['"]>\s*<strong>([\s\S]*?)<\/strong>/) || [])[1] || '');
    if (!name) continue;
    const count = +((b.match(/class=['"]plus['"]>\s*x\s*<strong>(\d+)/) || [])[1] || 1);
    const img = (b.match(/<img src=['"]([^'"]+)['"]/) || [])[1] || '';
    parts.push({ name, count: Math.max(1, Math.min(100, count)), img });
  }
  if (!parts.length) return json(404, { message: '구성품 정보를 찾지 못했어요.' });
  const res = json(200, { pid: +pid, source: 'https://shop.fconline.nexon.com/Shop/View?strPid=' + pid, parts }, { 'cache-control': 'public, max-age=21600' });
  waitUntil(cache.put(key, res.clone()));
  return res;
}

export async function onRequest({ request, env, params, waitUntil }) {
  if (request.method !== 'GET') return json(405, { message: 'GET만 지원해요.' });
  const path = '/' + [].concat(params.path || []).join('/');
  const url = new URL(request.url);
  if (path === '/prob') return prob(url, waitUntil);
  if (path === '/shop') return url.searchParams.has('pid') ? shopParts(url.searchParams.get('pid'), waitUntil) : shop(waitUntil);
  if (!env.NEXON_API_KEY) return json(500, { message: 'NEXON_API_KEY 환경 변수가 없어요.' });
  if (path === '/summary') return summary(url, env, waitUntil);
  if (path === '/matches') return matches(url, env, waitUntil);
  if (!ALLOW.some((r) => r.test(path))) return json(404, { message: '지원하지 않는 경로예요.' });
  return cachedFetch(env, waitUntil, path + url.search);
}
