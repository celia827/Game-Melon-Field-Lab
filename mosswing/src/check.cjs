const assert=require('node:assert/strict');
const FlightModel=require('./physics.cjs');
const model=()=>{const m=new FlightModel(()=>.5);m.reset(-3,{pattern:['standard']});return m;};
let m=model();m.flap();for(let i=0;i<10;i++)m.step(1/120);assert(m.y>0);assert(m.vy<6.05);
m=model();for(let i=0;i<600&&m.alive;i++)m.step(1/120);assert(!m.alive);assert.equal(m.score,0);
m=model();m.gates[0].x=m.x;m.y=1.6;assert(m.step(1/120).hit);const y=m.y;assert.deepEqual(m.step(1/120),{hit:false,passed:0,events:[]});assert.equal(m.y,y);
m=model();m.gates[0].x=m.x;m.y=.1;assert(!m.step(1/120).hit);
m=model();m.gates[0].x=m.x-.85;assert.equal(m.step(1/120).passed,1);assert.equal(m.step(1/120).passed,0);assert.equal(m.score,2);
m=model();m.gates[0].x=m.x-8;m.step(1/120);assert(m.gates[0].x>m.x+20);assert.equal(m.gates[0].passed,false);
for(const fps of [30,60,120]){m=model();for(let i=0;i<fps*90&&m.alive;i++){if(m.y<-.25&&m.vy<0)m.flap();for(let j=0;j<120/fps;j++)m.step(1/120);}assert(m.alive);assert(m.score>50);}
let seed=21;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
m=new FlightModel(random);m.reset(-3,{pattern:['standard']});let highest=0,lowest=0;
for(let i=0;i<120*240&&m.alive;i++){const next=m.gates.filter(g=>g.x>m.x-.83).sort((a,b)=>a.x-b.x)[0];const target=next.center-.3;if(m.y<target&&m.vy<1.5)m.flap();m.step(1/120);highest=Math.max(highest,m.y);lowest=Math.min(lowest,m.y);}
assert(m.alive);assert(m.score>100);assert(highest>1);assert(lowest<-1);
m.reset(-1.3);assert(m.alive);assert.equal(m.score,0);assert.equal(m.y,0);assert.equal(m.gates.length,6);
// New gameplay systems: deterministic routes, obstacle kinds, scoring feedback, and chapter completion.
const kinds=['standard','moving','pulse','wind','bonus','standard'];
const a=new FlightModel();const b=new FlightModel();a.reset(-3,{seed:90210,pattern:kinds});b.reset(-3,{seed:90210,pattern:kinds});
assert.deepEqual(a.gates.map(g=>({kind:g.kind,center:g.baseCenter,phase:g.phase,wind:g.wind})),b.gates.map(g=>({kind:g.kind,center:g.baseCenter,phase:g.phase,wind:g.wind})));
assert.deepEqual(a.gates.map(g=>g.kind),kinds);
for(const kind of kinds){const t=new FlightModel();t.reset(-3,{pattern:[kind],seed:7});assert.equal(t.gates[0].kind,kind);}
const bonusGate=new FlightModel();bonusGate.reset(-3,{pattern:['bonus'],seed:7});
assert.equal(bonusGate.gates[0].items.length,2);assert(bonusGate.gates[0].gap>=bonusGate.rules.gapMin+.28);
assert.deepEqual(bonusGate.gates[0].items.map(item=>item.offsetY),[-.42,.42]);
bonusGate.gates[0].x=bonusGate.x-.9;bonusGate.gates[0].center=0;bonusGate.gates[0].baseCenter=0;bonusGate.gates[0].items.forEach(item=>item.collected=true);
const bonusResult=bonusGate.step(1/120);assert(bonusResult.events.some(e=>e.type==='bonus'&&e.points===4));assert.equal(bonusGate.score,6);
assert.equal(bonusGate.step(1/120).events.some(e=>e.type==='bonus'),false);
const legacySplit=new FlightModel();legacySplit.reset(-3,{pattern:['split'],seed:7});assert.equal(legacySplit.gates[0].kind,'standard');assert.equal(legacySplit.gates[0].gap,1.52);assert.equal(legacySplit.gates[0].routeCenters,null);
const legacyRing=new FlightModel();legacyRing.reset(-3,{pattern:['ring'],seed:7});assert.equal(legacyRing.gates[0].kind,'standard');assert.equal(legacyRing.gates[0].routeCenters,null);
const randomRunA=new FlightModel();const randomRunB=new FlightModel();randomRunA.reset(-3,{mode:'chapter',chapter:0,seed:123,randomizePattern:true});randomRunB.reset(-3,{mode:'chapter',chapter:0,seed:123,randomizePattern:true});assert.deepEqual(randomRunA.gates.map(g=>g.kind),randomRunB.gates.map(g=>g.kind));assert(randomRunA.gates.some(g=>g.kind==='choice'||g.kind==='bonus'||g.kind==='moving'));
const choice=new FlightModel();choice.reset(-3,{pattern:['choice'],seed:7});choice.gates[0].x=choice.x;choice.y=choice.gates[0].routeCenters[0];assert(!choice.step(1/120).hit);const choiceTop=new FlightModel();choiceTop.reset(-3,{pattern:['choice'],seed:7});choiceTop.gates[0].x=choiceTop.x;choiceTop.y=choiceTop.gates[0].routeCenters[1];assert(!choiceTop.step(1/120).hit);
for(let chapter=0;chapter<4;chapter++){const t=new FlightModel();t.reset(-3,{mode:'chapter',chapter,seed:chapter+1});assert(t.gates.every(g=>!['split','ring'].includes(g.kind)));for(let i=0;i<1200&&t.alive;i++){t.step(1/120);assert(t.gates.every(g=>g.gap>=t.rules.gapMin));}const finishGate=new FlightModel();finishGate.reset(-3,{mode:'chapter',chapter,pattern:['standard']});finishGate.passedGates=finishGate.rules.gateCount-1;finishGate.gates[0].x=finishGate.x-.9;finishGate.y=finishGate.gates[0].center;assert(finishGate.step(1/120).events.some(e=>e.type==='complete'));}
let p=new FlightModel();p.reset(-3,{pattern:['standard']});p.gates[0].x=p.x-.9;p.gates[0].baseCenter=0;p.gates[0].center=0;let pr=p.step(1/120);assert(pr.events.some(e=>e.type==='perfect'));assert.equal(p.score,2);assert.equal(p.combo,1);
p=new FlightModel();p.reset(-3,{pattern:['standard']});p.gates.slice(0,3).forEach((g,i)=>{g.x=p.x-.9-i;g.baseCenter=0;g.center=0;});p.step(1/120);assert(p.combo>=3);assert(p.multiplier>=2);
p=new FlightModel();p.reset(-3,{pattern:['standard']});p.gates.slice(0,5).forEach((g,i)=>{g.x=p.x-.9-i;g.baseCenter=0;g.center=0;});const focusEvents=p.step(1/120).events;assert.equal(p.shield,1);assert(focusEvents.some(e=>e.type==='shield-ready'));
let c=new FlightModel();c.reset(-3,{pattern:['standard']});c.gates[0].x=c.x;c.gates[0].items[0].x=c.x;c.gates[0].items[0].y=0;const first=c.step(1/120);const count=c.collected.seed;c.step(1/120);assert.equal(c.collected.seed,count);assert(first.events.some(e=>e.type==='collect'));
let sh=new FlightModel();sh.reset(-3,{pattern:['standard']});sh.shield=1;sh.y=3;sh.vy=0;sh.gates[0].x=sh.x;assert(!sh.step(1/120).hit);assert.equal(sh.shield,0);sh.invulnerable=0;sh.y=3;sh.vy=0;sh.gates[0].x=sh.x;assert(sh.step(1/120).hit);
let chapter=new FlightModel();chapter.reset(-3,{mode:'chapter',chapter:0,pattern:['standard']});chapter.time=44.999;const complete=chapter.step(.01);assert.equal(chapter.completed,true);assert.equal(chapter.alive,false);assert(complete.events.some(e=>e.type==='complete'));
for(const hz of [30,60,120]){const x=new FlightModel();x.reset(-3,{seed:77,pattern:['standard']});for(let i=0;i<hz*2&&x.alive;i++)for(let j=0;j<120/hz;j++)x.step(1/120);assert(Number.isFinite(x.y)&&Number.isFinite(x.score));}
console.log('PASS: impulse, gravity, ceiling/floor, obstacle collision, clear gaps, score once, obstacle recycling, 30/60/120 Hz, 240-second random course, restart.');
