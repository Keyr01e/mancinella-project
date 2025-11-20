import React, {useEffect, useRef, useState} from 'react'
import { API_URL } from './config'

// Функция для преобразования относительных URL в абсолютные
function getAbsoluteUrl(url) {
  if (!url) return '';
  // Если URL уже абсолютный (начинается с http:// или https://)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Если URL относительный, добавляем API_URL
  return API_URL + url;
}

export default function ChatWindow({room,messages,onSend,onDeleteMessage,currentUserId,userAvatars}){
  const sc = useRef();
  const fileInputRef = useRef();
  const [text,setText]=useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  useEffect(()=>{ if(sc.current) sc.current.scrollTop = sc.current.scrollHeight },[messages,room])
  return (
    <div className="chat">
      <div className="messages" ref={sc}>
        {messages.filter(m=>String(m.chat_room_id)===String(room)).map(m=> {
          const avatarUrl = userAvatars?.[m.sender_id];
          const absoluteAvatarUrl = avatarUrl ? getAbsoluteUrl(avatarUrl) : null;
          return (
          <div className="msg" key={m.id} style={{position:'relative'}}>
            <div className="avatar" style={{
              backgroundImage: absoluteAvatarUrl ? `url(${absoluteAvatarUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}>
              {!avatarUrl && String(m.sender_name||m.author||'U')[0].toUpperCase()}
            </div>
            <div className="body">
              <div className="meta">
                <strong>{m.sender_name||m.author||('User '+(m.sender_id||''))}</strong> • <span className="small">{typeof m.time === 'string' ? m.time : (m.timestamp ? new Date(m.timestamp).toLocaleTimeString().slice(0,5) : '')}</span>
                {m.sender_id === currentUserId && onDeleteMessage && (
                  <button 
                    onClick={()=>onDeleteMessage(m.id)} 
                    style={{marginLeft:8,background:'none',border:'none',color:'#ed4245',cursor:'pointer',fontSize:12,padding:0}}
                    title="Delete message"
                  >
                    🗑️
                  </button>
                )}
              </div>
              <div>{m.content||m.text||m.message}</div>
              {m.attachments && m.attachments.length > 0 && (
                <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
                  {m.attachments.map((file,idx)=>{
                    const isImage = file.type?.startsWith('image/');
                    const isVideo = file.type?.startsWith('video/');
                    
                    if(isImage) {
                      const absoluteUrl = getAbsoluteUrl(file.url);
                      return (
                        <a key={idx} href={absoluteUrl} target="_blank" rel="noopener noreferrer" style={{display:'block',maxWidth:400}}>
                          <img src={absoluteUrl} alt={file.name} style={{maxWidth:'100%',borderRadius:8,display:'block'}} />
                        </a>
                      );
                    }
                    
                    if(isVideo) {
                      const absoluteUrl = getAbsoluteUrl(file.url);
                      return (
                        <video key={idx} controls style={{maxWidth:400,borderRadius:8,display:'block'}}>
                          <source src={absoluteUrl} type={file.type} />
                        </video>
                      );
                    }
                    
                    const absoluteUrl = getAbsoluteUrl(file.url);
                    return (
                      <a key={idx} href={absoluteUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{fontSize:12,padding:'4px 8px',textDecoration:'none',display:'inline-block'}}>
                        📎 {file.name}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )})}
        {messages.filter(m=>String(m.chat_room_id)===String(room)).length===0 && <div className="empty-note">No messages yet in this room.</div>}
      </div>
      <div className="input" style={{flexDirection:'column',gap:8}}>
        {attachedFiles.length > 0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'8px',background:'rgba(255,255,255,0.02)',borderRadius:8}}>
            {attachedFiles.map((file,idx)=>(
              <div key={idx} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',background:'rgba(88,101,242,0.15)',borderRadius:6,fontSize:12}}>
                <span>📎 {file.name}</span>
                <button onClick={()=>setAttachedFiles(attachedFiles.filter((_,i)=>i!==idx))} style={{background:'none',border:'none',color:'var(--text)',cursor:'pointer',padding:0,fontSize:14}}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{display:'none'}} 
            multiple
            onChange={(e)=>{
              const files = Array.from(e.target.files);
              setAttachedFiles(prev=>[...prev,...files]);
              e.target.value = '';
            }}
          />
          <button className="btn" onClick={()=>fileInputRef.current?.click()} title="Attach files">
            📎
          </button>
          <input 
            value={text} 
            onChange={e=>setText(e.target.value)} 
            placeholder={'Message #' + room} 
            onKeyDown={e=>{ 
              if(e.key==='Enter'&&(text.trim()||attachedFiles.length>0)){ 
                onSend(text.trim(), attachedFiles); 
                setText(''); 
                setAttachedFiles([]);
              } 
            }} 
            style={{flex:1}}
          />
          <button 
            className="btn primary" 
            onClick={()=>{ 
              if(text.trim()||attachedFiles.length>0){ 
                onSend(text.trim(), attachedFiles); 
                setText(''); 
                setAttachedFiles([]);
              } 
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
