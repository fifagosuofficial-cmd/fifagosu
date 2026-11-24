(()=>{"use strict";
const $=id=>document.getElementById(id),root=document.querySelector(".fg-community");if(!root)return;
const screen=root.dataset.screen,api="/api/community/",policy="2026-11-v1",labels={all:"전체",popular:"인기글",free:"자유게시판",squad:"스쿼드 평가",review:"선수 후기",tips:"공략·팁",pack:"강화·득템"},prefixes={normal:"일반",question:"질문",answer:"답변",notice:"공지"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=n=>new Date(n*1000).toLocaleString("ko-KR"),status=(s,bad=false)=>{$("fcStatus").textContent=s;$("fcStatus").classList.toggle("fc-error",bad)};
async function get(path){const r=await fetch(api+path,{cache:"no-store"}),j=await r.json();if(!r.ok)throw Error(j.message||"요청 실패");return j}
async function post(path,b){const r=await fetch(api+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}),j=await r.json();if(!r.ok)throw Error(j.message||"요청 실패");return j}
const act=f=>async e=>{e?.preventDefault();try{await f(e)}catch(err){status(err.message,true)}};
const delegated=(selector,f)=>async e=>{if(!e.target.closest(selector))return;return act(f)(e)};
const form=f=>Object.fromEntries(new FormData(f)),btn=(label,attr,id)=>'<button type="button" '+attr+'="'+esc(id)+'">'+esc(label)+'</button>';
let member=null,category="all",page=1,selected=0,mine=null,adminData=null,mineTab="squads",adminTab="reports",reviewCard=0;
const query=new URLSearchParams(location.search);if(Object.hasOwn(labels,query.get("category")))category=query.get("category");reviewCard=Number(query.get("card")||0);
function tabs(el,items,key){el.innerHTML=Object.entries(items).map(([k,v])=>'<button type="button" data-tab="'+k+'" aria-pressed="'+(key===k)+'">'+esc(v)+'</button>').join("")}
function recentSquad(){try{return JSON.parse(localStorage.getItem("fg-squad-v1")||"null")}catch{return null}}
function squadLink(s){try{return "/squad/?s="+encodeURIComponent(typeof s==="string"?s:JSON.stringify(s))}catch{return "/squad/"}}
function profile(){const active=member&&!member.suspended;$("fcLogin").hidden=!!member;$("fcProfile").hidden=!member;if(member){$("fcProfileForm").nickname.value=member.nickname||"";$("fcProfileForm").game_name.value=member.game_name||"";$("fcAdminLink").hidden=!member.admin}
 if($("fcWrite"))$("fcWrite").disabled=!active||!member.nickname;
 if($("fcMine"))$("fcMine").hidden=!active||!member.nickname;
 if($("fcAdmin"))$("fcAdmin").hidden=!active||!member.admin||!member.nickname;
}
$("fcSignIn").onclick=act(async()=>{const j=await post("login",{age:$("fcAge").checked,terms:$("fcTerms").checked,privacy:$("fcPrivacy").checked,policy});location.assign(j.url)});
$("fcProfileForm").onsubmit=act(async e=>{await post("profile",form(e.target));location.reload()});
$("fcLogout").onclick=act(async()=>{await post("logout",{});location.reload()});
$("fcWithdraw").onclick=act(async()=>{if(prompt("탈퇴하면 작성한 글·댓글 및 저장 정보가 삭제됩니다. 계속하려면 '탈퇴'를 입력하세요.")!=="탈퇴")return;await post("withdraw",{confirm:"탈퇴"});location.assign("/")});
const boardTime=n=>{
 const d=new Date(n*1000),fmt=(v,opts)=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",...opts}).format(v),day={year:"numeric",month:"2-digit",day:"2-digit"};
 return fmt(d,day)===fmt(new Date(),day)?fmt(d,{hour:"2-digit",minute:"2-digit",hourCycle:"h23"}):fmt(d,{month:"2-digit",day:"2-digit"});
};
const count=n=>Number.isSafeInteger(n)&&n>=0?n.toLocaleString("ko-KR"):"—";
function boardRows(posts,preview=false){
 $("fcPosts").innerHTML=posts.length?posts.map(x=>{
 const type=x.prefix!=="normal"?prefixes[x.prefix]:labels[x.category],notice=x.prefix==="notice",title=esc(x.title);
 const text=preview?'<span class="fc-post-title">'+title+'</span>':'<a class="fc-post-title" href="?id='+x.id+'" data-post="'+x.id+'">'+title+'</a>';
 return '<tr class="'+(notice?"fc-notice ":"")+(x.likes>=30?"fc-hot":"")+'"><td class="fc-type" data-kind="'+esc(x.prefix==="normal"?x.category:x.prefix)+'">'+esc(type)+'</td><td class="fc-title-cell">'+text+(x.replies?'<span class="fc-replies" aria-label="댓글 '+x.replies+'">['+count(x.replies)+']</span>':"")+(x.squad?'<small class="fc-attach">스쿼드</small>':"")+'</td><td class="fc-author" title="'+esc(x.nickname)+'">'+esc(x.nickname)+'</td><td class="fc-date">'+esc(boardTime(x.created))+'</td><td class="fc-count">'+count(x.views)+'</td><td class="fc-count fc-likes">'+count(x.likes)+'</td></tr>';
 }).join(""):'<tr><td colspan="6" class="fc-empty">'+(category==="popular"?"추천 30개 이상인 게시글이 아직 없습니다.":"등록된 게시글이 없습니다.")+'</td></tr>';
}
let listSeq=0;
async function loadPosts(){
 const seq=++listSeq;
 tabs($("fcTabs"),labels,category);$("fcPage").textContent=page;
 $("fcWrite").hidden=category==="popular";$("fcWrite").disabled=category==="popular"||!member?.nickname||!!member.suspended;
 $("fcPopularHint").hidden=category!=="popular";
 const p=new URLSearchParams({category,page,q:$("fcSearch").value});if(reviewCard&&category==="review")p.set("card",reviewCard);
 const j=await get("posts?"+p);if(seq!==listSeq)return;
 boardRows(j.posts);$("fcPrev").disabled=page===1;$("fcNext").disabled=j.posts.length<30;
}
function localBoardPreview(){
 const t=Math.floor(Date.now()/1000),examples=[
 ["free","notice","피파고수 게시판 이용 안내",0,0,0],
 ["free","question","급여 315 스쿼드 구성 질문",4,68,3],
 ["squad","normal","대한민국 스쿼드 평가 부탁드립니다",8,210,12],
 ["review","normal","센터백 시즌별 사용 후기",12,820,36],
 ["tips","normal","초보 구단주를 위한 전술 설정 팁",6,610,31],
 ["pack","normal","오늘 강화 결과 공유합니다",2,95,5],
 ["free","normal","오늘 공식경기 어떠셨나요?",1,30,1],
 ["squad","normal","팀컬러 맞춘 스쿼드 구성 공유",3,160,8],
 ["review","normal","풀백 가성비 선수 사용 후기",5,125,9],
 ["tips","normal","선수 교체할 때 확인할 능력치",2,70,4],
 ["free","answer","스쿼드 저장 방법 안내",0,20,0],
 ["pack","normal","선수팩 결과 공유",1,35,2]
 ].map(([category,prefix,title,replies,views,likes],i)=>({category,prefix,title,replies,views,likes,nickname:prefix==="notice"?"예시 운영자":"예시 회원 "+i,created:t-i*180}));
 $("fcPreviewHint").hidden=false;
 boardRows(examples.filter(x=>category==="all"||category==="popular"&&x.likes>=30||x.category===category),true);
}
function previewBoard(){
 tabs($("fcTabs"),labels,category);$("fcWrite").hidden=category==="popular";$("fcPopularHint").hidden=category!=="popular";
 if(["localhost","127.0.0.1","[::1]"].includes(location.hostname))localBoardPreview();
 else $("fcPosts").innerHTML='<tr><td colspan="6" class="fc-empty">회원 서버 연결 전입니다.</td></tr>';
}
const recordView=async id=>{try{await post("view",{post_id:id})}catch{}};
async function readPost(id,record=false){
 if(record)await recordView(id);
 const j=await get("post?id="+id),p=j.post;selected=id;$("fcPost").hidden=false;$("fcPost").innerHTML='<h2>'+esc(p.title)+'</h2><p class="fc-note">'+esc(p.nickname)+' · '+date(p.created)+'</p><p class="fc-text">'+esc(p.body)+'</p>'+(p.squad?'<p><a href="'+esc(squadLink(p.squad))+'">이 스쿼드 불러오기</a></p>':"")+(p.card_id?'<p><a href="/cards?card='+p.card_id+'">선수 카드 검색</a></p>':"")+(member?.nickname&&!member.suspended?'<div class="fc-row">'+btn("추천","data-action","vote")+btn("스크랩","data-action","bookmark")+btn("신고","data-action","report")+(p.own?btn("내 글 삭제","data-action","delete-post"):"")+'</div>':"")+'<h3>댓글</h3>'+j.comments.map(c=>'<div class="fc-entry"><div><small>'+esc(c.nickname)+' · '+date(c.created)+'</small><p class="fc-text">'+esc(c.body)+'</p></div>'+(c.own?btn("삭제","data-delete-comment",c.id):"")+'</div>').join("")+(member?.nickname&&!member.suspended?'<form id="fcComment"><textarea name="body" maxlength="2000" required placeholder="댓글"></textarea><button>등록</button></form>':"");
 if($("fcComment"))$("fcComment").onsubmit=act(async e=>{await post("comment",{post_id:id,...form(e.target)});await readPost(id)});
}
function composer(){
 const c=$("fcCategory").value;$("fcPrefix").innerHTML=Object.entries(prefixes).filter(([k])=>k==="normal"||c==="free"&&(k!=="notice"||member?.admin)).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("");
 $("fcSquadAttach").hidden=c!=="squad"||!recentSquad();$("fcReviewAttach").hidden=c!=="review";
}
if(screen==="board"){
 $("fcTabs").onclick=act(async e=>{const b=e.target.closest("[data-tab]");if(b){category=b.dataset.tab;page=1;reviewCard=0;await loadPosts()}});
 $("fcSearchForm").onsubmit=act(async()=>{page=1;await loadPosts()});$("fcPrev").onclick=act(async()=>{if(page>1)page--;await loadPosts()});$("fcNext").onclick=act(async()=>{page++;await loadPosts()});
 $("fcPosts").onclick=delegated("[data-post]",async e=>{const b=e.target.closest("[data-post]");if(b){await readPost(Number(b.dataset.post),true);history.replaceState(null,"","?id="+b.dataset.post);$("fcPost").scrollIntoView({block:"start"})}});
 $("fcCategory").innerHTML=Object.entries(labels).filter(([k])=>!["all","popular"].includes(k)).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("");
 $("fcCategory").onchange=composer;
 $("fcWrite").onclick=()=>{if(category==="popular"||!member?.nickname||member.suspended)return;$("fcCategory").value=category==="all"?"free":category;composer();if(category==="squad"&&query.get("compose")==="1"&&recentSquad())$("fcPostForm").attach.checked=true;if(reviewCard)$("fcPostForm").card_id.value=reviewCard;$("fcComposer").showModal()};
 $("fcClose").onclick=()=>$("fcComposer").close();
 $("fcPostForm").onsubmit=act(async e=>{if(category==="popular")throw Error("인기글에서는 직접 작성할 수 없습니다.");const b=form(e.target);if(b.attach&&b.category==="squad")b.squad=recentSquad();b.card_id=b.card_id?Number(b.card_id):null;const r=await post("post",b);e.target.reset();$("fcComposer").close();await loadPosts();await readPost(r.id)});
 $("fcPost").onclick=delegated("[data-action],[data-delete-comment]",async e=>{const b=e.target.closest("[data-action],[data-delete-comment]");if(!b)return;if(b.dataset.deleteComment){if(confirm("댓글을 삭제하시겠습니까?"))await post("delete-comment",{id:Number(b.dataset.deleteComment)})}
 else{const k=b.dataset.action;if(k==="report"){const reason=prompt("신고 사유");if(!reason)return;await post(k,{post_id:selected,reason});status("신고 접수 완료")}
 else if(k==="delete-post"){if(!confirm("게시글을 삭제하시겠습니까?"))return;await post(k,{id:selected});$("fcPost").hidden=true;await loadPosts();return}
 else{await post(k,{post_id:selected});status(k==="vote"?"추천 완료":"스크랩 완료")}}await readPost(selected);await loadPosts()});
}
const mineLabels={squads:"내 스쿼드",favorites:"관심 선수",diagnoses:"전적 진단",posts:"내 게시글",bookmarks:"스크랩",feedback:"건의·오류 신고"};
function entries(arr,render){return arr?.length?arr.map(render).join(""):"<p>저장된 정보가 없습니다.</p>"}
function entry(title,sub,actions=""){return '<div class="fc-entry"><div><b>'+esc(title)+'</b><small class="fc-text">'+esc(sub)+'</small></div>'+actions+'</div>'}
async function loadMine(){mine=await get("mine");renderMine()}
function renderMine(){
 tabs($("fcMineTabs"),mineLabels,mineTab);let h="<h2>"+mineLabels[mineTab]+"</h2>";
 if(mineTab==="squads")h+='<form id="fcSaveSquad"><label>스쿼드 이름<input name="name" required maxlength="60"></label><button>최근 저장 스쿼드 가져오기</button></form>'+entries(mine.squads,s=>entry(s.name,date(s.created)+(mine.history.filter(x=>x.squad_id===s.id).length?" · "+mine.history.filter(x=>x.squad_id===s.id).slice(0,5).map(x=>date(x.observed)+" "+x.bp.toLocaleString()+" BP").join(" / "):""),'<a href="'+esc(squadLink(s.payload))+'">불러오기</a> '+btn("현재 가치 기록","data-value",s.id)+btn("삭제","data-delete-squad",s.id)));
 if(mineTab==="favorites")h+=entries(mine.favorites,x=>entry(x.name,x.grade+"강 · 카드 "+x.card_id,'<a href="/board/?category=review&card='+x.card_id+'">후기</a> '+btn("삭제","data-delete-favorite",x.card_id+":"+x.grade)));
 if(mineTab==="diagnoses")h+=entries(mine.diagnoses,x=>entry(x.nickname,date(x.created)+"\n"+x.body,btn("삭제","data-delete-diagnosis",x.id)));
 if(mineTab==="posts"||mineTab==="bookmarks")h+=entries(mine[mineTab],x=>entry(x.title,"",'<a href="/board/?id='+x.id+'">보기</a>'));
 if(mineTab==="feedback")h+='<form id="fcFeedback"><label>구분<select name="kind"><option value="suggestion">건의</option><option value="bug">오류 신고</option><option value="rights">권리침해</option><option value="privacy">개인정보 문의</option></select></label><label>내용<textarea name="body" required maxlength="5000"></textarea></label><button>접수</button></form>'+entries(mine.feedback,x=>entry(x.kind+" · "+(x.status==="closed"?"답변 완료":"접수"),x.body+(x.reply?"\n답변: "+x.reply:"")));
 $("fcMineBody").innerHTML=h;
 if($("fcSaveSquad"))$("fcSaveSquad").onsubmit=act(async e=>{const squad=recentSquad();if(!squad)throw Error("AI 스쿼드에서 먼저 저장해 주세요.");await post("squad",{...form(e.target),squad});await loadMine()});
 if($("fcFeedback"))$("fcFeedback").onsubmit=act(async e=>{await post("feedback",form(e.target));await loadMine()});
}
if(screen==="mypage"){
 $("fcMineTabs").onclick=e=>{const b=e.target.closest("[data-tab]");if(b){mineTab=b.dataset.tab;renderMine()}};
 $("fcMineBody").onclick=delegated("[data-value],[data-delete-squad],[data-delete-diagnosis],[data-delete-favorite]",async e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;if(d.value){const r=await post("value",{id:Number(d.value)});status("현재 가치 "+r.bp.toLocaleString()+" BP 기록")}
 else if(d.deleteSquad)await post("delete-squad",{id:Number(d.deleteSquad)});else if(d.deleteDiagnosis)await post("delete-diagnosis",{id:Number(d.deleteDiagnosis)});else if(d.deleteFavorite){const [card_id,grade]=d.deleteFavorite.split(":").map(Number);await post("favorite",{card_id,grade,remove:true})}else return;await loadMine()});
}
const adminLabels={reports:"신고 관리",feedback:"건의·오류",members:"회원 관리",posts:"게시글 관리",audit:"처리 이력"};
async function loadAdmin(){adminData=await get("admin");renderAdmin()}
function renderAdmin(){
 tabs($("fcAdminTabs"),adminLabels,adminTab);let h="<h2>"+adminLabels[adminTab]+"</h2>";
 if(adminTab==="reports")h+=entries(adminData.reports,x=>entry("신고 #"+x.id+" · 글 #"+x.post_id,x.reason+" · "+x.status,'<a href="/board/?id='+x.post_id+'">글 보기</a> '+btn("처리 완료","data-admin","report:"+x.id)));
 if(adminTab==="feedback")h+=entries(adminData.feedback,x=>entry(x.nickname+" · "+x.kind,x.body+(x.reply?"\n답변: "+x.reply:""),btn("답변","data-admin","feedback:"+x.id)));
 if(adminTab==="members")h+=entries(adminData.members,x=>entry(x.nickname||"닉네임 미설정",date(x.created)+" · "+(x.suspended?"정지":"정상"),btn(x.suspended?"해제":"정지","data-admin","member:"+x.id+":"+(x.suspended?0:1))));
 if(adminTab==="posts")h+=entries(adminData.posts,x=>entry(x.title,date(x.created)+" · "+(x.hidden?"숨김":"공개"),btn(x.hidden?"복구":"숨김","data-admin","post:"+x.id+":"+(x.hidden?0:1))));
 if(adminTab==="audit")h+=entries(adminData.audit,x=>entry(x.action+" · "+x.target,date(x.created)+" · "+x.reason));
 $("fcAdminBody").innerHTML=h;
}
if(screen==="admin"){
 $("fcAdminTabs").onclick=e=>{const b=e.target.closest("[data-tab]");if(b){adminTab=b.dataset.tab;renderAdmin()}};
 $("fcAdminBody").onclick=act(async e=>{const b=e.target.closest("[data-admin]");if(!b)return;const [type,id,flag]=b.dataset.admin.split(":"),reason=prompt(type==="feedback"?"회원에게 전달할 답변":"처리 사유");if(!reason)return;await post("admin/"+type,{id:type==="member"?id:Number(id),reason,hidden:flag==="1",suspended:flag==="1"});await loadAdmin()});
}
(async()=>{try{const j=await get("me");member=j.member;profile();if(screen==="board"){await loadPosts();if(Number(query.get("id"))>0)await readPost(Number(query.get("id")),true);if(query.get("compose")==="1"&&member?.nickname&&!member.suspended)$("fcWrite").click()}
 if(screen==="mypage"&&member?.nickname&&!member.suspended)await loadMine();if(screen==="admin"){if(member?.admin&&member.nickname&&!member.suspended)await loadAdmin();else status("관리자만 접근할 수 있습니다.",true)}
}catch(e){status(e.message,true);if(screen==="board"){["fcFind","fcPrev","fcNext","fcWrite","fcSearch"].forEach(k=>$(k).disabled=true);previewBoard();$("fcTabs").onclick=e=>{const b=e.target.closest("[data-tab]");if(!b)return;category=b.dataset.tab;previewBoard()}}if(screen==="mypage"){ $("fcLogin").hidden=false;$("fcSignIn").disabled=true; $("fcMine").hidden=false;tabs($("fcMineTabs"),mineLabels,mineTab);$("fcMineTabs").querySelectorAll("button").forEach(b=>b.disabled=true);$("fcMineBody").textContent="회원 서버 연결 후 이용 가능합니다."}if(screen==="admin"){$("fcAdmin").hidden=false;tabs($("fcAdminTabs"),adminLabels,adminTab);$("fcAdminTabs").querySelectorAll("button").forEach(b=>b.disabled=true);$("fcAdminBody").textContent="관리자 인증 서버 연결 전 화면입니다. 실제 회원 정보는 표시되지 않습니다."}}})();
})();