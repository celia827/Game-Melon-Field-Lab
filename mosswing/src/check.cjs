const assert=require('node:assert/strict');
const FlightModel=require('./physics.cjs');
const model=()=>new FlightModel(()=>.5);
let m=model();m.flap();for(let i=0;i<10;i++)m.step(1/120);assert(m.y>0);assert(m.vy<6.05);
m=model();for(let i=0;i<600&&m.alive;i++)m.step(1/120);assert(!m.alive);assert.equal(m.score,0);
m=model();m.gates[0].x=m.x;m.y=1.6;assert(m.step(1/120).hit);const y=m.y;assert.deepEqual(m.step(1/120),{hit:false,passed:0});assert.equal(m.y,y);
m=model();m.gates[0].x=m.x;m.y=.1;assert(!m.step(1/120).hit);
m=model();m.gates[0].x=m.x-.85;assert.equal(m.step(1/120).passed,1);assert.equal(m.step(1/120).passed,0);assert.equal(m.score,1);
m=model();m.gates[0].x=m.x-8;m.step(1/120);assert(m.gates[0].x>m.x+20);assert.equal(m.gates[0].passed,false);
for(const fps of [30,60,120]){m=model();for(let i=0;i<fps*90&&m.alive;i++){if(m.y<-.25&&m.vy<0)m.flap();for(let j=0;j<120/fps;j++)m.step(1/120);}assert(m.alive);assert(m.score>50);}
let seed=21;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
m=new FlightModel(random);let highest=0,lowest=0;
for(let i=0;i<120*240&&m.alive;i++){const next=m.gates.filter(g=>g.x>m.x-.83).sort((a,b)=>a.x-b.x)[0];const target=next.center-.3;if(m.y<target&&m.vy<1.5)m.flap();m.step(1/120);highest=Math.max(highest,m.y);lowest=Math.min(lowest,m.y);}
assert(m.alive);assert(m.score>100);assert(highest>1);assert(lowest<-1);
m.reset(-1.3);assert(m.alive);assert.equal(m.score,0);assert.equal(m.y,0);assert.equal(m.gates.length,6);
console.log('PASS: impulse, gravity, ceiling/floor, obstacle collision, clear gaps, score once, obstacle recycling, 30/60/120 Hz, 240-second random course, restart.');
