<script setup>
import { computed, onMounted, ref } from 'vue';
import { brewApi } from '../api';
import { calculateRecipe, emptyDesign, normalizeDesign, scaleToTarget, present } from '../recipe-calculations';

const props = defineProps({ permissions: { type: Array, default: () => [] } });
const canManage = computed(() => props.permissions.some(p => ['recipe.version.manage', 'base.master_data.manage'].includes(p)));
const recipes = ref([]), materials = ref([]), categories = ref([]), beerCategories = ref([]), equipment = ref([]);
const selectedRecipe = ref(null), versions = ref([]), version = ref(null);
const newVersionRecipeId = ref(null), returnReason = ref('');
const loading = ref(false), saving = ref(false), error = ref(''), notice = ref('');
const editing = ref(false), wizard = ref(1), tab = ref('recipe'), form = ref(null);
const basic = ref({ name: '', beer_category_id: '', beer_subcategory_id: '', notes: '' });
const design = ref(emptyDesign());
const metrics = computed(() => calculateRecipe(design.value));
const editable = computed(() => canManage.value && (!version.value || ['draft', 'returned'].includes(version.value.state)));
const system = computed(() => equipment.value.find(e => String(e.id) === String(design.value.brew_equipment_id)));
const beerParents = computed(() => beerCategories.value.filter(c => !c.parent_id));
const beerChildren = computed(() => beerCategories.value.filter(c => String(c.parent_id?.id || c.parent_id) === String(basic.value.beer_category_id)));
const stateNames = { draft: '草稿', returned: '已退回', submitted: '待审核', approved: '已审核', active: '使用中', inactive: '已停用' };
const groups = [{ key: 'fermentables', title: '麦芽与可发酵物', add: '添加原料' }, { key: 'hops', title: '啤酒花', add: '添加酒花' }, { key: 'yeast', title: '酵母', add: '添加酵母' }];
const conditionMeta = { time: ['时间', ''], gravity: ['糖度', '°P'], attenuation: ['实际发酵度', '%'], diacetyl: ['双乙酰', 'ppm'], temperature: ['温度', '℃'], pressure: ['压力', 'bar'] };
const actions = { measure_gravity: '测量糖度', measure_temperature: '测量温度', measure_pressure: '测量压力', measure_diacetyl: '测量双乙酰', seal: '封罐', dry_hop: '干投', cool_to: '降温至', dump_hops: '排出酒花', centrifuge: '离心', increase_pressure: '升压至', package: '出酒' };
const mashFields = [{ key: 'efficiency', label: '糖化效率(%)', min: 0.1, max: 100 }, { key: 'water_grain_ratio', label: '料水比(L/kg)', min: 0.1 }, { key: 'absorption_rate', label: '麦芽吸水率(L/kg)', min: 0 }, { key: 'boil_time_min', label: '煮沸时间(min)', min: 1 }, { key: 'evaporation_rate', label: '蒸发率(%/小时)', min: 0, max: 100 }, { key: 'screen_water_l', label: '筛板余水(L)', min: 0 }];
const targetFields = [{ key: 'og', label: '目标 OG（SG）', min: 1, step: .001 }, { key: 'fg', label: '目标 FG（SG）', min: .9, step: .001 }, { key: 'ibu', label: '目标 IBU', min: 0, step: .1 }, { key: 'color', label: '目标色度(EBC)', min: 0, step: .1 }, { key: 'abv', label: '目标酒精度(%)', min: 0, step: .1 }];
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
    [recipes.value, materials.value, categories.value, beerCategories.value, equipment.value] = await Promise.all([
      allPages(p => brewApi.listRecipes(p)), allPages(p => brewApi.listMaster('materials', { ...p, active: true })),
      allPages(p => brewApi.listMaster('material-categories', { ...p, active: true })), allPages(p => brewApi.listMaster('beer-categories', { ...p, active: true })), allPages(p => brewApi.listMaster('equipment', { ...p, active: true }))
    ]);
    equipment.value = equipment.value.filter(e => e.brew_equipment_type === 'mash');
  });
  loading.value = false;
}
function startCreate() { newVersionRecipeId.value = null; notice.value = ''; basic.value = { name: '', beer_category_id: '', beer_subcategory_id: '', notes: '' }; design.value = emptyDesign(); version.value = null; editing.value = true; wizard.value = 1; tab.value = 'recipe'; error.value = ''; }
function startVersion() {
  startCreate(); newVersionRecipeId.value = selectedRecipe.value.id;
  Object.assign(basic.value, { name: selectedRecipe.value.name, beer_category_id: selectedRecipe.value.beer_category?.id || '', beer_subcategory_id: selectedRecipe.value.beer_subcategory?.id || '' });
}
function selectSystem() {
  if (!system.value) return;
  const e = system.value;
  design.value.brew_volume_l = Number(e.brew_capacity_l) || design.value.brew_volume_l;
  design.value.mash.efficiency = Number(e.brew_saccharification_efficiency) || 72;
  design.value.mash.screen_water_l = Number(e.brew_screen_water_l) || 0;
}
async function openRecipe(recipe) { await run(async () => { selectedRecipe.value = recipe; versions.value = await brewApi.listRecipeVersions(recipe.id); }); }
async function openVersion(item) {
  await run(async () => {
    newVersionRecipeId.value = null; notice.value = ''; returnReason.value = '';
    version.value = await brewApi.getRecipeVersion(item.id);
    design.value = normalizeDesign(version.value.design, version.value);
    basic.value = { name: selectedRecipe.value.name, beer_category_id: selectedRecipe.value.beer_category?.id || '', beer_subcategory_id: selectedRecipe.value.beer_subcategory?.id || '', notes: version.value.notes || '' };
    editing.value = true; wizard.value = 2; tab.value = 'recipe';
  });
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
function newStep() { return { condition: 'time', schedule_type: 'daily', day_value: 1, interval_days: 1, operator: '>=', condition_value: '', action: 'measure_gravity', target: '' }; }
function setManualWater() { design.value.mash.sparge_water_liters = [...metrics.value.spargeWaters]; design.value.mash.sparge_mode = 'manual'; }
function changeSpargeCount() { design.value.mash.sparge_mode = 'auto'; }
function changeIbuMethod() { if (design.value.ibu_method === 'fixed') design.value.hops.forEach(l => { if (l.use === 'boil' && ![60, 30, 0].includes(Number(l.time))) l.time = 60; }); }
function validateDesign() {
  const d = design.value;
  if (!basic.value.name || !basic.value.beer_category_id || !basic.value.beer_subcategory_id || !d.brew_equipment_id) throw new Error('请先补全基础信息和酿造设备。');
  for (const f of mashFields) if (!present(d.mash[f.key]) || d.mash[f.key] < f.min || (f.max && d.mash[f.key] > f.max)) throw new Error(`请检查糖化参数：${f.label}`);
  if (!Number.isInteger(Number(d.mash.sparge_count)) || d.mash.sparge_count < 1 || d.mash.sparge_count > 10) throw new Error('洗糟次数须为 1–10 的整数。');
  for (const s of d.mash.steps) if (!s.name?.trim() || !present(s.temperature) || s.temperature < 0 || s.temperature > 100 || !present(s.duration_min) || s.duration_min < 1) throw new Error('请补全糖化步骤名称、温度和时间。');
  if (!(Number(d.brew_volume_l) > 0)) throw new Error('酿造体积必须大于零。');
  if (system.value?.brew_capacity_l && d.brew_volume_l > system.value.brew_capacity_l) throw new Error('酿造体积超过设备容量。');
  for (const { key, title } of groups) for (const l of d[key]) {
    if (!l.material_id || !(Number(l.quantity) > 0)) throw new Error(`${title}需要选择商品并填写大于零的用量。`);
  }
  if (d.hops.some(l => l.use === 'boil' && Number(l.time) > Number(d.mash.boil_time_min))) throw new Error('酒花煮沸时长不能超过总煮沸时间。');
  if (d.ibu_method === 'tinseth' && d.hops.some(l => ['FWH', 'WP'].includes(l.use) && !present(l.utilization_override))) throw new Error('FWH/WP 请填写本次工艺的利用率，或选择原稿固定异构率模式。');
  if (d.mash.sparge_mode === 'manual' && Math.abs(metrics.value.spargeDifference) > .05) throw new Error('每次洗糟水量合计应与计算总量一致，请调整或恢复自动分配。');
  for (const s of d.fermentation.steps) {
    if (s.condition === 'time' && !['daily', 'day', 'interval'].includes(s.schedule_type)) throw new Error('旧版本的时间选项未正确保存，请重新选择每天、第几天或每隔几天。');
    if (s.condition !== 'time' && !present(s.condition_value)) throw new Error('请填写发酵条件达成值。');
    if (s.condition === 'time' && s.schedule_type !== 'daily' && !(Number(s[s.schedule_type === 'day' ? 'day_value' : 'interval_days']) >= 1)) throw new Error('发酵时间须填写大于等于 1 的天数。');
    if (['cool_to', 'increase_pressure'].includes(s.action) && !present(s.target)) throw new Error('降温、升压动作需要填写数值目标。');
  }
}
function payload() {
  const d = JSON.parse(JSON.stringify(design.value));
  d.schema_version = 2; d.calculation_version = '2026-09-24';
  d.mash.sparge_water_liters = [...metrics.value.spargeWaters];
  const total = metrics.value.totalQuantity;
  d.fermentables.forEach(l => { l.ratio = total ? Number(l.quantity) / total * 100 : 0; });
  d.calculated = { ...metrics.value };
  return { base_volume_l: Number(d.brew_volume_l), original_gravity: Number(d.targets.og) || 0, final_gravity: Number(d.targets.fg) || 0, bitterness_ibu: Number(d.targets.ibu) || 0, color_ebc: Number(d.targets.color) || 0, alcohol_abv: Number(d.targets.abv) || 0, notes: basic.value.notes, design: d };
}
async function save() {
  if (wizard.value === 1) { next(); return; }
  if (!editable.value || saving.value || !form.value.reportValidity()) return;
  saving.value = true;
  await run(async () => {
    validateDesign();
    if (version.value) version.value = await brewApi.updateRecipeVersion(version.value.id, { ...payload(), record_version: version.value.record_version });
    else if (newVersionRecipeId.value) version.value = await brewApi.createRecipeVersion(newVersionRecipeId.value, payload());
    else {
      const recipe = await brewApi.createRecipe({ name: basic.value.name, beer_category_id: Number(basic.value.beer_category_id), beer_subcategory_id: Number(basic.value.beer_subcategory_id), initial_version: payload() });
      selectedRecipe.value = recipe;
      version.value = recipe.initial_version;
    }
    if (!version.value?.id) throw new Error('后端未返回配方版本，请刷新服务后重试。');
    const reloaded = await brewApi.getRecipeVersion(version.value.id);
    version.value = reloaded; design.value = normalizeDesign(reloaded.design, reloaded);
    versions.value = await brewApi.listRecipeVersions(selectedRecipe.value.id);
    recipes.value = await allPages(p => brewApi.listRecipes(p));
    notice.value = '配方草稿已保存并重新读取，原料和工艺明细已同步。';
  });
  saving.value = false;
}
async function action(name) {
  if (saving.value) return;
  saving.value = true;
  await run(async () => {
    if (name === 'return' && !returnReason.value.trim()) throw new Error('请填写退回原因。');
    if (name === 'submit') {
      validateDesign();
      version.value = await brewApi.updateRecipeVersion(version.value.id, { ...payload(), record_version: version.value.record_version });
    }
    const id = version.value.id;
    await brewApi.recipeVersionAction(id, name, version.value.record_version, returnReason.value);
    version.value = await brewApi.getRecipeVersion(id);
    versions.value = await brewApi.listRecipeVersions(selectedRecipe.value.id);
    recipes.value = await allPages(p => brewApi.listRecipes(p));
    notice.value = `版本状态：${stateNames[version.value.state]}`;
  });
  saving.value = false;
}
async function copyVersion(item) { await run(async () => { const copy = await brewApi.copyRecipeVersion(item.id); await openVersion(copy); versions.value = await brewApi.listRecipeVersions(selectedRecipe.value.id); }); }
function scale() { run(() => scaleToTarget(design.value)); }
onMounted(load);
</script>

<template>
  <div class="recipe-workspace">
    <div class="panel">
      <div class="panel-header"><div><div class="panel-title">配方版本库</div><div class="panel-subtitle">设计原料与工艺，保存草稿后提交审核</div></div><div class="master-actions"><button class="btn btn-secondary" @click="load">刷新</button><button v-if="canManage" class="btn btn-primary" @click="startCreate">新建配方工艺</button></div></div>
      <div v-if="notice" class="rw-notice" role="status">{{ notice }}</div>
      <div v-if="error && !editing" class="master-error" role="alert">{{ error }}</div>
      <div class="panel-body recipe-list"><div v-if="loading" class="empty">加载中…</div><div v-for="recipe in recipes" :key="recipe.id" class="recipe-card"><div class="recipe-card-main"><strong>{{ recipe.name }}</strong><span>{{ recipe.code }} · {{ recipe.active_version_id ? '使用中' : '待启用' }}</span></div><button class="btn btn-outline" @click="openRecipe(recipe)">查看版本</button></div></div>
    </div>
    <div v-if="selectedRecipe" class="panel"><div class="panel-header"><strong>{{ selectedRecipe.name }} · 版本</strong><button v-if="canManage" class="btn btn-outline" @click="startVersion">新建草稿版本</button></div><div class="panel-body recipe-list"><div v-for="item in versions" :key="item.id" class="recipe-card"><div class="recipe-card-main"><strong>{{ item.name }}</strong><span>{{ stateNames[item.state] }}</span></div><button class="btn btn-outline" @click="openVersion(item)">查看 / 编辑</button><button v-if="canManage" class="btn btn-secondary" @click="copyVersion(item)">复制为草稿</button></div></div></div>

    <form v-if="editing" ref="form" class="equipment-modal-mask rw-mask" @submit.prevent="save">
      <div class="equipment-modal rw-modal" :class="{ 'rw-basic-modal': wizard === 1 }">
        <div class="equipment-modal-header"><div><div class="modal-title">{{ version ? basic.name + ' · ' + stateNames[version.state] : '新增配方工艺' }}</div><div class="modal-subtitle">{{ wizard === 1 ? '先确定啤酒风格与酿造规模，再开始设计配方。' : '配置原料、糖化与发酵工艺，完成后保存草稿。' }}</div></div><button type="button" class="equipment-close" aria-label="关闭配方编辑" :disabled="saving" @click="editing = false; picker = null">×</button></div>
        <div class="rw-body">
          <div v-if="error" class="master-error" role="alert">{{ error }}</div>
          <div v-if="notice && version" class="rw-notice" role="status">{{ notice }}</div>
          <fieldset :disabled="!editable || saving">
            <div v-if="wizard === 1" class="rw-basic">
              <ol class="rw-progress" aria-label="配方创建步骤"><li aria-current="step"><b>01</b><span>基础信息</span></li><li><b>02</b><span>配方与工艺设计</span></li></ol>
              <div class="rw-basic-grid">
                <section class="rw-basic-card" aria-labelledby="rw-beer-heading">
                  <div class="rw-basic-heading"><h3 id="rw-beer-heading">啤酒信息</h3><p>为这款啤酒命名，选择对应的风格。</p></div>
                  <div class="rw-basic-fields">
                    <label class="rw-field-wide"><span>啤酒名称 *</span><input v-model.trim="basic.name" :readonly="!!version || !!newVersionRecipeId" required maxlength="100" placeholder="例如：夏日淡色艾尔"></label>
                    <label><span>啤酒分类 *</span><select v-model="basic.beer_category_id" :class="{ 'rw-placeholder': !basic.beer_category_id }" :disabled="!!version || !!newVersionRecipeId" required @change="basic.beer_subcategory_id = ''"><option value="">请选择分类</option><option v-for="c in beerParents" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
                    <label><span>啤酒种类 *</span><select v-model="basic.beer_subcategory_id" :class="{ 'rw-placeholder': !basic.beer_subcategory_id }" :disabled="!!version || !!newVersionRecipeId || !basic.beer_category_id" required><option value="">{{ basic.beer_category_id ? '请选择种类' : '请先选择分类' }}</option><option v-for="c in beerChildren" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
                  </div>
                </section>
                <section class="rw-basic-card" aria-labelledby="rw-batch-heading">
                  <div class="rw-basic-heading"><h3 id="rw-batch-heading">酿造设置</h3><p>确定使用设备与本批次的酿造规模。</p></div>
                  <div class="rw-basic-fields">
                    <label class="rw-field-wide"><span>使用设备 *</span><select v-model="design.brew_equipment_id" :class="{ 'rw-placeholder': !design.brew_equipment_id }" required @change="selectSystem"><option value="">请选择酿造系统</option><option v-for="e in equipment" :key="e.id" :value="e.id">{{ e.name }} · {{ e.brew_capacity_l }} L</option></select></label>
                    <label><span>酿造体积(L) *</span><input v-model.number="design.brew_volume_l" required type="number" min="0.1" step="0.1" :max="system?.brew_capacity_l || undefined"></label>
                    <label><span>目标 OG（SG，选填）</span><input v-model.number="design.targets.og" type="number" min="1" max="1.3" step="0.001" placeholder="例如 1.050"></label>
                  </div>
                </section>
              </div>
              <div class="rw-basic-help"><span>带 * 的项目为必填项</span><p>选择设备后会带入容量，可按实际批次调整。目标 OG 可暂不填写。</p></div>
            </div>
          </fieldset>
          <template v-if="wizard === 2">
            <div class="rw-tabs"><button v-for="t in [['recipe','配方设计'],['mash','糖化工艺'],['fermentation','发酵工艺']]" :key="t[0]" type="button" :class="{ active: tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</button></div>
            <fieldset :disabled="!editable || saving">
              <div v-if="tab === 'recipe'" class="rw-sections">
                <section v-for="group in groups" :key="group.key" class="rw-section">
                  <div class="rw-heading"><strong>{{ group.title }}</strong><button type="button" class="btn btn-outline" @click="addLine(group.key)">＋ {{ group.add }}</button></div>
                  <div v-if="group.key === 'hops'" class="rw-fields"><label><span>苦味值计算模式</span><select v-model="design.ibu_method" @change="changeIbuMethod"><option value="tinseth">Tinseth（煮沸时长与比重）</option><option value="fixed">原稿固定异构率</option></select></label><p class="rw-hint">煮沸时长指酒花投放后继续煮沸的分钟数。DH 不计入预计 IBU；Tinseth 下 FWH/WP 需填写工艺利用率。</p></div>
                  <div class="rw-table-scroll"><table class="rw-table">
                    <colgroup v-if="group.key === 'fermentables'"><col style="width:28%"><col style="width:12%"><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:20%"><col style="width:6%"></colgroup>
                    <colgroup v-else-if="group.key === 'hops'"><col style="width:25%"><col style="width:11%"><col style="width:11%"><col style="width:15%"><col style="width:12%"><col style="width:11%"><col style="width:9%"><col style="width:6%"></colgroup>
                    <colgroup v-else><col style="width:27%"><col style="width:12%"><col style="width:12%"><col style="width:15%"><col style="width:28%"><col style="width:6%"></colgroup>
                    <thead><tr><th>供应商商品</th><th>数量({{ group.key === 'fermentables' ? 'kg' : 'g' }})</th><template v-if="group.key === 'fermentables'"><th>比例(%)</th><th>浸出率(%)</th><th>色度(EBC)</th><th>备注</th></template><template v-else-if="group.key === 'hops'"><th>Alpha酸(%)</th><th>投放阶段</th><th>煮沸时长(min)</th><th>利用率(%)</th><th>预计 IBU</th></template><template v-else><th>发酵度(%)</th><th>发酵温度(℃)</th><th>风味描述</th></template><th>操作</th></tr></thead>
                    <tbody><tr v-for="(line, index) in design[group.key]" :key="index"><td><button type="button" class="rw-picker" @click="choose(group.key, line)"><strong>{{ line.name || '点击选择商品' }}</strong><small>{{ line.supplier || '供应商商品库' }} · 更换 ›</small></button></td><td><input v-model.number="line.quantity" type="number" min="0.001" step="any" required aria-label="原料数量"></td>
                      <template v-if="group.key === 'fermentables'"><td>{{ fmt(metrics.totalQuantity ? line.quantity / metrics.totalQuantity * 100 : 0, 2) }}</td><td>{{ line.extract_rate }}</td><td>{{ line.color }}</td><td><input v-model="line.notes" aria-label="原料备注"></td></template>
                      <template v-else-if="group.key === 'hops'"><td>{{ line.alpha_acid }}</td><td><select v-model="line.use" aria-label="投放阶段"><option value="boil">煮沸</option><option value="FWH">FWH 首麦汁</option><option value="0">0 熄火</option><option value="WP">WP 回旋</option><option value="DH">DH 干投</option></select></td><td><template v-if="line.use === 'boil'"><select v-if="design.ibu_method === 'fixed'" v-model="line.time" aria-label="煮沸时长"><option :value="60">60</option><option :value="30">30</option><option :value="0">0</option></select><input v-else v-model.number="line.time" required type="number" min="0" :max="design.mash.boil_time_min" step="1" aria-label="煮沸时长"></template><span v-else>—</span></td><td><input v-if="design.ibu_method === 'tinseth' && ['FWH','WP'].includes(line.use)" v-model.number="line.utilization_override" required type="number" min="0" max="100" step="0.1" placeholder="工艺值" aria-label="工艺利用率"><span v-else>{{ fmt(metrics.hopResults[index].utilization, 2) }}</span></td><td>{{ fmt(metrics.hopResults[index].ibu) }}</td></template>
                      <template v-else><td>{{ present(line.attenuation) ? line.attenuation : '未提供' }}</td><td><input v-model.number="line.temperature" type="number" step="0.1" aria-label="发酵温度"></td><td class="rw-flavor">{{ line.flavor || '供应商未填写' }}</td></template>
                      <td><button type="button" class="btn btn-danger" aria-label="删除原料" @click="removeLine(group.key, index)">×</button></td></tr><tr v-if="!design[group.key].length"><td :colspan="group.key === 'hops' ? 8 : group.key === 'fermentables' ? 7 : 6" class="empty">点击右上角“{{ group.add }}”选择供应商商品</td></tr></tbody>
                  </table></div>
                  <div v-if="group.key === 'fermentables'" class="rw-summary"><span>麦芽总量 <b>{{ fmt(metrics.totalQuantity, 2) }} kg</b></span><span>预计 OG <b>{{ fmt(metrics.og, 3) }}</b></span><span>预计色度 <b>{{ fmt(metrics.color) }} EBC</b></span></div>
                  <div v-if="group.key === 'hops'" class="rw-summary"><span>酒花总量 <b>{{ fmt(design.hops.reduce((s,l) => s + Number(l.quantity || 0), 0)) }} g</b></span><span>预计 IBU <b>{{ fmt(metrics.ibu) }}</b></span></div>
                  <div v-if="group.key === 'yeast'" class="rw-fields"><label><span>本配方预计发酵度(%，选填)</span><input v-model.number="design.attenuation_override" type="number" min="0" max="100" step="0.1" placeholder="默认使用单一酵母商品值"></label><p class="rw-hint">多种酵母合用或商品缺少发酵度时，请填写配方预计发酵度；未填写时 FG 和酒精度显示待计算。</p></div>
                </section>
                <section class="rw-section"><div class="rw-heading"><strong>目标指标（选填）</strong><button type="button" class="btn btn-outline" @click="scale">按目标 OG 等比例调整麦芽</button></div><div class="rw-fields"><label v-for="f in targetFields" :key="f.key"><span>{{ f.label }}</span><input v-model.number="design.targets[f.key]" type="number" :min="f.min" :step="f.step"></label></div></section>
                <section class="rw-section"><div class="rw-heading"><strong>配方预计结果</strong><span class="rw-hint">预计值，不代表实测结果</span></div><div class="rw-summary"><span v-for="[key,label,digits] in [['og','OG（SG）',3],['fg','FG（SG）',3],['ibu','IBU',1],['color','色度（EBC）',1],['abv','酒精度（% ABV）',1]]" :key="key">{{ label }}<b>{{ fmt(metrics[key],digits) }}</b></span></div></section>
              </div>
              <div v-if="tab === 'mash'" class="rw-sections">
                <section class="rw-section"><div class="rw-heading"><strong>糖化参数</strong><span class="rw-hint">设备提供初始值，本配方可调整</span></div><div class="rw-fields"><label v-for="f in mashFields" :key="f.key"><span>{{ f.label }}</span><input v-model.number="design.mash[f.key]" type="number" :min="f.min" :max="f.max" step="any" required></label></div><div class="rw-summary"><span v-for="[key,label] in [['preBoilVolume','煮沸前体积'],['mashWater','糖化用水'],['absorption','麦芽吸水'],['firstWort','头道麦汁'],['spargeWater','所需洗糟水'],['totalWater','总用水量']]" :key="key">{{ label }}<b>{{ fmt(metrics[key],2) }} L</b></span></div></section>
                <section class="rw-section"><div class="rw-heading"><strong>洗糟水量</strong><button type="button" class="btn btn-outline" @click="design.mash.sparge_mode = 'auto'">恢复自动分配</button></div><div class="rw-fields"><label><span>洗糟次数</span><input v-model.number="design.mash.sparge_count" type="number" min="1" max="10" required @change="changeSpargeCount"></label><label v-for="(water,i) in metrics.spargeWaters" :key="i"><span>第 {{ i+1 }} 次(L)</span><input :value="water" type="number" min="0" step="0.01" required @input="setManualWater(); design.mash.sparge_water_liters[i] = Number($event.target.value)"></label></div><p :class="Math.abs(metrics.spargeDifference) > .05 ? 'master-error' : 'rw-hint'">合计 {{ fmt(metrics.actualSparge,2) }} L · 与所需水量相差 {{ fmt(metrics.spargeDifference,2) }} L</p></section>
                <section class="rw-section"><div class="rw-heading"><strong>糖化温度 / 时间步骤</strong><button type="button" class="btn btn-outline" @click="design.mash.steps.push({ name: '', temperature: 65, duration_min: 60 })">＋ 添加步骤</button></div><div v-for="(s,i) in design.mash.steps" :key="i" class="rw-fields rw-step"><label><span>步骤 {{ i+1 }}</span><input v-model="s.name" required placeholder="如：糖化休止"></label><label><span>温度(℃)</span><input v-model.number="s.temperature" required type="number" min="0" max="100" step="0.1"></label><label><span>时间(min)</span><input v-model.number="s.duration_min" required type="number" min="1" step="1"></label><button type="button" class="btn btn-danger" @click="design.mash.steps.splice(i,1)">删除</button></div><label><span>糖化工艺说明</span><textarea v-model="design.mash.notes" rows="2"></textarea></label></section>
              </div>
              <div v-if="tab === 'fermentation'" class="rw-sections">
                <section class="rw-section"><div class="rw-fields"><label><span>目标发酵温度(℃)</span><input v-model.number="design.fermentation.target_temperature" type="number" step="0.1"></label><label><span>目标发酵天数</span><input v-model.number="design.fermentation.target_days" type="number" min="0" step="0.5"></label><label><span>冷储温度(℃)</span><input v-model.number="design.fermentation.cold_storage_temperature" type="number" step="0.1"></label></div></section>
                <section class="rw-section"><div class="rw-heading"><strong>发酵执行条件</strong><button type="button" class="btn btn-outline" @click="design.fermentation.steps.push(newStep())">＋ 添加步骤</button></div><div class="rw-table-scroll"><table class="rw-table rw-fermentation"><colgroup><col style="width:5%"><col style="width:15%"><col style="width:35%"><col style="width:19%"><col style="width:20%"><col style="width:6%"></colgroup><thead><tr><th>序号</th><th>条件</th><th>条件达成值</th><th>处理动作</th><th>处理目标值</th><th>操作</th></tr></thead><tbody><tr v-for="(s,i) in design.fermentation.steps" :key="i"><td>{{ i+1 }}</td><td><select v-model="s.condition" @change="s.condition_value = ''"><option v-for="(meta,key) in conditionMeta" :key="key" :value="key">{{ meta[0] }}</option></select></td><td><template v-if="s.condition === 'time'"><div class="rw-segment"><label v-for="[mode,label] in [['daily','每天'],['day','第几天'],['interval','每隔几天']]" :key="mode" :class="{ active: s.schedule_type === mode }"><input v-model="s.schedule_type" type="radio" :name="'schedule-'+i" :value="mode">{{ label }}</label></div><div v-if="s.schedule_type !== 'daily'" class="rw-condition"><span>{{ s.schedule_type === 'day' ? '第' : '每隔' }}</span><input v-if="s.schedule_type === 'day'" v-model.number="s.day_value" type="number" min="1" step="1" required><input v-else v-model.number="s.interval_days" type="number" min="1" step="1" required><span>天</span></div><p v-else class="rw-hint">每天执行一次</p></template><div v-else class="rw-condition"><select v-model="s.operator" aria-label="比较符"><option v-for="op in ['=','>','>=','<','<=']" :key="op" :value="op">{{ op }}</option></select><input v-model.number="s.condition_value" type="number" step="any" required :aria-label="conditionMeta[s.condition][0]"><span>{{ conditionMeta[s.condition][1] }}</span></div></td><td><select v-model="s.action"><option v-for="(label,key) in actions" :key="key" :value="key">{{ label }}</option></select></td><td><input v-model="s.target" :required="['cool_to','increase_pressure'].includes(s.action)" :placeholder="s.action === 'cool_to' ? '目标温度(℃)' : s.action === 'increase_pressure' ? '目标压力(bar)' : '选填'"></td><td><button type="button" class="btn btn-danger" @click="design.fermentation.steps.splice(i,1)">×</button></td></tr></tbody></table></div><label><span>发酵要求</span><textarea v-model="design.fermentation.notes" rows="3"></textarea></label><p class="rw-hint">发酵度条件使用实测糖度（°P）计算。此处保存执行规则；实测记录与自动任务执行属于生产环节。</p></section>
              </div>
              <p class="rw-hint rw-notes">保存时同步原料明细及糖化、煮沸和发酵工艺，并保留系统必需的进罐、转罐、包装放行确认节点。提交审核前请核对全部工艺。</p>
              <label class="rw-notes"><span>配方备注</span><textarea v-model="basic.notes" rows="2"></textarea></label>
            </fieldset>
          </template>
        </div>
        <div class="equipment-modal-footer"><button type="button" class="btn btn-secondary" :disabled="saving" @click="editing = false">关闭</button><button v-if="wizard === 2" type="button" class="btn btn-secondary" @click="wizard = 1">基础信息</button><button v-if="wizard === 1" type="button" class="btn btn-primary" @click="next">下一步</button><template v-else><button v-if="editable" type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中…' : '保存草稿' }}</button><button v-if="editable && version" type="button" class="btn btn-outline" :disabled="saving" @click="action('submit')">保存并提交审核</button><input v-if="canManage && version?.state === 'submitted'" v-model="returnReason" class="rw-return-reason" placeholder="退回原因"><button v-if="canManage && version?.state === 'submitted'" type="button" class="btn btn-outline" :disabled="saving" @click="action('return')">退回修改</button><button v-if="canManage && version?.state === 'submitted'" type="button" class="btn btn-primary" :disabled="saving" @click="action('approve')">审核通过</button><button v-if="canManage && version?.state === 'approved'" type="button" class="btn btn-primary" :disabled="saving" @click="action('activate')">启用版本</button><button v-if="canManage && version?.state === 'active'" type="button" class="btn btn-outline" :disabled="saving" @click="action('deactivate')">停用版本</button></template></div>
      </div>
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
.rw-return-reason { width:220px; }
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
.rw-field-wide { grid-column:1 / -1; }
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
.rw-fermentation { min-width:980px; }
.rw-condition { display:grid; grid-template-columns:75px minmax(80px,1fr) 40px; gap:8px; align-items:center; margin-top:8px; }
.rw-segment { display:flex; gap:4px; padding:4px; background:var(--bg-input); border-radius:8px; }
.rw-segment label { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:7px 2px; border:1px solid transparent; border-radius:6px; cursor:pointer; white-space:nowrap; }
.rw-segment input { width:13px; accent-color:var(--accent-gold); margin:0; }
.rw-segment .active { color:var(--accent-gold); border-color:rgba(212,168,83,.45); background:rgba(212,168,83,.1); }
.rw-picker-mask { z-index:150; }
.rw-invalid-product { opacity:.62; cursor:not-allowed; }
.rw-unit-warning { background:rgba(219,101,89,.15)!important; color:#e6948c!important; }
@media(max-width:700px) { .rw-body { padding:12px; } .rw-fields { grid-template-columns:1fr; } .rw-fields > .rw-hint { grid-column:auto; } .rw-section { padding:12px; } .rw-catalog-grid { grid-template-columns:1fr; } .equipment-modal-footer { flex-wrap:wrap; } }
</style>
