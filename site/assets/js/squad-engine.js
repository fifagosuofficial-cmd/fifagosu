/* Pure, deterministic, bounded roster optimizer. All prices are snapshot BP. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.FGSquad=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const BONUS=[0,0,1,2,4,6,8,11,15,17,19,21,24,27];
const FORMATIONS={
"4231":["GK","LB","CB","CB","RB","CDM","CDM","LM","CAM","RM","ST"],
"433":["GK","LB","CB","CB","RB","CM","CDM","CM","LW","ST","RW"],
"4222":["GK","LB","CB","CB","RB","CDM","CDM","CAM","CAM","ST","ST"],
"4123":["GK","LB","CB","CB","RB","CDM","CM","CM","LW","ST","RW"],
"442":["GK","LB","CB","CB","RB","LM","CM","CM","RM","ST","ST"]};
const CORE={GK:["gkdiving","gkhandling","gkreflexes","gkpositioning"],CB:["sprintspeed","marking","standingtackle","interceptions","heading","strength"],LB:["sprintspeed","acceleration","standingtackle","interceptions","stamina","crossing"],RB:["sprintspeed","acceleration","standingtackle","interceptions","stamina","crossing"],CDM:["interceptions","standingtackle","strength","shortpassing","stamina"],CM:["shortpassing","longpassing","vision","ballcontrol","stamina"],CAM:["vision","shortpassing","dribbling","finishing","longshots"],LM:["sprintspeed","acceleration","crossing","dribbling","stamina"],RM:["sprintspeed","acceleration","crossing","dribbling","stamina"],LW:["sprintspeed","acceleration","dribbling","finishing","crossing"],RW:["sprintspeed","acceleration","dribbling","finishing","crossing"],ST:["finishing","positioning","shotpower","sprintspeed","strength"]};
const STYLES={balanced:[],attack:["finishing","positioning","shotpower","acceleration","sprintspeed"],pass:["shortpassing","longpassing","vision","ballcontrol","dribbling"],defense:["interceptions","standingtackle","marking","strength","sprintspeed"],value:[]};
function safe(n){return Number.isSafeInteger(n)&&n>0}
function candidate(row,pos,grade,options,keys){
 const [id,name,season,pay,base,prices,weak,stats,teams,at]=row;
 const price=prices?.[grade-1];
 if(!safe(id)||!safe(pay)||!safe(base)||!safe(price)||pay>options.salary||price>options.budget)return null;
 if(options.team&&!teams?.includes(options.team))return null;
 const bonus=BONUS[grade];
 if(bonus==null)return null;
 const vals=(CORE[pos]||[]).map(k=>[k,stats?.[keys.indexOf(k)]]).filter(x=>Number.isFinite(x[1])&&x[1]>0);
 const ovr=base+bonus, mean=vals.length?vals.reduce((s,x)=>s+x[1]+bonus,0)/vals.length:null;
 const extra=vals.filter(x=>(STYLES[options.style]||[]).includes(x[0]));
 const style=extra.length?extra.reduce((s,x)=>s+x[1]+bonus,0)/extra.length:null;
 // No guessed ranker ratings or team-color bonuses. OVR remains usable without detail.
 const quality=ovr*.72+(mean??ovr)*.28+(style==null?0:(style-(mean??ovr))*.12)+(pos!=="GK"&&Number.isFinite(weak)?(weak-3)*.65:0);
 return {id,pid:id%1000000,name,season,pay,base,grade,price,ovr,weak,quality,core:vals.map(([k,v])=>[k,v+bonus]),teams:teams||[],at,detail:vals.length>0};
}
function score(c,mode,opts){
 const relative=c.price/(opts.budget/11);
 const wage=c.pay/(opts.salary/11);
 if(mode==="value")return c.quality-5*Math.log1p(relative)-2*wage;
 if(mode==="balanced")return c.quality-2.4*Math.log1p(relative)-1.2*wage;
 return c.quality;
}
function unique(xs){const seen=new Set();return xs.filter(c=>{const k=c.id+":"+c.grade;if(seen.has(k))return false;seen.add(k);return true})}
function poolFor(rows,pos,opts,keys,mode,lock,ban){
 const all=[];
 const grades=lock?(opts.grades.includes(lock.grade)?[lock.grade]:[]):opts.grades;
 for(const row of rows||[]){
   if(lock&&row[0]!==lock.id)continue;
   for(const g of grades){const c=candidate(row,pos,g,opts,keys);if(c&&(!ban||c.pid!==ban.id%1000000))all.push(c)}
 }
 if(lock)return all;
 // Retain strong cards as well as cheap/low-pay and different price bands.
 const byScore=(a,b)=>score(b,mode,opts)-score(a,mode,opts)||a.price-b.price||a.id-b.id;
 all.sort(byScore);
 const buckets=new Map();
 for(const c of all){const k=c.pay+":"+Math.floor(Math.log10(c.price)*2);const a=buckets.get(k)||[];if(a.length<2){a.push(c);buckets.set(k,a)}}
 const diverse=[...buckets.values()].flat().sort(byScore).slice(0,100);
 const cheap=[...all].sort((a,b)=>a.price-b.price||b.quality-a.quality).slice(0,32);
 const wage=[...all].sort((a,b)=>a.pay-b.pay||b.quality-a.quality).slice(0,32);
 const lowWage=new Map();for(const c of all)if(!lowWage.has(c.pay))lowWage.set(c.pay,c);
 return unique([...all.slice(0,90),...diverse,...cheap,...wage,...lowWage.values()]);
}
function solve(catalog,manifest,opts,mode="balanced",locks={},bans={}){
 const positions=FORMATIONS[opts.formation];
 if(!positions||!safe(opts.budget)||!safe(opts.salary)||!Array.isArray(opts.grades)||!opts.grades.length||opts.grades.some(g=>!Number.isInteger(g)||g<1||g>13))return {ok:false,reason:"입력 조건을 확인해 주세요."};
 const keys=manifest.stats||[];
 const poolCache=new Map();
 const slots=positions.map((p,i)=>{
   const lock=locks[i],ban=bans[i],k=p;
   let pool;
   if(lock||ban)pool=poolFor(catalog[p],p,opts,keys,mode,lock,ban);
   else{if(!poolCache.has(k))poolCache.set(k,poolFor(catalog[p],p,opts,keys,mode));pool=poolCache.get(k)}
   return {p,i,pool};
 }).sort((a,b)=>a.pool.length-b.pool.length||a.i-b.i);
 const empty=slots.find(s=>!s.pool.length);if(empty)return {ok:false,reason:empty.p+" 포지션에 조건을 충족하는 카드가 없습니다."};
 const minP=Array(12).fill(0),minW=Array(12).fill(0);
 for(let i=10;i>=0;i--){minP[i]=minP[i+1]+Math.min(...slots[i].pool.map(c=>c.price));minW[i]=minW[i+1]+Math.min(...slots[i].pool.map(c=>c.pay))}
 if(minP[0]>opts.budget||minW[0]>opts.salary)return {ok:false,reason:"최소 후보 비용 또는 급여가 제한을 초과합니다."};
 let best=null;
 // Separate resource penalties explore different trade-offs rather than claiming global optimality.
 for(const [bpPenalty,wagePenalty] of [[0,0],[6,3],[14,8],[3,14]]){
   let beam=[{price:0,pay:0,total:0,used:[],players:[]}];
   for(let j=0;j<11&&beam.length;j++){
     const slot=slots[j],next=[];
     for(const s of beam)for(const c of slot.pool){
       if(s.used.includes(c.pid))continue;
       const price=s.price+c.price,pay=s.pay+c.pay;
       if(!Number.isSafeInteger(price)||price+minP[j+1]>opts.budget||pay+minW[j+1]>opts.salary)continue;
       const total=s.total+score(c,mode,opts);
       next.push({price,pay,total,used:[...s.used,c.pid],players:[...s.players,{...c,pos:slot.p,slot:slot.i}],rank:total-bpPenalty*price/(opts.budget/11)-wagePenalty*pay/(opts.salary/11)});
     }
     next.sort((a,b)=>b.rank-a.rank||a.price-b.price);
     beam=next.slice(0,48);
   }
   for(const s of beam)if(s.players.length===11&&(!best||s.total>best.total||(s.total===best.total&&s.price<best.price)))best=s;
 }
 if(!best)return {ok:false,reason:"탐색 범위에서 완성 조합을 찾지 못했습니다. 예산·급여·팀컬러·강화 조건을 조정해 주세요."};
 return {ok:true,players:best.players.sort((a,b)=>a.slot-b.slot),price:best.price,pay:best.pay,score:best.total/11,mode};
}
function validate(result,opts){
 if(!result?.ok||result.players?.length!==11||!FORMATIONS[opts.formation])return false;
 const ps=result.players;
 return ps.every((p,i)=>p.pos===FORMATIONS[opts.formation][i]&&safe(p.price)&&safe(p.pay)&&(!opts.team||p.teams.includes(opts.team)))&&new Set(ps.map(p=>p.pid)).size===11&&ps.reduce((s,p)=>s+p.price,0)===result.price&&ps.reduce((s,p)=>s+p.pay,0)===result.pay&&result.price<=opts.budget&&result.pay<=opts.salary;
}
return {FORMATIONS,CORE,BONUS,solve,validate};
});