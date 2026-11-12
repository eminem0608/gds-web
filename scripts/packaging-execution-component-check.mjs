// Runs the real Vue count page in Happy DOM. Every API call uses isolated fixtures.
// npm install --prefix /private/tmp/craft-count-ui happy-dom
import { build } from 'esbuild';
import { parse,compileScript,compileTemplate } from '@vue/compiler-sfc';
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
globalThis.__countApi={};const {createApp,nextTick}=await import('vue');const {default:Execution}=await import('./src/components/PackagingExecution.vue');const {default:Detail}=await import('./src/components/ProductionPlanDetail.vue');
const errors=[],warnings=[];async function flush(){for(let i=0;i<5;i++){await nextTick();await new Promise(r=>setTimeout(r,0));}}
function mount(C,p){const el=document.createElement('div');document.body.append(el);const app=createApp(C,p);app.config.warnHandler=m=>warnings.push(m);app.config.errorHandler=e=>errors.push(e);app.mount(el);return{el,close(){app.unmount();el.remove();}};}
function set(el,value,event='input'){el.value=value;el.dispatchEvent(new Event(event,{bubbles:true}));}
const packing={materials_only:true,finished_packaging_id:'5',materials:[{material_id:'7',name:'酒瓶',quantity:100}]};
const plan={id:'1',name:'计划',state:'done',product:{id:'1',name:'拉格'},factory:{id:'1',name:'本厂'},tank:{id:'1',name:'F1'},equipment:{name:'系统'},packaging_owner:{name:'操作员'},packaging_plan:packing};
const options={packages:[{id:'5',name:'500mL',volume_l:0.5}],locations:[{id:'8',name:'成品库'}]};let output;
let v=mount(Execution,{plan,task:{id:'10',state:'in_progress',is_assignee:true},options,liquid:{on_hand:100},onComplete:data=>output=data});await flush();
set(v.el.querySelector('[aria-label="成品名称"]'),'手工登记拉格');set(v.el.querySelector('[aria-label="实际产出酒液量"]'),'37');set(v.el.querySelector('[aria-label="包装单位"]'),'box','change');set(v.el.querySelector('[aria-label="实际包装数量"]'),'100');set(v.el.querySelector('[aria-label="酒液损耗"]'),'1');set(v.el.querySelector('[aria-label="酒瓶实际用量"]'),'99');const confirmed=v.el.querySelector('input[type=checkbox]');confirmed.checked=true;confirmed.dispatchEvent(new Event('change',{bubbles:true}));await flush();
assert(!v.el.querySelector('.pack-output-total'));assert(!v.el.querySelector('[aria-label="实际包装规格"]'));v.el.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(output.actual_qty,100);assert.equal(output.finished_packaging_id,undefined);assert.equal(output.output_volume_l,37);assert.equal(output.output_unit,'box');assert.equal(output.finished_product_name,'手工登记拉格');assert.equal(output.finished_location_id,'8');assert.equal(output.actual_materials[0].quantity,99);v.close();
v=mount(Execution,{plan,task:{id:'10',state:'done',is_assignee:true},options});await flush();assert(v.el.textContent.includes('补登记包装产出'));v.close();
v=mount(Execution,{plan,task:{id:'10',state:'in_progress',is_assignee:true},options,readOnly:true});await flush();assert(!v.el.querySelector('[aria-label="实际包装数量"]'));v.close();
const oldPlan={packaging_is_current:false,packaging_plan:{execution:{packaging_order_id:'40',actual_qty:100,output_volume_l:50,completed_by:'老执行人'},materials:[]}};
Object.assign(globalThis.__countApi,{getPlanProgress:async()=>({plan:{...plan,packaging_plan:{...packing,execution:{actual_qty:96,output_volume_l:48}}},tasks:[{id:'10',task_type:'packaging',state:'done',is_assignee:true,assignee:{name:'老执行人'},plan:oldPlan},{id:'11',task_type:'packaging',state:'in_progress',is_assignee:true,plan:{packaging_is_current:true}}],timeline:[]})});
v=mount(Detail,{planId:'1',allowExecution:true,focusTaskId:'10'});await flush();assert.equal(errors.length,0,errors.map(e=>e.stack).join('/'));assert(v.el.querySelector('.pack-finished').textContent.includes('100'));assert(!v.el.querySelector('.pack-finished').textContent.includes('96'));assert(![...v.el.querySelectorAll('button')].some(b=>/提交产出|补登记包装产出|开始包装/.test(b.textContent)));v.close();
assert.equal(errors.length,0,errors.map(e=>e.stack).join('/'));assert.equal(warnings.length,0,warnings.join('/'));await window.happyDOM.close();console.log('PASS packaging output volume and material submission, historical repair form, readonly guard and focused old task output isolation');
`},bundle:true,write:false,platform:'node',format:'esm',packages:'external',external:[domModule],plugins:[{name:'vue-count-fixtures',setup(b){b.onLoad({filter:/\/api\.js$/},()=>({contents:'export const brewApi=globalThis.__countApi;',loader:'js'}));b.onLoad({filter:/\.vue$/},async args=>{const {descriptor}=parse(await readFile(args.path,'utf8'),{filename:args.path});const script=compileScript(descriptor,{id:args.path,genDefaultAs:'__component'});const template=compileTemplate({source:descriptor.template.content,filename:args.path,id:args.path,compilerOptions:{bindingMetadata:script.bindings}});if(template.errors.length)throw template.errors[0];return {contents:script.content+'\n'+template.code+'\n__component.render=render;export default __component;',loader:'js',resolveDir:path.dirname(args.path)};});}}]});
// External Vue packages resolve through this temporary directory's local link.
const {symlink}=await import('node:fs/promises');await symlink(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
const file=path.join(temp,'check.mjs');await writeFile(file,result.outputFiles[0].text);await import(pathToFileURL(file).href);
}finally{await rm(temp,{recursive:true,force:true});}
