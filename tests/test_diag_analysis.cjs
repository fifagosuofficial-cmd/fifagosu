const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../site/assets/js/app.js'),'utf8');
const ctx={LINE:()=> '수비',RK_ATT:[],RK_DEF:[['tackle','태클'],['block','블락']]};
vm.createContext(ctx);
for(const [a,b] of [['function dAssessPlayer(','function dRatePlayers('],['function dExactPrice(','function dPriceText('],['function dInferTeamcolor(','async function dLoadTeamcolors(']]){
  const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>=0&&j>i);vm.runInContext(src.slice(i,j),ctx);
}
const p={apps:10,spId:1,pos:'LB',avg:6.2,wr:.4,r:Array(10).fill(6.2),rtRef:{avg:6.5,n:100},rk:{tackle:1,block:1},rkLow:{tackle:{lb:'태클',mine:.3,avg:1},block:{lb:'블락',mine:.2,avg:1}}};
test('ranker and position benchmark deficits trigger review, with visible reasons',()=>{const x=ctx.dAssessPlayer(p,[p]);assert.equal(x.action,'교체 검토');assert.ok(x.risk>=2);assert.match(x.reason,/태클/);assert.match(x.reason,/10\/10경기/)});
test('missing benchmarks and small samples never claim a confident reinforcement',()=>{assert.equal(ctx.dAssessPlayer({...p,apps:2},[]).action,'평가 보류');assert.equal(ctx.dAssessPlayer({...p,apps:4},[]).action,'평가 보류');assert.equal(ctx.dAssessPlayer({...p,rtRef:null,rk:null},[]).eval,null)});
test('same position lower performance and higher price are described without assuming causality',()=>{const x={...p,rtRef:null,rk:null,price:200},peer={...p,spId:2,name:'다른 선수',price:100,avg:6.7,wr:.7};const q=ctx.dAssessPlayer(x,[x,peer]);assert.equal(q.action,'교체 검토');assert.match(q.reason,/가격 효율 검토/)});
test('prices use exact grade from stored BP array, never guess or substitute',()=>{const L={price:[3500000,3500000,3830000,4250000,6630000,13600000,45400000,368000000,542000000,1420000000,29600000000,45900000000,147000000000]};assert.equal(ctx.dExactPrice(L,9),542000000);assert.equal(ctx.dExactPrice(L,10),1420000000);assert.equal(ctx.dExactPrice({price:[500]},9),null);assert.equal(ctx.dExactPrice(L,0),null);assert.equal(ctx.dExactPrice(L,14),null);assert.equal(ctx.dExactPrice({price:[0]},1),null)});
const players=Array.from({length:11},(_,i)=>({spId:i+1}));const mk=(a,b)=>({names:['A','B'],cards:Object.fromEntries(players.map((p,i)=>[p.spId,[...(i<a?[0]:[]),...(i>=11-b?[1]:[])]]))});
test('one strong representative; ties, weak and near ties excluded',()=>{assert.equal(ctx.dInferTeamcolor(players,mk(9,4)).name,'A');assert.equal(ctx.dInferTeamcolor(players,mk(8,8)),null);assert.equal(ctx.dInferTeamcolor(players,mk(7,6)),null);assert.equal(ctx.dInferTeamcolor(players,mk(5,4)),null);assert.equal(ctx.dInferTeamcolor(players.slice(0,7),mk(9,4)),null);assert.equal(ctx.dInferTeamcolor(players,mk(11,9)).confidence,'매우 높음')});
test('each match counted once and no single-match ranking',()=>{const match={matchInfo:[{matchDetail:{matchResult:'승'}},{player:players}]};const TC=mk(9,4);assert.equal(ctx.dTeamcolorStats([match],TC).all.length,0);const result=ctx.dTeamcolorStats([match,match],TC);assert.equal(result.all.length,1);assert.equal(result.all[0].n,2);assert.equal(result.valid.length,2)});
