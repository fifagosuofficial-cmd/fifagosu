(()=>{"use strict";
const welcome=document.querySelector(".fg-welcome");if(!welcome||location.protocol!=="https:")return;
const group=welcome.closest(".fg-account-group"),shell=group.closest(".fg-nav-shell"),img=welcome.querySelector(".fg-welcome-rank"),name=welcome.querySelector(".fg-welcome-name"),xp=welcome.querySelector(".fg-welcome-xp");
const grades=new Set([0,1,3,5,8,11,13]);
function render(m){const valid=!!(m&&!m.suspended&&!m.needsPolicy&&typeof m.nickname==="string"&&m.nickname.trim()&&m.rank&&grades.has(m.rank.grade)&&Number.isSafeInteger(m.rank.points)&&m.rank.points>=0);
welcome.hidden=!valid;if(group.classList.contains("fg-fun-account"))group.hidden=!valid;if(shell)shell.classList.toggle("fg-has-member",valid);if(!valid){name.textContent="";xp.textContent="";img.removeAttribute("src");img.alt="";welcome.removeAttribute("title");return}
name.textContent=m.nickname;xp.textContent="("+m.rank.points.toLocaleString("ko-KR")+" 포인트)";img.src="/assets/ranks/cat-"+m.rank.grade+".svg";img.alt=m.rank.grade+"강냥";welcome.title=m.nickname+"님 환영합니다. "+xp.textContent;
}
document.addEventListener("fg:member",e=>render(e.detail));
async function refresh(){try{const r=await fetch("/api/community/me",{credentials:"same-origin",cache:"no-store"});if(!r.ok){render(null);return}const j=await r.json();render(j.member)}catch{render(null)}}
if(!document.querySelector(".fg-community"))refresh();
window.addEventListener("pageshow",e=>{if(e.persisted)refresh()});
})();
