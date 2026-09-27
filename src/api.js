const API_BASE = import.meta.env.VITE_API_BASE || "";
const CSRF_STORAGE_KEY = "brew_csrf_token";


export class ApiError extends Error {
  constructor(code, message, status, details = {}, requestId = "") {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}


function csrfToken() {
  return window.sessionStorage.getItem(CSRF_STORAGE_KEY) || "";
}


function idempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


async function request(path, options = {}) {
  const { _retryOnCsrf = true, ...fetchOptions } = options;
  const method = fetchOptions.method || "GET";
  const headers = {
    Accept: "application/json",
    ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...(method !== "GET" && csrfToken() ? { "X-CSRF-Token": csrfToken() } : {}),
    ...(fetchOptions.headers || {})
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    method,
    headers,
    credentials: "include"
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("INVALID_RESPONSE", "服务返回了无法解析的响应。", response.status);
  }
  if (!response.ok || payload.error) {
    const error = payload.error || {};
    if (error.code === "AUTH_CSRF_INVALID" && method !== "GET" && _retryOnCsrf) {
      try {
        const context = await request("/api/v1/auth/me", { _retryOnCsrf: false });
        if (context.csrf_token) {
          window.sessionStorage.setItem(CSRF_STORAGE_KEY, context.csrf_token);
          return request(path, { ...options, _retryOnCsrf: false });
        }
      } catch {
        // 让原始 CSRF 错误继续返回，由页面提示重新登录。
      }
    }
    throw new ApiError(
      error.code || `HTTP_${response.status}`,
      error.message || "请求失败。",
      response.status,
      error.details || {},
      payload.request_id || ""
    );
  }
  return payload.data;
}


export const brewApi = {
  async login(login, password) {
    const data = await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        login,
        password,
        device: { name: "Web 管理端", id: "web-browser" }
      })
    });
    if (data.csrf_token) {
      window.sessionStorage.setItem(CSRF_STORAGE_KEY, data.csrf_token);
    }
    return data;
  },
  me() {
    return request("/api/v1/auth/me").then((data) => {
      if (data.csrf_token) {
        window.sessionStorage.setItem(CSRF_STORAGE_KEY, data.csrf_token);
      }
      return data;
    });
  },
  async logout() {
    try {
      return await request("/api/v1/auth/logout", { method: "POST" });
    } finally {
      window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
    }
  },
  getDashboard() {
    return request("/api/v1/dashboard/overview");
  },
  getReportSummary(params = {}) {
    return request(`/api/v1/reports/summary?${new URLSearchParams(params).toString()}`);
  },
  listExports(params = {}) {
    return request(`/api/v1/exports?${new URLSearchParams(params).toString()}`);
  },
  createExport(data) {
    return request("/api/v1/exports", {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  listNotifications(params = {}) {
    return request(`/api/v1/notifications?${new URLSearchParams(params).toString()}`);
  },
  markNotificationRead(id) {
    return request(`/api/v1/notifications/${id}/read`, {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify({})
    });
  },
  getNotificationPreferences() {
    return request("/api/v1/notification-preferences");
  },
  updateNotificationPreferences(data) {
    return request("/api/v1/notification-preferences", {
      method: "PUT", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  getTanks() {
    return request("/api/v1/tanks");
  },
  listTanks(params = {}) {
    return request(`/api/v1/tanks?${new URLSearchParams(params).toString()}`);
  },
  getTank(id) {
    return request(`/api/v1/tanks/${id}`);
  },
  listFermentationReadings(sessionId, params = {}) {
    return request(`/api/v1/fermentation-sessions/${sessionId}/readings?${new URLSearchParams(params).toString()}`);
  },
  createFermentationReading(sessionId, data) {
    return request(`/api/v1/fermentation-sessions/${sessionId}/readings`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  fermentationSessionAction(sessionId, action, data) {
    return request(`/api/v1/fermentation-sessions/${sessionId}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listProductionAnomalies(params = {}) {
    return request(`/api/v1/production-anomalies?${new URLSearchParams(params).toString()}`);
  },
  productionAnomalyAction(id, action, data) {
    return request(`/api/v1/production-anomalies/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  getMaterials() {
    return request("/api/v1/inventory/lots");
  },
  getInventorySummary(params = {}) {
    return request(`/api/v1/inventory/summary?${new URLSearchParams(params).toString()}`);
  },
  listInventoryLots(params = {}) {
    return request(`/api/v1/inventory/lots?${new URLSearchParams(params).toString()}`);
  },
  listInventoryMovements(params = {}) {
    return request(`/api/v1/inventory/movements?${new URLSearchParams(params).toString()}`);
  },
  listInventoryReservations(params = {}) {
    return request(`/api/v1/inventory/reservations?${new URLSearchParams(params).toString()}`);
  },
  freezeInventoryLot(id, frozen, reason) {
    return request(`/api/v1/inventory/lots/${id}/${frozen ? "freeze" : "unfreeze"}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ reason })
    });
  },
  listInventoryCounts(params = {}) {
    return request(`/api/v1/inventory/counts?${new URLSearchParams(params).toString()}`);
  },
  createInventoryCount(data) {
    return request("/api/v1/inventory/counts", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  inventoryCountAction(id, action, data) {
    return request(`/api/v1/inventory/counts/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listPurchaseRequisitions(params = {}) {
    return request(`/api/v1/purchase-requisitions?${new URLSearchParams(params).toString()}`);
  },
  createPurchaseRequisition(data) {
    return request("/api/v1/purchase-requisitions", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  purchaseRequisitionAction(id, action, data) {
    return request(`/api/v1/purchase-requisitions/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listPurchaseOrders(params = {}) {
    return request(`/api/v1/purchase-orders?${new URLSearchParams(params).toString()}`);
  },
  createPurchaseOrder(data) {
    return request("/api/v1/purchase-orders", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  purchaseOrderAction(id, action, data) {
    return request(`/api/v1/purchase-orders/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listReceipts(params = {}) {
    return request(`/api/v1/receipts?${new URLSearchParams(params).toString()}`);
  },
  createReceipt(data) {
    return request("/api/v1/receipts", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  receiptAction(id, action, data) {
    return request(`/api/v1/receipts/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listQualityInspections(params = {}) {
    return request(`/api/v1/quality-inspections?${new URLSearchParams(params).toString()}`);
  },
  updateQualityResults(id, data) {
    return request(`/api/v1/quality-inspections/${id}/results`, {
      method: "PUT",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  qualityInspectionAction(id, action, data) {
    return request(`/api/v1/quality-inspections/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listMaterialRequisitions(params = {}) {
    return request(`/api/v1/material-requisitions?${new URLSearchParams(params).toString()}`);
  },
  materialRequisitionAction(id, action, data) {
    return request(`/api/v1/material-requisitions/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listProductionBatches(params = {}) {
    return request(`/api/v1/production-batches?${new URLSearchParams(params).toString()}`);
  },
  createProductionBatch(data) {
    return request("/api/v1/production-batches", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  productionBatchAction(id, action, data) {
    return request(`/api/v1/production-batches/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listProductionRecords(params = {}) {
    return request(`/api/v1/production-records?${new URLSearchParams(params).toString()}`);
  },
  createProductionRecord(data) {
    return request("/api/v1/production-records", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  productionRecordAction(id, action, data) {
    return request(`/api/v1/production-records/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listPackagingOrders(params = {}) {
    return request(`/api/v1/packaging-orders?${new URLSearchParams(params).toString()}`);
  },
  createPackagingOrder(data) {
    return request("/api/v1/packaging-orders", {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  packagingOrderAction(id, action, data) {
    return request(`/api/v1/packaging-orders/${id}/${action}`, {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  listTraceCodes(params = {}) {
    return request(`/api/v1/trace-codes?${new URLSearchParams(params).toString()}`);
  },
  getTrace(code) {
    return request(`/api/v1/trace/${encodeURIComponent(code)}`);
  },
  getForwardTrace(lotId) {
    return request(`/api/v1/trace/lots/${lotId}/forward`);
  },
  listOutboundOrders(params = {}) {
    return request(`/api/v1/outbound-orders?${new URLSearchParams(params).toString()}`);
  },
  createOutboundOrder(data) {
    return request("/api/v1/outbound-orders", {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  outboundOrderAction(id, action, data) {
    return request(`/api/v1/outbound-orders/${id}/${action}`, {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  getTasks() {
    return request("/api/v1/tasks");
  },
  listMaster(resource, params = {}) {
    const query = new URLSearchParams(params);
    return request(`/api/v1/${resource}?${query.toString()}`);
  },
  createMaster(resource, data) {
    return request(`/api/v1/${resource}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  updateMaster(resource, id, data) {
    return request(`/api/v1/${resource}/${id}`, {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listAdminUsers(params = {}) {
    return request(`/api/v1/admin/users?${new URLSearchParams(params).toString()}`);
  },
  listAdminRoles() { return request("/api/v1/admin/roles"); },
  updateAdminRole(code, data) {
    return request(`/api/v1/admin/roles/${code}`, { method: "PATCH", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  listAdminOrganizations() { return request("/api/v1/admin/organizations"); },
  createAdminOrganization(data) {
    return request("/api/v1/admin/organizations", { method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  updateAdminOrganization(id, data) {
    return request(`/api/v1/admin/organizations/${id}`, { method: "PATCH", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  createAdminUser(data) {
    return request("/api/v1/admin/users", { method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  updateAdminUser(id, data) {
    return request(`/api/v1/admin/users/${id}`, { method: "PATCH", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  updateAdminUserRoles(id, data) {
    return request(`/api/v1/admin/users/${id}/roles`, { method: "PUT", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  updateAdminUserDataScopes(id, data) {
    return request(`/api/v1/admin/users/${id}/data-scopes`, { method: "PUT", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  resetAdminUserPassword(id, data) {
    return request(`/api/v1/admin/users/${id}/reset-password`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  adminUserAction(id, action, version) {
    return request(`/api/v1/admin/users/${id}/${action}`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify({ version }) });
  },
  masterAction(resource, id, action, version) {
    return request(`/api/v1/${resource}/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ version })
    });
  },
  listRules(resource) {
    return request(`/api/v1/admin/${resource}`);
  },
  createRule(resource, data) {
    return request(`/api/v1/admin/${resource}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  ruleAction(resource, id, action, recordVersion) {
    return request(`/api/v1/admin/${resource}/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ record_version: recordVersion })
    });
  },
  listRecipes(params = {}) {
    return request(`/api/v1/recipes?${new URLSearchParams(params).toString()}`);
  },
  createRecipe(data) {
    return request("/api/v1/recipes", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  updateRecipe(id, data) {
    return request(`/api/v1/recipes/${id}`, {
      method: "PATCH", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  listRecipeVersions(recipeId) {
    return request(`/api/v1/recipes/${recipeId}/versions`);
  },
  getRecipeVersion(versionId) {
    return request(`/api/v1/recipe-versions/${versionId}`);
  },
  copyRecipeVersion(versionId) {
    return request(`/api/v1/recipe-versions/${versionId}/copy`, {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: "{}"
    });
  },
  createRecipeVersion(recipeId, data) {
    return request(`/api/v1/recipes/${recipeId}/versions`, {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  updateRecipeVersion(versionId, data) {
    return request(`/api/v1/recipe-versions/${versionId}`, {
      method: "PATCH", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  replaceRecipeMaterials(versionId, data) {
    return request(`/api/v1/recipe-versions/${versionId}/materials`, {
      method: "PUT", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  replaceRecipeSteps(versionId, data) {
    return request(`/api/v1/recipe-versions/${versionId}/process-steps`, {
      method: "PUT", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data)
    });
  },
  recipeVersionAction(versionId, action, recordVersion, reason = "") {
    return request(`/api/v1/recipe-versions/${versionId}/${action}`, {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify({ record_version: recordVersion, reason })
    });
  },
  listDemands(params = {}) {
    return request(`/api/v1/demands?${new URLSearchParams(params).toString()}`);
  },
  createDemand(data) {
    return request("/api/v1/demands", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listProductionPlans(params = {}) {
    return request(`/api/v1/production-plans?${new URLSearchParams(params).toString()}`);
  },
  createProductionPlan(data) {
    return request("/api/v1/production-plans", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  }
};
