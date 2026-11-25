/* Public FC Online boost helper: read-only OVR quotes and verified full-gauge plans.
 * Request only on selected player/stage, not the full market. 6-hour shared cache.
 * No credentials or user identifiers sent upstream. No retries on rejection. */
const BASE="https://fconline.nexon.com",SOURCE=BASE+"/DataCenter/PlayerGrow",TTL=6*3600;
const safe=v=>Number.isSafeInteger(v)&&v>0;
const json=(status,body,ttl=0)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":ttl?"public, max-age="+ttl:"no-store","x-content-type-options":"nosniff"}});
const rowsOf=j=>Array.isArray(j)?j:Array.isArray(j?.ResultData)?j.ResultData:Array.isArray(j?.ResultData?.PlayerList)?j.ResultData.PlayerList:null;
const pct=x=>typeof x==="number"||typeof x==="string"&&/^\d+(\.\d+)?$/.test(x)?Number(x):NaN;
export function quoteRows(raw){
 const rows=rowsOf(raw);if(!rows||rows.length>200)return [];
 const out=new Map();
 for(const r of rows){const o=Number(r?.ovr),price=Number(r?.monthly_average_price),g=pct(r?.stretc);
  if(!Number.isInteger(o)||o<1||o>250||!safe(price)||!Number.isFinite(g)||g<=0||g>100)continue;
  const v={ovr:o,price,points:Math.round(g*100),percent:g};
  if(!out.has(o)||price<out.get(o).price)out.set(o,v);
 }
 return [...out.values()].sort((a,b)=>a.ovr-b.ovr);
}
export function cheapestFull(rows,conservative=false){
 const byPoints=new Map();
 for(const r of rows){const points=conservative&&r.points<10000?r.points-1:r.points;if(points<=0)continue;const c={...r,points},prev=byPoints.get(points);if(!prev||c.price<prev.price)byPoints.set(points,c)}
 let bound=Infinity;const choices=[...byPoints.values()].sort((a,b)=>b.points-a.points||a.price-b.price).filter(c=>{if(c.price>=bound)return false;bound=c.price;return true});
 let dp=new Map([[0,{cost:0,cards:[]}]]),best=null;
 for(let n=1;n<=5&&dp.size;n++){const next=new Map();
  for(const [p,s] of dp)for(const c of choices){const cost=s.cost+c.price,points=Math.min(10000,p+c.points);if(!safe(cost)||best&&cost>=best.cost)continue;const v={cost,cards:[...s.cards,c]};if(points===10000){best=v;continue}if(!next.has(points)||next.get(points).cost>cost)next.set(points,v)}
  dp=new Map();let limit=Infinity;for(const [p,v] of [...next].sort((a,b)=>b[0]-a[0]))if(v.cost<limit){dp.set(p,v);limit=v.cost}
 }
 return best;
}
const ddl=["CREATE TABLE IF NOT EXISTS boost_quote_cache (key TEXT PRIMARY KEY, created INTEGER NOT NULL, body TEXT NOT NULL)","CREATE INDEX IF NOT EXISTS boost_quote_created ON boost_quote_cache(created)","CREATE TABLE IF NOT EXISTS boost_quote_gate (id INTEGER PRIMARY KEY CHECK(id=1), bucket INTEGER NOT NULL, n INTEGER NOT NULL)"];
const ready=new WeakMap(),inflight=new Map();
async function ensure(db){if(!ready.has(db))ready.set(db,db.batch(ddl.map(s=>db.prepare(s))).catch(e=>{ready.delete(db);throw e}));await ready.get(db)}
function fault(code,status=503){const e=Error(code);e.code=code;e.status=status;return e}
async function upstream(endpoint,fields,spid,grade){
 const kind=endpoint==="RecommendOVRList"?"quotes":"verify";
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  let r;
  try{r=await fetch(BASE+"/datacenter/"+endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded; charset=UTF-8","x-requested-with":"XMLHttpRequest","accept":"application/json, text/plain, */*","accept-language":"ko-KR,ko;q=0.9","origin":BASE,"referer":SOURCE,"user-agent":"Mozilla/5.0 (compatible; FIFAGOSU-DataBot/1.0)"},body:new URLSearchParams(fields).toString(),signal:controller.signal,redirect:"manual"})}
  catch{throw fault(kind+(controller.signal.aborted?"_timeout":"_network"))}
  if(!r.ok)throw fault(kind+"_http_"+r.status,r.status===429||r.status===403?429:503);
  const raw=await r.text();if(raw.length>3000000)throw fault(kind+"_size");
  try{return JSON.parse(raw)}catch{throw fault(kind+"_format")}
 }finally{clearTimeout(timer)}
}
const pause=()=>new Promise(r=>setTimeout(r,1500));
export async function fetchOfficialPlan(spid,grade,call=upstream,delay=pause){
 const args={n8SpId:String(spid),n1Strong:String(grade),n4BoostPer:"0"};
 const rows=quoteRows(await call("RecommendOVRList",args,spid,grade));
 if(!rows.length)throw fault("quotes_empty");
 const plan=cheapestFull(rows);
 if(!plan)return {source:SOURCE,spid,grade,rows,plan:null,reason:"no_full_combo"};
 async function verify(candidate){await delay();const raw=await call("PlayerGrowCalApi",{...args,idx:"1",strCalinfo:","+candidate.cards.map(c=>c.ovr).join(",")+","},spid,grade);
  const d=raw?.ResultData??raw;const gauge=pct(d?.strBoostPer);if(!Number.isFinite(gauge)||gauge<0||gauge>100)throw fault("verify_format");
  return gauge;
 }
 let chosen=plan,gauge=await verify(chosen);
 if(gauge!==100){const conservative=cheapestFull(rows,true);if(!conservative||conservative.cards.map(c=>c.ovr).join()===chosen.cards.map(c=>c.ovr).join())return {source:SOURCE,spid,grade,rows,plan:null,reason:"not_verified"};
  chosen=conservative;gauge=await verify(chosen);
 }
 return {source:SOURCE,spid,grade,rows,plan:gauge===100?{cost:chosen.cost,cards:chosen.cards.map(c=>({ovr:c.ovr,price:c.price,percent:c.percent})),gauge,grade,official:true}:null,reason:gauge===100?null:"not_verified"};
}
export async function onRequestGet({request,env,waitUntil}){
 const u=new URL(request.url),id=u.searchParams.get("spid")||"",g=u.searchParams.get("grade")||"";
 if(!/^\d{8,9}$/.test(id)||! /^(?:[1-9]|1[012])$/.test(g)||request.headers.get("sec-fetch-site")==="cross-site")return json(400,{message:"선수와 강화 단계를 확인해 주세요."});
 const spid=Number(id),grade=Number(g),key=spid+":"+grade,db=env.COMMUNITY_DB;
 if(!db)return json(503,{message:"공식 강화 도우미 연결 준비 중입니다."});
 let stage="cache_init";
 try{
  await ensure(db);const now=Math.floor(Date.now()/1000);stage="cache_read";
  const hit=await db.prepare("SELECT body,created FROM boost_quote_cache WHERE key=? AND created>?").bind(key,now-TTL).first();
  if(hit){return json(200,JSON.parse(hit.body),Math.max(1,TTL-now+hit.created))}
  if(!inflight.has(key)){
   const task=(async()=>{
    // Global aggregate request budget. No IP or account data in this table.
    stage="request_budget";const bucket=Math.floor(now/60),gate=await db.prepare("INSERT INTO boost_quote_gate(id,bucket,n) VALUES(1,?,1) ON CONFLICT(id) DO UPDATE SET bucket=excluded.bucket,n=CASE WHEN bucket=excluded.bucket THEN n+1 ELSE 1 END WHERE bucket<>excluded.bucket OR n<8 RETURNING n").bind(bucket).first();
    if(!gate)throw fault("request_limit",429);
    stage="official";const data={...await fetchOfficialPlan(spid,grade),generated:now};
    stage="cache_write";
    await db.prepare("INSERT INTO boost_quote_cache(key,created,body) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET created=excluded.created,body=excluded.body").bind(key,now,JSON.stringify(data)).run();
    if(Math.random()<.02)await db.prepare("DELETE FROM boost_quote_cache WHERE created<?").bind(now-2*86400).run();
    return data;
   })().finally(()=>inflight.delete(key));inflight.set(key,task)
  }
  return json(200,await inflight.get(key),TTL);
 }catch(e){const status=e.status===429?429:503;const code=e.code||stage;console.warn("boost unavailable",code);return json(status,{code,message:status===429?"공식 도우미 요청이 제한되었습니다. 잠시 뒤 다시 시도해 주세요.":"공식 강화 도우미 시세를 확인하지 못했습니다. 수동 입력 또는 다시 시도해 주세요."})}
}
