const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../functions/api/community/[[path]].js"),"utf8");
const load=()=>import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const origin="https://example.test",enabled={COMMUNITY_ENABLED:"1",COMMUNITY_POLICY_VERSION:"2026-11-v1",GOOGLE_CLIENT_ID:"test",GOOGLE_CLIENT_SECRET:"test",COMMUNITY_ORIGIN:origin,COMMUNITY_DB:{}};
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
 let r=await onRequest({request:req("https://other.test",{age:true,terms:true,privacy:true,policy:"2026-11-v1"}),env:enabled});assert.equal(r.status,403);
 r=await onRequest({request:req(origin,{age:false,terms:true,privacy:true,policy:"2026-11-v1"}),env:enabled});assert.equal(r.status,400);
});
test("non-admin member cannot create notice",async()=>{
 const {onRequest}=await load();
 const m={id:"user",subject:"regular",nickname:"test",suspended:0,policy:"2026-11-v1"};
 const env={...enabled,COMMUNITY_DB:{prepare(sql){assert.match(sql,/FROM sessions/);return {bind(){return {first:async()=>m}}}}}};
 const r=await onRequest({request:new Request(origin+"/api/community/post",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",Cookie:"fg_session="+"a".repeat(64)},body:JSON.stringify({category:"free",prefix:"notice",title:"test",body:"test"})}),env});
 assert.equal(r.status,403);
});
test("popular feed applies inclusive 30-vote threshold before pagination",async()=>{
 const {onRequest}=await load();
 let sql="";
 const env={...enabled,COMMUNITY_DB:{prepare(s){sql=s;return {bind(){return {all:async()=>({results:[{id:2,likes:30}]})}}}}}};
 const r=await onRequest({request:new Request(origin+"/api/community/posts?category=popular"),env});
 assert.equal(r.status,200);
 assert.match(sql,/WHERE .*p\.hidden=0.*\(SELECT count\(\*\) FROM votes v WHERE v\.post_id=p\.id\)>=30.*ORDER BY likes DESC.*LIMIT 30/);
});
test("popular is a read-only derived category, even for authenticated members",async()=>{
 const {onRequest}=await load();
 const m={id:"user",subject:"regular",nickname:"test",suspended:0,policy:"2026-11-v1"};
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
 const r=await onRequest({request:new Request(origin+"/api/community/login",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({age:true,terms:true,privacy:true,policy:"2026-11-v1"})}),env});
 assert.equal(r.status,429);
 assert.ok(seen.some(sql=>sql.startsWith("DELETE FROM oauth_states")));
 assert.ok(seen.some(sql=>sql.startsWith("SELECT count(*)")));
 assert.ok(!seen.some(sql=>sql.startsWith("INSERT INTO oauth_states")));
});
