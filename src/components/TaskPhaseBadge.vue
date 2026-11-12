<script setup>
defineProps({ phase: String });
const labels = { mashing: '糖化任务', fermentation: '发酵任务', material_preparation: '备料任务', packaging: '包装任务' };
</script>
<template><span v-if="labels[phase]" class="task-phase-badge" :class="phase">{{ labels[phase] }}</span></template>
<style scoped>
.task-phase-badge{position:absolute;top:0;left:0;padding:2px 8px;border:1px solid #d4a85345;border-radius:11px 0 6px 0;background:#d4a85314;color:#e0bc70;font-size:10px;line-height:1.4;white-space:nowrap;pointer-events:none}.task-phase-badge.fermentation{border-color:#91bc9145;background:#91bc9114;color:#afd2a3}.task-phase-badge.packaging{border-color:#92bad645;background:#92bad614;color:#b2d3e5}.task-phase-badge.material_preparation{border-color:#c1a3d645;background:#c1a3d614;color:#ceb3df}
</style>
