import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';

export function createGameServer(){
  const rooms=new Map();
  const weapons={rifle:{body:22,head:34,delay:100,range:100},smg:{body:13,head:21,delay:65,range:75},shotgun:{body:55,head:65,delay:650,range:15},launcher:{body:100,head:100,delay:900,range:100},sniper:{body:60,head:100,delay:900,range:150},knife:{body:45,head:55,delay:350,range:3}};
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
  const lobby=r=>({room:{code:r.code,status:r.status,botsEnabled:r.botsEnabled},players:[...r.players.values()].map(p=>({token:p.id,nickname:p.nickname,team:p.team,is_host:p.id===r.host}))});
  const publishLobby=r=>{for(const p of r.players.values())send(p.ws,{type:'lobby',data:lobby(r)});};
  const pose=p=>({token:p.id,nickname:p.nickname,team:p.team,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,weapon:p.weapon,alive:p.health>0,health:p.health,armor:p.armor,kills:p.kills,deaths:p.deaths,seq:p.seq});
  const snapshotFor=(r,p,now=Date.now())=>{const players=[...r.players.values()].map(pose);return {players:players.filter(v=>v.token!==p.id),scores:r.scores,self:{...pose(p),alive:p.health>0,respawnSeconds:Math.max(0,Math.ceil((p.respawnAt-now)/1000))}};};
  const spawn=p=>{p.x=0;p.y=1.7;p.z=p.team==='azul'?36:-36;p.yaw=p.team==='azul'?Math.PI:0;p.pitch=0;p.health=100;p.armor=100;p.respawnAt=0;p.seq++;};
  const leave=ws=>{const r=rooms.get(ws.roomCode);if(!r)return; r.players.delete(ws.playerId);ws.roomCode=null;ws.playerId=null;if(!r.players.size)rooms.delete(r.code);else{if(!r.players.has(r.host))r.host=r.players.keys().next().value;publishLobby(r);}};
  const tick=setInterval(()=>{
    const now=Date.now();
    for(const r of rooms.values()){
      for(const p of r.players.values()){
        if(!p.ws&&now-p.disconnectedAt>15000){r.players.delete(p.id);continue;}
        if(p.respawnAt&&now>=p.respawnAt)spawn(p);
      }
      if(!r.players.size){rooms.delete(r.code);continue;}
      if(!r.players.has(r.host)){r.host=r.players.keys().next().value;publishLobby(r);}
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
            r={code,status:'lobby',botsEnabled:false,host:null,players:new Map(),scores:{azul:0,vermelho:0}};rooms.set(code,r);
          }else{r=rooms.get(String(m.roomCode||'').toUpperCase());if(!r)return fail('Sala não encontrada.');if(r.status!=='lobby')return fail('Essa partida já começou.');if(r.players.size>=8)return fail('Sala cheia (8/8).');}
          const blue=[...r.players.values()].filter(p=>p.team==='azul').length;
          const p={id:randomUUID(),secret:randomBytes(24).toString('hex'),ws,nickname:name,team:blue<=r.players.size-blue?'azul':'vermelho',weapon:'rifle',kills:0,deaths:0,seq:0,lastHit:0};spawn(p);r.players.set(p.id,p);r.host??=p.id;ws.roomCode=r.code;ws.playerId=p.id;
          reply({...lobby(r),you:p.id,secret:p.secret});publishLobby(r);return;
        }
        const r=rooms.get(ws.roomCode),p=r?.players.get(ws.playerId);if(!p||p.ws!==ws)return fail('Entre em uma sala.');
        if(m.action==='heartbeat')return reply(lobby(r));
        if(m.action==='voice'){const target=r.players.get(m.targetToken);if(!target||target===p||!m.signal||typeof m.signal!=='object')return reply({ok:false});send(target.ws,{type:'voice',from:p.id,signal:m.signal});return reply({ok:true});}
        if(m.action==='leave'){leave(ws);return reply({room:null,players:[]});}
        if(m.action==='settings'){if(p.id!==r.host||r.status!=='lobby')return fail('Somente o líder pode alterar no lobby.');r.botsEnabled=m.botsEnabled===true;reply(lobby(r));publishLobby(r);return;}
        if(m.action==='start'){if(p.id!==r.host)return fail('Somente o líder pode iniciar.');r.status='playing';reply(lobby(r));publishLobby(r);return;}
        if(r.status!=='playing')return fail('A partida ainda não começou.');
        if(m.action==='state'){
          if(p.health<=0)return reply(snapshotFor(r,p));
          for(const [key,min,max] of [['x',-48,48],['y',0,18],['z',-48,48],['yaw',-100000,100000],['pitch',-1.5,1.5]])if(typeof m[key]==='number'&&Number.isFinite(m[key]))p[key]=Math.max(min,Math.min(max,m[key]));
          if(weapons[m.weapon])p.weapon=m.weapon;p.seq++;return reply(snapshotFor(r,p));
        }
        if(m.action==='hit'){
          const target=r.players.get(m.targetToken),w=weapons[p.weapon],now=Date.now();
          if(!target||target===p||target.team===p.team||p.health<=0||target.health<=0||now-p.lastHit<w.delay||Math.hypot(p.x-target.x,p.z-target.z)>w.range+2)return reply({ok:false});
          const amount=Number(m.damage);if(!Number.isFinite(amount)||amount<=0)return reply({ok:false});
          p.lastHit=now;const headshot=m.headshot===true;const cap=headshot?w.head:w.body;const rawDamage=Math.min(cap,Math.round(amount));
          let armorDamage=0,healthDamage=rawDamage;
          if(!headshot&&p.weapon!=='launcher'&&target.armor>0){armorDamage=Math.min(target.armor,Math.round(rawDamage*.40));healthDamage=Math.max(1,rawDamage-armorDamage);target.armor=Math.max(0,target.armor-armorDamage);}
          if(p.weapon==='launcher'&&rawDamage>=100)target.armor=0;
          target.health=Math.max(0,target.health-healthDamage);const eliminated=target.health===0;
          if(eliminated){target.deaths++;target.respawnAt=now+4000;p.kills++;r.scores[p.team]++;}
          return reply({ok:true,damage:healthDamage,armorDamage,health:target.health,armor:target.armor,eliminated});
        }
        fail('Ação desconhecida.');
      }catch{fail('Falha na mensagem da sala.');}
    });
  });
  const health=setInterval(()=>{for(const ws of wss.clients){if(Date.now()-ws.lastHeard>20000)ws.terminate();else ws.ping();}},5000);
  return {server,rooms,close:()=>new Promise(resolve=>{clearInterval(tick);clearInterval(health);for(const ws of wss.clients)ws.terminate();wss.close(()=>server.close(resolve));})};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const game=createGameServer();game.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Submundo V73 pronto'));process.on('SIGTERM',async()=>{await game.close();process.exit(0);});}
