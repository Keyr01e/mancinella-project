import React, { useState, useEffect } from 'react'

export default function VoiceChannels({ 
  voiceChannels, 
  currentVoiceChannel, 
  onJoinChannel, 
  onLeaveChannel,
  connectedUsers,
  userAvatars 
}) {
  const [newChannelName, setNewChannelName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleCreateChannel = () => {
    if(!newChannelName.trim()) return
    // Создаем новый канал (просто добавляем в список)
    onJoinChannel(newChannelName.trim())
    setNewChannelName('')
    setShowCreateForm(false)
  }

  return (
    <div style={{padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)'}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
        <div style={{fontSize: 13, fontWeight: 600, color: 'var(--text)'}}>
          🎙️ Voice Channels
        </div>
        <button 
          className="btn" 
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{fontSize: 11, padding: '4px 8px'}}
        >
          {showCreateForm ? '✕' : '+'}
        </button>
      </div>

      {showCreateForm && (
        <div style={{marginBottom: 8, padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6}}>
          <input
            type="text"
            placeholder="Channel name..."
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateChannel()}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              color: 'var(--text)',
              fontSize: 12,
              marginBottom: 6
            }}
          />
          <button 
            className="btn" 
            onClick={handleCreateChannel}
            style={{width: '100%', fontSize: 12}}
          >
            Create Channel
          </button>
        </div>
      )}

      <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
        {voiceChannels.map(channel => {
          const isActive = currentVoiceChannel === channel.name
          const usersInChannel = connectedUsers[channel.name] || []
          
          return (
            <div
              key={channel.name}
              onClick={() => {
                if(isActive) {
                  // Если кликнули на активный канал - отключаемся
                  onLeaveChannel()
                } else {
                  // Если кликнули на другой канал - просто переключаемся
                  // (старый канал автоматически отключится в VoicePanel)
                  onJoinChannel(channel.name)
                }
              }}
              style={{
                padding: '8px 10px',
                background: isActive ? 'rgba(88,101,242,0.15)' : 'rgba(255,255,255,0.02)',
                border: isActive ? '1px solid rgba(88,101,242,0.3)' : '1px solid transparent',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s',
                ':hover': {
                  background: 'rgba(255,255,255,0.05)'
                }
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: usersInChannel.length > 0 ? 6 : 0}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                  <span style={{fontSize: 14}}>
                    {isActive ? '🔊' : '🔇'}
                  </span>
                  <span style={{fontSize: 13, fontWeight: isActive ? 600 : 400, color: 'var(--text)'}}>
                    {channel.name}
                  </span>
                </div>
                {usersInChannel.length > 0 && (
                  <span style={{fontSize: 11, color: 'var(--muted)'}}>
                    {usersInChannel.length}
                  </span>
                )}
              </div>
              
              {usersInChannel.length > 0 && (
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 20}}>
                  {usersInChannel.map(userId => {
                    const avatarUrl = userAvatars?.[userId]
                    return (
                      <div
                        key={userId}
                        title={`User ${userId}`}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'rgba(88,101,242,0.3)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          fontSize: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 600
                        }}
                      >
                        {!avatarUrl && String(userId)[0]}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        
        {voiceChannels.length === 0 && (
          <div style={{padding: 12, textAlign: 'center', color: 'var(--muted)', fontSize: 12}}>
            No voice channels yet. Create one!
          </div>
        )}
      </div>
    </div>
  )
}
