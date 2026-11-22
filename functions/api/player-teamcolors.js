const SOURCE = 'https://fconline.nexon.com/datacenter/PlayerAbility';
const CACHE_TTL = 6 * 60 * 60;

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});

function textContent(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function relationItems(html) {
  const start = html.indexOf('<div class="tspecial">');
  const end = start < 0 ? -1 : html.indexOf('<div class="ovr_set">', start);
  if (start < 0 || end < 0) return null;

  const section = html.slice(start, end);
  const items = [];
  const seen = new Set();
  for (const match of section.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = match[1];
    const className = (attrs.match(/\bclass=["']([^"']*)["']/i) || [])[1] || '';
    const id = +(attrs.match(/\bdata-no=["'](\d+)["']/i) || [])[1] || 0;
    if (!id || !/\bselector_item\b/.test(className) || !/\btspecial\d+\b/.test(className) || seen.has(id)) continue;
    const name = textContent(match[2]);
    if (!name || name === '관계 팀컬러') continue;
    seen.add(id);
    items.push({ id, name });
  }
  return items;
}

export async function onRequestGet({ request, waitUntil }) {
  const url = new URL(request.url);
  const spid = url.searchParams.get('spid') || '';
  if (!/^\d{8,10}$/.test(spid)) return json(400, { code: 'bad_spid', message: '선수 카드 번호를 확인해 주세요.' });

  const cache = caches.default;
  const key = new Request(`https://fifagosu.cache/player-teamcolors/${spid}`);
  const cached = await cache.match(key);
  if (cached) return cached;

  const body = new URLSearchParams({
    spid,
    n1Strong: '1',
    n1Grow: '0',
    n4TeamColorId: '0',
    n4TeamColorLv: '0',
    n4TeamColorId_Enhance: '0',
    n4TeamColorLv_Enhance: '0',
    n4TeamColorId_Feature: '0',
    n1Change: '0',
    strPlayerImg: '',
    rd: '0',
  });

  let upstream;
  try {
    upstream = await fetch(SOURCE, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'accept': 'text/html, */*; q=0.01',
        'origin': 'https://fconline.nexon.com',
        'referer': `https://fconline.nexon.com/DataCenter/PlayerInfo?spid=${spid}&n1Strong=1`,
        'user-agent': 'Mozilla/5.0 (compatible; fifagosu/1.0; +https://fifagosu.pages.dev)',
      },
      body: body.toString(),
    });
  } catch {
    return json(502, { code: 'upstream', message: '넥슨 관계 팀컬러 정보를 불러오지 못했어요.' });
  }
  if (!upstream.ok) return json(502, { code: 'upstream', message: `넥슨 응답 오류(${upstream.status})예요.` });

  const html = await upstream.text();
  const items = relationItems(html);
  if (!items) return json(502, { code: 'parse', message: '넥슨 관계 팀컬러 응답을 읽지 못했어요.' });

  const response = json(200, { spid: +spid, items }, { 'cache-control': `public, max-age=${CACHE_TTL}` });
  waitUntil(cache.put(key, response.clone()));
  return response;
}
