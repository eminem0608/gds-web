<script setup>
import { ref, computed, watch } from 'vue';
import { brewApi } from '../api';
import FermentationExecution from './FermentationExecution.vue';
const props = defineProps({ planId: [String, Number], allowExecution: { type: Boolean, default: false }, focusTaskId: [String, Number], readOnly: { type: Boolean, default: false } });
const emit = defineEmits(['close', 'changed', 'open-task']);
const selectedTask = ref(null);
const fermentationExpanded = ref(false);
const commandConflicts = ref([]);
const conflicts = computed(() => commandConflicts.value.length ? commandConflicts.value : (plan.value?.resource_check?.ok === false ? plan.value.resource_check.conflicts || [] : []));
const detail = ref(null), loading = ref(false), saving = ref(false), error = ref(''), inventory = ref(null);
const stateNames = { draft: '草稿', checked: '已完成资源校验', stocking: '原料备货中', pending_approval: '待审批', approved: '已批准', dispatched: '已下发', in_progress: '执行中', done: '已完成', cancelled: '已取消', terminated: '已终止' };
const conditions = { time: "时间", gravity: "糖度", attenuation: "实际发酵度", diacetyl: "双乙酰", temperature: "温度", pressure: "压力" };
const actions = { measure_gravity: "测量糖度", measure_temperature: "测量温度", measure_pressure: "测量压力", measure_diacetyl: "测量双乙酰", seal: "封罐", dry_hop: "干投", cool_to: "降温至", dump_hops: "排出酒花", centrifuge: "离心", increase_pressure: "升压至", package: "出酒" };
const fermentationDesign = computed(() => detail.value?.plan?.recipe_snapshot?.design?.fermentation || {});
const taskNames = { mashing: '糖化执行', fermentation: '发酵执行', material_preparation: '备料' };
const taskStates = { pending: '待分配', claimed: '待执行', in_progress: '执行中', done: '已完成', returned: '已退回', cancelled: '已取消' };
const plan = computed(() => detail.value?.plan);
const materials = computed(() => {
  const snapshot = plan.value?.material_snapshot;
  return Array.isArray(snapshot) ? snapshot : (snapshot?.materials || []);
});
const fermentationTask = computed(() => detail.value?.tasks.find(task => task.task_type === 'fermentation'));
const showFinishFermentation = computed(() => fermentationExpanded.value && fermentationTask.value?.state === 'in_progress' && canOperate(fermentationTask.value) && executable.value);
const fermentationProgress = computed(() => { const entries = fermentationTask.value?.fermentation_execution?.entries || []; return { total: entries.length, done: entries.filter(e => e.status === 'done').length, daily: entries.filter(e => e.day && e.status !== 'done').length, conditions: entries.filter(e => !e.day && e.status !== 'done').length }; });
const executable = computed(() => ['dispatched', 'in_progress'].includes(plan.value?.state));
const flow = computed(() => {
  const tasks = detail.value?.tasks || [];
  const mash = tasks.find(task => task.task_type === 'mashing');
  const fermentation = tasks.find(task => task.task_type === 'fermentation');
  const stage = plan.value?.state === 'stocking' ? 0 : !executable.value && plan.value?.state !== 'done' ? 1 : mash?.state !== 'done' ? 2 : fermentation?.state !== 'done' ? 3 : 4;
  return ['原料备货', '下发任务', '糖化执行', '发酵执行', '生产完成'].map((name, index) => ({ name, state: index < stage ? 'done' : index === stage ? 'current' : '' }));
});
function date(value) { if (!value) return ''; const raw = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`; return new Date(raw).toLocaleString('zh-CN', { hour12: false }); }
async function load() {
  if (!props.planId) return;
  const id = props.planId; loading.value = true; error.value = '';
  try { const result = await brewApi.getPlanProgress(id); if (props.planId === id) detail.value = result; }
  catch (cause) { if (props.planId === id) error.value = cause.message; }
  finally { if (props.planId === id) loading.value = false; }
}
watch(() => props.planId, () => { detail.value = null; inventory.value = null; selectedTask.value = null; fermentationExpanded.value = false; commandConflicts.value = []; load(); }, { immediate: true });
async function action(name) {
  saving.value = true; error.value = ''; commandConflicts.value = [];
  try {
    await brewApi.productionPlanAction(props.planId, name, { version: plan.value.version });
    await load(); emit('changed');
  } catch (cause) { error.value = cause.message; commandConflicts.value = cause.details?.conflicts || []; }
  finally { saving.value = false; }
}
async function checkInventory() {
  saving.value = true; error.value = '';
  try { inventory.value = await brewApi.productionPlanAction(props.planId, 'check-inventory', {}); await load(); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
function canOperate(task) { return props.allowExecution && task.is_assignee && task.can_execute; }
function openTask(task) { if (!canOperate(task)) selectedTask.value = String(selectedTask.value?.id) === String(task.id) ? null : task; else emit('open-task', task); }
async function taskAction(task, name) {
  saving.value = true; error.value = '';
  try { await brewApi.taskAction(task.id, name, { version: task.version, comment: '', ...(task.task_type === 'fermentation' && name === 'submit' ? { confirmed: true } : {}) }); await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
</script>
<template>
  <div v-if="planId" class="equipment-modal-mask plan-detail-mask" @click.self="emit('close')">
    <section class="equipment-modal plan-detail-modal" role="dialog" aria-modal="true" aria-label="生产批次任务与流程">
      <header class="equipment-modal-header"><div><div class="modal-title">{{ plan?.batch?.name || plan?.name || '生产批次' }}</div><div v-if="plan" class="modal-subtitle">{{ plan.product.name }} · {{ plan.planned_volume_l }} L · {{ plan.tank.name }}</div></div><button class="equipment-close" type="button" aria-label="关闭" @click="emit('close')">×</button></header>
      <div class="equipment-modal-body plan-detail-body">
        <div v-if="loading && !detail" class="empty">正在加载批次…</div>
        <div v-if="error" class="master-error">{{ error }}</div>
        <template v-if="detail">
          <div class="plan-flow"><div v-for="(stage,index) in flow" :key="stage.name" :class="stage.state"><b>{{ stage.state === 'done' ? '✓' : index + 1 }}</b><span>{{ stage.name }}</span></div></div>
          <div class="plan-detail-status"><strong>{{ stateNames[plan.state] || plan.state }}</strong><span>{{ plan.equipment.name }} · {{ plan.factory.name }}</span></div>
          <div v-if="conflicts.length && ['draft','checked','pending_approval','approved'].includes(plan.state)" class="master-error" role="alert"><strong>生产安排存在冲突，请调整后重新下发</strong><div v-for="item in conflicts" :key="item.type + item.id">{{ item.name }} · {{ item.reason || '设备或罐体时间重叠' }}<span v-if="item.start_at"> · {{ date(item.start_at) }} 至 {{ date(item.end_at) }}</span></div></div>
          <p v-if="!readOnly && detail.can_manage && ['draft','checked','pending_approval','approved'].includes(plan.state)" class="rw-hint">备货完成后直接下发任务，系统会自动检查生产安排并预占原料。</p>
          <div v-if="!readOnly && detail.can_manage" class="plan-detail-actions">
            <button class="btn btn-sm btn-outline" :disabled="saving" @click="checkInventory">核对库存</button>
            <button v-if="['draft','checked'].includes(plan.state) && inventory && !inventory.ok" class="btn btn-sm btn-primary" :disabled="saving" @click="action('request-stock')">提交备货需求</button>
            <button v-if="plan.state === 'stocking'" class="btn btn-sm btn-primary" :disabled="saving" @click="action('complete-stock')">核对并完成备货</button>
            <button v-if="['draft','checked','pending_approval','approved'].includes(plan.state)" class="btn btn-sm btn-primary" :disabled="saving" @click="action('dispatch')">{{ saving ? '下发中…' : '下发生产任务' }}</button>
          </div>
          <section v-if="readOnly" class="plan-readonly-materials">
            <div class="plan-readonly-heading"><div><h3 class="plan-detail-heading">计划所需原料</h3><p>来源于生产计划快照，当前窗口仅供查看。</p></div><span>{{ materials.length }} 项</span></div>
            <div v-if="materials.length" class="plan-stock-table"><table><thead><tr><th>序号</th><th>原料</th><th>阶段</th><th>计划用量</th><th>说明</th></tr></thead><tbody><tr v-for="(material,index) in materials" :key="material.material_id || material.product_id || index"><td>{{ index + 1 }}</td><td><strong>{{ material.material_name || material.product_name || '-' }}</strong></td><td>{{ ({ mash: '糖化', boil: '煮沸', fermentation: '发酵', packaging: '包装' })[material.stage] || material.stage || '-' }}</td><td>{{ Number(material.quantity || 0).toFixed(3) }} {{ material.uom_name || material.uom || '' }}</td><td>{{ material.notes || '-' }}</td></tr></tbody></table></div>
            <div v-else class="empty">该计划暂未形成用料快照。</div>
          </section>
          <div v-if="plan.stocking_request?.name" class="plan-stock-message">备货需求 {{ plan.stocking_request.name }} · {{ plan.stocking_request.completed_at ? '已完成备货' : '等待采购入库' }}</div>
          <div v-if="inventory" class="plan-stock-table"><table><thead><tr><th>原料</th><th>需要</th><th>可供领用</th><th>缺口</th></tr></thead><tbody><tr v-for="row in inventory.materials" :key="row.product.id"><td>{{ row.product.name }}</td><td>{{ row.required.toFixed(1) }} {{ row.uom }}</td><td>{{ row.allocated.toFixed(1) }} {{ row.uom }}</td><td class="stock-shortage">{{ row.shortage.toFixed(1) }} {{ row.uom }}</td></tr></tbody></table></div>
          <section><h3 class="plan-detail-heading">本批次任务</h3><div class="plan-detail-task-list"><article v-for="task in detail.tasks" :key="task.id" class="plan-detail-task" :class="{ focused: String(task.id) === String(focusTaskId) }"><div><strong>{{ task.name }}</strong><small>{{ task.assignee?.name || '仓库人员' }} · {{ task.assignee && ['pending','claimed'].includes(task.state) ? '待执行' : taskStates[task.state] || task.state }}<span v-if="task.execution_blocked_reason && !['done','cancelled'].includes(task.state)"> · {{ task.execution_blocked_reason }}</span></small></div><div class="plan-detail-task-buttons"><button v-if="task.task_type === 'mashing'" class="btn btn-xs btn-outline" :disabled="canOperate(task) && !!task.execution_blocked_reason && task.state !== 'done'" :aria-expanded="!canOperate(task) && String(selectedTask?.id) === String(task.id)" @click="openTask(task)">{{ canOperate(task) ? '执行糖化任务' : String(selectedTask?.id) === String(task.id) ? '收起节点' : '查看节点' }}</button><button v-else-if="task.task_type === 'fermentation'" class="btn btn-xs btn-outline" :aria-expanded="fermentationExpanded" @click="fermentationExpanded = !fermentationExpanded">{{ fermentationExpanded ? '收起详情' : '查看详情' }}</button></div></article></div></section>
          <section v-if="selectedTask"><h3 class="plan-detail-heading">糖化执行节点</h3><ol class="plan-timeline"><li v-for="node in selectedTask.execution_checkpoints" :key="node.code"><span class="plan-timeline-dot"></span><div><strong>{{ node.title }} · {{ node.state === 'done' ? '已完成' : '待执行' }}</strong><small v-if="node.completed_at">{{ date(node.completed_at) }} · {{ node.completed_by }}</small></div></li></ol></section>
          <FermentationExecution v-if="fermentationExpanded" v-for="task in detail.tasks.filter(t => t.task_type === 'fermentation')" :key="task.id" :task="task" :can-operate="canOperate(task) && executable" @changed="load(); emit('changed')" />
          <details class="plan-secondary-section" v-if="fermentationExpanded"><summary><strong>发酵工艺要求</strong><span>目标 {{ fermentationDesign.target_temperature ?? '—' }} ℃ · {{ fermentationDesign.target_days ?? '—' }} 天</span></summary><div class="plan-secondary-content"><div class="plan-stock-message">目标发酵温度 {{ fermentationDesign.target_temperature ?? '—' }} ℃ · 目标天数 {{ fermentationDesign.target_days ?? '—' }} 天</div><div v-for="(rule,index) in fermentationDesign.steps || []" :key="index" class="plan-fermentation-rule"><strong>{{ index + 1 }}. {{ conditions[rule.condition] || rule.condition }} {{ rule.condition === 'time' ? (rule.schedule_type === 'daily' ? '每天' : rule.schedule_type === 'day' ? '第 ' + rule.day_value + ' 天' : '每隔 ' + rule.interval_days + ' 天') : (rule.operator || '') + ' ' + rule.condition_value }}</strong><span>{{ actions[rule.action] || rule.action }} {{ rule.target || '' }}</span></div><p v-if="fermentationDesign.notes" class="rw-hint">{{ fermentationDesign.notes }}</p></div></details>
          <details class="plan-secondary-section"><summary><strong>流程记录</strong><span>{{ detail.timeline.length }} 条记录</span></summary><div class="plan-secondary-content"><ol class="plan-timeline"><li v-for="(event,index) in detail.timeline" :key="index"><span class="plan-timeline-dot"></span><div><strong>{{ event.title }}</strong><small>{{ date(event.at) }} <span v-if="event.by"> · {{ event.by }}</span><span v-if="event.value !== undefined && event.value !== ''"> · {{ event.value }}</span></small></div></li></ol></div></details>
        </template>
      </div><footer class="equipment-modal-footer"><div v-if="showFinishFermentation" class="fermentation-completion-progress" role="status"><strong>已完成 {{ fermentationProgress.done }}/{{ fermentationProgress.total }} 项</strong><span v-if="!fermentationTask.fermentation_execution?.can_complete">剩余 {{ fermentationProgress.daily }} 项按天任务、{{ fermentationProgress.conditions }} 项条件任务</span><span v-else>全部任务已完成，可以确认结束</span></div><button class="btn btn-secondary" type="button" @click="emit('close')">关闭</button><button class="btn btn-outline" type="button" :disabled="loading || saving" @click="load">刷新进度</button><button v-if="showFinishFermentation" class="btn btn-primary" type="button" :disabled="loading || saving || !fermentationTask.fermentation_execution?.can_complete" :title="fermentationTask.fermentation_execution?.can_complete ? '确认本批次发酵结束' : '请先完成全部按天任务和条件任务'" @click="taskAction(fermentationTask, 'submit')">{{ saving ? '提交中…' : '确认完成发酵' }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.plan-secondary-section{margin-top:16px;border:1px solid #ffffff14;border-radius:12px;background:#ffffff02}
.plan-secondary-section summary{display:flex;align-items:center;gap:16px;padding:16px 20px;cursor:pointer;list-style:none}
.plan-secondary-section summary::-webkit-details-marker{display:none}
.plan-secondary-section summary strong{font-size:15px}
.plan-secondary-section summary span{color:var(--text-muted,#aaa);font-size:13px}
.plan-secondary-section summary::after{content:'展开 ⌄';margin-left:auto;white-space:nowrap;color:#d4a747;font-size:13px}
.plan-secondary-section[open] summary::after{content:'收起 ⌃'}
.plan-secondary-content{padding:0 20px 20px}
.plan-readonly-materials{margin-top:18px}
.plan-readonly-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:10px}
.plan-readonly-heading .plan-detail-heading{margin:0}
.plan-readonly-heading p{margin:5px 0 0;color:var(--text-muted,#aaa);font-size:13px}
.plan-readonly-heading>span{flex:none;color:var(--text-muted,#aaa);font-size:13px}
.plan-readonly-materials .plan-stock-table{margin-top:0}
.plan-readonly-materials td:first-child,.plan-readonly-materials th:first-child{width:62px;text-align:center}
:deep(.fermentation-execution){margin-top:24px;padding:20px;border:1px solid #d4a74745;border-radius:14px;background:#d4a74705}
:deep(.fermentation-execution>.plan-detail-heading){margin-top:0}
@media(max-width:650px){.plan-secondary-section summary{flex-wrap:wrap;gap:8px}.plan-secondary-section summary span{font-size:12px}.plan-readonly-heading{align-items:flex-start}:deep(.fermentation-execution){padding:14px}}
.fermentation-completion-progress{margin-right:auto;font-size:13px;line-height:1.5}.fermentation-completion-progress strong{display:block;color:#d4a747}.fermentation-completion-progress span{color:#aaa}@media(max-width:650px){.fermentation-completion-progress{width:100%}}
</style>
