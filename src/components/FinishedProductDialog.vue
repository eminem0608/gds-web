<script setup>
import { computed, onMounted, onUnmounted, ref, useId } from 'vue';
import { brewApi } from '../api';
import JourneyDetailDialog from './JourneyDetailDialog.vue';

const props = defineProps({ current: Object, products: Array, productId: [String, Number] });
const emit = defineEmits(['close', 'saved']);
const formId = useId();
const beers = ref(props.products || []), loading = ref(false), saving = ref(false), error = ref('');
const draft = ref(props.current ? {
  name: props.current.name, barcode: props.current.barcode || '', product_id: props.current.product_id?.id || '',
  brew_barcode_level: props.current.brew_barcode_level, brew_volume_l: props.current.brew_volume_l, qty: props.current.qty
} : { name: '', barcode: '', product_id: '', brew_barcode_level: 'can', brew_volume_l: 0.5, qty: 1 });
const types = { bottle: '瓶装', can: '罐装', keg: '桶装', box: '整箱' };
const fixedBeer = computed(() => beers.value.find(p => String(p.id) === String(props.productId)));
let alive = true;
function close() { if (!saving.value) emit('close'); }
async function load() {
  loading.value = true; error.value = '';
  try {
    if (!props.products) {
      const result = [];
      for (let page = 1; ; page++) {
        const items = await brewApi.listMaster('products', { page, page_size: 100, active: true });
        if (!alive) return;
        result.push(...items.filter(p => p.brew_item_type === 'finished_product'));
        if (items.length < 100) { beers.value = result; break; }
      }
    }
    if (props.productId) {
      if (!fixedBeer.value?.product_variant_id) throw Error('当前酒款不可用，请刷新后重试。');
      draft.value.product_id = fixedBeer.value.product_variant_id;
    }
  } catch (cause) { if (alive) error.value = cause.message || '酒款加载失败，请重试。'; }
  finally { if (alive) loading.value = false; }
}
async function save() {
  if (saving.value || loading.value) return;
  error.value = '';
  if (props.productId && !fixedBeer.value?.product_variant_id) { error.value = '请先加载当前酒款。'; return; }
  saving.value = true;
  try {
    const payload = { ...draft.value, name: draft.value.name.trim(), barcode: draft.value.barcode.trim(),
      product_id: Number(props.productId ? fixedBeer.value.product_variant_id : draft.value.product_id),
      qty: Number(draft.value.qty), brew_volume_l: Number(draft.value.brew_volume_l) };
    const saved = props.current
      ? await brewApi.updateMaster('packaging-specs', props.current.id, { ...payload, version: props.current.version })
      : await brewApi.createMaster('packaging-specs', payload);
    if (alive) emit('saved', saved);
  } catch (cause) { if (alive) error.value = cause.message || '保存失败，请重试。'; }
  finally { if (alive) saving.value = false; }
}
onMounted(load);
onUnmounted(() => { alive = false; });
</script>

<template>
  <JourneyDetailDialog class="finished-product-dialog" :layer="2600" :title="current ? '编辑成品规格' : '新增包装规格'" width="540px" @close="close">
    <form :id="formId" class="finished-product-form" @submit.prevent="save">
      <div v-if="error" class="master-error fp-wide" role="alert">{{ error }} <button v-if="productId && !fixedBeer" class="fp-retry" type="button" :disabled="loading" @click="load">重新加载</button></div>
      <label class="fp-wide">酒款
        <input v-if="productId" :value="fixedBeer?.product_name || fixedBeer?.name || (loading ? '正在加载…' : '未找到当前酒款')" readonly aria-label="酒款">
        <select v-else v-model="draft.product_id" required :disabled="saving || loading"><option value="">选择酒款</option><option v-for="p in beers" :key="p.id" :value="p.product_variant_id">{{ p.product_name || p.name }}</option></select>
      </label>
      <label class="fp-wide">包装条码（选填）<input v-model.trim="draft.barcode" maxlength="128" :disabled="saving" placeholder="已有包装条码，可留空"></label>
      <label class="fp-wide">包装名称<input v-model.trim="draft.name" required maxlength="100" :disabled="saving" placeholder="如 500mL 罐装、20L 桶装"></label>
      <label>包装类型<select v-model="draft.brew_barcode_level" required :disabled="saving"><option v-for="(label,key) in types" :key="key" :value="key">{{ label }}</option></select></label>
      <label>每件容器数<input v-model.number="draft.qty" type="number" min="1" step="1" required :disabled="saving"></label>
      <label class="fp-wide">每件酒液量（L）<input v-model.number="draft.brew_volume_l" type="number" min="0.001" step="0.001" required :disabled="saving"><small>单罐 500mL 填 0.5；500mL × 12 罐整箱填 6。</small></label>
    </form>
    <template #footer><button type="button" class="btn btn-secondary fp-cancel" :disabled="saving" @click="close">取消</button><button class="btn btn-primary" type="submit" :form="formId" :disabled="saving || loading || (Boolean(productId) && !fixedBeer)">{{ saving ? '保存中…' : productId ? '保存并选用' : '保存' }}</button></template>
  </JourneyDetailDialog>
</template>

<style scoped>
.finished-product-form{display:grid;grid-template-columns:1fr 1fr;gap:16px}.finished-product-form label{display:grid;gap:7px;font-size:12px;color:var(--text-secondary)}.finished-product-form input,.finished-product-form select{width:100%;min-width:0;box-sizing:border-box;height:38px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:7px;color:var(--text-primary);padding:0 10px;font:inherit;color-scheme:dark}.finished-product-form input:focus,.finished-product-form select:focus{outline:none;border-color:var(--accent-gold)}.finished-product-form input[readonly]{background:transparent;color:var(--text-secondary)}.finished-product-form small{font-size:11px;color:var(--text-muted);line-height:1.6}.fp-wide{grid-column:1/-1}.fp-retry{border:0;background:none;color:var(--accent-gold);cursor:pointer}.fp-cancel{margin-right:8px}@media(max-width:420px){.finished-product-form{grid-template-columns:1fr}}
</style>
