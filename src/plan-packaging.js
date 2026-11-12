export function emptyPackagingDraft() {
  return { finished_packaging_id: '', materials: [], planned_start: '', planned_end: '', owner_id: '', notes: '' };
}
export function packagingPayload(draft) {
  if (!(draft.materials || []).length || !draft.owner_id || !draft.planned_start || !draft.planned_end) throw new Error('请添加包装材料、填写起止时间，并指定包装执行人。');
  return { packaging_owner_id: Number(draft.owner_id), packaging_plan: { materials_only: true, ...(draft.finished_packaging_id ? { finished_packaging_id: Number(draft.finished_packaging_id) } : {}), materials: (draft.materials || []).map(line => ({ material_id: Number(line.material_id), quantity: Number(line.quantity) })), planned_start: new Date(draft.planned_start).toISOString(), planned_end: new Date(draft.planned_end).toISOString(), notes: draft.notes } };
}
export function localDateTime(value) {
  if (!value) return '';
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
