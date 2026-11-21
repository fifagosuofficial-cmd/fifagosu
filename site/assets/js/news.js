/* 소식(홈·/news) — 분류 탭, '3시간 전' 표시, 이벤트 D-day. 데이터는 빌드 때 HTML에 이미 들어 있어요. */
(function(){
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  // 분류 탭: data-tabs="x" 버튼 → data-list="x" 목록의 data-cat 필터
  $$('[data-tabs]').forEach(tabs=>{
    const list=document.querySelector(`[data-list="${tabs.dataset.tabs}"]`); if(!list)return;
    tabs.addEventListener('click',e=>{
      const b=e.target.closest('button[data-f]'); if(!b)return;
      $$('button',tabs).forEach(x=>x.setAttribute('aria-selected',x===b));
      const f=b.dataset.f; let n=0;
      $$(':scope > li',list).forEach(li=>{const show=f==='all'||li.dataset.cat===f;li.hidden=!show;if(show){n++;const num=li.querySelector('.nw-n');if(num)num.textContent=String(n).padStart(2,'0')}});
      let empty=list.nextElementSibling&&list.nextElementSibling.classList.contains('nw-empty')?list.nextElementSibling:null;
      if(!n){if(!empty){empty=document.createElement('p');empty.className='nw-empty cl-empty';empty.textContent='이 분류의 새 소식이 아직 없어요.';list.after(empty)}}else if(empty)empty.remove();
    });
  });
  // 상대 시간
  const now=Date.now();
  $$('time[data-rel]').forEach(t=>{
    const d=Date.parse(t.getAttribute('datetime')); if(!d)return; const m=Math.round((now-d)/60000);
    if(m<0)return; t.title=t.textContent;
    t.textContent=m<1?'방금':m<60?m+'분 전':m<1440?Math.floor(m/60)+'시간 전':Math.floor(m/1440)<7?Math.floor(m/1440)+'일 전':t.textContent;
  });
  // 이벤트 D-day·진행 막대(빌드 시점이 아니라 지금 날짜 기준)
  const day=s=>Date.parse(s+'T00:00:00+09:00'), today=day(new Date(now+9*3600e3).toISOString().slice(0,10));
  $$('.ev-list li').forEach(li=>{
    const s=day(li.dataset.start), e=day(li.dataset.end); if(!e)return;
    const left=Math.round((e-today)/864e5), el=li.querySelector('[data-dday]');
    if(el){el.textContent=left<0?'종료':left===0?'오늘 마감':'D-'+left; if(left<=3)el.classList.add('soon')}
    const bar=li.querySelector('.ev-bar i'); if(bar&&s)bar.style.width=Math.max(4,Math.min(100,(today-s)/(e-s||1)*100))+'%';
    if(left<0)li.hidden=true;
  });
  $$('[data-soonest]').forEach(el=>{const left=Math.round((day(el.dataset.soonest)-today)/864e5);if(left>=0)el.textContent='가장 빠른 마감 '+(left===0?'오늘':'D-'+left)});
})();
/* 소식 게시판(/news): 분류·검색·20개씩 페이지·24시간 새 글 표시 */
(function(){
  const body=document.getElementById('bdBody'); if(!body)return;
  const rows=[...body.children], tabs=document.getElementById('bdTabs'), q=document.getElementById('bdQ'),
        pages=document.getElementById('bdPages'), none=document.getElementById('bdNone'), PER=20;
  const now=Date.now();
  rows.forEach(r=>{const d=Date.parse(r.dataset.date);if(d&&now-d<864e5)r.querySelector('.bd-new').hidden=false});
  let cat='all', page=1;
  const valid=new Set([...tabs.querySelectorAll('button')].map(b=>b.dataset.f));
  const h=location.hash.slice(1); if(valid.has(h))cat=h;
  function draw(){
    const kw=(q.value||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hit=rows.filter(r=>(cat==='all'||r.dataset.cat===cat)&&kw.every(k=>r.dataset.q.includes(k)));
    const n=Math.max(1,Math.ceil(hit.length/PER)); page=Math.min(page,n);
    rows.forEach(r=>r.hidden=true);
    hit.forEach((r,i)=>{r.hidden=!(i>=(page-1)*PER&&i<page*PER);r.querySelector('.bd-no').textContent=hit.length-i});
    none.hidden=hit.length>0;
    tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.f===cat));
    let html='';
    if(n>1){
      const btn=(p,l,cur)=>`<button type="button" data-p="${p}"${cur?' aria-current="page"':''}>${l}</button>`;
      if(page>1)html+=btn(page-1,'‹ 이전');
      const s=Math.max(1,Math.min(page-2,n-4)), e=Math.min(n,s+4);
      for(let p=s;p<=e;p++)html+=btn(p,p,p===page);
      if(page<n)html+=btn(page+1,'다음 ›');
    }
    pages.innerHTML=html;
  }
  tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-f]');if(!b)return;cat=b.dataset.f;page=1;
    try{history.replaceState(null,'',cat==='all'?location.pathname:'#'+cat)}catch(_){}draw()});
  q.addEventListener('input',()=>{page=1;draw()});
  pages.addEventListener('click',e=>{const b=e.target.closest('button[data-p]');if(!b)return;page=+b.dataset.p;draw();
    document.querySelector('.bd-table').scrollIntoView({block:'start',behavior:'smooth'})});
  window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);cat=valid.has(h)?h:'all';page=1;draw()});
  draw();
})();
