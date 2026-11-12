<script setup>
defineProps({ production: Object, count: Number, history: Boolean });
const amount = value => Number(value || 0).toLocaleString('zh-CN', {maximumFractionDigits:3});
</script>
<template>
  <header v-if="production" class="task-batch-heading"><div><span class="batch-label">生产批次</span><h3>{{ production.batch_name || production.plan_name || '未关联批次' }}</h3><p><strong>{{ production.product }}</strong><span>{{ amount(production.volume_l) }} L</span><span v-if="production.tank">{{ production.tank }}</span><span v-if="production.plan_name" class="batch-plan">计划 {{ production.plan_name }}</span></p></div><span class="batch-count">{{ count }}{{ history?'条记录':'项任务' }}</span></header>
</template>
<style scoped>
.task-batch-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;margin-bottom:14px;border-left:3px solid #d4a85380;border-radius:0 9px 9px 0;background:#d4a85307}.batch-label{font-size:10px;color:var(--text-muted);letter-spacing:1px}.task-batch-heading h3{font-size:16px;line-height:1.5;font-weight:600;color:#e8cc93;margin:5px 0 9px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.task-batch-heading p{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 15px;margin:0;font-size:12px;line-height:1.8;color:var(--text-secondary)}.task-batch-heading strong{font-weight:500;color:var(--text-primary)}.batch-plan{color:var(--text-muted);font-size:11px}.batch-count{flex-shrink:0;font-size:11px;color:var(--text-muted);margin-top:8px;white-space:nowrap}@media(max-width:620px){.task-batch-heading{padding:15px}.task-batch-heading h3{font-size:14px}.task-batch-heading p{gap:3px 11px}.batch-plan{flex-basis:100%}}
</style>
