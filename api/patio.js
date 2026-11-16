import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'patio_session';
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_BYTES = 3 * 1024 * 1024;
const ID = /^[a-zA-Z0-9_-]{1,80}$/;

function sameSecret(left, right) {
  const hash = value => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(hash(left), hash(right));
}

function signature(value, key) {
  return createHmac('sha256', key).update(value).digest('base64url');
}

function authenticated(req, key, password) {
  const cookie = String(req.headers.cookie || '').split(';')
    .map(value => value.trim()).find(value => value.startsWith(COOKIE + '='));
  if (!cookie) return false;
  const [expires, nonce, signed] = cookie.slice(COOKIE.length + 1).split('.');
  const expiry = Number(expires);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() / 1000 || !nonce || !signed) return false;
  return sameSecret(signature(expires + '.' + nonce + '.' + password, key), signed);
}

function validDate(value) {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function validState(body) {
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER || typeof body.mutationId !== 'string' || !ID.test(body.mutationId)) return false;
  if (!Array.isArray(body.records) || !Array.isArray(body.history) ||
      body.records.length > 2000 || body.history.length > 20000) return false;
  const recordIds = new Set();
  const historyIds = new Set();
  for (const record of body.records) {
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !ID.test(record.id) || recordIds.has(record.id)) return false;
    recordIds.add(record.id);
    for (const field of ['order', 'plate', 'driver', 'carrier', 'product', 'unit', 'operation', 'freight', 'date', 'time']) {
      if (typeof record[field] !== 'string' || !record[field].trim() || record[field].length > 200) return false;
    }
    if (typeof record.cpf !== 'string' || record.cpf.length > 20 ||
        typeof record.notes !== 'string' || record.notes.length > 2000 ||
        !/^[A-Z0-9]{1,7}$/.test(record.plate) ||
        !Number.isFinite(record.quantity) || record.quantity <= 0 ||
        !Number.isInteger(record.stage) || record.stage < 0 || record.stage > 6 ||
        typeof record.cancelled !== 'boolean' ||
        !['Carga', 'Descarga'].includes(record.operation) ||
        !['CIF', 'FOB', 'Próprio'].includes(record.freight) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time) ||
        !validDate(record.date + 'T' + record.time + ':00') ||
        !validDate(record.createdAt) || !validDate(record.stageEnteredAt)) return false;
  }
  for (const event of body.history) {
    if (!event || typeof event !== 'object' || typeof event.id !== 'string' || typeof event.recordId !== 'string' || !ID.test(event.id) ||
        historyIds.has(event.id) || !recordIds.has(event.recordId) || !validDate(event.at)) return false;
    historyIds.add(event.id);
    for (const field of ['plate', 'order', 'from', 'to', 'action']) {
      if (typeof event[field] !== 'string' || event[field].length > 200) return false;
    }
  }
  return true;
}

function publicState(row) {
  return {
    revision: row.revision,
    records: row.records,
    history: row.history,
    mutationId: row.last_mutation_id
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.KANBAN_ACCESS_PASSWORD;
  const action = new URL(req.url, 'https://localhost').searchParams.get('action') || 'state';
  const configured = Boolean(url && key && password);
  if (req.method === 'GET' && action === 'config') {
    if ((url || key || password) && !configured) {
      return res.status(503).json({ error: 'A configuração do banco está incompleta.' });
    }
    return res.status(200).json({ configured });
  }
  if (!configured) return res.status(503).json({ error: 'Banco de dados ainda não configurado.' });
  if (!/^https:\/\//.test(url) || password.length < 16 || password.length > 256) {
    return res.status(503).json({ error: 'Confira a URL do banco e use uma senha de pelo menos 16 caracteres.' });
  }
  if (!['GET', 'POST', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (req.method !== 'GET') {
    let originMatches = false;
    try { originMatches = new URL(req.headers.origin).host === req.headers.host; } catch {}
    if (!originMatches || req.headers['sec-fetch-site'] === 'cross-site') {
      return res.status(403).json({ error: 'Origem não permitida.' });
    }
  }
  let body = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body);
    if (Buffer.byteLength(JSON.stringify(body || {})) > MAX_BYTES) {
      return res.status(413).json({ error: 'A base excede o limite de 3 MB por gravação. Exporte os registros antigos.' });
    }
  } catch {
    return res.status(400).json({ error: 'Conteúdo inválido.' });
  }
  if (action === 'login' && req.method === 'POST') {
    if (typeof body?.password !== 'string' || body.password.length > 256 || !sameSecret(body.password, password)) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const nonce = signature(String(Date.now()) + Math.random(), key).slice(0, 20);
    const signed = signature(expires + '.' + nonce + '.' + password, key);
    res.setHeader('Set-Cookie', COOKIE + '=' + expires + '.' + nonce + '.' + signed +
      '; HttpOnly; Secure; SameSite=Strict; Path=/api/patio; Max-Age=' + SESSION_SECONDS);
    return res.status(200).json({ ok: true });
  }
  if (action === 'logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', COOKIE + '=; HttpOnly; Secure; SameSite=Strict; Path=/api/patio; Max-Age=0');
    return res.status(200).json({ ok: true });
  }
  if (!authenticated(req, key, password)) return res.status(401).json({ error: 'Entre para acessar a base compartilhada.' });
  if (action !== 'state') return res.status(404).json({ error: 'Ação não encontrada.' });
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.split('.').length === 3) headers.Authorization = 'Bearer ' + key;
  const endpoint = url.replace(/\/$/, '') + '/rest/v1/patio_board';
  const select = 'id=eq.main&select=revision,records,history,last_mutation_id';
  async function database(method, query, data) {
    const result = await fetch(endpoint + '?' + query, {
      method, headers: { ...headers, Prefer: 'return=representation' },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(15000)
    });
    if (!result.ok) throw new Error('Database request failed');
    const rows = await result.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected database response');
    return rows;
  }
  try {
    if (req.method === 'GET') {
      const rows = await database('GET', select);
      if (!rows.length) return res.status(503).json({ error: 'Execute o SQL de configuração do Kanban no Supabase.' });
      return res.status(200).json(publicState(rows[0]));
    }
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Utilize GET ou PUT para a base.' });
    if (!validState(body)) return res.status(400).json({ error: 'Confira os campos dos registros e do histórico.' });
    const current = await database('GET', select);
    if (current[0]?.last_mutation_id === body.mutationId) return res.status(200).json(publicState(current[0]));
    const rows = await database('PATCH', select + '&revision=eq.' + body.revision, {
      records: body.records, history: body.history, revision: body.revision + 1,
      last_mutation_id: body.mutationId, updated_at: new Date().toISOString()
    });
    if (!rows.length) {
      return res.status(409).json({ error: 'Outro usuário alterou a base. Confira a atualização e refaça sua alteração.' });
    }
    return res.status(200).json(publicState(rows[0]));
  } catch {
    return res.status(503).json({ error: 'Não foi possível acessar o banco. Confira a conexão e a configuração do Supabase.' });
  }
}
