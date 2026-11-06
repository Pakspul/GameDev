// Unscrew 3D models: everyday objects and food. Stacks of layers, each one hiding the screws of the one below.
// Each generator builds one model from the building blocks in kit.js and registers it with model().
// Catalogue, rules and recipe: docs/UNSCREW-MODELS.md. A new model also goes at the end of models/order.js.

function genCake(R,cfg){
  const cx=cfg.cx,y0=pad(R,4.6,R.pick(['#efe3cf','#f3d9d9','#dfe8f3'])),pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal));
  const nT=2+(cx>0.35?1:0)+(cx>0.9?1:0),rt=[2.9,2.2,1.5,0.8],ht=[1.15,1.0,0.9,0.8];
  // the cake board: its screws all sit under the first tier, so it is the last thing to come off
  const board=cyl(3.4,0.16,'#d9dee6',V(0,y0+0.08,0),Q(),{side:false});
  let y=y0+0.16;const tiers=[];
  for(let i=0;i<nT;i++){const r=rt[i],h=ht[i],core=cyl(r,h,i%2?'#d9b88a':'#c9a173',V(0,y+h/2,0),Q(),{sideN:10});
    const cols=i%2?[acc.light,acc.main]:[pal.light,pal.main],pn=cladCyl(core,10,{cols,phase:0});tiers.push({core,pn,r,h,y});
    // fondant squares over one column of screws of some panels
    if(cx>0.3+i*0.35)pn.forEach((p,k)=>{const cs=axisOffs(p.box.w);if(k%2===0)onFace(p,'+z',cs.length>1?cs[0]:0,0,0.6,0.9*Math.min(1,h/1.15),0.14,i%2?pal.dark:acc.dark)});
    // a ring of icing dollops on the exposed part of the tier's top, each over one screw of the core
    if(i<nT-1){const ring=r-0.1,nD=4+Math.round(cx*3)+i;
      for(let k=0;k<nD;k++){const a=(k+0.5)/nD*Math.PI*2,x=Math.cos(a)*ring,z=Math.sin(a)*ring;addSlot(core,V(x,h/2,z),UPV);
        cyl(0.19,0.14,'#fff6f0',V(x,y+h+0.07,z),Q(),{seg:6,side:false})}}
    y+=h}
  // sprinkles between the screws of the lowest tier
  if(cx>0.6)for(const p of tiers[0].pn)for(let k=0;k<4;k++){const s=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.04,0.03),partMat(R.pick(GLASS)));s.position.set(R.f(-0.15,0.15),R.f(-0.5,0.5),0.09);s.rotation.z=R.f(0,3);decor(p,s)}
  // the top: a plate over the last tier's screws, candles standing on the plate's own screws, and a cherry
  const top=tiers[nT-1],cap=cyl(top.r+PT,0.2,'#fff6f0',V(0,y+0.1,0),Q(),{side:false});
  if(cx>0.1)for(let k=0;k<3;k++){const a=k/3*Math.PI*2+0.5,x=Math.cos(a)*(top.r+PT)*0.55,z=Math.sin(a)*(top.r+PT)*0.55;
    const cd=cyl(0.2,0.55,R.pick(['#ff9fb2','#8be3ff','#ffd166']),V(x,y+0.2+0.275,z),Q(),{side:false});
    const fl=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.2,8),partMat('#ffb020',{emissive:srgb('#ff9a00'),emissiveIntensity:.7}));fl.position.y=0.4;decor(cd,fl)}
  const ch=cyl(0.3,0.32,'#d63a5a',V(0,y+0.2+0.16,0),Q(),{side:false});
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.3,6),partMat('#4f7f3a'));stem.position.set(0.06,0.25,0);stem.rotation.z=-0.3;decor(ch,stem);
  // berries on the table
  for(const a of R.shuffle([20,75,140,200,260,320]).slice(0,2+Math.round(cx*2))){const t=a*Math.PI/180;blob(0.36,'#e03a5a',V(Math.cos(t)*4.0,y0+0.32,Math.sin(t)*4.0),R,3)}
}
model('cake','objects',genCake);

function genBurger(R,cfg){
  const cx=cfg.cx,y0=pad(R,4.6,R.pick(['#efe3cf','#dfe8f3','#f3e2c7'])),pal=R.pick(PALS),acc=R.pick(PALS.filter(p=>p!==pal));
  const BUN=R.pick(['#e3a857','#dba04f','#e8b366']),BX=-0.9;
  let y=y0;
  // a layer is a cylinder with only top screws, so the layer above is what hides them: one long chain, bottom to top
  const layer=(r,h,col,o={})=>{const c=cyl(r,h,col,V(BX,y+h/2,0),Q(),{side:false,...o});y+=h;return c};
  layer(2.75,0.18,'#f4f1ea');
  // the bottom bun sits in a paper wrapper whose panels hide the bun's side screws
  const wrap=cx>0.3,bb=layer(2.2,0.7,BUN,wrap?{side:true,sideN:10}:{});
  if(wrap)cladCyl(bb,10,{cols:[acc.main,acc.light],phase:0});
  // lettuce: a ring of onion dots each hides one lettuce screw outside the patty; the screws under the patty are hidden by it
  const nD=3+Math.round(cx*2),lt=layer(2.55,0.16,'#6cbf4a');
  for(let k=0;k<nD;k++){const a=(k+0.5)/nD*Math.PI*2+0.3,x=Math.cos(a)*2.3,z=Math.sin(a)*2.3;addSlot(lt,V(x,0.08,z),UPV);
    cyl(0.2,0.14,'#f3e6f0',V(BX+x,y+0.07,z),Q(),{seg:6,side:false})}
  const mid=['patty','cheese'];if(cx>0.25)mid.push('tomato');if(cx>0.6)mid.push('patty','bacon','cheese');if(cx>1.0)mid.push('onion');
  for(const m of mid){
    if(m==='patty')layer(2.0,0.56,'#7a4a2b');
    else if(m==='tomato')layer(1.8,0.2,'#e0493f');
    else if(m==='onion')layer(1.9,0.16,'#e8d3ea');
    // two strips of bacon, each with three screws that the cheese on top hides
    else if(m==='bacon'){for(const z of[-0.4,0.4])box(3.0,0.15,0.55,'#c4513a',V(BX,y+0.075,z),Q(),{faces:['+y']});y+=0.15}
    else{const c=box(3.1,0.16,3.1,'#f6c744',V(BX,y+0.08,0),eul(0,R.f(0.5,1.0),0),{faces:[]});faceSlot(c,'+y',0,0);y+=0.16}}
  // top bun: its screws are all under sesame seeds, and one plate carries a flag
  const tb=cyl(2.15,0.9,BUN,V(BX,y+0.45,0),Q(),{side:false,top:false}),nS=5+Math.round(cx*2);
  for(let k=0;k<nS;k++){const a=(k+0.5)/nS*Math.PI*2,x=Math.cos(a)*1.35,z=Math.sin(a)*1.35;addSlot(tb,V(x,0.45,z),UPV);
    cyl(0.2,0.14,'#f6ecd2',V(BX+x,y+0.9+0.07,z),Q(),{seg:6,side:false})}
  addSlot(tb,V(0,0.45,0),UPV);
  const fp=cyl(0.34,0.14,acc.dark,V(BX,y+0.9+0.07,0),Q(),{side:false});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.3,6),partMat('#c9a25a'));pole.position.y=0.7;decor(fp,pole);
  const flag=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.32,0.03),partMat(acc.main));flag.position.set(0.3,1.15,0);decor(fp,flag);
  // fries: a carton whose front screws are hidden by a label plate
  if(cx>0.15){const fc=box(1.3,1.1,0.9,'#d8473e',V(3.1,y0+0.55,-1.7),eul(0,-0.4,0),{faces:['+z','-z']});
    const lb=onFace(fc,'+z',0,0,1.05,0.95,0.14,'#f6c744');if(cx>0.5)onFace(lb,'+z',0,0,0.5,0.5,0.14,'#d8473e');
    for(let i=0;i<14;i++){const f=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.9,0.1),partMat(R.pick(['#f2c84b','#efbf3e','#f6d36a'])));
      f.position.set(R.f(-0.45,0.45),0.75,R.f(-0.25,0.25));f.rotation.set(R.f(-0.25,0.25),0,R.f(-0.25,0.25));decor(fc,f)}}
  // cup with a lid: the lid hides the cup's screws
  if(cx>0.1){const cu=cyl(0.66,1.5,acc.light,V(3.1,y0+0.75,1.7),Q(),{side:false});
    const st=new THREE.Mesh(new THREE.CylinderGeometry(0.675,0.675,0.4,24,1,true),partMat(acc.main,{side:THREE.DoubleSide}));st.position.y=0.1;decor(cu,st);
    const lid=cyl(0.76,0.18,'#f4f1ea',V(3.1,y0+1.5+0.09,1.7),Q(),{side:false});
    const sw=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.9,6),partMat('#e8283a'));sw.position.set(0.15,0.55,0);sw.rotation.z=-0.15;decor(lid,sw)}
}
model('burger','objects',genBurger);
