/* 피파고수 광고 슬롯 어댑터.
   site/config.json에 공개 광고 ID가 모두 설정된 경우에만 외부 광고 스크립트를 불러옵니다. */
(()=>{
"use strict";
const cfg=window.FG_AD_CONFIG||{},slots=[...document.querySelectorAll("[data-ad-slot]")];
if(!slots.length)return;
for(const el of slots){
  el.classList.add("fg-ad-slot");
  el.setAttribute("role","complementary");
  el.setAttribute("aria-label","광고");
}
const client=String(cfg.adsense_client||"").trim();
const ids=cfg.slots&&typeof cfg.slots==="object"?cfg.slots:{};
const adsense=cfg.enabled===true&&cfg.provider==="adsense"&&/^ca-pub-\d{6,}$/.test(client);
if(!adsense){
  if(cfg.enabled===true&&cfg.provider==="custom"){
    for(const el of slots)document.dispatchEvent(new CustomEvent("fg:ad-slot",{detail:{element:el,name:el.dataset.adSlot,slot:String(ids[el.dataset.adSlot]||"")}}));
  }
  return;
}
const ready=slots.filter(el=>/^\d+$/.test(String(ids[el.dataset.adSlot]||"")));
if(!ready.length)return;
const script=document.createElement("script");
script.async=true;
script.crossOrigin="anonymous";
script.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+encodeURIComponent(client);
script.onload=()=>{
  for(const el of ready){
    const ad=document.createElement("ins");
    ad.className="adsbygoogle";
    ad.style.display="block";
    ad.dataset.adClient=client;
    ad.dataset.adSlot=String(ids[el.dataset.adSlot]);
    ad.dataset.adFormat="auto";
    ad.dataset.fullWidthResponsive="true";
    el.replaceChildren(ad);
    el.classList.add("is-live");
    try{(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch(_){el.classList.remove("is-live")}
  }
};
document.head.appendChild(script);
})();
