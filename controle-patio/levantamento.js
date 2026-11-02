'use strict';
// Tempos aproximados do levantamento, sem identificação pessoal ou empresarial.
const FIELD_CASES = [
 {id:'C01',operation:'Carga',durations:[2,22,9,30,8]},
 {id:'C02',operation:'Carga',durations:[4,30,8,33,7]},
 {id:'C03',operation:'Descarga',durations:[4.5,24,9,20,9]},
 {id:'C04',operation:'Descarga',durations:[5,26,8,20,9]},
 {id:'C05',operation:'Carga',durations:[2,27,9,29,9]}
];
const FIELD_LABELS=['Check-in','Espera pela balança','Pesagem inicial','Carga ou descarga','Pesagem final'];
function fieldSummary(cases){
 const total=cases.reduce((sum,r)=>sum+r.durations.reduce((a,b)=>a+b,0),0);
 const wait=cases.reduce((sum,r)=>sum+r.durations[1],0);
 return {count:cases.length,total,wait,average:cases.length?total/cases.length:0,averageWait:cases.length?wait/cases.length:0,share:total?wait/total:0};
}
function fieldNumber(n,d=1){return n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})}
function fieldDuration(m){const seconds=Math.round(m*60);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}
function fieldCSV(){
 const headings=['Caminhão','Operação',...FIELD_LABELS.map(s=>s+' (min)'),'Total (min)','Espera / total (%)'];
 const rows=FIELD_CASES.map(r=>{const total=r.durations.reduce((a,b)=>a+b,0);return [r.id,r.operation,...r.durations.map(v=>fieldNumber(v,2)),fieldNumber(total,2),fieldNumber(100*r.durations[1]/total,1)]});
 return [headings,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');
}
function renderFieldStudy(){
 const summary=fieldSummary(FIELD_CASES);
 document.querySelector('#field-count').textContent=summary.count;
 document.querySelector('#field-average').textContent=fieldNumber(summary.average)+' min';
 document.querySelector('#field-wait').textContent=fieldNumber(summary.averageWait)+' min';
 document.querySelector('#field-share').textContent=fieldNumber(summary.share*100)+'%';
 document.querySelector('#field-body').innerHTML=FIELD_CASES.map(r=>{
  const total=r.durations.reduce((a,b)=>a+b,0);
  return '<tr><th scope="row">'+r.id+'</th><td>'+r.operation+'</td>'+r.durations.map(v=>'<td>'+fieldNumber(v,2)+'</td>').join('')+'<td><strong>'+fieldNumber(total,2)+'</strong></td><td>'+fieldNumber(r.durations[1]/total*100)+'%</td></tr>';
 }).join('');
 document.querySelector('#field-cards').innerHTML=FIELD_CASES.map(r=>{
  const total=r.durations.reduce((a,b)=>a+b,0);
  return '<article class="field-card"><div class="card-top"><h4>'+r.id+'</h4><span class="badge">'+r.operation+'</span></div><p class="field-card-subtitle">Tempos do atendimento (min:seg)</p><dl>'+FIELD_LABELS.map((s,i)=>'<dt>'+s+'</dt><dd>'+fieldDuration(r.durations[i])+'</dd>').join('')+'<dt class="field-total">Total</dt><dd class="field-total">'+fieldDuration(total)+'</dd></dl></article>';
 }).join('');
}
document.querySelector('#field-export').addEventListener('click',()=>{
 const link=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+fieldCSV()],{type:'text/csv;charset=utf-8'}));
 link.href=url;link.download='levantamento_5_caminhoes.csv';link.click();URL.revokeObjectURL(url);
});
renderFieldStudy();
