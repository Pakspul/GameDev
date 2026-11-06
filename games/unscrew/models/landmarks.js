// Unscrew 3D models: landmarks and history.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

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
model('mill','landmarks',genMill);

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
model('castle','landmarks',genCastle);

function genLighthouse(R,cfg){
  const cx=cfg.cx,y0=pad(R,4.4,'#e3d3a2'),ph=Math.PI/2,pal=R.pick(PALS),red=R.pick(['#e8283a','#d9453d','#3d6fb8']),tx=0.8;
  // the tower: stacked, ever narrower segments, each a core clad with eight panels, in stripes
  const rs=[1.5,1.32,1.15,1.0].slice(0,cx>0.9?4:3),hs=rs.map((_,i)=>R.f(1.45,1.7)-i*0.05),segs=[];let y=y0;
  rs.forEach((r,i)=>{const c=cyl(r,hs[i],'#7c8695',V(tx,y+hs[i]/2,0),Q(),{top:false,sideN:8,phase:ph});
    segs.push(cladCyl(c,8,{cols:i%2?['#f4f1ea','#e6e1d6']:[red,shade(red,0.92)],phase:ph}));y+=hs[i]});
  // a door on a panel, a window on the door's own plate: three layers deep. Windows sit on a panel screw each
  const door=onFace(segs[0][0],'+z',0,-hs[0]/2+0.62,0.62,1.2,0.14,'#5b3f2e');
  if(cx>0.3)onFace(door,'+z',0,0.27,0.4,0.4,0.14,'#8fcdee');
  const wy=i=>axisOffs(hs[i])[1];
  win(segs[1][0],'+z',0,wy(1),0.66,0.66,0,{accent:'#f4f6fa'});
  if(cx>0.5)win(segs[1][4],'+z',0,wy(1),0.66,0.66,0,{accent:'#f4f6fa'});
  if(cx>0.7)win(segs[2][2],'+z',0,wy(2),0.62,0.62,0,{accent:'#f4f6fa'});
  if(cx>1.0)win(segs[rs.length-1][6],'+z',0,wy(rs.length-1),0.6,0.6,0,{accent:'#f4f6fa'});
  // the gallery: a disc with a railing, then the lamp room of glass panels under a cap
  const gR=2.0,rl=0.8,dTop=y+0.18;
  const disc=cyl(gR,0.18,'#6b7280',V(tx,y+0.09,0),Q(),{top:false,side:false});
  for(let k=0;k<8;k++){const a=(k+0.5)/8*Math.PI*2;addSlot(disc,V(Math.cos(a)*1.35,0.09,Math.sin(a)*1.35),UPV)}
  if(cx>0.2){const pr=gR-0.12;
    for(let k=0;k<8;k++){const a=k/8*Math.PI*2;box(0.26,0.7,0.26,'#4d5560',V(tx+Math.cos(a)*pr,dTop+0.35,Math.sin(a)*pr),eul(0,Math.PI/2-a,0),{faces:['+z']})}
    for(let k=0;k<8;k++){const am=(k+0.5)/8*Math.PI*2,rr=pr*Math.cos(Math.PI/8),len=2*pr*Math.sin(Math.PI/8)+0.26;
      faceSlot(box(len,0.14,0.26,'#9aa6b5',V(tx+Math.cos(am)*rr,dTop+0.77,Math.sin(am)*rr),eul(0,-am-Math.PI/2,0),{faces:[]}),'+y',0,0)}}
  const lh=1.2,lamp=cyl(rl,lh,'#4d5560',V(tx,dTop+lh/2,0),Q(),{top:false,sideN:6,phase:ph});
  cladCyl(lamp,6,{cols:['#bfe3f2','#d7f0fa'],phase:ph});
  const ch=0.95,cn=cone(rl+PT+0.2,ch,red,V(tx,dTop+lh+ch/2,0),Q(),{n:5});
  const ball=new THREE.Mesh(new THREE.SphereGeometry(0.14,12,10),partMat('#f2d16b'));ball.position.y=ch/2+0.05;decor(cn,ball);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.6,6),partMat('#5b6270'));rod.position.y=ch/2+0.4;decor(cn,rod);
  // the keeper's house beside it. Its wall facing the tower has no screws: they would point at the tower's panels.
  // Panels 0.62 high, and the side panels run past the corner instead of posts (see the steam train)
  if(cx>0.15){const hx=-3.0,W=2.3,H=2.0,D=1.9,core=box(W,H,D,'#f1ece0',V(hx,y0+H/2,0.5),Q(),{faces:['+z','-z','-x']});
    plankFace(core,'-x',{w:0.62,color:pal.light});for(const f of['+z','-z'])plankFace(core,f,{w:0.62,color:pal.light,ext:2*PT});
    onFace(core,'+z',0.91,-0.3,0.7,1.4,0.14,pal.dark,{gap:PT});
    win(core,'+z',-0.91,0,0.5,0.5,PT,pal);
    if(cx>0.35)win(core,'-x',0,0,0.5,0.5,PT,pal);
    const pg=new THREE.ConeGeometry(2.0,1.15,4).toNonIndexed();pg.rotateY(Math.PI/4);pg.computeVertexNormals();
    polySlots(addPart(pg,red,V(hx,y0+H+0.575,0.5),Q(),{mat:{flatShading:true}}),4,R)}
  // rocks in the gaps between the directions the tower's panels point in
  for(const a of R.shuffle([22.5,202.5,247.5,112.5]).slice(0,1+Math.round(cx*1.5))){const t=a*Math.PI/180;blob(R.f(0.34,0.46),'#a3a7ad',V(tx+Math.cos(t)*2.9,y0+0.3,Math.sin(t)*2.9),R,3)}
}
model('lighthouse','landmarks',genLighthouse);

function genPagoda(R,cfg){
  const cx=cfg.cx,y0=pad(R,4.6,'#d9e3b8'),pal=R.pick(PALS),ST='#b7bcc6',roof=R.pick(['#b5473a','#3f7a8c','#5a6f9c','#8a5a3b']),roofD=shade(roof,0.78);
  const n=3+(cx>0.7?1:0)+(cx>1.25?1:0),H=1.25,SL=0.26,Ws=[3.4,2.9,2.4,2.0,1.6];
  // stone platform: its only screws sit under the first floor and under the corner lanterns
  const PW=Ws[0]+1.8,plat=box(PW,0.5,PW,ST,V(0,y0+0.25,0),Q(),{faces:[]});
  for(const[a,b]of[[-1.2,-1.2],[1.2,-1.2],[-1.2,1.2],[1.2,1.2]])faceSlot(plat,'+y',a,b);
  if(cx>0.15)for(const[a,b]of[[-2.2,-2.2],[2.2,-2.2],[-2.2,2.2],[2.2,2.2]]){faceSlot(plat,'+y',a,b);
    const l=cyl(0.3,0.8,'#c9ccd3',V(a,y0+0.5+0.4,-b),Q(),{side:false});
    const cap=new THREE.Mesh(new THREE.ConeGeometry(0.4,0.3,4),partMat('#9aa6b5'));cap.rotation.y=Math.PI/4;cap.position.y=0.55;decor(l,cap)}
  onFace(plat,'+z',0,0,1.8,0.5,0.8,'#cfd2d8');
  let y=y0+0.5;
  for(let i=0;i<n;i++){
    const W=Ws[i],core=box(W,H,W,'#6b4a3a',V(0,y+H/2,0),Q(),{faces:['+y']});
    const cols=i%2?[pal.light,shade(pal.light,0.93)]:[pal.main,shade(pal.main,0.92)];
    // walls of 0.62 panels; the front and back ones run past the corners, so there are no posts
    for(const f of['+x','-x'])plankFace(core,f,{w:0.62,cols});for(const f of['+z','-z'])plankFace(core,f,{w:0.62,cols,ext:2*PT});
    // the door and the windows sit on the panels and each covers the middle column of screws of both panel rows
    const ww=W>=2.4?0.8:Math.max(0.44,2*(axisOffs(W)[0]*-1-0.28));
    if(i===0)onFace(core,'+z',0,0,0.9,1.0,0.14,'#7a3b2e',{gap:PT});
    else if(cx>0.2)win(core,'+z',0,0,ww,1.0,PT,pal);
    if(cx>0.35||i===0)win(core,'-z',0,0,ww,1.0,PT,pal);
    if(cx>0.55)for(const f of['+x','-x'])win(core,f,0,0,ww,1.0,PT,pal);
    y+=H;
    if(i<n-1){
      // roof slab: the screws under the next floor are all it has, plus tile plates (and lanterns on them) on its rim
      const half=W/2+0.95,sl=box(2*half,SL,2*half,roof,V(0,y+SL/2,0),Q(),{faces:[]}),q=Ws[i+1]/2-0.4;
      for(const[a,b]of[[-q,-q],[q,-q],[-q,q],[q,q]])faceSlot(sl,'+y',a,b);
      const s=W/2+0.55;
      if(cx>0.2)for(const[a,b]of[[s,0],[-s,0],[0,s],[0,-s]])onFace(sl,'+y',a,b,0.5,0.5,0.14,roofD);
      if(cx>0.35){const c=half-0.45;for(const[a,b]of[[c,c],[-c,c],[c,-c],[-c,-c]]){onFace(sl,'+y',a,b,0.5,0.5,0.14,roofD);
        if(cx>0.8){const lp=cyl(0.2,0.45,'#e8283a',V(a,y+SL+0.14+0.225,-b),Q(),{side:false});
          const gl=new THREE.Mesh(new THREE.SphereGeometry(0.1,10,8),partMat('#ffd166',{emissive:srgb('#ffb020'),emissiveIntensity:.5}));gl.position.y=0.25;decor(lp,gl)}}}
      const tr=new THREE.Mesh(new THREE.BoxGeometry(2*half+0.06,0.1,2*half+0.06),partMat(roofD));tr.position.y=-SL/2+0.05;decor(sl,tr);
      for(const sx of[-1,1])for(const sz of[-1,1]){const tip=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.12,0.7),partMat(roof));
        tip.position.set(sx*(half-0.05),SL/2+0.1,sz*(half-0.05));tip.rotation.set(sz*0.4,0,-sx*0.4);decor(sl,tip)}
      y+=SL}
    else{
      // the top: a four-sided cap hiding the top floor's screws, with a spire
      const Rr=(W/2+0.45)*Math.SQRT2,hh=1.3,pg=new THREE.ConeGeometry(Rr,hh,4).toNonIndexed();pg.rotateY(Math.PI/4);pg.computeVertexNormals();
      const rf=addPart(pg,roof,V(0,y+hh/2,0),Q(),{mat:{flatShading:true}});polySlots(rf,4,R);
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.1,8),partMat('#c9a25a',{metalness:.4}));pole.position.y=hh/2+0.45;decor(rf,pole);
      for(const k of[0,1,2]){const rg=new THREE.Mesh(new THREE.CylinderGeometry(0.22-k*0.04,0.22-k*0.04,0.07,16),partMat('#c9a25a',{metalness:.4}));rg.position.y=hh/2+0.2+k*0.3;decor(rf,rg)}
      const orb=new THREE.Mesh(new THREE.SphereGeometry(0.12,12,10),partMat('#c9a25a',{metalness:.4}));orb.position.y=hh/2+1.05;decor(rf,orb)}}
  for(const[x,z]of R.shuffle([[-3.6,2.6],[3.7,2.5],[-3.7,-2.4],[3.5,-2.8]]).slice(0,1+Math.round(cx*1.5)))blob(R.f(0.4,0.55),R.pick(['#79c46f','#e8a3b7']),V(x,y0+0.4,z),R,3);
}
model('pagoda','landmarks',genPagoda);
