'use strict';

const CHAPTERS=require('./chapters.js');
const FALLBACK_RULES={speed:2.65,speedRamp:.012,gravity:18.5,flap:6.05,wind:0,gapMin:1.52,gapMax:1.52,moveAmplitude:0,moveFrequency:0,pulseMin:1.52,pulseAmount:0,centerRange:1.25,duration:Infinity,gateCount:Infinity,pattern:['standard','standard','standard','moving','standard','standard','standard']};

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
    const chapterConfig=this.runMode==='chapter'?CHAPTERS[this.chapter]:CHAPTERS.endless;
    this.config=options.config||chapterConfig||{};this.rules={...FALLBACK_RULES,...(this.config.physics||{}),...(options.physics||{})};
    this.pattern=options.pattern||this.rules.pattern||FALLBACK_RULES.pattern;
    this.passedGates=0;
    this.gates=Array.from({length:6},(_,i)=>this.makeGate(i,x+5.9+i*4.45,i===0?.1:this.nextCenter()));
  }
  nextCenter() { return (this.random()-.5)*this.rules.centerRange*2; }
  makeGate(index,x,center) {
    // The former split layout put a second pillar in the playable opening.
    // Keep old patterns compatible, but always use the regular wide opening.
    const requestedKind=this.pattern[index%this.pattern.length]||'standard';
    const kind=['standard','moving','pulse','wind','bonus'].includes(requestedKind)?requestedKind:'standard';
    const regularGap=this.rules.gapMin+this.random()*Math.max(0,this.rules.gapMax-this.rules.gapMin);
    const gap=kind==='bonus'?Math.max(this.rules.gapMax,this.rules.gapMin+.28):regularGap;
    const gate={id:index,kind,x,center,baseCenter:center,routeCenters:null,phase:this.random()*Math.PI*2,
      passed:false,scored:false,bonusAwarded:false,gap,baseGap:gap,
      wind:kind==='wind'?((this.random()-.5)*2.2):0,items:[]};
    if(kind==='bonus'){
      gate.items.push({type:'seed',x,y:center-.42,offsetY:-.42,collected:false});
      gate.items.push({type:'pollen',x,y:center+.42,offsetY:.42,collected:false});
    }else gate.items.push({type:index%9===7?'leaf':index%4===2?'pollen':'seed',x,y:center,collected:false});
    return gate;
  }
  gateState(g) {
    const t=this.time;
    if(g.kind==='moving')g.center=g.baseCenter+Math.sin(t*this.rules.moveFrequency*3.7+g.phase)*this.rules.moveAmplitude;
    else if(g.kind==='pulse')g.gap=Math.max(this.rules.pulseMin,g.baseGap-this.rules.pulseAmount*(.5+.5*Math.sin(t*2.1+g.phase)))+1e-6;
    else g.center=g.baseCenter;
    if(g.kind==='wind')g.center=g.baseCenter+Math.sin(t*.9+g.phase)*this.rules.moveAmplitude;
    for(const item of g.items){item.x=g.x;item.y=g.center+(item.offsetY||0);}
  }
  currentTargets(g) { return [g.center]; }
  isSafe(g,y) { return this.currentTargets(g).some(c=>Math.abs(y-c)<=Math.max(.05,g.gap-.27)); }
  flap() { if(this.alive)this.vy=this.rules.flap; }
  step(dt) {
    if(!this.alive)return {hit:false,passed:0,events:[]};
    this.time+=dt;this.events=[];this.invulnerable=Math.max(0,this.invulnerable-dt);
    if(this.combo&&this.time-this.lastPerfect>2){this.combo=0;this.multiplier=1;}
    const speed=(this.rules.speed+Math.min(this.score,35)*this.rules.speedRamp)*(this.runMode==='chapter'?.98:1);
    let wind=0;
    for(const g of this.gates){this.gateState(g);if(g.kind==='wind'&&Math.abs(g.x-this.x)<3)wind=g.wind*(.5+.5*Math.sin(this.time*1.4+g.phase));}
    const collisionY=this.y;
    this.vy=Math.max(-10,this.vy-this.rules.gravity*dt+wind*dt+this.rules.wind*dt); this.y+=this.vy*dt; this.distance+=speed*dt;
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
    if(!hit)for(const g of this.gates){if(!g.passed&&g.x+.56<this.x-.27){g.passed=true;passed++;this.passedGates++;const target=g.center;const perfect=Math.abs(this.y-target)<=g.gap*.22;let points=1;if(perfect){this.combo=this.time-this.lastPerfect<=1.2?this.combo+1:1;this.lastPerfect=this.time;this.multiplier=Math.min(4,1+Math.floor(this.combo/3));this.focus=Math.min(100,this.focus+20);if(this.focus>=100&&this.shield===0){this.focus=0;this.shield=1;this.events.push({type:'shield-ready'});}points=2*this.multiplier;this.events.push({type:'perfect',combo:this.combo,multiplier:this.multiplier,points,x:this.x,y:this.y});}else{this.route='safe';this.events.push({type:'pass',points,x:this.x,y:this.y});}this.score+=points;this.events.push({type:'passed',points,perfect});if(g.kind==='bonus'&&g.items.length===2&&g.items.every(item=>item.collected)){g.bonusAwarded=true;this.score+=4;this.events.push({type:'bonus',points:4,x:this.x,y:this.y});}}}
    for(const g of this.gates)if(g.x<this.x-7){const nextX=Math.max(...this.gates.map(p=>p.x))+4.45;const nextCenter=this.nextCenter();Object.assign(g,this.makeGate(g.id,nextX,nextCenter));}
    if(this.runMode==='chapter'&&((Number.isFinite(this.rules.gateCount)&&this.passedGates>=this.rules.gateCount)||this.time>=(this.rules.duration||45))){this.completed=true;this.alive=false;this.events.push({type:'complete',gates:this.passedGates});}
    this.alive=!hit&&!this.completed; return {hit,passed,events:this.events.slice()};
  }
}


module.exports=FlightModel;
