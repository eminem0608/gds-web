<script setup>
import { computed, ref } from 'vue';
import { standardMashOperations } from '../recipe-calculations';

const props = defineProps({
  mash: { type: Object, required: true },
  fermentables: { type: Array, default: () => [] },
  hops: { type: Array, default: () => [] },
  fermentation: { type: Object, default: () => ({}) },
  metrics: { type: Object, default: () => ({}) },
});

const activeIndex = ref(0);
const stages = [
  { key: 'materials', title: '物料确认', short: '确认' },
  { key: 'water_mash', title: '准备糖化水与投料糖化', short: '用水糖化' },
  { key: 'lautering', title: '转槽与过滤', short: '过滤' },
  { key: 'sparge', title: '分轮洗糟', short: '洗糟' },
  { key: 'kettle', title: '进入煮沸锅', short: '进锅' },
  { key: 'boil', title: '煮沸与投花', short: '煮沸' },
  { key: 'whirlpool', title: '回旋与冷却', short: '冷却' },
  { key: 'transfer', title: '进发酵罐', short: '进罐' },
];
const activeStage = computed(() => stages[activeIndex.value]);
const firstRest = computed(() => props.mash.steps?.[0] || null);
const preheatTemperature = computed(() => firstRest.value && Number.isFinite(Number(firstRest.value.temperature))
  ? Number(firstRest.value.temperature) + Number(props.mash.workflow?.preheat_offset_c ?? 5)
  : null);
const stageOperations = computed(() => {
  const operations = props.mash.workflow?.operations || {};
  if (activeStage.value.key === 'water_mash') {
    return ['water', 'mash', 'water_mash'].flatMap(key => Array.isArray(operations[key]) ? operations[key] : []);
  }
  const list = operations[activeStage.value.key];
  return Array.isArray(list) ? list : [];
});
const spargeValues = computed(() => props.metrics.spargeWaters || props.mash.sparge_water_liters || []);
const iodinePositions = computed(() => Array.from({ length: Math.max(props.mash.steps?.length || 0, 4) + 1 }, (_, index) => index));
const inputModes = [
  ['confirm', '执行确认'], ['choice', '选择结果'], ['number', '录入数值'], ['text', '文字记录'],
];
const parameterFields = [
  ['efficiency', '糖化效率（%）', 0.1], ['water_grain_ratio', '料水比（L/kg）', 0.1],
  ['absorption_rate', '麦芽吸水率（L/kg）', 0], ['boil_time_min', '煮沸时间（分钟）', 1],
  ['evaporation_rate', '蒸发率（%/小时）', 0], ['screen_water_l', '筛板余水（L）', 0],
];

function ensureOperations() {
  if (!props.mash.workflow) props.mash.workflow = {};
  if (!props.mash.workflow.operations) props.mash.workflow.operations = {};
  if (!Array.isArray(props.mash.workflow.operations[activeStage.value.key])) props.mash.workflow.operations[activeStage.value.key] = [];
}
function addOperation() {
  ensureOperations();
  const id = globalThis.crypto?.randomUUID?.() || `custom_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  props.mash.workflow.operations[activeStage.value.key].push({ id, name: '', input_mode: 'confirm', target: '', unit: '', required: true });
}
function restoreStandardOperations() {
  ensureOperations();
  const defaults = standardMashOperations[activeStage.value.key] || [];
  props.mash.workflow.operations[activeStage.value.key] = JSON.parse(JSON.stringify(defaults));
}
function removeOperation(index) {
  const operation = stageOperations.value[index];
  const operations = props.mash.workflow?.operations || {};
  const keys = activeStage.value.key === 'water_mash' ? ['water', 'mash', 'water_mash'] : [activeStage.value.key];
  for (const key of keys) {
    const rows = operations[key];
    const rowIndex = Array.isArray(rows) ? rows.indexOf(operation) : -1;
    if (rowIndex >= 0) { rows.splice(rowIndex, 1); break; }
  }
}
function addRest() { props.mash.steps.push({ name: '', temperature: '', duration_min: '' }); }
function removeRest(index) { props.mash.steps.splice(index, 1); }
function setSpargeWater(index, value) {
  props.mash.sparge_mode = 'manual';
  props.mash.sparge_water_liters = [...spargeValues.value];
  props.mash.sparge_water_liters[index] = Number(value);
}
function restoreSpargeWater() {
  props.mash.sparge_mode = 'auto';
  props.mash.sparge_water_liters = [];
}
function setPreheatOffset(value) { props.mash.workflow.preheat_offset_c = Number(value); }
function setIodineRequired(value) { props.mash.workflow.iodine_check_required = value; }
</script>

<template>
  <section class="mwd-shell">
    <section class="mwd-parameters">
      <div class="mwd-subheading"><strong>基础工艺参数</strong></div>
      <div class="mwd-parameter-grid"><label v-for="field in parameterFields" :key="field[0]"><span>{{ field[1] }}</span><div><input v-model.number="mash[field[0]]" type="number" :min="field[2]" step="0.1"><b>{{ field[0] === 'water_grain_ratio' || field[0] === 'absorption_rate' ? 'L/kg' : field[0] === 'boil_time_min' ? 'min' : field[0] === 'screen_water_l' ? 'L' : '%' }}</b></div></label></div>
      <div class="mwd-calculation-grid">
        <div class="mwd-calculation-card primary"><span>糖化用水</span><strong>{{ Number(metrics.mashWater || 0).toFixed(2) }}<i>L</i></strong></div>
        <div class="mwd-calculation-card"><span>总用水</span><strong>{{ Number(metrics.totalWater || 0).toFixed(2) }}<i>L</i></strong></div>
        <div class="mwd-calculation-card"><span>煮沸前体积</span><strong>{{ Number(metrics.preBoilVolume || 0).toFixed(2) }}<i>L</i></strong></div>
        <div class="mwd-calculation-card"><span>所需洗糟水</span><strong>{{ Number(metrics.spargeWater || 0).toFixed(2) }}<i>L</i></strong></div>
      </div>
      <label class="mwd-overall-notes"><span>整体工艺说明</span><textarea v-model.trim="mash.notes" rows="2" placeholder="补充本配方适用的整体要求、注意事项或偏差处理原则"></textarea></label>
    </section>

    <div class="mwd-legend"><span><i class="auto"></i>配方带入 / 系统计算</span><span><i class="edit"></i>设计时手动填写</span><span><i class="field"></i>执行时队员确认或录入</span></div>

    <nav class="mwd-stepper" aria-label="糖化工艺步骤">
      <div class="mwd-progress-track"><span :style="{ width: `${activeIndex / (stages.length - 1) * 100}%` }"></span></div>
      <button v-for="(stage, index) in stages" :key="stage.key" type="button" class="mwd-step-dot" :class="{ active: index === activeIndex, passed: index < activeIndex }" @click="activeIndex = index" :aria-current="index === activeIndex ? 'step' : undefined">
        <b>{{ index < activeIndex ? '✓' : String(index + 1).padStart(2, '0') }}</b><span>{{ stage.short }}</span>
      </button>
    </nav>

    <article class="mwd-stage-card">
      <header class="mwd-stage-title"><div><span>第 {{ activeIndex + 1 }} 步</span><h4>{{ activeStage.title }}</h4></div></header>

      <section v-if="activeStage.key === 'materials'" class="mwd-detail-block">
        <div class="mwd-subheading"><strong>本批配方原料</strong><span>从配方自动带入</span></div>
        <div v-if="fermentables.length" class="mwd-material-list"><div v-for="(line,index) in fermentables" :key="`m-${index}`"><span>{{ line.name || '未命名原料' }}</span><strong>{{ line.quantity || '—' }} kg</strong></div></div>
        <div v-else class="mwd-empty">先在“配方与原料”中添加麦芽或可发酵物。</div>
      </section>

      <template v-else-if="activeStage.key === 'water_mash'">
      <section class="mwd-detail-block">
        <div class="mwd-value-grid"><div><small>糖化水量</small><strong>{{ Number.isFinite(Number(metrics.mashWater)) ? Number(metrics.mashWater).toFixed(2) : '—' }} <i>L</i></strong></div><div><small>预热目标</small><strong>{{ preheatTemperature === null ? '待配置' : preheatTemperature.toFixed(1) }} <i>℃</i></strong></div></div>
        <label class="mwd-inline-setting"><span>预热温差</span><select :value="mash.workflow?.preheat_offset_c ?? 5" @change="setPreheatOffset($event.target.value)"><option :value="3">3℃</option><option :value="5">5℃（默认）</option><option :value="8">8℃</option></select></label>
        <div v-if="!firstRest" class="mwd-warning"><span>未设置糖化温度段，无法计算预热目标。</span><button type="button" @click="activeIndex = 1">去配置糖化温度 →</button></div>
      </section>

      <section class="mwd-detail-block">
        <div class="mwd-subheading"><strong>糖化温度曲线</strong><button type="button" class="mwd-add-button" @click="addRest">＋ 添加温度段</button></div>
        <div class="mwd-iodine-config">
          <label class="mwd-iodine-toggle"><span>需要碘反应检查</span><label class="mwd-toggle"><input :checked="mash.workflow?.iodine_check_required !== false" type="checkbox" @change="setIodineRequired($event.target.checked)"><span></span></label></label>
          <label v-if="mash.workflow?.iodine_check_required !== false" class="mwd-iodine-position"><span>检查位置</span><select v-model.number="mash.workflow.iodine_after_step"><option v-for="position in iodinePositions" :key="position" :value="position">{{ position === 0 ? '第一段前' : `第 ${position} 段后` }}</option></select><small>执行时确认合格后，才继续下一温度段</small></label>
        </div>
        <div v-if="mash.steps.length" class="mwd-rest-list">
          <div class="mwd-rest-head"><span>序号</span><span>温度段</span><span>目标温度</span><span>保持时长</span><span>操作</span></div>
          <template v-for="(rest,index) in mash.steps" :key="`rest-${index}`"><div class="mwd-rest-row"><span class="mwd-rest-index">{{ String(index + 1).padStart(2, '0') }}</span><input v-model.trim="rest.name" placeholder="如：β-淀粉酶休止"><label><input v-model.number="rest.temperature" type="number" min="0" max="100" step="0.1" placeholder="℃"><small>℃</small></label><label><input v-model.number="rest.duration_min" type="number" min="1" step="1" placeholder="分钟"><small>分钟</small></label><button type="button" class="mwd-remove" @click="removeRest(index)" aria-label="删除温度段">×</button></div><div v-if="mash.workflow?.iodine_check_required !== false && Number(mash.workflow?.iodine_after_step || 0) === index + 1" class="mwd-iodine-in-sequence"><span>◇</span><strong>碘反应检查</strong><small>本温度段完成后检查；合格后继续升温</small><b>执行时选择合格 / 不合格</b></div></template>
          <p class="mwd-hint">达到目标温度并确认后开始计时；保持时长按分钟填写。</p>
        </div>
        <div v-else class="mwd-empty">添加温度段后，生产执行会按这里的顺序显示目标温度和计时。</div>
      </section>
      </template>

      <section v-else-if="activeStage.key === 'sparge'" class="mwd-detail-block">
        <div class="mwd-inline-fields"><label><span>洗糟水温度</span><div><input v-model.number="mash.workflow.sparge_temperature_c" type="number" min="0" max="100" step="0.1"><b>℃</b></div></label><label><span>洗糟轮次</span><div><input v-model.number="mash.sparge_count" type="number" min="1" max="10" step="1"><b>次</b></div></label></div>
        <div class="mwd-subheading mwd-sparge-heading"><strong>每轮计划用水</strong><button type="button" class="mwd-add-button" @click="restoreSpargeWater">恢复自动分配</button></div>
        <div class="mwd-water-list"><label v-for="(water,index) in spargeValues" :key="`water-${index}`"><span>第 {{ index + 1 }} 次</span><div><input :value="water" type="number" min="0" step="0.01" @input="setSpargeWater(index,$event.target.value)"><b>L</b></div></label></div>
        <p class="mwd-hint">洗糟水合计 {{ Number(metrics.actualSparge || 0).toFixed(2) }} L</p>
      </section>

      <section v-else-if="activeStage.key === 'boil'" class="mwd-detail-block">
        <div class="mwd-value-grid mwd-single-value"><div><small>煮沸时间</small><strong>{{ mash.boil_time_min || '—' }} <i>分钟</i></strong></div></div>
        <div class="mwd-subheading mwd-sparge-heading"><strong>酒花投放计划</strong><span>从配方自动带入</span></div>
        <div v-if="hops.length" class="mwd-hop-list"><div v-for="(hop,index) in hops" :key="`hop-${index}`"><span class="mwd-hop-time">{{ hop.use === 'FWH' ? 'FWH' : hop.use === 'WP' ? '回旋' : hop.use === 'DH' ? '干投' : hop.use === '0' ? '熄火' : `煮沸 ${hop.time} 分钟` }}</span><strong>{{ hop.name || '未选择酒花' }}</strong><small>{{ hop.quantity || '—' }} g</small></div></div>
        <div v-else class="mwd-empty">配方尚未添加酒花；如本批不投酒花，可保持为空。</div>
      </section>

      <section v-else-if="activeStage.key === 'whirlpool'" class="mwd-detail-block">
        <div class="mwd-inline-fields"><label><span>回旋沉淀时间</span><div><input v-model.number="mash.workflow.whirlpool_time_min" type="number" min="0" step="1"><b>分钟</b></div><small>按酿造系统和工艺填写</small></label><label><span>冷却目标温度</span><div><input v-model.number="mash.workflow.cooling_temperature_c" type="number" min="0" max="40" step="0.1"><b>℃</b></div><small>通常与目标发酵温度匹配</small></label></div>
      </section>

      <section v-else-if="activeStage.key === 'transfer'" class="mwd-detail-block">
        <div class="mwd-value-grid mwd-single-value"><div><small>目标发酵温度</small><strong>{{ fermentation.target_temperature || '待填写' }} <i>℃</i></strong></div></div>
        <div class="mwd-choice-hint"><span>发酵罐</span><b>在生产计划中选择，执行时确认实际罐号</b></div>
      </section>

      <section v-else-if="activeStage.key === 'lautering' || activeStage.key === 'kettle'" class="mwd-detail-block">
        <div class="mwd-fixed-note"><span>系统提供标准操作顺序</span><strong>执行时逐项确认，并自动记录操作时间</strong></div>
      </section>

      <section v-if="activeStage.key === 'materials'" class="mwd-custom-block">
        <div class="mwd-fixed-note"><span>生产计划下发后</span><strong>系统自动生成「备料 / 物料确认」任务</strong></div>
      </section>
      <section class="mwd-custom-block">
        <div class="mwd-subheading"><strong>本步骤操作节点</strong><div class="mwd-operation-actions"><button v-if="standardMashOperations[activeStage.key]?.length" type="button" class="mwd-text-button" @click="restoreStandardOperations">恢复标准节点</button><button type="button" class="mwd-add-button" @click="addOperation">＋ 添加节点</button></div></div>
        <p class="mwd-hint">标准节点会带入生产执行清单；名称和要求可修改，删除后不会在本配方的执行清单中生成。</p>
        <div v-for="(operation,index) in stageOperations" :key="operation.id || `custom-${index}`" class="mwd-custom-row"><input v-model.trim="operation.name" placeholder="操作名称"><select v-model="operation.input_mode"><option v-for="mode in inputModes" :key="mode[0]" :value="mode[0]">{{ mode[1] }}</option></select><input v-if="operation.input_mode === 'number'" v-model.trim="operation.target" placeholder="目标值 / 单位"><input v-else-if="operation.input_mode === 'choice'" v-model.trim="operation.target" placeholder="选项，用 / 分隔"><input v-else v-model.trim="operation.target" placeholder="执行要求或说明"><button type="button" class="mwd-remove" @click="removeOperation(index)" aria-label="删除操作节点">×</button></div>
        <div v-if="!stageOperations.length" class="mwd-no-custom">本步骤没有执行节点。你可以添加节点，或恢复标准节点。</div>
      </section>

      <footer class="mwd-navigation"><button type="button" :disabled="activeIndex === 0" @click="activeIndex--">上一步</button><span>{{ activeIndex + 1 }} / {{ stages.length }}</span><button type="button" :disabled="activeIndex === stages.length - 1" @click="activeIndex++">下一步</button></footer>
    </article>
  </section>
</template>

<style scoped>
.mwd-shell{--mwd-gold:#d4a853;--mwd-line:rgba(212,168,83,.2);display:grid;gap:16px;width:100%;min-width:0;box-sizing:border-box;color:var(--text-primary,#eee9df)}
.mwd-parameters{min-width:0;box-sizing:border-box;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.018)}.mwd-parameter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mwd-parameter-grid label{display:grid;min-width:0;gap:6px;color:var(--text-muted,#918b80);font-size:11px}.mwd-parameter-grid label>div{display:flex;min-width:0;align-items:center;gap:7px}.mwd-parameter-grid input{box-sizing:border-box;flex:1;min-width:0;width:0;height:38px;padding:0 10px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:rgba(0,0,0,.16);color:var(--text-primary,#eee9df);font:inherit;font-size:13px}.mwd-parameter-grid b{flex:none;color:var(--mwd-gold);font-size:10px;font-weight:600;white-space:nowrap}
.mwd-calculation-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:14px}.mwd-calculation-card{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;min-height:58px;box-sizing:border-box;padding:10px 13px;border:1px solid rgba(212,168,83,.24);border-radius:9px;background:rgba(212,168,83,.055)}.mwd-calculation-card>span{min-width:0;color:var(--text-muted,#a29b8f);font-size:11px;line-height:1.35}.mwd-calculation-card strong{display:flex;flex:none;align-items:baseline;gap:5px;color:#e8cf96;font-size:clamp(16px,1.6vw,20px);font-variant-numeric:tabular-nums;line-height:1.1;white-space:nowrap}.mwd-calculation-card strong i{color:var(--mwd-gold);font-size:11px;font-style:normal;font-weight:600}.mwd-calculation-card.primary{border-color:rgba(212,168,83,.4);background:rgba(212,168,83,.12)}.mwd-calculation-card.primary strong{color:#fff2d4}
.mwd-overall-notes{display:grid;gap:5px;margin-top:10px;color:var(--text-muted,#918b80);font-size:10px}.mwd-overall-notes textarea{box-sizing:border-box;width:100%;resize:vertical;padding:8px 10px;border:1px solid rgba(255,255,255,.1);border-radius:7px;background:rgba(0,0,0,.14);color:var(--text-primary,#eee9df);font:inherit;font-size:11px}
.mwd-legend{display:flex;flex-wrap:wrap;gap:8px 16px;color:var(--text-muted,#918b80);font-size:9px}.mwd-legend span{display:flex;align-items:center;gap:5px}.mwd-legend i{width:7px;height:7px;border-radius:50%;background:var(--mwd-gold)}.mwd-legend i.edit{background:#8db9d3}.mwd-legend i.field{background:#9acb9f}
.mwd-stepper{position:relative;display:grid;grid-template-columns:repeat(10,minmax(36px,1fr));gap:4px;padding:2px 0 0}.mwd-progress-track{height:2px;position:absolute;left:4.5%;right:4.5%;top:15px;background:rgba(255,255,255,.1)}.mwd-progress-track span{display:block;height:100%;background:var(--mwd-gold);transition:width .2s ease}.mwd-step-dot{position:relative;z-index:1;display:grid;justify-items:center;gap:6px;padding:0;border:0;background:transparent;color:var(--text-muted,#918b80);cursor:pointer}.mwd-step-dot b{width:30px;height:30px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:#272521;font-size:10px;transition:.2s}.mwd-step-dot span{font-size:9px;white-space:nowrap}.mwd-step-dot.active b,.mwd-step-dot.passed b{border-color:var(--mwd-gold);background:var(--mwd-gold);color:#211d16;box-shadow:0 0 0 4px rgba(212,168,83,.12)}.mwd-step-dot.active span{color:var(--mwd-gold);font-weight:700}
.mwd-stepper{grid-template-columns:repeat(8,minmax(36px,1fr))}
.mwd-stage-card{overflow:hidden;border:1px solid var(--mwd-line);border-radius:14px;background:linear-gradient(145deg,rgba(212,168,83,.07),rgba(255,255,255,.018) 55%)}.mwd-stage-title{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08)}.mwd-stage-title>div>span{color:var(--mwd-gold);font-size:10px;font-weight:700}.mwd-stage-title h4{font-size:17px;margin:3px 0}
.mwd-detail-block,.mwd-custom-block{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.07)}.mwd-subheading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.mwd-subheading strong{font-size:12px}.mwd-subheading>span{font-size:10px;color:var(--text-muted,#918b80)}
.mwd-value-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mwd-value-grid>div{padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(0,0,0,.12)}.mwd-value-grid small{display:block;color:var(--text-muted,#918b80);font-size:10px}.mwd-value-grid strong{display:block;margin:5px 0;font-size:22px;color:#f1e9d8}.mwd-value-grid strong i{font-size:12px;font-weight:500;font-style:normal;color:var(--mwd-gold)}.mwd-inline-setting{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:11px}.mwd-inline-setting>span{color:var(--text-secondary,#c9c3b9)}.mwd-inline-setting select,.mwd-custom-row select{min-height:32px;padding:0 9px;border:1px solid rgba(255,255,255,.13);border-radius:7px;background:#24221e;color:var(--text-primary,#eee9df)}.mwd-warning{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 0;padding:9px 11px;border-radius:8px;background:rgba(212,168,83,.1);color:#e7c77c;font-size:11px}.mwd-warning button{flex:none;padding:5px 8px;border:1px solid rgba(212,168,83,.35);border-radius:6px;background:rgba(212,168,83,.1);color:#e7c77c;font:inherit;font-size:10px;cursor:pointer}
.mwd-rest-list,.mwd-material-list,.mwd-hop-list,.mwd-water-list{display:grid;gap:7px}.mwd-rest-row{display:grid;grid-template-columns:30px minmax(120px,1fr) 105px 105px 28px;align-items:center;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(0,0,0,.1)}.mwd-rest-index{color:var(--mwd-gold);font-size:10px;font-weight:800}.mwd-rest-row>input,.mwd-rest-row label input,.mwd-water-list input,.mwd-inline-fields input,.mwd-custom-row input{box-sizing:border-box;width:100%;min-width:0;height:33px;padding:0 9px;border:1px solid rgba(255,255,255,.12);border-radius:7px;background:rgba(0,0,0,.16);color:var(--text-primary,#eee9df);font:inherit;font-size:11px}.mwd-rest-row label{position:relative}.mwd-rest-row label input{padding-right:28px}.mwd-rest-row label small{position:absolute;right:8px;top:10px;color:var(--text-muted,#918b80);font-size:9px;pointer-events:none}.mwd-remove{width:26px;height:26px;border:0;border-radius:7px;background:rgba(255,255,255,.07);color:#c8bca9;font-size:18px;cursor:pointer}.mwd-remove:hover{background:rgba(210,91,75,.18);color:#f09a8d}.mwd-add-button{border:1px solid rgba(212,168,83,.3);border-radius:7px;padding:6px 9px;background:rgba(212,168,83,.08);color:var(--mwd-gold);font-size:10px;cursor:pointer}.mwd-hint{margin:9px 0 0;color:var(--text-muted,#918b80);font-size:10px;line-height:1.6}.mwd-empty,.mwd-no-custom{padding:13px;border:1px dashed rgba(255,255,255,.12);border-radius:8px;color:var(--text-muted,#918b80);font-size:11px}.mwd-material-list{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.mwd-material-list>div{display:flex;justify-content:space-between;gap:10px;padding:10px;border-radius:8px;background:rgba(0,0,0,.12);font-size:11px}.mwd-material-list strong{color:#e8cf96}.mwd-choice-card{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:rgba(0,0,0,.12)}.mwd-choice-card strong{font-size:12px}.mwd-choice-card p{margin:5px 0 0;color:var(--text-muted,#918b80);font-size:10px;line-height:1.6}.mwd-toggle input{position:absolute;opacity:0}.mwd-toggle span{display:block;width:38px;height:22px;border-radius:20px;background:#514b40;cursor:pointer;transition:.2s}.mwd-toggle span:after{content:'';display:block;width:16px;height:16px;margin:3px;border-radius:50%;background:#eee;transition:.2s}.mwd-toggle input:checked+span{background:var(--mwd-gold)}.mwd-toggle input:checked+span:after{transform:translateX(16px);background:#211d16}.mwd-choice-hint,.mwd-fixed-note{display:flex;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 12px;border-radius:8px;background:rgba(212,168,83,.08);font-size:10px;color:var(--text-muted,#918b80)}.mwd-choice-hint b,.mwd-fixed-note strong{color:#e4c47d;font-weight:700}.mwd-inline-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mwd-inline-fields>label>span{display:block;margin-bottom:6px;font-size:11px;color:var(--text-secondary,#c9c3b9)}.mwd-inline-fields>label>div,.mwd-water-list label>div{display:flex;align-items:center;gap:7px}.mwd-inline-fields b,.mwd-water-list b{color:var(--mwd-gold);font-size:10px}.mwd-inline-fields small{display:block;margin-top:5px;color:var(--text-muted,#918b80);font-size:9px}.mwd-sparge-heading{margin-top:15px}.mwd-water-list{grid-template-columns:repeat(3,minmax(0,1fr))}.mwd-water-list label{display:grid;gap:5px;padding:9px;border:1px solid rgba(255,255,255,.08);border-radius:8px}.mwd-water-list label>span{font-size:10px;color:var(--text-muted,#918b80)}.mwd-hop-list>div{display:grid;grid-template-columns:90px minmax(100px,1fr) auto;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;background:rgba(0,0,0,.12);font-size:11px}.mwd-hop-time{color:var(--mwd-gold);font-size:9px;font-weight:700}.mwd-hop-list small{color:var(--text-muted,#918b80)}.mwd-single-value{grid-template-columns:minmax(180px,260px)}
.mwd-custom-block{background:rgba(0,0,0,.08)}.mwd-custom-block>.mwd-hint{margin:-4px 0 10px}.mwd-custom-row{display:grid;grid-template-columns:minmax(120px,1fr) 115px minmax(100px,.8fr) 28px;gap:7px;margin-top:7px}.mwd-custom-row input,.mwd-custom-row select{font-size:10px}.mwd-navigation{display:flex;align-items:center;justify-content:space-between;padding:13px 20px}.mwd-navigation button{min-width:78px;padding:7px 12px;border:1px solid rgba(212,168,83,.3);border-radius:7px;background:rgba(212,168,83,.08);color:var(--mwd-gold);font-size:11px;cursor:pointer}.mwd-navigation button:disabled{opacity:.35;cursor:not-allowed}.mwd-navigation span{color:var(--text-muted,#918b80);font-size:10px}
@media(max-width:680px){.mwd-stepper{overflow:auto;grid-template-columns:repeat(8,48px);padding-bottom:6px}.mwd-progress-track{left:24px;right:auto;width:calc(8 * 48px - 48px)}.mwd-step-dot span{font-size:8px}.mwd-stage-title,.mwd-detail-block,.mwd-custom-block{padding-left:13px;padding-right:13px}.mwd-rest-row{grid-template-columns:24px 1fr 82px 82px 26px;gap:5px}.mwd-inline-fields{grid-template-columns:1fr}.mwd-custom-row{grid-template-columns:minmax(100px,1fr) 100px 28px}.mwd-custom-row input:nth-of-type(2){grid-column:1/3}.mwd-water-list{grid-template-columns:1fr}.mwd-value-grid{grid-template-columns:1fr}.mwd-parameter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mwd-calculation-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:390px){.mwd-parameter-grid{grid-template-columns:1fr}.mwd-calculation-card{min-height:52px;padding:9px}.mwd-calculation-card>span{font-size:10px}.mwd-calculation-card strong{font-size:16px}}
.mwd-toggle span{position:relative;box-sizing:border-box}
.mwd-toggle span:after{position:absolute;left:3px;top:50%;margin:0;transform:translateY(-50%)}
.mwd-toggle input:checked+span:after{transform:translate(16px,-50%)}
.mwd-rest-head{display:grid;grid-template-columns:30px minmax(120px,1fr) 105px 105px 28px;gap:8px;padding:0 8px;color:var(--text-muted,#918b80);font-size:10px}
.mwd-rest-head span:nth-child(1),.mwd-rest-head span:last-child{text-align:center}
@media(max-width:680px){.mwd-rest-head{grid-template-columns:24px 1fr 82px 82px 26px;gap:5px;padding:0 8px;font-size:9px}}
.mwd-iodine-config{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:0 0 12px;padding:10px 12px;border:1px solid rgba(212,168,83,.18);border-radius:8px;background:rgba(212,168,83,.045)}
.mwd-iodine-toggle{display:flex;align-items:center;gap:12px;color:var(--text-secondary,#c9c3b9);font-size:11px}
.mwd-iodine-position{display:flex;align-items:center;gap:8px;color:var(--text-muted,#918b80);font-size:10px}
.mwd-iodine-position select{min-height:30px;padding:0 8px;border:1px solid rgba(255,255,255,.13);border-radius:6px;background:#24221e;color:var(--text-primary,#eee9df);font:inherit}
.mwd-iodine-position small{color:var(--text-muted,#918b80)}
.mwd-iodine-in-sequence{display:flex;align-items:center;gap:8px;margin:5px 0;padding:10px 12px;border:1px dashed rgba(212,168,83,.42);border-radius:8px;background:rgba(212,168,83,.08);color:#e8cf96;font-size:11px}
.mwd-iodine-in-sequence>span{font-size:16px}.mwd-iodine-in-sequence small{color:var(--text-muted,#a29b8f)}.mwd-iodine-in-sequence b{margin-left:auto;color:#e4c47d;font-size:10px}
.mwd-operation-actions{display:flex;align-items:center;gap:8px}.mwd-text-button{padding:5px 8px;border:0;background:transparent;color:var(--text-muted,#918b80);font-size:10px;cursor:pointer}.mwd-text-button:hover{color:var(--mwd-gold)}
@media(max-width:680px){.mwd-iodine-config{align-items:flex-start;flex-direction:column}.mwd-iodine-position{flex-wrap:wrap}.mwd-iodine-in-sequence{align-items:flex-start;flex-wrap:wrap}.mwd-iodine-in-sequence b{margin-left:0}}
</style>
