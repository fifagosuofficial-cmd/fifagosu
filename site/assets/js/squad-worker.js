"use strict";
const version=new URL(self.location.href).searchParams.get("v")||"";
importScripts("squad-engine.js?v="+encodeURIComponent(version));
const base="/assets/squad-data/";
const cache=new Map();
async function load(name){
 if(!cache.has(name))cache.set(name,fetch(base+name+".json?v="+encodeURIComponent(version)).then(r=>{if(!r.ok)throw Error("선수 데이터 조회 실패: "+name);return r.json()}).catch(e=>{cache.delete(name);throw e}));
 return cache.get(name);
}
self.onmessage=async e=>{
 const {id,opts,locks,bans,modes}=e.data;
 try{
   const manifest=await load("manifest");
   const positions=FGSquad.FORMATIONS[opts.formation];
   if(!positions)throw Error("포메이션 오류");
   const catalog=Object.fromEntries(await Promise.all([...new Set(positions)].map(async p=>[p,await load(p)])));
   const results={};
   for(const mode of modes){const r=FGSquad.solve(catalog,manifest,opts,mode,locks,bans);if(r.ok&&!FGSquad.validate(r,opts))throw Error("추천 검증 실패");results[mode]=r}
   self.postMessage({id,results});
 }catch(err){self.postMessage({id,error:err.message||String(err)})}
};