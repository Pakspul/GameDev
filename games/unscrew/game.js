/*GEN-START*/
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const Q=()=>new THREE.Quaternion();
const eul=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));
const UPV=V(0,1,0);
const PT=0.16; // plank thickness
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=hashStr(String(seed));const f=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  return{f:(lo=0,hi=1)=>lo+(hi-lo)*f(),i:(lo,hi)=>lo+Math.floor(f()*(hi-lo+1)),pick:a=>a[Math.floor(f()*a.length)],chance:p=>f()<p,
    shuffle:arr=>{for(let i=arr.length-1;i>0;i--){const j=Math.floor(f()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}}}
const srgb=hex=>new THREE.Color(hex).convertSRGBToLinear();
function shade(hex,k){const c=new THREE.Color(hex);const h={};c.getHSL(h);c.setHSL(h.h,h.s,Math.max(0,Math.min(1,h.l*k)));return '#'+c.getHexString()}

const SCREW_COLORS=[
  {hex:'#ff3d9a',id:'pink'},{hex:'#7b4dff',id:'purple'},{hex:'#8fd61f',id:'lime'},{hex:'#ffcc1a',id:'yellow'},
  {hex:'#1f7bff',id:'blue'},{hex:'#14c8e6',id:'cyan'},{hex:'#ff7a12',id:'orange'},{hex:'#e8283a',id:'red'},{hex:'#f3f5f9',id:'white'}];
const PALS=[
  {main:'#7cc68d',dark:'#4f9e64',light:'#b8e3b5',trim:'#3d7f50',accent:'#f2e8d4'},
  {main:'#f2b880',dark:'#d48a52',light:'#f8dcbc',trim:'#a7643a',accent:'#fff3e2'},
  {main:'#9fb8e8',dark:'#6e8fcf',light:'#cddbf5',trim:'#4d6aa8',accent:'#f4f7ff'},
  {main:'#e8a3b7',dark:'#c97790',light:'#f5cfda',trim:'#9e5068',accent:'#fff0f4'},
  {main:'#e6d17a',dark:'#c4ab4c',light:'#f3e7b3',trim:'#8e7a2e',accent:'#fffbe8'},
  {main:'#a6d8d4',dark:'#6fb5af',light:'#d3efec',trim:'#3f8a84',accent:'#f2fffd'}];
const WOOD=['#e2c08f','#d6b07c','#e8c99d'];
const STONE=['#c9ccd3','#b7bcc6','#d6d8de'];
const GLASS=['#ff9db8','#ffcf70','#8fd3ff','#b8a4ff','#8ee3b0','#ffb37a','#9fe6e0','#f5a3e0'];

function cfgFor(diff,level){
  const D={easy:{K:3,B:5,C0:4,Cmax:6,minPer:1,maxPer:2,swapF:.6,win:6,margin:2,mult:1,cap:80,cx0:.1,hidPref:.25},
    normal:{K:3,B:5,C0:5,Cmax:8,minPer:1,maxPer:3,swapF:1.4,win:10,margin:1,mult:1.5,cap:140,cx0:.45,hidPref:.55},
    hard:{K:3,B:4,C0:7,Cmax:9,minPer:2,maxPer:3,swapF:2.5,win:14,margin:1,mult:2,cap:190,cx0:.85,hidPref:.85},
    expert:{K:2,B:5,C0:8,Cmax:9,minPer:2,maxPer:4,swapF:3,win:16,margin:1,mult:3,cap:240,cx0:1.15,hidPref:1}}[diff];
  return{...D,C:Math.min(D.Cmax,D.C0+Math.floor((level-1)/3)),cx:Math.min(1.6,D.cx0+(level-1)/12)};
}

/* ----- builder ----- */
const FACES={
  '+x':{n:[1,0,0],u:[0,0,-1],v:[0,1,0],L:['d','h'],half:'w'},'-x':{n:[-1,0,0],u:[0,0,1],v:[0,1,0],L:['d','h'],half:'w'},
  '+y':{n:[0,1,0],u:[1,0,0],v:[0,0,-1],L:['w','d'],half:'h'},'-y':{n:[0,-1,0],u:[1,0,0],v:[0,0,1],L:['w','d'],half:'h'},
  '+z':{n:[0,0,1],u:[1,0,0],v:[0,1,0],L:['w','h'],half:'d'},'-z':{n:[0,0,-1],u:[-1,0,0],v:[0,1,0],L:['w','h'],half:'d'}};
let BLD=null;
const PROXY_MAT=new THREE.MeshBasicMaterial({visible:false});PROXY_MAT.userData.shared=true;
function partMat(hex,o={}){const m=new THREE.MeshStandardMaterial({roughness:.7,metalness:0,...o});m.color.copy(srgb(hex));return m}
function roundRectShape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.max(0.001,Math.min(r,w/2-0.0005,h/2-0.0005));
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.absarc(x+w-r,y+r,r,-Math.PI/2,0,false);s.lineTo(x+w,y+h-r);s.absarc(x+w-r,y+h-r,r,0,Math.PI/2,false);
  s.lineTo(x+r,y+h);s.absarc(x+r,y+h-r,r,Math.PI/2,Math.PI,false);s.lineTo(x,y+r);s.absarc(x+r,y+r,r,Math.PI,1.5*Math.PI,false);return s}
function roundPolyShape(vs,r){const s=new THREE.Shape(),n=vs.length;const P=i=>vs[(i+n)%n];
  const toward=(a,b,d)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);return[a[0]+dx/L*d,a[1]+dy/L*d]};
  const o0=toward(P(0),P(1),r);s.moveTo(o0[0],o0[1]);
  for(let i=1;i<=n;i++){const v=P(i),a=toward(v,P(i-1),r),b=toward(v,P(i+1),r);s.lineTo(a[0],a[1]);s.quadraticCurveTo(v[0],v[1],b[0],b[1])}return s}
function roundedBoxGeo(w,h,d,r){r=Math.min(r,w*0.3,h*0.3,d*0.3);const iw=w-2*r,ih=h-2*r;
  const g=new THREE.ExtrudeGeometry(roundRectShape(iw,ih,Math.min(r,iw/2*0.9,ih/2*0.9)),{depth:Math.max(0.001,d-2*r),bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2,curveSegments:3});
  g.translate(0,0,-(d-2*r)/2);return g}
function addPart(geo,color,pos,quat,o={}){
  const mesh=new THREE.Mesh(geo,partMat(color,o.mat||{}));mesh.position.copy(pos);mesh.quaternion.copy(quat||Q());
  mesh.castShadow=true;mesh.receiveShadow=true;BLD.group.add(mesh);
  const pr=new THREE.Mesh(o.proxy||geo,PROXY_MAT);pr.visible=false;mesh.add(pr);mesh.updateMatrixWorld(true);
  const p={id:BLD.parts.length,mesh,ray:pr,static:!!o.static,slots:[],screws:[],color,dead:false,alive:true,left:0};
  mesh.userData.part=p;pr.userData.part=p;BLD.parts.push(p);return p}
function addSlot(p,lp,ln,force=false){p.slots.push({p:lp.clone(),n:ln.clone().normalize(),force})}
function anchorWorld(host,wp,wn){host.mesh.updateMatrixWorld(true);addSlot(host,host.mesh.worldToLocal(wp.clone()),wn.clone().applyQuaternion(host.mesh.quaternion.clone().invert()),true)}
function decor(p,m){m.castShadow=true;m.receiveShadow=true;p.mesh.add(m);return m}
function faceFrame(p,f){const F=FACES[f];return{n:V(...F.n),u:V(...F.u),v:V(...F.v),Lu:p.box[F.L[0]],Lv:p.box[F.L[1]],half:p.box[F.half]/2}}
function faceSlot(p,f,a,b,force=false){const fr=faceFrame(p,f);addSlot(p,fr.n.clone().multiplyScalar(fr.half).addScaledVector(fr.u,a).addScaledVector(fr.v,b),fr.n,force)}
function axisOffs(L){if(L>=2.4){const e=L/2-0.4;return[-e,0,e]}if(L>=1.0){const e=L/2-0.33;return[-e,e]}return[0]}
function gridSlots(p,f){const fr=faceFrame(p,f);for(const a of axisOffs(fr.Lu))for(const b of axisOffs(fr.Lv))faceSlot(p,f,a,b)}
function box(w,h,d,color,pos,quat,o={}){
  const p=addPart(roundedBoxGeo(w,h,d,o.r??Math.min(0.06,Math.min(w,h,d)*0.3)),color,pos,quat,{...o,proxy:new THREE.BoxGeometry(w,h,d)});p.box={w,h,d};
  if(!o.static){(o.faces??['+x','-x','+y','+z','-z']).forEach(f=>gridSlots(p,f))}return p}
// a box lying on face f of host; gap 0 = flush (a hidden anchor screw under it), gap>0 = resting on cladding
function onFace(host,f,a,b,cw,ch,cd,color,o={}){
  const fr=faceFrame(host,f),gap=o.gap||0;
  const lp=fr.n.clone().multiplyScalar(fr.half+gap+cd/2).addScaledVector(fr.u,a).addScaledVector(fr.v,b);
  const ax=f[1],dims=ax==='z'?[cw,ch,cd]:ax==='x'?[cd,ch,cw]:[cw,cd,ch];
  const child=box(dims[0],dims[1],dims[2],color,host.mesh.localToWorld(lp),host.mesh.quaternion.clone(),{faces:[f],...o});
  if(!o.noAnchor&&!(gap>0))faceSlot(host,f,a,b,true);return child}
function cyl(r,h,color,pos,quat,o={}){
  const p=addPart(new THREE.CylinderGeometry(r,r,h,o.seg||32),color,pos,quat,{...o,proxy:new THREE.CylinderGeometry(r,r,h,16)});p.cyl={r,h};
  if(!o.static){
    if(o.top!==false){if(r<0.62)addSlot(p,V(0,h/2,0),UPV);else for(let k=0;k<3;k++){const a=k/3*Math.PI*2+0.5;addSlot(p,V(Math.cos(a)*r*0.55,h/2,Math.sin(a)*r*0.55),UPV)}}
    if(o.side!==false&&r>=0.3){const n=o.sideN??Math.max(3,Math.min(8,Math.round(2*Math.PI*r/1.05)));const rows=h>1.8?[-h/4,h/4]:[0];
      rows.forEach(y=>{for(let k=0;k<n;k++){const a=k/n*Math.PI*2+(o.phase||0);addSlot(p,V(Math.cos(a)*r,y,Math.sin(a)*r),V(Math.cos(a),0,Math.sin(a)))}})}}
  return p}
function cone(r,h,color,pos,quat,o={}){
  const p=addPart(new THREE.ConeGeometry(r,h,32),color,pos,quat,{...o,proxy:new THREE.ConeGeometry(r,h,16)});
  const f=0.28,y=-h/2+h*f,rr=r*(1-f),n=o.n||4;for(let k=0;k<n;k++){const a=k/n*Math.PI*2+0.4;addSlot(p,V(Math.cos(a)*rr,y,Math.sin(a)*rr),V(Math.cos(a)*h,r,Math.sin(a)*h))}return p}
function polySlots(p,k,R,minY=-0.2){const pos=p.mesh.geometry.attributes.position,cand=[],a=V(),b=V(),c=V();
  for(let i=0;i+2<pos.count;i+=3){a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,i+1);c.fromBufferAttribute(pos,i+2);
    const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(n.y<minY)continue;cand.push({p:a.clone().add(b).add(c).divideScalar(3),n})}
  R.shuffle(cand);const out=[];for(const s of cand){if(out.length>=k)break;if(out.some(o=>o.p.distanceTo(s.p)<0.6))continue;out.push(s);addSlot(p,s.p,s.n)}}
function blob(r,color,pos,R,k=5){const p=addPart(new THREE.IcosahedronGeometry(r,1),color,pos,Q(),{mat:{flatShading:true}});polySlots(p,k,R);return p}

/* ----- cladding helpers ----- */
function plankFace(host,f,o={}){
  const fr=faceFrame(host,f),dir=o.dir||'h',L=(dir==='h'?fr.Lu:fr.Lv)+(o.ext||0),span=dir==='h'?fr.Lv:fr.Lu;
  const n=Math.max(1,Math.round(span/(o.w||0.44))),pw=span/n,t=o.t||PT,cols=o.cols||[o.color,shade(o.color,0.92)],out=[];
  for(let i=0;i<n;i++){const off=-span/2+pw*(i+0.5);
    out.push(onFace(host,f,dir==='h'?0:off,dir==='h'?off:0,dir==='h'?L:pw-0.035,dir==='h'?pw-0.035:L,t,cols[i%cols.length],{noAnchor:true,gap:o.gap||0,r:0.035,faces:[f]}));
    if(!o.gap&&pw>0.33)for(const a of axisOffs(L-(o.ext||0)))faceSlot(host,f,dir==='h'?a:off,dir==='h'?off:a)}
  return out}
function cladBox(core,faces,o={}){
  faces.forEach(f=>plankFace(core,f,{...o,dir:(o.dirs&&o.dirs[f])||o.dir||'h'}));
  if(o.posts===false)return;const{w,h,d}=core.box,t=o.t||PT;
  for(const[f1,f2,sx,sz]of[['+z','+x',1,1],['+x','-z',1,-1],['-z','-x',-1,-1],['-x','+z',-1,1]])
    if(faces.includes(f1)&&faces.includes(f2))box(0.3,h,0.3,o.postColor||shade(o.color||o.cols[0],0.8),core.mesh.localToWorld(V(sx*(w/2+t/2),0,sz*(d/2+t/2))),core.mesh.quaternion.clone(),{faces:[f1,f2],r:0.04})}
function cladCyl(core,n,o={}){
  const{r,h}=core.cyl,t=o.t||PT,w=2*r*Math.tan(Math.PI/n)+t*0.5,ph=o.phase||0,cols=o.cols||[o.color],out=[];
  for(let k=0;k<n;k++){const a=ph+k/n*Math.PI*2,lp=V(Math.cos(a)*(r+t/2),0,Math.sin(a)*(r+t/2));
    out.push(box(w,h,t,cols[k%cols.length],core.mesh.localToWorld(lp),core.mesh.quaternion.clone().multiply(eul(0,Math.PI/2-a,0)),{faces:['+z'],r:0.03}))}
  return out}
function win(host,f,a,b,w,h,gap,pal,o={}){
  const fr=onFace(host,f,a,b,w,h,0.14,o.frame||pal.accent,{gap,faces:[]});
  faceSlot(fr,f,-(w/2-0.2),h/2-0.2);faceSlot(fr,f,w/2-0.2,-(h/2-0.2));
  const F=faceFrame(fr,f),ax=f[1],gw=Math.max(0.2,w-0.42),gh=Math.max(0.2,h-0.42);
  const dims=ax==='z'?[gw,gh,0.03]:ax==='x'?[0.03,gh,gw]:[gw,0.03,gh];
  const gl=new THREE.Mesh(new THREE.BoxGeometry(...dims),partMat('#8fcdee',{roughness:.12,metalness:.1}));gl.position.copy(F.n.clone().multiplyScalar(F.half+0.012));decor(fr,gl);
  if(o.shutters)for(const s of[-1,1])onFace(host,f,a+s*(w/2+0.23),b,0.4,h,0.14,o.shutters,{gap,noAnchor:true});
  if(o.flowers){const fb=onFace(host,f,a,b-h/2-0.18,w+0.1,0.32,0.36,o.flowers,{gap,noAnchor:true,faces:[f]}),u=V(...FACES[f].u);
    for(let i=0;i<4;i++){const fl=new THREE.Mesh(new THREE.SphereGeometry(0.11,10,8),partMat(['#ff5d8f','#ffd23f','#ff8a3d','#c77dff'][i]));fl.position.copy(u.clone().multiplyScalar((i-1.5)*w/4.2)).add(V(0,0.24,0));decor(fb,fl)}}
  return fr}
function deck(R,w,d){const n=Math.round(w/0.9),pw=w/n;for(let i=0;i<n;i++)box(pw-0.05,0.24,d-(i%2?0.24:0),WOOD[i%3],V(-w/2+pw*(i+0.5),0.12,i%2?0.12:0),Q(),{static:true,r:0.04});return 0.24}
function pad(R,r,col){const p=cyl(r,0.3,col,V(0,0.15,0),Q(),{static:true,seg:64});
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(r+0.14,r+0.22,0.14,64),partMat(shade(col,0.82)));ring.position.y=-0.08;decor(p,ring);return 0.3}
function fenceLine(A,B,y0,col,step=0.55){const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz);if(L<1.2)return;const th=Math.atan2(-dz,dx),q=eul(0,th,0);
  const dirv=V(dx/L,0,dz/L),nrm=V(0,0,1).applyQuaternion(q),mid=V((A[0]+B[0])/2,0,(A[1]+B[1])/2);
  for(const y of[0.3,0.78])box(L,0.3,0.14,shade(col,0.82),mid.clone().add(V(0,y0+y,0)),q,{faces:['+z']});
  const m=Math.floor((L-0.2)/step);for(let i=0;i<m;i++){const t=-(m-1)*step/2+i*step;box(0.34,1.0,0.14,col,mid.clone().addScaledVector(dirv,t).addScaledVector(nrm,0.14).add(V(0,y0+0.5,0)),q,{faces:['+z']})}}
function prismX(b,hA,L){const sh=new THREE.Shape();sh.moveTo(-b/2,0);sh.lineTo(b/2,0);sh.lineTo(0,hA);sh.lineTo(-b/2,0);
  const g=new THREE.ExtrudeGeometry(sh,{depth:L,bevelEnabled:false});g.translate(0,0,-L/2);g.rotateY(Math.PI/2);return g}
function props(R,cx,spots,y0){
  for(const[px,pz,sz]of spots){const kind=R.pick(['crate','barrel','tree','crate','bush']);
    if(kind==='crate'){const s=R.f(0.85,1.1),c=box(s,s,s,R.pick(WOOD),V(px,y0+s/2,pz),eul(0,R.f(-0.35,0.35),0),{faces:['+y','+x','-x','+z','-z']});
      if(cx>0.3)for(const v of[-s*0.22,s*0.22])onFace(c,sz>0?'+z':'-z',0,v,s*0.92,0.4,0.14,shade(WOOD[1],0.72),{noAnchor:true});
      if(cx>0.6)onFace(c,'+y',0,0,s*0.7,s*0.7,0.14,shade(WOOD[0],0.85))}
    else if(kind==='barrel'){const bb=cyl(0.44,1.0,'#c58a55',V(px,y0+0.5,pz),eul(0,R.f(0,6),0),{sideN:5});
      for(const yy of[-0.34,0.34]){const r=new THREE.Mesh(new THREE.CylinderGeometry(0.455,0.455,0.07,32,1,true),partMat('#6b5440',{metalness:.3,side:THREE.DoubleSide}));r.position.y=yy;decor(bb,r)}
      if(cx>0.5)cyl(0.36,0.14,'#a8744a',V(px,y0+1.07,pz),Q(),{side:false})}
    else if(kind==='tree'){cyl(0.3,1.7,'#8a5a3b',V(px,y0+0.85,pz),Q(),{sideN:3});blob(1.0,'#6cbf6a',V(px,y0+2.45,pz),R,6);if(cx>0.4)blob(0.66,'#86d07a',V(px+0.5,y0+3.15,pz-0.2),R,4)}
    else{blob(0.62,'#79c46f',V(px,y0+0.5,pz),R,4);if(cx>0.5)blob(0.45,'#9ad88a',V(px+0.55,y0+0.38,pz+0.2),R,3)}}}

/* ----- 3D generators ----- */
function genCottage(R,cfg){
  const pal=R.pick(PALS),rp=R.pick(PALS.filter(p=>p!==pal)),cx=cfg.cx;
  const W=R.f(3.6,4.4),D=R.f(3.0,3.6),H=R.f(2.3,2.7),dw=W+5.4,dd=D+5.2;
  const y0=deck(R,dw,dd);
  const core=box(W,H,D,pal.trim,V(0,y0+H/2,0),Q(),{faces:['+x','-x','+z','-z']});
  cladBox(core,['+z','-z','+x','-x'],{color:pal.main,w:cx>0.6?0.36:0.46,postColor:pal.accent});
  const ds=R.pick([-1,1]),dX=ds*W*0.2;
  const door=onFace(core,'+z',dX,-H/2+0.82,0.9,1.64,0.14,rp.dark,{gap:PT});
  const knob=new THREE.Mesh(new THREE.SphereGeometry(0.07,12,8),partMat('#f3cf5a',{metalness:.4,roughness:.3}));knob.position.set(-ds*0.28,0,0.1);decor(door,knob);
  if(cx>0.25)onFace(door,'+z',0,0.25,0.62,0.42,0.14,rp.main);
  onFace(core,'+z',dX,-H/2+1.64+0.14,1.25,0.28,0.14,pal.accent,{gap:PT});
  if(cx>0.3)onFace(core,'+z',dX,-H/2+2.08,1.6,0.16,0.7,rp.dark,{gap:PT,faces:['+y']});
  const wo={shutters:cx>0.45?rp.main:null,flowers:cx>0.3?shade(WOOD[1],0.8):null};
  win(core,'+z',-ds*W*0.24,H*0.1,1.0,1.0,PT,pal,wo);
  const nS=cx>0.55?2:1;
  for(const f of['-x','+x'])for(let i=0;i<nS;i++)win(core,f,nS===1?0:(i?1:-1)*D*0.22,H*0.1,0.9,0.9,PT,pal,{flowers:wo.flowers&&i===0?wo.flowers:null});
  if(cx>0.2)for(let i=0;i<(cx>0.8?2:1);i++)win(core,'-z',cx>0.8?(i?1:-1)*W*0.24:0,H*0.1,1.0,1.0,PT,pal,{shutters:wo.shutters});
  box(1.3,0.2,0.6,'#b9c0c9',V(dX,y0+0.1,D/2+PT+0.5),Q(),{faces:['+y']});
  // attic, gables and roof
  const a=R.f(0.52,0.62),ta=Math.tan(a),ca=Math.cos(a),sa=Math.sin(a);
  const b=D+2*PT,hA=(b/2)*ta,Lx=W+2*PT;
  const attic=addPart(prismX(b,hA,Lx),pal.light,V(0,y0+H,0),Q());
  for(const sx of[-1,1])addSlot(attic,V(sx*Lx/2,hA*0.32,0),V(sx,0,0));
  for(const sz of[-1,1])for(const xx of[-Lx/4,Lx/4])addSlot(attic,V(xx,hA/2,sz*b/4),V(0,b/2,sz*hA));
  for(const sx of[-1,1]){const g=addPart(prismX(b-0.08,hA-0.05,PT),pal.main,V(sx*(Lx/2+PT/2),y0+H,0),Q());
    for(const zz of[-b*0.22,b*0.22])addSlot(g,V(sx*PT/2,hA*0.2,zz),V(sx,0,0));
    const rw=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.04,24),partMat('#8fcdee',{roughness:.15}));rw.rotation.z=Math.PI/2;rw.position.set(sx*(PT/2+0.01),hA*0.5,0);decor(g,rw)}
  const e=b/2+0.45,t=0.2,Ls=e/ca+0.04,RW=Lx+2*PT+0.7,slabs=[];
  for(const sz of[1,-1]){const yb=y0+H+(b/2-e/2)*ta;
    slabs.push(box(RW,t,Ls,rp.dark,V(0,yb+t/2*ca,sz*(e/2+t/2*sa)),eul(sz*a,0,0),{faces:['+y']}))}
  slabs.forEach(sl=>plankFace(sl,'+y',{dir:'h',w:cx>0.6?0.36:0.46,cols:[rp.main,shade(rp.main,0.9)]}));
  box(RW+0.12,0.26,0.55,rp.trim,V(0,y0+H+hA+(t+PT)/ca+0.05,0),Q(),{faces:['+y']});
  if(cx>0.1){const zc=-e*0.5,xc=R.pick([-1,1])*R.f(0.6,W/2-0.6),ys=y0+H+(b/2-Math.abs(zc))*ta+(t+PT)/ca;
    const cc=box(0.6,1.45,0.6,'#a65a46',V(xc,ys+0.3,zc),Q(),{faces:['+x','-x','+z','-z']});let cw=0.74;
    if(cx>0.35){cladBox(cc,['+x','-x','+z','-z'],{w:0.25,cols:['#c9765e','#b8644d'],posts:false});cw=0.6+2*PT+0.14}
    onFace(cc,'+y',0,0,cw,cw,0.16,'#5b4a44')}
  if(cx>0.2){fenceLine([-dw/2+0.4,dd/2-0.3],[dX-0.9,dd/2-0.3],y0,WOOD[2]);fenceLine([dX+0.9,dd/2-0.3],[dw/2-0.4,dd/2-0.3],y0,WOOD[2])}
  if(cx>0.75){fenceLine([dw/2-0.3,dd/2-0.6],[dw/2-0.3,-dd/2+0.6],y0,WOOD[2]);fenceLine([-dw/2+0.3,-dd/2+0.6],[-dw/2+0.3,dd/2-0.6],y0,WOOD[2])}
  if(cx>1.1)fenceLine([dw/2-0.4,-dd/2+0.3],[-dw/2+0.4,-dd/2+0.3],y0,WOOD[2]);
  const spots=R.shuffle([[W/2+1.35,D/2+1.25,1],[-W/2-1.35,D/2+1.25,1],[W/2+1.35,-D/2-1.25,-1],[-W/2-1.35,-D/2-1.25,-1]]);
  props(R,cx,spots.slice(0,Math.min(4,2+Math.round(cx*1.5))),y0);
}
function genRoom(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal));
  const F=R.f(5.4,6.2),wt=0.3,Hw=R.f(2.8,3.1);
  box(F+0.6,0.3,F+0.6,'#8a6f55',V(0,0.15,0),Q(),{static:true,r:0.05});const y0=0.3;
  const floor=box(F,0.3,F,'#9b7655',V(0,y0+0.15,0),Q(),{faces:['+y']});
  plankFace(floor,'+y',{dir:'h',w:cx>0.6?0.42:0.55,cols:['#e2b984','#d4a873','#e8c393']});
  const y1=y0+0.3+PT,zi=-F/2+wt+PT,xi=-F/2+wt+PT;
  const back=box(F,Hw,wt,'#cfc6b8',V(0,y1+Hw/2,-F/2+wt/2),Q(),{faces:['+z','-z']});
  const lz0=-F/2+wt+PT,lLen=F/2-lz0,left=box(wt,Hw,lLen,'#cfc6b8',V(-F/2+wt/2,y1+Hw/2,lz0+lLen/2),Q(),{faces:['+x','-x']});
  const wp=[pal.light,shade(pal.light,0.93)];
  plankFace(back,'+z',{dir:'v',w:0.55,cols:wp});plankFace(left,'+x',{dir:'v',w:0.55,cols:wp});
  plankFace(back,'-z',{dir:'h',w:0.48,cols:[pal.main,shade(pal.main,0.9)]});plankFace(left,'-x',{dir:'h',w:0.48,cols:[pal.main,shade(pal.main,0.9)]});
  box(PT,Hw,wt+2*PT,pal.trim,V(-F/2-PT/2,y1+Hw/2,-F/2+wt/2),Q(),{faces:['-x','-z']});
  onFace(back,'+y',0,0,F,wt+2*PT,0.14,pal.trim);onFace(left,'+y',0,0,wt+2*PT,lLen,0.14,pal.trim);
  // bed
  const bx=F/2-1.15,bed=box(1.9,0.45,2.6,acc.dark,V(bx,y1+0.225,zi+1.5),Q(),{faces:['+x','-x','+z']});
  box(1.95,1.25,0.2,acc.trim,V(bx,y1+0.625,zi+0.1),Q(),{faces:['+z','+y']});
  const mat=onFace(bed,'+y',0,0,1.75,2.45,0.3,'#f6f3ee');
  onFace(mat,'+y',0,-0.3,1.85,1.7,0.14,acc.main);onFace(mat,'+y',0,0.85,1.2,0.5,0.22,'#ffffff');
  if(cx>0.45)onFace(mat,'+y',0,-0.65,1.0,0.6,0.14,acc.light,{gap:0.14});
  // window and curtains over the bed
  win(back,'+z',bx,0.35,1.3,1.0,PT,pal,{frame:'#ffffff'});
  if(cx>0.3)for(const s of[-1,1])onFace(back,'+z',bx+s*0.88,0.4,0.4,1.45,0.14,acc.light,{gap:PT});
  // wardrobe
  if(cx>0.2){const wd=box(1.3,2.2,0.7,WOOD[1],V(xi+0.7,y1+1.1,zi+0.35),Q(),{faces:['+x','+y']});
    for(const s of[-1,1]){const dr=onFace(wd,'+z',s*0.32,0,0.62,2.1,0.14,WOOD[0]);const hd=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.3,0.05),partMat('#5b4a44'));hd.position.set(-s*0.22,0,0.1);decor(dr,hd)}
    onFace(wd,'+y',0,0,1.4,0.8,0.14,shade(WOOD[1],0.8))}
  if(cx>0.6)onFace(back,'+z',(xi+1.4+bx-1)/2,0.55,0.8,0.6,0.14,'#5b4a44',{gap:PT});
  // shelves with books
  const shelf=(yy,zc,len,maxH)=>{box(0.45,0.16,len,WOOD[0],V(xi+0.225,y1+yy,zc),Q(),{faces:['+y']});let z=zc-len/2+0.08;const top=y1+yy+0.08;
    while(z<zc+len/2-0.4){const bw=R.f(0.3,0.4),bh=R.f(0.42,maxH);box(0.36,bh,bw,R.pick(['#e05d5d','#4f8bd6','#f2b84b','#6bbf8e','#9b6fd6','#ef8f5e']),V(xi+0.2,top+bh/2,z+bw/2),Q(),{faces:['+x','+y']});z+=bw+0.04}};
  shelf(1.6,-0.5,1.8,0.62);if(cx>0.5)shelf(2.3,-0.5,1.8,0.45);
  // desk, drawers, chair
  const dz=Math.min(1.7,F/2-0.95);
  const desk=box(0.85,0.12,1.8,WOOD[2],V(xi+0.425,y1+0.86,dz),Q(),{faces:['+y']});
  for(const[lx,lz]of[[-0.35,-0.8],[0.35,-0.8],[-0.35,0.8],[0.35,0.8]]){const lg=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.8,0.08),partMat(shade(WOOD[2],0.75)));lg.position.set(lx,-0.46,lz);decor(desk,lg)}
  if(cx>0.35){const un=box(0.7,0.74,0.6,WOOD[1],V(xi+0.36,y1+0.37,dz+0.55),Q(),{faces:['+z']});for(const v of[-0.18,0.18])onFace(un,'+x',0,v,0.5,0.3,0.14,WOOD[0])}
  box(0.5,0.2,0.4,acc.main,V(xi+0.35,y1+1.02,dz-0.4),eul(0,0.3,0),{faces:['+y']});
  const seat=box(0.6,0.12,0.6,acc.main,V(xi+1.3,y1+0.5,dz),Q(),{faces:['+y']});
  for(const[lx,lz]of[[-0.25,-0.25],[0.25,-0.25],[-0.25,0.25],[0.25,0.25]]){const lg=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.44,0.06),partMat('#5b4a44'));lg.position.set(lx,-0.28,lz);decor(seat,lg)}
  box(0.14,0.75,0.6,acc.dark,V(xi+1.63,y1+0.95,dz),Q(),{faces:['+x','-x']});
  // rug and toys
  const rug=box(2.4,0.14,1.8,acc.light,V(0.5,y1+0.07,0.9),Q(),{faces:['+y']});
  for(const v of[-0.5,0.5]){const st=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.02,0.18),partMat(acc.main));st.position.set(0,0.075,v);decor(rug,st)}
  if(cx>0.15){const n=1+Math.round(cx*2);for(let i=0;i<n;i++){const s=0.42;box(s,s,s,R.pick(['#ff9f43','#54a0ff','#ff6b6b','#1dd1a1']),V(0.5+R.f(-0.9,0.9),y1+0.14+s/2,0.9+R.f(-0.6,0.6)),eul(0,R.f(0,1.5),0),{faces:['+y','+x','-x','+z','-z']})}}
  if(cx>0.4)blob(0.34,'#ff7a12',V(1.3,y1+0.14+0.32,0.3),R,3);
  // plant and lamp
  const pz=Math.min(zi+3.3,F/2-0.4);cyl(0.3,0.5,'#c96f4a',V(F/2-0.45,y1+0.25,pz),Q(),{sideN:3});blob(0.5,'#5fb760',V(F/2-0.45,y1+0.85,pz),R,4);
  if(cx>0.5){const sh=cone(0.45,0.5,'#fff1c9',V(F/2-0.5,y1+1.65,F/2-0.5),Q());const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1.4,8),partMat('#5b6270'));pole.position.y=-0.8;decor(sh,pole);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.28,0.06,20),partMat('#5b6270'));base.position.y=-1.47;decor(sh,base)}
  if(cx>0.8){const ck=cyl(0.36,0.14,'#ffffff',V(-F/2+wt+PT+0.07,y1+2.0,1.0),eul(0,0,-Math.PI/2),{side:false});const hand=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.03,0.22),partMat('#17212e'));hand.position.set(0,0.08,0.08);decor(ck,hand)}
}
function genMill(R,cfg){
  const cx=cfg.cx,y0=pad(R,4.0,'#bfe0a0'),ph=Math.PI/2;
  const r0=1.55,h0=1.7,base=cyl(r0,h0,'#7a4636',V(0,y0+h0/2,0),Q(),{sideN:8,phase:ph,top:false});
  const bp=cladCyl(base,8,{cols:['#a65a46','#b8644d'],phase:ph});
  onFace(bp[0],'+z',0,-h0/2+0.62,0.62,1.2,0.14,'#5b3f2e');
  for(const k of[2,6])win(bp[k],'+z',0,0.2,0.62,0.62,0,{accent:'#f4efe6'});
  const dTop=y0+h0+0.18,gR=r0+PT+0.95;
  const disc=cyl(gR,0.18,WOOD[1],V(0,y0+h0+0.09,0),Q(),{top:false,side:false});
  for(let k=0;k<8;k++){const a=ph+(k+0.5)/8*Math.PI*2;addSlot(disc,V(Math.cos(a)*(r0+PT+0.45),0.09,Math.sin(a)*(r0+PT+0.45)),UPV)}
  if(cx>0.25){const pr=gR-0.12;for(let k=0;k<8;k++){const a=ph+k/8*Math.PI*2;box(0.3,0.75,0.3,'#6b4a35',V(Math.cos(a)*pr,dTop+0.375,Math.sin(a)*pr),eul(0,Math.PI/2-a,0),{faces:['+z']})}
    for(let k=0;k<8;k++){const am=ph+(k+0.5)/8*Math.PI*2,rr=pr*Math.cos(Math.PI/8),len=2*pr*Math.sin(Math.PI/8)+0.3;
      box(len,0.16,0.3,'#8a5a3b',V(Math.cos(am)*rr,dTop+0.83,Math.sin(am)*rr),eul(0,-am-Math.PI/2,0),{faces:['+y']})}}
  const r1=1.2,h1=R.f(2.2,2.6),t1=cyl(r1,h1,'#4d5a3f',V(0,dTop+h1/2,0),Q(),{sideN:8,phase:ph,top:false});
  const tp1=cladCyl(t1,8,{cols:['#6f7d55','#7d8b60'],phase:ph});
  win(tp1[0],'+z',0,0.3,0.6,0.6,0,{accent:'#f4efe6'});if(cx>0.5)win(tp1[4],'+z',0,0.3,0.6,0.6,0,{accent:'#f4efe6'});
  let topY=dTop+h1,rTop=r1;
  if(cx>0.35){const r2=0.95,h2=1.3,t2=cyl(r2,h2,'#4d5a3f',V(0,topY+h2/2,0),Q(),{sideN:8,phase:ph,top:false});cladCyl(t2,8,{cols:['#7d8b60','#6f7d55'],phase:ph});topY+=h2;rTop=r2}
  const capH=1.5;const cap=cone(rTop+PT+0.3,capH,'#3f4a3a',V(0,topY+capH/2,0),Q(),{n:6});
  const knob=new THREE.Mesh(new THREE.SphereGeometry(0.16,12,10),partMat('#f2d16b'));knob.position.y=capH/2;decor(cap,knob);
  const ay=topY+0.55;cyl(0.24,1.5,'#6b5440',V(0,ay,1.25),new THREE.Quaternion().setFromUnitVectors(UPV,V(0,0,1)),{side:false});
  box(0.72,0.72,0.5,'#5b3f2e',V(0,ay,2.25),Q(),{faces:['+z']});
  const O=V(0,ay,2.5),ns=cx>0.4?4:3;
  for(let k=0;k<4;k++){const q=eul(0,0,Math.PI/4+k*Math.PI/2),P=(x,y,z)=>O.clone().add(V(x,y,z).applyQuaternion(q));
    box(1.0,2.6,0.1,'#f4efe6',P(0.68,2.05,0.05),q,{faces:['+z','-z']});
    box(0.32,3.5,0.2,'#8a5a3b',P(0,2.0,0.1),q,{faces:['+z','-z']});
    for(let i=0;i<ns;i++)box(1.36,0.38,0.14,'#6b4a35',P(0.52,1.0+i*(2.4/(ns-1)),0.27),q,{faces:['+z']})}
  const tul=['#ff4d6d','#ffd23f','#ff8a3d','#ffffff','#c77dff'];
  for(let k=0;k<26;k++){const a=k/26*Math.PI*2,rr=R.f(3.1,3.7),fl=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.22,8),partMat(tul[k%tul.length]));fl.rotation.x=Math.PI;fl.position.set(Math.cos(a)*rr,0.32,Math.sin(a)*rr);decor(BLD.parts[0],fl)}
}
function genCastle(R,cfg){
  const cx=cfg.cx,Ls=R.f(5.2,5.9),y0=0.3;
  box(Ls+3.2,0.3,Ls+3.2,'#a8c98d',V(0,0.15,0),Q(),{static:true,r:0.06});
  const st=[STONE[0],STONE[1]],pw=cx>0.6?0.36:0.5;
  const Ht=R.f(3.0,3.4);
  for(const[sx,sz]of[[1,1],[-1,1],[1,-1],[-1,-1]]){
    const tc=cyl(0.9,Ht,'#8d929c',V(sx*Ls/2,y0+Ht/2,sz*Ls/2),Q(),{sideN:8,top:false});cladCyl(tc,8,{cols:st});
    const disc=cyl(1.28,0.18,STONE[2],V(sx*Ls/2,y0+Ht+0.09,sz*Ls/2),Q(),{top:false,side:false});
    for(let k=0;k<8;k++){const a=(k+0.5)/8*Math.PI*2;addSlot(disc,V(Math.cos(a)*1.02,0.09,Math.sin(a)*1.02),UPV)}
    const top=y0+Ht+0.18;
    if(R.chance(0.5)&&cx>0.2){const cn=cone(1.4,1.7,R.pick(['#c8504a','#4f6fb8','#5c9a6a']),V(sx*Ls/2,top+0.85,sz*Ls/2),Q(),{n:5});
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.7,6),partMat('#5b6270'));pole.position.y=1.15;decor(cn,pole);
      const fl=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.25,0.02),partMat('#ffcc1a'));fl.position.set(0.2,1.35,0);decor(cn,fl)}
    else if(cx>0.3)for(let k=0;k<8;k++){const a=(k+0.5)/8*Math.PI*2;box(0.46,0.46,0.46,STONE[1],V(sx*Ls/2+Math.cos(a)*1.02,top+0.23,sz*Ls/2+Math.sin(a)*1.02),eul(0,Math.PI/2-a,0),{faces:['+z','+y']})}}
  const Hw=R.f(2.1,2.4),Lw=Ls-1.9,walls=cx<0.35?[[0,1],[Math.PI,1]]:[[0,1],[Math.PI,1],[Math.PI/2,1],[-Math.PI/2,1]];
  walls.forEach(([rot],wi)=>{const q=eul(0,rot,0),c=V(0,0,Ls/2).applyQuaternion(q).add(V(0,y0+Hw/2,0));
    const w=box(Lw,Hw,0.5,'#8d929c',c,q,{faces:['+z','-z']});
    plankFace(w,'+z',{dir:'h',w:pw,cols:st});plankFace(w,'-z',{dir:'h',w:pw,cols:st});
    const capD=0.5+2*PT+0.1,cap=onFace(w,'+y',0,0,Lw,capD,0.16,STONE[2]);
    if(cx>0.5){const m=Math.floor(Lw/0.9);for(let i=0;i<m;i++)onFace(cap,'+y',-Lw/2+0.45+i*(Lw-0.9)/Math.max(1,m-1),-(capD/2-0.23),0.46,0.46,0.46,STONE[1],{noAnchor:true})}
    if(wi===0){const gt=onFace(w,'+z',0,-Hw/2+0.82,1.3,1.64,0.16,'#7a5236',{gap:PT});for(const v of[-0.45,0.45])onFace(gt,'+z',0,v,1.3,0.4,0.14,'#4f5560')}
    else if(cx>0.4)onFace(w,'+z',0,0.2,0.7,1.2,0.14,R.pick(['#c8504a','#4f6fb8','#e0a63a']),{gap:PT})});
  if(cx>0.55){const kh=R.f(2.6,3.0),keep=box(2.0,kh,2.0,'#8d929c',V(0,y0+kh/2,0),Q(),{faces:['+x','-x','+z','-z']});
    cladBox(keep,['+z','-z','+x','-x'],{w:pw,cols:st,postColor:STONE[2]});
    win(keep,'+z',0,0.4,0.7,0.8,PT,{accent:'#5b4a44'});if(cx>0.9)win(keep,'-z',0,0.4,0.7,0.8,PT,{accent:'#5b4a44'});
    const pg=new THREE.ConeGeometry(1.95,1.6,4).toNonIndexed();pg.rotateY(Math.PI/4);pg.computeVertexNormals();
    const roof=addPart(pg,'#4f6fb8',V(0,y0+kh+0.8,0),Q(),{mat:{flatShading:true}});polySlots(roof,4,R)}
}
function genRocket(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal)),y0=pad(R,3.8,'#dfe3ea'),r=R.f(1.0,1.15),ph=Math.PI/2;
  cyl(r*0.62,0.5,'#a3adbb',V(0,y0+0.25,0),Q(),{top:false,sideN:4});
  let y=y0+0.5;const hs=[R.f(1.6,2.0),R.f(1.8,2.3),R.f(1.2,1.5)];if(cx>0.9)hs.splice(2,0,R.f(1.2,1.5));
  const cols=[[pal.light,pal.main],[acc.main,acc.light],[pal.light,'#ffffff'],[acc.light,acc.main]],segs=[];
  hs.forEach((h,i)=>{const c=cyl(r,h,'#7c8695',V(0,y+h/2,0),Q(),{top:false,sideN:8,phase:ph});segs.push(cladCyl(c,8,{cols:cols[i%cols.length],phase:ph}));y+=h});
  for(let k=0;k<4;k++){const an=ph+Math.PI/4+k*Math.PI/2,rf=r+PT+0.58;box(0.24,1.7,1.16,acc.dark,V(Math.cos(an)*rf,y0+1.25,Math.sin(an)*rf),eul(0,Math.PI/2-an,0),{faces:['+x','-x']})}
  win(segs[1][0],'+z',0,0.25,0.66,0.66,0,{accent:'#f4f6fa'});if(cx>0.5)win(segs[1][4],'+z',0,0.25,0.66,0.66,0,{accent:'#f4f6fa'});
  if(cx>0.7)win(segs[0][2],'+z',0,0,0.66,0.66,0,{accent:'#f4f6fa'});
  const ch=R.f(1.5,1.9);const cn=cone(r+PT,ch,acc.dark,V(0,y+ch/2,0),Q(),{n:5});
  const tp=new THREE.Mesh(new THREE.SphereGeometry(0.12,16,12),partMat('#ff6b6b'));tp.position.y=ch/2;decor(cn,tp);
  if(cx>0.3)for(const an of[ph+Math.PI/2,ph+3*Math.PI/2]){const rb=r+PT+0.44,bc=cyl(0.42,2.4,'#7c8695',V(Math.cos(an)*rb,y0+1.7,Math.sin(an)*rb),Q(),{top:false,sideN:6,phase:an});
    if(cx>0.65)cladCyl(bc,6,{cols:[acc.light,'#ffffff'],phase:an});cone(0.42+(cx>0.65?PT:0),0.6,acc.main,V(Math.cos(an)*rb,y0+1.7+1.5,Math.sin(an)*rb),Q(),{n:3})}
  if(cx>0.45){const tz=-(r+PT+2.05),TH=Math.min(y-y0-0.4,6.5),nb=Math.floor(TH/1.1);
    for(const[px,pz]of[[0.65,0.65],[-0.65,0.65],[0.65,-0.65],[-0.65,-0.65]])box(0.34,TH,0.34,'#d64545',V(px,y0+TH/2,tz+pz),Q(),{faces:['+x','-x','+z','-z']});
    for(let j=0;j<nb;j++){const yy=y0+0.6+j*1.1;
      if(j%2===0)for(const s of[1,-1])box(1.64,0.34,0.16,'#e8e8e8',V(0,yy,tz+s*0.9),Q(),{faces:[s>0?'+z':'-z']});
      else for(const s of[1,-1])box(0.16,0.34,1.64,'#e8e8e8',V(s*0.9,yy,tz),Q(),{faces:[s>0?'+x':'-x']})}
    box(1.9,0.2,1.9,'#5b6270',V(0,y0+TH+0.1,tz),Q(),{faces:['+y']});
    const al=-tz-0.95-(r+PT)-0.05;box(0.34,0.34,al,'#d64545',V(0,y0+TH-0.6,tz+0.95+al/2),Q(),{faces:['+y','+x','-x']})}
}
function genRobot(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal)),y0=pad(R,3.4,'#e9dcc4'),legH=R.f(1.4,1.7),footH=0.42;
  for(const s of[-1,1]){const fx=s*0.66;
    box(1.05,footH,1.4,acc.dark,V(fx,y0+footH/2,0.14),Q(),{faces:['+y','+z',s>0?'+x':'-x']});
    const leg=box(0.76,legH,0.86,pal.dark,V(fx,y0+footH+legH/2,0),Q(),{faces:['+z','-z',s>0?'+x':'-x']});
    const pl=onFace(leg,'+z',0,0,0.62,legH*0.85,0.14,pal.light);if(cx>0.3)onFace(pl,'+z',0,legH*0.18,0.46,0.42,0.14,acc.main);
    if(cx>0.6)onFace(leg,s>0?'+x':'-x',0,0,0.6,legH*0.7,0.14,pal.light)}
  const py=y0+footH+legH;box(1.95,0.5,1.06,pal.dark,V(0,py+0.25,0),Q(),{faces:['+z','-z','+x','-x']});
  const TW=R.f(2.2,2.5),TH=R.f(1.9,2.2),TD=1.4,ty=py+0.5+TH/2;
  const torso=box(TW,TH,TD,'#5b6270',V(0,ty,0),Q(),{faces:['+z','-z','+x','-x']});
  cladBox(torso,['+z','-z','+x','-x'],{dir:'v',w:0.5,cols:[pal.main,shade(pal.main,0.92)],postColor:pal.dark});
  const chest=onFace(torso,'+z',0,0.12,TW*0.62,TH*0.55,0.14,pal.light,{gap:PT,faces:[]});faceSlot(chest,'+z',-TW*0.2,-TH*0.17);faceSlot(chest,'+z',TW*0.2,-TH*0.17);
  [-1,0,1].forEach((i,k)=>onFace(chest,'+z',i*0.5,TH*0.1,0.38,0.38,0.14,['#ffd166','#8be3ff','#ff9fb2'][k]));
  onFace(torso,'+z',0,-TH/2+0.2,TW+0.05,0.4,0.14,acc.dark,{gap:PT});
  if(cx>0.2){const bp=onFace(torso,'-z',0,0,TW*0.62,TH*0.72,0.45,acc.main,{gap:PT});if(cx>0.5)for(const v of[-0.42,0,0.42])onFace(bp,'-z',0,v,TW*0.5,0.36,0.14,acc.dark)}
  const off=TW/2+PT+0.32,shY=ty+TH/2-0.38;
  for(const s of[-1,1]){const ax=s*off;
    cyl(0.44,0.52,acc.main,V(ax,shY,0),eul(0,0,-s*Math.PI/2),{sideN:5});
    const uh=TH*0.42,uy=shY-0.48-uh/2;box(0.62,uh,0.72,pal.light,V(ax,uy,0),Q(),{faces:['+z','-z',s>0?'+x':'-x']});
    const ey=uy-uh/2-0.3;cyl(0.32,0.6,acc.dark,V(ax,ey,0),eul(0,0,Math.PI/2),{top:false,side:false});
    const fh=TH*0.4,fy=ey-0.3-fh/2;const fa=box(0.6,fh,0.7,pal.light,V(ax,fy,0),Q(),{faces:['+z','-z',s>0?'+x':'-x']});
    if(cx>0.4)onFace(fa,'+z',0,0,0.46,fh*0.7,0.14,acc.main);
    box(0.72,0.48,0.72,acc.dark,V(ax,fy-fh/2-0.25,0.04),Q(),{faces:['+z','-z',s>0?'+x':'-x']})}
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.34,0.32,24),partMat('#5b6270'));neck.position.y=TH/2+0.16;decor(torso,neck);
  const HW=R.f(1.45,1.75),HH=R.f(1.05,1.25),HD=1.25,hy=ty+TH/2+0.3+HH/2;
  const head=box(HW,HH,HD,pal.main,V(0,hy,0),Q(),{faces:['-z','+x','-x']});
  const face=onFace(head,'+z',0,-0.02,HW*0.84,HH*0.74,0.14,'#2d3a4d',{faces:[]});faceSlot(face,'+z',-HW*0.3,-HH*0.2);faceSlot(face,'+z',HW*0.3,-HH*0.2);
  if(cx>0.5)onFace(face,'+z',0,-HH*0.2,HW*0.3,0.26,0.14,'#5b6270');
  for(const s of[-1,1]){const eye=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.04,20),new THREE.MeshStandardMaterial({color:srgb('#8ff3ff'),emissive:srgb('#4fd9ff'),emissiveIntensity:.9}));eye.rotation.x=Math.PI/2;eye.position.set(s*HW*0.2,HH*0.14,0.08);decor(face,eye)}
  for(const s of[-1,1])onFace(head,s>0?'+x':'-x',0,0,0.58,0.58,0.22,acc.main);
  const tpp=onFace(head,'+y',0,0,HW*0.72,HD*0.7,0.14,acc.light);
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.6,10),partMat('#9aa6b5'));ant.position.y=0.37;decor(tpp,ant);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(0.13,16,12),new THREE.MeshStandardMaterial({color:srgb('#ff6b6b'),emissive:srgb('#ff3b3b'),emissiveIntensity:.5}));ball.position.y=0.72;decor(tpp,ball)
}
const GENS3D=[['cottage',genCottage],['room',genRoom],['mill',genMill],['castle',genCastle],['rocket',genRocket],['robot',genRobot]];
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
