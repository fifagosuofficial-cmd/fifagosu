const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../functions/api/community/[[path]].js"),"utf8");
const load=()=>import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const origin="https://example.test",enabled={COMMUNITY_ENABLED:"1",COMMUNITY_POLICY_VERSION:"2026-11-v2",GOOGLE_CLIENT_ID:"test",GOOGLE_CLIENT_SECRET:"test",COMMUNITY_ORIGIN:origin,COMMUNITY_DB:{}};
test("missing configuration fails closed",async()=>{
 const {onRequest}=await load();const r=await onRequest({request:new Request(origin+"/api/community/me"),env:{}});
 assert.equal(r.status,503);assert.equal((await r.json()).enabled,false);
});
test("anonymous identity and unauthorized admin routes do not expose data",async()=>{
 const {onRequest}=await load();let r=await onRequest({request:new Request(origin+"/api/community/me"),env:enabled});
 assert.equal(r.status,200);assert.equal((await r.json()).member,null);
 r=await onRequest({request:new Request(origin+"/api/community/admin"),env:enabled});assert.equal(r.status,401);
});
test("cross-site POST fails before mutation; under-14 declaration rejected",async()=>{
 const {onRequest}=await load();
 const req=(o,body)=>new Request(origin+"/api/community/login",{method:"POST",headers:{Origin:o,"Content-Type":"application/json"},body:JSON.stringify(body)});
 let r=await onRequest({request:req("https://other.test",{age:true,terms:true,privacy:true,policy:"2026-11-v2"}),env:enabled});assert.equal(r.status,403);
 r=await onRequest({request:req(origin,{age:false,terms:true,privacy:true,policy:"2026-11-v2"}),env:enabled});assert.equal(r.status,400);
});
test("non-admin member cannot create notice",async()=>{
 const {onRequest}=await load();
 const m={id:"user",subject:"regular",nickname:"test",suspended:0,policy:"2026-11-v2"};
 const env={...enabled,COMMUNITY_DB:{prepare(sql){assert.match(sql,/FROM sessions/);return {bind(){return {first:async()=>m}}}}}};
 const r=await onRequest({request:new Request(origin+"/api/community/post",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",Cookie:"fg_session="+"a".repeat(64)},body:JSON.stringify({category:"free",prefix:"notice",title:"test",body:"test"})}),env});
 assert.equal(r.status,403);
});
test("popular feed applies inclusive 30-vote threshold before pagination",async()=>{
 const {onRequest}=await load();
 let sql="";
 const env={...enabled,COMMUNITY_DB:{prepare(s){if(s.includes("sqlite_master"))return {first:async()=>({n:4})};sql=s;return {bind(){return {all:async()=>({results:[{id:2,likes:30}]})}}}}}};
 const r=await onRequest({request:new Request(origin+"/api/community/posts?category=popular"),env});
 assert.equal(r.status,200);
 assert.match(sql,/WHERE .*p\.hidden=0.*\(\(SELECT count\(\*\) FROM votes v WHERE v\.post_id=p\.id\)-\(SELECT count\(\*\) FROM post_dislikes d WHERE d\.post_id=p\.id\)\)>=30.*ORDER BY likes DESC.*LIMIT 30/);
});
test("popular is a read-only derived category, even for authenticated members",async()=>{
 const {onRequest}=await load();
 const m={id:"user",subject:"regular",nickname:"test",suspended:0,policy:"2026-11-v2"};
 const env={...enabled,COMMUNITY_DB:{prepare(sql){assert.match(sql,/FROM sessions/);return {bind(){return {first:async()=>m}}}}}};
 const r=await onRequest({request:new Request(origin+"/api/community/post",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",Cookie:"fg_session="+"a".repeat(64)},body:JSON.stringify({category:"popular",prefix:"normal",title:"test",body:"test"})}),env});
 assert.equal(r.status,400);
});

test("view increment is an aggregate, same-origin request, excluding hidden posts",async()=>{
 const {onRequest}=await load();let sql="",args=[];
 const env={...enabled,COMMUNITY_DB:{prepare(s){sql=s;return {bind(...a){args=a;return {run:async()=>({meta:{changes:1}})}}}}}};
 const r=await onRequest({request:new Request(origin+"/api/community/view",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({post_id:42})}),env});
 assert.equal(r.status,200);
 assert.equal(sql,"UPDATE posts SET views=views+1 WHERE id=? AND hidden=0");
 assert.deepEqual(args,[42]);
});

test("login state queue is cleaned and capped before inserting more OAuth state",async()=>{
 const {onRequest}=await load();const seen=[];
 const env={...enabled,COMMUNITY_DB:{prepare(sql){seen.push(sql);return {bind(){return {
  first:async()=>sql.startsWith("SELECT count(*)")?{n:1000}:null,
  run:async()=>({meta:{changes:1}})
 }}}}}};
 const r=await onRequest({request:new Request(origin+"/api/community/login",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({age:true,terms:true,privacy:true,policy:"2026-11-v2"})}),env});
 assert.equal(r.status,429);
 assert.ok(seen.some(sql=>sql.startsWith("DELETE FROM oauth_states")));
 assert.ok(seen.some(sql=>sql.startsWith("SELECT count(*)")));
 assert.ok(!seen.some(sql=>sql.startsWith("INSERT INTO oauth_states")));
});


test("public verification uses the allowlisted subject, never a nickname, and never leaks subject",async()=>{
 const {onRequest}=await load();
 const rows=[{id:1,nickname:"피파고수",author_subject:"ordinary"},{id:2,nickname:"different",author_subject:"owner-sub"}];
 const env={...enabled,COMMUNITY_ADMIN_SUBS:"owner-sub",COMMUNITY_DB:{prepare(sql){if(sql.includes("sqlite_master"))return {first:async()=>({n:4})};return {bind(){return {all:async()=>({results:rows}),first:async()=>rows[1]}}}}}};
 let r=await onRequest({request:new Request(origin+"/api/community/posts"),env});
 assert.equal(r.status,200);let j=await r.json();
 assert.deepEqual(j.posts.map(x=>x.verified),[false,true]);
 assert.ok(j.posts.every(x=>!("author_subject" in x)));
 r=await onRequest({request:new Request(origin+"/api/community/post?id=2"),env});
 assert.equal(r.status,200);j=await r.json();
 assert.equal(j.post.verified,true);assert.ok(!("author_subject" in j.post));
 assert.deepEqual(j.comments.map(x=>x.verified),[false,true]);
 assert.ok(j.comments.every(x=>!("author_subject" in x)));
});


// SQLite-backed D1 adapter: exercises actual legacy schema migration and transactional SQL.
const {DatabaseSync}=require("node:sqlite"),{createHash}=require("node:crypto");
const legacySchema=fs.readFileSync(path.join(__dirname,"../community/schema.sql"),"utf8").split("-- Community v2 additive migration")[0];
function fixture(){
 const sql=new DatabaseSync(":memory:");sql.exec(legacySchema);
 const insert=sql.prepare("INSERT INTO members(id,provider,subject,nickname,created,policy,age_confirmed) VALUES(?,?,?,?,?,?,1)");
 insert.run("a","google","owner-sub","피파고수",1,"2026-11-v2");insert.run("b","google","regular-sub","테스트회원",1,"2026-11-v2");
 const ts=Math.floor(Date.now()/1000)-3600;
 for(const [id,token] of [["a","a".repeat(64)],["b","b".repeat(64)]])sql.prepare("INSERT INTO sessions(hash,member_id,expires) VALUES(?,?,?)").run(createHash("sha256").update(token).digest("hex"),id,ts+86400);
 sql.prepare("INSERT INTO posts(author,category,prefix,title,body,created) VALUES('a','free','normal','old post','old body',?)").run(ts);
 sql.prepare("INSERT INTO comments(post_id,author,body,created) VALUES(1,'a','old comment',?)").run(ts);
 sql.exec("INSERT INTO votes(member_id,post_id) VALUES('b',1)");
 function prep(q,args=[]){return {bind(...a){return prep(q,a)},first:async()=>sql.prepare(q).get(...args)??null,all:async()=>({results:sql.prepare(q).all(...args)}),run:async()=>{const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}}}
 const db={prepare:prep,batch:async statements=>{sql.exec("BEGIN");try{const out=[];for(const st of statements)out.push(await st.run());sql.exec("COMMIT");return out}catch(e){sql.exec("ROLLBACK");throw e}}};
 const env={...enabled,COMMUNITY_DB:db,COMMUNITY_ADMIN_SUBS:"owner-sub"};
 return {sql,env,ts};
}
async function callFixture(env,route,body=null,who=""){const {onRequest}=await load(),headers=who?{Cookie:"fg_session="+who.repeat(64)}:{};if(body!==null)Object.assign(headers,{Origin:origin,"Content-Type":"application/json"});const r=await onRequest({request:new Request(origin+"/api/community/"+route,{headers,method:body===null?"GET":"POST",...(body===null?{}:{body:JSON.stringify(body)})}),env});return {status:r.status,data:await r.json()}}
test("legacy database migrates in place; post votes switch, cancel, and reject own votes",async()=>{
 const {sql,env}=fixture();
 let r=await callFixture(env,"post?id=1",null,"b");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.post.likes,1);assert.equal(r.data.post.my_vote,1);assert.equal(r.data.post.rank.points,9);assert.equal(r.data.post.verified,true);assert.ok(!("author_id" in r.data.post));assert.ok(!("author_subject" in r.data.post));
 r=await callFixture(env,"vote",{post_id:1,value:-1},"b");assert.equal(r.status,200);
 r=await callFixture(env,"post?id=1",null,"b");assert.equal(r.data.post.likes,0);assert.equal(r.data.post.dislikes,1);assert.equal(r.data.post.my_vote,-1);assert.equal(r.data.post.rank.points,6);
 r=await callFixture(env,"posts");assert.equal(r.status,200);assert.equal(r.data.posts[0].likes,-1);
 r=await callFixture(env,"vote",{post_id:1,value:0},"b");assert.equal(r.status,200);
 r=await callFixture(env,"vote",{post_id:1,value:1},"a");assert.equal(r.status,403);
 assert.equal(sql.prepare("SELECT count(*) n FROM posts").get().n,1);
 assert.equal(sql.prepare("SELECT count(*) n FROM votes").get().n,0);
 assert.equal(sql.prepare("SELECT count(*) n FROM post_dislikes").get().n,0);
 sql.close();
});
test("comment replies, vote changes, owner edit and admin hide use existing records",async()=>{
 const {env,sql}=fixture();
 let r=await callFixture(env,"comment",{post_id:1,parent_id:1,body:"reply"},"b");assert.equal(r.status,200,JSON.stringify(r.data));
 r=await callFixture(env,"post?id=1",null,"b");assert.equal(r.data.comments[1].parent_id,1);
 r=await callFixture(env,"comment-vote",{id:1,value:1},"b");assert.equal(r.status,200);
 r=await callFixture(env,"comment-vote",{id:1,value:-1},"b");assert.equal(r.status,200);
 r=await callFixture(env,"comment-vote",{id:1,value:1},"a");assert.equal(r.status,403);
 r=await callFixture(env,"edit-comment",{id:1,body:"bad edit"},"b");assert.equal(r.status,403);
 r=await callFixture(env,"edit-comment",{id:1,body:"updated"},"a");assert.equal(r.status,200);
 r=await callFixture(env,"edit-post",{id:1,title:"updated title",body:"updated body"},"a");assert.equal(r.status,200);
 r=await callFixture(env,"admin/comment",{id:2,hidden:true,reason:"test"},"b");assert.equal(r.status,403);
 r=await callFixture(env,"admin/comment",{id:2,hidden:true,reason:"test"},"a");assert.equal(r.status,200);
 r=await callFixture(env,"post?id=1");assert.equal(r.data.post.title,"updated title");assert.equal(r.data.comments.length,1);assert.equal(r.data.comments[0].dislikes,1);
 sql.close();
});
test("cat rank caps activity, excludes self votes, hides private identifiers",async()=>{
 const {env,sql,ts}=fixture();
 for(let i=0;i<8;i++)sql.prepare("INSERT INTO posts(author,category,prefix,title,body,created) VALUES('a','free','normal','spam','body',?)").run(ts);
 for(let i=0;i<12;i++)sql.prepare("INSERT INTO comments(post_id,author,body,created) VALUES(1,'a','spam',?)").run(ts);
 sql.exec("INSERT INTO votes(member_id,post_id) VALUES('a',1)");
 let r=await callFixture(env,"me",null,"a");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.member.rank.points,26);assert.equal(r.data.member.rank.level,1);assert.equal(r.data.member.rank.next,30);
 await callFixture(env,"comment-vote",{id:1,value:1},"b");
 await callFixture(env,"vote",{post_id:2,value:1},"b");
 r=await callFixture(env,"me",null,"a");assert.equal(r.data.member.rank.points,31);assert.equal(r.data.member.rank.level,2);
 assert.ok(!("subject" in r.data.member));sql.close();
});

test("seven enhancement ranks preserve XP and report grade boundaries",async()=>{
 const {sql,env}=fixture();
 const r=await callFixture(env,"me",null,"a");assert.equal(r.status,200);assert.equal(r.data.member.rank.grade,0);assert.equal(r.data.member.rank.name,"0강냥");
 await callFixture(env,"comment-vote",{id:1,value:1},"b");
 assert.equal((await callFixture(env,"me",null,"a")).data.member.rank.points,11);
 const src=source.match(/const LEVELS=(\[.*?\]);/);assert.ok(src);
 const levels=JSON.parse(src[1]);assert.deepEqual(levels.map(x=>x[2]),[0,1,3,5,8,11,13]);assert.deepEqual(levels.map(x=>x[0]),[0,30,100,500,2000,8000,16000]);
 sql.close();
});
test("admin overview counts full database, has seven KST buckets and denies ordinary member",async()=>{
 const {sql,env}=fixture();
 let r=await callFixture(env,"admin",null,"b");assert.equal(r.status,403);
 r=await callFixture(env,"admin",null,"a");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.stats.members,2);assert.equal(r.data.stats.posts,1);assert.equal(r.data.stats.comments,1);assert.equal(r.data.stats.open_reports,0);assert.equal(r.data.days.length,7);assert.ok(r.data.days.every(d=>Number.isInteger(d.posts)&&Number.isInteger(d.comments)&&Number.isInteger(d.members)));assert.equal(r.data.days.reduce((n,d)=>n+d.posts,0),1);assert.equal(r.data.posts[0].category,"free");sql.close();
});


test("legacy consent is not invented; explicit reconsent records v2 and purges expired rows",async()=>{
 const {sql,env,ts}=fixture();sql.prepare("UPDATE members SET policy=? WHERE id='b'").run("2026-11-v1");
 sql.prepare("INSERT INTO oauth_states VALUES(?,?,?,?)").run("expired","verifier",ts,"2026-11-v1");
 sql.prepare("INSERT INTO sessions VALUES(?,?,?)").run("expired","b",ts);
 sql.prepare("INSERT INTO audit(actor,action,target,reason,created) VALUES(?,?,?,?,?)").run("a","test","1","old",ts-366*86400);
 let r=await callFixture(env,"me",null,"b");assert.equal(r.data.member.needsPolicy,true);
 r=await callFixture(env,"post",{category:"free",prefix:"normal",title:"test",body:"test"},"b");assert.equal(r.status,403);
 r=await callFixture(env,"consent",{age:true,terms:true,privacy:false,policy:"2026-11-v2"},"b");assert.equal(r.status,400);
 r=await callFixture({...env,COMMUNITY_POLICY_VERSION:"2026-11-v1"},"consent",{age:true,terms:true,privacy:true,policy:"2026-11-v2"},"b");assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(sql.prepare("SELECT policy FROM members WHERE id='b'").get().policy,"2026-11-v2");
 assert.equal(sql.prepare("SELECT count(*) n FROM member_consents WHERE member_id='b' AND policy='2026-11-v2' AND privacy_agreed=1").get().n,1);
 for(const table of ["oauth_states","audit"])assert.equal(sql.prepare("SELECT count(*) n FROM "+table).get().n,0);
 assert.equal(sql.prepare("SELECT count(*) n FROM sessions WHERE hash='expired'").get().n,0);
 r=await callFixture(env,"withdraw",{confirm:"탈퇴"},"b");assert.equal(r.status,200);assert.equal(sql.prepare("SELECT count(*) n FROM member_consents").get().n,0);sql.close();
});

test("traffic daily estimates deduplicate and restrict admin access",async()=>{
 const {sql,env}=fixture(),b={token:"a".repeat(32),page:"diag",source:"fmkorea",device:"mobile",kind:1};
 assert.equal((await callFixture(env,"admin/traffic")).status,401);
 assert.equal((await callFixture(env,"admin/traffic",null,"b")).status,403);
 assert.equal((await callFixture(env,"traffic",{...b,page:"admin"})).status,400);
 assert.equal((await callFixture(env,"traffic",b,"a")).status,200);
 assert.equal((await callFixture(env,"traffic",b)).status,200);
 assert.equal((await callFixture(env,"traffic",b)).status,200);
 assert.equal((await callFixture(env,"traffic",{...b,page:"cards"})).status,200);
 assert.equal((await callFixture(env,"traffic",{...b,kind:0})).status,200);
 const r=await callFixture(env,"admin/traffic?range=7",null,"a");
 assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.days.length,30);
 assert.equal(r.data.days.at(-1).visitors,1);assert.equal(r.data.days.at(-1).views,2);assert.equal(r.data.live,1);assert.equal(r.data.sources[0].label,"fmkorea");assert.equal(r.data.sources[0].n,2);assert.equal(r.data.devices[0].label,"mobile");
 assert.ok(!JSON.stringify(r.data).includes(b.token));
 const row=sql.prepare("SELECT * FROM traffic_events LIMIT 1").get();assert.notEqual(row.visitor,b.token);
 sql.prepare("INSERT INTO traffic_events VALUES(?,?,?,?,?,?,?)").run(row.day-31,row.visitor,row.minute-31*1440,"home","direct","desktop",1);
 await callFixture(env,"admin/traffic?range=30",null,"a");
 assert.equal(sql.prepare("SELECT count(*) n FROM traffic_events WHERE day<?").get(row.day-29).n,0);
 sql.close();
});

test("profile no longer returns or stores optional FC online nickname",async()=>{
 const {sql,env}=fixture();
 sql.prepare("UPDATE members SET game_name=? WHERE id=?").run("legacy-name","b");
 let r=await callFixture(env,"me",null,"b");
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.equal(Object.hasOwn(r.data.member,"game_name"),false);
 assert.equal(sql.prepare("SELECT game_name FROM members WHERE id='b'").get().game_name,null);
 r=await callFixture(env,"profile",{nickname:"새닉네임",game_name:"ignored",game_name_consent:"yes"},"b");
 assert.equal(r.status,200,JSON.stringify(r.data));
 const m=sql.prepare("SELECT nickname,game_name FROM members WHERE id='b'").get();
 assert.equal(m.nickname,"새닉네임");assert.equal(m.game_name,null);
 sql.close();
});


test("board article navigation does not block on view writes or list refresh",()=>{
 const js=fs.readFileSync(path.join(__dirname,"../site/assets/js/community.js"),"utf8");
 const start=js.indexOf("async function readPost("),end=js.indexOf("function showReply",start),read=js.slice(start,end);
 assert.ok(read.includes('await (preloaded||get("post?id="+id))'));
 assert.ok(read.includes("if(record)void recordView(id)"));
 assert.ok(!read.includes("await recordView"));
 assert.ok(!read.includes("await loadPosts"));
 assert.ok(read.includes("if(seq!==postSeq)return"));
 assert.ok(js.includes('history.pushState(null,"",postURL(id))'));
 assert.ok(js.includes('window.addEventListener("popstate"'));
 assert.ok(js.includes('initialPost=initialId>0?get("post?id="+initialId)'));
});

test("arcade charges once, validates server answers and awards XP once",async()=>{
 const {env,sql}=fixture();
 let r=await callFixture(env,"game-status",null,"a");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.member.rank.points,9);assert.equal(r.data.fee,0);
 r=await callFixture(env,"game-start",{game:"player",fee:0},"a");assert.equal(r.status,200,JSON.stringify(r.data));const id=r.data.round.id;assert.ok(!("answer" in r.data.round.question));
 const qs=JSON.parse(sql.prepare("SELECT questions FROM arcade_rounds WHERE id=?").get(id).questions);
 for(let i=0;i<5;i++){r=await callFixture(env,"game-answer",{id,step:i,answer:qs[i].answer,reward:999},"a");assert.equal(r.status,200,JSON.stringify(r.data))}
 assert.equal(r.data.round.reward,12);assert.equal(r.data.member.rank.points,21);
 r=await callFixture(env,"game-answer",{id,step:4,answer:qs[4].answer},"a");assert.equal(r.data.member.rank.points,21);
 assert.equal((await callFixture(env,"game-start",{game:"penalty",fee:0},"a")).status,409);
 r=await callFixture(env,"game-start",{game:"penalty",fee:2},"a");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.member.rank.points,19);const paid=r.data.round.id;
 r=await callFixture(env,"game-start",{game:"lifting",fee:2},"a");assert.equal(r.data.round.id,paid);assert.equal(r.data.member.rank.points,19);
 assert.equal((await callFixture(env,"game-answer",{id:paid,step:0,answer:0},"b")).status,404);
 sql.prepare("UPDATE arcade_rounds SET expires=0 WHERE id=?").run(paid);
 r=await callFixture(env,"game-status",null,"a");assert.equal(r.data.member.rank.points,21);assert.equal(r.data.pending,null);assert.equal(r.data.leaderboard[0].score,5);sql.close();
});
test("arcade refuses anonymous, insufficient XP and missing market data before charging",async()=>{
 const {env,sql}=fixture();assert.equal((await callFixture(env,"game-start",{game:"player",fee:0})).status,401);
 assert.equal((await callFixture(env,"game-start",{game:"price",fee:0},"b")).status,503);assert.equal(sql.prepare("SELECT count(*) n FROM arcade_rounds").get().n,0);
 const r=await callFixture(env,"game-start",{game:"player",fee:0},"b");assert.equal(r.status,200);sql.prepare("UPDATE arcade_rounds SET state=1,step=5 WHERE id=?").run(r.data.round.id);
 assert.equal((await callFixture(env,"game-start",{game:"player",fee:2},"b")).status,409);sql.close();
});

test("pixel penalty keeps the keeper direction secret and judges the chosen direction",async()=>{
 const {env,sql}=fixture();
 let r=await callFixture(env,"game-start",{game:"penalty",fee:0},"a");assert.equal(r.status,200,JSON.stringify(r.data));const id=r.data.round.id;assert.ok(!("keeper" in r.data.round.question));assert.ok(!("phase" in r.data.round.question));
 const qs=JSON.parse(sql.prepare("SELECT questions FROM arcade_rounds WHERE id=?").get(id).questions);assert.equal(qs.length,5);assert.ok(qs.every(q=>[0,1,2].includes(q.keeper)));
 for(let i=0;i<5;i++){const shot=i===0?qs[i].keeper:(qs[i].keeper+1)%3;r=await callFixture(env,"game-answer",{id,step:i,answer:shot},"a");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.feedback.keeper,qs[i].keeper);assert.equal(r.data.feedback.correct,i!==0)}
 assert.equal(r.data.round.score,4);assert.equal(r.data.round.reward,8);sql.close();
});

test("endless lifting generates one next ball at a time, accelerates at 5 and 15, and continues past 50",async()=>{
 const {env,sql}=fixture();
 let r=await callFixture(env,"game-start",{game:"lifting",fee:0},"a");assert.equal(r.status,200,JSON.stringify(r.data));const id=r.data.round.id;
 const seen=[];
 for(let i=0;i<55;i++){
  const qs=JSON.parse(sql.prepare("SELECT questions FROM arcade_rounds WHERE id=?").get(id).questions);assert.equal(qs.length,1);
  const q=qs[0];seen.push(q);assert.equal(q.v,4);assert.ok(q.landX>=42&&q.landX<=214&&Math.sign(q.landX-q.fromX)===(q.direction===0?-1:1));if(i)assert.equal(q.fromX,seen[i-1].landX);
  sql.prepare("UPDATE arcade_rounds SET issued=? WHERE id=?").run(Date.now()-q.target,id);
  r=await callFixture(env,"game-answer",{id,step:i,answer:q.direction},"a");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.round.state,0);assert.equal(r.data.round.score,i+1);
 }
 assert.equal(seen[3].tier,"ROOKIE");assert.equal(seen[4].tier,"EXPERT");assert.equal(seen[13].tier,"EXPERT");assert.equal(seen[14].tier,"HYPER");assert.ok(seen[4].target<seen[3].target);assert.ok(seen[14].target<seen[13].target*.8);assert.ok(seen[54].window<seen[14].window);
 r=await callFixture(env,"game-answer",{id,step:55,answer:2},"a");assert.equal(r.status,200);assert.equal(r.data.round.state,1);assert.equal(r.data.round.score,55);assert.equal(r.data.round.reward,100);assert.equal(r.data.member.rank.points,109);
 r=await callFixture(env,"game-answer",{id,step:55,answer:2},"a");assert.equal(r.data.member.rank.points,109);
 r=await callFixture(env,"game-status",null,"a");assert.equal(r.data.leaderboard.find(x=>x.game==="lifting").score,55);sql.close();
});
test("obsolete timed game sessions refund entry fees rather than breaking after an upgrade",async()=>{
 const {env,sql}=fixture();
 let r=await callFixture(env,"game-start",{game:"penalty",fee:0},"a");assert.equal(r.status,200);sql.prepare("UPDATE arcade_rounds SET questions=?,fee=2 WHERE id=?").run(JSON.stringify([{phase:0}]),r.data.round.id);
 r=await callFixture(env,"game-status",null,"a");assert.equal(r.status,200);assert.equal(r.data.pending,null);assert.equal(r.data.member.rank.points,9);sql.close();
});

test("unlimited practice after five reward rounds never spends XP or awards XP or ranking",async()=>{
 const {env,sql}=fixture(),day=Math.floor((Math.floor(Date.now()/1000)+32400)/86400);
 assert.equal((await callFixture(env,"game-status",null,"a")).status,200);
 const insert=sql.prepare("INSERT INTO arcade_rounds(id,member_id,game,day,created,expires,issued,questions,fee,state,reward,score) VALUES(?,?,?,?,0,0,0,'[]',0,1,2,1)");
 for(let i=0;i<5;i++)insert.run("reward"+i,"a","player",day);
 let r=await callFixture(env,"game-status",null,"a");assert.equal(r.status,200);assert.equal(r.data.used,5);const xp=r.data.member.rank.points;
 assert.equal((await callFixture(env,"game-start",{game:"player",fee:2},"a")).status,409);
 for(let n=0;n<3;n++){
  r=await callFixture(env,"game-start",{game:"player",fee:0,practice:true},"a");assert.equal(r.status,200,JSON.stringify(r.data));const id=r.data.round.id;assert.equal(r.data.round.practice,true);assert.equal(r.data.used,5);assert.equal(r.data.member.rank.points,xp);
  const qs=JSON.parse(sql.prepare("SELECT questions FROM arcade_rounds WHERE id=?").get(id).questions);
  for(let i=0;i<5;i++){r=await callFixture(env,"game-answer",{id,step:i,answer:qs[i].answer,practice:false,reward:999},"a");assert.equal(r.status,200,JSON.stringify(r.data))}
  assert.equal(r.data.round.score,5);assert.equal(r.data.round.reward,0);assert.equal(r.data.round.fee,0);assert.equal(r.data.member.rank.points,xp);assert.equal(r.data.used,5);
 }
 r=await callFixture(env,"game-status",null,"a");assert.equal(r.data.leaderboard[0].score,1);assert.equal(r.data.used,5);assert.equal(sql.prepare("SELECT count(*) n FROM arcade_rounds").get().n,6);sql.close();
});

test("directional lifting rejects opposite direction even at the exact contact time and rejects early taps",async()=>{
 const {env,sql}=fixture();
 let r=await callFixture(env,"game-start",{game:"lifting",fee:0,practice:true},"a");assert.equal(r.status,200,JSON.stringify(r.data));let id=r.data.round.id,q=r.data.round.question;
 assert.equal(q.v,4);assert.ok([0,1].includes(q.direction));assert.equal(q.fromX,128);
 sql.prepare("UPDATE arcade_rounds SET issued=? WHERE id=?").run(Date.now()-q.target,id);
 r=await callFixture(env,"game-answer",{id,step:0,answer:1-q.direction},"a");assert.equal(r.status,200);assert.equal(r.data.feedback.correct,false);assert.equal(r.data.round.state,1);assert.equal(r.data.round.score,0);assert.equal(r.data.round.reward,0);
 r=await callFixture(env,"game-start",{game:"lifting",fee:0,practice:true},"a");assert.equal(r.status,200);id=r.data.round.id;q=r.data.round.question;
 sql.prepare("UPDATE arcade_rounds SET issued=? WHERE id=?").run(Date.now(),id);
 r=await callFixture(env,"game-answer",{id,step:0,answer:q.direction},"a");assert.equal(r.status,200);assert.equal(r.data.feedback.correct,false);assert.equal(r.data.round.state,1);assert.equal(r.data.member.rank.points,9);assert.equal(r.data.used,0);
 sql.close();
});
test("directional lifting preserves both fee and XP when obsolete in-flight rounds are refunded",async()=>{
 const {env,sql}=fixture();
 let r=await callFixture(env,"game-start",{game:"lifting",fee:0},"a");assert.equal(r.status,200);const id=r.data.round.id;
 sql.prepare("UPDATE arcade_rounds SET questions=?,fee=2 WHERE id=?").run(JSON.stringify([{v:2,target:1800,window:460}]),id);
 r=await callFixture(env,"game-status",null,"a");assert.equal(r.status,200);assert.equal(r.data.pending,null);assert.equal(r.data.member.rank.points,9);
 sql.close();
});

test("endless lifting reward milestones and unlimited practice remain server-authoritative",async()=>{
 const {env,sql}=fixture();let r=await callFixture(env,"game-status",null,"a");assert.equal(r.status,200);
 const day=Math.floor((Math.floor(Date.now()/1000)+32400)/86400);
 // Each synthetic record has one currently active ball, with a previously verified score.
 const tiers=[[4,8],[5,12],[10,20],[15,35],[20,50],[30,70],[50,100],[1000,100]];
 const q={v:4,choices:["왼쪽","오른쪽","놓침"],direction:0,target:500,window:100,fromX:128,landX:60};
 let expected=9;
 for(const [score,reward] of tiers){
  const id=(score.toString(16)).padStart(64,"0"),ts=Math.floor(Date.now()/1000);
  sql.prepare("INSERT INTO arcade_rounds(id,member_id,game,day,created,expires,issued,questions,step,score,fee) VALUES(?,?,?,?,?,?,?,?,?,?,0)").run(id,"a","lifting",day,ts,ts+600,Date.now(),JSON.stringify([q]),score,score);
  r=await callFixture(env,"game-answer",{id,step:score,answer:2},"a");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.round.reward,reward);expected+=reward;assert.equal(r.data.member.rank.points,expected);
 }
 r=await callFixture(env,"game-start",{game:"lifting",fee:0,practice:true},"a");assert.equal(r.status,200);const id=r.data.round.id;
 sql.prepare("UPDATE arcade_rounds SET step=100,score=100 WHERE id=?").run(id);
 r=await callFixture(env,"game-answer",{id,step:100,answer:2},"a");assert.equal(r.status,200);assert.equal(r.data.round.reward,0);assert.equal(r.data.member.rank.points,expected);sql.close();
});

test("traffic records SPA navigation and activity on the current menu without duplicate initial view",()=>{
 const vm=require("node:vm"),code=fs.readFileSync(path.join(__dirname,"../site/assets/js/traffic.js"),"utf8"),events={},sent=[],store=new Map();let interval;
 const document={visibilityState:"visible",referrer:"",querySelector:()=>null,addEventListener:(name,fn)=>{events[name]=fn}};
 const sandbox={location:{protocol:"https:",pathname:"/",hostname:"example.test"},navigator:{userAgent:"iPhone"},window:{},document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},crypto:{getRandomValues:x=>x.fill(7)},fetch:(url,o)=>{sent.push(JSON.parse(o.body));return Promise.resolve({})},setInterval:fn=>{interval=fn},Date,URL};
 vm.runInNewContext(code,sandbox);events["fg:view"]({detail:"home"});events["fg:view"]({detail:"diag"});events["fg:view"]({detail:"diag"});events["fg:view"]({detail:"sim"});
 document.visibilityState="hidden";events["fg:view"]({detail:"cards"});document.visibilityState="visible";events.visibilitychange();
 assert.deepEqual(sent.map(x=>[x.page,x.kind]),[["home",1],["diag",1],["sim",1],["cards",1]]);assert.equal(new Set(sent.map(x=>x.token)).size,1);assert.equal(sent[1].device,"mobile");assert.ok(interval);
});


test("operations metrics aggregate anonymous outcomes, reject extra fields and require admin",async()=>{const {env,sql}=fixture();const b={feature:"diag_manager",outcome:"ok",ms:500};assert.equal((await callFixture(env,"ops-event",b)).status,200);assert.equal((await callFixture(env,"ops-event",b)).status,200);assert.equal((await callFixture(env,"ops-event",{...b,nickname:"not-stored"})).status,400);assert.equal((await callFixture(env,"ops-event",b,"a")).status,200);assert.equal((await callFixture(env,"admin/ops",null,"b")).status,403);const r=await callFixture(env,"admin/ops?range=1",null,"a");assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.rows[0].n,2);assert.equal(r.data.rows[0].total_ms,1000);assert.equal(r.data.database,"ok");assert.equal(sql.prepare("SELECT count(*) n FROM ops_counts").get().n,1);});


test("operations layout separates status and wraps long mobile metrics",()=>{const js=fs.readFileSync(path.join(__dirname,"../site/assets/js/community.js"),"utf8"),css=fs.readFileSync(path.join(__dirname,"../site/assets/css/community.css"),"utf8");assert.ok(js.includes('class="fc-ops-detail"'));assert.ok(js.includes('class="fc-ops-line"'));assert.match(css,/\.fc-ops-state\{[^}]*white-space:normal/);assert.match(css,/\.fc-ops-line\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);});

test("live chat broadcasts without DB history; only authenticated, signed reports persist",async()=>{
 const {env,sql}=fixture(),{onRequest}=await load(),sent=[],seen=new Set();
 env.CHAT_HUB={idFromName:x=>x,get:()=>({fetch:async(url,o)=>{const e=JSON.parse(o.body);if(e.type==="message"){if(seen.has(e.message.author))return new Response(null,{status:429});seen.add(e.message.author)}sent.push(e);return new Response(null,{status:204})}})};
 const req=(p,body,who)=>onRequest({request:new Request(origin+"/api/community/"+p,{...(body===undefined?{}:{method:"POST",body:JSON.stringify(body)}),headers:{Origin:origin,"Content-Type":"application/json","CF-Connecting-IP":"192.0.2.1",...(who?{Cookie:"fg_session="+who.repeat(64)}:{})}}),env});
 assert.equal((await req("live-chat/send",{body:"hello"})).status,401);
 const first=await req("live-chat/send",{body:"hello"},"b");assert.equal(first.status,200);const message=(await first.json()).message;
 assert.equal(sent[0].message.body,"hello");assert.equal("author_subject" in message,false);
 assert.equal((await req("live-chat/send",{body:"spam"},"b")).status,429);
 const chat=await (await req("live-chat")).json();assert.equal(chat.version,2);assert.equal("rows" in chat,false);
 assert.equal(sql.prepare("SELECT count(*) n FROM live_chat").get().n,0);assert.equal(sql.prepare("SELECT count(*) n FROM reported_chat").get().n,0);
 assert.equal((await req("live-chat/report",{message:{...message,body:"forged"}},"a")).status,403);
 assert.equal((await req("live-chat/report",{message},"b")).status,400);
 assert.equal((await req("live-chat/report",{message},"a")).status,200);
 assert.equal((await req("live-chat/report",{message},"a")).status,200);
 assert.equal(sql.prepare("SELECT count(*) n FROM reported_chat").get().n,1);
 assert.equal(sql.prepare("SELECT count(*) n FROM reported_chat_votes").get().n,1);
 assert.equal((await req("contact/send",{kind:"bug",body:"private issue",page:"/",age:true,consent:true})).status,200);
 assert.equal((await req("contact/send",{kind:"suggestion",body:"member issue",page:"/",age:true,consent:true},"b")).status,200);
 assert.equal((await req("admin/social",undefined,"b")).status,403);
 assert.equal((await req("contact/mine")).status,401);
 const mine=await (await req("contact/mine",undefined,"b")).json();assert.equal(mine.rows.length,1);assert.equal(mine.rows[0].body,"member issue");
 const admin=await (await req("admin/social",undefined,"a")).json();assert.equal(admin.unread,2);assert.equal(admin.chat.length,1);assert.equal(admin.chat[0].reports,1);
 assert.equal((await req("admin/contact",{id:mine.rows[0].id,status:"done",reply:"fixed"},"a")).status,200);
 assert.equal((await (await req("contact/mine",undefined,"b")).json()).rows[0].reply,"fixed");
 assert.equal((await req("admin/live-chat",{id:message.id,hidden:true},"a")).status,200);
 assert.deepEqual((await (await req("live-chat")).json()).hidden,[message.id]);
 assert.equal(sent.at(-1).type,"moderation");
});
