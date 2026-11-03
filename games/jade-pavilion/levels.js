/* ---------- Seeded randomness ---------- */
function hashStr(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19;}h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^=h>>>16)>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rngFor=s=>mulberry32(hashStr(s));
const ri=(r,a,b)=>a+Math.floor(r()*(b-a+1));
const pick=(r,arr)=>arr[Math.floor(r()*arr.length)];
function shuffleArr(r,a){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}

/* ---------- Tile set ---------- */
const FACES=[];
['dot','bam','char'].forEach(s=>{for(let n=1;n<=9;n++)FACES.push({suit:s,n,key:s+n});});
['E','S','W','N'].forEach(w=>FACES.push({suit:'wind',n:w,key:'w'+w}));
['R','G','Wh'].forEach(d=>FACES.push({suit:'dragon',n:d,key:'d'+d}));
for(let i=0;i<4;i++)FACES.push({suit:'flower',n:i,key:'F'});
for(let i=0;i<4;i++)FACES.push({suit:'season',n:i,key:'S'});
function groupTiles(g,r){if(g<34)return[g,g,g,g];if(g===34)return shuffleArr(r,[34,35,36,37]);return shuffleArr(r,[38,39,40,41]);}
function buildPairs(nPairs,r){
  const groups=shuffleArr(r,[...Array(36).keys()]);const pairs=[];let gi=0;
  while(pairs.length<nPairs){const t=groupTiles(groups[gi++%36],r);pairs.push([t[0],t[1]]);if(pairs.length<nPairs)pairs.push([t[2],t[3]]);}
  return shuffleArr(r,pairs);
}

/* ---------- Difficulty ---------- */
const DIFFS={
  breeze:{key:'breeze',name:'Breeze',glyph:'風',min:40,step:4,max:84,layers:2,maxLayers:3,hints:Infinity,shuffles:Infinity,parPer:5,desc:'Low, open layouts. Unlimited hints and shuffles.'},
  garden:{key:'garden',name:'Garden',glyph:'花',min:72,step:4,max:120,layers:3,maxLayers:4,hints:5,shuffles:3,parPer:4.5,desc:'Three layers deep. Five hints and three shuffles a level.'},
  dragon:{key:'dragon',name:'Dragon',glyph:'龍',min:104,step:4,max:144,layers:4,maxLayers:5,hints:3,shuffles:2,parPer:4,desc:'Tall stacks, up to the full 144 tiles. Three hints.'},
  emperor:{key:'emperor',name:'Emperor',glyph:'皇',min:144,step:0,max:144,layers:5,maxLayers:6,hints:1,shuffles:1,parPer:3.5,timed:true,noHighlight:true,desc:'All 144 tiles against a burning incense clock. No free-tile glow.'},
  daily:{key:'daily',name:'Daily',glyph:'日',min:120,step:0,max:120,layers:4,maxLayers:4,hints:3,shuffles:2,parPer:4,desc:'One shared layout per day.'}
};
function levelTarget(d,level){let t=Math.min(d.max,d.min+d.step*(level-1));return t-(t%2);}
function levelLayers(d,level){return Math.min(d.maxLayers,d.layers+Math.floor((level-1)/10));}

/* ---------- Layout generator (grid units: a tile spans 2x2) ---------- */
function tryLayout(r,maxLayers,tall){
  const W=tall?ri(r,5,8):ri(r,7,13), H=tall?ri(r,7,11):ri(r,4,8);
  const vsym=r()<0.55, cells=new Set(), K=(i,j)=>i+','+j;
  const add=(i,j)=>{if(i<0||j<0||i>=W||j>=H)return;cells.add(K(i,j));cells.add(K(W-1-i,j));if(vsym){cells.add(K(i,H-1-j));cells.add(K(W-1-i,H-1-j));}};
  const rect=(i0,j0,w,h)=>{for(let i=i0;i<i0+w;i++)for(let j=j0;j<j0+h;j++)add(i,j);};
  const cw=ri(r,Math.ceil(W*0.4),W), ch=ri(r,Math.ceil(H*0.5),H);
  rect(Math.floor((W-cw)/2),Math.floor((H-ch)/2),cw,ch);
  const extra=ri(r,0,3);
  for(let k=0;k<extra;k++){const w=ri(r,1,Math.ceil(W/2)),h=ri(r,1,H);rect(ri(r,0,Math.max(0,Math.floor(W/2)-1)),ri(r,0,H-h),w,h);}
  if(r()<0.3&&W>=7){const i=ri(r,1,Math.floor(W/2)-1),j=ri(r,0,H-1);[K(i,j),K(W-1-i,j),K(i,H-1-j),K(W-1-i,H-1-j)].forEach((k,q)=>{if(q<2||vsym)cells.delete(k);});}
  const split=k=>k.split(',').map(Number);
  const layers=[cells];
  for(let z=1;z<maxLayers;z++){
    const prev=layers[z-1];let minI=1e9,maxI=-1,minJ=1e9,maxJ=-1;
    prev.forEach(k=>{const[i,j]=split(k);minI=Math.min(minI,i);maxI=Math.max(maxI,i);minJ=Math.min(minJ,j);maxJ=Math.max(maxJ,j);});
    const insJ=(maxJ-minJ>=3&&r()<0.65)?1:0, next=new Set();
    prev.forEach(k=>{const[i,j]=split(k);if(i>=minI+1&&i<=maxI-1&&j>=minJ+insJ&&j<=maxJ-insJ&&prev.has(K(i-1,j))&&prev.has(K(i+1,j)))next.add(k);});
    if(next.size<2)break;
    layers.push(next);
  }
  const tiles=[];
  layers.forEach((L,z)=>L.forEach(k=>{const[i,j]=split(k);tiles.push({x:2*i,y:2*j,z});}));
  if(H%2===0&&r()<0.5){
    const j1=H/2-1,j2=H/2;let mi=-1;
    for(let i=0;i<W;i++){if(cells.has(K(i,j1))&&cells.has(K(i,j2))){mi=i;break;}}
    if(mi>=0&&!cells.has(K(mi-1,j1))&&!cells.has(K(mi-1,j2))){
      const n=r()<0.4?2:1;
      for(let w=1;w<=n;w++){
        if(w===2&&(cells.has(K(mi-2,j1))||cells.has(K(mi-2,j2))))break;
        const x=2*(mi-w),y=H-1;tiles.push({x,y,z:0});tiles.push({x:2*(W-1)-x,y,z:0});
      }
    }
  }
  const topZ=layers.length-1, top=layers[topZ], cx=W-1, cy=H-1;
  const is=cx%2===0?[cx/2]:[(cx-1)/2,(cx+1)/2], js=cy%2===0?[cy/2]:[(cy-1)/2,(cy+1)/2];
  if(topZ>0&&is.length*js.length>1&&is.every(i=>js.every(j=>top.has(K(i,j))))&&r()<0.75)tiles.push({x:cx,y:cy,z:topZ+1});
  const mx=Math.min(...tiles.map(t=>t.x)),my=Math.min(...tiles.map(t=>t.y));
  tiles.forEach(t=>{t.x-=mx;t.y-=my;});
  return tiles;
}
function trimLayout(T,target){
  const minX=Math.min(...T.map(t=>t.x)),maxX=Math.max(...T.map(t=>t.x)),span=minX+maxX;
  const covered=t=>T.some(u=>u.z===t.z+1&&Math.abs(u.x-t.x)<2&&Math.abs(u.y-t.y)<2);
  const need=()=>T.length>target||T.length%2===1;
  while(need()){
    let c=T.filter(t=>!covered(t));const mz=Math.max(...c.map(t=>t.z));c=c.filter(t=>t.z===mz);
    c.sort((a,b)=>Math.abs(b.x*2-span)-Math.abs(a.x*2-span)||a.y-b.y);
    const t=c[0];T.splice(T.indexOf(t),1);
    if(need()){const m=T.find(u=>u.z===t.z&&u.y===t.y&&u.x===span-t.x);if(m&&!covered(m))T.splice(T.indexOf(m),1);}
  }
  return T;
}
function genLayout(r,target,maxLayers,tall){
  let best=null,bd=1e9;
  for(let t=0;t<400;t++){
    const L=tryLayout(r,maxLayers,tall);
    const d=L.length>=target?(L.length-target)*0.5:(target-L.length)*1.6;
    if(d<bd){bd=d;best=L;}
    if(L.length>=target&&L.length<=target+10)break;
  }
  return trimLayout(best,target);
}

/* ---------- Topology & solvable dealing ---------- */
function makeTopo(P){
  const n=P.length,above=[],left=[],right=[];
  for(let i=0;i<n;i++){above.push([]);left.push([]);right.push([]);}
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    if(i===j)continue;const a=P[i],b=P[j],dx=b.x-a.x,dy=Math.abs(b.y-a.y);
    if(b.z===a.z+1&&Math.abs(dx)<2&&dy<2)above[i].push(j);
    else if(b.z===a.z&&dy<2){if(dx===-2)left[i].push(j);else if(dx===2)right[i].push(j);}
  }
  return{above,left,right};
}
function freeIn(i,alive,topo){
  for(const j of topo.above[i])if(alive[j])return false;
  let l=true;for(const j of topo.left[i])if(alive[j]){l=false;break;}
  if(l)return true;
  for(const j of topo.right[i])if(alive[j])return false;
  return true;
}
function wpick(r,arr,wf){let tot=0;const w=arr.map(i=>{const v=wf(i);tot+=v;return v;});let x=r()*tot;for(let k=0;k<arr.length;k++){x-=w[k];if(x<=0)return arr[k];}return arr[arr.length-1];}
function dealOrder(P,topo,r,indices){
  const alive=new Uint8Array(P.length);indices.forEach(i=>alive[i]=1);
  let rem=indices.length;const order=[];
  while(rem>0){
    const free=[];for(const i of indices)if(alive[i]&&freeIn(i,alive,topo))free.push(i);
    if(free.length<2)return null;
    const wf=i=>1+P[i].z*1.6;
    const a=wpick(r,free,wf),b=wpick(r,free.filter(i=>i!==a),wf);
    alive[a]=alive[b]=0;rem-=2;order.push([a,b]);
  }
  return order;
}
const NAME_A=['Floating','Hidden','Western','Upper','Old','Lesser','Northern','Quiet','Crimson','Sunken'];
const NAME_P=['Pavilion','Terrace','Gate','Garden','Bridge','Pagoda','Courtyard','Tower','Hall','Pond','Grotto','Orchard','Pass','Shrine','Library','Market','Harbor','Teahouse','Cloister','Observatory'];
const NAME_O=['Quiet Rain','Falling Plum','Nine Dragons','the Jade Moon','Silver Carp','Drifting Clouds','Red Lanterns','the White Crane','Bamboo Wind','Morning Frost','the Sleeping Tiger','Autumn Ink','Golden Koi','Hidden Stars','the Willow','Distant Thunder','Peach Blossom','Ten Thousand Steps','Paper Kites','Mountain Mist','the Silk Road','Lotus Smoke','the Iron Bell','Winter Plum'];
function levelName(r){return (r()<0.4?pick(r,NAME_A)+' ':'')+pick(r,NAME_P)+' of '+pick(r,NAME_O);}
function generateLevel(diffKey,level,tall,seed){
  const d=DIFFS[diffKey],r=rngFor(seed);
  const target=levelTarget(d,level),layers=levelLayers(d,level);
  const name=levelName(r);
  for(let attempt=0;attempt<30;attempt++){
    const P=genLayout(r,target,layers,tall),topo=makeTopo(P),idx=P.map((_,i)=>i);
    for(let k=0;k<60;k++){
      const order=dealOrder(P,topo,r,idx);
      if(!order)continue;
      const pairs=buildPairs(order.length,r);
      order.forEach(([a,b],q)=>{P[a].face=pairs[q][0];P[b].face=pairs[q][1];});
      const g=order[Math.floor(order.length*(0.25+0.5*r()))];
      P[g[0]].golden=P[g[1]].golden=true;
      return{tiles:P,name};
    }
  }
  return null;
}
