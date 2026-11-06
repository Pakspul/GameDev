// Unscrew 3D models: rooms. Interiors: a floor and two walls, open to the camera.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

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
