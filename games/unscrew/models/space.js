// Unscrew 3D models: space.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

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
model('rocket','space',genRocket);

function genRover(R,cfg){
  const cx=cfg.cx,y0=pad(R,3.7,'#c98d63'),foil=R.pick(['#e7c76a','#e9d08a','#dfe3ea']),acc=R.pick(['#e8283a','#1f7bff','#ff7a12']),DK='#3d4450',MT='#9aa6b5';
  const W=2.2,L=3.2,ay=y0+0.55,wr=0.58,ww=0.42;
  // chassis between the wheels: the wheels block its side screws, and the body hides its top ones
  const chassis=box(W,0.4,L,'#5b6270',V(0,ay,0),Q(),{faces:['+x','-x','+z','-z','+y']});
  for(const z of(cx>0.3?[-1.25,0,1.25]:[-1.25,1.25])){
    const ax=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,W+0.7,10),partMat(MT,{metalness:.4}));ax.rotation.z=Math.PI/2;ax.position.z=z;decor(chassis,ax);
    for(const s of[-1,1]){const w=cyl(wr,ww,DK,V(s*(W/2+0.17+ww/2),ay,z),eul(0,0,-s*Math.PI/2),{side:false}),n=cx>0.6?8:5;
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.05,20),partMat(foil,{metalness:.4,roughness:.35}));hub.position.y=ww/2+0.02;decor(w,hub);
      for(let k=0;k<n;k++){const a=k/n*Math.PI*2,g=new THREE.Mesh(new THREE.BoxGeometry(0.1,ww+0.06,0.1),partMat('#2d3138'));g.position.set(Math.cos(a)*wr,0,Math.sin(a)*wr);g.rotation.y=-a;decor(w,g)}
      if(cx>0.6)cyl(0.3,0.14,acc,V(s*(W/2+0.17+ww+0.07),ay,z),eul(0,0,-s*Math.PI/2),{side:false})}}  // a cap over each wheel's one screw
  // the body on the chassis, then a deck plate on the body, then the instruments on the deck: layers of covers
  const body=onFace(chassis,'+y',0,0,2.0,2.9,0.9,foil,{faces:['+y','+x','-x','+z','-z']});
  const deck=onFace(body,'+y',0,0,1.8,2.5,0.14,shade(foil,0.8));
  for(const f of['+x','-x']){const sol=onFace(body,f,0,0,2.7,0.7,0.14,'#27407a');if(cx>0.5)for(const a of[-0.95,0.95])onFace(sol,f,a,0,0.5,0.5,0.14,acc.light)}
  if(cx>0.2){const vent=onFace(body,'-z',0,0,1.9,0.7,0.14,DK); // the RTG on the back stands on the vent plate's screws
    if(cx>0.5)onFace(vent,'-z',-0.62,0,0.5,0.5,0.8,'#d9dee6');if(cx>0.9)onFace(vent,'-z',0.62,0,0.5,0.5,0.5,acc.main)}
  const ba=onFace(body,'+z',0,0,1.9,0.7,0.14,acc);
  // camera mast: plate, mast, head with lenses
  const mp=onFace(deck,'+y',-0.57,0.85,0.5,0.5,0.14,DK),mast=onFace(mp,'+y',0,0,0.34,0.34,1.5,MT),hd=onFace(mast,'+y',0,0,0.9,0.5,0.5,foil); // only a top screw: one on its front would crowd out the mast's hidden one
  for(const s of[-1,1]){const e=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.06,16),partMat('#17212e',{roughness:.2}));e.rotation.x=Math.PI/2;e.position.set(s*0.22,0,0.27);decor(hd,e)}
  // a science box, and the dish on a stalk
  onFace(deck,'+y',0.57,0.85,0.7,0.7,0.35,'#f4f1ea');
  if(cx>0.35){const dp=onFace(deck,'+y',0.57,-0.85,0.5,0.5,0.14,DK),st=onFace(dp,'+y',0,0,0.34,0.34,0.8,MT);
    const dish=cyl(0.5,0.16,'#f4f1ea',V(0.57,st.mesh.position.y+0.4+0.08+0.03,-0.85),eul(-0.5,0,0),{side:false});
    const cup=new THREE.Mesh(new THREE.SphereGeometry(0.1,10,8),partMat(acc));cup.position.y=0.2;decor(dish,cup)}
  if(cx>0.55)onFace(deck,'+y',-0.57,-0.85,0.7,0.7,0.35,shade(foil,0.9));
  // the arm in front: base block on the bumper plate, an upper arm, a drill head on its end
  if(cx>0.45){const ab=onFace(ba,'+z',0.62,0,0.5,0.5,0.4,DK),up=onFace(ab,'+z',0,0,0.34,0.34,1.0,MT),dr=onFace(up,'+z',0,0,0.5,0.5,0.4,acc);
    const bit=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.35,10),partMat(MT,{metalness:.5}));bit.rotation.x=Math.PI/2;bit.position.z=0.4;decor(dr,bit)}
  if(cx>0.8)onFace(ba,'+z',-0.62,0,0.5,0.5,0.3,'#f4f1ea');
  // rocks, and tracks across the sand
  for(const[x,z]of R.shuffle([[2.7,2.2],[-2.6,1.8],[2.3,-2.4],[-2.4,-2.2],[0.4,3.1]]).slice(0,2+Math.round(cx*1.5)))blob(R.f(0.4,0.58),R.pick(['#b5683e','#a35a34','#c47a4c']),V(x,y0+0.35,z),R,3);
  for(const s of[-1,1]){const tr=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.015,1.2),partMat('#b5774f'));tr.position.set(s*1.47,0.16,-2.5);decor(BLD.parts[0],tr)}
}
model('rover','space',genRover);
