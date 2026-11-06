// Unscrew 3D models: machines and robots.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

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
model('robot','machines',genRobot);

function genArcade(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal)),y0=pad(R,3.7,'#3b4057'),MT='#8d929c',DK='#2a2d3a';
  const Wi=1.9,T=0.28,D=2.4,H=5.0,cz=-0.8,cy=y0+H/2,rr=0.24;
  // the core between the two sides; every band of the front is covered by a plate, which holds the next plate...
  const core=box(Wi,H,D-0.1,DK,V(0,cy,cz),Q(),{faces:['+z']});
  const back=box(Wi+2*T,H,0.2,shade(pal.dark,0.8),V(0,cy,cz-(D-0.1)/2-0.1),Q(),{faces:['-z']});
  onFace(back,'-z',0,0,2.2,0.7,0.14,MT);
  // sides with their art: one stripe up the middle, or a plate over each row of screws (and stars on top)
  for(const s of[-1,1]){const f=s>0?'+x':'-x',sd=box(T,H,D,pal.main,V(s*(Wi/2+T/2),cy,cz),Q(),{faces:[f]});
    if(cx<0.5){const st=onFace(sd,f,0,0,0.7,4.7,0.14,acc.main);for(const b of[-1.95,0,1.95])if(cx>0.2||b===0)onFace(st,f,0,b,0.4,0.4,0.14,acc.light)}
    else{[[2.1,acc.main],[0,pal.dark],[-2.1,acc.main]].forEach(([b,c],i)=>{const bd=onFace(sd,f,0,b,2.1,0.6,0.14,c);
      if(cx>0.8&&i!==1)for(const a of[-0.8,0.8])onFace(bd,f,a,0,0.4,0.4,0.14,acc.light)})}}
  // coin door with two coin plates; speaker plate with two speakers
  const door=onFace(core,'+z',0,-2.1,Wi,0.9,0.14,MT);
  for(const[a,c]of[[-0.62,'#e8283a'],[0.62,'#1f7bff']]){const cp=onFace(door,'+z',a,0,0.5,0.6,0.14,c);
    const sl=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.04,0.02),partMat('#17212e'));sl.position.set(0,0.12,0.08);decor(cp,sl)}
  const sp=onFace(core,'+z',0,2.1,Wi,0.7,0.14,'#2d3138');
  if(cx>0.25)for(const a of[-0.62,0.62])cyl(0.25,0.14,'#4d5560',V(a,cy+2.1,cz+(D-0.1)/2+0.14+0.07),eul(Math.PI/2,0,0),{side:false});
  // screen: bezel on the core, glass on the bezel, a little invader on the glass
  const bz=onFace(core,'+z',0,0.5,Wi,2.2,0.18,'#1d2030'),scr=onFace(bz,'+z',0,0,1.6,2.0,0.14,'#102a3a');
  if(cx>0.05)for(const[x,y]of[[-0.2,0.25],[0.2,0.25],[-0.4,0],[0,0],[0.4,0],[-0.2,-0.25],[0.2,-0.25],[-0.4,-0.5],[0.4,-0.5],[0,0.5]]){
    const px=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.17,0.04),partMat('#8ff3ff',{emissive:srgb('#4fd9ff'),emissiveIntensity:.6}));px.position.set(x,y,0.09);decor(scr,px)}
  // control box with a tilted deck: four buttons and a joystick, each one standing on a screw of the deck
  const zf=cz+(D-0.1)/2,zc=zf+0.5,dy=cy-0.75;
  box(Wi,0.8,1.0,DK,V(0,dy-0.4,zc),Q(),{faces:['+z','+x','-x']});
  const dq=eul(0.3,0,0),deck=box(Wi,0.18,1.1,pal.dark,V(0,dy+0.07,zc+0.05),dq,{faces:['+y']});
  const cols=R.shuffle(['#ff3d9a','#ffcc1a','#14c8e6','#8fd61f','#ff7a12']);
  [[-0.62,0.22],[0.62,0.22],[-0.62,-0.22],[0.62,-0.22]].forEach(([a,b],i)=>{if(i>1&&cx<0.3)return;cyl(rr,0.14,cols[i],deck.mesh.localToWorld(V(a,0.09+0.07,-b)),deck.mesh.quaternion.clone(),{side:false})});
  const jb=cyl(0.3,0.14,'#17212e',deck.mesh.localToWorld(V(0,0.09+0.07,0)),deck.mesh.quaternion.clone(),{side:false});
  cyl(0.16,0.55,'#e8283a',deck.mesh.localToWorld(V(0,0.09+0.14+0.275,0)),deck.mesh.quaternion.clone(),{side:false});
  // marquee on top: a sign plate over the three screws of its front, with a star over each of the sign's
  const mq=box(Wi+2*T,0.9,2.0,shade(acc.dark,0.8),V(0,y0+H+0.45,cz),Q(),{faces:['+z','+y','+x','-x']});
  const sg=onFace(mq,'+z',0,0,2.2,0.7,0.14,acc.main);
  for(const a of[-0.77,0.77])onFace(sg,'+z',a,0,0.5,0.5,0.14,'#ffd23f');
  for(let i=-2;i<=2;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.36,0.03),partMat('#fff3e2'));bar.position.set(i*0.2,0,0.09);decor(sg,bar)}
  // a stool in front and a few coins on the floor
  const sy=y0+0.8,seat=cyl(0.5,0.14,acc.dark,V(0.4,sy,2.6),Q(),{side:false});
  for(const[a,b]of[[-0.3,-0.3],[0.3,-0.3],[0,0.35]]){const lg=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.75,8),partMat(MT,{metalness:.4}));lg.position.set(a,-0.45,b);decor(seat,lg)}
  for(const[x,z]of[[-1.9,1.9],[1.8,1.3],[-1.5,-1.9]]){const c=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.03,18),partMat('#ffc21a',{metalness:.4,roughness:.3}));c.position.set(x,0.16,z);decor(BLD.parts[0],c)}
}
model('arcade','machines',genArcade);

function genRobotDog(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal)),y0=pad(R,4.4,'#e9dcc4'),DK='#5b6270',BK='#2d3138';
  const PH=0.3,SH=0.78,TH=0.78,BH=1.2,BW=1.5,BL=3.4,lz=1.3,lx=0.6,by=y0+PH+SH+TH+BH/2,topY=by+BH/2;
  // four legs, each a stack: paw, shin, thigh, body. Every part's top screw is under the part above it, and caps and plates cover the side screws
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const fx=sx>0?'+x':'-x',fz=sz>0?'+z':'-z',x=sx*lx,z=sz*lz;
    box(0.62,PH,0.8,BK,V(x,y0+PH/2,z),Q(),{faces:['+y',fx,fz]});
    const shin=box(0.4,SH,0.4,pal.light,V(x,y0+PH+SH/2,z),Q(),{faces:['+y',fx,fz]});
    box(0.5,TH,0.5,pal.main,V(x,y0+PH+SH+TH/2,z),Q(),{faces:['+y',fx,fz]});
    if(cx>0.5)onFace(shin,fx,0,0,0.38,0.5,0.14,acc.main);
    if(cx>0.3){const hc=cyl(0.34,0.26,acc.dark,V(sx*(lx+0.25+0.13),y0+PH+SH+TH/2,z),eul(0,0,-sx*Math.PI/2),{side:false});
      const bolt=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.04,12),partMat('#d9dee6',{metalness:.4}));bolt.position.y=0.15;decor(hc,bolt)}}
  // body: a core with panels on both sides; its six top screws are covered by the neck and by a plate that carries a battery
  const body=box(BW,BH,BL,DK,V(0,by,0),Q(),{faces:['+y']});
  for(const f of['+x','-x'])plankFace(body,f,{w:0.62,cols:[pal.main,shade(pal.main,0.92)]});
  const zN=BL/2-0.55,neck=onFace(body,'+y',0,-zN,1.2,0.9,1.0,pal.main);
  if(cx>0.15){const pl=onFace(body,'+y',0,0.5,1.2,1.7,0.2,acc.dark);
    if(cx>0.3){const bt=onFace(pl,'+y',0,0,0.9,1.2,0.35,pal.light);
      for(let i=-2;i<=2;i++){const fn=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.04,0.06),partMat(acc.dark));fn.position.set(0,0.12,i*0.2);decor(bt,fn)}}}
  // a vent plate over the middle column of panels on each side, and a badge on the vent at the hardest levels
  if(cx>0.7)for(const f of['+x','-x']){const vt=onFace(body,f,0,0,1.0,1.2,0.14,acc.dark,{gap:PT});
    if(cx>1.0)onFace(vt,f,0,0,0.7,0.9,0.14,'#ffd166')}
  // tail with a tip plate
  const tail=onFace(body,'-z',0,0.15,0.3,0.9,0.5,acc.main);
  if(cx>0.25){const ch=onFace(body,'+z',0,0,1.3,0.9,0.14,acc.dark);if(cx>0.55)onFace(ch,'+z',0,0,1.0,0.5,0.14,'#ffd166')}
  if(cx>0.2)onFace(tail,'-z',0,0,0.3,0.5,0.14,'#ffd166');
  // head on the neck: a snout with a nose plate, ear panels over the side screws, a visor over the top screws, a sensor module on the visor
  const hy=topY+1.0+0.475,head=box(1.3,0.95,1.1,pal.main,V(0,hy,zN+0.2),Q(),{faces:['-z','+x','-x','+y']});
  const snout=onFace(head,'+z',0,-0.15,0.7,0.5,0.45,pal.light);
  if(cx>0.2)onFace(snout,'+z',0,0,0.3,0.4,0.14,'#17212e');
  for(const s of[-1,1]){const eye=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.04,20),new THREE.MeshStandardMaterial({color:srgb('#8ff3ff'),emissive:srgb('#4fd9ff'),emissiveIntensity:.9}));
    eye.rotation.x=Math.PI/2;eye.position.set(s*0.3,0.18,0.56);decor(head,eye);
    if(cx>0.1)onFace(head,s>0?'+x':'-x',0,0,0.9,0.7,0.2,acc.main)}
  if(cx>0.35){const vz=onFace(head,'+y',0,0,1.3,1.1,0.14,acc.dark);
    if(cx>0.6){const md=onFace(vz,'+y',0,0,1.0,0.8,0.2,acc.main);
      const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.6,8),partMat('#9aa6b5'));ant.position.set(0.25,0.4,0);decor(md,ant);
      const ball=new THREE.Mesh(new THREE.SphereGeometry(0.11,12,10),new THREE.MeshStandardMaterial({color:srgb('#ff6b6b'),emissive:srgb('#ff3b3b'),emissiveIntensity:.5}));ball.position.set(0.25,0.72,0);decor(md,ball)}}
  // a bone and a bowl on the ground
  if(cx>0.1){const bn=box(1.0,0.2,0.3,'#f4f1ea',V(-2.4,y0+0.1,1.9),eul(0,0.5,0),{faces:['+y']});
    for(const[a,b]of[[-0.5,0.12],[-0.5,-0.12],[0.5,0.12],[0.5,-0.12]]){const kn=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,8),partMat('#f4f1ea'));kn.position.set(a,0,b);decor(bn,kn)}}
  if(cx>0.4){const bw=cyl(0.45,0.25,acc.main,V(2.3,y0+0.125,2.0),Q(),{side:false});
    const fd=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.05,16),partMat('#a8744a'));fd.position.y=0.11;decor(bw,fd)}
}
model('robotdog','machines',genRobotDog);
