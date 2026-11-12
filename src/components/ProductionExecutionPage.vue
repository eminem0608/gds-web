<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { brewApi } from '../api';
import ProductionPlanDetail from './ProductionPlanDetail.vue';
import MashExecution from './MashExecution.vue';
const props = defineProps({ stage: String });
const rows = ref([]), loading = ref(false), error = ref(''), keyword = ref(''), filter = ref('all');
const selectedPlan = ref(null), mashTask = ref(null);
let sequence = 0, refreshTimer;
const kind = computed(() => props.stage === 'mash' ? 'mashing' : 'fermentation');
const title = computed(() => props.stage === 'mash' ? '糖化执行' : '发酵执行');
const stages = { pending: '待执行', claimed: '待执行', in_progress: '执行中', done: '已完成', returned: '已退回', cancelled: '已取消' };
const stageRows = computed(() => rows.value.map(detail => ({ ...detail, task: detail.tasks.find(task => task.task_type === kind.value && task.state !== 'cancelled') })).filter(row => row.task));
const visibleRows = computed(() => stageRows.value.filter(row => {
  const done = row.task.state === 'done', closed = ['cancelled','terminated'].includes(row.plan.state);
  if (filter.value === 'active' && (done || closed)) return false;
  if (filter.value === 'done' && !done) return false;
  if (filter.value === 'mine' && !row.task.is_assignee) return false;
  return [row.plan.name,row.plan.batch?.name,row.plan.product?.name,row.plan.factory?.name,row.plan.tank?.name,row.task.assignee?.name].join(' ').toLowerCase().includes(keyword.value.toLowerCase());
}));
const stats = computed(() => ({ total: stageRows.value.length, pending: stageRows.value.filter(row => ['pending','claimed'].includes(row.task.state)).length, running: stageRows.value.filter(row => row.task.state === 'in_progress').length, done: stageRows.value.filter(row => row.task.state === 'done').length }));
function progress(row) {
  const entries = row.task.task_type === 'mashing' ? row.task.execution_checkpoints || [] : row.task.fermentation_execution?.entries || [];
  return { total: entries.length, done: entries.filter(entry => (entry.status || entry.state) === 'done').length };
}
function currentStep(row) {
  if (row.task.state === 'done') return row.task.fermentation_execution?.completion?.early ? '已提前结束，未完成项保留记录' : '本阶段已完成';
  if (row.task.execution_blocked_reason) return row.task.execution_blocked_reason;
  if (row.task.task_type === 'mashing') return (row.task.execution_checkpoints || []).find(node => node.state !== 'done')?.title || '等待确认完成糖化';
  const execution = row.task.fermentation_execution;
  if (!execution?.started_at) return '待确认进罐并开始发酵';
  const pending = (execution.entries || []).filter(e => ['pending','overdue'].includes(e.status)).length;
  const waiting = (execution.entries || []).filter(e => e.status === 'waiting').length;
  return `发酵第 ${execution.day} 天 / 计划 ${execution.target_days} 天 · 待填 ${pending} 项 · 等待条件 ${waiting} 项`;
}
function time(value) { if (!value) return '—'; return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toLocaleString('zh-CN',{hour12:false}); }
function latestMetrics(row) {
  const records = [...(row.task.fermentation_execution?.records || [])].sort((a,b) => a.measured_at.localeCompare(b.measured_at));
  const values = {}; for (const record of records) Object.assign(values, record.metrics);
  return [['gravity','糖度','°P'],['temperature','温度','℃'],['pressure','压力','bar'],['attenuation','实际发酵度','%']].filter(([key]) => values[key] !== undefined).map(([key,label,unit]) => `${label} ${values[key]} ${unit}`).join(' · ') || '暂无实测数据';
}
function canOperate(row) { return row.task.is_assignee && row.task.can_execute && !row.task.execution_blocked_reason && ['dispatched','in_progress'].includes(row.plan.state) && !['done','cancelled'].includes(row.task.state); }
function open(row) { if (kind.value === 'mashing') mashTask.value = row.task; else selectedPlan.value = row.plan.id; }
async function load() {
  const request = ++sequence; loading.value = true; error.value = '';
  try {
    let plans = [], page = 1;
    while (true) { const batch = await brewApi.listProductionPlans({page_size:100,page}); plans.push(...batch); if (batch.length < 100) break; page++; }
    plans = plans.filter(plan => ['dispatched','in_progress','done','terminated'].includes(plan.state));
    const details = [], failures = [];
    for (let index = 0; index < plans.length; index += 6) {
      const group = plans.slice(index,index+6);
      const results = await Promise.allSettled(group.map(plan => brewApi.getPlanProgress(plan.id)));
      results.forEach((result,i) => { if (result.status === 'fulfilled') details.push(result.value); else failures.push(`${group[i].name}：${result.reason?.message || '加载失败'}`); });
    }
    if (request !== sequence) return;
    rows.value = details.sort((a,b) => Number(b.plan.id) - Number(a.plan.id));
    if (mashTask.value) mashTask.value = details.flatMap(d => d.tasks).find(task => task.id === mashTask.value.id) || mashTask.value;
    error.value = failures.join('；');
  } catch (cause) { if (request === sequence) error.value = cause.message || '执行数据加载失败，请重试。'; }
  finally { if (request === sequence) loading.value = false; }
}
watch(() => props.stage, () => { filter.value = 'all'; keyword.value = ''; selectedPlan.value = null; mashTask.value = null; });
onMounted(() => { load(); refreshTimer = window.setInterval(() => { if (!loading.value && !mashTask.value && !selectedPlan.value) load(); },60000); });
onUnmounted(() => { sequence++; window.clearInterval(refreshTimer); });
</script>
<template>
  <div class="production-execution-page">
    <div class="execution-summary"><div><span>批次总数</span><strong>{{ stats.total }}</strong></div><div><span>待执行</span><strong>{{ stats.pending }}</strong></div><div><span>执行中</span><strong>{{ stats.running }}</strong></div><div><span>已完成</span><strong>{{ stats.done }}</strong></div></div>
    <section class="panel">
      <header class="panel-header execution-heading">
        <div class="execution-heading-title"><h2 class="panel-title">{{ title }}批次</h2><span>{{ visibleRows.length }} 批</span></div>
        <div class="execution-filters">
          <label class="execution-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input v-model.trim="keyword" placeholder="搜索批次、产品、负责人或罐号" aria-label="搜索执行批次" type="search"></label>
          <select v-model="filter" aria-label="筛选执行状态"><option value="active">未完成</option><option value="mine">我负责的</option><option value="done">已完成</option><option value="all">全部批次</option></select>
          <button type="button" class="btn btn-sm btn-secondary" :disabled="loading" @click="load">{{ loading ? '刷新中…' : '刷新' }}</button>
        </div>
      </header>
      <div v-if="error" class="master-error" role="alert">{{ error }}</div>
      <div v-if="loading && !rows.length" class="empty">正在加载执行记录…</div>
      <div v-else-if="!visibleRows.length" class="empty">{{ filter === 'active' && stageRows.length ? '当前没有未完成批次，可切换“已完成”查看执行记录。' : '暂无匹配批次，生产计划下发后会显示在这里。' }}</div>
      <div v-else class="execution-batch-list"><article v-for="row in visibleRows" :key="row.plan.id" class="execution-batch">
        <header><div><strong>{{ row.plan.batch?.name || row.plan.name }}</strong><h3>{{ row.plan.product?.name }}</h3></div><span class="tag" :class="row.task.state === 'done' ? 'tag-success' : 'tag-warning'">{{ ['cancelled','terminated'].includes(row.plan.state) ? '计划已终止' : stages[row.task.state] || row.task.state }}</span></header>
        <div class="execution-facts"><span>负责人：{{ row.task.assignee?.name || '待分配' }}</span><span>计划产量：{{ row.plan.planned_volume_l }} L</span><span>{{ row.plan.factory?.name }} · {{ stage === 'mash' ? row.plan.equipment?.name : row.plan.tank?.name }}</span><span>{{ row.plan.name }}</span></div>
        <div class="execution-progress"><span>完成 {{ progress(row).done }}/{{ progress(row).total }} 项</span><progress :value="progress(row).done" :max="progress(row).total || 1"></progress><span>{{ currentStep(row) }}</span></div>
        <p v-if="stage === 'fermentation'" class="execution-measurements">{{ latestMetrics(row) }}</p>
        <footer><span>{{ row.task.completed_at ? '完成于 ' + time(row.task.completed_at) : row.task.started_at ? '开始于 ' + time(row.task.started_at) : '计划开始 ' + time(row.plan.planned_start) }}</span><div><button class="btn btn-sm btn-outline" @click="selectedPlan = row.plan.id">批次详情</button><button class="btn btn-sm" :class="canOperate(row) ? 'btn-primary' : 'btn-outline'" @click="open(row)">{{ canOperate(row) ? stage === 'mash' ? '执行糖化' : '执行发酵' : '查看执行记录' }}</button></div></footer>
      </article></div>
    </section>
    <ProductionPlanDetail :plan-id="selectedPlan" :initial-stage="kind" :allow-execution="true" @close="selectedPlan = null" @changed="load" @open-task="selectedPlan = null; mashTask = $event" />
    <MashExecution v-if="mashTask" :task="mashTask" @close="mashTask = null" @changed="load" />
  </div>
</template>
<style scoped>
.execution-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}.execution-summary>div{padding:18px 22px;background:var(--bg-surface);border:1px solid var(--border-default);border-radius:12px}.execution-summary span{display:block;color:var(--text-muted);font-size:13px}.execution-summary strong{display:block;font-size:28px;margin-top:8px}.execution-heading{gap:16px;flex-wrap:wrap}.execution-heading-title{display:flex;align-items:center;gap:10px;flex-shrink:0}.execution-heading-title h2{margin:0}.execution-heading-title>span{color:var(--text-muted);font-size:12px;font-weight:400}.execution-filters{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:0}.execution-search{position:relative;display:flex;align-items:center;width:250px;min-width:0}.execution-search svg{position:absolute;left:10px;width:14px;height:14px;color:var(--text-muted);pointer-events:none}.execution-filters input,.execution-filters select,.execution-filters .btn{box-sizing:border-box;height:34px;min-height:34px;border-radius:7px;font-size:12px}.execution-filters input,.execution-filters select{padding:0 10px;border:1px solid var(--border-default);background:var(--bg-input);color:var(--text-primary)}.execution-filters input{width:100%;min-width:0;padding-left:31px}.execution-filters select{width:112px;flex-shrink:0}.execution-filters .btn{padding:0 12px;flex-shrink:0}.execution-filters input:focus-visible,.execution-filters select:focus-visible{outline:2px solid var(--accent-gold);outline-offset:2px}.execution-batch-list{display:grid;gap:16px;padding:20px 24px 24px}.execution-batch{padding:20px;border:1px solid var(--border-default);border-radius:12px;background:var(--bg-elevated)}.execution-batch header,.execution-batch footer{display:flex;justify-content:space-between;align-items:center;gap:16px}.execution-batch header strong{color:var(--accent-gold);font-size:13px}.execution-batch h3{margin:8px 0;font-size:18px}.execution-facts{display:flex;flex-wrap:wrap;gap:8px 24px;margin:12px 0;color:var(--text-secondary);font-size:13px}.execution-progress{display:flex;align-items:center;flex-wrap:wrap;gap:12px;font-size:13px}.execution-progress progress{width:120px;height:8px;accent-color:var(--accent-gold)}.execution-progress>span:last-child{color:var(--text-muted)}.execution-measurements{font-size:13px;color:var(--text-secondary)}.execution-batch footer{margin-top:16px;padding-top:16px;border-top:1px solid var(--border-subtle)}.execution-batch footer>span{color:var(--text-muted);font-size:12px}.execution-batch footer>div{display:flex;gap:10px}@media(max-width:650px){.execution-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.execution-heading{padding:16px}.execution-filters{width:100%;margin-left:0;flex-wrap:wrap}.execution-search{flex:1;min-width:150px}.execution-batch-list{padding:16px}.execution-batch footer{flex-wrap:wrap}.execution-batch{padding:16px}}
</style>
