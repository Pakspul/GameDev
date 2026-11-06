// The order of Unscrew's 3D models in the level shuffle (pick3D in game.js). The position of a model here,
// together with the number of models, decides which model each 3D level number shows. It lives apart from
// the category files so that moving a model to another file, or reordering the <script> tags, changes nothing.
// Append new models at the end and never reorder. Adding one still reshuffles the levels: see U-1 in docs/ISSUES.md.
const MODEL_ORDER=['cottage','room','mill','castle','rocket','robot','villa','giraffe','camper','watertower','turtle','canalhouse','lighthouse','rover','steamtrain','windturbine','arcade','cake','burger','pagoda','harbourcrane','fireengine','robotdog','kitchen'];

const GENS3D=MODEL_ORDER.map(name=>{const m=MODELS3D.find(m=>m.name===name);
  if(!m)throw new Error(`Unscrew: "${name}" is in MODEL_ORDER, but no file in models/ registers it`);return[name,m.gen,m.cat]});
for(const m of MODELS3D)if(!MODEL_ORDER.includes(m.name))throw new Error(`Unscrew: model "${m.name}" is missing from MODEL_ORDER in models/order.js`);
