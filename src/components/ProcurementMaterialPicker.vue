<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { materialGroup, materialComparisonMetrics, materialPrice } from '../procurement-material-display';

const props = defineProps({
  modelValue: [String, Number],
  materials: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  excludedIds: { type: Array, default: () => [] },
  disabled: Boolean,
  supplierName: String
});
const emit = defineEmits(['update:modelValue']);
const opened = ref(false), keyword = ref(''), brand = ref(''), group = ref(''), supplier = ref('');
const failedImages = ref(new Set());
const groupLabels = { malt: '麦芽', hop: '酒花', yeast: '酵母', adjunct: '辅料' };
const groups = computed(() => Object.entries(groupLabels).map(([id, name]) => ({ id, name, count: props.materials.filter(item => materialGroup(item, props.categories) === id).length })));
const groupMaterials = computed(() => props.materials.filter(item => !group.value || materialGroup(item, props.categories) === group.value));
const brands = computed(() => [...new Set(groupMaterials.value.map(item => item.brew_brand).filter(Boolean))]);
const suppliers = computed(() => [...new Map(props.materials.filter(item => item.supplier?.id).map(item => [String(item.supplier.id), item.supplier])).values()]);
function chooseGroup(id) { group.value = id; brand.value = ''; }
function categoryName(item) { return props.categories.find(category => category.code === item.brew_material_category)?.name || ({malt: '麦芽', adjunct: '辅料', hop: '啤酒花', yeast: '酵母'})[item.brew_material_category] || ''; }
const trigger = ref(null), searchInput = ref(null), dialog = ref(null);
const selected = computed(() => props.materials.find(item => String(item.id) === String(props.modelValue)));
const excluded = computed(() => new Set(props.excludedIds.map(String)));
const filtered = computed(() => {
  const words = keyword.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return groupMaterials.value.filter(item => (!supplier.value || String(item.supplier?.id) === supplier.value) && (!brand.value || item.brew_brand === brand.value) && words.every(word => [item.name, item.default_code, item.brew_brand, item.brew_specification, item.supplier?.name, item.brew_product_model].filter(Boolean).join(' ').toLocaleLowerCase().includes(word)));
});
async function open() {
  if (props.disabled) return;
  keyword.value = '';
  brand.value = '';
  group.value = '';
  supplier.value = '';
  opened.value = true;
  await nextTick();
  searchInput.value?.focus();
}
async function close() {
  opened.value = false;
  await nextTick();
  trigger.value?.focus();
}
function select(item) {
  if (excluded.value.has(String(item.id))) return;
  emit('update:modelValue', item.id);
  close();
}
function keydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopPropagation(); close();
  }
  if (event.key === 'Tab') {
    const nodes = [...dialog.value.querySelectorAll('button:not(:disabled), input, select, [tabindex="0"]')];
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}
watch(() => props.disabled, value => { if (value) opened.value = false; });
onBeforeUnmount(() => { opened.value = false; });
</script>

<template>
  <button ref="trigger" class="procurement-material-trigger" :class="{selected: !!selected}" type="button" :disabled="disabled" aria-haspopup="dialog" :aria-expanded="opened" @click="open"><span>{{ selected?.name || '选择原料' }}</span><small>{{ selected ? '更换' : '选择' }}</small></button>
  <Teleport to="body">
    <div v-if="opened" class="procurement-material-mask" @click.self="close">
      <section ref="dialog" class="procurement-material-dialog" role="dialog" aria-modal="true" aria-label="选择采购原料" @keydown="keydown">
        <header><div><h3>选择原料</h3><p>按原料分类浏览供应商商品，查看价格和主要参数</p></div><button class="procurement-material-close" type="button" aria-label="关闭原料选择" @click="close">×</button></header>
        <div class="procurement-material-search"><input ref="searchInput" v-model="keyword" aria-label="搜索原料" placeholder="输入原料名称、品牌或规格"><button v-if="keyword" type="button" @click="keyword = ''; searchInput?.focus()">清除</button><select v-model="supplier" aria-label="筛选供应商"><option value="">全部供应商</option><option v-for="item in suppliers" :key="item.id" :value="String(item.id)">{{ item.name }}</option></select><span>{{ filtered.length }} 项</span></div>
        <div class="material-catalog-layout"><nav class="material-category-nav" aria-label="原料分类"><strong>原料分类</strong><button type="button" :class="{active: !group}" :aria-pressed="!group" @click="chooseGroup('')">全部分类 <small>{{ materials.length }}</small></button><button v-for="item in groups" :key="item.id" type="button" :class="{active: group === item.id}" :aria-pressed="group === item.id" @click="chooseGroup(item.id)">{{ item.name }} <small>{{ item.count }}</small></button></nav><div class="material-catalog-results">
        <div class="material-results-toolbar"><strong>{{ groupLabels[group] || '全部原料' }} <small>{{ filtered.length }} 件商品</small></strong><select v-if="brands.length > 1" v-model="brand" aria-label="筛选原料品牌"><option value="">全部品牌</option><option v-for="name in brands" :key="name" :value="name">{{ name }}</option></select></div>
        <div class="procurement-material-options">
          <button v-for="item in filtered" :key="item.id" class="procurement-material-option" :class="{current: String(modelValue) === String(item.id)}" type="button" :disabled="excluded.has(String(item.id))" @click="select(item)">
            <span class="material-product-top">
              <span class="material-product-image" :data-group="materialGroup(item, categories)"><img v-if="item.image_url && !failedImages.has(String(item.id))" :src="item.image_url" :alt="item.name" loading="lazy" @error="failedImages.add(String(item.id))"><span v-else class="material-product-fallback"><b>{{ ({malt: '麦', hop: '花', yeast: '酵', adjunct: '辅'})[materialGroup(item, categories)] || '料' }}</b><small>{{ groupLabels[materialGroup(item, categories)] || '原料' }}</small></span></span>
              <span class="material-product-main"><span class="material-product-heading"><span v-if="item.brew_brand" class="material-product-brand">{{ item.brew_brand }}</span><strong class="material-product-name">{{ item.name }}</strong><span class="material-product-category">{{ item.brew_hop_type || item.brew_yeast_style || item.brew_malt_class || categoryName(item) || '原料' }}</span></span><span class="material-product-meta">{{ [item.supplier?.name || '供应商未维护', item.brew_specification ? '规格 ' + item.brew_specification : '规格未维护', item.brew_product_model].filter(Boolean).join(' · ') }}</span></span>
            </span>
            <span class="material-product-metrics"><span v-for="metric in materialComparisonMetrics(item, categories)" :key="metric.label" class="material-product-metric" :class="{missing: metric.missing}" :title="metric.missing ? metric.label + '未维护' : metric.label"><small>{{ metric.label }}</small><strong>{{ metric.value }} <em>{{ metric.unit }}</em></strong></span></span>
            <span v-if="item.brew_flavor_desc || item.brew_sensory_desc" class="material-product-flavor">{{ item.brew_flavor_desc || item.brew_sensory_desc }}</span>
            <span class="material-product-bottom"><span v-if="materialPrice(item)" class="material-product-price">¥{{ materialPrice(item) }}<small> / {{ item.uom_id?.name || item.weight_uom || '单位' }}</small></span><span v-else class="material-product-no-price">暂未报价</span><b class="material-product-select">{{ excluded.has(String(item.id)) ? '已添加' : String(modelValue) === String(item.id) ? '已选择 ✓' : '选择 +' }}</b></span>
          </button>
          <div v-if="!filtered.length" class="procurement-material-empty">{{ keyword ? '没有匹配的原料，试试其他关键词' : '暂无可供原料，请先维护供应商物料' }}</div>
        </div>
        </div></div>
        <footer>选择一项原料后返回采购需求，已添加的原料无需重复选择。</footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.procurement-material-trigger { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:38px; padding:9px 11px; background:var(--bg-input,#292621); color:var(--text-muted); border:1px solid var(--border-default,#4a4338); border-radius:6px; text-align:left; cursor:pointer; font:inherit; font-size:13px; }
.procurement-material-trigger.selected { color:var(--text-primary); }
.procurement-material-trigger:disabled { opacity:.45; cursor:not-allowed; }
.procurement-material-trigger small { color:var(--accent-gold); font-size:11px; white-space:nowrap; }
.procurement-material-trigger:focus-visible,.procurement-material-option:focus-visible { outline:2px solid var(--accent-gold); outline-offset:2px; }
.procurement-material-mask { position:fixed; inset:0; z-index:10030; display:flex; align-items:center; justify-content:center; padding:24px; background:#000a; backdrop-filter:blur(4px); }
.procurement-material-dialog { display:flex; flex-direction:column; width:min(1040px,100%); height:min(740px,88dvh); border:1px solid #514736; border-radius:16px; background:#201e19; box-shadow:0 28px 90px #0009; overflow:hidden; color:var(--text-primary); }
.procurement-material-dialog > header { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:20px 24px; flex-shrink:0; }
.procurement-material-dialog h3 { margin:0; font-size:20px; }
.procurement-material-dialog p { margin:7px 0 0; color:var(--text-muted); font-size:12px; }
.procurement-material-close { display:grid; place-items:center; width:32px; height:32px; border:1px solid #ffffff12; border-radius:8px; background:#ffffff04; color:var(--text-muted); font-size:24px; cursor:pointer; }
.procurement-material-search { display:flex; align-items:center; gap:10px; padding:0 24px 18px; border-bottom:1px solid #ffffff0d; flex-shrink:0; }
.procurement-material-search input,.procurement-material-search select,.material-results-toolbar select { box-sizing:border-box; height:36px; min-width:0; padding:0 10px; border:1px solid #4a4338; border-radius:7px; background:#171611; color:var(--text-primary); font:inherit; font-size:12px; }
.procurement-material-search input { flex:1; outline:none; }
.procurement-material-search input:focus { border-color:var(--accent-gold); box-shadow:0 0 0 2px #d4a74718; }
.procurement-material-search select { width:155px; }
.procurement-material-search > span { display:none; }
.procurement-material-search button { border:0; background:transparent; color:var(--accent-gold); cursor:pointer; font-size:12px; }
.material-catalog-layout { display:flex; flex:1; min-height:0; overflow:hidden; }
.material-category-nav { box-sizing:border-box; flex:0 0 136px; display:flex; flex-direction:column; gap:5px; padding:20px 10px; border-right:1px solid #ffffff0d; background:#191813; overflow:auto; }
.material-category-nav > strong { padding:0 12px 12px; font-size:11px; color:var(--text-muted); font-weight:500; }
.material-category-nav button { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 12px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--text-secondary); text-align:left; font:inherit; font-size:13px; cursor:pointer; }
.material-category-nav button:hover { background:#ffffff05; }
.material-category-nav button.active { border-color:#d4a74725; background:#d4a74712; color:var(--accent-gold); }
.material-category-nav small { font-size:10px; opacity:.7; }
.material-catalog-results { flex:1; min-width:0; overflow:auto; padding:18px 20px 22px; scrollbar-gutter:stable; }
.material-results-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
.material-results-toolbar > strong { font-size:13px; font-weight:600; }
.material-results-toolbar small { margin-left:8px; color:var(--text-muted); font-size:11px; font-weight:400; }
.material-results-toolbar select { max-width:150px; height:30px; background:transparent; }
.procurement-material-options { display:flex; flex-direction:column; gap:0; }
.procurement-material-option { display:grid; grid-template-columns:48px minmax(0,1fr) 112px; align-items:start; column-gap:14px; row-gap:8px; width:100%; min-width:0; padding:16px 0; border:0; border-bottom:1px solid #ffffff12; border-radius:0; background:transparent; color:var(--text-secondary); text-align:left; font:inherit; cursor:pointer; }
.procurement-material-option:hover { border-color:#b68e4b; background:#2d2921; }
.procurement-material-option.current { border-color:var(--accent-gold); background:#302a20; }
.procurement-material-option:disabled { opacity:.45; cursor:default; }
.material-product-top { display:contents; }
.material-product-image { display:grid; place-items:center; grid-column:1; grid-row:1/4; width:48px; height:56px; border-radius:6px; overflow:hidden; border:1px solid #ffffff0d; background:#403323; }
.material-product-image[data-group="hop"] { background:#2c3926; }
.material-product-image[data-group="yeast"] { background:#393028; }
.material-product-image img { display:block; width:100%; height:100%; object-fit:contain; background:#faf8f2; }
.material-product-fallback { display:grid; justify-items:center; gap:4px; color:#c5a36a; }
.material-product-fallback b { font-size:25px; font-weight:500; line-height:1.1; }
.material-product-fallback small { font-size:9px; opacity:.75; }
.material-product-main { display:flex; flex-direction:column; gap:4px; grid-column:2; min-width:0; }
.material-product-category { flex:0 0 auto; padding:1px 7px; border:1px solid #d4a74730; border-radius:12px; color:var(--accent-gold); font-size:10px; line-height:1.5; }
.material-product-name { color:var(--text-primary); font-size:14px; line-height:1.5; font-weight:600; overflow-wrap:anywhere; }
.material-product-supplier,.material-product-meta { font-size:11px; line-height:1.5; overflow-wrap:anywhere; color:var(--text-muted); }
.material-product-metrics { display:flex; flex-wrap:wrap; grid-column:2; gap:6px; }
.material-product-metric { display:flex; flex-direction:column; gap:3px; min-width:52px; padding:5px 8px; border:1px solid #4a4030; background:#17161170; border-radius:5px; }
.material-product-metric > small { color:var(--text-muted); font-size:9px; }
.material-product-metric > strong { color:#d8c39c; font:600 13px ui-monospace,SFMono-Regular,Consolas,monospace; }
.material-product-metric em { color:var(--text-muted); font-size:9px; font-style:normal; font-weight:400; }
.material-product-no-metrics,.material-product-no-price { color:var(--text-muted); font-size:11px; }
.material-product-flavor { grid-column:2; color:var(--text-muted); font-size:11px; line-height:1.5; overflow-wrap:anywhere; }
.material-product-bottom { display:flex; flex-direction:column; align-items:flex-end; gap:10px; grid-column:3; grid-row:1/4; align-self:center; }
.material-product-price { color:var(--accent-gold); font-size:16px; font-weight:600; white-space:nowrap; }
.material-product-price small { display:block; color:var(--text-muted); text-align:right; font-size:10px; font-weight:400; }
.material-product-select { border:1px solid #d4a74740; border-radius:6px; padding:6px 10px; color:var(--accent-gold); font-size:11px; font-weight:500; white-space:nowrap; }
.procurement-material-option:hover .material-product-select { background:var(--accent-gold); color:#211b10; }
.procurement-material-empty { grid-column:1/-1; padding:60px 15px; text-align:center; color:var(--text-muted); font-size:12px; }
.procurement-material-dialog footer { padding:12px 24px; border-top:1px solid #ffffff0d; flex-shrink:0; color:var(--text-muted); font-size:11px; }

.material-product-heading { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 8px; }
.material-product-brand { color:var(--accent-gold); font-size:11px; }
.material-product-metric.missing > strong { color:var(--text-muted); }
@media (max-width:700px) { .procurement-material-option { grid-template-columns:40px minmax(0,1fr); gap:8px 10px; } .material-product-image { width:40px; height:48px; } .material-product-bottom { grid-column:2; grid-row:auto; flex-direction:row; align-items:center; justify-content:space-between; } .material-product-price small { display:inline; } }
@media (max-width:540px) { .procurement-material-mask { padding:10px; } .procurement-material-dialog { height:90dvh; border-radius:12px; } .procurement-material-dialog > header { padding:16px; } .procurement-material-search { padding:0 16px 14px; flex-wrap:wrap; } .procurement-material-search input { flex-basis:100%; } .procurement-material-search select { width:100%; } .material-catalog-layout { flex-direction:column; } .material-category-nav { flex:0 0 auto; flex-direction:row; gap:4px; padding:9px 12px; border-right:0; border-bottom:1px solid #ffffff0d; } .material-category-nav > strong { display:none; } .material-category-nav button { padding:8px 10px; white-space:nowrap; } .material-catalog-results { padding:14px; } .procurement-material-dialog footer { padding:12px 16px; } }
</style>
