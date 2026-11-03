(()=>{
'use strict';
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reduceMotion=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const lin=h=>new THREE.Color(h).convertSRGBToLinear();

/* ---------- Persistence ---------- */
const STORE='jade-pavilion-v1';
function defaultSave(){const prog={};['breeze','garden','dragon','emperor'].forEach(k=>prog[k]={unlocked:1,stars:{},best:{}});return{v:1,prog,settings:{highlight:true,sound:true,theme:'jade'},daily:{},resume:null,lastDiff:'garden'};}
let save=defaultSave();
try{const s=JSON.parse(localStorage.getItem(STORE));if(s&&s.v===1){save=Object.assign(defaultSave(),s);save.settings=Object.assign(defaultSave().settings,s.settings||{});}}catch(e){}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(save));}catch(e){}}
const totalStars=k=>Object.values(save.prog[k].stars).reduce((a,b)=>a+b,0);
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const prettyDate=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en-GB',{day:'numeric',month:'short'});};
const isTall=()=>innerWidth/innerHeight<0.8;

/* ---------- Themes ---------- */
const THEMES={
  jade:{name:'Jade',bg:'#0c1612',felt:'#2a6b50',back:'#2d8a66',pool:'#ffe2a8',css:{'--ink':'#0c1612','--sheet':'rgba(13,22,18,.95)','--rail':'rgba(8,14,11,.82)','--accent':'#dcb760','--accent-ink':'#1d1606','--tile-back':'#2d8a66','--chip-on':'rgba(220,183,96,.12)'}},
  lacquer:{name:'Lacquer',bg:'#170806',felt:'#7c231a',back:'#1f1b19',pool:'#ffd39a',css:{'--ink':'#170806','--sheet':'rgba(26,11,9,.95)','--rail':'rgba(16,6,5,.82)','--accent':'#e9b85e','--accent-ink':'#241604','--tile-back':'#1f1b19','--chip-on':'rgba(233,184,94,.12)'}},
  moon:{name:'Moonlight',bg:'#090d1a',felt:'#26345e',back:'#3d5fa6',pool:'#d9e4ff',css:{'--ink':'#090d1a','--sheet':'rgba(12,16,32,.95)','--rail':'rgba(7,10,20,.82)','--accent':'#b9c8ff','--accent-ink':'#0d1330','--tile-back':'#3d5fa6','--chip-on':'rgba(185,200,255,.12)'}}
};

/* ---------- Sound (synthesised, no files) ---------- */
const Sfx={ctx:null,master:null,nbuf:null,armed:false,
  ensure(){if(!save.settings.sound||!this.armed)return null;try{if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=0.55;this.master.connect(this.ctx.destination);const b=this.ctx.createBuffer(1,this.ctx.sampleRate*0.3,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nbuf=b;}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch(e){return null;}return this.ctx;},
  tone(f,t,dur,type,g,glide){const c=this.ctx,o=c.createOscillator(),v=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(glide)o.frequency.exponentialRampToValueAtTime(glide,t+dur);v.gain.setValueAtTime(0.0001,t);v.gain.exponentialRampToValueAtTime(g,t+0.008);v.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(v);v.connect(this.master);o.start(t);o.stop(t+dur+0.05);},
  noise(t,dur,f,g){const c=this.ctx,s=c.createBufferSource(),bp=c.createBiquadFilter(),v=c.createGain();s.buffer=this.nbuf;bp.type='bandpass';bp.frequency.value=f;bp.Q.value=1.4;v.gain.setValueAtTime(g,t);v.gain.exponentialRampToValueAtTime(0.0001,t+dur);s.connect(bp);bp.connect(v);v.connect(this.master);s.start(t);s.stop(t+dur+0.02);},
  click(){const c=this.ensure();if(!c)return;const t=c.currentTime;this.noise(t,0.05,2600,0.5);this.tone(1150,t,0.07,'triangle',0.1,720);},
  clack(d=0){const c=this.ensure();if(!c)return;const t=c.currentTime+d;this.noise(t,0.06,1500+Math.random()*600,0.35);this.tone(520+Math.random()*120,t,0.08,'triangle',0.08,330);},
  thud(){const c=this.ensure();if(!c)return;const t=c.currentTime;this.tone(170,t,0.2,'sine',0.35,70);this.noise(t,0.05,380,0.35);},
  match(step){const c=this.ensure();if(!c)return;const N=[523.25,587.33,659.25,783.99,880,1046.5,1174.66,1318.51,1567.98];const f=N[clamp(step-1,0,8)],t=c.currentTime;this.clack();this.tone(f,t+0.02,1.0,'sine',0.2);this.tone(f*2,t+0.02,0.45,'triangle',0.05);this.tone(f*1.5,t+0.08,0.8,'sine',0.08);},
  gold(){const c=this.ensure();if(!c)return;const t=c.currentTime;[1567.98,2093,2637].forEach((f,i)=>this.tone(f,t+0.05+i*0.06,0.6,'sine',0.09));},
  hint(){const c=this.ensure();if(!c)return;const t=c.currentTime;this.tone(880,t,0.5,'sine',0.12);this.tone(1318.5,t+0.12,0.6,'sine',0.1);},
  win(){const c=this.ensure();if(!c)return;const t=c.currentTime;[523.25,659.25,783.99,1046.5,1318.51,1567.98].forEach((f,i)=>{this.tone(f,t+i*0.11,1.4,'sine',0.16);this.tone(f/2,t+i*0.11,1,'triangle',0.04);});},
  lose(){const c=this.ensure();if(!c)return;const t=c.currentTime;[392,349.23,293.66,261.63].forEach((f,i)=>this.tone(f,t+i*0.18,0.7,'triangle',0.12));}
};

['pointerdown','keydown'].forEach(ev=>addEventListener(ev,()=>{Sfx.armed=true;},{capture:true}));

/* ---------- Three.js scene ---------- */
const canvas=$('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,26,64);
const camera=new THREE.PerspectiveCamera(34,1,0.1,240);
scene.add(new THREE.HemisphereLight(0xfff1dc,0x1a2420,0.6));
const sun=new THREE.DirectionalLight(0xffe6c0,1.05);sun.position.set(-7,18,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.02;scene.add(sun);scene.add(sun.target);
const fillL=new THREE.DirectionalLight(0xbcd4ff,0.25);fillL.position.set(9,7,-7);scene.add(fillL);

function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
const feltTex=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#bdbdbd';x.fillRect(0,0,w,h);const im=x.getImageData(0,0,w,h),d=im.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-0.5)*34;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}x.putImageData(im,0,0);x.globalAlpha=0.06;for(let k=0;k<500;k++){x.strokeStyle=Math.random()<0.5?'#fff':'#000';x.beginPath();const a=Math.random()*w,b=Math.random()*h;x.moveTo(a,b);x.lineTo(a+(Math.random()-0.5)*14,b+(Math.random()-0.5)*14);x.stroke();}});
feltTex.wrapS=feltTex.wrapT=THREE.RepeatWrapping;feltTex.repeat.set(70,70);feltTex.anisotropy=renderer.capabilities.getMaxAnisotropy();
const feltMat=new THREE.MeshStandardMaterial({map:feltTex,roughness:0.97,metalness:0});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400),feltMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const poolTex=canvasTex(256,256,(x,w,h)=>{const g=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.5,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
const poolMat=new THREE.MeshBasicMaterial({map:poolTex,transparent:true,opacity:0.16,blending:THREE.AdditiveBlending,depthWrite:false});
const pool=new THREE.Mesh(new THREE.PlaneGeometry(1,1),poolMat);pool.rotation.x=-Math.PI/2;pool.position.y=0.01;scene.add(pool);
const dotTex=canvasTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.3,'rgba(255,255,255,.8)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});

/* ---------- Tile geometry & faces ---------- */
const TW=1,TD=1.32,TH=0.74,BACK_H=0.24,TOP_H=TH-BACK_H,GAP=0.035,UX=(TW+GAP)/2,UZ=(TD+GAP)/2;
function rrShape(w,h,r){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function slabGeo(h){const bs=0.045,bt=0.045;const g=new THREE.ExtrudeGeometry(rrShape(TW-2*bs,TD-2*bs,0.09),{depth:h-2*bt,bevelEnabled:true,bevelThickness:bt,bevelSize:bs,bevelSegments:3,curveSegments:5});g.rotateX(-Math.PI/2);g.translate(0,bt,0);return g;}
const GEO={back:slabGeo(BACK_H),top:slabGeo(TOP_H),face:new THREE.PlaneGeometry(TW*0.84,TD*0.855)};GEO.face.rotateX(-Math.PI/2);
const IVORY=lin('#efe5cb'),GOLD_E=lin('#ffcf5a'),HINT_E=lin('#7fffd0');
const backMat=new THREE.MeshStandardMaterial({roughness:0.32,metalness:0.05});
const goldMat=new THREE.MeshStandardMaterial({color:lin('#d9a536'),roughness:0.28,metalness:0.55,emissive:lin('#5a3c06'),emissiveIntensity:1});

const HAN='"Noto Serif TC","Songti TC","PMingLiU","SimSun",serif';
const C={blue:'#1f4c98',green:'#16704a',red:'#bb2a2a',black:'#1c1a17',num:'#1b2a5a',ivory:'#f7f0de'};
const CC={b:C.blue,g:C.green,r:C.red};
const DOTS={2:[[.5,.24],[.5,.76]],3:[[.2,.16],[.5,.5],[.8,.84]],4:[[.27,.25],[.73,.25],[.27,.75],[.73,.75]],5:[[.24,.2],[.76,.2],[.5,.5],[.24,.8],[.76,.8]],6:[[.27,.15],[.73,.15],[.27,.5],[.73,.5],[.27,.85],[.73,.85]],7:[[.18,.1],[.5,.22],[.82,.34],[.27,.6],[.73,.6],[.27,.88],[.73,.88]],8:[[.27,.1],[.73,.1],[.27,.37],[.73,.37],[.27,.63],[.73,.63],[.27,.9],[.73,.9]],9:[[.18,.15],[.5,.15],[.82,.15],[.18,.5],[.5,.5],[.82,.5],[.18,.85],[.5,.85],[.82,.85]]};
const DOTR={2:.2,3:.17,4:.18,5:.16,6:.15,7:.125,8:.12,9:.115};
const DOTC={2:'gb',3:'brg',4:'bggb',5:'bgrgb',6:'ggrrrr',7:'gggrrrr',8:'bbbbbbbb',9:'bbbrrrggg'};
const BAM={2:[[.5,.25],[.5,.75]],3:[[.5,.25],[.27,.75],[.73,.75]],4:[[.3,.25],[.7,.25],[.3,.75],[.7,.75]],5:[[.22,.25],[.78,.25],[.5,.5],[.22,.75],[.78,.75]],6:[[.2,.25],[.5,.25],[.8,.25],[.2,.75],[.5,.75],[.8,.75]],7:[[.5,.15],[.2,.5],[.5,.5],[.8,.5],[.2,.85],[.5,.85],[.8,.85]],8:[[.14,.25],[.38,.25],[.62,.25],[.86,.25],[.14,.75],[.38,.75],[.62,.75],[.86,.75]],9:[[.2,.15],[.5,.15],[.8,.15],[.2,.5],[.5,.5],[.8,.5],[.2,.85],[.5,.85],[.8,.85]]};
const BAMH={2:.4,3:.4,4:.4,5:.36,6:.4,7:.28,8:.4,9:.28};
const BAMC={2:'gb',3:'bgg',4:'gbbg',5:'ggrgg',6:'bbbggg',7:'rgggggg',8:'gbgbgbgb',9:'grggrggrg'};
const FLOWERS=['梅','蘭','菊','竹'],FLC=['#c23e68','#7646a6','#c27a12','#16704a'];
const SEASONS=['春','夏','秋','冬'],SEC=['#3f8a3a','#c0392b','#c9741c','#2c5aa0'];
function drawFace(f){
  const W=256,H=344;
  return canvasTex(W,H,(x)=>{
    const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#f9f3e3');g.addColorStop(1,'#ece2c8');x.fillStyle=g;x.fillRect(0,0,W,H);
    const rr=(a,b,w,h,r)=>{x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath();};
    const circ=(a,b,r,col)=>{x.beginPath();x.arc(a,b,r,0,Math.PI*2);x.fillStyle=col;x.fill();};
    const text=(s,a,b,size,col)=>{x.font=`700 ${size}px ${HAN}`;x.textAlign='center';x.textBaseline='middle';x.fillStyle=col;x.fillText(s,a,b);};
    const corner=s=>{x.font='700 25px system-ui,-apple-system,"Segoe UI",sans-serif';x.textAlign='left';x.textBaseline='top';x.fillStyle='rgba(28,26,23,.5)';x.fillText(s,20,16);};
    x.strokeStyle='rgba(120,96,60,.15)';x.lineWidth=3;rr(9,9,W-18,H-18,20);x.stroke();
    const F=FACES[f],ix=0.1*W,iy=0.09*H,iw=W-2*ix,ih=H-2*iy,P=(a,b)=>[ix+a*iw,iy+b*ih];
    const pin=(a,b,r,col)=>{circ(a,b,r,col);circ(a,b,r*.78,C.ivory);circ(a,b,r*.6,col);circ(a,b,r*.3,C.ivory);circ(a,b,r*.13,col);};
    const stick=(a,b,h,col)=>{const w=Math.max(16,h*0.24);x.fillStyle=col;rr(a-w/2,b-h/2,w,h,w*0.45);x.fill();x.fillStyle=C.ivory;[-0.2,0.2].forEach(o=>x.fillRect(a-w/2,b+o*h-1.5,w,3));x.fillStyle='rgba(255,255,255,.3)';x.fillRect(a-w*0.16,b-h/2+5,w*0.14,h-10);};
    if(F.suit==='dot'){
      if(F.n===1){const[a,b]=P(.5,.5),r=.44*iw;circ(a,b,r,C.green);circ(a,b,r*.88,C.ivory);for(let k=0;k<12;k++){const t=k/12*Math.PI*2;circ(a+Math.cos(t)*r*.74,b+Math.sin(t)*r*.74,r*.08,C.red);}circ(a,b,r*.58,C.blue);circ(a,b,r*.44,C.ivory);circ(a,b,r*.32,C.red);circ(a,b,r*.12,C.ivory);}
      else DOTS[F.n].forEach(([u,v],k)=>{const[a,b]=P(u,v);pin(a,b,DOTR[F.n]*iw,CC[DOTC[F.n][k]]);});
    }else if(F.suit==='bam'){
      if(F.n===1){const[a,b]=P(.5,.52);
        x.lineCap='round';[[C.red,-0.9],[C.green,-0.45],[C.blue,0]].forEach(([col,ang])=>{x.strokeStyle=col;x.lineWidth=11;x.beginPath();x.moveTo(a,b+22);x.quadraticCurveTo(a-30+ang*20,b+70,a-48+ang*30,b+108+ang*10);x.stroke();});
        x.fillStyle=C.green;x.beginPath();x.ellipse(a+4,b+8,40,54,0.15,0,Math.PI*2);x.fill();
        x.fillStyle=C.blue;x.beginPath();x.ellipse(a+18,b+12,20,36,0.35,0,Math.PI*2);x.fill();
        circ(a-6,b-58,24,C.green);x.fillStyle=C.red;x.beginPath();x.moveTo(a-16,b-78);x.lineTo(a-2,b-104);x.lineTo(a+6,b-76);x.fill();
        x.beginPath();x.moveTo(a-28,b-62);x.lineTo(a-52,b-54);x.lineTo(a-28,b-50);x.fill();circ(a-12,b-62,5,C.ivory);circ(a-12,b-62,2.4,C.black);}
      else BAM[F.n].forEach(([u,v],k)=>{const[a,b]=P(u,v);stick(a,b,BAMH[F.n]*ih,CC[BAMC[F.n][k]]);});
    }else if(F.suit==='char'){text('一二三四五六七八九'[F.n-1],W/2,H*0.31,W*0.46,C.num);text('萬',W/2,H*0.69,W*0.54,C.red);corner(String(F.n));}
    else if(F.suit==='wind'){text({E:'東',S:'南',W:'西',N:'北'}[F.n],W/2,H*0.53,W*0.66,C.black);corner(F.n);}
    else if(F.suit==='dragon'){
      if(F.n==='R')text('中',W/2,H*0.52,W*0.72,C.red);
      else if(F.n==='G')text('發',W/2,H*0.52,W*0.66,C.green);
      else{x.strokeStyle=C.blue;x.lineWidth=10;rr(W*.2,H*.17,W*.6,H*.66,12);x.stroke();x.lineWidth=3;rr(W*.29,H*.25,W*.42,H*.5,6);x.stroke();}
    }else if(F.suit==='flower'){
      const col=FLC[F.n],a=W/2,b=H*0.28;for(let k=0;k<5;k++){const t=k/5*Math.PI*2-Math.PI/2;circ(a+Math.cos(t)*19,b+Math.sin(t)*19,15,col);}circ(a,b,9,'#e2b13c');
      x.strokeStyle=C.green;x.lineWidth=5;x.beginPath();x.moveTo(a,b+30);x.quadraticCurveTo(a+18,b+44,a+40,b+40);x.stroke();
      text(FLOWERS[F.n],W/2,H*0.67,W*0.48,col);corner(String(F.n+1));
    }else if(F.suit==='season'){
      const col=SEC[F.n],a=W/2,b=H*0.27;x.strokeStyle=col;x.lineWidth=5;x.beginPath();x.arc(a,b,21,0,Math.PI*2);x.stroke();x.lineCap='round';for(let k=0;k<8;k++){const t=k/8*Math.PI*2;x.beginPath();x.moveTo(a+Math.cos(t)*29,b+Math.sin(t)*29);x.lineTo(a+Math.cos(t)*38,b+Math.sin(t)*38);x.stroke();}circ(a,b,9,col);
      text(SEASONS[F.n],W/2,H*0.67,W*0.48,col);corner(String(F.n+1));
    }
  });
}
let faceTex=[];
function buildFaceTextures(){const an=renderer.capabilities.getMaxAnisotropy();faceTex=FACES.map((_,i)=>{const t=drawFace(i);t.anisotropy=an;return t;});}

/* ---------- Tweens & particles ---------- */
const tweens=[];
const ease={out:p=>1-Math.pow(1-p,3),inOut:p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2,back:p=>{const c=1.5;return 1+(c+1)*Math.pow(p-1,3)+c*Math.pow(p-1,2);},lin:p=>p};
function tween(dur,fn,done,e,delay){tweens.push({t:-(delay||0),dur:reduceMotion?Math.min(dur,0.15):dur,fn,done,e:e||ease.out});}
function runTweens(dt){for(let i=tweens.length-1;i>=0;i--){const w=tweens[i];w.t+=dt;if(w.t<0)continue;const p=Math.min(1,w.t/w.dur);w.fn(w.e(p));if(p>=1){tweens.splice(i,1);w.done&&w.done();}}}
const parts=[];
function burst(pos,colors,n,o){
  o=o||{};n=reduceMotion?Math.ceil(n/3):n;const geo=new THREE.BufferGeometry(),P=new Float32Array(n*3),Cl=new Float32Array(n*3),vel=[];
  for(let k=0;k<n;k++){P[k*3]=pos.x+(o.spread||0)*(Math.random()-0.5);P[k*3+1]=pos.y;P[k*3+2]=pos.z+(o.spread||0)*(Math.random()-0.5);const th=Math.random()*Math.PI*2,ph=Math.random()*(o.cone||1.3),sp=(o.speed||4)*(0.4+Math.random()*0.8);vel.push(new THREE.Vector3(Math.cos(th)*Math.sin(ph)*sp,Math.cos(ph)*sp,Math.sin(th)*Math.sin(ph)*sp));const col=new THREE.Color(colors[k%colors.length]);Cl[k*3]=col.r;Cl[k*3+1]=col.g;Cl[k*3+2]=col.b;}
  geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('color',new THREE.BufferAttribute(Cl,3));
  const mat=new THREE.PointsMaterial({size:o.size||0.24,map:dotTex,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});
  const pts=new THREE.Points(geo,mat);scene.add(pts);parts.push({pts,vel,life:0,max:o.life||1,grav:o.grav!=null?o.grav:-7});
}
function runParts(dt){for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life+=dt;const a=p.pts.geometry.attributes.position;for(let k=0;k<p.vel.length;k++){const v=p.vel[k];v.y+=p.grav*dt;v.multiplyScalar(1-1.6*dt);a.array[k*3]+=v.x*dt;a.array[k*3+1]+=v.y*dt;a.array[k*3+2]+=v.z*dt;}a.needsUpdate=true;p.pts.material.opacity=Math.max(0,1-p.life/p.max);if(p.life>=p.max){scene.remove(p.pts);p.pts.geometry.dispose();p.pts.material.dispose();parts.splice(i,1);}}}

/* ---------- Game state ---------- */
const G={loaded:false,tiles:[],topo:null,sel:null,hover:null,hint:null,hintT:0,state:'play',dealing:0,undo:[],score:0,combo:0,comboT:0,bestCombo:0,matches:0,elapsed:0,limit:0,timeLeft:0,hintsUsed:0,shufflesUsed:0,undos:0,goldBonus:0,moves:0,fresh:true};
const COMBO_WIN=4.5;
const board=new THREE.Group();scene.add(board);
let pickables=[],bounds={x0:0,x1:0,z0:0,z1:0,y1:1};

function clearBoard(){G.gen=(G.gen||0)+1;G.dealing=0;G.tiles.forEach(t=>{t.faceMat.dispose();t.ivoryMat.dispose();});while(board.children.length)board.remove(board.children[0]);G.tiles=[];pickables=[];tweens.length=0;}
function buildBoard(spec,animate){
  clearBoard();
  const P=spec.map(s=>({x:s[0],y:s[1],z:s[2]}));G.topo=makeTopo(P);
  const maxX=Math.max(...P.map(p=>p.x))+2,maxY=Math.max(...P.map(p=>p.y))+2,cx=maxX/2,cy=maxY/2;
  let maxZ=0;
  spec.forEach((s,i)=>{
    const[x,y,z,face,alive,golden]=s;maxZ=Math.max(maxZ,z);
    const group=new THREE.Group(),pivot=new THREE.Group();group.add(pivot);pivot.position.y=TH/2;
    const ivoryMat=new THREE.MeshStandardMaterial({color:IVORY.clone(),roughness:0.42,emissive:new THREE.Color(0)});
    const faceMat=new THREE.MeshStandardMaterial({map:faceTex[face],roughness:0.42,emissive:new THREE.Color(0)});
    const back=new THREE.Mesh(GEO.back,golden?goldMat:backMat);back.position.y=-TH/2;
    const top=new THREE.Mesh(GEO.top,ivoryMat);top.position.y=-TH/2+BACK_H;
    const fm=new THREE.Mesh(GEO.face,faceMat);fm.position.y=TH/2+0.004;
    [back,top,fm].forEach(m=>{m.castShadow=m!==fm;m.receiveShadow=true;pivot.add(m);});
    const t={i,x,y,z,face,key:FACES[face].key,golden:!!golden,alive:alive!==0,free:false,group,pivot,faceMat,ivoryMat,shade:1,glow:0,emc:GOLD_E,lift:0,drop:0,baseY:z*TH,wx:(x+1-cx)*UX,wz:(y+1-cy)*UZ};
    [back,top,fm].forEach(m=>{m.userData.tile=t;pickables.push(m);});
    group.position.set(t.wx,t.baseY,t.wz);group.visible=t.alive;
    board.add(group);G.tiles.push(t);
  });
  bounds={x0:-cx*UX,x1:cx*UX,z0:-cy*UZ,z1:cy*UZ,y1:(maxZ+1)*TH};
  const s=Math.max(cx*UX,cy*UZ)+3;Object.assign(sun.shadow.camera,{left:-s,right:s,top:s,bottom:-s,near:1,far:60});sun.shadow.camera.updateProjectionMatrix();
  pool.scale.set(cx*UX*5,cy*UZ*5,1);
  if(animate){
    G.dealing++;let last=0;
    G.tiles.forEach(t=>{if(!t.alive)return;const d=reduceMotion?0:t.z*0.13+Math.hypot(t.wx,t.wz)*0.03+Math.random()*0.08;last=Math.max(last,d);t.drop=7;tween(0.55,e=>{t.drop=7*(1-e);},null,ease.back,d);});
    if(!reduceMotion)for(let k=0;k<7;k++)setTimeout(()=>Sfx.clack(),k*110+120);
    const gen=G.gen;setTimeout(()=>{if(gen===G.gen)G.dealing=Math.max(0,G.dealing-1);},(last+0.6)*1000);
  }
  computeFree();
}
function aliveArr(){const a=new Uint8Array(G.tiles.length);G.tiles.forEach(t=>a[t.i]=t.alive?1:0);return a;}
function computeFree(){
  const a=aliveArr(),byKey={};
  G.tiles.forEach(t=>{t.free=t.alive&&freeIn(t.i,a,G.topo);if(t.free)(byKey[t.key]=byKey[t.key]||[]).push(t);});
  G.moves=Object.values(byKey).reduce((s,l)=>s+l.length*(l.length-1)/2,0);G.byKey=byKey;
}
const aliveCount=()=>G.tiles.reduce((s,t)=>s+(t.alive?1:0),0);
function findPair(){for(const l of Object.values(G.byKey||{}))if(l.length>=2)return[l[0],l[1]];return null;}

function serialize(){return{diffKey:G.diffKey,level:G.level,daily:G.daily,dateStr:G.dateStr,name:G.name,spec:G.tiles.map(t=>[t.x,t.y,t.z,t.face,t.alive?1:0,t.golden?1:0]),score:G.score,bestCombo:G.bestCombo,matches:G.matches,elapsed:G.elapsed,timeLeft:G.timeLeft,limit:G.limit,hintsUsed:G.hintsUsed,shufflesUsed:G.shufflesUsed,goldBonus:G.goldBonus};}
function saveResume(){if(G.state==='play'&&G.matches>0){save.resume=serialize();persist();}}

function setupGame(s,animate){
  G.diffKey=s.diffKey;G.d=DIFFS[s.diffKey];G.level=s.level;G.daily=!!s.daily;G.dateStr=s.dateStr;G.name=s.name;
  buildBoard(s.spec,animate);
  G.score=s.score||0;G.bestCombo=s.bestCombo||0;G.matches=s.matches||0;G.elapsed=s.elapsed||0;G.hintsUsed=s.hintsUsed||0;G.shufflesUsed=s.shufflesUsed||0;G.goldBonus=s.goldBonus||0;
  G.limit=s.limit||(G.d.timed?Math.round(aliveCount()*3.2-Math.min(G.level-1,20)*4):0);G.timeLeft=s.timeLeft!=null?s.timeLeft:G.limit;
  G.combo=0;G.comboT=0;G.sel=null;G.hint=null;G.hover=null;G.undo=[];G.state='play';G.loaded=true;G.fresh=!s.matches;
  $('#incense').hidden=!G.d.timed;
  fitCamera();cam.tYaw=0;cam.tPitch=defaultPitch();cam.tZoom=1;
  if(animate&&!reduceMotion){cam.yaw=-0.5;cam.pitch=1.45;cam.zoom=1.35;}
  hud();
}
function startLevel(diffKey,level){
  const tall=isTall(),daily=diffKey==='daily',dateStr=todayStr();
  const seed=daily?`daily-${dateStr}${tall?'-t':''}`:`${diffKey}-${level}${tall?'-t':''}`;
  const lv=generateLevel(diffKey,daily?1:level,tall,seed);
  if(!daily){save.lastDiff=diffKey;}
  save.resume=null;persist();
  setupGame({diffKey,level:daily?1:level,daily,dateStr,name:daily?'Daily · '+prettyDate(dateStr):lv.name,spec:lv.tiles.map(p=>[p.x,p.y,p.z,p.face,1,p.golden?1:0])},true);
  showBanner();
}

/* ---------- Interaction ---------- */
function onTap(t){
  Sfx.ensure();
  if(G.state!=='play'||G.dealing>0||overlayOpen())return;
  if(!t){if(G.sel){G.sel=null;}return;}
  if(!t.free){shake(t);Sfx.thud();return;}
  if(G.sel===t){G.sel=null;Sfx.click();return;}
  if(G.sel&&G.sel.key===t.key){match(G.sel,t);return;}
  G.sel=t;Sfx.click();
}
function shake(t){tween(0.35,e=>{t.pivot.rotation.y=Math.sin(e*Math.PI*5)*0.13*(1-e);},()=>{t.pivot.rotation.y=0;},ease.lin);}
function match(a,b){
  G.undo.push({type:'m',a:a.i,b:b.i,score:G.score,matches:G.matches,goldBonus:G.goldBonus,timeLeft:G.timeLeft});
  G.combo=G.comboT>0?Math.min(9,G.combo+1):1;G.comboT=COMBO_WIN;G.bestCombo=Math.max(G.bestCombo,G.combo);
  const gold=(a.golden?1:0)+(b.golden?1:0);
  let pts=10*G.combo+(a.key==='F'||a.key==='S'?10:0)+gold*50;G.score+=pts;G.goldBonus+=gold*50;G.matches++;
  let extra=0;if(G.d.timed){extra=2+gold*8;G.timeLeft=Math.min(G.limit,G.timeLeft+extra);}
  a.alive=b.alive=false;G.sel=null;G.hint=null;G.fresh=false;
  const pa=a.group.position.clone(),pb=b.group.position.clone(),mid=pa.clone().add(pb).multiplyScalar(0.5);mid.y=Math.max(pa.y,pb.y)+1.7;
  [a,b].forEach((t,k)=>{const p0=t.group.position.clone(),rot=(k?1:-1)*0.7;
    tween(0.5,e=>{t.group.position.lerpVectors(p0,mid,e);t.group.position.y=p0.y+(mid.y-p0.y)*Math.sin(e*Math.PI/2);t.pivot.rotation.z=rot*e;t.group.scale.setScalar(Math.max(0.001,e<0.72?1:1-(e-0.72)/0.28));},
      ()=>{t.group.visible=false;t.group.scale.setScalar(1);t.pivot.rotation.set(0,0,0);if(k===0){const th=THEMES[save.settings.theme];burst(mid,gold?['#ffd76a','#fff1b8','#ffb030']:[th.css['--accent'],'#fff4d6',th.back],gold?70:36+G.combo*6,{speed:4+G.combo*0.4});}},ease.inOut);});
  setTimeout(()=>{popup(mid,`+${pts}${G.combo>1?'  ×'+G.combo:''}`,gold?'gold':'');if(extra)popup(mid.clone().add(new THREE.Vector3(0,0.9,0)),`+${extra}s`,'time');},420);
  Sfx.match(G.combo);if(gold)setTimeout(()=>Sfx.gold(),200);
  computeFree();hud();saveResume();
  const gen=G.gen;if(aliveCount()===0)setTimeout(()=>{if(gen===G.gen&&aliveCount()===0)win();},650);
  else if(G.moves===0)setTimeout(()=>{if(gen===G.gen&&G.state==='play'&&G.moves===0&&aliveCount()>0)openStuck();},800);
}
function undo(){
  if(G.state!=='play'&&G.state!=='stuck')return;if(G.dealing>0)return;
  const u=G.undo.pop();if(!u){toast('Nothing to undo');return;}
  if(u.type==='m'){[u.a,u.b].forEach(i=>{const t=G.tiles[i];t.alive=true;t.group.visible=true;t.group.position.set(t.wx,t.baseY,t.wz);t.pivot.rotation.set(0,0,0);t.drop=1.6;t.group.scale.setScalar(0.6);tween(0.35,e=>{t.drop=1.6*(1-e);t.group.scale.setScalar(0.6+0.4*e);},null,ease.back);});G.score=u.score;G.matches=u.matches;G.goldBonus=u.goldBonus;G.timeLeft=u.timeLeft;}
  else if(u.type==='s'){flipTo(u.faces);}
  G.combo=0;G.comboT=0;G.sel=null;G.hint=null;G.undos++;Sfx.clack();
  if(G.state==='stuck'){G.state='play';closeOverlays();}
  computeFree();hud();saveResume();
}
function hint(){
  if(G.state!=='play'||G.dealing>0)return;
  const left=G.d.hints-G.hintsUsed;if(left<=0){toast('No hints left on this level');Sfx.thud();return;}
  const p=findPair();if(!p){openStuck();return;}
  G.hintsUsed++;G.hint=p;G.hintT=3;G.sel=null;Sfx.hint();hud();saveResume();
}
function shuffle(fromStuck){
  if((G.state!=='play'&&G.state!=='stuck')||G.dealing>0)return;
  const left=G.d.shuffles-G.shufflesUsed,cost=left>0?0:250;
  const idx=G.tiles.filter(t=>t.alive).map(t=>t.i);if(idx.length<2)return;
  G.undo.push({type:'s',faces:G.tiles.map(t=>t.face)});
  const r=mulberry32((Date.now()^(Math.random()*1e9))>>>0),P=G.tiles.map(t=>({x:t.x,y:t.y,z:t.z}));
  const byKey={};idx.forEach(i=>{const f=G.tiles[i].face;(byKey[FACES[f].key]=byKey[FACES[f].key]||[]).push(f);});
  const pairs=[];let odd=false;Object.values(byKey).forEach(l=>{shuffleArr(r,l);if(l.length%2)odd=true;for(let j=0;j+1<l.length;j+=2)pairs.push([l[j],l[j+1]]);});
  let order=null;if(!odd)for(let k=0;k<120&&!order;k++)order=dealOrder(P,G.topo,r,idx);
  const nf=G.tiles.map(t=>t.face);
  if(order){shuffleArr(r,pairs);order.forEach(([a,b],q)=>{nf[a]=pairs[q][0];nf[b]=pairs[q][1];});}
  else{const fs=shuffleArr(r,idx.map(i=>G.tiles[i].face));idx.forEach((i,k)=>nf[i]=fs[k]);}
  if(left>0)G.shufflesUsed++;else{G.score=Math.max(0,G.score-cost);G.shufflesUsed++;}
  G.combo=0;G.comboT=0;G.sel=null;G.hint=null;
  if(G.state==='stuck'){G.state='play';closeOverlays();}
  flipTo(nf);Sfx.clack();for(let k=1;k<6;k++)setTimeout(()=>Sfx.clack(),k*70);
  if(cost)toast(`Shuffled for ${cost} points`);
  hud();
}
function flipTo(faces){
  G.dealing++;let last=0;
  G.tiles.forEach(t=>{if(!t.alive){t.face=faces[t.i];t.key=FACES[t.face].key;t.faceMat.map=faceTex[t.face];return;}
    const d=reduceMotion?0:Math.random()*0.25;last=Math.max(last,d);
    tween(0.22,e=>{t.pivot.rotation.z=Math.PI*e;t.drop=0.5*Math.sin(e*Math.PI/2);},()=>{t.face=faces[t.i];t.key=FACES[t.face].key;t.faceMat.map=faceTex[t.face];t.faceMat.needsUpdate=true;
      tween(0.22,e=>{t.pivot.rotation.z=Math.PI+Math.PI*e;t.drop=0.5*Math.cos(e*Math.PI/2);},()=>{t.pivot.rotation.z=0;t.drop=0;},ease.out);},ease.inOut,d);});
  const gen=G.gen;setTimeout(()=>{if(gen!==G.gen)return;G.dealing=Math.max(0,G.dealing-1);computeFree();hud();saveResume();if(G.state==='play'&&G.moves===0&&aliveCount()>0)openStuck();},(last+0.5)*1000);
  computeFree();
}
function win(){
  if(G.state!=='play')return;G.state='won';
  const d=G.d,n=G.tiles.length,par=Math.round(n*d.parPer),helps=G.hintsUsed+G.shufflesUsed;
  const timeBonus=d.timed?Math.round(G.timeLeft)*3:Math.max(0,Math.round(par-G.elapsed))*2;
  const clean=helps===0?200:0,matchPts=G.score-G.goldBonus,total=G.score+timeBonus+clean;
  let stars=3;if(d.timed?G.timeLeft<G.limit*0.25:G.elapsed>par)stars--;if(helps>0)stars--;stars=Math.max(1,stars);
  let prevBest=0;
  if(G.daily){prevBest=save.daily[G.dateStr]||0;if(total>prevBest)save.daily[G.dateStr]=total;}
  else{const p=save.prog[G.diffKey];prevBest=p.best[G.level]||0;p.unlocked=Math.max(p.unlocked,G.level+1);p.stars[G.level]=Math.max(p.stars[G.level]||0,stars);p.best[G.level]=Math.max(prevBest,total);}
  save.resume=null;persist();
  Sfx.win();celebrate();
  $('#winName').textContent=G.name;
  $('#winEyebrow').textContent=G.daily?'Daily challenge cleared':`${d.name} · Level ${G.level} cleared`;
  $('#winRows').innerHTML=[['Matches & combos',matchPts],['Golden pair',G.goldBonus],[d.timed?'Incense left':'Time bonus',timeBonus],['No hints or shuffles',clean]].map(([k,v])=>`<div><dt>${k}</dt><dd>${v?'+'+v.toLocaleString():'—'}</dd></div>`).join('')+`<div class="tot"><dt>Total</dt><dd>${total.toLocaleString()}</dd></div>`;
  $('#winMeta').textContent=`Cleared in ${fmtTime(G.elapsed)} · best combo ×${G.bestCombo}`+(total>prevBest&&prevBest>0?' · new best':prevBest?` · best ${prevBest.toLocaleString()}`:'');
  [...document.querySelectorAll('#stars svg')].forEach((s,i)=>{s.classList.toggle('on',i<stars);s.style.animationDelay=(0.35+i*0.18)+'s';});
  $('#winNext').hidden=G.daily;
  setTimeout(()=>openOverlay('win'),1300);
}
function celebrate(){const th=THEMES[save.settings.theme],cols=[th.css['--accent'],'#ffffff','#ff8a6a','#8af0c0','#ffd76a'];const span=Math.max(bounds.x1,bounds.z1);for(let k=0;k<16;k++)setTimeout(()=>{burst(new THREE.Vector3((Math.random()-0.5)*span*1.6,2+Math.random()*3,(Math.random()-0.5)*span*1.2),cols,60,{speed:6,cone:Math.PI,grav:-3,life:1.6,size:0.3});},k*140);}
function openStuck(){if(G.state!=='play')return;G.state='stuck';G.sel=null;const left=G.d.shuffles-G.shufflesUsed;$('#stuckText').textContent=`${aliveCount()} tiles remain, but no free pair matches.`;$('#stuckShuffle').textContent=left>0?(isFinite(left)?`Shuffle (${left} left)`:'Shuffle'):'Shuffle for 250 points';$('#stuckUndo').disabled=!G.undo.length;Sfx.thud();openOverlay('stuck');}
function timeout(){G.state='timeout';save.resume=null;persist();Sfx.lose();$('#timeoutText').textContent=`${aliveCount()} tiles were left on ${G.name}.`;openOverlay('timeout');}

/* ---------- Camera ---------- */
const cam={yaw:0,pitch:1.1,zoom:1,tYaw:0,tPitch:1.1,tZoom:1,base:20};
const defaultPitch=()=>isTall()?1.22:1.08;
function camPos(r,yaw,pitch){camera.position.set(Math.sin(yaw)*Math.cos(pitch)*r,0.4+Math.sin(pitch)*r,Math.cos(yaw)*Math.cos(pitch)*r);camera.lookAt(0,0.4,0);}
function fitCamera(){
  const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();
  const top=($('.hud-top').offsetHeight||70)+6,bot=($('.toolbar').offsetHeight||80)+4;
  const yMax=1-2*top/h,yMin=-1+2*bot/h,xLim=1-2*14/w;
  const pts=[];[bounds.x0,bounds.x1].forEach(x=>[bounds.z0,bounds.z1].forEach(z=>[0,bounds.y1].forEach(y=>pts.push(new THREE.Vector3(x,y,z)))));
  let lo=3,hi=300;const p=defaultPitch();
  for(let k=0;k<32;k++){const mid=(lo+hi)/2;camPos(mid,0,p);camera.updateMatrixWorld();let ok=true;for(const v of pts){const q=v.clone().project(camera);if(q.x<-xLim||q.x>xLim||q.y<yMin||q.y>yMax||q.z>1){ok=false;break;}}if(ok)hi=mid;else lo=mid;}
  cam.base=hi;
}
function resize(){renderer.setSize(innerWidth,innerHeight,false);fitCamera();}
addEventListener('resize',resize);

/* ---------- Pointer input ---------- */
const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
function pickTile(x,y){const r=canvas.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,-((y-r.top)/r.height)*2+1);raycaster.setFromCamera(ndc,camera);const hits=raycaster.intersectObjects(pickables,false);for(const h of hits){const t=h.object.userData.tile;if(t&&t.alive)return t;}return null;}
const ptrs=new Map();let drag=null,pinch0=0,zoom0=1;
const pdist=()=>{const a=[...ptrs.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1;};
canvas.addEventListener('pointerdown',e=>{try{canvas.setPointerCapture(e.pointerId);}catch(_){}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptrs.size===1)drag={sx:e.clientX,sy:e.clientY,lx:e.clientX,ly:e.clientY,moved:false};else{if(drag)drag.moved=true;pinch0=pdist();zoom0=cam.tZoom;}});
canvas.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId)){if(e.pointerType==='mouse'){const t=pickTile(e.clientX,e.clientY);G.hover=t;canvas.style.cursor=t&&t.free&&G.state==='play'?'pointer':'default';}return;}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){cam.tZoom=clamp(zoom0*pinch0/pdist(),0.45,1.8);return;}
  if(drag){const dx=e.clientX-drag.lx,dy=e.clientY-drag.ly;drag.lx=e.clientX;drag.ly=e.clientY;if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>8)drag.moved=true;if(drag.moved){cam.tYaw=clamp(cam.tYaw-dx*0.006,-0.9,0.9);cam.tPitch=clamp(cam.tPitch+dy*0.005,0.62,1.5);}}
});
const pUp=e=>{if(!ptrs.has(e.pointerId))return;const single=ptrs.size===1;ptrs.delete(e.pointerId);if(single&&drag&&!drag.moved&&e.type==='pointerup')onTap(pickTile(e.clientX,e.clientY));if(ptrs.size===0)drag=null;};
canvas.addEventListener('pointerup',pUp);canvas.addEventListener('pointercancel',pUp);
canvas.addEventListener('pointerleave',()=>{G.hover=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();cam.tZoom=clamp(cam.tZoom*Math.exp(e.deltaY*0.0012),0.45,1.8);},{passive:false});
function recenter(){cam.tYaw=0;cam.tPitch=defaultPitch();cam.tZoom=1;}

/* ---------- HUD & overlays ---------- */
const fmtTime=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
function hud(){
  if(!G.loaded)return;
  $('#hudDiff').textContent=G.daily?'Daily challenge':G.d.name;
  $('#hudLevel').textContent=G.daily?prettyDate(G.dateStr):'Level '+G.level;
  $('#hudName').textContent=G.daily?'One layout for everyone, today':G.name;
  $('#hudScore').textContent=G.score.toLocaleString();
  $('#hudCombo').textContent='×'+Math.max(1,G.combo);
  $('#hudTiles').textContent=aliveCount();
  $('#hudMoves').textContent=G.moves;$('#statMoves').classList.toggle('low',G.moves<=1&&aliveCount()>0);
  $('#hudTimeK').textContent=G.d.timed?'Incense':'Time';
  const hl=G.d.hints-G.hintsUsed,sl=G.d.shuffles-G.shufflesUsed;
  $('#nHint').textContent=isFinite(hl)?hl:'∞';$('#btnHint').classList.toggle('empty',hl<=0);
  $('#nShuffle').textContent=sl>0?(isFinite(sl)?sl:'∞'):'−250';
  $('#btnUndo').disabled=!G.undo.length;
  const hb=$('#btnHighlight');hb.disabled=!!G.d.noHighlight;hb.setAttribute('aria-pressed',String(save.settings.highlight&&!G.d.noHighlight));hb.title=G.d.noHighlight?'Emperor hides the free-tile glow':'Dim blocked tiles (F)';
  $('#btnSound').setAttribute('aria-pressed',String(save.settings.sound));
}
let lastSec=-1;
function hudTick(){
  if(!G.loaded)return;
  const v=G.d.timed?G.timeLeft:G.elapsed,s=Math.floor(v);
  if(s!==lastSec){lastSec=s;$('#hudTime').textContent=fmtTime(v);$('#statTime').classList.toggle('warn',!!G.d.timed&&v<=20);}
  $('#comboBar').style.width=(G.comboT/COMBO_WIN*100)+'%';
  if(G.d.timed)$('#incense i').style.width=(G.timeLeft/G.limit*100)+'%';
}
const overlayOpen=()=>!!document.querySelector('.overlay:not([hidden])');
function openOverlay(id){document.querySelectorAll('.overlay').forEach(o=>o.hidden=o.id!==id);const f=$('#'+id+' [data-autofocus]');if(f)setTimeout(()=>{try{f.focus({preventScroll:true});}catch(_){}},50);}
function closeOverlays(){cam.tYaw=0;document.querySelectorAll('.overlay').forEach(o=>o.hidden=true);}
let toastT=0;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;},1900);}
function popup(pos,text,cls){const v=pos.clone().project(camera),el=document.createElement('div');el.className='pop '+(cls||'');el.textContent=text;el.style.left=((v.x+1)/2*innerWidth)+'px';el.style.top=((1-v.y)/2*innerHeight)+'px';$('#fx').appendChild(el);setTimeout(()=>el.remove(),1200);}
function showBanner(){const b=$('#banner');$('#bannerEyebrow').textContent=G.daily?'Daily challenge':`${G.d.name} · Level ${G.level}`;$('#bannerName').textContent=G.daily?prettyDate(G.dateStr):G.name;$('#bannerMeta').textContent=`${G.tiles.length} tiles${G.d.timed?' · '+fmtTime(G.limit)+' of incense':''}`;b.hidden=false;b.classList.remove('show');void b.offsetWidth;b.classList.add('show');setTimeout(()=>{b.hidden=true;},2600);}

/* ---------- Menu ---------- */
let menuSel=save.lastDiff,menuLevel=save.prog[menuSel]?save.prog[menuSel].unlocked:1;
const GLYPHC={breeze:'#1c1a17',garden:'#bb2a2a',dragon:'#16704a',emperor:'#1f4c98'};
function renderMenu(){
  $('#diffs').innerHTML=['breeze','garden','dragon','emperor'].map(k=>{const d=DIFFS[k],p=save.prog[k],st=totalStars(k);return `<button class="diff" role="radio" aria-checked="${k===menuSel}" data-k="${k}"><span class="mini" style="color:${GLYPHC[k]}">${d.glyph}</span><span class="dtx"><span class="nm">${d.name}</span><span class="ds">${d.desc}</span></span><span class="pg"><b>Lv ${p.unlocked}</b>★ ${st}</span></button>`;}).join('');
  document.querySelectorAll('.diff').forEach(b=>b.onclick=()=>{menuSel=b.dataset.k;menuLevel=save.prog[menuSel].unlocked;Sfx.click();renderMenu();});
  const p=save.prog[menuSel];menuLevel=clamp(menuLevel,1,p.unlocked);
  $('#lvOut').textContent='Level '+menuLevel;$('#lvPrev').disabled=menuLevel<=1;$('#lvNext').disabled=menuLevel>=p.unlocked;
  const st=p.stars[menuLevel];$('#lvStars').textContent=st?'★'.repeat(st)+'☆'.repeat(3-st)+' · best '+(p.best[menuLevel]||0).toLocaleString():'Not cleared yet';
  const inGame=G.loaded&&G.state==='play'&&!G.fresh;
  $('#resumeBtn').hidden=!inGame;
  if(inGame)$('#resumeBtn').innerHTML=`<span>Resume</span><small>${G.daily?'Daily':G.d.name} · ${G.daily?prettyDate(G.dateStr):'Lv '+G.level} · ${aliveCount()} tiles left</small>`;
  const db=save.daily[todayStr()];$('#dailyMeta').textContent=prettyDate(todayStr())+(db?' · best '+db.toLocaleString():' · not played');
  document.querySelectorAll('[data-theme-k]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeK===save.settings.theme)));
  $('#optSound').setAttribute('aria-pressed',String(save.settings.sound));$('#optHighlight').setAttribute('aria-pressed',String(save.settings.highlight));
}
function openMenu(){renderMenu();openOverlay('menu');}
$('#lvPrev').onclick=()=>{menuLevel--;renderMenu();};$('#lvNext').onclick=()=>{menuLevel++;renderMenu();};
$('#playBtn').onclick=()=>{Sfx.ensure();if(G.loaded&&G.fresh&&G.state==='play'&&!G.daily&&G.diffKey===menuSel&&G.level===menuLevel){closeOverlays();showBanner();return;}startLevel(menuSel,menuLevel);closeOverlays();};
$('#resumeBtn').onclick=()=>{Sfx.ensure();closeOverlays();};
$('#dailyBtn').onclick=()=>{Sfx.ensure();startLevel('daily',1);closeOverlays();};
document.querySelectorAll('[data-theme-k]').forEach(b=>b.onclick=()=>{applyTheme(b.dataset.themeK);renderMenu();});
$('#optSound').onclick=()=>{toggleSound();renderMenu();};
$('#optHighlight').onclick=()=>{save.settings.highlight=!save.settings.highlight;persist();renderMenu();hud();};
function applyTheme(k){const th=THEMES[k]||THEMES.jade;save.settings.theme=k in THEMES?k:'jade';persist();scene.background.set(th.bg);scene.fog.color.copy(lin(th.bg));feltMat.color.copy(lin(th.felt)).multiplyScalar(1.35);backMat.color.copy(lin(th.back));poolMat.color.copy(lin(th.pool));Object.entries(th.css).forEach(([a,b])=>document.documentElement.style.setProperty(a,b));}
function toggleSound(){save.settings.sound=!save.settings.sound;persist();hud();if(save.settings.sound)Sfx.click();}

/* toolbar */
$('#btnMenu').onclick=()=>openMenu();
$('#btnUndo').onclick=undo;$('#btnHint').onclick=hint;$('#btnShuffle').onclick=()=>shuffle(false);
$('#btnHighlight').onclick=()=>{save.settings.highlight=!save.settings.highlight;persist();hud();};
$('#btnView').onclick=recenter;$('#btnSound').onclick=toggleSound;
$('#winNext').onclick=()=>{startLevel(G.diffKey,G.level+1);closeOverlays();};
$('#winReplay').onclick=()=>{startLevel(G.diffKey,G.level);closeOverlays();};
$('#winMenu').onclick=()=>{menuSel=G.daily?menuSel:G.diffKey;menuLevel=G.daily?menuLevel:Math.min(G.level+1,save.prog[G.diffKey].unlocked);openMenu();};
$('#stuckShuffle').onclick=()=>shuffle(true);$('#stuckUndo').onclick=undo;
$('#stuckRestart').onclick=()=>{startLevel(G.diffKey,G.level);closeOverlays();};
$('#toRetry').onclick=()=>{startLevel(G.diffKey,G.level);closeOverlays();};$('#toMenu').onclick=openMenu;
addEventListener('keydown',e=>{
  if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k==='escape'){if(!$('#menu').hidden){if(G.loaded&&G.state==='play')closeOverlays();}else if(!overlayOpen())openMenu();return;}
  if(overlayOpen()||!G.loaded)return;
  if(k==='h')hint();else if(k==='z'||(k==='u'))undo();else if(k==='s')shuffle(false);else if(k==='f'&&!G.d.noHighlight){save.settings.highlight=!save.settings.highlight;persist();hud();}else if(k==='r')recenter();else if(k==='m')toggleSound();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveResume();});

/* ---------- Main loop ---------- */
let lastT=performance.now(),clock=0,sparkT=0;
function frame(now){
  const dt=Math.min(0.05,(now-lastT)/1000);lastT=now;clock+=dt;
  const running=G.loaded&&G.state==='play'&&!overlayOpen()&&!document.hidden&&G.dealing===0;
  if(running){G.elapsed+=dt;if(G.comboT>0)G.comboT=Math.max(0,G.comboT-dt);if(G.d.timed){G.timeLeft-=dt;if(G.timeLeft<=0){G.timeLeft=0;timeout();}}}
  if(G.hintT>0){G.hintT-=dt;if(G.hintT<=0)G.hint=null;}
  runTweens(dt);runParts(dt);
  const k=Math.min(1,dt*7);cam.yaw+=(cam.tYaw-cam.yaw)*k;cam.pitch+=(cam.tPitch-cam.pitch)*k;cam.zoom+=(cam.tZoom-cam.zoom)*k;
  if(overlayOpen()&&G.state==='play')cam.tYaw=Math.sin(clock*0.15)*0.18;
  camPos(cam.base*cam.zoom,cam.yaw,cam.pitch);
  const hl=save.settings.highlight&&G.d&&!G.d.noHighlight,s=Math.min(1,dt*10),gk=Math.min(1,dt*14);
  for(const t of G.tiles){
    if(!t.group.visible)continue;
    const ts=t.alive&&hl&&!t.free?0.44:1;t.shade+=(ts-t.shade)*s;
    let em=0,ec=GOLD_E,lt=0;const hinted=G.hint&&(G.hint[0]===t||G.hint[1]===t);
    if(t===G.sel){em=0.45;lt=0.16;}else if(hinted){em=0.28+0.22*Math.sin(clock*9);ec=HINT_E;em=0.4+0.3*Math.sin(clock*9);lt=0.14+0.08*Math.sin(clock*9);}else if(t===G.hover&&t.free&&G.state==='play'){em=0.13;lt=0.03;}
    t.glow+=(em-t.glow)*gk;t.emc=ec;t.lift+=(lt-t.lift)*Math.min(1,dt*12);
    t.faceMat.color.setScalar(t.shade);t.ivoryMat.color.copy(IVORY).multiplyScalar(t.shade);
    t.faceMat.emissive.copy(ec).multiplyScalar(t.glow);t.ivoryMat.emissive.copy(ec).multiplyScalar(t.glow*0.7);
    if(t.alive)t.group.position.y=t.baseY+t.lift+t.drop;
  }
  sparkT-=dt;if(sparkT<=0&&G.loaded){sparkT=0.6;G.tiles.forEach(t=>{if(t.alive&&t.golden&&t.group.visible&&Math.random()<0.7){const p=t.group.position.clone();p.y+=TH+0.05;burst(p,['#ffe08a','#fff6d0'],5,{speed:0.9,grav:0.6,life:0.9,size:0.14,spread:0.7});}});}
  hudTick();
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}

/* ---------- Boot ---------- */
async function fontsReady(){try{await Promise.race([Promise.all([document.fonts.load(`700 64px "Noto Serif TC"`,'萬東發中'),document.fonts.load('800 32px "Shippori Mincho B1"')]),new Promise(r=>setTimeout(r,2600))]);}catch(e){}}
function start(data){
  applyTheme(save.settings.theme);renderMenu();openOverlay('menu');resize();
  fontsReady().then(()=>{
    buildFaceTextures();
    const g=data&&data.game;
    if(g&&g.spec){setupGame(g,false);if(!data.menu)closeOverlays();else renderMenu();}
    else if(save.resume&&save.resume.spec){setupGame(save.resume,false);renderMenu();}
    else{const k=save.lastDiff in save.prog?save.lastDiff:'garden';startLevel(k,save.prog[k].unlocked);$('#banner').hidden=true;renderMenu();}
    resize();requestAnimationFrame(frame);
  });
  try{window.claude&&window.claude.hot&&window.claude.hot.snapshot&&window.claude.hot.snapshot(()=>({game:G.loaded&&G.state==='play'?serialize():null,menu:!$('#menu').hidden}));}catch(e){}
}
window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});
})();
