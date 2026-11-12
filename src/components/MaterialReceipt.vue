<script setup>
import { locationLabel } from '../location-label';
defineProps({ receipt: Object, plan: Object, batch: Object, canOperate: Boolean, saving: Boolean });
defineEmits(['acknowledge']);
</script>

<template>
  <section v-if="receipt" class="material-receipt">
    <header><div><span>生产前领料</span><h3>{{ receipt.ready ? '已确认实领' : receipt.can_acknowledge ? '请核对领料明细' : '等待库管发料' }}</h3></div><span>{{ receipt.ready ? '可以开始生产' : '实领确认后开放生产操作' }}</span></header>
    <p v-if="plan" class="receipt-context">当前计划 <strong>{{ plan.name }}</strong><template v-if="batch"> · 生产批次 <strong>{{ batch.name }}</strong></template></p>
    <p v-if="!receipt.records?.length">本计划尚未生成领料单。请库管进入「库存采购 → 生产领料」，搜索计划号 {{ plan?.name || '' }}，生成拣料清单并确认发到领料库，再由本批糖化负责人确认实领。</p>
    <template v-for="record in receipt.records" :key="record.id">
      <p>{{ record.name }} · {{ locationLabel(record.production_location) }}</p>
      <div class="receipt-table"><table><thead><tr><th>原料 / 批次</th><th>发料数量</th><th>实领数量</th></tr></thead><tbody><template v-for="line in record.lines" :key="line.id"><tr v-for="allocation in line.allocations" :key="allocation.id"><td><strong>{{ line.product.name }}</strong><small>{{ allocation.lot.name }}</small></td><td>{{ allocation.issued_qty }} {{ line.uom.name }}</td><td>{{ ['acknowledged','completed'].includes(record.state) ? allocation.acknowledged_qty + ' ' + line.uom.name : '待核对确认' }}</td></tr></template></tbody></table></div>
    </template>
    <p>领料记录按生产计划对应，其他批次的实领确认不能用于本批生产。</p>
    <p v-if="!receipt.ready && receipt.records?.length">有差异时联系库管核实并收回重发；确认实领不会再次扣减原料仓库存。</p>
    <button v-if="canOperate && receipt.can_acknowledge" class="btn btn-sm btn-primary" type="button" :disabled="saving" @click="$emit('acknowledge')">{{ saving ? '确认中…' : '核对无误，确认实领' }}</button>
  </section>
</template>

<style scoped>
.material-receipt{padding:18px;margin-bottom:20px;border:1px solid #d4a85335;border-radius:12px;background:#d4a85305}.material-receipt header{display:flex;justify-content:space-between;align-items:center;gap:14px}.material-receipt h3{font-size:17px;margin:6px 0}.material-receipt header span,.material-receipt p{color:var(--text-muted);font-size:12px;line-height:1.7}.receipt-table{overflow:auto}.receipt-table table{border-collapse:collapse;width:100%;font-size:12px}.receipt-table th,.receipt-table td{text-align:left;padding:10px 6px;border-bottom:1px solid #ffffff10}.receipt-table th{color:var(--text-muted);font-weight:400}.receipt-table small{display:block;color:var(--text-muted);margin-top:4px}.material-receipt .btn{margin-top:10px}@media(max-width:560px){.material-receipt header{align-items:flex-start;flex-direction:column}}
</style>
