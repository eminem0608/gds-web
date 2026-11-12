export function workbenchProductKey(item) {
  const production = item?.production;
  return String(production?.product_id || (production?.product ? 'name:' + production.product : '__other'));
}
export function filterWorkbenchProduct(items, selected) {
  return selected === 'all' ? items : items.filter(item => workbenchProductKey(item) === selected);
}
export function fallbackProductGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const id = workbenchProductKey(item);
    const group = groups.get(id) || { id, name: item.production?.product || '其他事项', count: 0 };
    if (!item.id?.endsWith(':monitor')) group.count++;
    groups.set(id, group);
  }
  return [...groups.values()];
}

export function workbenchBatchKey(item) {
  const production = item?.production;
  if (!production) return '__other';
  if (production.plan_name) return 'plan:' + production.plan_name;
  if (production.batch_name) return 'batch:' + production.batch_name;
  if (production.plan_id || item.plan_id) return 'plan-id:' + (production.plan_id || item.plan_id);
  return 'unlinked:' + item.id;
}
export function filterWorkbenchBatch(items, selected) {
  return selected === 'all' ? items : items.filter(item => workbenchBatchKey(item) === selected);
}
export function groupWorkbenchBatches(items) {
  const groups = new Map();
  for (const item of items) {
    const id = workbenchBatchKey(item);
    const group = groups.get(id) || { id, production: item.production, items: [] };
    group.items.push(item);
    groups.set(id, group);
  }
  return [...groups.values()];
}
