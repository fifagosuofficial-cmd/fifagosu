/**
 * 피파고수 API 중계 (Cloudflare Pages Functions)
 * 브라우저 → /api/... → 넥슨 Open API(open.api.nexon.com)
 * - API 키는 Cloudflare 환경 변수 NEXON_API_KEY 에만 두고 브라우저에는 노출하지 않아요(약관 제5조 ①).
 * - 허용된 경로만 중계하고, 응답을 캐시해서 넥슨 서버 호출 수를 줄여요(약관 제5조 ⑧ 과부하 금지).
 */
const ALLOW = [
  /^\/fconline\/v1\/id$/,
  /^\/fconline\/v1\/user\/(basic|maxdivision|match)$/,
  /^\/fconline\/v1\/match-detail$/,
  /^\/static\/fconline\/meta\/(spid|seasonid|spposition|division|matchtype)\.json$/,
];
// 경로별 캐시 시간(초)
const ttlFor = (p) =>
  p.startsWith('/static/') ? 6 * 3600 :          // 카드·시즌 목록: 6시간
  p.endsWith('/match-detail') ? 7 * 86400 :     // 끝난 경기 상세는 바뀌지 않음
  p.endsWith('/user/match') ? 60 :              // 최근 경기 목록: 1분
  600;                                          // 닉네임·기본정보·최고등급: 10분

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequest({ request, env, params, waitUntil }) {
  if (request.method !== 'GET') return json(405, { message: 'GET만 지원해요.' });
  const path = '/' + [].concat(params.path || []).join('/');
  if (!ALLOW.some((r) => r.test(path))) return json(404, { message: '지원하지 않는 경로예요.' });
  if (!env.NEXON_API_KEY) return json(500, { message: 'NEXON_API_KEY 환경 변수가 없어요.' });

  const target = 'https://open.api.nexon.com' + path + new URL(request.url).search;
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
