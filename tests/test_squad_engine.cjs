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
test('strong balanced roster does not insert a drastically weak cheap card',()=>{
 const cat=fixture();
 for(const p of Object.keys(cat))cat[p].push(row(8000000+Object.keys(cat).indexOf(p)+1,1,1,45));
 const r=E.solve(cat,manifest,opts,'value');
 assert.ok(r.ok);assert.ok(r.players.every(p=>p.ovr>=100));
});
test('315 cap is filled where a strong roster can reach it',()=>{
 const cat={};
 for(const [i,p] of [...new Set(E.FORMATIONS['4231'])].entries()){
  cat[p]=Array.from({length:8},(_,j)=>row(1000000+i*20+j+1,100,25+j,125,[7]));
 }
 const o={...opts,budget:5000,salary:315,grades:[1]};
 const r=E.solve(cat,manifest,o);
 assert.ok(r.ok);assert.equal(r.pay,315);assert.ok(E.validate(r,o));
});
test('same grade and comparable stats favor observed popular card',()=>{
 const cat=fixture(),o={...opts,budget:5000,salary:110,grades:[1]};
 cat.GK=[row(1000001,50,9,105),row(1000002,50,9,105)];
 cat.GK[0].push(1,190,[]);cat.GK[1].push(1000,190,[]);
 const r=E.solve(cat,manifest,o);
 assert.ok(r.ok);assert.equal(r.players[0].id,1000002);
});
test('one standard investment prioritizes attackers and CB across styles and modes',()=>{
 const o={...opts,salary:315};
 const a=E.targets({...o,style:'cross',investment:'wide'},'performance');
 const b=E.targets({...o,style:'pass',investment:'attack'},'value');
 assert.deepEqual(a,b);
 assert.equal(a.ST.pay,34);assert.equal(a.CAM.pay,34);assert.equal(a.CB.pay,33);
 assert.equal(a.LB.pay,23);assert.equal(a.RB.pay,23);assert.equal(a.GK.pay,19);
 assert.ok(a.ST.budget>a.LB.budget&&a.CB.budget>a.GK.budget&&a.CB.pay>a.CDM.pay);
 assert.equal(E.FORMATIONS['4231'].reduce((n,p)=>n+a[p].pay,0),315);
});
test('style scoring favors cross providers and tall heading finishers',()=>{
 const cat=fixture(),keys=['sprintspeed','crossing','heading','jumping','finishing','positioning','strength','curve'];
 const x=row(1000081,60,9,110),y=row(1000082,60,9,110);
 x[7]=[120,80,80,80,110,110,100,100];y[7]=[110,110,135,135,110,110,120,120];
 x.push(10,170,[]);y.push(10,195,['파워 헤더']);
 cat.ST=[x,y];
 const r=E.solve(cat,{stats:keys},{...opts,budget:5000,grades:[1],style:'cross'});
 assert.ok(r.ok);assert.equal(r.players[10].id,y[0]);
});

test('all 33 formation presets use exactly 11 distinct pitch slots and supported positions',()=>{
 assert.equal(Object.keys(E.FORMATIONS).length,33);
 for(const [id,positions] of Object.entries(E.FORMATIONS)){
  assert.equal(positions.length,11,id);
  assert.equal(positions.filter(p=>p==='GK').length,1,id);
  assert.ok(positions.every(p=>E.CORE[p]),id);
  assert.deepEqual(E.LINES[id].flat().sort((a,b)=>a-b),Array.from({length:11},(_,i)=>i),id);
  assert.ok(Math.abs(positions.reduce((n,p)=>n+E.targets({...opts,formation:id,salary:315})[p].pay,0)-315)<1e-8,id);
 }
});
test('every formation can produce a valid lineup using available position cards',()=>{
 const positions=[...new Set(Object.values(E.FORMATIONS).flat())],cat={};
 positions.forEach((p,i)=>{cat[p]=Array.from({length:5},(_,j)=>row(1000000+i*20+j+1,50,9,110))});
 for(const formation of Object.keys(E.FORMATIONS)){
   const o={...opts,formation,grades:[1]};
   const r=E.solve(cat,manifest,o);
   assert.ok(r.ok,formation+': '+r.reason);assert.ok(E.validate(r,o),formation);
 }
});
test('silver, gold and platinum minimums include higher grades, custom range is inclusive',()=>{
 assert.deepEqual(E.gradeRange(5,13),[5,6,7,8,9,10,11,12,13]);
 assert.deepEqual(E.gradeRange(8,13),[8,9,10,11,12,13]);
 assert.deepEqual(E.gradeRange(11,13),[11,12,13]);
 assert.deepEqual(E.gradeRange(6,9),[6,7,8,9]);
 assert.deepEqual(E.gradeRange(8,5),[]);
});
test('manual search and automatic substitution preserve team, grade, budget, salary and unique players',()=>{
 const cat=fixture(),r=E.solve(cat,manifest,opts);assert.ok(r.ok);
 const old=r.players[0],other=r.players[1];
 const rows=[...cat.GK,row(other.id,1,1,150),row(9000001,1,1,150,[9]),row(9000002,100000,9,150),row(9000003,1,100,150)];
 const swaps=E.alternatives(rows,manifest,opts,'balanced',r.players,0,'',true);
 assert.ok(swaps.length);
 assert.ok(swaps.every(p=>p.pid!==old.pid&&p.pid!==other.pid&&p.teams.includes(7)&&opts.grades.includes(p.grade)));
 const removed=r.players.slice();removed[0]=null;
 const found=E.alternatives(rows,manifest,opts,'balanced',removed,0,'P'+old.id,false);
 assert.ok(found.some(p=>p.id===old.id));
 assert.ok(found.every(p=>p.price<=opts.budget-(r.price-old.price)&&p.pay<=opts.salary-(r.pay-old.pay)));
 assert.deepEqual(E.alternatives(rows,manifest,opts,'balanced',removed,0,'no matching player'),[]);
 const p=swaps[0],players=r.players.slice();players[0]=p;
 assert.ok(E.validate({...r,players,price:r.price-old.price+p.price,pay:r.pay-old.pay+p.pay},opts));
});

test('replacement popup ranks at least five different players when feasible, not five grades of one player',()=>{
 const cat=fixture(),o={...opts,budget:5000,salary:200,grades:[1,5]};
 const r=E.solve(cat,manifest,o);assert.ok(r.ok);
 const old=r.players[0],taken=r.players[1];
 const rows=[...Array.from({length:12},(_,i)=>row(7000000+i+100,50+i,9,110+i%3)),row(old.id,1,1,150),row(taken.id,1,1,150),row(9000001,1,1,150,[9])];
 const rec=E.alternatives(rows,manifest,o,'balanced',r.players,0,'',true);
 assert.equal(rec.length,10);
 assert.equal(new Set(rec.map(p=>p.pid)).size,10);
 assert.ok(rec.every(p=>p.pid!==old.pid&&p.pid!==taken.pid&&p.teams.includes(7)));
 for(const p of rec){
  const players=r.players.slice();players[0]=p;
  assert.ok(E.validate({...r,players,price:r.price-old.price+p.price,pay:r.pay-old.pay+p.pay},o));
 }
 const limited=E.alternatives(rows.slice(0,2),manifest,o,'balanced',r.players,0,'',true);
 assert.equal(limited.length,2);
});
