import React, {useState, useRef, useEffect} from 'react'
import { createRTC } from './webrtc'
import { API_URL } from './config'

function playJoinTone(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  }catch(e){ console.warn('playJoinTone failed', e) }
}

function playLeaveTone(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 400;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  }catch(e){ console.warn('playLeaveTone failed', e) }
}

function playStreamStartTone(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Двойной звук для начала стрима
    [600, 900].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      const startTime = ctx.currentTime + (i * 0.1);
      osc.start(startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      osc.stop(startTime + 0.2);
    });
  }catch(e){ console.warn('playStreamStartTone failed', e) }
}

function playStreamStopTone(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Нисходящий звук для завершения стрима
    [700, 500].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      const startTime = ctx.currentTime + (i * 0.1);
      osc.start(startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      osc.stop(startTime + 0.2);
    });
  }catch(e){ console.warn('playStreamStopTone failed', e) }
}

function playMuteTone(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 300;
    gain.gain.value = 0.06;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  }catch(e){ console.warn('playMuteTone failed', e) }
}

function playUnmuteTone(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 550;
    gain.gain.value = 0.06;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  }catch(e){ console.warn('playUnmuteTone failed', e) }
}

function playMessageTone(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.stop(ctx.currentTime + 0.2);
  }catch(e){ console.warn('playMessageTone failed', e) }
}

export { playMessageTone };

export default function VoicePanel({ws, auth, onRemoteStream, activeRoom, onRtcReady, onLeave}){
  // All hooks must be called before any early returns
  const [rtc, setRtc] = useState(null)
  const localAudioRef = useRef()
  const avatarInputRef = useRef()
  const prevActiveRoomRef = useRef(null)
  const [muted, setMuted] = useState(false)
  const [joined, setJoined] = useState(false)
  const [remoteStreams,setRemoteStreams] = useState([]) // [{peerId, stream}]
  const [focusedPeerId,setFocusedPeerId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [isSharing, setIsSharing] = useState(false)
  const [peerNames, setPeerNames] = useState({})

  useEffect(()=>{ 
    // Загружаем аватар пользователя
    if(auth?.user_id) {
      fetch(`${API_URL}/api/v1/users/me`, {
        headers: { 'Authorization': auth.token }
      })
      .then(res => res.json())
      .then(user => {
        if(user.avatar) {
          setAvatarUrl(API_URL + user.avatar);
        }
      })
      .catch(e => console.warn('Failed to load user avatar:', e));
    }
  }, [auth]);

  useEffect(()=>{ 
    if(!ws) return; 
    // Wrap onRemoteStream to capture and render tiles locally while still notifying parent if needed
    const handleRemote = (peerId, stream)=>{
      const videoTracks = stream.getVideoTracks().length;
      const audioTracks = stream.getAudioTracks().length;
      console.log('Remote stream received:', peerId, 'Video tracks:', videoTracks, 'Audio tracks:', audioTracks);
      
      // Загружаем имя пользователя, если его еще нет
      if(!peerNames[peerId]) {
        fetch(`${API_URL}/api/v1/users/${peerId}`, {
          headers: { 'Authorization': auth.token }
        })
        .then(res => res.json())
        .then(user => {
          setPeerNames(prev => ({...prev, [peerId]: user.username}));
        })
        .catch(e => console.warn('Failed to load username for peer', peerId, e));
      }
      
      setRemoteStreams(prev=>{
        const exists = prev.some(p=>String(p.peerId)===String(peerId))
        if(exists) {
          console.log('Updating existing stream for peer', peerId, '- video:', videoTracks, 'audio:', audioTracks);
        } else {
          console.log('Adding new stream for peer', peerId, '- video:', videoTracks, 'audio:', audioTracks);
          
          // Слушаем удаление треков из потока
          stream.addEventListener('removetrack', (e) => {
            console.log('Track removed from peer', peerId, '- kind:', e.track.kind);
            // Форсируем обновление UI
            setRemoteStreams(prev => [...prev]);
          });
        }
        const next = exists ? prev.map(p=>String(p.peerId)===String(peerId)?{peerId,stream}:p) : [...prev,{peerId,stream}]
        // Автофокус только на потоки с видео
        if(focusedPeerId==null && videoTracks > 0) setFocusedPeerId(peerId)
        return next
      })
      try{ onRemoteStream && onRemoteStream(peerId, stream) }catch(e){ /* ignore */ }
    }
    const r = createRTC({ ws, localAudioEl: localAudioRef.current, onRemoteStream: handleRemote, localUserId: auth?.user_id }); 
    setRtc(r);
    
    // Добавляем функцию для обработки прекращения трансляции
    r.handleStopSharing = (peerId) => {
      console.log('Stop sharing signal for peer:', peerId);
      
      // Сбрасываем фокус если он был на этом пользователе
      if(String(focusedPeerId) === String(peerId)) {
        setFocusedPeerId(null);
      }
      
      // Находим поток и принудительно удаляем из него видео-треки
      setRemoteStreams(prev => {
        return prev.map(s => {
          if(String(s.peerId) === String(peerId)) {
            const videoTracks = s.stream.getVideoTracks();
            const audioTracks = s.stream.getAudioTracks();
            console.log('Removing', videoTracks.length, 'video tracks from peer', peerId, '- keeping', audioTracks.length, 'audio tracks');
            
            // Останавливаем видео-треки
            videoTracks.forEach(track => {
              track.stop();
            });
            
            // Если есть аудио, создаем новый поток только с аудио
            if(audioTracks.length > 0) {
              const newStream = new MediaStream(audioTracks);
              console.log('Created new audio-only stream for peer', peerId);
              return {peerId, stream: newStream};
            }
            
            // Если нет аудио, помечаем для удаления
            return null;
          }
          return s;
        }).filter(Boolean); // Удаляем null элементы
      });
      
      // Форсируем еще одно обновление через задержку на случай если треки не удалились сразу
      setTimeout(() => {
        console.log('Final stream update check for peer:', peerId);
        setRemoteStreams(prev => [...prev]);
      }, 100);
    };
    
    try{ onRtcReady && onRtcReady(r) }catch(e){}
    return ()=>{ r.closeAll(); setRemoteStreams([]); setFocusedPeerId(null); }
  },[ws])
  
  // Автоматически подключаться к голосовому каналу при его выборе
  useEffect(() => {
    console.log('[VoicePanel] useEffect triggered - activeRoom:', activeRoom, 'rtc:', !!rtc, 'ws:', !!ws);
    
    if(!activeRoom || !rtc || !ws) {
      console.log('[VoicePanel] Skipping auto-join - missing dependencies');
      return;
    }
    
    // Проверяем, действительно ли канал изменился
    if(prevActiveRoomRef.current === activeRoom) {
      console.log('[VoicePanel] Channel unchanged, skipping');
      return;
    }
    
    const wasConnected = prevActiveRoomRef.current !== null;
    console.log('[VoicePanel] Voice channel changed from', prevActiveRoomRef.current, 'to:', activeRoom, 'wasConnected:', wasConnected);
    
    // Функция подключения к голосовому каналу
    async function joinVoiceChannel(){
      if(!rtc) return;
      try{
        console.log('[VoicePanel] Joining voice channel:', activeRoom);
        const stream = await rtc.startLocalAudio();
        console.log('[VoicePanel] Local audio stream started:', stream ? stream.getTracks().map(t => t.kind) : 'null');
        setJoined(true);
        setMuted(false);
        
        // КРИТИЧЕСКИ ВАЖНО: Увеличенная задержка чтобы локальный поток был точно готов
        // и треки были добавлены ко всем существующим peer-соединениям
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // send join signal via WS so peers can create offers
        console.log('[VoicePanel] Sending join signal for channel:', activeRoom);
        try{ 
          ws && ws.sendJSON && ws.sendJSON({ 
            type: 'join', 
            sender_id: auth.user_id, 
            voice_channel_name: activeRoom 
          }) 
        }catch(e){ 
          console.warn('ws send join failed', e) 
        }
        playJoinTone();
      }catch(e){ 
        console.error('[VoicePanel] joinVoice failed', e); 
        alert('Microphone access required') 
      }
    }
    
    // Если переключаемся с одного канала на другой
    if(wasConnected) {
      console.log('[VoicePanel] Switching channels - leaving old channel:', prevActiveRoomRef.current);
      
      // Отправляем сигнал об уходе из старого канала
      try {
        ws && ws.sendJSON && ws.sendJSON({
          type: 'voice_channel_leave',
          data: { user_id: auth.user_id, channel_name: prevActiveRoomRef.current }
        });
        console.log('[VoicePanel] Sent leave signal for channel:', prevActiveRoomRef.current);
      } catch(e) {
        console.warn('[VoicePanel] Failed to send voice_channel_leave', e);
      }
      
      // Очищаем старые соединения
      if(rtc.clearPeers) {
        rtc.clearPeers();
      }
      if(rtc.stopLocalStreams) {
        rtc.stopLocalStreams();
      }
      setRemoteStreams([]);
      setFocusedPeerId(null);
      setPeerNames({}); // Очищаем имена пользователей
      setJoined(false);
      setIsSharing(false);
      
      // Подключаемся к новому каналу с задержкой
      setTimeout(() => {
        prevActiveRoomRef.current = activeRoom;
        joinVoiceChannel();
      }, 300);
    } else {
      // Первое подключение
      prevActiveRoomRef.current = activeRoom;
      joinVoiceChannel();
    }
  }, [activeRoom, rtc, ws, auth])

  // Если нет активной комнаты (голосового канала), не показываем панель
  if(!activeRoom) {
    return (
      <div className="voice-panel" style={{padding: 20, textAlign: 'center', color: 'var(--muted)'}}>
        <div style={{fontSize: 48, marginBottom: 12}}>🎙️</div>
        <div style={{fontSize: 14, marginBottom: 8}}>No voice channel selected</div>
        <div style={{fontSize: 12}}>Join a voice channel from the sidebar</div>
      </div>
    )
  }

  async function shareScreen(){ 
    try{ 
      console.log('[VoicePanel] Starting screen share...');
      const s = await rtc.startScreen(); 
      if(s){
        console.log('[VoicePanel] Screen share started, sending join signal...');
        setIsSharing(true);
        playStreamStartTone();
        // триггерим офферы всем известным пирами через сигналинг: посылаем broadcast join
        try{ 
          ws && ws.sendJSON && ws.sendJSON({ 
            type: 'join', 
            sender_id: auth.user_id, 
            voice_channel_name: activeRoom 
          }) 
        }catch(e){ 
          console.warn('[VoicePanel] Failed to send join signal after screen share', e) 
        }
      }
    }catch(e){ 
      console.error('[VoicePanel] Screen share failed:', e) 
    }
  }
  
  async function stopSharing(){
    if(!rtc) return;
    console.log('Stopping screen share...');
    await rtc.stopScreenShare();
    setIsSharing(false);
    playStreamStopTone();
    
    // Отправляем сигнал о прекращении трансляции
    try{ 
      ws && ws.sendJSON && ws.sendJSON({ 
        type: 'stop_sharing', 
        sender_id: auth.user_id, 
        voice_channel_name: activeRoom 
      }) 
    }catch(e){ 
      console.warn('Failed to send stop_sharing signal', e) 
    }
  }
  function toggleMute(){ 
    if(!rtc) return;
    const isMuted = rtc.toggleMute();
    console.log('Toggle mute result:', isMuted);
    // isMuted может быть true (muted) или false (unmuted), обновляем в любом случае
    if(typeof isMuted === 'boolean') {
      setMuted(isMuted);
      // Воспроизводим соответствующий звук
      if(isMuted) {
        playMuteTone();
      } else {
        playUnmuteTone();
      }
    }
  }
  
  function leave(){ 
    if(!rtc) return;
    console.log('[VoicePanel] Leaving voice channel...');
    
    // Останавливаем демонстрацию экрана если она активна
    if(isSharing) {
      rtc.stopScreenShare && rtc.stopScreenShare();
      setIsSharing(false);
    }
    
    rtc.closeAll();
    setJoined(false);
    setMuted(false);
    setRemoteStreams([]);
    setPeerNames({});
    setFocusedPeerId(null);
    prevActiveRoomRef.current = null; // Сбрасываем ref при выходе
    playLeaveTone();
    
    // Вызываем callback для обновления состояния в App
    if(onLeave) {
      onLeave();
    }
    
    console.log('[VoicePanel] Left voice channel');
  }
  
  async function uploadAvatar(file){
    if(!file) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try{
      const response = await fetch(`${API_URL}/api/v1/files/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': auth.token
        },
        body: formData
      });
      
      if(!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      console.log('Avatar uploaded:', result);
      setAvatarUrl(API_URL + result.avatar_url);
      alert('Avatar uploaded successfully!');
    }catch(e){
      console.error('Avatar upload failed:', e);
      alert('Failed to upload avatar');
    }finally{
      setUploading(false);
    }
  }

  return (
    <div className="panel">
      <div className="user">
        <div className="avatar" style={{cursor:'pointer',backgroundImage:avatarUrl?`url(${avatarUrl})`:'none',backgroundSize:'cover',backgroundPosition:'center'}} onClick={()=>avatarInputRef.current?.click()} title="Change avatar">
          {!avatarUrl && 'ME'}
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700}}>{auth?.username || 'You'}</div>
          <div className="small">@{auth?.username || auth?.user_id}</div>
          <input 
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{display:'none'}}
            onChange={(e)=>{
              const file = e.target.files?.[0];
              if(file) uploadAvatar(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>
          Voice / Screen
          {joined && <span style={{marginLeft:8,fontSize:11,color:'var(--success)'}}>● Connected</span>}
        </div>
        <div className="controls">
          <button className="btn" onClick={toggleMute} disabled={!joined}>
            {muted ? '🔇 Unmute' : '🔊 Mute'}
          </button>
          <button className="btn" onClick={shareScreen} disabled={isSharing}>
            🖥 {isSharing ? 'Sharing...' : 'Share Screen'}
          </button>
          <button className="btn" onClick={stopSharing} disabled={!isSharing}>
            ⏹ Stop Sharing
          </button>
          <button className="btn" onClick={leave} disabled={!joined}>
            🚪 Leave
          </button>
        </div>
        <audio ref={localAudioRef} autoPlay muted />
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>
          Remote
          {remoteStreams.length > 0 && (
            <span style={{marginLeft:8,fontSize:11,color:'var(--muted)',fontWeight:400}}>
              ({remoteStreams.length} connected)
            </span>
          )}
        </div>
        
        {/* Список подключённых пользователей (только аудио) */}
        {remoteStreams.filter(({stream}) => stream.getVideoTracks().length === 0).length > 0 && (
          <div style={{marginBottom:8,padding:8,background:'rgba(255,255,255,0.02)',borderRadius:8}}>
            <div className="small" style={{marginBottom:4,color:'var(--muted)'}}>🎤 Voice only:</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
              {remoteStreams.filter(({stream}) => stream.getVideoTracks().length === 0).map(({peerId, stream})=>(
                <div key={peerId} className="small" style={{padding:'4px 8px',background:'rgba(88,101,242,0.15)',borderRadius:6,color:'var(--text)'}}>
                  {peerNames[peerId] || `User ${peerId}`}
                  {/* Аудио-элемент для воспроизведения удалённого аудио */}
                  <audio 
                    autoPlay
                    muted={false}
                    playsInline
                    ref={el => {
                      if(el && el.srcObject !== stream) {
                        console.log('Setting audio srcObject for peer', peerId);
                        el.srcObject = stream;
                        el.muted = false; // Убедимся что не muted
                        el.volume = 1.0; // Максимальная громкость
                        el.play().catch(e => console.warn('Audio play failed for peer', peerId, ':', e));
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="rooms-list" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12}}>
          {remoteStreams.filter(({stream}) => stream.getVideoTracks().length > 0).length === 0 && (
            <div className="small" style={{gridColumn:'1/-1', textAlign:'center', padding:'20px', color:'rgba(255,255,255,0.5)'}}>Screen shares will appear here</div>
          )}
          {remoteStreams.map(({peerId,stream})=>{
            const isFocused = String(focusedPeerId)===String(peerId)
            const videoTracks = stream.getVideoTracks();
            const hasVideo = videoTracks.length > 0
            console.log('Rendering peer', peerId, '- hasVideo:', hasVideo, 'videoTracks:', videoTracks.length);
            // Показываем плитки только для потоков с видео (демонстрация экрана)
            if(!hasVideo) return null;
            return (
              <div key={`${peerId}-${videoTracks.length}`} style={{position:'relative', cursor:'pointer', border:isFocused?'2px solid var(--primary)':'1px solid rgba(255,255,255,0.08)', borderRadius:8, overflow:'hidden', background:'#000'}} onClick={()=>setFocusedPeerId(peerId)}>
                <video 
                  autoPlay 
                  playsInline 
                  controls={false}
                  style={{ width:'100%', height: isFocused? 280: hasVideo ? 150 : 90, objectFit:'contain', background:'#000', display:'block' }}
                  ref={el=>{ 
                    if(el && el.srcObject!==stream){ 
                      console.log('Setting srcObject for peer', peerId, 'stream:', stream, 'tracks:', stream.getTracks().map(t=>t.kind));
                      el.srcObject = stream;
                      el.onloadedmetadata = () => {
                        console.log('Video metadata loaded for peer', peerId, 'videoWidth:', el.videoWidth, 'videoHeight:', el.videoHeight);
                      };
                      el.onloadeddata = () => {
                        console.log('Video data loaded for peer', peerId);
                      };
                      el.play().then(() => {
                        console.log('Video playing for peer', peerId);
                      }).catch(e=>console.warn('Video play failed for peer', peerId, ':', e));
                    } 
                  }}
                />
                <div className="small" style={{position:'absolute', bottom:6, left:8, background:'rgba(0,0,0,0.7)', padding:'4px 8px', borderRadius:6, color:'#fff'}}>
                  {hasVideo ? '🖥 ' : '🎤 '}{peerNames[peerId] || `User ${peerId}`}
                </div>
              </div>
            )
          })}
        </div>
        {focusedPeerId!=null && (() => {
          // Проверяем, есть ли у focused пира видео-треки
          const focusedStream = remoteStreams.find(s=>String(s.peerId)===String(focusedPeerId));
          const hasVideo = focusedStream && focusedStream.stream.getVideoTracks().length > 0;
          
          // Если нет видео, сбрасываем фокус
          if(!hasVideo) {
            setTimeout(() => setFocusedPeerId(null), 0);
            return null;
          }
          
          return (
            <div style={{marginTop:10, border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:8}}>
              <div className="small" style={{marginBottom:6, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <span>Focused</span>
                <button className="btn" onClick={()=>setFocusedPeerId(null)}>Close</button>
              </div>
              <video 
                key={'focus-'+focusedPeerId} 
                autoPlay 
                playsInline 
                controls 
                style={{ width:'100%', maxHeight:380, background:'#000' }} 
                ref={el=>{ 
                  if(el && el.srcObject!==focusedStream.stream){ 
                    el.srcObject = focusedStream.stream;
                    el.play().catch(e=>console.warn('Focused video play failed:', e));
                  } 
                }} 
              />
            </div>
          );
        })()}
      </div>
    </div>
  )
}
