(()=>{"use strict";
if(location.protocol!=="https:")return;
const blocked=()=>navigator.globalPrivacyControl||navigator.doNotTrack==="1"||window.doNotTrack==="1"||navigator.webdriver;
const keys={choice:"fg-traffic-off",daily:"fg-traffic-day"},pages={diag:"diag",market:"market",trade:"trade",squad:"squad",cards:"cards",sim:"sim",calc:"sim",news:"news",press:"news",patch:"news",board:"board",fun:"fun",guide:"guide"};
let storage;try{storage=localStorage;storage.getItem(keys.choice)}catch{return}
const toggle=document.querySelector("[data-fg-traffic-toggle]");
function update(){if(toggle){toggle.disabled=!!blocked();toggle.textContent=blocked()?"브라우저 추적 거부 적용 중":storage.getItem(keys.choice)==="1"?"방문 통계 수집 허용":"방문 통계 수집 거부";toggle.setAttribute("aria-pressed",String(!!blocked()||storage.getItem(keys.choice)==="1"))}}
if(toggle){update();toggle.addEventListener("click",()=>{try{if(storage.getItem(keys.choice)==="1"){storage.removeItem(keys.choice);storage.removeItem(keys.daily)}else{storage.setItem(keys.choice,"1");storage.removeItem(keys.daily)}update()}catch{}})}
if(blocked()){try{storage.removeItem(keys.daily)}catch{}return}
const segment=location.pathname.split("/").filter(Boolean)[0]?.replace(/\.html$/,"")||"";
const page=segment?(segment==="index"?"home":pages[segment]||null):"home";
if(!page)return;
function source(){try{const h=new URL(document.referrer).hostname.toLowerCase(),is=d=>h===d||h.endsWith("."+d);
if(h===location.hostname)return null;
for(const [domain,label] of [["fmkorea.com","fmkorea"],["inven.co.kr","inven"],["naver.com","naver"],["google.com","google"],["google.co.kr","google"],["dcinside.com","dcinside"],["youtube.com","youtube"],["youtu.be","youtube"],["daum.net","daum"],["instagram.com","instagram"]])if(is(domain))return label;
return "other"}catch{return null}}
const device=()=>{const ua=navigator.userAgent||"";return /iPad|Tablet|Android(?!.*Mobile)/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)?"tablet":/Mobile|iPhone|Android/i.test(ua)?"mobile":"desktop"};
function state(){const day=Math.floor((Date.now()+32400000)/86400000);let v;try{v=JSON.parse(storage.getItem(keys.daily)||"null")}catch{}if(!v||v.day!==day||! /^[a-f0-9]{32}$/.test(v.token||"")){v={day,token:Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,"0")).join(""),source:source()||"direct"};storage.setItem(keys.daily,JSON.stringify(v))}return v}
let last=0,lastDay=-1;
function send(kind){try{if(blocked()||storage.getItem(keys.choice)==="1"||document.visibilityState!=="visible")return;const v=state(),t=Date.now();if(kind===0&&lastDay!==v.day)kind=1;if(kind===0&&t-last<210000)return;last=t;lastDay=v.day;fetch("/api/community/traffic",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:v.token,page,source:v.source,device:device(),kind}),keepalive:true}).catch(()=>{})}catch{}}
if(document.visibilityState==="visible")send(1);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")send(last===0?1:0)});setInterval(()=>send(0),240000);
})();
