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
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      method,
      headers,
      credentials: "include",
      signal: fetchOptions.signal || controller.signal
    });
  } catch (cause) {
    window.clearTimeout(timeoutId);
    if (cause?.name === "AbortError") throw new ApiError("REQUEST_TIMEOUT", "请求超时，请检查服务连接后重试。", 0);
    throw cause;
  }
  let payload;
  const responseText = await response.text();
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    window.clearTimeout(timeoutId);
    throw new ApiError("INVALID_RESPONSE", responseText?.trim() || "Service returned an empty or invalid response.", response.status);
  } finally {
    window.clearTimeout(timeoutId);
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
  if (method !== 'GET' && typeof window !== 'undefined') window.dispatchEvent(new Event('brew-tasks-changed'));
  return payload.data;
}


async function requestWithMeta(path, options = {}) {
  const { _retryOnCsrf = true, ...fetchOptions } = options;
  const method = fetchOptions.method || "GET";
  const headers = {
    Accept: "application/json",
    ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...(method !== "GET" && csrfToken() ? { "X-CSRF-Token": csrfToken() } : {}),
    ...(fetchOptions.headers || {})
  };
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      method,
      headers,
      credentials: "include",
      signal: fetchOptions.signal || controller.signal
    });
  } catch (cause) {
    window.clearTimeout(timeoutId);
    if (cause?.name === "AbortError") throw new ApiError("REQUEST_TIMEOUT", "请求超时，请检查服务连接后重试。", 0);
    throw cause;
  }
  let payload;
  const responseText = await response.text();
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    window.clearTimeout(timeoutId);
    throw new ApiError("INVALID_RESPONSE", responseText?.trim() || "Service returned an empty or invalid response.", response.status);
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!response.ok || payload.error) {
    const error = payload.error || {};
    throw new ApiError(
      error.code || `HTTP_${response.status}`,
      error.message || "请求失败。",
      response.status,
      error.details || {},
      payload.request_id || ""
    );
  }
  return { data: payload.data || [], meta: payload.meta || {} };
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
  getDashboard(params = {}) {
    return request(`/api/v1/dashboard/overview?${new URLSearchParams(params).toString()}`);
  },
  getReportCatalog() { return request('/api/v1/reports/catalog'); },
  getReportData(code, params = {}) { return request(`/api/v1/reports/data/${code}?${new URLSearchParams(params)}`); },
  reportDownloadUrl(code, params = {}) { return `${API_BASE}/api/v1/reports/data/${code}/download?${new URLSearchParams(params)}`; },
  listInventoryCountPage(params = {}) { return requestWithMeta(`/api/v1/inventory/counts?${new URLSearchParams(params)}`); },
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
    return request(`/api/v1/fermentation/tanks/${id}`);
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
  getOpeningStockOptions(factoryId = "") {
    const query = factoryId ? `?factory_id=${encodeURIComponent(factoryId)}` : "";
    return request(`/api/v1/inventory/opening-stock/options${query}`);
  },
  createOpeningStock(data) {
    return request("/api/v1/inventory/opening-stock", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  getInventoryLot(id) {
    return request(`/api/v1/inventory/lots/${id}`);
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
  listInventoryCountPage(params = {}) {
    return requestWithMeta(`/api/v1/inventory/counts?${new URLSearchParams({ compact: true, ...params }).toString()}`);
  },
  inventoryCountOptions(params = {}) {
    return request(`/api/v1/inventory/counts/options?${new URLSearchParams(params).toString()}`);
  },
  addInventoryCountLine(id, data) {
    return request(`/api/v1/inventory/counts/${id}/lines`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  createInventoryCount(data) {
    return request("/api/v1/inventory/counts", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  updateInventoryCountLines(id, data) {
    return request(`/api/v1/inventory/counts/${id}/lines`, {
      method: "PUT",
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
    return requestWithMeta(`/api/v1/purchase-requisitions?${new URLSearchParams(params).toString()}`);
  },
  getPurchaseRequisition(id) {
    return request(`/api/v1/purchase-requisitions/${id}`);
  },
  createPurchaseRequisition(data) {
    return request("/api/v1/purchase-requisitions", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  listPurchaseSourcePlans(params = {}) {
    return request(`/api/v1/purchase-requisitions/source-plans?${new URLSearchParams(params).toString()}`);
  },
  aggregatePurchaseRequisitions(data) {
    return request("/api/v1/purchase-requisitions/aggregate", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  updatePurchaseRequisition(id, data) {
    return request(`/api/v1/purchase-requisitions/${id}`, {
      method: "PATCH",
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
    return requestWithMeta(`/api/v1/purchase-orders?${new URLSearchParams(params).toString()}`);
  },
  getPurchaseOrder(id) {
    return request(`/api/v1/purchase-orders/${id}`);
  },
  updatePurchaseOrder(id, data) {
    return request(`/api/v1/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  createPurchaseOrder(data) {
    return request("/api/v1/purchase-orders", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  createPurchaseOrderFromRequisitions(data) {
    return request("/api/v1/purchase-orders/from-requisitions", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  createSupplierShipment(orderId, data) {
    return request(`/api/v1/purchase-orders/${orderId}/shipments`, {
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
    return requestWithMeta(`/api/v1/receipts?${new URLSearchParams(params).toString()}`);
  },
  getReceipt(id) {
    return request(`/api/v1/receipts/${id}`);
  },
  updateReceipt(id, data) {
    return request(`/api/v1/receipts/${id}`, {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
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
    return requestWithMeta(`/api/v1/quality-inspections?${new URLSearchParams(params).toString()}`);
  },
  getQualityInspection(id) {
    return request(`/api/v1/quality-inspections/${id}`);
  },
  createQualityInspection(data) {
    return request("/api/v1/quality-inspections", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
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
  listPurchaseReturns(params = {}) {
    return requestWithMeta(`/api/v1/purchase-returns?${new URLSearchParams(params).toString()}`);
  },
  getPurchaseReturn(id) {
    return request(`/api/v1/purchase-returns/${id}`);
  },
  createPurchaseReturn(data) {
    return request("/api/v1/purchase-returns", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  updatePurchaseReturn(id, data) {
    return request(`/api/v1/purchase-returns/${id}`, {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  purchaseReturnAction(id, action, data) {
    return request(`/api/v1/purchase-returns/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  getReturnableLines(orderId) {
    return request(`/api/v1/purchase-orders/${orderId}/returnable-lines`);
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
  getProductionBatch(id) {
    return request(`/api/v1/production-batches/${id}`);
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
  getPlanPackagingOptions(productId, factoryId = '') {
    return request(`/api/v1/production-plan-packaging-options?${new URLSearchParams({ product_tmpl_id: productId, factory_id: factoryId || '' })}`);
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
  searchProductTrace(params) {
    return request(`/api/v1/product-trace?${new URLSearchParams(params)}`);
  },
  getProductTraceBatch(batchId, packagingId) {
    return request(`/api/v1/product-trace/batches/${batchId}?${new URLSearchParams(packagingId ? { packaging_id: packagingId } : {})}`);
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
  listApprovals(params = {}) {
    return request('/api/v1/approvals?' + new URLSearchParams({ page_size: 100, ...params }).toString());
  },
  approvalAction(id, action, data) {
    return request('/api/v1/approvals/' + id + '/' + action, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  getMyWorkbench(params = {}) {
    return request('/api/v1/my-workbench?' + new URLSearchParams(params).toString());
  },
  getInventoryCount(id) { return request(`/api/v1/inventory/counts/${id}`); },
  inventoryDocumentAction(kind, id, version) {
    return request(`/api/v1/inventory/${kind === 'transfer' ? 'transfers' : 'scraps'}/${id}/confirm`, {
      method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify({ version })
    });
  },
  getTasks(params = {}) {
    return request(`/api/v1/tasks?${new URLSearchParams({ page_size: 100, ...params }).toString()}`);
  },
  taskAction(id, action, data) {
    return request(`/api/v1/tasks/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
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
  createDemandCustomer(data) {
    return request('/api/v1/demand-customers', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey() }, body: JSON.stringify(data) });
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
  getAdminContext() { return request("/api/v1/admin/context"); },
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
  getRecipe(id) {
    return request(`/api/v1/recipes/${id}`);
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
  deleteRecipe(id, version) {
    return request(`/api/v1/recipes/${id}`, {
      method: "DELETE", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify({ version })
    });
  },
  listRecipeVersions(recipeId) {
    return request(`/api/v1/recipes/${recipeId}/versions`);
  },
  listRecipeProductionRuns(recipeId, params = {}) {
    return request(`/api/v1/recipes/${recipeId}/production-runs?${new URLSearchParams(params).toString()}`);
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
  recipeVersionAction(versionId, action, recordVersion, reason = "", comment = "") {
    return request(`/api/v1/recipe-versions/${versionId}/${action}`, {
      method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify({ record_version: recordVersion, reason, comment })
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
  getDemand(id) {
    return request(`/api/v1/demands/${id}`);
  },
  updateDemand(id, data) {
    return request(`/api/v1/demands/${id}`, {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  },
  demandAction(id, action, version, reason = "") {
    return request(`/api/v1/demands/${id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify({ version, reason })
    });
  },
  listProductionPlans(params = {}) {
    return request(`/api/v1/production-plans?${new URLSearchParams(params).toString()}`);
  },
  listProductionPlanAssignees(factoryId) {
    return request(`/api/v1/production-plan-assignees?${new URLSearchParams({ factory_id: factoryId }).toString()}`);
  },
  previewPlanInventory(data) {
    return request("/api/v1/production-plan-inventory-preview", { method: "POST", body: JSON.stringify(data) });
  },
  getPlanProgress(id) { return request(`/api/v1/production-plans/${id}/progress`); },
  productionPlanAction(id, action, data) {
    return request(`/api/v1/production-plans/${id}/${action}`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify(data) });
  },
  createProductionPlan(data) {
    return request("/api/v1/production-plans", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey() },
      body: JSON.stringify(data)
    });
  }
};

Object.assign(brewApi, {
  packagingSchema() { return request('/api/v1/packaging-materials/schema'); },
  listPackaging(params={}) { return request(`/api/v1/packaging-materials?${new URLSearchParams(params)}`); },
  savePackaging(id,data) { return request(`/api/v1/packaging-materials${id ? '/'+id : ''}`, { method:id?'PATCH':'POST',headers:{'Idempotency-Key':idempotencyKey()},body:JSON.stringify(data) }); },
  packagingAction(id,action,data) { return request(`/api/v1/packaging-materials/${id}/${action}`,{method:'POST',headers:{'Idempotency-Key':idempotencyKey()},body:JSON.stringify(data)}); },
  getWaterTargets(params={}) { return request(`/api/v1/water-targets?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v])=>v!==''&&v!=null)))}`); },
  saveWaterTarget(data) { return request(`/api/v1/water-targets${data.id?'/'+data.id:''}`,{method:'POST',body:JSON.stringify(data)}); },
  getWaterSources(factoryId='') { return request(`/api/v1/water-sources${factoryId?'?'+new URLSearchParams({factory_id:factoryId}):''}`); },
  saveWaterSource(data) { return request(`/api/v1/water-sources${data.id?'/'+data.id:''}`,{method:'POST',body:JSON.stringify(data)}); },
  browseStock(params={}) { return request(`/api/v1/inventory/browse?${new URLSearchParams(params)}`); },
  stockProduct(id,params={}) { return request(`/api/v1/inventory/browse/${id}?${new URLSearchParams(params)}`); }
});
