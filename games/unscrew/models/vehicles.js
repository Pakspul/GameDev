// Unscrew 3D models: vehicles.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

function genCamper(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal)),CR='#f4f1ea',FR='#3d4450',TY='#2d3138';
  const L=R.f(4.3,4.7),Wd=R.f(1.95,2.05),H=R.f(1.85,1.95),wr=0.38,y0=0.3,yb=y0+2*wr+0.02;
  const ground=box(L+4.6,0.3,Wd+5.6,'#b9d39a',V(0,0.15,0),Q(),{static:true,r:0.06});
  const road=new THREE.Mesh(new THREE.BoxGeometry(L+4.6,0.02,Wd+1.4),partMat('#8d929c'));road.position.y=0.16;decor(ground,road);
  for(let i=-2;i<=2;i++){const ln=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.02,0.1),partMat('#f4f1ea'));ln.position.set(i*1.5,0.17,-Wd/2-0.45);decor(ground,ln)}
  // wheels sit fully under the body, so they never cover a body panel; their one screw faces outward
  for(const sx of[-1,1])for(const sz of[-1,1]){const w=cyl(wr,0.36,TY,V(sx*(L/2-0.85),y0+wr,sz*(Wd/2-0.1)),eul(sz*Math.PI/2,0,0),{side:false});
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.04,20),partMat('#d9dee6',{metalness:.4,roughness:.35}));hub.position.y=0.19;decor(w,hub)}
  // body: a core with three bands of panels (two in the body colour, cream on top), 0.62 high so screws stay 0.52 apart
  const core=box(L,H,Wd,'#5b6270',V(0,yb+H/2,0),Q(),{faces:['+x','-x','+z','-z']});
  const chassis=new THREE.Mesh(new THREE.BoxGeometry(L-0.5,0.3,Wd-0.5),partMat('#3d4450'));chassis.position.y=-H/2-0.15;decor(core,chassis);
  const bands=[pal.main,shade(pal.main,0.93),CR];
  for(const f of['+z','-z'])plankFace(core,f,{w:0.62,cols:bands});
  for(const f of['+x','-x'])plankFace(core,f,{w:0.62,cols:bands,ext:2*PT});
  // windows, doors and lights are centred on the panel screws (axisOffs), so each one fully covers a screw or misses it
  const pw=H/3,b0=-H/2+pw/2,b1=0,bt=H/2-pw/2,cols=axisOffs(L),cab=cols[2],ends=axisOffs(Wd+2*PT)[1];
  for(const f of['+z','-z']){const s=f==='+z'?1:-1; // on -z the u axis runs backwards, so the cab is at -cab
    win(core,f,s*cab,bt,0.8,pw-0.12,PT,pal,{frame:FR});
    if(cx>0.2)win(core,f,0,bt,1.1,pw-0.12,PT,pal,{frame:FR});
    if(cx>0.5)win(core,f,-s*cab,bt,0.9,pw-0.12,PT,pal,{frame:FR});
    if(cx>0.3){const cd=onFace(core,f,s*cab,(b0+b1)/2,0.85,2*pw-0.1,0.14,shade(pal.main,0.85),{gap:PT});
      const hd=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.05,0.05),partMat('#d9dee6',{metalness:.5}));hd.position.set(-s*0.25,0.2,0.09);decor(cd,hd)}}
  const sd=onFace(core,'+z',0,(b0+b1)/2,1.1,2*pw-0.1,0.14,pal.main,{gap:PT});
  const sh=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.3,0.05),partMat('#d9dee6',{metalness:.5}));sh.position.set(-0.42,0.15,0.09);decor(sd,sh);
  if(cx>0.6)onFace(core,'-z',0,b1,0.6,0.4,0.14,'#c9ccd3',{gap:PT});
  // front: wide windscreen, headlights, grille; back: window, tail lights, spare wheel
  win(core,'+x',0,bt,2.0,pw-0.12,PT,pal,{frame:FR});
  for(const s of[-1,1]){const hl=cyl(0.21,0.16,'#fff6d6',V(L/2+PT+0.08,yb+H/2+b0,s*ends),eul(0,0,-Math.PI/2),{side:false,mat:{emissive:srgb('#fff2b0'),emissiveIntensity:.25}});
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.12,24),partMat('#d9dee6',{metalness:.4}));rim.position.y=-0.03;decor(hl,rim)}
  onFace(core,'+x',0,b0,0.9,0.36,0.14,'#c9ccd3',{gap:PT,noAnchor:true});
  if(cx>0.4)onFace(core,'+x',0,b1,1.0,0.4,0.14,CR,{gap:PT,noAnchor:true});
  win(core,'-x',0,bt,1.2,pw-0.12,PT,pal,{frame:FR});
  for(const s of[-1,1])onFace(core,'-x',s*ends,b0,0.36,0.36,0.14,'#e8283a',{gap:PT,noAnchor:true});
  const sp=cyl(wr,0.22,TY,V(-(L/2+PT+0.11),yb+pw,0),eul(0,0,Math.PI/2),{side:false});
  const spc=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.03,20),partMat(acc.main));spc.position.y=0.115;decor(sp,spc);
  // bumpers hang below the lowest panel screws
  for(const s of[-1,1])box(0.3,0.3,Wd+0.2,'#c9ccd3',V(s*(L/2+PT+0.15),yb-0.05,0),Q(),{faces:[s>0?'+x':'-x','+y']});
  // roof, roof box and rails
  const roof=box(L+2*PT+0.1,0.2,Wd+2*PT+0.1,CR,V(0,yb+H+0.1,0),Q(),{faces:['+y']});
  if(cx>0.35)onFace(roof,'+y',-0.3,0,1.9,1.2,0.42,acc.main,{faces:['+y','+z','-z'],r:0.12});
  if(cx>0.65)for(const s of[-1,1])onFace(roof,'+y',0,s*(Wd/2-0.05),L*0.85,0.16,0.16,'#5b6270',{noAnchor:true});
  // awning over the sliding door, held up by two poles; it hangs above the window screws
  if(cx>0.55){const aw=box(2.2,0.1,1.3,acc.light,V(0,yb+H-0.1,Wd/2+PT+0.72),eul(0.12,0,0),{faces:['+y']});
    for(let i=0;i<4;i++){const st=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.012,1.3),partMat(acc.main));st.position.set(-0.825+i*0.55,0.056,0);decor(aw,st)}
    const ph=yb+H-0.25-y0;for(const s of[-1,1]){const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,ph,8),partMat('#9aa6b5'));pole.position.set(s*1.0,-ph/2,0.6);decor(aw,pole)}}
  // camping table and two stools in front
  if(cx>0.85){const tz=Wd/2+2.0,tb=box(1.0,0.08,0.7,WOOD[0],V(0.2,y0+0.72,tz),Q(),{faces:['+y']});
    for(const[lx,lz]of[[-0.4,-0.27],[0.4,-0.27],[-0.4,0.27],[0.4,0.27]]){const lg=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.68,6),partMat('#9aa6b5'));lg.position.set(lx,-0.38,lz);decor(tb,lg)}
    for(const s of[-1,1]){const st=box(0.42,0.1,0.42,acc.main,V(0.2+s*0.95,y0+0.45,tz),Q(),{faces:['+y']});
      const lg=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.06,0.4,8),partMat('#9aa6b5'));lg.position.y=-0.24;decor(st,lg)}}
}
model('camper','vehicles',genCamper);

function genSteamTrain(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal)),y0=0.3,DK='#3d4450',BR='#c8a24a',MT='#9aa6b5';
  const nWag=cx>1.1?2:cx>0.5?1:0,gx0=3.3,gx1=(nWag?-7.4-(nWag-1)*2.8-1.6:-6.0)-0.3,len=gx0-gx1;
  const WZ=1.2; // the wheels stand clear of the bodies: a wheel closer than 0.13 to a panel would block its screws
  // a bed of ballast with two rails and sleepers
  const ground=box(len,0.3,5.0,'#b9b3a3',V((gx0+gx1)/2,0.15,0),Q(),{static:true,r:0.06});
  for(let x=gx1+0.4;x<gx0-0.4;x+=0.75){const s=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.07,3.0),partMat('#8a5a3b'));s.position.set(x-(gx0+gx1)/2,0.185,0);decor(ground,s)}
  for(const z of[-WZ,WZ]){const r=new THREE.Mesh(new THREE.BoxGeometry(len-0.2,0.1,0.14),partMat('#8d929c',{metalness:.4}));r.position.set(0,0.24,z);decor(ground,r)}
  const ay=y0+0.72,ft=ay+0.15;
  // walls of 0.62 panels: the side panels run past the rear corner instead of corner posts, whose screws would crowd out the rear panels
  const clad=(core,col)=>{plankFace(core,'-x',{w:0.62,color:col});for(const f of['+z','-z'])plankFace(core,f,{w:0.62,color:col,ext:2*PT})};
  const wheel=(x,z,sz,r,y)=>{const w=cyl(r,0.2,DK,V(x,y,z),eul(sz*Math.PI/2,0,0),{side:false});
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(r*0.4,r*0.4,0.04,16),partMat(BR,{metalness:.4}));hub.position.y=0.11;decor(w,hub);return w};
  // locomotive: frame, drivers with a connecting rod, then the boiler (a cylinder lying along x, clad above the waterline)
  const frame=box(5.4,0.5,1.5,DK,V(-0.3,ay-0.1,0),Q(),{faces:['+z','-z','+y']});
  const drv=cx>0.3?[-1.6,-0.2,1.2]:[-1.0,0.6];
  for(const x of drv)for(const sz of[-1,1]){const w=wheel(x,sz*WZ,sz,0.6,ay);
    if(x===drv[1]){const rod=new THREE.Mesh(new THREE.BoxGeometry(drv[drv.length-1]-drv[0]+0.3,0.1,0.12),partMat(MT,{metalness:.4}));rod.position.set(0,0.13,sz*0.25);decor(w,rod)}}
  const yb=ft+0.9,qb=eul(0,0,-Math.PI/2),keep=a=>Math.cos(a)<=0.31;
  const boiler=cyl(0.82,2.4,'#4d5560',V(-0.2,yb,0),qb,{top:false,sideN:8});
  cladCyl(boiler,8,{cols:[pal.dark,shade(pal.dark,0.9)],keep});
  for(const y of[-0.5,0.5]){const ring=new THREE.Mesh(new THREE.CylinderGeometry(0.82+PT+0.015,0.82+PT+0.015,0.1,32,1,true),partMat(BR,{metalness:.5,side:THREE.DoubleSide}));ring.position.y=y;decor(boiler,ring)}
  const sb=cyl(0.88,0.6,'#3d4450',V(1.3,yb,0),qb,{top:false,sideN:8});cladCyl(sb,8,{cols:['#2d3138','#3a3f48'],keep});
  const door=cyl(0.7,0.14,'#2d3138',V(1.6+0.07,yb,0),qb,{side:false});
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.2,14,10),partMat('#fff2b0',{emissive:srgb('#fff2b0'),emissiveIntensity:.5}));lamp.scale.x=0.6;lamp.position.y=0.1;decor(door,lamp);
  // chimney on the smokebox's top plate, dome and sand dome on the boiler's: each stands on one panel screw
  const chy=yb+0.88+PT-0.05;
  cyl(0.28,0.8,'#2d3138',V(1.3,chy+0.4,0),Q(),{side:false});cyl(0.42,0.14,'#2d3138',V(1.3,chy+0.87,0),Q(),{side:false});
  cyl(0.4,0.34,BR,V(-0.2,yb+0.82+PT-0.05+0.17,0),Q(),{side:false});
  if(cx>0.4)cyl(0.3,0.3,BR,V(0.6,yb+0.82+PT-0.05+0.15,0),Q(),{side:false});
  box(0.9,0.12,1.5,acc.main,V(2.9,ay-0.1,0),eul(0,0,0.5),{faces:['+y']});
  // cab: clad walls, side windows, and a roof that stays clear of the boiler's screws
  const cab=box(1.5,1.9,1.4,'#5b4a44',V(-2.15,ft+0.95,0),Q(),{faces:['+z','-z','-x']});
  clad(cab,pal.main);
  for(const f of['+z','-z'])win(cab,f,0,0,0.8,0.7,PT,pal); // clear of the side panels' screws, which sit 0.58 either side
  box(1.6,0.18,1.95,acc.dark,V(-2.25,ft+1.99,0),Q(),{faces:['+y']});
  // tender with a heap of coal; the coal is a few lumps, each with its own screws
  const tf=box(2.2,0.5,1.5,DK,V(-4.65,ay-0.25,0),Q(),{faces:['+z','-z']});
  for(const x of[-5.25,-4.05])for(const sz of[-1,1])wheel(x,sz*WZ,sz,0.45,ay-0.15);
  const tb=box(2.0,1.2,1.3,'#4d5560',V(-4.6,ay+0.6,0),Q(),{faces:['+z','-z','-x']});
  clad(tb,acc.main);
  for(const[x,z,r]of[[-4.15,-0.2,0.5],[-5.0,0.25,0.45]])blob(r,'#2d3138',V(x,ay+1.2+r*0.4,z),R,3);
  // optional wagons
  for(let i=0;i<nWag;i++){const xc=-7.4-i*2.8;
    box(2.6,0.5,1.5,DK,V(xc,ay-0.25,0),Q(),{faces:['+z','-z']});
    for(const x of[xc-0.7,xc+0.7])for(const sz of[-1,1])wheel(x,sz*WZ,sz,0.45,ay-0.15);
    const wb=box(2.4,1.5,1.3,'#5b4a44',V(xc,ay+0.75,0),Q(),{faces:['+z','-z','-x']});
    clad(wb,i%2?acc.light:pal.light);
    for(const f of['+z','-z'])for(const a of[-0.96,0.96])win(wb,f,a,0.375,0.5,0.62,PT,pal);
    box(2.6,0.18,1.7,acc.dark,V(xc,ay+1.59,0),Q(),{faces:['+y']})}
}
model('steamtrain','vehicles',genSteamTrain);

function genFireEngine(R,cfg){
  const cx=cfg.cx,RED=R.pick(['#d8473e','#e0493f','#cf3b3b']),WH='#f4f1ea',SIL='#c9ccd3',DK='#3d4450',TY='#2d3138',fpal={accent:'#2d3138'};
  const Wd=2.0,wr=0.5,y0=0.3,yb=y0+2*wr+0.02,bx=-1.0,BL=3.8,BH=2.1,kx=1.9,KL=2.0,KH=1.8,rows=[RED,shade(RED,0.92),WH];
  const ground=box(10.6,0.3,Wd+5.6,'#a8aeb8',V(0,0.15,0),Q(),{static:true,r:0.06});
  for(let i=-3;i<=3;i++){const ln=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.02,0.1),partMat('#f4f1ea'));ln.position.set(i*1.4,0.16,-Wd/2-0.8);decor(ground,ln)}
  for(const x of[1.9,-1.6])for(const sz of[-1,1]){const w=cyl(wr,0.36,TY,V(x,y0+wr,sz*(Wd/2-0.1)),eul(sz*Math.PI/2,0,0),{side:false});
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.04,20),partMat('#d9dee6',{metalness:.4,roughness:.35}));hub.position.y=0.19;decor(w,hub)}
  // the rear body and the cab are two cores clad with 0.62 panels (red, red, white on top)
  const body=box(BL,BH,Wd,'#5b3f3f',V(bx,yb+BH/2,0),Q(),{faces:[]}),cab=box(KL,KH,Wd,'#5b3f3f',V(kx,yb+KH/2,0),Q(),{faces:[]});
  const ch=new THREE.Mesh(new THREE.BoxGeometry(5.5,0.3,Wd-0.5),partMat(DK));ch.position.set(0.9-bx,-BH/2-0.15,0);decor(body,ch);
  for(const f of['+z','-z']){plankFace(body,f,{w:0.62,cols:rows});plankFace(cab,f,{w:0.62,cols:rows})}
  plankFace(body,'-x',{w:0.62,cols:rows});plankFace(cab,'+x',{w:0.62,cols:rows});
  // cab: a window over the top row of panels, a door plate over the middle row; the windscreen and the grille cover whole rows at the front
  for(const f of['+z','-z']){win(cab,f,0,0.6,1.75,0.5,PT,fpal);onFace(cab,f,0,0,1.75,0.5,0.14,SIL,{gap:PT})}
  win(cab,'+x',0,0.6,1.75,0.5,PT,fpal);onFace(cab,'+x',0,-0.6,1.75,0.5,0.14,SIL,{gap:PT});
  if(cx>0.5)for(const f of['+z','-z'])onFace(cab,f,0,-0.6,0.8,0.4,0.14,'#e6c13c',{gap:PT});
  // equipment lockers: tall roller shutters over the two lower rows of a column of panels, with a handle plate on each
  const cols=axisOffs(BL),nSh=cx>0.5?3:cx>0.2?2:1;
  for(const f of['+z','-z'])(nSh===3?cols:nSh===2?[cols[0],cols[2]]:[cols[1]]).forEach(a=>{
    const sh=onFace(body,f,a,-0.35,1.0,1.5,0.14,SIL,{gap:PT});
    for(let i=-3;i<=3;i++){const sl=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.03,0.02),partMat('#aab1bc'));sl.position.set(0,i*0.2-0.1,0.085);decor(sh,sl)}
    if(cx>0.6)onFace(sh,f,0,0.42,0.7,0.4,0.14,DK)});
  if(cx>0.8)for(const f of['+z','-z'])onFace(body,f,0,0.7,0.7,0.5,0.14,'#e6c13c',{gap:PT});
  // roof: a rack plate over all six screws of the roof, and a ladder whose two rails cover the plate's screws
  const roofB=box(BL+0.1,0.2,Wd+0.1,'#9aa6b5',V(bx,yb+BH+0.1,0),Q(),{faces:['+y']});
  const rack=onFace(roofB,'+y',0,0,3.6,1.8,0.18,SIL),ry=yb+BH+0.2+0.18;
  if(cx>0.25){const rails=[];for(const z of[-0.57,0.57]){const rl=box(3.2,0.14,0.34,'#d9dee6',V(bx,ry+0.07,z),Q(),{faces:[]});faceSlot(rl,'+y',0,0);rails.push(rl)}
    for(let i=-7;i<=7;i++){const rg=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.07,0.8),partMat('#d9dee6'));rg.position.set(i*0.21,0.1,0.57);decor(rails[0],rg)}}
  // cab roof, with a light bar on a plate-like base and a lamp over each of the bar's screws
  const kr=box(KL+0.1,0.2,Wd+0.1,'#9aa6b5',V(kx,yb+KH+0.1,0),Q(),{faces:[]});
  const bar=onFace(kr,'+y',0,0,0.7,1.7,0.22,DK);
  if(cx>0.2)for(const[z,c]of[[-0.52,'#1f7bff'],[0.52,'#e8283a']])cyl(0.2,0.22,c,V(kx,yb+KH+0.2+0.22+0.11,z),Q(),{side:false,mat:{emissive:srgb(c),emissiveIntensity:.35}});
  // front and back: bumpers, a hose reel between the rear columns of panels
  for(const[x,fc]of[[kx+KL/2+PT+0.15,'+x'],[bx-BL/2-PT-0.15,'-x']])box(0.3,0.3,Wd+0.2,SIL,V(x,yb-0.05,0),Q(),{faces:[fc,'+y']});
  if(cx>0.3){const hr=cyl(0.5,0.3,'#2d3138',V(bx-BL/2-PT-0.15,yb+BH/2,0),eul(0,0,Math.PI/2),{side:false});
    const hose=new THREE.Mesh(new THREE.TorusGeometry(0.34,0.09,8,24),partMat('#e8b04a'));hose.rotation.x=Math.PI/2;hose.position.y=0.17;decor(hr,hose)}
  for(const[x,z]of R.shuffle([[4.2,2.7],[-4.2,2.6],[4.3,-2.8]]).slice(0,1+Math.round(cx))){const hy=cyl(0.22,0.8,'#e8283a',V(x,y0+0.4,z),Q(),{side:false});
    const cap=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),partMat('#e8283a'));cap.position.y=0.42;decor(hy,cap)}
  if(cx>0.7)for(const[x,z]of[[3.9,-2.6],[4.4,-1.9]])cone(0.28,0.5,'#ff7a12',V(x,y0+0.25,z),Q(),{n:3});
}
model('fireengine','vehicles',genFireEngine);
