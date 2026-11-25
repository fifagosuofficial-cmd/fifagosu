const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../site/assets/js/ads.js"),"utf8");
function run(width,outerRect,contentRect,preview=true,view=""){
 const props={},events={};const slots=["side-left","side-right","news-1"].map(name=>{const classes=new Set(name.startsWith("side")?["fg-ad-rail"]:["slot"]);return {dataset:{adSlot:name},hidden:true,parentElement:{closest:()=>null},classList:{contains:k=>classes.has(k),toggle:(k,v)=>v?classes.add(k):classes.delete(k)}}});
 const main={hidden:false,getClientRects:()=>[contentRect],getBoundingClientRect:()=>contentRect};
 const layout={querySelectorAll:s=>s===":scope > main"?[main]:slots,getBoundingClientRect:()=>outerRect,style:{setProperty:(k,v)=>props[k]=v}};
 const document={querySelector:()=>layout,documentElement:{clientWidth:width},body:{dataset:{view}},addEventListener:(n,f)=>events[n]=f};
 vm.runInNewContext(source,{window:{FG_AD_CONFIG:{enabled:false},addEventListener:(n,f)=>events[n]=f},document,location:{pathname:"/news/",search:preview?"?ad-preview=1":""},URLSearchParams,WeakSet});
 return {slots,props};
}
test("preview rails use actual content instead of wide outer wrapper",()=>{const r=run(1600,{left:80,right:1520},{left:260,right:1340});assert.deepEqual(r.slots.map(x=>x.hidden),[false,false,false]);assert.equal(r.props["--ad-left"],"8px");assert.equal(r.props["--ad-right"],"1272px")});
test("narrow and full-width pages hide side rails without hiding central preview",()=>{for(const r of [run(1000,{left:10,right:990},{left:200,right:800}),run(1600,{left:80,right:1520},{left:80,right:1520})])assert.deepEqual(r.slots.map(x=>x.hidden),[true,true,false])});
test("normal visitors see no placeholder while ads disabled",()=>{assert.deepEqual(run(1920,{left:240,right:1680},{left:420,right:1500},false).slots.map(x=>x.hidden),[true,true,true])});

test("KickKick rails use smaller desktop threshold but never overlap mobile",()=>{const r=run(1000,{left:204,right:796},{left:220,right:780},true,"fun");assert.deepEqual(r.slots.map(x=>x.hidden),[false,false,false]);assert.equal(r.props["--ad-left"],"-168px");assert.equal(r.props["--ad-right"],"600px");assert.deepEqual(run(390,{left:0,right:390},{left:16,right:374},true,"fun").slots.map(x=>x.hidden),[true,true,false]);});
