<script setup>
import { ref, computed, onMounted } from 'vue';
import { brewApi } from '../api';
const props = defineProps({ item: Object });
const emit = defineEmits(['close', 'changed']);
const override = ref(false), overrideReason = ref('');
const values = ref({}), note = ref(''), confirmed = ref(false), saving = ref(false), error = ref(''), panel = ref(null);
const labels = {temperature:'温度',gravity:'糖度',pressure:'压力',diacetyl:'双乙酰',attenuation:'实际发酵度'};
const units = {temperature:'℃',gravity:'°P',pressure:'bar',diacetyl:'mg/L',attenuation:'%'};
const fields = computed(() => [...new Set([props.item.condition_ready ? null : props.item.condition_metric, props.item.metric].filter(Boolean))]);
onMounted(() => panel.value?.focus());
async function submit(nextDay = false, measurementOnly = false) {
  if (saving.value) return;
  saving.value = true; error.value = '';
  try {
    const item = props.item;
    if (!nextDay && !measurementOnly && override.value && !overrideReason.value.trim()) throw new Error('请填写人工确认原因');
    const keys = measurementOnly ? [item.condition_metric].filter(Boolean) : fields.value;
    if (!nextDay && keys.some(key => values.value[key] === undefined || values.value[key] === '' || !Number.isFinite(Number(values.value[key])))) throw new Error('请填写实测数值');
    const metrics = Object.fromEntries(keys.map(key => [key, Number(values.value[key])]));
    const action = nextDay ? 'fermentation-test-next-day' : measurementOnly || item.condition_ready ? 'fermentation-record' : 'fermentation-condition';
    await brewApi.taskAction(item.task_id, action, {version:item.version,entry_id:item.entry_id,entry_ids:measurementOnly?[]:[item.entry_id],metrics,note:note.value,confirmed:confirmed.value,complete_action:true,manual_override:override.value,override_reason:overrideReason.value});
    emit('changed', { advanced: nextDay });
  } catch (cause) { error.value = cause.message || '提交失败'; }
  finally { saving.value = false; }
}
</script>
<template>
<Teleport to="body"><div class="condition-mask" @click.self="!saving && $emit('close')"><section ref="panel" class="condition-drawer" role="dialog" aria-modal="true" aria-labelledby="condition-title" tabindex="-1" @keydown.esc="!saving && $emit('close')"><header><div><small>发酵条件任务</small><h2 id="condition-title">{{ item.title }}</h2><p>{{ item.production?.product }} · {{ item.production?.batch_name }}</p></div><button type="button" :disabled="saving" aria-label="关闭" @click="$emit('close')">×</button></header><form @submit.prevent="submit()"><div class="condition-body"><p :class="{ready:item.condition_ready}">{{ item.condition_ready ? '条件已达成 · 待操作' : '等待工艺条件' }}</p><p>{{ item.hint }}</p><p v-if="item.operation_target">操作目标：{{ item.operation_target }}</p><label v-for="key in fields" :key="key">实测{{ labels[key] }}（{{ units[key] }}）<input v-model="values[key]" type="number" step="any" :min="key==='temperature'?undefined:0" :max="key==='attenuation'?100:undefined" required></label><label>判断依据及操作结果<textarea v-model.trim="note" rows="2" required placeholder="填写实测依据、实际操作参数和结果"></textarea></label><template v-if="!item.condition_ready"><label class="confirm"><input v-model="override" type="checkbox">条件未达到，人工确认操作</label><label v-if="override">人工确认原因（必填）<textarea v-model.trim="overrideReason" rows="2" required placeholder="说明未达条件仍执行的原因"></textarea></label></template><label v-if="!item.metric" class="confirm"><input v-model="confirmed" type="checkbox" required>已实际完成{{ item.title }}</label><p v-if="error" role="alert" class="error">{{ error }}</p></div><footer><button class="submit" :disabled="saving">{{ saving?'提交中…':'确认操作并提交' }}</button><button v-if="item.test_available" type="button" class="test" :disabled="saving" @click="submit(true)">测试：进入下一发酵日</button></footer></form></section></div></Teleport>
</template>
<style scoped>
.condition-mask{position:fixed;inset:0;z-index:2200;background:#0009;display:flex;justify-content:flex-end}.condition-drawer{width:min(520px,100vw);height:100%;background:#25251f;color:var(--text-primary);display:flex;flex-direction:column;outline:none}.condition-drawer header{display:flex;justify-content:space-between;padding:24px 28px;border-bottom:1px solid var(--border-default)}h2{font-size:22px;margin:10px 0}small{color:#afd2a3}p{font-size:13px;color:var(--text-muted);line-height:1.8}header button{border:0;background:none;color:inherit;font-size:26px;align-self:flex-start;cursor:pointer}form{display:flex;flex-direction:column;flex:1;min-height:0}.condition-body{padding:20px 28px;overflow:auto;flex:1}label{display:block;font-size:13px;margin:20px 0}input:not([type=checkbox]),textarea{display:block;box-sizing:border-box;width:100%;padding:12px;margin-top:9px;border:1px solid var(--border-default);border-radius:8px;background:var(--bg-input);color:inherit;font:inherit}textarea{min-height:64px;resize:vertical}.confirm{display:flex;align-items:center;gap:10px}.ready{color:#b8e6a5;font-weight:700}.error{color:#ed9d90}footer{padding:20px 28px;border-top:1px solid var(--border-default)}footer button{margin-top:8px;width:100%;padding:12px;border-radius:8px;font:inherit;font-size:13px;cursor:pointer}.submit{background:#e0bc70;border:1px solid #e0bc70;color:#282313}.test{background:transparent;border:1px dashed #77705b;color:#c6b68c;margin-top:12px}button:disabled{opacity:.5}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #e0bc70;outline-offset:3px}
</style>
