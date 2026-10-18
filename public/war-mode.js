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

const villages=[[-325,-220,53],[290,-250,53],[0,365,53],[-360,85,53],[365,55,53],[10,-340,53],[40,195,53]];
function terrainRaw(x,z){
  const d=Math.hypot(x,z);
  let h=8+11*Math.sin(x*.011)*Math.cos(z*.012)+6*Math.sin((x+z)*.029);
  h+=58*Math.pow(Math.max(0,(d-260)/340),1.7);
  for(let i=0;i<7;i++){
    const a=i*Math.PI*2/7+.35,px=460*Math.cos(a),pz=460*Math.sin(a);
    h+=43*Math.exp(-((x-px)**2+(z-pz)**2)/22000);
  }
  // Riverbed gouged into the terrain: a shallow bed and wider natural banks.
  const riverX=-90+22*Math.sin(z*.013),riverDist=Math.abs(x-riverX);
  h-=7*(1-THREE.MathUtils.smoothstep(riverDist,9,34));
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
  for(const [vx,vz,r] of villages){const d=Math.hypot(x-vx,z-vz);
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
function road(a,b,w=11){
  const v=[],idx=[],S=120,dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),nx=-dz/L,nz=dx/L;
  for(let i=0;i<=S;i++){
    const t=i/S,x=a.x+dx*t,z=a.z+dz*t;
    for(const side of [-1,1]){const xx=x+nx*side*w*.5,zz=z+nz*side*w*.5;v.push(xx,height(xx,zz)+.32,zz);}
    if(i<S){const j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0x8f6843,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));
  scene.add(m);return m;
}

for(let i=0;i<3;i++){
  const b=bases[i];
  road(b,{x:0,z:0},15);
  road(b,bases[(i+1)%3],12);
  const dir=new THREE.Vector2(-b.x,-b.z).normalize();
  const p={x:b.x+dir.x*180,z:b.z+dir.y*180};
  road(b,p,11); road(p,{x:0,z:0},10);
}

const bridges=[];
function bridge(z,centerX=-90,length=108,width=16){
  const x1=centerX-length/2,x2=centerX+length/2,ramp=30;
  // Deck has smooth access ramps and follows road axis; no hovering horizontal box.
  const leftY=height(x1-ramp,z)+.45,rightY=height(x2+ramp,z)+.45;
  const deckY=Math.max(height(x1,z),height(x2,z),height(centerX,z)+8,leftY,rightY)+.7;
  const segments=32,vertices=[],idx=[];
  function elevation(x){if(x<x1){const t=THREE.MathUtils.smoothstep(x,x1-ramp,x1);return THREE.MathUtils.lerp(leftY,deckY,t);}if(x>x2){const t=THREE.MathUtils.smoothstep(x,x2,x2+ramp);return THREE.MathUtils.lerp(deckY,rightY,t);}return deckY;}
  for(let i=0;i<=segments;i++){const x=x1-ramp+(length+2*ramp)*i/segments,y=elevation(x);
    vertices.push(x,y,z-width/2,x,y,z+width/2);
    if(i<segments){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(idx);g.computeVertexNormals();
  const deck=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0xae8861,side:THREE.DoubleSide}));scene.add(deck);
  // Low rails only on the central span, away from vehicle contact area.
  for(const dz of [-width/2,width/2]){const rail=box(centerX,deckY+.75,z+dz,length,1.4,.5,0x806d53);}
  bridges.push({x1:x1-ramp,x2:x2+ramp,z,width,deckY,elevation});
}
for(const z of [-320,-130,120,320]) bridge(z);

const groundRay=new THREE.Raycaster();
function groundSurface(x,z){groundRay.set(new THREE.Vector3(x,600,z),new THREE.Vector3(0,-1,0));const hit=groundRay.intersectObject(terrainMesh,false)[0];return hit?hit.point.y:height(x,z);}
function driveHeight(x,z){let y=groundSurface(x,z);for(const b of bridges) if(x>=b.x1&&x<=b.x2&&Math.abs(z-b.z)<b.width/2) y=Math.max(y,b.elevation(x));return y;}

const tower=(x,z,c=ink)=>{const y=height(x,z);box(x,y+13,z,5,26,5,c);box(x,y+28,z,12,5,12,0xfaf5e8);box(x,y+32,z,1,8,1,c);};
const obstacles=[];
function building(x,z,c,w=18,d=15){const y=Math.max(height(x-w/2,z-d/2),height(x+w/2,z-d/2),height(x-w/2,z+d/2),height(x+w/2,z+d/2),height(x,z));box(x,y-1.2,z,w+.3,2.4,d+.3,0xb4aa94);box(x,y+5,z,w,10,d,0xf7f2e6);box(x,y+10.5,z,w+2,2,d+2,c);box(x,y+2,z+d/2+.15,5,4,.3,c);obstacles.push({x,z,w:w+2,d:d+2});}

const helis=[],cars=[];
function helicopter(x,z,color,yaw=0){
  const group=new THREE.Group(),paint=mat(color),glass=new THREE.MeshPhongMaterial({color:0x426f94,shininess:85,transparent:true,opacity:.83}),dark=mat(0x25394e);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(2.35,5.7,5,12),paint);body.rotation.z=Math.PI/2;body.position.x=-.8;group.add(body);
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.28,14,10),glass);canopy.scale.set(1.50,.91,.94);canopy.position.set(-3.25,.4,0);group.add(canopy);
  const chin=new THREE.Mesh(new THREE.BoxGeometry(2,.65,2.7),dark);chin.position.set(-4.25,-1.55,0);group.add(chin);
  const engine=new THREE.Mesh(new THREE.BoxGeometry(4.6,.9,3),dark);engine.position.set(.7,2.08,0);group.add(engine);
  for(const side of [-1,1]){const door=new THREE.Mesh(new THREE.BoxGeometry(3.2,2.35,.12),paint);door.position.set(-.05,-.15,side*2.21);group.add(door);const window=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.05,.15),glass);window.position.set(-.5,.55,side*2.3);group.add(window);}
  const boom=new THREE.Mesh(new THREE.CylinderGeometry(.40,1.08,11.8,8),paint);boom.rotation.z=Math.PI/2;boom.position.set(8,1,0);group.add(boom);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(1.4,3.6,.30),paint);fin.position.set(13.2,2.05,0);group.add(fin);
  const tailplane=new THREE.Mesh(new THREE.BoxGeometry(2.4,.23,5.2),dark);tailplane.position.set(11.2,1,0);group.add(tailplane);
  const tailRotor=new THREE.Group();tailRotor.position.set(13.45,2.35,.42);
  for(let n=0;n<4;n++){const pivot=new THREE.Group();pivot.rotation.z=n*Math.PI/2;const blade=new THREE.Mesh(new THREE.BoxGeometry(.35,2.8,.12),dark);blade.position.y=1.1;pivot.add(blade);tailRotor.add(pivot);} tailRotor.add(new THREE.Mesh(new THREE.SphereGeometry(.36,8,6),paint)); group.add(tailRotor);
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.35,.4,1.4,10),dark);mast.position.set(-.3,3,0);group.add(mast);
  const rotor=new THREE.Group();rotor.position.set(-.3,3.8,0);for(let i=0;i<4;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(15,.14,.6),dark);blade.rotation.y=i*Math.PI/4;rotor.add(blade);} rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,.28,10),paint)); group.add(rotor);
  for(const side of [-1,1]){const skid=new THREE.Mesh(new THREE.BoxGeometry(10,.27,.34),dark);skid.position.set(-.5,-3,side*2.5);group.add(skid);for(const xx of [-3.3,2.5]){const support=new THREE.Mesh(new THREE.BoxGeometry(.24,1.6,.24),dark);support.position.set(xx,-2.3,side*2.5);group.add(support);}}
  group.position.set(x,driveHeight(x,z)+5,z);group.rotation.y=yaw-Math.PI/2;scene.add(group);
  const v={type:'heli',group,rotor,tailRotor,speed:0,targetSpeed:0,yaw,vertical:0,targetVertical:0}; helis.push(v); return v;
}
function jeep(x,z,color,yaw=0){
  const group=new THREE.Group(),wheelGroups=[];
  const body=new THREE.Mesh(new THREE.BoxGeometry(6.6,1.55,3.5),mat(color));body.position.y=1.85;group.add(body);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(1.75,.92,3.35),mat(color));hood.position.set(-2.32,2.58,0);group.add(hood);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(2.65,1.5,3.05),mat(0xece6d8));cab.position.set(.1,3.18,0);group.add(cab);
  const bed=new THREE.Mesh(new THREE.BoxGeometry(2.3,1.05,3.2),mat(0xe1d2b8));bed.position.set(2.1,2.45,0);group.add(bed);
  const windshield=new THREE.Mesh(new THREE.BoxGeometry(.12,1.05,2.7),new THREE.MeshPhongMaterial({color:0x88a9bf,transparent:true,opacity:.78,shininess:80}));windshield.position.set(-1.05,3.2,0);group.add(windshield);
  const grill=new THREE.Mesh(new THREE.BoxGeometry(.25,.65,2.5),inkMat);grill.position.set(-3.2,2.12,0);group.add(grill);
  for(const dz of [-1.05,-.35,.35,1.05]){const slot=new THREE.Mesh(new THREE.BoxGeometry(.08,.09,.22),mat(0xd7e6ed));slot.position.set(-3.34,2.05,dz);group.add(slot);}
  for(const side of [-1,1]){const light=new THREE.Mesh(new THREE.BoxGeometry(.18,.35,.45),mat(0xffe1a2));light.position.set(-3.33,2.3,side*1.18);group.add(light);const tail=new THREE.Mesh(new THREE.BoxGeometry(.18,.28,.4),mat(0xc64f43));tail.position.set(3.35,2.2,side*1.2);group.add(tail);}
  for(let dx of [-2.1,2.1]) for(let dz of [-1.65,1.65]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.86,.86,.58,12),inkMat);wheel.rotation.x=Math.PI/2;wheel.position.set(dx,1.12,dz);group.add(wheel);wheelGroups.push(wheel);}
  // Rollbar and roof rack make the truck visually readable from a distance.
  const rack=new THREE.Mesh(new THREE.BoxGeometry(2.1,.15,3.2),mat(0x5c6c6b));rack.position.set(.1,4.05,0);group.add(rack);
  for(const side of [-1,1]){const rail=new THREE.Mesh(new THREE.BoxGeometry(2.1,.12,.12),mat(0x5c6c6b));rail.position.set(2.05,3.02,side*1.5);group.add(rail);}
  group.position.set(x,driveHeight(x,z),z);group.rotation.y=yaw-Math.PI/2;scene.add(group);
  const v={type:'jeep',group,wheelGroups,speed:0,targetSpeed:0,yaw}; cars.push(v); return v;
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
cylinder(0,cy+6,0,45,12,0xc9c8c2,16); cylinder(0,cy+15,0,30,7,0xfaf8f1,16); cylinder(0,cy+24,0,15,13,0x65778a,16);
const radar=new THREE.Mesh(new THREE.SphereGeometry(13,16,10),whiteMat); radar.position.set(0,cy+39,0); scene.add(radar);
for(let i=0;i<8;i++){const a=i*Math.PI/4; tower(69*Math.cos(a),69*Math.sin(a));}
for(let i=0;i<24;i++){const a=i*2.399,r=92+((i*37)%148),x=r*Math.cos(a),z=r*Math.sin(a); building(x,z,i%3===0?0x8a8e92:0xc69d69,12,10);}

const placeOutpost=(x,z,accent)=>{for(let k=0;k<4;k++){const dx=(k%2)*25-12,dz=Math.floor(k/2)*24-12;if(bases.every(b=>Math.hypot(x+dx-b.x,z+dz-b.z)>112)) building(x+dx,z+dz,accent,12+(k%2)*4,11);} tower(x+34,z-28,accent); for(let k=0;k<5;k++){const xx=x-32+(k%3)*14,zz=z+38+Math.floor(k/3)*12; box(xx,height(xx,zz)+2,zz,7,4,7,0xa99b82);}};
for(const [x,z,c] of [[-325,-220,0x6688a4],[290,-250,0xb39b74],[0,365,0x759588],[-360,85,0x8e9c84],[365,55,0x9e917f],[10,-340,0xa29a84],[40,195,0xabb4bb]]) placeOutpost(x,z,c);
for(let i=0;i<70;i++){const x=((i*181+89)%1010)-505,z=((i*233+91)%1020)-510;if(bases.some(b=>Math.hypot(x-b.x,z-b.z)<115)||Math.hypot(x,z)<85) continue; const y=height(x,z),r=3+i%5; const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),mat(i%3?0xd2c8b3:0xbeb6a6)); rock.position.set(x,y+r*.32,z); rock.scale.y=1.2+(i%4)*.32; scene.add(rock);} 
// Water is a flat ribbon just above the excavated riverbed, never a raised tube.
const waterVertices=[],waterIndices=[];
for(let i=0;i<=240;i++){
  const z=-596+i*1192/240,x=-90+22*Math.sin(z*.013);
  // Sample banks at the center; render surface nearly flush with the channel floor.
  for(const dx of [-8,8])waterVertices.push(x+dx,height(x+dx,z)+.20,z);
  if(i<240){const a=i*2;waterIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
}
const waterGeo=new THREE.BufferGeometry();waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(waterVertices,3));waterGeo.setIndex(waterIndices);waterGeo.computeVertexNormals();
const waterMesh=new THREE.Mesh(waterGeo,new THREE.MeshLambertMaterial({color:0x67b7cb,transparent:true,opacity:.87,side:THREE.DoubleSide,depthWrite:false}));scene.add(waterMesh);
for(let i=0;i<340;i++){const x=((i*97+23)%1140)-570,z=((i*317+7)%1140)-570;const nearBase=bases.some(b=>Math.hypot(x-b.x,z-b.z)<96);if(nearBase||Math.hypot(x,z)<78||Math.abs(x+90-22*Math.sin(z*.013))<17) continue; const h=height(x,z); if(h>130) continue; const tall=7+(i%5)*2.2; cylinder(x,h+2,z,1.8,4,0x8a745d,5); const canopy=new THREE.Mesh(new THREE.ConeGeometry(5+(i%3),tall,6),treeMat); canopy.position.set(x,h+4+tall*.46,z); scene.add(canopy);} 
// matinhos pintados para dar mais vida ao terreno
for(let i=0;i<180;i++){
  const x=((i*131+57)%1120)-560,z=((i*281+39)%1120)-560;
  if(bases.some(b=>Math.hypot(x-b.x,z-b.z)<98)||Math.hypot(x,z)<72) continue;
  const y=groundSurface(x,z); if(y>110) continue;
  const tuft=new THREE.Group();
  for(const a of [0,Math.PI/3,-Math.PI/3]){const blade=new THREE.Mesh(new THREE.BoxGeometry(.35,3.6,.18),mat(0x5e9548));blade.position.y=1.8;blade.rotation.z=a;tuft.add(blade);} 
  tuft.position.set(x,y+.2,z); tuft.rotation.y=(i*.61)%Math.PI; scene.add(tuft);
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
function enter(){if(player.vehicle){const p=player.vehicle.group.position;if(player.vehicle.type==='heli'&&p.y>height(p.x,p.z)+7){showNotice('DESÇA E POUSE ANTES DE SAIR');return;}let ex=p.x+8,ez=p.z+8;if(blocked(ex,ez)){ex=p.x-8;ez=p.z-8;}player.pos.set(ex,height(ex,ez)+2,ez);player.vehicle=null;updateModeControls();return;} let nearest=null,dist=13; for(const v of [...helis,...cars]){const d=player.pos.distanceTo(v.group.position); if(d<dist){dist=d;nearest=v;}} if(nearest){player.vehicle=nearest; player.yaw=nearest.yaw; orbitYaw=0; orbitPitch=.2; updateModeControls(); showNotice(nearest.type==='heli'?'HELICÓPTERO • CONTROLE EM TERCEIRA PESSOA':'PICKUP • CONTROLE EM TERCEIRA PESSOA');} else showNotice('APROXIME-SE DE UM VEÍCULO');}
const board=document.getElementById('board'); board.addEventListener('click',enter); const action=document.getElementById('action'),verticalControls=document.getElementById('verticalControls');
function updateModeControls(){const v=player.vehicle; weapon.visible=!v; fireButton.style.display=v?'none':'block'; reloadButton.style.display=v?'none':'block'; weaponHud.style.display=v?'none':'block'; verticalControls.style.display=v?.type==='heli'?'flex':'none'; action.textContent=v?'SAIR':'PULAR'; document.getElementById('modeHint').textContent=v?.type==='heli'?'Analógico: voar e virar • arraste a tela para olhar • ▲ subir / ▼ descer':v?'Analógico: dirigir • arraste a tela para olhar • SAIR para desembarcar':'Analógico: mover • arraste a tela para olhar';}
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

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,clock.getDelta());
  const elapsed=Math.min(match.duration,clock.elapsedTime);
  const f=THREE.MathUtils.clamp(Number(!!keys.w)-Number(!!keys.s)+stick.y,-1,1);
  const side=THREE.MathUtils.clamp(Number(!!keys.d)-Number(!!keys.a)+stick.x,-1,1);
  const v=player.vehicle;
  if(shootHeld) shoot();
  kick=Math.max(0,kick-dt*.8); weapon.rotation.x=kick;
  camera.fov=THREE.MathUtils.lerp(camera.fov,aiming&&!v?42:72,Math.min(1,dt*10)); camera.updateProjectionMatrix();
  updateObjectives(dt,elapsed);

  if(v){
    const turn=(Number(!!keys.e)-Number(!!keys.q));
    v.yaw+=(turn-side)*dt*(v.type==='heli'?1.18:1.9);
    v.group.rotation.y=v.yaw-Math.PI/2;
    if(v.type==='heli'){
      v.targetSpeed=f*75; v.speed=THREE.MathUtils.lerp(v.speed,v.targetSpeed,Math.min(1,dt*2.2));
      v.targetVertical=(Number(!!keys[' '])-Number(!!keys.shift))*35; v.vertical=THREE.MathUtils.lerp(v.vertical,v.targetVertical,Math.min(1,dt*2.4));
    }else{v.targetSpeed=f*38; v.speed=THREE.MathUtils.lerp(v.speed,v.targetSpeed,Math.min(1,dt*3.2));}
    v.group.position.x+=-Math.sin(v.yaw)*v.speed*dt; v.group.position.z+=-Math.cos(v.yaw)*v.speed*dt;
    v.group.position.x=THREE.MathUtils.clamp(v.group.position.x,-580,580); v.group.position.z=THREE.MathUtils.clamp(v.group.position.z,-580,580);
    if(v.type==='heli'){
      v.group.position.y+=v.vertical*dt;
      v.group.position.y=Math.max(driveHeight(v.group.position.x,v.group.position.z)+5,Math.min(230,v.group.position.y));
      v.rotor.rotation.y+=dt*18; v.tailRotor.rotation.z+=dt*31;
      // Powerful visible tilt with gentle easing; pitching at forward/backward input,
      // banking on lateral control. Visual only, without aircraft rigid-body solver.
      const bank=THREE.MathUtils.clamp((turn-side)*.52,-.52,.52);
      const pitch=THREE.MathUtils.clamp(-f*.32-v.speed/75*.09+v.vertical/35*.055,-.48,.48);
      const qTarget=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,v.yaw-Math.PI/2,bank,'YXZ'));
      v.group.quaternion.slerp(qTarget,1-Math.exp(-dt*3.0));
    }else{
      const xx=v.group.position.x,zz=v.group.position.z,ang=terrainAttitude(xx,zz,v.yaw);
      const fw=new THREE.Vector2(-Math.sin(v.yaw),-Math.cos(v.yaw)),rt=new THREE.Vector2(Math.cos(v.yaw),-Math.sin(v.yaw));
      const samples=[];for(const fx of [-2.1,2.1])for(const rz of [-1.65,1.65])samples.push(driveHeight(xx+fw.x*fx+rt.x*rz,zz+fw.y*fx+rt.y*rz));
      // Ground clearance based on wheel-contact heights; prevents most floating/sinking on slopes.
      const avg=samples.reduce((a,b)=>a+b,0)/4;
      const targetY=Math.max(avg,Math.max(...samples)-1.0);
      v.group.position.y=THREE.MathUtils.lerp(v.group.position.y,targetY,1-Math.exp(-dt*17));
      const targetRot=new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.clamp(ang.roll,-.38,.38),v.yaw-Math.PI/2,THREE.MathUtils.clamp(-ang.pitch,-.42,.42),'YXZ'));
      v.group.quaternion.slerp(targetRot,1-Math.exp(-dt*10));
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
    jumpVelocity-=26*dt; jumpHeight=Math.max(0,jumpHeight+jumpVelocity*dt); if(jumpHeight===0) jumpVelocity=0;
    player.pos.y=groundSurface(player.pos.x,player.pos.z)+2+jumpHeight;
    camera.position.copy(player.pos); camera.rotation.order='YXZ'; camera.rotation.y=player.yaw; camera.rotation.x=player.pitch;
  }

  board.style.display=(!v&&[...helis,...cars].some(vehicle=>player.pos.distanceTo(vehicle.group.position)<13))?'block':'none';
  info.textContent=`${TEAM_NAMES[player.team]} · ${v?(v.type==='heli'?'HELI':'PICKUP'):'INFANTARIA'}`;
  document.getElementById('cross').style.display=v?'none':'block';
  renderer.render(scene,camera);
}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
displayAmmo(); spawn(); animate();
