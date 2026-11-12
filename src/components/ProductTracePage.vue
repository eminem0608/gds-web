<script setup>
import { computed, ref, onUnmounted } from 'vue';
import { brewApi } from '../api';
import FinishedCodeBadge from './FinishedCodeBadge.vue';
const query = ref(''), result = ref(null), selected = ref(null), detail = ref(null);
const loading = ref(false), detailLoading = ref(false), error = ref(''), detailError = ref('');
let searchSequence = 0, detailSequence = 0, searchedCode = '';
const groups = computed(() => {
  const definitions = [
    { id: 'material', title: '备料与投料' },
    { id: 'mash', title: '糖化与进罐' },
    { id: 'fermentation', title: '发酵与酿造完成' },
    { id: 'packaging', title: '包装与放行' }
  ];
  const events = detail.value?.events || [];
  const category = event => {
    if (/^(pack-|order-|release-)/.test(event.key)) return 'packaging';
    if (['fermentation', 'brewed'].includes(event.key)) return 'fermentation';
    if (event.key === 'start' || /物料|备料|领料|投料|混入麦芽|加入麦芽/.test(event.title)) return 'material';
    return 'mash';
  };
  return definitions.map(group => {
    const rows = events.filter(event => category(event) === group.id);
    const recorded = rows.filter(event => event.at);
    const times = recorded.map(event => event.at).sort();
    return { ...group, rows, recorded: recorded.length, at: times.at(-1),
      people: [...new Set(recorded.map(event => event.by).filter(Boolean))].join('、') };
  });
});
const states = { packaged: '包装完成', brewed: '酿造完成', in_tank: '酒液在罐', in_progress: '生产中', draft: '待生产', cancelled: '已取消' };
function date(value) {
  if (!value) return '未记录';
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z').toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
}
async function search(page = 1) {
  const code = page === 1 ? query.value.trim() : searchedCode;
  if (!code) return;
  const request = ++searchSequence; ++detailSequence;
  loading.value = true; error.value = ''; result.value = null; selected.value = null; detail.value = null; detailError.value = ''; detailLoading.value = false;
  try {
    const data = await brewApi.searchProductTrace({ code, page, page_size: 12 });
    if (request !== searchSequence) return;
    searchedCode = code; result.value = data;
    if (data.batches.length === 1) await selectBatch(data.batches[0]);
  } catch (cause) { if (request === searchSequence) error.value = cause.message || '产品追溯查询失败，请重试。'; }
  finally { if (request === searchSequence) loading.value = false; }
}
async function selectBatch(batch) {
  const request = ++detailSequence;
  selected.value = batch.id; detail.value = null; detailError.value = ''; detailLoading.value = true;
  try {
    const data = await brewApi.getProductTraceBatch(batch.id, result.value.packaging_id);
    if (request === detailSequence) detail.value = data;
  } catch (cause) { if (request === detailSequence) detailError.value = cause.message || '批次记录加载失败，请重试。'; }
  finally { if (request === detailSequence) detailLoading.value = false; }
}
onUnmounted(() => { ++searchSequence; ++detailSequence; });
</script>
<template>
  <section class="product-trace">
    <header class="pt-heading">
      <h2>产品追溯</h2>
      <form class="pt-search" @submit.prevent="search()"><input v-model="query" type="search" maxlength="256" required aria-label="成品编号或产品编号" placeholder="输入成品编号或产品编号"><button class="btn btn-primary" type="submit" :disabled="loading">{{ loading ? '查询中…' : '查询' }}</button></form>
    </header>
    <p v-if="error" class="master-error" role="alert">{{ error }}</p>
    <div v-if="!result && !loading && !error" class="pt-empty"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 12v24m6-24v24m5-24v24m8-24v24m5-24v24m10-24v24M7 6h34M7 42h34"/></svg><h3>输入成品编号，追溯生产过程</h3><p>成品编号定位本批生产；产品编号查询该酒款的所有批次。</p></div>
    <div v-if="loading && !result" class="empty" role="status">正在查询生产记录…</div>
    <template v-if="result">
      <section class="pt-product"><div><h3>{{ result.product.product.name }}</h3><p v-if="result.product.kind !== 'batch'">{{ result.product.kind === 'product' ? '产品编号' : '包装条码' }} {{ result.product.code }}<span v-if="result.product.name"> · {{ result.product.name }}</span></p></div><span v-if="result.total > 1">{{ result.total }} 个生产批次</span></section>
      <div v-if="!result.batches.length" class="pt-empty"><h3>暂无关联生产记录</h3><p>生产批次生成后，即可通过成品编号追溯。</p></div>
      <div v-else class="pt-workspace" :class="{ single: result.total === 1 }">
        <aside v-if="result.total > 1" class="pt-batches" aria-label="生产批次"><div class="pt-list-heading">生产批次</div><button v-for="batch in result.batches" :key="batch.id" type="button" :class="{ active: selected === batch.id }" :aria-pressed="selected === batch.id" @click="selectBatch(batch)"><div><strong>{{ batch.name }}</strong><span>{{ states[batch.state] || '待核对' }}</span></div><p>{{ batch.factory.name }}</p><small>{{ batch.brewed_at ? date(batch.brewed_at) : date(batch.started_at) }}</small></button>
          <footer v-if="result.total > result.page_size"><button type="button" :disabled="loading || result.page <= 1" @click="search(result.page - 1)">上一页</button><span>{{ result.page }} / {{ Math.ceil(result.total / result.page_size) }}</span><button type="button" :disabled="loading || !result.has_more" @click="search(result.page + 1)">下一页</button></footer>
        </aside>
        <main class="pt-detail">
          <p v-if="detailLoading" class="empty" role="status">正在加载生产记录…</p>
          <div v-else-if="detailError" class="pt-detail-error" role="alert"><p>{{ detailError }}</p><button type="button" class="btn btn-sm btn-outline" @click="selectBatch(result.batches.find(b => b.id === selected))">重试</button></div>
          <div v-else-if="!detail" class="pt-empty"><h3>选择生产批次</h3><p>查看该批次的酒厂、生产时间与操作记录</p></div>
          <template v-else>
            <header class="pt-batch-heading"><div><FinishedCodeBadge :code="detail.batch.finished_product_code" /><p class="pt-location"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M16 8c0 4-6 9-6 9S4 12 4 8a6 6 0 1 1 12 0Z"/><circle cx="10" cy="8" r="2"/></svg>{{ detail.batch.factory.name }}<span v-if="detail.tank"> · {{ detail.tank }}</span></p></div><span class="pt-status" :class="{ packaged: detail.batch.state === 'packaged' }">{{ states[detail.batch.state] || '待核对' }}</span></header>
            <dl class="pt-key-facts" :class="{ 'has-packaging': detail.batch.packaged_at }"><div><dt>开始生产</dt><dd>{{ date(detail.events.find(e => e.key === 'start')?.at) }}</dd></div><div><dt>酿造完成</dt><dd>{{ date(detail.batch.brewed_at) }}</dd></div><template v-if="detail.batch.packaged_at"><div><dt>包装完成</dt><dd>{{ date(detail.batch.packaged_at) }}</dd></div><div><dt>包装操作人</dt><dd>{{ detail.batch.packaged_by || '未记录' }}</dd></div></template><div v-else><dt>包装状态</dt><dd class="pt-muted">尚无包装记录</dd></div></dl>
            <section class="pt-process"><header><h4>生产过程</h4><span>展开阶段查看操作记录</span></header><details v-for="(group,index) in groups" :key="detail.batch.id + group.id" class="pt-stage" :class="{ recorded: group.recorded }"><summary><i class="pt-stage-index">{{ String(index + 1).padStart(2, '0') }}</i><div class="pt-stage-title"><strong>{{ group.title }}</strong><small>{{ group.recorded ? group.recorded + ' 条操作记录' : group.id === 'packaging' ? '尚无包装记录' : '暂无操作记录' }}<template v-if="group.people"> · {{ group.people }}</template></small></div><time v-if="group.at">{{ date(group.at) }}</time><span class="pt-chevron">⌄</span></summary><div v-if="group.rows.length" class="pt-stage-records"><article v-for="event in group.rows" :key="event.key"><div><strong>{{ event.title }}</strong><p v-if="event.detail">{{ event.detail }}</p></div><div><time>{{ date(event.at) }}</time><small>{{ event.by || '操作人未记录' }}</small></div></article></div><p v-else class="pt-stage-empty">该阶段尚无记录</p></details></section>
            <div class="pt-support"><details class="pt-materials"><summary>原料批次 <span>{{ detail.materials.length }} 条</span></summary><div v-if="!detail.materials.length" class="empty">暂无原料批次记录</div><div v-else class="pt-table"><table><thead><tr><th>原料 / 批次</th><th>数量</th><th>记录时间</th><th>操作人</th></tr></thead><tbody><tr v-for="item in detail.materials" :key="item.id"><td>{{ item.name }}<small>{{ item.lot }}</small></td><td>{{ item.quantity }} {{ item.unit }}<small v-if="item.basis">{{ item.basis }}</small></td><td>{{ date(item.at) }}</td><td>{{ item.by || '未记录' }}</td></tr></tbody></table></div></details><details class="pt-context"><summary>批次资料</summary><dl><div><dt>产品编号</dt><dd>{{ detail.batch.product_code || '未设置' }}</dd></div><div><dt>生产批次</dt><dd>{{ detail.batch.name }}</dd></div><div><dt>工艺版本</dt><dd>{{ detail.recipe || '未记录' }}</dd></div><div v-if="detail.batch.finished_lots.length"><dt>库存批次</dt><dd>{{ detail.batch.finished_lots.join('、') }}</dd></div></dl></details></div>
          </template>
        </main>
      </div>
    </template>
  </section>
</template>
<style scoped>
.product-trace{background:var(--bg-surface);border:1px solid var(--border-default);border-radius:12px;overflow:hidden}.pt-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 24px;border-bottom:1px solid var(--border-subtle);flex-wrap:wrap}.pt-heading h2{font-size:17px;margin:0}.pt-search{display:flex;gap:8px;min-width:0}.pt-search input{width:310px;min-width:0;background:var(--bg-input);border:1px solid var(--border-default);border-radius:7px;color:var(--text-primary);padding:0 12px;font-size:12px}.pt-search input,.pt-search .btn{box-sizing:border-box;height:34px;min-height:34px}.pt-search .btn{padding:0 17px;font-size:12px}.pt-product{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 26px 0}.pt-product h3{font-size:23px;line-height:1.4;margin:0;font-weight:600}.pt-product p{font-size:11px;color:var(--text-muted);margin:7px 0 0}.pt-product>span{font-size:12px;color:var(--text-muted)}.pt-workspace{display:grid;grid-template-columns:255px minmax(0,1fr);margin-top:20px;border-top:1px solid var(--border-subtle)}.pt-workspace.single{grid-template-columns:minmax(0,1fr);margin-top:0;border-top:0}.pt-batches{border-right:1px solid var(--border-subtle);padding:18px 12px}.pt-list-heading{font-size:11px;padding:0 10px 12px;color:var(--text-muted)}.pt-batches>button{display:block;text-align:left;width:100%;background:none;color:var(--text-primary);border:1px solid transparent;border-radius:8px;padding:13px 10px;margin-bottom:6px;cursor:pointer}.pt-batches>button:hover{background:var(--bg-elevated)}.pt-batches>button.active{background:#d4a8530c;border-color:#d4a85340}.pt-batches>button>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.pt-batches strong{font-size:12px;font-weight:500}.pt-batches>button span{font-size:10px;color:var(--text-muted)}.pt-batches p{margin:8px 0 4px;font-size:12px;color:var(--text-secondary)}.pt-batches small{color:var(--text-muted);font-size:10px}.pt-batches footer{display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:12px 4px}.pt-batches footer button{border:0;background:none;color:var(--accent-gold);cursor:pointer;font:inherit}.pt-batches footer button:disabled{opacity:.35;cursor:default}.pt-detail{min-width:0;padding:22px 26px 26px}.pt-batch-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.pt-location{display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:12px;margin:12px 0 0}.pt-location svg{width:14px;height:14px;color:var(--text-muted)}.pt-status{font-size:11px;white-space:nowrap;background:#ffffff06;color:var(--text-secondary);padding:5px 9px;border:1px solid var(--border-subtle);border-radius:5px}.pt-status.packaged{background:#68a66d12;color:var(--success);border-color:#68a66d30}.pt-key-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding:22px 0;margin:0}.pt-key-facts.has-packaging{grid-template-columns:repeat(4,minmax(0,1fr))}.pt-key-facts dt{color:var(--text-muted);font-size:11px;margin-bottom:7px}.pt-key-facts dd{margin:0;font-size:13px;line-height:1.6;font-variant-numeric:tabular-nums}.pt-muted{color:var(--text-muted)}.pt-process{border-top:1px solid var(--border-subtle);padding-top:20px}.pt-process>header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.pt-process h4{font-size:14px;margin:0;font-weight:500}.pt-process>header span{font-size:11px;color:var(--text-muted)}.pt-stage{border:1px solid var(--border-subtle);border-radius:8px;margin:8px 0;background:#ffffff01}.pt-stage summary{display:flex;align-items:center;gap:12px;padding:14px 16px;list-style:none;cursor:pointer}.pt-stage summary::-webkit-details-marker{display:none}.pt-stage[open]{border-color:var(--border-default)}.pt-stage-index{display:grid;place-items:center;font-style:normal;font:500 11px ui-monospace,monospace;width:28px;height:28px;flex-shrink:0;border-radius:50%;background:#ffffff05;color:var(--text-muted)}.pt-stage.recorded .pt-stage-index{color:var(--success);background:#68a66d12}.pt-stage-title{min-width:0;flex:1}.pt-stage-title strong{font-weight:500;font-size:13px}.pt-stage-title small{display:block;color:var(--text-muted);font-size:11px;line-height:1.5;margin-top:4px;overflow-wrap:anywhere}.pt-stage summary>time{font-size:11px;color:var(--text-secondary);font-variant-numeric:tabular-nums}.pt-chevron{color:var(--text-muted);transition:transform .15s}.pt-stage[open] .pt-chevron{transform:rotate(180deg)}.pt-stage-records{padding:0 16px 6px 56px}.pt-stage-records article{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:12px 0;border-top:1px solid var(--border-subtle);font-size:12px}.pt-stage-records article strong{font-weight:400}.pt-stage-records article p{color:var(--text-muted);font-size:11px;line-height:1.6;margin:5px 0 0}.pt-stage-records article>div:last-child{text-align:right;flex-shrink:0}.pt-stage-records time{font-size:11px;color:var(--text-secondary);font-variant-numeric:tabular-nums}.pt-stage-records small{display:block;color:var(--text-muted);font-size:11px;margin-top:5px}.pt-stage-empty{padding:0 16px 12px 56px;color:var(--text-muted);font-size:12px}.pt-support{display:grid;grid-template-columns:minmax(0,1fr);margin-top:20px}.pt-support>details{padding:14px 0;border-top:1px solid var(--border-subtle)}.pt-support summary{cursor:pointer;font-size:12px;color:var(--text-secondary)}.pt-support summary span{color:var(--text-muted);font-size:11px;margin-left:8px}.pt-context dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:16px 0 0;margin:0}.pt-context dt{font-size:11px;color:var(--text-muted);margin-bottom:6px}.pt-context dd{font-size:12px;color:var(--text-secondary);margin:0;overflow-wrap:anywhere}.pt-table{overflow:auto;margin-top:12px}.pt-table table{width:100%;border-collapse:collapse;font-size:12px;text-align:left}.pt-table th{font-size:11px;color:var(--text-muted);font-weight:400}.pt-table th,.pt-table td{padding:10px 8px;border-bottom:1px solid var(--border-subtle)}.pt-table small{display:block;color:var(--text-muted);font-size:11px;margin-top:5px}.pt-empty{padding:64px 20px;text-align:center;color:var(--text-muted)}.pt-empty svg{height:40px;width:40px;color:var(--accent-gold);margin-bottom:14px}.pt-empty h3{font-size:15px;font-weight:500;color:var(--text-secondary);margin:0 0 10px}.pt-empty p{font-size:12px;margin:0;line-height:1.8}.pt-detail-error{padding:24px;color:var(--error);font-size:13px}.product-trace input:focus-visible,.product-trace button:focus-visible,.product-trace summary:focus-visible{outline:2px solid var(--accent-gold);outline-offset:2px}@media(max-width:1100px){.pt-key-facts.has-packaging{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.pt-heading,.pt-product,.pt-detail{padding:18px}.pt-product{padding-bottom:0}.pt-search{width:100%}.pt-search input{flex:1;width:0}.pt-workspace{grid-template-columns:1fr}.pt-batches{border-right:0;border-bottom:1px solid var(--border-subtle);max-height:220px;overflow:auto}.pt-key-facts,.pt-key-facts.has-packaging{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.pt-stage summary{flex-wrap:wrap;padding:13px 12px;gap:10px}.pt-stage summary>time{padding-left:38px;order:4;width:100%}.pt-stage-records{padding-left:16px}.pt-stage-records article{gap:12px}.pt-stage-records article>div:last-child{max-width:45%}.pt-stage-records time{overflow-wrap:anywhere}.pt-context dl{grid-template-columns:1fr 1fr}.pt-process>header span{font-size:10px}.pt-batch-heading{gap:10px}.pt-product h3{font-size:21px}}
</style>
