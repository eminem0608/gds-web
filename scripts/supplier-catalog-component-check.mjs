import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const {Window}=await import('/private/tmp/craft-count-ui/node_modules/happy-dom/lib/index.js');
const window=new Window({url:'http://localhost:5174'});
for(const key of ['window','document','Document','ShadowRoot','HTMLElement','Element','Node','SVGElement','Event'])globalThis[key]=key==='window'?window:window[key];
const {createApp,nextTick}=await import('vue');
const temp=await mkdtemp(path.join(tmpdir(),'supplier-check-'));
try{
await symlink(path.resolve('node_modules'),path.join(temp,'node_modules'),'dir');
const source=await readFile('src/App.vue','utf8');const start=source.indexOf('const SupplierCatalogPage =');
const component=source.slice(start,source.indexOf('\nconst ',start+10));
const suppliers=[{id:'11',name:'系统供应商甲'},{id:'12',name:'系统供应商乙'}];
const categories=[{id:'1',code:'malt',name:'麦芽',material_group:'malt'},{id:'2',code:'pils',name:'皮尔森',material_group:'malt',parent_id:{id:'1'}}];let saved;
globalThis.__supplierApi={listMaster:async r=>r==='suppliers'?suppliers:r==='material-categories'?categories:[],createMaster:async(r,p)=>{saved={r,p};}};
const file=path.join(temp,'raw.mjs');await writeFile(file,`import {defineComponent,ref,reactive,computed,onMounted} from 'vue';const brewApi=globalThis.__supplierApi;const materialMetrics=()=>[];${component}\nexport default SupplierCatalogPage;`);
const {default:Raw}=await import(pathToFileURL(file));const errors=[],warnings=[];
async function flush(){for(let i=0;i<5;i++){await nextTick();await new Promise(r=>setTimeout(r,0));}}
function mount(permissions){const el=document.createElement('div');document.body.append(el);const app=createApp(Raw,{permissions});app.config.warnHandler=m=>warnings.push(m);app.config.errorHandler=e=>errors.push(e);const vm=app.mount(el);return{el,vm,close(){app.unmount();el.remove();}};}
let v=mount(['base.master_data.manage']);await flush();[...v.el.querySelectorAll('button')].find(b=>b.textContent.includes('录入商品')).click();await flush();
const select=v.el.querySelector('[aria-label="商品所属供应商"]');assert(select.required);assert(select.textContent.includes('系统供应商甲'));
Object.assign(v.vm.draft,{group:'malt',category:'pils',name:'测试麦芽',brand:'品牌',specification:'25kg',extract_rate:80,color_ebc:4,price:12,quantity:100});
await v.vm.submit();assert(!saved);assert(v.vm.error.includes('供应商'));v.vm.draft.supplier_id='12';await v.vm.submit();assert.equal(saved.r,'materials');assert.equal(saved.p.brew_supplier_id,'12');assert.equal(saved.p.brew_extract_rate,80);v.close();
v=mount(['supplier.catalog.manage']);await flush();[...v.el.querySelectorAll('button')].find(b=>b.textContent.includes('录入商品')).click();await flush();assert(!v.el.querySelector('[aria-label="商品所属供应商"]'));v.close();
v=mount([]);await flush();assert(!v.el.textContent.includes('＋ 录入商品'));v.close();
const {parse,compileScript,compileTemplate}=await import('@vue/compiler-sfc');
const packFile=path.resolve('src/components/PackagingMaterialsPage.vue');const {descriptor}=parse(await readFile(packFile,'utf8'),{filename:packFile});
const script=compileScript(descriptor,{id:'supplier-pack',genDefaultAs:'__component'});const template=compileTemplate({source:descriptor.template.content,filename:packFile,id:'supplier-pack',compilerOptions:{bindingMetadata:script.bindings}});assert.equal(template.errors.length,0);
let packSaved;globalThis.__supplierApi.packagingSchema=async()=>({categories:[],types:[],suppliers,beers:[]});globalThis.__supplierApi.listPackaging=async()=>({items:[],total:0,can_manage:true,can_manage_catalog:true});globalThis.__supplierApi.savePackaging=async(id,p)=>{packSaved=p;};
const packModule=path.join(temp,'pack.mjs');await writeFile(packModule,script.content.replace(/import \{ brewApi \} from ['"]\.\.\/api['"];?/,'const brewApi=globalThis.__supplierApi;')+'\n'+template.code+'\n__component.render=render;export default __component;');
const {default:Pack}=await import(pathToFileURL(packModule));
const el=document.createElement('div');document.body.append(el);const app=createApp(Pack,{catalog:true});app.config.warnHandler=m=>warnings.push(m);app.config.errorHandler=e=>errors.push(e);app.mount(el);await flush();[...el.querySelectorAll('button')].find(b=>b.textContent.includes('录入供应商商品')).click();await flush();
const packForm=document.querySelector('.pack-editor form');const supplierSelect=packForm.querySelector('[aria-label="商品所属供应商"]');assert(supplierSelect.required);assert(supplierSelect.textContent.includes('系统供应商乙'));
packForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flush();assert(!packSaved);assert(document.querySelector('.pack-editor').textContent.includes('请选择系统设置中的供应商'));
supplierSelect.value='11';supplierSelect.dispatchEvent(new Event('change',{bubbles:true}));await flush();packForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flush();assert.equal(packSaved.supplier_id,'11');assert.equal(packSaved.supplier_catalog,true);app.unmount();el.remove();
assert.equal(errors.length,0,errors.map(e=>e.stack).join('/'));assert.equal(warnings.length,0,warnings.join('/'));console.log('PASS raw and packaging supplier form fields, admin configured-supplier selection and required validation, saved ownership, supplier self-service and viewer permissions');
}finally{await window.happyDOM.close();await rm(temp,{recursive:true,force:true});}
