'use strict';

class FlightModel {
  constructor(random = Math.random) { this.random = random; this.limit=5.5; this.reset(-3); }
  reset(x) {
    this.x=x; this.y=0; this.vy=0; this.score=0; this.alive=true; this.distance=0;
    this.gates=Array.from({length:6},(_,i)=>({x:x+5.9+i*4.45,center:i===0?.1:this.nextCenter(),passed:false}));
  }
  nextCenter() { return (this.random()-.5)*2.8; }
  flap() { if(this.alive)this.vy=6.05; }
  step(dt) {
    if(!this.alive)return {hit:false,passed:0};
    const speed=2.65+Math.min(this.score,35)*.012;
    this.vy=Math.max(-10,this.vy-18.5*dt); this.y+=this.vy*dt; this.distance+=speed*dt;
    let hit=this.y-.27<-this.limit||this.y+.27>this.limit,passed=0;
    for(const g of this.gates){
      g.x-=speed*dt;
      if(Math.abs(g.x-this.x)<.83){
        const dx=Math.max(Math.abs(g.x-this.x)-.56,0);
        const half=1.52;
        const dy=Math.max(0,half-Math.abs(this.y-g.center));
        if(dx*dx+dy*dy<.27*.27)hit=true;
      }
      if(this.y<-4.29&&this.y>-6.59){
        const width=.22+.78*Math.min(1,Math.max(0,(this.y+6.32)/1.76));
        const dx=Math.max(Math.abs(g.x-this.x)-width,0),dy=Math.max(this.y+4.56,-6.32-this.y,0);
        if(dx*dx+dy*dy<.27*.27)hit=true;
      }
    }
    if(!hit)for(const g of this.gates){if(!g.passed&&g.x+.56<this.x-.27){g.passed=true;this.score++;passed++;}}
    for(const g of this.gates)if(g.x<this.x-7){g.x=Math.max(...this.gates.map(p=>p.x))+4.45;g.center=this.nextCenter();g.passed=false;}
    this.alive=!hit; return {hit,passed};
  }
}


module.exports=FlightModel;
