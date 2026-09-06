'use strict';

class FlightModel {
  constructor(random = Math.random) { this.random = random; this.limit=5.5; this.reset(-3); }
  setSeed(seed) {
    let value=(Number(seed)>>>0)||1;
    this.random=()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};
  }
  reset(x=-3,options={}) {
    if(options.seed!==undefined)this.setSeed(options.seed);
    this.x=x; this.y=0; this.vy=0; this.score=0; this.alive=true; this.distance=0;
    this.time=0;this.combo=0;this.multiplier=1;this.focus=0;this.shield=0;this.invulnerable=0;this.lastPerfect=-99;
    this.route='safe';this.collected={seed:0,pollen:0,leaf:0};this.events=[];
    this.runMode=options.mode||'endless';this.chapter=options.chapter||0;this.completed=false;
    this.pattern=options.pattern||['standard','standard','standard','moving','standard','standard','standard','pulse','standard','ring','wind'];
    this.gates=Array.from({length:6},(_,i)=>this.makeGate(i,x+5.9+i*4.45,i===0?.1:this.nextCenter()));
  }
  nextCenter() { return (this.random()-.5)*2.8; }
  makeGate(index,x,center) {
    // The former split layout put a second pillar in the playable opening.
    // Keep old patterns compatible, but always use the regular wide opening.
    const requestedKind=this.pattern[index%this.pattern.length]||'standard';
    const kind=requestedKind==='split'?'standard':requestedKind;
    const routeCenters=kind==='split'?[center-1.02,center+1.02]:null;
    const gate={id:index,kind,x,center,baseCenter:center,routeCenters,phase:this.random()*Math.PI*2,
      passed:false,scored:false,gap:kind==='split'?.72:1.52,baseGap:kind==='split'?.72:1.52,
      wind:kind==='wind'?((this.random()-.5)*2.2):0,items:[]};
    const itemCenter=routeCenters?.[1]??center;
    gate.items.push({type:index%9===7?'leaf':index%4===2?'pollen':'seed',x,y:itemCenter,collected:false});
    if(routeCenters)gate.items.push({type:'seed',x,y:routeCenters[0],collected:false});
    return gate;
  }
  gateState(g) {
    const t=this.time;
    if(g.kind==='moving')g.center=g.baseCenter+Math.sin(t*1.25+g.phase)*.68;
    else if(g.kind==='pulse')g.gap=g.baseGap*(.7+.3*(.5+.5*Math.sin(t*2.1+g.phase)));
    else if(g.kind==='split')g.routeCenters=[g.baseCenter-1.02,g.baseCenter+1.02];
    else g.center=g.baseCenter;
    if(g.kind==='wind')g.center=g.baseCenter+Math.sin(t*.9+g.phase)*.38;
    for(const item of g.items){item.x=g.x;item.y=g.routeCenters?.[item.type==='seed'?0:1]??g.center;}
  }
  currentTargets(g) { return g.kind==='split'?(g.routeCenters||[g.center]):[g.center]; }
  isSafe(g,y) { return this.currentTargets(g).some(c=>Math.abs(y-c)<=Math.max(.05,g.gap-.27)); }
  flap() { if(this.alive)this.vy=6.05; }
  step(dt) {
    if(!this.alive)return {hit:false,passed:0,events:[]};
    this.time+=dt;this.events=[];this.invulnerable=Math.max(0,this.invulnerable-dt);
    if(this.combo&&this.time-this.lastPerfect>2){this.combo=0;this.multiplier=1;}
    const speed=(2.65+Math.min(this.score,35)*.012)*(this.runMode==='chapter'?.98:1);
    let wind=0;
    for(const g of this.gates){this.gateState(g);if(g.kind==='wind'&&Math.abs(g.x-this.x)<3)wind=g.wind*(.5+.5*Math.sin(this.time*1.4+g.phase));}
    const collisionY=this.y;
    this.vy=Math.max(-10,this.vy-18.5*dt+wind*dt); this.y+=this.vy*dt; this.distance+=speed*dt;
    const boundaryHit=this.y-.27<-this.limit||this.y+.27>this.limit;
    let hit=boundaryHit,passed=0;
    for(const g of this.gates){
      g.x-=speed*dt;
      for(const item of g.items){item.x=g.x;if(!item.collected&&Math.abs(item.x-this.x)<.55&&Math.abs(item.y-this.y)<.58){item.collected=true;this.collected[item.type]++;const points=item.type==='pollen'?3:item.type==='leaf'?5:1;this.score+=points;if(item.type==='pollen'){this.focus=Math.min(100,this.focus+10);this.combo=Math.max(this.combo,1);}this.events.push({type:'collect',item:item.type,points,x:item.x,y:item.y});}if(!item.collected&&item.x<this.x-.7){this.combo=0;this.multiplier=1;}}
      if(Math.abs(g.x-this.x)<.83&&!this.isSafe(g,collisionY)){
        if(this.invulnerable<=0&&!boundaryHit){if(this.shield){this.shield=0;this.invulnerable=.35;this.events.push({type:'shield',x:this.x,y:this.y});}else hit=true;}
      }
      if(collisionY< -4.29&&collisionY> -6.59){
        const width=.22+.78*Math.min(1,Math.max(0,(collisionY+6.32)/1.76));
        const dx=Math.max(Math.abs(g.x-this.x)-width,0),dy=Math.max(collisionY+4.56,-6.32-collisionY,0);
        if(dx*dx+dy*dy<.27*.27){if(this.invulnerable<=0&&!boundaryHit){if(this.shield){this.shield=0;this.invulnerable=.35;this.events.push({type:'shield',x:this.x,y:this.y});}else hit=true;}}
      }
    }
    if(!hit)for(const g of this.gates){if(!g.passed&&g.x+.56<this.x-.27){g.passed=true;passed++;const targets=this.currentTargets(g);const target=targets.reduce((best,c)=>Math.abs(this.y-c)<Math.abs(this.y-best)?c:best,targets[0]);const perfect=Math.abs(this.y-target)<=g.gap*.22;let points=1;if(perfect){this.combo=this.time-this.lastPerfect<=1.2?this.combo+1:1;this.lastPerfect=this.time;this.multiplier=Math.min(4,1+Math.floor(this.combo/3));this.focus=Math.min(100,this.focus+20);if(this.focus>=100&&this.shield===0){this.focus=0;this.shield=1;this.events.push({type:'shield-ready'});}points=2*this.multiplier;this.events.push({type:'perfect',combo:this.combo,multiplier:this.multiplier,points,x:this.x,y:this.y});}else{this.route=g.kind==='split'?(this.y<g.baseCenter?'low':'high'):'safe';this.events.push({type:'pass',points,x:this.x,y:this.y});}this.score+=points;this.events.push({type:'passed',points,perfect});}}
    for(const g of this.gates)if(g.x<this.x-7){const nextX=Math.max(...this.gates.map(p=>p.x))+4.45;const nextCenter=this.nextCenter();Object.assign(g,this.makeGate(g.id,nextX,nextCenter));}
    if(this.runMode==='chapter'&&this.time>=(this.chapter===0?45:this.chapter===1?60:this.chapter===2?75:90)){this.completed=true;this.alive=false;this.events.push({type:'complete'});}
    this.alive=!hit&&!this.completed; return {hit,passed,events:this.events.slice()};
  }
}

(()=>{
const $=id=>document.getElementById(id),canvas=$('game');
const setText=(id,value)=>{const node=$(id);if(node)node.textContent=value;};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});} catch { $('error').style.display='grid';$('reload').onclick=()=>location.reload();return; }
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xf1d7b5,33,85);
const camera=new THREE.OrthographicCamera(-8,8,5.5,-5.5,.1,160);
camera.position.set(0,4.2,30);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xfff5e9,0x658c83,1.65));
const sunlight=new THREE.DirectionalLight(0xffebd8,2.2);sunlight.position.set(-6,10,12);scene.add(sunlight);
const rim=new THREE.DirectionalLight(0xf3fff0,.9);rim.position.set(2,5,-6);scene.add(rim);
let seed=87;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const range=(a,b)=>a+rand()*(b-a);
const materials={};
function mat(color,flat=true){const key=color+':'+flat;return materials[key]??=new THREE.MeshStandardMaterial({color,roughness:.95,flatShading:flat});}
const sphere=new THREE.IcosahedronGeometry(1,1),smooth=new THREE.SphereGeometry(1,20,14),stemGeo=new THREE.CylinderGeometry(.65,1,1,5);
function mesh(geo,color,parent,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const m=new THREE.Mesh(geo,typeof color==='number'?mat(color):color);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
function pebble(parent,x,y,z,s,color){const m=mesh(sphere,color,parent,x,y,z,s,s*range(.6,1),s*range(.7,1.1));m.rotation.set(rand(),rand()*6,rand());return m;}
function segment(parent,a,b,r,color){const d=new THREE.Vector3().subVectors(b,a);const m=mesh(stemGeo,color,parent,0,0,0,r,d.length(),r);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
function leafGeometry(){
  const geo=new THREE.BufferGeometry(),p=[],c=[];
  const pts=[[0,0,0],[-.26,.35,.025],[-.3,.77,0],[0,1.25,0],[.28,.77,0],[.22,.35,.025],[0,.5,.12],[0,.91,.07]];
  const faces=[[0,1,6],[1,2,6],[2,7,6],[2,3,7],[0,6,5],[5,6,4],[4,6,7],[4,7,3]];
  faces.forEach((f,i)=>{const color=new THREE.Color(i<4?0x829b53:0xa7b46c);f.forEach(j=>{p.push(...pts[j]);c.push(color.r,color.g,color.b);});});
  geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geo.computeVertexNormals();return geo;
}
const leafGeo=leafGeometry(),leafMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.83,side:THREE.DoubleSide,flatShading:true});
function leaf(parent,x,y,z,scale,angle){const m=mesh(leafGeo,leafMat,parent,x,y,z,scale);m.rotation.z=angle;return m;}

// Static scenery is batched by geometry and material to keep mobile draw calls low.
function batch(group){
  const buckets=new Map();group.updateMatrixWorld(true);const inv=group.matrixWorld.clone().invert();
  group.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({o,m:inv.clone().multiply(o.matrixWorld)});});
  group.clear();for(const list of buckets.values()){const b=new THREE.InstancedMesh(list[0].o.geometry,list[0].o.material,list.length);list.forEach(({m},i)=>b.setMatrixAt(i,m));b.instanceMatrix.needsUpdate=true;group.add(b);}
}
const flowerGeo=new THREE.SphereGeometry(1,5,4);
function flowers(parent,x,y,z,s=1){
  for(let j=0;j<3;j++){const px=x+range(-.18,.18)*s,pz=z+range(-.16,.16)*s,py=y+range(.015,.08)*s;
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;mesh(flowerGeo,0xffedbc,parent,px+Math.cos(a)*.075*s,py,pz+Math.sin(a)*.075*s,.063*s,.024*s,.045*s);}
    mesh(flowerGeo,0xd8aa50,parent,px,py+.025*s,pz,.027*s);
  }
}
function sprout(parent,x,y,z,s=1){
  segment(parent,new THREE.Vector3(x,y,z),new THREE.Vector3(x+.09*s,y+.7*s,z),.014*s,0x647e43);
  for(let i=0;i<4;i++)leaf(parent,x+i*.02*s,y+(.08+i*.14)*s,z,.22*s,i%2?-.8:.9);
}
function tree(parent,x,y,z,s=1){
  segment(parent,new THREE.Vector3(x,y,z),new THREE.Vector3(x+.12*s,y+1.65*s,z),.09*s,0x6b7050);
  const crowns=[[-.48,1.15,.1,.58],[.32,1.57,0,.62],[.05,2.02,-.04,.54]];
  for(const [a,b,c,r]of crowns){segment(parent,new THREE.Vector3(x+.05*s,y+.58*s,z),new THREE.Vector3(x+a*s,y+b*s,z+c*s),.045*s,0x6b7050);pebble(parent,x+a*s,y+b*s,z+c*s,r*s,[0x849762,0x9ca776,0x758d66][Math.floor(rand()*3)]);}
}
function island(s=1,detail=true){
  const g=new THREE.Group();
  mesh(new THREE.CylinderGeometry(1.15,.25,1.9,7,2),0x6e8d7e,g,0,-.85*s,0,s,s,s*.8);
  mesh(new THREE.CylinderGeometry(1.18,1.06,.15,7),0x8eaa7a,g,0,.09*s,0,s,s,s*.8);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;pebble(g,Math.cos(a)*.83*s,-.25*s,Math.sin(a)*.58*s,range(.25,.43)*s,[0x769384,0x9aa780,0x617f72][i%3]);}
  if(detail){for(let i=0;i<5;i++)pebble(g,range(-.8,.8)*s,.16*s,range(-.6,.6)*s,.23*s,0x98a461);flowers(g,-.45*s,.2*s,.43*s,s);sprout(g,.65*s,.13*s,.06*s,.8*s);tree(g,-.25*s,.17*s,-.25*s,.7*s);}
  return g;
}
const scenery=[];
for(let layer=0;layer<3;layer++){
  for(let i=0;i<8;i++){
    const z=-9-layer*12,g=island(range(.65,1.8),layer<2);g.position.set(-22+i*6.4+range(-1,1),range(-6.8,-4.4)+z*.14,z);
    if(layer===2)tree(g,0,.15,0,range(.8,1.9));batch(g);scene.add(g);scenery.push({g,rate:.12+(.18*(2-layer)),origin:g.position.y,phase:rand()*6});
  }
}
const homeIsland=island(1.85,true);homeIsland.position.set(-8,-2.8,-1.4);batch(homeIsland);scene.add(homeIsland);
const sun=mesh(new THREE.SphereGeometry(1,32,16),new THREE.MeshBasicMaterial({color:0xfff5d1,fog:false,toneMapped:false}),scene,7,3.4,-42,.57);
const haloMat=new THREE.MeshBasicMaterial({color:0xffefd1,transparent:true,opacity:.1,depthWrite:false,fog:false,toneMapped:false});
const halo=mesh(new THREE.SphereGeometry(1,24,12),haloMat,scene,7,3.4,-42,.8);

function columnGeometry(){
 const p=[],c=[],n=7,rings=[0,.025,.28,.56,.83,.975,1],rad=[.83,1,.97,1,.96,1,.83];
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){
   const v=(r,k)=>{const a=k/n*Math.PI*2+.18;return [Math.cos(a)*.57*rad[r],rings[r],Math.sin(a)*.48*rad[r]];};
   const a=v(j,i),b=v(j,i+1),d=v(j+1,i),e=v(j+1,i+1);
   for(const face of [[a,b,d],[b,e,d]]){const col=new THREE.Color(0x719389).multiplyScalar(range(.83,1.17));for(const vtx of face){p.push(...vtx);c.push(col.r,col.g,col.b);}}
 }
 for(const r of [0,rings.length-1])for(let i=0;i<n;i++){const a=i/n*Math.PI*2+.18,b=(i+1)/n*Math.PI*2+.18;const col=new THREE.Color(0x91a879);for(const v of [[0,rings[r],0],[Math.cos(a)*.57*rad[r],rings[r],Math.sin(a)*.48*rad[r]],[Math.cos(b)*.57*rad[r],rings[r],Math.sin(b)*.48*rad[r]]]){p.push(...v);c.push(col.r,col.g,col.b);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geo.computeVertexNormals();return geo;
}
const colGeo=columnGeometry(),colMat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,side:THREE.DoubleSide});
function cap(){
 const g=new THREE.Group();mesh(new THREE.CylinderGeometry(.54,.54,.06,7),0x8c9e66,g,0,-.016,0,1,1,.82);
 for(let i=0;i<6;i++)pebble(g,range(-.39,.39),0,range(-.29,.29),range(.07,.13),0x9baa6c);
 flowers(g,.17,.055,.09,.64);leaf(g,-.4,-.17,.35,.25,.65);leaf(g,-.43,-.35,.29,.2,.4);batch(g);return g;
}
const gateMeshes=[];
for(let i=0;i<6;i++){
  const root=new THREE.Group(),lower=mesh(colGeo,colMat,root),upper=mesh(colGeo,colMat,root),mid=mesh(colGeo,colMat,root),lowCap=cap(),upCap=cap();root.add(lowCap,upCap);
  const ring=mesh(new THREE.TorusGeometry(.82,.065,8,18),0xf3d98d,root);
  const itemMeshes=[0,1].map(()=>mesh(new THREE.SphereGeometry(.15,10,8),0xf6d276,root));
  upCap.rotation.z=Math.PI;
  const base=island(.85,false);base.position.y=-4.7;batch(base);root.add(base);scene.add(root);gateMeshes.push({root,lower,upper,lowCap,upCap});
  gateMeshes[i].mid=mid;gateMeshes[i].ring=ring;gateMeshes[i].itemMeshes=itemMeshes;
}
function poseGate(g,data){
  const center=data.center, gap=data.gap, bottom=center-gap, top=center+gap;
  g.root.position.x=data.x;g.root.position.y=0;
  g.lower.visible=g.upper.visible=data.kind!=='ring';g.mid.visible=data.kind==='split';g.ring.visible=data.kind==='ring';
  g.lower.position.y=-6.7;g.lower.scale.y=Math.max(.01,bottom+6.7);g.upper.position.y=top;g.upper.scale.y=Math.max(.01,7.8-top);
  g.lowCap.position.y=bottom;g.upCap.position.y=top;
  if(data.kind==='split'){
    const low=data.routeCenters[0],high=data.routeCenters[1];
    g.lower.position.y=-6.7;g.lower.scale.y=Math.max(.01,low-gap+6.7);g.lowCap.position.y=low-gap;
    g.upper.position.y=high+gap;g.upper.scale.y=Math.max(.01,7.8-(high+gap));g.upCap.position.y=high+gap;
    const midHeight=Math.max(.12,high-low-2*gap);g.mid.position.set(0,low+gap,0);g.mid.scale.set(.8,midHeight,.8);
  }
  if(data.kind==='ring'){
    g.ring.position.set(0,center,0);g.ring.scale.set(1,1,1);
  }
  data.items.forEach((item,i)=>{const m=g.itemMeshes[i];if(!m)return;m.visible=!item.collected;m.position.set(0,item.y,.38);m.material=mat(item.type==='pollen'?0xf3ca4e:item.type==='leaf'?0x87a85d:0xf8e4a2,false);m.scale.setScalar(item.type==='leaf'?.8:item.type==='pollen'?1.15:1);});
  for(let i=data.items.length;i<g.itemMeshes.length;i++)g.itemMeshes[i].visible=false;
}

const creature=new THREE.Group(),bodyPivot=new THREE.Group();creature.add(bodyPivot);scene.add(creature);
const peach=mat(0xe88d42,false),ivory=mat(0xffe4a8,false),ink=mat(0x243e34,false);
mesh(smooth,peach,bodyPivot,0,0,0,.39,.35,.29);
mesh(smooth,ivory,bodyPivot,.205,.025,.205,.25,.255,.125);
mesh(smooth,ink,bodyPivot,.19,.075,.319,.031,.052,.019);
mesh(smooth,ink,bodyPivot,.345,.07,.284,.029,.05,.019);
mesh(smooth,0xfff7dc,bodyPivot,.187,.093,.334,.009);
mesh(smooth,0xfff7dc,bodyPivot,.342,.088,.3,.008);
mesh(smooth,0xd79160,bodyPivot,.17,-.04,.33,.045,.018,.008);
mesh(smooth,0xd79160,bodyPivot,.36,-.037,.283,.031,.016,.008);
const wingBack=new THREE.Group(),wingFront=new THREE.Group();bodyPivot.add(wingBack,wingFront);wingBack.position.set(-.13,.07,-.16);wingFront.position.set(-.15,.08,.17);
leaf(wingBack,0,0,0,.73,.64);leaf(wingFront,0,0,0,.88,.99);
segment(wingFront,new THREE.Vector3(0,0,.025),new THREE.Vector3(-.75,.5,.06),.007,0xc4c889);
for(let i=0;i<3;i++){const m=mesh(smooth,peach,bodyPivot,-.37-i*.025,-.09-i*.05,-.08+i*.08,.2,.039,.055);m.rotation.z=.6+i*.15;}
for(let i=0;i<2;i++){
 const x=.02+i*.18,z=i===0?.04:-.06;
 segment(bodyPivot,new THREE.Vector3(x,.3,z),new THREE.Vector3(x-.07,.67,z),.013,0x7d8246);
 leaf(bodyPivot,x-.07,.61,z,.2,i===0?.85:-.5);
}
const particleCount=80,particleData=[],particlePositions=new Float32Array(particleCount*3),particleColors=new Float32Array(particleCount*3);
const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3));
const particleMat=new THREE.PointsMaterial({size:.065,vertexColors:true,transparent:true,opacity:.7,depthWrite:false,sizeAttenuation:true});const particles=new THREE.Points(particleGeo,particleMat);scene.add(particles);
for(let i=0;i<particleCount;i++){particleData.push({x:range(-18,18),y:range(-6,6),z:range(-10,3),life:1,vx:-range(.1,.3),vy:range(.02,.1),burst:false});const c=new THREE.Color(i%3?0xffedbc:0xbac985);particleColors.set([c.r,c.g,c.b],i*3);}
let burstCursor=0;
function puff(count,impact=false){if(reduced)return;for(let i=0;i<count;i++){const p=particleData[burstCursor++%18];p.x=creature.position.x-.25;p.y=creature.position.y;p.z=.35;p.vx=impact?range(-2.8,2.8):range(-2,-.5);p.vy=impact?range(-2.5,2.5):range(-.7,.7);p.life=impact?.75:.43;p.burst=true;}}

const model=new FlightModel();let state='ready',worldW=16,worldH=11,elapsed=0,wingKick=0,deathAge=0,shake=0,runAge=0,previous=0,accumulator=0;
const CHAPTERS=[
  {name:'浮岛花园',seed:1101,pattern:['standard','standard','standard','moving','standard','standard','standard','standard']},
  {name:'风之峡谷',seed:2202,pattern:['standard','wind','moving','standard','standard','pulse','wind','standard']},
  {name:'雨林温室',seed:3303,pattern:['standard','pulse','standard','ring','wind','pulse','ring','standard']},
  {name:'月光遗迹',seed:4404,pattern:['moving','standard','pulse','ring','wind','standard','ring','pulse']}
];
let runMode='story',selectedChapter=0;
const TASKS=[{label:'PERFECT 5 GATES',test:r=>r.perfect>=5},{label:'COLLECT GOLDEN POLLEN',test:r=>r.pollen>=1},{label:'GATHER 10 SEEDS',test:r=>r.seed>=10},{label:'SURVIVE WITH A SHIELD',test:r=>r.shieldUsed}];
// All story chapters are available from the first launch.
let unlocks=CHAPTERS.length;
const dailySeed=(()=>{const d=new Date();return d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate();})();
let best=0,dailyBest=0,muted=false,audio=null,oldBest=0,readyPhase=0,track=[],ghostTrack=[],runStats={perfect:0,pollen:0,seed:0,shieldUsed:false};
try{const stored=Number(localStorage.getItem('mosswing.best'));best=Number.isFinite(stored)?Math.max(0,Math.floor(stored)):0;const daily=Number(localStorage.getItem('mosswing.dailyBest'));dailyBest=Number.isFinite(daily)?Math.max(0,Math.floor(daily)):0;const ghost=JSON.parse(localStorage.getItem('mosswing.ghost')||'null');if(Array.isArray(ghost))ghostTrack=ghost;muted=localStorage.getItem('mosswing.muted')==='true';}catch{}
const fmt=n=>String(n).padStart(2,'0');setText('best',fmt(best));
function updateSound(){ const sound=$('sound');if(!sound)return;sound.classList.toggle('muted',muted);sound.setAttribute('aria-label',muted?'Enable sound':'Mute sound');sound.setAttribute('aria-pressed',String(muted)); }
updateSound();
const ghost=creature.clone();ghost.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.18;o.material.depthWrite=false;}});ghost.visible=false;scene.add(ghost);
function syncHud(){
  const collected=model.collected?.seed||0;
  setText('combo',`x${model.multiplier||1}`);
  const focus=$('focus-bar');if(focus)focus.style.width=`${Math.max(0,Math.min(100,model.focus||0))}%`;
  setText('seed-count',collected);
  const shield=$('shield-chip');if(shield){shield.classList.toggle('shield-on',!!model.shield);shield.textContent=model.shield?'SHIELD READY':`SEEDS ${collected}`;}
  setText('chapter-label',runMode==='daily'?'每日挑战':runMode==='endless'?'无尽天空':CHAPTERS[selectedChapter]?.name||'浮岛花园');
}
function closeChapterMenu(){const wrap=$('chapter-select-button')?.parentElement;if(!wrap)return;wrap.classList.remove('open');$('chapter-select-button').setAttribute('aria-expanded','false');}
function refreshChapterOptions(){
  const select=$('chapter-select');if(!select)return;
  Array.from(select.options).forEach((option,index)=>{option.disabled=index>=unlocks;});
  if(selectedChapter>=unlocks){selectedChapter=0;}
  select.value=String(selectedChapter);
  setText('chapter-select-label',select.options[selectedChapter]?.textContent||'01 · 浮岛花园');
  document.querySelectorAll('[data-chapter-option]').forEach(option=>{
    const index=Number(option.dataset.chapterOption),locked=index>=unlocks;
    option.disabled=locked;option.setAttribute('aria-disabled',String(locked));option.setAttribute('aria-selected',String(index===selectedChapter));
    const note=option.querySelector('small');if(note)note.textContent=locked?'未解锁':'';
  });
}
function selectChapter(index){if(!Number.isInteger(index)||index<0||index>=CHAPTERS.length||index>=unlocks)return;selectedChapter=index;refreshChapterOptions();syncHud();closeChapterMenu();}
function selectMode(mode){runMode=mode;closeChapterMenu();document.querySelectorAll('[data-run-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.runMode===mode));const select=$('chapter-select'),button=$('chapter-select-button');if(select)select.disabled=mode!=='story';if(button)button.disabled=mode!=='story';refreshChapterOptions();setText('best',fmt(mode==='daily'?dailyBest:best));syncHud();}
document.querySelectorAll('[data-run-mode]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();selectMode(e.currentTarget.dataset.runMode);}));
$('chapter-select-button').addEventListener('click',e=>{e.stopPropagation();if(e.currentTarget.disabled)return;const wrap=e.currentTarget.parentElement,open=!wrap.classList.contains('open');wrap.classList.toggle('open',open);e.currentTarget.setAttribute('aria-expanded',String(open));});
document.querySelectorAll('[data-chapter-option]').forEach(option=>option.addEventListener('click',e=>{e.stopPropagation();selectChapter(Number(e.currentTarget.dataset.chapterOption));}));
document.addEventListener('click',e=>{if(!e.target.closest('.chapter-select-wrap'))closeChapterMenu();});
document.addEventListener('keydown',e=>{if(e.code==='Escape')closeChapterMenu();});
selectMode('story');
function unlockAudio(){try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function note(freq,end,duration,volume=.05,delay=0,type='sine'){
 if(muted||!audio||audio.state!=='running')return;
 const t=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.015);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();};
}
function setState(next){state=next;document.body.className=next;for(const[id,visible]of[['gameover',next==='over'],['paused',next==='paused']]){$(id).classList.toggle('visible',visible);$(id).setAttribute('aria-hidden',String(!visible));$(id).inert=!visible;}$('intro').inert=next!=='ready';}
function start(){
  const selectedMode=document.querySelector('[data-run-mode].selected')?.dataset.runMode;
  if(selectedMode)runMode=selectedMode;
  const chapter=CHAPTERS[selectedChapter],chosenSeed=runMode==='daily'?dailySeed:runMode==='story'?chapter.seed:Date.now()>>>0;
  oldBest=runMode==='daily'?dailyBest:best;model.reset(-worldW*.23,{mode:runMode==='story'?'chapter':'endless',chapter:selectedChapter,seed:chosenSeed,pattern:runMode==='story'?chapter.pattern:undefined});
  track=[];runStats={perfect:0,pollen:0,seed:0,shieldUsed:false};ghost.visible=ghostTrack.length>0;homeIsland.position.x=-worldW*.48-1;creature.position.set(model.x,model.y,0);creature.rotation.set(0,0,0);bodyPivot.rotation.set(0,0,0);deathAge=0;runAge=0;accumulator=0;previous=performance.now();$('score').textContent='0';syncHud();$('tap-hint').classList.add('visible');setState('playing');canvas.focus({preventScroll:true});flap();
}
function flap(){model.flap();wingKick=1;puff(3);note(420,760,.095,.035);}
function act(){unlockAudio();if(state==='ready'||state==='over'&&deathAge>.85)start();else if(state==='playing')flap();else if(state==='paused')resume();}
function die(){setState('dying');deathAge=0;shake=reduced?0:.14;puff(16,true);note(170,58,.3,.07,0,'triangle');if(!reduced)$('flash').animate([{opacity:.36},{opacity:0}],{duration:260});}
function finish(completed=false){
  const isDaily=runMode==='daily',currentBest=isDaily?dailyBest:best,newRecord=model.score>currentBest;
  if(isDaily)dailyBest=Math.max(dailyBest,model.score);else best=Math.max(best,model.score);
  if(newRecord&&track.length){ghostTrack=track.slice(-1800);}
  try{localStorage.setItem(isDaily?'mosswing.dailyBest':'mosswing.best',String(isDaily?dailyBest:best));if(newRecord&&track.length)localStorage.setItem('mosswing.ghost',JSON.stringify(ghostTrack));if(completed)localStorage.setItem('mosswing.chapter.'+selectedChapter,'done');}catch{}
  const task=TASKS[selectedChapter]||TASKS[0],taskDone=task.test(runStats);
  refreshChapterOptions();
  const shownBest=isDaily?dailyBest:best;$('best').textContent=fmt(shownBest);$('final-score').textContent=model.score;$('final-best').textContent=shownBest;$('result-title').textContent=completed?'Chapter complete':isDaily?'Daily flight':'A little further?';
  $('record').textContent=newRecord?'A new personal best':'';document.getElementById('task-note').textContent=taskDone?'TASK COMPLETE - '+task.label:'TASK - '+task.label;$('result-message').textContent=completed?'The garden opens a new path.':model.score===0?'Every flight starts with a little lift.':model.score<5?'The next gap is always an invitation.':'Somewhere between the leaves, you found your rhythm.';
  setState('over');$('retry').focus({preventScroll:true});
}
function pause(){if(state!=='playing')return;setState('paused');audio?.suspend().catch(()=>{});$('resume').focus({preventScroll:true});}
function resume(){if(state!=='paused')return;unlockAudio();setState('playing');previous=performance.now();accumulator=0;canvas.focus({preventScroll:true});flap();}
document.addEventListener('pointerdown',e=>{if(e.target.closest('button,select,option,label,.run-modes,.chapter-picker')||e.button!==0||!e.isPrimary)return;e.preventDefault();act();});
$('start').onclick=act;$('retry').onclick=act;$('resume').onclick=resume;$('pause').onclick=()=>state==='paused'?resume():pause();
$('sound').onclick=()=>{muted=!muted;unlockAudio();updateSound();try{localStorage.setItem('mosswing.muted',String(muted));}catch{};if(!muted)note(660,880,.14,.03);};
document.addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){if(e.target.closest('button')&&e.code==='Space')return;e.preventDefault();if(!e.repeat)act();}else if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();state==='paused'?resume():pause();}else if(e.code==='KeyM'&&!e.repeat){$('sound').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();previous=performance.now();});
window.addEventListener('blur',pause);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('error').style.display='grid';$('error').querySelector('p').textContent='The garden lost its canvas. Reload to take flight again.';});
$('reload').onclick=()=>location.reload();
function resize(){
 const width=innerWidth,height=innerHeight,oldX=model.x;worldH=width/height<.75?12.4:11;worldW=worldH*width/height;
 model.limit=worldH*.5/Math.cos(Math.atan(.14));
 renderer.setSize(width,height);camera.left=-worldW/2;camera.right=worldW/2;camera.top=worldH/2;camera.bottom=-worldH/2;camera.updateProjectionMatrix();
 const x=-worldW*.23,dx=x-oldX;model.x=x;model.gates.forEach(g=>g.x+=dx);
 sun.position.x=worldW*.4;sun.position.y=worldH*.31-5.88;halo.position.copy(sun.position);
 homeIsland.position.x=-worldW*.48-1;homeIsland.position.y=-3.05;
 if(state==='playing')pause();
}
window.addEventListener('resize',resize);resize();setState('ready');
function render(dt){
 if(state!=='paused')elapsed+=dt;
 if(state==='playing'){
   runAge+=dt;if(runAge>3)$('tap-hint').classList.remove('visible');
    accumulator+=dt;while(accumulator>=1/120&&state==='playing'){const result=model.step(1/120);accumulator-=1/120;
      if(model.time%(.066)<.009)track.push({t:model.time,y:model.y});
      for(const event of result.events){
        if(event.type==='perfect'){runStats.perfect++;if(!reduced)$('score').animate([{transform:'scale(1.16)'},{transform:'scale(1)'}],{duration:160});note(880,1320,.12,.055);puff(5);}
        else if(event.type==='collect'){runStats[event.item]=(runStats[event.item]||0)+1;note(event.item==='pollen'?1040:event.item==='leaf'?740:620,event.item==='pollen'?1320:880,.1,.04);puff(event.item==='leaf'?8:4);}
        else if(event.type==='shield-ready'){note(520,1040,.22,.06);}
        else if(event.type==='shield'){runStats.shieldUsed=true;shake=reduced?0:.08;puff(10,true);note(230,90,.18,.05);}
        else if(event.type==='passed'){note(event.perfect?780:659,event.perfect?1040:659,.14,.04);puff(event.perfect?6:3);}
        else if(event.type==='complete'){finish(true);}
      }
      syncHud();$('score').textContent=model.score;if(result.hit)die();
    }
    creature.position.set(model.x,model.y,0);
    if(ghost.visible&&ghostTrack.length){const target=ghostTrack.reduce((a,b)=>Math.abs(b.t-model.time)<Math.abs(a.t-model.time)?b:a,ghostTrack[0]);ghost.position.set(model.x,target.y,0);}
 }else if(state==='ready'){
   readyPhase+=dt;creature.position.set(-worldW*.22,Math.sin(elapsed*1.7)*.12-.12,0);model.y=creature.position.y;
 }else if(state==='dying'){
   deathAge+=dt;if(deathAge>.12){model.vy=Math.max(-9,model.vy-14*dt);creature.position.y=Math.max(-5.8,creature.position.y+model.vy*dt);bodyPivot.rotation.z-=dt*2.3;}if(deathAge>.8)finish();
 }else if(state==='over')deathAge+=dt;
 if(state!=='paused'){
   wingKick=Math.max(0,wingKick-dt*5.5);
   if(state!=='dying'&&state!=='over'){const target=state==='ready'?.035:Math.max(-.75,Math.min(.38,model.vy*.055));bodyPivot.rotation.z+=(target-bodyPivot.rotation.z)*(1-Math.exp(-12*dt));
     const flutter=state==='playing'?Math.sin(elapsed*18)*.12:Math.sin(elapsed*6)*.3;wingFront.rotation.x=.2+flutter-wingKick*1.5;wingFront.rotation.z=-wingKick*.22;wingBack.rotation.x=-.2-flutter+wingKick*1.3;
     bodyPivot.scale.set(1+wingKick*.05,1-wingKick*.07,1);
   }
   const drift=state==='playing'?2.65:state==='ready'?.22:0;
   for(const s of scenery){s.g.position.x-=dt*drift*s.rate;if(s.g.position.x<-worldW/2-7)s.g.position.x=Math.max(worldW/2+8,25);s.g.position.y=s.origin+(reduced?0:Math.sin(elapsed*.35+s.phase)*.08);}
   homeIsland.position.x-=state==='playing'?dt*2.65:0;
   particleData.forEach((p,i)=>{p.x+=p.vx*dt-(state==='playing'?.7*dt:0);p.y+=p.vy*dt;if(p.burst){p.life-=dt;if(p.life<=0){p.x=range(-worldW/2,worldW/2);p.y=range(-6,6);p.z=range(-10,-2);p.vx=-.12;p.vy=.03;p.burst=false;}}if(p.x<-worldW/2-2)p.x=worldW/2+2;if(p.y>7)p.y=-6;particlePositions.set([p.x,p.y,p.z],i*3);});particleGeo.attributes.position.needsUpdate=true;
 }
  if(state==='ready'){gateMeshes.forEach((g,i)=>{g.root.visible=i<3;const x=worldW*((worldW<8?.46:.26)+i*.29);poseGate(g,{kind:'standard',x,center:i%2?.55:.2,gap:1.52,items:[]});});}else gateMeshes.forEach((g,i)=>{const data=model.gates[i];g.root.visible=true;poseGate(g,data);});
 shake=Math.max(0,shake-dt*.7);camera.position.x=shake?Math.sin(elapsed*90)*shake:0;camera.position.y=4.2+(shake?Math.cos(elapsed*100)*shake:0);
 renderer.render(scene,camera);
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;render(dt);}
requestAnimationFrame(now=>{previous=now;frame(now);});
})();
