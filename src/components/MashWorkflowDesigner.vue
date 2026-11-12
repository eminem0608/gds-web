<script setup>
import { computed } from 'vue';
import { present } from '../recipe-calculations';

const props = defineProps({
  mash: { type: Object, required: true },
  metrics: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
});
const parameterFields = computed(() => [
  { key: 'evaporation_rate', label: props.mash.water_calculation === 'original' ? '煮沸强度' : '煮沸强度（每小时）', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'water_grain_ratio', label: '糖化水料比', unit: 'L/kg', min: 0.1, step: 0.1 },
  { key: 'boil_time_min', label: '煮沸时间', unit: '分钟', min: 1, step: 1 },
  { key: 'sparge_count', label: '洗糟次数', unit: '次', min: 1, max: 10, step: 1 },
]);
const parametersComplete = computed(() => parameterFields.value.every(field => present(props.mash[field.key]) && Number(props.mash[field.key]) >= field.min && (field.max == null || Number(props.mash[field.key]) <= field.max)) && Number.isInteger(Number(props.mash.sparge_count)));
const spargeValues = computed(() => parametersComplete.value ? props.metrics.spargeWaters || props.mash.sparge_water_liters || [] : []);
const spargeDifference = computed(() => Number(props.metrics.spargeDifference || 0));
const waterMismatch = computed(() => Math.abs(spargeDifference.value) > 0.005);
const format = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';
function addRest() {
  props.mash.steps.push({ name: `糖化步骤 ${props.mash.steps.length + 1}`, temperature: '', duration_min: '' });
}
function removeRest(index) { props.mash.steps.splice(index, 1); }
function setSpargeWater(index, value) {
  props.mash.sparge_water_liters = [...spargeValues.value];
  props.mash.sparge_water_liters[index] = value === '' ? '' : Number(value);
  props.mash.sparge_mode = 'manual';
}
function restoreSpargeWater() {
  props.mash.sparge_mode = 'auto';
  props.mash.sparge_water_liters = [];
}
function changeParameter(key) { if (key === 'sparge_count') restoreSpargeWater(); }
</script>

<template>
  <section class="mwd-shell">
    <div class="mwd-page-heading"><h3>糖化设计</h3><p>设置糖化参数，添加温度步骤，并分配每次洗糟用水。</p></div>
    <fieldset :disabled="readOnly">
      <section class="mwd-parameters" aria-label="糖化基础参数">
        <div class="mwd-parameter-grid">
          <label v-for="field in parameterFields" :key="field.key"><span>{{ field.label }}</span><div><input v-model.number="mash[field.key]" :aria-label="field.label" :placeholder="`请输入${field.label}`" type="number" required :min="field.min" :max="field.max" :step="field.step" @change="changeParameter(field.key)"><b>{{ field.unit }}</b></div></label>
        </div>
        <div class="mwd-calculation-grid">
          <div class="mwd-calculation-card"><span>煮沸前体积</span><strong>{{ parametersComplete ? format(metrics.preBoilVolume) : '—' }}<i v-if="parametersComplete">L</i></strong></div>
          <div class="mwd-calculation-card"><span>糖化效率<small>来自所选设备</small></span><strong>{{ format(mash.efficiency) }}<i>%</i></strong></div>
          <div class="mwd-calculation-card primary"><span>糖化总用水量</span><strong>{{ parametersComplete ? format(metrics.totalWater) : '—' }}<i v-if="parametersComplete">L</i></strong></div>
        </div>
      </section>

      <section class="mwd-design-block" aria-label="糖化步骤设计">
        <div class="mwd-subheading"><div><h4>糖化步骤</h4><p class="mwd-hint">按执行顺序填写目标温度和保持时间。</p></div><button type="button" class="mwd-add-button" @click="addRest">＋ 添加糖化步骤</button></div>
        <div v-if="mash.steps.length" class="mwd-rest-list">
          <div class="mwd-rest-table-wrap">
            <table class="mwd-rest-table" aria-label="糖化步骤">
              <colgroup><col class="mwd-rest-name-col"><col><col><col class="mwd-rest-action-col"></colgroup>
              <thead><tr><th scope="col">步骤名称 *</th><th scope="col">目标温度 *</th><th scope="col">保持时间 *</th><th scope="col" aria-label="操作"></th></tr></thead>
              <tbody>
                <tr v-for="(rest,index) in mash.steps" :key="`rest-${index}`">
                  <td><div class="mwd-rest-name"><span>{{ index + 1 }}</span><input v-model.trim="rest.name" :aria-label="`第 ${index + 1} 个步骤名称`" placeholder="填写步骤名称"></div></td>
                  <td><div class="mwd-rest-value"><input v-model.number="rest.temperature" :aria-label="`第 ${index + 1} 个步骤目标温度`" type="number" min="0" max="100" step="0.1" placeholder="例如 65"><small>℃</small></div></td>
                  <td><div class="mwd-rest-value"><input v-model.number="rest.duration_min" :aria-label="`第 ${index + 1} 个步骤保持时间`" type="number" min="1" step="1" placeholder="例如 30"><small>分钟</small></div></td>
                  <td><button type="button" class="mwd-remove" :aria-label="`删除第 ${index + 1} 个步骤`" @click="removeRest(index)">×</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mwd-hint">达到目标温度并确认后开始计时。</p>
        </div>
        <div v-else class="mwd-empty">还没有糖化步骤，点击“添加糖化步骤”添加。</div>
      </section>

      <section class="mwd-design-block" aria-label="洗糟用水设计">
        <div class="mwd-subheading"><div><h4>洗糟用水</h4><p class="mwd-hint">按洗糟次数自动分配，可调整每次水量，合计须与所需用水量一致。</p></div><button type="button" class="mwd-text-button" @click="restoreSpargeWater">恢复自动分配</button></div>
        <div v-if="!parametersComplete" class="mwd-empty">填写上方糖化参数后，自动分配每次洗糟用水。</div>
        <div v-else class="mwd-water-list">
          <label v-for="(water,index) in spargeValues" :key="`water-${index}`"><span>第 {{ index + 1 }} 次洗糟</span><div><input :value="water" :aria-label="`第 ${index + 1} 次洗糟用水`" type="number" required min="0" step="0.01" @input="setSpargeWater(index,$event.target.value)"><b>L</b></div></label>
        </div>
        <div v-if="parametersComplete" class="mwd-water-total" :class="{ invalid: waterMismatch }" aria-live="polite"><span>所需洗糟水 <strong>{{ format(metrics.spargeWater) }} L</strong></span><span>已分配 <strong>{{ format(metrics.actualSparge) }} L</strong></span><span v-if="waterMismatch" role="alert">{{ spargeDifference > 0 ? '超出' : '还差' }} {{ format(Math.abs(spargeDifference)) }} L，请调整每次用水。</span><span v-else class="mwd-water-balanced">合计一致</span></div>
      </section>
    </fieldset>
  </section>
</template>

<style scoped>
.mwd-shell{--mwd-gold:#d4a853;--mwd-line:rgba(212,168,83,.2);display:grid;gap:16px;width:100%;min-width:0;box-sizing:border-box;color:var(--text-primary,#eee9df)}
.mwd-shell fieldset{display:grid;gap:16px;min-width:0;margin:0;padding:0;border:0}
.mwd-page-heading h3{margin:0;font-size:18px}.mwd-page-heading p,.mwd-hint{margin:6px 0 0;color:var(--text-muted,#918b80);font-size:11px;line-height:1.6}
.mwd-parameters,.mwd-design-block{min-width:0;box-sizing:border-box;padding:20px;border:1px solid var(--mwd-line);border-radius:12px;background:rgba(255,255,255,.018)}
.mwd-parameter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.mwd-parameter-grid label,.mwd-water-list label{display:grid;min-width:0;gap:8px;color:var(--text-secondary,#c9c3b9);font-size:12px}
.mwd-parameter-grid label>div,.mwd-water-list label>div{display:flex;align-items:center;gap:8px;min-width:0}
.mwd-parameter-grid input,.mwd-water-list input,.mwd-rest-table input{box-sizing:border-box;width:100%;min-width:0;height:40px;padding:0 11px;border:1px solid rgba(255,255,255,.14);border-radius:7px;background:#211f1c;color:var(--text-primary,#eee9df);font:inherit;font-size:13px}
.mwd-shell input:focus-visible{outline:2px solid var(--mwd-gold);outline-offset:2px}
.mwd-parameter-grid b,.mwd-water-list b{flex:none;color:var(--mwd-gold);font-size:11px;font-weight:500;white-space:nowrap}
.mwd-calculation-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}
.mwd-calculation-card{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;min-height:68px;box-sizing:border-box;padding:14px;border:1px solid var(--mwd-line);border-radius:9px;background:rgba(212,168,83,.045)}
.mwd-calculation-card>span{color:var(--text-muted,#a29b8f);font-size:12px;line-height:1.5}.mwd-calculation-card small{display:block;margin-top:3px;font-size:10px}
.mwd-calculation-card strong{display:flex;flex:none;align-items:baseline;gap:5px;color:#e8cf96;font-size:20px;font-variant-numeric:tabular-nums;white-space:nowrap}.mwd-calculation-card i{color:var(--mwd-gold);font-size:11px;font-style:normal;font-weight:500}
.mwd-calculation-card.primary{border-color:rgba(212,168,83,.4);background:rgba(212,168,83,.09)}
.mwd-subheading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.mwd-subheading h4{margin:0;font-size:14px}
.mwd-add-button,.mwd-text-button{flex:none;min-height:34px;padding:7px 11px;border:1px solid rgba(212,168,83,.3);border-radius:7px;background:rgba(212,168,83,.08);color:var(--mwd-gold);font:inherit;font-size:11px;cursor:pointer}.mwd-text-button{border-color:transparent;background:transparent}.mwd-add-button:hover,.mwd-text-button:hover{background:rgba(212,168,83,.14)}
.mwd-empty{padding:24px 16px;border:1px dashed rgba(255,255,255,.12);border-radius:8px;color:var(--text-muted,#918b80);font-size:12px;text-align:center}
.mwd-rest-table-wrap{min-width:0;overflow-x:auto;border:1px solid var(--mwd-line);border-radius:10px;background:rgba(0,0,0,.1)}
.mwd-rest-table{width:100%;min-width:440px;table-layout:fixed;border-collapse:collapse;text-align:left}.mwd-rest-name-col{width:44%}.mwd-rest-action-col{width:44px}
.mwd-rest-table th{padding:11px 12px;border-bottom:1px solid var(--mwd-line);background:rgba(212,168,83,.055);color:var(--text-muted,#918b80);font-size:11px;font-weight:500}
.mwd-rest-table td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:middle}.mwd-rest-table tbody tr:last-child td{border-bottom:0}.mwd-rest-table th:last-child,.mwd-rest-table td:last-child{padding-left:0;text-align:right}
.mwd-rest-name{display:flex;align-items:center;gap:10px;min-width:0}.mwd-rest-name>span{display:grid;flex:none;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(212,168,83,.13);color:var(--mwd-gold);font-size:11px;font-weight:700}
.mwd-rest-value{display:flex;align-items:center;gap:8px}.mwd-rest-value small{flex:none;color:var(--mwd-gold);font-size:10px;white-space:nowrap}
.mwd-remove{width:26px;height:26px;padding:0;border:0;border-radius:7px;background:rgba(255,255,255,.07);color:#c8bca9;font-size:18px;cursor:pointer}.mwd-remove:hover{background:rgba(210,91,75,.18);color:#f09a8d}
.mwd-water-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mwd-water-list label{padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:9px;background:rgba(0,0,0,.09)}
.mwd-water-total{display:flex;align-items:center;flex-wrap:wrap;gap:10px 24px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07);color:var(--text-muted,#918b80);font-size:11px}.mwd-water-total strong{margin-left:6px;color:var(--text-primary,#eee9df);font-weight:600}.mwd-water-balanced{margin-left:auto;color:#a4c49d}.mwd-water-total.invalid [role=alert]{color:#e2a48c}
@media(max-width:900px){.mwd-parameter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mwd-calculation-card{align-items:flex-start;flex-direction:column;gap:8px}}
@media(max-width:680px){.mwd-parameters,.mwd-design-block{padding:14px}.mwd-subheading{align-items:flex-start;flex-wrap:wrap;gap:10px}.mwd-calculation-grid{grid-template-columns:1fr;gap:8px}.mwd-calculation-card{align-items:center;flex-direction:row;min-height:54px}.mwd-water-list{grid-template-columns:1fr}.mwd-rest-table th,.mwd-rest-table td{padding:9px 8px}.mwd-rest-name-col{width:40%}.mwd-rest-name{gap:6px}.mwd-rest-table input{padding:0 7px}.mwd-rest-value{gap:5px}.mwd-water-balanced{margin-left:0}}
</style>
