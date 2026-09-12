export const TYPES = [
  {name:'葡萄',r:18,color:'#9164d9'}, {name:'樱桃',r:24,color:'#ef5275'},
  {name:'柑橘',r:31,color:'#ffad3e'}, {name:'柠檬',r:39,color:'#f4cf4e'},
  {name:'奇异果',r:49,color:'#a9ce67'}, {name:'蜜桃',r:60,color:'#f4a9a4'},
  {name:'甜柿',r:73,color:'#f38b43'}, {name:'蜜瓜',r:87,color:'#b5d692'},
  {name:'西瓜',r:104,color:'#68ab77'}
];

export const MODES = {
  jelly:{edge:.9,bend:.55,shape:.055,damping:.997,pressure:.85,label:'Q 弹果冻，回弹强 · 融合得分 +10%',scoreMultiplier:1.1,comboWindow:1.2,dangerRate:1},
  fluid:{edge:.7,bend:.24,shape:.017,damping:.992,pressure:.8,label:'柔软变形 · 连融窗口更长',scoreMultiplier:1,comboWindow:1.5,dangerRate:1},
  juice:{edge:.44,bend:.12,shape:.007,damping:.978,pressure:.72,label:'低张力填缝 · 危险增长 -25%',scoreMultiplier:.9,comboWindow:1.5,dangerRate:.75}
};

const N=18, TAU=Math.PI*2;
export const BOUNDS={left:25,right:475,bottom:580,line:120};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function center(body){let x=0,y=0;for(const p of body.p){x+=p.x;y+=p.y;}body.x=x/N;body.y=y/N;}
function distance(a,b,length,k){let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001;const c=(d-length)/d*.5*k;dx*=c;dy*=c;a.x+=dx;a.y+=dy;b.x-=dx;b.y-=dy;}
function areaOf(p){let a=0;for(let i=0;i<N;i++){const q=p[(i+1)%N];a+=p[i].x*q.y-q.x*p[i].y;}return a*.5;}
function pressure(body,k){const p=body.p,gradient=[];let norm=0;for(let i=0;i<N;i++){const before=p[(i+N-1)%N],after=p[(i+1)%N];const gx=(after.y-before.y)*.5,gy=(before.x-after.x)*.5;gradient.push([gx,gy]);norm+=gx*gx+gy*gy;}const delta=clamp((body.area-areaOf(p))/(norm||1),-.16,.16)*k;for(let i=0;i<N;i++){p[i].x+=gradient[i][0]*delta;p[i].y+=gradient[i][1]*delta;}}
function overlap(a,b){
  let depth=Infinity,nx=0,ny=0;
  for(const body of [a,b])for(let i=0;i<N;i++){
    const p=body.p[i],q=body.p[(i+1)%N],len=Math.hypot(q.x-p.x,q.y-p.y)||1;
    let x=(q.y-p.y)/len,y=(p.x-q.x)/len;
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(const v of a.p){const d=v.x*x+v.y*y;amin=Math.min(amin,d);amax=Math.max(amax,d);}
    for(const v of b.p){const d=v.x*x+v.y*y;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}
    const d=Math.min(amax-bmin,bmax-amin);if(d < -1.2)return null;
    if(d<depth){if((b.x-a.x)*x+(b.y-a.y)*y<0){x=-x;y=-y;}depth=d;nx=x;ny=y;}
  }
  return {depth:Math.max(0,depth),nx,ny};
}

export class World{
  constructor(onMerge=()=>{}){this.bodies=[];this.time=0;this.nextId=1;this.mode='fluid';this.tilt=0;this.gravityScale=1;this.onMerge=onMerge;this.lastMergeTime=-Infinity;this.cascadeDepth=0;}
  setMode(mode){if(MODES[mode])this.mode=mode;}
  add(type,x,y,vx=0,vy=0,{fresh=true,variant=null}={}){
    const r=TYPES[type].r;
    const p=Array.from({length:N},(_,i)=>{const angle=TAU*i/N,px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;return{x:px,y:py,px:px-vx/120,py:py-vy/120};});
    const variantUntil=variant==='foam'?this.time+3:variant==='sticky'?this.time+2.5:variant==='burst'?Infinity:-Infinity;
    const body={id:this.nextId++,type,r,p,x,y,age:0,area:areaOf(p),danger:0,frozenUntil:0,freshUntil:fresh?this.time+1:-Infinity,variant,variantUntil};
    this.bodies.push(body);return body;
  }
  reset(seed=true){this.bodies=[];this.time=0;this.nextId=1;this.tilt=0;this.gravityScale=1;this.lastMergeTime=-Infinity;this.cascadeDepth=0;if(seed){this.add(4,91,BOUNDS.bottom-50,0,0,{fresh:false});this.add(3,191,BOUNDS.bottom-40,0,0,{fresh:false});this.add(5,305,BOUNDS.bottom-61,0,0,{fresh:false});this.add(2,413,BOUNDS.bottom-32,0,0,{fresh:false});this.add(1,255,BOUNDS.bottom-137,0,0,{fresh:false});}}
  stir(){for(const b of this.bodies){if(b.frozenUntil>this.time)continue;for(const p of b.p){const vx=(b.x-250)*-1.5+(b.y-430)*1.9,vy=-250-(Math.random()*100);p.px=p.x-vx/120;p.py=p.y-vy/120;}}}
  freezeExisting(until){for(const b of this.bodies)b.frozenUntil=Math.max(b.frozenUntil,until);}
  releaseVent(){for(const b of this.bodies){const highest=Math.min(...b.p.map(p=>p.y));if(highest<BOUNDS.line){for(const p of b.p)p.py=p.y-260/120;b.danger=0;}}}
  step(dt=1/120){
    const mode=MODES[this.mode];this.time+=dt;
    for(const b of this.bodies){b.age+=dt;const frozen=b.frozenUntil>this.time;if(!frozen){const gravity=b.variant==='foam'&&b.variantUntil>this.time ? .55 : 1;for(const p of b.p){const vx=clamp((p.x-p.px)*mode.damping,-5,5),vy=clamp((p.y-p.py)*mode.damping,-5,5);p.px=p.x;p.py=p.y;p.x+=vx+this.tilt*760*dt*dt;p.y+=vy+980*this.gravityScale*gravity*dt*dt;}}}
    for(const source of this.bodies){if(source.variant!=='sticky'||source.variantUntil<=this.time)continue;for(const target of this.bodies){if(target===source||target.frozenUntil>this.time||Math.hypot(target.x-source.x,target.y-source.y)>72)continue;const factor=Math.pow(.65,dt/2.5);for(const p of target.p){p.px=p.x-(p.x-p.px)*factor;p.py=p.y-(p.y-p.py)*factor;}}}
    const locked=new Set(),merges=[];
    for(let iteration=0;iteration<6;iteration++){
      for(const b of this.bodies){if(b.frozenUntil<=this.time){const edge=2*b.r*Math.sin(Math.PI/N),bend=2*b.r*Math.sin(2*Math.PI/N);for(let i=0;i<N;i++){distance(b.p[i],b.p[(i+1)%N],edge,mode.edge);distance(b.p[i],b.p[(i+2)%N],bend,mode.bend);if(i<N/2)distance(b.p[i],b.p[(i+N/2)%N],b.r*2,mode.shape);}pressure(b,mode.pressure);}center(b);}
      for(let i=0;i<this.bodies.length;i++)for(let j=i+1;j<this.bodies.length;j++){
        const a=this.bodies[i],b=this.bodies[j];if(Math.hypot(b.x-a.x,b.y-a.y)>(a.r+b.r)*1.5)continue;
        const hit=overlap(a,b);if(!hit)continue;
        if(a.type===b.type&&!locked.has(a.id)&&!locked.has(b.id)){locked.add(a.id);locked.add(b.id);merges.push([a,b]);}
        const wa=b.area/(a.area+b.area),wb=1-wa,af=a.frozenUntil>this.time,bf=b.frozenUntil>this.time;
        for(const [body,sign,weight,frozen]of[[a,-1,wa,af],[b,1,wb,bf]]){if(frozen&&!(a.type===b.type&&locked.has(a.id)&&locked.has(b.id)))continue;for(const p of body.p){const contact=clamp(-sign*((p.x-body.x)*hit.nx+(p.y-body.y)*hit.ny)/body.r,0,1),push=hit.depth*weight*(.4+.6*contact)*.94;p.x+=sign*hit.nx*push;p.y+=sign*hit.ny*push;}}
      }
      for(const b of this.bodies)for(const p of b.p){if(p.x<BOUNDS.left){p.x=BOUNDS.left;p.px=p.x+(p.x-p.px)*.08;}if(p.x>BOUNDS.right){p.x=BOUNDS.right;p.px=p.x+(p.x-p.px)*.08;}if(p.y>BOUNDS.bottom){p.y=BOUNDS.bottom;p.py=p.y;p.px+=(p.x-p.px)*.025;}}
    }
    if(merges.length){this.bodies=this.bodies.filter(b=>!locked.has(b.id));for(const[a,b]of merges){const type=a.type+1,x=(a.x+b.x)/2,y=(a.y+b.y)/2,cascade=this.time-this.lastMergeTime<=.12;this.cascadeDepth=cascade?this.cascadeDepth+1:1;this.lastMergeTime=this.time;const variant=a.variant==='burst'||b.variant==='burst'?'burst':a.variant||b.variant||null;if(type<TYPES.length){const r=TYPES[type].r;this.add(type,clamp(x,BOUNDS.left+r,BOUNDS.right-r),Math.min(y,BOUNDS.bottom-r),0,0,{fresh:false,variant:null});}if(variant==='burst')this.applyShockwave(x,y);this.onMerge({type:Math.min(type,8),x,y,points:2**(type+1),cleared:type>=TYPES.length,cascade,cascadeDepth:this.cascadeDepth,perfect:a.freshUntil>=this.time||b.freshUntil>=this.time,variant,shockwave:variant==='burst'});}}
    for(const b of this.bodies){center(b);const highest=Math.min(...b.p.map(p=>p.y));b.danger=b.age>1.8&&highest<BOUNDS.line?b.danger+dt*mode.dangerRate:Math.max(0,b.danger-dt*2);}
  }
  applyShockwave(x,y){for(const body of this.bodies){if(body.frozenUntil>this.time)continue;const dx=body.x-x,dy=body.y-y,d=Math.hypot(dx,dy);if(d<.001||d>110)continue;const impulse=140*(1-d/110),nx=dx/d,ny=dy/d;for(const p of body.p){const vx=p.x-p.px,vy=p.y-p.py;p.px=p.x-(vx+nx*impulse/120);p.py=p.y-(vy+ny*impulse/120);}}}
}

export const LAUNCH_BOUNDS={left:18,right:482,top:18,bottom:580};
export const LAUNCH_TRAITS=[
  {weight:.55,restitution:.94,friction:.12,bounceLimit:4,special:'bounce'},
  {weight:.78,restitution:.82,friction:.2,bounceLimit:3,special:'sticky'},
  {weight:1,restitution:.76,friction:.2,bounceLimit:3,special:'shockwave'},
  {weight:.88,restitution:.8,friction:.18,bounceLimit:3,special:'electric'},
  {weight:1.05,restitution:.62,friction:.3,bounceLimit:3,special:null},
  {weight:1.1,restitution:.58,friction:.34,bounceLimit:3,special:null},
  {weight:1.3,restitution:.5,friction:.38,bounceLimit:3,special:null},
  {weight:1.55,restitution:.46,friction:.42,bounceLimit:3,special:null},
  {weight:1.9,restitution:.4,friction:.46,bounceLimit:3,special:'smash'}
];

const launchRng=value=>{let state=(value>>>0)||1;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};};
const distanceToSegment=(x,y,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1),px=a.x+dx*t,py=a.y+dy*t;return {distance:Math.hypot(x-px,y-py),x:px,y:py};};
const pointInRect=(x,y,rect)=>x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h;
const cloneLevel=level=>({
  ...level,
  launcher:{...level.launcher},
  bumpers:(level.bumpers||[]).map(item=>({...item})),
  gates:(level.gates||[]).map(item=>({...item,a:{...item.a},b:{...item.b}})),
  portals:(level.portals||[]).map(item=>({...item})),
  hazards:(level.hazards||[]).map(item=>({...item})),
  drains:(level.drains||[]).map(item=>({...item})),
  targets:(level.targets||[]).map(item=>({...item,hitCount:0,active:true})),
  goals:(level.goals||[]).map(item=>({...item,progress:0,done:false}))
});

const targetPoint=(target)=>({x:target.x,y:target.y});

export class LaunchWorld{
  constructor(onEvent=()=>{}){this.onEvent=onEvent;this.level=null;this.time=0;this.seed=0;this.launcherX=250;this.projectile=null;this.targets=[];this.gates=[];this.portals=[];this.rng=launchRng(1);this.nextId=1;this.nextEventId=1;this.shotId=0;this.shotChain=0;this.shotHadHazard=false;this.shotPerfect=true;}
  reset(level,seed=1){this.level=cloneLevel(level);this.seed=seed>>>0||1;this.rng=launchRng(this.seed);this.time=0;this.launcherX=this.level.launcher?.x||250;this.projectile=null;this.targets=this.level.targets;this.gates=this.level.gates;for(const gate of this.gates){gate.baseA={...gate.a};gate.baseB={...gate.b};gate.baseAngle=Math.atan2(gate.baseB.y-gate.baseA.y,gate.baseB.x-gate.baseA.x);gate.rotation=gate.angle||0;}this.portals=this.level.portals;this.nextId=1;this.nextEventId=1;this.shotId=0;this.shotChain=0;this.shotHadHazard=false;this.shotPerfect=true;}
  setLauncher(x){this.launcherX=clamp(x,LAUNCH_BOUNDS.left+34,LAUNCH_BOUNDS.right-34);}
  addProjectile(type,x=this.launcherX,y=this.level?.launcher?.y||548,vx=0,vy=0){if(this.projectile)return null;const traits=LAUNCH_TRAITS[type]||LAUNCH_TRAITS[0],r=TYPES[type]?.r||18;this.shotChain=0;this.shotHadHazard=false;this.shotPerfect=true;this.shotId++;this.projectile={id:this.nextId++,shotId:this.shotId,type,r,x,y,vx,vy,age:0,bounces:0,settleTime:0,portalCooldown:0,hits:new Set(),rings:new Set(),eventTargets:new Set(),stuckUntil:0,stuckTarget:null,railTo:null,traits};return this.projectile;}
  getTrajectory(type,x,y,vx,vy,maxBounces=3){const traits=LAUNCH_TRAITS[type]||LAUNCH_TRAITS[0],r=TYPES[type]?.r||18,points=[{x,y,bounce:0}];let px=x,py=y,dx=vx,dy=vy,bounces=0;for(let i=0;i<150;i++){dy+=760*traits.weight*.04;px+=dx*.04;py+=dy*.04;if(px-r<LAUNCH_BOUNDS.left||px+r>LAUNCH_BOUNDS.right){px=clamp(px,LAUNCH_BOUNDS.left+r,LAUNCH_BOUNDS.right-r);dx*=-traits.restitution;bounces++;}if(py-r<LAUNCH_BOUNDS.top){py=LAUNCH_BOUNDS.top+r;dy=Math.abs(dy)*traits.restitution;bounces++;}if(py+r>LAUNCH_BOUNDS.bottom){py=LAUNCH_BOUNDS.bottom-r;dy=-Math.abs(dy)*traits.restitution;bounces++;}if(i%3===0)points.push({x:px,y:py,bounce:bounces});if(bounces>maxBounces)break;}return points;}
  getTrajectoryAnnotations(type,x,y,vx,vy,maxBounces=3){const points=this.getTrajectory(type,x,y,vx,vy,maxBounces),hazards=this.level?.hazards||[],targets=this.targets||[];let nearest=null,nearestDistance=Infinity,warning=null;for(const target of targets){if(target.active===false&&target.kind!=='ring')continue;const distance=Math.min(...points.map(point=>Math.hypot(point.x-target.x,point.y-target.y)));if(distance<nearestDistance){nearestDistance=distance;nearest=target;}}for(const hazard of hazards){if(points.some(point=>point.x>=hazard.x&&point.x<=hazard.x+hazard.w&&point.y>=hazard.y&&point.y<=hazard.y+hazard.h)){warning='danger';break;}}return {points,nearestTarget:nearest?nearest.id:null,nearestDistance,warning,landingPoint:points[points.length-1]||{x,y}};}
  getTargetState(targetId){const target=this.targets.find(item=>item.id===targetId);return target?{id:target.id,kind:target.kind,active:target.active!==false,hitCount:target.hitCount||0}:null;}
  resetShot(){this.projectile=null;this.shotChain=0;this.shotHadHazard=false;this.shotPerfect=true;}
  setGate(id,angle){const gate=this.gates.find(item=>item.id===id);if(gate)gate.rotation=angle;}
  updateGate(gate){if(!gate.baseA||!gate.baseB)return;const centre={x:(gate.baseA.x+gate.baseB.x)/2,y:(gate.baseA.y+gate.baseB.y)/2},length=Math.hypot(gate.baseB.x-gate.baseA.x,gate.baseB.y-gate.baseA.y),angle=gate.baseAngle+(gate.rotation||0)+(gate.spin?Math.sin(this.time*gate.spin)*.58:0),dx=Math.cos(angle)*length/2,dy=Math.sin(angle)*length/2;gate.a={x:centre.x-dx,y:centre.y-dy};gate.b={x:centre.x+dx,y:centre.y+dy};}
  emit(event){const projectile=this.projectile;this.onEvent({...event,eventId:this.nextEventId++,shotId:projectile?.shotId??this.shotId,fruitType:projectile?.type??event.fruitType??null,x:event.x??projectile?.x??0,y:event.y??projectile?.y??0,chain:event.chain??this.shotChain,perfect:event.perfect??false,special:event.special??null});}
  finishShot(reason='settled'){const projectile=this.projectile;if(!projectile)return;const perfect=this.shotPerfect&&!this.shotHadHazard&&this.shotChain>=2;if(reason==='lost')this.emit({type:'projectile-lost',fruitType:projectile.type,x:projectile.x,y:projectile.y,chain:this.shotChain,perfect,special:reason});this.emit({type:'shot-settled',fruitType:projectile.type,x:projectile.x,y:projectile.y,chain:this.shotChain,perfect,special:reason});this.projectile=null;}
  activateTarget(target,special=null){const projectile=this.projectile;if(!projectile||!target||projectile.hits.has(target.id)||!target.active)return;projectile.hits.add(target.id);if(target.requiredType!=null&&projectile.type!==target.requiredType){this.shotPerfect=false;this.emit({type:target.kind==='bottle'?'bottle-fill':target.kind==='switch'?'switch-activate':'target-hit',targetId:target.id,x:target.x,y:target.y,chain:this.shotChain,perfect:false,special:'wrong-type'});return;}target.hitCount=(target.hitCount||0)+1;target.active=false;this.shotChain++;this.emit({type:target.kind==='bottle'?'bottle-fill':target.kind==='switch'?'switch-activate':'target-hit',targetId:target.id,x:target.x,y:target.y,chain:this.shotChain,perfect:false,special});const traits=projectile.traits;if(traits.special==='shockwave'&&special!=='citrus-shockwave'){for(const nearby of this.targets){if(nearby.active&&Math.hypot(nearby.x-target.x,nearby.y-target.y)<=48)this.activateTarget(nearby,'citrus-shockwave');}}if(traits.special==='electric'&&target.railGroup){const candidates=this.targets.filter(item=>item.active&&item.railGroup===target.railGroup).sort((a,b)=>(a.order||0)-(b.order||0));const next=candidates.find(item=>(item.order||0)>(target.order||0));if(next){projectile.railTo=next.id;projectile.vx=0;projectile.vy=0;}}if(traits.special==='sticky'){projectile.stuckTarget=target;projectile.stuckUntil=this.time+1;projectile.vx=0;projectile.vy=0;}if(target.kind==='bottle')this.finishShot('bottle');}
  detectSensors(){const projectile=this.projectile;if(!projectile)return;for(const target of this.targets){if(!target.active&&target.kind!=='ring')continue;const d=Math.hypot(projectile.x-target.x,projectile.y-target.y);if(target.kind==='ring'){if(d<=target.r&&!projectile.rings.has(target.id)){projectile.rings.add(target.id);this.shotChain++;this.emit({type:'ring-pass',targetId:target.id,x:target.x,y:target.y,chain:this.shotChain,perfect:false});}}else if(d<=projectile.r+target.r)this.activateTarget(target);}for(const hazard of this.level.hazards||[]){if(pointInRect(projectile.x,projectile.y,hazard)&&!projectile.hazardCooldown){projectile.hazardCooldown=true;this.shotHadHazard=true;this.shotPerfect=false;this.emit({type:'hazard',targetId:hazard.id||null,x:projectile.x,y:projectile.y,chain:this.shotChain,special:'danger'});}if(!pointInRect(projectile.x,projectile.y,hazard))projectile.hazardCooldown=false;}for(const drain of this.level.drains||[]){if(pointInRect(projectile.x,projectile.y,drain)){this.finishShot('lost');return;}}}
  recordBounce(projectile){projectile.bounces++;if(projectile.bounces>projectile.traits.bounceLimit){projectile.vx*=.76;projectile.vy*=.76;}}
  reflectCircle(centre,radius){const projectile=this.projectile;if(!projectile||centre.broken)return;const dx=projectile.x-centre.x,dy=projectile.y-centre.y,d=Math.hypot(dx,dy)||.001,min=projectile.r+radius;if(d>=min)return;const nx=dx/d,ny=dy/d;projectile.x=centre.x+nx*min;projectile.y=centre.y+ny*min;const dot=projectile.vx*nx+projectile.vy*ny;if(dot<0){projectile.vx-=2*dot*nx;projectile.vy-=2*dot*ny;projectile.vx*=projectile.traits.restitution;projectile.vy*=projectile.traits.restitution;this.recordBounce(projectile);if(projectile.traits.special==='smash'&&radius>=26){centre.broken=true;this.emit({type:'obstacle-break',targetId:centre.id||null,x:centre.x,y:centre.y,special:'smash'});}}}
  reflectGate(gate){const projectile=this.projectile;if(!projectile||gate.broken)return;const hit=distanceToSegment(projectile.x,projectile.y,gate.a,gate.b);if(hit.distance>=projectile.r)return;const sx=gate.b.x-gate.a.x,sy=gate.b.y-gate.a.y,len=Math.hypot(sx,sy)||1,nx0=-sy/len,ny0=sx/len;let nx=nx0,ny=ny0;if((projectile.x-hit.x)*nx+(projectile.y-hit.y)*ny<0){nx=-nx;ny=-ny;}projectile.x=hit.x+nx*projectile.r;projectile.y=hit.y+ny*projectile.r;const dot=projectile.vx*nx+projectile.vy*ny;if(dot<0){projectile.vx-=2*dot*nx;projectile.vy-=2*dot*ny;projectile.vx*=projectile.traits.restitution;projectile.vy*=projectile.traits.restitution;this.recordBounce(projectile);}}
  step(dt=1/120){const projectile=this.projectile;if(!projectile||!this.level)return;this.time+=dt;projectile.age+=dt;if(projectile.portalCooldown>0)projectile.portalCooldown-=dt;if(projectile.stuckUntil>this.time)return;if(projectile.stuckTarget&&projectile.stuckUntil<=this.time)projectile.stuckTarget=null;if(projectile.railTo){const target=this.targets.find(item=>item.id===projectile.railTo);if(target?.active){const dx=target.x-projectile.x,dy=target.y-projectile.y,distance=Math.hypot(dx,dy)||.001,travel=520*dt;if(distance<=travel){projectile.x=target.x;projectile.y=target.y;projectile.railTo=null;this.activateTarget(target,'electric-rail');if(!this.projectile)return;if(projectile.railTo)return;}else{projectile.x+=dx/distance*travel;projectile.y+=dy/distance*travel;return;}}else projectile.railTo=null;}const t=projectile.traits;projectile.vy+=760*t.weight*dt;projectile.x+=projectile.vx*dt;projectile.y+=projectile.vy*dt;if(projectile.x-projectile.r<LAUNCH_BOUNDS.left){projectile.x=LAUNCH_BOUNDS.left+projectile.r;projectile.vx=Math.abs(projectile.vx)*t.restitution;this.recordBounce(projectile);}if(projectile.x+projectile.r>LAUNCH_BOUNDS.right){projectile.x=LAUNCH_BOUNDS.right-projectile.r;projectile.vx=-Math.abs(projectile.vx)*t.restitution;this.recordBounce(projectile);}if(projectile.y-projectile.r<LAUNCH_BOUNDS.top){projectile.y=LAUNCH_BOUNDS.top+projectile.r;projectile.vy=Math.abs(projectile.vy)*t.restitution;this.recordBounce(projectile);}if(projectile.y+projectile.r>LAUNCH_BOUNDS.bottom){projectile.y=LAUNCH_BOUNDS.bottom-projectile.r;if(projectile.age>.7&&Math.abs(projectile.vy)<150){this.finishShot('lost');return;}projectile.vy=-Math.abs(projectile.vy)*t.restitution;projectile.vx*=1-t.friction;this.recordBounce(projectile);}for(const bumper of this.level.bumpers||[])this.reflectCircle(bumper,bumper.r);for(const gate of this.gates){this.updateGate(gate);if(gate.active!==false)this.reflectGate(gate);}for(const portal of this.portals){if(projectile.portalCooldown>0)continue;const d=Math.hypot(projectile.x-portal.x,projectile.y-portal.y);if(d<=portal.r){const pair=this.portals.find(item=>item.id===portal.pair);if(pair){projectile.x=pair.x;projectile.y=pair.y;projectile.portalCooldown=.3;this.emit({type:'portal',targetId:portal.id,special:'teleport'});break;}}}this.detectSensors();if(!this.projectile)return;const speed=Math.hypot(projectile.vx,projectile.vy);if(speed<35){projectile.settleTime+=dt;if(projectile.settleTime>=.45)this.finishShot('settled');}else projectile.settleTime=0;if(projectile.age>=8)this.finishShot('lost');}
}

const crystal=(id,x,y,extra={})=>({id,kind:'crystal',x,y,r:18,...extra});
const ring=(id,x,y,r=28,extra={})=>({id,kind:'ring',x,y,r,...extra});
const sw=(id,x,y,extra={})=>({id,kind:'switch',x,y,r:19,...extra});
const bottle=(id,x,y,extra={})=>({id,kind:'bottle',x,y,r:24,...extra});
const goal=(kind,targetId,count=1,requiredType=null)=>({kind,targetId,count,requiredType,progress:0,done:false});
const level=(id,title,description,targets,goals,extra={})=>({id,title,description,archetype:extra.archetype||'precision',difficulty:extra.difficulty||Math.min(5,Math.ceil(id/3)),hint:extra.hint||'观察轨迹，先找一条安全路线。',optionalGoals:extra.optionalGoals||[],visualTheme:extra.visualTheme||'lavender',recommendedRoute:extra.recommendedRoute||null,ammo:extra.ammo||8,launcher:extra.launcher||{x:250,y:548},bumpers:extra.bumpers||[],gates:extra.gates||[],portals:extra.portals||[],hazards:extra.hazards||[],drains:extra.drains||[{id:'left-drain',x:18,y:566,w:105,h:28},{id:'right-drain',x:377,y:566,w:105,h:28}],targets,goals,recommendedTypes:extra.recommendedTypes||[0,1,2],scoreThresholds:extra.scoreThresholds||{B:240,A:420,S:620}});

export const LAUNCH_LEVELS=[
  level(1,'第一次反弹','瞄准中央晶体，熟悉水果的弹性。',[crystal('c1',250,190)],[goal('hit','c1')],{archetype:'tutorial',difficulty:1,hint:'保持中等力度，直线就能点亮中央晶体。',bumpers:[],scoreThresholds:{B:100,A:180,S:280}}),
  level(2,'左右回响','让水果借助两侧墙壁完成命中。',[crystal('c1',108,195),crystal('c2',392,195)],[goal('hit','c1'),goal('hit','c2')],{archetype:'bank-shot',difficulty:1,hint:'先瞄准一侧，反弹后再处理另一侧。',bumpers:[{x:250,y:330,r:24}],scoreThresholds:{B:220,A:360,S:520}}),
  level(3,'穿过光环','穿过蓝色实验环后，再点亮晶体。',[ring('r1',250,285,34),crystal('c1',250,145)],[goal('ring','r1'),goal('hit','c1')],{archetype:'ring-timing',difficulty:1,hint:'让水果从环的中心穿过，随后会自然接近晶体。',bumpers:[{x:160,y:380,r:22},{x:340,y:380,r:22}],scoreThresholds:{B:220,A:380,S:560}}),
  level(4,'弹力走廊','利用弹力板改变方向。',[crystal('c1',120,170),crystal('c2',380,170)],[goal('hit','c1'),goal('hit','c2')],{archetype:'bumper-route',difficulty:2,hint:'弹力板适合改变横向方向，不必追求最大力度。',bumpers:[{x:145,y:320,r:28},{x:355,y:320,r:28},{x:250,y:250,r:18}],gates:[{id:'g1',a:{x:210,y:430},b:{x:290,y:430},angle:0}],scoreThresholds:{B:240,A:420,S:620}}),
  level(5,'旋转挡板','挡板会改变每一发水果的路线。',[ring('r1',130,220,30),ring('r2',370,220,30),crystal('c1',250,130)],[goal('ring','r1'),goal('ring','r2'),goal('hit','c1')],{archetype:'rotating-gate',difficulty:2,hint:'观察挡板的开口，在它转到合适角度时发射。',bumpers:[{x:250,y:350,r:32}],gates:[{id:'g1',a:{x:170,y:315},b:{x:330,y:315},angle:0,spin:.8}],scoreThresholds:{B:320,A:520,S:760}}),
  level(6,'传送花园','通过传送门，把水果送到另一侧。',[crystal('c1',110,160),crystal('c2',390,160)],[goal('hit','c1'),goal('hit','c2')],{archetype:'portal-route',difficulty:2,hint:'进入任意传送门后，水果会从另一侧出现。',portals:[{id:'p1',pair:'p2',x:110,y:330,r:24},{id:'p2',pair:'p1',x:390,y:330,r:24}],bumpers:[{x:250,y:270,r:26}],scoreThresholds:{B:240,A:420,S:640}}),
  level(7,'柑橘冲击','柑橘的冲击波可以点亮相邻晶体。',[crystal('c1',205,170),crystal('c2',250,155),crystal('c3',295,170)],[goal('hit','c1',1,2),goal('hit','c2',1,2),goal('hit','c3',1,2) ],{archetype:'special-combo',difficulty:3,hint:'用柑橘撞击中间晶体，让冲击波完成连锁。',bumpers:[{x:250,y:350,r:30}],recommendedTypes:[2],scoreThresholds:{B:260,A:440,S:660}}),
  level(8,'樱桃停靠','让樱桃吸附在晶体上，完成精准停留。',[crystal('c1',250,150),ring('r1',250,275,31)],[goal('ring','r1'),goal('hit','c1',1,1)],{archetype:'precision-stop',difficulty:3,hint:'樱桃碰到晶体会短暂停住，利用这段时间穿过下方的环。',bumpers:[{x:170,y:365,r:25},{x:330,y:365,r:25}],recommendedTypes:[1],scoreThresholds:{B:240,A:400,S:600}}),
  level(9,'柠檬电轨','沿着导电轨道依次激活三个晶体。',[crystal('c1',150,170,{railGroup:'rail',order:1}),crystal('c2',250,125,{railGroup:'rail',order:2}),crystal('c3',350,170,{railGroup:'rail',order:3})],[goal('hit','c1',1,3),goal('hit','c2',1,3),goal('hit','c3',1,3)],{archetype:'electric-chain',difficulty:3,hint:'先命中编号最小的晶体，柠檬会沿电轨继续前进。',gates:[{id:'g1',a:{x:190,y:300},b:{x:310,y:300},angle:0}],recommendedTypes:[3],scoreThresholds:{B:300,A:500,S:740}}),
  level(10,'危险边缘','避开两侧危险区，完成双目标。',[crystal('c1',120,150),crystal('c2',380,150)],[goal('hit','c1'),goal('hit','c2')],{archetype:'hazard-avoid',difficulty:4,hint:'保持路线在中央，危险区只会扣稳定度，不值得冒险。',hazards:[{id:'h1',x:18,y:250,w:70,h:250},{id:'h2',x:412,y:250,w:70,h:250}],bumpers:[{x:250,y:320,r:30}],scoreThresholds:{B:220,A:380,S:580}}),
  level(11,'瓶中月光','把指定水果送入成品瓶。',[bottle('b1',250,135,{requiredType:4}),crystal('c1',120,210),crystal('c2',380,210)],[goal('bottle','b1',1,4),goal('hit','c1'),goal('hit','c2')],{archetype:'bottle-precision',difficulty:4,hint:'先用两颗普通水果清理路线，最后把奇异果送进瓶中。',bumpers:[{x:150,y:360,r:24},{x:350,y:360,r:24}],recommendedTypes:[4],scoreThresholds:{B:340,A:540,S:800}}),
  level(12,'终极连锁','在一次实验中完成最多目标。',[ring('r1',125,180,28),ring('r2',375,180,28),sw('s1',250,265),crystal('c1',250,130)],[goal('ring','r1'),goal('ring','r2'),goal('switch','s1'),goal('hit','c1')],{archetype:'master-chain',difficulty:5,hint:'先穿两侧环，再用重水果压机关，最后点亮晶体。',bumpers:[{x:160,y:370,r:24},{x:340,y:370,r:24},{x:250,y:340,r:25}],gates:[{id:'g1',a:{x:205,y:230},b:{x:295,y:230},angle:0,spin:1}],scoreThresholds:{B:420,A:680,S:980}})
];

const createValidationSample=(level)=>({x:clamp(level.launcher?.x||250,LAUNCH_BOUNDS.left+34,LAUNCH_BOUNDS.right-34),y:level.launcher?.y||548});
const probeLaunchReachability=(level,seed)=>{const reached=new Set(),types=[...new Set([...(level.recommendedTypes||[0]),...(level.goals||[]).map(item=>item.requiredType).filter(Number.isInteger)])],horizontal=[-1800,-1500,-1250,-900,-600,-300,0,300,600,900,1250,1500,1800],vertical=[-650,-850,-1050,-1250,-1500,-1800,-2100,-2460,-2580];for(const type of types){for(const vx of horizontal){for(const vy of vertical){const world=new LaunchWorld(event=>{if(event.special!=='wrong-type'&&['target-hit','ring-pass','switch-activate','bottle-fill'].includes(event.type))reached.add(event.targetId);});world.reset(level,seed);world.addProjectile(type,world.launcherX,level.launcher?.y||548,vx,vy);for(let step=0;step<960&&world.projectile;step++)world.step(1/120);if((level.goals||[]).every(goal=>reached.has(goal.targetId)))return reached;}}}return reached;};
export function validateLaunchLevel(value,seed=1){const level=value?.template||value;if(!level||!Array.isArray(level.targets)||!level.launcher)return {ok:false,issues:['缺少发射台或目标']};const issues=[];const ids=new Set();for(const target of level.targets){if(!target.id||ids.has(target.id))issues.push('目标 ID 重复或为空');ids.add(target.id);if(!Number.isFinite(target.x)||!Number.isFinite(target.y))issues.push(`目标 ${target.id} 坐标无效`);}for(const item of level.goals||[]){if(!ids.has(item.targetId))issues.push(`目标 ${item.targetId} 没有对应传感器`);}const route=level.recommendedRoute;if(route&&!Array.isArray(route))issues.push('推荐路线必须是数组');const sample=createValidationSample(level);if(sample.x<LAUNCH_BOUNDS.left||sample.x>LAUNCH_BOUNDS.right)issues.push('发射台超出边界');if(issues.length===0){const reached=probeLaunchReachability(level,seed>>>0||1);for(const item of level.goals||[]){if(!reached.has(item.targetId))issues.push(`目标 ${item.targetId} 在基础轨迹抽样中不可达`);}}return {ok:issues.length===0,issues,seed:seed>>>0||1};}

export const LAUNCH_CHALLENGE={id:'seeded',title:'种子挑战',description:'每次进入都会复现同一套实验路线。',template:LAUNCH_LEVELS[8],seed:20260909};
