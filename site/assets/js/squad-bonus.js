/* Projected bonuses: one affiliation, one feature, one grade wave per player. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.FGSquadBonus=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const sumStats=(a,b)=>{for(const [k,v] of Object.entries(b||{}))if(Number.isFinite(v)&&v>0)a[k]=(a[k]||0)+v;return a};
const power=e=>(e.stats.all||0)*34+Object.entries(e.stats).filter(([k])=>k!=="all").reduce((n,[k,v])=>n+v,0);
function effect(t,count){
 const es=(t.effects||[]).filter(e=>Number.isInteger(e.requiredCount)&&e.requiredCount>0&&e.requiredCount<=count&&e.stats&&Object.values(e.stats).every(v=>Number.isFinite(v)&&v>=0));
 return es.sort((a,b)=>(b.level||0)-(a.level||0)||power(b)-power(a))[0]||null;
}
function project(players,rules,relations,selected,flags){
 const roster=players.filter(Boolean),ids=new Set(roster.map(p=>p.pid));
 const unique=ids.size===roster.length;
 const adapt=flags.adapt&&rules?.adaptation?.verified===true&&Number.isFinite(rules.adaptation.bonusFromBase?.[5])?rules.adaptation.bonusFromBase[5]:0;
 const groups={club:[],feature:[],grade:[]};
 if(flags.team&&unique){
   const wave=new Map((rules?.wave?.conditions||[]).map(x=>[x.name,x.minGrade]));
   for(const t of rules?.teams||[]){
     const kind=t.type==="club"||t.type==="nation"?"club":t.type==="grade"?"grade":t.type==="special"||t.type==="relation"?"feature":null;
     if(!kind||!t.id)continue;
     const min=wave.get(t.name);
     const members=roster.filter(p=>kind==="club"?p.teams?.includes(t.id):kind==="grade"?Number.isInteger(min)&&p.grade>=min:relations?.[p.id]?.some(x=>Number(x.id)===t.id));
     const e=effect(t,members.length);
     if(e)groups[kind].push({id:t.id,name:t.name,kind,count:members.length,need:e.requiredCount,level:e.level,stats:e.stats,members:members.map(p=>p.id),minGrade:min});
   }
 }
 const choose=(arr,p,kind)=>{
   const eligible=arr.filter(t=>t.members.includes(p.id));
   return eligible.sort((a,b)=>(kind==="club"?Number(b.id===selected)-Number(a.id===selected):0)||power(b)-power(a)||b.count-a.count||a.id-b.id)[0]||null;
 };
 const applied=new Map(),per=players.map(p=>{
   if(!p)return null;
   const colors=Object.entries(groups).map(([k,v])=>choose(v,p,k)).filter(Boolean);
   const stats={};for(const c of colors){sumStats(stats,c.stats);const found=applied.get(c.id)||{...c,applied:0};found.applied++;applied.set(c.id,found)}
   return {adapt,stats,colors,ovr:p.ovr+adapt+(stats.all||0)};
 });
 return {per,applied:[...applied.values()],groups,adapt,checked:roster.filter(p=>Array.isArray(relations?.[p.id])).length,total:roster.length};
}
function statValue(base,key,gradeBonus,projection){
 if(!Number.isFinite(base)||base<=0)return null;
 return base+gradeBonus+(projection?.adapt||0)+(projection?.stats?.all||0)+(projection?.stats?.[key]||0);
}
return {project,statValue};
});