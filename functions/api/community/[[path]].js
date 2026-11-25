// Community API. Disabled unless operator explicitly configures reviewed policies and bindings.
const POLICY="2026-11-v1";
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
const publicAuthor=(env,{author_subject,...row})=>({...row,verified:!!author_subject&&adminFor(env,{subject:author_subject})});
function squadPayload(v){
 check(v?.schema===1&&Array.isArray(v.players)&&v.players.length===11&&v.opts&&typeof v.opts==="object","스쿼드 형식이 올바르지 않습니다.");
 const players=v.players.map(p=>({id:integer(p.id),grade:integer(p.grade,1,13),name:str(p.name,80),pos:str(p.pos,4)}));
 check(new Set(players.map(p=>p.id%1000000)).size===11,"중복 선수입니다.");
 const o=v.opts,opts={budget:integer(o.budget),salary:integer(o.salary,11,315),team:integer(o.team??0,0),formation:str(o.formation,12),style:str(o.style,20),grades:Array.isArray(o.grades)?o.grades.map(x=>integer(x,1,13)):[]};
 check(opts.grades.length>0&&opts.grades.length<=13,"강화 범위를 확인해 주세요.");
 return {schema:1,opts,mode:["performance","balanced","value"].includes(v.mode)?v.mode:"balanced",players};
}
export async function onRequest({request,env}){
 const u=new URL(request.url),p=u.pathname.replace(/^\/api\/community\/?/,"").replace(/\/$/,""),db=env.COMMUNITY_DB;
 const enabled=env.COMMUNITY_ENABLED==="1"&&env.COMMUNITY_POLICY_VERSION===POLICY&&!!db&&!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET&&env.COMMUNITY_ORIGIN===u.origin&&u.protocol==="https:";
 if(!enabled)return json({enabled:false,message:"회원·게시판 서버는 아직 연결되지 않았습니다."},503);
 const q=(sql,...args)=>db.prepare(sql).bind(...args),first=(sql,...args)=>q(sql,...args).first(),all=async(sql,...args)=>(await q(sql,...args).all()).results,run=(sql,...args)=>q(sql,...args).run();
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
   if(p==="me")return json({enabled:true,member:member?{nickname:member.nickname,game_name:member.game_name,suspended:!!member.suspended,admin,needsPolicy:member.policy!==POLICY}:null});
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
     await run("INSERT INTO members(id,provider,subject,created,policy,age_confirmed) VALUES(?,?,?,?,?,1) ON CONFLICT(provider,subject) DO UPDATE SET policy=excluded.policy",crypto.randomUUID(),"google",sub,now(),POLICY);
     const m=await first("SELECT id,suspended FROM members WHERE provider='google' AND subject=?",sub);
     check(m&&!m.suspended,"이용이 제한된 계정입니다.",403);
     const sid=random();await run("DELETE FROM sessions WHERE expires<=?",now());
     await run("INSERT INTO sessions(hash,member_id,expires) VALUES(?,?,?)",await sha(sid),m.id,now()+86400*7);
     const h=new Headers({location:"/mypage/","cache-control":"no-store"});
     h.append("Set-Cookie",cookie("fg_session",sid,86400*7));h.append("Set-Cookie",cookie("fg_oauth","",0));return new Response(null,{status:303,headers:h});
   }
   if(p==="rankings"){
     return json({
       squads:await all("SELECT p.id,p.title,(SELECT count(*) FROM votes v WHERE v.post_id=p.id) likes FROM posts p WHERE p.hidden=0 AND p.category='squad' AND p.squad IS NOT NULL ORDER BY likes DESC,p.created DESC LIMIT 10"),
       players:await all("SELECT p.card_id,count(*) reviews,(SELECT count(*) FROM votes v JOIN posts t ON t.id=v.post_id WHERE t.hidden=0 AND t.category='review' AND t.card_id=p.card_id) likes FROM posts p WHERE p.hidden=0 AND p.category='review' AND p.card_id IS NOT NULL GROUP BY p.card_id ORDER BY likes DESC,reviews DESC LIMIT 10")
     });
   }
   if(p==="posts"){
     const cat=u.searchParams.get("category")||"all",search=(u.searchParams.get("q")||"").slice(0,100),card=Number(u.searchParams.get("card")||0),page=Math.min(100,Math.max(1,parseInt(u.searchParams.get("page")||"1",10)||1));
     check(cat==="all"||cat==="popular"||cats.has(cat),"게시판 분류 오류");
     const where=["p.hidden=0"],args=[];if(cats.has(cat)){where.push("p.category=?");args.push(cat)}
     if(cat==="popular")where.push("(SELECT count(*) FROM votes v WHERE v.post_id=p.id)>=30");
     if(search){where.push("(instr(p.title,?)>0 OR instr(p.body,?)>0)");args.push(search,search)}
     if(card&&Number.isSafeInteger(card)){where.push("p.card_id=?");args.push(card)}
     const order=cat==="popular"?"likes DESC, replies DESC, p.created DESC":"CASE WHEN p.prefix='notice' THEN 0 ELSE 1 END,p.created DESC";
     return json({posts:(await all("SELECT p.id,p.category,p.prefix,p.title,p.created,p.card_id,p.views,COALESCE(m.nickname,'탈퇴 회원') nickname,m.subject author_subject,(SELECT count(*) FROM votes v WHERE v.post_id=p.id) likes,(SELECT count(*) FROM comments c WHERE c.post_id=p.id AND c.hidden=0) replies FROM posts p LEFT JOIN members m ON p.author=m.id WHERE "+where.join(" AND ")+" ORDER BY "+order+" LIMIT 30 OFFSET ?",...args,(page-1)*30)).map(row=>publicAuthor(env,row))});
   }
   if(p==="post"){
     const id=integer(Number(u.searchParams.get("id"))),post=await first("SELECT p.id,p.category,p.prefix,p.title,p.body,p.squad,p.card_id,p.created,p.views,COALESCE(m.nickname,'탈퇴 회원') nickname,m.subject author_subject,p.author=? own FROM posts p LEFT JOIN members m ON p.author=m.id WHERE p.id=? AND p.hidden=0",member?.id||"",id);
     check(post,"게시물을 찾을 수 없습니다.",404);
     return json({post:publicAuthor(env,post),comments:(await all("SELECT c.id,c.body,c.created,COALESCE(m.nickname,'탈퇴 회원') nickname,m.subject author_subject,c.author=? own FROM comments c LEFT JOIN members m ON c.author=m.id WHERE c.post_id=? AND c.hidden=0 ORDER BY c.created LIMIT 200",member?.id||"",id)).map(row=>publicAuthor(env,row))});
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
   if(p==="admin"){requireAdmin();return json({
     members:await all("SELECT id,nickname,created,suspended FROM members ORDER BY created DESC LIMIT 100"),
     reports:await all("SELECT id,post_id,reason,status,created FROM reports ORDER BY status,created DESC LIMIT 100"),
     feedback:await all("SELECT f.id,f.kind,f.body,f.status,f.reply,f.created,m.nickname FROM feedback f JOIN members m ON m.id=f.member_id ORDER BY f.created DESC LIMIT 100"),
     posts:await all("SELECT id,title,prefix,hidden,created FROM posts ORDER BY created DESC LIMIT 100"),
     audit:await all("SELECT action,target,reason,created FROM audit ORDER BY created DESC LIMIT 100")
   })}
   throw new Err("페이지를 찾을 수 없습니다.",404);
 }
 check(request.method==="POST","허용되지 않는 요청입니다.",405);
 check(request.headers.get("Origin")===u.origin,"요청 출처가 올바르지 않습니다.",403);
 check(request.headers.get("content-type")?.includes("application/json"),"잘못된 요청입니다.",415);
 const raw=await request.text();check(raw.length<=40000,"요청이 너무 큽니다.",413);let b;try{b=JSON.parse(raw)}catch{throw new Err("잘못된 요청입니다.")}
 if(p==="login"){
   check(b.age===true&&b.terms===true&&b.privacy===true&&b.policy===POLICY,"가입 조건과 약관을 확인하세요.");
   const state=random(),verifier=random();await run("DELETE FROM oauth_states WHERE expires<=?",now());
    const pending=await first("SELECT count(*) n FROM oauth_states WHERE expires>?",now());check(pending.n<1000,"로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.",429);
   await run("INSERT INTO oauth_states(id,verifier,expires,policy) VALUES(?,?,?,?)",await sha(state),verifier,now()+600,POLICY);
   const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:u.origin+"/api/community/callback",response_type:"code",scope:"openid",state,code_challenge:await challenge(verifier),code_challenge_method:"S256",prompt:"select_account"}).toString();
   return json({url:url.href},200,{"set-cookie":cookie("fg_oauth",state,600)});
 }
 if(p==="logout"){if(reqToken)await run("DELETE FROM sessions WHERE hash=?",await sha(reqToken));return json({ok:true},200,{"set-cookie":cookie("fg_session","",0)})}
 if(p==="profile"){
   const m=me(),nick=str(b.nickname,20,2);check(/^[\p{L}\p{N}_ -]+$/u.test(nick)&&!/(운영자|관리자|admin|moderator)/i.test(nick),"사용할 수 없는 닉네임입니다.");
   const dup=await first("SELECT id FROM members WHERE nickname=? COLLATE NOCASE AND id<>?",nick,m.id);check(!dup,"이미 사용 중인 닉네임입니다.",409);
   await run("UPDATE members SET nickname=?,game_name=? WHERE id=?",nick,b.game_name?str(b.game_name,30):null,m.id);return json({ok:true});
 }
 if(p==="withdraw"){
   check(member&&b.confirm==="탈퇴","회원 탈퇴 확인이 필요합니다.");
   await db.batch([q("DELETE FROM posts WHERE author=?",member.id),q("DELETE FROM comments WHERE author=?",member.id),q("DELETE FROM members WHERE id=?",member.id)]);
   return json({ok:true},200,{"set-cookie":cookie("fg_session","",0)});
 }
 if(p==="view"){const id=integer(b.post_id);await run("UPDATE posts SET views=views+1 WHERE id=? AND hidden=0",id);return json({ok:true})}
 const m=active();
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
   const id=integer(b.post_id);check(await first("SELECT id FROM posts WHERE id=? AND hidden=0",id),"게시물을 찾을 수 없습니다.",404);
   if(p==="comment"){const r=await first("SELECT count(*) n FROM comments WHERE author=? AND created>?",m.id,now()-60);check(r.n<8,"댓글을 너무 자주 작성했습니다.",429);await run("INSERT INTO comments(post_id,author,body,created) VALUES(?,?,?,?)",id,m.id,str(b.body,2000),now())}
   if(p==="vote"||p==="bookmark"){const table=p==="vote"?"votes":"bookmarks";if(b.remove===true)await run("DELETE FROM "+table+" WHERE member_id=? AND post_id=?",m.id,id);else await run("INSERT OR IGNORE INTO "+table+"(member_id,post_id) VALUES(?,?)",m.id,id)}
   if(p==="report")await run("INSERT OR IGNORE INTO reports(member_id,post_id,reason,created) VALUES(?,?,?,?)",m.id,id,str(b.reason,1000),now());
   return json({ok:true});
 }
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
   if(p==="admin/member"){const id=str(b.id,80);check(id!==m.id,"본인 계정은 제한할 수 없습니다.");const target=await first("SELECT subject FROM members WHERE id=?",id);check(target&&!adminFor(env,target),"관리자 계정은 제한할 수 없습니다.",403);await db.batch([q("UPDATE members SET suspended=? WHERE id=?",b.suspended===true?1:0,id),q("DELETE FROM sessions WHERE member_id=?",id),q("INSERT INTO audit(actor,action,target,reason,created) VALUES(?,?,?,?,?)",m.id,b.suspended===true?"suspend":"restore-member",id,reason,now())]);return json({ok:true})}
   if(p==="admin/feedback"||p==="admin/report"){const id=integer(b.id);if(p==="admin/feedback")await run("UPDATE feedback SET status='closed',reply=? WHERE id=?",reason,id);else await run("UPDATE reports SET status='closed' WHERE id=?",id);await audit(p,id,reason);return json({ok:true})}
 }
 throw new Err("페이지를 찾을 수 없습니다.",404);
 }catch(e){return json({message:e instanceof Err?e.message:"처리 중 오류가 발생했습니다."},e instanceof Err?e.status:500)}
}
