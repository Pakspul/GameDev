/*GEN-START*/
const SCREW_COLORS=[
  {hex:'#ff3d9a',id:'pink'},{hex:'#7b4dff',id:'purple'},{hex:'#8fd61f',id:'lime'},{hex:'#ffcc1a',id:'yellow'},
  {hex:'#1f7bff',id:'blue'},{hex:'#14c8e6',id:'cyan'},{hex:'#ff7a12',id:'orange'},{hex:'#e8283a',id:'red'},{hex:'#f3f5f9',id:'white'}];
const GLASS=['#ff9db8','#ffcf70','#8fd3ff','#b8a4ff','#8ee3b0','#ffb37a','#9fe6e0','#f5a3e0'];

function cfgFor(diff,level){
  const D={easy:{K:3,B:5,C0:4,Cmax:6,minPer:1,maxPer:2,swapF:.6,win:6,margin:2,mult:1,cap:80,cx0:.1,hidPref:.25},
    normal:{K:3,B:5,C0:5,Cmax:8,minPer:1,maxPer:3,swapF:1.4,win:10,margin:1,mult:1.5,cap:140,cx0:.45,hidPref:.55},
    hard:{K:3,B:4,C0:7,Cmax:9,minPer:2,maxPer:3,swapF:2.5,win:14,margin:1,mult:2,cap:190,cx0:.85,hidPref:.85},
    expert:{K:2,B:5,C0:8,Cmax:9,minPer:2,maxPer:4,swapF:3,win:16,margin:1,mult:3,cap:240,cx0:1.15,hidPref:1}}[diff];
  return{...D,C:Math.min(D.Cmax,D.C0+Math.floor((level-1)/3)),cx:Math.min(1.6,D.cx0+(level-1)/12)};
}

/* ----- 3D: the models live in models/ (kit.js, one file per category, order.js builds GENS3D) ----- */
function pick3D(diff,level,salt){const n=GENS3D.length,cyc=Math.floor((level-1)/n);const ord=rng(`cyc|${diff}|${cyc}|${salt}`).shuffle([...Array(n).keys()]);return GENS3D[ord[(level-1)%n]]}

/* ----- 2D generator: opaque plates stacked flush ----- */
function obbOverlap(a,b,m){const ax=[a.phi,a.phi+Math.PI/2,b.phi,b.phi+Math.PI/2];
  const proj=(o,ux,uz)=>Math.abs(o.hx*(Math.cos(o.phi)*ux+Math.sin(o.phi)*uz))+Math.abs(o.hz*(-Math.sin(o.phi)*ux+Math.cos(o.phi)*uz));
  for(const t of ax){const ux=Math.cos(t),uz=Math.sin(t);if(Math.abs((b.cx-a.cx)*ux+(b.cz-a.cz)*uz)>proj(a,ux,uz)+proj(b,ux,uz)+m)return false}return true}
function planPlate(R,BW,BH){
  const kind=R.pick(['bar','bar','bar','rect','circle','tri']);let hx,hz,ang=0,slots=[],shape;
  if(kind==='bar'){const len=R.f(3.2,6.2),wd=R.f(0.86,1.02);hx=len/2;hz=wd/2;ang=R.pick([0,Math.PI/4,Math.PI/2,3*Math.PI/4,R.f(0,Math.PI)]);
    shape=roundRectShape(len,wd,wd/2);const e=len/2-0.46;slots=[[-e,0],[e,0]];if(len>4.6)slots.push([0,0])}
  else if(kind==='rect'){const w=R.f(1.8,2.9),h=R.f(1.8,2.9);hx=w/2;hz=h/2;ang=R.pick([0,0,Math.PI/4,R.f(0,Math.PI)]);shape=roundRectShape(w,h,0.34);
    const a=w/2-0.44,b=h/2-0.44;slots=[[-a,-b],[a,b],[a,-b],[-a,b]];if(Math.min(w,h)>2.5)slots.push([0,0])}
  else if(kind==='circle'){const r=R.f(0.95,1.5);hx=hz=r;shape=new THREE.Shape();shape.absarc(0,0,r,0,Math.PI*2,false);slots=[[0,0]];
    if(r>1.28)for(let k=0;k<3;k++){const a=k/3*Math.PI*2+0.3;slots.push([Math.cos(a)*r*0.68,Math.sin(a)*r*0.68])}}
  else{const s=R.f(2.4,3.2),rho=s/Math.sqrt(3);hx=hz=rho*0.9;ang=R.f(0,Math.PI*2);
    const vs=[0,1,2].map(k=>{const a=Math.PI/2+k*2*Math.PI/3;return[Math.cos(a)*rho,Math.sin(a)*rho]});shape=roundPolyShape(vs,0.34);slots=vs.map(([x,y])=>[x*0.56,y*0.56])}
  const c=Math.abs(Math.cos(ang)),s=Math.abs(Math.sin(ang)),ex=c*hx+s*hz+0.04,ez=s*hx+c*hz+0.04;
  return{shape,slots,ang,hx:hx+0.04,hz:hz+0.04,phi:-ang,cx:R.f(-BW/2+ex,BW/2-ex),cz:R.f(-BH/2+ez,BH/2-ez)}}
function makePlate(pl,y,col,t){
  const g=new THREE.ExtrudeGeometry(pl.shape,{depth:t-0.08,bevelEnabled:true,bevelThickness:0.04,bevelSize:0.04,bevelSegments:2,curveSegments:14});g.translate(0,0,-(t-0.08)/2);g.rotateX(-Math.PI/2);
  const pg=new THREE.ExtrudeGeometry(pl.shape,{depth:t,bevelEnabled:false,curveSegments:8});pg.translate(0,0,-t/2);pg.rotateX(-Math.PI/2);
  const p=addPart(g,col,V(pl.cx,y,pl.cz),eul(0,pl.ang,0),{mat:{roughness:0.42},proxy:pg});
  pl.slots.forEach(([a,b])=>addSlot(p,V(a,t/2,-b),UPV))}
function gen2D(R,cfg){
  const BW=7.2,BH=9.8,t=0.2;
  const board=box(BW+0.7,0.3,BH+0.7,'#d7b37c',V(0,-0.15,0),Q(),{static:true,r:0.12});
  const hg=new THREE.CircleGeometry(0.07,10);hg.rotateX(-Math.PI/2);const pts=[];
  for(let x=-BW/2+0.3;x<=BW/2-0.29;x+=0.6)for(let z=-BH/2+0.2;z<=BH/2-0.19;z+=0.6)pts.push([x,z]);
  const im=new THREE.InstancedMesh(hg,new THREE.MeshBasicMaterial({color:srgb('#9a7445')}),pts.length);const mm=new THREE.Matrix4();
  pts.forEach(([x,z],i)=>{mm.makeTranslation(x,0.152,z);im.setMatrixAt(i,mm)});board.mesh.add(im);
  BLD.bounds={w:BW+0.7,h:BH+0.7};
  const layers=Math.min(10,4+Math.round(cfg.cx*4)),cols=R.shuffle(GLASS.slice());let ci=0;
  for(let L=0;L<layers;L++){const y=t/2+L*t,n=R.i(3,4)+(cfg.cx>1?1:0),placed=[];
    for(let k=0;k<n;k++)for(let tr=0;tr<18;tr++){const pl=planPlate(R,BW,BH);if(placed.some(o=>obbOverlap(o,pl,0.12)))continue;placed.push(pl);makePlate(pl,y,cols[ci++%cols.length],t);break}}
}

/* ----- finalize: validate slots (open or hidden), choose screws, prove solvable, colour ----- */
function basis(n){const t1=(Math.abs(n.y)<0.9?V(0,1,0):V(1,0,0)).cross(n).normalize();return[t1,n.clone().cross(t1)]}
const _rc=new THREE.Raycaster(),_o=new THREE.Vector3();
// first part in the way of pulling this screw out; also flags screws whose head is buried in a cover
function firstBlocker(s,meshes){
  const[t1,t2]=s.basis||(s.basis=basis(s.n)),r=0.11*s.scale;s.hidden=false;let i=0;
  for(const[a,b]of[[0,0],[r,0],[-r,0],[0,r],[0,-r]]){
    _o.copy(s.p).addScaledVector(s.n,-0.02).addScaledVector(t1,a).addScaledVector(t2,b);_rc.set(_o,s.n);_rc.near=0;_rc.far=1000;
    for(const h of _rc.intersectObjects(meshes,false)){const pp=h.object.userData.part;if(pp&&pp!==s.part){if(i===0&&h.distance<0.06)s.hidden=true;return pp}}i++}
  return null}
function bestBoxOf(boxes,c){let best=null;for(const b of boxes)if(b&&b.c===c&&b.n<3&&(!best||b.n>best.n))best=b;return best}
function verify(E,queue,K,B){
  let qi=0;const act=[];for(let i=0;i<K;i++)act.push(qi<queue.length?{c:queue[qi++],n:0}:null);const buf=[];
  for(const c of E){const b=bestBoxOf(act,c);if(b)b.n++;else{if(buf.length>=B)return false;buf.push(c)}
    let ch=true;while(ch){ch=false;for(let i=0;i<K;i++){const b=act[i];if(b&&b.n===3){ch=true;const nb=act[i]=qi<queue.length?{c:queue[qi++],n:0}:null;
      if(nb)for(let j=0;j<buf.length&&nb.n<3;){if(buf[j]===nb.c){buf.splice(j,1);nb.n++}else j++}}}}}
  return true}
function disposeTree(o){o.traverse(x=>{if(x.geometry&&!x.geometry.userData.shared)x.geometry.dispose();
  if(x.material)(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>{if(!m.userData.shared){if(m.map)m.map.dispose();m.dispose()}})})}
function finalize(R,cfg,mode){
  const S=mode==='2d'?1.35:1,parts=BLD.parts,rem=parts.filter(p=>!p.static);
  PROXY_MAT.side=THREE.DoubleSide;BLD.group.updateMatrixWorld(true);
  const all=parts.map(p=>p.ray),rc=new THREE.Raycaster(),o=V();
  const h0=0.012,hT=0.125*S,clr=0.13*S,rr=0.15*S,minD=mode==='2d'?0.62:0.52;
  const chosen=[];
  const close=(pt,n)=>chosen.some(c=>{const d=pt.clone().sub(c.p);if(c.n.dot(n)<0.8)return d.length()<0.42;const al=Math.abs(d.dot(n));return al<0.1&&d.addScaledVector(n,-d.dot(n)).length()<minD});
  for(const p of R.shuffle(rem.slice())){
    const others=all.filter(m=>m!==p.ray),vs=[];
    for(const s of p.slots){const wp=p.mesh.localToWorld(s.p.clone()),wn=s.n.clone().applyQuaternion(p.mesh.quaternion).normalize();
      if(wn.y<-0.3||wp.y<0.1)continue;const[t1,t2]=basis(wn);let state=null,ok=true;
      for(const[a,b]of[[0,0],[rr,0],[-rr,0],[0,rr],[0,-rr]]){
        o.copy(wp).addScaledVector(wn,h0).addScaledVector(t1,a).addScaledVector(t2,b);rc.set(o,wn);rc.near=0;rc.far=1000;
        const hits=rc.intersectObjects(others,false),c0=new Map(),c1=new Map();let near=false,stat=false;
        const lastD=new Map();for(const h of hits){const q=h.object.userData.part;if(Math.abs((lastD.get(q)??-9)-h.distance)<1e-4)continue;lastD.set(q,h.distance);c0.set(q,(c0.get(q)||0)+1);if(h.distance>hT-h0)c1.set(q,(c1.get(q)||0)+1);if(h.distance<clr)near=true;if(q.static)stat=true}
        const in0=[...c0].filter(e=>e[1]%2).map(e=>e[0]),in1=[...c1].filter(e=>e[1]%2).map(e=>e[0]);
        let st;if(!in0.length&&!in1.length)st=near?'x':'open';else if(in0.length===1&&in1.length===1&&in0[0]===in1[0]&&!in0[0].static)st='c'+in0[0].id;else st='x';
        if(st==='x'||(state&&st!==state)||(a===0&&b===0&&stat)){ok=false;break}state=st}
      if(ok)vs.push({p:wp,n:wn,force:s.force,hid:state!=='open'})}
    const k=(mode==='2d'?R.i(Math.max(2,cfg.minPer),cfg.maxPer+1):R.i(cfg.minPer,cfg.maxPer))+Math.min(6,Math.floor(vs.length/6)),mine=[];
    let rest=R.shuffle(vs.filter(s=>!s.force));if(R.chance(cfg.hidPref))rest=rest.filter(s=>s.hid).concat(rest.filter(s=>!s.hid));
    for(const s of vs.filter(s=>s.force).concat(rest)){if(!s.force&&mine.length>=k)break;if(close(s.p,s.n))continue;
      const sc={part:p,p:s.p,n:s.n,scale:S,force:s.force,hid:s.hid};mine.push(sc);chosen.push(sc)}
    p.screws=mine}
  let total=chosen.length;
  if(total>cfg.cap){const pool=R.shuffle(chosen.slice()).sort((a,b)=>(a.force+a.hid*2)-(b.force+b.hid*2));
    for(const c of pool){if(total<=cfg.cap)break;if(c.part.screws.length<=1)continue;c.part.screws.splice(c.part.screws.indexOf(c),1);total--}}
  const kill=p=>{if(p.dead)return;p.dead=true;BLD.group.remove(p.mesh);disposeTree(p.mesh)};
  rem.forEach(p=>{if(!p.screws.length)kill(p)});
  PROXY_MAT.side=THREE.FrontSide;
  let live=rem.filter(p=>!p.dead),meshes=live.map(p=>p.ray);
  const screws=[].concat(...live.map(p=>p.screws));screws.forEach(s=>s.blocker=firstBlocker(s,meshes));
  const left=new Map(live.map(p=>[p,p.screws.length])),remaining=new Set(screws),order=[];
  const removePart=p=>{live=live.filter(q=>q!==p);meshes=live.map(q=>q.ray);for(const s of remaining)if(s.blocker===p)s.blocker=firstBlocker(s,meshes)};
  let guard=0;
  while(remaining.size&&guard++<5000){
    const free=[];for(const s of remaining)if(!s.blocker)free.push(s);
    let s;if(free.length){s=R.pick(free);order.push(s)}else{s=R.pick([...remaining]);s.part.screws.splice(s.part.screws.indexOf(s),1);if(!s.part.screws.length)kill(s.part)}
    remaining.delete(s);const l=left.get(s.part)-1;left.set(s.part,l);if(l===0)removePart(s.part)}
  while(order.length%3){const c=order.filter(s=>s.part.screws.length>1);
    if(c.length){const s=R.pick(c);order.splice(order.indexOf(s),1);s.part.screws.splice(s.part.screws.indexOf(s),1)}
    else{const s=R.pick(order);order.splice(order.indexOf(s),1);s.part.screws=[];kill(s.part)}}
  if(order.length<9)return null;
  const n=order.length,m=n/3,C=Math.min(cfg.C,m);
  const palIdx=R.shuffle(SCREW_COLORS.map((_,i)=>i)).slice(0,C),queue=[];for(let i=0;i<m;i++)queue.push(palIdx[i%C]);R.shuffle(queue);
  const E=[];queue.forEach(c=>E.push(c,c,c));const Beff=Math.max(1,cfg.B-cfg.margin);
  for(let t=0,T=Math.round(n*cfg.swapF);t<T;t++){const i=R.i(0,n-1),j=Math.max(0,Math.min(n-1,i+R.i(-cfg.win,cfg.win)));if(E[i]===E[j])continue;
    [E[i],E[j]]=[E[j],E[i]];if(!verify(E,queue,cfg.K,Beff))[E[i],E[j]]=[E[j],E[i]]}
  order.forEach((s,k)=>{s.color=E[k];delete s.blocker});
  const liveParts=parts.filter(p=>!p.dead);liveParts.forEach(p=>{p.left=p.screws.length;p.alive=true});
  const bb=new THREE.Box3();liveParts.forEach(p=>bb.expandByObject(p.mesh));
  const sph=bb.getBoundingSphere(new THREE.Sphere());
  return{group:BLD.group,parts:liveParts,screws:order,queue,center:sph.center,radius:sph.radius,bbox:bb,mode,S,bounds:BLD.bounds}}
function buildLevel(mode,diff,level,cfg,salt=''){
  for(let attempt=0;attempt<10;attempt++){
    const R=rng(`${mode}|${diff}|${level}|${salt}|${attempt}`);BLD={group:new THREE.Group(),parts:[]};let name='plates';
    if(mode==='2d')gen2D(R,cfg);else{const[nm,fn]=pick3D(diff,level,salt);name=nm;fn(R,cfg)}
    const res=finalize(R,cfg,mode);if(res){res.name=name;return res}disposeTree(BLD.group)}
  throw new Error('Level generation failed')}
/*GEN-END*/

/* ================= runtime ================= */
const $=s=>document.querySelector(s);
const _t=I18n.t;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const SKEY='unscrew.v2';
let save={};try{save=JSON.parse(localStorage.getItem(SKEY))||{}}catch(e){}
save={best:{},runs:{},stars:{},sound:true,sel:{mode:'3d',diff:'normal'},coins:ECO.start,inv:{},...save};
// Tools used to be bought ahead and stocked. Now you pay when you use one, at the price of the
// difficulty you're playing (docs/ECONOMY.md), so any stocked tools are refunded once.
for(const id in save.inv){save.coins+=(save.inv[id]||0)*(LEGACY_TOOL_PRICE[id]||0)}save.inv={};
function persist(){try{localStorage.setItem(SKEY,JSON.stringify(save))}catch(e){}}
const DIFFS=['easy','normal','hard','expert'];
const fmt=n=>n.toLocaleString(I18n.lang);
const COIN='<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10.6" r="8.6" fill="#c98a00"/><circle cx="10" cy="9.6" r="8.6" fill="#ffc21a"/><circle cx="10" cy="9.6" r="6" fill="none" stroke="#e8a400" stroke-width="1.4"/><path d="M7.4 7l5.2 5.2M12.6 7l-5.2 5.2" stroke="#9a6400" stroke-width="1.8" stroke-linecap="round"/></svg>';
const TOOLS={
  drill:{icon:'<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M3 8.5h11.5l3 2.2v3.6l-3 2.2H9.5L8.4 23H4.6l1.2-6.5H3z" fill="#ff6a13"/><rect x="4.5" y="10" width="7" height="2.5" rx="1" fill="#ffd0b0"/><path d="M17.5 12.5h6" stroke="#5b6270" stroke-width="2.4" stroke-linecap="round"/><path d="M19 10.8l1 3.4M21.5 10.8l1 3.4" stroke="#8a95a5" stroke-width="1"/></svg>'},
  hammer:{icon:'<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M5 22l10-10" stroke="#a9744a" stroke-width="3.4" stroke-linecap="round"/><path d="M11.5 5.5l5-2.5 6.5 6.5-2.5 2.5-3-1.4-2.5 2.5-5-5z" fill="#5b6270"/><path d="M16.5 3l6.5 6.5" stroke="#8a95a5" stroke-width="1.5"/></svg>'},
  chest:{icon:'<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M9 9V6.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 17 6.5V9" fill="none" stroke="#5b6270" stroke-width="2.2"/><rect x="3" y="9" width="20" height="13" rx="2.5" fill="#e8283a"/><rect x="3" y="13" width="20" height="2.6" fill="#a81c2a"/><rect x="11" y="12" width="4" height="4.6" rx="1" fill="#ffc21a"/></svg>'},
  magnet:{icon:'<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M6.5 4v9a6.5 6.5 0 0 0 13 0V4" fill="none" stroke="#e8283a" stroke-width="4.4"/><path d="M6.5 3.5v4M19.5 3.5v4" stroke="#c9d0da" stroke-width="4.4"/><path d="M2 12h2M22 12h2M4 17l1.6-1M22 17l-1.6-1" stroke="#1f7bff" stroke-width="1.6" stroke-linecap="round"/></svg>'},
  xray:{icon:'<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="8" cy="13" r="5" fill="#bdf3ff" stroke="#17212e" stroke-width="2"/><circle cx="18" cy="13" r="5" fill="#bdf3ff" stroke="#17212e" stroke-width="2"/><path d="M11.2 11.6c1.2-1 2.4-1 3.6 0" fill="none" stroke="#17212e" stroke-width="2"/><circle cx="8" cy="13" r="1.8" fill="#ff3d9a"/><circle cx="18" cy="13" r="1.8" fill="#ffcc1a"/></svg>'}};
const TOOL_ORDER=['drill','hammer','chest','magnet','xray'];
for(const id of TOOL_ORDER){TOOLS[id].name=_t('tool.'+id);TOOLS[id].desc=_t('tool.'+id+'.desc')}

/* --- audio --- */
let AC=null,master=null,noiseBuf=null;
function ensureAudio(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=0.55;master.connect(AC.destination);
  noiseBuf=AC.createBuffer(1,AC.sampleRate*0.03,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)}catch(e){AC=null}}
function tone(f,dur,type='sine',vol=0.15,when=0,slide=0){if(!AC||!save.sound)return;const t=AC.currentTime+when,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(f*slide,t+dur);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.03)}
function tick(when,vol=0.2,freq=3200){if(!AC||!save.sound)return;const s=AC.createBufferSource();s.buffer=noiseBuf;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;f.Q.value=2;const g=AC.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(master);s.start(AC.currentTime+when)}
const sfx={unscrew(){for(let i=0;i<4;i++)tick(i*0.06,0.28,2600+i*400);tone(420,0.26,'triangle',0.05,0.02,2)},
  tink(){tone(1500+Math.random()*250,0.16,'sine',0.11);tone(3100,0.07,'sine',0.03)},lock(){tone(150,0.16,'square',0.06,0,0.7);tick(0,0.2,900)},
  box(c){[660,880,1100].forEach((f,i)=>tone(f*(1+c*0.06),0.15,'triangle',0.08,i*0.055))},fall(){tone(260,0.32,'sine',0.1,0,0.45)},
  coin(){tone(1320,0.09,'square',0.05);tone(1760,0.14,'square',0.05,0.07)},drill(){tone(180,0.5,'sawtooth',0.05,0,1.6);for(let i=0;i<8;i++)tick(i*0.05,0.12,1800)},
  hammer(){tone(90,0.25,'sine',0.25,0,0.5);tick(0,0.5,600)},reveal(){tone(880,0.12,'sine',0.06,0,1.5)},
  win(){[523,659,784,1046].forEach((f,i)=>tone(f,0.24,'triangle',0.11,i*0.09))},fail(){[440,370,311,262].forEach((f,i)=>tone(f,0.3,'sawtooth',0.04,i*0.12))}};

/* --- three setup --- */
const canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=THREE.sRGBEncoding;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene();
const persp=new THREE.PerspectiveCamera(34,1,0.1,300),ortho=new THREE.OrthographicCamera(-5,5,5,-5,1,100);
let camera=persp;
const hemi=new THREE.HemisphereLight(srgb('#eef6ff'),srgb('#c8b28c'),0.82);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,0.95);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.02;scene.add(sun,sun.target);
const rim=new THREE.DirectionalLight(srgb('#dbe8ff'),0.32);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.ShadowMaterial({opacity:0.16}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);

function mergeGeos(gs){const a=gs.map(g=>g.index?g.toNonIndexed():g);let n=0;a.forEach(g=>n+=g.attributes.position.count);
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3);let o=0;a.forEach(g=>{pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count});
  const m=new THREE.BufferGeometry();m.setAttribute('position',new THREE.BufferAttribute(pos,3));m.setAttribute('normal',new THREE.BufferAttribute(nor,3));return m}
const SG=(()=>{const head=new THREE.LatheGeometry([[0,0],[0.205,0],[0.21,0.035],[0.19,0.075],[0.13,0.105],[0,0.112]].map(([x,y])=>new THREE.Vector2(x,y)),28);
  const c1=new THREE.BoxGeometry(0.27,0.05,0.05);c1.translate(0,0.1,0);const c2=c1.clone();c2.rotateY(Math.PI/2);
  const sh=new THREE.CylinderGeometry(0.06,0.045,0.4,10);sh.translate(0,-0.2,0);
  const dark=mergeGeos([c1,c2,sh]),hit=new THREE.SphereGeometry(0.31,10,8);hit.translate(0,0.05,0);
  [head,dark,hit].forEach(g=>g.userData.shared=true);return{head,dark,hit}})();
const shared=m=>{m.userData.shared=true;return m};
const headMats=SCREW_COLORS.map(c=>shared(new THREE.MeshStandardMaterial({color:srgb(c.hex),roughness:.28,metalness:.08})));
const ghostMats=SCREW_COLORS.map(c=>shared(new THREE.MeshBasicMaterial({color:srgb(c.hex),transparent:true,opacity:.9,depthTest:false})));
const darkMat=shared(new THREE.MeshStandardMaterial({color:srgb('#2a303a'),roughness:.45,metalness:.35}));
const ghostDark=shared(new THREE.MeshBasicMaterial({color:srgb('#2a303a'),transparent:true,opacity:.9,depthTest:false}));
const hitMat=shared(new THREE.MeshBasicMaterial({visible:false}));

let CUR=null,LS=null,state='menu',anims=[];
const G={mode:'3d',diff:'normal',level:1,score:0,hearts:3};
const orbit={az:0.75,pol:1.02,dist:14,fit:14,target:V(),auto:false,tw:null};

function look(s){if(s.state!=='in')return;const g=s.group,h=g.children[0],d=g.children[1],xr=LS&&LS.xrayUntil>performance.now();
  if(!s.hidden){g.visible=true;h.material=headMats[s.color];d.material=darkMat;h.renderOrder=d.renderOrder=0;h.castShadow=true}
  else if(xr){g.visible=true;h.material=ghostMats[s.color];d.material=ghostDark;h.renderOrder=d.renderOrder=30;h.castShadow=false}
  else g.visible=false}
function spawnScrews(lv){const meshes=lv.parts.filter(p=>!p.static).map(p=>p.ray);
  lv.screws.forEach(s=>{const g=new THREE.Group(),h=new THREE.Mesh(SG.head,headMats[s.color]),d=new THREE.Mesh(SG.dark,darkMat),hit=new THREE.Mesh(SG.hit,hitMat);
    if(lv.mode==='2d')hit.scale.setScalar(1.1);g.add(h,d,hit);g.position.copy(s.p);g.quaternion.setFromUnitVectors(UPV,s.n);g.rotateY(Math.random()*Math.PI);
    g.scale.setScalar(s.scale);s.baseQ=g.quaternion.clone();s.group=g;s.hit=hit;hit.userData.screw=s;s.state='in';lv.group.add(g);
    s.blocker=firstBlocker(s,meshes);look(s)});return meshes}
function setCurrent(lv){if(CUR){scene.remove(CUR.group);disposeTree(CUR.group)}anims=[];CUR=lv;if(!lv)return;scene.add(lv.group);
  const is2=lv.mode==='2d',c=lv.center,R=lv.radius;ground.visible=!is2;
  const dir=is2?V(-0.45,1,-0.6).normalize():V(-0.55,1,0.7).normalize();
  sun.position.copy(c).addScaledVector(dir,R*3);sun.target.position.copy(c);sun.intensity=is2?0.75:0.95;hemi.intensity=is2?0.9:0.82;
  const sc=sun.shadow.camera;sc.left=-R*1.2;sc.right=R*1.2;sc.top=R*1.2;sc.bottom=-R*1.2;sc.near=0.5;sc.far=R*7;sc.updateProjectionMatrix();
  rim.position.copy(c).add(V(4,3,-8));orbit.target.copy(c)}

/* --- camera fit --- */
function availRect(){const W=innerWidth,H=innerHeight;
  if(state==='menu'){const m=$('#menuCard').getBoundingClientRect();if(W>=880)return{l:m.right+20,t:0,r:W,b:H};
    const t=$('#brand').getBoundingClientRect().bottom+4;return m.top-t>170?{l:0,t,r:W,b:m.top}:{l:0,t:0,r:W,b:H}}
  const t=$('#trays').getBoundingClientRect().bottom+8,b=$('#tools').getBoundingClientRect().top-6;return{l:0,t,r:W,b:Math.max(b,t+120)}}
function fitCamera(reset){if(!CUR)return;const W=innerWidth,H=innerHeight;renderer.setSize(W,H,false);
  const a=availRect(),aw=Math.max(80,a.r-a.l),ah=Math.max(80,a.b-a.t),xc=(a.l+a.r)/2,yc=(a.t+a.b)/2;
  if(CUR.mode==='2d'){camera=ortho;const bw=CUR.bounds.w,bh=CUR.bounds.h,wpp=Math.max(bw/aw,bh/ah)*1.05;
    ortho.left=-W*wpp/2;ortho.right=W*wpp/2;ortho.top=H*wpp/2;ortho.bottom=-H*wpp/2;ortho.position.set(0,40,0);ortho.up.set(0,0,-1);ortho.lookAt(0,0,0);
    ortho.setViewOffset(W,H,W/2-xc,H/2-yc,W,H);ortho.updateProjectionMatrix()}
  else{camera=persp;persp.aspect=W/H;persp.setViewOffset(W,H,W/2-xc,H/2-yc,W,H);persp.updateProjectionMatrix();
    const tv=Math.tan(persp.fov*Math.PI/360),ev=Math.atan(tv*ah/H),eh=Math.atan(tv*(W/H)*aw/W);const fit=CUR.radius/Math.sin(Math.min(ev,eh))*0.98;
    const k=orbit.dist/orbit.fit;orbit.fit=fit;if(reset){orbit.dist=fit;orbit.az=0.75;orbit.pol=1.02}else orbit.dist=fit*Math.min(1.6,Math.max(0.3,k))}}
function applyOrbit(){const sp=Math.sin(orbit.pol),t=orbit.target;persp.position.set(t.x+orbit.dist*sp*Math.sin(orbit.az),t.y+orbit.dist*Math.cos(orbit.pol),t.z+orbit.dist*sp*Math.cos(orbit.az));persp.lookAt(t)}
addEventListener('resize',()=>{fitCamera(false)});

/* --- input --- */
const ptrs=new Map();let down=null,pinch0=0,dist0=0;const ndc=new THREE.Vector2(),pickRay=new THREE.Raycaster();
canvas.addEventListener('pointerdown',e=>{ensureAudio();try{canvas.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1)down={x:e.clientX,y:e.clientY,moved:false};else{if(down)down.moved=true;const[a,b]=[...ptrs.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y);dist0=orbit.dist}});
canvas.addEventListener('pointermove',e=>{const pv=ptrs.get(e.pointerId);if(!pv)return;const dx=e.clientX-pv.x,dy=e.clientY-pv.y;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const is3=CUR&&CUR.mode==='3d';
  if(ptrs.size===1&&down){if(!down.moved&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)down.moved=true;
    if(down.moved&&is3){orbit.az-=dx*0.009;orbit.pol=Math.min(1.5,Math.max(0.2,orbit.pol-dy*0.007));orbit.auto=false;orbit.tw=null}}
  else if(ptrs.size===2&&is3){const[a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(d>10)orbit.dist=clampDist(dist0*pinch0/d)}});
function endPtr(e){const tap=down&&!down.moved&&ptrs.size===1&&e.type==='pointerup';ptrs.delete(e.pointerId);if(tap)onTap(e.clientX,e.clientY);if(!ptrs.size)down=null}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{if(!CUR||CUR.mode!=='3d')return;e.preventDefault();orbit.dist=clampDist(orbit.dist*(1+Math.sign(e.deltaY)*0.08))},{passive:false});
const clampDist=d=>Math.min(orbit.fit*1.6,Math.max(orbit.fit*0.3,d));
function onTap(x,y){if(state!=='play'||!LS||LS.done||LS.paused)return;
  ndc.set(x/innerWidth*2-1,-(y/innerHeight)*2+1);pickRay.setFromCamera(ndc,camera);
  if(LS.target==='hammer'){const h=pickRay.intersectObjects(LS.meshes,false)[0];if(h)hammerHit(h.object.userData.part);return}
  const hits=pickRay.intersectObjects(LS.screws.filter(s=>s.state==='in'&&!s.hidden).map(s=>s.hit),false);if(!hits.length)return;
  if(CUR.mode==='2d')return tapScrew(hits[0].object.userData.screw);
  const ph=pickRay.intersectObjects(LS.meshes,false)[0];if(!ph||hits[0].distance<=ph.distance+0.12)tapScrew(hits[0].object.userData.screw)}
addEventListener('keydown',e=>{if(e.key==='Escape'&&state==='play'&&$('#modal').hidden)openPause()});

/* --- screen helpers --- */
const HOLE_POS=[[.5,.41],[.33,.69],[.67,.69]];
function screenOf(wp,scale){const v=wp.clone().project(camera),x=(v.x+1)/2*innerWidth,y=(1-v.y)/2*innerHeight;
  const r=V(1,0,0).applyQuaternion(camera.quaternion).multiplyScalar(0.21*scale),v2=wp.clone().add(r).project(camera);
  return{x,y,size:Math.max(14,Math.hypot((v2.x+1)/2*innerWidth-x,(1-v2.y)/2*innerHeight-y)*2)}}
function holeCenter(bi,k){const r=$('#boxes').children[bi].getBoundingClientRect();return{x:r.left+r.width*HOLE_POS[k][0],y:r.top+r.height*HOLE_POS[k][1],size:r.width*0.24}}
function railCenter(j){const r=$('#rail').children[j].getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,size:r.width-6}}
const tokHTML=c=>`<i class="tok" style="--c:${SCREW_COLORS[c].hex}"></i>`;
function fly(c,from,to,done){const ls=LS,el=document.createElement('i');el.className='tok';el.style.setProperty('--c',SCREW_COLORS[c].hex);
  const s=to.size;el.style.width=el.style.height=s+'px';$('#fx').appendChild(el);const k0=Math.max(0.5,Math.min(2.4,from.size/s));
  const x0=from.x-s/2,y0=from.y-s/2,x1=to.x-s/2,y1=to.y-s/2,mx=(x0+x1)/2,my=Math.min(y0,y1)-50;
  const an=el.animate([{transform:`translate(${x0}px,${y0}px) scale(${k0}) rotate(0deg)`},{transform:`translate(${mx}px,${my}px) scale(${(k0+1)/2*1.15}) rotate(200deg)`,offset:.5},{transform:`translate(${x1}px,${y1}px) scale(1) rotate(360deg)`}],
    {duration:reduceMotion?150:520,easing:'cubic-bezier(.35,.1,.25,1)',fill:'forwards'});
  an.onfinish=()=>{el.remove();if(ls===LS)done()}}
let toastT=0;function toast(t,ms=1700){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),ms)}

/* --- HUD --- */
$('#coinIco').innerHTML=COIN;
const HEART='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17.5S2.5 12.7 2.5 7.4A4 4 0 0 1 10 5.3a4 4 0 0 1 7.5 2.1c0 5.3-7.5 10.1-7.5 10.1z" fill="FILL"/></svg>';
function renderTop(){$('#lvN').textContent=G.level;$('#lvS').textContent=`${CUR?_t('obj.'+CUR.name):''} · ${_t('diff.'+G.diff)} · ${G.mode.toUpperCase()}`;
  $('#hearts').innerHTML=[0,1,2].map(i=>HEART.replace('FILL',i<G.hearts?'#ff4d6d':'rgba(23,33,46,.18)')).join('');$('#hearts').setAttribute('aria-label',_t('lives',{n:G.hearts}));renderScore();renderProgress();renderCoins()}
function runScore(){return Math.max(0,G.score+(LS?LS.levelScore:0))}
function renderScore(){$('#scoreN').textContent=fmt(runScore())}
function renderCoins(){$('#coinN').textContent=fmt(save.coins);const sc=$('#stCoins');if(sc)sc.textContent=fmt(save.coins)}
function renderProgress(){const p=LS?LS.removed/LS.total*100:0;$('#progFill').style.width=p+'%';$('#progT').textContent=LS?`${LS.removed}/${LS.total}`:''}
function fillBay(i,pop){const bay=$('#boxes').children[i],b=LS.boxes[i];bay.innerHTML='';
  if(!b){bay.innerHTML='<div class="box empty"></div>';return}
  const c=SCREW_COLORS[b.c],el=document.createElement('div');el.className='box';el.style.setProperty('--c',c.hex);el.style.setProperty('--cd',shade(c.hex,0.72));
  el.setAttribute('role','img');el.setAttribute('aria-label',_t('box.'+c.id));
  el.innerHTML=`<span class="handle"></span><span class="plate"></span>${[0,1,2].map(k=>`<span class="h h${k}">${k<b.arrived?tokHTML(b.c):''}</span>`).join('')}<span class="lid"></span>`;
  bay.appendChild(el);b.el=el;if(pop&&!reduceMotion)el.animate([{transform:'scale(.5)',opacity:0},{transform:'scale(1.08)',opacity:1,offset:.7},{transform:'scale(1)'}],{duration:300,easing:'ease-out'})}
function renderBoxes(){const w=$('#boxes');while(w.children.length<LS.boxes.length){const d=document.createElement('div');d.className='bay';w.appendChild(d)}while(w.children.length>LS.boxes.length)w.lastChild.remove();LS.boxes.forEach((_,i)=>fillBay(i))}
function renderRail(newSlot){const r=$('#rail');if(r.children.length!==LS.cap){r.innerHTML='';for(let j=0;j<LS.cap;j++){const h=document.createElement('div');h.className='rh';r.appendChild(h)}}
  const by=new Map(LS.buffer.filter(i=>i.arrived).map(i=>[i.slot,i]));[...r.children].forEach((h,j)=>{const it=by.get(j);const want=it?String(it.c):'';if(h.dataset.c!==want){h.dataset.c=want;h.innerHTML=it?tokHTML(it.c):''}});
  if(newSlot!=null){const h=r.children[newSlot];h.classList.remove('new');void h.offsetWidth;h.classList.add('new')}}
function renderTools(){const el=$('#tools');if(!el.children.length){el.innerHTML=TOOL_ORDER.map(id=>`<button class="tool" data-tool="${id}">${TOOLS[id].icon}<b>${TOOLS[id].name}</b><small></small><span class="badge" hidden></span></button>`).join('');
    el.querySelectorAll('.tool').forEach(b=>b.onclick=()=>useTool(b.dataset.tool))}
  el.querySelectorAll('.tool').forEach(b=>{const id=b.dataset.tool,price=toolPrice(id);b.querySelector('.badge').hidden=true;
    b.querySelector('small').innerHTML=`${COIN}${price}`;b.disabled=!canUse(id);b.classList.toggle('on',!!LS&&LS.target===id);
    b.setAttribute('aria-label',`${TOOLS[id].name}: ${_t('priceN',{n:price})}`)});
  $('#viewBtn').hidden=!(state==='play'&&CUR&&CUR.mode==='3d')}

/* --- level flow --- */
function nextBox(){return LS.qi<LS.queue.length?{c:LS.queue[LS.qi++],n:0,arrived:0,state:'ready'}:null}
const bestBox=c=>bestBoxOf(LS.boxes.filter(b=>b&&b.state==='ready'),c);
const key=(m=G.mode,d=G.diff)=>m+'-'+d;
function startLevel(){
  state='play';closeModal();$('#loading').hidden=false;$('#hud').hidden=false;$('#tools').hidden=false;$('#menu').hidden=true;LS=null;
  setTimeout(()=>{
    const cfg=cfgFor(G.diff,G.level),lv=buildLevel(G.mode,G.diff,G.level,cfg);setCurrent(lv);
    LS={cfg,lv,screws:lv.screws,total:lv.screws.length,removed:0,boxes:[],queue:lv.queue,qi:0,buffer:[],cap:cfg.B,busy:0,levelScore:0,combo:0,lastBox:0,
      start:performance.now(),drills:0,chestUsed:false,uses:{},helped:false,target:null,xrayUntil:0,done:false,paused:false,meshes:[]};
    LS.meshes=spawnScrews(lv);
    for(let i=0;i<cfg.K;i++)LS.boxes.push(nextBox());
    renderTop();renderBoxes();renderRail();renderTools();$('#loading').hidden=true;orbit.auto=false;orbit.tw=null;
    requestAnimationFrame(()=>fitCamera(true));
    save.runs[key()]={level:G.level,score:G.score,hearts:G.hearts};persist()},30)}
function addScore(v){if(!LS)return;LS.levelScore+=Math.round(v*LS.cfg.mult);renderScore();const b=save.best[key()]||{score:0,level:0};if(runScore()>b.score){b.score=runScore();save.best[key()]=b}}
function addCoins(n){save.coins+=n;renderCoins();persist()}

function tapScrew(s){
  if(s.state!=='in'||s.hidden)return;const blk=firstBlocker(s,LS.meshes);s.blocker=blk;
  if(blk){shakeScrew(s);flashPart(blk);sfx.lock();return}
  if(!pullScrew(s)){shakeScrew(s);sfx.lock();const r=$('#rail');r.classList.remove('alarm');void r.offsetWidth;r.classList.add('alarm');toast(_t('toast.railFull'))}}
function freeSlot(){const used=new Set(LS.buffer.map(i=>i.slot));for(let j=0;j<LS.cap;j++)if(!used.has(j))return j;return -1}
function pullScrew(s,delay=0){
  const box=bestBox(s.color);let dest;
  if(box){box.n++;dest={box,idx:box.n-1}}
  else{const slot=freeSlot();if(slot<0)return false;const it={c:s.color,slot,arrived:false};LS.buffer.push(it);dest={it}}
  s.state='out';s.hidden=false;const g=s.group;g.visible=true;g.children[0].material=headMats[s.color];g.children[1].material=darkMat;g.children[0].renderOrder=g.children[1].renderOrder=0;
  LS.removed++;LS.busy++;addScore(10);renderProgress();
  const p=s.part;p.left--;if(p.left===0)killPart(p);
  const ls=LS,go=()=>{if(ls!==LS)return;sfx.unscrew();unscrewAnim(s,()=>{if(ls!==LS)return;const from=screenOf(s.group.position.clone().addScaledVector(s.n,0.06),s.scale);s.group.visible=false;LS.busy--;flyTo(s.color,from,dest)})};
  if(delay)setTimeout(go,delay);else go();return true}
function flyTo(c,from,dest){LS.busy++;
  if(dest.box){fly(c,from,holeCenter(LS.boxes.indexOf(dest.box),dest.idx),()=>{LS.busy--;arriveBox(dest.box,dest.idx)})}
  else fly(c,from,railCenter(dest.it.slot),()=>{LS.busy--;dest.it.arrived=true;renderRail(dest.it.slot);sfx.tink();tryAbsorb();checkSoon()})}
function arriveBox(b,k){b.arrived++;const h=b.el&&b.el.querySelectorAll('.h')[k];if(h)h.innerHTML=tokHTML(b.c);sfx.tink();if(b.arrived===3)completeBox(b);checkSoon()}
function completeBox(b){LS.busy++;b.state='leaving';const now=performance.now();LS.combo=now-LS.lastBox<3500?Math.min(5,LS.combo+1):1;LS.lastBox=now;
  addScore(25*LS.combo);const ls=LS,i=LS.boxes.indexOf(b),bay=$('#boxes').children[i];
  if(LS.combo>1){const t=document.createElement('div');t.className='combo';t.textContent=_t('combo',{n:LS.combo});bay.appendChild(t);t.animate([{transform:'translate(-50%,0)',opacity:1},{transform:'translate(-50%,-26px)',opacity:0}],{duration:900,easing:'ease-out',fill:'forwards'})}
  setTimeout(()=>{if(ls!==LS)return;sfx.box(LS.combo);const lid=b.el.querySelector('.lid');
    lid.animate([{transform:'translateY(-24px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:reduceMotion?1:180,fill:'forwards',easing:'ease-in'});
    const an=b.el.animate([{transform:'none',opacity:1},{transform:'translateY(4px) scale(1.04)',opacity:1,offset:.35},{transform:'translateY(-46px) scale(.7)',opacity:0}],{duration:reduceMotion?1:420,delay:reduceMotion?0:200,easing:'ease-in',fill:'forwards'});
    an.onfinish=()=>{if(ls!==LS)return;const j=LS.boxes.indexOf(b);LS.boxes[j]=nextBox();fillBay(j,true);LS.busy--;tryAbsorb();checkSoon()}},200)}
function tryAbsorb(){for(const it of LS.buffer.slice()){if(!it.arrived)continue;const b=bestBox(it.c);if(!b)continue;b.n++;const k=b.n-1;
  LS.buffer.splice(LS.buffer.indexOf(it),1);const from=railCenter(it.slot);renderRail();LS.busy++;fly(it.c,from,holeCenter(LS.boxes.indexOf(b),k),()=>{LS.busy--;arriveBox(b,k)})}}
function killPart(p){p.alive=false;LS.meshes=LS.meshes.filter(m=>m!==p.ray);let rev=0;
  for(const s of LS.screws)if(s.state==='in'&&s.blocker===p){const was=s.hidden;s.blocker=firstBlocker(s,LS.meshes);if(was&&!s.hidden){rev++;revealAnim(s)}else look(s)}
  if(rev)setTimeout(()=>sfx.reveal(),250);
  const ls=LS;setTimeout(()=>{if(ls===LS)fallPart(p)},200)}
let checkT=0;function checkSoon(){clearTimeout(checkT);checkT=setTimeout(check,40)}
function hasMove(){return LS.screws.some(s=>s.state==='in'&&!s.blocker&&bestBox(s.color))}
function check(){if(!LS||LS.done||LS.busy>0||state!=='play')return;
  if(LS.removed===LS.total){if(!LS.buffer.length&&LS.boxes.every(b=>!b))levelComplete();return}
  if(LS.buffer.length>=LS.cap&&!hasMove())stuck()}

/* --- tools --- */
function canUse(id){if(!LS||LS.done)return false;if(id==='drill')return LS.drills<2;if(id==='chest')return !LS.chestUsed&&LS.qi<LS.queue.length;return true}
// Price of the next use in this level: a multiple of what a level of this difficulty pays,
// doubling for each extra drill, magnet, hammer or chest (games/unscrew/economy.js).
function toolPrice(id,diff){return ECO.price(id,diff||G.diff,LS?LS.uses[id]||0:0)}
function affordable(id){return save.coins>=toolPrice(id)}
function pay(id){save.coins-=toolPrice(id);LS.uses[id]=(LS.uses[id]||0)+1;LS.helped=true;renderCoins();persist();renderTools()}
function useTool(id){ensureAudio();if(state!=='play'||!LS||LS.done||LS.paused)return;
  if(LS.target===id){LS.target=null;renderTools();toast(_t('toast.hammerAway'));return}
  if(!canUse(id))return toast(_t(id==='drill'?'toast.maxDrills':'toast.cantNow'));
  if(!affordable(id))return toast(_t('toast.needCoins',{n:toolPrice(id)-save.coins}));
  if(id==='hammer'){LS.target='hammer';renderTools();toast(_t('toast.hammerTap'),2600);return}
  if(TOOL_FN[id]())pay(id)}
const TOOL_FN={
  drill(){LS.cap++;LS.drills++;renderRail(LS.cap-1);sfx.drill();requestAnimationFrame(()=>fitCamera(false));toast(_t('toast.drilled'));checkSoon();return true},
  chest(){const b=nextBox();if(!b){toast(_t('toast.noBoxes'));return false}LS.chestUsed=true;LS.boxes.push(b);renderBoxes();fillBay(LS.boxes.length-1,true);
    requestAnimationFrame(()=>{fitCamera(false);tryAbsorb();checkSoon()});toast(_t('toast.chest'));return true},
  magnet(){let n=0;for(const s of LS.screws)if(s.state==='in'&&!s.blocker&&!s.hidden&&bestBox(s.color)){pullScrew(s,n*90);n++}
    if(!n){toast(_t('toast.magnetNone'));return false}toast(_t('toast.magnet',{n}));return true},
  xray(){LS.xrayUntil=performance.now()+8000;const ls=LS;LS.screws.forEach(look);setTimeout(()=>{if(ls===LS)LS.screws.forEach(look)},8050);
    const n=LS.screws.filter(s=>s.state==='in'&&s.hidden).length;toast(n?_t('toast.xray',{n}):_t('toast.xrayNone'),2400);return true}};
function routeOk(colors){const boxes=LS.boxes.map(b=>b&&b.state==='ready'?{c:b.c,n:b.n}:null);let free=LS.cap-LS.buffer.length;
  for(const c of colors){const b=bestBoxOf(boxes,c);if(b)b.n++;else if(free>0)free--;else return false}return true}
function hammerHit(p){if(!p||!p.alive)return;const list=p.screws.filter(s=>s.state==='in');if(!list.length)return;
  if(!routeOk(list.map(s=>s.color))){toast(_t('toast.noRoom',{n:list.length}));return}
  LS.target=null;pay('hammer');sfx.hammer();flashPart(p);list.forEach((s,i)=>pullScrew(s,120+i*110));renderTools()}

/* --- 3D animations --- */
const _qy=new THREE.Quaternion();
function unscrewAnim(s,done){let t=0;const D=reduceMotion?0.08:0.32,base=s.p.clone();
  anims.push(dt=>{t+=dt;const k=Math.min(1,t/D),e=1-(1-k)*(1-k);s.group.position.copy(base).addScaledVector(s.n,0.5*e*s.scale);_qy.setFromAxisAngle(UPV,-k*Math.PI*3);s.group.quaternion.copy(s.baseQ).multiply(_qy);if(k>=1){done();return false}})}
function shakeScrew(s){let t=0;anims.push(dt=>{t+=dt;_qy.setFromAxisAngle(UPV,Math.sin(t*55)*0.3*(1-t/0.3));s.group.quaternion.copy(s.baseQ).multiply(_qy);if(t>=0.3){s.group.quaternion.copy(s.baseQ);return false}})}
function revealAnim(s){look(s);if(reduceMotion)return;let t=0;const g=s.group,S=s.scale;g.scale.setScalar(0.01);anims.push(dt=>{t+=dt;const k=Math.min(1,t/0.35);g.scale.setScalar(S*(k<0.7?k/0.7*1.25:1.25-(k-0.7)/0.3*0.25));if(k>=1){g.scale.setScalar(S);return false}})}
function flashPart(p){const m=p.mesh.material;let t=0;anims.push(dt=>{t+=dt;const k=Math.max(0,1-t/0.6);m.emissive.setRGB(0.6*k,0.2*k,0);if(t>=0.6)return false})}
function fallPart(p){const m=p.mesh,is2=CUR.mode==='2d',mats=[];m.traverse(o=>{if(o.material&&!o.material.userData.shared){o.material.transparent=true;mats.push([o.material,o.material.opacity])}});sfx.fall();
  let t=0;const s0=m.scale.x;
  if(is2){const spin=(Math.random()-.5)*1.2;anims.push(dt=>{t+=dt;const k=Math.min(1,t/0.7);m.position.y-=dt*4;m.rotation.y+=spin*dt;m.scale.setScalar(s0*(1-0.35*k));mats.forEach(([mm,o])=>mm.opacity=o*(1-k));if(k>=1){m.parent&&m.parent.remove(m);return false}});return}
  const dir=m.position.clone().sub(CUR.center);dir.y=0;if(dir.lengthSq()<1e-3)dir.set(Math.random()-.5,0,Math.random()-.5);dir.normalize();
  const vel=dir.multiplyScalar(2.4).add(V(0,3.4,0)),spin=V(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(6);
  anims.push(dt=>{t+=dt;vel.y-=16*dt;m.position.addScaledVector(vel,dt);m.rotation.x+=spin.x*dt;m.rotation.y+=spin.y*dt;m.rotation.z+=spin.z*dt;
    if(t>0.8)mats.forEach(([mm,o])=>mm.opacity=o*Math.max(0,1-(t-0.8)/0.6));if(t>1.4){m.parent&&m.parent.remove(m);return false}})}
$('#viewBtn').onclick=()=>{if(!CUR||CUR.mode!=='3d')return;orbit.tw={az:0.75,pol:1.02};orbit.dist=orbit.fit};
$('#pauseBtn').onclick=()=>openPause();

/* --- modals --- */
function modal(title,body,actions){$('#mTitle').textContent=title;$('#mBody').innerHTML=body;const a=$('#mActions');a.innerHTML='';
  actions.forEach(([label,fn,cls])=>{const b=document.createElement('button');b.className='btn '+(cls||'');b.innerHTML=label;b.onclick=()=>{if(fn()!=='keep')closeModal()};a.appendChild(b)});
  $('#modal').hidden=false;setTimeout(()=>a.querySelector('button')&&a.querySelector('button').focus(),50)}
function closeModal(){$('#modal').hidden=true}
// Not a shop any more: tools are paid when you use them, so this lists what they cost on the
// difficulty you're playing (or have selected in the menu).
function openShop(after){const diff=LS?G.diff:save.sel.diff;
  const body=`<div class="wallet">${COIN}<span>${fmt(save.coins)}</span></div><p class="snote">${_t('shop.note',{diff:_t('diff.'+diff)})}</p><div class="shop">${TOOL_ORDER.map(id=>{const t=TOOLS[id];
    return`<div class="srow">${t.icon}<div><span class="nm">${t.name}</span><div class="ds">${t.desc}</div></div><span class="sprice" aria-label="${_t('priceN',{n:toolPrice(id,diff)})}">${COIN}${toolPrice(id,diff)}</span></div>`}).join('')}</div>`;
  modal(_t('shop.title'),body,[[_t('done'),after,'primary']])}
function openPause(){if(!LS)return;LS.paused=true;const soundBtn=()=>_t(save.sound?'sound.on':'sound.off');
  modal(_t('pause'),`<p>${_t('pause.body',{level:G.level,removed:LS.removed,total:LS.total})}</p>`,[
    [_t('pause.resume'),()=>{LS.paused=false;checkSoon()},'primary'],
    [_t('menu.shop'),()=>{openShop(()=>{LS.paused=false;checkSoon()});return'keep'}],
    [_t('pause.restart'),()=>startLevel()],
    [soundBtn(),()=>{save.sound=!save.sound;persist();$('#mActions').children[3].textContent=soundBtn();return'keep'}],
    [_t('toMenu'),()=>showMenu()]])}
function stuck(){LS.paused=true;sfx.fail();const acts=[];const resume=()=>{LS.paused=false};
  const label=id=>_t('stuck.buy',{name:TOOLS[id].name,price:COIN+toolPrice(id)});
  if(canUse('drill')&&affordable('drill'))acts.push([label('drill'),()=>{resume();useTool('drill')},'primary']);
  if(canUse('chest')&&affordable('chest'))acts.push([label('chest'),()=>{resume();useTool('chest')},acts.length?'':'primary']);
  acts.push([_t('stuck.retry'),()=>loseLife(),acts.length?'':'primary']);
  modal(_t('stuck.title'),`<p>${_t('stuck.body')}${acts.length>1?_t('stuck.toolHint'):''}</p>`,acts)}
function loseLife(){G.hearts--;if(G.hearts<=0)return gameOver();save.runs[key()]={level:G.level,score:G.score,hearts:G.hearts};persist();startLevel()}
// Stars per level, so a run is also something to perfect: 3 for a clean, quick clear, one less
// for using any tool, and one less for running out of time bonus. Coins only pay for new stars.
const starsOf=(m=G.mode,d=G.diff)=>save.stars[key(m,d)]||(save.stars[key(m,d)]={});
function levelComplete(){LS.done=true;const secs=(performance.now()-LS.start)/1000,m=LS.cfg.mult,slow=secs>LS.total*4;
  const base=LS.levelScore,time=Math.round(Math.max(0,LS.total*4-secs)*2*m),bonus=Math.round((150+G.level*20)*m);
  const stars=Math.max(1,Economy.helped(3,LS.helped)-(slow?1:0)),st=starsOf(),prev=st[G.level]||0,coins=ECO.levelPay(G.diff,stars,prev);
  if(stars>prev)st[G.level]=stars;
  LS.levelScore+=time+bonus;G.score=runScore();const done=G.level;G.level++;LS.levelScore=0;if(coins)addCoins(coins);
  const b=save.best[key()]||{score:0,level:0};b.score=Math.max(b.score,G.score);b.level=Math.max(b.level,done);save.best[key()]=b;
  save.runs[key()]={level:G.level,score:G.score,hearts:G.hearts};persist();sfx.win();renderScore();
  const mm=Math.floor(secs/60),ss=String(Math.floor(secs%60)).padStart(2,'0');
  const notes=[LS.helped&&_t('win.toolStar'),slow&&_t('win.slowStar'),prev>stars&&_t('win.prev',{n:prev}),!coins&&_t('win.noCoins')].filter(Boolean);
  const starRow=`<div class="wstars" role="img" aria-label="${_t('win.stars',{n:stars})}">${[0,1,2].map(i=>`<span class="${i<stars?'':'off'}">★</span>`).join('')}</div>`;
  setTimeout(()=>modal(_t('win.title',{n:done}),`${starRow}<div class="rows"><div><span>${_t('win.screws')}</span><span>${fmt(base)}</span></div><div><span>${_t('win.time',{t:mm+':'+ss})}</span><span>+${fmt(time)}</span></div><div><span>${_t('win.level')}</span><span>+${fmt(bonus)}</span></div><div class="tot"><span>${_t('win.total')}</span><span>${fmt(G.score)}</span></div><div class="gold"><span>${_t('win.coins')}</span><span>${COIN} +${coins}</span></div></div>${notes.length?`<p class="wnote">${notes.join(' ')}</p>`:''}`,
    [[_t('win.next'),()=>startLevel(),'primary'],[_t('menu.shop'),()=>{openShop(()=>startLevel());return'keep'}],[_t('toMenu'),()=>showMenu()]]),reduceMotion?50:650)}
function gameOver(){const b=save.best[key()]||{score:0,level:0};const reached=G.level-1;const isBest=G.score>0&&G.score>=b.score;b.score=Math.max(b.score,G.score);b.level=Math.max(b.level,reached);save.best[key()]=b;
  delete save.runs[key()];persist();
  modal(_t('over.title'),`<p>${_t('over.body',{level:G.level,score:fmt(G.score)})}</p>${isBest?`<span class="newbest">${_t('over.newBest')}</span>`:`<p style="margin-top:6px">${_t('over.best',{n:fmt(b.score)})}</p>`}`,
    [[_t('menu.newRun'),()=>{newRun();startLevel()},'primary'],[_t('toMenu'),()=>showMenu()]])}

/* --- menu --- */
function newRun(){Object.assign(G,{mode:save.sel.mode,diff:save.sel.diff,level:1,score:0,hearts:3})}
function renderMenu(){const sel=save.sel;
  document.querySelectorAll('#modeSeg .opt').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===sel.mode)));
  $('#diffs').innerHTML=DIFFS.map(id=>{const c=cfgFor(id,1);
    return`<button class="opt" data-diff="${id}" aria-pressed="${id===sel.diff}"><span><span class="t">${_t('diff.'+id)}</span><br><span class="d">${_t('menu.diffInfo',{k:c.K,b:c.B,c:c.C,cmax:c.Cmax})}</span></span>
      <span class="pips" aria-hidden="true"><span>${'<i></i>'.repeat(c.K)}</span><span class="hole">${'<i></i>'.repeat(c.B)}</span></span></button>`}).join('');
  document.querySelectorAll('#diffs .opt').forEach(b=>b.onclick=()=>{save.sel.diff=b.dataset.diff;persist();renderMenu()});
  const b=save.best[key(sel.mode,sel.diff)];$('#stBest').textContent=b?fmt(b.score):'—';const sv=Object.values(save.stars[key(sel.mode,sel.diff)]||{});$('#stStars').textContent=sv.length?`${sv.reduce((a,x)=>a+x,0)}/${sv.length*3}`:'—';$('#stLvl').textContent=b&&b.level?b.level:'—';renderCoins();
  const r=save.runs[key(sel.mode,sel.diff)],cb=$('#contBtn');cb.hidden=!r;
  if(r)cb.innerHTML=`${_t('menu.continue',{n:r.level})} <span aria-label="${_t('lives',{n:r.hearts})}">${'♥'.repeat(r.hearts)}</span>`;
  $('#newBtn').className='btn'+(r?'':' primary')}
document.querySelectorAll('#modeSeg .opt').forEach(b=>b.onclick=()=>{if(save.sel.mode===b.dataset.mode)return;save.sel.mode=b.dataset.mode;persist();renderMenu();buildDemo()});
$('#contBtn').onclick=()=>{ensureAudio();const r=save.runs[key(save.sel.mode,save.sel.diff)];if(!r)return;Object.assign(G,{mode:save.sel.mode,diff:save.sel.diff,level:r.level,score:r.score,hearts:r.hearts});startLevel()};
$('#newBtn').onclick=()=>{ensureAudio();newRun();startLevel()};
$('#shopBtn').onclick=()=>{ensureAudio();openShop(()=>renderMenu())};
function buildDemo(){const m=save.sel.mode;const lv=buildLevel(m,'normal',m==='2d'?6:1,cfgFor('normal',3),'demo');setCurrent(lv);spawnScrews(lv);orbit.auto=m==='3d'&&!reduceMotion;requestAnimationFrame(()=>fitCamera(true))}
function showMenu(){state='menu';LS=null;closeModal();$('#hud').hidden=true;$('#tools').hidden=true;$('#viewBtn').hidden=true;$('#menu').hidden=false;$('#loading').hidden=true;$('#fx').innerHTML='';renderMenu();buildDemo()}

/* --- loop --- */
let last=performance.now();
function frame(now){const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(orbit.auto)orbit.az+=dt*0.22;
  if(orbit.tw){let da=orbit.tw.az-orbit.az;da=Math.atan2(Math.sin(da),Math.cos(da));orbit.az+=da*Math.min(1,dt*6);orbit.pol+=(orbit.tw.pol-orbit.pol)*Math.min(1,dt*6);if(Math.abs(da)<0.002&&Math.abs(orbit.tw.pol-orbit.pol)<0.002)orbit.tw=null}
  if(camera===persp)applyOrbit();
  if(anims.length)anims=anims.filter(a=>a(dt)!==false);
  renderer.render(scene,camera);requestAnimationFrame(frame)}
showMenu();requestAnimationFrame(frame);

// <debug>
// Development builds only: ?models opens the model inspector. scripts/build.mjs removes this block and dev/ from release builds.
if(/[?&]models\b/.test(location.search)){const s=document.createElement('script');s.src='dev/inspector.js';document.body.appendChild(s)}
// </debug>
