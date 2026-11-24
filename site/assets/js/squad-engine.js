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
// Position-specific tactical roles, not a generic OVR sort. Weights are initial heuristics.
const STYLES={
 balanced:{},speed:{ST:["sprintspeed","acceleration","positioning","finishing"],W:["sprintspeed","acceleration","dribbling","agility"],M:["shortpassing","vision","longpassing"],FB:["sprintspeed","acceleration","stamina"],CB:["sprintspeed","acceleration","marking"]},
 pass:{ST:["shortpassing","ballcontrol","positioning","finishing"],W:["shortpassing","ballcontrol","agility","dribbling"],M:["shortpassing","longpassing","vision","ballcontrol","composure","agility"],FB:["shortpassing","ballcontrol","stamina"],CB:["shortpassing","longpassing","composure"]},
 longshot:{ST:["longshots","shotpower","finishing","curve"],W:["longshots","shotpower","curve","dribbling"],M:["longshots","shotpower","curve","vision"],FB:["shortpassing","stamina"],CB:["marking","interceptions","strength"]},
 cross:{ST:["heading","jumping","positioning","strength","finishing"],W:["crossing","curve","acceleration","sprintspeed"],M:["longpassing","vision","crossing"],FB:["crossing","curve","stamina","sprintspeed"],CB:["heading","jumping","marking","strength"]},
 press:{ST:["stamina","aggression","acceleration","positioning"],W:["stamina","acceleration","aggression","interceptions"],M:["stamina","aggression","interceptions","standingtackle"],FB:["stamina","interceptions","sprintspeed"],CB:["acceleration","interceptions","marking","strength"]},
 counter:{ST:["sprintspeed","positioning","finishing","strength"],W:["sprintspeed","acceleration","dribbling"],M:["interceptions","longpassing","vision","shortpassing"],FB:["sprintspeed","standingtackle","interceptions"],CB:["sprintspeed","marking","strength","interceptions"]},
 defense:{M:["interceptions","standingtackle","strength","stamina"],FB:["marking","standingtackle","sprintspeed","stamina"],CB:["marking","standingtackle","strength","heading","interceptions"],GK:["gkreflexes","gkdiving","gkpositioning"]},
 attack:{ST:["finishing","positioning","shotpower","acceleration"],W:["finishing","dribbling","sprintspeed"],M:["vision","shortpassing","longshots"]},value:{}};
const ROLE=p=>p==="GK"?"GK":p==="CB"?"CB":/^[LR]B$/.test(p)?"FB":/^[LR][MW]$/.test(p)?"W":p==="ST"?"ST":"M";
const ROLE_PAY={balanced:{ST:33,CAM:32,W:29,M:29,CB:29,FB:27,GK:22},attack:{ST:34,CAM:34,W:32,M:29,CB:27,FB:24,GK:21},midfield:{ST:31,CAM:34,W:28,M:33,CB:28,FB:25,GK:21},wide:{ST:32,CAM:29,W:33,M:27,CB:27,FB:31,GK:21},defense:{ST:30,CAM:29,W:27,M:31,CB:33,FB:29,GK:25}};
const ROLE_BP={balanced:{ST:1.6,CAM:1.3,W:1.15,M:1,CB:1,FB:.75,GK:.55},attack:{ST:2,CAM:1.55,W:1.4,M:1,CB:.85,FB:.55,GK:.45},midfield:{ST:1.3,CAM:1.7,W:1,M:1.5,CB:.9,FB:.65,GK:.45},wide:{ST:1.45,CAM:1,W:1.5,M:.9,CB:.9,FB:1.3,GK:.45},defense:{ST:1.2,CAM:1,W:.85,M:1.3,CB:1.5,FB:1,GK:.9}};
function investment(opts,mode){
 if(ROLE_PAY[opts.investment])return opts.investment;
 if(mode==="value")return "balanced";
 if(mode==="balanced")return opts.style==="pass"||opts.style==="longshot"?"midfield":opts.style==="cross"?"wide":opts.style==="defense"?"defense":"balanced";
 return opts.style==="cross"?"wide":opts.style==="defense"?"defense":opts.style==="pass"?"midfield":"attack";
}
function targets(opts,mode){
 const inv=investment(opts,mode),ps=FORMATIONS[opts.formation],w=p=>p==="CAM"?"CAM":ROLE(p);
 const sum=ps.reduce((n,p)=>n+ROLE_PAY[inv][w(p)],0),bp=ps.reduce((n,p)=>n+ROLE_BP[inv][w(p)],0);
 return Object.fromEntries(ps.map(p=>[p,{pay:opts.salary*ROLE_PAY[inv][w(p)]/sum,budget:opts.budget*ROLE_BP[inv][w(p)]/bp}]));
}
function safe(n){return Number.isSafeInteger(n)&&n>0}
function candidate(row,pos,grade,options,keys){
 const [id,name,season,pay,base,prices,weak,stats,teams,at,games,height,traits=[]]=row;
 const price=prices?.[grade-1];
 if(!safe(id)||!safe(pay)||!safe(base)||!safe(price)||pay>options.salary||price>options.budget)return null;
 if(options.team&&!teams?.includes(options.team))return null;
 const bonus=BONUS[grade];
 if(bonus==null)return null;
 const role=ROLE(pos),tactical=(STYLES[options.style]||{})[role]||[],coreKeys=[...new Set([...(CORE[pos]||[]),...tactical])];
 const vals=coreKeys.map(k=>[k,stats?.[keys.indexOf(k)]]).filter(x=>Number.isFinite(x[1])&&x[1]>0);
 const ovr=base+bonus, avg=xs=>xs.length?xs.reduce((s,x)=>s+x[1]+bonus,0)/xs.length:null;
 const mean=avg(vals.filter(x=>(CORE[pos]||[]).includes(x[0]))),style=avg(vals.filter(x=>tactical.includes(x[0])));
 const relevant=options.style==="speed"?/라인 브레이커|스피드스터/:options.style==="pass"?/플레이 메이커|테크니컬 드리블러/:options.style==="longshot"?/예리한 감아차기|중거리 슛/:options.style==="cross"?(/^(W|FB)$/.test(role)?/크로스|아웃사이드/:/파워 헤더|크로스 포쳐/):options.style==="press"?/파이터|2개의 심장|체이서/:options.style==="counter"?/라인 브레이커|스피드스터|체이서/:options.style==="defense"?/파이터|체이서|와일드 태클러/:null;
 const matched=relevant?traits.filter(t=>relevant.test(t)):[];
 const physical=options.style==="cross"&&role==="ST"&&Number.isFinite(height)?Math.max(-2,Math.min(2,(height-180)*.1)):0;
 const quality=ovr*.57+(mean??ovr)*.25+(style??mean??ovr)*.18+(pos!=="GK"&&Number.isFinite(weak)?(weak-3)*.65:0)+physical+Math.min(1.5,matched.length*.65);
 return {id,pid:id%1000000,name,season,pay,base,grade,price,ovr,weak,quality,core:vals.map(([k,v])=>[k,v+bonus]),teams:teams||[],at,detail:vals.length>0,games:Number.isInteger(games)&&games>=0?games:null,height:height||null,matched};
}
function score(c,mode,opts,target){
 const relative=c.price/Math.max(1,target.budget),gap=Math.abs(c.pay-target.pay);
 // Observed card games are only a card-level popularity tie-break; not grade-specific ranker use.
 const pop=c.games==null?0:Math.min(1.6,Math.log1p(c.games)*.18);
 const strength=mode==="performance"?1.14:1;
 const cost=mode==="value"?2.5:mode==="balanced"?1.2:.35;
 return c.quality*strength+pop-cost*Math.log1p(relative)-gap*.38;
}
function unique(xs){const seen=new Set();return xs.filter(c=>{const k=c.id+":"+c.grade;if(seen.has(k))return false;seen.add(k);return true})}
function poolFor(rows,pos,opts,keys,mode,lock,ban,target){
 const all=[];
 const grades=lock?(opts.grades.includes(lock.grade)?[lock.grade]:[]):opts.grades;
 for(const row of rows||[]){
   if(lock&&row[0]!==lock.id)continue;
   for(const g of grades){const c=candidate(row,pos,g,opts,keys);if(c&&(!ban||c.pid!==ban.id%1000000))all.push(c)}
 }
 if(lock)return all;
 // Retain strong cards as well as cheap/low-pay and different price bands.
 // Do not fill a squad with a severely underpowered bargain just to meet wage limits.
 // Benchmark only candidates affordable within a generous position allocation.
 let top=-Infinity;
 for(const c of all)if(c.price<=target.budget*2.5&&c.pay<=target.pay+5)top=Math.max(top,c.ovr);
 if(!Number.isFinite(top))for(const c of all)top=Math.max(top,c.ovr);
 const eligible=all.filter(c=>c.ovr>=top-12);
 all.length=0;for(const c of eligible)all.push(c);
 const byScore=(a,b)=>score(b,mode,opts,target)-score(a,mode,opts,target)||(b.games??-1)-(a.games??-1)||a.price-b.price||a.id-b.id;
 all.sort(byScore);
 const buckets=new Map();
 for(const c of all){const k=c.pay+":"+Math.floor(Math.log10(c.price)*2);const a=buckets.get(k)||[];if(a.length<2){a.push(c);buckets.set(k,a)}}
 const diverse=[...buckets.values()].flat().sort(byScore).slice(0,110);
 const cheap=[...all].sort((a,b)=>a.price-b.price||b.quality-a.quality).slice(0,32);
 const wage=[...all].sort((a,b)=>a.pay-b.pay||b.quality-a.quality).slice(0,32);
 const lowWage=new Map();for(const c of all)if(!lowWage.has(c.pay))lowWage.set(c.pay,c);
 const bestByPlayer=new Map();for(const c of all)if(!bestByPlayer.has(c.pid))bestByPlayer.set(c.pid,c);
 return unique([...all.slice(0,70),...[...bestByPlayer.values()].slice(0,70),...diverse,...cheap,...wage,...lowWage.values()]);
}
function solve(catalog,manifest,opts,mode="balanced",locks={},bans={}){
 const positions=FORMATIONS[opts.formation];
 if(!positions||!safe(opts.budget)||!safe(opts.salary)||!Array.isArray(opts.grades)||!opts.grades.length||opts.grades.some(g=>!Number.isInteger(g)||g<1||g>13))return {ok:false,reason:"입력 조건을 확인해 주세요."};
 const keys=manifest.stats||[],allocation=targets(opts,mode);
 const poolCache=new Map();
 const slots=positions.map((p,i)=>{
   const lock=locks[i],ban=bans[i],k=p;
   let pool;
   if(lock||ban)pool=poolFor(catalog[p],p,opts,keys,mode,lock,ban,allocation[p]);
   else{if(!poolCache.has(k))poolCache.set(k,poolFor(catalog[p],p,opts,keys,mode,null,null,allocation[p]));pool=poolCache.get(k)}
   return {p,i,pool};
 }).sort((a,b)=>a.pool.length-b.pool.length||a.i-b.i);
 const empty=slots.find(s=>!s.pool.length);if(empty)return {ok:false,reason:empty.p+" 포지션에 조건을 충족하는 카드가 없습니다."};
 const minP=Array(12).fill(0),minW=Array(12).fill(0);
 for(let i=10;i>=0;i--){minP[i]=minP[i+1]+Math.min(...slots[i].pool.map(c=>c.price));minW[i]=minW[i+1]+Math.min(...slots[i].pool.map(c=>c.pay))}
 if(minP[0]>opts.budget||minW[0]>opts.salary)return {ok:false,reason:"최소 후보 비용 또는 급여가 제한을 초과합니다."};
 const finalists=[];
 // Separate resource penalties explore different trade-offs rather than claiming global optimality.
 for(const [bpPenalty,wagePenalty] of [[0,-5],[3,-2],[6,4],[2,8],[0,-10]]){
   let beam=[{price:0,pay:0,total:0,used:[],players:[]}];
   for(let j=0;j<11&&beam.length;j++){
     const slot=slots[j],next=[];
     for(const s of beam)for(const c of slot.pool){
       if(s.used.includes(c.pid))continue;
       const price=s.price+c.price,pay=s.pay+c.pay;
       if(!Number.isSafeInteger(price)||price+minP[j+1]>opts.budget||pay+minW[j+1]>opts.salary)continue;
       const total=s.total+score(c,mode,opts,allocation[slot.p]);
       next.push({price,pay,total,used:[...s.used,c.pid],players:[...s.players,{...c,pos:slot.p,slot:slot.i}],rank:total-bpPenalty*price/(opts.budget/11)-wagePenalty*pay/(opts.salary/11)});
     }
     next.sort((a,b)=>b.rank-a.rank||a.price-b.price);
     // Keep alternatives at different salary totals; don't let a single salary path crowd them out.
     const byPay=new Map(),kept=[];
     for(const state of next){const n=byPay.get(state.pay)||0;if(n>=5)continue;byPay.set(state.pay,n+1);kept.push(state);if(kept.length>=64)break}
     beam=kept;
   }
   for(const s of beam)if(s.players.length===11){const field=s.players.filter(p=>p.pos!=="GK");const sorted=field.map(p=>p.ovr).sort((a,b)=>a-b);const median=(sorted[4]+sorted[5])/2;if(s.players.some(p=>!locks[p.slot]&&p.ovr<median-18))continue;finalists.push(s)}
 }
 const bestQuality=Math.max(...finalists.map(s=>s.total));
 // Try to fill all 315, without sacrificing more than 2 points per player on our score.
 const best=finalists.filter(s=>s.total>=bestQuality-22).sort((a,b)=>b.pay-a.pay||b.total-a.total||a.price-b.price)[0];
 if(!best)return {ok:false,reason:"탐색 범위에서 완성 조합을 찾지 못했습니다. 예산·급여·팀컬러·강화 조건을 조정해 주세요."};
 return {ok:true,players:best.players.sort((a,b)=>a.slot-b.slot),price:best.price,pay:best.pay,score:best.total/11,mode,investment:investment(opts,mode),targets:allocation};
}
function validate(result,opts){
 if(!result?.ok||result.players?.length!==11||!FORMATIONS[opts.formation])return false;
 const ps=result.players;
 return ps.every((p,i)=>p.pos===FORMATIONS[opts.formation][i]&&safe(p.price)&&safe(p.pay)&&(!opts.team||p.teams.includes(opts.team)))&&new Set(ps.map(p=>p.pid)).size===11&&ps.reduce((s,p)=>s+p.price,0)===result.price&&ps.reduce((s,p)=>s+p.pay,0)===result.pay&&result.price<=opts.budget&&result.pay<=opts.salary;
}
return {FORMATIONS,CORE,BONUS,solve,validate,targets,investment};
});