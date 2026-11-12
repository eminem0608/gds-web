<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { brewApi } from '../api';
import FermentationTrends from './FermentationTrends.vue';
const props = defineProps({ task: Object, canOperate: Boolean });
const emit = defineEmits(['changed']);
const tab = ref('pending'), selectedDate = ref(''), selectedIds = ref([]), saving = ref(false), error = ref('');
const formOpen = ref(false), metrics = ref({}), note = ref(''), measuredAt = ref(''), startedAt = ref(''), manualEntry = ref(null), dialog = ref(null), actionConfirmed = ref(false);
const labels = { temperature: '温度', gravity: '糖度', pressure: '压力', diacetyl: '双乙酰', attenuation: '实际发酵度' };
const units = { temperature: '℃', gravity: '°P', pressure: 'bar', diacetyl: 'mg/L', attenuation: '%' };
const names = computed(() => ({ pending: props.canOperate ? '今日待办' : '待填写', overdue: '未填写', future: '待填写', waiting: '等待条件', done: '已完成' }));
const execution = computed(() => props.task.fermentation_execution || {});
const entries = computed(() => execution.value.entries || []);
const records = computed(() => [...(execution.value.records || [])].reverse());
const active = computed(() => props.canOperate && props.task.state === 'in_progress');
const todo = computed(() => entries.value.filter(e => ['pending', 'overdue'].includes(e.status)));
const visible = computed(() => {
  if (tab.value === 'calendar') return entries.value.filter(e => e.date === selectedDate.value);
  const seen = new Set();
  return entries.value.filter(e => {
    if (['pending','overdue'].includes(e.status)) return true;
    if (e.status !== 'done' || e.date !== execution.value.today) return false;
    const key = `${e.record}:${e.metric || e.id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
});
function completionRecord(entry) { return records.value.find(record => record.id === entry.record); }
const waiting = computed(() => entries.value.filter(e => e.status === 'waiting'));
const calendar = computed(() => [...new Set(entries.value.map(e => e.date).filter(Boolean))].sort().map(date => { const items = entries.value.filter(e => e.date === date); const done = items.filter(e => e.status === 'done').length; const overdue = items.some(e => e.status === 'overdue'); return { date, done, total: items.length, overdue, status: done === items.length ? '已完成' : '待填写' }; }));
const needed = computed(() => [...new Set(entries.value.filter(e => selectedIds.value.includes(e.id)).map(e => e.metric).filter(Boolean))]);
const formMetrics = computed(() => manualEntry.value ? [...new Set([manualEntry.value.rule.condition, manualEntry.value.metric].filter(Boolean))] : selectedIds.value.length ? needed.value : Object.keys(labels));
const dialogTitle = computed(() => manualEntry.value ? '条件任务 · ' + manualEntry.value.action_label : selectedIds.value.length ? entries.value.find(e => e.id === selectedIds.value[0])?.action_label : '补充测量数据');
const localInput = () => { const d = new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19); };
const utcInput = value => new Date(value).toISOString().slice(0,19);
const displayTime = value => value ? new Date(`${value}Z`).toLocaleString('zh-CN', { hour12: false }) : '—';
watch(() => props.task.id, () => { tab.value = 'pending'; formOpen.value = false; error.value = ''; startedAt.value = localInput(); selectedDate.value = ''; }, { immediate: true });
let refreshTimer;
onMounted(() => { refreshTimer = window.setInterval(() => { if (!saving.value && props.task.state === 'in_progress' && !formOpen.value) emit('changed'); }, 60000); });
onUnmounted(() => window.clearInterval(refreshTimer));
function condition(e) { const r = e.rule; return r.condition === 'time' ? `第 ${e.day} 天 · ${e.date}` : `${labels[r.condition] || r.condition} ${r.operator || ''} ${r.condition_value ?? ''} ${units[r.condition] || ''}`; }
function openForm(entry) {
  error.value = ''; metrics.value = {}; note.value = ''; manualEntry.value = null;
  selectedIds.value = entry ? [entry.id] : []; actionConfirmed.value = false;
  measuredAt.value = entry?.day && entry.date !== execution.value.today ? `${entry.date}T${localInput().split('T')[1]}` : localInput(); formOpen.value = true;
}
watch(formOpen, async open => { if (open) { await nextTick(); dialog.value?.querySelector('input, textarea, button')?.focus(); } });
function closeForm() { if (!saving.value) formOpen.value = false; }
function dialogKey(event) {
  if (event.key === 'Escape') { event.preventDefault(); closeForm(); }
  if (event.key === 'Tab') { const nodes = [...dialog.value.querySelectorAll('button:not(:disabled),input,textarea')]; const first = nodes[0], last = nodes[nodes.length-1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
}
function manual(e) { openForm(null); manualEntry.value = e; }
async function command(action, payload) {
  saving.value = true; error.value = '';
  try { await brewApi.taskAction(props.task.id, action, { version: props.task.version, ...payload }); formOpen.value = false; emit('changed'); }
  catch (cause) { error.value = cause.message || '提交失败。'; if (cause.status === 409) emit('changed'); }
  finally { saving.value = false; }
}
function submit() {
  if (formMetrics.value.filter(k => !!manualEntry.value || needed.value.includes(k)).some(k => metrics.value[k] === '' || metrics.value[k] === undefined)) { error.value = '请填写任务要求的测量值。'; return; }
  const values = Object.fromEntries(Object.entries(metrics.value).filter(([,v]) => v !== '' && v !== undefined).map(([k,v]) => [k,Number(v)]));
  if (manualEntry.value) { command('fermentation-condition', { entry_id: manualEntry.value.id, metrics: values, measured_at: utcInput(measuredAt.value), note: note.value, complete_action: true, confirmed: actionConfirmed.value }); return; }
  command('fermentation-record', { entry_ids: selectedIds.value, metrics: values, measured_at: utcInput(measuredAt.value), note: note.value });
}
</script>
<template>
<section class="fermentation-execution">
<h3 class="plan-detail-heading">{{ canOperate ? '发酵执行与记录' : '发酵详情' }}</h3><div v-if="error" class="master-error" role="alert">{{ error }}</div>
<div v-if="!execution.started_at" class="plan-stock-message">
<template v-if="execution.legacy">历史已完成任务，尚无按天执行记录。</template>
<template v-else><div v-if="task.execution_blocked_reason" class="ferm-blocked" role="status"><strong>{{ task.execution_blocked_reason }}</strong><p>请先在上方完成糖化执行节点。完成后刷新批次，即可确认进罐并开始发酵。</p></div><template v-else>确认实际进罐后开始计时；第 1 天为开始当天，每天不限定时刻。已有进罐记录时采用该记录时间。
<form v-if="canOperate && ['pending','claimed','in_progress'].includes(task.state)" class="ferm-start" @submit.prevent="command('start', { confirmed: true, started_at: utcInput(startedAt) })"><label><span>实际发酵开始时间</span><input v-model="startedAt" type="datetime-local" step="1" required></label><button class="btn btn-sm btn-primary" :disabled="saving || !!task.execution_blocked_reason">{{ task.state === 'in_progress' ? '确认开始时间并建立日程' : '确认进罐并开始发酵' }}</button><small>{{ task.execution_blocked_reason }}</small></form>
</template></template></div>
<template v-else>
<div class="plan-stock-message">开始于 {{ displayTime(execution.started_at) }} · 发酵第 {{ execution.day }} 天 · 计划 {{ execution.target_days }} 天 · 负责人 {{ task.assignee?.name }}</div>
<p v-if="execution.completion" class="rw-hint">{{ execution.completion.by }} 于 {{ displayTime(execution.completion.at) }} {{ execution.completion.early ? '提前结束发酵' : '确认完成发酵' }}；结束时完成 {{ execution.completion.completed_count }}/{{ execution.completion.total_count }} 项<span v-if="execution.completion.early">，其余 {{ execution.completion.remaining_entry_ids.length }} 项保留为未完成记录。</span></p>
<div class="ferm-tabs"><button v-for="[key,label] in [['pending', canOperate ? '今日待办' : '当日记录'],['calendar','按日查看'],['history','历史记录'],['trends','数据趋势']]" :key="key" class="btn btn-sm" :class="tab === key ? 'btn-primary' : 'btn-outline'" @click="tab = key">{{ label }}<span v-if="key === 'pending' && canOperate">（{{ todo.length }}）</span></button><button v-if="active" class="btn btn-sm btn-outline" @click="openForm(null)">补充测量数据</button></div>
<button v-if="active" class="btn btn-sm btn-outline" :disabled="saving" @click="command('fermentation-test-next-day', {})">测试：进入下一发酵日</button>
<div v-if="tab === 'calendar'" class="ferm-calendar"><button v-for="day in calendar" :key="day.date" :class="{ active: selectedDate === day.date, overdue: day.overdue }" @click="selectedDate = day.date"><strong>{{ day.date.slice(5) }}</strong><small>完成进度 {{ day.done }}/{{ day.total }}</small><small>{{ day.status }}</small></button></div>
<template v-if="['pending','calendar'].includes(tab)">
<p v-if="!visible.length" class="rw-hint">{{ tab === 'calendar' ? '选择日期查看当天任务。' : (canOperate ? '今日没有待填写任务。' : '当日暂无记录。') }}</p>
<article v-for="entry in visible" :key="entry.id" class="ferm-entry"><div class="ferm-entry-main"><div class="ferm-entry-title"><strong>{{ entry.action_label }} {{ entry.rule.target || '' }}</strong><span v-if="entry.status === 'done' && entry.metric && completionRecord(entry)" class="ferm-value">{{ completionRecord(entry).metrics[entry.metric] }} {{ units[entry.metric] }}</span></div><small v-if="entry.status === 'done' && completionRecord(entry)"><time>{{ displayTime(completionRecord(entry).measured_at) }}</time></small><small v-else>{{ condition(entry) }} · {{ names[entry.status] }}</small></div><span v-if="entry.status === 'done'" class="ferm-done-badge">✓ {{ entry.metric ? '已填写' : '已完成' }}</span><button v-else-if="active && (['pending','overdue'].includes(entry.status) || (entry.day && entry.status === 'future'))" class="btn btn-xs btn-primary" :disabled="saving" @click="openForm(entry)">{{ entry.metric ? '填写数据' : '确认操作' }}</button></article>
<h4 v-if="waiting.length" class="ferm-condition-title">条件任务</h4><article v-for="entry in waiting" :key="entry.id" class="ferm-entry"><div class="ferm-entry-main"><strong>{{ entry.action_label }}</strong><small>{{ condition(entry) }}</small></div><button v-if="active" class="btn btn-xs btn-outline" :disabled="saving" @click="manual(entry)">填写数据</button></article>
<details class="ferm-upcoming"><summary>后续按天任务</summary><article v-for="entry in entries.filter(e => e.status === 'future')" :key="entry.id" class="ferm-entry"><div><strong>{{ entry.action_label }}</strong><small>{{ condition(entry) }}</small></div></article></details></template>
<div v-if="tab === 'history'"><p v-if="!records.length">暂无执行记录。</p><article v-for="record in records" :key="record.id" class="ferm-entry ferm-history-record"><div><strong>{{ displayTime(record.measured_at) }} · {{ record.by }} <em v-if="record.backfill">补录</em></strong><div class="ferm-history-values">{{ Object.entries(record.metrics).map(([k,v]) => `${labels[k]} ${v} ${units[k]}`).join(' · ') }}</div><small>{{ record.kind === 'condition' ? (record.complete_action ? '条件达成并完成任务' : '人工确认条件达成') : record.entry_ids.map(id => entries.find(e => e.id === id)?.action_label).filter(Boolean).join('、') || '补充测量' }} · {{ record.note }}</small><small>提交于 {{ displayTime(record.submitted_at) }}</small></div></article></div>
<FermentationTrends v-if="tab === 'trends'" :records="records" :labels="labels" :units="units" />
<Teleport to="body"><div v-if="formOpen" class="equipment-modal-mask ferm-dialog-mask" @click.self="closeForm"><section ref="dialog" class="equipment-modal ferm-dialog" role="dialog" aria-modal="true" aria-labelledby="ferm-dialog-title" @keydown="dialogKey"><header class="equipment-modal-header"><div><h3 id="ferm-dialog-title" class="modal-title">{{ dialogTitle }}</h3><p v-if="manualEntry" class="modal-subtitle">触发条件：{{ condition(manualEntry) }}</p><p v-else-if="selectedIds.length" class="modal-subtitle">{{ condition(entries.find(e => e.id === selectedIds[0])) }}</p></div><button type="button" class="equipment-close" :disabled="saving" aria-label="关闭填写窗口" @click="closeForm">×</button></header><form class="ferm-form" @submit.prevent="submit"><div v-if="error" class="master-error" role="alert">{{ error }}</div><label>实际测量 / 操作时间<input v-model="measuredAt" type="datetime-local" step="1" required></label><div class="ferm-inputs"><label v-for="key in formMetrics" :key="key">{{ labels[key] }}（{{ units[key] }}）<input v-model="metrics[key]" type="number" step="any" :required="!!manualEntry || needed.includes(key)" :min="key === 'temperature' ? undefined : 0" :max="key === 'attenuation' ? 100 : undefined"></label></div><label v-if="manualEntry && !manualEntry.metric" class="ferm-confirm"><input v-model="actionConfirmed" type="checkbox" required>已实际完成 {{ manualEntry.action_label }} {{ manualEntry.rule.target || '' }}</label><label>{{ manualEntry ? '判断依据及执行结果' : '操作结果 / 备注' }}<textarea v-model="note" :required="!!manualEntry || (!!selectedIds.length && !needed.length)" placeholder="填写实测结果、判断依据或操作参数"></textarea></label><footer class="ferm-dialog-actions"><button type="button" class="btn btn-sm btn-outline" :disabled="saving" @click="closeForm">取消</button><button class="btn btn-sm btn-primary" :disabled="saving">{{ saving ? '保存中…' : '提交记录' }}</button></footer></form></section></div></Teleport>

</template></section>
</template>
<style scoped>
.ferm-tabs,.ferm-start,.ferm-inputs{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:16px 0}.ferm-entry{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid #ffffff12}.ferm-entry small{display:block;color:#aaa;margin-top:6px}.ferm-calendar{display:grid;grid-template-columns:repeat(auto-fill,minmax(95px,1fr));gap:8px;margin:16px 0}.ferm-calendar button{background:transparent;color:inherit;border:1px solid #ffffff25;border-radius:8px;padding:12px;cursor:pointer}.ferm-calendar small{display:block;margin-top:8px}.ferm-calendar .active{border-color:#d4a747}.ferm-calendar .overdue{color:#e8a169}.ferm-form{padding:20px;background:#ffffff05;border:1px solid #d4a74755;border-radius:12px;margin:20px 0}.ferm-form label,.ferm-start label{display:block}.ferm-form input,.ferm-form textarea,.ferm-start input{display:block;max-width:100%;margin:8px 0}.ferm-form textarea{width:100%;min-height:70px}.ferm-chart{width:100%;max-height:300px;margin-top:16px}.ferm-upcoming,.ferm-finish{margin-top:20px}.ferm-finish p,.ferm-form p{color:#aaa;font-size:13px}.ferm-entry em{color:#d4a747;font-style:normal}
.ferm-start{display:grid;grid-template-columns:max-content max-content 1fr;align-items:center;gap:8px 16px}.ferm-start label{display:contents}.ferm-start label span{grid-column:1;grid-row:1}.ferm-start input{grid-column:1;grid-row:2;margin:0}.ferm-start button{grid-column:2;grid-row:2}.ferm-start>small{grid-column:3;grid-row:2}@media(max-width:650px){.ferm-start{grid-template-columns:minmax(0,1fr)}.ferm-start input{width:100%}.ferm-start button{grid-column:1;grid-row:3;justify-self:start}.ferm-start>small{grid-column:1;grid-row:4}}
.ferm-blocked strong{color:#d4a747}.ferm-blocked p{margin:8px 0 0}
.ferm-dialog-mask{z-index:2200}.ferm-dialog{width:min(560px,calc(100vw - 32px));max-height:85vh;overflow:auto}.ferm-dialog .ferm-form{margin:0;border:none;background:transparent;border-radius:0}.ferm-dialog .ferm-inputs{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));align-items:start}.ferm-dialog .ferm-form input{width:100%}.ferm-dialog .ferm-confirm{display:flex;align-items:center;gap:8px}.ferm-dialog .ferm-confirm input{width:auto;margin:0}.ferm-dialog-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:20px}.ferm-dialog .modal-title{margin:0}
.ferm-entry-main{min-width:0}.ferm-entry-title{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap}.ferm-value{font-size:16px;font-weight:600;color:#dfb75c}.ferm-done-badge{color:#9cc993;font-size:13px;white-space:nowrap}.ferm-condition-title{font-size:14px;color:#aaa;font-weight:500;margin:20px 0 0}.ferm-history-values{font-size:16px;color:#dfb75c;margin-top:8px}.ferm-history-record>div>strong{color:#eee}
.ferm-dialog .ferm-form input:not([type="checkbox"]),.ferm-dialog .ferm-form textarea{box-sizing:border-box;min-height:38px;padding:9px 10px;border:1px solid var(--border-default);border-radius:var(--radius-md,6px);background:var(--bg-input);color:var(--text-primary);font:inherit;outline:none;color-scheme:dark}.ferm-dialog .ferm-form input:not([type="checkbox"]):focus,.ferm-dialog .ferm-form textarea:focus{border-color:var(--accent-gold);box-shadow:0 0 0 3px rgba(212,168,83,.1)}.ferm-dialog .ferm-form textarea{resize:vertical}.ferm-dialog .ferm-form input::placeholder,.ferm-dialog .ferm-form textarea::placeholder{color:var(--text-muted)}
</style>
