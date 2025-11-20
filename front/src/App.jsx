import React, {useEffect, useState, useRef} from 'react'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'
import VoicePanel from './VoicePanel'
import VoiceChannels from './VoiceChannels'
import Auth from './Auth'
import { createWS } from './ws'
import {apiGet, apiPost, apiDelete} from './api'
import { API_URL } from './config'

export default function App(){
  const [auth,setAuth]=useState(()=>{ 
    const token=localStorage.getItem('token'); 
    const user_id=localStorage.getItem('user_id'); 
    const username=localStorage.getItem('username'); 
    
    // Если токен есть, но не начинается с "Bearer ", очищаем localStorage
    if (token && !token.startsWith('Bearer ')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('username');
      return null;
    }
    
    return token && token.startsWith('Bearer ')?{token,user_id,username}:null 
  })
  const [rooms,setRooms]=useState([])
  const [active,setActive]=useState(null)
  const [messages,setMessages]=useState([])
  const [ws,setWs]=useState(null)
  const [connected,setConnected]=useState(false)
  const [userAvatars, setUserAvatars] = useState({})
  const [voiceChannels, setVoiceChannels] = useState([
    { name: 'General' },
    { name: 'Gaming' },
    { name: 'Music' }
  ])
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState(null)
  const [connectedUsers, setConnectedUsers] = useState({})
  const rtcRef = useRef(null)
  const activeRef = useRef(active)
  const currentVoiceChannelRef = useRef(currentVoiceChannel)

  async function loadRooms(){ try{ const r = await apiGet('/api/v1/chats/chat_rooms'); setRooms(r); if(r && r.length>0 && !active) setActive(r[0].id) }catch(e){ console.error('Load rooms error', e) } }
  async function loadMessages(roomId){ 
    if(!roomId) return; 
    try{ 
      const msgs = await apiGet(`/api/v1/chats/chat_rooms/${roomId}/messages`); 
      setMessages(msgs);
      // Загружаем аватары для всех уникальных пользователей
      const uniqueUserIds = [...new Set(msgs.map(m => m.sender_id).filter(Boolean))];
      for(const userId of uniqueUserIds) {
        if(!userAvatars[userId]) {
          loadUserAvatar(userId);
        }
      }
    }catch(e){ console.error('Load messages error', e); } 
  }
  
  async function loadUserAvatar(userId) {
    try {
      const user = await apiGet(`/api/v1/users/${userId}`);
      if(user.avatar) {
        setUserAvatars(prev => ({...prev, [userId]: API_URL + user.avatar}));
      }
    } catch(e) {
      console.warn('Failed to load avatar for user', userId, e);
    }
  }

  useEffect(()=>{ loadRooms() },[])
  useEffect(()=>{ 
    if(active==null) return; 
    activeRef.current = active;
    loadMessages(active);
  },[active])
  
  useEffect(() => {
    currentVoiceChannelRef.current = currentVoiceChannel;
  }, [currentVoiceChannel])

  useEffect(()=>{ 
    if(!auth||!auth.user_id) return;
    console.log('Creating WebSocket connection for user:', auth.user_id);
    
    // Загружаем список подключенных пользователей в голосовых каналах
    async function loadVoiceChannelUsers() {
      try {
        const response = await fetch(`${API_URL}/ws/voice_channels`);
        const data = await response.json();
        console.log('[App] Loaded voice channel users:', JSON.stringify(data.voice_channels, null, 2));
        if(data.voice_channels && Object.keys(data.voice_channels).length > 0) {
          console.log('[App] Found users in channels:', Object.keys(data.voice_channels).map(ch => `${ch}: ${data.voice_channels[ch].length} users`));
        } else {
          console.log('[App] No users in voice channels yet');
        }
        setConnectedUsers(data.voice_channels || {});
      } catch(e) {
        console.warn('[App] Failed to load voice channel users:', e);
      }
    }
    
    const wsInst = createWS(auth.user_id, handleIncoming, ()=>{
      console.log('WebSocket connected');
      setConnected(true);
      // Загружаем список пользователей после подключения
      loadVoiceChannelUsers();
    }, ()=>{
      console.log('WebSocket disconnected');
      setConnected(false);
    }); 
    setWs(wsInst); 
    return ()=>{ 
      console.log('Closing WebSocket connection');
      try{ wsInst.closeConn && wsInst.closeConn() }catch(e){} 
    } 
  },[auth])

  async function handleIncoming(data){ 
    console.log('WebSocket data received:', data);
    
    if(typeof data==='string'){ 
      setMessages(m=>[...m,{id:Date.now(),author:'system',content:data,time:new Date().toLocaleTimeString().slice(0,5),chat_room_id:activeRef.current}]); 
      return;
    } 
    
    // Обработка событий голосовых каналов
    if(data.type === 'voice_channel_join') {
      const { user_id, channel_name } = data.data || {};
      console.log('[App] voice_channel_join event:', { user_id, channel_name, our_user_id: auth?.user_id });
      if(user_id && channel_name) {
        // Приводим к числу для корректного сравнения
        const userId = Number(user_id);
        setConnectedUsers(prev => {
          const currentUsers = prev[channel_name] || [];
          // Проверяем, нет ли уже этого пользователя
          if(currentUsers.some(id => Number(id) === userId)) {
            console.log('[App] User', userId, 'already in channel', channel_name, '- skipping');
            return prev;
          }
          const updated = {
            ...prev,
            [channel_name]: [...currentUsers, userId]
          };
          console.log('[App] Updated connectedUsers:', updated);
          return updated;
        });
      }
      return;
    }
    
    if(data.type === 'voice_channel_leave') {
      const { user_id, channel_name } = data.data || {};
      console.log('[App] voice_channel_leave event:', { user_id, channel_name });
      if(user_id && channel_name) {
        // Приводим к числу для корректного сравнения
        const userId = Number(user_id);
        setConnectedUsers(prev => {
          const updated = {
            ...prev,
            [channel_name]: (prev[channel_name] || []).filter(id => Number(id) !== userId)
          };
          console.log('[App] Updated connectedUsers after leave:', updated);
          return updated;
        });
      }
      return;
    }
    
    if(data.type && (data.type==='offer'||data.type==='answer'||data.type==='candidate')){ 
      console.log('[App] WebRTC signal:', data.type, 'from:', data.sender_id, 'to:', data.receiver_id, 'our_id:', auth?.user_id);
      if(rtcRef.current && rtcRef.current.handleSignal) {
        rtcRef.current.handleSignal({...data,sender_id:data.sender_id});
      } else {
        console.warn('[App] RTC not ready, cannot handle signal');
      }
      return;
    } 
    
    // Проверяем разные форматы сообщений от бэкенда
    if(data.type==='message' && data.data){ 
      const msg = data.data;
      console.log('Message received (type=message, data):', msg);
      
      // Загружаем аватар отправителя, если его еще нет
      if(msg.sender_id && !userAvatars[msg.sender_id]) {
        loadUserAvatar(msg.sender_id);
      }
      
      setMessages(m=>[...m,{ 
        id: msg.id||Date.now(), 
        sender_id: msg.sender_id,
        sender_name: msg.sender_name||('User '+(msg.sender_id||'?')),
        author: msg.sender_name||('User '+(msg.sender_id||'?')), 
        content: msg.content, 
        time: msg.timestamp||new Date().toLocaleTimeString().slice(0,5), 
        chat_room_id: msg.chat_room_id,
        attachments: msg.attachments || []
      }]);
      return;
    }
    
    // Альтернативный формат: сообщение напрямую (без вложенности в data)
    if(data.content && data.chat_room_id){ 
      console.log('Message received (direct format):', data);
      
      // Загружаем аватар отправителя, если его еще нет
      if(data.sender_id && !userAvatars[data.sender_id]) {
        loadUserAvatar(data.sender_id);
      }
      
      setMessages(m=>[...m,{ 
        id: data.id||Date.now(), 
        sender_id: data.sender_id,
        sender_name: data.sender_name||('User '+(data.sender_id||'?')),
        author: data.sender_name||('User '+(data.sender_id||'?')), 
        content: data.content, 
        time: data.timestamp||new Date().toLocaleTimeString().slice(0,5), 
        chat_room_id: data.chat_room_id,
        attachments: data.attachments || []
      }]);
      return;
    }
    
    // Обработка удаления сообщения
    if(data.type === 'message_deleted' && data.data){
      console.log('Message deleted:', data.data);
      setMessages(m => m.filter(msg => msg.id !== data.data.message_id));
      return;
    }
    
    // Обработка прекращения трансляции
    if(data.type === 'stop_sharing' && data.sender_id){
      console.log('Stop sharing signal received from:', data.sender_id);
      // Передаем сигнал в VoicePanel через rtcRef
      if(rtcRef.current && rtcRef.current.handleStopSharing){
        rtcRef.current.handleStopSharing(data.sender_id);
      }
      return;
    }
    
    if(data.type==='join' && data.sender_id){ 
      // Игнорируем свой собственный join сигнал
      if(String(data.sender_id) === String(auth.user_id)) {
        console.log('Ignoring own join signal');
        return;
      }
      
      const ourChannel = currentVoiceChannelRef.current;
      console.log('Join signal received from:', data.sender_id, 'for channel:', data.voice_channel_name, '(we are in:', ourChannel, ')');
      
      // Если у нас есть голосовой канал и это тот же канал, создаем offer
      if(data.voice_channel_name && ourChannel && ourChannel === data.voice_channel_name) {
        console.log('Same channel - creating offer to:', data.sender_id);
        // инициируем оффер к присоединившемуся
        try{ 
          if(rtcRef.current && rtcRef.current.createOfferTo){ 
            await rtcRef.current.createOfferTo(data.sender_id);
          } else {
            console.warn('RTC not ready, cannot create offer');
          }
        }catch(e){
          console.error('Failed to create offer:', e);
        }
      } else {
        console.log('Different channel or not connected - ignoring (our channel:', ourChannel, ', their channel:', data.voice_channel_name, ')');
      }
    }
  }

  async function handleSend(text, files = []){ 
    if(!auth) return;
    
    // Загружаем файлы, если есть
    let attachments = [];
    if(files && files.length > 0){
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      
      try{
        console.log('Uploading files...');
        const response = await fetch(`${API_URL}/api/v1/files/upload`, {
          method: 'POST',
          headers: {
            'Authorization': auth.token
          },
          body: formData
        });
        
        if(!response.ok) {
          throw new Error('Upload failed');
        }
        
        const uploadResult = await response.json();
        attachments = uploadResult.files.map(f => ({
          ...f,
          url: API_URL + f.url // Добавляем базовый URL
        }));
        console.log('Files uploaded:', attachments);
      }catch(e){
        console.error('File upload failed:', e);
        alert('Failed to upload files');
        return;
      }
    }
    
    const payload = { 
      content: text, 
      receiver_id: 0, 
      chat_room_id: active,
      attachments: attachments.length > 0 ? attachments : undefined
    };
    
    const tempId = 'temp-' + Date.now();
    
    setMessages(m=>[...m,{ 
      id: tempId, 
      sender_name: auth?.username || 'You',
      sender_id: auth?.user_id,
      content: text, 
      time: new Date().toLocaleTimeString().slice(0,5), 
      chat_room_id: active,
      attachments: attachments
    }]);
    
    try{ 
      console.log('Sending message via API:', payload);
      const result = await apiPost('/api/v1/chats/messages', payload);
      console.log('Message sent, API response:', result);
      
      // Удаляем временное сообщение - реальное придет через WebSocket
      setMessages(m => m.filter(msg => msg.id !== tempId));
    }catch(e){ 
      console.error('Send message failed', e);
      // Удаляем оптимистично добавленное сообщение при ошибке
      setMessages(m => m.filter(msg => msg.id !== tempId));
      alert('Failed to send message');
    }
  }

  async function addRoom(){ const name = prompt('Room name'); if(!name) return; const body = { name, description: '' }; try{ const created = await apiPost('/api/v1/chats/chat_rooms', body); await loadRooms(); setActive(created.id); await loadMessages(created.id); }catch(e){ console.error('Create room failed', e); alert('Create room failed: '+(e.message||'')) } }

  async function deleteMessage(messageId){
    if(!confirm('Delete this message?')) return;
    try{
      await apiDelete(`/api/v1/chats/messages/${messageId}`);
      // Удаляем сообщение из локального состояния
      setMessages(m => m.filter(msg => msg.id !== messageId));
    }catch(e){
      console.error('Delete message failed', e);
      alert('Failed to delete message: ' + (e.message || ''));
    }
  }

  function handleJoinVoiceChannel(channelName) {
    // Добавляем канал если его еще нет
    if(!voiceChannels.find(ch => ch.name === channelName)) {
      setVoiceChannels(prev => [...prev, { name: channelName }]);
    }
    
    console.log('Setting current voice channel to:', channelName);
    setCurrentVoiceChannel(channelName);
    
    // Отправляем событие через WebSocket
    try {
      ws && ws.sendJSON && ws.sendJSON({
        type: 'voice_channel_join',
        data: { user_id: auth.user_id, channel_name: channelName }
      });
    } catch(e) {
      console.warn('Failed to send voice_channel_join', e);
    }
  }
  
  function handleLeaveVoiceChannel() {
    if(!currentVoiceChannel) return;
    
    // Отправляем событие через WebSocket
    try {
      ws && ws.sendJSON && ws.sendJSON({
        type: 'voice_channel_leave',
        data: { user_id: auth.user_id, channel_name: currentVoiceChannel }
      });
    } catch(e) {
      console.warn('Failed to send voice_channel_leave', e);
    }
    
    setCurrentVoiceChannel(null);
  }

  async function deleteRoom(roomId){
    if(!confirm('Delete this channel? This action cannot be undone.')) return;
    try{
      await apiDelete(`/api/v1/chats/chat_rooms/${roomId}`);
      await loadRooms();
      // Переключаемся на первую доступную комнату
      if(rooms.length > 1){
        const newActive = rooms.find(r => r.id !== roomId);
        if(newActive) setActive(newActive.id);
      }
    }catch(e){
      console.error('Delete room failed', e);
      alert('Failed to delete channel: ' + (e.message || ''));
    }
  }

  function logout(){ localStorage.removeItem('token'); localStorage.removeItem('user_id'); setAuth(null); if(ws) ws.close(); setWs(null); }

  if(!auth || !auth.token || !auth.user_id) {
    return <Auth onAuth={(a)=>setAuth(a)} />
  }

  return (
    <div className="app">
      <Sidebar rooms={rooms} active={active} onSelect={setActive} onAdd={addRoom} onDelete={deleteRoom} currentUserId={auth.user_id}>
        <VoiceChannels 
          voiceChannels={voiceChannels}
          currentVoiceChannel={currentVoiceChannel}
          onJoinChannel={handleJoinVoiceChannel}
          onLeaveChannel={handleLeaveVoiceChannel}
          connectedUsers={connectedUsers}
          userAvatars={userAvatars}
        />
      </Sidebar>
      <div className="main">
        <div className="header"><div>#{rooms.find(r=>r.id===active)?.name||active} <span style={{color:'var(--muted)',marginLeft:8}}>{connected? 'Online':'Offline'}</span></div><div style={{display:'flex',gap:8,alignItems:'center'}}><div className='small'>@{auth.username || auth.user_id}</div><button className='btn' onClick={logout}>Logout</button></div></div>
      <div className="container"><ChatWindow room={active} messages={messages} onSend={handleSend} onDeleteMessage={deleteMessage} currentUserId={auth.user_id} userAvatars={userAvatars} /><VoicePanel ws={ws} auth={auth} activeRoom={currentVoiceChannel} onRtcReady={(r)=>{ rtcRef.current = r }} onLeave={handleLeaveVoiceChannel} /></div>
      </div>
    </div>
  )
}
