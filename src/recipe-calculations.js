// Percent fields use 0..100; gravity uses SG; weights are kg (grain) / g (hops, yeast).
export const fixedUtilization = { FWH: 40, '60': 23, '30': 11, '0': 11, WP: 11, DH: 0 };
export const present = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const num = (value, fallback = 0) => present(value) ? Number(value) : fallback;
export function emptyDesign() {
  return { schema_version: 2, brew_volume_l: 1000, brew_equipment_id: '', ibu_method: 'tinseth',
    targets: { og: '', fg: '', ibu: '', color: '', abv: '' },
    fermentables: [], hops: [], yeast: [], attenuation_override: '',
    mash: { efficiency: 72, water_grain_ratio: 3.5, absorption_rate: 0.8, boil_time_min: 60, evaporation_rate: 10, screen_water_l: 0, sparge_count: 3, sparge_mode: 'auto', sparge_water_liters: [], steps: [], notes: '', workflow: { preheat_offset_c: 5, sparge_temperature_c: 78, iodine_check_required: true, whirlpool_time_min: 20, cooling_temperature_c: 18, operations: {} } },
    fermentation: { target_temperature: '', target_days: '', cold_storage_temperature: '', notes: '', steps: [] } };
}
export function normalizeDesign(saved = {}, version = {}) {
  saved = JSON.parse(JSON.stringify(saved || {}));
  const base = emptyDesign();
  const d = { ...base, ...saved, schema_version: 2,
    brew_volume_l: Number(saved.brew_volume_l) > 0 ? saved.brew_volume_l : version.base_volume_l ?? base.brew_volume_l,
    targets: { og: version.original_gravity || '', fg: version.final_gravity || '', ibu: version.bitterness_ibu || '', color: version.color_ebc || '', abv: version.alcohol_abv || '', ...saved.targets },
    mash: { ...base.mash, ...saved.mash, workflow: { ...base.mash.workflow, ...(saved.mash?.workflow || {}), operations: { ...base.mash.workflow.operations, ...(saved.mash?.workflow?.operations || {}) } } }, fermentation: { ...base.fermentation, ...saved.fermentation } };
  d.hops = (d.hops || []).map(line => {
    const time = String(line.time ?? '60');
    const use = line.use || (['FWH', 'WP', 'DH', '0'].includes(time) ? time : 'boil');
    return { ...line, use, time: ['FWH', 'WP', 'DH'].includes(time) ? '' : time, utilization_override: line.utilization_override ?? (present(line.utilization) ? line.utilization : '') };
  });
  if (!present(d.attenuation_override) && present(saved.metrics?.apparent_attenuation)) d.attenuation_override = saved.metrics.apparent_attenuation;
  d.fermentation.steps = (d.fermentation.steps || []).map(step => ({ ...step,
    schedule_type: ['daily', 'day', 'interval'].includes(step.schedule_type) ? step.schedule_type : step.schedule_type ? '' : 'daily',
    condition_value: step.condition_value ?? (present(step.threshold) ? step.threshold : ''), operator: step.operator || '=' }));
  return d;
}
export function calculateRecipe(d) {
  const volume = num(d.brew_volume_l);
  const grain = d.fermentables || [], mash = d.mash || {};
  const totalQuantity = grain.reduce((s, l) => s + num(l.quantity), 0);
  const completeGrain = totalQuantity > 0 && grain.every(l => present(l.extract_rate));
  const extractKg = grain.reduce((s, l) => s + num(l.quantity) * num(l.extract_rate) / 100, 0) * num(mash.efficiency, 72) / 100;
  const og = volume > 0 && completeGrain ? 1 + extractKg / volume * 0.4 : null;
  const preBoilVolume = volume * (1 + num(mash.evaporation_rate, 10) / 100 * num(mash.boil_time_min, 60) / 60);
  const preBoilGravity = og && preBoilVolume ? 1 + (og - 1) * volume / preBoilVolume : null;
  const boilGravity = og ? (og + preBoilGravity) / 2 : (num(d.targets?.og) || null);
  const hopResults = (d.hops || []).map(l => {
    const use = l.use || 'boil';
    let utilization;
    if (d.ibu_method === 'fixed') utilization = fixedUtilization[use === 'boil' ? String(l.time) : use] ?? null;
    else if (use === 'DH' || use === '0') utilization = 0;
    else if (use === 'FWH' || use === 'WP') utilization = present(l.utilization_override) ? num(l.utilization_override) : null;
    else utilization = present(l.time) && boilGravity ? 1.65 * Math.pow(0.000125, boilGravity - 1) * (1 - Math.exp(-0.04 * num(l.time))) / 4.15 * 100 : null;
    const ibu = utilization !== null && volume > 0 && present(l.alpha_acid) ? num(l.alpha_acid) / 100 * num(l.quantity) * utilization / 100 * 1000 / volume : null;
    return { utilization, ibu };
  });
  const ibu = hopResults.every(l => l.ibu !== null) ? hopResults.reduce((s, l) => s + l.ibu, 0) : null;
  // Morey: MCU uses lb × Lovibond / US gal. EBC -> SRM -> Lovibond.
  const mcu = volume > 0 ? grain.reduce((s, l) => s + num(l.quantity) * 2.2046226218 * (num(l.color) > 0 ? (num(l.color) / 1.97 + 0.76) / 1.3546 : 0), 0) / (volume / 3.785411784) : 0;
  const color = totalQuantity && volume && grain.every(l => present(l.color)) ? 1.97 * 1.4922 * Math.pow(mcu, 0.6859) : null;
  // A blend cannot be reliably inferred by mass-weighting strains; require a recipe override.
  const attenuation = present(d.attenuation_override) ? num(d.attenuation_override) : d.yeast?.length === 1 && present(d.yeast[0].attenuation) && num(d.yeast[0].attenuation) > 0 ? num(d.yeast[0].attenuation) : null;
  const fg = og && attenuation !== null ? og - (og - 1) * attenuation / 100 : null;
  const abv = fg !== null ? (og - fg) * 131.25 : null;
  const mashWater = totalQuantity * num(mash.water_grain_ratio, 3.5);
  const absorption = totalQuantity * num(mash.absorption_rate, 0.8);
  const firstWort = Math.max(0, mashWater - absorption - num(mash.screen_water_l));
  const spargeWater = Math.max(0, preBoilVolume - firstWort);
  const count = Math.max(1, Math.min(10, Math.trunc(num(mash.sparge_count, 3))));
  const equal = Math.floor(spargeWater * 100 / count) / 100;
  const spargeWaters = mash.sparge_mode === 'manual' ? Array.from({ length: count }, (_, i) => num(mash.sparge_water_liters?.[i])) : Array.from({ length: count }, (_, i) => i === count - 1 ? Math.round((spargeWater - equal * (count - 1)) * 100) / 100 : equal);
  const actualSparge = spargeWaters.reduce((s, v) => s + v, 0);
  return { totalQuantity, extractKg, og, fg, abv, ibu, color, attenuation, hopResults, preBoilVolume, preBoilGravity, boilGravity, mashWater, absorption, firstWort, spargeWater, spargeWaters, actualSparge, totalWater: mashWater + actualSparge, spargeDifference: actualSparge - spargeWater };
}
export function scaleToTarget(d) {
  const current = calculateRecipe(d);
  if (!current.og || current.og <= 1 || !present(d.targets.og) || Number(d.targets.og) <= 1) throw new Error('请先填写目标 OG、麦芽用量和浸出率。');
  const factor = (Number(d.targets.og) - 1) / (current.og - 1);
  d.fermentables.forEach(l => { l.quantity = Number((num(l.quantity) * factor).toFixed(4)); });
}
