<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { brewApi } from "../api";
import StockBrowserPage from "./StockBrowserPage.vue";
import ProductionPlanDetail from "./ProductionPlanDetail.vue";

const props = defineProps({
  permissions: { type: Array, default: () => [] },
  currentUser: { type: Object, default: () => ({}) }
});
const emit = defineEmits(["toast"]);
const tab = ref("overview");
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const modal = ref("");
const modalError = ref("");
const selectedPlanId = ref(null);
const selectedLot = ref(null);
const draft = reactive({});

const summary = ref({ totals: {} });
const lots = ref([]);
const requisitions = ref([]);
const sourcePlans = ref([]);
const orders = ref([]);
const receipts = ref([]);
const inspections = ref([]);
const counts = ref([]);
const materialRequisitions = ref([]);
const factories = ref([]);
const materials = ref([]);
const suppliers = ref([]);
const locations = ref([]);
const materialCategories = ref([]);
const exports = ref([]);
const lotLoading = ref(false);
const shortageLoading = ref(false);
const requisitionLoading = ref(false);
const orderLoading = ref(false);
const selectedShortages = ref([]);
const lotFilters = reactive({
  keyword: "", category: "", supplier_id: "", factory_id: "", location_id: "",
  expiry_status: "", availability: "", issue: ""
});
const countFilters = reactive({ keyword: "", mode: "all" });
const shortageFilters = reactive({
  category_group: "", category_code: "",
  plan_no: "", date_from: "", date_to: ""
});
const requisitionFilters = reactive({
  keyword: "", requester_name: "", factory_id: "",
  request_type: "", state: "", date_from: "", date_to: ""
});
const orderFilters = reactive({
  supplier_name: "", order_no: "", receipt_state: ""
});

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];
// 生产缺口：客户端分页（后端未分页）
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
// 采购入库 - 收货单
const receiptLoading = ref(false);
const receiptPage = ref(1);
const receiptPageSize = ref(10);
const receiptTotal = ref(0);
const paginatedReceipts = ref([]);
const receiptFilters = reactive({
  keyword: "", supplier_name: "", factory_id: "", state: "", date_from: "", date_to: ""
});
// 采购入库 - 质检单
const inspectionLoading = ref(false);
const inspectionPage = ref(1);
const inspectionPageSize = ref(10);
const inspectionTotal = ref(0);
const paginatedInspections = ref([]);
const inspectionFilters = reactive({
  keyword: "", supplier_name: "", factory_id: "", state: "", date_from: "", date_to: ""
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
const canPurchase = computed(() => isAdmin.value || props.permissions.includes("purchase.order.manage"));
const canWarehouse = computed(() => isAdmin.value || props.permissions.includes("inventory.receipt.manage"));
const canCount = computed(() => isAdmin.value || props.permissions.includes("inventory.count.manage"));
const canExport = computed(() => isAdmin.value || props.permissions.some((item) => ["report.purchase.export", "report.all.export"].includes(item)));

const tabs = [
  { id: "overview", label: "总览" },
  { id: "shortages", label: "生产缺口" },
  { id: "requisitions", label: "采购需求" },
  { id: "orders", label: "采购执行" },
  { id: "receiving", label: "采购入库" },
  { id: "returns", label: "采购退货" },
  { id: "inventory", label: "库存作业" },
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
const number = (value, digits = 2) => Number(value || 0).toFixed(digits);
const dateTime = (value) => value ? String(value).replace("T", " ").slice(0, 16) : "-";
const requestType = (item) => item.request_type === "emergency" ? "紧急采购" : "计划缺料";
const orderType = (item) => item.procurement_type === "emergency" ? "紧急采购" : "计划采购";
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
  frozen: "已冻结", pending_location: "位于待检库位",
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
const materialGroupOptions = computed(() => {
  const values = new Map();
  materialCategories.value.filter((item) => !item.parent_id).forEach((item) => {
    values.set(item.material_group, item.name);
  });
  return [...values].map(([value, label]) => ({ value, label }));
});
const materialTypeOptions = computed(() => materialCategories.value.filter((item) => {
  if (!item.parent_id) return false;
  return !shortageFilters.category_group || item.material_group === shortageFilters.category_group;
}));
const shortageRows = computed(() => sourcePlans.value.flatMap((plan) =>
  (plan.materials || []).map((material) => ({ ...material, plan }))
));
const shortageTotal = computed(() => shortageRows.value.length);
const paginatedShortageRows = computed(() => {
  const start = (shortagePage.value - 1) * shortagePageSize.value;
  return shortageRows.value.slice(start, start + shortagePageSize.value);
});
const requestableShortageRows = computed(() => shortageRows.value.filter((item) => Number(item.requestable_qty) > 0));
const selectedShortageRows = computed(() => requestableShortageRows.value.filter((item) => selectedShortages.value.includes(item.request_key)));
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
const emergencyMaterials = computed(() => {
  if (!draft.supplier_id) return [];
  const matched = materials.value.filter(
    (item) => String(item.supplier?.id || item.brew_supplier_id?.id || "") === String(draft.supplier_id)
  );
  const unassigned = materials.value.filter(
    (item) => !(item.supplier?.id || item.brew_supplier_id?.id)
  );
  return matched.length ? matched : unassigned;
});
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
const visiblePurchaseLines = computed(() => {
  const keyword = String(draft.line_keyword || "").trim().toLowerCase();
  return (draft.lines || []).filter((line) => {
    if (draft.line_category && line.material?.brew_material_category !== draft.line_category) return false;
    if (!keyword) return true;
    return [line.product?.name, line.requisition_name, line.material?.brew_brand, line.material?.brew_specification]
      .filter(Boolean).join(" ").toLowerCase().includes(keyword);
  });
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

const metrics = computed(() => [
  { label: "库存原料种类", value: summary.value.categories?.length || 0, hint: "按原料品类查看库存" },
  { label: "临期 / 过期批次", value: `${lots.value.filter((item) => item.expiry_status === "expiring").length} / ${lots.value.filter((item) => item.expiry_status === "expired").length}`, hint: "临期按未来 30 天" },
  { label: "待审批需求", value: requisitions.value.filter((item) => item.state === "submitted").length, hint: "审批统一在我的任务处理" },
  { label: "待下单", value: requisitions.value.filter((item) => item.state === "approved" && item.lines.some((line) => remaining(line) > 0)).length, hint: "已批准未转订单" },
  { label: "在途采购", value: orders.value.filter((item) => item.state === "purchase").length, hint: "已下单未关闭" },
  { label: "待质检 / 盘点中", value: `${inspections.value.filter((item) => item.state === "draft").length} / ${counts.value.filter((item) => ["counting", "pending_approval"].includes(item.state)).length}`, hint: "库存作业待处理项" }
]);
const inventoryCategories = computed(() => summary.value.categories || []);
const stockHealth = computed(() => [
  { key: "expired", label: "已过期", value: lots.value.filter((item) => item.expiry_status === "expired").length, hint: "批次不可用", filter: { expiry_status: "expired" } },
  { key: "expiring", label: "30 天内到期", value: lots.value.filter((item) => item.expiry_status === "expiring").length, hint: "优先使用", filter: { expiry_status: "expiring" } },
  { key: "pending_quality", label: "待质检", value: lots.value.filter((item) => item.available_reason === "pending_quality").length, hint: "质检合格后可用", filter: { issue: "pending_quality" } },
  { key: "frozen", label: "已冻结", value: lots.value.filter((item) => item.available_reason === "frozen").length, hint: "解冻后可用", filter: { issue: "frozen" } },
  { key: "fully_reserved", label: "全部预占", value: lots.value.filter((item) => item.available_reason === "fully_reserved").length, hint: "生产领料已占用", filter: { issue: "fully_reserved" } }
]);
function showCategoryInventory(category) {
  Object.assign(lotFilters, { keyword: "", category: category.category || "", supplier_id: "", factory_id: "", location_id: "", expiry_status: "", availability: "", issue: "" });
  tab.value = "inventory";
  loadLots();
}
function showHealthInventory(item) {
  Object.assign(lotFilters, { keyword: "", category: "", supplier_id: "", factory_id: "", location_id: "", expiry_status: "", availability: "", issue: "", ...item.filter });
  tab.value = "inventory";
  loadLots();
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

async function load() {
  loading.value = true;
  error.value = "";
  const jobs = [
    [summary, brewApi.getInventorySummary()],
    [lots, brewApi.listInventoryLots({ page_size: 100 })],
    [requisitions, brewApi.listPurchaseRequisitions({ page_size: 100 }).then((r) => { requisitionTotal.value = r.meta?.total || r.data.length; return r.data; })],
    [orders, brewApi.listPurchaseOrders({ page_size: 100 }).then((r) => { orderTotal.value = r.meta?.total || r.data.length; return r.data; })],
    [receipts, brewApi.listReceipts({ page_size: 100 }).then((r) => { receiptTotal.value = r.meta?.total || r.data.length; return r.data; })],
    [inspections, brewApi.listQualityInspections({ page_size: 100 }).then((r) => { inspectionTotal.value = r.meta?.total || r.data.length; return r.data; })],
    [counts, brewApi.listInventoryCounts({ page_size: 100 })],
    [materialRequisitions, brewApi.listMaterialRequisitions({ page_size: 100 })],
    [factories, brewApi.listMaster("factories", { page_size: 100, active: true })],
    [materials, brewApi.listMaster("materials", { page_size: 100, active: true })],
    [suppliers, brewApi.listMaster("suppliers", { page_size: 100, active: true })],
    [locations, brewApi.listMaster("locations", { page_size: 100, active: true })],
    [materialCategories, brewApi.listMaster("material-categories", { page_size: 100, active: true })]
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
async function loadSourcePlans(resetPage = true) {
  shortageLoading.value = true;
  error.value = "";
  try {
    const params = {};
    Object.entries(shortageFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    sourcePlans.value = await brewApi.listPurchaseSourcePlans(params);
    selectedShortages.value = [];
    if (resetPage) shortagePage.value = 1;
  } catch (cause) {
    error.value = cause.message || "生产缺口加载失败";
  } finally {
    shortageLoading.value = false;
  }
}
function resetShortageFilters() {
  Object.keys(shortageFilters).forEach((key) => { shortageFilters[key] = ""; });
  loadSourcePlans(true);
}
function toggleAllShortages(event) {
  selectedShortages.value = event.target.checked ? requestableShortageRows.value.map((item) => item.request_key) : [];
}
async function loadRequisitions(page, pageSize) {
  const p = page || requisitionPage.value;
  const s = pageSize || requisitionPageSize.value;
  requisitionLoading.value = true;
  error.value = "";
  try {
    const params = { page: p, page_size: s };
    Object.entries(requisitionFilters).forEach(([key, value]) => { if (value) params[key] = value; });
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
function resetRequisitionFilters() {
  Object.keys(requisitionFilters).forEach((key) => { requisitionFilters[key] = ""; });
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
  const p = page || receiptPage.value;
  const s = pageSize || receiptPageSize.value;
  receiptLoading.value = true;
  error.value = "";
  try {
    const params = { page: p, page_size: s };
    Object.entries(receiptFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    const result = await brewApi.listReceipts(params);
    receipts.value = result.data;
    paginatedReceipts.value = result.data;
    receiptTotal.value = result.meta?.total || result.data.length;
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
    inspections.value = result.data;
    paginatedInspections.value = result.data;
    inspectionTotal.value = result.meta?.total || result.data.length;
  } catch (cause) {
    error.value = cause.message || "质检单加载失败";
  } finally {
    inspectionLoading.value = false;
  }
}
function resetInspectionFilters() {
  Object.keys(inspectionFilters).forEach((key) => { inspectionFilters[key] = ""; });
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
function changeEmergencySupplier() {
  draft.lines = (draft.lines || []).map((line) => (
    emergencyMaterials.value.some((item) => String(item.id) === String(line.material_id))
      ? line
      : { material_id: "", quantity: "" }
  ));
}
function openPlan() {
  if (!selectedShortageRows.value.length) {
    error.value = "请先勾选需要生成采购需求的生产缺口";
    return;
  }
  resetDraft({ items: selectedShortageRows.value, need_date: today(), reason: "生产计划缺料汇总" });
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
    .filter((item) => item.state === "approved")
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
    line_keyword: "",
    line_category: "",
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
      order_edit_candidate_id: "",
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
function addOrderEditLine() {
  const candidate = availableOrderEditLines.value.find((item) => String(item.id) === String(draft.order_edit_candidate_id));
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
  draft.order_edit_candidate_id = "";
}
function removeOrderEditLine(index) {
  draft.lines.splice(index, 1);
}
async function openRequisitionDetail(requisition) {
  try {
    resetDraft({ requisition: await brewApi.getPurchaseRequisition(requisition.id) });
    modal.value = "requisition-detail";
  } catch (cause) {
    error.value = cause.message || "采购需求详情加载失败";
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
function openReceipt(order) {
  const scoped = locations.value.filter((item) => String(item.brew_factory_id?.id || "") === String(order.factory?.id || ""));
  const firstMaterial = materials.value.find((item) => String(item.product_variant_id) === String(order.lines?.[0]?.product?.id));
  const destinationType = firstMaterial?.brew_item_type === "packaging_material" ? "packaging" : "raw_material";
  resetDraft({
    order, qc_location_id: scoped.find((item) => item.brew_location_type === "qc")?.id || "",
    destination_location_id: scoped.find((item) => item.brew_location_type === destinationType && item.usage === "internal")?.id || scoped.find((item) => item.brew_location_type !== "qc" && item.usage === "internal")?.id || "",
    lines: order.lines
      .filter((line) => Number(line.remaining_receipt_qty || 0) > 0)
      .map((line) => ({
        ...line,
        prior_received_qty: Number(line.received_qty || 0),
        received_qty: Number(line.remaining_receipt_qty || 0),
        internal_batch: "提交后系统生成",
        supplier_lot: "",
        expiration_date: ""
      }))
  });
  modal.value = "receipt";
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
    const order = await brewApi.getPurchaseOrder(current.purchase_order.id);
    resetDraft({
      receipt: current,
      order,
      qc_location_id: current.qc_location?.id || "",
      destination_location_id: current.destination_location?.id || "",
      note: current.note || "",
      lines: current.lines.map((line) => ({
        id: line.id,
        order_line_id: line.order_line_id,
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
  const rows = paginatedReceipts.value.map((item, i) => ({
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
function materialFor(id) { return materials.value.find((item) => String(item.id) === String(id)); }

async function submitModal() {
  saving.value = true; modalError.value = "";
  try {
    if (modal.value === "emergency") {
      if (!draft.supplier_id || !draft.factory_id || !draft.need_date) {
        throw new Error("请完整选择供应商、厂区和需求日期");
      }
      if (!String(draft.emergency_reason || "").trim()) throw new Error("请填写紧急原因");
      if (!draft.lines.length || draft.lines.some((line) => !line.material_id || Number(line.quantity) <= 0)) {
        throw new Error("请完整填写采购需求明细，数量必须大于 0");
      }
      await brewApi.createPurchaseRequisition({
        supplier_id: draft.supplier_id, factory_id: draft.factory_id, need_date: draft.need_date, request_type: "emergency",
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
      await brewApi.aggregatePurchaseRequisitions({
        items: draft.items.map((item) => ({ plan_id: item.plan.id, product_id: item.product.id })),
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
      if (draft.resubmit) {
        await brewApi.purchaseOrderAction(updated.id, "submit", {
          version: updated.version,
          resubmit_note: String(draft.resubmit_note).trim()
        });
      }
    } else if (modal.value === "receipt") {
      if (!draft.lines.length) throw new Error("该采购单已经没有待收货明细");
      await brewApi.createReceipt({
        purchase_order_id: draft.order.id, qc_location_id: draft.qc_location_id,
        destination_location_id: draft.destination_location_id,
        lines: draft.lines.map((line) => ({ order_line_id: line.id, received_qty: Number(line.received_qty), supplier_lot: line.supplier_lot, expiration_date: line.expiration_date || null }))
      });
    } else if (modal.value === "receipt-edit") {
      if (!draft.qc_location_id || !draft.destination_location_id) throw new Error("请选择待检库位和入库库位");
      if (!draft.lines.length) throw new Error("请至少保留一条收货明细");
      if (draft.lines.some((line) => !line.order_line_id || Number(line.received_qty) <= 0)) {
        throw new Error("收货明细和实收数量不能为空");
      }
      await brewApi.updateReceipt(draft.receipt.id, {
        version: draft.receipt.version,
        qc_location_id: draft.qc_location_id,
        destination_location_id: draft.destination_location_id,
        note: draft.note,
        lines: draft.lines.map((line) => ({
          ...(line.id ? { id: line.id } : {}),
          order_line_id: line.order_line_id,
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
        if (qualified < 0 || rejected < 0 || Math.abs(qualified + rejected - inspected) > 0.000001) {
          throw new Error(`${line.product?.name || "该物料"} 的合格与不合格数量之和必须等于检验数量 ${inspected}`);
        }
        if (rejected > 0 && !line.disposition) {
          throw new Error(`${line.product?.name || "该物料"} 存在不合格数量，请选择退货或报损`);
        }
      }
      const updated = await brewApi.updateQualityResults(draft.inspection.id, {
        version: draft.inspection.version, note: draft.note,
        lines: draft.lines.map((line) => ({ id: line.id, qualified_qty: Number(line.qualified_qty), rejected_qty: Number(line.rejected_qty), disposition: Number(line.rejected_qty) ? line.disposition : null, result_json: "{}", note: line.note }))
      });
      await brewApi.qualityInspectionAction(updated.id, "submit", {
        version: updated.version,
        submission_comment: String(draft.submission_comment || "").trim()
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
        await brewApi.updatePurchaseReturn(draft.returnRecord.id, { version: draft.returnRecord.version, ...payload });
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
    emit("toast", "操作已完成"); modal.value = ""; await load(); if (paginatedRequisitions.value.length || requisitionTotal.value) await loadRequisitions(); if (paginatedOrders.value.length || orderTotal.value) await loadOrders(); if (paginatedReceipts.value.length || receiptTotal.value) await loadReceipts(); if (paginatedInspections.value.length || inspectionTotal.value) await loadInspections(); if (paginatedReturns.value.length || returnTotal.value) await loadReturns();
  } catch (cause) { modalError.value = cause.message || "操作失败"; }
  finally { saving.value = false; }
}
async function runAction(callback, success) {
  try { await callback(); emit("toast", success); await load(); if (paginatedRequisitions.value.length || requisitionTotal.value) await loadRequisitions(); if (paginatedOrders.value.length || orderTotal.value) await loadOrders(); if (paginatedReceipts.value.length || receiptTotal.value) await loadReceipts(); if (paginatedInspections.value.length || inspectionTotal.value) await loadInspections(); if (paginatedReturns.value.length || returnTotal.value) await loadReturns(); }
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
onMounted(load);
watch(tab, (newTab) => {
  if (newTab === "shortages" && !sourcePlans.value.length) loadSourcePlans();
  if (newTab === "requisitions" && !paginatedRequisitions.value.length) loadRequisitions();
  if (newTab === "orders" && !paginatedOrders.value.length) loadOrders();
  if (newTab === "receiving" && !paginatedReceipts.value.length) { loadReceipts(); loadInspections(); }
  if (newTab === "returns" && !paginatedReturns.value.length) loadReturns();
});
</script>

<template>
  <div class="inventory-workbench">
    <div class="inventory-tabs"><button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">{{ item.label }}</button><button v-if="tab !== 'stock'" class="inventory-tab-refresh" type="button" :disabled="loading" @click="load" aria-label="刷新当前数据">↻ 刷新</button></div>
    <div v-if="error" class="master-error inventory-error">{{ error }}</div>

    <StockBrowserPage v-if="tab === 'stock'" />

    <template v-else-if="tab === 'overview'">
      <div class="inventory-metric-grid"><div v-for="item in metrics" :key="item.label" class="inventory-metric"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.hint }}</small></div></div>
      <section class="inventory-section"><header><div><h3>分类库存</h3><p>不同单位不做无意义汇总，按原料种类查看数量与批次</p></div><span>{{ inventoryCategories.length }} 类</span></header><div class="inventory-category-grid"><button v-for="item in inventoryCategories" :key="item.category" type="button" @click="showCategoryInventory(item)"><span>{{ item.category_name }}</span><strong>{{ item.uom === '多单位' ? item.product_count + ' 种原料' : number(item.available,3) + ' ' + item.uom }}</strong><small>账面 {{ item.uom === '多单位' ? item.lot_count + ' 个批次' : number(item.on_hand,3) }} · 预占 {{ item.uom === '多单位' ? '按明细查看' : number(item.reserved,3) }}</small><em>查看 {{ item.product_count }} 种原料 / {{ item.lot_count }} 个批次 ›</em></button><div v-if="!inventoryCategories.length" class="inventory-empty">暂无库存分类数据</div></div></section>
      <section class="inventory-section"><header><div><h3>库存健康度</h3><p>按问题批次展示原因；可用库存指合格、未过期、未冻结且未被领料预占的数量</p></div></header><div class="stock-health"><button v-for="item in stockHealth" :key="item.key" type="button" @click="showHealthInventory(item)"><span>{{ item.label }}</span><strong>{{ item.value }} 个批次</strong><small>{{ item.hint }}</small><em>查看明细 ›</em></button></div></section>
    </template>

    <section v-else-if="tab === 'shortages'" class="inventory-section">
      <header><div><h3>生产缺口</h3><p>按计划和原料定位真实缺口，已生成采购需求的数量不会重复申请</p></div><div class="section-actions"><span class="selection-summary">已选 {{ selectedShortageRows.length }} 项</span><button v-if="canPurchase" class="btn btn-sm btn-primary" :disabled="!selectedShortageRows.length" @click="openPlan">生成采购需求单</button></div></header>
      <div class="procurement-filters shortage-filters">
        <select v-model="shortageFilters.category_group" @change="shortageFilters.category_code = ''"><option value="">全部原料品类</option><option v-for="item in materialGroupOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select>
        <select v-model="shortageFilters.category_code"><option value="">全部原料种类</option><option v-for="item in materialTypeOptions" :key="item.id" :value="item.code">{{ item.name }}</option></select>
        <input v-model.trim="shortageFilters.plan_no" placeholder="生产计划编号" @keyup.enter="loadSourcePlans">
        <label class="date-filter"><span>生产时间</span><input v-model="shortageFilters.date_from" type="date" aria-label="生产开始日期" @click="openDatePicker"><b>至</b><input v-model="shortageFilters.date_to" type="date" aria-label="生产结束日期" @click="openDatePicker"></label>
        <button class="btn btn-sm btn-outline" type="button" @click="resetShortageFilters">重置</button><button class="btn btn-sm btn-primary" type="button" :disabled="shortageLoading" @click="loadSourcePlans">查询</button>
      </div>
      <div class="work-table-wrap"><table class="work-table shortage-table"><thead><tr><th><input type="checkbox" :checked="requestableShortageRows.length && selectedShortageRows.length === requestableShortageRows.length" @change="toggleAllShortages"></th><th>原料品类 / 种类</th><th>原料名称</th><th>生产计划 / 产品</th><th>生产时间</th><th>计划需求</th><th>可分配库存</th><th>生产缺口</th><th>已生成需求</th><th>状态</th></tr></thead><tbody>
        <tr v-for="item in paginatedShortageRows" :key="item.request_key"><td><input v-model="selectedShortages" type="checkbox" :value="item.request_key" :disabled="Number(item.requestable_qty) <= 0"></td><td>{{ item.category?.group_name || '-' }}<small>{{ item.category?.name || '-' }}</small></td><td><strong>{{ item.product?.name }}</strong><small>{{ item.product?.brand || '无品牌' }} · {{ item.product?.specification || '未设置规格' }}</small></td><td><button class="record-link record-link-main" type="button" @click="selectedPlanId = item.plan.id">{{ item.plan.name }} · {{ item.plan.product?.name }}</button><small>{{ item.plan.factory?.name }}</small></td><td>{{ dateTime(item.plan.planned_start) }}<small>至 {{ dateTime(item.plan.planned_end) }}</small></td><td>{{ number(item.required,3) }} {{ item.uom }}</td><td>{{ number(item.allocated,3) }}</td><td><strong>{{ number(item.shortage,3) }}</strong><small>本次可申请 {{ number(item.requestable_qty,3) }}</small></td><td><div v-if="item.linked_requisitions?.length" class="record-links"><button v-for="req in item.linked_requisitions" :key="req.id" class="record-link" type="button" @click="openRequisitionDetail(req)">{{ req.name }}<small>{{ number(req.quantity,3) }} · {{ stateText(req.state) }}</small></button></div><span v-else>{{ number(item.requested_qty,3) }}</span></td><td><span class="state-pill" :data-state="item.request_status">{{ requestStatusText(item.request_status) }}</span></td></tr>
        <tr v-if="!paginatedShortageRows.length"><td colspan="10" class="inventory-empty">当前条件下没有生产缺口</td></tr>
      </tbody></table></div>
      <footer class="proc-pagination">
        <span>共 {{ shortageTotal }} 条</span>
        <select :value="shortagePageSize" @change="changeShortagePageSize($event.target.value)">
          <option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }} 条/页</option>
        </select>
        <button class="btn btn-xs btn-outline" :disabled="shortagePage<=1" @click="shortagePage--">上一页</button>
        <span>{{ shortagePage }} / {{ Math.max(1, Math.ceil(shortageTotal / shortagePageSize)) }}</span>
        <button class="btn btn-xs btn-outline" :disabled="shortagePage*shortagePageSize>=shortageTotal" @click="shortagePage++">下一页</button>
      </footer>
    </section>

    <section v-else-if="tab === 'requisitions'" class="inventory-section">
      <header><div><h3>采购需求</h3><p>查看需求从发起、审批到关联采购单的完整进展，审批操作统一在“我的任务”处理</p></div><div class="section-actions"><button v-if="canPurchase" class="btn btn-sm btn-outline" @click="openEmergency">新建紧急采购需求</button><button v-if="canPurchase" class="btn btn-sm btn-primary" @click="openOrder()">从需求生成采购单</button></div></header>
      <div class="procurement-filters requisition-filters">
        <input v-model.trim="requisitionFilters.keyword" placeholder="需求单号 / 原料名称" @keyup.enter="requisitionPage=1;loadRequisitions()">
        <input v-model.trim="requisitionFilters.requester_name" placeholder="申请人" @keyup.enter="requisitionPage=1;loadRequisitions()">
        <select v-model="requisitionFilters.factory_id" @change="requisitionPage=1;loadRequisitions()"><option value="">全部厂区</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select>
        <select v-model="requisitionFilters.request_type" @change="requisitionPage=1;loadRequisitions()"><option value="">全部来源</option><option value="planned">计划缺料</option><option value="emergency">紧急采购</option></select>
        <select v-model="requisitionFilters.state" @change="requisitionPage=1;loadRequisitions()"><option value="">全部状态</option><option value="draft">草稿</option><option value="submitted">待审批</option><option value="approved">已批准</option><option value="returned">已退回</option><option value="ordered">已转订单</option><option value="closed">已关闭</option><option value="cancelled">已取消</option></select>
        <label class="date-filter"><span>需求日期</span><input v-model="requisitionFilters.date_from" type="date" @click="openDatePicker"><b>至</b><input v-model="requisitionFilters.date_to" type="date" @click="openDatePicker"></label>
        <button class="btn btn-sm btn-outline" @click="resetRequisitionFilters">重置</button>
        <button class="btn btn-sm btn-primary" :disabled="requisitionLoading" @click="requisitionPage=1;loadRequisitions()">查询</button>
      </div>
      <div class="work-table-wrap"><table class="work-table requisition-table"><thead><tr><th>序号</th><th>采购需求单</th><th>来源</th><th>申请人 / 厂区</th><th>需求日期</th><th>物料</th><th>当前进度</th><th>关联采购单</th><th>操作</th></tr></thead><tbody><tr v-for="(item,index) in paginatedRequisitions" :key="item.id"><td>{{ (requisitionPage - 1) * requisitionPageSize + index + 1 }}</td><td><button class="record-link record-link-main" type="button" @click="openRequisitionDetail(item)">{{ item.name }}</button><small>{{ item.preferred_supplier?.name || '未指定建议供应商' }}</small></td><td><span class="source-badge" :class="{ emergency: item.request_type === 'emergency' }">{{ requestType(item) }}</span><small>{{ item.emergency_reason || item.reason || '-' }}</small></td><td>{{ item.requester?.name || '-' }}<small>{{ item.factory?.name || '-' }}</small></td><td>{{ item.need_date || '-' }}</td><td><strong>{{ item.lines.length }} 项</strong><small>{{ item.lines.map(line => line.product?.name).join('、') }}</small></td><td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span><small v-if="item.return_reason">退回：{{ item.return_reason }}</small></td><td><div v-if="item.orders?.length" class="record-links"><button v-for="order in item.orders" :key="order.id" class="record-link" type="button" @click="openOrderDetail(order)">{{ order.name }}<small>{{ receiptStateText(order.receipt_state) }}</small></button></div><span v-else>尚未生成</span></td><td class="row-actions"><button class="btn btn-xs btn-outline" @click="openRequisitionDetail(item)">查看进展</button><button v-if="canPurchase && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-outline" @click="openRequisitionEdit(item)">编辑</button><button v-if="canPurchase && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-primary" @click="requisitionAction(item,'submit')">提交审批</button><button v-if="canPurchase && item.state === 'approved' && item.lines.some(line => remaining(line) > 0)" class="btn btn-xs btn-primary" @click="openOrder(item)">生成采购单</button></td></tr><tr v-if="!paginatedRequisitions.length"><td colspan="9" class="inventory-empty">暂无采购需求</td></tr></tbody></table></div>
      <footer class="proc-pagination">
        <span>共 {{ requisitionTotal }} 条</span>
        <select :value="requisitionPageSize" @change="changeRequisitionPageSize($event.target.value)">
          <option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }} 条/页</option>
        </select>
        <button class="btn btn-xs btn-outline" :disabled="requisitionPage<=1||requisitionLoading" @click="requisitionPage--;loadRequisitions()">上一页</button>
        <span>{{ requisitionPage }} / {{ Math.max(1, Math.ceil(requisitionTotal / requisitionPageSize)) }}</span>
        <button class="btn btn-xs btn-outline" :disabled="requisitionPage*requisitionPageSize>=requisitionTotal||requisitionLoading" @click="requisitionPage++;loadRequisitions()">下一页</button>
      </footer>
    </section>

    <section v-else-if="tab === 'orders'" class="inventory-section">
      <header><div><h3>采购执行</h3><p>跟踪已生成采购单的审批、下单、收货与关闭状态</p></div><div class="section-actions"><button v-if="canPurchase" class="btn btn-sm btn-primary" @click="openOrder()">新增采购单</button><button v-if="canExport" class="btn btn-sm btn-outline" @click="createExport">导出</button></div></header>
      <div class="procurement-filters order-filters"><input v-model.trim="orderFilters.supplier_name" placeholder="供应商名称" @keyup.enter="orderPage=1;loadOrders()"><input v-model.trim="orderFilters.order_no" placeholder="采购单号" @keyup.enter="orderPage=1;loadOrders()"><select v-model="orderFilters.receipt_state" @change="orderPage=1;loadOrders()"><option value="">全部收货状态</option><option value="not_received">未收货</option><option value="partial">部分收货</option><option value="receiving">收货处理中</option><option value="received">已收货</option></select><button class="btn btn-sm btn-outline" @click="resetOrderFilters">重置</button><button class="btn btn-sm btn-primary" :disabled="orderLoading" @click="orderPage=1;loadOrders()">查询</button></div>
      <div class="work-table-wrap"><table class="work-table purchase-order-table"><thead><tr><th>序号</th><th>采购需求单号</th><th>采购单号</th><th>供应商</th><th>下单人</th><th>采购金额</th><th>预期到货</th><th>下单日期</th><th>审批状态</th><th>收货状态</th><th>操作</th></tr></thead><tbody>
        <tr v-for="(item,index) in paginatedOrders" :key="item.id"><td>{{ (orderPage - 1) * orderPageSize + index + 1 }}</td><td><div v-if="item.requisitions?.length" class="record-links"><button v-for="req in item.requisitions" :key="req.id" class="record-link" type="button" @click="openRequisitionDetail(req)">{{ req.name }}</button></div><span v-else>-</span><small>{{ orderType(item) }}</small></td><td><button class="record-link record-link-main" type="button" @click="openOrderDetail(item)">{{ item.name }}</button><small>{{ stateText(item.state) }}</small></td><td>{{ item.supplier?.name || '-' }}<small>{{ item.supplier?.code || '-' }}</small></td><td>{{ item.purchaser?.name || '-' }}</td><td><strong>{{ number(item.amount_total) }}</strong><small>{{ item.currency }}</small></td><td>{{ item.expected_arrival_date || '-' }}</td><td>{{ dateTime(item.order_date) }}</td><td><span class="state-pill" :data-state="item.approval_state">{{ stateText(item.approval_state) }}</span></td><td><span class="state-pill" :data-state="item.receipt_state">{{ receiptStateText(item.receipt_state) }}</span></td><td class="row-actions"><button class="btn btn-xs btn-outline" @click="openOrderDetail(item)">查看详情</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'none'" class="btn btn-xs btn-outline" @click="openOrderEdit(item)">编辑</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'none'" class="btn btn-xs btn-primary" @click="orderAction(item,'submit')">提交审批</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'returned'" class="btn btn-xs btn-primary" @click="openOrderEdit(item)">编辑并重新提交</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'approved'" class="btn btn-xs btn-primary" @click="orderAction(item,'place')">正式下单</button><button v-if="canWarehouse && item.can_receive" class="btn btn-xs btn-outline" @click="openReceipt(item)">登记收货</button><button v-if="canPurchase && item.state === 'purchase'" class="btn btn-xs btn-outline" @click="orderAction(item,'close')">关闭</button></td></tr>
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
      <section class="inventory-section">
        <header><div><h3>收货单</h3><p>到货先进入待检库位，质检完成后才可正式入库</p></div><div class="section-actions"><button v-if="canExport" class="btn btn-sm btn-outline" @click="exportReceipts">导出</button></div></header>
        <div class="procurement-filters receipt-filters"><input v-model.trim="receiptFilters.keyword" placeholder="收货单号 / 采购单号 / 原料" @keyup.enter="receiptPage=1;loadReceipts()"><input v-model.trim="receiptFilters.supplier_name" placeholder="供应商名称" @keyup.enter="receiptPage=1;loadReceipts()"><select v-model="receiptFilters.factory_id" @change="receiptPage=1;loadReceipts()"><option value="">全部仓库</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select><select v-model="receiptFilters.state" @change="receiptPage=1;loadReceipts()"><option value="">全部状态</option><option value="draft">草稿</option><option value="pending_approval">超收待审批</option><option value="arrived">到货待检</option><option value="inspected">已质检</option><option value="done">已完成</option></select><button class="btn btn-sm btn-outline" @click="resetReceiptFilters">重置</button><button class="btn btn-sm btn-primary" :disabled="receiptLoading" @click="receiptPage=1;loadReceipts()">查询</button></div>
        <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>收货单号</th><th>采购订单</th><th>供应商</th><th>仓库</th><th>本次收货</th><th>收货时间</th><th>制单人</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="(item,index) in paginatedReceipts" :key="item.id">
            <td>{{ (receiptPage - 1) * receiptPageSize + index + 1 }}</td>
            <td><strong>{{ item.name }}</strong></td>
            <td><button v-if="item.purchase_order" class="record-link" type="button" @click="openOrderDetail(item.purchase_order)">{{ item.purchase_order.name }}</button><span v-else>-</span></td>
            <td>{{ item.supplier?.name || '-' }}<small>{{ item.supplier?.code || '' }}</small></td>
            <td>{{ item.factory?.name || '-' }}</td>
            <td>总 {{ number(item.total_received,3) }}<small>合格 {{ number(item.total_qualified,3) }} / 不合格 {{ number(item.total_rejected,3) }}</small></td>
            <td>{{ dateTime(item.create_date) }}</td>
            <td>{{ item.creator || '-' }}</td>
            <td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span><small v-if="item.return_reason" style="display:block;color:#ef5350">退回：{{ item.return_reason }}</small></td>
            <td class="row-actions">
              <button class="btn btn-xs btn-outline" @click="openReceiptDetail(item)">查看详情</button>
              <button v-if="canWarehouse && item.state === 'draft'" class="btn btn-xs btn-primary" @click="receiptAction(item,'confirm-arrival')">确认到货</button>
              <button v-if="canWarehouse && (item.state === 'draft' || (item.state === 'pending_approval' && item.approval_state === 'returned'))" class="btn btn-xs btn-outline" @click="openReceiptEdit(item)">编辑</button>
              <button v-if="canWarehouse && item.state === 'pending_approval' && item.approval_state === 'returned'" class="btn btn-xs btn-primary" @click="receiptAction(item,'confirm-arrival')">重新提交</button>
              <button v-if="canWarehouse && item.state === 'inspected'" class="btn btn-xs btn-primary" @click="receiptAction(item,'put-away')">完成入库</button>
            </td>
          </tr>
          <tr v-if="!paginatedReceipts.length"><td colspan="10" class="inventory-empty">暂无收货记录</td></tr>
        </tbody></table></div>
        <footer class="proc-pagination">
          <span>共 {{ receiptTotal }} 条</span>
          <select :value="receiptPageSize" @change="changeReceiptPageSize($event.target.value)"><option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }} 条/页</option></select>
          <button class="btn btn-xs btn-outline" :disabled="receiptPage<=1||receiptLoading" @click="receiptPage--;loadReceipts()">上一页</button>
          <span>{{ receiptPage }} / {{ Math.max(1, Math.ceil(receiptTotal / receiptPageSize)) }}</span>
          <button class="btn btn-xs btn-outline" :disabled="receiptPage*receiptPageSize>=receiptTotal||receiptLoading" @click="receiptPage++;loadReceipts()">下一页</button>
        </footer>
      </section>
      <section class="inventory-section">
        <header><div><h3>质检单</h3><p>不合格数量必须选择退回供应商或报损</p></div></header>
        <div class="procurement-filters inspection-filters"><input v-model.trim="inspectionFilters.keyword" placeholder="质检单号 / 收货单号 / 原料" @keyup.enter="inspectionPage=1;loadInspections()"><input v-model.trim="inspectionFilters.supplier_name" placeholder="供应商名称" @keyup.enter="inspectionPage=1;loadInspections()"><select v-model="inspectionFilters.factory_id" @change="inspectionPage=1;loadInspections()"><option value="">全部仓库</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select><select v-model="inspectionFilters.state" @change="inspectionPage=1;loadInspections()"><option value="">全部状态</option><option value="draft">待录入</option><option value="submitted">待审批</option><option value="returned">已退回</option><option value="completed">已通过</option></select><button class="btn btn-sm btn-outline" @click="resetInspectionFilters">重置</button><button class="btn btn-sm btn-primary" :disabled="inspectionLoading" @click="inspectionPage=1;loadInspections()">查询</button></div>
        <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>质检单号</th><th>收货单号</th><th>供应商</th><th>检验结果</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="(item,index) in paginatedInspections" :key="item.id">
            <td>{{ (inspectionPage - 1) * inspectionPageSize + index + 1 }}</td>
            <td><strong>{{ item.name }}</strong></td>
            <td><button v-if="item.receipt_id" class="record-link" type="button" @click="openReceiptDetail({ id: item.receipt_id })">{{ item.receipt_name }}</button><span v-else>-</span></td>
            <td>{{ item.supplier?.name || '-' }}</td>
            <td>合格 {{ number(item.total_qualified || item.lines?.reduce((n,l)=>n+Number(l.qualified_qty||0),0),3) }} / 不合格 {{ number(item.total_rejected || item.lines?.reduce((n,l)=>n+Number(l.rejected_qty||0),0),3) }}</td>
            <td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span></td>
            <td class="row-actions">
              <button class="btn btn-xs btn-outline" @click="openInspectionDetail(item)">查看详情</button>
              <button v-if="canWarehouse && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-primary" @click="openQuality(item)">{{ item.state === 'returned' ? '修改并重新提交' : '录入并提交审批' }}</button>
            </td>
          </tr>
          <tr v-if="!paginatedInspections.length"><td colspan="7" class="inventory-empty">暂无质检记录</td></tr>
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
      <section class="inventory-section">
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

    <template v-else-if="tab === 'inventory'">
      <section class="inventory-section">
        <header><div><h3>批次库存</h3><p>按批次、物料分类、采购供应商和效期快速定位库存</p></div><button class="btn btn-sm btn-outline" type="button" :disabled="lotLoading" @click="loadLots">刷新</button></header>
        <div class="inventory-filters">
          <input v-model.trim="lotFilters.keyword" placeholder="搜索批次、供应商批号或物料" @keyup.enter="loadLots">
          <select v-model="lotFilters.category"><option value="">全部种类</option><option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select>
          <select v-model="lotFilters.supplier_id"><option value="">全部厂家/供应商</option><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select>
          <select v-model="lotFilters.factory_id"><option value="">全部厂区</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select>
          <select v-model="lotFilters.location_id"><option value="">全部库位</option><option v-for="item in filterLocations" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select>
          <select v-model="lotFilters.expiry_status"><option value="">全部效期</option><option value="expired">已过期</option><option value="expiring">30天内到期</option><option value="normal">效期正常</option><option value="no_expiration">未设置效期</option></select>
          <select v-model="lotFilters.availability"><option value="">全部库存</option><option value="available">有可用库存</option><option value="unavailable">可用为0</option><option value="abnormal">只看效期/库存异常</option></select>
          <button class="btn btn-sm btn-outline" type="button" @click="resetLotFilters">清空筛选</button>
          <button class="btn btn-sm btn-primary" type="button" @click="loadLots">应用筛选</button>
        </div>
        <div class="work-table-wrap"><table class="work-table"><thead><tr><th>物料 / 批次</th><th>厂家/供应商</th><th>效期</th><th>账面</th><th>预占</th><th>可用</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in visibleLots" :key="item.id"><td><strong>{{ item.product?.name }}</strong><small>{{ item.name }} · {{ item.supplier_lot || '无供应商批号' }}</small></td><td>{{ item.supplier?.name || '-' }}<small>{{ item.product?.material_category_name || item.product?.category || '-' }}</small></td><td><span class="expiry-badge" :data-status="item.expiry_status">{{ expiryText(item) }}</span><small>{{ item.expiration_date || '未设置' }}</small></td><td>{{ number(item.on_hand,3) }} {{ item.uom }}</td><td>{{ number(item.reserved,3) }}</td><td><strong>{{ number(item.available,3) }}</strong><small v-if="availableReasonText(item)" class="stock-reason">{{ availableReasonText(item) }}</small></td><td>{{ item.frozen ? '已冻结' : stateText(item.quality_status) }}</td><td><button v-if="canWarehouse" class="btn btn-xs btn-outline" @click="toggleLot(item)">{{ item.frozen ? '解冻' : '冻结' }}</button></td></tr><tr v-if="!visibleLots.length"><td colspan="8" class="inventory-empty">没有匹配的批次库存</td></tr></tbody></table></div>
      </section>
      <section class="inventory-section"><header><div><h3>领料与退料</h3><p>仓库推进推荐批次和发料，实领/退料由生产侧确认</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>领料单</th><th>生产计划</th><th>物料项</th><th>状态</th><th>仓库操作</th></tr></thead><tbody><tr v-for="item in materialRequisitions" :key="item.id"><td><strong>{{ item.name }}</strong></td><td>{{ item.production_plan?.name }}</td><td>{{ item.lines.length }} 项</td><td>{{ stateText(item.state) }}</td><td class="row-actions"><button v-if="canWarehouse && item.state === 'draft'" class="btn btn-xs btn-outline" @click="materialAction(item,'recommend-lots')">推荐批次</button><button v-if="canWarehouse && item.state === 'recommended'" class="btn btn-xs btn-primary" @click="materialAction(item,'issue')">确认发料</button></td></tr></tbody></table></div></section>
      <section class="inventory-section"><header><div><h3>库存盘点</h3><p>先定位差异，再填写原因；提交后进入审批</p></div><button v-if="canCount" class="btn btn-sm btn-primary" @click="openCount()">新建盘点</button></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>盘点单</th><th>库位</th><th>明细</th><th>差异</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in counts" :key="item.id"><td><strong>{{ item.name }}</strong><small>{{ dateTime(item.created_at) }}</small></td><td>{{ item.location?.name }}</td><td>{{ item.lines.length }} 项</td><td>{{ number(item.lines.reduce((n,line)=>n+Math.abs(Number(line.difference_qty||0)),0),3) }}</td><td>{{ stateText(item.state) }}</td><td class="row-actions"><button v-if="canCount && item.state === 'draft'" class="btn btn-xs btn-primary" @click="countAction(item,'start')">开始</button><button v-if="canCount && item.state === 'counting'" class="btn btn-xs btn-primary" @click="openCount(item)">录入实数</button><button v-if="item.state !== 'draft' && item.state !== 'counting'" class="btn btn-xs btn-outline" @click="openCount(item)">查看差异</button><button v-if="canCount && item.state === 'pending_approval'" class="btn btn-xs btn-outline" @click="countAction(item,'confirm')">确认</button></td></tr><tr v-if="!counts.length"><td colspan="6" class="inventory-empty">暂无库存盘点</td></tr></tbody></table></div></section>
    </template>

    <section v-else class="inventory-section"><header><div><h3>采购对账准备</h3><p>核对采购订单、实际收货与质检退货后生成对账文件</p></div><button v-if="canExport" class="btn btn-sm btn-primary" @click="createExport">生成采购对账文件</button></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>采购订单</th><th>供应商</th><th>订单金额</th><th>实收数量</th><th>质检退货</th><th>状态</th></tr></thead><tbody><tr v-for="item in settlementRows" :key="item.id"><td><strong>{{ item.name }}</strong><small>{{ orderType(item) }}</small></td><td>{{ item.supplier?.name }}</td><td>{{ number(item.amount_total) }} {{ item.currency }}</td><td>{{ number(item.received,3) }}</td><td>{{ number(item.rejected,3) }}</td><td>{{ settlementStateText(item) }}</td></tr></tbody></table></div><div v-if="exports.length" class="export-history"><h4>最近导出</h4><div v-for="item in exports" :key="item.id"><span>{{ item.name }}</span><span>{{ stateText(item.state) }}</span><a v-if="item.download_url" :href="item.download_url">下载</a></div></div></section>

    <div v-if="modal" class="inventory-modal-mask" @click.self="modal = ''"><section class="inventory-modal" :class="{ 'inventory-modal-wide': ['order','order-edit','order-detail','requisition-edit','requisition-detail','count-lines','count-review','receipt-edit','receipt-detail','inspection-detail','return-edit','return-detail'].includes(modal) }"><header><div><h3>{{ modal === 'emergency' ? '新建紧急采购需求' : modal === 'requisition-edit' ? '编辑采购需求' : modal === 'plan' ? '生成采购需求单' : modal === 'order' ? '新增采购单' : modal === 'order-edit' ? (draft.resubmit ? '编辑退回采购单' : '编辑采购单') : modal === 'order-detail' ? '采购单详情' : modal === 'requisition-detail' ? '采购需求进展' : modal === 'receipt' ? '登记采购收货' : modal === 'receipt-edit' ? '编辑收货单' : modal === 'receipt-detail' ? '收货单详情' : modal === 'quality' ? '录入质检结果' : modal === 'inspection-detail' ? '质检单详情' : modal === 'return-edit' ? (draft.returnRecord ? '编辑退货单' : '新建退货单') : modal === 'return-detail' ? '退货单详情' : modal === 'count-create' ? '新建库存盘点' : modal === 'count-review' ? '盘点差异记录' : '录入盘点实数' }}</h3><p>{{ modal === 'order' ? '选择采购明细并逐行确认供应商，提交后按供应商与厂区自动拆单' : modal === 'order-edit' ? (draft.resubmit ? '修改退回内容并填写说明后重新进入审批' : '保存后仍为未提交，可继续修改或提交审批') : modal === 'requisition-edit' ? '草稿或退回状态可以修改基本信息，并增加或删除原料明细' : modal === 'receipt-edit' ? '修改退回内容，保存后可从列表重新提交审批' : ['order-detail','requisition-detail','receipt-detail','inspection-detail','return-detail'].includes(modal) ? '查看单据明细与审批记录' : modal === 'return-edit' ? '填写退货明细后保存或提交审批' : modal === 'count-review' ? '查看本次账面、实盘、差异原因及上次盘点结果' : '确认关键信息后继续' }}</p></div><button class="inventory-modal-close" type="button" @click="modal = ''">×</button></header><div class="inventory-modal-body">
      <template v-if="modal === 'emergency'"><label><span>供应商</span><select v-model="draft.supplier_id" @change="changeEmergencySupplier"><option value="">请先选择供应商</option><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>厂区</span><select v-model="draft.factory_id"><option value="">请选择</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>需求日期</span><input v-model="draft.need_date" type="date" @click="openDatePicker"></label><label><span>申请人</span><input :value="currentUser.name || currentUser.display_name || '-'" readonly></label><label class="wide"><span>紧急原因</span><textarea v-model.trim="draft.emergency_reason" rows="2"></textarea></label><div class="wide modal-lines"><div class="modal-lines-head"><div><strong>采购需求明细</strong><small>{{ draft.supplier_id ? '优先显示供应商物料，未维护时显示通用物料' : '选择供应商后可添加物料' }}</small></div><button class="btn btn-xs btn-outline" type="button" :disabled="!draft.supplier_id" @click="addEmergencyLine">添加一行</button></div><div v-for="(line,index) in draft.lines" :key="index" class="modal-line"><select v-model="line.material_id" :disabled="!draft.supplier_id"><option value="">选择原料</option><option v-for="item in emergencyMaterials" :key="item.id" :value="item.id">{{ item.name }} · {{ item.brew_brand || '无品牌' }} · {{ item.brew_specification || '无规格' }}</option></select><input v-model.number="line.quantity" type="number" min="0" step="0.001" placeholder="数量"><span>{{ materialFor(line.material_id)?.uom_id?.name || '单位' }}</span></div><div v-if="draft.supplier_id && !emergencyMaterials.length" class="inventory-empty">该供应商未维护可供原料，请先完善物料主数据</div></div></template>
      <template v-else-if="modal === 'requisition-edit'"><label><span>建议供应商</span><select v-model="draft.supplier_id"><option value="">不指定</option><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>厂区</span><select v-model="draft.factory_id" :disabled="draft.requisition.lines.some(line => line.allocations?.length)"><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>需求日期</span><input v-model="draft.need_date" type="date" @click="openDatePicker"></label><label><span>来源</span><input :value="requestType(draft.requisition)" readonly></label><label v-if="draft.requisition.request_type === 'emergency'" class="wide"><span>紧急原因</span><textarea v-model.trim="draft.emergency_reason" rows="2"></textarea></label><label class="wide"><span>申请说明</span><textarea v-model.trim="draft.reason" rows="2"></textarea></label><div class="wide modal-lines"><div class="modal-lines-head"><div><strong>采购需求明细</strong><small>可新增原料或删除不再需要的明细</small></div><button class="btn btn-xs btn-outline" type="button" @click="addRequisitionEditLine">添加一行</button></div><div v-for="(line,index) in draft.lines" :key="line.id || index" class="modal-line requisition-edit-line"><select v-model="line.material_id"><option value="">选择原料</option><option v-for="item in requisitionEditMaterials" :key="item.id" :value="item.id">{{ item.name }} · {{ item.brew_brand || '无品牌' }} · {{ item.brew_specification || '无规格' }}</option></select><input v-model.number="line.quantity" type="number" min="0.001" step="0.001" placeholder="数量"><span>{{ materialFor(line.material_id)?.uom_id?.name || '单位' }}</span><button class="btn btn-xs btn-danger" type="button" @click="removeRequisitionEditLine(index)">删除</button></div><div v-if="!draft.lines.length" class="inventory-empty">请至少添加一条采购需求明细</div></div></template>
      <template v-else-if="modal === 'plan'"><label><span>需求日期</span><input v-model="draft.need_date" type="date" @click="openDatePicker"></label><label><span>申请说明</span><input v-model.trim="draft.reason"></label><div class="wide shortage-confirm-list"><div v-for="item in draft.items" :key="item.request_key"><div><strong>{{ item.product?.name }}</strong><small>{{ item.plan.name }} · {{ item.plan.product?.name }} · {{ item.plan.factory?.name }}</small></div><span>{{ number(item.requestable_qty,3) }} {{ item.uom }}</span></div></div></template>
      <template v-else-if="modal === 'order'">
        <div class="wide purchase-basic-grid"><label><span>下单人</span><input :value="currentUser.name || currentUser.display_name || '-'" readonly></label><label><span>下单日期</span><input v-model="draft.order_date" type="date" @click="openDatePicker"></label><label><span>预期到货日期</span><input v-model="draft.expected_arrival_date" type="date" @click="openDatePicker"></label><div class="purchase-split-note"><span>预计生成</span><strong>{{ purchaseOrderGroups.length }} 张采购单</strong><small>按供应商、收货厂区和采购类型自动拆分</small></div></div>
        <div class="wide purchase-line-toolbar"><input v-model.trim="draft.line_keyword" placeholder="搜索原料、需求单、品牌或包装"><select v-model="draft.line_category"><option value="">全部原料种类</option><option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select><span>已选 {{ selectedPurchaseLines.length }} 项</span></div>
        <div class="wide work-table-wrap purchase-line-picker"><table class="work-table"><thead><tr><th>选择</th><th>原料信息</th><th>采购需求 / 厂区</th><th>供应商</th><th>品牌 / 包装</th><th>采购数量</th><th>件数</th><th>采购单价</th><th>采购金额</th><th>操作</th></tr></thead><tbody><tr v-for="line in visiblePurchaseLines" :key="line.id"><td><input v-model="line.selected" type="checkbox"></td><td><strong>{{ line.product?.name }}</strong><small>{{ line.material?.default_code || '-' }}</small></td><td>{{ line.requisition_name }}<small>{{ line.factory?.name || '-' }} · {{ requestType({ request_type: line.request_type }) }}</small></td><td><select v-model="line.supplier_id"><option value="">选择供应商</option><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select></td><td>{{ line.material?.brew_brand || '-' }}<small>{{ line.package_spec }}</small></td><td><input v-model.number="line.quantity" type="number" min="0.001" step="0.001"> {{ line.uom?.name }}</td><td><input v-model.number="line.package_count" type="number" min="1" step="1"></td><td><input v-model.number="line.price_unit" type="number" min="0" step="0.01"></td><td><strong>{{ number(Number(line.quantity || 0) * Number(line.price_unit || 0)) }}</strong></td><td><button class="btn btn-xs btn-danger" type="button" @click="removeOrderLine(line.id)">删除</button></td></tr><tr v-if="!visiblePurchaseLines.length"><td colspan="10" class="inventory-empty">没有可下单的已审批采购需求明细</td></tr></tbody></table></div>
        <div v-if="purchaseOrderGroups.length" class="wide purchase-split-summary"><div v-for="group in purchaseOrderGroups" :key="group.key"><strong>{{ group.supplier?.name || '未选择供应商' }}</strong><span>{{ group.factory?.name || '-' }} · {{ group.count }} 项 · ¥{{ number(group.amount) }}</span></div></div>
        <div class="wide purchase-total"><span>采购总金额</span><strong>¥{{ number(purchaseOrderTotal) }}</strong></div>
      </template>
      <template v-else-if="modal === 'order-edit'">
        <div class="wide purchase-basic-grid"><label><span>供应商</span><select v-model="draft.supplier_id"><option v-for="item in suppliers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>收货工厂</span><input :value="draft.order.factory?.name || '-'" readonly></label><label><span>下单日期</span><input v-model="draft.order_date" type="date" @click="openDatePicker"></label><label><span>预期到货日期</span><input v-model="draft.expected_arrival_date" type="date" @click="openDatePicker"></label></div>
        <div class="wide purchase-line-toolbar order-edit-add"><select v-model="draft.order_edit_candidate_id"><option value="">选择可追加的已批准需求明细</option><option v-for="item in availableOrderEditLines" :key="item.id" :value="item.id">{{ item.requisition_name }} · {{ item.product?.name }} · 可下单 {{ number(item.available_qty,3) }} {{ item.uom?.name }}</option></select><button class="btn btn-sm btn-outline" type="button" :disabled="!draft.order_edit_candidate_id" @click="addOrderEditLine">添加明细</button><span>只能添加同厂区、同采购类型且尚有可下单数量的需求明细</span></div>
        <div class="wide work-table-wrap purchase-line-picker"><table class="work-table"><thead><tr><th>原料</th><th>采购数量</th><th>包装</th><th>件数</th><th>采购单价</th><th>采购金额</th><th>操作</th></tr></thead><tbody><tr v-for="(line,index) in draft.lines" :key="line.id || line.key"><td><strong>{{ line.product?.name }}</strong><small>{{ line.product?.brand || '-' }}</small></td><td><input v-model.number="line.quantity" type="number" min="0.001" step="0.001"> {{ line.uom?.name }}</td><td><input v-model.trim="line.package_spec"></td><td><input v-model.number="line.package_count" type="number" min="1" step="1"></td><td><input v-model.number="line.price_unit" type="number" min="0" step="0.01"></td><td><strong>{{ number(Number(line.quantity || 0) * Number(line.price_unit || 0)) }}</strong></td><td><button class="btn btn-xs btn-danger" type="button" @click="removeOrderEditLine(index)">删除</button></td></tr><tr v-if="!draft.lines.length"><td colspan="7" class="inventory-empty">请至少添加一条采购订单明细</td></tr></tbody></table></div>
        <label v-if="draft.resubmit" class="wide"><span>修改及再次提交说明</span><textarea v-model.trim="draft.resubmit_note" rows="3" placeholder="说明本次修改内容"></textarea></label>
      </template>
      <template v-else-if="modal === 'order-detail'">
        <div class="wide order-detail-summary"><div><span>采购单号</span><strong>{{ draft.order.name }}</strong></div><div><span>采购需求单</span><strong>{{ draft.order.requisitions?.map(item => item.name).join('、') || '-' }}</strong></div><div><span>供应商</span><strong>{{ draft.order.supplier?.name }}</strong><small>{{ draft.order.supplier?.code || '-' }}</small></div><div><span>收货工厂</span><strong>{{ draft.order.factory?.name || '-' }}</strong></div><div><span>下单人 / 日期</span><strong>{{ draft.order.purchaser?.name || '-' }}</strong><small>{{ dateTime(draft.order.order_date) }}</small></div><div><span>采购金额</span><strong>{{ number(draft.order.amount_total) }} {{ draft.order.currency }}</strong></div><div><span>预期到货日期</span><strong>{{ draft.order.expected_arrival_date || '-' }}</strong></div><div><span>当前状态</span><strong>{{ stateText(draft.order.state) }}</strong><small>审批 {{ stateText(draft.order.approval_state) }} · {{ receiptStateText(draft.order.receipt_state) }}</small></div></div>
        <button v-if="canPurchase && ['none','returned'].includes(draft.order.approval_state) && ['draft','sent'].includes(draft.order.state)" class="btn btn-sm btn-primary wide" type="button" @click="openOrderEdit(draft.order)">{{ draft.order.approval_state === 'returned' ? '编辑并重新提交' : '编辑采购单' }}</button>
        <section class="wide order-detail-block"><header><h4>采购单明细</h4><span>{{ draft.order.lines.length }} 项</span></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>原料</th><th>品牌</th><th>包装</th><th>件数</th><th>采购数量</th><th>采购单价</th><th>采购金额</th><th>预计到货</th></tr></thead><tbody><tr v-for="(line,index) in draft.order.lines" :key="line.id"><td>{{ index + 1 }}</td><td><strong>{{ line.product?.name }}</strong></td><td>{{ line.product?.brand || '-' }}</td><td>{{ line.package_spec || line.product?.specification || '-' }}</td><td>{{ number(line.package_count,0) }}</td><td>{{ number(line.quantity,3) }} {{ line.uom?.name }}</td><td>{{ number(line.price_unit) }}</td><td>{{ number(line.subtotal) }}</td><td>{{ dateTime(line.planned_date) }}</td></tr></tbody></table></div></section>
        <section class="wide order-detail-block">
          <header><h4>来源采购需求</h4><span>{{ draft.order.requisitions?.length || 0 }} 张</span></header>
          <div class="linked-orders"><button v-for="req in draft.order.requisitions" :key="req.id" type="button" @click="openRequisitionDetail(req)"><strong>{{ req.name }}</strong><small>查看需求明细与生产计划来源</small></button></div>
        </section>
        <section class="wide order-detail-block">
          <header><h4>收货、质检与退货进展</h4><span>{{ draft.order.receipts?.length || 0 }} 张收货单 · {{ draft.order.returns?.length || 0 }} 张退货单</span></header>
          <div class="linked-orders">
            <template v-for="receipt in draft.order.receipts" :key="receipt.id">
              <button type="button" @click="openReceiptDetail(receipt)"><strong>{{ receipt.name }}</strong><span>{{ receipt.state === 'done' ? '已入库' : stateText(receipt.state) }}</span><small>{{ receipt.completed_at ? '入库时间：' + dateTime(receipt.completed_at) : '查看收货明细与库存批次' }}</small></button>
              <button v-if="receipt.inspection_id" type="button" @click="openInspectionDetail({ id: receipt.inspection_id })"><strong>{{ receipt.inspection_name }}</strong><span>质检 {{ stateText(receipt.inspection_state) }}</span><small>来源收货单 {{ receipt.name }}</small></button>
            </template>
            <button v-for="returnRecord in draft.order.returns" :key="'return-' + returnRecord.id" type="button" @click="openReturnDetail(returnRecord)"><strong>{{ returnRecord.name }}</strong><span>{{ returnRecord.state === 'done' ? '已退货出库' : stateText(returnRecord.state) }}</span><small>点击查看退货明细</small></button>
          </div>
          <p v-if="!draft.order.receipts?.length && !draft.order.returns?.length" class="inventory-empty">尚未登记收货或退货</p>
        </section>
        <section class="wide order-detail-block"><header><h4>完整审批流水</h4><span>{{ stateText(draft.order.approval_state) }}</span></header><div v-if="draft.order.approval_history?.length" class="approval-timeline"><div v-for="(step,index) in draft.order.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div><div v-else class="inventory-empty">采购单尚未提交审批</div></section>
      </template>
      <template v-else-if="modal === 'requisition-detail'">
        <div class="wide order-detail-summary"><div><span>采购需求单</span><strong>{{ draft.requisition.name }}</strong></div><div><span>来源</span><strong>{{ requestType(draft.requisition) }}</strong><small>{{ draft.requisition.emergency_reason || draft.requisition.reason || '-' }}</small></div><div><span>申请人 / 厂区</span><strong>{{ draft.requisition.requester?.name || '-' }}</strong><small>{{ draft.requisition.factory?.name || '-' }}</small></div><div><span>需求日期</span><strong>{{ draft.requisition.need_date || '-' }}</strong></div><div><span>建议供应商</span><strong>{{ draft.requisition.preferred_supplier?.name || '未指定' }}</strong></div><div><span>当前状态</span><strong>{{ stateText(draft.requisition.state) }}</strong><small v-if="draft.requisition.return_reason">退回：{{ draft.requisition.return_reason }}</small></div><div><span>关联采购单</span><strong>{{ draft.requisition.orders?.length || 0 }} 张</strong></div><div><span>未下单明细</span><strong>{{ draft.requisition.lines.filter(line => remaining(line) > 0).length }} 项</strong></div></div>
        <button v-if="canPurchase && ['draft','returned'].includes(draft.requisition.state)" class="btn btn-sm btn-primary wide" type="button" @click="openRequisitionEdit(draft.requisition)">编辑采购需求</button>
        <section class="wide order-detail-block"><header><h4>采购需求明细</h4><span>{{ draft.requisition.lines.length }} 项</span></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>原料</th><th>生产计划来源</th><th>申请数量</th><th>批准数量</th><th>已下单</th><th>未下单</th></tr></thead><tbody><tr v-for="line in draft.requisition.lines" :key="line.id"><td><strong>{{ line.product?.name }}</strong></td><td><div v-if="line.allocations?.length" class="record-links"><button v-for="allocation in line.allocations" :key="allocation.plan_id" class="record-link" type="button" @click="selectedPlanId = allocation.plan_id">{{ allocation.plan_name }}<small>缺口 {{ number(allocation.shortage_qty,3) }}</small></button></div><span v-else>紧急采购</span></td><td>{{ number(line.requested_qty,3) }} {{ line.uom?.name }}</td><td>{{ number(line.approved_qty,3) }}</td><td>{{ number(line.ordered_qty,3) }}</td><td><strong>{{ number(remaining(line),3) }}</strong></td></tr></tbody></table></div></section>
        <section v-if="draft.requisition.orders?.length" class="wide order-detail-block"><header><h4>关联采购单</h4><span>{{ draft.requisition.orders.length }} 张</span></header><div class="linked-orders"><button v-for="order in draft.requisition.orders" :key="order.id" type="button" @click="openOrderDetail(order)"><strong>{{ order.name }}</strong><span>{{ order.supplier?.name || '-' }}</span><small>审批 {{ stateText(order.approval_state) }} · {{ receiptStateText(order.receipt_state) }}</small></button></div></section>
        <section class="wide order-detail-block"><header><h4>完整审批流水</h4><span>{{ stateText(draft.requisition.state) }}</span></header><div v-if="draft.requisition.approval_history?.length" class="approval-timeline"><div v-for="(step,index) in draft.requisition.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div><div v-else class="inventory-empty">采购需求尚未提交审批</div></section>
      </template>
      <template v-else-if="modal === 'receipt'"><label><span>待检库位</span><select v-model="draft.qc_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.brew_location_type === 'qc')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label><label><span>入库库位</span><select v-model="draft.destination_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.brew_location_type !== 'qc' && x.usage === 'internal')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label><div class="wide modal-lines"><div v-for="line in draft.lines" :key="line.id" class="receipt-line"><div><strong>{{ line.product?.name }}</strong><small>已收 {{ number(line.prior_received_qty,3) }} / 订购 {{ number(line.quantity,3) }}</small></div><input v-model.number="line.received_qty" type="number" min="0" :max="line.remaining_receipt_qty" step="0.001" placeholder="本次实收"><input :value="line.internal_batch" title="内部批次由系统按收货单自动生成" readonly><input v-model.trim="line.supplier_lot" placeholder="供应商包装批号（无则留空）"><input v-model="line.expiration_date" type="date" @click="openDatePicker"></div></div></template>
      <template v-else-if="modal === 'receipt-edit'">
        <div class="wide order-detail-summary"><div><span>收货单号</span><strong>{{ draft.receipt.name }}</strong></div><div><span>采购订单</span><strong>{{ draft.order.name }}</strong></div><div><span>供应商</span><strong>{{ draft.receipt.supplier?.name || '-' }}</strong></div><div><span>当前状态</span><strong>{{ stateText(draft.receipt.state) }}</strong></div></div>
        <label><span>待检库位</span><select v-model="draft.qc_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => String(x.brew_factory_id?.id || '') === String(draft.receipt.factory?.id || '') && x.brew_location_type === 'qc')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label>
        <label><span>入库库位</span><select v-model="draft.destination_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => String(x.brew_factory_id?.id || '') === String(draft.receipt.factory?.id || '') && x.brew_location_type !== 'qc' && x.usage === 'internal')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label>
        <label class="wide"><span>收货备注</span><textarea v-model.trim="draft.note" rows="2" placeholder="填写本次修改说明（选填）"></textarea></label>
        <div class="wide modal-lines">
          <div class="modal-lines-head"><div><strong>收货明细</strong><small>可修改数量、批号和有效期，也可增加或删除明细</small></div><button class="btn btn-xs btn-outline" type="button" @click="addReceiptEditLine">添加一行</button></div>
          <div class="work-table-wrap"><table class="work-table"><thead><tr><th>原料</th><th>订购数量</th><th>本次实收</th><th>内部批次</th><th>供应商批号</th><th>有效期</th><th>操作</th></tr></thead><tbody>
            <tr v-for="(line,index) in draft.lines" :key="line.id || index"><td><select v-model="line.order_line_id"><option v-for="orderLine in draft.order.lines" :key="orderLine.id" :value="orderLine.id" :disabled="draft.lines.some((other,otherIndex) => otherIndex !== index && String(other.order_line_id) === String(orderLine.id))">{{ orderLine.product?.name }} · {{ orderLine.product?.brand || '无品牌' }}</option></select></td><td>{{ number(receiptOrderLine(line.order_line_id)?.quantity || 0,3) }} {{ receiptOrderLine(line.order_line_id)?.uom?.name || '' }}</td><td><input v-model.number="line.received_qty" type="number" min="0.001" step="0.001"></td><td><input :value="line.lot_name" readonly title="内部批次由系统生成"></td><td><input v-model.trim="line.supplier_lot" placeholder="无则留空"></td><td><input v-model="line.expiration_date" type="date" @click="openDatePicker"></td><td><button class="btn btn-xs btn-danger" type="button" @click="removeReceiptEditLine(index)">删除</button></td></tr>
            <tr v-if="!draft.lines.length"><td colspan="7" class="inventory-empty">请至少保留一条收货明细</td></tr>
          </tbody></table></div>
        </div>
      </template>
      <template v-else-if="modal === 'quality'"><section v-if="draft.inspection.return_reason" class="wide order-detail-block"><header><h4>上次退回原因</h4></header><p class="quality-return-reason">{{ draft.inspection.return_reason }}</p></section><div class="wide modal-lines"><div v-for="line in draft.lines" :key="line.id" class="quality-line"><div><strong>{{ line.product?.name }}</strong><small>{{ line.lot?.name }} · 待检 {{ line.inspected_qty }} {{ line.uom?.name }}</small></div><label><span>合格</span><input v-model.number="line.qualified_qty" type="number" min="0" :max="line.inspected_qty" step="0.001"></label><label><span>不合格</span><input v-model.number="line.rejected_qty" type="number" min="0" :max="line.inspected_qty" step="0.001"></label><label><span>处置</span><select v-model="line.disposition" :disabled="!Number(line.rejected_qty)"><option value="">请选择</option><option value="return">退回供应商</option><option value="scrap">报损</option></select></label></div></div><label class="wide"><span>质检备注</span><textarea v-model.trim="draft.note" rows="2"></textarea></label><label class="wide"><span>提交说明</span><textarea v-model.trim="draft.submission_comment" rows="2" placeholder="说明检验结论和需要审批人关注的事项（选填）"></textarea></label></template>
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
          <p v-if="!draft.receipt.quality_inspection_id && !draft.receipt.lines.some(line => line.lot_id)" class="inventory-empty">确认到货后生成库存批次和质检单</p>
        </section>
        <section class="wide order-detail-block"><header><h4>收货明细</h4><span>{{ draft.receipt.lines?.length || 0 }} 项</span></header>
          <div class="work-table-wrap"><table class="work-table"><thead><tr><th>序号</th><th>原料信息</th><th>包装单位</th><th>采购件数</th><th>已收货件数</th><th>合格件数</th><th>不合格件数</th><th>当前库存</th><th>已退件数</th><th>可退件数</th><th>有效期</th><th>规格批号</th></tr></thead><tbody>
            <tr v-for="(line,index) in draft.receipt.lines" :key="line.id"><td>{{ index + 1 }}</td><td><strong>{{ line.product?.name }}</strong><small>{{ line.product?.brand || '-' }} · {{ line.product?.specification || '-' }}</small></td><td>{{ line.uom?.name || '-' }}<small>{{ line.package_spec || '' }}</small></td><td>{{ number(line.ordered_qty,3) }}</td><td>{{ number(line.received_qty,3) }}</td><td>{{ number(line.qualified_qty,3) }}</td><td>{{ number(line.rejected_qty,3) }}</td><td>{{ number(line.stock_available_qty || 0,3) }}</td><td>{{ number(line.returned_qty || 0,3) }}</td><td>{{ number(line.returnable_qty || 0,3) }}</td><td>{{ line.expiration_date || '-' }}</td><td>{{ line.supplier_lot || '-' }}</td></tr>
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
          <div><span>状态</span><strong>{{ stateText(draft.inspectionDetail.state) }}</strong></div>
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
        <section class="wide order-detail-block"><header><h4>审批流程</h4><span>{{ stateText(draft.inspectionDetail.state) }}</span></header><div v-if="draft.inspectionDetail.approval_history?.length" class="approval-timeline"><div v-for="(step,index) in draft.inspectionDetail.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div><div v-else class="inventory-empty">质检结果尚未提交审批</div></section>
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
      <template v-else-if="modal === 'count-create'"><label class="wide"><span>盘点库位</span><select v-model="draft.location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.usage === 'internal')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label></template>
      <template v-else-if="['count-lines','count-review'].includes(modal)">
        <div class="count-workbench wide">
          <div class="count-toolbar">
            <input v-model.trim="countFilters.keyword" placeholder="搜索物料、批次或库位">
            <select v-model="countFilters.mode"><option value="all">全部明细</option><option value="difference">仅有差异</option><option value="unchanged">仅无差异</option></select>
            <span>共 {{ draft.lines.length }} 项 · 差异 {{ countDifferenceSummary.lines }} 项 · 盘盈 {{ number(countDifferenceSummary.increase,3) }} · 盘亏 {{ number(countDifferenceSummary.decrease,3) }}</span>
          </div>
          <div class="count-work-head"><span>物料 / 批次</span><span>上次盘点</span><span>本次账面</span><span>本次实盘</span><span>本次差异</span><span>差异原因</span></div>
          <div v-for="line in visibleCountLines" :key="line.id" class="count-work-row" :class="{ changed: countHasDifference(line) }">
            <div><strong>{{ line.product?.name }}</strong><small>{{ line.lot?.name || '无批次' }} · {{ line.location?.name }}</small></div>
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
      <div v-if="modalError" class="master-error wide">{{ modalError }}</div></div><footer><button class="btn btn-secondary" type="button" @click="modal = ''">{{ ['count-review','order-detail','requisition-detail','receipt-detail','inspection-detail','return-detail'].includes(modal) ? '关闭' : '取消' }}</button><button v-if="modal === 'receipt-detail' && canWarehouse && draft.receipt?.state === 'pending_approval' && draft.receipt?.approval_state === 'returned'" class="btn btn-outline" type="button" @click="openReceiptEdit(draft.receipt)">编辑收货单</button><button v-if="modal === 'receipt-detail' && canWarehouse && draft.receipt?.state === 'pending_approval' && draft.receipt?.approval_state === 'returned'" class="btn btn-primary" type="button" :disabled="saving" @click="receiptAction(draft.receipt, 'confirm-arrival')">重新提交审批</button><button v-if="modal === 'inspection-detail' && canWarehouse && ['draft','returned'].includes(draft.inspectionDetail?.state)" class="btn btn-primary" type="button" :disabled="saving" @click="openQuality(draft.inspectionDetail)">{{ draft.inspectionDetail?.state === 'returned' ? '修改并重新提交' : '录入并提交审批' }}</button><button v-if="!['count-review','order-detail','requisition-detail','receipt-detail','inspection-detail','return-detail'].includes(modal)" class="btn btn-primary" type="button" :disabled="saving" @click="submitModal">{{ saving ? '处理中...' : modal === 'order' ? `按规则生成 ${purchaseOrderGroups.length} 张采购单` : modal === 'order-edit' ? (draft.resubmit ? '保存并重新提交' : '保存修改') : ['requisition-edit','receipt-edit'].includes(modal) ? '保存修改' : modal === 'return-edit' ? (draft.returnRecord ? '保存修改' : '创建退货单') : modal === 'quality' ? '保存并提交审批' : modal === 'plan' ? '生成采购需求单' : '确认' }}</button></footer></section></div>
    <ProductionPlanDetail v-if="selectedPlanId" class="procurement-plan-detail" :plan-id="selectedPlanId" read-only @close="selectedPlanId = null" />
    <div v-if="selectedLot" class="inventory-modal-mask procurement-lot-detail" @click.self="selectedLot = null">
      <section class="inventory-modal inventory-modal-wide" role="dialog" aria-modal="true" aria-label="库存批次与出入库记录">
        <header><div><h3>{{ selectedLot.name }}</h3><p>{{ selectedLot.product?.name }} · {{ expiryText(selectedLot) }}</p></div><button class="inventory-modal-close" type="button" @click="selectedLot = null">×</button></header>
        <div class="inventory-modal-body">
          <div class="wide order-detail-summary"><div><span>账面</span><strong>{{ number(selectedLot.on_hand,3) }} {{ selectedLot.uom }}</strong></div><div><span>预占</span><strong>{{ number(selectedLot.reserved,3) }}</strong></div><div><span>可用</span><strong>{{ number(selectedLot.available,3) }}</strong><small>{{ availableReasonText(selectedLot) }}</small></div><div v-if="selectedLot.source_receipt"><span>来源收货单</span><button class="record-link" type="button" @click="openMovementSource({ model: 'brew.receipt', id: selectedLot.source_receipt.id })">{{ selectedLot.source_receipt.name }}</button></div></div>
          <section class="wide order-detail-block"><header><h4>出入库记录</h4><span>最近 {{ selectedLot.recent_movements?.length || 0 }} 条（最多100条）</span></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>时间</th><th>关联单据</th><th>数量</th><th>来源库位 → 目标库位</th></tr></thead><tbody><tr v-for="movement in selectedLot.recent_movements" :key="movement.id"><td>{{ dateTime(movement.date) }}</td><td><button v-if="movement.source?.id && ['brew.receipt','brew.purchase.return','brew.production.plan'].includes(movement.source.model)" class="record-link" type="button" @click="openMovementSource(movement.source)">{{ movement.source.reference }}</button><span v-else>{{ movement.source?.reference || '-' }}</span></td><td>{{ number(movement.quantity,3) }} {{ movement.uom }}</td><td>{{ movement.source_location }} → {{ movement.destination_location }}</td></tr><tr v-if="!selectedLot.recent_movements?.length"><td colspan="4" class="inventory-empty">暂无已完成的出入库记录</td></tr></tbody></table></div></section>
        </div><footer><button class="btn btn-secondary" type="button" @click="selectedLot = null">关闭</button></footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.inventory-tabs .inventory-tab-refresh{margin-left:auto;font-size:12px;align-self:center;padding:8px 12px;border:1px solid #ffffff18;border-radius:7px;color:#aaa}
.proc-pagination{display:flex;align-items:center;gap:10px;padding:10px 0;justify-content:flex-end;font-size:13px;color:#bbb}
.proc-pagination select{background:#1a1a2e;color:#ddd;border:1px solid #333;border-radius:4px;padding:3px 6px;font-size:12px;cursor:pointer}
.proc-pagination select:focus{outline:none;border-color:#5c6bc0}
.proc-pagination span{white-space:nowrap}
.return-line-checkbox-cell{width:42px;text-align:center;vertical-align:middle}
.return-line-checkbox{appearance:auto!important;-webkit-appearance:auto!important;width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;max-width:16px!important;max-height:16px!important;padding:0!important;margin:0 auto;display:block;box-sizing:border-box;accent-color:#6674e8;cursor:pointer}
</style>
