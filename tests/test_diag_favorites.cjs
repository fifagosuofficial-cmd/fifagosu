// Run: node --test tests/test_diag_favorites.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../site/assets/js/app.js'),'utf8');
const start=src.indexOf('function dMergeFavorites('),end=src.indexOf('function dFavoriteButton(',start);
assert.ok(start>=0&&end>start);
function setup(initial,legacy){const state=JSON.parse(JSON.stringify(initial));let renders=0;const ctx={dRead:()=>state,dWrite:v=>Object.assign(state,v),dStore:fn=>fn(state),ls:()=>JSON.stringify(legacy),dCur:{d:{basic:{nickname:'New'}}},dRenderQuick:()=>renders++};vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);return {state,ctx,renders:()=>renders}}
test('migrate production favorites without duplicates, preserve other data, never reimport removed names',()=>{const {state,ctx}=setup({favs:[{nick:'New',at:'2026-11-24'}],assets:{keep:1}},['new',' Old ','OLD','']);ctx.dMigrateFavorites();assert.equal(JSON.stringify(state.favs),'[{"nick":"New","at":"2026-11-24"},{"nick":"Old","at":""}]');assert.equal(state.assets.keep,1);ctx.dChangeFavorite('old',true);ctx.dMigrateFavorites();assert.equal(state.favs.length,1);assert.equal(ctx.dIsFavorite('NEW'),true)});
test('toggle, remove-only and ten-item limit',()=>{const {state,ctx,renders}=setup({},Array.from({length:12},(_,i)=>'Nick'+i));ctx.dMigrateFavorites();assert.equal(state.favs.length,10);ctx.dChangeFavorite('New');assert.equal(state.favs[0].nick,'New');assert.equal(state.favs.length,10);ctx.dChangeFavorite('new');assert.equal(ctx.dIsFavorite('New'),false);ctx.dChangeFavorite('missing',true);assert.equal(state.favs.length,9);assert.equal(renders(),3)});

test('favorites are a collapsed search-row menu; no persistent card and all actions retained',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../site/templates/index.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../site/assets/css/main.css'),'utf8');
 const form=html.slice(html.indexOf('id="dForm"'),html.indexOf('</form>',html.indexOf('id="dForm"')));
 assert.match(form,/<details id="dQuick" class="dquick-menu">/);
 assert.match(form,/<summary class="dquick-trigger"/);
 for(const id of ['dFavs','dFavCount','dFav','dMine','dShare','dUpdated'])assert.ok(form.includes('id="'+id+'"'));
 assert.ok(!html.includes('<div class="dquick" id="dQuick"'));
 assert.match(css,/\.dquick-menu:not\(\[open\]\)>\.dquick-popover\{display:none\}/);
 assert.match(css,/\.dquick-popover\{position:absolute/);
 assert.ok(src.includes("menu.open=false")&&src.includes("countEl.hidden=n===0"));
});
