// Unscrew 3D models: industry.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

function genWaterTower(R,cfg){
  const cx=cfg.cx,y0=pad(R,3.7,'#c9d6a3'),pal=R.pick(PALS),ST='#5b6270',LT='#9aa6b5';
  const s=1.05,lw=0.36,LH=R.f(2.9,3.3),o=s+lw/2+0.08; // o: centre line of the beams, just outside the legs
  for(const sx of[-1,1])for(const sz of[-1,1])box(lw,LH,lw,ST,V(sx*s,y0+LH/2,sz*s),Q(),{faces:[sx>0?'+x':'-x',sz>0?'+z':'-z']});
  // beams on all four sides at the height of the legs' screw rows, so each beam covers the leg screws behind it
  const rows=axisOffs(LH),bl=2*s+lw,beams=[];
  for(const[k,y]of rows.entries()){if(k===0&&cx<0.45)continue;
    for(const[f,px,pz]of[['+z',0,o],['-z',0,-o],['+x',o,0],['-x',-o,0]]){const ax=f[1]==='x';
      beams.push({f,y,b:box(ax?0.16:bl,0.36,ax?bl:0.16,LT,V(px,y0+LH/2+y,pz),Q(),{faces:[f]})})}}
  // cross braces between the upper two beam rows (decoration on the upper beam, so they leave with it)
  if(cx>0.3){const yU=rows[2],yL=rows[1],dh=yU-yL,len=Math.hypot(bl-0.4,dh),ang=Math.atan2(dh,bl-0.4);
    for(const{f,y,b}of beams){if(y!==yU)continue;const ax=f[1]==='x';
      for(const sg of[-1,1]){const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,len,6),partMat(LT));rod.position.set(0,-dh/2,0);
        rod.rotation.set(ax?sg*(Math.PI/2-ang):0,0,ax?0:sg*(Math.PI/2-ang));decor(b,rod)}}}
  // a pipe down the middle; its side screws are blocked by the beams until those are off
  cyl(0.32,LH,LT,V(0,y0+LH/2,0),Q(),{top:false});
  // platform with a railing, like the windmill's gallery
  const r=1.3,pY=y0+LH,gR=r+PT+0.85;
  const disc=cyl(gR,0.2,'#6b7280',V(0,pY+0.1,0),Q(),{top:false,side:false});
  for(let k=0;k<8;k++){const a=(k+0.5)/8*Math.PI*2;addSlot(disc,V(Math.cos(a)*(r+PT+0.42),0.1,Math.sin(a)*(r+PT+0.42)),UPV)}
  const dTop=pY+0.2;
  if(cx>0.25){const pr=gR-0.12;for(let k=0;k<8;k++){const a=k/8*Math.PI*2;box(0.26,0.7,0.26,ST,V(Math.cos(a)*pr,dTop+0.35,Math.sin(a)*pr),eul(0,Math.PI/2-a,0),{faces:['+z']})}
    for(let k=0;k<8;k++){const am=(k+0.5)/8*Math.PI*2,rr=pr*Math.cos(Math.PI/8),len=2*pr*Math.sin(Math.PI/8)+0.26;
      faceSlot(box(len,0.14,0.26,LT,V(Math.cos(am)*rr,dTop+0.77,Math.sin(am)*rr),eul(0,-am-Math.PI/2,0),{faces:[]}),'+y',0,0)}} // one screw in the middle: the rails overlap at the posts
  // the tank: a core clad with ten staves, a sign, and a cone roof
  const th=R.f(1.7,2.0),n=10,ph=Math.PI/2;
  const tank=cyl(r,th,'#4d5560',V(0,dTop+th/2,0),Q(),{sideN:n,phase:ph,top:false});
  const tp=cladCyl(tank,n,{cols:[pal.main,pal.light],phase:ph});
  if(cx>0.5){const sg=onFace(tp[0],'+z',0,0,0.62,0.66,0.14,'#f4f1ea');
    const drop=new THREE.Mesh(new THREE.SphereGeometry(0.16,14,10),partMat('#4fb3e8'));drop.scale.set(1,1.25,0.4);drop.position.z=0.08;decor(sg,drop)}
  if(cx>0.9){const sg=onFace(tp[5],'+z',0,0,0.62,0.66,0.14,'#f4f1ea');const drop=new THREE.Mesh(new THREE.SphereGeometry(0.16,14,10),partMat('#4fb3e8'));drop.scale.set(1,1.25,0.4);drop.position.z=0.08;decor(sg,drop)}
  const ch=R.f(0.8,1.0),cn=cone(r+PT+0.22,ch,pal.trim,V(0,dTop+th+ch/2,0),Q(),{n:5});
  const fin=new THREE.Mesh(new THREE.SphereGeometry(0.13,12,10),partMat('#f2d16b'));fin.position.y=ch/2+0.05;decor(cn,fin);
  // ladder up the +x side: two rails 0.6 apart (screws need 0.52) in front of the beams, rungs as decoration
  if(cx>0.15){const lx=o+0.08+0.07;let first=null;
    for(const z of[-0.3,0.3]){const rl=box(0.12,LH-0.05,0.12,'#c9ccd3',V(lx,y0+(LH-0.05)/2,z),Q(),{faces:['+x']});first=first||rl}
    for(let y=-LH/2+0.3;y<LH/2-0.1;y+=0.32){const rg=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.6,6),partMat('#c9ccd3'));rg.rotation.x=Math.PI/2;rg.position.set(0,y,0.3);decor(first,rg)}}
  // a pump house in the corner, far enough out that the beams' screws miss it
  if(cx>0.6){const hx=-2.1,hz=2.15,hb=box(1.2,1.0,1.0,'#d9c7a8',V(hx,y0+0.5,hz),Q(),{faces:['+x','-x','+z','-z']});
    onFace(hb,'+z',0.2,-0.1,0.42,0.76,0.14,pal.dark);onFace(hb,'+y',0,0,1.4,1.2,0.16,pal.trim)}
  for(const[x,z]of R.shuffle([[2.35,2.3],[-2.4,-2.2],[2.4,-2.3]]).slice(0,1+Math.round(cx)))blob(R.f(0.36,0.5),'#7bb661',V(x,y0+0.36,z),R,3);
}
model('watertower','industry',genWaterTower);

function genWindTurbine(R,cfg){
  const cx=cfg.cx,y0=pad(R,3.8,'#c9d6a3'),pal=R.pick(PALS),ph=Math.PI/2,ST='#5b6270',MT='#9aa6b5',WH=R.pick(['#f4f1ea','#e9edf2']);
  // the tower: segments that narrow towards the top, each a core clad with eight panels
  const rs=[1.0,0.88,0.76,0.66].slice(0,cx>0.8?4:3),hh=cx>0.8?1.2:1.45,segs=[];let y=y0;
  rs.forEach((r,i)=>{const h=hh+R.f(0,0.12),c=cyl(r,h,ST,V(0,y+h/2,0),Q(),{top:false,sideN:8,phase:ph});
    segs.push(cladCyl(c,8,{cols:i%2?[WH,shade(WH,0.94)]:[shade(WH,0.97),shade(WH,0.9)],phase:ph}));y+=h});
  const door=onFace(segs[0][0],'+z',0,-hh/2+0.62,0.62,1.2,0.14,pal.dark);
  if(cx>0.3)onFace(door,'+z',0,0.27,0.4,0.4,0.14,'#ffd166');
  if(cx>0.6)win(segs[1][4],'+z',0,axisOffs(hh)[1],0.5,0.5,0,{accent:'#f4f6fa'});
  // nacelle: a core with clad sides, a hatch plate on its roof, an anemometer and a vent on the plate
  const NL=2.6,NH=1.24,nyaw=R.f(-0.25,0.25),ny=y+NH/2,nq=eul(0,nyaw,0);
  const nac=box(1.15,NH,NL,'#5b6270',V(0,ny,0.25),nq,{faces:['+x','-x','-z','+y']});
  plankFace(nac,'-z',{w:0.62,color:pal.main});for(const f of['+x','-x'])plankFace(nac,f,{w:0.62,color:pal.main,ext:2*PT}); // side panels run past the corner, no posts
  const hatch=onFace(nac,'+y',0,0,0.9,2.3,0.14,pal.dark);
  const am=onFace(hatch,'+y',0,0.82,0.34,0.34,0.5,MT,{faces:['+y']});
  for(const k of[0,1,2]){const a=k*Math.PI*2/3,cp=new THREE.Mesh(new THREE.SphereGeometry(0.09,10,8),partMat('#e8283a'));cp.position.set(Math.cos(a)*0.22,0.27,Math.sin(a)*0.22);decor(am,cp)}
  if(cx>0.4)onFace(hatch,'+y',0,-0.82,0.5,0.5,0.3,pal.light);
  // rotor: three blades whose roots disappear under the hub; the hub's only screw is on its front
  const hubR=1.15,dirN=V(Math.sin(nyaw),0,Math.cos(nyaw)),hc=V(0,ny,0.25).addScaledVector(dirN,NL/2+0.25);
  const hub=cyl(hubR,0.5,'#e8edf2',hc,nq.clone().multiply(eul(Math.PI/2,0,0)),{top:false,side:false});
  addSlot(hub,V(0,0.25,0),UPV);
  const rot0=R.f(0,Math.PI*2/3),bq=nq;
  for(let k=0;k<3;k++){const th=rot0+k*Math.PI*2/3,rad=2.05,dir=V(-Math.sin(th),Math.cos(th),0);
    const bl=box(0.5,3.0,0.14,WH,hc.clone().add(dir.multiplyScalar(rad).applyQuaternion(bq)),bq.clone().multiply(eul(0,0,th)),{faces:['+z']});
    onFace(bl,'+z',0,0,0.46,0.5,0.14,k?pal.main:'#e8283a');
    if(cx>0.7)onFace(bl,'+z',0,1.1,0.46,0.5,0.14,pal.main)}
  const ring=new THREE.Mesh(new THREE.TorusGeometry(hubR-0.02,0.04,8,32),partMat(MT,{metalness:.4}));ring.position.y=0.25;ring.rotation.x=Math.PI/2;decor(hub,ring);
  // a transformer hut and a few bushes
  if(cx>0.2){const hx=-2.3,hz=1.3,hb=box(1.3,1.1,1.0,'#d9c7a8',V(hx,y0+0.55,hz),Q(),{faces:['+x','-x','+z','-z']});
    onFace(hb,'+z',0.2,-0.1,0.42,0.76,0.14,pal.dark);box(1.5,0.16,1.2,pal.trim,V(hx,y0+1.18,hz),Q(),{faces:['+y']})}
  for(const[x,z]of R.shuffle([[2.4,2.0],[-2.4,-2.1],[2.5,-2.0]]).slice(0,1+Math.round(cx)))blob(R.f(0.36,0.5),'#7bb661',V(x,y0+0.36,z),R,3);
}
model('windturbine','industry',genWindTurbine);

function genHarbourCrane(R,cfg){
  const cx=cfg.cx,y0=0.3,CR=R.pick(['#e0b43a','#d8473e','#3f7a9c']),CRD=shade(CR,0.78),DK='#3d4450',CL=2.6,CW=1.1,CH=1.0,gx=1.35,gz=0.62,maxH=cx>0.6?3:2;
  const ground=box(11,0.3,6.8,'#9aa6b5',V(0,0.15,0),Q(),{static:true,r:0.06});
  const sea=new THREE.Mesh(new THREE.BoxGeometry(11,0.2,2.4),partMat('#7fbfdc',{roughness:.2}));sea.position.set(0,0.0,4.6);decor(ground,sea);
  for(let i=-4;i<=4;i++){const ln=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.02,0.12),partMat('#f4f1ea'));ln.position.set(i*1.2,0.16,-2.9);decor(ground,ln)}
  // the container block: two by two stacks. Each container has screws only on its top and on its two outer faces
  // (the inner faces would point at a neighbour), and plates cover the outer ones: so a stack comes apart from the top down
  const CC=['#d8473e','#3f7ac2','#e8913a','#4fa66a','#8d929c','#e6c13c','#a56bc9'];
  for(const[ix,iz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){
    const h=ix>0&&iz>0?maxH:R.i(1,maxH),f1=ix>0?'+x':'-x',f2=iz>0?'+z':'-z';
    for(let k=0;k<h;k++){const col=R.pick(CC),c=box(CL,CH,CW,col,V(ix*gx,y0+CH/2+k*CH,iz*gz),Q(),{faces:cx>0.15?['+y',f1,f2]:['+y',f2]});
      if(cx>0.15){const dp=onFace(c,f1,0,0,0.92,0.8,0.14,shade(col,0.82));
        if(cx>0.5)onFace(dp,f1,0,0,0.4,0.4,0.14,DK)}
      const sp=onFace(c,f2,0,0,2.4,0.8,0.14,shade(col,1.07)),u=V(...FACES[f2].u);
      for(let i=-5;i<=5;i++){const rb=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.7,0.03),partMat(shade(col,0.88)));rb.position.copy(u.clone().multiplyScalar(i*0.21)).setY(0).addScaledVector(V(...FACES[f2].n),0.085);decor(sp,rb)}}}
  // the portal crane: four feet and legs (the legs' only screws are hidden under plates and under the beams), two beams on the legs, a girder across the beams, a trolley
  const LX=3.5,LZ=1.9,FH=0.4,LH=3.6,BT=0.45,lt=y0+FH+LH;
  const legs=[];
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const foot=box(0.9,FH,0.9,DK,V(sx*LX,y0+FH/2,sz*LZ),Q(),{faces:['+x','-x','+z','-z']});faceSlot(foot,'+y',0,0);
    const leg=box(0.5,LH,0.5,CR,V(sx*LX,y0+FH+LH/2,sz*LZ),Q(),{faces:[]});faceSlot(leg,'+y',0,0);legs.push({leg,sx,sz});
    const fx=sx>0?'+x':'-x',fz=sz>0?'+z':'-z';
    for(const b of cx>0.3?[-1.1,0.7]:[0])onFace(leg,fx,0,b,0.5,0.9,0.14,CRD);
    if(cx>0.55)for(const b of[-0.2])onFace(leg,fz,0,b,0.5,0.9,0.14,CRD)}
  // X-braces between the legs of one side, as decoration on one of the legs
  for(const sx of[-1,1]){const lg=legs.find(l=>l.sx===sx&&l.sz===-1).leg,dy=LH-1.4,dz=2*LZ,len=Math.hypot(dy,dz),ang=Math.atan2(dy,dz);
    for(const k of cx>0.3?[1,-1]:[1]){const br=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,len),partMat(CRD));br.position.set(0,0,LZ*2/2);br.rotation.x=-k*ang;decor(lg,br)}}
  const beams=[];
  for(const sz of[-1,1]){const b=box(2*LX+1.0,BT,0.6,CRD,V(0,lt+BT/2,sz*LZ),Q(),{faces:[]});faceSlot(b,'+y',gx,0);beams.push(b)}
  const gy=lt+BT,gd=box(0.8,0.5,5.4,CR,V(gx,gy+0.25,0),Q(),{faces:[]});
  for(const b of[-2.35,2.35])onFace(gd,'+y',0,b,0.5,0.4,0.3,'#d8473e');
  const tr=onFace(gd,'+y',0,-gz,1.8,1.1,0.55,DK),spTop=y0+maxH*CH+0.2,rl=gy+0.5-spTop;
  if(cx>0.4)onFace(tr,'+y',0,0,1.8,1.1,0.14,CRD);
  for(const sx of[-1,1])for(const sz of[-1,1]){const rp=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,rl,6),partMat('#2d3138'));rp.position.set(sx*0.7,-0.275-rl/2,sz*0.35);decor(tr,rp)}
  // the spreader rests on the tallest stack and hides the top container's screws
  box(2.4,0.2,1.0,DK,V(gx,spTop-0.1,gz),Q(),{faces:['+y']});
  const nB=1+Math.round(cx*2);
  for(const x of R.shuffle([-4.4,-1.8,1.8,4.4]).slice(0,nB))cyl(0.22,0.5,'#2d3138',V(x,y0+0.25,2.9),Q(),{side:false});
}
model('harbourcrane','industry',genHarbourCrane);
