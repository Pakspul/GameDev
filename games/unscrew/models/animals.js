// Unscrew 3D models: animals. Spots, scales and plates make natural cover plates that hide screws.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

function genGiraffe(R,cfg){
  const cx=cfg.cx,y0=pad(R,3.6,'#e6d49a');
  const coat=R.pick(['#f2c14e','#efb84a','#f5cc66']),spot=R.pick(['#9a5a2c','#8a4b25','#a8662f']),dark='#5b3f2e',light='#fbe7b5';
  const gz=-0.7,legH=R.f(1.8,2.05),hoof=0.42,BW=1.5,BH=R.f(1.2,1.35),BL=R.f(2.6,2.9);
  // spots are plates over the screw grid: each one hides the screw beneath it (covers must be 0.14 thick)
  const spots=(host,f,cand,n,lo,hi)=>{for(const[a,b]of R.shuffle(cand).slice(0,n)){const s=R.f(lo,hi);onFace(host,f,a,b,s,s*R.f(0.85,1),0.14,spot,{r:0.1})}};
  // legs on hooves
  for(const sx of[-1,1])for(const sz of[-1,1]){const lx=sx*0.5,lz=gz+sz*(BL/2-0.4),fx=sx>0?'+x':'-x',fz=sz>0?'+z':'-z';
    box(0.54,hoof,0.6,dark,V(lx,y0+hoof/2,lz),Q(),{faces:['+y',fx,fz]});
    const leg=box(0.4,legH,0.4,coat,V(lx,y0+hoof+legH/2,lz),Q(),{faces:[fx,fz]});
    if(cx>0.35)onFace(leg,fx,0,legH/2-0.33,0.38,0.4,0.14,spot,{r:0.08})}
  // body with spots
  const by=y0+hoof+legH+BH/2,body=box(BW,BH,BL,coat,V(0,by,gz),Q(),{faces:['+x','-x','+y','-z']});
  const nS=Math.min(4,2+Math.round(cx*1.5)),ea=BL/2-0.4,eb=BH/2-0.33,side=[[-ea,eb],[0,-eb],[ea,eb],[-ea,-eb],[ea,-eb],[0,eb]];
  spots(body,'+x',side.slice(0,4),nS,0.5,0.6);spots(body,'-x',side.slice(2),nS,0.5,0.6);
  if(cx>0.5)spots(body,'+y',[[-0.42,0],[0.42,0],[-0.42,BL/2-0.4],[0.42,BL/2-0.4]],Math.min(4,Math.round(cx*2)),0.46,0.56);
  // neck leaning forward, with a mane down the back
  const t=R.f(0.3,0.42),NL=R.f(2.6,3.0),NW=0.62,q=eul(t,0,0),dir=V(0,1,0).applyQuaternion(q);
  const nb=V(0,by+BH/2-0.15,gz+BL/2-0.42),neck=box(NW,NL,NW,coat,nb.clone().addScaledVector(dir,NL/2),q,{faces:['+x','-x','+z']});
  const mane=onFace(neck,'-z',0,0.1,0.2,NL*0.85,0.14,dark);
  const en=NL/2-0.4,nc=[[0,-en],[0,0],[0,en]],nn=cx>0.6?2:1;
  spots(neck,'+x',nc,nn,0.46,0.52);spots(neck,'-x',nc,nn,0.46,0.52);
  // head: snout, eyes, ears and two ossicones
  const top=nb.clone().addScaledVector(dir,NL),HL=R.f(1.15,1.3),HW=0.72,HH=0.62,hc=top.clone().add(V(0,0.18,0.28));
  const head=box(HW,HH,HL,coat,hc,Q(),{faces:['+x','-x','+y']});
  const snout=onFace(head,'+z',0,-0.08,0.52,0.44,0.34,light);
  for(const s of[-1,1]){const ns=new THREE.Mesh(new THREE.SphereGeometry(0.045,10,8),partMat(dark));ns.position.set(s*0.12,0.06,0.18);decor(snout,ns);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.08,14,10),partMat('#17212e',{roughness:.25}));eye.position.set(s*(HW/2+0.01),0.1,HL*0.12);decor(head,eye);
    onFace(head,s>0?'+x':'-x',s*0.4,0.2,0.3,0.16,0.3,coat);
    const ox=s*0.27,oz=hc.z-0.25,oy=hc.y+HH/2;
    const oc=cyl(0.12,0.46,coat,V(ox,oy+0.23,oz),Q(),{side:false});
    const knob=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.15,0.12,16),partMat(dark));knob.position.y=0.17;decor(oc,knob)}
  // tail with a tuft
  const tail=onFace(body,'-z',0,BH/2-0.6,0.18,1.0,0.14,coat);if(cx>0.3)onFace(tail,'-z',0,-0.34,0.34,0.36,0.14,dark,{r:0.06});
  // acacia tree and a few bushes or rocks
  // the tree stands behind the neck, so neither blocks the other's screws
  if(cx>0.25){const tx=R.pick([-1,1])*2.3,tzz=gz-1.55,th=R.f(3.4,3.9);
    cyl(0.2,th,'#7a5236',V(tx,y0+th/2,tzz),Q(),{side:false});
    cyl(1.25,0.36,'#7fae4f',V(tx,y0+th+0.18,tzz),Q());
    if(cx>0.6)cyl(0.8,0.3,'#93c260',V(tx+0.15,y0+th+0.51,tzz-0.1),Q())}
  const bs=R.shuffle([[-2.1,1.8],[1.8,2.2],[-1.9,-0.2],[2.2,0.4],[-1.6,2.9]]);
  for(let i=0;i<1+Math.round(cx*1.5)&&i<bs.length;i++){const[x,z]=bs[i];
    if(R.chance(0.5))blob(R.f(0.42,0.55),'#7bb661',V(x,y0+0.4,z),R,3);else blob(R.f(0.35,0.48),'#a3a7ad',V(x,y0+0.28,z),R,3)}
}
model('giraffe','animals',genGiraffe);
function genTurtle(R,cfg){
  const cx=cfg.cx,y0=pad(R,3.1,'#ead9a6');
  const skin=R.pick(['#9cc66b','#8dbb5e','#a8cf78']),sh=R.pick([['#5f8a3a','#729c45','#8fb85a'],['#7a5a32','#8c6a3c','#a8844e'],['#4f7f6a','#5f927c','#7cae96']]);
  const LH=0.46,r1=1.75,h1=0.46,b1=y0+LH,r2=1.3,h2=0.5,r3=1.0,h3=0.26,ph=Math.PI/2;
  // legs (flippers) under the rim of the shell, the front pair angled forward; each has a screw at its tip
  for(const[th,big]of[[ph+0.95,1],[ph-0.95,1],[-ph+1.0,0],[-ph-1.0,0]]){const L=big?1.0:0.8,rr=1.55+L/2-0.45;
    const lg=box(big?0.6:0.52,LH,L,skin,V(Math.cos(th)*rr,y0+LH/2,Math.sin(th)*rr),eul(0,Math.atan2(Math.cos(th),Math.sin(th)),0),{faces:['+z','+x','-x']});
    if(big&&cx>0.7)for(const s of[-1,1]){const cl=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.14,8),partMat('#f4f1ea'));cl.rotation.x=Math.PI/2;cl.position.set(s*0.15,-0.14,L/2+0.05);decor(lg,cl)}}
  // shell: a rim and a middle tier, each a core clad with plates (the scutes) that cover the core's side screws,
  // then a cap carrying hexagonal plates (no screws on the rim's top ring: they would crowd out the plates' screws)
  const rim=cyl(r1,h1,shade(sh[0],0.8),V(0,b1+h1/2,0),Q(),{top:false,sideN:12,phase:ph});
  cladCyl(rim,12,{cols:[sh[0],shade(sh[0],0.9)],phase:ph});
  const belly=new THREE.Mesh(new THREE.CylinderGeometry(r1-0.2,r1-0.35,0.14,32),partMat('#e8d48a'));belly.position.y=-h1/2-0.07;decor(rim,belly);
  const mid=cyl(r2,h2,shade(sh[1],0.8),V(0,b1+h1+h2/2,0),Q(),{top:false,sideN:9,phase:ph});
  cladCyl(mid,9,{cols:[sh[1],shade(sh[1],0.9)],phase:ph});
  if(cx>0.6)for(let k=0;k<6;k++){const a=k/6*Math.PI*2;addSlot(mid,V(Math.cos(a)*(r3+0.23),h2/2,Math.sin(a)*(r3+0.23)),UPV)}
  const yC=b1+h1+h2,cap=cyl(r3,h3,shade(sh[2],0.85),V(0,yC+h3/2,0),Q(),{top:false,sideN:6,phase:ph});
  // hex plates (0.18 thick, 0.26 from centre to edge) each cover a screw in the cap
  const hx=[[0,0]];for(let k=0;k<6;k++){const a=k/6*Math.PI*2+Math.PI/6;hx.push([Math.cos(a)*0.6,Math.sin(a)*0.6])}
  hx.slice(0,cx>0.45?7:4).forEach(([x,z],i)=>{addSlot(cap,V(x,h3/2,z),UPV);const hh=i?0.18:0.26;
    cyl(0.3,hh,i?shade(sh[2],i%2?1:0.92):sh[2],V(x,yC+h3+hh/2,z),Q(),{seg:6,side:false})});
  // head on a neck, held clear of the front plate so that plate keeps its screws; a tail tucked under the shell
  const head=box(0.82,0.68,0.95,skin,V(0,b1+0.12,r1+PT+0.62),Q(),{faces:['+x','-x','+y','+z']});
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.26,0.5,16),partMat(shade(skin,0.92)));neck.rotation.x=Math.PI/2;neck.position.set(0,-0.08,-0.6);decor(head,neck);
  for(const s of[-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(0.1,14,10),partMat('#17212e',{roughness:.25}));e.position.set(s*0.41,0.13,0.2);decor(head,e)}
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.03,0.02),partMat('#4f6b38'));mouth.position.set(0,-0.13,0.485);decor(head,mouth);
  if(cx>0.2)box(0.32,0.26,0.8,skin,V(0,y0+0.3,-2.0),Q(),{faces:['-z','+y']});
  // a pond and a few rocks; the rocks sit between the directions the rim plates' screws point in
  const pond=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,0.02,32),partMat('#5fc4ea',{roughness:.1}));pond.scale.z=0.7;pond.position.set(-1.95,0.16,1.75);decor(BLD.parts[0],pond);
  for(const a of R.shuffle([15,195,255]).slice(0,1+Math.round(cx*1.2))){const t=a*Math.PI/180;blob(R.f(0.34,0.4),'#a3a7ad',V(Math.cos(t)*2.8,y0+0.26,Math.sin(t)*2.8),R,3)}
}
model('turtle','animals',genTurtle);
