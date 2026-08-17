export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI engine is not connected yet. Add OPENAI_API_KEY in Vercel Environment Variables.' });
  try {
    const { image, wantedItems = [], mode = 'all' } = req.body || {};
    if (!image || typeof image !== 'string') return res.status(400).json({ error: 'Missing shelf image.' });
    const prompt = `You are ShelfScout, a fast visual sourcing assistant for a reseller. Analyze this shelf image. Identify visible BOOK, VHS, CD, and DVD spines/cases. Do not invent titles. For each reasonably readable item return title, author/artist if visible, mediaType, confidence (0-1), and wantedMatch (exact wanted-list item or null). Prioritize likely spine text and ignore random background text. A partial title is acceptable only when confidence is at least 0.65. Wanted list: ${JSON.stringify(wantedItems)}. Mode: ${mode}. Return ONLY valid JSON in this shape: {"items":[{"title":"...","author":"...","mediaType":"book|vhs|cd|dvd|unknown","confidence":0.0,"wantedMatch":"... or null"}]}`;
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-5.6',
        input: [{ role: 'user', content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: image }
        ] }],
        max_output_tokens: 1200
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'AI request failed.' });
    const text = data.output?.flatMap(x => x.content || []).filter(x => x.type === 'output_text').map(x => x.text).join('') || '';
    const clean = text.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch { return res.status(502).json({ error: 'AI returned invalid recognition data.' }); }
    return res.status(200).json(parsed);
  } catch (e) { return res.status(500).json({ error: 'Recognition service error.' }); }
}
