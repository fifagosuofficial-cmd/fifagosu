/* 피파고수 시뮬 — 강화 효율(인생강화 TOP·회수율 TOP) · 강화 시뮬(게이지 칸·손익) · 팩 오픈(패키지 구성품 포함) · 현질 효율
   app.js 다음에 실행돼서 CARDS·cardData·bigImg·bigBadge·sch·fcCls·STAT_LABELS·GRADE_BONUS·GRADE_SUCCESS·loadIdx·IDX 등을 같이 써요. */
(function(){
const $=id=>document.getElementById(id);
if(!$('v-sim'))return;
const H=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const won=v=>{v=Math.round(+v||0);if(!v)return '0';const neg=v<0;v=Math.abs(v);const jo=Math.floor(v/1e12),eok=Math.floor(v%1e12/1e8),man=Math.floor(v%1e8/1e4);const p=[];if(jo)p.push(jo.toLocaleString()+'조');if(eok)p.push(eok.toLocaleString()+'억');if(man&&!jo)p.push(man.toLocaleString()+'만');return (neg?'−':'')+(p.join(' ')||v.toLocaleString())};
const sgn=v=>(v>0?'+':v<0?'':'')+won(v);
const SUCC=GRADE_SUCCESS, MAX=13, ADAPT=4;
const tier=g=>g>=11?'백금카':g>=8?'금카':g>=5?'은카':'동카', gcls=g=>g>=11?'plat':g>=8?'gold':g>=5?'silver':'bronze';
const gchip=g=>`<span class="gchip g-${gcls(g)}">${g}</span>`;

/* ================= 판매 조건 (모든 탭 공통) ================= */
const feeRate=()=>40*Math.max(0,1-(($('smfTop').checked?20:0)+($('smfPc').checked?30:0)+(+$('smfCoupon').value||0))/100)/100;
const onFee=[];
function feeChanged(){$('smfRate').textContent=(feeRate()*100).toFixed(feeRate()*100%1?1:0)+'%';onFee.forEach(f=>{try{f()}catch(e){}})}
['smfTop','smfPc','smfCoupon'].forEach(id=>$(id).addEventListener('change',feeChanged));

/* ================= 공용 데이터: 시세 풀 · 재료비 추정 ================= */
let POOL=null, poolP=null;
function loadPool(){if(!poolP)poolP=fetch(DATA_BASE+'/market/pool.json').then(r=>r.ok?r.json():null).then(j=>{POOL=j&&j.items&&j.items.length?j.items:null;return POOL}).catch(()=>null);return poolP}
/* ================= 탭 ================= */
const tabs=document.querySelector('.sim-tabs');
const PANELS={eff:'simEff',enh:'simEnh',pack:'simPack',cash:'simCash'};
function setTab(t){
  tabs.querySelectorAll('[data-sim]').forEach(x=>x.setAttribute('aria-selected',x.dataset.sim===t));
  Object.entries(PANELS).forEach(([k,id])=>$(id).hidden=k!==t);
  document.dispatchEvent(new CustomEvent("fg:ad-layout"));
  if(t==='eff')effInit();if(t==='pack')loadShelf();if(t==='cash')cashRun();
  try{history.replaceState(history.state,'',location.pathname+location.search+(t==='eff'?'':'#'+t))}catch(e){}
}
tabs.addEventListener('click',e=>{const b=e.target.closest('[data-sim]');if(b)setTab(b.dataset.sim)});

/* ================= 강화 효율 ================= */
let effMode='win', effStep=0, effReady=false,effInitP=null,effBudget=Infinity;
$('effSteps').innerHTML=`<button type="button" data-s="0" aria-pressed="true">전체</button>`+Array.from({length:12},(_,i)=>`<button type="button" data-s="${i+1}" aria-pressed="false">${i+1}→${i+2}</button>`).join('');
$('effSteps').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(!b)return;effStep=+b.dataset.s;$('effSteps').querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));effRender()});
document.querySelector('.eff-mode').addEventListener('click',e=>{const b=e.target.closest('[data-em]');if(!b)return;effMode=b.dataset.em;document.querySelectorAll('.eff-mode [data-em]').forEach(x=>x.setAttribute('aria-selected',x===b));effRender()});
['effMat','effFail'].forEach(id=>$(id).addEventListener('change',effRender));
function applyEffBudget(){
  const input=$('effMoney'),budget=parseEffBudget(input.value);
  if(budget===null){input.setAttribute('aria-invalid','true');$('effBudgetHint').textContent='0보다 큰 예산을 억 BP 단위로 입력해 주세요.';return}
  input.removeAttribute('aria-invalid');effBudget=budget;
  $('effQuick').querySelectorAll('[data-b]').forEach(b=>b.setAttribute('aria-pressed',parseEffBudget(b.dataset.b)===budget));
  updateEffBudgetHint();effRender();
}
function updateEffBudgetHint(){$('effBudgetHint').textContent=Number.isFinite(effBudget)?won(effBudget)+' BP 이하 · '+($('effMat').checked?'선수 구매비 + 재료비':'선수 구매비')+' 기준':'예산 제한 없음'}
$('effBudgetForm').addEventListener('submit',e=>{e.preventDefault();applyEffBudget()});
$('effQuick').addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(!b)return;$('effMoney').value=b.dataset.b;applyEffBudget()});
$('effMat').addEventListener('change',updateEffBudgetHint);
onFee.push(()=>{if(effReady)effRender()});
function effInit(){
  if(effReady){effRender();return}
  if(effInitP)return effInitP;
  $('effInfo').textContent='시세를 불러오는 중…';
  void loadCachedPlans();
  effInitP=loadPool().then(()=>{effReady=true;effRender()}).finally(()=>{effInitP=null});
  return effInitP;
}
function effRows(){
  const fee=feeRate(),down=$('effFail').value==='down',rows=[];
  for(const [id,name,ovr,pr] of POOL){
    for(let g=1;g<MAX;g++){
      if(effStep&&g!==effStep)continue;
      const buy=pr[g-1],up=pr[g];if(!buy||!up||buy<1e6||buy>effBudget)continue;
      const p=SUCC[g]/100,fg=down&&g>=5?g-1:g,failV=pr[fg-1];
      if(!Number.isFinite(p)||!failV)continue;
      const ret=(p*up+(1-p)*failV)*(1-fee),netUp=up*(1-fee);
      rows.push({id:Number(id),name,ovr,g,p,buy,up,mat:0,plan:null,inv:buy,ret,netUp,rr:ret/buy,ev:ret-buy,win:netUp-buy,failV});
    }
  }
  return rows;
}
// Adding a cost must lower return and profit, and cannot enlarge a budget.
function effWithMaterial(row,plan){
  if(!plan?.official||plan.gauge!==100||!Number.isSafeInteger(plan.cost)||plan.cost<=0)return null;
  const inv=row.buy+plan.cost;if(!Number.isFinite(inv)||inv<=0)return null;
  return {...row,mat:plan.cost,plan,inv,rr:row.ret/inv,ev:row.ret-inv,win:row.netUp-inv};
}
function parseEffBudget(raw){
  const s=String(raw??"").trim().replace(/,/g,"");
  if(!s)return Infinity;
  if(!/^\d+(?:\.\d{1,8})?$/.test(s))return null;
  const v=Math.round(Number(s)*1e8);
  return Number.isSafeInteger(v)&&v>0?v:null;
}
function effWithinBudget(rows,budget){return rows.filter(r=>r.inv<=budget)}
// Fixed scales keep a score comparable across budgets and newly verified quotes.
function effLifeScore(r){
  if(!Number.isFinite(r.inv)||r.inv<=0||!Number.isFinite(r.win)||r.win<=0||!Number.isFinite(r.p))return 0;
  const roi=Math.min(1,Math.log1p(r.win/r.inv)/Math.log(11));
  const probability=Math.max(0,Math.min(1,r.p));
  const profit=Math.min(1,Math.log1p(r.win/1e8)/Math.log1p(1000));
  return 50*roi+30*probability+20*profit;
}
function effCandidateOrder(rows,mode){
  if(mode!=='win')return [...rows].sort((a,b)=>b.rr-a.rr);
  return rows.filter(r=>r.win>0).map(r=>({...r,lifeScore:effLifeScore(r)})).sort((a,b)=>b.lifeScore-a.lifeScore||b.win-a.win||a.id-b.id||a.g-b.g);
}
let effCtx=null,effTimer=null,effWork=Promise.resolve(),effLastHTML='';
const EFF_BATCH=6,EFF_PARALLEL=2;
function effActive(ctx){return effCtx===ctx&&$('effMat').checked&&!$('simEff').hidden&&!$('v-sim').hidden}
function effMaterialRows(ctx){
  const rows=[];for(const [key,plan] of officialPlans){const r=ctx.byKey.get(key);if(r){const v=effWithMaterial(r,plan);if(v&&v.inv<=ctx.budget)rows.push(v)}}return rows;
}
function effStart(ctx,retry=false){
  if(!effActive(ctx)||ctx.running)return;
  if(retry){for(const k of ctx.retry)ctx.attempted.delete(k);ctx.retry.clear();ctx.issue=''}
  ctx.running=true;ctx.done=0;ctx.issue='';effPaint(ctx);
  effWork=effWork.catch(()=>{}).then(async()=>{
    await loadCachedPlans();
    if(!effActive(ctx))return;
    const next=[];
    for(const r of ctx.candidates){const k=planKey(r.id,r.g);if(officialPlans.has(k)||ctx.attempted.has(k))continue;next.push(r);if(next.length>=EFF_BATCH)break}
    for(let i=0;i<next.length&&effActive(ctx);i+=EFF_PARALLEL){
      if(ctx.issue)break;
      await Promise.all(next.slice(i,i+EFF_PARALLEL).map(async r=>{
        const k=planKey(r.id,r.g);if(officialPlans.has(k))return;
        ctx.attempted.add(k);
        const plan=await loadOfficial(r.g,r.id);
        ctx.done++;
        if(!plan){const code=officialErrorCodes.get(k);if(code!=='no_full_combo'&&code!=='not_verified'){ctx.retry.add(k);ctx.issue=officialErrors.get(k)||'공식 조회 오류'}}
        if(effActive(ctx))effPaint(ctx);
      }));
    }
  }).finally(()=>{ctx.running=false;if(effActive(ctx))effPaint(ctx)});
}
function effRow(r,i,kind){
  const win=kind==="win",score=win?effLifeScore(r):0,w=win?score:Math.max(4,Math.min(100,r.rr/2*100));
  const money=v=>{const n=Math.round(v),abs=Math.abs(n),jo=Math.floor(abs/1e12),eok=Math.floor(abs%1e12/1e8),man=Math.floor(abs%1e8/1e4),parts=[];if(jo)parts.push(jo.toLocaleString("ko-KR")+"조");if(eok)parts.push(eok.toLocaleString("ko-KR")+"억");if(man)parts.push(man.toLocaleString("ko-KR")+"만");return (n<0?"−":"")+(parts.join(" ")||abs.toLocaleString("ko-KR"))};
  const signed=v=>(v>0?"+":"")+money(v);
  const exact=v=>Math.round(v).toLocaleString("ko-KR")+" BP";
  const metric=(label,value,cls="",raw=null)=>'<span class="er-metric"><small>'+label+'</small><b class="'+cls+'"'+(raw===null?"":' title="'+exact(raw)+'"')+'>'+value+'</b></span>';
  const main=win?'<b class="er-score">'+score.toFixed(1)+'<em>/100</em></b>':'<b class="'+(r.rr>=1?"up":"dn")+'">'+r.rr.toFixed(2)+'</b>';
  return '<button type="button" class="eff-row" data-pick="'+r.id+'" data-g="'+r.g+'">'+
    '<span class="er-rank">'+(i+1)+'</span>'+
    '<span class="er-img">'+bigImg(r.id)+'</span>'+
    '<span class="er-who"><span class="er-name">'+bigBadge(Math.floor(r.id/1e6))+'<b>'+H(r.name)+'</b></span>'+
    '<span class="er-step">'+gchip(r.g)+'<i>→</i>'+gchip(r.g+1)+'<em>성공 확률 '+(r.p*100).toFixed(1).replace(/\.0$/,"")+'%</em></span></span>'+
    '<span class="er-main"><small>'+(win?"종합지수":"회수율")+'</small>'+main+'</span>'+
    '<span class="er-money">'+metric("총 투자금",money(r.inv),"",r.inv)+metric("재료비",r.mat?exact(r.mat):"미포함","",r.mat||null)+metric("성공 시 시세",money(r.up),"",r.up)+metric("기대 손익",signed(r.ev),r.ev>=0?"up":"dn",r.ev)+metric("성공 시 순이익",signed(r.win),r.win>=0?"up":"dn",r.win)+metric(win?"회수율":"성공 수익률",win?r.rr.toFixed(2):(r.win/r.inv*100).toFixed(1)+"%",win?(r.rr>=1?"up":"dn"):(r.win>=0?"up":"dn"))+(win?metric("성공 수익률",(r.win/r.inv*100).toFixed(1)+"%","up"):"")+'</span>'+
    '<span class="er-meter'+(win?' er-score-meter':'')+'" aria-hidden="true"><i style="width:'+w+'%"></i><u></u></span></button>';
}
function effRender(){
  if(!effReady)return;
  clearTimeout(effTimer);
  if(!POOL){$('effInfo').textContent='강화별 시세 풀이 아직 없어요.';$('effOut').innerHTML='';effLastHTML='';$('effActions').hidden=true;return}
  const mat=$('effMat').checked;
  if(!mat){effCtx=null;effPaint(null,effRows());return}
  const key=[effMode,effStep,$('effFail').value,feeRate(),effBudget].join(':');
  if(!effCtx||effCtx.key!==key){
    const candidates=effCandidateOrder(effRows(),effMode);
    effCtx={key,budget:effBudget,candidates,byKey:new Map(candidates.map(r=>[planKey(r.id,r.g),r])),attempted:new Set(),retry:new Set(),running:false,done:0,issue:'',started:false};
  }
  const ctx=effCtx;effPaint(ctx);
  if(effActive(ctx)&&!ctx.started&&ctx.candidates.length){
    effTimer=setTimeout(()=>{if(effActive(ctx)&&!ctx.started){ctx.started=true;effStart(ctx)}},0);
  }
}
function effPaint(ctx,baseRows){
  $('effScoreHelp').hidden=effMode!=='win';
  const rows=ctx?effMaterialRows(ctx):effWithinBudget(baseRows,effBudget);
  const fee=(feeRate()*100).toFixed(1).replace(/\.0$/,'');
  const empty=ctx?(ctx.candidates.length===0?'예산과 강화 단계에 맞는 후보가 없어요.':ctx.running?'공식 재료비를 조회하고 있어요…':ctx.issue?'조회 실패: 다시 조회해 주세요.':'예산·조건에 맞는 확인된 재료비 조합이 아직 없어요. 추가 조회를 눌러 주세요.'):'조건에 맞는 카드가 없어요.';
  const win=effMode==='win',top=effCandidateOrder(rows,effMode).slice(0,30),title=win?'인생강화 TOP':'회수율 TOP';
  const html='<div class="eff-col"><h3>'+title+' 30'+' <small>'+(win?'종합지수 높은 순':'투자금 대비 회수 비율 순')+(ctx?' · 공식 조회 완료 후보 기준':'')+'</small></h3>'+(top.map((r,i)=>effRow(r,i,win?'win':undefined)).join('')||'<p class="sim-note">'+empty+'</p>')+'</div>';
  if(html!==effLastHTML){$('effOut').className='eff-cols';$('effOut').innerHTML=html;effLastHTML=html}
  $('effActions').hidden=!ctx;
  if(ctx){
    const remaining=ctx.candidates.some(r=>!officialPlans.has(planKey(r.id,r.g))&&!ctx.attempted.has(planKey(r.id,r.g)));
    $('effInfo').textContent='재료비 포함 · 공식 월평균 거래가 · 확인 '+rows.length.toLocaleString()+' / 후보 '+ctx.candidates.length.toLocaleString()+'건 · 수수료 '+fee+'% · 전체 시장 순위 아님'+(Number.isFinite(effBudget)?' · 예산 '+won(effBudget)+' 이하':'');
    $('effProgress').textContent=ctx.running?'공식 재료비 확인 중 '+ctx.done+'/'+EFF_BATCH:ctx.issue?ctx.issue:'조회된 카드만 순위에 반영됩니다. 추가 조회 시 순위가 달라질 수 있습니다.';
    $('effMore').disabled=ctx.running||!remaining;
    $('effRetry').hidden=!ctx.retry.size;$('effRetry').disabled=ctx.running;
  }else $('effInfo').textContent='시세 풀 '+POOL.length.toLocaleString()+'장 · 판매 수수료 '+fee+'% · 재료비 제외 · 줄을 누르면 강화 시뮬로 이어서 해 볼 수 있어요.';
}
$('effMore').addEventListener('click',()=>{if(effCtx){effCtx.started=true;effStart(effCtx)}});
$('effRetry').addEventListener('click',()=>{if(effCtx){effCtx.started=true;effStart(effCtx,true)}});
$('effOut').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;setTab('enh');pickPlayer(+b.dataset.pick,+b.dataset.g)});

/* ================= 강화 시뮬 ================= */
const fill=(el,from,to,sel)=>{el.innerHTML='';for(let i=from;i<=to;i++)el.add(new Option(i+'강',i,false,i===sel))};
fill($('smEFrom'),1,12,1);fill($('smETo'),2,13,8);
let SEL=null,cur=1,tries=0,ok=0,ng=0,timer=null,KAN=5,spent=0;
const autoMat=()=>$('smEMatAuto').checked;
const gauge=()=>autoMat()?1:KAN/5, pOf=g=>g>=MAX?0:SUCC[g]/100*gauge();
const baseOvr=()=>{if(!SEL)return 0;const x=typeof ix==='function'&&ix(SEL.c.id);return (SEL.l&&SEL.l.ovr)||(x&&x[0])||0};
/* 자동은 공식 도우미가 확인한 100% 조합만 사용. */
const korBP=v=>{v=Math.round(+v||0);if(!v)return '0';const eok=Math.floor(v/1e8),man=Math.floor(v%1e8/1e4),rest=v%1e4,p=[];
  if(eok)p.push(eok.toLocaleString()+'억');if(man)p.push(man.toLocaleString()+'만');if(rest)p.push(rest%1000===0?(rest/1000)+'천':rest.toLocaleString());return p.join(' ')};
const matPer=()=>Math.max(0,+String($('smEMat').value).replace(/[^\d]/g,'')||0);
const officialPlans=new Map(),officialPending=new Map(),officialErrors=new Map(),officialErrorCodes=new Map();
const planKey=(id,g)=>id+":"+g;
const validOfficialPlan=plan=>plan?.official&&plan.gauge===100&&Number.isSafeInteger(plan.cost)&&plan.cost>0&&Array.isArray(plan.cards)&&plan.cards.length>0&&plan.cards.length<=5&&plan.cards.every(c=>Number.isSafeInteger(c.ovr)&&Number.isSafeInteger(c.price)&&c.price>0)&&plan.cards.reduce((sum,c)=>sum+c.price,0)===plan.cost;
let cachedPlansP=null;
function loadCachedPlans(){
 if(!cachedPlansP)cachedPlansP=(async()=>{try{
  const r=await fetch("/api/boost?cached=1",{signal:typeof AbortSignal.timeout==="function"?AbortSignal.timeout(5000):undefined});if(!r.ok)return;
  const d=await r.json();for(const item of d.items||[]){if(Number.isSafeInteger(item.spid)&&Number.isInteger(item.grade)&&item.grade>=1&&item.grade<MAX&&validOfficialPlan(item.plan)){const k=planKey(item.spid,item.grade);if(!officialPlans.has(k))officialPlans.set(k,item.plan)}}
  if(effCtx&&effActive(effCtx))effPaint(effCtx);
 }catch{}})();return cachedPlansP;
}
let preparing=false;
const selectedPlan=g=>SEL?officialPlans.get(planKey(SEL.c.id,g))||null:null;
async function loadOfficial(g,id=SEL?.c.id){
 if(!id||g<1||g>=MAX)return null;
 const key=planKey(id,g);
 if(officialPlans.has(key))return officialPlans.get(key);
 if(officialPending.has(key))return officialPending.get(key);
 officialErrors.delete(key);officialErrorCodes.delete(key);
 const task=(async()=>{try{
   const r=await fetch("/api/boost?spid="+encodeURIComponent(id)+"&grade="+g,{credentials:"same-origin"});
   const d=await r.json().catch(()=>null);
   if(!r.ok||!d){const e=Error(d?.message||"공식 도우미 연결 오류 ("+r.status+")");e.code=d?.code||"http_"+r.status;throw e}
   const plan=d.plan;
   if(!plan&&["no_full_combo","not_verified"].includes(d.reason)){const e=Error("공식 데이터에서 풀게이지 조합을 찾지 못했습니다.");e.code=d.reason;throw e}
   if(d.spid!==id||d.grade!==g||!validOfficialPlan(plan))throw Error("공식 데이터에서 풀게이지 조합을 찾지 못했습니다.");
   officialPlans.set(key,plan);return plan;
 }catch(e){officialErrors.set(key,e.message||"공식 시세 조회 실패");officialErrorCodes.set(key,e.code||"network");return null}finally{
   officialPending.delete(key);
   if(SEL?.c.id===id&&cur===g){matShow();drawEv();$('smEP').textContent=autoMat()&&!selectedPlan(cur)?"미확인":(pOf(cur)*100).toFixed(pOf(cur)<.1?1:0)+"%"}
 }})();
 officialPending.set(key,task);
 if(SEL?.c.id===id&&cur===g)matShow();
 return task;
}
function ensureCurrent(){if(SEL&&autoMat()&&cur<MAX&&!officialErrors.has(planKey(SEL.c.id,cur)))void loadOfficial(cur)}
function lockEnh(on){preparing=on;for(const id of ["smEOne","smEAuto","smEMany","smEReset","smEFrom","smETo","smEFail","smEMatAuto","smEQ"])$(id).disabled=on}
async function prepareStages(from,to,down){
 if(!autoMat())return true;if(!SEL)return false;
 const id=SEL.c.id;
 for(let g=down?Math.min(from,4):from;g<to;g++){
   if(SEL?.c.id!==id||!autoMat())return false;
   if(!selectedPlan(g)){$('smEMsg').textContent="공식 "+g+"→"+(g+1)+"강 조합 조회 중…";if(!await loadOfficial(g,id))return false}
 }
 return true;
}
const attemptCost=g=>autoMat()?selectedPlan(g)?.cost??null:matPer()>0?matPer()*KAN:null;
function matShow(){
 const v=matPer(),plan=autoMat()?selectedPlan(cur):null,key=SEL?planKey(SEL.c.id,cur):"";
 $('smEMat').disabled=autoMat()||preparing;
 $('smEMatV').textContent=autoMat()?"공식 월평균 최저 거래가":v?korBP(v)+' BP / 장':'재료비 입력 필요';
 $('smEMatCombo').innerHTML=plan?'<b>'+korBP(plan.cost)+' BP · '+plan.cards.length+'장 · 공식 게이지 100%</b><br>'+plan.cards.map(c=>'OVR '+c.ovr+' · '+korBP(c.price)+' BP').join('<br>')+'<br>지난 한 달 일일 최저 거래가 평균 · 실제 매물가와 다를 수 있음':cur>=MAX?"최대 강화":!SEL?"강화할 선수를 선택하세요.":officialPending.has(key)?"공식 강화 도우미 조회 중…":officialErrors.has(key)?H(officialErrors.get(key))+' <button type="button" id="smEBoostRetry">다시 조회</button>':"공식 조합 조회 대기";
 if($('smEBoostRetry'))$('smEBoostRetry').onclick=()=>{void loadOfficial(cur)};
 $('smEGaugeV').textContent=autoMat()?(plan?"풀게이지 · 100%":"게이지 미확인"):`${KAN}칸 · ${KAN*20}%`;
 $('smEGaugeBox').querySelectorAll('[data-k]').forEach(x=>x.classList.toggle('on',autoMat()?!!plan:+x.dataset.k<=KAN));
}
const priceAt=g=>SEL&&SEL.l&&SEL.l.price?(SEL.l.price[g-1]||0):0;

$('smEGaugeBox').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b||autoMat())return;KAN=+b.dataset.k;$('smEGaugeBox').querySelectorAll('[data-k]').forEach(x=>x.classList.toggle('on',+x.dataset.k<=KAN));$('smEGaugeV').textContent=`${KAN}칸 · ${KAN*20}%`;draw()});
$('smEMat').addEventListener('input',()=>{const d=$('smEMat').value.replace(/[^\d]/g,'');if(d!==$('smEMat').value)$('smEMat').value=d;matShow();drawEv()});
$('smEMatAuto').addEventListener('change',reset);
queueMicrotask(()=>{matShow();drawEv()});
onFee.push(()=>drawEv());

/* 선수 검색 */
$('smEQ').addEventListener('input',()=>{
  const q=$('smEQ').value.trim().toLowerCase().split(/\s+/).filter(Boolean).map(norm);const box=$('smESug');
  if(!q.length||typeof CARDS==='undefined'||!CARDS.length){box.hidden=true;return}
  const hit=[];for(const c of CARDS){const sn=norm(sname(c.sid));if(q.every(w=>c.key.includes(w)||sn.includes(w))){hit.push(c);if(hit.length>400)break}}
  hit.sort((a,b)=>((ix(b.id)||[])[0]||0)-((ix(a.id)||[])[0]||0));
  box.innerHTML=hit.slice(0,8).map(c=>{const x=ix(c.id);return `<button type="button" data-pick="${c.id}">${bigBadge(c.sid)}<b>${H(c.name)}</b><small>${H(sname(c.sid))}</small>${x&&x[0]?`<em class="${fcCls(x[0])}">${x[1]||''} ${x[0]}</em>`:''}</button>`}).join('')||'<p class="sim-note">검색 결과가 없어요.</p>';
  box.hidden=false;
});
$('smESug').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b||preparing)return;$('smESug').hidden=true;pickPlayer(+b.dataset.pick)});
document.addEventListener('click',e=>{if(!e.target.closest('#simEnh .sim-pick'))$('smESug').hidden=true});
async function pickPlayer(id,g){
  if(preparing)return;
  const c=(typeof CARDS!=='undefined'&&CARDS.find(x=>x.id===id))||{id,sid:Math.floor(id/1e6),name:((POOL||[]).find(x=>x[0]===id)||[])[1]||''};
  $('smEQ').value=c.name||'';SEL={c,l:null,d:null};
  if(g){$('smEFrom').value=String(g);if(+$('smETo').value<=g)$('smETo').value=String(Math.min(13,g+1))}
  reset();
  const d=await cardData(id);if(SEL&&SEL.c.id===id){SEL.l=d.l;SEL.d=d.d;if(!SEL.c.name&&d.l)SEL.c.name=d.l.name;reset()}
  $('simEnh').scrollIntoView({behavior:'smooth',block:'start'});
}

function drawPlayer(kind){
  const P=$('smEPlayer');if(!SEL){return}
  const {c,l,d}=SEL,b=GRADE_BONUS[cur]||0,pos=(d&&d.pos&&d.pos.length?d.pos:l&&l.pos)||[],main=pos[0];
  const price=priceAt(cur);
  P.className='sim-player'+(kind?' fx-'+kind:'');
  P.innerHTML=`<div class="sp-img">${bigImg(c.id)}</div><div class="sp-info"><div class="sp-name">${bigBadge(c.sid)}<b>${H(c.name||(d&&d.name)||'')}</b></div>
    ${main?`<div class="sp-ovr"><span>${H(main[0])}</span><b class="${fcCls((main[1]||0)+b+ADAPT)}">${(main[1]||0)+b+ADAPT}</b><small>+${b}</small></div>`:''}
    <div class="sp-price">${cur}강 시세 <b>${price>0?fmtBP(price):'-'}</b></div></div>`;
  const S=$('smEStatsBox');
  if(!d||!d.stats){S.innerHTML=`<p class="sim-note">${SEL.d===null&&!SEL.l?'능력치를 불러오는 중이에요…':'이 카드는 아직 세부 능력치를 수집하지 않았어요. 매일 채우는 중이에요.'}</p>`;return}
  const sum=(d.summary||[]).map(([k,v])=>`<div><small>${H(k)}</small><b class="${fcCls(v+b+ADAPT)}">${v+b+ADAPT}</b></div>`).join('');
  const rows=STAT_LABELS.filter(([k])=>d.stats[k]!=null).map(([k,lb])=>{const v=d.stats[k]+b+ADAPT;return `<div class="ss"><span>${lb}</span><b class="${fcCls(v)}">${v}</b>${b?`<em>+${b}</em>`:''}</div>`}).join('');
  S.innerHTML=`<div class="pm2-sum">${sum}</div><div class="sim-statgrid${kind?' fx-'+kind:''}">${rows}</div>`;
}
/* 이번 강화 손익(누적): 시작 단계 카드를 산 값 + 지금까지 쓴 재료비를 모두 더해서,
   이번 시도가 성공/실패했을 때 바로 판다면 전체로 얼마가 남는지 보여줘요. 강화할 때마다 바뀌어요. */
let START=0;
function drawEv(){
  const E=$('smEEv');
  if(!SEL||!SEL.l||!SEL.l.price){E.innerHTML=`<p class="sim-note">${SEL?'시세를 불러오는 중이에요…':'선수를 고르면 성공·실패 시 시세와 누적 손익을 계산해 드려요.'}</p>`;return}
  const fee=feeRate(),from=+$('smEFrom').value,start=START||priceAt(from),unit=matPer(),mat=attemptCost(cur),paid=start+spent;
  const nowSell=priceAt(cur)*(1-fee);
  const head=`<dl class="ev-dl ev-sum">
      <div><dt>지금까지 쓴 돈</dt><dd>${won(paid)}</dd><small>시작 ${from}강 카드 ${won(start)}${spent?` + 재료비 ${won(spent)} (${tries}회)`:''}</small></div>
      <div><dt>지금 팔면</dt><dd class="${nowSell-paid>=0?'up':'dn'}">${sgn(nowSell-paid)}</dd><small>${cur}강 ${won(priceAt(cur))} · 수수료 뒤 ${won(nowSell)}</small></div>
    </dl>`;
  if(cur>=MAX){E.innerHTML='<p class="sim-note">13강은 마지막 단계예요.</p>'+head;return}
  if(mat===null){E.innerHTML='<p class="sim-note">재료비를 확인할 수 없어 손익을 계산할 수 없습니다. 공식 도우미 조회 또는 수동 입력을 확인하세요.</p>'+head;return}
  const p=pOf(cur),up=priceAt(cur+1),fg=$('smEFail').value==='down'&&cur>=5?cur-1:cur,fv=priceAt(fg);
  if(!start||!up){E.innerHTML='<p class="sim-note">이 단계 시세가 없어 계산할 수 없어요.</p>';return}
  const cost=paid+mat,sUp=up*(1-fee),sFail=fv*(1-fee),winT=sUp-cost,loseT=sFail-cost,evT=p*winT+(1-p)*loseT;
  const firstCost=attemptCost(from),once=firstCost===null?null:priceAt(from+1)*(1-fee)-start-firstCost;
  E.innerHTML=`<div class="ev-top"><div class="ev-step">${gchip(cur)}<i>→</i>${gchip(cur+1)}</div><div class="ev-p"><small>성공 확률</small><b>${(p*100).toFixed(p<.1?1:0)}%</b></div></div>
    <div class="ev-big ${winT>=0?'up':'dn'}"><small>이번에 성공하면 (누적)</small><b>${sgn(winT)}</b><span>${tries&&cur===from&&once!==null?`처음 1번에 성공했다면 ${sgn(once)}였어요`:`${won(cost)} 들여서 ${cur+1}강 ${won(up)} · 수수료 뒤 ${won(sUp)}`}</span></div>
    <dl class="ev-dl">
      <div><dt>이번에 실패하면 (누적)</dt><dd class="${loseT>=0?'up':'dn'}">${sgn(loseT)}</dd><small>${fg<cur?`${fg}강으로 하락 · `:''}${fg}강 ${won(fv)} · 수수료 뒤 ${won(sFail)}</small></div>
      <div><dt>이번 시도 기댓값 (누적)</dt><dd class="${evT>=0?'up':'dn'}">${sgn(evT)}</dd><small>재료비 ${won(mat)}${autoMat()?` (${"공식 조합 "+selectedPlan(cur).cards.length+"장"})` :unit?` (${won(unit)} × ${KAN}칸)`:' · 재료비 제외'}</small></div>
    </dl>${head}`;
}
function draw(msg,kind){
  $('smEGrade').textContent=cur;$('smETier').textContent=tier(cur);$('smECard').className='sim-card g-'+gcls(cur)+(kind?' fx-'+kind:'');
  $('smETry').textContent=tries;$('smEOk').textContent=ok;$('smENg').textContent=ng;
  $('smEP').textContent=cur>=MAX?'최대':autoMat()&&!selectedPlan(cur)?'미확인':(pOf(cur)*100).toFixed(pOf(cur)<.1?1:0)+'%';
  if(msg)$('smEMsg').textContent=msg;
  if(SEL)drawPlayer(kind);
  matShow();drawEv();ensureCurrent();
}
function reset(){clearInterval(timer);timer=null;$('smEAuto').textContent='목표까지 자동';cur=+$('smEFrom').value;tries=ok=ng=spent=0;START=priceAt(cur);matShow();$('smELog').innerHTML='';draw(SEL?'강화 버튼을 눌러 보세요.':'먼저 선수를 고르면 능력치까지 함께 바뀌어요.')}
function log(t,k,p){const li=document.createElement('li');li.className=k;const net=SEL&&START?priceAt(cur)*(1-feeRate())-(START+spent):null;li.innerHTML=`<b>#${tries}</b> ${t}${net!=null?` <em class="${net>=0?'up':'dn'}">누적 ${sgn(net)}</em>`:''} <small>${(p*100).toFixed(p<.1?1:0)}%</small>`;$('smELog').prepend(li);while($('smELog').children.length>60)$('smELog').lastChild.remove()}
function step(){
  const to=+$('smETo').value;if(cur>=MAX||cur>=to){draw(`목표 ${to}강 달성! 총 ${tries}회 시도했어요.`,'win');return false}
  const cost=attemptCost(cur);if(cost===null){draw('재료비를 확인할 수 없어 강화를 진행할 수 없습니다.');return false}
  const p=pOf(cur),from=cur;tries++;spent+=cost;
  if(Math.random()<p){cur++;ok++;log(`${from}강 → ${cur}강 성공`,'ok',p);draw(`성공! ${cur}강 ${tier(cur)}가 됐어요.`,'ok')}
  else{ng++;if($('smEFail').value==='down'&&cur>=5)cur--;log(`${from}강 → ${from+1}강 실패${cur<from?' (하락 '+cur+'강)':''}`,'ng',p);draw(cur<from?`실패… ${cur}강으로 내려갔어요.`:'실패… 단계는 그대로예요.','ng')}
  if(cur>=to){draw(`목표 ${to}강 달성! 총 ${tries}회 시도했어요.${spent?' 재료비 약 '+won(spent)+' BP':''}`,'win');return false}
  return true;
}
$('smEOne').onclick=async()=>{if(preparing)return;clearInterval(timer);timer=null;$('smEAuto').textContent='목표까지 자동';if(autoMat()&&SEL&&!selectedPlan(cur)){lockEnh(true);try{if(!await loadOfficial(cur)){draw('공식 재료비 확인 실패. 다시 조회하거나 수동 입력하세요.');return}}finally{lockEnh(false);matShow()}}step()};
$('smEAuto').onclick=async()=>{if(preparing)return;if(timer){clearInterval(timer);timer=null;$('smEAuto').textContent='목표까지 자동';return}
  if(autoMat()){lockEnh(true);try{if(!await prepareStages(cur,+$('smETo').value,$('smEFail').value==='down')){draw('일부 단계 공식 조합을 확인하지 못했습니다. 다시 시도하거나 수동 입력하세요.');return}}finally{lockEnh(false);matShow()}}
  $('smEAuto').textContent='멈추기';let n=0;timer=setInterval(()=>{if(!step()||++n>5000){clearInterval(timer);timer=null;$('smEAuto').textContent='목표까지 자동'}},90)};
$('smEReset').onclick=reset;['smEFrom','smEFail'].forEach(id=>$(id).onchange=reset);
$('smETo').onchange=()=>{if(+$('smETo').value<=+$('smEFrom').value)$('smETo').value=Math.min(13,+$('smEFrom').value+1);draw()};
$('smEMany').onclick=async()=>{if(preparing)return;
  const from=+$('smEFrom').value,to=+$('smETo').value,down=$('smEFail').value==='down',N=2000,cap=200000,res=[],costs=new Map();
  if(autoMat()){lockEnh(true);try{if(!await prepareStages(from,to,down)){$('smEStats').textContent='일부 단계 공식 조합을 확인하지 못했습니다. 다시 시도하거나 수동 입력하세요.';return}}finally{lockEnh(false);matShow()}}
  for(let g=down?Math.min(from,4):from;g<to;g++){const cost=attemptCost(g);if(cost===null){$('smEStats').textContent='일부 단계 재료비를 확인할 수 없어 평균 비용을 계산할 수 없습니다.';return}costs.set(g,cost)}
  let totalCost=0,capped=0;for(let r=0;r<N;r++){let g=from,t=0,cost=0;while(g<to&&t<cap){t++;cost+=costs.get(g);if(Math.random()<pOf(g))g++;else if(down&&g>=5)g--}res.push(t);totalCost+=cost;if(g<to)capped++}if(capped){$('smEStats').textContent='일부 시뮬레이션이 반복 한도에 도달하여 평균 비용을 표시하지 않습니다.';return}
  res.sort((a,b)=>a-b);const q=x=>res[Math.min(N-1,Math.floor(x*N))],avg=res.reduce((a,b)=>a+b,0)/N;
  let exp=0;if(!down)for(let k=from;k<to;k++)exp+=1/pOf(k);
  const lucky=res.filter(t=>t<=to-from).length/N*100,averageMaterial=SEL?totalCost/N:0,start=priceAt(from),goal=priceAt(to),fee=feeRate();
  const cost=start+averageMaterial,net=goal*(1-fee)-cost;
  $('smEStats').innerHTML=`<div><span>평균</span><b>${avg.toFixed(1)}회</b></div><div><span>중앙값</span><b>${q(.5)}회</b></div><div><span>운 좋은 10%</span><b>${q(.1)}회 이하</b></div><div><span>운 나쁜 10%</span><b>${q(.9)}회 이상</b></div><div><span>한 번에 성공</span><b>${lucky.toFixed(lucky<1?2:1)}%</b></div>${down?'':`<div><span>이론 기대값</span><b>${exp.toFixed(1)}회</b></div>`}
   ${SEL&&averageMaterial?`<div><span>평균 재료비${autoMat()?' (공식 월평균 기준)':''}</span><b>${won(averageMaterial)}</b></div>`:''}
   ${SEL&&start&&goal?`<div class="wide"><span>${from}강 사서 ${to}강 만들어 팔면 (평균)</span><b class="${net>=0?'up':'dn'}">${sgn(net)} BP</b></div>`:''}`;
};
reset();

/* ================= 팩 오픈 ================= */
const PAPI=(window.FG_API||'/api');
let LIST=null, SHOP=null, PACK=null, CACHE={}, PARTS={}, LEDGER=null;
const nn=s=>String(s||'').replace(/^★/,'').replace(/\s+/g,'').toLowerCase();
async function getJSON(u){const r=await fetch(u);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||('오류 '+r.status));return j}
const getItem=sn=>CACHE[sn]||(CACHE[sn]=getJSON(PAPI+'/prob?sn='+sn).catch(e=>{delete CACHE[sn];throw e}));
const findItem=name=>LIST&&LIST.find(x=>nn(x.name)===nn(name));
/* 패키지 구성품: 웹 상점 상세 페이지 → [{name,count,img}] (+ 넥슨 확률표 매칭) */
const getParts=pid=>PARTS[pid]||(PARTS[pid]=getJSON(PAPI+'/shop?pid='+pid).then(j=>(j.parts||[]).map(p=>({...p,it:findItem(p.name)||null}))).catch(e=>{delete PARTS[pid];throw e}));
const fcOf=pr=>{const m=String(pr||'').match(/([\d,]+)\s*FC/g);if(!m)return 0;return +m[m.length-1].replace(/[^\d]/g,'')};
let shelfP=null;
function loadShelf(){
  if(shelfP)return shelfP;
  loadPool();
  shelfP=(async()=>{
    try{const [p,s]=await Promise.all([getJSON(PAPI+'/prob'),getJSON(PAPI+'/shop').catch(e=>({items:[],err:e.message}))]);LIST=p.items;SHOP=s.items||[];
      const shopHtml=SHOP.map(x=>{const it=findItem(x.name);return `<button type="button" class="sim-pack${it?'':' pkg'}" data-pid="${x.pid}"${it?` data-sn="${it.sn}"`:''}><img src="${H(x.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><b>${H(x.name)}</b><span class="pr">${H(x.price)}</span><small>${it?H(x.date):'패키지 · 구성품을 이어서 열어요'}</small></button>`}).join('');
      $('smPShelf').innerHTML=shopHtml||`<p class="sim-note">${H(s.err||'상점 목록을 불러오지 못했어요.')}</p>`;
      const boxes=LIST.filter(x=>/크리스탈\s*\d+개\s*상자/.test(x.name)&&!/^\[/.test(x.name.replace(/^\[TM[^\]]*\]\s*/,'')));
      $('smPShelf2').innerHTML=boxes.map(x=>{const n=(x.name.match(/크리스탈\s*(\d+)개/)||[])[1]||'';return `<button type="button" class="sim-pack crystal" data-sn="${x.sn}"><span class="cr-ico">◆<i>${n}</i></span><b>${H(x.name)}</b></button>`}).join('');
      $('smPSrc').textContent=`웹 상점 ${SHOP.length}개 상품 · 넥슨 확률 공개 아이템 ${LIST.length}개`;
    }catch(e){$('smPSrc').textContent='불러오지 못했어요: '+e.message;shelfP=null;throw e}
  })();
  return shelfP;
}
function partsHtml(parts){
  return `<b>구성품</b><ul>${parts.map(p=>`<li class="${p.it?'':'off'}"><span>${H(p.name)}</span><em>× ${p.count}</em>${p.it?'':'<small>확률 정보 없음 · 제외</small>'}</li>`).join('')}</ul>`;
}
document.getElementById('simPack').addEventListener('click',async e=>{
  const b=e.target.closest('.sim-pack[data-sn],.sim-pack[data-pid]');if(!b||b.classList.contains('off'))return;
  document.querySelectorAll('.sim-pack').forEach(x=>x.classList.toggle('on',x===b));
  const sn=b.dataset.sn?+b.dataset.sn:0,shopItem=SHOP&&b.dataset.pid?SHOP.find(x=>String(x.pid)===b.dataset.pid):null;
  $('smPOpen').hidden=false;$('smPName').textContent='불러오는 중…';$('smPParts').hidden=true;
  try{
    if(sn){const it=await getItem(sn);PACK={it,parts:null,shop:shopItem||null,fc:shopItem?fcOf(shopItem.price):0,name:it.name};}
    else{const parts=await getParts(shopItem.pid),use=parts.filter(p=>p.it);
      if(!use.length)throw new Error('구성품의 확률 정보를 찾지 못했어요');
      await Promise.all(use.map(async p=>{p.data=await getItem(p.it.sn)}));
      PACK={it:null,parts,shop:shopItem,fc:fcOf(shopItem.price),name:shopItem.name};}
  }catch(err){$('smPName').textContent='불러오지 못했어요: '+err.message;return}
  $('smPImg').src=shopItem?shopItem.img:'';$('smPImg').hidden=!shopItem;
  $('smPName').textContent=PACK.name;$('smPMeta').textContent=[shopItem?shopItem.price:'',shopItem?shopItem.date:(PACK.it&&PACK.it.period?'기간 '+PACK.it.period:'')].filter(Boolean).join(' · ');
  if(PACK.parts){$('smPParts').innerHTML=partsHtml(PACK.parts);$('smPParts').hidden=false}
  LEDGER={n:0,fc:0,bp:0,pv:0,best:null,hist:[]};$('smPReveal').innerHTML='';renderLedger();renderTable(PACK.it||PACK.parts.find(p=>p.data).data);
  $('smPOpen').scrollIntoView({behavior:'smooth',block:'start'});
});

/* 확률 뽑기 + 상자 속 팩 이어 열기 */
function pick(rows){const tot=rows.reduce((a,r)=>a+r.p,0);let x=Math.random()*tot;for(const r of rows){x-=r.p;if(x<=0)return r}return rows[rows.length-1]}
async function openChain(item,depth=1){
  const r=pick(item.rows),step={n:r.n,p:r.p,amt:r.amt,from:item.name};
  if(depth<4){const sub=findItem(r.n);if(sub&&sub.sn!==item.sn){try{const it=await getItem(sub.sn);return [step].concat(await openChain(it,depth+1))}catch(_){}}}
  return [step];
}
/* '기준가 TOP N'을 피파고수 시세 풀에서 실제 선수로
   - 클래스: 확률표 행 이름 앞부분('UC, SPT, 25UCL … · 기준가 TOP 1')에 넥슨이 적어 둔 목록을 그대로 써요.
   - 순위: (선수 × 강화) 조합을 가격순으로 줄 세운 순위예요. '(1~7강)' 팩이면 1~7강 조합 전체에서 순위를 매겨요.
   - OVR 조건(예: 115+)은 1강 OVR 기준. FC INFO 계산과 비교해 몇 % 안으로 맞는 것을 확인했어요. */
const POOLC={};
const nkS=t=>String(t).toUpperCase().replace(/[\s.\-]/g,'').replace(/HEROES$/,'HR');
let SNAME=null;
function seasonIds(tok){
  if(!SNAME){SNAME={};Object.keys(SEASONS).forEach(id=>{const k=nkS(sname(+id));(SNAME[k]=SNAME[k]||[]).push(+id)})}
  const k=nkS(tok);if(SNAME[k])return SNAME[k];
  if(k==='LIVE')return Object.keys(SEASONS).filter(id=>/LIVE/i.test(sname(+id))).map(Number);
  return [];
}
/* '포함' 팩에서 클래스 목록을 못 읽었을 때만: 팩으로 나오지 않는 아이콘 계열을 빼요 */
const NOGEN=/ICON|^IM|IM -|LKI/;
function packRule(name,rowName){
  const s=String(name).replace(/^★/,'').replace(/^(\[[^\]]*\]\s*)+/,'');
  const m=s.match(/^(.*?)\s*Top Price\s*([\d,]+)/i);if(!m)return null;
  const gm=s.match(/\((\d+)(?:~(\d+))?강/),om=s.match(/(\d+)\+/);
  const sids=new Set();let exact=false;
  const pre=String(rowName||'').split(' · ');
  if(pre.length>1&&/TOP/i.test(pre[1])){pre[0].split(',').forEach(t=>seasonIds(t.trim()).forEach(i=>sids.add(i)));exact=sids.size>0}
  if(!exact){const inc=/포함/.test(m[1]);if(!inc)m[1].split(/[,·]/).map(t=>t.trim()).filter(Boolean).forEach(t=>seasonIds(t).forEach(i=>sids.add(i)))}
  const lo=gm?+gm[1]:1,hi=gm?+(gm[2]||gm[1]):1,min=om?+om[1]:0;
  return {lo,hi,min,only:sids.size?sids:null,key:(sids.size?[...sids].sort().join('.'):'all')+'|'+min+'|'+lo+'-'+hi};
}
/* 조합 목록: [[가격, 카드 id, 이름, 1강 OVR, 강화], …] 가격 높은 순 */
function poolPairs(R){
  if(POOLC[R.key])return POOLC[R.key];
  const out=[];
  for(const [id,name,ovr,pr] of POOL){
    const sid=Math.floor(id/1e6);
    if(R.only?!R.only.has(sid):NOGEN.test(sname(sid)))continue;
    if((ovr||0)<R.min)continue;
    for(let g=R.lo;g<=R.hi;g++){const v=pr[g-1];if(v>0)out.push([v,id,name,ovr,g])}
  }
  out.sort((a,b)=>b[0]-a[0]);
  return POOLC[R.key]=out;
}
function playerFor(rank,packName,rowName){
  if(!POOL)return null;const R=packRule(packName,rowName);if(!R)return null;
  const L=poolPairs(R);if(!L.length)return null;const it=L[Math.min(L.length-1,rank-1)];
  return {id:it[1],name:it[2],sid:Math.floor(it[1]/1e6),ovr:it[3]+(GRADE_BONUS[it[4]]||0),g:it[4],v:it[0]};
}
/* 개수: 확률표의 개수 칸 그대로 (예: 행운의 BP 카드 x80 — 웹 상점 구성품에도 x80으로 적혀 있어요) */
const amtOf=a=>parseInt(String(a).replace(/[^\d]/g,''))||1;
/* BP 금액: 'BP · 170000000' 줄과, BP 상자 안에서 금액만 적힌 이어지는 줄('20000000') */
const bpOf=(n,from)=>{n=String(n).trim();const m=n.match(/BP\s*·?\s*([\d,]{5,})/);if(m)return +m[1].replace(/,/g,'');if(/^[\d,]{5,}$/.test(n)&&/BP/i.test(from||''))return +n.replace(/,/g,'');return 0};
function resolve(chain){
  const f=chain[chain.length-1],mult=chain.slice(0,-1).reduce((a,s)=>a*amtOf(s.amt),1),amt=amtOf(f.amt)*mult,prob=chain.reduce((a,s)=>a*s.p/100,1);
  const bp=bpOf(f.n,f.from);if(bp)return {kind:'bp',bp:bp*amt,label:won(bp*amt)+' BP'+(amt>1?` (×${amt})`:''),prob,chain};
  const tm=f.n.match(/TOP\s*([\d,]+)/i);
  if(tm){const pl=playerFor(+tm[1].replace(/,/g,''),f.from,f.n);if(pl&&amt>1){pl.v*=amt;pl.name+=` ×${amt}`}return {kind:'pl',pl,rank:+tm[1].replace(/,/g,''),label:f.n.replace(/개봉일 0~1시 사이 /,''),prob,chain}}
  return {kind:'etc',label:f.n,prob,chain};
}
async function openOnce(){
  if(PACK.it)return [resolve(await openChain(PACK.it))];
  const out=[];for(const p of PACK.parts){if(!p.data)continue;for(let i=0;i<p.count;i++)out.push(resolve(await openChain(p.data)))}
  return out;
}
const valOf=r=>(r.pl&&r.pl.v)||r.bp||0;
function cardHtml(r,i){
  const rare=r.prob<0.01||(r.kind==='pl'&&r.pl&&r.pl.v>=1e11);
  let face='';
  if(r.kind==='bp')face=`<div class="rv-bp"><span>BP</span><b>${H(r.label)}</b></div>`;
  else if(r.kind==='pl'&&r.pl)face=`<div class="rv-img">${bigImg(r.pl.id)}</div><div class="rv-badge">${bigBadge(r.pl.sid)}<span class="gchip g-${GRADE_CLS(r.pl.g)}">${r.pl.g}</span></div><b class="rv-name">${H(r.pl.name)}</b><span class="rv-v">${fmtBP(r.pl.v)}</span>`;
  else if(r.kind==='pl')face=`<b class="rv-name">${H(r.label)}</b><span class="rv-v">시세 매칭 준비 중</span>`;
  else face=`<b class="rv-name">${H(r.label)}</b>`;
  return `<div class="rv${rare?' rare':''}" style="--d:${Math.min(i,11)*0.15}s"><div class="rv-in"><div class="rv-back"></div><div class="rv-front">${face}<small class="rv-p">${(r.prob*100).toFixed(r.prob<0.0001?6:r.prob<0.01?4:2)}%</small></div></div></div>`;
}
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',async()=>{
  if(!PACK)return;const n=+b.dataset.open;document.querySelectorAll('[data-open]').forEach(x=>x.disabled=true);
  $('smPReveal').innerHTML=n<=10?`<div class="rv-pack"><img src="${H(PACK.shop?PACK.shop.img:'')}" alt=""></div>`:'<p class="sim-note">여는 중…</p>';
  const out=[];
  try{for(let i=0;i<n;i++){const got=await openOnce();LEDGER.n++;LEDGER.fc+=PACK.fc;out.push(...got)}}catch(e){$('smPReveal').innerHTML=`<p class="sim-note">여는 중 오류: ${H(e.message)}</p>`}
  out.forEach(r=>{if(r.kind==='bp')LEDGER.bp+=r.bp;if(r.kind==='pl'&&r.pl){LEDGER.pv+=r.pl.v;if(!LEDGER.best||r.pl.v>LEDGER.best.pl.v)LEDGER.best=r}LEDGER.hist.unshift(r)});
  LEDGER.hist=LEDGER.hist.slice(0,40);
  setTimeout(()=>{
    if(out.length<=12){$('smPReveal').innerHTML=`<div class="rv-row">${out.map(cardHtml).join('')}</div>`;}
    else{const top=[...out].sort((a,b)=>valOf(b)-valOf(a)).slice(0,12);$('smPReveal').innerHTML=`<p class="sim-note">${n}개(카드 ${out.length}장)를 열었어요. 가장 비싼 결과 12장이에요.</p><div class="rv-row${n>10?' fast':''}">${top.map(cardHtml).join('')}</div>`}
    renderLedger();document.querySelectorAll('[data-open]').forEach(x=>x.disabled=false);
  },n<=10?900:50);
}));
function renderLedger(){
  if(!LEDGER){$('smPLedger').innerHTML='';return}
  const fr=feeRate(),net=LEDGER.pv*(1-fr)+LEDGER.bp;
  $('smPLedger').innerHTML=`<div><span>연 개수</span><b>${LEDGER.n}개</b></div><div><span>쓴 FC</span><b>${LEDGER.fc?LEDGER.fc.toLocaleString()+' FC':'-'}</b></div>
   <div><span>BP 카드</span><b>${won(LEDGER.bp)}</b></div><div><span>선수 시세 합계</span><b>${won(LEDGER.pv)}</b></div>
   <div><span>판매 수수료율</span><b>${(fr*100).toFixed(1)}%</b></div><div><span>선수 판매 실수령</span><b>${won(LEDGER.pv*(1-fr))}</b></div>
   <div class="big"><span>총 실수령 BP</span><b>${won(net)}</b></div>${LEDGER.fc?`<div class="big"><span>1,000 FC당</span><b>${won(net/LEDGER.fc*1000)}</b></div>`:''}
   ${LEDGER.best?`<div class="wide"><span>최고 대박</span><b>${H(LEDGER.best.pl.name)} ${LEDGER.best.pl.g}강 · ${fmtBP(LEDGER.best.pl.v)}</b></div>`:''}`;
  $('smPHist').innerHTML=LEDGER.hist.map(r=>`<li class="${r.prob<0.01?'rare':''}">${r.kind==='pl'&&r.pl?`${bigBadge(r.pl.sid)} <b>${H(r.pl.name)}</b> ${r.pl.g}강 <em>${fmtBP(r.pl.v)}</em>`:`<b>${H(r.label)}</b>`}</li>`).join('');
}
onFee.push(renderLedger);
$('smPClear').onclick=()=>{if(LEDGER){LEDGER={n:0,fc:0,bp:0,pv:0,best:null,hist:[]};$('smPReveal').innerHTML='';renderLedger()}};

/* 확률표 · 고급 검색 */
const fmtP=p=>p>=1?p.toFixed(2)+'%':p>=0.01?p.toFixed(3)+'%':p.toFixed(6).replace(/0+$/,'')+'%';
function renderTable(it){
  if(!it){$('smPTable').innerHTML='';return}
  $('smPTable').innerHTML=`<p class="sim-note">${H(it.name)} · ${it.rows.length}개 항목</p><table><thead><tr><th>아이템</th><th class="n">개수</th><th class="n">확률</th></tr></thead><tbody>${it.rows.map(r=>`<tr${r.p<1?' class="rare"':''}><td>${H(r.n.replace(/개봉일 0~1시 사이 /,''))}${findItem(r.n)?' <em>팩</em>':''}</td><td class="n">${H(r.amt)}</td><td class="n">${fmtP(r.p)}</td></tr>`).join('')}</tbody></table>`;
}
$('smPQ').addEventListener('input',()=>{if(!LIST)return;const q=$('smPQ').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  $('smPQres').innerHTML=q.length?LIST.filter(x=>q.every(w=>x.name.toLowerCase().includes(w))).slice(0,30).map(x=>`<button type="button" class="sim-pack mini" data-sn="${x.sn}"><b>${H(x.name)}</b></button>`).join(''):''});

/* ================= 현질 효율: 확률표 기댓값 ================= */
/* 기댓값은 {bp: BP 카드 합, pv: 선수 시세 합(수수료 전), miss: 값을 못 매긴 확률} 로 따로 모아 두고, 수수료는 그릴 때 적용해요. */
const EVC={};
function rowPlayerVal(rank,packName,rowName){
  const R=packRule(packName,rowName);if(!R||!POOL)return null;
  const L=poolPairs(R);if(!L.length)return null;return L[Math.min(L.length-1,rank-1)][0];
}
function evItem(item,depth=1){
  const key=item.sn+'|'+(POOL?3:0);if(EVC[key])return EVC[key];
  return EVC[key]=(async()=>{
    const tot=item.rows.reduce((a,r)=>a+r.p,0)||100;const acc={bp:0,pv:0,miss:0};
    for(const r of item.rows){
      const w=r.p/tot,amt=amtOf(r.amt);
      const sub=depth<4&&findItem(r.n);
      // 상자 속 상자도 개수만큼 곱해요 (예: 행운의 BP 카드 x80)
      if(sub&&sub.sn!==item.sn){try{const e=await evItem(await getItem(sub.sn),depth+1);acc.bp+=w*amt*e.bp;acc.pv+=w*amt*e.pv;acc.miss+=w*e.miss;continue}catch(_){acc.miss+=w;continue}}
      const bp=bpOf(r.n,item.name);if(bp){acc.bp+=w*amt*bp;continue}
      const tm=r.n.match(/TOP\s*([\d,]+)/i);
      if(tm){const v=rowPlayerVal(+tm[1].replace(/,/g,''),item.name,r.n);if(v!=null){acc.pv+=w*amt*v;continue}}
      acc.miss+=w;
    }
    return acc;
  })();
}
let cashRows=null,cashBusy=false;
async function cashRun(){
  if(cashRows){cashRender();return}
  if(cashBusy)return;cashBusy=true;
  try{
    $('cashSrc').textContent='상점·확률표 불러오는 중…';
    await Promise.all([loadShelf(),loadPool()]);
    const rows=[];let i=0;
    for(const s of SHOP){
      i++;$('cashSrc').textContent=`계산 중… ${i}/${SHOP.length}`;
      const fc=fcOf(s.price);const row={s,fc,bp:0,pv:0,miss:0,skip:[],ok:false};
      try{
        const it=findItem(s.name);
        if(it){const e=await evItem(await getItem(it.sn));Object.assign(row,{bp:e.bp,pv:e.pv,miss:e.miss,ok:true})}
        else{const parts=await getParts(s.pid);
          for(const p of parts){if(!p.it){row.skip.push(p.name);continue}const e=await evItem(await getItem(p.it.sn));row.bp+=p.count*e.bp;row.pv+=p.count*e.pv;row.miss=Math.max(row.miss,e.miss);row.ok=true}}
      }catch(e){row.err=e.message}
      rows.push(row);
    }
    cashRows=rows;cashRender();
  }catch(e){$('cashSrc').textContent='불러오지 못했어요: '+e.message}
  cashBusy=false;
}
function cashRender(){
  if(!cashRows)return;
  const fee=feeRate(),rs=cashRows.map(r=>({...r,net:r.bp+r.pv*(1-fee)})).map(r=>({...r,per:r.fc?r.net/r.fc*1000:0}));
  rs.sort((a,b)=>(b.ok-a.ok)||(b.per-a.per));
  const max=Math.max(1,...rs.map(r=>r.per));
  $('cashSrc').textContent=`웹 상점 ${rs.length}개 상품 · 수수료 ${(fee*100).toFixed(1).replace(/\.0$/,'')}% 적용${POOL?'':' · 선수 시세 풀 준비 중이라 선수 가치는 0으로 계산했어요'}`;
  $('cashOut').innerHTML=rs.map((r,i)=>`<button type="button" class="cash-row${r.ok?'':' off'}" data-pid="${r.s.pid}">
    <span class="cr-rank">${r.ok?i+1:'-'}</span><img src="${H(r.s.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
    <span class="cr-name"><b>${H(r.s.name)}</b><small>${H(r.s.price)}${r.skip.length?` · 제외: ${H(r.skip.join(', '))}`:''}${r.miss>0.005?` · 값 모름 ${(r.miss*100).toFixed(1)}%`:''}${r.err?' · '+H(r.err):''}</small></span>
    <span class="cr-val"><b>${r.ok?won(r.per):'-'}</b><small>1,000 FC당</small></span>
    <span class="cr-one"><b>${r.ok?won(r.net):'-'}</b><small>1회 기대 BP</small></span>
    <span class="er-meter" aria-hidden="true"><i style="width:${r.ok?Math.max(3,r.per/max*100):0}%"></i></span>
  </button>`).join('');
}
onFee.push(cashRender);
$('cashOut').addEventListener('click',e=>{const b=e.target.closest('[data-pid]');if(!b||b.classList.contains('off'))return;setTab('pack');loadShelf().then(()=>{const t=document.querySelector(`#smPShelf .sim-pack[data-pid="${b.dataset.pid}"]`);if(t)t.click()})});

/* 시작 탭: #enh·#pack·#cash (맨 끝에서 호출 — 위에서 부르면 아직 선언 전인 변수에 닿아 멈춰요) */
feeChanged();
const startTab=location.hash.replace('#','');
function boot(){if(PANELS[startTab])setTab(startTab);else if(!$('v-sim').hidden)effInit()}
boot();
document.addEventListener('fg:view',e=>{if(e.detail==='sim'&&!$('simEff').hidden)effInit()});
})();
