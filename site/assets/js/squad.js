(function(){
"use strict";
const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ver=new URL(document.currentScript.src).searchParams.get("v")||"";
const FORM={"4231":["GK","LB","CB","CB","RB","CDM","CDM","LM","CAM","RM","ST"],"433":["GK","LB","CB","CB","RB","CM","CDM","CM","LW","ST","RW"],"4222":["GK","LB","CB","CB","RB","CDM","CDM","CAM","CAM","ST","ST"],"4123":["GK","LB","CB","CB","RB","CDM","CM","CM","LW","ST","RW"],"442":["GK","LB","CB","CB","RB","LM","CM","CM","RM","ST","ST"]};
const LINES={"4231":[[10],[7,8,9],[5,6],[1,2,3,4],[0]],"433":[[8,9,10],[5,7],[6],[1,2,3,4],[0]],"4222":[[9,10],[7,8],[5,6],[1,2,3,4],[0]],"4123":[[8,9,10],[6,7],[5],[1,2,3,4],[0]],"442":[[9,10],[5,6,7,8],[1,2,3,4],[0]]};
const MODES={performance:"성능 최우선",balanced:"밸런스형",value:"가성비형"};
const STATS={sprintspeed:"속력",acceleration:"가속력",finishing:"골 결정력",shotpower:"슛 파워",longshots:"중거리 슛",positioning:"위치 선정",shortpassing:"짧은 패스",vision:"시야",crossing:"크로스",longpassing:"긴 패스",dribbling:"드리블",ballcontrol:"볼 컨트롤",agility:"민첩성",balance:"밸런스",reactions:"반응 속도",marking:"대인 수비",standingtackle:"태클",interceptions:"가로채기",heading:"헤더",strength:"몸싸움",stamina:"스태미너",gkdiving:"GK 다이빙",gkhandling:"GK 핸들링",gkreflexes:"GK 반응속도",gkpositioning:"GK 위치 선정"};
const img="https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/";
const STORE="fg-squad-v1", RECENT="fg-squad-recent-v1";
let worker=null,requestId=0,task=null,manifest=null,results={},active="balanced",locks={},currentOpts=null;
const status=(s,bad=false)=>{$("sqStatus").textContent=s;$("sqStatus").classList.toggle("sq-error",bad)};
const money=n=>Math.floor(n/1e12)+"조 "+Math.floor(n%1e12/1e8).toLocaleString("ko-KR")+"억";
function fields(){
 const grades=$("sqGrades").value;
 return {budget:Math.round(Number($("sqBudget").value)*1e12),salary:Number($("sqSalary").value),team:Number($("sqTeam").value),formation:$("sqFormation").value,style:$("sqStyle").value,grades:grades==="all"?Array.from({length:13},(_,i)=>i+1):grades==="mix"?[1,5,8]:[Number(grades)]}
}
function busy(on){document.querySelectorAll("#squad button,#squad input,#squad select").forEach(el=>el.disabled=on);if(!on&&!manifest)$("sqRun").disabled=true}
function clearOutput(){results={};currentOpts=null;$("sqOutput").hidden=true}
function lockView(){
 const pos=FORM[$("sqFormation").value]||[];
 $("sqLocks").innerHTML=Object.entries(locks).map(([i,p])=>'<button type="button" data-unlock="'+esc(i)+'">'+esc(pos[i])+" · "+esc(p.name||p.id)+" "+esc(p.grade)+"강 ×</button>").join("");
}
function validOpts(o){return o&&Number.isSafeInteger(o.budget)&&o.budget>0&&o.budget<=9e15&&Number.isInteger(o.salary)&&o.salary>=11&&o.salary<=1100&&FORM[o.formation]&&["balanced","attack","pass","defense","value"].includes(o.style)&&Array.isArray(o.grades)&&o.grades.length&&o.grades.every(g=>Number.isInteger(g)&&g>=1&&g<=13)&&(!o.team||manifest.teams.some(t=>t.id===o.team))}
function applyOpts(o){
 if(!validOpts(o))throw Error("저장된 설정이 현재 데이터와 맞지 않습니다.");
 $("sqBudget").value=String(o.budget/1e12);$("sqSalary").value=String(o.salary);$("sqTeam").value=String(o.team);$("sqFormation").value=o.formation;$("sqStyle").value=o.style;
 $("sqGrades").value=o.grades.length===13?"all":o.grades.length===1?String(o.grades[0]):"mix";
}
function request(opts,modes,ls,bs={},replace=false){
 if(!manifest||!validOpts(opts)){status("입력 조건을 확인해 주세요.",true);return}
 if(task)return;
 if(!worker){try{worker=new Worker("/assets/js/squad-worker.js?v="+encodeURIComponent(ver));worker.onmessage=receive;worker.onerror=()=>{task=null;worker.terminate();worker=null;busy(false);status("추천 작업이 중단됐습니다. 다시 시도해 주세요.",true)}}catch(e){status("브라우저가 추천 작업을 지원하지 않습니다.",true);return}}
 const id=++requestId;task={id,opts,modes,replace};busy(true);status("실제 선수 후보를 탐색하고 예산·급여를 검증하고 있습니다…");
 worker.postMessage({id,opts,modes,locks:ls,bans:bs});
}
function receive(e){
 const t=task;if(!t||e.data.id!==t.id)return;task=null;busy(false);
 if(e.data.error){status(e.data.error,true);return}
 const next=e.data.results;
 if(t.replace){
   const r=next[t.modes[0]];if(!r.ok){status(r.reason,true);return}
   results={...results,[t.modes[0]]:r};
 }else{results=next;currentOpts=t.opts;active=results.balanced?.ok?"balanced":Object.keys(results).find(k=>results[k].ok)||Object.keys(results)[0]}
 const failures=Object.entries(next).filter(([k,r])=>!r.ok).map(([k,r])=>MODES[k]+": "+r.reason);
 status(failures.length?failures.join(" / "):"추천 완료 · 예산 및 급여 조건 검증 통과",!!failures.length);render();
}
function render(){
 $("sqOutput").hidden=false;
 $("sqModes").innerHTML=Object.entries(results).map(([k,r])=>'<button type="button" data-mode="'+k+'" aria-pressed="'+(active===k)+'">'+MODES[k]+(r.ok?"":" · 조합 없음")+"</button>").join("");
 const r=results[active];
 if(!r?.ok){$("sqSummary").textContent=r?.reason||"추천 결과 없음";$("sqPitch").innerHTML="";$("sqRows").innerHTML="";$("sqSave").disabled=$("sqShare").disabled=true;return}
 $("sqSave").disabled=$("sqShare").disabled=false;
 const o=currentOpts, avg=r.players.reduce((s,p)=>s+p.ovr,0)/11;
 $("sqSummary").innerHTML="<div><span>선수 구매가 합계</span><b>"+money(r.price)+"</b><small>잔여 "+money(o.budget-r.price)+"</small></div><div><span>급여 합계</span><b>"+r.pay+" / "+o.salary+"</b><small>잔여 "+(o.salary-r.pay)+"</small></div><div><span>평균 포지션 OVR</span><b>"+avg.toFixed(1)+"</b><small>선발 11명 · 보너스 제외</small></div>";
 $("sqPitch").innerHTML=LINES[o.formation].map(line=>'<div class="sq-line">'+line.map(i=>{const p=r.players[i];return '<div class="sq-player"><small class="sq-pos">'+p.pos+' · '+p.ovr+'</small><img alt="" loading="lazy" src="'+img+'playersAction/p'+p.id+'.png" data-fallback="'+img+'players/p'+p.pid+'.png"><b>'+esc(p.name)+'</b><small>'+esc(p.season)+' '+p.grade+'강</small><small>'+money(p.price)+'</small></div>'}).join("")+"</div>").join("");
 $("sqPitch").querySelectorAll("img").forEach(el=>el.addEventListener("error",()=>{if(el.dataset.fallback){el.src=el.dataset.fallback;delete el.dataset.fallback}else el.hidden=true}));
 $("sqRows").innerHTML=r.players.map((p,i)=>{const isLocked=locks[i]?.id===p.id&&locks[i]?.grade===p.grade;const core=p.core.map(([k,v])=>esc(STATS[k]||k)+" "+v).join(" · ");return "<tr><td><b>"+p.pos+"</b></td><td><b>"+esc(p.name)+"</b><small>"+esc(p.season)+"</small></td><td>"+p.grade+"강</td><td>"+p.ovr+"</td><td>"+p.pay+"</td><td>"+p.price.toLocaleString("ko-KR")+"<small>"+esc(p.at?.slice(0,10)||"수집일 미상")+"</small></td><td>"+(p.weak??"—")+"</td><td>"+(core||"세부 능력치 미수집 · 포지션 OVR 기준")+"</td><td><button type=\"button\" data-lock=\""+i+"\" aria-pressed=\""+isLocked+"\">"+(isLocked?"고정 해제":"고정")+"</button><button type=\"button\" data-swap=\""+i+"\""+(isLocked?" disabled":"")+">교체</button></td></tr>"}).join("");
 lockView();
}
function saved(){
 const r=results[active];if(!r?.ok)return null;
 return {schema:1,opts:currentOpts,mode:active,players:r.players.map(p=>({id:p.id,grade:p.grade,name:p.name,pos:p.pos}))};
}
function restore(s){
 if(s?.schema!==1||!Array.isArray(s.players)||s.players.length!==11)throw Error("스쿼드 저장 형식이 올바르지 않습니다.");
 applyOpts(s.opts);
 if(!s.players.every((p,i)=>Number.isSafeInteger(p.id)&&p.id>0&&Number.isInteger(p.grade)&&p.grade>=1&&p.grade<=13&&p.pos===FORM[s.opts.formation][i]))throw Error("선수 정보가 올바르지 않습니다.");
 locks=Object.fromEntries(s.players.map((p,i)=>[i,{id:p.id,grade:p.grade,name:String(p.name||p.id).slice(0,80)}]));lockView();clearOutput();request(fields(),Object.keys(MODES),locks);
}
$("sqForm").addEventListener("submit",e=>{e.preventDefault();request(fields(),Object.keys(MODES),locks)});
$("sqFormation").addEventListener("change",()=>{locks={};lockView();clearOutput();status("포메이션 변경 · 고정 선수를 초기화했습니다.")});
["sqBudget","sqSalary","sqTeam","sqStyle","sqGrades"].forEach(id=>$(id).addEventListener("change",()=>{clearOutput();status("조건이 변경되었습니다. 다시 추천해 주세요.")}));
$("sqModes").addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(b){active=b.dataset.mode;render()}});
$("sqLocks").addEventListener("click",e=>{const b=e.target.closest("[data-unlock]");if(b){delete locks[b.dataset.unlock];lockView();if(!("hidden" in $("sqOutput"))||!$("sqOutput").hidden)render()}});
$("sqRows").addEventListener("click",e=>{
 const b=e.target.closest("[data-lock],[data-swap]"),r=results[active];if(!b||!r?.ok)return;
 const i=Number(b.dataset.lock??b.dataset.swap),p=r.players[i];if(!p)return;
 if(b.hasAttribute("data-lock")){if(locks[i]?.id===p.id&&locks[i]?.grade===p.grade)delete locks[i];else locks[i]={id:p.id,grade:p.grade,name:p.name};render();return}
 const keep=Object.fromEntries(r.players.flatMap((p,j)=>j===i?[]:[[j,{id:p.id,grade:p.grade}]]));
 request(currentOpts,[active],keep,{[i]:{id:p.id,grade:p.grade}},true);
});
$("sqSave").addEventListener("click",()=>{try{const s=saved();if(!s)return;localStorage.setItem(STORE,JSON.stringify(s));status("이 브라우저에 스쿼드를 저장했습니다.")}catch(e){status("저장 실패: "+e.message,true)}});
$("sqLoad").addEventListener("click",()=>{try{const s=JSON.parse(localStorage.getItem(STORE)||"null");if(!s)throw Error("저장된 스쿼드가 없습니다.");restore(s)}catch(e){status(e.message,true)}});
$("sqShare").addEventListener("click",async()=>{try{const s=saved();if(!s)return;const u=new URL("/squad/",window.FG_SITE_URL||location.origin);u.searchParams.set("s",JSON.stringify(s));if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(u.href);status("공유 주소를 복사했습니다.")}else{window.prompt("공유 주소를 복사하세요.",u.href)}}catch(e){status("공유 실패: "+e.message,true)}});
$("sqImport").addEventListener("click",()=>{try{
 const r=JSON.parse(sessionStorage.getItem(RECENT)||"null");if(!r?.players?.length)throw Error("같은 탭에서 전적 진단을 완료한 뒤 이용해 주세요.");
 const used=new Set(),pos=FORM[$("sqFormation").value],next={};
 for(let i=0;i<pos.length;i++){const p=r.players.find(x=>x.pos===pos[i]&&!used.has(x.id%1000000)&&!x.review&&Number.isSafeInteger(x.id)&&Number.isInteger(x.grade)&&x.grade>=1&&x.grade<=13);if(p){used.add(p.id%1000000);next[i]={id:p.id,grade:p.grade,name:p.name}}}
 if(!Object.keys(next).length)throw Error("선택한 포메이션과 일치하는 유지 후보가 없습니다.");
 locks=next;lockView();clearOutput();status("최근 출전 선수 "+Object.keys(next).length+"명 고정 · 교체 검토 선수는 제외했습니다. 총 구단 예산 및 급여를 입력하고 추천하세요.")
 }catch(e){status(e.message,true)}});
busy(true);
fetch("/assets/squad-data/manifest.json?v="+encodeURIComponent(ver)).then(r=>{if(!r.ok)throw Error("선수 목록을 불러오지 못했습니다.");return r.json()}).then(m=>{
 if(m.schema!==1||!Object.values(m.positions||{}).some(n=>n>0))throw Error("실제 선수 수집 데이터가 아직 없습니다.");
 manifest=m;
 $("sqTeam").innerHTML='<option value="0">소속 제한 없음</option>'+m.teams.filter(t=>t.cards>=11).map(t=>'<option value="'+t.id+'">'+esc(t.name)+" ("+(t.kind==="nation"?"국가":"클럽")+")</option>").join("");
 busy(false);status("시세 수집 기준 "+(m.dateFrom||"미상")+" ~ "+(m.dateTo||"미상")+" · 조건을 선택해 주세요.");
 const shared=new URLSearchParams(location.search).get("s");if(shared&&shared.length<20000){try{restore(JSON.parse(shared))}catch(e){status(e.message,true)}}
}).catch(e=>{busy(false);status(e.message,true)});
})();