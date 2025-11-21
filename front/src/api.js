import { API_URL } from './config'

function makeUrl(path){
  if(!path) return API_URL;
  if(/^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path.startsWith('/')?'':'/'}${path}`
}

export async function apiGet(path){
  const token = localStorage.getItem('token')
  const headers = {}
  if(token){ headers['Authorization'] = token.startsWith('Bearer ')? token : `Bearer ${token}` }
  const res = await fetch(makeUrl(path), { headers })
  if(!res.ok){ const txt = await res.text(); throw new Error(txt || ('HTTP '+res.status)) }
  return res.json()
}

export async function apiPost(path, body){
  const token = localStorage.getItem('token')
  const headers = {'Content-Type':'application/json'}
  if(token){ headers['Authorization'] = token.startsWith('Bearer ')? token : `Bearer ${token}` }
  const res = await fetch(makeUrl(path), { method:'POST', headers, body: JSON.stringify(body) })
  if(!res.ok){ const txt = await res.text(); throw new Error(txt || ('HTTP '+res.status)) }
  return res.json()
}

export async function apiDelete(path){
  const token = localStorage.getItem('token')
  const headers = {}
  if(token){ headers['Authorization'] = token.startsWith('Bearer ')? token : `Bearer ${token}` }
  const res = await fetch(makeUrl(path), { method:'DELETE', headers })
  if(!res.ok){ const txt = await res.text(); throw new Error(txt || ('HTTP '+res.status)) }
  return res.json()
}
