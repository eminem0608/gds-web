<script setup>
import { formatMoney } from "../formatters";
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { brewApi } from '../api';
import { filterWorkbenchProduct, fallbackProductGroups, filterWorkbenchBatch, groupWorkbenchBatches } from '../workbench-products';
import { locationLabel } from '../location-label';
import WaterAdjustmentTaskDrawer from './WaterAdjustmentTaskDrawer.vue';
import WaterAdjustmentSummary from './WaterAdjustmentSummary.vue';
import BusinessRecordDialog from './BusinessRecordDialog.vue';
import ConditionTaskDrawer from './ConditionTaskDrawer.vue';
import TaskPhaseBadge from './TaskPhaseBadge.vue';
import TaskBatchBadge from './TaskBatchBadge.vue';
import TaskMaterialCards from './TaskMaterialCards.vue';
import TaskOperationHighlights from './TaskOperationHighlights.vue';
import MaterialReceipt from './MaterialReceipt.vue';
import TaskProductionContext from './TaskProductionContext.vue';
import ProductionPlanDetail from './ProductionPlanDetail.vue';
import InventoryProcurementPage from './InventoryProcurementPage.vue';
const props = defineProps({ permissions: { type: Array, default: () => [] }, currentUser: { type: Object, default: () => ({}) }, roles: { type: Array, default: () => [] }, revision: Number });
const emit = defineEmits(['open-task', 'changed', 'toast']);
const data = ref(null), loading = ref(false), error = ref(''), tab = ref('today'), selectedDate = ref(''), month = ref('');
const selectedRecord = ref(null);
const advancingDay = ref(false), testTaskId = ref('');
const testFermentations = computed(() => todayScope(data.value?.test_fermentations));
const selectedTestTask = computed(() => testFermentations.value.find(t => t.id === testTaskId.value) || testFermentations.value[0]);
async function nextFermentationDay() {
  const task = selectedTestTask.value;
  if (!task || advancingDay.value || loading.value) return;
  advancingDay.value = true;
  try {
    await brewApi.taskAction(task.id, 'fermentation-test-next-day', {version: task.version});
    selectedDate.value='';month.value='';
    await load();
    emit('changed');emit('toast', '已进入下一发酵日');
  } catch (cause) { error.value = cause.message || '推进发酵日失败'; }
  finally { advancingDay.value = false; }
}

const skipTimer = ref(false);
const conditionTask = ref(null);
const waterTask = ref(null);
const todayBatch = ref('all'), historyBatch = ref('all'), todayBatchName = ref(''), historyBatchName = ref('');
const todayProduct = ref('all'), historyProduct = ref('all'), todayProductName = ref(''), historyProductName = ref('');
const selected = ref(null), selectedPlan = ref(null), operation = ref(null), saving = ref(false), formError = ref(''), value = ref(''), note = ref(''), actionConfirmed = ref(false), dialog = ref(null), trigger = ref(null);
const clock = ref(Date.now()), serverOffset = ref(0), visibleCount = ref(12);
let interval, refresh, requestSequence = 0;
const now = computed(() => clock.value + serverOffset.value);
const today = computed(() => data.value?.today || '');
const activeProduct = computed(() => tab.value === 'today' ? todayProduct.value : historyProduct.value);
const activeBatch = computed(() => tab.value === 'today' ? todayBatch.value : historyBatch.value);
const todayScope = items => filterWorkbenchBatch(filterWorkbenchProduct(items || [], todayProduct.value), todayBatch.value);
const historyScope = items => filterWorkbenchBatch(filterWorkbenchProduct(items || [], historyProduct.value), historyBatch.value);
const allItems = computed(() => todayScope(data.value?.items));
const available = computed(() => allItems.value.filter(i => !['blocked', 'condition'].includes(i.status)));
const blocked = computed(() => allItems.value.filter(i => i.status === 'blocked'));
const timers = computed(() => todayScope(data.value?.timers));
const tomorrow = computed(() => todayScope(data.value?.tomorrow));
const records = computed(() => historyScope(data.value?.records));
const productTabs = computed(() => {
  const todayView = tab.value === 'today';
  const entries = todayView ? data.value?.today_products : data.value?.history_products;
  const fallback = todayView ? [...(data.value?.items || []), ...(data.value?.timers || [])] : data.value?.records || [];
  const options = [...(entries || fallbackProductGroups(fallback))];
  const selected = activeProduct.value;
  if (selected !== 'all' && !options.some(p => p.id === selected)) options.push({ id: selected, name: todayView ? todayProductName.value : historyProductName.value, count: 0 });
  return options;
});
const totalProductCount = computed(() => tab.value === 'today' ? data.value?.pending_count || 0 : data.value?.records?.length || 0);
const activeCalendar = computed(() => historyBatch.value !== 'all' ? data.value?.batch_calendar?.[historyBatch.value] || {} : historyProduct.value === 'all' ? data.value?.calendar || {} : data.value?.product_calendar?.[historyProduct.value] || {});
function selectProduct(product) {
  if(tab.value === 'today'){todayProduct.value=product.id;todayProductName.value=product.name;todayBatch.value='all';}
  else {historyProduct.value=product.id;historyProductName.value=product.name;historyBatch.value='all';}
  visibleCount.value=12;
}
const batchTabs = computed(() => {
  const todayView = tab.value === 'today';
  const entries = todayView ? data.value?.today_batches : data.value?.history_batches;
  const source = todayView ? [...(data.value?.items || []), ...(data.value?.timers || []), ...(data.value?.tomorrow || [])] : data.value?.records || [];
  const options = entries ? entries.filter(b => activeProduct.value === 'all' || b.product_id === activeProduct.value) : groupWorkbenchBatches(filterWorkbenchProduct(source,activeProduct.value)).map(b=>({id:b.id,production:b.production,name:b.production?.batch_name || b.production?.plan_name || '其他事项',count:b.items.filter(i=>!i.id.endsWith(':monitor')).length}));
  const result = [...options];
  if(activeBatch.value !== 'all' && !result.some(b=>b.id===activeBatch.value))result.push({id:activeBatch.value,name:todayView?todayBatchName.value:historyBatchName.value,count:0});
  return result;
});
const completedBatches = computed(() => tab.value === 'history' ? batchTabs.value.filter(b => b.completed) : []);
const visibleBatchTabs = computed(() => tab.value === 'history' ? batchTabs.value.filter(b => !b.completed) : batchTabs.value);
const selectedCompletedBatch = computed(() => completedBatches.value.some(b => b.id === historyBatch.value) ? historyBatch.value : '');
function selectCompletedBatch(event) {
  const batch = completedBatches.value.find(b => b.id === event.target.value);
  if (batch) selectBatch(batch);
  else selectBatch({id:'all',name:'全部任务'});
}
function batchLabel(batch) {
  const product = batch.production?.product || productTabs.value.find(p => p.id === batch.product_id)?.name;
  return product && batch.id !== '__other' ? `${product} · ${batch.name}` : batch.name;
}
function selectBatch(batch) {
  if(tab.value==='today'){todayBatch.value=batch.id;todayBatchName.value=batch.name;}
  else {historyBatch.value=batch.id;historyBatchName.value=batch.name;}
  visibleCount.value=12;
}
const conditionGroups = computed(() => groupWorkbenchBatches(allItems.value.filter(i => i.status === 'condition')));
const todayGroups = computed(() => groupWorkbenchBatches([...available.value.slice(0,visibleCount.value),...timers.value,...blocked.value]));
const tomorrowGroups = computed(() => groupWorkbenchBatches(tomorrow.value));
const recordGroups = computed(() => groupWorkbenchBatches(records.value));
const dueDate = value => value ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value+'Z') : 0;
const time = value => value ? new Date(dueDate(value)).toLocaleTimeString('zh-CN', { timeZone: data.value?.timezone || 'Asia/Shanghai', hour:'2-digit',minute:'2-digit',hour12:false }) : '';
const dayLabel = value => value ? new Date(value+'T12:00:00').toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}) : '';
const monthLabel = computed(() => month.value ? month.value.split('-')[0]+'年'+Number(month.value.split('-')[1])+'月' : '');
const days = computed(() => {
  if (!month.value) return [];
  const [year, m] = month.value.split('-').map(Number), first = new Date(year,m-1,1), offset=(first.getDay()+6)%7, count=new Date(year,m,0).getDate();
  return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{
    const d = new Date(year,m-1,1-offset+i), key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    return { key, day:d.getDate(), other:d.getMonth()!==m-1, count:activeCalendar.value[key] || 0, future:key>today.value };
  });
});
function countdown(item) {
  const seconds=Math.max(0,Math.ceil((dueDate(item.due_at)-now.value)/1000));
  const hours=Math.floor(seconds/3600), mins=Math.floor(seconds%3600/60), secs=seconds%60;
  return hours ? `${hours}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}` : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}
function when(item) {
  if(item.is_parallel) return '并行准备 · 开始洗糟前完成';
  if(item.date && item.date<today.value) return item.date+' · 待补处理';
  if(item.due_at) return dueDate(item.due_at)<=now.value ? '已到操作时间' : time(item.due_at)+' 执行';
  if(item.kind==='fermentation') return '今天完成';
  return '待处理';
}
function quantity(item) {
  if (item.quantity == null) return '';
  if (item.unit === 'CNY') return formatMoney(item.quantity);
  return Number(item.quantity).toLocaleString('zh-CN', { maximumFractionDigits: 4 }) + ' ' + (item.unit || '');
}
async function load() {
  const seq=++requestSequence; loading.value=true; error.value='';
  try {
    const result=await brewApi.getMyWorkbench({ ...(selectedDate.value?{date:selectedDate.value}:{}), ...(month.value?{month:month.value}:{}) });
    if(seq!==requestSequence)return;
    window.dispatchEvent(new CustomEvent('brew-workbench-updated',{detail:{pending_count:result.pending_count}}));
    data.value=result;selectedDate.value=result.selected_date;month.value=result.month;serverOffset.value=dueDate(result.now)-Date.now();
  } catch(cause) { if(seq===requestSequence)error.value=cause.message||'任务加载失败，请重试。'; }
  finally { if(seq===requestSequence)loading.value=false; }
}
async function changeMonth(delta) {
  if(loading.value)return;
  const [y,m]=month.value.split('-').map(Number), d=new Date(y,m-1+delta,1), key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  if(key>today.value.slice(0,7))return;
  month.value=key; selectedDate.value=key===today.value.slice(0,7)?today.value:key+'-01';await load();
}
async function backToday() { selectedDate.value=today.value;month.value=today.value.slice(0,7);await load(); }
async function selectDay(day) { if(day.other||day.future||loading.value)return;selectedDate.value=day.key;await load(); }
async function open(item,event) {
  skipTimer.value=false;trigger.value=event?.currentTarget||null;formError.value='';value.value=item.kind==='production'&&item.quantity!=null?item.quantity:'';note.value='';actionConfirmed.value=false;
  if(item.water_adjustment){waterTask.value=item;return;}
  if(item.kind==='fermentation_condition'){conditionTask.value=item;return;}
  if(item.kind==='inventory'){operation.value=item.operation;return;}
  if(item.kind==='plan'){selectedPlan.value=item;return;}
  if(item.kind==='legacy'||item.kind==='approval'){emit('open-task',item);return;}
  selected.value=item;
  await nextTick(); dialog.value?.focus();
}
async function openRecord(record,event) { trigger.value=event.currentTarget;selectedRecord.value=record;await nextTick();dialog.value?.focus(); }
const recordTime = value => value ? new Date(dueDate(value)).toLocaleString('zh-CN',{timeZone:data.value?.timezone || 'Asia/Shanghai',hour12:false}) : '未记录';
async function close() { if(saving.value)return;selected.value=null;selectedRecord.value=null; await nextTick();trigger.value?.focus(); }
async function changed() { operation.value=null; await load();emit('changed'); }
async function submit() {
  const item=selected.value;if(!item||saving.value)return;
  if(item.status==='timer'&&dueDate(item.due_at)>now.value&&!skipTimer.value)return;
  if(item.kind==='fermentation'&&!item.metric&&(!note.value.trim()||!actionConfirmed.value)){formError.value='请确认已实际操作，并填写本次实际参数和结果。';return;}
  saving.value=true;formError.value='';
  try {
    if(item.kind==='stock_action') await brewApi.inventoryDocumentAction(item.operation.kind,item.operation.id,item.document.version);
    else {
      const payload={version:item.version};
      if(skipTimer.value && item.action==='checkpoint') payload.skip_timer=true;
      if(item.action==='checkpoint'){payload.checkpoint_key=item.checkpoint_key;payload.value=item.input_mode==='number'?Number(value.value):item.quantity!=null?'':value.value;if(item.quantity!=null){payload.actual_quantity=Number(value.value);payload.comment=note.value;}}
      if(item.action==='start')payload.confirmed=actionConfirmed.value;
      if(item.kind==='fermentation'){
        payload.entry_ids=item.entry_id?[item.entry_id]:[];payload.metrics=item.metric?{[item.metric]:Number(value.value)}:{};payload.note=note.value;
      }
      if(item.action==='submit')payload.comment='操作人核对完成';
      await brewApi.taskAction(item.task_id,item.action,payload);
    }
    selected.value=null; await load();emit('changed');emit('toast','操作已记录');
  } catch(cause){formError.value=cause.message||'提交失败，输入已保留。';if(cause.status===409)await load();}
  finally{saving.value=false;}
}
function trap(event) {
  if(event.key==='Escape'){close();return;}
  if(event.key!=='Tab')return;
  const nodes=[...(dialog.value?.querySelectorAll('button,input,textarea,select')||[])].filter(n=>!n.disabled&&n.getClientRects().length);
  const first=nodes[0],last=nodes.at(-1);
  if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.value)){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
}
onMounted(()=>{load();interval=setInterval(()=>{
  clock.value=Date.now();
  if(!loading.value&&!selected.value&&!selectedRecord.value&&!operation.value&&!selectedPlan.value&&(data.value?.timers || []).some(t=>dueDate(t.due_at)<=now.value))load();
},1000);refresh=setInterval(()=>{if(!loading.value&&!selected.value&&!selectedRecord.value&&!operation.value&&!selectedPlan.value)load();},30000);});
onUnmounted(()=>{requestSequence++;clearInterval(interval);clearInterval(refresh);});
defineExpose({refresh:load});
</script>

<template>
  <div class="my-workbench">
    <header class="my-heading"><div><div class="my-title-line"><h1>{{ tab==='today'?'今日任务':'执行记录' }}</h1><div v-if="tab==='today' && testFermentations.length" class="my-next-day"><select v-if="testFermentations.length>1" v-model="testTaskId" aria-label="选择要推进的发酵批次"><option value="" disabled>选择批次</option><option v-for="task in testFermentations" :key="task.id" :value="task.id">{{ task.production.product }} · {{ task.production.batch_name || task.production.plan_name }}</option></select><button type="button" :disabled="loading || advancingDay || (testFermentations.length>1 && !testTaskId)" @click="nextFermentationDay">{{ advancingDay ? '切换中…' : '测试：下一天 →' }}</button></div></div><p>{{ dayLabel(today) }}<span v-if="tab==='today' && data"> · {{ available.length ? '还有 '+available.length+' 项待处理' : '当前暂无可执行事项' }}</span></p></div><div class="my-heading-actions"><button class="my-refresh" :disabled="loading" @click="load" aria-label="刷新任务">{{ loading?'刷新中…':'刷新' }}</button><nav aria-label="任务视图"><button :class="{active:tab==='today'}" @click="tab='today'">今日任务</button><button :class="{active:tab==='history'}" @click="tab='history'">执行记录</button></nav></div></header>
    <div v-if="data && batchTabs.length" class="my-batch-filter-bar"><div class="my-product-tabs" role="group" aria-label="按生产批次筛选任务">
      <button type="button" :class="{active:activeBatch==='all'}" :aria-pressed="activeBatch==='all'" @click="selectBatch({id:'all',name:'全部任务'})"><span>全部任务</span><b>{{ totalProductCount }}</b></button>
      <button v-for="batch in visibleBatchTabs" :key="batch.id" type="button" :class="{active:activeBatch===batch.id}" :aria-pressed="activeBatch===batch.id" :title="batchLabel(batch)" @click="selectBatch(batch)"><span>{{ batchLabel(batch) }}</span><b :class="{zero:!batch.count}">{{ batch.count }}</b></button>
    </div>
      <label v-if="tab==='history'" class="my-completed-filter"><span>已结束批次</span><select :value="selectedCompletedBatch" aria-label="选择历史已结束生产批次" @change="selectCompletedBatch"><option value="">选择历史批次（{{ completedBatches.length }}）</option><option v-for="batch in completedBatches" :key="batch.id" :value="batch.id">{{ batchLabel(batch) }}</option></select></label>
    </div>
    <div v-if="error" class="master-error" role="alert">{{ error }} <button @click="load">重试</button></div>
    <p v-if="loading&&!data" class="my-empty">正在加载任务…</p>
    <template v-if="data && tab==='today'">
      <section v-for="group in todayGroups" :key="group.id" class="my-batch-group" :aria-label="group.production?.batch_name || '任务分组'">
        <TaskBatchHeading :production="group.production" :count="group.items.filter(i=>!i.id.endsWith(':monitor')).length" />
        <template v-if="group.items.some(i=>i.status!=='timer'&&i.status!=='blocked')"><div class="my-section-label"><i></i>现在处理<span></span></div><article v-for="item in group.items.filter(i=>i.status!=='timer'&&i.status!=='blocked')" :key="item.id" class="my-card" :class="{due:item.due_at&&dueDate(item.due_at)<=now}"><TaskPhaseBadge :phase="item.task_type" /><TaskBatchBadge :production="item.production" :plan-id="item.plan_id" @open="selectedPlan={plan_id:$event}" /><div class="my-card-main"><small>{{ when(item) }}</small><h2>{{ item.title }} <b v-if="quantity(item)">{{ quantity(item) }}</b></h2><TaskProductionContext v-if="!group.production" :production="item.production" :subtitle="item.subtitle" /><p v-if="item.hint" class="my-card-hint">{{ item.hint }}</p></div><button class="my-action" :class="{primary:!!item.due_at}" @click="open(item,$event)">{{ item.button }} <span aria-hidden="true">→</span></button></article></template>
        <template v-if="group.items.some(i=>i.status==='timer')"><div class="my-section-label">计时中<span></span></div><article v-for="item in group.items.filter(i=>i.status==='timer')" :key="item.id" class="my-timer"><TaskPhaseBadge :phase="item.task_type" /><TaskBatchBadge :production="item.production" :plan-id="item.plan_id" @open="selectedPlan={plan_id:$event}" /><div><h2>{{ item.temperature!=null?'糖化保温 · 目标'+item.temperature+'℃':item.title }}</h2><TaskProductionContext v-if="!group.production" :production="item.production" :subtitle="item.subtitle" /></div><button @click="open(item,$event)" :aria-label="'查看计时：'+item.title"><strong>{{ countdown(item) }}</strong><small>剩余</small></button></article></template>
        <details v-if="group.items.some(i=>i.status==='blocked')" class="my-blocked"><summary>{{ group.items.filter(i=>i.status==='blocked').length }} 项等待前序处理</summary><article v-for="item in group.items.filter(i=>i.status==='blocked')" :key="item.id" class="my-card" :class="{'condition-ready':item.condition_ready}"><TaskPhaseBadge :phase="item.task_type" /><TaskBatchBadge :production="item.production" :plan-id="item.plan_id" @open="selectedPlan={plan_id:$event}" /><div class="my-card-main"><h2>{{ item.title }}</h2><TaskProductionContext v-if="!group.production" :production="item.production" :subtitle="item.subtitle" /><small>{{ item.hint }}</small></div><button class="my-action" @click="open(item,$event)">查看原因</button></article></details>
      </section>
      <section v-if="conditionGroups.length" class="my-condition-tasks"><div class="my-section-label"><i></i>条件任务<span></span></div><template v-for="group in conditionGroups" :key="group.id"><article v-for="item in group.items" :key="item.id" class="my-card" :class="{'condition-ready':item.condition_ready}"><TaskPhaseBadge :phase="item.task_type" /><TaskBatchBadge :production="item.production" :plan-id="item.plan_id" @open="selectedPlan={plan_id:$event}" /><div class="my-card-main"><small :class="{'condition-ready-label':item.condition_ready}">{{ item.condition_ready ? '条件已达成 · 待操作' : '等待工艺条件' }}</small><h2>{{ item.title }}</h2><p class="my-card-hint">{{ item.hint }}</p></div><button class="my-action" :class="{primary:item.condition_ready}" @click="open(item,$event)">{{ item.button }} <span aria-hidden="true">→</span></button></article></template></section>
      <button v-if="available.length>visibleCount" class="my-more" @click="visibleCount+=12">显示更多任务</button>
      <section v-if="!available.length" class="my-tomorrow"><header><h2>明日待办</h2><span>{{ dayLabel(data.today && new Date(new Date(data.today+'T12:00:00').getTime()+86400000).toLocaleDateString('sv-SE')) }}</span></header><section v-for="group in tomorrowGroups" :key="group.id" class="my-batch-group"><article v-for="item in group.items" :key="item.id" class="my-card" :class="{'condition-ready':item.condition_ready}"><TaskPhaseBadge :phase="item.task_type" /><TaskBatchBadge :production="item.production" :plan-id="item.plan_id" @open="selectedPlan={plan_id:$event}" /><div class="my-card-main"><small>{{ item.due_at?time(item.due_at):'明天完成' }}</small><h2>{{ item.title }} <b v-if="quantity(item)">{{ quantity(item) }}</b></h2><TaskProductionContext v-if="!group.production" :production="item.production" :subtitle="item.subtitle" /></div><span class="my-not-due">未到执行时间</span></article></section><p v-if="!tomorrow.length" class="my-muted">明天暂时没有已确定的任务安排</p></section>
    </template>
    <section v-if="data&&tab==='history'" class="my-history"><div class="my-calendar"><header><div><button aria-label="上个月" :disabled="loading" @click="changeMonth(-1)">‹</button><strong>{{ monthLabel }}</strong><button aria-label="下个月" :disabled="loading||month>=today.slice(0,7)" @click="changeMonth(1)">›</button></div><button class="my-today" :disabled="loading" @click="backToday">今天</button></header><div class="my-weekdays"><span v-for="day in ['一','二','三','四','五','六','日']" :key="day">{{ day }}</span></div><div class="my-days"><button v-for="day in days" :key="day.key" :class="{other:day.other,today:day.key===today,selected:day.key===selectedDate}" :disabled="day.other||day.future||loading" :aria-pressed="day.key===selectedDate" :aria-label="day.key+'，'+day.count+'条记录'" @click="selectDay(day)"><span>{{ day.day }}</span><small>{{ day.count?day.count+'条':'' }}</small></button></div></div><header class="my-record-heading"><h2>{{ dayLabel(selectedDate) }}</h2><span>{{ records.length }}条记录</span></header><section v-for="group in recordGroups" :key="group.id" class="my-batch-group my-record-batch"><button v-for="record in group.items" :key="record.id" class="my-record" type="button" :aria-label="'查看记录详情：'+record.title" @click="openRecord(record,$event)"><div><h2>{{ record.title }}</h2><p>{{ [group.production?'':record.subtitle,time(record.at),record.backfill?'补录':''].filter(Boolean).join(' · ') }}</p><p v-if="record.note">{{ record.note }}</p></div><span>已记录 <b aria-hidden="true">›</b></span></button></section><p v-if="!records.length" class="my-empty">当天没有执行记录</p></section>
  </div>
  <Teleport to="body"><div v-if="selected" class="my-drawer-mask" @click.self="close"><section ref="dialog" class="my-drawer" role="dialog" aria-modal="true" aria-labelledby="my-operation-title" tabindex="-1" @keydown="trap"><header><div><small>{{ selected.status==='timer'?'计时中':'本次操作' }}</small><h2 id="my-operation-title">{{ selected.title }}</h2><p>{{ selected.subtitle }}</p></div><button :disabled="saving" aria-label="关闭任务" @click="close">×</button></header><form @submit.prevent="submit"><div class="my-drawer-body"><p v-if="selected.plan_name" class="my-muted">{{ selected.plan_name }}<template v-if="selected.batch"> · {{ selected.batch.name }}</template></p><MaterialReceipt v-if="selected.kind==='receipt'" :receipt="selected.receipt" :plan="{name:selected.plan_name}" :batch="selected.batch" :can-operate="false" :saving="saving" /><div v-if="selected.status==='timer'" class="my-big-timer"><strong>{{ countdown(selected) }}</strong><span>{{ skipTimer?'已跳过倒计时，可以确认':dueDate(selected.due_at)>now?'到点后才可确认':'已到操作时间' }}<button v-if="!skipTimer && selected.action==='checkpoint' && dueDate(selected.due_at)>now" class="my-action" type="button" :disabled="saving" @click="skipTimer=true">跳过倒计时</button></span></div><TaskMaterialCards v-if="selected.materials?.length" :materials="selected.materials" /><TaskOperationHighlights :items="selected.highlights || []" /><div v-if="quantity(selected) && !selected.materials?.length && !selected.highlights?.length" class="my-target"><span>本次计划用量</span><strong>{{ quantity(selected) }}</strong></div><p v-if="selected.target && !selected.materials?.length" :class="['my-instruction', {'my-instruction-emphasis': !selected.highlights?.length}]">{{ selected.target }}</p><div v-if="selected.lots?.length" class="my-stock-lines"><p v-for="(lot,index) in selected.lots" :key="index"><span>本批原料批次</span><strong>{{ lot.name }}</strong></p></div><template v-if="selected.kind==='stock_action'"><p v-if="selected.document.reason">{{ selected.document.reason }}</p><p>库位：{{ locationLabel(selected.document.location || selected.document.source_location) }}<template v-if="selected.document.destination_location"> → {{ locationLabel(selected.document.destination_location) }}</template></p><div class="my-stock-lines"><p v-for="line in selected.document.lines" :key="line.id"><strong>{{ line.product.name }}</strong><span>{{ line.quantity }} {{ line.uom.name }}</span></p></div></template><label v-if="selected.input_mode==='number' || selected.metric || (selected.kind==='production' && selected.quantity!=null)">{{ selected.quantity!=null ? '实际数量' : selected.metric_label ? '实测'+selected.metric_label : '实测值' }}<div class="my-field"><input v-model="value" type="number" step="any" required :disabled="saving"><b>{{ selected.unit }}</b></div></label><label v-else-if="selected.input_mode==='text'">操作结果<textarea v-model.trim="value" required :disabled="saving"></textarea></label><label v-else-if="selected.input_mode==='choice'">检查结果<select v-model="value" required :disabled="saving"><option value="" disabled>请选择</option><option v-for="choice in selected.choices" :key="choice">{{ choice }}</option></select></label><label v-if="selected.kind==='production' && selected.quantity!=null && Number(value)!==Number(selected.quantity)">差异说明<textarea v-model.trim="note" required :disabled="saving"></textarea></label><template v-if="selected.kind==='fermentation'&&!selected.metric"><label>本次实际参数与执行结果<textarea v-model.trim="note" required :disabled="saving" placeholder="填写实际温度、投放量或本次操作结果"></textarea></label><label class="my-confirm"><input v-model="actionConfirmed" type="checkbox" required :disabled="saving">已实际完成本次操作</label></template><label v-if="selected.action==='start'" class="my-confirm"><input v-model="actionConfirmed" type="checkbox" required :disabled="saving">确认已实际进罐并开始发酵</label><p v-if="formError" class="master-error" role="alert">{{ formError }}</p></div><footer><button v-if="selected.status!=='blocked'" class="my-action primary" type="submit" :disabled="saving||(!skipTimer&&selected.due_at&&dueDate(selected.due_at)>now)">{{ saving?'正在提交…':selected.kind==='receipt'?'核对无误，确认实领':selected.kind==='stock_action'?'确认执行':selected.button }}</button><p v-if="selected.status!=='blocked'">核对现场实际情况后提交</p></footer></form></section></div></Teleport>
  <Teleport to="body"><div v-if="selectedRecord && !selectedRecord.business_record" class="my-drawer-mask" @click.self="close"><section ref="dialog" class="my-drawer" role="dialog" aria-modal="true" aria-labelledby="my-record-title" tabindex="-1" @keydown="trap"><header><div><small class="my-record-status">执行记录 · 已记录</small><h2 id="my-record-title">{{ selectedRecord.operation_title || selectedRecord.title }}</h2><p v-if="!selectedRecord.production">{{ selectedRecord.subtitle }}</p></div><button aria-label="关闭记录详情" @click="close">×</button></header><div class="my-drawer-body"><WaterAdjustmentSummary v-if="selectedRecord.water_adjustment" :snapshot="selectedRecord.water_adjustment" :actual="selectedRecord.water_actual" /><TaskProductionContext v-if="selectedRecord.production" :production="selectedRecord.production" /><dl class="my-record-meta"><div><dt>操作人</dt><dd>{{ selectedRecord.operator_name || '未记录' }}</dd></div><div><dt>操作时间</dt><dd>{{ recordTime(selectedRecord.at) }}</dd></div><div v-if="selectedRecord.backfill || (selectedRecord.submitted_at && Math.abs(dueDate(selectedRecord.submitted_at)-dueDate(selectedRecord.at))>60000)"><dt>{{ selectedRecord.backfill ? '补录提交时间' : '提交时间' }}</dt><dd>{{ recordTime(selectedRecord.submitted_at) }}</dd></div></dl><TaskOperationHighlights v-if="selectedRecord.highlights?.length" :items="selectedRecord.highlights" label="实际执行结果" /><div v-else class="my-record-result"><span>执行结果</span><strong>{{ selectedRecord.result || '已记录' }}</strong></div><TaskMaterialCards v-if="selectedRecord.materials?.length" :materials="selectedRecord.materials" :quantity-label="selectedRecord.materials_actual?'实际投入':'计划投入'" /><details v-if="selectedRecord.requirements?.length || selectedRecord.target" class="my-record-requirements"><summary>查看工艺要求</summary><TaskOperationHighlights :items="selectedRecord.requirements || []" label="工艺要求" /><p v-if="selectedRecord.target" class="my-instruction">{{ selectedRecord.target }}</p></details><section v-if="selectedRecord.note" class="my-record-note"><h3>操作说明</h3><p>{{ selectedRecord.note }}</p></section></div><footer><button class="my-action" type="button" @click="close">关闭详情</button></footer></section></div></Teleport>
  <WaterAdjustmentTaskDrawer v-if="waterTask" :item="waterTask" @close="waterTask=null" @changed="waterTask=null;load();emit('changed')" />
  <BusinessRecordDialog v-if="selectedRecord?.business_record" :record="selectedRecord" @close="close" />
  <ConditionTaskDrawer v-if="conditionTask" :item="conditionTask" @close="conditionTask=null" @changed="conditionTask=null;if($event?.advanced){selectedDate='';month=''}load();emit('changed')" />
  <ProductionPlanDetail v-if="selectedPlan" :plan-id="selectedPlan.plan_id" :focus-task-id="selectedPlan.task_id" :initial-stage="selectedPlan.initial_stage" :allow-execution="true" @close="selectedPlan=null" @changed="load" />
  <InventoryProcurementPage v-if="operation" task-only :task-operation="operation" :permissions="props.permissions" :current-user="props.currentUser" :roles="props.roles" @close="operation=null" @changed="changed" @toast="emit('toast',$event)" />
</template>

<style scoped>
.my-workbench{max-width:960px;margin:0 auto 30px;color:var(--text-primary,#eeeee5)}.my-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin:12px 0 32px}.my-heading h1{font-size:28px;font-weight:600;margin:0 0 10px}.my-heading p{margin:0;font-size:12px;color:var(--text-muted)}.my-heading-actions{display:flex;align-items:center;gap:16px}.my-heading nav{display:flex;gap:4px;padding:4px;border:1px solid var(--border-default,#363831);border-radius:10px;background:#20211c}.my-heading nav button{padding:9px 16px;border:0;border-radius:7px;background:transparent;color:var(--text-muted);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}.my-heading nav button.active{background:#38362a;color:#e0bc70}.my-refresh{border:0;background:transparent;color:var(--text-muted);font-size:12px;cursor:pointer}.my-section-label{display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:12px;margin:24px 0 12px}.my-section-label i{width:6px;height:6px;border-radius:50%;background:#e0bc70}.my-section-label>span{height:1px;background:var(--border-subtle,#363831);flex:1}.my-card{display:flex;align-items:center;gap:20px;padding:22px 24px;margin-bottom:12px;border:1px solid var(--border-default,#363831);border-radius:12px;background:#25251f}.my-card.due{border-color:#ad925268;background:#2a291f}.my-card-main{flex:1;min-width:0}.my-card h2,.my-record h2{margin:4px 0;font-size:16px;font-weight:550;line-height:1.6}.my-card h2>b{margin-left:10px;font-size:18px;color:#e0bc70;font-variant-numeric:tabular-nums}.my-card p,.my-record p{margin:5px 0 0;font-size:12px;color:var(--text-muted);overflow-wrap:anywhere}.my-card small{font-size:11px;color:#c5ad7b}.my-card p.my-card-hint{color:#b7a78d}.my-action{flex-shrink:0;border:1px solid #555247;border-radius:8px;background:transparent;color:var(--text-primary);padding:10px 16px;min-height:40px;cursor:pointer;font:inherit;font-size:12px;white-space:nowrap}.my-action.primary{background:#e0bc70;border-color:#e0bc70;color:#282313;font-weight:600}.my-action:disabled{opacity:.45;cursor:default}.my-action>span{margin-left:10px}.my-more{display:block;margin:15px auto;border:0;background:transparent;color:#e0bc70;cursor:pointer}.my-empty{text-align:center;padding:40px 20px;color:var(--text-muted);font-size:13px}.my-empty strong{display:block;color:var(--text-primary);font-size:17px;font-weight:500}.my-empty p{font-size:12px;margin:10px 0 0}.my-timer{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#20262a;border:1px solid #96bfd62a;border-radius:12px;padding:20px 24px;margin-bottom:10px}.my-timer h2{font-size:14px;margin:0;font-weight:500}.my-timer p{font-size:12px;color:#9eafb8;margin:6px 0 0}.my-timer button{border:0;background:transparent;color:#b2d3e5;cursor:pointer}.my-timer strong{font-size:26px;font-weight:500;font-variant-numeric:tabular-nums}.my-timer small{margin-left:8px;font-size:11px}.my-blocked{margin-top:22px}.my-blocked summary{font-size:12px;color:var(--text-muted);cursor:pointer;margin-bottom:12px}.my-tomorrow{margin-top:28px;border-top:1px solid var(--border-subtle);padding-top:22px}.my-tomorrow>header,.my-record-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.my-tomorrow h2,.my-record-heading h2{font-size:15px;font-weight:500;margin:0}.my-tomorrow header span,.my-record-heading span,.my-not-due,.my-muted{font-size:12px;color:var(--text-muted)}.my-calendar{padding:22px;border:1px solid var(--border-default);border-radius:12px;background:#25251f;margin-bottom:28px}.my-calendar>header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.my-calendar>header>div{display:flex;align-items:center;gap:18px}.my-calendar header strong{font-size:16px;font-weight:500;min-width:112px;text-align:center}.my-calendar header button{border:1px solid var(--border-default);background:transparent;border-radius:7px;color:inherit;min-width:32px;min-height:32px;font-size:18px;cursor:pointer}.my-calendar header button.my-today{font-size:12px;padding:0 12px}.my-weekdays,.my-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.my-weekdays{text-align:center;color:var(--text-muted);font-size:11px;margin-bottom:8px}.my-days button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:66px;padding:8px 2px;border:1px solid transparent;border-radius:8px;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:14px}.my-days small{font-size:10px;color:#abc9a2;min-height:16px}.my-days button.today{border-color:#d4a85340}.my-days button.selected{border-color:#d4a85399;background:#d4a85318;color:#f3d48f}.my-days button.other,.my-days button:disabled{opacity:.25;cursor:default}.my-record-heading{padding-bottom:12px;border-bottom:1px solid var(--border-subtle)}.my-record{display:flex;justify-content:space-between;gap:20px;padding:20px 0;border-bottom:1px solid var(--border-subtle)}.my-record>span{font-size:12px;color:#abc9a2;white-space:nowrap}.my-drawer-mask{position:fixed;inset:0;z-index:2100;display:flex;justify-content:flex-end;background:#0009}.my-drawer{width:min(520px,100vw);height:100%;display:flex;flex-direction:column;background:#25251f;color:var(--text-primary);border-left:1px solid var(--border-default);box-shadow:-15px 0 45px #0004;outline:0}.my-drawer>header{padding:26px 28px;display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid var(--border-subtle)}.my-drawer header small{color:#e0bc70;font-size:11px}.my-drawer header h2{font-size:22px;margin:9px 0;font-weight:550}.my-drawer header p{font-size:12px;color:var(--text-muted);margin:0}.my-drawer header>button{align-self:flex-start;background:transparent;border:0;color:var(--text-muted);font-size:27px;cursor:pointer}.my-drawer form{display:flex;flex-direction:column;min-height:0;flex:1}.my-drawer-body{padding:24px 28px;flex:1;overflow-y:auto}.my-instruction{font-size:13px;line-height:1.9;color:var(--text-secondary);margin:20px 0}.my-target{padding:18px;border:1px solid #d4a85335;border-radius:10px;background:#d4a85309;margin:20px 0}.my-target span{font-size:12px;color:var(--text-muted)}.my-target strong{display:block;font-size:27px;color:#e0bc70;font-weight:500}.my-drawer label{display:block;font-size:13px;margin:20px 0}.my-field{display:flex;align-items:center;gap:10px;margin-top:9px}.my-field b{font-weight:400;color:var(--text-muted);white-space:nowrap}.my-drawer input:not([type=checkbox]),.my-drawer textarea,.my-drawer select{box-sizing:border-box;width:100%;padding:12px;border:1px solid #4b5042;border-radius:8px;background:#191b17;color:var(--text-primary);font:inherit;min-height:44px}.my-drawer textarea{min-height:100px;resize:vertical;margin-top:10px}.my-drawer label.my-confirm{display:flex;align-items:center;gap:10px;line-height:1.7}.my-big-timer{display:grid;gap:8px;text-align:center;margin:25px 0;color:#b2d3e5}.my-big-timer strong{font-size:46px;font-variant-numeric:tabular-nums}.my-big-timer span{font-size:12px}.my-drawer footer{padding:20px 28px;border-top:1px solid var(--border-subtle)}.my-drawer footer>.my-action{width:100%;min-height:46px}.my-drawer footer>p{font-size:11px;color:var(--text-muted);text-align:center;margin:10px 0 0}.my-stock-lines p{display:flex;justify-content:space-between;gap:20px;font-size:13px;border-bottom:1px solid var(--border-subtle);padding:12px 0}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #e0bc70;outline-offset:3px}@media(max-width:680px){.my-heading{flex-direction:column;gap:20px}.my-heading-actions{width:100%;justify-content:space-between}.my-heading-actions nav{order:-1;flex:1}.my-heading-actions nav button{flex:1}.my-heading h1{font-size:25px}.my-card{padding:17px 16px;flex-wrap:wrap;gap:13px}.my-card-main{flex-basis:100%}.my-action{width:100%;text-align:center}.my-not-due{margin-top:-4px}.my-timer{padding:18px 16px}.my-timer strong{font-size:22px}.my-calendar{padding:16px 12px}.my-days button{min-height:54px;font-size:13px}.my-weekdays,.my-days{gap:3px}.my-calendar>header>div{gap:10px}.my-calendar header strong{font-size:14px;min-width:100px}.my-drawer>header,.my-drawer-body{padding:22px}.my-drawer footer{padding:18px 22px}}
</style>

<style scoped>
.my-instruction-emphasis{padding:20px;border:1px solid #d4a85345;border-radius:10px;background:#2c271e;color:#f1e5c9;font-size:18px;font-weight:500;line-height:1.9}.my-drawer input:not([type=checkbox]){font-size:22px;min-height:52px}.my-field>b{font-size:16px}.my-record{width:100%;text-align:left;background:transparent;color:inherit;border:0;border-bottom:1px solid var(--border-subtle);font:inherit;cursor:pointer}.my-record:hover{background:#ffffff04}.my-record>span>b{font-size:21px;font-weight:400;margin-left:12px;vertical-align:middle}.my-record-meta{display:grid;grid-template-columns:1fr;gap:14px;margin:22px 0;padding:18px 0;border-top:1px solid var(--border-subtle);border-bottom:1px solid var(--border-subtle)}.my-record-meta>div{display:flex;justify-content:space-between;gap:16px;align-items:baseline}.my-record-meta dt{font-size:12px;color:var(--text-muted);flex-shrink:0}.my-record-meta dd{margin:0;font-size:14px;color:var(--text-primary);text-align:right;font-variant-numeric:tabular-nums}.my-drawer header small.my-record-status{color:#abc9a2}.my-record-result{padding:20px;border:1px solid #abc9a240;border-radius:10px;background:#abc9a208;margin:22px 0}.my-record-result>span{display:block;font-size:12px;color:var(--text-muted)}.my-record-result>strong{display:block;font-size:23px;color:#c4dbbc;font-weight:550;margin-top:8px}.my-record-requirements{margin:22px 0;color:var(--text-muted);font-size:12px}.my-record-requirements summary{cursor:pointer}.my-record-note{margin:20px 0}.my-record-note h3{font-size:13px;font-weight:500;color:var(--text-muted)}.my-record-note p{font-size:14px;line-height:1.8;white-space:pre-wrap}
</style>

<style scoped>
.my-product-tabs{display:flex;gap:9px;overflow-x:auto;max-width:100%;padding:2px 0 12px;margin:-8px 0 18px;scrollbar-width:thin;scrollbar-color:#655840 transparent}.my-product-tabs>button{display:flex;align-items:center;gap:10px;flex-shrink:0;max-width:420px;padding:10px 13px;border:1px solid var(--border-default,#454335);border-radius:8px;background:#22231e;color:var(--text-muted);font:inherit;font-size:13px;cursor:pointer}.my-product-tabs>button>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.my-product-tabs>button>b{display:inline-flex;align-items:center;justify-content:center;min-width:21px;height:21px;padding:0 6px;flex-shrink:0;border-radius:11px;background:#ffffff08;color:var(--text-secondary);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}.my-product-tabs>button.active{border-color:#d4a85380;background:#d4a85312;color:#edcb83}.my-product-tabs>button.active>b{background:#d4a85324;color:#f0cf87}.my-product-tabs>button>b.zero{opacity:.55}.my-product-tabs>button:hover{border-color:#b99a5b80}@media(max-width:680px){.my-product-tabs{margin-top:0}.my-product-tabs>button{max-width:330px;padding:9px 11px}}
</style>

<style scoped>
.my-batch-tabs{display:flex;align-items:center;gap:8px;overflow-x:auto;padding:2px 0 12px;margin:-6px 0 18px;scrollbar-width:thin}.my-batch-tabs>span{font-size:11px;color:var(--text-muted);white-space:nowrap;flex-shrink:0;margin-right:4px}.my-batch-tabs button{border:1px solid transparent;border-radius:6px;background:transparent;color:var(--text-muted);font:inherit;font-size:11px;white-space:nowrap;padding:7px 10px;cursor:pointer;flex-shrink:0;font-variant-numeric:tabular-nums}.my-batch-tabs button.active{border-color:#d4a85350;background:#d4a8530c;color:#e4c383}.my-batch-tabs b{font-size:10px;font-weight:500;margin-left:7px}.my-batch-group{margin:24px 0 30px;padding-bottom:10px;border-bottom:1px solid var(--border-subtle)}.my-batch-group>.my-section-label{margin-top:14px}.my-batch-group:last-child{border-bottom:0}.my-record-batch>.task-batch-heading{margin-bottom:0}.my-batch-group .my-card:last-child{margin-bottom:0}
</style>

<style scoped>
.my-card,.my-timer{position:relative}
</style>

<style scoped>
.my-batch-filter-bar{display:flex;align-items:flex-start;gap:16px;margin-bottom:18px}.my-batch-filter-bar .my-product-tabs{flex:1;min-width:0;margin-bottom:0}.my-completed-filter{display:flex;align-items:center;gap:8px;flex-shrink:0;font-size:12px;color:var(--text-muted)}.my-completed-filter select{max-width:330px;min-height:42px;padding:8px 12px;border:1px solid var(--border-default,#454335);border-radius:8px;background:#22231e;color:var(--text-primary);font:inherit;cursor:pointer}@media(max-width:680px){.my-batch-filter-bar{flex-direction:column;gap:4px}.my-batch-filter-bar .my-product-tabs{width:100%}.my-completed-filter{width:100%}.my-completed-filter select{flex:1;min-width:0;max-width:100%}}
</style>

<style scoped>
.my-card.condition-ready{border-color:#91bc9170;background:#91bc910b}.my-card small.condition-ready-label{display:inline-block;color:#b8e6a5;font-size:13px;font-weight:700;background:#91bc911c;border-radius:4px;padding:3px 7px}
</style>

<style scoped>
.my-title-line{display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap}.my-title-line h1{margin:0}.my-next-day{display:flex;align-items:center;gap:8px}.my-next-day button,.my-next-day select{padding:6px 10px;border:1px dashed #91bc9160;border-radius:6px;background:#91bc910b;color:#afd2a3;font:inherit;font-size:12px;cursor:pointer}.my-next-day select{max-width:240px;background:#25251f}.my-next-day button:disabled{opacity:.5;cursor:default}
</style>
