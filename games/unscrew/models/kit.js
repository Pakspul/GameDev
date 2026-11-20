// Unscrew's building blocks for 3D models: random numbers, palettes, parts with screw slots,
// cladding, windows and scenery. Every file in models/ builds with these; game.js uses them too.
// Background and the rules a model must follow: docs/UNSCREW-MODELS.md.
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

const PALS=[
  {main:'#7cc68d',dark:'#4f9e64',light:'#b8e3b5',trim:'#3d7f50',accent:'#f2e8d4'},
  {main:'#f2b880',dark:'#d48a52',light:'#f8dcbc',trim:'#a7643a',accent:'#fff3e2'},
  {main:'#9fb8e8',dark:'#6e8fcf',light:'#cddbf5',trim:'#4d6aa8',accent:'#f4f7ff'},
  {main:'#e8a3b7',dark:'#c97790',light:'#f5cfda',trim:'#9e5068',accent:'#fff0f4'},
  {main:'#e6d17a',dark:'#c4ab4c',light:'#f3e7b3',trim:'#8e7a2e',accent:'#fffbe8'},
  {main:'#a6d8d4',dark:'#6fb5af',light:'#d3efec',trim:'#3f8a84',accent:'#f2fffd'}];
const WOOD=['#e2c08f','#d6b07c','#e8c99d'];
const STONE=['#c9ccd3','#b7bcc6','#d6d8de'];

/* ----- builder ----- */
const FACES={
  '+x':{n:[1,0,0],u:[0,0,-1],v:[0,1,0],L:['d','h'],half:'w'},'-x':{n:[-1,0,0],u:[0,0,1],v:[0,1,0],L:['d','h'],half:'w'},
  '+y':{n:[0,1,0],u:[1,0,0],v:[0,0,-1],L:['w','d'],half:'h'},'-y':{n:[0,-1,0],u:[1,0,0],v:[0,0,1],L:['w','d'],half:'h'},
  '+z':{n:[0,0,1],u:[1,0,0],v:[0,1,0],L:['w','h'],half:'d'},'-z':{n:[0,0,-1],u:[-1,0,0],v:[0,1,0],L:['w','h'],half:'d'}};
let BLD=null;
const PROXY_MAT=new THREE.MeshBasicMaterial({visible:false});PROXY_MAT.userData.shared=true;
function partMat(hex,o={}){const m=new THREE.MeshStandardMaterial({roughness:.55,metalness:0,...o});m.color.copy(srgb(hex));return m}
function roundRectShape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;r=Math.max(0.001,Math.min(r,w/2-0.0005,h/2-0.0005));
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.absarc(x+w-r,y+r,r,-Math.PI/2,0,false);s.lineTo(x+w,y+h-r);s.absarc(x+w-r,y+h-r,r,0,Math.PI/2,false);
  s.lineTo(x+r,y+h);s.absarc(x+r,y+h-r,r,Math.PI/2,Math.PI,false);s.lineTo(x,y+r);s.absarc(x+r,y+r,r,Math.PI,1.5*Math.PI,false);return s}
function roundPolyShape(vs,r){const s=new THREE.Shape(),n=vs.length;const P=i=>vs[(i+n)%n];
  const toward=(a,b,d)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);return[a[0]+dx/L*d,a[1]+dy/L*d]};
  const o0=toward(P(0),P(1),r);s.moveTo(o0[0],o0[1]);
  for(let i=1;i<=n;i++){const v=P(i),a=toward(v,P(i-1),r),b=toward(v,P(i+1),r);s.lineTo(a[0],a[1]);s.quadraticCurveTo(v[0],v[1],b[0],b[1])}return s}
function roundedBoxGeo(w,h,d,r){r=Math.min(r,w*0.3,h*0.3,d*0.3);const iw=w-2*r,ih=h-2*r;
  const g=new THREE.ExtrudeGeometry(roundRectShape(iw,ih,Math.min(r,iw/2*0.9,ih/2*0.9)),{depth:Math.max(0.001,d-2*r),bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:4});
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
  const p=addPart(roundedBoxGeo(w,h,d,o.r??Math.min(0.09,Math.min(w,h,d)*0.3)),color,pos,quat,{...o,proxy:new THREE.BoxGeometry(w,h,d)});p.box={w,h,d};
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
  for(let k=0;k<n;k++){const a=ph+k/n*Math.PI*2;if(o.keep&&!o.keep(a,k))continue;const lp=V(Math.cos(a)*(r+t/2),0,Math.sin(a)*(r+t/2));
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

/* ----- prop looks ----- */
// A part keeps the plain box or cylinder it was made with as its screw proxy (what screws and rays see),
// so its look can be any shape: a quilt, pleated curtains, a cat. reskin() swaps the look; deco() and friends add decoration
function reskin(p,geo,mat){p.mesh.geometry.dispose();p.mesh.geometry=geo;
  if(mat){if(mat.map)p.mesh.material.color.set(0xffffff);Object.assign(p.mesh.material,mat);p.mesh.material.needsUpdate=true}return p}
function deco(p,geo,hex,x=0,y=0,z=0,o={}){const m=new THREE.Mesh(geo,partMat(hex,o.mat));m.position.set(x,y,z);
  if(o.rot)m.rotation.set(...o.rot);if(o.scale)m.scale.set(...o.scale);m.castShadow=o.shadow!==false;m.receiveShadow=true;p.mesh.add(m);return m}
const ell=(rx,ry,rz,s=20)=>new THREE.SphereGeometry(1,s,Math.round(s*0.7)).scale(rx,ry,rz);
function mergeGeo(gs){const a=gs.map(g=>g.index?g.toNonIndexed():g);let n=0;a.forEach(g=>n+=g.attributes.position.count);const out=new THREE.BufferGeometry();
  for(const k of['position','normal','uv']){if(!a.every(g=>g.attributes[k]))continue;const sz=a[0].attributes[k].itemSize,arr=new Float32Array(n*sz);let o=0;
    a.forEach(g=>{arr.set(g.attributes[k].array,o*sz);o+=g.attributes[k].count});out.setAttribute(k,new THREE.BufferAttribute(arr,sz))}
  new Set([...gs,...a]).forEach(g=>g.dispose());return out}
// a cushion: a sphere pushed out towards a box (e<1 is boxier); uv is a top-down projection, so a pattern lies flat on it
function puffGeo(w,h,d,e=0.5,ey=0.7){const g=new THREE.SphereGeometry(1,28,18),p=g.attributes.position,uv=g.attributes.uv,f=(v,k)=>Math.sign(v)*Math.pow(Math.abs(v),k);
  for(let i=0;i<p.count;i++){const x=f(p.getX(i),e),y=f(p.getY(i),ey),z=f(p.getZ(i),e);p.setXYZ(i,x*w/2,y*h/2,z*d/2);uv.setXY(i,x/2+0.5,0.5-z/2)}
  g.computeVertexNormals();return g}
// a quilted duvet: a slab under a grid of cushions
function quiltGeo(w,h,d,nx,nz){const cw=w/nx,cd=d/nz,gs=[new THREE.BoxGeometry(w-0.06,h*0.55,d-0.06).translate(0,-h*0.2,0)];
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)gs.push(puffGeo(cw+0.03,h,cd+0.03,0.55,0.8).translate(-w/2+cw*(i+0.5),0,-d/2+cd*(j+0.5)));return mergeGeo(gs)}
// a pleated curtain: a row of vertical folds
function pleatGeo(w,h,d){const n=Math.max(3,Math.round(w/0.11)),r=w/n*0.62,gs=[];
  for(let i=0;i<n;i++)gs.push(new THREE.CylinderGeometry(r,r*1.1,h,10).translate(-w/2+w/n*(i+0.5),0,(i%2?-1:1)*Math.max(0,d/2-r)*0.6));return mergeGeo(gs)}
// an open shelf unit, open towards +x, with n compartments
function shelfGeo(w,h,d,n,t=0.06){const B=(a,b,c,x,y,z)=>new THREE.BoxGeometry(a,b,c).translate(x,y,z);
  const gs=[B(t,h,d,-w/2+t/2,0,0),B(w,t,d,0,h/2-t/2,0),B(w,t,d,0,-h/2+t/2,0),B(w,h,t,0,0,d/2-t/2),B(w,h,t,0,0,-d/2+t/2)];
  for(let i=1;i<n;i++)gs.push(B(w-t,t,d-2*t,t/2,-h/2+h*i/n,0));return mergeGeo(gs)}
function heartGeo(s,t){const sh=new THREE.Shape(),k=s;sh.moveTo(0,-0.5*k);sh.bezierCurveTo(-0.15*k,-0.35*k,-0.55*k,-0.1*k,-0.5*k,0.15*k);sh.bezierCurveTo(-0.45*k,0.45*k,-0.1*k,0.5*k,0,0.25*k);
  sh.bezierCurveTo(0.1*k,0.5*k,0.45*k,0.45*k,0.5*k,0.15*k);sh.bezierCurveTo(0.55*k,-0.1*k,0.15*k,-0.35*k,0,-0.5*k);
  const g=new THREE.ExtrudeGeometry(sh,{depth:t*0.4,bevelEnabled:true,bevelThickness:t*0.3,bevelSize:t*0.3,bevelSegments:4,curveSegments:16});g.center();return g}
// many small things in one draw call: beads ({x,y,z} points) and boxes ({x,y,z,w,h,d,ry,c})
function beads(p,pts,r,cols){const im=new THREE.InstancedMesh(new THREE.SphereGeometry(r,10,8),partMat('#ffffff',{roughness:0.3}),pts.length),m=new THREE.Matrix4(),c=new THREE.Color();
  pts.forEach((q,i)=>{m.makeTranslation(q.x,q.y,q.z);im.setMatrixAt(i,m);im.setColorAt(i,c.set(cols[i%cols.length]).convertSRGBToLinear())});im.castShadow=true;p.mesh.add(im);return im}
function boxSet(p,list){const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),partMat('#ffffff'),list.length),m=new THREE.Matrix4(),c=new THREE.Color(),q=new THREE.Quaternion();
  list.forEach((b,i)=>{m.compose(V(b.x,b.y,b.z),q.setFromEuler(new THREE.Euler(0,b.ry||0,b.rz||0)),V(b.w,b.h,b.d));im.setMatrixAt(i,m);im.setColorAt(i,c.set(b.c).convertSRGBToLinear())});
  im.castShadow=true;im.receiveShadow=true;p.mesh.add(im);return im}
// points along a hanging string from a to b that dips by dip in the middle
function sag(a,b,dip,n){const out=[];for(let i=0;i<=n;i++){const t=i/n;out.push(a.clone().lerp(b,t).add(V(0,-dip*4*t*(1-t),0)))}return out}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}

/* ----- registry ----- */
// Every category file registers its models here. models/order.js then fixes their order for the level picker.
const MODELS3D=[];
function model(name,cat,gen){if(MODELS3D.some(m=>m.name===name))throw new Error(`Unscrew: two models are called "${name}"`);MODELS3D.push({name,cat,gen})}
