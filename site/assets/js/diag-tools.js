(function(root){"use strict";
const finite=v=>typeof v==="number"&&Number.isFinite(v),valid=p=>p&&Number.isSafeInteger(p.spId)&&p.spId>0&&Number.isInteger(p.spGrade)&&p.spGrade>=1&&p.spGrade<=13&&typeof p.pos==="string"&&p.pos!=="SUB"&&p.pos!=="UNKNOWN";
const key=p=>p.spId+":"+p.spGrade,identity=p=>key(p)+":"+p.pos,signature=ps=>ps.map(identity).sort().join("|");
function lineup(m){const ps=m.matchInfo?.[0]?.player;if(!Array.isArray(ps)||ps.length!==11||!ps.every(valid)||new Set(ps.map(key)).size!==11)return null;return ps}
function events(matches){const ordered=(matches||[]).filter(m=>Number.isFinite(Date.parse(m.matchDate))).slice().sort((a,b)=>Date.parse(a.matchDate)-Date.parse(b.matchDate)),seen=new Set(),runs=[];let current=null;
 for(const m of ordered){if(m.matchId&&seen.has(m.matchId))continue;if(m.matchId)seen.add(m.matchId);const ps=lineup(m);if(!ps){current=null;runs.push(null);continue}const sig=signature(ps);if(!current||current.sig!==sig){current={sig,ps,matches:[]};runs.push(current)}current.matches.push(m)}
 const out=[];for(let i=1;i<runs.length;i++){const a=runs[i-1],b=runs[i];if(!a||!b||a.matches.length<3||b.matches.length<3||a.sig===b.sig)continue;const changes=diff(a.ps,b.ps);if(changes.length)out.push({before:a,after:b,changes,date:b.matches[0].matchDate})}return out.reverse()}
function diff(a,b){const old=a.filter(p=>!b.some(q=>identity(p)===identity(q))),next=b.filter(p=>!a.some(q=>identity(p)===identity(q))),out=[],used=new Set();
 for(const p of old){let candidates=next.filter(q=>!used.has(q)&&q.spId===p.spId);if(candidates.length!==1)candidates=next.filter(q=>!used.has(q)&&q.spId%1000000===p.spId%1000000);if(candidates.length===1){const q=candidates[0];used.add(q);out.push({old:p,next:q,type:p.spId!==q.spId?"시즌 변경":p.spGrade!==q.spGrade?"강화 변경":"포지션 변경"});continue}out.push({old:p,next:null,type:"선수 변경"})}
 for(const row of out.filter(x=>!x.next)){const cand=next.filter(q=>!used.has(q)&&q.pos===row.old.pos);if(cand.length===1){row.next=cand[0];used.add(cand[0])}}
 for(const q of next.filter(q=>!used.has(q)))out.push({old:null,next:q,type:"선수 변경"});return out}
function rate(rows,num,den){let a=0,b=0;for(const r of rows){if(finite(r?.[num])&&finite(r?.[den])&&r[num]>=0&&r[den]>0&&r[num]<=r[den]){a+=r[num];b+=r[den]}}return b?a/b*100:null}
function avg(rows,fn){const vs=rows.map(fn).filter(finite);return vs.length?vs.reduce((s,v)=>s+v,0)/vs.length:null}
function team(ms){const me=ms.map(m=>m.matchInfo[0]),op=ms.map(m=>m.matchInfo[1]),results=me.map(s=>s.matchDetail?.matchResult).filter(v=>["승","무","패"].includes(v));return {n:ms.length,wr:results.length?results.filter(v=>v==="승").length/results.length*100:null,gf:avg(me,s=>s.shoot?.goalTotal),ga:avg(op,s=>s?.shoot?.goalTotal),rating:avg(me.flatMap(s=>s.player||[]),p=>p.status?.spRating>0?p.status.spRating:null),pass:rate(me.map(s=>s.pass),"passSuccess","passTry"),tackle:rate(me.map(s=>s.defence),"tackleSuccess","tackleTry")}}
function player(ms,p){if(!p)return null;const ps=ms.flatMap(m=>m.matchInfo[0].player||[]).filter(q=>identity(q)===identity(p)).map(q=>q.status||{});return {rating:avg(ps,s=>s.spRating>0?s.spRating:null),goal:avg(ps,s=>s.goal),assist:avg(ps,s=>s.assist),pass:rate(ps,"passSuccess","passTry"),duel:rate(ps,"ballPossesionSuccess","ballPossesionTry"),tackle:rate(ps,"tackle","tackleTry")}}
function compare(e,limit){const n=Math.min(limit,e.before.matches.length,e.after.matches.length),before=e.before.matches.slice(-n),after=e.after.matches.slice(0,n);return {n,before:team(before),after:team(after),changes:e.changes.map(x=>({...x,before:player(before,x.old),after:player(after,x.next)}))}}
function verdict(d){
 const gf=Number(d.gf),ga=Number(d.ga),w=Number(d.win),def=d.lines?.find(x=>x.name==="수비")?.value,atk=d.lines?.find(x=>x.name==="공격")?.value;
 const pick=xs=>xs[(Math.round(gf*100+ga*100+w+(d.n||0))>>>0)%xs.length];
 if(d.n<10)return ["아직 예열 중","10경기 이상 쌓이면 전술 진단이 더 정확해집니다."];
 if(gf>=3&&ga>=2)return [pick(["수비는 상대방 배려 차원인 듯?","수비할 시간에 한 골 더 넣으시네요?","양 팀 골키퍼만 억울한 경기"]), "득점은 강점! 수비 전환과 역습 차단을 점검하세요."];
 if(w>=75)return [pick(["혹시 상대방도 게임하는 거 아시죠?","상대 멘탈까지 강화해 주시는 분","공경에 생계형으로 오셨나요?"]), "높은 승률을 유지한 경기 패턴을 복기해 보세요."];
 if(ga>=3)return [pick(["골키퍼랑 연봉 협상 좀 하셔야겠는데요?","수비수도 직관하러 오셨나 봐요","골문 개방 시간이 좀 긴 편이네요"]), "수비 간격과 센터백 커서 전환부터 점검하세요."];
 if(gf<1.3)return [pick(["골대랑 무슨 사연 있으신가요?","공격수도 재택근무가 되나요?","슈팅 버튼 아껴 쓰시는 편인가 봐요"]), "박스 안 슈팅 기회와 공격 전개를 점검하세요."];
 if(ga<=1&&w>=50)return ["상대방 혈압은 잘 올리시네요","낮은 실점이 강점입니다. 공격 효율도 함께 확인하세요."];
 if(w<40)return [pick(["한 판만 더가 몇 판째죠?","승점 나눔 행사 중이신가요?","오늘도 넥슨과 의견 차이가 있네요"]), "연패 때는 쉬어 가고 낮은 평가 포지션부터 점검하세요."];
 if(atk!=null&&def!=null&&atk-def>=15)return ["공격진이 부양가족이 좀 많네요","공격과 수비 평가 차이가 큽니다. 수비 라인을 점검하세요."];
 const styles={"중거리형":"ZD 버튼만 유독 반짝거리겠네요","롱패스형":"축구 게임에서 택배 사업 중","침투패스형":"스루패스 버튼만 닳는 중","점유형":"공 소유권 등기까지 치시겠어요","역습 성향":"딸깍도 이 정도면 재능 아닌가요?","수세형":"버스 두 대 주차 완료","공격주도형":"수비 버튼은 새것처럼 깨끗하겠네요"};
 return [styles[d.style?.name]||"오늘도 공경 한 판","강점은 유지하고 낮은 평가 포지션을 우선 점검하세요."];
}
function draw(canvas,d){const c=canvas.getContext("2d");if(!c)throw Error("이미지 생성 미지원");canvas.width=1080;canvas.height=1550;const fg="#effaf5",muted="#a0bdb0",green="#35e6aa",orange="#ffc16e";
const rect=(x,y,w,h,color,r=18)=>{c.fillStyle=color;c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);c.fill()};
const t=(v,x,y,size,color=fg,weight=500,align="left",max=980)=>{c.font=weight+" "+size+"px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";c.fillStyle=color;c.textAlign=align;c.textBaseline="middle";let s=String(v??"—");while(s.length>1&&c.measureText(s).width>max)s=s.slice(0,-1);if(s!==String(v??"—"))s=s.slice(0,-1)+"…";c.fillText(s,x,y)};
c.fillStyle="#0e211b";c.fillRect(0,0,1080,1550);rect(0,0,1080,10,green,0);if(d.logo?.complete&&d.logo.naturalWidth){const h=76,w=h*d.logo.naturalWidth/d.logo.naturalHeight;c.drawImage(d.logo,48,25,Math.min(w,350),h)}else t("FIFAGOSU",48,60,36,green,800);t("SQUAD REPORT",1032,60,24,muted,700,"right");const [headline,tip]=verdict(d);t(headline,48,140,49,fg,800);t(d.nickname||"구단주명 비공개",48,205,33,fg,700);t(d.mode+" · 최근 "+d.n+"경기 · "+d.date,48,255,25,muted);
rect(48,295,984,238,"#17382c");t("승률",78,335,28,muted);t(d.win+"%",78,419,82,green,800);t(d.record,78,489,27,fg);t("스쿼드 종합 점수",1002,335,28,muted,500,"right");t(d.score==null?"—":d.score+"점 "+d.grade,1002,419,59,fg,800,"right");t(d.coverage,1002,489,23,muted,500,"right");
rect(48,557,984,306,"#172e26");t("공경 생활기록부",78,596,29,fg,800);
const gf=Number(d.gf),ga=Number(d.ga),gd=gf-ga;
const facts=[["상대 골키퍼 괴롭히기",d.gf+"골 / 경기"],["상대방에게 베푼 자비",d.ga+"골 / 경기"],["그래도 남는 장사",(gd>=0?"+":"")+gd.toFixed(2)+"골 / 경기"],["공경 플레이 성향",d.style?.name||"분석 보류"]];
facts.forEach(([label,value],i)=>{const y=652+i*56;t(label,78,y,27,muted,600);t(value,1002,y,30,i===2&&gd<0?orange:green,800,"right",440)});
const player=(x,y,title,p,color)=>{rect(x,y,480,200,"#172e26");t(title,x+24,y+37,24,color,700);t(p?.label||"평가 표본 부족",x+24,y+93,29,fg,700,"left",432);t(p?String(p.score)+"점 "+p.grade:"—",x+24,y+151,42,color,800)};
player(48,887,"이 집 가장",d.best,green);player(552,887,"감독님과 면담 예정",d.review,orange);rect(48,1108,984,155,"#17382c");t("전술 취향 공개",78,1145,30,fg,800);t(d.style?.short||"유효 경기 기록 부족",78,1194,29,green,700);t(d.style?.name||"분석 보류",1002,1145,30,green,700,"right");t("실제 경기 기록 기준",1002,1194,25,muted,500,"right");t("피파고수 한마디",48,1300,25,green,800);t(tip,48,1343,29,fg,600);t("예능 별명 · 실제 경기 기록 기반 / 선수 교체 확정 아님",48,1390,23,muted);t("FIFAGOSU.COM",48,1480,48,green,800);t("친구도 진단받아 보세요",1032,1480,28,fg,600,"right");}
const api={events,compare,diff,draw,verdict};if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.FGDiagTools=api;
})(typeof window!=="undefined"?window:globalThis);