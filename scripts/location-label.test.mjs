import test from 'node:test';
import assert from 'node:assert/strict';
import { locationLabel, locationPathLabel } from '../src/location-label.js';
import { groupWarehouseLocations } from '../src/location-groups.js';

test('warehouse paths and embedded system codes are hidden while tank identities remain distinct', () => {
  assert.equal(locationLabel('PILOT/生产暂存库'), '生产暂存库');
  assert.equal(locationLabel('PILO2/Stock/试运行厂区-PILOT-MASH-01 糖化系统-BBTa1'), '试运行厂区-糖化系统-BBTa1');
  assert.equal(locationLabel('23872/Stock/试运行厂区-PILOT-MASH-01 糖化系统-F01'), '试运行厂区-糖化系统-F01');
  assert.equal(locationLabel('L69/Stock/领料暂存区'), '领料暂存区');
  assert.equal(locationLabel('WH/Stock'), '主库存区');
  assert.equal(locationLabel('PILOT/Quality Control'), '质检区');
  assert.equal(locationLabel({ location_name: '麦芽区', name: 'PILOT/Stock/麦芽区' }), '麦芽区');
  assert.equal(locationLabel({ complete_name: 'WH/Stock/成品区' }), '成品区');
  assert.equal(locationLabel(null, '待选择'), '待选择');
});

test('duplicate bin names in separate warehouses retain their original selection IDs', () => {
  const locations = [
    { id: 'a', location_id: { id: 'root-a' }, complete_name: 'PILO2/Stock/领料暂存区' },
    { id: 'b', location_id: { id: 'root-b' }, complete_name: 'L69/Stock/领料暂存区' }
  ];
  const groups = groupWarehouseLocations(locations, [
    { id: 'wa', name: '试运行厂区领料库', lot_stock_id: { id: 'root-a' } },
    { id: 'wb', name: '铜陵厂领料库', lot_stock_id: { id: 'root-b' } }
  ]);
  assert.deepEqual(groups.map(g => [g.id, g.locations[0].id, g.locations[0].label]), [
    ['wa', 'a', '领料暂存区'], ['wb', 'b', '领料暂存区']
  ]);
  assert.equal(locations[0].complete_name, 'PILO2/Stock/领料暂存区');
  assert.equal(locationPathLabel('PILO2/Stock/麦芽区/A01'), '主库存区/麦芽区/A01');
});
