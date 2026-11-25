/* Public manual ads. Never initialize ads inside hidden views or in narrow side gutters. */
(()=>{
"use strict";
const cfg=window.FG_AD_CONFIG||{},layout=document.querySelector('body>.wrap[data-ad-layout="public"]');
if(!layout)return;
const slots=[...layout.querySelectorAll("[data-ad-slot]")],ids=cfg.slots&&typeof cfg.slots==="object"?cfg.slots:{};
const client=String(cfg.adsense_client||"").trim(),valid=v=>/^\d+$/.test(String(v||""));
const enabled=cfg.enabled===true&&cfg.provider==="adsense"&&/^ca-pub-\d{6,}$/.test(client);
const preview=!cfg.enabled&&new URLSearchParams(location.search).get("ad-preview")==="1";
const activeView=()=>document.body.dataset.view||"";
const rail=el=>el.classList.contains("fg-ad-rail");
const slotID=el=>String(ids[el.dataset.adSlot]||(el.dataset.adSlot.startsWith("sim-")?ids["sim-1"]:"")||(rail(el)?"":ids.center)||"");
const allowed=()=>{const path=location.pathname,view=activeView();
 if(view==="board"&&(cfg.allow_community!==true||new URLSearchParams(location.search).has("write")||new URLSearchParams(location.search).has("edit")||new URLSearchParams(location.search).has("compose")))return false;
 if((path.startsWith("/press")||path.startsWith("/news/")&&path!=="/news/")&&cfg.allow_syndicated_news!==true)return false;
 return true};
// The outer wrapper may be much wider than its actual visible content.
function fits(){const main=[...layout.querySelectorAll(":scope > main")].find(el=>!el.hidden&&el.getClientRects().length);const outer=layout.getBoundingClientRect(),r=(main||layout).getBoundingClientRect(),w=document.documentElement.clientWidth;
 const left=r.left-outer.left-172,right=r.right-outer.left+12;
 layout.style.setProperty("--ad-left",left+"px");layout.style.setProperty("--ad-right",right+"px");
 return w>=1200&&r.left>=180&&w-r.right>=180}
function visible(el){return !el.parentElement.closest("[hidden]")&&(!rail(el)||fits())&&!(activeView()==="board"&&new URLSearchParams(location.search).has("write"))&&!(activeView()==="board"&&new URLSearchParams(location.search).has("edit"))}
let scriptPromise;
function load(){if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const script=document.createElement("script");script.async=true;script.crossOrigin="anonymous";script.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+encodeURIComponent(client);script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});return scriptPromise}
const mounted=new WeakSet(),pending=new WeakSet();
async function mount(el){if(mounted.has(el)||pending.has(el))return;pending.add(el);try{await load();if(!visible(el)||!allowed())return;const ad=document.createElement("ins");ad.className="adsbygoogle";ad.dataset.adClient=client;ad.dataset.adSlot=slotID(el);if(rail(el)){ad.style.cssText="display:inline-block;width:160px;height:600px"}else{ad.style.display="block";ad.dataset.adFormat="auto";ad.dataset.fullWidthResponsive="true"}el.replaceChildren(ad);el.hidden=false;el.classList.add("is-live");mounted.add(el);(window.adsbygoogle=window.adsbygoogle||[]).push({});new MutationObserver(()=>{if(ad.dataset.adStatus==="unfilled"){el.classList.remove("is-live");el.hidden=true}}).observe(ad,{attributes:true,attributeFilter:["data-ad-status"]});if(ad.dataset.adStatus==="unfilled"){el.classList.remove("is-live");el.hidden=true}}catch{el.hidden=true;el.classList.remove("is-live")}finally{pending.delete(el)}}
function update(){for(const el of slots){const show=visible(el);if(preview){el.hidden=!show;el.classList.toggle("is-preview",show);continue}if(!enabled||!allowed()||!show||!valid(slotID(el))){el.hidden=true;continue}if(mounted.has(el)){el.hidden=!el.classList.contains("is-live");continue}void mount(el)}}
update();window.addEventListener("resize",update,{passive:true});document.addEventListener("fg:view",update);document.addEventListener("fg:ad-layout",update);
if(typeof ResizeObserver!=="undefined")new ResizeObserver(update).observe(layout);
})();
