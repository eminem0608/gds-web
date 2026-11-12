import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasCount,countDelta,countPayload,countValidation,countStatus,countQuantityGroups } from '../src/inventory-count.js';
const row=(actual,book=10,unit='kg')=>({id:'1',counted_qty:actual,theoretical_qty:book,uom:{id:unit,name:unit,rounding:0.001},difference_reason:'',difference_note:''});
test('unseen and explicit zero are distinct',()=>{
  assert.equal(hasCount(row(null)),false);assert.equal(hasCount(row('')),false);assert.equal(hasCount(row(0)),true);
  assert.equal(countDelta(row(null)),null);assert.equal(countDelta(row(0)),-10);
  assert.equal(countPayload([row(null)])[0].counted_qty,null);
  assert.equal(countPayload([row(0)])[0].counted_qty,0);
});
test('rounding, difference reasons and other explanation',()=>{
  assert.equal(countDelta(row(10.0001)),0);assert.equal(countValidation([row(9)],false),'');
  assert.match(countValidation([row(9)]),/原因/);assert.match(countValidation([row('')]),/未盘/);
  const r={...row(9),difference_reason:'other'};assert.match(countValidation([r]),/说明/);
  r.difference_note='已复核';assert.equal(countValidation([r]),'');
});
test('invalid inputs cannot silently become zero or an empty count',()=>{
  for(const value of [-1,Infinity,NaN,'hello'])assert.throws(()=>countPayload([row(value)]),/有效数字/);
});
test('mixed units are grouped separately',()=>{
  const groups=countQuantityGroups([row(12),row(7),row(11,10,'个')]);
  assert.equal(groups.length,2);assert.deepEqual(groups[0],{unit:'kg',increase:2,decrease:3});
  assert.deepEqual(groups[1],{unit:'个',increase:1,decrease:0});
});
test('approval and posting statuses remain separate',()=>{
  assert.equal(countStatus({state:'pending_approval',approval_state:'pending'}),'待审批');
  assert.equal(countStatus({state:'pending_approval',approval_state:'approved'}),'待入账');
  assert.equal(countStatus({state:'pending_approval',approval_state:'returned'}),'已退回');
});
