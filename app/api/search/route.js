import { NextResponse } from 'next/server';
const headers={ 'User-Agent':'ShelfHunt/1.0' };
const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export async function GET(request){
 const p=new URL(request.url).searchParams,q=p.get('q')?.trim(),media=p.get('media')||'book';
 if(!q||q.length<1)return NextResponse.json({results:[]});
 if(media!=='book')return NextResponse.json({results:[]});
 const urls=[
  `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&printType=books&orderBy=relevance&maxResults=40`,
  `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=40&fields=key,title,author_name,first_publish_year,cover_i&lang=en`
 ];
 const responses=await Promise.allSettled(urls.map(u=>fetch(u,{headers,cache:'no-store'})));
 const results=[],seen=new Set();
 const add=x=>{if(!x.title)return;const key=`${norm(x.title)}|${norm(x.subtitle)}|${x.year||''}`;if(seen.has(key))return;seen.add(key);results.push(x)};
 if(responses[0].status==='fulfilled'&&responses[0].value.ok){try{const d=await responses[0].value.json();for(const i of d.items||[]){const v=i.volumeInfo||{};if(v.title)add({id:`google:${i.id}`,title:v.title.trim(),subtitle:v.authors?.slice(0,2).join(', ')||'Book',type:'book',year:v.publishedDate?String(v.publishedDate).slice(0,4):'',image:v.imageLinks?.thumbnail||''})}}catch{}}
 if(responses[1].status==='fulfilled'&&responses[1].value.ok){try{const d=await responses[1].value.json();for(const b of d.docs||[]){if(b.title)add({id:`openlibrary:${b.key}`,title:b.title.trim(),subtitle:b.author_name?.slice(0,2).join(', ')||'Book',type:'book',year:b.first_publish_year?String(b.first_publish_year):'',image:b.cover_i?`https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`:''})}}catch{}}
 const query=norm(q),words=query.split(' ').filter(Boolean);
 const score=x=>{const t=norm(x.title);if(t===query)return 0;if(t.startsWith(query))return 5;if(t.includes(query))return 10;const hits=words.filter(w=>t.includes(w)).length;return 50-hits*8};
 results.sort((a,b)=>score(a)-score(b)||norm(a.title).localeCompare(norm(b.title)));
 return NextResponse.json({results:results.slice(0,20)},{headers:{'Cache-Control':'no-store'}});
}
