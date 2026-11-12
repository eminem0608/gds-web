<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { brewApi } from '../api';
import FinishedProductDialog from './FinishedProductDialog.vue';
const props = defineProps({ canManage: Boolean });
const rows = ref([]), products = ref([]), query = ref(''), error = ref(''), loading = ref(false);
const editing = ref(false), current = ref(null);
let sequence = 0;
const types = { bottle: '瓶装', can: '罐装', keg: '桶装', box: '整箱' };
const visible = computed(() => rows.value.filter(r => [r.barcode, r.name, r.product_name].join(' ').toLowerCase().includes(query.value.toLowerCase())));
async function all(resource) { const result = []; for (let page = 1; ; page++) { const items = await brewApi.listMaster(resource, { page, page_size: 100, active: true }); result.push(...items); if (items.length < 100) return result; } }
async function load() {
  const request = ++sequence; loading.value = true; error.value = '';
  try { const [specs, beers] = await Promise.all([all('packaging-specs'), all('products')]); if (request === sequence) { rows.value = specs; products.value = beers.filter(p => p.brew_item_type === 'finished_product'); } }
  catch (cause) { if (request === sequence) error.value = cause.message; }
  finally { if (request === sequence) loading.value = false; }
}
function edit(row = null) { current.value = row; editing.value = true; }
function saved() { editing.value = false; load(); }
onMounted(load); onUnmounted(() => { ++sequence; });
</script>
<template>
  <section class="finished-catalog">
    <header class="fc-heading"><div><h2>包装规格</h2><p>维护酒款的瓶装、罐装、桶装等包装规格</p></div><div><input v-model.trim="query" type="search" aria-label="搜索包装规格" placeholder="搜索条码、酒款或包装"><button class="btn btn-sm btn-secondary" type="button" :disabled="loading" @click="load">刷新</button><button v-if="canManage" class="btn btn-sm btn-primary" type="button" @click="edit()">新增包装规格</button></div></header>
    <p v-if="error" class="master-error" role="alert">{{ error }}</p><p v-if="loading && !rows.length" class="empty">正在加载包装规格…</p>
    <div v-else-if="!visible.length" class="empty">{{ query ? '没有匹配的包装规格' : '暂无包装规格' }}</div>
    <div v-else class="fc-table"><table><thead><tr><th>包装条码</th><th>酒款 / 包装</th><th>包装类型</th><th>每件酒液量</th><th></th></tr></thead><tbody><tr v-for="row in visible" :key="row.id"><td class="fc-code">{{ row.barcode || '—' }}</td><td><strong>{{ row.product_name }}</strong><small>{{ row.name }}</small></td><td>{{ types[row.brew_barcode_level] || '未设置' }}<small v-if="row.qty > 1">{{ row.qty }} 个容器 / 件</small></td><td>{{ row.brew_volume_l }} L</td><td><button v-if="canManage" class="btn btn-xs btn-outline" type="button" @click="edit(row)">编辑</button></td></tr></tbody></table></div>
    <FinishedProductDialog v-if="editing" :current="current" :products="products" @close="editing = false" @saved="saved" />
  </section>
</template>
<style scoped>
.fc-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;padding:22px 24px;border-bottom:1px solid var(--border-subtle)}.fc-heading h2{font-size:18px;margin:0}.fc-heading p{font-size:12px;color:var(--text-muted);margin:6px 0 0}.fc-heading>div:last-child{display:flex;align-items:center;gap:8px}.fc-heading input{width:210px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:7px;color:var(--text-primary);padding:0 10px;font-size:12px}.fc-heading input,.fc-heading .btn{height:34px;min-height:34px;box-sizing:border-box}.fc-table{overflow:auto;padding:0 24px 20px}.fc-table table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}.fc-table th{font-size:11px;color:var(--text-muted);font-weight:400}.fc-table td,.fc-table th{padding:16px 12px;border-bottom:1px solid var(--border-subtle)}.fc-table strong{font-weight:500}.fc-table small{display:block;font-size:11px;color:var(--text-muted);margin-top:6px}.fc-code{color:var(--accent-gold);font-variant-numeric:tabular-nums}@media(max-width:650px){.fc-heading{padding:18px}.fc-heading>div:last-child{flex-wrap:wrap;width:100%}.fc-heading input{flex:1;min-width:120px}.fc-table{padding:0 8px 16px}}
</style>
