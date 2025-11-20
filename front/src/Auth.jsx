import React, { useState } from 'react'
export default function Auth({onAuth}){
  const [mode,setMode]=useState('login'); const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [err,setErr]=useState('')
  async function submit(e){ 
    e.preventDefault(); 
    setErr(''); 
    
    try{ 
      if(mode==='login'){ 
        const body=new URLSearchParams(); 
        body.append('username',username); 
        body.append('password',password); 
        const res=await fetch('/api/v1/users/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body}); 
        if(!res.ok){ const t=await res.text(); throw new Error(t||res.status) } 
        const data=await res.json(); 
        const token=data.access_token||data.token; 
        const user_id=data.user_id||data.id||(data.user&&data.user.id)||'default_user';
        const username_from_api=data.username||username;
        if(!token) throw new Error('token missing'); 
        localStorage.setItem('token','Bearer '+token); 
        localStorage.setItem('user_id',String(user_id)); 
        localStorage.setItem('username',username_from_api); 
        onAuth&&onAuth({token:'Bearer '+token,user_id,username:username_from_api}) 
      } else { 
        const res=await fetch('/api/v1/users/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}); 
        if(!res.ok){ const t=await res.text(); throw new Error(t||res.status) } 
        const body=new URLSearchParams(); 
        body.append('username',username); 
        body.append('password',password); 
        const loginRes=await fetch('/api/v1/users/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body}); 
        if(!loginRes.ok){ const t=await loginRes.text(); throw new Error(t||loginRes.status) } 
        const loginData=await loginRes.json(); 
        const token=loginData.access_token||loginData.token; 
        const user_id=loginData.user_id||loginData.id||(loginData.user&&loginData.user.id)||'default_user';
        const username_from_api=loginData.username||username;
        if(!token) throw new Error('token missing'); 
        localStorage.setItem('token','Bearer '+token); 
        localStorage.setItem('user_id',String(user_id)); 
        localStorage.setItem('username',username_from_api); 
        onAuth&&onAuth({token:'Bearer '+token,user_id,username:username_from_api}) 
      } 
    }catch(e){ 
      console.error('Auth error:', e); 
      setErr('Auth failed: '+(e.message||'')) 
    } 
  }
  return (
    <div style={{
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      height:'100vh',
      background:'#0f1115',
      color:'#e6eef8'
    }}>
      <form onSubmit={submit} style={{
        width:420,
        background:'#0f1724',
        padding:20,
        borderRadius:12,
        border:'1px solid rgba(255,255,255,0.03)'
      }}>
        <h3 style={{margin:0,marginBottom:8,color:'#e6eef8'}}>
          {mode==='login'?'Sign In':'Sign Up'}
        </h3>
        <div style={{marginBottom:8}}>
          <input 
            placeholder='Username' 
            value={username} 
            onChange={e=>setUsername(e.target.value)} 
            style={{
              width:'100%',
              padding:8,
              borderRadius:6,
              background:'#111',
              border:'1px solid rgba(255,255,255,0.03)',
              color:'#e6eef8'
            }} 
            required 
          />
        </div>
        <div style={{marginBottom:8}}>
          <input 
            placeholder='Password' 
            type='password' 
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            style={{
              width:'100%',
              padding:8,
              borderRadius:6,
              background:'#111',
              border:'1px solid rgba(255,255,255,0.03)',
              color:'#e6eef8'
            }} 
            required 
          />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className='btn primary' type='submit'>
            {mode==='login'?'Login':'Register'}
          </button>
          <button type='button' className='btn' onClick={()=>setMode(mode==='login'?'register':'login')}>
            {mode==='login'?'Sign Up':'Sign In'}
          </button>
        </div>
        {err&&<div style={{marginTop:8,color:'#ff8080',fontSize:13}}>{err}</div>}
        <div style={{marginTop:10,fontSize:12,color:'#9aa4b2'}}>
          POST /api/v1/users/token and /api/v1/users/register
        </div>
      </form>
    </div>
  )
}
