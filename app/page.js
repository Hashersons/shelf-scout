'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Home(){
 const [items,setItems]=useState([]),[title,setTitle]=useState(''),[status,setStatus]=useState('');
 async function load(){
  const {data,error}=await supabase.from('wanted_items').select('id,title').order('created_at',{ascending:true});
  if(error){setStatus('Supabase connection ready, but sign-in is needed before cloud lists can be used.');return}
  setItems(data||[]);
 }
 async function add(){
  const t=title.trim();if(!t)return;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setStatus('Cloud saving will activate after we add user accounts.');setItems(x=>[...x,{id:crypto.randomUUID(),title:t}]);setTitle('');return}
  const {error}=await supabase.from('wanted_items').insert({user_id:user.id,title:t});
  if(error)setStatus(error.message);else{setTitle('');load()}
 }
 async function remove(id){await supabase.from('wanted_items').delete().eq('id',id);load()}
 useEffect(()=>{load()},[]);
 return <><header className="header"><div className="logo">🔎 ShelfHunt</div><div className="tagline">Find what you're hunting for.</div></header><main className="container"><section className="card"><h2>Wanted List</h2><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Book, VHS, CD, DVD or movie title..." onKeyDown={e=>e.key==='Enter'&&add()}/><button onClick={add}>Add Item</button>{status&&<div className="message">{status}</div>}<div className="list">{items.length?items.map(i=><div className="item" key={i.id}><span>📖 {i.title}</span><button className="remove" onClick={()=>remove(i.id)}>Remove</button></div>):<div>Your wanted list is empty.</div>}</div></section><section className="card"><h2>📷 Shelf Scanner</h2><p>Shelf scanning will connect here next. The database connection is now in place.</p></section></main></>
}
