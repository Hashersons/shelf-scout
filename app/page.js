'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const MEDIA=[['book','📚','Books'],['vhs','📼','VHS'],['cd','💿','CDs'],['dvd','📀','DVDs']];
const SORTS=[['title','A–Z'],['titleDesc','Z–A'],['newest','Newest added'],['oldest','Oldest added']];

export default function Home(){
 const [user,setUser]=useState(null),[items,setItems]=useState([]),[media,setMedia]=useState('book'),[sort,setSort]=useState('title'),[title,setTitle]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authMode,setAuthMode]=useState('login'),[status,setStatus]=useState('');
 async function load(){
  if(!user){setItems([]);return}
  const {data,error}=await supabase.from('wanted_items').select('id,title,media_type,created_at').eq('user_id',user.id);
  if(error){setStatus(error.message);return} setItems(data||[]);
 }
 useEffect(()=>{supabase.auth.getUser().then(({data})=>setUser(data.user));const {data}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{load()},[user]);
 const visible=useMemo(()=>items.filter(i=>i.media_type===media).sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='titleDesc'?b.title.localeCompare(a.title):sort==='newest'?new Date(b.created_at)-new Date(a.created_at):new Date(a.created_at)-new Date(b.created_at)),[items,media,sort]);
 async function auth(){setStatus('');const fn=authMode==='login'?supabase.auth.signInWithPassword.bind(supabase):supabase.auth.signUp.bind(supabase);const {data,error}=await fn({email,password});if(error)setStatus(error.message);else setStatus(authMode==='login'?'Signed in.':'Account created — check your email if confirmation is enabled.');}
 async function logout(){await supabase.auth.signOut();setStatus('Signed out.')}
 async function add(){const t=title.trim();if(!t)return;if(!user){setStatus('Sign in first so your list is saved to the cloud.');return}const {error}=await supabase.from('wanted_items').insert({user_id:user.id,title:t,media_type:media});if(error)setStatus(error.message);else{setTitle('');load()}}
 async function remove(id){await supabase.from('wanted_items').delete().eq('id',id);load()}
 return <><header className="header"><div className="logo">🔎 ShelfHunt</div><div className="tagline">Find what you're hunting for.</div></header><main className="container">
 <section className="card auth"><div className="row between"><h2>👤 Account</h2>{user&&<button className="smallBtn" onClick={logout}>Sign out</button>}</div>{user?<div className="signed">Signed in as <b>{user.email}</b></div>:<><div className="tabs"><button className={authMode==='login'?'active':''} onClick={()=>setAuthMode('login')}>Log in</button><button className={authMode==='signup'?'active':''} onClick={()=>setAuthMode('signup')}>Create account</button></div><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email"/><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password"/><button onClick={auth}>{authMode==='login'?'Log in':'Create account'}</button></>}</section>
 <section className="card"><div className="row between"><div><h2>📋 Wanted Lists</h2><div className="small">Keep thousands of items organized by physical media.</div></div><span className="count">{items.length} total</span></div><div className="mediaGrid">{MEDIA.map(([key,icon,label])=><button key={key} className={media===key?'media active':''} onClick={()=>setMedia(key)}><span>{icon}</span>{label}<b>{items.filter(i=>i.media_type===key).length}</b></button>)}</div><div className="controls"><select value={sort} onChange={e=>setSort(e.target.value)}>{SORTS.map(([v,l])=><option key={v} value={v}>Sort: {l}</option>)}</select></div><div className="addRow"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder={`Add a ${MEDIA.find(x=>x[0]===media)[2].slice(0,-1).toLowerCase()}...`} onKeyDown={e=>e.key==='Enter'&&add()}/><button onClick={add}>Add</button></div>{status&&<div className="message">{status}</div>}<div className="list">{visible.length?visible.map(i=><div className="item" key={i.id}><span>{MEDIA.find(x=>x[0]===i.media_type)?.[1]} {i.title}</span><button className="remove" onClick={()=>remove(i.id)}>Remove</button></div>):<div className="empty">No {MEDIA.find(x=>x[0]===media)?.[2].toLowerCase()} on this list yet.</div>}</div></section>
 <section className="card"><h2>📷 Shelf Scanner</h2><p className="small">The scanner will use these media categories automatically. Next we'll connect the live scanner to your cloud account and shared finds.</p><button className="scanBtn">Scan Shelf</button></section>
 </main></>;
}
