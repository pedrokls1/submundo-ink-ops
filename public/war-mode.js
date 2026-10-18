import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';
// Modo completamente isolado: não importa assets, geometrias, colisores ou spawns do Reino.
const W=1200, HALF=600, colors=[0x356bc1,0xd73535,0x3d8b68];
const bases=[{x:-425,z:280},{x:0,z:-425},{x:425,z:280}]; // triângulo equilátero aproximado
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc8e2ef);scene.fog=new THREE.FogExp2(0xc8e2ef,.00083);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,4200);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xddefff,0x927c66,2.3));const sun=new THREE.DirectionalLight(0xffffff,2.3);sun.position.set(-170,390,130);scene.add(sun);
const ink=0x24466e,rock=0xece3cc,green=0x6f9b71,paper=0xf5f0e3;
const mat=(c)=>new THREE.MeshLambertMaterial({color:c,flatShading:true});
const rockMat=mat(rock),roadMat=mat(0xcfc7b9),waterMat=mat(0x85c6d9),treeMat=mat(green),trunkMat=mat(0x8a745d),inkMat=mat(ink),whiteMat=mat(paper);
function height(x,z){const d=Math.hypot(x,z);let h=8+11*Math.sin(x*.011)*Math.cos(z*.012)+6*Math.sin((x+z)*.029);h+=58*Math.pow(Math.max(0,(d-260)/340),1.7);for(let i=0;i<7;i++){const a=i*Math.PI*2/7+.35,px=460*Math.cos(a),pz=460*Math.sin(a);h+=43*Math.exp(-((x-px)**2+(z-pz)**2)/22000);}h+=Math.max(0,1-Math.abs(x+80*Math.sin(z*.013))/53)*-18;for(const b of bases){const q=Math.hypot(x-b.x,z-b.z);if(q<105){const blend=THREE.MathUtils.smoothstep(q,85,105);h=THREE.MathUtils.lerp(28,h,blend);}}return h;}
const verts=[],indices=[],N=128;for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=-HALF+i*W/N,z=-HALF+j*W/N;verts.push(x,height(x,z),z);}for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+N+1;indices.push(a,b,a+1,b,b+1,a+1);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();const terrainMesh=new THREE.Mesh(geo,rockMat);scene.add(terrainMesh);
function box(x,y,z,w,h,d,color=paper){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);scene.add(m);return m;}
function cylinder(x,y,z,r,h,color,segments=12){let m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat(color));m.position.set(x,y,z);scene.add(m);return m;}
function line(points,color=ink,width=2){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*5),width,5,false),mat(color));scene.add(mesh);return mesh;}
// Estradas reais: fita de malha triangular sobre o solo (tubos antigos pareciam paredes).
function road(a,b,w=11){const v=[],idx=[],S=120;const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),nx=-dz/L,nz=dx/L;for(let i=0;i<=S;i++){let t=i/S,x=a.x+dx*t,z=a.z+dz*t;for(const side of [-1,1]){let xx=x+nx*side*w*.5,zz=z+nz*side*w*.5;v.push(xx,height(xx,zz)+.32,zz);}if(i<S){let j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0xd7cec0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));scene.add(m);return m;}
// Rede principal triangular, caminhos laterais e estradas de vale.
for(let i=0;i<3;i++){const b=bases[i];road(b,{x:0,z:0},15);road(b,bases[(i+1)%3],12);const dir=new THREE.Vector2(-b.x,-b.z).normalize();const p={x:b.x+dir.x*180,z:b.z+dir.y*180};road(b,p,11);road(p,{x:0,z:0},10);}
// Pontes com tabuleiros transitáveis: superfícies horizontais, guardas discretas e pilares.
const bridges=[];
function bridge(z,centerX=-90,length=100,width=16){
 const x1=centerX-length/2,x2=centerX+length/2;
 const deckY=Math.max(height(x1,z),height(x2,z),height(centerX,z))+3;
 const deck=box(centerX,deckY-.75,z,length,1.5,width,0xd7d8d3);
 for(const dz of [-width/2,width/2]) box(centerX,deckY+1,z+dz,length,1.7,.55,0x526b82);
 for(const x of [x1+12,x2-12])box(x,(deckY+height(x,z))/2-1,z,2,deckY-height(x,z)+2,3,0xa7a9a5);
 bridges.push({x1,x2,z,width,deckY});
 road({x:x1-35,z},{x:x1,z},width);road({x:x2,z},{x:x2+35,z},width);
}
for(const z of [-320,-130,120,320])bridge(z);
function driveHeight(x,z){let y=groundSurface(x,z);for(const b of bridges)if(x>=b.x1&&x<=b.x2&&Math.abs(z-b.z)<b.width/2) y=Math.max(y,b.deckY);return y;}
const tower=(x,z,c=ink)=>{const y=height(x,z);box(x,y+13,z,5,26,5,c);box(x,y+28,z,12,5,12,0xfaf5e8);box(x,y+32,z,1,8,1,c);};
const obstacles=[];function building(x,z,c,w=18,d=15){const y=height(x,z);box(x,y+5,z,w,10,d,0xf7f2e6);box(x,y+10.5,z,w+2,2,d+2,c);box(x,y+2,z+d/2+.15,5,4,.3,c);obstacles.push({x,z,w:w+2,d:d+2});}
const helis=[],cars=[];
const groundRay=new THREE.Raycaster();
function groundSurface(x,z){groundRay.set(new THREE.Vector3(x,600,z),new THREE.Vector3(0,-1,0));const hit=groundRay.intersectObject(terrainMesh,false)[0];return hit?hit.point.y:height(x,z);}

function helicopter(x,z,color){
 const group=new THREE.Group(),paint=mat(color),glass=new THREE.MeshPhongMaterial({color:0x426f94,shininess:85,transparent:true,opacity:.83}),dark=mat(0x25394e);
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(2.35,5.7,5,12),paint);body.rotation.z=Math.PI/2;body.position.x=-.8;group.add(body);
 const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.28,14,10),glass);canopy.scale.set(1.50,.91,.94);canopy.position.set(-3.25,.4,0);group.add(canopy);
 // Cabine, nariz, entradas de ar e compartimento do motor.
 const chin=new THREE.Mesh(new THREE.BoxGeometry(2,.65,2.7),dark);chin.position.set(-4.25,-1.55,0);group.add(chin);
 const engine=new THREE.Mesh(new THREE.BoxGeometry(4.6,.9,3),dark);engine.position.set(.7,2.08,0);group.add(engine);
 for(const side of [-1,1]){const door=new THREE.Mesh(new THREE.BoxGeometry(3.2,2.35,.12),paint);door.position.set(-.05,-.15,side*2.21);group.add(door);const window=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.05,.15),glass);window.position.set(-.5,.55,side*2.3);group.add(window);}
 // Cauda afunilada, estabilizadores e rotor de cauda no plano vertical.
 const boom=new THREE.Mesh(new THREE.CylinderGeometry(.40,1.08,11.8,8),paint);boom.rotation.z=Math.PI/2;boom.position.set(8,1,0);group.add(boom);
 const fin=new THREE.Mesh(new THREE.BoxGeometry(1.4,3.6,.30),paint);fin.position.set(13.2,2.05,0);group.add(fin);
 const tailplane=new THREE.Mesh(new THREE.BoxGeometry(2.4,.23,5.2),dark);tailplane.position.set(11.2,1,0);group.add(tailplane);
 const tailRotor=new THREE.Group();tailRotor.position.set(13.45,2.35,.42);
 for(let n=0;n<4;n++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.28,2.6,.13),dark);blade.position.y=1.1;blade.rotation.z=n*Math.PI/2;const pivot=new THREE.Group();pivot.rotation.z=n*Math.PI/2;pivot.add(new THREE.Mesh(new THREE.BoxGeometry(.35,2.8,.12),dark));tailRotor.add(pivot);}
 tailRotor.add(new THREE.Mesh(new THREE.SphereGeometry(.36,8,6),paint));group.add(tailRotor);
 const mast=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,1.4,10),dark);mast.position.set(-.3,3,0);group.add(mast);
 const rotor=new THREE.Group();rotor.position.set(-.3,3.8,0);for(let i=0;i<4;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(15,.14,.6),dark);blade.rotation.y=i*Math.PI/4;rotor.add(blade);}rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.28,10),paint));group.add(rotor);
 for(const side of [-1,1]){const skid=new THREE.Mesh(new THREE.BoxGeometry(10,.27,.34),dark);skid.position.set(-.5,-3,side*2.5);group.add(skid);for(const xx of [-3.3,2.5]){const support=new THREE.Mesh(new THREE.BoxGeometry(.24,1.6,.24),dark);support.position.set(xx,-2.3,side*2.5);group.add(support);}}
 group.position.set(x,height(x,z)+5,z);group.rotation.y=-Math.PI/2;scene.add(group);
 const v={type:'heli',group,rotor,tailRotor,speed:0,yaw:0,vertical:0};helis.push(v);return v;
}
function jeep(x,z,color){const group=new THREE.Group(),wheelGroups=[];const b=new THREE.Mesh(new THREE.BoxGeometry(6,1.7,3.4),mat(color));group.add(b);b.position.y=1.75;const cab=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.4,3),mat(0xece6d8));cab.position.set(-.65,3.05,0);group.add(cab);for(let dx of [-1.9,2])for(let dz of [-1.65,1.65]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.84,.84,.5,12),inkMat);w.rotation.x=Math.PI/2;w.position.set(dx,1.1,dz);group.add(w);wheelGroups.push(w);}group.position.set(x,driveHeight(x,z),z);scene.add(group);const v={type:'jeep',group,wheelGroups,speed:0,yaw:0};cars.push(v);return v;}
// Normal calculada a partir do mesmo campo de altura usado para construir o solo.
function terrainAttitude(x,z,yaw){const forward=new THREE.Vector2(-Math.sin(yaw),-Math.cos(yaw)),side=new THREE.Vector2(Math.cos(yaw),-Math.sin(yaw)),step=3.5;
 const front=driveHeight(x+forward.x*step,z+forward.y*step),rear=driveHeight(x-forward.x*step,z-forward.y*step);
 const left=driveHeight(x-side.x*step,z-side.y*step),right=driveHeight(x+side.x*step,z+side.y*step);
 return {pitch:Math.atan2(front-rear,step*2),roll:Math.atan2(right-left,step*2)};
}
for(let i=0;i<3;i++){const b=bases[i],c=colors[i];const y=height(b.x,b.z);cylinder(b.x,y+.5,b.z,26,1.2,0xf8f8ef,32);cylinder(b.x,y+1.2,b.z,19,.4,c,32);const H=box(b.x,y+1.5,b.z,3,.15,17,0xffffff);box(b.x,y+1.5,b.z,14,.15,2.2,0xffffff);for(let j=0;j<7;j++){const a=j*2*Math.PI/7,x=b.x+57*Math.cos(a),z=b.z+57*Math.sin(a);building(x,z,c,12+(j%3)*4,15);if(j%2===0)tower(b.x+72*Math.cos(a),b.z+72*Math.sin(a),c);}const dir=new THREE.Vector2(-b.x,-b.z).normalize();helicopter(b.x+32,b.z-28,c);jeep(b.x+dir.x*37,b.z+dir.y*37,c);jeep(b.x-dir.y*31,b.z+dir.x*31,c);}
// Fortaleza central: estruturas próprias e objetivo visual, não importado de outro mapa.
const cy=height(0,0);cylinder(0,cy+6,0,45,12,0xc9c8c2,16);cylinder(0,cy+15,0,30,7,0xfaf8f1,16);cylinder(0,cy+24,0,15,13,0x65778a,16);const radar=new THREE.Mesh(new THREE.SphereGeometry(13,16,10),whiteMat);radar.position.set(0,cy+39,0);scene.add(radar);for(let i=0;i<8;i++){const a=i*Math.PI/4;tower(69*Math.cos(a),69*Math.sin(a));}
for(let i=0;i<24;i++){const a=i*2.399,r=92+((i*37)%148),x=r*Math.cos(a),z=r*Math.sin(a);building(x,z,i%3===0?0x8a8e92:0xc69d69,12,10);}
// Zonas de combate distribuídas para não haver grandes vazios atrás das bases.
const placeOutpost=(x,z,accent)=>{
 for(let k=0;k<4;k++){const dx=(k%2)*25-12,dz=Math.floor(k/2)*24-12;
  if(bases.every(b=>Math.hypot(x+dx-b.x,z+dz-b.z)>112))building(x+dx,z+dz,accent,12+(k%2)*4,11);
 }
 tower(x+34,z-28,accent);
 for(let k=0;k<5;k++){const xx=x-32+(k%3)*14,zz=z+38+Math.floor(k/3)*12;
 box(xx,height(xx,zz)+2,zz,7,4,7,0xa99b82);}
};
for(const [x,z,c] of [[-325,-220,0x6688a4],[290,-250,0xb39b74],[0,365,0x759588],[-360,85,0x8e9c84],[365,55,0x9e917f],[10,-340,0xa29a84],[40,195,0xabb4bb]])placeOutpost(x,z,c);
// Formações rochosas e depósitos de carga em espaços antes vazios.
for(let i=0;i<70;i++){
 const x=((i*181+89)%1010)-505,z=((i*233+91)%1020)-510;
 if(bases.some(b=>Math.hypot(x-b.x,z-b.z)<115)||Math.hypot(x,z)<85)continue;
 const y=height(x,z),r=3+i%5;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),mat(i%3?0xd2c8b3:0xbeb6a6));
 rock.position.set(x,y+r*.32,z);rock.scale.y=1.2+(i%4)*.32;scene.add(rock);
}
// Rio estilizado atravessando o vale em segmentos, simples e leve.
const river=[];for(let i=-34;i<=34;i++){const z=i*17,x=-90+22*Math.sin(z*.013);river.push([x,height(x,z)+1,z]);}line(river,waterMat,10);
for(let i=0;i<340;i++){const x=((i*97+23)%1140)-570,z=((i*317+7)%1140)-570;const nearBase=bases.some(b=>Math.hypot(x-b.x,z-b.z)<96);if(nearBase||Math.hypot(x,z)<78||Math.abs(x+90-22*Math.sin(z*.013))<17)continue;const h=height(x,z);if(h>130)continue;const tall=7+(i%5)*2.2;cylinder(x,h+2,z,1.8,4,trunkMat,5);const canopy=new THREE.Mesh(new THREE.ConeGeometry(5+(i%3),tall,6),treeMat);canopy.position.set(x,h+4+tall*.46,z);scene.add(canopy);}
// Limites montanhosos sem reutilização de cenas antigas.
const player={pos:new THREE.Vector3(),yaw:0,pitch:0,team:0,vehicle:null};let orbitYaw=0,orbitPitch=.2;
// Arma FPS independente dos outros modos: viewmodel é filho da câmera.
scene.add(camera);const weapon=new THREE.Group();camera.add(weapon);
// Viewmodel inspirado no fuzil do multiplayer original: coronha, receptor, cano,
// mira, carregador, guarda-mão e hachuras de tinta em uma escala FPS legível.
const gunMetal=mat(0x263b50),gunGrip=mat(0x534c46),gunAccent=mat(0xb73e40),gunPaper=mat(0xf0eadf);
function gunPart(w,h,d,x,y,z,m,parent=weapon){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
gunPart(.38,.25,.74,.44,-.43,-.48,gunPaper);
gunPart(.52,.32,1.18,.40,-.30,-1.02,gunPaper);
gunPart(.24,.08,.90,.40,-.10,-1.08,gunMetal);
let barrel=new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,1.72,8),gunMetal);barrel.rotation.x=Math.PI/2;barrel.position.set(.40,-.25,-2.16);weapon.add(barrel);
let muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.14,8),gunPaper);muzzle.rotation.x=Math.PI/2;muzzle.position.set(.40,-.25,-3);weapon.add(muzzle);
gunPart(.23,.62,.30,.36,-.68,-.76,gunGrip);
gunPart(.07,.19,.08,.40,.12,-1.05,gunAccent);
gunPart(.28,.4,.24,.40,-.59,-1.18,gunMetal);
const hand=mat(0xe0bd94);gunPart(.28,.22,.4,.42,-.53,-1.35,hand);
// Canos em perspectiva: peças ficam à frente da câmera e nunca no chão.
weapon.position.set(0,0,0);
const blockers=()=>obstacles;function blocked(x,z,r=1.2){return blockers().some(o=>Math.abs(x-o.x)<o.w/2+r&&Math.abs(z-o.z)<o.d/2+r);}
// Arsenal compartilhado conceitualmente com o FPS clássico; protótipo solo ainda sem dano em rede.
const weaponDefs={rifle:{name:'FUZIL',mag:30,stock:150,delay:115,reload:1250,spread:.009},smg:{name:'SMG',mag:36,stock:180,delay:75,reload:1150,spread:.02},shotgun:{name:'ESCOPETA',mag:6,stock:42,delay:650,reload:1550,spread:.10,pellets:8},sniper:{name:'SNIPER',mag:6,stock:36,delay:950,reload:1700,spread:.001},launcher:{name:'LANÇA-FOGUETES',mag:1,stock:10,delay:1300,reload:1900,spread:.004},knife:{name:'FACA',mag:0,stock:0,delay:470,reload:0,spread:0}};
const ammunition={};for(const [key,def] of Object.entries(weaponDefs))ammunition[key]={ammo:def.mag,reserve:def.stock};
let weaponMode='rifle',reloadUntil=0,shootHeld=false,shootAt=0,kick=0,aiming=false;
const weaponHud=document.getElementById('weaponHud'),fireButton=document.getElementById('fire'),reloadButton=document.getElementById('reload');
function displayAmmo(){const d=weaponDefs[weaponMode],a=ammunition[weaponMode];weaponHud.textContent=weaponMode==='knife'?'FACA':`${d.name}  •  ${a.ammo} / ${a.reserve}`;}
function switchWeapon(mode){if(!weaponDefs[mode]||player.vehicle)return;weaponMode=mode;reloadUntil=0;displayAmmo();showNotice(weaponDefs[mode].name);}
function shoot(){const now=performance.now(),d=weaponDefs[weaponMode],a=ammunition[weaponMode];if(player.vehicle||now<shootAt||now<reloadUntil)return;if(weaponMode!=='knife'&&a.ammo<=0){reload();return;}shootAt=now+d.delay;if(weaponMode!=='knife')a.ammo--;kick=weaponMode==='launcher'?.27:.10;displayAmmo();
 const origin=camera.position.clone(),forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion),count=d.pellets||1;
 for(let i=0;i<count;i++){const direction=forward.clone();if(d.spread){direction.x+=(Math.random()-.5)*d.spread;direction.y+=(Math.random()-.5)*d.spread;direction.normalize();}const range=weaponMode==='knife'?3:weaponMode==='shotgun'?75:250;const ray=new THREE.Raycaster(origin,direction,.1,range);const impact=ray.intersectObjects(shotTargets,true)[0];const end=impact?impact.point:origin.clone().addScaledVector(direction,range);
 if(weaponMode==='knife')continue;const start=camera.localToWorld(new THREE.Vector3(.45,-.33,-1.20));const trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints([start,end]),new THREE.LineBasicMaterial({color:weaponMode==='launcher'?0xff6743:0xffb45c,transparent:true,opacity:.8}));scene.add(trace);setTimeout(()=>{scene.remove(trace);trace.geometry.dispose();trace.material.dispose();},weaponMode==='launcher'?240:75);}
}
function reload(){if(player.vehicle||weaponMode==='knife')return;const d=weaponDefs[weaponMode],a=ammunition[weaponMode];if(a.reserve<=0||a.ammo===d.mag||performance.now()<reloadUntil)return;const selected=weaponMode;reloadUntil=performance.now()+d.reload;showNotice('RECARREGANDO');setTimeout(()=>{const n=Math.min(d.mag-a.ammo,a.reserve);a.ammo+=n;a.reserve-=n;if(weaponMode===selected)displayAmmo();},d.reload);}
const shotTargets=[];scene.traverse(o=>{if(o.isMesh&&o.geometry?.type==='BoxGeometry'&&!weapon.children.includes(o))shotTargets.push(o);});fireButton.addEventListener('pointerdown',e=>{e.preventDefault();fireButton.setPointerCapture(e.pointerId);shootHeld=true;shoot();});for(const ev of ['pointerup','pointercancel','lostpointercapture'])fireButton.addEventListener(ev,()=>shootHeld=false);reloadButton.onclick=reload;
const keys={};const stick={x:0,y:0};let jumpVelocity=0,jumpHeight=0;let clock=new THREE.Clock();
const info=document.getElementById('info'),notice=document.getElementById('notice');function showNotice(t){notice.textContent=t;notice.style.display='block';clearTimeout(showNotice.timer);showNotice.timer=setTimeout(()=>notice.style.display='none',2300);}
function spawn(){player.vehicle=null;jumpHeight=0;jumpVelocity=0;updateModeControls();const b=bases[player.team],d=new THREE.Vector2(-b.x,-b.z).normalize();player.pos.set(b.x+d.x*18,height(b.x+d.x*18,b.z+d.y*18)+2,b.z+d.y*18);player.yaw=Math.atan2(-d.x,-d.y);player.pitch=0;showNotice('TIME '+['AZUL','VERMELHO','VERDE'][player.team]+' • BASE PROTEGIDA');}
function enter(){if(player.vehicle){const p=player.vehicle.group.position;if(player.vehicle.type==='heli'&&p.y>height(p.x,p.z)+7){showNotice('DESÇA E POUSE ANTES DE SAIR');return;}let ex=p.x+8,ez=p.z+8;if(blocked(ex,ez)){ex=p.x-8;ez=p.z-8;}player.pos.set(ex,height(ex,ez)+2,ez);player.vehicle=null;updateModeControls();return;}let nearest=null,dist=13;for(const v of [...helis,...cars]){let d=player.pos.distanceTo(v.group.position);if(d<dist){dist=d;nearest=v;}}if(nearest){player.vehicle=nearest;player.yaw=nearest.yaw;orbitYaw=0;orbitPitch=.2;updateModeControls();showNotice(nearest.type==='heli'?'HELICÓPTERO • CONTROLE EM TERCEIRA PESSOA':'JEEP • CONTROLE EM TERCEIRA PESSOA');}else showNotice('APROXIME-SE DE UM VEÍCULO');}
const board=document.getElementById('board');board.addEventListener('click',enter);const action=document.getElementById('action'),verticalControls=document.getElementById('verticalControls');
function updateModeControls(){const v=player.vehicle;weapon.visible=!v;fireButton.style.display=v?'none':'block';reloadButton.style.display=v?'none':'block';weaponHud.style.display=v?'none':'block';verticalControls.style.display=v?.type==='heli'?'flex':'none';action.textContent=v?'SAIR':'PULAR';document.getElementById('modeHint').textContent=v?.type==='heli'?'Analógico: voar e virar • arraste a tela para olhar • ▲ subir / ▼ descer':v?'Analógico: dirigir • arraste a tela para olhar • SAIR para desembarcar':'Analógico: mover • arraste a tela para olhar';}
action.addEventListener('click',()=>{if(player.vehicle){enter();return;}if(jumpHeight<=.02)jumpVelocity=10.8;});
const stickEl=document.getElementById('stick'),nub=document.getElementById('nub');let stickId=null;
function updateStick(e){const r=stickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const limit=(r.width-60)/2;const magnitude=Math.hypot(dx,dy);if(magnitude>limit){dx=dx/magnitude*limit;dy=dy/magnitude*limit;}stick.x=dx/limit;stick.y=-dy/limit;nub.style.transform=`translate(${dx}px, ${dy}px)`;}
function releaseStick(e){if(e&&stickId!==e.pointerId)return;stickId=null;stick.x=0;stick.y=0;nub.style.transform='translate(0,0)';}
stickEl.addEventListener('pointerdown',e=>{e.preventDefault();if(stickId!==null)return;stickId=e.pointerId;stickEl.setPointerCapture(e.pointerId);updateStick(e);});stickEl.addEventListener('pointermove',e=>{if(e.pointerId===stickId)updateStick(e);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])stickEl.addEventListener(ev,releaseStick);
document.getElementById('reset').onclick=spawn;document.getElementById('team').onclick=()=>{player.team=(player.team+1)%3;spawn();};
for(const el of document.querySelectorAll('[data-k]')){const k=el.dataset.k.toLowerCase();el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);keys[k]=true;});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>keys[k]=false);}
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if([' ','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();if(e.key.toLowerCase()==='f'&&!e.repeat)enter();if(e.key.toLowerCase()==='r'&&!e.repeat)reload();if(/^[1-6]$/.test(e.key)&&!e.repeat)switchWeapon(Object.keys(weaponDefs)[Number(e.key)-1]);if(e.key.toLowerCase()==='v'&&!e.repeat)switchWeapon(Object.keys(weaponDefs)[(Object.keys(weaponDefs).indexOf(weaponMode)+1)%6]);if(e.key===' '&&!e.repeat&&!player.vehicle&&jumpHeight<=.02)jumpVelocity=10.8;});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===2)aiming=true;});renderer.domElement.addEventListener('pointerup',e=>{if(e.button===2)aiming=false;});document.getElementById('changeWeapon').onclick=()=>switchWeapon(Object.keys(weaponDefs)[(Object.keys(weaponDefs).indexOf(weaponMode)+1)%6]);
let dragging=false,lookId=null,px=0,py=0;renderer.domElement.addEventListener('pointerdown',e=>{if(lookId!==null)return;lookId=e.pointerId;dragging=true;px=e.clientX;py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointerup',e=>{if(e.pointerId===lookId){dragging=false;lookId=null;}});renderer.domElement.addEventListener('pointercancel',()=>{dragging=false;lookId=null;});renderer.domElement.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==lookId)return;let dx=e.clientX-px,dy=e.clientY-py;px=e.clientX;py=e.clientY;if(player.vehicle){orbitYaw-=dx*.005;orbitPitch=THREE.MathUtils.clamp(orbitPitch+dy*.004,-.35,.85);}else{player.yaw-=dx*.004;player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.003,-.85,.85);}});
function animate(){requestAnimationFrame(animate);const dt=Math.min(.05,clock.getDelta());const f=THREE.MathUtils.clamp(Number(!!keys.w)-Number(!!keys.s)+stick.y,-1,1),side=THREE.MathUtils.clamp(Number(!!keys.d)-Number(!!keys.a)+stick.x,-1,1);const v=player.vehicle;if(shootHeld)shoot();kick=Math.max(0,kick-dt*.8);weapon.rotation.x=kick;camera.fov=THREE.MathUtils.lerp(camera.fov,aiming&&!v?42:72,Math.min(1,dt*10));camera.updateProjectionMatrix();
if(v){const turn=(Number(!!keys.e)-Number(!!keys.q));v.yaw+=(turn-side)*dt*(v.type==='heli'?1.25:1.9);v.group.rotation.y=v.yaw-Math.PI/2;v.speed=THREE.MathUtils.lerp(v.speed,f*(v.type==='heli'?75:38),Math.min(1,dt*2));v.group.position.x+=-Math.sin(v.yaw)*v.speed*dt;v.group.position.z+=-Math.cos(v.yaw)*v.speed*dt;v.group.position.x=THREE.MathUtils.clamp(v.group.position.x,-580,580);v.group.position.z=THREE.MathUtils.clamp(v.group.position.z,-580,580);if(v.type==='heli'){const lift=(Number(!!keys[' '])-Number(!!keys.shift));v.group.position.y+=lift*35*dt;v.group.position.y=Math.max(height(v.group.position.x,v.group.position.z)+5,Math.min(230,v.group.position.y));v.rotor.rotation.y+=dt*18;v.tailRotor.rotation.z+=dt*31;v.group.rotation.z=THREE.MathUtils.lerp(v.group.rotation.z,0,Math.min(1,dt*4));v.group.rotation.x=THREE.MathUtils.lerp(v.group.rotation.x,f*.045,Math.min(1,dt*4));}else {const xx=v.group.position.x,zz=v.group.position.z;const ang=terrainAttitude(xx,zz,v.yaw);const surface=driveHeight(xx,zz);v.group.position.y=THREE.MathUtils.lerp(v.group.position.y,surface,Math.min(1,dt*16));v.group.rotation.z=THREE.MathUtils.lerp(v.group.rotation.z,-ang.pitch,Math.min(1,dt*9));v.group.rotation.x=THREE.MathUtils.lerp(v.group.rotation.x,ang.roll,Math.min(1,dt*9));for(const wheel of v.wheelGroups)wheel.rotation.y+=v.speed*dt/.84;}
const orbitAngle=v.yaw+orbitYaw,dist=v.type==='heli'?25:15;const offset=new THREE.Vector3(Math.sin(orbitAngle)*dist,dist*(.45+orbitPitch),Math.cos(orbitAngle)*dist); // câmera de acompanhamento atrás do nariz (-Z local)
const desired=v.group.position.clone().add(offset);desired.y=Math.max(desired.y,height(desired.x,desired.z)+3);camera.position.lerp(desired,Math.min(1,dt*5));camera.lookAt(v.group.position.x,v.group.position.y+3,v.group.position.z);player.pos.copy(v.group.position);
}else{const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw),s=dt*19;const nextX=player.pos.x+(-sin*f+cos*side)*s,nextZ=player.pos.z+(-cos*f-sin*side)*s;if(!blocked(nextX,player.pos.z))player.pos.x=nextX;if(!blocked(player.pos.x,nextZ))player.pos.z=nextZ;player.pos.x=THREE.MathUtils.clamp(player.pos.x,-580,580);player.pos.z=THREE.MathUtils.clamp(player.pos.z,-580,580);jumpVelocity-=26*dt;jumpHeight=Math.max(0,jumpHeight+jumpVelocity*dt);if(jumpHeight===0)jumpVelocity=0;player.pos.y=groundSurface(player.pos.x,player.pos.z)+2+jumpHeight;camera.position.copy(player.pos);camera.rotation.order='YXZ';camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;}
board.style.display=(!v&&[...helis,...cars].some(vehicle=>player.pos.distanceTo(vehicle.group.position)<13))?'block':'none';info.textContent=`GUERRA DAS 3 BASES • ${['AZUL','VERMELHO','VERDE'][player.team]} • ${v?(v.type==='heli'?'HELICÓPTERO':'JEEP'):'A PÉ'} • X:${Math.round(player.pos.x)} Z:${Math.round(player.pos.z)} • PROTÓTIPO SOLO`;document.getElementById('cross').style.display=v?'none':'block';renderer.render(scene,camera);}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});displayAmmo();spawn();animate();
