<script setup>
import { computed, ref } from 'vue';
const props = defineProps({ records: { type: Array, default: () => [] }, labels: Object, units: Object });
const selected = ref(null);
const colors = { temperature: '#e5b44e', gravity: '#63b8ed', pressure: '#a58be2', diacetyl: '#e68a71', attenuation: '#79bc91' };
const time = value => Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
const series = computed(() => Object.keys(props.labels).map(key => {
  const data = props.records.filter(r => r.metrics[key] !== undefined && Number.isFinite(Number(r.metrics[key])) && Number.isFinite(time(r.measured_at))).map(r => ({ ...r, value: Number(r.metrics[key]), timestamp: time(r.measured_at) })).sort((a,b) => a.timestamp - b.timestamp);
  return { key, label: props.labels[key], unit: props.units[key], color: colors[key], data };
}));
const shown = computed(() => series.value.filter(s => s.data.length && (!selected.value || selected.value === s.key)));
const bounds = computed(() => { const timestamps = shown.value.flatMap(s => s.data.map(p => p.timestamp)); return { min: Math.min(...timestamps), max: Math.max(...timestamps) }; });
const plotted = computed(() => shown.value.map(s => {
  const min = Math.min(...s.data.map(p => p.value)), max = Math.max(...s.data.map(p => p.value));
  const padding = selected.value ? Math.max((max-min)*0.15, Math.abs(max)*0.05, 0.1) : 0;
  const lower = min-padding, upper = max+padding;
  const points = s.data.map(p => ({ ...p, x: bounds.value.min === bounds.value.max ? 400 : 60+(p.timestamp-bounds.value.min)*680/(bounds.value.max-bounds.value.min), y: lower === upper ? 142 : 244-(p.value-lower)*204/(upper-lower) }));
  return { ...s, min: lower, max: upper, points, path: points.map(p => `${p.x},${p.y}`).join(' ') };
}));
const ticks = computed(() => [0,0.25,0.5,0.75,1].map(ratio => ({ y:244-ratio*204, value: selected.value && plotted.value.length ? format(plotted.value[0].min + ratio*(plotted.value[0].max-plotted.value[0].min)) : `${ratio*100}%` })));
const dates = computed(() => shown.value.length ? (bounds.value.min === bounds.value.max ? [0.5] : [0,0.5,1]).map(ratio => ({ x:60+ratio*680, label: new Date(bounds.value.min+(bounds.value.max-bounds.value.min)*ratio).toLocaleDateString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Shanghai'}) })) : []);
function format(value) { return Number(value.toFixed(2)).toString(); }
function toggle(key) { selected.value = selected.value === key ? null : key; }
function pointTitle(series, point) { return `${series.label}：${format(point.value)} ${series.unit}\n${new Date(point.timestamp).toLocaleString('zh-CN', {hour12:false,timeZone:'Asia/Shanghai'})} · ${point.by}`; }
</script>
<template>
<section class="fermentation-trends">
  <div class="trends-legend" aria-label="选择数据曲线">
    <button type="button" :class="{ active: !selected }" :aria-pressed="!selected" @click="selected = null">全部</button>
    <button v-for="s in series" :key="s.key" type="button" :class="{ active: selected === s.key, muted: !s.data.length }" :aria-pressed="selected === s.key" :style="{ '--series-color': s.color }" @click="toggle(s.key)"><i></i>{{ s.label }}<span>{{ s.unit }}</span></button>
  </div>
  <p class="trends-hint">{{ selected ? '显示实际数值，悬停数据点查看记录。' : '各指标按自身范围展示，悬停数据点查看实测值；点击图例单独查看。' }}</p>
  <div v-if="!shown.length" class="trends-empty">暂无{{ selected ? labels[selected] : '' }}测量数据</div>
  <svg v-else class="trends-chart" viewBox="0 0 800 320" role="img" :aria-label="selected ? labels[selected] + '变化曲线' : '发酵指标变化曲线'">
    <text x="60" y="21" fill="currentColor" class="axis-caption">{{ selected ? labels[selected] + '（' + units[selected] + '）' : '相对变化范围（%）' }}</text>
    <path d="M60 40V244H740" fill="none" class="axis-line"/><text x="400" y="307" text-anchor="middle" class="axis-caption">日期</text>
    <g v-for="tick in ticks" :key="tick.y"><line x1="60" :y1="tick.y" x2="740" :y2="tick.y" class="grid-line"/><line x1="55" :y1="tick.y" x2="60" :y2="tick.y" class="axis-line"/><text x="49" :y="tick.y+4" text-anchor="end" class="axis-text">{{ tick.value }}</text></g>
    <g v-for="(date,index) in dates" :key="index"><line :x1="date.x" y1="244" :x2="date.x" y2="251" class="axis-line"/><text :x="date.x" y="274" :text-anchor="dates.length === 1 ? 'middle' : index === 0 ? 'start' : index === 2 ? 'end' : 'middle'" class="axis-text">{{ date.label }}</text></g>
    <g v-for="s in plotted" :key="s.key"><polyline :points="s.path" fill="none" :stroke="s.color" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><g v-for="p in s.points" :key="p.id"><circle :cx="p.x" :cy="p.y" r="4" :fill="s.color" class="trend-point"><title>{{ pointTitle(s,p) }}</title></circle><text v-if="selected && s.points.length <= 12" :x="p.x" :y="p.y-10" text-anchor="middle" :fill="s.color" class="point-value">{{ format(p.value) }}</text></g></g>
  </svg>
</section>
</template>
<style scoped>
.fermentation-trends{margin-top:16px}.trends-legend{display:flex;flex-wrap:wrap;gap:8px}.trends-legend button{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #ffffff1f;border-radius:8px;background:transparent;color:#d7d4cc;font-size:13px;cursor:pointer;transition:background .15s,border-color .15s}.trends-legend button.active{border-color:var(--series-color,#d4a747);background:#ffffff08;color:#fff}.trends-legend button:hover{background:#ffffff08}.trends-legend i{width:8px;height:8px;border-radius:50%;background:var(--series-color);flex-shrink:0}.trends-legend span{font-size:11px;color:#999}.trends-legend .muted{opacity:.45}.trends-hint{font-size:12px;color:#929087;margin:12px 0 8px}.trends-chart{display:block;width:100%;max-height:330px}.axis-line{stroke:#bbb6a8;stroke-width:1.5;vector-effect:non-scaling-stroke}.grid-line{stroke:#ffffff1f;stroke-dasharray:3 5}.axis-text{font-size:12px;fill:#ccc7bb}.axis-caption{font-size:12px;font-weight:600;fill:#ded8ca}.point-value{font-size:12px}.trend-point{cursor:help;stroke:#27251f;stroke-width:1.5}.trend-point:hover{r:6}.trends-empty{text-align:center;padding:60px 16px;color:#999;font-size:14px}
</style>
