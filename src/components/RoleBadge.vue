<script setup>
import { computed } from 'vue';
const props = defineProps({ code: String, label: String, inherited: Boolean });
const colors = {
  tenant_admin: ['#baa4ec', '#baa4ec18'], general_manager: ['#e5bd70', '#e5bd7019'],
  production_director: ['#8faee8', '#8faee819'], headquarters_planner: ['#80c5cf', '#80c5cf19'],
  brewery_manager: ['#91bf9d', '#91bf9d19'], brewer: ['#b1c785', '#b1c78519'],
  operator: ['#9cbacb', '#9cbacb19'], warehouse_keeper: ['#81bcb0', '#81bcb019'],
  purchaser: ['#d5a37c', '#d5a37c19'], salesperson: ['#da9bb5', '#da9bb519'],
  finance: ['#aca7d9', '#aca7d919'], supplier: ['#b6afa0', '#b6afa019']
};
const palette = computed(() => colors[props.code] || ['#b0b9c5', '#b0b9c519']);
</script>
<template><span class="role-badge" :class="{'role-badge-inherited':inherited}" :style="{'--role-ink':palette[0],'--role-fill':palette[1]}" :title="inherited ? '继承自组织：' + label : label">{{ label }}</span></template>
<style scoped>
.role-badge{display:inline-flex;align-items:center;white-space:nowrap;vertical-align:middle;padding:3px 7px;border:1px solid transparent;border-radius:5px;color:var(--role-ink);background:var(--role-fill);font-size:11px;font-weight:400;line-height:1.5}.role-badge-inherited{border-style:dashed;border-color:color-mix(in srgb,var(--role-ink) 34%,transparent)}
</style>
