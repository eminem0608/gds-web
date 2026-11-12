<script setup>
import { locationLabel } from "../location-label.js";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { brewApi } from "../api";
import { formatMoney } from "../formatters";
import { groupWarehouseLocations } from "../location-groups";
import WarehouseLocationPicker from "./WarehouseLocationPicker.vue";
import ProcurementMaterialPicker from "./ProcurementMaterialPicker.vue";
import StockBrowserPage from "./StockBrowserPage.vue";
import ProductionPlanDetail from "./ProductionPlanDetail.vue";
import MaterialIssueQueue from "./MaterialIssueQueue.vue";
import InventoryCountPage from "./InventoryCountPage.vue";
import InventoryOverview from "./InventoryOverview.vue";

const props = defineProps({
  permissions: { type: Array, default: () => [] },
  currentUser: { type: Object, default: () => ({}) },
  roles: { type: Array, default: () => [] },
  taskOnly: Boolean,
  taskOperation: Object
});
const emit = defineEmits(["toast", "changed", "close"]);
const tab = ref("overview");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const modal = ref("");
const modalError = ref("");
const selectedPlanId = ref(null);
const selectedMaterialPlanId = ref(null);
const preparationTasks = ref([]);
const selectedLot = ref(null);
const requisitionApprovalTask = ref(null);
const requisitionReviewing = ref(false);
const requisitionReviewComment = ref("");
const draft = reactive({});

const summary = ref({ totals: {} });
const lots = ref([]);
const overviewLiquids = ref([]);
const overviewRecords = ref({ requisitions: [], orders: [], receipts: [] });
const stockInitialCategory = ref("");
const requisitions = ref([]);
const sourcePlans = ref([]);
const shortageOverviewPlans = ref([]);
const overviewShortagePlans = ref([]);
const orders = ref([]);
const receipts = ref([]);
const inspections = ref([]);
const counts = ref([]);
const materialRequisitions = ref([]);
const factories = ref([]);
const materials = ref([]);
const materialCategories = ref([]);
const suppliers = ref([]);
const locations = ref([]);
const warehouses = ref([]);
const exports = ref([]);
const lotLoading = ref(false);
const shortageLoading = ref(false);
const requisitionLoading = ref(false);
const orderLoading = ref(false);
const selectedShortages = ref([]);
const appliedShortageScope = ref(null);
const appliedShortageCategoryGroup = ref("");
const expandedShortagePlanId = ref(null);
const lotFilters = reactive({
  keyword: "", category: "", supplier_id: "", factory_id: "", location_id: "",
  expiry_status: "", availability: "", issue: ""
});
const countFilters = reactive({ keyword: "", mode: "all" });
const shortageFilters = reactive({
  factory_id: "", category_group: "",
  plan_no: ""
});
const requisitionStateFilter = ref("");
const requisitionSummary = ref({ total: 0, submitted: 0, approved: 0, ordered: 0, history: 0, drafts: 0 });
const orderFilters = reactive({
  supplier_name: "", order_no: "", receipt_state: ""
});

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];
// 生产缺口按计划分页，原料明细在计划内展开。
const shortagePage = ref(1);
const shortagePageSize = ref(10);
// 采购需求：服务端分页
const requisitionPage = ref(1);
const requisitionPageSize = ref(10);
const requisitionTotal = ref(0);
const paginatedRequisitions = ref([]);
// 采购执行：服务端分页
const orderPage = ref(1);
const orderPageSize = ref(10);
const orderTotal = ref(0);
const paginatedOrders = ref([]);
// 质检入库 - 收货单
const receiptLoading = ref(false);
const receiptPage = ref(1);
const receiptPageSize = ref(10);
const receiptTotal = ref(0);
const receiptRecordTotal = ref(0);
const receiptGroups = ref([]);
const selectedReceiptGroup = ref(null);
const paginatedReceiptGroups = computed(() => {
  const start = (receiptPage.value - 1) * receiptPageSize.value;
  return receiptGroups.value.slice(start, start + receiptPageSize.value);
});
const paginatedReceipts = computed(() => paginatedReceiptGroups.value.flatMap((group) => group.receipts));
const receiptFilters = reactive({
  keyword: "", supplier_name: "", factory_id: "", state: "", date_from: "", date_to: ""
});
// 质检入库 - 质检单
const inspectionLoading = ref(false);
const inspectionPage = ref(1);
const inspectionPageSize = ref(10);
const inspectionTotal = ref(0);
const paginatedInspections = ref([]);
const inspectionFilters = reactive({
  keyword: "", supplier_name: "", factory_id: "", state: "pending", date_from: "", date_to: ""
});
// 采购退货
const returnLoading = ref(false);
const returnPage = ref(1);
const returnPageSize = ref(10);
const returnTotal = ref(0);
const paginatedReturns = ref([]);
const returnFilters = reactive({
  keyword: "", supplier_name: "", factory_id: "", material_category: "", state: "", date_from: "", date_to: ""
});
const returnableLines = ref([]);
const returnOrderCandidates = ref([]);
const selectedReturnLines = computed(() => (draft.lines || []).filter((line) =>
  line.selected && Number(line.return_qty) > 0
));
const returnableOrders = computed(() => returnOrderCandidates.value.filter((order) =>
  order.approval_state === "approved"
  && ["purchase", "done"].includes(order.state)
  && ["partial", "received"].includes(order.receipt_state)
));

const isAdmin = computed(() => props.permissions.some((item) => ["admin.user.manage", "base.master_data.manage"].includes(item)));
const canRequestRequisition = computed(() => isAdmin.value || props.permissions.includes("purchase.requisition.manage"));
const canReviewRequisition = computed(() => isAdmin.value || props.permissions.includes("purchase.requisition.approve"));
const canPurchase = computed(() => isAdmin.value || props.permissions.includes("purchase.order.manage"));
const canWarehouse = computed(() => isAdmin.value || props.permissions.includes("inventory.receipt.manage"));
const canCount = computed(() => isAdmin.value || props.permissions.includes("inventory.count.manage"));
const canExport = computed(() => isAdmin.value || props.permissions.some((item) => ["report.purchase.export", "report.all.export"].includes(item)));

const tabs = [
  { id: "overview", label: "总览" },
  { id: "shortages", label: "生产缺口" },
  { id: "requisitions", label: "采购需求" },
  { id: "orders", label: "采购执行" },
  { id: "receiving", label: "质检入库" },
  { id: "returns", label: "采购退货" },
  { id: "material-issue", label: "生产领料" },
  { id: "counts", label: "库存盘点" },
  { id: "settlement", label: "对账导出" }
];
tabs.splice(1, 0, { id: "stock", label: "库存" });
const states = {
  draft: "草稿", submitted: "待审批", approved: "已批准", returned: "已退回",
  ordered: "已转订单", closed: "已关闭", cancelled: "已取消", none: "未提交",
  pending: "待审批", sent: "已发送", purchase: "已下单", done: "已完成",
  pending_approval: "待审批", arrived: "到货待检", inspected: "已质检",
  completed: "已通过", counting: "盘点中", recommended: "已推荐批次",
  issued: "已发料", acknowledged: "已确认实领", qualified: "合格",
  rejected: "不合格", queued: "排队中", running: "生成中", failed: "失败"
};
const stateText = (value) => states[value] || value || "-";
const inspectionStateText = value => ({ draft: "待质检", submitted: "待质检", returned: "待重新质检", completed: "质检完成" })[value] || stateText(value);
const number = (value, digits = 2) => Number(value || 0).toFixed(digits);
const dateTime = (value) => value ? String(value).replace("T", " ").slice(0, 16) : "-";
const quantity = (value) => {
  const amount = Number(value || 0);
  const rounded = Math.round(amount * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3);
};
const requestType = (item) => item.request_type === "emergency" ? "日常采购" : "计划缺料";
const orderType = (item) => item.procurement_type === "emergency" ? "日常采购" : "计划采购";
const remaining = (line) => Math.max(Number(line.approved_qty || 0) - Number(line.ordered_qty || 0), 0);
const today = () => new Date().toISOString().slice(0, 10);
function openDatePicker(event) {
  const input = event.currentTarget;
  if (typeof input?.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    input.focus();
  }
}
const materialCategoryLabels = {
  malt: "麦芽", hop: "酒花", yeast: "酵母", adjunct: "辅料", packaging: "包装物"
};
const countReasonLabels = {
  damage: "破损", expired: "过期报废", measurement: "计量误差",
  missing_transaction: "单据未及时入账",
  unrecorded_issue_return: "领料或退料未登记", other: "其他"
};
const availableReasonLabels = {
  expired: "已过期", pending_quality: "待质检", rejected: "质检不合格",
  frozen: "已冻结", pending_location: "位于待检库位", material_issue: "已领用，暂存在领料库",
  fully_reserved: "已全部预占", no_stock: "无库存"
};
const categoryOptions = computed(() => {
  const values = new Map();
  materials.value.forEach((item) => {
    const code = item.brew_material_category;
    if (code) values.set(code, materialCategoryLabels[code] || code);
  });
  return [...values].map(([value, label]) => ({ value, label }));
});
const shortageRows = computed(() => sourcePlans.value.flatMap((plan) =>
  (plan.materials || []).map((material) => ({ ...material, plan }))
));
const shortageTotal = computed(() => sourcePlans.value.length);
const paginatedShortagePlans = computed(() => {
  const start = (shortagePage.value - 1) * shortagePageSize.value;
  return sourcePlans.value.slice(start, start + shortagePageSize.value);
});
const requestableShortageRows = computed(() => shortageRows.value.filter((item) => Number(item.requestable_qty) > 0));
const selectedShortageRows = computed(() => shortageOverviewPlans.value.flatMap((plan) =>
  (plan.materials || []).filter((item) => Number(item.requestable_qty) > 0 && selectedShortages.value.includes(item.request_key))
    .map((item) => ({ ...item, plan }))
));
const selectedShortagePlanCount = computed(() => new Set(selectedShortageRows.value.map((item) => item.plan.id)).size);
const selectedShortageDemandCount = computed(() => new Set(selectedShortageRows.value.map((item) => item.plan.demand?.id || `plan:${item.plan.id}`)).size);
const draftShortageFactoryGroups = computed(() => {
  const groups = new Map();
  (draft.items || []).forEach((item) => {
    const factory = item.plan.factory;
    if (!groups.has(factory.id)) groups.set(factory.id, { factory, items: [], plans: new Set() });
    const group = groups.get(factory.id);
    group.items.push(item);
    group.plans.add(item.plan.id);
  });
  return [...groups.values()];
});
const shortageCategorySummary = computed(() => {
  const groups = new Map();
  shortageOverviewPlans.value.forEach((plan) => (plan.materials || []).forEach((item) => {
    const key = item.category?.group || "other";
    if (!groups.has(key)) groups.set(key, {
      key, name: item.category?.group_name || "其他原料", items: 0,
      plans: new Set(), demands: new Set(), quantities: new Map()
    });
    const group = groups.get(key);
    group.items += 1;
    group.plans.add(plan.id);
    group.demands.add(plan.demand?.id || `plan:${plan.id}`);
    group.quantities.set(item.uom, (group.quantities.get(item.uom) || 0) + Number(item.shortage || 0));
  }));
  const order = ["malt", "hop", "yeast", "adjunct", "packaging"];
  return [...groups.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
});
function shortageGroupQuantity(group) {
  return [...group.quantities].map(([uom, qty]) => `${number(qty, 3)} ${uom}`).join(" · ");
}
const purchaseOrderTotal = computed(() => (draft.lines || []).reduce((sum, line) =>
  sum + (line.selected === false ? 0 : Number(line.quantity || 0) * Number(line.price_unit || 0)), 0
));
const selectedPurchaseLines = computed(() => (draft.lines || []).filter((line) => line.selected !== false));
const purchaseOrderGroups = computed(() => {
  const groups = new Map();
  selectedPurchaseLines.value.forEach((line) => {
    if (!line.supplier_id) return;
    const key = `${line.supplier_id}:${line.factory?.id || ""}:${line.request_type || ""}`;
    if (!groups.has(key)) groups.set(key, {
      key,
      supplier: suppliers.value.find((item) => String(item.id) === String(line.supplier_id)),
      factory: line.factory,
      count: 0,
      amount: 0
    });
    const group = groups.get(key);
    group.count += 1;
    group.amount += Number(line.quantity || 0) * Number(line.price_unit || 0);
  });
  return [...groups.values()];
});
const emergencyMaterials = computed(() => materials.value.filter(item => item.brew_item_type === "raw_material"));
const requisitionEditMaterials = computed(() => {
  if (draft.requisition?.request_type !== "emergency" || !draft.supplier_id) return materials.value;
  const matched = materials.value.filter(
    (item) => String(item.supplier?.id || item.brew_supplier_id?.id || "") === String(draft.supplier_id)
  );
  const unassigned = materials.value.filter(
    (item) => !(item.supplier?.id || item.brew_supplier_id?.id)
  );
  const selectedIds = new Set((draft.lines || []).map((line) => String(line.material_id || "")));
  const selected = materials.value.filter((item) => selectedIds.has(String(item.id)));
  const available = matched.length ? matched : unassigned;
  return [...new Map([...available, ...selected].map((item) => [String(item.id), item])).values()];
});
const availableOrderEditLines = computed(() => {
  const selected = new Set((draft.lines || []).map((line) => String(line.requisition_line_id || line.requisition_line_ids?.[0] || "")));
  return (draft.order?.editable_requisition_lines || []).filter((line) => !selected.has(String(line.id)));
});
const filterLocations = computed(() => locations.value.filter((item) =>
  item.usage === "internal"
  && (!lotFilters.factory_id || String(item.brew_factory_id?.id || "") === String(lotFilters.factory_id))
));
const visibleLots = computed(() => lots.value.filter((item) => {
  if (lotFilters.issue && item.available_reason !== lotFilters.issue) return false;
  if (lotFilters.availability === "available") return Number(item.available) > 0;
  if (lotFilters.availability === "unavailable") return Number(item.available) <= 0;
  if (lotFilters.availability === "abnormal") {
    return ["expired", "expiring"].includes(item.expiry_status)
      || Boolean(item.available_reason);
  }
  return true;
}));
const countHasDifference = (line) => Math.abs(Number(line.counted_qty || 0) - Number(line.theoretical_qty || 0)) > 0.000001;
const visibleCountLines = computed(() => {
  const keyword = countFilters.keyword.trim().toLowerCase();
  return (draft.lines || []).filter((line) => {
    const text = [line.product?.name, line.lot?.name, line.location?.name].filter(Boolean).join(" ").toLowerCase();
    if (keyword && !text.includes(keyword)) return false;
    if (countFilters.mode === "difference") return countHasDifference(line);
    if (countFilters.mode === "unchanged") return !countHasDifference(line);
    return true;
  });
});
const countDifferenceSummary = computed(() => {
  const lines = draft.lines || [];
  return {
    lines: lines.filter(countHasDifference).length,
    increase: lines.reduce((sum, line) => sum + Math.max(Number(line.counted_qty || 0) - Number(line.theoretical_qty || 0), 0), 0),
    decrease: lines.reduce((sum, line) => sum + Math.max(Number(line.theoretical_qty || 0) - Number(line.counted_qty || 0), 0), 0)
  };
});
const expiryText = (item) => {
  if (item.expiry_status === "expired") return `已过期 ${Math.abs(Number(item.days_to_expiry))} 天`;
  if (item.expiry_status === "expiring") return Number(item.days_to_expiry) === 0 ? "今天到期" : `${item.days_to_expiry} 天后到期`;
  if (item.expiry_status === "normal") return "效期正常";
  return "未设置效期";
};
const availableReasonText = (item) => availableReasonLabels[item.available_reason] || "";
const receiptStateText = (value) => ({
  not_received: "未收货", partial: "部分收货", receiving: "收货处理中", received: "已收货"
})[value] || "未收货";
function receiptGroupProgress(group) {
  if (group.order?.receipt_state) return group.order.receipt_state;
  const confirmed = group.receipts.filter((item) => ["arrived", "inspected", "done"].includes(item.state));
  if (!confirmed.length) return "not_received";
  const orderedByLine = new Map();
  const receivedByLine = new Map();
  group.receipts.forEach((receipt) => (receipt.lines || []).forEach((line) => {
    const lineId = line.order_line_id || line.id;
    orderedByLine.set(lineId, Math.max(orderedByLine.get(lineId) || 0, Number(line.ordered_qty || 0)));
    if (["arrived", "inspected", "done"].includes(receipt.state)) {
      receivedByLine.set(lineId, (receivedByLine.get(lineId) || 0) + Number(line.received_qty || 0));
    }
  }));
  if (!orderedByLine.size) return confirmed.every((item) => item.state === "done") ? "received" : "receiving";
  const hasReceived = [...receivedByLine.values()].some((value) => value > 0);
  const fullyReceived = [...orderedByLine].every(([lineId, ordered]) => (receivedByLine.get(lineId) || 0) + 1e-6 >= ordered);
  if (!hasReceived) return "not_received";
  if (!fullyReceived) return "partial";
  return confirmed.every((item) => item.state === "done") ? "received" : "receiving";
}
function receiptGroupPutawayProgress(group) {
  const records = group.receipts || [];
  if (records.length && records.every(item => item.state === "done")) return { state: "done", label: "已完成入库" };
  if (records.some(item => item.state === "done")) return { state: "partial", label: "部分入库" };
  if (records.some(item => item.state === "inspected")) return { state: "inspected", label: "待完成入库" };
  if (records.some(item => item.state === "arrived")) return { state: "arrived", label: "待质检入库" };
  return { state: "draft", label: "待确认收货" };
}
function receiptGroupCountSummary(group) {
  const receipts = group.order?.receipts || group.receipts;
  const confirmed = receipts.filter((item) => ["arrived", "inspected", "done"].includes(item.state)).length;
  return `已到货 ${confirmed} · 待处理 ${receipts.length - confirmed}`;
}
function receiptGroupQuantitySummary(group) {
  if (group.order?.lines?.length) {
    const quantities = new Map();
    group.order.lines.forEach((line) => {
      const uom = line.uom?.name || "";
      quantities.set(uom, (quantities.get(uom) || 0) + Number(line.received_qty || 0));
    });
    if (!quantities.size || [...quantities.values()].every((value) => value <= 0)) return "尚未确认收货";
    return [...quantities].map(([uom, value]) => `${number(value, 3)}${uom ? ` ${uom}` : ""}`).join(" · ");
  }
  const quantities = new Map();
  group.receipts.filter((item) => ["arrived", "inspected", "done"].includes(item.state)).forEach((receipt) => {
    (receipt.lines || []).forEach((line) => {
      const uom = line.uom?.name || "";
      quantities.set(uom, (quantities.get(uom) || 0) + Number(line.received_qty || 0));
    });
  });
  if (!quantities.size) return "尚未确认收货";
  return [...quantities].map(([uom, value]) => `${number(value, 3)}${uom ? ` ${uom}` : ""}`).join(" · ");
}
function openReceiptGroup(group) {
  selectedReceiptGroup.value = group;
  modalError.value = "";
  modal.value = "receipt-detail";
}
const requestStatusText = (value) => ({ unrequested: "未生成", partial: "部分生成", requested: "已生成" })[value] || "-";
const approvalRoleText = (value) => ({
  general_manager: "总经理", production_director: "生产总监", purchaser: "采购员",
  finance: "财务", tenant_admin: "管理员", requester: "发起人"
})[value] || value || "审批人";
const approvalActorText = (item) => {
  if (!item.actor) return "待处理";
  const role = item.actor.role?.label;
  return role ? item.actor.name + "（" + role + "）" : item.actor.name;
};
const historyStateText = (item) => item.event === "submitted" ? "发起审批" : stateText(item.state);
const countPreviousChange = (line) => line.previous_count
  ? Number(line.counted_qty || 0) - Number(line.previous_count.counted_qty || 0)
  : null;

const overviewActions = computed(() => {
  const actions = [{ key: 'shortages', label: '生产缺料', value: overviewShortagePlans.value.filter(plan => plan.materials?.some(item => Number(item.shortage) > 0)).length, unit: '个计划', hint: '查看缺口，安排采购', target: 'shortages', urgent: true }];
  if (canPurchase.value) actions.push({ key: 'order', label: '待下单需求', value: overviewRecords.value.requisitions.filter(item => item.state === 'approved' && item.lines?.some(line => remaining(line) > 0)).length, unit: '张', hint: '已批准，待生成采购单', target: 'requisitions' });
  else actions.push({ key: 'approval', label: '待审批需求', value: overviewRecords.value.requisitions.filter(item => item.state === 'submitted').length, unit: '张', hint: '查看采购需求进度', target: 'requisitions' });
  actions.push({ key: 'receipt', label: '在途采购', value: overviewRecords.value.orders.filter(item => item.state === 'purchase' && item.receipt_state !== 'received').length, unit: '张', hint: '已下单，尚未全部收货', target: 'orders' });
  actions.push({ key: 'quality', label: '到货待入库', value: overviewRecords.value.receipts.filter(item => ['draft', 'returned', 'submitted', 'arrived'].includes(item.state)).length, unit: '张', hint: '收货、质检与入库', target: 'receiving' });
  return actions;
});
const overviewWork = computed(() => {
  const work = [];
  if (canPurchase.value && canReviewRequisition.value) work.push({ key: 'approval', label: '采购需求待审批', value: overviewRecords.value.requisitions.filter(item => item.state === 'submitted').length, unit: '张', target: 'requisitions' });
  if (canCount.value) work.push({ key: 'counts', label: '进行中的盘点', value: counts.value.filter(item => ['counting', 'pending_approval', 'approved'].includes(item.state)).length, unit: '张', target: 'counts' });
  return work;
});
function navigateOverview(target) {
  if (target === 'raw-stock' || target === 'stock') {
    stockInitialCategory.value = target === 'raw-stock' ? 'semi_finished' : '';
    tab.value = 'stock';
  } else tab.value = target;
}
const inventoryCategories = computed(() => {
  const labels = { malt: '麦芽', adjunct: '可发酵物 / 辅料', hop: '啤酒花', yeast: '酵母', packaging: '包装材料', other: '其他材料' };
  const groups = new Map();
  for (const item of summary.value.categories || []) {
    const definition = materialCategories.value.find(category => category.code === item.category);
    const key = definition?.material_group || item.category;
    if (!groups.has(key)) groups.set(key, { category: key, category_name: labels[key] || item.category_name, available: 0, reserved: 0, product_count: 0, lot_count: 0, uom: item.uom });
    const group = groups.get(key);
    for (const field of ['available', 'reserved', 'product_count', 'lot_count']) group[field] += Number(item[field] || 0);
    if (group.uom !== item.uom) group.uom = '多单位';
  }
  return [...groups.values()];
});
const stockHealth = computed(() => [
  { key: "expired", label: "已过期", value: lots.value.filter((item) => Number(item.on_hand) > 0 && item.expiry_status === "expired").length, hint: "批次不可用", filter: { expiry_status: "expired" } },
  { key: "expiring", label: "30 天内到期", value: lots.value.filter((item) => Number(item.on_hand) > 0 && item.expiry_status === "expiring").length, hint: "优先使用", filter: { expiry_status: "expiring" } },
  { key: "pending_quality", label: "待质检", value: lots.value.filter((item) => Number(item.on_hand) > 0 && item.available_reason === "pending_quality").length, hint: "质检合格后可用", filter: { issue: "pending_quality" } },
  { key: "frozen", label: "已冻结", value: lots.value.filter((item) => Number(item.on_hand) > 0 && item.available_reason === "frozen").length, hint: "解冻后可用", filter: { issue: "frozen" } },
  { key: "fully_reserved", label: "全部预占", value: lots.value.filter((item) => Number(item.on_hand) > 0 && item.available_reason === "fully_reserved").length, hint: "生产领料已占用", filter: { issue: "fully_reserved" } }
]);
function showCategoryInventory(category) {
  stockInitialCategory.value = category.category || '';
  tab.value = 'stock';
}
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
const settlementStateText = (item) => {
  if (item.state === "done") return "可对账";
  if (["draft", "sent"].includes(item.state)) {
    if (item.approval_state === "pending") return "审批中";
    if (item.approval_state === "approved") return "待下单";
    if (item.approval_state === "returned") return "已退回";
    return "待提交";
  }
  if (item.state === "purchase") return "已下单/待关闭";
  if (item.state === "cancel") return "已取消";
  return stateText(item.state);
};

async function loadAllMaster(resource) {
  const records = [];
  for (let page = 1; ; page += 1) {
    const batch = await brewApi.listMaster(resource, { page, page_size: 100, active: true });
    records.push(...batch);
    if (batch.length < 100) return records;
  }
}
async function loadAllIssueRows(fetchPage) {
  const rows = [];
  for (let page = 1; ; page++) {
    const batch = await fetchPage(page);
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
}
async function load() {
  loading.value = true;
  error.value = "";
  const jobs = [
    [summary, brewApi.getInventorySummary()],
    [lots, loadAllIssueRows(page => brewApi.listInventoryLots({ page, page_size: 100 }))],
    [overviewLiquids, loadAllIssueRows(page => brewApi.browseStock({ category: "semi_finished", page, page_size: 100 }).then(r => r.items))],
    [requisitions, loadAllIssueRows(page => brewApi.listPurchaseRequisitions({ page, page_size: 100 }).then((r) => { requisitionTotal.value = r.meta?.total || r.data.length; return r.data; }))],
    [orders, loadAllIssueRows(page => brewApi.listPurchaseOrders({ page, page_size: 100 }).then((r) => { orderTotal.value = r.meta?.total || r.data.length; return r.data; }))],
    [receipts, loadAllIssueRows(page => brewApi.listReceipts({ page, page_size: 100 }).then((r) => { receiptTotal.value = r.meta?.total || r.data.length; return r.data; }))],
    [inspections, loadAllIssueRows(page => brewApi.listQualityInspections({ page, page_size: 100 }).then(r => r.data))],
    [counts, loadAllIssueRows(page => brewApi.listInventoryCounts({ page, page_size: 100 }))],
    [preparationTasks, loadAllIssueRows(page => brewApi.getTasks({ page, task_type: "material_preparation", active_only: true }))],
    [factories, brewApi.listMaster("factories", { page_size: 100, active: true })],
    [materials, loadAllMaster("materials")],
    [materialCategories, loadAllMaster("material-categories")],
    [suppliers, brewApi.listMaster("suppliers", { page_size: 100, active: true })],
    [locations, loadAllMaster("locations")],
    [warehouses, loadAllMaster("warehouses")]
  ];
  if (canWarehouse.value) {
    jobs.push([materialRequisitions, loadAllIssueRows(page => brewApi.listMaterialRequisitions({ page, page_size: 100 }))]);
  } else {
    materialRequisitions.value = [];
  }
  jobs.push([sourcePlans, brewApi.listPurchaseSourcePlans()]);
  if (canExport.value) jobs.push([exports, brewApi.listExports({ page_size: 30 })]);
  const results = await Promise.allSettled(jobs.map((item) => item[1]));
  const failures = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") jobs[index][0].value = result.value;
    else failures.push(result.reason?.message || "部分数据加载失败");
  });
  shortageOverviewPlans.value = sourcePlans.value;
  overviewShortagePlans.value = sourcePlans.value;
  overviewRecords.value = { requisitions: requisitions.value, orders: orders.value, receipts: receipts.value };
  if (failures.length) error.value = [...new Set(failures)].join("；");
  loading.value = false;
  await loadRequisitionSummary();
}
async function loadRequisitionSummary() {
  const groups = [
    ["total", ""], ["submitted", "submitted"], ["approved", "approved"],
    ["ordered", "ordered"], ["history", "closed,cancelled"], ["drafts", "draft,returned"]
  ];
  const results = await Promise.allSettled(groups.map(([, state]) =>
    brewApi.listPurchaseRequisitions({ page: 1, page_size: 1, ...(state ? { state } : {}) })
  ));
  const next = { ...requisitionSummary.value };
  results.forEach((result, index) => {
    if (result.status === "fulfilled") next[groups[index][0]] = result.value.meta?.total || 0;
  });
  requisitionSummary.value = next;
}
async function loadSourcePlans(resetPage = true) {
  shortageLoading.value = true;
  error.value = "";
  try {
    const params = {};
    Object.entries(shortageFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    const overviewParams = {};
    if (shortageFilters.factory_id) overviewParams.factory_id = shortageFilters.factory_id;
    if (shortageFilters.plan_no) overviewParams.plan_no = shortageFilters.plan_no;
    const scope = JSON.stringify(overviewParams);
    const filteredRequest = brewApi.listPurchaseSourcePlans(params);
    const overviewRequest = shortageFilters.category_group
      ? brewApi.listPurchaseSourcePlans(overviewParams) : filteredRequest;
    [sourcePlans.value, shortageOverviewPlans.value] = await Promise.all([filteredRequest, overviewRequest]);
    appliedShortageCategoryGroup.value = shortageFilters.category_group;
    const availableKeys = new Set(shortageOverviewPlans.value.flatMap((plan) =>
      (plan.materials || []).filter((item) => Number(item.requestable_qty) > 0).map((item) => item.request_key)
    ));
    selectedShortages.value = scope === appliedShortageScope.value
      ? selectedShortages.value.filter((key) => availableKeys.has(key)) : [];
    appliedShortageScope.value = scope;
    expandedShortagePlanId.value = null;
    if (resetPage) shortagePage.value = 1;
  } catch (cause) {
    error.value = cause.message || "生产缺口加载失败";
  } finally {
    shortageLoading.value = false;
  }
}
async function selectShortageCategory(group) {
  shortageFilters.category_group = appliedShortageCategoryGroup.value === group ? "" : group;
  await loadSourcePlans();
}
function planRequestableRows(plan) {
  return (plan.materials || []).filter((item) => Number(item.requestable_qty) > 0);
}
function togglePlanShortages(plan) {
  const keys = planRequestableRows(plan).map((item) => item.request_key);
  const selected = new Set(selectedShortages.value);
  if (keys.every((key) => selected.has(key))) keys.forEach((key) => selected.delete(key));
  else keys.forEach((key) => selected.add(key));
  selectedShortages.value = [...selected];
}
function isPlanFullySelected(plan) {
  const rows = planRequestableRows(plan);
  return rows.length > 0 && rows.every((item) => selectedShortages.value.includes(item.request_key));
}
function selectAllShortages() {
  const keys = requestableShortageRows.value.map((item) => item.request_key);
  const selected = new Set(selectedShortages.value);
  keys.forEach((key) => selected.add(key));
  selectedShortages.value = [...selected];
}
async function loadRequisitions(page, pageSize) {
  const p = page || requisitionPage.value;
  const s = pageSize || requisitionPageSize.value;
  requisitionLoading.value = true;
  error.value = "";
  try {
    const params = { page: p, page_size: s };
    if (requisitionStateFilter.value) params.state = requisitionStateFilter.value;
    const result = await brewApi.listPurchaseRequisitions(params);
    requisitions.value = result.data;
    paginatedRequisitions.value = result.data;
    requisitionTotal.value = result.meta?.total || result.data.length;
  } catch (cause) {
    error.value = cause.message || "采购需求加载失败";
  } finally {
    requisitionLoading.value = false;
  }
}
function showRequisitionGroup(state) {
  requisitionStateFilter.value = requisitionStateFilter.value === state ? "" : state;
  requisitionPage.value = 1;
  loadRequisitions();
}
async function loadOrders(page, pageSize) {
  const p = page || orderPage.value;
  const s = pageSize || orderPageSize.value;
  orderLoading.value = true;
  error.value = "";
  try {
    const params = { page: p, page_size: s };
    Object.entries(orderFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    const result = await brewApi.listPurchaseOrders(params);
    orders.value = result.data;
    paginatedOrders.value = result.data;
    orderTotal.value = result.meta?.total || result.data.length;
  } catch (cause) {
    error.value = cause.message || "采购单加载失败";
  } finally {
    orderLoading.value = false;
  }
}
function resetOrderFilters() {
  Object.keys(orderFilters).forEach((key) => { orderFilters[key] = ""; });
  orderPage.value = 1;
  loadOrders();
}

// 分页控制
function changeShortagePageSize(size) {
  shortagePageSize.value = Number(size);
  shortagePage.value = 1;
}
function changeRequisitionPageSize(size) {
  requisitionPageSize.value = Number(size);
  requisitionPage.value = 1;
  loadRequisitions();
}
function changeOrderPageSize(size) {
  orderPageSize.value = Number(size);
  orderPage.value = 1;
  loadOrders();
}
async function loadReceipts(page, pageSize) {
  if (page) receiptPage.value = page;
  if (pageSize) receiptPageSize.value = pageSize;
  receiptLoading.value = true;
  error.value = "";
  try {
    const params = { page: 1, page_size: 100 };
    Object.entries(receiptFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    const first = await brewApi.listReceipts(params);
    const total = Number(first.meta?.total ?? first.data.length);
    const all = [...first.data];
    for (let currentPage = 2; all.length < total; currentPage += 1) {
      const result = await brewApi.listReceipts({ ...params, page: currentPage });
      if (!result.data.length) break;
      all.push(...result.data);
    }
    receipts.value = all;
    receiptRecordTotal.value = all.length;
    const knownOrders = new Map((orders.value || []).map((order) => [String(order.id), order]));
    const grouped = new Map();
    all.forEach((item) => {
      const orderId = item.purchase_order?.id;
      const key = orderId ? `order:${orderId}` : `receipt:${item.id}`;
      if (!grouped.has(key)) grouped.set(key, { key, order: knownOrders.get(String(orderId)) || item.purchase_order || null, supplier: item.supplier, factory: item.factory, receipts: [] });
      grouped.get(key).receipts.push(item);
    });
    receiptGroups.value = [...grouped.values()].map((group) => {
      group.receipts.sort((a, b) => new Date(b.create_date || 0) - new Date(a.create_date || 0));
      group.latestReceipt = group.receipts[0];
      return group;
    }).sort((a, b) => new Date(b.latestReceipt?.create_date || 0) - new Date(a.latestReceipt?.create_date || 0));
    receiptTotal.value = receiptGroups.value.length;
    if (receiptPage.value > Math.max(1, Math.ceil(receiptTotal.value / receiptPageSize.value))) receiptPage.value = 1;
    if (selectedReceiptGroup.value) {
      selectedReceiptGroup.value = receiptGroups.value.find((group) => group.key === selectedReceiptGroup.value.key) || null;
      if (!selectedReceiptGroup.value && modal.value === "receipt-detail") modal.value = "";
    }
    const ordersNeedingProgress = paginatedReceiptGroups.value.filter((group) => group.order && !group.order.receipt_state);
    await Promise.allSettled(ordersNeedingProgress.map(async (group) => {
      group.order = await brewApi.getPurchaseOrder(group.order.id);
    }));
  } catch (cause) {
    error.value = cause.message || "收货单加载失败";
  } finally {
    receiptLoading.value = false;
  }
}
function resetReceiptFilters() {
  Object.keys(receiptFilters).forEach((key) => { receiptFilters[key] = ""; });
  receiptPage.value = 1;
  loadReceipts();
}
function changeReceiptPageSize(size) {
  receiptPageSize.value = Number(size);
  receiptPage.value = 1;
  loadReceipts();
}
async function loadInspections(page, pageSize) {
  const p = page || inspectionPage.value;
  const s = pageSize || inspectionPageSize.value;
  inspectionLoading.value = true;
  error.value = "";
  try {
    const params = { page: p, page_size: s };
    Object.entries(inspectionFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    const result = await brewApi.listQualityInspections(params);
    paginatedInspections.value = result.data;
    inspectionTotal.value = result.meta?.total || result.data.length;
  } catch (cause) {
    error.value = cause.message || "质检单加载失败";
  } finally {
    inspectionLoading.value = false;
  }
}
function inspectionQuantityText(inspection, field) {
  const totals = new Map();
  for (const line of inspection.lines || []) {
    const unit = line.uom?.name || "";
    totals.set(unit, (totals.get(unit) || 0) + Number(line[field] || 0));
  }
  return [...totals].map(([unit, qty]) => `${number(qty, 3)} ${unit}`).join(" / ") || "-";
}
function resetInspectionFilters() {
  Object.keys(inspectionFilters).filter(key => key !== "state").forEach((key) => { inspectionFilters[key] = ""; });
  inspectionPage.value = 1;
  loadInspections();
}
function changeInspectionPageSize(size) {
  inspectionPageSize.value = Number(size);
  inspectionPage.value = 1;
  loadInspections();
}
async function loadReturns(page, pageSize) {
  const p = page || returnPage.value;
  const s = pageSize || returnPageSize.value;
  returnLoading.value = true;
  error.value = "";
  try {
    const params = { page: p, page_size: s };
    Object.entries(returnFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    const result = await brewApi.listPurchaseReturns(params);
    paginatedReturns.value = result.data;
    returnTotal.value = result.meta?.total || result.data.length;
  } catch (cause) {
    error.value = cause.message || "退货单加载失败";
  } finally {
    returnLoading.value = false;
  }
}
function resetReturnFilters() {
  Object.keys(returnFilters).forEach((key) => { returnFilters[key] = ""; });
  returnPage.value = 1;
  loadReturns();
}
function changeReturnPageSize(size) {
  returnPageSize.value = Number(size);
  returnPage.value = 1;
  loadReturns();
}
async function loadLots() {
  lotLoading.value = true;
  error.value = "";
  try {
    const params = { page_size: 100 };
    ["keyword", "category", "supplier_id", "factory_id", "location_id", "expiry_status"].forEach((key) => {
      if (lotFilters[key]) params[key] = lotFilters[key];
    });
    lots.value = await brewApi.listInventoryLots(params);
  } catch (cause) {
    error.value = cause.message || "库存批次加载失败";
  } finally {
    lotLoading.value = false;
  }
}
function resetLotFilters() {
  Object.assign(lotFilters, {
    keyword: "", category: "", supplier_id: "", factory_id: "", location_id: "",
    expiry_status: "", availability: "", issue: ""
  });
  loadLots();
}

function resetDraft(values) {
  Object.keys(draft).forEach((key) => delete draft[key]);
  Object.assign(draft, values);
  modalError.value = "";
}
function openEmergency() {
  resetDraft({ supplier_id: "", factory_id: "", need_date: today(), emergency_reason: "", reason: "", lines: [{ material_id: "", quantity: "" }] });
  modal.value = "emergency";
}
function openPlan() {
  if (!selectedShortageRows.value.length) {
    error.value = "请先勾选需要生成采购需求的生产缺口";
    return;
  }
  resetDraft({
    items: selectedShortageRows.value.map((item) => ({
      ...item, requested_qty: Number(item.requestable_qty)
    })),
    need_date: today(), reason: "生产计划缺料汇总"
  });
  modal.value = "plan";
}
function materialForProduct(productId) {
  return materials.value.find((item) => String(item.product_variant_id) === String(productId));
}
function suggestedPackageCount(quantity, material, uomName) {
  const spec = String(material?.brew_specification || "");
  const match = spec.match(/([\d.]+)\s*(kg|g)\s*\//i);
  const uom = String(uomName || "").toLowerCase();
  if (match && ["kg", "公斤", "千克", "g", "克"].some((unit) => uom.includes(unit))) {
    let size = Number(match[1]);
    if (match[2].toLowerCase() === "g" && !uom.includes("g") && !uom.includes("克")) size /= 1000;
    if (match[2].toLowerCase() === "kg" && (uom === "g" || uom.includes("克"))) size *= 1000;
    if (size > 0) return Math.ceil(Number(quantity || 0) / size);
  }
  return Math.max(Math.ceil(Number(quantity || 0)), 1);
}
function openOrder(requisition = null) {
  const candidates = requisitions.value
    .filter((item) => item.state === "approved" && (!requisition || String(item.id) === String(requisition.id)))
    .flatMap((item) => item.lines.filter((line) => remaining(line) > 0).map((line) => {
      const material = materialForProduct(line.product?.id);
      return {
        ...line,
        requisition_id: item.id,
        requisition_name: item.name,
        request_type: item.request_type,
        factory: item.factory,
        material,
        quantity: remaining(line),
        selected: !requisition || String(item.id) === String(requisition.id),
        supplier_id: item.preferred_supplier?.id || material?.supplier?.id || "",
        package_spec: material?.brew_specification || "未设置包装规格",
        package_count: suggestedPackageCount(remaining(line), material, line.uom?.name),
        price_unit: Number(material?.brew_supplier_price || material?.standard_price || 0)
      };
    }));
  resetDraft({
    order_date: today(),
    expected_arrival_date: requisition?.need_date || today(),
    lines: candidates
  });
  modal.value = "order";
  if (!draft.lines.length) {
    modalError.value = "当前没有可下单的已审批采购需求";
  }
}
function removeOrderLine(lineId) {
  draft.lines = (draft.lines || []).filter((line) => line.id !== lineId);
}
async function openOrderDetail(order) {
  try {
    resetDraft({ order: await brewApi.getPurchaseOrder(order.id) });
    modal.value = "order-detail";
  } catch (cause) {
    error.value = cause.message || "采购单详情加载失败";
  }
}
async function openOrderEdit(order) {
  try {
    const current = await brewApi.getPurchaseOrder(order.id);
    resetDraft({
      order: current,
      supplier_id: current.supplier?.id || "",
      order_date: String(current.order_date || "").slice(0, 10),
      expected_arrival_date: current.expected_arrival_date || "",
      resubmit: current.approval_state === "returned",
      resubmit_note: "",
      order_edit_picker_open: false,
      lines: current.lines.map((line) => ({
        ...line,
        requisition_line_id: line.requisition_line_ids?.[0] || "",
        quantity: Number(line.quantity || 0),
        package_count: Number(line.package_count || 0),
        price_unit: Number(line.price_unit || 0)
      }))
    });
    modal.value = "order-edit";
  } catch (cause) {
    error.value = cause.message || "采购单加载失败";
  }
}
function addOrderEditLine(candidateId) {
  const candidate = availableOrderEditLines.value.find((item) => String(item.id) === String(candidateId));
  if (!candidate) return;
  draft.lines.push({
    key: `new-${candidate.id}`,
    requisition_line_id: candidate.id,
    product: candidate.product,
    uom: candidate.uom,
    quantity: Number(candidate.available_qty || 0),
    package_spec: candidate.package_spec || candidate.product?.specification || "",
    package_count: suggestedPackageCount(candidate.available_qty, { brew_specification: candidate.package_spec }, candidate.uom?.name),
    price_unit: Number(candidate.price_unit || 0),
    planned_date: draft.expected_arrival_date
  });
  if (!availableOrderEditLines.value.length) draft.order_edit_picker_open = false;
}
function removeOrderEditLine(index) {
  draft.lines.splice(index, 1);
}
async function openRequisitionDetail(requisition) {
  try {
    const current = await brewApi.getPurchaseRequisition(requisition.id);
    resetDraft({ requisition: current });
    requisitionApprovalTask.value = null;
    requisitionReviewing.value = false;
    requisitionReviewComment.value = "";
    modalError.value = "";
    if (canReviewRequisition.value && current.state === "submitted") {
      try {
        const approvals = await brewApi.listApprovals({ state: "pending" });
        requisitionApprovalTask.value = approvals.find((item) =>
          item.target_model === "brew.purchase.requisition"
          && String(item.target_id) === String(current.id)
          && item.state === "pending"
          && item.is_current
        ) || null;
      } catch {
        requisitionApprovalTask.value = null;
      }
    }
    modal.value = "requisition-detail";
  } catch (cause) {
    error.value = cause.message || "采购需求详情加载失败";
  }
}
async function resolveRequisitionApproval(action) {
  const task = requisitionApprovalTask.value;
  if (!task) return;
  const comment = requisitionReviewComment.value.trim();
  if (action === "return" && !comment) {
    modalError.value = "退回时请填写原因";
    return;
  }
  saving.value = true;
  modalError.value = "";
  try {
    await brewApi.approvalAction(task.id, action, { version: task.version, comment });
    const updated = await brewApi.getPurchaseRequisition(draft.requisition.id);
    draft.requisition = updated;
    const approvals = updated.state === "submitted"
      ? await brewApi.listApprovals({ state: "pending" })
      : [];
    requisitionApprovalTask.value = approvals.find((item) =>
      item.target_model === "brew.purchase.requisition"
      && String(item.target_id) === String(updated.id)
      && item.state === "pending"
      && item.is_current
    ) || null;
    requisitionReviewing.value = false;
    requisitionReviewComment.value = "";
    emit("toast", action === "approve" ? "采购需求审批已通过" : "采购需求已退回");
    await loadRequisitionSummary();
    await loadRequisitions();
  } catch (cause) {
    modalError.value = cause.message || "采购需求审批处理失败";
  } finally {
    saving.value = false;
  }
}
async function openRequisitionEdit(requisition) {
  try {
    const current = await brewApi.getPurchaseRequisition(requisition.id);
    resetDraft({
      requisition: current,
      factory_id: current.factory?.id || "",
      supplier_id: current.preferred_supplier?.id || "",
      need_date: current.need_date || "",
      reason: current.reason || "",
      emergency_reason: current.emergency_reason || "",
      lines: current.lines.map((line) => ({
        id: line.id,
        material_id: materialForProduct(line.product?.id)?.id || "",
        quantity: Number(line.requested_qty || 0)
      }))
    });
    modal.value = "requisition-edit";
  } catch (cause) {
    error.value = cause.message || "采购需求加载失败";
  }
}
function addRequisitionEditLine() {
  draft.lines.push({ id: null, material_id: "", quantity: "" });
}
function removeRequisitionEditLine(index) {
  draft.lines.splice(index, 1);
}
const receiptOpening = ref(false);
async function refreshReceiptLocations() {
  const [freshLocations, freshWarehouses] = await Promise.all([loadAllMaster("locations"), loadAllMaster("warehouses")]);
  locations.value = freshLocations;
  warehouses.value = freshWarehouses;
}
async function openReceipt(item) {
  if (receiptOpening.value) return;
  receiptOpening.value = true;
  error.value = "";
  try {
    const [order] = await Promise.all([brewApi.getPurchaseOrder(item.id), refreshReceiptLocations()]);
    if (!order.factory?.id) throw new Error("采购单未设置收货厂区，请先完善采购单信息");
  const scoped = locations.value.filter((item) => String(item.brew_factory_id?.id || "") === String(order.factory?.id || ""));
  const firstLine = order.lines?.find((line) => Number(line.remaining_receipt_qty || 0) > 0);
  const defaultDestination = firstLine ? receiptDefaultLocation(firstLine, order.factory?.id) : null;
  resetDraft({
    order, qc_location_id: scoped.find((item) => item.brew_location_type === "qc")?.id || "",
    destination_location_id: defaultDestination?.id || scoped.find((item) => !["qc", "material_issue"].includes(item.brew_location_type) && item.usage === "internal")?.id || "",
    lines: order.lines
      .filter((line) => Number(line.remaining_receipt_qty || 0) > 0)
      .map((line) => ({
        ...line,
        destination_location_id: receiptDefaultLocation(line, order.factory?.id)?.id || defaultDestination?.id || "",
        prior_received_qty: Number(line.received_qty || 0),
        received_qty: Number(line.remaining_receipt_qty || 0),
        internal_batch: "提交后系统生成",
        supplier_lot: "",
        expiration_date: ""
      }))
  });
  modal.value = "receipt";
  } catch (cause) {
    error.value = cause.message || "收货库位加载失败，请重试";
    emit("toast", error.value);
  } finally {
    receiptOpening.value = false;
  }
}
function receiptDefaultLocation(line, factoryId) {
  const material = materials.value.find((item) => String(item.product_variant_id) === String(line.product?.id));
  const type = material?.brew_item_type === "packaging_material" ? "packaging" : "raw_material";
  const scopedWarehouses = warehouses.value.filter(item => String(item.brew_factory_id?.id || "") === String(factoryId || "") && item.brew_warehouse_type === type);
  const eligible = locations.value.filter(item => String(item.brew_factory_id?.id || "") === String(factoryId || "") && item.usage === "internal" && !["qc", "material_issue"].includes(item.brew_location_type));
  const candidates = groupWarehouseLocations(eligible, scopedWarehouses).flatMap(group => group.locations);
  return candidates.length === 1 ? candidates[0] : null;
}
function applyDefaultReceiptLocation() {
  if (!draft.destination_location_id) return;
  draft.lines.forEach((line) => { line.destination_location_id = draft.destination_location_id; });
}
const qualitySummary = computed(() => {
  if (modal.value !== "quality") return { qualified: "", rejected: "", hasRejected: false };
  const units = new Map();
  for (const line of draft.lines || []) {
    const key = String(line.uom?.id || line.uom?.name || "");
    const entry = units.get(key) || { unit: line.uom?.name || "", qualified: 0, rejected: 0 };
    for (const field of ["qualified", "rejected"]) {
      const qty = Number(line[field + "_qty"] || 0);
      entry[field] += Number.isFinite(qty) ? qty : 0;
    }
    units.set(key, entry);
  }
  const summary = field => [...units.values()].map(item => number(item[field], 3) + " " + item.unit).join(" / ");
  return { qualified: summary("qualified"), rejected: summary("rejected"), hasRejected: [...units.values()].some(item => item.rejected > 0) };
});
function syncQualityQuantity(line, field, value) {
  if (value === "") {
    line[field] = "";
    return;
  }
  const total = Number(line.inspected_qty);
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || !Number.isFinite(total)) return;
  line[field] = Math.min(Math.max(quantity, 0), total);
  const otherField = field === "qualified_qty" ? "rejected_qty" : "qualified_qty";
  line[otherField] = Number((total - line[field]).toFixed(6));
  if (Number(line.rejected_qty) === 0) line.disposition = "";
}
function markQualityAllQualified() {
  for (const line of draft.lines || []) {
    line.qualified_qty = line.inspected_qty;
    line.rejected_qty = 0;
    line.disposition = "";
  }
}
function openQuality(inspection) {
  resetDraft({
    inspection,
    note: inspection.note || "",
    submission_comment: "",
    lines: inspection.lines.map((line) => ({
      ...line,
      qualified_qty: inspection.state === "draft" ? line.inspected_qty : line.qualified_qty,
      rejected_qty: inspection.state === "draft" ? 0 : line.rejected_qty,
      disposition: inspection.state === "draft" ? "" : (line.disposition || ""),
      note: line.note || ""
    }))
  });
  modal.value = "quality";
}
async function openReceiptDetail(receipt) {
  try {
    selectedReceiptGroup.value = null;
    modal.value = "";
    resetDraft({ receipt: await brewApi.getReceipt(receipt.id) });
    modal.value = "receipt-detail";
  } catch (cause) {
    emit("toast", cause.message || "收货单详情加载失败");
  }
}
async function openLotDetail(lotId) {
  try {
    selectedLot.value = await brewApi.getInventoryLot(lotId);
  } catch (cause) {
    emit("toast", cause.message || "库存批次加载失败");
  }
}
async function openMovementSource(source) {
  if (!source?.id) return;
  if (source.model === "brew.receipt") await openReceiptDetail(source);
  else if (source.model === "brew.purchase.return") await openReturnDetail(source);
  else if (source.model === "brew.production.plan") selectedPlanId.value = source.id;
  else return;
  selectedLot.value = null;
}
async function openReceiptEdit(receipt) {
  try {
    const current = await brewApi.getReceipt(receipt.id);
    const [order] = await Promise.all([brewApi.getPurchaseOrder(current.purchase_order.id), refreshReceiptLocations()]);
    resetDraft({
      receipt: current,
      order,
      qc_location_id: current.qc_location?.id || "",
      destination_location_id: current.destination_location?.id || "",
      note: current.note || "",
      lines: current.lines.map((line) => ({
        id: line.id,
        order_line_id: line.order_line_id,
        destination_location_id: line.destination_location?.id || current.destination_location?.id || "",
        received_qty: Number(line.received_qty || 0),
        supplier_lot: line.supplier_lot || "",
        expiration_date: line.expiration_date || "",
        lot_name: line.lot_name || ""
      }))
    });
    modal.value = "receipt-edit";
  } catch (cause) {
    error.value = cause.message || "收货单加载失败";
  }
}
function receiptOrderLine(orderLineId) {
  return draft.order?.lines?.find((line) => String(line.id) === String(orderLineId));
}
function addReceiptEditLine() {
  const used = new Set((draft.lines || []).map((line) => String(line.order_line_id)));
  const candidate = draft.order?.lines?.find((line) => !used.has(String(line.id)));
  if (!candidate) {
    modalError.value = "该采购订单没有其它可添加的明细";
    return;
  }
  draft.lines.push({
    id: null,
    order_line_id: candidate.id,
    destination_location_id: draft.destination_location_id || receiptDefaultLocation(candidate, draft.order?.factory?.id)?.id || "",
    received_qty: Number(candidate.remaining_receipt_qty || candidate.quantity || 0),
    supplier_lot: "",
    expiration_date: "",
    lot_name: "保存后系统生成"
  });
}
function removeReceiptEditLine(index) {
  draft.lines.splice(index, 1);
}
async function openInspectionDetail(inspection) {
  try {
    resetDraft({ inspectionDetail: await brewApi.getQualityInspection(inspection.id) });
    modal.value = "inspection-detail";
  } catch (cause) {
    emit("toast", cause.message || "质检单详情加载失败");
  }
}
async function openReturnDetail(ret) {
  try {
    resetDraft({ returnRecord: await brewApi.getPurchaseReturn(ret.id) });
    modal.value = "return-detail";
  } catch (cause) {
    emit("toast", cause.message || "退货单详情加载失败");
  }
}
async function openReturnCreate() {
  returnableLines.value = [];
  try {
    const result = await brewApi.listPurchaseOrders({ page_size: 100 });
    const stateCandidates = (result.data || []).filter((order) =>
      order.approval_state === "approved"
      && ["purchase", "done"].includes(order.state)
      && ["partial", "received"].includes(order.receipt_state)
    );
    const candidatesWithLines = await Promise.all(stateCandidates.map(async (order) => {
      try {
        const lines = await brewApi.getReturnableLines(order.id);
        return { ...order, _returnable_lines: lines || [] };
      } catch (_) {
        return { ...order, _returnable_lines: [] };
      }
    }));
    returnOrderCandidates.value = candidatesWithLines.filter((order) => order._returnable_lines.length);
  } catch (cause) {
    error.value = cause.message || "可退采购订单加载失败";
    return;
  }
  resetDraft({
    purchase_order_id: "",
    factory_id: "",
    note: "",
    return_reason: "",
    logistics_no: "",
    lines: []
  });
  modal.value = "return-edit";
}
async function openReturnEdit(ret) {
  try {
    const current = await brewApi.getPurchaseReturn(ret.id);
    returnableLines.value = [];
    if (current.purchase_order?.id) {
      try {
        const lines = await brewApi.getReturnableLines(current.purchase_order.id);
        returnableLines.value = lines || [];
      } catch (_) {}
    }
    resetDraft({
      returnRecord: current,
      purchase_order_id: current.purchase_order?.id || "",
      factory_id: current.factory?.id || "",
      note: current.note || "",
      return_reason: current.return_reason || "",
      logistics_no: current.logistics_no || "",
      lines: current.lines.map((line) => {
        const rl = returnableLines.value.find(r => String(r.purchase_order_line_id) === String(line.purchase_order_line_id) && String(r.lot?.id || '') === String(line.lot?.id || ''));
        return {
          id: line.id,
          product_id: line.product?.id || "",
          product_name: line.product?.name || "",
          product_brand: line.product?.brand || "",
          return_qty: line.return_qty,
          price_unit: line.price_unit,
          uom_id: line.uom?.id || "",
          uom_name: line.uom?.name || "",
          lot_id: line.lot?.id || "",
          lot_name: line.lot?.name || "",
          purchase_order_line_id: line.purchase_order_line_id || "",
          logistics_no: line.logistics_no || "",
          note: line.note || "",
          selected: true,
          _returnable_qty: rl ? rl.returnable_qty + line.return_qty : 0,
          _stock_available_qty: rl ? rl.stock_available_qty : 0,
          _received_qty: rl ? rl.received_qty : 0,
          _returned_qty: rl ? rl.returned_qty : 0,
          _receipt_name: rl ? rl.receipt_name || "" : "",
        };
      })
    });
    modal.value = "return-edit";
  } catch (cause) {
    error.value = cause.message || "退货单加载失败";
  }
}
function addReturnLine() {
  draft.lines.push({ product_id: "", return_qty: "", price_unit: 0, uom_id: "", lot_id: "", purchase_order_line_id: "", logistics_no: "", note: "" });
}
function removeReturnLine(index) {
  draft.lines.splice(index, 1);
}
async function onReturnOrderChange() {
  returnableLines.value = [];
  draft.lines = [];
  const order = returnOrderCandidates.value.find((o) => String(o.id) === String(draft.purchase_order_id));
  if (order) {
    if (!draft.factory_id && order.factory?.id) draft.factory_id = order.factory.id;
    try {
      const lines = order._returnable_lines || await brewApi.getReturnableLines(order.id);
      returnableLines.value = lines || [];
      if (returnableLines.value.length) {
        draft.lines = returnableLines.value.map(rl => ({
          product_id: rl.product?.id || "",
          product_name: rl.product?.name || "",
          product_brand: rl.product?.brand || "",
          return_qty: "",
          price_unit: rl.price_unit || 0,
          uom_id: rl.uom?.id || "",
          uom_name: rl.uom?.name || "",
          lot_id: rl.lot?.id || "",
          lot_name: rl.lot?.name || "",
          purchase_order_line_id: rl.purchase_order_line_id || "",
          logistics_no: "",
          note: "",
          selected: false,
          _returnable_qty: rl.returnable_qty || 0,
          _stock_available_qty: rl.stock_available_qty || 0,
          _received_qty: rl.received_qty || 0,
          _returned_qty: rl.returned_qty || 0,
          _receipt_name: rl.receipt_name || "",
        }));
      }
    } catch (cause) {
      modalError.value = cause.message || "可退明细加载失败，请重新选择采购订单";
    }
  }
}
function returnAction(item, action) {
  const reason = action === "return" ? window.prompt("请填写退回原因", "") : "";
  if (action === "return" && reason === null) return;
  runAction(() => brewApi.purchaseReturnAction(item.id, action, { version: item.version, reason }), action === "execute" ? "退货已执行" : "退货单已更新");
}
function generateCSV(type, data, filename) {
  const headers = data.length ? Object.keys(data[0]) : [];
  const csv = [headers.join(","), ...data.map((row) => headers.map((h) => {
    const val = row[h];
    if (val == null) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function exportReceipts() {
  const rows = receipts.value.map((item, i) => ({
    "序号": i + 1,
    "收货单号": item.name,
    "采购订单": item.purchase_order?.name || "",
    "供应商": item.supplier?.name || "",
    "仓库": item.factory?.name || "",
    "状态": stateText(item.state),
    "收货时间": item.create_date || "",
    "制单人": item.creator || ""
  }));
  generateCSV("receipt", rows, `收货单_${new Date().toISOString().slice(0, 10)}.csv`);
}
function exportReturns() {
  const rows = paginatedReturns.value.map((item, i) => ({
    "序号": i + 1,
    "退货单号": item.name,
    "采购订单": item.purchase_order?.name || "",
    "供应商": item.supplier?.name || "",
    "退货金额": item.amount_total || 0,
    "仓库": item.factory?.name || "",
    "状态": stateText(item.state),
    "制单日期": item.create_date || "",
    "操作员": item.creator || ""
  }));
  generateCSV("return", rows, `退货单_${new Date().toISOString().slice(0, 10)}.csv`);
}
function openCount(count = null) {
  resetDraft(count ? {
    count,
    lines: count.lines.map((line) => ({
      ...line,
      counted_qty: line.counted_qty,
      difference_reason: line.difference_reason || "",
      difference_note: line.difference_note || ""
    }))
  } : { location_id: "" });
  Object.assign(countFilters, { keyword: "", mode: "all" });
  modal.value = count ? (count.state === "counting" ? "count-lines" : "count-review") : "count-create";
}
function addEmergencyLine() { draft.lines.push({ material_id: "", quantity: "" }); }
function selectEmergencyMaterial(line, materialId) {
  if (String(line.material_id) !== String(materialId)) line.quantity = "";
  line.material_id = materialId;
}
function materialFor(id) { return materials.value.find((item) => String(item.id) === String(id)); }

async function submitModal() {
  if (saving.value) return;
  saving.value = true; modalError.value = "";
  let generatedRequisitions = [];
  let confirmedReceipt = null;
  let completedInspection = null;
  try {
    if (modal.value === "emergency") {
      if (!draft.factory_id || !draft.need_date) {
        throw new Error("请完整选择厂区和需求日期");
      }
      if (!String(draft.emergency_reason || "").trim()) throw new Error("请填写采购原因");
      if (!draft.lines.length || draft.lines.some((line) => !line.material_id || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)) {
        throw new Error("请完整填写采购需求明细，数量必须大于 0");
      }
      await brewApi.createPurchaseRequisition({
        factory_id: draft.factory_id, need_date: draft.need_date, request_type: "emergency",
        emergency_reason: draft.emergency_reason, reason: draft.reason,
        lines: draft.lines.map((line) => {
          const material = materialFor(line.material_id);
          return { product_id: material?.product_variant_id, uom_id: material?.uom_id?.id, requested_qty: Number(line.quantity) };
        })
      });
    } else if (modal.value === "requisition-edit") {
      if (!draft.factory_id || !draft.need_date) throw new Error("请完整填写厂区和需求日期");
      if (draft.requisition.request_type === "emergency" && !String(draft.emergency_reason || "").trim()) {
        throw new Error("请填写紧急原因");
      }
      if (!draft.lines.length || draft.lines.some((line) => !line.material_id || Number(line.quantity) <= 0)) {
        throw new Error("请至少保留一条完整明细，数量必须大于 0");
      }
      await brewApi.updatePurchaseRequisition(draft.requisition.id, {
        submit_after_save: props.taskOnly,
        version: draft.requisition.version,
        factory_id: draft.factory_id,
        supplier_id: draft.supplier_id || null,
        need_date: draft.need_date,
        reason: draft.reason,
        emergency_reason: draft.emergency_reason,
        lines: draft.lines.map((line) => {
          const material = materialFor(line.material_id);
          return {
            ...(line.id ? { id: line.id } : {}),
            product_id: material?.product_variant_id,
            uom_id: material?.uom_id?.id,
            requested_qty: Number(line.quantity)
          };
        })
      });
    } else if (modal.value === "plan") {
      if (!draft.need_date) throw new Error("请选择需求日期");
      if (draft.items.some((item) => !Number.isFinite(Number(item.requested_qty))
        || Number(item.requested_qty) <= 0)) {
        throw new Error("本次申请数量须是大于 0 的有效数字");
      }
      generatedRequisitions = await brewApi.aggregatePurchaseRequisitions({
        items: draft.items.map((item) => ({
          plan_id: item.plan.id, product_id: item.product.id,
          requested_qty: Number(item.requested_qty)
        })),
        need_date: draft.need_date, reason: draft.reason
      });
    } else if (modal.value === "order") {
      const selected = selectedPurchaseLines.value;
      if (!selected.length) throw new Error("请至少选择一条采购明细");
      if (!draft.order_date || !draft.expected_arrival_date) throw new Error("请填写下单日期和预期到货日期");
      if (selected.some((line) => !line.supplier_id)) throw new Error("请为每条采购明细选择供应商");
      if (selected.some((line) => Number(line.quantity) <= 0 || Number(line.package_count) <= 0)) {
        throw new Error("采购数量和件数必须大于 0");
      }
      await brewApi.createPurchaseOrderFromRequisitions({
        order_date: draft.order_date,
        expected_arrival_date: draft.expected_arrival_date,
        lines: selected.map((line) => ({
          requisition_line_id: line.id, supplier_id: line.supplier_id, quantity: Number(line.quantity),
          package_spec: line.package_spec, package_count: Number(line.package_count),
          price_unit: Number(line.price_unit || 0), planned_date: draft.expected_arrival_date
        }))
      });
    } else if (modal.value === "order-edit") {
      if (!draft.supplier_id || !draft.order_date || !draft.expected_arrival_date) {
        throw new Error("请完整填写供应商、下单日期和预期到货日期");
      }
      if (draft.resubmit && !String(draft.resubmit_note || "").trim()) {
        throw new Error("请填写本次修改和再次提交说明");
      }
      if (!draft.lines.length) throw new Error("采购订单至少保留一条明细");
      if (draft.lines.some((line) => Number(line.quantity) <= 0 || Number(line.package_count) <= 0 || Number(line.price_unit) < 0)) {
        throw new Error("采购数量、件数必须大于 0，采购单价不能小于 0");
      }
      const updated = await brewApi.updatePurchaseOrder(draft.order.id, {
        submit_after_save: props.taskOnly,
        resubmit_note: draft.resubmit ? String(draft.resubmit_note || '').trim() : undefined,
        version: draft.order.version,
        supplier_id: draft.supplier_id,
        order_date: draft.order_date,
        expected_arrival_date: draft.expected_arrival_date,
        lines: draft.lines.map((line) => ({
          ...(line.id ? { id: line.id } : { requisition_line_id: line.requisition_line_id }),
          quantity: Number(line.quantity),
          package_count: Number(line.package_count),
          package_spec: line.package_spec,
          price_unit: Number(line.price_unit),
          planned_date: line.planned_date
        }))
      });
      if (draft.resubmit && !props.taskOnly) {
        await brewApi.purchaseOrderAction(updated.id, "submit", {
          version: updated.version,
          resubmit_note: String(draft.resubmit_note).trim()
        });
      }
    } else if (modal.value === "receipt") {
      if (draft.lines.some(line => !Number.isFinite(Number(line.received_qty)) || Number(line.received_qty) < 0)) throw new Error("实收数量必须是有效的非负数字");
      const receivedLines = draft.lines.filter(line => Number(line.received_qty) > 0);
      if (!receivedLines.length) throw new Error("请至少填写一项实收数量");
      draft.destination_location_id = receivedLines[0]?.destination_location_id || "";
      if (!draft.qc_location_id || !draft.destination_location_id) throw new Error("请选择待检库位和具体入库库位");
      if (receivedLines.some(line => !line.destination_location_id)) throw new Error("请为本次收货的商品选择具体入库库位");
      confirmedReceipt = await brewApi.createReceipt({
        confirm_arrival: true,
        purchase_order_id: draft.order.id, qc_location_id: draft.qc_location_id,
        destination_location_id: draft.destination_location_id,
        lines: receivedLines.map((line) => ({ order_line_id: line.id, destination_location_id: line.destination_location_id || draft.destination_location_id, received_qty: Number(line.received_qty), supplier_lot: line.supplier_lot, expiration_date: line.expiration_date || null }))
      });
    } else if (modal.value === "receipt-edit") {
      if (!draft.qc_location_id || !draft.destination_location_id) throw new Error("请选择待检库位和入库库位");
      if (draft.lines.some(line => !line.destination_location_id)) throw new Error("请为每项商品选择具体入库库位，或应用默认库位");
      if (!draft.lines.length) throw new Error("请至少保留一条收货明细");
      if (draft.lines.some((line) => !line.order_line_id || Number(line.received_qty) <= 0)) {
        throw new Error("收货明细和实收数量不能为空");
      }
      confirmedReceipt = await brewApi.updateReceipt(draft.receipt.id, {
        confirm_arrival: true,
        version: draft.receipt.version,
        qc_location_id: draft.qc_location_id,
        destination_location_id: draft.destination_location_id,
        note: draft.note,
        lines: draft.lines.map((line) => ({
          ...(line.id ? { id: line.id } : {}),
          order_line_id: line.order_line_id,
          destination_location_id: line.destination_location_id || draft.destination_location_id,
          received_qty: Number(line.received_qty),
          supplier_lot: line.supplier_lot,
          expiration_date: line.expiration_date || null
        }))
      });
    } else if (modal.value === "quality") {
      for (const line of draft.lines) {
        const qualified = Number(line.qualified_qty || 0);
        const rejected = Number(line.rejected_qty || 0);
        const inspected = Number(line.inspected_qty || 0);
        if (!Number.isFinite(qualified) || !Number.isFinite(rejected) || qualified < 0 || rejected < 0 || Math.abs(qualified + rejected - inspected) > 0.000001) {
          throw new Error(`${line.product?.name || "该物料"} 的合格与不合格数量之和必须等于检验数量 ${inspected}`);
        }
        if (rejected > 0 && !line.disposition) {
          throw new Error(`${line.product?.name || "该物料"} 存在不合格数量，请选择退货或报损`);
        }
      }
      completedInspection = await brewApi.updateQualityResults(draft.inspection.id, {
        complete_and_put_away: true,
        version: draft.inspection.version, note: draft.note,
        lines: draft.lines.map((line) => ({ id: line.id, qualified_qty: Number(line.qualified_qty), rejected_qty: Number(line.rejected_qty), disposition: Number(line.rejected_qty) ? line.disposition : null, result_json: "{}", note: line.note }))
      });
    } else if (modal.value === "return-edit") {
      if (!draft.purchase_order_id) throw new Error("请选择采购订单");
      if (!selectedReturnLines.value.length) throw new Error("请至少选择一条退货明细并填写退货数量");
      if (selectedReturnLines.value.some((line) => !line.product_id || Number(line.return_qty) > Number(line._returnable_qty || 0))) {
        throw new Error("退货数量不能超过该批次当前可退库存");
      }
      const payload = {
        purchase_order_id: draft.purchase_order_id,
        factory_id: draft.factory_id,
        note: draft.note,
        return_reason: draft.return_reason,
        logistics_no: draft.logistics_no,
        lines: selectedReturnLines.value.map((line) => ({
          ...(line.id ? { id: line.id } : {}),
          product_id: line.product_id,
          lot_id: line.lot_id || null,
          purchase_order_line_id: line.purchase_order_line_id || null,
          return_qty: Number(line.return_qty),
          uom_id: line.uom_id || null,
          price_unit: Number(line.price_unit || 0),
          logistics_no: line.logistics_no,
          note: line.note
        }))
      };
      if (draft.returnRecord) {
        await brewApi.updatePurchaseReturn(draft.returnRecord.id, { version: draft.returnRecord.version, submit_after_save: props.taskOnly, ...payload });
      } else {
        await brewApi.createPurchaseReturn(payload);
      }
    } else if (modal.value === "count-create") {
      await brewApi.createInventoryCount({ location_id: draft.location_id });
    } else if (modal.value === "count-lines") {
      for (const line of draft.lines) {
        if (countHasDifference(line) && !line.difference_reason) {
          throw new Error(`${line.product?.name || "该物料"} 存在盘点差异，请选择差异原因`);
        }
        if (countHasDifference(line) && line.difference_reason === "other" && !String(line.difference_note || "").trim()) {
          throw new Error(`${line.product?.name || "该物料"} 的差异原因为其他，请填写差异说明`);
        }
      }
      const updated = await brewApi.updateInventoryCountLines(draft.count.id, {
        version: draft.count.version,
        lines: draft.lines.map((line) => ({
          id: line.id,
          counted_qty: Number(line.counted_qty),
          difference_reason: countHasDifference(line) ? line.difference_reason : null,
          difference_note: countHasDifference(line) ? line.difference_note : null
        }))
      });
      await brewApi.inventoryCountAction(updated.id, "submit", { version: updated.version });
    }
    const createdDailyRequest = modal.value === "emergency";
    const createdFromShortages = modal.value === "plan";
    if (createdFromShortages) selectedShortages.value = [];
    emit("toast", completedInspection ? "质检入库已完成，合格原料已入库，不合格部分已按所选方式处理" : confirmedReceipt ? (confirmedReceipt.state === "pending_approval" ? "超收已提交审批，通过后自动确认收货" : "收货已确认，已生成批次和待检单") : createdFromShortages || createdDailyRequest ? "采购需求已创建并提交审核" : "操作已完成"); modal.value = ""; await load(); if (createdFromShortages) await loadSourcePlans(); if (paginatedRequisitions.value.length || requisitionTotal.value) await loadRequisitions(); if (paginatedOrders.value.length || orderTotal.value) await loadOrders(); if (paginatedReceipts.value.length || receiptTotal.value) await loadReceipts(); if (tab.value === "receiving" || paginatedInspections.value.length || inspectionTotal.value) await loadInspections(); if (paginatedReturns.value.length || returnTotal.value) await loadReturns();
    if (props.taskOnly) { emit('changed'); emit('close'); }
    if (createdFromShortages) {
      tab.value = "requisitions";
      if (generatedRequisitions.length === 1) await openRequisitionDetail(generatedRequisitions[0]);
    }
  } catch (cause) { modalError.value = cause.message || "操作失败"; }
  finally { saving.value = false; }
}
async function runAction(callback, success) {
  try { await callback(); emit("toast", success); await load(); if (paginatedRequisitions.value.length || requisitionTotal.value) await loadRequisitions(); if (paginatedOrders.value.length || orderTotal.value) await loadOrders(); if (paginatedReceipts.value.length || receiptTotal.value) await loadReceipts(); if (tab.value === "receiving" || paginatedInspections.value.length || inspectionTotal.value) await loadInspections(); if (paginatedReturns.value.length || returnTotal.value) await loadReturns(); }
  catch (cause) { error.value = cause.message || "操作失败"; }
}
function requisitionAction(item, action) {
  runAction(() => brewApi.purchaseRequisitionAction(item.id, action, { version: item.version }), "采购需求已提交审批");
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
function createExport() {
  const filters = {};
  Object.entries(orderFilters).forEach(([key, value]) => { if (value) filters[key] = value; });
  runAction(() => brewApi.createExport({ export_type: "purchase", filters }), "采购单导出已进入生成队列");
}
async function openTaskOperation() {
  const op = props.taskOperation;
  if (!op) return;
  try {
    await load();
    if (op.kind === 'order') {
      const item = await brewApi.getPurchaseOrder(op.id);
      if (op.action === 'receive') await openReceipt(item);
      else if (op.action === 'edit') await openOrderEdit(item);
      else await openOrderDetail(item);
    } else if (op.kind === 'inspection') openQuality(await brewApi.getQualityInspection(op.id));
    else if (op.kind === 'receipt') await openReceiptEdit(await brewApi.getReceipt(op.id));
    else if (op.kind === 'requisition') {
      const item = await brewApi.getPurchaseRequisition(op.id);
      if (op.action === 'order') {
        requisitions.value = [item, ...requisitions.value.filter(r => String(r.id) !== String(item.id))];
        openOrder(item);
      } else await openRequisitionEdit(item);
    } else if (op.kind === 'return') {
      const item = await brewApi.getPurchaseReturn(op.id);
      if (op.action === 'edit') await openReturnEdit(item); else await openReturnDetail(item);
    } else if (op.kind === 'count') openCount(await brewApi.getInventoryCount(op.id));
    if (!modal.value) { if (error.value) emit('toast', error.value); emit('close'); }
  } catch (cause) { emit('toast', cause.message || '任务详情加载失败'); emit('close'); }
}
async function executeTaskOperation() {
  if (saving.value) return;
  const op = props.taskOperation;
  saving.value = true; modalError.value = '';
  try {
    if (op.kind === 'order' && op.action === 'place') await brewApi.purchaseOrderAction(op.id, 'place', { version: draft.order.version });
    else if (op.kind === 'return' && op.action === 'execute') await brewApi.purchaseReturnAction(op.id, 'execute', { version: draft.returnRecord?.version || draft.returnDetail?.version || draft.return?.version });
    else if (op.kind === 'count') {
      const item = draft.count;
      if (item.state === 'draft') {
        const result = await brewApi.inventoryCountAction(item.id, 'start', { version: item.version });
        openCount(result); emit('changed'); return;
      }
      await brewApi.inventoryCountAction(item.id, 'confirm', { version: item.version });
    }
    emit('changed'); emit('close');
  } catch (cause) { modalError.value = cause.message || '操作失败'; }
  finally { saving.value = false; }
}
const taskOperationButton = computed(() => {
  if (!props.taskOnly) return '';
  const op = props.taskOperation;
  if (modal.value === 'order-detail' && op?.action === 'place') return '确认正式下单';
  if (modal.value === 'return-detail' && op?.action === 'execute') return '确认执行退货';
  if (modal.value === 'count-review' && draft.count?.state === 'draft') return '开始盘点';
  if (modal.value === 'count-review' && draft.count?.state === 'pending_approval') return '确认盘点';
  return '';
});
watch(modal, (value, previous) => { if (props.taskOnly && previous && !value && !saving.value) emit('close'); });
onMounted(() => props.taskOnly ? (props.taskOperation?.kind === 'count' ? undefined : openTaskOperation()) : load());
watch(tab, (newTab) => {
  if (newTab === "shortages") loadSourcePlans();
  if (newTab === "requisitions" && !paginatedRequisitions.value.length) loadRequisitions();
  if (newTab === "orders" && !paginatedOrders.value.length) loadOrders();
  if (newTab === "receiving") { loadInspections(); }
  if (newTab === "returns" && !paginatedReturns.value.length) loadReturns();
});
</script>

<template>
  <div class="inventory-workbench">
    <Teleport v-if="taskOnly && taskOperation?.kind === 'count'" to="body"><div class="count-task-mask"><section class="count-task-panel" role="dialog" aria-modal="true" aria-label="库存盘点任务"><InventoryCountPage :permissions="permissions" :initial-id="taskOperation.id" task-only @toast="emit('toast',$event)" @changed="emit('changed')" @close="emit('close')" /></section></div></Teleport>
    <template v-if="!taskOnly">
    <div class="inventory-tabs"><button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">{{ item.label }}</button><button v-if="tab !== 'stock'" class="inventory-tab-refresh" type="button" :disabled="loading" @click="load" aria-label="刷新当前数据">↻ 刷新</button></div>
    <div v-if="error" class="master-error inventory-error">{{ error }}</div>

    <StockBrowserPage v-if="tab === 'stock'" :initial-category="stockInitialCategory" :permissions="props.permissions" :current-user="props.currentUser" :roles="props.roles" />
    <InventoryCountPage v-else-if="tab === 'counts'" :permissions="permissions" @toast="emit('toast',$event)" @changed="emit('changed')" />

    <InventoryOverview v-else-if="tab === 'overview'" class="procurement-scroll-panel" :loading="loading" :actions="overviewActions" :work="overviewWork" :categories="inventoryCategories" :health="stockHealth" :lots="lots" :liquids="overviewLiquids" @navigate="navigateOverview" @category="showCategoryInventory" />

    <section v-else-if="tab === 'shortages'" class="inventory-section shortage-section">
      <header>
        <div class="shortage-header-title"><h3>生产缺口</h3><p>按品类查看缺料，可勾选多个需求一起申请</p></div>
        <div class="shortage-header-tools">
          <div class="shortage-header-search"><input v-model.trim="shortageFilters.plan_no" placeholder="搜索需求、计划或酒品" aria-label="搜索生产缺口" @keyup.enter="loadSourcePlans"><button class="btn btn-sm btn-primary" type="button" :disabled="shortageLoading" @click="loadSourcePlans">搜索</button></div>
          <button v-if="shortageFilters.plan_no" class="shortage-header-clear" type="button" @click="shortageFilters.plan_no = ''; loadSourcePlans()">清除</button>
          <select v-model="shortageFilters.factory_id" class="shortage-factory-select" aria-label="筛选酒厂" :disabled="shortageLoading" @change="loadSourcePlans"><option value="">全部酒厂</option><option v-for="factory in factories" :key="factory.id" :value="factory.id">{{ factory.name }}</option></select>
        </div>
      </header>
      <div v-if="shortageCategorySummary.length" class="shortage-overview">
        <div class="shortage-overview-heading"><strong>原料缺口汇总</strong></div>
        <div class="shortage-overview-cards"><button v-for="group in shortageCategorySummary" :key="group.key" type="button" class="shortage-overview-card" :class="{ active: appliedShortageCategoryGroup === group.key }" :aria-pressed="appliedShortageCategoryGroup === group.key" :disabled="shortageLoading" @click="selectShortageCategory(group.key)"><span>{{ group.name }}<small>{{ group.demands.size }} 个需求 · {{ group.items }} 项缺口</small></span><strong>{{ shortageGroupQuantity(group) }}</strong><em>{{ appliedShortageCategoryGroup === group.key ? '正在查看' : '查看明细 →' }}</em></button></div>
      </div>
      <div v-if="canRequestRequisition && shortageTotal" class="shortage-selection-bar">
        <div class="shortage-selection-controls"><button v-if="requestableShortageRows.length && !requestableShortageRows.every(item => selectedShortages.includes(item.request_key))" class="btn btn-sm btn-outline" type="button" @click="selectAllShortages">全选当前结果</button></div>
        <div class="shortage-selection-result"><span>已选 <strong>{{ selectedShortageDemandCount }}</strong> 个需求 · <strong>{{ selectedShortageRows.length }}</strong> 项原料</span><button v-if="selectedShortageRows.length" class="shortage-clear-selection" type="button" @click="selectedShortages = []">清空</button><button class="btn btn-sm btn-primary" type="button" :disabled="!selectedShortageRows.length" @click="openPlan">生成采购需求单</button></div>
      </div>
      <div v-if="appliedShortageCategoryGroup && shortageTotal" class="shortage-category-heading"><div><strong>{{ shortageCategorySummary.find(group => group.key === appliedShortageCategoryGroup)?.name || '当前品类' }}缺料明细</strong></div><button class="shortage-clear-selection" type="button" @click="selectShortageCategory(appliedShortageCategoryGroup)">查看全部品类</button></div>
      <div class="shortage-plan-list" :class="{ 'shortage-category-list': appliedShortageCategoryGroup }">
        <article v-for="plan in paginatedShortagePlans" :key="plan.id" class="shortage-plan-card" :class="{ 'is-selected': isPlanFullySelected(plan), 'category-view': appliedShortageCategoryGroup }">
          <label v-if="canRequestRequisition && !appliedShortageCategoryGroup" class="shortage-plan-select" :class="{ 'is-disabled': !planRequestableRows(plan).length }" :title="planRequestableRows(plan).length ? '选择本计划全部可申请原料' : '本计划没有可申请原料'">
            <input type="checkbox" :checked="isPlanFullySelected(plan)" :disabled="!planRequestableRows(plan).length" :aria-label="'选择 ' + (plan.product?.name || '该酒品') + ' 的可申请原料'" @change="togglePlanShortages(plan)">
          </label>
          <div v-if="appliedShortageCategoryGroup" class="shortage-plan-summary shortage-category-plan-summary">
            <label v-if="canRequestRequisition" class="shortage-category-plan-select" :title="planRequestableRows(plan).length ? '选择本计划全部可申请原料' : '本计划没有可申请原料'"><input type="checkbox" :checked="isPlanFullySelected(plan)" :disabled="!planRequestableRows(plan).length" :aria-label="'选择 ' + (plan.product?.name || '该酒品') + ' 的可申请原料'" @change="togglePlanShortages(plan)"></label>
            <span class="shortage-plan-identity"><small>{{ plan.demand ? '产品需求 ' + plan.demand.name : '直接生产' }}</small><strong>{{ plan.product?.name }}</strong><small>生产 {{ dateTime(plan.planned_start) }}</small></span>
            <span class="shortage-plan-factory"><small>生产酒厂</small><strong>{{ plan.factory?.name || '未指定' }}</strong><small>按本厂库存核算</small></span>
            <span class="shortage-plan-need" :class="{ complete: !plan.shortage_items }">{{ plan.shortage_items ? `${plan.shortage_items} 项待申请` : '已全部申请' }}</span>
            <button class="btn btn-xs btn-outline" type="button" @click="selectedPlanId = plan.id">查看生产计划</button>
          </div>
          <button v-else class="shortage-plan-summary" type="button" :aria-expanded="expandedShortagePlanId === plan.id" @click="expandedShortagePlanId = expandedShortagePlanId === plan.id ? null : plan.id">
            <span class="shortage-plan-identity"><small>{{ plan.demand ? '产品需求 ' + plan.demand.name : '直接生产' }}</small><strong>{{ plan.product?.name }}</strong><small>生产 {{ dateTime(plan.planned_start) }}</small></span>
            <span class="shortage-plan-factory"><small>生产酒厂</small><strong>{{ plan.factory?.name || '未指定' }}</strong><small>按本厂库存核算</small></span>
            <span class="shortage-plan-count"><strong>{{ plan.materials.length }}</strong><small>种原料缺货</small></span>
            <span class="shortage-plan-need" :class="{ complete: !plan.shortage_items }">{{ plan.shortage_items ? `${plan.shortage_items} 项待申请` : '已全部申请' }}</span>
            <span class="shortage-plan-chevron">{{ expandedShortagePlanId === plan.id ? '收起 ↑' : '查看明细 ↓' }}</span>
          </button>
          <div v-if="appliedShortageCategoryGroup || expandedShortagePlanId === plan.id" class="shortage-plan-detail">
            <div v-if="!appliedShortageCategoryGroup" class="shortage-plan-toolbar"><span>仅按 <strong>{{ plan.factory?.name }}</strong> 的可用库存核算 · 生产 {{ dateTime(plan.planned_start) }} 至 {{ dateTime(plan.planned_end) }}</span><div><button class="btn btn-xs btn-outline" type="button" @click="selectedPlanId = plan.id">查看生产计划</button></div></div>
            <div class="shortage-material-list"><div v-for="item in plan.materials" :key="item.request_key" class="shortage-material-row">
              <input v-if="canRequestRequisition" v-model="selectedShortages" type="checkbox" :value="item.request_key" :disabled="Number(item.requestable_qty) <= 0" :aria-label="'选择 ' + item.product?.name">
              <span v-else class="shortage-material-selection-space"></span>
              <div class="shortage-material-name"><strong>{{ item.product?.name }}</strong><small>{{ item.category?.group_name || '原料' }} / {{ item.category?.name || '未分类' }}</small></div>
              <div class="shortage-material-amount"><small>计划需求</small><span>{{ number(item.required,3) }} {{ item.uom }}</span></div>
              <div class="shortage-material-amount"><small>本厂可用</small><span>{{ number(item.allocated,3) }} {{ item.uom }}</span></div>
              <div class="shortage-material-amount shortage-material-missing"><small>缺口</small><strong>{{ number(item.shortage,3) }} {{ item.uom }}</strong></div>
              <div class="shortage-material-status"><span class="state-pill" :data-state="item.request_status">{{ requestStatusText(item.request_status) }}</span><small v-if="Number(item.requestable_qty) > 0">可申请 {{ number(item.requestable_qty,3) }} {{ item.uom }}</small><div v-if="item.linked_requisitions?.length" class="record-links"><button v-for="req in item.linked_requisitions" :key="req.id" class="record-link" type="button" @click="openRequisitionDetail(req)">{{ req.name }}</button></div></div>
            </div></div>
          </div>
        </article>
        <div v-if="!paginatedShortagePlans.length" class="inventory-empty">{{ shortageLoading ? '正在加载生产缺口…' : '当前条件下没有生产缺口' }}</div>
      </div>
      <footer class="proc-pagination"><span>共 {{ shortageTotal }} 个生产计划</span><select :value="shortagePageSize" @change="changeShortagePageSize($event.target.value)"><option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }} 条/页</option></select><button class="btn btn-xs btn-outline" :disabled="shortagePage<=1" @click="shortagePage--">上一页</button><span>{{ shortagePage }} / {{ Math.max(1, Math.ceil(shortageTotal / shortagePageSize)) }}</span><button class="btn btn-xs btn-outline" :disabled="shortagePage*shortagePageSize>=shortageTotal" @click="shortagePage++">下一页</button></footer>
    </section>

    <section v-else-if="tab === 'requisitions'" class="inventory-section procurement-fill-panel">
      <header><div><h3>采购需求</h3><p>查看需求从发起、审批到关联采购单的完整进展，审批操作统一在“我的任务”处理</p></div><div class="section-actions"><button v-if="canRequestRequisition" class="btn btn-sm btn-outline" @click="openEmergency">新建日常采购需求</button><button v-if="canPurchase" class="btn btn-sm btn-primary" @click="openOrder()">从需求生成采购单</button></div></header>
      <div class="shortage-overview requisition-overview">
        <div class="shortage-overview-heading"><strong>采购需求汇总</strong><span>{{ requisitionSummary.total }} 张</span></div>
        <div class="requisition-summary-tabs">
          <button v-for="item in [
            { key: '', label: '全部需求', count: requisitionSummary.total },
            { key: 'submitted', label: '待审批', count: requisitionSummary.submitted },
            { key: 'approved', label: '已批准待下单', count: requisitionSummary.approved },
            { key: 'ordered', label: '已转采购单', count: requisitionSummary.ordered },
            { key: 'closed,cancelled', label: '历史已关闭', count: requisitionSummary.history },
            { key: 'draft,returned', label: '草稿 / 已退回', count: requisitionSummary.drafts }
          ]" :key="item.key || 'all'" type="button" class="requisition-summary-tab" :class="{ active: requisitionStateFilter === item.key }" :aria-pressed="requisitionStateFilter === item.key" :disabled="requisitionLoading" @click="showRequisitionGroup(item.key)">
            <span>{{ item.label }}</span><strong>{{ item.count }}</strong>
          </button>
        </div>
      </div>
      <div class="requisition-list" :aria-busy="requisitionLoading">
        <div class="requisition-table-head" role="row"><span>采购需求 / 申请人</span><span>需求日期 / 厂区</span><span>物料明细</span><span>进度 / 采购单</span><span>预估总价</span><span>操作</span></div>
        <article v-for="item in paginatedRequisitions" :key="item.id" class="requisition-row" role="row">
          <div class="requisition-cell requisition-identity" data-label="采购需求 / 申请人"><button class="record-link record-link-main" type="button" @click="openRequisitionDetail(item)">{{ item.name }}</button><small>{{ item.requester?.name || '-' }} · {{ requestType(item) }}</small></div>
          <div class="requisition-cell" data-label="需求日期 / 厂区"><strong>{{ item.need_date || '-' }}</strong><small>{{ item.factory?.name || '-' }}</small></div>
          <div class="requisition-cell requisition-material-cell" data-label="物料明细"><button class="record-link requisition-material-link" type="button" :aria-label="`查看 ${item.name} 的 ${item.lines.length} 项物料明细`" @click="openRequisitionDetail(item)">{{ item.lines.length }} 项物料明细</button><small>采购数量与来源</small></div>
          <div class="requisition-cell requisition-progress-cell" data-label="进度 / 采购单"><i class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</i><button v-for="order in item.orders" :key="order.id" class="record-link" type="button" @click="openOrderDetail(order)">{{ order.name }}</button><small v-if="!item.orders?.length">尚未生成采购单</small><em v-if="item.return_reason">{{ item.return_reason }}</em></div>
          <div class="requisition-cell requisition-estimate" data-label="预估总价"><strong v-if="item.estimated_total_amount !== null && item.estimated_total_amount !== undefined">{{ formatMoney(item.estimated_total_amount) }}</strong><strong v-else>报价不全</strong><small v-if="item.estimated_unpriced_line_count">{{ item.estimated_unpriced_line_count }} 项无报价</small><small v-else>按当前供应商报价估算</small></div>
          <div class="requisition-cell requisition-row-actions" data-label="操作"><button class="btn btn-xs btn-outline" type="button" @click="openRequisitionDetail(item)">查看</button><button v-if="canRequestRequisition && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-outline" type="button" @click="openRequisitionEdit(item)">编辑</button><button v-if="canRequestRequisition && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-primary" type="button" @click="requisitionAction(item,'submit')">提交审批</button><button v-if="canPurchase && item.state === 'approved' && item.lines.some(line => remaining(line) > 0)" class="btn btn-xs btn-primary" type="button" @click="openOrder(item)">生成采购单</button></div>
        </article>
        <div v-if="!paginatedRequisitions.length" class="inventory-empty" role="status">{{ requisitionLoading ? '正在加载采购需求…' : '暂无采购需求' }}</div>
      </div>
      <footer class="proc-pagination requisition-pagination">
        <span>共 {{ requisitionTotal }} 条</span>
        <select :value="requisitionPageSize" @change="changeRequisitionPageSize($event.target.value)">
          <option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }} 条/页</option>
        </select>
        <button class="btn btn-xs btn-outline" :disabled="requisitionPage<=1||requisitionLoading" @click="requisitionPage--;loadRequisitions()">上一页</button>
        <span>{{ requisitionPage }} / {{ Math.max(1, Math.ceil(requisitionTotal / requisitionPageSize)) }}</span>
        <button class="btn btn-xs btn-outline" :disabled="requisitionPage*requisitionPageSize>=requisitionTotal||requisitionLoading" @click="requisitionPage++;loadRequisitions()">下一页</button>
      </footer>
    </section>

    <section v-else-if="tab === 'orders'" class="inventory-section order-workspace">
      <header><div class="shortage-header-title"><h3>采购执行</h3><p>跟踪已生成采购单的审批、下单、收货与关闭状态</p></div><form class="shortage-header-tools order-header-tools" @submit.prevent="orderPage=1;loadOrders()"><input v-model.trim="orderFilters.supplier_name" class="order-supplier-search" aria-label="供应商名称" placeholder="供应商名称"><div class="shortage-header-search"><input v-model.trim="orderFilters.order_no" aria-label="采购单号" placeholder="搜索采购单号"><button class="btn btn-sm btn-primary" type="submit" :disabled="orderLoading">搜索</button></div><select v-model="orderFilters.receipt_state" class="shortage-factory-select" aria-label="筛选收货状态" :disabled="orderLoading" @change="orderPage=1;loadOrders()"><option value="">全部收货状态</option><option value="not_received">未收货</option><option value="partial">部分收货</option><option value="receiving">收货处理中</option><option value="received">已收货</option></select><button v-if="orderFilters.supplier_name || orderFilters.order_no || orderFilters.receipt_state" class="shortage-header-clear" type="button" @click="resetOrderFilters">重置</button></form></header>
      <div class="work-table-wrap"><table class="work-table purchase-order-table"><thead><tr><th>序号</th><th>采购需求单号</th><th>采购单号</th><th>供应商</th><th>下单人</th><th>采购金额</th><th>预期到货</th><th>下单日期</th><th>审批状态</th><th>收货状态</th><th>操作</th></tr></thead><tbody>
        <tr v-for="(item,index) in paginatedOrders" :key="item.id"><td>{{ (orderPage - 1) * orderPageSize + index + 1 }}</td><td><div v-if="item.requisitions?.length" class="record-links"><button v-for="req in item.requisitions" :key="req.id" class="record-link" type="button" @click="openRequisitionDetail(req)">{{ req.name }}</button></div><span v-else>-</span><small>{{ orderType(item) }}</small></td><td><button class="record-link record-link-main" type="button" @click="openOrderDetail(item)">{{ item.name }}</button><small>{{ stateText(item.state) }}</small></td><td>{{ item.supplier?.name || '-' }}<small>{{ item.supplier?.code || '-' }}</small></td><td>{{ item.purchaser?.name || '-' }}</td><td><strong>{{ formatMoney(item.amount_total, item.currency) }}</strong></td><td>{{ item.expected_arrival_date || '-' }}</td><td>{{ dateTime(item.order_date) }}</td><td><span class="state-pill" :data-state="item.approval_state">{{ stateText(item.approval_state) }}</span></td><td><span class="state-pill" :data-state="item.receipt_state">{{ receiptStateText(item.receipt_state) }}</span></td><td class="row-actions"><button class="btn btn-xs btn-outline" @click="openOrderDetail(item)">查看详情</button><button v-if="canPurchase && ['draft','sent'].includes(item.state)" class="btn btn-xs btn-outline" @click="openOrderEdit(item)">编辑</button><button v-if="canPurchase && ['draft','sent'].includes(item.state)" class="btn btn-xs btn-primary" @click="orderAction(item,'place')">正式下单</button><button v-if="canWarehouse && item.can_receive" class="btn btn-xs btn-outline" :disabled="receiptOpening" @click="openReceipt(item)">确认收货</button><button v-if="canPurchase && item.state === 'purchase'" class="btn btn-xs btn-outline" @click="orderAction(item,'close')">关闭</button></td></tr>
        <tr v-if="!paginatedOrders.length"><td colspan="11" class="inventory-empty">暂无符合条件的采购单</td></tr>
      </tbody></table></div>
      <footer class="proc-pagination">
        <span>共 {{ orderTotal }} 条</span>
        <select :value="orderPageSize" @change="changeOrderPageSize($event.target.value)">
          <option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }} 条/页</option>
        </select>
        <button class="btn btn-xs btn-outline" :disabled="orderPage<=1||orderLoading" @click="orderPage--;loadOrders()">上一页</button>
        <span>{{ orderPage }} / {{ Math.max(1, Math.ceil(orderTotal / orderPageSize)) }}</span>
        <button class="btn btn-xs btn-outline" :disabled="orderPage*orderPageSize>=orderTotal||orderLoading" @click="orderPage++;loadOrders()">下一页</button>
      </footer>
    </section>

    <template v-else-if="tab === 'receiving'">
      <section class="inventory-section qc-workspace">
        <header><div class="shortage-header-title"><h3>质检入库</h3><p>确认检验结果即可入库，收货记录可在详情中查看</p></div><form class="shortage-header-tools" @submit.prevent="inspectionPage=1;loadInspections()"><div class="shortage-header-search"><input v-model.trim="inspectionFilters.keyword" aria-label="搜索质检单、收货单或原料" placeholder="搜索质检单、收货单或原料"><button class="btn btn-sm btn-primary" type="submit" :disabled="inspectionLoading">搜索</button></div><button v-if="inspectionFilters.keyword" class="shortage-header-clear" type="button" @click="inspectionFilters.keyword='';inspectionPage=1;loadInspections()">清除</button><select v-model="inspectionFilters.factory_id" class="shortage-factory-select" aria-label="筛选厂区" :disabled="inspectionLoading" @change="inspectionPage=1;loadInspections()"><option value="">全部厂区</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></form></header>
        <div class="qc-toolbar"><div class="qc-view-tabs" role="group" aria-label="质检进度"><button v-for="view in [{value:'pending',label:'待质检'},{value:'completed',label:'已完成'},{value:'',label:'全部记录'}]" :key="view.value" type="button" :class="{active: inspectionFilters.state === view.value}" :disabled="inspectionLoading" @click="inspectionFilters.state=view.value;inspectionPage=1;loadInspections()">{{ view.label }}</button></div><span class="qc-record-count">共 {{ inspectionTotal }} 条记录</span></div>
        <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>质检单 / 来源收货</th><th>原料</th><th>供应商</th><th>检验结果</th><th>进度</th><th>操作</th></tr></thead><tbody>
          <tr v-for="(item,index) in paginatedInspections" :key="item.id">
            <td>{{ (inspectionPage - 1) * inspectionPageSize + index + 1 }}</td>
            <td><strong>{{ item.name }}</strong><small>{{ item.receipt_name || '-' }}</small></td>
            <td><strong>{{ [...new Set((item.lines || []).map(line => line.product?.name).filter(Boolean))].join('、') || '-' }}</strong><small>{{ item.lines?.length || 0 }} 项原料</small></td>
            <td>{{ item.supplier?.name || '-' }}</td>
            <td><template v-if="item.state === 'completed'"><span class="qc-qualified">合格 {{ inspectionQuantityText(item, 'qualified_qty') }}</span><small v-if="item.lines?.some(line => Number(line.rejected_qty) > 0)" class="qc-rejected">不合格 {{ inspectionQuantityText(item, 'rejected_qty') }}</small></template><span v-else>待检 {{ inspectionQuantityText(item, 'inspected_qty') }}</span></td>
            <td><span class="state-pill" :data-state="item.state">{{ item.state === 'completed' ? '已完成' : inspectionStateText(item.state) }}</span></td>
            <td class="row-actions">
              <button class="btn btn-xs btn-outline" @click="openInspectionDetail(item)">查看详情</button>
              <button v-if="canWarehouse && ['draft','returned','submitted'].includes(item.state)" class="btn btn-xs btn-primary" @click="openQuality(item)">开始质检入库</button>
            </td>
          </tr>
          <tr v-if="!paginatedInspections.length"><td colspan="7" class="inventory-empty">{{ inspectionLoading ? '正在加载…' : inspectionFilters.state === 'pending' ? '暂无待质检原料，收货后将自动出现在这里' : '暂无相关记录' }}</td></tr>
        </tbody></table></div>
        <footer class="proc-pagination">
          <span>共 {{ inspectionTotal }} 条</span>
          <select :value="inspectionPageSize" @change="changeInspectionPageSize($event.target.value)"><option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }} 条/页</option></select>
          <button class="btn btn-xs btn-outline" :disabled="inspectionPage<=1||inspectionLoading" @click="inspectionPage--;loadInspections()">上一页</button>
          <span>{{ inspectionPage }} / {{ Math.max(1, Math.ceil(inspectionTotal / inspectionPageSize)) }}</span>
          <button class="btn btn-xs btn-outline" :disabled="inspectionPage*inspectionPageSize>=inspectionTotal||inspectionLoading" @click="inspectionPage++;loadInspections()">下一页</button>
        </footer>
      </section>
    </template>

    <template v-else-if="tab === 'returns'">
      <section class="inventory-section procurement-fill-panel">
        <header><div><h3>采购退货</h3><p>不合格原料退回供应商，审批后执行退货出库</p></div><div class="section-actions"><button v-if="canWarehouse" class="btn btn-sm btn-primary" @click="openReturnCreate">新建退货单</button><button v-if="canExport" class="btn btn-sm btn-outline" @click="exportReturns">导出</button></div></header>
        <div class="procurement-filters return-filters"><input v-model.trim="returnFilters.keyword" placeholder="退货单号 / 采购单号 / 原料" @keyup.enter="returnPage=1;loadReturns()"><input v-model.trim="returnFilters.supplier_name" placeholder="供应商名称" @keyup.enter="returnPage=1;loadReturns()"><select v-model="returnFilters.factory_id" @change="returnPage=1;loadReturns()"><option value="">全部仓库</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select><select v-model="returnFilters.state" @change="returnPage=1;loadReturns()"><option value="">全部状态</option><option value="draft">草稿</option><option value="submitted">待审批</option><option value="approved">已批准</option><option value="returned">已退回</option><option value="done">已完成</option><option value="cancelled">已取消</option></select><button class="btn btn-sm btn-outline" @click="resetReturnFilters">重置</button><button class="btn btn-sm btn-primary" :disabled="returnLoading" @click="returnPage=1;loadReturns()">查询</button></div>
        <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>退货单号</th><th>采购订单</th><th>来源收货单</th><th>供应商</th><th>退货金额</th><th>退货件数</th><th>仓库</th><th>制单日期</th><th>操作员</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="(item,index) in paginatedReturns" :key="item.id">
            <td>{{ (returnPage - 1) * returnPageSize + index + 1 }}</td>
            <td><strong>{{ item.name }}</strong></td>
            <td><button v-if="item.purchase_order" class="record-link" type="button" @click="openOrderDetail(item.purchase_order)">{{ item.purchase_order.name }}</button><span v-else>-</span></td>
            <td><button v-if="item.receipt_id" class="record-link" type="button" @click="openReceiptDetail({ id: item.receipt_id })">{{ item.receipt_name }}</button><span v-else>-</span></td>
            <td>{{ item.supplier?.name || '-' }}</td>
            <td>¥{{ number(item.amount_total) }}</td>
            <td>{{ number(item.lines?.reduce((s,l)=>s+Number(l.return_qty||0),0),3) }}</td>
            <td>{{ item.factory?.name || '-' }}</td>
            <td>{{ dateTime(item.create_date) }}</td>
            <td>{{ item.creator || '-' }}</td>
            <td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span><small v-if="item.state === 'returned' && item.return_reason" style="display:block;color:#ef5350">退回：{{ item.return_reason }}</small></td>
            <td class="row-actions">
              <button class="btn btn-xs btn-outline" @click="openReturnDetail(item)">查看</button>
              <button v-if="canWarehouse && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-outline" @click="openReturnEdit(item)">编辑</button>
              <button v-if="canWarehouse && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-primary" @click="returnAction(item,'submit')">提交审批</button>
              <button v-if="canWarehouse && item.state === 'approved'" class="btn btn-xs btn-primary" @click="returnAction(item,'execute')">执行退货</button>
            </td>
          </tr>
          <tr v-if="!paginatedReturns.length"><td colspan="12" class="inventory-empty">暂无退货记录</td></tr>
        </tbody></table></div>
        <footer class="proc-pagination">
          <span>共 {{ returnTotal }} 条</span>
          <select :value="returnPageSize" @change="changeReturnPageSize($event.target.value)"><option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }} 条/页</option></select>
          <button class="btn btn-xs btn-outline" :disabled="returnPage<=1||returnLoading" @click="returnPage--;loadReturns()">上一页</button>
          <span>{{ returnPage }} / {{ Math.max(1, Math.ceil(returnTotal / returnPageSize)) }}</span>
          <button class="btn btn-xs btn-outline" :disabled="returnPage*returnPageSize>=returnTotal||returnLoading" @click="returnPage++;loadReturns()">下一页</button>
        </footer>
      </section>
    </template>

    <MaterialIssueQueue v-else-if="tab === 'material-issue'" class="procurement-fill-panel" :tasks="preparationTasks" :records="materialRequisitions" :can-warehouse="canWarehouse" @open="selectedMaterialPlanId = $event" />

    <div v-else-if="tab === 'inventory'" class="procurement-scroll-panel">
      <section class="inventory-section">
        <header><div><h3>批次库存</h3><p>按批次、物料分类、采购供应商和效期快速定位库存</p></div><button class="btn btn-sm btn-outline" type="button" :disabled="lotLoading" @click="loadLots">刷新</button></header>
        <div class="inventory-filters">
          <input v-model.trim="lotFilters.keyword" placeholder="搜索批次、供应商批号或物料" @keyup.enter="loadLots">
          <select v-model="lotFilters.category"><option value="">全部种类</option><option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select>
          <select v-model="lotFilters.supplier_id"><option value="">全部厂家/供应商</option><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select>
          <select v-model="lotFilters.factory_id"><option value="">全部厂区</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select>
          <select v-model="lotFilters.location_id"><option value="">全部库位</option><option v-for="item in filterLocations" :key="item.id" :value="item.id">{{ locationLabel(item) }}</option></select>
          <select v-model="lotFilters.expiry_status"><option value="">全部效期</option><option value="expired">已过期</option><option value="expiring">30天内到期</option><option value="normal">效期正常</option><option value="no_expiration">未设置效期</option></select>
          <select v-model="lotFilters.availability"><option value="">全部库存</option><option value="available">有可用库存</option><option value="unavailable">可用为0</option><option value="abnormal">只看效期/库存异常</option></select>
          <button class="btn btn-sm btn-outline" type="button" @click="resetLotFilters">清空筛选</button>
          <button class="btn btn-sm btn-primary" type="button" @click="loadLots">应用筛选</button>
        </div>
        <div class="work-table-wrap"><table class="work-table"><thead><tr><th>物料 / 批次</th><th>厂家/供应商</th><th>效期</th><th>账面</th><th>预占</th><th>可用</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in visibleLots" :key="item.id"><td><strong>{{ item.product?.name }}</strong><small>{{ item.name }} · {{ item.supplier_lot || '无供应商批号' }}</small></td><td>{{ item.supplier?.name || '-' }}<small>{{ item.product?.material_category_name || item.product?.category || '-' }}</small></td><td><span class="expiry-badge" :data-status="item.expiry_status">{{ expiryText(item) }}</span><small>{{ item.expiration_date || '未设置' }}</small></td><td>{{ number(item.on_hand,3) }} {{ item.uom }}</td><td>{{ number(item.reserved,3) }}</td><td><strong>{{ number(item.available,3) }}</strong><small v-if="availableReasonText(item)" class="stock-reason">{{ availableReasonText(item) }}</small></td><td>{{ item.frozen ? '已冻结' : stateText(item.quality_status) }}</td><td><button v-if="canWarehouse" class="btn btn-xs btn-outline" @click="toggleLot(item)">{{ item.frozen ? '解冻' : '冻结' }}</button></td></tr><tr v-if="!visibleLots.length"><td colspan="8" class="inventory-empty">没有匹配的批次库存</td></tr></tbody></table></div>
      </section>
      <section class="inventory-section"><header><div><h3>库存盘点</h3><p>先定位差异，再填写原因；提交后进入审批</p></div><button v-if="canCount" class="btn btn-sm btn-primary" @click="openCount()">新建盘点</button></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>盘点单</th><th>库位</th><th>明细</th><th>差异</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in counts" :key="item.id"><td><strong>{{ item.name }}</strong><small>{{ dateTime(item.created_at) }}</small></td><td>{{ locationLabel(item.location) }}</td><td>{{ item.lines.length }} 项</td><td>{{ number(item.lines.reduce((n,line)=>n+Math.abs(Number(line.difference_qty||0)),0),3) }}</td><td>{{ stateText(item.state) }}</td><td class="row-actions"><button v-if="canCount && item.state === 'draft'" class="btn btn-xs btn-primary" @click="countAction(item,'start')">开始</button><button v-if="canCount && item.state === 'counting'" class="btn btn-xs btn-primary" @click="openCount(item)">录入实数</button><button v-if="item.state !== 'draft' && item.state !== 'counting'" class="btn btn-xs btn-outline" @click="openCount(item)">查看差异</button><button v-if="canCount && item.state === 'pending_approval'" class="btn btn-xs btn-outline" @click="countAction(item,'confirm')">确认</button></td></tr><tr v-if="!counts.length"><td colspan="6" class="inventory-empty">暂无库存盘点</td></tr></tbody></table></div></section>
    </div>

    <section v-else class="inventory-section procurement-fill-panel"><header><div><h3>采购对账准备</h3><p>核对采购订单、实际收货与质检退货后生成对账文件</p></div><button v-if="canExport" class="btn btn-sm btn-primary" @click="createExport">生成采购对账文件</button></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>采购订单</th><th>供应商</th><th>订单金额</th><th>实收数量</th><th>质检退货</th><th>状态</th></tr></thead><tbody><tr v-for="item in settlementRows" :key="item.id"><td><strong>{{ item.name }}</strong><small>{{ orderType(item) }}</small></td><td>{{ item.supplier?.name }}</td><td>{{ formatMoney(item.amount_total, item.currency) }}</td><td>{{ number(item.received,3) }}</td><td>{{ number(item.rejected,3) }}</td><td>{{ settlementStateText(item) }}</td></tr></tbody></table></div><div v-if="exports.length" class="export-history"><h4>最近导出</h4><div v-for="item in exports" :key="item.id"><span>{{ item.name }}</span><span>{{ stateText(item.state) }}</span><a v-if="item.download_url" :href="item.download_url">下载</a></div></div></section>

    </template>
    <div v-if="taskOnly && loading && !modal" class="inventory-modal-mask"><section class="inventory-modal"><p>正在加载任务…</p></section></div>
    <div v-if="modal" class="inventory-modal-mask" @click.self="modal = ''"><section class="inventory-modal" :class="{ 'emergency-entry-modal': modal === 'emergency', 'quality-entry-modal': modal === 'quality', 'purchase-order-detail-modal': modal === 'order-detail', 'receipt-entry-modal': modal === 'receipt', 'inventory-modal-wide': ['plan','order','order-edit','order-detail','requisition-edit','requisition-detail','count-lines','count-review','receipt','receipt-edit','receipt-detail','inspection-detail','return-edit','return-detail'].includes(modal) }"><header><div><h3>{{ modal === 'emergency' ? '新建日常采购需求' : modal === 'requisition-edit' ? '编辑采购需求' : modal === 'plan' ? '生成采购需求单' : modal === 'order' ? '新增采购单' : modal === 'order-edit' ? (draft.resubmit ? '编辑退回采购单' : '编辑采购单') : modal === 'order-detail' ? '采购单详情' : modal === 'requisition-detail' ? '采购需求进展' : modal === 'receipt' ? '确认采购收货' : modal === 'receipt-edit' ? '确认采购收货' : modal === 'receipt-detail' ? '收货单详情' : modal === 'quality' ? '质检入库' : modal === 'inspection-detail' ? '质检单详情' : modal === 'return-edit' ? (draft.returnRecord ? '编辑退货单' : '新建退货单') : modal === 'return-detail' ? '退货单详情' : modal === 'count-create' ? '新建库存盘点' : modal === 'count-review' ? '盘点差异记录' : '录入盘点实数' }}</h3><p>{{ modal === 'emergency' ? '填写采购信息，创建后自动提交审核' : modal === 'order' ? '选择采购明细并逐行确认供应商，提交后按供应商与厂区自动拆单' : modal === 'order-edit' ? (draft.resubmit ? '修改退回内容并填写说明后重新进入审批' : '核对采购信息，保存后可直接正式下单') : modal === 'requisition-edit' ? '草稿或退回状态可以修改基本信息，并增加或删除原料明细' : modal === 'receipt' ? '确认后自动生成收货记录和待检单，无需再次确认到货' : modal === 'receipt-edit' ? '核对后直接确认收货，超收时自动提交审批' : modal === 'quality' ? '核对检验结果，确认后直接完成质检和入库' : modal === 'order-detail' ? '核对采购原料、数量与金额' : ['requisition-detail','receipt-detail','inspection-detail','return-detail'].includes(modal) ? '查看单据明细与审批记录' : modal === 'return-edit' ? '填写退货明细后保存或提交审批' : modal === 'plan' ? '按原料确认缺口与本次申请数量' : modal === 'count-review' ? '查看本次账面、实盘、差异原因及上次盘点结果' : '确认关键信息后继续' }}</p></div><button class="inventory-modal-close" type="button" @click="modal = ''">×</button></header><div class="inventory-modal-body">
      <template v-if="modal === 'emergency'">
        <div class="wide emergency-basic-grid"><label><span>收货厂区 <i>*</i></span><select v-model="draft.factory_id"><option value="">选择厂区</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>需求日期 <i>*</i></span><input v-model="draft.need_date" type="date" @click="openDatePicker"></label></div>
        <section class="wide emergency-materials"><header><div><h4>采购原料 <span>{{ draft.lines.filter(line => line.material_id).length }} 项</span></h4><p>按麦芽、酒花、酵母等分类选择商品，供应商随商品带入</p></div><button class="btn btn-xs btn-outline" type="button" :disabled="saving" @click="addEmergencyLine">＋ 添加原料</button></header>
          <div class="work-table-wrap"><table class="work-table emergency-material-table"><colgroup><col style="width:36%"><col style="width:26%"><col style="width:20%"><col style="width:8%"><col style="width:10%"></colgroup><thead><tr><th>原料</th><th>供应商 / 品牌 / 规格</th><th>需求数量</th><th>单位</th><th></th></tr></thead><tbody><tr v-for="(line,index) in draft.lines" :key="index"><td><ProcurementMaterialPicker :model-value="line.material_id" :materials="emergencyMaterials" :categories="materialCategories" :excluded-ids="draft.lines.filter((_, i) => i !== index).map(item => item.material_id).filter(Boolean)" :disabled="saving" @update:model-value="selectEmergencyMaterial(line, $event)" /></td><td><small v-if="materialFor(line.material_id)?.supplier?.name">{{ materialFor(line.material_id).supplier.name }}</small>{{ materialFor(line.material_id)?.brew_brand || '—' }}<small>{{ materialFor(line.material_id)?.brew_specification || '—' }}</small></td><td><input v-model.number="line.quantity" :aria-label="(materialFor(line.material_id)?.name || '原料') + '需求数量'" type="number" min="0.001" step="0.001" :disabled="!line.material_id || saving" placeholder="填写数量"></td><td>{{ materialFor(line.material_id)?.uom_id?.name || '—' }}</td><td><button class="emergency-remove" type="button" :disabled="saving" aria-label="移除此行原料" @click="draft.lines.splice(index, 1)">移除</button></td></tr><tr v-if="!draft.lines.length"><td colspan="5" class="inventory-empty">点击“添加原料”填写采购明细</td></tr></tbody></table></div>
        </section>
        <label class="wide emergency-reason"><span>采购原因 <i>*</i></span><textarea v-model.trim="draft.emergency_reason" rows="2" placeholder="说明本次采购用途或补货原因"></textarea></label>
        <div class="wide emergency-applicant">申请人 <strong>{{ currentUser.name || currentUser.display_name || '—' }}</strong><span>请核对原料与数量后创建采购需求</span></div>
      </template>
      <template v-else-if="modal === 'requisition-edit'"><label><span>建议供应商</span><select v-model="draft.supplier_id"><option value="">不指定</option><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>厂区</span><select v-model="draft.factory_id" :disabled="draft.requisition.lines.some(line => line.allocations?.length)"><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>需求日期</span><input v-model="draft.need_date" type="date" @click="openDatePicker"></label><label><span>来源</span><input :value="requestType(draft.requisition)" readonly></label><label v-if="draft.requisition.request_type === 'emergency'" class="wide"><span>采购原因</span><textarea v-model.trim="draft.emergency_reason" rows="2"></textarea></label><label class="wide"><span>申请说明</span><textarea v-model.trim="draft.reason" rows="2"></textarea></label><div class="wide modal-lines"><div class="modal-lines-head"><div><strong>采购需求明细</strong><small>可新增原料或删除不再需要的明细</small></div><button class="btn btn-xs btn-outline" type="button" @click="addRequisitionEditLine">添加一行</button></div><div v-for="(line,index) in draft.lines" :key="line.id || index" class="modal-line requisition-edit-line"><select v-model="line.material_id"><option value="">选择原料</option><option v-for="item in requisitionEditMaterials" :key="item.id" :value="item.id">{{ item.name }} · {{ item.brew_brand || '无品牌' }} · {{ item.brew_specification || '无规格' }}</option></select><input v-model.number="line.quantity" type="number" min="0.001" step="0.001" placeholder="数量"><span>{{ materialFor(line.material_id)?.uom_id?.name || '单位' }}</span><button class="btn btn-xs btn-danger" type="button" @click="removeRequisitionEditLine(index)">删除</button></div><div v-if="!draft.lines.length" class="inventory-empty">请至少添加一条采购需求明细</div></div></template>
      <template v-else-if="modal === 'plan'">
        <label><span>需求日期</span><input v-model="draft.need_date" type="date" @click="openDatePicker"></label>
        <label><span>申请说明</span><input v-model.trim="draft.reason"></label>
        <p class="wide shortage-confirm-note">已选 {{ selectedShortageDemandCount }} 个需求、{{ selectedShortagePlanCount }} 个生产计划。可按原料调整本次申请量；超过缺口的部分作为本厂备货。</p>
        <section v-for="group in draftShortageFactoryGroups" :key="group.factory.id" class="wide shortage-confirm-group">
          <h4><span>{{ group.factory.name }}</span><small>{{ group.plans.size }} 个生产计划 · {{ group.items.length }} 项原料</small></h4>
          <div class="shortage-confirm-list">
            <div class="shortage-confirm-head"><span>原料 / 来源</span><span>当前缺口</span><span>本次申请</span></div>
            <div v-for="item in group.items" :key="item.request_key" class="shortage-confirm-row">
              <div class="shortage-confirm-material"><strong>{{ item.product?.name }}</strong><small>{{ item.plan.demand ? '产品需求 ' + item.plan.demand.name + ' · ' : '' }}{{ item.plan.product?.name }}</small></div>
              <div class="shortage-confirm-gap"><strong>{{ number(item.shortage,3) }} {{ item.uom }}</strong><small v-if="Number(item.requestable_qty) < Number(item.shortage) - 1e-9">剩余可申请 {{ number(item.requestable_qty,3) }} {{ item.uom }}</small></div>
              <label class="shortage-confirm-quantity"><input v-model.number="item.requested_qty" type="number" min="0.001" step="any" :aria-label="item.product?.name + '本次申请数量'"><span>{{ item.uom }}</span></label>
            </div>
          </div>
        </section>
      </template>
      <template v-else-if="modal === 'order'">
        <div class="wide purchase-basic-grid"><label><span>下单人</span><input :value="currentUser.name || currentUser.display_name || '-'" readonly></label><label><span>下单日期</span><input v-model="draft.order_date" type="date" @click="openDatePicker"></label><label><span>预期到货日期</span><input v-model="draft.expected_arrival_date" type="date" @click="openDatePicker"></label><div class="purchase-split-note"><span>预计生成</span><strong>{{ purchaseOrderGroups.length }} 张采购单</strong><small>按供应商、收货厂区和采购类型自动拆分</small></div></div>
        <div class="wide purchase-selection-summary"><span>已选 {{ selectedPurchaseLines.length }} 项明细</span></div>
        <div class="wide work-table-wrap purchase-line-picker"><table class="work-table"><thead><tr><th>选择</th><th>原料信息</th><th>采购需求 / 厂区</th><th>供应商</th><th>品牌 / 包装</th><th>采购数量</th><th>件数</th><th>采购单价</th><th>采购金额</th><th>操作</th></tr></thead><tbody><tr v-for="line in draft.lines" :key="line.id"><td><input v-model="line.selected" type="checkbox"></td><td><strong>{{ line.product?.name }}</strong><small>{{ line.material?.default_code || '-' }}</small></td><td>{{ line.requisition_name }}<small>{{ line.factory?.name || '-' }} · {{ requestType({ request_type: line.request_type }) }}</small></td><td><select v-model="line.supplier_id"><option value="">选择供应商</option><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select></td><td>{{ line.material?.brew_brand || '-' }}<small>{{ line.package_spec }}</small></td><td><div class="purchase-input-unit"><input v-model.number="line.quantity" type="number" min="0.001" step="0.001"><span>{{ line.uom?.name }}</span></div></td><td><input v-model.number="line.package_count" type="number" min="1" step="1"></td><td><div class="purchase-input-unit"><input v-model.number="line.price_unit" type="number" min="0" step="0.01"><span>元</span></div></td><td><strong>{{ formatMoney(Number(line.quantity || 0) * Number(line.price_unit || 0)) }}</strong></td><td><button class="btn btn-xs btn-danger" type="button" @click="removeOrderLine(line.id)">删除</button></td></tr><tr v-if="!draft.lines.length"><td colspan="10" class="inventory-empty">没有可下单的已审批采购需求明细</td></tr></tbody></table></div>
        <div v-if="purchaseOrderGroups.length" class="wide purchase-split-summary"><div v-for="group in purchaseOrderGroups" :key="group.key"><strong>{{ group.supplier?.name || '未选择供应商' }}</strong><span>{{ group.factory?.name || '-' }} · {{ group.count }} 项 · ¥{{ number(group.amount) }}</span></div></div>
        <div class="wide purchase-total"><span>采购总金额</span><strong>¥{{ number(purchaseOrderTotal) }}</strong></div>
      </template>
      <template v-else-if="modal === 'order-edit'">
        <div class="wide purchase-basic-grid"><label><span>供应商</span><select v-model="draft.supplier_id"><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>收货工厂</span><input :value="draft.order.factory?.name || '-'" readonly></label><label><span>下单日期</span><input v-model="draft.order_date" type="date" @click="openDatePicker"></label><label><span>预期到货日期</span><input v-model="draft.expected_arrival_date" type="date" @click="openDatePicker"></label></div>
        <div class="wide order-edit-add">
          <button class="btn btn-sm btn-outline" type="button" :aria-expanded="!!draft.order_edit_picker_open" aria-controls="order-edit-candidates" @click="draft.order_edit_picker_open = !draft.order_edit_picker_open">{{ draft.order_edit_picker_open ? '取消添加' : '＋ 添加明细' }}</button>
          <section v-if="draft.order_edit_picker_open" id="order-edit-candidates" class="order-edit-candidates" aria-label="选择采购需求明细">
            <p>选择已批准的采购需求，添加到当前采购单。</p>
            <div v-for="item in availableOrderEditLines" :key="item.id" class="order-edit-candidate">
              <div><strong>{{ item.product?.name }}</strong><small>{{ item.requisition_name }} · 可下单 {{ number(item.available_qty,3) }} {{ item.uom?.name }}</small></div>
              <button class="btn btn-sm btn-outline" type="button" :aria-label="'添加 ' + item.product?.name" @click="addOrderEditLine(item.id)">添加</button>
            </div>
            <p v-if="!availableOrderEditLines.length" class="inventory-empty">暂无可添加的需求明细</p>
          </section>
        </div>
        <div class="wide work-table-wrap purchase-line-picker"><table class="work-table"><thead><tr><th>原料</th><th>采购数量</th><th>包装</th><th>件数</th><th>采购单价</th><th>采购金额</th><th>操作</th></tr></thead><tbody><tr v-for="(line,index) in draft.lines" :key="line.id || line.key"><td><strong>{{ line.product?.name }}</strong><small>{{ line.product?.brand || '-' }}</small></td><td><div class="purchase-input-unit"><input v-model.number="line.quantity" type="number" min="0.001" step="0.001"><span>{{ line.uom?.name }}</span></div></td><td><input v-model.trim="line.package_spec"></td><td><input v-model.number="line.package_count" type="number" min="1" step="1"></td><td><div class="purchase-input-unit"><input v-model.number="line.price_unit" type="number" min="0" step="0.01"><span>元</span></div></td><td><strong>{{ formatMoney(Number(line.quantity || 0) * Number(line.price_unit || 0)) }}</strong></td><td><button class="btn btn-xs btn-danger" type="button" @click="removeOrderEditLine(index)">删除</button></td></tr><tr v-if="!draft.lines.length"><td colspan="7" class="inventory-empty">请至少添加一条采购订单明细</td></tr></tbody></table></div>
        <label v-if="draft.resubmit" class="wide"><span>修改及再次提交说明</span><textarea v-model.trim="draft.resubmit_note" rows="3" placeholder="说明本次修改内容"></textarea></label>
      </template>
      <template v-else-if="modal === 'order-detail'">
        <div class="wide purchase-order-heading"><div><span>采购单号</span><strong>{{ draft.order.name }}</strong></div><div class="purchase-order-status"><span class="state-pill" :data-state="draft.order.approval_state">{{ stateText(draft.order.approval_state) }}</span><span class="state-pill" :data-state="draft.order.receipt_state">{{ receiptStateText(draft.order.receipt_state) }}</span><button v-if="canPurchase && ['none','returned'].includes(draft.order.approval_state) && ['draft','sent'].includes(draft.order.state)" class="btn btn-sm btn-outline" type="button" @click="openOrderEdit(draft.order)">{{ draft.order.approval_state === 'returned' ? '编辑并重新提交' : '编辑采购单' }}</button></div></div>
        <div class="wide purchase-order-facts"><div><span>供应商</span><strong>{{ draft.order.supplier?.name || '-' }}</strong></div><div><span>收货工厂</span><strong>{{ draft.order.factory?.name || '-' }}</strong></div><div><span>下单日期</span><strong>{{ dateTime(draft.order.order_date) }}</strong></div><div><span>预计到货</span><strong>{{ draft.order.expected_arrival_date || '-' }}</strong></div></div>
        <p v-if="draft.order.approval_return_reason" class="wide master-error">退回原因：{{ draft.order.approval_return_reason }}</p>
        <section class="wide order-detail-block purchase-order-items">
          <header><h4>采购单明细</h4><span>{{ draft.order.lines.length }} 项原料</span></header>
          <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>原料</th><th>品牌</th><th>包装 / 件数</th><th>采购数量</th><th>采购单价</th><th>采购金额</th><th>预计到货</th></tr></thead><tbody>
            <tr v-for="(line,index) in draft.order.lines" :key="line.id"><td>{{ index + 1 }}</td><td><strong>{{ line.product?.name }}</strong></td><td>{{ line.product?.brand || '-' }}</td><td>{{ line.package_spec || line.product?.specification || '-' }}<small>{{ number(line.package_count,0) }} 件</small></td><td><strong>{{ number(line.quantity,3) }} {{ line.uom?.name }}</strong></td><td>{{ formatMoney(line.price_unit, draft.order.currency) }}</td><td class="purchase-order-line-amount">{{ formatMoney(line.subtotal, draft.order.currency) }}</td><td>{{ dateTime(line.planned_date) }}</td></tr>
          </tbody></table></div>
          <div class="purchase-order-total"><span>采购合计</span><strong>{{ formatMoney(draft.order.amount_total, draft.order.currency) }}</strong></div>
        </section>
        <section v-if="draft.order.receipts?.length || draft.order.returns?.length" class="wide purchase-order-progress">
          <h4>收货与入库进度</h4>
          <div v-for="receipt in draft.order.receipts" :key="receipt.id" class="purchase-order-progress-row"><button class="record-link" type="button" @click="openReceiptDetail(receipt)">{{ receipt.name }}</button><span>{{ receipt.state === 'done' ? '已入库' : stateText(receipt.state) }}</span><button v-if="receipt.inspection_id" class="record-link" type="button" @click="openInspectionDetail({ id: receipt.inspection_id })">{{ receipt.inspection_name }} · {{ inspectionStateText(receipt.inspection_state) }}</button><small>{{ receipt.completed_at ? dateTime(receipt.completed_at) : '' }}</small></div>
          <div v-for="returnRecord in draft.order.returns" :key="'return-' + returnRecord.id" class="purchase-order-progress-row"><button class="record-link" type="button" @click="openReturnDetail(returnRecord)">{{ returnRecord.name }}</button><span>{{ returnRecord.state === 'done' ? '已退货出库' : stateText(returnRecord.state) }}</span></div>
        </section>
      </template>
      <template v-else-if="modal === 'requisition-detail'">
        <div class="wide order-detail-summary"><div><span>采购需求单</span><strong>{{ draft.requisition.name }}</strong></div><div><span>来源</span><strong>{{ requestType(draft.requisition) }}</strong><small>{{ draft.requisition.emergency_reason || draft.requisition.reason || '-' }}</small></div><div><span>申请人 / 厂区</span><strong>{{ draft.requisition.requester?.name || '-' }}</strong><small>{{ draft.requisition.factory?.name || '-' }}</small></div><div><span>需求日期</span><strong>{{ draft.requisition.need_date || '-' }}</strong></div><div><span>建议供应商</span><strong>{{ draft.requisition.preferred_supplier?.name || '未指定' }}</strong></div><div><span>当前状态</span><strong>{{ stateText(draft.requisition.state) }}</strong><small v-if="draft.requisition.return_reason">退回：{{ draft.requisition.return_reason }}</small></div><div><span>关联采购单</span><strong>{{ draft.requisition.orders?.length || 0 }} 张</strong></div><div><span>未下单明细</span><strong>{{ draft.requisition.lines.filter(line => remaining(line) > 0).length }} 项</strong></div></div>
        <button v-if="canRequestRequisition && ['draft','returned'].includes(draft.requisition.state)" class="btn btn-sm btn-primary wide" type="button" @click="openRequisitionEdit(draft.requisition)">编辑采购需求</button>
        <div v-if="requisitionApprovalTask && !requisitionReviewing" class="wide requisition-review-entry"><span>当前审批环节：{{ approvalRoleText(requisitionApprovalTask.role_code) }}</span><button class="btn btn-sm btn-primary" type="button" @click="requisitionReviewing = true; modalError = ''">审核</button></div>
        <section v-if="requisitionApprovalTask && requisitionReviewing" class="wide order-detail-block requisition-review-panel"><label><span>审批意见 <small>退回时必填</small></span><textarea v-model.trim="requisitionReviewComment" rows="3" placeholder="填写审批意见或退回原因"></textarea></label><div class="detail-actions"><button class="btn btn-sm btn-outline" type="button" :disabled="saving" @click="requisitionReviewing = false">取消</button><button class="btn btn-sm btn-outline" type="button" :disabled="saving" @click="resolveRequisitionApproval('return')">退回</button><button class="btn btn-sm btn-primary" type="button" :disabled="saving" @click="resolveRequisitionApproval('approve')">{{ saving ? '处理中…' : '审批通过' }}</button></div></section>
        <section class="wide order-detail-block"><header><h4>采购需求明细</h4><span>{{ draft.requisition.lines.length }} 项</span></header>
          <div class="work-table-wrap"><table class="work-table requisition-detail-table"><thead><tr><th>原料</th><th>生产来源</th><th>缺口数量</th><th>本次申请</th><th>已批准</th><th>已转采购单</th><th>待转采购单</th></tr></thead><tbody>
            <tr v-for="line in draft.requisition.lines" :key="line.id"><td><strong>{{ line.product?.name }}</strong></td>
              <td><div v-if="line.allocations?.length" class="requisition-source-list"><button v-for="allocation in line.allocations" :key="allocation.plan_id" class="record-link" type="button" @click="selectedPlanId = allocation.plan_id">{{ allocation.product_name || '查看生产计划' }}<small>{{ allocation.demand_name ? '产品需求 ' + allocation.demand_name + ' · ' : '' }}查看生产计划 →</small></button></div><span v-else>日常采购</span></td>
              <td>{{ line.allocations?.length ? quantity(line.allocations.reduce((sum, item) => sum + Number(item.source_shortage_qty || item.shortage_qty || 0), 0)) + ' ' + line.uom?.name : '—' }}</td>
              <td><strong>{{ quantity(line.requested_qty) }} {{ line.uom?.name }}</strong><small v-if="line.allocations?.length > 1" class="requisition-allocations-note">{{ line.allocations.map(item => (item.product_name || '生产计划') + ' ' + quantity(item.shortage_qty) + ' ' + line.uom?.name).join(' · ') }}</small></td>
              <td>{{ quantity(line.approved_qty) }} {{ line.uom?.name }}</td><td>{{ quantity(line.ordered_qty) }} {{ line.uom?.name }}</td><td><strong>{{ quantity(remaining(line)) }} {{ line.uom?.name }}</strong></td>
            </tr>
          </tbody></table></div>
        </section>
        <section v-if="draft.requisition.orders?.length" class="wide order-detail-block"><header><h4>关联采购单</h4><span>{{ draft.requisition.orders.length }} 张</span></header><div class="linked-orders"><button v-for="order in draft.requisition.orders" :key="order.id" type="button" @click="openOrderDetail(order)"><strong>{{ order.name }}</strong><span>{{ order.supplier?.name || '-' }}</span><small>审批 {{ stateText(order.approval_state) }} · {{ receiptStateText(order.receipt_state) }}</small></button></div></section>
        <section class="wide order-detail-block"><header><h4>完整审批流水</h4><span>{{ stateText(draft.requisition.state) }}</span></header><div v-if="draft.requisition.approval_history?.length" class="approval-timeline"><div v-for="(step,index) in draft.requisition.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div><div v-else class="inventory-empty">采购需求尚未提交审批</div></section>
      </template>
      <template v-else-if="modal === 'receipt'">
        <div class="wide receipt-entry-context"><div><span>采购订单</span><strong>{{ draft.order.name }}</strong></div><div><span>供应商</span><strong>{{ draft.order.supplier?.name || '—' }}</strong></div><div><span>收货厂区</span><strong>{{ draft.order.factory?.name || '未设置' }}</strong></div><div><span>收货明细</span><strong>{{ draft.lines.length }} 项商品</strong></div></div>
        <label v-if="locations.filter(x => String(x.brew_factory_id?.id || '') === String(draft.order.factory?.id || '') && x.brew_location_type === 'qc').length !== 1" class="wide"><span>待检库位</span><select v-model="draft.qc_location_id"><option value="">{{ locations.some(x => String(x.brew_factory_id?.id || '') === String(draft.order.factory?.id || '') && x.brew_location_type === 'qc') ? '请选择待检库位' : '该厂区未配置待检库位' }}</option><option v-for="item in locations.filter(x => String(x.brew_factory_id?.id || '') === String(draft.order.factory?.id || '') && x.brew_location_type === 'qc')" :key="item.id" :value="item.id">{{ locationLabel(item) }}</option></select></label>
        <div class="wide receipt-entry-lines">
          <div class="modal-lines-head"><div><strong>本次收货明细</strong></div></div>
          <div class="work-table-wrap"><table class="work-table receipt-entry-table">
            <colgroup><col class="receipt-col-product"><col class="receipt-col-quantity"><col class="receipt-col-quantity"><col class="receipt-col-actual"><col class="receipt-col-location"><col class="receipt-col-lot"><col class="receipt-col-expiry"></colgroup>
            <thead><tr><th>原料</th><th>订购数量</th><th>已收数量</th><th>本次实收</th><th>入库库位</th><th>供应商批号</th><th>有效期（选填）</th></tr></thead>
            <tbody><tr v-for="line in draft.lines" :key="line.id">
              <td><strong>{{ line.product?.name }}</strong><small v-if="line.product?.brand">{{ line.product.brand }}</small></td>
              <td>{{ number(line.quantity,3) }} {{ line.uom?.name }}</td>
              <td>{{ number(line.prior_received_qty,3) }} {{ line.uom?.name }}</td>
              <td><input v-model.number="line.received_qty" :aria-label="line.product?.name + '本次实收'" type="number" min="0" :max="line.remaining_receipt_qty" step="0.001" placeholder="实收数量"></td>
              <td><WarehouseLocationPicker :warehouses="warehouses.filter(x => String(x.brew_factory_id?.id || '') === String(draft.order.factory?.id || '') && !['qc', 'material_issue', 'tank'].includes(x.brew_warehouse_type))" v-model="line.destination_location_id" :locations="locations.filter(x => String(x.brew_factory_id?.id || '') === String(draft.order.factory?.id || '') && !['qc', 'material_issue'].includes(x.brew_location_type) && x.usage === 'internal')" /></td>
              <td><input v-model.trim="line.supplier_lot" :aria-label="line.product?.name + '供应商批号'" placeholder="选填"></td>
              <td><div class="receipt-expiry-field" :class="{empty: !line.expiration_date}"><input v-model="line.expiration_date" :aria-label="line.product?.name + '有效期，留空表示无有效期'" type="date" @click="openDatePicker"><span v-if="!line.expiration_date" class="receipt-expiry-placeholder">无有效期</span><button v-else class="receipt-expiry-clear" type="button" aria-label="清除有效期" title="清除有效期" @click="line.expiration_date=''">×</button></div></td>
            </tr></tbody>
          </table></div>
        </div>
      </template>
      <template v-else-if="modal === 'receipt-edit'">
        <div class="wide order-detail-summary"><div><span>收货单号</span><strong>{{ draft.receipt.name }}</strong></div><div><span>采购订单</span><strong>{{ draft.order.name }}</strong></div><div><span>供应商</span><strong>{{ draft.receipt.supplier?.name || '-' }}</strong></div><div><span>当前状态</span><strong>{{ stateText(draft.receipt.state) }}</strong></div></div>
        <label><span>待检库位</span><select v-model="draft.qc_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => String(x.brew_factory_id?.id || '') === String(draft.receipt.factory?.id || '') && x.brew_location_type === 'qc')" :key="item.id" :value="item.id">{{ locationLabel(item) }}</option></select></label>
        <div class="wide receipt-location-field"><span>默认入库库位</span><WarehouseLocationPicker :warehouses="warehouses.filter(x => String(x.brew_factory_id?.id || '') === String(draft.order.factory?.id || '') && !['qc', 'material_issue', 'tank'].includes(x.brew_warehouse_type))" v-model="draft.destination_location_id" :locations="locations.filter(x => String(x.brew_factory_id?.id || '') === String(draft.receipt.factory?.id || '') && !['qc', 'material_issue'].includes(x.brew_location_type) && x.usage === 'internal')" /></div>
        <label class="wide"><span>收货备注</span><textarea v-model.trim="draft.note" rows="2" placeholder="填写本次修改说明（选填）"></textarea></label>
        <div class="wide modal-lines">
          <div class="modal-lines-head"><div><strong>收货明细</strong><small>可逐项修改入库库位、数量、批号和有效期</small></div><div><button class="btn btn-xs btn-outline" type="button" @click="applyDefaultReceiptLocation">应用默认库位</button><button class="btn btn-xs btn-outline" type="button" @click="addReceiptEditLine">添加一行</button></div></div>
          <div class="work-table-wrap"><table class="work-table"><thead><tr><th>原料</th><th>订购数量</th><th>本次实收</th><th>入库库位</th><th>内部批次</th><th>供应商批号</th><th>有效期</th><th>操作</th></tr></thead><tbody>
            <tr v-for="(line,index) in draft.lines" :key="line.id || index"><td><select v-model="line.order_line_id"><option v-for="orderLine in draft.order.lines" :key="orderLine.id" :value="orderLine.id" :disabled="draft.lines.some((other,otherIndex) => otherIndex !== index && String(other.order_line_id) === String(orderLine.id))">{{ orderLine.product?.name }} · {{ orderLine.product?.brand || '无品牌' }}</option></select></td><td>{{ number(receiptOrderLine(line.order_line_id)?.quantity || 0,3) }} {{ receiptOrderLine(line.order_line_id)?.uom?.name || '' }}</td><td><input v-model.number="line.received_qty" type="number" min="0.001" step="0.001"></td><td><WarehouseLocationPicker :warehouses="warehouses.filter(x => String(x.brew_factory_id?.id || '') === String(draft.order.factory?.id || '') && !['qc', 'material_issue', 'tank'].includes(x.brew_warehouse_type))" v-model="line.destination_location_id" :locations="locations.filter(x => String(x.brew_factory_id?.id || '') === String(draft.receipt.factory?.id || '') && !['qc', 'material_issue'].includes(x.brew_location_type) && x.usage === 'internal')" /></td><td><input :value="line.lot_name" readonly title="内部批次由系统生成"></td><td><input v-model.trim="line.supplier_lot" placeholder="无则留空"></td><td><div class="receipt-expiry-field" :class="{empty: !line.expiration_date}"><input v-model="line.expiration_date" :aria-label="line.product?.name + '有效期，留空表示无有效期'" type="date" @click="openDatePicker"><span v-if="!line.expiration_date" class="receipt-expiry-placeholder">无有效期</span><button v-else class="receipt-expiry-clear" type="button" aria-label="清除有效期" title="清除有效期" @click="line.expiration_date=''">×</button></div></td><td><button class="btn btn-xs btn-danger" type="button" @click="removeReceiptEditLine(index)">删除</button></td></tr>
            <tr v-if="!draft.lines.length"><td colspan="8" class="inventory-empty">请至少保留一条收货明细</td></tr>
          </tbody></table></div>
        </div>
      </template>
      <template v-else-if="modal === 'quality'">
        <div class="wide quality-entry-context"><div><span>供应商</span><strong>{{ draft.inspection.supplier?.name || '-' }}</strong></div><div><span>收货单</span><strong>{{ draft.inspection.receipt_name || '-' }}</strong></div><div><span>质检单</span><strong>{{ draft.inspection.name }}</strong></div></div>
        <p v-if="draft.inspection.return_reason" class="wide master-error">上次退回：{{ draft.inspection.return_reason }}</p>
        <section class="wide quality-entry-detail">
          <header><div><h4>检验明细 <span>{{ draft.lines.length }} 项</span></h4><p>核对合格与不合格数量；处置方式仅对不合格数量生效</p></div><button class="btn btn-xs btn-outline" type="button" :disabled="saving" @click="markQualityAllQualified">全部合格</button></header>
          <div class="work-table-wrap"><table class="work-table quality-entry-table"><colgroup><col style="width:29%"><col style="width:13%"><col style="width:18%"><col style="width:18%"><col style="width:22%"></colgroup><thead><tr><th>原料 / 批次</th><th>待检数量</th><th>合格数量</th><th>不合格数量</th><th>不合格处置</th></tr></thead><tbody>
            <tr v-for="line in draft.lines" :key="line.id"><td><strong>{{ line.product?.name }}</strong><small>{{ line.lot?.name }}</small></td><td class="quality-entry-inspected">{{ number(line.inspected_qty,3) }} {{ line.uom?.name }}</td><td><div class="quality-entry-quantity"><input :value="line.qualified_qty" @input="syncQualityQuantity(line, 'qualified_qty', $event.target.value)" :aria-label="line.product?.name + '合格数量'" type="number" min="0" :max="line.inspected_qty" step="0.001"><span>{{ line.uom?.name }}</span></div></td><td><div class="quality-entry-quantity" :class="{ rejected: Number(line.rejected_qty) > 0 }"><input :value="line.rejected_qty" @input="syncQualityQuantity(line, 'rejected_qty', $event.target.value)" :aria-label="line.product?.name + '不合格数量'" type="number" min="0" :max="line.inspected_qty" step="0.001"><span>{{ line.uom?.name }}</span></div></td><td><select v-model="line.disposition" :aria-label="line.product?.name + '不合格处置'" :class="{ 'quality-entry-disposition-required': Number(line.rejected_qty) > 0 && !line.disposition }"><option value="">{{ Number(line.rejected_qty) > 0 ? '请选择处置方式' : '合格，无需处置' }}</option><option value="return">退回供应商</option><option value="scrap">报损</option></select></td></tr>
          </tbody></table></div>
          <div class="quality-entry-summary"><div><span>本次合格入库</span><strong>{{ qualitySummary.qualified }}</strong></div><div v-if="qualitySummary.hasRejected" class="quality-entry-rejected"><span>不合格待处置</span><strong>{{ qualitySummary.rejected }}</strong></div></div>
        </section>
        <label class="wide quality-entry-note"><span>质检备注 <small>选填</small></span><textarea v-model.trim="draft.note" rows="2" placeholder="填写外观、包装或检验情况等备注"></textarea></label>
      </template>
      <template v-else-if="modal === 'receipt-detail' && selectedReceiptGroup">
        <div class="wide receipt-detail-panel">
          <div class="receipt-detail-summary">
            <div><span>供应商 / 仓库</span><strong>{{ selectedReceiptGroup.supplier?.name || '-' }} · {{ selectedReceiptGroup.factory?.name || '-' }}</strong></div>
            <div><span>订单收货进度</span><strong>{{ receiptStateText(receiptGroupProgress(selectedReceiptGroup)) }}</strong></div>
            <div><span>已确认收货量</span><strong>{{ receiptGroupQuantitySummary(selectedReceiptGroup) }}</strong></div>
          </div>
          <div class="receipt-detail-heading"><strong>收货单</strong><span>{{ selectedReceiptGroup.receipts.length }} 张</span></div>
          <div v-for="item in selectedReceiptGroup.receipts" :key="item.id" class="receipt-detail-row">
            <div class="receipt-detail-document"><button class="record-link record-link-main" type="button" @click="openReceiptDetail(item)">{{ item.name }}</button><small>制单人：{{ item.creator || '-' }}</small></div>
            <div class="receipt-detail-quantity"><strong>{{ number(item.total_received,3) }}</strong><small>合格 {{ number(item.total_qualified,3) }} · 不合格 {{ number(item.total_rejected,3) }}</small></div>
            <div class="receipt-detail-time"><strong>{{ dateTime(item.create_date) }}</strong><small>收货时间</small></div>
            <div class="receipt-detail-state"><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span><small v-if="item.return_reason">退回：{{ item.return_reason }}</small></div>
            <div class="receipt-detail-actions">
              <button v-if="canWarehouse && (item.state === 'draft' || (item.state === 'pending_approval' && item.approval_state === 'returned'))" class="btn btn-xs btn-outline" @click="openReceiptEdit(item)">{{ item.state === 'draft' ? '继续收货' : '修改并重新提交' }}</button>
              <button v-if="canWarehouse && item.state === 'inspected'" class="btn btn-xs btn-primary" @click="receiptAction(item,'put-away')">完成入库</button>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="modal === 'receipt-detail'">
        <div class="wide order-detail-summary">
          <div><span>收货单号</span><strong>{{ draft.receipt.name }}</strong></div>
          <div><span>供应商</span><strong>{{ draft.receipt.supplier?.name || '-' }}</strong><small>{{ draft.receipt.supplier?.code || '' }}</small></div>
          <div><span>收货仓库</span><strong>{{ draft.receipt.factory?.name || '-' }}</strong></div>
          <div><span>采购订单号</span><button v-if="draft.receipt.purchase_order" class="record-link record-link-main" type="button" @click="openOrderDetail(draft.receipt.purchase_order)">{{ draft.receipt.purchase_order.name }}</button><span v-else>-</span></div>
          <div><span>制单日期</span><strong>{{ dateTime(draft.receipt.create_date) }}</strong></div>
          <div><span>操作员</span><strong>{{ draft.receipt.creator || '-' }}</strong></div>
          <div><span>审批状态</span><strong>{{ stateText(draft.receipt.state) }}</strong></div>
          <div><span>最后修改</span><strong>{{ dateTime(draft.receipt.write_date) }}</strong></div>
        </div>
        <section v-if="draft.receipt.return_reason" class="wide order-detail-block"><header><h4>退回原因</h4></header><p style="color:#ef5350">{{ draft.receipt.return_reason }}</p></section>
        <section class="wide order-detail-block">
          <header><h4>质检与入库批次</h4><span>{{ draft.receipt.state === 'done' ? '已入库 · ' + dateTime(draft.receipt.completed_at) : stateText(draft.receipt.state) }}</span></header>
          <div class="linked-orders">
            <button v-if="draft.receipt.quality_inspection_id" type="button" @click="openInspectionDetail({ id: draft.receipt.quality_inspection_id })"><strong>查看关联质检单</strong><small>合格 {{ number(draft.receipt.total_qualified,3) }} / 不合格 {{ number(draft.receipt.total_rejected,3) }}</small></button>
            <button v-for="line in draft.receipt.lines.filter(item => item.lot_id)" :key="line.id" type="button" @click="openLotDetail(line.lot_id)"><strong>{{ line.lot_name }}</strong><span>{{ line.product?.name }}</span><small>查看批次库存及出入库记录</small></button>
          </div>
          <p v-if="!draft.receipt.quality_inspection_id && !draft.receipt.lines.some(line => line.lot_id)" class="inventory-empty">确认收货后自动生成库存批次和待检单</p>
        </section>
        <section class="wide order-detail-block"><header><h4>收货明细</h4><span>{{ draft.receipt.lines?.length || 0 }} 项</span></header>
          <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>原料信息</th><th>包装单位</th><th>采购件数</th><th>已收货件数</th><th>合格件数</th><th>不合格件数</th><th>目标库位</th><th>当前库存</th><th>已退件数</th><th>可退件数</th><th>有效期</th><th>规格批号</th></tr></thead><tbody>
            <tr v-for="(line,index) in draft.receipt.lines" :key="line.id"><td>{{ index + 1 }}</td><td><strong>{{ line.product?.name }}</strong><small>{{ line.product?.brand || '-' }} · {{ line.product?.specification || '-' }}</small></td><td>{{ line.uom?.name || '-' }}<small>{{ line.package_spec || '' }}</small></td><td>{{ number(line.ordered_qty,3) }}</td><td>{{ number(line.received_qty,3) }}</td><td>{{ number(line.qualified_qty,3) }}</td><td>{{ number(line.rejected_qty,3) }}</td><td>{{ locationLabel(line.destination_location || draft.receipt.destination_location, '-') }}</td><td>{{ number(line.stock_available_qty || 0,3) }}</td><td>{{ number(line.returned_qty || 0,3) }}</td><td>{{ number(line.returnable_qty || 0,3) }}</td><td>{{ line.expiration_date || '-' }}</td><td>{{ line.supplier_lot || '-' }}</td></tr>
          </tbody></table></div>
          <div class="purchase-total"><span>本次到货总件数</span><strong>{{ number(draft.receipt.total_received,3) }}</strong><span>合格</span><strong>{{ number(draft.receipt.total_qualified,3) }}</strong><span>不合格</span><strong>{{ number(draft.receipt.total_rejected,3) }}</strong></div>
        </section>
        <section v-if="draft.receipt.approval_history?.length" class="wide order-detail-block"><header><h4>审批流程</h4><span>{{ stateText(draft.receipt.state) }}</span></header>
          <div class="approval-timeline"><div v-for="(step,index) in draft.receipt.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div>
        </section>
      </template>
      <template v-else-if="modal === 'inspection-detail'">
        <div class="wide order-detail-summary">
          <div><span>质检单号</span><strong>{{ draft.inspectionDetail.name }}</strong></div>
          <div><span>收货单号</span><button v-if="draft.inspectionDetail.receipt_id" class="record-link record-link-main" type="button" @click="openReceiptDetail({ id: draft.inspectionDetail.receipt_id })">{{ draft.inspectionDetail.receipt_name }}</button><span v-else>-</span></div>
          <div><span>采购订单</span><button v-if="draft.inspectionDetail.purchase_order" class="record-link record-link-main" type="button" @click="openOrderDetail(draft.inspectionDetail.purchase_order)">{{ draft.inspectionDetail.purchase_order.name }}</button><span v-else>-</span></div>
          <div><span>供应商</span><strong>{{ draft.inspectionDetail.supplier?.name || '-' }}</strong></div>
          <div><span>检验员</span><strong>{{ draft.inspectionDetail.inspector?.name || '-' }}</strong></div>
          <div><span>检验时间</span><strong>{{ dateTime(draft.inspectionDetail.inspected_at) }}</strong></div>
          <div><span>状态</span><strong>{{ inspectionStateText(draft.inspectionDetail.state) }}</strong></div>
          <div><span>制单人</span><strong>{{ draft.inspectionDetail.creator || '-' }}</strong></div>
        </div>
        <section class="wide order-detail-block"><header><h4>质检明细</h4><span>{{ draft.inspectionDetail.lines?.length || 0 }} 项</span></header>
          <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>原料信息</th><th>批次</th><th>待检数量</th><th>合格</th><th>不合格</th><th>处置</th><th>供应商批号</th><th>有效期</th></tr></thead><tbody>
            <tr v-for="(line,index) in draft.inspectionDetail.lines" :key="line.id"><td>{{ index + 1 }}</td><td><strong>{{ line.product?.name }}</strong><small>{{ line.product?.brand || '-' }}</small></td><td>{{ line.lot?.name || '-' }}</td><td>{{ number(line.inspected_qty,3) }} {{ line.uom?.name }}</td><td>{{ number(line.qualified_qty,3) }}</td><td>{{ number(line.rejected_qty,3) }}</td><td>{{ line.disposition === 'return' ? '退回供应商' : line.disposition === 'scrap' ? '报损' : '-' }}</td><td>{{ line.supplier_lot || '-' }}</td><td>{{ line.expiration_date || '-' }}</td></tr>
          </tbody></table></div>
          <div class="purchase-total"><span>总检验</span><strong>{{ number(draft.inspectionDetail.total_inspected,3) }}</strong><span>合格</span><strong>{{ number(draft.inspectionDetail.total_qualified,3) }}</strong><span>不合格</span><strong>{{ number(draft.inspectionDetail.total_rejected,3) }}</strong></div>
        </section>
        <section v-if="draft.inspectionDetail.note" class="wide order-detail-block"><header><h4>质检备注</h4></header><p>{{ draft.inspectionDetail.note }}</p></section>
        <section v-if="draft.inspectionDetail.return_reason" class="wide order-detail-block"><header><h4>退回原因</h4></header><p class="quality-return-reason">{{ draft.inspectionDetail.return_reason }}</p></section>
        <section v-if="draft.inspectionDetail.approval_history?.length" class="wide order-detail-block"><header><h4>历史审批记录</h4><span>{{ inspectionStateText(draft.inspectionDetail.state) }}</span></header><div v-if="draft.inspectionDetail.approval_history?.length" class="approval-timeline"><div v-for="(step,index) in draft.inspectionDetail.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div></section>
      </template>
      <template v-else-if="modal === 'return-edit'">
        <div class="wide order-detail-summary">
          <div><span>采购订单</span><strong><select v-model="draft.purchase_order_id" :disabled="!!draft.returnRecord" @change="onReturnOrderChange" style="background:#1a1a2e;color:#ddd;border:1px solid #333;border-radius:4px;padding:4px 8px;width:100%"><option value="">请选择已有收货或入库记录的采购订单</option><option v-for="item in returnableOrders" :key="item.id" :value="item.id">{{ item.name }} · {{ item.supplier?.name }} · {{ receiptStateText(item.receipt_state) }}</option></select></strong></div>
          <div><span>仓库</span><strong><select v-model="draft.factory_id" style="background:#1a1a2e;color:#ddd;border:1px solid #333;border-radius:4px;padding:4px 8px;width:100%"><option value="">请选择</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></strong></div>
        </div>
        <p v-if="!draft.returnRecord && !returnableOrders.length" class="wide inventory-empty">暂无可退采购订单。只有审批已通过、已收货或已入库，并且对应批次仍有可用库存的采购单会显示在这里。</p>
        <label class="wide"><span>退货原因</span><textarea v-model.trim="draft.return_reason" rows="2"></textarea></label>
        <label class="wide"><span>备注</span><textarea v-model.trim="draft.note" rows="2"></textarea></label>
        <div class="wide modal-lines">
          <div class="modal-lines-head"><div><strong>退货明细</strong><small>{{ draft.lines.length }} 项 · 总退货金额 ¥{{ number(draft.lines.reduce((s,l) => s + Number(l.return_qty||0) * Number(l.price_unit||0), 0)) }}</small></div></div>
          <div class="work-table-wrap"><table class="work-table"><thead><tr><th>选择</th><th>原料 / 库存批次</th><th>来源收货单</th><th>已收货</th><th>当前库存</th><th>已退货</th><th>可退数量</th><th>退货数量</th><th>单价</th><th>金额</th></tr></thead><tbody>
            <tr v-for="(line,index) in draft.lines" :key="line.id || index">
              <td class="return-line-checkbox-cell"><input v-model="line.selected" class="return-line-checkbox" type="checkbox" aria-label="选择退货明细"></td>
              <td><strong>{{ line.product_name || '-' }}</strong><small>{{ line.product_brand || '无品牌' }} · {{ line.lot_name || '无批次' }}</small></td>
              <td>{{ line._receipt_name || '-' }}</td>
              <td>{{ number(line._received_qty || 0, 3) }} {{ line.uom_name || '' }}</td>
              <td>{{ number(line._stock_available_qty || 0, 3) }}</td>
              <td>{{ number(line._returned_qty || 0, 3) }}</td>
              <td><strong>{{ number(line._returnable_qty || 0, 3) }}</strong></td>
              <td><label><input v-model.number="line.return_qty" type="number" min="0.001" :max="line._returnable_qty || 0" step="0.001" style="width:90px" :disabled="!line.selected" @input="line._returnable_qty && line.return_qty > line._returnable_qty ? line.return_qty = line._returnable_qty : null"></label></td>
              <td><label><input v-model.number="line.price_unit" type="number" min="0" step="0.01" style="width:80px" :readonly="!!line.id"></label></td>
              <td><strong>¥{{ number(Number(line.return_qty||0) * Number(line.price_unit||0)) }}</strong></td>
            </tr>
            <tr v-if="!draft.lines.length"><td colspan="10" class="inventory-empty">请选择采购订单；仅显示已入库且当前批次仍有可用库存的明细</td></tr>
          </tbody></table></div>
        </div>
      </template>
      <template v-else-if="modal === 'return-detail'">
        <div class="wide order-detail-summary">
          <div><span>退货单号</span><strong>{{ draft.returnRecord.name }}</strong></div>
          <div><span>供应商</span><strong>{{ draft.returnRecord.supplier?.name || '-' }}</strong></div>
          <div><span>仓库</span><strong>{{ draft.returnRecord.factory?.name || '-' }}</strong></div>
          <div><span>采购订单号</span><button v-if="draft.returnRecord.purchase_order" class="record-link record-link-main" type="button" @click="openOrderDetail(draft.returnRecord.purchase_order)">{{ draft.returnRecord.purchase_order.name }}</button><span v-else>-</span></div>
          <div><span>来源收货单</span><button v-if="draft.returnRecord.receipt_id" class="record-link record-link-main" type="button" @click="openReceiptDetail({ id: draft.returnRecord.receipt_id })">{{ draft.returnRecord.receipt_name }}</button><span v-else>-</span></div>
          <div><span>制单日期</span><strong>{{ dateTime(draft.returnRecord.create_date) }}</strong></div>
          <div><span>操作员</span><strong>{{ draft.returnRecord.creator || '-' }}</strong></div>
          <div><span>审批状态</span><strong>{{ stateText(draft.returnRecord.state) }}</strong></div>
          <div><span>退货金额</span><strong>¥{{ number(draft.returnRecord.amount_total) }}</strong></div>
        </div>
        <section class="wide order-detail-block"><header><h4>退货明细</h4><span>{{ draft.returnRecord.lines?.length || 0 }} 项</span></header>
          <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>原料信息</th><th>品牌</th><th>退货件数</th><th>采购单价</th><th>退货金额</th><th>物流单号</th><th>备注</th></tr></thead><tbody>
            <tr v-for="(line,index) in draft.returnRecord.lines" :key="line.id"><td>{{ index + 1 }}</td><td><strong>{{ line.product?.name }}</strong></td><td>{{ line.product?.brand || '-' }}</td><td>{{ number(line.return_qty,3) }}</td><td>{{ number(line.price_unit) }}</td><td>{{ number(line.amount) }}</td><td>{{ line.logistics_no || '-' }}</td><td>{{ line.note || '-' }}</td></tr>
          </tbody></table></div>
          <div class="purchase-total"><span>退货总金额</span><strong>¥{{ number(draft.returnRecord.amount_total) }}</strong></div>
        </section>
        <section v-if="draft.returnRecord.return_reason" class="wide order-detail-block"><header><h4>退货原因</h4></header><p>{{ draft.returnRecord.return_reason }}</p></section>
        <section class="wide order-detail-block"><header><h4>关联库存批次</h4><span>{{ draft.returnRecord.state === 'done' ? '已退货出库' : stateText(draft.returnRecord.state) }}</span></header><div class="linked-orders"><button v-for="line in draft.returnRecord.lines.filter(item => item.lot)" :key="line.id" type="button" @click="openLotDetail(line.lot.id)"><strong>{{ line.lot.name }}</strong><span>{{ line.product?.name }}</span><small>查看退货出库及库存变化</small></button></div></section>
        <section v-if="draft.returnRecord.approval_history?.length" class="wide order-detail-block"><header><h4>审批流程</h4><span>{{ stateText(draft.returnRecord.state) }}</span></header>
          <div class="approval-timeline"><div v-for="(step,index) in draft.returnRecord.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div>
        </section>
      </template>
      <template v-else-if="modal === 'count-create'"><label class="wide"><span>盘点库位</span><select v-model="draft.location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.usage === 'internal')" :key="item.id" :value="item.id">{{ locationLabel(item) }}</option></select></label></template>
      <template v-else-if="['count-lines','count-review'].includes(modal)">
        <div class="count-workbench wide">
          <div class="count-toolbar">
            <input v-model.trim="countFilters.keyword" placeholder="搜索物料、批次或库位">
            <select v-model="countFilters.mode"><option value="all">全部明细</option><option value="difference">仅有差异</option><option value="unchanged">仅无差异</option></select>
            <span>共 {{ draft.lines.length }} 项 · 差异 {{ countDifferenceSummary.lines }} 项 · 盘盈 {{ number(countDifferenceSummary.increase,3) }} · 盘亏 {{ number(countDifferenceSummary.decrease,3) }}</span>
          </div>
          <div class="count-work-head"><span>物料 / 批次</span><span>上次盘点</span><span>本次账面</span><span>本次实盘</span><span>本次差异</span><span>差异原因</span></div>
          <div v-for="line in visibleCountLines" :key="line.id" class="count-work-row" :class="{ changed: countHasDifference(line) }">
            <div><strong>{{ line.product?.name }}</strong><small>{{ line.lot?.name || '无批次' }} · {{ locationLabel(line.location) }}</small></div>
            <div><strong>{{ line.previous_count ? number(line.previous_count.counted_qty,3) : '-' }}</strong><small v-if="line.previous_count">{{ line.previous_count.name }} · 较上次 {{ countPreviousChange(line) > 0 ? '+' : '' }}{{ number(countPreviousChange(line),3) }}</small><small v-else>首次盘点</small></div>
            <div><strong>{{ number(line.theoretical_qty,3) }}</strong><small>{{ line.uom?.name }}</small></div>
            <label><span>实盘数量</span><input v-model.number="line.counted_qty" type="number" min="0" step="0.001" :readonly="modal === 'count-review'"></label>
            <div><strong :class="{ 'count-difference': countHasDifference(line) }">{{ Number(line.counted_qty || 0) - Number(line.theoretical_qty || 0) > 0 ? '+' : '' }}{{ number(Number(line.counted_qty || 0) - Number(line.theoretical_qty || 0),3) }}</strong><small>{{ countHasDifference(line) ? '需说明原因' : '账实一致' }}</small></div>
            <div class="count-reason">
              <select v-model="line.difference_reason" :disabled="modal === 'count-review' || !countHasDifference(line)"><option value="">选择原因</option><option v-for="(label,value) in countReasonLabels" :key="value" :value="value">{{ label }}</option></select>
              <input v-if="countHasDifference(line)" v-model.trim="line.difference_note" :readonly="modal === 'count-review'" :placeholder="line.difference_reason === 'other' ? '请填写差异说明' : '补充说明（选填）'">
            </div>
          </div>
          <div v-if="!visibleCountLines.length" class="inventory-empty">没有匹配的盘点明细</div>
        </div>
      </template>
      <div v-if="modalError" class="master-error wide">{{ modalError }}</div></div><footer><button v-if="taskOperationButton" class="btn btn-primary" type="button" :disabled="saving" @click="executeTaskOperation">{{ saving ? '处理中…' : taskOperationButton }}</button><button class="btn btn-secondary" type="button" @click="modal = ''">{{ ['count-review','order-detail','requisition-detail','receipt-detail','inspection-detail','return-detail'].includes(modal) ? '关闭' : '取消' }}</button><button v-if="modal === 'receipt-detail' && !selectedReceiptGroup && canWarehouse && (draft.receipt?.state === 'draft' || (draft.receipt?.state === 'pending_approval' && draft.receipt?.approval_state === 'returned'))" class="btn btn-primary" type="button" @click="openReceiptEdit(draft.receipt)">{{ draft.receipt.state === 'draft' ? '继续收货' : '修改并重新提交' }}</button><button v-if="modal === 'inspection-detail' && canWarehouse && ['draft','returned','submitted'].includes(draft.inspectionDetail?.state)" class="btn btn-primary" type="button" :disabled="saving" @click="openQuality(draft.inspectionDetail)">开始质检入库</button><button v-if="!['count-review','order-detail','requisition-detail','receipt-detail','inspection-detail','return-detail'].includes(modal)" class="btn btn-primary" type="button" :disabled="saving" @click="submitModal">{{ saving ? '处理中...' : modal === 'emergency' ? '创建并提交审核' : modal === 'order' ? `按规则生成 ${purchaseOrderGroups.length} 张采购单` : modal === 'order-edit' ? (taskOnly ? '保存并下单' : '保存修改') : ['receipt','receipt-edit'].includes(modal) ? (draft.receipt?.approval_state === 'returned' ? '修改并重新提交收货' : '确认收货') : modal === 'requisition-edit' ? (taskOnly ? '保存并提交审批' : '保存修改') : modal === 'return-edit' ? (draft.returnRecord ? taskOnly ? '保存并提交审批' : '保存修改' : '创建退货单') : modal === 'quality' ? '确认质检并入库' : modal === 'plan' ? '生成采购需求单' : '确认' }}</button></footer></section></div>
    <ProductionPlanDetail v-if="selectedMaterialPlanId" :plan-id="selectedMaterialPlanId" :allow-execution="canWarehouse" initial-stage="material_preparation" @close="selectedMaterialPlanId = null" @changed="load" />
    <ProductionPlanDetail v-if="selectedPlanId" class="procurement-plan-detail" :plan-id="selectedPlanId" read-only @close="selectedPlanId = null" />
    <div v-if="selectedLot" class="inventory-modal-mask procurement-lot-detail" @click.self="selectedLot = null">
      <section class="inventory-modal inventory-modal-wide" role="dialog" aria-modal="true" aria-label="库存批次与出入库记录">
        <header><div><h3>{{ selectedLot.name }}</h3><p>{{ selectedLot.product?.name }} · {{ expiryText(selectedLot) }}</p></div><button class="inventory-modal-close" type="button" @click="selectedLot = null">×</button></header>
        <div class="inventory-modal-body">
          <div class="wide order-detail-summary"><div><span>账面</span><strong>{{ number(selectedLot.on_hand,3) }} {{ selectedLot.uom }}</strong></div><div><span>预占</span><strong>{{ number(selectedLot.reserved,3) }}</strong></div><div><span>可用</span><strong>{{ number(selectedLot.available,3) }}</strong><small>{{ availableReasonText(selectedLot) }}</small></div><div v-if="selectedLot.source_receipt"><span>来源收货单</span><button class="record-link" type="button" @click="openMovementSource({ model: 'brew.receipt', id: selectedLot.source_receipt.id })">{{ selectedLot.source_receipt.name }}</button></div></div>
          <section class="wide order-detail-block"><header><h4>出入库记录</h4><span>最近 {{ selectedLot.recent_movements?.length || 0 }} 条（最多100条）</span></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>时间</th><th>关联单据</th><th>数量</th><th>来源库位 → 目标库位</th></tr></thead><tbody><tr v-for="movement in selectedLot.recent_movements" :key="movement.id"><td>{{ dateTime(movement.date) }}</td><td><button v-if="movement.source?.id && ['brew.receipt','brew.purchase.return','brew.production.plan'].includes(movement.source.model)" class="record-link" type="button" @click="openMovementSource(movement.source)">{{ movement.source.reference }}</button><span v-else>{{ movement.source?.reference || '-' }}</span></td><td>{{ number(movement.quantity,3) }} {{ movement.uom }}</td><td>{{ locationLabel(movement.source_location) }} → {{ locationLabel(movement.destination_location) }}</td></tr><tr v-if="!selectedLot.recent_movements?.length"><td colspan="4" class="inventory-empty">暂无已完成的出入库记录</td></tr></tbody></table></div></section>
        </div><footer><button class="btn btn-secondary" type="button" @click="selectedLot = null">关闭</button></footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.shortage-section { display: flex; flex-direction: column; height: calc(100dvh - 205px); min-height: 520px; overflow: hidden; }
.shortage-section > header p { margin: 0; color: var(--text-muted); font-size: 12px; }
.shortage-section > header { gap: 20px; }
.shortage-header-title { min-width: 0; }
.shortage-header-tools { display: flex; align-items: center; justify-content: flex-end; gap: 9px; min-width: 0; }
.shortage-header-search { display: flex; align-items: center; width: min(330px,30vw); min-width: 180px; height: 36px; overflow: hidden; border: 1px solid var(--border-default); border-radius: 7px; background: var(--bg-input); }
.shortage-header-search:focus-within { border-color: var(--accent-gold); }
.shortage-header-search input { flex: 1; width: 0; min-width: 0; height: 100%; padding: 0 11px; border: 0; outline: 0; background: transparent; color: var(--text-primary); font-size: 12px; }
.shortage-header-search .btn { height: 100%; padding: 0 14px; border-radius: 0; white-space: nowrap; }
.shortage-header-clear { padding: 4px; border: 0; background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; }
.shortage-header-clear:hover { color: var(--text-primary); }
.shortage-factory-select { width: 160px; height: 36px; padding: 0 10px; border: 1px solid var(--border-default); border-radius: 7px; background: var(--bg-input); color: var(--text-primary); font-size: 12px; }
.shortage-overview { padding: 14px 18px; border-bottom: 1px solid var(--border-subtle); }
.shortage-overview-heading { display: flex; gap: 12px; align-items: baseline; margin-bottom: 12px; }
.shortage-overview-heading strong { color: var(--text-primary); font-size: 14px; }
.shortage-overview-cards { display: grid; grid-template-columns: repeat(auto-fit,minmax(190px,1fr)); gap: 10px; }
.shortage-overview-card { display: grid; gap: 7px; min-width: 0; padding: 12px 14px; border: 1px solid var(--border-default); border-radius: 9px; background: rgba(255,255,255,.018); color: var(--text-primary); text-align: left; cursor: pointer; }
.shortage-overview-card:hover, .shortage-overview-card.active { border-color: var(--accent-gold); background: rgba(212,168,83,.08); }
.shortage-overview-card > span { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 600; }
.shortage-overview-card small { color: var(--text-muted); font-size: 10px; font-weight: 400; white-space: nowrap; }
.shortage-overview-card strong { color: #efad75; font-size: 17px; overflow-wrap: anywhere; }
.shortage-overview-card em { color: var(--accent-gold); font-size: 11px; font-style: normal; }
.shortage-selection-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 9px 18px; border-bottom: 1px solid var(--border-subtle); background: rgba(212,168,83,.025); }
.shortage-selection-controls, .shortage-selection-result { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.shortage-selection-result > span { color: var(--text-secondary); font-size: 12px; }
.shortage-selection-result strong { color: var(--accent-gold); }
.shortage-clear-selection { padding: 5px; border: 0; background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; }
.shortage-clear-selection:hover { color: var(--text-primary); }
.shortage-category-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 14px 18px 0; }
.shortage-category-heading > div { display: flex; align-items: baseline; gap: 10px; }
.shortage-category-heading strong { color: var(--text-primary); font-size: 14px; }
.shortage-category-heading > button { color: var(--accent-gold); }
.shortage-plan-list { display: grid; flex: 1; min-height: 0; align-content: start; grid-auto-rows: max-content; gap: 10px; overflow-y: auto; padding: 16px 18px; }
.shortage-plan-card { display: grid; grid-template-columns: 52px minmax(0,1fr); overflow: hidden; border: 1px solid var(--border-default); border-radius: 10px; background: rgba(255,255,255,.015); }
.shortage-plan-card.is-selected { border-color: var(--accent-gold); }
.shortage-plan-card.category-view { grid-template-columns: minmax(0,1fr); }
.shortage-plan-select { display: flex; align-items: center; justify-content: center; border-right: 1px solid var(--border-subtle); cursor: pointer; }
.shortage-plan-select.is-disabled { cursor: default; opacity: .45; }
.shortage-plan-select input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent-gold); cursor: inherit; }
.shortage-plan-summary { display: grid; grid-template-columns: minmax(180px,1fr) minmax(140px,190px) 72px 116px 96px; align-items: center; gap: 16px; width: 100%; padding: 16px 18px; border: 0; background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; }
.shortage-category-plan-summary { grid-template-columns: 24px minmax(180px,1fr) minmax(140px,190px) auto auto; gap: 14px; padding: 12px 16px; cursor: default; }
.shortage-category-plan-select { display: flex; align-items: center; justify-content: center; cursor: pointer; }
.shortage-category-plan-select input { width: 17px; height: 17px; margin: 0; accent-color: var(--accent-gold); cursor: pointer; }
.shortage-category-plan-select input:disabled { cursor: default; opacity: .45; }
.shortage-category-plan-summary .shortage-plan-identity { gap: 3px; }
.shortage-category-plan-summary .shortage-plan-identity > strong { font-size: 14px; }
.shortage-category-plan-summary .shortage-plan-need { white-space: nowrap; }
.shortage-category-list { gap: 8px; padding-top: 10px; }
.shortage-category-list .shortage-plan-detail { background: transparent; }
.shortage-category-list .shortage-material-row { padding: 11px 16px; }
.shortage-plan-summary:hover, .shortage-plan-summary[aria-expanded="true"] { background: rgba(212,168,83,.045); }
.shortage-category-plan-summary:hover { background: transparent; }
.shortage-plan-identity { display: grid; gap: 5px; min-width: 0; }
.shortage-plan-identity > strong { overflow: hidden; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.shortage-plan-identity > small { overflow: hidden; color: var(--text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.shortage-plan-identity > small:first-child { color: var(--accent-gold); }
.shortage-plan-factory { display: grid; gap: 3px; min-width: 0; padding-left: 13px; border-left: 1px solid var(--border-subtle); }
.shortage-plan-factory strong { overflow: hidden; color: var(--text-primary); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.shortage-plan-factory small { color: var(--text-muted); font-size: 11px; }
.shortage-plan-count { display: grid; gap: 2px; }
.shortage-plan-count strong { font-size: 19px; }
.shortage-plan-count small { color: var(--text-muted); font-size: 11px; }
.shortage-plan-need { color: #efad75; font-size: 12px; }
.shortage-plan-need.complete { color: #91d4aa; }
.shortage-plan-chevron { color: var(--accent-gold); font-size: 12px; text-align: right; white-space: nowrap; }
.shortage-plan-detail { grid-column: 1 / -1; border-top: 1px solid var(--border-subtle); background: rgba(0,0,0,.08); }
.shortage-plan-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; color: var(--text-muted); font-size: 11px; }
.shortage-plan-toolbar strong { color: var(--text-primary); }
.shortage-plan-toolbar > div { display: flex; gap: 8px; flex-wrap: wrap; }
.shortage-material-list { overflow-x: auto; }
.shortage-material-row { display: grid; grid-template-columns: 24px minmax(160px,1.6fr) repeat(3,minmax(90px,.8fr)) minmax(130px,1fr); align-items: center; gap: 12px; min-width: 760px; padding: 12px 18px; border-top: 1px solid var(--border-subtle); color: var(--text-secondary); font-size: 12px; }
.shortage-material-row > input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent-gold); }
.shortage-material-name, .shortage-material-amount, .shortage-material-status { display: grid; gap: 4px; min-width: 0; }
.shortage-material-name strong { overflow: hidden; color: var(--text-primary); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.shortage-material-name small, .shortage-material-amount small, .shortage-material-status small { color: var(--text-muted); font-size: 11px; }
.shortage-material-missing strong { color: #efad75; }
.shortage-material-status { justify-items: start; }
.shortage-material-status .record-links { margin-top: 2px; }
.shortage-confirm-note { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.shortage-confirm-group { display: grid; gap: 8px; }
.shortage-confirm-group h4 { display: flex; justify-content: space-between; gap: 10px; margin: 8px 0 0; color: var(--text-primary); font-size: 13px; }
.shortage-confirm-group h4 small { color: var(--text-muted); font-size: 11px; font-weight: 400; }
.shortage-confirm-list > .shortage-confirm-head, .shortage-confirm-list > .shortage-confirm-row { display: grid; grid-template-columns: minmax(0,1fr) 160px 175px; align-items: center; gap: 14px; }
.shortage-confirm-head { color: var(--text-muted); font-size: 11px; }
.shortage-confirm-material, .shortage-confirm-gap { display: grid; gap: 3px; min-width: 0; }
.shortage-confirm-material strong { overflow: hidden; color: var(--text-primary); text-overflow: ellipsis; white-space: nowrap; }
.shortage-confirm-gap strong { color: #efad75; font-weight: 600; }
.shortage-confirm-list .shortage-confirm-quantity { display: flex; align-items: center; gap: 8px; min-width: 0; }
.shortage-confirm-list .shortage-confirm-quantity input { width: 112px; min-height: 34px; padding: 5px 8px; text-align: right; }
.shortage-confirm-list .shortage-confirm-quantity span { flex: none; color: var(--text-secondary); }
.requisition-source-list { display: grid; gap: 3px; }
.requisition-source-list button { justify-self: start; text-align: left; }
.requisition-source-list small, .requisition-allocations-note { display: block; margin-top: 3px; color: var(--text-muted); font-size: 11px; font-weight: 400; }
.requisition-overview { padding: 12px 18px; }
.requisition-overview .shortage-overview-heading { padding: 0; margin: 0 0 9px; }
.requisition-summary-tabs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); border: 1px solid var(--border-default); border-radius: 6px; overflow: hidden; }
.requisition-summary-tab { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-width: 0; min-height: 42px; padding: 8px 12px; border: 0; border-right: 1px solid var(--border-subtle); background: rgba(255,255,255,.015); color: var(--text-secondary); text-align: left; cursor: pointer; }
.requisition-summary-tab:last-child { border-right: 0; }
.requisition-summary-tab:hover, .requisition-summary-tab.active { background: rgba(212,168,83,.09); color: var(--text-primary); box-shadow: inset 0 -2px var(--accent-gold); }
.requisition-summary-tab strong { color: var(--accent-gold); font-size: 15px; font-variant-numeric: tabular-nums; }
.requisition-row-main { display: grid; gap: 9px; min-width: 0; }
.requisition-row-title { display: flex; align-items: center; gap: 9px; min-width: 0; }
.requisition-row-facts { display: grid; grid-template-columns: 200px 140px minmax(260px, 1fr) 110px; gap: 18px; max-width: 1120px; color: var(--text-secondary); font-size: 12px; }
.requisition-row-facts > span { min-width: 0; overflow-wrap: anywhere; }
.requisition-row-facts small { display: block; margin-bottom: 3px; color: var(--text-muted); font-size: 10px; }
.requisition-row-facts strong { color: var(--text-primary); }
.requisition-row-facts .state-pill { font-style: normal; }
.requisition-row-facts em { display: block; color: #e58b83; font-size: 10px; font-style: normal; }
.requisition-row-related { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; min-width: 0; color: var(--text-muted); font-size: 11px; }
.requisition-row-related small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.requisition-row-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 6px; }
.requisition-pagination { position: sticky; bottom: 0; z-index: 4; width: 100%; margin-top: auto; padding: 10px 18px; border-top: 1px solid var(--border-subtle); background: rgba(28,26,24,.97); backdrop-filter: blur(8px); }
.requisition-pagination select { border-color: var(--border-default); background: var(--bg-elevated); }
.receipt-order-table { min-width: 980px; }
.receipt-order-row { cursor: pointer; transition: background .15s ease; }
.receipt-order-row:hover { background: rgba(212,168,83,.045); }
.receipt-order-row .state-pill[data-state="not_received"] { border-color: rgba(224,105,96,.35); color: #e58b83; }
.receipt-order-row .state-pill[data-state="partial"], .receipt-order-row .state-pill[data-state="receiving"] { border-color: rgba(212,168,83,.42); color: var(--accent-gold); }
.receipt-order-row .state-pill[data-state="received"] { border-color: rgba(105,190,139,.4); color: #91d4aa; }
.receipt-detail-panel { max-width: 1460px; padding: 12px 16px 4px; border-left: 2px solid rgba(212,168,83,.55); background: rgba(0,0,0,.12); }
.receipt-detail-summary { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 16px; padding: 4px 2px 14px; border-bottom: 1px solid var(--border-subtle); }
.receipt-detail-summary > div { display: grid; gap: 5px; min-width: 0; }
.receipt-detail-summary span { color: var(--text-muted); font-size: 11px; }
.receipt-detail-summary strong { overflow-wrap: anywhere; color: var(--text-primary); font-size: 13px; font-weight: 500; }
.receipt-detail-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; color: var(--text-primary); font-size: 12px; }
.receipt-detail-heading span { color: var(--text-muted); font-size: 11px; }
.receipt-detail-row { display: grid; grid-template-columns: minmax(190px,1.15fr) minmax(180px,1fr) minmax(155px,.9fr) 112px minmax(240px,1.3fr); align-items: center; gap: 18px; min-height: 62px; padding: 9px 4px; border-top: 1px solid var(--border-subtle); color: var(--text-secondary); font-size: 12px; }
.receipt-detail-row > div { min-width: 0; }
.receipt-detail-document, .receipt-detail-quantity, .receipt-detail-time { display: grid; gap: 4px; }
.receipt-detail-document .record-link { justify-self: start; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.receipt-detail-quantity strong, .receipt-detail-time strong { color: var(--text-primary); font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }
.receipt-detail-row small { color: var(--text-muted); font-size: 11px; }
.receipt-detail-state { display: grid; justify-items: start; gap: 4px; }
.receipt-detail-state small { color: #e58b83; }
.receipt-detail-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 6px; }
.receipt-detail-actions .btn { margin: 0; }
.receipt-line { grid-template-columns: minmax(140px,1.25fr) repeat(4,minmax(100px,.9fr)) minmax(170px,1.2fr); }
.receipt-line-head { color: var(--text-muted); font-size: 11px; }
.inventory-modal:has(.receipt-detail-summary) > header p { display: none; }
@media (max-width: 1100px) {
  .requisition-summary-tabs { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .requisition-summary-tab:nth-child(3) { border-right: 0; }
  .requisition-summary-tab:nth-child(n+4) { border-top: 1px solid var(--border-subtle); }
  .requisition-row-facts { grid-template-columns: minmax(130px, .9fr) minmax(100px, .7fr) minmax(220px, 1.8fr) minmax(95px, .6fr); }
}
@media (max-width: 700px) {
  .requisition-summary-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .requisition-summary-tab:nth-child(3) { border-right: 1px solid var(--border-subtle); }
  .requisition-summary-tab:nth-child(2n) { border-right: 0; }
  .requisition-summary-tab:nth-child(n+3) { border-top: 1px solid var(--border-subtle); }
  .requisition-row { padding: 12px; }
  .requisition-row-title { align-items: flex-start; flex-wrap: wrap; }
  .requisition-row-actions { width: 100%; justify-content: flex-start; margin-left: 0; }
  .requisition-row-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .requisition-row-facts > span:nth-child(3) { grid-column: 1 / -1; }
  .requisition-pagination { flex-wrap: wrap; justify-content: center; padding: 10px; }
}
@media (max-width: 900px) {
  .receipt-detail-row { grid-template-columns: minmax(0,1fr) minmax(0,1fr) auto; gap: 10px 14px; }
  .receipt-detail-document { grid-column: 1 / 3; }
  .receipt-detail-state { grid-column: 3; grid-row: 1; }
  .receipt-detail-quantity { grid-column: 1; }
  .receipt-detail-time { grid-column: 2; }
  .receipt-detail-actions { grid-column: 1 / -1; justify-content: flex-start; }
}
@media (max-width: 520px) {
  .receipt-detail-panel { padding: 10px 10px 3px; }
  .receipt-detail-row { grid-template-columns: minmax(0,1fr) auto; }
  .receipt-detail-document { grid-column: 1 / -1; }
  .receipt-detail-state { grid-column: 2; grid-row: 2; }
  .receipt-detail-quantity { grid-column: 1; grid-row: 2; }
  .receipt-detail-time { grid-column: 1 / -1; grid-row: 3; }
  .receipt-detail-actions { grid-row: 4; }
}
@media (max-width: 700px) {
  .receipt-detail-summary { grid-template-columns: 1fr; gap: 9px; }
  .receipt-line, .receipt-line-head { grid-template-columns: 1fr; }
  .receipt-line-head { display: none; }
}
.shortage-section > .proc-pagination { position: sticky; bottom: 0; z-index: 4; flex: none; margin-top: auto; padding: 12px 18px; border-top: 1px solid var(--border-subtle); background: rgba(28,26,24,.97); backdrop-filter: blur(8px); }
@media (max-width: 1050px) { .shortage-section { height: auto; min-height: max(520px, calc(100dvh - 205px)); overflow: visible; } .shortage-plan-list { min-height: 150px; overflow: visible; } }
@media (max-width: 1050px) { .shortage-section > header { align-items: flex-start; flex-direction: column; } .shortage-header-tools { width: 100%; justify-content: flex-start; } .shortage-header-search { width: min(350px,45vw); } .shortage-factory-select { margin-left: auto; } }
@media (max-width: 700px) { .shortage-plan-toolbar { align-items: flex-start; flex-direction: column; } .shortage-overview-heading, .shortage-category-heading > div { display: grid; gap: 3px; } .shortage-header-tools { flex-wrap: wrap; } .shortage-header-search { width: calc(100% - 170px); min-width: 140px; } .shortage-factory-select { width: 150px; } .shortage-plan-summary { grid-template-columns: minmax(0,1fr) auto; gap: 10px; } .shortage-plan-identity { grid-column: 1 / -1; } .shortage-plan-factory { grid-column: 1 / -1; } .shortage-plan-chevron { grid-column: 2; } .shortage-category-plan-summary { grid-template-columns: 24px minmax(0,1fr) auto; } .shortage-category-plan-summary .shortage-plan-identity, .shortage-category-plan-summary .shortage-plan-factory, .shortage-category-plan-summary .shortage-plan-need, .shortage-category-plan-summary > .btn { grid-column: 2 / -1; } .shortage-category-plan-summary > .btn { justify-self: start; } .shortage-category-list .shortage-material-row { grid-template-columns: 22px repeat(2,minmax(0,1fr)); min-width: 0; gap: 10px; } .shortage-category-list .shortage-material-name { grid-column: 2 / -1; } .shortage-category-list .shortage-material-amount:nth-of-type(2), .shortage-category-list .shortage-material-missing { grid-column: 2; } .shortage-category-list .shortage-material-amount:nth-of-type(3) { grid-column: 3; } .shortage-category-list .shortage-material-status { grid-column: 2 / -1; } .shortage-section > .proc-pagination { flex-wrap: wrap; justify-content: flex-start; } .shortage-confirm-list > .shortage-confirm-head { display: none; } .shortage-confirm-list > .shortage-confirm-row { grid-template-columns: minmax(0,1fr) auto; } .shortage-confirm-material { grid-column: 1 / -1; } }
.inventory-tabs .inventory-tab-refresh{margin-left:auto;font-size:12px;align-self:center;padding:8px 12px;border:1px solid #ffffff18;border-radius:7px;color:#aaa}
.proc-pagination{display:flex;align-items:center;gap:10px;padding:10px 0;justify-content:flex-end;font-size:13px;color:#bbb}
.proc-pagination select{background:#1a1a2e;color:#ddd;border:1px solid #333;border-radius:4px;padding:3px 6px;font-size:12px;cursor:pointer}
.proc-pagination select:focus{outline:none;border-color:#5c6bc0}
.proc-pagination span{white-space:nowrap}
.return-line-checkbox-cell{width:42px;text-align:center;vertical-align:middle}
.return-line-checkbox{appearance:auto!important;-webkit-appearance:auto!important;width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;padding:0!important;margin:0 auto;display:block;box-sizing:border-box;accent-color:#6674e8;cursor:pointer}
</style>

<style scoped>
.receipt-entry-modal { width: min(1180px, 100%); display: flex; flex-direction: column; overflow: hidden; }
.receipt-entry-modal > header, .receipt-entry-modal > footer { flex-shrink: 0; padding: 16px 20px; }
.receipt-entry-modal .inventory-modal-body { overflow-y: auto; min-height: 0; padding: 18px 20px; gap: 14px; }
.receipt-entry-context { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 14px; padding: 10px 12px; background: rgba(255,255,255,.025); border: 1px solid var(--border-subtle); border-radius: 8px; }
.receipt-entry-context > div { min-width: 0; }
.receipt-entry-context span { display: block; color: var(--text-muted); font-size: 11px; margin-bottom: 6px; }
.receipt-entry-context strong { color: var(--text-primary); font-size: 13px; overflow-wrap: anywhere; }
.receipt-entry-lines { display: grid; gap: 12px; min-width: 0; }
.receipt-entry-table { table-layout: fixed; min-width: 1040px; }
.receipt-entry-table .receipt-col-product { width: 18%; }
.receipt-entry-table .receipt-col-quantity { width: 10%; }
.receipt-entry-table .receipt-col-actual { width: 11%; }
.receipt-entry-table .receipt-col-location { width: 20%; }
.receipt-entry-table .receipt-col-lot { width: 16%; }
.receipt-entry-table .receipt-col-expiry { width: 15%; }
.receipt-entry-table th, .receipt-entry-table td { padding: 10px 8px; }
.receipt-entry-table td { white-space: nowrap; }
.receipt-entry-table td:first-child { white-space: normal; overflow-wrap: anywhere; }
.receipt-entry-modal .inventory-modal-body input, .receipt-entry-modal .inventory-modal-body select { min-width: 0; min-height: 34px; height: 34px; padding: 0 10px; font-size: 13px; }
.receipt-location-field { display: grid; gap: 8px; min-width: 0; }
.receipt-location-field > span { color: var(--text-muted); font-size: 12px; }
@media (max-width: 560px) {
  .receipt-entry-modal > header, .receipt-entry-modal > footer { padding: 16px; }
  .receipt-entry-modal .inventory-modal-body { padding: 16px; }
  .receipt-entry-context { grid-template-columns: 1fr 1fr; padding: 12px; }
}
</style>

<style scoped>
.purchase-order-detail-modal .inventory-modal-body { display: flex; flex-direction: column; gap: 18px; }
.purchase-order-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.purchase-order-heading > div:first-child > span { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 11px; }
.purchase-order-heading > div:first-child > strong { font-size: 22px; color: var(--text-primary); }
.purchase-order-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.purchase-order-facts { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle); }
.purchase-order-facts > div { min-width: 0; }
.purchase-order-facts span { display: block; margin-bottom: 6px; font-size: 11px; color: var(--text-muted); }
.purchase-order-facts strong { font-size: 12px; font-weight: 500; color: var(--text-secondary); overflow-wrap: anywhere; }
.purchase-order-items { border-color: rgba(212,168,83,.25); }
.purchase-order-items > header { padding: 14px 16px; background: rgba(212,168,83,.04); }
.purchase-order-items h4 { font-size: 16px; }
.purchase-order-items .work-table td { padding-top: 16px; padding-bottom: 16px; }
.purchase-order-items .purchase-order-line-amount { color: var(--accent-gold); font-weight: 600; }
.purchase-order-total { display: flex; justify-content: flex-end; align-items: baseline; gap: 20px; padding: 16px; border-top: 1px solid var(--border-subtle); background: rgba(212,168,83,.035); }
.purchase-order-total span { color: var(--text-secondary); font-size: 12px; }
.purchase-order-total strong { color: var(--accent-gold); font-size: 24px; }
.purchase-order-progress h4 { margin: 0 0 10px; color: var(--text-secondary); font-size: 12px; font-weight: 500; }
.purchase-order-progress-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 20px; padding: 9px 0; border-top: 1px solid var(--border-subtle); font-size: 11px; }
.purchase-order-progress-row > span, .purchase-order-progress-row > small { color: var(--text-muted); }
.purchase-order-progress-row > small { margin-left: auto; }
@media (max-width: 650px) {
  .purchase-order-heading { align-items: flex-start; flex-direction: column; }
  .purchase-order-facts { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
</style>

<style scoped>
.quality-entry-modal { width: min(980px, 100%); display: flex; flex-direction: column; overflow: hidden; }
.quality-entry-modal > header, .quality-entry-modal > footer { flex-shrink: 0; padding: 18px 22px; }
.quality-entry-modal .inventory-modal-body { overflow-y: auto; min-height: 0; padding: 20px 22px; gap: 18px; }
.quality-entry-context { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle); }
.quality-entry-context > div { min-width: 0; }
.quality-entry-context span { display: block; color: var(--text-muted); font-size: 11px; margin-bottom: 6px; }
.quality-entry-context strong { color: var(--text-secondary); font-size: 12px; font-weight: 500; overflow-wrap: anywhere; }
.quality-entry-detail { min-width: 0; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; }
.quality-entry-detail > header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; }
.quality-entry-detail h4 { margin: 0; color: var(--text-primary); font-size: 14px; }
.quality-entry-detail h4 span { margin-left: 8px; color: var(--text-muted); font-size: 11px; font-weight: 400; }
.quality-entry-detail header p { margin: 5px 0 0; color: var(--text-muted); font-size: 11px; }
.quality-entry-table { min-width: 790px; table-layout: fixed; }
.quality-entry-table th { padding: 9px 12px; background: rgba(255,255,255,.02); }
.quality-entry-table td { padding: 14px 12px; }
.quality-entry-table td:first-child { overflow-wrap: anywhere; }
.quality-entry-table td small { font-size: 10px; }
.quality-entry-inspected { white-space: nowrap; }
.quality-entry-quantity { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 0 8px; height: 36px; border: 1px solid #4a4338; border-radius: 5px; background: #292621; }
.quality-entry-modal .quality-entry-quantity input { min-width: 0; min-height: 0; height: 34px; padding: 0; border: 0; border-radius: 0; background: transparent; font-size: 13px; }
.quality-entry-quantity input:focus { outline: none; box-shadow: none; }
.quality-entry-quantity:focus-within { border-color: var(--accent-gold); }
.quality-entry-quantity > span { flex-shrink: 0; color: var(--text-muted); font-size: 11px; }
.quality-entry-quantity.rejected { border-color: rgba(210,114,84,.6); }
.quality-entry-modal .quality-entry-table select { min-width: 0; min-height: 36px; height: 36px; padding: 0 8px; font-size: 12px; }
.quality-entry-modal .quality-entry-table select.quality-entry-disposition-required { border-color: #d28a6e; }
.quality-entry-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 14px 30px; padding: 14px 16px; border-top: 1px solid var(--border-subtle); background: rgba(212,168,83,.035); }
.quality-entry-summary > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; }
.quality-entry-summary span { font-size: 11px; color: var(--text-secondary); }
.quality-entry-summary strong { color: var(--accent-gold); font-size: 17px; font-weight: 600; }
.quality-entry-summary .quality-entry-rejected strong { color: #d28a6e; font-size: 13px; }
.quality-entry-note > span small { margin-left: 6px; font-size: 10px; }
.quality-entry-modal .quality-entry-note textarea { min-height: 58px; padding: 9px 11px; font-size: 12px; resize: vertical; }
@media (max-width: 600px) {
  .quality-entry-modal > header, .quality-entry-modal > footer { padding: 16px; }
  .quality-entry-modal .inventory-modal-body { padding: 16px; }
  .quality-entry-context { grid-template-columns: 1fr 1fr; gap: 12px; }
  .quality-entry-context > div:first-child { grid-column: 1 / -1; }
}
</style>

<style scoped>
.qc-workspace { display: flex; flex-direction: column; height: calc(100dvh - 205px); min-height: 520px; overflow: hidden; }
.qc-workspace > header { flex-shrink: 0; gap: 20px; }
.qc-workspace > header p { margin: 0; color: var(--text-muted); font-size: 12px; }
.qc-workspace > .qc-toolbar { flex-shrink: 0; padding-top: 16px; }
.qc-workspace > .work-table-wrap { flex: 1; min-height: 0; overflow: auto; }
.qc-workspace > .proc-pagination { flex-shrink: 0; margin-top: auto; }
@media (max-width: 1050px) { .qc-workspace > header { align-items: flex-start; flex-direction: column; } .qc-workspace .shortage-header-tools { width: 100%; justify-content: flex-start; } }
.qc-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 20px 16px; }
.qc-view-tabs { display: flex; gap: 4px; padding: 4px; background: rgba(0,0,0,.18); border: 1px solid var(--border-subtle); border-radius: 8px; }
.qc-view-tabs button { border: 0; background: transparent; color: var(--text-secondary); padding: 9px 20px; border-radius: 5px; cursor: pointer; font: inherit; font-size: 13px; }
.qc-view-tabs button.active { background: rgba(212,168,83,.15); color: var(--accent-gold); font-weight: 600; }
.qc-record-count { font-size: 12px; color: var(--text-muted); }
.qc-qualified { color: #8bb997; }
.qc-workspace .work-table small.qc-rejected { color: #d28a6e; }
@media (max-width: 700px) { .qc-toolbar { padding: 0 12px 14px; gap: 8px; } .qc-view-tabs button { padding: 8px 12px; } .qc-workspace > .proc-pagination { flex-wrap: wrap; } }
</style>

<style scoped>
.order-workspace { display: flex; flex-direction: column; height: calc(100dvh - 205px); min-height: 520px; overflow: hidden; }
.order-workspace > header { flex-shrink: 0; gap: 20px; }
.order-workspace > .work-table-wrap { flex: 1; min-height: 0; overflow: auto; }
.order-workspace > .proc-pagination { flex-shrink: 0; margin-top: auto; flex-wrap: wrap; }
.order-workspace > header p { margin: 0; color: var(--text-muted); font-size: 12px; }
.order-supplier-search { width: 150px; min-width: 0; height: 36px; padding: 0 11px; border: 1px solid var(--border-default); border-radius: 7px; background: var(--bg-input); color: var(--text-primary); font: inherit; font-size: 12px; }
.order-supplier-search:focus { outline: none; border-color: var(--accent-gold); }
.order-header-tools .shortage-header-search { width: min(260px, 22vw); }
@media (max-width: 1150px) { .order-workspace > header { flex-direction: column; align-items: flex-start; } .order-header-tools { width: 100%; justify-content: flex-end; flex-wrap: wrap; } .order-header-tools .shortage-header-search { flex: 1; } }
@media (max-width: 700px) { .order-header-tools { justify-content: flex-start; } .order-header-tools .shortage-factory-select { margin-left: 0; } .order-supplier-search { width: 130px; } }
</style>

<style scoped>
.receipt-expiry-field { position: relative; min-width: 140px; }
.receipt-expiry-field input { width: 100%; padding-right: 42px; }
.receipt-expiry-field.empty input::-webkit-datetime-edit { color: transparent; }
.receipt-expiry-field.empty input:focus::-webkit-datetime-edit { color: var(--text-primary); }
.receipt-expiry-placeholder { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--text-muted); font-size: 12px; background: var(--bg-input, #292621); }
.receipt-expiry-field:focus-within .receipt-expiry-placeholder { display: none; }
.receipt-expiry-clear { position: absolute; right: 27px; top: 50%; transform: translateY(-50%); width: 20px; height: 24px; padding: 0; border: 0; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 17px; }
.receipt-expiry-clear:hover { color: var(--text-primary); }
</style>

<style scoped>
.procurement-fill-panel { display: flex; flex-direction: column; height: calc(100dvh - 205px); min-height: 520px; overflow: hidden; }
.procurement-fill-panel > header, .procurement-fill-panel > .procurement-filters, .procurement-fill-panel > .requisition-overview { flex-shrink: 0; }
.procurement-fill-panel > .work-table-wrap, .procurement-fill-panel > .requisition-list { flex: 1; min-height: 0; overflow: auto; }
.procurement-fill-panel > .proc-pagination { flex-shrink: 0; margin-top: auto; flex-wrap: wrap; }
.procurement-fill-panel > .export-history { flex-shrink: 0; max-height: 140px; overflow: auto; }
.procurement-scroll-panel { display: flex; flex-direction: column; gap: 16px; max-height: calc(100dvh - 190px); overflow: auto; }
.procurement-scroll-panel > * { flex-shrink: 0; }
.procurement-scroll-panel > .inventory-section:last-child { flex-grow: 1; }
.inventory-workbench :deep(.stock-browser) { display: flex; flex-direction: column; height: calc(100dvh - 205px); min-height: 520px; overflow: hidden; }
.inventory-workbench :deep(.stock-toolbar) { flex-shrink: 0; }
.inventory-workbench :deep(.stock-browser-layout) { flex: 1; min-height: 0; overflow: auto; }
.inventory-workbench :deep(.stock-content) { display: flex; flex-direction: column; min-height: 0; }
.inventory-workbench :deep(.stock-content > .stock-summary), .inventory-workbench :deep(.stock-content > .stock-pagination) { flex-shrink: 0; }
.inventory-workbench :deep(.stock-content > .work-table-wrap) { flex: 1; min-height: 0; overflow: auto; }
.inventory-workbench :deep(.stock-content > .stock-pagination) { margin-top: auto; flex-wrap: wrap; }
</style>

<style scoped>
.emergency-entry-modal { display: flex; flex-direction: column; width: min(960px, 100%); overflow: hidden; }
.emergency-entry-modal > header, .emergency-entry-modal > footer { flex-shrink: 0; padding: 18px 22px; }
.emergency-entry-modal .inventory-modal-body { padding: 20px 22px; gap: 20px; overflow: auto; min-height: 0; }
.emergency-basic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.emergency-entry-modal label > span { font-size: 12px; }
.emergency-entry-modal i { font-style: normal; color: var(--accent-gold); }
.emergency-entry-modal .emergency-basic-grid input, .emergency-entry-modal .emergency-basic-grid select, .emergency-entry-modal .emergency-material-table input { box-sizing: border-box; height: 38px; min-height: 38px; width: 100%; padding: 0 10px; font-size: 13px; border-radius: 6px; }
.emergency-materials { min-width: 0; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; }
.emergency-materials > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; }
.emergency-materials h4 { margin: 0; font-size: 14px; color: var(--text-primary); }
.emergency-materials h4 span { margin-left: 8px; font-weight: 400; font-size: 11px; color: var(--text-muted); }
.emergency-materials header p { margin: 6px 0 0; font-size: 11px; color: var(--text-muted); }
.emergency-material-table { min-width: 620px; table-layout: fixed; }
.emergency-material-table th { padding: 10px 12px; font-size: 11px; background: #ffffff02; }
.emergency-material-table td { padding: 12px; font-size: 12px; }
.emergency-material-table td small { font-size: 11px; }
.emergency-remove { padding: 6px 0; border: 0; background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; }
.emergency-remove:hover { color: #d28a6e; }
.emergency-entry-modal .emergency-reason textarea { min-height: 60px; padding: 10px 12px; font-size: 12px; }
.emergency-applicant { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 11px; }
.emergency-applicant strong { color: var(--text-secondary); font-weight: 400; }
.emergency-applicant > span { margin-left: auto; }
@media (max-width: 650px) { .emergency-basic-grid { grid-template-columns: 1fr 1fr; }  .emergency-entry-modal .inventory-modal-body { padding: 16px; } .emergency-applicant { flex-wrap: wrap; } .emergency-applicant > span { width: 100%; margin-left: 0; } }
</style>

<style scoped>
.count-task-mask{position:fixed;inset:0;z-index:2200;display:flex;align-items:center;justify-content:center;padding:20px;background:#000a}.count-task-panel{display:flex;width:min(1180px,100%);height:88vh;background:var(--bg-primary);border:1px solid var(--border-default);border-radius:10px;overflow:hidden;box-shadow:var(--shadow-md)}@media(max-width:600px){.count-task-mask{padding:8px}.count-task-panel{height:94dvh}}
</style>
