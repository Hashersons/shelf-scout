import { NextResponse } from 'next/server';

const headers = { 'User-Agent': 'ShelfHunt/1.0 (shelfscout@example.com)' };

export async function GET(request) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const booksUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i`;
  const artistsUrl = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(q)}&fmt=json&limit=6`;
  const recordingsUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=6`;

  const [booksResponse, artistsResponse, recordingsResponse] = await Promise.allSettled([
    fetch(booksUrl, { headers, next: { revalidate: 300 } }),
    fetch(artistsUrl, { headers, next: { revalidate: 300 } }),
    fetch(recordingsUrl, { headers, next: { revalidate: 300 } })
  ]);

  const results = [];

  if (booksResponse.status === 'fulfilled' && booksResponse.value.ok) {
    try {
      const data = await booksResponse.value.json();
      for (const b of (data.docs || []).slice(0, 8)) {
        results.push({
          id: b.key,
          title: b.title,
          subtitle: b.author_name?.slice(0, 2).join(', ') || 'Book',
          type: 'book',
          year: b.first_publish_year || '',
          image: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : ''
        });
      }
    } catch {}
  }

  if (artistsResponse.status === 'fulfilled' && artistsResponse.value.ok) {
    try {
      const data = await artistsResponse.value.json();
      for (const a of (data.artists || []).slice(0, 6)) {
        results.push({ id: a.id, title: a.name, subtitle: `Artist${a.type ? ` · ${a.type}` : ''}`, type: 'music', year: '', image: '' });
      }
    } catch {}
  }

  if (recordingsResponse.status === 'fulfilled' && recordingsResponse.value.ok) {
    try {
      const data = await recordingsResponse.value.json();
      for (const x of (data.recordings || []).slice(0, 6)) {
        results.push({
          id: x.id,
          title: x.title,
          subtitle: x['artist-credit']?.map(c => c.name).join(', ') || 'Recording',
          type: 'music',
          year: '',
          image: ''
        });
      }
    } catch {}
  }

  const normalized = q.toLowerCase();
  results.sort((a, b) => {
    const score = item => {
      const title = item.title.toLowerCase();
      if (title === normalized) return 0;
      if (title.startsWith(normalized)) return 1;
      if (title.includes(normalized)) return 2;
      return 3;
    };
    return score(a) - score(b);
  });

  return NextResponse.json({ results: results.slice(0, 15) }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
  });
}
