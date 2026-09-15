import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';

export function createGameServer(){
  const rooms=new Map();
  const weapons={rifle:{body:26,head:34,delay:100,range:100},smg:{body:28,head:32,delay:65,range:75},shotgun:{body:55,head:65,delay:650,range:15},launcher:{body:100,head:100,delay:900,range:100},sniper:{body:60,head:100,delay:720,range:150},knife:{body:85,head:100,delay:350,range:3}};
  const files={'/':'public/index.html','/index.html':'public/index.html','/game.js':'public/game.js','/network.js':'public/network.js','/vendor/three.module.js':'node_modules/three/build/three.module.js','/vendor/three.core.js':'node_modules/three/build/three.core.js'};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end('{"ok":true,"version":71}');}
    const path=new URL(req.url,'http://localhost').pathname;
    if(!files[path]){res.writeHead(404);return res.end('Não encontrado');}
    try{const bytes=await readFile(new URL(files[path],import.meta.url));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(bytes);}catch{res.writeHead(500);res.end('Arquivo indisponível');}
  });
  const wss=new WebSocketServer({server,path:'/realtime',maxPayload:16384,perMessageDeflate:false});
  const send=(ws,msg)=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<65536)ws.send(JSON.stringify(msg));};
  const lobby=r=>({room:{code:r.code,status:r.status,botsEnabled:r.botsEnabled,killLimit:r.killLimit||40},players:[...r.players.values()].map(p=>({token:p.id,nickname:p.nickname,team:p.team,is_host:p.id===r.host}))});
  const publishLobby=r=>{for(const p of r.players.values())send(p.ws,{type:'lobby',data:lobby(r)});};
  const pose=p=>({token:p.id,nickname:p.nickname,team:p.team,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,weapon:p.weapon,alive:p.health>0,health:p.health,armor:p.armor,kills:p.kills,deaths:p.deaths,seq:p.seq});
  const snapshotFor=(r,p,now=Date.now())=>{const players=[...r.players.values()].map(pose);return {players:players.filter(v=>v.token!==p.id),scores:r.scores,props:[...r.props.entries()].map(([id,v])=>({id,hp:v.hp,active:!v.respawnAt,respawnMs:Math.max(0,(v.respawnAt||0)-now)})),cat:{hp:r.cat?.hp??180,active:!(r.cat?.respawnAt),respawnMs:Math.max(0,(r.cat?.respawnAt||0)-now)},match:{status:r.status,remainingMs:r.status==='playing'?Math.max(0,r.matchEnds-now):0,killLimit:r.killLimit,winner:r.winner||null},reward:{active:!!r.reward?.active,respawnMs:Math.max(0,(r.reward?.respawnAt||0)-now),x:r.reward?.x??-27,z:r.reward?.z??24},self:{...pose(p),alive:p.health>0,respawnSeconds:Math.max(0,Math.ceil((p.respawnAt-now)/1000)),damageFrom:p.lastDamageFrom||null,damageAt:p.lastDamageAt||0}};};
  const spawn=p=>{p.x=0;p.y=1.7;p.z=p.team==='azul'?36:-36;p.yaw=p.team==='azul'?0:Math.PI;p.pitch=0;p.health=100;p.armor=100;p.respawnAt=0;p.seq++;};
  const freshProps=()=>new Map([...['m1','m2','m3','m4','m5','m6','m7','m8'].map(id=>[id,{hp:120,respawnAt:0}]),...['r1','r2'].map(id=>[id,{hp:80,respawnAt:0}])]);
  const finishMatch=(r,reason='tempo')=>{if(r.status!=='playing')return;r.status='finished';r.winner=r.scores.azul===r.scores.vermelho?'empate':(r.scores.azul>r.scores.vermelho?'azul':'vermelho');for(const p of r.players.values())send(p.ws,{type:'matchend',data:{winner:r.winner,reason,scores:r.scores}});};
  const leave=ws=>{const r=rooms.get(ws.roomCode);if(!r)return; r.players.delete(ws.playerId);ws.roomCode=null;ws.playerId=null;if(!r.players.size)rooms.delete(r.code);else{if(!r.players.has(r.host))r.host=r.players.keys().next().value;publishLobby(r);}};
  const tick=setInterval(()=>{
    const now=Date.now();
    for(const r of rooms.values()){
      for(const p of r.players.values()){
        if(!p.ws&&now-p.disconnectedAt>120000){r.players.delete(p.id);continue;}
        if(p.respawnAt&&now>=p.respawnAt)spawn(p);
      }
      if(!r.players.size){rooms.delete(r.code);continue;}
      if(!r.players.has(r.host)){r.host=r.players.keys().next().value;publishLobby(r);}
      for(const [id,prop] of r.props||[]){if(prop.respawnAt&&now>=prop.respawnAt){prop.hp=String(id).startsWith('r')?80:120;prop.respawnAt=0;for(const pl of r.players.values())send(pl.ws,{type:'prop',data:{id,hp:prop.hp,active:true,respawnMs:0}});}}if(r.cat?.respawnAt&&now>=r.cat.respawnAt){r.cat.hp=180;r.cat.respawnAt=0;for(const pl of r.players.values())send(pl.ws,{type:'cat',data:{hp:180,active:true,respawnMs:0}});}if(r.reward&&!r.reward.active&&r.reward.respawnAt&&now>=r.reward.respawnAt){r.reward.active=true;r.reward.respawnAt=0;for(const pl of r.players.values())send(pl.ws,{type:'reward',data:{active:true,respawnMs:0,x:r.reward.x,z:r.reward.z,message:'TINTEIRO DOURADO RENASCEU NO LABIRINTO!'}});}
      if(r.status==='playing'&&now>=r.matchEnds)finishMatch(r,'tempo');
      if(r.status!=='playing')continue;
      for(const p of r.players.values())send(p.ws,{type:'snapshot',data:snapshotFor(r,p,now)});
    }
  },50);
  wss.on('connection',ws=>{
    if(wss.clients.size>32){ws.close(1013,'Servidor cheio');return;}
    ws.window=Date.now();ws.count=0;ws.lastHeard=Date.now();
    ws.on('error',()=>{});
    ws.on('pong',()=>{ws.lastHeard=Date.now();});
    ws.on('close',()=>{const p=rooms.get(ws.roomCode)?.players.get(ws.playerId);if(p?.ws===ws){p.ws=null;p.disconnectedAt=Date.now();}});
    ws.on('message',raw=>{
      ws.lastHeard=Date.now();if(Date.now()-ws.window>1000){ws.window=Date.now();ws.count=0;}if(++ws.count>100){ws.close(1008,'Muitas mensagens');return;}
      let m;try{m=JSON.parse(raw);}catch{return;}
      const reply=data=>send(ws,{id:m.id,data});const fail=error=>send(ws,{id:m.id,error});
      try{
        if(m.action==='ping')return reply({now:Date.now()});
        if(m.action==='resume'){
          const r=rooms.get(m.roomCode),p=r?.players.get(m.playerId);
          if(!p||p.secret!==m.secret)return fail('A sala expirou. Reabra o jogo e crie uma sala.');
          if(p.ws&&p.ws!==ws)p.ws.close(4001,'Sessão reconectada');
          p.ws=ws;ws.roomCode=r.code;ws.playerId=p.id;return reply({...lobby(r),you:p.id,secret:p.secret});
        }
        if(m.action==='create'||m.action==='join'){
          if(ws.roomCode)return fail('Saia da sala atual primeiro.');
          const name=String(m.nickname||'').replace(/[<>\r\n]/g,'').trim().slice(0,14);if(name.length<2)return fail('Escolha um apelido com pelo menos 2 letras.');
          let r;
          if(m.action==='create'){
            if(rooms.size>=8)return fail('Servidor cheio. Tente mais tarde.');
            let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
            r={code,status:'lobby',botsEnabled:false,host:null,players:new Map(),scores:{azul:0,vermelho:0},props:freshProps(),cat:{hp:180,respawnAt:0},reward:{active:false,respawnAt:0,x:-27,z:24},matchStart:0,matchEnds:0,killLimit:40,winner:null};rooms.set(code,r);
          }else{r=rooms.get(String(m.roomCode||'').toUpperCase());if(!r)return fail('Sala não encontrada.');if(r.status!=='lobby')return fail('Essa partida já começou.');if(r.players.size>=10)return fail('Sala cheia (10/10).');}
          const blue=[...r.players.values()].filter(p=>p.team==='azul').length;
          const p={id:randomUUID(),secret:randomBytes(24).toString('hex'),ws,nickname:name,team:blue<=r.players.size-blue?'azul':'vermelho',weapon:'rifle',kills:0,deaths:0,seq:0,lastHit:0};spawn(p);r.players.set(p.id,p);r.host??=p.id;ws.roomCode=r.code;ws.playerId=p.id;
          reply({...lobby(r),you:p.id,secret:p.secret});publishLobby(r);return;
        }
        const r=rooms.get(ws.roomCode),p=r?.players.get(ws.playerId);if(!p||p.ws!==ws)return fail('Entre em uma sala.');
        if(m.action==='heartbeat')return reply(lobby(r));
        if(m.action==='voice'){const target=r.players.get(m.targetToken);if(!target||target===p||!m.signal||typeof m.signal!=='object')return reply({ok:false});send(target.ws,{type:'voice',from:p.id,signal:m.signal});return reply({ok:true});}
        if(m.action==='leave'){leave(ws);return reply({room:null,players:[]});}
        if(m.action==='settings'){if(p.id!==r.host||r.status!=='lobby')return fail('Somente o líder pode alterar no lobby.');r.botsEnabled=m.botsEnabled===true;reply(lobby(r));publishLobby(r);return;}
        if(m.action==='start'){if(p.id!==r.host)return fail('Somente o líder pode iniciar.');r.status='playing';r.scores={azul:0,vermelho:0};r.props=freshProps();r.cat={hp:180,respawnAt:0};r.reward={active:false,respawnAt:0,x:-27,z:24};r.matchStart=Date.now();r.matchEnds=r.matchStart+6*60*1000;r.winner=null;for(const pl of r.players.values()){pl.kills=0;pl.deaths=0;spawn(pl);}reply(lobby(r));publishLobby(r);return;}
        if(r.status!=='playing')return fail('A partida ainda não começou.');
        if(m.action==='rocket'){
          if(p.health<=0||p.weapon!=='launcher')return reply({ok:false});
          const f=m.from||{},d=m.dir||{},distance=Number(m.distance);
          if(![f.x,f.y,f.z,d.x,d.y,d.z,distance].every(Number.isFinite)||distance<=0||distance>60)return reply({ok:false});
          const payload={from:{x:f.x,y:f.y,z:f.z},dir:{x:d.x,y:d.y,z:d.z},distance:Math.min(60,distance),team:p.team};
          for(const other of r.players.values())if(other.id!==p.id)send(other.ws,{type:'rocket',from:p.id,data:payload});
          return reply({ok:true});
        }
        if(m.action==='state'){
          if(p.health<=0)return reply(snapshotFor(r,p));
          for(const [key,min,max] of [['x',-52,52],['y',-4,18],['z',-45,45],['yaw',-100000,100000],['pitch',-1.5,1.5]])if(typeof m[key]==='number'&&Number.isFinite(m[key]))p[key]=Math.max(min,Math.min(max,m[key]));
          if(weapons[m.weapon])p.weapon=m.weapon;p.seq++;return reply(snapshotFor(r,p));
        }
        if(m.action==='prop_hit'){const id=String(m.propId||''),prop=r.props.get(id),now=Date.now();if(!prop||prop.respawnAt)return reply({ok:false});const dmg=Math.max(1,Math.min(100,Math.round(Number(m.damage)||0)));prop.hp=Math.max(0,prop.hp-dmg);if(prop.hp<=0){const respawnMs=30000;prop.respawnAt=now+respawnMs;for(const pl of r.players.values())send(pl.ws,{type:'prop',data:{id,hp:0,active:false,respawnMs}});}return reply({ok:true,id,hp:prop.hp,active:!prop.respawnAt,respawnMs:Math.max(0,(prop.respawnAt||0)-now)});}
        if(m.action==='cat_hit'){const now=Date.now();if(!r.cat||r.cat.respawnAt)return reply({ok:false,hp:0,active:false,respawnMs:Math.max(0,(r.cat?.respawnAt||0)-now)});const dmg=Math.max(1,Math.min(100,Math.round(Number(m.damage)||0)));r.cat.hp=Math.max(0,r.cat.hp-dmg);if(r.cat.hp<=0){r.cat.respawnAt=now+10000;for(const pl of r.players.values())send(pl.ws,{type:'cat',data:{hp:0,active:false,respawnMs:10000}});if(r.reward&&!r.reward.active&&!r.reward.respawnAt){r.reward.active=true;for(const pl of r.players.values())send(pl.ws,{type:'reward',data:{active:true,respawnMs:0,x:r.reward.x,z:r.reward.z,message:'O GATO DEIXOU O TINTEIRO DOURADO!'}});}}return reply({ok:true,hp:r.cat.hp,active:!r.cat.respawnAt,respawnMs:Math.max(0,(r.cat.respawnAt||0)-now)});}
        if(m.action==='reward_take'){const now=Date.now();if(!r.reward?.active||p.health<=0)return reply({ok:false});if(Math.hypot(p.x-r.reward.x,p.z-r.reward.z)>3.2)return reply({ok:false});r.reward.active=false;r.reward.respawnAt=now+90000;p.health=100;p.armor=100;for(const pl of r.players.values())send(pl.ws,{type:'reward',data:{active:false,respawnMs:90000,x:r.reward.x,z:r.reward.z}});return reply({ok:true,health:100,armor:100,ammoRefill:true,respawnMs:90000});}
        if(m.action==='hazardhit'){const now=Date.now();if(p.health<=0||r.cat?.respawnAt||now-(p.lastHazardHit||0)<1200)return reply({ok:false});p.lastHazardHit=now;let healthDamage=26;if(p.armor>0){const a=Math.min(p.armor,10);p.armor-=a;healthDamage-=a;}p.health=Math.max(0,p.health-healthDamage);const eliminated=p.health===0;if(eliminated){p.deaths++;p.respawnAt=now+4000;for(const pl of r.players.values())send(pl.ws,{type:'kill',data:{killer:'Criatura',victim:p.nickname,self:false,team:'neutro',weapon:'cheshire',headshot:false}});}return reply({ok:true,health:p.health,armor:p.armor,eliminated});}
        if(m.action==='selfhit'){if(p.health<=0||p.weapon!=='launcher')return reply({ok:false});const raw=Math.max(0,Math.min(100,Math.round(Number(m.damage)||0)));if(raw<=0)return reply({ok:false});p.health=Math.max(0,p.health-raw);const eliminated=p.health===0;if(eliminated){p.armor=0;p.deaths++;p.respawnAt=Date.now()+4000;for(const other of r.players.values())send(other.ws,{type:'kill',data:{killer:p.nickname,victim:p.nickname,self:true,team:p.team,weapon:'launcher',headshot:false}});}return reply({ok:true,health:p.health,armor:p.armor,eliminated});}
        if(m.action==='hit'){
          const target=r.players.get(m.targetToken),w=weapons[p.weapon],now=Date.now();
          if(!target||target===p||target.team===p.team||p.health<=0||target.health<=0||now-p.lastHit<w.delay||Math.hypot(p.x-target.x,p.z-target.z)>w.range+2)return reply({ok:false});
          const amount=Number(m.damage);if(!Number.isFinite(amount)||amount<=0)return reply({ok:false});
          p.lastHit=now;const headshot=m.headshot===true;const distToTarget=Math.hypot(p.x-target.x,p.z-target.z);const cap=p.weapon==='smg'?(distToTarget<=9?(headshot?32:28):(distToTarget<=20?(headshot?24:21):(headshot?19:16))):(headshot?w.head:w.body);const rawDamage=Math.min(cap,Math.round(amount));
          let armorDamage=0,healthDamage=rawDamage;
          if(!headshot&&p.weapon!=='launcher'&&target.armor>0){armorDamage=Math.min(target.armor,Math.round(rawDamage*.40));healthDamage=Math.max(1,rawDamage-armorDamage);target.armor=Math.max(0,target.armor-armorDamage);}
          if(p.weapon==='launcher'&&rawDamage>=100)target.armor=0;
          target.health=Math.max(0,target.health-healthDamage);target.lastDamageFrom=p.id;target.lastDamageAt=now;const eliminated=target.health===0;
          if(eliminated){target.deaths++;target.respawnAt=now+4000;p.kills++;r.scores[p.team]++;for(const other of r.players.values())send(other.ws,{type:'kill',data:{killer:p.nickname,victim:target.nickname,self:false,team:p.team,weapon:p.weapon,headshot}});if(r.scores[p.team]>=r.killLimit)finishMatch(r,'kills');}
          return reply({ok:true,damage:healthDamage,armorDamage,health:target.health,armor:target.armor,eliminated});
        }
        fail('Ação desconhecida.');
      }catch{fail('Falha na mensagem da sala.');}
    });
  });
  const health=setInterval(()=>{for(const ws of wss.clients){if(Date.now()-ws.lastHeard>20000)ws.terminate();else ws.ping();}},5000);
  return {server,rooms,close:()=>new Promise(resolve=>{clearInterval(tick);clearInterval(health);for(const ws of wss.clients)ws.terminate();wss.close(()=>server.close(resolve));})};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const game=createGameServer();game.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Submundo V13 Polimento Visual pronto'));process.on('SIGTERM',async()=>{await game.close();process.exit(0);});}
