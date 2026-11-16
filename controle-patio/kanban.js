'use strict';
const STAGES=['Agendado','Check-in','Aguardando no Pátio','Pesagem Inicial','Carregamento ou Descarga','Pesagem Final','Liberado'];
const STORE='controle-patio-v1';
const HISTORY='controle-patio-v1-history';
let records=read(STORE,[]);
let history=read(HISTORY,[]);
let toastTimer;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));

let storageMode = 'loading';
let storageReady = false;
let loggedIn = false;
let writeBusy = false;
let revision = 0;

function storageStatus(message, state = 'waiting') {
  const status = $('#storage-status');
  status.textContent = message;
  status.dataset.state = state;
  $('#storage-footer').textContent = message;
}

function lockStorageControls() {
  const locked = !storageReady || writeBusy || (storageMode === 'cloud' && window.PatioStorage.hasPending());
  document.body.classList.toggle('storage-locked', locked);
  $$('#new-record, #load-examples, #clear-data, #import-local, #record-form input, #record-form select, #record-form textarea, #record-form button[type="submit"], button[data-action], button[data-edit]')
    .forEach(control => { control.disabled = locked; });
  $$('.truck-card').forEach(card => { card.draggable = !locked; });
  $('#sync-data').disabled = writeBusy;
  $('#cloud-logout').disabled = writeBusy || window.PatioStorage.hasPending();
  $('#sync-data').hidden = storageMode === 'local';
  $('#cloud-login').hidden = window.PatioStorage.isPublic() || storageMode !== 'cloud' || loggedIn;
  $('#cloud-logout').hidden = window.PatioStorage.isPublic() || storageMode !== 'cloud' || !loggedIn;
  $('#import-local').hidden = storageMode !== 'cloud' || !loggedIn ||
    !(read(STORE, []).length || read(HISTORY, []).length);
}

function applyCloudState(state) {
  records = state.records;
  history = state.history;
  revision = state.revision;
  loggedIn = true;
  storageReady = true;
  storageStatus('Dados sincronizados na base compartilhada', 'ready');
}

async function syncCloud() {
  if (writeBusy) return false;
  writeBusy = true;
  lockStorageControls();
  const hadPending = window.PatioStorage.hasPending();
  try {
    const state = hadPending ? await window.PatioStorage.retry() : await window.PatioStorage.load();
    applyCloudState(state);
    if (hadPending) {
      dialog.close();
      notify('Alteração salva na base compartilhada');
    }
    return true;
  } catch (error) {
    if (error.status === 401) {
      loggedIn = false;
      storageReady = false;
      records = [];
      history = [];
      storageStatus('Entre para acessar a base compartilhada');
      if (!$('#login-dialog').open) $('#login-dialog').showModal();
    } else if (error.status === 409 || error.status === 400 || error.status === 413) {
      storageReady = false;
      storageStatus('Clique em Sincronizar para recarregar a base', 'error');
      notify(error.message);
    } else {
      storageStatus(window.PatioStorage.hasPending()
        ? 'Alteração pendente. Clique em Sincronizar para tentar novamente.'
        : 'Sem conexão com o banco. Clique em Sincronizar.', 'error');
    }
    return false;
  } finally {
    writeBusy = false;
    render();
  }
}

async function initializeStorage() {
  storageReady = false;
  lockStorageControls();
  try {
    storageMode = await window.PatioStorage.configuration();
    if (storageMode === 'local') {
      records = read(STORE, []);
      history = read(HISTORY, []);
      storageReady = true;
      storageStatus('Dados salvos neste navegador', 'ready');
      render();
      return;
    }
    records = [];
    history = [];
    await syncCloud();
  } catch {
    storageStatus('Não foi possível verificar o armazenamento. Clique em Sincronizar.', 'error');
    render();
  }
}

async function performChange(change, successMessage) {
  if (!storageReady || writeBusy || (storageMode === 'cloud' && window.PatioStorage.hasPending())) {
    notify('Aguarde a conexão ou sincronize a alteração pendente.');
    return false;
  }
  const previous = { records: JSON.parse(JSON.stringify(records)), history: JSON.parse(JSON.stringify(history)) };
  writeBusy = true;
  lockStorageControls();
  try {
    if (change() === false) return false;
    if (storageMode === 'cloud') {
      const state = await window.PatioStorage.save(records, history, revision);
      applyCloudState(state);
    } else {
      save();
    }
    notify(successMessage);
    return true;
  } catch (error) {
    if (storageMode !== 'cloud' || !window.PatioStorage.hasPending()) {
      records = previous.records;
      history = previous.history;
    }
    if (error.status === 409) {
      dialog.close();
      try { applyCloudState(await window.PatioStorage.load()); }
      catch { storageReady = false; }
    }
    if (error.status === 401) {
      loggedIn = false;
      storageReady = false;
      if (!$('#login-dialog').open) $('#login-dialog').showModal();
    }
    storageStatus(window.PatioStorage.hasPending()
      ? 'Alteração pendente. Clique em Sincronizar para tentar novamente.'
      : 'A alteração não foi salva. Confira os dados e tente novamente.', 'error');
    notify(error.message || 'Não foi possível salvar a alteração.');
    return false;
  } finally {
    writeBusy = false;
    render();
  }
}

function read(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value:fallback}catch{return fallback}}
function save() {
  const oldRecords = localStorage.getItem(STORE);
  const oldHistory = localStorage.getItem(HISTORY);
  try {
    localStorage.setItem(STORE, JSON.stringify(records));
    localStorage.setItem(HISTORY, JSON.stringify(history));
  } catch (error) {
    if (oldRecords === null) localStorage.removeItem(STORE);
    else localStorage.setItem(STORE, oldRecords);
    if (oldHistory === null) localStorage.removeItem(HISTORY);
    else localStorage.setItem(HISTORY, oldHistory);
    throw error;
  }
}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function notify(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function updateClock(){const now=new Date();$('#current-date').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(now);$('#current-time').textContent=now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function fmtDate(value){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
function duration(ms){const min=Math.max(0,Math.floor(ms/60000));const d=Math.floor(min/1440);const h=Math.floor((min%1440)/60);const m=min%60;if(d)return d+'d '+h+'h';return h?h+'h '+String(m).padStart(2,'0')+'min':m+'min'}
function scheduled(r){return new Date(r.date+'T'+r.time+':00')}
function isOverdue(r){return !r.cancelled&&r.stage===0&&scheduled(r)<new Date()}
function normalizePlate(value){return String(value).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7)}
function filtered(){
 const text=$('#filter-text').value.trim().toLowerCase();
 const stage=$('#filter-stage').value;
 const op=$('#filter-operation').value;
 const freight=$('#filter-freight').value;
 return records.filter(r=>{
  const hay=[r.plate,r.driver,r.order,r.product,r.carrier].join(' ').toLowerCase();
  return !r.cancelled&&(!text||hay.includes(text))&&(stage===''||r.stage===Number(stage))&&(!op||r.operation===op)&&(!freight||r.freight===freight);
 });
}
function logAction(r,from,to,action){history.unshift({id:uid(),recordId:r.id,plate:r.plate,order:r.order,from,to,action,at:new Date().toISOString()})}
async function move(id, delta) {
  return performChange(() => {
    const record = records.find(item => item.id === id);
    if (!record || record.cancelled) return false;
    const next = Math.max(0, Math.min(STAGES.length - 1, record.stage + delta));
    if (next === record.stage) return false;
    const from = STAGES[record.stage];
    record.stage = next;
    record.stageEnteredAt = new Date().toISOString();
    logAction(record, from, STAGES[next], delta > 0 ? 'Avanço' : 'Retorno');
  }, 'Veículo movimentado');
}
async function cancelRecord(id) {
  if (!confirm('Cancelar este registro? O histórico será preservado.')) return;
  return performChange(() => {
    const record = records.find(item => item.id === id);
    if (!record || record.cancelled) return false;
    record.cancelled = true;
    logAction(record, STAGES[record.stage], 'Cancelado', 'Cancelamento lógico');
  }, 'Registro cancelado');
}
function card(r){
 const alert=isOverdue(r);
 return '<article draggable="true" data-record-id="'+esc(r.id)+'" class="truck-card'+(alert?' overdue':'')+'"><div class="card-top"><h4>'+esc(r.plate)+'</h4><span class="badge">'+esc(r.operation)+'</span></div>'+
 '<dl><dt>Pedido</dt><dd>'+esc(r.order)+'</dd><dt>Motorista</dt><dd>'+esc(r.driver)+'</dd><dt>Transportadora</dt><dd>'+esc(r.carrier)+'</dd><dt>Produto</dt><dd>'+esc(r.product)+'</dd><dt>Quantidade</dt><dd>'+esc(r.quantity)+' '+esc(r.unit)+'</dd><dt>Agendado</dt><dd>'+esc(r.date.split('-').reverse().join('/'))+' '+esc(r.time)+'</dd></dl>'+
 '<p class="elapsed'+(alert?' alert':'')+'">'+(alert?'Agendamento vencido · ':'Na etapa há ')+duration(Date.now()-new Date(r.stageEnteredAt).getTime())+'</p>'+
 '<div class="card-actions">'+(r.stage>0?'<button data-action="back" data-id="'+esc(r.id)+'">← Retornar</button>':'')+(r.stage<6?'<button data-action="next" data-id="'+esc(r.id)+'">Avançar →</button>':'<button disabled>Finalizado</button>')+'<button class="icon-action" data-action="edit" data-id="'+esc(r.id)+'" title="Editar">✎</button><button class="icon-action cancel" data-action="cancel" data-id="'+esc(r.id)+'" title="Cancelar">×</button></div></article>';
}
function renderBoard(){
 const data=filtered();
 $('#board').innerHTML=STAGES.map((stage,index)=>{const list=data.filter(r=>r.stage===index);return '<section class="column" data-stage="'+index+'"><header class="column-head"><h3>'+stage+'</h3><span class="count">'+list.length+'</span></header><div class="card-list" data-stage="'+index+'">'+(list.length?list.map(card).join(''):'<div class="empty"><strong>Etapa vazia</strong><span>Nenhum veículo neste status.</span></div>')+'</div></section>'}).join('');
}
function renderMetrics(){
 const live=records.filter(r=>!r.cancelled);
 $('#metric-total').textContent=records.length;
 $('#metric-active').textContent=live.filter(r=>r.stage<6).length;
 $('#metric-yard').textContent=live.filter(r=>r.stage>=1&&r.stage<=5).length;
 $('#metric-released').textContent=live.filter(r=>r.stage===6).length;
 $('#metric-overdue').textContent=live.filter(isOverdue).length;
}
function barRows(items){
 const max=Math.max(1,...items.map(x=>x.value));
 return items.map(x=>'<div class="bar-row"><span>'+esc(x.label)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(x.value/max*100)+'%"></div></div><strong>'+x.value+'</strong></div>').join('');
}
function renderDashboard(){
 const live=records.filter(r=>!r.cancelled);
 $('#stage-chart').innerHTML=barRows(STAGES.map((s,i)=>({label:s,value:live.filter(r=>r.stage===i).length})));
 $('#operation-chart').innerHTML=barRows(['Carga','Descarga'].map(s=>({label:s,value:live.filter(r=>r.operation===s).length})));
 $('#analysis-body').innerHTML=STAGES.map((s,i)=>{const list=live.filter(r=>r.stage===i);const times=list.map(r=>Date.now()-new Date(r.stageEnteredAt).getTime());const avg=times.length?times.reduce((a,b)=>a+b,0)/times.length:0;return '<tr><td>'+s+'</td><td>'+list.length+'</td><td>'+duration(avg)+'</td><td>'+duration(times.length?Math.max(...times):0)+'</td></tr>'}).join('');
}
function renderHistory(){
 $('#history-count').textContent=history.length+' '+(history.length===1?'evento':'eventos');
 $('#history-body').innerHTML=history.length?history.map(h=>'<tr><td>'+fmtDate(h.at)+'</td><td>'+esc(h.plate)+'</td><td>'+esc(h.order)+'</td><td>'+esc(h.from)+'</td><td>'+esc(h.to)+'</td><td>'+esc(h.action)+'</td></tr>').join(''):'<tr><td colspan="6">Nenhuma movimentação registrada.</td></tr>';
}
function renderDatabase(){
 $('#database-count').textContent=records.length+' '+(records.length===1?'registro':'registros');
 $('#database-body').innerHTML=records.length?records.map(r=>'<tr><td>'+esc(r.order)+'</td><td>'+esc(r.plate)+'</td><td>'+esc(r.driver)+'</td><td>'+esc(r.carrier)+'</td><td>'+esc(r.product)+'</td><td>'+esc(r.quantity)+' '+esc(r.unit)+'</td><td>'+esc(r.operation)+'</td><td>'+esc(r.freight)+'</td><td>'+esc(r.date.split('-').reverse().join('/'))+' '+esc(r.time)+'</td><td>'+(r.cancelled?'Cancelado':STAGES[r.stage])+'</td><td><button class="table-edit" data-edit="'+esc(r.id)+'">Editar</button></td></tr>').join(''):'<tr><td colspan="11">Nenhum registro cadastrado.</td></tr>';
}
function render(){renderMetrics();renderBoard();renderDashboard();renderHistory();renderDatabase();lockStorageControls()}
const dialog=$('#record-dialog');
function openForm(record){
 const form=$('#record-form');form.reset();form.elements.recordId.value='';
 const now=new Date();form.elements.date.value=now.toISOString().slice(0,10);form.elements.time.value=now.toTimeString().slice(0,5);
 $('#dialog-title').textContent='Cadastrar veículo';
 if(record){Object.keys(record).forEach(key=>{if(form.elements[key])form.elements[key].value=record[key]});form.elements.recordId.value=record.id;$('#dialog-title').textContent='Editar registro'}
 dialog.showModal();
}
function editRecord(id){const r=records.find(x=>x.id===id);if(r)openForm(r)}
async function loadExamples(){
 if(records.length&&!confirm(storageMode === 'cloud' ? 'Substituir a base compartilhada de todos os usuários pelos dados de teste?' : 'Substituir a base atual pelos dados de teste?'))return;
 const now=new Date();const makeDate=offset=>{const d=new Date(now.getTime()+offset*3600000);return {date:d.toISOString().slice(0,10),time:d.toTimeString().slice(0,5),at:new Date(now.getTime()-Math.abs(offset)*900000).toISOString()}};
 const samples=[
  ['AG-1001','ABC1D23','Carlos Lima','Transportadora Alfa','Farelo de soja',32000,'kg','Descarga','CIF',0,-2],
  ['AG-1002','DEF4G56','Marcos Silva','Transportadora Beta','Ração animal',28500,'kg','Carga','FOB',2,-1],
  ['AG-1003','GHI7J89','Paulo Santos','Logística Gama','Milho',30000,'kg','Descarga','CIF',4,1],
  ['AG-1004','JKL0M12','Ricardo Alves','Transporte Delta','Produto acabado',24000,'kg','Carga','Próprio',6,-4]
 ];
 return performChange(() => {
 records=samples.map(v=>{const d=makeDate(v[10]);return{id:uid(),order:v[0],plate:v[1],driver:v[2],cpf:'',carrier:v[3],product:v[4],quantity:v[5],unit:v[6],operation:v[7],freight:v[8],stage:v[9],date:d.date,time:d.time,notes:'Registro de teste.',createdAt:d.at,stageEnteredAt:d.at,cancelled:false}});
 history=[];records.forEach(r=>logAction(r,'Cadastro',STAGES[r.stage],'Carga de dados de teste'));
 }, 'Dados de teste carregados');
}
$('#filter-stage').innerHTML+=[...STAGES].map((s,i)=>'<option value="'+i+'">'+s+'</option>').join('');
$('#board').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;({next:()=>move(b.dataset.id,1),back:()=>move(b.dataset.id,-1),edit:()=>editRecord(b.dataset.id),cancel:()=>cancelRecord(b.dataset.id)})[b.dataset.action]?.()});
$('#database-body').addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(b)editRecord(b.dataset.edit)});
let draggedId=null;
$('#board').addEventListener('dragstart',e=>{
 if(!storageReady || writeBusy || (storageMode === 'cloud' && window.PatioStorage.hasPending())){e.preventDefault();return;}
 const card=e.target.closest('.truck-card');if(!card)return;
 draggedId=card.dataset.recordId;card.classList.add('dragging');
 e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedId);
});
$('#board').addEventListener('dragend',e=>{
 e.target.closest('.truck-card')?.classList.remove('dragging');
 $$('.column').forEach(c=>c.classList.remove('drag-over'));draggedId=null;
});
$('#board').addEventListener('dragover',e=>{
 const column=e.target.closest('.column');if(!column)return;
 e.preventDefault();$$('.column').forEach(c=>c.classList.toggle('drag-over',c===column));
});
$('#board').addEventListener('drop', event => {
  const column = event.target.closest('.column');
  if (!column) return;
  event.preventDefault();
  const id = draggedId || event.dataTransfer.getData('text/plain');
  const target = Number(column.dataset.stage);
  performChange(() => {
    const record = records.find(item => item.id === id);
    if (!record || record.cancelled || target === record.stage) return false;
    const from = STAGES[record.stage];
    record.stage = target;
    record.stageEnteredAt = new Date().toISOString();
    logAction(record, from, STAGES[target], 'Movimentação direta');
  }, 'Veículo movimentado');
});
$$('.tab').forEach(tab=>tab.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.toggle('active',x===tab));$$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+tab.dataset.view));$('#filters').hidden=tab.dataset.view!=='kanban';document.body.classList.toggle('field-view',tab.dataset.view==='field');$('#page-title').textContent={kanban:'Quadro operacional',dashboard:'Indicadores',history:'Histórico',database:'Base de registros',field:'Levantamento dos cinco caminhões'}[tab.dataset.view]}));
['#filter-text','#filter-stage','#filter-operation','#filter-freight'].forEach(id=>$(id).addEventListener(id==='#filter-text'?'input':'change',renderBoard));
$('#clear-filters').addEventListener('click',()=>{$('#filter-text').value='';$('#filter-stage').value='';$('#filter-operation').value='';$('#filter-freight').value='';renderBoard()});
$('#new-record').addEventListener('click',()=>openForm());
['#close-dialog','#cancel-dialog'].forEach(id=>$(id).addEventListener('click',()=>dialog.close()));
$('#record-form').elements.plate.addEventListener('input',e=>e.target.value=normalizePlate(e.target.value));
$('#record-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  data.plate = normalizePlate(data.plate);
  data.quantity = Number(data.quantity);
  const id = data.recordId;
  delete data.recordId;
  const saved = await performChange(() => {
    if (id) {
      const record = records.find(item => item.id === id);
      if (!record) return false;
      Object.assign(record, data);
      logAction(record, STAGES[record.stage], STAGES[record.stage], 'Edição');
    } else {
      const record = Object.assign(data, {
        id: uid(), stage: 0, createdAt: new Date().toISOString(),
        stageEnteredAt: new Date().toISOString(), cancelled: false
      });
      records.unshift(record);
      logAction(record, 'Cadastro', 'Agendado', 'Cadastro');
    }
  }, id ? 'Registro atualizado' : 'Veículo cadastrado');
  if (saved) dialog.close();
});
$('#load-examples').addEventListener('click', loadExamples);
$('#clear-data').addEventListener('click', () => {
  const question = storageMode === 'cloud'
    ? 'Apagar todos os registros e o histórico da base compartilhada de todos os usuários?'
    : 'Apagar todos os registros e o histórico deste navegador?';
  if (confirm(question)) performChange(() => { records = []; history = []; }, 'Base apagada');
});
$('#sync-data').addEventListener('click', () => {
  if (storageMode === 'cloud') syncCloud();
  else initializeStorage();
});
$('#cloud-login').addEventListener('click', () => $('#login-dialog').showModal());
$('#login-dialog').addEventListener('cancel', event => event.preventDefault());
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  $('#login-error').textContent = '';
  try {
    await window.PatioStorage.login($('#cloud-password').value);
    $('#cloud-password').value = '';
    $('#login-dialog').close();
    await syncCloud();
  } catch (error) {
    $('#login-error').textContent = error.message || 'Falha na conexão.';
  } finally {
    button.disabled = false;
  }
});
$('#cloud-logout').addEventListener('click', async () => {
  if (writeBusy || window.PatioStorage.hasPending()) return;
  try {
    await window.PatioStorage.logout();
    loggedIn = false;
    storageReady = false;
    records = [];
    history = [];
    storageStatus('Sessão encerrada');
    render();
  } catch { notify('Não foi possível encerrar a sessão.'); }
});
$('#import-local').addEventListener('click', () => {
  if (!confirm('Importar os registros e o histórico deste navegador para a base compartilhada? Registros com o mesmo código interno serão mantidos como estão no banco.')) return;
  performChange(() => {
    const mergedRecords = new Map(records.map(record => [record.id, record]));
    for (const record of read(STORE, [])) {
      if (!mergedRecords.has(record.id)) mergedRecords.set(record.id, record);
    }
    records = [...mergedRecords.values()];
    const mergedHistory = new Map(history.map(event => [event.id, event]));
    for (const event of read(HISTORY, [])) {
      if (mergedRecords.has(event.recordId) && !mergedHistory.has(event.id)) mergedHistory.set(event.id, event);
    }
    history = [...mergedHistory.values()].sort((left, right) => new Date(right.at) - new Date(left.at));
  }, 'Dados deste navegador importados');
});
window.addEventListener('beforeunload', event => {
  if (writeBusy || window.PatioStorage.hasPending()) {
    event.preventDefault();
    event.returnValue = '';
  }
});
$('#export-csv').addEventListener('click',()=>{
 const cols=['pedido','placa','motorista','cpf','transportadora','produto','quantidade','unidade','operação','frete','agendamento','status','observação'];
 const rows=records.map(r=>[r.order,r.plate,r.driver,r.cpf,r.carrier,r.product,r.quantity,r.unit,r.operation,r.freight,r.date+' '+r.time,r.cancelled?'Cancelado':STAGES[r.stage],r.notes]);
 const csv=[cols,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='controle_patio_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(a.href);notify('Arquivo CSV gerado');
});
updateClock();
setInterval(updateClock, 30000);
render();
initializeStorage();
setInterval(() => {
  if (storageMode === 'cloud' && loggedIn && !writeBusy && !window.PatioStorage.hasPending() && !dialog.open && !document.hidden) syncCloud();
}, 10000);
setInterval(() => { if (!writeBusy) render(); }, 60000);

