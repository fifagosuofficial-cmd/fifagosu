(()=>{"use strict";
const $=id=>document.getElementById(id),root=document.querySelector(".fg-community");if(!root)return;
const screen=root.dataset.screen,api="/api/community/",policy="2026-11-v2",labels={all:"전체",popular:"인기글",free:"자유게시판",squad:"스쿼드 평가",review:"선수 후기",tips:"공략·팁",pack:"강화·득템"},prefixes={normal:"일반",question:"질문",answer:"답변",notice:"공지"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const authorCheck=ok=>ok===true?'<span class="fc-verified" role="img" aria-label="인증된 운영 계정" title="인증된 운영 계정">✓</span>':"";
const catLevels=[[0,"0강냥",0],[30,"1강냥",1],[100,"3강냥",3],[500,"5강냥",5],[2000,"8강냥",8],[8000,"11강냥",11],[16000,"13강냥",13]];
const catIcon=r=>{if(!r||!Number.isInteger(r.level)||r.level<1||r.level>catLevels.length)return "";const grade=catLevels[r.level-1][2],label=grade+"강냥";return '<span class="fc-cat" title="'+esc(label+' · '+r.points+' XP')+'" role="img" aria-label="'+esc(label)+'"><img src="/assets/ranks/cat-'+grade+'.svg" alt="" width="28" height="28"></span>'};
const authorName=x=>catIcon(x.rank)+authorCheck(x.verified)+esc(x.nickname);
function rankPanel(r){if(!r)return;const el=$("fcRank");if(!el)return;el.hidden=false;const max=r.next===null,progress=max?100:Math.min(100,Math.max(0,(r.points-r.floor)/(r.next-r.floor)*100));el.innerHTML='<div class="fc-rank-summary">'+catIcon(r)+'<div><b>'+esc(r.name)+'</b><small>'+r.points.toLocaleString()+' XP'+(max?' · 최고 레벨':' / '+r.next.toLocaleString()+' XP')+'</small></div></div><div class="fc-rank-track"><i style="width:'+progress+'%"></i></div><small>게시글 +5 XP (하루 3개), 댓글 +1 XP (하루 8개), 받은 추천 글 +3 / 댓글 +2 XP (삭제·숨김·추천 취소 시 차감)</small><details class="fc-rank-guide"><summary>고양이 성장 단계 보기</summary><div>'+catLevels.map(([points,name,grade],i)=>'<span>'+catIcon({level:i+1,name,points})+'<b>'+esc(name)+'</b><small>'+points.toLocaleString()+' XP</small></span>').join("")+'</div></details>'}
const date=n=>new Date(n*1000).toLocaleString("ko-KR"),status=(s,bad=false)=>{$("fcStatus").textContent=s;$("fcStatus").classList.toggle("fc-error",bad)};
async function get(path){const r=await fetch(api+path,{cache:"no-store"}),j=await r.json();if(!r.ok){const err=Error(j.message||"회원 서비스 준비 중입니다.");err.unavailable=j.enabled===false;throw err}return j}
async function post(path,b){const r=await fetch(api+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}),j=await r.json();if(!r.ok)throw Error(j.message||"요청 실패");return j}
const act=f=>async e=>{e?.preventDefault();try{await f(e)}catch(err){status(err.message,true)}};
const delegated=(selector,f)=>async e=>{if(!e.target.closest(selector))return;return act(f)(e)};
const form=f=>Object.fromEntries(new FormData(f)),btn=(label,attr,id)=>'<button type="button" '+attr+'="'+esc(id)+'">'+esc(label)+'</button>';
let member=null,category="all",page=1,selected=0,mine=null,adminData=null,mineTab="squads",adminTab="overview",reviewCard=0;
const query=new URLSearchParams(location.search);if(Object.hasOwn(labels,query.get("category")))category=query.get("category");reviewCard=Number(query.get("card")||0);page=Math.min(100,Math.max(1,Number(query.get("page"))||1));
let currentPost=null,currentComments=[],replyTo=null,commentSort="new",editId=0;
const listURL=()=>{const p=new URLSearchParams();if(category!=="all")p.set("category",category);if(page>1)p.set("page",page);if(reviewCard)p.set("card",reviewCard);const q=$("fcSearch")?.value;if(q)p.set("q",q);const mode=$("fcSearchMode")?.value;if(mode&&mode!=="all")p.set("search",mode);return "/board/"+(p.size?"?"+p:"")};
const postURL=id=>{const u=new URL(listURL(),location.origin);u.searchParams.set("id",id);return u.pathname+u.search};
const writeURL=(id=0)=>{const u=new URL(listURL(),location.origin);u.searchParams.set(id?"edit":"write",id||"1");return u.pathname+u.search};
function tabs(el,items,key){el.innerHTML=Object.entries(items).map(([k,v])=>'<button type="button" data-tab="'+k+'" aria-pressed="'+(key===k)+'">'+esc(v)+'</button>').join("")}
function recentSquad(){try{return JSON.parse(localStorage.getItem("fg-squad-v1")||"null")}catch{return null}}
function squadLink(s){try{return "/squad/?s="+encodeURIComponent(typeof s==="string"?s:JSON.stringify(s))}catch{return "/squad/"}}
function profile(){document.dispatchEvent(new CustomEvent("fg:member",{detail:member}));const active=member&&!member.suspended&&!member.needsPolicy;$("fcLogin").hidden=screen!=="mypage"||!!member&&(!member.needsPolicy||member.suspended);if(member?.needsPolicy&&!member.suspended){$("fcLoginTitle").textContent="가입 안내 갱신 · 재동의";$("fcSignIn").textContent="확인하고 다시 동의하기";} $("fcProfileForm").hidden=!!member?.needsPolicy;$("fcProfile").hidden=!member||screen!=="mypage";if(screen==="board"||screen==="admin")$("fcAccountLink").innerHTML=member?.nickname?authorName({...member,verified:member.admin})+" · 마이페이지":"로그인";if(member){rankPanel(member.rank);$("fcProfileCheck").hidden=member.admin!==true;$("fcProfileForm").nickname.value=member.nickname||"";$("fcAdminLink").hidden=!member.admin||member.needsPolicy}
 if($("fcWrite"))$("fcWrite").disabled=!active||!member.nickname;
 if($("fcMine"))$("fcMine").hidden=!active||!member.nickname;
 if($("fcAdmin"))$("fcAdmin").hidden=!active||!member.admin||!member.nickname;
}
$("fcSignIn").onclick=act(async()=>{const body={age:$("fcAge").checked,terms:$("fcTerms").checked,privacy:$("fcPrivacy").checked,policy};if(member?.needsPolicy){await post("consent",body);location.reload();return}const j=await post("login",body);location.assign(j.url)});
$("fcProfileForm").onsubmit=act(async e=>{await post("profile",form(e.target));location.reload()});
$("fcLogout").onclick=act(async()=>{await post("logout",{});location.reload()});
$("fcWithdraw").onclick=act(async()=>{if(prompt("탈퇴하면 작성한 글·댓글 및 저장 정보가 삭제됩니다. 계속하려면 '탈퇴'를 입력하세요.")!=="탈퇴")return;await post("withdraw",{confirm:"탈퇴"});location.assign("/")});
const boardDateFormat=opts=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",...opts}),boardDay=boardDateFormat({year:"numeric",month:"2-digit",day:"2-digit"}),boardClock=boardDateFormat({hour:"2-digit",minute:"2-digit",hourCycle:"h23"}),boardMonth=boardDateFormat({month:"2-digit",day:"2-digit"});
const boardTime=n=>{const d=new Date(n*1000);return boardDay.format(d)===boardDay.format(new Date())?boardClock.format(d):boardMonth.format(d)};
const count=n=>Number.isSafeInteger(n)&&n>=0?n.toLocaleString("ko-KR"):"—";
function boardRows(posts,preview=false){
 $("fcPosts").innerHTML=posts.length?posts.map(x=>{
 const type=x.prefix!=="normal"?prefixes[x.prefix]:labels[x.category],notice=x.prefix==="notice",title=esc(x.title);
 const text=preview?'<span class="fc-post-title">'+title+'</span>':'<a class="fc-post-title" href="'+esc(postURL(x.id))+'" data-post="'+x.id+'" '+(selected===x.id?'aria-current="page"':"")+' >'+title+'</a>';
 return '<tr class="'+(notice?"fc-notice ":"")+(x.likes>=30?"fc-hot ":"")+(selected===x.id?"fc-current-post":"")+'"><td class="fc-type" data-kind="'+esc(x.prefix==="normal"?x.category:x.prefix)+'">'+esc(type)+'</td><td class="fc-title-cell">'+text+(x.replies?'<span class="fc-replies" aria-label="댓글 '+x.replies+'">['+count(x.replies)+']</span>':"")+(x.squad?'<small class="fc-attach">스쿼드</small>':"")+'</td><td class="fc-author" title="'+esc(x.nickname)+'">'+authorName(x)+'</td><td class="fc-date">'+esc(boardTime(x.created))+'</td><td class="fc-count">'+count(x.views)+'</td><td class="fc-count fc-likes">'+esc(Number.isSafeInteger(x.likes)?x.likes.toLocaleString("ko-KR"):"—")+'</td></tr>';
 }).join(""):'<tr><td colspan="6" class="fc-empty">'+(category==="popular"?"추천 30개 이상인 게시글이 아직 없습니다.":"등록된 게시글이 없습니다.")+'</td></tr>';
}
let listSeq=0,postSeq=0,listReady=false;
async function loadPosts(){
 const seq=++listSeq;
 tabs($("fcTabs"),labels,category);$("fcPage").textContent=page;
 $("fcWrite").hidden=category==="popular";$("fcWrite").disabled=category==="popular"||!member?.nickname||!!member.suspended;
 $("fcPopularHint").hidden=category!=="popular";
 const p=new URLSearchParams({category,page,q:$("fcSearch").value,search:$("fcSearchMode").value});if(reviewCard&&category==="review")p.set("card",reviewCard);
 const j=await get("posts?"+p);if(seq!==listSeq)return;
 listReady=true;boardRows(j.posts);$("fcPrev").disabled=page===1;$("fcNext").disabled=j.posts.length<30;history.replaceState(null,"",selected?postURL(selected):listURL());
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
function setBoardMode(mode){$("fcBoardList").hidden=mode==="write";$("fcPost").hidden=mode!=="post";$("fcComposer").hidden=mode!=="write";$("fcTabs").hidden=mode==="write";$("fcListTitle").hidden=mode!=="post";root.classList.toggle("fc-reading",mode==="post");if(mode!=="post"){selected=0;const ad=$("fcBoardAd");if(ad)$("fcBoardList").prepend(ad)}document.dispatchEvent(new CustomEvent("fg:ad-layout"))}
const net=x=>(x.likes||0)-(x.dislikes||0);
function commentRow(c,best=false){return '<article class="fc-comment '+(c.parent_id?'fc-reply':'')+'"><div class="fc-comment-head">'+(best?'<b class="fc-best">BEST</b>':"")+'<b>'+authorName(c)+'</b><small>'+date(c.created)+'</small></div><p class="fc-text">'+esc(c.body)+'</p><div class="fc-comment-actions">'+voteButtons(c,"comment")+(canAct()?btn("답글","data-reply",c.id):"")+(c.own?btn("수정","data-edit-comment",c.id)+btn("삭제","data-delete-comment",c.id):"")+(member?.admin?btn("숨김","data-hide-comment",c.id):"")+'</div></article>'}
function renderComments(){const rows=[...currentComments],ids=new Set(rows.map(x=>x.id)),sort=(a,b)=>commentSort==="best"?net(b)-net(a)||a.created-b.created:a.created-b.created,parents=rows.filter(c=>!c.parent_id||!ids.has(c.parent_id)).sort(sort),best=new Set(rows.filter(c=>net(c)>=5).sort((a,b)=>net(b)-net(a)).slice(0,3).map(c=>c.id));$("fcCommentList").innerHTML=parents.map(c=>commentRow(c,best.has(c.id))+rows.filter(x=>x.parent_id===c.id&&x.id!==c.id).sort(sort).map(x=>commentRow(x,best.has(x.id))).join("")).join("")||'<p class="fc-note">첫 댓글을 남겨보세요.</p>'}
async function readPost(id,record=false,preloaded=null){
 const seq=++postSeq,draft=$("fcComment")?.elements.body?.value||"",parent=replyTo;
 if(record){replyTo=null;selected=id;setBoardMode("post");$("fcPost").innerHTML='<p class="fc-note" role="status">게시글 불러오는 중…</p>';window.scrollTo(0,0)}
 const j=await (preloaded||get("post?id="+id));if(seq!==postSeq)return;if(j.error)throw j.error;
 const p=j.post;currentPost=p;currentComments=j.comments;selected=id;setBoardMode("post");
 if(record)void recordView(id);
 const ad=$("fcBoardAd");if(ad)$("fcBoardList").prepend(ad);
 $("fcPost").innerHTML='<nav class="fc-detail-nav"><a href="'+esc(listURL())+'">← 목록으로</a><span>'+esc(labels[p.category]||"게시판")+'</span></nav><header class="fc-detail-head"><h1>'+esc(p.title)+'</h1><div class="fc-post-meta"><b>'+authorName(p)+'</b><span>'+date(p.created)+'</span><span>조회 '+count(p.views)+' · 댓글 '+j.comments.length+'</span></div></header><div class="fc-post-body fc-text">'+esc(p.body)+(p.squad?'<p><a href="'+esc(squadLink(p.squad))+'">첨부 스쿼드 불러오기</a></p>':"")+(p.card_id?'<p><a href="/cards?card='+p.card_id+'">선수 카드 검색</a></p>':"")+'</div><div class="fc-post-votes">'+voteButtons(p,"post")+'</div><div class="fc-post-tools">'+btn("공유","data-action","share")+(canAct()?btn(p.bookmarked?"스크랩 취소":"스크랩","data-action","bookmark")+btn("신고","data-action","report"):"")+(p.own?'<a class="fc-tool-link" href="'+esc(writeURL(p.id))+'">수정</a>'+btn("삭제","data-action","delete-post"):"")+(member?.admin?btn("숨김","data-action","hide")+btn("이동","data-action","move")+(p.category==="free"?btn(p.prefix==="notice"?"공지 해제":"공지 고정","data-action","pin"):""):"")+'</div><section class="fc-comments"><div class="fc-comment-heading"><h2>댓글 '+j.comments.length+'개</h2><div class="fc-sort"><button type="button" data-sort-comment="new" aria-pressed="'+(commentSort==="new")+'">등록순</button><button type="button" data-sort-comment="best" aria-pressed="'+(commentSort==="best")+'">추천순</button></div></div><div id="fcCommentList"></div>'+(canAct()?'<form id="fcComment" class="fc-comment-form"><div id="fcReplyLabel" class="fc-note" hidden></div><label for="fcCommentBody">댓글 작성</label><textarea id="fcCommentBody" name="body" maxlength="2000" required placeholder="댓글을 입력해 주세요."></textarea><div class="fc-comment-footer"><span id="fcCommentCount" class="fc-note">0 / 2,000자</span><button class="fc-primary">댓글 등록</button></div></form>':'<p class="fc-login-note"><a href="/mypage/">로그인</a> 후 댓글을 작성할 수 있습니다.</p>')+'</section><nav class="fc-detail-nav"><a href="'+esc(listURL())+'">← 목록으로</a></nav>';
 if(ad)$("fcPost").querySelector(".fc-comments").before(ad);
 document.dispatchEvent(new CustomEvent("fg:ad-layout"));
 renderComments();
 if(!record||!listReady)void loadPosts().catch(()=>{if(!listReady)$("fcPosts").innerHTML='<tr><td colspan="6" class="fc-empty">게시글 목록을 불러오지 못했습니다.</td></tr>'});
 if($("fcComment")){const body=$("fcCommentBody");if(!record){body.value=draft;replyTo=parent}const update=()=>{$("fcCommentCount").textContent=body.value.length.toLocaleString()+" / 2,000자";body.style.height="auto";body.style.height=Math.max(132,body.scrollHeight+2)+"px"};body.addEventListener("input",update);update();showReply();
 $("fcComment").onsubmit=act(async e=>{const b=form(e.target);if(replyTo)b.parent_id=replyTo.id;await post("comment",{post_id:id,...b});body.value="";replyTo=null;await readPost(id)})}
}
function showReply(){const el=$("fcReplyLabel");if(!el)return;el.hidden=!replyTo;el.innerHTML=replyTo?esc(replyTo.nickname)+"님에게 답글 "+btn("취소","data-cancel-reply","1"):""}
function composer(){
 const c=$("fcCategory").value;$("fcPrefix").innerHTML=Object.entries(prefixes).filter(([k])=>k==="normal"||c==="free"&&(k!=="notice"||member?.admin)).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("");
 $("fcSquadAttach").hidden=c!=="squad"||!recentSquad();$("fcReviewAttach").hidden=c!=="review";
}
function markSelectedPost(){for(const a of $("fcPosts").querySelectorAll("[data-post]")){const active=Number(a.dataset.post)===selected;a.closest("tr").classList.toggle("fc-current-post",active);if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")}}
function boardError(err){status(err.message||"게시글을 불러오지 못했습니다.",true);if(!currentPost||currentPost.id!==selected)$("fcPost").innerHTML='<p class="fc-note">게시글을 불러오지 못했습니다. <a href="'+esc(listURL())+'">목록으로</a></p>'}
function openBoardPost(id,push=true){if(push)history.pushState(null,"",postURL(id));void readPost(id,true).then(markSelectedPost).catch(boardError)}
function returnBoard(push=true){++postSeq;setBoardMode("list");currentPost=null;replyTo=null;if(push)history.pushState(null,"",listURL());markSelectedPost();if(!listReady)void loadPosts().catch(e=>status(e.message,true))}
function plainClick(e){return e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey}
if(screen==="board"){
 $("fcPosts").addEventListener("click",e=>{const a=e.target.closest("a[data-post]");if(!a||!plainClick(e))return;e.preventDefault();openBoardPost(Number(a.dataset.post))});
 $("fcPost").addEventListener("click",e=>{const a=e.target.closest("a");if(!a||!plainClick(e)||a.getAttribute("href")!==listURL())return;e.preventDefault();returnBoard()});
 window.addEventListener("popstate",()=>{const p=new URLSearchParams(location.search);if(p.has("edit")||p.has("write")||p.get("compose")==="1"){location.reload();return}const id=Number(p.get("id"));if(id>0)openBoardPost(id,false);else returnBoard(false)});
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
const adminLabels={overview:"대시보드",traffic:"방문 통계",reports:"신고 관리",feedback:"건의·오류",members:"회원 관리",posts:"게시글 관리",comments:"댓글 관리",audit:"처리 이력"};
async function loadAdmin(){adminData=await get("admin");$("fcAdminUpdated").textContent="갱신 "+date(adminData.generated);if(adminTab==="traffic")await loadTraffic();else renderAdmin()}
const metric=(label,value,sub,tab)=>'<button type="button" class="fc-kpi" data-jump="'+tab+'"><span>'+esc(label)+'</span><strong>'+count(value)+'</strong><small>'+esc(sub)+'</small></button>';
function adminOverview(d){const st=d.stats||{},days=d.days||[],max=Math.max(1,...days.map(x=>Math.max(x.members,x.posts,x.comments)));
const recent=(rows,fn)=>rows.length?rows.slice(0,5).map(fn).join(""):'<p class="fc-note">아직 기록이 없습니다.</p>';
return '<div class="fc-admin-kpis">'+metric("전체 회원",st.members,"오늘 가입 "+count(st.new_members)+"명","members")+metric("공개 게시글",st.posts,"오늘 "+count(st.new_posts)+"개","posts")+metric("공개 댓글",st.comments,"오늘 "+count(st.new_comments)+"개","comments")+metric("미처리 신고",st.open_reports,"처리 대기","reports")+metric("미답변 건의",st.open_feedback,"답변 대기","feedback")+metric("게시글 누적 조회",st.views,"정지 회원 "+count(st.suspended)+"명","posts")+'</div><div class="fc-admin-charts"><section class="fc-dash-card"><h3>최근 7일 활동</h3><div class="fc-chart-legend"><span>● 가입</span><span>● 글</span><span>● 댓글</span></div><div class="fc-chart">'+days.map(d=>'<div class="fc-chart-day"><div class="fc-chart-bars">'+["members","posts","comments"].map(k=>'<i class="fc-chart-'+k+'" style="height:'+Math.max(0,d[k]/max*100)+'%" title="'+esc(d.day+" "+({members:"가입",posts:"글",comments:"댓글"}[k])+" "+d[k])+'"><small>'+d[k]+'</small></i>').join("")+'</div><span>'+esc(d.day.slice(5))+'</span></div>').join("")+'</div></section><section class="fc-dash-card"><h3>처리할 항목</h3>'+recent(d.reports.filter(x=>x.status==="open"),x=>entry("신고 #"+x.id,x.reason,'<a href="/board/?id='+x.post_id+'">게시글</a> '+btn("처리","data-admin","report:"+x.id)))+recent(d.feedback.filter(x=>x.status==="open"),x=>entry(x.nickname+" · 건의",x.body,btn("답변","data-admin","feedback:"+x.id)))+'</section></div><div class="fc-admin-charts"><section class="fc-dash-card"><h3>최근 가입 회원</h3>'+recent(d.members,x=>entry(x.nickname||"닉네임 미설정",date(x.created)))+'</section><section class="fc-dash-card"><h3>최근 게시글</h3>'+recent(d.posts,x=>entry(x.title,date(x.created),' <a href="/board/?id='+x.id+'">보기</a>'))+'</section></div><section class="fc-dash-card"><h3>최근 운영 기록</h3>'+recent(d.audit,x=>entry(x.action+" · "+x.target,date(x.created)+" · "+x.reason))+'</section>'}

let trafficData=null,trafficRange=7,trafficError="",trafficSeq=0;
const trafficNames={home:"홈",diag:"전적 진단",market:"이적시장",trade:"선수 거래소",squad:"AI 스쿼드",cards:"카드 검색",sim:"강화·현질 효율",news:"소식",board:"게시판",fun:"킥킥",guide:"가이드",other:"기타",direct:"직접 접속 / 출처 없음",fmkorea:"에펨코리아",inven:"인벤",naver:"네이버",google:"구글",dcinside:"디시인사이드",youtube:"유튜브",daum:"다음",instagram:"인스타그램",desktop:"PC",mobile:"모바일",tablet:"태블릿"};
async function loadTraffic(){const seq=++trafficSeq;trafficError="";trafficData=null;renderAdmin();try{const d=await get("admin/traffic?range="+trafficRange);if(seq!==trafficSeq)return;trafficData=d;$("fcAdminUpdated").textContent="갱신 "+date(d.generated)}catch(e){if(seq!==trafficSeq)return;trafficError="방문 통계를 불러오지 못했습니다. 새로고침해 주세요."}if(adminTab==="traffic")renderAdmin()}
function trafficMetric(label,value,sub){return '<div class="fc-kpi"><span>'+esc(label)+'</span><strong>'+count(value)+'</strong><small>'+esc(sub)+'</small></div>'}
function trafficBreakdown(title,rows){const total=rows.reduce((s,x)=>s+x.n,0);return '<section class="fc-dash-card"><h3>'+esc(title)+'</h3>'+(total?rows.map(x=>{const pct=x.n/total*100;return '<div class="fc-traffic-row"><div><b>'+esc(trafficNames[x.label]||x.label)+'</b><span>'+count(x.n)+' · '+pct.toFixed(1)+'%</span></div><div class="fc-traffic-track"><i style="width:'+pct+'%"></i></div></div>'}).join(""):'<p class="fc-note">집계된 기록이 없습니다.</p>')+'</section>'}
function trafficView(){
 const controls='<div class="fc-traffic-controls"><span>한국 시간 기준 · 추정치</span><div class="fc-tabs">'+[1,7,30].map(n=>'<button type="button" data-traffic-range="'+n+'" aria-pressed="'+(trafficRange===n)+'">'+(n===1?"오늘":"최근 "+n+"일")+'</button>').join("")+'</div></div>';
 if(!trafficData)return controls+'<p class="fc-note">'+esc(trafficError||"방문 통계를 불러오는 중입니다…")+'</p>';
 const d=trafficData,today=d.days.at(-1),days=d.days.slice(-trafficRange),sum=k=>days.reduce((s,x)=>s+x[k],0),max=Math.max(1,...days.map(x=>Math.max(x.visitors,x.views)));
 const visitors=sum("visitors"),views=sum("views"),hours=Array.from({length:24},(_,i)=>({label:i,n:d.hours.find(x=>Number(x.label)===i)?.n||0})),hm=Math.max(1,...hours.map(x=>x.n));
 return controls+'<div class="fc-admin-kpis fc-traffic-kpis">'+trafficMetric("오늘 방문자",today.visitors,"일별 브라우저 추정")+trafficMetric("오늘 페이지 조회",today.views,"동일 메뉴 분당 중복 제외")+trafficMetric("최근 5분 활동",d.live,"공개 메뉴 활동 추정")+trafficMetric("선택 기간 방문 합계",visitors,"일별 합산 · 중복 방문 포함")+trafficMetric("선택 기간 조회수",views,"조회 / 방문 "+(visitors?(views/visitors).toFixed(1):"0"))+trafficMetric("선택 기간 신규 가입",d.signups,"전체 가입 수 · 방문 연결 안 함")+'</div><section class="fc-dash-card fc-traffic-trend"><h3>일별 방문 추이</h3><div class="fc-chart-legend"><span>● 방문자</span><span>● 페이지 조회</span></div><div class="fc-traffic-scroll"><div class="fc-traffic-chart" style="--days:'+days.length+'">'+days.map(x=>'<div class="fc-chart-day"><div class="fc-chart-bars"><i class="fc-chart-members" style="height:'+x.visitors/max*100+'%" title="방문 '+count(x.visitors)+'"><small>'+count(x.visitors)+'</small></i><i class="fc-chart-posts" style="height:'+x.views/max*100+'%" title="조회 '+count(x.views)+'"><small>'+count(x.views)+'</small></i></div><span>'+esc(x.day.slice(5))+'</span></div>').join("")+'</div></div></section><div class="fc-admin-charts">'+trafficBreakdown("인기 메뉴 · 조회수",d.pages)+trafficBreakdown("유입 경로 · 조회수",d.sources)+trafficBreakdown("기기별 · 조회수",d.devices)+'<section class="fc-dash-card"><h3>시간대별 조회 (KST)</h3><div class="fc-traffic-hours">'+hours.map(x=>'<div><i title="'+x.label+'시 · '+count(x.n)+'회" style="height:'+x.n/hm*100+'%"></i><small>'+String(x.label).padStart(2,"0")+'</small></div>').join("")+'</div></section></div><p class="fc-note">수집 시작 이후 최대 30일 기록입니다. 로그인한 관리자, 추적 거부 이용자, 일반적인 봇은 제외됩니다. 서로 다른 브라우저·기기는 별개이며 날짜를 넘긴 동일 이용자는 연결하지 않습니다. 가입 수는 방문자와 연결하지 않으므로 정확한 가입 전환율은 아닙니다. 유입 정보가 차단되면 직접 접속으로 집계됩니다.</p>';
}
function selectAdmin(tab){adminTab=tab;if(tab==="traffic")return loadTraffic();renderAdmin()}

function renderAdmin(){
 tabs($("fcAdminTabs"),adminLabels,adminTab);let h='<h2>'+adminLabels[adminTab]+'</h2>';
 if(adminTab==="overview")h+=adminOverview(adminData);
 else if(adminTab==="traffic")h+=trafficView();
 else{
 const rows=adminData[adminTab]||[];h+='<p class="fc-note">최근 최대 100건 · '+rows.length+'건 표시</p><label class="fc-admin-filter">검색<input type="search" id="fcAdminSearch" placeholder="현재 목록에서 검색"></label><div id="fcAdminEntries">';
 if(adminTab==="reports")h+=entries(rows,x=>entry("신고 #"+x.id+" · 글 #"+x.post_id,x.reason+" · "+x.status,'<a href="/board/?id='+x.post_id+'">글 보기</a> '+(x.status==="open"?btn("처리 완료","data-admin","report:"+x.id):"")));
 if(adminTab==="feedback")h+=entries(rows,x=>entry(x.nickname+" · "+x.kind,x.body+(x.reply?"\n답변: "+x.reply:""),btn("답변","data-admin","feedback:"+x.id)));
 if(adminTab==="members")h+=entries(rows,x=>entry(x.nickname||"닉네임 미설정",date(x.created)+" · "+(x.suspended?"정지":"정상"),btn(x.suspended?"해제":"정지","data-admin","member:"+x.id+":"+(x.suspended?0:1))));
 if(adminTab==="posts")h+=entries(rows,x=>entry(x.title,date(x.created)+" · "+(labels[x.category]||x.category)+" · 조회 "+count(x.views)+" · "+(x.hidden?"숨김":"공개"),'<a href="/board/?id='+x.id+'">보기</a> '+btn(x.hidden?"복구":"숨김","data-admin","post:"+x.id+":"+(x.hidden?0:1))));
 if(adminTab==="comments")h+=entries(rows,x=>entry(x.body,date(x.created)+" · 글 #"+x.post_id+" · "+(x.hidden?"숨김":"공개"),'<a href="/board/?id='+x.post_id+'">글 보기</a> '+btn(x.hidden?"복구":"숨김","data-admin","comment:"+x.id+":"+(x.hidden?0:1))));
 if(adminTab==="audit")h+=entries(rows,x=>entry(x.action+" · "+x.target,date(x.created)+" · "+x.reason));
 h+='</div>'}
 $("fcAdminBody").innerHTML=h;
 if($("fcAdminSearch"))$("fcAdminSearch").oninput=e=>{const q=e.target.value.trim().toLowerCase();$("fcAdminEntries").querySelectorAll(".fc-entry").forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(q))};
}
if(screen==="admin"){
 $("fcAdminTabs").onclick=act(async e=>{const b=e.target.closest("[data-tab]");if(b)await selectAdmin(b.dataset.tab)});
 $("fcAdminRefresh").onclick=act(loadAdmin);
 $("fcAdminBody").onclick=act(async e=>{const range=e.target.closest("[data-traffic-range]");if(range){trafficRange=Number(range.dataset.trafficRange);await loadTraffic();return}const jump=e.target.closest("[data-jump]");if(jump&&Object.hasOwn(adminLabels,jump.dataset.jump)){await selectAdmin(jump.dataset.jump);return}const b=e.target.closest("[data-admin]");if(!b)return;const [type,id,flag]=b.dataset.admin.split(":"),reason=prompt(type==="feedback"?"회원에게 전달할 답변":"처리 사유");if(!reason)return;await post("admin/"+type,{id:type==="member"?id:Number(id),reason,hidden:flag==="1",suspended:flag==="1"});await loadAdmin()});
}
(async()=>{try{const meP=get("me"),initialId=screen==="board"?Number(query.get("id")):0,initialPost=initialId>0?get("post?id="+initialId).catch(error=>({error})):null;const j=await meP;member=j.member;profile();if(screen==="board"){if(initialId>0)await readPost(initialId,true,initialPost);else if(Number(query.get("edit"))>0)await openComposer(Number(query.get("edit")));else if(query.has("write")||query.get("compose")==="1")await openComposer();else{setBoardMode("list");await loadPosts()}}
 if(screen==="mypage"&&member?.nickname&&!member.suspended&&!member.needsPolicy)await loadMine();if(screen==="admin"){if(member?.admin&&member.nickname&&!member.suspended&&!member.needsPolicy)await loadAdmin();else status("관리자만 접근할 수 있습니다.",true)}
}catch(e){if(e.unavailable){status("");}else status("회원 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",true);if(screen==="board"){["fcFind","fcPrev","fcNext","fcWrite","fcSearch"].forEach(k=>$(k).disabled=true);previewBoard();$("fcTabs").onclick=e=>{const b=e.target.closest("[data-tab]");if(!b)return;category=b.dataset.tab;previewBoard()}}if(screen==="mypage"){ $("fcLogin").hidden=false;$("fcSignIn").disabled=true; $("fcMine").hidden=false;tabs($("fcMineTabs"),mineLabels,mineTab);$("fcMineTabs").querySelectorAll("button").forEach(b=>b.disabled=true);$("fcMineBody").textContent="회원 서비스 준비 중입니다."}if(screen==="admin"){$("fcAdmin").hidden=false;tabs($("fcAdminTabs"),adminLabels,adminTab);$("fcAdminTabs").querySelectorAll("button").forEach(b=>b.disabled=true);$("fcAdminBody").textContent="관리자 인증 서버 연결 전 화면입니다. 실제 회원 정보는 표시되지 않습니다."}}})();
})();