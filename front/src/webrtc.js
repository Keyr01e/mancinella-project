const CONFIG = { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] };
export function createRTC({ ws, localAudioEl=null, onRemoteStream, localUserId }){
  const peers = {};
  let localStream = null;
  let screenStream = null;
  function ensurePeer(peerId){
    if(peers[peerId]) {
      console.log('[WebRTC] Peer already exists:', peerId);
      return peers[peerId];
    }
    console.log('[WebRTC] Creating new peer connection for:', peerId, '- localStream:', !!localStream, 'screenStream:', !!screenStream);
    const pc = new RTCPeerConnection(CONFIG);
    peers[peerId]=pc;
    pc.onicecandidate = e => { if(e.candidate){ ws && ws.send(JSON.stringify({ type:'candidate', data: e.candidate, receiver_id: peerId, sender_id: localUserId })) } };
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state for peer', peerId, ':', pc.iceConnectionState);
    };
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state for peer', peerId, ':', pc.connectionState);
    };
    pc.onnegotiationneeded = async () => {
      console.log('[WebRTC] Negotiation needed for peer', peerId);
      // Автоматическая renegotiation будет обработана через startScreen
    };
    // Храним накопленный поток для каждого пира
    if(!pc.accumulatedStream) {
      pc.accumulatedStream = new MediaStream();
    }
    
    pc.ontrack = e => { 
      console.log('ontrack event from peer', peerId, 'streams:', e.streams.length, 'track:', e.track.kind, 'readyState:', e.track.readyState);
      
      // Очищаем ended треки перед добавлением нового
      const endedTracks = pc.accumulatedStream.getTracks().filter(t => t.readyState === 'ended');
      if(endedTracks.length > 0) {
        console.log('Removing', endedTracks.length, 'ended tracks from peer', peerId);
        endedTracks.forEach(t => pc.accumulatedStream.removeTrack(t));
      }
      
      // Проверяем, нет ли уже трека такого же типа
      const existingTrack = pc.accumulatedStream.getTracks().find(t => t.kind === e.track.kind && t.id !== e.track.id);
      if(existingTrack) {
        console.log('Replacing existing', e.track.kind, 'track');
        pc.accumulatedStream.removeTrack(existingTrack);
      }
      
      // Добавляем трек к накопленному потоку если его еще нет
      if(!pc.accumulatedStream.getTracks().find(t => t.id === e.track.id)) {
        pc.accumulatedStream.addTrack(e.track);
        console.log('Track added to accumulated stream. Total tracks:', pc.accumulatedStream.getTracks().map(t => ({kind: t.kind, id: t.id, readyState: t.readyState})));
        
        // Слушаем событие окончания трека
        e.track.onended = () => {
          console.log('Track ended:', e.track.kind, 'from peer', peerId);
          pc.accumulatedStream.removeTrack(e.track);
          // Уведомляем об обновлении потока
          onRemoteStream && onRemoteStream(peerId, pc.accumulatedStream);
        };
      }
      
      // Отправляем накопленный поток
      onRemoteStream && onRemoteStream(peerId, pc.accumulatedStream);
    };
    // Добавляем локальные аудио-треки
    if(localStream) {
      console.log('[WebRTC] Adding local stream tracks to new peer', peerId, '- tracks:', localStream.getTracks().map(t => ({kind: t.kind, id: t.id, enabled: t.enabled})));
      for(const t of localStream.getTracks()) {
        try {
          const sender = pc.addTrack(t, localStream);
          console.log('[WebRTC] Local track added:', t.kind, 'to peer', peerId);
        } catch(e) {
          console.error('[WebRTC] Failed to add local track to peer', peerId, ':', e);
        }
      }
    } else {
      console.warn('[WebRTC] No local stream available when creating peer', peerId);
    }
    
    // Добавляем треки демонстрации экрана, если они есть
    if(screenStream) {
      console.log('[WebRTC] Adding screen stream tracks to new peer', peerId, '- tracks:', screenStream.getTracks().map(t => ({kind: t.kind, id: t.id})));
      for(const t of screenStream.getTracks()) {
        try {
          const stream = localStream || screenStream;
          const sender = pc.addTrack(t, stream);
          console.log('[WebRTC] Screen track added:', t.kind, 'to peer', peerId);
        } catch(e) {
          console.error('[WebRTC] Failed to add screen track to peer', peerId, ':', e);
        }
      }
    }
    
    return pc;
  }
  async function startLocalAudio(){ 
    if(localStream) {
      console.log('Local audio stream already exists');
      return localStream;
    }
    
    console.log('Starting local audio...');
    localStream = await navigator.mediaDevices.getUserMedia({ audio:true }); 
    
    if(localAudioEl){ 
      localAudioEl.srcObject = localStream; 
      localAudioEl.muted=true; 
      await localAudioEl.play().catch(()=>{});
    }
    
    // Добавляем треки к существующим peer connections
    const peerEntries = Object.entries(peers);
    console.log('Adding audio tracks to', peerEntries.length, 'peers');
    
    for(const [peerId, pc] of peerEntries) {
      for(const t of localStream.getTracks()) {
        try {
          pc.addTrack(t, localStream);
          console.log('Audio track added to peer', peerId);
        } catch(e) {
          console.warn('Failed to add audio track to peer', peerId, ':', e);
        }
      }
      
      // Создаём новый оффер для renegotiation
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws && ws.send(JSON.stringify({ type:'offer', data: pc.localDescription, receiver_id: peerId, sender_id: localUserId }));
        console.log('Renegotiation offer sent to peer', peerId);
      } catch(e) {
        console.warn('Failed to renegotiate with peer', peerId, ':', e);
      }
    }
    
    return localStream;
  }
  async function startScreen(){ 
    console.log('[WebRTC] Starting screen share...');
    const s = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true }).catch((e)=>{
      console.error('[WebRTC] getDisplayMedia failed:', e);
      return null;
    }); 
    if(!s) return null;
    screenStream = s; // Сохраняем ссылку для последующей остановки
    console.log('[WebRTC] Screen stream obtained, tracks:', s.getTracks().map(t => ({kind: t.kind, id: t.id, enabled: t.enabled})));
    const peerEntries = Object.entries(peers);
    console.log('[WebRTC] Adding screen tracks to', peerEntries.length, 'peers:', peerEntries.map(([id])=>id));
    
    for(const [peerId, pc] of peerEntries) {
      console.log('[WebRTC] Processing peer', peerId);
      
      // Проверяем существующие senders
      const senders = pc.getSenders();
      const existingVideoSender = senders.find(s => s.track && s.track.kind === 'video');
      
      console.log('[WebRTC] Peer', peerId, 'has video sender:', !!existingVideoSender);
      
      for(const track of s.getTracks()) {
        try {
          // ВАЖНО: Добавляем только ВИДЕО из screenStream
          // Аудио с микрофона уже передается из localStream
          if(track.kind === 'video') {
            if(existingVideoSender) {
              console.log('[WebRTC] Replacing existing video track for peer', peerId);
              await existingVideoSender.replaceTrack(track);
            } else {
              // Добавляем новый видео-трек
              pc.addTrack(track, s);
              console.log('[WebRTC] Added video track to peer', peerId);
            }
          } else if(track.kind === 'audio') {
            // Игнорируем системное аудио из screenStream
            // Оставляем аудио с микрофона из localStream
            console.log('[WebRTC] Skipping system audio from screen share - keeping microphone audio');
          }
        } catch(e) {
          console.error('[WebRTC] Failed to add/replace track to peer', peerId, ':', e);
        }
      }
      
      // ВАЖНО: После добавления треков нужно создать новый оффер для renegotiation
      try {
        // Проверяем, что аудио-трек все еще есть
        const currentSenders = pc.getSenders();
        const audioSender = currentSenders.find(s => s.track && s.track.kind === 'audio');
        const videoSender = currentSenders.find(s => s.track && s.track.kind === 'video');
        
        console.log('[WebRTC] Before renegotiation - peer', peerId, 'has audio:', !!audioSender, 'video:', !!videoSender);
        if(audioSender) {
          console.log('[WebRTC] Audio track enabled:', audioSender.track.enabled, 'readyState:', audioSender.track.readyState);
        }
        
        // КРИТИЧЕСКИ ВАЖНО: Если нет аудио-sender, но есть localStream - добавляем аудио
        if(!audioSender && localStream) {
          console.log('[WebRTC] WARNING: Audio sender missing! Re-adding audio track to peer', peerId);
          for(const track of localStream.getAudioTracks()) {
            try {
              pc.addTrack(track, localStream);
              console.log('[WebRTC] Re-added audio track to peer', peerId);
            } catch(e) {
              console.error('[WebRTC] Failed to re-add audio track:', e);
            }
          }
        }
        
        // КРИТИЧЕСКИ ВАЖНО: Убедимся что transceiver для аудио имеет правильное направление
        const transceivers = pc.getTransceivers();
        for(const transceiver of transceivers) {
          if(transceiver.sender && transceiver.sender.track) {
            if(transceiver.sender.track.kind === 'audio') {
              // Устанавливаем направление sendrecv для аудио
              transceiver.direction = 'sendrecv';
              console.log('[WebRTC] Set audio transceiver direction to sendrecv');
            } else if(transceiver.sender.track.kind === 'video') {
              // Устанавливаем направление sendrecv для видео
              transceiver.direction = 'sendrecv';
              console.log('[WebRTC] Set video transceiver direction to sendrecv');
            }
          }
        }
        
        console.log('[WebRTC] Creating renegotiation offer for peer', peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws && ws.send(JSON.stringify({ type:'offer', data: pc.localDescription, receiver_id: peerId, sender_id: localUserId }));
        console.log('[WebRTC] Renegotiation offer sent to peer', peerId);
      } catch(e) {
        console.error('[WebRTC] Failed to renegotiate with peer', peerId, ':', e);
      }
    }
    
    return s;
  }
  async function createOfferTo(peerId){ 
    console.log('[WebRTC] Creating offer to peer:', peerId);
    const pc = ensurePeer(peerId);
    
    // Проверяем, есть ли локальные треки в этом peer-соединении
    const senders = pc.getSenders();
    const hasAudio = senders.some(s => s.track && s.track.kind === 'audio');
    const hasVideo = senders.some(s => s.track && s.track.kind === 'video');
    
    console.log('[WebRTC] Peer', peerId, 'current senders - hasAudio:', hasAudio, 'hasVideo:', hasVideo);
    console.log('[WebRTC] Available streams - localStream:', !!localStream, 'screenStream:', !!screenStream);
    
    // Если нет аудио, но есть localStream - добавляем
    if(!hasAudio && localStream) {
      console.log('[WebRTC] Adding missing audio tracks to peer', peerId);
      for(const track of localStream.getTracks()) {
        try {
          pc.addTrack(track, localStream);
          console.log('[WebRTC] Added', track.kind, 'track to peer', peerId);
        } catch(e) {
          console.warn('[WebRTC] Failed to add track:', e);
        }
      }
    }
    
    // Если нет видео, но есть screenStream - добавляем
    if(!hasVideo && screenStream) {
      console.log('[WebRTC] Adding missing screen tracks to peer', peerId);
      for(const track of screenStream.getTracks()) {
        try {
          const stream = localStream || screenStream;
          pc.addTrack(track, stream);
          console.log('[WebRTC] Added screen', track.kind, 'track to peer', peerId);
        } catch(e) {
          console.warn('[WebRTC] Failed to add screen track:', e);
        }
      }
    }
    
    const offer = await pc.createOffer({ offerToReceiveAudio:true, offerToReceiveVideo:true }); 
    await pc.setLocalDescription(offer); 
    ws && ws.send(JSON.stringify({ type:'offer', data: pc.localDescription, receiver_id: peerId, sender_id: localUserId }));
    console.log('[WebRTC] Offer sent to peer:', peerId);
  }
  async function handleSignal(msg){ 
    const { type, data, sender_id } = msg; 
    console.log('WebRTC signal received:', type, 'from:', sender_id);
    
    try {
      if(type==='offer'){ 
        const pc = ensurePeer(sender_id);
        
        // Handle glare: if we're in have-local-offer state, use polite/impolite pattern
        if(pc.signalingState === 'have-local-offer'){
          console.warn('Glare detected with peer', sender_id, '- rolling back local offer');
          // Be "polite" - rollback our offer and accept theirs
          await pc.setLocalDescription({type: 'rollback'});
        }
        
        await pc.setRemoteDescription(data); 
        const answer = await pc.createAnswer(); 
        await pc.setLocalDescription(answer); 
        ws && ws.send(JSON.stringify({ type:'answer', data: pc.localDescription, receiver_id: sender_id, sender_id: localUserId }));
        console.log('Answer sent to:', sender_id);
      } else if(type==='answer'){ 
        const pc = peers[sender_id]; 
        if(!pc) {
          console.warn('No peer connection found for answer from:', sender_id);
          return;
        }
        
        // Only process answer if we're in the correct state
        if(pc.signalingState !== 'have-local-offer'){
          console.warn('Ignoring answer from', sender_id, '- wrong signaling state:', pc.signalingState);
          return;
        }
        
        await pc.setRemoteDescription(data);
        console.log('Answer processed from:', sender_id);
      } else if(type==='candidate'){ 
        const pc = peers[sender_id]; 
        if(pc && pc.remoteDescription) {
          await pc.addIceCandidate(data).catch(e => {
            console.warn('Failed to add ICE candidate from', sender_id, ':', e.message);
          });
        }
      }
    } catch(e) {
      console.error('Error handling WebRTC signal', type, 'from', sender_id, ':', e);
    }
  }
  function toggleMute(){
    if(!localStream) return false;
    const audioTrack = localStream.getAudioTracks()[0];
    if(!audioTrack) return false;
    audioTrack.enabled = !audioTrack.enabled;
    console.log('Audio track', audioTrack.enabled ? 'unmuted' : 'muted');
    return !audioTrack.enabled; // возвращаем true если muted
  }
  
  async function stopScreenShare(){
    if(screenStream){
      screenStream.getTracks().forEach(t => {
        t.stop();
        console.log('Stopped screen track:', t.kind);
      });
      screenStream = null;
      
      // Удаляем видео-треки из всех peer connections и делаем renegotiation
      for(const [peerId, pc] of Object.entries(peers)) {
        const senders = pc.getSenders();
        for(const sender of senders) {
          if(sender.track && sender.track.kind === 'video') {
            pc.removeTrack(sender);
            console.log('Removed video track from peer', peerId);
          }
        }
        
        // Отправляем новый offer без видео
        try {
          console.log('Creating renegotiation offer after stopping screen for peer', peerId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws && ws.send(JSON.stringify({ type:'offer', data: pc.localDescription, receiver_id: peerId, sender_id: localUserId }));
          console.log('Renegotiation offer sent to peer', peerId);
        } catch(e) {
          console.error('Failed to renegotiate after stopping screen with peer', peerId, ':', e);
        }
      }
    }
  }
  
  function stopLocalStreams(){
    if(localStream){
      localStream.getTracks().forEach(t => {
        t.stop();
        console.log('Stopped local track:', t.kind);
      });
      localStream = null;
    }
    if(screenStream){
      screenStream.getTracks().forEach(t => {
        t.stop();
        console.log('Stopped screen track:', t.kind);
      });
      screenStream = null;
    }
  }
  
  function closeAll(){ 
    console.log('Closing all peer connections and stopping streams');
    Object.keys(peers).forEach(peerId => {
      const pc = peers[peerId];
      try{
        // Очищаем накопленный поток
        if(pc.accumulatedStream) {
          pc.accumulatedStream.getTracks().forEach(t => t.stop());
          pc.accumulatedStream = null;
        }
        pc.close();
      }catch(e){
        console.warn('Error closing peer connection:', e);
      }
      delete peers[peerId]; // Удаляем peer из объекта
    });
    stopLocalStreams();
  }
  
  function clearPeers() {
    console.log('Clearing all peer connections...');
    Object.keys(peers).forEach(peerId => {
      const pc = peers[peerId];
      try {
        if(pc.accumulatedStream) {
          pc.accumulatedStream.getTracks().forEach(t => t.stop());
          pc.accumulatedStream = null;
        }
        pc.close();
      } catch(e) {
        console.warn('Error closing peer connection:', e);
      }
      delete peers[peerId];
    });
  }
  
  return { startLocalAudio, startScreen, createOfferTo, handleSignal, closeAll, toggleMute, stopLocalStreams, stopScreenShare, clearPeers };
}
