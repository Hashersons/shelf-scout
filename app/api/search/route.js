import { NextResponse } from 'next/server';

const headers = { 'User-Agent': 'ShelfHunt/1.0 (shelfscout@example.com)' };

export async function GET(request) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const booksUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=key,title,author_name,first_publish_year,cover_i,publish_year`;
  const recordingsUrl = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(q)}&fmt=json&limit=8`;

  const [booksResponse, recordingsResponse] = await Promise.allSettled([
    fetch(booksUrl, { headers, next: { revalidate: 300 } }),
    fetch(recordingsUrl, { headers, next: { revalidate: 300 } })
  ]);

  const results = [];

  if (booksResponse.status === 'fulfilled' && booksResponse.value.ok) {
    try {
      const data = await booksResponse.value.json();
      const seen = new Set();
      for (const b of data.docs || []) {
        const title = b.title?.trim();
        if (!title) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const years = Array.isArray(b.publish_year) ? b.publish_year : [];
        const published = b.first_publish_year || years[0] || '';
        if (!published) continue;
        results.push({
          id: b.key,
          title,
          subtitle: b.author_name?.slice(0, 2).join(', ') || 'Book',
          type: 'book',
          year: published,
          image: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : ''
        });
      }
    } catch {}
  }

  if (recordingsResponse.status === 'fulfilled' && recordingsResponse.value.ok) {
    try {
      const data = await recordingsResponse.value.json();
      const seen = new Set();
      for (const x of data.recordings || []) {
        const title = x.title?.trim();
        if (!title) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const credits = x['artist-credit']?.map(c => c.name).filter(Boolean) || [];
        results.push({
          id: x.id,
          title,
          subtitle: credits.slice(0, 2).join(', ') || 'Recording',
          type: 'music',
          year: '',
          image: ''
        });
      }
    } catch {}
  }

  const normalized = q.toLowerCase();
  const score = item => {
    const title = item.title.toLowerCase();
    let relevance = title === normalized ? 0 : title.startsWith(normalized) ? 10 : title.includes(normalized) ? 25 : 50;
    if (item.type === 'book') relevance -= 8;
    if (item.type === 'music') relevance += 5;
    return relevance;
  };

  results.sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title));

  return NextResponse.json({ results: results.slice(0, 12) }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
  });
}
