
/* Server-authoritative XP and game turns. */
(()=>{"use strict";
const G={penalty:["승부차기 챌린지","⚽","움직이는 골키퍼를 피해 슈팅"],player:["선수 맞히기","👤","국적·기록 힌트로 선수 찾기"],price:["시세 맞히기","📈","두 카드 중 더 비싼 카드 찾기"],lifting:["리프팅 챌린지","🏟️","정확한 타이밍에 공 터치"]};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bp=v=>{let n=Math.round(v),a=[];for(const [d,l] of [[1e12,"조"],[1e8,"억"],[1e4,"만"]]){let x=Math.floor(n/d);if(x)a.push(x.toLocaleString("ko-KR")+l);n%=d}return a.join(" ")||n.toLocaleString("ko-KR")+" BP"};
async function request(path,body){const start=Date.now(),r=await fetch("/api/community/"+path,{credentials:"same-origin",cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});const d=await r.json().catch(()=>({}));if(!r.ok){const e=Error(d.message||"연결을 확인해 주세요.");e.status=r.status;throw e}d.rtt=Date.now()-start;return d}
function mount(app,layout){
 let alive=true,busy=false,status=null,round=null,raf=0;
 const $=id=>app.querySelector("#"+id);
 const render=html=>{if(!alive)return;cancelAnimationFrame(raf);app.innerHTML='<section class="arcade">'+html+'</section>';layout()};
 const update=d=>{if(!alive)return;status=d;if(d.member)document.dispatchEvent(new CustomEvent("fg:member",{detail:d.member}))};
 const error=e=>{if($("arcError"))$("arcError").textContent=e.message};
 const controls=disabled=>app.querySelectorAll("button").forEach(b=>b.disabled=disabled);
 const err='<p id="arcError" class="arc-error" role="status"></p>';
 function home(){
  if(!alive||!status)return;
  const d=status,points=d.member.rank.points,fee=d.fee===0?"무료":"2 XP",disabled=d.used>=d.limit||d.fee>points;
  round=null;
  render('<section class="hub-hero"><h1>미니게임</h1><p>축구 실력으로 XP를 모아 고양이를 성장시켜 보세요.</p></section><div class="arc-summary"><div><small>보유 XP</small><div class="arc-xp">'+points.toLocaleString("ko-KR")+' XP</div></div><div><small>오늘 '+d.used+'/'+d.limit+'판</small><br><b>다음 참가 '+fee+'</b></div></div>'+
   (d.pending?'<button class="cta" id="arcResume">진행 중인 '+G[d.pending.game][0]+' 이어하기</button>':'')+
   '<div class="arc-grid">'+Object.entries(G).map(([id,[name,emoji,desc]])=>'<button type="button" class="arc-tile" data-game="'+id+'" '+(disabled||d.pending?'disabled':'')+'><span class="arc-emoji" aria-hidden="true">'+emoji+'</span><b>'+name+'</b><small>'+desc+'</small><em>최대 +12 XP</em></button>').join("")+'</div>'+
   '<div class="arc-panel"><h2>XP 보상</h2><p class="arc-notice">하루 첫 판 무료 · 이후 2 XP · 최대 5판<br>성공 0~4개: 개당 2 XP · 5개 성공: 12 XP<br>XP는 현금·BP로 교환할 수 없는 활동 점수입니다. 중단한 게임은 10분 이내 이어할 수 있으며 만료 시 참가비를 환급합니다(참가 횟수는 차감).</p></div>'+
   '<div class="arc-panel"><h2>주간 랭킹</h2><small>월요일~일요일 · 게임별 최고 점수</small>'+Object.entries(G).map(([id,[name]])=>{const rows=(d.leaderboard||[]).filter(r=>r.game===id);return '<details class="arc-rank"><summary>'+name+'</summary>'+(rows.length?'<ol>'+rows.map(r=>'<li>'+esc(r.nickname)+' <span>'+r.score+'/5</span></li>').join("")+'</ol>':'<p class="arc-muted">아직 기록이 없습니다.</p>')+'</details>'}).join("")+'</div>'+
   (disabled&&!d.pending?'<p class="arc-notice">'+(d.used>=d.limit?'오늘의 참가 횟수를 모두 사용했습니다.':'참가 XP가 부족합니다. 게시판 활동으로 XP를 얻을 수 있습니다.')+'</p>':'')+err);
  app.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>confirmGame(b.dataset.game));if($("arcResume"))$("arcResume").onclick=()=>play(d.pending,null,d.rtt);
 }
 function confirmGame(game){const fee=status.fee;render('<div class="arc-panel"><h1>'+G[game][0]+'</h1><p>'+G[game][2]+'</p><div class="arc-summary"><span>참가비</span><b>'+(fee?fee+" XP":"무료")+'</b></div><div class="arc-summary"><span>최고 보상</span><b class="arc-xp">12 XP</b></div><p class="arc-notice">5번 도전한 결과에 따라 XP를 받습니다. 시작하면 참가비가 차감됩니다.</p><button class="cta" id="arcStart">게임 시작</button><button class="ghost" id="arcBack">돌아가기</button>'+err+'</div>');$("arcBack").onclick=home;$("arcStart").onclick=async()=>{if(busy)return;busy=true;controls(true);try{const d=await request("game-start",{game,fee});d.leaderboard=status.leaderboard;update(d);if(alive)play(d.round,null,d.rtt)}catch(e){error(e);controls(false)}finally{busy=false}}}
 function play(r,feedback=null,rtt=0){
  if(!alive)return;round=r;if(r.state!==0){result(r);return}
  const q=r.question,game=r.game,feedbackText=feedback?(feedback.correct?"성공! ":"아쉽네요. ")+(game==="price"&&feedback.prices?feedback.prices.map(bp).join(" / "):game==="player"?"정답: "+feedback.answer:""):"";
  let answers="";
  if(game==="penalty")answers='<div class="arc-goal">'+q.choices.map((name,i)=>'<button type="button" data-answer="'+i+'"><span aria-hidden="true">🥅</span>'+name+'</button>').join("")+'</div><div class="arc-field" aria-hidden="true">⚽</div><p class="arc-muted">10초 안에 골키퍼가 없는 쪽을 누르세요.</p>';
  else if(game==="lifting"){const end=q.target+1500;answers='<div class="arc-field" aria-hidden="true">⚽</div><div class="arc-timing" aria-hidden="true"><div class="arc-target" style="left:'+((q.target-550)/end*100)+'%;width:'+(1100/end*100)+'%"></div><i class="arc-marker" id="arcMarker"></i></div><button class="cta" data-answer="0">공 터치!</button><p class="arc-muted">흰 선이 초록 구역에 들어왔을 때 터치하세요.</p>'}
  else answers='<div class="arc-answers">'+q.choices.map((x,i)=>'<button class="arc-choice" type="button" data-answer="'+i+'">'+esc(x)+'</button>').join("")+'</div>'+(game==="price"?'<p class="arc-muted">피파고수 일일 시세 스냅샷 '+esc(q.date||"")+' 기준</p>':'');
  render('<div class="arc-game-head"><b>'+G[game][0]+'</b><small>'+(r.step+1)+' / 5 · '+r.score+' 성공</small></div><div class="arc-progress"><i style="width:'+(r.step*20)+'%"></i></div><div class="arc-panel"><div class="arc-feedback" role="status">'+esc(feedbackText)+'</div><h2>'+esc(q.prompt)+'</h2>'+answers+err+'</div><button class="ghost" id="arcBack">미니게임 목록 (나중에 이어하기)</button>');
  $("arcBack").onclick=refresh;
  const origin=performance.now(),elapsed=r.serverNow-r.issued+rtt/2;
  if(game==="lifting"){const marker=$("arcMarker"),end=q.target+1500;const tick=()=>{if(!alive||!marker.isConnected)return;const p=Math.min(100,Math.max(0,(elapsed+performance.now()-origin)/end*100));marker.style.left=p+"%";if(p<100)raf=requestAnimationFrame(tick)};tick()}
  if(game==="penalty"){const bs=[...app.querySelectorAll("[data-answer]")];let last=-1;const tick=()=>{if(!alive||!bs[0].isConnected)return;const t=elapsed+performance.now()-origin,i=(q.phase+Math.floor(Math.max(0,t)/1400))%3;if(i!==last){bs.forEach((b,k)=>{b.classList.toggle("blocked",k===i);b.querySelector("span").textContent=k===i?"🧤":"🥅";b.setAttribute("aria-label",q.choices[k]+(k===i?" 골키퍼":" 빈 공간"))});last=i}if(t<10000)raf=requestAnimationFrame(tick)};tick()}
  app.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>answer(Number(b.dataset.answer)));
 }
 async function answer(a){if(busy||!round||round.state!==0)return;busy=true;controls(true);try{const d=await request("game-answer",{id:round.id,step:round.step,answer:a});d.leaderboard=status.leaderboard;update(d);if(alive)play(d.round,d.feedback,d.rtt)}catch(e){error(e);controls(false)}finally{busy=false}}
 function result(r){render('<div class="arc-panel"><h1>'+(r.state===2?"게임 만료":"게임 완료")+'</h1><div class="arc-result">'+r.score+' / 5</div><div class="arc-summary"><span>획득 XP</span><b class="arc-xp">+'+r.reward+' XP</b></div><div class="arc-summary"><span>참가비</span><b>−'+r.fee+' XP</b></div><div class="arc-summary"><span>최종 XP 변화</span><b>'+((r.reward-r.fee)>=0?"+":"")+(r.reward-r.fee)+' XP</b></div><button class="cta" id="arcDone">미니게임 목록</button></div>');$("arcDone").onclick=refresh}
 async function refresh(){if(!alive)return;render('<section class="hub-hero"><h1>미니게임</h1><p>XP와 기록을 불러오는 중…</p></section>');try{const d=await request("game-status");update(d);if(alive)home()}catch(e){render('<section class="hub-hero"><h1>미니게임</h1><p>축구 미니게임으로 XP를 모아 보세요.</p></section><div class="arc-panel"><p>'+esc(e.message)+'</p>'+(e.status===401||e.status===403?'<a class="cta" href="/mypage/">로그인 / 닉네임 설정</a>':'<button class="cta" id="arcRetry">다시 시도</button>')+'</div>');if($("arcRetry"))$("arcRetry").onclick=refresh}}
 refresh();return ()=>{alive=false;cancelAnimationFrame(raf)}
}
window.FGArcade={mount};
})();
