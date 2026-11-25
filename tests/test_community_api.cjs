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
 const env={...enabled,COMMUNITY_DB:{prepare(s){if(s.includes("sqlite_master"))return {first:async()=>({n:3})};sql=s;return {bind(){return {all:async()=>({results:[{id:2,likes:30}]})}}}}}};
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
 const env={...enabled,COMMUNITY_ADMIN_SUBS:"owner-sub",COMMUNITY_DB:{prepare(sql){if(sql.includes("sqlite_master"))return {first:async()=>({n:3})};return {bind(){return {all:async()=>({results:rows}),first:async()=>rows[1]}}}}}};
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
