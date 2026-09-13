import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const centerEl = document.querySelector('.center');
  const rifleScopeEl = document.getElementById('rifleScope');
  const hpEl = document.getElementById('hp');
  const armorEl = document.getElementById('armor');
  const ammoEl = document.getElementById('ammo');
  const scoreEl = document.getElementById('score');
  const killsEl = document.getElementById('kills');
  const headshotsEl = document.getElementById('headshots');
  const waveEl = document.getElementById('wave');
  const enemiesEl = document.getElementById('enemiesLeft');
  const startEl = document.getElementById('start');
  const overEl = document.getElementById('over');
  const resultEl = document.getElementById('result');
  const hitNoticeEl = document.getElementById('hitNotice');
  const playBtn = document.getElementById('play');
  const againBtn = document.getElementById('again');
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  const fireBtn = document.getElementById('fire');
  const fireLeftBtn = document.getElementById('fireLeft');
  // Linguagem visual invertida conforme pedido: disparo retangular, mira circular.
  for(const btn of [fireBtn,fireLeftBtn].filter(Boolean)){
    btn.style.width=btn===fireBtn?'104px':'88px';btn.style.height='60px';
    btn.style.borderRadius='14px';btn.style.fontSize=btn===fireBtn?'17px':'13px';
  }
  const weaponSwitchBtn = document.getElementById('weaponSwitch');
  const reloadBtn = document.getElementById('reload');
  const jumpBtn = document.createElement('button');
  jumpBtn.id='jump'; jumpBtn.textContent='PULAR'; jumpBtn.setAttribute('aria-label','Pular');
  jumpBtn.style.cssText='position:absolute;right:222px;bottom:32px;width:76px;height:68px;border:3px solid #171510;border-radius:18px;background:rgba(238,231,212,.88);font:700 14px Georgia;color:#171510;pointer-events:auto;touch-action:none;user-select:none;z-index:12;box-shadow:4px 4px 0 rgba(23,21,16,.16)';
  document.querySelector('.controls')?.appendChild(jumpBtn);
  const oldWeapon = document.querySelector('.weapon');
  if (oldWeapon) oldWeapon.style.display = 'none';

  const TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  // Folha de papel quente, como a referência: o cenário deve parecer desenhado sobre papel,
  // não um mundo 3D com materiais tradicionais.
  scene.background = new THREE.Color(0xf3efe4);
  scene.fog = new THREE.Fog(0xf3efe4, 32, 96);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 120);
  camera.position.set(0, 1.7, 18);
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // Qualidade adaptativa leve: em telas touch/mobile limitamos a resolução interna para poupar GPU,
  // sem alterar FOV, física, controles ou tamanho visual do canvas.
  function renderPixelRatio(){
    const coarse = matchMedia?.('(pointer: coarse)')?.matches || innerWidth < 800;
    return Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5);
  }
  renderer.setPixelRatio(renderPixelRatio());
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const hemi = new THREE.HemisphereLight(0xf4f0df, 0x383a35, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4d8, 2.6);
  sun.position.set(-18, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  scene.add(sun);

  // Paleta de ilustração: papel branco, tinta preta e poucas cores de destaque.
  // Direção visual: folha branca + linhas de caneta + poucas cores de leitura.
  const ink = 0x294aa3;
  const paper = 0xfcfbf7;
  const wall = 0xffffff;
  const wallLight = 0xf4f5f2;
  const wood = 0xe4e0d7;
  const woodLight = 0xf5f3ed;
  const waterColor = 0x9abbd0;
  const red = 0xd73535;
  const blue = 0x356bc1;
  const black = 0x151a22;
  const green = 0x3d8b68;
  const hatchInk = 0x5e78bd;
  const enemyWhite = 0xffffff;

  const player = {
    pos: new THREE.Vector3(0, 1.7, 18),
    yaw: 0,
    pitch: 0,
    speed: 5.0,
    radius: 0.38,
    bob: 0,
    recoil: 0
  };

  let running = false;
  let controlsEditing = false;
  let gameOver = false;
  let last = performance.now();
  let score = 0, kills = 0, headshots = 0, ammo = 12, hp = 100, armor = 60, wave = 1;
  let bestScore=Number(localStorage.getItem('inkopsBestScore')||0), bestWave=Number(localStorage.getItem('inkopsBestWave')||0);
  let reloadTimer = 0, fireCooldown = 0, hurtTimer = 0, hitNoticeTimer = 0, spawnGrace = 0, waveDelay = 0;
  let reloadToken = 0;
  let scopeMode = false;
  let adsProgress = 0;
  let mouseLook = false;
  let fireHeld = false;
  // O botao de atirar tambem funciona como um pequeno controle de mira: segure e arraste sem soltar para atirar e girar a camera ao mesmo tempo.
  let fireLookId = null;
  let fireLookX = 0, fireLookY = 0;
  const tracers = [];
  const hitMarks = [];
  const inkExplosions = [];
  const rocketProjectiles = [];
  const rocketPuffs = [];
  const shotgunBlots = [];

  const ADS_DURATION = 0.28;
  const NORMAL_FOV = 72;
  // O rifle tem uma aproximação leve; a sniper entra em um zoom realmente forte de luneta.
  // O FOV baixo concentra a perspectiva no alvo sem precisar colocar uma peça 3D na frente da câmera.
  const ADS_FOV = 47;
  const SNIPER_ADS_FOV = 11;
  const SPRINT_MULTIPLIER = 1.25; // 1.2–1.3x, conforme pedido para o avanço do analógico.
  let touchLookId = null;
  let lastLookX = 0, lastLookY = 0;
  let audioCtx = null;
  const keys = Object.create(null);
  const weaponModes = ['rifle','smg','shotgun','launcher','sniper','knife'];
  let weaponMode = 'rifle';
  const MAGAZINES = { rifle: 30, smg: 36, shotgun: 6, launcher: 1, sniper: 5 };
  const RESERVE_AMMO = { rifle:120, smg:144, shotgun:30, launcher:6, sniper:20 };
  let reserveAmmo = { rifle:120, smg:144, shotgun:30, launcher:6, sniper:20 };
  let weaponKick = 0;
  let fireZoom = 0;
  let sprintBlend = 0;
  let knifeSwing = 0;
  let sniperCycle = 0;
  let playerStepTimer = 0;
  let shotCount = 0;
  // Fundação multiplayer v57: lobby e presença ficam separados do combate.
  // A partida solo continua disponível como rota segura enquanto sincronizamos o FPS por etapas.
  const multiplayer = {
    token: localStorage.getItem('inkopsPlayerToken') || (crypto.randomUUID?.() || ('p-'+Date.now()+'-'+Math.random().toString(36).slice(2))),
    // Nunca entra automaticamente em uma partida antiga. Em alguns Androids o código salvo
    // fazia o jogo pular o lobby e reabrir diretamente uma sala já iniciada.
    roomCode: '',
    nickname: localStorage.getItem('inkopsNickname') || '',
    room: null,
    polling: null,
    busy: false,
    networkTimer: null,
    networkBusy: false,
    remotePlayers: new Map(),
    selfAlive: true,
    pendingHits: new Map(),
    hitFlushTimer: null
  };
  localStorage.setItem('inkopsPlayerToken',multiplayer.token);
  localStorage.removeItem('inkopsRoomCode');
  let verticalVelocity = 0;
  let grounded = true;
  let jumpPadCooldown = 0;
  const joy = { x: 0, y: 0, tx: 0, ty: 0, active: false, id: null };
  const colliders = [];
  const enemies = [];
  const props = [];
  const tempBox = new THREE.Box3();
  const raycaster = new THREE.Raycaster();
  const clock = new THREE.Clock();

  function mat(color, rough = 0.86) {
    // Flat toon shading gives the volume of 3D while the ink geometry supplies the drawn look.
    return new THREE.MeshToonMaterial({ color, flatShading: true });
  }
  function addOutline(mesh, width = 1.4) {
    // EdgesGeometry is intentionally paired with hatch marks below: outlines alone look like a filter,
    // while the extra pen strokes make the objects read like hand-drawn construction sketches.
    const edges = new THREE.EdgesGeometry(mesh.geometry, 28);
    const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.94, linewidth: width }));
    mesh.add(lines);
    return mesh;
  }
  function box(w, h, d, material, x, y, z, collide = false) {
    const m = addOutline(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    if (collide) colliders.push({ minX: x - w/2, maxX: x + w/2, minZ: z - d/2, maxZ: z + d/2, height: y + h/2 });
    return m;
  }
  function cyl(r, h, material, x, y, z, segments = 8, collide = false) {
    const m = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, segments), material));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    if (collide) colliders.push({ minX: x-r, maxX: x+r, minZ: z-r, maxZ: z+r });
    return m;
  }

  function createInkX(size = .16, color = red) {
    const points = [
      new THREE.Vector3(-size, size, 0), new THREE.Vector3(size, -size, 0),
      new THREE.Vector3(size, size, 0), new THREE.Vector3(-size, -size, 0)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .98, depthTest: true }));
  }

  function createImpactMark(size = .13) {
    const g = new THREE.Group();
    g.add(createInkX(size, red));
    const radial = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + .25;
      const inner = size * .72, outer = size * 1.35;
      radial.push(
        new THREE.Vector3(Math.cos(a) * inner, Math.sin(a) * inner, .001),
        new THREE.Vector3(Math.cos(a) * outer, Math.sin(a) * outer, .001)
      );
    }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(radial), new THREE.LineBasicMaterial({ color: red, transparent: true, opacity: .78 })));
    return g;
  }

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: blue, transparent: true, opacity: .92, depthTest: false }));
    line.renderOrder = 20;
    scene.add(line);
    tracers.push({ line, life: .075 });
  }

  function createInkExplosion(position) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y += .12;
    group.renderOrder = 30;

    // Nuvem clara com contorno azul: parece um rabisco sobre papel em vez de fogo realista.
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff8dc, transparent: true, opacity: .92, depthWrite: false
    });
    const cloudOutline = new THREE.LineBasicMaterial({
      color: ink, transparent: true, opacity: .96, depthTest: false
    });
    const blobs = [
      [0, 0, 0, .82], [-.68, .10, .04, .54], [.66, .18, -.05, .57],
      [-.28, .61, 0, .48], [.31, .65, .03, .44], [0, -.48, .02, .52]
    ];
    for (const [x,y,z,s] of blobs) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), cloudMaterial.clone());
      mesh.position.set(x,y,z); group.add(mesh);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 18), cloudOutline.clone());
      mesh.add(edge);
    }

    // Raios tortos e hachuras dão a graça de quadrinho desenhado à mão.
    const strokes = [];
    for (let i=0;i<16;i++) {
      const a=i/16*TAU+(i%3)*.035;
      const inner=.82+(i%2)*.16, outer=1.62+(i%4)*.20;
      const bend=a+(i%2?.09:-.07);
      strokes.push(
        new THREE.Vector3(Math.cos(a)*inner,Math.sin(a)*inner,0),
        new THREE.Vector3(Math.cos(bend)*outer,Math.sin(bend)*outer,0)
      );
    }
    const rays = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(strokes),
      new THREE.LineBasicMaterial({color:red, transparent:true, opacity:.98, depthTest:false})
    );
    // O vermelho único mantém o efeito barato no celular e combina com os impactos existentes.
    group.add(rays);

    const label = document.createElement('canvas'); label.width=256; label.height=128;
    const ctx=label.getContext('2d');
    ctx.translate(128,64); ctx.rotate(-.10);
    ctx.font='900 58px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.lineJoin='round'; ctx.lineWidth=13; ctx.strokeStyle='#294aa3'; ctx.strokeText('POW!',0,0);
    ctx.fillStyle='#d73535'; ctx.fillText('POW!',0,0);
    const texture=new THREE.CanvasTexture(label); texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
    sprite.position.set(0,1.05,.08); sprite.scale.set(2.9,1.45,1); sprite.renderOrder=31; group.add(sprite);

    scene.add(group);
    inkExplosions.push({group,life:.58,maxLife:.58,materials:group.children.flatMap(o=>[o.material,o.children?.[0]?.material]).filter(Boolean),texture});
  }

  function createShotgunInkBlot(position){
    const canvasBlot=document.createElement('canvas');canvasBlot.width=256;canvasBlot.height=256;
    const ctx=canvasBlot.getContext('2d');ctx.translate(128,128);
    // Mancha vermelha grande, como nanquim espalhado por vários microdisparos.
    ctx.beginPath();
    for(let i=0;i<22;i++){
      const a=i/22*TAU;
      const radius=58+(i%3)*9+Math.random()*16;
      const x=Math.cos(a)*radius,y=Math.sin(a)*radius;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.fillStyle='#c51f35';ctx.fill();
    ctx.lineWidth=7;ctx.strokeStyle='#10151f';ctx.stroke();
    for(let i=0;i<12;i++){
      const a=Math.random()*TAU,d=78+Math.random()*36,r=3+Math.random()*8;
      ctx.beginPath();ctx.arc(Math.cos(a)*d,Math.sin(a)*d,r,0,TAU);
      ctx.fillStyle=i%3===0?'#151a22':'#7b1224';ctx.fill();
    }
    ctx.rotate(-.12);ctx.font='900 30px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=7;ctx.strokeStyle='#fff8dc';ctx.strokeText('PLOFT!',0,2);ctx.fillStyle='#d73535';ctx.fillText('PLOFT!',0,2);
    const texture=new THREE.CanvasTexture(canvasBlot);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false}));
    const towardCamera=camera.position.clone().sub(position).normalize();
    sprite.position.copy(position).addScaledVector(towardCamera,.055);sprite.scale.set(2.45,2.45,1);sprite.renderOrder=24;scene.add(sprite);
    inkSplatSound();
    shotgunBlots.push({sprite,texture,life:.78,maxLife:.78});
  }

  function makeComicSprite(textValue,fill='#d73535',stroke='#294aa3'){
    const label=document.createElement('canvas');label.width=256;label.height=96;
    const ctx=label.getContext('2d');ctx.translate(128,48);ctx.rotate(-.08);
    ctx.font='900 40px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    ctx.lineWidth=10;ctx.strokeStyle=stroke;ctx.strokeText(textValue,0,0);ctx.fillStyle=fill;ctx.fillText(textValue,0,0);
    const texture=new THREE.CanvasTexture(label);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
    sprite.userData.comicTexture=texture;return sprite;
  }

  function launchRocket(from,dir,distance){
    const group=new THREE.Group();
    const body=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,.72,8),mat(wallLight)));
    const nose=addOutline(new THREE.Mesh(new THREE.ConeGeometry(.15,.30,8),mat(red)));
    nose.position.y=.50;group.add(body,nose);
    for(const side of [-1,1]){
      const fin=new THREE.Mesh(new THREE.BoxGeometry(.06,.25,.25),mat(blue));fin.position.set(side*.15,-.23,0);fin.rotation.z=side*.30;group.add(fin);
    }
    const caption=makeComicSprite('FIIIU!');caption.position.set(0,.72,0);caption.scale.set(1.35,.50,1);group.add(caption);
    group.position.copy(from);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
    group.traverse(o=>{if(o.isMesh)o.userData.noBulletMark=true;});scene.add(group);
    rocketProjectiles.push({group,dir:dir.clone(),remaining:distance,speed:15.5,life:4.2,puffTimer:0,soundTimer:.04,soundStep:0,caption});
  }

  function addRocketPuff(position){
    const puff=createInkX(.10+Math.random()*.06,Math.random()>.45?blue:ink);
    puff.position.copy(position);puff.rotation.z=Math.random()*TAU;puff.renderOrder=18;scene.add(puff);
    rocketPuffs.push({puff,life:.42,maxLife:.42});
  }

  function rocketExplosionSound(){
    initAudio();if(!audioCtx)return;
    const now=audioCtx.currentTime;noiseBurst(.30,.86,120,2100);noiseBurst(.07,.34,2300,6800);
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(78,now);o.frequency.exponentialRampToValueAtTime(22,now+.38);
    g.gain.setValueAtTime(.52,now);g.gain.exponentialRampToValueAtTime(.0001,now+.40);o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+.41);
  }

  function rocketFlightSound(step=0){
    initAudio();if(!audioCtx)return;
    const now=audioCtx.currentTime;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=step%2?'triangle':'sine';
    const start=step%2?430:620,end=step%2?690:910;
    o.frequency.setValueAtTime(start,now);o.frequency.exponentialRampToValueAtTime(end,now+.11);
    g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.075,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+.13);
    o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+.14);
  }

  function detonateRocket(position){
    createInkExplosion(position);rocketExplosionSound();
    let defeated=0;
    for(const e of enemies){
      if(e.dead)continue;
      const d=e.group.position.distanceTo(position);
      if(d<=4.8){
        // Centro letal; a borda ainda machuca, mas permite escapar parcialmente.
        const damage=d<=3.2?999:6;e.hp-=damage;e.hit=.42;
        if(e.hp<=0){e.dead=true;defeated++;kills++;score+=e.elite?30:10;scene.remove(e.group);}
      }
    }
    for(const [token,remote] of multiplayer.remotePlayers){const d=remote.group.position.distanceTo(position);if(d<=4.8)reportRemoteHit(token,d<=3.2?100:55,false);}
    hitNoticeEl.textContent=defeated?'POW!  '+defeated+' ABATE'+(defeated>1?'S':''):'POW!';
    hitNoticeEl.classList.add('show');hitNoticeTimer=.70;updateHud();
  }

  function addImpactMark(hit) {
    const object = hit.object;
    const mark = createImpactMark(.13);
    const point = hit.point.clone();
    const normalWorld = hit.face?.normal
      ? hit.face.normal.clone().transformDirection(object.matrixWorld).normalize()
      : camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1);
    const localPoint = object.worldToLocal(point.clone());
    const localNormal = normalWorld.clone().transformDirection(object.matrixWorld.clone().invert()).normalize();
    mark.position.copy(localPoint).addScaledVector(localNormal, .012);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);
    mark.scale.setScalar(.9 + Math.random() * .35);
    mark.renderOrder = 21;
    object.add(mark);
    hitMarks.push({ mark, object, life: 999 });
    // Evita acúmulo infinito de marcas em partidas longas. Mantemos só as mais recentes.
    const MAX_HIT_MARKS=48;
    if(hitMarks.length>MAX_HIT_MARKS){
      const oldHit=hitMarks.shift();
      if(oldHit?.mark){
        oldHit.mark.parent?.remove(oldHit.mark);
        oldHit.mark.traverse(part=>{
          part.geometry?.dispose?.();
          if(Array.isArray(part.material)) part.material.forEach(m=>m?.dispose?.());
          else part.material?.dispose?.();
        });
      }
    }
    return mark;
  }

  function addHatching(mesh, w, h, d = 0, amount = 6, cross = true) {
    const group = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: hatchInk, transparent: true, opacity: .48 });
    const lines = [];
    for (let i = 0; i < amount; i++) {
      const t = (i + 1) / (amount + 1);
      const x = -w / 2 + w * t;
      lines.push(new THREE.Vector3(x - .55, -h / 2 + .08, d), new THREE.Vector3(x + .55, h / 2 - .08, d));
      if (cross) lines.push(new THREE.Vector3(x + .55, -h / 2 + .08, d + .002), new THREE.Vector3(x - .55, h / 2 - .08, d + .002));
    }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), lineMat));
    mesh.add(group);
    return group;
  }
  function inkPanel(w, h, d, material, x, y, z, hatch = true) {
    const m = box(w, h, d, material, x, y, z, false);
    if (hatch) addHatching(m, w * .82, h * .82, d / 2 + .008, Math.max(3, Math.round(w * 1.4)), true);
    return m;
  }

  function buildGround() {
    const g = new THREE.PlaneGeometry(92, 92, 28, 28);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getY(i);
      const y = Math.sin(x * .11) * .08 + Math.cos(z * .13) * .07 + Math.sin((x + z) * .04) * .05;
      pos.setZ(i, y);
    }
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, mat(paper));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    scene.add(ground);

    // The floor stays paper-white. Sparse blue/black strokes suggest paths without creating a grid.
    for (let z = -24; z <= 24; z += 8) {
      const path = new THREE.Mesh(new THREE.BoxGeometry(42, .018, .055), new THREE.MeshBasicMaterial({ color: blue, transparent: true, opacity: .24 }));
      path.position.set(0, .025, z + Math.sin(z * .4) * .35); path.rotation.y = Math.sin(z) * .012; scene.add(path);
    }
    for (let i = 0; i < 34; i++) {
      const x = -28 + (i * 19) % 56, z = -28 + (i * 13) % 56;
      const stroke = new THREE.Mesh(new THREE.BoxGeometry(.7 + (i % 3) * .35, .012, .035), new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: .18 }));
      stroke.position.set(x, .035, z); stroke.rotation.y = (i % 2 ? -.35 : .18); scene.add(stroke);
    }
  }

  function buildRiver() {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(92, 7, 1, 14), new THREE.MeshStandardMaterial({ color: waterColor, roughness: .32, metalness: .08, transparent: true, opacity: .94 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, .02, 0); water.receiveShadow = true; scene.add(water);
    for (let i = -42; i <= 42; i += 3) {
      const ripple = new THREE.Mesh(new THREE.BoxGeometry(1.2 + (i % 2 ? .4 : 0), .025, .035), mat(0xb8c7c3, .45));
      ripple.position.set(i, .055, Math.sin(i * .6) * 2.3); ripple.rotation.y = .08; scene.add(ripple);
    }
    // Banks are raised, irregular ink-rock strips.
    for (const z of [-4.0, 4.0]) {
      for (let x = -42; x <= 42; x += 2.5) {
        // Mantém as duas saídas de cada ponte completamente livres.
        if(Math.abs(x)<3.6||Math.abs(x-30)<3.6||Math.abs(x+30)<3.6)continue;
        const r = .45 + ((x * 17) % 7 + 7) % 7 / 10;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(0x6d6a61));
        rock.position.set(x, .18 + r*.25, z + Math.sin(x) * .3); rock.scale.y = .7; rock.castShadow = true; scene.add(rock);
      }
    }
  }

  function buildBridge(x) {
    // Três partes físicas e visuais: sobe desde o chão, fica reta sobre o rio e desce suavemente.
    const slope=Math.atan2(.50,2.4);
    const deck=addOutline(new THREE.Mesh(new THREE.BoxGeometry(5.2,.28,7.0),mat(wood)));
    deck.position.set(x,.36,0);deck.castShadow=true;deck.receiveShadow=true;scene.add(deck);
    for(const sideZ of [-1,1]){
      const ramp=addOutline(new THREE.Mesh(new THREE.BoxGeometry(5.2,.26,2.4),mat(wood)));
      ramp.position.set(x,.24,sideZ*4.7);ramp.rotation.x=sideZ*slope;
      ramp.castShadow=true;ramp.receiveShadow=true;scene.add(ramp);
    }
    const bridgeFloor=z=>{
      const az=Math.abs(z);
      return az<=3.5?.50:Math.max(.02,.50-(az-3.5)/2.4*.48);
    };
    for(let z=-5.65;z<=5.65;z+=.70){
      const plank=box(4.95,.07,.48,mat(woodLight),x,bridgeFloor(z)+.045,z,false);
      if(Math.abs(z)>3.5)plank.rotation.x=Math.sign(z)*slope;
      props.push(plank);
    }
    for(const side of [-2.42,2.42]){
      for(let z=-5.4;z<=5.4;z+=1.8)cyl(.10,1.12,mat(ink),x+side,bridgeFloor(z)+.55,z,6,false);
      const rail=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,6.8,7),mat(ink));
      rail.rotation.x=Math.PI/2;rail.position.set(x+side,1.42,0);scene.add(rail);
    }
    // Marcas de tinta nas entradas tornam as três travessias fáceis de localizar.
    for(const z of [-4.75,4.75]){
      const marker=box(5.0,.05,.34,mat(x===0?red:blue),x,.10,z,false);props.push(marker);
    }
  }

  function buildHouse(x, z) {
    // Casa em estilo de desenho técnico: paredes brancas, vigas pretas e hachuras de caneta.
    const left = inkPanel(2.3, 3.5, .35, mat(wall), x - 2.35, 1.75, z - 2.6, true); left.userData.hatch = true;
    const right = inkPanel(2.3, 3.5, .35, mat(wall), x + 2.35, 1.75, z - 2.6, true); right.userData.hatch = true;
    const back = inkPanel(7.0, 3.5, .35, mat(wall), x, 1.75, z + 2.6, true); back.userData.hatch = true;
    inkPanel(.35, 3.5, 5.0, mat(wall), x - 3.35, 1.75, z, false);
    inkPanel(.35, 3.5, 5.0, mat(wall), x + 3.35, 1.75, z, false);
    // Vigas pretas deixam a construção imediatamente legível como um desenho à caneta.
    box(.16, 3.35, .18, mat(ink), x - 3.08, 1.7, z - 2.72, false);
    box(.16, 3.35, .18, mat(ink), x + 3.08, 1.7, z - 2.72, false);
    box(6.4, .14, .18, mat(ink), x, 3.38, z - 2.72, false);
    box(2.45, .12, .20, mat(blue), x, .15, z - 3.0, false);
    // No door: wide central opening remains fully playable.
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.85, 2.05, 4), mat(wallLight));
    roof.rotation.y = Math.PI/4; roof.position.set(x, 4.25, z); roof.scale.z = .78; addOutline(roof); scene.add(roof);
    addHatching(roof, 5.6, 1.4, .02, 8, false);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(6.5, .12, 4.9), mat(0xffffff)); floor.position.set(x, .04, z); floor.receiveShadow = true; scene.add(floor);
    for (const [dx,dz] of [[-1.8,.9],[1.8,1.0],[-1.4,-.2],[1.5,-.3]]) inkPanel(.8,.8,.8,mat(woodLight),x+dx,.42,z+dz,true);
    // Janelas em azul para dar um ponto de cor ao desenho.
    for (const dx of [-2.2, 2.2]) {
      const win = box(1.0, 1.0, .08, mat(0xdcecff), x+dx, 2.05, z-2.82, false);
      addHatching(win, .72, .72, .05, 3, false);
    }
    box(.7, 1.2, .7, mat(wallLight), x + 1.5, 4.0, z + .4, false);
    const sign = box(2.1, .55, .12, mat(red), x, 3.35, z - 2.82, false);
    props.push(sign);
    // Colisão fiel às quatro paredes, mantendo somente a entrada central aberta.
    // Antes a casa era apenas visual e o jogador atravessava as paredes.
    colliders.push(
      {minX:x-3.55,maxX:x-3.15,minZ:z-2.75,maxZ:z+2.75},
      {minX:x+3.15,maxX:x+3.55,minZ:z-2.75,maxZ:z+2.75},
      {minX:x-3.55,maxX:x+3.55,minZ:z+2.40,maxZ:z+2.80},
      {minX:x-3.55,maxX:x-1.18,minZ:z-2.80,maxZ:z-2.40},
      {minX:x+1.18,maxX:x+3.55,minZ:z-2.80,maxZ:z-2.40}
    );
  }

  function buildDecor() {
    // Fences, crates, rocks and watchtower give the player depth cues at several distances.
    for (let z = 10; z >= 2; z -= 2) box(.18, 1.3, .18, mat(wood), -16, .65, z, true);
    box(.18, .18, 16, mat(woodLight), -16, 1.12, 6, false);
    for (let i = 0; i < 24; i++) {
      const x = -27 + (i * 17) % 54, z = -24 + (i * 23) % 48;
      if (Math.abs(z) < 5 || (Math.abs(x+10)<7 && z>4 && z<14)) continue;
      const s = .45 + (i%3)*.18;
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat(0x68665f));
      rock.position.set(x, s*.55, z); rock.rotation.set(i*.2,i*.31,i*.13); rock.castShadow=true; scene.add(rock);
    }
    // Watchtower on the far bank.
    for (const x of [-23,-20]) for (const z of [-14,-11]) box(.35, 7, .35, mat(wood), x, 3.5, z, true);
    box(4, .3, 4, mat(woodLight), -21.5, 7, -12.5, false);
    box(4.2, 2.2, 4.2, mat(wall), -21.5, 8.0, -12.5, false);
    for (const x of [-23.3,-19.7]) box(.15, 2.4, .15, mat(woodLight), x, 8, -14.6, false);
    for (const x of [-23.3,-19.7]) box(.15, 2.4, .15, mat(woodLight), x, 8, -10.4, false);
  }

  function makeEnemy(x, z, elite = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    // Silhueta limpa de personagem desenhado: papel branco, contorno irregular e cor só nos detalhes.
    const variant = enemies.length % 3;
    const accent = elite ? red : (variant === 0 ? red : variant === 1 ? blue : green);
    const limbMat = mat(enemyWhite);
    const neonMat = mat(green);
    const dangerRing = new THREE.Mesh(new THREE.TorusGeometry(.58,.055,6,24), neonMat);
    dangerRing.rotation.x=Math.PI/2; dangerRing.position.y=.07; g.add(dangerRing);
    const neonChest = new THREE.Mesh(new THREE.BoxGeometry(.24,.34,.035), neonMat);
    neonChest.position.set(0,1.25,-.40); g.add(neonChest);
    const body = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.82, 1.05, .46), mat(enemyWhite)));
    body.userData.hitZone='body';
    body.position.y = 1.12; body.rotation.z = (variant - 1) * .035; g.add(body);
    addHatching(body, .58, .72, .235, 4, true);

    const coat = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.62,.52,.08), mat(accent)));
    coat.position.set(0,1.28,-.27); g.add(coat);

    // Inimigos blindados recebem colete tático claramente visível e placas nos ombros.
    // Isso comunica imediatamente que eles precisam de mais disparos.
    if(elite){
      const vest = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.88,.72,.16), mat(0xd9dee3)));
      vest.userData.hitZone='body'; vest.position.set(0,1.22,-.29); g.add(vest);
      addHatching(vest,.68,.48,.085,5,true);
      for(const side of [-1,1]){
        const pad = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.24,.20,.24), mat(0xb8c1c9)));
        pad.position.set(side*.53,1.48,-.02); pad.rotation.z=side*.12; g.add(pad);
      }
      const plate = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.30,.28,.035), mat(red)));
      plate.position.set(0,1.28,-.385); g.add(plate);
    }
    const belt = new THREE.Mesh(new THREE.BoxGeometry(.72,.10,.50), mat(ink));
    belt.position.set(0,.88,0); g.add(belt);

    const head = addOutline(new THREE.Mesh(new THREE.SphereGeometry(.40, 8, 6), mat(enemyWhite)));
    head.userData.hitZone='head';
    head.position.y = 2.02; g.add(head);
    // Máscara/faixa facial simples, inspirada em desenho de personagem e fácil de ler à distância.
    const faceBand = new THREE.Mesh(new THREE.BoxGeometry(.62,.13,.055), mat(accent));
    faceBand.position.set(0,2.02,-.37); g.add(faceBand);
    const eyeMat = mat(ink);
    for (const dx of [-.13,.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.042, 5, 4), eyeMat);
      eye.position.set(dx,2.05,-.405); g.add(eye);
    }

    const hat = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.36,.42,.14,7), mat(enemyWhite)));
    hat.position.set(0,2.39,0); g.add(hat);
    const hatMark = new THREE.Mesh(new THREE.BoxGeometry(.18,.08,.03), mat(accent));
    hatMark.position.set(0,2.45,-.34); g.add(hatMark);

    // Linhas imperfeitas externas reforçam que o inimigo foi esboçado à mão.
    const sketchPoints=[
      new THREE.Vector3(-.58,.18,.12),new THREE.Vector3(-.72,.72,.08),
      new THREE.Vector3(-.70,.82,.08),new THREE.Vector3(-.78,1.48,.04),
      new THREE.Vector3(-.66,1.56,.05),new THREE.Vector3(-.48,2.10,.02),
      new THREE.Vector3(-.34,2.44,.02),new THREE.Vector3(.02,2.56,.01),
      new THREE.Vector3(.30,2.48,.02),new THREE.Vector3(.50,2.12,.02),
      new THREE.Vector3(.64,1.58,.05),new THREE.Vector3(.78,1.02,.08),
      new THREE.Vector3(.68,.84,.08),new THREE.Vector3(.58,.18,.12)
    ];
    const sketchAura=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sketchPoints),new THREE.LineBasicMaterial({color:green,transparent:true,opacity:.78}));
    sketchAura.position.z=-.08;g.add(sketchAura);

    // Braços/pernas brancos com luvas e botas pretas: mais personagem, menos boneco genérico.
    for (const side of [-1,1]) {
      const arm = addOutline(new THREE.Mesh(new THREE.CapsuleGeometry(.12,.48,3,5), limbMat));
      arm.position.set(side*.55,1.18,0); arm.rotation.z=side*.20; g.add(arm);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(.13,5,4), mat(ink));
      glove.position.set(side*.66,.90,-.03); g.add(glove);
      const leg = addOutline(new THREE.Mesh(new THREE.CapsuleGeometry(.14,.48,3,5), limbMat));
      leg.position.set(side*.20,.42,0); g.add(leg);
      const boot = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.25,.18,.42), mat(ink)));
      boot.position.set(side*.20,.14,-.08); g.add(boot);
    }

    const gun = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.95), mat(ink)));
    gun.userData.enemyWeapon=true; gun.position.set(.22,1.25,-.52); gun.rotation.x=.10; g.add(gun);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.13), mat(accent));
    muzzle.userData.enemyWeapon=true; muzzle.position.set(.22,1.25,-1.02); muzzle.rotation.x=.10; g.add(muzzle);
    if (elite) {
      const badge = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.48,.18,.07), mat(red)));
      badge.position.set(0,1.55,-.29); g.add(badge);
    }
    g.traverse(o=>{if(o.isLineSegments&&o!==sketchAura&&o.material&&o.material.color){o.material.color.setHex(0x2f7a58);o.material.transparent=false;o.material.opacity=1;o.material.depthTest=true;}});
    scene.add(g);
    const waveHpBonus=Math.floor((wave-1)/2);
    const baseHp=elite?6:3;
    const waveSpeed=Math.min(1.22,1+(wave-1)*.035);
    const e = { group:g, sketchAura, x, z, hp:baseHp+waveHpBonus, maxHp:baseHp+waveHpBonus, elite, variant, speed:(elite?1.15:1.45)*waveSpeed, attack:0, hit:0, dead:false, impactMarks:0, combatStep:0, stepTimer:Math.random()*.35 };
    // Referência direta do dono em cada mesh: evita percorrer grupos inteiros em cada disparo.
    g.traverse(o=>{if(o.isMesh)o.userData.enemyRef=e;});
    enemies.push(e); return e;
  }

  function resetEnemies() {
    for (const e of enemies) scene.remove(e.group);
    enemies.length = 0;
    // Primeira onda fica na metade oposta do mapa para o jogador não nascer cercado.
    makeEnemy(-24, -18, false);
    makeEnemy(-10, -22, false);
    makeEnemy(6, -19, true);
    makeEnemy(15, -14, false);
    makeEnemy(-20, -2, false);
    makeEnemy(20, -4, true);
  }

  function buildHighLookout(){
    const ramp=addOutline(new THREE.Mesh(new THREE.BoxGeometry(7,.28,10),mat(wallLight))); ramp.position.set(10,1.05,-14.5); ramp.rotation.x=Math.atan2(2.1,10); scene.add(ramp);
    for(const side of [-1,1]){ const rail=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.12,1.05,10),mat(ink))); rail.position.set(10+side*3.35,1.55,-14.5); rail.rotation.x=Math.atan2(2.1,10); scene.add(rail); }
    const deck=addOutline(new THREE.Mesh(new THREE.BoxGeometry(7,.35,6),mat(wall))); deck.position.set(10,1.93,-22); scene.add(deck);
    for(const side of [-1,1]){ const rail=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.12,1.1,6),mat(ink))); rail.position.set(10+side*3.35,2.55,-22); scene.add(rail); }
    const beacon=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.20,.20,.75,8),mat(0x52ff6a))); beacon.position.set(10,2.55,-22); scene.add(beacon);
  }
  function buildHighLookoutMirror(){
    const ramp=addOutline(new THREE.Mesh(new THREE.BoxGeometry(7,.28,10),mat(wallLight))); ramp.position.set(-10,1.05,14.5); ramp.rotation.x=-Math.atan2(2.1,10); scene.add(ramp);
    for(const side of [-1,1]){const rail=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.12,1.05,10),mat(ink)));rail.position.set(-10+side*3.35,1.55,14.5);rail.rotation.x=-Math.atan2(2.1,10);scene.add(rail);}
    const deck=addOutline(new THREE.Mesh(new THREE.BoxGeometry(7,.35,6),mat(wall)));deck.position.set(-10,1.93,22);scene.add(deck);
    for(const side of [-1,1]){const rail=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.12,1.1,6),mat(ink)));rail.position.set(-10+side*3.35,2.55,22);scene.add(rail);}
    const beacon=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.20,.20,.75,8),mat(0x52ff6a)));beacon.position.set(-10,2.55,22);scene.add(beacon);
  }
  function buildElevatedRoutes(){
    const rampDeck=(x,z,w,d,height,approachZ,accent)=>{
      const deck=addOutline(new THREE.Mesh(new THREE.BoxGeometry(w,.34,d),mat(accent||wallLight)));
      deck.position.set(x,height-1.87,z); deck.castShadow=true; deck.receiveShadow=true; scene.add(deck);
      const rampLength=Math.abs(approachZ-z)-d/2;
      const ramp=addOutline(new THREE.Mesh(new THREE.BoxGeometry(w*.72,.26,rampLength),mat(woodLight)));
      const rise=height-1.7;
      ramp.position.set(x,rise/2,(approachZ+z+(approachZ>z?d/2:-d/2))/2);
      ramp.rotation.x=(approachZ>z?-1:1)*Math.atan2(rise,rampLength); ramp.castShadow=true; scene.add(ramp);
      for(const side of [-1,1]){
        const rail=box(.12,1.0,d,mat(ink),x+side*(w/2-.12),height-1.18,z,false); props.push(rail);
      }
      return deck;
    };
    // Pares espelhados: os dois times recebem a mesma quantidade de rotas altas.
    rampDeck(-30,-12,7,6,2.75,-3,0xdfe9f4);
    rampDeck(30,12,7,6,2.75,3,0xf3dfd7);
    rampDeck(27,20,8,6,2.35,11,0xf3dfd7);
    rampDeck(-27,-20,8,6,2.35,-11,0xdfe9f4);
    // Ilha elevada central baixa: boa para disputar objetivo sem virar posição dominante.
    const center=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(5.2,6.0,1.45,10),mat(0xe5e1d7)));
    center.position.set(0,.70,12); center.castShadow=true; center.receiveShadow=true; scene.add(center);
    for(let i=0;i<13;i++){
      const a=i/13*TAU;
      const stroke=new THREE.Mesh(new THREE.BoxGeometry(.05,.04,1.25),mat(i%3===0?red:ink));
      stroke.position.set(Math.cos(a)*4.5,1.46,12+Math.sin(a)*4.5); stroke.rotation.y=-a; scene.add(stroke);
    }
    // Escada visual larga na frente da ilha; a física usa uma subida suave na mesma região.
    for(let i=0;i<4;i++) box(4.8,.16+i*.18,.75,mat(woodLight),0,.08+i*.09,18.0-i*.66,false);
  }
  function getPlayerHeight(x,z){
    if(Math.abs(x)<2.6||Math.abs(x-30)<2.6||Math.abs(x+30)<2.6){
      const az=Math.abs(z);
      if(az<=3.5)return 2.20;
      if(az<5.9)return 1.70+(5.9-az)/2.4*.50;
    }
    if(x>6.6 && x<13.4 && z<-10 && z>-19) return 1.7 + ((-z-10)/9)*2.1;
    if(x>6.6 && x<13.4 && z<=-19 && z>-25) return 3.8;
    if(x>-13.4&&x<-6.6&&z>10&&z<19) return 1.7+((z-10)/9)*2.1;
    if(x>-13.4&&x<-6.6&&z>=19&&z<25) return 3.8;
    // Mirante oeste: rampa pelo sul e deck elevado.
    if(x>-32.55&&x<-27.45&&z<-3&&z>-9) return 1.7+((-z-3)/6)*1.05;
    if(x>-33.5&&x<-26.5&&z<=-9&&z>-15) return 2.75;
    // Contraparte espelhada do mirante oeste.
    if(x>27.45&&x<32.55&&z>3&&z<9) return 1.7+((z-3)/6)*1.05;
    if(x>26.5&&x<33.5&&z>=9&&z<15) return 2.75;
    // Plataforma sudeste: acesso pelo norte.
    if(x>24.1&&x<29.9&&z>11&&z<17) return 1.7+((z-11)/6)*.65;
    if(x>23&&x<31&&z>=17&&z<23) return 2.35;
    // Contraparte espelhada da plataforma sudeste.
    if(x>-29.9&&x<-24.1&&z<-11&&z>-17) return 1.7+((-z-11)/6)*.65;
    if(x>-31&&x<-23&&z<=-17&&z>-23) return 2.35;
    // Elevação central com acesso frontal largo.
    const centerDist=Math.hypot(x,z-12);
    if(centerDist<5.25) return 3.15;
    if(Math.abs(x)<2.5&&z>15.3&&z<18.1) return 1.7+(18.1-z)/2.8*1.45;
    return 1.7;
  }

  function buildTacticalCover() {
    // Coberturas leves para quebrar linhas de visao e dar mais leitura de rota.
    const cover=(w,h,d,x,z,accent=false)=>{
      const m=box(w,h,d,mat(accent?blue:woodLight),x,h/2,z,true);
      addHatching(m,Math.max(.3,w*.72),Math.max(.25,h*.68),Math.max(.08,d*.35),3,false);
      props.push(m);
      return m;
    };
    cover(2.8,1.15,.55,-7,14);
    cover(2.2,1.05,.55,7,13);
    cover(3.4,1.1,.55,20,3,true);
    cover(2.6,1.0,.55,-21,5);
    // Pequeno posto de passagem no centro do mapa.
    box(.28,2.8,.28,mat(ink),-.0,1.4,-8,true);
    box(.28,2.8,.28,mat(ink),6,1.4,-8,true);
    box(6.28,.28,.32,3,2.8,-8,false);
    const sign=box(2.4,.55,.10,mat(red),3,2.25,-8,false);
    props.push(sign);
    // Caixas empilhadas criam microcoberturas e deixam o cenário menos vazio.
    for(const [x,z,rot] of [[-24,17,.1],[-22,17,-.08],[24,-16,.15],[26,-16,-.12]]){
      const c=box(.95,.95,.95,mat(woodLight),x,.48,z,true);
      c.rotation.y=rot; addHatching(c,.72,.68,.45,3,true); props.push(c);
    }
  }

  function buildOuterCombatZone(){
    // Expansao leve: novos pontos de interesse ocupam as bordas sem pesar a cena.
    // Posto avancado no nordeste, com abrigo aberto e barricadas.
    for(const [x,z] of [[34,27],[38,27],[34,33],[38,33]]) box(.28,3.2,.28,mat(wood),x,1.6,z,true);
    box(5.2,.24,7.2,mat(wallLight),36,3.15,30,false);
    box(5.5,.22,.35,mat(ink),36,2.75,26.6,false);
    for(const [x,z] of [[31,23],[34,21],[39,22],[42,25],[-35,27],[-39,24],[-34,-27],[-39,-30],[35,-28],[40,-31]]){
      const c=box(2.4,1.05,.62,mat(woodLight),x,.53,z,true); addHatching(c,1.7,.68,.25,3,false); props.push(c);
    }
    // Pequeno deposito aberto no noroeste: paredes baixas, caixas e linha de tiro longa.
    box(7,.24,6,mat(wallLight),-36,.12,31,false);
    box(7,2.2,.32,mat(wall),-36,1.1,34,true);
    box(.32,2.2,6,mat(wall),-39.5,1.1,31,true);
    for(const [x,z] of [[-37,30],[-35.8,30],[-34.6,30],[-37,31.2]]){
      const c=box(.9,.9,.9,mat(woodLight),x,.46,z,true); addHatching(c,.65,.62,.42,3,true); props.push(c);
    }
    // Rochas grandes nas novas bordas funcionam como cobertura natural e referencia visual.
    for(const [x,z,r] of [[-42,10,1.4],[42,11,1.2],[-43,-18,1.5],[43,-14,1.35],[25,40,1.25],[-24,41,1.4]]){
      const rock=addOutline(new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),mat(0x68665f))); rock.position.set(x,r*.55,z); rock.scale.y=.75; rock.castShadow=true; scene.add(rock);
      colliders.push({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r});
    }
  }

  function buildMultiplayerArenaDetails(){
    // Coberturas espelhadas: deixam norte/sul equilibrados para o futuro 3x3 ou 4x4.
    const crateStack=(x,z,flip=1)=>{
      for(const [dx,dy,dz,s] of [[0,.55,0,1.1],[flip*1.0,.55,.12,1.0],[flip*.45,1.55,.05,.92]]){
        const c=box(s,s,s,mat(woodLight),x+dx,dy,z+dz,true);
        c.rotation.y=flip*.08; addHatching(c,s*.68,s*.66,s*.48,3,true); props.push(c);
      }
    };
    // Mantemos caixas apenas nas laterais. Os conjuntos que ficavam em (-11,25) e (11,-27)
    // bloqueavam exatamente a área de aterrissagem dos dois mirantes elevados.
    for(const [x,z,flip] of [[21,10,-1],[-21,-10,1]]) crateStack(x,z,flip);

    // Contêineres riscados formam corredores laterais e pontos de cobertura reconhecíveis.
    for(const [x,z,color] of [[-38,11,blue],[38,-11,red],[-8,-34,red],[8,34,blue]]){
      const body=box(6.2,2.35,2.5,mat(0xf7f4eb),x,1.18,z,true);
      addHatching(body,5.1,1.65,1.26,9,false);
      for(const side of [-1,1]) box(.13,2.18,2.62,mat(color),x+side*3.02,1.18,z,false);
      props.push(body);
    }

    // Dois pórticos altos ajudam na orientação do mapa e criam linhas de tiro sob eles.
    for(const [x,z,color] of [[-14,12,red],[14,-12,blue]]){
      box(.35,4.2,.35,mat(ink),x-2.6,2.1,z,true);
      box(.35,4.2,.35,mat(ink),x+2.6,2.1,z,true);
      const banner=box(5.5,.85,.18,mat(color),x,3.65,z,false);
      addHatching(banner,4.5,.55,.10,6,false); props.push(banner);
    }

    // Barricadas baixas no miolo oferecem avanço em etapas sem fechar completamente as rotas.
    for(const [x,z,r] of [[-7,7,.22],[7,-7,-.22],[-8,-7,-.16],[8,7,.16]]){
      const b=box(3.3,.88,.48,mat(wood),x,.44,z,true); b.rotation.y=r;
      addHatching(b,2.55,.54,.25,4,false); props.push(b);
    }
  }

  function buildTeamSpawnGuides(){
    // Zonas apenas visuais por enquanto; já deixam o mapa legível para a futura lógica de equipes.
    for(const [z,color,label] of [[36,blue,'A'],[-36,red,'B']]){
      const ring=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(5.4,5.4,.10,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.24})));
      ring.position.set(0,.06,z); scene.add(ring);
      for(let i=0;i<4;i++){
        const a=i/4*TAU+.25;
        const pad=box(1.25,.08,1.25,mat(color),Math.cos(a)*3.2,.12,z+Math.sin(a)*3.2,false);
        pad.rotation.y=a; props.push(pad);
      }
      ring.userData.teamSpawn=label;
    }
    // Faróis de tinta simétricos ajudam cada equipe a reconhecer seu lado à distância.
    for(const [z,color] of [[39,blue],[-39,red]]){
      for(const x of [-5.8,5.8]){
        const pole=box(.22,4.5,.22,mat(ink),x,2.25,z,false);props.push(pole);
        const flag=box(1.45,.82,.10,mat(color),x+(x<0?.65:-.65),3.75,z,false);
        addHatching(flag,1.0,.52,.06,3,false);props.push(flag);
      }
    }
    // Ponto central puramente visual, pronto para receber um modo de captura futuramente.
    const objective=new THREE.Mesh(new THREE.TorusGeometry(1.65,.10,7,28),mat(0xd5ad58));
    objective.rotation.x=Math.PI/2;objective.position.set(0,.64,0);scene.add(objective);
    for(let i=0;i<8;i++){
      const a=i/8*TAU;
      const tick=box(.42,.05,.12,mat(i%2?red:blue),Math.cos(a)*2.05,.66,Math.sin(a)*2.05,false);
      tick.rotation.y=-a;props.push(tick);
    }
  }

  function buildInkJumpPads(){
    // Surpresa de mobilidade: dois trampolins de tinta perfeitamente espelhados.
    for(const [x,z,color] of [[18,18,blue],[-18,-18,red]]){
      const pad=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(1.35,1.55,.18,12),mat(color)));
      pad.position.set(x,.10,z);pad.receiveShadow=true;scene.add(pad);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.88,.10,6,20),mat(0xfff0a6));
      ring.rotation.x=Math.PI/2;ring.position.set(x,.23,z);scene.add(ring);
      for(let i=0;i<4;i++){
        const a=i/4*TAU;const arrow=box(.12,.05,.62,mat(ink),x+Math.cos(a)*.72,.25,z+Math.sin(a)*.72,false);
        arrow.rotation.y=-a;props.push(arrow);
      }
    }
  }

  function buildWorld() {
    buildGround(); buildRiver();
    buildBridge(-30); buildBridge(0); buildBridge(30);
    buildHouse(-24, 19);
    buildHouse(24, -19);
    buildHighLookout(); buildHighLookoutMirror();
    buildElevatedRoutes();
    buildDecor(); buildTacticalCover(); buildOuterCombatZone(); buildMultiplayerArenaDetails(); buildTeamSpawnGuides(); buildInkJumpPads();
    // Spawn markers make routes readable without adding artificial walls.
    for (const [x,z] of [[-14,-7],[14,-7]]) {
      const marker = box(1.8,.06,.6,mat(red),x,.08,z,false); marker.rotation.y=Math.PI/2;
    }
  }
  buildWorld(); resetEnemies();

  const weapon = new THREE.Group();
  let weaponMuzzle = null;
  camera.add(weapon); scene.add(camera);
  function buildWeapon() {
    // Rifle de desenho técnico: corpo claro, contorno de caneta, detalhes pretos e uma luneta real em cima.
    const stock = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.38,.26,.72), mat(wallLight)));
    stock.position.set(.44,-.43,-.48); stock.rotation.y=-.05; weapon.add(stock);
    addHatching(stock,.28,.16,.37,3,true);

    const receiver = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.52,.32,1.18), mat(wall)));
    receiver.position.set(.40,-.30,-1.02); weapon.add(receiver);
    addHatching(receiver,.38,.20,.60,4,true);

    const topRail = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.24,.08,.92), mat(ink)));
    topRail.position.set(.40,-.10,-1.08); weapon.add(topRail);

    const barrel = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,1.72,8), mat(ink)));
    barrel.rotation.x = Math.PI/2; barrel.position.set(.40,-.25,-2.16); weapon.add(barrel);
    const muzzleRing = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.14,8), mat(wallLight)));
    muzzleRing.rotation.x = Math.PI/2; muzzleRing.position.set(.40,-.25,-3.00); weapon.add(muzzleRing);
    weaponMuzzle = new THREE.Object3D(); weaponMuzzle.position.set(.40,-.25,-3.09); weapon.add(weaponMuzzle);

    const grip = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.23,.62,.30), mat(wallLight)));
    grip.rotation.x=-.18; grip.position.set(.36,-.68,-.76); weapon.add(grip);
    addHatching(grip,.15,.43,.155,2,false);

    // Fuzil sem luneta: o desenho fica limpo, como a arma simples da referência. O ADS usa somente a câmera.
    const sight = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.05,.20,.05), mat(red)));
    sight.position.set(.40,.12,-1.05); weapon.add(sight);
    weapon.position.set(0,0,0); weapon.rotation.order='XYZ';
    weapon.userData.kind='rifle';
  }
  buildWeapon();

  // Variantes de arma mantidas leves: fuzil, sniper e faca.
  const weaponVariants={rifle:weapon}; const weaponMuzzles={rifle:weaponMuzzle};

  function buildSniper(){
    const g = new THREE.Group();
    g.userData.kind='sniper';
    const stock = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.42,.30,1.05), mat(wallLight)));
    stock.position.set(.40,-.46,-.62); g.add(stock); addHatching(stock,.31,.18,.53,4,true);
    const receiver = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.48,.34,1.32), mat(wall)));
    receiver.position.set(.40,-.30,-1.32); g.add(receiver); addHatching(receiver,.35,.22,.67,5,true);
    const barrel = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,2.05,8), mat(ink)));
    barrel.rotation.x=Math.PI/2; barrel.position.set(.40,-.25,-2.94); g.add(barrel);
    const muzzle = addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.10,.11,.18,8), mat(wallLight)));
    muzzle.rotation.x=Math.PI/2; muzzle.position.set(.40,-.25,-3.95); g.add(muzzle);
    const muzzlePoint = new THREE.Object3D(); muzzlePoint.position.set(.40,-.25,-4.05); g.add(muzzlePoint);
    weaponMuzzles.sniper=muzzlePoint;
    const grip = addOutline(new THREE.Mesh(new THREE.BoxGeometry(.24,.66,.30), mat(wallLight)));
    grip.rotation.x=-.18; grip.position.set(.35,-.70,-1.00); g.add(grip); addHatching(grip,.16,.44,.16,2,false);
    const bipod = new THREE.Group();
    for(const side of [-1,1]){
      const leg=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.07,.48,.08),mat(ink)));
      leg.position.set(.40+side*.13,-.63,-1.90); leg.rotation.z=side*.18; bipod.add(leg);
    }
    g.add(bipod);
    const scopeBody=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.14,.17,.95,10),mat(ink)));
    scopeBody.rotation.x=Math.PI/2; scopeBody.position.set(.40,.00,-1.34); g.add(scopeBody);
    for(const z of [-1.78,-.91]){
      const ring=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.10,10),mat(wallLight)));
      ring.rotation.x=Math.PI/2; ring.position.set(.40,.00,z); g.add(ring);
    }
    const lens=new THREE.Mesh(new THREE.CircleGeometry(.11,16),new THREE.MeshBasicMaterial({color:0x1c2735,transparent:true,opacity:.22,depthWrite:false}));
    lens.rotation.x=-Math.PI/2; lens.position.set(.40,.00,-1.83); lens.userData.sniperLens=true; g.add(lens);
    g.position.set(0,0,0); g.rotation.order='XYZ';
    camera.add(g); weaponVariants.sniper=g;
  }

  function buildSmg(){
    const g=new THREE.Group(); g.userData.kind='smg';
    const body=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.44,.30,.92),mat(wall))); body.position.set(.42,-.34,-1.00); g.add(body); addHatching(body,.31,.18,.45,3,true);
    const stock=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.26,.22,.55),mat(wallLight))); stock.position.set(.42,-.43,-.38); stock.rotation.x=-.06; g.add(stock);
    const barrel=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.052,.062,.88,8),mat(ink))); barrel.rotation.x=Math.PI/2; barrel.position.set(.42,-.30,-1.88); g.add(barrel);
    const muzzle=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.075,.08,.12,8),mat(wallLight))); muzzle.rotation.x=Math.PI/2; muzzle.position.set(.42,-.30,-2.32); g.add(muzzle);
    const muzzlePoint=new THREE.Object3D(); muzzlePoint.position.set(.42,-.30,-2.40); g.add(muzzlePoint); weaponMuzzles.smg=muzzlePoint;
    const grip=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.20,.52,.25),mat(ink))); grip.rotation.x=-.16; grip.position.set(.39,-.67,-.80); g.add(grip);
    const mag=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.20,.56,.28),mat(blue))); mag.rotation.x=.12; mag.position.set(.42,-.66,-1.20); g.add(mag);
    const sight=new THREE.Mesh(new THREE.BoxGeometry(.045,.14,.045),mat(red)); sight.position.set(.42,-.08,-1.35); g.add(sight);
    g.position.set(0,0,0); g.rotation.order='XYZ'; camera.add(g); weaponVariants.smg=g;
  }

  function buildShotgun(){
    const g=new THREE.Group(); g.userData.kind='shotgun';
    const stock=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.34,.30,.92),mat(woodLight))); stock.position.set(.43,-.43,-.44); stock.rotation.x=-.05; g.add(stock); addHatching(stock,.24,.18,.44,3,false);
    const receiver=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.46,.34,.92),mat(wall))); receiver.position.set(.42,-.31,-1.12); g.add(receiver); addHatching(receiver,.33,.21,.46,3,true);
    const barrel=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.075,.085,2.15,8),mat(ink))); barrel.rotation.x=Math.PI/2; barrel.position.set(.42,-.27,-2.60); g.add(barrel);
    const pump=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.34,.28,.70),mat(wood))); pump.position.set(.42,-.36,-2.02); g.add(pump); addHatching(pump,.24,.17,.35,3,false);
    const muzzle=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.14,8),mat(wallLight))); muzzle.rotation.x=Math.PI/2; muzzle.position.set(.42,-.27,-3.68); g.add(muzzle);
    const muzzlePoint=new THREE.Object3D(); muzzlePoint.position.set(.42,-.27,-3.78); g.add(muzzlePoint); weaponMuzzles.shotgun=muzzlePoint;
    const sight=new THREE.Mesh(new THREE.SphereGeometry(.035,6,4),mat(red)); sight.position.set(.42,-.08,-2.55); g.add(sight);
    g.position.set(0,0,0); g.rotation.order='XYZ'; camera.add(g); weaponVariants.shotgun=g;
  }

  function buildLauncher(){
    const g=new THREE.Group(); g.userData.kind='launcher';
    const tube=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,1.95,10),mat(wallLight))); tube.rotation.x=Math.PI/2; tube.position.set(.40,-.30,-1.45); g.add(tube);
    const rear=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.22,10),mat(ink))); rear.rotation.x=Math.PI/2; rear.position.set(.40,-.30,-.48); g.add(rear);
    const front=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.21,.18,.26,10),mat(ink))); front.rotation.x=Math.PI/2; front.position.set(.40,-.30,-2.43); g.add(front);
    const grip=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.22,.58,.30),mat(ink))); grip.rotation.x=-.16; grip.position.set(.38,-.66,-1.14); g.add(grip);
    const sight=new THREE.Mesh(new THREE.BoxGeometry(.06,.18,.06),mat(red)); sight.position.set(.40,-.05,-1.58); g.add(sight);
    const muzzlePoint=new THREE.Object3D(); muzzlePoint.position.set(.40,-.30,-2.62); g.add(muzzlePoint); weaponMuzzles.launcher=muzzlePoint;
    g.position.set(0,0,0); g.rotation.order='XYZ'; camera.add(g); weaponVariants.launcher=g;
  }

  function buildKnife(){
    const g = new THREE.Group();
    g.userData.kind='knife';
    const handle=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.18,.42,.48),mat(black)));
    handle.position.set(.47,-.60,-.52); handle.rotation.z=-.10; g.add(handle);
    const bladeShape=new THREE.Shape();
    bladeShape.moveTo(0,0); bladeShape.lineTo(.16,.08); bladeShape.lineTo(.18,.72); bladeShape.lineTo(.04,1.08); bladeShape.lineTo(-.02,.68); bladeShape.lineTo(-.02,.12); bladeShape.closePath();
    const bladeGeo=new THREE.ExtrudeGeometry(bladeShape,{depth:.055,bevelEnabled:false});
    const blade=addOutline(new THREE.Mesh(bladeGeo,mat(wallLight)));
    blade.rotation.y=Math.PI/2; blade.rotation.z=-.10; blade.position.set(.39,-.37,-.98); g.add(blade);
    addHatching(blade,.12,.55,.04,4,false);
    g.position.set(0,0,0); g.rotation.order='XYZ';
    camera.add(g); weaponVariants.knife=g;
  }
  buildSniper(); buildSmg(); buildShotgun(); buildLauncher(); buildKnife();
  weaponVariants.sniper.visible=false; weaponVariants.smg.visible=false; weaponVariants.shotgun.visible=false; weaponVariants.launcher.visible=false; weaponVariants.knife.visible=false;

  function setWeaponMode(mode){
    reloadToken++;
    weaponMode=mode;
    for(const key of weaponModes) weaponVariants[key].visible=(key===mode);
    scopeMode=false; adsProgress=0; fireCooldown=0; reloadTimer=0;
    if(mode!=='knife') ammo=Math.min(MAGAZINES[mode],reserveAmmo[mode]+ammo);
    if(mode==='knife') ammo=0;
    reloadBtn.style.display=mode==='knife'?'none':'block';
    reloadBtn.textContent='RECARREGAR';
    const labels={rifle:'FUZIL',sniper:'SNIPER',smg:'SUBMETRALHADORA',shotgun:'ESPINGARDA',launcher:'LANÇA-FOGOS',knife:'FACA'};
    weaponSwitchBtn.textContent='ARMA: '+labels[mode];
    weaponSwitchBtn.style.background=mode==='sniper'?'rgba(49,94,155,.9)':mode==='knife'?'rgba(215,53,53,.82)':'rgba(238,231,212,.82)';
    weaponSwitchBtn.style.color=mode==='sniper'||mode==='knife'?'#fff':'#171510';
    scopeBtn.style.display=(mode==='rifle'||mode==='sniper')?'block':'none';
  }

  const scopeBtn = document.createElement('button');
  scopeBtn.id='scopeControl';
  scopeBtn.textContent='MIRA';
  scopeBtn.style.cssText='position:fixed;right:132px;bottom:28px;width:82px;height:82px;border:3px solid #171510;border-radius:50%;background:rgba(238,231,212,.82);color:#171510;font:700 15px Georgia;z-index:8;pointer-events:auto;touch-action:none;box-shadow:4px 4px 0 rgba(23,21,16,.16);';
  document.body.appendChild(scopeBtn);

  // Editor de HUD: cada jogador pode arrastar os controles e a posição fica salva no aparelho.
  const layoutBtn=document.createElement('button');
  layoutBtn.textContent='⚙ BOTÕES';
  layoutBtn.style.cssText='position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:22;padding:8px 12px;border:2px solid #171510;border-radius:10px;background:rgba(238,231,212,.92);color:#171510;font:700 12px Georgia;pointer-events:auto;display:none';
  document.body.appendChild(layoutBtn);
  const layoutTip=document.createElement('div');
  layoutTip.textContent='ARRASTE OS BOTÕES • TOQUE EM SALVAR QUANDO TERMINAR';
  layoutTip.style.cssText='position:fixed;left:50%;top:54px;transform:translateX(-50%);z-index:21;padding:7px 12px;border:2px solid #171510;background:#fff7dc;color:#171510;font:700 12px Georgia;display:none;white-space:nowrap;pointer-events:none';
  document.body.appendChild(layoutTip);
  const movableControls=[stick,fireBtn,fireLeftBtn,weaponSwitchBtn,reloadBtn,scopeBtn,jumpBtn].filter(Boolean);
  for(const el of movableControls){
    el.style.userSelect='none';el.style.webkitUserSelect='none';el.style.webkitTouchCallout='none';
    el.style.touchAction='none';el.setAttribute('draggable','false');
  }
  const isGameControl=target=>movableControls.some(el=>el===target||el.contains(target));
  document.addEventListener('selectstart',e=>{if(isGameControl(e.target))e.preventDefault();});
  document.addEventListener('contextmenu',e=>{if(isGameControl(e.target))e.preventDefault();});
  document.addEventListener('dragstart',e=>{if(isGameControl(e.target))e.preventDefault();});
  const defaultControlPlacement=new Map(movableControls.map(el=>[el,{position:el.style.position,left:el.style.left,top:el.style.top,right:el.style.right,bottom:el.style.bottom}]));
  const savedLayout=JSON.parse(localStorage.getItem('inkopsControlLayout')||'{}');
  function placeControl(el,pos){
    const w=el.offsetWidth||72,h=el.offsetHeight||52;
    const left=Math.max(4,Math.min(innerWidth-w-4,(pos.x??0)*Math.max(1,innerWidth-w)));
    const top=Math.max(4,Math.min(innerHeight-h-4,(pos.y??0)*Math.max(1,innerHeight-h)));
    el.style.position='fixed';el.style.left=left+'px';el.style.top=top+'px';el.style.right='auto';el.style.bottom='auto';
  }
  for(const el of movableControls) if(savedLayout[el.id]) placeControl(el,savedLayout[el.id]);
  let movingControl=null,movingOffsetX=0,movingOffsetY=0;
  for(const el of movableControls){
    el.addEventListener('pointerdown',e=>{
      if(!controlsEditing)return;
      e.preventDefault();e.stopImmediatePropagation();
      const r=el.getBoundingClientRect();movingControl=el;movingOffsetX=e.clientX-r.left;movingOffsetY=e.clientY-r.top;
      el.setPointerCapture?.(e.pointerId);el.style.outline='4px dashed #d73535';
    },true);
  }
  window.addEventListener('pointermove',e=>{
    if(!controlsEditing||!movingControl)return;
    e.preventDefault();
    const w=movingControl.offsetWidth,h=movingControl.offsetHeight;
    const left=Math.max(4,Math.min(innerWidth-w-4,e.clientX-movingOffsetX));
    const top=Math.max(4,Math.min(innerHeight-h-4,e.clientY-movingOffsetY));
    movingControl.style.position='fixed';movingControl.style.left=left+'px';movingControl.style.top=top+'px';movingControl.style.right='auto';movingControl.style.bottom='auto';
  },{passive:false});
  window.addEventListener('pointerup',()=>{
    if(!movingControl)return;
    const r=movingControl.getBoundingClientRect();
    savedLayout[movingControl.id]={x:r.left/Math.max(1,innerWidth-r.width),y:r.top/Math.max(1,innerHeight-r.height)};
    localStorage.setItem('inkopsControlLayout',JSON.stringify(savedLayout));
    movingControl.style.outline='';movingControl=null;
  });
  layoutBtn.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();controlsEditing=!controlsEditing;
    layoutBtn.textContent=controlsEditing?'SALVAR POSIÇÕES':'⚙ BOTÕES';
    layoutTip.style.display=controlsEditing?'block':'none';
    for(const el of movableControls) el.style.filter=controlsEditing?'drop-shadow(0 0 5px #d73535)':'';
  });
  const resetLayoutBtn=document.createElement('button');
  resetLayoutBtn.textContent='RESTAURAR PADRÃO';
  resetLayoutBtn.style.cssText='position:fixed;left:50%;top:88px;transform:translateX(-50%);z-index:22;padding:7px 10px;border:2px solid #171510;border-radius:9px;background:#f3dfd7;color:#171510;font:700 11px Georgia;pointer-events:auto;display:none';
  document.body.appendChild(resetLayoutBtn);
  resetLayoutBtn.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();localStorage.removeItem('inkopsControlLayout');
    for(const el of movableControls){const d=defaultControlPlacement.get(el);Object.assign(el.style,d);delete savedLayout[el.id];}
  });
  const updateLayoutTools=()=>{resetLayoutBtn.style.display=controlsEditing?'block':'none';};
  layoutBtn.addEventListener('pointerdown',updateLayoutTools);

  // Visor da sniper: o centro é totalmente transparente para nunca esconder o cenário.
  // Só as bordas da lente e a cruz ficam sobre a imagem. Assim parece uma luneta de verdade,
  // mas sem repetir o bug anterior de uma máscara opaca bloqueando a visão.
  const sniperScope = document.createElement('div');
  sniperScope.style.cssText='position:fixed;inset:0;z-index:7;pointer-events:none;display:none;opacity:0;transition:opacity .08s;overflow:hidden;';
  const lensShade = document.createElement('div');
  lensShade.style.cssText='position:absolute;inset:0;background:radial-gradient(circle at center,rgba(0,0,0,0) 0%,rgba(0,0,0,0) 43%,rgba(8,13,18,.22) 44%,rgba(8,13,18,.78) 57%,rgba(8,13,18,.94) 100%);';
  sniperScope.appendChild(lensShade);
  const lensRing = document.createElement('div');
  lensRing.style.cssText='position:absolute;left:50%;top:50%;width:min(92vw,92vh);height:min(92vw,92vh);transform:translate(-50%,-50%);border:3px solid rgba(18,25,31,.88);border-radius:50%;box-shadow:0 0 0 2px rgba(244,241,229,.35),inset 0 0 34px rgba(0,0,0,.42);';
  sniperScope.appendChild(lensRing);
  const scopeReticle=document.createElement('div');
  scopeReticle.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;';
  const retH=document.createElement('div');
  retH.style.cssText='position:absolute;width:min(68vw,68vh);height:2px;background:rgba(24,28,30,.9);box-shadow:0 0 0 1px rgba(244,241,229,.28);';
  const retV=document.createElement('div');
  retV.style.cssText='position:absolute;height:min(68vw,68vh);width:2px;background:rgba(24,28,30,.9);box-shadow:0 0 0 1px rgba(244,241,229,.28);';
  const retDot=document.createElement('div');
  retDot.style.cssText='position:absolute;width:7px;height:7px;border:2px solid rgba(24,28,30,.95);border-radius:50%;background:rgba(244,241,229,.55);box-shadow:0 0 0 1px rgba(255,255,255,.28);';
  scopeReticle.append(retH,retV,retDot);
  sniperScope.appendChild(scopeReticle);
  const rangeMarks=document.createElement('div');
  rangeMarks.textContent='·   ·   ·   ·   ·';
  rangeMarks.style.cssText='position:absolute;left:50%;top:calc(50% + min(16vw,16vh));transform:translateX(-50%);font:700 18px Georgia,serif;letter-spacing:10px;color:rgba(20,25,29,.86);text-shadow:0 0 2px rgba(255,255,255,.5);';
  sniperScope.appendChild(rangeMarks);
  document.body.appendChild(sniperScope);

  function toggleScope() {
    if (!running || weaponMode==='knife') return;
    scopeMode=!scopeMode;
    scopeBtn.style.background=scopeMode?'rgba(49,94,155,.9)':'rgba(238,231,212,.82)';
    scopeBtn.style.color=scopeMode?'#fff':'#171510';
    centerEl.style.opacity=scopeMode&&weaponMode==='sniper'?'0':'1';
  }
  scopeBtn.addEventListener('pointerdown', e=>{
    e.preventDefault(); e.stopPropagation();
    if(!running||weaponMode==='knife')return;
    scopeMode=true;scopeBtn._look={id:e.pointerId,x:e.clientX,y:e.clientY};
    scopeBtn.setPointerCapture?.(e.pointerId);
    scopeBtn.style.background='rgba(49,94,155,.9)'; scopeBtn.style.color='#fff';
    if(weaponMode==='rifle'){fireHeld=true;shoot();}
  });
  scopeBtn.addEventListener('pointermove', e=>{
    if(!scopeBtn._look || e.pointerId!==scopeBtn._look.id) return;
    const dx=e.clientX-scopeBtn._look.x, dy=e.clientY-scopeBtn._look.y;
    if(Math.abs(dx)+Math.abs(dy)>2){
      look(dx,dy,.0036);
      scopeBtn._look.x=e.clientX; scopeBtn._look.y=e.clientY;
    }
  });
  scopeBtn.addEventListener('pointermove', e=>{
    if(!scopeBtn._look || e.pointerId!==scopeBtn._look.id)return;
    const dx=e.clientX-scopeBtn._look.x, dy=e.clientY-scopeBtn._look.y;
    if(Math.abs(dx)+Math.abs(dy)>2){
      look(dx,dy,.0036);
      scopeBtn._look.x=e.clientX;
      scopeBtn._look.y=e.clientY;
    }
  });
  scopeBtn.addEventListener('pointerup', e=>{
    e.preventDefault(); e.stopPropagation();
    if(weaponMode==='sniper'){ shoot(); }
    fireHeld=false;scopeBtn._look=null;
    scopeMode=false;
    scopeBtn.style.background='rgba(238,231,212,.82)'; scopeBtn.style.color='#171510';
  });
  scopeBtn.addEventListener('pointercancel', e=>{
    e.preventDefault(); e.stopPropagation();
    fireHeld=false; scopeMode=false;
    scopeBtn.style.background='rgba(238,231,212,.82)'; scopeBtn.style.color='#171510';
  });
  weaponSwitchBtn.addEventListener('pointerdown', e=>{
    e.preventDefault(); e.stopPropagation();
    if(!running)return;
    const next=weaponModes[(weaponModes.indexOf(weaponMode)+1)%weaponModes.length];
    setWeaponMode(next);
  });

  function initAudio(){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!audioCtx&&AC) audioCtx=new AC();
    if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
  }

  // Tiro procedural: não depende de arquivo externo. O estouro curto de ruído + grave + estalo
  // dá uma assinatura próxima de um rifle automático, e o sniper recebe um disparo mais seco e pesado.
  function noiseBurst(duration=.12, volume=.42, low=700, high=4200){
    if(!audioCtx)return;
    const now=audioCtx.currentTime;
    const buffer=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*duration),audioCtx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
    const src=audioCtx.createBufferSource(), filter=audioCtx.createBiquadFilter(), gain=audioCtx.createGain();
    filter.type='bandpass'; filter.frequency.value=(low+high)*.5; filter.Q.value=.55;
    gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(volume,now+.002); gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    src.buffer=buffer; src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination); src.start(now); src.stop(now+duration);
  }
  function shotSound(kind=weaponMode){
    initAudio(); if(!audioCtx)return;
    const now=audioCtx.currentTime;
    if(kind==='smg'){
      noiseBurst(.065,.42,1200,5600);
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='square'; o.frequency.setValueAtTime(145,now); o.frequency.exponentialRampToValueAtTime(62,now+.07);
      g.gain.setValueAtTime(.20,now); g.gain.exponentialRampToValueAtTime(.0001,now+.075); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.08);
      noiseBurst(.025,.18,3300,8200);
    }else if(kind==='launcher'){
      // Saída do foguete: sopro/assobio curto. O estrondo pesado acontece somente no impacto.
      noiseBurst(.13,.46,420,2600);
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(170,now);o.frequency.exponentialRampToValueAtTime(54,now+.20);
      g.gain.setValueAtTime(.25,now);g.gain.exponentialRampToValueAtTime(.0001,now+.22);o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+.23);
    }else if(kind==='shotgun'){
      noiseBurst(.16,.68,420,3000);
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(92,now); o.frequency.exponentialRampToValueAtTime(36,now+.18);
      g.gain.setValueAtTime(.42,now); g.gain.exponentialRampToValueAtTime(.0001,now+.20); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.21);
      noiseBurst(.05,.30,2500,6800);
    }else if(kind==='rifle'){
      noiseBurst(.10,.55,850,4800);
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(115,now); o.frequency.exponentialRampToValueAtTime(48,now+.11);
      g.gain.setValueAtTime(.32,now); g.gain.exponentialRampToValueAtTime(.0001,now+.12); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.13);
      noiseBurst(.035,.24,2800,7600);
    }else if(kind==='sniper'){
      noiseBurst(.18,.72,500,3600);
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(72,now); o.frequency.exponentialRampToValueAtTime(32,now+.24);
      g.gain.setValueAtTime(.5,now); g.gain.exponentialRampToValueAtTime(.0001,now+.26); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.27);
      noiseBurst(.045,.28,3600,9000);
    }else{
      noiseBurst(.18,.20,450,1800);
    }
  }
  function hitSound(headshot=false){
    initAudio(); if(!audioCtx)return;
    const now=audioCtx.currentTime;
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=headshot?'triangle':'square';
    o.frequency.setValueAtTime(headshot?1180:680,now);
    o.frequency.exponentialRampToValueAtTime(headshot?520:240,now+.055);
    g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(headshot?.22:.16,now+.003); g.gain.exponentialRampToValueAtTime(.0001,now+.065);
    o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.07);
    noiseBurst(headshot?.035:.025,headshot?.14:.095,headshot?2200:900,headshot?6200:3400);
  }

  function inkSplatSound(){
    initAudio();if(!audioCtx)return;
    const now=audioCtx.currentTime;noiseBurst(.055,.13,120,820);
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';
    o.frequency.setValueAtTime(240,now);o.frequency.exponentialRampToValueAtTime(72,now+.13);
    g.gain.setValueAtTime(.16,now);g.gain.exponentialRampToValueAtTime(.0001,now+.14);
    o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+.15);
  }

  function footstepSound(volume=.12,pitch=105){
    initAudio(); if(!audioCtx)return;
    const now=audioCtx.currentTime;
    noiseBurst(.045,volume*.55,120,950);
    const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='triangle';
    o.frequency.setValueAtTime(pitch,now); o.frequency.exponentialRampToValueAtTime(Math.max(48,pitch*.55),now+.05);
    g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(volume,now+.003); g.gain.exponentialRampToValueAtTime(.0001,now+.055);
    o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.06);
  }

  function knifeSound(){
    if(!audioCtx)return;
    const now=audioCtx.currentTime;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(700,now); o.frequency.exponentialRampToValueAtTime(170,now+.18);
    g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(.18,now+.018); g.gain.exponentialRampToValueAtTime(.0001,now+.20); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.21);
  }

  function blocked(x,z) {
    const r=player.radius;
    // Mantém todos dentro da folha/mapa; importante para partidas futuras entre equipes.
    if(Math.abs(x)>45.2-r||Math.abs(z)>45.2-r)return true;
    // River is not walkable except across the two actual bridges.
    const inWater=Math.abs(z)<3.45;
    const atCrossing=Math.abs(x+30)<2.6||Math.abs(x)<2.6||Math.abs(x-30)<2.6;
    const onBridge=atCrossing&&Math.abs(z)<5.9;
    if(inWater&&!onBridge)return true;
    // Corredor livre antes de cada rampa: impede ficar preso entre cobertura, margem e ponte.
    if(atCrossing&&Math.abs(z)>=4.8&&Math.abs(z)<7.1)return false;
    // Áreas livres nas duas saídas dos mirantes: o jogador pode cair ou descer sem ficar preso.
    const lookoutLanding=(Math.abs(x-10)<4.4&&z<-25&&z>-30)||(Math.abs(x+10)<4.4&&z>25&&z<30);
    if(lookoutLanding)return false;
    const feetY=player.pos.y-1.7;
    for(const c of colliders){
      // Coberturas baixas podem ser superadas com um pulo; paredes sem altura declarada continuam sólidas.
      if(c.height!=null && feetY>c.height-.08) continue;
      if(x+r>c.minX&&x-r<c.maxX&&z+r>c.minZ&&z-r<c.maxZ)return true;
    }
    return false;
  }
  function move(dx,dz){
    const nx=player.pos.x+dx,nz=player.pos.z+dz;
    if(!blocked(nx,player.pos.z))player.pos.x=nx;
    if(!blocked(player.pos.x,nz))player.pos.z=nz;
  }

  function look(dx,dy,sensitivity=.0026){
    // ADS reduz a sensibilidade para facilitar acompanhar um alvo, mantendo o movimento natural.
    const aimScale = scopeMode ? .58 : 1;
    sensitivity *= aimScale;
    player.yaw -= dx*sensitivity;
    player.pitch -= dy*sensitivity;
    player.pitch=Math.max(-1.28,Math.min(1.28,player.pitch));
  }

  function reloadWeapon(){
    if(!running||weaponMode==='knife'||reloadTimer>0)return;
    const reloadMode=weaponMode;
    const max=MAGAZINES[reloadMode];
    const reserve=reserveAmmo[reloadMode];
    if(ammo>=max||reserve<=0)return;
    const token=++reloadToken;
    reloadTimer=reloadMode==='sniper'?1.35:(reloadMode==='launcher'?1.55:(reloadMode==='shotgun'?1.10:(reloadMode==='smg'?.82:.95)));
    reloadBtn.textContent='RECARREGANDO...';
    setTimeout(()=>{
      if(!running||token!==reloadToken||weaponMode!==reloadMode)return;
      const need=max-ammo;
      const take=Math.min(need,reserveAmmo[reloadMode]);
      ammo+=take; reserveAmmo[reloadMode]-=take; reloadTimer=0;
      reloadBtn.textContent='RECARREGAR'; updateHud();
    },reloadMode==='sniper'?1350:(reloadMode==='launcher'?1550:(reloadMode==='shotgun'?1100:(reloadMode==='smg'?820:950))));
  }

  function shoot(){
    if(!running||reloadTimer>0||fireCooldown>0||(!multiplayer.selfAlive&&multiplayer.room?.status==='playing'))return;
    initAudio();
    if(weaponMode!=='knife' && ammo<=0)return;

    const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ')).normalize();
    const range=weaponMode==='knife'?2.55:(weaponMode==='sniper'?95:(weaponMode==='launcher'?52:(weaponMode==='rifle'?62:(weaponMode==='shotgun'?26:48))));
    raycaster.set(camera.position,dir); raycaster.far=range;

    const enemyMeshes=[];
    for(const e of enemies) if(!e.dead) e.group.traverse(o=>{if(o.isMesh)enemyMeshes.push(o);});
    const worldMeshes=[];
    scene.traverse(o=>{
      if(!o.isMesh || o.userData.noBulletMark) return;
      let underWeapon=false;
      for(const v of Object.values(weaponVariants)) v.traverse(w=>{if(w===o)underWeapon=true;});
      if(!underWeapon) worldMeshes.push(o);
    });
    const enemyHits=raycaster.intersectObjects(enemyMeshes,false);
    const worldHits=raycaster.intersectObjects(worldMeshes,false);
    const hit=enemyHits.length && (!worldHits.length || enemyHits[0].distance<=worldHits[0].distance) ? enemyHits[0] : worldHits[0];

    if(weaponMode==='knife'){
      fireCooldown=.55; knifeSwing=1; knifeSound();
      if(hit && hit.distance<=2.55){
        const remoteToken=hit.object.userData?.remoteToken;
        if(remoteToken){reportRemoteHit(remoteToken,100,hit.object.userData?.hitZone==='head');hitSound(false);hitNoticeEl.textContent='CORTE DE TINTA!';hitNoticeEl.classList.add('show');hitNoticeTimer=.62;updateHud();return;}
        const target=hit.object.userData?.enemyRef || null;
        const impactMark=addImpactMark(hit);
        if(target){
          const headshot=hit.object.userData?.hitZone==='head';
          const damage=headshot?8:4;
          target.hp-=damage; target.hit=.30;
          hitSound(headshot);
          hitNoticeEl.textContent=headshot?'HEADSHOT!  -'+damage:'CORTE  -'+damage;
          hitNoticeEl.classList.add('show'); hitNoticeTimer=.62;
          impactMark.scale.setScalar(headshot?1.35:1.05);
          if(target.hp<=0){target.dead=true;kills++;score+=target.elite?30:10;scene.remove(target.group);}
        }
      }
      updateHud(); return;
    }

    const isSniper=weaponMode==='sniper';
    fireCooldown=weaponMode==='sniper'?1.65:(weaponMode==='launcher'?1.15:(weaponMode==='shotgun'?.72:(weaponMode==='smg'?.075:.12)));
    ammo--;
    player.recoil=isSniper?.25:(weaponMode==='launcher'?.62:(weaponMode==='shotgun'?.72:(weaponMode==='smg'?.105:(weaponMode==='rifle'?(scopeMode?.23:.18):.16))));
    weaponKick=isSniper?.1:(weaponMode==='launcher'?.22:(weaponMode==='shotgun'?.24:(weaponMode==='smg'?.038:.055)));
    // O fuzil dá uma pequena aproximação mesmo sem apertar MIRA, como uma reação natural ao disparo.
    // É curta e volta sozinha para não transformar o tiro comum em ADS.
    fireZoom=isSniper?0:1;
    shotSound(weaponMode);

    const tracerEnd=hit?hit.point:camera.position.clone().addScaledVector(dir,range);
    const activeMuzzle=weaponMuzzles[weaponMode];
    const muzzleWorld=activeMuzzle ? activeMuzzle.getWorldPosition(new THREE.Vector3()) : camera.position.clone();
    if(weaponMode==='launcher'){
      // O destino é definido no disparo. Como o foguete leva tempo para chegar,
      // inimigos e futuros jogadores podem sair da área antes da explosão.
      launchRocket(muzzleWorld,dir,muzzleWorld.distanceTo(tracerEnd));
      if(ammo===0)reloadWeapon();updateHud();return;
    }
    if(weaponMode==='shotgun'){
      // Onze microdisparos formam um cone de tinta maior. Cada raio respeita paredes,
      // distância e partes do corpo; juntos criam o dano característico da espingarda.
      const right=new THREE.Vector3(1,0,0).applyEuler(camera.rotation).normalize();
      const up=new THREE.Vector3(0,1,0).applyEuler(camera.rotation).normalize();
      const pelletPattern=[[0,0]];
      for(let i=0;i<8;i++){const a=i/8*TAU;pelletPattern.push([Math.cos(a)*.047,Math.sin(a)*.047]);}
      pelletPattern.push([-.078,.012],[.078,-.012]);
      const damageByEnemy=new Map(),damageByRemote=new Map();let blotPoint=tracerEnd.clone(),anyHeadshot=false;
      for(let i=0;i<pelletPattern.length;i++){
        const [sx,sy]=pelletPattern[i];
        const pelletDir=dir.clone().addScaledVector(right,sx).addScaledVector(up,sy).normalize();
        raycaster.set(camera.position,pelletDir);raycaster.far=range;
        const eh=raycaster.intersectObjects(enemyMeshes,false);
        const wh=raycaster.intersectObjects(worldMeshes,false);
        const ph=eh.length&&(!wh.length||eh[0].distance<=wh[0].distance)?eh[0]:wh[0];
        const end=ph?ph.point:camera.position.clone().addScaledVector(pelletDir,range);
        addTracer(muzzleWorld,end);
        if(i===0)blotPoint.copy(end);
        const target=ph?.object?.userData?.enemyRef||null;
        const remoteToken=ph?.object?.userData?.remoteToken||null;
        if(remoteToken&&ph.distance<=15){const head=ph.object.userData?.hitZone==='head';const pelletDamage=(ph.distance<=7?12:(ph.distance<=11?8:4))*(head?1.35:1);damageByRemote.set(remoteToken,(damageByRemote.get(remoteToken)||0)+pelletDamage);anyHeadshot=anyHeadshot||head;}
        if(target&&ph.distance<=15){
          const head=ph.object.userData?.hitZone==='head';
          const pelletDamage=(ph.distance<=7?1.4:(ph.distance<=11?.85:.45))*(head?1.65:1);
          const record=damageByEnemy.get(target)||{damage:0,head:false};
          record.damage+=pelletDamage;record.head=record.head||head;damageByEnemy.set(target,record);
          anyHeadshot=anyHeadshot||head;
        }
      }
      createShotgunInkBlot(blotPoint);
      let totalDamage=0;
      for(const [target,record] of damageByEnemy){
        const damage=Math.max(1,Math.round(record.damage));totalDamage+=damage;
        target.hp-=damage;target.hit=.34;
        if(target.hp<=0){target.dead=true;kills++;score+=target.elite?30:10;scene.remove(target.group);}
      }
      for(const [remoteToken,remoteDamage] of damageByRemote){const damage=Math.min(100,Math.max(1,Math.round(remoteDamage)));totalDamage+=damage;reportRemoteHit(remoteToken,damage,anyHeadshot);}
      if(totalDamage>0)hitSound(anyHeadshot);
      if(anyHeadshot){headshots++;score+=3;}
      hitNoticeEl.textContent=totalDamage>0?(anyHeadshot?'PLOFT HEADSHOT!  -'+totalDamage:'PLOFT!  -'+totalDamage):'PLOFT!';
      hitNoticeEl.classList.add('show');hitNoticeTimer=.68;
      if(ammo===0)reloadWeapon();updateHud();return;
    }
    addTracer(muzzleWorld,tracerEnd);
    if(hit){
      const remoteToken=hit.object.userData?.remoteToken;
      if(remoteToken){
        const headshot=hit.object.userData?.hitZone==='head';
        const damage=isSniper?(headshot?100:75):(weaponMode==='smg'?(headshot?22:14):(headshot?38:24));
        reportRemoteHit(remoteToken,damage,headshot);hitSound(headshot);hitNoticeEl.textContent=headshot?'RABISCOU A CABEÇA!  -'+damage:'ACERTOU!  -'+damage;hitNoticeEl.classList.add('show');hitNoticeTimer=.65;
      }
      const target=hit.object.userData?.enemyRef || null;
      const impactMark=addImpactMark(hit);
      if(target && weaponMode!=='launcher'){
        const headshot=hit.object.userData?.hitZone==='head';
        let damage=isSniper?(headshot?12:6):(weaponMode==='shotgun'?(headshot?9:6):(weaponMode==='smg'?(headshot?2:1):(headshot?4:2)));
        if(weaponMode==='shotgun'){
          const d=hit.distance;
          // Espingarda: devastadora perto, cai forte no médio alcance e não causa dano de longe.
          if(d>15) damage=0;
          else if(d>10) damage=headshot?2:1;
          else if(d>6.5) damage=headshot?5:3;
        }
        if(damage>0) target.hp-=damage; target.hit=isSniper?.30:.22;
        if(damage>0) hitSound(headshot);
        if(headshot && damage>0){
          headshots++; score+=3;
          hitNoticeEl.textContent='HEADSHOT!  -'+damage+'  +3 PTS';
          hitNoticeEl.classList.add('show'); hitNoticeTimer=.72; impactMark.scale.setScalar(isSniper?1.5:1.28);
        }
        if(target.hp<=0){target.dead=true;kills++;score+=target.elite?30:10;scene.remove(target.group);}
      }
    }
    if(ammo===0){
      reloadWeapon();
    }
    updateHud();
  }

  function updateHud(){
    hpEl.style.width=Math.max(0,hp)+'%';
    if(armorEl) armorEl.style.width=Math.max(0,Math.min(100,armor))+'%';
    ammoEl.textContent=weaponMode==='knife'?'—':ammo+' / '+reserveAmmo[weaponMode];
    scoreEl.textContent=score;
    if(killsEl) killsEl.textContent=kills;
    if(headshotsEl) headshotsEl.textContent=headshots;
    if(waveEl) waveEl.textContent=wave;
    if(enemiesEl) enemiesEl.textContent=enemies.filter(e=>!e.dead).length;
  }
  function endGame(){
    running=false;gameOver=true;
    stopMultiplayerSync(false);
    bestScore=Math.max(bestScore,score); bestWave=Math.max(bestWave,wave);
    localStorage.setItem('inkopsBestScore',String(bestScore)); localStorage.setItem('inkopsBestWave',String(bestWave));
    resultEl.textContent='Pontuação: '+score+'  •  Onda: '+wave+'  •  Abates: '+kills+'  •  Headshots: '+headshots+'  •  Recorde: '+bestScore+' pts / Onda '+bestWave;
    overEl.classList.remove('hidden');
  }

  function createMultiplayerLobby(){
    const wrap=document.createElement('section');
    wrap.id='multiplayerLobby';
    wrap.style.cssText='position:fixed;inset:0;z-index:80;display:none;place-items:center;padding:18px;background:rgba(243,239,228,.96);font-family:Georgia,serif;color:#171510;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation';
    wrap.innerHTML=`<div style="width:min(94vw,620px);max-height:92vh;overflow:auto;padding:22px;border:4px solid #171510;border-radius:14px;background:#fcfbf7;box-shadow:9px 9px 0 #294aa3;position:relative">
      <button data-close aria-label="Fechar" style="position:absolute;right:12px;top:10px;border:2px solid #171510;background:#eee7d4;border-radius:8px;font:900 18px Georgia;width:38px;height:34px">×</button>
      <div style="font-size:12px;font-weight:900;letter-spacing:.13em;color:#294aa3">MULTIPLAYER ALFA • 3X3</div>
      <h2 style="margin:8px 0 5px;font-size:clamp(27px,6vw,43px);line-height:.95">SALA DE RABISCOS</h2>
      <p data-status style="min-height:20px;margin:8px 0 14px;font-weight:700">Crie uma sala ou entre com o código de um amigo.</p>
      <label style="display:block;font-weight:900;margin-bottom:5px">SEU APELIDO</label>
      <input data-name maxlength="14" autocomplete="nickname" placeholder="Ex.: Explorador" style="width:100%;padding:12px;border:3px solid #171510;border-radius:9px;background:#f5f0e3;font:700 17px Georgia;user-select:text;-webkit-user-select:text">
      <div data-entry style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
        <button data-create style="padding:13px 8px;border:3px solid #171510;border-radius:10px;background:#d73535;color:white;font:900 16px Georgia">CRIAR SALA</button>
        <div style="display:flex;gap:6px"><input data-code maxlength="6" placeholder="CÓDIGO" autocapitalize="characters" style="min-width:0;width:100%;padding:10px;border:3px solid #171510;border-radius:9px;background:#f5f0e3;font:900 16px Georgia;text-transform:uppercase;user-select:text;-webkit-user-select:text"><button data-join style="padding:8px;border:3px solid #171510;border-radius:9px;background:#294aa3;color:white;font:900 14px Georgia">ENTRAR</button></div>
      </div>
      <div data-room style="display:none;margin-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;border:3px dashed #294aa3;background:#eef1f8"><strong>CÓDIGO: <span data-room-code style="font-size:24px;color:#d73535"></span></strong><button data-copy style="border:2px solid #171510;border-radius:7px;background:#fff;padding:7px;font:800 12px Georgia">COPIAR</button></div>
        <div data-players style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px"></div>
        <button data-bots style="display:none;width:100%;margin-top:11px;padding:11px;border:3px solid #171510;border-radius:10px;background:#3d8b68;color:#fff;font:900 15px Georgia">BOTS: DESLIGADOS ✓</button>
        <div style="margin-top:11px;padding:9px;border:2px dashed #294aa3;border-radius:9px;background:#eef1f8;text-align:center;font:800 13px Georgia">VERSÃO DE TESTE: CONEXÃO E MOVIMENTO</div>
        <button data-start style="display:none;width:100%;margin-top:12px;padding:14px;border:3px solid #171510;border-radius:10px;background:#d73535;color:#fff;font:900 18px Georgia">INICIAR TESTE</button>
        <button data-leave style="width:100%;margin-top:8px;padding:9px;border:2px solid #171510;border-radius:8px;background:#eee7d4;font:800 13px Georgia">SAIR DA SALA</button>
        <small style="display:block;margin-top:8px;line-height:1.25">Para testar entre amigos sem interferência, deixe os bots desligados. Somente o líder altera essa opção.</small>
      </div>
      <button data-solo style="width:100%;margin-top:12px;padding:10px;border:2px solid #171510;border-radius:8px;background:#fff;font:800 14px Georgia">CONTINUAR NO MODO SOLO</button>
    </div>`;
    document.body.appendChild(wrap);
    const q=s=>wrap.querySelector(s), name=q('[data-name]'), code=q('[data-code]'), status=q('[data-status]');
    name.value=multiplayer.nickname;
    const setStatus=(message,error=false)=>{status.textContent=message;status.style.color=error?'#b11f28':'#171510';};
    const request=async(action,extra={})=>{
      const nickname=name.value.trim().slice(0,14);
      if(['create','join'].includes(action)&&nickname.length<2) throw new Error('Escolha um apelido com pelo menos 2 letras.');
      multiplayer.nickname=nickname||multiplayer.nickname; localStorage.setItem('inkopsNickname',multiplayer.nickname);
      const response=await fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token:multiplayer.token,roomCode:multiplayer.roomCode,nickname:multiplayer.nickname,...extra})});
      const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.error||'O servidor de salas não respondeu.'); return data;
    };
    const render=payload=>{
      multiplayer.room=payload.room; multiplayer.roomCode=payload.room?.code||'';
      if(multiplayer.roomCode)localStorage.setItem('inkopsRoomCode',multiplayer.roomCode);else localStorage.removeItem('inkopsRoomCode');
      q('[data-entry]').style.display=multiplayer.room?'none':'grid'; q('[data-room]').style.display=multiplayer.room?'block':'none';
      if(!multiplayer.room)return;
      q('[data-room-code]').textContent=multiplayer.room.code;
      const players=q('[data-players]');players.replaceChildren();
      for(const team of ['AZUL','VERMELHO']){
        const box=document.createElement('div');box.style.cssText='border:3px solid '+(team==='AZUL'?'#294aa3':'#d73535')+';border-radius:9px;padding:8px;min-height:92px;background:#f8f6ef';
        const title=document.createElement('strong');title.textContent='TIME '+team;box.appendChild(title);
        for(const p of payload.players.filter(p=>p.team===team.toLowerCase())){const row=document.createElement('div');row.textContent=(p.token===multiplayer.token?'✎ ':'• ')+p.nickname+(p.is_host?' ★':'');row.style.marginTop='6px';box.appendChild(row);}players.appendChild(box);
      }
      const me=payload.players.find(p=>p.token===multiplayer.token);q('[data-start]').style.display=me?.is_host?'block':'none';
      const botsButton=q('[data-bots]');botsButton.style.display=me?.is_host?'block':'none';botsButton.textContent=payload.room.botsEnabled?'BOTS: LIGADOS — TOQUE PARA TIRAR':'BOTS: DESLIGADOS ✓';botsButton.style.background=payload.room.botsEnabled?'#d73535':'#3d8b68';
      if(multiplayer.room)multiplayer.room.players=payload.players;
      setStatus(payload.room.status==='playing'?'A partida começou! Entrando no mapa…':payload.players.length+'/6 jogadores conectados. A estrela é o líder.');
      if(payload.room.status==='playing'&&!running){hide();enterGameFullscreen();startGame();}
    };
    const poll=async()=>{if(!multiplayer.roomCode||multiplayer.busy)return;try{render(await request('heartbeat'));}catch(err){setStatus(err.message,true);}};
    const beginPolling=()=>{clearInterval(multiplayer.polling);multiplayer.polling=setInterval(poll,1400);};
    const hide=()=>{wrap.style.display='none';};
    const show=()=>{wrap.style.display='grid';startEl.classList.add('hidden');if(multiplayer.roomCode){poll();beginPolling();}};
    const act=async(action,extra={})=>{if(multiplayer.busy)return;multiplayer.busy=true;setStatus('Rabiscando a sala…');try{const data=await request(action,extra);render(data);beginPolling();}catch(err){setStatus(err.message,true);}finally{multiplayer.busy=false;}};
    q('[data-create]').addEventListener('click',()=>act('create'));
    q('[data-join]').addEventListener('click',()=>{const roomCode=code.value.toUpperCase().replace(/[^A-Z0-9]/g,'');multiplayer.roomCode=roomCode;act('join',{roomCode});});
    q('[data-start]').addEventListener('click',()=>act('start'));
    q('[data-bots]').addEventListener('click',()=>act('settings',{botsEnabled:!multiplayer.room?.botsEnabled}));
    q('[data-leave]').addEventListener('click',async()=>{try{await request('leave');}catch(_){} multiplayer.room=null;multiplayer.roomCode='';localStorage.removeItem('inkopsRoomCode');clearInterval(multiplayer.polling);render({room:null,players:[]});setStatus('Você saiu da sala.');});
    q('[data-copy]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(multiplayer.roomCode);setStatus('Código copiado! Envie para seus amigos.');}catch(_){setStatus('Código da sala: '+multiplayer.roomCode);}});
    q('[data-solo]').addEventListener('click',()=>{hide();enterGameFullscreen();startGame();});
    q('[data-close]').addEventListener('click',()=>{hide();startEl.classList.remove('hidden');});
    return {show};
  }
  const multiplayerLobby=createMultiplayerLobby();

  function makePlayerLabel(name,color){
    const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=64;const ctx=labelCanvas.getContext('2d');
    ctx.fillStyle='rgba(252,251,247,.92)';ctx.strokeStyle='#171510';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(4,4,248,56,12);ctx.fill();ctx.stroke();
    ctx.fillStyle=color;ctx.font='900 25px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(name||'JOGADOR').slice(0,14),128,33);
    const texture=new THREE.CanvasTexture(labelCanvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(2.8,.7,1);sprite.position.y=2.75;sprite.renderOrder=30;return sprite;
  }

  function makeRemotePlayer(state){
    const group=new THREE.Group(),teamColor=state.team==='vermelho'?red:blue,bodyMat=mat(teamColor),darkMat=mat(black),paperMat=mat(paper);
    const legs=[-.22,.22].map(x=>{const leg=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.18,.78,.2),darkMat));leg.position.set(x,.42,0);group.add(leg);return leg;});
    const body=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.72,.92,.38),bodyMat));body.position.y=1.18;group.add(body);
    const head=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.30,8,6),paperMat));head.position.y=1.92;group.add(head);
    const visor=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.43,.12,.08),darkMat));visor.position.set(0,1.96,-.28);group.add(visor);
    const gun=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.14,.14,.86),darkMat));gun.position.set(.42,1.35,-.43);gun.rotation.x=-.08;group.add(gun);
    group.add(makePlayerLabel(state.nickname,state.team==='vermelho'?'#b5242b':'#294aa3'));
    group.traverse(o=>{if(o.isMesh){o.userData.remoteToken=state.token;o.userData.hitZone=o===head?'head':'body';}});
    group.position.set(state.x,state.y-1.7,state.z);group.rotation.y=state.yaw;scene.add(group);
    return {group,legs,gun,target:new THREE.Vector3(state.x,state.y-1.7,state.z),targetYaw:state.yaw,step:0,weapon:state.weapon,team:state.team};
  }

  function updateRemotePlayers(dt){
    for(const remote of multiplayer.remotePlayers.values()){
      remote.group.position.lerp(remote.target,Math.min(1,dt*18));
      let turn=((remote.targetYaw-remote.group.rotation.y+Math.PI)%(Math.PI*2)+Math.PI)%(Math.PI*2)-Math.PI;
      remote.group.rotation.y+=turn*Math.min(1,dt*18);
      const moving=Math.hypot(remote.target.x-remote.group.position.x,remote.target.z-remote.group.position.z)>.035;
      remote.step+=dt*(moving?12:2);remote.legs[0].rotation.x=moving?Math.sin(remote.step)*.55:0;remote.legs[1].rotation.x=moving?-Math.sin(remote.step)*.55:0;
      remote.gun.scale.z=remote.weapon==='launcher'?1.28:(remote.weapon==='knife'?.52:1);
    }
  }

  function applyRemoteStates(states){
    const active=new Set();
    for(const state of states||[]){
      active.add(state.token);let remote=multiplayer.remotePlayers.get(state.token);
      if(!remote){remote=makeRemotePlayer(state);multiplayer.remotePlayers.set(state.token,remote);}
      remote.target.set(state.x,state.y-1.7,state.z);remote.targetYaw=state.yaw;remote.weapon=state.weapon;remote.group.visible=state.alive!==false;
    }
    for(const [token,remote] of multiplayer.remotePlayers)if(!active.has(token)){scene.remove(remote.group);remote.group.traverse(o=>{o.geometry?.dispose?.();if(o.material?.map)o.material.map.dispose?.();o.material?.dispose?.();});multiplayer.remotePlayers.delete(token);}
  }
  // O transporte WebSocket entrega snapshots a cada 50 ms; aplicar aqui evita esperar
  // o próximo envio periódico do próprio jogador para atualizar os adversários.
  window.__inkRealtimeSnapshot = payload => {
    if(!payload || !running) return;
    applyRemoteStates(payload.players || []);
    if(payload.scores){
      onlineScoreEl.style.display='block';
      onlineScoreEl.innerHTML='<span style="color:#294aa3">AZUL '+Number(payload.scores.azul||0)+'</span> &nbsp;×&nbsp; <span style="color:#d73535">'+Number(payload.scores.vermelho||0)+' VERMELHO</span>';
    }
  };

  const onlineScoreEl=document.createElement('div');
  onlineScoreEl.style.cssText='position:fixed;left:50%;top:48px;transform:translateX(-50%);z-index:19;display:none;padding:7px 13px;border:3px solid #171510;border-radius:9px;background:rgba(252,251,247,.9);font:900 15px Georgia;color:#171510;pointer-events:none;white-space:nowrap';
  document.body.appendChild(onlineScoreEl);

  async function reportRemoteHit(targetToken,damage,headshot=false){
    if(!multiplayer.roomCode||multiplayer.room?.status!=='playing')return;
    const pending=multiplayer.pendingHits.get(targetToken)||{damage:0,headshot:false};pending.damage=Math.min(100,pending.damage+damage);pending.headshot=pending.headshot||headshot;multiplayer.pendingHits.set(targetToken,pending);
    if(!multiplayer.hitFlushTimer)multiplayer.hitFlushTimer=setTimeout(flushRemoteHits,650);
  }
  async function flushRemoteHits(){
    multiplayer.hitFlushTimer=null;const batch=[...multiplayer.pendingHits];multiplayer.pendingHits.clear();
    for(const [targetToken,hit] of batch){try{const response=await fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'hit',token:multiplayer.token,roomCode:multiplayer.roomCode,targetToken,damage:hit.damage,headshot:hit.headshot})});const data=await response.json();if(data.eliminated){kills++;hitNoticeEl.textContent='BORROU!  INIMIGO ELIMINADO';hitNoticeEl.classList.add('show');hitNoticeTimer=1;}}catch(_){}}
  }

  async function pushMultiplayerState(){
    if(!running||!multiplayer.roomCode||multiplayer.room?.status!=='playing'||multiplayer.networkBusy)return;
    multiplayer.networkBusy=true;
    try{
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),1800);
      const response=await fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:'state',token:multiplayer.token,roomCode:multiplayer.roomCode,nickname:multiplayer.nickname,x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch,weapon:weaponMode,alive:hp>0})});clearTimeout(timeout);
      const data=await response.json();if(response.ok)applyRemoteStates(data.players);
      if(response.ok&&data.scores){onlineScoreEl.style.display='block';onlineScoreEl.innerHTML='<span style="color:#294aa3">AZUL '+data.scores.azul+'</span> &nbsp;×&nbsp; <span style="color:#d73535">'+data.scores.vermelho+' VERMELHO</span>';}
      if(response.ok&&data.self){
        const wasAlive=multiplayer.selfAlive;multiplayer.selfAlive=data.self.alive;
        if(!data.self.alive){hp=0;hitNoticeEl.textContent='VOCÊ VIROU TINTA • VOLTA EM '+Math.max(1,data.self.respawnSeconds)+'s';hitNoticeEl.classList.add('show');hitNoticeTimer=.5;}
        else if(!wasAlive){hp=100;armor=60;ammo=MAGAZINES[weaponMode]||0;const myTeam=multiplayer.room?.players?.find(p=>p.token===multiplayer.token)?.team;player.pos.set(0,1.7,myTeam==='vermelho'?-30:30);player.yaw=myTeam==='vermelho'?0:Math.PI;hitNoticeEl.textContent='DE VOLTA AO RABISCO!';hitNoticeEl.classList.add('show');hitNoticeTimer=1;}
        else hp=Math.min(hp,data.self.health);
        updateHud();
      }
    }catch(_){/* Uma perda curta de rede não interrompe a partida local. */}finally{multiplayer.networkBusy=false;}
  }

  function startMultiplayerSync(){clearInterval(multiplayer.networkTimer);clearInterval(multiplayer.polling);multiplayer.selfAlive=true;if(multiplayer.roomCode&&multiplayer.room?.status==='playing'){onlineScoreEl.style.display='block';multiplayer.networkTimer=setInterval(pushMultiplayerState,50);pushMultiplayerState();hitNoticeEl.textContent='CONECTADO À SALA '+multiplayer.roomCode;hitNoticeEl.classList.add('show');hitNoticeTimer=1.4;}}
  function stopMultiplayerSync(clearPlayers=true){clearInterval(multiplayer.networkTimer);multiplayer.networkTimer=null;multiplayer.networkBusy=false;onlineScoreEl.style.display='none';if(clearPlayers){for(const remote of multiplayer.remotePlayers.values()){scene.remove(remote.group);remote.group.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});}multiplayer.remotePlayers.clear();}}

  function startGame(){
    initAudio(); score=0;kills=0;headshots=0;ammo=MAGAZINES.rifle;reserveAmmo={rifle:120,smg:144,shotgun:30,launcher:6,sniper:20};hp=100;armor=60;wave=1;waveDelay=0;reloadTimer=0;fireCooldown=0;fireHeld=false;weaponKick=0;fireZoom=0;sprintBlend=0;knifeSwing=0;sniperCycle=0;playerStepTimer=0;
    setWeaponMode('rifle');
    scopeMode=false;adsProgress=0;spawnGrace=5;
    for(const key of weaponModes) weaponVariants[key].visible=(key===weaponMode);
    const myTeam=multiplayer.room?.players?.find(p=>p.token===multiplayer.token)?.team;
    // Times começam em lados opostos; no modo solo permanece o spawn sul estável.
    player.pos.set(0,1.7,myTeam==='vermelho'?-30:30);player.yaw=myTeam==='vermelho'?0:Math.PI;player.pitch=0;player.recoil=0;verticalVelocity=0;grounded=true;jumpPadCooldown=0;
    if(multiplayer.room?.status==='playing'&&!multiplayer.room?.botsEnabled){for(const e of enemies)scene.remove(e.group);enemies.length=0;waveDelay=1000000000;}else resetEnemies();
    updateHud(); startEl.classList.add('hidden');overEl.classList.add('hidden');layoutBtn.style.display='block';running=true;last=performance.now();clock.start();requestAnimationFrame(loop);
    startMultiplayerSync();
  }
  async function enterGameFullscreen(){
    // Fullscreen só pode ser solicitado durante o toque do jogador. Em iPhone/iPad antigos,
    // onde a API pode não existir, o layout continua ocupando 100% da janela sem travar o jogo.
    const root=document.documentElement;
    const request=root.requestFullscreen||root.webkitRequestFullscreen;
    try{
      if(!document.fullscreenElement&&!document.webkitFullscreenElement&&request) await request.call(root,{navigationUI:'hide'});
      if(screen.orientation?.lock) await screen.orientation.lock('landscape');
    }catch(_){ /* Bloqueio do navegador não impede o início da partida. */ }
  }
  playBtn.textContent='JOGAR / MULTIPLAYER';
  playBtn.addEventListener('click',()=>multiplayerLobby.show());
  againBtn.addEventListener('click',()=>{enterGameFullscreen();startGame();});
  reloadBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();reloadWeapon();});
  function bindFireButton(btn){
    if(!btn)return;
    btn.addEventListener('pointerdown',e=>{
      e.preventDefault(); e.stopPropagation();
      if(scopeMode){ scopeMode=false; scopeBtn.style.background='rgba(238,231,212,.82)'; scopeBtn.style.color='#171510'; }
      fireHeld=weaponMode!=='sniper'&&weaponMode!=='launcher'; shoot();
      fireLookId=e.pointerId; fireLookX=e.clientX; fireLookY=e.clientY;
      btn.setPointerCapture?.(e.pointerId);
    });
    btn.addEventListener('pointermove',e=>{
      if(e.pointerId!==fireLookId)return;
      const dx=e.clientX-fireLookX, dy=e.clientY-fireLookY;
      // Pequena zona morta para evitar tremedeira ao simplesmente segurar o disparo.
      if(Math.abs(dx)+Math.abs(dy)>2){
        look(dx,dy,.0036);
        fireLookX=e.clientX; fireLookY=e.clientY;
      }
    });
    const endFire=e=>{
      if(e?.pointerId!=null && e.pointerId!==fireLookId)return;
      fireHeld=false; fireLookId=null;
    };
    btn.addEventListener('pointerup',endFire);
    btn.addEventListener('pointercancel',endFire);
    btn.addEventListener('lostpointercapture',endFire);
  }
  bindFireButton(fireBtn);
  bindFireButton(fireLeftBtn);

  function jump(){
    if(!running||!grounded)return;
    verticalVelocity=5.25; grounded=false;
    footstepSound(.17,145);
  }
  jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();jump();});

  function update(dt){
    if(controlsEditing)return;
    jumpPadCooldown=Math.max(0,jumpPadCooldown-dt);
    if(spawnGrace>0) spawnGrace=Math.max(0,spawnGrace-dt);
    joy.x+=(joy.tx-joy.x)*Math.min(1,dt*14);joy.y+=(joy.ty-joy.y)*Math.min(1,dt*14);
    let f=-joy.y,s=joy.x;
    if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyA||keys.ArrowLeft)s-=1;if(keys.KeyD||keys.ArrowRight)s+=1;
    const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
    // No analógico, empurrar bem para frente ativa uma corrida curta. O strafe continua normal,
    // então não fica possível correr a 1.25x simplesmente andando de lado.
    const joystickSprint=joy.active && joy.y < -0.72 && Math.abs(joy.y) > Math.abs(joy.x)*1.15;
    const keyboardSprint=keys.ShiftLeft||keys.ShiftRight;
    const sprinting=(joystickSprint||keyboardSprint) && !scopeMode && weaponMode!=='knife';
    const speed=player.speed*(sprinting?SPRINT_MULTIPLIER:1)*(scopeMode?.68:1);
    sprintBlend+=( (sprinting&&len>.05 ? 1 : 0)-sprintBlend )*Math.min(1,dt*9);
    const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
    // Forward follows the direction the camera is facing. Previously +Z was treated as forward,
    // which made the mobile joystick feel inverted whenever the player looked ahead.
    move((-sin*f+cos*s)*speed*dt,(-cos*f-sin*s)*speed*dt);
    if(grounded&&jumpPadCooldown<=0){
      const onJumpPad=Math.hypot(player.pos.x-18,player.pos.z-18)<1.35||Math.hypot(player.pos.x+18,player.pos.z+18)<1.35;
      if(onJumpPad){
        verticalVelocity=8.0;grounded=false;jumpPadCooldown=1.25;footstepSound(.22,190);
        hitNoticeEl.textContent='PLOIM!  SALTO DE TINTA';hitNoticeEl.classList.add('show');hitNoticeTimer=.78;
      }
    }
    const moving=len>.05;
    playerStepTimer=Math.max(0,playerStepTimer-dt);
    if(moving && playerStepTimer<=0){
      footstepSound(sprinting?.16:.125,sprinting?112:96);
      playerStepTimer=sprinting?.29:.43;
    }
    const terrainHeight=getPlayerHeight(player.pos.x,player.pos.z);
    if(grounded && terrainHeight<player.pos.y-.30) grounded=false;
    if(grounded){
      player.pos.y += (terrainHeight-player.pos.y)*Math.min(1,dt*14);
    }else{
      verticalVelocity-=13.5*dt;
      player.pos.y+=verticalVelocity*dt;
      if(player.pos.y<=terrainHeight){player.pos.y=terrainHeight;verticalVelocity=0;grounded=true;}
    }
    player.bob+=(moving?(sprinting?14:10):2)*dt;
    player.recoil=Math.max(0,player.recoil-dt*1.7);fireCooldown=Math.max(0,fireCooldown-dt);fireZoom=Math.max(0,fireZoom-dt*5.2);hurtTimer=Math.max(0,hurtTimer-dt);hitNoticeTimer=Math.max(0,hitNoticeTimer-dt);
    if(hitNoticeTimer<=0) hitNoticeEl.classList.remove('show');
    if(fireHeld) shoot();
    updateRemotePlayers(dt);
    for(let i=tracers.length-1;i>=0;i--){
      const t=tracers[i]; t.life-=dt; t.line.material.opacity=Math.max(0,t.life/.075);
      if(t.life<=0){scene.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();tracers.splice(i,1);}
    }
    for(let i=rocketProjectiles.length-1;i>=0;i--){
      const rocket=rocketProjectiles[i];rocket.life-=dt;rocket.puffTimer-=dt;rocket.soundTimer-=dt;
      const step=Math.min(rocket.remaining,rocket.speed*dt);
      rocket.group.position.addScaledVector(rocket.dir,step);rocket.remaining-=step;rocket.group.rotateY(dt*8.5);
      rocket.caption.material.opacity=.72+.28*Math.sin(performance.now()*.018);
      if(rocket.puffTimer<=0){addRocketPuff(rocket.group.position.clone().addScaledVector(rocket.dir,-.40));rocket.puffTimer=.075;}
      if(rocket.soundTimer<=0){rocketFlightSound(rocket.soundStep++);rocket.soundTimer=.24;}
      if(rocket.remaining<=.01||rocket.life<=0){
        const impact=rocket.group.position.clone();scene.remove(rocket.group);
        rocket.group.traverse(o=>{o.geometry?.dispose?.();if(o.material?.map)o.material.map.dispose?.();o.material?.dispose?.();});
        rocketProjectiles.splice(i,1);detonateRocket(impact);
      }
    }
    for(let i=rocketPuffs.length-1;i>=0;i--){
      const smoke=rocketPuffs[i];smoke.life-=dt;
      smoke.puff.scale.setScalar(1+(1-smoke.life/smoke.maxLife)*1.8);
      smoke.puff.material.opacity=Math.max(0,smoke.life/smoke.maxLife*.72);
      if(smoke.life<=0){scene.remove(smoke.puff);smoke.puff.geometry.dispose();smoke.puff.material.dispose();rocketPuffs.splice(i,1);}
    }
    for(let i=shotgunBlots.length-1;i>=0;i--){
      const blot=shotgunBlots[i];blot.life-=dt;
      const progress=1-blot.life/blot.maxLife;
      blot.sprite.scale.setScalar(2.45+Math.sin(progress*Math.PI)*.85);
      blot.sprite.material.opacity=Math.max(0,1-progress);
      if(blot.life<=0){scene.remove(blot.sprite);blot.texture.dispose();blot.sprite.material.dispose();shotgunBlots.splice(i,1);}
    }
    for(let i=inkExplosions.length-1;i>=0;i--){
      const fx=inkExplosions[i]; fx.life-=dt;
      const progress=1-fx.life/fx.maxLife;
      const pulse=1+Math.sin(Math.min(1,progress)*Math.PI)*1.65;
      fx.group.scale.setScalar(pulse);
      fx.group.quaternion.copy(camera.quaternion);
      for(const material of fx.materials) if(material?.opacity!=null) material.opacity=Math.max(0,1-progress);
      if(fx.life<=0){
        scene.remove(fx.group);
        fx.group.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});
        fx.texture.dispose(); inkExplosions.splice(i,1);
      }
    }
    const bobY=moving?Math.sin(player.bob)*(.045+.018*sprintBlend):0;
    const bobX=moving?Math.cos(player.bob*.5)*.012*sprintBlend:0;
    camera.position.y=player.pos.y+bobY;
    camera.position.x=player.pos.x+bobX;
    camera.position.x=player.pos.x;camera.position.z=player.pos.z;
    camera.rotation.y=player.yaw;camera.rotation.x=player.pitch-player.recoil*.045;
    const adsTarget=(scopeMode&&weaponMode!=='knife')?1:0;
    adsProgress += (adsTarget-adsProgress)*Math.min(1,dt*(1/ADS_DURATION)*1.7);
    const ease=adsProgress*adsProgress*(3-2*adsProgress);
    // A aproximação é física e gradual: a câmera avança um pouco e o FOV fecha.
    // No fuzil é uma aproximação moderada; na sniper o zoom é forte, sempre com visão limpa.
    const adsForward=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation).normalize();
    camera.position.addScaledVector(adsForward,.13*ease);
    camera.position.y += .018*ease;
    // FOV em três níveis: tiro comum = leve aproximação, MIRA do fuzil = luneta ~1.5x,
    // sniper = zoom de longo alcance. Corrida abre um pouco a visão para dar sensação de velocidade.
    let targetFov=72;
    if(sprinting && !scopeMode) targetFov=76;
    if(weaponMode==='rifle' && !scopeMode) targetFov=72-8*fireZoom;
    if(weaponMode==='rifle' && scopeMode) targetFov=ADS_FOV;
    if(weaponMode==='sniper' && scopeMode) targetFov=SNIPER_ADS_FOV;
    camera.fov=NORMAL_FOV+(targetFov-NORMAL_FOV)*ease;
    // Fora do ADS, não queremos que o easing segure o zoom do disparo; aplicamos a aproximação de tiro diretamente.
    if(!scopeMode && weaponMode==='rifle') camera.fov=72-8*fireZoom+(76-(72-8*fireZoom))*sprintBlend;
    if(!scopeMode && weaponMode==='smg') camera.fov=72-14*fireZoom+(76-(72-14*fireZoom))*sprintBlend;
    if(!scopeMode && weaponMode!=='rifle' && weaponMode!=='smg') camera.fov=72+4*sprintBlend;
    camera.updateProjectionMatrix();

    // A sniper usa o visor grande. O fuzil agora recebe uma luneta menor, com a mesma linguagem
    // de lente da sniper, porém com zoom moderado e centro transparente.
    if(weaponMode==='sniper' && scopeMode){
      sniperScope.style.display='block';
      sniperScope.style.opacity=String(Math.min(1,ease*1.25));
    }else{
      sniperScope.style.opacity='0';
      sniperScope.style.display='none';
    }
    if(weaponMode==='rifle' && scopeMode){
      rifleScopeEl.style.display='block';
      rifleScopeEl.style.opacity=String(Math.min(1,ease*1.3));
      centerEl.style.opacity='0';
    }else if(weaponMode==='sniper' && scopeMode){
      centerEl.style.opacity='0';
    }else{
      rifleScopeEl.style.opacity='0';
      rifleScopeEl.style.display='none';
      centerEl.style.opacity='1';
    }

    const activeWeapon=weaponVariants[weaponMode];
    activeWeapon.visible=true;
    // 0.78 acompanha aproximadamente a alternância dos passos de corrida (um balanço por dois passos).
    const runSwayX=Math.sin(player.bob*.78)*.075*sprintBlend;
    const runSwayY=Math.abs(Math.cos(player.bob*.78))*.055*sprintBlend;
    const runTilt=Math.sin(player.bob*.78)*.045*sprintBlend;
    // Cada arma tem uma posição própria. O rifle permanece no canto inferior direito; a sniper
    // sobe apenas o necessário para a ocular ficar coerente com o visor; a faca entra em golpe.
    if(weaponMode==='rifle'){
      weapon.position.set(-.08*ease+runSwayX,-player.recoil*.35-.02*ease-weaponKick*.035-runSwayY,-.10*ease+weaponKick*.045);
      weapon.rotation.x=player.recoil*.18-.012*ease+weaponKick*.08;
      weapon.rotation.y=.008*ease; weapon.rotation.z=-.018*ease+runTilt;
      weapon.scale.setScalar(1+.035*ease);
    }else if(weaponMode==='sniper'){
      const s=weaponVariants.sniper;
      s.position.set(-.34*ease+runSwayX,-player.recoil*.25+.02*ease-runSwayY,-.18*ease);
      s.rotation.x=player.recoil*.16-.015*ease; s.rotation.y=.012*ease; s.rotation.z=-.02*ease+runTilt;
      s.scale.setScalar(1+.10*ease);
    }else if(weaponMode==='knife'){
      const k=weaponVariants.knife;
      const swing=Math.sin(knifeSwing*Math.PI)*knifeSwing;
      k.position.set(.02+.10*swing+runSwayX,-.02-.10*swing-runSwayY,-.02-.18*swing);
      k.rotation.set(-.10-.75*swing,.18+.35*swing,-.16-1.0*swing+runTilt);
      k.scale.setScalar(1+.05*swing);
    }else{
      // Submetralhadora, espingarda e lança-foguetes também acompanham a corrida.
      activeWeapon.position.set(runSwayX,-player.recoil*.30-runSwayY+weaponKick*.03,weaponKick*.045);
      activeWeapon.rotation.set(player.recoil*.16+weaponKick*.07,0,runTilt);
      activeWeapon.scale.setScalar(1);
    }
    weaponKick=Math.max(0,weaponKick-dt*4.5);
    knifeSwing=Math.max(0,knifeSwing-dt*5.5);
    // Durante o zoom, a mira simples some e fica somente a lente da arma ativa.
    // O modelo da arma some cedo no ADS para deixar a tela limpa, como na sniper.
    if(weaponMode==='sniper') activeWeapon.visible = ease < .22;
    if(weaponMode==='rifle') activeWeapon.visible = ease < .22;

    for(const e of enemies){
      if(e.dead)continue;
      e.attack-=dt; e.hit=Math.max(0,e.hit-dt); e.stepTimer=Math.max(0,(e.stepTimer||0)-dt);
      if(e.sketchAura){
        e.sketchAura.rotation.z=Math.sin(performance.now()*.003+e.group.position.x)*.025;
        e.sketchAura.material.color.setHex(e.hit>0?red:green);
        e.sketchAura.material.opacity=e.hit>0?1:.78;
      }
      const dx=player.pos.x-e.group.position.x,dz=player.pos.z-e.group.position.z,dist=Math.hypot(dx,dz);
      if(dist>1.5){
        // Movimento tático leve: continua perseguindo o jogador, mas faz pequenas variações laterais.
        // Não cria timers, raycasts ou eventos novos, preservando a estabilidade dos controles móveis.
        const phase=performance.now()*.0014 + e.group.position.x*.11 + e.group.position.z*.07;
        const combatSide=((e.combatStep||0)%2===0?1:-1);
        const strafe=dist<14?(Math.sin(phase)*.34+combatSide*.16):0;
        // Mantém uma distância mínima de combate para evitar que todos grudem no jogador.
        const approach=dist<4.5?-.22:(dist<7?.48:1);
        const moveSpeed=e.speed*1.28;
        const vx=(dx/dist*approach - dz/dist*strafe)*moveSpeed*dt;
        const vz=(dz/dist*approach + dx/dist*strafe)*moveSpeed*dt;
        const nx=e.group.position.x+vx,nz=e.group.position.z+vz;
        if(!blocked(nx,e.group.position.z))e.group.position.x=nx;
        if(!blocked(e.group.position.x,nz))e.group.position.z=nz;
        if(dist<16 && e.stepTimer<=0){
          const closeness=Math.max(0,1-dist/16);
          footstepSound(.035+.065*closeness,e.elite?78:88);
          e.stepTimer=.48+Math.random()*.10;
        }
      }
      e.group.lookAt(player.pos.x,1.2,player.pos.z);
      if(e.attack<=0 && dist<32 && spawnGrace<=0){
        const muzzle=new THREE.Vector3(.22,1.25,-1.02); muzzle.applyMatrix4(e.group.matrixWorld);
        // Precisão variável: inimigos comuns erram um pouco mais de longe; elites continuam mais precisos.
        // Mantém o mesmo raycast e a mesma cadência, sem timers/eventos extras.
        const spread=(e.elite?.055:.11)*Math.min(1.8,Math.max(.45,dist/14));
        const target=new THREE.Vector3(
          player.pos.x+(Math.random()-.5)*spread*dist,
          player.pos.y-.10+(Math.random()-.5)*spread*dist*.45,
          player.pos.z+(Math.random()-.5)*spread*dist
        );
        raycaster.set(muzzle,target.clone().sub(muzzle).normalize()); raycaster.far=dist;
        const blockers=[];
        scene.traverse(o=>{
          if(!o.isMesh||o.userData.enemyWeapon||o.userData.noBulletMark)return;
          if(o.userData.enemyRef===e)return;
          blockers.push(o);
        });
        const blockedHit=raycaster.intersectObjects(blockers,false)[0];
        if(!blockedHit || blockedHit.distance>=dist-.3){
          addTracer(muzzle,target);
          const baseDamage=e.elite?9:5;
          const waveDamageBonus=Math.min(e.elite?4:3,Math.floor((wave-1)/4));
          const incoming=baseDamage+waveDamageBonus;
          const absorbed=Math.min(armor,incoming);
          armor=Math.max(0,armor-absorbed);
          hp=Math.max(0,hp-(incoming-absorbed));
          hurtTimer=.22; updateHud();
          if(audioCtx) shotSound('rifle'); if(hp<=0){endGame();return;}
        }
        // Depois de cada rajada, alterna discretamente o lado do deslocamento para não avançar em linha reta.
        e.combatStep=(e.combatStep||0)+1;
        e.attack=e.elite?.85:1.18;
      }
      const scale=1+(e.hit>0?.14:0);e.group.scale.set(scale,scale,scale);
    }
    const alive=enemies.filter(e=>!e.dead).length;
    if(alive===0 && waveDelay<=0){
      waveDelay=2.5;
      spawnGrace=Math.max(spawnGrace,2.5);
      let waveBonus=20+wave*10;
      const milestone=wave%5===0;
      if(milestone) waveBonus+=100;
      score+=waveBonus;
      hp=Math.min(100,hp+(milestone?18:8));
      armor=Math.min(100,armor+(milestone?28:12));
      // Toda onda começa com o carregador e a reserva padrão completos.
      reloadToken++;reloadTimer=0;reloadBtn.textContent='RECARREGAR';
      reserveAmmo={...RESERVE_AMMO};
      ammo=weaponMode==='knife'?0:MAGAZINES[weaponMode];
      updateHud();
      hitNoticeEl.textContent=(milestone?'MARCO DA ONDA '+wave+'  +'+waveBonus+' PTS':'ONDA '+wave+' CONCLUÍDA  +'+waveBonus+' PTS')+'  •  MUNIÇÃO CHEIA';
      hitNoticeEl.classList.add('show'); hitNoticeTimer=1.25;
    }
    if(waveDelay>0){
      waveDelay=Math.max(0,waveDelay-dt);
      if(waveDelay>0 && waveDelay<1.6){
        hitNoticeEl.textContent='PRÓXIMA ONDA EM '+Math.max(1,Math.ceil(waveDelay));
        hitNoticeEl.classList.add('show'); hitNoticeTimer=.18;
      }
      if(waveDelay===0 && enemies.filter(e=>!e.dead).length===0){
        wave++;
        const spawnPoints=[[-40,-34],[40,-34],[-40,34],[40,34],[-34,-12],[34,14],[-16,-40],[18,40],[-28,27],[29,-26]];
        spawnPoints.sort((a,b)=>Math.hypot(b[0]-player.pos.x,b[1]-player.pos.z)-Math.hypot(a[0]-player.pos.x,a[1]-player.pos.z));
        const count=Math.min(8,3+Math.floor(wave/2));
        const eliteCount=wave>=6?2:(wave>=3?1:0);
        for(let i=0;i<count;i++){const p=spawnPoints[i%spawnPoints.length];makeEnemy(p[0],p[1],i<eliteCount);}
        spawnGrace=Math.max(spawnGrace,1.6);
        updateHud();
        hitNoticeEl.textContent='ONDA '+wave+'  •  '+count+' INIMIGOS'+(eliteCount?'  •  '+eliteCount+' ELITE'+(eliteCount>1?'S':''):'');
        hitNoticeEl.classList.add('show'); hitNoticeTimer=1.15;
      }
    }
    if(hurtTimer>0){canvas.style.filter='sepia(.25) contrast(1.1)';}else canvas.style.filter='none';
  }

  function setJoy(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=(e.clientX-cx)/(r.width*.42),y=(e.clientY-cy)/(r.height*.42);const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}joy.tx=x;joy.ty=y;knob.style.transform=`translate(${x*32}px,${y*32}px)`;}
  stick.addEventListener('pointerdown',e=>{e.preventDefault();joy.active=true;joy.id=e.pointerId;stick.setPointerCapture(e.pointerId);setJoy(e);});
  stick.addEventListener('pointermove',e=>{if(joy.active&&e.pointerId===joy.id)setJoy(e);});
  function endJoy(e){if(e.pointerId!==joy.id)return;joy.active=false;joy.tx=joy.ty=0;knob.style.transform='translate(0,0)';}
  stick.addEventListener('pointerup',endJoy);stick.addEventListener('pointercancel',endJoy);

  canvas.addEventListener('pointerdown',e=>{
    if(!running)return;
    if(e.pointerType==='mouse'){mouseLook=true;canvas.setPointerCapture(e.pointerId);}
    else {touchLookId=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;canvas.setPointerCapture(e.pointerId);}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!running)return;
    if(e.pointerType==='mouse'&&mouseLook){look(e.movementX,e.movementY,.0026);}
    else if(e.pointerId===touchLookId){const dx=e.clientX-lastLookX,dy=e.clientY-lastLookY;look(dx,dy,.0042);lastLookX=e.clientX;lastLookY=e.clientY;}
  });
  window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')mouseLook=false;if(e.pointerId===touchLookId)touchLookId=null;});
  window.addEventListener('keydown',e=>{
    keys[e.code]=true;
    if(e.code==='Space'){fireHeld=weaponMode!=='sniper'&&weaponMode!=='launcher';shoot();}
    if(e.code==='KeyR'&&weaponMode!=='knife') reloadWeapon();
    if(e.code==='KeyJ') jump();
  });
  window.addEventListener('keyup',e=>{
    keys[e.code]=false;
    if(e.code==='Space')fireHeld=false;
  });
  window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);renderer.setPixelRatio(renderPixelRatio());
    // Mantém posições personalizadas dentro da tela após girar o celular.
    for(const el of movableControls) if(savedLayout[el.id]) placeControl(el,savedLayout[el.id]);
  });

  function loop(now){if(!running)return;const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);renderer.render(scene,camera);requestAnimationFrame(loop);}
  updateHud();
  renderer.render(scene,camera);
})();
