// DRAWN FRONT / Submundo Ink Ops — Vale da Ruptura (ES module)
export const ruptureValleyMapBody = `
    const before=new Set(scene.children), c0=colliders.length;
    const valleyPlatforms=[]; window.__inkValleyPlatforms=valleyPlatforms;
    const paperGround=box(100,.18,82,mat(0xe9e4d8),0,-.09,0,false); paperGround.userData.valleySurface=true; addHatching(paperGround,92,.05,72,18,false);
    const makeValleyLabel=(text,x,y,z,scale=1.0,rotY=0)=>{const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='rgba(252,251,247,.96)';ctx.fillRect(6,12,500,104);ctx.strokeStyle='#171510';ctx.lineWidth=8;ctx.strokeRect(6,12,500,104);ctx.fillStyle='#171510';ctx.font='900 40px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(scale*3.0,scale*.78),new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide,depthTest:true,polygonOffset:true,polygonOffsetFactor:-2}));m.position.set(x,y,z);m.rotation.y=rotY;scene.add(m);return m;};
    const addRectCollider=(x,z,w,d,height=6,minY=null)=>{const c={minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,height}; if(minY!=null)c.minY=minY; colliders.push(c); return c;};
    const lowWall=(x,y,z,w,h,d,color,rot=0)=>{const m=box(w,h,d,mat(color),x,y,z,true); m.rotation.y=rot; return m;};
    const makeRock=(x,z,s=1,rot=0)=>{const g=new THREE.Group(); const base=addOutline(new THREE.Mesh(new THREE.DodecahedronGeometry(1.6*s,0),mat(0xb8b2a5))); base.scale.set(1.45,.95,1.15); base.position.y=1.1*s; g.add(base); const top=addOutline(new THREE.Mesh(new THREE.DodecahedronGeometry(.9*s,0),mat(0xcdc7bb))); top.position.set(.35*s,2.1*s,-.2*s); g.add(top); g.position.set(x,0,z); g.rotation.y=rot; scene.add(g); addRectCollider(x,z,3.2*s,2.9*s,2.8*s); return g;};
    const tree=(x,z,s=1)=>{const trunk=cyl(.22*s,2.5*s,mat(0x705746),x,1.25*s,z,7,false); const crown=addOutline(new THREE.Mesh(new THREE.SphereGeometry(1.2*s,8,6),mat(0x88a983))); crown.position.set(x,3.0*s,z); scene.add(crown); const crown2=addOutline(new THREE.Mesh(new THREE.SphereGeometry(.92*s,7,5),mat(0x9bb692))); crown2.position.set(x+.65*s,3.35*s,z-.35*s); scene.add(crown2); addRectCollider(x,z,1.8*s,1.8*s,4.2*s); return [trunk,crown,crown2];};
    const crateStack=(x,z,levels=2,rot=0)=>{const g=new THREE.Group(); for(let j=0;j<levels;j++){const w=2.4, h=1.5, d=2.2; const m=addOutline(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(j%2?0xcaa97c:0xb98f66))); m.position.set(0,.75+j*1.48,0); addHatching(m,1.65,.9,1.45,3,false); g.add(m);} g.position.set(x,0,z); g.rotation.y=rot; scene.add(g); addRectCollider(x,z,2.4,2.2,levels*1.5+.2); return g;};
    const sandbag=(x,z,len=4,rot=0,color=0xd9d1b8)=>{const g=new THREE.Group(); for(let i=0;i<len;i++){const bag=addOutline(new THREE.Mesh(new THREE.CapsuleGeometry(.32,.56,3,6),mat(color))); bag.rotation.z=Math.PI/2; bag.position.set((i-(len-1)/2)*.64,.34,0); g.add(bag);} g.position.set(x,0,z); g.rotation.y=rot; scene.add(g); const swap=Math.abs(Math.sin(rot))>.5; addRectCollider(x,z,swap?.8:len*.64+.32,swap?len*.64+.32:.8,1.0); return g;};
    const house=(x,z,rot=0,color=0xe4dccd,roofColor=0xaa7b6b,label='')=>{const g=new THREE.Group(); const body=addOutline(new THREE.Mesh(new THREE.BoxGeometry(8,4.5,6),mat(color))); body.position.y=2.25; g.add(body); const roofL=addOutline(new THREE.Mesh(new THREE.BoxGeometry(8.6,.34,3.7),mat(roofColor))); roofL.position.set(0,4.95,-1.55); roofL.rotation.x=.55; g.add(roofL); const roofR=addOutline(new THREE.Mesh(new THREE.BoxGeometry(8.6,.34,3.7),mat(roofColor))); roofR.position.set(0,4.95,1.55); roofR.rotation.x=-.55; g.add(roofR); const door=addOutline(new THREE.Mesh(new THREE.BoxGeometry(1.35,2.35,.18),mat(0x665147))); door.position.set(0,1.2,-3.02); g.add(door); for(const sx of [-2.1,2.1]){const win=addOutline(new THREE.Mesh(new THREE.BoxGeometry(1.55,1.15,.18),mat(0x9fbfcd))); win.position.set(sx,2.6,-3.02); g.add(win);} g.position.set(x,0,z); g.rotation.y=rot; scene.add(g); addRectCollider(x,z,8,6,5.4); if(label) makeValleyLabel(label,x,6.2,z,0.62,rot+Math.PI); return g;};
    const warehouse=(x,z,w=14,d=10,rot=0,label='DEPÓSITO')=>{const g=new THREE.Group(); const body=addOutline(new THREE.Mesh(new THREE.BoxGeometry(w,5.8,d),mat(0xd8d4cb))); body.position.y=2.9; g.add(body); const roof=addOutline(new THREE.Mesh(new THREE.BoxGeometry(w+.6,.28,d+.6),mat(0xb7b3aa))); roof.position.y=5.9; g.add(roof); const gate=addOutline(new THREE.Mesh(new THREE.BoxGeometry(3.6,3.2,.18),mat(0x6e7e89))); gate.position.set(0,1.6,-d/2-.02); g.add(gate); for(const sx of [-w/2+.9,w/2-.9]) for(const sz of [-d/2+1.1,d/2-1.1]){const col=new THREE.Mesh(new THREE.BoxGeometry(.18,5.7,.18),mat(0x8a867c)); col.position.set(sx,2.85,sz); g.add(col);} g.position.set(x,0,z); g.rotation.y=rot; scene.add(g); addRectCollider(x,z,w,d,6.2); makeValleyLabel(label,x,7.1,z,0.72,rot+Math.PI); return g;};
    const watchtower=(x,z,rot=0,label='TORRE')=>{const g=new THREE.Group(); for(const sx of [-1.2,1.2]) for(const sz of [-1.2,1.2]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.26,6.3,.26),mat(0x6b5b47)); leg.position.set(sx,3.15,sz); g.add(leg);} const plat=addOutline(new THREE.Mesh(new THREE.BoxGeometry(3.7,.28,3.7),mat(0xd1c5ad))); plat.position.y=6.1; g.add(plat); const roof=addOutline(new THREE.Mesh(new THREE.ConeGeometry(2.7,1.7,4),mat(0x8f6f55))); roof.position.y=7.3; roof.rotation.y=Math.PI/4; g.add(roof); g.position.set(x,0,z); g.rotation.y=rot; scene.add(g); addRectCollider(x,z,3.4,3.4,6.3); valleyPlatforms.push({minX:x-1.85,maxX:x+1.85,minZ:z-1.85,maxZ:z+1.85,top:6.24}); makeValleyLabel(label,x,8.6,z,.52,rot+Math.PI); return g;};
    const bridge=(x,z,w,d,label='PONTE')=>{const deck=box(w,.38,d,mat(0xd4c4a5),x,1.55,z,false); addHatching(deck,w*.72,.05,d*.62,10,false); valleyPlatforms.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,top:1.74}); lowWall(x,1.95,z-d/2+.16,w,.42,.18,0x786654,0); lowWall(x,1.95,z+d/2-.16,w,.42,.18,0x786654,0); for(const sx of [-w/2+.8,w/2-.8]){lowWall(x+sx,0.78,z,.24,1.25,d,0xa38967,0);} makeValleyLabel(label,x,3.0,z,0.52,Math.PI);};
    const helipad=(x,z,label='HELIPONTO')=>{const disc=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(4.8,4.8,.22,18),mat(0xd8d2c6))); disc.position.set(x,.11,z); scene.add(disc); const ring=addOutline(new THREE.Mesh(new THREE.TorusGeometry(3.5,.12,6,24),mat(0x5a6a74))); ring.position.set(x,.26,z); ring.rotation.x=Math.PI/2; scene.add(ring); const hbar1=addOutline(new THREE.Mesh(new THREE.BoxGeometry(.32,.08,2.6),mat(0x356bc1))); hbar1.position.set(x,.26,z); scene.add(hbar1); const hbar2=addOutline(new THREE.Mesh(new THREE.BoxGeometry(2.0,.08,.32),mat(0x356bc1))); hbar2.position.set(x,.26,z); scene.add(hbar2); makeValleyLabel(label,x,1.8,z,.52,Math.PI);};

    // Limites do mapa
    for(const wallData of [[100,5,.8,0,2.5,-41],[100,5,.8,0,2.5,41],[.8,5,82,-50,2.5,0],[.8,5,82,50,2.5,0]]){box(...wallData.slice(0,3),mat(0xc9c5bb),...wallData.slice(3),true);} 

    // Rio com ilha central
    const water=box(26,.08,82,mat(0xaec8d4),0,-.02,0,false); water.userData.valleyWater=true; addHatching(water,22,.02,72,11,true);
    const island=box(10,.22,12,mat(0xd8d0bb),0,.02,0,false); addHatching(island,7,.04,9,6,false); makeValleyLabel('ILHA CENTRAL',0,2.4,0,.56,Math.PI);
    colliders.push({minX:-13,maxX:-5,minZ:-41,maxZ:41,height:.8,minY:-1});
    colliders.push({minX:5,maxX:13,minZ:-41,maxZ:41,height:.8,minY:-1});
    // bordas extras do rio perto da ilha
    colliders.push({minX:-5,maxX:5,minZ:-41,maxZ:-6,height:.8,minY:-1});
    colliders.push({minX:-5,maxX:5,minZ:6,maxZ:41,height:.8,minY:-1});
    bridge(0,-15,10,4,'PONTE SUL');
    bridge(0,15,10,4,'PONTE NORTE');
    bridge(0,0,14,4,'PONTE CENTRAL');

    // Bases e spawn áreas
    warehouse(0,-34,18,10,0,'BASE VERMELHA');colliders.pop();
    warehouse(0,34,18,10,0,'BASE AZUL');colliders.pop();
    helipad(-17,-33,'HELIPONTO V');
    helipad(17,33,'HELIPONTO A');
    sandbag(-5,-27,5,0); sandbag(5,-27,5,0); sandbag(-5,27,5,0); sandbag(5,27,5,0);
    watchtower(-18,-26,0,'TORRE V'); watchtower(18,26,Math.PI,'TORRE A');

    // Vila ribeirinha a leste-sul
    house(24,-22,Math.PI/2,0xe5ddd0,0xb88672,'CASA 1');
    house(32,-12,Math.PI/2,0xe8e0d4,0xa67863,'CASA 2');
    house(38,-24,Math.PI/2,0xddd6ca,0x946d5b,'CASA 3');
    crateStack(28,-4,2,.2); sandbag(33,-3,4,Math.PI/2);
    makeValleyLabel('VILA RIBEIRINHA',32,6.7,-18,.82,Math.PI/2);

    // Fazendas a oeste-sul
    house(-31,-24,-Math.PI/2,0xe6ddc8,0xa07d53,'CELEIRO');
    crateStack(-25,-13,3,.1); crateStack(-37,-10,2,.4);
    for(const p of [[-43,-27],[-38,-31],[-34,-16],[-26,-30],[-21,-22],[-44,-16]]) tree(...p,.9);
    for(const p of [[-34,-20,1.1],[-41,-8,1.0],[-26,-28,.85]]) makeRock(...p);
    makeValleyLabel('FAZENDAS',-33,6.4,-18,.76,-Math.PI/2);

    // Represa / barragem no norte-oeste
    const dam=box(22,4.2,3.0,mat(0xc6c0b4),-24,2.1,28,false); addHatching(dam,18,.1,2.2,8,true);
    lowWall(-24,4.45,28,22,.35,.25,0x80786f,0);
    for(const x of [-32,-24,-16]){const gate=addOutline(new THREE.Mesh(new THREE.BoxGeometry(3.4,2.3,.18),mat(0x8198a5))); gate.position.set(x,1.65,26.46); scene.add(gate);}
    addRectCollider(-24,28,22,3,4.3);
    watchtower(-37,24,.2,'POSTO NORTE'); watchtower(-11,23,-.2,'MIRANTE');
    helipad(-38,33,'HELIPONTO N');
    makeValleyLabel('REPRESA',-24,6.2,28,.84,Math.PI);

    // Zona industrial a leste-norte
    warehouse(31,20,18,12,Math.PI/2,'ARMAZÉM');
    warehouse(38,31,12,10,0,'OFICINA');
    for(const p of [[24,31],[29,9],[42,10],[44,22]]) crateStack(p[0],p[1],2,.1);
    sandbag(25,24,4,Math.PI/2); sandbag(35,11,4,0);
    // tanques industriais
    for(const p of [[22,16],[22,24],[42,24]]){const t=cyl(1.9,4.6,mat(0xb6c1c8),p[0],2.3,p[1],12,false); const top=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(2.05,2.05,.12,12),mat(0x8799a3))); top.position.set(p[0],4.65,p[1]); scene.add(top); addRectCollider(p[0],p[1],4.0,4.0,4.8);} 
    makeValleyLabel('ZONA INDUSTRIAL',33,7.1,20,.82,Math.PI/2);

    // Cidade abandonada no centro-leste
    warehouse(18,2,12,8,0,'PREFEITURA');
    house(26,5,0,0xdfd8cd,0x8f7268,'MERCADO');
    house(19,-9,0,0xe4ded5,0x9a7467,'HOSTEL');
    house(34,0,0,0xd8d1c9,0xa27b69,'CASA');
    sandbag(13,8,5,0); sandbag(31,10,4,Math.PI/2); sandbag(26,-13,4,0);
    makeValleyLabel('CIDADE ABANDONADA',24,6.9,2,.82,Math.PI);

    // Colina do radar no centro-oeste/norte
    const hillBase=box(14,1.2,12,mat(0xc8bda6),-24,.6,7,false); const hillMid=box(10,1.1,8,mat(0xd6ccb7),-24,1.55,7,false); const hillTop=box(6,1.0,5,mat(0xe2d9c7),-24,2.5,7,false);
    valleyPlatforms.push({minX:-31,maxX:-17,minZ:1,maxZ:13,top:1.2},{minX:-29,maxX:-19,minZ:3,maxZ:11,top:2.1},{minX:-27,maxX:-21,minZ:4.5,maxZ:9.5,top:3.0});
    const mast=cyl(.18,6.2,mat(0x6c7781),-24,6.2,7,8,false); const dish=addOutline(new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,.16,18,1,false,0,Math.PI),mat(0xe7ecef))); dish.position.set(-24,8.1,7); dish.rotation.z=Math.PI/2; scene.add(dish); addRectCollider(-24,7,2.2,2.2,8.6);
    sandbag(-16,5,4,0); sandbag(-32,10,4,Math.PI/2);
    makeValleyLabel('COLINA DO RADAR',-24,10.2,7,.84,Math.PI);

    // Cânion e passagens oeste-norte / miolo
    for(const p of [[-39,8,1.25,.2],[-42,16,1.1,-.1],[-36,18,.95,.4],[-31,15,.9,.1],[-42,0,1.0,0],[-35,-2,1.2,.3]]) makeRock(...p);
    makeValleyLabel('CÂNION',-38,5.6,9,.72,-Math.PI/2);

    // Posto avançado ao sul-centro
    warehouse(-17,-4,10,8,Math.PI/2,'POSTO');
    sandbag(-9,-3,5,Math.PI/2); sandbag(-24,-8,4,0); crateStack(-20,7,2,0);
    helipad(-36,-1,'HELIPONTO O');
    makeValleyLabel('POSTO AVANÇADO',-18,6.6,-4,.74,-Math.PI/2);

    // Trincheiras leves no miolo sul e norte
    const trench=(x,z,w=10,d=3,rot=0)=>{const g=box(w,.65,d,mat(0xc3b69d),x,.32,z,false); const inner=box(w-1.0,.25,d-1.0,mat(0xab9b81),x,.14,z,false); g.rotation.y=rot; inner.rotation.y=rot; addRectCollider(x,z,w,d,.75); sandbag(x-(Math.cos(rot)*(w*.38)),z-(Math.sin(rot)*(w*.38)),4,rot); sandbag(x+(Math.cos(rot)*(w*.38)),z+(Math.sin(rot)*(w*.38)),4,rot);};
    trench(0,-6,12,3,0); trench(0,7,12,3,0); trench(-10,0,3,10,Math.PI/2); trench(10,0,3,10,Math.PI/2);

    // Estradas principais
    const road1=box(10,.04,82,mat(0xd2cec3),-24,-.04,0,false); addHatching(road1,6,.01,74,18,true);
    const road2=box(10,.04,82,mat(0xd2cec3),24,-.04,0,false); addHatching(road2,6,.01,74,18,true);
    const road3=box(100,.04,8,mat(0xd2cec3),0,-.04,-18,false); addHatching(road3,92,.01,5.2,18,false);
    const road4=box(100,.04,8,mat(0xd2cec3),0,-.04,18,false); addHatching(road4,92,.01,5.2,18,false);

    // Vegetação complementar
    for(const tp of [[-7,34,.8],[-12,22,.85],[-1,24,.75],[11,28,.85],[8,12,.7],[44,33,.85],[44,-31,.8],[36,-33,.72],[-46,33,.82],[-46,-33,.76],[-7,-23,.82],[9,-24,.82],[16,-28,.76],[0,32,.7],[0,-32,.7],[8,5,.72],[-9,14,.72],[-14,16,.65],[13,15,.7]]) tree(tp[0],tp[1],tp[2]);

    // Sinais táticos extras
    makeValleyLabel('VIA LESTE',24,1.2,-30,.46,Math.PI/2);
    makeValleyLabel('VIA OESTE',-24,1.2,30,.46,-Math.PI/2);
    makeValleyLabel('PONTE CENTRAL',0,2.8,0,.56,Math.PI);

    // Base Verde: terceira facção, situada na encosta oeste, com seu próprio heliponto.
    const greenBase=warehouse(-42,-1,11,13,Math.PI/2,'BASE VERDE');colliders.pop();
    for(const obj of greenBase.children){if(obj.isMesh&&obj.material?.color&&obj.material.color.getHex()===0xd8d4cb)obj.material.color.setHex(0x93bba3);}
    helipad(-41,-15,'HELIPONTO VDE');
    sandbag(-40,12,5,Math.PI/2,0x94b8a1);
    makeValleyLabel('FACÇÃO VERDE',-42,8,-1,.74,Math.PI/2);
    valleyObjects=scene.children.filter(o=>!before.has(o));
    for(let i=c0;i<colliders.length;i++) colliders[i].map='vale';
  `;
