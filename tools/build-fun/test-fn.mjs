// 킥킥 결과 링크 Function 모의 테스트:  node tools/build-fun/test-fn.mjs   (저장소 루트에서)
// 1) parseD 10케이스  2) onRequest 를 가짜 env.ASSETS + 간이 HTMLRewriter 로 돌려 og 메타·<base> 주입 확인
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const fn = await import(new URL('../../functions/fun/r/[[path]].js', import.meta.url).href);
const { parseD, onRequest } = fn;
const enc = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ---- 1. parseD ----
const cases = [
  ['정상 name', enc('v1|name|김윤재|1023012230|0|후반 12분 윤재투입'), (m) => m && m.title === "윤재의 축구 별명은 '후반 12분 윤재투입'"],
  ['정상 duo', enc('v1|duo|윤재|민수|87% 눈빛 패스 반쯤 통함'), (m) => m && m.title === '윤재 × 민수 투톱 궁합 87% 눈빛 패스 반쯤 통함'],
  ['정상 유형형', enc('v1|manager|bus|버스 2대 주차형'), (m) => m && m.title === "나는 '버스 2대 주차형' — 내가 감독이라면?"],
  ['정상 go', enc('v1|go|ifplayer|두 개의 심장 박지성 87%'), (m) => m && m.title === "'두 개의 심장 박지성 87%' — 내가 축구선수라면?"],
  ['깨진 base64', '%%%이건아님', (m) => m === null],
  ['v2', enc('v2|name|윤재|1023012230|0|미래 별명'), (m) => m === null],
  ['허용 안 된 앱', enc('v1|league|t1|프리미어리그 주전'), (m) => m === null],
  ['이름 7자', enc('v1|name|가나다라마바사|1023012230|0|별명'), (m) => m === null],
  ['<script> 별명(문자 제거)', enc('v1|name|윤재|1023012230|0|<script>alert(1)</script>'), (m) => m && !/[<>\/]/.test(m.title) && m.title.includes('scriptalert(1)script')],
  ['답변코드 9자리', enc('v1|name|윤재|102301223|0|후반 12분 윤재투입'), (m) => m === null],
];
let pass = 0;
for (const [label, d, ok] of cases) {
  const m = parseD(d);
  const good = !!ok(m);
  console.log(`${good ? 'PASS' : 'FAIL'}  parseD: ${label} → ${m ? m.title : 'null'}`);
  if (good) pass++;
}

// ---- 2. onRequest + 간이 HTMLRewriter ----
class StubRewriter {
  constructor() { this.h = []; }
  on(sel, handler) { this.h.push([sel, handler]); return this; }
  transform(res) {
    const hs = this.h;
    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const apply = (html) => {
      for (const [sel, handler] of hs) {
        let re;
        if (sel === 'head') re = /<head>/;
        else if (sel === 'title') re = /<title>[^<]*<\/title>/;
        else { const m = /^meta\[(property|name)="([^"]+)"\]$/.exec(sel); re = new RegExp(`<meta ${m[1]}="${m[2]}" content="[^"]*">`); }
        html = html.replace(re, (tag) => {
          let out = tag;
          handler.element({
            prepend: (s) => { out = out + s; },
            setAttribute: (k, v) => { out = out.replace(new RegExp(`${k}="[^"]*"`), `${k}="${esc(v)}"`); },
            setInnerContent: (s) => { out = `<title>${esc(s)}</title>`; },
          });
          return out;
        });
      }
      return html;
    };
    return new Response(new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode(apply(await res.text()))); c.close(); } }), { status: res.status, headers: res.headers });
  }
}
globalThis.HTMLRewriter = StubRewriter;
const INDEX = readFileSync(new URL('../../fun/index.html', import.meta.url), 'utf8');
const env = { ASSETS: { fetch: async (req) => (new URL(req.url).pathname === '/fun/' ? new Response(INDEX, { status: 200 }) : new Response('nf', { status: 404 })) } };
const brokenEnv = { ASSETS: { fetch: async () => { throw new Error('down'); } } };
const get = (re, html) => (re.exec(html) || [])[1];
let fpass = 0, ftotal = 0;
for (const [label, d, ok] of cases) {
  ftotal++;
  const url = 'https://fifagosu.pages.dev/fun/r/?d=' + encodeURIComponent(d);
  const res = await onRequest({ request: new Request(url), env });
  const html = await res.text();
  const ogt = get(/<meta property="og:title" content="([^"]*)">/, html);
  const ogu = get(/<meta property="og:url" content="([^"]*)">/, html);
  const twt = get(/<meta name="twitter:title" content="([^"]*)">/, html);
  const m = parseD(d);
  const hasBase = /<head><base href="\/fun\/">/.test(html);
  const good = res.status === 200 && hasBase && (m ? ogt.includes(m.title.replace(/'/g, "'").slice(0, 6)) && twt === ogt && ogu === url : ogt === '킥킥 · 내가 축구선수라면? 1분 축구 테스트') && !/<script>alert/.test(html);
  console.log(`${good ? 'PASS' : 'FAIL'}  onRequest: ${label} → status ${res.status}, base ${hasBase}, og:title "${ogt}"`);
  if (good) fpass++;
}
const down = await onRequest({ request: new Request('https://fifagosu.pages.dev/fun/r/?d=abc'), env: brokenEnv });
const downOk = down.status === 302 && down.headers.get('location') === 'https://fifagosu.pages.dev/fun/?d=abc';
console.log(`${downOk ? 'PASS' : 'FAIL'}  onRequest: ASSETS 장애 → ${down.status} ${down.headers.get('location')}`);
console.log(`\nparseD ${pass}/${cases.length}, onRequest ${fpass}/${ftotal}, 장애 대비 ${downOk ? 1 : 0}/1`);
process.exit(pass === cases.length && fpass === ftotal && downOk ? 0 : 1);
