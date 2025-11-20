import React from 'react'
export default function Sidebar({rooms,active,onSelect,onAdd,onDelete,currentUserId,children}){
  return (
    <div className="sidebar">
      <div className="brand">Mancinella</div>
      <div className="rooms">
        {rooms.map(r=> (
          <div key={r.id} className={"room "+(r.id===active? 'active':'')} style={{position:'relative'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,flex:1}} onClick={()=>onSelect(r.id)}>
              <div style={{width:36,height:36,borderRadius:8,background:'rgba(255,255,255,0.03)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
                {String(r.name)[0]}
              </div>
              <div style={{flex:1}}>{r.name}</div>
            </div>
            {r.creator_id === currentUserId && onDelete && (
              <button 
                onClick={(e)=>{e.stopPropagation(); onDelete(r.id)}} 
                style={{background:'none',border:'none',color:'#ed4245',cursor:'pointer',fontSize:14,padding:'4px 8px'}}
                title="Delete channel"
              >
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>
      <div><button className="btn" onClick={onAdd}>+ Add Room</button></div>
      {children}
    </div>
  )
}
