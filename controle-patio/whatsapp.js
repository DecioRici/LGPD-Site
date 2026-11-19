'use strict';
window.PatioWhatsApp=(()=>{
  const modal=document.querySelector('#whatsapp-dialog');
  const send=document.querySelector('#whatsapp-send');
  const status=document.querySelector('#whatsapp-status');
  let selected=null;
  let busy=false;
  let ready=false;
  let previous=false;
  let deadline=0;
  let timer;
  let generation=0;
  function normalizePhone(value) {
    let phone=String(value || '').replace(/\D/g,'');
    if(phone.length===10 || phone.length===11) phone='55'+phone;
    return /^55[1-9]\d[2-9]\d{7,8}$/.test(phone)?phone:'';
  }
  function updateButton() {
    const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    send.disabled=busy || !ready || seconds>0;
    send.textContent=busy?'Enviando…':seconds>0?'Chamar novamente em '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):previous?'Chamar novamente':'Enviar chamada';
  }
  function cooldown(seconds=60) {deadline=Date.now()+Math.max(0,Number(seconds)||0)*1000;updateButton();}
  async function open(record) {
    if(busy) return;
    const current=++generation;
    selected=null;ready=false;previous=false;deadline=0;
    clearInterval(timer);
    status.textContent='Verificando conexão com o WhatsApp…';
    updateButton();
    const phone=normalizePhone(record.whatsapp);
    const weighing=record.stage===4?'pesagem final':'pesagem inicial';
    document.querySelector('#whatsapp-recipient').textContent=record.driver+' · '+record.plate+' · '+(phone?'+'+phone:'WhatsApp não cadastrado');
    document.querySelector('#whatsapp-preview').textContent='Olá, '+record.driver+'. O caminhão de placa '+record.plate+' está sendo chamado para a '+weighing+'. Dirija-se à balança, por favor.';
    modal.showModal();
    timer=setInterval(updateButton,1000);
    if(!phone) {status.textContent='Edite o cadastro e informe o WhatsApp do motorista com DDD.';return;}
    try {
      const response=await fetch('/api/whatsapp?recordId='+encodeURIComponent(record.id),{cache:'no-store',signal:AbortSignal.timeout(45000)});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'Não foi possível verificar a conexão com o WhatsApp.');
      if(current!==generation || !modal.open) return;
      if(!data.configured) {status.textContent=data.message || 'A conexão do WhatsApp ainda não foi configurada.';return;}
      selected={recordId:record.id,phone,stageAt:record.stageEnteredAt};
      ready=true;previous=Boolean(data.lastStatus);
      status.textContent=data.lastStatus==='submitted' && data.retryAfter>0?'Mensagem enviada.':data.lastStatus==='reserved' && data.retryAfter>0?'Envio em processamento.':'';
      cooldown(data.retryAfter || 0);
    } catch(error) {if(current===generation) status.textContent=error.message || 'Não foi possível verificar a conexão com o WhatsApp.';}
  }
  function close() {if(!busy) {generation++;selected=null;ready=false;clearInterval(timer);modal.close();}}
  document.querySelector('#whatsapp-close').addEventListener('click',close);
  document.querySelector('#whatsapp-cancel').addEventListener('click',close);
  modal.addEventListener('cancel',event=>{if(busy) event.preventDefault();else {generation++;selected=null;ready=false;clearInterval(timer);}});
  send.addEventListener('click',async()=>{
    if(busy || !selected || !ready || deadline>Date.now()) return;
    busy=true;previous=true;updateButton();
    status.textContent='Enviando mensagem…';
    try {
      const response=await fetch('/api/whatsapp',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...selected,requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(60000)});
      const data=await response.json();
      cooldown(data.retryAfter ?? 60);
      if(!response.ok) throw new Error(data.error || 'Não foi possível enviar a mensagem.');
      status.textContent='Mensagem enviada.';
    } catch(error) {
      if(deadline<=Date.now()) cooldown(60);
      status.textContent=['TimeoutError','AbortError'].includes(error.name)?'Não foi possível confirmar o envio. Confira o WhatsApp antes de chamar novamente.':error.message;
    } finally {busy=false;updateButton();}
  });
  window.addEventListener('beforeunload',event=>{if(busy) {event.preventDefault();event.returnValue='';}});
  return {open,normalizePhone,isOpen:()=>modal.open};
})();
