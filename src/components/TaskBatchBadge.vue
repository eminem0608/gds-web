<script setup>
defineProps({ production: Object, planId: [String, Number] });
defineEmits(['open']);
</script>
<template>
  <button v-if="production && planId" class="task-batch-badge" type="button" :aria-label="'查看生产详情：'+production.product+' · '+(production.batch_name || production.plan_name)" @click.stop="$emit('open',planId)">{{ production.product }} · {{ production.batch_name || production.plan_name }} <span aria-hidden="true">›</span></button>
</template>
<style scoped>
.task-batch-badge{position:absolute;top:0;right:0;max-width:calc(100% - 24px);padding:2px 7px;border:1px solid #d4a85340;border-radius:0 11px 0 6px;background:#d4a8530c;color:#ddc38c;font:inherit;font-size:10px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}.task-batch-badge:hover{background:#d4a85320;border-color:#d4a85380}.task-batch-badge:focus-visible{outline:2px solid #e0bc70;outline-offset:3px}.task-batch-badge span{margin-left:6px}
</style>
