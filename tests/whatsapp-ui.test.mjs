import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../controle-patio/whatsapp.js',import.meta.url),'utf8');
function screen(config={configured:true,retryAfter:0,lastStatus:null}) {
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id)) elements.set(id,{textContent:'',disabled:false,open:false,events:{},addEventListener(name,fn){this.events[name]=fn;},showModal(){this.open=true;},close(){this.open=false;}});
    return elements.get(id);
  };
  let now=1000000,tick,sequence=0;
  const posts=[];
  const context=vm.createContext({document:{querySelector:element},window:{addEventListener(){}},Date:class extends Date{static now(){return now;}},crypto:{randomUUID:()=>`request-${++sequence}`},AbortSignal:{timeout(){}},setInterval:fn=>{tick=fn;return 1;},clearInterval(){},fetch:async(url,options={})=>{
    if(options.method==='POST') {posts.push(JSON.parse(options.body));return {ok:true,json:async()=>({status:'submitted',retryAfter:60})};}
    return {ok:true,json:async()=>config};
  }});
  vm.runInContext(source,context);
  return {app:context.window.PatioWhatsApp,button:element('#whatsapp-send'),status:element('#whatsapp-status'),posts,advance:ms=>{now+=ms;tick();}};
}
const record={id:'truck',driver:'Motorista',plate:'ABC1D23',whatsapp:'5514999999999',stage:2,stageEnteredAt:'2026-11-19T12:00:00Z'};
test('shows simple success and enables another deliberate call after one minute',async()=>{
  const ui=screen();await ui.app.open(record);
  assert.equal(ui.button.disabled,false);
  assert.equal(ui.status.textContent,'');
  await ui.button.events.click();
  assert.equal(ui.status.textContent,'Mensagem enviada.');
  assert.equal(ui.button.disabled,true);
  assert.equal(ui.button.textContent,'Chamar novamente em 1:00');
  await ui.button.events.click();assert.equal(ui.posts.length,1);
  ui.advance(59000);assert.equal(ui.button.disabled,true);
  ui.advance(1000);assert.equal(ui.button.disabled,false);assert.equal(ui.button.textContent,'Chamar novamente');
  await ui.button.events.click();assert.equal(ui.posts.length,2);
  assert.notEqual(ui.posts[0].requestId,ui.posts[1].requestId);
  assert.equal(ui.posts[1].phone,record.whatsapp);
});
test('reopening a recently sent vehicle keeps server cooldown',async()=>{
  const ui=screen({configured:true,retryAfter:38,lastStatus:'submitted'});await ui.app.open(record);
  assert.equal(ui.status.textContent,'Mensagem enviada.');assert.equal(ui.button.disabled,true);
  assert.equal(ui.button.textContent,'Chamar novamente em 0:38');
  ui.advance(38000);assert.equal(ui.button.disabled,false);
});
