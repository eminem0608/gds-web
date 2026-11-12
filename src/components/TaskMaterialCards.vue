<script setup>
import { materialMetrics } from '../procurement-material-display';
defineProps({ materials: { type: Array, default: () => [] }, quantityLabel: { type: String, default: '本次投入' } });
const amount = value => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 4 });
const metrics = card => materialMetrics({ ...card.details, brew_material_category: card.group });
</script>
<template>
  <section class="task-materials" aria-label="本次投料明细">
    <article v-for="(card,index) in materials" :key="index" class="task-material-card">
      <div class="task-material-heading"><span v-if="card.details?.brew_brand" class="task-material-brand">{{ card.details.brew_brand }}</span><span v-if="card.details?.brew_malt_class || card.details?.brew_hop_type" class="task-material-category">{{ card.details.brew_malt_class || card.details.brew_hop_type }}</span></div>
      <h3>{{ card.name }}</h3>
      <p v-if="card.details?.brew_product_model" class="task-material-model">{{ card.details.brew_product_model }}</p>
      <div class="task-material-amount"><span>{{ quantityLabel }}</span><strong>{{ amount(card.quantity) }}<small>{{ card.unit }}</small></strong></div>
      <div v-if="metrics(card).length" class="task-material-metrics"><div v-for="metric in metrics(card)" :key="metric.label"><span>{{ metric.label }}</span><strong>{{ metric.value }}<small>{{ metric.unit }}</small></strong></div></div>
      <p v-if="card.details?.brew_specification" class="task-material-description">规格：{{ card.details.brew_specification }}</p>
      <p v-if="card.details?.brew_flavor_desc" class="task-material-description">风味描述：{{ card.details.brew_flavor_desc }}</p>
    </article>
  </section>
</template>
<style scoped>
.task-materials{display:grid;gap:16px;margin:22px 0}.task-material-card{padding:22px;border:1px solid #d4a85370;border-radius:12px;background:#2c271e}.task-material-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.task-material-heading:empty{display:none}.task-material-brand{font-size:14px;font-weight:600;color:#dcb66c}.task-material-category{font-size:11px;padding:2px 9px;border:1px solid #d4a85335;border-radius:12px;color:#ccb27b}.task-material-card h3{font-size:25px;font-weight:650;line-height:1.45;color:#f5eddb;margin:8px 0;overflow-wrap:anywhere}.task-material-model{font-size:13px;color:#b6ad9b;margin:2px 0 0}.task-material-amount{display:flex;justify-content:space-between;align-items:baseline;gap:18px;margin:20px 0 0;padding:16px 0;border-top:1px solid #d4a85330;border-bottom:1px solid #d4a85330}.task-material-amount>span{font-size:14px;font-weight:500;color:#d4c4a4}.task-material-amount>strong{font-size:42px;font-weight:650;line-height:1.2;color:#ffda87;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.task-material-amount small{font-size:22px;font-weight:500;margin-left:10px}.task-material-metrics{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.task-material-metrics>div{padding:8px 11px;border:1px solid #5b503b;border-radius:7px;background:#211e18;min-width:86px}.task-material-metrics span{display:block;font-size:11px;color:#aaa08c}.task-material-metrics strong{font-size:18px;line-height:1.7;font-weight:600;color:#e7c27c;font-variant-numeric:tabular-nums}.task-material-metrics small{font-size:10px;font-weight:400;color:#b3aa97;margin-left:5px}.task-material-description{font-size:12px;line-height:1.8;color:#bfb39d;margin:14px 0 0}@media(max-width:420px){.task-material-card{padding:18px}.task-material-card h3{font-size:23px}.task-material-amount>strong{font-size:38px}}
</style>
