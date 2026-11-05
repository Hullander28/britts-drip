'use strict';
/* ===== Storage (IndexedDB) ===== */
const DB='britts-drip',STORES=['items','outfits','kv'];let db;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{STORES.forEach(s=>{if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'})})};r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
const tx=(s,m='readonly')=>db.transaction(s,m).objectStore(s);
const all=s=>new Promise(r=>{const q=tx(s).getAll();q.onsuccess=()=>r(q.result||[])});
const put=(s,v)=>new Promise(r=>{const q=tx(s,'readwrite').put(v);q.onsuccess=()=>r()});
const del=(s,id)=>new Promise(r=>{const q=tx(s,'readwrite').delete(id);q.onsuccess=()=>r()});
const clr=s=>new Promise(r=>{const q=tx(s,'readwrite').clear();q.onsuccess=()=>r()});
async function kvGet(k,d){const q=await new Promise(r=>{const x=tx('kv').get(k);x.onsuccess=()=>r(x.result)});return q?q.v:d}
const kvSet=(k,v)=>put('kv',{id:k,v});

/* ===== State ===== */
const S={items:[],outfits:[],plans:{},history:[],profile:{name:'',photo:'',skin:'#e8b894'},settings:{dark:matchMedia('(prefers-color-scheme: dark)').matches,units:'F',city:'',lat:null,lon:null,place:'',tryonWorker:''},tab:'today',mood:'Chill',wx:null,q:'',cat:'All',sort:'new',laundry:'All',dress:[],calMonth:null,dismissed:[]};
const CATS=['Tops','Bottoms','Dresses','Outerwear','Shoes','Accessories'];
const SEASONS=['Spring','Summer','Fall','Winter'];
const OCC=['Casual','Work','Date','Party','Workout','Formal','Lounge'];
const MOODS={Chill:['Casual','Lounge'],Cozy:['Lounge','Casual'],Bold:['Party','Date'],Work:['Work','Formal'],Date:['Date','Party'],Active:['Workout','Casual']};
const COLORS={Black:'#111',White:'#f5f5f5',Gray:'#9ca3af',Navy:'#1e3a8a',Blue:'#3b82f6',Red:'#dc2626',Pink:'#ec4899',Purple:'#8b5cf6',Green:'#16a34a',Yellow:'#facc15',Orange:'#f97316',Brown:'#92400e',Beige:'#d6c3a5',Multi:'linear-gradient(90deg,red,orange,green,blue)'};
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>ymd(new Date());function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const daysAgo=d=>d?Math.floor((Date.now()-new Date(d+'T12:00').getTime())/864e5):Infinity;
const T=c=>S.settings.units==='F'?Math.round(c*9/5+32)+'°F':Math.round(c)+'°C';
function toast(m){const t=$('#toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.add('hidden'),2200)}
const item=id=>S.items.find(i=>i.id===id);

/* ===== Icons ===== */
const I={today:'<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',closet:'<path d="M4 3h16v18H4zM12 3v18M9 11v2M15 11v2"/>',dress:'<path d="M8 3l4 3 4-3 4 4-3 3v11H7V10L4 7z"/>',plan:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',alerts:'<path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0"/>',me:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'};
const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
const TABS=[['today','Today'],['closet','Closet'],['dress','Dress Me'],['plan','Plan'],['alerts','Alerts'],['me','Me']];

/* ===== Avatar (stylized SVG) ===== */
function avatarSVG(skin){return `<svg class="av" viewBox="0 0 100 220" xmlns="http://www.w3.org/2000/svg"><g fill="${skin}" stroke="#0002"><circle cx="50" cy="22" r="14"/><rect x="45" y="34" width="10" height="8"/><path d="M30 44h40l6 50h-8l-4-30v40H36V64l-4 30h-8z"/><rect x="36" y="104" width="12" height="100" rx="5"/><rect x="52" y="104" width="12" height="100" rx="5"/></g></svg>`}

/* ===== Images ===== */
function fileToImg(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file);const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=u})}
function scale(im,max=900,type='image/jpeg'){const k=Math.min(1,max/Math.max(im.naturalWidth||im.width,im.naturalHeight||im.height));const c=document.createElement('canvas');c.width=Math.round((im.naturalWidth||im.width)*k);c.height=Math.round((im.naturalHeight||im.height)*k);const x=c.getContext('2d');if(type==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}x.drawImage(im,0,0,c.width,c.height);return c}
const loadImg=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src});
async function quickCutout(src,tol=38){const im=await loadImg(src);const c=scale(im,700,'image/png');const x=c.getContext('2d');const d=x.getImageData(0,0,c.width,c.height),p=d.data,W=c.width,H=c.height;
 const seen=new Uint8Array(W*H),st=[];const pts=[[0,0],[W-1,0],[0,H-1],[W-1,H-1],[W>>1,0],[0,H>>1],[W-1,H>>1]];
 for(const[a,b]of pts){const i=b*W+a;st.push(i)}
 const ref=pts.map(([a,b])=>{const i=(b*W+a)*4;return[p[i],p[i+1],p[i+2]]});
 const near=i=>{const o=i*4;return ref.some(r=>Math.abs(p[o]-r[0])+Math.abs(p[o+1]-r[1])+Math.abs(p[o+2]-r[2])<tol*3)};
 while(st.length){const i=st.pop();if(seen[i])continue;seen[i]=1;if(!near(i))continue;p[i*4+3]=0;const a=i%W,b=(i/W)|0;if(a>0)st.push(i-1);if(a<W-1)st.push(i+1);if(b>0)st.push(i-W);if(b<H-1)st.push(i+W)}
 x.putImageData(d,0,0);return trim(c).toDataURL('image/png')}
function trim(c){const x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let a=c.width,b=c.height,e=0,f=0;for(let y=0;y<c.height;y++)for(let X=0;X<c.width;X++)if(d[(y*c.width+X)*4+3]>10){if(X<a)a=X;if(X>e)e=X;if(y<b)b=y;if(y>f)f=y}
 if(e<=a||f<=b)return c;const o=document.createElement('canvas');o.width=e-a+1;o.height=f-b+1;o.getContext('2d').drawImage(c,a,b,o.width,o.height,0,0,o.width,o.height);return o}
let _imgly=null;async function loadImgly(){if(_imgly)return _imgly;try{_imgly=await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm')}catch(e){_imgly=await import('https://esm.sh/@imgly/background-removal@1.7.0')}return _imgly}
async function aiCutout(src){const m=await loadImgly();const blob=await (await fetch(src)).blob();const out=await m.removeBackground(blob,{output:{format:'image/png'}});const im=await fileToImg(out);return trim(scale(im,700,'image/png')).toDataURL('image/png')}
function dominantColor(src){return loadImg(src).then(im=>{const c=scale(im,40,'image/png');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let r=0,g=0,b=0,n=0;const W=c.width,H=c.height;
 for(let y=H*.25|0;y<H*.75;y++)for(let x=W*.25|0;x<W*.75;x++){const i=(y*W+x)*4;if(d[i+3]<128)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++}
 if(!n)return 'Multi';r/=n;g/=n;b/=n;let best='Gray',bd=1e9;for(const[k,v]of Object.entries(COLORS)){if(!v.startsWith('#'))continue;const h=v.length===4?v.replace(/#(.)(.)(.)/,'#$1$1$2$2$3$3'):v;const R=parseInt(h.slice(1,3),16),G=parseInt(h.slice(3,5),16),B=parseInt(h.slice(5,7),16);const dd=(R-r)**2+(G-g)**2+(B-b)**2;if(dd<bd){bd=dd;best=k}}return best})}

/* ===== Weather (Open-Meteo, no key) ===== */
const WMO=c=>c===0?'Clear':c<=3?'Partly cloudy':c<=48?'Fog':c<=57?'Drizzle':c<=67?'Rain':c<=77?'Snow':c<=82?'Showers':c<=86?'Snow showers':'Thunderstorm';
async function geocode(name){const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name='+encodeURIComponent(name));const j=await r.json();if(!j.results||!j.results.length)throw new Error('City not found');const g=j.results[0];return{lat:g.latitude,lon:g.longitude,place:[g.name,g.admin1,g.country_code].filter(Boolean).join(', ')}}
async function forecast(lat,lon,days=7){const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=${days}`);if(!r.ok)throw new Error('Weather unavailable');return r.json()}
async function loadWeather(force){const s=S.settings;if(s.lat==null)return;try{const cached=await kvGet('wx',null);if(!force&&cached&&Date.now()-cached.t<30*60e3&&cached.lat===s.lat){S.wx=cached.d}else{S.wx=await forecast(s.lat,s.lon);kvSet('wx',{t:Date.now(),lat:s.lat,d:S.wx})}}catch(e){const c=await kvGet('wx',null);if(c)S.wx=c.d;toast('Offline: showing last weather')}if(S.tab==='today')render()}
function useGPS(){if(!navigator.geolocation)return toast('Location not supported');toast('Getting location…');navigator.geolocation.getCurrentPosition(async p=>{Object.assign(S.settings,{lat:p.coords.latitude,lon:p.coords.longitude,place:'Current location'});await kvSet('settings',S.settings);loadWeather(true)},e=>toast('Location blocked. Type a city instead.'),{timeout:12000})}
async function setCity(name){try{const g=await geocode(name);Object.assign(S.settings,g,{city:name});await kvSet('settings',S.settings);await loadWeather(true);render()}catch(e){toast(e.message)}}

/* ===== Suggestions ===== */
function warmthNeed(tc){return tc>=27?1:tc>=20?2:tc>=13?3:tc>=5?4:5}
function seasonNow(){const m=new Date().getMonth();return m<2||m===11?'Winter':m<5?'Spring':m<8?'Summer':'Fall'}
function recentWornIds(n=7){const s=new Set();S.history.filter(h=>daysAgo(h.date)<n).forEach(h=>h.items.forEach(i=>s.add(i)));return s}
function suggest(tc,rain,mood,count=3,exclude=new Set()){
 const need=warmthNeed(tc),occ=MOODS[mood]||[],season=seasonNow(),recent=recentWornIds(7);
 const pool=S.items.filter(i=>i.laundry!=='dirty'&&i.laundry!=='cleaners'&&!i.outdated);
 const score=i=>{let s=0;s-=Math.abs((i.warmth||3)-need)*2;if(i.occasions?.some(o=>occ.includes(o)))s+=3;if(!i.seasons?.length||i.seasons.includes(season))s+=1.5;if(i.fav)s+=1;if(recent.has(i.id))s-=4;if(rain&&i.tags?.some(t=>/rain|waterproof/i.test(t)))s+=3;s+=Math.random()*1.2;return s};
 const by=c=>pool.filter(i=>i.cat===c).map(i=>[score(i),i]).sort((a,b)=>b[0]-a[0]).map(x=>x[1]);
 const tops=by('Tops'),bots=by('Bottoms'),dres=by('Dresses'),outs=by('Outerwear'),shoes=by('Shoes'),acc=by('Accessories');const res=[];const used=new Set();
 for(let k=0;k<count;k++){let o=[];const useDress=dres.length&&(k%2===1||!tops.length||!bots.length);
  if(useDress){o.push(dres[k%dres.length])}else{if(tops.length)o.push(tops[k%tops.length]);if(bots.length)o.push(bots[k%bots.length])}
  if((tc<16||rain)&&outs.length)o.push(outs[k%outs.length]);if(shoes.length)o.push(shoes[k%shoes.length]);if(acc.length&&k===0)o.push(acc[0]);
  o=o.filter(Boolean);const key=o.map(i=>i.id).sort().join();if(o.length&&!used.has(key)){used.add(key);res.push(o)}}
 return res}
function outfitWornRecently(ids){const key=[...ids].sort().join();return S.history.find(h=>daysAgo(h.date)<7&&[...h.items].sort().join()===key)}

/* ===== Persistence helpers ===== */
async function saveItem(it){const i=S.items.findIndex(x=>x.id===it.id);if(i>=0)S.items[i]=it;else S.items.unshift(it);await put('items',it)}
async function logWear(ids,date=today(),note=''){const rep=outfitWornRecently(ids);S.history.push({id:uid(),date,items:ids,note});for(const id of ids){const it=item(id);if(!it)continue;it.wears=(it.wears||0)+1;if(!it.lastWorn||it.lastWorn<date)it.lastWorn=date;if(it.laundry!=='cleaners')it.laundry=it.cat==='Shoes'||it.cat==='Accessories'||it.cat==='Outerwear'?it.laundry:'dirty';await put('items',it)}await kvSet('history',S.history);toast(rep?'Logged. Heads up: you wore this same outfit on '+rep.date:'Outfit logged as worn')}


/* ===== AI try-on (fal via Worker) ===== */
const DEFAULT_WORKER='https://britts-drip-tryon.hullander28.workers.dev';
function workerBase(){return ((S.settings.tryonWorker||'').trim()||DEFAULT_WORKER).replace(/\/$/,'')}
async function callTryOn(personDataUrl, garmentDataUrl){
  const base=workerBase();
  if(!base) throw new Error('Set an AI try-on Worker URL in Me → Settings first.');
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),120000);
  try{
    const res=await fetch(base+'/tryon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({person:personDataUrl,garment:garmentDataUrl}),signal:ctrl.signal});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||('Try-on failed ('+res.status+')'));
    if(!data.imageUrl) throw new Error('No image returned');
    return data;
  } finally { clearTimeout(t) }
}
async function urlToDataUrl(url){
  if(typeof url==='string' && url.startsWith('data:')) return url;
  const r=await fetch(url); const b=await r.blob();
  return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(b)});
}
async function runAiTryOn(garmentIds){
  if(!S.profile.photo) throw new Error('Add a body photo in Me first.');
  if(!garmentIds.length) throw new Error('Pick at least one garment.');
  const order=['Tops','Dresses','Bottoms','Outerwear','Shoes','Accessories'];
  const sorted=[...garmentIds].sort((a,b)=>order.indexOf(item(a)?.cat)-(order.indexOf(item(b)?.cat)));
  let person=S.profile.photo;
  const steps=[];
  for(let i=0;i<sorted.length;i++){
    const it=item(sorted[i]);
    if(!it) continue;
    toast(`AI try-on ${i+1}/${sorted.length}: ${it.name}…`);
    const out=await callTryOn(person, it.img);
    const next=await urlToDataUrl(out.imageUrl);
    steps.push({itemId:it.id,name:it.name,url:next,mock:!!out.mock});
    person=next;
  }
  return {final:person,steps,ids:sorted};
}
function openAiResult(result, garmentIds){
  const mock=result.steps.some(x=>x.mock);
  window.__aiTryOn = {result, garmentIds: result.ids||garmentIds};
  openSheet(`<div class="row sp"><h2 style="margin:0">AI try-on result</h2><button class="btn sm sec" data-act="close">✕</button></div>
  ${mock?'<p><span class="badge demo">MOCK — not fal.ai</span></p>':''}
  <img src="${result.final}" class="prev" style="margin-top:10px" alt="AI try-on">
  <p class="mut">Cost: ~4¢ per garment image (fal.ai). This run used <b>${result.steps.length}</b> image${result.steps.length===1?'':'s'} ≈ <b>$${(result.steps.length*0.04).toFixed(2)}</b>.</p>
  <p class="mut">Photos were sent to your try-on Worker (and fal.ai when live) only for this request. Britts Drip does not keep a cloud copy.</p>
  <label>Save as outfit name</label><input id="ai_name" value="AI look · ${new Date().toLocaleDateString()}">
  <div class="row" style="margin-top:12px"><button class="btn" data-act="aisave">Save outfit</button>
  <button class="btn sec" data-act="aiwear">Wear / log today</button>
  <button class="btn sec" data-act="aiplan">Plan today</button></div>`);
}

/* ===== Render ===== */
function render(){document.documentElement.classList.toggle('dark',!!S.settings.dark);document.querySelector('meta[name=theme-color]').content=S.settings.dark?'#0f0f14':'#7c3aed';
 $('#tabs').innerHTML=TABS.map(([k,l])=>`<button data-tab="${k}" class="${S.tab===k?'on':''}" aria-label="${l}">${icon(k)}<span>${l}</span></button>`).join('');
 const v={today:vToday,closet:vCloset,dress:vDress,plan:vPlan,alerts:vAlerts,me:vMe}[S.tab]();$('#view').innerHTML=v;$('#topAct').innerHTML=S.profile.photo?`<img src="${S.profile.photo}" class="avatarImg" style="width:34px;height:34px" data-tab="me">`:'';
 if(S.tab==='dress'){if(S.dressMode==='swipe')initSwipe();else initBoard()}window.scrollTo(0,0)}
const thumb=(i,extra='')=>`<div class="tile ${extra}" data-item="${i.id}"><div class="im" style="background-image:url('${i.img}')"></div>${i.fav?'<span class="fav">♥</span>':''}<div class="nm">${esc(i.name)}</div></div>`;

function vToday(){const s=S.settings;let wx='';
 if(s.lat==null){wx=`<div class="card"><h3 style="margin-top:0">Set your weather</h3><p class="mut">Live forecast from Open-Meteo (free, no account).</p><div class="row"><button class="btn" data-act="gps">Use my location</button></div><label>Or type a city</label><div class="row" style="flex-wrap:nowrap"><input id="city" placeholder="e.g. Atlanta"><button class="btn sm" data-act="city">Go</button></div></div>`}
 else if(!S.wx){wx=`<div class="card wx"><div class="mut">Loading weather for ${esc(s.place)}…</div></div>`}
 else{const c=S.wx.current,d=S.wx.daily;wx=`<div class="card wx"><div class="row sp"><div><div class="mut">${esc(s.place)} · live</div><div class="big">${T(c.temperature_2m)}</div><div>${WMO(c.weather_code)} · feels ${T(c.apparent_temperature)} · wind ${S.settings.units==='F'?Math.round(c.wind_speed_10m*0.621)+' mph':Math.round(c.wind_speed_10m)+' km/h'}</div></div><button class="btn sm sec" style="color:#fff;border-color:#fff8" data-act="wxref">↻</button></div>
 <div class="row" style="margin-top:10px;flex-wrap:nowrap;overflow-x:auto">${d.time.slice(0,7).map((t,k)=>`<div style="min-width:52px;text-align:center;font-size:12px"><div>${new Date(t+'T12:00').toLocaleDateString(undefined,{weekday:'short'})}</div><b>${T(d.temperature_2m_max[k])}</b><div class="mut">${T(d.temperature_2m_min[k])}</div><div class="mut">${d.precipitation_probability_max[k]??0}%☂</div></div>`).join('')}</div></div>`}
 const tc=S.wx?S.wx.current.apparent_temperature:18,rain=S.wx?(S.wx.current.precipitation>0||(S.wx.daily.precipitation_probability_max[0]||0)>=50):false;
 const sug=S.items.length?suggest(tc,rain,S.mood):[];
 const planned=S.plans[today()];
 return `<h2>Hi${S.profile.name?' '+esc(S.profile.name):''} 👋</h2>${wx}
 ${planned?`<div class="card"><div class="row sp"><b>Planned for today</b><button class="btn sm" data-act="wearplan">Wear it</button></div><div class="strip" style="margin-top:8px">${planned.items.map(item).filter(Boolean).map(i=>thumb(i)).join('')}</div></div>`:''}
 <h3>How do you feel?</h3><div class="chips">${Object.keys(MOODS).map(m=>`<button class="chip ${S.mood===m?'on':''}" data-mood="${m}">${m}</button>`).join('')}</div>
 <h3>Suggested outfits ${S.wx?'':'<span class="mut">(set weather for better picks)</span>'}</h3>
 ${!S.items.length?`<div class="card"><p>Your closet is empty. Add a few pieces and I'll start styling you.</p><button class="btn" data-tab="closet">Add clothes</button> <button class="btn sec" data-act="samples">Load sample items</button></div>`:
 sug.length?sug.map((o,k)=>`<div class="card"><div class="row sp"><b>Look ${k+1}</b><span class="mut">${S.mood}${rain?' · rain-ready':''}</span></div><div class="strip" style="margin:8px 0">${o.map(i=>thumb(i)).join('')}</div><div class="row"><button class="btn sm" data-try="${o.map(i=>i.id).join(',')}">Try on</button><button class="btn sm sec" data-wear="${o.map(i=>i.id).join(',')}">Wear today</button><button class="btn sm sec" data-saveo="${o.map(i=>i.id).join(',')}">Save</button></div></div>`).join(''):`<div class="card mut">Not enough clean items for a full look. Check laundry in your closet.</div>`}
 <p class="mut">Picks skip dirty or at-cleaners items and avoid pieces worn in the last 7 days.</p>`}

function vCloset(){let L=S.items.filter(i=>(S.cat==='All'||i.cat===S.cat||(S.cat==='♥'&&i.fav))&&(S.laundry==='All'||(i.laundry||'clean')===S.laundry));
 const q=S.q.toLowerCase();if(q)L=L.filter(i=>[i.name,i.cat,i.color,i.brand,...(i.tags||[]),...(i.occasions||[])].join(' ').toLowerCase().includes(q));
 const so={new:(a,b)=>b.created-a.created,name:(a,b)=>a.name.localeCompare(b.name),worn:(a,b)=>(b.wears||0)-(a.wears||0),least:(a,b)=>(a.wears||0)-(b.wears||0),last:(a,b)=>(a.lastWorn||'').localeCompare(b.lastWorn||''),warm:(a,b)=>(b.warmth||3)-(a.warmth||3)};L.sort(so[S.sort]);
 return `<div class="row sp"><h2>Closet <span class="mut">${S.items.length}</span></h2></div>
 <input id="q" placeholder="Search name, color, tag…" value="${esc(S.q)}">
 <div class="chips" style="margin-top:8px">${['All','♥',...CATS].map(c=>`<button class="chip ${S.cat===c?'on':''}" data-cat="${c}">${c==='♥'?'♥ Favorites':c}</button>`).join('')}</div>
 <div class="row" style="margin:8px 0;flex-wrap:nowrap"><select id="sort">${[['new','Newest'],['name','Name A–Z'],['worn','Most worn'],['least','Least worn'],['last','Longest unworn'],['warm','Warmest']].map(([k,l])=>`<option value="${k}" ${S.sort===k?'selected':''}>${l}</option>`).join('')}</select>
 <select id="lfilter">${['All','clean','dirty','cleaners'].map(k=>`<option value="${k}" ${S.laundry===k?'selected':''}>${k==='All'?'All laundry':k==='cleaners'?'At cleaners':k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></div>
 ${L.length?`<div class="grid">${L.map(i=>thumb(i)).join('')}</div>`:`<div class="card mut">${S.items.length?'No items match.':'Tap + to snap your first piece.'}</div>`}
 ${S.items.some(i=>i.laundry==='dirty')?`<button class="btn sec full" style="margin-top:12px" data-act="washall">Mark all dirty as clean</button>`:''}
 <button class="fab" data-act="add" aria-label="Add item">+</button>`}

function vDress(){if(S.dressMode==='swipe')return vSwipe();const picked=S.dress.map(d=>item(d.id)).filter(Boolean);
 return `<h2>Dress Me</h2>${modeTabs()}<div class="board" id="board">${S.profile.photo&&S.profile.useOnBoard?`<img src="${S.profile.photo}" class="av" style="object-fit:contain;opacity:.95">`:avatarSVG(S.profile.skin)}
 ${S.dress.map((d,k)=>{const i=item(d.id);return i?`<img class="pc" src="${i.img}" data-pc="${k}" style="left:${d.x}px;top:${d.y}px;width:${d.w}px;z-index:${k+2}">`:''}).join('')}</div>
 <p class="mut">Drag pieces to arrange. Tap a piece below to add or remove. Use −/+ to resize the last piece you touched.</p>
 <div class="row"><button class="btn sm sec" data-act="szm">−</button><button class="btn sm sec" data-act="szp">+</button><button class="btn sm sec" data-act="clearb">Clear</button><button class="btn sm" data-act="saveb" ${picked.length?'':'disabled'}>Save outfit</button><button class="btn sm sec" data-act="wearb" ${picked.length?'':'disabled'}>Wear today</button></div>
 <div class="card" style="margin-top:10px"><div class="row sp"><b>Try on for real</b><span class="badge">~$0.04/image</span></div>
 <p class="mut" style="margin:6px 0">Uses your body photo and each selected garment. Multiple pieces are sent one after another (~4¢ each). ${workerBase()?'Worker connected.':'No Worker URL set — configure it in Me (app still works without AI).'}</p>
 <p class="mut"><b>Consent:</b> When you tap below, your body photo and garment photo(s) are sent to your try-on Worker, which forwards them to <b>fal.ai</b> for processing. Do not use photos of other people without permission.</p>
 <button class="btn full" data-act="aitryon" ${picked.length?'':'disabled'}>✨ Try on for real${picked.length?` (${picked.length} piece${picked.length>1?'s':''})`:''}</button>
 <div id="aiload" class="mut" style="display:none;margin-top:8px">Generating… this can take 10–40s per piece.</div></div>
 ${CATS.map(c=>{const L=S.items.filter(i=>i.cat===c);return L.length?`<h3>${c}</h3><div class="strip">${L.map(i=>thumb(i,S.dress.some(d=>d.id===i.id)?'sel':'')).join('')}</div>`:''}).join('')}
 ${S.items.length?'':'<div class="card mut">Add clothes in the Closet tab first.</div>'}
 <h3>Saved outfits</h3>${S.outfits.length?S.outfits.map(o=>`<div class="card"><div class="row sp"><b>${esc(o.name)}</b><span><button class="btn sm sec" data-loado="${o.id}">Load</button> <button class="btn sm sec" data-plano="${o.id}">Plan</button> <button class="btn sm sec" data-delo="${o.id}">✕</button></span></div>${o.aiImage?`<img src="${o.aiImage}" class="prev" style="margin-top:8px;max-height:220px" alt="AI try-on">`:''}<div class="strip" style="margin-top:8px">${o.items.map(item).filter(Boolean).map(i=>thumb(i)).join('')}</div></div>`).join(''):'<p class="mut">No saved outfits yet.</p>'}`}

let drag=null,lastPc=null;
function initBoard(){const b=$('#board');if(!b)return;const W=b.clientWidth;
 S.dress.forEach(d=>{if(d.x==null){}});
 b.onpointerdown=e=>{const t=e.target.closest('.pc');if(!t)return;e.preventDefault();const k=+t.dataset.pc;lastPc=k;drag={k,t,sx:e.clientX,sy:e.clientY,ox:S.dress[k].x,oy:S.dress[k].y};t.setPointerCapture(e.pointerId);t.style.zIndex=99};
 b.onpointermove=e=>{if(!drag)return;const d=S.dress[drag.k];d.x=Math.max(-40,Math.min(W-40,drag.ox+e.clientX-drag.sx));d.y=Math.max(-40,Math.min(400,drag.oy+e.clientY-drag.sy));drag.t.style.left=d.x+'px';drag.t.style.top=d.y+'px'};
 b.onpointerup=b.onpointercancel=()=>{if(drag){drag.t.style.zIndex=drag.k+2;kvSet('dress',S.dress)}drag=null}}
const SLOT={Tops:[0,80,150],Outerwear:[0,70,170],Dresses:[0,80,160],Bottoms:[0,190,130],Shoes:[0,380,110],Accessories:[60,20,70]};
function addToBoard(id){const i=item(id);const k=S.dress.findIndex(d=>d.id===id);if(k>=0){S.dress.splice(k,1)}else{S.dress=S.dress.filter(d=>{const x=item(d.id);return !x||x.cat!==i.cat||i.cat==='Accessories'});const W=$('#board')?.clientWidth||340;const s=SLOT[i.cat]||[0,100,120];S.dress.push({id,w:s[2],x:(W-s[2])/2+s[0],y:s[1]})}
 const order=['Shoes','Bottoms','Tops','Dresses','Outerwear','Accessories'];S.dress.sort((a,b)=>order.indexOf(item(a.id)?.cat)-order.indexOf(item(b.id)?.cat));kvSet('dress',S.dress);render();S.tab==='dress'&&0}
function loadToBoard(ids){S.dress=[];ids.forEach(id=>item(id)&&addToBoardSilent(id));kvSet('dress',S.dress)}
function addToBoardSilent(id){const i=item(id);const s=SLOT[i.cat]||[0,100,120];const W=Math.min(innerWidth-28,612);S.dress.push({id,w:s[2],x:(W-s[2])/2+s[0],y:s[1]});const order=['Shoes','Bottoms','Tops','Dresses','Outerwear','Accessories'];S.dress.sort((a,b)=>order.indexOf(item(a.id)?.cat)-order.indexOf(item(b.id)?.cat))}

function vPlan(){const now=new Date();const m=S.calMonth||new Date(now.getFullYear(),now.getMonth(),1);S.calMonth=m;const first=new Date(m.getFullYear(),m.getMonth(),1),n=new Date(m.getFullYear(),m.getMonth()+1,0).getDate();
 const hist={};S.history.forEach(h=>{(hist[h.date]=hist[h.date]||[]).push(h)});let cells='';for(let k=0;k<first.getDay();k++)cells+='<div></div>';
 for(let d=1;d<=n;d++){const key=ymd(new Date(m.getFullYear(),m.getMonth(),d));const p=S.plans[key],h=hist[key];const src=p||h?.[0]; const img=src?.aiImage||(src?item(src.items[0])?.img:'');cells+=`<button class="d ${key===today()?'t':''}" data-day="${key}">${d}${img?`<div class="th" style="background-image:url('${img}');opacity:${h?1:.55}"></div>`:''}${p&&!h?'<span class="dot"></span>':''}</button>`}
 const recent=[...S.history].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15);
 return `<div class="row sp"><button class="btn sm sec" data-act="pm">‹</button><h2 style="margin:0">${m.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button class="btn sm sec" data-act="nm">›</button></div>
 <div class="cal" style="margin-top:12px">${['S','M','T','W','T','F','S'].map(x=>`<div class="h">${x}</div>`).join('')}${cells}</div>
 <p class="mut">Faded photo + dot = planned. Solid photo = worn. Tap a day to plan or log.</p>
 <div class="card"><div class="row sp"><b>Trip packing list</b><button class="btn sm" data-act="trip">Build</button></div><p class="mut" style="margin:6px 0 0">Uses the destination's forecast and your clean clothes.</p></div>
 <h3>Wear history</h3>${recent.length?recent.map(h=>`<div class="card"><div class="row sp"><b>${new Date(h.date+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</b><button class="btn sm sec" data-delh="${h.id}">Remove</button></div><div class="strip" style="margin-top:6px">${h.items.map(item).filter(Boolean).map(i=>thumb(i)).join('')}</div></div>`).join(''):'<p class="mut">Nothing logged yet.</p>'}`}

function computeAlerts(){const A=[];const season=seasonNow();
 S.items.forEach(i=>{const age=i.lastWorn?daysAgo(i.lastWorn):daysAgo(ymd(new Date(i.created)));
  if(age>=182)A.push({id:'old-'+i.id,kind:'Not worn in 6+ months',item:i,text:`${i.name} hasn't been worn ${i.lastWorn?'since '+i.lastWorn:'since you added it'}. Restyle, donate or resell?`});
  if(i.outdated)A.push({id:'out-'+i.id,kind:'Flagged out of style',item:i,text:`You flagged ${i.name} as out of style. It's hidden from suggestions.`});
  if(i.seasons?.length&&!i.seasons.includes(season)&&i.laundry!=='stored')A.push({id:'sea-'+i.id,kind:'Out of season',item:i,text:`${i.name} is a ${i.seasons.join('/')} piece. Consider storing it for ${season}.`});
  if(i.laundry==='cleaners'&&i.cleanersSince&&daysAgo(i.cleanersSince)>=7)A.push({id:'cln-'+i.id,kind:'Pick up from cleaners',item:i,text:`${i.name} has been at the cleaners ${daysAgo(i.cleanersSince)} days.`})});
 const dirty=S.items.filter(i=>i.laundry==='dirty').length;if(dirty>=5)A.push({id:'laundry-'+dirty,kind:'Laundry day',text:`${dirty} items are dirty. Suggestions are running low.`});
 return A.filter(a=>!S.dismissed.includes(a.id))}
function vAlerts(){const A=computeAlerts();const s=S.items.find(i=>i.cat==='Bottoms')||S.items[0];
 return `<h2>Alerts</h2>${A.length?A.map(a=>`<div class="card"><div class="row sp"><span class="badge">${a.kind}</span><button class="btn sm sec" data-dis="${a.id}">Dismiss</button></div><div class="row" style="margin-top:8px;flex-wrap:nowrap">${a.item?`<img src="${a.item.img}" style="width:56px;height:56px;object-fit:contain;border-radius:10px;background:#fff">`:''}<div>${esc(a.text)}</div></div>${a.item?`<div class="row" style="margin-top:8px"><button class="btn sm sec" data-item="${a.item.id}">Open item</button></div>`:''}</div>`).join(''):'<div class="card mut">You\'re all caught up. Real alerts come from your closet: unworn 6+ months, out of season, flagged out of style, laundry and cleaners.</div>'}
 <h3>Coming soon <span class="badge demo">DEMO</span></h3>
 <div class="card"><div class="row sp"><span class="badge demo">DEMO · Gift search</span></div><p><b>Someone is shopping for you</b><br><span class="mut">Example: a friend viewed your shared size profile for a winter coat (size M). Not real activity.</span></p></div>
 <div class="card"><div class="row sp"><span class="badge sp">Sponsored · DEMO</span><span class="mut">Example Brand Co.</span></div>
 <div class="row" style="margin-top:8px;flex-wrap:nowrap"><div style="position:relative;width:90px;height:150px;flex:none">${avatarSVG(S.profile.skin).replace('class="av"','style="height:150px"')}<div style="position:absolute;left:22px;top:28px;width:46px;height:44px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#ef4444)"></div>${s?`<img src="${s.img}" style="position:absolute;left:25px;top:70px;width:40px">`:''}</div>
 <div><b>30% off rain coats</b><p class="mut">Example ad: a sale coat shown on your avatar${s?' with your own '+esc(s.name):''}. Not a real offer or brand.</p></div></div></div>`}

function vMe(){const s=S.settings,p=S.profile;const tw=S.items.reduce((a,i)=>a+(i.wears||0),0);const priced=S.items.filter(i=>i.price>0);const spent=priced.reduce((a,i)=>a+ +i.price,0);
 return `<h2>Profile</h2><div class="card"><div class="row" style="flex-wrap:nowrap">${p.photo?`<img src="${p.photo}" class="avatarImg">`:`<div class="avatarImg" style="display:flex;align-items:center;justify-content:center">👤</div>`}<div style="flex:1"><input id="pname" placeholder="Your name" value="${esc(p.name)}"></div></div>
 <div class="row" style="margin-top:10px"><label class="btn sm sec" style="margin:0;color:var(--tx)">📷 Body photo<input type="file" accept="image/*" capture="user" id="bodycam" hidden></label><label class="btn sm sec" style="margin:0;color:var(--tx)">🖼 From gallery<input type="file" accept="image/*" id="bodygal" hidden></label>${p.photo?'<button class="btn sm sec" data-act="delbody">Delete photo</button>':''}</div>
 ${p.photo?`<div class="tog"><span>Use my body photo on Dress Me board</span><input type="checkbox" id="useboard" style="width:auto" ${p.useOnBoard?'checked':''}></div>`:''}
 <label>Stylized avatar skin tone</label><div class="chips">${['#f6d7c3','#e8b894','#c68c5f','#8d5a3b','#5a3825','#3b2417'].map(c=>`<button class="chip ${p.skin===c?'on':''}" data-skin="${c}" style="background:${c};width:34px;height:34px;padding:0"></button>`).join('')}</div>
 <p class="mut">By default, body photos stay on this phone only (IndexedDB). If you use <b>Try on for real</b>, photos are sent to your Worker and fal.ai for that request only.</p></div>
 <div class="card"><b>Stats</b><div class="row sp" style="margin-top:8px"><span>${S.items.length} items</span><span>${S.outfits.length} outfits</span><span>${tw} wears</span></div>${priced.length?`<p class="mut">Closet value $${spent.toFixed(0)} · avg cost per wear $${(spent/Math.max(1,priced.reduce((a,i)=>a+(i.wears||0),0))).toFixed(2)}</p>`:''}</div>
 <h3>Settings</h3><div class="card">
 <div class="tog"><span>Dark mode</span><input type="checkbox" id="dark" style="width:auto" ${s.dark?'checked':''}></div>
 <div class="tog"><span>Temperature</span><span class="chips"><button class="chip ${s.units==='F'?'on':''}" data-units="F">°F</button><button class="chip ${s.units==='C'?'on':''}" data-units="C">°C</button></span></div>
 <div class="tog"><span>Weather: ${esc(s.place||'not set')}</span><button class="btn sm sec" data-act="resetwx">Change</button></div>
 <label>AI try-on Worker URL</label>
 <input id="tryon_url" placeholder="https://britts-drip-tryon.YOUR.workers.dev" value="${esc(s.tryonWorker||'')}">
 <p class="mut">Leave blank to disable AI try-on. Local mock: <code>http://127.0.0.1:8788</code>. Live: your Cloudflare Worker. Cost ~4¢ per garment image via fal.ai.</p>
 <div class="row" style="margin-top:8px"><button class="btn sm sec" data-act="saveworker">Save Worker URL</button><button class="btn sm sec" data-act="pingworker">Test connection</button></div>
 <div class="row" style="margin-top:12px"><button class="btn sm sec" data-act="export">Export closet (JSON)</button><label class="btn sm sec" style="margin:0;color:var(--tx)">Import JSON<input type="file" accept="application/json,.json" id="imp" hidden></label></div>
 <button class="btn dng full" style="margin-top:14px" data-act="wipe">Delete all data</button></div>
 <p class="mut">Britts Drip sample app v1. Closet data stays on this device. Weather by Open-Meteo.com. AI try-on by fal.ai when configured.</p>`}

/* ===== Item editor ===== */
let draft=null;
function openSheet(h){$('#sheetIn').innerHTML=h;$('#sheet').classList.remove('hidden')}
function closeSheet(){$('#sheet').classList.add('hidden');draft=null}
function addFlow(){openSheet(`<h2>Add item</h2><p class="mut">Lay the piece flat on a plain background for the best cutout.</p>
 <div class="row"><label class="btn" style="margin:0;color:#fff">📷 Take photo<input type="file" accept="image/*" capture="environment" id="cam" hidden></label><label class="btn sec" style="margin:0;color:var(--tx)">🖼 Choose photos<input type="file" accept="image/*" multiple id="gal" hidden></label></div><button class="btn sec full" style="margin-top:14px" data-act="close">Cancel</button>`)}
async function handleItemFiles(files){if(!files.length)return;if(files.length>1){toast('Adding '+files.length+' items…');for(const f of files){const im=await fileToImg(f);const src=scale(im).toDataURL('image/jpeg',.85);const cut=await quickCutout(src).catch(()=>src);const col=await dominantColor(cut);await saveItem(newItem({img:cut,orig:src,color:col}))}closeSheet();S.tab='closet';render();toast('Added. Tap each to fill in details.');return}
 const im=await fileToImg(files[0]);const src=scale(im).toDataURL('image/jpeg',.85);draft=newItem({img:src,orig:src});draft._new=true;draft.color=await dominantColor(src);editor()}
function newItem(o){return Object.assign({id:uid(),name:'',cat:'Tops',color:'Gray',seasons:[],warmth:3,occasions:['Casual'],tags:[],fav:false,wears:0,lastWorn:'',laundry:'clean',price:'',brand:'',notes:'',outdated:false,created:Date.now()},o)}
function editor(){const d=draft;const cpw=d.price>0?(d.price/Math.max(1,d.wears||0)).toFixed(2):null;
 openSheet(`<div class="row sp"><h2 style="margin:0">${d._new?'New item':'Edit item'}</h2><button class="btn sm sec" data-act="close">✕</button></div>
 <img src="${d.img}" class="prev" style="margin-top:10px" id="prev">
 <div class="row" style="margin-top:8px"><button class="btn sm sec" data-act="cut">✂ Quick cutout</button><button class="btn sm sec" data-act="aicut">✨ AI remove background</button><button class="btn sm sec" data-act="orig">Undo</button></div>
 <p class="mut" id="cutmsg">Quick cutout works best on plain backgrounds. AI removal downloads a free model once (about 40 MB).</p>
 <label>Name</label><input id="f_name" value="${esc(d.name)}" placeholder="e.g. Black denim jacket">
 <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>Category</label><select id="f_cat">${CATS.map(c=>`<option ${d.cat===c?'selected':''}>${c}</option>`).join('')}</select></div><div style="flex:1"><label>Color <span class="sw" style="background:${COLORS[d.color]||'#999'}"></span></label><select id="f_color">${Object.keys(COLORS).map(c=>`<option ${d.color===c?'selected':''}>${c}</option>`).join('')}</select></div></div>
 <label>Seasons</label><div class="chips">${SEASONS.map(s=>`<button class="chip ${d.seasons.includes(s)?'on':''}" data-arr="seasons" data-v="${s}">${s}</button>`).join('')}</div>
 <label>Warmth: <b id="wv">${['','Very light','Light','Medium','Warm','Heavy'][d.warmth]}</b></label><input type="range" min="1" max="5" id="f_warmth" value="${d.warmth}">
 <label>Occasions</label><div class="chips" style="flex-wrap:wrap">${OCC.map(s=>`<button class="chip ${d.occasions.includes(s)?'on':''}" data-arr="occasions" data-v="${s}">${s}</button>`).join('')}</div>
 <label>Tags (comma separated, e.g. waterproof, vintage)</label><input id="f_tags" value="${esc(d.tags.join(', '))}">
 <label>Laundry</label><div class="chips">${[['clean','Clean'],['dirty','Dirty'],['cleaners','At cleaners']].map(([k,l])=>`<button class="chip ${d.laundry===k?'on':''}" data-laundry="${k}">${l}</button>`).join('')}</div>
 <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>Brand</label><input id="f_brand" value="${esc(d.brand)}"></div><div style="flex:1"><label>Price paid ($)</label><input id="f_price" type="number" inputmode="decimal" value="${esc(d.price)}"></div></div>
 <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>Wear count</label><input id="f_wears" type="number" inputmode="numeric" value="${d.wears||0}"></div><div style="flex:1"><label>Last worn</label><input id="f_last" type="date" value="${d.lastWorn||''}"></div></div>
 ${cpw?`<p class="mut">Cost per wear: <b>$${cpw}</b></p>`:''}
 <div class="tog"><span>♥ Favorite</span><input type="checkbox" id="f_fav" style="width:auto" ${d.fav?'checked':''}></div>
 <div class="tog"><span>Flag as out of style</span><input type="checkbox" id="f_out" style="width:auto" ${d.outdated?'checked':''}></div>
 <label>Notes</label><textarea id="f_notes" rows="2">${esc(d.notes)}</textarea>
 <button class="btn full" style="margin-top:14px" data-act="saveitem">Save</button>
 ${d._new?'':`<div class="row" style="margin-top:10px"><button class="btn sm sec" data-act="wearone">Wore it today</button><button class="btn sm sec" data-act="dressone">Dress Me</button><button class="btn sm dng" data-act="delitem">Delete</button></div>`}`)}
function readEditor(){const d=draft;if(!d)return;const g=id=>$('#'+id);if(!g('f_name'))return;d.name=g('f_name').value.trim();d.cat=g('f_cat').value;d.color=g('f_color').value;d.warmth=+g('f_warmth').value;d.tags=g('f_tags').value.split(',').map(s=>s.trim()).filter(Boolean);d.brand=g('f_brand').value;d.price=g('f_price').value;d.wears=+g('f_wears').value||0;d.lastWorn=g('f_last').value;d.fav=g('f_fav').checked;d.outdated=g('f_out').checked;d.notes=g('f_notes').value}

/* ===== Trip ===== */
function tripFlow(){openSheet(`<div class="row sp"><h2 style="margin:0">Trip packing</h2><button class="btn sm sec" data-act="close">✕</button></div><label>Destination city</label><input id="t_city" placeholder="e.g. Miami"><div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>Start</label><input type="date" id="t_s" value="${today()}"></div><div style="flex:1"><label>Nights</label><input type="number" id="t_n" value="3" min="1" max="15"></div></div><button class="btn full" style="margin-top:12px" data-act="tripgo">Build list</button><div id="tripout"></div>`)}
async function buildTrip(){const city=$('#t_city').value.trim(),n=Math.max(1,Math.min(15,+$('#t_n').value||3)),start=$('#t_s').value;if(!city)return toast('Enter a city');const out=$('#tripout');out.innerHTML='<p class="mut">Checking forecast…</p>';
 try{const g=await geocode(city);const f=await forecast(g.lat,g.lon,16);const idx=Math.max(0,f.daily.time.indexOf(start));const days=f.daily.time.slice(idx,idx+n+1);if(!days.length)throw new Error('Dates are beyond the 16-day forecast');
  const hi=Math.max(...f.daily.temperature_2m_max.slice(idx,idx+days.length)),lo=Math.min(...f.daily.temperature_2m_min.slice(idx,idx+days.length)),rain=f.daily.precipitation_probability_max.slice(idx,idx+days.length).some(p=>p>=50);
  const pick=new Map();days.forEach((d,k)=>{const t=(f.daily.temperature_2m_max[idx+k]+f.daily.temperature_2m_min[idx+k])/2;const o=suggest(t,f.daily.precipitation_probability_max[idx+k]>=50,Object.keys(MOODS)[k%6],1)[0]||[];o.forEach(i=>pick.set(i.id,i))});
  const L=[...pick.values()];out.innerHTML=`<div class="card" style="margin-top:12px"><b>${esc(g.place)}</b><p class="mut">${days.length} days · ${T(lo)} to ${T(hi)}${rain?' · rain likely':''} (live forecast)</p><div class="grid">${L.map(i=>thumb(i)).join('')}</div>
  <h3>Also pack</h3><ul>${[rain&&'Umbrella or rain jacket',hi>=27&&'Sunglasses, sunscreen',lo<=5&&'Gloves, warm hat',`${days.length+1} sets underwear & socks`,'Sleepwear','Toiletries & chargers'].filter(Boolean).map(x=>`<li>${x}</li>`).join('')}</ul></div>`}
 catch(e){out.innerHTML=`<p class="mut">${esc(e.message)}</p>`}}

/* ===== Day sheet ===== */
function dayFlow(key){const p=S.plans[key],h=S.history.filter(x=>x.date===key);
 openSheet(`<div class="row sp"><h2 style="margin:0">${new Date(key+'T12:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</h2><button class="btn sm sec" data-act="close">✕</button></div>
 ${h.length?`<h3>Worn</h3>${h.map(x=>`<div class="strip">${x.items.map(item).filter(Boolean).map(i=>thumb(i)).join('')}</div>`).join('')}`:''}
 ${p?`<h3>Planned</h3><div class="strip">${p.items.map(item).filter(Boolean).map(i=>thumb(i)).join('')}</div><div class="row" style="margin-top:8px"><button class="btn sm" data-logplan="${key}">Log as worn</button><button class="btn sm sec" data-unplan="${key}">Remove plan</button></div>`:''}
 <h3>Plan a saved outfit</h3>${S.outfits.length?S.outfits.map(o=>`<button class="chip" style="margin:3px" data-setplan="${key}|${o.id}">${esc(o.name)}</button>`).join(''):'<p class="mut">Save an outfit in Dress Me first.</p>'}
 ${S.dress.length?`<div style="margin-top:10px"><button class="btn sm sec" data-setplan="${key}|board">Plan current Dress Me board</button> <button class="btn sm sec" data-logboard="${key}">Log board as worn</button></div>`:''}`)}

/* ===== Samples (labeled) ===== */
function sampleSVG(cat,color){const c=COLORS[color]||'#888';const sh={Tops:'<path d="M30 10l20 8 20-8 22 16-10 18-10-6v62H28V38l-10 6L8 26z"/>',Bottoms:'<path d="M28 6h44l8 108H56L50 40l-6 74H20z"/>',Outerwear:'<path d="M28 8l22 6 22-6 24 18-8 86H12L4 26z"/><path d="M50 14v98" stroke="#0004" stroke-width="2"/>',Shoes:'<path d="M8 70c10 0 20-20 30-20s16 14 40 18c10 2 14 10 14 18H8z"/>',Dresses:'<path d="M36 6h28l4 24 22 84H10l22-84z"/>',Accessories:'<circle cx="50" cy="60" r="34" fill="none" stroke-width="10" stroke="'+c+'"/>'}[cat];
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><g fill="${c}" stroke="#0003">${sh}</g></svg>`)}
async function loadSamples(){const L=[['Sample white tee','Tops','White',2,['Casual','Lounge'],['Spring','Summer']],['Sample knit sweater','Tops','Beige',4,['Casual','Lounge','Work'],['Fall','Winter']],['Sample silk blouse','Tops','Pink',2,['Work','Date']],['Sample blue jeans','Bottoms','Blue',3,['Casual','Date']],['Sample black trousers','Bottoms','Black',3,['Work','Formal']],['Sample slip dress','Dresses','Purple',1,['Date','Party'],['Summer']],['Sample rain jacket','Outerwear','Yellow',4,['Casual'],[],['waterproof']],['Sample wool coat','Outerwear','Gray',5,['Work','Formal'],['Winter']],['Sample white sneakers','Shoes','White',3,['Casual','Workout']],['Sample ankle boots','Shoes','Brown',4,['Work','Date','Casual'],['Fall','Winter'],['waterproof']]];
 for(const[n,c,col,w,o,s=[],t=[]]of L)await saveItem(newItem({name:n,cat:c,color:col,warmth:w,occasions:o,seasons:s,tags:['sample',...t],img:sampleSVG(c,col),created:Date.now()-Math.random()*2e8}));toast('Sample items added (labeled "Sample")');render()}

/* ===== Events ===== */
document.addEventListener('click',async e=>{const t=e.target.closest('[data-tab],[data-act],[data-mood],[data-cat],[data-item],[data-try],[data-wear],[data-saveo],[data-arr],[data-laundry],[data-units],[data-skin],[data-day],[data-loado],[data-plano],[data-delo],[data-dis],[data-delh],[data-setplan],[data-logplan],[data-unplan],[data-logboard]');if(!t)return;const D=t.dataset;
 if(e.target===$('#sheet')){}
 if(D.tab){closeSheet();S.tab=D.tab;return render()}
 if(D.mood){S.mood=D.mood;return render()}
 if(D.cat){S.cat=D.cat;return render()}
 if(D.item){if(S.tab==='dress'&&t.closest('#view')&&!t.closest('.card')){return addToBoard(D.item)}draft=JSON.parse(JSON.stringify(item(D.item)));return editor()}
 if(D.try){loadToBoard(D.try.split(','));S.tab='dress';return render()}
 if(D.wear){await logWear(D.wear.split(','));return render()}
 if(D.saveo){const o={id:uid(),name:S.mood+' look · '+new Date().toLocaleDateString(),items:D.saveo.split(','),created:Date.now()};S.outfits.unshift(o);await put('outfits',o);return toast('Outfit saved')}
 if(D.arr){readEditor();const a=draft[D.arr];const k=a.indexOf(D.v);k>=0?a.splice(k,1):a.push(D.v);return editor()}
 if(D.laundry){readEditor();draft.laundry=D.laundry;if(D.laundry==='cleaners')draft.cleanersSince=today();return editor()}
 if(D.units){S.settings.units=D.units;await kvSet('settings',S.settings);return render()}
 if(D.skin){S.profile.skin=D.skin;await kvSet('profile',S.profile);return render()}
 if(D.day)return dayFlow(D.day);
 if(D.loado){loadToBoard(S.outfits.find(o=>o.id===D.loado).items);return render()}
 if(D.plano){S.tab='plan';render();return toast('Tap a day to plan it')}
 if(D.delo){if(!confirm('Delete this outfit?'))return;S.outfits=S.outfits.filter(o=>o.id!==D.delo);await del('outfits',D.delo);return render()}
 if(D.dis){S.dismissed.push(D.dis);await kvSet('dismissed',S.dismissed);return render()}
 if(D.delh){S.history=S.history.filter(h=>h.id!==D.delh);await kvSet('history',S.history);return render()}
 if(D.setplan){const[k,o]=D.setplan.split('|');S.plans[k]={items:o==='board'?S.dress.map(d=>d.id):S.outfits.find(x=>x.id===o).items};await kvSet('plans',S.plans);closeSheet();toast('Planned');return render()}
 if(D.logplan){await logWear(S.plans[D.logplan].items,D.logplan);closeSheet();return render()}
 if(D.unplan){delete S.plans[D.unplan];await kvSet('plans',S.plans);closeSheet();return render()}
 if(D.logboard){await logWear(S.dress.map(d=>d.id),D.logboard);closeSheet();return render()}
 const A=D.act;
 if(A==='close')return closeSheet();
 if(A==='add')return addFlow();
 if(A==='gps')return useGPS();
 if(A==='city'){const v=$('#city').value.trim();if(v)setCity(v);return}
 if(A==='wxref')return loadWeather(true);
 if(A==='samples')return loadSamples();
 if(A==='wearplan'){await logWear(S.plans[today()].items);return render()}
 if(A==='washall'){for(const i of S.items)if(i.laundry==='dirty'){i.laundry='clean';await put('items',i)}toast('All clean ✨');return render()}
 if(A==='cut'||A==='aicut'){readEditor();const m=$('#cutmsg');m.textContent=A==='aicut'?'Downloading AI model and removing background… (first time can take a minute)':'Cutting out…';
  try{draft.img=A==='aicut'?await aiCutout(draft.orig||draft.img):await quickCutout(draft.orig||draft.img);draft.color=await dominantColor(draft.img);editor()}catch(err){m.textContent='Background removal failed ('+(err.message||err)+'). Try Quick cutout or keep the photo.'}return}
 if(A==='orig'){readEditor();if(draft.orig)draft.img=draft.orig;return editor()}
 if(A==='saveitem'){readEditor();if(!draft.name)draft.name=draft.color+' '+draft.cat.replace(/s$/,'').toLowerCase();delete draft._new;await saveItem(draft);closeSheet();toast('Saved');return render()}
 if(A==='delitem'){if(!confirm('Delete this item?'))return;S.items=S.items.filter(i=>i.id!==draft.id);await del('items',draft.id);S.dress=S.dress.filter(d=>d.id!==draft.id);closeSheet();return render()}
 if(A==='wearone'){readEditor();await saveItem(draft);await logWear([draft.id]);closeSheet();return render()}
 if(A==='dressone'){readEditor();await saveItem(draft);const id=draft.id;closeSheet();S.tab='dress';render();return addToBoard(id)}
 if(A==='szm'||A==='szp'){const k=lastPc??S.dress.length-1;if(k<0||!S.dress[k])return;S.dress[k].w=Math.max(40,Math.min(320,S.dress[k].w+(A==='szp'?15:-15)));kvSet('dress',S.dress);return render()}
 if(A==='clearb'){S.dress=[];kvSet('dress',S.dress);return render()}
 if(A==='saveb'){const name=prompt('Name this outfit','My outfit '+(S.outfits.length+1));if(name===null)return;const o={id:uid(),name:name||'Outfit',items:S.dress.map(d=>d.id),layout:S.dress,created:Date.now()};S.outfits.unshift(o);await put('outfits',o);toast('Outfit saved');return render()}
 if(A==='wearb'){await logWear(S.dress.map(d=>d.id));return render()}
 if(A==='pm'||A==='nm'){const m=S.calMonth;S.calMonth=new Date(m.getFullYear(),m.getMonth()+(A==='nm'?1:-1),1);return render()}
 if(A==='trip')return tripFlow();
 if(A==='tripgo')return buildTrip();
 if(A==='delbody'){S.profile.photo='';S.profile.useOnBoard=false;await kvSet('profile',S.profile);return render()}
 if(A==='resetwx'){Object.assign(S.settings,{lat:null,lon:null,place:''});S.wx=null;await kvSet('settings',S.settings);S.tab='today';return render()}
 if(A==='export'){const data={app:'britts-drip',version:1,exported:new Date().toISOString(),items:S.items,outfits:S.outfits,plans:S.plans,history:S.history,profile:{...S.profile,photo:''}};const b=new Blob([JSON.stringify(data)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='britts-drip-closet-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();return toast('Exported (body photo not included)')}
 if(A==='aitryon'){
  if(!workerBase()){toast('Set Worker URL in Me first (or use local mock http://127.0.0.1:8788)');S.tab='me';return render()}
  if(!S.profile.photo){toast('Add a body photo in Me first');S.tab='me';return render()}
  if(!S.dress.length)return toast('Add garments to the board first');
  if(!confirm('Send your body photo and '+S.dress.length+' garment photo(s) to the try-on Worker / fal.ai? Cost ≈ $'+(S.dress.length*0.04).toFixed(2)+'.'))return;
  const load=$('#aiload'); if(load) load.style.display='block';
  try{
    const ids=S.dress.map(d=>d.id);
    const result=await runAiTryOn(ids);
    openAiResult(result, ids);
  }catch(err){toast(err.message||'Try-on failed'); if(load) load.style.display='none'}
  return}
 if(A==='aisave'){
  const pack=window.__aiTryOn; if(!pack)return;
  const name=($('#ai_name')?.value||'AI look').trim();
  const o={id:uid(),name,items:pack.garmentIds,aiImage:pack.result.final,aiSteps:pack.result.steps.length,created:Date.now()};
  S.outfits.unshift(o); await put('outfits',o); toast('AI outfit saved'); closeSheet(); return render()}
 if(A==='aiwear'){
  const pack=window.__aiTryOn; if(!pack)return;
  await logWear(pack.garmentIds);
  const o={id:uid(),name:($('#ai_name')?.value||'AI look').trim(),items:pack.garmentIds,aiImage:pack.result.final,aiSteps:pack.result.steps.length,created:Date.now()};
  if(!S.outfits.some(x=>x.aiImage===o.aiImage)){S.outfits.unshift(o); await put('outfits',o)}
  closeSheet(); return render()}
 if(A==='aiplan'){
  const pack=window.__aiTryOn; if(!pack)return;
  S.plans[today()]={items:pack.garmentIds,aiImage:pack.result.final};
  await kvSet('plans',S.plans);
  const o={id:uid(),name:($('#ai_name')?.value||'AI look').trim(),items:pack.garmentIds,aiImage:pack.result.final,aiSteps:pack.result.steps.length,created:Date.now()};
  S.outfits.unshift(o); await put('outfits',o);
  toast('Planned for today'); closeSheet(); S.tab='plan'; return render()}
 if(A==='saveworker'){
  const v=($('#tryon_url')?.value||'').trim().replace(/\/$/,'');
  S.settings.tryonWorker=v; await kvSet('settings',S.settings); toast(v?'Worker URL saved':'AI try-on disabled'); return render()}
 if(A==='pingworker'){
  const base=($('#tryon_url')?.value||workerBase()).trim().replace(/\/$/,'');
  if(!base) return toast('Enter a Worker URL first');
  try{const r=await fetch(base+'/health'); const j=await r.json(); toast(j.mock?'Mock Worker OK':'Worker OK'+(j.hasKey?' (key set)':' (no FAL_KEY yet)'))}
  catch(err){toast('Could not reach Worker: '+(err.message||err))}
  return}
 if(A==='wipe'){if(!confirm('Delete ALL items, outfits, photos and history from this device?'))return;for(const s of STORES)await clr(s);location.reload()}
});
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')closeSheet()});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;const pos=e.target.selectionStart;render();const q=$('#q');q.focus();q.setSelectionRange(pos,pos)}if(e.target.id==='f_warmth')$('#wv').textContent=['','Very light','Light','Medium','Warm','Heavy'][e.target.value]});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='city'){const v=e.target.value.trim();if(v)setCity(v)}});
document.addEventListener('change',async e=>{const id=e.target.id;
 if(id==='sort'){S.sort=e.target.value;return render()}if(id==='lfilter'){S.laundry=e.target.value;return render()}
 if(id==='cam'||id==='gal'){try{await handleItemFiles([...e.target.files])}catch(err){toast('Could not read photo')}return}
 if(id==='bodycam'||id==='bodygal'){const f=e.target.files[0];if(!f)return;const im=await fileToImg(f);S.profile.photo=scale(im,900).toDataURL('image/jpeg',.85);await kvSet('profile',S.profile);toast('Body photo saved on this device');return render()}
 if(id==='useboard'){S.profile.useOnBoard=e.target.checked;await kvSet('profile',S.profile);return}
 if(id==='pname'){S.profile.name=e.target.value.trim();await kvSet('profile',S.profile);return}
 if(id==='dark'){S.settings.dark=e.target.checked;await kvSet('settings',S.settings);return render()}
 if(id==='imp'){const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(d.app!=='britts-drip')throw 0;for(const i of d.items||[])await put('items',i);for(const o of d.outfits||[])await put('outfits',o);S.plans={...S.plans,...(d.plans||{})};S.history=[...S.history,...(d.history||[]).filter(h=>!S.history.some(x=>x.id===h.id))];await kvSet('plans',S.plans);await kvSet('history',S.history);await boot(true);toast('Imported '+(d.items||[]).length+' items')}catch(err){toast('Not a Britts Drip export file')}}
});

/* ===== Boot ===== */
async function boot(reload){if(!reload)await openDB();S.items=(await all('items')).sort((a,b)=>b.created-a.created);S.outfits=(await all('outfits')).sort((a,b)=>b.created-a.created);S.plans=await kvGet('plans',{});S.history=await kvGet('history',[]);S.profile=Object.assign(S.profile,await kvGet('profile',{}));S.settings=Object.assign(S.settings,await kvGet('settings',{}));S.dress=await kvGet('dress',[]);S.dismissed=await kvGet('dismissed',[]);S.dressMode=await kvGet('dressMode','board');S.swipe=await kvGet('swipe',{t:0,b:0});render();loadWeather()}
boot().catch(e=>{$('#view').innerHTML='<div class="card">Storage unavailable: '+esc(e.message)+'. Private browsing can block it.</div>'});
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();

/* ===== Swipe try-on (free, on-device overlay) ===== */
const SW_TOP=['Tops','Outerwear','Dresses'],SW_BOT=['Bottoms'];
const SW_ZONE=i=>SW_TOP.includes(i.cat)?'t':SW_BOT.includes(i.cat)?'b':null;
const SW_DEF={t:{x:50,y:34,s:46},b:{x:50,y:66,s:40},Dresses:{x:50,y:46,s:52},Outerwear:{x:50,y:34,s:52}};
function swList(z){return S.items.filter(i=>SW_ZONE(i)===z)}
function swCur(z){const L=swList(z);if(!L.length)return null;const n=L.length+1;const k=((S.swipe[z]%n)+n)%n;return k===L.length?null:L[k]}/* last slot = none */
function swFit(i){const z=SW_ZONE(i);return Object.assign({},SW_DEF[i.cat]||SW_DEF[z],i.fit||{})}
function swImg(i){return i.cut||i.img}
function modeTabs(){const m=S.dressMode||'board';return `<div class="seg" style="display:flex;gap:6px;margin:0 0 10px"><button class="chip ${m==='board'?'on':''}" data-act="mode_board">Board</button><button class="chip ${m==='swipe'?'on':''}" data-act="mode_swipe">Swipe (free)</button></div>`}
function swLayer(i,z){if(!i)return '';const f=swFit(i);return `<img class="swg" id="swg_${z}" src="${swImg(i)}" alt="" draggable="false" style="left:${f.x}%;top:${f.y}%;width:${f.s}%;z-index:${z==='t'?4:3}">`}
function vSwipe(){const t=swCur('t'),b=swCur('b'),Lt=swList('t'),Lb=swList('b');const adj=S.swAdj||'';
 const pos=(z,i,L)=>i?`${esc(i.name||i.cat)} · ${L.indexOf(i)+1}/${L.length}`:(L.length?`None · ${L.length+1}/${L.length+1}`:'No items');
 const need=S.items.filter(i=>SW_ZONE(i)&&!i.cut).length;
 const body=S.profile.photo?`<img src="${S.profile.photo}" class="swbody" alt="" draggable="false">`:`<div class="swbody">${avatarSVG(S.profile.skin)}</div>`;
 const af=adj&&(adj==='t'?t:b);const f=af?swFit(af):null;
 return `<h2>Dress Me</h2>${modeTabs()}
 <div class="swstage" id="swstage">${body}${swLayer(b,'b')}${swLayer(t,'t')}
  <div class="swz" data-z="t"><button class="swa l" data-act="sw_t_prev" aria-label="Previous top">‹</button><span class="swlab">${pos('t',t,Lt)}</span><button class="swa r" data-act="sw_t_next" aria-label="Next top">›</button></div>
  <div class="swz" data-z="b"><button class="swa l" data-act="sw_b_prev" aria-label="Previous bottom">‹</button><span class="swlab">${pos('b',b,Lb)}</span><button class="swa r" data-act="sw_b_next" aria-label="Next bottom">›</button></div>
  ${adj?`<div class="swadjtag">Adjusting ${adj==='t'?'top':'bottom'}: drag / pinch</div>`:''}</div>
 <p class="mut">Swipe the top half for tops, the bottom half for bottoms. Free and instant, nothing leaves your phone.</p>
 <div class="row"><button class="btn sm sec ${adj==='t'?'on':''}" data-act="sw_adj_t" ${t?'':'disabled'}>Adjust top</button><button class="btn sm sec ${adj==='b'?'on':''}" data-act="sw_adj_b" ${b?'':'disabled'}>Adjust bottom</button><button class="btn sm" data-act="sw_save" ${t||b?'':'disabled'}>Save outfit</button><button class="btn sm sec" data-act="sw_wear" ${t||b?'':'disabled'}>Wear today</button></div>
 ${f?`<div class="card" style="margin-top:10px"><label>Left/right</label><input type="range" id="swr_x" min="0" max="100" step="0.5" value="${f.x}"><label>Up/down</label><input type="range" id="swr_y" min="0" max="100" step="0.5" value="${f.y}"><label>Size</label><input type="range" id="swr_s" min="10" max="120" step="0.5" value="${f.s}"><div class="row" style="margin-top:8px"><button class="btn sm" data-act="sw_fit_save">Save fit for this item</button><button class="btn sm sec" data-act="sw_fit_reset">Reset</button><button class="btn sm sec" data-act="sw_adj_done">Done</button></div></div>`:''}
 <div class="card" style="margin-top:10px"><div class="row sp"><b>Cutouts</b><span class="badge">free</span></div><p class="mut" style="margin:6px 0" id="swcutmsg">${need?need+' top/bottom item(s) still have a background.':'All tops and bottoms have cutouts.'} Removal runs on this phone (first run downloads a ~40 MB model once).</p><button class="btn sm sec" data-act="sw_cutall" ${need?'':'disabled'}>Make cutouts</button></div>
 <p class="mut" style="margin-top:10px">Want a realistic fit? Switch to Board and use “Try on for real” (~4¢).</p>
 ${S.items.length?'':'<div class="card mut">Add clothes in the Closet tab first.</div>'}`}
function swSetFit(z,f){const g=$('#swg_'+z);if(g){g.style.left=f.x+'%';g.style.top=f.y+'%';g.style.width=f.s+'%'}}
let swLive=null;
function initSwipe(){const st=$('#swstage');if(!st)return;const P=new Map();let g=null;
 st.addEventListener('pointerdown',e=>{if(e.target.closest('.swa'))return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});st.setPointerCapture?.(e.pointerId);
  const r=st.getBoundingClientRect();const adj=S.swAdj;
  if(adj){const i=swCur(adj);if(!i)return;const f=swLive&&swLive.id===i.id?swLive.f:swFit(i);swLive={id:i.id,z:adj,f:{...f}};g={mode:'adj',r,f0:{...swLive.f},p0:[...P.values()].map(p=>({...p})),d0:0}}
  else g={mode:'sw',z:(e.clientY-r.top)<r.height/2?'t':'b',x0:e.clientX,y0:e.clientY}});
 st.addEventListener('pointermove',e=>{if(!P.has(e.pointerId)||!g)return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});e.preventDefault();
  if(g.mode==='adj'){const pts=[...P.values()];if(pts.length>=2){const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(!g.d0){g.d0=d;g.f0={...swLive.f}}swLive.f.s=Math.max(10,Math.min(120,g.f0.s*d/g.d0))}
   else{const p0=g.p0[0]||pts[0];swLive.f.x=Math.max(0,Math.min(100,g.f0.x+(pts[0].x-p0.x)/g.r.width*100));swLive.f.y=Math.max(0,Math.min(100,g.f0.y+(pts[0].y-p0.y)/g.r.height*100))}
   swSetFit(swLive.z,swLive.f);['x','y','s'].forEach(k=>{const s=$('#swr_'+k);if(s)s.value=swLive.f[k]})}});
 const up=e=>{if(!P.has(e.pointerId))return;P.delete(e.pointerId);if(!g)return;
  if(g.mode==='sw'){const dx=e.clientX-g.x0,dy=e.clientY-g.y0;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3)swStep(g.z,dx<0?1:-1);g=null}
  else{if(P.size===0)g=null;else{g.p0=[...P.values()].map(p=>({...p}));g.f0={...swLive.f};g.d0=0}}};
 st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up)}
function swStep(z,d){S.swipe[z]=(S.swipe[z]||0)+d;const n=swList(z).length+1;S.swipe[z]=((S.swipe[z]%n)+n)%n;kvSet('swipe',S.swipe);swLive=null;render()}
function swIds(){return [swCur('t'),swCur('b')].filter(Boolean).filter((i,k,a)=>!(i.cat==='Dresses'&&k===1)).map(i=>i.id)}
async function makeCutout(src,onMsg){try{onMsg&&onMsg('Removing background (AI, on-device)…');return await Promise.race([aiCutout(src),new Promise((_,rj)=>setTimeout(()=>rj(new Error('timeout')),90000))])}catch(e){onMsg&&onMsg('AI cutout unavailable, using quick cutout…');return await quickCutout(src)}}
let swQ=Promise.resolve();
function queueCutout(id){swQ=swQ.then(async()=>{const i=item(id);if(!i||i.cut||!SW_ZONE(i))return;try{i.cut=await makeCutout(i.orig||i.img);await put('items',i)}catch(e){}}).catch(()=>{});return swQ}
const _saveItem0=saveItem;saveItem=async function(it){await _saveItem0(it);if(!it.cut&&SW_ZONE(it))queueCutout(it.id)};
document.addEventListener('click',async e=>{const t=e.target.closest('[data-act]');if(!t)return;const A=t.dataset.act;if(!A.startsWith('sw_')&&!A.startsWith('mode_'))return;e.stopImmediatePropagation();
 if(A==='mode_board'||A==='mode_swipe'){S.dressMode=A.slice(5);S.swAdj='';swLive=null;await kvSet('dressMode',S.dressMode);return render()}
 const m=A.match(/^sw_([tb])_(prev|next)$/);if(m)return swStep(m[1],m[2]==='next'?1:-1);
 if(A==='sw_adj_t'||A==='sw_adj_b'){const z=A.slice(-1);S.swAdj=S.swAdj===z?'':z;swLive=null;return render()}
 if(A==='sw_adj_done'){S.swAdj='';swLive=null;return render()}
 if(A==='sw_fit_save'||A==='sw_fit_reset'){const i=swCur(S.swAdj);if(!i)return;if(A==='sw_fit_reset'){delete i.fit;swLive=null}else{i.fit={...(swLive&&swLive.id===i.id?swLive.f:swFit(i))}}await put('items',i);toast(A==='sw_fit_reset'?'Fit reset':'Fit saved for '+(i.name||i.cat));return render()}
 if(A==='sw_save'){const ids=swIds();if(!ids.length)return;const name=prompt('Name this outfit','My outfit '+(S.outfits.length+1));if(name===null)return;const o={id:uid(),name:name||'Outfit',items:ids,created:Date.now()};S.outfits.unshift(o);await put('outfits',o);toast('Outfit saved');return render()}
 if(A==='sw_wear'){const ids=swIds();if(ids.length)await logWear(ids);return render()}
 if(A==='sw_cutall'){const L=S.items.filter(i=>SW_ZONE(i)&&!i.cut);t.disabled=true;const msg=$('#swcutmsg');let k=0;for(const i of L){k++;const say=s=>{if(msg)msg.textContent=`${k}/${L.length}: ${s}`};try{i.cut=await makeCutout(i.orig||i.img,say);await put('items',i)}catch(err){}}toast('Cutouts done');return render()}
},true);
document.addEventListener('input',e=>{const m=e.target.id&&e.target.id.match(/^swr_([xys])$/);if(!m)return;const i=swCur(S.swAdj);if(!i)return;if(!swLive||swLive.id!==i.id)swLive={id:i.id,z:S.swAdj,f:swFit(i)};swLive.f[m[1]]=+e.target.value;swSetFit(S.swAdj,swLive.f)});
