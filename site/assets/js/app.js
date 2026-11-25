/* ================= 피파고수 엔진 (순수 계산, 화면 없음) ================= */
function hash(s){let h=2166136261;for(const c of s){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);


const SEASON_LIST=`100:ICON TM:icontm|110:ICON TM:icontm_b|101:ICON:icon|113:25IM - S&P:25im_sp|114:25IM - FB:25im_fb|111:ICONS MATCH:icon_m|877:UC:uc|867:SPT:spt|596:SH:sh|864:TK:tk|863:PTG:ptg|862:KHD:khd|861:WG:wg|852:FAC:fac|851:25DP:25dp|848:WS:ws|868:26FSL:26fsl|850:25FSL:25fsl|846:DCB:dcb|845:CH:ch|849:HRT:hrt|840:LE:le|839:NO7:no7|836:WB:wb|829:GRU:gru|828:BLD:bld|827:BDO:bdo|826:24EP:24ep|825:CU:cu|821:MDL:mdl|815:EU24:eu24|818:LD:ld|814:UT:ut|813:JNM:jnm|802:DC:dc|801:JVA:jva|290:FCA:fca|291:23HW:23hw|289:CC:cc|283:HG:hg|284:RTN:rtn|272:BWC:bwc|273:WC22:wc22|274:RMCF:rmcf|270:SPL:spl|268:LN:ln|265:LOL:lol|264:FA:fa|858:26HR:26hr|835:25HR:25hr|811:24HR:24hr|281:23HR:23hr|261:22HR:22hr|256:BTB:btb|252:CAP:cap|251:EBS:ebs|253:BOE21:boe21|249:NTG:ntg|246:UP:up|237:MC:mc|231:VTR:vtr|233:MOG:mog|254:CFA:cfa|236:LA:la|804:23NG:23ng|276:22NG:22ng|262:21NG:21ng|238:20NG:20ng|219:19NG:19ng|218:OTW:otw|217:COC:coc|216:HOT:hot|214:TC:tc|213:MCFC ICON:mcicon|210:GR:gr|207:TT:tt|206:TB:tb|202:TKI:tki|201:NHD:nhd|854:26 TOTY:26toty|855:26 TOTY-N:26totn|831:25 TOTY:25toty|832:25 TOTY-N:25totn|807:24 TOTY:24toty|808:24 TOTY-N:24totn|278:23 TOTY:23toty|279:23 TOTY-N:23totn|258:22 TOTY:22toty|259:22 TOTY-N:22totn|240:21 TOTY:21toty|241:21 TOTY-N:21totn|220:20 TOTY:20toty|222:20 TOTY-N:20totn|211:19 TOTY:19toty|212:18 TOTY:18toty|866:26 TOTS:26tots|844:25 TOTS:25tots|820:24 TOTS:24tots|287:23 TOTS:23tots|267:22 TOTS:22tots|250:21 TOTS:21tots|230:20 TOTS:20tots|215:19 TOTS:19tots|856:25 UCL:25ucl|834:24 UCL:24ucl|810:23 UCL:23ucl|280:22 UCL:22ucl|260:21 UCL:21ucl|242:20 UCL:20ucl|221:19 UCL:19ucl|234:LH:lh|225:TKL:tkl|806:23 KFA:23kfa|293:22 KFA:22kfa|294:21 KFA:21kfa|295:19 KFA:2019kfa|298:18 KFA:kfa|297:MCFC:mcfc|247:2012 KH:2012kh|518:26KLeague:26kl|516:25KLeague:25kl|514:24KLeague:24kl|512:23KLeague:23kl|510:22KLeague:22kl|507:21KLeague:21kl|504:20KLeague:20kl|853:25KB:25kb|830:24KB:24klb|805:23KB:23klb|277:22KB:22klb|257:21KB:21klb|239:20KB:20klb|517:25 PL:25pla|515:24 PL:24pla|513:23 PL:23pla|511:22 PL:22pla|508:21 PL:21pla|506:20 PLA:20pla|503:19 PLS:19pls|502:19 PLA:19pla|501:18 PLS:18pls|500:18 PLA:plc|300:25 LIVE:live|324:24 LIVE:24|323:23 LIVE:23|322:22 LIVE:22|321:21 LIVE:21|320:20 LIVE:20|319:19 LIVE:19|318:18 LIVE:18|317:17 LIVE:17|812:LKI:lki|879:LKI2:lki2`;
const SEASON_FAM=n=>/ICON/.test(n)?'icon':/TOTY|TOTN/.test(n)?'toty':/TOTS/.test(n)?'tots':/UCL/.test(n)?'ucl':/HR$/.test(n)?'hr':/NG$/.test(n)?'ng':/ PL|PLA|PLS/.test(n)?'pl':/LIVE|KLeague|KFA|KB$/.test(n)?'live':'special';
const SEASONS={};SEASON_LIST.split('|').forEach(s=>{const [id,n,img]=s.split(':');SEASONS[id]=[n,SEASON_FAM(n),img]});
const SEASON_IMG=id=>`https://ssl.nexon.com/s2/game/fc/online/obt/externalAssets/new/season/${(SEASONS[id]||[])[2]||id}.png`;

const MAX_GRADE=13;
const GRADE_BONUS=[0,0,1,2,4,6,8,11,15,17,19,21,24,27];

const FORMS={
  '4-1-2-3':['GK','LB','LCB','RCB','RB','CDM','LCM','RCM','LW','ST','RW'],
  '4-2-3-1':['GK','LB','LCB','RCB','RB','LDM','RDM','LAM','CAM','RAM','ST'],
  '4-4-2':['GK','LB','LCB','RCB','RB','LM','LCM','RCM','RM','LS','RS'],
  '4-2-2-2':['GK','LB','LCB','RCB','RB','LDM','RDM','LAM','RAM','LS','RS'],
  '5-2-1-2':['GK','LWB','LCB','CB','RCB','RWB','LCM','RCM','CAM','LS','RS'],
  '4-1-2-1-2':['GK','LB','LCB','RCB','RB','CDM','LCM','RCM','CAM','LS','RS'],
  '4-1-4-1':['GK','LB','LCB','RCB','RB','CDM','LM','LCM','RCM','RM','ST']};
const XY={GK:[50,92],LB:[14,72],LWB:[10,64],LCB:[36,76],CB:[50,77],RCB:[64,76],RB:[86,72],RWB:[90,64],CDM:[50,60],LDM:[36,60],RDM:[64,60],
  LM:[14,46],LCM:[34,48],RCM:[66,48],RM:[86,46],LAM:[24,34],CAM:[50,34],RAM:[76,34],LW:[16,20],RW:[84,20],ST:[50,14],LS:[38,14],RS:[62,14],CF:[50,20]};

const GRADE_SUCCESS=[0,100,81,64,50,26,15,7,5,4,3,2,1];
const GRADE_TIER=g=>g>=11?'백금카':g>=8?'금카':g>=5?'은카':'동카';
const GRADE_CLS=g=>g>=11?'plat':g>=8?'gold':g>=5?'silver':'bronze';
const GRADE_TC=[['백금빛 물결',11,4,5],['금빛 물결',8,3,4],['은빛 물결',5,1,3],['동빛 물결',3,1,0]];

/* ---------- 강화 계산: 실패 시 단계 유지(등급 보호) 가정 ---------- */
function enhancePlan(from,to,gauge){
  const steps=[];let tries=0,prob=1;
  for(let k=from;k<to;k++){const p=GRADE_SUCCESS[k]/100*gauge;steps.push({k,p,exp:p?1/p:Infinity});tries+=p?1/p:Infinity;prob*=p}
  return {steps,tries,oneShot:prob};
}
/* ---------- BP 판매 계산 (규칙은 사용자가 확인·수정) ---------- */
function sellCalc(price,o){
  const disc=[o.pc?o.pcRate:0,o.top?o.topRate:0,o.coupon||0].filter(Boolean);
  let rate;
  rate=o.base*Math.max(0,1-sum(disc,d=>d)/100);
  const fee=Math.round(price*rate/100*100)/100;
  return {rate,fee,net:Math.round((price-fee)*100)/100};
}


/* ============ 1. 예시 데이터 생성 (넥슨 API 응답 구조를 흉내냄) ============
   실제 연결 시 이 함수만 프록시 호출로 교체:
   /id?nickname → /user/basic, /user/maxdivision → /user/match?matchtype=50|52 → /match-detail?matchid
   TODO(API 검증): goalTime 인코딩, x·y 좌표 기준, matchtype 코드, spPosition 코드표, spGrade(강화) */
const FIRST=['김','이','박','최','정','강','윤','장','임','한'],LAST=['도윤','서준','하준','지호','민재','시우','현우','준서','태오','유찬','건우','은호','로운','선우'];
const LINE=p=>p==='GK'?'GK':/B$|^SW$/.test(p)?'수비':/DM$|CM$|^LM$|^RM$/.test(p)?'미드':'공격';  // CAM·LAM·RAM은 공격 라인(제로톱 대응)
function formationOf(players){
  const ps=players.map(p=>p.pos).filter(p=>p!=='GK');
  const c=f=>ps.filter(f).length;
  const parts=[c(p=>/B$|^SW$/.test(p)),c(p=>/DM$/.test(p)),c(p=>/CM$|^LM$|^RM$/.test(p)),c(p=>/AM$/.test(p)),c(p=>/^(LW|RW|ST|LS|RS|CF|LF|RF)$/.test(p))];
  const fw=parts[4], s=parts.slice(0,4).filter(n=>n>0);
  return [...s,fw].join('-');   // 공격수가 없으면 끝이 0 (제로톱, 예: 4-1-2-3-0)
}
const OPPN=['무적FC','라인브레이커','새벽축구','갓벽수비','역습장인','빌드업러','왼발의마법사','중거리장인','후반전사','점유왕','태클러','압박축구','감모장인','스쿼드깡패'];
function makeData(nick,mode,count){
  count=Math.max(1,Math.min(100,count||30));
  const r=rng(hash(nick+'|'+mode));
  const isSample=nick==='샘플유저', dm=mode==52;
  const p=isSample?{fin:1.35,longshot:dm?0.3:0.5,late:dm?0.24:0.45,header:dm?0.34:0.3,poss:57,thru:dm?0.5:0.36,tackle:0.68,foul:1.1,lvl:142,duel:dm?-0.13:-0.02,aerial:dm?-0.1:0,
      myForm:'4-1-2-3',weakVs:'4-2-3-1',strongVs:'4-4-2',weakLine:dm?'미드':null}
    :{fin:0.7+r()*0.7,longshot:0.2+r()*0.4,late:0.1+r()*0.4,header:0.08+r()*0.35,poss:45+r()*15,thru:0.35+r()*0.25,tackle:0.4+r()*0.25,foul:0.8+r()*1.2,lvl:40+Math.floor(r()*200),duel:(r()-0.5)*0.16,aerial:(r()-0.5)*0.16,
      myForm:Object.keys(FORMS)[Math.floor(r()*6)],weakVs:Object.keys(FORMS)[Math.floor(r()*6)],strongVs:Object.keys(FORMS)[Math.floor(r()*6)],weakLine:dm?['수비','미드','공격'][Math.floor(r()*3)]:null};
  const lowIdx=isSample?6:Math.floor(r()*11);
  const squad=FORMS[p.myForm].map((pos,i)=>({spId:100000000+Math.floor(r()*9e8),pos,name:FIRST[Math.floor(r()*FIRST.length)]+LAST[Math.floor(r()*LAST.length)],
    grade:dm?1+Math.floor(r()*8):1+Math.floor(r()*6),seasonId:Object.keys(SEASONS)[Math.floor(r()*Object.keys(SEASONS).length)]*1,
    off:(i===lowIdx?-0.85:(r()-0.5)*0.5)+(p.weakLine&&LINE(pos)===p.weakLine?-0.35:0)}));
  if(dm&&isSample)squad[lowIdx].grade=2;
  function shots(n,inBox,fin,lateBias,headerBias){
    const out=[];
    for(let i=0;i<n;i++){
      const inside=r()<inBox, header=inside&&r()<headerBias, free=!inside&&r()<0.08;
      const goal=r()<(inside?(header?0.16:0.24):0.065)*fin, onT=goal||r()<0.36;
      const min=r()<lateBias?75+r()*17:r()*75;
      const x=inside?0.84+r()*0.15:0.62+r()*0.2, y=inside?0.3+r()*0.4:0.12+r()*0.76;
      out.push({goalTime:Math.round(min*60),x:+x.toFixed(3),y:+y.toFixed(3),type:header?'header':free?'freekick':'normal',result:goal?3:onT?2:1,inPenalty:inside});
    }
    return out;
  }
  function side(nickname,sd,poss,thruRate,tackleRate,foulRate,players){
    const g=sd.filter(s=>s.result===3), tt=6+Math.floor(r()*10), tk=10+Math.floor(r()*12), pt=280+Math.floor(r()*200);
    const lpT=20+Math.floor(r()*30);
    return {nickname,matchDetail:{possession:poss,foul:Math.round(foulRate*(1+r()*2)),yellowCards:r()<0.3?1:0,redCards:r()<0.03?1:0,cornerKick:Math.floor(r()*8),OffsideCount:Math.floor(r()*4),averageRating:0},
      shoot:{shootTotal:sd.length,effectiveShootTotal:sd.filter(s=>s.result>=2).length,goalTotal:g.length,
        shootHeading:sd.filter(s=>s.type==='header').length,goalHeading:g.filter(s=>s.type==='header').length,
        shootOutPenalty:sd.filter(s=>!s.inPenalty).length,goalOutPenalty:g.filter(s=>!s.inPenalty).length,
        shootInPenalty:sd.filter(s=>s.inPenalty).length,goalInPenalty:g.filter(s=>s.inPenalty).length},
      shootDetail:sd,
      pass:{passTry:pt,passSuccess:Math.round(pt*(0.78+r()*0.12)),throughPassTry:tt,throughPassSuccess:Math.round(tt*Math.min(.95,Math.max(.05,thruRate+(r()-.5)*.2))),longPassTry:lpT,longPassSuccess:Math.round(lpT*(0.55+r()*0.2))},
      defence:{tackleTry:tk,tackleSuccess:Math.round(tk*Math.min(.95,Math.max(.05,tackleRate+(r()-.5)*.2)))},
      player:players};
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), ri=(a,b)=>a+Math.floor(r()*(b-a+1));
  function pstat(pos,rating,bias){  // 선수 1명의 경기 기록 (API player.status 필드 구조)
    const L=LINE(pos), f=(rating-6.75)*0.05, cb=/CB$/.test(pos), st=/^(ST|LS|RS|CF)$/.test(pos);
    const bpT=L==='GK'?0:L==='수비'?ri(3,7):L==='미드'?ri(5,9):ri(4,8);
    const aT=L==='GK'?0:cb?ri(3,8):st?ri(2,6):ri(0,2);
    const dT=L==='공격'?ri(4,9):L==='미드'?ri(2,6):L==='GK'?0:ri(0,3);
    const pT=L==='미드'?ri(30,55):L==='수비'?ri(22,40):L==='GK'?ri(12,22):ri(14,26);
    const tT=L==='수비'?ri(3,7):L==='미드'?ri(2,5):L==='GK'?0:ri(0,2);
    const bT=L==='수비'?ri(1,3):L==='미드'?ri(0,2):0;
    const sh=L==='공격'?ri(1,4):L==='미드'?ri(0,2):0;
    const k=(n,rt)=>Math.round(n*clamp(rt,0.05,0.97));
    return {shoot:sh,effectiveShoot:k(sh,0.45+f),passTry:pT,passSuccess:k(pT,0.83+f*0.5),dribbleTry:dT,dribbleSuccess:k(dT,0.68+f),
      ballPossesionTry:bpT,ballPossesionSuccess:k(bpT,0.5+f+bias.duel),aerialTry:aT,aerialSuccess:k(aT,0.06+f*0.1+bias.aerial*0.3),
      tackleTry:tT,tackle:k(tT,0.55+f),intercept:L==='GK'?0:L==='공격'?ri(0,1):ri(1,4),blockTry:bT,block:k(bT,0.55+f)};
  }
  const rate=(base,goals,conc)=>+Math.max(4.5,Math.min(9.8,base+(goals-conc)*0.25+(r()-0.5)*1.1)).toFixed(1);
  const matches=[], now=Date.parse('2026-10-15T21:00:00+09:00'), formKeys=Object.keys(FORMS);
  for(let i=0;i<count;i++){
    const oppForm=formKeys[Math.floor(r()*formKeys.length)];
    const mu=oppForm===p.weakVs?1.55:oppForm===p.strongVs?0.6:1;   // 상성: 상대 결정력 배수
    const poss=Math.round(Math.max(30,Math.min(72,p.poss+(r()-0.5)*18)));
    const my=shots(8+Math.floor(r()*9),1-p.longshot,p.fin/(mu>1?1.15:1),0.22,0.15);
    const op=shots(7+Math.floor(r()*9),0.66,mu,p.late,p.header);
    const mg=my.filter(s=>s.result===3).length, og=op.filter(s=>s.result===3).length;
    const myPlayers=squad.map(s=>({spId:s.seasonId*1e6+(s.spId%1e6),seasonId:s.seasonId,name:s.name,pos:s.pos,spGrade:s.grade,status:{spRating:rate(6.75+s.off,mg,og),goal:0,assist:0}}));
    myPlayers.forEach(x=>Object.assign(x.status,pstat(x.pos,x.status.spRating,{duel:p.duel,aerial:p.aerial})));
    const att=myPlayers.filter(x=>LINE(x.pos)==='공격'), mid=myPlayers.filter(x=>LINE(x.pos)==='미드');
    my.filter(s=>s.result===3).forEach(()=>{att[Math.floor(r()*att.length)].status.goal++;(mid.concat(att))[Math.floor(r()*(mid.length+att.length))].status.assist++});
    const oppPlayers=FORMS[oppForm].map(pos=>({spId:0,pos,spGrade:1+Math.floor(r()*7),status:{spRating:rate(6.75,og,mg),goal:0,assist:0}}));
    oppPlayers.forEach(x=>Object.assign(x.status,pstat(x.pos,x.status.spRating,{duel:0,aerial:0})));
    const me=side(nick,my,poss,p.thru,p.tackle,p.foul,myPlayers);
    const opp=side(OPPN[Math.floor(r()*OPPN.length)],op,100-poss,0.48,0.55,1.1,oppPlayers);
    me.matchDetail.matchResult=mg>og?'승':mg<og?'패':'무';
    opp.matchDetail.matchResult=mg>og?'패':mg<og?'승':'무';
    matches.push({matchId:(hash(nick+i)).toString(16).padStart(8,'0')+'a1b2c3d4e5f6',matchDate:new Date(now-i*3.7e6*(1+r()*3)).toISOString(),matchType:+mode,matchInfo:[me,opp]});
  }
  const divs=dm?['슈퍼 챔피언스','챔피언스','슈퍼 챌린지','챌린저1','챌린저2','마스터1']:['슈퍼 챔피언스','챔피언스','슈퍼 챌린지','챌린저1','챌린저3','월드클래스1','마스터2','프로1'];
  return {basic:{nickname:nick,level:p.lvl},maxdivision:{matchType:+mode,division:divs[isSample?(dm?1:2):Math.floor(r()*divs.length)]},matches};
}

/* ============ 2. 약점 진단 엔진 ============ */
function dLatestLineup(matches){
  let latest=null,at=-Infinity;
  for(const m of matches||[]){const p=m?.matchInfo?.[0]?.player;if(!Array.isArray(p)||!p.length)continue;const t=Date.parse(m.matchDate);if(!latest||(Number.isFinite(t)&&t>at)){latest=m;at=Number.isFinite(t)?t:-Infinity}}
  return latest?.matchInfo?.[0]?.player||[];
}
function dRecentRows(players,lineup,enabled){
  if(!enabled)return players;
  const ids=new Set((lineup||[]).map(p=>String(p.spId)));
  return players.filter(p=>ids.has(String(p.spId)));
}
function dCardLabel(x){
  const season=x.seasonId??Math.floor(Number(x.spId)/1e6),name=sname(season);
  return [x.pos,name&&name!=='?'?name:'시즌 '+(Number.isFinite(season)?season:'미상'),x.name,Number(x.grade)>0?x.grade+'강':''].filter(Boolean).join(' ');
}
function dRecentStatus(x,lineup){return dRecentRows([x],lineup,true).length?'최근 경기 출전':'최근 경기 미출전'}
function analyze(data,mode){
  const dm=mode==='52';
  const M=data.matches, me=M.map(m=>m.matchInfo[0]), op=M.map(m=>m.matchInfo[1]), n=M.length, recentLineup=dLatestLineup(M);
  const agg=side=>({goals:sum(side,s=>s.shoot.goalTotal), eff:sum(side,s=>s.shoot.effectiveShootTotal), shots:sum(side,s=>s.shoot.shootTotal),
      outShots:sum(side,s=>s.shoot.shootOutPenalty), outGoals:sum(side,s=>s.shoot.goalOutPenalty),
      thruT:sum(side,s=>s.pass.throughPassTry), thruS:sum(side,s=>s.pass.throughPassSuccess),
      tackT:sum(side,s=>s.defence.tackleTry), tackS:sum(side,s=>s.defence.tackleSuccess),
      fouls:sum(side,s=>s.matchDetail.foul), shotsDetail:side.flatMap(s=>s.shootDetail)});
  const A=agg(me), B=agg(op);
  A.goalsDetail=A.shotsDetail.filter(s=>s.result===3); B.goalsDetail=B.shotsDetail.filter(s=>s.result===3);
  const W=me.filter(s=>s.matchDetail.matchResult==='승').length, D=me.filter(s=>s.matchDetail.matchResult==='무').length, L=n-W-D;
  const conceded=B.goalsDetail, cN=conceded.length;
  const pct=v=>Math.round(v*100), rate=(a,b)=>b?a/b:0;
  const F=(o,d)=>dm&&d?d:o;   // 감독모드용 처방 문구
  const items=[], add=o=>items.push(o);

  const f1=rate(A.goals,A.eff), f2=rate(B.goals,B.eff), d1=f2?(f1-f2)/f2:0;
  add({weakIf:d1<=-0.2,strongIf:d1>=0.15,score:Math.abs(d1)*1.2,weak:'유효슈팅을 골로 못 바꿔요',strong:'결정력이 좋아요',
    desc:`유효슈팅 ${A.eff}개 중 ${A.goals}골 (전환율 ${pct(f1)}%). 상대 평균은 ${pct(f2)}%예요.`,me:f1,opp:f2,fmt:v=>pct(v)+'%',unit:'골 전환율',
    fix:F('골문 앞에서 <b>한 번 더 접고 각도를 만드는</b> 슈팅을 늘리고, 결정력 높은 공격수를 선발로 쓰세요.','<b>골 결정력·침착성 높은 공격수</b>로 바꾸거나 공격수 강화 단계를 올려 보세요.'),
    sfix:'지금 마무리가 잘 통하고 있어요. 찬스 수를 늘리는 데 집중하세요.'});
  const o1=rate(A.outShots,A.shots), og1=rate(A.outGoals,A.outShots), og2=rate(B.outGoals,B.outShots);
  add({weakIf:o1>=0.4&&og1<og2,score:(o1-0.3)*1.5,weak:'중거리 슈팅에 너무 의존해요',
    desc:`전체 슈팅의 ${pct(o1)}%가 박스 밖이고, 박스 밖 득점률은 ${pct(og1)}%로 상대(${pct(og2)}%)보다 낮아요.`,me:o1,opp:rate(B.outShots,B.shots),fmt:v=>pct(v)+'%',unit:'박스 밖 비중',
    fix:F('중거리 대신 <b>한 번 더 패스해서 박스 안으로</b> 들어가세요.','팀 전술 공격 설정에서 <b>박스 안 공격 인원을 늘리고</b>, 중거리 슈팅 성향이 강한 선수 비중을 줄여 보세요.')});
  const late=conceded.filter(s=>s.goalTime>=75*60).length, l1=rate(late,cN);
  add({weakIf:cN>=4&&l1>=0.35,score:(l1-0.2)*1.8,weak:'후반 막판에 무너져요',desc:`실점 ${cN}골 중 ${late}골(${pct(l1)}%)이 75분 이후에 나왔어요.`,
    me:l1,opp:0.2,fmt:v=>pct(v)+'%',unit:'75분 이후 실점',oppLabel:'일반적 수준',
    fix:F('<b>65~70분에 체력 떨어진 선수를 교체</b>하고, 리드 중이면 수비적 전술로 바꿔 보세요.','감독모드는 AI가 뛰어서 체력이 떨어지는 후반에 차이가 커져요. <b>스태미너 높은 미드필더</b>나 체력 관련 특성(예: 두 개의 심장) 선수를 우선 검토해 보세요.')});
  const early=conceded.filter(s=>s.goalTime<15*60).length, e1=rate(early,cN);
  add({weakIf:cN>=4&&e1>=0.3,score:(e1-0.17)*1.5,weak:'경기 초반에 흔들려요',desc:`실점 ${cN}골 중 ${early}골(${pct(e1)}%)이 15분 안에 나왔어요.`,
    me:e1,opp:0.17,fmt:v=>pct(v)+'%',unit:'15분 이전 실점',oppLabel:'일반적 수준',
    fix:F('시작하고 15분은 <b>수비 라인을 낮추고</b> 상대 공격 패턴부터 보세요.','팀 전술 수비 설정의 <b>깊이(수비 라인)를 조금 낮춰</b> 초반 뒷공간 실점을 줄여 보세요.')});
  const hd=conceded.filter(s=>s.type==='header').length, h1=rate(hd,cN);
  add({weakIf:cN>=4&&h1>=0.25,score:(h1-0.12)*1.6,weak:'헤딩 실점이 많아요',desc:`실점 ${cN}골 중 ${hd}골(${pct(h1)}%)이 헤딩이에요.`,
    me:h1,opp:0.12,fmt:v=>pct(v)+'%',unit:'헤딩 실점 비중',oppLabel:'일반적 수준',
    fix:F('<b>키와 몸싸움이 좋은 센터백</b>을 쓰고, 크로스가 올라오기 전에 풀백으로 먼저 막으세요.','<b>헤더·점프·몸싸움 높은 센터백</b>으로 바꾸고, 풀백 수비 성향을 올려 크로스를 줄이세요.')});
  const t1=rate(A.thruS,A.thruT), t2=rate(B.thruS,B.thruT);
  add({weakIf:t1<=t2-0.1,strongIf:t1>=t2+0.08,score:(t2-t1)*2,weak:'스루패스가 자주 끊겨요',strong:'스루패스가 날카로워요',
    desc:`스루패스 성공률 ${pct(t1)}%, 상대 평균 ${pct(t2)}%예요.`,me:t1,opp:t2,fmt:v=>pct(v)+'%',unit:'스루패스 성공률',
    fix:F('수비 라인이 올라와 있을 때만 쓰고, 그 전에는 <b>짧은 패스로 수비를 끌어내세요</b>.','<b>시야·짧은 패스 높은 중앙 미드필더</b>를 쓰거나, 공격 빌드업을 롱패스 위주로 바꿔 스루패스 의존을 줄여 보세요.'),
    sfix:'침투 패스가 잘 통해요. 빠른 공격수와 조합하면 더 위협적이에요.'});
  const pg=me.filter(s=>s.matchDetail.possession>=55), pw=pg.filter(s=>s.matchDetail.matchResult==='승').length, p1=rate(pw,pg.length);
  add({weakIf:pg.length>=5&&p1<0.5,score:(0.55-p1)*1.4,weak:'공은 오래 갖는데 못 이겨요',desc:`점유율 55% 이상인 ${pg.length}경기에서 ${pw}승(승률 ${pct(p1)}%)이에요.`,
    me:p1,opp:0.55,fmt:v=>pct(v)+'%',unit:'점유 우세 시 승률',oppLabel:'기대 승률',
    fix:F('뒤에서 돌리는 패스를 줄이고 <b>공을 뺏은 직후 빠르게 전진</b>하세요.','공격 빌드업을 <b>롱패스</b>로, 팀 성향을 공격적으로 올려 점유를 득점으로 바꿔 보세요. 상위 랭커가 많이 쓰는 설정이에요.')});
  const k1=rate(A.tackS,A.tackT), k2=rate(B.tackS,B.tackT);
  add({weakIf:k1<=k2-0.1,strongIf:k1>=k2+0.08,score:(k2-k1)*1.8,weak:'태클이 자주 실패해요',strong:'수비 타이밍이 좋아요',
    desc:`태클 성공률 ${pct(k1)}%, 상대 평균 ${pct(k2)}%예요.`,me:k1,opp:k2,fmt:v=>pct(v)+'%',unit:'태클 성공률',
    fix:F('바로 태클하지 말고 <b>지연 수비로 따라붙다가</b> 공이 발에서 떨어질 때 들어가세요.','<b>스탠딩 태클·대인 수비 높은 수비수</b>로 바꾸고, 슬라이딩 태클 성향 센터백은 피하세요.'),
    sfix:'볼 탈취가 안정적이에요. 높은 위치에서 압박해도 좋아요.'});
  const fo1=A.fouls/n, fo2=B.fouls/n;
  add({weakIf:fo1>=fo2*1.5,score:(fo1/fo2-1)*0.6,weak:'반칙이 너무 많아요',desc:`경기당 반칙 ${fo1.toFixed(1)}개, 상대 평균 ${fo2.toFixed(1)}개예요.`,
    me:fo1,opp:fo2,fmt:v=>v.toFixed(1)+'개',unit:'경기당 반칙',max:Math.max(fo1,fo2)*1.2,
    fix:F('뒤에서 들어가는 태클을 줄이고, 박스 근처에서는 <b>몸으로 막기</b>를 우선하세요.','<b>공격성 낮은 수비형 미드필더</b>를 쓰고, 센터백은 슬라이딩 태클 성향 선수를 피하세요.')});

  // 선수
  const PK=['shoot','effectiveShoot','passTry','passSuccess','dribbleTry','dribbleSuccess','ballPossesionTry','ballPossesionSuccess','aerialTry','aerialSuccess','tackleTry','tackle','intercept','blockTry','block'];
  const tot=side=>{const t={};PK.forEach(k=>t[k]=0);side.forEach(s=>s.player.forEach(x=>PK.forEach(k=>t[k]+=x.status[k]||0)));return t};
  const TA=tot(me), TB=tot(op);
  // 세부 지표 표: [이름, 나, 상대, 형식, 높을수록 좋음]
  const per=v=>v/n, pr=(a,b)=>b?a/b:0, md=(side,k)=>sum(side,s=>s.matchDetail[k]||0)/n;
  const stats=[
    ['그룹','공격'],
    ['평균 득점',A.goals/n,B.goals/n,'n2',1],['경기당 슈팅',A.shots/n,B.shots/n,'n1',1],['유효슈팅 비율',pr(A.eff,A.shots),pr(B.eff,B.shots),'%',1],
    ['골 전환율(유효 대비)',pr(A.goals,A.eff),pr(B.goals,B.eff),'%',1],['박스 안 슈팅 비중',1-pr(A.outShots,A.shots),1-pr(B.outShots,B.shots),'%',1],
    ['드리블 성공률',pr(TA.dribbleSuccess,TA.dribbleTry),pr(TB.dribbleSuccess,TB.dribbleTry),'%',1],['경기당 코너킥',md(me,'cornerKick'),md(op,'cornerKick'),'n1',1],['경기당 오프사이드',md(me,'OffsideCount'),md(op,'OffsideCount'),'n1',0],
    ['그룹','패스·점유'],
    ['평균 점유율',md(me,'possession')/100,md(op,'possession')/100,'%',1],['패스 성공률',pr(TA.passSuccess,TA.passTry),pr(TB.passSuccess,TB.passTry),'%',1],
    ['스루패스 성공률',pr(A.thruS,A.thruT),pr(B.thruS,B.thruT),'%',1],['롱패스 성공률',pr(sum(me,s=>s.pass.longPassSuccess||0),sum(me,s=>s.pass.longPassTry||0)),pr(sum(op,s=>s.pass.longPassSuccess||0),sum(op,s=>s.pass.longPassTry||0)),'%',1],
    ['그룹','경합·수비'],
    ['볼 경합(몸싸움) 승률',pr(TA.ballPossesionSuccess,TA.ballPossesionTry),pr(TB.ballPossesionSuccess,TB.ballPossesionTry),'%',1],['경기당 볼 경합 승리',per(TA.ballPossesionSuccess),per(TB.ballPossesionSuccess),'n1',1],
    ['공중볼 경합 성공률',pr(TA.aerialSuccess,TA.aerialTry),pr(TB.aerialSuccess,TB.aerialTry),'%1',1],['경기당 공중볼 성공',per(TA.aerialSuccess),per(TB.aerialSuccess),'n1',1],
    ['태클 성공률',pr(TA.tackle,TA.tackleTry),pr(TB.tackle,TB.tackleTry),'%',1],['경기당 가로채기',per(TA.intercept),per(TB.intercept),'n1',1],['경기당 블락',per(TA.block),per(TB.block),'n1',1],
    ['그룹','규율'],
    ['경기당 반칙',A.fouls/n,B.fouls/n,'n1',0],['경기당 경고',md(me,'yellowCards'),md(op,'yellowCards'),'n2',0],['퇴장 경기 수',sum(me,s=>s.matchDetail.redCards||0),sum(op,s=>s.matchDetail.redCards||0),'n0',0]];
  // 승부 흐름
  const firstGoal=M.map(m=>{const a=m.matchInfo[0].shootDetail.filter(x=>x.result===3).map(x=>x.goalTime),b=m.matchInfo[1].shootDetail.filter(x=>x.result===3).map(x=>x.goalTime);
    const fa=a.length?Math.min(...a):Infinity, fb=b.length?Math.min(...b):Infinity;return {first:fa<fb?'me':fb<fa?'op':'none',res:m.matchInfo[0].matchDetail.matchResult,diff:m.matchInfo[0].shoot.goalTotal-m.matchInfo[1].shoot.goalTotal}});
  const wr=a=>a.length?a.filter(x=>x.res==='승').length/a.length:null;
  const flow=[['선제골 넣은 경기 승률',wr(firstGoal.filter(x=>x.first==='me')),firstGoal.filter(x=>x.first==='me').length],
    ['먼저 실점한 경기 승률',wr(firstGoal.filter(x=>x.first==='op')),firstGoal.filter(x=>x.first==='op').length],
    ['1골 차 승부 승률',wr(firstGoal.filter(x=>Math.abs(x.diff)===1)),firstGoal.filter(x=>Math.abs(x.diff)===1).length],
    ['역전승',firstGoal.filter(x=>x.first==='op'&&x.res==='승').length,null],['역전패',firstGoal.filter(x=>x.first==='me'&&x.res==='패').length,null],
    ['무실점 경기',me.filter((s,i)=>op[i].shoot.goalTotal===0).length,null],['3골 이상 득점 경기',me.filter(s=>s.shoot.goalTotal>=3).length,null]];
  const pl={};
  me.forEach(s=>s.player.forEach(x=>{(pl[x.spId]??=({spId:x.spId,name:x.name,pos:x.pos,po:POS_CODE.indexOf(x.pos),grade:x.spGrade,seasonId:Math.floor(x.spId/1e6),r:[],g:0,a:0,w:0,d:0})).r.push(x.status.spRating);if(s.matchDetail.matchResult==='승')pl[x.spId].w++;else if(s.matchDetail.matchResult==='무')pl[x.spId].d++;pl[x.spId].g+=x.status.goal;pl[x.spId].a+=x.status.assist;const t=(pl[x.spId].t??={});PK.forEach(k=>t[k]=(t[k]||0)+(x.status[k]||0))}));
  const players=Object.values(pl).map(x=>({...x,apps:x.r.length,avg:sum(x.r,v=>v)/x.r.length,wr:x.w/x.r.length}));
  const teamAvg=sum(players,x=>x.avg)/players.length;
  players.forEach(x=>x.low=x.apps>=5&&x.avg<=teamAvg-0.5);
  const worst=players.filter(x=>x.low).sort((a,b)=>a.avg-b.avg)[0];
  if(worst)add({weakIf:true,score:(teamAvg-worst.avg)*0.5,weak:`${dCardLabel(worst)} 선수가 부진해요`,
    desc:`${worst.apps}경기 평균 평점 ${worst.avg.toFixed(2)}, 팀 평균 ${teamAvg.toFixed(2)}보다 ${(teamAvg-worst.avg).toFixed(2)} 낮아요.` +` · ${dRecentStatus(worst,recentLineup)}.`,
    me:worst.avg,opp:teamAvg,fmt:v=>v.toFixed(2),unit:'평균 평점',oppLabel:'팀 평균',min:4,max:9,
    fix:dRecentRows([worst],recentLineup,true).length?F('<b>같은 포지션 교체 후보</b>를 검토하거나, 이 선수의 개인 전술을 바꿔 보세요.','감독모드는 능력치가 곧 경기력이에요. <b>강화 단계를 올리거나 같은 포지션 상위 카드</b>로 바꿔 보세요.'):'최근 경기에는 출전하지 않은 카드의 과거 기록이에요. 현재 보유·판매 여부는 알 수 없어요.'});

  // 감독모드 전용: 포메이션 상성, 라인별 평점
  let forms=null, lines=null, myForm=null;
  if(dm){
    myForm=formationOf(me[0].player);
    const fm={};
    M.forEach(m=>{const f=formationOf(m.matchInfo[1].player),r=m.matchInfo[0].matchDetail.matchResult;(fm[f]??={f,n:0,w:0,d:0,l:0}).n++;fm[f][r==='승'?'w':r==='무'?'d':'l']++});
    forms=Object.values(fm).map(x=>({...x,wr:x.w/x.n})).sort((a,b)=>b.n-a.n);
    const totalWr=W/n;
    const worstF=forms.filter(x=>x.n>=4).sort((a,b)=>a.wr-b.wr)[0];
    if(worstF&&worstF.wr<=totalWr-0.2)add({weakIf:true,score:(totalWr-worstF.wr)*1.6,weak:`${worstF.f} 상대로 약해요`,
      desc:`${worstF.f} 상대로 ${worstF.n}경기 ${worstF.w}승 ${worstF.d}무 ${worstF.l}패(승률 ${pct(worstF.wr)}%)예요. 전체 승률은 ${pct(totalWr)}%예요.`,
      me:worstF.wr,opp:totalWr,fmt:v=>pct(v)+'%',unit:'이 포메이션 상대 승률',oppLabel:'전체 승률',
      fix:`${worstF.f}는 중앙에 사람이 많은 구조예요. <b>미드필더를 한 명 더 두는 포메이션</b>이나 측면 공격 전술로 대응해 보세요.`});
    const lr={};
    me.forEach((s,i)=>{s.player.forEach(x=>{const k=LINE(x.pos);(lr[k]??={k,me:[],op:[]}).me.push(x.status.spRating)});op[i].player.forEach(x=>{const k=LINE(x.pos);(lr[k]??={k,me:[],op:[]}).op.push(x.status.spRating)})});
    lines=['공격','미드','수비','GK'].filter(k=>lr[k]&&lr[k].me.length&&lr[k].op.length).map(k=>({k,me:sum(lr[k].me,v=>v)/lr[k].me.length,op:sum(lr[k].op,v=>v)/lr[k].op.length}));
    const wl=lines.filter(x=>x.k!=='GK').sort((a,b)=>(a.me-a.op)-(b.me-b.op))[0];
    if(wl&&wl.me<=wl.op-0.25){wl.weak=true;add({weakIf:true,score:(wl.op-wl.me)*1.4,weak:`${wl.k} 라인이 밀려요`,
      desc:`${wl.k} 선수들 평균 평점 ${wl.me.toFixed(2)}, 같은 라인 상대 평균은 ${wl.op.toFixed(2)}예요.`,
      me:wl.me,opp:wl.op,fmt:v=>v.toFixed(2),unit:`${wl.k} 라인 평점`,min:5,max:8.5,
      fix:`감독모드에서는 라인 하나가 밀리면 경기 전체가 흔들려요. <b>${wl.k} 라인 강화·교체</b>를 먼저 하세요.`})}
  }

  const du1=pr(TA.ballPossesionSuccess,TA.ballPossesionTry), du2=pr(TB.ballPossesionSuccess,TB.ballPossesionTry);
  add({weakIf:du1<=du2-0.06,strongIf:du1>=du2+0.06,score:(du2-du1)*4.5,weak:'몸싸움(볼 경합)에서 밀려요',strong:'볼 경합에 강해요',
    desc:`볼 경합 ${TA.ballPossesionTry}번 중 ${TA.ballPossesionSuccess}번 이겼어요(${pct(du1)}%). 상대 평균은 ${pct(du2)}%예요.`,me:du1,opp:du2,fmt:v=>pct(v)+'%',unit:'볼 경합 승률',
    fix:F('공을 오래 끌지 말고 <b>원터치 패스로 경합 자체를 줄이세요</b>.','<b>몸싸움·밸런스 높은 미드필더</b>로 바꾸거나 강화 단계를 올려 보세요. 감독모드는 능력치 차이가 경합에 그대로 나와요.'),
    sfix:'경합에서 이기는 힘이 있어요. 전방 압박 전술과 잘 맞아요.'});
  const ae1=pr(TA.aerialSuccess,TA.aerialTry), ae2=pr(TB.aerialSuccess,TB.aerialTry);
  const aeRel=ae2?(ae1-ae2)/ae2:0;
  add({weakIf:TA.aerialTry>=30&&aeRel<=-0.25,strongIf:TA.aerialTry>=30&&aeRel>=0.25,score:-aeRel*0.9,weak:'공중볼 경합에서 져요',strong:'공중볼을 잘 따내요',
    desc:`공중볼 경합 ${TA.aerialTry}번 중 ${TA.aerialSuccess}번 성공(${(ae1*100).toFixed(1)}%), 상대 평균 ${(ae2*100).toFixed(1)}%예요. 넥슨 기준 '성공' 판정이 엄격해 수치 자체는 낮게 나와요.`,me:ae1,opp:ae2,fmt:v=>pct(v)+'%',unit:'공중볼 경합 승률',
    fix:F('크로스 수비 때 <b>먼저 자리를 잡고</b>, 공격은 땅볼 위주로 바꿔 보세요.','<b>키·점프·헤더 높은 센터백과 스트라이커</b>를 검토하고, 크로스 위주 공격 전술은 줄이세요.'),
    sfix:'세트피스와 크로스 공격을 더 활용해 보세요.'});
  const weak=items.filter(x=>x.weakIf).sort((a,b)=>b.score-a.score).slice(0,3);
  const strong=items.filter(x=>x.strongIf).sort((a,b)=>Math.abs(b.me-b.opp)-Math.abs(a.me-a.opp))[0];
  const bins=[0,15,30,45,60,75].map(s=>({label:s===75?'75+':`${s}–${s+15}`,f:0,a:0}));
  const bi=t=>Math.min(5,Math.floor(t/900));
  A.goalsDetail.forEach(s=>bins[bi(s.goalTime)].f++); conceded.forEach(s=>bins[bi(s.goalTime)].a++);
  // Display order is independent of pitch coordinates and Nexon position codes.
  // 경기 흐름(오래된 경기 → 최근 경기)
  const seq=M.map(m=>{const [x,y]=m.matchInfo;return {r:x.matchDetail.matchResult,gf:x.shoot.goalTotal,ga:y.shoot.goalTotal,opp:y.nickname,date:m.matchDate,poss:x.matchDetail.possession}}).reverse();
  return {n,W,D,L,gf:A.goals,ga:B.goals,weak,strong,bins,shots:A.shotsDetail,stats,flow,seq,players:players.sort(dComparePosition),recentLineup,teamAvg,forms,lines,myForm,dm};
}


/* ================= 실데이터 어댑터: 넥슨 Open API → 진단 엔진 입력 구조 =================
   2026-10-15 실제 응답으로 확인한 규칙
   - shootDetail.result: 1 유효슈팅(막힘), 2 빗나감, 3 골  → 엔진 규칙(3 골, 2 유효, 1 빗나감)으로 변환
   - shootDetail.type: 3 헤딩, 8 프리킥(추정), 그 외 일반
   - goalTime: 구간 × 2^24 + 구간 시작 후 초 (0 전반, 1 후반, 2 연장 전반, 3 연장 후반)
   - player: 교체 명단 포함 18명, spPosition 28 = 교체(SUB). 출전 안 한 교체는 spRating 0
   - spId = 시즌ID × 1,000,000 + 선수번호, spGrade = 강화 단계
   - matchInfo[].division = 경기 당시 등급
*/
const POS_CODE=['GK','SW','RWB','RB','RCB','CB','LCB','LB','LWB','RDM','CDM','LDM','RM','RCM','CM','LCM','LM','RAM','CAM','LAM','RF','CF','LF','RW','RS','ST','LS','LW','SUB'];
// GK first; every line reads from the right toward the left.
const D_POS_ORDER=['GK','RB','RWB','RCB','CB','SW','LCB','LB','LWB','RDM','CDM','LDM','RM','RCM','CM','LCM','LM','RAM','CAM','LAM','RW','RF','RS','ST','CF','LS','LF','LW','SUB'];
function dComparePosition(a,b){const idx=p=>{const i=D_POS_ORDER.indexOf(p);return i<0?D_POS_ORDER.length:i};return idx(a.pos)-idx(b.pos)}
const DIVISION={800:'슈퍼 챔피언스',900:'챔피언스',1000:'슈퍼 챌린지',1100:'챌린저1',1200:'챌린저2',1300:'챌린저3',1700:'마스터1',1800:'마스터2',1900:'마스터3',
  2000:'월드클래스1',2100:'월드클래스2',2200:'월드클래스3',2300:'프로1',2400:'프로2',2500:'프로3',2600:'세미프로1',2700:'세미프로2',2800:'세미프로3',2900:'유망주1',3000:'유망주2',3100:'유망주3'};
const HALF_START=[0,45,90,105,120];
function goalSeconds(gt){const part=Math.floor(gt/16777216),sec=gt%16777216;return (HALF_START[part]||0)*60+sec}
function mapShot(s){return {goalTime:goalSeconds(s.goalTime),x:s.x,y:s.y,type:s.type===3?'header':s.type===8?'freekick':'normal',
  result:s.result===3?3:s.result===1?2:1,inPenalty:!!s.inPenalty,spId:s.spId,raw:s}}
function mapSide(mi,names){
  const players=mi.player.filter(p=>p.spPosition!==28||(p.status&&p.status.spRating>0)).map(p=>({spId:p.spId,seasonId:Math.floor(p.spId/1e6),
    name:names[p.spId]||String(p.spId),pos:POS_CODE[p.spPosition]==='SUB'?'SUB':POS_CODE[p.spPosition],spGrade:p.spGrade,status:{...p.status}}));
  const md=mi.matchDetail;
  return {nickname:mi.nickname,ouid:mi.ouid,division:mi.division,
    matchDetail:{...md,OffsideCount:md.offsideCount},shoot:mi.shoot,shootDetail:mi.shootDetail.map(mapShot),
    pass:mi.pass,defence:{tackleTry:mi.defence.tackleTry,tackleSuccess:mi.defence.tackleSuccess,blockTry:mi.defence.blockTry,blockSuccess:mi.defence.blockSuccess},
    player:players.filter(p=>p.pos!=='SUB'),bench:players.filter(p=>p.pos==='SUB')};
}
/* fetchJSON(path) 은 실서비스에서 '/api' 중계(Cloudflare Pages Functions)를 부름. names(ids) 는 spid 이름 조회 */
const MD_CACHE=new Map();   // 받은 경기 상세는 다시 요청하지 않음(30→50경기 "더 분석" 때 차이분만)
let BUNDLE_OK=true;         // /api/summary·/api/matches 묶음 경로 (없는 배포면 기존 경로로)
async function realData(nick,mode,count,fetchJSON,names,BATCH=8){
  const lim=Math.min(100,count||30);
  let id,basic,maxd,list;
  if(BUNDLE_OK){
    try{
      const s=await fetchJSON(`/summary?nickname=${encodeURIComponent(nick)}&matchtype=${mode}&limit=${lim}`);
      id={ouid:s.ouid};basic=s.basic;maxd=s.maxdivision;list=s.matches;
    }catch(e){
      if(e&&e.code==='http_404'&&!e.api)BUNDLE_OK=false;   // 경로 자체가 없음 → 기존 방식
      else if(e&&e.code==='http_404')throw {code:'no_user',message:'해당 닉네임의 구단주를 찾지 못했어요.'};
      else throw e;
    }
  }
  if(!BUNDLE_OK){
    id=await fetchJSON('/fconline/v1/id?nickname='+encodeURIComponent(nick));
    if(!id||!id.ouid)throw {code:'no_user',message:'해당 닉네임의 구단주를 찾지 못했어요.'};
    [basic,maxd,list]=await Promise.all([fetchJSON('/fconline/v1/user/basic?ouid='+id.ouid),fetchJSON('/fconline/v1/user/maxdivision?ouid='+id.ouid),
      fetchJSON(`/fconline/v1/user/match?ouid=${id.ouid}&matchtype=${mode}&offset=0&limit=${lim}`)]);
  }
  if(!list||!list.length)throw {code:'no_match',message:'최근 경기 기록이 없어요.'};
  const need=list.filter(m=>!MD_CACHE.has(m));
  if(BUNDLE_OK){
    for(let i=0;i<need.length;i+=10){ // 한 번에 10경기씩(Functions 하위 요청 한도 안)
      const ids=need.slice(i,i+10);
      const arr=await fetchJSON('/matches?ids='+ids.join(',')).catch(e=>{if(e&&e.name==='AbortError')throw e;return []});
      ids.forEach((m,k)=>{if(arr[k])MD_CACHE.set(m,arr[k])});
    }
  }else{
    for(let i=0;i<need.length;i+=BATCH){ // 호출 제한 대응: 묶음 단위로 요청
      const chunk=await Promise.all(need.slice(i,i+BATCH).map(m=>fetchJSON('/fconline/v1/match-detail?matchid='+m).catch(()=>null)));
      chunk.forEach((d,k)=>{if(d)MD_CACHE.set(need[i+k],d)});
    }
  }
  const details=list.map(m=>MD_CACHE.get(m)).filter(Boolean);
  const ids=new Set();details.forEach(d=>d.matchInfo.forEach(mi=>mi.player.forEach(p=>ids.add(p.spId))));
  const nm=await names([...ids]);
  const matches=details.filter(d=>d.matchInfo&&d.matchInfo.length===2).map(d=>{
    const mine=d.matchInfo.findIndex(mi=>mi.ouid===id.ouid), a=d.matchInfo[mine<0?0:mine], b=d.matchInfo[mine===1?0:1];
    return {matchId:d.matchId,matchDate:d.matchDate,matchType:d.matchType,matchInfo:[mapSide(a,nm),mapSide(b,nm)]};
  }).filter(m=>m.matchInfo[0].matchDetail.matchEndType===0);   // 몰수 경기 제외
  const md=(maxd||[]).find(x=>x.matchType===+mode);
  const cur=matches[0]&&matches[0].matchInfo[0].division;
  return {basic:{nickname:basic.nickname,level:basic.level},maxdivision:{matchType:+mode,division:md?DIVISION[md.division]||String(md.division):'기록 없음',achieved:md&&md.achievementDate},
    current:cur?DIVISION[cur]||String(cur):null,matches,real:true,forfeit:details.length-matches.length};
}


/* ================= 화면 ================= */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
const VIEWS=['home','market','diag','cards','guide','sim','trade'];

/* 등급 계열 색 */
const TIER_FAM=n=>/슈퍼 ?챔피언스/.test(n)?'--t-sc':/챔피언스/.test(n)?'--t-ch':/챌린/.test(n)?'--t-cl':/마스터/.test(n)?'--t-ma':/월드클래스/.test(n)?'--t-wc':/^프로/.test(n)?'--t-pr':'--t-lo';
const tierBadge=n=>`<span class="tierb" style="--tc:var(${TIER_FAM(n)})">${esc(n)}</span>`;
/* 공식 등급 아이콘: DIVISION 순서(슈퍼 챔피언스=0 … 유망주3=20)가 넥슨 ico_rank 번호와 같아요(데이터센터 랭킹 화면 확인) */
const DIV_NAMES=Object.values(DIVISION);
const divImg=(n,cls)=>{const i=DIV_NAMES.indexOf(n);return i<0?'':`<img class="${cls||'divimg'}" src="https://ssl.nexon.com/s2/game/fo4/obt/rank/large/update_2026/ico_rank${i}.png" alt="${esc(n)}" title="역대 최고 등급 · ${esc(n)}" onerror="this.remove()">`};
function show(v,nopush){
  // SPA 탭 이동 뒤에도 넓은 화면용 컨테이너 상태를 뷰와 동기화한다.
  document.body.classList.toggle('page-wide',['home','market','diag','cards','sim','trade','guide'].includes(v));
  VIEWS.forEach(x=>$('v-'+x).hidden=x!==v);
  document.querySelectorAll('#menu [data-view]').forEach(b=>{if(b.dataset.view===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  const R=window.FG_ROUTES;
  try{
    if(window.FG_LIVE&&R){if(!nopush&&location.pathname!==R[v])history.pushState({v},'',R[v]+location.search)}
    else history.replaceState(null,'',v==='home'?location.pathname+location.search:'#'+v);
  }catch(e){}
  if(window.FG_TITLES&&FG_TITLES[v]&&!nopush)document.title=FG_TITLES[v];
  window.scrollTo({top:0});
  try{document.dispatchEvent(new CustomEvent('fg:view',{detail:v}))}catch(e){}
}
$('menu').addEventListener('click',e=>{
  const link=e.target.closest('a[href]');
  if(link&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.button===0&&(/(?:^|\/)news\/?$/.test(new URL(link.href,location.href).pathname)||link.textContent.trim()==='소식')){
    e.preventDefault();location.assign(new URL(link.getAttribute('href'),location.href).href);return;
  }
  const b=e.target.closest('#menu [data-view]');if(!b||e.ctrlKey||e.metaKey||e.shiftKey||e.button)return;e.preventDefault();show(b.dataset.view)   // body의 data-view까지 잡히지 않게 메뉴 안에서만 찾아요
});
document.querySelectorAll('a.logo').forEach(link=>link.addEventListener('click',e=>{
  if(e.ctrlKey||e.metaKey||e.shiftKey||e.button!==0)return;
  if(window.FG_ROUTES&&$('v-home')){e.preventDefault();show('home')}
}));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.go)));

const gch=g=>`<span class="grade g-${GRADE_CLS(g)}" title="${GRADE_TIER(g)}">${g}강</span>`;
const sname=id=>(SEASONS[id]||[`시즌 ${id}`])[0];

/* 가이드 */
if($('gLadder'))$('gLadder').innerHTML=['유망주','세미프로','프로','월드클래스','마스터','챌린저','슈퍼 챌린지','챔피언스','슈퍼 챔피언스'].map(n=>`<span style="--tc:var(${TIER_FAM(n)})">${n}</span>`).join('<span style="border:0;background:none;color:var(--muted);padding:4px 0">›</span>');
if($('gGrade'))$('gGrade').innerHTML=`<table><thead><tr><th>단계</th><th class="n">1강 대비 OVR</th><th class="n">다음 강화 성공</th><th>색</th></tr></thead><tbody>${Array.from({length:MAX_GRADE},(_,i)=>i+1).map(g=>`<tr><td style="white-space:nowrap">${gch(g)}</td><td class="n">+${GRADE_BONUS[g]}</td><td class="n">${g<MAX_GRADE?GRADE_SUCCESS[g]+'%':'-'}</td><td style="white-space:nowrap">${GRADE_TIER(g)}</td></tr>`).join('')}</tbody></table>`;

/* ---------- 전적 진단 ---------- */

/* ---------- 미리 불러온 실데이터 스냅샷(넥슨 Open API 응답을 압축 저장한 것) 풀기 ---------- */
function expandSnap(s){
  const K=s.keys, obj=(keys,arr)=>Object.fromEntries(keys.map((k,i)=>[k,arr[i]])), sp=s.sp;
  const side=(a,mine)=>{const [nickname,division,md,sh,ps,df,shots,pl,tot]=a;
    const matchDetail=obj(K.MDK,md);matchDetail.OffsideCount=matchDetail.offsideCount;
    let players;
    if(mine)players=pl.map(p=>{const [ix,pos,gr,...st]=p,id=sp[ix][0];return {spId:id,seasonId:Math.floor(id/1e6),name:sp[ix][1]||String(id),pos:POS_CODE[pos],spGrade:gr,status:obj(K.STK,st)}});
    else players=pl.map(([pos,r],i)=>({spId:0,seasonId:0,name:'',pos:POS_CODE[pos],spGrade:0,status:Object.assign(Object.fromEntries(K.PK.map(k=>[k,0])),i===0&&tot?obj(K.PK,tot):{},{spRating:r})}));
    return {nickname,division,matchDetail,shoot:obj(K.SHK,sh),pass:obj(K.PSK,ps),defence:obj(K.DFK,df),
      shootDetail:shots.map(([gt,x,y,type,result,inP])=>mapShot({goalTime:gt,x,y,type,result,inPenalty:!!inP})),
      player:players.filter(p=>p.pos!=='SUB'),bench:players.filter(p=>p.pos==='SUB')}};
  const out={};
  for(const mode of ['50','52']){
    const ms=(s['m'+mode]||[]).map(([id,date,a,b])=>({matchId:id,matchDate:date,matchType:+mode,matchInfo:[side(a,1),side(b,0)]})).filter(m=>m.matchInfo[0].matchDetail.matchEndType===0);
    const md=s.maxd[mode];
    out[s.nick.toLowerCase()+'|'+mode]={basic:{nickname:s.nick,level:s.level},maxdivision:{matchType:+mode,division:md?DIVISION[md[0]]||String(md[0]):'기록 없음',achieved:md&&md[1]},
      current:ms[0]?DIVISION[ms[0].matchInfo[0].division]||null:null,matches:ms,real:true,snapDate:s.date+' 기준'};
  }
  return out;
}
if(window.FG_SNAP_RAW){window.FG_SNAP={};FG_SNAP_RAW.forEach(s=>Object.assign(FG_SNAP,expandSnap(s)))}
let dMode='50', dCur=null, dTab='pstats', dCount=30;
const DTABS={'50':[['pstats','선수별 기록'],['ranker','랭커 비교'],['stats','세부 지표'],['growth','성장 기록'],['time','시간대별 득실'],['shot','슈팅 맵']],'52':[['pstats','선수별 기록'],['ranker','랭커 비교'],['stats','세부 지표'],['growth','성장 기록'],['form','포메이션 상성'],['line','라인별 평점'],['time','시간대별 득실'],['shot','슈팅 맵']]};
let dTabInit='pstats';
const DKEY='fg_diag_v3', dRead=()=>{try{return JSON.parse(ls(DKEY)||'{}')}catch(e){return {}}}, dWrite=v=>ls(DKEY,JSON.stringify(v));
let dFilter={pos:'',apps:1,action:'',sort:'pitch',recent:false}, dPriceMeta=null;
function dStore(mut){const s=dRead();mut(s);dWrite(s);return s}
function dHistoryKey(nick,mode){return String(nick||'').trim().toLowerCase()+'|'+mode}
function dSnapshot(d,a){
  const day=new Date().toISOString().slice(0,10),key=dHistoryKey(d.basic.nickname,dMode),ids=a.players.slice().sort((x,y)=>y.apps-x.apps).slice(0,18).map(x=>`${x.spId}:${x.grade}`).sort();
  return {day,at:new Date().toISOString(),n:a.n,w:a.W,d:a.D,l:a.L,wr:a.W/a.n,gf:a.gf/a.n,ga:a.ga/a.n,tier:d.current||d.maxdivision.division,ids,value:a.squadValue||null,known:a.valueKnown||0};
}
function dSaveVisit(d,a){dStore(s=>{
  s.history=s.history||{};const key=dHistoryKey(d.basic.nickname,dMode),snap=dSnapshot(d,a),list=s.history[key]||[],same=list.findIndex(x=>x.day===snap.day);if(same>=0)list[same]=snap;else list.push(snap);s.history[key]=list.slice(-90);
  });dRenderQuick(d.basic.nickname)
}
/* 통합 즐겨찾기: 운영판 저장 목록을 최초 1회 가져오고 별표와 공유 */
function dMergeFavorites(current,legacy){const out=[],seen=new Set();for(const item of [...(Array.isArray(current)?current:[]),...(Array.isArray(legacy)?legacy:[])]){const raw=typeof item==='string'?item:item?.nick;if(typeof raw!=='string'||!raw.trim())continue;const nick=raw.trim(),key=nick.toLocaleLowerCase();if(seen.has(key))continue;seen.add(key);out.push({nick,at:typeof item?.at==='string'?item.at:''});if(out.length===10)break}return out}
function dMigrateFavorites(){const s=dRead();if(s.favoritesMigrated)return;let old=[];try{old=JSON.parse(ls('fifagosu.diag-favorites.v1')||'[]')}catch(e){}s.favs=dMergeFavorites(s.favs,old);s.favoritesMigrated=true;dWrite(s)}
function dIsFavorite(nick){const key=String(nick||'').trim().toLocaleLowerCase();return (dRead().favs||[]).some(x=>x.nick.toLocaleLowerCase()===key)}
function dChangeFavorite(nick,removeOnly=false){nick=String(nick||'').trim();if(!nick)return;dStore(s=>{s.favs=dMergeFavorites(s.favs,[]);const key=nick.toLocaleLowerCase(),i=s.favs.findIndex(x=>x.nick.toLocaleLowerCase()===key);if(i>=0)s.favs.splice(i,1);else if(!removeOnly)s.favs.unshift({nick,at:new Date().toISOString()});s.favs=s.favs.slice(0,10)});dRenderQuick(dCur?.d.basic.nickname||'')}
function dFavoriteButton(nick){const on=dIsFavorite(nick);return `<button type="button" class="d-favorite" data-dfavorite-toggle="${esc(nick)}" aria-pressed="${on}" aria-label="${on?'즐겨찾기 해제':'즐겨찾기에 추가'}" title="${on?'즐겨찾기 해제':'즐겨찾기에 추가'}">${on?'★':'☆'}</button>`}
dMigrateFavorites();
function dRenderQuick(active){const s=dRead(),mk=(x,k)=>`<button type="button" data-dnick="${esc(x.nick)}" class="dquick-chip${active&&x.nick.toLowerCase()===active.toLowerCase()?' on':''}">${k==='fav'?'★ ':''}${esc(x.nick)}<small>${x.at?new Date(x.at).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}):''}</small></button>`;
  $('dFavs').innerHTML=(s.favs||[]).map(x=>`<span class="df-pair">${mk(x,'fav')}<button type="button" class="df-remove" data-dfavorite-remove="${esc(x.nick)}" aria-label="${esc(x.nick)} 즐겨찾기 삭제" title="즐겨찾기 삭제">×</button></span>`).join('')||'<span class="muted">즐겨찾기가 없어요.</span>';
  const fav=active&&(s.favs||[]).some(x=>x.nick.toLowerCase()===active.toLowerCase());$('dFav').textContent=fav?'★ 즐겨찾기 해제':'☆ 즐겨찾기';$('dFav').disabled=!active;$('dMine').disabled=!active;$('dShare').disabled=!active;
  if(active&&s.mine)$('dMine').textContent=s.mine.toLowerCase()===active.toLowerCase()?'내 구단 ✓':'내 구단 등록';
  const star=$('dBoard').querySelector('[data-dfavorite-toggle]');if(star){const on=dIsFavorite(star.dataset.dfavoriteToggle);star.setAttribute('aria-pressed',String(on));star.textContent=on?'★':'☆';star.setAttribute('aria-label',on?'즐겨찾기 해제':'즐겨찾기에 추가');star.title=on?'즐겨찾기 해제':'즐겨찾기에 추가'}
}
dRenderQuick('');
function dRenderBoard(d,a){
  $('dBoard').innerHTML=`<div><div class="nick nick-wrap">${divImg(d.maxdivision.division)}<span>${esc(d.basic.nickname)}</span>${dFavoriteButton(d.basic.nickname)}</div><div class="meta">Lv.${d.basic.level} · ${a.dm?'감독모드 · '+esc(a.myForm):'공식경기'}</div></div>
  <div class="tier">${d.current?`<span class="lbl">최근 경기 등급</span>${tierBadge(d.current)}`:''}<span class="lbl">${a.dm?'감독모드 ':''}역대 최고 등급</span><span class="tier-max">${divImg(d.maxdivision.division,'divimg-sm')}${tierBadge(d.maxdivision.division)}</span></div>
  <div class="record">${d.real?`<div><span class="k">데이터</span><span class="v" style="font-size:13px">넥슨 Open API${d.snapDate?' · '+esc(d.snapDate):''}</span></div>`:d.sample?'<div><span class="k">데이터</span><span class="v" style="font-size:13px;color:var(--warn,#e0a030)">예시(가상)</span></div>':''}<div><span class="k">최근</span><span class="v">${a.n}경기${d.forfeit?`<small style="display:block;font-size:11px;font-weight:400;color:var(--muted)">몰수 ${d.forfeit}경기 제외</small>`:''}</span></div><div><span class="k">승·무·패</span><span class="v">${a.W}·${a.D}·${a.L}</span></div><div><span class="k">승률</span><span class="v">${Math.round(a.W/a.n*100)}%</span></div><div><span class="k">득실</span><span class="v">${a.gf}:${a.ga}</span></div></div>`;
}
function cmpRows(x){const mn=x.min??0,mx=x.max??Math.max(x.me,x.opp,0.0001)*1.15,w=v=>Math.max(3,Math.min(100,(v-mn)/(mx-mn)*100));
  return `<div class="cmp2"><div class="cr"><span>나</span><div class="bar me"><i style="width:${w(x.me)}%"></i></div><b>${x.fmt(x.me)}</b></div><div class="cr"><span>${x.oppLabel??'상대'}</span><div class="bar"><i style="width:${w(x.opp)}%"></i></div><b>${x.fmt(x.opp)}</b></div></div>`}
function dRenderCards(a){
  $('dSub').textContent=`최근 ${a.n}경기 · 내가 만난 상대들과 비교`;
  if(!a.weak.length&&!a.strong){$('dCards').innerHTML='<div class="empty">뚜렷한 약점이 보이지 않아요.</div>';return}
  $('dCards').innerHTML=a.weak.map((x,i)=>`<article class="wcard ${i?'mid':''}"><div class="wtop"><span class="pill no">약점 ${i+1}</span><h3>${esc(x.weak)}</h3></div><p class="wdesc">${esc(x.desc)}</p>${cmpRows(x)}<p class="wfix">${x.fix}</p></article>`).join('')+
    (a.strong?`<article class="wcard strength"><div class="wtop"><span class="pill ok">강점</span><h3>${esc(a.strong.strong)}</h3></div><p class="wdesc">${esc(a.strong.desc)}</p>${cmpRows(a.strong)}<p class="wfix">${esc(a.strong.sfix)}</p></article>`:'');
}
/* ---------- 종합 구단 리포트 핵심 수치 ---------- */
const RCLS={승:'W',무:'D',패:'L'};
function dRenderSummary(d,a){
  $('dReportShell').hidden=false;
  const recent=a.seq.slice(-5),count=r=>recent.filter(x=>x.r===r).length;
  const kpi=[
    ['승률',`${Math.round(a.W/a.n*100)}%`,`${a.W}승 ${a.D}무 ${a.L}패`],
    ['최근 5경기',`${count('승')}승 ${count('무')}무 ${count('패')}패`,'가장 최근 경기 기준'],
    ['경기당 득실',`${(a.gf/a.n).toFixed(2)} · ${(a.ga/a.n).toFixed(2)}`,'득점 · 실점']
  ];
  $('dSum').innerHTML=`<div class="ds-kpi">${kpi.map(([k,v,s2])=>`<div><span>${k}</span><b>${v}</b><small>${s2}</small></div>`).join('')}</div>`;
}
/* 막대·칸에 마우스를 올리면 그 경기의 날짜·상대·스코어 */
$('dSum').addEventListener('mouseover',e=>{const t=e.target.closest('[data-i]'),tip=$('dsTip');if(!tip||!dCur)return;if(!t){tip.hidden=true;return}
  const x=dCur.a.seq[+t.dataset.i];if(!x)return;const dt=new Date(x.date),box=t.closest('.ds-flow').getBoundingClientRect(),r=t.getBoundingClientRect();
  tip.innerHTML=`<span class="res ${RCLS[x.r]}">${x.r}</span><b>${x.gf} : ${x.ga}</b> vs ${esc(x.opp)}<small>${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')} · 점유 ${x.poss}%</small>`;
  tip.hidden=false;const left=Math.max(4,Math.min(box.width-tip.offsetWidth-4,r.left-box.left+r.width/2-tip.offsetWidth/2));tip.style.left=left+'px';tip.style.top=(r.top-box.top-tip.offsetHeight-6)+'px'});
$('dSum').addEventListener('mouseleave',()=>{const tip=$('dsTip');if(tip)tip.hidden=true});
/* ---------- 피파고수의 한마디: 약점·흐름·랭커 비교를 종합한 조언 ---------- */
function dAdvice(a){
  const seq=a.seq,n=seq.length,last=seq[n-1];let st=1;for(let i=n-2;i>=0&&seq[i].r===last.r;i--)st++;
  const w5=seq.slice(-5).filter(x=>x.r==='승').length;
  const flow=last.r==='승'&&st>=3?`지금 <b>${st}연승</b> 중이라 현재 전술의 큰 틀은 유지해도 좋아요.`:last.r==='패'&&st>=3?`최근 <b>${st}연패</b>라 한 번에 여러 설정을 바꾸기보다 한 가지씩 점검해야 해요.`:`최근 5경기 <b>${w5}승</b>, 전체 승률은 <b>${Math.round(a.W/a.n*100)}%</b>예요.`;
  const one=s=>{const t=String(s||'').trim(),m=t.match(/^.*?[.!?](?:\s|$)/);return (m?m[0]:t).trim()};
  const w=a.weak[0],action=w?`<b>${esc(w.weak)}</b>: ${one(w.fix)}`:a.strong?`뚜렷한 약점은 적으니 <b>${esc(a.strong.strong)}</b>을 계속 살리세요.`:'지금은 뚜렷한 약점보다 경기 표본을 더 쌓는 것이 먼저예요.';
  return `${flow} ${action}`;
}
function dRenderTip(a){const advice=dAdvice(a);$('dTip').hidden=!advice;$('dTip').innerHTML=`<div class="tip-h"><span class="tip-ic" aria-hidden="true">💬</span><b>피파고수의 한마디</b><small>최근 ${a.n}경기</small></div><p>${advice}</p>`}
/* ---------- 상위 랭커 비교 (넥슨 Open API ranker-stats: TOP 10,000 랭커가 같은 선수·같은 포지션으로 뛴 20경기 평균) ---------- */
const RK_ATT=[['goal','골'],['assist','도움'],['shoot','슈팅'],['effectiveShoot','유효슈팅'],['dribbleSuccess','드리블 성공률'],['passSuccess','패스 성공률']],RK_DEF=[['tackle','태클'],['block','블락']];
const RK_TIP='같은 선수·포지션의 상위 랭커 비교 기준보다 낮은 기록입니다.';
function dRankerCompare(x,k,lb,rk){
  const t=x.t||{},tryKey={dribbleSuccess:'dribbleTry',passSuccess:'passTry'}[k];
  if(tryKey){
    const attempts=t[tryKey],success=t[k],rankAttempts=rk[tryKey],rankSuccess=rk[k];
    if(![attempts,success,rankAttempts,rankSuccess].every(Number.isFinite)||attempts<10||rankAttempts<1||success<0||success>attempts||rankSuccess<0||rankSuccess>rankAttempts)return null;
    const mine=success/attempts,avg=rankSuccess/rankAttempts;
    return {lb,mine,avg,rate:true,low:avg-mine>=.10-1e-9&&mine<avg*.85};
  }
  const mine=(k==='goal'?x.g:k==='assist'?x.a:t[k])/x.apps,avg=rk[k];
  if(!Number.isFinite(mine)||!Number.isFinite(avg)||avg<.3)return null;
  return {lb,mine,avg,rate:false,low:mine<avg*.7};
}
function dRankerValue(v,n){return v.rate?(n*100).toFixed(1)+'%':n.toFixed(2)}
function dDuelCell(success,attempt){
  if(!Number.isFinite(success)||!Number.isFinite(attempt)||attempt<=0||success<0||success>attempt)return '<span class="muted">-</span>';
  return `<span class="duel-rate">${Math.round(success/attempt*100)}%</span><small class="duel-count">성공 ${success} / 시도 ${attempt}</small>`;
}
async function dLoadRanker(a,mode,seq){
  if(!LIVE)return;
  const list=a.players.filter(x=>x.po>=0&&x.pos!=='GK'&&x.apps>=3);if(!list.length)return;
  const q=encodeURIComponent(JSON.stringify(list.slice(0,50).map(x=>({id:x.spId,po:x.po}))));
  let res;try{res=await fetchJSON(`/fconline/v1/ranker-stats?matchtype=${mode}&players=${q}`)}catch(e){return}
  if(seq!==diagSeq||!Array.isArray(res))return;
  const by={};res.forEach(r=>{by[(r.spid||r.spId)+'|'+r.spPosition]=r.status});
  a.under=[];
  list.forEach(x=>{const rk=by[x.spId+'|'+x.po];if(!rk)return;x.rk=rk;x.rkLow={};const ln=LINE(x.pos);
    const keys=[...(ln==='공격'||ln==='미드'?RK_ATT:[]),...(ln==='수비'||ln==='미드'?RK_DEF:[])];
    keys.forEach(([k,lb])=>{const c=dRankerCompare(x,k,lb,rk);if(c&&c.low)x.rkLow[k]=c});
    if(Object.keys(x.rkLow).length)a.under.push(x)});
  a.rkN=Object.keys(by).length;
  if(['pstats','ranker','player'].includes(dTab))dRenderPanel();
  dRenderTip(a);
}
const rkCell=(x,k,html)=>{const L=x.rkLow&&x.rkLow[k];if(!L)return html;
  return `<span class="rk-low" data-tip="${RK_TIP} (${L.lb} ${L.rate?'':'경기당 '}${dRankerValue(L,L.mine)} · 상위 랭커 평균 ${dRankerValue(L,L.avg)})" tabindex="0">${html}<span class="rk-ic" aria-hidden="true">!</span></span>`};
/* ---------- 챔피언스 평균 평점 비교 (data/rating.json — crawler/rating.py 가 하루 1회, 챔피언스 이상 경기 표본으로 생성) ---------- */
const RT_GROUP={GK:'GK',SW:'CB',RCB:'CB',CB:'CB',LCB:'CB',RB:'FB',LB:'FB',RWB:'FB',LWB:'FB',RDM:'DM',CDM:'DM',LDM:'DM',RCM:'CM',CM:'CM',LCM:'CM',RM:'WM',LM:'WM',RAM:'AM',CAM:'AM',LAM:'AM',RW:'W',LW:'W',RF:'W',LF:'W',RS:'ST',ST:'ST',LS:'ST',CF:'ST'};
const RT_GNAME={GK:'골키퍼',CB:'센터백',FB:'풀백',DM:'수비형 미드필더',CM:'중앙 미드필더',WM:'측면 미드필더',AM:'공격형 미드필더',W:'윙어',ST:'스트라이커'};
let ratingP=null;
const loadRating=()=>ratingP||(ratingP=fetch(DATA_BASE+'/rating.json').then(r=>r.ok?r.json():null).catch(()=>null));
async function dLoadRating(a,mode,seq){
  const R=await loadRating();if(seq!==diagSeq||!R||!R[mode]||!R[mode].groups)return;
  const G=R[mode].groups;let n=0;
  a.players.forEach(x=>{const g=RT_GROUP[x.pos],s=g&&G[g];if(!s||!(s.avg>0)||(s.n||0)<30||x.apps<3)return;
    x.rtRef={avg:s.avg,n:s.n,basis:s.basis||'≤900',g};if(s.avg-x.avg>=0.1-1e-9){x.rtLow={avg:s.avg,n:s.n,basis:s.basis||'≤900',g};n++}});
  a.rtN=n;
  if(['pstats','ranker','player'].includes(dTab))dRenderPanel();
  dRenderTip(a);
}
const rtLabel=b=>b==='≤1000'?'슈퍼 챌린지 이상':'챔피언스';
const rtCell=x=>{if(!x.rtLow)return x.avg.toFixed(2);const L=x.rtLow;
  return `<span class="rk-low" data-tip="${esc(`${rtLabel(L.basis)} 기준 같은 포지션(${RT_GNAME[L.g]}) 평균 평점 ${L.avg.toFixed(2)}보다 낮아요 (내 ${x.avg.toFixed(2)})`)}" tabindex="0">${x.avg.toFixed(2)}<span class="rk-ic" aria-hidden="true">!</span></span>`};
const rtNote=a=>a.rtN?` 평점의 빨간 숫자는 챔피언스 경기 표본의 같은 포지션 평균보다 0.1 이상 낮은 평점이에요(3경기 이상 출전). 이름 옆 <span class="rk-ic">!</span>를 누르면 같은 가격대 대체 추천을 볼 수 있어요.`:a.under&&a.under.length?' 이름 옆 <span class="rk-ic">!</span>를 누르면 같은 가격대 대체 추천을 볼 수 있어요.':'';
const lowSummary=x=>{const p=[];if(x.rtLow)p.push(`평점 ${x.avg.toFixed(2)} (${rtLabel(x.rtLow.basis)} 평균 ${x.rtLow.avg.toFixed(2)})`);
  const k=x.rkLow?Object.values(x.rkLow).map(v=>v.lb):[];if(k.length)p.push(`${k.join('·')} (상위 랭커 대비)`);return p};
/* 이름 옆 '!' 버튼: 평점 또는 공격·수비 지표가 낮은 선수 → 누르면 같은 가격대 대체 추천 */
const recoFlag=x=>{const p=lowSummary(x);if(!p.length)return '';
  return `<button type="button" class="rc-flag" data-reco="${x.spId}" aria-label="대체 추천 보기" aria-haspopup="dialog" data-tip="${esc('낮은 수치: '+p.join(' · ')+' — 눌러서 대체 추천 보기')}">!</button>`};

/* ---------- 대체 추천 (data/reco/{포지션 묶음}.json — crawler/derive.py step_reco) ---------- */
const RECO_P={};
const loadReco=g=>RECO_P[g]||(RECO_P[g]=fetch(`${DATA_BASE}/reco/${g}.json`).then(r=>r.ok?r.json():null).catch(()=>null));
const pdec=c=>c?(c%1000)*10**Math.floor(c/1000):0;   // 시세 코드(유효숫자 3자리) → BP
// 포지션 묶음별 신체 가중치 [키 1cm당, 몸무게 1kg당, 몸무게 상한(넘는 만큼 감점: 측면은 가벼운 편이 유리)]
const RC_BODY={GK:[0.15,0.02,0],CB:[0.14,0.06,0],ST:[0.10,0.06,0],DM:[0.07,0.04,0],CM:[0.05,0.03,0],AM:[0.03,0,82],FB:[0.03,0,82],WM:[0.02,0,80],W:[0.02,0,80]};
const RC_LO=0.6, RC_HI=1.6;   // 같은 강화 단계 시세가 내 카드의 0.6~1.6배인 카드만
function recoScore(g,me,c,ratio){
  const [hw,ww,wcap]=RC_BODY[g]||[0.05,0.03,0],why=[];let s=0;
  const dO=me.ovr?c.ovr-me.ovr:0;s+=dO;if(dO>0)why.push([dO,`OVR +${dO}`]);
  const dn=c.nw-me.nw;s+=dn*0.9;if(c.nw>0&&dn>0)why.push([dn+0.2,`신규 특성 ${c.nw}개`]);
  if(c.h&&me.h){const dh=c.h-me.h,v=Math.max(-1.5,Math.min(1.5,dh*hw));s+=v;if(dh>=3&&hw>=0.05)why.push([v,`키 +${dh}cm`]);
    if(ww){const dw=c.w-me.w,v2=Math.max(-0.8,Math.min(0.8,dw*ww));s+=v2;if(dw>=4)why.push([v2,`몸무게 +${dw}kg`])}
    if(wcap){const ov=w=>Math.max(0,w-wcap),v3=-(ov(c.w)-ov(me.w))*0.08;s+=v3;if(v3>=0.2)why.push([v3,`몸무게 ${c.w}kg (가벼움)`])}}
  else if(!c.h)s-=0.3;   // 키·몸무게를 아직 모르는 카드는 살짝 뒤로
  if(ratio){if(ratio>1)s-=(ratio-1)*2.2;else{s+=(1-ratio)*0.8;if(ratio<=0.9)why.push([(1-ratio)+0.3,`시세 -${Math.round((1-ratio)*100)}%`])}}
  const pop=v=>Math.min(1,Math.log10((v||0)+1)/3)*0.3;s+=pop(c.games)-pop(me.games);   // 데이터센터 사용량(유행) 약간
  return {s,why:why.sort((a,b)=>b[0]-a[0]).slice(0,3).map(w=>w[1])};
}
/* 내 스쿼드 팀컬러: 출전 많은 선발 11명의 카드 상세(클럽 경력·국가)로 소속 팀컬러 인원, 강화 단계로 물결 판정 */
const WAVES=[['백금빛 물결',11],['금빛 물결',8],['은빛 물결',5],['동빛 물결',3]];
async function squadTC(a){
  if(a._tc)return a._tc;
  const tcList=await loadTeamcolors().catch(()=>null);if(LIVE&&!tcList)return null;
  const st=a.players.slice().sort((p,q)=>q.apps-p.apps).slice(0,11);
  const ds=await Promise.all(st.map(p=>cardData(p.spId).then(c=>c&&c.d).catch(()=>null)));
  if(LIVE&&(!st.length||ds.some(d=>!d)))return null;
  const of={},cnt={};
  st.forEach((p,i)=>{const names=ds[i]?tcOptionsFor(ds[i]).map(t=>t.name):[];of[p.spId]=names;names.forEach(n=>cnt[n]=(cnt[n]||0)+1)});
  const lv=n=>{const m=(TC_TIER_RULES.club&&TC_TIER_RULES.club.members)||[3,6,8,11];let l=0;m.forEach((k,i)=>{if(n>=k)l=i+1});return l};
  const active=Object.entries(cnt).filter(([,n])=>n>=3).map(([name,n])=>{const tc=TEAMCOLORS.find(t=>t.name===name),type=tc?TC_TYPE(tc):'';return {name,n,lv:lv(n),club:!/nation|국가/.test(type)}}).sort((x,y)=>(+y.club)-(+x.club)||y.n-x.n);
  let wave=null;for(const [w,g] of WAVES){if(st.filter(p=>(p.grade||1)>=g).length>=5){wave={name:w,min:g};break}}
  return a._tc={of,active,main:active[0]||null,wave,known:ds.filter(Boolean).length,n:st.length};
}
async function recoFor(x,opt={}){
  const budget=+opt.budget||0;
  const g=RT_GROUP[x.pos];if(!g)return {err:'포지션 정보를 몰라 추천할 수 없어요.'};
  const [F,cd,S]=await Promise.all([loadReco(g),cardData(x.spId).catch(()=>({})),squadTC(dCur.a).catch(()=>null)]);
  if(!F||!F.items||!F.items.length)return {g,err:'추천 데이터를 준비 중이에요. 매일 새벽 수집이 끝나면 볼 수 있어요.'};
  if(LIVE&&!S)return {g,err:'팀컬러 데이터를 확인하지 못해 교체 추천을 보류해요. 잠시 후 다시 시도해 주세요.'};
  const L=cd&&cd.l,D=cd&&cd.d,myG=Math.max(1,Math.min(13,x.grade||1)),T=F.traits||[],TN=F.teamcolors||[];
  const minG=S&&S.wave?S.wave.min:Math.max(1,Math.min(13,+opt.grade||1));   // 물결은 후보별 최소 강화만 강제
  const items=F.items.map(r=>({id:r[0],name:r[1],ovr:r[2],pc:r[3]||[],h:r[4],w:r[5],nw:r[6],tr:r[7]||[],pay:r[8],games:r[9],tc:(r[10]||[]).map(i=>TN[i])}));
  const mine=items.find(c=>c.id===x.spId), I=ix(x.spId)||[];
  const posOvr=((L&&L.pos)||(D&&D.pos)||[]).filter(p=>RT_GROUP[p[0]]===g).map(p=>+p[1]||0);
  const myOvr=posOvr.length?Math.max(...posOvr):mine?mine.ovr:(L&&L.ovr)||(D&&D.ovr)||I[0]||0;
  const priceAt=k=>(L&&L.price&&L.price[k])||(mine&&pdec(mine.pc[k]))||0;
  const myNow=priceAt(myG-1),myPrice=myNow,approx=false;
  if(!myPrice&&!myOvr)return {g,minGrade:minG,err:'이 카드는 시세·능력치 데이터가 아직 없어 추천할 수 없어요.'};
  const nw=D&&D.traits?D.traits.filter(t=>NEW_TRAITS.has(Array.isArray(t)?t[0]:t)).length:mine?mine.nw:0;
  const myPay=(L&&L.pay)||I[2]||(mine&&mine.pay)||0;
  const me={ovr:myOvr,h:(D&&D.height)||(mine&&mine.h)||0,w:(D&&D.weight)||(mine&&mine.w)||0,nw,games:(L&&L.games)||(mine&&mine.games)||0,pay:myPay};
  // 팀컬러 유지 조건: 이 선수가 속한 활성 팀컬러 중 가장 인원 많은 것(필수) / 없으면 메인 팀컬러 가산
  const myTc=S?(S.of[x.spId]||(D?tcOptionsFor(D).map(t=>t.name):[])):[];
  const keep=S?S.active.filter(t=>myTc.includes(t.name)):[];
  const need=keep.slice().sort((a,b)=>(+b.club)-(+a.club)||b.n-a.n)[0]||null, bonusTc=need?null:(S&&S.active.find(t=>t.club)||S&&S.main);
  const pick=(lo,hi,reqTc)=>{const out=[];
    items.forEach(c=>{if(c.id===x.spId)return;const choices=[];for(let grade=minG;grade<=13;grade++){const p=pdec(c.pc[grade-1]);if(p)choices.push({grade,p})}if(!choices.length)return;
      let choice;if(budget)choice=choices.filter(z=>z.p<=budget).sort((a,b)=>b.grade-a.grade||a.p-b.p)[0];
      else if(myPrice)choice=choices.filter(z=>z.p>=myPrice*lo&&z.p<=myPrice*hi).sort((a,b)=>(b.grade-a.grade)||a.p-b.p)[0];
      else choice=choices[0];if(!choice)return;const {grade,p}=choice;let ratio=0;
      if(reqTc&&!c.tc.includes(reqTc.name))return;
      if(budget){if(p>budget)return;ratio=myPrice?p/myPrice:0}   // 예산 모드: 입력한 금액 이하 전부
      else if(myPrice){ratio=p/myPrice;if(ratio<lo||ratio>hi)return}else if(Math.abs(c.ovr-myOvr)>3)return;
      if(myOvr&&c.ovr<myOvr-1)return;
      const sc=recoScore(g,me,c,budget?0:ratio);
      sc.s+=((GRADE_BONUS[grade]||0)-(GRADE_BONUS[myG]||0))*.35;sc.why.push(`${grade}강 추천`);
      const shared=keep.filter(t=>c.tc.includes(t.name)).map(t=>t.name);
      if(bonusTc&&c.tc.includes(bonusTc.name)){sc.s+=3;shared.push(bonusTc.name)}
      sc.s+=shared.length*0.6;
      if(myPay&&c.pay){const dp=c.pay-myPay;sc.s-=Math.max(0,dp)*0.6;if(dp<=-2)sc.why.push(`급여 ${dp}`)}
      if(sc.s>=0.5)out.push({...c,grade,price:p,ratio,shared:[...new Set(shared)],...sc})});
    out.sort((a,b)=>b.s-a.s);const list=[],per={};
    for(const c of out){const pid=c.id%1e6;if((per[pid]=(per[pid]||0)+1)>2)continue;list.push(c);if(list.length>=5)break}
    return list};
  let list=pick(RC_LO,RC_HI,need),wide=false;
  if(!list.length&&need&&!budget){list=pick(0.4,2.5,need);wide=true}
  return {g,minGrade:minG,myG,me,myPrice,myNow,approx,list,wide,T,S,need,bonusTc,keep,budget};
}
/* 예산 수정: 기본은 같은 강화 시세 0.6~1.6배, 예산을 넣으면 그 금액 이하 카드 중에서 추천 */
function recoBudgetBox(R){
  return `<div class="rc-bud"><div class="rc-bud-row"><button type="button" class="rc-bud-btn" data-rc-budget aria-expanded="false">${R.budget?'예산 바꾸기':'예산 수정'}</button>${R.budget?`<button type="button" class="rc-bud-btn ghost" data-rc-reset>기본 추천으로</button>`:''}</div>
<form class="rc-bud-form" data-rc-form hidden><label>후보 구매 예산 (BP)<input type="text" inputmode="numeric" autocomplete="off" placeholder="예: 5000000" value="${R.budget||''}" data-rc-in></label><output data-rc-out>${R.budget?fmtBP(R.budget)+' BP':'금액을 숫자로 입력해 주세요'}</output><button type="submit" class="rc-bud-btn">이 예산으로 추천</button></form></div>`;
}
function recoHead(x){const g=RT_GROUP[x.pos];return `<div class="rc-h"><div><b id="rcTitle">${sch(x.seasonId)}${esc(x.name)}${gch(x.grade||1)}</b><small>${esc(x.pos)}${g?' · '+RT_GNAME[g]:''} 대체 추천</small></div><button type="button" class="rc-x" data-rc-close aria-label="닫기">×</button></div>${lowSummary(x).length?`<div class="rc-low">${lowSummary(x).map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}`}
function recoHTML(x,R){
  const note='<p class="rc-note">추천은 피파고수 시세·능력치 기준 참고용이에요. 팀컬러는 선발 11명의 클럽 경력·국가로 계산했어요. 실제 거래가는 선수 정보에서 확인해 주세요.</p>';
  if(R.err)return recoHead(x)+`<p class="rc-empty">${esc(R.err)}</p>`+note;
  const S=R.S,tcLine=S?`<div class="rc-tc"><b>내 팀컬러</b>${S.active.length?S.active.slice(0,3).map(t=>`<span>${esc(t.name)} ${t.n}명${t.lv?` (${t.lv}단계)`:''}</span>`).join(''):'<span class="muted">소속 팀컬러 없음</span>'}${S.wave?`<span class="wv">${esc(S.wave.name)}</span>`:''}</div>`:'';
  const rule=[R.need?`<b>${esc(R.need.name)}</b> 클럽 팀컬러를 유지하는 선수만`:R.bonusTc?`<b>${esc(R.bonusTc.name)}</b> 팀컬러 선수를 우선`:'',S&&S.wave?`<b>${esc(S.wave.name)}</b> 유지를 위해 후보별 <b>${R.minGrade}강 이상</b>`:'후보별 가격·가성비에 맞는 강화 단계'].filter(Boolean).join(', ');
  const base=`<p class="rc-base">${rule?rule+'으로 골랐어요. ':''}내 카드 ${R.myG}강 시세 <b>${fmtBP(R.myNow)}</b> · 급여 <b>${R.me.pay||'-'}</b> · OVR <b>${R.me.ovr||'-'}</b>(1강 기준). ${R.budget?`후보마다 예산 <b>${fmtBP(R.budget)}</b> 안에서 가능한 강화 단계를 골랐어요.`:R.myPrice?`내 카드 시세의 ${R.wide?'0.4~2.5':RC_LO+'~'+RC_HI}배 안에서 후보별 강화 단계를 골랐어요.`:'시세를 몰라 OVR ±3 안에서 골랐어요.'}</p>`+recoBudgetBox(R);
  if(!R.list.length)return recoHead(x)+tcLine+base+`<p class="rc-empty">${R.need?`${esc(R.need.name)} 팀컬러를 유지하면서 이 카드보다 나은 후보를 찾지 못했어요.`:'같은 가격대에서 이 카드보다 확실히 나은 후보를 찾지 못했어요.'} 강화 단계를 올리거나 예산을 조금 늘려 보세요.</p>`+note;
  const pc=r=>{const v=Math.round((r-1)*100);return v>0?`+${v}%`:v<0?`${v}%`:'±0%'};
  const rows=R.list.map(c=>{const d=R.me.ovr?c.ovr-R.me.ovr:null,dp=R.me.pay&&c.pay?c.pay-R.me.pay:null;
    const nt=c.tr.map(i=>R.T[i]).filter(t=>t&&(t[2]||NEW_TRAITS.has(t[0]))).map(t=>t[1]!=null?`<img class="rc-tr" src="${traitIcon(t[1])}" alt="${esc(t[0])}" title="${esc(t[0])}" ${hideBad}>`:`<span class="rc-trn">${esc(t[0])}</span>`).join('');
    return `<li><button type="button" class="rc-item" data-rc-sp="${c.id}" data-g="${c.grade}"><span class="rc-nm">${sch(Math.floor(c.id/1e6))}<b>${esc(c.name)}</b>${gch(c.grade)}${nt}</span>
<span class="rc-meta"><span>OVR <b>${c.ovr}</b>${d!=null?` <em class="${d>0?'up':d<0?'dn':''}">${d>0?'+'+d:d===0?'±0':d}</em>`:''}</span><span>${c.grade}강 <b>${fmtBP(c.price)}</b>${c.ratio?` <em class="${c.ratio<1?'up':c.ratio>1.05?'dn':''}">${pc(c.ratio)}</em>`:''}</span><span>급여 <b>${c.pay||'-'}</b>${dp!=null?` <em class="${dp<0?'up':dp>0?'dn':''}">${dp>0?'+'+dp:dp===0?'±0':dp}</em>`:''}</span><span>${c.h?`${c.h}cm · ${c.w}kg`:'키·몸무게 정보 없음'}</span></span>
${c.shared.length?`<span class="rc-tcs">${c.shared.map(t=>`<i>${esc(t)}</i>`).join('')}</span>`:''}${c.why.length?`<span class="rc-why">${c.why.slice(0,3).map(w=>`<i>${esc(w)}</i>`).join('')}</span>`:''}</button></li>`}).join('');
  return recoHead(x)+tcLine+base+(R.wide?'<p class="rc-empty">팀컬러를 유지하는 같은 가격대 후보가 없어서 가격 범위를 넓혀(0.4~2.5배) 찾았어요.</p>':'')+`<ul class="rc-list">${rows}</ul>`+note;
}
let rcLast=null,rcTk=0;
function recoClose(){const pop=$('rcPop');if(!pop||pop.hidden)return;pop.hidden=true;rcTk++;
  const b=rcLast&&document.contains(rcLast)?rcLast:rcLast&&$('dPanel').querySelector(`[data-reco="${rcLast.dataset.reco}"]`);if(b)b.focus()}
function recoOpen(spId,btn){
  const x=dCur&&dCur.a.players.find(p=>p.spId===spId);if(!x)return;
  let pop=$('rcPop');
  if(!pop){pop=document.createElement('div');pop.id='rcPop';pop.className='rc-pop';pop.hidden=true;
    pop.innerHTML='<div class="rc-panel" role="dialog" aria-modal="true" aria-labelledby="rcTitle" tabindex="-1"></div>';document.body.appendChild(pop);
    pop.addEventListener('click',e=>{if(e.target===pop||e.target.closest('[data-rc-close]'))return recoClose();
      if(e.target.closest('[data-rc-budget]')){const f=pop.querySelector('[data-rc-form]'),b=e.target.closest('[data-rc-budget]');f.hidden=!f.hidden;b.setAttribute('aria-expanded',!f.hidden);if(!f.hidden)f.querySelector('[data-rc-in]').focus();return}
      if(e.target.closest('[data-rc-reset]'))return recoRun(rcX,{});
      const b=e.target.closest('[data-rc-sp]');if(b){const g=+b.dataset.g||1;openCard(+b.dataset.rcSp);if(g>1){pmGrade=g;renderCard()}}});
    pop.addEventListener('input',e=>{const i=e.target.closest('[data-rc-in]');if(!i)return;const v=+i.value.replace(/[^0-9]/g,'')||0;i.value=v?String(v):'';pop.querySelector('[data-rc-out]').textContent=v?fmtBP(v)+' BP':'금액을 숫자로 입력해 주세요'});
    pop.addEventListener('submit',e=>{e.preventDefault();const v=+(pop.querySelector('[data-rc-in]').value||0);if(v>0)recoRun(rcX,{budget:v})})}
  rcLast=btn;pop.hidden=false;recoRun(x,{});
}
let rcX=null;
function recoRun(x,opt){
  const pop=$('rcPop');if(!pop||!x)return;rcX=x;const P=pop.firstElementChild,tk=++rcTk;
  P.innerHTML=recoHead(x)+`<p class="rc-empty">${opt.budget?'예산 안에서 ':'같은 포지션 '}후보를 찾는 중이에요…</p>`;P.scrollTop=0;P.focus();
  recoFor(x,opt).catch(()=>({err:'추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'})).then(R=>{if(tk===rcTk&&!pop.hidden)P.innerHTML=recoHTML(x,R)});
}
$('dPanel').addEventListener('click',e=>{const b=e.target.closest('[data-reco]');if(b){e.preventDefault();recoOpen(+b.dataset.reco,b)}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('pmodal').hidden)recoClose()},true);   // 선수 정보창이 위에 있으면 그것부터 닫혀요

/* ---------- 구단관리 공통 분석: 한 번 받은 경기·카드 데이터를 모든 탭에서 공유 ---------- */
const DIAG_MARKET={};
let OPP_TC_P=null;
function dOpponentTeamcolors(){
  if(!LIVE)return Promise.resolve(null);
  if(!OPP_TC_P)OPP_TC_P=fetch(`${DATA_BASE}/diag/opponent-teamcolors.json`).then(r=>{if(!r.ok)throw new Error('opponent teamcolors unavailable');return r.json()}).then(j=>{if(!j||!Array.isArray(j.names)||!j.cards)throw new Error('invalid opponent teamcolors');return j}).catch(e=>{OPP_TC_P=null;throw e});
  return OPP_TC_P
}
async function dMarket(spid,grade){
  if(!LIVE)return null;const sh=spid%SHARDS;
  if(!DIAG_MARKET[sh])DIAG_MARKET[sh]=fetch(`${DATA_BASE}/diag/market-${sh}.json`).then(r=>r.ok?r.json():null).catch(()=>null);
  const j=await DIAG_MARKET[sh],rows=j&&j.cards&&j.cards[String(spid)],gi=grade===1?0:grade===5?1:grade===8?2:-1;
  if(!rows||gi<0)return null;const r=rows[gi];return r?{price:r[0],p1:r[1],p7:r[2],p30:r[3],days:[r[4],r[5],r[6]],date:j.date}:null
}
const dLineGroup=p=>LINE(p)==='GK'?'GK':LINE(p);
/* 보강 판단: 비교 가능한 실제 표본만 반영. 점수/컷은 서비스 자체 기준이며 승률 예측이 아님. */
function dAssessPlayer(x,peers){
  if(x.apps<3)return {eval:null,action:'평가 보류',reason:'3경기 미만',risk:0};
  const reasons=[], signals=[], scores=[], add=(label,risk,score)=>{reasons.push(label);signals.push(risk);scores.push(score)};
  const clamp=v=>Math.max(0,Math.min(100,v));
  let ratingGap=0,repeatLow=0,repeatN=0,rankerLowCount=0,strongPeer=false;
  const ref=x.rtRef;
  if(ref&&ref.avg>0&&ref.n>=30){
    const gap=ref.avg-x.avg;ratingGap=gap;
    add(`상위등급 포지션 평점 ${x.avg.toFixed(2)}/${ref.avg.toFixed(2)} (표본 ${ref.n})`,gap>=.20?2:gap>=.10?1:0,clamp(60-gap*100));
    const ratings=(x.r||[]).filter(v=>Number.isFinite(v)&&v>0);
    if(ratings.length>=5){const low=ratings.filter(v=>v<=ref.avg-.1+1e-9).length;const frac=low/ratings.length;repeatLow=frac;repeatN=ratings.length;
      add(`평점 기준 미달 ${low}/${ratings.length}경기`,frac>=.6?1:0,clamp(80-60*frac))}
  }
  if(x.rk){const low=Object.values(x.rkLow||{});const keys=[...(LINE(x.pos)==='공격'||LINE(x.pos)==='미드'?RK_ATT:[]),...(LINE(x.pos)==='수비'||LINE(x.pos)==='미드'?RK_DEF:[])];
    const comparable=keys.filter(([k,lb])=>dRankerCompare(x,k,lb,x.rk));
    if(comparable.length){rankerLowCount=low.length;add(low.length?low.map(v=>`${v.lb} ${dRankerValue(v,v.mine)}/${dRankerValue(v,v.avg)}`).join(' · '):'랭커 비교 지표 기준 미달 없음',low.length>=2?2:low.length?1:0,clamp(75-50*low.length/comparable.length))}
  }
  const peer=peers.filter(p=>p!==x&&p.apps>=10&&p.pos===x.pos&&p.spId!==x.spId).sort((a,b)=>b.avg-a.avg||b.apps-a.apps)[0];
  if(peer&&x.apps>=5){const gap=peer.avg-x.avg,wr=peer.wr-x.wr;
    strongPeer=peer.apps>=10&&gap>=.25-1e-9&&wr>=.10-1e-9;
    add(`동일 포지션 ${dCardLabel(peer)} 대비 평점 ${gap>=0?'-':'+'}${Math.abs(gap).toFixed(2)} · 승률 ${Math.round(-wr*100)}%p`,gap>=.2&&wr>=.10?2:0,clamp(60-gap*70-wr*30));
    if(x.price>0&&peer.price>0&&x.price>=peer.price*1.2&&gap>=.1&&wr>=0)reasons.push(`동일 포지션 대비 고가(${(x.price/peer.price).toFixed(1)}배)·낮은 성적: 가격 효율 검토`);
  }
  if(!scores.length)return {eval:null,action:'평가 보류',reason:'비교 가능한 상위등급·랭커·동일 포지션 표본 부족',risk:0};
  const risk=signals.reduce((a,b)=>a+b,0),score=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
  // 한 지표의 경고만으로는 교체하지 않는다. 10경기 이상에서 반복 평점과
  // 랭커 비교가 함께 낮거나, 격차가 큰 반복 부진, 충분한 동포지션 대안이 필요하다.
  const persistent=repeatN>=10&&repeatLow>=.60;
  const review=x.apps>=10&&(strongPeer||(persistent&&ratingGap>=.20-1e-9&&rankerLowCount>=2)||(repeatN>=10&&repeatLow>=.70-1e-9&&ratingGap>=.35-1e-9&&rankerLowCount>=1));
  const action=x.apps<5?'평가 보류':review?'교체 검토':risk===0&&score>=67?'기용 추천':'유지';
  return {eval:score,action,reason:`${x.apps}경기 · ${reasons.join(' / ')}${x.apps<10?' · 10경기 미만 교체 판단 보류':''}`,risk};
}
function dRatePlayers(a){
  const by={};a.players.forEach(x=>(by[RT_GROUP[x.pos]||x.pos]??=[]).push(x));
  Object.values(by).forEach(list=>{list.forEach(x=>{Object.assign(x,dAssessPlayer(x,list));x.posRank=null;x.reco=null});list.filter(x=>x.eval!=null).sort((x,y)=>y.eval-x.eval).forEach((x,i,arr)=>{x.posRank=`${i+1}/${arr.length}`})})
}
function dPriority(a){return a.players.filter(x=>x.action==='교체 검토').sort((x,y)=>y.risk-x.risk||(x.eval??100)-(y.eval??100)||y.apps-x.apps)}
function dExactPrice(L,grade){const g=Number(grade),v=Number(L?.price?.[g-1]);return Number.isInteger(g)&&g>=1&&g<=13&&Number.isSafeInteger(v)&&v>0?v:null}
function dPriceText(x){return x.price?'<span title="'+esc(x.priceAt?'수집 시각 '+x.priceAt:'수집 시각 미상')+'">'+fmtBP(x.price)+'</span>':'<span class="muted">조회 불가</span>'}
async function dEnrich(a,seq){
  await Promise.all(a.players.map(async x=>{const d=await cardData(x.spId).catch(()=>null);if(seq!==diagSeq)return;const L=d&&d.l,I=ix(x.spId)||[];x.pay=(L&&L.pay)||I[2]||null;x.price=dExactPrice(L,x.grade);x.priceAt=L?.at||null;x.market=await dMarket(x.spId,x.grade)}));
  if(seq!==diagSeq)return;
  dRatePlayers(a);
  const rec=a.recentLineup||[],map=Object.fromEntries(a.players.map(x=>[x.spId,x]));a.recentPlayers=await Promise.all(rec.map(async p=>{const x=map[p.spId];if(!x)return null;if(+p.spGrade===+x.grade)return {...x,pos:p.pos};const grade=+p.spGrade,L=(await cardData(p.spId).catch(()=>null))?.l,price=dExactPrice(L,grade);return {...x,pos:p.pos,grade,price,priceAt:L?.at||null,market:await dMarket(p.spId,grade)}}));if(seq!==diagSeq)return;a.recentPlayers=a.recentPlayers.filter(Boolean);a.valueKnown=a.recentPlayers.filter(x=>x.price>0).length;a.valueMissing=a.recentPlayers.length-a.valueKnown;a.squadValue=a.recentPlayers.reduce((n,x)=>n+(x.price||0),0)||null;
  const targets=dPriority(a).slice(0,4);
  await Promise.all(targets.map(async x=>{const R=await recoFor(x,{}).catch(()=>null);if(seq!==diagSeq||!R||!R.list||!R.list[0])return;const c=R.list[0];x.reco={id:c.id,name:c.name,price:c.price,grade:c.grade,need:x.price>0?Math.max(0,c.price-x.price):null}}));
  if(seq!==diagSeq)return;a.enriched=true;dSaveVisit(dCur.d,a);dRenderReport(dCur.d,a);if(['pstats','growth','ranker'].includes(dTab))dRenderPanel()
}
const dPct=(v,days)=>v==null?'<span class="muted">조회 불가</span>':`<span class="${v>0?'up':v<0?'dn':''}"${days?` title="실제 ${days}일 전 전체 스냅샷과 비교"`:''}>${v>0?'+':''}${v.toFixed(1)}%${days?`<small> · ${days}일</small>`:''}</span>`;
function dRenderReport(d,a){
  const best=a.players.filter(x=>x.eval!=null).sort((x,y)=>y.eval-x.eval)[0],worst=dPriority(a).find(x=>dRecentRows([x],a.recentLineup,true).length);
  $('dReportShell').hidden=false;
  $('dReportHead').innerHTML=`<div><b>종합 구단 리포트</b><small>최근 ${a.n}경기 · 실제 경기와 수집 시세 기반</small></div><span>${a.enriched?'분석 완료':'선수 시세·팀컬러 분석 중…'}</span>`;
  $('dReport').innerHTML=`<div class="dr-grid dr-insights">
    <div><span>최근 스쿼드 가치</span><b>${a.squadValue?fmtBP(a.squadValue):'계산 중'}</b><small>${a.valueMissing?`${a.valueMissing}명 시세 제외`:`${a.valueKnown||0}명 확인`}</small></div>
    <div class="dr-priority"><span>우선 보강</span><b>${!a.enriched?'분석 중':worst?esc(dCardLabel(worst)):dRecentRows(a.players,a.recentLineup,true).some(x=>x.action&&x.action!=='평가 보류')?'뚜렷한 보강 후보 없음':'판단 보류'}</b><small>${worst?'반복 평점·랭커 또는 동포지션 비교 기준 충족':a.enriched?'최근 출전 선수 기준':'랭커·평점 비교 중'}</small></div></div><div class="dr-actions" aria-label="구단 리포트 작업"></div>`
  const actions=$('dReport').querySelector('.dr-actions');
  if(a.enriched&&a.recentPlayers?.length&&!d.sample){const b=document.createElement('button');b.type='button';b.className='ghost dr-action';b.title='최근 스쿼드를 AI 스쿼드에서 개선 추천';b.setAttribute('aria-label',b.title);b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 1.2 4.1L15 8l-3.8 1.9L10 14l-1.2-4.1L5 8l3.8-1.9L10 2Zm5 10 .7 2.3L18 15.5l-2.3 1.2L15 19l-.7-2.3-2.3-1.2 2.3-1.2L15 12Z"/></svg><span>AI 개선</span>';b.addEventListener('click',()=>{try{sessionStorage.setItem('fg-squad-recent-v1',JSON.stringify({players:a.recentPlayers.map(p=>({id:+p.spId,grade:+p.grade,pos:p.pos,name:p.name,review:p.action==='교체 검토'}))}));location.assign('/squad/?import=1')}catch(e){location.assign('/squad/')}});actions.appendChild(b)}

  if(a.enriched&&!d.sample&&a.n>0){const b=document.createElement('button');b.type='button';b.className='ghost dr-action';b.title='내 진단 기록에 저장';b.setAttribute('aria-label',b.title);b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h10l2 2v12H4V3Zm3 0v5h6V3M7 17v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><span>진단 저장</span>';b.addEventListener('click',async()=>{b.disabled=true;try{const nickname=d.basic.nickname,body='최근 '+a.n+'경기 · 승률 '+Math.round(a.W/a.n*100)+'%'+(a.squadValue?' · 최근 스쿼드 가치 '+fmtBP(a.squadValue):'')+(best?' · 우수 선수 '+dCardLabel(best):'')+(worst?' · 우선 보강 '+dCardLabel(worst):'');const r=await fetch('/api/community/diagnosis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname,body})});const j=await r.json();if(!r.ok)throw Error(j.message);b.querySelector('span').textContent='저장 완료'}catch(err){alert('저장 실패: '+err.message);b.disabled=false}});actions.appendChild(b)}

}
/* One representative per match. Equal top counts are ambiguous, not a random winner. */
function dInferTeamcolor(players,TC,excluded=null){
  const reject=k=>{if(excluded)excluded[k]=(excluded[k]||0)+1;return null};
  const ids=[...new Set(players.slice(0,11).map(p=>String(p.spId)))],cnt={};
  if(ids.length<8)return reject('lineup');
  const known=ids.filter(id=>Array.isArray(TC.cards[id])||TC.seasonById?.[String(Math.floor(Number(id)/1e6))]!=null).length;
  if(known<8)return reject('coverage');
  ids.forEach(id=>{
    const memberships=new Set(TC.cards[id]||[]),season=TC.seasonById?.[String(Math.floor(Number(id)/1e6))];
    if(season!=null)memberships.add(season);
    for(const i of memberships)if(TC.names[i])cnt[i]=(cnt[i]||0)+1;
  });
  const priority={season:3,club:2,nation:1};
  const sorted=Object.entries(cnt).filter(([,n])=>n>=8).sort((a,b)=>b[1]-a[1]||(priority[TC.kinds?.[b[0]]]||0)-(priority[TC.kinds?.[a[0]]]||0));
  if(!sorted.length)return reject('members');
  const [id,n]=sorted[0],kind=TC.kinds?.[id]||'unknown';
  const tied=sorted.filter(([k,v])=>v===n&&(priority[TC.kinds?.[k]]||0)===(priority[kind]||0));
  const names=tied.map(([k])=>TC.names[k]).sort((a,b)=>a.localeCompare(b,'ko'));
  return {name:names.join(' / ')+(names.length>1?' (동률)':''),kind,n,known,confidence:n===11?'매우 높음':'높음',tied:names.length>1};
}
function dTeamcolorStats(matches,TC){
  const agg={},valid=[],excluded={};matches.forEach(m=>{const c=dInferTeamcolor(m.matchInfo[1].player,TC,excluded);if(!c)return;valid.push(c);const key=c.kind+'|'+c.name,x=agg[key]??={name:c.name,kind:c.kind,n:0,w:0,d:0,l:0,members:0,high:0};x.n++;x.members+=c.n;if(c.confidence==='매우 높음')x.high++;const r=m.matchInfo[0].matchDetail.matchResult;x[r==='승'?'w':r==='무'?'d':'l']++});
  const groups=Object.values(agg);return {valid,excluded,single:groups.filter(x=>x.n===1).length,all:groups};
}
function dTeamcolorRankings(all){
  const eligible=all.filter(x=>x.n>=3);
  const group=k=>{
    const by=new Map();
    eligible.filter(x=>x[k]>0).sort((a,b)=>b[k]/b.n-a[k]/a.n||b.n-a.n).forEach(x=>{
      const pct=Math.round(x[k]/x.n*100);
      if(!by.has(pct))by.set(pct,{pct,teams:[]});
      by.get(pct).teams.push(x);
    });
    return [...by.values()].slice(0,5);
  };
  return {eligible,wins:group('w'),loss:group('l')};
}
async function dLoadTeamcolors(d,a,seq){
  $('dTc').hidden=false;$('dTc').innerHTML='<div class="dtc-head"><b>상대 팀컬러별 승률</b><small>상대 출전선수 소속 분석 중…</small></div>';
  const TC=await dOpponentTeamcolors().catch(()=>null);if(seq!==diagSeq)return;
  if(!TC||!TC.seasonById||!TC.kinds){$('dTc').innerHTML='<div class="dtc-head"><b>상대 팀컬러별 승률</b><small>평가 보류</small></div><p class="empty">새 팀컬러 매핑 데이터를 준비 중이에요.</p>';return}
  const matches=d.matches,{all,valid,excluded}=dTeamcolorStats(matches,TC),{eligible,wins,loss}=dTeamcolorRankings(all);
  const kindLabel={season:'단일 시즌',club:'클럽',nation:'국가'};
  const row=g=>`<li class="dtc-rank-row"><div class="dtc-rank-teams">${g.teams.map(x=>`<div class="dtc-rank-team"><b>${esc(x.name)}</b><small>${x.n}경기 ${x.w}승 ${x.d}무 ${x.l}패${x.n<5?' · 소표본':''}</small></div>`).join('')}</div><em>${g.pct}%</em></li>`;
  $('dTc').innerHTML=`<div class="dtc-head"><div><b>상대 팀컬러별 승률</b><small>최근 ${matches.length}경기 · 출전 구성 기준 ${valid.length}경기 · 최소 3경기</small></div></div>${eligible.length?`<div class="dtc-cols"><div><h3>승리 TOP 5 <small>내 승률</small></h3><ol>${wins.map(row).join('')||'<li>승리 표본 없음</li>'}</ol></div><div><h3>패배 TOP 5 <small>내 패배율</small></h3><ol>${loss.map(row).join('')||'<li>패배 표본 없음</li>'}</ol></div></div><details><summary>3경기 이상 상대 팀컬러 기록 (${eligible.length}개)</summary><div class="tablewrap"><table><thead><tr><th>팀컬러</th><th>종류</th><th>평균 일치 인원</th><th>경기</th><th>승·무·패</th><th>승률</th></tr></thead><tbody>${eligible.slice().sort((a,b)=>b.n-a.n).map(x=>`<tr><td>${esc(x.name)}${x.n<5?' · 소표본':''}</td><td>${kindLabel[x.kind]||'소속'}</td><td>${(x.members/x.n).toFixed(1)}명</td><td>${x.n}</td><td>${x.w}·${x.d}·${x.l}</td><td>${Math.round(x.w/x.n*100)}%</td></tr>`).join('')}</tbody></table></div></details>`:'<p class="empty">3경기 이상 상대했던 팀컬러가 없어요. 50경기 또는 100경기로 분석 범위를 늘려 보세요.</p>'}`
}
function timeChart(a){
  const W=640,H=260,l=40,rr=12,t=24,b=34,mid=t+(H-t-b)/2,max=Math.max(1,...a.bins.map(x=>Math.max(x.f,x.a))),sc=v=>v/max*((H-t-b)/2-6),bw=(W-l-rr)/6;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="15분 단위 득점과 실점">`;
  [-max,0,max].forEach(v=>{const y=mid-sc(v);s+=`<line x1="${l}" x2="${W-rr}" y1="${y}" y2="${y}" stroke="var(--line)" ${v?'stroke-dasharray="3 4"':''}/><text x="${l-8}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--muted)">${Math.abs(v)}</text>`});
  a.bins.forEach((x,i)=>{const cx=l+bw*i+bw/2,w=bw*0.5;
    if(x.f)s+=`<rect x="${cx-w/2}" y="${mid-sc(x.f)}" width="${w}" height="${sc(x.f)}" rx="3" fill="var(--good)"/><text x="${cx}" y="${mid-sc(x.f)-5}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--fg)">${x.f}</text>`;
    if(x.a)s+=`<rect x="${cx-w/2}" y="${mid}" width="${w}" height="${sc(x.a)}" rx="3" fill="var(--crit)"/><text x="${cx}" y="${mid+sc(x.a)+14}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--fg)">${x.a}</text>`;
    s+=`<text x="${cx}" y="${H-10}" text-anchor="middle" font-size="12" fill="var(--muted)">${x.label}분</text>`});
  s+=`<text x="${l}" y="14" font-size="11" fill="var(--muted)">위: 득점 · 아래: 실점</text></svg>`;
  const peak=a.bins.reduce((m,x)=>x.a>m.a?x:m,a.bins[0]);
  return `<div class="legend"><span><i style="background:var(--good)"></i>득점 ${a.gf}</span><span><i style="background:var(--crit)"></i>실점 ${a.ga}</span></div>${s}<p class="note">실점이 가장 많은 시간대는 <b>${peak.label}분</b>(${peak.a}골)이에요.</p>`;
}
function shotMap(a){
  const W=520,H=400,px=x=>(1-x)/0.5*(H-20)+10,py=y=>20+y*(W-40);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="내 슈팅 위치"><rect width="${W}" height="${H}" rx="10" fill="var(--pitch)"/><g fill="none" stroke="var(--pitch-line)" stroke-width="2"><rect x="${py(0)}" y="${px(1)}" width="${py(1)-py(0)}" height="${px(0.5)-px(1)}"/><rect x="${py(0.2)}" y="${px(1)}" width="${py(0.8)-py(0.2)}" height="${px(0.84)-px(1)}"/><rect x="${py(0.37)}" y="${px(1)}" width="${py(0.63)-py(0.37)}" height="${px(0.945)-px(1)}"/><path d="M ${py(0.4)} ${px(0.84)} A 60 60 0 0 0 ${py(0.6)} ${px(0.84)}"/></g>`;
  a.shots.filter(x=>x.result!==3).forEach(x=>s+=`<circle cx="${py(x.y)}" cy="${px(x.x)}" r="5" fill="rgba(255,255,255,.38)"/>`);
  a.shots.filter(x=>x.result===3).forEach(x=>s+=`<circle cx="${py(x.y)}" cy="${px(x.x)}" r="7" fill="var(--gold)" stroke="#3B2A00" stroke-width="1.2"/>`);
  const ins=a.shots.filter(x=>x.inPenalty),out=a.shots.filter(x=>!x.inPenalty),gr=v=>v.length?Math.round(v.filter(x=>x.result===3).length/v.length*100):0;
  return `<div class="legend"><span><i style="background:var(--gold)"></i>골</span><span><i style="background:var(--muted)"></i>슈팅</span></div>${s}</svg><p class="note">박스 안 슈팅 ${ins.length}개 중 ${gr(ins)}% 득점 · 박스 밖 ${out.length}개 중 ${gr(out)}% 득점</p>`;
}
function dPlayerTable(a){return `<div class="tablewrap"><table><thead><tr><th>선수</th><th class="n">출전</th><th class="n">승률</th><th class="n">평점</th><th class="n">골</th><th class="n">도움</th></tr></thead><tbody>${a.players.map(x=>`<tr class="${x.low?'low':''}"><td><span class="pos">${x.pos}</span>${sch(x.seasonId)}${esc(x.name)}${recoFlag(x)}${a.dm?`${gch(x.grade)}`:''}</td><td class="n">${x.apps}</td><td class="n">${Math.round(x.wr*100)}%</td><td class="n">${rtCell(x)}</td><td class="n">${rkCell(x,'goal',x.g)}</td><td class="n">${rkCell(x,'assist',x.a)}</td></tr>`).join('')}</tbody></table></div><p class="note">팀 평균 평점 ${a.teamAvg.toFixed(2)} · 빨간 줄은 팀 평균보다 0.5 이상 낮은 선수${rtNote(a)}</p>`}
function dFormView(a){const total=a.W/a.n;return `<div class="tablewrap"><table><thead><tr><th>상대 포메이션</th><th class="n">경기</th><th class="n">승·무·패</th><th>승률</th></tr></thead><tbody>${a.forms.map(x=>{const bad=x.n>=4&&x.wr<=total-0.2,good=x.n>=4&&x.wr>=total+0.2;return `<tr class="${bad?'low':good?'hi':''}"><td>${esc(x.f)}</td><td class="n">${x.n}</td><td class="n">${x.w}·${x.d}·${x.l}</td><td><span class="wr ${bad?'bad':''}" style="width:${Math.max(4,x.wr*80)}px"></span>${Math.round(x.wr*100)}%</td></tr>`}).join('')}</tbody></table></div><p class="note">상대 선수 포지션으로 포메이션을 판별했어요. 전체 승률 ${Math.round(total*100)}%보다 20%p 이상 낮으면 빨간색이에요(4경기 이상).</p>`}
function dLineView(a){const mn=5,mx=8.5,p=v=>Math.max(0,Math.min(100,(v-mn)/(mx-mn)*100));return `<div class="legend"><span><i style="background:var(--good)"></i>내 라인 평균</span><span><i style="background:var(--fg);border-radius:1px;width:3px"></i>상대 같은 라인 평균</span></div><div class="lines">${a.lines.map(x=>`<div class="row ${x.weak?'weak':''}"><span>${x.k}</span><div class="track"><i style="width:${p(x.me)}%"></i><b style="left:${p(x.op)}%"></b></div><span class="num">${x.me.toFixed(2)} / ${x.op.toFixed(2)}</span></div>`).join('')}</div><p class="note">막대가 검은 선보다 짧으면 그 라인이 상대에게 밀린다는 뜻이에요.</p>`}
function dStatsView(a){
  const f=(v,t)=>t==='%1'?(v*100).toFixed(1)+'%':t==='%'?Math.round(v*100)+'%':t==='n2'?v.toFixed(2):t==='n0'?String(Math.round(v)):v.toFixed(1);
  const rows=a.stats.map(r=>{if(r[0]==='그룹')return `<tr><th colspan="4" style="padding-top:14px;color:var(--fg);font-size:13px">${r[1]}</th></tr>`;
    const [k,me,op,t,hi]=r, d0=me-op, d=Math.abs(d0)<(t==='%'?0.005:t==='%1'?0.0005:t==='n2'?0.005:0.05)?0:d0, rel=op?d/Math.abs(op):0, good=hi?rel>0.06:rel<-0.06, bad=hi?rel<-0.06:rel>0.06;
    const dd=t==='%1'?(d>=0?'+':'')+(d*100).toFixed(1)+'%p':t==='%'?(d>=0?'+':'')+Math.round(d*100)+'%p':(d>=0?'+':'')+(t==='n0'?Math.round(d):d.toFixed(t==='n2'?2:1));
    return `<tr class="${bad?'low':good?'hi':''}"><td>${k}</td><td class="n">${f(me,t)}</td><td class="n">${f(op,t)}</td><td class="n">${dd}</td></tr>`}).join('');
  const flow=a.flow.map(([k,v,cnt])=>`<div><div class="k">${k}</div><div class="v">${v==null?'-':cnt!=null?Math.round(v*100)+'%':v}${cnt!=null?`<span style="font-size:12px;color:var(--muted)"> ${cnt}경기</span>`:''}</div></div>`).join('');
  return `<div class="h2" style="font-size:15px">승부 흐름</div><div class="stat-grid">${flow}</div>
  <div class="h2" style="font-size:15px;margin-top:18px">세부 지표 <small>최근 ${a.n}경기 · 나 vs 내가 만난 상대 평균</small></div>
  <div class="tablewrap"><table><thead><tr><th>지표</th><th class="n">나</th><th class="n">상대 평균</th><th class="n">차이</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">초록은 상대보다 6% 이상 좋은 지표, 빨강은 6% 이상 나쁜 지표예요. 볼 경합·공중볼 경합은 넥슨 API의 선수별 경합 기록을 합산한 값이에요.</p>`;
}
function dRecentCheckbox(a){return `<label class="d-recent-filter"><input type="checkbox" data-dfilter="recent"${dFilter.recent?' checked':''}>최근 스쿼드 기준 <small>(${(a.recentLineup||[]).length}명)</small></label>`}
function dPStatsView(a){
  const pc=(s,t)=>t?Math.round(s/t*100)+'%':'-', st=x=>x.t||{};
  const wrc=v=>v>=0.6?'wr-hi':v<0.4?'wr-lo':'';
  const rkNote=!LIVE?'':a.rkN==null?' 상위 랭커 비교 데이터를 불러오는 중이에요…':a.rkN?` <span class="rk-ic">!</span> 빨간 느낌표는 동일 선수·포지션의 상위 랭커(TOP 10,000) 비교에서 경기당 횟수가 평균의 70% 미만이거나, 패스·드리블 성공률이 10%p 이상 낮고 랭커 성공률의 85% 미만인 기록이에요. 성공률 비교 표본이 없으면 경고하지 않아요. 공격수·미드필더는 공격 지표, 수비수·미드필더는 수비 지표를 비교해요.`:' 이 스쿼드 선수들은 상위 랭커 비교 데이터가 없어요.';
  let rows=dRecentRows(a.players,a.recentLineup,dFilter.recent).filter(x=>(!dFilter.pos||dLineGroup(x.pos)===dFilter.pos)&&x.apps>=dFilter.apps&&(!dFilter.action||x.action===dFilter.action));const sorts={apps:(x,y)=>y.apps-x.apps,rating:(x,y)=>y.avg-x.avg,win:(x,y)=>y.wr-x.wr,eval:(x,y)=>(y.eval??-1)-(x.eval??-1),price:(x,y)=>(y.price||0)-(x.price||0),pitch:dComparePosition};rows.sort(sorts[dFilter.sort]||sorts.pitch);
  return `<div class="pfilters">${dRecentCheckbox(a)}<label>라인<select data-dfilter="pos"><option value="">전체</option>${['공격','미드','수비','GK'].map(v=>`<option${dFilter.pos===v?' selected':''}>${v}</option>`).join('')}</select></label><label>최소 출전<select data-dfilter="apps">${[1,3,5,10].map(v=>`<option value="${v}"${dFilter.apps===v?' selected':''}>${v}경기</option>`).join('')}</select></label><label>추천<select data-dfilter="action"><option value="">전체</option>${['기용 추천','유지','교체 검토','평가 보류'].map(v=>`<option${dFilter.action===v?' selected':''}>${v}</option>`).join('')}</select></label><label>정렬<select data-dfilter="sort">${[['pitch','포지션'],['apps','출전'],['rating','평점'],['win','승률'],['eval','실전 기여'],['price','시세']].map(([v,l])=>`<option value="${v}"${dFilter.sort===v?' selected':''}>${l}</option>`).join('')}</select></label></div><div class="tablewrap pstwrap"><table class="pst pstx"><thead><tr><th>선수</th><th class="n">출전</th><th class="n">승률</th><th class="n">평점</th><th class="n">골</th><th class="n">도움</th><th class="n">슈팅(유효)</th><th class="n">패스 성공률</th><th class="n">드리블 성공률</th><th class="n">볼 경합 성공률</th><th class="n">공중볼 성공률</th><th class="n">태클</th><th class="n">가로채기</th><th class="n">블락</th><th class="n">현재 시세</th><th class="n">24시간</th><th class="n">7일</th><th class="n">경기당 골</th><th class="n">경기당 도움</th><th class="n">포지션 순위</th><th class="n">실전 기여</th><th>종합 평가</th><th>교체 후보</th><th class="n">필요 BP</th></tr></thead><tbody>
  ${!rows.length?'<tr><td colspan="24">조건에 맞는 선수 기록이 없어요.</td></tr>':''}${rows.map(x=>{const t=st(x);return `<tr class="${x.low||x.action==='교체 검토'?'low':x.action==='기용 추천'?'hi':''}"><td><span class="pos">${x.pos}</span>${sch(x.seasonId)}${esc(x.name)}${recoFlag(x)}${a.dm||x.grade>1?`${gch(x.grade)}`:''}</td><td class="n">${x.apps}</td><td class="n"><span class="${wrc(x.wr)}">${Math.round(x.wr*100)}%</span><span class="why">${x.w}승</span></td><td class="n">${rtCell(x)}</td><td class="n">${rkCell(x,'goal',x.g)}</td><td class="n">${rkCell(x,'assist',x.a)}</td>
    <td class="n">${rkCell(x,'shoot',t.shoot)}(${rkCell(x,'effectiveShoot',t.effectiveShoot)})</td><td class="n">${rkCell(x,'passSuccess',pc(t.passSuccess,t.passTry))}</td><td class="n">${rkCell(x,'dribbleSuccess',pc(t.dribbleSuccess,t.dribbleTry))}</td>
    <td class="n">${dDuelCell(t.ballPossesionSuccess,t.ballPossesionTry)}</td><td class="n">${dDuelCell(t.aerialSuccess,t.aerialTry)}</td>
    <td class="n">${rkCell(x,'tackle',`${t.tackle}/${t.tackleTry}`)}</td><td class="n">${t.intercept}</td><td class="n">${rkCell(x,'block',t.block)}</td><td class="n">${dPriceText(x)}</td><td class="n">${x.market?dPct(x.market.p1,x.market.days[0]):'<span class="muted">조회 불가</span>'}</td><td class="n">${x.market?dPct(x.market.p7,x.market.days[1]):'<span class="muted">조회 불가</span>'}</td><td class="n">${(x.g/x.apps).toFixed(2)}</td><td class="n">${(x.a/x.apps).toFixed(2)}</td><td class="n">${x.posRank||'-'}</td><td class="n"><span class="ev ${x.action==='교체 검토'?'bad':x.action==='기용 추천'?'good':''}" title="${esc(x.reason||'표본 부족')}">${x.eval==null?'보류':x.eval}</span></td><td><b class="act ${x.action==='교체 검토'?'bad':x.action==='기용 추천'?'good':''}">${x.action||'분석 중'}</b></td><td>${x.reco?`<button type="button" class="linkbtn" data-reco="${x.spId}">${sch(Math.floor(x.reco.id/1e6))}${esc(x.reco.name)} ${x.reco.grade}강</button>`:x.action==='교체 검토'?(a.enriched?'후보 없음':'분석 중'):'-'}</td><td class="n">${x.reco&&x.reco.need!=null?(x.reco.need?fmtBP(x.reco.need):'0 BP'):'-'}</td></tr>`}).join('')}
  </tbody></table></div><p class="note">최근 ${a.n}경기 합계예요. ${dFilter.recent?'최근 1경기 출전 카드만 표시하며 기록은 선택한 전체 경기의 누적값입니다. ':''}볼 경합·공중볼은 성공률과 성공·시도 횟수를 구분하며, 시도가 없으면 '-'로 표시합니다. 포지션 순위는 같은 포지션 묶음 내 실전 기여 점수 기준이며, 실전 기여는 상위등급 포지션 평점·랭커 지표·동일 포지션 비교 표본을 기준으로 산정한 자체 점수입니다. 교체 검토는 10경기 이상에서 반복적인 큰 평점 열세와 복수 랭커 지표 열세, 매우 큰 지속적 평점 열세 또는 충분한 동일 포지션 비교 표본이 확인될 때만 표시합니다. 가격 효율은 참고용입니다. 시세 변동은 수집 이력이 있는 1·5·8강만 제공하고 누락값은 0으로 계산하지 않아요.${rkNote}${rtNote(a)}</p>`;
}
function dGrowthView(a){
  const s=dRead(),key=dHistoryKey(dCur.d.basic.nickname,dMode),list=(s.history&&s.history[key])||[],prev=list.length>1?list[list.length-2]:null,now=list[list.length-1],own=(s.goals&&s.goals[key])||{};
  const diff=(v,p,unit='')=>p==null?'-':`${v-p>0?'+':''}${typeof v==='number'&&Math.abs(v-p)<1?(v-p).toFixed(2):Math.round(v-p)}${unit}`,changed=prev&&now?[...new Set(now.ids||[])].filter(x=>!(prev.ids||[]).includes(x.split(':')[0])&&!prev.ids.includes(x)).length:0;
  return `<div class="growth-head"><div><b>구단 성장 기록</b><small>이 브라우저에서 같은 구단주·모드를 조회할 때마다 하루 1회 저장</small></div><span>${list.length}일 기록</span></div>${prev?`<div class="compare"><div><span>비교 경기</span><b>${prev.n} → ${now.n}</b></div><div><span>승률</span><b>${Math.round(prev.wr*100)}% → ${Math.round(now.wr*100)}%</b><small>${diff(now.wr*100,prev.wr*100,'%p')}</small></div><div><span>평균 득점</span><b>${prev.gf.toFixed(2)} → ${now.gf.toFixed(2)}</b><small>${diff(now.gf,prev.gf)}</small></div><div><span>평균 실점</span><b>${prev.ga.toFixed(2)} → ${now.ga.toFixed(2)}</b><small>${diff(now.ga,prev.ga)}</small></div><div><span>스쿼드 변화</span><b>${changed?changed+'명 감지':'변화 없음'}</b><small>시즌·강화 구분</small></div></div>`:'<p class="empty">첫 진단을 저장했어요. 다른 날 다시 조회하면 이전 진단과 비교해 드려요.</p>'}
  <div class="goalbox"><h3>내 목표 <small>선택 입력 · 이 기기에만 저장</small></h3><label>목표 승률<input data-goal="wr" type="number" min="0" max="100" value="${own.wr||''}" placeholder="예: 60"><span>%</span></label><label>목표 보유 BP<input data-goal="bp" inputmode="numeric" value="${own.bp||''}" placeholder="숫자만"></label><label>목표 선수<input data-goal="player" value="${esc(own.player||'')}" placeholder="선수명"></label></div><p class="note">교체와 성적 변화가 함께 나타나도 특정 선수 교체가 원인이라고 단정하지 않아요. 비교 기간과 경기 유형이 다른 기록은 합치지 않습니다.</p>`
}
function dRankerView(a){
  const eligible=dRecentRows(a.players,a.recentLineup,dFilter.recent),rows=eligible.filter(x=>x.rk);return `<div class="pfilters">${dRecentCheckbox(a)}<small class="muted">랭커 비교 가능 ${rows.length}/${eligible.length}명</small></div><div class="ranker-note"><b>현재 제공 가능한 랭커 비교</b><p>넥슨 Open API의 TOP 10,000 랭커가 <b>같은 선수·같은 포지션</b>으로 뛴 20경기 평균과 내 기록만 비교합니다. 비슷한 예산의 유저·전체 스쿼드·세부 전술은 현재 데이터로 확인할 수 없어 임의 생성하지 않아요.</p></div>${rows.length?`<div class="tablewrap"><table><thead><tr><th>선수</th><th>포지션</th><th class="n">내 평점</th><th>낮은 지표</th><th>참고 방향</th></tr></thead><tbody>${rows.map(x=>{const low=x.rkLow?Object.values(x.rkLow):[];return `<tr class="${low.length?'low':''}"><td>${sch(x.seasonId)}${esc(x.name)} ${Number(x.grade)>0?gch(x.grade):''}</td><td>${x.pos}</td><td class="n">${x.avg.toFixed(2)}</td><td>${low.length?low.map(v=>`${v.lb} ${dRankerValue(v,v.mine)} / 랭커 ${dRankerValue(v,v.avg)}`).join('<br>'):'뚜렷한 열세 없음'}</td><td>${low.length?'선수별 기록의 교체 후보 참고':'현재 기용 유지 검토'}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty">현재 선택한 선수 중 같은 카드·포지션의 랭커 비교 표본이 없어요.</p>'}`
}
function dRenderTabs(){const list=DTABS[dMode];if(!list.some(t=>t[0]===dTab))dTab=list[0][0];$('dTabs').innerHTML=list.map(([k,l])=>`<button role="tab" data-tab="${k}" aria-selected="${k===dTab}">${l}</button>`).join('')}
function dRenderPanel(){$('dPanel').innerHTML={stats:dStatsView,pstats:dPStatsView,time:timeChart,shot:shotMap,player:dPlayerTable,growth:dGrowthView,ranker:dRankerView,form:dFormView,line:dLineView}[dTab](dCur.a);$('dTabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===dTab))}
function dRenderMatches(d,a){
  $('dAllN').textContent=`${d.matches.length}경기`;
  const md=s=>{const t=new Date(s);return `${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`};
  $('dMatches').innerHTML=`<div class="tablewrap"><table class="mtab"><thead><tr><th>날짜</th><th>결과</th><th class="n">스코어</th><th>상대</th>${a.dm?'<th>상대 포메이션</th>':''}<th class="n">점유</th><th class="n">슈팅(유효)</th><th class="n">패스</th><th class="n">태클</th></tr></thead><tbody>${d.matches.map(m=>{const [x,y]=m.matchInfo;
    return `<tr><td class="why">${md(m.matchDate)}</td><td><span class="res ${RCLS[x.matchDetail.matchResult]}">${x.matchDetail.matchResult}</span></td><td class="n"><b>${x.shoot.goalTotal}:${y.shoot.goalTotal}</b></td><td>${esc(y.nickname)}</td>${a.dm?`<td>${esc(formationOf(y.player))}</td>`:''}<td class="n">${x.matchDetail.possession}%</td><td class="n">${x.shoot.shootTotal}(${x.shoot.effectiveShootTotal}) <span class="why">${y.shoot.shootTotal}(${y.shoot.effectiveShootTotal})</span></td><td class="n">${x.pass.passTry?Math.round(x.pass.passSuccess/x.pass.passTry*100):0}%</td><td class="n">${x.defence.tackleSuccess}/${x.defence.tackleTry}</td></tr>`}).join('')}</tbody></table></div><p class="note">슈팅 옆 회색 숫자는 상대 기록이에요.</p>`;
}

/* 실서비스: window.FG_LIVE=true 이면 '/api' 중계로 넥슨 Open API 실데이터를 씀 */
const LIVE=!!window.FG_LIVE, API=window.FG_API||'/api';
let DIAG_SIGNAL=null;   // 진단 버튼을 다시 누르면 이전 요청을 취소
async function fetchJSON(path,signal){
  signal=signal||DIAG_SIGNAL||undefined;
  for(let i=0;i<4;i++){
    const r=await fetch(API+path,{signal});
    if(r.status===429){await new Promise(s=>setTimeout(s,800*(i+1)));continue}
    if(!r.ok){let b=null;try{b=await r.json()}catch(e){}
      throw {code:'http_'+r.status,api:!!(b&&b.code),message:b&&b.code&&b.message?b.message:r.status===400?'요청 값을 확인해 주세요.':'넥슨 API 응답 오류('+r.status+')예요. 잠시 후 다시 시도해 주세요.'}}
    return r.json();
  }
  throw {code:'rate',message:'요청이 많아 잠시 막혔어요. 1분 뒤 다시 시도해 주세요.'};
}
let spidMap=null, seasonsLoaded=false, seasonsPromise=null;
/* 카드·시즌 목록: 매일 수집 때 저장한 정적 사본(data/meta)을 먼저 읽어 Functions 요청을 아낌 */
async function metaJSON(name){
  try{const r=await fetch((window.FG_DATA||'/data')+'/meta/'+name+'.json');if(r.ok)return await r.json()}catch(e){}
  return fetchJSON('/static/fconline/meta/'+name+'.json');
}
async function names(ids){
  if(!spidMap)spidMap=metaJSON('spid').then(a=>Object.fromEntries(a.map(x=>[x.id,x.name])));
  const m=await spidMap;return Object.fromEntries(ids.map(id=>[id,m[id]]));
}
let diagSeq=0;
async function runDiag(nick){
  nick=(nick||'').trim();if(!nick)return;
  const seq=++diagSeq;recoClose();$('dTip').hidden=true;
  let d;
  if(LIVE){
    try{runDiag.ctrl&&runDiag.ctrl.abort()}catch(e){}
    runDiag.ctrl=typeof AbortController==='function'?new AbortController():null;DIAG_SIGNAL=runDiag.ctrl&&runDiag.ctrl.signal;
    $('dBoard').innerHTML=`<div><div class="nick">${esc(nick)}</div><div class="meta">최근 ${dCount}경기를 불러오는 중이에요. 100경기는 30초 정도 걸릴 수 있어요.</div></div>`;
    try{await loadSeasons();d=await realData(nick,dMode,dCount,fetchJSON,names,4)}
    catch(err){if(seq!==diagSeq||(err&&err.name==='AbortError'))return;$('dBoard').innerHTML=`<div><div class="nick">${esc(nick)}</div><div class="meta" style="color:var(--crit)">${esc(err&&err.message||'불러오지 못했어요. 잠시 후 다시 시도해 주세요.')}</div></div>`;dClear();return}
    if(seq!==diagSeq)return;
    if(d.matches.length<5){$('dBoard').innerHTML=`<div><div class="nick">${esc(nick)}</div><div class="meta">${dMode==='52'?'감독모드':'공식경기'} 경기가 ${d.matches.length}경기뿐이라 진단하기에 부족해요. 5경기 이상부터 진단해요.</div></div>`;dClear();return}
  }else{
    const snap=window.FG_SNAP&&FG_SNAP[nick.toLowerCase()+'|'+dMode];
    if(snap){d={...snap,matches:snap.matches.slice(0,dCount)};if(d.matches.length<5){$('dBoard').innerHTML=`<div><div class="nick">${esc(snap.basic.nickname)}</div><div class="meta">${dMode==='52'?'감독모드':'공식경기'} 최근 경기가 ${d.matches.length}경기뿐이라 진단하기에 부족해요. ${dMode==='50'?'감독모드 탭을 눌러보세요.':''}</div></div>`;dClear();return}}
    else if(nick==='예시'){d=makeData('예시 구단주',dMode,dCount);d.sample=true}
    else{$('dBoard').innerHTML=`<div><div class="nick">${esc(nick)}</div><div class="meta">미리보기 화면은 넥슨 서버에 직접 접속할 수 없어서 실시간 조회가 안 돼요. 배포한 사이트에서는 닉네임만 넣으면 바로 불러와요.${window.FG_SNAP?' 미리 불러온 구단주: '+[...new Set(Object.keys(FG_SNAP).map(k=>FG_SNAP[k].basic.nickname))].map(esc).join(', '):''}</div><button type="button" class="ghost" data-sample style="margin-top:8px;padding:6px 12px;font-size:13px">화면 구성만 예시 경기로 보기</button></div>`;dClear();return}
  }
  const a=analyze(d,dMode);dCur={d,a};
  dTab='pstats';   // 공식경기·감독모드 모두 선수별 기록이 메인
  // Both modes share the fixed report → details → opponent teamcolor → weaknesses order.
  dSaveVisit(d,a);dRenderBoard(d,a);dRenderSummary(d,a);dRenderReport(d,a);dRenderTip(a);dRenderCards(a);dRenderTabs();dRenderPanel();dRenderMatches(d,a);
  $('dUpdated').textContent=`마지막 조회 ${new Date().toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
  dLoadTeamcolors(d,a,seq);
  Promise.allSettled([dLoadRanker(a,dMode,seq),dLoadRating(a,dMode,seq)]).then(()=>{if(seq===diagSeq)dEnrich(a,seq)});
}
function dClear(){['dCards','dPanel','dMatches','dSum','dReport','dReportHead'].forEach(id=>$(id).innerHTML='');$('dTip').hidden=true;$('dReportShell').hidden=true;$('dTc').hidden=true;$('dAllN').textContent=''}
$('dForm').addEventListener('submit',e=>{e.preventDefault();runDiag($('dNick').value)});
$('dBoard').addEventListener('click',e=>{const fav=e.target.closest('[data-dfavorite-toggle]');if(fav){dChangeFavorite(fav.dataset.dfavoriteToggle);return}if(e.target.closest('[data-sample]')){$('dNick').value='예시';runDiag('예시')}});
$('dCount').addEventListener('click',e=>{const b=e.target.closest('[data-n]');if(!b)return;dCount=+b.dataset.n;$('dCount').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));runDiag($('dNick').value)});
$('dMode').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(!b)return;dMode=b.dataset.mode;$('dMode').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));runDiag($('dNick').value)});
$('dTabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;dTab=b.dataset.tab;dRenderPanel()});
$('dQuick').addEventListener('click',e=>{const remove=e.target.closest('[data-dfavorite-remove]');if(remove){dChangeFavorite(remove.dataset.dfavoriteRemove,true);return}const b=e.target.closest('[data-dnick]');if(b){$('dNick').value=b.dataset.dnick;runDiag(b.dataset.dnick)}});
$('dFav').addEventListener('click',()=>{if(dCur)dChangeFavorite(dCur.d.basic.nickname)});
$('dMine').addEventListener('click',()=>{if(!dCur)return;dStore(s=>s.mine=dCur.d.basic.nickname);dRenderQuick(dCur.d.basic.nickname)});
$('dShare').addEventListener('click',async()=>{if(!dCur)return;const u=new URL((window.FG_ROUTES&&FG_ROUTES.diag)||'/diag',window.FG_SITE_URL||location.origin);u.searchParams.set('nick',dCur.d.basic.nickname);u.searchParams.set('mode',dMode);u.searchParams.set('count',dCount);const data={title:`${dCur.d.basic.nickname} 전적 진단 | 피파고수`,text:`${dCur.d.basic.nickname} 최근 ${dCur.a.n}경기 승률 ${Math.round(dCur.a.W/dCur.a.n*100)}%`,url:u.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(u.href);$('dShare').textContent='링크 복사됨 ✓';setTimeout(()=>$('dShare').textContent='진단 공유',1600)}}catch(e){}});
$('dPanel').addEventListener('change',e=>{const f=e.target.dataset.dfilter;if(f){dFilter[f]=f==='recent'?e.target.checked:f==='apps'?+e.target.value:e.target.value;dRenderPanel();return}if(!dCur)return;const s=dRead(),key=dHistoryKey(dCur.d.basic.nickname,dMode);if(e.target.dataset.goal){s.goals=s.goals||{};const o=s.goals[key]??={};o[e.target.dataset.goal]=e.target.value;dWrite(s)}});

/* 공유 링크: 개인 BP·구매가는 URL에 넣지 않아요. */
let dQueryStarted=false;
if(LIVE){const q=new URLSearchParams(location.search),nick=q.get('nick');if(nick){dQueryStarted=true;const mode=q.get('mode'),count=+q.get('count');if(['50','52'].includes(mode))dMode=mode;if([30,50,100].includes(count))dCount=count;$('dNick').value=nick;$('dMode').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.mode===dMode));$('dCount').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.n===dCount));runDiag(nick)}}


/* ================= 리뉴얼: 공식 시즌 배지 · 전체 카드 검색 (넥슨 Open API만 사용) ================= */
/* 시즌 배지: seasonid.json 의 공식 seasonImg 를 그대로 표시, 이미지를 못 불러오면 시즌 이름 배지로 대체 */
function seasonImg(id){const s=SEASONS[id];if(!s)return '';return s[3]||(s[2]?SEASON_IMG(id):'')}
const sch=id=>{const n=sname(id),fam=(SEASONS[id]||['','special'])[1],u=seasonImg(id),t=`<span class="ssn ssn-${fam}" title="${esc(n)}"${u?' hidden':''}>${esc(n)}</span>`;return u?`<img class="ssnimg" src="${esc(u)}" alt="${esc(n)}" title="${esc(n)}" loading="lazy" onerror="this.nextElementSibling.hidden=false;this.remove()">${t}`:t};
async function loadSeasons(){
  if(seasonsLoaded)return;
  if(!seasonsPromise)seasonsPromise=metaJSON('seasonid').then(list=>{
    list.forEach(s=>{const short=String(s.className||s.seasonId).split(' (')[0],cur=SEASONS[s.seasonId];SEASONS[s.seasonId]=[short,SEASON_FAM(short),cur?cur[2]:'',s.seasonImg||'']});
    seasonsLoaded=true;hydrateSeasonBadges();
  }).catch(e=>{seasonsPromise=null;throw e});
  return seasonsPromise;
}
/* 선수 이미지: 넥슨 Open API 이미지 정보(액션 이미지 → 기본 이미지 → 실루엣) */
const IMG_BASE='https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/';
const pimg=(id,cls)=>`<div class="pimgw ${cls||''}"><img loading="lazy" alt="" src="${IMG_BASE}playersAction/p${id}.png" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${IMG_BASE}players/p${id%1000000}.png'}else{this.remove()}"></div>`;
/* 데이터센터 상세 페이지(datacenter.js 의 GetPlayerDetail 과 같은 주소) */
const DC_URL=(id,g)=>`https://fconline.nexon.com/DataCenter/PlayerInfo?spid=${id}&n1Strong=${g||1}`;

/* ---------- 수집 데이터(data/): 인덱스 + spid%200 샤드 ---------- */
const DATA_BASE=window.FG_DATA||'/data', SHARDS=200;
let IDX=null, idxP=null; const shardP={};
function previewIdx(){const P=window.FG_PREVIEW_DATA;if(!P)return null;const det=new Set(P.detail.map(d=>d.spid));const c={};P.list.forEach(r=>c[r.spid]=[r.ovr??(r.pos[0]||[])[1],(r.pos[0]||[])[0],r.pay,r.price[0],r.games,det.has(r.spid)?1:0]);return {updated:P.updated,c}}
function loadIdx(){if(!idxP)idxP=(LIVE?fetch(DATA_BASE+'/index.json').then(r=>r.ok?r.json():null).catch(()=>null):Promise.resolve(previewIdx())).then(j=>(IDX=j));return idxP}
function shard(kind,n){const k=kind+n;if(!shardP[k])shardP[k]=LIVE?fetch(`${DATA_BASE}/${kind}/${n}.json`).then(r=>r.ok?r.json():{}).catch(()=>({})):Promise.resolve(Object.fromEntries(((window.FG_PREVIEW_DATA||{})[kind]||[]).map(x=>[x.spid,x])));return shardP[k]}
async function cardData(id){const n=id%SHARDS;const [l,d]=await Promise.all([shard('list',n),shard('detail',n)]);return {l:l[id],d:d[id]}}
const ix=id=>IDX&&IDX.c&&IDX.c[id];
/* BP 표기: 데이터센터처럼 큰 단위 2개 (예: 1억 6,500만, 2만 9,600) */
function fmtBP(n){if(!n)return '-';const jo=Math.floor(n/1e12),eok=Math.floor(n%1e12/1e8),man=Math.floor(n%1e8/1e4),rest=n%1e4;const p=[];if(jo)p.push(jo.toLocaleString()+'조');if(eok)p.push(eok.toLocaleString()+'억');if(man)p.push(man.toLocaleString()+'만');if(rest&&!jo&&!eok)p.push(rest.toLocaleString());return p.slice(0,2).join(' ')||'-'}
const statCls=v=>v>=130?'s130':v>=120?'s120':v>=110?'s110':v>=100?'s100':v>=90?'s90':v>=80?'s80':'slow';
const STAT_LABELS=[['sprintspeed','속력'],['acceleration','가속력'],['finishing','골 결정력'],['shotpower','슛 파워'],['longshots','중거리 슛'],['positioning','위치 선정'],['volleys','발리슛'],['penalties','페널티 킥'],['shortpassing','짧은 패스'],['vision','시야'],['crossing','크로스'],['longpassing','긴 패스'],['freekick','프리킥'],['curve','커브'],['dribbling','드리블'],['ballcontrol','볼 컨트롤'],['agility','민첩성'],['balance','밸런스'],['reactions','반응 속도'],['marking','대인 수비'],['standingtackle','태클'],['interceptions','가로채기'],['heading','헤더'],['slidingtackle','슬라이딩 태클'],['strength','몸싸움'],['stamina','스태미너'],['aggression','적극성'],['jumping','점프'],['composure','침착성'],['gkdiving','GK 다이빙'],['gkhandling','GK 핸들링'],['gkkicking','GK 킥'],['gkreflexes','GK 반응속도'],['gkpositioning','GK 위치 선정']];

let CARDS=[], cardsReady=false, cLimit=60;
const norm=t=>String(t).toLowerCase().replace(/[\s·.\-]/g,'');
function buildCards(arr){CARDS=arr.map(([id,name])=>({id,name,sid:Math.floor(id/1e6),pid:id%1e6,key:norm(name)}))}
async function initCards(){
  $('cCount').textContent='카드 목록을 불러오는 중이에요…';
  loadIdx().then(()=>{if(cardsReady){updateMeta();renderCards()}});
  try{
    if(LIVE){
      await loadSeasons();
      const a=await metaJSON('spid');
      buildCards(a.map(x=>[x.id,x.name]));
      spidMap=Promise.resolve(Object.fromEntries(a.map(x=>[x.id,x.name])));
    }else buildCards(FG_PREVIEW_CARDS);
  }catch(e){$('cCount').textContent='카드 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';return}
  const cnt={};CARDS.forEach(c=>cnt[c.sid]=(cnt[c.sid]||0)+1);
  const sids=Object.keys(cnt).map(Number).sort((a,b)=>sname(a).localeCompare(sname(b),'ko'));
  $('cSeason').innerHTML='<option value="">전체 시즌</option>'+sids.map(s=>`<option value="${s}">${esc(sname(s))} (${cnt[s]})</option>`).join('');
  cardsReady=true;updateMeta();renderCards();
  if(location.pathname.replace(/\/$/,"")==="/cards"){const id=Number(new URLSearchParams(location.search).get("card"));if(Number.isSafeInteger(id)&&id>0&&CARDS.some(c=>c.id===id))openCard(id)}
}
function updateMeta(){
  const n=IDX&&IDX.c?Object.keys(IDX.c).length:0;
  const when=IDX&&IDX.updated?new Date(IDX.updated):null;
  const ws=when?`${when.getMonth()+1}/${when.getDate()} ${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')}`:'';
  $('cMeta').textContent=(LIVE?`전체 ${CARDS.length.toLocaleString()}장`:`미리보기 ${CARDS.length}장`)+(n?` · 능력치·시세 ${n.toLocaleString()}장${ws?' ('+ws+' 갱신)':''}`:'');
}
function searchCards(){
  const q=$('cq').value.trim(), sid=+$('cSeason').value||0, sort=$('cSort').value;
  const toks=q.split(/\s+/).filter(Boolean).map(norm), whole=norm(q), first=toks[0]||'';
  let r=CARDS.filter(c=>{
    if(sid&&c.sid!==sid)return false;
    if(!toks.length)return true;
    const sn=norm(sname(c.sid));
    if(sn===whole)return true;
    return toks.every(t=>c.key.includes(t)||sn.includes(t));
  });
  if($('cTrade').checked)r=r.filter(c=>{const x=ix(c.id);return x&&x[3]>0});
  const ov=c=>(ix(c.id)||[])[0]||0, pr=c=>(ix(c.id)||[])[3]||0;
  const st=c=>first&&c.key.startsWith(first)?1:0;
  if(sort==='ovr')return r.sort((a,b)=>ov(b)-ov(a)||b.sid-a.sid);
  if(sort==='pdesc')return r.sort((a,b)=>pr(b)-pr(a));
  if(sort==='pasc')return r.sort((a,b)=>(pr(a)||Infinity)-(pr(b)||Infinity));
  return r.sort((a,b)=>(st(b)-st(a))||(ov(b)-ov(a))||(b.sid-a.sid)||a.name.localeCompare(b.name,'ko'));
}
function cardHTML(c){
  const x=ix(c.id);
  const meta=x?`<div class="cm"><b class="${statCls(x[0]||0)}">${x[0]??'-'}</b> ${esc(x[1]||'')} · 급여 ${x[2]??'-'}</div><div class="cp">${x[3]>0?fmtBP(x[3]):'거래 불가'}</div>`:'';
  return `<button type="button" class="ccard" data-sp="${c.id}">${pimg(c.id)}<div class="nm">${sch(c.sid)}${esc(c.name)}</div>${meta}</button>`;
}
function renderCards(){
  if(!cardsReady)return;
  const r=searchCards();
  $('cCount').textContent=r.length?`${r.length.toLocaleString()}장 찾았어요`:'검색 결과가 없어요. 이름 일부만 넣어 보세요(예: 손흥민 → 흥민).';
  $('cRes').innerHTML=r.slice(0,cLimit).map(cardHTML).join('');
  $('cMore').hidden=r.length<=cLimit;
}
let cT;$('cq').addEventListener('input',()=>{clearTimeout(cT);cT=setTimeout(()=>{cLimit=60;renderCards()},150)});
['cSeason','cSort','cTrade'].forEach(id=>$(id).addEventListener('change',()=>{cLimit=60;renderCards()}));
$('cMore').addEventListener('click',()=>{cLimit+=60;renderCards()});
$('cRes').addEventListener('click',e=>{const b=e.target.closest('[data-sp]');if(b)openCard(+b.dataset.sp)});

/* ---------- 카드 상세 (FC온라인·데이터센터 스타일) ---------- */
const CDN='https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/';
const hideBad=`onerror="this.style.display='none'"`;
const traitIcon=n=>`${CDN}traits/trait_icon_${String(n).padStart(2,'0')}.png`;
const flagImg=n=>n?`<img class="fo" src="${CDN}countries/smallflags/${n}.png" alt="" ${hideBad}>`:'';
const leagueImg=n=>n?`<img class="fo" src="${CDN}league/dark/ca/d${n}.png" alt="" ${hideBad}>`:'';
const crestImg=n=>n?`<img class="fo" src="${CDN}crests/dark/small/d${n}.png" alt="" ${hideBad}>`:'';
const bigImg=id=>`<img src="${CDN}playersActionHigh/p${id}.png" alt="" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${CDN}playersAction/p${id}.png'}else if(this.dataset.f==1){this.dataset.f=2;this.src='${CDN}players/p${id%1000000}.png'}else{this.remove()}">`;
/* 신규 특성: 데이터센터 특성 목록에서 '예리한 감아차기' 앞에 따로 묶인 특성들 (수집기가 data/traits.json 으로 갱신) */
let NEW_TRAITS=new Set(['크로스 포쳐','아크로바틱 피니셔','타이탄','트릭스터','레이저 슈터','프레데터','GK 데드아이','커맨더','스피드스터','파이터','라인 브레이커','블로커','와일드 태클러','2개의 심장','체이서','GK 빠른 반응','GK 공중볼 장악']);
if(LIVE)fetch(DATA_BASE+'/traits.json').then(r=>r.ok?r.json():null).then(j=>{if(j&&j.new&&j.new.length)NEW_TRAITS=new Set(j.new)}).catch(()=>{});
const bigBadge=sid=>{const u=seasonImg(sid),n=sname(sid);return u?`<img class="sbig" src="${esc(u)}" alt="${esc(n)}" title="${esc(n)}" onerror="this.nextElementSibling.hidden=false;this.remove()"><span class="ssn ssn-${(SEASONS[sid]||['','special'])[1]}" hidden>${esc(n)}</span>`:sch(sid)};
const fcCls=v=>v>=130?'v130':v>=120?'v120':v>=110?'v110':v>=100?'v100':v>=90?'v90':v>=80?'v80':v>=70?'v70':'vlow';
let pmCard=null, pmGrade=1, pmAdaptation=5, pmData=null, pmTabL='feat', pmTabR='stat', pmTcName='', pmTcCount=0, pmGradeTcName='', pmGradeTcCount=0, pmRelName='';
let pmRelationList=null, pmRelationLoading=false, pmRelationFailed=false;
const PLAYER_RELATIONS=new Map();
let TEAMCOLORS=[],TEAMCOLORS_P=null;
let TC_TIER_RULES={club:{members:[3,6,8,11]},nation:{members:[3,6,8,11]},grade:{members:[5,8]}};
let GRADE_WAVE_RULES={conditions:[
  {name:'동빛 물결',minGrade:3,members:{'5':1,'8':null}},
  {name:'은빛 물결',minGrade:5,members:{'5':1,'8':3}},
  {name:'금빛 물결',minGrade:8,members:{'5':3,'8':4}},
  {name:'백금빛 물결',minGrade:11,members:{'5':4,'8':5}}
]};
let ADAPTATION_BONUS=[null,0,1,2,3,4];   // 수집 능력치 = 적응도 1단계(데이터센터 기본), 단계당 +1 (2026-11-21 실측)
function loadTeamcolors(){
  if(TEAMCOLORS.length)return Promise.resolve(TEAMCOLORS);if(!LIVE)return Promise.resolve(null);
  if(!TEAMCOLORS_P)TEAMCOLORS_P=fetch(`${DATA_BASE}/teamcolor/teamcolors.json`).then(r=>{if(!r.ok)throw new Error('teamcolors unavailable');return r.json()}).then(j=>{const list=Array.isArray(j)?j:(j&&(j.items||j.teamcolors)||[]);if(!list.length)throw new Error('empty teamcolors');TEAMCOLORS=list;if(pmCard)renderCard();return TEAMCOLORS}).catch(e=>{TEAMCOLORS_P=null;throw e});
  return TEAMCOLORS_P
}
if(LIVE){
  loadTeamcolors().catch(()=>{});
  fetch(`${DATA_BASE}/rules/teamcolor_tiers.json`).then(r=>r.ok?r.json():null).then(j=>{if(j)TC_TIER_RULES=j;if(pmCard)renderCard()}).catch(()=>{});
  fetch(`${DATA_BASE}/rules/grade_teamcolor.json`).then(r=>r.ok?r.json():null).then(j=>{if(j)GRADE_WAVE_RULES=j;if(pmCard)renderCard()}).catch(()=>{});
  fetch(`${DATA_BASE}/rules/adaptation_bonus.json`).then(r=>r.ok?r.json():null).then(j=>{if(j&&Array.isArray(j.bonusFromBase))ADAPTATION_BONUS=j.bonusFromBase;if(pmCard)renderCard()}).catch(()=>{});
}
const TC_TYPE=x=>String(x.type||x.kind||x.category||'').toLowerCase();
const TC_KEYS=Object.fromEntries(STAT_LABELS.map(([k,l])=>[norm(l),k]));
function tcStats(tc){return tc&&(tc.effects||tc.tiers||[])}
function tcEligible(tc){const t=TC_TYPE(tc);return /club|nation|국가|클럽|소속/.test(t)&&!/grade|enhance|강화/.test(t)}
function tcGradeEligible(tc){return /grade|enhance|강화/.test(TC_TYPE(tc))}
function tcMembersFor(tc,level){
  const type=TC_TYPE(tc),group=/grade|enhance|강화/.test(type)?'grade':/nation|국가/.test(type)?'nation':'club';
  const configured=TC_TIER_RULES[group]&&(TC_TIER_RULES[group].members||TC_TIER_RULES[group].counts);
  if(Array.isArray(configured)&&configured[level-1])return +configured[level-1];
  return null;
}
function gradeWaveRule(tc){return (GRADE_WAVE_RULES.conditions||[]).find(x=>norm(x.name)===norm(tc&&tc.name))||null}
function gradeWaveMeets(tc){const rule=gradeWaveRule(tc);return !rule||pmGrade>=+(rule.minGrade||0)}
function tcBonusFor(tc,count,applyGradeGate=false){
  if(!tc||count<1||(applyGradeGate&&!gradeWaveMeets(tc)))return {};
  const effects=tcStats(tc), levels=[...new Set(effects.map(x=>+(x.level||x.tier||x.step)).filter(Boolean))].sort((a,b)=>a-b);
  let chosen=null;
  for(const level of levels){const need=tcMembersFor(tc,level);if(need&&count>=need)chosen=effects.find(x=>+(x.level||x.tier||x.step)===level)}
  if(!chosen)return {};
  const stats=chosen.stats||chosen.bonuses||chosen.effect||{};
  if(Array.isArray(stats))return Object.fromEntries(stats.map(x=>[x.key||x.stat||TC_KEYS[norm(x.name||'')]||'',+(x.bonus||x.value||0)]).filter(([k,v])=>k&&v));
  return stats;
}
// 팀컬러는 데이터센터에 표시된 최고 단계 효과를 그대로 적용해요(인원 입력 없음).
function tcMaxEffect(tc){
  const effects=tcStats(tc)||[];let best=null;
  effects.forEach(x=>{const l=+(x.level||x.tier||x.step)||0;if(!best||l>(+(best.level||best.tier||best.step)||0))best=x});
  return best;
}
function tcMaxBonus(tc,applyGradeGate=false){
  if(!tc||(applyGradeGate&&!gradeWaveMeets(tc)))return {};
  const chosen=tcMaxEffect(tc);if(!chosen)return {};
  const stats=chosen.stats||chosen.bonuses||chosen.effect||{};
  if(Array.isArray(stats))return Object.fromEntries(stats.map(x=>[x.key||x.stat||TC_KEYS[norm(x.name||'')]||'',+(x.bonus||x.value||0)]).filter(([k,v])=>k&&v));
  return stats;
}
async function loadPlayerRelations(spid){
  const key=String(spid);
  if(!PLAYER_RELATIONS.has(key)){
    const pending=fetch(`/api/player-teamcolors?spid=${encodeURIComponent(key)}`).then(async r=>{
      if(!r.ok)throw new Error('Official relation teamcolors unavailable');
      const data=await r.json();
      if(!Array.isArray(data.items))throw new Error('Invalid relation teamcolor response');
      return data.items;
    });
    PLAYER_RELATIONS.set(key,pending);
    pending.catch(()=>PLAYER_RELATIONS.delete(key));
  }
  return PLAYER_RELATIONS.get(key);
}
/* 선수별 관계 팀컬러: 넥슨 선수 상세 화면의 관계 팀컬러 명단만 사용 */
function relOptionsFor(){
  if(!Array.isArray(pmRelationList))return [];
  return pmRelationList.map(item=>{
    const meta=TEAMCOLORS.find(tc=>String(tc.id||'')===String(item.id))||TEAMCOLORS.find(tc=>norm(tc.name)===norm(item.name));
    return meta?{...meta,id:item.id,name:item.name,type:'relation'}:{id:item.id,name:item.name,type:'relation',effects:[]};
  }).filter(x=>x.name);
}
/* 전 포지션 OVR: 세부 능력치 가중 평균(FIFA 계열 포지션 공식) + 선호 포지션 실제값으로 보정 */
const POS_W={
  ST:{finishing:18,positioning:13,heading:10,shotpower:10,reactions:8,dribbling:7,ballcontrol:10,volleys:2,longshots:3,acceleration:4,sprintspeed:5,strength:5},
  CF:{finishing:11,positioning:13,heading:2,shotpower:5,reactions:9,dribbling:14,ballcontrol:15,longshots:4,shortpassing:9,vision:8,acceleration:5,sprintspeed:5},
  LW:{crossing:9,dribbling:16,ballcontrol:14,shortpassing:9,finishing:10,positioning:9,reactions:7,vision:6,longshots:4,acceleration:7,sprintspeed:6,agility:3},
  LM:{crossing:10,dribbling:15,ballcontrol:13,shortpassing:11,longpassing:5,vision:7,reactions:7,positioning:8,finishing:6,acceleration:7,sprintspeed:6,stamina:5},
  CAM:{shortpassing:16,vision:14,ballcontrol:15,dribbling:13,positioning:9,reactions:7,finishing:7,longshots:5,shotpower:5,agility:3,acceleration:4},
  CM:{shortpassing:17,longpassing:13,vision:13,ballcontrol:14,dribbling:7,reactions:8,interceptions:5,positioning:6,standingtackle:5,longshots:4,stamina:6},
  CDM:{shortpassing:14,longpassing:10,interceptions:14,marking:9,standingtackle:12,slidingtackle:5,ballcontrol:10,reactions:7,vision:4,strength:6,aggression:5,stamina:6},
  LWB:{crossing:12,dribbling:4,ballcontrol:8,shortpassing:10,interceptions:12,marking:8,standingtackle:11,slidingtackle:14,reactions:8,stamina:10,sprintspeed:6},
  LB:{crossing:9,ballcontrol:7,shortpassing:7,interceptions:12,marking:8,heading:4,standingtackle:11,slidingtackle:14,reactions:8,stamina:8,sprintspeed:7,acceleration:5},
  CB:{marking:14,standingtackle:17,slidingtackle:13,interceptions:13,heading:10,strength:10,reactions:5,aggression:7,shortpassing:5,ballcontrol:4,jumping:3},
  SW:{marking:12,standingtackle:15,slidingtackle:11,interceptions:14,heading:8,strength:8,reactions:7,aggression:5,shortpassing:8,longpassing:6,ballcontrol:6},
  GK:{gkdiving:21,gkhandling:21,gkkicking:5,gkreflexes:21,gkpositioning:21,reactions:11}};
const POS_ALIAS={RW:'LW',RM:'LM',RWB:'LWB',RB:'LB'};
const PITCH=[['GK',7,50,'gk'],['LB',19,27,'def'],['SW',19,50,'def'],['RB',19,73,'def'],['LWB',31,15,'def'],['CB',31,50,'def'],['RWB',31,85,'def'],
  ['CDM',43,50,'mid'],['LM',55,29,'mid'],['CM',55,50,'mid'],['RM',55,71,'mid'],['CAM',67,50,'mid'],['LW',80,15,'att'],['CF',80,50,'att'],['RW',80,85,'att'],['ST',92,50,'att']];
function posRaw(stats,p){const w=POS_W[POS_ALIAS[p]||p];let t=0,s2=0;for(const k in w){if(stats[k]!=null){t+=w[k]*stats[k];s2+=w[k]}}return s2?t/s2:0}
function allPosOvr(D,add){
  const st=D.stats||{},known=Object.fromEntries((D.pos||[]).map(p=>[p[0],+p[1]]));
  const offs=Object.keys(known).filter(p=>POS_W[POS_ALIAS[p]||p]).map(p=>known[p]-posRaw(st,p));
  const off=offs.length?offs.reduce((a,b)=>a+b,0)/offs.length:0;
  return PITCH.map(([p,x,y,g])=>({p,x,y,g,v:Math.round(known[p]!=null?known[p]:posRaw(st,p)+off)+add,real:known[p]!=null}));
}
function tcValue(stats,key,label){
  if(!stats)return 0;
  const specific=+(stats[key]??stats[label]??stats[norm(label)]??0);
  const all=+(stats.all??stats.allStats??stats.all_stats??stats.allStat??0);
  const n=label==='전체 능력치'?all:all+specific;
  return Number.isFinite(n)?n:0;
}
function tcOptionsFor(D){
  if(!D||!TEAMCOLORS.length)return [];
  // 데이터센터 국가 표기는 "대한민국, 국가대표"처럼 붙어 나와서 쉼표 앞만 써요.
  const nation=String(D.nation||'').split(',')[0].trim();
  const clubs=(D.clubs||[]).map(x=>x[1]).filter(Boolean), names=[...clubs,nation].filter(Boolean).map(norm);
  const opts=TEAMCOLORS.filter(tc=>{
    if(!tcEligible(tc))return false;
    if(tc.nationId&&D.nationId&&+tc.nationId===+D.nationId)return true;
    if(tc.clubId&&D.teamId&&+tc.clubId===+D.teamId)return true;
    const known=[tc.name,...(tc.aliases||[])].filter(Boolean).map(norm);
    return names.some(n=>known.includes(n));
  });
  const seen=new Set();return opts.filter(x=>!seen.has(x.name)&&seen.add(x.name));
}
function tcLevelFor(tc,count){
  const effects=tcStats(tc)||[];let level=0;
  effects.forEach(x=>{const l=+(x.level||x.tier||x.step),need=tcMembersFor(tc,l);if(l&&need&&count>=need)level=Math.max(level,l)});
  return level;
}
function openCard(id){
  const c=CARDS.find(x=>x.id===id)||{id,name:'',sid:Math.floor(id/1e6),pid:id%1e6};
  pmCard=c;pmGrade=1;pmAdaptation=5;pmData=null;pmTabL='feat';pmTabR='stat';pmTcName='';pmTcCount=0;pmGradeTcName='';pmGradeTcCount=0;pmRelName='';
  pmRelationList=null;pmRelationLoading=LIVE;pmRelationFailed=!LIVE;
  renderCard();
  $('pmodal').hidden=false;document.body.style.overflow='hidden';
  cardData(id).then(d=>{if(pmCard&&pmCard.id===id){pmData=d;renderCard()}});
  if(LIVE)loadPlayerRelations(id).then(items=>{if(pmCard&&pmCard.id===id){pmRelationList=items;pmRelationLoading=false;pmRelationFailed=false;renderCard()}}).catch(()=>{if(pmCard&&pmCard.id===id){pmRelationList=[];pmRelationLoading=false;pmRelationFailed=true;renderCard()}});
}
function renderCard(){
  const c=pmCard, g=pmGrade, b=GRADE_BONUS[g]||0, d=pmData, L=d&&d.l, D=d&&d.d;
  const name=c.name||(D&&D.name)||(L&&L.name)||'';
  const pos=(D&&D.pos&&D.pos.length?D.pos:L&&L.pos)||[], pay=(D&&D.pay)||(L&&L.pay), foot=(D&&D.foot)||(L&&L.foot);
  const tcOptions=tcOptionsFor(D), tc=tcOptions.find(x=>x.name===pmTcName)||null;
  if(tc&&!pmTcName)pmTcName=tc.name;
  const WAVE_ORDER=['동빛 물결','은빛 물결','금빛 물결','백금빛 물결'], waveRank=x=>{const i=WAVE_ORDER.indexOf(String(x.name||'').trim());return i<0?99:i};
  const gradeTcOptions=TEAMCOLORS.filter(tcGradeEligible).sort((a,b)=>waveRank(a)-waveRank(b)), gradeTc=gradeTcOptions.find(x=>x.name===pmGradeTcName)||null;
  const tcLevel=tc?(+((tcMaxEffect(tc)||{}).level)||tc.maxLevel||0):0, tcBonuses=tcMaxBonus(tc);
  const gradeTcRule=gradeWaveRule(gradeTc);
  const gradeTcLevel=gradeTc?(+((tcMaxEffect(gradeTc)||{}).level)||gradeTc.maxLevel||0):0, gradeTcBonuses=tcMaxBonus(gradeTc,true);
  const relOptions=relOptionsFor(), relTc=relOptions.find(x=>x.name===pmRelName)||null, relBonuses=tcMaxBonus(relTc);
  const tcCombined={...tcBonuses};[gradeTcBonuses,relBonuses].forEach(src=>Object.entries(src).forEach(([k,v])=>{tcCombined[k]=(+tcCombined[k]||0)+(+v||0)}));
  const tcOverall=tcValue(tcCombined,'all','전체 능력치');
  // 수집 카드 능력치는 적응도 1단계 기준. 단계마다 모든 능력치 +1 (데이터센터 실측으로 확인).
  const adaptDelta=+(ADAPTATION_BONUS[pmAdaptation]??(pmAdaptation-1));
  const dtext=v=>v>0?`+${v}`:String(v);
  const tcOptHtml=tcOptions.length?`<option value="">팀컬러 선택</option>${tcOptions.map(x=>`<option value="${esc(x.name)}"${x.name===pmTcName?' selected':''}>${esc(x.name)} (${TC_TYPE(x).includes('nation')||TC_TYPE(x).includes('국가')?'국가':'클럽'})</option>`).join('')}`:'<option value="">적용 가능한 팀컬러 없음</option>';
  const gradeTcOptHtml=gradeTcOptions.length?`<option value="">강화 물결 선택</option>${gradeTcOptions.map(x=>`<option value="${esc(x.name)}"${x.name===pmGradeTcName?' selected':''}>${esc(x.name)}</option>`).join('')}`:'<option value="">강화 물결 데이터 없음</option>';
  const relTcPlaceholder=pmRelationLoading?'넥슨 관계 팀컬러를 불러오는 중이에요…':pmRelationFailed?'공식 관계 팀컬러 조회 실패':'관계 팀컬러 후보 없음';
  const relTcOptHtml=relOptions.length?`<option value="">관계 팀컬러 선택</option>${relOptions.map(x=>`<option value="${esc(x.name)}"${x.name===pmRelName?' selected':''}>${esc(x.name)}</option>`).join('')}`:`<option value="">${relTcPlaceholder}</option>`;
  const main=pos[0], price=L&&L.price?L.price[g-1]:null, at=L&&L.at?new Date(L.at):null;
  const others=CARDS.filter(x=>x.pid===c.pid&&x.id!==c.id).sort((a,b2)=>((ix(b2.id)||[])[0]||0)-((ix(a.id)||[])[0]||0)||b2.sid-a.sid);
  const fmtAt=t=>`${t.getMonth()+1}/${t.getDate()} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
  const loading=!d, none=d&&!L&&!D;
  /* 왼쪽 탭: 특징 · 시세 · 클럽 경력 */
  const row2=(k,v)=>`<div class="pm2-kv"><span>${k}</span><div>${v}</div></div>`;
  const trIcons=list=>(list||[]).map(t=>{const [n,ic]=Array.isArray(t)?t:[t,null];const nw=NEW_TRAITS.has(n);return `<span class="pm2-tr${nw?' new':''}" title="${esc(n)}">${ic!=null?`<img src="${traitIcon(ic)}" alt="${esc(n)}" ${hideBad}>`:''}<b>${esc(n)}</b></span>`}).join('');
  let tabL='';
  if(pmTabL==='feat'){
    tabL=D?row2('출생',`<b>${esc(D.birth||'-')}</b>`)
      +row2('개인기',`<b class="pm2-stars">${'★'.repeat(D.skill||0)}<i>${'★'.repeat(Math.max(0,6-(D.skill||0)))}</i></b>`)
      +row2('명성',`<b>${esc(D.rep||'-')}</b>`)
      +row2('특성',`<div class="pm2-trs">${trIcons(D.traits)||'<span class="muted">없음</span>'}</div>`)
      :`<p class="muted pm2-empty">${loading?'불러오는 중이에요…':'세부 정보는 아직 수집 대기 중이에요.'}</p>`;
  }else if(pmTabL==='price'){
    tabL=L&&L.price?`<div class="pm2-pnow"><span>${g}강 현재가</span><b>${price>0?fmtBP(price):'거래 불가'}</b>${at?`<small>${fmtAt(at)} 기준</small>`:''}</div>
      <div class="pm2-ptable">${L.price.map((p,i)=>`<button type="button" data-g="${i+1}" class="${i+1===g?'on':''}"><span class="gchip g-${GRADE_CLS(i+1)}">${i+1}</span><b>${p>0?fmtBP(p):'-'}</b></button>`).join('')}</div>`
      :`<p class="muted pm2-empty">${loading?'불러오는 중이에요…':'시세를 아직 수집하지 않았어요.'}</p>`;
  }else{
    tabL=D&&D.clubs&&D.clubs.length?D.clubs.map(x=>row2(esc(x[0]),`<b>${esc(x[1])}</b>${x[2]?' <em class="pm2-rent">임대</em>':''}`)).join(''):`<p class="muted pm2-empty">${loading?'불러오는 중이에요…':'클럽 경력 정보가 없어요.'}</p>`;
  }
  /* 오른쪽: 총 능력치(한 줄 목록) · 포지션 OVR */
  const delta=(...xs)=>{const t=xs.reduce((a,x)=>a+(+x||0),0);return t?`<em class="pm2-d">${t>0?'+':''}${t}</em>`:''};
  let tabR='';
  if(D&&D.stats){
    if(pmTabR==='stat'){
      tabR=`<div class="pm2-stats">${STAT_LABELS.map(([k,l])=>{if(D.stats[k]==null)return '';const t=tcValue(tcCombined,k,l),v=D.stats[k]+b+adaptDelta+t;return `<div class="pm2-st"><span>${l}</span><b class="${fcCls(v)}">${v}</b>${delta(b,adaptDelta,t)}</div>`}).join('')}</div>`;
    }else{
      const ps=allPosOvr(D,b+adaptDelta+tcOverall);
      tabR=`<div class="pm2-pitch">${ps.map(o=>`<div class="pm2-pos pg-${o.g}${o.real?' real':''}" style="left:${o.x}%;top:${o.y}%"><b>${o.p}</b><span>${o.v}</span></div>`).join('')}</div><p class="muted pm2-foot">테두리가 굵은 칸은 데이터센터 선호 포지션 값, 나머지는 세부 능력치로 계산한 추정값이에요. 강화·적응도·팀컬러 전체 능력치를 더했어요.</p>`;
    }
  }else tabR=`<p class="muted pm2-empty">${loading?'불러오는 중이에요…':none?'아직 능력치를 수집하지 않은 카드예요. 매일 수집 중이라 곧 채워져요.':'세부 능력치는 아직 수집 대기 중이에요.'}</p>`;
  const sumCells=D&&D.summary&&D.summary.length?D.summary.map(([k,v])=>{const t=tcValue(tcCombined,TC_KEYS[norm(k)]||norm(k),k),value=v+b+adaptDelta+t;return `<div><small>${esc(k)}</small><b class="${fcCls(value)}">${value}</b></div>`}).join(''):['스피드','슛','패스','드리블','수비','피지컬'].map(k=>`<div><small>${k}</small><b class="vlow">-</b></div>`).join('');
  const ovrNow=main?(main[1]||0)+b+adaptDelta+tcOverall:null;
  const gradeSel=`<div class="pm2-grade g-${GRADE_CLS(g)}" title="강화 단계">
    <button type="button" id="pmGradeToggle" class="pm2-grade-trigger" aria-label="강화 단계 ${g}강" aria-expanded="false">${g}<span aria-hidden="true">⌄</span></button>
    <div class="pm2-grade-menu" role="menu" aria-label="강화 단계 선택">${Array.from({length:MAX_GRADE},(_,i)=>`<button type="button" role="menuitem" data-g="${i+1}" class="g-${GRADE_CLS(i+1)}" aria-current="${i+1===g?'true':'false'}">${i+1}강</button>`).join('')}</div>
  </div>`;
  const optsBox=`<div class="pm2-opts">
     <label>적응도<select id="pmAdaptation">${[1,2,3,4,5].map(n=>`<option value="${n}"${n===pmAdaptation?' selected':''}>${n}${n===5?' (최대)':''}</option>`).join('')}</select></label>
     <label>소속 팀컬러<select id="pmTc"${tcOptions.length?'':' disabled'}>${tcOptHtml}</select></label>
     <label>강화 물결<select id="pmGradeTc"${gradeTcOptions.length?'':' disabled'}>${gradeTcOptHtml}</select></label>
     <label>관계 팀컬러<select id="pmRel"${relOptions.length?'':' disabled'}>${relTcOptHtml}</select></label>
     <p class="pm2-note">${[`강화 ${g} ${dtext(b)}`,`적응도 ${pmAdaptation} ${dtext(adaptDelta)}`,tc?`${esc(tc.name)} ${tcLevel}단계`:'',relTc?`${esc(relTc.name)} 적용`:'',gradeTc?(gradeWaveMeets(gradeTc)?`${esc(gradeTc.name)} 전체 +${tcValue(gradeTcBonuses,'all','전체 능력치')}`:`${esc(gradeTc.name)}은 ${gradeTcRule&&gradeTcRule.minGrade}강부터`):''].filter(Boolean).join(' · ')}<br>관계 팀컬러는 넥슨 선수 상세에 표시된 해당 선수의 명단이에요.</p>
   </div>`;
  $('pmBody').innerHTML=`<div class="pm2">
  <div class="pm2-h"><b>선수 정보</b></div>
  <div class="pm2-main">
   <section class="pm2-l">
    <div class="pm2-id">
     <div class="pm2-txt">
      <div class="pm2-name">${bigBadge(c.sid)}<b id="pmTitle">${esc(name)}</b></div><div><a href="/board/?category=review&amp;card=${encodeURIComponent(c.id)}">선수 후기</a> · <button type="button" id="fgFavoriteMember">관심 선수 저장</button></div>
      ${main?`<div class="pm2-ovr"><span class="mp">${esc(main[0])}</span><b>${ovrNow}</b></div>`:''}
      <div class="pm2-meta"><span>${esc(sname(c.sid))}</span>${D?`<i>|</i><span>${esc(String(D.nation||'').split(',')[0])}</span>${flagImg(D.nationId)}`:''}</div>
      <div class="pm2-phys">${pay?`<span>급여</span><span class="hex">${pay}</span>`:''}${D?`<i>|</i><span>${D.height||'-'}cm</span><i>|</i><span>${D.weight||'-'}kg</span><i>|</i><span>${esc(D.body||'-')}</span>`:''}${foot?`<span class="pm2-foot2"><b class="${foot.main==='L'?'on':''}">${foot.l}</b><b class="${foot.main==='R'?'on':''}">${foot.r}</b></span>`:''}</div>
      ${pos.length>1?`<div class="pm2-alt">${pos.slice(1).map(p=>`<span>${esc(p[0])} <b>${(p[1]||0)+b+adaptDelta+tcOverall}</b></span>`).join('')}</div>`:''}
     </div>
     <div class="pm2-photo">${D&&D.teamId?`<span class="pm2-crest">${crestImg(D.teamId)}</span>`:''}${bigImg(c.id)}${gradeSel}</div>
    </div>
    <div class="pm2-gbar"><span>강화</span>${Array.from({length:MAX_GRADE},(_,i)=>`<button type="button" data-g="${i+1}" class="gb g-${GRADE_CLS(i+1)}" aria-pressed="${i+1===g}">${i+1}</button>`).join('')}</div>
    <div class="pm2-sum">${sumCells}</div>
    <div class="pm2-tabs" data-side="L"><button type="button" data-t="feat" aria-selected="${pmTabL==='feat'}">특징</button><button type="button" data-t="price" aria-selected="${pmTabL==='price'}">시세</button><button type="button" data-t="club" aria-selected="${pmTabL==='club'}">클럽 경력</button></div>
    <div class="pm2-tabp">${tabL}</div>
   </section>
   <section class="pm2-r">
    <div class="pm2-tabs pm2-tabs-r" data-side="R"><button type="button" data-t="stat" aria-selected="${pmTabR==='stat'}">총 능력치</button><button type="button" data-t="pos" aria-selected="${pmTabR==='pos'}">OVR</button></div>
    ${optsBox}
    <div class="pm2-tabp">${tabR}</div>
    <div class="pm2-actions"><a class="pm2-dc" href="${DC_URL(c.id,g,pmAdaptation)}" target="_blank" rel="noopener">넥슨 데이터센터에서 보기 ↗</a></div>
   </section>
  </div>
  <div class="pm2-others"><div class="pm2-oh">같은 선수 다른 시즌 <small>${others.length}장</small></div>${others.length?`<div class="pm2-orow">${others.map(o=>{const x=ix(o.id);return `<button type="button" data-sp="${o.id}">${bigBadge(o.sid)}${x&&x[0]?`<b class="${fcCls(x[0])}">${x[0]}</b>`:''}</button>`}).join('')}</div>`:'<p class="muted">다른 시즌 카드가 없어요.</p>'}</div>
 </div>`;
}
function closeCard(){$('pmodal').hidden=true;document.body.style.overflow='';pmCard=null}
$('pmClose').addEventListener('click',closeCard);
$('pmodal').addEventListener('click',e=>{
  if(e.target.id==='pmodal')return closeCard();
  const gradeToggle=e.target.closest('#pmGradeToggle');if(gradeToggle){
    const gradeBox=gradeToggle.closest('.pm2-grade'),open=gradeBox.classList.toggle('open');
    gradeToggle.setAttribute('aria-expanded',String(open));return;
  }
  const gb=e.target.closest('[data-g]');if(gb){pmGrade=+gb.dataset.g;return renderCard()}
  const tb=e.target.closest('.pm2-tabs [data-t]');if(tb){if(tb.parentNode.dataset.side==='L')pmTabL=tb.dataset.t;else pmTabR=tb.dataset.t;return renderCard()}
  const b=e.target.closest('.pm2-orow [data-sp]');if(b)openCard(+b.dataset.sp)});
 $('pmodal').addEventListener('change',e=>{
  if(e.target.id==='pmTc'){pmTcName=e.target.value;renderCard()}
  if(e.target.id==='pmGradeTc'){pmGradeTcName=e.target.value;pmGradeTcCount=0;renderCard()}
  if(e.target.id==='pmAdaptation'){pmAdaptation=+e.target.value||5;renderCard()}
  if(e.target.id==='pmRel'){pmRelName=e.target.value;renderCard()}
 });
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('pmodal').hidden)closeCard()});
/* 미리보기: 예시 카드의 시즌 이름 */
if(!LIVE&&window.FG_PREVIEW_DATA)FG_PREVIEW_DATA.list.forEach(r=>{const sid=Math.floor(r.spid/1e6);if(!SEASONS[sid]&&r.season){const n=r.season.replace(/^(\d+)([A-Z])/,'$1 $2');SEASONS[sid]=[n,SEASON_FAM(n),r.season]}});
/* 홈 */
$('hForm').addEventListener('submit',e=>{e.preventDefault();const n=$('hNick').value.trim();show('diag');if(n){$('dNick').value=n;runDiag(n)}});
if($('hCardForm'))$('hCardForm').addEventListener('submit',e=>{e.preventDefault();$('cq').value=$('hCard').value;$('cSeason').value='';show('cards');cLimit=60;renderCards()});

/* ---------- 시작 ---------- */

if(LIVE){
  $('notice').hidden=true;
  if(!dQueryStarted){$('dNick').value='';$('dBoard').innerHTML='<div><div class="nick">구단주 검색</div><div class="meta">닉네임을 넣고 진단하기를 누르세요.</div></div>'}
}else{
  $('notice').hidden=false;
  const ks=window.FG_SNAP?Object.keys(FG_SNAP):[];const k=ks.find(x=>FG_SNAP[x].matches.length>=5);
  if(k){const m=k.split('|')[1];if(m!==dMode){dMode=m;$('dMode').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.mode===m))}$('dNick').value=FG_SNAP[k].basic.nickname;runDiag($('dNick').value)}
  else{$('dBoard').innerHTML='<div><div class="nick">구단주 검색</div><div class="meta">닉네임을 넣고 진단하기를 누르세요.</div></div>'}
}
initCards();
{const h=location.hash.replace('#',''),bv=document.body.dataset.view;
 if(VIEWS.includes(h))show(h);else if(bv&&bv!=='home'&&VIEWS.includes(bv))show(bv,true);}
window.addEventListener('popstate',()=>{const R=window.FG_ROUTES||{};const p=location.pathname.replace(/\.html$/,'').replace(/(.)\/$/,'$1');const v=Object.keys(R).find(k=>R[k]===p)||(p.startsWith('/guide')?'guide':p.startsWith('/market')?'market':p.startsWith('/sim')?'sim':p.startsWith('/trade')?'trade':'home');show(v,true);if(window.FG_TITLES&&FG_TITLES[v])document.title=FG_TITLES[v]});

/* 이적시장: 기본 TOP10은 HTML로 즉시 표시하고, 필터 조작·상세 화면에서만 전체 후보 JSON을 지연 로딩 */
function hydrateSeasonBadges(scope){
  (scope||document).querySelectorAll('.mk-ssn[data-sid]').forEach(el=>{if(SEASONS[+el.dataset.sid]&&seasonsLoaded)el.innerHTML=sch(+el.dataset.sid)});
  (scope||document).querySelectorAll('select[data-market-season]').forEach(sel=>{
    const value=sel.value,seen=new Set([...sel.options].map(o=>o.value));
    Object.keys(SEASONS).map(Number).sort((a,b)=>sname(a).localeCompare(sname(b),'ko')).forEach(id=>{
      if(seen.has(String(id)))return;const o=document.createElement('option');o.value=id;o.textContent=sname(id);sel.appendChild(o)
    });sel.value=value
  });
}
const marketDataCache={};
function loadMarketPeriod(day){
  if(!marketDataCache[day])marketDataCache[day]=fetch(`/market-data/${day}.json`).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).catch(e=>{delete marketDataCache[day];throw e});
  return marketDataCache[day]
}
function marketRow(x,n){
  const up=+x.d>0,grade=+(x.g||1),sid=+(x.s||Math.floor(+x.id/1e6));
  const pct=`${+x.c>0?'+':''}${(+x.c||0).toFixed(1)}%`,delta=`${up?'+':'-'}${fmtBP(Math.abs(+x.d||0))}`;
  return `<tr class="mk-stock-row" data-card="${+x.id}" data-grade="${grade}"><td class="mk-rank">${n}</td><td class="mk-player"><button type="button" data-card="${+x.id}" data-grade="${grade}"><span class="mk-face"><img src="${IMG_BASE}playersAction/p${+x.id}.png" alt="" loading="lazy" onerror="this.remove()"></span><span class="mk-ssn" data-sid="${sid}">${sch(sid)}</span><span class="mk-nm"><b>${esc(x.n||'')}</b><small>${gch(grade)}${x.p?' '+esc(x.p)+' '+esc(x.o||''):''}</small></span></button></td><td class="mk-num mk-pr">${fmtBP(+x.v)}</td><td class="mk-num mk-pct ${up?'up':'down'}">${pct}<span class="mk-mobile-delta">${delta}</span></td><td class="mk-num mk-delta ${up?'up':'down'}">${delta}</td></tr>`
}
function marketRank(items,state,direction,limit){
  let rows=(items||[]).filter(x=>(direction==='up'?+x.d>0:+x.d<0)&&(!state.grade||+x.g===+state.grade)&&(!state.season||+x.s===+state.season));
  if(state.sort==='impact')rows=rows.filter(x=>x.impact!=null&&Number.isFinite(+x.impact));
  const metric=state.sort==='pct'?'c':state.sort==='delta'?'d':'impact',rank=state.sort==='pct'?'rp':state.sort==='delta'?'rd':'ri';
  rows.sort((a,b)=>(Number.isFinite(+a[rank])&&Number.isFinite(+b[rank])?+a[rank]-+b[rank]:Math.abs(+b[metric]||0)-Math.abs(+a[metric]||0))||Math.abs(+b.d||0)-Math.abs(+a.d||0)||(+b.g||0)-(+a.g||0)||+a.id-+b.id);
  const count={},out=[];for(const x of rows){if(state.sort==='impact'&&!state.grade&&(count[x.id]||0)>=2)continue;count[x.id]=(count[x.id]||0)+1;out.push(x);if(out.length>=limit)break}return out
}
function initMarketDashboard(root){
  const detail=root.dataset.detail==='true',q=new URLSearchParams(location.search),state={day:detail&&['1','3','7'].includes(q.get('period'))?q.get('period'):'1',grade:detail&&/^(?:[1-9]|1[0-3])$/.test(q.get('grade')||'')?q.get('grade'):'',season:detail&&/^\d+$/.test(q.get('season')||'')?q.get('season'):'',sort:detail&&['impact','pct','delta'].includes(q.get('sort'))?q.get('sort'):'impact',direction:detail&&q.get('direction')==='down'?'down':'up'};
  const grade=root.querySelector('[data-market-grade]'),season=root.querySelector('[data-market-season]');grade.value=state.grade;season.value=state.season;
  let seq=0,started=false;
  const currentPanel=()=>root.querySelector(`[data-mdp="${state.day}"]`)||root;
  const syncControls=()=>{root.querySelectorAll('[data-md]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.md===state.day)));root.querySelectorAll('[data-market-sort]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marketSort===state.sort)));root.querySelectorAll('[data-mdp]').forEach(p=>p.hidden=p.dataset.mdp!==state.day);if(detail){root.querySelectorAll('[data-market-direction]').forEach(s=>s.hidden=s.dataset.marketDirection!==state.direction);root.querySelectorAll('[data-market-dir]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marketDir===state.direction)));root.querySelector('[data-market-title]').textContent=`${state.day}일 ${state.direction==='up'?'급등':'급락'} TOP 100`}};
  const updateLinks=()=>{root.querySelectorAll('[data-market-more]').forEach(a=>{const u=new URL(a.href,location.href);u.searchParams.set('period',state.day);u.searchParams.set('direction',a.dataset.marketMore);u.searchParams.set('sort',state.sort);state.grade?u.searchParams.set('grade',state.grade):u.searchParams.delete('grade');state.season?u.searchParams.set('season',state.season):u.searchParams.delete('season');a.href=u.pathname+u.search});if(detail&&!root.closest('main').hidden){const u=new URL(location.href);u.searchParams.set('period',state.day);u.searchParams.set('direction',state.direction);u.searchParams.set('sort',state.sort);state.grade?u.searchParams.set('grade',state.grade):u.searchParams.delete('grade');state.season?u.searchParams.set('season',state.season):u.searchParams.delete('season');history.replaceState(null,'',u)}};
  const setEmpty=(panel,dir,msg,empty)=>{let p=panel.querySelector(`[data-market-empty="${dir}"]`);if(!p){p=document.createElement('p');p.className='mk-empty';p.dataset.marketEmpty=dir;panel.querySelector(`[data-market-direction="${dir}"],.mk-${dir==='up'?'up':'down'}`).appendChild(p)}p.textContent=msg;p.hidden=!empty};
  const render=async()=>{
    const version=++seq,day=state.day;syncControls();updateLinks();const panel=currentPanel(),status=panel.querySelector('[data-market-status]');if(status)status.textContent='순위 계산 데이터를 불러오는 중…';
    try{const data=await loadMarketPeriod(day);if(version!==seq)return;if(!data.ready){['up','down'].forEach(dir=>{panel.querySelector(`[data-market-list="${dir}"]`).innerHTML='';setEmpty(panel,dir,`${day}일 비교 이력 ${data.historyDays||0}/${data.required||(+day+1)}일 · 데이터 수집 중`,true)});if(status)status.textContent='비교 이력을 수집 중입니다.';return}
      const pool=data.items.filter(x=>(!state.grade||+x.g===+state.grade)&&(!state.season||+x.s===+state.season));let fallback=false;if(state.sort==='impact'&&pool.length&&!pool.some(x=>x.impact!=null)){state.sort='pct';fallback=true;syncControls();updateLinks()}
      ['up','down'].forEach(dir=>{const rows=marketRank(data.items,state,dir,+(root.dataset.limit||10)),body=panel.querySelector(`[data-market-list="${dir}"]`);body.innerHTML=rows.map((x,i)=>marketRow(x,i+1)).join('');setEmpty(panel,dir,'선택한 조건의 등락 카드가 없어요.',!rows.length)});
      if(status)status.textContent=`${data.prev} → ${data.date} · 전체 유효 변동 후보 ${data.items.length.toLocaleString()}건${fallback?' · 종합 관측 부족: 등락률 표시':''}`;
    }catch(e){if(version!==seq)return;if(status)status.textContent='순위 데이터를 불러오지 못했어요.';['up','down'].forEach(dir=>{panel.querySelector(`[data-market-list="${dir}"]`).innerHTML='';setEmpty(panel,dir,'잠시 후 다시 시도해 주세요.',true)})}
  };
  root.addEventListener('click',e=>{const d=e.target.closest('[data-md]');if(d){state.day=d.dataset.md;render();return}const s=e.target.closest('[data-market-sort]');if(s){state.sort=s.dataset.marketSort;render();return}const dir=e.target.closest('[data-market-dir]');if(dir){state.direction=dir.dataset.marketDir;syncControls();updateLinks();return}const row=e.target.closest('[data-card]');if(row){openCard(+row.dataset.card);const g=+(row.dataset.grade||1);if(g>1){pmGrade=g;renderCard()}}});
  root.addEventListener('change',e=>{if(e.target===grade){state.grade=grade.value;render()}else if(e.target===season){state.season=season.value;render()}});
  loadSeasons().then(()=>{hydrateSeasonBadges(root);season.value=state.season;if(state.season&&!season.value){state.season='';if(started)render()}}).catch(()=>{});
  if(!detail&&currentPanel().dataset.defaultSort==='pct')state.sort='pct';
  syncControls();if(!detail)updateLinks();
  const activate=()=>{if(detail&&!root.closest('main').hidden&&!started){started=true;render()}};
  activate();document.addEventListener('fg:view',activate);
}
document.querySelectorAll('[data-market-dashboard]').forEach(initMarketDashboard);

// Community integration: explicit member action, no background account data upload.
document.addEventListener("click",async e=>{if(!e.target.closest("#fgFavoriteMember")||!pmCard)return;const id=pmCard.id,grade=pmGrade,name=document.getElementById("pmTitle")?.textContent||String(id);try{const r=await fetch("/api/community/favorite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({card_id:id,grade,name})});const j=await r.json();if(!r.ok)throw Error(j.message);alert("관심 선수에 저장했습니다.")}catch(err){alert("관심 선수 저장 실패: "+err.message)}});

// Diagnostic tooltips live under body, outside the scrolling/sticky table.
(()=>{const panel=document.getElementById('dPanel');if(!panel)return;
const selector='.rk-low[data-tip],.rc-flag[data-tip]';let active=null,tip=null;
const hide=()=>{if(active){active.removeAttribute('aria-describedby');active=null}if(tip)tip.hidden=true};
const show=el=>{if(!el||!el.dataset.tip)return;hide();if(!tip){tip=document.createElement('div');tip.id='fgDiagFloatTip';tip.className='diag-float-tip';tip.setAttribute('role','tooltip');document.body.appendChild(tip)}active=el;tip.textContent=el.dataset.tip;tip.hidden=false;el.setAttribute('aria-describedby',tip.id);
const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,margin=8;let left=Math.min(Math.max(margin,r.left),Math.max(margin,window.innerWidth-w-margin)),top=r.bottom+8;if(top+h>window.innerHeight-margin)top=r.top-h-8;tip.style.left=left+'px';tip.style.top=Math.max(margin,top)+'px'};
panel.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const el=e.target.closest(selector);if(el&&el!==active)show(el)});
panel.addEventListener('pointerout',e=>{if(active&&!active.contains(e.relatedTarget))hide()});
panel.addEventListener('focusin',e=>{const el=e.target.closest(selector);if(el)show(el)});
panel.addEventListener('focusout',e=>{if(active&&!active.contains(e.relatedTarget))hide()});
panel.addEventListener('click',e=>{const el=e.target.closest(selector);if(el?.classList.contains('rk-low')){if(active===el&&e.pointerType!=='touch')hide();else show(el)}else hide()});
document.addEventListener('pointerdown',e=>{if(active&&!active.contains(e.target))hide()});document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);document.addEventListener('fg:view',hide);
})();
