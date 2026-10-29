import * as THREE from '../vendor/three.module.js';
import { createWorld, createZombie, createWeapon } from './world.js';
import { createUI } from './ui.js';

// Dead House: all simulation time is in seconds and camera input is per mouse unit,
// independent of frame rate. All geometry and audio are local to the project.
const host = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b21);
scene.fog = new THREE.Fog(0x101b21, 28, 60);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
camera.rotation.order = 'YXZ';
scene.add(camera);
const world = createWorld(THREE, scene);
const viewWeapon = createWeapon(THREE, camera);
const walls = world.walls || [];
const spawnPoints = world.spawnPoints || [{x:9,z:7},{x:9,z:-7},{x:-9,z:7}];
const shopPos = world.shopPosition || world.shop || {x:10.5,z:6.5};
const startPos = world.playerStart || {x:-6,z:-4};
const keys = Object.create(null);
const barricade = {x:-6,z:0,hp:3,max:3,group:new THREE.Group()};
scene.add(barricade.group);
const boards=[];
for(let i=0;i<3;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.35,.20,.18),new THREE.MeshStandardMaterial({color:0x72543c,roughness:1}));mesh.position.set(-6,.48+i*.4,0);mesh.rotation.z=(i-1)*.035;barricade.group.add(mesh);boards.push(mesh);}
function updateBarricade(){boards.forEach((board,i)=>board.visible=i<barricade.hp);}
function disposeEnemy(e){scene.remove(e.group);e.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});}
const clamp = THREE.MathUtils.clamp;
const raycaster = new THREE.Raycaster();
const dir = new THREE.Vector3();
const ITEM_LIST = [
  {id:'ammo',name:'Ammunition',description:'+36 pistol rounds or +12 shells for equipped weapon',cost:120},
  {id:'shotgun',name:'Pump shotgun',description:'Close-range spread weapon; switch with Q',cost:550},
  {id:'medkit',name:'First aid',description:'Restore 45 health',cost:200},
  {id:'damage',name:'Hardened rounds',description:'+20% damage, up to 3 upgrades',cost:350},
  {id:'capacity',name:'Extended magazine',description:'+4 pistol rounds / +2 shells per magazine, up to 2 upgrades',cost:300},
  {id:'speed',name:'Lightweight boots',description:'+12% walking speed, up to 2 upgrades',cost:300}
];
const state = {mode:'menu', wave:0, kills:0, money:0, health:100, ammo:12, reserve:72, weapon:'Service pistol', stamina:100,
  player:{x:-6,z:-5,yaw:0,pitch:0}, weaponId:'pistol', inventory:{pistol:{ammo:12,reserve:72},shotgun:null}, enemies:[], sensitivity:0.1, damageLevel:0, capacityLevel:0, speedLevel:0,
  phase:'prep', phaseTime:0, remaining:0, spawnTimer:0, reload:0, fireCooldown:0, hitFlash:0, totalTime:0};
let waveClock = 0, frame = 0, last = 0, footstep = 0, recoil = 0, muzzle = 0, lastMessage = '';
let audioCtx;
function sound(freq=220, duration=.08, type='sine', volume=.05, endFreq=freq) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),audioCtx.currentTime+duration);
    g.gain.setValueAtTime(volume,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+duration);
  } catch (_) { /* Audio is optional. */ }
}
function magSize(){ return state.weaponId==='shotgun'?6+2*state.capacityLevel:12+4*state.capacityLevel; }
function saveWeapon(){if(state.inventory[state.weaponId]){state.inventory[state.weaponId].ammo=state.ammo;state.inventory[state.weaponId].reserve=state.reserve;}}
function switchWeapon(id){if(!state.inventory[id]||state.weaponId===id)return;saveWeapon();state.weaponId=id;state.ammo=state.inventory[id].ammo;state.reserve=state.inventory[id].reserve;state.weapon=id==='shotgun'?'Pump shotgun':'Service pistol';state.reload=0;state.fireCooldown=.25;if(viewWeapon?.group)viewWeapon.group.scale.z=id==='shotgun'?1.05:.72;updateHUD();}
function notify(s){ if(s!==lastMessage){ ui.announce(s); lastMessage=s; setTimeout(()=>{if(lastMessage===s)lastMessage='';},1400); } }
function clearKeys(){ for (const k of Object.keys(keys)) delete keys[k]; }
function requestLock(){ try { const p=renderer.domElement.requestPointerLock(); if(p && p.catch)p.catch(()=>{}); } catch (_) {} }
function releaseLock(){ if(document.pointerLockElement===renderer.domElement) document.exitPointerLock(); }
function start(){
  for(const enemy of state.enemies) disposeEnemy(enemy); barricade.hp=3; updateBarricade();
  Object.assign(state,{mode:'playing',wave:0,kills:0,money:0,health:100,ammo:12,reserve:72,weapon:'Service pistol',stamina:100,
    weaponId:'pistol',inventory:{pistol:{ammo:12,reserve:72},shotgun:null},phase:'prep',phaseTime:8,remaining:0,spawnTimer:0,reload:0,fireCooldown:0,hitFlash:0,totalTime:0,damageLevel:0,capacityLevel:0,speedLevel:0});
  Object.assign(state.player,{x:startPos.x,z:startPos.z,yaw:0,pitch:0}); state.enemies=[]; clearKeys(); last=0; recoil=0; muzzle=0;
  if(viewWeapon?.group)viewWeapon.group.scale.z=.72;ui.hideShop(); ui.showPlaying(); ui.announce('PREPARE YOUR DEFENSE', 'The first wave is coming'); sound(200,.14,'sine',.03,340); requestLock(); updateHUD();
}
function pause(){ if(state.mode!=='playing')return; state.mode='paused'; clearKeys(); releaseLock(); ui.showPause(); }
function resume(){ if(state.mode!=='paused') return; state.mode='playing'; clearKeys(); last=0; ui.showPlaying(); requestLock(); }
function gameover(){ if(state.mode==='dead')return; state.mode='dead'; clearKeys(); releaseLock(); ui.showGameOver({wave:state.wave,kills:state.kills}); sound(100,.45,'sawtooth',.035,45); }
function shopItems(){return ITEM_LIST.map(item=>({...item,owned:(item.id==='shotgun'&&!!state.inventory.shotgun)||(item.id==='damage'&&state.damageLevel>=3)||(item.id==='capacity'&&state.capacityLevel>=2)||(item.id==='speed'&&state.speedLevel>=2)}));}
function openShop(){ if(state.mode!=='playing')return; state.mode='shop'; clearKeys(); releaseLock(); ui.showShop(state.money,shopItems()); }
function closeShop(){ if(state.mode!=='shop') return; state.mode='playing'; ui.hideShop(); ui.showPlaying(); last=0; requestLock(); }
function purchase(id){
  if(state.mode!=='shop')return false;
  const item=ITEM_LIST.find(i=>i.id===id); if(!item)return false;
  if(state.money<item.cost){ notify('Not enough cash'); sound(95,.1,'square',.015); return false; }
  if((id==='shotgun'&&state.inventory.shotgun)||(id==='medkit'&&state.health>=100)||(id==='damage'&&state.damageLevel>=3)||(id==='capacity'&&state.capacityLevel>=2)||(id==='speed'&&state.speedLevel>=2)) { notify('Already at maximum'); return false; }
  state.money-=item.cost;
  if(id==='ammo')state.reserve+=state.weaponId==='shotgun'?12:36;
  if(id==='shotgun'){state.inventory.shotgun={ammo:6,reserve:24};switchWeapon('shotgun');}
  if(id==='medkit')state.health=Math.min(100,state.health+45);
  if(id==='damage')state.damageLevel++;
  if(id==='capacity')state.capacityLevel++;
  if(id==='speed')state.speedLevel++;
  ui.showShop(state.money,shopItems()); notify('Purchased: '+item.name); sound(380,.12,'sine',.025,550); updateHUD(); return true;
}
const ui = createUI({onStart:start,onRestart:start,onResume:resume,onSensitivity:v=>{state.sensitivity=Number(v); try{localStorage.setItem('deadHouseSensitivity',String(v));}catch(_){}},onBuy:purchase,onCloseShop:closeShop});
try { const saved=Number(localStorage.getItem('deadHouseSensitivity')); if(saved>=.03&&saved<=.3) state.sensitivity=saved; } catch (_) {}
ui.setSensitivity(state.sensitivity); ui.showMenu();
function updateHUD(){ ui.updateHUD({health:Math.ceil(state.health),money:state.money,wave:state.wave,ammo:state.ammo,reserve:state.reserve,weapon:state.reload>0?'Reloading…':state.weapon,kills:state.kills,stamina:state.stamina,reloading:state.reload>0}); }

// Axis-aligned collision; resolve independently on each axis for smooth wall sliding.
function blocked(x,z,r=.3,includeBarricade=true){ return walls.some(w=>x+r>w.minX && x-r<w.maxX && z+r>w.minZ && z-r<w.maxZ) || (includeBarricade && barricade.hp>0 && x+r>-7.15 && x-r<-4.85 && z+r>-.12 && z-r<.12); }
function moveCircle(p,dx,dz,r=.3){
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.16));
  for(let i=0;i<steps;i++) { const nx=p.x+dx/steps, nz=p.z+dz/steps; if(!blocked(nx,p.z,r))p.x=nx; if(!blocked(p.x,nz,r))p.z=nz; }
}
// Small static occupancy grid and A* route around the same collision geometry.
const gridSize=.5, gridMin=-12, gridMax=12, gridN=Math.round((gridMax-gridMin)/gridSize)+1;
const grid=new Uint8Array(gridN*gridN);
const toGrid=(x)=>clamp(Math.round((x-gridMin)/gridSize),0,gridN-1);
const toWorld=(x)=>gridMin+x*gridSize;
for(let z=0;z<gridN;z++) for(let x=0;x<gridN;x++) grid[z*gridN+x]=blocked(toWorld(x),toWorld(z),.42,false)?1:0;
function nearestOpen(x,z){
  x=toGrid(x);z=toGrid(z); if(!grid[z*gridN+x])return [x,z];
  for(let r=1;r<8;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const a=x+dx,b=z+dz;if(a>=0&&a<gridN&&b>=0&&b<gridN&&!grid[b*gridN+a])return [a,b];} return null;
}
function findPath(sx,sz,tx,tz){
 const s=nearestOpen(sx,sz),t=nearestOpen(tx,tz); if(!s||!t)return [];
 const start=s[1]*gridN+s[0], goal=t[1]*gridN+t[0];
 const open=[start], scores=new Float32Array(gridN*gridN).fill(Infinity), parent=new Int32Array(gridN*gridN).fill(-1), closed=new Uint8Array(gridN*gridN);
 scores[start]=0;
 const heuristic=i=>Math.abs(i%gridN-t[0])+Math.abs(Math.floor(i/gridN)-t[1]);
 while(open.length){ let best=0;for(let k=1;k<open.length;k++)if(scores[open[k]]+heuristic(open[k])<scores[open[best]]+heuristic(open[best]))best=k;
  const cur=open.splice(best,1)[0]; if(cur===goal){const path=[];let i=cur;while(i!==start&&i!==-1){path.push({x:toWorld(i%gridN),z:toWorld(Math.floor(i/gridN))});i=parent[i];}return path.reverse();}
  if(closed[cur])continue;closed[cur]=1;const x=cur%gridN,z=Math.floor(cur/gridN);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=z+dz;if(a<0||a>=gridN||b<0||b>=gridN)continue;const n=b*gridN+a;if(grid[n]||closed[n])continue;const score=scores[cur]+1;if(score<scores[n]){scores[n]=score;parent[n]=cur;open.push(n);}}
 }return [];
}
function spawnEnemy(type){
  if(state.enemies.length>=22)return null;
  const candidates=spawnPoints.filter(p=>Math.hypot(p.x-state.player.x,p.z-state.player.z)>5 && !blocked(p.x,p.z,.35));
  if(!candidates.length) return null;
  const pos=candidates[Math.floor(Math.random()*candidates.length)], kind=type || (state.wave>=3&&Math.random()<Math.min(.35,.1+state.wave*.025)?'runner':'walker');
  const visual=createZombie(THREE,scene,kind); const group=visual.group || visual; group.position.set(pos.x,0,pos.z);
  const e={group,visual,type:kind,x:pos.x,z:pos.z,hp:kind==='runner'?55:80,maxHp:kind==='runner'?55:80,speed:kind==='runner'?1.52:1.0,attack:0,windup:0,path:[],pathTimer:Math.random(),anim:Math.random()*6,hit:0,dead:false};
  group.traverse(o=>{o.userData.enemy=e;}); state.enemies.push(e);return e;
}
function startWave(){ state.wave++; state.phase='wave'; state.remaining=5+state.wave*2; state.spawnTimer=.2; ui.announce('WAVE '+state.wave, 'Hold the house'); sound(135,.3,'sawtooth',.025,80); }
function endWave(){ state.phase='prep'; state.phaseTime=14; const bonus=100+state.wave*25; state.money+=bonus; ui.announce('WAVE CLEARED', '$'+bonus+' bonus • restock at the supply table'); sound(400,.16,'sine',.03,600); }
function reload(){ if(state.mode!=='playing'||state.reload>0||state.ammo>=magSize()||state.reserve<=0)return;state.reload=state.weaponId==='shotgun'?1.8:1.2;sound(230,.09,'square',.012,130); }
function wallDistance(origin,direction){ let best=Infinity; for(const w of walls){let lo=0,hi=Infinity;for(const [axis,min,max] of [['x',w.minX,w.maxX],['y',w.minY??0,w.maxY??3.6],['z',w.minZ,w.maxZ]]){const d=direction[axis],o=origin[axis];if(Math.abs(d)<1e-8){if(o<min||o>max){lo=Infinity;break;}}else{let a=(min-o)/d,b=(max-o)/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}}if(hi>=lo&&lo>=0)best=Math.min(best,lo);}return best; }
function shoot(){
 if(state.mode!=='playing'||state.fireCooldown>0||state.reload>0)return;
 if(state.ammo<=0){sound(100,.06,'square',.015);reload();return;}
 state.ammo--; const shotgun=state.weaponId==='shotgun';state.fireCooldown=shotgun ? .8 : .22; recoil=1; muzzle=.065; sound(shotgun?110:170,shotgun ? .14 : .09,'sawtooth',.045,55);
 const shots=shotgun?7:1;
 for(let i=0;i<shots;i++){
  if(shotgun)dir.set((Math.random()-.5)*.065,(Math.random()-.5)*.065,-1).normalize().applyQuaternion(camera.quaternion);else camera.getWorldDirection(dir);
  raycaster.set(camera.position,dir);raycaster.far=shotgun?17:40;
  const objects=state.enemies.map(e=>e.group);const hits=raycaster.intersectObjects(objects,true);const maxWall=wallDistance(camera.position,dir);
  const hit=hits.find(h=>h.distance<maxWall);if(hit){const e=hit.object.userData.enemy;if(e&&!e.dead){const head=hit.point.y>1.58;const damage=shotgun?14:40;e.hp-=Math.round(damage*(head?1.9:1)*(1+state.damageLevel*.2));e.hit=.15;ui.hit(head);if(!shotgun||i===0)sound(head?680:410,.04,'sine',.016,300);if(e.hp<=0)killEnemy(e,head);}}
 }
 updateHUD();
}
function killEnemy(e,head){ if(e.dead)return;e.dead=true; state.kills++;state.money+=head?90:65;disposeEnemy(e);const i=state.enemies.indexOf(e);if(i>=0)state.enemies.splice(i,1); }
function look(dx,dy){ if(state.mode!=='playing')return;const sens=state.sensitivity*Math.PI/180;state.player.yaw-=dx*sens;state.player.pitch=clamp(state.player.pitch-dy*sens,-1.48,1.48); }
function update(dt){
 if(state.mode!=='playing')return; dt=clamp(dt,0,.05); state.totalTime+=dt; state.fireCooldown=Math.max(0,state.fireCooldown-dt);recoil=Math.max(0,recoil-dt*7);muzzle=Math.max(0,muzzle-dt);
 if(state.reload>0){state.reload-=dt;if(state.reload<=0){const n=Math.min(magSize()-state.ammo,state.reserve);state.ammo+=n;state.reserve-=n;state.reload=0;sound(350,.06,'square',.012);}}
 let forward=(keys.KeyW?1:0)-(keys.KeyS?1:0),side=(keys.KeyD?1:0)-(keys.KeyA?1:0); const len=Math.hypot(forward,side);if(len){forward/=len;side/=len;}
 const sprint=!!(keys.ShiftLeft||keys.ShiftRight)&&forward>0&&state.stamina>0;let speed=3.1*(1+state.speedLevel*.12)*(sprint?1.5:1);state.stamina=clamp(state.stamina+(sprint&&len?-25:18)*dt,0,100);
 const y=state.player.yaw;const dx=(-Math.sin(y)*forward+Math.cos(y)*side)*speed*dt,dz=(-Math.cos(y)*forward-Math.sin(y)*side)*speed*dt;moveCircle(state.player,dx,dz,.3);
 camera.position.set(state.player.x,1.65,state.player.z);camera.rotation.set(state.player.pitch,y,0,'YXZ');const targetFov=keys.Aim?52:70;if(Math.abs(camera.fov-targetFov)>.01){camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*12);camera.updateProjectionMatrix();}
 if(viewWeapon){if(viewWeapon.flash)viewWeapon.flash.visible=muzzle>0;const model=viewWeapon.group||viewWeapon; if(model.position){model.position.y=(model.userData.baseY??model.position.y);if(model.userData.baseY===undefined)model.userData.baseY=model.position.y;model.position.y=model.userData.baseY+Math.sin(state.totalTime*9)*Math.min(len,.04)*.35-recoil*.04;}}
 if(len){footstep-=dt;if(footstep<=0){sound(65,.045,'triangle',.008,45);footstep=sprint?.28:.4;}}
 if(state.phase==='prep'){state.phaseTime-=dt;if(state.phaseTime<=0)startWave();}
 else {state.spawnTimer-=dt;if(state.remaining>0 && state.enemies.length<22 && state.spawnTimer<=0){if(spawnEnemy()){state.remaining--;state.spawnTimer=Math.max(.55,1.5-state.wave*.05);}else state.spawnTimer=1;}
 if(state.remaining===0&&state.enemies.length===0)endWave();}
 for(const e of [...state.enemies]){
  e.attack=Math.max(0,e.attack-dt); e.hit=Math.max(0,e.hit-dt);e.pathTimer-=dt;e.anim+=dt*e.speed*5;
  const distance=Math.hypot(state.player.x-e.x,state.player.z-e.z);
  const sightDir={x:(state.player.x-e.x)/(distance||1),y:0,z:(state.player.z-e.z)/(distance||1)};
  const lineBlocked=wallDistance({x:e.x,y:1,z:e.z},sightDir)<distance-.05;
  const nearBarricade=barricade.hp>0 && Math.abs(e.x-barricade.x)<1.4 && Math.abs(e.z)<1.2 && e.path.some(p=>p.z*e.z<-.05);
  if(nearBarricade){e.windup+=dt;if(e.windup>=.8){e.windup=0;barricade.hp--;updateBarricade();sound(75,.12,'triangle',.025,42);if(!barricade.hp)notify('Barricade broken');}}
  else if(distance>1.05 || lineBlocked){if(e.pathTimer<=0){e.path=findPath(e.x,e.z,state.player.x,state.player.z);e.pathTimer=1.0+Math.random()*.5;}
   let target=e.path[0];if(target&&Math.hypot(target.x-e.x,target.z-e.z)<.2){e.path.shift();target=e.path[0];}
   if(target){const ax=target.x-e.x,az=target.z-e.z,dl=Math.hypot(ax,az);if(dl>.01)moveCircle(e,ax/dl*e.speed*dt,az/dl*e.speed*dt,.32);}
   e.windup=0;
  }else if(e.attack<=0){ e.windup+=dt; if(e.windup>=.5){state.health-=e.type==='runner'?10:14;e.windup=0;e.attack=1.25;ui.damage();sound(100,.12,'sawtooth',.02,65);if(state.health<=0){state.health=0;gameover();break;}} }
  e.group.position.set(e.x,0,e.z);e.group.rotation.y=Math.atan2(state.player.x-e.x,state.player.z-e.z);if(e.visual.update)e.visual.update(dt,e.anim,e.windup,e.hit);
 }
 const dShop=Math.hypot(state.player.x-shopPos.x,state.player.z-shopPos.z);const dBarricade=Math.hypot(state.player.x-barricade.x,state.player.z-barricade.z);ui.prompt(dShop<2.2?'E  •  SUPPLY TABLE':dBarricade<2.2?'E  •  REPAIR BARRICADE ($100)  '+barricade.hp+'/3':'');
 waveClock+=dt;if(waveClock>.1){waveClock=0;updateHUD();}
}
function onKeyDown(e){if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','KeyR','KeyE','KeyQ','Escape'].includes(e.code))e.preventDefault();if(e.repeat)return;keys[e.code]=true;
 if(e.code==='Escape'){if(state.mode==='playing')pause();else if(state.mode==='shop')closeShop();return;}
 if(state.mode==='shop'&&e.code==='KeyE'){closeShop();return;}
 if(state.mode!=='playing')return;if(e.code==='KeyR')reload();if(e.code==='KeyQ')switchWeapon(state.weaponId==='pistol'?'shotgun':'pistol');if(e.code==='KeyE'){if(Math.hypot(state.player.x-shopPos.x,state.player.z-shopPos.z)<2.2)openShop();else if(Math.hypot(state.player.x-barricade.x,state.player.z-barricade.z)<2.2){if(barricade.hp>=barricade.max)notify('Barricade is fully reinforced');else if(state.money<100)notify('Repair costs $100');else if((Math.abs(state.player.x-barricade.x)<1.5&&Math.abs(state.player.z)<.5)||state.enemies.some(e=>Math.abs(e.x-barricade.x)<1.5&&Math.abs(e.z)<.5))notify('Clear the doorway first');else{state.money-=100;barricade.hp++;updateBarricade();notify('Barricade repaired');sound(300,.1,'triangle',.02,180);}}}}
window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',e=>{delete keys[e.code];});
window.addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement)look(e.movementX,e.movementY);});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('mousedown',e=>{if(e.button===2){keys.Aim=true;return;}if(e.button!==0)return;if(state.mode==='playing'){if(document.pointerLockElement!==renderer.domElement)requestLock();else shoot();}});
window.addEventListener('mouseup',e=>{if(e.button===2)delete keys.Aim;});
window.addEventListener('blur',()=>{clearKeys();if(state.mode==='playing')pause();});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==renderer.domElement&&state.mode==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='playing')pause();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let accumulator=0;function animate(t){requestAnimationFrame(animate);const dt=last?Math.min((t-last)/1000,.25):0;last=t;accumulator=Math.min(accumulator+dt,.25);while(accumulator>=.02){update(.02);accumulator-=.02;}renderer.render(scene,camera);frame++;}requestAnimationFrame(animate);
if(new URLSearchParams(location.search).get('test')==='1') window.__game={state,world,barricade,renderer,camera,ui,start,pause,resume,gameover,openShop,closeShop,purchase,spawnEnemy,shoot,reload,switchWeapon,look,update,blocked,findPath,moveCircle,killEnemy,startWave,endWave,keys,stats:()=>({frame,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures})};
