/* Ponte entre o FPS existente e o servidor WebSocket V71. */
(() => {
  const NativeResponse = window.Response;
  const nativeFetch = window.fetch.bind(window);
  let socket = null, nextId = 1, pending = new Map(), lobby = null, latest = null;
  let playerId = localStorage.getItem('inkopsRealtimePlayer') || '';
  let secret = localStorage.getItem('inkopsRealtimeSecret') || '';
  const uiToken = localStorage.getItem('inkopsPlayerToken') || '';
  const normalizeLobby = data => {
    if(!data || !Array.isArray(data.players) || !playerId || !uiToken) return data;
    return {...data, players:data.players.map(p=>p.token===playerId?{...p,token:uiToken}:p)};
  };
  let reconnectTimer=null, resumeBusy=false;
  // V44: diagnóstico puro de rede. Mede RTT real até o servidor e variação entre amostras (jitter), sem alterar o netcode.
  let pingTimer=null,lastRtt=null,jitter=0;
  const netBadge=()=>{
    let el=document.getElementById('netDiagnostics');
    if(!el){
      el=document.createElement('div');el.id='netDiagnostics';
      el.style.cssText='position:fixed;right:10px;top:78px;z-index:24;padding:4px 7px;border:1.5px solid #171510;background:rgba(238,231,212,.82);color:#171510;font:700 10px Georgia,serif;line-height:1.2;pointer-events:none;text-shadow:0 1px #eee7d4;white-space:nowrap';
      el.textContent='PING -- ms · JITTER -- ms';document.body.appendChild(el);
    }
    return el;
  };
  const paintNet=(rtt=null)=>{
    const el=netBadge();
    if(rtt==null){el.textContent='PING -- ms · JITTER -- ms';return;}
    el.textContent=`PING ${Math.round(rtt)} ms · JITTER ${Math.round(jitter)} ms`;
  };
  function startPingMeter(){
    clearInterval(pingTimer);
    const sample=async()=>{
      if(!socket||socket.readyState!==1){paintNet(null);return;}
      const t0=performance.now();
      try{await call('ping');const rtt=performance.now()-t0;if(lastRtt!=null){const delta=Math.abs(rtt-lastRtt);jitter=jitter?jitter*.75+delta*.25:delta;}lastRtt=rtt;paintNet(rtt);window.__inkRealtimeNetStats?.({ping:rtt,jitter});}
      catch{paintNet(null);}
    };
    sample();pingTimer=setInterval(sample,1000);
  }
  const base = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/realtime`;
  const jsonResponse = (value,status=200) => new NativeResponse(JSON.stringify(value), {status,headers:{'Content-Type':'application/json'}});
  function connect(){
    if(socket && socket.readyState <= 1) return;
    socket = new WebSocket(base);
    socket.onopen=()=>{startPingMeter();const roomCode=localStorage.getItem('inkopsRoomCode')||'';if(playerId&&secret&&roomCode&&!resumeBusy){resumeBusy=true;setTimeout(()=>{if(socket?.readyState!==1){resumeBusy=false;return;}const id=nextId++;pending.set(id,{resolve:data=>{resumeBusy=false;data=normalizeLobby(data);lobby=data;window.__inkRealtimeLobby?.(data);window.__inkRealtimeReconnected?.(data);},reject:()=>{resumeBusy=false;}});socket.send(JSON.stringify({id,action:'resume',roomCode,playerId,secret}));},350);}};
    socket.onmessage = event => { let msg; try{msg=JSON.parse(event.data)}catch{return}
      if(msg.type==='snapshot'){ latest=msg.data; window.__inkRealtimeSnapshot?.(latest); return; }
      if(msg.type==='kill'){ window.__inkRealtimeKill?.(msg.data); return; }
      if(msg.type==='prop'){ window.__inkRealtimeProp?.(msg.data); return; }
      if(msg.type==='cat'){ window.__inkRealtimeCat?.(msg.data); return; }
      if(msg.type==='reward'){ window.__inkRealtimeReward?.(msg.data); return; }
      if(msg.type==='matchend'){ window.__inkRealtimeMatchEnd?.(msg.data); return; }
      if(msg.type==='lobby'){ lobby=normalizeLobby(msg.data); window.__inkRealtimeLobby?.(lobby); return; }
      if(msg.type==='voice'){ window.__inkRealtimeVoice?.(msg); return; }
      if(msg.type==='rocket'){ window.__inkRealtimeRocket?.(msg); return; }
      const wait=pending.get(msg.id); if(wait){pending.delete(msg.id);msg.error?wait.reject(new Error(msg.error)):wait.resolve(msg.data)}
    };
    socket.onclose = () => { clearInterval(pingTimer);pingTimer=null;lastRtt=null;jitter=0;paintNet(null);socket=null;resumeBusy=false;for(const p of pending.values())p.reject(new Error('Conexão encerrada'));pending.clear();clearTimeout(reconnectTimer);if(localStorage.getItem('inkopsRoomCode')&&playerId&&secret)reconnectTimer=setTimeout(connect,1100); };
  }
  function call(action, payload={}){ return new Promise((resolve,reject)=>{
    connect(); const send=()=>{const id=nextId++;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,action,...payload}));};
    if(socket.readyState===1)send();else socket.addEventListener('open',send,{once:true});
    setTimeout(()=>{for(const [id,p] of pending){if(p.resolve===resolve){pending.delete(id);reject(new Error('Tempo de conexão esgotado'));break}}},5000);
  });}
  window.__inkRealtimeSelfId=()=>playerId;
  window.__inkRealtimeSendVoice=(targetToken,signal)=>call('voice',{targetToken,signal,token:playerId,secret});
  window.__inkRealtimeSendRocket=(data)=>call('rocket',{...data,token:playerId,secret});
  window.fetch = async (input,init={}) => {
    const url=typeof input==='string'?input:input.url;
    if(!url.includes('/api/multiplayer') || (init.method||'GET').toUpperCase()!=='POST') return nativeFetch(input,init);
    let body; try{body=typeof init.body==='string'?JSON.parse(init.body):init.body||{}}catch{return nativeFetch(input,init)}
    const action=body.action;
    const wireBody={...body,token:playerId||body.token,secret:secret||body.secret};
    if(action==='state'){
      try{const data=await call('state',wireBody);return jsonResponse(data)}catch{return jsonResponse(latest||{players:[],scores:{azul:0,vermelho:0},self:{health:100,armor:100,alive:true}},200)}
    }
    try{
      let data;
      if(action==='create'||action==='join') data=await call(action,wireBody);
      else if(action==='heartbeat') data=lobby||await call('heartbeat',wireBody);
      else if(action==='settings'||action==='ready'||action==='team'||action==='start'||action==='leave'||action==='hit'||action==='selfhit'||action==='prop_hit'||action==='hazardhit'||action==='cat_hit'||action==='reward_take'||action==='bedroom_light'||action==='ball_hit') data=await call(action,wireBody);
      else return jsonResponse({error:'Ação não disponível na conexão em tempo real.'},410);
      if(data?.you){playerId=data.you;secret=data.secret||secret;localStorage.setItem('inkopsRealtimePlayer',playerId);localStorage.setItem('inkopsRealtimeSecret',secret)}
      data=normalizeLobby(data);
      if(data?.players&&playerId&&body.token)data.players=data.players.map(p=>p.token===playerId?{...p,token:body.token}:p);
      if(data?.room||data?.players){lobby=data;window.__inkRealtimeLobby?.(lobby)}
      return jsonResponse(data);
    }catch(error){return jsonResponse({error:error.message||'Falha na conexão'},503)}
  };
})();
