/* Ponte entre o FPS existente e o servidor WebSocket V71. */
(() => {
  const NativeResponse = window.Response;
  const nativeFetch = window.fetch.bind(window);
  let socket = null, nextId = 1, pending = new Map(), lobby = null, latest = null;
  let playerId = localStorage.getItem('inkopsRealtimePlayer') || '';
  let secret = localStorage.getItem('inkopsRealtimeSecret') || '';
  const base = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/realtime`;
  const jsonResponse = (value,status=200) => new NativeResponse(JSON.stringify(value), {status,headers:{'Content-Type':'application/json'}});
  function connect(){
    if(socket && socket.readyState <= 1) return;
    socket = new WebSocket(base);
    socket.onmessage = event => { let msg; try{msg=JSON.parse(event.data)}catch{return}
      if(msg.type==='snapshot'){ latest=msg.data; window.__inkRealtimeSnapshot?.(latest); return; }
      if(msg.type==='kill'){ window.__inkRealtimeKill?.(msg.data); return; }
      if(msg.type==='prop'){ window.__inkRealtimeProp?.(msg.data); return; }
      if(msg.type==='cat'){ window.__inkRealtimeCat?.(msg.data); return; }
      if(msg.type==='reward'){ window.__inkRealtimeReward?.(msg.data); return; }
      if(msg.type==='matchend'){ window.__inkRealtimeMatchEnd?.(msg.data); return; }
      if(msg.type==='lobby'){ lobby=msg.data; window.__inkRealtimeLobby?.(lobby); return; }
      if(msg.type==='voice'){ window.__inkRealtimeVoice?.(msg); return; }
      if(msg.type==='rocket'){ window.__inkRealtimeRocket?.(msg); return; }
      const wait=pending.get(msg.id); if(wait){pending.delete(msg.id);msg.error?wait.reject(new Error(msg.error)):wait.resolve(msg.data)}
    };
    socket.onclose = () => { socket=null; for(const p of pending.values())p.reject(new Error('Conexão encerrada')); pending.clear(); };
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
      else if(action==='settings'||action==='start'||action==='leave'||action==='hit'||action==='selfhit'||action==='prop_hit'||action==='hazardhit'||action==='cat_hit'||action==='reward_take') data=await call(action,wireBody);
      else return jsonResponse({error:'Ação não disponível na conexão em tempo real.'},410);
      if(data?.you){playerId=data.you;secret=data.secret||secret;localStorage.setItem('inkopsRealtimePlayer',playerId);localStorage.setItem('inkopsRealtimeSecret',secret)}
      if(data?.players&&playerId&&body.token)data.players=data.players.map(p=>p.token===playerId?{...p,token:body.token}:p);
      if(data?.room||data?.players){lobby=data;window.__inkRealtimeLobby?.(lobby)}
      return jsonResponse(data);
    }catch(error){return jsonResponse({error:error.message||'Falha na conexão'},503)}
  };
})();
