<script setup>
import { locationLabel } from "../location-label.js";
import { computed, ref, watch } from 'vue';
const props = defineProps({ tasks: { type: Array, default: () => [] }, records: { type: Array, default: () => [] }, canWarehouse: Boolean });
defineEmits(['open']);
const keyword = ref(''), state = ref('active'), page = ref(1);
const labels = { waiting: '待库管备料', draft: '待拣料', recommended: '待发到领料库', issued: '待确认实领', acknowledged: '待登记物料去向', completed: '已结清', cancelled: '已取消', overage_pending: '超领待审批' };
const rows = computed(() => {
  const rows = props.records.map(record => ({ ...record, planId: record.plan.id, planName: record.plan.name, location: locationLabel(record.production_location, '待选择'), count: record.lines.length }));
  for (const task of props.tasks) {
    if (!rows.some(row => row.planId === task.plan?.id)) rows.push({ id: 'task-' + task.id, planId: task.plan.id, planName: task.plan.name, name: task.plan.product, state: 'waiting' });
  }
  return rows.filter(row => (state.value === 'all' || (state.value === 'active' ? !['completed','cancelled'].includes(row.state) : row.state === state.value)) && (!keyword.value || [row.planName,row.name,row.factory?.name,...(row.lines || []).map(line => line.product.name)].join(' ').toLowerCase().includes(keyword.value.toLowerCase())));
});
watch([keyword,state], () => { page.value = 1; });
watch(() => rows.value.length, length => { page.value = Math.min(page.value, Math.max(1, Math.ceil(length / 10))); });
</script>

<template>
  <section class="inventory-section material-queue">
    <header><div><h3>生产领料</h3><p>库管拣料发到领料库，生产确认实领，结束后登记物料去向</p></div><div class="queue-filters"><input v-model.trim="keyword" placeholder="搜索计划、领料单或原料"><select v-model="state"><option value="active">待处理</option><option value="all">全部记录</option><option value="waiting">待备料</option><option value="issued">待确认实领</option><option value="acknowledged">待登记物料去向</option><option value="completed">已结清</option></select></div></header>
    <div class="work-table-wrap"><table class="work-table"><thead><tr><th>生产计划 / 领料单</th><th>原料</th><th>领料库位</th><th>进度</th><th>操作</th></tr></thead><tbody><tr v-for="row in rows.slice((page-1)*10,page*10)" :key="row.id"><td><strong>{{ row.planName }}</strong><small>{{ row.name }}<template v-if="row.factory"> · {{ row.factory.name }}</template></small></td><td>{{ row.count ? row.count + ' 项' : '待生成清单' }}</td><td>{{ row.location || '待选择' }}</td><td><span class="issue-state" :data-state="row.state">{{ labels[row.state] || row.state }}</span></td><td><button class="btn btn-xs btn-outline" type="button" @click="$emit('open',row.planId)">{{ canWarehouse && ['waiting','draft','recommended'].includes(row.state) ? '核对并发料' : '查看领料明细' }}</button></td></tr><tr v-if="!rows.length"><td colspan="5" class="inventory-empty">暂无匹配的领料任务，生产计划下发后自动出现</td></tr></tbody></table></div>
    <footer class="queue-pagination"><span>共 {{ rows.length }} 条</span><button class="btn btn-xs btn-outline" :disabled="page <= 1" @click="page--">上一页</button><span>{{ page }} / {{ Math.max(1,Math.ceil(rows.length/10)) }}</span><button class="btn btn-xs btn-outline" :disabled="page*10 >= rows.length" @click="page++">下一页</button></footer>
  </section>
</template>

<style scoped>
.material-queue.procurement-fill-panel > header{flex-shrink:0}
.material-queue.procurement-fill-panel > .work-table-wrap{flex:1;min-height:0;overflow:auto}
.material-queue.procurement-fill-panel > .queue-pagination{flex-shrink:0;margin-top:auto;flex-wrap:wrap}
.material-queue header{display:flex;align-items:center;justify-content:space-between;gap:16px}.queue-filters{display:flex;gap:10px}.queue-filters input,.queue-filters select{height:38px;box-sizing:border-box;background:var(--bg-input,#25231f);color:var(--text-primary);border:1px solid var(--border-color,#454035);border-radius:7px;padding:0 12px;font-size:12px}.queue-filters input{width:240px}.queue-pagination{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:16px 20px;font-size:12px;color:var(--text-muted)}.issue-state{font-size:12px;color:var(--accent-gold)}.issue-state[data-state=completed]{color:#8fb687}@media(max-width:700px){.material-queue header{align-items:stretch;flex-direction:column}.queue-filters input{width:100%;min-width:0}.queue-filters select{max-width:140px}}
</style>
