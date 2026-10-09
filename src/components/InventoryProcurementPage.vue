<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { brewApi } from "../api";

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
  category_group: "", category_code: "", material_id: "", material_name: "",
  plan_no: "", product_name: "", date_from: "", date_to: ""
});
const requisitionFilters = reactive({
  keyword: "", supplier_name: "", requester_name: "", factory_id: "",
  request_type: "", state: "", date_from: "", date_to: ""
});
const orderFilters = reactive({
  supplier_name: "", order_no: "", receipt_state: ""
});

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
    [requisitions, brewApi.listPurchaseRequisitions({ page_size: 100 })],
    [orders, brewApi.listPurchaseOrders({ page_size: 100 })],
    [receipts, brewApi.listReceipts({ page_size: 100 })],
    [inspections, brewApi.listQualityInspections({ page_size: 100 })],
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
async function loadSourcePlans() {
  shortageLoading.value = true;
  error.value = "";
  try {
    const params = {};
    Object.entries(shortageFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    sourcePlans.value = await brewApi.listPurchaseSourcePlans(params);
    selectedShortages.value = [];
  } catch (cause) {
    error.value = cause.message || "生产缺口加载失败";
  } finally {
    shortageLoading.value = false;
  }
}
function resetShortageFilters() {
  Object.keys(shortageFilters).forEach((key) => { shortageFilters[key] = ""; });
  loadSourcePlans();
}
function toggleAllShortages(event) {
  selectedShortages.value = event.target.checked ? requestableShortageRows.value.map((item) => item.request_key) : [];
}
async function loadRequisitions() {
  requisitionLoading.value = true;
  error.value = "";
  try {
    const params = { page_size: 100 };
    Object.entries(requisitionFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    requisitions.value = await brewApi.listPurchaseRequisitions(params);
  } catch (cause) {
    error.value = cause.message || "采购需求加载失败";
  } finally {
    requisitionLoading.value = false;
  }
}
function resetRequisitionFilters() {
  Object.keys(requisitionFilters).forEach((key) => { requisitionFilters[key] = ""; });
  loadRequisitions();
}
async function loadOrders() {
  orderLoading.value = true;
  error.value = "";
  try {
    const params = { page_size: 100 };
    Object.entries(orderFilters).forEach(([key, value]) => { if (value) params[key] = value; });
    orders.value = await brewApi.listPurchaseOrders(params);
  } catch (cause) {
    error.value = cause.message || "采购单加载失败";
  } finally {
    orderLoading.value = false;
  }
}
function resetOrderFilters() {
  Object.keys(orderFilters).forEach((key) => { orderFilters[key] = ""; });
  loadOrders();
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
  resetDraft({ inspection, note: inspection.note || "", lines: inspection.lines.map((line) => ({ ...line, qualified_qty: line.inspected_qty, rejected_qty: 0, disposition: "", note: line.note || "" })) });
  modal.value = "quality";
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
    emit("toast", "操作已完成"); modal.value = ""; await load();
  } catch (cause) { modalError.value = cause.message || "操作失败"; }
  finally { saving.value = false; }
}
async function runAction(callback, success) {
  try { await callback(); emit("toast", success); await load(); }
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
</script>

<template>
  <div class="inventory-workbench">
    <div class="inventory-hero">
      <div><span class="inventory-eyebrow">库存采购工作台</span><h2>从缺料到入库，一条主线处理</h2><p>普通采购来自生产缺口；紧急采购单独标识并强制审批。库存余额只由业务单据更新。</p></div>
      <div class="inventory-hero-actions"><button class="icon-action" type="button" title="刷新" aria-label="刷新" :disabled="loading" @click="load">↻</button></div>
    </div>
    <div v-if="error" class="master-error inventory-error">{{ error }}</div>
    <div class="inventory-flow"><span>生产缺口</span><b>›</b><span>采购需求</span><b>›</b><span>我的任务审批</span><b>›</b><span>采购执行</span><b>›</b><span>到货质检</span><b>›</b><span>合格入库</span></div>
    <div class="inventory-tabs"><button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">{{ item.label }}</button><button v-if="tab !== 'stock'" class="inventory-tab-refresh" type="button" :disabled="loading" @click="load" aria-label="刷新当前数据">↻ 刷新</button></div>

    <template v-if="tab === 'overview'">
      <div class="inventory-metric-grid"><div v-for="item in metrics" :key="item.label" class="inventory-metric"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.hint }}</small></div></div>
      <section class="inventory-section"><header><div><h3>分类库存</h3><p>不同单位不做无意义汇总，按原料种类查看数量与批次</p></div><span>{{ inventoryCategories.length }} 类</span></header><div class="inventory-category-grid"><button v-for="item in inventoryCategories" :key="item.category" type="button" @click="showCategoryInventory(item)"><span>{{ item.category_name }}</span><strong>{{ item.uom === '多单位' ? item.product_count + ' 种原料' : number(item.available,3) + ' ' + item.uom }}</strong><small>账面 {{ item.uom === '多单位' ? item.lot_count + ' 个批次' : number(item.on_hand,3) }} · 预占 {{ item.uom === '多单位' ? '按明细查看' : number(item.reserved,3) }}</small><em>查看 {{ item.product_count }} 种原料 / {{ item.lot_count }} 个批次 ›</em></button><div v-if="!inventoryCategories.length" class="inventory-empty">暂无库存分类数据</div></div></section>
      <section class="inventory-section"><header><div><h3>库存健康度</h3><p>按问题批次展示原因；可用库存指合格、未过期、未冻结且未被领料预占的数量</p></div></header><div class="stock-health"><button v-for="item in stockHealth" :key="item.key" type="button" @click="showHealthInventory(item)"><span>{{ item.label }}</span><strong>{{ item.value }} 个批次</strong><small>{{ item.hint }}</small><em>查看明细 ›</em></button></div></section>
    </template>

    <section v-else-if="tab === 'shortages'" class="inventory-section">
      <header><div><h3>生产缺口</h3><p>按计划和原料定位真实缺口，已生成采购需求的数量不会重复申请</p></div><div class="section-actions"><span class="selection-summary">已选 {{ selectedShortageRows.length }} 项</span><button v-if="canPurchase" class="btn btn-sm btn-primary" :disabled="!selectedShortageRows.length" @click="openPlan">生成采购需求单</button></div></header>
      <div class="procurement-filters shortage-filters">
        <select v-model="shortageFilters.category_group" @change="shortageFilters.category_code = ''"><option value="">全部原料品类</option><option v-for="item in materialGroupOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select>
        <select v-model="shortageFilters.category_code"><option value="">全部原料种类</option><option v-for="item in materialTypeOptions" :key="item.id" :value="item.code">{{ item.name }}</option></select>
        <select v-model="shortageFilters.material_id"><option value="">全部原料</option><option v-for="item in materials" :key="item.id" :value="item.product_variant_id">{{ item.name }}</option></select>
        <input v-model.trim="shortageFilters.material_name" placeholder="原料名称" @keyup.enter="loadSourcePlans">
        <input v-model.trim="shortageFilters.plan_no" placeholder="生产计划编号" @keyup.enter="loadSourcePlans">
        <input v-model.trim="shortageFilters.product_name" placeholder="产品名称" @keyup.enter="loadSourcePlans">
        <label class="date-filter"><span>生产时间</span><input v-model="shortageFilters.date_from" type="date" aria-label="生产开始日期" @click="openDatePicker"><b>至</b><input v-model="shortageFilters.date_to" type="date" aria-label="生产结束日期" @click="openDatePicker"></label>
        <button class="btn btn-sm btn-outline" type="button" @click="resetShortageFilters">重置</button><button class="btn btn-sm btn-primary" type="button" :disabled="shortageLoading" @click="loadSourcePlans">查询</button>
      </div>
      <div class="work-table-wrap"><table class="work-table shortage-table"><thead><tr><th><input type="checkbox" :checked="requestableShortageRows.length && selectedShortageRows.length === requestableShortageRows.length" @change="toggleAllShortages"></th><th>原料品类 / 种类</th><th>原料名称</th><th>生产计划 / 产品</th><th>生产时间</th><th>计划需求</th><th>可分配库存</th><th>生产缺口</th><th>已生成需求</th><th>状态</th></tr></thead><tbody>
        <tr v-for="item in shortageRows" :key="item.request_key"><td><input v-model="selectedShortages" type="checkbox" :value="item.request_key" :disabled="Number(item.requestable_qty) <= 0"></td><td>{{ item.category?.group_name || '-' }}<small>{{ item.category?.name || '-' }}</small></td><td><strong>{{ item.product?.name }}</strong><small>{{ item.product?.brand || '无品牌' }} · {{ item.product?.specification || '未设置规格' }}</small></td><td><strong>{{ item.plan.name }}</strong><small>{{ item.plan.product?.name }} · {{ item.plan.factory?.name }}</small></td><td>{{ dateTime(item.plan.planned_start) }}<small>至 {{ dateTime(item.plan.planned_end) }}</small></td><td>{{ number(item.required,3) }} {{ item.uom }}</td><td>{{ number(item.allocated,3) }}</td><td><strong>{{ number(item.shortage,3) }}</strong><small>本次可申请 {{ number(item.requestable_qty,3) }}</small></td><td>{{ number(item.requested_qty,3) }}</td><td><span class="state-pill" :data-state="item.request_status">{{ requestStatusText(item.request_status) }}</span></td></tr>
        <tr v-if="!shortageRows.length"><td colspan="10" class="inventory-empty">当前条件下没有生产缺口</td></tr>
      </tbody></table></div>
    </section>

    <section v-else-if="tab === 'requisitions'" class="inventory-section">
      <header><div><h3>采购需求</h3><p>查看需求从发起、审批到关联采购单的完整进展，审批操作统一在“我的任务”处理</p></div><div class="section-actions"><button v-if="canPurchase" class="btn btn-sm btn-outline" @click="openEmergency">新建紧急采购需求</button><button v-if="canPurchase" class="btn btn-sm btn-primary" @click="openOrder()">从需求生成采购单</button></div></header>
      <div class="procurement-filters requisition-filters">
        <input v-model.trim="requisitionFilters.keyword" placeholder="需求单号 / 原料名称" @keyup.enter="loadRequisitions">
        <input v-model.trim="requisitionFilters.supplier_name" placeholder="建议供应商" @keyup.enter="loadRequisitions">
        <input v-model.trim="requisitionFilters.requester_name" placeholder="申请人" @keyup.enter="loadRequisitions">
        <select v-model="requisitionFilters.factory_id"><option value="">全部厂区</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select>
        <select v-model="requisitionFilters.request_type"><option value="">全部来源</option><option value="planned">计划缺料</option><option value="emergency">紧急采购</option></select>
        <select v-model="requisitionFilters.state"><option value="">全部状态</option><option value="draft">草稿</option><option value="submitted">待审批</option><option value="approved">已批准</option><option value="returned">已退回</option><option value="ordered">已转订单</option><option value="closed">已关闭</option><option value="cancelled">已取消</option></select>
        <label class="date-filter"><span>需求日期</span><input v-model="requisitionFilters.date_from" type="date" @click="openDatePicker"><b>至</b><input v-model="requisitionFilters.date_to" type="date" @click="openDatePicker"></label>
        <button class="btn btn-sm btn-outline" @click="resetRequisitionFilters">重置</button>
        <button class="btn btn-sm btn-primary" :disabled="requisitionLoading" @click="loadRequisitions">查询</button>
      </div>
      <div class="work-table-wrap"><table class="work-table requisition-table"><thead><tr><th>序号</th><th>采购需求单</th><th>来源</th><th>申请人 / 厂区</th><th>需求日期</th><th>物料</th><th>当前进度</th><th>关联采购单</th><th>操作</th></tr></thead><tbody><tr v-for="(item,index) in requisitions" :key="item.id"><td>{{ index + 1 }}</td><td><strong>{{ item.name }}</strong><small>{{ item.preferred_supplier?.name || '未指定建议供应商' }}</small></td><td><span class="source-badge" :class="{ emergency: item.request_type === 'emergency' }">{{ requestType(item) }}</span><small>{{ item.emergency_reason || item.reason || '-' }}</small></td><td>{{ item.requester?.name || '-' }}<small>{{ item.factory?.name || '-' }}</small></td><td>{{ item.need_date || '-' }}</td><td><strong>{{ item.lines.length }} 项</strong><small>{{ item.lines.map(line => line.product?.name).join('、') }}</small></td><td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span><small v-if="item.return_reason">退回：{{ item.return_reason }}</small></td><td>{{ item.orders?.length ? item.orders.map(order => order.name).join('、') : '尚未生成' }}<small v-if="item.orders?.length">{{ item.orders.map(order => receiptStateText(order.receipt_state)).join('、') }}</small></td><td class="row-actions"><button class="btn btn-xs btn-outline" @click="openRequisitionDetail(item)">查看进展</button><button v-if="canPurchase && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-outline" @click="openRequisitionEdit(item)">编辑</button><button v-if="canPurchase && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-primary" @click="requisitionAction(item,'submit')">提交审批</button><button v-if="canPurchase && item.state === 'approved' && item.lines.some(line => remaining(line) > 0)" class="btn btn-xs btn-primary" @click="openOrder(item)">生成采购单</button></td></tr><tr v-if="!requisitions.length"><td colspan="9" class="inventory-empty">暂无采购需求</td></tr></tbody></table></div>
    </section>

    <section v-else-if="tab === 'orders'" class="inventory-section">
      <header><div><h3>采购执行</h3><p>跟踪已生成采购单的审批、下单、收货与关闭状态</p></div><div class="section-actions"><button v-if="canPurchase" class="btn btn-sm btn-primary" @click="openOrder()">新增采购单</button><button v-if="canExport" class="btn btn-sm btn-outline" @click="createExport">导出</button></div></header>
      <div class="procurement-filters order-filters"><input v-model.trim="orderFilters.supplier_name" placeholder="供应商名称" @keyup.enter="loadOrders"><input v-model.trim="orderFilters.order_no" placeholder="采购单号" @keyup.enter="loadOrders"><select v-model="orderFilters.receipt_state"><option value="">全部收货状态</option><option value="not_received">未收货</option><option value="partial">部分收货</option><option value="receiving">收货处理中</option><option value="received">已收货</option></select><button class="btn btn-sm btn-outline" @click="resetOrderFilters">重置</button><button class="btn btn-sm btn-primary" :disabled="orderLoading" @click="loadOrders">查询</button></div>
      <div class="work-table-wrap"><table class="work-table purchase-order-table"><thead><tr><th>序号</th><th>采购需求单号</th><th>采购单号</th><th>供应商</th><th>下单人</th><th>采购金额</th><th>预期到货</th><th>下单日期</th><th>审批状态</th><th>收货状态</th><th>操作</th></tr></thead><tbody>
        <tr v-for="(item,index) in orders" :key="item.id"><td>{{ index + 1 }}</td><td>{{ item.requisitions?.map(req => req.name).join('、') || '-' }}<small>{{ orderType(item) }}</small></td><td><strong>{{ item.name }}</strong><small>{{ stateText(item.state) }}</small></td><td>{{ item.supplier?.name || '-' }}<small>{{ item.supplier?.code || '-' }}</small></td><td>{{ item.purchaser?.name || '-' }}</td><td><strong>{{ number(item.amount_total) }}</strong><small>{{ item.currency }}</small></td><td>{{ item.expected_arrival_date || '-' }}</td><td>{{ dateTime(item.order_date) }}</td><td><span class="state-pill" :data-state="item.approval_state">{{ stateText(item.approval_state) }}</span></td><td><span class="state-pill" :data-state="item.receipt_state">{{ receiptStateText(item.receipt_state) }}</span></td><td class="row-actions"><button class="btn btn-xs btn-outline" @click="openOrderDetail(item)">查看详情</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'none'" class="btn btn-xs btn-outline" @click="openOrderEdit(item)">编辑</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'none'" class="btn btn-xs btn-primary" @click="orderAction(item,'submit')">提交审批</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'returned'" class="btn btn-xs btn-primary" @click="openOrderEdit(item)">编辑并重新提交</button><button v-if="canPurchase && ['draft','sent'].includes(item.state) && item.approval_state === 'approved'" class="btn btn-xs btn-primary" @click="orderAction(item,'place')">正式下单</button><button v-if="canWarehouse && item.can_receive" class="btn btn-xs btn-outline" @click="openReceipt(item)">登记收货</button><button v-if="canPurchase && item.state === 'purchase'" class="btn btn-xs btn-outline" @click="orderAction(item,'close')">关闭</button></td></tr>
        <tr v-if="!orders.length"><td colspan="11" class="inventory-empty">暂无符合条件的采购单</td></tr>
      </tbody></table></div>
    </section>

    <template v-else-if="tab === 'receiving'"><section class="inventory-section"><header><div><h3>到货与入库</h3><p>到货先进入待检库位，质检完成后才可正式入库</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>收货单</th><th>采购订单</th><th>待检库位</th><th>批次</th><th>状态</th><th>下一步</th></tr></thead><tbody><tr v-for="item in receipts" :key="item.id"><td><strong>{{ item.name }}</strong></td><td>{{ item.purchase_order?.name }}</td><td>{{ item.qc_location?.name }}</td><td>{{ item.lines.length }} 个</td><td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span></td><td class="row-actions"><button v-if="canWarehouse && item.state === 'draft'" class="btn btn-xs btn-primary" @click="receiptAction(item,'confirm-arrival')">确认到货</button><button v-if="canWarehouse && item.state === 'inspected'" class="btn btn-xs btn-primary" @click="receiptAction(item,'put-away')">完成入库</button></td></tr><tr v-if="!receipts.length"><td colspan="6" class="inventory-empty">暂无收货记录</td></tr></tbody></table></div></section><section class="inventory-section"><header><div><h3>来料质检</h3><p>不合格数量必须选择退回供应商或报损</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>质检单</th><th>收货单</th><th>物料批次</th><th>检验结果</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in inspections" :key="item.id"><td><strong>{{ item.name }}</strong></td><td>{{ item.receipt_name }}</td><td>{{ item.lines.map(line => line.lot?.name).join('、') }}</td><td>合格 {{ number(item.lines.reduce((n,line)=>n+Number(line.qualified_qty||0),0),3) }} / 不合格 {{ number(item.lines.reduce((n,line)=>n+Number(line.rejected_qty||0),0),3) }}</td><td><span class="state-pill" :data-state="item.state">{{ stateText(item.state) }}</span></td><td><button v-if="canWarehouse && item.state === 'draft'" class="btn btn-xs btn-primary" @click="openQuality(item)">录入结果</button></td></tr></tbody></table></div></section><section v-if="rejectedRows.length" class="inventory-section"><header><div><h3>采购退货 / 报损</h3><p>来源为来料质检不合格，不重复建单</p></div></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>质检单</th><th>收货单</th><th>物料 / 批次</th><th>数量</th><th>处置</th></tr></thead><tbody><tr v-for="item in rejectedRows" :key="item.inspection + item.lot"><td>{{ item.inspection }}</td><td>{{ item.receipt }}</td><td>{{ item.product }}<small>{{ item.lot }}</small></td><td>{{ item.quantity }} {{ item.uom }}</td><td>{{ item.disposition }}</td></tr></tbody></table></div></section></template>

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

    <div v-if="modal" class="inventory-modal-mask" @click.self="modal = ''"><section class="inventory-modal" :class="{ 'inventory-modal-wide': ['order','order-edit','order-detail','requisition-edit','requisition-detail','count-lines','count-review'].includes(modal) }"><header><div><h3>{{ modal === 'emergency' ? '新建紧急采购需求' : modal === 'requisition-edit' ? '编辑采购需求' : modal === 'plan' ? '生成采购需求单' : modal === 'order' ? '新增采购单' : modal === 'order-edit' ? (draft.resubmit ? '编辑退回采购单' : '编辑采购单') : modal === 'order-detail' ? '采购单详情' : modal === 'requisition-detail' ? '采购需求进展' : modal === 'receipt' ? '登记采购收货' : modal === 'quality' ? '录入质检结果' : modal === 'count-create' ? '新建库存盘点' : modal === 'count-review' ? '盘点差异记录' : '录入盘点实数' }}</h3><p>{{ modal === 'order' ? '选择采购明细并逐行确认供应商，提交后按供应商与厂区自动拆单' : modal === 'order-edit' ? (draft.resubmit ? '修改退回内容并填写说明后重新进入审批' : '保存后仍为未提交，可继续修改或提交审批') : modal === 'requisition-edit' ? '草稿或退回状态可以修改基本信息，并增加或删除原料明细' : ['order-detail','requisition-detail'].includes(modal) ? '查看单据明细与从发起至今的完整审批记录' : modal === 'count-review' ? '查看本次账面、实盘、差异原因及上次盘点结果' : '确认关键信息后继续' }}</p></div><button class="inventory-modal-close" type="button" @click="modal = ''">×</button></header><div class="inventory-modal-body">
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
        <section class="wide order-detail-block"><header><h4>完整审批流水</h4><span>{{ stateText(draft.order.approval_state) }}</span></header><div v-if="draft.order.approval_history?.length" class="approval-timeline"><div v-for="(step,index) in draft.order.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div><div v-else class="inventory-empty">采购单尚未提交审批</div></section>
      </template>
      <template v-else-if="modal === 'requisition-detail'">
        <div class="wide order-detail-summary"><div><span>采购需求单</span><strong>{{ draft.requisition.name }}</strong></div><div><span>来源</span><strong>{{ requestType(draft.requisition) }}</strong><small>{{ draft.requisition.emergency_reason || draft.requisition.reason || '-' }}</small></div><div><span>申请人 / 厂区</span><strong>{{ draft.requisition.requester?.name || '-' }}</strong><small>{{ draft.requisition.factory?.name || '-' }}</small></div><div><span>需求日期</span><strong>{{ draft.requisition.need_date || '-' }}</strong></div><div><span>建议供应商</span><strong>{{ draft.requisition.preferred_supplier?.name || '未指定' }}</strong></div><div><span>当前状态</span><strong>{{ stateText(draft.requisition.state) }}</strong><small v-if="draft.requisition.return_reason">退回：{{ draft.requisition.return_reason }}</small></div><div><span>关联采购单</span><strong>{{ draft.requisition.orders?.length || 0 }} 张</strong></div><div><span>未下单明细</span><strong>{{ draft.requisition.lines.filter(line => remaining(line) > 0).length }} 项</strong></div></div>
        <button v-if="canPurchase && ['draft','returned'].includes(draft.requisition.state)" class="btn btn-sm btn-primary wide" type="button" @click="openRequisitionEdit(draft.requisition)">编辑采购需求</button>
        <section class="wide order-detail-block"><header><h4>采购需求明细</h4><span>{{ draft.requisition.lines.length }} 项</span></header><div class="work-table-wrap"><table class="work-table"><thead><tr><th>原料</th><th>申请数量</th><th>批准数量</th><th>已下单</th><th>未下单</th></tr></thead><tbody><tr v-for="line in draft.requisition.lines" :key="line.id"><td><strong>{{ line.product?.name }}</strong></td><td>{{ number(line.requested_qty,3) }} {{ line.uom?.name }}</td><td>{{ number(line.approved_qty,3) }}</td><td>{{ number(line.ordered_qty,3) }}</td><td><strong>{{ number(remaining(line),3) }}</strong></td></tr></tbody></table></div></section>
        <section v-if="draft.requisition.orders?.length" class="wide order-detail-block"><header><h4>关联采购单</h4><span>{{ draft.requisition.orders.length }} 张</span></header><div class="linked-orders"><button v-for="order in draft.requisition.orders" :key="order.id" type="button" @click="openOrderDetail(order)"><strong>{{ order.name }}</strong><span>{{ order.supplier?.name || '-' }}</span><small>审批 {{ stateText(order.approval_state) }} · {{ receiptStateText(order.receipt_state) }}</small></button></div></section>
        <section class="wide order-detail-block"><header><h4>完整审批流水</h4><span>{{ stateText(draft.requisition.state) }}</span></header><div v-if="draft.requisition.approval_history?.length" class="approval-timeline"><div v-for="(step,index) in draft.requisition.approval_history" :key="step.cycle + '-' + index" :data-state="step.state"><i></i><div><strong>第 {{ step.cycle }} 轮 · {{ step.role_label || approvalRoleText(step.role_code) }}</strong><span>{{ historyStateText(step) }}</span><small>{{ approvalActorText(step) }} · {{ dateTime(step.acted_at) }}</small><p v-if="step.comment">{{ step.comment }}</p></div></div></div><div v-else class="inventory-empty">采购需求尚未提交审批</div></section>
      </template>
      <template v-else-if="modal === 'receipt'"><label><span>待检库位</span><select v-model="draft.qc_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.brew_location_type === 'qc')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label><label><span>入库库位</span><select v-model="draft.destination_location_id"><option value="">请选择</option><option v-for="item in locations.filter(x => x.brew_location_type !== 'qc' && x.usage === 'internal')" :key="item.id" :value="item.id">{{ item.complete_name }}</option></select></label><div class="wide modal-lines"><div v-for="line in draft.lines" :key="line.id" class="receipt-line"><div><strong>{{ line.product?.name }}</strong><small>已收 {{ number(line.prior_received_qty,3) }} / 订购 {{ number(line.quantity,3) }}</small></div><input v-model.number="line.received_qty" type="number" min="0" :max="line.remaining_receipt_qty" step="0.001" placeholder="本次实收"><input :value="line.internal_batch" title="内部批次由系统按收货单自动生成" readonly><input v-model.trim="line.supplier_lot" placeholder="供应商包装批号（无则留空）"><input v-model="line.expiration_date" type="date" @click="openDatePicker"></div></div></template>
      <template v-else-if="modal === 'quality'"><div class="wide modal-lines"><div v-for="line in draft.lines" :key="line.id" class="quality-line"><div><strong>{{ line.product?.name }}</strong><small>{{ line.lot?.name }} · 待检 {{ line.inspected_qty }} {{ line.uom?.name }}</small></div><label><span>合格</span><input v-model.number="line.qualified_qty" type="number" min="0" step="0.001"></label><label><span>不合格</span><input v-model.number="line.rejected_qty" type="number" min="0" step="0.001"></label><label><span>处置</span><select v-model="line.disposition" :disabled="!Number(line.rejected_qty)"><option value="">请选择</option><option value="return">退回供应商</option><option value="scrap">报损</option></select></label></div></div><label class="wide"><span>质检备注</span><textarea v-model.trim="draft.note" rows="2"></textarea></label></template>
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
      <div v-if="modalError" class="master-error wide">{{ modalError }}</div></div><footer><button class="btn btn-secondary" type="button" @click="modal = ''">{{ ['count-review','order-detail','requisition-detail'].includes(modal) ? '关闭' : '取消' }}</button><button v-if="!['count-review','order-detail','requisition-detail'].includes(modal)" class="btn btn-primary" type="button" :disabled="saving" @click="submitModal">{{ saving ? '处理中...' : modal === 'order' ? `按规则生成 ${purchaseOrderGroups.length} 张采购单` : modal === 'order-edit' ? (draft.resubmit ? '保存并重新提交' : '保存修改') : modal === 'requisition-edit' ? '保存修改' : modal === 'plan' ? '生成采购需求单' : '确认' }}</button></footer></section></div>
  </div>
</template>

<style scoped>
.inventory-tabs .inventory-tab-refresh{margin-left:auto;font-size:12px;align-self:center;padding:8px 12px;border:1px solid #ffffff18;border-radius:7px;color:#aaa}
</style>
