import {World,TYPES,MODES,BOUNDS} from './physics.js';

const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const W=500,H=600,N=18,TAU=Math.PI*2,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const queueCanvasIds=['next-fruit','next-fruit-2','next-fruit-3'];
let score=0,best=0,runBest=0,energy=100,aim=250,cooldown=0,paused=false,ended=false,muted=true,audio,loaded=false,hasWon=false,toastUntil=0,heldTilt=0,combo=0,lastMerge=-Infinity;
let effects=[],ripples=[],sprites=[],last=0,accumulator=0,uiClock=0,missionTimer=0;
let seed=0,rng=()=>Math.random(),fruitQueue=[0,0,0],lastPicked=-1,pickStreak=0;
let missionOffers=[],mission=null,abilities={charge:0,gravityUntil:0,freezeUntil:0},freezeDropUsed=false,rescueAvailable=true,dangerLevel=0;
let runStats={drops:0,merges:0,maxFruitType:0,maxCombo:0,cascadeCount:0,missionsCompleted:0,abilitiesUsed:0,modeUsage:{jelly:0,fluid:0,juice:0},seed:0};
const keys=new Set(),dialog=$('dialog');
try{best=Math.max(0,Number(localStorage.getItem('melon-lab-best'))||0);}catch{}
$('best').textContent=best;

function createRng(value){let state=(value>>>0)||1;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
function newSeed(){return ((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0)||1;}
function tone(frequency=420,length=.09){if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,audio.currentTime);oscillator.frequency.exponentialRampToValueAtTime(frequency*.55,audio.currentTime+length);gain.gain.setValueAtTime(.11,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);oscillator.connect(gain).connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+length);}catch{}}
function vibrate(pattern){if(reduced||muted||!navigator.vibrate)return;try{navigator.vibrate(pattern);}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');toastUntil=performance.now()+1800;}
function modeModifier(){return MODES[world.mode]||MODES.fluid;}
function activeAbility(){return abilities.gravityUntil||abilities.freezeUntil;}
function maxDanger(){return Math.max(0,...world.bodies.map(b=>b.danger));}
function syncUI(){
  const danger=maxDanger();dangerLevel=danger>=2?2:danger>=1?1:0;
  $('score').textContent=score;$('best').textContent=best;$('energy').value=energy;$('energy-value').textContent=Math.floor(energy);
  $('stir').disabled=energy<30||ended||paused;
  const abilityActive=Boolean(activeAbility());
  $('lab-charge').textContent=`${abilities.charge} / 3`;
  $('gravity-button').disabled=abilities.charge<3||abilityActive||ended||paused;
  $('freeze-button').disabled=abilities.charge<3||abilityActive||ended||paused;
  $('gravity-status').textContent=abilities.gravityUntil?`${Math.ceil(Math.max(0,abilities.gravityUntil-world.time))} 秒`:(abilityActive?'不可用':abilities.charge>=3?'可使用':'充能中');
  $('freeze-status').textContent=abilities.freezeUntil?(freezeDropUsed?'已投放':`${Math.ceil(Math.max(0,abilities.freezeUntil-world.time))} 秒`):(abilityActive?'不可用':abilities.charge>=3?'可使用':'充能中');
  $('vent').hidden=!(dangerLevel>0&&rescueAvailable&&!ended);$('vent').disabled=energy<40||paused;
  $('game').dataset.fruits=world.bodies.length;$('game').dataset.phase=ended?'ended':paused?'paused':'playing';$('game').dataset.danger=dangerLevel;
  renderMission();
}
function showDialog(title,body,button,action,closable=true){paused=true;keys.clear();heldTilt=0;$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;$('dialog-action').textContent=button;$('dialog-action').onclick=()=>{dialog.close();action();};$('dialog-close').hidden=!closable;if(!dialog.open)dialog.showModal();syncUI();}
function resume(){paused=false;$('pause').querySelector('span').textContent='暂停';$('pause').setAttribute('aria-label','暂停');syncUI();}
function saveBest(){if(score<=best)return;best=score;try{localStorage.setItem('melon-lab-best',String(best));}catch{}}
function highestName(){return TYPES[Math.min(8,runStats.maxFruitType)]?.name||'葡萄';}
function finish(){if(ended)return;ended=true;const gap=score>runBest?'刷新了最佳分数！':`距离最佳分数还差 ${runBest-score} 分`;showDialog('果池满了，休息一下',`<div class="result-grid"><span>本局分数<strong>${score}</strong></span><span>最高水果<strong>${highestName()}</strong></span><span>最大连融<strong>${runStats.maxCombo}</strong></span><span>完成委托<strong>${runStats.missionsCompleted}</strong></span></div><p>${gap}</p>`,'再来一池',reset,false);}

const world=new World(event=>{
  const mode=modeModifier(),within=world.time-lastMerge<=mode.comboWindow;combo=within?combo+1:1;lastMerge=world.time;
  const base=event.points,quality=Math.floor(base*Math.min(combo,4)),perfect=event.perfect?Math.ceil(base*.25):0,cascade=event.cascade?Math.ceil(base*.5):0;
  const delta=Math.max(1,Math.floor((quality+perfect+cascade)*mode.scoreMultiplier));score+=delta;energy=Math.min(100,energy+8);runStats.merges++;runStats.maxCombo=Math.max(runStats.maxCombo,combo);runStats.maxFruitType=Math.max(runStats.maxFruitType,event.type);if(event.cascade)runStats.cascadeCount++;saveBest();
  effects.push({x:event.x,y:event.y,text:`+${delta}${combo>1?' · '+combo+' 连融':''}${event.cascade?' · 级联':''}`,life:event.cascade?1.5:1.2});ripples.push({x:event.x,y:event.y,life:.6,r:TYPES[event.type].r,color:TYPES[event.type].color});tone(330+event.type*80+(event.cascade?100:0),event.cascade?.22:.16);vibrate(event.cascade?[18,25,18]:event.perfect?12:6);
  const step=document.querySelector(`[data-fruit="${event.type}"]`);if(step){step.classList.remove('new');void step.offsetWidth;step.classList.add('new');}
  updateMission({type:'merge',event,mode:world.mode,combo});
  if(event.type===8&&!hasWon){hasWon=true;queueMicrotask(()=>{if(ended)return;showDialog('一颗会流动的大西瓜！',`<p>你把柔软的水果，融成了夏天。</p><strong>${score}</strong><p>最大连融 ${runStats.maxCombo} · 继续合成两颗西瓜，可以释放大片空间。</p>`,'继续实验',resume);});}
  syncUI();
});

function pickFruit(){
  const roll=rng();let type=roll<.49?0:roll<.79?1:roll<.95?2:3;
  if(type===lastPicked)pickStreak++;else pickStreak=1;
  if(pickStreak>=4){type=(type+1+Math.floor(rng()*3))%4;pickStreak=1;}
  lastPicked=type;return type;
}
function makeMissionPool(){
  const target=1+Math.floor(rng()*2),mode=['jelly','fluid','juice'][Math.floor(rng()*3)];
  const sourceName=TYPES[target].name,resultName=TYPES[target+1].name;
  return [
    {id:`fruit-${seed}-${target}`,kind:'合成目标',text:`用两个${sourceName}合成一个${resultName}${resultName==='柑橘'?'（橙色水果）':''}`,target:1,progress:0,targetType:target+1,check:e=>e.type==='merge'&&e.event?.type===target+1},
    {id:`mode-${seed}-${mode}`,kind:'物理实验',text:`在${mode==='jelly'?'果冻':mode==='fluid'?'半流体':'果汁'}模式完成 3 次融合`,target:3,progress:0,mode,check:e=>e.type==='merge'&&e.mode===mode},
    {id:`combo-${seed}`,kind:'连锁实验',text:'完成 2 次连续融合',target:2,progress:0,check:e=>e.type==='merge'&&e.combo>=2},
    {id:`calm-${seed}`,kind:'稳住果池',text:'完成 10 次投放且不进入危险状态',target:10,progress:0,check:e=>e.type==='drop'&&!e.danger}
  ];
}
function createMissionOffers(){const pool=makeMissionPool(),first=Math.floor(rng()*pool.length),second=(first+1+Math.floor(rng()*(pool.length-1)))%pool.length;return [pool[first],pool[second]];}
function renderMission(){
  if(!mission)return;
  $('mission-kind').textContent=mission.done?'已完成':'进行中';$('mission-text').textContent=mission.text;$('mission-progress').max=mission.target;$('mission-progress').value=Math.min(mission.progress,mission.target);$('mission-value').textContent=`${Math.min(mission.progress,mission.target)} / ${mission.target}`;
  const offers=$('mission-offers');offers.replaceChildren();for(const [index,offer] of missionOffers.entries()){const button=document.createElement('button');button.type='button';button.dataset.index=index;button.disabled=Boolean(mission.progress||mission.done);button.className=offer===mission?'selected':'';button.innerHTML=`<span>${offer.kind}</span><small>${offer.text}</small>`;offers.append(button);}
}
function selectMission(index){if(!missionOffers[index]||mission?.progress||mission?.done)return;mission=missionOffers[index];renderMission();toast(`已选择：${mission.text}`);tone(270,.06);}
function completeMission(){if(!mission||mission.done)return;mission.done=true;score+=100;energy=Math.min(100,energy+15);abilities.charge=Math.min(3,abilities.charge+1);runStats.missionsCompleted++;saveBest();toast('委托完成！实验瓶充能 +1');tone(620,.16);vibrate([12,35,12]);syncUI();if(missionTimer)clearTimeout(missionTimer);missionTimer=window.setTimeout(()=>{if(ended)return;missionOffers=createMissionOffers();mission=missionOffers[0];renderMission();toast('新的实验委托已到达。');},1400);}
function updateMission(event){if(!mission||mission.done||!mission.check(event))return;mission.progress++;if(mission.progress>=mission.target)completeMission();else syncUI();}

function reset(){
  world.reset();world.setMode(document.querySelector('[data-mode][aria-pressed=true]').dataset.mode);runBest=best;score=0;energy=100;cooldown=0;aim=250;ended=false;hasWon=false;paused=false;effects=[];ripples=[];combo=0;lastMerge=-Infinity;seed=newSeed();rng=createRng(seed);lastPicked=-1;pickStreak=0;fruitQueue=[pickFruit(),pickFruit(),pickFruit()];abilities={charge:0,gravityUntil:0,freezeUntil:0};freezeDropUsed=false;rescueAvailable=true;dangerLevel=0;runStats={drops:0,merges:0,maxFruitType:0,maxCombo:0,cascadeCount:0,missionsCompleted:0,abilitiesUsed:0,modeUsage:{jelly:0,fluid:0,juice:0},seed};missionOffers=createMissionOffers();mission=missionOffers[0];if(missionTimer)clearTimeout(missionTimer);missionTimer=0;keys.clear();heldTilt=0;if(dialog.open)dialog.close();updateNext();resume();$('aim-tip').textContent='移动瞄准 · 点击投放';}
function drop(){if(!loaded||paused||ended||world.time<cooldown)return;if(abilities.freezeUntil&&freezeDropUsed){toast('定型剂只能安排一颗新水果。');return;}const type=fruitQueue[0],r=TYPES[type].r;aim=Math.max(BOUNDS.left+r+3,Math.min(BOUNDS.right-r-3,aim));world.add(type,aim,65,world.tilt*20,70);if(abilities.freezeUntil)freezeDropUsed=true;fruitQueue.shift();fruitQueue.push(pickFruit());runStats.drops++;runStats.modeUsage[world.mode]++;updateNext();cooldown=world.time+.42;tone(240,.06);updateMission({type:'drop',danger:maxDanger()});syncUI();}
function stir(){if(!loaded||paused||ended||energy<30)return;energy-=30;world.stir();ripples.push({x:250,y:430,life:1,r:130,color:'#9b85db'});tone(150,.3);toast('轻轻搅一搅，好事会相遇。');syncUI();}
function useGravity(){if(!loaded||paused||ended||abilities.charge<3||activeAbility())return;abilities.charge-=3;abilities.gravityUntil=world.time+8;world.gravityScale=.5;runStats.abilitiesUsed++;toast('减重剂生效，果池变轻了。');tone(520,.22);vibrate([14,40,14]);syncUI();}
function useFreeze(){if(!loaded||paused||ended||abilities.charge<3||activeAbility())return;abilities.charge-=3;abilities.freezeUntil=world.time+4;freezeDropUsed=false;world.freezeExisting(abilities.freezeUntil);runStats.abilitiesUsed++;toast('定型剂生效，安排好这一颗水果。');tone(460,.22);vibrate([14,40,14]);syncUI();}
function vent(){if(!loaded||paused||ended||!rescueAvailable||energy<40||dangerLevel===0)return;energy-=40;rescueAvailable=false;world.releaseVent();toast('紧急排气！果池重新落稳了。');tone(190,.28);vibrate([20,35,20]);syncUI();}
function updateNext(){if(!loaded)return;fruitQueue.forEach((type,index)=>{const target=$(queueCanvasIds[index]),c=target.getContext('2d');c.clearRect(0,0,144,144);c.globalAlpha=index===0?.98:.72;c.drawImage(sprites[type],8,8,128,128);c.globalAlpha=1;target.setAttribute('aria-label',`${index===0?'当前':index===1?'下一颗':'之后'}水果：${TYPES[type].name}`);});}

function glassPath(){ctx.beginPath();ctx.moveTo(31,49);ctx.lineTo(19,49);ctx.quadraticCurveTo(14,49,14,59);ctx.lineTo(14,548);ctx.quadraticCurveTo(14,590,55,590);ctx.lineTo(445,590);ctx.quadraticCurveTo(486,590,486,548);ctx.lineTo(486,59);ctx.quadraticCurveTo(486,49,469,49);}
function drawGlass(front=false){
  if(!front){const fill=ctx.createLinearGradient(0,70,0,588);fill.addColorStop(0,'#ffffff08');fill.addColorStop(.85,'#d5c9ff09');fill.addColorStop(1,'#b2a0db30');ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(20,50,460,534,[4,4,34,34]);ctx.fill();return;}
  ctx.save();glassPath();ctx.lineJoin='round';ctx.lineCap='round';ctx.shadowBlur=9;ctx.shadowColor='#80719b2d';ctx.shadowOffsetY=6;ctx.strokeStyle='#b1a6d6';ctx.lineWidth=10;ctx.stroke();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle='#ece8ff';ctx.lineWidth=6.5;ctx.stroke();ctx.strokeStyle='#ffffffc9';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  ctx.save();ctx.font='9px "Avenir Next",sans-serif';ctx.textAlign='left';ctx.fillStyle='#a297b8';ctx.lineWidth=1;ctx.strokeStyle='#b9abd180';for(let y=170;y<560;y+=50){ctx.beginPath();ctx.moveTo(29,y);ctx.lineTo(35,y);ctx.stroke();ctx.fillText(String(600-y),38,y+3);}ctx.restore();
}
function pathBody(body){const p=body.p;ctx.beginPath();ctx.moveTo((p[N-1].x+p[0].x)/2,(p[N-1].y+p[0].y)/2);for(let i=0;i<N;i++){const q=p[(i+1)%N];ctx.quadraticCurveTo(p[i].x,p[i].y,(p[i].x+q.x)/2,(p[i].y+q.y)/2);}ctx.closePath();}
function triangle(image,source,dest){const [s0,s1,s2]=source,[d0,d1,d2]=dest,sx1=s1.x-s0.x,sy1=s1.y-s0.y,sx2=s2.x-s0.x,sy2=s2.y-s0.y,det=sx1*sy2-sx2*sy1;if(Math.abs(det)<.001)return;const dx1=d1.x-d0.x,dy1=d1.y-d0.y,dx2=d2.x-d0.x,dy2=d2.y-d0.y,a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,c=(dx2*sx1-dx1*sx2)/det,d=(dy2*sx1-dy1*sx2)/det;ctx.save();ctx.beginPath();for(let i=0;i<3;i++){const p=dest[i],x=p.x+(p.x-(d0.x+d1.x+d2.x)/3)*.012,y=p.y+(p.y-(d0.y+d1.y+d2.y)/3)*.012;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.clip();ctx.transform(a,b,c,d,d0.x-a*s0.x-c*s0.y,d0.y-b*s0.x-d*s0.y);ctx.drawImage(image,0,0);ctx.restore();}
const sourceRim=Array.from({length:N},(_,i)=>({x:128+Math.cos(TAU*i/N)*128,y:128+Math.sin(TAU*i/N)*128}));
function drawBody(body){ctx.save();pathBody(body);ctx.shadowColor=TYPES[body.type].color+'40';ctx.shadowBlur=9;ctx.shadowOffsetY=3;ctx.fillStyle=TYPES[body.type].color+'42';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.clip();for(let i=0;i<N;i++)triangle(sprites[body.type],[{x:128,y:128},sourceRim[i],sourceRim[(i+1)%N]],[{x:body.x,y:body.y},body.p[i],body.p[(i+1)%N]]);ctx.restore();}
function render(){
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);drawGlass();const danger=maxDanger();ctx.save();ctx.setLineDash([8,8]);ctx.lineCap='round';ctx.strokeStyle=danger>=2?'#d94e6c':danger>=1?'#e77a8d':'#ff8b98';ctx.lineWidth=danger>=1?2.5:1.8;ctx.beginPath();ctx.moveTo(26,BOUNDS.line);ctx.lineTo(474,BOUNDS.line);ctx.stroke();ctx.restore();
  if(loaded){for(const body of world.bodies)drawBody(body);if(!paused&&!ended){const r=TYPES[fruitQueue[0]].r,x=Math.max(BOUNDS.left+r+3,Math.min(BOUNDS.right-r-3,aim));ctx.save();ctx.setLineDash([4,8]);ctx.strokeStyle='#a99ac780';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,65+r+10);ctx.lineTo(x,570);ctx.stroke();ctx.globalAlpha=world.time<cooldown?.3:.85;ctx.drawImage(sprites[fruitQueue[0]],x-r,65-r,r*2,r*2);ctx.restore();}}
  drawGlass(true);for(const e of ripples){ctx.save();ctx.strokeStyle=e.color;ctx.globalAlpha=e.life*.3;ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(e.x,e.y,e.r*(2-e.life),e.r*(2-e.life)*.65,0,0,TAU);ctx.stroke();ctx.restore();}for(const e of effects){ctx.save();ctx.globalAlpha=Math.min(1,e.life*2);ctx.font='600 21px "Avenir Next","PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillStyle='#7563af';ctx.strokeStyle='#f7f3ff';ctx.lineWidth=4;ctx.strokeText(e.text,e.x,e.y);ctx.fillText(e.text,e.x,e.y);ctx.restore();}if(danger>0){ctx.save();ctx.font='600 13px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillStyle=danger>=2?'#c94f69':'#d95970';ctx.fillText(`注意高度 · ${Math.max(1,Math.ceil(3-danger))} 秒`,250,104);ctx.restore();}
}
function frame(now){const dt=Math.min((now-last)/1000||0,.065);last=now;if(loaded&&!paused&&!ended&&!document.hidden){accumulator+=dt;world.tilt=heldTilt||(keys.has('a')?-1:0)+(keys.has('d')?1:0);if(keys.has('arrowleft'))aim-=250*dt;if(keys.has('arrowright'))aim+=250*dt;aim=Math.max(45,Math.min(455,aim));while(accumulator>=1/120){world.step(1/120);accumulator-=1/120;}if(abilities.gravityUntil&&world.time>=abilities.gravityUntil){abilities.gravityUntil=0;world.gravityScale=1;toast('减重剂结束，重力恢复。');}if(abilities.freezeUntil&&world.time>=abilities.freezeUntil){abilities.freezeUntil=0;freezeDropUsed=false;toast('定型剂结束，水果重新流动。');}energy=Math.min(100,energy+dt*2.3);for(const e of effects){e.life-=dt;e.y-=dt*27;}effects=effects.filter(e=>e.life>0);for(const e of ripples)e.life-=dt;ripples=ripples.filter(e=>e.life>0);if(maxDanger()>=3)finish();}else accumulator=0;uiClock+=dt;if(uiClock>.1){uiClock=0;syncUI();}if(now>toastUntil)$('toast').classList.remove('visible');render();requestAnimationFrame(frame);}
function pointerAim(event){const rect=canvas.getBoundingClientRect(),contentWidth=Math.min(rect.width,rect.height*W/H),left=rect.left+(rect.width-contentWidth)/2;aim=(event.clientX-left)*W/contentWidth;}
let pointer=null;canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(pointer!==null)return;pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);canvas.classList.add('pointer-focused');canvas.focus({preventScroll:true});pointerAim(e);});canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||pointer===e.pointerId)pointerAim(e);});canvas.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;pointerAim(e);pointer=null;drop();});canvas.addEventListener('pointercancel',()=>pointer=null);
for(const[id,direction]of[['tilt-left',-1],['tilt-right',1]]){const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);heldTilt=direction;});for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>heldTilt=0);}
document.addEventListener('keydown',e=>{if(dialog.open)return;canvas.classList.remove('pointer-focused');const key=e.key.toLowerCase();if(['arrowleft','arrowright','a','d'].includes(key)){e.preventDefault();keys.add(key);}if((key===' '||key==='enter')&&!e.repeat&&!['BUTTON','A'].includes(document.activeElement.tagName)){e.preventDefault();key===' '?stir():drop();}if(key==='v'&&!e.repeat)vent();if(key==='p'&&!e.repeat)$('pause').click();});document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();heldTilt=0;pointer=null;});document.addEventListener('visibilitychange',()=>{keys.clear();heldTilt=0;last=performance.now();});
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{world.setMode(button.dataset.mode);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('mode-desc').textContent=MODES[world.mode].label;tone(250,.05);syncUI();}));
$('mission-offers').addEventListener('click',e=>{const button=e.target.closest('button[data-index]');if(button)selectMission(Number(button.dataset.index));});$('stir').addEventListener('click',stir);$('gravity-button').addEventListener('click',useGravity);$('freeze-button').addEventListener('click',useFreeze);$('vent').addEventListener('click',vent);
$('sound').addEventListener('click',()=>{muted=!muted;$('sound').setAttribute('aria-pressed',String(!muted));$('sound').querySelector('span').textContent=muted?'静音':'声音';tone();});$('pause').addEventListener('click',()=>{if(ended)return;showDialog('让果冻歇一会儿','水果和时间都停在这里。','继续游戏',resume);});$('restart').addEventListener('click',()=>{if(score===0){reset();return;}showDialog('开始一池新的水果？','本局分数将清零，最佳分数会保留。','重新开始',reset);});$('help').addEventListener('click',()=>showDialog('一点物理，一点好运','<p>移动鼠标瞄准，点击投放。手机上拖动瞄准，松手投放。</p><p>同类水果碰到一起就会融合。队列会显示当前和后面两颗水果。</p><p>切换「果冻 / 半流体 / 果汁」，感受不同弹性与策略优势。按 A / D 倾斜，按空格搅动。</p><p>完成实验委托可获得实验瓶充能。充满 3 格后可使用减重剂或定型剂。</p><p>水果稳定越过虚线会进入危险状态。按 V 或点击紧急排气，每局可以救场一次。</p>','开始实验',resume));$('dialog-close').addEventListener('click',()=>{dialog.close();resume();});dialog.addEventListener('cancel',e=>{if(ended){e.preventDefault();return;}resume();});
function resize(){const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);}resize();window.addEventListener('resize',resize);
const atlas=new Image();atlas.onload=()=>{const cell=atlas.width/3;for(let i=0;i<9;i++){const sprite=document.createElement('canvas');sprite.width=256;sprite.height=256;sprite.getContext('2d').drawImage(atlas,i%3*cell,Math.floor(i/3)*cell,cell,cell,0,0,256,256);sprites.push(sprite);const step=document.createElement('span');step.className='fruit-step';step.dataset.fruit=i;step.title=TYPES[i].name;const preview=document.createElement('canvas');preview.width=144;preview.height=144;preview.setAttribute('role','img');preview.setAttribute('aria-label',TYPES[i].name);preview.getContext('2d').drawImage(sprite,6,6,132,132);step.append(preview);if(i<8)step.insertAdjacentHTML('beforeend','<svg aria-hidden="true"><use href="#i-chevron"/></svg>');$('fruit-route').append(step);}loaded=true;$('loading').hidden=true;reset();};atlas.onerror=()=>{$('loading').textContent='水果素材加载失败，请刷新重试。';};atlas.src='fruits.png';
requestAnimationFrame(frame);
