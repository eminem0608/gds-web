<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { brewApi } from '../api';
import { calculateRecipe, emptyDesign, normalizeDesign, present } from '../recipe-calculations';
import WaterAdjustmentDesigner from './WaterAdjustmentDesigner.vue';
import {calculateWater} from '../water-chemistry';
import MashWorkflowDesigner from './MashWorkflowDesigner.vue';

const props = defineProps({ permissions: { type: Array, default: () => [] }, reviewVersionId: { type: String, default: '' } });
const emit = defineEmits(['review-opened']);
const canManage = computed(() => props.permissions.includes('recipe.version.manage'));
const canReview = computed(() => props.permissions.includes('recipe.version.approve'));
const recipes = ref([]), materials = ref([]), categories = ref([]), beerCategories = ref([]), products = ref([]), factories = ref([]), equipment = ref([]);
const recipeStateFilter = ref('all');
const recipeCategoryFilter = ref('all'), recipeNameSearch = ref('');
const libraryView = ref('product'), libraryTab = ref('base');
const recipeStateOptions = [
  { key: 'all', label: '全部配方' }, { key: 'submitted', label: '审核中' }, { key: 'returned', label: '已退回' },
  { key: 'active', label: '已通过' }, { key: 'draft', label: '草稿' }, { key: 'inactive', label: '历史版本' },
];
const selectedRecipe = ref(null), versions = ref([]), version = ref(null);
const productionRuns = ref([]), selectedProductionRun = ref(null);
const showVersionHistory = ref(false);
const recipeDetailsOpen = ref(true);
const newVersionRecipeId = ref(null), returnReason = ref('');
const loading = ref(false), saving = ref(false), error = ref(''), notice = ref('');
const editing = ref(false), wizard = ref(1), tab = ref('recipe'), form = ref(null), editorBody = ref(null);
const basic = ref({ product_tmpl_id: '', name: '', notes: '' });
const selectedFactoryId = ref('');
const productEditorOpen = ref(false), productSaving = ref(false), productError = ref('');
const productDraft = ref({ name: '', default_code: '', brew_beer_category_id: '', brew_beer_subcategory_id: '', brew_specification: '' });
const productSubcategories = computed(() => beerCategories.value.filter(category => String(category.parent_id?.id || category.parent_id || '') === String(productDraft.value.brew_beer_category_id)));
const design = ref(emptyDesign());
const metrics = computed(() => calculateRecipe(design.value));
const beerCategoryGroups = computed(() => beerCategories.value.filter(category => !category.parent_id).map(parent => ({
  ...parent,
  children: beerCategories.value.filter(category => String(category.parent_id?.id || category.parent_id || '') === String(parent.id)),
})));
function recipeBucket(recipe) {
  const state = recipe.latest_version_state;
  return ['submitted', 'returned', 'active', 'inactive'].includes(state) ? state : 'draft';
}
const filteredRecipes = computed(() => recipes.value.filter(recipe => {
  const matchesState = recipeStateFilter.value === 'all' || recipeBucket(recipe) === recipeStateFilter.value;
  const searchable = [recipe.product?.name, recipe.name, recipe.equipment?.name, recipe.code].join(' ').toLowerCase();
  const matchesName = !recipeNameSearch.value || searchable.includes(recipeNameSearch.value.toLowerCase());
  const matchesCategory = recipeCategoryFilter.value === 'all' || [recipe.beer_category?.id, recipe.beer_subcategory?.id].some(id => String(id || '') === recipeCategoryFilter.value);
  return matchesState && matchesName && matchesCategory;
}));
const libraryGroups = computed(() => {
  const grouped = new Map();
  for (const recipe of filteredRecipes.value) {
    const isProductView = libraryView.value === 'product';
    const relation = isProductView ? recipe.product : recipe.equipment;
    const key = String(relation?.id || `unlinked-${recipe.id}`);
    if (!grouped.has(key)) grouped.set(key, {
      key,
      title: relation?.name || (isProductView ? recipe.name : '未关联酿造系统'),
      subtitle: isProductView
        ? [recipe.beer_category?.name, recipe.beer_subcategory?.name].filter(Boolean).join(' · ') || '啤酒分类待完善'
        : '按适用的酿造系统查看基础工艺',
      recipes: [],
    });
    grouped.get(key).recipes.push(recipe);
  }
  return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
});
function recipeStateCount(key) {
  const scoped = recipes.value.filter(recipe => {
    const matchesName = !recipeNameSearch.value || (recipe.name || '').toLowerCase().includes(recipeNameSearch.value.toLowerCase());
    const matchesCategory = recipeCategoryFilter.value === 'all' || [recipe.beer_category?.id, recipe.beer_subcategory?.id].some(id => String(id || '') === recipeCategoryFilter.value);
    return matchesName && matchesCategory;
  });
  return key === 'all' ? scoped.length : scoped.filter(recipe => recipeBucket(recipe) === key).length;
}
function clearRecipeFilters() { recipeStateFilter.value = 'all'; recipeCategoryFilter.value = 'all'; recipeNameSearch.value = ''; }
function stateLabel(state) { return stateNames[state] || state || '未知状态'; }
function versionLabel(item) { return item.version_label || `基础工艺 V${String(item.version || 0).padStart(2, '0')}`; }
function formattedTime(value) { return value ? value.replace('T', ' ').slice(0, 16) : '—'; }
const editable = computed(() => canManage.value && (!version.value || ['draft', 'returned'].includes(version.value.state)));
const canSubmitForReview = computed(() => {
  if (!editable.value) return false;
  if (!['fermentables', 'hops', 'yeast'].some(key => design.value[key].length)) return false;
  try {
    validateDesign({ requireMashSteps: true });
    return true;
  } catch {
    return false;
  }
});
const system = computed(() => equipment.value.find(e => String(e.id) === String(design.value.brew_equipment_id)));
const factorySystems = computed(() => equipment.value.filter(e => String(e.brew_factory_id?.id || e.brew_factory_id || '') === String(selectedFactoryId.value)));
const chosenProduct = computed(() => products.value.find(product => String(product.id) === String(basic.value.product_tmpl_id)));
function productOptionName(product) {
  const name = product.product_name || product.name || '';
  return name.replace(/^\[[^\]]+\]\s*/, '') || name;
}
const recipeName = computed(() => selectedRecipe.value?.name || chosenProduct.value?.name || '');
const stateNames = { draft: '草稿', returned: '已退回', submitted: '待审核', approved: '已审核', active: '审核通过', inactive: '历史版本' };
function recipeStatus(recipe) {
  const latestState = recipe.latest_version_state;
  if (recipe.active_version_id) {
    return latestState && latestState !== 'active' ? `审核通过 · 新版${stateNames[latestState] || latestState}` : '审核通过';
  }
  if (!latestState) return '未建版本';
  return stateNames[latestState] || latestState;
}
function recipeStatusClass(recipe) {
  const state = recipe.latest_version_state;
  return ['active', 'approved'].includes(state) ? 'is-success'
    : ['submitted'].includes(state) ? 'is-warning'
      : ['returned', 'inactive'].includes(state) ? 'is-muted'
        : 'is-neutral';
}
function recipeOpenActionText(recipe) {
  if (canManage.value && recipe.latest_version_state === 'draft') return '编辑草稿';
  if (canManage.value && recipe.latest_version_state === 'returned') return '编辑退回版本';
  return '查看基础工艺';
}
function versionActionText(item) {
  if (canReview.value && item.state === 'submitted') return '查看 / 审核';
  if (canManage.value && ['draft', 'returned'].includes(item.state)) return '查看 / 编辑';
  return '查看配方详情';
}
const reviewSteps = ['设计配方', '提交审核', '审核结论'];
const showReviewPanel = computed(() => Boolean(version.value && (
  ['submitted', 'returned', 'approved', 'active', 'inactive'].includes(version.value.state)
  || version.value.review_history?.some(event => event.action === 'submitted')
)));
const reviewStepIndex = computed(() => ({ draft: 0, returned: 0, submitted: 1, approved: 2, active: 2, inactive: 2 }[version.value?.state] ?? 0));
const reviewActionNames = { submitted: '提交审核', approved: '审核通过', returned: '退回修改', activated: '启用版本', deactivated: '停用版本' };
function formatEventTime(value) { return value ? value.replace('T', ' ').slice(0, 16) : '时间未记录'; }
function currentReviewRound(item) {
  const submissions = (item?.review_history || []).filter(event => event.action === 'submitted');
  return submissions.length ? Math.max(...submissions.map(event => Number(event.review_round) || 1)) : 1;
}
const groups = [{ key: 'fermentables', title: '麦芽与可发酵物', add: '添加原料' }, { key: 'hops', title: '啤酒花', add: '添加酒花' }, { key: 'yeast', title: '酵母', add: '添加酵母' }];
const conditionMeta = { time: ['时间', ''], gravity: ['糖度', '°P'], attenuation: ['实际发酵度', '%'], diacetyl: ['双乙酰', 'ppm'], temperature: ['温度', '℃'], pressure: ['压力', 'bar'] };
const actions = { measure_gravity: '测量糖度', measure_temperature: '测量温度', measure_pressure: '测量压力', measure_diacetyl: '测量双乙酰', seal: '封罐', dry_hop: '干投', cool_to: '降温至', dump_hops: '排出酒花', centrifuge: '离心', increase_pressure: '升压至', package: '出酒' };
const mashFields = [{ key: 'efficiency', label: '糖化效率(%)', min: 0.1, max: 100 }, { key: 'water_grain_ratio', label: '料水比(L/kg)', min: 0.1 }, { key: 'absorption_rate', label: '麦芽吸水率(L/kg)', min: 0 }, { key: 'boil_time_min', label: '煮沸时间(min)', min: 1 }, { key: 'evaporation_rate', label: '煮沸强度(%)', min: 0, max: 100 }, { key: 'screen_water_l', label: '筛板余水(L)', min: 0 }];
const fmt = (v, digits = 1) => v === null || v === undefined ? '待计算' : Number(v).toFixed(digits);
const picker = ref(null), keyword = ref(''), supplier = ref(''), pickerCategory = ref('');
function materialGroup(item) { return categories.value.find(c => c.code === item.brew_material_category)?.material_group || item.brew_material_category; }
const pickerItems = computed(() => materials.value.filter(item => {
  const allowed = picker.value?.key === 'fermentables' ? ['malt', 'adjunct'] : picker.value?.key === 'hops' ? ['hop'] : ['yeast'];
  return item.supplier && allowed.includes(materialGroup(item)) && (!pickerCategory.value || item.brew_material_category === pickerCategory.value) && (!supplier.value || item.supplier.name === supplier.value) && [item.name, item.brew_brand, item.supplier.name, item.brew_specification].join(' ').toLowerCase().includes(keyword.value.toLowerCase());
}));
const suppliers = computed(() => [...new Set(materials.value.filter(m => m.supplier).map(m => m.supplier.name))]);
const pickerCategories = computed(() => {
  const allowed = picker.value?.key === 'fermentables' ? ['malt', 'adjunct'] : picker.value?.key === 'hops' ? ['hop'] : ['yeast'];
  return categories.value.filter(c => c.parent_id && allowed.includes(c.material_group) && materials.value.some(m => m.brew_material_category === c.code && m.supplier));
});
async function run(fn) { error.value = ''; try { await fn(); } catch (e) { error.value = e.message || '操作失败'; } }
async function allPages(fetchPage) {
  const rows = [];
  for (let page = 1; ; page++) {
    const batch = await fetchPage({ page, page_size: 100 });
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
}
async function load() {
  loading.value = true;
  await run(async () => {
    [recipes.value, materials.value, categories.value, beerCategories.value, products.value, factories.value, equipment.value] = await Promise.all([
      allPages(p => brewApi.listRecipes({ ...p, active: true })), allPages(p => brewApi.listMaster('materials', { ...p, active: true })),
      allPages(p => brewApi.listMaster('material-categories', { ...p, active: true })), allPages(p => brewApi.listMaster('beer-categories', { ...p, active: true })),
      allPages(p => brewApi.listMaster('products', { ...p, active: true })), allPages(p => brewApi.listMaster('factories', { ...p, active: true })),
      allPages(p => brewApi.listMaster('equipment', { ...p, active: true }))
    ]);
    products.value = products.value.filter(product => product.brew_item_type === 'finished_product');
    equipment.value = equipment.value.filter(e => e.brew_equipment_type === 'mash');
  });
  loading.value = false;
}
function startCreate() { newVersionRecipeId.value = null; notice.value = ''; basic.value = { product_tmpl_id: '', name: '', notes: '' }; selectedFactoryId.value = ''; design.value = emptyDesign(); version.value = null; recipeDetailsOpen.value = true; editing.value = true; wizard.value = 1; tab.value = 'recipe'; error.value = ''; }
function factoryIdForEquipment(equipmentId) {
  const item = equipment.value.find(e => String(e.id) === String(equipmentId));
  return item?.brew_factory_id?.id || item?.brew_factory_id || '';
}
function changeFactory() {
  design.value.brew_equipment_id = '';
  design.value.brew_volume_l = '';
  const defaults = emptyDesign().mash;
  design.value.mash.efficiency = defaults.efficiency;
  design.value.mash.screen_water_l = defaults.screen_water_l;
}
function openProductEditor() {
  productDraft.value = { name: '', default_code: '', brew_beer_category_id: '', brew_beer_subcategory_id: '', brew_specification: '' };
  productError.value = '';
  productEditorOpen.value = true;
}
async function createProduct() {
  productSaving.value = true;
  productError.value = '';
  try {
    const product = await brewApi.createMaster('products', {
      ...productDraft.value,
      brew_item_type: 'finished_product',
      name: productDraft.value.name.trim(),
      default_code: productDraft.value.default_code.trim(),
      brew_specification: productDraft.value.brew_specification.trim(),
    });
    products.value.push(product);
    basic.value.product_tmpl_id = product.id;
    productEditorOpen.value = false;
    error.value = '';
  } catch (cause) {
    productError.value = cause.message || '保存啤酒产品失败。';
  } finally {
    productSaving.value = false;
  }
}
function startVersion() {
  startCreate(); newVersionRecipeId.value = selectedRecipe.value.id;
  basic.value.product_tmpl_id = selectedRecipe.value.product?.id || '';
  const current = versions.value.find(item => item.state === 'active') || versions.value[0];
  design.value.brew_equipment_id = selectedRecipe.value.equipment?.id || current?.design?.brew_equipment_id || '';
  selectedFactoryId.value = factoryIdForEquipment(design.value.brew_equipment_id);
  selectSystem();
}
function selectSystem() {
  if (!system.value) return;
  const e = system.value;
  design.value.brew_volume_l = Number(e.brew_capacity_l) || design.value.brew_volume_l;
  design.value.mash.efficiency = Number(e.brew_saccharification_efficiency) || 72;
  design.value.mash.screen_water_l = Number(e.brew_screen_water_l) || 0;
  design.value.mash.workflow.whirlpool_time_min = Number(e.brew_whirlpool_time_min) || 0;
}
async function openRecipe(recipe) {
  showVersionHistory.value = false;
  await run(async () => {
    selectedRecipe.value = recipe;
    versions.value = await brewApi.listRecipeVersions(recipe.id);
    const target = (canManage.value ? versions.value.find(item => ['draft', 'returned'].includes(item.state)) : null)
      || versions.value.find(item => item.state === 'active')
      || versions.value[0];
    if (target) await loadVersion(target);
    else showVersionHistory.value = true;
  });
}
async function openVersionHistory(recipe) {
  await run(async () => {
    selectedRecipe.value = recipe;
    const [loadedVersions, loadedRuns] = await Promise.all([
      brewApi.listRecipeVersions(recipe.id),
      allPages(p => brewApi.listRecipeProductionRuns(recipe.id, p)),
    ]);
    versions.value = loadedVersions;
    productionRuns.value = loadedRuns;
    libraryTab.value = 'base';
    selectedProductionRun.value = null;
    showVersionHistory.value = true;
  });
}
async function loadVersion(item) {
    newVersionRecipeId.value = null; notice.value = ''; returnReason.value = '';
    version.value = Array.isArray(item.materials) && Array.isArray(item.process_steps) ? item : await brewApi.getRecipeVersion(item.id);
    design.value = normalizeDesign(version.value.design, version.value);
    selectedFactoryId.value = factoryIdForEquipment(design.value.brew_equipment_id || selectedRecipe.value.equipment?.id);
    basic.value = { product_tmpl_id: selectedRecipe.value.product?.id || '', name: selectedRecipe.value.name || '', notes: version.value.notes || '' };
    showVersionHistory.value = false;
    recipeDetailsOpen.value = editable.value;
    editing.value = true; wizard.value = 2; tab.value = 'recipe';
}
async function openVersion(item) {
  await run(() => loadVersion(item));
}
async function openReviewVersion(versionId) {
  await run(async () => {
    const detail = await brewApi.getRecipeVersion(versionId);
    selectedRecipe.value = await brewApi.getRecipe(detail.recipe_id);
    versions.value = await brewApi.listRecipeVersions(detail.recipe_id);
    await loadVersion(detail);
  });
  emit('review-opened');
}
function choose(key, line) { if (!editable.value) return; picker.value = { key, line }; keyword.value = ''; supplier.value = ''; pickerCategory.value = ''; }
function selectMaterial(item) {
  if (item.is_weight_uom === false) { error.value = `${item.name} 的库存单位为 ${item.uom_id?.name || '非重量单位'}，请先在供应商商品中核对并修正为 kg/g，不能直接按重量使用。`; picker.value = null; return; }
  const { key, line } = picker.value;
  Object.assign(line, { material_id: item.id, name: item.name, category: item.brew_material_category, supplier: item.supplier?.name || '', extract_rate: item.brew_extract_rate ?? '', color: item.brew_color_ebc ?? '', alpha_acid: item.brew_alpha_acid ?? '', attenuation: item.brew_extract_rate > 0 ? item.brew_extract_rate : '', flavor: item.brew_flavor_desc || '' });
  if (!design.value[key].includes(line)) design.value[key].push(line);
  picker.value = null;
}
function addLine(key) { choose(key, { material_id: '', name: '', quantity: '', temperature: '', notes: '', use: 'boil', time: 60, utilization_override: '' }); }
function removeLine(key, index) { design.value[key].splice(index, 1); }
function next() { if (form.value.reportValidity()) wizard.value = 2; }
async function openDesignTab(nextTab) {
  tab.value = nextTab;
  recipeDetailsOpen.value = true;
  await nextTick();
  editorBody.value?.scrollTo({ top: 0, behavior: 'smooth' });
}
function newStep() { return { condition: 'time', schedule_type: 'daily', day_value: 1, interval_days: 1, operator: '>=', condition_value: '', action: 'measure_gravity', target: '' }; }
function setManualWater() { design.value.mash.sparge_water_liters = [...metrics.value.spargeWaters]; design.value.mash.sparge_mode = 'manual'; }
function changeSpargeCount() { design.value.mash.sparge_mode = 'auto'; }
function changeIbuMethod() { if (design.value.ibu_method === 'fixed') design.value.hops.forEach(l => { if (l.use === 'boil' && ![60, 30, 0].includes(Number(l.time))) l.time = 60; }); }
function validateDesign({ requireMashSteps = false } = {}) {
  const d = design.value;
  const checkNumber = (value, label, min, max, optional = false) => {
    if (optional && (value === '' || value === null || value === undefined)) return;
    if (!present(value) || !Number.isFinite(Number(value)) || (min !== undefined && Number(value) < min) || (max !== undefined && Number(value) > max)) throw new Error(`请检查${label}。`);
  };
  if (!basic.value.product_tmpl_id || !d.brew_equipment_id) throw new Error('请先选择啤酒产品和酿造系统。');
  for (const f of mashFields) checkNumber(d.mash[f.key], `糖化参数：${f.label}`, f.min, f.max);
  if (!Number.isInteger(Number(d.mash.sparge_count)) || d.mash.sparge_count < 1 || d.mash.sparge_count > 10) throw new Error('洗糟次数须为 1–10 的整数。');
  if (requireMashSteps && !d.mash.steps.length) throw new Error('提交审核前，请到“糖化工艺”点击“添加糖化步骤”，至少填写一个糖化温度和时间。');
  for (const s of d.mash.steps) {
    if (!s.name?.trim()) throw new Error('请填写糖化步骤名称。');
    checkNumber(s.temperature, '糖化温度', 0, 100);
    checkNumber(s.duration_min, '糖化时间', 1);
  }
  if (!(Number(d.brew_volume_l) > 0)) throw new Error('酿造体积必须大于零。');
  if (system.value?.brew_capacity_l && d.brew_volume_l > system.value.brew_capacity_l) throw new Error('酿造体积超过设备容量。');
  for (const { key, title } of groups) for (const l of d[key]) {
    if (!l.material_id) throw new Error(`${title}需要选择商品。`);
    checkNumber(l.quantity, `${title}用量`, .001);
    if (key === 'fermentables') { checkNumber(l.extract_rate, '浸出率', 0, 100, true); checkNumber(l.color, '原料色度', 0, undefined, true); }
    if (key === 'hops') {
      checkNumber(l.alpha_acid, '酒花 α 酸', 0, 100, true);
      if (!['boil', 'FWH', '0', 'WP', 'DH'].includes(l.use)) throw new Error('请选择酒花投放阶段。');
      if (l.use === 'boil') {
        checkNumber(l.time, '酒花煮沸时长', 0, Number(d.mash.boil_time_min));
        if (!Number.isInteger(Number(l.time)) || (d.ibu_method === 'fixed' && ![60, 30, 0].includes(Number(l.time)))) throw new Error('请填写有效的酒花煮沸时长。');
      }
      checkNumber(l.utilization_override, '工艺利用率', 0, 100, !(d.ibu_method === 'tinseth' && ['FWH','WP'].includes(l.use)));
    }
    if (key === 'yeast') { checkNumber(l.attenuation, '酵母发酵度', 0, 100, true); checkNumber(l.temperature, '酵母发酵温度', undefined, undefined, true); }
  }
  if (!['tinseth', 'fixed'].includes(d.ibu_method)) throw new Error('请选择苦味值计算模式。');
  for (const [key, value] of Object.entries(d.targets)) checkNumber(value, `目标 ${key}`, key === 'fg' ? .9 : key === 'og' ? 1 : 0, key === 'og' ? 1.3 : undefined, true);
  checkNumber(d.attenuation_override, '预计发酵度', 0, 100, true);
  checkNumber(d.fermentation.target_temperature, '目标发酵温度', undefined, undefined, true);
  checkNumber(d.fermentation.target_days, '目标发酵天数', 0, undefined, true);
  checkNumber(d.fermentation.cold_storage_temperature, '冷储温度', undefined, undefined, true);
  if (d.hops.some(l => l.use === 'boil' && Number(l.time) > Number(d.mash.boil_time_min))) throw new Error('酒花煮沸时长不能超过总煮沸时间。');
  if (d.ibu_method === 'tinseth' && d.hops.some(l => ['FWH', 'WP'].includes(l.use) && !present(l.utilization_override))) throw new Error('FWH/WP 请填写本次工艺的利用率，或选择原稿固定异构率模式。');
  if (d.mash.sparge_mode === 'manual' && d.mash.sparge_water_liters.some(value => !present(value) || value < 0)) throw new Error('请为每次洗糟填写有效的用水量。');
  if (d.mash.sparge_mode === 'manual' && Math.abs(metrics.value.spargeDifference) > .005) throw new Error('每次洗糟水量合计应与计算总量一致，请调整或恢复自动分配。');
  if(d.water_adjustment?.enabled){
    const water=d.water_adjustment;
    if(String(water.source?.factory_id)!==String(selectedFactoryId.value))throw new Error('水源所属酒厂须与配方一致。');
    if(water.source_mode==='override'&&!water.override_note?.trim())throw new Error('请填写原水修改依据。');
    if(!water.target?.name?.trim())throw new Error('请填写目标水质方案名称。');
    calculateWater(water,water.stages.mash,metrics.value.mashWater);
    if(metrics.value.actualSparge>0)calculateWater(water,water.stages.sparge,metrics.value.actualSparge);
  }
  for (const s of d.fermentation.steps) {
    if (!conditionMeta[s.condition] || !actions[s.action]) throw new Error('请选择发酵触发条件和处理动作。');
    if (s.condition === 'time' && !['daily', 'day', 'interval'].includes(s.schedule_type)) throw new Error('旧版本的时间选项未正确保存，请重新选择每天、第几天或每隔几天。');
    if (s.condition !== 'time' && !present(s.condition_value)) throw new Error('请填写发酵条件达成值。');
    if (s.condition === 'time' && s.schedule_type !== 'daily' && !(Number(s[s.schedule_type === 'day' ? 'day_value' : 'interval_days']) >= 1)) throw new Error('发酵时间须填写大于等于 1 的天数。');
    if (s.condition === 'time' && s.schedule_type !== 'daily' && !Number.isInteger(Number(s[s.schedule_type === 'day' ? 'day_value' : 'interval_days']))) throw new Error('发酵时间须为整数天。');
    if (s.condition !== 'time') { checkNumber(s.condition_value, '发酵条件达成值'); if (!['=','>','>=','<','<='].includes(s.operator)) throw new Error('请选择条件比较符。'); }
    if (['cool_to', 'increase_pressure'].includes(s.action) && !present(s.target)) throw new Error('降温、升压动作需要填写数值目标。');
    if (['cool_to', 'increase_pressure'].includes(s.action)) checkNumber(s.target, '处理目标值');
  }
}
function payload() {
  const d = JSON.parse(JSON.stringify(design.value));
  d.schema_version = 2; d.calculation_version = d.mash.water_calculation === 'original' ? '2026-10-28-original' : '2026-09-24';
  d.mash.sparge_water_liters = [...metrics.value.spargeWaters];
  const total = metrics.value.totalQuantity;
  d.fermentables.forEach(l => { l.ratio = total ? Number(l.quantity) / total * 100 : 0; });
  d.calculated = { ...metrics.value };
  return { base_volume_l: Number(d.brew_volume_l), original_gravity: Number(d.targets.og) || 0, final_gravity: Number(d.targets.fg) || 0, bitterness_ibu: Number(d.targets.ibu) || 0, color_ebc: Number(d.targets.color) || 0, alcohol_abv: Number(d.targets.abv) || 0, notes: basic.value.notes, design: d };
}
async function persistDraft() {
  if (version.value) version.value = await brewApi.updateRecipeVersion(version.value.id, { ...payload(), record_version: version.value.record_version });
  else if (newVersionRecipeId.value) version.value = await brewApi.createRecipeVersion(newVersionRecipeId.value, payload());
  else {
    const recipe = await brewApi.createRecipe({ name: basic.value.name.trim(), product_tmpl_id: Number(basic.value.product_tmpl_id), equipment_id: Number(design.value.brew_equipment_id), initial_version: payload() });
    selectedRecipe.value = recipe;
    version.value = recipe.initial_version;
  }
  if (!version.value?.id) throw new Error('后端未返回配方版本，请刷新服务后重试。');
}
async function save() {
  if (wizard.value === 1) { next(); return; }
  if (!editable.value || saving.value || !form.value.reportValidity()) return;
  saving.value = true;
  await run(async () => {
    validateDesign();
    await persistDraft();
    const reloaded = await brewApi.getRecipeVersion(version.value.id);
    version.value = reloaded; design.value = normalizeDesign(reloaded.design, reloaded);
    versions.value = await brewApi.listRecipeVersions(selectedRecipe.value.id);
    recipes.value = await allPages(p => brewApi.listRecipes({ ...p, active: true }));
    notice.value = '配方草稿已保存并重新读取，原料和工艺明细已同步。';
    editing.value = false;
    picker.value = null;
  });
  saving.value = false;
}
async function action(name) {
  if (saving.value) return;
  if (name === 'submit' && (!canSubmitForReview.value || !form.value.reportValidity())) return;
  let completed = false;
  saving.value = true;
  await run(async () => {
    if (name === 'return' && !returnReason.value.trim()) throw new Error('请填写退回原因。');
    if (name === 'submit') {
      if (!design.value.mash.steps.length) await openDesignTab('mash');
      validateDesign({ requireMashSteps: true });
      await persistDraft();
    }
    const id = version.value.id;
    await brewApi.recipeVersionAction(id, name, version.value.record_version, name === 'return' ? returnReason.value : '', returnReason.value);
    version.value = await brewApi.getRecipeVersion(id);
    versions.value = await brewApi.listRecipeVersions(selectedRecipe.value.id);
    recipes.value = await allPages(p => brewApi.listRecipes({ ...p, active: true }));
    notice.value = `版本状态：${stateNames[version.value.state]}`;
    completed = true;
  });
  saving.value = false;
  if (completed && ['approve', 'return'].includes(name)) {
    editing.value = false;
    picker.value = null;
  }
}
async function copyVersion(item) { await run(async () => { const copy = await brewApi.copyRecipeVersion(item.id); await openVersion(copy); versions.value = await brewApi.listRecipeVersions(selectedRecipe.value.id); }); }
async function deleteRecipe(recipe) {
  if (saving.value || !window.confirm(`确定删除配方工艺“${recipe.name}”及其所有草稿版本吗？删除后无法恢复。`)) return;
  saving.value = true;
  await run(async () => {
    await brewApi.deleteRecipe(recipe.id, recipe.version);
    recipes.value = await allPages(p => brewApi.listRecipes({ ...p, active: true }));
    if (selectedRecipe.value?.id === recipe.id) { selectedRecipe.value = null; showVersionHistory.value = false; }
    notice.value = '配方工艺已删除。';
  });
  saving.value = false;
}
onMounted(() => {
  load();
  if (props.reviewVersionId) openReviewVersion(props.reviewVersionId);
});
watch(() => props.reviewVersionId, (versionId) => {
  if (versionId) openReviewVersion(versionId);
});
</script>

<template>
  <div class="recipe-workspace">
    <div class="panel">
      <div class="panel-header rw-compact-heading"><div class="rw-library-title"><span class="panel-title">配方工艺库</span></div><div class="rw-heading-tools"><div class="rw-recipe-filter-tools"><label class="rw-recipe-search"><span class="rw-search-icon" aria-hidden="true">⌕</span><input v-model.trim="recipeNameSearch" type="search" placeholder="搜索啤酒、工艺或酿造系统" aria-label="搜索啤酒、工艺或酿造系统"><button v-if="recipeNameSearch" type="button" aria-label="清空搜索" @click="recipeNameSearch = ''">×</button></label><label class="rw-category-select"><span>啤酒分类</span><select v-model="recipeCategoryFilter" aria-label="按啤酒分类筛选"><option value="all">全部分类</option><template v-for="category in beerCategoryGroups" :key="category.id"><option :value="String(category.id)">{{ category.name }}（全部种类）</option><optgroup v-if="category.children.length" :label="category.name"><option v-for="child in category.children" :key="child.id" :value="String(child.id)">{{ child.name }}</option></optgroup></template></select></label><button v-if="recipeStateFilter !== 'all' || recipeCategoryFilter !== 'all' || recipeNameSearch" type="button" class="rw-clear-filters" @click="clearRecipeFilters">清除筛选</button></div><button class="btn btn-sm btn-secondary" :disabled="loading" @click="load">刷新</button><button v-if="canManage" class="btn btn-sm btn-primary" @click="startCreate">新建基础工艺</button></div></div>
      <div v-if="notice" class="rw-notice" role="status">{{ notice }}</div>
      <div v-if="error && !editing" class="master-error" role="alert">{{ error }}</div>
      <div class="rw-library-controls">
        <div class="rw-library-view-switch" role="group" aria-label="工艺库分组方式">
          <button type="button" :class="{ active: libraryView === 'product' }" @click="libraryView = 'product'">按啤酒查看</button>
          <button type="button" :class="{ active: libraryView === 'equipment' }" @click="libraryView = 'equipment'">按酿造系统查看</button>
        </div><span class="rw-library-count">{{ filteredRecipes.length }} 套基础工艺 · {{ libraryGroups.length }} 个{{ libraryView === 'product' ? '啤酒' : '酿造系统' }}</span>
      </div>

      <div class="rw-recipe-filters" role="group" aria-label="按配方状态筛选"><button v-for="option in recipeStateOptions" :key="option.key" type="button" :aria-pressed="recipeStateFilter === option.key" :class="{ active: recipeStateFilter === option.key }" @click="recipeStateFilter = option.key"><span>{{ option.label }}</span><b>{{ recipeStateCount(option.key) }}</b></button></div>
      <div class="rw-library-groups">
        <div v-if="loading" class="empty">正在整理工艺库…</div>
        <div v-else-if="!filteredRecipes.length" class="rw-library-empty">
          <span>✦</span><strong>{{ recipes.length ? '没有符合条件的工艺' : '工艺库还是空的' }}</strong>
          <small>{{ recipes.length ? '试试调整搜索词或筛选条件。' : '新建基础工艺后，会在这里按啤酒和酿造系统归档。' }}</small>
        </div>
        <section v-for="group in libraryGroups" :key="group.key" class="rw-library-group">
          <header><div><h3>{{ group.title }}</h3><p>{{ group.subtitle }}</p></div><span>{{ group.recipes.length }} 套基础工艺</span></header>
          <article v-for="recipe in group.recipes" :key="recipe.id" class="rw-library-recipe">
            <div class="rw-library-recipe-icon" aria-hidden="true">{{ libraryView === 'product' ? '啤' : '酿' }}</div>
            <div class="rw-library-recipe-main">
              <div class="rw-library-recipe-title"><strong>{{ recipe.name || recipe.product?.name }}</strong><span class="rw-status-chip" :class="recipeStatusClass(recipe)">{{ recipeStatus(recipe) }}</span></div>
              <div class="rw-library-recipe-meta"><span>{{ recipe.equipment?.name || '酿造系统待关联' }}</span><i>·</i><span>{{ recipe.beer_category?.name || '未分类' }}{{ recipe.beer_subcategory?.name ? ` / ${recipe.beer_subcategory.name}` : '' }}</span><i>·</i><span>{{ recipe.code }}</span></div>
              <div class="rw-library-recipe-version"><span>生产基准</span><b>{{ recipe.active_version_id ? '审核通过' : recipe.latest_version_state ? stateLabel(recipe.latest_version_state) : '尚无版本' }}</b></div>
            </div>
            <div class="rw-library-recipe-actions"><button class="btn btn-outline" type="button" @click="openVersionHistory(recipe)">工艺与批次</button>
            <button class="btn btn-secondary" type="button" @click="openRecipe(recipe)">{{ recipeOpenActionText(recipe) }}</button>
            <button v-if="canManage && (!recipe.latest_version_state || recipe.latest_version_state === 'draft')" class="btn rw-recipe-delete" type="button" :disabled="saving" @click="deleteRecipe(recipe)">删除</button></div>
          </article>
        </section>
      </div>
    </div>
    <section v-if="selectedRecipe && showVersionHistory" class="panel rw-library-detail">
      <header class="rw-library-detail-heading">
        <div><div class="rw-library-kicker">工艺档案</div><h2>{{ selectedRecipe.product?.name || selectedRecipe.name }}</h2>
          <p>{{ selectedRecipe.beer_category?.name || '未分类' }}{{ selectedRecipe.beer_subcategory?.name ? ` / ${selectedRecipe.beer_subcategory.name}` : '' }} · {{ selectedRecipe.equipment?.name || '酿造系统未关联' }} · {{ selectedRecipe.code }}</p>
        </div>
        <div class="rw-library-detail-actions"><button v-if="canManage" class="btn btn-primary" @click="startVersion">新建基础版本</button><button class="btn btn-secondary" @click="showVersionHistory = false; selectedProductionRun = null">关闭档案</button></div>
      </header>
      <div class="rw-library-stats"><div><span>基础工艺版本</span><strong>{{ versions.length }}</strong></div><div><span>生产版本</span><strong>{{ productionRuns.length }}</strong></div><div><span>当前生产基准</span><strong>{{ selectedRecipe.active_version_id ? versionLabel(versions.find(item => item.id === selectedRecipe.active_version_id) || {}) : '未启用' }}</strong></div></div>
      <nav class="rw-library-tabs" aria-label="工艺档案内容"><button type="button" :class="{ active: libraryTab === 'base' }" @click="libraryTab = 'base'; selectedProductionRun = null">基础工艺版本 <b>{{ versions.length }}</b></button><button type="button" :class="{ active: libraryTab === 'production' }" @click="libraryTab = 'production'; selectedProductionRun = null">生产版本 <b>{{ productionRuns.length }}</b></button></nav>
      <div v-if="libraryTab === 'base'" class="rw-version-list">
        <article v-for="item in versions" :key="item.id" class="rw-version-card"><div class="rw-version-mark base">B</div><div class="rw-version-content">
          <div class="rw-version-heading"><strong>{{ versionLabel(item) }}</strong><span class="rw-status-chip" :class="item.state === 'active' ? 'is-success' : item.state === 'submitted' ? 'is-warning' : ['returned','inactive'].includes(item.state) ? 'is-muted' : 'is-neutral'">{{ stateNames[item.state] || item.state }}</span><span v-if="String(item.id) === String(selectedRecipe.active_version_id)" class="rw-current-tag">当前生产基准</span></div>
          <p>{{ item.name }}{{ item.notes ? ` · ${item.notes}` : '' }}</p><small>基础配方体积 {{ item.base_volume_l }} L{{ item.record_version ? ` · 更新于 ${formattedTime(item.record_version)}` : '' }}</small>
        </div><div class="rw-version-actions"><button class="btn btn-outline" type="button" @click="openVersion(item)">{{ versionActionText(item) }}</button><button v-if="canManage" class="btn btn-secondary" type="button" @click="copyVersion(item)">复制新版本</button></div></article>
        <div v-if="!versions.length" class="rw-library-empty compact"><strong>还没有基础工艺版本</strong><small>为这套啤酒和酿造系统建立第一个工艺版本。</small></div>
      </div>
      <div v-else class="rw-production-list">
        <article v-for="run in productionRuns" :key="run.id" class="rw-production-card" :class="{ selected: selectedProductionRun?.id === run.id }">
          <div class="rw-version-mark production">P</div><div class="rw-production-content">
            <div class="rw-version-heading"><strong>{{ run.version_label }}</strong><span class="rw-status-chip" :class="run.state === 'completed' ? 'is-success' : ['in_progress','in_tank'].includes(run.state) ? 'is-warning' : 'is-neutral'">{{ ({ draft: '待生产', in_progress: '生产中', in_tank: '已进罐', completed: '已完成', cancelled: '已取消' })[run.state] || run.state }}</span></div>
            <div class="rw-production-meta"><span>生产计划 <b>{{ run.plan?.name || '—' }}</b></span><span>批次 <b>{{ run.name }}</b></span><span>目标罐 <b>{{ run.tank?.name || '—' }}</b></span><span>生产设备 <b>{{ run.equipment?.name || '—' }}</b></span><span>计划体积 <b>{{ Number(run.planned_volume_l || 0).toLocaleString() }} L</b></span><span>实际体积 <b>{{ run.actual_volume_l ? `${Number(run.actual_volume_l).toLocaleString()} L` : '尚未记录' }}</b></span><span>计划开始 <b>{{ formattedTime(run.planned_start) }}</b></span></div>
            <small>来源：{{ run.base_version?.label || '基础工艺版本信息缺失' }}</small>
          </div><button class="btn btn-outline" type="button" @click="selectedProductionRun = selectedProductionRun?.id === run.id ? null : run">{{ selectedProductionRun?.id === run.id ? '收起快照' : '查看工艺快照' }}</button>
        </article>
        <div v-if="!productionRuns.length" class="rw-library-empty compact"><strong>这套基础工艺还没有生产版本</strong><small>在生产计划中调整并保存配方设计后，专属版本会显示在这里。</small></div>
        <section v-if="selectedProductionRun" class="rw-production-snapshot">
          <header><div><span>生产批次工艺快照</span><h3>{{ selectedProductionRun.name }}</h3></div><span>{{ selectedProductionRun.base_version?.label || '来源版本未知' }}</span></header>
          <div class="rw-snapshot-stats"><div><small>生产计划</small><strong>{{ selectedProductionRun.plan?.name || '—' }}</strong></div><div><small>酿造系统</small><strong>{{ selectedRecipe.equipment?.name || '—' }}</strong></div><div><small>计划 / 实际产量</small><strong>{{ Number(selectedProductionRun.planned_volume_l || 0).toLocaleString() }} / {{ selectedProductionRun.actual_volume_l ? Number(selectedProductionRun.actual_volume_l).toLocaleString() : '—' }} L</strong></div></div>
          <div v-if="selectedProductionRun.recipe_snapshot?.design?.targets" class="rw-snapshot-stats"><div><small>目标 OG</small><strong>{{ selectedProductionRun.recipe_snapshot.design.targets.og || '—' }}</strong></div><div><small>目标 IBU</small><strong>{{ selectedProductionRun.recipe_snapshot.design.targets.ibu || '—' }}</strong></div><div><small>目标 ABV</small><strong>{{ selectedProductionRun.recipe_snapshot.design.targets.abv ? `${selectedProductionRun.recipe_snapshot.design.targets.abv}%` : '—' }}</strong></div></div>
          <div v-if="selectedProductionRun.recipe_snapshot?.process_steps?.length" class="rw-snapshot-steps"><strong>工艺步骤</strong><ol><li v-for="step in selectedProductionRun.recipe_snapshot.process_steps" :key="`${step.sequence}-${step.name}`"><span>{{ step.name }}</span><small>{{ step.phase || step.action_type }}</small></li></ol></div>
          <div v-if="selectedProductionRun.material_snapshot?.materials?.length" class="rw-snapshot-materials"><strong>计划投料快照</strong><span v-for="line in selectedProductionRun.material_snapshot.materials" :key="line.material_id">{{ line.material_name }} · {{ Number(line.quantity || 0).toFixed(2) }} {{ line.uom_name }}</span></div>
          <p v-if="!selectedProductionRun.recipe_snapshot?.design && !selectedProductionRun.recipe_snapshot?.process_steps?.length" class="rw-snapshot-legacy">此批次使用旧版快照，保留了来源工艺版本与生产信息。</p>
        </section>
      </div>
    </section>

    <form v-if="editing" ref="form" class="equipment-modal-mask rw-mask" @submit.prevent="save">
      <div class="equipment-modal rw-modal" :class="{ 'rw-basic-modal': wizard === 1 }">
        <div class="equipment-modal-header"><div><div class="modal-title">{{ version ? recipeName + ' · ' + stateNames[version.state] : '新增配方工艺' }}</div><div class="modal-subtitle">{{ wizard === 1 ? '选择啤酒产品、酒厂和酿造系统，再开始设计配方。' : '配置原料、糖化与发酵工艺，完成后保存草稿。' }}</div></div><button type="button" class="equipment-close" aria-label="关闭配方编辑" :disabled="saving" @click="editing = false; picker = null">×</button></div>
        <div ref="editorBody" class="rw-body">
          <div v-if="error" class="master-error" role="alert">{{ error }}</div>
          <div v-if="notice && version" class="rw-notice" role="status">{{ notice }}</div>
          <fieldset :disabled="!editable || saving">
            <div v-if="wizard === 1" class="rw-basic">
              <ol class="rw-progress" aria-label="配方创建步骤"><li aria-current="step"><b>01</b><span>基础信息</span></li><li><b>02</b><span>配方与工艺设计</span></li></ol>
              <div class="rw-basic-grid">
                <section class="rw-basic-card" aria-labelledby="rw-beer-heading">
                  <div class="rw-basic-heading"><h3 id="rw-beer-heading">啤酒产品</h3><p>选择已有产品，或在这里新增啤酒产品；产品分类会自动带出。</p></div>
                  <div class="rw-basic-fields">
                    <label class="rw-field-wide"><span>啤酒产品 *</span><select v-model="basic.product_tmpl_id" :class="{ 'rw-placeholder': !basic.product_tmpl_id }" :disabled="!!version || !!newVersionRecipeId" required><option value="">请选择啤酒产品</option><option v-for="p in products" :key="p.id" :value="p.id">{{ productOptionName(p) }}</option></select></label>
                    <button v-if="!version && !newVersionRecipeId && canManage" class="btn btn-xs btn-outline rw-add-product" type="button" @click="openProductEditor">＋ 新增啤酒产品</button>
                    <label><span>啤酒大类</span><input :value="chosenProduct?.brew_beer_category_id?.name || selectedRecipe?.beer_category?.name || '—'" readonly></label>
                    <label><span>啤酒小类</span><input :value="chosenProduct?.brew_beer_subcategory_id?.name || selectedRecipe?.beer_subcategory?.name || '—'" readonly></label>
                    <label v-if="!version && !newVersionRecipeId" class="rw-field-wide"><span>配方名称（选填）</span><input v-model.trim="basic.name" maxlength="100" placeholder="例如：经典拉格 · 夏季版"></label>
                    <p v-if="!version && !newVersionRecipeId" class="rw-field-wide rw-field-hint">用于区分同一啤酒产品在同一酿造系统下的不同配方；留空则使用产品名称。</p>
                  </div>
                </section>
                <section class="rw-basic-card" aria-labelledby="rw-batch-heading">
                  <div class="rw-basic-heading"><h3 id="rw-batch-heading">酿造设置</h3><p>先指定酒厂，再选择该酒厂的酿造系统。</p></div>
                  <div class="rw-basic-fields">
                    <label class="rw-field-wide"><span>酒厂 *</span><select v-model="selectedFactoryId" :class="{ 'rw-placeholder': !selectedFactoryId }" :disabled="!!version || !!newVersionRecipeId" required @change="changeFactory"><option value="">请选择酒厂</option><option v-for="factory in factories" :key="factory.id" :value="factory.id">{{ factory.name }}</option></select></label>
                    <label class="rw-field-wide"><span>使用设备 *</span><select v-model="design.brew_equipment_id" :class="{ 'rw-placeholder': !design.brew_equipment_id }" :disabled="!!version || !!newVersionRecipeId || !selectedFactoryId" required @change="selectSystem"><option value="">{{ !selectedFactoryId ? '请先选择酒厂' : factorySystems.length ? '请选择酿造系统' : '该酒厂暂无可用酿造系统' }}</option><option v-for="e in factorySystems" :key="e.id" :value="e.id">{{ e.name }} · {{ e.brew_capacity_l }} L</option></select></label>
                    <label><span>酿造体积(L)</span><output class="rw-volume-value" :class="{ 'rw-placeholder': !design.brew_equipment_id || !present(design.brew_volume_l) }">{{ design.brew_equipment_id && present(design.brew_volume_l) ? design.brew_volume_l : '选择设备后自动显示' }}</output></label>
                    <label><span>目标 OG（SG，选填）</span><input v-model.number="design.targets.og" type="number" min="1" max="1.3" step="0.001" placeholder="例如 1.050"></label>
                  </div>
                </section>
              </div>
              <div class="rw-basic-help"><span>带 * 的项目为必填项</span><p>酿造体积由所选设备自动带入。目标 OG 可暂不填写。</p></div>
            </div>
          </fieldset>
          <template v-if="wizard === 2">
            <section v-if="showReviewPanel" class="rw-review-panel" aria-label="配方审核流程">
              <div class="rw-review-heading"><div><strong>审核流程</strong><span>每次提交、审核意见和再次提交都会留痕</span></div><span class="rw-review-state">{{ stateNames[version.state] }}</span></div>
              <div class="rw-review-steps"><div v-for="(step,index) in reviewSteps" :key="step" class="rw-review-step" :class="{ done: index < reviewStepIndex, current: index === reviewStepIndex }"><span class="rw-review-dot">{{ index < reviewStepIndex ? '✓' : index + 1 }}</span><strong>{{ step }}</strong></div></div>
              <div v-if="version.state === 'returned'" class="rw-review-returned"><strong>本轮已退回</strong><span>{{ version.return_reason || '请查看下方审核记录，修改后重新提交。' }}</span></div>
              <div class="rw-review-history"><div class="rw-review-history-title">处理记录</div><div v-if="version.review_history?.length" class="rw-review-timeline"><article v-for="(event,index) in version.review_history" :key="`${event.review_round}-${event.action}-${index}`" class="rw-review-event" :class="`event-${event.action}`"><span class="rw-review-marker"></span><div class="rw-review-event-head"><strong>{{ reviewActionNames[event.action] || event.action }}</strong><span>第 {{ event.review_round }} 轮</span></div><div class="rw-review-event-meta">{{ event.actor_name }} · {{ formatEventTime(event.at) }}</div><p v-if="event.comment" class="rw-review-comment">{{ event.comment }}</p></article></div><div v-else class="rw-review-empty">尚无审核记录。提交审核后，处理记录会显示在这里。</div></div>
            </section>
            <details class="rw-design-disclosure" :class="{ 'is-readonly': !editable }" :open="recipeDetailsOpen" @toggle="recipeDetailsOpen = $event.currentTarget.open">
              <summary><span><strong>配方设计与工艺详情</strong><small>{{ editable ? '原料组成、糖化参数和发酵步骤' : '审核查看模式 · 配方内容仅供查看' }}</small></span><b>{{ recipeDetailsOpen ? '收起详情' : '展开详情' }}</b></summary>
              <div class="rw-design-content">
                <div v-if="!editable" class="rw-readonly-note"><span>只读查看</span>配方设计和工艺参数已锁定，审核期间无法修改。</div>
            <div class="rw-tabs"><button v-for="t in [['recipe','配方设计'],['mash','糖化工艺'],['water','酿造水调节'],['fermentation','发酵工艺']]" :key="t[0]" type="button" :class="{ active: tab === t[0] }" @click="openDesignTab(t[0])">{{ t[1] }}</button></div>
            <fieldset :disabled="(!editable || saving) && tab !== 'mash'">
              <div v-if="tab === 'recipe'" class="rw-sections">
                <section v-for="group in groups" :key="group.key" class="rw-section">
                  <div class="rw-heading"><div class="rw-heading-title"><strong>{{ group.title }}</strong><template v-if="group.key === 'hops'"><select v-model="design.ibu_method" class="rw-ibu-method" aria-label="苦味值计算模式" @change="changeIbuMethod"><option value="tinseth">IBU · Tinseth</option><option value="fixed">IBU · 固定异构率</option></select><details class="rw-ibu-help"><summary aria-label="苦味值计算说明">ⓘ</summary><p>Tinseth 根据煮沸时长与比重计算；煮沸时长为投放后继续煮沸的分钟数。DH 不计入预计 IBU，FWH / WP 需填写工艺利用率。</p></details></template></div><button type="button" class="btn btn-outline" @click="addLine(group.key)">＋ {{ group.add }}</button></div>
                  <div class="rw-table-scroll"><table class="rw-table">
                    <colgroup v-if="group.key === 'fermentables'"><col style="width:28%"><col style="width:12%"><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:20%"><col style="width:6%"></colgroup>
                    <colgroup v-else-if="group.key === 'hops'"><col style="width:25%"><col style="width:11%"><col style="width:11%"><col style="width:15%"><col style="width:12%"><col style="width:11%"><col style="width:9%"><col style="width:6%"></colgroup>
                    <colgroup v-else><col style="width:27%"><col style="width:12%"><col style="width:12%"><col style="width:15%"><col style="width:28%"><col style="width:6%"></colgroup>
                    <thead><tr><th>供应商商品</th><th>数量({{ group.key === 'fermentables' ? 'kg' : 'g' }})</th><template v-if="group.key === 'fermentables'"><th>比例(%)</th><th>浸出率(%)</th><th>色度(EBC)</th><th>备注</th></template><template v-else-if="group.key === 'hops'"><th>Alpha酸(%)</th><th>投放阶段</th><th>煮沸时长(min)</th><th>利用率(%)</th><th>预计 IBU</th></template><template v-else><th>发酵度(%)</th><th>发酵温度(℃)</th><th>风味描述</th></template><th>操作</th></tr></thead>
                    <tbody><tr v-for="(line, index) in design[group.key]" :key="index"><td><button v-if="editable" type="button" class="rw-picker" @click="choose(group.key, line)"><strong>{{ line.name || '点击选择商品' }}</strong><small>{{ line.supplier || '供应商商品库' }} · 更换 ›</small></button><div v-else class="rw-picker-display"><strong>{{ line.name || '未选择商品' }}</strong><small>{{ line.supplier || '供应商未填写' }}</small></div></td><td><input v-model.number="line.quantity" type="number" min="0.001" step="any" required aria-label="原料数量"></td>
                      <template v-if="group.key === 'fermentables'"><td>{{ fmt(metrics.totalQuantity ? line.quantity / metrics.totalQuantity * 100 : 0, 2) }}</td><td>{{ line.extract_rate }}</td><td>{{ line.color }}</td><td><input v-model="line.notes" aria-label="原料备注"></td></template>
                      <template v-else-if="group.key === 'hops'"><td>{{ line.alpha_acid }}</td><td><select v-model="line.use" aria-label="投放阶段"><option value="boil">煮沸</option><option value="FWH">FWH 首麦汁</option><option value="0">0 熄火</option><option value="WP">WP 回旋</option><option value="DH">DH 干投</option></select></td><td><template v-if="line.use === 'boil'"><select v-if="design.ibu_method === 'fixed'" v-model="line.time" aria-label="煮沸时长"><option :value="60">60</option><option :value="30">30</option><option :value="0">0</option></select><input v-else v-model.number="line.time" required type="number" min="0" :max="design.mash.boil_time_min" step="1" aria-label="煮沸时长"></template><span v-else>—</span></td><td><input v-if="design.ibu_method === 'tinseth' && ['FWH','WP'].includes(line.use)" v-model.number="line.utilization_override" required type="number" min="0" max="100" step="0.1" placeholder="工艺值" aria-label="工艺利用率"><span v-else>{{ fmt(metrics.hopResults[index].utilization, 2) }}</span></td><td>{{ fmt(metrics.hopResults[index].ibu) }}</td></template>
                      <template v-else><td>{{ present(line.attenuation) ? line.attenuation : '未提供' }}</td><td><input v-model.number="line.temperature" type="number" step="0.1" aria-label="发酵温度"></td><td class="rw-flavor">{{ line.flavor || '供应商未填写' }}</td></template>
                      <td><button type="button" class="btn btn-danger" aria-label="删除原料" @click="removeLine(group.key, index)">×</button></td></tr><tr v-if="!design[group.key].length"><td :colspan="group.key === 'hops' ? 8 : group.key === 'fermentables' ? 7 : 6" class="empty">点击右上角“{{ group.add }}”选择供应商商品</td></tr></tbody>
                  </table></div>
                  <div v-if="group.key === 'fermentables'" class="rw-summary"><span>麦芽总量 <b>{{ fmt(metrics.totalQuantity, 2) }} kg</b></span><span>预计 OG <b>{{ fmt(metrics.og, 3) }}</b></span><span>预计色度 <b>{{ fmt(metrics.color) }} EBC</b></span></div>
                  <div v-if="group.key === 'hops'" class="rw-summary"><span>酒花总量 <b>{{ fmt(design.hops.reduce((s,l) => s + Number(l.quantity || 0), 0)) }} g</b></span><span>预计 IBU <b>{{ fmt(metrics.ibu) }}</b></span></div>
                </section>
                <section class="rw-section"><div class="rw-heading"><strong>配方预计结果</strong><span class="rw-hint">预计值，不代表实测结果</span></div><div class="rw-summary"><span v-for="[key,label,digits] in [['og','OG（SG）',3],['fg','FG（SG）',3],['ibu','IBU',1],['color','色度（EBC）',1],['abv','酒精度（% ABV）',1]]" :key="key">{{ label }}<b>{{ fmt(metrics[key],digits) }}</b></span></div></section>
              </div>
              <div v-if="tab === 'mash'" class="rw-sections"><MashWorkflowDesigner :mash="design.mash" :metrics="metrics" :read-only="!editable || saving" /></div>
              <WaterAdjustmentDesigner v-if="tab==='water'" v-model="design.water_adjustment" :factory-id="selectedFactoryId" :product-id="basic.product_tmpl_id || selectedRecipe?.product?.id" :mash-volume="metrics.mashWater" :sparge-volume="metrics.actualSparge" :read-only="!editable || saving" />
              <div v-if="tab === 'fermentation'" class="rw-sections">
                <section class="rw-section"><div class="rw-fields"><label><span>目标发酵温度(℃)</span><input v-model.number="design.fermentation.target_temperature" type="number" step="0.1"></label><label><span>目标发酵天数</span><input v-model.number="design.fermentation.target_days" type="number" min="0" step="0.5"></label><label><span>冷储温度(℃)</span><input v-model.number="design.fermentation.cold_storage_temperature" type="number" step="0.1"></label></div></section>
                <section class="rw-section rw-fermentation-section">
                  <div class="rw-heading"><div class="rw-fermentation-heading"><strong>发酵执行条件</strong><small>为每条规则设置触发条件、执行频率和处理动作</small></div><button type="button" class="btn btn-outline" @click="design.fermentation.steps.push(newStep())">＋ 添加步骤</button></div>
                  <div v-if="design.fermentation.steps.length" class="rw-fermentation-list">
                    <div class="rw-fermentation-table-head"><span>步骤</span><span>触发条件</span><span>执行频率 / 达成标准</span><span>处理动作</span><span>处理目标值</span></div>
                    <article v-for="(s,i) in design.fermentation.steps" :key="i" class="rw-fermentation-card">
                      <header><strong>步骤 {{ String(i+1).padStart(2,'0') }}</strong></header>
                      <div class="rw-fermentation-grid">
                        <div class="rw-fermentation-field"><select v-model="s.condition" aria-label="触发条件" @change="s.condition_value = ''"><option v-for="(meta,key) in conditionMeta" :key="key" :value="key">{{ meta[0] }}</option></select></div>
                        <div class="rw-fermentation-field">
                          <div v-if="!editable" class="rw-fermentation-condition-text">
                            <span v-if="s.condition === 'time'">{{ s.schedule_type === 'daily' ? '每天执行一次' : s.schedule_type === 'day' ? `第 ${s.day_value} 天执行` : `每隔 ${s.interval_days} 天执行一次` }}</span>
                            <template v-else><span class="rw-fermentation-operator">{{ ({ '>=': '≥', '<=': '≤' })[s.operator] || s.operator }}</span><span class="rw-fermentation-condition-number">{{ s.condition_value }}</span><span>{{ conditionMeta[s.condition][1] }}</span></template>
                          </div>
                          <div v-else-if="s.condition === 'time'" class="rw-fermentation-schedule">
                            <select v-model="s.schedule_type" aria-label="执行频率"><option value="daily">每天</option><option value="day">第几天</option><option value="interval">每隔几天</option></select>
                            <template v-if="s.schedule_type !== 'daily'"><input v-if="s.schedule_type === 'day'" v-model.number="s.day_value" type="number" min="1" step="1" required aria-label="第几天"><input v-else v-model.number="s.interval_days" type="number" min="1" step="1" required aria-label="每隔几天"><span>天</span></template>
                            <span v-else class="rw-fermentation-daily">执行一次</span>
                          </div>
                          <div v-else class="rw-condition"><select v-model="s.operator" aria-label="比较符"><option v-for="op in ['=','>','>=','<','<=']" :key="op" :value="op">{{ op }}</option></select><input v-model.number="s.condition_value" type="number" step="any" required :aria-label="conditionMeta[s.condition][0]"><span>{{ conditionMeta[s.condition][1] }}</span></div>
                        </div>
                        <div class="rw-fermentation-field"><select v-model="s.action" aria-label="处理动作"><option v-for="(label,key) in actions" :key="key" :value="key">{{ label }}</option></select></div>
                        <div class="rw-fermentation-field"><div class="rw-fermentation-target-control"><input v-model="s.target" aria-label="处理目标值" :required="['cool_to','increase_pressure'].includes(s.action)" :placeholder="s.action === 'cool_to' ? '目标温度（℃）' : s.action === 'increase_pressure' ? '目标压力（bar）' : '无需填写时留空'"><button type="button" class="rw-fermentation-delete" :aria-label="'删除步骤 ' + (i+1)" @click="design.fermentation.steps.splice(i,1)">×</button></div></div>
                      </div>
                    </article>
                  </div>
                  <div v-else class="rw-fermentation-empty">尚未添加发酵控制步骤。点击“添加步骤”来设置按时间或实测指标触发的操作。</div>
                  <label><span>发酵要求</span><textarea v-model="design.fermentation.notes" rows="3" placeholder="补充接种、降温、压力控制或冷储要求"></textarea></label><p class="rw-hint">发酵度条件使用实测糖度（°P）计算。这里保存执行规则；实测记录与自动任务执行属于生产环节。</p>
                </section>
              </div>
            </fieldset>
              </div>
            </details>
          </template>
          <section v-if="wizard === 2 && canReview && version?.state === 'submitted'" class="rw-review-actions" aria-label="审核操作">
            <div class="rw-review-actions-heading"><div><strong>审核意见</strong><span>退回修改时请填写原因，通过审核时可选填。</span></div><span>第 {{ currentReviewRound(version) }} 轮审核</span></div>
            <textarea v-model.trim="returnReason" rows="3" placeholder="填写审核意见，帮助配方提交人理解审核结论"></textarea>
            <div class="rw-review-actions-buttons"><button type="button" class="btn btn-outline" :disabled="saving || !returnReason.trim()" @click="action('return')">退回修改</button><button type="button" class="btn btn-primary" :disabled="saving" @click="action('approve')">审核通过并用于生产</button></div>
          </section>
        </div>
        <div class="equipment-modal-footer"><button v-if="wizard === 2 && editable" type="button" class="btn btn-outline" :disabled="saving || !canSubmitForReview" :title="canSubmitForReview ? '保存当前内容并提交审核' : '请先补全原料、糖化参数及糖化步骤，并检查发酵规则'" @click="action('submit')">提交审核</button><button v-if="wizard === 2" type="button" class="btn btn-secondary" :disabled="saving" @click="wizard = 1">基础信息</button><button v-if="wizard === 1" type="button" class="btn btn-primary" @click="next">下一步</button><button v-else-if="editable" type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中…' : '保存草稿' }}</button></div>
      </div>
    </form>
    <form v-if="productEditorOpen" class="equipment-modal-mask rw-product-mask" @click.self="!productSaving && (productEditorOpen = false)" @submit.prevent="createProduct">
      <section class="equipment-modal product-editor-modal" role="dialog" aria-modal="true" aria-label="新增啤酒产品">
        <div class="equipment-modal-header"><div><div class="modal-title">新增啤酒产品</div><div class="modal-subtitle">保存后自动选中，继续填写配方工艺。</div></div><button class="equipment-close" type="button" aria-label="关闭" :disabled="productSaving" @click="productEditorOpen = false">×</button></div>
        <div class="equipment-modal-body product-editor-body">
          <section class="product-editor-section">
            <h3>产品信息</h3>
            <div class="product-editor-grid">
              <label class="product-editor-wide"><span><i>*</i>产品名称</span><input v-model.trim="productDraft.name" maxlength="100" required placeholder="例如：经典拉格"></label>
              <label><span><i>*</i>啤酒大类</span><select v-model="productDraft.brew_beer_category_id" required @change="productDraft.brew_beer_subcategory_id = ''"><option value="">请选择大类</option><option v-for="category in beerCategoryGroups" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select></label>
              <label><span><i>*</i>啤酒小类</span><select v-model="productDraft.brew_beer_subcategory_id" required :disabled="!productDraft.brew_beer_category_id"><option value="">{{ productDraft.brew_beer_category_id ? '请选择小类' : '请先选择大类' }}</option><option v-for="category in productSubcategories" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select></label>
              <label class="product-editor-wide"><span>产品编码</span><input v-model.trim="productDraft.default_code" maxlength="64" placeholder="可选，留空由系统管理"></label>
              <label class="product-editor-wide"><span>产品说明</span><textarea v-model.trim="productDraft.brew_specification" rows="3" maxlength="200" placeholder="可填写产品特点或补充说明"></textarea></label>
            </div>
          </section>
          <div v-if="productError" class="master-error" role="alert">{{ productError }}</div>
        </div>
        <div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" :disabled="productSaving" @click="productEditorOpen = false">取消</button><button class="btn btn-primary" type="submit" :disabled="productSaving">{{ productSaving ? '保存中…' : '保存并选择' }}</button></div>
      </section>
    </form>
    <div v-if="picker" class="supplier-material-picker-mask equipment-modal-mask rw-picker-mask" @click.self="picker = null">
      <section class="supplier-material-picker" role="dialog" aria-modal="true" :aria-label="`选择${groups.find(g => g.key === picker.key)?.title}`">
        <header class="supplier-mall-header"><div><button type="button" class="supplier-mall-back" @click="picker = null">← 返回配方</button><div class="supplier-mall-title">选择{{ groups.find(g => g.key === picker.key)?.title }}</div><div class="supplier-mall-subtitle">从供应商商品目录中选择，并查看原料参数</div></div><span class="supplier-mall-count">{{ pickerItems.length }} 件商品</span></header>
        <div class="supplier-material-picker-toolbar"><input v-model.trim="keyword" autofocus placeholder="搜索商品名称、品牌、规格"><select v-model="supplier" aria-label="筛选供应商"><option value="">全部供应商</option><option v-for="s in suppliers" :key="s" :value="s">{{ s }}</option></select></div>
        <div class="supplier-mall-body">
          <aside class="supplier-mall-aside"><div class="supplier-mall-aside-title">原料分类</div><button type="button" :class="{ active: !pickerCategory }" @click="pickerCategory = ''">全部分类<span>{{ materials.filter(m => m.supplier && (picker.key === 'fermentables' ? ['malt','adjunct'].includes(materialGroup(m)) : picker.key === 'hops' ? materialGroup(m)==='hop' : materialGroup(m)==='yeast')).length }}</span></button><button v-for="c in pickerCategories" :key="c.id" type="button" :class="{ active: pickerCategory === c.code }" @click="pickerCategory = c.code">{{ c.name }}<span>{{ materials.filter(m => m.brew_material_category === c.code && m.supplier).length }}</span></button><p class="supplier-mall-tip">选择商品后，品牌、规格、浸出率、色度或 Alpha 酸会自动带入配方。</p></aside>
          <div class="supplier-material-picker-list">
            <button v-for="item in pickerItems" :key="item.id" type="button" class="supplier-material-picker-card" :class="{ 'rw-invalid-product': item.is_weight_uom === false }" :disabled="item.is_weight_uom === false" @click="selectMaterial(item)">
              <div class="supplier-product-cover"><span>{{ picker.key === 'fermentables' ? 'MALT' : picker.key === 'hops' ? 'HOPS' : 'YEAST' }}</span><strong>{{ (item.name || '?').slice(0,1) }}</strong></div>
              <div class="supplier-product-info"><div class="supplier-product-name"><strong>{{ item.name }}</strong><em v-if="item.is_weight_uom !== false">可用于配方</em><em v-else class="rw-unit-warning">单位待修正</em></div><span class="supplier-product-supplier">{{ item.supplier?.name }} · {{ item.brew_brand || '未填写品牌' }}</span><div class="supplier-product-specs"><span>{{ categories.find(c => c.code === item.brew_material_category)?.name || '原料' }}</span><span>{{ item.brew_specification || '规格未填写' }}</span><span>库存 {{ item.brew_supplier_quantity ?? '—' }} {{ item.uom_id?.name || item.weight_uom || '' }}</span></div><div class="supplier-product-specs"><template v-if="picker.key === 'fermentables'"><span>浸出率 {{ item.brew_extract_rate ?? '—' }}%</span><span>色度 {{ item.brew_color_ebc ?? '—' }} EBC</span></template><span v-else-if="picker.key === 'hops'">Alpha 酸 {{ item.brew_alpha_acid ?? '—' }}%</span><template v-else><span>发酵度 {{ item.brew_extract_rate ?? '—' }}%</span><span>{{ item.brew_flavor_desc || '风味未填写' }}</span></template></div><div class="supplier-product-price">¥{{ item.brew_supplier_price ?? '—' }} <small>/ {{ item.weight_uom || '商品单位' }}</small></div></div>
              <div class="supplier-product-choose">{{ item.is_weight_uom === false ? '请先修正商品单位' : '选择商品 →' }}<small v-if="item.is_weight_uom === false">配方用量需按重量计</small></div>
            </button>
            <div v-if="!pickerItems.length" class="supplier-mall-empty"><strong>暂时没有匹配商品</strong><span>试试更换分类、供应商或搜索词</span></div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.recipe-workspace { display:grid; gap:16px; }
.rw-library-title { display:flex; align-items:center; gap:10px; }
.rw-library-controls { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 18px 0; }
.rw-library-view-switch { display:inline-flex; gap:4px; padding:4px; border:1px solid var(--border-default); border-radius:10px; background:rgba(255,255,255,.025); }
.rw-library-view-switch button { min-height:36px; padding:0 13px; border:0; border-radius:7px; background:transparent; color:var(--text-muted); font:inherit; font-size:12px; cursor:pointer; }
.rw-library-view-switch button.active { color:var(--accent-gold); background:rgba(212,168,83,.13); box-shadow:inset 0 0 0 1px rgba(212,168,83,.17); }
.rw-library-count { color:var(--text-muted); font-size:12px; }
.rw-library-groups { display:grid; gap:14px; padding:16px 18px 20px; }
.rw-library-group { overflow:hidden; border:1px solid var(--border-default); border-radius:13px; background:linear-gradient(145deg,rgba(255,255,255,.026),rgba(255,255,255,.008)); }
.rw-library-group > header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:15px 18px; border-bottom:1px solid var(--border-subtle); background:rgba(255,255,255,.018); }
.rw-library-group > header h3 { margin:0; color:var(--text-primary); font-size:15px; font-weight:650; }
.rw-library-group > header p { margin:4px 0 0; color:var(--text-muted); font-size:12px; }
.rw-library-group > header > span { flex:none; padding:5px 9px; border-radius:999px; color:var(--accent-gold); background:rgba(212,168,83,.09); font-size:11px; }
.rw-library-recipe { display:grid; grid-template-columns:40px minmax(0,1fr) auto; align-items:center; gap:13px; padding:15px 18px; border-bottom:1px solid var(--border-subtle); }
.rw-library-recipe-actions { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
.rw-recipe-delete { color:#e6948c; border:1px solid rgba(219,101,89,.4); background:rgba(219,101,89,.08); }
.rw-recipe-delete:hover { color:#ffd1cb; border-color:#e6948c; background:rgba(219,101,89,.18); }
.rw-library-recipe:last-child { border-bottom:0; }
.rw-library-recipe-icon,.rw-version-mark { display:grid; flex:none; place-items:center; width:38px; height:38px; border:1px solid rgba(212,168,83,.26); border-radius:11px; color:var(--accent-gold); background:rgba(212,168,83,.08); font-size:13px; font-weight:700; }
.rw-library-recipe-main { min-width:0; }
.rw-library-recipe-title,.rw-version-heading { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.rw-library-recipe-title > strong { color:var(--text-primary); font-size:14px; }
.rw-library-recipe-meta { display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin-top:5px; color:var(--text-muted); font-size:11px; }
.rw-library-recipe-meta i { color:var(--border-default); font-style:normal; }
.rw-library-recipe-version { display:flex; align-items:center; gap:7px; margin-top:8px; color:var(--text-muted); font-size:11px; }
.rw-library-recipe-version b { color:var(--text-secondary); font-weight:600; }
.rw-status-chip { display:inline-flex; align-items:center; min-height:22px; padding:2px 8px; border:1px solid var(--border-default); border-radius:999px; color:var(--text-muted); background:rgba(255,255,255,.025); font-size:10px; white-space:nowrap; }
.rw-status-chip.is-success { border-color:rgba(115,190,132,.32); color:#9bd4a5; background:rgba(66,145,87,.1); }
.rw-status-chip.is-warning { border-color:rgba(212,168,83,.35); color:var(--accent-gold); background:rgba(212,168,83,.09); }
.rw-status-chip.is-muted { color:var(--text-muted); background:rgba(255,255,255,.018); }
.rw-library-empty { display:grid; justify-items:center; gap:7px; padding:38px 18px; border:1px dashed var(--border-default); border-radius:12px; color:var(--text-muted); text-align:center; }
.rw-library-empty > span { color:var(--accent-gold); font-size:22px; }
.rw-library-empty strong { color:var(--text-primary); font-size:14px; }
.rw-library-empty small { color:var(--text-muted); font-size:12px; }
.rw-library-empty.compact { padding:25px 18px; }
.rw-library-detail { overflow:hidden; }
.rw-library-detail-heading { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:22px 24px; border-bottom:1px solid var(--border-subtle); background:linear-gradient(120deg,rgba(212,168,83,.08),transparent 62%); }
.rw-library-kicker { color:var(--accent-gold); font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
.rw-library-detail-heading h2 { margin:5px 0 0; color:var(--text-primary); font-size:21px; }
.rw-library-detail-heading p { margin:6px 0 0; color:var(--text-muted); font-size:12px; }
.rw-library-detail-actions { display:flex; flex-wrap:wrap; gap:8px; }
.rw-library-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; border-bottom:1px solid var(--border-subtle); background:var(--border-subtle); }
.rw-library-stats > div { display:grid; gap:5px; padding:14px 20px; background:var(--bg-panel); }
.rw-library-stats span { color:var(--text-muted); font-size:11px; }
.rw-library-stats strong { color:var(--text-primary); font-size:15px; }
.rw-library-tabs { display:flex; gap:7px; padding:14px 20px 0; border-bottom:1px solid var(--border-subtle); }
.rw-library-tabs button { display:flex; align-items:center; gap:8px; padding:10px 13px; border:0; border-bottom:2px solid transparent; background:transparent; color:var(--text-muted); font:inherit; font-size:12px; cursor:pointer; }
.rw-library-tabs button.active { border-bottom-color:var(--accent-gold); color:var(--accent-gold); }
.rw-library-tabs b { display:grid; place-items:center; min-width:19px; height:19px; padding:0 5px; border-radius:99px; color:var(--text-secondary); background:rgba(255,255,255,.07); font-size:10px; }
.rw-version-list,.rw-production-list { display:grid; gap:10px; padding:16px 20px 20px; }
.rw-version-card,.rw-production-card { display:flex; align-items:center; gap:13px; padding:14px; border:1px solid var(--border-default); border-radius:11px; background:rgba(255,255,255,.018); }
.rw-version-mark.base { border-color:rgba(115,190,132,.28); color:#9bd4a5; background:rgba(66,145,87,.09); }
.rw-version-mark.production { border-color:rgba(90,141,184,.3); color:#a8c9e4; background:rgba(90,141,184,.1); }
.rw-version-content,.rw-production-content { flex:1; min-width:0; }
.rw-version-heading > strong { color:var(--text-primary); font-size:13px; }
.rw-current-tag { padding:3px 7px; border-radius:999px; color:#9bd4a5; background:rgba(66,145,87,.1); font-size:10px; }
.rw-version-content p { overflow:hidden; margin:6px 0 4px; color:var(--text-secondary); font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
.rw-version-content > small,.rw-production-content > small { color:var(--text-muted); font-size:11px; }
.rw-version-actions { display:flex; gap:7px; flex:none; }
.rw-production-card { align-items:flex-start; }
.rw-production-card.selected { border-color:rgba(90,141,184,.48); background:rgba(90,141,184,.045); }
.rw-production-meta { display:flex; flex-wrap:wrap; gap:7px 16px; margin:9px 0 7px; color:var(--text-muted); font-size:11px; }
.rw-production-meta b { color:var(--text-secondary); font-weight:600; }
.rw-production-snapshot { display:grid; gap:14px; margin-top:5px; padding:18px; border:1px solid rgba(90,141,184,.24); border-radius:12px; background:linear-gradient(145deg,rgba(90,141,184,.08),rgba(255,255,255,.015)); }
.rw-production-snapshot > header { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.rw-production-snapshot > header div > span,.rw-production-snapshot > header > span { color:#a8c9e4; font-size:11px; }
.rw-production-snapshot h3 { margin:4px 0 0; color:var(--text-primary); font-size:16px; }
.rw-snapshot-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.rw-snapshot-stats > div { display:grid; gap:5px; padding:10px; border-radius:8px; background:rgba(0,0,0,.12); }
.rw-snapshot-stats small { color:var(--text-muted); font-size:10px; }
.rw-snapshot-stats strong { color:var(--text-primary); font-size:12px; overflow-wrap:anywhere; }
.rw-snapshot-steps,.rw-snapshot-materials { display:grid; gap:8px; }
.rw-snapshot-steps > strong,.rw-snapshot-materials > strong { color:var(--text-primary); font-size:12px; }
.rw-snapshot-steps ol { display:grid; gap:6px; margin:0; padding:0; list-style:none; }
.rw-snapshot-steps li,.rw-snapshot-materials > span { display:flex; justify-content:space-between; gap:12px; padding:8px 10px; border-radius:7px; color:var(--text-secondary); background:rgba(0,0,0,.11); font-size:11px; }
.rw-snapshot-steps li small { color:var(--text-muted); }
.rw-snapshot-legacy { margin:0; color:var(--text-muted); font-size:12px; }
.rw-recipe-doc-icon { display:grid; flex:none; place-items:center; width:38px; height:38px; border:1px solid rgba(212,168,83,.3); border-radius:11px; color:var(--accent-gold); background:linear-gradient(145deg,rgba(212,168,83,.16),rgba(212,168,83,.045)); }
.rw-recipe-doc-icon svg { width:19px; height:19px; fill:none; stroke:currentColor; stroke-width:1.65; stroke-linecap:round; stroke-linejoin:round; }
.rw-title-doc-icon { width:30px; height:30px; border-radius:9px; }
.rw-title-doc-icon svg { width:16px; height:16px; }
.recipe-card-main { display:flex; align-items:center; gap:12px; }
.rw-recipe-name { display:grid; gap:4px; min-width:0; }
.rw-recipe-name strong { overflow-wrap:anywhere; }
.rw-recipe-name span { color:var(--text-muted); font-size:12px; }
.rw-recipe-filter-tools { display:flex; align-items:center; gap:10px; padding:14px 18px 0; }
.rw-recipe-search { position:relative; display:flex; flex:1 1 260px; align-items:center; min-width:180px; height:44px; min-height:44px; }
.rw-recipe-search input { height:44px; min-height:44px; max-height:44px; padding:0 36px; line-height:normal; appearance:none; -webkit-appearance:none; }
.rw-search-icon { position:absolute; left:12px; z-index:1; color:var(--text-muted); font-size:22px; line-height:1; pointer-events:none; }
.rw-recipe-search > button { position:absolute; right:8px; display:grid; place-items:center; width:25px; height:25px; border:0; border-radius:6px; background:transparent; color:var(--text-muted); font-size:20px; cursor:pointer; }
.rw-recipe-search > button:hover { color:var(--text-primary); background:rgba(255,255,255,.07); }
.rw-category-select { display:flex; flex:0 1 310px; align-items:center; gap:9px; min-width:220px; height:44px; min-height:44px; color:var(--text-muted); font-size:12px; white-space:nowrap; }
.rw-category-select select { flex:1; width:auto; height:44px; min-height:44px; max-height:44px; padding-top:0; padding-bottom:0; }
.rw-clear-filters { flex:none; height:44px; padding:0 13px; border:1px solid var(--border-default); border-radius:8px; background:transparent; color:var(--text-secondary); font:inherit; font-size:12px; cursor:pointer; }
.rw-clear-filters:hover { border-color:var(--accent-gold); color:var(--accent-gold); }
.rw-recipe-filters { display:flex; gap:8px; overflow-x:auto; padding:14px 18px 0; scrollbar-width:thin; }
.rw-recipe-filters button { display:inline-flex; flex:none; align-items:center; gap:10px; min-height:38px; padding:0 13px; border:1px solid var(--border-default); border-radius:9px; background:rgba(255,255,255,.018); color:var(--text-secondary); font:inherit; font-size:12px; cursor:pointer; transition:color .16s ease,border-color .16s ease,background .16s ease; }
.rw-recipe-filters button:hover { color:var(--text-primary); border-color:rgba(212,168,83,.42); }
.rw-recipe-filters button.active { color:var(--accent-gold); border-color:rgba(212,168,83,.68); background:linear-gradient(135deg,rgba(212,168,83,.13),rgba(212,168,83,.045)); box-shadow:inset 0 0 0 1px rgba(212,168,83,.08); }
.rw-recipe-filters button b { display:grid; place-items:center; min-width:20px; height:20px; padding:0 5px; border-radius:999px; color:var(--text-muted); background:rgba(255,255,255,.07); font-size:10px; font-weight:700; }
.rw-recipe-filters button.active b { color:#221b10; background:var(--accent-gold); }
.rw-mask { z-index:120; }
.rw-modal { width:min(1480px,96vw); max-width:96vw; max-height:94vh; display:flex; flex-direction:column; }
.rw-body { padding:20px 24px; overflow:auto; min-height:0; }
fieldset { border:0; padding:0; margin:0; min-width:0; }
input, select, textarea { width:100%; min-width:0; box-sizing:border-box; border:1px solid var(--border-default); border-radius:7px; background:var(--bg-input); color:var(--text-primary); padding:9px 10px; font:inherit; }
input:focus, select:focus, textarea:focus { outline:1px solid var(--accent-gold); }
:disabled { cursor:default; }
label { display:grid; gap:7px; color:var(--text-secondary); font-size:13px; }
.rw-fields { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; align-items:end; }
.rw-tabs { display:flex; gap:8px; margin-bottom:18px; }
.rw-tabs button { flex:1; padding:12px; border:1px solid var(--border-default); border-radius:8px; background:var(--bg-input); color:var(--text-secondary); cursor:pointer; }
.rw-tabs .active { color:var(--accent-gold); border-color:var(--accent-gold); background:rgba(212,168,83,.08); }
.rw-heading-title { display:flex; align-items:center; flex-wrap:wrap; gap:12px; min-width:0; }
.rw-heading-title .rw-ibu-method { width:auto; max-width:210px; min-height:32px; padding:4px 28px 4px 10px; font-size:12px; color:var(--text-secondary); background:var(--bg-input); border:1px solid var(--border-default); border-radius:5px; }
.rw-ibu-help { position:relative; font-size:12px; color:var(--text-muted); }
.rw-ibu-help summary { cursor:pointer; list-style:none; padding:5px; }
.rw-ibu-help p { position:absolute; z-index:5; top:32px; left:0; width:min(300px,65vw); padding:12px 15px; margin:0; border:1px solid var(--border-default); border-radius:7px; background:var(--bg-elevated); box-shadow:var(--shadow-md); font-weight:400; line-height:1.8; }
.rw-design-disclosure { margin-top:18px; border:1px solid var(--border-default); border-radius:12px; background:rgba(255,255,255,.018); overflow:hidden; }
.rw-design-disclosure > summary { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 18px; color:var(--text-primary); cursor:pointer; list-style:none; }
.rw-design-disclosure > summary::-webkit-details-marker { display:none; }
.rw-design-disclosure > summary::after { content:'⌄'; order:1; color:var(--accent-gold); font-size:20px; transition:transform .18s ease; }
.rw-design-disclosure[open] > summary::after { transform:rotate(180deg); }
.rw-design-disclosure > summary span { display:grid; gap:4px; }
.rw-design-disclosure > summary strong { font-size:14px; }
.rw-design-disclosure > summary small { color:var(--text-muted); font-size:12px; }
.rw-design-disclosure > summary b { margin-left:auto; color:var(--accent-gold); font-size:12px; font-weight:600; }
.rw-design-content { padding:0 18px 18px; border-top:1px solid var(--border-subtle); }
.rw-readonly-note { display:flex; align-items:center; gap:10px; margin:14px 0; padding:10px 12px; border:1px solid rgba(90,141,184,.2); border-radius:8px; color:var(--text-secondary); background:rgba(90,141,184,.06); font-size:12px; }
.rw-readonly-note span { padding:3px 8px; border-radius:999px; color:#9dc2e0; background:rgba(90,141,184,.14); font-weight:600; white-space:nowrap; }
.rw-design-disclosure.is-readonly .rw-section .rw-heading > .btn,
.rw-design-disclosure.is-readonly .rw-table .btn-danger { display:none; }
.rw-design-disclosure.is-readonly fieldset input:disabled,
.rw-design-disclosure.is-readonly fieldset select:disabled,
.rw-design-disclosure.is-readonly fieldset textarea:disabled { border-color:transparent; background:transparent; color:var(--text-primary); opacity:1; box-shadow:none; }
.rw-design-disclosure.is-readonly fieldset select:disabled { appearance:none; padding-left:0; }
.rw-picker-display { display:grid; gap:5px; min-height:52px; align-content:center; padding:8px 10px; border:1px solid var(--border-subtle); border-radius:8px; background:rgba(255,255,255,.018); }
.rw-picker-display strong { overflow:hidden; color:var(--text-primary); font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
.rw-picker-display small { color:var(--text-muted); font-size:11px; }
.rw-sections { display:grid; gap:18px; }
.rw-section { display:grid; gap:16px; padding:18px; border:1px solid var(--border-default); border-radius:12px; background:rgba(255,255,255,.02); min-width:0; }
.rw-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; }
.rw-heading strong { font-size:16px; }
.rw-table-scroll { overflow-x:auto; }
.rw-table { width:100%; min-width:850px; table-layout:fixed; border-collapse:collapse; }
.rw-table th { color:var(--text-muted); font-size:12px; font-weight:600; text-align:left; padding:10px 6px; }
.rw-table td { padding:10px 6px; border-top:1px solid var(--border-subtle); vertical-align:middle; font-variant-numeric:tabular-nums; }
.rw-table .btn-danger { padding:5px 9px; }
.rw-body .btn-danger { color:#e6948c; border:1px solid rgba(219,101,89,.4); background:rgba(219,101,89,.1); cursor:pointer; }
.rw-picker { display:grid; gap:5px; width:100%; min-height:52px; text-align:left; background:rgba(212,168,83,.05); border:1px solid rgba(212,168,83,.4); border-radius:8px; color:var(--text-primary); padding:8px 10px; cursor:pointer; }
.rw-picker strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rw-picker small { color:var(--accent-gold); }
.rw-flavor { white-space:normal; overflow-wrap:anywhere; color:var(--text-secondary); font-size:12px; }
.rw-summary { display:flex; gap:10px; flex-wrap:wrap; }
.rw-summary > span { display:flex; justify-content:space-between; gap:16px; flex:1 1 160px; padding:12px; background:rgba(212,168,83,.06); border:1px solid rgba(212,168,83,.18); border-radius:8px; color:var(--text-muted); }
.rw-summary b { color:var(--accent-gold); font-variant-numeric:tabular-nums; }
.rw-hint { color:var(--text-muted); font-size:12px; line-height:1.7; margin:0; }
.rw-fields > .rw-hint { grid-column:span 2; }
.rw-notes { margin-top:18px; }
.rw-notice { padding:12px; color:#a9d5ac; font-size:13px; }
.rw-return-reason { width:260px; min-height:38px; resize:vertical; font-size:12px; }
.rw-review-panel { display:grid; gap:18px; margin:0 0 20px; padding:20px; border:1px solid rgba(212,168,83,.24); border-radius:12px; background:linear-gradient(135deg,rgba(212,168,83,.07),rgba(255,255,255,.015) 48%); }
.rw-review-actions { display:grid; gap:14px; margin-top:20px; padding:20px; border:1px solid rgba(212,168,83,.28); border-radius:12px; background:linear-gradient(135deg,rgba(212,168,83,.08),rgba(255,255,255,.018) 62%); }
.rw-review-actions-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.rw-review-actions-heading > div { display:grid; gap:4px; }
.rw-review-actions-heading strong { font-size:15px; }
.rw-review-actions-heading span, .rw-review-actions-heading > span { color:var(--text-muted); font-size:12px; }
.rw-review-actions textarea { min-height:82px; resize:vertical; line-height:1.6; }
.rw-review-actions-buttons { display:flex; justify-content:flex-end; gap:10px; }
.rw-review-actions-buttons .btn { min-width:120px; min-height:42px; }
.rw-review-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.rw-review-heading > div { display:grid; gap:5px; }
.rw-review-heading strong { color:var(--text-primary); font-size:16px; }
.rw-review-heading > div > span { color:var(--text-muted); font-size:12px; }
.rw-review-state { padding:5px 11px; border:1px solid rgba(212,168,83,.35); border-radius:999px; color:var(--accent-gold); background:rgba(212,168,83,.08); font-size:12px; white-space:nowrap; }
.rw-review-steps { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); }
.rw-review-step { position:relative; display:grid; justify-items:center; gap:8px; color:var(--text-muted); font-size:12px; text-align:center; }
.rw-review-step:not(:last-child)::after { content:''; position:absolute; z-index:0; top:13px; left:calc(50% + 18px); width:calc(100% - 36px); height:1px; background:var(--border-default); }
.rw-review-dot { z-index:1; display:grid; place-items:center; width:28px; height:28px; border:1px solid var(--border-default); border-radius:50%; background:var(--bg-elevated); font-size:11px; }
.rw-review-step.done { color:var(--text-secondary); }
.rw-review-step.done .rw-review-dot { border-color:rgba(115,190,132,.6); color:#8bc99a; background:rgba(66,145,87,.14); }
.rw-review-step.current { color:var(--accent-gold); }
.rw-review-step.current .rw-review-dot { border-color:var(--accent-gold); color:#1b1813; background:var(--accent-gold); box-shadow:0 0 0 4px rgba(212,168,83,.12); }
.rw-review-returned { display:grid; gap:5px; padding:11px 13px; border:1px solid rgba(219,101,89,.28); border-radius:8px; color:#e6948c; background:rgba(219,101,89,.08); font-size:12px; }
.rw-review-returned span { color:var(--text-secondary); line-height:1.6; }
.rw-review-history { display:grid; gap:12px; }
.rw-review-history-title { color:var(--text-primary); font-size:13px; font-weight:600; }
.rw-review-timeline { display:grid; gap:0; padding-left:4px; }
.rw-review-event { position:relative; display:grid; gap:5px; padding:0 0 17px 20px; border-left:1px solid var(--border-default); }
.rw-review-event:last-child { padding-bottom:0; border-left-color:transparent; }
.rw-review-marker { position:absolute; top:2px; left:-5px; width:9px; height:9px; border:2px solid var(--accent-gold); border-radius:50%; background:var(--bg-elevated); }
.event-returned .rw-review-marker { border-color:#e17669; }
.event-approved .rw-review-marker, .event-activated .rw-review-marker { border-color:#79bd87; }
.rw-review-event-head { display:flex; align-items:center; gap:9px; }
.rw-review-event-head strong { color:var(--text-primary); font-size:12px; }
.rw-review-event-head span { padding:2px 7px; border-radius:999px; color:var(--text-muted); background:rgba(255,255,255,.05); font-size:10px; }
.rw-review-event-meta { color:var(--text-muted); font-size:11px; }
.rw-review-comment { margin:2px 0 0; padding:8px 10px; border-left:2px solid rgba(219,101,89,.55); border-radius:0 6px 6px 0; color:var(--text-secondary); background:rgba(219,101,89,.06); font-size:12px; line-height:1.6; white-space:pre-wrap; }
.rw-review-empty { padding:12px; border-radius:8px; color:var(--text-muted); background:rgba(255,255,255,.025); font-size:12px; }
.rw-basic-modal { width:min(1040px,96vw); }
.rw-basic-modal .equipment-modal-header { padding:24px 28px; }
.rw-basic-modal .modal-title { font-size:20px; font-weight:600; }
.rw-basic-modal .modal-subtitle { margin-top:8px; line-height:1.6; }
.rw-basic-modal .rw-body { padding:24px 28px 26px; }
.rw-basic-modal .equipment-modal-footer { padding:18px 28px; gap:12px; }
.rw-basic-modal .equipment-modal-footer .btn { min-height:44px; min-width:104px; border-radius:8px; }
.rw-basic { display:grid; gap:24px; }
.rw-progress { display:flex; align-items:center; gap:16px; padding:0; margin:0; list-style:none; }
.rw-progress li { display:flex; align-items:center; gap:10px; font-size:13px; color:var(--text-muted); }
.rw-progress li + li::before { content:''; width:56px; height:1px; background:var(--border-default); margin-right:6px; }
.rw-progress b { display:grid; place-items:center; width:30px; height:30px; border:1px solid var(--border-default); border-radius:50%; font-size:11px; font-weight:600; }
.rw-progress [aria-current] { color:var(--accent-gold); font-weight:600; }
.rw-progress [aria-current] b { border-color:rgba(212,168,83,.45); background:rgba(212,168,83,.12); }
.rw-basic-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px; }
.rw-basic-card { min-width:0; padding:22px; border:1px solid var(--border-default); border-radius:12px; background:rgba(255,255,255,.018); }
.rw-basic-heading { margin-bottom:22px; }
.rw-basic-heading h3 { margin:0 0 8px; font-size:15px; font-weight:600; color:var(--text-primary); }
.rw-basic-heading p { margin:0; font-size:12px; line-height:1.6; color:var(--text-muted); }
.rw-basic-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px 16px; }
.rw-basic-fields label { gap:9px; align-content:start; }
.rw-volume-value { display:flex; align-items:center; min-height:46px; font-size:14px; color:var(--text-primary); }
.rw-add-product { grid-column:1 / -1; justify-self:start; margin-top:-12px; }
.rw-product-mask { z-index:130; }
.rw-field-wide { grid-column:1 / -1; }
.rw-field-hint { margin:-12px 0 0; color:var(--text-muted); font-size:11px; line-height:1.5; }
.rw-basic-fields input, .rw-basic-fields select { display:block; height:46px; min-height:46px; max-height:46px; margin:0; padding:0 12px; line-height:normal; font-size:14px; border-radius:8px; transition:border-color .15s, box-shadow .15s; }
.rw-basic-fields select { appearance:none; -webkit-appearance:none; padding-right:36px; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='m4 6 4 4 4-4' fill='none' stroke='%23b8ad99' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; }
.rw-basic-fields input::placeholder, .rw-basic-fields .rw-placeholder { color:var(--text-muted); }
.rw-basic-fields select option { color:var(--text-primary); background:var(--bg-input); }
.rw-basic-fields input:focus, .rw-basic-fields select:focus { outline:none; border-color:var(--accent-gold); box-shadow:0 0 0 3px rgba(212,168,83,.1); }
.rw-basic-fields :disabled { opacity:.55; cursor:not-allowed; }
.rw-basic-help { display:flex; justify-content:space-between; gap:12px; color:var(--text-muted); font-size:12px; line-height:1.7; }
.rw-basic-help span { flex-shrink:0; }
.rw-basic-help p { margin:0; }
@media(max-width:800px) { .rw-basic-grid { grid-template-columns:1fr; } .rw-basic-help { flex-direction:column; gap:4px; } }
@media(max-width:480px) { .rw-basic-modal .equipment-modal-header, .rw-basic-modal .equipment-modal-footer { padding:18px; } .rw-basic-modal .rw-body { padding:18px; } .rw-basic-card { padding:16px; } .rw-basic-fields { grid-template-columns:1fr; } .rw-progress { gap:10px; } .rw-progress li + li::before { width:20px; margin-right:0; } }
.rw-step { grid-template-columns:2fr 1fr 1fr auto; }
.rw-fermentation-heading { display:grid; gap:4px; }
.rw-fermentation-heading small { color:var(--text-muted); font-size:11px; font-weight:400; }
.rw-fermentation-list { overflow-x:auto; border:1px solid var(--border-default); border-radius:10px; background:rgba(255,255,255,.018); }
.rw-fermentation-table-head,.rw-fermentation-card { display:grid; grid-template-columns:80px minmax(140px,1fr) minmax(250px,1.5fr) minmax(150px,1fr) minmax(200px,1.2fr); align-items:center; gap:16px; min-width:920px; padding:16px; }
.rw-fermentation-table-head { padding-top:14px; padding-bottom:14px; color:var(--text-muted); font-size:12px; border-bottom:1px solid var(--border-default); }
.rw-fermentation-card + .rw-fermentation-card { border-top:1px solid var(--border-subtle); }
.rw-fermentation-card>header strong { color:var(--accent-gold); font-size:12px; white-space:nowrap; }
.rw-fermentation-grid { display:contents; }
.rw-fermentation-target-control { display:grid; grid-template-columns:minmax(0,1fr) 26px; align-items:center; gap:10px; }
.rw-fermentation-delete { width:26px; height:26px; padding:0; border:0; border-radius:7px; background:rgba(255,255,255,.07); color:#c8bca9; font-size:18px; line-height:1; cursor:pointer; }
.rw-fermentation-delete:hover { background:rgba(210,91,75,.18); color:#f09a8d; }
.rw-fermentation-field { min-width:0; color:var(--text-secondary); font-size:12px; }
.rw-fermentation-field input,.rw-fermentation-field select { width:100%; height:40px; min-height:40px; max-width:none; padding-top:0; padding-bottom:0; }
.rw-fermentation-schedule { display:grid; grid-template-columns:minmax(110px,1fr) 72px 20px; align-items:center; gap:8px; }
.rw-fermentation-daily { grid-column:2 / -1; color:var(--text-muted); white-space:nowrap; }
.rw-fermentation-condition-text { display:flex; align-items:center; gap:10px; min-height:40px; color:var(--text-primary); font-size:13px; }
.rw-fermentation-operator { flex:0 0 28px; }
.rw-fermentation-condition-number { flex:0 0 64px; text-align:left; font-variant-numeric:tabular-nums; }
.rw-fermentation-field .rw-condition { display:grid; grid-template-columns:56px minmax(50px,1fr) 28px; align-items:center; gap:5px; width:100%; margin:0; }
.rw-fermentation-empty { width:min(100%,1100px); padding:18px; border:1px dashed var(--border-default); border-radius:9px; color:var(--text-muted); background:rgba(255,255,255,.015); font-size:12px; }
.rw-picker-mask { z-index:150; }
.rw-invalid-product { opacity:.62; cursor:not-allowed; }
.rw-unit-warning { background:rgba(219,101,89,.15)!important; color:#e6948c!important; }

@media(max-width:700px) { .rw-body { padding:12px; } .rw-fields { grid-template-columns:1fr; } .rw-fields > .rw-hint { grid-column:auto; } .rw-section { padding:12px; } .rw-catalog-grid { grid-template-columns:1fr; } .equipment-modal-footer { flex-wrap:wrap; } .rw-design-content { padding:0 10px 12px; } .rw-design-disclosure > summary { padding:14px 12px; } .rw-review-actions { padding:14px; } .rw-review-actions-heading { align-items:flex-start; flex-direction:column; } .rw-review-actions-buttons { flex-direction:column-reverse; } .rw-review-actions-buttons .btn { width:100%; } }
@media(max-width:520px) { .rw-review-panel { padding:14px; } .rw-review-steps { gap:3px; } .rw-review-step { font-size:10px; } .rw-review-step:not(:last-child)::after { left:calc(50% + 14px); width:calc(100% - 28px); } .rw-review-dot { width:24px; height:24px; } .rw-review-step:not(:last-child)::after { top:11px; } .rw-review-heading { align-items:flex-start; } }
@media(max-width:700px) { .rw-recipe-filter-tools { align-items:stretch; flex-wrap:wrap; padding:12px 14px 0; } .rw-recipe-search { flex-basis:100%; } .rw-category-select { flex:1 1 220px; } .rw-clear-filters { flex:1; } .rw-recipe-filters { padding-left:14px; padding-right:14px; } }
@media(max-width:760px) { .rw-library-controls { align-items:flex-start; flex-direction:column; padding:14px 14px 0; } .rw-library-groups { padding:14px; } .rw-library-recipe { grid-template-columns:38px minmax(0,1fr); } .rw-library-recipe-actions { grid-column:2; } .rw-library-detail-heading { align-items:flex-start; flex-direction:column; padding:18px; } .rw-library-detail-actions { width:100%; } .rw-library-detail-actions .btn { flex:1; } .rw-library-stats > div { padding:12px; } .rw-version-card,.rw-production-card { align-items:flex-start; flex-wrap:wrap; } .rw-version-content,.rw-production-content { flex-basis:calc(100% - 54px); } .rw-version-actions { width:100%; padding-left:51px; } .rw-production-card > button { margin-left:51px; } .rw-snapshot-stats { grid-template-columns:1fr; } }
@media(max-width:460px) { .rw-library-view-switch { width:100%; } .rw-library-view-switch button { flex:1; padding:0 8px; } .rw-library-count { font-size:11px; } .rw-library-group > header { padding:13px; } .rw-library-recipe { padding:13px; } .rw-library-tabs { padding-left:12px; padding-right:12px; } .rw-library-tabs button { padding:9px 7px; font-size:11px; } .rw-version-list,.rw-production-list { padding:12px; } .rw-production-meta { display:grid; grid-template-columns:1fr 1fr; } }
</style>

<style scoped>
.rw-compact-heading{gap:16px;flex-wrap:wrap;padding:18px 20px}.rw-compact-heading .panel-title{font-size:17px;white-space:nowrap}.rw-heading-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-left:auto;flex-wrap:wrap}.rw-heading-tools .rw-recipe-filter-tools{display:flex;align-items:center;gap:8px;padding:0;margin:0;border:0;flex:none}.rw-heading-tools .rw-recipe-search{width:230px;flex:none;min-width:0;height:34px;padding:0 10px;gap:7px;border-radius:6px}.rw-heading-tools .rw-recipe-search input{height:32px;padding:0;font-size:12px;min-width:0}.rw-heading-tools .rw-search-icon{font-size:16px}.rw-heading-tools .rw-category-select{gap:0}.rw-heading-tools .rw-category-select>span{display:none}.rw-heading-tools .rw-category-select select{width:130px;height:34px;min-height:34px;padding:0 9px;font-size:12px;border-radius:6px}.rw-heading-tools>.btn{height:34px;padding:0 12px;white-space:nowrap;font-size:12px}.rw-heading-tools .rw-clear-filters{font-size:11px}.recipe-workspace .rw-library-controls{padding:12px 20px 4px}.recipe-workspace .rw-library-view-switch{padding:2px;border-radius:5px}.recipe-workspace .rw-library-view-switch button{padding:6px 10px;font-size:11px}.recipe-workspace .rw-recipe-filters{padding:8px 20px 14px;gap:18px}.recipe-workspace .rw-recipe-filters button{border:0;border-bottom:2px solid transparent;border-radius:0;background:none;padding:8px 0;font-size:12px}.recipe-workspace .rw-recipe-filters button.active{border-color:var(--accent-gold);background:none}.recipe-workspace .rw-recipe-filters b{padding:0 5px;background:none;font-size:11px}.recipe-workspace .rw-library-groups{padding-top:0}@media(max-width:800px){.rw-heading-tools{width:100%;justify-content:flex-start}.rw-heading-tools .rw-recipe-filter-tools{flex:1;min-width:0}.rw-heading-tools .rw-recipe-search{width:auto;flex:1}.rw-heading-tools .rw-category-select select{width:110px}.rw-heading-tools>.btn{padding:0 9px}.recipe-workspace .rw-recipe-filters{gap:14px;overflow:auto;flex-wrap:nowrap}}
</style>
