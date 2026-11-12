// Runs the real Vue count page in Happy DOM. Every API call uses isolated fixtures.
// npm install --prefix /private/tmp/craft-count-ui happy-dom
import { build } from 'esbuild';
import { parse,compileScript } from '@vue/compiler-sfc';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),temp=await mkdtemp(path.join(tmpdir(),'count-component-'));
const domModule=process.env.COUNT_DOM_MODULE||'/private/tmp/craft-count-ui/node_modules/happy-dom/lib/index.js';
try{
const {Window}=await import(pathToFileURL(domModule).href);
const domWindow=new Window({url:'http://localhost:5174'});
for(const key of ['window','document','HTMLElement','Element','Node','SVGElement','Event','CustomEvent'])globalThis[key]=key==='window'?domWindow:domWindow[key];
const result=await build({stdin:{resolveDir:root,contents:`
import assert from 'node:assert/strict';
const window=globalThis.window;
const fixture={id:'1',name:'PD-TEST',state:'counting',scope_locked:true,can_edit:true,approval_state:null,version:'v1',owner:{name:'库管'},factory:{id:'1',name:'测试厂'},location:{id:'1',name:'原料仓/A01'},approvals:[],history:[],movements:[],lines:[{id:'1',product:{name:'麦芽'},location:{id:'1',name:'A01'},lot:{name:'M-01'},uom:{id:'kg',name:'kg',rounding:0.001},theoretical_qty:10,counted_qty:null,is_counted:false,difference_reason:'',difference_note:'',recounts:[]},{id:'2',product:{name:'小麦'},location:{id:'1',name:'A01'},lot:{name:'M-02'},uom:{id:'kg',name:'kg',rounding:0.001},theoretical_qty:5,counted_qty:null,is_counted:false,difference_reason:'',difference_note:'',recounts:[]}]};
let saved,fail=false;const writes=[];
globalThis.__countApi={getInventoryCount:async()=>structuredClone(fixture),inventoryCountOptions:async()=>({factories:[{id:'1',name:'测试厂'}],locations:[],products:[],lots:[]}),listInventoryCountPage:async()=>({data:[],meta:{total:0}}),updateInventoryCountLines:async(id,payload)=>{if(fail)throw Error('模拟保存失败');writes.push(payload);saved=structuredClone(payload);for(const row of payload.lines){const r=fixture.lines.find(l=>l.id===row.id);Object.assign(r,row,{is_counted:row.counted_qty!==null});}fixture.version='v'+(writes.length+1);if(payload.submit_after_save){fixture.state='pending_approval';fixture.approval_state='pending';fixture.can_edit=false;}return structuredClone(fixture);}};
const {createApp,nextTick}=await import('vue');const {default:Page}=await import('./src/components/InventoryCountPage.vue');
const target=document.createElement('div');document.body.append(target);const warnings=[],errors=[];const app=createApp(Page,{permissions:['inventory.count.manage'],initialId:'1'});app.config.warnHandler=m=>warnings.push(m);app.config.errorHandler=e=>errors.push(e);app.mount(target);
async function flush(){for(let i=0;i<5;i++){await nextTick();await new Promise(r=>setTimeout(r,0));}}
async function click(text){const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert(button,'Missing button '+text);button.click();await flush();}
async function input(el,value,event='input'){assert(el);el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));await flush();}
await flush();assert.equal(document.querySelectorAll('[data-actual]').length,2);
assert(!target.textContent.includes('上次盘点'),'History must stay outside the main work table');
assert.equal(document.querySelectorAll('.count-reason').length,0,'Reasons must stay out of initial entry');
await click('下一步：核查差异 →');assert(target.textContent.includes('未盘'));
await click('全部');await input(document.querySelectorAll('[data-actual]')[0],'9');await input(document.querySelectorAll('[data-actual]')[1],'5');
await click('暂存');assert.equal(saved.submit_after_save,false);assert.equal(saved.lines[0].counted_qty,9);
await click('下一步：核查差异 →');assert.equal(document.querySelectorAll('.count-reason').length,1,'Review must show only discrepancies');
await click('提交差异审批');assert(target.textContent.includes('需要填写原因'));assert.equal(writes.length,1);
await input(document.querySelector('.count-reason select'),'other','change');await input(document.querySelector('.count-reason input'),'现场复称');
await click('暂存');assert.equal(saved.lines[0].difference_note,'现场复称');
await click('提交差异审批');assert(document.querySelector('[role="dialog"]'));
fail=true;await click('提交审批');assert(document.body.textContent.includes('模拟保存失败'));assert.equal(document.querySelector('.count-reason input').value,'现场复称','Failed save must preserve input');
fail=false;await click('提交审批');assert.equal(saved.submit_after_save,true);assert.equal(writes.length,3);assert(target.textContent.includes('等待负责人审批'));assert.equal(document.querySelectorAll('[data-actual]').length,0);
assert.equal(warnings.length,0,warnings.join('/'));assert.equal(errors.length,0,errors.map(e=>e.stack).join('/'));
app.unmount();await window.happyDOM.close();
console.log('PASS: real Vue page keeps entry compact, supports blank counts and save, separates discrepancy review, validates reasons, preserves input on failure and submits atomically without Vue warnings.');
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external',external:[domModule],plugins:[{name:'vue-count-fixtures',setup(b){b.onLoad({filter:/\/api\.js$/},()=>({contents:'export const brewApi=globalThis.__countApi;',loader:'js'}));b.onLoad({filter:/\.vue$/},async args=>{const {descriptor}=parse(await readFile(args.path,'utf8'),{filename:args.path});return {contents:compileScript(descriptor,{id:args.path,inlineTemplate:true}).content,loader:'js',resolveDir:path.dirname(args.path)};});}}]});
// External Vue packages resolve through this temporary directory's local link.
const {symlink}=await import('node:fs/promises');await symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
const file=path.join(temp,'check.mjs');await writeFile(file,result.outputFiles[0].text);await import(pathToFileURL(file).href);
}finally{await rm(temp,{recursive:true,force:true});}
