'use strict';
const STAGES=['Agendado','Check-in','Aguardando no Pátio','Pesagem Inicial','Carregamento ou Descarga','Pesagem Final','Liberado'];
const STORE='kanban-logistico-v6';
const HISTORY='kanban-logistico-v6-history';
let records=read(STORE,[]);
let history=read(HISTORY,[]);
const $=function(s){return document.querySelector(s)};
const $$=function(s){return Array.from(document.querySelectorAll(s))};
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch(e){return fallback}}
function save(){localStorage.setItem(STORE,JSON.stringify(records));localStorage.setItem(HISTORY,JSON.stringify(history))}
function esc(value){return String(value??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function fmtDate(value){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
function duration(ms){const min=Math.max(0,Math.floor(ms/60000));const h=Math.floor(min/60);const m=min%60;return h?h+'h '+String(m).padStart(2,'0')+'min':m+'min'}
function scheduled(r){return new Date(r.date+'T'+r.time+':00')}
function isOverdue(r){return !r.cancelled&&r.stage===0&&scheduled(r)<new Date()}
function filtered(){
 const text=$('#filter-text').value.trim().toLowerCase();
 const op=$('#filter-operation').value;
 const freight=$('#filter-freight').value;
 return records.filter(function(r){
  const hay=[r.plate,r.driver,r.order,r.product,r.carrier].join(' ').toLowerCase();
  return !r.cancelled&&(!text||hay.includes(text))&&(!op||r.operation===op)&&(!freight||r.freight===freight);
 });
}
function recordAction(r,from,to,action){
 history.unshift({id:uid(),recordId:r.id,plate:r.plate,order:r.order,from:from,to:to,action:action,at:new Date().toISOString()});
}
function move(id,delta){
 const r=records.find(function(x){return x.id===id});if(!r)return;
 const next=Math.max(0,Math.min(STAGES.length-1,r.stage+delta));if(next===r.stage)return;
 const from=STAGES[r.stage];r.stage=next;r.stageEnteredAt=new Date().toISOString();recordAction(r,from,STAGES[next],delta>0?'Avanço':'Retorno');save();render();
}
function cancelRecord(id){
 const r=records.find(function(x){return x.id===id});if(!r||!confirm('Cancelar este registro sem apagá-lo do histórico?'))return;
 r.cancelled=true;recordAction(r,STAGES[r.stage],'Cancelado','Cancelamento lógico');save();render();
}
function card(r){
 const overdue=isOverdue(r)?' overdue':'';
 return '<article class="truck-card'+overdue+'"><div class="card-top"><h3>'+esc(r.plate)+'</h3><span class="badge">'+esc(r.operation)+'</span></div>'+
 '<dl><dt>Pedido</dt><dd>'+esc(r.order)+'</dd><dt>Motorista</dt><dd>'+esc(r.driver)+'</dd><dt>Produto</dt><dd>'+esc(r.product)+'</dd><dt>Quantidade</dt><dd>'+esc(r.quantity)+' '+esc(r.unit)+'</dd><dt>Agendado</dt><dd>'+esc(r.date.split('-').reverse().join('/'))+' '+esc(r.time)+'</dd></dl>'+
 '<p class="elapsed">Na etapa há '+duration(Date.now()-new Date(r.stageEnteredAt).getTime())+(isOverdue(r)?' · agendamento vencido':'')+'</p>'+
 '<div class="card-actions">'+(r.stage>0?'<button data-action="back" data-id="'+r.id+'">← Retornar</button>':'')+(r.stage<6?'<button data-action="next" data-id="'+r.id+'">Avançar →</button>':'<button disabled>Finalizado</button>')+'<button class="cancel" data-action="cancel" data-id="'+r.id+'" title="Cancelar">×</button></div></article>';
}
function renderBoard(){
 const data=filtered();
 $('#board').innerHTML=STAGES.map(function(stage,index){
  const list=data.filter(function(r){return r.stage===index});
  return '<section class="column"><header class="column-head"><h2>'+stage+'</h2><span class="count">'+list.length+'</span></header><div class="card-list">'+(list.length?list.map(card).join(''):'<div class="empty"><strong>Nenhum caminhão</strong><span>Sem registros nesta etapa.</span></div>')+'</div></section>';
 }).join('');
}
function renderMetrics(){
 const live=records.filter(function(r){return !r.cancelled});
 $('#metric-total').textContent=records.length;
 $('#metric-active').textContent=live.filter(function(r){return r.stage<6}).length;
 $('#metric-yard').textContent=live.filter(function(r){return r.stage>=1&&r.stage<=5}).length;
 $('#metric-released').textContent=live.filter(function(r){return r.stage===6}).length;
 $('#metric-overdue').textContent=live.filter(isOverdue).length;
}
function barRows(items){
 const max=Math.max(1,...items.map(function(x){return x.value}));
 return items.map(function(x){return '<div class="bar-row"><span>'+esc(x.label)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(x.value/max*100)+'%"></div></div><strong>'+x.value+'</strong></div>'}).join('');
}
function renderDashboard(){
 const live=records.filter(function(r){return !r.cancelled});
 $('#stage-chart').innerHTML=barRows(STAGES.map(function(s,i){return {label:s,value:live.filter(function(r){return r.stage===i}).length}}));
 $('#operation-chart').innerHTML=barRows(['Carga','Descarga'].map(function(s){return {label:s,value:live.filter(function(r){return r.operation===s}).length}}));
 $('#analysis-body').innerHTML=STAGES.map(function(s,i){
  const list=live.filter(function(r){return r.stage===i});
  const times=list.map(function(r){return Date.now()-new Date(r.stageEnteredAt).getTime()});
  const avg=times.length?times.reduce(function(a,b){return a+b},0)/times.length:0;
  return '<tr><td>'+s+'</td><td>'+list.length+'</td><td>'+duration(avg)+'</td><td>'+duration(times.length?Math.max(...times):0)+'</td></tr>';
 }).join('');
}
function renderHistory(){
 $('#history-body').innerHTML=history.length?history.map(function(h){return '<tr><td>'+fmtDate(h.at)+'</td><td>'+esc(h.plate)+'</td><td>'+esc(h.order)+'</td><td>'+esc(h.from)+'</td><td>'+esc(h.to)+'</td><td>'+esc(h.action)+'</td></tr>'}).join(''):'<tr><td colspan="6">Nenhuma movimentação registrada.</td></tr>';
}
function renderDatabase(){
 $('#database-body').innerHTML=records.length?records.map(function(r){return '<tr><td>'+esc(r.order)+'</td><td>'+esc(r.plate)+'</td><td>'+esc(r.driver)+'</td><td>'+esc(r.carrier)+'</td><td>'+esc(r.product)+'</td><td>'+esc(r.quantity)+' '+esc(r.unit)+'</td><td>'+esc(r.operation)+'</td><td>'+esc(r.freight)+'</td><td>'+esc(r.date.split('-').reverse().join('/'))+' '+esc(r.time)+'</td><td>'+(r.cancelled?'Cancelado':STAGES[r.stage])+'</td></tr>'}).join(''):'<tr><td colspan="10">Nenhum registro cadastrado.</td></tr>';
}
function render(){renderMetrics();renderBoard();renderDashboard();renderHistory();renderDatabase()}
function examples(){
 const now=new Date();function date(offset){const d=new Date(now.getTime()+offset*3600000);return {date:d.toISOString().slice(0,10),time:d.toTimeString().slice(0,5),at:new Date(now.getTime()-Math.abs(offset)*900000).toISOString()}}
 const samples=[
  ['AG-1001','ABC1D23','Carlos Lima','Transportadora Alfa','Farelo de soja',32000,'kg','Descarga','CIF',0,-2],
  ['AG-1002','DEF4G56','Marcos Silva','Transportadora Beta','Ração animal',28500,'kg','Carga','FOB',2,-1],
  ['AG-1003','GHI7J89','Paulo Santos','Logística Gama','Milho',30000,'kg','Descarga','CIF',4,1],
  ['AG-1004','JKL0M12','Ricardo Alves','Transporte Delta','Produto acabado',24000,'kg','Carga','Próprio',6,-4]
 ];
 records=samples.map(function(v){const d=date(v[10]);return {id:uid(),order:v[0],plate:v[1],driver:v[2],cpf:'',carrier:v[3],product:v[4],quantity:v[5],unit:v[6],operation:v[7],freight:v[8],stage:v[9],date:d.date,time:d.time,notes:'Registro simulado para validação funcional.',createdAt:d.at,stageEnteredAt:d.at,cancelled:false}});
 history=[];records.forEach(function(r){recordAction(r,'Cadastro',STAGES[r.stage],'Carga de exemplo')});save();render();
}
$('#board').addEventListener('click',function(e){const b=e.target.closest('button[data-action]');if(!b)return;if(b.dataset.action==='next')move(b.dataset.id,1);if(b.dataset.action==='back')move(b.dataset.id,-1);if(b.dataset.action==='cancel')cancelRecord(b.dataset.id)});
$$('.tab').forEach(function(tab){tab.addEventListener('click',function(){$$('.tab').forEach(function(x){x.classList.toggle('active',x===tab)});$$('.view').forEach(function(v){v.classList.toggle('active',v.id==='view-'+tab.dataset.view)})})});
['#filter-text','#filter-operation','#filter-freight'].forEach(function(id){$(id).addEventListener(id==='#filter-text'?'input':'change',renderBoard)});
$('#clear-filters').addEventListener('click',function(){$('#filter-text').value='';$('#filter-operation').value='';$('#filter-freight').value='';renderBoard()});
const dialog=$('#record-dialog');
$('#new-record').addEventListener('click',function(){const d=new Date();$('#record-form').elements.date.value=d.toISOString().slice(0,10);$('#record-form').elements.time.value=d.toTimeString().slice(0,5);dialog.showModal()});
['#close-dialog','#cancel-dialog'].forEach(function(id){$(id).addEventListener('click',function(){dialog.close()})});
$('#record-form').addEventListener('submit',function(e){e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget).entries());const r=Object.assign(data,{id:uid(),quantity:Number(data.quantity),stage:0,createdAt:new Date().toISOString(),stageEnteredAt:new Date().toISOString(),cancelled:false});records.unshift(r);recordAction(r,'Cadastro','Agendado','Cadastro');save();e.currentTarget.reset();dialog.close();render()});
$('#load-examples').addEventListener('click',function(){if(!records.length||confirm('Substituir os dados atuais pelos quatro exemplos simulados?'))examples()});
$('#clear-data').addEventListener('click',function(){if(confirm('Apagar todos os dados armazenados neste navegador?')){records=[];history=[];save();render()}});
$('#export-csv').addEventListener('click',function(){
 const cols=['pedido','placa','motorista','transportadora','produto','quantidade','unidade','operação','frete','agendamento','status'];
 const rows=records.map(function(r){return [r.order,r.plate,r.driver,r.carrier,r.product,r.quantity,r.unit,r.operation,r.freight,r.date+' '+r.time,r.cancelled?'Cancelado':STAGES[r.stage]]});
 const csv=[cols].concat(rows).map(function(row){return row.map(function(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}).join(';')}).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='kanban_logistico.csv';a.click();URL.revokeObjectURL(a.href);
});
if(!records.length)examples();else render();
setInterval(render,60000);