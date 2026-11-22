/* 피파고수 시뮬 — 강화(선수 선택·능력치 반영) · 팩 오픈(웹 상점 팩, 공개 확률, 수익 계산)
   app.js 다음에 실행돼서 CARDS·cardData·bigImg·bigBadge·sch·fcCls·STAT_LABELS·GRADE_BONUS 등을 같이 써요. */
(function(){
const $=id=>document.getElementById(id);
if(!$('v-sim'))return;
const H=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const won=v=>{v=Math.round(+v||0);if(!v)return '0';const neg=v<0;v=Math.abs(v);const jo=Math.floor(v/1e12),eok=Math.floor(v%1e12/1e8),man=Math.floor(v%1e8/1e4);const p=[];if(jo)p.push(jo.toLocaleString()+'조');if(eok)p.push(eok.toLocaleString()+'억');if(man&&!jo)p.push(man.toLocaleString()+'만');return (neg?'−':'')+(p.join(' ')||v.toLocaleString())};

/* 탭 */
const tabs=document.querySelector('.sim-tabs');
function setTab(t){tabs.querySelectorAll('[data-sim]').forEach(x=>x.setAttribute('aria-selected',x.dataset.sim===t));$('simEnh').hidden=t!=='enh';$('simPack').hidden=t!=='pack';if(t==='pack')loadShelf()}
tabs.addEventListener('click',e=>{const b=e.target.closest('[data-sim]');if(b)setTab(b.dataset.sim)});

/* ================= 강화 ================= */
const SUCC=[0,100,81,64,50,26,15,7,5,4,3,2,1];
const MAX=13, ADAPT=4, tier=g=>g>=11?'백금카':g>=8?'금카':g>=5?'은카':'동카', gcls=g=>g>=11?'plat':g>=8?'gold':g>=5?'silver':'bronze';
const fill=(el,from,to,sel)=>{el.innerHTML='';for(let i=from;i<=to;i++)el.add(new Option(i+'강',i,false,i===sel))};
fill($('smEFrom'),1,12,1);fill($('smETo'),2,13,8);
let SEL=null,cur=1,tries=0,ok=0,ng=0,timer=null;
const gauge=()=>+$('smEGauge').value/100, pOf=g=>g>=MAX?0:SUCC[g]/100*gauge();

/* 선수 검색 */
$('smEQ').addEventListener('input',()=>{
  const q=$('smEQ').value.trim().toLowerCase().split(/\s+/).filter(Boolean).map(norm);const box=$('smESug');
  if(!q.length||typeof CARDS==='undefined'||!CARDS.length){box.hidden=true;return}
  const hit=[];for(const c of CARDS){const sn=norm(sname(c.sid));if(q.every(w=>c.key.includes(w)||sn.includes(w))){hit.push(c);if(hit.length>400)break}}
  hit.sort((a,b)=>((ix(b.id)||[])[0]||0)-((ix(a.id)||[])[0]||0));
  box.innerHTML=hit.slice(0,8).map(c=>{const x=ix(c.id);return `<button type="button" data-pick="${c.id}">${bigBadge(c.sid)}<b>${H(c.name)}</b>${x&&x[0]?`<em class="${fcCls(x[0])}">${x[1]||''} ${x[0]}</em>`:''}</button>`}).join('')||'<p class="sim-note">검색 결과가 없어요.</p>';
  box.hidden=false;
});
$('smESug').addEventListener('click',async e=>{const b=e.target.closest('[data-pick]');if(!b)return;$('smESug').hidden=true;
  const id=+b.dataset.pick,c=CARDS.find(x=>x.id===id);$('smEQ').value=c?c.name:'';SEL={c:c||{id,sid:Math.floor(id/1e6),name:''},l:null,d:null};drawPlayer();
  const d=await cardData(id);if(SEL&&SEL.c.id===id){SEL.l=d.l;SEL.d=d.d;reset();}});
document.addEventListener('click',e=>{if(!e.target.closest('.sim-pick'))$('smESug').hidden=true});

function drawPlayer(kind){
  const P=$('smEPlayer');if(!SEL){return}
  const {c,l,d}=SEL,b=GRADE_BONUS[cur]||0,pos=(d&&d.pos&&d.pos.length?d.pos:l&&l.pos)||[],main=pos[0];
  const price=l&&l.price?l.price[cur-1]:0;
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
function draw(msg,kind){
  $('smEGrade').textContent=cur;$('smETier').textContent=tier(cur);$('smECard').className='sim-card g-'+gcls(cur)+(kind?' fx-'+kind:'');
  $('smETry').textContent=tries;$('smEOk').textContent=ok;$('smENg').textContent=ng;
  $('smEP').textContent=cur>=MAX?'최대':(pOf(cur)*100).toFixed(pOf(cur)<.1?1:0)+'%';
  if(msg)$('smEMsg').textContent=msg;
  if(SEL)drawPlayer(kind);
}
function reset(){clearInterval(timer);timer=null;$('smEAuto').textContent='목표까지 자동';cur=+$('smEFrom').value;tries=ok=ng=0;$('smELog').innerHTML='';draw(SEL?'강화 버튼을 눌러 보세요.':'먼저 선수를 고르면 능력치까지 함께 바뀌어요.')}
function log(t,k,p){const li=document.createElement('li');li.className=k;li.innerHTML=`<b>#${tries}</b> ${t} <small>${(p*100).toFixed(p<.1?1:0)}%</small>`;$('smELog').prepend(li);while($('smELog').children.length>60)$('smELog').lastChild.remove()}
function step(){
  const to=+$('smETo').value;if(cur>=MAX||cur>=to){draw(`목표 ${to}강 달성! 총 ${tries}회 시도했어요.`,'win');return false}
  const p=pOf(cur),from=cur;tries++;
  if(Math.random()<p){cur++;ok++;log(`${from}강 → ${cur}강 성공`,'ok',p);draw(`성공! ${cur}강 ${tier(cur)}가 됐어요.`,'ok')}
  else{ng++;if($('smEFail').value==='down'&&cur>=5)cur--;log(`${from}강 → ${from+1}강 실패${cur<from?' (하락 '+cur+'강)':''}`,'ng',p);draw(cur<from?`실패… ${cur}강으로 내려갔어요.`:'실패… 단계는 그대로예요.','ng')}
  if(cur>=to){draw(`목표 ${to}강 달성! 총 ${tries}회 시도했어요.`,'win');return false}
  return true;
}
$('smEOne').onclick=()=>{clearInterval(timer);timer=null;$('smEAuto').textContent='목표까지 자동';step()};
$('smEAuto').onclick=()=>{if(timer){clearInterval(timer);timer=null;$('smEAuto').textContent='목표까지 자동';return}
  $('smEAuto').textContent='멈추기';let n=0;timer=setInterval(()=>{if(!step()||++n>5000){clearInterval(timer);timer=null;$('smEAuto').textContent='목표까지 자동'}},90)};
$('smEReset').onclick=reset;['smEFrom','smEFail'].forEach(id=>$(id).onchange=reset);
$('smETo').onchange=()=>{if(+$('smETo').value<=+$('smEFrom').value)$('smETo').value=Math.min(13,+$('smEFrom').value+1);draw()};
$('smEGauge').oninput=()=>{$('smEGaugeV').textContent=$('smEGauge').value+'%';draw()};
$('smEMany').onclick=()=>{
  const from=+$('smEFrom').value,to=+$('smETo').value,down=$('smEFail').value==='down',N=2000,cap=200000,res=[];
  for(let r=0;r<N;r++){let g=from,t=0;while(g<to&&t<cap){t++;if(Math.random()<pOf(g))g++;else if(down&&g>=5)g--}res.push(t)}
  res.sort((a,b)=>a-b);const q=x=>res[Math.min(N-1,Math.floor(x*N))],avg=res.reduce((a,b)=>a+b,0)/N;
  let exp=0;if(!down)for(let k=from;k<to;k++)exp+=1/pOf(k);
  const lucky=res.filter(t=>t<=to-from).length/N*100;
  $('smEStats').innerHTML=`<div><span>평균</span><b>${avg.toFixed(1)}회</b></div><div><span>중앙값</span><b>${q(.5)}회</b></div><div><span>운 좋은 10%</span><b>${q(.1)}회 이하</b></div><div><span>운 나쁜 10%</span><b>${q(.9)}회 이상</b></div><div><span>한 번에 성공</span><b>${lucky.toFixed(lucky<1?2:1)}%</b></div>${down?'':`<div><span>이론 기대값</span><b>${exp.toFixed(1)}회</b></div>`}`;
};
reset();

/* ================= 팩 오픈 ================= */
const PAPI=(window.FG_API||'/api');
let LIST=null, SHOP=null, POOL=null, PACK=null, CACHE={}, LEDGER=null;
const nn=s=>String(s||'').replace(/^★/,'').replace(/\s+/g,'').toLowerCase();
async function getJSON(u){const r=await fetch(u);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||('오류 '+r.status));return j}
const getItem=sn=>CACHE[sn]||(CACHE[sn]=getJSON(PAPI+'/prob?sn='+sn));
const findItem=name=>LIST&&LIST.find(x=>nn(x.name)===nn(name));
const fcOf=pr=>{const m=String(pr||'').match(/([\d,]+)\s*FC/g);if(!m)return 0;return +m[m.length-1].replace(/[^\d]/g,'')};
let shelfP=null;
function loadShelf(){
  if(shelfP)return shelfP;
  shelfP=(async()=>{
    try{const [p,s]=await Promise.all([getJSON(PAPI+'/prob'),getJSON(PAPI+'/shop').catch(e=>({items:[],err:e.message}))]);LIST=p.items;SHOP=s.items||[];
      const shopHtml=SHOP.map(x=>{const it=findItem(x.name);return `<button type="button" class="sim-pack${it?'':' off'}" ${it?`data-sn="${it.sn}" data-pid="${x.pid}"`:'disabled'}><img src="${H(x.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><b>${H(x.name)}</b><span class="pr">${H(x.price)}</span><small>${it?H(x.date):'패키지 구성품 확률은 로그인 후 공개돼요'}</small></button>`}).join('');
      $('smPShelf').innerHTML=shopHtml||`<p class="sim-note">${H(s.err||'상점 목록을 불러오지 못했어요.')}</p>`;
      const boxes=LIST.filter(x=>/크리스탈\s*\d+개\s*상자/.test(x.name)&&!/^\[/.test(x.name.replace(/^\[TM[^\]]*\]\s*/,'')));
      $('smPShelf2').innerHTML=boxes.map(x=>{const n=(x.name.match(/크리스탈\s*(\d+)개/)||[])[1]||'';return `<button type="button" class="sim-pack crystal" data-sn="${x.sn}"><span class="cr-ico">◆<i>${n}</i></span><b>${H(x.name)}</b></button>`}).join('');
      $('smPSrc').textContent=`웹 상점 ${SHOP.length}개 상품 · 넥슨 확률 공개 아이템 ${LIST.length}개`;
    }catch(e){$('smPSrc').textContent='불러오지 못했어요: '+e.message;shelfP=null}
  })();
  fetch(DATA_BASE+'/market/pool.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.items)POOL=j.items}).catch(()=>{});
  return shelfP;
}
document.getElementById('simPack').addEventListener('click',async e=>{
  const b=e.target.closest('.sim-pack[data-sn]');if(!b)return;
  document.querySelectorAll('.sim-pack').forEach(x=>x.classList.toggle('on',x===b));
  const sn=+b.dataset.sn,shopItem=SHOP&&SHOP.find(x=>String(x.pid)===b.dataset.pid);
  $('smPOpen').hidden=false;$('smPName').textContent='불러오는 중…';
  try{const it=await getItem(sn);PACK={it,shop:shopItem||null,fc:shopItem?fcOf(shopItem.price):0};}catch(err){$('smPName').textContent='불러오지 못했어요: '+err.message;return}
  $('smPImg').src=shopItem?shopItem.img:'';$('smPImg').hidden=!shopItem;
  $('smPName').textContent=PACK.it.name;$('smPMeta').textContent=[shopItem?shopItem.price:'',PACK.it.period?'기간 '+PACK.it.period:''].filter(Boolean).join(' · ');
  LEDGER={n:0,fc:0,bp:0,pv:0,best:null,hist:[]};$('smPReveal').innerHTML='';renderLedger();renderTable(PACK.it);
  $('smPOpen').scrollIntoView({behavior:'smooth',block:'start'});
});

/* 확률 뽑기 + 상자 속 팩 이어 열기 */
function pick(rows){const tot=rows.reduce((a,r)=>a+r.p,0);let x=Math.random()*tot;for(const r of rows){x-=r.p;if(x<=0)return r}return rows[rows.length-1]}
async function openChain(item,depth=1){
  const r=pick(item.rows),step={n:r.n,p:r.p,amt:r.amt,from:item.name};
  if(depth<4){const sub=findItem(r.n);if(sub&&sub.sn!==item.sn){try{const it=await getItem(sub.sn);return [step].concat(await openChain(it,depth+1))}catch(_){}}}
  return [step];
}
/* '기준가 TOP N'을 피파고수 시세 풀에서 실제 선수로 */
const POOLC={};
function packRule(name){
  const s=String(name).replace(/^★/,'').replace(/^(\[[^\]]*\]\s*)+/,'');
  const m=s.match(/^(.*?)\s*Top Price\s*([\d,]+)/i);if(!m)return null;
  const pre=m[1],inc=/포함/.test(pre),toks=pre.replace(/포함/g,'').split(/[,·]/).map(t=>t.trim()).filter(Boolean);
  const gm=s.match(/\((\d+)(?:~(\d+))?강/),om=s.match(/(\d+)\+/);
  const sids=new Set();toks.forEach(t=>Object.keys(SEASONS).forEach(id=>{if(norm(sname(+id))===norm(t))sids.add(+id)}));
  return {lo:gm?+gm[1]:1,hi:gm?+(gm[2]||gm[1]):1,min:om?+om[1]:0,only:!inc&&sids.size?sids:null,key:(!inc&&sids.size?[...sids].join('.'):'all')+'|'+(om?om[1]:0)};
}
function playerFor(rank,packName){
  if(!POOL)return null;const R=packRule(packName);if(!R)return null;
  const g=R.lo+Math.floor(Math.random()*(R.hi-R.lo+1)),k=R.key+'|'+g;
  if(!POOLC[k])POOLC[k]=POOL.filter(([id,,ovr,pr])=>pr[g-1]>0&&(!R.only||R.only.has(Math.floor(id/1e6)))&&(ovr+(GRADE_BONUS[g]||0))>=R.min).sort((a,b)=>b[3][g-1]-a[3][g-1]);
  const L=POOLC[k];if(!L.length)return null;const it=L[Math.min(L.length-1,rank-1)];
  return {id:it[0],name:it[1],sid:Math.floor(it[0]/1e6),ovr:it[2]+(GRADE_BONUS[g]||0),g,v:it[3][g-1]};
}
function resolve(chain){
  const f=chain[chain.length-1],amt=parseInt(String(f.amt).replace(/[^\d]/g,''))||1,prob=chain.reduce((a,s)=>a*s.p/100,1);
  const bm=f.n.match(/BP\s*·?\s*([\d,]{5,})/);if(bm)return {kind:'bp',bp:+bm[1].replace(/,/g,'')*amt,label:won(+bm[1].replace(/,/g,'')*amt)+' BP',prob,chain};
  const tm=f.n.match(/TOP\s*([\d,]+)/i);
  if(tm){const pl=playerFor(+tm[1].replace(/,/g,''),f.from);return {kind:'pl',pl,rank:+tm[1].replace(/,/g,''),label:f.n.replace(/개봉일 0~1시 사이 /,''),prob,chain}}
  return {kind:'etc',label:f.n,prob,chain};
}
const feeRate=()=>40*Math.max(0,1-(($('smfTop').checked?20:0)+($('smfPc').checked?30:0)+(+$('smfCoupon').value||0))/100)/100;
function cardHtml(r,i){
  const rare=r.prob<0.01||(r.kind==='pl'&&r.pl&&r.pl.v>=1e11);
  let face='';
  if(r.kind==='bp')face=`<div class="rv-bp"><span>BP</span><b>${H(r.label)}</b></div>`;
  else if(r.kind==='pl'&&r.pl)face=`<div class="rv-img">${bigImg(r.pl.id)}</div><div class="rv-badge">${bigBadge(r.pl.sid)}<span class="gchip g-${GRADE_CLS(r.pl.g)}">${r.pl.g}</span></div><b class="rv-name">${H(r.pl.name)}</b><span class="rv-v">${fmtBP(r.pl.v)}</span>`;
  else if(r.kind==='pl')face=`<b class="rv-name">${H(r.label)}</b><span class="rv-v">시세 매칭 준비 중</span>`;
  else face=`<b class="rv-name">${H(r.label)}</b>`;
  return `<div class="rv${rare?' rare':''}" style="--d:${i*0.18}s"><div class="rv-in"><div class="rv-back"></div><div class="rv-front">${face}<small class="rv-p">${(r.prob*100).toFixed(r.prob<0.0001?6:r.prob<0.01?4:2)}%</small></div></div></div>`;
}
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',async()=>{
  if(!PACK)return;const n=+b.dataset.open;document.querySelectorAll('[data-open]').forEach(x=>x.disabled=true);
  $('smPReveal').innerHTML=n<=10?`<div class="rv-pack"><img src="${H(PACK.shop?PACK.shop.img:'')}" alt=""></div>`:'<p class="sim-note">여는 중…</p>';
  const out=[];for(let i=0;i<n;i++){out.push(resolve(await openChain(PACK.it)))}
  out.forEach(r=>{LEDGER.n++;LEDGER.fc+=PACK.fc;if(r.kind==='bp')LEDGER.bp+=r.bp;if(r.kind==='pl'&&r.pl){LEDGER.pv+=r.pl.v;if(!LEDGER.best||r.pl.v>LEDGER.best.pl.v)LEDGER.best=r}LEDGER.hist.unshift(r)});
  LEDGER.hist=LEDGER.hist.slice(0,30);
  setTimeout(()=>{
    if(n<=10){$('smPReveal').innerHTML=`<div class="rv-row">${out.map(cardHtml).join('')}</div>`;}
    else{const top=[...out].sort((a,b)=>((b.pl&&b.pl.v)||b.bp||0)-((a.pl&&a.pl.v)||a.bp||0)).slice(0,10);$('smPReveal').innerHTML=`<p class="sim-note">${n}개를 열었어요. 가장 비싼 결과 10개예요.</p><div class="rv-row fast">${top.map(cardHtml).join('')}</div>`}
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
['smfTop','smfPc','smfCoupon'].forEach(id=>$(id).addEventListener('change',renderLedger));
$('smPClear').onclick=()=>{if(LEDGER){LEDGER={n:0,fc:0,bp:0,pv:0,best:null,hist:[]};$('smPReveal').innerHTML='';renderLedger()}};

/* 확률표 · 고급 검색 */
const fmtP=p=>p>=1?p.toFixed(2)+'%':p>=0.01?p.toFixed(3)+'%':p.toFixed(6).replace(/0+$/,'')+'%';
function renderTable(it){
  $('smPTable').innerHTML=`<p class="sim-note">${H(it.name)} · ${it.rows.length}개 항목</p><table><thead><tr><th>아이템</th><th class="n">개수</th><th class="n">확률</th></tr></thead><tbody>${it.rows.map(r=>`<tr${r.p<1?' class="rare"':''}><td>${H(r.n.replace(/개봉일 0~1시 사이 /,''))}${findItem(r.n)?' <em>팩</em>':''}</td><td class="n">${H(r.amt)}</td><td class="n">${fmtP(r.p)}</td></tr>`).join('')}</tbody></table>`;
}
$('smPQ').addEventListener('input',()=>{if(!LIST)return;const q=$('smPQ').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  $('smPQres').innerHTML=q.length?LIST.filter(x=>q.every(w=>x.name.toLowerCase().includes(w))).slice(0,30).map(x=>`<button type="button" class="sim-pack mini" data-sn="${x.sn}"><b>${H(x.name)}</b></button>`).join(''):''});
if(location.hash==='#pack')setTab('pack');   // 맨 끝에서 호출 (위에서 부르면 아직 선언 전인 변수에 닿아 멈춰요)
})();
