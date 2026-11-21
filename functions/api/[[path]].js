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
];
const MATCH_TYPES = new Set(['30', '40', '50', '52', '60', '204', '214']);
const MAX_IDS = 10;
const ID_RE = /^[0-9a-f]{16,40}$/i;

// 경로별 캐시 시간(초)
const ttlFor = (p) =>
  p.startsWith('/static/') ? 6 * 3600 :          // 카드·시즌 목록: 6시간
  p.endsWith('/match-detail') ? 7 * 86400 :     // 끝난 경기 상세는 바뀌지 않음
  p.endsWith('/user/match') ? 60 :              // 최근 경기 목록: 1분
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

export async function onRequest({ request, env, params, waitUntil }) {
  if (request.method !== 'GET') return json(405, { message: 'GET만 지원해요.' });
  const path = '/' + [].concat(params.path || []).join('/');
  const url = new URL(request.url);
  if (!env.NEXON_API_KEY) return json(500, { message: 'NEXON_API_KEY 환경 변수가 없어요.' });
  if (path === '/summary') return summary(url, env, waitUntil);
  if (path === '/matches') return matches(url, env, waitUntil);
  if (!ALLOW.some((r) => r.test(path))) return json(404, { message: '지원하지 않는 경로예요.' });
  return cachedFetch(env, waitUntil, path + url.search);
}
