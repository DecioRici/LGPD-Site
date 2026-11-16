import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import fs from 'node:fs/promises';

globalThis.crypto ??= webcrypto;
globalThis.Deno = { env: { get: name => ({ SUPABASE_URL: 'https://database.example', SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test_server_only' }) })[name] }, serve() {} };
const source = await fs.readFile(new URL('../supabase/functions/patio-store/index.ts', import.meta.url), 'utf8');
const { handlePatioStore } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const token='a'.repeat(64);
const hash=createHash('sha256').update(token).digest('hex');
const query='id=eq.main&select=revision,records,history,last_mutation_id';
const row={revision:0,records:[],history:[],last_mutation_id:null};
const patch={revision:1,records:[],history:[],last_mutation_id:'test1',updated_at:new Date().toISOString()};
function request(method='GET', suffix='', key=token, body) {
 return new Request('https://database.example/functions/v1/patio-store?'+query+suffix,{method,headers:{'x-patio-backend-token':key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
}
test('acesso restrito da função do banco', async t=>{
 const original=globalThis.fetch; let calls=[];
 function mock(fail=false) {
 calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});
  assert.equal(options.headers.apikey,'sb_secret_test_server_only');
  assert.equal(options.headers.Authorization,undefined);
  if(fail)throw new Error('sb_secret_test_server_only');
  if(url.includes('patio_backend_keys'))return Response.json([{token_hash:hash}]);
  return Response.json([row]);
 };
 }
 try {
 await t.test('sem token nega sem consultar dados',async()=>{mock();assert.equal((await handlePatioStore(request('GET','',''))).status,401);assert.equal(calls.length,0);});
 await t.test('token errado nega sem consultar o quadro',async()=>{mock();assert.equal((await handlePatioStore(request('GET','','b'.repeat(64)))).status,401);assert.equal(calls.length,1);});
 await t.test('bloqueia métodos e consultas fora do quadro',async()=>{mock();assert.equal((await handlePatioStore(request('DELETE'))).status,405);assert.equal((await handlePatioStore(request('GET','&extra=x'))).status,400);assert.equal((await handlePatioStore(request('GET','&id=eq.other'))).status,400);assert.equal(calls.length,0);});
 await t.test('leitura autorizada retorna apenas a base',async()=>{mock();const r=await handlePatioStore(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),[row]);assert.equal(calls.length,2);});
 await t.test('atualização encaminha a revisão e o conteúdo juntos',async()=>{mock();const r=await handlePatioStore(request('PATCH','&revision=eq.0',token,patch));assert.equal(r.status,200);assert.deepEqual(JSON.parse(calls[1].options.body),patch);assert.equal(new URL(calls[1].url).searchParams.get('revision'),'eq.0');});
 await t.test('rejeita atualização sem revisão e campos extras',async()=>{mock();assert.equal((await handlePatioStore(request('PATCH','',token,patch))).status,400);assert.equal((await handlePatioStore(request('PATCH','&revision=eq.0',token,{...patch,token_hash:'x'}))).status,400);assert.equal((await handlePatioStore(request('PATCH','&revision=eq.2',token,patch))).status,400);});
 await t.test('não transmite erros nem credenciais internas',async()=>{mock(true);const r=await handlePatioStore(request());assert.equal(r.status,503);assert.ok(!(await r.text()).includes('sb_secret_test_server_only'));});
 }finally{globalThis.fetch=original;}
});
