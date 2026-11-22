/* 피파고수 선수 거래소 — 선수 검색·선택 → 팝니다/삽니다 희망가 글쓰기, 목록에 피파고수 시세 비교
   app.js 다음에 실행돼서 CARDS·ix·cardData·bigImg·bigBadge·sname·norm·fcCls·fmtBP·GRADE_BONUS·GRADE_CLS를 같이 써요. */
(function(){
const $=id=>document.getElementById(id);
if(!$('v-trade'))return;
const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const API=(window.FG_API||'/api')+'/trade';
const won=v=>{v=Math.round(+v||0);if(!v)return '0';const jo=Math.floor(v/1e12),eok=Math.floor(v%1e12/1e8),man=Math.floor(v%1e8/1e4);const p=[];if(jo)p.push(jo.toLocaleString()+'조');if(eok)p.push(eok.toLocaleString()+'억');if(man&&!jo)p.push(man.toLocaleString()+'만');return p.join(' ')||v.toLocaleString()};
const ago=t=>{const s=Math.max(0,Date.now()/1000-t);return s<60?'방금':s<3600?Math.floor(s/60)+'분 전':s<86400?Math.floor(s/3600)+'시간 전':Math.floor(s/86400)+'일 전'};
const gchip=g=>`<span class="gchip g-${GRADE_CLS(g)}">${g}</span>`;
const PRICES={};   // spid → 1~13강 시세 (list 샤드)
async function priceOf(spid,g){if(!(spid in PRICES)){try{const d=await cardData(spid);PRICES[spid]=d&&d.l&&d.l.price||null}catch(e){PRICES[spid]=null}}const p=PRICES[spid];return p?(p[g-1]||0):0}

/* ---------- 글쓰기 ---------- */
let PICK=null;
$('trGrade').innerHTML=Array.from({length:13},(_,i)=>`<option value="${i+1}">${i+1}강</option>`).join('');
$('trWriteBtn').onclick=()=>{$('trForm').hidden=!$('trForm').hidden;if(!$('trForm').hidden){$('trQ').focus();$('trForm').scrollIntoView({behavior:'smooth',block:'start'})}};
$('trCancel').onclick=()=>{$('trForm').hidden=true};
const kind=()=>(document.querySelector('input[name=trKind]:checked')||{}).value||'sell';
document.querySelectorAll('input[name=trKind]').forEach(r=>r.addEventListener('change',()=>{$('trPriceLbl').textContent=kind()==='sell'?'판매희망가':'구매희망가';cmp()}));
$('trQ').addEventListener('input',()=>{
  const q=$('trQ').value.trim().toLowerCase().split(/\s+/).filter(Boolean).map(norm),box=$('trSug');
  if(!q.length||typeof CARDS==='undefined'||!CARDS.length){box.hidden=true;return}
  const hit=[];for(const c of CARDS){const sn=norm(sname(c.sid));if(q.every(w=>c.key.includes(w)||sn.includes(w))){hit.push(c);if(hit.length>400)break}}
  hit.sort((a,b)=>((ix(b.id)||[])[0]||0)-((ix(a.id)||[])[0]||0));
  box.innerHTML=hit.slice(0,8).map(c=>{const x=ix(c.id);return `<button type="button" data-pick="${c.id}">${bigBadge(c.sid)}<b>${H(c.name)}</b><small>${H(sname(c.sid))}</small>${x&&x[0]?`<em class="${fcCls(x[0])}">${H(x[1]||'')} ${x[0]}</em>`:''}</button>`}).join('')||'<p class="sim-note">검색 결과가 없어요.</p>';
  box.hidden=false;
});
$('trSug').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;$('trSug').hidden=true;
  const id=+b.dataset.pick,c=CARDS.find(x=>x.id===id);PICK={id,name:c?c.name:'',sid:Math.floor(id/1e6)};$('trQ').value='';drawPick();});
document.addEventListener('click',e=>{if(!e.target.closest('#trForm .sim-pick'))$('trSug').hidden=true});
async function drawPick(){
  if(!PICK){$('trPicked').innerHTML='<p class="sim-note">선수를 검색해서 골라 주세요.</p>';return}
  const x=ix(PICK.id);
  $('trPicked').innerHTML=`<div class="tr-pc"><span class="er-img">${bigImg(PICK.id)}</span><span class="tr-pn">${bigBadge(PICK.sid)}<b>${H(PICK.name)}</b>${x&&x[0]?`<em class="${fcCls(x[0])}">${H(x[1]||'')} ${x[0]}</em>`:''}</span><button type="button" class="ghost tr-x" id="trUnpick" aria-label="선수 다시 고르기">다시 고르기</button></div>`;
  $('trUnpick').onclick=()=>{PICK=null;drawPick();cmp();$('trQ').focus()};
  cmp();
}
const priceIn=()=>Math.max(0,+$('trEok').value||0)*1e8+Math.max(0,Math.min(9999,+$('trMan').value||0))*1e4;
async function cmp(){
  const el=$('trCmp');if(!PICK){el.textContent='';return}
  const g=+$('trGrade').value,m=await priceOf(PICK.id,g),p=priceIn();
  if(!m){el.textContent=`${g}강 시세 정보가 아직 없어요.`;return}
  const d=p?((p-m)/m*100):0;
  el.innerHTML=`피파고수 ${g}강 시세 <b>${won(m)}</b>${p?` · 내 희망가는 시세보다 <b class="${d>0?'up':d<0?'dn':''}">${d>0?'+':''}${d.toFixed(1)}%</b>`:''}`;
}
['trGrade','trEok','trMan'].forEach(id=>$(id).addEventListener('input',cmp));
$('trSubmit').onclick=async()=>{
  const msg=$('trMsg');
  const body={action:'create',kind:kind(),spid:PICK&&PICK.id,pname:PICK&&PICK.name,grade:+$('trGrade').value,price:priceIn(),nick:$('trNick').value.trim(),body:$('trBody').value,pw:$('trPw').value,hp:$('trHp').value};
  if(!PICK){msg.textContent='선수를 먼저 골라 주세요.';return}
  if(body.price<1e4){msg.textContent=(kind()==='sell'?'판매':'구매')+'희망가를 적어 주세요.';return}
  if(body.nick.length<2){msg.textContent='구단주 닉네임을 적어 주세요.';return}
  if(body.pw.length<4){msg.textContent='비밀번호를 4자 이상 적어 주세요.';return}
  $('trSubmit').disabled=true;msg.textContent='올리는 중…';
  try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.message||('오류 '+r.status));
    msg.textContent='올렸어요!';try{localStorage.setItem('fg_trade_nick',body.nick)}catch(e){}
    PICK=null;drawPick();$('trEok').value=$('trMan').value=$('trBody').value=$('trPw').value='';
    setTimeout(()=>{$('trForm').hidden=true;msg.textContent=''},900);
    reload();
  }catch(e){msg.textContent=e.message}
  $('trSubmit').disabled=false;
};
try{const n=localStorage.getItem('fg_trade_nick');if(n)$('trNick').value=n}catch(e){}

/* ---------- 목록 ---------- */
let F={kind:'',q:'',open:true},ITEMS=[],MORE=false,loading=false,started=false,qT=null;
$('trSeg').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;F.kind=b.dataset.k;$('trSeg').querySelectorAll('[data-k]').forEach(x=>x.setAttribute('aria-selected',x===b));reload()});
$('trFind').addEventListener('input',()=>{clearTimeout(qT);qT=setTimeout(()=>{F.q=$('trFind').value.trim();reload()},300)});
$('trOpenOnly').addEventListener('change',()=>{F.open=$('trOpenOnly').checked;reload()});
$('trMore').onclick=()=>load(true);
function reload(){ITEMS=[];load(false)}
async function load(more){
  if(loading)return;loading=true;$('trMore').hidden=true;if(!more)$('trList').innerHTML='<p class="sim-note">불러오는 중…</p>';
  const u=new URLSearchParams();if(F.kind)u.set('kind',F.kind);if(F.q)u.set('q',F.q);if(F.open)u.set('open','1');if(more&&ITEMS.length)u.set('before',ITEMS[ITEMS.length-1].id);
  try{const r=await fetch(API+'?'+u);const j=await r.json().catch(()=>({}));
    if(!r.ok){if(j.code==='no_db'){$('trList').innerHTML=`<div class="tr-empty"><b>선수 거래소 오픈 준비 중이에요</b><p class="sim-note">${H(j.message)}</p></div>`;$('trWriteBtn').disabled=true;loading=false;return}throw new Error(j.message||('오류 '+r.status))}
    ITEMS=ITEMS.concat(j.items||[]);MORE=!!j.more;render();
  }catch(e){$('trList').innerHTML=`<p class="sim-note">불러오지 못했어요: ${H(e.message)}</p>`}
  loading=false;
}
function rowHtml(t){
  return `<article class="tr-row${t.status?' done':''}" data-id="${t.id}">
    <span class="tr-kd ${t.kind}">${t.kind==='sell'?'팝니다':'삽니다'}</span>
    <span class="er-img">${bigImg(t.spid)}</span>
    <span class="tr-who"><span class="tr-pn">${bigBadge(Math.floor(t.spid/1e6))}<b>${H(t.pname)}</b>${gchip(t.grade)}</span>
      <small>${H(t.nick)} · ${ago(t.created)}${t.status?' · <b>거래 완료</b>':''}</small></span>
    <span class="tr-price"><small>${t.kind==='sell'?'판매희망가':'구매희망가'}</small><b>${won(t.price)}</b><em class="tr-vs" data-spid="${t.spid}" data-g="${t.grade}" data-p="${t.price}"></em></span>
    ${t.body?`<p class="tr-body-t">${H(t.body)}</p>`:''}
    <div class="tr-act"><button type="button" class="ghost" data-act="done">${t.status?'거래 중으로':'거래 완료'}</button><button type="button" class="ghost" data-act="delete">삭제</button>
      <span class="tr-pwbox" hidden><input type="password" maxlength="32" placeholder="비밀번호" aria-label="글 비밀번호"><button type="button" class="go" data-go>확인</button><small></small></span></div>
  </article>`;
}
function render(){
  if(!ITEMS.length){$('trList').innerHTML=`<div class="tr-empty"><b>${F.q||F.kind?'조건에 맞는 글이 없어요.':'아직 글이 없어요.'}</b><p class="sim-note">첫 글을 올려 보세요!</p></div>`;return}
  $('trList').innerHTML=ITEMS.map(rowHtml).join('');$('trMore').hidden=!MORE;
  $('trList').querySelectorAll('.tr-vs').forEach(async el=>{const m=await priceOf(+el.dataset.spid,+el.dataset.g);if(!m)return;const d=(+el.dataset.p-m)/m*100;
    el.className='tr-vs '+(Math.abs(d)<0.5?'':d>0?'up':'dn');el.textContent=`시세 ${won(m)} 대비 ${d>0?'+':''}${d.toFixed(1)}%`});
}
$('trList').addEventListener('click',async e=>{
  const row=e.target.closest('.tr-row');if(!row)return;const box=row.querySelector('.tr-pwbox');
  const a=e.target.closest('button[data-act]');
  if(a){row.dataset.pending=a.dataset.act;box.hidden=false;box.querySelector('small').textContent=a.dataset.act==='delete'?'지우려면 비밀번호':'바꾸려면 비밀번호';box.querySelector('input').focus();return}
  if(e.target.closest('[data-go]')){
    const pw=box.querySelector('input').value,act=row.dataset.pending,id=+row.dataset.id;if(!pw)return;
    box.querySelector('small').textContent='처리 중…';
    try{const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:act,id,pw})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||('오류 '+r.status));
      if(act==='delete'){ITEMS=ITEMS.filter(x=>x.id!==id)}else{const t=ITEMS.find(x=>x.id===id);if(t)t.status=j.status;if(F.open&&j.status)ITEMS=ITEMS.filter(x=>x.id!==id)}
      render();
    }catch(err){box.querySelector('small').textContent=err.message}
  }
});
$('trList').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.closest('.tr-pwbox input')){const b=e.target.closest('.tr-pwbox').querySelector('[data-go]');b.click()}});

function start(){if(started)return;started=true;reload()}
if(!$('v-trade').hidden)start();
document.addEventListener('fg:view',e=>{if(e.detail==='trade')start()});
})();
