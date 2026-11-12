import test from 'node:test';
import assert from 'node:assert/strict';
import { groupWarehouseLocations, locationDisplayName } from '../src/location-groups.js';

test('warehouse bins retain IDs and relative paths without the PILOT prefix', () => {
  const groups = groupWarehouseLocations([
    { id: 'root', complete_name: 'PILOT/原料仓' },
    { id: 'area', complete_name: 'PILOT/原料仓/A区' },
    { id: 'a', complete_name: 'PILOT/原料仓/A区/01' },
    { id: 'b', complete_name: 'PILOT/原料仓/B区/02' },
    { id: 'p', complete_name: 'PILOT/包装材料仓/01' }
  ]);
  assert.deepEqual(groups.map(group => group.name), ['原料仓', '包装材料仓']);
  assert.deepEqual(groups[0].locations.map(location => [location.id, location.label]), [['a', 'A区 / 01'], ['b', 'B区 / 02']]);
  assert.equal(groups[1].locations[0].id, 'p');
});

test('a warehouse without child bins remains selectable', () => {
  const [group] = groupWarehouseLocations([{ id: 'root', complete_name: 'PILOT/原料仓' }]);
  assert.equal(group.locations[0].id, 'root');
  assert.equal(group.locations[0].label, '原料仓');
});

test('names without the prefix and empty lists are supported', () => {
  assert.equal(locationDisplayName({ name: '原料仓/A01' }), '原料仓/A01');
  assert.equal(locationDisplayName({ complete_name: 'PILOT / 原料仓/A01' }), '原料仓/A01');
  assert.deepEqual(groupWarehouseLocations([]), []);
});

test('actual warehouse root IDs override technical display names', () => {
  const groups = groupWarehouseLocations([
    { id: 'root', complete_name: 'PILOT/原料库' },
    { id: 'a', location_id: { id: 'root' }, location_name: '麦芽区', complete_name: 'PILOT/原料库/麦芽区' },
    { id: 'b', location_id: { id: 'a' }, location_name: 'A01', complete_name: 'PILOT/原料库/麦芽区/A01' },
    { id: 'p', location_id: { id: 'pack' }, location_name: '包装01', complete_name: 'PACK/Stock/包装01' }
  ], [
    { id: 'raw', name: '原料仓', lot_stock_id: { id: 'root', name: 'PILOT/原料库' } },
    { id: 'pack-warehouse', name: '包装仓', lot_stock_id: { id: 'pack' } }
  ]);
  assert.equal(groups[0].id, 'raw');
  assert.equal(groups[0].name, '原料仓');
  assert.deepEqual(groups[0].locations.map(l => [l.id, l.label]), [['b', '麦芽区 / A01']]);
  assert.equal(groups[1].locations[0].id, 'p');
});

test('a configured warehouse without bins shows no invented default location', () => {
  const groups = groupWarehouseLocations([{ id: 'root', complete_name: 'PILOT/原料库' }], [{ id: 'raw', name: '原料仓', lot_stock_id: { id: 'root' } }]);
  assert.equal(groups[0].locations.length, 0);
});
