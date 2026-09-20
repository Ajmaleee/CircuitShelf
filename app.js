"use strict";
/* ============================================================
   FIREBASE — project circuitshelf-d7fb5
   ============================================================ */
const FIREBASE={
  apiKey:"AIzaSyDYsiJ_jIGJ7ftkAZSPTmFYynOFM7lYUkw",
  authDomain:"circuitshelf-d7fb5.firebaseapp.com",
  projectId:"circuitshelf-d7fb5",
  storageBucket:"circuitshelf-d7fb5.firebasestorage.app",
  messagingSenderId:"1021056105495",
  appId:"1:1021056105495:web:eb6481640dbab0eaa33052",
  measurementId:"G-780FQDRMZH"
};
const SDK="https://www.gstatic.com/firebasejs/10.12.2/";

/* ============================================================
   0. store
   ============================================================ */
const KEY="parts.v1", CFG="parts.cfg.v1";
const DEFAULT_CATS=["Sensor","Module","Board","Actuator","Display","Power","Passive","Connector","Tool","Other"];
const STATUSES=["working","faulty","untested"];
const LABEL={working:"Working",faulty:"Not working",untested:"Untested"};
const CURRENCIES=["INR","USD","EUR","GBP","JPY","AUD","CAD","SGD","AED","BRL","ZAR"];
const THEME0={bg:"#e6e6e6",ink:"#16171a",ok:"#2f7d5e",bad:"#b0412c",unk:"#7b7f87",warn:"#96631f"};
const PRESETS=[
  ["Graphite",THEME0],
  ["Fog",{bg:"#dee3e7",ink:"#151a1f",ok:"#2c6f63",bad:"#a53f34",unk:"#6f7c85",warn:"#8c6420"}],
  ["Sand",{bg:"#e9e3d8",ink:"#21190f",ok:"#4a6b32",bad:"#a2402a",unk:"#7d7362",warn:"#8a6216"}],
  ["Mint",{bg:"#dfe9e3",ink:"#0f1a15",ok:"#1f7355",bad:"#a53f3f",unk:"#6d7d75",warn:"#836420"}],
  ["Blush",{bg:"#ece0e2",ink:"#1d1416",ok:"#3f7358",bad:"#ab3752",unk:"#7f6f73",warn:"#8e5f27"}],
  ["Steel",{bg:"#d9dde3",ink:"#11151c",ok:"#2a6a6d",bad:"#a33f3a",unk:"#6c7480",warn:"#82631f"}],
  ["Carbon",{bg:"#2b2d31",ink:"#f1f2f4",ok:"#6fd3a5",bad:"#ff8b70",unk:"#a7adb7",warn:"#f0bd6a"}]
];

const safeGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){return false}};

let items=[], cfg={sort:"recent",cur:"INR",cats:DEFAULT_CATS.slice(),theme:Object.assign({},THEME0),vault:"",check:"",askAlways:false,last:0};
try{ const r=safeGet(KEY); if(r) items=JSON.parse(r)||[]; }catch(e){ items=[]; }
try{ const r=safeGet(CFG); if(r) cfg=Object.assign(cfg,JSON.parse(r)||{}); }catch(e){}
if(!Array.isArray(items)) items=[];
if(!Array.isArray(cfg.cats)||!cfg.cats.length) cfg.cats=DEFAULT_CATS.slice();
cfg.theme=Object.assign({},THEME0,cfg.theme||{});
items.forEach(i=>{ if(!Array.isArray(i.tags)) i.tags=[]; });

const persist=()=>{ safeSet(KEY,JSON.stringify(items)); safeSet(CFG,JSON.stringify(cfg)); };
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* photos in IndexedDB */
const MEDIA="parts-media";
function openDB(){return new Promise((res,rej)=>{
  const r=indexedDB.open(MEDIA,1);
  r.onupgradeneeded=()=>{ if(!r.result.objectStoreNames.contains("photos")) r.result.createObjectStore("photos"); };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });}
async function photoGet(id){ try{ const d=await openDB(); return await new Promise((res,rej)=>{
  const q=d.transaction("photos").objectStore("photos").get(id); q.onsuccess=()=>res(q.result||null); q.onerror=()=>rej(); }); }catch(e){ return null } }
async function photoPut(id,v){ try{ const d=await openDB(); return await new Promise((res,rej)=>{
  const t=d.transaction("photos","readwrite"); t.objectStore("photos").put(v,id); t.oncomplete=()=>res(true); t.onerror=()=>rej(); }); }catch(e){ return false } }
async function photoDel(id){ try{ const d=await openDB(); return await new Promise(res=>{
  const t=d.transaction("photos","readwrite"); t.objectStore("photos").delete(id); t.oncomplete=()=>res(true); t.onerror=()=>res(false); }); }catch(e){ return false } }
async function photoAll(){ const out={}; for(const i of items){ if(i.photo){ const p=await photoGet(i.id); if(p) out[i.id]=p; } } return out; }

function shrink(file,max){
  max=max||900;
  return new Promise((res,rej)=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      const s=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement("canvas");
      c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg",.74));
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); rej(); };
    img.src=url;
  });
}

/* ============================================================
   1. spring — snappier, tighter overshoot
   ============================================================ */
function spring(from,to,onUpdate,opts){
  opts=opts||{};
  const stiffness=opts.stiffness||340, damping=opts.damping||29, mass=opts.mass||1;
  let x=from, v=opts.velocity||0, raf=0, last=performance.now(), done=false;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){ onUpdate(to); opts.onDone&&opts.onDone(); return {stop(){}}; }
  function tick(now){
    let dt=Math.min((now-last)/1000,.032); last=now;
    for(let i=0;i<2;i++){ const a=(-stiffness*(x-to)-damping*v)/mass; v+=a*(dt/2); x+=v*(dt/2); }
    if(Math.abs(x-to)<.2&&Math.abs(v)<.9){ x=to; onUpdate(x); done=true; opts.onDone&&opts.onDone(); return; }
    onUpdate(x); raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);
  return { stop(){ if(!done) cancelAnimationFrame(raf); } };
}
const rubber=(x,dim,c)=>{ c=c||.5; return (1-(1/((Math.abs(x)*c/dim)+1)))*dim*Math.sign(x); };
const tap=ms=>{ try{ navigator.vibrate&&navigator.vibrate(ms||8) }catch(e){} };

/* ============================================================
   2. helpers
   ============================================================ */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const money=n=>{
  if(n==null||n==="") return "";
  const v=Number(n); if(!isFinite(v)) return "";
  try{ return new Intl.NumberFormat(navigator.language,{style:"currency",currency:cfg.cur||"INR",maximumFractionDigits:v%1?2:0}).format(v) }
  catch(e){ return v.toFixed(2) }
};
function when(iso){
  if(!iso) return "";
  const d=new Date(iso+"T00:00:00"), n=new Date(); n.setHours(0,0,0,0);
  const days=Math.round((n-d)/86400000);
  if(days===0) return "Today"; if(days===1) return "Yesterday";
  if(days>0&&days<7) return days+" days ago";
  if(days<0) return "in "+Math.abs(days)+" days";
  return d.toLocaleDateString(navigator.language,{day:"numeric",month:"short",year:d.getFullYear()===n.getFullYear()?undefined:"2-digit"});
}
const isLow=i=>Number(i.min)>0&&Number(i.qty||0)<=Number(i.min);
const isLent=i=>!!(i.lentTo&&String(i.lentTo).trim());
const overdue=i=>isLent(i)&&i.lentDue&&i.lentDue<today();
const host=u=>{ try{ return new URL(u).hostname.replace(/^www\./,"") }catch(e){ return "Link" } };

function guessType(name){
  const s=name.toLowerCase();
  if(/uno|nano|mega|leonardo|esp32|esp8266|pico|teensy|devkit|rp2040|stm32/.test(s)) return "Board";
  if(/sensor|dht|ds18|bmp|bme|mpu|hc-sr|ultrason|pir|ldr|photoresist|gas|mq-|hall|flame|soil|ir receiver|load cell|encoder/.test(s)) return "Sensor";
  if(/servo|motor|relay|pump|solenoid|buzzer|speaker|fan|stepper|actuator|vibrat/.test(s)) return "Actuator";
  if(/oled|lcd|tft|display|segment|matrix|e-?ink|screen/.test(s)) return "Display";
  if(/battery|regulator|buck|boost|charger|power|18650|supply|solar|ups/.test(s)) return "Power";
  if(/resistor|capacitor|diode|transistor|led|inductor|crystal|potentiometer|mosfet|zener|fuse/.test(s)) return "Passive";
  if(/jumper|header|breadboard|wire|connector|terminal|dupont|jst|cable|usb/.test(s)) return "Connector";
  if(/iron|multimeter|solder|tweezer|cutter|stripper|oscillo|tool/.test(s)) return "Tool";
  return cfg.cats.includes("Module")?"Module":cfg.cats[0];
}
function matchType(raw){
  const r=String(raw).toLowerCase();
  return cfg.cats.find(x=>x.toLowerCase()===r)||cfg.cats.find(x=>x.toLowerCase().startsWith(r))||"";
}

/* ============================================================
   3. theme
   ============================================================ */
function hexToRgb(h){
  h=String(h||"").replace("#","");
  if(h.length===3) h=h.split("").map(c=>c+c).join("");
  const n=parseInt(h||"e6e6e6",16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function applyTheme(){
  const t=cfg.theme, r=document.documentElement.style;
  r.setProperty("--bg",hexToRgb(t.bg).join(","));
  r.setProperty("--ink",t.ink);
  r.setProperty("--ok",t.ok); r.setProperty("--bad",t.bad);
  r.setProperty("--unk",t.unk); r.setProperty("--warn",t.warn);
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=t.bg;
}
function sameTheme(a,b){ return Object.keys(THEME0).every(k=>String(a[k]).toLowerCase()===String(b[k]).toLowerCase()); }
function paintSettingsTheme(){
  $("#swatches").innerHTML=PRESETS.map(([name,t],n)=>
    `<button class="sw" data-p="${n}" title="${esc(name)}" aria-label="${esc(name)} palette"
      style="background:${t.bg}" aria-pressed="${sameTheme(cfg.theme,t)}"><i style="background:${t.ok}"></i></button>`).join("");
  $("#c-bg").value=cfg.theme.bg; $("#c-ink").value=cfg.theme.ink;
  $("#c-ok").value=cfg.theme.ok; $("#c-bad").value=cfg.theme.bad;
  $("#c-unk").value=cfg.theme.unk; $("#c-warn").value=cfg.theme.warn;
}
applyTheme();

/* ============================================================
   4. render
   ============================================================ */
let filter="all", query="", openRow=null;
const FILTERS=[["all","All"],["working","Working"],["faulty","Not working"],["untested","Untested"]];
const SORTS=[["recent","Newest first"],["oldest","Oldest first"],["name","By name"],["qty","Most stock first"],["value","Highest value first"],["group","Grouped by category"]];

function buildFilters(){
  const cats=[...new Set(items.map(i=>i.type).filter(Boolean))].sort();
  const tags=[...new Set(items.flatMap(i=>i.tags||[]))].sort().slice(0,14);
  let all=FILTERS.slice();
  if(items.some(isLow)) all.push(["low","Low stock"]);
  if(items.some(isLent)) all.push(["lent","Lent out"]);
  all=all.concat(cats.map(t=>["t:"+t,t]),tags.map(t=>["g:"+t,t]));
  $("#filters").innerHTML=all.map(([v,l])=>
    `<button class="chip${v==="low"||v==="lent"?" alert":""}" data-f="${esc(v)}" aria-pressed="${v===filter}">${esc(l)}</button>`).join("");
}
function visible(){
  const q=query.trim().toLowerCase();
  const out=items.filter(i=>{
    if(filter==="low"){ if(!isLow(i)) return false; }
    else if(filter==="lent"){ if(!isLent(i)) return false; }
    else if(filter.startsWith("t:")){ if(i.type!==filter.slice(2)) return false; }
    else if(filter.startsWith("g:")){ if(!(i.tags||[]).includes(filter.slice(2))) return false; }
    else if(filter!=="all"&&i.status!==filter) return false;
    if(!q) return true;
    return (i.name+" "+(i.type||"")+" "+(i.box||"")+" "+(i.note||"")+" "+(i.pins||"")+" "+(i.lentTo||"")+" "+(i.tags||[]).join(" ")).toLowerCase().includes(q);
  });
  const s=cfg.sort;
  out.sort((a,b)=>
    s==="name"||s==="group" ? a.name.localeCompare(b.name)
    : s==="qty" ? (Number(b.qty)||0)-(Number(a.qty)||0)
    : s==="value" ? ((Number(b.price)||0)*(Number(b.qty)||1))-((Number(a.price)||0)*(Number(a.qty)||1))
    : s==="oldest" ? (a.date||"").localeCompare(b.date||"")||a.created-b.created
    : (b.date||"").localeCompare(a.date||"")||b.created-a.created);
  return out;
}
function stats(){
  const c={working:0,faulty:0,untested:0}; let val=0;
  items.forEach(i=>{ c[i.status]=(c[i.status]||0)+(Number(i.qty)||1); if(i.price) val+=Number(i.price)*(Number(i.qty)||1); });
  $("#nOk").textContent=c.working; $("#nBad").textContent=c.faulty; $("#nUnk").textContent=c.untested;
  $("#nVal").textContent=val?money(val):"—";
  const n=items.length, low=items.filter(isLow).length, lent=items.filter(isLent).length;
  $("#sub").textContent=!n?"Nothing catalogued yet":`${n} part${n>1?"s":""}${low?` · ${low} low`:""}${lent?` · ${lent} lent out`:""}`;
  $("#expCount").textContent=n+" part"+(n===1?"":"s");
}

function cardHTML(i){
  return `<article class="row" data-id="${i.id}">
    <div class="row-actions">
      <button class="act edit" data-act="edit"><svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M12.2 2.8a1.7 1.7 0 0 1 2.4 2.4l-8 8-3.2.8.8-3.2 8-8Z" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>Edit</button>
      <button class="act copy" data-act="copy"><svg width="15" height="15" viewBox="0 0 18 18" fill="none"><rect x="6.2" y="6.2" width="8.6" height="8.6" rx="2.2" stroke="#fff" stroke-width="1.5"/><path d="M11.8 6.2V5.4a2 2 0 0 0-2-2H5.2a2 2 0 0 0-2 2V10a2 2 0 0 0 2 2H6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>Copy</button>
      <button class="act del" data-act="del"><svg width="15" height="15" viewBox="0 0 18 18" fill="none"><path d="M3.6 4.8h10.8M7.2 4.8V3.4h3.6v1.4M5 4.8l.7 9.1h6.6l.7-9.1" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Delete</button>
    </div>
    <div class="lgc card"><span class="lg-edge"></span>
      ${i.photo
        ? `<img class="thumb" data-act="photo" data-ph="${i.id}" alt="${esc(i.name)}">`
        : `<span class="thumb ph" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 3v3.5M14.5 3v3.5M7.5 15.5V19M14.5 15.5V19M3 7.5h3.5M3 14.5h3.5M15.5 7.5H19M15.5 14.5H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>`}
      <div class="main">
        <div class="name">${esc(i.name)}</div>
        <div class="meta">
          ${i.type?`<span class="tag">${esc(i.type)}</span>`:""}
          ${Number(i.qty)!==1?`<span class="tag qty">×${Number(i.qty)||0}</span>`:""}
          ${isLow(i)?`<span class="tag low">Low stock</span>`:""}
          ${isLent(i)?`<span class="tag lent">${overdue(i)?"Overdue · ":""}Lent to ${esc(i.lentTo)}${Number(i.lentQty)>1?` ×${Number(i.lentQty)}`:""}</span>`:""}
          ${i.box?`<span class="tag">${esc(i.box)}</span>`:""}
          ${(i.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}
          ${i.url?`<button class="tag link" data-act="link" data-url="${esc(i.url)}">${esc(host(i.url))}
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2.5 7.5 7.5 2.5M4 2.5h3.5V6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:""}
          <em>${esc(when(i.date))}</em>
        </div>
        ${i.note?`<div class="note">${esc(i.note)}</div>`:""}
        ${i.pins?`<div class="pins">${esc(i.pins)}</div>`:""}
      </div>
      <div class="right">
        <button class="status ${i.status}" data-act="cycle"><i></i>${LABEL[i.status]}</button>
        ${i.price?`<div class="price">${esc(money(i.price))}</div>`:""}
      </div>
    </div>
  </article>`;
}
function render(){
  const list=$("#list"), rows=visible();
  openRow=null;
  if(!rows.length){
    list.innerHTML=`<div class="lg empty"><span class="lg-edge"></span>
      <h2>${items.length?"No matches":"Start your inventory"}</h2>
      <p>${items.length?"Try a different word, or clear the filter.":"Catalogue the sensors, modules and boards on your bench so you stop rediscovering them."}</p>
      ${items.length?"":`<div class="mini"><button id="emptyAdd">Add a part</button><button id="emptySeed">Load a starter kit</button></div>`}</div>`;
    if(!items.length){ $("#emptyAdd").onclick=()=>edit(null); $("#emptySeed").onclick=seed; }
  }else if(cfg.sort==="group"){
    const g={};
    rows.forEach(i=>{ (g[i.type||"Other"]=g[i.type||"Other"]||[]).push(i) });
    list.innerHTML=Object.keys(g).sort().map(k=>`<div class="sec">${esc(k)}<b>${g[k].length}</b></div>`+g[k].map(cardHTML).join("")).join("");
  }else{
    list.innerHTML=rows.map(cardHTML).join("");
  }
  [...list.querySelectorAll(".row")].forEach((r,n)=>{ r.style.animationDelay=Math.min(n*34,220)+"ms" });
  stats(); buildFilters(); loadThumbs();
}
async function loadThumbs(){
  for(const el of [...document.querySelectorAll(".thumb[data-ph]")]){
    const src=await photoGet(el.dataset.ph);
    if(src) el.src=src; else el.remove();
  }
}

/* ============================================================
   5. row gestures
   ============================================================ */
const SNAP=-196;
function closeRow(row,vel){
  if(!row) return;
  const card=row.querySelector(".card"); if(!card) return;
  card.classList.add("dragging");
  spring(Number(card.dataset.x||0),0,v=>{card.dataset.x=v;card.style.transform=`translate3d(${v}px,0,0)`},{stiffness:420,damping:34,velocity:vel||0,onDone(){card.classList.remove("dragging")}});
  row.dataset.open=""; if(openRow===row) openRow=null;
}
function openRowTo(row,vel){
  const card=row.querySelector(".card");
  card.classList.add("dragging");
  spring(Number(card.dataset.x||0),SNAP,v=>{card.dataset.x=v;card.style.transform=`translate3d(${v}px,0,0)`},{stiffness:420,damping:36,velocity:vel||0,onDone(){card.classList.remove("dragging")}});
  row.dataset.open="1"; openRow=row; tap(6);
}
(function rowGestures(){
  let row=null,card=null,x0=0,y0=0,base=0,dx=0,mode="",lastX=0,lastT=0,vel=0,raf=0,pendingV=null;
  const list=$("#list");
  function flush(){
    raf=0;
    if(pendingV==null||!card) return;
    card.dataset.x=pendingV; card.style.transform=`translate3d(${pendingV}px,0,0)`;
    pendingV=null;
  }
  list.addEventListener("pointerdown",e=>{
    const r=e.target.closest(".row"); if(!r||e.target.closest(".act")) return;
    row=r; card=r.querySelector(".card"); base=Number(card.dataset.x||0);
    x0=e.clientX; y0=e.clientY; lastX=e.clientX; lastT=performance.now(); mode=""; dx=base; vel=0;
    card.classList.add("press");
  },{passive:true});
  list.addEventListener("pointermove",e=>{
    if(!row) return;
    const ddx=e.clientX-x0, ddy=e.clientY-y0;
    if(!mode){
      if(Math.abs(ddx)>7&&Math.abs(ddx)>Math.abs(ddy)*1.3){ mode="x"; card.classList.remove("press"); card.classList.add("dragging"); if(openRow&&openRow!==row) closeRow(openRow); }
      else if(Math.abs(ddy)>7){ mode="y"; card.classList.remove("press"); }
      else return;
    }
    if(mode!=="x") return;
    e.preventDefault();
    let v=base+ddx;
    if(v>0) v=rubber(v,110,.45);
    else if(v<SNAP) v=SNAP+rubber(v-SNAP,130,.45);
    dx=v; pendingV=v;
    if(!raf) raf=requestAnimationFrame(flush);
    const now=performance.now(), dt=now-lastT;
    if(dt>0){ vel=(e.clientX-lastX)/dt*1000; lastX=e.clientX; lastT=now; }
  },{passive:false});
  function end(e){
    if(!row) return;
    if(raf){ cancelAnimationFrame(raf); raf=0; flush(); }
    card.classList.remove("press");
    const r=row, wasMode=mode, moved=Math.abs(e.clientX-x0)+Math.abs(e.clientY-y0);
    row=null; card=null; mode="";
    if(wasMode==="x"){ if((dx<SNAP/2||vel<-260)&&vel<620) openRowTo(r,vel); else closeRow(r,vel); return; }
    if(wasMode||moved>10) return;
    const act=e.target.closest("[data-act]");
    if(openRow&&openRow!==r){ closeRow(openRow); return; }
    if(openRow===r){ closeRow(r); return; }
    if(act&&act.dataset.act==="cycle"){ cycle(r.dataset.id,act); return; }
    if(act&&act.dataset.act==="photo"){ showPhoto(act.src); return; }
    if(act&&act.dataset.act==="link"){ window.open(act.dataset.url,"_blank","noopener"); return; }
    edit(r.dataset.id);
  }
  list.addEventListener("pointerup",end);
  list.addEventListener("pointercancel",()=>{ if(row){ const r=row; row=null; card.classList.remove("press"); card=null; mode=""; closeRow(r); } });
  list.addEventListener("click",e=>{
    const a=e.target.closest(".act"); if(!a) return;
    const r=e.target.closest(".row"), id=r.dataset.id;
    closeRow(r);
    if(a.dataset.act==="edit") edit(id);
    else if(a.dataset.act==="copy") duplicate(id);
    else remove(id);
  });
})();

function cycle(id,btn){
  const it=items.find(i=>i.id===id); if(!it) return;
  it.status=STATUSES[(STATUSES.indexOf(it.status)+1)%3];
  it.updated=Date.now(); persist(); queueSync();
  btn.className="status "+it.status; btn.innerHTML="<i></i>"+LABEL[it.status];
  spring(1,0,v=>{btn.style.transform=`scale(${1+v*.05})`},{stiffness:600,damping:20,onDone(){btn.style.transform=""}});
  tap(9); stats();
  if(["working","faulty","untested"].includes(filter)) setTimeout(render,220);
}
async function duplicate(id){
  const src=items.find(i=>i.id===id); if(!src) return;
  const copy=Object.assign({},src,{id:uid(),created:Date.now(),updated:Date.now(),date:today(),tags:(src.tags||[]).slice(),lentTo:"",lentQty:0,lentOn:"",lentDue:"",lentNote:""});
  if(src.photo){ const p=await photoGet(src.id); if(p) await photoPut(copy.id,p); }
  items.unshift(copy); persist(); queueSync(); render(); tap(10);
  toast("Copied "+src.name,"Edit",()=>edit(copy.id));
}
function remove(id){
  const idx=items.findIndex(i=>i.id===id); if(idx<0) return;
  const gone=items[idx], row=$(`.row[data-id="${id}"]`);
  items.splice(idx,1); persist(); queueSync(); tap(12);
  if(row){
    row.style.transition="opacity 160ms ease,transform 220ms var(--ease-out),height 220ms var(--ease-out),margin 220ms var(--ease-out)";
    row.style.height=row.offsetHeight+"px"; row.getBoundingClientRect();
    row.style.opacity="0"; row.style.transform="translate3d(-36px,0,0) scale(.97)"; row.style.height="0"; row.style.marginBottom="-10px";
    setTimeout(render,210);
  } else render();
  toast("Deleted "+gone.name,"Undo",()=>{ items.splice(Math.min(idx,items.length),0,gone); persist(); queueSync(); render(); });
  if(remote()) deleteRemote(id);
}

/* ============================================================
   6. sheets
   ============================================================ */
const scrim=$("#scrim");
let activeSheet=null, editingId=null, draftStatus="working", draftPhoto=undefined;

function openSheet(el){
  if(activeSheet&&activeSheet!==el) closeSheet();
  activeSheet=el; el.classList.add("anim"); scrim.classList.add("open");
  el.style.transform=""; requestAnimationFrame(()=>el.classList.add("open"));
  document.body.style.overflow="hidden";
}
function closeSheet(vel){
  const el=activeSheet; if(!el) return;
  activeSheet=null; scrim.classList.remove("open"); document.body.style.overflow="";
  const h=el.offsetHeight, cur=Number(el.dataset.y||0);
  if(vel){
    el.classList.remove("anim");
    spring(cur,h,v=>{el.style.transform=`translate(-50%,${v}px)`},{stiffness:340,damping:38,velocity:vel,onDone(){
      el.classList.remove("open"); el.dataset.y=0; el.style.transform=""; el.classList.add("anim"); }});
  }else{
    el.classList.add("anim"); el.style.transform=""; el.classList.remove("open"); el.dataset.y=0;
  }
  if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
}
scrim.addEventListener("click",()=>closeSheet());

function sheetDrag(sheet){
  let y0=0,dragging=false,lastY=0,lastT=0,vel=0;
  const body=sheet.querySelector(".sheet-body");
  sheet.addEventListener("pointerdown",e=>{
    if(e.target.closest("input,textarea,select,button")&&!e.target.closest(".grip")) return;
    if(body.contains(e.target)&&body.scrollTop>0) return;
    dragging=true; y0=e.clientY; lastY=e.clientY; lastT=performance.now(); vel=0; sheet.classList.remove("anim");
  },{passive:true});
  sheet.addEventListener("pointermove",e=>{
    if(!dragging) return;
    let d=e.clientY-y0;
    if(d<0) d=rubber(d,70,.4);
    sheet.dataset.y=d; sheet.style.transform=`translate(-50%,${d}px)`;
    const now=performance.now(), dt=now-lastT;
    if(dt>0){ vel=(e.clientY-lastY)/dt*1000; lastY=e.clientY; lastT=now; }
    if(d>2) e.preventDefault();
  },{passive:false});
  const end=()=>{
    if(!dragging) return; dragging=false;
    const d=Number(sheet.dataset.y||0), h=sheet.offsetHeight;
    if(d>h*.28||vel>480) closeSheet(vel||620);
    else spring(d,0,v=>{sheet.dataset.y=v;sheet.style.transform=`translate(-50%,${v}px)`},
      {stiffness:420,damping:34,velocity:vel,onDone(){sheet.style.transform="";sheet.dataset.y=0;sheet.classList.add("anim")}});
  };
  sheet.addEventListener("pointerup",end); sheet.addEventListener("pointercancel",end);
}
["#sheet","#sheet2","#sheetBulk","#sheetStats"].forEach(s=>sheetDrag($(s)));

/* ---------- generic ask dialog ---------- */
let askResolve=null;
function askText(title,placeholder,value){
  $("#dlgTitle").textContent=title;
  $("#dlgInput").placeholder=placeholder||""; $("#dlgInput").value=value||"";
  $("#dlg").classList.add("on");
  setTimeout(()=>$("#dlgInput").focus(),180);
  return new Promise(r=>{ askResolve=r; });
}
function askClose(v){ $("#dlg").classList.remove("on"); if(askResolve){ askResolve(v); askResolve=null; } }
$("#dlgNo").addEventListener("click",()=>askClose(null));
$("#dlgYes").addEventListener("click",()=>askClose($("#dlgInput").value.trim()||null));
$("#dlgInput").addEventListener("keydown",e=>{ if(e.key==="Enter") askClose($("#dlgInput").value.trim()||null); });
$("#dlg").addEventListener("click",e=>{ if(e.target.id==="dlg") askClose(null); });

/* ---------- categories ---------- */
const NEWCAT="__new__";
function buildCatSelect(sel){
  $("#f-type").innerHTML=cfg.cats.map(c=>`<option${c===sel?" selected":""}>${esc(c)}</option>`).join("")
    +`<option value="${NEWCAT}">＋ New category…</option>`;
}
$("#f-type").addEventListener("change",async e=>{
  if(e.target.value!==NEWCAT) return;
  const name=await askText("New category","e.g. RF modules");
  if(name&&!cfg.cats.includes(name)){ cfg.cats.push(name); persist(); buildCatSelect(name); paintCats(); toast("Added "+name); }
  else buildCatSelect(cfg.cats[0]);
});
function paintCats(){
  $("#catList").innerHTML=cfg.cats.map(c=>{
    const used=items.filter(i=>i.type===c).length;
    return `<span class="cat">${esc(c)}<button data-cat="${esc(c)}" aria-label="Remove ${esc(c)}">×</button></span>`;
  }).join("");
}
$("#catList").addEventListener("click",e=>{
  const b=e.target.closest("[data-cat]"); if(!b) return;
  const c=b.dataset.cat, used=items.filter(i=>i.type===c).length;
  if(used){ toast(`${used} part${used>1?"s use":" uses"} ${c}`); return; }
  if(cfg.cats.length<2){ toast("Keep at least one category"); return; }
  cfg.cats=cfg.cats.filter(x=>x!==c); persist(); paintCats(); buildCatSelect(); tap(8);
});
$("#addCat").addEventListener("click",async ()=>{
  const name=await askText("New category","e.g. RF modules");
  if(name&&!cfg.cats.includes(name)){ cfg.cats.push(name); persist(); paintCats(); buildCatSelect(); toast("Added "+name); }
});

/* ---------- editor ---------- */
$("#f-cur").innerHTML=CURRENCIES.map(c=>`<option${c===cfg.cur?" selected":""}>${c}</option>`).join("");
$("#f-cur").addEventListener("change",e=>{ cfg.cur=e.target.value; persist(); render(); });

function setStatus(v){
  draftStatus=v;
  $("#f-status").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===v)));
}
$("#f-status").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b){ setStatus(b.dataset.v); tap(6);} });
$("#qtyUp").addEventListener("click",()=>{ $("#f-qty").value=(Number($("#f-qty").value)||0)+1; tap(5); });
$("#qtyDown").addEventListener("click",()=>{ $("#f-qty").value=Math.max(0,(Number($("#f-qty").value)||0)-1); tap(5); });

const CAM=`<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><rect x="2.5" y="6" width="21" height="15" rx="4" stroke="currentColor" stroke-width="1.6"/><circle cx="13" cy="13.5" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M9 6l1.4-2.2h5.2L17 6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
function setPhotoPreview(src){
  const box=$("#photoBox");
  if(src){ box.innerHTML=""; box.style.cssText="background-image:url("+src+");background-size:cover;background-position:center";
    $("#photoDel").classList.remove("hidden"); $("#photoPick").textContent="Replace photo"; }
  else{ box.style.cssText=""; box.innerHTML=CAM; $("#photoDel").classList.add("hidden"); $("#photoPick").textContent="Take or choose photo"; }
}
setPhotoPreview(null);
$("#photoPick").addEventListener("click",()=>$("#photoFile").click());
$("#photoBox").addEventListener("click",()=>{ if(draftPhoto) showPhoto(draftPhoto); else $("#photoFile").click(); });
$("#photoDel").addEventListener("click",()=>{ draftPhoto=null; setPhotoPreview(null); tap(8); });
$("#photoFile").addEventListener("change",async e=>{
  const f=e.target.files&&e.target.files[0]; e.target.value="";
  if(!f) return;
  try{ draftPhoto=await shrink(f); setPhotoPreview(draftPhoto); tap(10); }catch(err){ toast("Couldn't read that image"); }
});
$("#returnBtn").addEventListener("click",()=>{
  $("#f-lent").value=""; $("#f-lentqty").value=""; $("#f-lenton").value=""; $("#f-lentdue").value=""; $("#f-lentnote").value="";
  $("#returnBtn").classList.add("hidden"); tap(10); toast("Marked returned — save to confirm");
});

async function edit(id){
  const it=id?items.find(i=>i.id===id):null;
  editingId=it?it.id:null;
  buildCatSelect(it&&it.type?it.type:cfg.cats[0]);
  $("#sheetTitle").textContent=it?"Edit part":"New part";
  $("#f-name").value=it?it.name:"";
  $("#f-qty").value=it?(it.qty!=null?it.qty:1):1;
  $("#f-min").value=it&&it.min?it.min:"";
  $("#f-date").value=it&&it.date?it.date:today();
  $("#f-price").value=it&&it.price!=null?it.price:"";
  $("#f-box").value=it?(it.box||""):"";
  $("#f-tags").value=it?(it.tags||[]).join(", "):"";
  $("#f-lent").value=it?(it.lentTo||""):"";
  $("#f-lentqty").value=it&&it.lentQty?it.lentQty:"";
  $("#f-lenton").value=it?(it.lentOn||""):"";
  $("#f-lentdue").value=it?(it.lentDue||""):"";
  $("#f-lentnote").value=it?(it.lentNote||""):"";
  $("#returnBtn").classList.toggle("hidden",!(it&&isLent(it)));
  $("#f-url").value=it?(it.url||""):"";
  $("#f-pins").value=it?(it.pins||""):"";
  $("#f-note").value=it?(it.note||""):"";
  setStatus(it?it.status:"working");
  $("#deleteBtn").classList.toggle("hidden",!it);
  $("#dupBtn").classList.toggle("hidden",!it);
  draftPhoto=undefined; setPhotoPreview(null);
  $("#sheet").querySelector(".sheet-body").scrollTop=0;
  openSheet($("#sheet"));
  if(it&&it.photo){ const p=await photoGet(it.id); if(p){ draftPhoto=p; setPhotoPreview(p); } }
  if(!it) setTimeout(()=>$("#f-name").focus(),300);
}
$("#save").addEventListener("click",async ()=>{
  const name=$("#f-name").value.trim();
  if(!name){
    const f=$("#f-name"); f.focus();
    spring(0,1,v=>{f.style.transform=`translateX(${Math.sin(v*Math.PI*3)*6}px)`},{stiffness:420,damping:14,onDone(){f.style.transform=""}});
    tap(20); return;
  }
  const priceRaw=$("#f-price").value.trim(), minRaw=$("#f-min").value.trim();
  let url=$("#f-url").value.trim();
  if(url&&!/^https?:\/\//i.test(url)) url="https://"+url;
  const lentTo=$("#f-lent").value.trim();
  const type=$("#f-type").value===NEWCAT?cfg.cats[0]:$("#f-type").value;
  const data={
    name,type,status:draftStatus,
    qty:Math.max(0,Number($("#f-qty").value)||0),
    min:minRaw===""?0:Math.max(0,Number(minRaw)||0),
    date:$("#f-date").value||today(),
    price:priceRaw===""?null:Number(priceRaw),
    box:$("#f-box").value.trim(),
    tags:$("#f-tags").value.split(",").map(t=>t.trim()).filter(Boolean).slice(0,8),
    lentTo, lentQty:lentTo?Math.max(1,Number($("#f-lentqty").value)||1):0,
    lentOn:lentTo?($("#f-lenton").value||today()):"",
    lentDue:lentTo?$("#f-lentdue").value:"",
    lentNote:lentTo?$("#f-lentnote").value.trim():"",
    url,pins:$("#f-pins").value.trim(),note:$("#f-note").value.trim(),
    updated:Date.now()
  };
  let target;
  if(editingId){ target=items.find(i=>i.id===editingId); Object.assign(target,data); }
  else { target=Object.assign({id:uid(),created:Date.now()},data); items.unshift(target); }
  if(draftPhoto===null){ await photoDel(target.id); target.photo=false; }
  else if(typeof draftPhoto==="string"){ const ok=await photoPut(target.id,draftPhoto); target.photo=ok; if(!ok) toast("Photo didn't fit — part saved without it"); }
  persist(); queueSync(); closeSheet(); render(); tap(10);
  toast(editingId?"Saved":"Added "+name);
});
$("#cancel").addEventListener("click",()=>closeSheet());
$("#dupBtn").addEventListener("click",()=>{ const id=editingId; closeSheet(); setTimeout(()=>duplicate(id),120); });
$("#deleteBtn").addEventListener("click",()=>{ const id=editingId; closeSheet(); setTimeout(()=>remove(id),110); });
$("#addBtn").addEventListener("click",()=>edit(null));

/* ---------- bulk ---------- */
function parseLine(line){
  let s=" "+line.trim()+" ";
  if(!s.trim()) return null;
  let qty=1,price=null,type="",status="untested",box="";
  s=s.replace(/\(([^)]*)\)/,(m,g)=>{ box=g.trim(); return " "; });
  s=s.replace(/#([A-Za-z]+)/,(m,g)=>{ type=matchType(g); return " "; });
  s=s.replace(/!([A-Za-z]+)/,(m,g)=>{
    const v=g.toLowerCase();
    status=/^(work|ok|good|fine)/.test(v)?"working":/^(fault|bad|dead|broke|burn)/.test(v)?"faulty":"untested";
    return " ";
  });
  s=s.replace(/@\s*([\d.]+)/,(m,g)=>{ price=Number(g); return " "; });
  s=s.replace(/\s[x×]\s?(\d+)(?=\s)/i,(m,g)=>{ qty=Number(g); return " "; });
  s=s.replace(/\s(\d+)\s?[x×](?=\s)/i,(m,g)=>{ qty=Number(g); return " "; });
  const name=s.replace(/\s+/g," ").trim();
  if(!name) return null;
  return {name,qty:qty||1,price,type:type||guessType(name),status,box};
}
const bulkLines=()=>$("#f-bulk").value.split("\n").map(parseLine).filter(Boolean);
$("#f-bulk").addEventListener("input",()=>{
  const n=bulkLines().length;
  $("#bulkPreview").textContent=n?`${n} part${n>1?"s":""} ready. Quantity, price, category and condition are read from each line.`
    :"Write a name, then add x4 for quantity, @85 for price, #Sensor for category, !working or !faulty for condition, and (Drawer A) for where it lives.";
});
$("#bulkBtn").addEventListener("click",()=>{ closeSheet(); setTimeout(()=>{ openSheet($("#sheetBulk")); setTimeout(()=>$("#f-bulk").focus(),300); },140); });
$("#cancelBulk").addEventListener("click",()=>closeSheet());
$("#saveBulk").addEventListener("click",()=>{
  const parsed=bulkLines();
  if(!parsed.length){ toast("Nothing to add yet"); return; }
  const added=parsed.map(p=>Object.assign({id:uid(),created:Date.now(),updated:Date.now(),date:today(),min:0,tags:[],url:"",pins:"",note:"",lentTo:"",lentQty:0,lentOn:"",lentDue:"",lentNote:""},p));
  items=added.concat(items); persist(); queueSync(); closeSheet(); $("#f-bulk").value=""; render(); tap(12);
  const ids=new Set(added.map(a=>a.id));
  toast(`Added ${added.length} parts`,"Undo",()=>{ items=items.filter(i=>!ids.has(i.id)); persist(); render(); });
});

/* ---------- stats ---------- */
function openStats(){
  if(!items.length){ edit(null); return; }
  const byType={}, byBox={}; let val=0, qty=0;
  items.forEach(i=>{
    const n=Number(i.qty)||0; qty+=n; val+=(Number(i.price)||0)*n;
    byType[i.type||"Other"]=(byType[i.type||"Other"]||0)+n;
    if(i.box) byBox[i.box]=(byBox[i.box]||0)+n;
  });
  const bars=obj=>{
    const ent=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,10), max=Math.max(...ent.map(e=>e[1]),1);
    return `<div class="bars">${ent.map(([k,v],n)=>
      `<div class="barrow"><em>${esc(k)}</em><div class="bartrack"><div class="barfill" style="width:${Math.round(v/max*100)}%;animation-delay:${n*35}ms"></div></div><b>${v}</b></div>`).join("")}</div>`;
  };
  const low=items.filter(isLow), lent=items.filter(isLent), dead=items.filter(i=>i.status==="faulty");
  $("#statsBody").innerHTML=`
    <div class="bignum">
      <div><b>${items.length}</b><span>Distinct parts</span></div>
      <div><b>${qty}</b><span>Units on hand</span></div>
      <div><b>${val?money(val):"—"}</b><span>Spent</span></div>
    </div>
    <p class="hint" style="margin-bottom:8px">Units by category</p>${bars(byType)}
    ${Object.keys(byBox).length?`<div class="hr"></div><p class="hint" style="margin-bottom:8px">Units by storage</p>${bars(byBox)}`:""}
    ${lent.length?`<div class="hr"></div><p class="hint" style="margin-bottom:8px">Lent out</p>
      ${lent.map(i=>`<button class="rowbtn" data-goto="${i.id}">${esc(i.name)}<span>${esc(i.lentTo)}${i.lentDue?" · due "+esc(when(i.lentDue)):""}</span></button>`).join("")}`:""}
    ${low.length?`<div class="hr"></div><p class="hint" style="margin-bottom:8px">Running low</p>
      ${low.slice(0,8).map(i=>`<button class="rowbtn" data-goto="${i.id}">${esc(i.name)}<span>${Number(i.qty)||0} left</span></button>`).join("")}`:""}
    ${dead.length?`<div class="hr"></div><p class="hint" style="margin-bottom:8px">Not working</p>
      ${dead.slice(0,8).map(i=>`<button class="rowbtn" data-goto="${i.id}">${esc(i.name)}<span>${esc(i.type||"")}</span></button>`).join("")}`:""}`;
  $("#statsBody").scrollTop=0;
  openSheet($("#sheetStats"));
}
$("#statsBtn").addEventListener("click",openStats);
$("#cancelStats").addEventListener("click",()=>closeSheet());
$("#statsBody").addEventListener("click",e=>{
  const b=e.target.closest("[data-goto]"); if(!b) return;
  const id=b.dataset.goto; closeSheet(); setTimeout(()=>edit(id),140);
});

/* ---------- settings ---------- */
function openSettings(){
  $("#fbWhen").textContent=cfg.last?when(new Date(cfg.last).toISOString().slice(0,10)):"Never";
  $("#vaultState").textContent=cfg.vault?"Connected":"Not set";
  $("#lockState").textContent=cfg.askAlways?"On":"Off";
  $("#signoutBtn").classList.toggle("hidden",!cfg.vault);
  $("#f-cur").value=cfg.cur||"INR";
  paintSettingsTheme(); paintCats(); stats();
  openSheet($("#sheet2"));
}
$("#moreBtn").addEventListener("click",openSettings);
$("#syncBtn").addEventListener("click",openSettings);
$("#cancel2").addEventListener("click",()=>closeSheet());

$("#swatches").addEventListener("click",e=>{
  const b=e.target.closest(".sw"); if(!b) return;
  cfg.theme=Object.assign({},PRESETS[Number(b.dataset.p)][1]);
  applyTheme(); persist(); paintSettingsTheme(); tap(8);
});
[["#c-bg","bg"],["#c-ink","ink"],["#c-ok","ok"],["#c-bad","bad"],["#c-unk","unk"],["#c-warn","warn"]].forEach(([sel,k])=>{
  $(sel).addEventListener("input",e=>{ cfg.theme[k]=e.target.value; applyTheme(); });
  $(sel).addEventListener("change",()=>{ persist(); paintSettingsTheme(); });
});
$("#resetTheme").addEventListener("click",()=>{ cfg.theme=Object.assign({},THEME0); applyTheme(); persist(); paintSettingsTheme(); toast("Palette reset"); });

function download(name,text,type){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([text],{type:type||"application/json"}));
  a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
$("#exportBtn").addEventListener("click",async ()=>{
  const photos=await photoAll();
  download("parts-"+today()+".json",JSON.stringify({v:3,exported:new Date().toISOString(),cats:cfg.cats,items,photos},null,2));
  toast("Backup downloaded");
});
$("#csvBtn").addEventListener("click",()=>{
  const cols=["name","type","status","qty","min","price","box","tags","date","lentTo","lentQty","lentOn","lentDue","url","pins","note"];
  const cell=v=>`"${String(v==null?"":Array.isArray(v)?v.join(" "):v).replace(/"/g,'""')}"`;
  download("parts-"+today()+".csv",[cols.join(",")].concat(items.map(i=>cols.map(c=>cell(i[c])).join(","))).join("\n"),"text/csv");
  toast("Spreadsheet downloaded");
});
$("#importBtn").addEventListener("click",()=>$("#importFile").click());
$("#importFile").addEventListener("change",e=>{
  const f=e.target.files&&e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=async ()=>{
    try{
      const d=JSON.parse(r.result), incoming=Array.isArray(d)?d:d.items;
      if(!Array.isArray(incoming)) throw 0;
      const byId=new Map(items.map(i=>[i.id,i]));
      incoming.forEach(i=>{
        if(i&&i.name){
          i.id=i.id||uid(); i.created=i.created||Date.now();
          i.status=STATUSES.includes(i.status)?i.status:"untested";
          if(!Array.isArray(i.tags)) i.tags=[];
          byId.set(i.id,Object.assign(byId.get(i.id)||{},i));
        }
      });
      items=[...byId.values()];
      if(Array.isArray(d.cats)) d.cats.forEach(c=>{ if(!cfg.cats.includes(c)) cfg.cats.push(c) });
      if(d.photos) for(const k in d.photos) await photoPut(k,d.photos[k]);
      persist(); queueSync(); render(); closeSheet(); toast("Imported "+incoming.length+" parts");
    }catch(err){ toast("That file isn't a Parts backup"); }
  };
  r.readAsText(f); e.target.value="";
});
$("#wipeBtn").addEventListener("click",()=>{
  const backup=items.slice();
  items=[]; persist(); render(); closeSheet();
  toast("All parts deleted","Undo",()=>{ items=backup; persist(); render(); });
});

const KIT=[
  ["Arduino Uno R3",1,"Board"],["Arduino Nano",2,"Board"],["ESP32 devkit v1",1,"Board"],
  ["HC-SR04 ultrasonic",2,"Sensor"],["DHT11 temperature humidity",2,"Sensor"],["DS18B20 temperature probe",1,"Sensor"],
  ["MPU-6050 accelerometer gyro",1,"Sensor"],["PIR motion sensor",1,"Sensor"],["LDR photoresistor",5,"Sensor"],
  ["MQ-2 gas sensor",1,"Sensor"],["Soil moisture sensor",1,"Sensor"],["IR receiver and remote",1,"Sensor"],
  ["SG90 micro servo",2,"Actuator"],["28BYJ-48 stepper with ULN2003",1,"Actuator"],["5V relay module",2,"Actuator"],
  ["Active buzzer",2,"Actuator"],["0.96in OLED I2C display",1,"Display"],["16x2 LCD with I2C backpack",1,"Display"],
  ["Breadboard 830 point",2,"Connector"],["Jumper wire set",1,"Connector"],
  ["Resistor assortment",200,"Passive"],["LED assortment",50,"Passive"],
  ["9V battery clip barrel jack",2,"Power"],["USB-B printer cable",1,"Connector"]
];
function seed(){
  const added=KIT.map(([name,qty,type])=>({
    id:uid(),created:Date.now(),updated:Date.now(),name,qty,type,status:"untested",
    min:0,price:null,date:today(),box:"",tags:["starter kit"],url:"",pins:"",note:"",
    lentTo:"",lentQty:0,lentOn:"",lentDue:"",lentNote:""
  }));
  items=added.concat(items); persist(); queueSync(); render(); tap(12);
  if(activeSheet) closeSheet();
  const ids=new Set(added.map(a=>a.id));
  toast("Loaded "+added.length+" parts","Undo",()=>{ items=items.filter(i=>!ids.has(i.id)); persist(); render(); });
}
$("#seedBtn").addEventListener("click",seed);

/* ---------- sort, search, filters ---------- */
$("#sortBtn").addEventListener("click",()=>{
  const i=SORTS.findIndex(s=>s[0]===cfg.sort);
  cfg.sort=SORTS[(i+1)%SORTS.length][0]; persist(); render(); tap(6);
  toast(SORTS.find(s=>s[0]===cfg.sort)[1]);
});
let searchTimer=0;
$("#q").addEventListener("input",e=>{
  query=e.target.value; $("#clearQ").classList.toggle("show",!!query);
  clearTimeout(searchTimer);
  searchTimer=setTimeout(render, query?110:0);
});
$("#clearQ").addEventListener("click",()=>{ $("#q").value=""; query=""; $("#clearQ").classList.remove("show"); render(); $("#q").focus(); });
$("#filters").addEventListener("click",e=>{
  const c=e.target.closest(".chip"); if(!c) return;
  filter=(c.dataset.f===filter&&filter!=="all")?"all":c.dataset.f;
  tap(6); render();
  const again=[...document.querySelectorAll(".chip")].find(x=>x.dataset.f===filter);
  again&&again.scrollIntoView({block:"nearest",inline:"center",behavior:"smooth"});
});

/* ---------- pull down to sync ---------- */
(function pullToSync(){
  const root=$("#appRoot"), pill=$("#pull"), txt=$("#pullTxt");
  let y0=0,pulling=false,d=0;
  const TRIG=78;
  addEventListener("pointerdown",e=>{
    if(activeSheet||$("#gate").classList.contains("on")) return;
    if(e.target.closest(".sheet,.dock,.dlg,.lightbox")) return;
    if(window.scrollY>0) return;
    y0=e.clientY; pulling=true; d=0; root.style.transition="";
  },{passive:true});
  addEventListener("pointermove",e=>{
    if(!pulling) return;
    const raw=e.clientY-y0;
    if(raw<=0){ if(d>0){ d=0; root.style.transform=""; pill.classList.remove("on","ready"); } return; }
    if(window.scrollY>0){ pulling=false; return; }
    d=rubber(raw,190,.62);
    root.style.transform=`translate3d(0,${d}px,0)`;
    pill.style.transform=`translate(-50%,${Math.min(d*.55,54)-14}px) scale(${Math.min(1,.9+d/260)})`;
    pill.classList.add("on");
    pill.classList.toggle("ready",d>TRIG);
    txt.textContent=d>TRIG?(cfg.vault?"Release to sync":"Release to refresh"):"Pull to sync";
  },{passive:true});
  function release(){
    if(!pulling) return; pulling=false;
    const go=d>TRIG;
    if(go){
      pill.classList.add("spin"); txt.textContent=cfg.vault?"Syncing":"Refreshing";
      spring(d,46,v=>{root.style.transform=`translate3d(0,${v}px,0)`;pill.style.transform=`translate(-50%,${Math.min(v*.55,54)-14}px)`},{stiffness:420,damping:34});
      const done=()=>{
        pill.classList.remove("spin","ready");
        spring(46,0,v=>{root.style.transform=`translate3d(0,${v}px,0)`;pill.style.transform=`translate(-50%,${Math.min(v*.55,54)-14}px) scale(.9)`},
          {stiffness:420,damping:36,onDone(){root.style.transform="";pill.classList.remove("on")}});
      };
      if(cfg.vault) syncNow(true).then(done,done); else { render(); setTimeout(done,420); }
    }else{
      spring(d,0,v=>{root.style.transform=`translate3d(0,${v}px,0)`;pill.style.transform=`translate(-50%,${Math.min(v*.55,54)-14}px) scale(.9)`},
        {stiffness:460,damping:36,onDone(){root.style.transform="";pill.classList.remove("on","ready")}});
    }
    d=0;
  }
  addEventListener("pointerup",release); addEventListener("pointercancel",release);
})();

/* ---------- lightbox, toast, keys ---------- */
function showPhoto(src){ if(!src) return; $("#lightboxImg").src=src; $("#lightbox").classList.add("on"); tap(6); }
$("#lightbox").addEventListener("click",()=>$("#lightbox").classList.remove("on"));

let toastTimer=0;
function toast(msg,actionLabel,action){
  const t=$("#toast"), b=$("#toastAct");
  t.classList.remove("out");
  $("#toastMsg").textContent=msg;
  b.textContent=actionLabel||"Dismiss";
  b.onclick=()=>{ if(action) action(); hideToast(); };
  t.classList.add("show"); clearTimeout(toastTimer);
  toastTimer=setTimeout(hideToast,action?5200:2500);
}
function hideToast(){
  const t=$("#toast");
  t.classList.add("out"); t.classList.remove("show");
  clearTimeout(toastTimer);
}

addEventListener("keydown",e=>{
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if(e.key==="Escape"){
    if($("#dlg").classList.contains("on")) askClose(null);
    else if($("#lightbox").classList.contains("on")) $("#lightbox").classList.remove("on");
    else if(activeSheet) closeSheet(); else if(openRow) closeRow(openRow);
  }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){ e.preventDefault(); $("#q").focus(); }
  if((e.metaKey||e.ctrlKey)&&e.key==="Enter"&&activeSheet===$("#sheet")){ e.preventDefault(); $("#save").click(); }
  if(!typing&&!activeSheet&&e.key==="n"){ e.preventDefault(); edit(null); }
  if(!typing&&!activeSheet&&e.key==="/"){ e.preventDefault(); $("#q").focus(); }
});
document.addEventListener("pointerdown",e=>{ if(openRow&&!e.target.closest(".row")) closeRow(openRow); },{passive:true});

/* ============================================================
   7. vault + firebase sync
   ============================================================ */
let fb=null, fbBusy=false, syncTimer=0;
const remote=()=>fb&&cfg.vault;

async function digest(str){
  try{
    const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("parts::"+str));
    return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
  }catch(e){
    let h1=0x811c9dc5,h2=0x01000193;
    for(let i=0;i<str.length;i++){ h1=(h1^str.charCodeAt(i))*16777619>>>0; h2=(h2+str.charCodeAt(i)*(i+7))>>>0; }
    return (h1.toString(16)+h2.toString(16)).padStart(32,"0").repeat(2).slice(0,64);
  }
}
function setSyncUI(state,label){
  $("#syncDot").className="dot"+(state?" "+state:"");
  $("#syncTxt").textContent=label;
}
function queueSync(){ if(remote()&&navigator.onLine){ clearTimeout(syncTimer); syncTimer=setTimeout(()=>syncNow(false),1200); } }

async function connect(){
  if(fb) return fb;
  const [appMod,authMod,fsMod]=await Promise.all([
    import(SDK+"firebase-app.js"), import(SDK+"firebase-auth.js"), import(SDK+"firebase-firestore.js")
  ]);
  const app=appMod.getApps&&appMod.getApps().length?appMod.getApps()[0]:appMod.initializeApp(FIREBASE);
  const auth=authMod.getAuth(app);
  if(!auth.currentUser) await authMod.signInAnonymously(auth);
  const dbRef=fsMod.getFirestore(app);
  try{ await fsMod.enableIndexedDbPersistence(dbRef) }catch(e){}
  fb={fs:fsMod,db:dbRef,auth};
  return fb;
}
async function initSync(){
  if(!cfg.vault){ setSyncUI("",navigator.onLine?"Local":"Offline"); return; }
  if(!navigator.onLine){ setSyncUI("off","Offline"); return; }
  setSyncUI("busy","Connecting");
  try{ await connect(); setSyncUI("on","Synced"); syncNow(false); }
  catch(e){ fb=null; setSyncUI("off","Sync off"); }
}
async function deleteRemote(id){
  try{ const {doc,deleteDoc}=fb.fs; await deleteDoc(doc(fb.db,"vaults",cfg.vault,"parts",id)); }catch(e){}
}
async function syncNow(loud){
  if(!cfg.vault){ if(loud) toast("Set a sync password first"); return; }
  if(!navigator.onLine){ if(loud) toast("You're offline — changes are saved locally"); return; }
  try{ await connect(); }catch(e){ setSyncUI("off","Sync off"); if(loud) toast("Can't reach Firebase right now"); return; }
  if(fbBusy) return; fbBusy=true; setSyncUI("busy","Syncing");
  try{
    const {collection,getDocs,doc,setDoc}=fb.fs;
    const snap=await getDocs(collection(fb.db,"vaults",cfg.vault,"parts"));
    const rem=new Map(); snap.forEach(d=>rem.set(d.id,d.data()));
    const local=new Map(items.map(i=>[i.id,i]));
    rem.forEach((r,id)=>{ const l=local.get(id);
      if(!l||(r.updated||0)>(l.updated||0)) local.set(id,Object.assign({id},r,{photo:l?l.photo:false})); });
    const writes=[];
    local.forEach((l,id)=>{ const r=rem.get(id);
      if(!r||(l.updated||0)>(r.updated||0)){ const c=Object.assign({},l); delete c.photo; writes.push(setDoc(doc(fb.db,"vaults",cfg.vault,"parts",id),c)); } });
    await Promise.all(writes);
    items=[...local.values()]; items.forEach(i=>{ if(!Array.isArray(i.tags)) i.tags=[] });
    cfg.last=Date.now(); persist(); render();
    setSyncUI("on","Synced"); $("#fbWhen").textContent="Just now";
    if(loud) toast(writes.length?`Synced · ${writes.length} sent up`:"Everything is up to date");
  }catch(e){
    setSyncUI("off","Sync failed");
    if(loud) toast("Sync failed — check Firestore rules");
  }
  fbBusy=false;
}
addEventListener("online",initSync);
addEventListener("offline",()=>setSyncUI("off","Offline"));
addEventListener("visibilitychange",()=>{ if(!document.hidden) queueSync(); });

/* ---------- gate ---------- */
let gateMode="unlock";
function openGate(mode){
  gateMode=mode;
  const set=mode==="set";
  $("#gateTitle").textContent=set?"Set a sync password":"Unlock your inventory";
  $("#gateMsg").textContent=set
    ? "Anyone who types this password on any device sees this same inventory. Choose something you can share with yourself later — it can't be recovered."
    : "Enter the password for this inventory.";
  $("#gateGo").textContent=set?"Connect":"Unlock";
  $("#gatePwd").value=""; $("#gatePwd2").value="";
  $("#gatePwd2").classList.toggle("hidden",!set);
  $("#gateSkip").textContent=set?"Cancel":"Use on this device only";
  $("#gate").classList.add("on");
  setTimeout(()=>$("#gatePwd").focus(),200);
}
function closeGate(){ $("#gate").classList.remove("on"); }
function shakeGate(){
  const c=$("#gate").querySelector(".gatecard");
  spring(0,1,v=>{c.style.transform=`translateX(${Math.sin(v*Math.PI*3)*8}px)`},{stiffness:420,damping:13,onDone(){c.style.transform=""}});
  tap(24);
}
$("#gateGo").addEventListener("click",async ()=>{
  const p=$("#gatePwd").value;
  if(p.length<4){ shakeGate(); toast("At least 4 characters"); return; }
  if(gateMode==="set"){
    if(p!==$("#gatePwd2").value){ shakeGate(); toast("Passwords don't match"); return; }
    const h=await digest(p);
    cfg.vault=h.slice(0,32); cfg.check=h.slice(32); persist();
    closeGate(); toast("Connected — syncing"); initSync().then(()=>syncNow(true));
    return;
  }
  const h=await digest(p);
  if(cfg.vault&&cfg.check&&h.slice(32)!==cfg.check){ shakeGate(); toast("Wrong password"); return; }
  cfg.vault=h.slice(0,32); cfg.check=h.slice(32); persist();
  closeGate(); initSync();
});
$("#gatePwd2").addEventListener("keydown",e=>{ if(e.key==="Enter") $("#gateGo").click(); });
$("#gatePwd").addEventListener("keydown",e=>{ if(e.key==="Enter"){ if(gateMode==="set") $("#gatePwd2").focus(); else $("#gateGo").click(); } });
$("#gateSkip").addEventListener("click",()=>{ closeGate(); if(gateMode==="unlock"&&!fb) setSyncUI("",navigator.onLine?"Local":"Offline"); });

$("#vaultBtn").addEventListener("click",()=>{ closeSheet(); setTimeout(()=>openGate(cfg.vault?"unlock":"set"),140); });
$("#lockBtn").addEventListener("click",()=>{
  cfg.askAlways=!cfg.askAlways; persist();
  $("#lockState").textContent=cfg.askAlways?"On":"Off"; tap(6);
  toast(cfg.askAlways?"Password asked on every launch":"Unlocks automatically on this device");
});
$("#signoutBtn").addEventListener("click",()=>{
  cfg.vault=""; cfg.check=""; persist(); fb=null;
  setSyncUI("",navigator.onLine?"Local":"Offline");
  $("#vaultState").textContent="Not set"; $("#signoutBtn").classList.add("hidden");
  toast("Left the vault — parts stay on this device");
});
$("#fbSync").addEventListener("click",()=>{ if(!cfg.vault) openGate("set"); else syncNow(true); });

/* ============================================================
   8. install / offline plumbing
   ============================================================ */
(function pwa(){
  if("serviceWorker" in navigator && location.protocol.startsWith("http")){
    addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
  }
  let deferred=null;
  addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); deferred=e; $("#installBtn").classList.remove("hidden"); });
  $("#installBtn").addEventListener("click",async ()=>{
    if(!deferred) return;
    deferred.prompt(); const r=await deferred.userChoice;
    deferred=null; $("#installBtn").classList.add("hidden");
    if(r&&r.outcome==="accepted") toast("Installed");
  });
  addEventListener("hashchange",()=>history.replaceState(null,"",location.pathname+location.search));
})();

/* ============================================================
   9. boot
   ============================================================ */
render();
if(cfg.vault&&cfg.askAlways) openGate("unlock");
else if(cfg.vault) initSync();
else setSyncUI("",navigator.onLine?"Local":"Offline");
