// Unscrew 3D models: rooms. Interiors: a floor and two walls, open to the camera.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

// The bedroom is built from a theme (colours) and props that snap to the wall panels: everything that stands
// against a wall is a whole number of panels wide and starts on a panel edge, so it covers whole panel screws
const BEDROOM_THEMES={
  pastel:{wall:['#fbd3dc','#f6c6d2'],outer:'#c9a8ec',trim:'#a982dc',floor:['#cfb4ef','#c3a5ea'],base:'#9d78d0',
    bed:'#f5c84c',mattress:'#ffe4ea',duvet:'#d9a9f2',pillow:'#ffffff',gingham:'#f48fb1',desk:'#f7aec0',leg:'#b48ae0',
    locker:'#b997e6',door:'#c6a8f0',dresser:'#cdb0f0',drawer:'#f8bccc',knob:'#f5c84c',pc:'#f8b4c2',pcBase:'#fde8ec',
    rug:'#f7b0cb',catBed:'#f48fb1',cat:'#2b2633',pipe:'#f4a8b8',brass:'#e8b53e',curtain:'#b98ae6',frame:'#ffffff',shelf:'#f8c9d4',
    books:['#f48fb1','#b997e6','#f5c84c','#8fd3e8','#ffb38a','#9be0b0'],pot:'#f5c84c',leaf:'#7ccf8a',suitcase:'#f48fb1',
    beads:['#ffffff','#f8bccc','#d9a9f2','#f5c84c']}};
const BEDROOM_TEX={
  gingham:(col)=>canvasTex(128,128,(g,w,h)=>{g.fillStyle='#ffffff';g.fillRect(0,0,w,h);g.globalAlpha=0.5;g.fillStyle=col;
    for(let i=0;i<4;i++){g.fillRect(i*32,0,16,h);g.fillRect(0,i*32,w,16)}}),
  screen:()=>canvasTex(256,192,(g,w,h)=>{g.fillStyle='#ffe6ee';g.fillRect(0,0,w,h);g.fillStyle='#f48fb1';g.fillRect(0,0,w,30);
    g.fillStyle='#ffffff';for(let i=0;i<3;i++){g.beginPath();g.arc(w-20-i*22,15,7,0,7);g.fill()}
    g.fillStyle='#f6a6c1';g.beginPath();g.moveTo(80,120);g.bezierCurveTo(40,90,50,55,80,72);g.bezierCurveTo(110,55,120,90,80,120);g.fill();
    g.fillStyle='#d9a9f2';for(let i=0;i<4;i++){g.fillRect(140,60+i*24,i%2?70:90,12)}}),
  poster:()=>canvasTex(384,150,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#cfe4ff');gr.addColorStop(1,'#ffd9ea');g.fillStyle=gr;g.fillRect(0,0,w,h);
    ['#ff9fb8','#ffd27a','#a8e6b4','#a9c8ff','#cdb0f0'].forEach((c,i)=>{g.strokeStyle=c;g.lineWidth=11;g.beginPath();g.arc(w/2,h+20,120-i*11,Math.PI,0);g.stroke()});
    g.fillStyle='#ffffff';for(const[x,y]of[[70,95],[314,95]])for(const[dx,dy,r]of[[0,0,22],[22,6,18],[-22,6,18],[10,-12,16]]){g.beginPath();g.arc(x+dx,y+dy,r,0,7);g.fill()}
    g.fillStyle='#ffd23f';for(const[x,y]of[[40,30],[190,22],[340,36],[120,40],[260,28]]){g.beginPath();for(let k=0;k<10;k++){const r=k%2?4:10,a=k*Math.PI/5-Math.PI/2;g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}g.fill()}})};

function genRoom(R,cfg){
  const cx=cfg.cx,T=BEDROOM_THEMES.pastel,BR={metalness:0.75,roughness:0.28};
  const F=6.6,wt=0.3,Hw=3.0,pw=0.55;
  box(F+1.2,0.3,F+1.2,T.base,V(0,0.15,0),Q(),{static:true,r:0.1});const y0=0.3;
  const floor=box(F,0.3,F,shade(T.floor[1],0.85),V(0,y0+0.15,0),Q(),{faces:['+y']});
  // floor planks run front to back, so each keeps a screw at the open front edge
  plankFace(floor,'+y',{dir:'v',w:0.55,cols:T.floor});
  const y1=y0+0.3+PT,zi=-F/2+wt+PT,xi=-F/2+wt+PT,yc=y1+Hw/2;
  const back=box(F,Hw,wt,T.outer,V(0,yc,-F/2+wt/2),Q(),{faces:['+z','-z']});
  const lz0=zi,lLen=F/2-lz0,lzc=lz0+lLen/2,left=box(wt,Hw,lLen,T.outer,V(-F/2+wt/2,yc,lzc),Q(),{faces:['+x','-x']});
  plankFace(back,'+z',{dir:'v',w:pw,cols:T.wall});plankFace(left,'+x',{dir:'v',w:pw,cols:T.wall});
  const oc=[T.outer,shade(T.outer,0.93)];plankFace(back,'-z',{dir:'h',w:0.62,cols:oc});plankFace(left,'-x',{dir:'h',w:0.62,cols:oc});
  box(PT,Hw,wt+2*PT,T.trim,V(-F/2-PT/2,yc,-F/2+wt/2),Q(),{faces:['-x','-z']});
  onFace(back,'+y',0,0,F,wt+2*PT,0.14,T.trim);onFace(left,'+y',0,0,wt+2*PT,lLen,0.14,T.trim);
  // panel grid: back wall panel k starts at bx(k), left wall panel k at lz(k); wall panel screws sit 0.4, 1.5 and 2.6 above the floor
  const nL=Math.round(lLen/pw),pl=lLen/nL,bx=k=>-F/2+pw*k,lz=k=>lz0+pl*k,wy=y=>y-Hw/2,la=z=>-(z-lzc),bkZ=wt/2+PT;

  // lockers in the back corner (panels 1-2), with vents, handles and a string of pearls
  const lk=box(2*pw,2.0,0.6,T.locker,V(bx(2),y1+1.0,zi+0.3),Q(),{faces:['+y','+x']});
  for(const s of[-1,1]){const dr=onFace(lk,'+z',s*pw/2,0,pw-0.05,1.92,0.14,T.door);
    for(let i=0;i<4;i++)deco(dr,new THREE.BoxGeometry(0.3,0.035,0.02),shade(T.locker,0.72),0,0.28-i*0.08,0.075);
    deco(dr,new THREE.BoxGeometry(0.05,0.2,0.05),T.brass,-s*0.16,-0.25,0.09,{mat:BR})}
  beads(lk,sag(V(-0.5,0.32,0.47),V(0.5,0.32,0.47),0.22,22),0.035,['#ffffff']);

  // window between two curtains on a brass rod (panels 3-6), strings of beads hanging in it
  win(back,'+z',bx(5),wy(1.675),2*pw,1.35,PT,{accent:T.frame},{frame:T.frame});
  deco(back,new THREE.CylinderGeometry(0.035,0.035,4*pw+0.5,10),T.brass,bx(5),wy(2.97),bkZ+0.22,{mat:BR,rot:[0,0,Math.PI/2]});
  for(const s of[-1,1])deco(back,new THREE.SphereGeometry(0.06,12,10),T.brass,bx(5)+s*(2*pw+0.25),wy(2.97),bkZ+0.22,{mat:BR});
  for(const s of[-1,1]){const x=bx(5)+s*0.13,n=11,pts=[];for(let i=0;i<n;i++)pts.push(V(x,wy(2.92)-i*0.08,bkZ+0.32));
    beads(back,pts,0.03,s<0?['#f8bccc','#ffffff','#d9a9f2']:['#ffffff','#f5c84c','#8fd3e8']);
    deco(back,s<0?heartGeo(0.16,0.05):new THREE.TorusGeometry(0.07,0.018,8,20),T.brass,x,wy(2.92)-n*0.08-0.04,bkZ+0.32,{mat:BR})}
  if(cx>0.2)for(const k of[3,6]){const c=onFace(back,'+z',bx(k)+pw/2,wy(1.9),pw,1.9,0.14,T.curtain,{gap:PT,noAnchor:true});reskin(c,pleatGeo(pw+0.1,1.9,0.16))}

  // desk under the window, with a drawer unit, a bunny-eared computer and a stack of books
  const dX0=-1.5,dX1=0.4,dxc=(dX0+dX1)/2,dD=0.85,dzc=zi+0.15+dD/2,dT=0.9;
  const desk=box(dX1-dX0,0.1,dD,T.desk,V(dxc,y1+dT-0.05,dzc),Q(),{faces:['+y']});
  for(const[lx,lz2]of[[-0.88,-0.36],[-0.88,0.36],[0.88,-0.36],[0.88,0.36]])deco(desk,new THREE.CylinderGeometry(0.035,0.035,dT-0.1,8),T.leg,lx,-(dT-0.1)/2-0.05,lz2);
  const un=box(0.6,0.72,0.75,T.desk,V(dX1-0.35,y1+0.36,dzc),Q(),{faces:['+x']});
  const df=onFace(un,'+z',0,0,0.52,0.64,0.14,T.drawer);deco(df,new THREE.SphereGeometry(0.04,10,8),T.knob,0,-0.25,0.08);
  const pcb=onFace(desk,'+y',0.62,0,0.8,0.45,0.22,T.pcBase,{faces:['+z']});
  deco(pcb,new THREE.BoxGeometry(0.14,0.03,0.02),shade(T.pcBase,0.55),0.28,0.03,0.23);
  ['#9be0b0','#f48fb1'].forEach((c,i)=>deco(pcb,new THREE.SphereGeometry(0.025,10,8),c,-0.26-i*0.07,0,0.23));
  const mon=onFace(pcb,'+y',0,0,0.72,0.4,0.6,T.pc,{faces:['+x']});reskin(mon,roundedBoxGeo(0.72,0.6,0.4,0.12));
  deco(mon,new THREE.PlaneGeometry(0.5,0.38),'#ffffff',0,0.02,0.202,{mat:{map:BEDROOM_TEX.screen(),roughness:0.3},shadow:false});
  for(const s of[-1,1]){deco(mon,ell(0.075,0.24,0.045),T.pc,s*0.16,0.47,-0.04,{rot:[0,0,-s*0.18]});deco(mon,ell(0.04,0.17,0.02),'#ffffff',s*0.165,0.46,0.0,{rot:[0,0,-s*0.18]})}
  deco(desk,new THREE.BoxGeometry(0.62,0.05,0.18),T.pcBase,0.62,0.075,0.32);
  boxSet(desk,Array.from({length:12},(_,i)=>({x:0.62-0.25+(i%6)*0.1,y:0.105,z:0.29+Math.floor(i/6)*0.07,w:0.07,h:0.02,d:0.05,c:i%5?'#ffffff':'#f48fb1'})));
  const bk1=onFace(desk,'+y',-0.62,0,0.62,0.45,0.14,T.books[0]),bk2=onFace(bk1,'+y',0.02,0,0.54,0.4,0.14,T.books[2]);
  for(const b of[bk1,bk2])deco(b,new THREE.BoxGeometry(0.02,0.1,b===bk1?0.41:0.36),'#ffffff',b===bk1?0.31:0.27,0,0);

  // bed against the back wall (panels 7-10): headboard, frame on legs, mattress, quilted duvet, pillows
  const bW=4*pw,bxc=bx(7)+bW/2,bL=2.8,bzc=zi+0.2+bL/2,legH=0.25,bH=0.35;
  const hb=box(bW,1.75,0.2,T.bed,V(bxc,y1+0.875,zi+0.1),Q(),{faces:['+y','+z']});
  reskin(hb,roundedBoxGeo(bW,1.75,0.2,0.1));
  for(const s of[-1,1])deco(hb,new THREE.SphereGeometry(0.12,16,12),T.brass,s*(bW/2-0.1),0.875+0.07,0,{mat:BR});
  const base=box(bW-0.1,bH,bL,T.bed,V(bxc,y1+legH+bH/2,bzc),Q(),{faces:['+x','+z']});
  for(const[lx,lz2]of[[-1,-1],[-1,1],[1,-1],[1,1]])deco(base,new THREE.CylinderGeometry(0.06,0.05,legH,12),T.bed,lx*(bW/2-0.2),-bH/2-legH/2,lz2*(bL/2-0.15));
  const mt=onFace(base,'+y',0,0,2.0,2.7,0.3,T.mattress);
  const du=onFace(mt,'+y',0,-0.35,2.06,2.0,0.24,T.duvet);reskin(du,quiltGeo(2.06,0.24,2.0,4,4));
  for(const s of[-1,1])deco(du,puffGeo(0.16,0.44,2.0,0.6,0.6),T.duvet,s*1.04,-0.18,0);
  deco(du,puffGeo(2.24,0.44,0.16,0.6,0.6),T.duvet,0,-0.18,1.04);
  [-1,1].forEach((s,i)=>{const pi=onFace(mt,'+y',s*0.5,0.95,0.9,0.55,0.28,T.pillow);reskin(pi,puffGeo(0.92,0.28,0.56,0.45,0.7),i?null:{map:BEDROOM_TEX.gingham(T.gingham)})});
  if(cx>0.7){const ht=onFace(du,'+y',0.7,-0.67,0.5,0.5,0.16,T.gingham);reskin(ht,heartGeo(0.5,0.16).rotateX(-Math.PI/2))}
  beads(back,sag(V(bx(7)+0.15,wy(2.95),bkZ+0.06),V(bx(11)-0.15,wy(2.95),bkZ+0.06),0.1,30),0.045,T.beads);

  // nightstand with a lamp (panel 11). It covers the panel screw 0.4 up, so its own screws stay 0.42 away from that one: no side screw, the drawer high, the lamp forward
  if(cx>0.35){const ns=box(pw,0.75,0.4,T.dresser,V(bx(11)+pw/2,y1+0.375,zi+0.2),Q(),{faces:[]});
    const nd=onFace(ns,'+z',0,0.2,0.45,0.3,0.14,T.drawer);deco(nd,new THREE.SphereGeometry(0.035,10,8),T.knob,0,-0.1,0.08);
    const lh=0.36,lamp=addPart(new THREE.CylinderGeometry(0.15,0.24,0.26,28).translate(0,lh/2-0.13,0),'#fff3c4',V(bx(11)+pw/2,y1+0.75+lh/2,zi+0.25),Q(),
      {proxy:new THREE.CylinderGeometry(0.2,0.2,lh,12),mat:{emissive:'#ffe9a8',emissiveIntensity:0.35}});
    faceSlot(ns,'+y',0,-0.05,true);addSlot(lamp,V(0,lh/2,0),UPV);
    deco(lamp,new THREE.CylinderGeometry(0.025,0.025,lh-0.26,8),T.brass,0,-0.13,0,{mat:BR});deco(lamp,new THREE.CylinderGeometry(0.16,0.18,0.05,24),T.brass,0,-lh/2+0.025,0,{mat:BR})}

  // a low dresser against the left wall (panels 4-6), low enough that the screws of what stands on it keep clear of the wall's, a poster above it
  if(cx>0.35){const dzc2=lz(4)+1.5*pl,dr=box(0.7,0.85,3*pl,T.dresser,V(xi+0.35,y1+0.425,dzc2),Q(),{faces:['+y','+z']});
    // the top drawer has two screws and the bottom one a single screw between them, so they stay 0.52 apart
    const dt=onFace(dr,'+x',0,0.2,3*pl-0.12,0.36,0.14,T.drawer),db=onFace(dr,'+x',0,-0.2,3*pl-0.12,0.36,0.14,T.drawer,{faces:[]});faceSlot(db,'+x',0,0);
    deco(dt,new THREE.SphereGeometry(0.045,12,10),T.knob,0.09,0,0);for(const s of[-1,1])deco(db,new THREE.SphereGeometry(0.045,12,10),T.knob,0.09,0,s*0.445);
    const jar=cyl(0.2,0.3,'#ffc7d6',V(xi+0.35,y1+0.85+0.15,dzc2+0.5),Q(),{side:false,mat:{roughness:0.15}});
    deco(jar,new THREE.CylinderGeometry(0.205,0.205,0.06,24),T.brass,0,0.08,0,{mat:BR});
    const jb=box(0.4,0.22,0.42,T.gingham,V(xi+0.35,y1+0.85+0.11,dzc2-0.5),Q(),{faces:['+y']});
    deco(jb,new THREE.BoxGeometry(0.41,0.05,0.43),T.brass,0,0.05,0,{mat:BR});deco(jb,new THREE.BoxGeometry(0.03,0.08,0.08),T.brass,0.21,0,0,{mat:BR});
    if(cx>0.5){const po=onFace(left,'+x',la(dzc2),wy(2.525),3*pl,0.65,0.14,T.frame,{gap:PT,noAnchor:true});
      deco(po,new THREE.PlaneGeometry(3*pl-0.1,0.55),'#ffffff',0.072,0,0,{rot:[0,Math.PI/2,0],mat:{map:BEDROOM_TEX.poster()},shadow:false})}}

  // open bookcase (panels 8-10) full of books, a piggy bank and a music box on top. Its screws sit 0.42 out from the wall,
  // clear of the wall screws it covers
  if(cx>0.5){const bcz=lz(8)+1.5*pl,bh=1.7,bc=box(0.6,bh,3*pl,T.shelf,V(xi+0.3,y1+bh/2,bcz),Q(),{faces:[]});reskin(bc,shelfGeo(0.6,bh,3*pl,2));
    for(const b of[-0.5,0.5])faceSlot(bc,'+y',0.12,b);for(const b of[-0.52,0.52])faceSlot(bc,'+z',0.12,b);
    const list=[];for(const cy of[-bh/4,bh/4]){let z=-1.5*pl+0.08;const ch=bh/2-0.06,y0b=cy-ch/2+0.03;
      while(z<1.5*pl-0.2){const w=R.f(0.07,0.12),h=ch*R.f(0.6,0.88);if(R.chance(0.12)){z+=0.1;continue}list.push({x:0.07,y:y0b+h/2,z:z+w/2,w:0.34,h,d:w,c:R.pick(T.books)});z+=w+0.012}}
    boxSet(bc,list);
    const pig=addPart(ell(0.22,0.15,0.17),T.gingham,V(xi+0.42,y1+bh+0.17,bcz+0.5),Q(),{proxy:new THREE.BoxGeometry(0.36,0.34,0.4)});pig.mesh.geometry.translate(0,0.01,0);addSlot(pig,V(-0.04,0.155,0),UPV);
    deco(pig,new THREE.CylinderGeometry(0.06,0.065,0.06,16),shade(T.gingham,1.12),0.22,0.02,0,{rot:[0,0,Math.PI/2]});
    for(const s of[-1,1]){deco(pig,new THREE.ConeGeometry(0.045,0.08,10),T.gingham,0.12,0.15,s*0.08,{rot:[s*0.4,0,-0.3]});deco(pig,new THREE.SphereGeometry(0.018,8,6),'#2b2633',0.19,0.07,s*0.05)}
    for(const[lx,lz2]of[[-1,-1],[-1,1],[1,-1],[1,1]])deco(pig,new THREE.CylinderGeometry(0.035,0.035,0.08,10),T.gingham,lx*0.1,-0.14,lz2*0.08);
    const mb=box(0.36,0.22,0.4,T.brass,V(xi+0.42,y1+bh+0.11,bcz-0.5),Q(),{faces:['+y'],mat:BR});
    deco(mb,new THREE.BoxGeometry(0.37,0.05,0.41),T.gingham,0,0.02,0)}

  // round rug with a cat asleep in its basket
  const rx=0.0,rz=1.5,rug=cyl(1.1,0.14,T.rug,V(rx,y1+0.07,rz),Q(),{side:false,seg:56});
  for(const r0 of[0.95,0.3])deco(rug,new THREE.TorusGeometry(r0,0.05,6,56),shade(T.rug,1.1),0,0.07,0,{rot:[Math.PI/2,0,0],scale:[1,1,0.35],shadow:false});
  if(cx>0.2){const a=0.5,cbx=rx+Math.cos(a)*0.605,cbz=rz+Math.sin(a)*0.605,cbTop=y1+0.14+0.24;
    const cb=cyl(0.45,0.24,T.catBed,V(cbx,y1+0.14+0.12,cbz),Q(),{side:false});
    deco(cb,new THREE.TorusGeometry(0.39,0.1,12,36),shade(T.catBed,1.12),0,0.1,0,{rot:[Math.PI/2,0,0]});
    const cat=addPart(ell(0.27,0.15,0.19).translate(0,-0.03,0),T.cat,V(cbx,cbTop+0.18,cbz),eul(0,R.f(-0.9,0.1),0),{proxy:new THREE.BoxGeometry(0.62,0.36,0.42),mat:{roughness:0.45}});
    addSlot(cat,V(-0.1,0.11,0),UPV);
    deco(cat,new THREE.SphereGeometry(0.14,20,14),T.cat,0.24,0.04,0,{mat:{roughness:0.45}});
    for(const s of[-1,1]){deco(cat,new THREE.ConeGeometry(0.055,0.12,12),T.cat,0.25,0.17,s*0.08,{rot:[s*0.35,0,-0.15]});
      deco(cat,new THREE.SphereGeometry(0.024,10,8),'#8fd3e8',0.36,0.07,s*0.055);deco(cat,new THREE.SphereGeometry(0.045,10,8),T.cat,0.28,-0.13,s*0.1)}
    deco(cat,new THREE.TorusGeometry(0.035,0.012,6,16,Math.PI*1.2),T.brass,0.37,0.13,0,{rot:[0,Math.PI/2,0.6],mat:BR});
    deco(cat,new THREE.TorusGeometry(0.11,0.022,8,24),T.leg,0.16,0.0,0,{rot:[0,Math.PI/2,0.5]});
    deco(cat,new THREE.TorusGeometry(0.17,0.035,8,24,Math.PI*1.1),T.cat,-0.12,-0.13,0.05,{rot:[Math.PI/2,0,0.6]})}

  // a pouf at the desk
  if(cx>0.5){const pf=cyl(0.28,0.4,T.leg,V(dxc-0.3,y1+0.2,zi+1.4),Q(),{side:false});reskin(pf,puffGeo(0.56,0.4,0.56,0.6,0.5));
    cyl(0.3,0.14,T.desk,V(dxc-0.3,y1+0.4+0.07,zi+1.4),Q(),{side:false})}

  // outside: a pink pipe with brass rings along the back wall, bending down at the corner
  if(cx>0.7){const Yp=2.1,pz=-F/2-PT-0.22,pp=onFace(back,'-z',0,wy(Yp),F,0.44,0.44,T.pipe,{gap:PT,noAnchor:true,faces:['-z']});
    reskin(pp,new THREE.CylinderGeometry(0.22,0.22,F,32).rotateZ(Math.PI/2));
    for(const x of[-F/2+0.12,-1.45,1.45])deco(pp,new THREE.CylinderGeometry(0.255,0.255,0.16,32),T.brass,x,0,0,{mat:BR,rot:[0,0,Math.PI/2]});
    const eR=0.3,dpTop=y1+Yp-eR,dh=dpTop-0.3,dp=box(0.44,dh,0.44,T.pipe,V(F/2+eR,0.3+dh/2,pz),Q(),{faces:['+x']});
    reskin(dp,new THREE.CylinderGeometry(0.22,0.22,dh,32));
    deco(dp,new THREE.TorusGeometry(eR,0.22,20,24,Math.PI/2),T.brass,-eR,dh/2,0,{mat:BR});
    for(const y of[0,-dh/2+0.12])deco(dp,new THREE.CylinderGeometry(0.255,0.255,0.16,32),T.brass,0,y,0,{mat:BR})}

  // a suitcase on the floor and a plant in the front corner
  if(cx>0.7){const sc=box(0.95,0.34,0.72,T.suitcase,V(2.2,y1+0.17,1.45),eul(0,0.3,0),{faces:['+y','+x']});
    deco(sc,new THREE.BoxGeometry(0.97,0.08,0.74),shade(T.suitcase,1.15),0,0,0);
    deco(sc,new THREE.TorusGeometry(0.1,0.025,8,16,Math.PI),'#b48ae0',0,0,0.37,{rot:[Math.PI/2,0,0]});
    const pot=cyl(0.3,0.66,T.pot,V(3.0,y1+0.33,2.95),Q(),{top:false,sideN:3,phase:0.3});
    deco(pot,new THREE.TorusGeometry(0.3,0.04,8,28),shade(T.pot,0.9),0,0.33,0,{rot:[Math.PI/2,0,0]});
    for(let k=0;k<7;k++){const a=k/7*Math.PI*2,t=0.35+(k%3)*0.12;deco(pot,ell(0.07,0.26,0.035),T.leaf,Math.cos(a)*0.1,0.54+t*0.3,Math.sin(a)*0.1,{rot:[Math.sin(a)*t,0,-Math.cos(a)*t]})}}
}
model('room','rooms',genRoom);

function genKitchen(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal)),SIL='#d9dee6',DKG='#4d5560';
  const F=R.f(5.6,6.2),wt=0.3,Hw=3.2;
  box(F+0.6,0.3,F+0.6,'#8a6f55',V(0,0.15,0),Q(),{static:true,r:0.05});const y0=0.3;
  const floor=box(F,0.3,F,'#b9b3a3',V(0,y0+0.15,0),Q(),{faces:['+y']});
  plankFace(floor,'+y',{dir:'h',w:0.55,cols:['#ece6d8','#d8d1c0']});
  const y1=y0+0.3+PT,zi=-F/2+wt+PT,xi=-F/2+wt+PT;
  const back=box(F,Hw,wt,pal.main,V(0,y1+Hw/2,-F/2+wt/2),Q(),{faces:['+z']});
  const lz0=zi,lLen=F/2-lz0,left=box(wt,Hw,lLen,pal.main,V(-F/2+wt/2,y1+Hw/2,lz0+lLen/2),Q(),{faces:['+x']});
  const wp=[pal.light,shade(pal.light,0.93)];
  plankFace(back,'+z',{dir:'v',w:0.55,cols:wp});plankFace(left,'+x',{dir:'v',w:0.55,cols:wp});
  box(PT,Hw,wt+2*PT,pal.trim,V(-F/2-PT/2,y1+Hw/2,-F/2+wt/2),Q(),{faces:['-x','-z']});
  onFace(back,'+y',0,0,F,wt+2*PT,0.14,pal.trim);onFace(left,'+y',0,0,wt+2*PT,lLen,0.14,pal.trim);
  // everything on the back wall is as wide as two wall panels and starts on a panel edge, so it covers whole panels' screws and never half of one.
  // The panels' screws sit in three rows (0.4, 1.7 and 2.8 above the floor): base units cover the lowest, the fridge the lowest two, upper units the top one
  const nP=Math.round(F/0.55),pw=F/nP,k0=3,uw=2*pw-0.04,nU=Math.floor((nP-k0)/2),zc=zi+0.45;
  const kinds=nU>=4?['cab','stove','cab','fridge']:['cab','stove','fridge'];
  kinds.forEach((kind,i)=>{
    const xc=-F/2+pw*(k0+2*i+1),UH=1.0;
    if(kind==='fridge'){
      const fr=box(uw,2.3,0.9,'#8d929c',V(xc,y1+1.15,zc),Q(),{faces:['+z','+y']});
      const lo=onFace(fr,'+z',0,-0.42,1.0,1.46,0.14,'#e9edf2'),up=onFace(fr,'+z',0,0.75,1.0,0.8,0.14,'#e9edf2');
      if(cx>0.3)onFace(lo,'+z',0.17,0,0.3,1.2,0.14,DKG);
      if(cx>0.3)onFace(up,'+z',0,0,0.7,0.34,0.14,DKG);
      if(cx>0.6)onFace(fr,'+y',0,0,0.9,0.7,0.3,acc.main);
      return}
    const core=box(uw,UH,0.9,kind==='stove'?'#9aa6b5':'#b08968',V(xc,y1+UH/2,zc),Q(),{faces:['+z','+y']});
    if(kind==='cab'){
      if(cx>0.15)for(const s of[-1,1]){const dr=onFace(core,'+z',s*0.27,0,0.5,0.86,0.14,i?pal.main:acc.main);if(cx>0.45)onFace(dr,'+z',0,0,0.3,0.3,0.14,SIL)}
      else onFace(core,'+z',0,0,1.0,0.86,0.14,pal.main);
      const sl=onFace(core,'+y',0,0,uw+0.08,0.9,0.16,'#e8e2d4');
      if(cx>0.25){const bd=onFace(sl,'+y',0,0,1.0,0.7,0.14,WOOD[0]);
        if(cx>0.5)cyl(0.4,0.3,acc.light,V(xc,y1+UH+0.16+0.14+0.15,zc),Q(),{side:false})}
      // an upper unit above it: a door over its front screws and a handle plate over the door's
      if(cx>0.3){const uc=onFace(back,'+z',xc,1.2,uw,0.8,0.5,WOOD[1],{gap:PT,noAnchor:true}),dr=onFace(uc,'+z',0,0,1.0,0.7,0.14,i?acc.light:pal.light);
        if(cx>0.55)onFace(dr,'+z',0,0,0.7,0.3,0.14,SIL)}}
    else{
      const od=onFace(core,'+z',0,0,0.96,0.76,0.14,'#4d5560');if(cx>0.15)onFace(od,'+z',0,0,0.5,0.4,0.14,'#17212e');
      const hb=onFace(core,'+y',0,0,uw+0.04,0.9,0.16,'#2d3138',{faces:[]});faceSlot(hb,'+y',0,0);
      const br=cyl(0.3,0.14,'#6b7280',V(xc,y1+UH+0.16+0.07,zc),Q(),{side:false});
      for(const s of[-1,1]){const rg=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.03,6,16),partMat('#6b7280'));rg.rotation.x=Math.PI/2;rg.position.set(s*0.36,0.12,0.0);decor(hb,rg)}
      if(cx>0.4){const pn=cyl(0.42,0.22,'#4d5560',V(xc,y1+UH+0.16+0.14+0.11,zc),Q(),{side:false});
        const hd=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.06,0.08),partMat('#2d3138'));hd.position.set(0.6,0.04,0.2);hd.rotation.y=0.4;decor(pn,hd)}
      if(cx>0.7)cyl(0.46,0.14,'#c9ccd3',V(xc,y1+UH+0.16+0.14+0.22+0.07,zc),Q(),{side:false});
      if(cx>0.3){const hd=onFace(back,'+z',xc,1.2,uw,0.8,0.7,SIL,{gap:PT,noAnchor:true});onFace(hd,'+z',0,0,0.9,0.4,0.14,DKG)}}
  });
  // table with a runner and a centrepiece, two chairs and a rug
  const xt=0.4,zt=Math.min(zi+3.0,F/2-0.9);
  if(cx>0.4)box(2.6,0.14,1.8,acc.light,V(xt,y1+0.07,zt),Q(),{faces:['+y']});
  const tb=box(1.7,0.14,1.1,WOOD[2],V(xt,y1+0.88,zt),Q(),{faces:['+y']});
  for(const[lx,lz]of[[-0.75,-0.45],[0.75,-0.45],[-0.75,0.45],[0.75,0.45]]){const lg=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.82,0.1),partMat(shade(WOOD[2],0.75)));lg.position.set(lx,-0.48,lz);decor(tb,lg)}
  const rn=onFace(tb,'+y',0,0,1.5,0.8,0.14,acc.light);
  if(cx>0.5){const cp=onFace(rn,'+y',0,0,1.3,0.5,0.14,acc.dark);if(cx>0.8){const vs=cyl(0.52,0.4,acc.main,V(xt,y1+0.95+0.14+0.14+0.2,zt),Q(),{side:false});for(let k=0;k<5;k++){const lf=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),partMat('#5fb760'));lf.position.set(Math.cos(k*1.26)*0.18,0.5+(k%2)*0.12,Math.sin(k*1.26)*0.18);decor(vs,lf)}}}
  for(const s of cx>0.2?[-1,1]:[1]){const cxp=xt+s*1.3,seat=box(0.6,0.12,0.6,acc.main,V(cxp,y1+0.5,zt),Q(),{faces:['+y']});
    for(const[lx,lz]of[[-0.25,-0.25],[0.25,-0.25],[-0.25,0.25],[0.25,0.25]]){const lg=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.44,0.06),partMat('#5b4a44'));lg.position.set(lx,-0.28,lz);decor(seat,lg)}
    box(0.14,0.75,0.6,acc.dark,V(cxp+s*0.37,y1+0.95,zt),Q(),{faces:[s>0?'+x':'-x','+y']});
    if(cx>0.45)onFace(seat,'+y',0,0,0.5,0.5,0.14,acc.light)}
  // a pan rail on the left wall, spanning whole panels at the top row, with pans hanging from it
  if(cx>0.35){const nL=Math.round(lLen/0.55),pl=lLen/nL,u=-lLen/2+pl*(1+1.5),rl=onFace(left,'+x',u,1.2,3*pl,0.5,0.4,DKG,{gap:PT,noAnchor:true});
    for(let i=0;i<3;i++){const pn=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.06,18),partMat(i%2?'#9aa6b5':'#c9ccd3',{metalness:.3}));pn.rotation.z=Math.PI/2;pn.position.set(0.28,-0.5,(i-1)*pl*0.9);decor(rl,pn)}}
}
model('kitchen','rooms',genKitchen);
