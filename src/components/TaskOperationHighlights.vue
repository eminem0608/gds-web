<script setup>
defineProps({ items: { type: Array, default: () => [] }, label: { type: String, default: '本次操作要求' } });
const display = value => typeof value === 'number' ? value.toLocaleString('zh-CN', { maximumFractionDigits: 4 }) : String(value ?? '');
const textual = value => typeof value !== 'number' && (!Number.isFinite(Number(value)) || String(value).length > 8);
</script>
<template>
  <section v-if="items.length" class="operation-highlights" :aria-label="label"><div v-for="(item,index) in items" :key="index" class="operation-highlight"><span>{{ item.label }}</span><strong :class="{textual:textual(item.value)}">{{ display(item.value) }}<small v-if="item.unit">{{ item.unit }}</small></strong></div></section>
</template>
<style scoped>
.operation-highlights{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:22px 0}.operation-highlight{padding:20px 18px;border:1px solid #d4a85365;border-radius:11px;background:#2c271e;min-width:0}.operation-highlight>span{display:block;color:#d2c3a5;font-size:13px;line-height:1.6;margin-bottom:12px}.operation-highlight>strong{display:block;color:#ffda87;font-size:38px;font-weight:650;line-height:1.3;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.operation-highlight>strong.textual{font-size:22px;line-height:1.6;color:#f1e5c9}.operation-highlight small{font-size:17px;font-weight:500;margin-left:8px;color:#e4c584}.operation-highlight:only-child{grid-column:1/-1}@media(max-width:360px){.operation-highlights{grid-template-columns:1fr}.operation-highlight>strong{font-size:34px}}
</style>
