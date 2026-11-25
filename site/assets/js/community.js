(()=>{"use strict";
const $=id=>document.getElementById(id),root=document.querySelector(".fg-community");if(!root)return;
const screen=root.dataset.screen,api="/api/community/",policy="2026-11-v1",labels={all:"전체",popular:"인기글",free:"자유게시판",squad:"스쿼드 평가",review:"선수 후기",tips:"공략·팁",pack:"강화·득템"},prefixes={normal:"일반",question:"질문",answer:"답변",notice:"공지"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const authorCheck=ok=>ok===true?'<span class="fc-verified" role="img" aria-label="인증된 운영 계정" title="인증된 운영 계정">✓</span>':"";
const catLevels=[[0,"아기냥"],[30,"꼬마냥"],[100,"장난꾸러기냥"],[250,"탐험냥"],[500,"기사냥"],[1000,"마법냥"],[2000,"왕관냥"],[4000,"전설냥"],[8000,"신화냥"],[16000,"우주냥"]];
const catColors=["#ffd6b2","#f9d76d","#f8b2bd","#a8e5cb","#b7cee6","#c9b3f2","#ffd166","#f5a47b","#b5ddfa","#a5c5ff"];
const catIcon=r=>{if(!r||!Number.isInteger(r.level)||r.level<1||r.level>10)return "";const l=r.level,c=catColors[l-1],extra=l===1?'<path d="M7 6 Q12 0 17 6" fill="none" stroke="#efaa91"/>':l===2?'<path d="M10 17l2 3 2-3" fill="#e69053"/>':l===3?'<path d="M5 13l3 1m8 0 3-1" stroke="#b75e77"/>':l===4?'<path d="M3 6h18l-3-3H6z" fill="#4b9b81"/>':l===5?'<path d="M5 5h14v4H5z" fill="#8c9eb8"/><path d="M12 5v4" stroke="#fff"/>':l===6?'<path d="M5 7l7-6 7 6z" fill="#8863d2"/><path d="M12 3v3" stroke="#ffd166"/>':l===7?'<path d="M5 7l1-5 6 3 6-3 1 5z" fill="#f5ad36"/>':l===8?'<path d="M3 10L0 5l6 1m15 4 3-5-6 1" fill="#eb885c"/>':l===9?'<ellipse cx="12" cy="3" rx="6" ry="2" fill="none" stroke="#e3b34e"/>':'<ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)" fill="none" stroke="#7364d1"/><path d="M20 1v5m-2.5-2.5h5" stroke="#7364d1"/>';return '<span class="fc-cat" title="'+esc('Lv.'+l+' '+r.name+' · '+r.points+' XP')+'" role="img" aria-label="'+esc('레벨 '+l+' '+r.name)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11L3 4l6 3h6l6-3-1 7c3 8-3 11-8 11S1 19 4 11z" fill="'+c+'" stroke="#70584b" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="13" r="1.25" fill="#534039"/><circle cx="16" cy="13" r="1.25" fill="#534039"/><path d="M11 15h2l-1 1zM12 16q-2 2-3 0m3 0q2 2 3 0" stroke="#80534e" fill="none" stroke-linecap="round"/>'+extra+'</svg></span>'};
const authorName=x=>catIcon(x.rank)+authorCheck(x.verified)+esc(x.nickname);
function rankPanel(r){if(!r)return;const el=$("fcRank");if(!el)return;el.hidden=false;const max=r.next===null,progress=max?100:Math.min(100,Math.max(0,(r.points-r.floor)/(r.next-r.floor)*100));el.innerHTML='<div class="fc-rank-summary">'+catIcon(r)+'<div><b>Lv.'+r.level+' '+esc(r.name)+'</b><small>'+r.points.toLocaleString()+' XP'+(max?' · 최고 레벨':' / '+r.next.toLocaleString()+' XP')+'</small></div></div><div class="fc-rank-track"><i style="width:'+progress+'%"></i></div><small>게시글 +5 XP (하루 3개), 댓글 +1 XP (하루 8개), 받은 추천 글 +3 / 댓글 +2 XP (삭제·숨김·추천 취소 시 차감)</small><details class="fc-rank-guide"><summary>고양이 성장 단계 보기</summary><div>'+catLevels.map(([points,name],i)=>'<span>'+catIcon({level:i+1,name,points})+'<b>Lv.'+(i+1)+' '+esc(name)+'</b><small>'+points.toLocaleString()+' XP</small></span>').join("")+'</div></details>'}
const date=n=>new Date(n*1000).toLocaleString("ko-KR"),status=(s,bad=false)=>{$("fcStatus").textContent=s;$("fcStatus").classList.toggle("fc-error",bad)};
async function get(path){const r=await fetch(api+path,{cache:"no-store"}),j=await r.json();if(!r.ok){const err=Error(j.message||"회원 서비스 준비 중입니다.");err.unavailable=j.enabled===false;throw err}return j}
async function post(path,b){const r=await fetch(api+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}),j=await r.json();if(!r.ok)throw Error(j.message||"요청 실패");return j}
const act=f=>async e=>{e?.preventDefault();try{await f(e)}catch(err){status(err.message,true)}};
const delegated=(selector,f)=>async e=>{if(!e.target.closest(selector))return;return act(f)(e)};
const form=f=>Object.fromEntries(new FormData(f)),btn=(label,attr,id)=>'<button type="button" '+attr+'="'+esc(id)+'">'+esc(label)+'</button>';
let member=null,category="all",page=1,selected=0,mine=null,adminData=null,mineTab="squads",adminTab="reports",reviewCard=0;
const query=new URLSearchParams(location.search);if(Object.hasOwn(labels,query.get("category")))category=query.get("category");reviewCard=Number(query.get("card")||0);page=Math.min(100,Math.max(1,Number(query.get("page"))||1));
let currentPost=null,currentComments=[],replyTo=null,commentSort="new",editId=0;
const listURL=()=>{const p=new URLSearchParams();if(category!=="all")p.set("category",category);if(page>1)p.set("page",page);if(reviewCard)p.set("card",reviewCard);const q=$("fcSearch")?.value;if(q)p.set("q",q);const mode=$("fcSearchMode")?.value;if(mode&&mode!=="all")p.set("search",mode);return "/board/"+(p.size?"?"+p:"")};
const postURL=id=>{const u=new URL(listURL(),location.origin);u.searchParams.set("id",id);return u.pathname+u.search};
const writeURL=(id=0)=>{const u=new URL(listURL(),location.origin);u.searchParams.set(id?"edit":"write",id||"1");return u.pathname+u.search};
function tabs(el,items,key){el.innerHTML=Object.entries(items).map(([k,v])=>'<button type="button" data-tab="'+k+'" aria-pressed="'+(key===k)+'">'+esc(v)+'</button>').join("")}
function recentSquad(){try{return JSON.parse(localStorage.getItem("fg-squad-v1")||"null")}catch{return null}}
function squadLink(s){try{return "/squad/?s="+encodeURIComponent(typeof s==="string"?s:JSON.stringify(s))}catch{return "/squad/"}}
function profile(){const active=member&&!member.suspended;$("fcLogin").hidden=!!member||screen==="board";$("fcProfile").hidden=!member||screen==="board";if(screen==="board")$("fcAccountLink").innerHTML=member?.nickname?authorName({...member,verified:member.admin})+" · 마이페이지":"로그인";if(member){rankPanel(member.rank);$("fcProfileCheck").hidden=member.admin!==true;$("fcProfileForm").nickname.value=member.nickname||"";$("fcProfileForm").game_name.value=member.game_name||"";$("fcAdminLink").hidden=!member.admin}
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
 const text=preview?'<span class="fc-post-title">'+title+'</span>':'<a class="fc-post-title" href="'+esc(postURL(x.id))+'" data-post="'+x.id+'">'+title+'</a>';
 return '<tr class="'+(notice?"fc-notice ":"")+(x.likes>=30?"fc-hot":"")+'"><td class="fc-type" data-kind="'+esc(x.prefix==="normal"?x.category:x.prefix)+'">'+esc(type)+'</td><td class="fc-title-cell">'+text+(x.replies?'<span class="fc-replies" aria-label="댓글 '+x.replies+'">['+count(x.replies)+']</span>':"")+(x.squad?'<small class="fc-attach">스쿼드</small>':"")+'</td><td class="fc-author" title="'+esc(x.nickname)+'">'+authorName(x)+'</td><td class="fc-date">'+esc(boardTime(x.created))+'</td><td class="fc-count">'+count(x.views)+'</td><td class="fc-count fc-likes">'+esc(Number.isSafeInteger(x.likes)?x.likes.toLocaleString("ko-KR"):"—")+'</td></tr>';
 }).join(""):'<tr><td colspan="6" class="fc-empty">'+(category==="popular"?"추천 30개 이상인 게시글이 아직 없습니다.":"등록된 게시글이 없습니다.")+'</td></tr>';
}
let listSeq=0;
async function loadPosts(){
 const seq=++listSeq;
 tabs($("fcTabs"),labels,category);$("fcPage").textContent=page;
 $("fcWrite").hidden=category==="popular";$("fcWrite").disabled=category==="popular"||!member?.nickname||!!member.suspended;
 $("fcPopularHint").hidden=category!=="popular";
 const p=new URLSearchParams({category,page,q:$("fcSearch").value,search:$("fcSearchMode").value});if(reviewCard&&category==="review")p.set("card",reviewCard);
 const j=await get("posts?"+p);if(seq!==listSeq)return;
 boardRows(j.posts);$("fcPrev").disabled=page===1;$("fcNext").disabled=j.posts.length<30;history.replaceState(null,"",listURL());
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
const canAct=()=>!!member?.nickname&&!member.suspended;
const voteButtons=(x,kind)=>[1,-1].map(v=>'<button type="button" class="fc-vote '+(v===1?'fc-up':'fc-down')+'" data-vote-kind="'+kind+'" data-vote-id="'+x.id+'" data-vote-value="'+v+'" aria-label="'+(v===1?'추천':'비추천')+'" aria-pressed="'+(x.my_vote===v)+'" '+(!canAct()||x.own&&x.my_vote!==v?'disabled':'')+'><span aria-hidden="true">'+(v===1?'👍':'👎')+'</span> '+(kind==='post'?(v===1?'추천 ':'비추천 '):'')+count((v===1?x.likes:x.dislikes)||0)+'</button>').join("");
function setBoardMode(mode){$("fcBoardList").hidden=mode!=="list";$("fcPost").hidden=mode!=="post";$("fcComposer").hidden=mode!=="write";$("fcTabs").hidden=mode!=="list"}
const net=x=>(x.likes||0)-(x.dislikes||0);
function commentRow(c,best=false){return '<article class="fc-comment '+(c.parent_id?'fc-reply':'')+'"><div class="fc-comment-head">'+(best?'<b class="fc-best">BEST</b>':"")+'<b>'+authorName(c)+'</b><small>'+date(c.created)+'</small></div><p class="fc-text">'+esc(c.body)+'</p><div class="fc-comment-actions">'+voteButtons(c,"comment")+(canAct()?btn("답글","data-reply",c.id):"")+(c.own?btn("수정","data-edit-comment",c.id)+btn("삭제","data-delete-comment",c.id):"")+(member?.admin?btn("숨김","data-hide-comment",c.id):"")+'</div></article>'}
function renderComments(){const rows=[...currentComments],ids=new Set(rows.map(x=>x.id)),sort=(a,b)=>commentSort==="best"?net(b)-net(a)||a.created-b.created:a.created-b.created,parents=rows.filter(c=>!c.parent_id||!ids.has(c.parent_id)).sort(sort),best=new Set(rows.filter(c=>net(c)>=5).sort((a,b)=>net(b)-net(a)).slice(0,3).map(c=>c.id));$("fcCommentList").innerHTML=parents.map(c=>commentRow(c,best.has(c.id))+rows.filter(x=>x.parent_id===c.id&&x.id!==c.id).sort(sort).map(x=>commentRow(x,best.has(x.id))).join("")).join("")||'<p class="fc-note">첫 댓글을 남겨보세요.</p>'}
async function readPost(id,record=false){
 const draft=$("fcComment")?.elements.body?.value||"",parent=replyTo;
 if(record){replyTo=null;await recordView(id)}
 const j=await get("post?id="+id),p=j.post;currentPost=p;currentComments=j.comments;selected=id;setBoardMode("post");
 $("fcPost").innerHTML='<nav class="fc-detail-nav"><a href="'+esc(listURL())+'">← 목록으로</a><span>'+esc(labels[p.category]||"게시판")+'</span></nav><header class="fc-detail-head"><h1>'+esc(p.title)+'</h1><div class="fc-post-meta"><b>'+authorName(p)+'</b><span>'+date(p.created)+'</span><span>조회 '+count(p.views)+' · 댓글 '+j.comments.length+'</span></div></header><div class="fc-post-body fc-text">'+esc(p.body)+(p.squad?'<p><a href="'+esc(squadLink(p.squad))+'">첨부 스쿼드 불러오기</a></p>':"")+(p.card_id?'<p><a href="/cards?card='+p.card_id+'">선수 카드 검색</a></p>':"")+'</div><div class="fc-post-votes">'+voteButtons(p,"post")+'</div><div class="fc-post-tools">'+btn("공유","data-action","share")+(canAct()?btn(p.bookmarked?"스크랩 취소":"스크랩","data-action","bookmark")+btn("신고","data-action","report"):"")+(p.own?'<a class="fc-tool-link" href="'+esc(writeURL(p.id))+'">수정</a>'+btn("삭제","data-action","delete-post"):"")+(member?.admin?btn("숨김","data-action","hide")+btn("이동","data-action","move")+(p.category==="free"?btn(p.prefix==="notice"?"공지 해제":"공지 고정","data-action","pin"):""):"")+'</div><section class="fc-comments"><div class="fc-comment-heading"><h2>댓글 '+j.comments.length+'개</h2><div class="fc-sort"><button type="button" data-sort-comment="new" aria-pressed="'+(commentSort==="new")+'">등록순</button><button type="button" data-sort-comment="best" aria-pressed="'+(commentSort==="best")+'">추천순</button></div></div><div id="fcCommentList"></div>'+(canAct()?'<form id="fcComment" class="fc-comment-form"><div id="fcReplyLabel" class="fc-note" hidden></div><label for="fcCommentBody">댓글 작성</label><textarea id="fcCommentBody" name="body" maxlength="2000" required placeholder="댓글을 입력해 주세요."></textarea><div class="fc-comment-footer"><span id="fcCommentCount" class="fc-note">0 / 2,000자</span><button class="fc-primary">댓글 등록</button></div></form>':'<p class="fc-login-note"><a href="/mypage/">로그인</a> 후 댓글을 작성할 수 있습니다.</p>')+'</section><nav class="fc-detail-nav"><a href="'+esc(listURL())+'">← 목록으로</a></nav>';
 renderComments();
 if($("fcComment")){const body=$("fcCommentBody");if(!record){body.value=draft;replyTo=parent}const update=()=>{$("fcCommentCount").textContent=body.value.length.toLocaleString()+" / 2,000자";body.style.height="auto";body.style.height=Math.max(132,body.scrollHeight+2)+"px"};body.addEventListener("input",update);update();showReply();
 $("fcComment").onsubmit=act(async e=>{const b=form(e.target);if(replyTo)b.parent_id=replyTo.id;await post("comment",{post_id:id,...b});body.value="";replyTo=null;await readPost(id)})}
}
function showReply(){const el=$("fcReplyLabel");if(!el)return;el.hidden=!replyTo;el.innerHTML=replyTo?esc(replyTo.nickname)+"님에게 답글 "+btn("취소","data-cancel-reply","1"):""}
function composer(){
 const c=$("fcCategory").value;$("fcPrefix").innerHTML=Object.entries(prefixes).filter(([k])=>k==="normal"||c==="free"&&(k!=="notice"||member?.admin)).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("");
 $("fcSquadAttach").hidden=c!=="squad"||!recentSquad();$("fcReviewAttach").hidden=c!=="review";
}
if(screen==="board"){
 $("fcSearch").value=query.get("q")||"";$("fcSearchMode").value=["all","title","author"].includes(query.get("search"))?query.get("search"):"all";
 $("fcTabs").onclick=act(async e=>{const b=e.target.closest("[data-tab]");if(b){category=b.dataset.tab;page=1;reviewCard=0;await loadPosts()}});
 $("fcSearchForm").onsubmit=act(async()=>{page=1;await loadPosts()});$("fcPrev").onclick=act(async()=>{if(page>1)page--;await loadPosts()});$("fcNext").onclick=act(async()=>{page++;await loadPosts()});
 $("fcCategory").innerHTML=Object.entries(labels).filter(([k])=>!["all","popular"].includes(k)).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("");
 $("fcCategory").onchange=composer;
 $("fcWrite").onclick=()=>{if(category!=="popular"&&canAct())location.assign(writeURL())};
 $("fcClose").onclick=()=>location.assign(listURL());
 $("fcDraft").onclick=()=>{try{localStorage.setItem("fg-board-draft-v2",JSON.stringify(form($("fcPostForm"))));status("이 브라우저에 임시저장했습니다.")}catch{status("임시저장하지 못했습니다.",true)}};
 $("fcRestore").onclick=()=>{try{const d=JSON.parse(localStorage.getItem("fg-board-draft-v2")||"null");if(!d)return status("임시저장한 글이 없습니다.");if(d.category&&Object.hasOwn(labels,d.category)&&!["all","popular"].includes(d.category))$("fcCategory").value=d.category;composer();for(const k of ["prefix","title","body","card_id"])if(d[k]!=null)$("fcPostForm").elements[k].value=d[k];status("임시저장 글을 불러왔습니다.")}catch{status("불러오지 못했습니다.",true)}};
 $("fcPostForm").onsubmit=act(async e=>{const b=form(e.target);if(editId){await post("edit-post",{id:editId,title:b.title,body:b.body});location.assign(postURL(editId));return}if(b.attach&&b.category==="squad")b.squad=recentSquad();b.card_id=b.card_id?Number(b.card_id):null;const r=await post("post",b);try{localStorage.removeItem("fg-board-draft-v2")}catch{}location.assign(postURL(r.id))});
 $("fcPost").onclick=delegated("[data-action],[data-delete-comment],[data-edit-comment],[data-vote-kind],[data-reply],[data-cancel-reply],[data-sort-comment],[data-hide-comment]",async e=>{
 const b=e.target.closest("button"),d=b.dataset;
 if(d.sortComment){commentSort=d.sortComment;$("fcPost").querySelectorAll("[data-sort-comment]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderComments();return}
 if(d.reply){replyTo=currentComments.find(c=>c.id===Number(d.reply));showReply();$("fcCommentBody")?.focus();return}
 if(d.cancelReply){replyTo=null;showReply();return}
 if(d.voteKind){b.disabled=true;const x=d.voteKind==="post"?currentPost:currentComments.find(c=>c.id===Number(d.voteId));const v=Number(d.voteValue);try{await post(d.voteKind==="post"?"vote":"comment-vote",d.voteKind==="post"?{post_id:selected,value:x.my_vote===v?0:v}:{id:x.id,value:x.my_vote===v?0:v});await readPost(selected)}finally{b.disabled=false}return}
 if(d.editComment){const c=currentComments.find(x=>x.id===Number(d.editComment)),body=prompt("댓글 수정",c.body);if(body===null)return;await post("edit-comment",{id:c.id,body})}
 else if(d.deleteComment){if(!confirm("댓글을 삭제하시겠습니까?"))return;await post("delete-comment",{id:Number(d.deleteComment)})}
 else if(d.hideComment){const reason=prompt("숨김 사유");if(!reason)return;await post("admin/comment",{id:Number(d.hideComment),hidden:true,reason})}
 else{const k=d.action;if(k==="share"){await navigator.clipboard.writeText(location.href);status("게시글 주소를 복사했습니다.");return}
 if(k==="report"){const reason=prompt("신고 사유");if(!reason)return;await post(k,{post_id:selected,reason});status("신고 접수 완료")}
 else if(k==="delete-post"){if(!confirm("게시글을 삭제하시겠습니까?"))return;await post(k,{id:selected});location.assign(listURL());return}
 else if(k==="bookmark"){await post(k,{post_id:selected,remove:!!currentPost.bookmarked})}
 else if(k==="hide"){const reason=prompt("숨김 사유");if(!reason)return;await post("admin/post",{id:selected,hidden:true,reason});location.assign(listURL());return}
 else if(k==="move"){const category=prompt("이동할 게시판: free(자유), squad(스쿼드), review(후기), tips(공략), pack(득템)",currentPost.category);if(!category)return;const reason=prompt("이동 사유");if(!reason)return;await post("admin/move",{id:selected,category,reason})}
 else if(k==="pin"){const reason=prompt("공지 설정 변경 사유");if(!reason)return;await post("admin/pin",{id:selected,pin:currentPost.prefix!=="notice",reason})}
 }await readPost(selected)});
}
async function openComposer(id=0){if(!canAct()){status("로그인 후 작성할 수 있습니다.",true);setBoardMode("list");await loadPosts();return}setBoardMode("write");const f=$("fcPostForm");editId=id;$("fcCategory").value=["all","popular"].includes(category)?"free":category;composer();if(id){const j=await get("post?id="+id),p=j.post;if(!p.own){status("작성자만 수정할 수 있습니다.",true);setBoardMode("list");await loadPosts();return}$("fcCategory").value=p.category;composer();f.elements.prefix.value=p.prefix;f.elements.title.value=p.title;f.elements.body.value=p.body;for(const k of ["category","prefix","attach","card_id"])f.elements[k].disabled=true;$("fcDraft").hidden=true;$("fcRestore").hidden=true;$("fcComposerTitle").textContent="게시글 수정"}else{if(category==="squad"&&query.get("compose")==="1"&&recentSquad())f.elements.attach.checked=true;if(reviewCard)f.elements.card_id.value=reviewCard}f.elements.title.focus()}
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
const adminLabels={reports:"신고 관리",feedback:"건의·오류",members:"회원 관리",posts:"게시글 관리",comments:"댓글 관리",audit:"처리 이력"};
async function loadAdmin(){adminData=await get("admin");renderAdmin()}
function renderAdmin(){
 tabs($("fcAdminTabs"),adminLabels,adminTab);let h="<h2>"+adminLabels[adminTab]+"</h2>";
 if(adminTab==="reports")h+=entries(adminData.reports,x=>entry("신고 #"+x.id+" · 글 #"+x.post_id,x.reason+" · "+x.status,'<a href="/board/?id='+x.post_id+'">글 보기</a> '+btn("처리 완료","data-admin","report:"+x.id)));
 if(adminTab==="feedback")h+=entries(adminData.feedback,x=>entry(x.nickname+" · "+x.kind,x.body+(x.reply?"\n답변: "+x.reply:""),btn("답변","data-admin","feedback:"+x.id)));
 if(adminTab==="members")h+=entries(adminData.members,x=>entry(x.nickname||"닉네임 미설정",date(x.created)+" · "+(x.suspended?"정지":"정상"),btn(x.suspended?"해제":"정지","data-admin","member:"+x.id+":"+(x.suspended?0:1))));
 if(adminTab==="posts")h+=entries(adminData.posts,x=>entry(x.title,date(x.created)+" · "+(x.hidden?"숨김":"공개"),btn(x.hidden?"복구":"숨김","data-admin","post:"+x.id+":"+(x.hidden?0:1))));
 if(adminTab==="comments")h+=entries(adminData.comments,x=>entry(x.body,date(x.created)+" · 글 #"+x.post_id+" · "+(x.hidden?"숨김":"공개"),btn(x.hidden?"복구":"숨김","data-admin","comment:"+x.id+":"+(x.hidden?0:1))));
 if(adminTab==="audit")h+=entries(adminData.audit,x=>entry(x.action+" · "+x.target,date(x.created)+" · "+x.reason));
 $("fcAdminBody").innerHTML=h;
}
if(screen==="admin"){
 $("fcAdminTabs").onclick=e=>{const b=e.target.closest("[data-tab]");if(b){adminTab=b.dataset.tab;renderAdmin()}};
 $("fcAdminBody").onclick=act(async e=>{const b=e.target.closest("[data-admin]");if(!b)return;const [type,id,flag]=b.dataset.admin.split(":"),reason=prompt(type==="feedback"?"회원에게 전달할 답변":"처리 사유");if(!reason)return;await post("admin/"+type,{id:type==="member"?id:Number(id),reason,hidden:flag==="1",suspended:flag==="1"});await loadAdmin()});
}
(async()=>{try{const j=await get("me");member=j.member;profile();if(screen==="board"){if(Number(query.get("id"))>0)await readPost(Number(query.get("id")),true);else if(Number(query.get("edit"))>0)await openComposer(Number(query.get("edit")));else if(query.has("write")||query.get("compose")==="1")await openComposer();else{setBoardMode("list");await loadPosts()}}
 if(screen==="mypage"&&member?.nickname&&!member.suspended)await loadMine();if(screen==="admin"){if(member?.admin&&member.nickname&&!member.suspended)await loadAdmin();else status("관리자만 접근할 수 있습니다.",true)}
}catch(e){if(e.unavailable){status("");}else status("회원 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",true);if(screen==="board"){["fcFind","fcPrev","fcNext","fcWrite","fcSearch"].forEach(k=>$(k).disabled=true);previewBoard();$("fcTabs").onclick=e=>{const b=e.target.closest("[data-tab]");if(!b)return;category=b.dataset.tab;previewBoard()}}if(screen==="mypage"){ $("fcLogin").hidden=false;$("fcSignIn").disabled=true; $("fcMine").hidden=false;tabs($("fcMineTabs"),mineLabels,mineTab);$("fcMineTabs").querySelectorAll("button").forEach(b=>b.disabled=true);$("fcMineBody").textContent="회원 서비스 준비 중입니다."}if(screen==="admin"){$("fcAdmin").hidden=false;tabs($("fcAdminTabs"),adminLabels,adminTab);$("fcAdminTabs").querySelectorAll("button").forEach(b=>b.disabled=true);$("fcAdminBody").textContent="관리자 인증 서버 연결 전 화면입니다. 실제 회원 정보는 표시되지 않습니다."}}})();
})();