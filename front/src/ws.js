export function createWS(userId, onMessage, onOpen, onClose){
  let base;
  
  // 1. Если задана переменная окружения (из Docker)
  if (import.meta.env.VITE_WS_URL) {
    base = import.meta.env.VITE_WS_URL;
  } else {
    // 2. Определяем протокол (ws или wss)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;

    // 3. ЛОГИКА ВЫБОРА АДРЕСА
    if (host === 'localhost' || host === '127.0.0.1') {
      // Локальная разработка: стучимся напрямую в бэк
      base = `${protocol}//${host}:8000/ws`;
    } else {
      // Продакшен (Mancinella.ru):
      // Стучимся в Nginx (порт 443 скрыт), но добавляем префикс /api
      // Nginx увидит /api/ws..., отрежет /api/ и отправит на бэк в /ws...
      base = `${protocol}//${window.location.host}/api/ws`;
    }
  }

  // Собираем итоговый URL
  // base уже содержит /ws, добавляем ID пользователя
  const url = base + '/' + encodeURIComponent(userId);
  
  console.log('Connecting WS to:', url); // Полезно для отладки

  let ws = null;
  let shouldReconnect = true;
  let reconnectTimeout = 1000;

  function connect(){
    ws = new WebSocket(url);
    ws.addEventListener('open', ()=>{ reconnectTimeout = 1000; onOpen && onOpen(); console.log('WS open', url) });
    ws.addEventListener('message', ev=>{ 
      // console.log('WS raw message:', ev.data); // Можно раскомментить для отладки
      let d = ev.data; 
      try{ 
        d = JSON.parse(ev.data);
        // console.log('WS parsed message:', d);
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
