import test from 'node:test';
import assert from 'node:assert/strict';
import { workbenchProductKey, filterWorkbenchProduct, fallbackProductGroups } from '../src/workbench-products.js';
test('product IDs group batches without merging identically named products', () => {
  const rows = [{id:'a',production:{product_id:'1',product:'拉格',batch_name:'BAT-A'}},{id:'b',production:{product_id:'1',product:'拉格',batch_name:'BAT-B'}},{id:'c',production:{product_id:'2',product:'拉格'}},{id:'d'}];
  assert.equal(workbenchProductKey(rows[3]),'__other');
  assert.deepEqual(filterWorkbenchProduct(rows,'1').map(r=>r.id),['a','b']);
  assert.equal(filterWorkbenchProduct(rows,'all').length,4);
  assert.deepEqual(fallbackProductGroups(rows).map(g=>[g.id,g.count]),[['1',2],['2',1],['__other',1]]);
});
test('old production contexts retain a stable readable fallback', () => {
  const record={id:'old',production:{product:'经典拉格12'}};
  assert.equal(workbenchProductKey(record),'name:经典拉格12');
  assert.equal(filterWorkbenchProduct([record],'name:经典拉格12')[0],record);
  assert.deepEqual(record,{id:'old',production:{product:'经典拉格12'}});
});

test('same beer and same tank remain separate batches; steps in one plan stay grouped', async () => {
  const { workbenchBatchKey, groupWorkbenchBatches, filterWorkbenchBatch } = await import('../src/workbench-products.js');
  const first={product_id:'1',product:'拉格',tank:'F-01',plan_name:'PLN-1',batch_name:'BAT-1'};
  const second={...first,plan_name:'PLN-2',batch_name:'BAT-2'};
  const rows=[{id:'a',production:first},{id:'b',production:second},{id:'c',production:first}];
  assert.notEqual(workbenchBatchKey(rows[0]),workbenchBatchKey(rows[1]));
  assert.deepEqual(groupWorkbenchBatches(rows).map(g=>g.items.map(i=>i.id)),[['a','c'],['b']]);
  assert.deepEqual(filterWorkbenchBatch(rows,'plan:PLN-2').map(i=>i.id),['b']);
});
