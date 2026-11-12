<script setup>
import { onUnmounted, ref } from 'vue';
const props = defineProps({ code: String });
const status = ref('');
let timer;
async function copy() {
  try {
    await navigator.clipboard.writeText(props.code);
    status.value = '已复制';
  } catch { status.value = '请选中编号复制'; }
  clearTimeout(timer); timer = setTimeout(() => { status.value = ''; }, 2200);
}
onUnmounted(() => { clearTimeout(timer); });
</script>
<template><span v-if="code" class="finished-code-badge"><span>成品编号</span><code>{{ code }}</code><button type="button" :aria-label="'复制成品编号 ' + code" title="复制成品编号" @click.stop="copy"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 4V3H3v9h1"/></svg></button><small v-if="status" role="status">{{ status }}</small></span><span v-else class="finished-code-missing">成品编号未设置</span></template>
<style scoped>
.finished-code-badge{display:inline-flex;align-items:center;gap:8px;max-width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid #d4a85355;border-radius:6px;background:#d4a85312;color:#e5bf71;vertical-align:middle;flex-wrap:wrap}.finished-code-badge>span{font-size:10px;color:#b8a273;white-space:nowrap}.finished-code-badge code{font:600 12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere;user-select:text}.finished-code-badge button{display:grid;place-items:center;flex-shrink:0;width:22px;height:22px;padding:3px;border:0;border-radius:4px;background:none;color:#ccb27f;cursor:pointer}.finished-code-badge button:hover{background:#d4a85320;color:#f3d593}.finished-code-badge button:focus-visible{outline:2px solid #d4a853}.finished-code-badge svg{width:15px;height:15px}.finished-code-badge small,.finished-code-missing{font-size:11px;color:var(--text-muted)}
</style>
