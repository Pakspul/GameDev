// Unscrew's realism mode: finished models made in Blender and loaded as glTF (.glb) files, next to 2D and 3D.
// How to make one: docs/UNSCREW-BLENDER.md; the Blender side is in blender/unscrew/.
// What a .glb must look like (blender/unscrew/unscrew_kit.py says the same from Blender's side):
//   - every top-level object is a part: one mesh with one material; custom property static=1 for the ground
//   - its children: empties named "screw…" are screw slots (their arrow, local +Z in Blender, points out; force=1
//     makes an anchor), a mesh named "…_proxy" is its closed collision shape, any other mesh is decoration
//   - minCx on a part, decoration or slot leaves it out below that complexity (cfgFor() in game.js)
//   - material names are palette keys, so a level can recolour them
// A model still changes from level to level: finalize() picks the screws and their colours and proves the level
// solvable as for any 3D model, minCx adds detail as the difficulty goes up, and palettes recolour it.
// The files load on first use (REAL.load()), so 2D and 3D players never download them.

// Append new models at the end and never reorder: the position decides which model each level shows.
// palettes: one is picked per level; null keeps the colours from Blender.
const REAL_MODELS=[
  {name:'owl',cat:'animals',file:'real/owl.glb',palettes:[null,
    {owl_main:'#efe9df',owl_dark:'#8c8378',owl_light:'#ffffff',owl_face:'#ffffff',owl_eye:'#ffd23f'},
    {owl_main:'#a3aab3',owl_dark:'#5f6873',owl_light:'#e3e7ec',owl_face:'#f2f4f7',owl_eye:'#ff9f1c'},
    {owl_main:'#c4b0e2',owl_dark:'#8a70bb',owl_light:'#f4edfc',owl_face:'#fcf9ff',owl_eye:'#8fd61f',owl_beak:'#ff9d5c'}]}];

const REAL={ready:false,parts:{},promise:null,
  load(){
    if(this.promise)return this.promise;
    const loader=new THREE.GLTFLoader();
    const one=m=>new Promise((res,rej)=>loader.load(m.file,g=>{try{this.parts[m.name]=prepReal(g.scene,m.file);res()}catch(e){rej(e)}},undefined,
      e=>rej(new Error(`Unscrew: couldn't load ${m.file} (${e&&e.message||e})`))));
    const p=this.promise=Promise.all(REAL_MODELS.map(one)).then(()=>{this.ready=true});
    p.catch(e=>{console.error(e);if(this.promise===p)this.promise=null}); // a later call tries again
    return p}};

// The loaded scene as templates: geometry stays shared between levels (disposeTree() leaves it alone),
// every level gets its own materials, because a falling part fades its own.
const realName=o=>o.userData.name||o.name;
function shareGeo(g){g.userData.shared=true;return g}
function prepReal(scene,file){
  scene.updateMatrixWorld(true);const parts=[];
  for(const node of scene.children){
    if(!node.isMesh)throw new Error(`${file}: part "${realName(node)}" must be one mesh with one material`);
    const t={name:realName(node),geo:shareGeo(node.geometry),mat:node.material,pos:node.position.clone(),quat:node.quaternion.clone(),scale:node.scale.clone(),
      static:!!node.userData.static,minCx:+node.userData.minCx||0,slots:[],decor:[],proxy:null};
    for(const c of node.children){const nm=realName(c);
      if(/^screw/i.test(nm))t.slots.push({p:c.position.clone(),n:V(0,1,0).applyQuaternion(c.quaternion).normalize(),force:!!c.userData.force,minCx:+c.userData.minCx||0});
      else if(/_proxy$/.test(nm)&&c.isMesh){c.updateMatrix();const g=c.geometry.clone();g.applyMatrix4(c.matrix);t.proxy=shareGeo(g)}
      else{c.traverse(o=>{if(o.isMesh)shareGeo(o.geometry)});t.decor.push(c)}}
    parts.push(t)}
  return parts}
function paintMat(m,pal){const c=m.clone();if(pal&&pal[m.name])c.color.copy(srgb(pal[m.name]));return c}

// The generator for a realism model, called like any 3D generator: gen(R, cfg) fills BLD
function realGen(m){return(R,cfg)=>{
  const parts=REAL.parts[m.name];if(!parts)throw new Error(`Unscrew: ${m.file} isn't loaded yet (REAL.load())`);
  const pal=m.palettes?R.pick(m.palettes):null,keep=o=>!(+o.userData.minCx>cfg.cx);
  for(const t of parts){if(t.minCx>cfg.cx)continue;
    const mesh=new THREE.Mesh(t.geo,paintMat(t.mat,pal));mesh.position.copy(t.pos);mesh.quaternion.copy(t.quat);mesh.scale.copy(t.scale);mesh.name=t.name;
    const p=regPart(mesh,t.proxy||t.geo,{static:t.static});p.label=t.name;
    for(const s of t.slots)if(s.minCx<=cfg.cx)addSlot(p,s.p,s.n,s.force);
    for(const d of t.decor){if(!keep(d))continue;const c=d.clone(true),drop=[];
      c.traverse(o=>{if(o!==c&&!keep(o))drop.push(o);if(o.isMesh){o.material=paintMat(o.material,pal);o.castShadow=o.receiveShadow=true}});
      drop.forEach(o=>o.parent&&o.parent.remove(o));mesh.add(c)}
    mesh.updateMatrixWorld(true)}}}

const GENS_REAL=REAL_MODELS.map(m=>[m.name,realGen(m),m.cat]);
