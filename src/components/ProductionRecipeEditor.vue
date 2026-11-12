<script setup>
import { computed, ref, watch } from 'vue';
import { brewApi } from '../api';
import { calculateRecipe, normalizeDesign, present } from '../recipe-calculations';
import MashWorkflowDesigner from './MashWorkflowDesigner.vue';

const props = defineProps({
  visible: Boolean,
  sourceType: { type: String, default: 'base' },
  recipeVersionId: { type: String, default: '' },
  productionBatchId: { type: String, default: '' },
  equipmentId: { type: String, default: '' },
  plannedVolume: { type: Number, default: 0 },
  productName: { type: String, default: '' },
});
const emit = defineEmits(['close', 'save']);
const loading = ref(false), error = ref(''), tab = ref('recipe'), design = ref(null), materials = ref([]), categories = ref([]);
const metrics = computed(() => design.value ? calculateRecipe(design.value) : {});
const rawMaterials = computed(() => materials.value.filter(item => item.brew_item_type === 'raw_material'));
const materialGroups = { fermentables: ['malt', 'adjunct'], hops: ['hop'], yeast: ['yeast'] };
function materialGroup(item) { return categories.value.find(category => category.code === item.brew_material_category)?.material_group || item.brew_material_category; }
const materialChoices = key => rawMaterials.value.filter(item => materialGroups[key].includes(materialGroup(item)));
const conditions = [['time','时间'],['gravity','糖度'],['attenuation','实际发酵度'],['diacetyl','双乙酰'],['temperature','温度'],['pressure','压力']];
const actions = [['measure_gravity','测量糖度'],['measure_temperature','测量温度'],['measure_pressure','测量压力'],['measure_diacetyl','测量双乙酰'],['seal','封罐'],['dry_hop','干投'],['cool_to','降温至'],['dump_hops','排出酒花'],['centrifuge','离心'],['increase_pressure','升压至'],['package','出酒']];

function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
function scaleDesign(source, volume, version = {}) {
  const result = normalizeDesign(source, version);
  const original = Number(result.brew_volume_l) || Number(volume) || 1;
  const ratio = Number(volume) > 0 ? Number(volume) / original : 1;
  for (const key of ['fermentables', 'hops', 'yeast']) {
    result[key].forEach(line => { line.quantity = Number((Number(line.quantity || 0) * ratio).toFixed(4)); });
  }
  result.brew_volume_l = Number(volume) || original;
  result.brew_equipment_id = String(props.equipmentId || result.brew_equipment_id || '');
  result.mash.sparge_mode = 'auto';
  result.mash.sparge_water_liters = [];
  return result;
}
function newLine(key) {
  if (key === 'fermentables') return { material_id: '', name: '', quantity: '', ratio: '', extract_rate: '', color: '', notes: '' };
  if (key === 'hops') return { material_id: '', name: '', quantity: '', use: 'boil', time: 60, alpha_acid: '', utilization_override: '', notes: '' };
  return { material_id: '', name: '', quantity: '', temperature: '', attenuation: '', flavor: '', notes: '' };
}
function addLine(key) { design.value[key].push(newLine(key)); }
function removeLine(key, index) { design.value[key].splice(index, 1); }
function chooseMaterial(key, line) {
  const item = materialChoices(key).find(row => String(row.id) === String(line.material_id));
  if (!item) return;
  Object.assign(line, {
    name: item.name,
    extract_rate: item.brew_extract_rate ?? line.extract_rate ?? '',
    color: item.brew_color_ebc ?? line.color ?? '',
    alpha_acid: item.brew_alpha_acid ?? line.alpha_acid ?? '',
    attenuation: item.brew_extract_rate ?? line.attenuation ?? '',
    flavor: item.brew_flavor_desc || line.flavor || '',
  });
}
function addFermentationStep() { design.value.fermentation.steps.push({ condition: 'time', schedule_type: 'daily', day_value: 1, interval_days: 1, operator: '>=', condition_value: '', action: 'measure_gravity', target: '' }); }
function finishDesign() {
  const result = deepCopy(design.value);
  result.schema_version = 2;
  result.calculation_version = result.mash.water_calculation === 'original' ? '2026-10-28-original' : '2026-09-24';
  result.brew_volume_l = Number(props.plannedVolume);
  result.brew_equipment_id = String(props.equipmentId || result.brew_equipment_id);
  for (const [key, label, min, max] of [['evaporation_rate', '煮沸强度', 0, 100], ['water_grain_ratio', '糖化水料比', .1], ['boil_time_min', '煮沸时间', 1], ['sparge_count', '洗糟次数', 1, 10]]) {
    const value = result.mash[key];
    if (!present(value) || Number(value) < min || (max != null && Number(value) > max)) throw new Error(`请填写有效的${label}。`);
  }
  if (!Number.isInteger(Number(result.mash.sparge_count))) throw new Error('洗糟次数须为 1–10 的整数。');
  const water = calculateRecipe(result);
  if (result.mash.sparge_mode === 'manual' && result.mash.sparge_water_liters.some(value => !present(value) || value < 0)) throw new Error('请为每次洗糟填写有效的用水量。');
  if (result.mash.sparge_mode === 'manual' && Math.abs(water.spargeDifference) > .005) throw new Error('每次洗糟水量合计须与所需洗糟水量一致。');
  result.mash.sparge_water_liters = [...water.spargeWaters];
  const total = calculateRecipe(result).totalQuantity;
  result.fermentables.forEach(line => { line.ratio = total ? Number(line.quantity || 0) / total * 100 : 0; });
  result.calculated = calculateRecipe(result);
  if (result.fermentables.some(line => !line.material_id || !(Number(line.quantity) > 0))) throw new Error('麦芽与可发酵物必须选择原料并填写用量。');
  if (result.hops.some(line => !line.material_id || !(Number(line.quantity) > 0))) throw new Error('酒花必须选择原料并填写用量。');
  if (result.yeast.some(line => !line.material_id || !(Number(line.quantity) > 0))) throw new Error('酵母必须选择原料并填写用量。');
  if (!result.mash.steps.length) throw new Error('请至少配置一个糖化温度和时间步骤，以便计算预热温度。');
  if (result.mash.steps.some(step => !step.name?.trim() || !(Number(step.temperature) >= 0) || !(Number(step.duration_min) >= 1))) throw new Error('请补全糖化步骤的名称、温度和时长。');
  if (result.hops.some(line => line.use === 'boil' && Number(line.time) > Number(result.mash.boil_time_min))) throw new Error('酒花煮沸时长不能超过总煮沸时间。');
  for (const step of result.fermentation.steps) {
    if (step.condition === 'time' && !['daily', 'day', 'interval'].includes(step.schedule_type)) throw new Error('请选择有效的发酵时间条件。');
    if (step.condition !== 'time' && !['=', '>', '>=', '<', '<='].includes(step.operator)) throw new Error('请选择有效的条件比较符。');
    if (step.condition !== 'time' && step.condition_value === '') throw new Error('请填写发酵条件达成值。');
    if (['cool_to', 'increase_pressure'].includes(step.action) && step.target === '') throw new Error('降温或升压步骤需要填写目标值。');
  }
  return result;
}
function save() {
  error.value = '';
  try { emit('save', finishDesign()); }
  catch (cause) { error.value = cause.message || '配方设计校验失败。'; }
}
async function load() {
  loading.value = true; error.value = '';
  try {
    const jobs = [brewApi.listMaster('materials', { page: 1, page_size: 100, active: true }), brewApi.listMaster('material-categories', { page: 1, page_size: 100, active: true })];
    if (props.sourceType === 'production') jobs.push(brewApi.getProductionBatch(props.productionBatchId));
    else jobs.push(brewApi.getRecipeVersion(props.recipeVersionId));
    const [loadedMaterials, loadedCategories, source] = await Promise.all(jobs);
    materials.value = loadedMaterials;
    categories.value = loadedCategories;
    let detail = source;
    if (props.sourceType === 'production') {
      const snapshot = source.recipe_snapshot || {};
      detail = { ...source, design: snapshot.design || {} };
      if (!detail.design.schema_version && props.recipeVersionId) detail = await brewApi.getRecipeVersion(props.recipeVersionId);
    }
    if (!detail.design || Number(detail.design.schema_version) !== 2) throw new Error('该配方版本没有可编辑的结构化设计，请先完善基础工艺设计。');
    design.value = scaleDesign(detail.design, props.plannedVolume, detail);
    tab.value = 'recipe';
  } catch (cause) { error.value = cause.message || '配方设计加载失败。'; }
  finally { loading.value = false; }
}
watch(() => [props.visible, props.sourceType, props.recipeVersionId, props.productionBatchId], ([visible]) => { if (visible) load(); }, { immediate: true });
</script>

<template>
  <div v-if="visible" class="equipment-modal-mask production-recipe-mask" @click.self="emit('close')">
    <section class="equipment-modal production-recipe-editor" role="dialog" aria-modal="true" aria-label="生产版配方设计">
      <header class="equipment-modal-header"><div><div class="modal-title">生产版配方设计</div><div class="modal-subtitle">{{ productName }} · {{ plannedVolume }} L · 编辑内容仅保存到本生产计划</div></div><button class="equipment-close" type="button" aria-label="关闭" @click="emit('close')">×</button></header>
      <div class="equipment-modal-body production-recipe-body">
        <div v-if="loading" class="empty">正在加载配方设计…</div>
        <template v-else-if="design">
          <div class="production-recipe-notice">保存后将生成本计划专属的生产版本，基础工艺和其他计划不会被修改。设计产量已按本计划产量换算。</div>
          <nav class="production-recipe-tabs"><button v-for="item in [['recipe','配方与原料'],['mash','糖化工艺'],['fermentation','发酵工艺']]" :key="item[0]" type="button" :class="{ active: tab === item[0] }" @click="tab = item[0]">{{ item[1] }}</button></nav>
          <section v-if="tab === 'recipe'" class="production-recipe-section">
            <div class="production-recipe-facts"><div><small>计划设计产量</small><strong>{{ plannedVolume }} L</strong></div><div><small>目标原麦汁浓度</small><strong>{{ design.targets.og || '—' }}</strong></div><div><small>目标酒精度</small><strong>{{ design.targets.abv || '—' }}%</strong></div><div><small>目标苦味值</small><strong>{{ design.targets.ibu || '—' }} IBU</strong></div></div>
            <div class="production-recipe-group"><div class="production-recipe-group-title">麦芽与可发酵物 <button class="btn btn-xs btn-outline" type="button" @click="addLine('fermentables')">＋ 添加原料</button></div><div v-for="(line,index) in design.fermentables" :key="'grain-'+index" class="production-recipe-line"><select v-model="line.material_id" required @change="chooseMaterial('fermentables',line)"><option value="">选择原料</option><option v-for="item in materialChoices('fermentables')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" min="0.001" step="0.001" placeholder="用量 kg"><input v-model.number="line.extract_rate" type="number" min="0" max="100" step="0.1" placeholder="浸出率 %"><input v-model.number="line.color" type="number" min="0" step="0.1" placeholder="色度 EBC"><button class="production-recipe-remove" type="button" aria-label="删除麦芽原料" @click="removeLine('fermentables',index)">×</button></div><div v-if="!design.fermentables.length" class="empty">没有麦芽原料</div></div>
            <div class="production-recipe-group"><div class="production-recipe-group-title">啤酒花 <button class="btn btn-xs btn-outline" type="button" @click="addLine('hops')">＋ 添加酒花</button></div><div v-for="(line,index) in design.hops" :key="'hop-'+index" class="production-recipe-line"><select v-model="line.material_id" required @change="chooseMaterial('hops',line)"><option value="">选择酒花</option><option v-for="item in materialChoices('hops')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" min="0.001" step="0.1" placeholder="用量 g"><select v-model="line.use"><option value="boil">煮沸投放</option><option value="FWH">第一麦汁</option><option value="WP">旋沉投放</option><option value="DH">干投</option><option value="0">冷端投放</option></select><input v-if="line.use === 'boil'" v-model.number="line.time" type="number" min="0" placeholder="煮沸 min"><input v-model.number="line.alpha_acid" type="number" min="0" max="100" step="0.1" placeholder="α 酸 %"><button class="production-recipe-remove" type="button" aria-label="删除酒花" @click="removeLine('hops',index)">×</button></div><div v-if="!design.hops.length" class="empty">没有酒花原料</div></div>
            <div class="production-recipe-group"><div class="production-recipe-group-title">酵母 <button class="btn btn-xs btn-outline" type="button" @click="addLine('yeast')">＋ 添加酵母</button></div><div v-for="(line,index) in design.yeast" :key="'yeast-'+index" class="production-recipe-line"><select v-model="line.material_id" required @change="chooseMaterial('yeast',line)"><option value="">选择酵母</option><option v-for="item in materialChoices('yeast')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" min="0.001" step="0.1" placeholder="用量 g"><input v-model.number="line.temperature" type="number" step="0.1" placeholder="发酵温度 ℃"><input v-model="line.flavor" placeholder="风味备注"><button class="production-recipe-remove" type="button" aria-label="删除酵母" @click="removeLine('yeast',index)">×</button></div><div v-if="!design.yeast.length" class="empty">没有酵母原料</div></div>
            <div class="production-recipe-group"><div class="production-recipe-group-title">目标指标</div><div class="production-recipe-metrics"><label><span>OG</span><input v-model.number="design.targets.og" type="number" min="1" step="0.001"></label><label><span>FG</span><input v-model.number="design.targets.fg" type="number" min="0.9" step="0.001"></label><label><span>IBU</span><input v-model.number="design.targets.ibu" type="number" min="0" step="0.1"></label><label><span>色度（EBC）</span><input v-model.number="design.targets.color" type="number" min="0" step="0.1"></label><label><span>酒精度（%）</span><input v-model.number="design.targets.abv" type="number" min="0" step="0.1"></label><label><span>发酵度（%）</span><input v-model.number="design.attenuation_override" type="number" min="0" max="100" step="0.1"></label></div></div>
          </section>
          <section v-else-if="tab === 'mash'" class="production-recipe-section"><MashWorkflowDesigner :mash="design.mash" :metrics="metrics" /></section>
          <section v-else class="production-recipe-section">
            <div class="production-recipe-metrics"><label><span>目标发酵温度（℃）</span><input v-model.number="design.fermentation.target_temperature" type="number" step="0.1"></label><label><span>目标发酵天数</span><input v-model.number="design.fermentation.target_days" type="number" min="0" step="0.5"></label><label><span>冷储温度（℃）</span><input v-model.number="design.fermentation.cold_storage_temperature" type="number" step="0.1"></label></div>
            <label class="production-recipe-notes"><span>发酵工艺说明</span><textarea v-model.trim="design.fermentation.notes" rows="3" placeholder="接种、降温节点、压力控制和冷储要求"></textarea></label>
            <div class="production-recipe-group"><div class="production-recipe-group-title">发酵控制步骤 <button class="btn btn-xs btn-outline" type="button" @click="addFermentationStep">＋ 添加步骤</button></div><div v-for="(step,index) in design.fermentation.steps" :key="'ferm-step-'+index" class="production-recipe-line production-fermentation-line"><select v-model="step.condition"><option v-for="item in conditions" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select><template v-if="step.condition === 'time'"><select v-model="step.schedule_type"><option value="daily">每天</option><option value="day">第几天</option><option value="interval">每隔几天</option></select><input v-if="step.schedule_type !== 'daily'" v-model.number="step[step.schedule_type === 'day' ? 'day_value' : 'interval_days']" type="number" min="1" step="1" placeholder="天数"></template><template v-else><select v-model="step.operator"><option value=">=">≥</option><option value=">">＞</option><option value="=">＝</option><option value="<=">≤</option><option value="<">＜</option></select><input v-model.number="step.condition_value" type="number" step="0.1" placeholder="达成值"></template><select v-model="step.action"><option v-for="item in actions" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select><input v-if="['cool_to','increase_pressure'].includes(step.action)" v-model.number="step.target" type="number" step="0.1" placeholder="目标值"><button class="production-recipe-remove" type="button" aria-label="删除发酵步骤" @click="design.fermentation.steps.splice(index,1)">×</button></div><div v-if="!design.fermentation.steps.length" class="empty">暂无条件触发步骤</div></div>
          </section>
        </template>
        <div v-if="error" class="master-error">{{ error }}</div>
      </div>
      <footer class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="emit('close')">取消</button><button class="btn btn-primary" type="button" :disabled="loading || !design" @click="save">保存为本计划生产版</button></footer>
    </section>
  </div>
</template>
