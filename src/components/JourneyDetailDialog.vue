<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
defineOptions({ inheritAttrs: false });
defineProps({title:String,subtitle:String,width:{type:String,default:'900px'},layer:{type:Number,default:2300}});
const emit=defineEmits(['close']);
const panel=ref(null);
let trigger;
onMounted(async()=>{trigger=document.activeElement;await nextTick();panel.value?.focus();});
onUnmounted(()=>trigger?.focus());
function key(event){
 if(event.key==='Escape'){event.stopPropagation();emit('close');}
 if(event.key!=='Tab')return;
 const nodes=[...panel.value.querySelectorAll('button,a,input,select,textarea,summary')].filter(n=>!n.disabled&&n.getClientRects().length);
 const first=nodes[0],last=nodes.at(-1);
 if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.value)){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
}
</script>
<template><Teleport to="body"><div v-bind="$attrs" class="journey-dialog-mask" :style="{zIndex:layer}" @click.self="$emit('close')"><section ref="panel" class="journey-dialog" :style="{width: 'min('+width+', 100%)'}" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" @keydown="key"><header><div><h3>{{ title }}</h3><p v-if="subtitle">{{ subtitle }}</p></div><button type="button" aria-label="关闭详情" @click="$emit('close')">×</button></header><main><slot /></main><footer><slot name="footer"><button type="button" class="btn btn-secondary" @click="$emit('close')">关闭</button></slot></footer></section></div></Teleport></template>
<style scoped>
.journey-dialog-mask{position:fixed;inset:0;z-index:2300;display:flex;align-items:center;justify-content:center;padding:20px;background:#000a}.journey-dialog{display:flex;flex-direction:column;width:min(900px,100%);max-height:88vh;background:#25251f;color:var(--text-primary);border:1px solid var(--border-default);border-radius:12px;box-shadow:0 20px 70px #0008;outline:none}.journey-dialog>header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:22px 26px;border-bottom:1px solid var(--border-default)}h3{font-size:19px;margin:0}header p{font-size:12px;line-height:1.8;color:var(--text-muted);margin:8px 0 0}header>button{border:0;background:none;color:var(--text-muted);font-size:26px;cursor:pointer}.journey-dialog>main{padding:22px 26px;overflow:auto;min-height:0}.journey-dialog>footer{padding:15px 26px;border-top:1px solid var(--border-default);text-align:right}button:focus-visible{outline:2px solid #e0bc70;outline-offset:3px}@media(max-width:600px){.journey-dialog-mask{padding:10px}.journey-dialog>header,.journey-dialog>main{padding:18px}}
</style>
