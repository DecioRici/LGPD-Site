import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/patio.js';

const origin = 'https://kanban.example';
const password = 'senha-de-teste-com-mais-de-16';
const key = 'chave-apenas-para-teste';
const record = {
  id: 'r1', order: 'AG-1', plate: 'ABC1D23', driver: 'Motorista',
  cpf: '', carrier: 'Transportadora', product: 'Produto', quantity: 10,
  unit: 'kg', operation: 'Carga', freight: 'CIF', date: '2026-11-16',
  time: '10:00', notes: '', stage: 0, cancelled: false,
  createdAt: '2026-11-16T10:00:00Z', stageEnteredAt: '2026-11-16T10:00:00Z'
};
const event = {
  id: 'e1', recordId: 'r1', plate: 'ABC1D23', order: 'AG-1',
  from: 'Cadastro', to: 'Agendado', action: 'Cadastro', at: record.createdAt
};

function setup() {
  delete process.env.SUPABASE_BACKEND_TOKEN;
  process.env.SUPABASE_URL = 'https://database.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  process.env.KANBAN_ACCESS_PASSWORD = password;
}

async function request(action, method = 'GET', body, cookie, headers = {}) {
  const result = { code: 200, headers: {}, body: null };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.code = code; return response; },
    json(data) { result.body = data; return response; }
  };
  await handler({
    url: '/api/patio?action=' + action, method, body,
    headers: { host: 'kanban.example', origin, cookie, ...headers }
  }, response);
  return result;
}

async function login() {
  const result = await request('login', 'POST', { password });
  assert.equal(result.code, 200);
  return result.headers['Set-Cookie'].split(';')[0];
}

function database(initial) {
  let state = structuredClone(initial);
  let updates = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.apikey, key);
    const query = new URL(url).searchParams;
    if (options.method === 'GET') return Response.json([state]);
    assert.equal(options.method, 'PATCH');
    if (query.get('revision') !== 'eq.' + state.revision) return Response.json([]);
    state = { ...state, ...JSON.parse(options.body) };
    updates++;
    return Response.json([state]);
  };
  return { state: () => state, updates: () => updates };
}

test('base compartilhada, autenticação, conflitos e novas tentativas', async t => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = { ...process.env };
  setup();
  try {
    await t.test('modo local quando todas as variáveis estão ausentes', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.KANBAN_ACCESS_PASSWORD;
      assert.deepEqual((await request('config')).body, { configured: false });
      setup();
    });

    await t.test('configuração parcial falha sem anunciar modo local', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      assert.equal((await request('config')).code, 503);
      setup();
    });

    await t.test('nega dados sem sessão e não divulga credenciais', async () => {
      const result = await request('state');
      assert.equal(result.code, 401);
      assert.ok(!JSON.stringify(result).includes(key));
    });

    await t.test('senha e origem incorretas são rejeitadas', async () => {
      assert.equal((await request('login', 'POST', { password: 'errada' })).code, 401);
      assert.equal((await request('login', 'POST', { password }, null, { origin: 'https://outro.example' })).code, 403);
      assert.equal((await request('login', 'POST', { password }, null, { origin: undefined })).code, 403);
    });

    const cookie = await login();
    await t.test('cookie adulterado é rejeitado', async () => {
      assert.equal((await request('state', 'GET', null, cookie + 'x')).code, 401);
    });

    await t.test('registro e histórico são gravados na mesma atualização', async () => {
      const db = database({ revision: 0, records: [], history: [], last_mutation_id: null });
      const payload = { revision: 0, records: [record], history: [event], mutationId: 'm1' };
      const result = await request('state', 'PUT', payload, cookie);
      assert.equal(result.code, 200);
      assert.equal(db.updates(), 1);
      assert.deepEqual(db.state().records, [record]);
      assert.deepEqual(db.state().history, [event]);
      assert.equal(result.body.revision, 1);
    });

    await t.test('versão antiga não sobrescreve alterações de outro usuário', async () => {
      const db = database({ revision: 2, records: [record], history: [event], last_mutation_id: 'other' });
      const result = await request('state', 'PUT', { revision: 0, records: [], history: [], mutationId: 'm2' }, cookie);
      assert.equal(result.code, 409);
      assert.equal(db.updates(), 0);
      assert.deepEqual(db.state().records, [record]);
    });

    await t.test('repetição da gravação confirmada não duplica eventos', async () => {
      const db = database({ revision: 1, records: [record], history: [event], last_mutation_id: 'm1' });
      const result = await request('state', 'PUT', { revision: 0, records: [record], history: [event], mutationId: 'm1' }, cookie);
      assert.equal(result.code, 200);
      assert.equal(db.updates(), 0);
      assert.equal(result.body.history.length, 1);
    });

    await t.test('valida identificadores, etapas e referências do histórico', async () => {
      database({ revision: 0, records: [], history: [], last_mutation_id: null });
      const base = { revision: 0, records: [record], history: [event], mutationId: 'valid' };
      for (const payload of [
        { ...base, mutationId: undefined },
        { ...base, records: [{ ...record, id: undefined }] },
        { ...base, records: [{ ...record, id: '"><img>' }] },
        { ...base, records: [{ ...record, stage: 8 }] },
        { ...base, records: [record, record] },
        { ...base, history: [{ ...event, recordId: 'unknown' }] }
      ]) assert.equal((await request('state', 'PUT', payload, cookie)).code, 400);
    });

    await t.test('função autenticada usa token privado sem expor a chave do projeto', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.SUPABASE_BACKEND_TOKEN = 'b'.repeat(64);
      const bridgeCookie = await login();
      globalThis.fetch = async (url, options) => {
        assert.equal(new URL(url).pathname, '/functions/v1/patio-store');
        assert.equal(options.headers['x-patio-backend-token'], 'b'.repeat(64));
        assert.equal(options.headers.apikey, undefined);
        return Response.json([{ revision: 0, records: [], history: [], last_mutation_id: null }]);
      };
      assert.deepEqual((await request('config')).body, { configured: true });
      const result = await request('state', 'GET', null, bridgeCookie);
      assert.equal(result.code, 200);
      assert.ok(!JSON.stringify(result).includes('b'.repeat(64)));
      setup();
    });

    await t.test('falha no Supabase retorna erro sem detalhes privados', async () => {
      globalThis.fetch = async () => { throw new Error('secret database detail ' + key); };
      const result = await request('state', 'GET', null, cookie);
      assert.equal(result.code, 503);
      assert.ok(!JSON.stringify(result).includes(key));
      assert.equal(result.headers['Cache-Control'], 'no-store');
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_BACKEND_TOKEN', 'KANBAN_ACCESS_PASSWORD']) {
      if (originalEnvironment[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnvironment[name];
    }
  }
});
