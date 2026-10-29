// Run with: node tests/browser-qa.cjs (start a server on 127.0.0.1:8765 first).
// Requires Playwright and Chromium installed in the environment.
const {chromium}=require('playwright');
const assert=require('assert');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}), errors=[], failed=[];
 page.on('pageerror',e=>errors.push(e.message)); page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico')) failed.push(r.status()+' '+r.url());});
 await page.goto('http://127.0.0.1:8765/?test=1',{waitUntil:'networkidle'}); await page.waitForFunction(()=>!!window.__game);
 assert(await page.isVisible('#start-button')); await page.click('#start-button'); await page.waitForFunction(()=>__game.state.mode==='playing'); await page.waitForTimeout(300);
 assert(await page.evaluate(()=>!!document.pointerLockElement),'pointer lock');
 const results=await page.evaluate(()=>{
  const g=__game,s=g.state, out={};
  const y=s.player.yaw,p=s.player.pitch;g.look(1000,100);out.look={yawDegrees:(s.player.yaw-y)*180/Math.PI,pitchDegrees:(s.player.pitch-p)*180/Math.PI};
  g.look(0,1e6);out.pitchClamped=s.player.pitch===-1.48; s.player.yaw=0;s.player.pitch=0;
  out.paths=g.world.spawnPoints.map(q=>({spawn:q,blocked:g.blocked(q.x,q.z,.35),length:g.findPath(q.x,q.z,s.player.x,s.player.z).length}));
  const original={x:s.player.x,z:s.player.z};g.moveCircle(s.player,100,0);out.wallStops=g.blocked(s.player.x+.4,s.player.z,.3)&&s.player.x<12;s.player.x=original.x;s.player.z=original.z;
  const ammo=s.ammo;g.shoot();out.shot=ammo-s.ammo; s.fireCooldown=0;g.reload();for(let i=0;i<30;i++)g.update(.05);out.reload={ammo:s.ammo,reserve:s.reserve};
  g.openShop();s.money=0;const free=g.purchase('ammo');out.noFreeAmmo=!free&&s.money===0; s.money=120;const before=s.reserve;const first=g.purchase('ammo');const second=g.purchase('ammo');out.purchase={first,second,money:s.money,ammoAdded:s.reserve-before};
  g.closeShop();g.pause();out.paused=s.mode==='paused';g.resume();
  g.gameover();out.gameover=s.mode==='dead';g.start();
  g.shoot();s.fireCooldown=0;g.openShop();s.money=1000;const bought=g.purchase('shotgun'), initial=[s.weaponId,s.ammo,s.reserve,s.money], duplicate=g.purchase('shotgun');g.closeShop();s.fireCooldown=0;g.shoot();const shot=[s.ammo,s.reserve];g.reload();for(let i=0;i<37;i++)g.update(.05);const reload=[s.ammo,s.reserve];g.switchWeapon('pistol');const pistol=[s.ammo,s.reserve];g.switchWeapon('shotgun');const restored=[s.ammo,s.reserve];out.shotgun={bought,initial,duplicate,shot,reload,pistol,restored};
  g.start();g.barricade.hp=0;s.player.x=-6;s.player.z=0;s.money=100;const pressE=()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'}));pressE();const occupied=[g.barricade.hp,s.money,g.blocked(s.player.x,s.player.z)];s.player.z=-1;s.money=0;pressE();const noFunds=[g.barricade.hp,s.money];s.money=100;pressE();const repaired=[g.barricade.hp,s.money];out.barricade={occupied,noFunds,repaired};
  g.start();out.restart={wave:s.wave,kills:s.kills,health:s.health,money:s.money,ammo:s.ammo,enemies:s.enemies.length};
  return out;
 });
 console.log(JSON.stringify({results,errors,failed},null,2));
 assert(Math.abs(results.look.yawDegrees+100)<.01,'1000 raw units should rotate 100 degrees');assert(Math.abs(results.look.pitchDegrees+10)<.01,'pitch sensitivity');assert(results.pitchClamped,'pitch clamp');
 assert(results.paths.every(p=>!p.blocked&&p.length>0),'all spawn paths open');assert(results.wallStops,'collision');assert.equal(results.shot,1);assert.equal(results.reload.ammo,12);assert(results.noFreeAmmo);assert.deepEqual(results.purchase,{first:true,second:false,money:0,ammoAdded:36});assert(results.paused&&results.gameover);assert.deepEqual(results.shotgun,{bought:true,initial:['shotgun',6,24,450],duplicate:false,shot:[5,24],reload:[6,23],pistol:[11,72],restored:[6,23]});assert.deepEqual(results.barricade,{occupied:[0,100,false],noFunds:[0,0],repaired:[1,0]});assert.deepEqual(results.restart,{wave:0,kills:0,health:100,money:0,ammo:12,enemies:0});assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
