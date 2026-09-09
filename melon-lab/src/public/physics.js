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
  add(type,x,y,vx=0,vy=0,{fresh=true}={}){
    const r=TYPES[type].r;
    const p=Array.from({length:N},(_,i)=>{const angle=TAU*i/N,px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;return{x:px,y:py,px:px-vx/120,py:py-vy/120};});
    const body={id:this.nextId++,type,r,p,x,y,age:0,area:areaOf(p),danger:0,frozenUntil:0,freshUntil:fresh?this.time+1:-Infinity};
    this.bodies.push(body);return body;
  }
  reset(seed=true){this.bodies=[];this.time=0;this.nextId=1;this.tilt=0;this.gravityScale=1;this.lastMergeTime=-Infinity;this.cascadeDepth=0;if(seed){this.add(4,91,BOUNDS.bottom-50,0,0,{fresh:false});this.add(3,191,BOUNDS.bottom-40,0,0,{fresh:false});this.add(5,305,BOUNDS.bottom-61,0,0,{fresh:false});this.add(2,413,BOUNDS.bottom-32,0,0,{fresh:false});this.add(1,255,BOUNDS.bottom-137,0,0,{fresh:false});}}
  stir(){for(const b of this.bodies){if(b.frozenUntil>this.time)continue;for(const p of b.p){const vx=(b.x-250)*-1.5+(b.y-430)*1.9,vy=-250-(Math.random()*100);p.px=p.x-vx/120;p.py=p.y-vy/120;}}}
  freezeExisting(until){for(const b of this.bodies)b.frozenUntil=Math.max(b.frozenUntil,until);}
  releaseVent(){for(const b of this.bodies){const highest=Math.min(...b.p.map(p=>p.y));if(highest<BOUNDS.line){for(const p of b.p)p.py=p.y-260/120;b.danger=0;}}}
  step(dt=1/120){
    const mode=MODES[this.mode];this.time+=dt;
    for(const b of this.bodies){b.age+=dt;const frozen=b.frozenUntil>this.time;if(!frozen){for(const p of b.p){const vx=clamp((p.x-p.px)*mode.damping,-5,5),vy=clamp((p.y-p.py)*mode.damping,-5,5);p.px=p.x;p.py=p.y;p.x+=vx+this.tilt*760*dt*dt;p.y+=vy+980*this.gravityScale*dt*dt;}}}
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
    if(merges.length){this.bodies=this.bodies.filter(b=>!locked.has(b.id));for(const[a,b]of merges){const type=a.type+1,x=(a.x+b.x)/2,y=(a.y+b.y)/2,cascade=this.time-this.lastMergeTime<=.12;this.cascadeDepth=cascade?this.cascadeDepth+1:1;this.lastMergeTime=this.time;if(type<TYPES.length){const r=TYPES[type].r;this.add(type,clamp(x,BOUNDS.left+r,BOUNDS.right-r),Math.min(y,BOUNDS.bottom-r),0,0,{fresh:false});}this.onMerge({type:Math.min(type,8),x,y,points:2**(type+1),cleared:type>=TYPES.length,cascade,cascadeDepth:this.cascadeDepth,perfect:a.freshUntil>=this.time||b.freshUntil>=this.time});}}
    for(const b of this.bodies){center(b);const highest=Math.min(...b.p.map(p=>p.y));b.danger=b.age>1.8&&highest<BOUNDS.line?b.danger+dt*mode.dangerRate:Math.max(0,b.danger-dt*2);}
  }
}
