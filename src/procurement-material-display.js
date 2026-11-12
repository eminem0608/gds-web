const positive = value => value !== null && value !== undefined && value !== '' && value !== false && Number.isFinite(Number(value)) && Number(value) > 0;

export function materialGroup(item, categories = []) {
  return categories.find(category => category.code === item.brew_material_category)?.material_group || item.brew_material_category;
}

export function materialMetrics(item, categories = []) {
  const group = materialGroup(item, categories);
  const extract = positive(item.brew_extract_dry_pct) && ['malt', 'adjunct'].includes(group) ? item.brew_extract_dry_pct : item.brew_extract_rate;
  const format = value => Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
  const range = (low, high, unit, label) => {
    const present = value => unit === '℃' ? value !== null && value !== undefined && value !== '' && value !== false && Number.isFinite(Number(value)) && Number(value) !== 0 : positive(value);
    if (!present(low) && !present(high)) return null;
    return { label, value: present(low) && present(high) ? (Number(low) === Number(high) ? format(low) : `${format(low)}–${format(high)}`) : `${present(low) ? '≥' : '≤'}${format(present(low) ? low : high)}`, unit };
  };
  const fields = group === 'hop' ? [
    ['α 酸', item.brew_alpha_acid, '%'], ['β 酸', item.brew_beta_acid, '%'],
    ['合葎草酮', item.brew_cohumulone_pct, '%'], ['总油', item.brew_total_oil_ml_100g, 'mL/100g']
  ] : group === 'yeast' ? [['耐醇度', item.brew_alcohol_tolerance_pct, '%']] : [
    ['色度', item.brew_color_ebc, 'EBC'],
    [positive(item.brew_extract_dry_pct) ? '干基浸出率' : '浸出率', extract, '%'],
    ['水分', item.brew_moisture_pct, '%'], ['糖化力', item.brew_diastatic_power_wk, '°WK'],
    ['蛋白质', item.brew_total_protein_pct, '%']
  ];
  const metrics = fields.filter(([, value]) => positive(value)).map(([label, value, unit]) => ({ label, value: format(value), unit }));
  if (group === 'yeast') {
    const attenuation = range(item.brew_attenuation_min, item.brew_attenuation_max, '%', '发酵度');
    const temperature = range(item.brew_fermentation_temp_min, item.brew_fermentation_temp_max, '℃', '温度');
    const leading = [attenuation || (positive(item.brew_extract_rate) ? { label: '发酵度', value: format(item.brew_extract_rate), unit: '%' } : null), temperature,
      item.brew_flocculation ? { label: '絮凝', value: item.brew_flocculation, unit: '' } : null].filter(Boolean);
    return [...leading, ...metrics];
  }
  return metrics;
}

export function materialPrice(item) {
  if (!positive(item.brew_supplier_price)) return '';
  return Number(item.brew_supplier_price).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Procurement comparison keeps the primary fields visible even before a supplier fills them in.
export function materialComparisonMetrics(item, categories = []) {
  const group = materialGroup(item, categories);
  const schema = group === 'hop' ? [['α 酸', '%'], ['β 酸', '%'], ['合葎草酮', '%'], ['总油', 'mL/100g']]
    : group === 'yeast' ? [['发酵度', '%'], ['温度', '℃'], ['絮凝', ''], ['耐醇度', '%']]
    : [['色度', 'EBC'], ['浸出率', '%'], ['水分', '%'], ['糖化力', '°WK'], ['蛋白质', '%']];
  const available = materialMetrics(item, categories);
  return schema.map(([label, unit]) => {
    const metric = available.find(metric => metric.label === label || (label === '浸出率' && metric.label === '干基浸出率'));
    return metric ? { ...metric, missing: false } : { label, unit, value: '—', missing: true };
  });
}
