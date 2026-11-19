// Server-to-server ledger; the browser never receives database or Meta credentials.
const json = (status, body) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
export async function handleWhatsAppLedger(req) {
  if (req.method !== 'POST') return json(405,{error:'Method not allowed'});
  const token=req.headers.get('x-patio-backend-token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return json(401,{error:'Unauthorized'});
  try {
    const url=Deno.env.get('SUPABASE_URL');
    let key;
    try {key=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;} catch {}
    key ||= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const headers={'Content-Type':'application/json',apikey:key};
    if (key.split('.').length===3) headers.Authorization='Bearer '+key;
    const db=async(path,method='GET',body)=>{
      const result=await fetch(url+'/rest/v1/'+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
      if (!result.ok) throw new Error('Database unavailable');
      return result.status===204?null:result.json();
    };
    const keys=await db('patio_backend_keys?id=eq.vercel&select=token_hash');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    const actual=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const expected=keys[0]?.token_hash || '';
    if(expected.length!==64) return json(401,{error:'Unauthorized'});
    let difference=0;
    for(let i=0;i<64;i++) difference|=actual.charCodeAt(i)^expected.charCodeAt(i);
    if(difference) return json(401,{error:'Unauthorized'});
    if(Number(req.headers.get('content-length') || 0)>4096) return json(413,{error:'Payload too large'});
    const raw=await req.text();
    if(raw.length>4096) return json(413,{error:'Payload too large'});
    const data=JSON.parse(raw);
    if(data.action==='reserve') {
      if(!/^[a-zA-Z0-9_-]{1,80}$/.test(data.recordId || '') || !/^55[1-9]\d[2-9]\d{7,8}$/.test(data.phone || '') || typeof data.stageAt!=='string' || data.stageAt.length>40) return json(400,{error:'Invalid payload'});
      if(data.requestId!==undefined && !/^[a-zA-Z0-9_-]{1,80}$/.test(data.requestId)) return json(400,{error:'Invalid request ID'});
      const result=data.requestId
        ? await db('rpc/patio_reserve_whatsapp_call','POST',{p_record_id:data.recordId,p_phone:data.phone,p_stage_at:data.stageAt,p_request_id:data.requestId})
        : await db('rpc/patio_reserve_whatsapp','POST',{p_record_id:data.recordId,p_phone:data.phone,p_stage_at:data.stageAt});
      return json(result.code || 200,result);
    }
    if(data.action==='status') {
      if(!/^[a-zA-Z0-9_-]{1,80}$/.test(data.recordId || '')) return json(400,{error:'Invalid record ID'});
      const rows=await db('patio_whatsapp_calls?record_id=eq.'+encodeURIComponent(data.recordId)+'&select=status,created_at&order=created_at.desc&limit=1');
      const last=rows[0];
      const retryAfter=last?Math.max(0,Math.ceil((Date.parse(last.created_at)+60000-Date.now())/1000)):0;
      return json(200,{lastStatus:last?.status || null,retryAfter});
    }
    if(data.action==='result') {
      if(typeof data.key!=='string' || data.key.length>140 || !['submitted','failed','unknown'].includes(data.status) || (data.messageId && !/^[\w.=:/-]{1,500}$/.test(data.messageId))) return json(400,{error:'Invalid payload'});
      await db('patio_whatsapp_calls?call_key=eq.'+encodeURIComponent(data.key)+'&status=eq.reserved','PATCH',{status:data.status,message_id:data.messageId || null});
      return json(200,{ok:true});
    }
    return json(400,{error:'Invalid action'});
  } catch {return json(503,{error:'Não foi possível registrar a chamada no banco.'});}
}
Deno.serve(handleWhatsAppLedger);
