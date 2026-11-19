const ID=/^[a-zA-Z0-9_-]{1,80}$/;
const PHONE=/^55[1-9]\d[2-9]\d{7,8}$/;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const env=process.env;
  const allowed=(env.WHATSAPP_ALLOWED_RECIPIENTS || '').split(',').map(s=>s.trim()).filter(s=>PHONE.test(s));
  const configured=Boolean(env.WHATSAPP_ACCESS_TOKEN && /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID || '') && /^[a-z0-9_]+$/.test(env.WHATSAPP_TEMPLATE_NAME || '') && allowed.length && env.SUPABASE_URL && env.SUPABASE_BACKEND_TOKEN);
  if(req.method==='GET') return res.status(200).json({configured,limit:100,message:configured?'Envio direto pelo WhatsApp':'Envio indisponível: conecte o número remetente à API do WhatsApp.'});
  if(req.method!=='POST') return res.status(405).json({error:'Método não permitido.'});
  let sameOrigin=false;
  try {sameOrigin=new URL(req.headers.origin).host===req.headers.host;} catch {}
  if(!sameOrigin || req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Origem não permitida.'});
  if(!configured) return res.status(503).json({error:'O número remetente ainda não foi conectado à API do WhatsApp.'});
  let body=req.body;
  try {if(typeof body==='string') body=JSON.parse(body);} catch {return res.status(400).json({error:'Conteúdo inválido.'});}
  if(!body || !ID.test(body.recordId || '') || !PHONE.test(body.phone || '') || typeof body.stageAt!=='string' || body.stageAt.length>40) return res.status(400).json({error:'Confira o veículo e o WhatsApp com DDD.'});
  if(!allowed.includes(body.phone)) return res.status(403).json({error:'Este número não foi autorizado para a demonstração.'});
  const ledger=async(data)=>{
    const result=await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/patio-whatsapp',{method:'POST',headers:{'Content-Type':'application/json','x-patio-backend-token':env.SUPABASE_BACKEND_TOKEN},body:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
    const value=await result.json();
    if(!result.ok) {const error=new Error(value.error || 'Não foi possível registrar a chamada.');error.status=result.status;throw error;}
    return value;
  };
  let reservation;
  try {
    reservation=await ledger({action:'reserve',recordId:body.recordId,phone:body.phone,stageAt:body.stageAt});
  } catch(error) {return res.status(error.status || 503).json({error:error.message});}
  if(reservation.existing) {
    if(reservation.status==='submitted') return res.status(200).json({status:'submitted',duplicate:true,messageId:reservation.messageId});
    return res.status(409).json({error:'Esta chamada já foi registrada. Confira o WhatsApp antes de tentar outro envio.'});
  }
  let result, data;
  try {
    result=await fetch('https://graph.facebook.com/'+(env.WHATSAPP_API_VERSION || 'v27.0')+'/'+env.WHATSAPP_PHONE_NUMBER_ID+'/messages',{
      method:'POST',headers:{Authorization:'Bearer '+env.WHATSAPP_ACCESS_TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to:body.phone,type:'template',template:{name:env.WHATSAPP_TEMPLATE_NAME,language:{code:env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR'},components:[{type:'body',parameters:[{type:'text',text:reservation.driver},{type:'text',text:reservation.plate},{type:'text',text:reservation.stage===4?'pesagem final':'pesagem inicial'}]}]}}),
      signal:AbortSignal.timeout(12000)
    });
    data=await result.json();
  } catch {
    await ledger({action:'result',key:reservation.key,status:'unknown'}).catch(()=>{});
    return res.status(502).json({error:'Não foi possível confirmar o envio. Confira o WhatsApp antes de fazer nova chamada.'});
  }
  const messageId=data.messages?.[0]?.id;
  if(!result.ok || typeof messageId!=='string') {
    await ledger({action:'result',key:reservation.key,status:'failed'}).catch(()=>{});
    return res.status(502).json({error:'O WhatsApp recusou a chamada. Confira o remetente, o destinatário e o modelo aprovado na Meta.'});
  }
  try {await ledger({action:'result',key:reservation.key,status:'submitted',messageId});}
  catch {return res.status(202).json({status:'submitted',messageId,warning:'A Meta aceitou a chamada, mas o registro final ficou pendente. Não repita o envio.'});}
  return res.status(200).json({status:'submitted',messageId});
}
