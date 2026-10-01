<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { brewApi } from "../api";

const props = defineProps({ permissions: { type: Array, default: () => [] } });
const emit = defineEmits(["toast"]);
const tab = ref("overview");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const modal = ref("");
const modalError = ref("");
const draft = reactive({});

const summary = ref({ totals: {} });
const lots = ref([]);
const requisitions = ref([]);
const sourcePlans = ref([]);
const orders = ref([]);
const visibleOrders = computed(() => orders.value.filter((order) => !receipts.value.some((receipt) => receipt.purchase_order?.id === order.id))); 
const receipts = ref([]);
const inspections = ref([]);
const counts = ref([]);
const materialRequisitions = ref([]);
const factories = ref([]);
const materials = ref([]);
const suppliers = ref([]);
const locations = ref([]);
const exports = ref([]);

const isAdmin = computed(() => props.permissions.some((item) => ["admin.user.manage", "base.master_data.manage"].includes(item)));
const canPurchase = computed(() => isAdmin.value || props.permissions.includes("purchase.order.manage"));
const canApproveRequisition = computed(() => isAdmin.value || props.permissions.includes("purchase.requisition.approve"));
const canApproveOrder = computed(() => isAdmin.value || props.permissions.includes("purchase.order.approve"));
const canWarehouse = computed(() => isAdmin.value || props.permissions.includes("inventory.receipt.manage"));
const canCount = computed(() => isAdmin.value || props.permissions.includes("inventory.count.manage"));
const canExport = computed(() => isAdmin.value || props.permissions.some((item) => ["report.purchase.export", "report.all.export"].includes(item)));

const tabs = [
  { id: "overview", label: "总览" },
  { id: "requisitions", label: "采购需求" },
  { id: "orders", label: "采购执行" },
  { id: "receiving", label: "收货质检" },
  { id: "inventory", label: "库存作业" },
  { id: "settlement", label: "对账导出" }
];
const states = {
  draft: "草稿", submitted: "待审批", approved: "已批准", returned: "已退回",
  ordered: "已转订单", closed: "已关闭", cancelled: "已取消", none: "未提交",
  pending: "待审批", sent: "已发送", purchase: "已下单", done: "已完成",
  pending_approval: "待审批", arrived: "到货待检", inspected: "已质检",
  completed: "已完成", counting: "盘点中", recommended: "已推荐批次",
  issued: "已发料", acknowledged: "已确认实领", qualified: "合格",
  rejected: "不合格", queued: "排队中", running: "生成中", failed: "失败"
};
const stateText = (value) => states[value] || value || "-";
const number = (value, digits = 2) => Number(value || 0).toFixed(digits);
const dateTime = (value) => value ? String(value).replace("T", " ").slice(0, 16) : "-";
const requestType = (item) => item.request_type === "emergency" ? "紧急采购" : "计划缺料";
const orderType = (item) => item.procurement_type === "emergency" ? "紧急采购" : "计划采购";
const remaining = (line) => Math.max(Number(line.approved_qty || 0) - Number(line.ordered_qty || 0), 0);

const metrics = computed(() => [
  { label: "可用库存", value: number(summary.value.totals?.available, 3), hint: "合格且未预占" },
  { label: "待审批需求", value: requisitions.value.filter((item) => item.state === "submitted").length, hint: "需在待办完成审批" },
  { label: "待下单", value: requisitions.value.filter((item) => item.state === "approved" && item.lines.some((line) => remaining(line) > 0)).length, hint: "已批准未转订单" },
  { label: "在途采购", value: orders.value.filter((item) => item.state === "purchase").length, hint: "已下单未关闭" },
  { label: "待质检", value: inspections.value.filter((item) => item.state === "draft").length, hint: "到货后自动生成" },
  { label: "盘点中", value: counts.value.filter((item) => ["counting", "pending_approval"].includes(item.state)).length, hint: "库存余额不可直改" }
]);
const queue = computed(() => {
  const items = [];
  requisitions.value.filter((item) => ["draft", "returned"].includes(item.state)).forEach((item) => items.push({ type: "需求", name: item.name, text: "提交采购审批", tab: "requisitions" }));
  requisitions.value.filter((item) => item.state === "approved" && item.lines.some((line) => remaining(line) > 0)).forEach((item) => items.push({ type: "采购", name: item.name, text: "选择供应商并生成订单", tab: "requisitions" }));
  orders.value.filter((item) => ["draft", "sent"].includes(item.state)).forEach((item) => items.push({ type: "订单", name: item.name, text: item.approval_state === "approved" ? "正式下单" : "推进订单审批", tab: "orders" }));
  inspections.value.filter((item) => item.state === "draft").forEach((item) => items.push({ type: "质检", name: item.name, text: "录入来料检验结果", tab: "receiving" }));
  receipts.value.filter((item) => item.state === "inspected").forEach((item) => items.push({ type: "入库", name: item.name, text: "完成合格入库与退货处置", tab: "receiving" }));
  return items.slice(0, 8);
});
const rejectedRows = computed(() => inspections.value.flatMap((inspection) =>
  (inspection.lines || []).filter((line) => Number(line.rejected_qty) > 0).map((line) => ({
    inspection: inspection.name, receipt: inspection.receipt_name, product: line.product?.name,
    lot: line.lot?.name, quantity: line.rejected_qty, uom: line.uom?.name,
    disposition: line.disposition === "return" ? "退回供应商" : "报损"
  }))
));
const settlementRows = computed(() => orders.value.map((order) => {
  const orderReceipts = receipts.value.filter((item) => item.purchase_order?.id === order.id);
  const received = orderReceipts.reduce((total, item) => total + (item.lines || []).reduce((sum, line) => sum + Number(line.received_qty || 0), 0), 0);
  const rejected = inspections.value.filter((item) => orderReceipts.some((receipt) => receipt.id === item.receipt_id))
    .reduce((total, item) => total + (item.lines || []).reduce((sum, line) => sum + Number(line.rejected_qty || 0), 0), 0);
  return { ...order, received, rejected };
}));

async function load() {
  loading.value = true;
  error.value = "";
  const jobs = [
    [summary, brewApi.getInventorySummary()],
    [lots, brewApi.listInventoryLots({ page_size: 100 })],
    [requisitions, brewApi.listPurchaseRequisitions({ page_size: 100 })],
    [orders, brewApi.listPurchaseOrders({ page_size: 100 })],
    [receipts, brewApi.listReceipts({ page_size: 100 })],
    [inspections, brewApi.listQualityInspections({ page_size: 100 })],
    [counts, brewApi.listInventoryCounts({ page_size: 100 })],
    [materialRequisitions, brewApi.listMaterialRequisitions({ page_size: 100 })],
    [factories, brewApi.listMaster("factories", { page_size: 100, active: true })],
    [materials, brewApi.listMaster("materials", { page_size: 100, active: true })],
    [suppliers, brewApi.listMaster("suppliers", { page_size: 100, active: true })],
    [locations, brewApi.listMaster("locations", { page_size: 100, active: true })]
  ];
  if (canPurchase.value) jobs.push([sourcePlans, brewApi.listPurchaseSourcePlans()]);
  if (canExport.value) jobs.push([exports, brewApi.listExports({ page_size: 30 })]);
  const results = await Promise.allSettled(jobs.map((item) => item[1]));
  const failures = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") jobs[index][0].value = result.value;
    else failures.push(result.reason?.message || "部分数据加载失败");
  });
  if (failures.length) error.value = [...new Set(failures)].join("；");
  loading.value = false;
}

function resetDraft(values) {
  Object.keys(draft).forEach((key) => delete draft[key]);
  Object.assign(draft, values);
  modalError.value = "";
}
function openEmergency() {
  resetDraft({ factory_id: "", need_date: new Date().toISOString().slice(0, 10), emergency_reason: "", reason: "", lines: [{ material_id: "", quantity: "" }] });
  modal.value = "emergency";
}
function openPlan() {
  resetDraft({ plan_ids: [], need_date: new Date().toISOString().slice(0, 10), reason: "生产计划缺料汇总" });
  modal.value = "plan";
}
function openOrder(requisition) {
  resetDraft({ requisition, supplier_id: "", lines: requisition.lines.filter((line) => remaining(line) > 0).map((line) => ({ ...line, quantity: remaining(line), price_unit: "" })) });
  modal.value = "order";
}
function openReceipt(order) {
  const scoped = locations.value.filter((item) => String(item.brew_factory_id?.id || "") === String(order.factory?.id || ""));
  const firstMaterial = materials.value.find((item) => String(item.product_variant_id) === String(order.lines?.[0]?.product?.id));
  const destinationType = firstMaterial?.brew_item_type === "packaging_material" ? "packaging" : "raw_material";
  resetDraft({
    order, qc_location_id: scoped.find((item) => item.brew_location_type === "qc")?.id || "",
    destination_location_id: scoped.find((item) => item.brew_location_type === destinationType && item.usage === "internal")?.id || scoped.find((item) => item.brew_location_type !== "qc" && item.usage === "internal")?.id || "",
    lines: order.lines.map((line) => ({ ...line, received_qty: line.quantity, lot_name: "", supplier_lot: "", expiration_date: "" }))
  });
  modal.value = "receipt";
}
function openQuality(inspection) {
  resetDraft({ inspection, note: inspection.note || "", lines: inspection.lines.map((line) => ({ ...line, qualified_qty: line.inspected_qty, rejected_qty: 0, disposition: "", note: line.note || "" })) });
  modal.value = "quality";
}
function openCount(count = null) {
  resetDraft(count ? { count, lines: count.lines.map((line) => ({ ...line, counted_qty: line.counted_qty })) } : { location_id: "" });
  modal.value = count ? "count-lines" : "count-create";
}
function addEmergencyLine() { draft.lines.push({ material_id: "", quantity: "" }); }
function materialFor(id) { return materials.value.find((item) => String(item.id) === String(id)); }

async function submitModal() {
  saving.value = true; modalError.value = "";
  try {
    if (modal.value === "emergency") {
      await brewApi.createPurchaseRequisition({
        factory_id: draft.factory_id, need_date: draft.need_date, request_type: "emergency",
        emergency_reason: draft.emergency_reason, reason: draft.reason,
        lines: draft.lines.map((line) => {
          const material = materialFor(line.material_id);
          return { product_id: material?.product_variant_id, uom_id: material?.uom_id?.id, requested_qty: Number(line.quantity) };
        })
      });
    } else if (modal.value === "plan") {
      await brewApi.aggregatePurchaseRequisitions({ plan_ids: draft.plan_ids, need_date: draft.need_date, reason: draft.reason });
    } else if (modal.value === "order") {
      await brewApi.createPurchaseOrderFromRequisitions({
        supplier_id: draft.supplier_id,
        lines: draft.lines.map((line) => ({ requisition_line_id: line.id, quantity: Number(line.quantity), price_unit: Number(line.price_unit || 0) }))
      });
    } else if (modal.value === "receipt") {
      await brewApi.createReceipt({
        purchase_order_id: draft.order.id, qc_location_id: draft.qc_location_id,
        destination_location_id: draft.destination_location_id,
        lines: draft.lines.map((line) => ({ order_line_id: line.id, received_qty: Number(line.received_qty), lot_name: line.lot_name, supplier_lot: line.supplier_lot, expiration_date: line.expiration_date || null }))
      });
    } else if (modal.value === "quality") {
      for (const line of draft.lines) {
        const qualified = Number(line.qualified_qty || 0);
        const rejected = Number(line.rejected_qty || 0);
        const inspected = Number(line.inspected_qty || 0);
        if (qualified < 0 || rejected < 0 || qualified + rejected > inspected + 0.000001) {
          throw new Error(`${line.product?.name || "该物料"} 的合格与不合格数量之和不能超过检验数量 ${inspected}`);
        }
        if (rejected > 0 && !line.disposition) {
          throw new Error(`${line.product?.name || "该物料"} 存在不合格数量，请选择退货或报损`);
        }
      }
      const updated = await brewApi.updateQualityResults(draft.inspection.id, {
        version: draft.inspection.version, note: draft.note,
        lines: draft.lines.map((line) => ({ id: line.id, qualified_qty: Number(line.qualified_qty), rejected_qty: Number(line.rejected_qty), disposition: Number(line.rejected_qty) ? line.disposition : null, result_json: "{}", note: line.note }))
      });
      await brewApi.qualityInspectionAction(updated.id, draft.lines.some((line) => Number(line.rejected_qty) > 0) ? "reject" : "pass", { version: updated.version });
    } else if (modal.value === "count-create") {
      await brewApi.createInventoryCount({ location_id: draft.location_id });
    } else if (modal.value === "count-lines") {
      const updated = await brewApi.updateInventoryCountLines(draft.count.id, { version: draft.count.version, lines: draft.lines.map((line) => ({ id: line.id, counted_qty: Number(line.counted_qty) })) });
      await brewApi.inventoryCountAction(updated.id, "submit", { version: updated.version });
    }
    emit("toast", "操作已完成"); modal.value = ""; await load();
  } catch (cause) { modalError.value = cause.message || "操作失败"; }
  finally { saving.value = false; }
}
async function runAction(callback, success) {
  try { await callback(); emit("toast", success); await load(); }
  catch (cause) { error.value = cause.message || "操作失败"; }
}
function requisitionAction(item, action) {
  const reason = action === "return" ? window.prompt("请输入退回原因") : "";
  if (action === "return" && !reason) return;
  runAction(() => brewApi.purchaseRequisitionAction(item.id, action, { version: item.version, reason }), "采购需求已更新");
}
function orderAction(item, action) {
  const reason = action === "close" ? window.prompt("如有短交，请填写关闭原因；足量收货可直接确认", "") : "";
  if (action === "close" && reason === null) return;
  runAction(() => brewApi.purchaseOrderAction(item.id, action, { version: item.version, reason }), "采购订单已更新");
}
function receiptAction(item, action) {
  runAction(() => brewApi.receiptAction(item.id, action, { version: item.version }), action === "confirm-arrival" ? "已确认到货并生成质检单" : "入库与退货处置已完成");
}
function countAction(item, action) { runAction(() => brewApi.inventoryCountAction(item.id, action, { version: item.version }), "盘点单已更新"); }
function materialAction(item, action) { runAction(() => brewApi.materialRequisitionAction(item.id, action, { version: item.version }), "领料单已更新"); }
function toggleLot(item) {
  const reason = window.prompt(item.frozen ? "请输入解冻原因" : "请输入冻结原因");
  if (!reason) return;
  runAction(() => brewApi.freezeInventoryLot(item.id, !item.frozen, reason), item.frozen ? "批次已解冻" : "批次已冻结");
}
function createExport() { runAction(() => brewApi.createExport({ export_type: "purchase", filters: {} }), "采购对账导出已进入生成队列"); }
onMounted(load);
</script>

<template>
  <div class="inventory-workbench">
    <div class="inventory-hero">
      <div><span class="inventory-eyebrow">库存采购工作台</span><h2>从缺料到入库，一条主线处理</h2><p>普通采购来自生产缺口；紧急采购单独标识并强制审批。库存余额只由业务单据更新。</p></div>
      <div class="inventory-hero-actions"><button v-if="canPurchase" class="btn btn-outline" type="button" @click="openEmergency">紧急采购</button><button v-if="canPurchase" class="btn btn-primary" type="button" @click="openPlan">汇总计划缺口</button><button class="icon-action" type="button" title="刷新" aria-label="刷新" :disabled="loading" @click="load">↻</button></div>
    </div>
    <div v-if="error" class="master-error inventory-error">{{ error }}</div>
    <div class="inventory-flow"><span>生产缺口</span><b>›</b><span>需求审批</span><b>›</b><span>采购下单</span><b>›</b><span>到货质检</span><b>›</b><span>合格入库</span><b>›</b><span>对账导出</span></div>
    <div class="inventory-tabs"><button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">{{ item.label }}</button></div>

    <template v-if="tab === 'overview'">
      <div class="inventory-metric-grid"><div v-for="item in metrics" :key="item.label" class="inventory-metric"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.hint }}</small></div></div>
      <section class="inventory-section"><header><div><h3>下一步操作</h3><p>只显示当前流程需要推进的事项</p></div><span>{{ queue.length }} 项</span></header><div v-if="queue.length" class="action-queue"><button v-for="item in queue" :key="item.type + item.name" type="button" @click="tab = item.tab"><span>{{ item.type }}</span><strong>{{ item.name }}</strong><em>{{ item.text }}</em><b>›</b></button></div><div v-else class="inventory-empty">当前没有需要处理的采购库存事项</div></section>
      <section class="inventory-section"><header><div><h3>库存健康度</h3><p>待检、预占与冻结数量均不计入可用库存</p></div></header><div class="stock-health"><div><span>账面库存</span><strong>{{ number(summary.totals?.on_hand,3) }}</strong></div><div><span>业务预占</span><strong>{{ number(summary.totals?.reserved,3) }}</strong></div><div><span>待检库存</span><strong>{{ number(summary.totals?.pending_quality,3) }}</strong></div><div><span>在途库存</span><strong>{{ number(summary.totals?.incoming,3) }}</strong></div><div><span>冻结库存</span><strong>{{ number(summary.totals?.frozen,3) }}</strong></div></div></section>
    </template>

    <section v-else-if="tab === 'requisitions'" class="inventory-section"><header><div><h3>采购需求</h3><p>计划缺料自动汇总；紧急采购必须填写原因并单独审批</p></div><div class="section-actions"><button v-if="canPurchase" class="btn btn-sm btn-outline" @click="openEmergency">新建紧急采购</button><button v-if="canPurchase" class="btn btn-sm btn-primary" @click="openPlan">汇总缺口</button></div></header>
      <div class="work-table-wrap"><table class="work-table"><thead><tr><th>需求单</th><th>来源</th><th>厂区 / 日期</th><th>物料缺口</th><th>状态</th><th>下一步</th></tr></thead><tbody><tr v-for="item in requisitions" :key="item.id"><td><strong>{{ item.name }}</strong><small>{{ item.requester?.name || '-' }}</small></td><td><span class="source-badge" :class="{ emergency: item.request_type === 'emergency' }">{{ requestType(item) }}</span><small>{{ item.emergency_reason || item.reason || '-' }}</small></td><td>{{ item.factory?.name }}<small>{{ item.need_date }}</small></td><td><strong>{{ item.lines.length }} 项</strong><small>{{ item.lines.map(line => line.product?.name).join('、') }}</small></td><td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span><small v-if="item.return_reason">退回原因：{{ item.return_reason }}</small></td><td class="row-actions"><button v-if="canPurchase && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-primary" @click="requisitionAction(item,'submit')">提交审批</button><button v-if="canApproveRequisition && item.state === 'submitted'" class="btn btn-xs btn-outline" @click="requisitionAction(item,'approve')">审批</button><button v-if="canApproveRequisition && item.state === 'submitted'" class="btn btn-xs btn-danger" @click="requisitionAction(item,'return')">退回</button><button v-if="canPurchase && item.state === 'approved' && item.lines.some(line => remaining(line) > 0)" class="btn btn-xs btn-primary" @click="openOrder(item)">生成采购单</button></td></tr><tr v-if="!requisitions.length"><td colspan="6" class="inventory-empty">暂无采购需求</td></tr></tbody></table></div>
    </section>

    <section v-else-if="tab === 'orders'" class="inventory-section"><header><div><h3>采购执行</h3><p>订单必须由已批准需求生成，计划采购与紧急采购不混单</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>采购订单</th><th>来源</th><th>供应商</th><th>金额</th><th>订单 / 审批</th><th>下一步</th></tr></thead><tbody><tr v-for="item in visibleOrders" :key="item.id"><td><strong>{{ item.name }}</strong><small>{{ dateTime(item.order_date) }}</small></td><td><span class="source-badge" :class="{ emergency: item.procurement_type === 'emergency' }">{{ orderType(item) }}</span><small>{{ item.requisition_ids.length }} 张需求</small></td><td>{{ item.supplier?.name || '-' }}</td><td><strong>{{ number(item.amount_total) }}</strong><small>{{ item.currency }}</small></td><td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span><small>审批：{{ stateText(item.approval_state) }}</small><small v-if="item.approval_return_reason">退回原因：{{ item.approval_return_reason }}</small></td><td class="row-actions"><button v-if="canPurchase && ['draft','sent'].includes(item.state) && ['none','returned'].includes(item.approval_state)" class="btn btn-xs btn-primary" @click="orderAction(item,'submit')">提交审批</button><button v-if="canApproveOrder && item.approval_state === 'pending'" class="btn btn-xs btn-outline" @click="orderAction(item,'approve')">审批</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'approved'" class="btn btn-xs btn-primary" @click="orderAction(item,'place')">正式下单</button><button v-if="canWarehouse && item.state === 'purchase'" class="btn btn-xs btn-outline" @click="openReceipt(item)">登记收货</button><button v-if="canPurchase && item.state === 'purchase'" class="btn btn-xs btn-outline" @click="orderAction(item,'close')">关闭</button></td></tr><tr v-if="!orders.length"><td colspan="6" class="inventory-empty">暂无采购订单</td></tr></tbody></table></div></section>

    <template v-else-if="tab === 'receiving'"><section class="inventory-section"><header><div><h3>到货与入库</h3><p>到货先进入待检库位，质检完成后才可正式入库</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>收货单</th><th>采购订单</th><th>待检库位</th><th>批次</th><th>状态</th><th>下一步</th></tr></thead><tbody><tr v-for="item in receipts" :key="item.id"><td><strong>{{ item.name }}</strong></td><td>{{ item.purchase_order?.name }}</td><td>{{ item.qc_location?.name }}</td><td>{{ item.lines.length }} 个</td><td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span></td><td class="row-actions"><button v-if="canWarehouse && item.state === 'draft'" class="btn btn-xs btn-primary" @click="receiptAction(item,'confirm-arrival')">确认到货</button><button v-if="canWarehouse && item.state === 'inspected'" class="btn btn-xs btn-primary" @click="receiptAction(item,'put-away')">完成入库</button></td></tr><tr v-if="!receipts.length"><td colspan="6" class="inventory-empty">暂无收货记录</td></tr></tbody></table></div></section><section class="inventory-section"><header><div><h3>来料质检</h3><p>不合格数量必须选择退回供应商或报损</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>质检单</th><th>收货单</th><th>物料批次</th><th>检验结果</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in inspections" :key="item.id"><td><strong>{{ item.name }}</strong></td><td>{{ item.receipt_name }}</td><td>{{ item.lines.map(line => line.lot?.name).join('、') }}</td><td>合格 {{ number(item.lines.reduce((n,line)=>n+Number(line.qualified_qty||0),0),3) }} / 不合格 {{ number(item.lines.reduce((n,line)=>n+Number(line.rejected_qty||0),0),3) }}</td><td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span></td><td><button v-if="canWarehouse && item.state === 'draft'" class="btn btn-xs btn-primary" @click="openQuality(item)">录入结果</button></td></tr></tbody></table></div></section><section v-if="rejectedRows.length" class="inventory-section"><header><div><h3>采购退货 / 报损</h3><p>来源为来料质检不合格，不重复建单</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>质检单</th><th>收货单</th><th>物料 / 批次</th><th>数量</th><th>处置</th></tr></thead><tbody><tr v-for="item in rejectedRows" :key="item.inspection + item.lot"><td>{{ item.inspection }}</td><td>{{ item.receipt }}</td><td>{{ item.product }}<small>{{ item.lot }}</small></td><td>{{ item.quantity }} {{ item.uom }}</td><td>{{ item.disposition }}</td></tr></tbody></table></div></section></template>

    <template v-else-if="tab === 'inventory'"><section class="inventory-section"><header><div><h3>批次库存</h3><p>冻结、待检和已预占数量不可领用</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>物料 / 批次</th><th>效期</th><th>账面</th><th>预占</th><th>可用</th><th>质量</th><th>操作</th></tr></thead><tbody><tr v-for="item in lots" :key="item.id"><td><strong>{{ item.product?.name }}</strong><small>{{ item.name }}</small></td><td>{{ item.expiration_date || '未设置' }}</td><td>{{ number(item.on_hand,3) }} {{ item.uom }}</td><td>{{ number(item.reserved,3) }}</td><td><strong>{{ number(item.available,3) }}</strong></td><td>{{ item.frozen ? '已冻结' : stateText(item.quality_status) }}</td><td><button v-if="canWarehouse" class="btn btn-xs btn-outline" @click="toggleLot(item)">{{ item.frozen ? '解冻' : '冻结' }}</button></td></tr></tbody></table></div></section><section class="inventory-section"><header><div><h3>领料与退料</h3><p>仓库推进推荐批次和发料，实领/退料由生产侧确认</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>领料单</th><th>生产计划</th><th>物料项</th><th>状态</th><th>仓库操作</th></tr></thead><tbody><tr v-for="item in materialRequisitions" :key="item.id"><td><strong>{{ item.name }}</strong></td><td>{{ item.production_plan?.name }}</td><td>{{ item.lines.length }} 项</td><td>{{ stateText(item.state) }}</td><td class="row-actions"><button v-if="canWarehouse && item.state === 'draft'" class="btn btn-xs btn-outline" @click="materialAction(item,'recommend-lots')">推荐批次</button><button v-if="canWarehouse && item.state === 'recommended'" class="btn btn-xs btn-primary" @click="materialAction(item,'issue')">确认发料</button></td></tr></tbody></table></div></section><section class="inventory-section"><header><div><h3>库存盘点</h3><p>差异审批通过才调整库存</p></div><button v-if="canCount" class="btn btn-sm btn-primary" @click="openCount()">新建盘点</button></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>盘点单</th><th>库位</th><th>明细</th><th>差异</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in counts" :key="item.id"><td><strong>{{ item.name }}</strong></td><td>{{ item.location?.name }}</td><td>{{ item.lines.length }} 项</td><td>{{ number(item.lines.reduce((n,line)=>n+Math.abs(Number(line.difference_qty||0)),0),3) }}</td><td>{{ stateText(item.state) }}</td><td class="row-actions"><button v-if="canCount && item.state === 'draft'" class="btn btn-xs btn-primary" @click="countAction(item,'start')">开始</button><button v-if="canCount && item.state === 'counting'" class="btn btn-xs btn-primary" @click="openCount(item)">录入实数</button><button v-if="canCount && item.state === 'pending_approval'" class="btn btn-xs btn-outline" @click="countAction(item,'confirm')">确认</button></td></tr></tbody></table></div></section></template>

    <section v-else class="inventory-section"><header><div><h3>采购对账准备</h3><p>核对订单、实收与质检退货后导出给财务；本系统不登记真实付款</p></div><button v-if="canExport" class="btn btn-sm btn-primary" @click="createExport">生成采购对账文件</button></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>采购订单</th><th>供应商</th><th>订单金额</th><th>实收数量</th><th>质检退货</th><th>状态</th></tr></thead><tbody><tr v-for="item in settlementRows" :key="item.id"><td><strong>{{ item.name }}</strong><small>{{ orderType(item) }}</small></td><td>{{ item.supplier?.name }}</td><td>{{ number(item.amount_total) }} {{ item.currency }}</td><td>{{ number(item.received,3) }}</td><td>{{ number(item.rejected,3) }}</td><td>{{ item.state === 'done' ? '可对账' : '执行中' }}</td></tr></tbody></table></div><div v-if="exports.length" class="export-history"><h4>最近导出</h4><div v-for="item in exports" :key="item.id"><span>{{ item.name }}</span><span>{{ stateText(item.state) }}</span><a v-if="item.download_url" :href="item.download_url">下载</a></div></div></section>

    <div v-if="modal" class="inventory-modal-mask" @click.self="modal = ''"><section class="inventory-modal"><header><div><h3>{{ modal === 'emergency' ? '新建紧急采购' : modal === 'plan' ? '汇总生产缺口' : modal === 'order' ? '生成采购订单' : modal === 'receipt' ? '登记采购收货' : modal === 'quality' ? '录入质检结果' : modal === 'count-create' ? '新建库存盘点' : '录入盘点实数' }}</h3><p>确认关键信息后继续</p></div><button class="inventory-modal-close" type="button" @click="modal = ''">×</button></header><div class="inventory-modal-body">
      <template v-if="modal === 'emergency'"><label><span>厂区</span><select v-model="draft.factory_id"><option value="">请选择</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>需求日期</span><input v-model="draft.need_date" type="date"></label><label class="wide"><span>紧急原因</span><textarea v-model.trim="draft.emergency_reason" rows="2"></textarea></label><div class="wide modal-lines"><div class="modal-lines-head"><strong>采购明细</strong><button class="btn btn-xs btn-outline" type="button" @click="addEmergencyLine">添加一行</button></div><div v-for="(line,index) in draft.lines" :key="index" class="modal-line"><select v-model="line.material_id"><option value="">选择原料</option><option v-for="item in materials" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" min="0" step="0.001" placeholder="数量"><span>{{ materialFor(line.material_id)?.uom_id?.name || '单位' }}</span></div></div></template>
      <template v-else-if="modal === 'plan'"><label><span>需求日期</span><input v-model="draft.need_date" type="date"></label><label><span>说明</span><input v-model.trim="draft.reason"></label><div class="wide plan-picker"><label v-for="item in sourcePlans" :key="item.id"><input v-model="draft.plan_ids" type="checkbox" :value="item.id"><span><strong>{{ item.name }}</strong><small>{{ item.factory?.name }} · {{ dateTime(item.planned_start) }} · {{ item.shortage_items }} 项缺料</small></span></label><div v-if="!sourcePlans.length" class="inventory-empty">没有存在缺口的生产计划</div></div></template>
      <template v-else-if="modal === 'order'"><label class="wide"><span>供应商</span><select v-model="draft.supplier_id"><option value="">请选择</option><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><div class="wide modal-lines"><div v-for="line in draft.lines" :key="line.id" class="modal-line order-line"><span>{{ line.product?.name }}</span><input v-model.number="line.quantity" type="number" min="0" step="0.001"><input v-model.number="line.price_unit" type="number" min="0" step="0.01" placeholder="单价"></div></div></template>
      <template v-else-if="modal === 'receipt'"><label><span>待检库位</span><select v-model="draft.qc_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.brew_location_type === 'qc')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label><label><span>入库库位</span><select v-model="draft.destination_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.brew_location_type !== 'qc' && x.usage === 'internal')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label><div class="wide modal-lines"><div v-for="line in draft.lines" :key="line.id" class="receipt-line"><strong>{{ line.product?.name }}</strong><input v-model.number="line.received_qty" type="number" min="0" step="0.001" placeholder="实收"><input v-model.trim="line.lot_name" placeholder="内部批次号"><input v-model.trim="line.supplier_lot" placeholder="供应商批号"><input v-model="line.expiration_date" type="date"></div></div></template>
      <template v-else-if="modal === 'quality'"><div class="wide modal-lines"><div v-for="line in draft.lines" :key="line.id" class="quality-line"><div><strong>{{ line.product?.name }}</strong><small>{{ line.lot?.name }} · 待检 {{ line.inspected_qty }} {{ line.uom?.name }}</small></div><label><span>合格</span><input v-model.number="line.qualified_qty" type="number" min="0" step="0.001"></label><label><span>不合格</span><input v-model.number="line.rejected_qty" type="number" min="0" step="0.001"></label><label><span>处置</span><select v-model="line.disposition" :disabled="!Number(line.rejected_qty)"><option value="">请选择</option><option value="return">退回供应商</option><option value="scrap">报损</option></select></label></div></div><label class="wide"><span>质检备注</span><textarea v-model.trim="draft.note" rows="2"></textarea></label></template>
      <template v-else-if="modal === 'count-create'"><label class="wide"><span>盘点库位</span><select v-model="draft.location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.usage === 'internal')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label></template>
      <template v-else><div class="wide modal-lines"><div v-for="line in draft.lines" :key="line.id" class="count-line"><div><strong>{{ line.product?.name }}</strong><small>{{ line.lot?.name || '无批次' }} · 账面 {{ number(line.theoretical_qty,3) }} {{ line.uom?.name }}</small></div><input v-model.number="line.counted_qty" type="number" min="0" step="0.001"></div></div></template>
      <div v-if="modalError" class="master-error wide">{{ modalError }}</div></div><footer><button class="btn btn-secondary" type="button" @click="modal = ''">取消</button><button class="btn btn-primary" type="button" :disabled="saving" @click="submitModal">{{ saving ? '处理中...' : '确认' }}</button></footer></section></div>
  </div>
</template>
