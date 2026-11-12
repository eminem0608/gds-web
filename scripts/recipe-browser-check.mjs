// Uses an isolated Chrome on :9224. Login is real; recipe writes are intercepted
// in this page only. Actual persistence is tested by test_recipe_design_rollback.py.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const pages = await fetch('http://127.0.0.1:9224/json/list').then(r => r.json());
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once:true }));
let id = 0;
const pending = new Map(), errors = [];
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
});
function command(method,params={}) { return new Promise((resolve,reject) => { const key=++id; pending.set(key,{resolve,reject}); socket.send(JSON.stringify({id:key,method,params})); }); }
async function evaluate(expression) { const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
const delay = ms => new Promise(r => setTimeout(r,ms));
async function until(expression) { for(let i=0;i<80;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out: '+expression); }
async function click(text, scope='document') { await evaluate(`[...${scope}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`); await delay(80); }
async function field(label,value) { await evaluate(`(() => {const l=[...document.querySelectorAll('.rw-body label')].find(l=>l.querySelector('span')?.textContent.trim()===${JSON.stringify(label)}); const e=l.querySelector('input,select,textarea');e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`); await delay(60); }
try {
  await command('Runtime.enable'); await command('Page.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await command('Page.navigate',{url:'http://localhost:5174'});
  await until(`!!document.querySelector('.app,.login-form')`);
  if(await evaluate(`!!document.querySelector('.login-form')`)) {
    await evaluate(`(() => {for(const [s,v] of [['username','admin'],['current-password','admin']]){const e=document.querySelector('input[autocomplete="'+s+'"]');e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('.login-form').requestSubmit();})()`);
  }
  await until(`!!document.querySelector('.nav-item')`);
  await evaluate(`(() => {
    const original=window.fetch.bind(window); let recipe,version; window.recipeTestWrites=[];
    const reply=data=>Promise.resolve(new Response(JSON.stringify({data}),{status:200,headers:{'Content-Type':'application/json'}}));
    window.fetch=async (url,options={})=>{
      const path=new URL(url,location.origin).pathname,method=options.method||'GET';
      if(path==='/api/v1/materials' && method==='GET') return reply([
        {id:'test-malt',name:'UI Test Pale Malt',brew_material_category:'malt',supplier:{name:'UI Test Supplier'},brew_extract_rate:80,brew_color_ebc:4,is_weight_uom:true},
        {id:'test-hop',name:'UI Test Hop',brew_material_category:'hop',supplier:{name:'UI Test Supplier'},brew_alpha_acid:10,is_weight_uom:true},
        {id:'test-yeast',name:'UI Test Yeast',brew_material_category:'yeast',supplier:{name:'UI Test Supplier'},brew_extract_rate:75,brew_flavor_desc:'clean',is_weight_uom:true}]);
      if(path==='/api/v1/recipes' && method==='POST') {
        const p=JSON.parse(options.body);version={...p.initial_version,id:'test-version',state:'draft',record_version:'test-1',name:'UI-V1'};
        recipe={...p,id:'test-recipe',code:'UI-TEST',beer_category:{id:p.beer_category_id},beer_subcategory:{id:p.beer_subcategory_id}};
        window.recipeTestWrites.push(p);return reply({...recipe,initial_version:version});
      }
      if(path==='/api/v1/recipes' && method==='GET')return reply(recipe?[recipe]:[]);
      if(path==='/api/v1/recipe-versions/test-version' && method==='PATCH'){Object.assign(version,JSON.parse(options.body));window.recipeTestWrites.push(JSON.parse(options.body));return reply(version);}
      if(path==='/api/v1/recipe-versions/test-version')return reply(version);
      if(path==='/api/v1/recipes/test-recipe/versions')return reply([version]);
      // Never allow test material IDs to reach a real mutation endpoint.
      if(method!=='GET' && (path.includes('/recipes')||path.includes('/recipe-versions')))throw Error('Unmocked recipe write: '+path);
      return original(url,options);
    };
  })()`);
  await evaluate(`[...document.querySelectorAll('.nav-item')].find(b=>b.textContent.includes('配方工艺')).click()`);
  await until(`!!document.querySelector('.recipe-workspace') && !document.querySelector('.recipe-workspace .empty')?.textContent.includes('加载')`);
  await click('新建配方工艺');
  const basicLayout = await evaluate(`(() => {
    const controls=[...document.querySelectorAll('.rw-basic-fields input,.rw-basic-fields select')];
    return { heights:controls.map(e=>e.getBoundingClientRect().height), cards:document.querySelectorAll('.rw-basic-card').length };
  })()`);
  assert.equal(basicLayout.cards,2);
  assert.deepEqual(basicLayout.heights,Array(6).fill(46),'All basic inputs and selects must have the same height');
  await writeFile('/tmp/recipe-basic-desktop.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await delay(100);
  assert.equal(await evaluate(`(() => {const b=document.querySelector('.rw-body'); return b.scrollWidth <= b.clientWidth;})()`),true,'Mobile form must not overflow horizontally');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.rw-basic-fields input,.rw-basic-fields select')].map(e=>e.getBoundingClientRect().height)`),Array(6).fill(46));
  await writeFile('/tmp/recipe-basic-mobile.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await field('啤酒名称 *','UI Layout Check');
  const ids=await evaluate(`(() => {const selects=document.querySelectorAll('.rw-body select');return {parent:[...selects[0].options].find(o=>o.textContent==='拉格')?.value || selects[0].options[1].value,equipment:selects[2].options[1].value};})()`);
  await field('啤酒分类 *',ids.parent);
  const child=await evaluate(`document.querySelectorAll('.rw-body select')[1].options[1].value`);
  await field('啤酒种类 *',child); await field('使用设备 *',ids.equipment); await field('酿造体积(L) *',20);
  await click('下一步');
  for(const [button,quantity] of [['＋ 添加原料',4],['＋ 添加酒花',20],['＋ 添加酵母',11]]) {
    await click(button); await until(`!!document.querySelector('.supplier-material-picker-card')`);
    await evaluate(`document.querySelector('.supplier-material-picker-card').click()`); await delay(60);
    await evaluate(`(() => {const es=document.querySelectorAll('input[aria-label="原料数量"]');const e=es[es.length-1];e.value=${quantity};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  }
  const alignment=await evaluate(`(() => {const t=document.querySelector('.rw-table');return [...t.querySelectorAll('th')].every((h,i)=>Math.abs(h.getBoundingClientRect().x-t.querySelector('tbody tr').children[i].getBoundingClientRect().x)<1);})()`);
  assert.equal(alignment,true,'Headers and cells must align');
  assert.equal(await evaluate(`document.querySelectorAll('.rw-table').length`),3);
  await writeFile('/tmp/recipe-layout-check.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await click('发酵工艺'); await click('＋ 添加步骤');
  await evaluate(`document.querySelector('.rw-segment input[value="interval"]').click()`);
  await evaluate(`(() => {const e=document.querySelector('.rw-condition input');e.value=3;e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('糖化工艺'); await click('发酵工艺');
  assert.equal(await evaluate(`document.querySelector('.rw-segment input:checked').value`),'interval');
  assert.equal(await evaluate(`document.querySelector('.rw-condition input').value`),'3');
  assert.equal(await evaluate(`document.querySelectorAll('.rw-fermentation tbody tr').length`),1);
  await writeFile('/tmp/recipe-fermentation-check.png',Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await click('保存草稿'); await until(`window.recipeTestWrites.length===1`);
  await until(`!!document.querySelector('.rw-notice')?.textContent.includes('已保存')`);
  await until(`!document.querySelector('.rw-mask')`);
  const saved=await evaluate(`window.recipeTestWrites[0].initial_version.design`);
  assert.equal(saved.fermentation.steps[0].schedule_type,'interval');assert.equal(saved.fermentation.steps[0].interval_days,3);
  assert.equal(saved.fermentables.length,1);assert.equal(saved.hops.length,1);assert.equal(saved.yeast.length,1);
  await click('查看 / 编辑'); await click('发酵工艺');
  assert.equal(await evaluate(`document.querySelector('.rw-segment input:checked').value`),'interval');
  assert.equal(await evaluate(`document.querySelector('.rw-condition input').value`),'3');
  await click('保存草稿'); await until(`window.recipeTestWrites.length===2`);
  await until(`!document.querySelector('.rw-mask')`);
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('PASS: actual login/navigation, basic field heights (46px), mobile overflow, supplier picker, table alignment, tab stability, interval input, mocked save/reopen/update, no runtime exceptions');
} finally { socket.close(); }
