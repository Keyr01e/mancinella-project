export async function apiGet(path){
  const token = localStorage.getItem('token')
  const headers = token? {'Authorization': token} : {}
  const res = await fetch(path, { headers })
  if(!res.ok){ const txt = await res.text(); throw new Error(txt || ('HTTP '+res.status)) }
  return res.json()
}

export async function apiPost(path, body){
  const token = localStorage.getItem('token')
  const headers = {'Content-Type':'application/json'}
  if(token) headers['Authorization'] = token
  const res = await fetch(path, { method:'POST', headers, body: JSON.stringify(body) })
  if(!res.ok){ const txt = await res.text(); throw new Error(txt || ('HTTP '+res.status)) }
  return res.json()
}

export async function apiDelete(path){
  const token = localStorage.getItem('token')
  const headers = token? {'Authorization': token} : {}
  const res = await fetch(path, { method:'DELETE', headers })
  if(!res.ok){ const txt = await res.text(); throw new Error(txt || ('HTTP '+res.status)) }
  return res.json()
}
