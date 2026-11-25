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
