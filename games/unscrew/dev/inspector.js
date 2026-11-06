// Unscrew's model inspector, for development only: open games/unscrew/index.html?models with `npm run dev`
// (or ?models=giraffe to start on one model). Pick any 3D model, difficulty, level and variant, and see how it
// is built: the parts finalize() dropped, the slots that didn't become screws, the hidden screws, which parts
// hold which, and the order it comes apart in. "Play this level" starts a real level of that model.
// game.js loads this file only with ?models, and scripts/build.mjs leaves both out of release builds.
// Nothing is saved while it's open (persist() is switched off), so playing here never touches your progress.
// English only: it never reaches players.
(()=>{
const SKEY_I='unscrew.inspector';
let pref={};try{pref=JSON.parse(localStorage.getItem(SKEY_I))||{}}catch(e){}
const I={name:GENS3D[0][0],diff:'normal',level:1,variant:0,screws:true,xray:false,dropped:true,slots:false,spin:false,...pref,explode:0,sel:null,timer:0};
const asked=new URLSearchParams(location.search).get('models');if(asked&&GENS3D.some(g=>g[0]===asked))I.name=asked;
const remember=()=>{try{localStorage.setItem(SKEY_I,JSON.stringify({name:I.name,diff:I.diff,level:I.level,variant:I.variant,screws:I.screws,xray:I.xray,dropped:I.dropped,slots:I.slots,spin:I.spin}))}catch(e){}};
persist=()=>{};save.coins=99999; // in memory only: tools are free to try while playing from here

/* ----- panel ----- */
const css=document.createElement('style');css.textContent=`
#insp{position:fixed;left:12px;top:12px;width:300px;max-height:calc(100% - 24px);overflow:auto;z-index:20;background:var(--card);color:var(--ink);border-radius:16px;box-shadow:0 4px 0 var(--steel-sh),0 10px 30px rgba(23,33,46,.18);font:13px/1.4 var(--f-body);-webkit-user-select:text;user-select:text}
#insp header{position:sticky;top:0;background:var(--card);display:flex;align-items:center;gap:8px;padding:12px 14px 8px;font-family:var(--f-display);font-size:15px}
#insp header .dev{font:700 10px var(--f-body);background:var(--accent);color:#fff;border-radius:6px;padding:2px 6px;letter-spacing:.08em}
#insp header button{margin-left:auto}
#insp .body{padding:0 14px 14px;display:flex;flex-direction:column;gap:10px}
#insp .row{display:flex;gap:6px;align-items:center}
#insp .row>select,#insp .row>.grow{flex:1;min-width:0}
#insp select,#insp input[type=number],#insp button{font:inherit;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:9px;padding:0 8px;height:32px;box-sizing:border-box}
#insp input[type=number]{width:64px;margin-left:4px}
#insp button{cursor:pointer;background:#eef2f7;font-weight:600}
#insp button.primary{background:var(--accent);border-color:var(--accent-dk);color:#fff}
#insp button:disabled{opacity:.45;cursor:default}
#insp .checks{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px}
#insp .checks label,#insp .range{display:flex;align-items:center;gap:6px;cursor:pointer}
#insp .range input{flex:1}
#insp dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0;padding:10px;background:#f3f6fa;border-radius:10px;font-variant-numeric:tabular-nums}
#insp dt{color:var(--ink-2);font-weight:600}#insp dd{margin:0}
#insp .bad{color:#c4162a;font-weight:700}
#insp #iInfo{padding:10px;border:1px dashed var(--line);border-radius:10px;color:var(--ink-2);min-height:3em}
#insp #iInfo b{color:var(--ink)}
#insp .sw{display:inline-block;width:10px;height:10px;border-radius:3px;vertical-align:-1px;margin-right:3px}
#insp .keys{margin:0;color:var(--ink-2);font-size:11px}
#insp a{color:var(--ink-2)}
#insp.min .body{display:none}
#iBack{position:fixed;left:12px;top:50%;z-index:20;font:600 13px var(--f-body);background:var(--card);border:0;border-radius:10px;padding:8px 12px;box-shadow:0 3px 0 var(--steel-sh);cursor:pointer}
@media (max-width:759px){#insp{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:46%}}`;
document.head.appendChild(css);
const cats=[...new Set(GENS3D.map(g=>g[2]))];
const panel=document.createElement('div');panel.id='insp';panel.innerHTML=`
<header>Model inspector <span class="dev">DEV</span><button id="iMin" aria-label="Collapse">–</button></header>
<div class="body">
  <div class="row"><button id="iPrev" aria-label="Previous model">◀</button><select id="iModel" aria-label="Model">${cats.map(c=>`<optgroup label="${c}">${GENS3D.filter(g=>g[2]===c).map(g=>`<option value="${g[0]}">${_t('obj.'+g[0])} (${g[0]})</option>`).join('')}</optgroup>`).join('')}</select><button id="iNext" aria-label="Next model">▶</button></div>
  <div class="row"><select id="iDiff" aria-label="Difficulty">${DIFFS.map(d=>`<option value="${d}">${_t('diff.'+d)}</option>`).join('')}</select><label>Level <input id="iLevel" type="number" min="1" max="99"></label></div>
  <div class="row"><span class="grow">Variant <b id="iVar"></b></span><button id="iVarPrev" aria-label="Previous variant">−</button><button id="iVarNext">New variant</button></div>
  <div class="checks">
    <label><input type="checkbox" id="iScrews"> Screws</label>
    <label><input type="checkbox" id="iXray"> X-ray hidden</label>
    <label><input type="checkbox" id="iDropped"> <span class="sw" style="background:#ff2d55"></span>Dropped parts</label>
    <label><input type="checkbox" id="iSlots"> <span class="sw" style="background:#5b6270"></span>Unused slots</label>
    <label><input type="checkbox" id="iSpin"> Spin</label>
  </div>
  <label class="range">Explode <input id="iExp" type="range" min="0" max="1.5" step="0.05" value="0"></label>
  <div class="row"><button id="iStep" class="grow">Step</button><button id="iRun" class="grow">Take apart</button><button id="iReset" class="grow">Reset</button></div>
  <dl id="iStats"></dl>
  <div id="iInfo"></div>
  <div class="row"><button id="iPlay" class="primary grow">Play this level</button><a href="index.html">Leave</a></div>
  <p class="keys">← → model · ↑ ↓ level · R variant · X x-ray · D dropped · S slots · Space step</p>
</div>`;
document.body.appendChild(panel);
const back=document.createElement('button');back.id='iBack';back.hidden=true;back.textContent='◀ Inspector';document.body.appendChild(back);
const el=id=>panel.querySelector('#'+id);
const HINT='Tap a part to see what holds it. <span class="sw" style="background:#ff8c1a"></span>selected <span class="sw" style="background:#e8283a"></span>comes off first <span class="sw" style="background:#1f7bff"></span>held by it';

/* ----- camera: the model gets the space next to (wide) or above (narrow) the panel ----- */
const gameRect=availRect;
availRect=()=>{if(state!=='inspect')return gameRect();const r=panel.getBoundingClientRect(),W=innerWidth,H=innerHeight;
  return W>=760?{l:r.right+12,t:0,r:W,b:H}:{l:0,t:0,r:W,b:Math.max(160,r.top-8)}};

/* ----- building ----- */
const GHOST=shared(new THREE.MeshBasicMaterial({color:srgb('#ff2d55'),transparent:true,opacity:.28,depthTest:false,depthWrite:false}));
const GHOST_SEL=shared(new THREE.MeshBasicMaterial({color:srgb('#ff8c1a'),transparent:true,opacity:.7,depthTest:false,depthWrite:false}));
const SLOT_GEO=new THREE.CylinderGeometry(0.035,0.035,0.18,6);SLOT_GEO.translate(0,0.09,0);SLOT_GEO.userData.shared=true;
const SLOT_MAT=shared(new THREE.MeshBasicMaterial({color:srgb('#5b6270')})),ANCHOR_MAT=shared(new THREE.MeshBasicMaterial({color:srgb('#e8283a')}));
let B=null; // what's on screen: {lv, cfg, seed, tries, built, dead, ghosts, slots, failed}
const f2=n=>n.toFixed(2);
const describe=p=>`${p.box?`box ${f2(p.box.w)} × ${f2(p.box.h)} × ${f2(p.box.d)}`:p.cyl?`cylinder r ${f2(p.cyl.r)} h ${f2(p.cyl.h)}`:p.mesh.geometry.type.replace('Geometry','').replace('Buffer','').toLowerCase()} at (${f2(p.base.x)}, ${f2(p.base.y)}, ${f2(p.base.z)})`;

function build(){
  stopRun();select(null);
  const entry=GENS3D.find(g=>g[0]===I.name)||GENS3D[0],[name,gen]=entry,cfg=cfgFor(I.diff,I.level),salt=I.variant?'v'+I.variant:'';
  let lv=null,raw=null,seed='',tries=0;
  // Same seeds as buildLevel() in game.js, so variant 0 is exactly what that level shows in a run.
  // Each seed is built twice: once as the generator made it (to show what finalize() drops), once finalized.
  for(let a=0;a<10&&!lv;a++){seed=`3d|${I.diff}|${I.level}|${salt}|${a}`;tries=a+1;
    BLD={group:new THREE.Group(),parts:[]};gen(rng(seed),cfg);raw=BLD;
    BLD={group:new THREE.Group(),parts:[]};const R=rng(seed);gen(R,cfg);lv=finalize(R,cfg,'3d');
    if(!lv){disposeTree(raw.group);disposeTree(BLD.group)}}
  if(!lv){setCurrent(null);B={failed:true,seed,tries,cfg};renderStats();return}
  lv.name=name;const all=BLD.parts,deadIds=new Set(all.filter(p=>!p.static&&p.dead).map(p=>p.id));
  setCurrent(lv);spawnScrews(lv);lv.group.updateMatrixWorld(true);lv.screws.forEach(s=>s.hidden0=s.hidden);
  lv.parts.forEach(p=>p.base=p.mesh.position.clone());
  // dropped parts: the generator's copy of each, drawn as a red ghost on top of the model
  const ghosts=[];
  for(const p of raw.parts){if(!deadIds.has(p.id)){raw.group.remove(p.mesh);disposeTree(p.mesh);continue}
    p.base=p.mesh.position.clone();p.ghost=true;ghosts.push(p);
    p.mesh.traverse(o=>{if(!o.isMesh||o.material===PROXY_MAT)return;if(!o.material.userData.shared)o.material.dispose();o.material=GHOST;o.renderOrder=20;o.castShadow=o.receiveShadow=false})}
  raw.group.visible=I.dropped;lv.group.add(raw.group);
  // slots that didn't become a screw; red when it was an anchor (a slot that must hold the part under a cover)
  const slots=[];let anchorsLost=0;
  for(const p of lv.parts){if(p.static)continue;const used=p.screws.map(s=>p.mesh.worldToLocal(s.p.clone()));
    for(const s of p.slots){if(used.some(u=>u.distanceToSquared(s.p)<1e-6))continue;if(s.force)anchorsLost++;
      const m=new THREE.Mesh(SLOT_GEO,s.force?ANCHOR_MAT:SLOT_MAT);m.position.copy(s.p);m.quaternion.setFromUnitVectors(UPV,s.n);m.visible=I.slots;p.mesh.add(m);slots.push(m)}}
  B={lv,cfg,seed,tries,built:all.filter(p=>!p.static).length,dead:deadIds.size,ghosts,ghostGroup:raw.group,slots,anchorsLost,
    slotCount:lv.parts.reduce((n,p)=>n+(p.static?0:p.slots.length),0)};
  lv.screws.forEach(paint);el('iExp').value=I.explode=0;
  orbit.auto=I.spin&&!reduceMotion;requestAnimationFrame(()=>fitCamera(true));
  renderStats();remember()}

function paint(s){if(s.state!=='in')return;const g=s.group,h=g.children[0],d=g.children[1],ghost=s.hidden;
  g.visible=I.screws&&(!ghost||I.xray);h.material=ghost?ghostMats[s.color]:headMats[s.color];d.material=ghost?ghostDark:darkMat;
  h.renderOrder=d.renderOrder=ghost?30:0;h.castShadow=!ghost}
const liveParts=()=>B&&B.lv?B.lv.parts.filter(p=>!p.static&&p.alive):[];

function renderStats(){
  el('iModel').value=I.name;el('iDiff').value=I.diff;el('iLevel').value=I.level;el('iVar').textContent=I.variant||'0 (as in a run)';
  ['Screws','Xray','Dropped','Slots','Spin'].forEach(k=>el('i'+k).checked=I[k.toLowerCase()]);
  const row=(k,v)=>`<dt>${k}</dt><dd>${v}</dd>`,c=B.cfg;
  if(B.failed){el('iStats').innerHTML=row('Result','<span class="bad">generation failed after 10 seeds</span>')+row('Last seed',B.seed);return}
  const lv=B.lv,kept=B.built-B.dead,pct=Math.round(kept/B.built*100),out=lv.screws.filter(s=>s.state!=='in').length;
  el('iStats').innerHTML=row('Seed',`${B.seed}${B.tries>1?` <span class="bad">(${B.tries} tries)</span>`:''}`)+row('Config',`cx ${f2(c.cx)} · ${c.C} colours max · cap ${c.cap}`)
    +row('Parts',`${B.built} built · ${kept} kept (<span class="${pct<90?'bad':''}">${pct}%</span>)${B.dead?` · <span class="bad">${B.dead} dropped</span>`:''}`)
    +row('Screws',`${lv.screws.length} · ${lv.screws.filter(s=>s.hidden0).length} hidden at start · ${new Set(lv.queue).size} colours`)
    +row('Slots',`${B.slotCount} on kept parts · ${B.slotCount-lv.screws.length} unused${B.anchorsLost?` · <span class="bad">${B.anchorsLost} anchors lost</span>`:''}`)
    +(out?row('Taken apart',`${out} / ${lv.screws.length} screws`):'');
  el('iStep').disabled=el('iRun').disabled=out===lv.screws.length}

/* ----- explode: push every part away from the centre ----- */
function applyExplode(k){if(!B||!B.lv)return;const c=B.lv.center,off=p=>p.base.clone().sub(c).multiplyScalar(k);
  for(const p of liveParts())p.mesh.position.copy(p.base).add(off(p));
  for(const p of B.ghosts)p.mesh.position.copy(p.base).add(off(p));
  for(const s of B.lv.screws)if(s.state==='in')s.group.position.copy(s.p).add(off(s.part));
  B.lv.group.updateMatrixWorld(true)}
// blockers are worked out on the assembled model, whatever the explode slider says
function assembled(fn){const k=I.explode;if(k)applyExplode(0);const r=fn();if(k)applyExplode(k);return r}

/* ----- selecting a part: what it is, what must come off first, what it holds ----- */
const tint=(p,r,g,b)=>p.mesh.material.emissive&&p.mesh.material.emissive.setRGB(r,g,b);
function select(p){
  if(I.sel){if(I.sel.ghost)I.sel.mesh.material=GHOST;liveParts().forEach(q=>tint(q,0,0,0))}
  I.sel=p;const info=el('iInfo');if(!p){info.innerHTML=HINT;return}
  if(p.ghost){p.mesh.material=GHOST_SEL;
    info.innerHTML=`<b>#${p.id} dropped</b>: ${describe(p)}, ${p.slots.length} slot(s).<br>finalize() gave it no screw, so it isn't in the level. See the screw rules in docs/UNSCREW-MODELS.md.`;return}
  const r=assembled(()=>{const meshes=liveParts().map(q=>q.ray),first=new Set(),holds=new Set();
    for(const s of p.screws)if(s.state==='in'){const b=firstBlocker(s,meshes);if(b)first.add(b)}
    for(const q of liveParts())if(q!==p)for(const s of q.screws)if(s.state==='in'&&firstBlocker(s,meshes)===p)holds.add(q);
    B.lv.screws.forEach(s=>{if(s.state==='in')firstBlocker(s,meshes)});return{first,holds}}); // restores each screw's hidden flag
  r.first.forEach(q=>tint(q,.55,0,0));r.holds.forEach(q=>tint(q,0,.12,.6));tint(p,.6,.3,0);
  const inn=p.screws.filter(s=>s.state==='in');
  info.innerHTML=`<b>#${p.id}</b> ${describe(p)}<br>${inn.length} screw(s) left${inn.some(s=>s.hidden)?` (${inn.filter(s=>s.hidden).length} hidden under a cover)`:''} · ${p.slots.length} slot(s)<br>`
    +(r.first.size?`<span class="sw" style="background:#e8283a"></span>${r.first.size} part(s) must come off first`:'free: nothing blocks its screws')
    +(r.holds.size?`<br><span class="sw" style="background:#1f7bff"></span>blocks the screws of ${r.holds.size} part(s)`:'')}
const ndc=new THREE.Vector2(),ray=new THREE.Raycaster();
function pick(x,y){if(!B||!B.lv)return;ndc.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);ray.setFromCamera(ndc,camera);
  // ghosts are drawn on top of everything, so a hit on one wins
  const g=I.dropped?ray.intersectObjects(B.ghosts.map(p=>p.mesh),false)[0]:null;
  const h=g||ray.intersectObjects(liveParts().map(p=>p.ray),false)[0];select(h?h.object.userData.part:null)}
let tap=null;
canvas.addEventListener('pointerdown',e=>{tap=state==='inspect'?{x:e.clientX,y:e.clientY}:null});
canvas.addEventListener('pointerup',e=>{if(tap&&state==='inspect'&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<7)pick(e.clientX,e.clientY);tap=null});

/* ----- taking it apart, in the order finalize() proved solvable ----- */
function step(){if(!B||!B.lv)return false;if(I.explode){el('iExp').value=I.explode=0;applyExplode(0)}
  const lv=B.lv,meshes=liveParts().map(p=>p.ray),s=lv.screws.find(s=>s.state==='in'&&!firstBlocker(s,meshes));
  if(!s){lv.screws.forEach(paint);return false}
  if(I.sel)select(null);
  s.state='out';s.hidden=false;const g=s.group;g.visible=true;g.children[0].material=headMats[s.color];g.children[1].material=darkMat;g.children[0].renderOrder=g.children[1].renderOrder=0;
  unscrewAnim(s,()=>{g.visible=false});
  const p=s.part;if(--p.left===0){p.alive=false;fallPart(p);const left=liveParts().map(q=>q.ray);
    for(const x of lv.screws)if(x.state==='in'){firstBlocker(x,left);paint(x)}}
  else lv.screws.forEach(paint);
  renderStats();return true}
function stopRun(){clearInterval(I.timer);I.timer=0;el('iRun').textContent='Take apart'}
function run(){if(I.timer)return stopRun();el('iRun').textContent='Pause';I.timer=setInterval(()=>{if(!step())stopRun()},reduceMotion?60:140)}

/* ----- playing the model for real ----- */
const gamePick=pick3D,gameBuild=buildLevel;
buildLevel=(mode,diff,level,cfg,salt='')=>gameBuild(mode,diff,level,cfg,salt||(state==='play'&&I.variant?'v'+I.variant:''));
function play(){stopRun();const entry=GENS3D.find(g=>g[0]===I.name);pick3D=(d,l,salt)=>salt==='demo'?gamePick(d,l,salt):entry;
  Object.assign(G,{mode:'3d',diff:I.diff,level:I.level,score:0,hearts:3});panel.hidden=true;back.hidden=false;startLevel()}
function open(){stopRun();state='inspect';LS=null;closeModal();
  ['#hud','#tools','#viewBtn','#menu','#loading'].forEach(s=>$(s).hidden=true);$('#fx').innerHTML='';
  panel.hidden=false;back.hidden=true;build()}
back.onclick=open;

/* ----- controls ----- */
const models=GENS3D.map(g=>g[0]);
const shift=(d)=>{I.name=models[(models.indexOf(I.name)+d+models.length)%models.length];I.variant=0;build()};
el('iPrev').onclick=()=>shift(-1);el('iNext').onclick=()=>shift(1);
el('iModel').onchange=e=>{I.name=e.target.value;I.variant=0;build()};
el('iDiff').onchange=e=>{I.diff=e.target.value;build()};
el('iLevel').onchange=e=>{I.level=Math.max(1,Math.min(99,Math.round(+e.target.value)||1));build()};
el('iVarNext').onclick=()=>{I.variant++;build()};el('iVarPrev').onclick=()=>{if(I.variant){I.variant--;build()}};
const toggle=(k,fn)=>el('i'+k).onchange=e=>{I[k.toLowerCase()]=e.target.checked;fn();remember()};
toggle('Screws',()=>B&&B.lv&&B.lv.screws.forEach(paint));toggle('Xray',()=>B&&B.lv&&B.lv.screws.forEach(paint));
toggle('Dropped',()=>{if(B&&B.ghostGroup)B.ghostGroup.visible=I.dropped;if(I.sel&&I.sel.ghost)select(null)});
toggle('Slots',()=>B&&B.slots&&B.slots.forEach(m=>m.visible=I.slots));toggle('Spin',()=>orbit.auto=I.spin&&!reduceMotion);
el('iExp').oninput=e=>{I.explode=+e.target.value;applyExplode(I.explode)};
el('iStep').onclick=()=>{stopRun();step()};el('iRun').onclick=run;el('iReset').onclick=build;el('iPlay').onclick=play;
el('iMin').onclick=()=>{panel.classList.toggle('min');el('iMin').textContent=panel.classList.contains('min')?'+':'–';requestAnimationFrame(()=>fitCamera(false))};
addEventListener('keydown',e=>{if(state!=='inspect'||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.length===1?e.key.toLowerCase():e.key,flip=id=>{const c=el(id);c.checked=!c.checked;c.onchange({target:c})};
  const act={ArrowLeft:()=>shift(-1),ArrowRight:()=>shift(1),ArrowUp:()=>{I.level=Math.min(99,I.level+1);build()},ArrowDown:()=>{I.level=Math.max(1,I.level-1);build()},
    r:()=>{I.variant++;build()},x:()=>flip('iXray'),d:()=>flip('iDropped'),s:()=>flip('iSlots'),' ':()=>{stopRun();step()}}[k];
  if(act){e.preventDefault();act()}});

open();
})();
