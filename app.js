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
const OCC=['Casual','Work','Date','Dinner','Party','Workout','Formal','Lounge','Sleep'];
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
function shadeHex(h,a){h=String(h||'#e8b894').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16)||0xe8b894;const f=v=>Math.max(0,Math.min(255,Math.round(a<0?v*(1+a):v+(255-v)*a)));return '#'+[n>>16,(n>>8)&255,n&255].map(f).map(v=>v.toString(16).padStart(2,'0')).join('')}
const AV_HAIR=['long','bob','bun','pixie','curly','ponytail'],AV_BODY=['slim','average','curvy','athletic'],AV_HC={Black:'#1c1512',Brown:'#4a2f1f',Auburn:'#7a3420',Blonde:'#d8b26e',Red:'#a0381e',Gray:'#9a958f',Pink:'#e58fb5'};
const POSES={casual:{n:'Casual',la:5,lf:-3,ra:9,rf:-14,ll:0,lk:0,rl:5,rk:6,head:3,fig:-1},
 gym:{n:'Gym',la:40,lf:-100,ra:40,rf:-100,ll:7,lk:0,rl:7,rk:0,head:0,fig:0},
 dinner:{n:'Dinner',la:38,lf:-102,ra:3,rf:-4,ll:-5.5,lk:1,rl:2.5,rk:-1,head:-4,fig:0},
 work:{n:'Work',la:2,lf:-1,ra:2,rf:-1,ll:1.5,lk:0,rl:1.5,rk:0,head:0,fig:0},
 lounge:{n:'Lounge',la:10,lf:-22,ra:6,rf:-8,ll:3,lk:4,rl:-1,rk:7,head:7,fig:3}};
const POSE_D={casual:{t:{},b:{dx:.6},s:{dx:1,ds:1}},gym:{t:{ds:1},b:{ds:3},s:{ds:4}},dinner:{t:{},b:{ds:-3,dx:.5},s:{dx:1.5,ds:-7}},work:{t:{},b:{},s:{}},lounge:{t:{dx:2.2,ds:0},b:{dx:1.2},s:{dx:.3}}};
const POSE_KW=[['gym',/gym|athlet|workout|sport|running|yoga|active/i],['dinner',/formal|dinner|date|party|evening|cocktail|gala/i],['work',/\bwork\b|office|business|interview/i],['lounge',/lounge|pajama|pj|sleep|cozy/i],['casual',/casual/i]];
function poseFor(ids){const sc={};for(const id of ids){const i=item(id);if(!i)continue;const words=[...(i.occasions||[]),...(i.tags||[])];const w=i.cat==='Tops'||i.cat==='Dresses'?1.5:1;for(const[p,re]of POSE_KW)if(words.some(x=>re.test(x)))sc[p]=(sc[p]||0)+w*(p==='casual'?.6:1)}
 let best='casual',bv=0;for(const p in sc)if(sc[p]>bv){bv=sc[p];best=p}return best}
function curIds(){return S.tab==='dress'&&S.dressMode==='swipe'?swIds():S.dress.map(d=>d.id)}
function curPose(){const o=S.poseOverride;return o&&POSES[o]?o:poseFor(curIds())}
function poseDelta(z,p){return (POSE_D[p||curPose()]||{})[z]||{}}
function segT(k,p){const P=POSES[p]||POSES.casual,v=P[k]||0;return `rotate(${k[0]==='r'&&k!=='rk'&&k!=='rf'&&k!=='rl'&&k!=='ra'?v:(k[0]==='r'?-v:v)}deg)`}
function avatarSVG(skin){const P=S.profile||{},sk=skin||'#e8b894',hc=AV_HC[P.hairColor]||P.hairColor||AV_HC.Brown,hs=AV_HAIR.includes(P.hair)?P.hair:'long';const pose=S.lastPose||'casual';
 const B={slim:[14,8.5,12.5],average:[15.5,10,14.5],curvy:[15.5,9.5,17.5],athletic:[17.5,11.5,14]}[AV_BODY.includes(P.body)?P.body:'average'];const[sh,w,h]=B,c=50;
 const d=shadeHex(sk,-.22),l=shadeHex(sk,.18),hd=shadeHex(hc,-.3),hl=shadeHex(hc,.25),uw=shadeHex(sk,.55),uwd=shadeHex(sk,.3),lip='#c46a72';
 const g=`av${sk.replace('#','')}${hc.replace('#','')}`,L=c-sh,R=c+sh,F=`url(#s${g})`;
 const seg=(k,ox,oy,inner)=>`<g class="seg" data-seg="${k}" style="transform-origin:${ox}px ${oy}px;transform:${segT(k,pose)}">${inner}</g>`;
 const torso=`M${c-4},33 C${c-4},37 ${L+3},38 ${L},41 C${L-1.5},44 ${L-1},50 ${L+2},55 C${c-w-1},70 ${c-w},84 ${c-w},92 C${c-w-1},98 ${c-h},104 ${c-h},112 C${c-h+1},117 ${c-4},120 ${c},120 C${c+4},120 ${c+h-1},117 ${c+h},112 C${c+h},104 ${c+w+1},98 ${c+w},92 C${c+w},84 ${c+w+1},70 ${R-2},55 C${R+1},50 ${R+1.5},44 ${R},41 C${R-3},38 ${c+4},37 ${c+4},33 Z`;
 const arm=s=>{const x=c+s*sh,k=s<0?'l':'r';const up=`M${x-s*0.5},41.5 C${x+s*4},45 ${x+s*5},60 ${x+s*5.6},77 L${x+s*1.7},77 C${x+s*1.2},66 ${x-s*.5},58 ${x-s*2.5},53 Z`;
  const fo=`M${x+s*5.6},75 C${x+s*6.2},88 ${x+s*7.5},100 ${x+s*8.5},113 L${x+s*5.5},114 C${x+s*4.2},102 ${x+s*2.5},88 ${x+s*1.7},75 Z`;const hx=c+s*(sh+7);
  return seg(k+'a',x+s*.5,44,`<path d="${up}"/>`+seg(k+'f',x+s*3.65,76,`<path d="${fo}"/><ellipse cx="${hx}" cy="118" rx="2.6" ry="4.6" transform="rotate(${-s*10} ${hx} 118)"/><circle cx="${x+s*3.65}" cy="76" r="2.1" stroke="none"/>`))};
 const leg=s=>{const k=s<0?'l':'r',X=v=>c+s*v;const up=`M${X(h)},106 C${X(h)},126 ${X(10)},140 ${X(8.5)},156 L${X(2.5)},156 C${X(2)},140 ${X(1.2)},128 ${X(0)},119 L${X(0)},106 Z`;
  const lo=`M${X(8.5)},155 C${X(8)},170 ${X(7)},188 ${X(5.5)},201 L${X(2)},201 C${X(2.5)},186 ${X(2)},168 ${X(2.5)},155 Z`;const ft=`M${X(5.5)},201 C${X(9)},202 ${X(10)},205 ${X(7)},206 L${X(2)},206 C${X(1.6)},204 ${X(1.8)},202 ${X(2)},201 Z`;
  return seg(k+'l',X(5.5),110,`<path d="${up}"/>`+seg(k+'k',X(5.5),156,`<path d="${lo}"/><path d="${ft}"/><ellipse cx="${X(5.5)}" cy="156" rx="3.2" ry="2.4" stroke="none"/>`))};
 const back={long:`<path d="M${c-11},16 C${c-15},40 ${c-14},56 ${c-12},62 L${c+12},62 C${c+14},56 ${c+15},40 ${c+11},16 Z" fill="url(#h${g})"/>`,bob:`<path d="M${c-11.5},16 C${c-13},28 ${c-12.5},34 ${c-10},37 L${c+10},37 C${c+12.5},34 ${c+13},28 ${c+11.5},16 Z" fill="url(#h${g})"/>`,bun:`<circle cx="${c}" cy="5" r="6" fill="url(#h${g})"/>`,pixie:'',curly:`<g fill="url(#h${g})">${[[-11,14],[-13,22],[-13,30],[-11,37],[11,14],[13,22],[13,30],[11,37],[-6,6],[0,4],[6,6]].map(([x,y])=>`<circle cx="${c+x}" cy="${y}" r="5.5"/>`).join('')}</g>`,ponytail:`<path d="M${c+6},8 C${c+18},6 ${c+19},26 ${c+15},44 C${c+14},34 ${c+12},22 ${c+7},14 Z" fill="url(#h${g})"/>`}[hs];
 const front={long:`M${c-10.5},20 C${c-11},8 ${c-4},5 ${c},5 C${c+6},5 ${c+11.5},9 ${c+10.5},22 C${c+8},13 ${c+2},11 ${c-3},13 C${c-6},14 ${c-9},17 ${c-10.5},20 Z`,bob:`M${c-11},22 C${c-12},8 ${c-4},5 ${c},5 C${c+5},5 ${c+12},8 ${c+11},22 C${c+9},15 ${c+4},13 ${c},14 C${c-5},13 ${c-9},15 ${c-11},22 Z`,bun:`M${c-10.2},19 C${c-10.5},9 ${c-4},6.5 ${c},6.5 C${c+4},6.5 ${c+10.5},9 ${c+10.2},19 C${c+7},12 ${c-7},12 ${c-10.2},19 Z`,pixie:`M${c-10.4},20 C${c-11},8 ${c-3},5 ${c+1},5.5 C${c+8},6 ${c+11},11 ${c+10.4},18 C${c+6},14 ${c+2},11 ${c-4},14 C${c-7},15 ${c-9},17 ${c-10.4},20 Z`,curly:`M${c-10.5},20 C${c-11},8 ${c-4},5 ${c},5 C${c+4},5 ${c+11},8 ${c+10.5},20 C${c+7},12 ${c-7},12 ${c-10.5},20 Z`,ponytail:`M${c-10.2},19 C${c-10.5},9 ${c-4},6.5 ${c},6.5 C${c+4},6.5 ${c+10.5},9 ${c+10.2},19 C${c+7},12 ${c-7},12 ${c-10.2},19 Z`}[hs];
 const face=`<ellipse cx="${c}" cy="19.5" rx="9.6" ry="12.2" fill="url(#f${g})" stroke="${d}" stroke-width=".35"/>
 <path d="M${c-6.2},16.3 q2.2,-1.4 4.3,-.2" stroke="${hd}" stroke-width=".8" fill="none" stroke-linecap="round"/><path d="M${c+1.9},16.1 q2.1,-1.2 4.3,.2" stroke="${hd}" stroke-width=".8" fill="none" stroke-linecap="round"/>
 <ellipse cx="${c-3.9}" cy="19.6" rx="1.5" ry="1" fill="#fff"/><ellipse cx="${c+3.9}" cy="19.6" rx="1.5" ry="1" fill="#fff"/><circle cx="${c-3.8}" cy="19.6" r=".85" fill="#2a1c15"/><circle cx="${c+4}" cy="19.6" r=".85" fill="#2a1c15"/>
 <path d="M${c-5.5},19 q1.6,-1.3 3.2,0M${c+2.3},19 q1.6,-1.3 3.2,0" stroke="#2a1c15" stroke-width=".45" fill="none"/><path d="M${c-.3},21 q-.9,2.6 .2,3.1 q.8,.2 1,-.2" stroke="${d}" stroke-width=".4" fill="none"/>
 <path d="M${c-2.6},27 q1.3,-.9 2.6,-.3 q1.3,-.6 2.6,.3 q-1.3,1.6 -2.6,1.5 q-1.3,.1 -2.6,-1.5 Z" fill="${lip}" opacity=".85"/>
 <ellipse cx="${c-6}" cy="24" rx="2" ry="1.1" fill="#e98a8a" opacity=".18"/><ellipse cx="${c+6}" cy="24" rx="2" ry="1.1" fill="#e98a8a" opacity=".18"/>
 <path d="${front}" fill="url(#h${g})"/>${hs==='bun'||hs==='ponytail'?`<path d="M${c-4},8 C${c-1},7 ${c+3},7.5 ${c+6},9" stroke="${hl}" stroke-width=".5" fill="none" opacity=".7"/>`:''}`;
 const sk2=`fill="${F}" stroke="${d}" stroke-width=".35" stroke-linejoin="round"`;
 return `<svg class="av" viewBox="0 0 100 220" xmlns="http://www.w3.org/2000/svg" aria-label="Avatar" data-pose="${pose}"><defs>
 <linearGradient id="s${g}" x1="0" x2="1"><stop offset="0" stop-color="${d}"/><stop offset=".35" stop-color="${sk}"/><stop offset=".55" stop-color="${l}"/><stop offset=".72" stop-color="${sk}"/><stop offset="1" stop-color="${d}"/></linearGradient>
 <radialGradient id="f${g}" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="${l}"/><stop offset=".7" stop-color="${sk}"/><stop offset="1" stop-color="${d}"/></radialGradient>
 <linearGradient id="h${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hl}"/><stop offset=".6" stop-color="${hc}"/><stop offset="1" stop-color="${hd}"/></linearGradient>
 <linearGradient id="u${g}" x1="0" x2="1"><stop offset="0" stop-color="${uwd}"/><stop offset=".5" stop-color="${uw}"/><stop offset="1" stop-color="${uwd}"/></linearGradient>
 <radialGradient id="g${g}"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
 <ellipse cx="50" cy="206" rx="22" ry="4.5" fill="url(#g${g})"/>
 ${seg('fig',50,205,`${seg('head',50,32,back)}
 <g ${sk2}>${leg(-1)}${leg(1)}${arm(-1)}${arm(1)}<path d="${torso}"/><rect x="${c-3.4}" y="28" width="6.8" height="10" rx="3"/></g>
 <g fill="none" stroke="${d}" stroke-width=".35" opacity=".6"><path d="M${c-3},56 C${c-2},60 ${c+2},60 ${c+3},56"/><path d="M${c},86 v3"/></g>
 <path d="M${L+2.5},53.5 Q${c-6},48.5 ${c},55 Q${c+6},48.5 ${R-2.5},53.5 L${R-3.2},63 Q${c},65.5 ${L+3.2},63 Z" fill="url(#u${g})" stroke="${uwd}" stroke-width=".4"/>
 <path d="M${c-h+0.4},105 C${c-6},104 ${c+6},104 ${c+h-0.4},105 C${c+h-1},110 ${c+6},116 ${c+1.6},121 L${c-1.6},121 C${c-6},116 ${c-h+1},110 ${c-h+0.4},105 Z" fill="url(#u${g})" stroke="${uwd}" stroke-width=".4"/>
 ${seg('head',50,32,face)}`)}
 </svg>`}
function applyPose(p,animate){p=POSES[p]?p:'casual';document.querySelectorAll('svg.av').forEach(svg=>{if(animate)svg.classList.add('posing');svg.dataset.pose=p;svg.querySelectorAll('[data-seg]').forEach(el=>el.style.transform=segT(el.dataset.seg,p));if(animate)setTimeout(()=>svg.classList.remove('posing'),700)});
 const st=$('#swstage');if(st){if(animate){st.classList.add('posing');setTimeout(()=>st.classList.remove('posing'),700)}[['t',swCur('t')],['b',swCur('b')],['s',swCur('s')]].forEach(([z,i])=>{if(i)swSetFit(z,swLive&&swLive.id===i.id?swLive.f:swFit(i))})}
 const bd=$('#board');if(bd){bd.classList.toggle('posing',!!animate);bd.querySelectorAll('img.pc').forEach(im=>{const d=S.dress[+im.dataset.pc];const it=d&&item(d.id);const z=it&&(SW_ZONE(it)||'');const D=(POSE_D[p]||{})[z]||{};im.style.transform=`translateX(${(D.dx||0)*bd.clientWidth/100}px) scale(${1+(D.ds||0)/40})`})}
 S.lastPose=p;document.querySelectorAll('[data-act=pose_set]').forEach(b=>b.classList.toggle('on',(S.poseOverride||'auto')===b.dataset.k));const a=$('#poseauto');if(a)a.textContent=POSES[p].n}
function poseChips(){const o=S.poseOverride||'auto';return `<div class="chips posechips"><button class="chip ${o==='auto'?'on':''}" data-act="pose_set" data-k="auto">Auto · <span id="poseauto">${POSES[curPose()].n}</span></button>${Object.entries(POSES).map(([k,v])=>`<button class="chip ${o===k?'on':''}" data-act="pose_set" data-k="${k}">${v.n}</button>`).join('')}</div>`}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-act="pose_set"]');if(!t)return;e.stopImmediatePropagation();S.poseOverride=t.dataset.k==='auto'?'':t.dataset.k;kvSet('poseOverride',S.poseOverride);applyPose(curPose(),true)},true);
function avatarOptions(p){return `<label>Avatar hairstyle</label><div class="chips">${AV_HAIR.map(x=>`<button class="chip ${(p.hair||'long')===x?'on':''}" data-act="av_set" data-k="hair|${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div>
 <label>Hair color</label><div class="chips">${Object.entries(AV_HC).map(([n,v])=>`<button class="chip ${(p.hairColor||'Brown')===n?'on':''}" data-act="av_set" data-k="hairColor|${n}" style="background:${v};width:34px;height:34px;padding:0" aria-label="${n}"></button>`).join('')}</div>
 <label>Body shape</label><div class="chips">${AV_BODY.map(x=>`<button class="chip ${(p.body||'average')===x?'on':''}" data-act="av_set" data-k="body|${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div>
 <div class="avprev">${avatarSVG(p.skin)}</div>`}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-act="av_set"]');if(!t)return;e.stopImmediatePropagation();const[k,v]=t.dataset.k.split('|');S.profile[k]=v;await kvSet('profile',S.profile);render()},true);

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
 <label>Stylized avatar skin tone</label><div class="chips">${['#f6d7c3','#e8b894','#c68c5f','#8d5a3b','#5a3825','#3b2417'].map(c=>`<button class="chip ${p.skin===c?'on':''}" data-skin="${c}" style="background:${c};width:34px;height:34px;padding:0"></button>`).join('')}</div>${avatarOptions(p)}
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
const SW_TOP=['Tops','Outerwear','Dresses'],SW_BOT=['Bottoms'],SW_SHOE=['Shoes'];
const SW_ZONE=i=>SW_TOP.includes(i.cat)?'t':SW_BOT.includes(i.cat)?'b':SW_SHOE.includes(i.cat)?'s':null;
const SW_DEF={t:{x:50,y:35,s:40},b:{x:50,y:70,s:27},s:{x:50,y:93.5,s:24},Dresses:{x:50,y:47,s:42},Outerwear:{x:50,y:32,s:52}};
const ZN={t:'top',b:'bottom',s:'shoes'};
const isShop=i=>(i.tags||[]).includes('Shop');
const safeSrc=s=>typeof s==='string'&&/^(data:image\/|https:\/\/|blob:)/i.test(s)?s:'';
const safeUrl=s=>typeof s==='string'&&/^https?:\/\//i.test(s)?s:'';
function swList(z){return S.items.filter(i=>SW_ZONE(i)===z)}
function swCur(z){if(z&&z.startsWith('a:'))return item(z.slice(2))||null;const L=swList(z);if(!L.length)return null;const n=L.length+1;const k=(((S.swipe[z]||0)%n)+n)%n;return k===L.length?null:L[k]}
function accDef(i){const n=((i.name||'')+' '+(i.tags||[]).join(' ')).toLowerCase();
 if(/hat|cap|beanie|beret/.test(n))return{x:50,y:7,s:30};if(/bag|purse|tote|clutch|backpack/.test(n))return{x:78,y:55,s:30};
 if(/necklace|chain|pendant|scarf/.test(n))return{x:50,y:24,s:20};if(/earring|ring|watch|bracelet/.test(n))return{x:70,y:52,s:10};if(/glass/.test(n))return{x:50,y:10,s:18};return{x:50,y:30,s:20}}
function swFit(i){const z=SW_ZONE(i);return Object.assign({},i.cat==='Accessories'?accDef(i):(SW_DEF[i.cat]||SW_DEF[z]||{x:50,y:40,s:30}),i.fit||{})}
function swImg(i){return safeSrc(i.cut)||safeSrc(i.img)}
const lid=k=>'swg_'+k.replace(':','_');
function buyBar(ids){const L=ids.map(item).filter(i=>i&&isShop(i)&&safeUrl(i.buyUrl));return L.length?`<div class="card buybar">${L.map(i=>`<div class="row sp"><span>🛍 ${esc(i.name)}${i.price?' · $'+esc(i.price):''}</span><a class="btn sm" href="${esc(safeUrl(i.buyUrl))}" target="_blank" rel="noopener sponsored">Buy</a></div>`).join('')}</div>`:''}
function modeTabs(){const m=S.dressMode||'board';return `<div class="seg" style="display:flex;gap:6px;margin:0 0 10px"><button class="chip ${m==='board'?'on':''}" data-act="mode_board">Board</button><button class="chip ${m==='swipe'?'on':''}" data-act="mode_swipe">Swipe (free)</button>${m==='swipe'?'<button class="chip" data-act="sw_shuffle">🔀 Shuffle</button>':''}</div>${poseChips()}${m==='board'?buyBar(S.dress.map(d=>d.id)):''}`}
function posed(k,f){const D=k.length===1?poseDelta(k,S.lastPose):{};return{x:f.x+(D.dx||0),y:f.y+(D.dy||0),s:f.s+(D.ds||0)}}
function swLayer(i,k,z){if(!i)return '';const f=posed(k,swFit(i));return `<img class="swg" id="${lid(k)}" src="${swImg(i)}" alt="" draggable="false" style="left:${f.x}%;top:${f.y}%;width:${f.s}%;z-index:${z}">`}
function swAccs(){S.swAcc=(S.swAcc||[]).filter(id=>item(id));return S.swAcc.map(item)}
function vSwipe(){const t=swCur('t'),b=swCur('b'),s=swCur('s');const adj=S.swAdj||'';const accs=swAccs();
 const pos=(z,i)=>{const L=swList(z);return i?`${isShop(i)?'🛍 ':''}${esc(i.name||i.cat)} · ${L.indexOf(i)+1}/${L.length}`:(L.length?`None · ${L.length+1}/${L.length+1}`:'No '+ZN[z])};
 const need=S.items.filter(i=>(SW_ZONE(i)||i.cat==='Accessories')&&!i.cut).length;
 const body=S.profile.photo?`<img src="${S.profile.photo}" class="swbody" alt="" draggable="false">`:`<div class="swbody">${avatarSVG(S.profile.skin)}</div>`;
 const af=adj?swCur(adj):null;const f=af?swFit(af):null;const allAcc=S.items.filter(i=>i.cat==='Accessories');
 const zone=z=>`<div class="swz" data-z="${z}"><button class="swa" data-act="sw_${z}_prev" aria-label="Previous ${ZN[z]}">‹</button><span class="swlab">${pos(z,z==='t'?t:z==='b'?b:s)}</span><button class="swa" data-act="sw_${z}_next" aria-label="Next ${ZN[z]}">›</button></div>`;
 return `<h2>Dress Me</h2>${modeTabs()}
 <div class="swstage" id="swstage">${body}${swLayer(s,'s',3)}${swLayer(b,'b',4)}${swLayer(t,'t',5)}${accs.map((a,k)=>swLayer(a,'a:'+a.id,6+k)).join('')}
  ${zone('t')}${zone('b')}${zone('s')}
  ${adj?`<div class="swadjtag">Adjusting ${esc(af?(af.name||af.cat):'')}: drag / pinch</div>`:''}</div>
 <p class="mut">Swipe the top for tops, the middle for bottoms, the feet for shoes. Shake or tap 🔀 to shuffle. Free, nothing leaves your phone.</p>
 <div class="row"><button class="btn sm sec ${adj==='t'?'on':''}" data-act="sw_adj" data-k="t" ${t?'':'disabled'}>Adjust top</button><button class="btn sm sec ${adj==='b'?'on':''}" data-act="sw_adj" data-k="b" ${b?'':'disabled'}>Adjust bottom</button><button class="btn sm sec ${adj==='s'?'on':''}" data-act="sw_adj" data-k="s" ${s?'':'disabled'}>Adjust shoes</button>
 ${accs.map(a=>`<button class="btn sm sec ${adj==='a:'+a.id?'on':''}" data-act="sw_adj" data-k="a:${a.id}">Adjust ${esc(a.name||'accessory')}</button>`).join('')}</div>
 <div class="row" style="margin-top:6px"><button class="btn sm" data-act="sw_save" ${t||b||s||accs.length?'':'disabled'}>Save outfit</button><button class="btn sm sec" data-act="sw_wear" ${t||b||s?'':'disabled'}>Wear today</button>${'DeviceMotionEvent' in window&&!S.shakeOn?'<button class="btn sm sec" data-act="sw_shake">Enable shake</button>':''}</div>
 ${f?`<div class="card" style="margin-top:10px"><label>Left/right</label><input type="range" id="swr_x" min="0" max="100" step="0.5" value="${f.x}"><label>Up/down</label><input type="range" id="swr_y" min="0" max="100" step="0.5" value="${f.y}"><label>Size</label><input type="range" id="swr_s" min="5" max="120" step="0.5" value="${f.s}"><div class="row" style="margin-top:8px"><button class="btn sm" data-act="sw_fit_save">Save fit for this item</button><button class="btn sm sec" data-act="sw_fit_reset">Reset</button><button class="btn sm sec" data-act="sw_adj_done">Done</button></div></div>`:''}
 ${buyBar([t,b,s,...accs].filter(Boolean).map(i=>i.id))}
 <h3>Accessories <span class="mut" style="font-weight:400">tap to add/remove</span></h3>${allAcc.length?`<div class="strip">${allAcc.map(i=>`<button class="accb ${S.swAcc.includes(i.id)?'sel':''}" data-act="sw_acc" data-k="${i.id}" aria-label="${esc(i.name)}"><img src="${swImg(i)}" alt=""></button>`).join('')}</div>`:'<p class="mut">Add bags, hats or jewelry as Accessories in Closet.</p>'}
 <div class="card" style="margin-top:10px"><div class="row sp"><b>Cutouts</b><span class="badge">free</span></div><p class="mut" style="margin:6px 0" id="swcutmsg">${need?need+' item(s) still have a background.':'All swipe items have cutouts.'} Removal runs on this phone (first run downloads a ~40 MB model once).</p><button class="btn sm sec" data-act="sw_cutall" ${need?'':'disabled'}>Make cutouts</button></div>
 <p class="mut" style="margin-top:10px">Want a realistic fit? Switch to Board and use “Try on for real” (~4¢).</p>
 ${S.items.length?'':'<div class="card mut">Add clothes in the Closet tab first.</div>'}`}
function swSetFit(k,f0){const f=posed(k,f0);const g=document.getElementById(lid(k));if(g){g.style.left=f.x+'%';g.style.top=f.y+'%';g.style.width=f.s+'%'}}
let swLive=null;
const zoneAt=fy=>fy<0.42?'t':fy<0.8?'b':'s';
function initSwipe(){const st=$('#swstage');if(!st)return;const P=new Map();let g=null;
 st.addEventListener('pointerdown',e=>{if(e.target.closest('.swa'))return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});st.setPointerCapture?.(e.pointerId);
  const r=st.getBoundingClientRect();const adj=S.swAdj;
  if(adj){const i=swCur(adj);if(!i)return;const f=swLive&&swLive.id===i.id?swLive.f:swFit(i);swLive={id:i.id,z:adj,f:{...f}};g={mode:'adj',r,f0:{...swLive.f},p0:[...P.values()].map(p=>({...p})),d0:0}}
  else g={mode:'sw',z:zoneAt((e.clientY-r.top)/r.height),x0:e.clientX,y0:e.clientY}});
 st.addEventListener('pointermove',e=>{if(!P.has(e.pointerId)||!g)return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});e.preventDefault();
  if(g.mode==='adj'){const pts=[...P.values()];if(pts.length>=2){const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(!g.d0){g.d0=d;g.f0={...swLive.f}}swLive.f.s=Math.max(5,Math.min(120,g.f0.s*d/g.d0))}
   else{const p0=g.p0[0]||pts[0];swLive.f.x=Math.max(0,Math.min(100,g.f0.x+(pts[0].x-p0.x)/g.r.width*100));swLive.f.y=Math.max(0,Math.min(100,g.f0.y+(pts[0].y-p0.y)/g.r.height*100))}
   swSetFit(swLive.z,swLive.f);['x','y','s'].forEach(k=>{const s=$('#swr_'+k);if(s)s.value=swLive.f[k]})}});
 const up=e=>{if(!P.has(e.pointerId))return;P.delete(e.pointerId);if(!g)return;
  if(g.mode==='sw'){const dx=e.clientX-g.x0,dy=e.clientY-g.y0;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3)swStep(g.z,dx<0?1:-1);g=null}
  else{if(P.size===0)g=null;else{g.p0=[...P.values()].map(p=>({...p}));g.f0={...swLive.f};g.d0=0}}};
 st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up)}
function swStep(z,d){S.swipe[z]=(S.swipe[z]||0)+d;const n=swList(z).length+1;S.swipe[z]=((S.swipe[z]%n)+n)%n;kvSet('swipe',S.swipe);swLive=null;render()}
function swIds(){const t=swCur('t');return [t,t&&t.cat==='Dresses'?null:swCur('b'),swCur('s'),...swAccs()].filter(Boolean).map(i=>i.id)}
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rj)=>setTimeout(()=>rj(new Error('timeout')),ms))]);
async function makeCutout(src,onMsg){try{onMsg&&onMsg('Removing background (AI, on-device)…');return await withTimeout(aiCutout(src),90000)}catch(e){onMsg&&onMsg('AI cutout unavailable, using quick cutout…');return await withTimeout(quickCutout(src),20000)}}
let swQ=Promise.resolve();
const wantsCut=i=>!!(SW_ZONE(i)||i.cat==='Accessories');
function queueCutout(id){swQ=swQ.then(async()=>{const i=item(id);if(!i||i.cut||!wantsCut(i))return;try{i.cut=await makeCutout(i.orig||i.img);await put('items',i)}catch(e){i.cutFailed=1}}).catch(()=>{});return swQ}
const _saveItem0=saveItem;saveItem=async function(it){await _saveItem0(it);if(!it.cut&&!it.cutFailed&&wantsCut(it))queueCutout(it.id)};

/* ===== Shuffle ===== */
function wxNow(){const w=S.wx;if(!w||!w.current)return{tc:18,rain:false,known:false};return{tc:w.current.temperature_2m,rain:(w.current.precipitation>0)||((w.daily?.precipitation_probability_max||[])[0]>=50),known:true}}
function shufflePick(z){const{tc,rain}=wxNow();const need=warmthNeed(tc),season=seasonNow(),recent=recentWornIds(7);
 let L=swList(z).filter(i=>!isShop(i)&&i.laundry!=='dirty'&&i.laundry!=='cleaners'&&!i.outdated&&(z!=='t'||i.cat!=='Dresses'||true));
 const fresh=L.filter(i=>!recent.has(i.id));if(fresh.length)L=fresh;if(!L.length)return null;
 const sc=i=>-Math.abs((i.warmth||3)-need)*2+(!i.seasons?.length||i.seasons.includes(season)?1.5:0)+(rain&&i.tags?.some(t=>/rain|waterproof/i.test(t))?2:0)+(z==='t'&&i.cat==='Outerwear'&&need<4?-3:0)+Math.random()*2;
 return L.map(i=>[sc(i),i]).sort((a,b)=>b[0]-a[0])[0][1]}
function doShuffle(){const res={};for(const z of['t','b','s']){const p=shufflePick(z);const L=swList(z);res[z]=p;S.swipe[z]=p?L.indexOf(p):L.length}
 const t=res.t;if(t&&t.cat==='Dresses')S.swipe.b=swList('b').length;
 kvSet('swipe',S.swipe);swLive=null;S.swAdj='';const w=wxNow();if(S.tab!=='dress'||S.dressMode!=='swipe'){S.tab='dress';S.dressMode='swipe'}render();toast('Shuffled'+(w.known?` for ${Math.round(S.settings.units==='F'?w.tc*9/5+32:w.tc)}°${w.rain?' + rain':''}`:' (no weather set)'))}
let lastShake=0;function onMotion(e){const a=e.accelerationIncludingGravity||e.acceleration;if(!a)return;const m=Math.hypot(a.x||0,a.y||0,a.z||0);if(m>24&&Date.now()-lastShake>1500&&S.tab==='dress'&&S.dressMode==='swipe'){lastShake=Date.now();doShuffle()}}
async function enableShake(){try{if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){const r=await DeviceMotionEvent.requestPermission();if(r!=='granted')return toast('Motion permission denied')}addEventListener('devicemotion',onMotion);S.shakeOn=true;kvSet('shakeOn',true);toast('Shake to shuffle is on');render()}catch(e){toast('Shake not available')}}

/* ===== Swipe events ===== */
document.addEventListener('click',async e=>{const t=e.target.closest('[data-act]');if(!t)return;const A=t.dataset.act,K=t.dataset.k;if(!A.startsWith('sw_')&&!A.startsWith('mode_'))return;e.stopImmediatePropagation();
 if(A==='mode_board'||A==='mode_swipe'){S.dressMode=A.slice(5);S.swAdj='';swLive=null;await kvSet('dressMode',S.dressMode);return render()}
 const m=A.match(/^sw_([tbs])_(prev|next)$/);if(m)return swStep(m[1],m[2]==='next'?1:-1);
 if(A==='sw_shuffle')return doShuffle();
 if(A==='sw_shake')return enableShake();
 if(A==='sw_acc'){S.swAcc=S.swAcc||[];const k=S.swAcc.indexOf(K);k>=0?S.swAcc.splice(k,1):S.swAcc.push(K);if(k>=0&&S.swAdj==='a:'+K)S.swAdj='';await kvSet('swAcc',S.swAcc);return render()}
 if(A==='sw_adj'){S.swAdj=S.swAdj===K?'':K;swLive=null;return render()}
 if(A==='sw_adj_done'){S.swAdj='';swLive=null;return render()}
 if(A==='sw_fit_save'||A==='sw_fit_reset'){const i=swCur(S.swAdj);if(!i)return;if(A==='sw_fit_reset'){delete i.fit;swLive=null}else{i.fit={...(swLive&&swLive.id===i.id?swLive.f:swFit(i))}}await put('items',i);toast(A==='sw_fit_reset'?'Fit reset':'Fit saved for '+(i.name||i.cat));return render()}
 if(A==='sw_save'){const ids=swIds();if(!ids.length)return;const name=prompt('Name this outfit','My outfit '+(S.outfits.length+1));if(name===null)return;const o={id:uid(),name:name||'Outfit',items:ids,created:Date.now()};S.outfits.unshift(o);await put('outfits',o);toast('Outfit saved');return render()}
 if(A==='sw_wear'){const ids=swIds().filter(id=>!isShop(item(id)));if(ids.length)await logWear(ids);return render()}
 if(A==='sw_cutall'){const L=S.items.filter(i=>wantsCut(i)&&!i.cut);t.disabled=true;const msg=$('#swcutmsg');let k=0;for(const i of L){k++;const say=s=>{if(msg)msg.textContent=`${k}/${L.length}: ${s}`};try{i.cut=await makeCutout(i.orig||i.img,say);await put('items',i)}catch(err){}}toast('Cutouts done');return render()}
},true);
document.addEventListener('input',e=>{const m=e.target.id&&e.target.id.match(/^swr_([xys])$/);if(!m)return;const i=swCur(S.swAdj);if(!i)return;if(!swLive||swLive.id!==i.id)swLive={id:i.id,z:S.swAdj,f:swFit(i)};swLive.f[m[1]]=+e.target.value;swSetFit(S.swAdj,swLive.f)});

/* ===== Fast camera capture + auto-sort ===== */
const QCATS=['Tops','Bottoms','Shoes','Accessories','Outerwear','Dresses'];
let tray=[];let useMN=false,_mn=null;
async function loadMN(){if(_mn)return _mn;const load=src=>new Promise((r,j)=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=j;document.head.appendChild(s)});
 await load('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');await load('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');_mn=await window.mobilenet.load({version:2,alpha:0.5});return _mn}
const MN_MAP=[[/jersey|sweatshirt|cardigan|t-shirt|tee|blouse|polo|vest|bulletproof/,'Tops'],[/jean|denim|miniskirt|sarong|trouser|pajama/,'Bottoms'],[/shoe|sandal|loafer|clog|boot|sneaker|slipper|sock/,'Shoes'],[/bag|purse|wallet|backpack|sunglass|necklace|watch|hat|sombrero|cap|bonnet|bow tie|tie|bracelet|ring|wig|mask/,'Accessories'],[/coat|jacket|poncho|parka|cloak|kimono/,'Outerwear'],[/gown|overskirt|dress|apron/,'Dresses']];
function heurCat(c){const x=c.getContext('2d'),W=c.width,H=c.height,d=x.getImageData(0,0,W,H).data;let n=0,sy=0;for(let y=0;y<H;y++)for(let X=0;X<W;X++)if(d[(y*W+X)*4+3]>10){n++;sy+=y}
 const fill=n/(W*H),ar=H/W;if(ar>1.45)return'Bottoms';if(ar<0.72)return'Shoes';if(fill<0.35&&ar<1.1)return'Accessories';return'Tops'}
async function guessCat(src){try{const cut=await withTimeout(quickCutout(src),15000);const im=await loadImg(cut);const c=scale(im,120,'image/png');let g=heurCat(c);
  if(useMN){try{const mn=await withTimeout(loadMN(),30000);const im2=await loadImg(src);const p=await mn.classify(im2,3);for(const r of p){const hit=MN_MAP.find(([re])=>re.test(r.className.toLowerCase()));if(hit&&r.probability>0.12){g=hit[1];break}}}catch(e){useMN=false;toast('Smart sort unavailable, using quick guess')}}
  return{cat:g,quick:cut}}catch(e){return{cat:'Tops',quick:src}}}
function trayView(){return `<div class="row sp"><h2 style="margin:0">Snap several</h2><button class="btn sm sec" data-act="close">✕</button></div>
 <p class="mut">Tap Snap for each piece, one after another. We guess the category; tap to fix it.</p>
 <label class="btn full" style="text-align:center">📷 Snap ${tray.length?'next':'first'} piece<input type="file" accept="image/*" capture="environment" id="x_snap" hidden></label>
 <label class="btn sec full" style="text-align:center;margin-top:6px">🖼 Pick several from photos<input type="file" accept="image/*" multiple id="x_snapgal" hidden></label>
 <div class="tog"><span>Smarter sort (downloads ~5 MB AI model once)</span><input type="checkbox" id="x_mn" style="width:auto" ${useMN?'checked':''}></div>
 <div id="x_tray">${tray.map((t,k)=>`<div class="card trayit"><img src="${t.quick||t.src}" alt=""><div style="flex:1"><div class="chips">${QCATS.map(c=>`<button class="chip ${t.cat===c?'on':''}" data-act="x_tcat" data-k="${k}|${c}">${c}</button>`).join('')}</div>${t.busy?'<span class="mut">Sorting…</span>':''}</div><button class="btn sm sec" data-act="x_tdel" data-k="${k}">✕</button></div>`).join('')}</div>
 ${tray.length?`<button class="btn full" style="margin-top:10px" data-act="x_tsave">Save ${tray.length} item${tray.length>1?'s':''} + make cutouts</button>`:''}`}
function openTray(){openSheet(trayView())}
function refreshTray(){if($('#x_tray'))openSheet(trayView())}
async function addToTray(f){const im=await fileToImg(f);const src=scale(im).toDataURL('image/jpeg',.85);const t={src,cat:'Tops',busy:true};tray.push(t);refreshTray();const g=await guessCat(src);Object.assign(t,g,{busy:false});refreshTray()}

/* ===== Store items + Deals ===== */
async function imgUrlToData(url){try{const r=await withTimeout(fetch(url,{mode:'cors'}),12000);if(!r.ok)throw 0;const b=await r.blob();if(!/^image\//.test(b.type))throw 0;const im=await fileToImg(b);return scale(im).toDataURL('image/jpeg',.85)}catch(e){return null}}
function storeFlow(){openSheet(`<div class="row sp"><h2 style="margin:0">Add from store</h2><button class="btn sm sec" data-act="close">✕</button></div>
 <label>Product page link</label><input id="x_purl" type="url" placeholder="https://store.com/product…">
 <label>Image link (right-click / long-press the product photo → copy image address)</label><input id="x_iurl" type="url" placeholder="https://…jpg">
 <label class="btn sec full" style="text-align:center;margin-top:8px">…or upload a screenshot<input type="file" accept="image/*" id="x_shot" hidden></label><img id="x_sprev" class="prev hidden" style="margin-top:8px">
 <label>Name</label><input id="x_sname" placeholder="e.g. Cropped denim jacket"><div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>Price</label><input id="x_sprice" inputmode="decimal" placeholder="49.99"></div><div style="flex:1"><label>Category</label><select id="x_scat">${CATS.map(c=>`<option>${c}</option>`).join('')}</select></div></div>
 <label>Buy link (affiliate-ready; leave blank to use product link)</label><input id="x_aff" type="url" placeholder="https://…?tag=yourid">
 <button class="btn full" style="margin-top:12px" data-act="x_ssave">Save to try on</button><p class="mut" id="x_smsg"></p>`)}
let shotData=null;
function dealCard(d){const it=d.itemId&&item(d.itemId);const img=it?swImg(it):safeSrc(d.img);return `<div class="card"><div class="row sp"><span class="badge sp">Deal${d.pct?' · '+esc(d.pct)+'% off':''}</span><span class="mut">${esc(d.brand||'')}</span></div>
 <div class="row" style="margin-top:8px;flex-wrap:nowrap"><div style="position:relative;width:90px;height:150px;flex:none">${S.profile.photo?`<img src="${S.profile.photo}" style="height:150px;width:90px;object-fit:contain">`:avatarSVG(S.profile.skin).replace('class="av"','style="height:150px"')}${img?`<img src="${img}" style="position:absolute;left:18px;top:30px;width:54px;filter:drop-shadow(0 2px 3px #0004)">`:''}</div>
 <div style="flex:1"><b>${esc(d.title||'Sale')}</b><p class="mut">${d.until?'Ends '+esc(d.until)+' · ':''}Added by you</p><div class="row">${safeUrl(d.url)?`<a class="btn sm" href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener sponsored">Shop</a>`:''}${it?`<button class="btn sm sec" data-act="x_dtry" data-k="${it.id}">Try on</button>`:''}<button class="btn sm sec" data-act="x_ddel" data-k="${d.id}">✕</button></div></div></div></div>`}
function dealForm(){const shop=S.items.filter(isShop);openSheet(`<div class="row sp"><h2 style="margin:0">Add a deal</h2><button class="btn sm sec" data-act="close">✕</button></div>
 <label>Brand / store</label><input id="x_dbrand"><label>Headline</label><input id="x_dtitle" placeholder="30% off rain coats"><div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>% off</label><input id="x_dpct" inputmode="numeric"></div><div style="flex:1"><label>Ends</label><input id="x_duntil" type="date"></div></div>
 <label>Link</label><input id="x_durl" type="url"><label>Show this store item on my avatar</label><select id="x_ditem"><option value="">(none)</option>${shop.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select>
 <button class="btn full" style="margin-top:12px" data-act="x_dsave">Save deal</button>`)}

/* ===== Sharing (export/import, no backend) ===== */
async function gz(str){if(!window.CompressionStream)return null;const s=new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));return new Uint8Array(await new Response(s).arrayBuffer())}
async function gunz(buf){const s=new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(s).text()}
const b64u=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const ub64=s=>{const b=atob(s.replace(/-/g,'+').replace(/_/g,'/'));const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
async function thumbOf(src,max=180){try{const im=await withTimeout(loadImg(src),5000);const png=/^data:image\/png/.test(src);const c=scale(im,max,png?'image/png':'image/jpeg');return png?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.7)}catch(e){return safeSrc(src)&&!src.startsWith('data:')?src:''}}
async function packItems(ids,withImg){const out=[];for(const id of ids){const i=item(id);if(!i)continue;out.push({id:i.id,name:i.name,cat:i.cat,color:i.color,tags:(i.tags||[]).slice(0,8),price:i.price||'',buyUrl:safeUrl(i.buyUrl)||'',img:withImg?await thumbOf(swImg(i)):''})}return out}
const owner=()=>S.profile.name||'My';
async function buildShare(kind,extra={}){const p={app:'britts-drip-share',v:1,kind,owner:owner(),created:Date.now(),...extra};return p}
async function shareFile(payload,title){const json=JSON.stringify(payload);const z=await gz(json);const name=(title||'britts-drip').replace(/[^\w-]+/g,'-').toLowerCase()+(z?'.bdrip':'.json');
 const file=new File([z||json],name,{type:z?'application/octet-stream':'application/json'});
 try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title,text:title+' (open in Britts Drip → Me → Import shared file)'});return}}catch(e){if(e.name==='AbortError')return}
 const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();a.remove();closeSheet();toast('Saved '+name+'. Send it to share.')}
async function shareLink(payload,title){const z=await gz(JSON.stringify(payload));const url=location.origin+location.pathname+'#share='+(z?'z.'+b64u(z):'j.'+b64u(new TextEncoder().encode(JSON.stringify(payload))));
 if(url.length>60000)return toast('Too big for a link, use Share file');
 try{if(navigator.share){await navigator.share({title,url});return}}catch(e){if(e.name==='AbortError')return}
 try{await navigator.clipboard.writeText(url);toast('Link copied')}catch(e){prompt('Copy this link',url)}}
function cleanShare(p){if(!p||p.app!=='britts-drip-share'||!Array.isArray(p.items||[]))throw new Error('Not a Britts Drip share');const it=(p.items||[]).slice(0,500).map(i=>({id:String(i.id||uid()).slice(0,40),name:String(i.name||'').slice(0,80),cat:CATS.includes(i.cat)?i.cat:'Accessories',color:String(i.color||'').slice(0,20),tags:(Array.isArray(i.tags)?i.tags:[]).map(t=>String(t).slice(0,30)).slice(0,8),price:String(i.price||'').slice(0,12),buyUrl:safeUrl(i.buyUrl)||'',img:safeSrc(i.img)||'',url:safeUrl(i.url)||'',size:String(i.size||'').slice(0,20),notes:String(i.notes||'').slice(0,200)}));
 return{id:uid(),kind:['closet','outfit','wishlist','suggestion'].includes(p.kind)?p.kind:'closet',owner:String(p.owner||'Someone').slice(0,40),to:String(p.to||'').slice(0,40),name:String(p.name||'').slice(0,80),items:it,outfitIds:(Array.isArray(p.outfitIds)?p.outfitIds:[]).map(String).slice(0,20),received:Date.now()}}
async function importShare(p){const s=cleanShare(p);S.shared=[s,...(S.shared||[])].slice(0,30);await kvSet('shared',S.shared);toast('Received '+s.owner+"'s "+s.kind);openShared(s.id)}
async function importBytes(u8){let txt;if(u8[0]===0x1f&&u8[1]===0x8b)txt=await gunz(u8);else txt=new TextDecoder().decode(u8);return importShare(JSON.parse(txt))}
const poss=n=>/s$/i.test(n)?n+"'":n+"'s";
function sharedList(){const L=S.shared||[];openSheet(`<div class="row sp"><h2 style="margin:0">Shared with me</h2><button class="btn sm sec" data-act="close">✕</button></div>
 ${L.length?L.map(s=>`<div class="card"><div class="row sp"><b>${esc(s.kind==='suggestion'?'Outfit idea from '+s.owner:poss(s.owner)+' '+(s.kind==='wishlist'?'gift ideas':s.kind))}</b><span><button class="btn sm sec" data-act="x_open" data-k="${s.id}">Open</button> <button class="btn sm sec" data-act="x_sdel" data-k="${s.id}">✕</button></span></div><p class="mut">${s.items.length} item(s) · ${new Date(s.received).toLocaleDateString()}</p></div>`).join(''):'<p class="mut">Nothing yet. When someone sends you a Britts Drip link or file, open it here.</p>'}
 <label class="btn sec full" style="text-align:center;margin-top:8px">Import shared file<input type="file" id="x_imp" accept=".bdrip,.json,application/json,application/octet-stream" hidden></label>`)}
let xSel=new Set();
function miniStage(items){return `<div class="ministage">${avatarSVG(S.profile.skin)}${items.map(i=>{const f=i.cat==='Accessories'?accDef(i):(SW_DEF[i.cat]||SW_DEF[SW_ZONE(i)]||{x:50,y:40,s:30});return i.img?`<img src="${i.img}" style="left:${f.x}%;top:${f.y}%;width:${f.s}%">`:''}).join('')}</div>`}
function openShared(id){const s=(S.shared||[]).find(x=>x.id===id);if(!s)return;S.xOpen=id;const sel=s.items.filter(i=>xSel.has(i.id));
 const sw=i=>i.img?`<img src="${i.img}" alt="">`:`<div class="sw" style="background:${esc(COLORS[i.color]||'#bbb')}"></div>`;
 if(s.kind==='wishlist')return openSheet(`<div class="row sp"><h2 style="margin:0">${esc(poss(s.owner))} gift ideas</h2><button class="btn sm sec" data-act="close">✕</button></div><span class="badge">read-only</span>
  ${s.items.map(i=>`<div class="card row" style="flex-wrap:nowrap">${i.img?`<img src="${i.img}" style="width:56px;height:56px;object-fit:contain">`:''}<div style="flex:1"><b>${esc(i.name)}</b><div class="mut">${[i.size&&'Size '+i.size,i.price&&'$'+i.price,i.notes].filter(Boolean).map(esc).join(' · ')}</div></div>${i.url?`<a class="btn sm" href="${esc(i.url)}" target="_blank" rel="noopener">View</a>`:''}</div>`).join('')}<button class="btn sec full" data-act="x_shared">Back</button>`);
 if(s.kind==='suggestion'){const mine=s.outfitIds.filter(item);return openSheet(`<div class="row sp"><h2 style="margin:0">Outfit idea from ${esc(s.owner)}</h2><button class="btn sm sec" data-act="close">✕</button></div>${s.name?`<p><b>${esc(s.name)}</b></p>`:''}${miniStage(s.items)}
  <div class="strip">${s.items.map(i=>`<div class="thumb ro">${sw(i)}<span>${esc(i.name)}</span></div>`).join('')}</div>
  ${mine.length?`<button class="btn full" data-act="x_sugload" data-k="${s.id}">Load on my Board</button> <button class="btn sec full" style="margin-top:6px" data-act="x_sugsave" data-k="${s.id}">Save as outfit</button>`:'<p class="mut">These pieces aren’t in this closet.</p>'}<button class="btn sec full" style="margin-top:6px" data-act="x_shared">Back</button>`)}
 openSheet(`<div class="row sp"><h2 style="margin:0">${esc(poss(s.owner))} ${s.kind==='outfit'?'outfit':'closet'}</h2><button class="btn sm sec" data-act="close">✕</button></div><span class="badge">read-only</span>${s.name?` <b>${esc(s.name)}</b>`:''}
 <p class="mut">Tap pieces to build an outfit idea for ${esc(s.owner)}, then send it back.</p>${miniStage(sel)}
 <div class="grid">${s.items.map(i=>`<button class="thumb ro ${xSel.has(i.id)?'sel':''}" data-act="x_pick" data-k="${esc(i.id)}">${sw(i)}<span>${esc(i.name||i.cat)}</span></button>`).join('')}</div>
 <label>Note / outfit name</label><input id="x_sugname" placeholder="Date night?">
 <button class="btn full" style="margin-top:8px" data-act="x_sugsend" ${sel.length?'':'disabled'}>Send outfit idea back (${sel.length})</button><button class="btn sec full" style="margin-top:6px" data-act="x_shared">Back</button>`)}
function shareMenu(kind,ref){openSheet(`<div class="row sp"><h2 style="margin:0">Share ${kind==='wishlist'?'gift ideas':kind}</h2><button class="btn sm sec" data-act="close">✕</button></div>
 <p class="mut">No account needed. A file includes small photos; a link is lighter (colors only) and best for outfits and wishlists.</p>
 <button class="btn full" data-act="x_doshare" data-k="file|${kind}|${ref||''}">Share as file (with photos)</button><button class="btn sec full" style="margin-top:6px" data-act="x_doshare" data-k="link|${kind}|${ref||''}">Share as link</button>`)}
async function payloadFor(kind,ref,withImg){if(kind==='closet')return buildShare('closet',{items:await packItems(S.items.filter(i=>!isShop(i)).map(i=>i.id),withImg)});
 if(kind==='outfit'){const o=S.outfits.find(x=>x.id===ref);return buildShare('outfit',{name:o?.name||'',items:await packItems(o?o.items:[],withImg)})}
 if(kind==='wishlist')return buildShare('wishlist',{items:await Promise.all((S.wish||[]).map(async w=>({...w,img:withImg&&w.img?await thumbOf(w.img,160):''})))})}

/* ===== Wishlist ===== */
function wishForm(){openSheet(`<div class="row sp"><h2 style="margin:0">Add gift idea</h2><button class="btn sm sec" data-act="close">✕</button></div><label>What</label><input id="x_wname"><label>Link</label><input id="x_wurl" type="url"><label>Image link (optional)</label><input id="x_wimg" type="url"><div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label>Size</label><input id="x_wsize"></div><div style="flex:1"><label>Price</label><input id="x_wprice" inputmode="decimal"></div></div><label>Notes</label><input id="x_wnotes"><button class="btn full" style="margin-top:12px" data-act="x_wsave">Add</button>`)}

/* ===== Install prompt ===== */
let bip=null;const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isIOSSafari=()=>isIOS()&&!/CriOS|FxiOS|EdgiOS|GSA\//.test(navigator.userAgent);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();bip=e;showInstall('android')});
async function showInstall(kind){if(standalone()||$('#x_inst'))return;const seen=await kvGet('installTip',false).catch(()=>false);if(seen)return;
 const d=document.createElement('div');d.id='x_inst';d.className='instbar';
 d.innerHTML=kind==='ios'?`<div><b>Add Britts Drip to your Home Screen</b><br>Tap <span class="ishare">Share ⬆︎</span> at the bottom of Safari, then <b>Add to Home Screen</b>.</div><button class="btn sm sec" data-act="x_instx">Got it</button>`:`<div><b>Install Britts Drip</b><br>Opens full-screen like an app.</div><button class="btn sm" data-act="x_instgo">Install</button><button class="btn sm sec" data-act="x_instx">✕</button>`;document.body.appendChild(d)}

/* ===== Wrapped views ===== */
const _vCloset0=vCloset;vCloset=function(){const n=(S.shared||[]).length;return `<div class="row xrow"><button class="btn sm sec" data-act="x_tray">📷 Snap several</button><button class="btn sm sec" data-act="x_store">🔗 From store</button><button class="btn sm sec" data-act="x_sharecl">Share closet</button><button class="btn sm sec" data-act="x_shared">Shared with me${n?' ('+n+')':''}</button></div>`+_vCloset0()};
const _vAlerts0=vAlerts;vAlerts=function(){const D=S.deals||[];return `<h2>Deals</h2><p class="mut">Your own deal list (no live sale feed yet). Link a store item to see it on your avatar.</p>${D.map(dealCard).join('')}<button class="btn sec full" data-act="x_dadd">+ Add a deal</button><div style="height:14px"></div>`+_vAlerts0()};
const _vMe0=vMe;vMe=function(){const W=S.wish||[];return _vMe0()+`<h3>Wishlist / gift ideas</h3>${W.map(w=>`<div class="card row" style="flex-wrap:nowrap">${safeSrc(w.img)?`<img src="${esc(safeSrc(w.img))}" style="width:48px;height:48px;object-fit:contain">`:''}<div style="flex:1"><b>${esc(w.name)}</b><div class="mut">${[w.size&&'Size '+w.size,w.price&&'$'+w.price].filter(Boolean).map(esc).join(' · ')}</div></div><button class="btn sm sec" data-act="x_wdel" data-k="${w.id}">✕</button></div>`).join('')||'<p class="mut">Add things you’d love so people know what to get you.</p>'}
 <div class="row"><button class="btn sm sec" data-act="x_wadd">+ Add idea</button><button class="btn sm sec" data-act="x_sharewish" ${W.length?'':'disabled'}>Share list</button><button class="btn sm sec" data-act="x_shared">Shared with me</button></div>
 ${standalone()?'':`<div class="card" style="margin-top:10px"><b>Install</b><p class="mut">${isIOS()?'In Safari tap Share ⬆︎ → Add to Home Screen.':'Use your browser menu → Install app / Add to Home screen.'}</p>${bip?'<button class="btn sm" data-act="x_instgo">Install now</button>':''}</div>`}`};
const _vDress0=vDress;vDress=function(){let h=_vDress0();if(S.dressMode!=='swipe')h=h.replace(/(<h3>Saved outfits<\/h3>)/,'$1');return h.replace(/data-plano="([^"]+)">Plan<\/button>/g,'data-plano="$1">Plan</button> <button class="btn sm sec" data-act="x_shareo" data-k="$1">Share</button>')};

/* ===== New events ===== */
document.addEventListener('click',async e=>{const t=e.target.closest('[data-act]');if(!t)return;const A=t.dataset.act,K=t.dataset.k||'';if(!A.startsWith('x_'))return;e.stopImmediatePropagation();const v=id=>($('#'+id)?.value||'').trim();
 if(A==='x_tray'){tray=[];return openTray()}
 if(A==='x_tcat'){const[k,c]=K.split('|');if(tray[k])tray[k].cat=c;return refreshTray()}
 if(A==='x_tdel'){tray.splice(+K,1);return refreshTray()}
 if(A==='x_tsave'){const L=tray.filter(x=>!x.busy);for(const x of L){const col=await dominantColor(x.quick||x.src).catch(()=>'Gray');const it=newItem({img:x.quick||x.src,orig:x.src,cat:x.cat,color:col});it.name=col+' '+x.cat.replace(/s$/,'').toLowerCase();await saveItem(it)}tray=[];closeSheet();S.tab='closet';render();return toast(`Added ${L.length}. Cutouts running in the background.`)}
 if(A==='x_store')return storeFlow();
 if(A==='x_ssave'){const msg=$('#x_smsg'),purl=v('x_purl'),iurl=v('x_iurl'),name=v('x_sname');if(!shotData&&!iurl)return toast('Add an image link or screenshot');msg.textContent='Saving…';
  let img=shotData;if(!img){img=await imgUrlToData(iurl);if(!img){if(!safeSrc(iurl))return toast('Image link must start with https://');img=iurl;msg.textContent='Store blocks copying its photo, so it’s linked (no cutout). Upload a screenshot for a cutout.'}}
  const it=newItem({img,orig:img,cat:$('#x_scat').value,name:name||'Store item',price:v('x_sprice'),tags:['Shop'],buyUrl:safeUrl(v('x_aff'))||safeUrl(purl)||'',productUrl:safeUrl(purl)||'',occasions:[]});if(!img.startsWith('data:'))it.cutFailed=1;
  it.color=img.startsWith('data:')?await dominantColor(img).catch(()=>'Gray'):'Gray';await saveItem(it);shotData=null;closeSheet();toast('Store item saved. Try it in Swipe or Board.');S.tab='dress';return render()}
 if(A==='x_dadd')return dealForm();
 if(A==='x_dsave'){const d={id:uid(),brand:v('x_dbrand'),title:v('x_dtitle')||'Sale',pct:v('x_dpct').replace(/\D/g,'').slice(0,3),until:v('x_duntil'),url:safeUrl(v('x_durl')),itemId:$('#x_ditem').value};S.deals=[d,...(S.deals||[])];await kvSet('deals',S.deals);closeSheet();return render()}
 if(A==='x_ddel'){S.deals=(S.deals||[]).filter(d=>d.id!==K);await kvSet('deals',S.deals);return render()}
 if(A==='x_dtry'){const i=item(K);const z=SW_ZONE(i);S.tab='dress';S.dressMode='swipe';if(z)S.swipe[z]=swList(z).indexOf(i);else if(i.cat==='Accessories'&&!(S.swAcc||[]).includes(K))S.swAcc=[...(S.swAcc||[]),K];kvSet('swipe',S.swipe);kvSet('swAcc',S.swAcc||[]);return render()}
 if(A==='x_sharecl')return shareMenu('closet');
 if(A==='x_shareo')return shareMenu('outfit',K);
 if(A==='x_sharewish')return shareMenu('wishlist');
 if(A==='x_doshare'){const[how,kind,ref]=K.split('|');t.disabled=true;try{const p=await payloadFor(kind,ref,how==='file');const title=poss(owner())+' '+(kind==='wishlist'?'gift ideas':kind);await (how==='file'?shareFile(p,title):shareLink(p,title))}catch(err){toast('Share failed: '+(err.message||err))}t.disabled=false;return}
 if(A==='x_shared'){xSel=new Set();return sharedList()}
 if(A==='x_open'){xSel=new Set();return openShared(K)}
 if(A==='x_sdel'){S.shared=(S.shared||[]).filter(s=>s.id!==K);await kvSet('shared',S.shared);return sharedList()}
 if(A==='x_pick'){xSel.has(K)?xSel.delete(K):xSel.add(K);const n=v('x_sugname');openShared(S.xOpen);if($('#x_sugname'))$('#x_sugname').value=n;return}
 if(A==='x_sugsend'){const s=(S.shared||[]).find(x=>x.id===S.xOpen);if(!s)return;const items=s.items.filter(i=>xSel.has(i.id));const p=await buildShare('suggestion',{to:s.owner,name:v('x_sugname'),items,outfitIds:items.map(i=>i.id)});return shareMenuSend(p,'Outfit idea for '+s.owner)}
 if(A==='x_sugload'||A==='x_sugsave'){const s=(S.shared||[]).find(x=>x.id===K);const ids=s.outfitIds.filter(item);if(A==='x_sugload'){loadToBoard(ids);S.dressMode='board';kvSet('dressMode','board');closeSheet();S.tab='dress';return render()}const o={id:uid(),name:s.name||'Idea from '+s.owner,items:ids,created:Date.now()};S.outfits.unshift(o);await put('outfits',o);closeSheet();return toast('Outfit saved')}
 if(A==='x_wadd')return wishForm();
 if(A==='x_wsave'){const w={id:uid(),name:v('x_wname')||'Gift idea',url:safeUrl(v('x_wurl')),img:safeSrc(v('x_wimg')),size:v('x_wsize'),price:v('x_wprice'),notes:v('x_wnotes')};S.wish=[...(S.wish||[]),w];await kvSet('wish',S.wish);closeSheet();return render()}
 if(A==='x_wdel'){S.wish=(S.wish||[]).filter(w=>w.id!==K);await kvSet('wish',S.wish);return render()}
 if(A==='x_instx'){$('#x_inst')?.remove();return kvSet('installTip',true)}
 if(A==='x_instgo'){if(!bip)return toast('Use the browser menu → Install app');bip.prompt();const r=await bip.userChoice.catch(()=>({}));bip=null;$('#x_inst')?.remove();kvSet('installTip',true);return toast(r.outcome==='accepted'?'Installed':'Maybe later')}
},true);
async function shareMenuSend(p,title){openSheet(`<div class="row sp"><h2 style="margin:0">${esc(title)}</h2><button class="btn sm sec" data-act="close">✕</button></div><button class="btn full" id="x_sf">Share as file (with photos)</button><button class="btn sec full" style="margin-top:6px" id="x_sl">Share as link</button>`);
 $('#x_sf').onclick=()=>shareFile(p,title);$('#x_sl').onclick=()=>shareLink({...p,items:p.items.map(i=>({...i,img:''}))},title)}
document.addEventListener('change',async e=>{const id=e.target.id;if(!id||!id.startsWith('x_'))return;
 if(id==='x_mn'){useMN=e.target.checked;return}
 if(id==='x_snap'||id==='x_snapgal'){for(const f of [...e.target.files])addToTray(f).catch(()=>toast('Could not read photo'));e.target.value='';return}
 if(id==='x_shot'){const f=e.target.files[0];if(!f)return;const im=await fileToImg(f);shotData=scale(im).toDataURL('image/jpeg',.85);const p=$('#x_sprev');p.src=shotData;p.classList.remove('hidden');return}
 if(id==='x_imp'){const f=e.target.files[0];if(!f)return;try{await importBytes(new Uint8Array(await f.arrayBuffer()))}catch(err){toast('Not a Britts Drip share file')}return}
},true);

/* ===== Late init ===== */
async function checkHash(){const m=location.hash.match(/^#share=([zj])\.(.+)$/);if(!m)return false;history.replaceState(null,'',location.pathname);try{const u=ub64(m[2]);await importShare(JSON.parse(m[1]==='z'?await gunz(u):new TextDecoder().decode(u)))}catch(e){toast('Could not open shared link')}return true}
async function xInit(){for(let k=0;k<100&&!db;k++)await new Promise(r=>setTimeout(r,50));if(!db)return;
 S.deals=await kvGet('deals',[]);S.wish=await kvGet('wish',[]);S.shared=await kvGet('shared',[]);S.swAcc=await kvGet('swAcc',[]);S.swipe=Object.assign({t:0,b:0,s:0},S.swipe||{});
 if(await kvGet('shakeOn',false)&&!(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function')){addEventListener('devicemotion',onMotion);S.shakeOn=true}
 if(!await checkHash())render();addEventListener('hashchange',checkHash);
 if(isIOSSafari()&&!standalone())setTimeout(()=>showInstall('ios'),2500)}
xInit();

/* ===== Pose hook ===== */
const _render0=render;render=function(){_render0();if(S.tab==='dress'){const p=curPose();requestAnimationFrame(()=>requestAnimationFrame(()=>applyPose(p,p!==S.lastPose)))}};
kvGet&&setTimeout(async()=>{for(let k=0;k<100&&!db;k++)await new Promise(r=>setTimeout(r,50));S.poseOverride=await kvGet('poseOverride','');if(S.tab==='dress')render()},0);
