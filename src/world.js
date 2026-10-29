// The house and actors are built from original procedural geometry; no external assets.
export function createWorld(THREE, scene) {
  scene.background = new THREE.Color(0x101720);
  scene.fog = new THREE.Fog(0x101720, 22, 65);
  const mats = {};
  const mat = (name, color, extra={}) => mats[name] = new THREE.MeshStandardMaterial({color, roughness: .87, ...extra});
  mat('plaster',0x777368); mat('trim',0x3d3730); mat('wood',0x554538); mat('woodLight',0x80705a);
  mat('floor',0x43382f); mat('tile',0x69706a); mat('metal',0x343f40,{metalness:.45,roughness:.5});
  mat('dark',0x202729); mat('glass',0x263d47,{metalness:.25,roughness:.22}); mat('paper',0xa9a18a);
  mat('cloth',0x584e43); mat('red',0x6b302a); mat('green',0x414e3b); mat('light',0xe6c994,{emissive:0xa57b42,emissiveIntensity:.55});
  const walls=[];
  function box(x,y,z,w,h,d,m,collision=false) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), typeof m==='string'?mats[m]:m);
    mesh.position.set(x,y,z); mesh.receiveShadow=true; mesh.castShadow=true; scene.add(mesh);
    if(collision) walls.push({minX:x-w/2,maxX:x+w/2,minY:0,maxY:y+h/2,minZ:z-d/2,maxZ:z+d/2});
    return mesh;
  }
  function wall(x,z,w,d,h=3.6) {
    box(x,h/2,z,w,h,d,'plaster',true);
    box(x,.10,z,w+.015,.20,d+.015,'trim');
    box(x,h-.12,z,w+.015,.16,d+.015,'trim');
  }
  // Four connected rooms. Internal walls have two generously sized openings each.
  wall(0,-10,24,.26); wall(0,10,24,.26); wall(-12,0,.26,20); wall(12,0,.26,20);
  wall(0,-8.15,.22,3.7); wall(0,0,.22,7.8); wall(0,8.15,.22,3.7);
  wall(-9.85,0,4.3,.22); wall(0,0,8.6,.22); wall(9.85,0,4.3,.22);
  // Door headers and jambs make openings legible without obstructing traversal.
  for (const x of [-6,6]) {
    box(x,3.12,0,3.4,.38,.33,'trim');
    for(const dx of [-1.67,1.67]) box(x+dx,1.55,0,.14,3.1,.34,'woodLight');
  }
  for (const z of [-5,5]) {
    box(0,3.12,z,.33,.38,2.4,'trim');
    for(const dz of [-1.16,1.16]) box(0,1.55,z+dz,.34,3.1,.14,'woodLight');
  }
  // Floors by room; individual plank lines and kitchen tiling add scale.
  box(0,-.12,0,24,.22,20,'floor');
  box(6,-.005,-5,11.75,.03,9.75,'tile');
  for(let x=.4;x<12;x+=1) box(x,.014,-5,.015,.008,9.75,'dark');
  for(let z=-9.5;z<0;z+=1) box(6,.015,z,11.75,.008,.015,'dark');
  for(let x=-11.5;x<12;x+=.8) {
    box(x,.012,5,.018,.009,9.7,'trim');
    if(x<0) box(x,.012,-5,.018,.009,9.7,'trim');
  }
  box(0,3.65,0,24,.15,20,'trim');
  for(const z of [-8,-4,4,8]) box(0,3.53,z,24,.18,.19,'wood');
  // Windows. Dark panes sit in deep frames with crossbars and improvised boards.
  function window(x,z,orientation,boarded=false) {
    const g=new THREE.Group(); g.position.set(x,1.9,z); g.rotation.y=orientation; scene.add(g);
    function part(px,py,pz,w,h,d,m,rot=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[m]);o.position.set(px,py,pz);o.rotation.z=rot;g.add(o);return o;}
    part(0,0,0,2.45,1.75,.06,'glass');
    for(const y of [-.9,.9]) part(0,y,.07,2.7,.13,.15,'woodLight');
    for(const x of [-1.3,1.3]) part(x,0,.07,.13,1.9,.15,'woodLight');
    part(0,0,.09,.08,1.7,.1,'trim'); part(0,0,.09,2.4,.08,.1,'trim');
    if(boarded){part(0,-.35,.16,2.5,.22,.12,'wood',.12);part(0,.32,.18,2.5,.22,.12,'wood',-.16);}
  }
  window(-7,-9.83,0,true);window(6,-9.83,0,false);window(-7,9.83,Math.PI,true);window(7,9.83,Math.PI,true);
  window(-11.83,-4,Math.PI/2,true);window(11.83,5,-Math.PI/2,false);
  // Warm practical light with a cool moonlit fill. No shadow maps for stable performance.
  scene.add(new THREE.HemisphereLight(0x92a8b7,0x25201a,1.3));
  const moon=new THREE.DirectionalLight(0x8299b8,1.05);moon.position.set(-5,10,-3);scene.add(moon);
  for(const [x,z] of [[-6,-5],[6,-5],[-6,5],[6,5]]) {
    const lamp=new THREE.PointLight(0xffc77e,30,12,2); lamp.position.set(x,3.15,z);scene.add(lamp);
    box(x,3.35,z,.25,.25,.25,'metal');box(x,3.18,z,.5,.15,.5,'light');
  }
  // Room furniture. Collision blocks all substantial props, leaving clear central routes.
  function table(x,z,w,d){box(x,.78,z,w,.14,d,'woodLight',true);for(const dx of [-w/2+.1,w/2-.1])for(const dz of [-d/2+.1,d/2-.1])box(x+dx,.38,z+dz,.12,.76,.12,'wood');}
  function cabinet(x,z,w,d,h=1.5){box(x,h/2,z,w,h,d,'wood',true);box(x,h*.55,z,w*.90,h*.65,d+.02,'woodLight');for(let i=-1;i<=1;i++)box(x+i*w*.27,h*.7,z+d/2+.03,.05,.05,.05,'metal');}
  // Living room, southwest.
  box(-9,.5,-4,2.4,1,1.1,'cloth',true);box(-9,1,-4.48,2.4,.65,.18,'cloth');
  box(-9.95,.85,-4,.18,.6,1.1,'wood');box(-8.05,.85,-4,.18,.6,1.1,'wood');
  table(-6.7,-7.9,1.8,.85);box(-6.7,.89,-7.9,.6,.06,.4,'paper');
  cabinet(-10.8,-7.8,1.4,.65,2.2);
  for(let i=0;i<5;i++)box(-11.25+i*.22,1.65,-7.42,.15,.45,.16,['red','green','paper'][i%3]);
  // Kitchen, southeast.
  cabinet(10.8,-6.7,1.8,3.6,1);box(10.8,1.02,-6.7,1.9,.09,3.7,'metal');
  box(10.8,1.15,-7.2,1.4,.08,1.4,'dark');for(const z of [-7.6,-6.9])for(const x of [10.45,11.15])box(x,1.21,z,.42,.03,.42,'metal');
  box(8.8,1.1,-9.1,1.25,2.2,1.4,'metal',true);box(8.8,1.2,-8.38,1.1,.025,.05,'dark');
  table(5.5,-6.2,2.3,1.1);box(5.5,.9,-6.2,.36,.09,.36,'paper');
  // Study / bedroom, northwest.
  box(-9,.43,6.8,3.5,.65,1.9,'wood',true);box(-9,.80,6.8,3.2,.23,1.7,'cloth');box(-10,.95,6.8,.7,.12,1.2,'paper');
  cabinet(-10.7,2.7,1.4,1,2.3);table(-5.4,8.8,2.5,.8);box(-5.7,.9,8.8,.7,.12,.45,'paper');
  // Garage / supply room, southeast; bright supply cabinet marks shop.
  cabinet(10.5,7.8,2.3,.85,2);box(10.5,1.8,7.34,1.7,.28,.04,'red');
  table(8.6,2.1,3,.8);for(let i=0;i<3;i++)box(7.8+i*.55,.94,2.1,.3,.26,.3,'metal');
  for(const [x,z] of [[-11,9],[-11,-9],[11,9],[11,-9]]) {box(x,.32,z,.55,.64,.55,'wood');box(x,.68,z,.6,.1,.6,'woodLight');}
  // Rugs, framed pictures, wall notices, and practical objects give each room a purpose.
  box(-8,.027,-5.6,4.8,.012,2.7,'red');
  for(const z of [-6.82,-4.38])box(-8,.035,z,4.5,.012,.05,'woodLight');
  const art=new THREE.MeshStandardMaterial({color:0x58645d,roughness:1});
  function picture(x,y,z,w,h) {
    box(x,y,z,w+.14,h+.14,.10,'trim');box(x,y,z+(z<0?.07:-.07),w,h,.04,art);
    box(x,y-h*.17,z+(z<0?.10:-.10),w*.7,.05,.02,'woodLight');
  }
  picture(-3.4,2.15,-9.80,1.2,.8);picture(3.3,2.15,9.80,1.5,.9);
  // A legible marker on the supply cabinet is visible from its approach.
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#5b2e29';ctx.fillRect(0,0,512,128);
    ctx.fillStyle='#e5cfaa';ctx.font='bold 54px sans-serif';ctx.textAlign='center';ctx.fillText('SUPPLIES',256,82);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.65,.40),new THREE.MeshBasicMaterial({map:tex}));
    sign.position.set(10.5,1.8,7.30);sign.rotation.y=Math.PI;scene.add(sign);
  }
  // Small readable outbreak details.
  const stain=new THREE.MeshStandardMaterial({color:0x572d29,roughness:1});
  for(const [x,z,s] of [[-3,-8,.45],[3,3,.3],[8,8,.55],[-8,3,.25]])box(x,.025,z,s,.012,s*.45,stain);
  return {walls, spawnPoints:[{x:-10,z:-2},{x:10,z:-2},{x:-3,z:8},{x:3,z:8},{x:3,z:-8},{x:-3,z:-8}], shopPosition:{x:10.5,z:6.5}, playerStart:{x:-6,z:-4}};
}

export function createZombie(THREE, scene, type='walker') {
  const group=new THREE.Group();scene.add(group);
  const skin=new THREE.MeshStandardMaterial({color:type==='runner'?0x858c72:0x788276,roughness:1});
  const cloth=new THREE.MeshStandardMaterial({color:type==='runner'?0x594d3d:0x46504a,roughness:1});
  const pants=new THREE.MeshStandardMaterial({color:0x343a39,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x302b29,roughness:1});
  const eyes=new THREE.MeshBasicMaterial({color:0xe1b567});
  function part(w,h,d,m,x,y,z,parent=group){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o;}
  const torso=part(.62,.85,.34,cloth,0,1.17,0);part(.67,.22,.39,cloth,0,1.51,0);
  const head=part(.43,.48,.4,skin,0,1.83,0);part(.16,.05,.035,eyes,-.11,1.88,.215);part(.16,.05,.035,eyes,.11,1.88,.215);part(.2,.05,.035,dark,0,1.69,.215);
  const leftArm=new THREE.Group(),rightArm=new THREE.Group();leftArm.position.set(-.42,1.47,0);rightArm.position.set(.42,1.47,0);group.add(leftArm,rightArm);
  part(.23,.75,.25,cloth,0,-.30,0,leftArm);part(.2,.2,.22,skin,0,-.72,0,leftArm);
  part(.23,.75,.25,cloth,0,-.30,0,rightArm);part(.2,.2,.22,skin,0,-.72,0,rightArm);
  const leftLeg=new THREE.Group(),rightLeg=new THREE.Group();leftLeg.position.set(-.18,.78,0);rightLeg.position.set(.18,.78,0);group.add(leftLeg,rightLeg);
  for(const leg of [leftLeg,rightLeg]){part(.25,.68,.27,pants,0,-.34,0,leg);part(.28,.13,.4,dark,0,-.71,.06,leg);}
  function update(dt,phase,windup,hit) {
    const stride=Math.sin(phase);
    leftLeg.rotation.x=stride*.50; rightLeg.rotation.x=-stride*.50;
    const attack=Math.min(1,windup/.5);
    leftArm.rotation.x=-.35-stride*.25-attack*1.25;
    rightArm.rotation.x=-.4+stride*.25-attack*1.35;
    leftArm.rotation.z=.08; rightArm.rotation.z=-.08;
    group.rotation.x=hit>0 ? -.15 : attack*.08;
    group.position.y=Math.abs(stride)*.025;
  }
  return {group,head,torso,leftArm,rightArm,leftLeg,rightLeg,update};
}

export function createWeapon(THREE,camera) {
  const group=new THREE.Group();camera.add(group);group.position.set(.33,-.30,-.70);group.scale.setScalar(.72);group.rotation.set(-.04,-.08,0);
  const metal=new THREE.MeshStandardMaterial({color:0x2b3030,metalness:.65,roughness:.45});
  const black=new THREE.MeshStandardMaterial({color:0x1b1d1c,metalness:.2,roughness:.65});
  const grip=new THREE.MeshStandardMaterial({color:0x584536,roughness:.95});
  function piece(w,h,d,m,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);group.add(o);return o;}
  piece(.17,.14,.39,metal,0,0,0);piece(.15,.13,.26,black,0,.06,-.13);piece(.10,.08,.24,metal,0,.04,-.35);
  const handle=piece(.11,.23,.12,grip,0,-.16,.09);handle.rotation.x=-.18;
  piece(.08,.05,.06,black,0,.15,-.19);piece(.1,.04,.07,black,0,.14,.14);
  piece(.09,.075,.025,black,0,.045,-.48); // muzzle
  piece(.065,.025,.18,grip,0,-.095,-.17); // under-barrel grip
  piece(.12,.035,.13,black,0,-.275,.09); // magazine base
  piece(.02,.08,.16,metal,.08,-.105,.015); // trigger guard
  piece(.03,.08,.07,black,0,-.105,.04); // trigger

  const flash=new THREE.Mesh(new THREE.SphereGeometry(.12,6,4),new THREE.MeshBasicMaterial({color:0xffd079,transparent:true,opacity:.9}));flash.position.set(0,.04,-.52);flash.visible=false;group.add(flash);
  return {group,flash};
}
