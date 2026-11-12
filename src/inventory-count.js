export const countReasons = { damage:'破损', expired:'过期报废', measurement:'计量误差', missing_transaction:'单据未及时入账', unrecorded_issue_return:'领退料未登记', other:'其他' };
export function hasCount(line) {
  return line.counted_qty !== null && line.counted_qty !== '' && line.counted_qty !== undefined
    && Number.isFinite(Number(line.counted_qty)) && Number(line.counted_qty) >= 0;
}
export function countDelta(line) {
  if (!hasCount(line)) return null;
  const value = Number(line.counted_qty) - Number(line.theoretical_qty);
  return Math.abs(value) < Number(line.uom?.rounding || 0.000001) / 2 ? 0 : Number(value.toFixed(8));
}
export function countStatus(record) {
  if (record.state === 'pending_approval') return ({ approved:'待入账', returned:'已退回', pending:'待审批', cancelled:'审批已取消' })[record.approval_state] || '待审批';
  return ({ draft:'未开始', counting:'盘点中', done:'已完成', cancelled:'已取消' })[record.state] || record.state;
}
export function countPayload(lines) {
  if (lines.some(line => line.counted_qty !== null && line.counted_qty !== '' && line.counted_qty !== undefined && !hasCount(line))) {
    throw new Error('实盘数量必须是大于等于零的有效数字。');
  }
  return lines.map(line => ({ id:line.id, counted_qty:hasCount(line)?Number(line.counted_qty):null,
    difference_reason:countDelta(line)?line.difference_reason||null:null,
    difference_note:countDelta(line)?line.difference_note||null:null,
    ...(line.recount_note?{recount_note:line.recount_note}:{}) }));
}
export function countValidation(lines, reasons = true) {
  const uncounted = lines.filter(line => !hasCount(line));
  if (uncounted.length) return `还有 ${uncounted.length} 项未盘，实盘为零请明确填写 0。`;
  if (reasons) {
    const missing = lines.filter(line => countDelta(line) && (!line.difference_reason || (line.difference_reason==='other'&&!String(line.difference_note||'').trim())));
    if (missing.length) return `还有 ${missing.length} 项差异需要填写原因或说明。`;
  }
  return '';
}
export function countQuantityGroups(lines) {
  const groups = new Map();
  for (const line of lines) {
    const delta = countDelta(line);
    if (!delta) continue;
    const key = line.uom?.id || line.uom?.name || 'unknown';
    const group = groups.get(key) || { unit:line.uom?.name || '', increase:0, decrease:0 };
    group.increase += Math.max(delta,0); group.decrease += Math.max(-delta,0); groups.set(key,group);
  }
  return [...groups.values()];
}
