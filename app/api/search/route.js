import { NextResponse } from 'next/server';

const headers = { 'User-Agent': 'ShelfHunt/1.0' };

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const q = params.get('q')?.trim();
  const media = params.get('media') || 'book';
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  if (media !== 'book') return NextResponse.json({ results: [] });

  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&printType=books&orderBy=relevance&maxResults=40`;
  const openLibraryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=40&fields=key,title,author_name,first_publish_year,cover_i&lang=en`;
  const [googleResponse, openLibraryResponse] = await Promise.allSettled([
    fetch(googleUrl, { headers, next: { revalidate: 300 } }),
    fetch(openLibraryUrl, { headers, next: { revalidate: 300 } })
  ]);

  const results = [];
  const seen = new Set();
  const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const addBook = item => {
    if (!item.title) return;
    // Do not collapse by title alone: different publication years/editions must remain available.
    const key = `${normalize(item.title)}|${normalize(item.subtitle)}|${item.year || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  };

  if (googleResponse.status === 'fulfilled' && googleResponse.value.ok) {
    try {
      const data = await googleResponse.value.json();
      for (const item of data.items || []) {
        const v = item.volumeInfo || {};
        if (!v.title || !v.publishedDate) continue;
        addBook({ id:`google:${item.id}`, title:v.title.trim(), subtitle:v.authors?.slice(0,2).join(', ')||'Book', type:'book', year:String(v.publishedDate).slice(0,4), image:v.imageLinks?.thumbnail||'' });
      }
    } catch {}
  }

  if (openLibraryResponse.status === 'fulfilled' && openLibraryResponse.value.ok) {
    try {
      const data = await openLibraryResponse.value.json();
      for (const b of data.docs || []) {
        if (!b.title || !b.first_publish_year) continue;
        addBook({ id:`openlibrary:${b.key}`, title:b.title.trim(), subtitle:b.author_name?.slice(0,2).join(', ')||'Book', type:'book', year:String(b.first_publish_year), image:b.cover_i?`https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg`:'' });
      }
    } catch {}
  }

  const query = normalize(q);
  const words = query.split(' ').filter(Boolean);
  const relevance = title => {
    const t = normalize(title);
    if (t === query) return 0;
    if (t.startsWith(query)) return 10;
    if (t.includes(query)) return 20;
    return 100 - words.filter(w => t.includes(w)).length * 10;
  };

  // Rank by title relevance only. Publication year is NOT used to decide which edition wins.
  results.sort((a,b) => relevance(a.title)-relevance(b.title) || normalize(a.title).localeCompare(normalize(b.title)));

  return NextResponse.json({ results: results.slice(0,20) }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
