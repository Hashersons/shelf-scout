import { NextResponse } from 'next/server';

export async function GET(request) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const results = [];

  try {
    const booksUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6&fields=key,title,author_name,first_publish_year,cover_i`;
    const r = await fetch(booksUrl, { headers: { 'User-Agent': 'ShelfHunt/1.0' }, next: { revalidate: 300 } });
    if (r.ok) {
      const data = await r.json();
      for (const b of (data.docs || []).slice(0, 6)) {
        results.push({ id: b.key, title: b.title, subtitle: b.author_name?.slice(0, 2).join(', ') || 'Book', type: 'book', year: b.first_publish_year || '', image: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : '' });
      }
    }
  } catch {}

  try {
    const artistUrl = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(q)}&fmt=json&limit=5`;
    const r = await fetch(artistUrl, { headers: { 'User-Agent': 'ShelfHunt/1.0 (shelfscout@example.com)' }, next: { revalidate: 300 } });
    if (r.ok) {
      const data = await r.json();
      for (const a of (data.artists || []).slice(0, 5)) {
        results.push({ id: a.id, title: a.name, subtitle: `Artist${a.type ? ` · ${a.type}` : ''}`, type: 'music', year: '', image: '' });
      }
    }
  } catch {}

  try {
    const recordingUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=5`;
    const r = await fetch(recordingUrl, { headers: { 'User-Agent': 'ShelfHunt/1.0 (shelfscout@example.com)' }, next: { revalidate: 300 } });
    if (r.ok) {
      const data = await r.json();
      for (const x of (data.recordings || []).slice(0, 5)) {
        results.push({ id: x.id, title: x.title, subtitle: x['artist-credit']?.map(c => c.name).join(', ') || 'Recording', type: 'music', year: '', image: '' });
      }
    }
  } catch {}

  return NextResponse.json({ results });
}
