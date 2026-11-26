// Community API. Disabled unless operator explicitly configures reviewed policies and bindings.
// Deployment gate retains v1 compatibility; v2 is the new member consent revision.
const POLICY="2026-11-v2", LEGACY_POLICY="2026-11-v1";
const cats=new Set(["free","squad","review","tips","pack"]);
const prefixes=new Set(["normal","question","answer","notice"]);
const enc=new TextEncoder(), now=()=>Math.floor(Date.now()/1000);
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))),x=>x.toString(16).padStart(2,"0")).join("");
const challenge=async s=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
const cookie=(name,v,max)=>name+"="+v+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+max;
const getCookie=(req,name)=>req.headers.get("Cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(name+"="))?.slice(name.length+1)||"";
const redirect=(url,headers={})=>new Response(null,{status:303,headers:{location:url,"cache-control":"no-store",...headers}});
class Err extends Error{constructor(message,status=400){super(message);this.status=status}}
function check(v,msg,status=400){if(!v)throw new Err(msg,status)}
const str=(v,max,min=1)=>{check(typeof v==="string"&&v.trim().length>=min&&v.trim().length<=max,"입력 내용을 확인해 주세요.");return v.trim()};
const integer=(v,min=1,max=Number.MAX_SAFE_INTEGER)=>{check(Number.isSafeInteger(v)&&v>=min&&v<=max,"잘못된 번호입니다.");return v};
const adminFor=(env,m)=>Boolean(m&&String(env.COMMUNITY_ADMIN_SUBS||"").split(",").map(x=>x.trim()).includes(m.subject));
// Author verification is calculated on the server. Never return the Google subject.
const LEVELS=[[0,"0강냥",0],[30,"1강냥",1],[100,"3강냥",3],[500,"5강냥",5],[2000,"8강냥",8],[8000,"11강냥",11],[16000,"13강냥",13]];
function rankFor(points){points=Math.max(0,Number(points)||0);let i=LEVELS.length-1;while(i>0&&points<LEVELS[i][0])i--;return {level:i+1,grade:LEVELS[i][2],name:LEVELS[i][1],points,next:LEVELS[i+1]?.[0]??null,floor:LEVELS[i][0]}}
const publicAuthor=(env,{author_subject,author_id,...row},ranks=new Map())=>({...row,verified:!!author_subject&&adminFor(env,{subject:author_subject}),rank:author_id?ranks.get(author_id)||rankFor(0):null});
// Daily activity is capped per UTC day; positive votes from other members count only on visible content.
const XP_SQL="(SELECT COALESCE(sum(min(n,3)),0)*5 FROM (SELECT count(*) n FROM posts p WHERE p.author=m.id AND p.hidden=0 GROUP BY p.created/86400))+(SELECT COALESCE(sum(min(n,8)),0) FROM (SELECT count(*) n FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.author=m.id AND c.hidden=0 AND p.hidden=0 GROUP BY c.created/86400))+(SELECT count(*)*3 FROM votes v JOIN posts p ON p.id=v.post_id WHERE p.author=m.id AND p.hidden=0 AND v.member_id<>m.id)+(SELECT count(*)*2 FROM comment_votes v JOIN comments c ON c.id=v.comment_id JOIN posts p ON p.id=c.post_id WHERE c.author=m.id AND c.hidden=0 AND p.hidden=0 AND v.value=1 AND v.member_id<>m.id)+(SELECT COALESCE(sum(reward-fee),0) FROM arcade_rounds ar WHERE ar.member_id=m.id)";
async function authorRanks(db,ids){const out=new Map(),unique=[...new Set(ids.filter(Boolean))];for(let i=0;i<unique.length;i+=40){const chunk=unique.slice(i,i+40),q=chunk.map(()=>"?").join(",");const sql="SELECT m.id, "+XP_SQL+" points FROM members m WHERE m.id IN ("+q+")";const rows=(await db.prepare(sql).bind(...chunk).all()).results;for(const r of rows)out.set(r.id,rankFor(r.points))}return out}
async function publicRows(env,db,rows){const ranks=await authorRanks(db,rows.map(r=>r.author_id));return rows.map(r=>publicAuthor(env,r,ranks))}

// Additive, idempotent migration. Existing votes and content are never rewritten.
const boardDDL=["CREATE TABLE IF NOT EXISTS arcade_rounds(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,game TEXT NOT NULL,day INTEGER NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,issued INTEGER NOT NULL,questions TEXT NOT NULL,step INTEGER NOT NULL DEFAULT 0,score INTEGER NOT NULL DEFAULT 0,fee INTEGER NOT NULL CHECK(fee IN (0,2)),reward INTEGER NOT NULL DEFAULT 0,state INTEGER NOT NULL DEFAULT 0 CHECK(state IN (0,1,2)))","CREATE INDEX IF NOT EXISTS arcade_owner_day ON arcade_rounds(member_id,day)","CREATE INDEX IF NOT EXISTS arcade_week ON arcade_rounds(game,day,state,score)","CREATE UNIQUE INDEX IF NOT EXISTS arcade_one_active ON arcade_rounds(member_id) WHERE state=0","CREATE TABLE IF NOT EXISTS post_dislikes(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,PRIMARY KEY(member_id,post_id))","CREATE INDEX IF NOT EXISTS post_dislike_post ON post_dislikes(post_id)","CREATE TABLE IF NOT EXISTS comment_votes(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,value INTEGER NOT NULL CHECK(value IN (-1,1)),PRIMARY KEY(member_id,comment_id))","CREATE INDEX IF NOT EXISTS comment_vote_comment ON comment_votes(comment_id)","CREATE TABLE IF NOT EXISTS comment_replies(comment_id INTEGER PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,parent_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE)"];
const migrated=new WeakMap();
async function ensureBoard(db){if(!migrated.has(db)){const job=(async()=>{const ready=await db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('post_dislikes','comment_votes','comment_replies','arcade_rounds')").first();if(ready?.n!==4)await db.batch(boardDDL.map(sql=>db.prepare(sql)))})().catch(e=>{migrated.delete(db);throw e});migrated.set(db,job)}await migrated.get(db)}
const upCount="(SELECT count(*) FROM votes v WHERE v.post_id=p.id)";
const downCount="(SELECT count(*) FROM post_dislikes d WHERE d.post_id=p.id)";
const netCount=upCount+"-"+downCount;
function squadPayload(v){
 check(v?.schema===1&&Array.isArray(v.players)&&v.players.length===11&&v.opts&&typeof v.opts==="object","스쿼드 형식이 올바르지 않습니다.");
 const players=v.players.map(p=>({id:integer(p.id),grade:integer(p.grade,1,13),name:str(p.name,80),pos:str(p.pos,4)}));
 check(new Set(players.map(p=>p.id%1000000)).size===11,"중복 선수입니다.");
 const o=v.opts,opts={budget:integer(o.budget),salary:integer(o.salary,11,315),team:integer(o.team??0,0),formation:str(o.formation,12),style:str(o.style,20),grades:Array.isArray(o.grades)?o.grades.map(x=>integer(x,1,13)):[]};
 check(opts.grades.length>0&&opts.grades.length<=13,"강화 범위를 확인해 주세요.");
 return {schema:1,opts,mode:["performance","balanced","value"].includes(v.mode)?v.mode:"balanced",players};
}

const opsDDL="CREATE TABLE IF NOT EXISTS ops_counts(hour INTEGER NOT NULL, channel TEXT NOT NULL, feature TEXT NOT NULL, outcome TEXT NOT NULL, n INTEGER NOT NULL, total_ms INTEGER NOT NULL, max_ms INTEGER NOT NULL, last_at INTEGER NOT NULL, PRIMARY KEY(hour,channel,feature,outcome)) WITHOUT ROWID",opsInsert="INSERT INTO ops_counts(hour,channel,feature,outcome,n,total_ms,max_ms,last_at) VALUES(?,?,?,?,1,?,?,?) ON CONFLICT(hour,channel,feature,outcome) DO UPDATE SET n=n+1,total_ms=total_ms+excluded.total_ms,max_ms=MAX(max_ms,excluded.max_ms),last_at=MAX(last_at,excluded.last_at)";
const opsFeatures=new Set(["diag_official","diag_manager","card_search","boost_lookup","enhance_sim","cash_calc","squad_generate","mini_game"]);
const opsOutcomes=new Set(["ok","empty","error"]);
async function ensureOps(db){await db.prepare(opsDDL).run()}
async function opsSummary(db,u,env){
 await ensureOps(db);const t=now(),hour=Math.floor(t/3600),day=trafficDay(t),range=u.searchParams.get("range")==="1"?1:u.searchParams.get("range")==="30"?30:7,from=(day-range+1)*24-9;
 const q=(sql,...args)=>db.prepare(sql).bind(...args);
 await q("DELETE FROM ops_counts WHERE hour<?",(day-29)*24-9).run();
 const rows=(await q("SELECT channel,feature,outcome,SUM(n) n,SUM(total_ms) total_ms,MAX(max_ms) max_ms,MAX(last_at) last_at FROM ops_counts WHERE hour>=? AND hour<=? GROUP BY channel,feature,outcome",from,hour).all()).results;
 const latest=(await q("SELECT feature,outcome,last_at FROM ops_counts WHERE channel='api' AND hour>=? AND hour<=? ORDER BY last_at DESC",hour-23,hour).all()).results;
 let manifest=null;
 try{if(env.ASSETS?.fetch){const r=await env.ASSETS.fetch(new Request(u.origin+"/assets/ops-manifest.json"));if(r.ok)manifest=await r.json()}}catch{}
 return {generated:t,range,rows,latest,manifest,database:"ok",nexonConfigured:!!env.NEXON_API_KEY};
}
const trafficPages=new Set(["home","diag","market","trade","squad","cards","sim","news","board","fun","guide"]);
const trafficSources=new Set(["direct","fmkorea","inven","naver","google","dcinside","youtube","daum","instagram","other"]);
const trafficDevices=new Set(["desktop","mobile","tablet","other"]);
const trafficDay=t=>Math.floor((t+32400)/86400);
const trafficDDL="CREATE TABLE IF NOT EXISTS traffic_events(day INTEGER NOT NULL, visitor TEXT NOT NULL, minute INTEGER NOT NULL, page TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL, kind INTEGER NOT NULL CHECK(kind IN (0,1)), PRIMARY KEY(day,visitor,minute,page,kind)) WITHOUT ROWID";
const trafficReady=new WeakMap();
async function ensureTraffic(db){if(!trafficReady.has(db)){const job=(async()=>{const row=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='traffic_events'").first();if(!row)await db.prepare(trafficDDL).run()})().catch(e=>{trafficReady.delete(db);throw e});trafficReady.set(db,job)}await trafficReady.get(db)}
async function trafficSummary(db,u){
 await ensureTraffic(db);
 const t=now(),day=trafficDay(t),start=day-29,minute=Math.floor(t/60);
 const q=(s,...a)=>db.prepare(s).bind(...a),all=async(s,...a)=>(await q(s,...a).all()).results;
 await q("DELETE FROM traffic_events WHERE day<?",start).run();
 const rows=await all("SELECT day,count(DISTINCT visitor) visitors,sum(kind) views FROM traffic_events WHERE day>=? AND day<=? GROUP BY day",start,day);
 const days=Array.from({length:30},(_,i)=>({day:new Date((start+i)*86400000).toISOString().slice(0,10),visitors:0,views:0}));
 for(const r of rows){const d=days[r.day-start];if(d){d.visitors=r.visitors;d.views=r.views}}
 const range=u.searchParams.get("range")==="30"?30:u.searchParams.get("range")==="1"?1:7,from=day-range+1;
 const group=async key=>all("SELECT "+key+" label,count(*) n FROM traffic_events WHERE day>=? AND day<=? AND kind=1 GROUP BY "+key+" ORDER BY n DESC",from,day);
 const live=await q("SELECT count(DISTINCT visitor) n FROM traffic_events WHERE day>=? AND minute>? AND minute<=?",day-1,minute-5,minute).first();
 const hours=await all("SELECT ((minute+540)%1440)/60 label,count(*) n FROM traffic_events WHERE day>=? AND day<=? AND kind=1 GROUP BY label ORDER BY label",from,day);
 const signups=await q("SELECT count(*) n FROM members WHERE created>=? AND created<=?",from*86400-32400,t).first();
 return {generated:t,range,days,live:live.n,pages:await group("page"),sources:await group("source"),devices:await group("device"),hours,signups:signups.n};
}


/* Non-redeemable XP, atomic fee and award, one server-judged turn at a time. */
const ARCADE_GAMES=new Set(["penalty","player","price","lifting"]),ARCADE_LIMIT=5;
const arcadeDay=()=>Math.floor((now()+32400)/86400),arcadeWeek=d=>d-((d+3)%7+7)%7;
const ri=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n;
function mix(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
const PLAYER_QUIZ=[
["아르헨티나 · 발롱도르 8회","리오넬 메시","크리스티아누 호날두","네이마르","킬리안 음바페"],
["포르투갈 · CR7","크리스티아누 호날두","루이스 피구","페페","브루누 페르난데스"],
["대한민국 · 2021-22 EPL 공동 득점왕","손흥민","박지성","황희찬","김민재"],
["브라질 · 월드컵 3회 우승","펠레","호나우두","호나우지뉴","카카"],
["아르헨티나 · 1986 월드컵 · 신의 손","디에고 마라도나","가브리엘 바티스투타","리오넬 메시","후안 로만 리켈메"],
["프랑스 · 1998 월드컵 결승 헤더 두 골","지네딘 지단","티에리 앙리","다비드 트레제게","파트리크 비에이라"],
["이탈리아 · 로마의 왕자 · 등번호 10","프란체스코 토티","알레산드로 델 피에로","안드레아 피를로","파올로 말디니"],
["잉글랜드 · 프리킥 · 맨유와 레알에서 활약","데이비드 베컴","스티븐 제라드","프랭크 램파드","웨인 루니"],
["네덜란드 · 토털 풋볼 · 등번호 14","요한 크루이프","루드 굴리트","마르코 반바스텐","데니스 베르캄프"],
["스페인 · 2010 월드컵 결승 결승골","안드레스 이니에스타","차비 에르난데스","다비드 비야","세르히오 라모스"],
["독일 · 2014 월드컵 우승 · 스위퍼 키퍼","마누엘 노이어","올리버 칸","미로슬라프 클로제","필리프 람"],
["크로아티아 · 2018 발롱도르","루카 모드리치","이반 라키티치","마리오 만주키치","다보르 슈케르"],
["이집트 · 리버풀의 왼발 공격수","모하메드 살라","사디오 마네","디디에 드로그바","리야드 마레즈"],
["노르웨이 · 2022-23 EPL 36골","엘링 홀란","마르틴 외데고르","해리 케인","로베르트 레반도프스키"],
["브라질 · 2002 월드컵 결승 두 골","호나우두","히바우두","카푸","호나우지뉴"],
["이탈리아 · 2006 월드컵 우승 골키퍼","잔루이지 부폰","이케르 카시야스","디노 조프","파비오 칸나바로"],
["스페인 · 라 데시마 결승 동점골","세르히오 라모스","라울 곤살레스","카를레스 푸욜","페르난도 토레스"],
["프랑스 · 아스널 무패 우승 공격수","티에리 앙리","로베르 피레스","올리비에 지루","카림 벤제마"]];

function liftingQuestion(i,fromX=128,fromDirection=1,practice=false){
 // Touch #5 is expert, touch #15 is hyper. Difficulty keeps increasing to a mobile-playable floor.
 const tier=i<4?"ROOKIE":i<14?"EXPERT":"HYPER";
 const target=i<4?1810-i*130:i<14?1120-(i-4)*28:Math.max(360,620-(i-14)*12);
 const window=i<4?390-i*45:i<14?220-(i-4)*6:Math.max(85,125-(i-14)*2);
 const distance=34+Math.min(34,Math.floor(i*2))+ri(17);
 const options=[0,1].filter(d=>fromX+(d===0?-distance:distance)>=42&&fromX+(d===0?-distance:distance)<=214);
 const direction=options.length?options[ri(options.length)]:fromX<128?1:0;
 const landX=Math.max(42,Math.min(214,fromX+(direction===0?-distance:distance)));
 return {v:4,practice,tier,prompt:"공이 발에 닿는 순간 이동 방향을 누르세요!",choices:["왼쪽","오른쪽","놓침"],direction,fromX,fromDirection,landX,target:target+ri(i<4?65:i<14?45:25),window,height:Math.max(34,76-Math.min(i,42))+ri(8)};
}
const liftingLead=i=>i===0?650:i<4?260:i<14?150:85;
const liftingReward=score=>score>=50?100:score>=30?70:score>=20?50:score>=15?35:score>=10?20:score>=5?12:score*2;

async function gameQuestions(game,env,u){
 if(game==="player")return mix(PLAYER_QUIZ).slice(0,5).map(([prompt,correct,...wrong])=>{const choices=mix([correct,...wrong]);return {prompt,choices,answer:choices.indexOf(correct)}});
 if(game==="penalty")return Array.from({length:5},()=>({v:2,prompt:"슛 방향을 선택하세요!",choices:["왼쪽","가운데","오른쪽"],keeper:ri(3)}));
 if(game==="lifting")return [liftingQuestion(0)];
 check(env.ASSETS&&typeof env.ASSETS.fetch==="function","시세 데이터 준비 중입니다.",503);
 const res=await env.ASSETS.fetch(new Request(u.origin+"/fun/price-pool.json"));check(res.ok,"시세 데이터 준비 중입니다.",503);
 const data=await res.json(),groups=(data.groups||[]).filter(g=>g.cards?.length>=10);check(groups.length,"시세 데이터 준비 중입니다.",503);
 const questions=[],used=new Set();
 for(let i=0;i<300&&questions.length<5;i++){const g=groups[ri(groups.length)],a=g.cards[ri(g.cards.length)],b=g.cards[ri(g.cards.length)];if(a[0]===b[0]||a[1]===b[1]||Math.max(a[2],b[2])/Math.min(a[2],b[2])<1.1||Math.max(a[2],b[2])/Math.min(a[2],b[2])>20)continue;const k=[a[0],b[0]].sort().join(":")+":"+g.grade;if(used.has(k))continue;used.add(k);questions.push({prompt:g.grade+"강 기준, 더 비싼 카드는?",choices:[a[1],b[1]],answer:a[2]>b[2]?0:1,prices:[a[2],b[2]],date:data.date||""})}
 check(questions.length===5,"비교할 시세가 부족합니다.",503);return questions;
}
const rewardFor=s=>s>=5?12:s*2;
const isPractice=row=>JSON.parse(row.questions)[0]?.practice===true;
const rewardEligible="COALESCE(json_extract(questions,'$[0].practice'),0)=0";
function gamePublic(row){let question=null;if(row.state===0){const {answer,prices,keeper,practice,...q}=JSON.parse(row.questions)[row.game==="lifting"?0:row.step];question=q}return {id:row.id,game:row.game,step:row.step,score:row.score,fee:row.fee,reward:row.reward,state:row.state,issued:row.issued,serverNow:Date.now(),practice:isPractice(row),question}}
function gameCorrect(game,q,a,elapsed){
 if(elapsed<0)return false;
 if(game==="penalty")return a!==q.keeper;
 if(game==="lifting")return q.v===4&&(a===0||a===1)&&a===q.direction&&Math.abs(elapsed-q.target)<=q.window;
 return a===q.answer;
}
async function arcadeApi({p,b,m,db,env,u,received=Date.now()}){
 await ensureBoard(db);
 const day=arcadeDay(),t=now(),q=(s,...a)=>db.prepare(s).bind(...a),first=(s,...a)=>q(s,...a).first(),all=async(s,...a)=>(await q(s,...a).all()).results;
 await q("UPDATE arcade_rounds SET state=2,reward=fee WHERE member_id=? AND state=0 AND (expires<=? OR (game='penalty' AND COALESCE(json_extract(questions,'$[0].v'),0)<>2) OR (game='lifting' AND COALESCE(json_extract(questions,'$[0].v'),0)<>4))",m.id,t).run();
 const summary=async()=>{const [r,n,pending]=await Promise.all([authorRanks(db,[m.id]),first("SELECT count(*) n FROM arcade_rounds WHERE member_id=? AND day=? AND "+rewardEligible,m.id,day),first("SELECT * FROM arcade_rounds WHERE member_id=? AND state=0",m.id)]);return {member:{nickname:m.nickname,rank:r.get(m.id)||rankFor(0)},used:n.n,limit:ARCADE_LIMIT,fee:n.n===0?0:2,pending:pending?gamePublic(pending):null}};
 if(p==="game-status"){
  const leaderboard=await all("SELECT game,nickname,score FROM (SELECT r.game,m.nickname,MAX(r.score) score,ROW_NUMBER() OVER(PARTITION BY r.game ORDER BY MAX(r.score) DESC,MIN(r.created),m.nickname) rn FROM arcade_rounds r JOIN members m ON m.id=r.member_id WHERE r.state=1 AND COALESCE(json_extract(r.questions,'$[0].practice'),0)=0 AND (r.game<>'lifting' OR json_extract(r.questions,'$[0].v')=4) AND r.day>=? AND m.suspended=0 AND m.nickname IS NOT NULL GROUP BY r.game,m.id) WHERE rn<=10 ORDER BY game,rn",arcadeWeek(day));return json({...await summary(),leaderboard});
 }
 if(p==="game-start"){
  check(ARCADE_GAMES.has(b.game)&&[0,2].includes(b.fee)&&(b.practice===undefined||typeof b.practice==="boolean")&&(!b.practice||b.fee===0),"게임과 참가비를 확인해 주세요.");
  const pending=await first("SELECT * FROM arcade_rounds WHERE member_id=? AND state=0",m.id);if(pending)return json({...await summary(),round:gamePublic(pending)});
  const questions=await gameQuestions(b.game,env,u),id=random(),issued=Date.now()+(b.game==="lifting"?650:0);
  if(b.practice===true){
   questions[0].practice=true;
   await q("DELETE FROM arcade_rounds WHERE member_id=? AND state<>0 AND NOT ("+rewardEligible+")",m.id).run();
   const row=await first("INSERT INTO arcade_rounds(id,member_id,game,day,created,expires,issued,questions,fee) SELECT ?,?,?,?,?,?,?,?,0 WHERE NOT EXISTS(SELECT 1 FROM arcade_rounds WHERE member_id=? AND state=0) RETURNING *",id,m.id,b.game,day,t,t+600,issued,JSON.stringify(questions),m.id);
   if(!row){const current=await summary();if(current.pending)return json({...current,round:gamePublic(current.pending)});throw new Err("게임을 다시 시작해 주세요.",409)}
   return json({...await summary(),round:gamePublic(row)});
  }
  const row=await first("WITH limits AS (SELECT count(*) n FROM arcade_rounds WHERE member_id=? AND day=? AND "+rewardEligible+") INSERT INTO arcade_rounds(id,member_id,game,day,created,expires,issued,questions,fee) SELECT ?,m.id,?,?,?,?,?,?,CASE WHEN limits.n=0 THEN 0 ELSE 2 END FROM members m,limits WHERE m.id=? AND limits.n<? AND (CASE WHEN limits.n=0 THEN 0 ELSE 2 END)=? AND (limits.n=0 OR ("+XP_SQL+")>=2) AND NOT EXISTS(SELECT 1 FROM arcade_rounds WHERE member_id=m.id AND state=0) RETURNING *",m.id,day,id,b.game,day,t,t+600,issued,JSON.stringify(questions),m.id,ARCADE_LIMIT,b.fee);
  if(!row){const s=await summary();if(s.pending)return json({...s,round:s.pending});throw new Err(s.used>=ARCADE_LIMIT?"오늘 참가 횟수를 모두 사용했습니다.":s.fee!==b.fee?"참가비가 변경되었습니다. 다시 확인해 주세요.":"XP가 부족합니다.",409)}return json({...await summary(),round:gamePublic(row)});
 }
 if(p==="game-answer"){
  check(typeof b.id==="string"&&/^[a-f0-9]{64}$/.test(b.id),"게임 번호 오류");const step=integer(b.step,0),answer=integer(b.answer,0,3);
  const row=await first("SELECT * FROM arcade_rounds WHERE id=? AND member_id=?",b.id,m.id);check(row,"게임을 찾을 수 없습니다.",404);
  if(row.state!==0||row.step!==step)return json({...await summary(),round:gamePublic(row)});
  const questions=JSON.parse(row.questions),lifting=row.game==="lifting",question=questions[lifting?0:step];check(question&&answer<question.choices.length,"선택지를 확인해 주세요.");
  const correct=gameCorrect(row.game,question,answer,received-row.issued),score=row.score+(correct?1:0),finished=lifting?!correct:step===questions.length-1;
  const nextQuestions=lifting&&correct?JSON.stringify([liftingQuestion(score,question.landX,question.direction,isPractice(row))]):row.questions;
  const reward=finished&&!isPractice(row)?(lifting?liftingReward(score):rewardFor(score)):0;
  const updated=await first("UPDATE arcade_rounds SET step=?,score=?,issued=?,state=?,reward=?,questions=?,expires=? WHERE id=? AND member_id=? AND state=0 AND step=? AND expires>? RETURNING *",step+1,score,Date.now()+(lifting&&!finished?liftingLead(score):0),finished?1:0,reward,nextQuestions,lifting&&!finished?t+600:row.expires,row.id,m.id,step,t);
  const result=updated||await first("SELECT * FROM arcade_rounds WHERE id=? AND member_id=?",row.id,m.id);
  return json({...await summary(),round:gamePublic(result),feedback:updated?{correct,answer:question.choices[question.answer]||null,prices:question.prices||null,...(row.game==="penalty"?{keeper:question.keeper,shot:answer}:row.game==="lifting"?{direction:question.direction,pressed:answer}:{})}:null});
 }
 throw new Err("페이지를 찾을 수 없습니다.",404);
}

export async function onRequest({request,env}){
 const received=Date.now();
 const u=new URL(request.url),p=u.pathname.replace(/^\/api\/community\/?/,"").replace(/\/$/,""),db=env.COMMUNITY_DB;
 const enabled=env.COMMUNITY_ENABLED==="1"&&[POLICY,LEGACY_POLICY].includes(env.COMMUNITY_POLICY_VERSION)&&!!db&&!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET&&env.COMMUNITY_ORIGIN===u.origin&&u.protocol==="https:";
 if(!enabled)return json({enabled:false,message:"회원·게시판 서버는 아직 연결되지 않았습니다."},503);
 const q=(sql,...args)=>db.prepare(sql).bind(...args),first=(sql,...args)=>q(sql,...args).first(),all=async(sql,...args)=>(await q(sql,...args).all()).results,run=(sql,...args)=>q(sql,...args).run();
 const ensureConsent=()=>db.prepare("CREATE TABLE IF NOT EXISTS member_consents(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,policy TEXT NOT NULL,agreed_at INTEGER NOT NULL,age_confirmed INTEGER NOT NULL CHECK(age_confirmed=1),terms_agreed INTEGER NOT NULL CHECK(terms_agreed=1),privacy_agreed INTEGER NOT NULL CHECK(privacy_agreed=1),PRIMARY KEY(member_id,policy))").run();
 const recordConsent=id=>q("INSERT INTO member_consents(member_id,policy,agreed_at,age_confirmed,terms_agreed,privacy_agreed) VALUES(?,?,?,1,1,1) ON CONFLICT(member_id,policy) DO UPDATE SET agreed_at=excluded.agreed_at",id,POLICY,now());
 const cleanup=async()=>{const t=now();await db.batch([q("DELETE FROM oauth_states WHERE expires<=?",t),q("DELETE FROM sessions WHERE expires<=?",t),q("DELETE FROM audit WHERE created<=?",t-365*86400)])};
 const reqToken=getCookie(request,"fg_session");
 let member=null;
 try{member=reqToken&&/^[a-f0-9]{64}$/.test(reqToken)?await first("SELECT m.* FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.hash=? AND s.expires>?",await sha(reqToken),now()):null;}catch{return json({message:"회원 정보 서버에 연결할 수 없습니다."},503)}
 const admin=adminFor(env,member);
 const me=()=>{check(member&&!member.suspended,"로그인 또는 계정 상태를 확인하세요.",401);check(member.policy===POLICY,"최신 약관에 동의한 뒤 이용하세요.",403);return member};
 const active=()=>{const m=me();check(m.nickname,"닉네임 설정이 필요합니다.",403);return m};
 const requireAdmin=()=>{active();check(admin,"관리자 권한이 필요합니다.",403)};
 const audit=async(action,target,reason)=>run("INSERT INTO audit(actor,action,target,reason,created) VALUES(?,?,?,?,?)",member.id,action,String(target),reason,now());
 try{
 if(request.method==="GET"){
   if(p==="game-status")return await arcadeApi({p,m:active(),db,env,u});
   if(p==="me"){if(!member)return json({enabled:true,member:null});await ensureBoard(db);const ranks=await authorRanks(db,[member.id]);if(member.game_name!==null&&member.game_name!==undefined)await run("UPDATE members SET game_name=NULL WHERE id=?",member.id);return json({enabled:true,member:{nickname:member.nickname,suspended:!!member.suspended,admin,rank:ranks.get(member.id)||rankFor(0),needsPolicy:member.policy!==POLICY}})}
   if(p==="callback"){
     const state=u.searchParams.get("state"),code=u.searchParams.get("code");
     check(state&&state===getCookie(request,"fg_oauth")&&/^[a-f0-9]{64}$/.test(state)&&code,"인증 요청이 만료되었습니다.");
     const row=await first("DELETE FROM oauth_states WHERE id=? AND expires>? RETURNING verifier,policy",await sha(state),now());
     check(row&&row.policy===POLICY,"인증 요청이 만료되었습니다.");
     const token=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:u.origin+"/api/community/callback",grant_type:"authorization_code",code_verifier:row.verifier})});
     check(token.ok,"소셜 인증에 실패했습니다.",502);
     const t=await token.json();check(t.access_token,"소셜 인증에 실패했습니다.",502);
     const info=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+t.access_token}});
     check(info.ok,"계정 정보를 확인할 수 없습니다.",502);
     const sub=str((await info.json()).sub,255);
     // The access token is used for identity only; discard it immediately after use.
     await run("INSERT INTO members(id,provider,subject,created,policy,age_confirmed) VALUES(?,?,?,?,?,1) ON CONFLICT(provider,subject) DO NOTHING",crypto.randomUUID(),"google",sub,now(),POLICY);
     const m=await first("SELECT id,suspended FROM members WHERE provider='google' AND subject=?",sub);
     check(m&&!m.suspended,"이용이 제한된 계정입니다.",403);
     const sid=random();await ensureConsent();await cleanup();
     await db.batch([q("UPDATE members SET policy=? WHERE id=?",POLICY,m.id),recordConsent(m.id),q("INSERT INTO sessions(hash,member_id,expires) VALUES(?,?,?)",await sha(sid),m.id,now()+86400*7)]);
     const h=new Headers({location:"/mypage/","cache-control":"no-store"});
     h.append("Set-Cookie",cookie("fg_session",sid,86400*7));h.append("Set-Cookie",cookie("fg_oauth","",0));return new Response(null,{status:303,headers:h});
   }
   if(p==="rankings"){
     await ensureBoard(db);
     return json({
       squads:await all("SELECT p.id,p.title,("+netCount+") likes FROM posts p WHERE p.hidden=0 AND p.category='squad' AND p.squad IS NOT NULL ORDER BY likes DESC,p.created DESC LIMIT 10"),
       players:await all("SELECT p.card_id,count(*) reviews,(SELECT count(*) FROM votes v JOIN posts t ON t.id=v.post_id WHERE t.hidden=0 AND t.category='review' AND t.card_id=p.card_id) likes FROM posts p WHERE p.hidden=0 AND p.category='review' AND p.card_id IS NOT NULL GROUP BY p.card_id ORDER BY likes DESC,reviews DESC LIMIT 10")
     });
   }
   if(p==="posts"){
     await ensureBoard(db);
     const cat=u.searchParams.get("category")||"all",search=(u.searchParams.get("q")||"").slice(0,100),card=Number(u.searchParams.get("card")||0),page=Math.min(100,Math.max(1,parseInt(u.searchParams.get("page")||"1",10)||1));
     check(cat==="all"||cat==="popular"||cats.has(cat),"게시판 분류 오류");
     const where=["p.hidden=0"],args=[];if(cats.has(cat)){where.push("p.category=?");args.push(cat)}
     if(cat==="popular")where.push("("+netCount+")>=30");
     if(search){const mode=u.searchParams.get("search")||"all";if(mode==="author"){where.push("instr(COALESCE(m.nickname,''),?)>0");args.push(search)}else if(mode==="title"){where.push("instr(p.title,?)>0");args.push(search)}else{where.push("(instr(p.title,?)>0 OR instr(p.body,?)>0)");args.push(search,search)}}
     if(card&&Number.isSafeInteger(card)){where.push("p.card_id=?");args.push(card)}
     const order=cat==="popular"?"likes DESC, replies DESC, p.created DESC":"CASE WHEN p.prefix='notice' THEN 0 ELSE 1 END,p.created DESC";
     return json({posts:await publicRows(env,db,await all("SELECT p.id,p.category,p.prefix,p.title,p.created,p.card_id,p.views,COALESCE(m.nickname,'탈퇴 회원') nickname,m.subject author_subject,m.id author_id,("+netCount+") likes,(SELECT count(*) FROM comments c WHERE c.post_id=p.id AND c.hidden=0) replies FROM posts p LEFT JOIN members m ON p.author=m.id WHERE "+where.join(" AND ")+" ORDER BY "+order+" LIMIT 30 OFFSET ?",...args,(page-1)*30))});
   }
   if(p==="post"){
     await ensureBoard(db);
     const id=integer(Number(u.searchParams.get("id"))),post=await first("SELECT p.id,p.category,p.prefix,p.title,p.body,p.squad,p.card_id,p.created,p.views,COALESCE(m.nickname,'탈퇴 회원') nickname,m.subject author_subject,m.id author_id,p.author=? own,"+upCount+" likes,"+downCount+" dislikes,CASE WHEN EXISTS(SELECT 1 FROM votes v WHERE v.post_id=p.id AND v.member_id=?) THEN 1 WHEN EXISTS(SELECT 1 FROM post_dislikes d WHERE d.post_id=p.id AND d.member_id=?) THEN -1 ELSE 0 END my_vote,EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id=p.id AND b.member_id=?) bookmarked FROM posts p LEFT JOIN members m ON p.author=m.id WHERE p.id=? AND p.hidden=0",member?.id||"",member?.id||"",member?.id||"",member?.id||"",id);
     check(post,"게시물을 찾을 수 없습니다.",404);
     const comments=await all("SELECT c.id,c.body,c.created,COALESCE(m.nickname,'탈퇴 회원') nickname,m.subject author_subject,m.id author_id,c.author=? own,(SELECT parent_id FROM comment_replies r WHERE r.comment_id=c.id) parent_id,(SELECT count(*) FROM comment_votes v WHERE v.comment_id=c.id AND v.value=1) likes,(SELECT count(*) FROM comment_votes v WHERE v.comment_id=c.id AND v.value=-1) dislikes,COALESCE((SELECT value FROM comment_votes v WHERE v.comment_id=c.id AND v.member_id=?),0) my_vote FROM comments c LEFT JOIN members m ON c.author=m.id WHERE c.post_id=? AND c.hidden=0 ORDER BY c.created LIMIT 200",member?.id||"",member?.id||"",id);const [cleanPost,...cleanComments]=await publicRows(env,db,[post,...comments]);return json({post:cleanPost,comments:cleanComments});
   }
   if(p==="mine"){const m=active();return json({
     squads:await all("SELECT id,name,payload,created FROM squads WHERE member_id=? ORDER BY created DESC LIMIT 100",m.id),
     favorites:await all("SELECT card_id,grade,name FROM favorites WHERE member_id=? LIMIT 200",m.id),
     diagnoses:await all("SELECT id,nickname,body,created FROM diagnoses WHERE member_id=? ORDER BY created DESC LIMIT 100",m.id),
     feedback:await all("SELECT id,kind,body,created,status,reply FROM feedback WHERE member_id=? ORDER BY created DESC LIMIT 100",m.id),
     posts:await all("SELECT id,title,created FROM posts WHERE author=? AND hidden=0 ORDER BY created DESC LIMIT 100",m.id),
     bookmarks:await all("SELECT p.id,p.title FROM bookmarks b JOIN posts p ON p.id=b.post_id WHERE b.member_id=? AND p.hidden=0 LIMIT 100",m.id),
     history:await all("SELECT h.squad_id,h.bp,h.observed FROM value_history h JOIN squads s ON s.id=h.squad_id WHERE s.member_id=? ORDER BY h.observed DESC LIMIT 300",m.id)
   })}
   if(p==="admin/traffic"){requireAdmin();return json(await trafficSummary(db,u))}
   if(p==="admin/ops"){requireAdmin();return json(await opsSummary(db,u,env))}
   if(p==="admin"){requireAdmin();await cleanup();
     const kstDay=Math.floor((now()+32400)/86400),start=(kstDay-6)*86400-32400,today=kstDay*86400-32400;
     const stats=await first("SELECT (SELECT count(*) FROM members) members,(SELECT count(*) FROM members WHERE created>=?) new_members,(SELECT count(*) FROM members WHERE suspended=1) suspended,(SELECT count(*) FROM posts WHERE hidden=0) posts,(SELECT count(*) FROM posts WHERE created>=? AND hidden=0) new_posts,(SELECT count(*) FROM comments WHERE hidden=0 AND post_id IN (SELECT id FROM posts WHERE hidden=0)) comments,(SELECT count(*) FROM comments WHERE created>=? AND hidden=0 AND post_id IN (SELECT id FROM posts WHERE hidden=0)) new_comments,(SELECT count(*) FROM reports WHERE status='open') open_reports,(SELECT count(*) FROM feedback WHERE status='open') open_feedback,(SELECT COALESCE(sum(views),0) FROM posts WHERE hidden=0) views",today,today,today);
     const activity=await all("SELECT (created+32400)/86400 day,'members' kind,count(*) n FROM members WHERE created>=? GROUP BY day UNION ALL SELECT (created+32400)/86400 day,'posts' kind,count(*) n FROM posts WHERE created>=? AND hidden=0 GROUP BY day UNION ALL SELECT (created+32400)/86400 day,'comments' kind,count(*) n FROM comments WHERE created>=? AND hidden=0 AND post_id IN (SELECT id FROM posts WHERE hidden=0) GROUP BY day",start,start,start);
     const days=Array.from({length:7},(_,i)=>({day:new Date((kstDay-6+i)*86400000).toISOString().slice(0,10),members:0,posts:0,comments:0}));for(const row of activity){const d=days[row.day-(kstDay-6)];if(d&&["members","posts","comments"].includes(row.kind))d[row.kind]=row.n}
     return json({stats,days,generated:now(),
     members:await all("SELECT id,nickname,created,suspended FROM members ORDER BY created DESC LIMIT 100"),
     reports:await all("SELECT id,post_id,reason,status,created FROM reports ORDER BY status,created DESC LIMIT 100"),
     feedback:await all("SELECT f.id,f.kind,f.body,f.status,f.reply,f.created,m.nickname FROM feedback f JOIN members m ON m.id=f.member_id ORDER BY f.created DESC LIMIT 100"),
     posts:await all("SELECT id,title,category,prefix,hidden,created,views FROM posts ORDER BY created DESC LIMIT 100"),
     comments:await all("SELECT id,post_id,body,hidden,created FROM comments ORDER BY created DESC LIMIT 100"),
     audit:await all("SELECT action,target,reason,created FROM audit ORDER BY created DESC LIMIT 100")
   })}
   throw new Err("페이지를 찾을 수 없습니다.",404);
 }
 check(request.method==="POST","허용되지 않는 요청입니다.",405);
 check(request.headers.get("Origin")===u.origin,"요청 출처가 올바르지 않습니다.",403);
 check(request.headers.get("content-type")?.includes("application/json"),"잘못된 요청입니다.",415);
 const raw=await request.text();check(raw.length<=40000,"요청이 너무 큽니다.",413);let b;try{b=JSON.parse(raw)}catch{throw new Err("잘못된 요청입니다.")}
 if(p==="ops-event"){
   if(admin||request.headers.get("Sec-GPC")==="1"||request.headers.get("DNT")==="1"||/bot|crawl|spider|headless|preview|curl|wget/i.test(request.headers.get("User-Agent")||""))return json({ok:true});
   check(raw.length<=200&&b&&Object.keys(b).length===3&&opsFeatures.has(b.feature)&&opsOutcomes.has(b.outcome)&&Number.isInteger(b.ms)&&b.ms>=0&&b.ms<=300000,"잘못된 기능 통계 요청입니다.");
   await ensureOps(db);const t=now();await run(opsInsert,Math.floor(t/3600),"feature",b.feature,b.outcome,b.ms,b.ms,t);
   if(Math.random()<0.01)await run("DELETE FROM ops_counts WHERE hour<?",(trafficDay(t)-29)*24-9);
   return json({ok:true});
 }
 if(p==="traffic"){
   if(admin||request.headers.get("Sec-GPC")==="1"||request.headers.get("DNT")==="1"||/bot|crawl|spider|headless|preview|curl|wget/i.test(request.headers.get("User-Agent")||"")||/prefetch|prerender/i.test((request.headers.get("Purpose")||"")+" "+(request.headers.get("Sec-Purpose")||"")))return json({ok:true});
   check(raw.length<=600&&b&&typeof b.token==="string"&&/^[a-f0-9]{32}$/.test(b.token)&&trafficPages.has(b.page)&&trafficSources.has(b.source)&&trafficDevices.has(b.device)&&(b.kind===0||b.kind===1),"잘못된 통계 요청입니다.");
   await ensureTraffic(db);const t=now(),day=trafficDay(t),visitor=await sha(day+":"+b.token);
   await run("INSERT OR IGNORE INTO traffic_events(day,visitor,minute,page,source,device,kind) VALUES(?,?,?,?,?,?,?)",day,visitor,Math.floor(t/60),b.page,b.source,b.device,b.kind);
   if(Math.random()<0.01)await run("DELETE FROM traffic_events WHERE day<?",day-29);
   return json({ok:true});
 }
 if(p==="login"){
   check(b.age===true&&b.terms===true&&b.privacy===true&&b.policy===POLICY,"가입 조건과 약관을 확인하세요.");
   const state=random(),verifier=random();await run("DELETE FROM oauth_states WHERE expires<=?",now());
    const pending=await first("SELECT count(*) n FROM oauth_states WHERE expires>?",now());check(pending.n<1000,"로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.",429);
   await run("INSERT INTO oauth_states(id,verifier,expires,policy) VALUES(?,?,?,?)",await sha(state),verifier,now()+600,POLICY);
   const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:u.origin+"/api/community/callback",response_type:"code",scope:"openid",state,code_challenge:await challenge(verifier),code_challenge_method:"S256",prompt:"select_account"}).toString();
   return json({url:url.href},200,{"set-cookie":cookie("fg_oauth",state,600)});
 }
 if(p==="consent"){
   check(member&&!member.suspended,"로그인 또는 계정 상태를 확인하세요.",401);
   check(b.age===true&&b.terms===true&&b.privacy===true&&b.policy===POLICY,"최신 가입 안내에 동의해 주세요.");
   await ensureConsent();await cleanup();await db.batch([q("UPDATE members SET policy=? WHERE id=?",POLICY,member.id),recordConsent(member.id)]);return json({ok:true});
 }
 if(p==="logout"){if(reqToken)await run("DELETE FROM sessions WHERE hash=?",await sha(reqToken));return json({ok:true},200,{"set-cookie":cookie("fg_session","",0)})}
 if(p==="profile"){
   const m=me(),nick=str(b.nickname,20,2);check(/^[\p{L}\p{N}_ -]+$/u.test(nick)&&!/(운영자|관리자|admin|moderator)/i.test(nick),"사용할 수 없는 닉네임입니다.");
   const dup=await first("SELECT id FROM members WHERE nickname=? COLLATE NOCASE AND id<>?",nick,m.id);check(!dup,"이미 사용 중인 닉네임입니다.",409);
   await run("UPDATE members SET nickname=?,game_name=NULL WHERE id=?",nick,m.id);return json({ok:true});
 }
 if(p==="withdraw"){
   check(member&&b.confirm==="탈퇴","회원 탈퇴 확인이 필요합니다.");
   await db.batch([q("DELETE FROM posts WHERE author=?",member.id),q("DELETE FROM comments WHERE author=?",member.id),q("DELETE FROM members WHERE id=?",member.id)]);
   return json({ok:true},200,{"set-cookie":cookie("fg_session","",0)});
 }
 if(p==="view"){const id=integer(b.post_id);await run("UPDATE posts SET views=views+1 WHERE id=? AND hidden=0",id);return json({ok:true})}
 const m=active();
 if(p==="game-start"||p==="game-answer")return await arcadeApi({p,b,m,db,env,u,received});
 if(p==="post"){
   check(cats.has(b.category)&&prefixes.has(b.prefix),"분류를 확인해 주세요.");
   check(b.prefix==="normal"||b.category==="free","머릿말은 자유게시판에서만 선택할 수 있습니다.");
   check(b.prefix!=="notice"||admin,"공지사항은 운영자만 등록할 수 있습니다.",403);
   const recent=await first("SELECT count(*) n FROM posts WHERE author=? AND created>?",m.id,now()-60);check(recent.n<3,"글을 너무 자주 작성했습니다.",429);
   const squad=b.squad&&b.category==="squad"?JSON.stringify(squadPayload(b.squad)):null;
   const card=b.card_id&&b.category==="review"?integer(b.card_id):null;
   const r=await run("INSERT INTO posts(author,category,prefix,title,body,squad,card_id,created) VALUES(?,?,?,?,?,?,?,?)",m.id,b.category,b.prefix,str(b.title,100),str(b.body,10000),squad,card,now());return json({ok:true,id:r.meta.last_row_id});
 }
 if(p==="comment"||p==="vote"||p==="bookmark"||p==="report"){
   const id=integer(b.post_id),target=await first("SELECT id,author FROM posts WHERE id=? AND hidden=0",id);check(target,"게시물을 찾을 수 없습니다.",404);
   if(p==="comment"){const r=await first("SELECT count(*) n FROM comments WHERE author=? AND created>?",m.id,now()-60);check(r.n<8,"댓글을 너무 자주 작성했습니다.",429);const body=str(b.body,2000);if(b.parent_id!=null){await ensureBoard(db);const parent=integer(b.parent_id);check(await first("SELECT id FROM comments WHERE id=? AND post_id=? AND hidden=0",parent,id),"답글 대상을 찾을 수 없습니다.",404);const root=await first("SELECT parent_id FROM comment_replies WHERE comment_id=?",parent);await db.batch([q("INSERT INTO comments(post_id,author,body,created) VALUES(?,?,?,?)",id,m.id,body,now()),q("INSERT INTO comment_replies(comment_id,parent_id) VALUES(last_insert_rowid(),?)",root?.parent_id||parent)])}else await run("INSERT INTO comments(post_id,author,body,created) VALUES(?,?,?,?)",id,m.id,body,now())}
   if(p==="vote"){const value=b.remove===true?0:b.value??1;check([-1,0,1].includes(value),"투표 값 오류");check(value===0||target.author!==m.id,"내 글에는 투표할 수 없습니다.",403);await ensureBoard(db);await db.batch([q("DELETE FROM votes WHERE member_id=? AND post_id=?",m.id,id),q("DELETE FROM post_dislikes WHERE member_id=? AND post_id=?",m.id,id),...(value?[q("INSERT OR IGNORE INTO "+(value===1?"votes":"post_dislikes")+"(member_id,post_id) VALUES(?,?)",m.id,id)]:[])])}
   if(p==="bookmark"){if(b.remove===true)await run("DELETE FROM bookmarks WHERE member_id=? AND post_id=?",m.id,id);else await run("INSERT OR IGNORE INTO bookmarks(member_id,post_id) VALUES(?,?)",m.id,id)}
   if(p==="report")await run("INSERT OR IGNORE INTO reports(member_id,post_id,reason,created) VALUES(?,?,?,?)",m.id,id,str(b.reason,1000),now());
   return json({ok:true});
 }
 if(p==="comment-vote"){const id=integer(b.id),value=b.value;check([-1,0,1].includes(value),"투표 값 오류");const target=await first("SELECT c.author FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=? AND c.hidden=0 AND p.hidden=0",id);check(target,"댓글을 찾을 수 없습니다.",404);check(target.author!==m.id,"내 댓글에는 투표할 수 없습니다.",403);await ensureBoard(db);if(value===0)await run("DELETE FROM comment_votes WHERE member_id=? AND comment_id=?",m.id,id);else await run("INSERT INTO comment_votes(member_id,comment_id,value) VALUES(?,?,?) ON CONFLICT(member_id,comment_id) DO UPDATE SET value=excluded.value",m.id,id,value);return json({ok:true})}
 if(p==="edit-post"){const id=integer(b.id);const target=await first("SELECT author FROM posts WHERE id=? AND hidden=0",id);check(target&&target.author===m.id,"작성자만 수정할 수 있습니다.",403);await run("UPDATE posts SET title=?,body=? WHERE id=? AND author=?",str(b.title,100),str(b.body,10000),id,m.id);return json({ok:true})}
 if(p==="edit-comment"){const id=integer(b.id);const target=await first("SELECT c.author FROM comments c JOIN posts p ON p.id=c.post_id WHERE c.id=? AND c.hidden=0 AND p.hidden=0",id);check(target&&target.author===m.id,"작성자만 수정할 수 있습니다.",403);await run("UPDATE comments SET body=? WHERE id=? AND author=?",str(b.body,2000),id,m.id);return json({ok:true})}
 if(p==="delete-post"||p==="delete-comment"){const table=p==="delete-post"?"posts":"comments";await run("DELETE FROM "+table+" WHERE id=? AND author=?",integer(b.id),m.id);return json({ok:true})}
 if(p==="feedback"){check(["suggestion","bug","rights","privacy"].includes(b.kind),"문의 종류를 확인하세요.");const r=await first("SELECT count(*) n FROM feedback WHERE member_id=? AND created>?",m.id,now()-60);check(r.n<3,"잠시 후 다시 문의해 주세요.",429);await run("INSERT INTO feedback(member_id,kind,body,created) VALUES(?,?,?,?)",m.id,b.kind,str(b.body,5000),now());return json({ok:true})}
 if(p==="squad"){const payload=JSON.stringify(squadPayload(b.squad));const count=await first("SELECT count(*) n FROM squads WHERE member_id=?",m.id);check(count.n<100,"스쿼드 저장 한도입니다.");await run("INSERT INTO squads(member_id,name,payload,created) VALUES(?,?,?,?)",m.id,str(b.name,60),payload,now());return json({ok:true})}
 if(p==="favorite"){const id=integer(b.card_id),g=integer(b.grade,1,13);if(b.remove)await run("DELETE FROM favorites WHERE member_id=? AND card_id=? AND grade=?",m.id,id,g);else{const r=await first("SELECT count(*) n FROM favorites WHERE member_id=?",m.id);check(r.n<200,"관심 선수 저장 한도입니다.");await run("INSERT OR IGNORE INTO favorites(member_id,card_id,grade,name) VALUES(?,?,?,?)",m.id,id,g,str(b.name,80))}return json({ok:true})}
 if(p==="diagnosis"){const r=await first("SELECT count(*) n FROM diagnoses WHERE member_id=?",m.id);check(r.n<100,"진단 기록 저장 한도입니다.");await run("INSERT INTO diagnoses(member_id,nickname,body,created) VALUES(?,?,?,?)",m.id,str(b.nickname,30),str(b.body,12000),now());return json({ok:true})}
 if(p==="delete-squad"||p==="delete-diagnosis"){await run("DELETE FROM "+(p==="delete-squad"?"squads":"diagnoses")+" WHERE id=? AND member_id=?",integer(b.id),m.id);return json({ok:true})}
 if(p==="value"){const id=integer(b.id),s=await first("SELECT payload FROM squads WHERE id=? AND member_id=?",id,m.id);check(s,"스쿼드를 찾을 수 없습니다.",404);
   // Read exact grade snapshot from existing public data, never trust client-supplied price.
   const squad=squadPayload(JSON.parse(s.payload));let bp=0;const shards=new Map();
   for(const player of squad.players){const shard=player.id%200;if(!shards.has(shard)){const res=await fetch(u.origin+"/data/list/"+shard+".json");check(res.ok,"시세 데이터가 없습니다.",502);shards.set(shard,await res.json())}const price=shards.get(shard)[String(player.id)]?.price?.[player.grade-1];check(Number.isSafeInteger(price)&&price>0,"일부 선수 시세를 확인할 수 없습니다.",409);bp+=price}
   integer(bp);await run("INSERT INTO value_history(squad_id,bp,observed) VALUES(?,?,?)",id,bp,now());return json({ok:true,bp});
 }
 if(p.startsWith("admin/")){
   requireAdmin();const reason=str(b.reason,1000);
   if(p==="admin/post"){const id=integer(b.id);await db.batch([q("UPDATE posts SET hidden=? WHERE id=?",b.hidden===true?1:0,id),q("INSERT INTO audit(actor,action,target,reason,created) VALUES(?,?,?,?,?)",m.id,b.hidden===true?"hide-post":"restore-post",String(id),reason,now())]);return json({ok:true})}
   if(p==="admin/comment"){const id=integer(b.id);await db.batch([q("UPDATE comments SET hidden=? WHERE id=?",b.hidden===true?1:0,id),q("INSERT INTO audit(actor,action,target,reason,created) VALUES(?,?,?,?,?)",m.id,b.hidden===true?"hide-comment":"restore-comment",String(id),reason,now())]);return json({ok:true})}
   if(p==="admin/move"){const id=integer(b.id);check(cats.has(b.category),"분류 오류");await db.batch([q("UPDATE posts SET category=?,prefix=CASE WHEN ?='free' THEN prefix ELSE 'normal' END WHERE id=?",b.category,b.category,id),q("INSERT INTO audit(actor,action,target,reason,created) VALUES(?,?,?,?,?)",m.id,"move-post",String(id),reason,now())]);return json({ok:true})}
   if(p==="admin/pin"){const id=integer(b.id);await db.batch([q("UPDATE posts SET prefix=? WHERE id=? AND category='free'",b.pin===true?"notice":"normal",id),q("INSERT INTO audit(actor,action,target,reason,created) VALUES(?,?,?,?,?)",m.id,b.pin===true?"pin-post":"unpin-post",String(id),reason,now())]);return json({ok:true})}
   if(p==="admin/member"){const id=str(b.id,80);check(id!==m.id,"본인 계정은 제한할 수 없습니다.");const target=await first("SELECT subject FROM members WHERE id=?",id);check(target&&!adminFor(env,target),"관리자 계정은 제한할 수 없습니다.",403);await db.batch([q("UPDATE members SET suspended=? WHERE id=?",b.suspended===true?1:0,id),q("DELETE FROM sessions WHERE member_id=?",id),q("INSERT INTO audit(actor,action,target,reason,created) VALUES(?,?,?,?,?)",m.id,b.suspended===true?"suspend":"restore-member",id,reason,now())]);return json({ok:true})}
   if(p==="admin/feedback"||p==="admin/report"){const id=integer(b.id);if(p==="admin/feedback")await run("UPDATE feedback SET status='closed',reply=? WHERE id=?",reason,id);else await run("UPDATE reports SET status='closed' WHERE id=?",id);await audit(p,id,reason);return json({ok:true})}
 }
 throw new Err("페이지를 찾을 수 없습니다.",404);
 }catch(e){return json({message:e instanceof Err?e.message:"처리 중 오류가 발생했습니다."},e instanceof Err?e.status:500)}
}
