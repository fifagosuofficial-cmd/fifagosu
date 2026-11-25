const test=require("node:test"),assert=require("node:assert/strict");
const {create}=require("../site/assets/js/material-engine.js");
const data={items:[[1000001,"target",1,110,1],[1000002,"A",1,110,8],[1000003,"B",5,112,12],[1000004,"C",1,115,29],[1000005,"D",1,120,50]]};
const rules={schema:1,verified:true,source:"https://fconline.nexon.com/DataCenter/PlayerGrow",fullPoints:10000,rows:[{grade:1,targetOvr:110,materials:[[110,2200],[112,3900],[115,7000],[120,10000]]},{grade:5,targetOvr:116,materials:[[110,1000],[112,2000],[115,3500],[120,5000]]}]};
test("finds minimum mixed cost within five cards and excludes same player",()=>{
 const x=create(data,rules),p=x.solve(110,1,0,1);
 assert.equal(p.cost,32);assert.equal(p.cards.length,3);
 assert.ok(p.cards.every(c=>c.pid!==1));
 assert.ok(p.cards.reduce((s,c)=>s+c.points,0)>=10000);
 assert.equal(x.solve(110,5,6,1).cost,60);
});
test("does not invent missing rules or round near-full up",()=>{
 assert.equal(create(data,{...rules,verified:false}).solve(110,1,0,1),null);
 assert.equal(create(data,rules).solve(110,2,1,1),null);
 assert.equal(create(data,{...rules,rows:[{grade:1,targetOvr:110,materials:[[110,1999]]}]}).solve(110,1,0,1),null);
});
test("five-card price proxy is explicitly unverified, grade-aware and excludes target",()=>{
 const x=create(data,null),p=x.estimate(110,1,0,1);
 assert.equal(p.cost,40);assert.equal(p.cards.length,5);assert.equal(p.gauge,null);assert.equal(p.estimated,true);
 assert.equal(x.estimate(110,5,2,1).cost,60);
 assert.equal(x.estimate(130,1,0,1),null);
 assert.equal(x.solve(110,1,0,1),null);
});

test("official simulation no longer falls back to five-card price proxy",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const s=fs.readFileSync(path.join(__dirname,"../site/assets/js/sim.js"),"utf8");
 assert.ok(s.includes('/api/boost?spid='));
 assert.ok(s.includes('plan.gauge!==100'));
 assert.ok(!s.includes('MATERIALS?.estimate'));
});
const boostSource=require("node:fs").readFileSync(require("node:path").join(__dirname,"../functions/api/boost.js"),"utf8");
const boost=()=>import("data:text/javascript;base64,"+Buffer.from(boostSource).toString("base64"));
test("official OVR quotes optimize and verify actual gauge instead of extrapolating",async()=>{
 const {quoteRows,cheapestFull,fetchOfficialPlan}=await boost();
 const raw=[{ovr:121,stretc:"20.44",monthly_average_price:15805},{ovr:124,stretc:"50.00",monthly_average_price:49510},{ovr:127,stretc:"100.00",monthly_average_price:116245},{ovr:130,stretc:"100.00",monthly_average_price:0}];
 assert.equal(quoteRows(raw).length,3);
 const plan=cheapestFull(quoteRows(raw));assert.equal(plan.cost,79025);assert.equal(plan.cards.length,5);
 let calls=[];const result=await fetchOfficialPlan(100004000,1,async (endpoint,fields)=>{calls.push([endpoint,fields]);return endpoint==="RecommendOVRList"?raw:{strBoostPer:"100"}},async()=>{});
 assert.equal(result.plan.cost,79025);assert.equal(result.plan.gauge,100);assert.equal(calls[1][1].strCalinfo,",121,121,121,121,121,");
 const fail=await fetchOfficialPlan(100004000,1,async endpoint=>endpoint==="RecommendOVRList"?raw:{strBoostPer:"99.99"},async()=>{});
 assert.equal(fail.plan,null);
});

test("efficiency ranking subtracts verified cost and recomputes return, profit and budget",()=>{
 const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
 const s=fs.readFileSync(path.join(__dirname,"../site/assets/js/sim.js"),"utf8");
 const a=s.indexOf("function effWithMaterial("),b=s.indexOf("let effCtx=",a);
 const ctx={};vm.createContext(ctx);vm.runInContext(s.slice(a,b),ctx);
 const r={id:100004000,g:4,buy:100,ret:170,netUp:240,rr:1.7,win:140};
 const cost={official:true,gauge:100,cost:50};const row=ctx.effWithMaterial(r,cost);
 assert.equal(row.inv,150);assert.equal(row.rr,170/150);assert.equal(row.ev,20);assert.equal(row.win,90);
 assert.equal(ctx.effWithMaterial(r,{...cost,gauge:99}),null);
 assert.equal(ctx.effWithMaterial(r,{...cost,official:false}),null);
 const other={...r,id:2,buy:90,rr:1.4,win:200},expensive={...r,id:3,buy:1000,rr:5,win:1000};
 assert.deepEqual(Array.from(ctx.effCandidateOrder([r,other,expensive],"win"),x=>x.id),[3,2,r.id]);
 assert.equal(ctx.effCandidateOrder([r,other,expensive],"top")[0].id,3);
 assert.ok(s.includes("await loadOfficial(r.g,r.id)"));
 assert.ok(!s.includes("if($('effMat').checked&&!MATERIALS?.ready)"));
});

test("efficiency defaults to verified costs with two rankings and bounded concurrent lookups",()=>{
 const fs=require("node:fs"),path=require("node:path"),s=fs.readFileSync(path.join(__dirname,"../site/assets/js/sim.js"),"utf8"),h=fs.readFileSync(path.join(__dirname,"../site/templates/index.html"),"utf8");
 assert.match(h,/id="effMat" checked/);assert.match(h,/data-em="win" aria-selected="true"/);assert.match(h,/data-em="top" aria-selected="false"/);assert.ok(!h.includes('data-em="budget"'));
 assert.ok(s.includes('EFF_PARALLEL=2'));assert.ok(s.includes('/api/boost?cached=1'));assert.ok(s.includes('ctx.byKey.get(key)'));
});
test("cached boost endpoint returns only verified recent plans and never calls upstream",async()=>{
 const {onRequestGet}=await boost();let min=0;const good={spid:100004000,grade:1,plan:{official:true,gauge:100,cost:5}},bad={...good,plan:{official:true,gauge:99}};
 const db={batch:async()=>[],prepare(sql){return {bind(v){min=v;return {all:async()=>({results:[{body:JSON.stringify(good)},{body:JSON.stringify(bad)},{body:"bad json"}]})}}}}};
 const r=await onRequestGet({request:new Request("https://example.test/api/boost?cached=1"),env:{COMMUNITY_DB:db}});
 assert.equal(r.status,200);assert.deepEqual((await r.json()).items,[good]);assert.ok(min>0);
});

test("ranking cards preserve full names, odds and all monetary metrics",()=>{
 const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
 const s=fs.readFileSync(path.join(__dirname,"../site/assets/js/sim.js"),"utf8"),h=fs.readFileSync(path.join(__dirname,"../site/templates/index.html"),"utf8"),css=fs.readFileSync(path.join(__dirname,"../site/assets/css/main.css"),"utf8");
 assert.match(h,/인생강화 TOP 30/);assert.match(h,/class="sim-note sim-intro">실제 시세로 강화 손익·팩 기댓값을 계산해요/);
 const ctx={bigImg:()=>"",bigBadge:()=>"",H:s=>s,gchip:g=>String(g)};vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf("function effRow("),s.indexOf("function effRender()")),ctx);
 const r={id:100004000,name:"크리스티아누 호날두",g:12,p:.01,inv:613905129000,mat:7951290325,up:1950000000000,ev:-242208729000,win:556048700000,rr:.61};
 const win=ctx.effRow(r,0,"win"),rr=ctx.effRow(r,0);
 for(const out of [win,rr])for(const label of ["크리스티아누 호날두","성공 확률 1%","총 투자금","재료비","7,951,290,325 BP","성공 시 시세","기대 손익","회수율","성공 시 순이익"])assert.ok(out.includes(label),label);
 assert.ok(win.includes("+5,560억 4,870만"));assert.ok(win.includes("1조 9,500억"));
 assert.ok(css.includes('grid-template-areas:"r i w" "m m m" "d d d"'));assert.ok(css.includes("text-overflow:clip"));
});

test("shared budget uses total investment and supports both rankings",()=>{
 const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),s=fs.readFileSync(path.join(__dirname,"../site/assets/js/sim.js"),"utf8"),h=fs.readFileSync(path.join(__dirname,"../site/templates/index.html"),"utf8");
 const ctx={};vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf("function effWithMaterial("),s.indexOf("let effCtx=")),ctx);
 assert.equal(ctx.parseEffBudget(""),Infinity);assert.equal(ctx.parseEffBudget("1,000"),1e11);assert.equal(ctx.parseEffBudget("0.5"),5e7);assert.equal(ctx.parseEffBudget("-1"),null);assert.equal(ctx.parseEffBudget("0"),null);assert.equal(ctx.parseEffBudget("abc"),null);
 const r={id:1,g:1,buy:80,inv:80,ret:170,netUp:240,rr:2.125,win:160};
 const a=ctx.effWithMaterial(r,{official:true,gauge:100,cost:30}),b=ctx.effWithMaterial({...r,id:2},{official:true,gauge:100,cost:20});
 for(const mode of ["win","top"])assert.deepEqual(Array.from(ctx.effCandidateOrder(ctx.effWithinBudget([a,b],100),mode),x=>x.id),[2]);
 assert.ok(s.includes("buy>effBudget"));assert.ok(s.includes("v.inv<=ctx.budget"));assert.ok(s.includes("feeRate(),effBudget"));assert.match(h,/id="effBudgetForm"/);assert.match(h,/id="effMoney"/);
});
