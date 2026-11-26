
/* Server-authoritative XP and game turns. */
(()=>{"use strict";
const G={penalty:["승부차기 챌린지","⚽","도트 경기장에서 좌·중·우 슈팅"],player:["선수 맞히기","👤","국적·기록 힌트로 선수 찾기"],price:["시세 맞히기","📈","두 카드 중 더 비싼 카드 찾기"],lifting:["리프팅 챌린지","🏟️","공이 발에 닿을 때 차 올려 콤보 도전"]};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bp=v=>{let n=Math.round(v),a=[];for(const [d,l] of [[1e12,"조"],[1e8,"억"],[1e4,"만"]]){let x=Math.floor(n/d);if(x)a.push(x.toLocaleString("ko-KR")+l);n%=d}return a.join(" ")||n.toLocaleString("ko-KR")+" BP"};
async function request(path,body){const start=Date.now(),r=await fetch("/api/community/"+path,{credentials:"same-origin",cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});const d=await r.json().catch(()=>({}));if(!r.ok){const e=Error(d.message||"연결을 확인해 주세요.");e.status=r.status;throw e}d.rtt=Date.now()-start;return d}

// Original low-resolution sprites, drawn in integer pixel coordinates (no external image downloads).
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill()}
function pixelBall(c,x,y,size=4){x=Math.round(x);y=Math.round(y);const d=size;rect(c,x-d,y-d+1,d*2+1,d*2-1,"#17252d");rect(c,x-d+1,y-d,d*2-1,d*2+1,"#17252d");rect(c,x-d+1,y-d+1,d*2-1,d*2-1,"#fff8e8");rect(c,x-1,y-1,3,3,"#263945");rect(c,x-d+1,y,2,2,"#65757e");rect(c,x+1,y-d+1,2,2,"#263945")}
function person(c,x,y,{scale=1,shirt="#ee5364",back=false,kick=0,keeper=false,dive=0}={}){
 c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
 if(dive){c.rotate(dive*.98);c.translate(dive*5,-4)}
 const dark="#20283c",skin="#e6a76e",light="#ffd29a",hair="#443044",shorts=keeper?"#293c38":"#f5f1e6",trim=keeper?"#ffd15e":"#a82f4c";
 rect(c,-6,-25,12,11,dark);rect(c,-5,-24,10,10,skin);rect(c,-5,-25,10,4,hair);rect(c,-6,-23,3,5,hair);rect(c,3,-23,2,4,hair);rect(c,-4,-20,8,3,back?skin:light);
 if(!back){rect(c,-3,-20,2,2,dark);rect(c,2,-20,2,2,dark)}
 rect(c,-3,-15,6,3,skin);rect(c,-9,-13,18,12,dark);rect(c,-8,-12,16,10,shirt);rect(c,-8,-12,16,2,trim);rect(c,-6,-9,12,6,shirt);
 if(back){rect(c,-2,-10,4,5,"#fff5da");rect(c,-1,-9,2,3,shirt)}
 const arm=keeper?12:8;rect(c,-arm,-11,4,8,dark);rect(c,-arm+1,-10,3,6,shirt);rect(c,-arm,-5,3,4,keeper?"#fdf5de":skin);rect(c,arm-4,-11,4,8,dark);rect(c,arm-3,-10,3,6,shirt);rect(c,arm-3,-5,3,4,keeper?"#fdf5de":skin);
 rect(c,-7,-2,14,7,dark);rect(c,-6,-1,12,5,shorts);
 rect(c,-6,4,5,7,dark);rect(c,-5,4,3,6,skin);rect(c,-6,8,5,4,shirt);rect(c,-7,11,7,3,dark);rect(c,-7,11,5,1,"#e5eaf2");
 if(kick){rect(c,1,3,5,4,dark);rect(c,4,4,7,4,skin);rect(c,8,4,5,4,shirt);rect(c,12,3,6,5,dark);rect(c,13,3,4,1,"#f6e8d0")}
 else{rect(c,1,4,5,7,dark);rect(c,2,4,3,6,skin);rect(c,1,8,5,4,shirt);rect(c,1,11,7,3,dark);rect(c,2,11,5,1,"#e5eaf2")}
 c.restore();
}
function crowd(c,w=256){rect(c,0,0,w,17,"#17273d");rect(c,0,17,w,18,"#31455e");rect(c,0,35,w,6,"#536a76");for(let j=0;j<3;j++)for(let i=0;i<43;i++){let x=i*6+((j%2)*3),y=10+j*8;rect(c,x,y,3,3,["#d8b498","#b7d8d1","#ec7580","#7c9bb6","#eef2d4"][(i*7+j*3)%5]);rect(c,x-1,y+3,5,3,["#536d9a","#b14a62","#389a83","#e4c46a"][(i+j*2)%4])}rect(c,0,39,w,5,"#f0e5c7");for(let i=0;i<8;i++)rect(c,i*32,40,29,3,i%2?"#568fba":"#d36e72")}
function pitch(c){crowd(c);rect(c,0,44,256,100,"#398b61");for(let i=0;i<6;i++){const y=44+i*16;rect(c,0,y,256,16,i%2?"#429967":"#388b5e")}poly(c,[[90,47],[166,47],[248,143],[8,143]],"#4da86f");for(let i=0;i<4;i++){const y=56+i*23,half=38+(y-44)*.82;poly(c,[[128-half,y],[128+half,y],[128+half+9,y+9],[128-half-9,y+9]],"#469d66")}poly(c,[[79,57],[177,57],[215,105],[41,105]],"#e1f2d7");poly(c,[[81,59],[175,59],[210,103],[46,103]],"#4a9f68");poly(c,[[104,58],[152,58],[165,78],[91,78]],"#e1f2d7");poly(c,[[106,60],[150,60],[162,76],[94,76]],"#4a9f68");rect(c,125,106,6,3,"#f3f5dc")}
function goal(c){rect(c,88,20,80,35,"#1e514c");for(let x=90;x<168;x+=7)rect(c,x,21,1,33,"#60927f");for(let y=23;y<55;y+=6)rect(c,89,y,78,1,"#60927f");rect(c,83,17,90,4,"#fcf4dd");rect(c,83,20,4,38,"#e4ebda");rect(c,169,20,4,38,"#e4ebda");rect(c,86,55,84,2,"#b8d5c2")}
function label(c,x,y,text,color="#fff6da"){c.font="bold 10px monospace";c.textAlign="center";c.fillStyle="#16312a";c.fillText(text,x+1,y+1);c.fillStyle=color;c.fillText(text,x,y)}
function penaltyFrame(c,t=0,shot=null,keeper=null,scored=null){
 pitch(c);goal(c);
 const p=shot===null?0:clamp(t/650),fly=clamp((t-380)/530),dive=keeper===null?0:clamp((t-420)/300);
 const kx=128+(keeper===null?0:(keeper-1)*32*dive);
 person(c,kx,43-5*dive,{scale:1,shirt:"#f7b842",keeper:true,dive:keeper===1||keeper===null?0:(keeper-1)*dive});
 const run=clamp(p*1.7),px=112+run*10,py=123-run*14;
 rect(c,px-10,py+13,24,3,"#28764e");person(c,px,py,{scale:1.3,back:true,kick:t>300&&t<770});
 const end=shot===null?128:99+29*shot;let bx=128+(end-128)*fly,by=108+(45-108)*fly-15*Math.sin(Math.PI*fly);
 if(scored===false&&fly===1){bx=kx+8;by=52}
 pixelBall(c,bx,by,Math.max(2,Math.round(5-2*fly)));
 if(scored!==null&&t>920)label(c,128,74,scored?"GOAL!":"SAVE!",scored?"#fff39d":"#ffb5a8");
}
function liftFrame(c,elapsed,q,combo,miss=false){
 crowd(c);rect(c,0,44,256,100,"#388b5e");for(let i=0;i<5;i++)rect(c,0,44+i*20,256,10,"#419967");rect(c,0,124,256,2,"#e4f3db");rect(c,0,126,256,18,"#367b55");rect(c,105,127,61,4,"#276744");
 const target=q.target,window=q.window,foot=112,x=151;
 let progress=clamp(elapsed/target),y=foot-74*4*progress*(1-progress);
 if(combo===0)y=foot-78*(1-progress*progress);
 if(elapsed>target)y=foot+Math.min(18,(elapsed-target)/20);
 if(miss)y=132;
 const close=Math.abs(elapsed-target)<window&&!miss;
 person(c,125,110,{scale:1.6,shirt:"#69ace7",kick:close||elapsed<180&&combo>0});
 rect(c,x-8,130,16,2,"#245d47");
 if(close){rect(c,x-10,foot+7,21,2,"#fff39a");rect(c,x-7,foot+10,15,1,"#f2cf67")}
 pixelBall(c,x,y,5);
 label(c,128,58,"COMBO "+combo,combo?"#fff39d":"#fff6da");
 if(miss)label(c,128,78,"MISS!","#ffb5a8");
}
function pixelContext(canvas){const c=canvas.getContext("2d");c.imageSmoothingEnabled=false;return c}

function mount(app,layout){
 let alive=true,busy=false,status=null,round=null,raf=0,scene=null;
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
   '<div class="arc-panel"><h2>XP 보상</h2><p class="arc-notice">하루 첫 판 무료 · 이후 2 XP · 최대 5판<br>성공 0~4개: 개당 2 XP · 5개 이상 성공: 12 XP<br>리프팅은 최대 20콤보에 도전하세요.<br>XP는 현금·BP로 교환할 수 없는 활동 점수입니다. 중단한 게임은 10분 이내 이어할 수 있으며 만료 시 참가비를 환급합니다(참가 횟수는 차감).</p></div>'+
   '<div class="arc-panel"><h2>주간 랭킹</h2><small>월요일~일요일 · 게임별 최고 점수</small>'+Object.entries(G).map(([id,[name]])=>{const rows=(d.leaderboard||[]).filter(r=>r.game===id);return '<details class="arc-rank"><summary>'+name+'</summary>'+(rows.length?'<ol>'+rows.map(r=>'<li>'+esc(r.nickname)+' <span>'+r.score+(id==="lifting"?' 콤보':'/5')+'</span></li>').join("")+'</ol>':'<p class="arc-muted">아직 기록이 없습니다.</p>')+'</details>'}).join("")+'</div>'+
   (disabled&&!d.pending?'<p class="arc-notice">'+(d.used>=d.limit?'오늘의 참가 횟수를 모두 사용했습니다.':'참가 XP가 부족합니다. 게시판 활동으로 XP를 얻을 수 있습니다.')+'</p>':'')+err);
  app.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>confirmGame(b.dataset.game));if($("arcResume"))$("arcResume").onclick=()=>play(d.pending,null,d.rtt);
 }
 function confirmGame(game){const fee=status.fee;render('<div class="arc-panel"><h1>'+G[game][0]+'</h1><p>'+G[game][2]+'</p><div class="arc-summary"><span>참가비</span><b>'+(fee?fee+" XP":"무료")+'</b></div><div class="arc-summary"><span>최고 보상</span><b class="arc-xp">12 XP</b></div><p class="arc-notice">'+(game==="lifting"?"공을 연속으로 차 올리세요. 한 번 놓치면 종료되며 최대 20콤보까지 도전합니다. 5콤보 이상은 12 XP입니다.":"5번 도전한 결과에 따라 XP를 받습니다.")+' 시작하면 참가비가 차감됩니다.</p><button class="cta" id="arcStart">게임 시작</button><button class="ghost" id="arcBack">돌아가기</button>'+err+'</div>');$("arcBack").onclick=home;$("arcStart").onclick=async()=>{if(busy)return;busy=true;controls(true);try{const d=await request("game-start",{game,fee});d.leaderboard=status.leaderboard;update(d);if(alive)play(d.round,null,d.rtt)}catch(e){error(e);controls(false)}finally{busy=false}}}

 function play(r,feedback=null,rtt=0){
  if(!alive)return;round=r;if(r.state!==0){result(r);return}
  const q=r.question,game=r.game,action=game==="penalty"||game==="lifting";
  const feedbackText=feedback?(feedback.correct?"성공! ":"아쉽네요. ")+(game==="price"&&feedback.prices?feedback.prices.map(bp).join(" / "):game==="player"?"정답: "+feedback.answer:""):"";
  let answers="";
  if(game==="penalty")answers='<canvas id="arcCanvas" class="arc-pixel" width="256" height="144" role="img" aria-label="선수 뒤에서 바라보는 골대와 골키퍼"></canvas><div class="arc-shot-controls">'+q.choices.map((name,i)=>'<button type="button" data-answer="'+i+'"><span aria-hidden="true">'+["↖","↑","↗"][i]+'</span>'+name+'</button>').join("")+'</div><p class="arc-muted">방향을 고르면 선수가 슛합니다. 골키퍼의 방향은 매번 무작위입니다.</p>';
  else if(game==="lifting")answers='<canvas id="arcCanvas" class="arc-pixel" width="256" height="144" role="img" aria-label="축구공을 차 올리는 도트 선수"></canvas><button class="cta arc-lift-button" data-answer="0">⚽ 리프팅!</button><p class="arc-muted">공이 발끝에 닿을 순간 터치! 놓치면 게임 종료.</p>';
  else answers='<div class="arc-answers">'+q.choices.map((x,i)=>'<button class="arc-choice" type="button" data-answer="'+i+'">'+esc(x)+'</button>').join("")+'</div>'+(game==="price"?'<p class="arc-muted">피파고수 일일 시세 스냅샷 '+esc(q.date||"")+' 기준</p>':'');
  render('<div class="arc-game-head"><b>'+G[game][0]+'</b><small>'+(game==="lifting"?r.score+' 콤보 / 20':(r.step+1)+' / 5 · '+r.score+' 성공')+'</small></div><div class="arc-progress"><i style="width:'+(game==="lifting"?r.score*5:r.step*20)+'%"></i></div><div class="arc-panel'+(action?' arc-pixel-panel':'')+'"><div class="arc-feedback" id="arcFeedback" role="status">'+esc(feedbackText)+'</div><h2>'+esc(q.prompt)+'</h2>'+answers+err+'</div><button class="ghost" id="arcBack">미니게임 목록 (나중에 이어하기)</button>');
  $("arcBack").onclick=refresh;
  scene=null;
  if(action){
    const canvas=$("arcCanvas"),c=pixelContext(canvas),origin=performance.now(),elapsed=r.serverNow-r.issued+rtt/2;
    scene={canvas,c,q,r,elapsed:()=>elapsed+performance.now()-origin};
    if(game==="penalty")penaltyFrame(c);
    else{
      const tick=()=>{if(!alive||!canvas.isConnected||busy)return;const t=scene.elapsed();liftFrame(c,t,q,r.score);if(t>q.target+q.window+120){void answer(1);return}raf=requestAnimationFrame(tick)};scene.tick=tick;raf=requestAnimationFrame(tick);
    }
  }
  app.querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>answer(Number(b.dataset.answer)));
 }
 function animate(draw,duration){return new Promise(resolve=>{const start=performance.now();const tick=()=>{if(!alive){resolve();return}const t=Math.min(duration,performance.now()-start);draw(t);if(t>=duration)resolve();else requestAnimationFrame(tick)};tick()})}
 async function answer(a){
  if(busy||!round||round.state!==0)return;busy=true;controls(true);cancelAnimationFrame(raf);
  const prior=round,view=scene;
  try{
    const pending=request("game-answer",{id:prior.id,step:prior.step,answer:a});
    // A short anticipation pose while the server returns the hidden keeper direction.
    if(view&&prior.game==="penalty")penaltyFrame(view.c,300,a);
    if(view&&prior.game==="lifting")liftFrame(view.c,view.q.target,view.q,prior.score);
    const d=await pending;d.leaderboard=status.leaderboard;update(d);if(!alive)return;
    if(view&&prior.game==="penalty"&&d.feedback){
      await animate(t=>penaltyFrame(view.c,t,a,d.feedback.keeper,d.feedback.correct),1400);
      if(alive)play({...d.round,serverNow:d.round.serverNow+1400},d.feedback,0);
    }else if(view&&prior.game==="lifting"&&d.feedback&&!d.feedback.correct){
      liftFrame(view.c,view.q.target+400,view.q,prior.score,true);
      if($("arcFeedback"))$("arcFeedback").textContent="공을 놓쳤습니다!";
      await animate(()=>{},650);if(alive)result(d.round);
    }else if(alive){
      // Schedule the next bounce using the authoritative server timestamp; never trust a client score.
      busy=false;play(d.round,d.feedback,d.rtt);
    }
  }catch(e){if(!alive)return;error(e);controls(false);busy=false;if(view&&prior.game==="lifting"){raf=requestAnimationFrame(view.tick)}}
  finally{busy=false}
 }
 function result(r){render('<div class="arc-panel"><h1>'+(r.state===2?"게임 만료":"게임 완료")+'</h1><div class="arc-result">'+r.score+(r.game==="lifting"?' 콤보':' / 5')+'</div><div class="arc-summary"><span>획득 XP</span><b class="arc-xp">+'+r.reward+' XP</b></div><div class="arc-summary"><span>참가비</span><b>−'+r.fee+' XP</b></div><div class="arc-summary"><span>최종 XP 변화</span><b>'+((r.reward-r.fee)>=0?"+":"")+(r.reward-r.fee)+' XP</b></div><button class="cta" id="arcDone">미니게임 목록</button></div>');$("arcDone").onclick=refresh}
 async function refresh(){if(!alive)return;render('<section class="hub-hero"><h1>미니게임</h1><p>XP와 기록을 불러오는 중…</p></section>');try{const d=await request("game-status");update(d);if(alive)home()}catch(e){render('<section class="hub-hero"><h1>미니게임</h1><p>축구 미니게임으로 XP를 모아 보세요.</p></section><div class="arc-panel"><p>'+esc(e.message)+'</p>'+(e.status===401||e.status===403?'<a class="cta" href="/mypage/">로그인 / 닉네임 설정</a>':'<button class="cta" id="arcRetry">다시 시도</button>')+'</div>');if($("arcRetry"))$("arcRetry").onclick=refresh}}
 refresh();return ()=>{alive=false;cancelAnimationFrame(raf)}
}
window.FGArcade={mount};
})();
