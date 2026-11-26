
/* Server-authoritative XP and game turns. */
(()=>{"use strict";
const G={penalty:["승부차기 챌린지","⚽","도트 경기장에서 좌·중·우 슈팅"],player:["선수 맞히기","👤","국적·기록 힌트로 선수 찾기"],price:["시세 맞히기","📈","두 카드 중 더 비싼 카드 찾기"],lifting:["리프팅 챌린지","🏟️","좌우로 움직이는 공을 발끝에서 차 올리기"]};
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
 const active=shot!==null,run=active?clamp(t/420):0,fly=active?clamp((t-440)/460):0,d=keeper===null?0:clamp((t-470)/340),side=keeper===null?0:keeper-1;
 const impact=active?Math.max(0,1-Math.abs(t-440)/65):0;
 c.save();c.translate(Math.round(impact*Math.sin(t*.3)*2),0);
 pitch(c);
 // Layered stadium lighting and grass texture.
 for(let i=0;i<90;i++){let x=(i*73)%256,y=62+(i*37)%80;rect(c,x,y,2,1,i%2?"#56a773":"#347e54")}
 for(let i=0;i<4;i++){rect(c,8+i*79,3,12,3,"#fff5cb");rect(c,10+i*79,6,8,2,"#a9c9cf")}
 const ripple=scored&&fly>=1?Math.sin((t-900)/45)*Math.max(0,1-(t-900)/400)*4:0;
 poly(c,[[83,17],[173,17],[166,24],[90,24]],"#a9c9c2");goal(c);
 if(ripple)for(let y=25;y<55;y+=6){for(let x=90;x<168;x+=7)rect(c,x+Math.round(ripple*Math.sin(y*.2)),y,2,1,"#d6e8d4")}
 const kx=128+side*32*d,ky=43-7*Math.sin(Math.PI*d);
 rect(c,kx-11,57,22,2,"#285c49");
 c.save();c.translate(Math.round(kx),Math.round(ky));if(side)c.rotate(side*d*1.1);
 person(c,0,0,{shirt:"#f7b842",keeper:true});
 if(d>0){for(const sign of [-1,1]){pixelLimb(c,sign*7,-10,sign*(12+7*d),-10-8*d,5,"#e6a139");rect(c,sign*(12+7*d)-2,-12-8*d,5,5,"#fff5df")}}
 c.restore();
 const stride=active&&run<1?Math.sin(t/48)*Math.sin(Math.PI*run):0,px=104+run*19,py=126-run*17;
 const swing=active?Math.sin(Math.PI*clamp((t-280)/330)):0;
 rect(c,px-12,py+15,26,3,"#286a45");
 c.save();c.translate(Math.round(px),Math.round(py));c.scale(1.25,1.25);
 person(c,0,-Math.abs(stride)*2,{back:true});
 for(const sign of [-1,1]){
 const hip=sign*4,knee=hip+sign*stride*5+(sign===1?swing*6:0),foot=knee+sign*stride*3+(sign===1?swing*9:0),fy=13-(sign===1?swing*10:Math.max(0,stride*sign)*3);
 pixelLimb(c,hip,3,knee,8,5,"#20283c");pixelLimb(c,hip,3,knee,8,3,"#f5f1e6");pixelLimb(c,knee,8,foot,fy,4,"#e6a76e");rect(c,foot-2,fy,6,3,"#20283c");
 pixelLimb(c,sign*7,-10,sign*(10+Math.abs(stride)*3),-4+sign*stride*4,4,"#ee5364");
 }
 c.restore();
 const end=shot===null?128:99+29*shot;
 let bx=128+(end-128)*fly,by=108-63*fly-12*Math.sin(Math.PI*fly);
 if(scored===false&&fly===1){bx=kx+side*8;by=ky-5}
 if(fly>0&&fly<1){for(let i=3;i>=1;i--){let f=Math.max(0,fly-i*.055);c.globalAlpha=.13*(4-i);pixelBall(c,128+(end-128)*f,108-63*f-12*Math.sin(Math.PI*f),3)}c.globalAlpha=1}
 rect(c,bx-4,108-51*fly,8,2,"#286a45");pixelBall(c,bx,by,Math.max(2,Math.round(5-2*fly)));
 if(impact>0)for(let i=0;i<8;i++){let angle=i*Math.PI/4;rect(c,128+Math.cos(angle)*12,108+Math.sin(angle)*8,2,2,"#fff2a0")}
 if(scored!==null&&t>920){rect(c,79,63,98,18,"#17273d");label(c,128,76,scored?"GOAL!!":"SAVE!",scored?"#fff39d":"#ffb5a8")}
 c.restore();
}

// Articulated pixel player: moving joints, a planted supporting foot and a swinging kicking leg.
function pixelLimb(c,x1,y1,x2,y2,w,color){
 const n=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))));
 for(let i=0;i<=n;i++)rect(c,x1+(x2-x1)*i/n-w/2,y1+(y2-y1)*i/n-w/2,w,w,color);
}
function liftPose(elapsed,q,combo,pose="normal",pressed=q.direction){
 const dir=q.direction===0?-1:1,prev=q.fromDirection===0?-1:1,side=pressed===0?-1:1;
 const target=q.target,window=q.window,p=clamp(elapsed/target),smooth=p*p*(3-2*p);
 const start=combo?q.fromX-prev*23:128,end=q.landX-dir*23,move=clamp(p/.86);
 const travel=move*move*(3-2*move),playerX=start+(end-start)*travel;
 const walk=p>0&&p<.86?Math.sin(elapsed/64)*Math.sin(Math.PI*move):0;
 let x=q.fromX+(q.landX-q.fromX)*smooth,y=106;
 if(elapsed>=0){
  const arc=combo?Math.pow(Math.sin(Math.PI*p),1.5):1-p*p;
  y=106-q.height*arc;
  if(elapsed>target)y=106+Math.min(24,(elapsed-target)*24/window);
 }else if(!combo)y=106-q.height;
 const contact=Math.abs(elapsed-target)<=window&&elapsed>=0&&p>.64;
 const anticip=clamp((p-.7)/.3);
 let kick=0,kickSide=dir;
 if(elapsed<0&&combo){kick=clamp((-elapsed)/(q.tier==="HYPER"?85:q.tier==="EXPERT"?150:260));kickSide=prev}
 if(pose==="tap"){kick=1;kickSide=side}
 if(pose==="miss"){kick=0;y=131}
 return {x,y,playerX,walk,anticip,kick,kickSide,contact,dir,p,miss:pose==="miss"};
}
function liftPlayer(c,x,walk,anticip,kick,dir){
 const px=Math.round(x),bob=Math.round(Math.abs(walk)*3),bend=Math.round(anticip*(1-kick)*3),hipY=105+bend-bob,lean=Math.round(dir*(kick*3+anticip*2+walk*2)),bodyX=px+lean,bodyY=hipY-19;
 const dark="#1a2738",skin="#e8ab75",highlight="#ffdbac",hair="#553541",shirt="#6db8ec",shirtDark="#3975bd",shorts="#e9f1f8",sock="#4085c9",boot="#223242";
 const shoulderY=bodyY+3,headY=bodyY-18,shadowX=px-16;
 rect(c,shadowX,132,33,3,"#286a45");rect(c,shadowX+4,131,25,1,"#286a45");
 for(const side of [-1,1]){
  const sx=bodyX+side*10,sy=shoulderY,ex=sx+side*(4+Math.round(kick*4)),ey=sy+9+Math.round(walk*side*5)-Math.round(kick*4),hx=ex+side*2,hy=ey+7-Math.round(kick*5);
  pixelLimb(c,sx,sy,ex,ey,7,dark);pixelLimb(c,sx,sy,ex,ey,5,shirtDark);pixelLimb(c,ex,ey,hx,hy,5,dark);pixelLimb(c,ex,ey,hx,hy,3,skin);rect(c,hx-2,hy-2,5,5,highlight);
 }
 rect(c,bodyX-11,headY,22,19,dark);rect(c,bodyX-9,headY+2,18,15,skin);rect(c,bodyX-9,headY+1,18,6,hair);rect(c,bodyX-11,headY+4,5,7,hair);rect(c,bodyX+7,headY+4,4,6,hair);rect(c,bodyX-7,headY+7,14,3,highlight);
 rect(c,bodyX-5,headY+10,3,3,dark);rect(c,bodyX+3,headY+10,3,3,dark);rect(c,bodyX-2,headY+15,4,1,"#975340");
 rect(c,bodyX-4,bodyY-2,8,4,skin);rect(c,bodyX-12,bodyY,24,19,dark);rect(c,bodyX-10,bodyY+2,20,15,shirt);rect(c,bodyX-10,bodyY+2,20,3,shirtDark);rect(c,bodyX-8,bodyY+6,3,10,"#91d5f4");rect(c,bodyX+4,bodyY+7,5,5,"#f7f2e2");rect(c,bodyX+5,bodyY+8,3,3,shirtDark);
 for(const side of [-1,1]){
  const sx=px+side*6,sy=hipY,active=side===dir?kick:0;
  const stride=Math.round(walk*side*8),ax=px+side*9+stride*(1-active)+side*12*active,ay=126-15*active-Math.max(0,Math.round(walk*side*5))*(1-active);
  const kx=sx+side*(4+5*active)+stride*.45,ky=hipY+10-8*active;
  pixelLimb(c,sx,sy,kx,ky,9,dark);pixelLimb(c,sx,sy,kx,ky,6,shorts);pixelLimb(c,kx,ky,ax,ay-3,7,dark);pixelLimb(c,kx,ky,ax,ay-3,5,skin);pixelLimb(c,kx+(ax-kx)*.55,ky+(ay-3-ky)*.55,ax,ay-3,5,sock);
  const toe=active?px+side*23:ax+side*3,bootX=Math.min(ax-3,toe-3),bootW=Math.abs(toe-ax)+7;
  rect(c,bootX,ay,bootW,5,boot);rect(c,bootX+1,ay+1,Math.max(2,bootW-2),1,"#d7e8f2");
 }
 rect(c,px-10,hipY-2,20,7,dark);rect(c,px-8,hipY-1,16,5,shorts);
}
function liftFrame(c,elapsed,q,combo,pose="normal",pressed=q.direction){
 crowd(c);rect(c,0,44,256,100,"#388b5e");for(let i=0;i<5;i++)rect(c,0,44+i*20,256,10,"#419967");rect(c,0,129,256,2,"#e4f3db");rect(c,0,131,256,13,"#367b55");
 const v=liftPose(elapsed,q,combo,pose,pressed);
 rect(c,v.x-7,130,14,2,"#245d47");liftPlayer(c,v.playerX,v.walk,v.anticip,v.kick,v.kickSide);
 if(v.contact&&!v.miss){rect(c,q.landX-8,114,17,2,"#d7ed9b");rect(c,q.landX-5,117,11,1,"#f2cf67")}
 if(pose==="tap")for(let i=0;i<4;i++){const dx=(i%2?1:-1)*(9+i*2);rect(c,q.landX+dx,100-i*2,3,3,"#fff39a")}
 pixelBall(c,v.x,v.y,5);
 label(c,128,15,"COMBO "+combo,combo?"#fff39d":"#fff6da");label(c,128,30,q.tier||"ROOKIE",q.tier==="HYPER"?"#ff9c79":q.tier==="EXPERT"?"#fff39d":"#e5f5dc");
 if(v.miss)label(c,128,56,"MISS!","#ffb5a8");
}
function pixelContext(canvas){const c=canvas.getContext("2d");c.imageSmoothingEnabled=false;return c}

const liftReward=s=>s>=50?100:s>=30?70:s>=20?50:s>=15?35:s>=10?20:s>=5?12:s*2;
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
  const d=status,points=d.member.rank.points,practice=d.used>=d.limit||d.fee>points,fee=practice?"무료 연습":d.fee===0?"무료":"2 XP";
  round=null;
  render('<section class="hub-hero"><h1>미니게임</h1><p>축구 실력으로 XP를 모아 고양이를 성장시켜 보세요.</p></section><div class="arc-summary"><div><small>보유 XP</small><div class="arc-xp">'+points.toLocaleString("ko-KR")+' XP</div></div><div><small>오늘 XP 보상 '+d.used+'/'+d.limit+'판</small><br><b>다음 참가 '+fee+'</b></div></div>'+
   (d.pending?'<button class="cta" id="arcResume">진행 중인 '+G[d.pending.game][0]+' 이어하기</button>':'')+
   '<div class="arc-grid">'+Object.entries(G).map(([id,[name,emoji,desc]])=>'<button type="button" class="arc-tile" data-game="'+id+'" '+(d.pending?'disabled':'')+'><span class="arc-emoji" aria-hidden="true">'+emoji+'</span><b>'+name+'</b><small>'+desc+'</small><em>'+(practice?"무료 연습 · XP 없음":id==="lifting"?"최대 +100 XP":"최대 +12 XP")+'</em></button>').join("")+'</div>'+
   '<div class="arc-panel"><h2>XP 보상</h2><p class="arc-notice">하루 첫 판 무료 · 이후 2 XP · XP 보상 최대 5판<br>이후에는 무료 연습으로 무제한 플레이할 수 있습니다.<br>다른 게임: 성공 0~4개는 개당 2 XP · 5개 성공 12 XP<br>리프팅: 횟수 제한 없음 · 5/10/15/20/30/50콤보부터 12/20/35/50/70/100 XP. 4콤보 이하는 개당 2 XP.<br>XP는 현금·BP로 교환할 수 없는 활동 점수입니다. 중단한 게임은 10분 이내 이어할 수 있으며 만료 시 참가비를 환급합니다(참가 횟수는 차감).</p></div>'+
   '<div class="arc-panel"><h2>주간 랭킹</h2><small>월요일~일요일 · 게임별 최고 점수</small>'+Object.entries(G).map(([id,[name]])=>{const rows=(d.leaderboard||[]).filter(r=>r.game===id);return '<details class="arc-rank"><summary>'+name+'</summary>'+(rows.length?'<ol>'+rows.map(r=>'<li>'+esc(r.nickname)+' <span>'+r.score+(id==="lifting"?' 콤보':'/5')+'</span></li>').join("")+'</ol>':'<p class="arc-muted">아직 기록이 없습니다.</p>')+'</details>'}).join("")+'</div>'+
   (practice&&!d.pending?'<p class="arc-notice">'+(d.used>=d.limit?'오늘 XP 보상 횟수를 모두 사용했습니다.':'참가 XP가 부족합니다.')+' 무료 연습으로 계속 플레이하세요. 연습 기록은 주간 랭킹에 반영되지 않습니다.</p>':'')+err);
  app.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>confirmGame(b.dataset.game));if($("arcResume"))$("arcResume").onclick=()=>play(d.pending,null,d.rtt);
 }
 function confirmGame(game){const practice=status.used>=status.limit||status.fee>status.member.rank.points,fee=practice?0:status.fee;render('<div class="arc-panel"><h1>'+G[game][0]+'</h1><p>'+G[game][2]+'</p><div class="arc-summary"><span>참가비</span><b>'+(fee?fee+" XP":"무료")+'</b></div><div class="arc-summary"><span>최고 보상</span><b class="arc-xp">'+(practice?"보상 없음":game==="lifting"?"100 XP":"12 XP")+'</b></div><p class="arc-notice">'+(game==="lifting"?"공이 날아가는 쪽 버튼을 발끝에 닿을 때 누르세요. 횟수 제한 없이 도전! 5번째 공부터 EXPERT, 15번째부터 HYPER. 5/10/15/20/30/50콤보 보상: 12/20/35/50/70/100 XP.":"5번 도전한 결과에 따라 XP를 받습니다.")+(practice?" 무료 연습 모드에서는 XP 차감 및 지급이 없습니다.":" 시작하면 참가비가 차감됩니다.")+'</p><button class="cta" id="arcStart">'+(practice?"무료 연습 시작":"게임 시작")+'</button><button class="ghost" id="arcBack">돌아가기</button>'+err+'</div>');$("arcBack").onclick=home;$("arcStart").onclick=async()=>{if(busy)return;busy=true;controls(true);try{const d=await request("game-start",{game,fee,practice});d.leaderboard=status.leaderboard;update(d);if(alive)play(d.round,null,d.rtt)}catch(e){error(e);controls(false)}finally{busy=false}}}

 function play(r,feedback=null,rtt=0){
  if(!alive)return;round=r;if(r.state!==0){result(r);return}
  const q=r.question,game=r.game,action=game==="penalty"||game==="lifting";
  const feedbackText=feedback?(feedback.correct?"성공! ":"아쉽네요. ")+(game==="price"&&feedback.prices?feedback.prices.map(bp).join(" / "):game==="player"?"정답: "+feedback.answer:""):"";
  let answers="";
  if(game==="penalty")answers='<canvas id="arcCanvas" class="arc-pixel" width="256" height="144" role="img" aria-label="선수 뒤에서 바라보는 골대와 골키퍼"></canvas><div class="arc-shot-controls">'+q.choices.map((name,i)=>'<button type="button" data-answer="'+i+'"><span aria-hidden="true">'+["↖","↑","↗"][i]+'</span>'+name+'</button>').join("")+'</div><p class="arc-muted">방향을 고르면 선수가 슛합니다. 골키퍼의 방향은 매번 무작위입니다.</p>';
  else if(game==="lifting")answers='<canvas id="arcCanvas" class="arc-pixel" width="256" height="144" role="img" aria-label="축구공을 차 올리는 도트 선수"></canvas><div class="arc-lift-controls"><button type="button" class="arc-lift-button" data-answer="0">◀ 왼쪽</button><button type="button" class="arc-lift-button" data-answer="1">오른쪽 ▶</button></div><p class="arc-muted">공이 날아가는 쪽의 버튼을 발끝에 닿을 때 누르세요. 방향이나 타이밍을 놓치면 종료!</p>';
  else answers='<div class="arc-answers">'+q.choices.map((x,i)=>'<button class="arc-choice" type="button" data-answer="'+i+'">'+esc(x)+'</button>').join("")+'</div>'+(game==="price"?'<p class="arc-muted">피파고수 일일 시세 스냅샷 '+esc(q.date||"")+' 기준</p>':'');
  render('<div class="arc-game-head"><b>'+G[game][0]+(r.practice?" · 연습":"")+'</b><small>'+(game==="lifting"?r.score+' 콤보 · '+esc(q.tier):(r.step+1)+' / 5 · '+r.score+' 성공')+'</small></div>'+(game==="lifting"?'<div class="arc-lift-record"><span>기록 도전 · 무제한</span><b>'+ (r.practice?"연습 모드":'현재 보상 '+liftReward(r.score)+' XP')+'</b></div>':'<div class="arc-progress"><i style="width:'+r.step*20+'%"></i></div>')+'<div class="arc-panel'+(action?' arc-pixel-panel':'')+'"><div class="arc-feedback" id="arcFeedback" role="status">'+esc(feedbackText)+'</div><h2>'+esc(q.prompt)+'</h2>'+answers+err+'</div><button class="ghost" id="arcBack">미니게임 목록 (나중에 이어하기)</button>');
  $("arcBack").onclick=refresh;
  scene=null;
  if(action){
    const canvas=$("arcCanvas"),c=pixelContext(canvas),origin=performance.now(),elapsed=r.serverNow-r.issued+(game==="lifting"?Math.min(250,rtt):rtt/2);
    scene={canvas,c,q,r,elapsed:()=>elapsed+performance.now()-origin};
    if(game==="penalty")penaltyFrame(c);
    else{
      const tick=()=>{if(!alive||!canvas.isConnected||busy)return;const t=scene.elapsed();liftFrame(c,t,q,r.score);if(t>q.target+q.window+120){if(!scene.autoSubmitted){scene.autoSubmitted=true;void answer(2)}return}raf=requestAnimationFrame(tick)};scene.tick=tick;raf=requestAnimationFrame(tick);
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
    if(view&&prior.game==="lifting")liftFrame(view.c,view.elapsed(),view.q,prior.score,a===2?"miss":"tap",a);
    const d=await pending;d.leaderboard=status.leaderboard;update(d);if(!alive)return;
    if(view&&prior.game==="penalty"&&d.feedback){
      await animate(t=>penaltyFrame(view.c,t,a,d.feedback.keeper,d.feedback.correct),1400);
      if(alive)play({...d.round,serverNow:d.round.serverNow+1400},d.feedback,0);
    }else if(view&&prior.game==="lifting"&&d.feedback&&!d.feedback.correct){
      liftFrame(view.c,view.q.target+400,view.q,prior.score,"miss",a);
      if($("arcFeedback"))$("arcFeedback").textContent=a!==2&&a!==view.q.direction?"방향이 틀렸습니다!":"타이밍을 놓쳤습니다!";
      await animate(()=>{},650);if(alive)result(d.round);
    }else if(alive){
      // Schedule the next bounce using the authoritative server timestamp; never trust a client score.
      busy=false;play(d.round,d.feedback,d.rtt);
    }
  }catch(e){if(!alive)return;error(e);controls(false);busy=false;if(view&&prior.game==="lifting"&&a!==2){raf=requestAnimationFrame(view.tick)}}
  finally{busy=false}
 }
 function result(r){render('<div class="arc-panel"><h1>'+(r.state===2?"게임 만료":r.practice?"연습 완료":"게임 완료")+'</h1><div class="arc-result">'+r.score+(r.game==="lifting"?' 콤보':' / 5')+'</div><div class="arc-summary"><span>획득 XP</span><b class="arc-xp">+'+r.reward+' XP</b></div><div class="arc-summary"><span>참가비</span><b>−'+r.fee+' XP</b></div><div class="arc-summary"><span>최종 XP 변화</span><b>'+((r.reward-r.fee)>=0?"+":"")+(r.reward-r.fee)+' XP</b></div><button class="cta" id="arcReplay">다시 도전</button><button class="ghost" id="arcDone">미니게임 목록</button></div>');$("arcDone").onclick=refresh;$("arcReplay").onclick=()=>confirmGame(r.game)}
 async function refresh(){if(!alive)return;render('<section class="hub-hero"><h1>미니게임</h1><p>XP와 기록을 불러오는 중…</p></section>');try{const d=await request("game-status");update(d);if(alive)home()}catch(e){render('<section class="hub-hero"><h1>미니게임</h1><p>축구 미니게임으로 XP를 모아 보세요.</p></section><div class="arc-panel"><p>'+esc(e.message)+'</p>'+(e.status===401||e.status===403?'<a class="cta" href="/mypage/">로그인 / 닉네임 설정</a>':'<button class="cta" id="arcRetry">다시 시도</button>')+'</div>');if($("arcRetry"))$("arcRetry").onclick=refresh}}
 refresh();return ()=>{alive=false;cancelAnimationFrame(raf)}
}
window.FGArcade={mount};
})();
