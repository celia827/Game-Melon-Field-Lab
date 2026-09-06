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
    this.time=0;this.combo=0;this.multiplier=1;this.focus=0;this.shield=0;this.invulnerable=0;
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


module.exports=FlightModel;
