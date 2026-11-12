<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { brewApi } from '../api';
import { locationLabel } from '../location-label';
import ProductionJourney from './ProductionJourney.vue';
import JourneyDetailDialog from './JourneyDetailDialog.vue';
import ProductionCloseActions from './ProductionCloseActions.vue';
import PackagingPlanEditor from './PackagingPlanEditor.vue';
import FinishedCodeBadge from './FinishedCodeBadge.vue';
import PackagingExecution from './PackagingExecution.vue';
import { emptyPackagingDraft, packagingPayload, localDateTime } from '../plan-packaging';
import FermentationExecution from './FermentationExecution.vue';
const props = defineProps({ planId: [String, Number], allowExecution: { type: Boolean, default: false }, focusTaskId: [String, Number], readOnly: { type: Boolean, default: false }, initialStage: String });
const emit = defineEmits(['close', 'changed', 'open-task']);
const selectedTask = ref(null);
const editingRawCustomer=ref(false),rawCustomer=ref(''),rawCustomerReference=ref('');
function editRawCustomer(){error.value='';rawCustomer.value=plan.value.packaging_plan?.customer_id||'';rawCustomerReference.value=plan.value.packaging_plan?.customer_reference||'';editingRawCustomer.value=true;}
function closeFollowup(){if(saving.value)return;editingPackaging.value=false;editingRawCustomer.value=false;error.value='';}
async function saveRawCustomer(){saving.value=true;error.value='';try{await brewApi.productionPlanAction(props.planId,'set-raw-customer',{version:plan.value.version,customer_id:rawCustomer.value||null,customer_reference:rawCustomerReference.value});editingRawCustomer.value=false;await load();emit('changed');}catch(e){error.value=e.message;}finally{saving.value=false;}}
const editingRawLocation = ref(false), rawTank = ref(''), rawLocationConfirmed = ref(false);
async function saveRawLocation() {
  if (!rawLocationConfirmed.value || saving.value) return;
  saving.value = true; error.value = '';
  try { await brewApi.productionPlanAction(props.planId, 'confirm-raw-location', {version:plan.value.version, tank_id:rawTank.value, confirmed:true}); editingRawLocation.value=false; await load(); emit('changed'); }
  catch(e) { error.value=e.message; } finally { saving.value=false; }
}
const editingPackaging = ref(false), packagingDraft = ref(emptyPackagingDraft());
const packagingTask = computed(() => { const tasks = detail.value?.tasks || []; const focused = props.allowExecution && props.focusTaskId ? tasks.find(task => String(task.id) === String(props.focusTaskId) && task.task_type === 'packaging') : null; return focused || tasks.slice().reverse().find(task => task.task_type === 'packaging' && task.state !== 'cancelled'); });
const historicalPackaging = computed(() => packagingTask.value?.plan?.packaging_is_current === false);
const packagingViewPlan = computed(() => ({ ...plan.value, packaging_plan: packagingTask.value?.plan?.packaging_plan || plan.value?.packaging_plan, packaging_owner: packagingTask.value?.assignee || plan.value?.packaging_owner }));
const packagingActual = ref({ actual_qty: '', loss_volume_l: 0, materials: {}, notes: '', confirmed: false });
const canEditPackaging = computed(() => !props.allowExecution && !props.readOnly && detail.value?.can_manage && plan.value?.packaging_plan?.status !== 'packaged' && ['draft','checked','stocking','pending_approval','approved','done'].includes(plan.value?.state) && (!packagingTask.value || (['pending', 'claimed'].includes(packagingTask.value.state) || packagingTask.value.state === 'done' && plan.value?.packaging_plan?.execution?.packaging_order_id && detail.value?.journey?.liquid?.on_hand > 0)));
function editPackaging() {
  error.value = '';
  const data = packagingTask.value?.state === 'done' ? null : plan.value.packaging_plan;
  packagingDraft.value = (data?.materials_only || data?.material_id || data?.packaging_id) ? { ...data, materials: (data.materials || []).map(line => ({ ...line })), owner_id: plan.value.packaging_owner?.id || '', planned_start: localDateTime(data.planned_start), planned_end: localDateTime(data.planned_end) } : emptyPackagingDraft();
  editingPackaging.value = true;
}
async function savePackaging() {
  saving.value = true; error.value = '';
  try { await brewApi.productionPlanAction(props.planId, 'set-packaging-plan', { version: plan.value.version, ...packagingPayload(packagingDraft.value) }); editingPackaging.value = false; await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
async function packagingAction(name, executionPayload = null) {
  if (historicalPackaging.value) return;
  saving.value = true; error.value = '';
  try { await brewApi.taskAction(packagingTask.value.id, name, { version: packagingTask.value.version, ...packagingActual.value, ...(plan.value.packaging_plan?.materials_only ? { actual_materials: plan.value.packaging_plan.materials.map(line => ({ material_id: line.material_id, quantity: Number(packagingActual.value.materials[line.material_id] ?? line.quantity) })) } : {}), ...(executionPayload || {}) }); await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
const issueDraft = ref({ source_location_id: '', production_location_id: '' });
const materialOnly = computed(() => props.initialStage === 'material_preparation');
const materialState = computed(() => detail.value?.material_flow?.state || 'waiting_issue');
const issueLocations = computed(() => (detail.value?.material_locations || []).filter(item => item.type === 'material_issue' && !detail.value.material_locations.some(child => String(child.parent_id) === String(item.id))));
const settleRecordId = ref('');
const settleAmounts = ref({});
const isPackagingExecution = computed(() => props.allowExecution && currentTask.value?.task_type === 'packaging');
const canExecutePackaging = computed(() => isPackagingExecution.value && !props.readOnly && !historicalPackaging.value && packagingTask.value?.is_assignee && plan.value?.packaging_plan?.status !== 'packaged');
const canIssueMaterials = computed(() => !props.readOnly && props.allowExecution && currentTask.value?.task_type === 'material_preparation' && executable.value && detail.value?.can_issue && preparationTask.value?.can_execute);
const preparationTask = computed(() => detail.value?.tasks.find(task => task.task_type === 'material_preparation' && !['done','cancelled'].includes(task.state)));
const fermentationExpanded = ref(false);
const commandConflicts = ref([]);
const completionDraft = ref({ actual_volume_l: '', loss_volume_l: '', disposition: '', destination: '', note: '', confirmed: false });
const readyToFinish = computed(() => executable.value && ['mashing', 'fermentation'].every(type => { const tasks = detail.value?.tasks.filter(task => task.task_type === type && task.state !== 'cancelled') || []; return tasks.length && tasks.every(task => task.state === 'done'); }));
const conflicts = computed(() => commandConflicts.value.length ? commandConflicts.value : (plan.value?.resource_check?.ok === false ? plan.value.resource_check.conflicts || [] : []));
const detail = ref(null), loading = ref(false), saving = ref(false), error = ref(''), inventory = ref(null);
const stateNames = { draft: '草稿', checked: '已完成资源校验', stocking: '原料备货中', pending_approval: '待审批', approved: '已批准', dispatched: '已下发', in_progress: '执行中', done: '已完成', cancelled: '已取消', terminated: '已终止' };
const conditions = { time: "时间", gravity: "糖度", attenuation: "实际发酵度", diacetyl: "双乙酰", temperature: "温度", pressure: "压力" };
const actions = { measure_gravity: "测量糖度", measure_temperature: "测量温度", measure_pressure: "测量压力", measure_diacetyl: "测量双乙酰", seal: "封罐", dry_hop: "干投", cool_to: "降温至", dump_hops: "排出酒花", centrifuge: "离心", increase_pressure: "升压至", package: "出酒" };
const fermentationDesign = computed(() => detail.value?.plan?.recipe_snapshot?.design?.fermentation || {});
const taskNames = { mashing: '糖化执行', fermentation: '发酵执行', material_preparation: '原料出库', packaging: '包装执行' };
const taskStates = { pending: '待分配', claimed: '待执行', in_progress: '执行中', done: '已完成', returned: '已退回', cancelled: '已取消' };
const plan = computed(() => detail.value?.plan);
const showJourney = computed(() => !props.allowExecution && !materialOnly.value && ['dispatched','in_progress','done','terminated','cancelled'].includes(plan.value?.state));
const isStocking = computed(() => !props.allowExecution && plan.value?.state === 'stocking');
const stockingInventory = computed(() => inventory.value || detail.value?.stocking_inventory);
const stockingRows = computed(() => stockingInventory.value?.materials || []);
const stockingReadyCount = computed(() => stockingRows.value.filter(row => Number(row.shortage) <= 0).length);
const autoDispatch = computed(() => plan.value?.stocking_request?.auto_dispatch || {});
const stockingReady = computed(() => !!stockingInventory.value && stockingInventory.value.ok && stockingRows.value.length > 0);
const stockingPercent = computed(() => stockingRows.value.length ? Math.round(stockingReadyCount.value / stockingRows.value.length * 100) : 0);
const currentTask = computed(() => {
  const tasks = detail.value?.tasks || [];
  if (props.focusTaskId) return tasks.find(task => String(task.id) === String(props.focusTaskId));
  if (props.initialStage) return tasks.find(task => task.task_type === props.initialStage && task.state !== 'cancelled');
  return tasks.find(task => task.is_assignee || task.task_type === 'material_preparation' && detail.value?.can_issue);
});
const visibleTasks = computed(() => props.allowExecution ? (currentTask.value ? [currentTask.value] : []) : detail.value?.tasks || []);
const materials = computed(() => {
  const snapshot = plan.value?.material_snapshot;
  return Array.isArray(snapshot) ? snapshot : (snapshot?.materials || []);
});
const fermentationTask = computed(() => detail.value?.tasks.find(task => task.task_type === 'fermentation'));
const showFinishFermentation = computed(() => !props.readOnly && fermentationTask.value?.state === 'in_progress' && detail.value?.tasks.some(task => task.task_type === 'mashing' && task.state === 'done') && executable.value && (props.allowExecution ? currentTask.value?.task_type === 'fermentation' && fermentationExpanded.value && canOperate(fermentationTask.value) : detail.value?.can_manage));
const fermentationProgress = computed(() => { const entries = fermentationTask.value?.fermentation_execution?.entries || []; return { total: entries.length, done: entries.filter(e => e.status === 'done').length, daily: entries.filter(e => e.day && e.status !== 'done').length, conditions: entries.filter(e => !e.day && e.status !== 'done').length }; });
const executable = computed(() => ['dispatched', 'in_progress'].includes(plan.value?.state));
const flow = computed(() => {
  const tasks = detail.value?.tasks || [];
  const mash = tasks.find(task => task.task_type === 'mashing');
  const fermentation = tasks.find(task => task.task_type === 'fermentation');
  const hasPackaging = !!(plan.value?.packaging_plan?.materials_only || plan.value?.packaging_plan?.material_id || plan.value?.packaging_plan?.packaging_id);
  const finalStage = hasPackaging ? 5 : 4;
  const stage = plan.value?.state === 'done' ? (hasPackaging && packagingTask.value?.state !== 'done' ? 4 : finalStage) : plan.value?.state === 'stocking' ? 0 : !executable.value ? 1 : mash?.state !== 'done' ? 2 : fermentation?.state !== 'done' ? 3 : 3;
  const labels = ['原料备货', '下发任务', '糖化执行', '发酵执行', ...(hasPackaging ? ['包装执行'] : []), '生产完成'];
  return labels.map((name, index) => ({ name, state: plan.value?.state === 'done' && stage === finalStage ? 'done' : index < stage ? 'done' : index === stage ? 'current' : '' }));
});
function date(value) { if (!value) return ''; const raw = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`; return new Date(raw).toLocaleString('zh-CN', { hour12: false }); }
function stockQuantity(value) { return Number(value).toLocaleString('zh-CN', { maximumSignificantDigits: 10 }); }
async function load() {
  if (!props.planId) return;
  const id = props.planId; loading.value = true; error.value = '';
  try { const result = await brewApi.getPlanProgress(id); if (props.planId === id) { const previousState = detail.value?.plan?.state; detail.value = result; if (!issueDraft.value.production_location_id && issueLocations.value.length === 1) issueDraft.value.production_location_id = issueLocations.value[0].id; if (previousState === 'stocking' && result.plan.state !== 'stocking') emit('changed'); if (result.stocking_inventory) inventory.value = result.stocking_inventory; if (props.allowExecution) { fermentationExpanded.value = currentTask.value?.task_type === 'fermentation'; if (currentTask.value?.task_type === 'mashing') selectedTask.value = currentTask.value; } } }
  catch (cause) { if (props.planId === id) error.value = cause.message; }
  finally { if (props.planId === id) loading.value = false; }
}
watch(() => props.planId, () => { detail.value = null; inventory.value = null; selectedTask.value = null; editingPackaging.value = false; editingRawCustomer.value = false; packagingActual.value = { actual_qty: '', loss_volume_l: 0, materials: {}, notes: '', confirmed: false }; issueDraft.value = { source_location_id: '', production_location_id: '' }; settleRecordId.value = ''; settleAmounts.value = {}; fermentationExpanded.value = props.initialStage === 'fermentation'; commandConflicts.value = []; completionDraft.value = { actual_volume_l: '', loss_volume_l: '', disposition: '', destination: '', note: '', confirmed: false }; load(); }, { immediate: true });
let stockingRefreshTimer;
watch(isStocking, active => {
  clearInterval(stockingRefreshTimer);
  if (active) stockingRefreshTimer = setInterval(() => {
    if (!document.hidden && !loading.value && !saving.value) load();
  }, 15000);
});
onUnmounted(() => clearInterval(stockingRefreshTimer));
async function prepareMaterials() {
  if (!preparationTask.value || !issueDraft.value.production_location_id) return;
  saving.value = true; error.value = '';
  try { await brewApi.taskAction(preparationTask.value.id, 'prepare-materials', { version: preparationTask.value.version, ...issueDraft.value }); await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
async function refreshPicking(record) {
  saving.value = true; error.value = '';
  try { await brewApi.materialRequisitionAction(record.id, 'recommend-lots', { version: record.version, auto_source_locations: true }); await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
async function undoIssue(record) {
  if (!window.confirm('确认已将本单全部原料收回？撤回后原料退回原库位，库管重新核对发料，生产暂不能确认实领。')) return;
  saving.value = true; error.value = '';
  try { await brewApi.materialRequisitionAction(record.id, 'undo-issue', { version: record.version }); await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
async function issueMaterials() {
  const task = preparationTask.value;
  if (!task || !window.confirm('确认已核对本批原料？系统将把原料从原料仓移入所选领料库，随后由糖化负责人确认实领。')) return;
  saving.value = true; error.value = '';
  try { await brewApi.taskAction(task.id, 'issue-materials', { version: task.version, ...issueDraft.value }); await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
function startSettlement(record) {
  settleRecordId.value = record.id;
  settleAmounts.value = Object.fromEntries(record.lines.flatMap(line => line.allocations.map(item => [item.id, { returned_qty: item.returned_qty || 0, loss_qty: 0 }])));
}
async function settleMaterials(record) {
  const allocations = record.lines.flatMap(line => line.allocations.map(item => ({ allocation_id: item.id, returned_qty: Number(settleAmounts.value[item.id]?.returned_qty), loss_qty: Number(settleAmounts.value[item.id]?.loss_qty), acknowledged_qty: item.acknowledged_qty, previous_returned: item.returned_qty })));
  if (allocations.some(item => !Number.isFinite(item.returned_qty) || !Number.isFinite(item.loss_qty) || item.returned_qty < item.previous_returned || item.loss_qty < 0 || item.returned_qty + item.loss_qty > item.acknowledged_qty + 1e-8)) { error.value = '请检查退料和损耗数量：合计不能超过实领数量，退料不能少于已退数量。'; return; }
  if (!window.confirm('确认登记本批物料去向？退料将移回原库位，其余按填写的损耗和实际耗用出库。')) return;
  saving.value = true; error.value = '';
  try { await brewApi.materialRequisitionAction(record.id, 'settle', { version: record.version, allocations }); settleRecordId.value = ''; await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
async function action(name) {
  saving.value = true; error.value = ''; commandConflicts.value = [];
  try {
    await brewApi.productionPlanAction(props.planId, name, { version: plan.value.version });
    await load(); emit('changed');
  } catch (cause) {
    error.value = cause.message; commandConflicts.value = cause.details?.conflicts || [];
    if (cause.code === 'INVENTORY_INSUFFICIENT' && cause.details?.materials) {
      inventory.value = cause.details;
      const shortages = cause.details.materials.filter(row => row.shortage > 0);
      error.value = `原料仍然不足：${shortages.map(row => `${row.product.name} 缺 ${stockQuantity(row.shortage)} ${row.uom}`).join('；')}。请先在“质检入库”中完成原料入库。`;
    }
  }
  finally { saving.value = false; }
}
async function completeBrewing() {
  saving.value = true; error.value = '';
  try { await brewApi.productionPlanAction(props.planId, 'complete-brewing', { version: plan.value.version, ...completionDraft.value }); await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
async function checkInventory() {
  saving.value = true; error.value = '';
  try { inventory.value = await brewApi.productionPlanAction(props.planId, 'check-inventory', {}); await load(); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
function canOperate(task) { return props.allowExecution && String(task.id) === String(currentTask.value?.id) && task.is_assignee && task.can_execute; }
function openTask(task) { if (!canOperate(task)) selectedTask.value = String(selectedTask.value?.id) === String(task.id) ? null : task; else emit('open-task', task); }
async function taskAction(task, name) {
  const finishing = task.task_type === 'fermentation' && name === 'submit';
  const remaining = finishing ? (task.fermentation_execution?.entries || []).filter(entry => entry.status !== 'done').length : 0;
  if (remaining && !window.confirm(`还有 ${remaining} 项任务未完成，确认提前结束发酵吗？未完成项会保留原始记录。`)) return;
  saving.value = true; error.value = '';
  try { await brewApi.taskAction(task.id, name, { version: task.version, comment: '', ...(task.task_type === 'fermentation' && name === 'submit' ? { confirmed: true, allow_incomplete: remaining > 0 } : {}) }); await load(); emit('changed'); }
  catch (cause) { error.value = cause.message; }
  finally { saving.value = false; }
}
</script>
<template>
  <div v-if="planId" class="equipment-modal-mask plan-detail-mask" @click.self="emit('close')">
    <section class="equipment-modal plan-detail-modal" role="dialog" aria-modal="true" :aria-label="materialOnly ? '生产领料详情' : '生产批次任务与流程'">
      <header class="equipment-modal-header"><div><div class="modal-title"><FinishedCodeBadge v-if="plan?.batch?.finished_product_code" :code="plan.batch.finished_product_code" /><template v-else>{{ plan?.batch?.name || plan?.name || '生产批次' }}</template></div><div v-if="plan" class="modal-subtitle">{{ plan.name }} · {{ plan.product.name }} · {{ plan.planned_volume_l }} L · {{ plan.tank.name }}</div></div><button class="equipment-close" type="button" aria-label="关闭" @click="emit('close')">×</button></header>
      <div class="equipment-modal-body plan-detail-body">
        <div v-if="loading && !detail" class="empty">正在加载批次…</div>
        <div v-if="error && !isPackagingExecution && !editingPackaging && !editingRawCustomer" class="master-error">{{ error }}</div>
        <section v-if="detail && showJourney && plan.state==='done' && !readOnly && detail.can_manage" class="raw-followup">
          <header><div><strong>原液后续安排</strong><small>{{ plan.packaging_plan?.customer_name || '尚未关联客户' }}</small></div><div><button v-if="detail.journey?.liquid?.tank_verified === false" class="btn btn-sm btn-outline" type="button" @click="rawTank=plan.tank.id;rawLocationConfirmed=false;editingRawLocation=true">核对原液位置</button><button class="btn btn-sm btn-outline" v-if="canEditPackaging&&!editingPackaging" type="button" @click="editPackaging">{{ packagingTask?.state === 'done' || !plan.packaging_owner ? '追加包装' : '修改包装安排' }}</button><button class="btn btn-sm btn-outline" type="button" @click="editRawCustomer">关联客户</button></div></header>
        </section>
        <ProductionJourney v-if="detail && showJourney" :detail="detail" />
        <template v-if="detail && !showJourney">
          <template v-if="!materialOnly">
          <div v-if="!allowExecution && !isStocking" class="plan-flow"><div v-for="(stage,index) in flow" :key="stage.name" :class="stage.state"><b>{{ stage.state === 'done' ? '✓' : index + 1 }}</b><span>{{ stage.name }}</span></div></div>
          <div v-if="!isStocking" class="plan-detail-status"><strong>{{ plan.packaging_plan?.status === 'packaged' ? '已包装' : plan.state === 'done' && (plan.packaging_plan?.materials_only || plan.packaging_plan?.material_id || plan.packaging_plan?.packaging_id) && packagingTask?.state !== 'done' ? '酿酒已结束 · ' + (packagingTask?.state === 'in_progress' ? '包装执行中' : '待包装') : stateNames[plan.state] || plan.state }}</strong><span>{{ plan.equipment.name }} · {{ plan.factory.name }}</span></div>
          <div v-if="!allowExecution && autoDispatch.state === 'dispatched' && plan.dispatched_at" class="plan-stock-message">原料已备齐 · {{ date(plan.dispatched_at) }} 自动下发生产任务</div>
          <div v-if="!allowExecution && conflicts.length && ['draft','checked','stocking','pending_approval','approved'].includes(plan.state)" class="master-error" role="alert"><strong>生产安排存在冲突，请调整后重新下发</strong><div v-for="item in conflicts" :key="item.type + item.id">{{ item.name }} · {{ item.reason || '设备或罐体时间重叠' }}<span v-if="item.start_at"> · {{ date(item.start_at) }} 至 {{ date(item.end_at) }}</span></div></div>
          <p v-if="!isStocking && !allowExecution && !readOnly && detail.can_manage && ['draft','checked','stocking','pending_approval','approved'].includes(plan.state)" class="rw-hint">核对库存通过后直接下发生产任务。库管办理原料出库，糖化负责人确认本批实际领料后开始生产，发酵负责人按任务执行发酵。</p>
          <div v-if="!isStocking && !allowExecution && !readOnly && detail.can_manage && ['draft','checked','stocking','pending_approval','approved'].includes(plan.state)" class="plan-detail-actions">
            <button class="btn btn-sm btn-outline" :disabled="saving" @click="checkInventory">核对库存</button>
            <button v-if="['draft','checked'].includes(plan.state) && inventory && !inventory.ok" class="btn btn-sm btn-primary" :disabled="saving" @click="action('request-stock')">提交备货需求</button>
            <button v-if="['draft','checked','stocking','pending_approval','approved'].includes(plan.state)" class="btn btn-sm btn-primary" :disabled="saving" @click="action('dispatch')">{{ saving ? '核对并下发中…' : '核对库存并下发生产任务' }}</button>
          </div>
          <section v-if="isStocking" class="stocking-workspace">
            <div class="stocking-heading"><div><span class="detail-eyebrow">原料备货</span><h3>{{ stockingReady ? (autoDispatch.state === 'blocked' ? '备货完成，等待下发' : '备货完成，正在自动下发') : '原料备货中' }}</h3><p>{{ stockingReady ? '原料已备齐，系统将自动核对排程并下发生产任务' : '原料完成质检入库并全部备齐后，系统自动下发生产任务' }}</p></div><button class="btn btn-sm btn-outline" type="button" :disabled="loading || saving" @click="load">{{ loading ? '更新中…' : '刷新备货状态' }}</button></div>
            <div class="stocking-progress" :class="{ready: stockingReady}"><div><strong>{{ stockingReadyCount }}<small> / {{ stockingRows.length }} 项原料已备齐</small></strong><span>{{ stockingPercent }}%</span></div><div class="stocking-progress-track" role="progressbar" aria-label="原料备齐进度" :aria-valuenow="stockingPercent" aria-valuemin="0" aria-valuemax="100"><i :style="{width: stockingPercent + '%'}"></i></div></div>
            <div class="stocking-facts"><span>生产厂区 <strong>{{ plan.factory?.name }}</strong></span><span v-if="plan.stocking_request?.submitted_at">申请时间 <strong>{{ date(plan.stocking_request.submitted_at) }}</strong></span></div>
            <div class="plan-stock-table stocking-materials"><table><thead><tr><th>原料</th><th>生产需要</th><th>合格可用</th><th>待补数量</th><th>备货状态</th></tr></thead><tbody><tr v-for="row in stockingRows" :key="row.product.id"><td><strong>{{ row.product.name }}</strong></td><td>{{ stockQuantity(row.required) }} {{ row.uom }}</td><td>{{ stockQuantity(row.allocated) }} {{ row.uom }}</td><td :class="{ 'stock-shortage': Number(row.shortage) > 0 }">{{ Number(row.shortage) > 0 ? stockQuantity(row.shortage) + ' ' + row.uom : '—' }}</td><td><span class="stocking-row-state" :class="{ready: Number(row.shortage) <= 0}">{{ Number(row.shortage) <= 0 ? '已备齐' : Number(row.allocated) > 0 ? '部分备齐' : '待补齐' }}</span></td></tr><tr v-if="!stockingRows.length"><td colspan="5">暂未获取到原料备货明细，请刷新状态</td></tr></tbody></table></div>
            <div v-if="stockingReady && autoDispatch.state === 'blocked'" class="stocking-dispatch-blocked" role="status"><strong>自动下发暂未通过</strong><p>{{ autoDispatch.reason }}</p><small>处理后系统会自动重试，无需手动下发。</small></div>
            <div class="stocking-footer"><p>{{ stockingReady ? '系统每分钟自动重试下发，任务下发后由负责人确认领料并开始生产。' : '未质检、质检不合格及已被其他计划预占的库存不计入合格可用数量。' }}</p><span class="stocking-auto-label">备齐后自动下发</span></div>
          </section>
          <section v-if="readOnly && !allowExecution && !isStocking" class="plan-readonly-materials">
            <div class="plan-readonly-heading"><div><h3 class="plan-detail-heading">计划所需原料</h3><p>来源于生产计划快照，当前窗口仅供查看。</p></div><span>{{ materials.length }} 项</span></div>
            <div v-if="materials.length" class="plan-stock-table"><table><thead><tr><th>序号</th><th>原料</th><th>阶段</th><th>计划用量</th><th>说明</th></tr></thead><tbody><tr v-for="(material,index) in materials" :key="material.material_id || material.product_id || index"><td>{{ index + 1 }}</td><td><strong>{{ material.material_name || material.product_name || '-' }}</strong></td><td>{{ ({ mash: '糖化', boil: '煮沸', fermentation: '发酵', packaging: '包装' })[material.stage] || material.stage || '-' }}</td><td>{{ Number(material.quantity || 0).toFixed(3) }} {{ material.uom_name || material.uom || '' }}</td><td>{{ material.notes || '-' }}</td></tr></tbody></table></div>
            <div v-else class="empty">该计划暂未形成用料快照。</div>
          </section>
          <PackagingExecution v-if="isPackagingExecution" :plan="packagingViewPlan" :task="packagingTask" :saving="saving" :read-only="readOnly || historicalPackaging" :options="detail.packaging_execution_options" :liquid="detail.journey?.liquid" @complete="packagingAction(packagingTask.state === 'done' ? 'packaging-register-output' : 'packaging-complete', $event)" />
          <section v-if="!allowExecution && !isStocking" class="plan-secondary-section packaging-summary">
            <div class="plan-readonly-heading"><div><span class="detail-eyebrow">包装安排</span><h3 class="plan-detail-heading">包装计划</h3></div><button v-if="canEditPackaging && !editingPackaging" class="btn btn-xs btn-outline" type="button" @click="editPackaging">{{ (plan.packaging_plan?.materials_only || plan.packaging_plan?.material_id || plan.packaging_plan?.packaging_id) ? '修改包装计划' : '制定包装计划' }}</button></div>
            <p v-if="plan.packaging_plan?.status === 'packaged'">已包装 · {{ date(plan.packaging_plan.confirmation?.confirmed_at) }} · 按用户确认登记</p>
            <template v-else-if="(plan.packaging_plan?.materials_only || plan.packaging_plan?.material_id || plan.packaging_plan?.packaging_id)">
              <div class="packaging-summary-facts">
                <div><span>包装执行人</span><strong>{{ plan.packaging_owner?.name || '待指定' }}</strong></div>
                <div><span>计划开始</span><strong>{{ date(plan.packaging_plan.planned_start) }}</strong></div>
                <div><span>计划结束</span><strong>{{ date(plan.packaging_plan.planned_end) }}</strong></div>
              </div>
              <div class="packaging-material-heading"><strong>材料清单</strong><span>{{ plan.packaging_plan.materials?.length || 0 }} 项材料</span></div>
              <p v-if="!plan.packaging_plan.materials_only" class="packaging-legacy-summary">{{ plan.packaging_plan.packaging_name }} · {{ plan.packaging_plan.planned_qty }} 个包装 · {{ plan.packaging_plan.planned_volume_l }} L</p>
              <p v-if="plan.packaging_plan.notes" class="packaging-note"><span>包装要求</span>{{ plan.packaging_plan.notes }}</p>
              <div v-if="plan.packaging_plan.materials?.length" class="plan-stock-table"><table><thead><tr><th>包装材料</th><th>计划用量</th></tr></thead><tbody><tr v-for="line in plan.packaging_plan.materials" :key="line.material_id"><td>{{ line.name }}</td><td>{{ stockQuantity(line.quantity) }} {{ line.unit }}</td></tr></tbody></table></div>
              <p v-if="packagingTask?.execution_blocked_reason" class="packaging-waiting"><span class="waiting-dot"></span>{{ packagingTask.execution_blocked_reason }}</p>
              <div v-if="!readOnly && allowExecution && packagingTask?.is_assignee && plan.state === 'done'">
                <button v-if="['pending', 'claimed'].includes(packagingTask.state)" class="btn btn-sm btn-primary" :disabled="saving" @click="packagingAction('packaging-start')">开始包装任务</button>
                <form v-if="packagingTask.state === 'in_progress'" @submit.prevent="packagingAction('packaging-complete')"><div class="plan-editor-grid"><template v-if="plan.packaging_plan.materials_only"><label v-for="line in plan.packaging_plan.materials" :key="line.material_id">{{ line.name }}实际用量（个）<input :value="packagingActual.materials[line.material_id] ?? line.quantity" type="number" min="0" step="1" required @input="packagingActual.materials[line.material_id] = $event.target.value"></label></template><template v-else><label>实际包装数量<input v-model="packagingActual.actual_qty" type="number" min="1" step="1" required></label><label>损耗酒液（L）<input v-model="packagingActual.loss_volume_l" type="number" min="0" step="any" required></label></template><label>执行备注<input v-model="packagingActual.notes"></label><label><input v-model="packagingActual.confirmed" type="checkbox" required> 已完成包装并核对实际数量</label></div><button class="btn btn-sm btn-primary" :disabled="saving || !packagingActual.confirmed" type="submit">完成包装任务</button></form>
              </div>
              <p v-if="plan.packaging_plan.execution && plan.packaging_plan.materials_only">包装已完成 · {{ plan.packaging_plan.execution.completed_by }} · {{ date(plan.packaging_plan.execution.completed_at) }}<span v-for="line in plan.packaging_plan.execution.materials" :key="line.material_id"> · {{ line.name }} {{ line.quantity }} 个</span></p><p v-else-if="plan.packaging_plan.execution">实际完成 {{ plan.packaging_plan.execution.actual_qty }} 个包装 · {{ plan.packaging_plan.execution.output_volume_l }} L · {{ plan.packaging_plan.execution.completed_by }} · {{ date(plan.packaging_plan.execution.completed_at) }}</p>
            </template>
            <p v-else class="rw-hint">尚未制定包装计划。</p>
          </section>
          </template>
          <section v-if="!isStocking && (executable || detail.material_requisitions?.length) && (!allowExecution || ['material_preparation','mashing'].includes(currentTask?.task_type))" class="material-flow-summary">
            <div><span class="detail-eyebrow">生产领料</span><h3>{{ ({waiting_issue:'待库管备料',recommended:'已生成拣料清单，待发料',issued:'已发料，待确认实领',acknowledged:'已确认实领',completed:'物料已结清'})[materialState] }}</h3><p>{{ materialState === 'issued' ? '请糖化负责人核对实物、批次和数量后确认实领' : materialState === 'acknowledged' ? '原料由本批占用，生产结束后登记退料、耗用与损耗' : materialState === 'completed' ? '退料已回到原库位，耗用与损耗已记账' : '按本厂区可用批次推荐，优先使用较早到期的原料' }}</p></div>
            <div class="material-flow-owner"><span>生产领料负责人</span><strong>{{ detail.material_flow?.owner?.name || '待指定' }}</strong></div>
            <ol><li v-for="(label,index) in ['核对拣料','发到领料库','确认实领','登记物料去向']" :key="label" :class="{done:index < ({waiting_issue:0,recommended:1,issued:2,acknowledged:3,completed:4})[materialState]}"><b>{{ index+1 }}</b>{{ label }}</li></ol>
          </section>
          <section v-if="!readOnly && allowExecution && currentTask?.task_type === 'material_preparation' && executable && detail.can_issue && preparationTask && preparationTask.can_execute" class="plan-secondary-section warehouse-task-panel">
            <h3 class="plan-detail-heading">核对拣料清单</h3>
            <p class="rw-hint">按各项原料的实际库存库位与可用批次发料；确认出库后，由糖化负责人确认实领。</p>
            <div v-if="!detail.material_requisitions?.length" class="plan-stock-table"><table><thead><tr><th>原料</th><th>计划用量</th></tr></thead><tbody><tr v-for="(material,index) in materials" :key="index"><td>{{ material.material_name }}</td><td>{{ stockQuantity(material.quantity) }} {{ material.uom_name }}</td></tr></tbody></table></div>
            <div v-if="!detail.material_requisitions?.length" class="plan-detail-actions">
              <label>领料库位 <select v-model="issueDraft.production_location_id"><option value="">请选择领料库位</option><option v-for="location in issueLocations" :key="location.id" :value="location.id">{{ locationLabel(location) }}</option></select></label><p v-if="!issueLocations.length" class="rw-hint">请先在仓库设置中创建领料库，并在库内新增领料库位。</p>
            </div>
          </section>
          <section v-if="detail.material_requisitions?.length && (!allowExecution || ['material_preparation','mashing'].includes(currentTask?.task_type))" class="material-records">
            <div class="material-records-heading"><h3 class="plan-detail-heading">领料批次明细</h3><span>{{ detail.material_requisitions.length }} 张领料单</span></div>
            <article v-for="record in detail.material_requisitions" :key="record.id" class="material-record">
              <header class="material-record-header"><div><strong>{{ record.name }}</strong><span class="material-record-state" :data-state="record.state">{{ ({ draft: '待拣料', recommended: '待发料', issued: '待确认实领', acknowledged: '待登记物料去向', completed: '已结清', overage_pending: '超领待审批' })[record.state] || record.state }}</span></div><span class="material-record-location">领料库位 <strong>{{ locationLabel(record.production_location) }}</strong></span></header>
              <div class="plan-stock-table"><table><thead><tr><th>原料 / 批次</th><th>原料库位</th><th>计划 / 本批发料</th><th>实领</th><th v-if="record.state === 'completed'">退料 / 耗用 / 损耗</th></tr></thead><tbody><template v-for="line in record.lines" :key="line.id"><tr v-for="allocation in line.allocations" :key="allocation.id"><td><strong>{{ line.product.name }}</strong><small>{{ allocation.lot.name }}</small></td><td>{{ locationLabel(allocation.location) }}</td><td>{{ stockQuantity(line.planned_qty) }} / {{ stockQuantity(allocation.issued_qty || allocation.recommended_qty) }} {{ line.uom.name }}</td><td>{{ ['acknowledged','completed'].includes(record.state) ? stockQuantity(allocation.acknowledged_qty) + ' ' + line.uom.name : '待确认' }}</td><td v-if="record.state === 'completed'">{{ stockQuantity(allocation.returned_qty) }} / {{ stockQuantity(allocation.consumed_qty) }} / {{ stockQuantity(allocation.loss_qty) }} {{ line.uom.name }}</td></tr></template></tbody></table></div>
              <div class="material-record-footer"><div class="material-record-dates"><span v-if="record.issued_at">发料 {{ date(record.issued_at) }}</span><span v-if="record.acknowledged_at">实领确认 {{ date(record.acknowledged_at) }}</span><span v-if="record.completed_at">结清 {{ date(record.completed_at) }}</span></div><div class="material-record-actions">
              <button v-if="canIssueMaterials && record.state === 'recommended'" class="btn btn-sm btn-outline" type="button" :disabled="saving" @click="refreshPicking(record)">重新推荐批次</button>
              <button v-if="!readOnly && allowExecution && detail.can_issue && currentTask?.task_type === 'material_preparation' && record.state === 'issued'" class="btn btn-sm btn-outline" type="button" :disabled="saving" @click="undoIssue(record)">发料有误，收回重发</button>
              <template v-if="!readOnly && detail.can_settle_materials && record.state === 'acknowledged'">
                <button v-if="settleRecordId !== record.id" type="button" class="btn btn-sm btn-outline" :disabled="saving" @click="startSettlement(record)">登记退料与耗用</button>
              </template>
              </div></div>
              <template v-if="!readOnly && detail.can_settle_materials && record.state === 'acknowledged' && settleRecordId === record.id">
                <form class="material-settlement" @submit.prevent="settleMaterials(record)">
                  <p class="rw-hint">生产结束后按批次填写退回和损耗数量，剩余数量自动计为实际耗用。退料将回到原库位。</p>
                  <div v-for="line in record.lines" :key="line.id"><div v-for="allocation in line.allocations" :key="allocation.id" class="material-settlement-row"><div><strong>{{ line.product.name }}</strong><small>批次 {{ allocation.lot.name }} · 实领 {{ stockQuantity(allocation.acknowledged_qty) }} {{ line.uom.name }} · 已退 {{ stockQuantity(allocation.returned_qty) }}</small></div><label>累计退料（{{ line.uom.name }}）<input v-model.number="settleAmounts[allocation.id].returned_qty" type="number" :min="allocation.returned_qty" :max="allocation.acknowledged_qty" step="any" required></label><label>损耗（{{ line.uom.name }}）<input v-model.number="settleAmounts[allocation.id].loss_qty" type="number" min="0" :max="allocation.acknowledged_qty" step="any" required></label><div>实际耗用 <strong>{{ stockQuantity(Math.max(0, allocation.acknowledged_qty - Number(settleAmounts[allocation.id].returned_qty || 0) - Number(settleAmounts[allocation.id].loss_qty || 0))) }} {{ line.uom.name }}</strong></div></div></div>
                  <div class="plan-detail-actions"><button type="button" class="btn btn-sm btn-outline" :disabled="saving" @click="settleRecordId = ''">取消</button><button type="submit" class="btn btn-sm btn-primary" :disabled="saving">{{ saving ? '登记中…' : '确认物料去向' }}</button></div>
                </form>
              </template>
            </article>
          </section>
          <template v-if="!materialOnly">
          <div v-if="!isStocking && !allowExecution && plan.stocking_request?.submitted_at && autoDispatch.state !== 'dispatched'" class="plan-stock-message">{{ plan.stocking_request.name ? '备货需求 ' + plan.stocking_request.name : '备货申请已同步至库存采购 · 生产缺口' }} · {{ plan.stocking_request.completed_at ? '已完成备货' : '等待采购备货入库' }}</div>
          <div v-if="!isStocking && !allowExecution && inventory && !autoDispatch.state" class="plan-stock-table"><table><thead><tr><th>原料</th><th>需要</th><th>可供领用</th><th>缺口</th></tr></thead><tbody><tr v-for="row in inventory.materials" :key="row.product.id"><td>{{ row.product.name }}</td><td>{{ stockQuantity(row.required) }} {{ row.uom }}</td><td>{{ stockQuantity(row.allocated) }} {{ row.uom }}</td><td class="stock-shortage">{{ stockQuantity(row.shortage) }} {{ row.uom }}</td></tr></tbody></table></div>
          <section v-if="!isStocking && (!allowExecution || !['material_preparation','packaging'].includes(currentTask?.task_type))" class="batch-tasks-section"><div class="batch-tasks-heading"><div><span class="detail-eyebrow">执行分工</span><h3 class="plan-detail-heading">{{ allowExecution ? '当前任务' : '本批次任务' }}</h3></div><span>{{ visibleTasks.filter(task => task.state === 'done').length }} / {{ visibleTasks.length }} 已完成</span></div><div class="plan-detail-task-list"><article v-for="task in visibleTasks" :key="task.id" class="plan-detail-task" :class="{ focused: String(task.id) === String(focusTaskId) }"><span class="task-stage-icon" :class="task.task_type">{{ ({ mashing: '糖', fermentation: '酵', material_preparation: '料', packaging: '装' })[task.task_type] || '任' }}</span><div class="task-card-content"><div class="task-card-title"><strong>{{ taskNames[task.task_type] || task.name }}</strong><span class="task-state-badge" :class="task.state">{{ task.assignee && ['pending','claimed'].includes(task.state) ? '待执行' : taskStates[task.state] || task.state }}</span></div><small>{{ task.assignee?.name || '仓库人员 · 待分配' }}</small><p v-if="task.execution_blocked_reason && !['done','cancelled'].includes(task.state)" class="task-blocked-note">{{ task.execution_blocked_reason }}</p></div><div class="plan-detail-task-buttons"><button v-if="task.task_type === 'mashing'" class="btn btn-xs btn-outline" :disabled="canOperate(task) && !!task.execution_blocked_reason && task.state !== 'done'" :aria-expanded="!canOperate(task) && String(selectedTask?.id) === String(task.id)" @click="openTask(task)">{{ canOperate(task) ? '执行糖化任务' : String(selectedTask?.id) === String(task.id) ? '收起节点' : '查看节点' }}</button><button v-else-if="task.task_type === 'fermentation'" class="btn btn-xs btn-outline" :aria-expanded="fermentationExpanded" @click="fermentationExpanded = !fermentationExpanded">{{ fermentationExpanded ? '收起详情' : '查看详情' }}</button></div></article></div></section>
          <section v-if="selectedTask"><h3 class="plan-detail-heading">糖化执行节点</h3><ol class="plan-timeline"><li v-for="node in selectedTask.execution_checkpoints" :key="node.code"><span class="plan-timeline-dot"></span><div><strong>{{ node.title }} · {{ node.state === 'done' ? '已完成' : '待执行' }}</strong><small v-if="node.completed_at">{{ date(node.completed_at) }} · {{ node.completed_by }}</small></div></li></ol></section>
          <FermentationExecution v-if="fermentationExpanded" v-for="task in visibleTasks.filter(t => t.task_type === 'fermentation')" :key="task.id" :task="task" :can-operate="canOperate(task) && executable" @changed="load(); emit('changed')" />
          <details class="plan-secondary-section" v-if="fermentationExpanded"><summary><strong>发酵工艺要求</strong><span>目标 {{ fermentationDesign.target_temperature ?? '—' }} ℃ · {{ fermentationDesign.target_days ?? '—' }} 天</span></summary><div class="plan-secondary-content"><div class="plan-stock-message">目标发酵温度 {{ fermentationDesign.target_temperature ?? '—' }} ℃ · 目标天数 {{ fermentationDesign.target_days ?? '—' }} 天</div><div v-for="(rule,index) in fermentationDesign.steps || []" :key="index" class="plan-fermentation-rule"><strong>{{ index + 1 }}. {{ conditions[rule.condition] || rule.condition }} {{ rule.condition === 'time' ? (rule.schedule_type === 'daily' ? '每天' : rule.schedule_type === 'day' ? '第 ' + rule.day_value + ' 天' : '每隔 ' + rule.interval_days + ' 天') : (rule.operator || '') + ' ' + rule.condition_value }}</strong><span>{{ actions[rule.action] || rule.action }} {{ rule.target || '' }}</span></div><p v-if="fermentationDesign.notes" class="rw-hint">{{ fermentationDesign.notes }}</p></div></details>
          <section v-if="!allowExecution && plan.brewing_completion?.confirmed_at && !plan.brewing_completion?.automatic" class="brewing-completion">
            <h3 class="plan-detail-heading">确认酿酒结束</h3>
            <p class="rw-hint">糖化、发酵负责人完成任务后，由生产总监核对并确认；系统管理员也可操作。包装和成品入库另行确认。</p>
            <div v-if="plan.brewing_completion?.confirmed_at">
              <strong>{{ plan.brewing_completion.confirmed_by }} · {{ date(plan.brewing_completion.confirmed_at) }}</strong>
              <p>实际产酒 {{ plan.brewing_completion.actual_volume_l }} L · 损耗 {{ plan.brewing_completion.loss_volume_l }} L</p>
              <p>{{ plan.brewing_completion.disposition === 'in_tank' ? '酒液仍在罐内，保留罐体占用' : '已出酒并排空，罐体待清洗' }} · {{ plan.brewing_completion.destination }}</p>
              <p v-if="plan.brewing_completion.note">{{ plan.brewing_completion.note }}</p>
            </div>
            <p v-else-if="!readyToFinish" class="rw-hint">等待糖化任务和发酵任务全部完成。</p>
            <p v-else-if="!detail.can_manage" role="status">糖化与发酵任务已完成，等待生产总监确认酿酒结束。</p>
            <form v-else @submit.prevent="completeBrewing">
              <div class="brewing-completion-fields">
                <label>实际产酒量（L）<input v-model.number="completionDraft.actual_volume_l" type="number" min="0.001" step="any" required></label>
                <label>损耗量（L）<input v-model.number="completionDraft.loss_volume_l" type="number" min="0" step="any" required></label>
                <label>酒液状态<select v-model="completionDraft.disposition" required><option value="">请选择</option><option value="in_tank">仍在罐内，待出酒 / 包装</option><option value="emptied">已出酒，罐体已排空</option></select></label>
                <label>酒液去向<input v-model.trim="completionDraft.destination" required placeholder="填写所在罐体或出酒接收去向"></label>
              </div>
              <label class="brewing-completion-note">备注<textarea v-model.trim="completionDraft.note" rows="2"></textarea></label>
              <p class="rw-hint">仍在罐内会保留占用；确认排空后释放罐体并标记待清洗。</p>
              <label class="brewing-completion-check"><input v-model="completionDraft.confirmed" type="checkbox" required>我已核对实际产酒量、损耗和酒液去向，确认本批次酿酒结束。</label>
              <button class="btn btn-primary" type="submit" :disabled="saving || loading || !completionDraft.confirmed">{{ saving ? '提交中…' : '确认酿酒结束' }}</button>
            </form>
          </section>
          <details v-if="!allowExecution" class="plan-secondary-section"><summary><strong>流程记录</strong><span>{{ detail.timeline.length }} 条记录</span></summary><div class="plan-secondary-content"><ol class="plan-timeline"><li v-for="(event,index) in detail.timeline" :key="index"><span class="plan-timeline-dot"></span><div><strong>{{ event.title }}</strong><small>{{ date(event.at) }} <span v-if="event.by"> · {{ event.by }}</span><span v-if="event.value !== undefined && event.value !== ''"> · {{ event.value }}</span></small></div></li></ol></div></details>
          </template>
        </template>
      </div><footer class="equipment-modal-footer" :style="isPackagingExecution && error ? {flexWrap: 'wrap'} : undefined"><div v-if="isPackagingExecution && error" class="master-error" role="alert" style="flex-basis:100%;margin:0 0 10px">{{ error }}</div><ProductionCloseActions v-if="!allowExecution" :record="plan" @changed="emit('changed');emit('close')" /><button v-if="canIssueMaterials && materialState !== 'recommended'" class="btn btn-primary warehouse-issue-submit" :disabled="saving || !issueDraft.production_location_id" @click="prepareMaterials">{{ saving ? '生成中…' : '生成拣料清单' }}</button><button v-if="canIssueMaterials && materialState === 'recommended'" class="btn btn-primary warehouse-issue-submit" :disabled="saving" @click="issueMaterials">{{ saving ? '办理中…' : '确认发到领料库' }}</button><div v-if="showFinishFermentation" class="fermentation-completion-progress" role="status"><strong>已完成 {{ fermentationProgress.done }}/{{ fermentationProgress.total }} 项</strong><span v-if="!fermentationTask.fermentation_execution?.can_complete">剩余 {{ fermentationProgress.daily }} 项按天任务、{{ fermentationProgress.conditions }} 项条件任务，可确认提前结束</span><span v-else>全部任务已完成，可以确认结束</span></div><button class="btn btn-secondary" type="button" @click="emit('close')">关闭</button><button class="btn btn-outline" type="button" :disabled="loading || saving" @click="load">刷新进度</button><button v-if="canExecutePackaging && ['pending','claimed'].includes(packagingTask.state)" class="btn btn-primary" :disabled="saving || plan.state !== 'done'" @click="packagingAction('packaging-start')">{{ saving ? '提交中…' : plan.state !== 'done' ? '等待发酵完成' : '开始包装' }}</button><button v-if="canExecutePackaging && (packagingTask.state === 'in_progress' || packagingTask.state === 'done' && !plan.packaging_plan?.execution?.packaging_order_id) && plan.state === 'done'" class="btn btn-primary" type="submit" :form="'packaging-execution-' + packagingTask.id" :disabled="saving">{{ saving ? '提交中…' : packagingTask.state === 'done' ? '补登记包装产出' : '提交包装结果，待放行' }}</button><button v-if="showFinishFermentation" class="btn btn-primary" type="button" :disabled="loading || saving || !fermentationTask.fermentation_execution?.started_at" :title="fermentationTask.fermentation_execution?.can_complete ? '确认本批次发酵结束' : '可确认提前结束发酵，未完成项会保留记录'" @click="taskAction(fermentationTask, 'submit')">{{ saving ? '提交中…' : allowExecution ? '确认完成发酵' : '确认酿造结束' }}</button></footer>
    </section>
  </div>
  <JourneyDetailDialog v-if="editingPackaging && canEditPackaging" :title="plan.packaging_owner ? '修改包装安排' : '追加包装'" :subtitle="(plan.batch?.name || plan.name)+' · '+plan.product.name" @close="closeFollowup">
    <form :id="'followup-packaging-'+planId" class="followup-packaging-form" @submit.prevent="savePackaging">
      <div v-if="error" class="master-error" role="alert">{{ error }}</div>
      <PackagingPlanEditor v-model="packagingDraft" :product-id="plan.product.id" :factory-id="plan.factory.id" :demand="plan.packaging_requirement" :brewing-end="localDateTime(plan.state==='done'?(plan.brewing_completion?.confirmed_at||plan.brewing_completion?.completed_at||plan.planned_end):plan.planned_end)" />
    </form>
    <template #footer><div class="followup-dialog-actions"><button type="button" class="btn btn-secondary" :disabled="saving" @click="closeFollowup">取消</button><button type="submit" :form="'followup-packaging-'+planId" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中…' : '保存包装安排' }}</button></div></template>
  </JourneyDetailDialog>
  <JourneyDetailDialog v-if="editingRawLocation && plan" title="核对原液位置" :subtitle="plan.batch?.finished_product_code" width="520px" @close="!saving && (editingRawLocation=false)">
    <form id="raw-location" class="plan-editor-grid" @submit.prevent="saveRawLocation"><p>本批剩余原液 <strong>{{ stockQuantity(detail.journey?.liquid?.on_hand) }} L</strong>。请现场确认实际存放罐位。</p><label>实际罐位<select v-model="rawTank" required><option value="">选择本厂罐位</option><option v-for="tank in detail.packaging_execution_options?.tanks || []" :key="tank.id" :value="tank.id">{{ tank.name }} · {{ stockQuantity(tank.capacity_l) }} L{{ tank.occupied ? ' · 已占用' : '' }}</option></select></label><label><input v-model="rawLocationConfirmed" type="checkbox" required>已现场核对本批酒液存放在所选罐内</label><p v-if="error" class="master-error">{{ error }}</p></form>
    <template #footer><button class="btn btn-secondary" :disabled="saving" @click="editingRawLocation=false">取消</button><button class="btn btn-primary" type="submit" form="raw-location" :disabled="saving || !rawLocationConfirmed">确认位置</button></template>
  </JourneyDetailDialog>
  <JourneyDetailDialog v-if="editingRawCustomer && plan" title="关联客户" :subtitle="(plan.batch?.name || plan.name)+' · '+plan.product.name" width="520px" @close="closeFollowup">
    <form :id="'followup-customer-'+planId" class="raw-customer-form" @submit.prevent="saveRawCustomer">
      <div v-if="error" class="master-error" role="alert">{{ error }}</div>
      <label>客户<select v-model="rawCustomer"><option value="">暂不关联客户</option><option v-for="c in detail.raw_customers" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
      <label>客户参考号（选填）<input v-model.trim="rawCustomerReference" maxlength="150" placeholder="订单号或客户备注"></label>
    </form>
    <template #footer><div class="followup-dialog-actions"><button type="button" class="btn btn-secondary" :disabled="saving" @click="closeFollowup">取消</button><button type="submit" :form="'followup-customer-'+planId" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中…' : '保存客户' }}</button></div></template>
  </JourneyDetailDialog>
</template>

<style scoped>
.plan-detail-body .material-flow-summary{margin:0;padding:16px 18px;gap:12px;border-color:var(--border-subtle);background:#d4a85304}
.plan-detail-body .material-flow-summary h3{font-size:17px;margin:4px 0 6px}
.plan-detail-body .material-flow-summary ol{padding-top:12px;gap:12px}
.plan-detail-body .material-flow-owner{font-size:12px}
.plan-detail-body .material-flow-summary .detail-eyebrow{font-size:10px;margin-bottom:4px}
.material-records{min-width:0}
.material-records-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px}
.material-records-heading .plan-detail-heading{margin:0;font-size:15px}
.material-records-heading>span{font-size:12px;color:var(--text-muted)}
.material-record{border:1px solid var(--border-subtle);border-radius:10px;overflow:hidden;background:var(--bg-card,#25231f)}
.material-record+.material-record{margin-top:14px}
.material-record-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border-subtle);background:#ffffff02}
.material-record-header>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.material-record-header>div>strong{font-size:13px;font-weight:600}
.material-record-state{font-size:11px;padding:4px 8px;border-radius:5px;color:var(--accent-gold);background:#d4a85312}
.material-record-state[data-state=completed]{color:#8fb687;background:#8fb68712}
.material-record-location{font-size:12px;color:var(--text-muted);overflow-wrap:anywhere}
.material-record-location strong{font-weight:500;color:var(--text-secondary);margin-left:8px}
.material-record .plan-stock-table{border:0;border-radius:0;margin:0}
.material-record .plan-stock-table th{padding:10px 16px;font-size:11px;background:#ffffff02}
.material-record .plan-stock-table td{padding:12px 16px;font-size:12px}
.material-record .plan-stock-table td:first-child{white-space:normal;min-width:180px;max-width:320px;overflow-wrap:anywhere}
.material-record .plan-stock-table td:nth-child(2),.material-record .plan-stock-table th:nth-child(2){text-align:left}
.material-record .plan-stock-table td strong{font-size:13px;color:var(--text-primary);font-weight:500}
.material-record-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid var(--border-subtle)}
.material-record-dates{display:flex;gap:6px 18px;flex-wrap:wrap;font-size:11px;color:var(--text-muted);line-height:1.7}
.material-record-actions{display:flex;gap:8px;flex-shrink:0}
.material-record .material-settlement{margin:0;padding:16px;border-top:1px solid var(--border-subtle)}
@media(max-width:700px){.material-record-header,.material-record-footer{align-items:flex-start;flex-direction:column}.material-record-location{line-height:1.6}.material-record-actions{flex-wrap:wrap}}
.material-flow-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:20px;margin:20px 0;border:1px solid #d4a85335;border-radius:12px;background:#d4a85306}.material-flow-summary h3{margin:6px 0;font-size:18px}.material-flow-summary p{font-size:12px;color:var(--text-muted);margin:0}.material-flow-owner{display:grid;align-content:center;gap:6px;text-align:right;font-size:13px}.material-flow-owner span{color:var(--text-muted)}.material-flow-summary ol{grid-column:1/-1;display:flex;padding:14px 0 0;margin:0;list-style:none;gap:20px;border-top:1px solid #ffffff10}.material-flow-summary li{display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:12px;flex:1}.material-flow-summary li b{display:grid;place-items:center;width:24px;height:24px;border:1px solid #ffffff20;border-radius:50%;font-size:11px}.material-flow-summary li.done{color:var(--accent-gold)}.material-flow-summary li.done b{background:#d4a85318;border-color:#d4a85350}.plan-stock-table td small{display:block;font-size:11px;color:var(--text-muted);margin-top:4px}@media(max-width:600px){.material-flow-summary{grid-template-columns:1fr}.material-flow-owner{text-align:left}.material-flow-summary ol{flex-wrap:wrap;gap:12px}.material-flow-summary li{flex-basis:40%}}

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
.brewing-completion{margin-top:24px;padding:20px;border:1px solid #d4a74745;border-radius:14px}.brewing-completion .plan-detail-heading{margin-top:0}.brewing-completion-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.brewing-completion-fields label,.brewing-completion-note{display:flex;flex-direction:column;gap:8px;font-size:13px}.brewing-completion-note{margin-top:16px}.brewing-completion-check{display:flex;align-items:center;gap:8px;margin:16px 0;font-size:13px}.brewing-completion-check input{width:auto}@media(max-width:650px){.brewing-completion-fields{grid-template-columns:1fr}}

.plan-detail-body{gap:22px}.plan-detail-status{padding:16px 20px;background:linear-gradient(110deg,#d4a8530b,transparent);border-radius:10px;align-items:center}.plan-detail-body>.rw-hint{margin:0;padding:0 2px;line-height:1.8;font-size:12px;color:var(--text-muted)}.plan-detail-actions{gap:10px}.plan-detail-actions .btn{min-height:36px}.packaging-summary{margin-top:0;padding:22px;background:linear-gradient(135deg,#ffffff03,transparent)}.packaging-summary>.plan-readonly-heading{align-items:center;margin-bottom:20px}.detail-eyebrow{display:block;color:var(--accent-gold);font-size:10px;letter-spacing:2px;margin-bottom:7px}.packaging-summary .plan-detail-heading,.batch-tasks-heading .plan-detail-heading{font-size:16px;margin:0}.packaging-summary-facts{display:grid;grid-template-columns: .8fr 1.2fr 1.2fr;gap:12px;margin-bottom:22px}.packaging-summary-facts>div{padding:14px 16px;border:1px solid var(--border-subtle);border-radius:8px;background:#ffffff02;min-width:0}.packaging-summary-facts span{display:block;font-size:11px;color:var(--text-muted);margin-bottom:8px}.packaging-summary-facts strong{font-size:12px;font-weight:500;color:var(--text-primary);line-height:1.6}.packaging-material-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:12px}.packaging-material-heading strong{font-weight:500}.packaging-material-heading span{color:var(--text-muted);font-size:11px}.packaging-summary .plan-stock-table td{padding:14px}.packaging-summary .plan-stock-table td:last-child{color:var(--accent-gold);font-weight:600}.packaging-waiting{display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:7px;margin:14px 0 0;background:#d4a85308;color:var(--text-muted);font-size:12px}.waiting-dot{height:6px;width:6px;border-radius:50%;background:var(--accent-gold);flex:none}.packaging-note{font-size:12px;color:var(--text-secondary);line-height:1.7}.packaging-note span{color:var(--text-muted);margin-right:12px}.packaging-legacy-summary{font-size:12px;color:var(--text-secondary)}.batch-tasks-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.batch-tasks-heading>span{font-size:11px;color:var(--text-muted)}.plan-detail-task-list{gap:10px}.plan-detail-task{padding:18px;gap:14px;border-radius:10px;transition:border-color .2s}.plan-detail-task:hover{border-color:#d4a85345}.task-stage-icon{display:grid;place-items:center;width:40px;height:40px;flex:none;background:#d4a85312;color:var(--accent-gold);border:1px solid #d4a85320;border-radius:10px;font-size:16px}.task-stage-icon.fermentation{color:#93b0a2;background:#93b0a210;border-color:#93b0a220}.task-stage-icon.material_preparation{color:#9baec4;background:#9baec410;border-color:#9baec420}.task-card-content{flex:1;min-width:0}.task-card-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.task-card-title strong{font-size:13px;font-weight:600}.task-state-badge{padding:3px 7px;background:#ffffff07;border-radius:4px;font-size:10px;color:var(--text-muted)}.task-state-badge.done{color:#8fb687;background:#8fb68712}.task-state-badge.in_progress{color:var(--accent-gold);background:#d4a85312}.task-blocked-note{font-size:11px;color:var(--text-muted);margin:6px 0 0;line-height:1.6}.plan-detail-task-buttons{flex:none}.plan-detail-task-buttons:empty{display:none}
@media(max-width:650px){.packaging-summary{padding:16px}.packaging-summary-facts{grid-template-columns:1fr 1fr;gap:8px}.packaging-summary-facts>div:first-child{grid-column:1/-1}.packaging-summary-facts>div{padding:12px}.plan-detail-task{padding:14px;align-items:flex-start;flex-wrap:wrap}.plan-detail-task-buttons{margin-left:54px}.plan-detail-status{align-items:flex-start}.packaging-summary>.plan-readonly-heading{gap:8px}.task-stage-icon{width:36px;height:36px}.plan-detail-body{gap:18px}}
.warehouse-task-panel{padding:20px;margin-top:0}.warehouse-task-panel>.rw-hint{font-size:12px;line-height:1.8;color:var(--text-muted);margin:12px 0 16px}.warehouse-task-panel .plan-detail-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:18px 0}.warehouse-task-panel label{display:grid;gap:8px;font-size:12px;color:var(--text-secondary)}.warehouse-task-panel select{width:100%;height:40px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:7px;color:var(--text-primary);padding:8px 12px}@media(max-width:650px){.warehouse-task-panel{padding:16px}.warehouse-task-panel .plan-detail-actions{grid-template-columns:1fr}}
.warehouse-issue-submit{order:10}.warehouse-task-panel .plan-detail-actions{grid-template-columns: minmax(0,1fr);max-width:420px}.warehouse-task-panel .plan-detail-heading{font-size:16px}@media(max-width:650px){.warehouse-issue-submit{width:100%}}
.material-settlement{display:grid;gap:12px;margin-top:14px;padding:16px;border:1px solid #d4a74745;border-radius:10px;background:#d4a74708}.material-settlement .rw-hint{margin:0}.material-settlement-row{display:grid;grid-template-columns:minmax(180px,2fr) repeat(2,minmax(110px,1fr)) minmax(110px,1fr);align-items:end;gap:12px;padding:12px 0;border-bottom:1px solid #ffffff12;font-size:12px}.material-settlement-row small{display:block;margin-top:6px;color:var(--text-muted);line-height:1.5}.material-settlement-row label{display:grid;gap:6px;color:var(--text-secondary)}.material-settlement-row input{box-sizing:border-box;width:100%;min-height:38px;padding:8px;border:1px solid var(--border-default);border-radius:7px;background:var(--bg-input);color:var(--text-primary)}.material-settlement-row>div:last-child strong{display:block;margin-top:6px;color:var(--accent-gold)}@media(max-width:650px){.material-settlement-row{grid-template-columns:repeat(2,minmax(0,1fr))}.material-settlement-row>div:first-child{grid-column:1/-1}}
.raw-followup{padding:16px 18px;border:1px solid var(--border-default);border-radius:9px}.raw-followup>header{display:flex;align-items:center;justify-content:space-between;gap:16px}.raw-followup header strong{font-size:14px}.raw-followup header small{display:block;margin-top:6px;color:var(--text-muted);font-size:11px}.raw-followup header>div:last-child{display:flex;gap:8px}.raw-customer-form{display:grid;gap:18px}.raw-customer-form label small{display:inline;color:var(--text-muted);font-weight:400}.followup-dialog-actions{display:flex;justify-content:flex-end;gap:8px}.raw-customer-form label{display:grid;gap:7px;font-size:11px;color:var(--text-muted)}.raw-customer-form input,.raw-customer-form select{box-sizing:border-box;width:100%;height:38px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border-default);border-radius:6px;padding:0 10px}.raw-followup>form{margin-top:16px}@media(max-width:650px){.raw-followup>header{align-items:start;flex-direction:column}.raw-customer-form{grid-template-columns:1fr}.raw-followup header>div:last-child{flex-wrap:wrap}}
</style>

<style scoped>
.stocking-workspace { border: 1px solid var(--border-default); border-radius: 10px; overflow: hidden; }
.stocking-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 22px; }
.stocking-heading h3 { margin: 0; font-size: 20px; color: var(--text-primary); }
.stocking-heading p { margin: 9px 0 0; font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.stocking-heading > .btn { flex-shrink: 0; }
.stocking-progress { padding: 0 22px 20px; color: var(--accent-gold); }
.stocking-progress > div:first-child { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.stocking-progress strong { font-size: 24px; }
.stocking-progress small { font-size: 12px; font-weight: 400; color: var(--text-secondary); }
.stocking-progress > div > span { font-size: 12px; }
.stocking-progress-track { height: 6px; background: #ffffff09; border-radius: 4px; overflow: hidden; }
.stocking-progress-track i { display: block; height: 100%; background: var(--accent-gold); transition: width .2s; }
.stocking-progress.ready { color: #8fb687; }
.stocking-progress.ready i { background: #8fb687; }
.stocking-facts { display: flex; flex-wrap: wrap; gap: 12px 30px; padding: 14px 22px; border-top: 1px solid var(--border-subtle); background: #ffffff02; color: var(--text-muted); font-size: 12px; }
.stocking-facts strong { margin-left: 8px; color: var(--text-secondary); font-weight: 400; }
.stocking-materials { margin: 0; border-radius: 0; border-left: 0; border-right: 0; }
.stocking-materials table { min-width: 650px; }
.stocking-materials th, .stocking-materials td { padding: 14px 18px; }
.stocking-row-state { display: inline-block; padding: 4px 8px; border-radius: 4px; color: var(--accent-gold); background: #d4a74712; font-size: 11px; white-space: nowrap; }
.stocking-row-state.ready { color: #8fb687; background: #8fb68712; }
.stocking-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 22px; }
.stocking-footer p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.8; }
.stocking-footer .btn { flex-shrink: 0; }
@media (max-width: 650px) { .stocking-heading, .stocking-footer { align-items: flex-start; flex-direction: column; padding: 16px; } .stocking-facts { padding: 12px 16px; } .stocking-progress { padding: 0 16px 16px; } }
</style>

<style scoped>
.stocking-dispatch-blocked { margin: 16px 22px 0; padding: 14px 16px; border: 1px solid #d4a74745; border-radius: 7px; background: #d4a74708; font-size: 12px; }
.stocking-dispatch-blocked strong { color: var(--accent-gold); }
.stocking-dispatch-blocked p { margin: 8px 0; color: var(--text-primary); line-height: 1.7; }
.stocking-dispatch-blocked small { color: var(--text-muted); }
.stocking-auto-label { flex-shrink: 0; color: var(--accent-gold); font-size: 12px; }
/* Give the warehouse picking form a distinct, restrained gold treatment. */
.warehouse-task-panel {
  border: 1px solid #dfb85bc4;
  background: #27241e;
  box-shadow: 0 0 0 1px #dfb85b22, 0 0 22px #d4a8531a, 0 8px 24px #00000024;
}
.warehouse-task-panel .plan-detail-heading { color: #ffda87; font-weight: 650; }
.warehouse-task-panel > .rw-hint { color: #c9bca4; }
.warehouse-task-panel .plan-stock-table { border: 1px solid #c8a45c70; background: #211f1b; }
.warehouse-task-panel .plan-stock-table th {
  background: #423722;
  color: #f6d38a;
  font-weight: 600;
  border-bottom-color: #ffffff18;
}
.warehouse-task-panel .plan-stock-table td { border-bottom-color: #ffffff10; }
.warehouse-task-panel .plan-stock-table td:first-child { color: #efe4ce; font-weight: 500; }
.warehouse-task-panel .plan-stock-table td:last-child {
  color: #ffda87;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.warehouse-task-panel .plan-stock-table tbody tr:hover { background: #d4a8530c; }
.warehouse-task-panel label { color: #e2c48c; }
.warehouse-task-panel select { border-color: #ffffff26; background: #201d16; color: #efe4ce; }
.warehouse-task-panel select:focus-visible { outline: 2px solid #edc879; outline-offset: 2px; }
</style>
