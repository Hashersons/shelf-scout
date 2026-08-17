import { NextResponse } from 'next/server';

const headers = { 'User-Agent': 'ShelfHunt/1.0 (shelfscout@example.com)' };

export async function GET(request) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  // Free, relevance-ranked book discovery. Google Books defaults to relevance;
  // Open Library also ranks its work search by relevance. We use both and merge
  // duplicate works so editions do not overwhelm autocomplete.
  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&printType=books&orderBy=relevance&maxResults=20`;
  const openLibraryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20&fields=key,title,author_name,first_publish_year,cover_i,numFound&lang=en`;

  const [googleResponse, openLibraryResponse] = await Promise.allSettled([
    fetch(googleUrl, { headers, next: { revalidate: 300 } }),
    fetch(openLibraryUrl, { headers, next: { revalidate: 300 } })
  ]);

  const results = [];
  const seen = new Set();

  const addBook = (item) => {
    const title = item.title?.trim();
    if (!title) return;
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
        addBook({
          id: `google:${item.id}`,
          title: v.title,
          subtitle: v.authors?.slice(0, 2).join(', ') || 'Book',
          type: 'book',
          year: String(v.publishedDate).slice(0, 4),
          image: v.imageLinks?.thumbnail || ''
        });
      }
    } catch {}
  }

  if (openLibraryResponse.status === 'fulfilled' && openLibraryResponse.value.ok) {
    try {
      const data = await openLibraryResponse.value.json();
      for (const b of data.docs || []) {
        if (!b.title || !b.first_publish_year) continue;
        addBook({
          id: `openlibrary:${b.key}`,
          title: b.title,
          subtitle: b.author_name?.slice(0, 2).join(', ') || 'Book',
          type: 'book',
          year: b.first_publish_year,
          image: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : ''
        });
      }
    } catch {}
  }

  const normalized = q.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const score = (item, index) => {
    const title = item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const words = title.split(' ');
    const queryWords = normalized.split(' ');
    let score = index;
    if (title === normalized) score -= 1000;
    else if (title.startsWith(normalized)) score -= 700;
    else if (title.includes(normalized)) score -= 400;
    if (queryWords.every(w => words.includes(w))) score -= 150;
    return score;
  };

  results.sort((a, b) => score(a, results.indexOf(a)) - score(b, results.indexOf(b)));

  return NextResponse.json({ results: results.slice(0, 12) }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
  });
}
