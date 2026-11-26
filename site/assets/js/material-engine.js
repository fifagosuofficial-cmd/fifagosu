/* Exact capped knapsack over independently verified gauge contributions.
 * Price candidates are snapshots, not live offers. Integer gauge units avoid rounding up.
 */
(function(root,factory){const x=factory();if(typeof module==="object"&&module.exports)module.exports=x;else root.FGMaterials=x})(typeof globalThis==="undefined"?this:globalThis,function(){
"use strict";
const safe=v=>Number.isSafeInteger(v)&&v>0;
const source="https://fconline.nexon.com/DataCenter/PlayerGrow";
function create(data,rules){
 const index=new Map(),table=new Map(),cache=new Map();
 const observed=rules?.observed===true&&rules?.verified!==true;
 for(const r of data?.items||[]){
  const [id,name,grade,ovr,price]=r;
  if(!safe(id)||!safe(grade)||grade>13||!safe(ovr)||!safe(price))continue;
  if(!index.has(ovr))index.set(ovr,[]);
  index.get(ovr).push({id,name:String(name||id),grade,ovr,price,pid:id%1000000});
 }
 for(const arr of index.values())arr.sort((a,b)=>a.price-b.price||a.id-b.id||a.grade-b.grade);
 if(rules?.schema===1&&(rules.verified===true||observed)&&rules.source===source&&safe(rules.fullPoints)){
  for(const r of rules.rows||[]){
   if(!safe(r.grade)||r.grade>12||!safe(r.targetOvr)||!Array.isArray(r.materials))continue;
   const entries=r.materials.filter(x=>Array.isArray(x)&&safe(x[0])&&safe(x[1]));
   if(entries.length)table.set(r.grade+":"+r.targetOvr,new Map(entries));
  }
 }
 const ready=index.size>0&&table.size>0;
 function hasRule(base,grade,bonus){return table.has(grade+":"+(base+bonus))}
 function solve(base,grade,bonus,excluded=0,target=100){
  if(!safe(base)||!safe(grade)||grade>12||!Number.isInteger(bonus)||bonus<0)return null;
  const ovr=base+bonus,points=table.get(grade+":"+ovr),full=Math.ceil((rules?.fullPoints||0)*target/100);
  if(!ready||!points||!Number.isFinite(target)||target<=0||target>100)return null;
  const choices=[];
  for(const [o,p] of points){const card=index.get(o)?.find(c=>c.pid!==excluded);if(card)choices.push({...card,points:Math.min(rules.fullPoints,p)})}
  // Same contribution: cheapest material dominates. Repeat purchase allowed.
  const unique=new Map();
  for(const c of choices){const old=unique.get(c.points);if(!old||c.price<old.price)unique.set(c.points,c)}
  const cs=[...unique.values()].sort((a,b)=>b.points-a.points||a.price-b.price);
  let lowest=Infinity;
  const candidates=cs.filter(c=>{if(c.price>=lowest)return false;lowest=c.price;return true});
  const key=grade+":"+ovr+":"+full+":"+candidates.map(c=>c.id+"/"+c.grade+"/"+c.price+"/"+c.points).join(",");
  if(cache.has(key))return cache.get(key);
  let dp=new Map([[0,{cost:0,cards:[]}]]),best=null;
  for(let n=1;n<=5;n++){
   const next=new Map();
   for(const [p,state] of dp)for(const c of candidates){
    const v=Math.min(full,p+c.points),cost=state.cost+c.price;
    if(!safe(cost)||best&&cost>=best.cost)continue;
    const row={cost,cards:[...state.cards,c]};
    if(v===full){best={...row,ovr,grade,gauge:Math.min(100,100*row.cards.reduce((sum,c)=>sum+c.points,0)/rules.fullPoints),local:true,estimated:observed,date:data?.date||null};continue}
    if(!next.has(v)||next.get(v).cost>cost)next.set(v,row);
   }
   dp=new Map();let bound=Infinity;
   for(const [p,row] of [...next].sort((a,b)=>b[0]-a[0]))if(row.cost<bound){dp.set(p,row);bound=row.cost}
   if(!dp.size)break;
  }
  cache.set(key,best);return best;
 }
 // Cost proxy only: five copies of the cheapest priced card at the target's
 // current enhanced OVR, or the nearest higher observed OVR (max +5).
 // Never claim this is a verified full-gauge combination.
 function estimate(base,grade,bonus,excluded=0){
  if(!safe(base)||!safe(grade)||grade>12||!Number.isInteger(bonus)||bonus<0)return null;
  const target=base+bonus;
  for(let o=target;o<=target+5;o++){
   const card=index.get(o)?.find(c=>c.pid!==excluded);
   if(card&&safe(card.price*5))return {cost:card.price*5,cards:Array(5).fill(card),ovr:target,grade,estimated:true,materialOvr:o,gauge:null};
  }
  return null;
 }
 function best(base,grade,bonus,excluded,gain){
  if(!ready||!hasRule(base,grade,bonus)||!Number.isFinite(gain))return null;
  const ovr=base+bonus,full=rules.fullPoints,points=table.get(grade+":"+ovr),choices=[];
  for(const [o,p] of points){const card=index.get(o)?.find(c=>c.pid!==excluded);if(card)choices.push({...card,points:Math.min(full,p)})}
  let dp=new Map([[0,{cost:0,cards:[]}]]),winner=null,bestValue=-Infinity;
  for(let n=1;n<=5&&dp.size;n++){const next=new Map();
   for(const [p,state] of dp)for(const c of choices){const v=Math.min(full,p+c.points),cost=state.cost+c.price;if(!safe(cost))continue;const row={cost,cards:[...state.cards,c]};const score=gain*v/full-cost;
    if(score>bestValue){bestValue=score;winner={...row,ovr,grade,gauge:100*v/full,local:true,estimated:observed,date:data?.date||null}}
    if(v<full&&(!next.has(v)||next.get(v).cost>cost))next.set(v,row);
   }
   dp=new Map();let bound=Infinity;
   for(const [p,row] of [...next].sort((a,b)=>gain>=0?b[0]-a[0]:a[0]-b[0]))if(row.cost<bound){dp.set(p,row);bound=row.cost}
  }
  return winner;
 }
 return {ready,hasRule,solve,best,estimate,coverage:table.size,date:data?.date||null};
}
// Reuse matching displayed quote rates across two different player identities.
 // Rounded displayed values are not verified internal points; mark estimates.
 function observedRules(quotes,pool,bonus){
  const bases=new Map((pool||[]).map(r=>[Number(r[0]),r[2]])),groups=new Map();
  for(const q of quotes||[]){
   const id=Number(q.spid),g=Number(q.grade),base=bases.get(id),b=bonus?.[g];
   if(!safe(id)||!safe(g)||g>12||!safe(base)||!Number.isInteger(b)||b<0||!Array.isArray(q.materials))continue;
   const k=g+":"+(base+b),group=groups.get(k)||new Map(),pid=id%1000000;
   for(const [o,p] of q.materials){if(!safe(o)||!safe(p)||p>10000)continue;const m=group.get(o)||new Map();if(!m.has(pid))m.set(pid,p);else if(m.get(pid)!==p)m.set(pid,-1);group.set(o,m)}
   groups.set(k,group);
  }
  const rows=[];for(const [k,group] of groups){const [grade,targetOvr]=k.split(":").map(Number),materials=[];
   for(const [o,m] of group){const values=[...m.values()];if(values.length>=2&&values[0]>1&&values.every(x=>x===values[0]))materials.push([o,values[0]-1])}
   if(materials.length)rows.push({grade,targetOvr,materials});
  }
  return {schema:1,verified:false,observed:true,source,fullPoints:10000,rows};
 }
 function exactObservedRule(q,base,bonus){return {schema:1,verified:false,observed:true,source,fullPoints:10000,rows:[{grade:q.grade,targetOvr:base+bonus,materials:(q.materials||[]).filter(([o,p])=>safe(o)&&safe(p)&&p>1&&p<=10000).map(([o,p])=>[o,p-1])}]}}
 return {create,observedRules,exactObservedRule};
});