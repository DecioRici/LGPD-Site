const ID=/^[a-zA-Z0-9_-]{1,80}$/;
const PHONE=/^55[1-9]\d[2-9]\d{7,8}$/;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const env=process.env;
  const configured=Boolean(env.WHAPI_TOKEN && env.SUPABASE_URL && env.SUPABASE_BACKEND_TOKEN);
  if(req.method==='GET') {
    if(!configured) return res.status(200).json({configured:false,limit:100,message:'Envio indisponível: configure a conexão do Whapi.Cloud.'});
    try {
      const check=await fetch('https://gate.whapi.cloud/health',{headers:{Authorization:'Bearer '+env.WHAPI_TOKEN,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
      const health=await check.json();
      const connected=check.ok && health.status?.text==='AUTH';
      if(!connected) console.warn('whapi_health_status', {httpStatus:check.status,channelState:['NOT_INIT','INIT','LAUNCH','QR','AUTH','ERROR','SYNC_ERROR'].includes(health.status?.text)?health.status.text:'UNKNOWN'});
      return res.status(200).json({configured:connected,limit:100,message:connected?'WhatsApp conectado para envio direto.':([401,403].includes(check.status)?'O Whapi.Cloud recusou o token. Confira o API Token do canal conectado.':'O Whapi.Cloud não confirmou a conexão. Confira o canal no painel do Whapi.')});
    } catch(error) {
      console.warn('whapi_health_failed', {name:error?.name,code:error?.cause?.code || error?.code || 'UNKNOWN'});
      return res.status(503).json({error:error?.name==='TimeoutError'?'O Whapi.Cloud não respondeu à verificação em 20 segundos. Tente novamente.':'Não foi possível verificar a conexão do Whapi.Cloud. Tente novamente.'});
    }
  }
  if(req.method!=='POST') return res.status(405).json({error:'Método não permitido.'});
  let sameOrigin=false;
  try {sameOrigin=new URL(req.headers.origin).host===req.headers.host;} catch {}
  if(!sameOrigin || req.headers['sec-fetch-site']==='cross-site') return res.status(403).json({error:'Origem não permitida.'});
  if(!configured) return res.status(503).json({error:'A conexão do Whapi.Cloud ainda não foi configurada no site.'});
  let body=req.body;
  try {if(typeof body==='string') body=JSON.parse(body);} catch {return res.status(400).json({error:'Conteúdo inválido.'});}
  if(!body || !ID.test(body.recordId || '') || !PHONE.test(body.phone || '') || typeof body.stageAt!=='string' || body.stageAt.length>40) return res.status(400).json({error:'Confira o veículo e o WhatsApp com DDD.'});
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
    const weighing=reservation.stage===4?'pesagem final':'pesagem inicial';
    result=await fetch('https://gate.whapi.cloud/messages/text',{
      method:'POST',headers:{Authorization:'Bearer '+env.WHAPI_TOKEN,'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({to:body.phone,body:'Olá, '+reservation.driver+'. O caminhão de placa '+reservation.plate+' está sendo chamado para a '+weighing+'. Dirija-se à balança, por favor.'}),
      signal:AbortSignal.timeout(20000)
    });
    data=await result.json();
  } catch {
    await ledger({action:'result',key:reservation.key,status:'unknown'}).catch(()=>{});
    return res.status(502).json({error:'Não foi possível confirmar o envio. Confira o WhatsApp antes de fazer nova chamada.'});
  }
  const messageId=typeof data.message?.id==='string'?data.message.id:null;
  if(!result.ok || data.sent!==true) {
    await ledger({action:'result',key:reservation.key,status:'failed'}).catch(()=>{});
    const errors={401:'Whapi.Cloud desconectado ou token inválido. Confira o canal remetente.',402:'O limite gratuito do Whapi.Cloud foi atingido.',403:'O Whapi.Cloud não autorizou este destinatário.',429:'O Whapi.Cloud recebeu muitas chamadas. Aguarde antes de uma nova chamada.'};
    return res.status(502).json({error:errors[result.status] || 'O Whapi.Cloud não confirmou o envio. Confira a conexão e o número do destinatário.'});
  }
  try {await ledger({action:'result',key:reservation.key,status:'submitted',messageId});}
  catch {return res.status(202).json({status:'submitted',messageId,warning:'A API aceitou a chamada, mas o registro final ficou pendente. Não repita o envio.'});}
  return res.status(200).json({status:'submitted',messageId});
}
