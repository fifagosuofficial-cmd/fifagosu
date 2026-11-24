const test=require("node:test"),assert=require("node:assert/strict");
const B=require("../site/assets/js/squad-bonus.js");
const players=Array.from({length:11},(_,i)=>({id:1000000+i,pid:i,grade:i<8?8:5,ovr:130,teams:[10,11]}));
const team=(id,name,type,requiredCount,stats,level=1)=>({id,name,type,effects:[{requiredCount,stats,level}]});
const rules={adaptation:{verified:true,bonusFromBase:[null,0,1,2,3,4]},wave:{conditions:[{name:"은빛 물결",minGrade:5},{name:"금빛 물결",minGrade:8},{name:"백금빛 물결",minGrade:11}]},teams:[
team(10,"A","club",11,{all:4,sprintspeed:3},4),
team(11,"B","nation",11,{all:4,finishing:3},4),
team(20,"은빛 물결","grade",8,{all:3},2),
team(21,"금빛 물결","grade",8,{all:4},2),
team(22,"백금빛 물결","grade",8,{all:5},2),
team(30,"관계 A","special",2,{finishing:3}),
team(31,"관계 B","relation",2,{finishing:2}),
team(32,"미충족","special",5,{all:99}),
team(99,"이벤트","event",1,{all:99})
]};
const rel=Object.fromEntries(players.slice(0,2).map(p=>[p.id,[{id:30},{id:31},{id:32}]]));
test("toggle adaptation and team separately, never mutate original OVR",()=>{
const off=B.project(players,rules,rel,10,{adapt:false,team:false});
assert.equal(off.per[0].ovr,130);assert.equal(off.applied.length,0);
const adapt=B.project(players,rules,rel,10,{adapt:true,team:false});assert.equal(adapt.per[0].ovr,134);
const team=B.project(players,rules,rel,10,{adapt:false,team:true});assert.equal(team.per[0].ovr,138);
const both=B.project(players,rules,rel,10,{adapt:true,team:true});assert.equal(both.per[0].ovr,142);assert.equal(players[0].ovr,130);
});
test("one affiliation, feature and grade per player; no lower wave stacking or event guesses",()=>{
const p=B.project(players,rules,rel,10,{adapt:true,team:true});
assert.deepEqual(p.per[0].colors.map(x=>x.id),[10,30,21]);
assert.deepEqual(p.per[8].colors.map(x=>x.id),[10,20]);
assert.equal(p.per[0].stats.all,8);assert.equal(p.per[8].stats.all,7);
assert.equal(p.per[0].stats.finishing,3);assert.equal(p.per[2].stats.finishing,undefined);
assert.equal(p.checked,2);assert.equal(p.total,11);
});
test("thresholds recalculate on removal and missing rules/stats stay unknown",()=>{
const changed=players.slice();changed[0]=null;
const p=B.project(changed,rules,rel,10,{adapt:true,team:true});
assert.equal(p.per[0],null);assert.equal(p.per[1].stats.all,3);
assert.ok(!p.applied.some(x=>[10,11,21,30].includes(x.id)));
assert.equal(B.statValue(null,"finishing",15,p.per[1]),null);
assert.equal(B.statValue(100,"finishing",15,p.per[1]),122);
assert.equal(B.project(players,null,{},10,{adapt:true,team:true}).per[0].ovr,130);
});
test("unverified adaptation or unconfirmed relation is never fabricated",()=>{
const p=B.project(players,{...rules,adaptation:{verified:false,bonusFromBase:[null,0,1,2,3,4]}},{},10,{adapt:true,team:true});
assert.equal(p.adapt,0);assert.ok(!p.applied.some(x=>x.kind==="feature"));
});
