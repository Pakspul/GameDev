// Unscrew 3D models: houses. Places people live in, seen from outside.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

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
model('cottage','houses',genCottage);

function genVilla(R,cfg){
  const cx=cfg.cx,pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal)),y0=0.3,FR='#3d4450',SL='#e3ded3';
  const W=R.f(4.8,5.3),D=R.f(3.2,3.5),H1=R.f(2.1,2.35),H2=R.f(1.9,2.15),hz=-0.9,BW=W+4.4,BD=D+5.6;
  const base=box(BW,0.3,BD,'#cfd8b8',V(0,0.15,0),Q(),{static:true,r:0.06});
  // ground floor: smooth white render panels
  const g=box(W,H1,D,'#8d929c',V(0,y0+H1/2,hz),Q(),{faces:['+x','-x','+z','-z']});
  cladBox(g,['+z','-z','+x','-x'],{dir:'v',w:0.62,cols:['#f4f1ea','#ebe6dc'],postColor:'#d9d4c8'});
  const ds=R.pick([-1,1]),dX=ds*W*0.28;
  const door=onFace(g,'+z',dX,-H1/2+0.85,0.95,1.7,0.14,acc.dark,{gap:PT});
  const hd=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.6,0.06),partMat('#d9dee6',{metalness:.5,roughness:.3}));hd.position.set(-ds*0.3,0,0.1);decor(door,hd);
  if(cx>0.25)onFace(g,'+z',dX,-H1/2+1.95,1.5,0.14,0.8,FR,{gap:PT,faces:['+y']});
  if(cx>0.5){const gd=onFace(g,'+z',-ds*W*0.22,-H1/2+0.8,1.9,1.6,0.14,'#c9ccd3',{gap:PT});
    for(let k=0;k<4;k++){const ln=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.04,0.03),partMat('#a3adbb'));ln.position.set(0,-0.6+k*0.4,0.08);decor(gd,ln)}}
  else win(g,'+z',-ds*W*0.22,0.1,1.8,1.2,PT,pal,{frame:FR});
  win(g,'+x',0,0.15,1.2,1.0,PT,pal,{frame:FR});if(cx>0.3)win(g,'-x',0,0.15,1.2,1.0,PT,pal,{frame:FR});
  for(let i=0;i<(cx>0.75?2:1);i++)win(g,'-z',cx>0.75?(i?1:-1)*W*0.25:0,0.15,1.1,1.0,PT,pal,{frame:FR});
  box(1.2,0.16,0.55,'#b9c0c9',V(dX,y0+0.08,hz+D/2+PT+0.45),Q(),{faces:['+y']});
  // flat roof over the ground floor, doubling as the balcony floor
  const S1W=W+2*PT+0.4,S1D=D+2*PT+0.4,s1t=y0+H1+0.22;
  box(S1W,0.22,S1D,SL,V(0,y0+H1+0.11,hz),Q(),{faces:['+y']});
  // upper floor: timber-clad box on one side, set back to the rear
  const W2=W*R.f(0.56,0.62),D2=D-R.f(0.15,0.4),ux=-ds*(W-W2)/2,uz=hz-(D-D2)/2;
  const u=box(W2,H2,D2,'#8d929c',V(ux,s1t+H2/2,uz),Q(),{faces:['+x','-x','+z','-z']});
  // planks at least 0.52 apart (the minimum screw spacing in finalize), so every plank keeps a screw
  cladBox(u,['+z','-z','+x','-x'],{dir:'h',w:0.6,cols:[pal.main,shade(pal.main,0.9)],postColor:pal.trim});
  win(u,'+z',0,0.1,Math.min(1.9,W2*0.6),1.0,PT,pal,{frame:FR});
  win(u,ds>0?'+x':'-x',0,-H2/2+0.9,1.0,1.7,PT,pal,{frame:FR});
  if(cx>0.4)win(u,'-z',0,0.1,1.2,0.9,PT,pal,{frame:FR});
  const roof=box(W2+2*PT+0.5,0.22,D2+2*PT+0.5,SL,V(ux,s1t+H2+0.11,uz),Q(),{faces:['+y']});
  if(cx>0.6)for(const a of(cx>1?[-0.65,0.65]:[0])){const sp=onFace(roof,'+y',a,0.1,1.1,0.8,0.14,'#24406b');
    for(const v of[-0.2,0.2]){const ln=new THREE.Mesh(new THREE.BoxGeometry(1.04,0.02,0.03),partMat('#8fb0dd'));ln.position.set(0,0.075,v);decor(sp,ln)}}
  // glass balustrade on the open part of the lower roof; screws face outward, away from the upper floor,
  // so the balustrade and the wall behind it never block each other
  const rail=(A,B,y,nx,nz)=>{const dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz),n=Math.max(1,Math.round(L/1.2)),q=eul(0,Math.atan2(nx,nz),0);
    for(let i=0;i<n;i++){const k=(i+0.5)/n;box(L/n-0.06,0.9,0.1,'#bfe3f2',V(A[0]+dx*k,y+0.45,A[1]+dz*k),q,{faces:['+z'],mat:{transparent:true,opacity:0.6,roughness:0.1}})}
    if(cx>0.35)box(L+0.1,0.12,0.2,'#5b6270',V((A[0]+B[0])/2,y+0.96,(A[1]+B[1])/2),q,{faces:['+y']})};
  const xin=ux+ds*(W2/2+PT+0.35),xout=ds*(S1W/2-0.15),zf=hz+S1D/2-0.15,zb=hz-S1D/2+0.15;
  if(cx>0.15)rail([Math.min(xin,xout),zf],[Math.max(xin,xout),zf],s1t,0,1);
  if(cx>0.5)rail([xout,zf-0.2],[xout,zb],s1t,ds,0);
  // pool with a screwed-on rim, and sun loungers
  const px=-ds*1.75,pz=hz+D/2+PT+1.6,pw=2.2,pd=1.5,rt='#f2efe8';
  const water=new THREE.Mesh(new THREE.BoxGeometry(pw,0.02,pd),partMat('#5fc4ea',{roughness:.1,metalness:.1}));water.position.set(px,0.16,pz);decor(base,water);
  for(const s of[-1,1]){box(pw+0.72,0.16,0.36,rt,V(px,y0+0.08,pz+s*(pd/2+0.18)),Q(),{faces:['+y']});
    box(0.36,0.16,pd,rt,V(px+s*(pw/2+0.18),y0+0.08,pz),Q(),{faces:['+y']})}
  if(cx>0.4)for(let i=0;i<(cx>0.8?2:1);i++){const lx=-ds*(3.55+i*0.6);
    const lo=box(0.55,0.24,1.4,acc.light,V(lx,y0+0.12,pz),Q(),{faces:['+y']});
    onFace(lo,'+y',0,0.42,0.5,0.5,0.14,acc.main,{noAnchor:true})}
  props(R,cx,R.shuffle([[W/2+1.25,hz-D/2-0.75,-1],[-W/2-1.25,hz-D/2-0.75,-1],[ds*(BW/2-0.75),BD/2-0.8,1]]).slice(0,1+Math.round(cx*1.5)),y0);
}
model('villa','houses',genVilla);
function genCanalHouse(R,cfg){
  const cx=cfg.cx,y0=0.3,D=R.f(2.6,2.9),hz=-0.6,n=cx>0.7?3:cx>0.2?2:1,FR='#f4f1ea';
  const BR=R.shuffle([['#a3473a','#b5574a'],['#7e3a32','#8f4a40'],['#b8693f','#c7794d'],['#5f4b45','#6e5952']]);
  // narrow fronts (under 2.4), so each brick course has two screws near the ends and the middle stays free for windows
  const Ws=[...Array(n)].map(()=>R.f(2.05,2.35)),TW=Ws.reduce((a,b)=>a+b,0)+(n-1)*0.04;
  const ground=box(TW+3,0.3,D+5.2,'#c2b8a8',V(0,0.15,0),Q(),{static:true,r:0.06}),qz=(D+5.2)/2;
  const water=new THREE.Mesh(new THREE.BoxGeometry(TW+3,0.02,1.3),partMat('#4f9ec4',{roughness:.15}));water.position.set(0,0.16,qz-0.65);decor(ground,water);
  const quay=new THREE.Mesh(new THREE.BoxGeometry(TW+3,0.04,0.18),partMat('#8d8478'));quay.position.set(0,0.17,qz-1.37);decor(ground,quay);
  let x=-TW/2;
  Ws.forEach((W,i)=>{const hx=x+W/2;x+=W+0.04;
    const H=R.f(4.6,5.4),br=BR[i%BR.length],bc=[br[0],br[1]],end=[i===0&&'-x',i===n-1&&'+x'].filter(Boolean);
    const core=box(W,H,D,'#6b5f58',V(hx,y0+H/2,hz),Q(),{faces:['+z','-z',...end]});
    plankFace(core,'+z',{w:0.7,cols:bc});
    if(cx>0.4)plankFace(core,'-z',{w:0.7,cols:bc});
    if(cx>0.3)for(const f of end)plankFace(core,f,{w:0.7,cols:bc});
    // tall sash windows in pairs, a door on the ground floor; all end within 0.5 of the middle,
    // clear of the footprint of the brick courses' screws (0.69 from the middle on the narrowest front, minus 0.15)
    const fh=H/3,ds=R.pick([-1,1]);
    for(let k=1;k<3;k++)for(const s of[-1,1])win(core,'+z',s*0.27,-H/2+fh*(k+0.5),0.46,Math.min(1.25,fh-0.4),PT,null,{frame:FR});
    win(core,'+z',-ds*0.27,-H/2+fh*0.6,0.46,0.9,PT,null,{frame:FR});
    const door=onFace(core,'+z',ds*0.25,-H/2+0.86,0.5,1.62,0.14,R.pick(['#2f5d46','#7a2e2e','#24406b']),{gap:PT});
    const kn=new THREE.Mesh(new THREE.SphereGeometry(0.05,10,8),partMat('#f3cf5a',{metalness:.4}));kn.position.set(-ds*0.14,0,0.09);decor(door,kn);
    if(cx>0.5)onFace(door,'+z',0,0.62,0.38,0.28,0.14,FR);
    // the stoop belongs to the street: a screw on it would crowd the door's lowest screw
    const stoop=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.16,0.44),partMat('#b9b2a6'));stoop.position.set(hx+ds*0.25,0.23,hz+D/2+PT+0.22);decor(ground,stoop);
    if(cx>0.6)for(let k=1;k<3;k++)win(core,'-z',0,-H/2+fh*(k+0.5),0.6,1.0,PT,null,{frame:FR});
    // stepped gable at the front; steps face only forward and up, so neighbouring gables never block each other
    const ns=cx>0.5?3:2,gz=hz+D/2+PT-0.17,top=y0+H;let gs=null;
    for(let k=0;k<ns;k++){const wk=W*(1-0.24*(k+0.5)*(3/ns)*0.85);gs=box(wk,0.6,0.34,br[0],V(hx,top+0.3+k*0.6,gz),Q(),{faces:['+z','+y']})}
    if(cx>0.35){const hb=box(0.3,0.3,0.8,'#5b3f2e',V(hx,top+ns*0.6-0.25,gz+0.17+0.4),Q(),{faces:['+y','+z']});
      const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.6,6),partMat('#3d3a36'));rope.position.set(0,-0.45,0.3);decor(hb,rope);
      const hook=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.015,6,12),partMat('#3d3a36'));hook.position.set(0,-0.78,0.3);decor(hb,hook)}
    // roof behind the gable, ridge running front to back; its screws sit near the ridge so they clear the neighbours
    const hA=0.6*ns-0.15,Lr=D+PT-0.34,g=prismX(W,hA,Lr);g.rotateY(-Math.PI/2);
    const roof=addPart(g,R.pick(['#4a4f5a','#5b4a44','#a8533f']),V(hx,top,hz-D/2+Lr/2),Q());
    for(const s of[-1,1])for(const zz of(cx>0.6?[-Lr/4,Lr/4]:[0]))addSlot(roof,V(s*W/2*0.35,hA*0.65,zz),V(s*hA,W/2,0));
    addSlot(roof,V(0,hA*0.3,-Lr/2),V(0,0,-1));
  });
  // a little boat moored in the canal (decoration)
  const hull=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.22,0.6),partMat('#7a5236'));hull.position.set(TW/2-0.8,0.25,qz-0.6);decor(ground,hull);
}
model('canalhouse','houses',genCanalHouse);
