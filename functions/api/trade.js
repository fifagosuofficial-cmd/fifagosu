/**
 * 피파고수 선수장터 API (Cloudflare Pages Functions + D1 무료 요금제)
 *
 *   GET  /api/trade?kind=sell|buy&q=이름&open=1&before=글번호   → {items:[…], more}
 *   POST /api/trade  {action:"create", kind, spid, pname, grade, price, nick, body, pw, hp}
 *   POST /api/trade  {action:"done"|"delete", id, pw}
 *
 * 준비(대표가 한 번만): Cloudflare 대시보드 → Workers & Pages → D1 → 데이터베이스 만들기(이름 fifagosu-trade)
 *   → Pages 프로젝트 fifagosu → 설정 → 바인딩 → D1 데이터베이스 추가, 변수 이름 TRADE_DB.
 *   표는 첫 요청 때 자동으로 만들어요. (선택) 환경 변수 TRADE_SALT 에 아무 긴 문자열을 넣으면 IP 해시가 더 안전해져요.
 *
 * 안전장치: 비밀번호는 PBKDF2 해시로만 저장, IP는 해시로만 저장(도배 제한용), 같은 IP 10분 3개·하루 20개,
 *   현금·계정 거래 문구 차단, 14일 지난 글은 목록에서 숨기고 30일 지나면 삭제.
 */
const DAY = 86400;
const SHOW_DAYS = 14;
const KEEP_DAYS = 30;
const PAGE = 30;
const BANNED = /(현금|계좌|입금|송금|원\s*에\s*팝|만\s*원|천\s*원|계정\s*(거래|판매|구매|팝|삽)|아이디\s*판매|rmt|카톡\s*아이디|오픈\s*카톡|텔레그램|https?:\/\/)/i;

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS trade_posts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     kind TEXT NOT NULL, spid INTEGER NOT NULL, pname TEXT NOT NULL, grade INTEGER NOT NULL,
     price INTEGER NOT NULL, nick TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
     pw TEXT NOT NULL, salt TEXT NOT NULL, iph TEXT NOT NULL,
     status INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS ix_trade_created ON trade_posts(created)',
  'CREATE INDEX IF NOT EXISTS ix_trade_iph ON trade_posts(iph, created)',
];
async function ensure(db) {
  await db.batch(SCHEMA.map((q) => db.prepare(q)));
}
/** 표가 아직 없으면 만들고 한 번 더 시도 */
async function run(db, fn) {
  try {
    return await fn();
  } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await ensure(db);
    return fn();
  }
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
async function pwHash(pw, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 20000 }, key, 256));
}
function sameHex(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanBody = (s, max) => String(s == null ? '' : s).replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const pub = (r) => ({ id: r.id, kind: r.kind, spid: r.spid, pname: r.pname, grade: r.grade, price: r.price, nick: r.nick, body: r.body, status: r.status, created: r.created });

async function list(db, url) {
  const now = Math.floor(Date.now() / 1000);
  const where = ['created > ?'];
  const args = [now - SHOW_DAYS * DAY];
  const kind = url.searchParams.get('kind');
  if (kind === 'sell' || kind === 'buy') { where.push('kind = ?'); args.push(kind); }
  if (url.searchParams.get('open') === '1') where.push('status = 0');
  const spid = parseInt(url.searchParams.get('spid') || '', 10);
  if (spid > 0) { where.push('spid = ?'); args.push(spid); }
  const q = clean(url.searchParams.get('q'), 30).replace(/[%_]/g, '');
  if (q) { where.push("replace(pname, ' ', '') LIKE ?"); args.push('%' + q.replace(/\s+/g, '') + '%'); }
  const before = parseInt(url.searchParams.get('before') || '', 10);
  if (before > 0) { where.push('id < ?'); args.push(before); }
  const sql = `SELECT id, kind, spid, pname, grade, price, nick, body, status, created FROM trade_posts WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${PAGE + 1}`;
  const { results } = await run(db, () => db.prepare(sql).bind(...args).all());
  const rows = results || [];
  return json(200, { items: rows.slice(0, PAGE).map(pub), more: rows.length > PAGE });
}

async function create(db, env, request, b) {
  if (b.hp) return json(400, { message: '잘못된 요청이에요.' });          // 봇이 채우는 숨은 칸
  const kind = b.kind === 'buy' ? 'buy' : b.kind === 'sell' ? 'sell' : '';
  const spid = parseInt(b.spid, 10);
  const grade = parseInt(b.grade, 10);
  const price = Math.round(Number(b.price));
  const pname = clean(b.pname, 40);
  const nick = clean(b.nick, 20);
  const body = cleanBody(b.body, 300);
  const pw = String(b.pw || '');
  if (!kind) return json(400, { message: '팝니다/삽니다를 골라 주세요.' });
  if (!(spid > 100000000 && spid < 1000000000) || !pname) return json(400, { message: '선수를 검색해서 골라 주세요.' });
  if (!(grade >= 1 && grade <= 13)) return json(400, { message: '강화 단계를 확인해 주세요.' });
  if (!(price >= 10000 && price <= 1e15)) return json(400, { message: '희망가는 1만 BP 이상으로 적어 주세요.' });
  if (nick.length < 2) return json(400, { message: '구단주 닉네임을 2자 이상 적어 주세요.' });
  if (pw.length < 4 || pw.length > 32) return json(400, { message: '비밀번호는 4~32자로 적어 주세요.' });
  if (BANNED.test(nick + ' ' + body)) return json(400, { message: '현금·계정 거래나 외부 연락처·링크는 올릴 수 없어요.' });

  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  const iph = (await sha((env.TRADE_SALT || 'fifagosu-trade') + '|' + ip)).slice(0, 32);
  const recent = await run(db, () => db.prepare('SELECT SUM(created > ?) AS m10, COUNT(*) AS d1 FROM trade_posts WHERE iph = ? AND created > ?')
    .bind(now - 600, iph, now - DAY).first());
  if (recent && (recent.m10 || 0) >= 3) return json(429, { message: '10분에 3개까지 올릴 수 있어요. 잠시 뒤에 다시 올려 주세요.' });
  if (recent && (recent.d1 || 0) >= 20) return json(429, { message: '하루에 20개까지 올릴 수 있어요.' });

  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await pwHash(pw, salt);
  const r = await run(db, () => db.prepare('INSERT INTO trade_posts (kind, spid, pname, grade, price, nick, body, pw, salt, iph, status, created) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)')
    .bind(kind, spid, pname, grade, price, nick, body, hash, salt, iph, now).run());
  // 오래된 글 정리(가끔만)
  if (Math.random() < 0.1) await db.prepare('DELETE FROM trade_posts WHERE created < ?').bind(now - KEEP_DAYS * DAY).run().catch(() => {});
  const id = r && r.meta && r.meta.last_row_id;
  return json(201, { ok: true, item: pub({ id, kind, spid, pname, grade, price, nick, body, status: 0, created: now }) });
}

async function change(db, b, action) {
  const id = parseInt(b.id, 10);
  const pw = String(b.pw || '');
  if (!(id > 0) || !pw) return json(400, { message: '글 번호와 비밀번호를 확인해 주세요.' });
  const row = await run(db, () => db.prepare('SELECT id, pw, salt, status FROM trade_posts WHERE id = ?').bind(id).first());
  if (!row) return json(404, { message: '이미 지워졌거나 없는 글이에요.' });
  if (!sameHex(await pwHash(pw, row.salt), row.pw)) return json(403, { message: '비밀번호가 맞지 않아요.' });
  if (action === 'delete') await db.prepare('DELETE FROM trade_posts WHERE id = ?').bind(id).run();
  else await db.prepare('UPDATE trade_posts SET status = ? WHERE id = ?').bind(row.status ? 0 : 1, id).run();
  return json(200, { ok: true, id, status: action === 'delete' ? -1 : (row.status ? 0 : 1) });
}

export async function onRequest({ request, env }) {
  const db = env.TRADE_DB;
  if (!db) return json(503, { code: 'no_db', message: '선수장터 저장소가 아직 연결되지 않았어요. 곧 열려요!' });
  const url = new URL(request.url);
  try {
    if (request.method === 'GET') return await list(db, url);
    if (request.method !== 'POST') return json(405, { message: 'GET·POST만 지원해요.' });
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) return json(403, { message: '다른 사이트에서 보낸 요청은 받을 수 없어요.' });
    if (+(request.headers.get('content-length') || 0) > 4096) return json(413, { message: '내용이 너무 길어요.' });
    const b = await request.json().catch(() => null);
    if (!b || typeof b !== 'object') return json(400, { message: '잘못된 요청이에요.' });
    if (b.action === 'create') return await create(db, env, request, b);
    if (b.action === 'done' || b.action === 'delete') return await change(db, b, b.action);
    return json(400, { message: '알 수 없는 요청이에요.' });
  } catch (e) {
    return json(500, { message: '잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.' });
  }
}
