export function createWS(userId, onMessage, onOpen, onClose){
  // Автоматически определяем хост из текущего URL или используем переменную окружения
  let base;
  if (import.meta.env.VITE_WS_URL) {
    base = import.meta.env.VITE_WS_URL;
  } else {
    // Используем текущий хост для WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    base = `${protocol}//${host}:8000/ws`;
  }
  const url = base + '/' + encodeURIComponent(userId);
  let ws = null;
  let shouldReconnect = true;
  let reconnectTimeout = 1000;

  function connect(){
    ws = new WebSocket(url);
    ws.addEventListener('open', ()=>{ reconnectTimeout = 1000; onOpen && onOpen(); console.log('WS open', url) });
    ws.addEventListener('message', ev=>{ 
      console.log('WS raw message:', ev.data);
      let d = ev.data; 
      try{ 
        d = JSON.parse(ev.data);
        console.log('WS parsed message:', d);
      }catch(e){
        console.warn('WS parse error:', e);
      } 
      onMessage && onMessage(d);
    });
    ws.addEventListener('close', ()=>{ onClose && onClose(); if(shouldReconnect){ setTimeout(()=>{ reconnectTimeout = Math.min(30000, reconnectTimeout*1.5); connect() }, reconnectTimeout) } })
    ws.sendJSON = obj => { try{ ws && ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(obj)) }catch(e){ console.error(e) } }
    ws.closeConn = ()=>{ shouldReconnect=false; try{ ws.close() }catch(e){} }
  }
  connect();
  return ws;
}
