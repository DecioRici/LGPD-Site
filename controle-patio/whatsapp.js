'use strict';
window.PatioWhatsApp=(()=>{
  const modal=document.querySelector('#whatsapp-dialog');
  const send=document.querySelector('#whatsapp-send');
  const status=document.querySelector('#whatsapp-status');
  let pending=null;
  let busy=false;
  let generation=0;
  function normalizePhone(value) {
    let phone=String(value || '').replace(/\D/g,'');
    if(phone.length===10 || phone.length===11) phone='55'+phone;
    return /^55[1-9]\d[2-9]\d{7,8}$/.test(phone)?phone:'';
  }
  async function open(record) {
    if(busy) return;
    const current=++generation;
    pending=null;
    status.textContent='Verificando conexão com o WhatsApp…';
    send.disabled=true;
    const phone=normalizePhone(record.whatsapp);
    const weighing=record.stage===4?'pesagem final':'pesagem inicial';
    document.querySelector('#whatsapp-recipient').textContent=record.driver+' · '+record.plate+' · '+(phone?'+'+phone:'WhatsApp não cadastrado');
    document.querySelector('#whatsapp-preview').textContent='Olá, '+record.driver+'. O caminhão de placa '+record.plate+' está sendo chamado para a '+weighing+'. Dirija-se à balança, por favor.';
    modal.showModal();
    if(!phone) {status.textContent='Edite o cadastro e informe o WhatsApp do motorista com DDD.';return;}
    try {
      const response=await fetch('/api/whatsapp',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw new Error();
      const data=await response.json();
      if(current!==generation || !modal.open) return;
      if(!data.configured) {status.textContent=data.message || 'O número remetente ainda não foi conectado.';return;}
      pending={recordId:record.id,phone,stageAt:record.stageEnteredAt};
      status.textContent='Envio direto para o motorista. Limite da demonstração: 100 tentativas.';
      send.disabled=false;
    } catch {if(current===generation) status.textContent='Não foi possível verificar a conexão com o WhatsApp.';}
  }
  function close() {if(!busy) {generation++;pending=null;modal.close();}}
  document.querySelector('#whatsapp-close').addEventListener('click',close);
  document.querySelector('#whatsapp-cancel').addEventListener('click',close);
  modal.addEventListener('cancel',event=>{if(busy) event.preventDefault();else {generation++;pending=null;}});
  send.addEventListener('click',async()=>{
    if(busy || !pending) return;
    busy=true;send.disabled=true;send.textContent='Enviando…';
    status.textContent='Enviando a chamada ao WhatsApp…';
    try {
      const response=await fetch('/api/whatsapp',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending),signal:AbortSignal.timeout(45000)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'Falha no envio.');
      status.textContent=data.warning || (data.duplicate?'Esta chamada já foi aceita pela Meta. O envio não foi repetido.':'Chamada aceita pela Meta para envio. Isso ainda não confirma a entrega ao motorista.');
    } catch(error) {
      status.textContent=error.name==='TimeoutError'?'Resposta não recebida. Confira o WhatsApp antes de repetir a chamada.':error.message;
    } finally {busy=false;pending=null;send.textContent='Enviar chamada';}
  });
  window.addEventListener('beforeunload',event=>{if(busy) {event.preventDefault();event.returnValue='';}});
  return {open,normalizePhone,isOpen:()=>modal.open};
})();
