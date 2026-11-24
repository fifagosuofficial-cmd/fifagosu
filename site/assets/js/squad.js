(function(){
"use strict";
const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ver=new URL(document.currentScript.src).searchParams.get("v")||"";
const E=window.FGSquad,B=window.FGSquadBonus,FORM=E.FORMATIONS,LINES=E.LINES;
$("sqFormation").innerHTML=Object.entries(E.LABELS).map(([k,v])=>'<option value="'+k+'">'+v+(k==="4231"?" · LM/RM":k==="4231-2"?" · CAM 3명":"")+'</option>').join("");
$("sqFormation").value="4231";$("sqFormationCount").textContent=Object.keys(FORM).length+"가지 포메이션";
const MODES={performance:"성능 최우선",balanced:"밸런스형",value:"가성비형"};
const HINT={balanced:"포지션별 필수 능력치와 BP·급여 균형.",speed:"윙어·ST는 속력·가속력·침투, 풀백은 속력·스태미너.",pass:"중원은 패스·시야·볼 컨트롤·침착성, 공격진은 연계와 약발.",longshot:"ST·CAM·CM·윙어의 중거리 슛·슛 파워·커브·관련 특성.",cross:"윙어·풀백의 크로스·커브, ST의 키·헤더·점프·위치 선정.",press:"전방·중원의 스태미너·적극성·가속력과 수비 전환.",counter:"전방의 속력·침투, 중원의 긴 패스, 수비진의 가로채기.",defense:"CB·CDM의 수비 능력·피지컬, 풀백의 기동력, GK 반응 속도."};
const hint=()=>{$("sqStyleHint").textContent=HINT[$("sqStyle").value]||""};
const STATS={sprintspeed:"속력",acceleration:"가속력",finishing:"골 결정력",shotpower:"슛 파워",longshots:"중거리 슛",positioning:"위치 선정",shortpassing:"짧은 패스",vision:"시야",crossing:"크로스",longpassing:"긴 패스",dribbling:"드리블",ballcontrol:"볼 컨트롤",agility:"민첩성",balance:"밸런스",reactions:"반응 속도",marking:"대인 수비",standingtackle:"태클",interceptions:"가로채기",heading:"헤더",strength:"몸싸움",stamina:"스태미너",gkdiving:"GK 다이빙",gkhandling:"GK 핸들링",gkreflexes:"GK 반응속도",gkpositioning:"GK 위치 선정",jumping:"점프",curve:"커브",aggression:"적극성",composure:"침착성",slidingtackle:"슬라이딩 태클",gkkicking:"GK 킥",volleys:"발리슛",penalties:"페널티 킥",freekick:"프리킥"};
const img="https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/";
const STORE="fg-squad-v1", RECENT="fg-squad-recent-v1";
let worker=null,requestId=0,task=null,manifest=null,results={},active="balanced",locks={},currentOpts=null,pickerSlot=null,pickerCandidates=[],recoCandidates=[],pickerSeq=0,slotBusy=false;
const catalogCache=new Map();
let bonusRules=null,bonusState="loading",relationBusy=false;
const relationCache=Object.create(null),relationFailed=new Set();
const flags=()=>({adapt:$("sqAdapt").checked,team:$("sqTC").checked});
function refreshBonusView(){if(!task&&!slotBusy&&!$("sqOutput").hidden&&results[active]?.ok)render()}
async function loadRelations(){
 if(relationBusy||!flags().team||!bonusRules)return;
 const r=results[active];if(!r?.ok)return;
 const ids=[...new Set(r.players.filter(Boolean).map(p=>p.id))].filter(id=>!Object.hasOwn(relationCache,id)&&!relationFailed.has(id));
 if(!ids.length)return;
 relationBusy=true;
 $("sqBonusNote").textContent+=" · 공식 자격 조회 중";
 const work=async()=>{while(ids.length){if(!flags().team)return;const id=ids.shift();try{
   const response=await fetch("/api/player-teamcolors?spid="+encodeURIComponent(id),{signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error("조회 실패");
   const j=await response.json();if(+j.spid!==id||!Array.isArray(j.items))throw Error("응답 형식 오류");
   relationCache[id]=j.items.filter(x=>Number.isInteger(+x.id)&&+x.id>0);
 }catch(e){relationFailed.add(id)}}};
 try{await Promise.all(Array.from({length:Math.min(3,ids.length)},work))}finally{relationBusy=false;refreshBonusView()}
}
const bonusLabel=k=>k==="all"?"전체 능력치":STATS[k]||k;
const effectsText=stats=>Object.entries(stats||{}).map(([k,v])=>bonusLabel(k)+" +"+v).join(" · ");
function showBonuses(r,projection){
 const f=flags(),names={club:"소속",feature:"관계·특성",grade:"강화"};
 $("sqColorList").innerHTML=(f.adapt&&projection.adapt?'<div class="sq-color"><b>적응도 5단계</b><span>전체 능력치 +'+projection.adapt+'</span></div>':"")+
 (f.team?projection.applied.map(t=>'<div class="sq-color"><small>'+names[t.kind]+'</small><b>'+esc(t.name)+' · '+t.level+'단계</b><span>'+t.count+'명 충족 / '+t.need+'명 필요 · '+t.applied+'명 적용</span><span>'+esc(effectsText(t.stats))+'</span></div>').join(""):"")||'<span class="sq-note">표시할 보너스 없음</span>';
 const notes=[];
 if(bonusState!=="ready")notes.push(bonusState==="loading"?"보너스 규칙 조회 중":"보너스 규칙 데이터 조회 실패");
 if(f.adapt&&!projection.adapt)notes.push("적응도 공식 규칙 미확인");
 if(f.team){
   notes.push("공식 수집 단계만 계산 · 소속 후보 및 선발 인원 기준 · 게임 내 해금 여부 별도");
   notes.push("관계·특성 자격 확인 "+projection.checked+"/"+projection.total+"명"+(relationBusy?" · 조회 중":""));
   if(projection.checked<projection.total)notes.push("미확인 선수의 관계·특성 효과는 제외");
 }
 notes.push("OVR은 전체 능력치 증가분만 합산; 개별 보너스는 상세 스탯에 반영");
 $("sqBonusNote").textContent=notes.join(" / ");
 $("sqBonusRetry").hidden=!f.team||!r.players.some(p=>p&&relationFailed.has(p.id));
}
function showStatMatrix(r,projection){
 const ps=r.players,keys=manifest.stats||[];
 $("sqStatMatrix").innerHTML="<thead><tr><th>능력치</th>"+ps.map(p=>"<th>"+(p?esc(p.pos+" "+p.name)+"<small>"+esc(p.season)+" "+p.grade+"강</small>":"—")+"</th>").join("")+"</tr></thead><tbody>"+keys.map((k,j)=>"<tr><th>"+esc(STATS[k]||k)+"</th>"+ps.map((p,i)=>{
   if(!p)return "<td>—</td>";
   const v=B.statValue(p.stats?.[j],k,E.BONUS[p.grade],projection.per[i]),base=B.statValue(p.stats?.[j],k,E.BONUS[p.grade],null);
   return v==null?"<td>—</td>":"<td>"+v+(v>base?'<small class="sq-stat-plus">+'+(v-base)+'</small>':"")+"</td>";
 }).join("")+"</tr>").join("")+"</tbody>";
}
$("sqAdapt").addEventListener("change",refreshBonusView);
$("sqTC").addEventListener("change",refreshBonusView);
$("sqBonusRetry").addEventListener("click",()=>{for(const p of results[active]?.players||[])if(p)relationFailed.delete(p.id);refreshBonusView()});
fetch("/assets/squad-data/bonuses.json?v="+encodeURIComponent(ver)).then(r=>{if(!r.ok)throw Error("규칙 조회 실패");return r.json()}).then(j=>{if(!Array.isArray(j.teams))throw Error("규칙 형식 오류");bonusRules=j;bonusState="ready";refreshBonusView()}).catch(()=>{bonusState="failed";refreshBonusView()});

const status=(s,bad=false)=>{$("sqStatus").textContent=s;$("sqStatus").classList.toggle("sq-error",bad)};
const money=n=>{const p=[];for(const [u,k] of [[1e12,"조"],[1e8,"억"],[1e4,"만"]]){const v=Math.floor(n/u);if(v)p.push(v.toLocaleString("ko-KR")+k);n%=u}if(n||!p.length)p.push(n.toLocaleString("ko-KR"));return p.slice(0,2).join(" ")+" BP"};
function fields(){
 const preset=$("sqGrades").value;
 const grades=preset==="custom"?E.gradeRange(Number($("sqGradeMin").value),Number($("sqGradeMax").value)):E.gradeRange(({silver:5,gold:8,platinum:11})[preset],13);
 const teamName=$("sqTeam").value.trim(),team=!teamName||teamName==="소속 제한 없음"?0:selectedTeam?.name===teamName?selectedTeam.id:manifest?.teams.find(t=>t.name===teamName)?.id;
 return {budget:Math.round(Number($("sqBudget").value)*Number($("sqUnit").value)),salary:Number($("sqSalary").value),team:team??-1,formation:$("sqFormation").value,style:$("sqStyle").value,grades}
}
function busy(on){document.querySelectorAll("#squad button,#squad input,#squad select").forEach(el=>el.disabled=on);if(!on&&!manifest)$("sqRun").disabled=true}
function clearOutput(){results={};currentOpts=null;closePicker();$("sqOutput").hidden=true}
function lockView(){
 const pos=FORM[$("sqFormation").value]||[];
 $("sqLocks").innerHTML=Object.entries(locks).map(([i,p])=>'<button type="button" data-unlock="'+esc(i)+'">'+esc(pos[i])+" · "+esc(p.name||p.id)+" "+esc(p.grade)+"강 ×</button>").join("");
}
function validOpts(o){return o&&Number.isSafeInteger(o.budget)&&o.budget>0&&o.budget<=9e15&&Number.isInteger(o.salary)&&o.salary>=11&&o.salary<=315&&FORM[o.formation]&&Object.hasOwn(HINT,o.style)&&Array.isArray(o.grades)&&o.grades.length&&o.grades.every(g=>Number.isInteger(g)&&g>=1&&g<=13)&&(!o.team||manifest.teams.some(t=>t.id===o.team))}
function applyOpts(o){
 if(!validOpts(o))throw Error("저장된 설정이 현재 데이터와 맞지 않습니다.");
 const unit=o.budget>=1e12?1e12:o.budget>=1e8?1e8:o.budget>=1e4?1e4:1;$("sqUnit").value=String(unit);$("sqBudget").value=String(o.budget/unit);$("sqSalary").value=String(o.salary);selectedTeam=o.team?manifest.teams.find(t=>t.id===o.team)||null:null;$("sqTeam").value=selectedTeam?.name||"";$("sqFormation").value=o.formation;$("sqStyle").value=o.style;hint();
 const min=Math.min(...o.grades),max=Math.max(...o.grades);$("sqGrades").value=max===13&&[5,8,11].includes(min)&&o.grades.length===14-min?({5:"silver",8:"gold",11:"platinum"})[min]:"custom";$("sqGradeMin").value=String(min);$("sqGradeMax").value=String(max);gradeHint();
}
function request(opts,modes,ls,bs={},replace=false){
 closeTeamList();
 if(!manifest||!validOpts(opts)){status("입력 조건을 확인해 주세요.",true);return}
 if(task||slotBusy)return;closePicker();
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
 if(!r?.ok){$("sqSummary").textContent=r?.reason||"추천 결과 없음";$("sqPitch").innerHTML="";$("sqStatMatrix").innerHTML="";$("sqColorList").innerHTML="";$("sqBonusNote").textContent="";$("sqSave").disabled=$("sqShare").disabled=$("sqBoardShare").disabled=$("sqCloudSave").disabled=true;return}
 $("sqSave").disabled=$("sqShare").disabled=false;
 const o=currentOpts, filled=r.players.filter(Boolean),complete=filled.length===11;
 const projection=B.project(r.players,bonusRules,relationCache,o.team,flags());
 const avg=filled.length?projection.per.filter(Boolean).reduce((s,p)=>s+p.ovr,0)/filled.length:0;
 showBonuses(r,projection);showStatMatrix(r,projection);
 $("sqSave").disabled=$("sqShare").disabled=$("sqBoardShare").disabled=$("sqCloudSave").disabled=!complete;
 $("sqSummary").innerHTML="<div><span>선수 구매가 합계</span><b>"+money(r.price)+"</b><small>잔여 "+money(o.budget-r.price)+"</small></div><div><span>급여 합계</span><b>"+r.pay+" / "+o.salary+"</b><small>"+(r.pay===o.salary?"급여 상한 달성":"잔여 "+(o.salary-r.pay))+"</small></div><div><span>평균 포지션 OVR</span><b>"+(filled.length?avg.toFixed(1):"—")+"</b><small>"+filled.length+" / 11명 · 선택 보너스 반영</small></div>";
 const swapIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h15l-4-4m4 4-4 4M20 17H5l4-4m-4 4 4 4"/></svg>';
 const lockIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg>';
 const trashIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg>';
 $("sqPitch").innerHTML=LINES[o.formation].map(line=>'<div class="sq-line">'+line.map(i=>{
   const p=r.players[i],pos=FORM[o.formation][i];
   if(!p)return '<div class="sq-player sq-empty"><small class="sq-pos">'+pos+'</small><button type="button" data-add="'+i+'" aria-label="'+pos+' 선수 검색">＋<small>선수 검색</small></button></div>';
   const locked=locks[i]?.id===p.id&&locks[i]?.grade===p.grade;
   const gradeSelect='<select class="sq-player-grade" data-grade-slot="'+i+'" aria-label="'+esc(p.name)+' 강화 단계">'+Array.from({length:13},(_,j)=>{const g=j+1,price=p.prices?.[j];return '<option value="'+g+'"'+(g===p.grade?' selected':'')+(!Number.isSafeInteger(price)||price<=0?' disabled':'')+'>'+g+'강'+(!Number.isSafeInteger(price)||price<=0?' (시세 없음)':'')+'</option>'}).join("")+'</select>';
   return '<div class="sq-player"><div class="sq-card-top"><small class="sq-pos">'+p.pos+' · '+projection.per[i].ovr+'</small><span class="sq-pay" title="급여">'+p.pay+'</span></div><div class="sq-face"><img alt="" loading="lazy" src="'+img+'playersAction/p'+p.id+'.png" data-fallback="'+img+'players/p'+p.pid+'.png"><div class="sq-card-tools"><button type="button" data-swap="'+i+'" title="대체 선수로 교체" aria-label="'+esc(p.name)+' 교체"'+(locked?' disabled':'')+'>'+swapIcon+'</button><button type="button" data-remove="'+i+'" title="선수 삭제" aria-label="'+esc(p.name)+' 삭제">'+trashIcon+'</button></div></div><b>'+esc(p.name)+'</b><small>'+esc(p.season)+'</small>'+gradeSelect+'<small>'+money(p.price)+'</small><button type="button" class="sq-card-lock" data-lock="'+i+'" aria-pressed="'+locked+'" aria-label="'+esc(p.name)+(locked?' 고정 해제':' 고정')+'">'+lockIcon+(locked?'고정됨':'고정')+'</button></div>';
 }).join("")+"</div>").join("");
 $("sqPitch").querySelectorAll("img").forEach(el=>el.addEventListener("error",()=>{if(el.dataset.fallback){el.src=el.dataset.fallback;delete el.dataset.fallback}else el.hidden=true}));

 lockView();
 if(flags().team)void loadRelations();
}
function saved(){
 const r=results[active];if(!r?.ok||r.players.some(p=>!p))return null;
 return {schema:1,opts:currentOpts,mode:active,players:r.players.map(p=>({id:p.id,grade:p.grade,name:p.name,pos:p.pos}))};
}
function restore(s){
 if(s?.schema!==1||!Array.isArray(s.players)||s.players.length!==11)throw Error("스쿼드 저장 형식이 올바르지 않습니다.");
 applyOpts(s.opts);
 if(!s.players.every((p,i)=>Number.isSafeInteger(p.id)&&p.id>0&&Number.isInteger(p.grade)&&p.grade>=1&&p.grade<=13&&p.pos===FORM[s.opts.formation][i]))throw Error("선수 정보가 올바르지 않습니다.");
 locks=Object.fromEntries(s.players.map((p,i)=>[i,{id:p.id,grade:p.grade,name:String(p.name||p.id).slice(0,80),manual:true}]));lockView();clearOutput();request(fields(),Object.keys(MODES),locks);
}
$("sqForm").addEventListener("submit",e=>{e.preventDefault();request(fields(),Object.keys(MODES),locks)});
$("sqFormation").addEventListener("change",()=>{locks={};lockView();clearOutput();status("포메이션 변경 · 고정 선수를 초기화했습니다.")});
["sqBudget","sqUnit","sqSalary","sqStyle","sqGrades","sqGradeMin","sqGradeMax"].forEach(id=>$(id).addEventListener("change",()=>{hint();gradeHint();clearOutput();status("조건이 변경되었습니다. 다시 추천해 주세요.")}));
$("sqModes").addEventListener("click",e=>{const b=e.target.closest("[data-mode]");if(b&&!slotBusy){closePicker();active=b.dataset.mode;render()}});
$("sqLocks").addEventListener("click",e=>{const b=e.target.closest("[data-unlock]");if(b){delete locks[b.dataset.unlock];lockView();if(!$("sqOutput").hidden)render()}});
const teamInput=$("sqTeam"),teamList=$("sqTeamList"),teamToggle=$("sqTeamToggle");
let selectedTeam=null,teamOptions=[],teamCursor=-1;
const teamNorm=s=>String(s||"").toLowerCase().replace(/\s+/g,"");
function closeTeamList(){teamList.hidden=true;teamInput.setAttribute("aria-expanded","false");teamInput.removeAttribute("aria-activedescendant");teamCursor=-1}
function showTeamList(all=false){
 if(!manifest||teamInput.disabled)return;
 const q=all?"":teamNorm(teamInput.value);
 const ts=manifest.teams.filter(t=>t.cards>=11);
 teamOptions=[{id:0,name:"소속 제한 없음",kind:"all"},...ts].filter(t=>!q||teamNorm(t.name).includes(q)).slice(0,120);
 teamCursor=-1;teamInput.removeAttribute("aria-activedescendant");
 teamList.innerHTML=teamOptions.length?teamOptions.map((t,i)=>'<button type="button" role="option" id="sqTeamOpt'+i+'" data-team-index="'+i+'" aria-selected="'+(t.id===(selectedTeam?.id||0))+'"><span>'+esc(t.name)+'</span><small>'+(t.kind==="nation"?"국가":t.kind==="club"?"클럽":"전체")+'</small></button>').join(""):'<p class="sq-note">검색 결과가 없습니다.</p>';
 teamList.hidden=false;teamInput.setAttribute("aria-expanded","true");
}
function chooseTeam(t){
 if(!t)return;
 const old=selectedTeam?.id||0;selectedTeam=t.id?t:null;teamInput.value=t.id?t.name:"";closeTeamList();
 if(old!==t.id||currentOpts&&currentOpts.team!==t.id){locks={};lockView();clearOutput();status("팀컬러가 변경되었습니다. 다시 추천해 주세요.")}
}
teamInput.addEventListener("focus",()=>{teamInput.select();showTeamList(true)});
teamInput.addEventListener("click",()=>{if(teamList.hidden)showTeamList(true)});
teamInput.addEventListener("input",()=>showTeamList());
teamInput.addEventListener("keydown",e=>{
 if(e.key==="Escape"){closeTeamList();return}
 if(e.key==="ArrowDown"||e.key==="ArrowUp"){
   e.preventDefault();if(teamList.hidden)showTeamList(true);
   if(!teamOptions.length)return;
   teamCursor=teamCursor<0?(e.key==="ArrowDown"?0:teamOptions.length-1):(teamCursor+(e.key==="ArrowDown"?1:-1)+teamOptions.length)%teamOptions.length;
   teamList.querySelectorAll("[role=option]").forEach((x,i)=>x.classList.toggle("sq-team-active",i===teamCursor));
   const el=$("sqTeamOpt"+teamCursor);teamInput.setAttribute("aria-activedescendant",el.id);el.scrollIntoView({block:"nearest"});return;
 }
 if(e.key==="Enter"&&!teamList.hidden){e.preventDefault();if(teamCursor>=0)chooseTeam(teamOptions[teamCursor]);else if(teamOptions.length===1)chooseTeam(teamOptions[0])}
});
teamList.addEventListener("pointerdown",e=>{if(e.target.closest("[data-team-index]"))e.preventDefault()});
teamList.addEventListener("click",e=>{const b=e.target.closest("[data-team-index]");if(b)chooseTeam(teamOptions[Number(b.dataset.teamIndex)])});
teamToggle.addEventListener("click",()=>{if(!teamList.hidden){closeTeamList();return}teamInput.focus();showTeamList(true)});
document.addEventListener("pointerdown",e=>{if(!e.target.closest(".sq-team-wrap"))closeTeamList()});
teamInput.addEventListener("blur",e=>{if(!e.relatedTarget?.closest(".sq-team-wrap"))closeTeamList()});
function gradeHint(){
 $("sqGradeRange").hidden=$("sqGrades").value!=="custom";
}
let pickerSession=0,pickerReturn=null,typing=null;
function resetPicker(){pickerSlot=null;pickerCandidates=[];recoCandidates=[];pickerSeq++;pickerSession++;clearTimeout(typing)}
function closePicker(){
 const dialog=$("sqPicker"),back=pickerReturn;pickerReturn=null;resetPicker();
 if(dialog.open){dialog.close();if(back&&document.contains(back))back.focus({preventScroll:true})}
}
function loadPosition(pos){
 if(!catalogCache.has(pos))catalogCache.set(pos,fetch("/assets/squad-data/"+encodeURIComponent(pos)+".json?v="+encodeURIComponent(ver)).then(r=>{if(!r.ok)throw Error("포지션 선수 데이터를 불러오지 못했습니다.");return r.json()}).catch(e=>{catalogCache.delete(pos);throw e}));
 return catalogCache.get(pos);
}
function applyPlayer(i,c,lock=false){
 const r=results[active];if(!r?.ok)return false;
 const players=r.players.slice();players[i]=c;
 const filled=players.filter(Boolean),price=filled.reduce((n,p)=>n+p.price,0),pay=filled.reduce((n,p)=>n+p.pay,0);
 if(!Number.isSafeInteger(price)||price>currentOpts.budget||pay>currentOpts.salary||new Set(filled.map(p=>p.pid)).size!==filled.length||filled.some(p=>!Number.isInteger(p.grade)||p.grade<1||p.grade>13||!Number.isSafeInteger(p.price)||p.price<=0||!Number.isSafeInteger(p.pay)||p.pay<=0||(currentOpts.team&&!p.teams.includes(currentOpts.team))))return false;
 if(c&&lock)locks[i]={id:c.id,grade:c.grade,name:c.name,manual:true};else delete locks[i];
 results[active]={...r,players,price,pay};
 closePicker();render();return true;
}
function pickerRows(list,attr){
 return list.map((p,j)=>'<tr><td><div class="sq-search-player"><img loading="lazy" alt="" src="'+img+'playersAction/p'+p.id+'.png"><div><b>'+esc(p.name)+'</b><small>'+esc(p.season)+'</small>'+(p.weakAlternative?'<small class="sq-weaker">상대적으로 낮은 OVR</small>':'')+'</div></div></td><td>'+p.grade+'강</td><td>'+p.ovr+'</td><td>'+p.pay+'</td><td>'+money(p.price)+'</td><td><button type="button" '+attr+'="'+j+'">선택</button></td></tr>').join("");
}
async function showPicker(i,trigger){
 closePicker();const r=results[active],opts=currentOpts;if(!r?.ok||!opts)return;
 pickerSlot=i;pickerReturn=trigger||null;const old=r.players[i],session=++pickerSession;
 $("sqPickerTitle").textContent=FORM[opts.formation][i]+(old?" · "+old.name+" 교체":" · 선수 추가");
 $("sqPickerBudget").textContent="사용 가능 "+money(opts.budget-r.price+(old?.price||0))+" · 급여 "+(opts.salary-r.pay+(old?.pay||0))+" · 다른 선수 유지";
 $("sqPlayerQuery").value="";$("sqPlayerResults").innerHTML="";$("sqPickerNote").textContent="선수명 또는 시즌을 입력해 검색하세요.";
 $("sqRecoResults").innerHTML="";$("sqRecoNote").textContent="AI 추천 후보를 찾는 중입니다…";
 $("sqPicker").showModal();$("sqPickerClose").focus();
 try{
   const rows=await loadPosition(FORM[opts.formation][i]);if(session!==pickerSession)return;
   recoCandidates=E.alternatives(rows,manifest,opts,active,r.players,i,"",true);
   $("sqRecoResults").innerHTML=pickerRows(recoCandidates,"data-reco");
   $("sqRecoNote").textContent=recoCandidates.length>=5?"조건에 맞는 추천 선수 "+recoCandidates.length+"명 · 강화 적용 OVR 기준":recoCandidates.length?"조건에 맞는 서로 다른 선수 "+recoCandidates.length+"명만 확인됩니다. 나머지 선수는 유지됩니다.":"현재 조건을 만족하는 대체 선수가 없습니다. 직접 검색하거나 조건을 조정해 주세요.";
 }catch(e){if(session===pickerSession)$("sqRecoNote").textContent=e.message}
}
async function searchPicker(){
 const i=pickerSlot,r=results[active],opts=currentOpts;if(i===null||!r?.ok)return;
 const seq=++pickerSeq,query=$("sqPlayerQuery").value.trim();
 $("sqPlayerResults").innerHTML="";pickerCandidates=[];
 if(!query){$("sqPickerNote").textContent="선수명 또는 시즌을 입력해 검색하세요.";return}
 $("sqPickerNote").textContent="조건에 맞는 선수를 검색 중입니다…";
 try{
   const rows=await loadPosition(FORM[opts.formation][i]);if(seq!==pickerSeq)return;
   pickerCandidates=E.manualSearch(rows,manifest,opts,active,r.players,i,query);
   $("sqPlayerResults").innerHTML=pickerCandidates.map((p,j)=>'<button type="button" class="sq-manual-card" data-pick="'+j+'"><img loading="lazy" alt="" src="'+img+'playersAction/p'+p.id+'.png"><span><b>'+esc(p.name)+'</b><small>'+esc(p.season)+'</small></span><span class="sq-manual-pay">급여 '+p.pay+'</span></button>').join("");
   $("sqPickerNote").textContent=pickerCandidates.length?"시즌별 카드 "+pickerCandidates.length+"개 · 선택하면 1강으로 추가됩니다.":"1강 시세와 남은 예산·급여·팀컬러·포지션 조건을 충족하는 카드가 없습니다.";
 }catch(e){if(seq===pickerSeq)$("sqPickerNote").textContent=e.message}
}
function onRosterClick(e){
 const b=e.target.closest("[data-lock],[data-swap],[data-remove],[data-add]"),r=results[active];if(!b||!r?.ok||task||slotBusy)return;
 const i=Number(b.dataset.lock??b.dataset.swap??b.dataset.remove??b.dataset.add),p=r.players[i];if(!Number.isInteger(i)||i<0||i>10)return;
 if(b.hasAttribute("data-add")){showPicker(i,b);return}
 if(!p)return;
 if(b.hasAttribute("data-lock")){if(locks[i]?.id===p.id&&locks[i]?.grade===p.grade)delete locks[i];else locks[i]={id:p.id,grade:p.grade,name:p.name,manual:true};render();return}
 if(b.hasAttribute("data-remove")){if(applyPlayer(i,null)){status(p.name+" 삭제 · 빈 포지션에 직접 선수를 넣어 주세요.");showPicker(i,$("sqPitch").querySelector('[data-add="'+i+'"]'))}return}
 if(locks[i]?.id===p.id&&locks[i]?.grade===p.grade)return;
 showPicker(i,b);
}
$("sqPitch").addEventListener("click",onRosterClick);
$("sqPitch").addEventListener("change",e=>{
 const el=e.target.closest("[data-grade-slot]"),r=results[active];if(!el||!r?.ok||task||slotBusy)return;
 const i=Number(el.dataset.gradeSlot),p=r.players[i],grade=Number(el.value);if(!p)return;
 const c=E.changeGrade(p,grade),locked=locks[i]?.id===p.id&&locks[i]?.grade===p.grade;
 if(!c){el.value=String(p.grade);status("해당 강화 단계의 실제 시세를 확인할 수 없습니다.",true);return}
 if(!applyPlayer(i,c,locked)){el.value=String(p.grade);status("예산 또는 급여 한도를 초과해 강화 단계를 변경할 수 없습니다.",true);return}
 status(p.name+" "+p.grade+"강 → "+grade+"강 변경 완료");
 $("sqPitch").querySelector('[data-grade-slot="'+i+'"]')?.focus({preventScroll:true});
});
$("sqPickerClose").addEventListener("click",closePicker);
$("sqPicker").addEventListener("cancel",e=>{e.preventDefault();closePicker()});
$("sqPicker").addEventListener("click",e=>{if(e.target===$("sqPicker"))closePicker()});
$("sqPlayerQuery").addEventListener("input",()=>{pickerSeq++;pickerCandidates=[];$("sqPlayerResults").innerHTML="";clearTimeout(typing);typing=setTimeout(searchPicker,180)});
function pickPlayer(e,attr,list){
 const b=e.target.closest("["+attr+"]");if(!b||pickerSlot===null)return;
 const i=pickerSlot,c=list[Number(b.getAttribute(attr))],old=results[active]?.players[i];
 if(c&&applyPlayer(i,c,false)){
   status((old?old.name+" → ":"")+c.name+" "+c.grade+"강 선택 완료 · 선수 카드에서 강화 변경 가능");
   $("sqPitch").querySelector('[data-grade-slot="'+i+'"]')?.focus({preventScroll:true});
 }else $("sqPickerNote").textContent="선수 추가 조건을 확인해 주세요.";
}
$("sqPlayerResults").addEventListener("click",e=>pickPlayer(e,"data-pick",pickerCandidates));
$("sqRecoResults").addEventListener("click",e=>pickPlayer(e,"data-reco",recoCandidates));
$("sqBoardShare").addEventListener("click",()=>{const s=saved();if(!s)return;try{localStorage.setItem("fg-squad-v1",JSON.stringify(s));location.assign("/board/?category=squad&compose=1")}catch(e){status(e.message,true)}});
$("sqCloudSave").addEventListener("click",async()=>{const s=saved();if(!s)return;try{const name=prompt("스쿼드 이름");if(!name)return;const r=await fetch("/api/community/squad",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,squad:s})});const j=await r.json();if(!r.ok)throw Error(j.message);status("내 스쿼드에 저장했습니다.")}catch(e){status("온라인 저장 실패: "+e.message,true)}});
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
hint();gradeHint();busy(true);
fetch("/assets/squad-data/manifest.json?v="+encodeURIComponent(ver)).then(r=>{if(!r.ok)throw Error("선수 목록을 불러오지 못했습니다.");return r.json()}).then(m=>{
 if(m.schema!==2||!Object.values(m.positions||{}).some(n=>n>0))throw Error("실제 선수 수집 데이터가 아직 없습니다.");
 manifest=m;
 closeTeamList();
 busy(false);status("시세 수집 기준 "+(m.dateFrom||"미상")+" ~ "+(m.dateTo||"미상")+" · 조건을 선택해 주세요.");
 const params=new URLSearchParams(location.search);if(params.get("import")==="1")$("sqImport").click();const shared=params.get("s");if(shared&&shared.length<20000){try{restore(JSON.parse(shared))}catch(e){status(e.message,true)}}
}).catch(e=>{busy(false);status(e.message,true)});
})();