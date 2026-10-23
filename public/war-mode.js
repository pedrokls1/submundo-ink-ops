import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

const W=1200,HALF=600;
const colors=[0x356bc1,0xd73535,0x3d8b68];
const TEAM_NAMES=['AZUL','VERMELHO','VERDE'];
const bases=[{x:-425,z:280},{x:0,z:-425},{x:425,z:280}];

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xc8e2ef);
scene.fog=new THREE.FogExp2(0xc8e2ef,.00083);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,4200);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xddefff,0x927c66,2.3));
const sun=new THREE.DirectionalLight(0xffffff,2.3); sun.position.set(-170,390,130); scene.add(sun);

const ink=0x24466e, paper=0xf5f0e3;
const mat=(c)=>new THREE.MeshLambertMaterial({color:c,flatShading:true});
const treeMat=mat(0x5b8c48),trunkMat=mat(0x8a745d),inkMat=mat(ink),whiteMat=mat(paper),waterMat=new THREE.MeshLambertMaterial({color:0x79bfd4,flatShading:true});

const flatZones=[[-325,-220,64],[290,-250,64],[0,365,64],[-360,85,64],[365,55,64],[10,-340,64],[40,195,64],[-520,-90,72],[520,-180,72],[-430,410,72],[430,390,72],[0,0,365],[-500,-300,78],[500,-300,78],[-500,360,78],[500,360,78],[-350,-90,68],[350,-80,68],[-340,250,68],[350,245,68],[-120,-430,68],[135,430,68]];
function terrainRaw(x,z){
  const d=Math.hypot(x,z);
  let h=8+11*Math.sin(x*.011)*Math.cos(z*.012)+6*Math.sin((x+z)*.029);
  h+=58*Math.pow(Math.max(0,(d-260)/340),1.7);
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7+.35,px=460*Math.cos(a),pz=460*Math.sin(a);
    h+=43*Math.exp(-((x-px)**2+(z-pz)**2)/22000);
  }
  for(const b of bases){
    const q=Math.hypot(x-b.x,z-b.z);
    if(q<105){
      const blend=THREE.MathUtils.smoothstep(q,85,105);
      h=THREE.MathUtils.lerp(28,h,blend);
    }
  }
  return h;
}
function height(x,z){
  let h=terrainRaw(x,z);
  // Flatten a whole small village, not individual hovering houses.
  for(const [vx,vz,r] of flatZones){const d=Math.hypot(x-vx,z-vz);
    if(d<r+19){const level=terrainRaw(vx,vz);const blend=THREE.MathUtils.smoothstep(d,r-8,r+19);
      h=THREE.MathUtils.lerp(level,h,blend);}}
  return h;
}

const verts=[],indices=[],terrainColors=[],N=128;
for(let j=0;j<=N;j++) for(let i=0;i<=N;i++){
  const x=-HALF+i*W/N,z=-HALF+j*W/N,y=height(x,z);
  verts.push(x,y,z);
  const c=new THREE.Color();
  const noise=.5+.5*Math.sin(x*.018+z*.006)*Math.cos(z*.021-x*.004);
  if(y<18) c.setHex(0x87b566);
  else if(y<52) c.setHex(0x7ba05f);
  else if(y<95) c.setHex(0xa8a06f);
  else c.setHex(0xc5b090);
  c.lerp(new THREE.Color(0x5e8e48),Math.max(0,noise-.35)*.22);
  terrainColors.push(c.r,c.g,c.b);
}
for(let j=0;j<N;j++) for(let i=0;i<N;i++){
  const a=j*(N+1)+i,b=a+N+1; indices.push(a,b,a+1,b,b+1,a+1);
}
const geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
geo.setAttribute('color',new THREE.Float32BufferAttribute(terrainColors,3));
geo.setIndex(indices); geo.computeVertexNormals();
const terrainMesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}));
scene.add(terrainMesh);

function box(x,y,z,w,h,d,color=paper){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);scene.add(m);return m;}
function cylinder(x,y,z,r,h,color,segments=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat(color));m.position.set(x,y,z);scene.add(m);return m;}
function line(points,color=ink,width=2){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const material=color?.isMaterial?color:mat(color);const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*5),width,5,false),material);scene.add(mesh);return mesh;}
// Pontes, pilares, estradas de terra e rio foram removidos temporariamente.
const groundRay=new THREE.Raycaster();
function groundSurface(x,z){groundRay.set(new THREE.Vector3(x,600,z),new THREE.Vector3(0,-1,0));const hit=groundRay.intersectObject(terrainMesh,false)[0];return hit?hit.point.y:height(x,z);}
function driveHeight(x,z,entity=null,currentY=null){if(entity)entity.onBridge=false;return groundSurface(x,z);}

const tower=(x,z,c=ink)=>{const y=height(x,z);box(x,y+13,z,5,26,5,c);box(x,y+28,z,12,5,12,0xfaf5e8);box(x,y+32,z,1,8,1,c);};
const obstacles=[];
function building(x,z,c,w=18,d=15){const y=height(x,z);box(x,y-1.2,z,w+.3,2.4,d+.3,0xb4aa94);box(x,y+5,z,w,10,d,0xf7f2e6);box(x,y+10.5,z,w+2,2,d+2,c);
  // Porta e janelas desenhadas na fachada voltada para +Z, sempre acima do piso plano.
  box(x,y+2.15,z+d/2+.19,2.3,4.3,.22,0x795a43);box(x,y+2.1,z+d/2+.32,1.45,3.25,.08,0xb7c6c7);
  const winW=Math.max(1.5,Math.min(2.7,w*.16));for(const wx of [-w*.29,w*.29]){box(x+wx,y+6.6,z+d/2+.2,winW,2.25,.22,0x557d91);box(x+wx,y+6.6,z+d/2+.34,.12,2.35,.08,0xe9e3d7);box(x+wx,y+6.6,z+d/2+.35,winW, .12,.08,0xe9e3d7);}
  obstacles.push({x,z,w:w+2,d:d+2});}
function cityBuilding(x,z,w=24,d=22,floors=4,color=0x9aabb3){if(bases.some(b=>Math.hypot(x-b.x,z-b.z)<125))return;const y=height(x,z),h=floors*5.2;box(x,y-1,z,w+1,2,d+1,0x9b9b91);box(x,y+h/2,z,w,h,d,color);box(x,y+h+1,z,w+2,2,d+2,0x596d7a);for(let floor=0;floor<floors;floor++){for(const side of [-1,1])for(let col=0;col<3;col++){const wx=x+side*(w*.29),wz=z-d/2-.12+col*(d-1)/2;box(wx,y+3+floor*5.2,wz,3.1,2.7,.16,0x426a80);box(wx,y+3+floor*5.2,wz-.1,.12,2.8,.06,0xe4e1d7);}}box(x,y+2.2,z+d/2+.16,3,4.4,.18,0x614f43);obstacles.push({x,z,w:w+2,d:d+2});}


const helis=[],cars=[];
function helicopter(x,z,color,yaw=0){
  const group=new THREE.Group(),model=new THREE.Group(),paint=mat(color),glass=new THREE.MeshPhongMaterial({color:0x426f94,shininess:85,transparent:true,opacity:.83}),dark=mat(0x25394e);
  group.add(model);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(2.35,5.7,5,12),paint);body.rotation.z=Math.PI/2;body.position.x=-.8;model.add(body);
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.28,14,10),glass);canopy.scale.set(1.50,.91,.94);canopy.position.set(-3.25,.4,0);model.add(canopy);
  const chin=new THREE.Mesh(new THREE.BoxGeometry(2,.65,2.7),dark);chin.position.set(-4.25,-1.55,0);model.add(chin);
  const engine=new THREE.Mesh(new THREE.BoxGeometry(4.6,.9,3),dark);engine.position.set(.7,2.08,0);model.add(engine);
  for(const side of [-1,1]){const door=new THREE.Mesh(new THREE.BoxGeometry(3.2,2.35,.12),paint);door.position.set(-.05,-.15,side*2.21);model.add(door);const window=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.05,.15),glass);window.position.set(-.5,.55,side*2.3);model.add(window);}
  const boom=new THREE.Mesh(new THREE.CylinderGeometry(.40,1.08,11.8,8),paint);boom.rotation.z=Math.PI/2;boom.position.set(8,1,0);model.add(boom);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(1.4,3.6,.30),paint);fin.position.set(13.2,2.05,0);model.add(fin);
  const tailplane=new THREE.Mesh(new THREE.BoxGeometry(2.4,.23,5.2),dark);tailplane.position.set(11.2,1,0);model.add(tailplane);
  const tailRotor=new THREE.Group();tailRotor.position.set(13.45,2.35,.42);
  for(let n=0;n<4;n++){const pivot=new THREE.Group();pivot.rotation.z=n*Math.PI/2;const blade=new THREE.Mesh(new THREE.BoxGeometry(.35,2.8,.12),dark);blade.position.y=1.1;pivot.add(blade);tailRotor.add(pivot);} tailRotor.add(new THREE.Mesh(new THREE.SphereGeometry(.36,8,6),paint)); model.add(tailRotor);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,1.4,10),dark);mast.position.set(-.3,3,0);model.add(mast);
  const rotor=new THREE.Group();rotor.position.set(-.3,3.8,0);for(let i=0;i<4;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(15,.14,.6),dark);blade.rotation.y=i*Math.PI/4;rotor.add(blade);} rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.28,10),paint)); model.add(rotor);
  for(const side of [-1,1]){const skid=new THREE.Mesh(new THREE.BoxGeometry(10,.27,.34),dark);skid.position.set(-.5,-3,side*2.5);model.add(skid);for(const xx of [-3.3,2.5]){const support=new THREE.Mesh(new THREE.BoxGeometry(.24,1.6,.24),dark);support.position.set(xx,-2.3,side*2.5);model.add(support);}}
  group.position.set(x,driveHeight(x,z)+5,z);group.rotation.y=yaw-Math.PI/2;model.rotation.order='ZYX';scene.add(group);
  const v={type:'heli',group,model,rotor,tailRotor,speed:0,targetSpeed:0,yaw,vertical:0,targetVertical:0}; helis.push(v); return v;
}
function jeep(x,z,color,yaw=0){
  const group=new THREE.Group(),model=new THREE.Group(),wheelGroups=[],frontWheelPivots=[];
  group.add(model);
  const body=new THREE.Mesh(new THREE.BoxGeometry(6.6,1.55,3.5),mat(color));body.position.y=1.85;model.add(body);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(1.75,.92,3.35),mat(color));hood.position.set(-2.32,2.58,0);model.add(hood);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(2.65,1.5,3.05),mat(0xece6d8));cab.position.set(.1,3.18,0);model.add(cab);
  const bed=new THREE.Mesh(new THREE.BoxGeometry(2.3,1.05,3.2),mat(0xe1d2b8));bed.position.set(2.1,2.45,0);model.add(bed);
  const windshield=new THREE.Mesh(new THREE.BoxGeometry(.12,1.05,2.7),new THREE.MeshPhongMaterial({color:0x88a9bf,transparent:true,opacity:.78,shininess:80}));windshield.position.set(-1.05,3.2,0);model.add(windshield);
  const grill=new THREE.Mesh(new THREE.BoxGeometry(.25,.65,2.5),inkMat);grill.position.set(-3.2,2.12,0);model.add(grill);
  for(const dz of [-1.05,-.35,.35,1.05]){const slot=new THREE.Mesh(new THREE.BoxGeometry(.08,.09,.22),mat(0xd7e6ed));slot.position.set(-3.34,2.05,dz);model.add(slot);}
  for(const side of [-1,1]){const light=new THREE.Mesh(new THREE.BoxGeometry(.18,.35,.45),mat(0xffe1a2));light.position.set(-3.33,2.3,side*1.18);model.add(light);const tail=new THREE.Mesh(new THREE.BoxGeometry(.18,.28,.4),mat(0xc64f43));tail.position.set(3.35,2.2,side*1.2);model.add(tail);}
  // Cada roda fica num pivô próprio: as dianteiras esterçam e todas giram ao rodar.
  for(let dx of [-2.1,2.1]) for(let dz of [-1.65,1.65]){
    const pivot=new THREE.Group();pivot.position.set(dx,1.12,dz);model.add(pivot);
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.86,.86,.58,12),inkMat);wheel.rotation.x=Math.PI/2;pivot.add(wheel);wheelGroups.push(wheel);
    if(dx<0) frontWheelPivots.push(pivot);
  }
  const rack=new THREE.Mesh(new THREE.BoxGeometry(2.1,.15,3.2),mat(0x5c6c6b));rack.position.set(.1,4.05,0);model.add(rack);
  for(const side of [-1,1]){const rail=new THREE.Mesh(new THREE.BoxGeometry(2.1,.12,.12),mat(0x5c6c6b));rail.position.set(2.05,3.02,side*1.5);model.add(rail);}
  group.position.set(x,driveHeight(x,z),z);group.rotation.y=yaw-Math.PI/2;model.rotation.order='ZYX';scene.add(group);
  const v={type:'jeep',group,model,wheelGroups,frontWheelPivots,speed:0,targetSpeed:0,yaw}; cars.push(v); return v;
}
function terrainAttitude(x,z,yaw){const forward=new THREE.Vector2(-Math.sin(yaw),-Math.cos(yaw)),side=new THREE.Vector2(Math.cos(yaw),-Math.sin(yaw)),step=3.5;const front=driveHeight(x+forward.x*step,z+forward.y*step),rear=driveHeight(x-forward.x*step,z-forward.y*step),left=driveHeight(x-side.x*step,z-side.y*step),right=driveHeight(x+side.x*step,z+side.y*step);return {pitch:Math.atan2(front-rear,step*2),roll:Math.atan2(right-left,step*2)};}

for(let i=0;i<3;i++){
  const b=bases[i],c=colors[i],y=height(b.x,b.z);
  cylinder(b.x,y+.5,b.z,26,1.2,0xf8f8ef,32); cylinder(b.x,y+1.2,b.z,19,.4,c,32);
  box(b.x,y+1.5,b.z,3,.15,17,0xffffff); box(b.x,y+1.5,b.z,14,.15,2.2,0xffffff);
  for(let j=0;j<7;j++){const a=j*2*Math.PI/7,x=b.x+57*Math.cos(a),z=b.z+57*Math.sin(a);building(x,z,c,12+(j%3)*4,15);if(j%2===0) tower(b.x+72*Math.cos(a),b.z+72*Math.sin(a),c);}
  const dir=new THREE.Vector2(-b.x,-b.z).normalize(),face=Math.atan2(-dir.x,-dir.y);
  helicopter(b.x,b.z,c,face);
  jeep(b.x+dir.x*37,b.z+dir.y*37,c,face);
  jeep(b.x-dir.y*31,b.z+dir.x*31,c,face+.35);
}

const cy=height(0,0);
// Centro mantido mais livre para destacar o aeroporto principal.
for(let i=0;i<8;i++){const a=i*Math.PI/4,r=112,x=r*Math.cos(a),z=r*Math.sin(a); box(x,cy+1.2,z,8,2.4,8,0xa79c86);} 

const placeOutpost=(x,z,accent)=>{for(let k=0;k<4;k++){const dx=(k%2)*25-12,dz=Math.floor(k/2)*24-12;if(bases.every(b=>Math.hypot(x+dx-b.x,z+dz-b.z)>112)) building(x+dx,z+dz,accent,12+(k%2)*4,11);} tower(x+34,z-28,accent); for(let k=0;k<5;k++){const xx=x-32+(k%3)*14,zz=z+38+Math.floor(k/3)*12; box(xx,height(xx,zz)+2,zz,7,4,7,0xa99b82);}};

for(const [x,z,c] of [[-350,-90,0x6688a4],[350,-80,0xb39b74],[-340,250,0x759588],[350,245,0x8e9c84],[-120,-430,0x9e917f],[135,430,0xa29a84]]) placeOutpost(x,z,c);
// Pequeno conjunto urbano com prédios mais altos para diferenciar os bairros das áreas só residenciais.
cityBuilding(-374,-105,24,22,4,0x9aabb3);cityBuilding(372,-92,22,25,5,0xb2a18e);cityBuilding(-362,268,26,22,3,0x9aa9a0);cityBuilding(370,262,22,24,4,0xa5a7ae);cityBuilding(-135,-447,23,21,4,0xb5a28e);cityBuilding(151,447,25,22,3,0x9aabb3);
// Novos edifícios urbanos distribuídos pelos setores, com fachadas e janelas visíveis.
cityBuilding(-285,-340,21,20,3,0xa4b0b5);cityBuilding(-225,-325,19,22,4,0xb9a88e);
cityBuilding(275,-350,24,20,4,0x9eabb5);cityBuilding(335,-325,20,23,3,0xb4a18e);
cityBuilding(-285,15,22,20,4,0x9caeaa);cityBuilding(-250,55,18,20,3,0xb9b1a0);
cityBuilding(275,5,23,21,5,0x9aa8b5);cityBuilding(320,35,20,20,3,0xb6a48e);
cityBuilding(-235,335,22,20,4,0xaab3b5);cityBuilding(-180,365,19,22,3,0xb5a18d);
cityBuilding(235,345,22,21,4,0x9da9a0);cityBuilding(285,375,20,20,3,0xb5b1a4);
cityBuilding(-85,-275,19,20,3,0xb4a38e);cityBuilding(85,285,21,20,4,0x9eabb5);

function flatLevel(x,z){return height(x,z);} 
function crate(x,z,w=6,h=6,d=6,c=0x9f815e){box(x,flatLevel(x,z)+h/2,z,w,h,d,c);} 
function oilField(x,z){
  const y=flatLevel(x,z); box(x,y+.9,z,112,1.8,94,0xa39179);
  for(const [dx,dz,r] of [[-18,-10,10],[18,-10,10],[0,15,13]]){cylinder(x+dx,y+8,z+dz,r,16,0xcfc9be,18); cylinder(x+dx,y+16.8,z+dz,r+.4,.8,0x9d998f,18);} 
  for(let i=0;i<8;i++){const dx=-30+(i%4)*11,dz=25+Math.floor(i/4)*9; cylinder(x+dx,y+2.3,z+dz,1.9,4.6,0x5b78a1,10);} 
  line([[x-25,y+11,z-10],[x,y+11,z+15],[x+18,y+11,z-10]],0x6c7077,.6); 
  building(x-35,z-20,0x8d7d68,16,12); tower(x+34,z-22,0x7b6f61);
}
function cargoYard(x,z){
  const y=flatLevel(x,z); box(x,y+.8,z,118,1.6,98,0xa38f73);
  const cs=[0xc96a4b,0x5a84b1,0x9a7453,0x6e8c54];
  for(let r=0;r<3;r++) for(let c=0;c<4;c++){const xx=x-28+c*16,zz=z-18+r*16; const h=(c+r)%2?6:12; crate(xx,zz,13,h,7,cs[(r+c)%cs.length]); if(h>6) crate(xx,zz+7.5,13,6,7,cs[(r+c+1)%cs.length]);}
  building(x+30,z-18,0x7d8794,18,14); box(x+34,y+5,z+20,10,10,16,0xb7b09e); tower(x-36,z+22,0x6b7788);
}
function scrapYard(x,z){
  const y=flatLevel(x,z); box(x,y+.75,z,110,1.5,88,0x9f927d);
  building(x-24,z-15,0x8f7c63,18,13); 
  for(let i=0;i<14;i++){const xx=x-28+(i%5)*13,zz=z+8+Math.floor(i/5)*11; const pieces=box(xx,y+2.2+(i%3),zz,8,4+(i%3)*1.6,5, i%2?0x8b5f49:0x707780); pieces.rotation.y=(i%3)*.35;}
  for(const [dx,dz] of [[20,12],[29,18],[17,24]]){const tire=new THREE.Mesh(new THREE.TorusGeometry(2.2,.8,6,10),inkMat); tire.rotation.y=Math.PI/2; tire.position.set(x+dx,y+2.5,z+dz); scene.add(tire);} 
  tower(x+30,z-20,0x7c6c59);
}
function powerStation(x,z){
  const y=flatLevel(x,z); box(x,y+.8,z,108,1.6,88,0x9ea38f);
  building(x-24,z,0x8f9aa0,16,12); building(x+28,z-8,0x9c8f7c,14,12);
  for(const [dx,dz] of [[-8,-16],[10,-16],[-8,12],[10,12]]){box(x+dx,y+4.5,z+dz,6,9,6,0xb1a891); box(x+dx,y+10.2,z+dz,8,1.3,8,0x7a6f63);} 
  for(const dx of [-30,0,30]){const gy=flatLevel(x+dx,z+26); box(x+dx,gy+12,z+26,2.1,24,2.1,0x6b737a); box(x+dx,gy+23,z+26,10,1,1,0x6b737a);} 
}
function airportControlTower(x,z,y){
  // Torre alta, estreita e com cabine envidraçada bem visível de longe.
  box(x,y+19,z,9,38,9,0xe3dfd4);
  box(x,y+8,z,15,2,15,0x8d9699);
  box(x,y+38,z,15,2.5,15,0xf2eee3);
  box(x,y+42,z,22,6,22,0x687d8c);
  box(x,y+45.3,z,23,1.2,23,0xf0ece2);
  for(const side of [-1,1]){
    box(x+side*7.7,y+42,z,1.1,4.2,13,0x9bc4d0);
    box(x,y+42,z+side*7.7,13,4.2,1.1,0x9bc4d0);
    box(x+side*7.9,y+42,z,0.35,4.6,13,0xf4f0e5);
    box(x,y+42,z+side*7.9,13,4.6,.35,0xf4f0e5);
  }
  cylinder(x,y+49.8,z,0.45,3.8,0x536879,8);
  line([[x,y+51.5,z],[x,y+57,z]],0x536879,.24);
  box(x,y+54.5,z,3.2,.5,1.2,0x536879);
  obstacles.push({x,z,w:12,d:12});
}
function airportTug(x,z,y,rotation=0,color=0xe0b64f){
  const g=new THREE.Group();
  const add=(w,h,d,px,py,pz,c)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(px,py,pz);g.add(m);return m;};
  add(8,2.2,5,0,1.7,0,color);
  add(3.2,3.1,4,-1.2,3.9,0,0xd8d8ce);
  add(3.35,1.8,4,-1.2,4.1,0,0x6d9bad);
  add(1.5,.25,5,4.6,1.1,0,0x4d5559);
  for(const wx of [-2.8,2.8]) for(const wz of [-2.15,2.15]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.6,10),inkMat);wheel.rotation.x=Math.PI/2;wheel.position.set(wx,.85,wz);g.add(wheel);
  }
  g.position.set(x,y,z);g.rotation.y=rotation;scene.add(g);
  obstacles.push({x,z,w:9,d:7});
  return g;
}
function airportServiceTruck(x,z,y,rotation=0,color=0xd7dfdf){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(10,3.4,4.8),mat(color));body.position.set(0,2.6,0);g.add(body);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(3.5,3.3,4.5),mat(0xdedbd1));cab.position.set(-3.1,4.2,0);g.add(cab);
  const windshield=new THREE.Mesh(new THREE.BoxGeometry(.2,1.5,3.4),mat(0x60879a));windshield.position.set(-4.9,4.5,0);g.add(windshield);
  for(const wx of [-3.3,3.3]) for(const wz of [-2.15,2.15]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.95,.95,.6,10),inkMat);wheel.rotation.x=Math.PI/2;wheel.position.set(wx,1,wz);g.add(wheel);}
  g.position.set(x,y,z);g.rotation.y=rotation;scene.add(g);obstacles.push({x,z,w:11,d:7});return g;
}
function airstrip(x,z){
  const y=flatLevel(x,z);
  // Área pavimentada ampla e sem estradas de terra atravessando o pátio.
  box(x,y+.62,z,330,.24,440,0xb9b5aa);
  // Pista principal ampliada, com cabeceiras e marcações de pouso mais fortes.
  box(x,y+.80,z,132,.18,390,0x62686a);
  box(x,y+.905,z-183,124,.035,18,0xeee9dc);
  box(x,y+.905,z+183,124,.035,18,0xeee9dc);
  for(const side of [-1,1]){
    box(x+side*62,y+.915,z,2.2,.08,350,0xf5f0e5);
    for(let i=0;i<10;i++) box(x+side*52,y+.55,z-160+i*35,8,.08,17,0xf5f0e5);
    // Grandes marcas de cabeceira estilo aeroporto.
    for(let i=0;i<8;i++) box(x+side*(12+i*5.5),y+.925,z-169,2.8,.08,19,0xf5f0e5);
    for(let i=0;i<8;i++) box(x+side*(12+i*5.5),y+.925,z+169,2.8,.08,19,0xf5f0e5);
  }
  box(x,y+.925,z,2.1,.08,316,0xf6f0e4);
  for(let i=0;i<16;i++) box(x,y+.93,z-145+i*19,2.2,.08,9,0xf6f0e4);
  // Taxiway lateral curvada por segmentos e pátio para aeronaves/serviços.
  box(x-112,y+.80,z+18,92,.16,252,0x777b7a);
  box(x-112,y+.905,z+18,1.1,.08,230,0xf0e9d9);
  box(x-112,y+.905,z+18,70,.08,1.1,0xf0e9d9);
  box(x-112,y+.905,z-90,70,.08,1.1,0xf0e9d9);
  // Pátio de estacionamento, linhas de posições e áreas de segurança.
  box(x-118,y+.80,z+56,112,.16,145,0x858785);
  for(let i=0;i<6;i++){
    const px=x-157+i*15;
    box(px,y+.915,z+18,1,.08,66,0xf1ecdf);
    box(px,y+.915,z+51,14,.08,1,0xf1ecdf);
    box(px,y+.915,z+84,14,.08,1,0xf1ecdf);
  }
  // Hangar de manutenção e terminal de serviço, com portas grandes e cobertura azul.
  box(x-177,y+13,z-66,48,26,56,0xd9d4c7);
  box(x-177,y+26.5,z-66,51,2,59,0x708b9d);
  box(x-177,y+9,z-37,30,17,.7,0x858e92);
  for(let i=0;i<4;i++) box(x-189+i*8,y+9,z-36.5,1,.25,.8,0xded9ce);
  box(x-42,y+7,z-98,42,14,28,0xe3ded2);
  box(x-42,y+14.5,z-98,44,1.3,30,0x7894a7);
  for(let i=0;i<5;i++) box(x-57+i*7,y+7,z-83.6,.8,8,.3,0x6e8d9d);
  // Torre alta de controle no lado oposto à área de serviço.
  airportControlTower(x+116,z+116,y);
  // Aeronave cargueira: fuselagem, nariz, cockpit, faixa de pintura, asas e motores.
  const plane=new THREE.Group();
  const fuselage=new THREE.Mesh(new THREE.CapsuleGeometry(4.2,43,8,18),mat(0xf0eee7));fuselage.rotation.z=Math.PI/2;plane.add(fuselage);
  const belly=new THREE.Mesh(new THREE.CylinderGeometry(3.7,3.7,46,16),mat(0xc9d0d2));belly.rotation.z=Math.PI/2;belly.position.y=-.7;plane.add(belly);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(4.1,18,14),mat(0xf0eee7));nose.scale.set(1.35,.9,.9);nose.position.x=-24;plane.add(nose);
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(2.8,16,12),mat(0x315b75));cockpit.scale.set(1.3,.68,1.2);cockpit.position.set(-23,2.2,0);plane.add(cockpit);
  // Faixas de companhia nos dois lados do avião.
  for(const side of [-1,1]){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(37,.48,.12),mat(0x3b78a2));stripe.position.set(-1,.25,side*4.04);plane.add(stripe);
    const lowerStripe=new THREE.Mesh(new THREE.BoxGeometry(28,.22,.13),mat(0xd35d45));lowerStripe.position.set(3,-.55,side*3.96);plane.add(lowerStripe);
    for(let i=0;i<8;i++){const win=new THREE.Mesh(new THREE.BoxGeometry(1.15,.55,.16),mat(0x426b83));win.position.set(-17+i*4.2,2.25,side*4.03);plane.add(win);}
  }
  // Asas com planta trapezoidal e pontas afiladas, evitando o aspecto de bloco quadrado.
  function taperedWing(span,rootChord,tipChord,sweep,thickness,color){
    const shape=new THREE.Shape();shape.moveTo(-rootChord*.52,-span*.5);shape.lineTo(rootChord*.48,-span*.5);shape.lineTo(sweep+tipChord*.5,span*.5);shape.lineTo(sweep-tipChord*.5,span*.5);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.12,bevelThickness:.08});
    geo.rotateX(-Math.PI/2);geo.translate(0,thickness*.5,0);
    const mesh=new THREE.Mesh(geo,mat(color));plane.add(mesh);return mesh;
  }
  taperedWing(55,25,9,5,.72,0x6c89a8).position.set(-2,.05,0);
  taperedWing(53,24,8,5,.14,0x9eafbb).position.set(-2,.57,0);
  taperedWing(22,10,4,2,.5,0x557c9e).position.set(19,4.1,0);
  const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.lineTo(8,0);finShape.lineTo(5,10);finShape.lineTo(3,10.5);finShape.closePath();
  const fin=new THREE.Mesh(new THREE.ExtrudeGeometry(finShape,{depth:1.5,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.15,bevelThickness:.12}),mat(0x557c9e));fin.position.set(17,2.5,-.75);plane.add(fin);
  for(const ex of [-10,7]) for(const ez of [-15,15]){
    const nacelle=new THREE.Mesh(new THREE.CylinderGeometry(1.9,2.1,7.5,16),mat(0x7b858d));nacelle.rotation.z=Math.PI/2;nacelle.position.set(ex,-1.15,ez);plane.add(nacelle);
    const intake=new THREE.Mesh(new THREE.CircleGeometry(1.4,16),mat(0x303c46));intake.position.set(ex-3.8,-1.15,ez);intake.rotation.y=-Math.PI/2;plane.add(intake);
    const rear=new THREE.Mesh(new THREE.CircleGeometry(1.15,14),mat(0x515c64));rear.position.set(ex+3.8,-1.15,ez);rear.rotation.y=Math.PI/2;plane.add(rear);
  }
  for(const gx of [-16,1,17]) for(const gz of (gx===17?[0]:[-7,7])){
    const strut=new THREE.Mesh(new THREE.BoxGeometry(.6,3.6,.6),mat(0x626a71));strut.position.set(gx,-3.7,gz);plane.add(strut);
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,.9,14),inkMat);wheel.rotation.z=Math.PI/2;wheel.position.set(gx,-5.55,gz);plane.add(wheel);
  }
  plane.position.set(x+6,y+7,z+48);plane.rotation.y=Math.PI/2;scene.add(plane);
  // Aeronave decorativa: não cria uma caixa de colisão invisível que bloqueie o centro.
  // Rebocadores, caminhão de serviço, carrinhos e caixas formam coberturas úteis na guerra.
  airportTug(x-157,z+22,y,0,0xe0b64f);
  airportTug(x-126,z+53,y,Math.PI/2,0xd75b43);
  airportTug(x-88,z+86,y,0,0x4e8b6e);
  airportServiceTruck(x-161,z+104,y,Math.PI/2,0xd9dfdf);
  airportServiceTruck(x-70,z-28,y,Math.PI/2,0xc9cfd2);
  for(const [dx,dz,w,h,d,c] of [[-192,8,12,6,9,0x9d815e],[-185,24,12,6,9,0x6588a2],[-99,112,10,5,8,0x8e9a83],[-77,105,10,5,8,0xb8a078],[-133,-18,8,4,8,0x9b8260],[8,115,9,5,8,0xa18b69],[26,119,9,5,8,0x748a95]]) crate(x+dx,z+dz,w,h,d,c);
  // Barricadas baixas e paletes junto ao hangar e ao pátio.
  for(let i=0;i<5;i++){const bx=x-203+(i%3)*13,bz=z-7+Math.floor(i/3)*13;box(bx,y+2.1,bz,9,4.2,5,i%2?0x8b795f:0x747c7d);obstacles.push({x:bx,z:bz,w:10,d:6});}
}

// Área reservada do aeroporto: manter pista e pátio livres de vegetação e pedras.
function insideAirportClearance(x,z,pad=0){return Math.abs(x)<190+pad && Math.abs(z)<238+pad;}

// 5 setores temáticos para referência visual no mapa.
oilField(-500,-300);
cargoYard(500,-300);
scrapYard(-500,360);
powerStation(500,360);
airstrip(0,0);
for(let i=0;i<70;i++){const x=((i*181+89)%1010)-505,z=((i*233+91)%1020)-510;if(bases.some(b=>Math.hypot(x-b.x,z-b.z)<115)||Math.hypot(x,z)<85||insideAirportClearance(x,z,8)) continue; const y=height(x,z),r=3+i%5; const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),mat(i%3?0xd2c8b3:0xbeb6a6)); rock.position.set(x,y+r*.32,z); rock.scale.y=1.2+(i%4)*.32; scene.add(rock);} 
// Água removida temporariamente para permitir realocação planejada do rio.
// Árvores maiores, com copas arredondadas e irregulares em vez de cones pontudos.
const canopyMats=[mat(0x557f45),mat(0x668e4c),mat(0x759955),mat(0x4f7541)];
for(let i=0;i<340;i++){
  const x=((i*97+23)%1140)-570,z=((i*317+7)%1140)-570;
  const nearBase=bases.some(b=>Math.hypot(x-b.x,z-b.z)<96);
  if(nearBase||Math.hypot(x,z)<78||insideAirportClearance(x,z,12)) continue;
  const h=height(x,z); if(h>130) continue;
  const tall=10+(i%5)*2.5, crownW=6.3+(i%4)*1.15;
  cylinder(x,h+tall*.26,z,1.25+(i%3)*.18,tall*.55,0x8a745d,7);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),canopyMats[i%canopyMats.length]);
  crown.position.set(x,h+tall*.72,z); crown.scale.set(crownW,tall*.52,crownW*(.86+(i%3)*.08)); crown.rotation.y=(i*.83)%Math.PI; scene.add(crown);
  // Uma copa menor integrada à principal dá volume de árvore, sem dezenas de objetos extras.
  if(i%3!==0){const upper=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),canopyMats[(i+1)%canopyMats.length]);upper.position.set(x+(i%2?1.5:-1.5),h+tall*.91,z+(i%4-1.5));upper.scale.set(crownW*.62,tall*.34,crownW*.58);scene.add(upper);}
}
// Touceiras de folhas afiladas e curvas; geometria triangular leve, sem os antigos blocos retangulares.
const grassMats=[mat(0x668b49),mat(0x789b54),mat(0x527b40),mat(0x8b9d59)];
for(let i=0;i<180;i++){
  const x=((i*131+57)%1120)-560,z=((i*281+39)%1120)-560;
  if(bases.some(b=>Math.hypot(x-b.x,z-b.z)<98)||Math.hypot(x,z)<72||insideAirportClearance(x,z,12)) continue;
  const y=groundSurface(x,z); if(y>110) continue;
  const positions=[];
  for(let j=0;j<4;j++){
    const a=j*Math.PI*.5+(i%7)*.13, lean=.45+(j%2)*.3, ht=1.6+(i%4)*.38;
    const bx=Math.cos(a)*.12,bz=Math.sin(a)*.12,tx=Math.cos(a)*lean,tz=Math.sin(a)*lean;
    const wx=Math.cos(a+Math.PI/2)*.20,wz=Math.sin(a+Math.PI/2)*.20;
    positions.push(bx-wx,0,bz-wz, bx+wx,0,bz+wz, tx,ht,tz);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  const tuft=new THREE.Mesh(g,grassMats[i%grassMats.length]);tuft.material.side=THREE.DoubleSide;tuft.position.set(x,y+.12,z);tuft.rotation.y=(i*.61)%Math.PI;scene.add(tuft);
}

const player={pos:new THREE.Vector3(),yaw:0,pitch:0,team:0,vehicle:null};
let orbitYaw=0,orbitPitch=.2;
scene.add(camera);
const weapon=new THREE.Group(); camera.add(weapon);
const gunMetal=mat(0x263b50),gunGrip=mat(0x534c46),gunAccent=mat(0xb73e40),gunPaper=mat(0xf0eadf),hand=mat(0xe0bd94);
function gunPart(w,h,d,x,y,z,m,parent=weapon){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
gunPart(.38,.25,.74,.44,-.43,-.48,gunPaper); gunPart(.52,.32,1.18,.40,-.30,-1.02,gunPaper); gunPart(.24,.08,.90,.40,-.10,-1.08,gunMetal);
let barrel=new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,1.72,8),gunMetal); barrel.rotation.x=Math.PI/2; barrel.position.set(.40,-.25,-2.16); weapon.add(barrel);
let muzzle=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.14,8),gunPaper); muzzle.rotation.x=Math.PI/2; muzzle.position.set(.40,-.25,-3); weapon.add(muzzle);
gunPart(.23,.62,.30,.36,-.68,-.76,gunGrip); gunPart(.07,.19,.08,.40,.12,-1.05,gunAccent); gunPart(.28,.4,.24,.40,-.59,-1.18,gunMetal); gunPart(.28,.22,.4,.42,-.53,-1.35,hand); weapon.position.set(0,0,0);
const blockers=()=>obstacles; function blocked(x,z,r=1.2){return blockers().some(o=>Math.abs(x-o.x)<o.w/2+r&&Math.abs(z-o.z)<o.d/2+r);}
const weaponDefs={rifle:{name:'FUZIL',mag:30,stock:150,delay:115,reload:1250,spread:.009},smg:{name:'SMG',mag:36,stock:180,delay:75,reload:1150,spread:.02},shotgun:{name:'ESCOPETA',mag:6,stock:42,delay:650,reload:1550,spread:.10,pellets:8},sniper:{name:'SNIPER',mag:6,stock:36,delay:950,reload:1700,spread:.001},launcher:{name:'LANÇA-FOGUETES',mag:1,stock:10,delay:1300,reload:1900,spread:.004},knife:{name:'FACA',mag:0,stock:0,delay:470,reload:0,spread:0}};
const ammunition={}; for(const [key,def] of Object.entries(weaponDefs)) ammunition[key]={ammo:def.mag,reserve:def.stock};
let weaponMode='rifle',reloadUntil=0,shootHeld=false,shootAt=0,kick=0,aiming=false;
const weaponHud=document.getElementById('weaponHud'),fireButton=document.getElementById('fire'),reloadButton=document.getElementById('reload');
function displayAmmo(){const d=weaponDefs[weaponMode],a=ammunition[weaponMode]; weaponHud.textContent=weaponMode==='knife'?'FACA':`${d.name}  •  ${a.ammo} / ${a.reserve}`;}
function switchWeapon(mode){if(!weaponDefs[mode]||player.vehicle) return; weaponMode=mode; reloadUntil=0; displayAmmo(); showNotice(weaponDefs[mode].name);} 
function shoot(){const now=performance.now(),d=weaponDefs[weaponMode],a=ammunition[weaponMode];if(player.vehicle||now<shootAt||now<reloadUntil) return; if(weaponMode!=='knife'&&a.ammo<=0){reload();return;} shootAt=now+d.delay; if(weaponMode!=='knife') a.ammo--; kick=weaponMode==='launcher'?.27:.10; displayAmmo(); const origin=camera.position.clone(),forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion),count=d.pellets||1; for(let i=0;i<count;i++){const direction=forward.clone(); if(d.spread){direction.x+=(Math.random()-.5)*d.spread;direction.y+=(Math.random()-.5)*d.spread;direction.normalize();} const range=weaponMode==='knife'?3:weaponMode==='shotgun'?75:250; const ray=new THREE.Raycaster(origin,direction,.1,range); const impact=ray.intersectObjects(scene.children,true).find(hit=>hit.object!==terrainMesh&& !weapon.children.includes(hit.object)); const end=impact?impact.point:origin.clone().addScaledVector(direction,range); if(weaponMode==='knife') continue; const start=camera.localToWorld(new THREE.Vector3(.45,-.33,-1.20)); const trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints([start,end]),new THREE.LineBasicMaterial({color:weaponMode==='launcher'?0xff6743:0xffb45c,transparent:true,opacity:.8})); scene.add(trace); setTimeout(()=>{scene.remove(trace);trace.geometry.dispose();trace.material.dispose();},weaponMode==='launcher'?240:75);} }
function reload(){if(player.vehicle||weaponMode==='knife') return; const d=weaponDefs[weaponMode],a=ammunition[weaponMode]; if(a.reserve<=0||a.ammo===d.mag||performance.now()<reloadUntil) return; const selected=weaponMode; reloadUntil=performance.now()+d.reload; showNotice('RECARREGANDO'); setTimeout(()=>{const n=Math.min(d.mag-a.ammo,a.reserve);a.ammo+=n;a.reserve-=n;if(weaponMode===selected) displayAmmo();},d.reload);} 
fireButton.addEventListener('pointerdown',e=>{e.preventDefault();fireButton.setPointerCapture(e.pointerId);shootHeld=true;shoot();}); for(const ev of ['pointerup','pointercancel','lostpointercapture']) fireButton.addEventListener(ev,()=>shootHeld=false); reloadButton.onclick=reload;

const keys={},stick={x:0,y:0};
let jumpVelocity=0,jumpHeight=0;
const clock=new THREE.Clock();
const info=document.getElementById('info'),notice=document.getElementById('notice');
const scoreEls=[document.getElementById('scoreBlue'),document.getElementById('scoreRed'),document.getElementById('scoreGreen')];
const timerEl=document.getElementById('matchTimer'),phaseEl=document.getElementById('phaseLabel'),objectiveEl=document.getElementById('objectiveLabel');
function showNotice(t,duration=2300){notice.textContent=t;notice.style.display='block';clearTimeout(showNotice.timer);showNotice.timer=setTimeout(()=>notice.style.display='none',duration);}

const objectiveDefs=[
  {key:'A',name:'DEPÓSITO NORTE',x:-325,z:-220,color:0x63b0ea},
  {key:'B',name:'VALE INDUSTRIAL',x:290,z:-250,color:0xf1b15a},
  {key:'C',name:'VILA RIBEIRINHA',x:0,z:365,color:0x74c37d}
];
const objectivePhases=[
  {duration:300,active:[0],prime:0,label:'CONFRONTO INICIAL'},
  {duration:300,active:[1,2],prime:1,label:'DUPLA DISPUTA'},
  {duration:300,active:[0,2],prime:2,label:'DUPLA DISPUTA'},
  {duration:300,active:[0,1],prime:0,label:'DUPLA DISPUTA'}
];
const match={duration:1200,scores:[0,0,0],phaseIndex:-1,warningPhase:-1,ended:false};
const objectiveRuntime=objectiveDefs.map(()=>({capture:0,hold:0,mode:''}));
function ring(inner,outer,color,opacity=.68){const mesh=new THREE.Mesh(new THREE.RingGeometry(inner,outer,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;return mesh;}
const objectiveVisuals=objectiveDefs.map(obj=>{const group=new THREE.Group();const outer=ring(31,35,obj.color,.55),inner=ring(11,14,0xffffff,.8),beacon=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,2.2,16),mat(obj.color)),mast=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,10,8),mat(0xf7f4e8)),topper=new THREE.Mesh(new THREE.SphereGeometry(1.2,10,8),mat(obj.color)); beacon.position.y=1.15; mast.position.y=6; topper.position.y=11.7; group.add(outer,inner,beacon,mast,topper); scene.add(group); return {group,outer,inner,beacon,topper,obj};});
function formatTime(total){const m=Math.max(0,Math.floor(total/60)),s=Math.max(0,Math.floor(total%60)); return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function phaseState(elapsed){let acc=0; for(let i=0;i<objectivePhases.length;i++){const ph=objectivePhases[i]; if(elapsed<acc+ph.duration) return {index:i,phase:ph,timeLeft:acc+ph.duration-elapsed}; acc+=ph.duration;} const last=objectivePhases.at(-1); return {index:objectivePhases.length-1,phase:last,timeLeft:0};}
function objectiveContains(obj,x,z){const d=Math.hypot(x-obj.x,z-obj.z); return {outer:d<=35,inner:d<=14};}
function updateScoreHud(state){for(let i=0;i<3;i++){scoreEls[i].textContent=`${TEAM_NAMES[i]} ${match.scores[i]}`;scoreEls[i].style.outline=i===player.team?'2px solid #172a42':'none';scoreEls[i].style.opacity=i===player.team?'1':'.92';} timerEl.textContent=formatTime(Math.max(0,match.duration-state.elapsed)); phaseEl.textContent=`${state.phase.label} • ${Math.ceil(state.timeLeft)}s`;}
function refreshObjectiveVisuals(state,elapsed){const active=new Set(state.phase.active); for(let i=0;i<objectiveVisuals.length;i++){const v=objectiveVisuals[i],activeNow=active.has(i),prime=state.phase.prime===i&&activeNow; v.group.position.set(v.obj.x,groundSurface(v.obj.x,v.obj.z)+.6,v.obj.z); v.group.rotation.y=elapsed*.4+i; v.outer.visible=activeNow; v.beacon.visible=activeNow; v.topper.visible=activeNow; v.inner.visible=prime; const pulse=1+.08*Math.sin(elapsed*3+i*1.7); v.outer.scale.setScalar(activeNow?pulse:1); v.inner.scale.setScalar(prime?1+.12*Math.sin(elapsed*4+i):1);} }
function endMatch(){if(match.ended) return; match.ended=true; const best=Math.max(...match.scores),winners=match.scores.map((v,i)=>v===best?TEAM_NAMES[i]:null).filter(Boolean).join(' / '); showNotice(`FIM DA PARTIDA • VENCEDOR: ${winners}`,6000);} 
function updateObjectives(dt,elapsed){
  const state=phaseState(elapsed); state.elapsed=elapsed; refreshObjectiveVisuals(state,elapsed);
  if(match.phaseIndex!==state.index){match.phaseIndex=state.index;match.warningPhase=-1; objectiveRuntime.forEach(r=>{r.capture=0;r.hold=0;r.mode='';}); const names=state.phase.active.map(i=>objectiveDefs[i].key).join(' + '); showNotice(`NOVO OBJETIVO: ${names}`,3200);} 
  if(state.timeLeft<=20&&match.warningPhase!==state.index&&!match.ended){match.warningPhase=state.index; showNotice(state.phase.active.length>1?'OBJETIVOS ATUAIS ENCERRAM EM 20s':'OBJETIVO ATUAL ENCERRA EM 20s',2400);} 
  let currentText='SEM CONTROLE'; const activeSet=new Set(state.phase.active);
  for(let i=0;i<objectiveDefs.length;i++){
    const runtime=objectiveRuntime[i],obj=objectiveDefs[i],active=activeSet.has(i),prime=state.phase.prime===i&&active;
    let mode='';
    if(active){const inside=objectiveContains(obj,player.pos.x,player.pos.z); if(prime&&inside.inner) mode='inner'; else if(inside.outer) mode='outer';}
    if(mode){
      if(runtime.mode!==mode){runtime.mode=mode;runtime.capture=0;runtime.hold=0;}
      runtime.capture=Math.min(5,runtime.capture+dt);
      if(runtime.capture>=5){
        runtime.hold+=dt;
        currentText=(prime&&mode==='inner')?`${obj.key} NÚCLEO • +2 / 5s`:`${obj.key} CÍRCULO • +1 / 5s`;
        while(runtime.hold>=5){runtime.hold-=5; match.scores[player.team]+=prime&&mode==='inner'?2:1;}
      }else currentText=`CAPTURANDO ${obj.key} • ${Math.ceil(5-runtime.capture)}s`;
    }else{runtime.capture=Math.max(0,runtime.capture-dt*1.3); if(runtime.capture<=0.05){runtime.capture=0; runtime.mode=''; runtime.hold=0;}}
  }
  objectiveEl.textContent=currentText; updateScoreHud(state); if(elapsed>=match.duration) endMatch();
}

function spawn(){player.vehicle=null;jumpHeight=0;jumpVelocity=0;updateModeControls();const b=bases[player.team],d=new THREE.Vector2(-b.x,-b.z).normalize();player.pos.set(b.x+d.x*18,height(b.x+d.x*18,b.z+d.y*18)+2,b.z+d.y*18);player.yaw=Math.atan2(-d.x,-d.y);player.pitch=0;showNotice(`TIME ${TEAM_NAMES[player.team]} • BASE PROTEGIDA`);} 
function enter(){if(player.vehicle){const p=player.vehicle.group.position;if(player.vehicle.type==='heli'&&p.y>height(p.x,p.z)+7){showNotice('DESÇA E POUSE ANTES DE SAIR');return;}let ex=p.x+8,ez=p.z+8;if(blocked(ex,ez)){ex=p.x-8;ez=p.z-8;}player.pos.set(ex,driveHeight(ex,ez,null,height(ex,ez)+2)+2,ez);player.vehicle=null;updateModeControls();return;} let nearest=null,dist=13; for(const v of [...helis,...cars]){const d=player.pos.distanceTo(v.group.position); if(d<dist){dist=d;nearest=v;}} if(nearest){player.vehicle=nearest; player.yaw=nearest.yaw; orbitYaw=0; orbitPitch=.2; updateModeControls(); showNotice(nearest.type==='heli'?'HELICÓPTERO • CONTROLE EM TERCEIRA PESSOA':'PICKUP • CONTROLE EM TERCEIRA PESSOA');} else showNotice('APROXIME-SE DE UM VEÍCULO');}
const board=document.getElementById('board'); board.addEventListener('click',enter); const action=document.getElementById('action'),verticalControls=document.getElementById('verticalControls'),yawControls=document.getElementById('yawControls');
function updateModeControls(){const v=player.vehicle; weapon.visible=!v; fireButton.style.display=v?'none':'block'; reloadButton.style.display=v?'none':'block'; weaponHud.style.display=v?'none':'block'; verticalControls.style.display=v?.type==='heli'?'flex':'none'; yawControls.style.display=v?.type==='heli'?'flex':'none'; action.textContent=v?'SAIR':'PULAR'; document.getElementById('modeHint').textContent=v?.type==='heli'?'Analógico: voar • ↶ ↷ girar no próprio eixo • ▲ subir / ▼ descer':v?'Analógico: dirigir • arraste a tela para olhar • SAIR para desembarcar':'Analógico: mover • arraste a tela para olhar';}
action.addEventListener('click',()=>{if(player.vehicle){enter();return;} if(jumpHeight<=.02) jumpVelocity=10.8;});
const stickEl=document.getElementById('stick'),nub=document.getElementById('nub'); let stickId=null;
function updateStick(e){const r=stickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2; let dx=e.clientX-cx,dy=e.clientY-cy; const limit=(r.width-60)/2,magnitude=Math.hypot(dx,dy); if(magnitude>limit){dx=dx/magnitude*limit;dy=dy/magnitude*limit;} stick.x=dx/limit; stick.y=-dy/limit; nub.style.transform=`translate(${dx}px, ${dy}px)`;}
function releaseStick(e){if(e&&stickId!==e.pointerId) return; stickId=null; stick.x=0; stick.y=0; nub.style.transform='translate(0,0)';}
stickEl.addEventListener('pointerdown',e=>{e.preventDefault();if(stickId!==null)return;stickId=e.pointerId;stickEl.setPointerCapture(e.pointerId);updateStick(e);}); stickEl.addEventListener('pointermove',e=>{if(e.pointerId===stickId) updateStick(e);}); for(const ev of ['pointerup','pointercancel','lostpointercapture']) stickEl.addEventListener(ev,releaseStick);
document.getElementById('reset').onclick=spawn; document.getElementById('team').onclick=()=>{player.team=(player.team+1)%3; spawn();};
for(const el of document.querySelectorAll('[data-k]')){const k=el.dataset.k.toLowerCase(); el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);keys[k]=true;}); for(const ev of ['pointerup','pointercancel','lostpointercapture']) el.addEventListener(ev,()=>keys[k]=false);} 
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true; if([' ','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault(); if(e.key.toLowerCase()==='f'&&!e.repeat) enter(); if(e.key.toLowerCase()==='r'&&!e.repeat) reload(); if(/^[1-6]$/.test(e.key)&&!e.repeat) switchWeapon(Object.keys(weaponDefs)[Number(e.key)-1]); if(e.key.toLowerCase()==='v'&&!e.repeat) switchWeapon(Object.keys(weaponDefs)[(Object.keys(weaponDefs).indexOf(weaponMode)+1)%6]); if(e.key===' '&&!e.repeat&&!player.vehicle&&jumpHeight<=.02) jumpVelocity=10.8;});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===2) aiming=true;}); renderer.domElement.addEventListener('pointerup',e=>{if(e.button===2) aiming=false;}); document.getElementById('changeWeapon').onclick=()=>switchWeapon(Object.keys(weaponDefs)[(Object.keys(weaponDefs).indexOf(weaponMode)+1)%6]);
let dragging=false,lookId=null,px=0,py=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(lookId!==null) return; lookId=e.pointerId; dragging=true; px=e.clientX; py=e.clientY; renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointerup',e=>{if(e.pointerId===lookId){dragging=false;lookId=null;}}); renderer.domElement.addEventListener('pointercancel',()=>{dragging=false;lookId=null;});
renderer.domElement.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==lookId) return; const dx=e.clientX-px,dy=e.clientY-py; px=e.clientX; py=e.clientY; if(player.vehicle){orbitYaw-=dx*.005; orbitPitch=THREE.MathUtils.clamp(orbitPitch+dy*.004,-.35,.85);} else{player.yaw-=dx*.004; player.pitch=THREE.MathUtils.clamp(player.pitch-dy*.003,-.85,.85);}});


// Áudio procedural de motor: não depende de arquivos externos e funciona offline.
// Os osciladores são criados uma única vez por sessão e modulados conforme o veículo.
let engineAudio=null;
function initEngineAudio(){
  if(engineAudio){ if(engineAudio.ctx.state==='suspended') engineAudio.ctx.resume().catch(()=>{}); return engineAudio; }
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return null;
  try{
    const ctx=new AC();
    const master=ctx.createGain(); master.gain.value=.42; master.connect(ctx.destination);
    const makeEngine=(type)=>{
      const bus=ctx.createGain(); bus.gain.value=0; bus.connect(master);
      const filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=type==='heli'?1400:700; filter.Q.value=.65; filter.connect(bus);
      const osc1=ctx.createOscillator(), osc2=ctx.createOscillator(), sub=ctx.createOscillator();
      osc1.type='sawtooth'; osc2.type='triangle'; sub.type='sawtooth';
      const g1=ctx.createGain(),g2=ctx.createGain(),g3=ctx.createGain();
      g1.gain.value=type==='heli'?.24:.20; g2.gain.value=type==='heli'?.30:.10; g3.gain.value=type==='heli'?.12:.14;
      osc1.connect(g1);osc2.connect(g2);sub.connect(g3);g1.connect(filter);g2.connect(filter);g3.connect(filter);
      osc1.start();osc2.start();sub.start();
      let lfo=null,bladeOsc=null,bladeGain=null,bladeLfo=null;
      if(type==='heli'){
        // Pulsos graves e regulares simulam as pás: tu-tu-tu-tu, não um motor de moto acelerando.
        bladeOsc=ctx.createOscillator();bladeOsc.type='triangle';bladeOsc.frequency.value=92;
        bladeGain=ctx.createGain();bladeGain.gain.value=.25;bladeOsc.connect(bladeGain);bladeGain.connect(filter);bladeOsc.start();
        bladeLfo=ctx.createOscillator();bladeLfo.type='square';bladeLfo.frequency.value=4.7;
        const bladeMod=ctx.createGain();bladeMod.gain.value=.12;bladeLfo.connect(bladeMod);bladeMod.connect(bladeGain.gain);bladeLfo.start();
        lfo=ctx.createOscillator();lfo.type='sine';lfo.frequency.value=4.7;
        const bodyPulse=ctx.createGain();bodyPulse.gain.value=.025;lfo.connect(bodyPulse);bodyPulse.connect(bus.gain);lfo.start();
      }
      return {type,bus,filter,osc1,osc2,sub,lfo,bladeOsc,bladeGain,bladeLfo};
    };
    engineAudio={ctx,master,car:makeEngine('car'),heli:makeEngine('heli')};
    return engineAudio;
  }catch(e){return null;}
}
function updateEngineAudio(vehicle,dt){
  if(!vehicle&&!engineAudio) return;
  const a=engineAudio||initEngineAudio(); if(!a) return;
  if(a.ctx.state==='suspended') a.ctx.resume().catch(()=>{});
  const now=a.ctx.currentTime;
  const active=vehicle;
  for(const e of [a.car,a.heli]){
    const isActive=!!active&&(e.type==='heli'?active.type==='heli':active.type==='jeep');
    const speed=isActive?Math.min(1,Math.abs(active.speed||0)/(e.type==='heli'?75:38)):0;
    const vertical=isActive&&e.type==='heli'?Math.min(1,Math.max(0,active.vertical||0)/35):0;
    const idle=e.type==='heli'?.28:.075;
    // O helicóptero ganha mais volume e rotação quando sobe, sem soar como carro.
    const target=isActive?(e.type==='heli'?Math.min(.98,(idle+speed*.10+vertical*.30)*1.65*2.5):(idle+speed*.23)):0;
    e.bus.gain.setTargetAtTime(target,now,.12);
    const rpm=e.type==='heli'? (34+speed*8+vertical*5):(42+speed*92);
    e.osc1.frequency.setTargetAtTime(rpm,now,.10);
    e.osc2.frequency.setTargetAtTime(rpm*1.51,now,.10);
    e.sub.frequency.setTargetAtTime(rpm*.5,now,.12);
    e.filter.frequency.setTargetAtTime(e.type==='heli'?1400+speed*500+vertical*300:380+speed*1500,now,.15);
    if(e.type==='heli'&&e.bladeOsc) e.bladeOsc.frequency.setTargetAtTime(88+speed*8+vertical*4,now,.22);
  }
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,clock.getDelta());
  const elapsed=Math.min(match.duration,clock.elapsedTime);
  const f=THREE.MathUtils.clamp(Number(!!keys.w)-Number(!!keys.s)+stick.y,-1,1);
  const side=THREE.MathUtils.clamp(Number(!!keys.d)-Number(!!keys.a)+stick.x,-1,1);
  const v=player.vehicle;
  updateEngineAudio(v,dt);
  if(shootHeld) shoot();
  kick=Math.max(0,kick-dt*.8); weapon.rotation.x=kick;
  camera.fov=THREE.MathUtils.lerp(camera.fov,aiming&&!v?42:72,Math.min(1,dt*10)); camera.updateProjectionMatrix();
  updateObjectives(dt,elapsed);

  if(v){
    const turn=(Number(!!keys.e)-Number(!!keys.q));
    // No helicóptero, o lateral desloca a aeronave; Q/E faz a guinada.
    // Na pickup, mantém o comportamento de direção que já existia.
    const steerRaw=v.type==='heli'?turn:(turn-side);
    const steer=Math.abs(steerRaw)<.12?0:steerRaw; const thrust=Math.abs(f)<.08?0:f;
    v.yaw+=steer*dt*(v.type==='heli'?1.28:1.82);
    v.group.rotation.y=v.yaw-Math.PI/2;
    if(v.type==='heli'){
      v.targetSpeed=thrust*75; v.speed=THREE.MathUtils.lerp(v.speed,v.targetSpeed,Math.min(1,dt*2.2));
      v.targetVertical=(Number(!!keys[' '])-Number(!!keys.shift))*35; v.vertical=THREE.MathUtils.lerp(v.vertical,v.targetVertical,Math.min(1,dt*2.4));
      v.targetLateral=side*25;
      v.lateral=THREE.MathUtils.lerp(v.lateral||0,v.targetLateral,1-Math.exp(-dt*2.0));
      // Avanço/recuo e deslocamento lateral são independentes.
      v.group.position.x+=(-Math.sin(v.yaw)*v.speed+Math.cos(v.yaw)*v.lateral)*dt;
      v.group.position.z+=(-Math.cos(v.yaw)*v.speed-Math.sin(v.yaw)*v.lateral)*dt;
    }else{
      v.targetSpeed=f*38; v.speed=THREE.MathUtils.lerp(v.speed,v.targetSpeed,Math.min(1,dt*3.2));
      v.group.position.x+=-Math.sin(v.yaw)*v.speed*dt; v.group.position.z+=-Math.cos(v.yaw)*v.speed*dt;
    }
    v.group.position.x=THREE.MathUtils.clamp(v.group.position.x,-580,580); v.group.position.z=THREE.MathUtils.clamp(v.group.position.z,-580,580);
    if(v.type==='heli'){
      v.group.position.y+=v.vertical*dt;
      const heliGround=groundSurface(v.group.position.x,v.group.position.z);
      const heliSurface=driveHeight(v.group.position.x,v.group.position.z,v,v.group.position.y);
      const landingY=heliSurface>heliGround+2?heliSurface+3.45:heliGround+5;
      v.group.position.y=Math.max(landingY,Math.min(230,v.group.position.y));
      v.rotor.rotation.y+=dt*18; v.tailRotor.rotation.z+=dt*31;
      // Powerful visible tilt with gentle easing; pitching at forward/backward input,
      // banking on lateral control. Visual only, without aircraft rigid-body solver.
      const bank=THREE.MathUtils.clamp(-side*.68,-.68,.68);
      // O nariz estava levantando ao acelerar. Inverter o sinal faz o comando
      // para frente baixar o nariz; o controle lateral permanece independente.
      const pitch=THREE.MathUtils.clamp(thrust*.34-v.vertical/35*.025,-.36,.36);
      // O corpo aponta ao longo do eixo X local: roll em X, nariz para cima/baixo em Z.
      v.model.rotation.x=THREE.MathUtils.lerp(v.model.rotation.x,bank,1-Math.exp(-dt*3.6));
      v.model.rotation.z=THREE.MathUtils.lerp(v.model.rotation.z,pitch,1-Math.exp(-dt*3.4));
      v.model.rotation.y=THREE.MathUtils.lerp(v.model.rotation.y,0,1-Math.exp(-dt*4.0));
    }else{
      const xx=v.group.position.x,zz=v.group.position.z,ang=terrainAttitude(xx,zz,v.yaw);
      const fw=new THREE.Vector2(-Math.sin(v.yaw),-Math.cos(v.yaw)),rt=new THREE.Vector2(Math.cos(v.yaw),-Math.sin(v.yaw));
      const samples=[];for(const fx of [-2.1,2.1])for(const rz of [-1.65,1.65])samples.push(driveHeight(xx+fw.x*fx+rt.x*rz,zz+fw.y*fx+rt.y*rz,v,v.group.position.y));
      const avg=samples.reduce((a,b)=>a+b,0)/4;
      const frontAvg=(samples[2]+samples[3])*.5,rearAvg=(samples[0]+samples[1])*.5,leftAvg=(samples[0]+samples[2])*.5,rightAvg=(samples[1]+samples[3])*.5;
      const targetY=Math.max(avg+.35,Math.max(...samples)+.12);
      v.group.position.y=THREE.MathUtils.lerp(v.group.position.y,targetY,1-Math.exp(-dt*16));
      const pitch=THREE.MathUtils.clamp(Math.atan2(frontAvg-rearAvg,4.2),-.30,.30);
      const roll=THREE.MathUtils.clamp(Math.atan2(rightAvg-leftAvg,3.3),-.26,.26);
      v.model.rotation.x=THREE.MathUtils.lerp(v.model.rotation.x,roll,1-Math.exp(-dt*9));
      v.model.rotation.z=THREE.MathUtils.lerp(v.model.rotation.z,-pitch,1-Math.exp(-dt*9));
      v.model.rotation.y=THREE.MathUtils.lerp(v.model.rotation.y,steer*.03,1-Math.exp(-dt*6));
      // As rodas dianteiras apontam para o mesmo lado em que o carro está esterçando.
      const wheelSteer=THREE.MathUtils.clamp(steer*.48,-.48,.48);
      for(const pivot of v.frontWheelPivots) pivot.rotation.y=THREE.MathUtils.lerp(pivot.rotation.y,wheelSteer,1-Math.exp(-dt*10));
      for(const wheel of v.wheelGroups) wheel.rotation.y+=v.speed*dt/.84;
    }
    const orbitAngle=v.yaw+orbitYaw,dist=v.type==='heli'?25:15;
    const offset=new THREE.Vector3(Math.sin(orbitAngle)*dist,dist*(.45+orbitPitch),Math.cos(orbitAngle)*dist);
    const desired=v.group.position.clone().add(offset); desired.y=Math.max(desired.y,height(desired.x,desired.z)+3);
    camera.position.lerp(desired,Math.min(1,dt*5)); camera.lookAt(v.group.position.x,v.group.position.y+3,v.group.position.z);
    player.pos.copy(v.group.position);
  }else{
    const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw),s=dt*19;
    const nextX=player.pos.x+(-sin*f+cos*side)*s,nextZ=player.pos.z+(-cos*f-sin*side)*s;
    if(!blocked(nextX,player.pos.z)) player.pos.x=nextX;
    if(!blocked(player.pos.x,nextZ)) player.pos.z=nextZ;
    player.pos.x=THREE.MathUtils.clamp(player.pos.x,-580,580); player.pos.z=THREE.MathUtils.clamp(player.pos.z,-580,580);
    const footEntity={type:'foot'};
    const surface=driveHeight(player.pos.x,player.pos.z,footEntity,player.pos.y);
    let feetY=player.pos.y-2;
    if(feetY>surface+.04){
      jumpVelocity-=26*dt;
      feetY+=jumpVelocity*dt;
      if(feetY<=surface){feetY=surface;jumpVelocity=0;}
    }else{
      feetY=surface;
      if(jumpVelocity<0) jumpVelocity=0;
    }
    jumpHeight=Math.max(0,feetY-surface);
    player.pos.y=feetY+2;

    camera.position.copy(player.pos); camera.rotation.order='YXZ'; camera.rotation.y=player.yaw; camera.rotation.x=player.pitch;
  }

  board.style.display=(!v&&[...helis,...cars].some(vehicle=>player.pos.distanceTo(vehicle.group.position)<13))?'block':'none';
  info.textContent=`${TEAM_NAMES[player.team]} · ${v?(v.type==='heli'?'HELI':'PICKUP'):'INFANTARIA'}`;
  document.getElementById('cross').style.display=v?'none':'block';
  renderer.render(scene,camera);
}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
displayAmmo(); spawn(); animate();
