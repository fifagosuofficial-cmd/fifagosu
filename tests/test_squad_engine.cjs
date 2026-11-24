const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../site/assets/js/squad-engine.js');
const opts={formation:'4231',budget:1100,salary:110,team:7,grades:[1,5],style:'balanced'};
const manifest={stats:['sprintspeed','finishing','shortpassing','marking']};
function row(id,price,pay,ovr,teams=[7]){return [id,'P'+id,'TEST',pay,ovr,[price,null,null,null,price*2],4,[ovr,ovr,ovr,ovr],teams,'2026-11-24']}
function fixture(){
 const catalog={};
 for(const [i,p] of [...new Set(E.FORMATIONS['4231'])].entries()){
  catalog[p]=Array.from({length:4},(_,j)=>row(1000000+i*10+j+1,50+j*10,8+j,100+j));
  catalog[p].push(row(2000000+i*10+1,1,1,150,[9]));
 }
 return catalog;
}
test('all 3 modes satisfy 11 distinct players, team, BP, salary and positions',()=>{
 for(const mode of ['performance','balanced','value']){
  const r=E.solve(fixture(),manifest,opts,mode);
  assert.equal(r.ok,true);assert.equal(E.validate(r,opts),true);
  assert.ok(r.players.every(p=>p.teams.includes(7)));
 }
});
test('lock exact card and grade, preserve all other slots when replacing',()=>{
 const cat=fixture(),r=E.solve(cat,manifest,opts);
 assert.ok(r.ok);const p=r.players[0];
 const locks=Object.fromEntries(r.players.slice(1).map((p,i)=>[i+1,{id:p.id,grade:p.grade}]));
 const replacement=E.solve(cat,manifest,opts,'balanced',locks,{0:{id:p.id,grade:p.grade}});
 assert.ok(replacement.ok);assert.notEqual(replacement.players[0].pid,p.pid);
 for(let i=1;i<11;i++)assert.deepEqual([replacement.players[i].id,replacement.players[i].grade],[r.players[i].id,r.players[i].grade]);
});
test('reject over-budget, over-salary, missing positions and unavailable team',()=>{
 for(const o of [{...opts,budget:1},{...opts,salary:1},{...opts,team:99}]){
  assert.equal(E.solve(fixture(),manifest,o).ok,false);
 }
 const cat=fixture();delete cat.GK;
 assert.equal(E.solve(cat,manifest,opts).ok,false);
});
test('do not use missing grade prices or locked grade outside selection',()=>{
 assert.equal(E.solve(fixture(),manifest,{...opts,grades:[3]}).ok,false);
 const cat=fixture(),id=cat.GK[0][0];
 assert.equal(E.solve(cat,manifest,{...opts,grades:[1]},'balanced',{0:{id,grade:5}}).ok,false);
});
test('same underlying player across seasons cannot fill multiple slots',()=>{
 const cat=Object.fromEntries([...new Set(E.FORMATIONS['4231'])].map((p,i)=>[p,[row((i+1)*1000000+42,10,5,100)]]));
 assert.equal(E.solve(cat,manifest,opts).ok,false);
});
test('actual grade price and grade bonus are retained',()=>{
 const cat=fixture(),o={...opts,budget:2000,grades:[5]};
 const r=E.solve(cat,manifest,o);assert.ok(r.ok);
 for(const p of r.players){const source=cat[p.pos].find(x=>x[0]===p.id);assert.equal(p.price,source[5][4]);assert.equal(p.ovr,source[4]+E.BONUS[5])}
});