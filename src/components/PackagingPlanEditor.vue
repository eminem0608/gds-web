<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { brewApi } from '../api';
const props = defineProps({ modelValue: Object, productId: [String, Number], factoryId: [String, Number], assignees: Array, brewingEnd: String, demand: Object });
const emit = defineEmits(['update:modelValue']);
const options = ref([]), people = ref([]), loading = ref(false), error = ref('');
let sequence = 0;
const draft = computed(() => props.modelValue || {});
const personOptions = computed(() => props.assignees || people.value);
const lines = computed(() => draft.value.materials || []);
const kinds = { bottle: '酒瓶', can: '易拉罐', keg: '酒桶', carton: '纸箱 / 礼盒' };
const material = line => options.value.find(item => String(item.id) === String(line.material_id));
const number = value => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 6 });
function change(key, value) { emit('update:modelValue', { ...draft.value, [key]: value }); }
function addMaterial() { change('materials', [...lines.value, { material_id: '', quantity: 1 }]); }
function updateMaterial(index, key, value) { change('materials', lines.value.map((line, i) => i === index ? { ...line, [key]: value } : line)); }
function removeMaterial(index) { change('materials', lines.value.filter((_, i) => i !== index)); }
watch(() => [props.productId, props.factoryId], async ([productId, factoryId]) => {
  const request = ++sequence; loading.value = true; error.value = ''; options.value = []; people.value = [];
  try {
    const [materials, assignees] = await Promise.all([productId ? brewApi.getPlanPackagingOptions(productId, factoryId) : [], !props.assignees && factoryId ? brewApi.listProductionPlanAssignees(factoryId) : []]);
    if (request === sequence) { options.value = materials; people.value = assignees; }
  } catch (cause) { if (request === sequence) error.value = cause.message; }
  finally { if (request === sequence) loading.value = false; }
}, { immediate: true });
onUnmounted(() => { ++sequence; });
</script>
<template>
  <section class="pack-plan plan-editor-wide">
    <div v-if="loading" class="empty">正在加载包装材料…</div>
    <div v-if="error" class="master-error">{{ error }}</div>
    <section class="pack-plan-materials">
      <div class="pack-plan-section-heading"><strong>包装材料 <small>{{ lines.length }} 项</small></strong><button class="btn btn-xs btn-outline" type="button" :disabled="loading || !productId" @click="addMaterial">＋ 添加材料</button></div>
      <div v-if="!lines.length" class="pack-plan-empty">暂无材料，点击“添加材料”选择。</div>
      <article v-for="(line,index) in lines" :key="index" class="pack-plan-material">
        <span class="pack-plan-number">{{ String(index + 1).padStart(2,'0') }}</span>
        <div class="pack-plan-material-main"><label><span>材料名称</span><select :value="line.material_id" :disabled="loading || !productId" required @change="updateMaterial(index,'material_id',$event.target.value)"><option value="">选择库存中的包装材料</option><option v-for="item in options" :key="item.id" :value="item.id">{{ item.name }} · {{ kinds[item.type] }}{{ item.available_qty === null ? '' : ' · 库存 ' + number(item.available_qty) + ' 个' }}</option></select></label>
          <div v-if="material(line)" class="pack-plan-facts"><span>{{ kinds[material(line).type] }}</span><span>{{ material(line).supplier }}</span><span v-if="material(line).available_qty !== null">可用 {{ number(material(line).available_qty) }} 个</span><span v-if="material(line).unit_price !== null">¥{{ number(material(line).unit_price) }} / 个</span></div>
        </div>
        <label class="pack-plan-quantity"><span>使用数量（个）</span><input :value="line.quantity" type="number" min="1" step="1" required @input="updateMaterial(index,'quantity',$event.target.value)"></label>
        <button class="pack-plan-remove" type="button" title="移除材料" aria-label="移除材料" @click="removeMaterial(index)">×</button>
      </article>
    </section>
    <section class="pack-plan-execution"><div class="pack-plan-section-heading"><strong>执行安排</strong><small>发酵任务完成后执行包装任务</small></div><div class="pack-plan-fields">
      <label><span>包装执行人 <i>*</i></span><select :value="draft.owner_id" :disabled="loading || !factoryId" required @change="change('owner_id',$event.target.value)"><option value="">选择本厂区包装执行人</option><option v-for="person in personOptions" :key="person.id" :value="person.id">{{ person.name }}</option></select></label>
      <label><span>包装开始时间 <i>*</i></span><input :value="draft.planned_start" type="datetime-local" :min="brewingEnd" required @input="change('planned_start',$event.target.value)"></label>
      <label><span>包装结束时间 <i>*</i></span><input :value="draft.planned_end" type="datetime-local" :min="draft.planned_start || brewingEnd" required @input="change('planned_end',$event.target.value)"></label>
      <label class="pack-plan-notes"><span>包装要求</span><textarea :value="draft.notes" rows="2" placeholder="填写本次包装的操作要求或备注" @input="change('notes',$event.target.value)"></textarea></label>
    </div></section>
  </section>
</template>
<style scoped>
.pack-plan{width:100%;max-width:980px;box-sizing:border-box;border:1px solid var(--border-default);border-radius:10px;background:rgba(255,255,255,.018);overflow:hidden;margin-top:8px}.pack-plan-materials,.pack-plan-execution{padding:16px 20px}.pack-plan-finished{padding:16px 20px;border-bottom:1px solid var(--border-subtle)}.pack-plan-finished>small{display:block;font-size:11px;color:var(--text-muted);margin-top:8px}.pack-plan-execution{border-top:1px solid var(--border-default)}.pack-plan-section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.pack-plan-section-heading strong{font-size:13px;color:var(--text-primary)}.pack-plan-section-heading small{margin-left:6px;font-size:11px;font-weight:400;color:var(--text-muted)}.pack-plan-empty{padding:12px 14px;border:1px dashed var(--border-default);border-radius:7px;font-size:12px;color:var(--text-muted)}.pack-plan-material{display:grid;grid-template-columns:24px minmax(0,1fr) 130px 24px;align-items:start;gap:12px;padding:12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:8px;margin-bottom:8px}.pack-plan-number{font-size:12px;color:var(--accent-gold);padding-top:30px}.pack-plan label{display:grid;gap:7px;font-size:12px;color:var(--text-secondary)}.pack-plan input,.pack-plan select,.pack-plan textarea{width:100%;min-width:0;box-sizing:border-box;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border-default);border-radius:7px;padding:8px 10px;font:inherit;color-scheme:dark}.pack-plan input,.pack-plan select{height:40px}.pack-plan input:focus,.pack-plan select:focus,.pack-plan textarea:focus{outline:none;border-color:var(--accent-gold);box-shadow:0 0 0 3px rgba(212,168,83,.08)}.pack-plan textarea{resize:vertical}.pack-plan input:disabled,.pack-plan select:disabled{opacity:.6}.pack-plan i{color:var(--error);font-style:normal}.pack-plan-facts{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:var(--text-muted);margin-top:8px}.pack-plan-facts span:first-child{color:var(--accent-gold)}.pack-plan-remove{margin-top:27px;background:none;border:none;color:var(--text-muted);font-size:23px;cursor:pointer}.pack-plan-remove:hover{color:var(--error)}.pack-plan-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pack-plan-notes{grid-column:1/-1}.pack-plan>.master-error{margin:12px 20px}@media(max-width:760px){.pack-plan-materials,.pack-plan-execution{padding:14px}.pack-plan-material{grid-template-columns:22px minmax(0,1fr) 24px;gap:10px}.pack-plan-material-main{grid-column:2}.pack-plan-remove{grid-column:3;grid-row:1}.pack-plan-quantity{grid-column:2/-1}.pack-plan-fields{grid-template-columns:1fr}.pack-plan-notes{grid-column:auto}.pack-plan-section-heading>small{display:none}}
</style>
