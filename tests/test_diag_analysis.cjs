const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../site/assets/js/app.js'),'utf8');
const ctx={sname:id=>({877:'UC',878:'DC'}[id]||'?'),LINE:()=> '수비',RK_ATT:[],RK_DEF:[['tackle','태클'],['block','블락']]};
vm.createContext(ctx);
for(const [a,b] of [['function dRankerCompare(','async function dLoadRanker('],['function dLatestLineup(','function analyze('],['function dAssessPlayer(','function dRatePlayers('],['function dExactPrice(','function dPriceText('],['function dInferTeamcolor(','async function dLoadTeamcolors(']]){
  const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>=0&&j>i);vm.runInContext(src.slice(i,j),ctx);
}
const p={apps:10,t:{tackle:3,block:2},spId:1,pos:'LB',avg:6.2,wr:.4,r:Array(10).fill(6.2),rtRef:{avg:6.5,n:100},rk:{tackle:1,block:1},rkLow:{tackle:{lb:'태클',mine:.3,avg:1},block:{lb:'블락',mine:.2,avg:1}}};
test('ranker and position benchmark deficits trigger review, with visible reasons',()=>{const x=ctx.dAssessPlayer(p,[p]);assert.equal(x.action,'교체 검토');assert.ok(x.risk>=2);assert.match(x.reason,/태클/);assert.match(x.reason,/10\/10경기/)});
test('missing benchmarks and small samples never claim a confident reinforcement',()=>{assert.equal(ctx.dAssessPlayer({...p,apps:2},[]).action,'평가 보류');assert.equal(ctx.dAssessPlayer({...p,apps:4},[]).action,'평가 보류');assert.equal(ctx.dAssessPlayer({...p,rtRef:null,rk:null},[]).eval,null)});
test('same position lower performance and higher price are described without assuming causality',()=>{const x={...p,rtRef:null,rk:null,price:200},peer={...p,spId:2,name:'다른 선수',price:100,avg:6.7,wr:.7};const q=ctx.dAssessPlayer(x,[x,peer]);assert.equal(q.action,'교체 검토');assert.match(q.reason,/가격 효율 검토/)});
test('prices use exact grade from stored BP array, never guess or substitute',()=>{const L={price:[3500000,3500000,3830000,4250000,6630000,13600000,45400000,368000000,542000000,1420000000,29600000000,45900000000,147000000000]};assert.equal(ctx.dExactPrice(L,9),542000000);assert.equal(ctx.dExactPrice(L,10),1420000000);assert.equal(ctx.dExactPrice({price:[500]},9),null);assert.equal(ctx.dExactPrice(L,0),null);assert.equal(ctx.dExactPrice(L,14),null);assert.equal(ctx.dExactPrice({price:[0]},1),null)});
const players=Array.from({length:11},(_,i)=>({spId:i+1}));const mk=(a,b)=>({names:['A','B'],cards:Object.fromEntries(players.map((p,i)=>[p.spId,[...(i<a?[0]:[]),...(i>=11-b?[1]:[])]]))});
test('eight common players qualify, even with a one-player lead or incomplete lineup',()=>{
  assert.equal(ctx.dInferTeamcolor(players,mk(9,8)).name,'A');
  assert.equal(ctx.dInferTeamcolor(players,mk(8,7)).name,'A');
  assert.equal(ctx.dInferTeamcolor(players,mk(7,6)),null);
  assert.equal(ctx.dInferTeamcolor(players.slice(0,8),mk(8,4)).name,'A');
  assert.equal(ctx.dInferTeamcolor(players.slice(0,7),mk(9,4)),null);
  assert.equal(ctx.dInferTeamcolor(players,mk(11,9)).confidence,'매우 높음');
});
test('one representative per match including single appearances and ties',()=>{
  const match={matchInfo:[{matchDetail:{matchResult:'승'}},{player:players}]};
  const TC=mk(9,4);
  assert.equal(ctx.dTeamcolorStats([match],TC).all.length,1);
  const result=ctx.dTeamcolorStats([match,match],TC);
  assert.equal(result.all.length,1);assert.equal(result.all[0].n,2);
  const tied=ctx.dInferTeamcolor(players,mk(8,8));
  assert.equal(tied.tied,true);assert.match(tied.name,/동률/);
});
test('same-season cards without detail data qualify from official season metadata',()=>{
  const ps=Array.from({length:11},(_,i)=>({spId:(i<8?877:999)*1e6+i+1}));
  const TC={names:['UC'],kinds:['season'],seasonById:{877:0},cards:{}};
  const found=ctx.dInferTeamcolor(ps,TC);assert.equal(found.name,'UC');assert.equal(found.n,8);
  const tie={...mk(8,8),kinds:['club','season']};
  assert.equal(ctx.dInferTeamcolor(players,tie).name,'B');
  assert.equal(ctx.dInferTeamcolor(players,{...mk(9,8),kinds:['nation','season']}).name,'A');
});

test('moderate benchmark warnings and ranker deficits alone do not trigger replacement',()=>{
  const mild={...p,avg:6.35,r:Array(10).fill(6.35)};
  assert.equal(ctx.dAssessPlayer(mild,[mild]).action,'유지');
  const rankOnly={...p,rtRef:null};
  assert.equal(ctx.dAssessPlayer(rankOnly,[rankOnly]).action,'유지');
  const oneMetric={...p,rkLow:{tackle:p.rkLow.tackle}};
  assert.equal(ctx.dAssessPlayer(oneMetric,[oneMetric]).action,'유지');
});
test('replacement requires at least ten appearances and sustained weakness',()=>{
  const few={...p,apps:9,r:Array(9).fill(6.2)};
  assert.equal(ctx.dAssessPlayer(few,[few]).action,'유지');
  const occasional={...p,r:[6,6,6,6,6,6.6,6.6,6.6,6.6,6.6]};
  assert.equal(ctx.dAssessPlayer(occasional,[occasional]).action,'유지');
  const persistent={...p,avg:6.05,r:Array(10).fill(6.05),rk:null,rkLow:null};
  assert.equal(ctx.dAssessPlayer(persistent,[persistent]).action,'유지');
  const confirmed={...persistent,rk:p.rk,rkLow:{tackle:p.rkLow.tackle}};
  assert.equal(ctx.dAssessPlayer(confirmed,[confirmed]).action,'교체 검토');
});
test('peer replacement comparison requires ten appearances on both cards',()=>{
  const x={...p,rtRef:null,rk:null,price:200};
  const peer={...p,apps:9,spId:2,name:'대체 선수',avg:6.7,wr:.7,price:100};
  assert.equal(ctx.dAssessPlayer(x,[x,peer]).action,'평가 보류');
  const valid={...p,apps:10,spId:3,name:'유효 대체 선수',avg:6.55,wr:.55,price:120};
  assert.equal(ctx.dAssessPlayer(x,[x,peer,valid]).action,'교체 검토');
});

test('player records start at GK then RB and proceed right to left; unknown positions last',()=>{
  const i=src.indexOf('const D_POS_ORDER='),j=src.indexOf('\n',src.indexOf('function dComparePosition(',i));
  assert.ok(i>=0&&j>i);
  vm.runInContext(src.slice(i,j),ctx);
  const positions=['LB','RCM','LAM','LCB','CAM','GK','RB','CDM','RAM','RCB','LCM','UNKNOWN'];
  assert.deepEqual(positions.map(pos=>({pos})).sort(ctx.dComparePosition).map(x=>x.pos),['GK','RB','RCB','LCB','LB','CDM','RCM','LCM','RAM','CAM','LAM','UNKNOWN']);
});
test('both match modes prioritize player records, ranker comparison, detailed metrics and omit manual panels',()=>{
  const i=src.indexOf('const DTABS='),j=src.indexOf('\n',i);
  assert.ok(i>=0&&j>i);
  vm.runInContext(src.slice(i,j),ctx);
  for(const mode of ['50','52']){
    const keys=Array.from(vm.runInContext('DTABS["'+mode+'"]',ctx),x=>x[0]);
    assert.deepEqual(keys.slice(0,3),['pstats','ranker','stats']);
    assert.ok(!keys.includes('squad')&&!keys.includes('asset'));
    assert.ok(keys.includes('growth')&&keys.includes('time')&&keys.includes('shot'));
    if(mode==='52')assert.ok(keys.includes('form')&&keys.includes('line'));
  }
  assert.ok(!src.includes('function dSquadView(')&&!src.includes('function dAssetView('));
  assert.ok(!src.includes('data-buy=')&&!src.includes('data-asset='));
});

test('recent squad uses latest dated valid lineup, not input order or player names',()=>{
  const old={spId:877005471,name:'램파드'},current={spId:878005471,name:'램파드'},other={spId:877000002,name:'다른 선수'};
  const match=(date,player)=>({matchDate:date,matchInfo:[{player}]});
  const lineup=ctx.dLatestLineup([match('2026-11-23T12:00:00Z',[old]),match('2026-11-24T12:00:00Z',[current,other]),match('2026-11-25T12:00:00Z',[])]);
  const all=[old,current,other];
  assert.deepEqual(Array.from(ctx.dRecentRows(all,lineup,true),x=>x.spId),[current.spId,other.spId]);
  assert.equal(ctx.dRecentRows(all,lineup,false).length,3);
  assert.equal(ctx.dRecentStatus(old,lineup),'최근 경기 미출전');
  assert.equal(ctx.dRecentStatus(current,lineup),'최근 경기 출전');
  assert.equal(ctx.dRecentRows(all,[],true).length,0);
});
test('diagnosis card labels distinguish same-name seasons and show grade',()=>{
  assert.equal(ctx.dCardLabel({pos:'CM',seasonId:877,name:'램파드',grade:9}),'CM UC 램파드 9강');
  assert.equal(ctx.dCardLabel({pos:'CM',spId:878005471,name:'램파드',grade:8}),'CM DC 램파드 8강');
  assert.match(ctx.dCardLabel({pos:'CM',seasonId:999,name:'램파드',grade:8}),/시즌 999/);
});

test('dribble and pass percentages compare rates, not per-match success counts',()=>{
  const x={apps:10,t:{dribbleSuccess:97,dribbleTry:100,passSuccess:90,passTry:100}};
  const high=ctx.dRankerCompare(x,'dribbleSuccess','드리블',{dribbleSuccess:20,dribbleTry:21});
  assert.equal(high.low,false);
  assert.equal(ctx.dRankerCompare(x,'dribbleSuccess','드리블',{dribbleSuccess:20}),null);
  const low=ctx.dRankerCompare({...x,t:{passSuccess:60,passTry:100}},'passSuccess','패스',{passSuccess:9,passTry:10});
  assert.equal(low.low,true);assert.equal(ctx.dRankerValue(low,low.mine),'60.0%');
});
test('duel cell separates percentage and labelled counts; zero attempts are unavailable',()=>{
  assert.match(ctx.dDuelCell(29,37),/78%/);
  assert.match(ctx.dDuelCell(29,37),/성공 29 \/ 시도 37/);
  assert.match(ctx.dDuelCell(0,0),/>-</);
});

test('ranker comparison uses the same latest squad filter as player records',()=>{
  const i=src.indexOf('function dRankerView(a){'),j=src.indexOf('function dRenderTabs()',i),view=src.slice(i,j);
  assert.ok(view.includes('dRecentRows(a.players,a.recentLineup,dFilter.recent)'));
  assert.ok(view.includes('dRecentCheckbox(a)'));
});
test('teamcolor reports exclusions and single-appearance groups separately',()=>{
  const match=player=>({matchInfo:[{matchDetail:{matchResult:'승'}},{player}]});
  const result=ctx.dTeamcolorStats([match(players),match(players.slice(0,7))],mk(9,4));
  assert.equal(result.valid.length,1);assert.equal(result.excluded.lineup,1);assert.equal(result.single,1);assert.equal(result.all.length,1);
  const out=ctx.dTeamcolorStats([match(players)],mk(8,8));
  assert.equal(out.valid.length,1);assert.equal(out.all[0].n,1);assert.match(out.all[0].name,/동률/);
});


test('teamcolor rankings require three encounters, not a single perfect result',()=>{
  const rows=[{name:'A',n:1,w:1,l:0},{name:'B',n:2,w:0,l:2},{name:'C',n:3,w:2,l:1},{name:'D',n:5,w:3,l:2},{name:'E',n:3,w:0,l:3}];
  const result=ctx.dTeamcolorRankings(rows);
  assert.deepEqual(Array.from(result.eligible,x=>x.name),['C','D','E']);
  assert.deepEqual(Array.from(result.wins,g=>g.teams[0].name),['C','D']);
  assert.deepEqual(Array.from(result.loss,g=>g.teams[0].name),['E','D','C']);
  assert.equal(ctx.dTeamcolorRankings(rows.slice(0,2)).eligible.length,0);
});

test('teamcolor top five groups preserve all teams tied at the same displayed percentage',()=>{
  const rows=[{name:'A',n:3,w:3,l:0},{name:'B',n:6,w:6,l:0},{name:'C',n:4,w:3,l:1},{name:'D',n:3,w:2,l:1},{name:'E',n:5,w:3,l:2},{name:'F',n:4,w:2,l:2},{name:'G',n:6,w:3,l:3},{name:'H',n:3,w:1,l:2}];
  const result=ctx.dTeamcolorRankings(rows);
  assert.deepEqual(Array.from(result.wins,g=>g.pct),[100,75,67,60,50]);
  assert.deepEqual(Array.from(result.wins[0].teams,x=>x.name),['B','A']);
  assert.deepEqual(Array.from(result.wins[4].teams,x=>x.name),['G','F']);
  assert.equal(result.loss.find(g=>g.pct===50).teams.length,2);
});
test('diagnosis layout keeps owner and advice together and report before details and teamcolor',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../site/templates/index.html'),'utf8');
  const intro=html.indexOf('class="diag-intro"'),board=html.indexOf('id="dBoard"'),tip=html.indexOf('id="dTip"'),shell=html.indexOf('id="dReportShell"'),sum=html.indexOf('id="dSum"'),report=html.indexOf('id="dReport"');
  assert.ok(intro>=0&&intro<board&&board<tip&&tip<sum);
  assert.ok(shell<sum&&sum<report&&report<html.indexOf('id="dDetailSec"'));
  assert.ok(html.indexOf('id="dDetailSec"')<html.indexOf('id="dTc"'));
  assert.ok(html.indexOf('id="dTc"')<html.indexOf('id="dWeakSec"'));
  assert.ok(!src.includes("const secs=$('dSecs')"));
});

test('diagnosis uses one compact report without duplicated recent win rate and compact actions',()=>{
  assert.ok(!src.includes('<span>최근 승률</span>'));
  assert.ok(!src.includes('<span>우수 선수</span>'));
  assert.ok(src.includes("['경기당 득실'"));
  assert.ok(src.includes('<p>${advice}</p>'));
  assert.ok(src.includes("$('dReportHead').innerHTML"));
  assert.ok(src.includes("className='ghost dr-action'"));
  assert.ok(src.includes('<span>AI 개선</span>'));
  assert.ok(src.includes('<span>진단 저장</span>'));
});

test('mobile comparison tables show every player in each group and retain every metric',()=>{
 const a=src.indexOf('function dPStatsMobile('),b=src.indexOf('function dpsToggleFull(',a);
 vm.runInContext(src.slice(a,b),ctx);
 const columns=Array.from({length:24},(_,i)=>'label'+i);
 const cells=Array.from({length:24},(_,i)=>'<b>value'+i+'</b>');
 cells[22]='<button data-reco="123">candidate</button>';
 const rows=Array.from({length:11},(_,i)=>({state:'low',cells,mobileName:'Player'+i+'!'}));
 const html=ctx.dPStatsMobile(rows,columns);
 for(let i=1;i<24;i++)if(i!==22)assert.ok(html.includes('value'+i+'</b>'),String(i));
 assert.equal((html.match(/<table class="dps-table/g)||[]).length,5);
 for(let i=0;i<11;i++)assert.equal(html.split('Player'+i+'!').length-1,5);
 assert.match(html,/data-reco="123"/);assert.match(html,/전체화면/);
 assert.ok(!html.includes('<details'));assert.match(ctx.dPStatsMobile([],columns),/조건에 맞는 선수 기록이 없어요/);
});

test("player record explanation is hidden in a single accessible help disclosure",()=>{
 const a=src.indexOf("function dPStatsView(a){"),b=src.indexOf("function dGrowthView",a),view=src.slice(a,b);
 assert.equal((view.match(/<details class="dps-help">/g)||[]).length,1);
 assert.match(view,/<summary aria-label="선수별 기록 설명"[^>]*>\?<\/summary>/);
 assert.match(view,/<div class="dps-help-popup">[\s\S]*?최근 \$\{a.n\}경기 합계예요\.[\s\S]*?\$\{rkNote\}\$\{rtNote\(a\)\}<\/p><\/div><\/details>/);
 assert.ok(!view.includes('dPStatsMobile(records,columns)}<p class="note">'));
});

 test('mobile defence keeps compact success/attempt counts, accessible labels and every player',()=>{
  const start=src.indexOf('function dPStatsMobile('),end=src.indexOf('function dpsToggleFull(',start);
  vm.runInContext(src.slice(start,end),ctx);
  const columns=Array.from({length:24},(_,i)=>'label'+i),cells=Array.from({length:24},()=>'-');
  cells[9]=ctx.dDuelCell(241,378);cells[10]=ctx.dDuelCell(7,130);
  const mobileCells={9:ctx.dDuelCell(241,378,true),10:ctx.dDuelCell(7,130,true)};
  assert.match(cells[9],/성공 241 \/ 시도 378/);
  assert.match(mobileCells[9],/64%/);assert.match(mobileCells[9],/aria-label="성공 241 \/ 시도 378">241\/378<\/small>/);
  assert.match(ctx.dDuelCell(0,0,true),/>-</);
  const html=ctx.dPStatsMobile(Array.from({length:11},(_,i)=>({state:'',cells,mobileCells,mobileName:'Player'+i+'!'})),columns);
  assert.equal((html.match(/>241\/378<\/small>/g)||[]).length,11);
  assert.equal((html.match(/>7\/130<\/small>/g)||[]).length,11);
  assert.ok(!html.includes('>성공 241 / 시도 378<'));
  const css=fs.readFileSync(path.join(__dirname,'../site/assets/css/main.css'),'utf8');
  assert.match(css,/\.dps-table-2 \.duel-count\{[^}]*white-space:normal;overflow-wrap:anywhere/);
 });

test("diagnosis profile omits the duplicate record strip while retaining ranks and sample labeling",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const s=fs.readFileSync(path.join(__dirname,"../site/assets/js/app.js"),"utf8");
 const board=s.slice(s.indexOf("function dRenderBoard("),s.indexOf("function cmpRows("));
 assert.ok(board.includes("최근 경기 등급")&&board.includes("역대 최고 등급"));
 assert.ok(board.includes("예시 데이터(가상)"));
 assert.ok(!board.includes('class="record"'));
 assert.ok(!board.includes("승·무·패")&&!board.includes("득실"));
 assert.ok(s.includes("종합 구단 리포트"));
});


test('GK uses unified grade, bounded team context and repeated personal rating for replacement',()=>{const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),s=fs.readFileSync(path.join(__dirname,'../site/assets/js/app.js'),'utf8'),g={};vm.createContext(g);vm.runInContext(s.slice(s.indexOf('function dPerfPair('),s.indexOf('function dTeamDiagnosis(')),g);const ref={avg:6.5,n:50},a={performance:{roles:{GK:{rating:ref,against:{avg:1,n:50},clean:{avg:.4,n:50}}}},perfRef:{groups:{GK:{metrics:{rating:ref}}}}};const x={roleApps:20,roleRaw:{rating:[130,20,20]},gkMatches:20,gkAgainst:20,gkClean:8,r:Array(20).fill(6.5)};const q=g.dKeeperScore(x,a);assert.equal(q.value,75);assert.equal(q.grade,'B');assert.equal(g.dPlayerAction(x,q,{}),'유지');const bad={...x,roleRaw:{rating:[110,20,20]},r:Array(20).fill(5.5)};const b=g.dKeeperScore(bad,a);assert.ok(b.confirmed);assert.equal(g.dPlayerAction(bad,b,{}),'우선 보강');const mid={...x,roleRaw:{rating:[116,20,20]},r:Array(20).fill(5.8)};assert.equal(g.dPlayerAction(mid,g.dKeeperScore(mid,a),{}),'교체 검토');const teamOnly={...x,gkAgainst:200,gkClean:0};const t=g.dKeeperScore(teamOnly,a);assert.equal(t.confirmed,false);assert.notEqual(g.dPlayerAction(teamOnly,t,{}),'교체 검토');assert.equal(g.dPerfPair(5,undefined),null);assert.equal(g.dKeeperScore({...x,roleApps:4},a),null);assert.ok(!s.includes("x.keeperRef?' 참고'"));});

test('playstyle uses observed match records and refuses inadequate or synthetic samples',()=>{
 const i=src.indexOf('function dPlayStyle('),e=src.indexOf('function dRenderReport(',i);vm.runInContext(src.slice(i,e),ctx);
 const row=(pos=50,shots=10,out=2,opp=10,lp=5,tp=5)=>({matchInfo:[{matchDetail:{possession:pos,matchEndType:0},shoot:{shootTotal:shots,shootOutPenalty:out},pass:{passTry:100,longPassTry:lp,throughPassTry:tp}},{matchDetail:{possession:100-pos},shoot:{shootTotal:opp,shootOutPenalty:0}}]});
 const rows=(...a)=>Array.from({length:10},()=>row(...a));
 assert.equal(ctx.dPlayStyle(rows(58)).name,'점유형');
 assert.equal(ctx.dPlayStyle(rows(40,10,2,10)).name,'역습 성향');
 assert.equal(ctx.dPlayStyle(rows(40,4,1,12)).name,'수세형');
 assert.equal(ctx.dPlayStyle(rows(50,10,5)).name,'중거리형');
 assert.equal(ctx.dPlayStyle(rows(50,10,2,10,22)).name,'롱패스형');
 assert.equal(ctx.dPlayStyle(rows(50,10,2,10,5,20)).name,'침투패스형');
 assert.equal(ctx.dPlayStyle(rows()).name,'균형형');
 assert.equal(ctx.dPlayStyle(rows().slice(0,9)).name,'분석 보류');
 assert.equal(ctx.dPlayStyle(rows(),true).name,'분석 보류');
 assert.equal(ctx.dPlayStyle(rows().map(m=>({...m,matchInfo:[{...m.matchInfo[0],matchDetail:{possession:null}},m.matchInfo[1]]}))).name,'분석 보류');
 assert.match(ctx.dPlayStyle(rows(58)).detail,/유효 10경기/);
 const css=fs.readFileSync(path.join(__dirname,'../site/assets/css/main.css'),'utf8');
 assert.match(css,/\.diag-intro>#dBoard\{grid-template-columns:minmax\(0,1fr\) auto;gap:8px\}/);
 assert.match(css,/\.diag-report-shell \.dr-insights\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.ok(src.includes('나의 플레이스타일')&&src.includes('dStyleDialog'));
});
