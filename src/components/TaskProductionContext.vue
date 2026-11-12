<script setup>
defineProps({ production: Object, subtitle: String });
const amount = value => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
</script>
<template>
  <div v-if="production" class="task-production-context">
    <div class="task-production-main"><strong>{{ production.product }}</strong><span>{{ amount(production.volume_l) }} L</span><span v-if="production.tank || production.equipment">{{ production.tank || production.equipment }}</span></div>
    <div class="task-production-reference"><span v-if="production.batch_name">批次 {{ production.batch_name }}</span><span v-if="production.plan_name">计划 {{ production.plan_name }}</span></div>
  </div>
  <p v-else-if="subtitle" class="task-production-fallback">{{ subtitle }}</p>
</template>
<style scoped>
.task-production-context{margin-top:12px;min-width:0}.task-production-main{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px 16px;font-size:12px;line-height:1.7}.task-production-main strong{color:var(--text-secondary,#d6d1c5);font-weight:500;font-size:13px}.task-production-main span{color:var(--text-secondary,#d6d1c5);font-variant-numeric:tabular-nums}.task-production-reference{display:flex;flex-wrap:wrap;gap:2px 18px;margin-top:4px;font-size:11px;line-height:1.7;color:var(--text-muted,#99998e);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.task-production-fallback{margin:5px 0 0;font-size:12px;color:var(--text-muted);overflow-wrap:anywhere}
</style>
