// Server-to-server access only. This token is never sent to the browser.
const SELECT = 'revision,records,history,last_mutation_id';
const MAX_BYTES = 3 * 1024 * 1024;
const TOKEN = /^[a-f0-9]{64}$/;
const response = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function handlePatioStore(request) {
  const token = request.headers.get('x-patio-backend-token') || '';
  if (!TOKEN.test(token)) return response(401, { error: 'Unauthorized' });
  if (!['GET', 'PATCH'].includes(request.method)) return response(405, { error: 'Method not allowed' });
  const query = new URL(request.url).searchParams;
  if (query.get('id') !== 'eq.main' || query.get('select') !== SELECT ||
      [...query.keys()].some(key => !['id', 'select', 'revision'].includes(key)) ||
      [...query.keys()].some(key => query.getAll(key).length !== 1) ||
      (request.method === 'PATCH' && !/^eq\.\d+$/.test(query.get('revision') || '')) ||
      (request.method === 'GET' && query.has('revision'))) {
    return response(400, { error: 'Invalid query' });
  }
  try {
    const url = Deno.env.get('SUPABASE_URL');
    let key;
    try { key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; } catch {}
    key ||= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return response(503, { error: 'Database unavailable' });
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key.split('.').length === 3) headers.Authorization = 'Bearer ' + key;
    const auth = await fetch(url + '/rest/v1/patio_backend_keys?id=eq.vercel&select=token_hash', {
      headers, signal: AbortSignal.timeout(10000)
    });
    if (!auth.ok) throw new Error('Database unavailable');
    const keys = await auth.json();
    const expected = keys[0]?.token_hash;
    if (!TOKEN.test(expected || '')) return response(401, { error: 'Unauthorized' });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    let difference = 0;
    for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    if (difference !== 0) return response(401, { error: 'Unauthorized' });
    let body;
    if (request.method === 'PATCH') {
      body = await request.text();
      if (new TextEncoder().encode(body).length > MAX_BYTES) return response(413, { error: 'Payload too large' });
      let data;
      try { data = JSON.parse(body); } catch { return response(400, { error: 'Invalid payload' }); }
      if (!data || !Number.isSafeInteger(data.revision) || data.revision < 1 ||
          query.get('revision') !== 'eq.' + (data.revision - 1) ||
          !Array.isArray(data.records) || data.records.length > 2000 ||
          !Array.isArray(data.history) || data.history.length > 20000 ||
          !/^[a-zA-Z0-9_-]{1,80}$/.test(data.last_mutation_id || '') ||
          typeof data.updated_at !== 'string' || !Number.isFinite(Date.parse(data.updated_at)) ||
          Object.keys(data).some(key => !['revision','records','history','last_mutation_id','updated_at'].includes(key))) {
        return response(400, { error: 'Invalid payload' });
      }
    }
    const result = await fetch(url + '/rest/v1/patio_board?' + query.toString(), {
      method: request.method,
      headers: { ...headers, Prefer: 'return=representation' },
      body, signal: AbortSignal.timeout(10000)
    });
    if (!result.ok) throw new Error('Database unavailable');
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('Invalid database response');
    return response(200, rows);
  } catch {
    return response(503, { error: 'Database unavailable' });
  }
}

Deno.serve(handlePatioStore);
