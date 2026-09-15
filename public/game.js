// SUBMUNDO INK OPS V12 POLIMENTO COMPLETO
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const centerEl = document.querySelector('.center');
  const rifleScopeEl = document.getElementById('rifleScope');
  const hpEl = document.getElementById('hp');
  const armorEl = document.getElementById('armor');
  const hudVitalsEl=document.getElementById('hudVitals'),hudStatsEl=document.getElementById('hudStats');
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
  jumpBtn.id='jump'; jumpBtn.textContent='↑'; jumpBtn.setAttribute('aria-label','Pular');
  jumpBtn.style.cssText='position:absolute;right:222px;bottom:32px;width:76px;height:68px;border:3px solid #171510;border-radius:18px;background:rgba(238,231,212,.88);font:700 14px Georgia;color:#171510;pointer-events:auto;touch-action:none;user-select:none;z-index:12;box-shadow:4px 4px 0 rgba(23,21,16,.16)';
  document.querySelector('.controls')?.appendChild(jumpBtn);
  const oldWeapon = document.querySelector('.weapon');
  if (oldWeapon) oldWeapon.style.display = 'none';

  const TAU = Math.PI * 2;
  const scene = new THREE.Scene();
  // Folha de papel quente, como a referência: o cenário deve parecer desenhado sobre papel,
  // não um mundo 3D com materiais tradicionais.
  scene.background = new THREE.Color(0xf3efe4);
  scene.fog = new THREE.Fog(0xf3efe4, 48, 138);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 165);
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
    speed: 5.75,
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
  let damageFlash=0,damageShake=0,rabbitTunnelCooldown=0,rabbitTunnelMode=false,rabbitTunnelEntrySide=-1,rabbitTunnelCanBacktrack=false;
  let damageDirection='all',lastHurtSoundAt=0,lastServerDamageStamp=0;
  const damageOverlay=document.createElement('div');damageOverlay.id='damageOverlay';damageOverlay.style.cssText='position:fixed;inset:0;z-index:65;pointer-events:none;opacity:0;transition:opacity .035s linear';document.body.appendChild(damageOverlay);
  const damageBackgrounds={left:'linear-gradient(to right,rgba(196,8,25,.96) 0%,rgba(215,20,35,.62) 10%,rgba(215,20,35,.10) 28%,transparent 42%)',right:'linear-gradient(to left,rgba(196,8,25,.96) 0%,rgba(215,20,35,.62) 10%,rgba(215,20,35,.10) 28%,transparent 42%)',back:'linear-gradient(to top,rgba(196,8,25,.96) 0%,rgba(215,20,35,.66) 12%,rgba(215,20,35,.12) 31%,transparent 48%)',front:'linear-gradient(to bottom,rgba(196,8,25,.96) 0%,rgba(215,20,35,.58) 9%,rgba(215,20,35,.08) 25%,transparent 40%),linear-gradient(to right,rgba(190,8,23,.72),transparent 24%),linear-gradient(to left,rgba(190,8,23,.72),transparent 24%)',all:'radial-gradient(circle at center,transparent 37%,rgba(215,28,38,.16) 59%,rgba(190,10,22,.86) 100%)'};
  damageOverlay.style.background=damageBackgrounds.all;
  function hurtSound(){initAudio();if(!audioCtx)return;const nowMs=performance.now();if(nowMs-lastHurtSoundAt<85)return;lastHurtSoundAt=nowMs;const now=audioCtx.currentTime;noiseBurst(.075,.28,180,1250);const o=audioCtx.createOscillator(),gg=audioCtx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(155,now);o.frequency.exponentialRampToValueAtTime(52,now+.10);gg.gain.setValueAtTime(.25,now);gg.gain.exponentialRampToValueAtTime(.0001,now+.11);o.connect(gg);gg.connect(audioCtx.destination);o.start(now);o.stop(now+.12);}
  function triggerDamageFeedback(amount=10,attackerToken=null,serverStamp=0){const force=Math.max(.22,Math.min(1,Number(amount||10)/42));damageFlash=Math.max(damageFlash,.48+.42*force);damageShake=Math.max(damageShake,.045+.07*force);hurtSound();let dir='all';const remote=attackerToken?multiplayer?.remotePlayers?.get?.(attackerToken):null;if(remote){const dx=remote.group.position.x-player.pos.x,dz=remote.group.position.z-player.pos.z;const f=dx*(-Math.sin(player.yaw))+dz*(-Math.cos(player.yaw));const r=dx*Math.cos(player.yaw)+dz*(-Math.sin(player.yaw));if(Math.abs(f)>Math.abs(r)*.82)dir=f>=0?'front':'back';else dir=r>=0?'right':'left';}damageDirection=dir;damageOverlay.style.background=damageBackgrounds[dir]||damageBackgrounds.all;if(serverStamp)lastServerDamageStamp=Math.max(lastServerDamageStamp,Number(serverStamp)||0);}
  const fullscreenBtn=document.createElement('button');fullscreenBtn.textContent='⛶ TELA CHEIA';fullscreenBtn.style.cssText='position:fixed;right:12px;top:12px;z-index:55;padding:8px 11px;border:2px solid #171510;border-radius:9px;background:rgba(252,251,247,.90);font:800 11px Georgia;color:#171510;pointer-events:auto';document.body.appendChild(fullscreenBtn);fullscreenBtn.addEventListener('click',async e=>{e.stopPropagation();try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();else await document.exitFullscreen?.();}catch(_){}});
  canvas.style.position='fixed';canvas.style.inset='0';canvas.style.width='100vw';canvas.style.height='100dvh';canvas.style.cursor='crosshair';
  // O botao de atirar tambem funciona como um pequeno controle de mira: segure e arraste sem soltar para atirar e girar a camera ao mesmo tempo.
  let fireLookId = null;
  let fireLookX = 0, fireLookY = 0;
  const tracers = [];
  const hitMarks = [];
  const inkExplosions = [];
  const rocketProjectiles = [];
  const rocketPuffs = [];
  const shotgunBlots = [];
  const deathInkDrops=[];
  const destructibleMushrooms=new Map();
  const destructibleRabbits=new Map();
  const mushroomSmoke=[];
  let cheshireCat=null,cheshireHitCooldown=0,goldenInkwell=null,rewardTakeBusy=false,rewardLocalRespawn=0;
  let reloadCartridge=null;
  const voicePeers=new Map(); let voiceStream=null,voiceEnabled=false;

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
  const MAGAZINES = { rifle: 30, smg: 36, shotgun: 6, launcher: 1, sniper: 6 };
  const RESERVE_AMMO = { rifle:150, smg:180, shotgun:42, launcher:10, sniper:36 };
  let reserveAmmo = {...RESERVE_AMMO};
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
    roomCode: localStorage.getItem('inkopsRoomCode') || '',
    nickname: localStorage.getItem('inkopsNickname') || '',
    room: null,
    polling: null,
    busy: false,
    networkTimer: null,
    networkBusy: false,
    remotePlayers: new Map(),
    selfAlive: true,
    pendingHits: new Map(),
    blockAutoStart: false,
    hitFlushTimer: null
  };
  localStorage.setItem('inkopsPlayerToken',multiplayer.token);
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

  function launchRocket(from,dir,distance,impactNormal=null,remote=false){
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
    rocketProjectiles.push({group,dir:dir.clone(),remaining:distance,speed:15.5,life:4.2,puffTimer:0,soundTimer:.04,soundStep:0,caption,impactNormal,remote});if(!remote&&multiplayer.roomCode&&multiplayer.room?.status==='playing')window.__inkRealtimeSendRocket?.({from:{x:from.x,y:from.y,z:from.z},dir:{x:dir.x,y:dir.y,z:dir.z},distance});
  }

  function addRocketPuff(position){
    const puff=createInkX(.10+Math.random()*.06,Math.random()>.45?blue:ink);
    puff.position.copy(position);puff.rotation.z=Math.random()*TAU;puff.renderOrder=18;scene.add(puff);
    rocketPuffs.push({puff,life:.42,maxLife:.42});
  }

  function rocketExplosionSound(){
    initAudio();if(!audioCtx)return;
    const now=audioCtx.currentTime;noiseBurst(.38,1.0,90,2300);noiseBurst(.10,.52,2200,7600);
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sawtooth';o.frequency.setValueAtTime(78,now);o.frequency.exponentialRampToValueAtTime(22,now+.38);
    g.gain.setValueAtTime(.72,now);g.gain.exponentialRampToValueAtTime(.0001,now+.40);o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+.41);
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

  const rocketInkStains=[];
  function createRocketInkStains(position,normal=null){
    const team=multiplayer.room?.players?.find(p=>p.token===multiplayer.token)?.team||'vermelho';
    const color=team==='azul'?blue:red;
    const count=normal&&Math.abs(normal.y)<.65?7:9;
    for(let i=0;i<count;i++){
      const r=.20+Math.random()*.48;const mesh=addOutline(new THREE.Mesh(new THREE.CircleGeometry(r,7),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})));
      const offset=new THREE.Vector3((Math.random()-.5)*3.2,.025,(Math.random()-.5)*3.2);mesh.position.copy(position).add(offset);
      if(normal&&Math.abs(normal.y)<.65){const nrm=normal.clone().normalize();mesh.position.copy(position).addScaledVector(nrm,.03).add(new THREE.Vector3((Math.random()-.5)*1.8,(Math.random()-.5)*1.8,(Math.random()-.5)*1.8));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),nrm);}else mesh.rotation.x=-Math.PI/2;
      scene.add(mesh);rocketInkStains.push({mesh,life:16,maxLife:16});
    }
    for(let i=0;i<20;i++){const drop=new THREE.Mesh(new THREE.SphereGeometry(.05+Math.random()*.08,5,4),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.86}));drop.position.copy(position);scene.add(drop);const a=Math.random()*TAU,spd=2+Math.random()*5;deathInkDrops.push({mesh:drop,vx:Math.cos(a)*spd,vy:2+Math.random()*5,vz:Math.sin(a)*spd,life:.9+Math.random()*.55});}
    while(rocketInkStains.length>28){const old=rocketInkStains.shift();scene.remove(old.mesh);old.mesh.geometry.dispose();old.mesh.material.dispose();}
  }

  function detonateRocket(position,impactNormal=null){
    createInkExplosion(position);createRocketInkStains(position,impactNormal);rocketExplosionSound();
    if(multiplayer.room?.status==='playing'){const selfDist=player.pos.distanceTo(position);if(selfDist<=4.8){const selfDamage=selfDist<=2.5?100:Math.max(25,Math.round(82-(selfDist-2.5)*24));fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'selfhit',token:multiplayer.token,roomCode:multiplayer.roomCode,damage:selfDamage})}).then(r=>r.json()).then(data=>{if(data?.eliminated)selfRocketDeathPending=true;}).catch(()=>{});}}
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
    for(const [token,remote] of multiplayer.remotePlayers){const d=remote.group.position.distanceTo(position);if(d<=4.8)reportRemoteHit(token,d<=3.2?100:48,false);}for(const m of destructibleMushrooms.values())if(m.active&&Math.hypot(m.x-position.x,m.z-position.z)<=5.2)damageMushroom(m.id,999);
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
    hitMarks.push({ mark, object, life: 12, maxLife:12 });
    // Evita acúmulo infinito de marcas em partidas longas. Mantemos só as mais recentes.
    const MAX_HIT_MARKS=32;
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
    const g = new THREE.PlaneGeometry(100, 84, 30, 26);
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
    const water = new THREE.Mesh(new THREE.PlaneGeometry(100, 8.5, 1, 18), new THREE.MeshToonMaterial({ color: 0x78b8df, transparent: true, opacity: .98 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, .16, 0); water.renderOrder=2; water.receiveShadow = true; scene.add(water);
    for (let i = -42; i <= 42; i += 3) {
      const ripple = new THREE.Mesh(new THREE.BoxGeometry(1.2 + (i % 2 ? .4 : 0), .025, .035), mat(0xb8c7c3, .45));
      ripple.position.set(i, .055, Math.sin(i * .6) * 2.3); ripple.rotation.y = .08; scene.add(ripple);
    }
    // Banks are raised, irregular ink-rock strips.
    for (const z of [-4.75, 4.75]) {
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
    const slope=Math.atan2(.50,2.7);
    const deck=addOutline(new THREE.Mesh(new THREE.BoxGeometry(5.2,.28,8.4),mat(wood)));
    deck.position.set(x,.36,0);deck.castShadow=true;deck.receiveShadow=true;scene.add(deck);
    for(const sideZ of [-1,1]){
      const ramp=addOutline(new THREE.Mesh(new THREE.BoxGeometry(5.2,.26,2.7),mat(wood)));
      ramp.position.set(x,.24,sideZ*5.55);ramp.rotation.x=sideZ*slope;
      ramp.castShadow=true;ramp.receiveShadow=true;scene.add(ramp);
    }
    const bridgeFloor=z=>{
      const az=Math.abs(z);
      return az<=4.2?.50:Math.max(.02,.50-(az-4.2)/2.7*.48);
    };
    for(let z=-6.75;z<=6.75;z+=.70){
      const plank=box(4.95,.07,.48,mat(woodLight),x,bridgeFloor(z)+.045,z,false);
      if(Math.abs(z)>4.2)plank.rotation.x=Math.sign(z)*slope;
      props.push(plank);
    }
    for(const side of [-2.42,2.42]){
      for(let z=-6.5;z<=6.5;z+=1.8)cyl(.10,1.12,mat(ink),x+side,bridgeFloor(z)+.55,z,6,false);
      const rail=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,8.4,7),mat(ink));
      rail.rotation.x=Math.PI/2;rail.position.set(x+side,1.42,0);scene.add(rail);
    }
    // Marcas de tinta nas entradas tornam as três travessias fáceis de localizar.
    for(const z of [-5.7,5.7]){
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
    for(let i=0;i<4;i++) box(4.8,.16+i*.18,.75,mat(woodLight),0,.08+i*.09,6.0+i*.66,false);
  }
  function getPlayerHeight(x,z){let best=1.7;if(window.__inkClimbPlatforms){for(const p of window.__inkClimbPlatforms){const inside=p.radius!=null?Math.hypot(x-p.cx,z-p.cz)<p.radius:(x>p.minX&&x<p.maxX&&z>p.minZ&&z<p.maxZ);if(inside&&(p.minCurrentY==null||player.pos.y>=p.minCurrentY))best=Math.max(best,1.7+p.top);}}if(best>1.7)return best;if(window.__inkRabbitTunnelInfo&&window.__inkRabbitTunnelY){const ri=window.__inkRabbitTunnelInfo(x,z);const edge=Math.min(ri.t,1-ri.t);if(ri.d<2.22&&(edge<.105||player.pos.y<.75))return ri.y??window.__inkRabbitTunnelY(ri.t);}if(Math.abs(x)<2.6||Math.abs(x-30)<2.6||Math.abs(x+30)<2.6){const az=Math.abs(z);if(az<=3.5)return 2.20;if(az<5.9)return 1.70+(5.9-az)/2.4*.50;}return 1.7;}

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

  function makeMapLabel(text,x,y,z,scale=2.5){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='rgba(252,251,247,.94)';ctx.fillRect(6,12,500,104);ctx.strokeStyle='#171510';ctx.lineWidth=8;ctx.strokeRect(6,12,500,104);ctx.fillStyle='#171510';ctx.font='900 42px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:true}));s.position.set(x,y,z);s.scale.set(scale*2.8,scale*.70,1);scene.add(s);return s;}
  function makeWorldSign(text,x,z,rot=0){const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=rot;for(const px of [-1.45,1.45]){const p=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.12,2.05,.12),mat(black)));p.position.set(px,1,0);group.add(p);}const board=addOutline(new THREE.Mesh(new THREE.BoxGeometry(3.9,1.18,.20),mat(wallLight)));board.position.set(0,2.05,0);group.add(board);const c=document.createElement('canvas');c.width=512;c.height=150;const ctx=c.getContext('2d');ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,512,150);ctx.strokeStyle='#171510';ctx.lineWidth=10;ctx.strokeRect(5,5,502,140);ctx.fillStyle='#171510';ctx.font='900 42px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,78);const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;for(const side of [-1,1]){const face=new THREE.Mesh(new THREE.PlaneGeometry(3.62,1),new THREE.MeshBasicMaterial({map:tx,side:THREE.FrontSide}));face.position.set(0,2.05,side*.112);face.rotation.y=side<0?Math.PI:0;group.add(face);}scene.add(group);return {group,board};}
  function makeCardProp(rank,suit,x,z,rot=0,scale=1){const redSuit=suit==='♥'||suit==='♦',card=box(2.5*scale,4*scale,.22*scale,mat(wall),x,2*scale,z,true);card.rotation.y=rot;const c=document.createElement('canvas');c.width=256;c.height=384;const ctx=c.getContext('2d');ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,256,384);ctx.strokeStyle='#171510';ctx.lineWidth=12;ctx.strokeRect(6,6,244,372);ctx.fillStyle=redSuit?'#d73535':'#171510';ctx.font='900 64px Georgia';ctx.textAlign='left';ctx.fillText(rank,22,72);ctx.font='900 78px Georgia';ctx.fillText(suit,22,145);ctx.textAlign='center';ctx.font='900 128px Georgia';ctx.fillText(suit,128,260);const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;for(const side of [1,-1]){const face=new THREE.Mesh(new THREE.PlaneGeometry(2.18*scale,3.55*scale),new THREE.MeshBasicMaterial({map:tx,transparent:true,side:THREE.DoubleSide}));face.position.set(x-Math.sin(rot)*.20*scale*side,2*scale,z-Math.cos(rot)*.20*scale*side);face.rotation.y=rot+(side<0?Math.PI:0);scene.add(face);}return card;}
  function makeTreeProp(x,z,s=1){s*=1.55;const trunk=cyl(.58*s,4.8*s,mat(0x2b2521),x,2.4*s,z,9,true);for(const [dx,dy,dz,rz,rx,len] of [[-1.05,3.8,0,-.72,0,3.2],[1.05,4,.1,.72,0,3.1],[0,4.15,.75,0,.72,2.8],[-.45,4.45,-.55,-.35,-.55,2.3]]){const branch=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.16*s,.30*s,len*s,7),mat(0x2b2521)));branch.position.set(x+dx*.55*s,dy*s,z+dz*s);branch.rotation.z=rz;branch.rotation.x=rx;scene.add(branch);}for(const [dx,dy,dz,k] of [[0,5.9,0,2],[-1.45,5.3,.35,1.45],[1.4,5.4,-.25,1.5],[0,6.35,.75,1.3]]){const crown=addOutline(new THREE.Mesh(new THREE.SphereGeometry(k*s,8,6),mat(0x326c4d)));crown.position.set(x+dx*s,dy*s,z+dz*s);scene.add(crown);}return trunk;}
  function spawnMushroomSmoke(m){for(let i=0;i<6;i++){const a=i/6*TAU,r=i<2?.55:1.45;const core=new THREE.Mesh(new THREE.SphereGeometry(2.25+(i%2)*.45,8,6),new THREE.MeshBasicMaterial({color:i%2?0x070a08:0x111912,transparent:true,opacity:.995,depthWrite:true,depthTest:true}));core.position.set(m.x+Math.cos(a)*r,1.45+(i%3)*.72,m.z+Math.sin(a)*r);core.userData.noBulletMark=true;core.userData.mushroomSmokeParticle=true;core.raycast=()=>{};scene.add(core);mushroomSmoke.push({mesh:core,vx:(Math.random()-.5)*.05,vy:.018,vz:(Math.random()-.5)*.05,life:7.8,max:7.8});}for(let i=0;i<58;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.82+Math.random()*1.05,7,6),new THREE.MeshBasicMaterial({color:i%5===0?0x080b09:(i%3===0?0x0e1611:0x17221b),transparent:true,opacity:.97,depthWrite:true}));const ang=Math.random()*TAU,r=Math.random()*4.9;puff.position.set(m.x+Math.cos(ang)*r,.50+Math.random()*4.8,m.z+Math.sin(ang)*r);puff.userData.noBulletMark=true;puff.userData.mushroomSmokeParticle=true;puff.raycast=()=>{};scene.add(puff);mushroomSmoke.push({mesh:puff,vx:(Math.random()-.5)*.22,vy:.035+Math.random()*.12,vz:(Math.random()-.5)*.22,life:7+Math.random()*1.5,max:8.5});}}
    function makeDestructibleMushroom(id,x,z,s=1){const group=new THREE.Group();group.position.set(x,0,z);const stem=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.70*s,.95*s,2.8*s,8),mat(wallLight)));stem.position.y=1.4*s;group.add(stem);const cap=addOutline(new THREE.Mesh(new THREE.SphereGeometry(2.05*s,11,7),mat(0x178a47)));cap.scale.y=.52;cap.position.y=3.05*s;group.add(cap);for(let i=0;i<9;i++){const spot=new THREE.Mesh(new THREE.CircleGeometry(.20*s,8),new THREE.MeshBasicMaterial({color:i%2?0xf6f2df:red,side:THREE.DoubleSide}));const a=i/9*TAU;spot.position.set(Math.cos(a)*1.45*s,3.56*s,Math.sin(a)*1.45*s);spot.rotation.x=-Math.PI/2;group.add(spot);}group.traverse(o=>{if(o.isMesh)o.userData.mushroomId=id;});scene.add(group);const collider={minX:x-1.35*s,maxX:x+1.35*s,minZ:z-1.35*s,maxZ:z+1.35*s,height:3.8*s,active:true};colliders.push(collider);const rec={id,x,z,group,collider,hp:120,active:true,respawn:0};destructibleMushrooms.set(id,rec);return rec;}
  function applyMushroomState(st){const m=destructibleMushrooms.get(st?.id);if(!m)return;const active=st.active!==false&&(Number(st.hp)||0)>0;if(m.active&&!active)spawnMushroomSmoke(m);m.active=active;m.hp=active?Math.max(1,Number(st.hp)||120):0;m.group.visible=active;m.collider.active=active;m.group.traverse(o=>{if(o.isMesh)o.userData.noBulletMark=!active;});if(active)m.respawn=0;}
  async function damageMushroom(id,damage){const m=destructibleMushrooms.get(id);if(!m||!m.active)return;if(multiplayer.room?.status==='playing'){try{await fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prop_hit',token:multiplayer.token,roomCode:multiplayer.roomCode,propId:id,damage:Math.round(damage)})});}catch(_){}}else{m.hp-=damage;if(m.hp<=0){applyMushroomState({id,hp:0,active:false});m.respawn=60;}}}window.__inkRealtimeProp=st=>{if(String(st?.id||'').startsWith('r'))applyRabbitState(st);else applyMushroomState(st);};
  function buildCombatMaze(){const cols=8,rows=7,cell=4.25,ox=-43,oz=10.2,H=4.25,T=.44;const visited=Array.from({length:rows},()=>Array(cols).fill(false)),walls=Array.from({length:rows},()=>Array.from({length:cols},()=>({n:true,e:true,s:true,w:true})));let seed=761;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),stack=[[0,0]];visited[0][0]=true;while(stack.length){const [cx,cz]=stack[stack.length-1],opts=[];if(cz>0&&!visited[cz-1][cx])opts.push([cx,cz-1,'n','s']);if(cx<cols-1&&!visited[cz][cx+1])opts.push([cx+1,cz,'e','w']);if(cz<rows-1&&!visited[cz+1][cx])opts.push([cx,cz+1,'s','n']);if(cx>0&&!visited[cz][cx-1])opts.push([cx-1,cz,'w','e']);if(!opts.length){stack.pop();continue;}const [nx,nz,a,b]=opts[Math.floor(rnd()*opts.length)];walls[cz][cx][a]=false;walls[nz][nx][b]=false;visited[nz][nx]=true;stack.push([nx,nz]);}for(let z=1;z<rows-1;z++)for(let x=1;x<cols-1;x++)if(rnd()<.24){const d=[['e','w',1,0],['s','n',0,1]][Math.floor(rnd()*2)],nx=x+d[2],nz=z+d[3];walls[z][x][d[0]]=false;walls[nz][nx][d[1]]=false;}walls[0][1].n=false;walls[0][5].n=false;walls[2][cols-1].e=false;walls[5][cols-1].e=false;const hedgeMat=mat(0xe8eee5),wallSeg=(x,z,w,d)=>{const m=box(w,H,d,hedgeMat,x,H/2,z,true);addHatching(m,Math.max(.5,w*.62),3,Math.max(.08,d*.3),7,true);return m;};for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){const cx=ox+x*cell+cell/2,cz=oz+z*cell+cell/2;if(walls[z][x].n)wallSeg(cx,oz+z*cell,cell+T,T);if(walls[z][x].w)wallSeg(ox+x*cell,cz,T,cell+T);if(x===cols-1&&walls[z][x].e)wallSeg(ox+cols*cell,cz,T,cell+T);if(z===rows-1&&walls[z][x].s)wallSeg(cx,oz+rows*cell,cell+T,T);}makeWorldSign('LABIRINTO',-27,40.1,0);}
  function buildQueenCourt(){const court=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(11.5,12,.30,24),mat(0xf7f3ea)));court.position.set(0,.16,10);scene.add(court);for(let i=0;i<12;i++){const a=i/12*TAU;const post=cyl(.28,2.7,mat(i%2?red:black),Math.cos(a)*10.2,1.35,10+Math.sin(a)*8.2,8,true);post.userData.noBulletMark=true;}const throne=box(4.4,5.6,1.4,mat(wall),0,2.8,15.5,true);addHatching(throne,3.2,4.3,.72,9,true);box(3.4,1.0,2.4,mat(red),0,1.15,14.8,true);const dress=addOutline(new THREE.Mesh(new THREE.ConeGeometry(1.7,3.4,8),mat(red)));dress.position.set(0,3.1,14.6);scene.add(dress);const head=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.72,9,7),mat(wallLight)));head.position.set(0,5.05,14.6);scene.add(head);for(const sx of [-1,1]){const hair=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.65,8,6),mat(black)));hair.position.set(sx*.55,5.05,14.65);scene.add(hair);}const crown=addOutline(new THREE.Mesh(new THREE.ConeGeometry(.92,1.1,5),mat(red)));crown.position.set(0,6.15,14.6);crown.rotation.y=.25;scene.add(crown);cyl(.10,3.0,mat(black),1.6,4.0,14.5,7,false);const heart=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.32,7,5),mat(red)));heart.scale.x=1.2;heart.position.set(1.6,5.55,14.5);scene.add(heart);for(const [x,z] of [[-7,8],[7,8],[-7,13],[7,13],[-4,3],[4,3]])makeCardProp((Math.abs(x)+Math.abs(z))%2?'Q':'A',(x<0?'♠':'♥'),x,z,x<0?.12:-.12,.75);makeWorldSign('RAINHA DE COPAS',0,20.1,0);}
  function buildTeaParty(){
    const tx=27,tz=-25,tableTop=3.55;
    const tableMat=mat(wallLight);tableMat.side=THREE.DoubleSide;
    const table=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(7.0,7.0,.55,24),tableMat));table.position.set(tx,tableTop-.275,tz);scene.add(table);
    // Pé central: deixa o espaço sob a mesa livre, bloqueando somente a coluna real.
    cyl(1.0,tableTop-.20,mat(wood),tx,(tableTop-.20)/2,tz,12,true);
    colliders.push({minX:tx-1.05,maxX:tx+1.05,minZ:tz-1.05,maxZ:tz+1.05,height:tableTop-.15});
    for(let i=0;i<8;i++){if(i===4||i===3)continue;const a=i/8*TAU;const chair=box(2.2,4.0,2.0,mat(i%2?red:blue),tx+Math.cos(a)*10,2.0,tz+Math.sin(a)*9.2,true);chair.rotation.y=-a;}
    const pot=addOutline(new THREE.Mesh(new THREE.SphereGeometry(2.0,14,10),mat(wall)));pot.position.set(tx,tableTop+1.10,tz);scene.add(pot);cyl(.75,.35,mat(red),tx,tableTop+2.72,tz,12,false);
    for(const [dx,dz] of [[-3.2,2.1],[3.0,-2.0],[1.8,3.7],[-1.2,-3.6]]){cyl(.85,1.3,mat(wall),tx+dx,tableTop+.42,tz+dz,10,false);const tea=cyl(.65,.05,mat(red),tx+dx,tableTop+1.10,tz+dz,10,false);tea.userData.noBulletMark=true;}
    // Degraus mais baixos e sobrepostos: sobe andando, sem exigir pulo.
    const steps=10;for(let i=0;i<steps;i++){const top=.28+i*((tableTop-.08-.28)/(steps-1)),w=4.9,d=2.75,xx=14.9+i*1.15,zz=-25;box(w,.20,d,mat(i===steps-1?red:woodLight),xx,top-.10,zz,false);window.__inkClimbPlatforms.push({minX:xx-w/2,maxX:xx+w/2,minZ:zz-d/2,maxZ:zz+d/2,top,minCurrentY:i===0?1.55:1.7+(.28+(i-1)*((tableTop-.08-.28)/(steps-1)))-.28});}
    window.__inkClimbPlatforms.push({cx:tx,cz:tz,radius:6.65,top:tableTop,minCurrentY:1.7+tableTop-.42});makeWorldSign('CHÁ MALUCO',27,-37.5,0);
  }
  function buildRabbitTunnel(){
    const pts=[[-42,-34],[-42,-20],[-42,34],[28,34],[42,34]];window.__inkRabbitPath=pts;
    let total=0,lens=[];for(let i=0;i<pts.length-1;i++){const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);lens.push(l);total+=l;}
    window.__inkRabbitTunnelY=t=>{const ramp=.095;if(t<ramp)return 1.7-(t/ramp)*4.15;if(t>1-ramp)return 1.7-((1-t)/ramp)*4.15;return -2.45;};
    window.__inkRabbitTunnelInfo=function(x,z){let best={d:1e9,t:0,y:1.7},acc=0;for(let i=0;i<pts.length-1;i++){const [ax,az]=pts[i],[bx,bz]=pts[i+1],vx=bx-ax,vz=bz-az,ll=vx*vx+vz*vz;let u=((x-ax)*vx+(z-az)*vz)/ll;u=Math.max(0,Math.min(1,u));const px=ax+vx*u,pz=az+vz*u,d=Math.hypot(x-px,z-pz),t=(acc+lens[i]*u)/total;if(d<best.d)best={d,t,y:window.__inkRabbitTunnelY(t)};acc+=lens[i];}return best;};
    makeWorldSign('TOCA DO COELHO',-37,-36,0);makeWorldSign('TOCA DO COELHO',37,38,Math.PI);
    // Segmentos curtos evitam paredes gigantes cruzando a câmera nas rampas/curvas.
    let acc=0;for(let i=0;i<pts.length-1;i++){const [ax,az]=pts[i],[bx,bz]=pts[i+1],len=lens[i],pieces=Math.max(1,Math.ceil(len/5));for(let j=0;j<pieces;j++){const u0=j/pieces,u1=(j+1)/pieces,um=(u0+u1)/2;const x0=ax+(bx-ax)*u0,z0=az+(bz-az)*u0,x1=ax+(bx-ax)*u1,z1=az+(bz-az)*u1,mx=(x0+x1)/2,mz=(z0+z1)/2,segLen=Math.hypot(x1-x0,z1-z0),t0=(acc+len*u0)/total,t1=(acc+len*u1)/total,tm=(t0+t1)/2,y0=window.__inkRabbitTunnelY(t0)-1.7,y1=window.__inkRabbitTunnelY(t1)-1.7,ym=(y0+y1)/2,yaw=Math.atan2(x1-x0,z1-z0),pitch=Math.atan2(y1-y0,segLen);
      const floorMat=mat(wallLight);floorMat.side=THREE.DoubleSide;const floor=box(5.75,.24,segLen+.22,floorMat,mx,ym,mz,false);floor.rotation.order='YXZ';floor.rotation.y=yaw;floor.rotation.x=-pitch;
      for(const side of [-1,1]){const wx=mx+Math.cos(yaw)*side*2.76,wz=mz-Math.sin(yaw)*side*2.76;const wallMat=mat(wall);wallMat.side=THREE.DoubleSide;const extra=Math.abs(y1-y0);const wallSeg=box(.30,3.35+extra,segLen+.28,wallMat,wx,ym+1.58,wz,false);wallSeg.rotation.y=yaw;}
      if(window.__inkRabbitTunnelY(tm)<-.9){const roofMat=mat(0xe8e2d5);roofMat.side=THREE.DoubleSide;const roof=box(5.90,.24,segLen+.25,roofMat,mx,ym+3.18,mz,false);roof.rotation.order='YXZ';roof.rotation.y=yaw;roof.rotation.x=-pitch;roof.userData.rabbitRoof=true;}
    }acc+=len;}
  }
  function makeDestructibleRabbit(id,x,z,yaw=0){
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=yaw;
    const white=new THREE.MeshToonMaterial({color:0xf8f4e8,flatShading:true,side:THREE.DoubleSide});
    const body=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.48,9,7),white),2.1);body.scale.set(.82,1.15,.82);body.position.y=.62;g.add(body);
    const head=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.34,9,7),white),2.1);head.position.set(0,1.18,-.10);g.add(head);
    for(const sx of [-1,1]){const ear=addOutline(new THREE.Mesh(new THREE.CapsuleGeometry(.09,.42,3,5),white),1.8);ear.position.set(sx*.15,1.62,-.04);ear.rotation.z=sx*.12;g.add(ear);}
    for(const sx of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5),new THREE.MeshBasicMaterial({color:0xd73535}));eye.position.set(sx*.13,1.24,-.405);g.add(eye);}
    g.traverse(o=>{if(o.isMesh)o.userData.rabbitId=id;});scene.add(g);
    const rec={id,x,z,group:g,hp:80,active:true,respawn:0};destructibleRabbits.set(id,rec);return rec;
  }
  function applyRabbitState(st){const r=destructibleRabbits.get(st?.id);if(!r)return;const active=st.active!==false&&(Number(st.hp)||0)>0;r.active=active;r.hp=active?Math.max(1,Number(st.hp)||80):0;r.group.visible=active;if(active)r.respawn=0;}
  async function damageRabbit(id,damage){const r=destructibleRabbits.get(id);if(!r||!r.active)return;if(multiplayer.room?.status==='playing'){try{const res=await fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prop_hit',token:multiplayer.token,roomCode:multiplayer.roomCode,propId:id,damage:Math.round(damage)})});const st=await res.json();if(st?.id)applyRabbitState(st);}catch(_){}}else{r.hp-=damage;if(r.hp<=0){applyRabbitState({id,hp:0,active:false});r.respawn=30;}}}
  function buildCheshireCat(){const gr=new THREE.Group();const body=addOutline(new THREE.Mesh(new THREE.SphereGeometry(1.05,9,7),mat(black)));body.scale.set(1.5,.75,1);gr.add(body);const head=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.78,9,7),mat(0x2c3140)));head.position.set(0,1.05,0);gr.add(head);for(const sx of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.13,6,5),new THREE.MeshBasicMaterial({color:0x66d7ff}));eye.position.set(sx*.27,1.18,-.69);gr.add(eye);}const smile=new THREE.Mesh(new THREE.TorusGeometry(.34,.055,6,18,Math.PI),new THREE.MeshBasicMaterial({color:red}));smile.position.set(0,.9,-.7);smile.rotation.z=Math.PI;gr.add(smile);gr.position.set(-28.125,1.4,25.075);gr.userData.hp=180;gr.userData.phase=0;gr.userData.alive=true;gr.userData.respawn=0;gr.userData.dir=new THREE.Vector3(1,0,.35).normalize();gr.traverse(o=>{if(o.isMesh)o.userData.cheshire=true;});scene.add(gr);cheshireCat=gr;}
  function buildGoldenInkwell(){const gr=new THREE.Group();const pot=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.48,.60,.85,10),new THREE.MeshToonMaterial({color:0xd6a617,emissive:0x4a3000})));pot.position.y=.45;gr.add(pot);const neck=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.30,.42,.30,10),mat(0xf1cf52)));neck.position.y=.95;gr.add(neck);const glow=new THREE.Mesh(new THREE.TorusGeometry(.78,.07,7,20),new THREE.MeshBasicMaterial({color:0xffdf5a,transparent:true,opacity:.9}));glow.rotation.x=Math.PI/2;glow.position.y=.18;gr.add(glow);const label=makeComicSprite('TINTEIRO DOURADO');label.position.set(0,1.65,0);label.scale.set(2.2,.62,1);gr.add(label);gr.position.set(-27,.05,24);gr.visible=false;gr.traverse(o=>{if(o.isMesh)o.userData.noBulletMark=true;});scene.add(gr);goldenInkwell=gr;}
  function setGoldenRewardState(st){if(!goldenInkwell||!st)return;goldenInkwell.visible=st.active===true;goldenInkwell.userData.respawn=Math.max(0,Number(st.respawnMs||0)/1000);if(st.message){hitNoticeEl.textContent=st.message;hitNoticeEl.classList.add('show');hitNoticeTimer=2.2;}}window.__inkRealtimeReward=st=>setGoldenRewardState(st);
  async function tryTakeGoldenReward(){if(!goldenInkwell?.visible||rewardTakeBusy)return;if(player.pos.distanceTo(goldenInkwell.position)>1.7)return;rewardTakeBusy=true;if(multiplayer.room?.status==='playing'){try{const r=await fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reward_take',token:multiplayer.token,roomCode:multiplayer.roomCode})});const d=await r.json();if(d?.ok){hp=100;armor=100;reserveAmmo={...RESERVE_AMMO};if(weaponMode!=='knife')ammo=MAGAZINES[weaponMode]||ammo;setGoldenRewardState({active:false,respawnMs:d.respawnMs||90000});hitNoticeEl.textContent='TINTEIRO DOURADO • VIDA + COLETE + MUNIÇÃO!';hitNoticeEl.classList.add('show');hitNoticeTimer=1.8;updateHud();}}catch(_){ }finally{rewardTakeBusy=false;}}else{goldenInkwell.visible=false;rewardLocalRespawn=90;hp=100;armor=100;reserveAmmo={...RESERVE_AMMO};if(weaponMode!=='knife')ammo=MAGAZINES[weaponMode]||ammo;hitNoticeEl.textContent='TINTEIRO DOURADO • VIDA + COLETE + MUNIÇÃO!';hitNoticeEl.classList.add('show');hitNoticeTimer=1.8;updateHud();rewardTakeBusy=false;}}
  function setCheshireState(st){if(!cheshireCat||!st)return;cheshireCat.userData.hp=Number(st.hp??cheshireCat.userData.hp);cheshireCat.userData.alive=st.active!==false&&cheshireCat.userData.hp>0;cheshireCat.visible=cheshireCat.userData.alive;cheshireCat.userData.respawn=Number(st.respawnMs||0)/1000;}window.__inkRealtimeCat=st=>setCheshireState(st);
  async function damageCheshire(amount){if(!cheshireCat?.userData.alive)return;if(multiplayer.room?.status==='playing'){try{const r=await fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cat_hit',token:multiplayer.token,roomCode:multiplayer.roomCode,damage:Math.round(amount)})});setCheshireState(await r.json());}catch(_){}}else{cheshireCat.userData.hp-=amount;if(cheshireCat.userData.hp<=0){cheshireCat.userData.alive=false;cheshireCat.visible=false;cheshireCat.userData.respawn=10;if(goldenInkwell)goldenInkwell.visible=true;}}}
  function catBlocked(x,z){const r=.85;for(const c of colliders){if(c.active===false)continue;if(x+r>c.minX&&x-r<c.maxX&&z+r>c.minZ&&z-r<c.maxZ)return true;}return false;}
  function updateCheshireCat(dt){if(!cheshireCat)return;if(!cheshireCat.userData.alive){if(multiplayer.room?.status!=='playing'){cheshireCat.userData.respawn-=dt;if(cheshireCat.userData.respawn<=0){cheshireCat.userData.hp=180;cheshireCat.userData.alive=true;cheshireCat.visible=true;}}return;}cheshireCat.userData.phase=(cheshireCat.userData.phase||0)+dt*1.55;const a=cheshireCat.userData.phase;cheshireCat.position.x=-28.125+Math.cos(a)*1.52;cheshireCat.position.z=25.075+Math.sin(a*.86)*1.18;cheshireCat.rotation.y=-a+.55;cheshireCat.position.y=1.5+Math.sin(performance.now()/260)*.14;cheshireHitCooldown=Math.max(0,cheshireHitCooldown-dt);if(player.pos.y>0&&cheshireHitCooldown<=0&&player.pos.distanceTo(cheshireCat.position)<2.45){cheshireHitCooldown=1.15;triggerDamageFeedback(28);hitNoticeEl.textContent='ARRANHÃO!';hitNoticeEl.classList.add('show');hitNoticeTimer=.65;if(multiplayer.room?.status==='playing')fetch('/api/multiplayer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'hazardhit',token:multiplayer.token,roomCode:multiplayer.roomCode})}).catch(()=>{});else{let d=28;if(armor>0){const ar=Math.min(armor,10);armor-=ar;d-=ar;}hp=Math.max(0,hp-d);updateHud();}}}
  function buildSeasonalReinoDasCopas(){window.__inkClimbPlatforms=[];buildCombatMaze();buildQueenCourt();buildTeaParty();buildRabbitTunnel();makeDestructibleRabbit('r1',-42,-18,.15);makeDestructibleRabbit('r2',30,34,Math.PI+.15);buildCheshireCat();buildGoldenInkwell();const cards=[['A','♥',-6,-34,.12,1.15],['7','♠',12,31,-.2,1.0],['Q','♦',31,14,.18,1.05],['3','♣',-7,27,-.12,.9],['K','♥',43,-10,.12,1.0],['9','♦',-44,5,-.08,.95],['5','♠',-30,-27,.16,1.0],['J','♦',-17,-31,-.14,1.0],['8','♣',16,-17,.10,.95],['2','♥',34,-33,-.12,1.0]];for(const c of cards)makeCardProp(...c);for(const [x,z,s] of [[-45,34,1.05],[45,35,1.0],[-9,-36,.85],[9,35,.8],[44,-36,.9],[-46,-35,.85]])makeTreeProp(x,z,s);for(const [id,x,z,s] of [['m1',-34,-27,1.2],['m2',-19,-34,1.05],['m3',18,-34,1.15],['m4',37,-21,1.15],['m5',33,22,1.0],['m6',-8,4,.95],['m7',13,23,.9],['m8',-3,-14,.9]])makeDestructibleMushroom(id,x,z,s);for(const [x,z] of [[-47,18],[46,12],[-7,-20],[12,-12]]){const levels=[[6.4,.22,4.3,.22,0],[6.0,.22,4.0,.48,.90],[5.6,.22,3.7,.74,1.80]];for(let j=0;j<levels.length;j++){const [w,hh,d,top,dz]=levels[j],zz=z+dz;box(w,hh,d,mat(j===2?red:(j%2?woodLight:wall)),x,top-hh/2,zz,false);window.__inkClimbPlatforms.push({minX:x-w/2,maxX:x+w/2,minZ:zz-d/2,maxZ:zz+d/2,top,minCurrentY:j===0?1.58:1.7+levels[j-1][3]-.20});}}for(const x of [-49,49])box(.18,.05,82,mat(ink),x,.03,0,false);box(98,.05,.18,mat(ink),0,.03,41,false);box(98,.05,.18,mat(ink),0,.03,-41,false);for(const [x,z,color] of [[0,36,blue],[0,-36,red]])box(8,.10,.8,mat(color),x,.08,z,false);}

  function buildJumpPads(){for(const [x,z,color] of [[18,18,blue],[-18,-18,red]]){const base=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.65,.28,16),mat(color)));base.position.set(x,.14,z);scene.add(base);const ring=addOutline(new THREE.Mesh(new THREE.TorusGeometry(1,.12,7,18),mat(black)));ring.rotation.x=Math.PI/2;ring.position.set(x,.34,z);scene.add(ring);for(let i=0;i<6;i++){const a=i/6*TAU;const spring=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.42,6),mat(black)));spring.position.set(x+Math.cos(a)*.95,.43,z+Math.sin(a)*.95);scene.add(spring);}makeMapLabel('PULA-PULA',x,.65,z,1);}}
  function buildWorld() {buildGround();buildRiver();buildBridge(-32);buildBridge(0);buildBridge(32);buildSeasonalReinoDasCopas();buildJumpPads();buildTeamSpawnGuides();}
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
    const scopeBody=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.105,.13,.78,10),mat(ink)));
    scopeBody.rotation.x=Math.PI/2; scopeBody.position.set(.40,.00,-1.34); g.add(scopeBody);
    for(const z of [-1.78,-.91]){
      const ring=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(.145,.145,.08,10),mat(wallLight)));
      ring.rotation.x=Math.PI/2; ring.position.set(.40,.00,z); g.add(ring);
    }
    const lens=new THREE.Mesh(new THREE.CircleGeometry(.078,16),new THREE.MeshBasicMaterial({color:0x1c2735,transparent:true,opacity:.22,depthWrite:false}));
    lens.rotation.x=-Math.PI/2; lens.position.set(.40,.00,-1.83); lens.userData.sniperLens=true; g.add(lens);
    g.scale.set(.78,.78,.78);g.position.set(.08,-.10,.32); g.rotation.order='XYZ';
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
    g.scale.set(.80,.80,.80);g.position.set(.10,-.10,.38); g.rotation.order='XYZ'; camera.add(g); weaponVariants.smg=g;
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
    const pumpBand=new THREE.Mesh(new THREE.BoxGeometry(.46,.34,.84),mat(red));pumpBand.position.set(.42,-.36,-2.04);g.add(pumpBand);const lowerTube=new THREE.Mesh(new THREE.CylinderGeometry(.045,.052,1.55,8),mat(black));lowerTube.rotation.x=Math.PI/2;lowerTube.position.set(.42,-.45,-2.62);g.add(lowerTube);g.scale.set(.90,.90,.96);g.position.set(.02,-.04,.06); g.rotation.order='XYZ'; camera.add(g); weaponVariants.shotgun=g;
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
  for(const v of Object.values(weaponVariants))v.traverse(o=>{if(o.isLine||o.isLineSegments){o.visible=false;o.frustumCulled=true;}});
  // V13: remove traços auxiliares/hachuras da arma em primeira pessoa que podiam vazar pela tela.
  weaponVariants.sniper.visible=false; weaponVariants.smg.visible=false; weaponVariants.shotgun.visible=false; weaponVariants.launcher.visible=false; weaponVariants.knife.visible=false;

  function setWeaponMode(mode){
    reloadToken++;
    weaponMode=mode;
    for(const key of weaponModes) weaponVariants[key].visible=(key===mode);
    scopeMode=false; adsProgress=0; fireCooldown=0; reloadTimer=0;
    if(mode!=='knife') ammo=Math.min(MAGAZINES[mode],reserveAmmo[mode]+ammo);
    if(mode==='knife') ammo=0;
    reloadBtn.style.display=mode==='knife'?'none':'block';
    reloadBtn.textContent='↻';
    const labels={rifle:'FUZIL',sniper:'SNIPER',smg:'SUBMETRALHADORA',shotgun:'ESPINGARDA',launcher:'LANÇA-FOGOS',knife:'FACA'};
    weaponSwitchBtn.textContent='ARMA: '+labels[mode];
    weaponSwitchBtn.style.background=mode==='sniper'?'rgba(49,94,155,.9)':mode==='knife'?'rgba(215,53,53,.82)':'rgba(238,231,212,.82)';
    weaponSwitchBtn.style.color=mode==='sniper'||mode==='knife'?'#fff':'#171510';
    scopeBtn.style.display=(mode==='rifle'||mode==='sniper')?'block':'none';
  }

  const scopeBtn = document.createElement('button');
  scopeBtn.id='scopeControl';
  scopeBtn.textContent='◎';
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
  const movableControls=[stick,fireBtn,fireLeftBtn,weaponSwitchBtn,reloadBtn,scopeBtn,jumpBtn,fullscreenBtn,hudVitalsEl,hudStatsEl].filter(Boolean);
  for(const p of [hudVitalsEl,hudStatsEl])if(p){p.style.pointerEvents='none';p.style.zIndex='20';}
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
    for(const el of movableControls){el.style.filter=controlsEditing?'drop-shadow(0 0 5px #d73535)':'';if(el===hudVitalsEl||el===hudStatsEl)el.style.pointerEvents=controlsEditing?'auto':'none';}
  });
  const resetLayoutBtn=document.createElement('button');
  resetLayoutBtn.textContent='RESTAURAR PADRÃO';
  resetLayoutBtn.style.cssText='position:fixed;left:50%;top:88px;transform:translateX(-50%);z-index:22;padding:7px 10px;border:2px solid #171510;border-radius:9px;background:#f3dfd7;color:#171510;font:700 11px Georgia;pointer-events:auto;display:none';
  document.body.appendChild(resetLayoutBtn);
  resetLayoutBtn.addEventListener('pointerdown',e=>{
    e.preventDefault();e.stopPropagation();localStorage.removeItem('inkopsControlLayout');
    for(const el of movableControls){const d=defaultControlPlacement.get(el);Object.assign(el.style,d);delete savedLayout[el.id];}
  });
  const hudOpacityBtn=document.createElement('button');hudOpacityBtn.style.cssText='position:fixed;left:50%;top:124px;transform:translateX(-50%);z-index:22;padding:7px 10px;border:2px solid #171510;border-radius:9px;background:#eef1f8;color:#171510;font:700 11px Georgia;pointer-events:auto;display:none';document.body.appendChild(hudOpacityBtn);let hudOpacity=Number(localStorage.getItem('inkopsHudOpacity')||.60);const applyHudOpacity=()=>{if(hudVitalsEl)hudVitalsEl.style.opacity=String(hudOpacity);if(hudStatsEl)hudStatsEl.style.opacity=String(hudOpacity);hudOpacityBtn.textContent='HUD '+Math.round(hudOpacity*100)+'%';};applyHudOpacity();hudOpacityBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const levels=[1,.75,.6,.4,.25,.15];let i=levels.findIndex(v=>Math.abs(v-hudOpacity)<.02);hudOpacity=levels[(i+1+levels.length)%levels.length];localStorage.setItem('inkopsHudOpacity',String(hudOpacity));applyHudOpacity();});
  const updateLayoutTools=()=>{resetLayoutBtn.style.display=controlsEditing?'block':'none';hudOpacityBtn.style.display=controlsEditing?'block':'none';if(typeof cancelScopeBtn!=='undefined')cancelScopeBtn.style.display=controlsEditing?'block':(scopeMode&&weaponMode==='sniper'?'block':'none');};
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
  lensRing.style.cssText='position:absolute;left:50%;top:50%;width:min(82vw,82vh);height:min(82vw,82vh);transform:translate(-50%,-50%);border:3px solid rgba(18,25,31,.88);border-radius:50%;box-shadow:0 0 0 2px rgba(244,241,229,.35),inset 0 0 34px rgba(0,0,0,.42);';
  sniperScope.appendChild(lensRing);
  const scopeReticle=document.createElement('div');
  scopeReticle.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;';
  const retH=document.createElement('div');
  retH.style.cssText='position:absolute;width:min(60vw,60vh);height:2px;background:rgba(24,28,30,.9);box-shadow:0 0 0 1px rgba(244,241,229,.28);';
  const retV=document.createElement('div');
  retV.style.cssText='position:absolute;height:min(60vw,60vh);width:2px;background:rgba(24,28,30,.9);box-shadow:0 0 0 1px rgba(244,241,229,.28);';
  const retDot=document.createElement('div');
  retDot.style.cssText='position:absolute;width:7px;height:7px;border:2px solid rgba(24,28,30,.95);border-radius:50%;background:rgba(244,241,229,.55);box-shadow:0 0 0 1px rgba(255,255,255,.28);';
  scopeReticle.append(retH,retV,retDot);
  sniperScope.appendChild(scopeReticle);
  const rangeMarks=document.createElement('div');
  rangeMarks.textContent='·   ·   ·   ·   ·';
  rangeMarks.style.cssText='position:absolute;left:50%;top:calc(50% + min(16vw,16vh));transform:translateX(-50%);font:700 18px Georgia,serif;letter-spacing:10px;color:rgba(20,25,29,.86);text-shadow:0 0 2px rgba(255,255,255,.5);';
  sniperScope.appendChild(rangeMarks);
  document.body.appendChild(sniperScope);

  let sniperAimArmed=false,sniperAimPointer=null,sniperReleaseStamp=0,sniperQueuedAim=null;
  const cancelScopeBtn=document.createElement('button');cancelScopeBtn.id='cancelScope';cancelScopeBtn.textContent='CANCELAR';cancelScopeBtn.style.cssText='position:fixed;left:7%;bottom:18%;z-index:62;display:none;padding:9px 16px;border:3px solid #171510;border-radius:10px;background:rgba(215,53,53,.92);color:#fff;font:900 13px Georgia;pointer-events:auto';document.body.appendChild(cancelScopeBtn);movableControls.push(cancelScopeBtn);cancelScopeBtn.style.userSelect='none';cancelScopeBtn.style.webkitUserSelect='none';cancelScopeBtn.style.touchAction='none';cancelScopeBtn.setAttribute('draggable','false');if(savedLayout[cancelScopeBtn.id])placeControl(cancelScopeBtn,savedLayout[cancelScopeBtn.id]);cancelScopeBtn.addEventListener('pointerdown',e=>{if(!controlsEditing)return;e.preventDefault();e.stopImmediatePropagation();const r=cancelScopeBtn.getBoundingClientRect();movingControl=cancelScopeBtn;movingOffsetX=e.clientX-r.left;movingOffsetY=e.clientY-r.top;cancelScopeBtn.setPointerCapture?.(e.pointerId);cancelScopeBtn.style.outline='4px dashed #d73535';},true);if(savedLayout[cancelScopeBtn.id])placeControl(cancelScopeBtn,savedLayout[cancelScopeBtn.id]);cancelScopeBtn.style.userSelect='none';cancelScopeBtn.style.touchAction='none';cancelScopeBtn.addEventListener('pointerdown',e=>{if(!controlsEditing)return;e.preventDefault();e.stopImmediatePropagation();const r=cancelScopeBtn.getBoundingClientRect();movingControl=cancelScopeBtn;movingOffsetX=e.clientX-r.left;movingOffsetY=e.clientY-r.top;cancelScopeBtn.setPointerCapture?.(e.pointerId);cancelScopeBtn.style.outline='4px dashed #d73535';},true);movableControls.push(cancelScopeBtn);defaultControlPlacement.set(cancelScopeBtn,{position:cancelScopeBtn.style.position,left:cancelScopeBtn.style.left,top:cancelScopeBtn.style.top,right:cancelScopeBtn.style.right,bottom:cancelScopeBtn.style.bottom});if(savedLayout[cancelScopeBtn.id])placeControl(cancelScopeBtn,savedLayout[cancelScopeBtn.id]);cancelScopeBtn.addEventListener('pointerdown',e=>{if(!controlsEditing)return;e.preventDefault();e.stopImmediatePropagation();const r=cancelScopeBtn.getBoundingClientRect();movingControl=cancelScopeBtn;movingOffsetX=e.clientX-r.left;movingOffsetY=e.clientY-r.top;cancelScopeBtn.setPointerCapture?.(e.pointerId);cancelScopeBtn.style.outline='4px dashed #d73535';},true);
  function closeScope(cancelShot=false){if(cancelShot){sniperAimArmed=false;sniperQueuedAim=null;}scopeMode=false;scopeBtn._look=null;scopeBtn.style.background='rgba(238,231,212,.82)';scopeBtn.style.color='#171510';cancelScopeBtn.style.display=controlsEditing?'block':'none';}
  function fireSniperRelease(){if(!sniperAimArmed||weaponMode!=='sniper'||!running)return;const now=performance.now();if(now-sniperReleaseStamp<90)return;sniperReleaseStamp=now;sniperAimArmed=false;sniperQueuedAim=null;if(ammo>0&&reloadTimer<=0){if(fireCooldown<=.10){fireCooldown=0;shoot();}else{hitNoticeEl.textContent='SNIPER CICLANDO';hitNoticeEl.classList.add('show');hitNoticeTimer=.35;}}closeScope(false);}
  function toggleScope(){if(!running||weaponMode==='knife')return;scopeMode=!scopeMode;if(!scopeMode)sniperAimArmed=false;scopeBtn.style.background=scopeMode?'rgba(49,94,155,.9)':'rgba(238,231,212,.82)';scopeBtn.style.color=scopeMode?'#fff':'#171510';centerEl.style.opacity=scopeMode&&weaponMode==='sniper'?'0':'1';cancelScopeBtn.style.display=controlsEditing?'block':(scopeMode&&weaponMode==='sniper'?'block':'none');}
  scopeBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!running||weaponMode==='knife')return;scopeMode=true;scopeBtn._look={id:e.pointerId,x:e.clientX,y:e.clientY};sniperAimPointer=e.pointerId;scopeBtn.setPointerCapture?.(e.pointerId);scopeBtn.style.background='rgba(49,94,155,.9)';scopeBtn.style.color='#fff';if(weaponMode==='sniper'){sniperAimArmed=true;cancelScopeBtn.style.display='block';}else if(weaponMode==='rifle'){fireHeld=true;shoot();}});
  scopeBtn.addEventListener('pointermove',e=>{if(!scopeBtn._look||e.pointerId!==scopeBtn._look.id)return;const dx=e.clientX-scopeBtn._look.x,dy=e.clientY-scopeBtn._look.y;if(Math.abs(dx)+Math.abs(dy)>2){look(dx,dy,.0036);scopeBtn._look.x=e.clientX;scopeBtn._look.y=e.clientY;}});
  scopeBtn.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();if(weaponMode==='sniper'&&e.pointerId===sniperAimPointer)fireSniperRelease();else{fireHeld=false;closeScope(false);}});
  scopeBtn.addEventListener('pointercancel',e=>{e.preventDefault();e.stopPropagation();fireHeld=false;closeScope(true);});document.addEventListener('pointerup',e=>{if(weaponMode==='sniper'&&sniperAimArmed&&e.pointerId===sniperAimPointer)fireSniperRelease();},{passive:true});cancelScopeBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fireHeld=false;sniperAimArmed=false;closeScope(true);});
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
      noiseBurst(.20,.82,320,3400);
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(92,now); o.frequency.exponentialRampToValueAtTime(36,now+.18);
      g.gain.setValueAtTime(.56,now); g.gain.exponentialRampToValueAtTime(.0001,now+.20); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.21);
      noiseBurst(.05,.30,2500,6800);
    }else if(kind==='rifle'){
      noiseBurst(.10,.55,850,4800);
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(115,now); o.frequency.exponentialRampToValueAtTime(48,now+.11);
      g.gain.setValueAtTime(.32,now); g.gain.exponentialRampToValueAtTime(.0001,now+.12); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.13);
      noiseBurst(.035,.24,2800,7600);
    }else if(kind==='sniper'){
      noiseBurst(.24,.95,350,4300);
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(72,now); o.frequency.exponentialRampToValueAtTime(32,now+.24);
      g.gain.setValueAtTime(.68,now); g.gain.exponentialRampToValueAtTime(.0001,now+.26); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.27);
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

  function remoteFootstepSound(remote){initAudio();if(!audioCtx||!remote?.group)return;const dx=remote.group.position.x-player.pos.x,dz=remote.group.position.z-player.pos.z,dist=Math.hypot(dx,dz);if(dist>24)return;const vol=Math.max(.025,.22*(1-dist/26)),rightDot=(dx*Math.cos(player.yaw)+dz*(-Math.sin(player.yaw)))/(dist||1),pan=Math.max(-.9,Math.min(.9,rightDot));const now=audioCtx.currentTime,buffer=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.045),audioCtx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain(),panner=audioCtx.createStereoPanner?audioCtx.createStereoPanner():null;filter.type='lowpass';filter.frequency.value=700;gain.gain.setValueAtTime(vol,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.05);src.buffer=buffer;src.connect(filter);filter.connect(gain);if(panner){panner.pan.value=pan;gain.connect(panner);panner.connect(audioCtx.destination);}else gain.connect(audioCtx.destination);src.start(now);src.stop(now+.055);}

  function knifeSound(){
    if(!audioCtx)return;
    const now=audioCtx.currentTime;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(700,now); o.frequency.exponentialRampToValueAtTime(170,now+.18);
    g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(.18,now+.018); g.gain.exponentialRampToValueAtTime(.0001,now+.20); o.connect(g); g.connect(audioCtx.destination); o.start(now); o.stop(now+.21);
  }

  function blocked(x,z) {
    const r=player.radius;
    if(window.__inkRabbitTunnelInfo&&player.pos.y<1.0){const ri=window.__inkRabbitTunnelInfo(x,z);if(ri.d<3.2)return ri.d>2.18;}
    // Mantém todos dentro da folha/mapa; importante para partidas futuras entre equipes.
    if(Math.abs(x)>48.5-r||Math.abs(z)>40.5-r)return true;
    // River is not walkable except across the two actual bridges.
    const inWater=Math.abs(z)<4.25;
    const atCrossing=Math.abs(x+32)<2.6||Math.abs(x)<2.6||Math.abs(x-32)<2.6;
    const onBridge=atCrossing&&Math.abs(z)<6.9;
    if(inWater&&!onBridge)return true;
    // Corredor livre antes de cada rampa: impede ficar preso entre cobertura, margem e ponte.
    if(atCrossing&&Math.abs(z)>=5.3&&Math.abs(z)<8.2)return false;
    // Áreas livres nas duas saídas dos mirantes: o jogador pode cair ou descer sem ficar preso.
    const lookoutLanding=(Math.abs(x-10)<4.4&&z<-25&&z>-30)||(Math.abs(x+10)<4.4&&z>25&&z<30);
    if(lookoutLanding)return false;
    const feetY=player.pos.y-1.7;
    for(const c of colliders){
      if(c.active===false)continue;
      // Coberturas baixas podem ser superadas com um pulo; paredes sem altura declarada continuam sólidas.
      if(c.minY!=null && feetY<c.minY-.08) continue;
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
    reloadBtn.textContent='↻...';
    if(!reloadCartridge){reloadCartridge=new THREE.Group();const bottle=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.34,.40,.30),mat(0xf3eee2)));bottle.position.y=0;reloadCartridge.add(bottle);const inkFill=new THREE.Mesh(new THREE.BoxGeometry(.30,.19,.27),mat(red));inkFill.position.y=-.085;reloadCartridge.add(inkFill);const neck=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.17,.15,.17),mat(0xf3eee2)));neck.position.y=.27;reloadCartridge.add(neck);const cap=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.22,.10,.22),mat(black)));cap.position.y=.39;reloadCartridge.add(cap);const label=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.22,.13,.025),mat(wall)));label.position.set(0,.02,-.163);reloadCartridge.add(label);for(const x of [-.07,.06]){const drip=new THREE.Mesh(new THREE.SphereGeometry(.028,6,5),mat(red));drip.position.set(x,-.03,-.185);reloadCartridge.add(drip);}reloadCartridge.scale.setScalar(.82);reloadCartridge.position.set(.18,-.34,-.72);reloadCartridge.rotation.set(-.15,.12,-.22);camera.add(reloadCartridge);}reloadCartridge.visible=true;reloadCartridge.userData.reloadLife=reloadTimer;reloadCartridge.userData.reloadTotal=reloadTimer;
    setTimeout(()=>{
      if(!running||token!==reloadToken||weaponMode!==reloadMode)return;
      const need=max-ammo;
      const take=Math.min(need,reserveAmmo[reloadMode]);
      ammo+=take; reserveAmmo[reloadMode]-=take; reloadTimer=0;if(reloadCartridge)reloadCartridge.visible=false;
      reloadBtn.textContent='↻'; updateHud();
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
      if(!o.isMesh || o.userData.noBulletMark || o.userData.mushroomInactive || o.userData.mushroomSmokeParticle) return;
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
        if(hit.object.userData?.mushroomId)damageMushroom(hit.object.userData.mushroomId,22);if(remoteToken){const knifeHead=hit.object.userData?.hitZone==='head';reportRemoteHit(remoteToken,knifeHead?100:85,knifeHead);hitSound(false);hitNoticeEl.textContent='CORTE DE TINTA!';hitNoticeEl.classList.add('show');hitNoticeTimer=.62;updateHud();return;}
        const target=hit.object.userData?.enemyRef || null;
        const impactMark=addImpactMark(hit);
        if(target){
          const headshot=hit.object.userData?.hitZone==='head';
          const damage=headshot?999:Math.max(50,Math.ceil(target.maxHp?target.maxHp/2:50));
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
    fireCooldown=weaponMode==='sniper'?.76:(weaponMode==='launcher'?1.15:(weaponMode==='shotgun'?.72:(weaponMode==='smg'?.075:.12)));
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
      launchRocket(muzzleWorld,dir,muzzleWorld.distanceTo(tracerEnd),hit?.face?.normal?hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize():null);
      if(ammo===0)reloadWeapon();updateHud();return;
    }
    if(weaponMode==='shotgun'){
      if(worldHits[0]){const shotgunMark=addImpactMark(worldHits[0]);shotgunMark.scale.setScalar(1.8);if(worldHits[0].object.userData?.mushroomId)damageMushroom(worldHits[0].object.userData.mushroomId,58);}
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
        if(ph?.object?.userData?.rabbitId&&ph.distance<=18){damageRabbit(ph.object.userData.rabbitId,12);continue;}
        if(ph?.object?.userData?.cheshire&&ph.distance<=15){damageCheshire(ph.distance<=7?18:(ph.distance<=11?10:5));continue;}
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
      for(const [remoteToken,remoteDamage] of damageByRemote){const damage=Math.min(anyHeadshot?65:55,Math.max(1,Math.round(remoteDamage)));totalDamage+=damage;reportRemoteHit(remoteToken,damage,anyHeadshot);}
      if(totalDamage>0)hitSound(anyHeadshot);
      if(anyHeadshot){headshots++;score+=3;}
      hitNoticeEl.textContent=totalDamage>0?(anyHeadshot?'PLOFT HEADSHOT!  -'+totalDamage:'PLOFT!  -'+totalDamage):'PLOFT!';
      hitNoticeEl.classList.add('show');hitNoticeTimer=.68;
      if(ammo===0)reloadWeapon();updateHud();return;
    }
    addTracer(muzzleWorld,tracerEnd);
    if(hit){
      if(hit.object.userData?.mushroomId)damageMushroom(hit.object.userData.mushroomId,isSniper?55:(weaponMode==='smg'?14:26));
      if(hit.object.userData?.rabbitId){damageRabbit(hit.object.userData.rabbitId,isSniper?80:(weaponMode==='shotgun'?55:(weaponMode==='smg'?18:30)));hitNoticeEl.textContent='ACERTOU O COELHO!';hitNoticeEl.classList.add('show');hitNoticeTimer=.45;}
      if(hit.object.userData?.cheshire){const catDamage=isSniper?60:(weaponMode==='smg'?18:26);damageCheshire(catDamage);const cm=addImpactMark(hit);cm.scale.setScalar(1.25);hitNoticeEl.textContent='ACERTOU O GATO!';hitNoticeEl.classList.add('show');hitNoticeTimer=.55;if(ammo===0)reloadWeapon();updateHud();return;}
      const remoteToken=hit.object.userData?.remoteToken;
      if(remoteToken){
        const headshot=hit.object.userData?.hitZone==='head';
        const damage=isSniper?(headshot?100:60):(weaponMode==='smg'?(hit.distance<=9?(headshot?32:28):(hit.distance<=20?(headshot?24:21):(headshot?19:16))):(headshot?34:26));
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
      <div style="font-size:12px;font-weight:900;letter-spacing:.13em;color:#294aa3">MULTIPLAYER ALFA • 5X5</div>
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
      setStatus(payload.room.status==='playing'?'A partida começou! Entrando no mapa…':payload.players.length+'/10 jogadores conectados • 5x5. A estrela é o líder.');
      if(payload.room.status==='playing'&&!running&&!multiplayer.blockAutoStart){hide();enterGameFullscreen();startGame();}
    };
    const poll=async()=>{if(!multiplayer.roomCode||multiplayer.busy)return;try{render(await request('heartbeat'));}catch(err){setStatus(err.message,true);}};
    const beginPolling=()=>{clearInterval(multiplayer.polling);multiplayer.polling=setInterval(poll,1400);};
    const hide=()=>{wrap.style.display='none';};
    const show=()=>{wrap.style.display='grid';startEl.classList.add('hidden');if(multiplayer.roomCode){poll();beginPolling();}};
    const act=async(action,extra={})=>{if(multiplayer.busy)return;multiplayer.busy=true;setStatus('Rabiscando a sala…');try{const data=await request(action,extra);render(data);beginPolling();}catch(err){setStatus(err.message,true);}finally{multiplayer.busy=false;}};
    q('[data-create]').addEventListener('click',()=>act('create'));
    q('[data-join]').addEventListener('click',()=>{const roomCode=code.value.toUpperCase().replace(/[^A-Z0-9]/g,'');multiplayer.roomCode=roomCode;act('join',{roomCode});});
    q('[data-start]').addEventListener('click',()=>{multiplayer.blockAutoStart=false;act('start');});
    q('[data-bots]').addEventListener('click',()=>act('settings',{botsEnabled:!multiplayer.room?.botsEnabled}));
    q('[data-leave]').addEventListener('click',async()=>{try{await request('leave');}catch(_){} multiplayer.room=null;multiplayer.roomCode='';localStorage.removeItem('inkopsRoomCode');clearInterval(multiplayer.polling);render({room:null,players:[]});setStatus('Você saiu da sala.');});
    q('[data-copy]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(multiplayer.roomCode);setStatus('Código copiado! Envie para seus amigos.');}catch(_){setStatus('Código da sala: '+multiplayer.roomCode);}});
    q('[data-solo]').addEventListener('click',()=>{hide();enterGameFullscreen();startGame();});
    q('[data-close]').addEventListener('click',()=>{hide();if(!running)startEl.classList.remove('hidden');});
    return {show};
  }
  const multiplayerLobby=createMultiplayerLobby();
  const returnLobbyBtn=document.createElement('button');returnLobbyBtn.id='returnLobbyBtn';returnLobbyBtn.textContent='LOBBY';returnLobbyBtn.style.cssText='position:fixed;right:132px;top:12px;z-index:56;padding:8px 11px;border:2px solid #171510;border-radius:9px;background:rgba(252,251,247,.90);font:900 11px Georgia;color:#171510;pointer-events:auto;display:none';document.body.appendChild(returnLobbyBtn);returnLobbyBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();multiplayerLobby.show();});

  function makePlayerLabel(name,color){
    const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=64;const ctx=labelCanvas.getContext('2d');
    ctx.fillStyle='rgba(252,251,247,.92)';ctx.strokeStyle='#171510';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(4,4,248,56,12);ctx.fill();ctx.stroke();
    ctx.fillStyle=color;ctx.font='900 25px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(name||'JOGADOR').slice(0,14),128,33);
    const texture=new THREE.CanvasTexture(labelCanvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.scale.set(2.8,.7,1);sprite.position.y=2.75;sprite.renderOrder=30;return sprite;
  }

  function makeRemotePlayer(state){const group=new THREE.Group(),teamColor=state.team==='vermelho'?0xff2638:0x00a8ff,darkMat=mat(0x080b10),paperMat=mat(0xfff4c7),accentMat=mat(teamColor);const legs=[-.22,.22].map(x=>{const leg=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.23,.82,.24),darkMat),2.4);leg.position.set(x,.42,0);group.add(leg);return leg;});const body=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.88,1.06,.50),darkMat),3.4);body.position.y=1.18;group.add(body);const chest=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.68,.66,.54),accentMat),3.2);chest.position.set(0,1.24,-.03);group.add(chest);const head=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),paperMat),2.6);head.position.y=1.96;group.add(head);const visor=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.46,.13,.09),mat(0x070a0f)),2.4);visor.position.set(0,1.99,-.3);group.add(visor);for(const side of [-1,1]){const shoulder=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.14,6,5),accentMat),2.3);shoulder.position.set(side*.48,1.48,-.02);group.add(shoulder);}const arms=[];for(const side of [-1,1]){const arm=addOutline(new THREE.Mesh(new THREE.CapsuleGeometry(.1,.5,3,5),darkMat),2.4);arm.position.set(side*.47,1.27,-.08);arm.rotation.z=side*.16;arm.rotation.x=-.72;group.add(arm);arms.push(arm);}const gunGroup=new THREE.Group();const gun=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.2,.18,1.05),darkMat),2.3);gun.position.set(.18,1.3,-.64);gunGroup.add(gun);const mag=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.14,.34,.22),accentMat),2.2);mag.position.set(.18,1.08,-.72);gunGroup.add(mag);group.add(gunGroup);const myTeam=multiplayer.room?.players?.find(p=>p.token===multiplayer.token)?.team;if(myTeam&&myTeam===state.team)group.add(makePlayerLabel(state.nickname,state.team==='vermelho'?'#d73535':'#356bc1'));group.traverse(o=>{if(o.isMesh){o.userData.remoteToken=state.token;o.userData.hitZone=o===head?'head':'body';}});group.position.set(state.x,state.y-1.7,state.z);group.rotation.y=state.yaw+Math.PI;scene.add(group);const initial=new THREE.Vector3(state.x,state.y-1.7,state.z);return {group,legs,arms,gun:gunGroup,target:initial.clone(),predicted:initial.clone(),lastNetPos:initial.clone(),velocity:new THREE.Vector3(),lastPacketAt:performance.now(),targetYaw:state.yaw+Math.PI,step:0,footTimer:.12+Math.random()*.18,weapon:state.weapon,team:state.team,puddle:null,alive:state.alive!==false};}
  function updateRemotePlayers(dt){
    for(const remote of multiplayer.remotePlayers.values()){
      const packetAge=Math.min(.065,(performance.now()-remote.lastPacketAt)/1000);
      remote.predicted.copy(remote.target);
      remote.predicted.x+=remote.velocity.x*packetAge; remote.predicted.z+=remote.velocity.z*packetAge;
      remote.group.position.lerp(remote.predicted,Math.min(1,dt*20));
      let turn=((remote.targetYaw-remote.group.rotation.y+Math.PI)%(Math.PI*2)+Math.PI)%(Math.PI*2)-Math.PI;
      remote.group.rotation.y+=turn*Math.min(1,dt*22);
      const moving=remote.alive&&Math.hypot(remote.predicted.x-remote.group.position.x,remote.predicted.z-remote.group.position.z)>.035;
      remote.step+=dt*(moving?12:2);remote.legs[0].rotation.x=moving?Math.sin(remote.step)*.55:0;remote.legs[1].rotation.x=moving?-Math.sin(remote.step)*.55:0;remote.footTimer=(remote.footTimer||0)-dt;if(moving&&remote.footTimer<=0){remoteFootstepSound(remote);remote.footTimer=.32+Math.random()*.06;}
      remote.gun.scale.z=remote.weapon==='launcher'?1.28:(remote.weapon==='knife'?.52:1);remote.group.visible=remote.alive&&((player.pos.y<0)===(remote.target.y+1.7<0));
    }
  }

  function createInkPuddle(position,team='azul'){
    const color=team==='vermelho'?red:blue;
    const group=new THREE.Group();
    const disc=new THREE.Mesh(new THREE.CircleGeometry(1.05,18),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.70,depthWrite:false}));
    disc.rotation.x=-Math.PI/2;disc.position.y=.025;group.add(disc);
    for(let i=0;i<9;i++){const dot=new THREE.Mesh(new THREE.CircleGeometry(.10+(i%3)*.045,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.62,depthWrite:false}));const a=i/9*TAU,d=1.02+(i%4)*.18;dot.rotation.x=-Math.PI/2;dot.position.set(Math.cos(a)*d,.028,Math.sin(a)*d);group.add(dot);}
    group.position.set(position.x,0,position.z);scene.add(group);return group;
  }
  function removeInkPuddle(puddle){if(!puddle)return;scene.remove(puddle);puddle.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});}
  function createDeathInkBurst(position,team='azul'){
    const color=team==='vermelho'?red:blue;
    for(let i=0;i<14;i++){
      const drop=new THREE.Mesh(new THREE.SphereGeometry(.08+(i%4)*.025,6,5),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.88,depthWrite:false}));
      drop.position.set(position.x,Math.max(.55,position.y-1.0),position.z);
      const a=i/14*TAU+(i%3)*.13,s=.8+(i%5)*.22;
      scene.add(drop);deathInkDrops.push({mesh:drop,vx:Math.cos(a)*s,vy:2.8+(i%4)*.55,vz:Math.sin(a)*s,life:1.15});
    }
  }

  function applyRemoteStates(states){
    const active=new Set();
    for(const state of states||[]){
      active.add(state.token);let remote=multiplayer.remotePlayers.get(state.token);
      if(!remote){remote=makeRemotePlayer(state);multiplayer.remotePlayers.set(state.token,remote);if(voiceEnabled)window.__inkRealtimeSendVoice?.(state.token,{ready:true});}
      const now=performance.now(),nextPos=new THREE.Vector3(state.x,state.y-1.7,state.z);
      const elapsed=Math.max(.02,Math.min(.2,(now-remote.lastPacketAt)/1000));
      const distance=nextPos.distanceTo(remote.lastNetPos);
      if(distance<2){remote.velocity.copy(nextPos).sub(remote.lastNetPos).divideScalar(elapsed);remote.velocity.y=0;const speed=Math.hypot(remote.velocity.x,remote.velocity.z);if(speed>8){remote.velocity.x*=8/speed;remote.velocity.z*=8/speed;}}else remote.velocity.set(0,0,0);
      remote.lastNetPos.copy(nextPos);remote.lastPacketAt=now;remote.target.copy(nextPos);remote.targetYaw=state.yaw+Math.PI;remote.weapon=state.weapon;
      const alive=state.alive!==false;
      if(!alive&&remote.alive){createDeathInkBurst(new THREE.Vector3(nextPos.x,1.7,nextPos.z),state.team||remote.team);remote.puddle=createInkPuddle(nextPos,state.team||remote.team);}
      if(alive&&!remote.alive){removeInkPuddle(remote.puddle);remote.puddle=null;}
      remote.alive=alive;remote.group.visible=alive&&((player.pos.y<0)===(state.y<0));
    }
    for(const [token,remote] of multiplayer.remotePlayers)if(!active.has(token)){scene.remove(remote.group);removeInkPuddle(remote.puddle);remote.group.traverse(o=>{o.geometry?.dispose?.();if(o.material?.map)o.material.map.dispose?.();o.material?.dispose?.();});multiplayer.remotePlayers.delete(token);}
  }
  // O transporte WebSocket entrega snapshots a cada 50 ms; aplicar aqui evita esperar
  // o próximo envio periódico do próprio jogador para atualizar os adversários.
  window.__inkRealtimeSnapshot = payload => {
    if(!payload || !running) return;
    applyRemoteStates(payload.players || []);if(Array.isArray(payload.props))for(const st of payload.props)applyMushroomState(st);if(payload.cat)setCheshireState(payload.cat);if(payload.reward)setGoldenRewardState(payload.reward);if(payload.match){const sec=Math.max(0,Math.ceil(Number(payload.match.remainingMs||0)/1000)),mm=String(Math.floor(sec/60)),ss=String(sec%60).padStart(2,'0'),clockText=mm+':'+ss+'  •  40 KILLS';if(matchClockEl.style.display!=='block')matchClockEl.style.display='block';if(matchClockEl.textContent!==clockText)matchClockEl.textContent=clockText;if(payload.match.status==='finished')window.__inkRealtimeMatchEnd?.(payload.match);}
    if(payload.self){const oldHp=hp,oldArmor=armor,serverHp=Math.max(0,Math.min(100,Number(payload.self.health??hp))),serverArmor=Math.max(0,Math.min(100,Number(payload.self.armor??armor)));const wasAlive=multiplayer.selfAlive;multiplayer.selfAlive=payload.self.alive;if(serverHp<oldHp||serverArmor<oldArmor)triggerDamageFeedback((oldHp-serverHp)+(oldArmor-serverArmor)*.45,payload.self.damageFrom,payload.self.damageAt);if(!payload.self.alive){hp=0;armor=serverArmor;createLocalDeathPuddle();showDeathScreen(payload.self.respawnSeconds);fireHeld=false;scopeMode=false;}else if(!wasAlive){rabbitTunnelMode=false;rabbitTunnelCooldown=0;verticalVelocity=0;grounded=true;hp=100;armor=100;reserveAmmo={...RESERVE_AMMO};ammo=weaponMode==='knife'?0:(MAGAZINES[weaponMode]||0);clearLocalDeathPuddle();hideDeathScreen();const myTeam=multiplayer.room?.players?.find(p=>p.token===multiplayer.token)?.team;player.pos.set(0,1.7,myTeam==='vermelho'?-36:36);player.yaw=myTeam==='vermelho'?Math.PI:0;updateHud();}else{hp=serverHp;armor=serverArmor;hideDeathScreen();updateHud();}}
    if(payload.scores){const b=Number(payload.scores.azul||0),r=Number(payload.scores.vermelho||0);if(onlineScoreEl.style.display!=='block')onlineScoreEl.style.display='block';if(b!==lastBlueScore){lastBlueScore=b;onlineBlueEl.textContent='AZUL '+b+'/40';}if(r!==lastRedScore){lastRedScore=r;onlineRedEl.textContent=r+'/40 VERMELHO';}}
  };

  
  window.__inkRealtimeRocket=msg=>{const d=msg?.data;if(!running||!d)return;const from=new THREE.Vector3(Number(d.from?.x)||0,Number(d.from?.y)||1.7,Number(d.from?.z)||0);const dir=new THREE.Vector3(Number(d.dir?.x)||0,Number(d.dir?.y)||0,Number(d.dir?.z)||-1).normalize();const distance=Math.max(.5,Math.min(60,Number(d.distance)||20));launchRocket(from,dir,distance,null,true);};

  const voiceBtn=document.createElement('button');voiceBtn.id='voiceControl';voiceBtn.textContent='🎙';voiceBtn.setAttribute('aria-label','Voz');voiceBtn.style.cssText='position:fixed;right:12px;top:58px;z-index:24;width:44px;height:44px;border:2px solid #171510;border-radius:50%;background:rgba(252,251,247,.72);font:900 19px Georgia;color:#171510;display:none;pointer-events:auto;opacity:.72';document.body.appendChild(voiceBtn);movableControls.push(voiceBtn);if(savedLayout[voiceBtn.id])placeControl(voiceBtn,savedLayout[voiceBtn.id]);voiceBtn.addEventListener('pointerdown',e=>{if(!controlsEditing)return;e.preventDefault();e.stopImmediatePropagation();const r=voiceBtn.getBoundingClientRect();movingControl=voiceBtn;movingOffsetX=e.clientX-r.left;movingOffsetY=e.clientY-r.top;voiceBtn.setPointerCapture?.(e.pointerId);voiceBtn.style.outline='4px dashed #d73535';},true);
  function closeVoicePeer(token){const p=voicePeers.get(token);if(!p)return;p.pc.close();p.audio?.remove();voicePeers.delete(token);}
  async function ensureVoicePeer(token,offer=false){if(!voiceEnabled||!token||token===multiplayer.token)return null;let entry=voicePeers.get(token);if(entry)return entry;const pc=new RTCPeerConnection({iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]});const audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.volume=1;document.body.appendChild(audio);entry={pc,audio,retries:0};voicePeers.set(token,entry);voiceStream?.getTracks().forEach(track=>pc.addTrack(track,voiceStream));pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play?.().catch(()=>{});};pc.onicecandidate=e=>{if(e.candidate)window.__inkRealtimeSendVoice?.(token,{candidate:e.candidate.toJSON()})};pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'&&entry.retries<1){entry.retries++;try{pc.restartIce?.();}catch(_){}}else if(pc.connectionState==='closed')closeVoicePeer(token)};if(offer){const desc=await pc.createOffer({offerToReceiveAudio:true});await pc.setLocalDescription(desc);await window.__inkRealtimeSendVoice?.(token,{description:pc.localDescription});}return entry;}
  window.__inkRealtimeVoice=async msg=>{if(!voiceEnabled)return;const from=msg.from,s=msg.signal;if(!from||!s)return;if(s.ready){const selfId=window.__inkRealtimeSelfId?.()||'';if(selfId&&String(selfId)<String(from))ensureVoicePeer(from,true);return;}const entry=await ensureVoicePeer(from,false);if(!entry)return;try{if(s.description){await entry.pc.setRemoteDescription(s.description);if(s.description.type==='offer'){const ans=await entry.pc.createAnswer();await entry.pc.setLocalDescription(ans);await window.__inkRealtimeSendVoice?.(from,{description:entry.pc.localDescription});}}else if(s.candidate)await entry.pc.addIceCandidate(s.candidate);}catch(_){}};
  async function setVoiceEnabled(on){if(on){try{if(!voiceStream)voiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});voiceStream.getAudioTracks().forEach(t=>t.enabled=true);voiceEnabled=true;voiceBtn.textContent='🎙✓';voiceBtn.style.background='#dff3e8';voiceBtn.style.opacity='1';const selfId=window.__inkRealtimeSelfId?.()||'';for(const token of multiplayer.remotePlayers.keys()){window.__inkRealtimeSendVoice?.(token,{ready:true});if(selfId&&String(selfId)<String(token))ensureVoicePeer(token,true);}}catch(_){voiceEnabled=false;voiceBtn.textContent='🎙!';}}else{voiceStream?.getAudioTracks().forEach(t=>t.enabled=false);voiceBtn.textContent='🎙×';voiceBtn.style.opacity='.58';voiceBtn.style.background='rgba(252,251,247,.92)';}}
  voiceBtn.addEventListener('click',()=>{if(!voiceStream||!voiceEnabled)setVoiceEnabled(true);else{const enabled=voiceStream.getAudioTracks().some(t=>t.enabled);setVoiceEnabled(!enabled);}});
  const killFeed=document.createElement('div');killFeed.style.cssText='position:fixed;right:12px;top:54px;z-index:46;display:flex;flex-direction:column;gap:5px;align-items:flex-end;pointer-events:none;font:800 12px Georgia';document.body.appendChild(killFeed);window.__inkRealtimeKill=ev=>{if(!ev)return;const row=document.createElement('div');row.style.cssText='max-width:64vw;padding:6px 9px;border:2px solid #171510;border-radius:7px;background:rgba(252,251,247,.94)';const weaponName={rifle:'FUZIL',smg:'SMG',shotgun:'ESPINGARDA',launcher:'LANÇA-FOGUETES',sniper:'SNIPER',knife:'FACA',cheshire:'GATO DE CHESHIRE'}[ev.weapon]||String(ev.weapon||'');row.innerHTML=ev.self?'<b>'+ev.victim+'</b> virou a própria obra de arte 💥':'<b>'+ev.killer+'</b> <span style="color:#356bc1">['+weaponName+']</span> ✎ <span style="color:#d73535">'+ev.victim+'</span>'+(ev.headshot?' <b style="color:#d73535">HEADSHOT!</b>':'');killFeed.prepend(row);while(killFeed.children.length>4)killFeed.lastChild.remove();setTimeout(()=>row.remove(),4600);};let selfRocketDeathPending=false;

  const matchClockEl=document.createElement('div');matchClockEl.style.cssText='position:fixed;left:50%;top:88px;transform:translateX(-50%);z-index:20;display:none;padding:5px 10px;border:2px solid #171510;border-radius:8px;background:rgba(252,251,247,.88);font:900 13px Georgia;color:#171510;pointer-events:none';document.body.appendChild(matchClockEl);
  const matchEndOverlay=document.createElement('div');matchEndOverlay.style.cssText='position:fixed;inset:0;z-index:80;display:none;place-items:center;background:rgba(15,17,20,.78);font-family:Georgia,serif';matchEndOverlay.innerHTML='<div style="width:min(88vw,520px);padding:28px;text-align:center;border:4px solid #171510;border-radius:16px;background:#fcfbf7;box-shadow:10px 10px 0 #294aa3"><div style="font:900 42px Georgia;color:#171510">FIM DA PARTIDA</div><div data-match-winner style="margin-top:14px;font:900 24px Georgia;color:#d73535"></div><div style="margin-top:8px;font:800 13px Georgia">6 MINUTOS • LIMITE 40 ABATES</div><button data-match-lobby style="margin-top:18px;padding:12px 18px;border:3px solid #171510;border-radius:10px;background:#294aa3;color:#fff;font:900 15px Georgia;pointer-events:auto">VOLTAR AO LOBBY / NOVA PARTIDA</button></div>';document.body.appendChild(matchEndOverlay);const matchWinnerEl=matchEndOverlay.querySelector('[data-match-winner]'),matchLobbyBtn=matchEndOverlay.querySelector('[data-match-lobby]');matchLobbyBtn.addEventListener('click',()=>{matchEndOverlay.style.display='none';running=false;stopMultiplayerSync(false);multiplayerLobby.show();});window.__inkRealtimeMatchEnd=data=>{if(!data)return;multiplayer.blockAutoStart=true;fireHeld=false;scopeMode=false;running=false;stopMultiplayerSync(false);matchEndOverlay.style.display='grid';matchWinnerEl.textContent=data.winner==='empate'?'EMPATE!':('TIME '+String(data.winner||'').toUpperCase()+' VENCEU!');};
  const onlineScoreEl=document.createElement('div');onlineScoreEl.style.cssText='position:fixed;left:50%;top:48px;transform:translateX(-50%);z-index:19;display:none;padding:7px 13px;border:3px solid #171510;border-radius:9px;background:rgba(252,251,247,.96);font:900 15px Georgia;color:#171510;pointer-events:none;white-space:nowrap;min-width:300px;text-align:center;contain:layout paint';onlineScoreEl.innerHTML='<span data-blue style="color:#294aa3">AZUL 0/40</span> &nbsp;×&nbsp; <span data-red style="color:#d73535">0/40 VERMELHO</span>';document.body.appendChild(onlineScoreEl);const onlineBlueEl=onlineScoreEl.querySelector('[data-blue]'),onlineRedEl=onlineScoreEl.querySelector('[data-red]');let lastBlueScore=-1,lastRedScore=-1;

  const deathOverlay=document.createElement('div');
  deathOverlay.style.cssText='position:fixed;inset:0;z-index:70;display:none;place-items:center;background:rgba(15,17,20,.78);backdrop-filter:blur(2px);pointer-events:none;font-family:Georgia,serif';
  deathOverlay.innerHTML='<div style="width:min(88vw,520px);padding:28px 22px;text-align:center;border:4px solid #171510;border-radius:16px;background:#fcfbf7;box-shadow:10px 10px 0 #d73535"><div style="font:900 clamp(34px,9vw,62px) Georgia;color:#d73535;line-height:.9">VOCÊ VIROU TINTA!</div><div data-death-joke style="margin:16px 0 10px;font:800 17px Georgia;color:#171510"></div><div style="font:900 14px Georgia;color:#294aa3">RABISCANDO UM NOVO CORPO...</div><div data-death-count style="font:900 clamp(58px,18vw,108px) Georgia;color:#171510;line-height:1;margin-top:2px">3</div></div>';
  document.body.appendChild(deathOverlay);
  const deathJoke=deathOverlay.querySelector('[data-death-joke]'),deathCount=deathOverlay.querySelector('[data-death-count]');
  const deathJokes=['O mapa ganhou mais uma obra de arte.','Você não morreu. Virou decoração do cenário.','Essa poça de tinta tem o seu nome. Literalmente.','Respira... quer dizer, agora não dá.','Seu boneco pediu 3 segundos de férias.'];
  let localDeathPuddle=null,lastDeathSeconds=null;
  function showDeathScreen(seconds){deathOverlay.style.display='grid';const s=Math.max(1,Math.ceil(Number(seconds)||1));if(lastDeathSeconds===null){deathJoke.textContent=selfRocketDeathPending?'Você mirou tão perto que assinou a própria poça de tinta 😂':deathJokes[Math.floor(Math.random()*deathJokes.length)];selfRocketDeathPending=false;}lastDeathSeconds=s;deathCount.textContent=String(s);}
  function hideDeathScreen(){deathOverlay.style.display='none';lastDeathSeconds=null;}
  function createLocalDeathPuddle(){if(localDeathPuddle)return;const team=multiplayer.room?.players?.find(p=>p.token===multiplayer.token)?.team||'azul';createDeathInkBurst(player.pos.clone(),team);localDeathPuddle=createInkPuddle(player.pos.clone(),team);}
  function clearLocalDeathPuddle(){removeInkPuddle(localDeathPuddle);localDeathPuddle=null;}

  async function reportRemoteHit(targetToken,damage,headshot=false){
    if(!multiplayer.roomCode||multiplayer.room?.status!=='playing')return;
    const pending=multiplayer.pendingHits.get(targetToken)||{damage:0,headshot:false};pending.damage=Math.min(100,pending.damage+damage);pending.headshot=pending.headshot||headshot;multiplayer.pendingHits.set(targetToken,pending);
    if(!multiplayer.hitFlushTimer)multiplayer.hitFlushTimer=setTimeout(flushRemoteHits,80);
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
        if(!data.self.alive){hp=0;createLocalDeathPuddle();showDeathScreen(data.self.respawnSeconds);fireHeld=false;scopeMode=false;}
        else if(!wasAlive){hp=100;armor=100;reserveAmmo={...RESERVE_AMMO};ammo=weaponMode==='knife'?0:(MAGAZINES[weaponMode]||0);clearLocalDeathPuddle();hideDeathScreen();const myTeam=multiplayer.room?.players?.find(p=>p.token===multiplayer.token)?.team;player.pos.set(0,1.7,myTeam==='vermelho'?-36:36);player.yaw=myTeam==='vermelho'?Math.PI:0;hitNoticeEl.textContent='DE VOLTA AO RABISCO! • VIDA, COLETE E MUNIÇÃO CHEIOS';hitNoticeEl.classList.add('show');hitNoticeTimer=1.25;}
        else {hp=Math.min(100,data.self.health);hideDeathScreen();}
        updateHud();
      }
    }catch(_){/* Uma perda curta de rede não interrompe a partida local. */}finally{multiplayer.networkBusy=false;}
  }

  function startMultiplayerSync(){clearInterval(multiplayer.networkTimer);clearInterval(multiplayer.polling);multiplayer.selfAlive=true;if(multiplayer.roomCode&&multiplayer.room?.status==='playing'){onlineScoreEl.style.display='block';multiplayer.networkTimer=setInterval(pushMultiplayerState,50);pushMultiplayerState();hitNoticeEl.textContent='CONECTADO À SALA '+multiplayer.roomCode;hitNoticeEl.classList.add('show');hitNoticeTimer=1.4;}}
  function stopMultiplayerSync(clearPlayers=true){clearInterval(multiplayer.networkTimer);multiplayer.networkTimer=null;multiplayer.networkBusy=false;onlineScoreEl.style.display='none';voiceBtn.style.display='none';if(voiceEnabled)setVoiceEnabled(false);if(clearPlayers){for(const remote of multiplayer.remotePlayers.values()){scene.remove(remote.group);remote.group.traverse(o=>{o.geometry?.dispose?.();o.material?.dispose?.();});}multiplayer.remotePlayers.clear();}}

  function startGame(){
    initAudio(); score=0;kills=0;headshots=0;ammo=MAGAZINES.rifle;reserveAmmo={...RESERVE_AMMO};hp=100;armor=100;clearLocalDeathPuddle();hideDeathScreen();wave=1;waveDelay=0;reloadTimer=0;fireCooldown=0;fireHeld=false;weaponKick=0;fireZoom=0;sprintBlend=0;knifeSwing=0;sniperCycle=0;playerStepTimer=0;
    setWeaponMode('rifle');
    scopeMode=false;adsProgress=0;spawnGrace=5;rabbitTunnelMode=false;rabbitTunnelCooldown=0;
    for(const key of weaponModes) weaponVariants[key].visible=(key===weaponMode);
    const myTeam=multiplayer.room?.players?.find(p=>p.token===multiplayer.token)?.team;
    // Times começam em lados opostos; no modo solo permanece o spawn sul estável.
    player.pos.set(0,1.7,myTeam==='vermelho'?-36:36);player.yaw=myTeam==='vermelho'?Math.PI:0;player.pitch=0;player.recoil=0;verticalVelocity=0;grounded=true;jumpPadCooldown=0;
    if(multiplayer.room?.status==='playing'&&!multiplayer.room?.botsEnabled){for(const e of enemies)scene.remove(e.group);enemies.length=0;waveDelay=1000000000;}else resetEnemies();
    updateHud(); matchEndOverlay.style.display='none';startEl.classList.add('hidden');overEl.classList.add('hidden');layoutBtn.style.display='block';returnLobbyBtn.style.display=multiplayer.room?.status==='playing'?'block':'none';voiceBtn.style.display=multiplayer.room?.status==='playing'?'block':'none';running=true;last=performance.now();clock.start();requestAnimationFrame(loop);
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
    jumpPadCooldown=Math.max(0,jumpPadCooldown-dt);rabbitTunnelCooldown=Math.max(0,rabbitTunnelCooldown-dt);
    if(spawnGrace>0) spawnGrace=Math.max(0,spawnGrace-dt);
    joy.x+=(joy.tx-joy.x)*Math.min(1,dt*14);joy.y+=(joy.ty-joy.y)*Math.min(1,dt*14);
    let f=-joy.y,s=joy.x;
    if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyA||keys.ArrowLeft)s-=1;if(keys.KeyD||keys.ArrowRight)s+=1;
    const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
    // No analógico, empurrar bem para frente ativa uma corrida curta. O strafe continua normal,
    // então não fica possível correr a 1.25x simplesmente andando de lado.
    const joystickSprint=joy.active && joy.y < -0.72 && Math.abs(joy.y) > Math.abs(joy.x)*1.15;
    const keyboardSprint=keys.ShiftLeft||keys.ShiftRight;
    const sprinting=(joystickSprint||keyboardSprint) && !scopeMode;
    const speed=player.speed*(sprinting?SPRINT_MULTIPLIER:1)*(scopeMode?.68:1);
    sprintBlend+=( (sprinting&&len>.05 ? 1 : 0)-sprintBlend )*Math.min(1,dt*9);
    const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
    // Forward follows the direction the camera is facing. Previously +Z was treated as forward,
    // which made the mobile joystick feel inverted whenever the player looked ahead.
    const sideBoost=1.06;move((-sin*f+cos*s*sideBoost)*speed*dt,(-cos*f-sin*s*sideBoost)*speed*dt);
    if(grounded&&jumpPadCooldown<=0){
      const onJumpPad=Math.hypot(player.pos.x-18,player.pos.z-18)<1.35||Math.hypot(player.pos.x+18,player.pos.z+18)<1.35;
      if(onJumpPad){
        verticalVelocity=12.5;grounded=false;jumpPadCooldown=1.35;footstepSound(.22,190);
        hitNoticeEl.textContent='PLOIM!  SALTO DE TINTA';hitNoticeEl.classList.add('show');hitNoticeTimer=.78;
      }
    }
    const moving=len>.05;
    playerStepTimer=Math.max(0,playerStepTimer-dt);
    if(moving && playerStepTimer<=0){
      footstepSound(sprinting?.16:.125,sprinting?112:96);
      playerStepTimer=sprinting?.29:.43;
    }
    {const terrainHeight=getPlayerHeight(player.pos.x,player.pos.z);if(grounded && terrainHeight<player.pos.y-.30) grounded=false;if(grounded){player.pos.y += (terrainHeight-player.pos.y)*Math.min(1,dt*14);}else{verticalVelocity-=(verticalVelocity<0?20.5:13.5)*dt;player.pos.y+=verticalVelocity*dt;if(player.pos.y<=terrainHeight){player.pos.y=terrainHeight;verticalVelocity=0;grounded=true;}}}
    player.bob+=(moving?(sprinting?14:10):2)*dt;
    player.recoil=Math.max(0,player.recoil-dt*1.7);fireCooldown=Math.max(0,fireCooldown-dt);if(sniperQueuedAim&&weaponMode==='sniper'&&reloadTimer<=0&&fireCooldown<=0&&ammo>0){const q=sniperQueuedAim;sniperQueuedAim=null;const oy=player.yaw,op=player.pitch;player.yaw=q.yaw;player.pitch=q.pitch;shoot();player.yaw=oy;player.pitch=op;}fireZoom=Math.max(0,fireZoom-dt*5.2);hurtTimer=Math.max(0,hurtTimer-dt);hitNoticeTimer=Math.max(0,hitNoticeTimer-dt);
    if(reloadCartridge?.visible){reloadCartridge.userData.reloadLife=Math.max(0,(reloadCartridge.userData.reloadLife||0)-dt);const total=Math.max(.01,reloadCartridge.userData.reloadTotal||.95),p=1-Math.min(1,reloadCartridge.userData.reloadLife/total);reloadCartridge.rotation.y=-.35+Math.sin(p*Math.PI)*.9;reloadCartridge.rotation.z=.12*Math.sin(p*Math.PI*2);reloadCartridge.position.y=-.38+Math.sin(p*Math.PI)*.18;reloadCartridge.position.x=.16+(p>.58?(p-.58)*.55:0);reloadCartridge.position.z=-.76-(p>.58?(p-.58)*.40:0);}
    if(hitNoticeTimer<=0) hitNoticeEl.classList.remove('show');
    if(fireHeld) shoot();
    updateCheshireCat(dt);if(goldenInkwell?.visible){goldenInkwell.rotation.y+=dt*.9;tryTakeGoldenReward();}if(multiplayer.room?.status!=='playing'&&rewardLocalRespawn>0){rewardLocalRespawn-=dt;if(rewardLocalRespawn<=0&&goldenInkwell){goldenInkwell.visible=true;hitNoticeEl.textContent='TINTEIRO DOURADO RENASCEU NO LABIRINTO!';hitNoticeEl.classList.add('show');hitNoticeTimer=2.2;}}
    for(const m of destructibleMushrooms.values())if(!multiplayer.room?.status&&m.respawn>0){m.respawn-=dt;if(m.respawn<=0){m.hp=120;applyMushroomState({id:m.id,hp:120,active:true});}}for(const r of destructibleRabbits.values())if(!multiplayer.room?.status&&r.respawn>0){r.respawn-=dt;if(r.respawn<=0){r.hp=80;applyRabbitState({id:r.id,hp:80,active:true});}}
    for(let i=mushroomSmoke.length-1;i>=0;i--){const s=mushroomSmoke[i];s.life-=dt;s.mesh.position.x+=s.vx*dt;s.mesh.position.y+=s.vy*dt;s.mesh.position.z+=s.vz*dt;s.mesh.scale.multiplyScalar(1+dt*.25);s.mesh.material.opacity=Math.max(0,.94*s.life/s.max);if(s.life<=0){scene.remove(s.mesh);s.mesh.geometry.dispose();s.mesh.material.dispose();mushroomSmoke.splice(i,1);}}
    updateRemotePlayers(dt);
    for(let i=hitMarks.length-1;i>=0;i--){const h=hitMarks[i];h.life-=dt;if(h.life<3){const a=Math.max(0,h.life/3);h.mark.traverse(o=>{if(o.material&&'opacity' in o.material){o.material.transparent=true;o.material.opacity=Math.min(o.material.opacity,a);}});}if(h.life<=0){h.mark.parent?.remove(h.mark);h.mark.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());else o.material?.dispose?.();});hitMarks.splice(i,1);}}
    for(let i=deathInkDrops.length-1;i>=0;i--){const d=deathInkDrops[i];d.life-=dt;d.vy-=7.2*dt;d.mesh.position.x+=d.vx*dt;d.mesh.position.y+=d.vy*dt;d.mesh.position.z+=d.vz*dt;d.mesh.scale.y=1+Math.max(0,-d.vy)*.12;d.mesh.material.opacity=Math.max(0,Math.min(.9,d.life));if(d.mesh.position.y<=.06||d.life<=0){scene.remove(d.mesh);d.mesh.geometry.dispose();d.mesh.material.dispose();deathInkDrops.splice(i,1);}}
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
        rocketProjectiles.splice(i,1);if(rocket.remote){createInkExplosion(impact);createRocketInkStains(impact,rocket.impactNormal);rocketExplosionSound();}else detonateRocket(impact,rocket.impactNormal);
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
    for(let i=rocketInkStains.length-1;i>=0;i--){const st=rocketInkStains[i];st.life-=dt;if(st.life<4)st.mesh.material.opacity=Math.max(0,.72*(st.life/4));if(st.life<=0){scene.remove(st.mesh);st.mesh.geometry.dispose();st.mesh.material.dispose();rocketInkStains.splice(i,1);}}
    damageFlash=Math.max(0,damageFlash-dt*1.9);damageShake=Math.max(0,damageShake-dt*.48);damageOverlay.style.opacity=String(Math.min(.92,damageFlash));
    const bobY=moving?Math.sin(player.bob)*(.045+.018*sprintBlend):0;
    const bobX=moving?Math.cos(player.bob*.5)*.012*sprintBlend:0;
    camera.position.y=player.pos.y+bobY;
    camera.position.x=player.pos.x+bobX;
    camera.position.x=player.pos.x;camera.position.z=player.pos.z;if(damageShake>0){camera.position.x+=(Math.random()-.5)*damageShake;camera.position.y+=(Math.random()-.5)*damageShake*.55;}
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
    // Recolhe a arma ao encostar em paredes/objetos para o viewmodel não atravessar a geometria.
    let weaponWallPush=0;
    if(!scopeMode){
      const nearRay=new THREE.Raycaster();nearRay.setFromCamera(new THREE.Vector2(0,0),camera);nearRay.far=1.45;
      const nearTargets=[];scene.traverse(o=>{if(!o.isMesh||!o.visible||o.userData?.noBulletMark||o.userData?.mushroomSmokeParticle)return;let own=false;for(const v of Object.values(weaponVariants)){if(o===v||v.children.includes(o)){own=true;break;}}if(!own)nearTargets.push(o);});
      const nearHit=nearRay.intersectObjects(nearTargets,true)[0];if(nearHit)weaponWallPush=Math.max(0,Math.min(1,(1.45-nearHit.distance)/1.05));
    }

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
      activeWeapon.scale.setScalar(1);
      activeWeapon.rotation.set(player.recoil*.16+weaponKick*.07,0,runTilt);
      activeWeapon.scale.setScalar(1);
    }
    if(weaponWallPush>0){activeWeapon.position.z+=weaponWallPush*.82;activeWeapon.position.y-=weaponWallPush*.20;activeWeapon.rotation.x-=weaponWallPush*.28;activeWeapon.scale.multiplyScalar(1-weaponWallPush*.12);}
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
          hp=Math.max(0,hp-(incoming-absorbed));triggerDamageFeedback(incoming);
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
      reloadToken++;reloadTimer=0;reloadBtn.textContent='↻';
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

  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(!running)return;if(e.pointerType==='mouse'){if(document.pointerLockElement!==canvas){canvas.requestPointerLock?.();return;}if(e.button===0){fireHeld=weaponMode!=='sniper'&&weaponMode!=='launcher';shoot();}if(e.button===2&&(weaponMode==='rifle'||weaponMode==='sniper'))scopeMode=true;}else{touchLookId=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;canvas.setPointerCapture(e.pointerId);}});document.addEventListener('mousemove',e=>{if(running&&document.pointerLockElement===canvas)look(e.movementX,e.movementY,.00235);});canvas.addEventListener('pointermove',e=>{if(!running||e.pointerType==='mouse')return;if(e.pointerId===touchLookId){const dx=e.clientX-lastLookX,dy=e.clientY-lastLookY;look(dx,dy,.0042);lastLookX=e.clientX;lastLookY=e.clientY;}});window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse'){if(e.button===0)fireHeld=false;if(e.button===2&&(weaponMode==='rifle'||weaponMode==='sniper'))scopeMode=false;}if(e.pointerId===touchLookId)touchLookId=null;});document.addEventListener('pointerlockchange',()=>{mouseLook=document.pointerLockElement===canvas;canvas.style.cursor=mouseLook?'none':'crosshair';});
  window.addEventListener('keydown',e=>{
    keys[e.code]=true;
    if(e.code==='Space'){fireHeld=weaponMode!=='sniper'&&weaponMode!=='launcher';shoot();}
    if(e.code==='KeyR'&&weaponMode!=='knife') reloadWeapon();
    if(e.code==='KeyJ') jump();if(/^Digit[1-6]$/.test(e.code)){const idx=Number(e.code.slice(-1))-1;if(weaponModes[idx])setWeaponMode(weaponModes[idx]);}if(e.code==='KeyF'&&!e.repeat)fullscreenBtn.click();
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
