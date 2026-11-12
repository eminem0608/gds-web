import test from 'node:test';
import assert from 'node:assert/strict';
import { reactive } from 'vue';
import { emptyDesign, calculateRecipe, normalizeDesign, scaleToTarget } from '../src/recipe-calculations.js';

function fixture() {
  const d = emptyDesign();
  d.brew_volume_l = 20;
  Object.assign(d.mash, { water_calculation: 'legacy', water_grain_ratio: 3.5, boil_time_min: 60, evaporation_rate: 10, sparge_count: 3 });
  d.fermentables = [{ quantity: 4, extract_rate: 80, color: 4 }, { quantity: .5, extract_rate: 75, color: 120 }];
  d.hops = [{ use: 'boil', time: 60, quantity: 20, alpha_acid: 10 }, { use: 'boil', time: 10, quantity: 10, alpha_acid: 5 }];
  d.yeast = [{ attenuation: 75 }];
  return d;
}
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`);
test('20 L golden recipe: extract, gravity, attenuation, Tinseth, Morey and water', () => {
  const m = calculateRecipe(fixture());
  near(m.extractKg, 2.574); near(m.og, 1.05148); near(m.fg, 1.01287); near(m.abv, 5.0675625);
  near(m.preBoilGravity, 1.0468); near(m.ibu, 25.3524076874); near(m.color, 17.0178881839);
  near(m.mashWater, 15.75); near(m.spargeWater, 9.85); near(m.totalWater, 25.6);
  assert.deepEqual(m.spargeWaters, [3.28, 3.28, 3.29]);
});
test('Tinseth depends on boil time; fixed mode uses original design values', () => {
  const d = fixture(); const original = calculateRecipe(d).ibu;
  d.hops[0].time = 30; assert.ok(calculateRecipe(d).ibu < original);
  d.ibu_method = 'fixed'; d.hops = ['FWH', 'WP', 'DH', '0'].map(use => ({ use, quantity: 20, alpha_acid: 10 }));
  assert.deepEqual(calculateRecipe(d).hopResults.map(r => r.utilization), [40, 11, 0, 11]);
  near(calculateRecipe(d).ibu, 62);
});
test('no fabricated attenuation or utilization when inputs are missing', () => {
  const d = fixture(); d.yeast.push({ attenuation: 90 });
  assert.equal(calculateRecipe(d).fg, null);
  d.attenuation_override = 80; near(calculateRecipe(d).fg, 1.010296);
  d.attenuation_override = 0; near(calculateRecipe(d).abv, 0);
  d.hops[0].use = 'WP'; assert.equal(calculateRecipe(d).ibu, null);
  d.hops[0].utilization_override = 0; near(calculateRecipe(d).hopResults[0].ibu, 0);
  d.fermentables[0].extract_rate = ''; assert.equal(calculateRecipe(d).og, null);
});
test('scale to target preserves grain proportions', () => {
  const d = fixture(); d.targets.og = 1.06; scaleToTarget(d);
  near(calculateRecipe(d).og, 1.06, 1e-6);
  near(d.fermentables[0].quantity / d.fermentables[1].quantity, 8, .001);
});
test('manual water allocations remain manual and expose mismatches', () => {
  const d = fixture(); d.mash.sparge_mode = 'manual'; d.mash.sparge_water_liters = [5, 3, 1.85];
  near(calculateRecipe(d).spargeDifference, 0);
  d.mash.sparge_water_liters[0] = 6; near(calculateRecipe(d).spargeDifference, 1);
});
test('Vue proxy and saved fermentation schedules round trip without mutation', () => {
  const d = fixture(); d.fermentation.steps = ['daily','day','interval'].map(schedule_type => ({ condition:'time', schedule_type, day_value:4, interval_days:2 }));
  const restored = normalizeDesign(reactive(d), { base_volume_l: 20 });
  assert.deepEqual(restored.fermentation.steps.map(s => s.schedule_type), ['daily','day','interval']);
  restored.fermentables[0].quantity = 100; assert.equal(d.fermentables[0].quantity, 4);
});
test('legacy design keeps actual batch volume and does not guess broken radio values', () => {
  const saved = { brew_volume_l: 20, metrics: { apparent_attenuation: 76 }, fermentation: { steps: [{ condition:'time',schedule_type:'on' }, { condition:'temperature',threshold:'18' }] } };
  const d = normalizeDesign(saved, { base_volume_l:1000 });
  assert.equal(d.brew_volume_l,20); assert.equal(d.attenuation_override,76);
  assert.equal(d.fermentation.steps[0].schedule_type,'');
  assert.equal(d.fermentation.steps[1].condition_value,'18');
});
test('original mash page starts with temperature steps and standard execution', () => {
  const d = emptyDesign();
  assert.equal(d.mash.water_calculation, 'original');
  assert.equal(d.mash.workflow.execution_mode, 'standard');
  for (const key of ['evaporation_rate', 'water_grain_ratio', 'boil_time_min', 'sparge_count']) assert.equal(d.mash[key], '');
  assert.deepEqual(d.mash.steps, []);
  assert.deepEqual(d.mash.workflow.operations, {});
  d.mash.steps.push({ name: '糖化', temperature: 65, duration_min: 30 });
  const restored = normalizeDesign(reactive(d));
  assert.deepEqual(restored.mash.steps, d.mash.steps);
  assert.deepEqual(restored.mash.workflow.operations, {});
  assert.deepEqual(emptyDesign().mash.steps, []);
});
test('original water formulas use total boil intensity and distribute sparge water exactly', () => {
  const d = emptyDesign();
  d.brew_volume_l = 500;
  d.fermentables = [{ quantity: 100, extract_rate: 80, color: 4 }];
  Object.assign(d.mash, { screen_water_l: 30, efficiency: 75, evaporation_rate: 10, water_grain_ratio: 3, boil_time_min: 90, sparge_count: 3 });
  const m = calculateRecipe(d);
  near(m.preBoilVolume, 550); near(m.mashWater, 300);
  near(m.spargeWater, 250); near(m.totalWater, 500);
  assert.deepEqual(m.spargeWaters, [83.33, 83.33, 83.34]);
  d.mash.boil_time_min = 60; near(calculateRecipe(d).preBoilVolume, 550);
  d.mash.sparge_mode = 'manual'; d.mash.sparge_water_liters = [100, 75, 75];
  near(calculateRecipe(d).spargeDifference, 0);
  const restored = normalizeDesign(reactive(d));
  assert.deepEqual(calculateRecipe(restored).spargeWaters, [100, 75, 75]);
  restored.mash.sparge_water_liters[0] = 100.01;
  assert.ok(calculateRecipe(restored).spargeDifference > .005);
});
test('legacy water calculations remain unchanged when a saved recipe is opened', () => {
  const saved = fixture(); delete saved.mash.water_calculation;
  const restored = normalizeDesign(saved);
  assert.equal(restored.mash.water_calculation, 'legacy');
  near(calculateRecipe(restored).spargeWater, 9.85);
  assert.deepEqual(restored.mash.workflow.operations, {});
});
