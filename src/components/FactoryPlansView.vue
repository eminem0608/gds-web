<script setup>
import {computed,ref,watch} from 'vue';
import ProductionPlanDetail from './ProductionPlanDetail.vue';
const props=defineProps({plans:{type:Array,default:()=>[]},loading:Boolean});
defineEmits(['refresh']);
const keyword=ref(''),factory=ref(''),filter=ref('active'),page=ref(1),selected=ref(null);
const closed=p=>['done','cancelled','terminated'].includes(p.state);
const ready=p=>['draft','checked','pending_approval','submitted','approved'].includes(p.state);
const factories=computed(()=>[...new Map(props.plans.filter(p=>p.factory).map(p=>[p.factory.id,p.factory])).values()]);
const scoped=computed(()=>props.plans.filter(p=>(!factory.value||p.factory?.id===factory.value)&&(!keyword.value||[p.name,p.product?.name,p.tank?.name,p.batch?.name].join(' ').toLowerCase().includes(keyword.value.toLowerCase()))));
const counts=computed(()=>({active:scoped.value.filter(p=>!closed(p)).length,waiting:scoped.value.filter(ready).length,stocking:scoped.value.filter(p=>p.state==='stocking').length,done:scoped.value.filter(p=>p.state==='done').length,all:scoped.value.length}));
const rows=computed(()=>scoped.value.filter(p=>filter.value==='all'||filter.value==='active'&&!closed(p)||filter.value==='waiting'&&ready(p)||filter.value==='stocking'&&p.state==='stocking'||filter.value==='done'&&p.state==='done').sort((a,b)=>String(a.planned_start||'9999').localeCompare(String(b.planned_start||'9999'))));
const visible=computed(()=>rows.value.slice((page.value-1)*15,page.value*15));
watch([keyword,factory,filter],()=>page.value=1);
watch(rows,()=>page.value=Math.min(page.value,Math.max(1,Math.ceil(rows.value.length/15))));
const number=v=>Number(v||0).toLocaleString('zh-CN',{maximumFractionDigits:1});
const date=v=>v?new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v)?v:v+'Z').toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'未排期';
const label=p=>({draft:'待下发',checked:'待下发',approved:'待下发',submitted:'待下发',pending_approval:'待审批',stocking:'原料备货中',dispatched:'已下发',in_progress:'生产中',done:p.packaging_plan?.status==='packaged'?'已包装':p.brewing_completion?.disposition==='in_tank'?'酿造完成 · 原液在罐':'已完成',cancelled:'已取消',terminated:'已终止'}[p.state]||p.state);
const tabs=[['active','进行中'],['waiting','待下发'],['stocking','备货中'],['done','已完成'],['all','全部']];
</script>
<template>
<section class="factory-workspace">
<header class="fw-heading"><div><h2>生产计划</h2><p>按开始时间查看排期与生产进度</p></div><button class="btn btn-sm btn-outline" :disabled="loading" @click="$emit('refresh')">{{ loading?'加载中…':'刷新' }}</button></header>
<div class="fw-toolbar"><div class="fw-tabs" role="group" aria-label="生产状态"><button v-for="[key,name] in tabs" :key="key" :class="{active:filter===key}" @click="filter=key">{{ name }}<small>{{ counts[key] }}</small></button></div><div class="fw-search"><input v-model.trim="keyword" aria-label="搜索生产计划" placeholder="搜索酒款、计划或罐位"><select v-if="factories.length>1" v-model="factory" aria-label="厂区"><option value="">全部厂区</option><option v-for="f in factories" :key="f.id" :value="f.id">{{ f.name }}</option></select></div></div>
<div class="fw-table-wrap"><table class="fw-table"><thead><tr><th>计划时间</th><th>酒款 / 计划</th><th class="fw-numeric">计划产量</th><th>生产资源</th><th>进度</th><th></th></tr></thead><tbody><tr v-for="p in visible" :key="p.id"><td><strong>{{ date(p.planned_start) }}</strong><small>至 {{ date(p.planned_end) }}</small></td><td><button class="fw-name" @click="selected=p.id">{{ p.product?.name || '未设置酒款' }}</button><small>{{ p.name }}</small></td><td class="fw-numeric"><strong>{{ number(p.planned_volume_l) }} <em>L</em></strong></td><td><strong>{{ p.tank?.name || '未指定罐位' }}<span v-if="p.equipment?.name"> · {{ p.equipment.name }}</span></strong><small>{{ p.factory?.name }}<template v-if="p.owner?.name"> · {{ p.owner.name }}</template></small></td><td><span class="fw-status" :class="p.state">{{ label(p) }}</span></td><td><button class="fw-link" @click="selected=p.id">查看 →</button></td></tr></tbody></table><div v-if="!visible.length" class="fw-empty">{{ loading?'正在加载排期…':plans.length?'当前筛选下没有生产计划':'暂无生产计划' }}</div></div>
<footer class="fw-pagination"><span>共 {{ rows.length }} 个计划</span><div><button :disabled="page<=1" @click="page--">上一页</button><span>{{ page }} / {{ Math.max(1,Math.ceil(rows.length/15)) }}</span><button :disabled="page*15>=rows.length" @click="page++">下一页</button></div></footer>
<ProductionPlanDetail v-if="selected" :plan-id="selected" read-only @close="selected=null" @changed="$emit('refresh')" />
</section>
</template>
<style src="../factory-workspace.css"></style>
