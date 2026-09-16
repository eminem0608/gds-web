<template>
  <div v-if="authLoading" class="auth-state">正在检查登录状态...</div>

  <main v-else-if="!authContext" class="login-shell">
    <section class="login-panel">
      <div class="login-brand">发啦啦精酿</div>
      <h1>管理端登录</h1>
      <p>账号、角色、厂区和菜单权限由后台统一管理。</p>
      <form class="login-form" @submit.prevent="signIn">
        <label>
          <span>账号</span>
          <input v-model.trim="loginForm.login" autocomplete="username" required>
        </label>
        <label>
          <span>密码</span>
          <input v-model="loginForm.password" type="password" autocomplete="current-password" required>
        </label>
        <div v-if="authError" class="login-error">{{ authError }}</div>
        <button class="btn btn-primary login-submit" type="submit" :disabled="authSubmitting">
          {{ authSubmitting ? "登录中..." : "登录" }}
        </button>
      </form>
    </section>
  </main>

  <div v-else class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-row">
          <div class="brand-icon">发</div>
          <div>
            <div class="brand-name">发啦啦精酿</div>
            <div class="brand-sub">生产管理 SaaS · Vue</div>
          </div>
        </div>
      </div>

      <div class="role-box">
        <div class="role-label">已授权角色</div>
        <div class="role-summary">{{ authContext.roles.map(role => role.label).join(" / ") || "暂无业务角色" }}</div>
      </div>

      <nav class="nav">
        <template v-for="section in visibleNavSections" :key="section.title">
          <div class="nav-title">{{ section.title }}</div>
          <button
            v-for="item in section.items"
            :key="item.id"
            class="nav-item"
            :class="{ active: currentPage === item.id }"
            type="button"
            @click="currentPage = item.id"
          >
            <span class="nav-icon">{{ pageMeta[item.id].icon }}</span>
            <span>{{ item.label }}</span>
          </button>
        </template>
      </nav>

      <div class="sidebar-footer">
        <div class="avatar">{{ authContext.user.name.slice(0, 1) }}</div>
        <div>
          <div class="user-name">{{ authContext.user.name }}</div>
          <div class="user-role">{{ currentCompanyName }}</div>
        </div>
      </div>
    </aside>

    <main class="main">
      <header class="header">
        <div>
          <div class="page-title">{{ currentMeta.title }}</div>
          <div class="page-subtitle">{{ currentMeta.subtitle }}</div>
        </div>
        <div class="header-actions">
          <input v-model="keyword" class="search" placeholder="搜索批次、产品、罐号、订单">
          <button v-if="visiblePageCodes.includes('production')" class="btn btn-secondary" type="button" @click="go('production')">业务录入</button>
          <button class="btn btn-primary" type="button" @click="refreshCurrent">刷新</button>
          <button class="btn btn-secondary" type="button" @click="signOut">退出</button>
        </div>
      </header>

      <section :key="pageRevision" class="content">
        <DashboardPage v-if="currentPage === 'dashboard'" @go="go" />
        <FactoryPage v-else-if="currentPage === 'factory'" :permissions="authContext.permissions" />
        <ProductionPage v-else-if="currentPage === 'production'" :permissions="authContext.permissions" />
        <RecipePage v-else-if="currentPage === 'recipe'" :permissions="authContext.permissions" />
        <InventoryPage v-else-if="currentPage === 'inventory'" @toast="showToast" />
        <TracePage v-else-if="currentPage === 'trace'" />
        <ReportsPage v-else-if="currentPage === 'reports'" />
        <SettingsPage v-else-if="currentPage === 'settings'" :permissions="authContext.permissions" />
        <TasksPage v-else-if="currentPage === 'tasks'" />
      </section>
    </main>

    <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>

  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from "vue";
import { brewApi } from "./api";
import { navSections, pageMeta, roles } from "./data";

const currentRole = ref("gm");
const currentPage = ref("dashboard");
const keyword = ref("");
const toastMessage = ref("");
const pageRevision = ref(0);
const authLoading = ref(true);
const authSubmitting = ref(false);
const authContext = ref(null);
const authError = ref("");
const loginForm = reactive({ login: "", password: "" });

const apiRoleMap = {
  general_manager: "gm",
  production_director: "director",
  operator: "operator",
  warehouse_keeper: "warehouse",
  purchaser: "purchase",
  salesperson: "sales",
  finance: "finance",
  tenant_admin: "admin"
};

const currentCompanyName = computed(() => {
  const company = authContext.value?.companies.find(
    item => item.id === authContext.value.current_company_id
  );
  return company?.name || "未选择企业";
});

const roleConfig = computed(() => roles[currentRole.value]);
const currentMeta = computed(() => pageMeta[currentPage.value]);

const visibleNavSections = computed(() => {
  const serverPages = new Set((authContext.value?.menus || []).map(item => item.code));
  const pages = authContext.value ? [...serverPages] : roleConfig.value.pages;
  return navSections
    .map((section) => ({
      title: section.title,
      items: section.items
        .filter(([id]) => pages.includes(id))
        .map(([id, label]) => ({ id, label }))
    }))
    .filter((section) => section.items.length);
});
const visiblePageCodes = computed(() => visibleNavSections.value.flatMap(section => section.items.map(item => item.id)));

function applyAuthContext(context) {
  authContext.value = context;
  const roleCode = context.roles?.[0]?.code;
  currentRole.value = apiRoleMap[roleCode] || "operator";
  const allowedPages = new Set((context.menus || []).map(item => item.code));
  currentPage.value = allowedPages.has(context.default_page)
    ? context.default_page
    : (context.menus?.[0]?.code || "tasks");
}

async function restoreSession() {
  try {
    applyAuthContext(await brewApi.me());
  } catch {
    authContext.value = null;
  } finally {
    authLoading.value = false;
  }
}

async function signIn() {
  authSubmitting.value = true;
  authError.value = "";
  try {
    const result = await brewApi.login(loginForm.login, loginForm.password);
    applyAuthContext(result.context);
    loginForm.password = "";
  } catch (error) {
    authError.value = error.message || "登录失败。";
  } finally {
    authSubmitting.value = false;
  }
}

async function signOut() {
  try {
    await brewApi.logout();
  } finally {
    authContext.value = null;
    currentPage.value = "dashboard";
  }
}

onMounted(restoreSession);

watch(currentRole, () => {
  if (!roleConfig.value.pages.includes(currentPage.value)) {
    currentPage.value = roleConfig.value.pages[0];
  }
});

function go(page) {
  currentPage.value = page;
}

function refreshCurrent() {
  pageRevision.value += 1;
  showToast("已重新加载当前页面");
}

function showToast(message) {
  toastMessage.value = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastMessage.value = "";
  }, 1800);
}


function tagClass(text) {
  const map = {
    正常: "tag-success",
    可售: "tag-success",
    已排产: "tag-success",
    使用中: "tag-success",
    已审核: "tag-success",
    发酵中: "tag-warning",
    待排产: "tag-warning",
    低库存: "tag-warning",
    待备料: "tag-warning",
    待执行: "tag-warning",
    待审核: "tag-warning",
    已下单: "tag-warning",
    待导出: "tag-warning",
    待生成订单: "tag-warning",
    已下发: "tag-info",
    冷贮: "tag-info",
    待包装: "tag-gold",
    空罐: "tag-success",
    逾期风险: "tag-error",
    紧急: "tag-error",
    异常: "tag-error"
  };
  return map[text] || "tag-info";
}

const StatusTag = defineComponent({
  props: { text: { type: String, required: true } },
  setup(props) {
    return () => h("span", { class: ["tag", tagClass(props.text)] }, props.text);
  }
});

const StatCard = defineComponent({
  props: ["label", "value", "change", "tone"],
  template: `
    <div class="stat-card">
      <div class="stat-head"><div class="stat-label">{{ label }}</div><div class="mono">●</div></div>
      <div class="stat-value">{{ value }}</div>
      <div class="stat-change" :class="tone">{{ change }}</div>
    </div>
  `
});

const TaskCard = defineComponent({
  components: { StatusTag },
  props: ["title", "desc", "state"],
  template: `
    <div class="task-card">
      <div>
        <div class="task-title">{{ title }}</div>
        <div class="task-desc">{{ desc }}</div>
      </div>
      <StatusTag :text="state" />
    </div>
  `
});

const BarChart = defineComponent({
  props: { values: Array, labels: Array },
  computed: {
    max() {
      return Math.max(...this.values, 1);
    }
  },
  template: `
    <div class="chart-bars">
      <div v-for="(value, index) in values" :key="labels[index]" class="chart-bar">
        <div class="bar-fill" :style="{ height: Math.max(12, value / max * 100) + '%' }"></div>
        <div>{{ labels[index] }}</div>
      </div>
    </div>
  `
});

const Workflow = defineComponent({
  props: { items: Array },
  template: `
    <div class="workflow">
      <div v-for="item in items" :key="item.title" class="flow-node" :class="item.state">
        <div class="flow-title">{{ item.title }}</div>
        <div class="flow-desc">{{ item.desc }}</div>
      </div>
    </div>
  `
});

const TankCard = defineComponent({
  components: { StatusTag },
  props: { tank: Object },
  emits: ["open"],
  computed: {
    fillPercent() {
      return Math.round((this.tank.volume / this.tank.capacity) * 100);
    },
    statusText() {
      return { fermenting: "发酵中", cold: "冷贮", alert: "异常", empty: "空罐", ready: "待包装" }[this.tank.status] || this.tank.status;
    }
  },
  template: `
    <div class="tank-card" @click="$emit('open', tank)">
      <div class="tank-top">
        <div>
          <div class="tank-name">{{ tank.id }} · {{ tank.type }}</div>
          <div class="tank-meta">{{ tank.factory }} · {{ tank.product || '空闲' }}</div>
        </div>
        <StatusTag :text="statusText" />
      </div>
      <div class="tank-visual">
        <div class="tank-shape"><div class="tank-fill" :style="{ height: fillPercent + '%' }"></div></div>
        <div class="tank-lines">
          <div class="tank-line"><span>批次</span><strong>{{ tank.batch || '-' }}</strong></div>
          <div class="tank-line"><span>体积</span><strong>{{ tank.volume }}/{{ tank.capacity }}L</strong></div>
          <div class="tank-line"><span>温度</span><strong>{{ tank.volume ? tank.temp + '℃' : '-' }}</strong></div>
          <div class="tank-line"><span>压力</span><strong>{{ tank.volume ? tank.pressure + 'bar' : '-' }}</strong></div>
          <div class="tank-line"><span>糖度</span><strong>{{ tank.volume ? tank.gravity + '°P' : '-' }}</strong></div>
          <div class="tank-line"><span>任务</span><strong>{{ tank.tasks }}</strong></div>
        </div>
      </div>
    </div>
  `
});

const DataTable = defineComponent({
  components: { StatusTag },
  props: { columns: Array, rows: Array },
  template: `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th v-for="column in columns" :key="column.key">{{ column.label }}</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id || row.batch || JSON.stringify(row)">
            <td v-for="column in columns" :key="column.key" :class="{ mono: column.mono }">
              <StatusTag v-if="column.tag" :text="row[column.key]" />
              <template v-else>{{ column.format ? column.format(row) : row[column.key] }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `
});

const Tabs = defineComponent({
  props: { tabs: Array, modelValue: String },
  emits: ["update:modelValue"],
  template: `
    <div class="tabs">
      <button v-for="tab in tabs" :key="tab.id" class="tab" :class="{ active: modelValue === tab.id }" @click="$emit('update:modelValue', tab.id)">
        {{ tab.label }}
      </button>
    </div>
  `
});

const DashboardPage = defineComponent({
  components: { StatCard, TaskCard, TankCard, Workflow, BarChart },
  emits: ["go"],
  data() {
    return { overview: { metrics: {}, tanks: [], alerts: [] }, loading: false, error: "" };
  },
  computed: {
    activeTanks() {
      return this.overview.tanks.filter((tank) => !["empty", "maintenance"].includes(tank.status));
    },
    dashboardTanks() {
      return this.overview.tanks.slice(0, 3).map((tank) => ({
        id: tank.name, type: tank.status, factory: tank.factory, product: tank.product,
        batch: tank.batch, volume: tank.volume_l, capacity: tank.capacity_l,
        temp: tank.temperature_c, pressure: tank.pressure_bar, gravity: tank.gravity_plato,
        tasks: this.overview.alerts.filter((item) => item.tank === tank.name).length,
        status: tank.status === "cold_crash" ? "cold" : tank.status
      }));
    },
    workflowItems() {
      const metrics = this.overview.metrics;
      return [
        { title: "生产计划", desc: `${metrics.plans_pending || 0} 项待推进`, state: metrics.plans_pending ? "active" : "done" },
        { title: "发酵管理", desc: `${metrics.active_tanks || 0} 罐运行`, state: metrics.active_tanks ? "active" : "done" },
        { title: "包装放行", desc: `${metrics.packaging_pending || 0} 单待处理`, state: metrics.packaging_pending ? "active" : "done" },
        { title: "销售出库", desc: `${metrics.outbound_pending || 0} 单待发运`, state: metrics.outbound_pending ? "active" : "done" }
      ];
    },
    queueValues() {
      const metrics = this.overview.metrics;
      return [metrics.open_tasks || 0, metrics.plans_pending || 0, metrics.packaging_pending || 0, metrics.outbound_pending || 0];
    }
  },
  mounted() { this.load(); },
  methods: {
    async load() {
      this.loading = true; this.error = "";
      try { this.overview = await brewApi.getDashboard(); }
      catch (error) { this.error = error.message || "看板加载失败"; }
      finally { this.loading = false; }
    }
  },
  template: `
    <div v-if="error" class="master-error">{{ error }}</div>
    <div class="stats-grid">
      <StatCard label="待办任务" :value="overview.metrics.open_tasks || 0" change="当前厂区范围" tone="warn" />
      <StatCard label="运行罐体" :value="overview.metrics.active_tanks || 0" :change="(overview.metrics.open_anomalies || 0) + ' 项异常'" tone="down" />
      <StatCard label="待包装酒液" :value="(overview.metrics.ready_volume_l || 0).toFixed(1) + 'L'" :change="(overview.metrics.packaging_pending || 0) + ' 个包装单'" tone="up" />
      <StatCard label="临期批次" :value="overview.metrics.expiring_lots || 0" change="未来 30 天" tone="warn" />
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><div class="panel-title">生产闭环进度</div><div class="panel-subtitle">需求到出库的关键状态</div></div><button class="btn btn-sm btn-outline" @click="$emit('go','production')">查看生产</button></div>
        <div class="panel-body"><Workflow :items="workflowItems" /></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">异常提醒</div><button class="btn btn-sm btn-outline" @click="$emit('go','factory')">处理</button></div>
        <div class="panel-body task-list">
          <TaskCard v-for="alert in overview.alerts" :key="alert.id" :title="alert.tank + ' · ' + alert.type" :desc="alert.session + ' · ' + (alert.detected_at || '-')" :state="alert.severity" />
          <div v-if="!overview.alerts.length" class="empty">当前无未关闭生产异常</div>
        </div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">发酵罐摘要</div><button class="btn btn-sm btn-outline" @click="$emit('go','factory')">进入酒厂</button></div>
        <div class="panel-body"><div class="tank-grid"><TankCard v-for="tank in dashboardTanks" :key="tank.id" :tank="tank" /></div><div v-if="!dashboardTanks.length" class="empty">暂无罐体数据</div></div>
      </div>
      <div class="panel"><div class="panel-header"><div class="panel-title">当前业务队列</div></div><div class="panel-body"><BarChart :values="queueValues" :labels="['任务','计划','包装','出库']" /></div></div>
    </div>
  `
});

const FactoryPage = defineComponent({
  components: { Tabs, StatCard, TankCard, DataTable, TaskCard, StatusTag },
  props: { permissions: { type: Array, default: () => [] } },
  data() {
    return {
      tab: "tanks",
      overview: { metrics: {}, tanks: [], alerts: [] },
      plans: [],
      lots: [],
      tasks: [],
      selectedTank: null,
      readings: [],
      readingDraft: { temperature_c: "", pressure_bar: "", gravity_plato: "", ph: "", volume_l: "", note: "" },
      loading: false,
      readingSaving: false,
      error: ""
    };
  },
  computed: {
    tabs() {
      const result = [{ id: "tanks", label: "发酵罐状态" }];
      if (this.canReadPlans) result.push({ id: "plans", label: "生产计划" });
      if (this.canReadStock) result.push({ id: "stock", label: "库存视图" });
      result.push({ id: "site", label: "现场任务" });
      return result;
    },
    canReadPlans() {
      return this.permissions.some(item => ["dashboard.plans.read", "plan.production.read", "plan.production.manage"].includes(item));
    },
    canReadStock() {
      return this.permissions.some(item => ["dashboard.inventory.read", "inventory.stock.read"].includes(item));
    },
    canRecordReading() {
      return this.permissions.includes("production.fermentation.record");
    },
    tankRows() {
      return this.overview.tanks.map(item => ({
        apiId: item.id,
        id: item.name,
        factory: item.factory,
        type: item.status,
        status: ({ cold_crash: "cold", conditioning: "cold", abnormal: "alert" })[item.status] || item.status,
        product: item.product,
        batch: item.batch,
        volume: item.volume_l,
        capacity: item.capacity_l,
        temp: item.temperature_c,
        pressure: item.pressure_bar,
        gravity: item.gravity_plato,
        tasks: this.overview.alerts.filter(alert => alert.tank === item.name).length
      }));
    },
    planRows() {
      return this.plans.map(item => ({
        id: item.name,
        type: "生产",
        product: item.product?.name,
        volume: item.planned_volume_l,
        recipe: item.recipe_version?.name,
        date: item.planned_start?.replace("T", " ").slice(0, 16),
        factory: item.factory?.name,
        device: item.equipment?.name,
        tank: item.tank?.name,
        owner: item.owner?.name || "-",
        state: ({ draft: "草稿", submitted: "待审批", approved: "已批准", dispatched: "已下发", in_progress: "执行中", done: "已完成", cancelled: "已取消", terminated: "已终止" })[item.state] || item.state
      }));
    },
    stockRows() {
      return this.lots
        .filter(item => ["semi_finished", "finished_product"].includes(item.product?.category))
        .map(item => ({
          id: item.id,
          location: item.locations?.map(location => location.name).join(" / ") || "-",
          name: item.product?.name || "-",
          batch: item.name,
          qty: Number(item.on_hand || 0),
          reserved: Number(item.reserved || 0),
          unit: item.uom,
          expire: item.expiration_date || "-",
          status: item.frozen ? "已冻结" : ({ pending: "待检", qualified: "可售", rejected: "不合格" })[item.quality_status] || item.quality_status
        }));
    },
    siteTasks() {
      return this.tasks.map(item => ({
        ...item,
        description: [item.task_type, item.due_at, item.assignee?.name].filter(Boolean).join(" · "),
        stateText: ({ pending: "待领取", claimed: "已领取", in_progress: "进行中", done: "已完成", returned: "已退回", cancelled: "已取消" })[item.state] || item.state
      }));
    },
    stockColumns() { return stockColumns; },
    planColumns() { return planColumns; },
    fermentingCount() { return this.tankRows.filter(item => !["empty", "maintenance"].includes(item.status)).length; },
    emptyCount() { return this.tankRows.filter(item => item.status === "empty").length; },
    readyVolume() { return Number(this.overview.metrics.ready_volume_l || 0).toFixed(1); },
    anomalyCount() { return Number(this.overview.metrics.open_anomalies || 0); }
  },
  mounted() { this.load(); },
  methods: {
    async load() {
      this.loading = true;
      this.error = "";
      const requests = [
        ["overview", brewApi.getDashboard()],
        ["tasks", brewApi.getTasks()]
      ];
      if (this.canReadPlans) requests.push(["plans", brewApi.listProductionPlans({ page_size: 100 })]);
      if (this.canReadStock) requests.push(["lots", brewApi.listInventoryLots({ page_size: 100 })]);
      const results = await Promise.allSettled(requests.map(([, promise]) => promise));
      const errors = [];
      results.forEach((result, index) => {
        const name = requests[index][0];
        if (result.status === "fulfilled") this[name] = result.value;
        else errors.push(result.reason?.message || `${name} 加载失败`);
      });
      this.error = errors.join("；");
      this.loading = false;
    },
    async openTank(tank) {
      this.error = "";
      try {
        this.selectedTank = await brewApi.getTank(tank.apiId);
        this.readings = this.selectedTank.session_id
          ? await brewApi.listFermentationReadings(this.selectedTank.session_id, { page_size: 20 })
          : [];
      } catch (cause) {
        this.error = cause.message || "罐体详情加载失败。";
      }
    },
    async submitReading() {
      if (!this.selectedTank?.session_id) return;
      this.readingSaving = true;
      this.error = "";
      try {
        const payload = {};
        for (const [key, value] of Object.entries(this.readingDraft)) {
          if (value !== "") payload[key] = ["note"].includes(key) ? value : Number(value);
        }
        await brewApi.createFermentationReading(this.selectedTank.session_id, payload);
        this.readingDraft = { temperature_c: "", pressure_bar: "", gravity_plato: "", ph: "", volume_l: "", note: "" };
        await this.openTank({ apiId: this.selectedTank.id });
        await this.load();
      } catch (cause) {
        this.error = cause.message || "发酵读数保存失败。";
      } finally {
        this.readingSaving = false;
      }
    }
  },
  template: `
    <div v-if="error" class="master-error">{{ error }}</div>
    <Tabs v-model="tab" :tabs="tabs" />
    <template v-if="tab === 'tanks'">
      <div class="stats-grid">
        <StatCard label="运行罐体" :value="fermentingCount" change="发酵、冷贮及待包装" tone="warn" />
        <StatCard label="空罐" :value="emptyCount" change="当前授权厂区" tone="up" />
        <StatCard label="待包装酒液" :value="readyVolume + 'L'" change="已达到包装状态" tone="up" />
        <StatCard label="未关闭异常" :value="anomalyCount" change="需处理或复核" tone="down" />
      </div>
      <div class="panel">
        <div class="panel-header"><div><div class="panel-title">按厂区展示发酵罐</div><div class="panel-subtitle">点击罐体查看实时会话与读数</div></div><button class="btn btn-sm btn-secondary" :disabled="loading" @click="load">{{ loading ? '加载中...' : '刷新' }}</button></div>
        <div class="panel-body"><div class="tank-grid"><TankCard v-for="tank in tankRows" :key="tank.apiId" :tank="tank" @open="openTank" /></div><div v-if="!tankRows.length && !loading" class="empty">当前范围暂无罐体</div></div>
      </div>
      <div v-if="selectedTank" class="panel">
        <div class="panel-header"><div><div class="panel-title">{{ selectedTank.name }} · {{ selectedTank.current_batch_no || '空罐' }}</div><div class="panel-subtitle">{{ selectedTank.factory.name }} · {{ selectedTank.current_product || '未关联产品' }}</div></div><button class="btn btn-sm btn-secondary" @click="selectedTank = null">关闭</button></div>
        <div class="metric-strip">
          <div class="metric-cell"><span class="metric-label">温度</span><strong class="metric-number">{{ Number(selectedTank.current_temperature || 0).toFixed(1) }} ℃</strong></div>
          <div class="metric-cell"><span class="metric-label">压力</span><strong class="metric-number">{{ Number(selectedTank.current_pressure || 0).toFixed(2) }} bar</strong></div>
          <div class="metric-cell"><span class="metric-label">糖度</span><strong class="metric-number">{{ Number(selectedTank.current_gravity || 0).toFixed(2) }} °P</strong></div>
          <div class="metric-cell"><span class="metric-label">体积</span><strong class="metric-number">{{ Number(selectedTank.current_volume_l || 0).toFixed(1) }} L</strong></div>
        </div>
        <form v-if="canRecordReading && selectedTank.session_id" class="master-form" @submit.prevent="submitReading">
          <label><span>温度(℃)</span><input v-model="readingDraft.temperature_c" type="number" step="0.01" required></label>
          <label><span>压力(bar)</span><input v-model="readingDraft.pressure_bar" type="number" step="0.01" required></label>
          <label><span>糖度(°P)</span><input v-model="readingDraft.gravity_plato" type="number" step="0.01" required></label>
          <label><span>pH</span><input v-model="readingDraft.ph" type="number" step="0.01"></label>
          <label><span>体积(L)</span><input v-model="readingDraft.volume_l" type="number" step="0.01"></label>
          <label><span>备注</span><input v-model.trim="readingDraft.note"></label>
          <div class="master-form-actions"><button class="btn btn-sm btn-primary" :disabled="readingSaving">{{ readingSaving ? '保存中...' : '保存读数' }}</button></div>
        </form>
        <div class="panel-body task-list">
          <div v-for="reading in readings" :key="reading.id" class="task-card"><div><div class="task-title">{{ reading.recorded_at?.replace('T',' ').slice(0,16) }} · {{ reading.recorded_by.name }}</div><div class="task-desc">{{ reading.temperature_c }} ℃ · {{ reading.pressure_bar }} bar · {{ reading.gravity_plato }} °P<span v-if="reading.ph"> · pH {{ reading.ph }}</span></div></div><StatusTag :text="({draft:'草稿',submitted:'待审核',approved:'已审核',returned:'已退回'})[reading.state] || reading.state" /></div>
          <div v-if="!readings.length" class="empty">当前会话暂无读数</div>
        </div>
      </div>
    </template>
    <div v-else-if="tab === 'plans'" class="panel"><div class="panel-header"><div class="panel-title">生产计划</div></div><div class="panel-body no-padding"><DataTable :columns="planColumns" :rows="planRows" /></div></div>
    <div v-else-if="tab === 'stock'" class="panel"><div class="panel-header"><div class="panel-title">半成品与成品库存</div></div><div class="panel-body no-padding"><DataTable :columns="stockColumns" :rows="stockRows" /></div></div>
    <div v-else class="panel"><div class="panel-header"><div class="panel-title">现场任务</div></div><div class="panel-body task-list"><TaskCard v-for="task in siteTasks" :key="task.id" :title="task.name" :desc="task.description" :state="task.stateText" /><div v-if="!siteTasks.length" class="empty">当前角色暂无现场任务</div></div></div>
  `
});

const ProductionPage = defineComponent({
  components: { Tabs, DataTable, Workflow, TaskCard },
  props: { permissions: { type: Array, default: () => [] } },
  data() {
    return {
      tab: "requests",
      demands: [],
      customers: [],
      products: [],
      demandLoading: false,
      demandSaving: false,
      demandError: "",
      executionLoading: false,
      materialRequisitions: [],
      productionBatches: [],
      productionRecords: [],
      fermentationTanks: [],
      productionAnomalies: [],
      productionPlans: [],
      packagingOrders: [],
      factories: [],
      recipes: [],
      equipment: [],
      planTanks: [],
      showDemandForm: false,
      showPlanForm: false,
      planSaving: false,
      demandDraft: { customer_id: "", product_tmpl_id: "", package_qty: 1, requested_volume_l: "", requested_delivery_date: "", customer_reference: "" },
      planDraft: { factory_id: "", recipe_version_id: "", equipment_id: "", tank_id: "", planned_volume_l: "", planned_start: "", planned_end: "" }
    };
  },
  computed: {
    tabs() {
      const result = [{ id: "requests", label: "产品需求" }];
      if (this.canReadPlans) result.push({ id: "plans", label: "生产计划" });
      if (this.canExecuteProduction) {
        result.push({ id: "mash", label: "糖化执行" });
        result.push({ id: "fermentation", label: "发酵执行" });
        result.push({ id: "package", label: "包装放行" });
      }
      return result;
    },
    requestColumns() {
      return requestColumns;
    },
    planColumns() {
      return planColumns;
    },
    canCreateDemand() {
      return this.permissions.includes("demand.product.manage_own");
    },
    canReadPlans() {
      return this.permissions.some(item => ["plan.production.read", "plan.production.manage", "plan.production.approve"].includes(item));
    },
    canManagePlans() {
      return this.permissions.includes("plan.production.manage");
    },
    canExecuteProduction() {
      return this.permissions.some(item => ["production.record.create", "production.record.approve", "plan.production.manage"].includes(item));
    },
    activeRecipes() {
      return this.recipes.filter(item => item.active && item.active_version_id);
    },
    filteredEquipment() {
      return this.equipment.filter(item => String(item.brew_factory_id?.id || "") === String(this.planDraft.factory_id));
    },
    filteredPlanTanks() {
      return this.planTanks.filter(item => String(item.factory_id?.id || "") === String(this.planDraft.factory_id));
    },
    demandRows() {
      return this.demands.map(item => ({
        id: item.name,
        product: item.product?.name || "-",
        package: item.packaging?.name || "未指定",
        qty: item.package_qty,
        liquid: item.requested_volume_l,
        customer: item.customer?.name || "-",
        date: item.requested_delivery_date,
        state: ({ draft: "草稿", submitted: "待确认", confirmed: "已确认", returned: "已退回", planned: "已排产", cancelled: "已取消" })[item.state] || item.state
      }));
    },
    materialRows() {
      return this.materialRequisitions.map(item => ({
        name: item.name,
        plan: item.plan?.name || "-",
        factory: item.factory?.name || "-",
        items: item.lines?.length || 0,
        state: ({ draft: "草稿", overage_pending: "超领待审批", recommended: "已推荐", issued: "已发料", acknowledged: "已确认实领", completed: "已完成" })[item.state] || item.state
      }));
    },
    batchRows() {
      return this.productionBatches.map(item => ({
        name: item.name,
        plan: item.plan?.name || "-",
        product: item.product?.name || "-",
        tank: item.tank?.name || "-",
        volume: `${item.actual_volume_l || item.planned_volume_l} L`,
        state: ({ draft: "草稿", in_progress: "生产中", in_tank: "已进罐", completed: "已完成" })[item.state] || item.state
      }));
    },
    recordRows() {
      return this.productionRecords.map(item => ({
        name: item.name,
        batch: item.batch_name,
        type: ({ cleaning: "清洗", mashing: "糖化", lautering: "过滤", boiling: "煮沸", cooling: "冷却", yeast: "添加酵母", other: "其他" })[item.record_type] || item.record_type,
        operator: item.operator?.name || "-",
        recordedAt: item.recorded_at?.replace("T", " ").slice(0, 16),
        state: ({ draft: "草稿", submitted: "待审核", approved: "已审核", returned: "已退回", superseded: "已更正" })[item.state] || item.state
      }));
    },
    fermentationRows() {
      return this.fermentationTanks.map(item => ({
        name: item.name,
        factory: item.factory?.name || "-",
        batch: item.current_batch_no || "-",
        status: ({ empty: "空罐", fermenting: "发酵中", cold_crash: "降温中", conditioning: "冷贮中", ready: "待包装", abnormal: "异常" })[item.status] || item.status,
        temperature: `${Number(item.current_temperature || 0).toFixed(1)} ℃`,
        pressure: `${Number(item.current_pressure || 0).toFixed(2)} bar`,
        gravity: `${Number(item.current_gravity || 0).toFixed(2)} °P`,
        anomalies: item.open_anomaly_count
      }));
    },
    anomalyRows() {
      return this.productionAnomalies.map(item => ({
        name: item.name,
        tank: item.tank?.name || "-",
        type: ({ temperature_low: "温度过低", temperature_high: "温度过高", pressure_high: "压力过高", gravity_stalled: "糖度停滞", reading_missing: "读数漏填", session_overdue: "发酵超期", manual: "人工异常" })[item.anomaly_type] || item.anomaly_type,
        severity: ({ low: "低", medium: "中", high: "高", critical: "严重" })[item.severity] || item.severity,
        occurrences: item.occurrence_count,
        state: ({ open: "待处理", assigned: "已指派", resolved: "待复核", closed: "已关闭" })[item.state] || item.state
      }));
    },
    planRows() {
      return this.productionPlans.map(item => ({
        id: item.name,
        type: "生产",
        product: item.product?.name || "-",
        volume: item.planned_volume_l,
        recipe: item.recipe_version?.name || "-",
        date: item.planned_start?.replace("T", " ").slice(0, 16),
        factory: item.factory?.name || "-",
        device: item.equipment?.name || "-",
        tank: item.tank?.name || "-",
        owner: item.owner?.name || "-",
        state: ({ draft: "草稿", submitted: "待审批", approved: "已批准", dispatched: "已下发", in_progress: "执行中", done: "已完成", cancelled: "已取消", terminated: "已终止" })[item.state] || item.state
      }));
    },
    packagingRows() {
      return this.packagingOrders.map(item => ({
        name: item.name,
        factory: item.factory?.name || "-",
        batch: item.batch?.name || "-",
        product: item.product?.name || "-",
        specification: item.packaging?.name || "-",
        volume: `${Number(item.output_volume_l || item.planned_volume_l || 0).toFixed(1)} L`,
        quantity: Number(item.output_qty || 0).toFixed(0),
        codes: item.code_count || 0,
        state: ({ draft: "草稿", in_progress: "包装中", pending_release: "待放行", released: "已放行", cancelled: "已取消" })[item.state] || item.state
      }));
    }
  },
  mounted() {
    this.loadDemands();
    this.loadExecution();
  },
  methods: {
    async loadDemands() {
      this.demandLoading = true;
      this.demandError = "";
      try {
        const [demands, customers, products] = await Promise.all([
          brewApi.listDemands({ page_size: 100 }),
          brewApi.listMaster("customers", { page_size: 100, active: true }),
          brewApi.listMaster("products", { page_size: 100, active: true })
        ]);
        this.demands = demands;
        this.customers = customers;
        this.products = products;
      } catch (cause) {
        this.demandError = cause.message || "产品需求加载失败。";
      } finally {
        this.demandLoading = false;
      }
    },
    async loadExecution() {
      this.executionLoading = true;
      this.demandError = "";
      try {
        const requests = [];
        if (this.canReadPlans) requests.push(["productionPlans", brewApi.listProductionPlans({ page_size: 100 })]);
        if (this.canExecuteProduction) {
          requests.push(
            ["materialRequisitions", brewApi.listMaterialRequisitions({ page_size: 100 })],
            ["productionBatches", brewApi.listProductionBatches({ page_size: 100 })],
            ["productionRecords", brewApi.listProductionRecords({ page_size: 100 })],
            ["fermentationTanks", brewApi.listTanks({ page_size: 100 })],
            ["productionAnomalies", brewApi.listProductionAnomalies({ page_size: 100, state: "open" })],
            ["packagingOrders", brewApi.listPackagingOrders({ page_size: 100 })]
          );
        }
        if (this.canManagePlans) {
          requests.push(
            ["factories", brewApi.listMaster("factories", { page_size: 100, active: true })],
            ["recipes", brewApi.listRecipes({ page_size: 100, active: true })],
            ["equipment", brewApi.listMaster("equipment", { page_size: 100, active: true })],
            ["planTanks", brewApi.listMaster("tanks", { page_size: 100, active: true })]
          );
        }
        const results = await Promise.allSettled(requests.map(([, promise]) => promise));
        const errors = [];
        results.forEach((result, index) => {
          const name = requests[index][0];
          if (result.status === "fulfilled") this[name] = result.value;
          else errors.push(result.reason?.message || `${name} 加载失败`);
        });
        if (errors.length) this.demandError = errors.join("；");
      } catch (cause) {
        this.demandError = cause.message || "生产执行数据加载失败。";
      } finally {
        this.executionLoading = false;
      }
    },
    openRequest() {
      this.showDemandForm = true;
      this.demandError = "";
    },
    async submitDemand() {
      this.demandSaving = true;
      this.demandError = "";
      try {
        await brewApi.createDemand({
          ...this.demandDraft,
          customer_id: Number(this.demandDraft.customer_id),
          product_tmpl_id: Number(this.demandDraft.product_tmpl_id),
          package_qty: Number(this.demandDraft.package_qty),
          requested_volume_l: Number(this.demandDraft.requested_volume_l)
        });
        this.showDemandForm = false;
        this.demandDraft = { customer_id: "", product_tmpl_id: "", package_qty: 1, requested_volume_l: "", requested_delivery_date: "", customer_reference: "" };
        await this.loadDemands();
      } catch (cause) {
        this.demandError = cause.message || "产品需求保存失败。";
      } finally {
        this.demandSaving = false;
      }
    },
    openPlan() {
      this.showPlanForm = true;
      this.demandError = "";
    },
    async submitPlan() {
      this.planSaving = true;
      this.demandError = "";
      try {
        await brewApi.createProductionPlan({
          factory_id: Number(this.planDraft.factory_id),
          recipe_version_id: Number(this.planDraft.recipe_version_id),
          equipment_id: Number(this.planDraft.equipment_id),
          tank_id: Number(this.planDraft.tank_id),
          planned_volume_l: Number(this.planDraft.planned_volume_l),
          planned_start: this.planDraft.planned_start,
          planned_end: this.planDraft.planned_end
        });
        this.showPlanForm = false;
        this.planDraft = { factory_id: "", recipe_version_id: "", equipment_id: "", tank_id: "", planned_volume_l: "", planned_start: "", planned_end: "" };
        await this.loadExecution();
      } catch (cause) {
        this.demandError = cause.message || "生产计划保存失败。";
      } finally {
        this.planSaving = false;
      }
    }
  },
  template: `
    <Tabs v-model="tab" :tabs="tabs" />
    <div v-if="tab === 'requests'" class="panel">
      <div class="panel-header"><div class="panel-title">产品需求</div><div class="master-actions"><button class="btn btn-sm btn-secondary" @click="loadDemands">刷新</button><button v-if="canCreateDemand" class="btn btn-sm btn-primary" @click="openRequest">新建需求</button></div></div>
      <div v-if="demandError" class="master-error">{{ demandError }}</div>
      <form v-if="showDemandForm" class="master-form" @submit.prevent="submitDemand">
        <label><span>客户</span><select v-model="demandDraft.customer_id" required><option value="">请选择</option><option v-for="item in customers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label><span>产品</span><select v-model="demandDraft.product_tmpl_id" required><option value="">请选择</option><option v-for="item in products" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label><span>包装数量</span><input v-model="demandDraft.package_qty" type="number" min="0.001" step="0.001" required></label>
        <label><span>酒液需求(L)</span><input v-model="demandDraft.requested_volume_l" type="number" min="0.001" step="0.001" required></label>
        <label><span>要求交付日期</span><input v-model="demandDraft.requested_delivery_date" type="date" required></label>
        <label><span>客户参考号</span><input v-model.trim="demandDraft.customer_reference"></label>
        <div class="master-form-actions"><button class="btn btn-sm btn-secondary" type="button" @click="showDemandForm = false">取消</button><button class="btn btn-sm btn-primary" :disabled="demandSaving">{{ demandSaving ? '保存中...' : '保存' }}</button></div>
      </form>
      <div v-if="demandLoading" class="panel-body empty">正在加载...</div>
      <div v-else class="panel-body no-padding"><DataTable :columns="requestColumns" :rows="demandRows" /></div>
    </div>
    <div v-else-if="tab === 'plans'" class="panel">
      <div class="panel-header"><div class="panel-title">生产计划</div><div class="master-actions"><button class="btn btn-sm btn-secondary" @click="loadExecution">刷新</button><button v-if="canManagePlans" class="btn btn-sm btn-primary" @click="openPlan">新建计划</button></div></div>
      <form v-if="showPlanForm" class="master-form" @submit.prevent="submitPlan">
        <label><span>厂区</span><select v-model="planDraft.factory_id" required><option value="">请选择</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label><span>生效配方</span><select v-model="planDraft.recipe_version_id" required><option value="">请选择</option><option v-for="item in activeRecipes" :key="item.active_version_id" :value="item.active_version_id">{{ item.code }} · {{ item.name }}</option></select></label>
        <label><span>生产设备</span><select v-model="planDraft.equipment_id" required><option value="">请选择</option><option v-for="item in filteredEquipment" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label><span>目标罐</span><select v-model="planDraft.tank_id" required><option value="">请选择</option><option v-for="item in filteredPlanTanks" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label><span>计划体积(L)</span><input v-model="planDraft.planned_volume_l" type="number" min="0.001" step="0.001" required></label>
        <label><span>计划开始</span><input v-model="planDraft.planned_start" type="datetime-local" required></label>
        <label><span>计划结束</span><input v-model="planDraft.planned_end" type="datetime-local" required></label>
        <div class="master-form-actions"><button class="btn btn-sm btn-secondary" type="button" @click="showPlanForm = false">取消</button><button class="btn btn-sm btn-primary" :disabled="planSaving">{{ planSaving ? '保存中...' : '保存计划' }}</button></div>
      </form>
      <div class="panel-body no-padding"><DataTable :columns="planColumns" :rows="planRows" /></div>
    </div>
    <div v-else-if="tab === 'mash'" class="procurement-grid">
      <div class="panel"><div class="panel-header"><div class="panel-title">领料与退料</div><button class="btn btn-sm btn-secondary" @click="loadExecution">刷新</button></div><div class="panel-body no-padding"><DataTable :columns="[{key:'name',label:'领料单'},{key:'plan',label:'生产计划'},{key:'factory',label:'厂区'},{key:'items',label:'物料项'},{key:'state',label:'状态',type:'status'}]" :rows="materialRows" /></div></div>
      <div class="panel"><div class="panel-header"><div class="panel-title">生产批次</div></div><div class="panel-body no-padding"><DataTable :columns="[{key:'name',label:'批次'},{key:'plan',label:'生产计划'},{key:'product',label:'产品'},{key:'tank',label:'目标罐'},{key:'volume',label:'体积'},{key:'state',label:'状态',type:'status'}]" :rows="batchRows" /></div></div>
      <div class="panel"><div class="panel-header"><div class="panel-title">现场生产记录</div></div><div class="panel-body no-padding"><DataTable :columns="[{key:'name',label:'记录号'},{key:'batch',label:'生产批次'},{key:'type',label:'工序'},{key:'operator',label:'操作人'},{key:'recordedAt',label:'记录时间'},{key:'state',label:'状态',type:'status'}]" :rows="recordRows" /></div></div>
    </div>
    <div v-else-if="tab === 'fermentation'" class="procurement-grid">
      <div class="panel"><div class="panel-header"><div class="panel-title">发酵罐状态</div><button class="btn btn-sm btn-secondary" @click="loadExecution">刷新</button></div><div class="panel-body no-padding"><DataTable :columns="[{key:'name',label:'罐号'},{key:'factory',label:'厂区'},{key:'batch',label:'批次'},{key:'status',label:'状态',type:'status'},{key:'temperature',label:'温度'},{key:'pressure',label:'压力'},{key:'gravity',label:'糖度'},{key:'anomalies',label:'未关闭异常'}]" :rows="fermentationRows" /></div></div>
      <div class="panel"><div class="panel-header"><div class="panel-title">发酵异常</div></div><div class="panel-body no-padding"><DataTable :columns="[{key:'name',label:'异常号'},{key:'tank',label:'罐号'},{key:'type',label:'异常类型'},{key:'severity',label:'等级',type:'status'},{key:'occurrences',label:'命中次数'},{key:'state',label:'状态',type:'status'}]" :rows="anomalyRows" /></div></div>
    </div>
    <div v-else class="panel"><div class="panel-header"><div><div class="panel-title">包装与放行</div><div class="panel-subtitle">包装放行必须确认，批次码、桶码和箱码由后端统一生成</div></div><button class="btn btn-sm btn-secondary" @click="loadExecution">刷新</button></div><div class="panel-body no-padding"><DataTable :columns="[{key:'name',label:'包装单'},{key:'factory',label:'厂区'},{key:'batch',label:'生产批次'},{key:'product',label:'产品'},{key:'specification',label:'包装规格'},{key:'volume',label:'产出体积'},{key:'quantity',label:'包装数量'},{key:'codes',label:'追溯码数'},{key:'state',label:'状态',tag:true}]" :rows="packagingRows" /></div></div>
  `
});

const RecipePage = defineComponent({
  components: { DataTable },
  props: { permissions: { type: Array, default: () => [] } },
  setup(props) {
    const recipes = ref([]);
    const products = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const creating = ref(false);
    const error = ref("");
    const draft = ref({ code: "", name: "", product_tmpl_id: "", beer_style: "" });
    const canManage = computed(() => props.permissions.includes("recipe.version.manage"));
    const columns = [
      { key: "code", label: "配方编码", mono: true },
      { key: "name", label: "配方名称" },
      { key: "product", label: "成品", format: row => row.product?.name || "-" },
      { key: "beer_style", label: "啤酒风格", format: row => row.beer_style || "-" },
      { key: "active_version_id", label: "启用版本", format: row => row.active_version_id || "未启用" },
      { key: "state", label: "状态", tag: true }
    ];

    async function load() {
      loading.value = true;
      error.value = "";
      try {
        const [recipeRows, productRows] = await Promise.all([
          brewApi.listRecipes({ page_size: 100 }),
          brewApi.listMaster("products", { page_size: 100, active: true })
        ]);
        recipes.value = recipeRows.map(item => ({ ...item, state: item.active ? (item.active_version_id ? "使用中" : "待启用") : "已归档" }));
        products.value = productRows;
      } catch (cause) {
        error.value = cause.message || "配方加载失败。";
      } finally {
        loading.value = false;
      }
    }

    async function submit() {
      saving.value = true;
      error.value = "";
      try {
        await brewApi.createRecipe({ ...draft.value, product_tmpl_id: Number(draft.value.product_tmpl_id) });
        draft.value = { code: "", name: "", product_tmpl_id: "", beer_style: "" };
        creating.value = false;
        await load();
      } catch (cause) {
        error.value = cause.message || "配方保存失败。";
      } finally {
        saving.value = false;
      }
    }

    onMounted(load);
    return { recipes, products, loading, saving, creating, error, draft, canManage, columns, load, submit };
  },
  template: `
    <div class="panel">
      <div class="panel-header">
        <div><div class="panel-title">配方版本库</div><div class="panel-subtitle">生产计划只能引用已启用的具体版本</div></div>
        <div class="master-actions"><button class="btn btn-sm btn-secondary" @click="load">刷新</button><button v-if="canManage" class="btn btn-sm btn-primary" @click="creating = true">新建配方</button></div>
      </div>
      <div v-if="error" class="master-error">{{ error }}</div>
      <form v-if="creating" class="master-form" @submit.prevent="submit">
        <label><span>配方编码</span><input v-model.trim="draft.code" required></label>
        <label><span>配方名称</span><input v-model.trim="draft.name" required></label>
        <label><span>关联成品</span><select v-model="draft.product_tmpl_id" required><option value="">请选择</option><option v-for="item in products" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label><span>啤酒风格</span><input v-model.trim="draft.beer_style"></label>
        <div class="master-form-actions"><button class="btn btn-sm btn-secondary" type="button" @click="creating = false">取消</button><button class="btn btn-sm btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button></div>
      </form>
      <div v-if="loading" class="panel-body empty">正在加载...</div>
      <div v-else class="panel-body no-padding"><DataTable :columns="columns" :rows="recipes" /></div>
    </div>
  `
});

const InventoryPage = defineComponent({
  components: { Tabs, DataTable },
  emits: ["toast"],
  setup() {
    const tab = ref("stock");
    const loading = ref(false);
    const error = ref("");
    const summary = ref({
      totals: { on_hand: 0, reserved: 0, available: 0, pending_quality: 0, incoming: 0, frozen: 0 },
      categories: []
    });
    const lots = ref([]);
    const movements = ref([]);
    const reservations = ref([]);
    const requisitions = ref([]);
    const orders = ref([]);
    const receipts = ref([]);
    const inspections = ref([]);
    const lotColumns = [
      { key: "name", label: "批次" },
      { key: "product", label: "产品/物料" },
      { key: "expiration", label: "效期" },
      { key: "quality", label: "质量状态", type: "status" },
      { key: "onHand", label: "账面库存" },
      { key: "reserved", label: "预占" },
      { key: "available", label: "可用" },
      { key: "frozen", label: "冻结状态", type: "status" }
    ];
    const movementColumns = [
      { key: "date", label: "发生时间" },
      { key: "product", label: "产品/物料" },
      { key: "lot", label: "批次" },
      { key: "route", label: "移动" },
      { key: "quantity", label: "数量" },
      { key: "source", label: "来源单据" }
    ];
    const reservationColumns = [
      { key: "product", label: "产品/物料" },
      { key: "lot", label: "批次" },
      { key: "location", label: "库位" },
      { key: "quantity", label: "预占数量" },
      { key: "source", label: "来源" },
      { key: "state", label: "状态", type: "status" }
    ];
    const requisitionColumns = [
      { key: "name", label: "需求单号" },
      { key: "factory", label: "厂区" },
      { key: "needDate", label: "需求日期" },
      { key: "items", label: "物料项" },
      { key: "state", label: "状态", type: "status" }
    ];
    const orderColumns = [
      { key: "name", label: "采购订单" },
      { key: "supplier", label: "供应商" },
      { key: "amount", label: "订单金额" },
      { key: "approval", label: "审批", type: "status" },
      { key: "state", label: "订单状态", type: "status" }
    ];
    const receiptColumns = [
      { key: "name", label: "收货单" },
      { key: "order", label: "采购订单" },
      { key: "location", label: "待检库位" },
      { key: "items", label: "批次数" },
      { key: "state", label: "状态", type: "status" }
    ];
    const inspectionColumns = [
      { key: "name", label: "质检单" },
      { key: "receipt", label: "收货单" },
      { key: "qualified", label: "合格数量" },
      { key: "rejected", label: "不合格数量" },
      { key: "state", label: "状态", type: "status" }
    ];
    const lotRows = computed(() => lots.value.map((item) => ({
      name: item.name,
      product: item.product?.name || "-",
      expiration: item.expiration_date || "未设置",
      quality: ({ pending: "待检", qualified: "合格", rejected: "不合格" })[item.quality_status] || item.quality_status,
      onHand: `${item.on_hand} ${item.uom}`,
      reserved: `${item.reserved} ${item.uom}`,
      available: `${item.available} ${item.uom}`,
      frozen: item.frozen ? "已冻结" : "正常"
    })));
    const movementRows = computed(() => movements.value.map((item) => ({
      date: item.date ? item.date.replace("T", " ").slice(0, 19) : "-",
      product: item.product?.name || "-",
      lot: item.lot?.name || "-",
      route: `${item.source_location} → ${item.destination_location}`,
      quantity: `${item.quantity} ${item.uom}`,
      source: item.source?.reference || "-"
    })));
    const reservationRows = computed(() => reservations.value.map((item) => ({
      product: item.product?.name || "-",
      lot: item.lot?.name || "-",
      location: item.location?.name || "-",
      quantity: `${item.quantity} ${item.uom}`,
      source: `${item.source_model} #${item.source_id}`,
      state: ({ active: "有效", consumed: "已耗用", released: "已释放", cancelled: "已取消" })[item.state] || item.state
    })));
    const requisitionRows = computed(() => requisitions.value.map((item) => ({
      name: item.name,
      factory: item.factory?.name || "-",
      needDate: item.need_date,
      items: item.lines?.length || 0,
      state: ({ draft: "草稿", submitted: "待审批", approved: "已批准", returned: "已退回", ordered: "已转订单", closed: "已关闭" })[item.state] || item.state
    })));
    const orderRows = computed(() => orders.value.map((item) => ({
      name: item.name,
      supplier: item.supplier?.name || "-",
      amount: `${Number(item.amount_total || 0).toFixed(2)} ${item.currency || ""}`,
      approval: ({ none: "未提交", pending: "待审批", approved: "已批准", returned: "已退回" })[item.approval_state] || item.approval_state,
      state: ({ draft: "询价中", sent: "已发送", purchase: "已下单", done: "已关闭", cancel: "已取消" })[item.state] || item.state
    })));
    const receiptRows = computed(() => receipts.value.map((item) => ({
      name: item.name,
      order: item.purchase_order?.name || "-",
      location: item.qc_location?.name || "-",
      items: item.lines?.length || 0,
      state: ({ draft: "草稿", pending_approval: "超收待审批", arrived: "已到货待检", inspected: "已质检", done: "已入库" })[item.state] || item.state
    })));
    const inspectionRows = computed(() => inspections.value.map((item) => ({
      name: item.name,
      receipt: item.receipt_name,
      qualified: (item.lines || []).reduce((total, line) => total + Number(line.qualified_qty || 0), 0).toFixed(3),
      rejected: (item.lines || []).reduce((total, line) => total + Number(line.rejected_qty || 0), 0).toFixed(3),
      state: item.state === "completed" ? "已完成" : "待检"
    })));
    const metrics = computed(() => [
      { label: "账面库存", value: summary.value.totals.on_hand },
      { label: "可用库存", value: summary.value.totals.available },
      { label: "业务预占", value: summary.value.totals.reserved },
      { label: "待检库存", value: summary.value.totals.pending_quality },
      { label: "在途库存", value: summary.value.totals.incoming },
      { label: "冻结库存", value: summary.value.totals.frozen }
    ]);
    async function load() {
      loading.value = true;
      error.value = "";
      try {
        const [
          summaryData, lotData, movementData, reservationData,
          requisitionData, orderData, receiptData, inspectionData
        ] = await Promise.all([
          brewApi.getInventorySummary(),
          brewApi.listInventoryLots({ page_size: 100 }),
          brewApi.listInventoryMovements({ page_size: 100 }),
          brewApi.listInventoryReservations({ page_size: 100, state: "active" }),
          brewApi.listPurchaseRequisitions({ page_size: 100 }),
          brewApi.listPurchaseOrders({ page_size: 100 }),
          brewApi.listReceipts({ page_size: 100 }),
          brewApi.listQualityInspections({ page_size: 100 })
        ]);
        summary.value = summaryData;
        lots.value = lotData;
        movements.value = movementData;
        reservations.value = reservationData;
        requisitions.value = requisitionData;
        orders.value = orderData;
        receipts.value = receiptData;
        inspections.value = inspectionData;
      } catch (cause) {
        error.value = cause.message || "库存数据加载失败。";
      } finally {
        loading.value = false;
      }
    }
    onMounted(load);
    return {
      tab, loading, error, metrics, lotColumns, movementColumns, reservationColumns,
      requisitionColumns, orderColumns, receiptColumns, inspectionColumns,
      lotRows, movementRows, reservationRows, requisitionRows, orderRows, receiptRows,
      inspectionRows, load
    };
  },
  template: `
    <div class="metric-strip inventory-metrics">
      <div v-for="item in metrics" :key="item.label" class="metric-cell">
        <span class="metric-label">{{ item.label }}</span>
        <strong class="metric-number">{{ Number(item.value || 0).toFixed(3) }}</strong>
      </div>
    </div>
    <div v-if="error" class="master-error">{{ error }}</div>
    <Tabs v-model="tab" :tabs="[{id:'stock',label:'批次库存'},{id:'movements',label:'库存流水'},{id:'reservations',label:'有效预占'},{id:'procurement',label:'采购与质检'}]" />
    <div v-if="tab !== 'procurement'" class="panel">
      <div class="panel-header">
        <div><div class="panel-title">{{ tab === 'stock' ? '批次库存' : tab === 'movements' ? '库存流水' : '库存预占' }}</div><div class="panel-subtitle">库存口径来自标准移动与批次预占，不允许直接修改余额</div></div>
        <button class="btn btn-sm btn-secondary" type="button" :disabled="loading" @click="load">{{ loading ? '加载中...' : '刷新' }}</button>
      </div>
      <div v-if="loading" class="panel-body empty">正在加载...</div>
      <div v-else-if="tab === 'stock'" class="panel-body no-padding"><DataTable :columns="lotColumns" :rows="lotRows" /></div>
      <div v-else-if="tab === 'movements'" class="panel-body no-padding"><DataTable :columns="movementColumns" :rows="movementRows" /></div>
      <div v-else class="panel-body no-padding"><DataTable :columns="reservationColumns" :rows="reservationRows" /></div>
    </div>
    <div v-else class="procurement-grid">
      <div class="panel"><div class="panel-header"><div class="panel-title">采购需求</div></div><div class="panel-body no-padding"><DataTable :columns="requisitionColumns" :rows="requisitionRows" /></div></div>
      <div class="panel"><div class="panel-header"><div class="panel-title">采购订单</div></div><div class="panel-body no-padding"><DataTable :columns="orderColumns" :rows="orderRows" /></div></div>
      <div class="panel"><div class="panel-header"><div class="panel-title">分批收货</div></div><div class="panel-body no-padding"><DataTable :columns="receiptColumns" :rows="receiptRows" /></div></div>
      <div class="panel"><div class="panel-header"><div class="panel-title">来料质检</div></div><div class="panel-body no-padding"><DataTable :columns="inspectionColumns" :rows="inspectionRows" /></div></div>
    </div>
  `
});

const TracePage = defineComponent({
  template: `
    <div class="trace-layout">
      <div class="panel">
        <div class="panel-header"><div><div class="panel-title">成品追溯码</div><div class="panel-subtitle">支持批次码、桶码和箱码</div></div></div>
        <div class="panel-body">
          <form class="trace-search" @submit.prevent="search">
            <input v-model.trim="query" class="search" placeholder="输入批次码、桶码或箱码" required>
            <button class="btn btn-primary" type="submit" :disabled="loading">{{ loading ? '查询中...' : '查询' }}</button>
          </form>
          <div v-if="error" class="master-error">{{ error }}</div>
          <div v-if="result" class="task-list trace-info">
            <div class="barcode-box"><div class="fake-barcode"><span v-for="(width, index) in bars" :key="index" :style="{ width: width + 'px' }"></span></div><div class="mono">{{ result.code.code }}</div></div>
            <div class="tank-line"><span>产品</span><strong>{{ result.code.product.name }}</strong></div>
            <div class="tank-line"><span>成品批次</span><strong>{{ result.code.lot.name }}</strong></div>
            <div class="tank-line"><span>包装单</span><strong>{{ result.packaging.name }}</strong></div>
            <div class="tank-line"><span>物流单号</span><strong>{{ result.outbound?.logistics_no || '尚未出库' }}</strong></div>
            <div class="tank-line"><span>客户</span><strong>{{ result.outbound?.customer?.name || '-' }}</strong></div>
          </div>
          <div v-else-if="!loading" class="empty">输入码值查看完整批次链路</div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><div class="panel-title">批次追溯链路</div><div class="panel-subtitle">出库、包装、发酵、生产和原料批次</div></div></div>
        <div class="panel-body"><div class="timeline">
          <div v-for="item in timeline" :key="item.title" class="timeline-item"><div class="timeline-time">{{ item.time }}</div><div class="timeline-title">{{ item.title }}</div><div class="timeline-desc">{{ item.desc }}</div></div>
          <div v-if="!timeline.length" class="empty">暂无已加载的追溯链路</div>
        </div></div>
      </div>
    </div>
  `,
  data() {
    return { query: "", result: null, error: "", loading: false, bars: [2,4,3,5,2,6,3,4,2,5,3,6,2,4,3,5] };
  },
  computed: {
    timeline() {
      if (!this.result) return [];
      const data = this.result;
      const items = [];
      if (data.outbound) items.push({ time: data.outbound.shipped_at || '-', title: '销售出库', desc: `${data.outbound.customer.name} · ${data.outbound.logistics_provider || '人工物流'} · ${data.outbound.logistics_no || '-'}` });
      items.push({ time: data.packaging.released_at || '-', title: '包装放行', desc: `${data.packaging.name} · ${data.packaging.output_qty} ${data.packaging.packaging.name} · 成品批次 ${data.code.lot.name}` });
      items.push({ time: '-', title: '生产批次', desc: `${data.production.batch_no} · 计划 ${data.production.plan_no} · 配方版本 #${data.production.recipe_version_id}` });
      for (const material of data.materials) items.push({ time: '-', title: `原料批次 ${material.lot}`, desc: `${material.product} · ${material.quantity} ${material.uom} · ${material.supplier?.name || '供应商未知'} · ${material.purchase_order?.name || '无采购单'}` });
      return items;
    }
  },
  methods: {
    async search() {
      this.loading = true; this.error = "";
      try { this.result = await brewApi.getTrace(this.query); }
      catch (error) { this.result = null; this.error = error.message || "追溯查询失败"; }
      finally { this.loading = false; }
    }
  }
});

const ReportsPage = defineComponent({
  components: { StatCard, StatusTag },
  template: `
    <div v-if="error" class="master-error">{{ error }}</div>
    <div class="stats-grid">
      <StatCard label="已放行批次" :value="summary.production.released_batches" :change="summary.production.output_volume_l.toFixed(1) + ' L 成品'" tone="up" />
      <StatCard label="估算成本" :value="summary.production.estimated_cost.toFixed(2)" change="不含付款与收款" tone="warn" />
      <StatCard label="采购金额" :value="summary.purchase.amount_total.toFixed(2)" :change="summary.purchase.orders + ' 个标准采购单'" tone="warn" />
      <StatCard label="已发运出库" :value="summary.outbound.orders" :change="summary.quality.open_anomalies + ' 项未关闭异常'" tone="up" />
    </div>
    <div class="panel">
      <div class="panel-header"><div><div class="panel-title">受控数据导出</div><div class="panel-subtitle">仅采购、入库、出库和库存流水，不包含付款与收款</div></div></div>
      <div class="panel-body"><div class="grid-3">
        <div v-for="item in exportTypes" :key="item.code" class="setting-card">
          <div class="task-title">{{ item.label }}</div><div class="task-desc">{{ item.desc }}</div>
          <button class="btn btn-xs btn-outline card-action" :disabled="creating" @click="createJob(item.code)">生成 CSV</button>
        </div>
      </div></div>
    </div>
    <div class="panel">
      <div class="panel-header"><div class="panel-title">导出任务</div><button class="btn btn-sm btn-secondary" @click="load">刷新</button></div>
      <div class="panel-body task-list">
        <div v-for="job in jobs" :key="job.id" class="task-card">
          <div><div class="task-title">{{ job.name }} · {{ typeLabel(job.export_type) }}</div><div class="task-desc">{{ job.row_count || 0 }} 行 · {{ job.completed_at || job.created_at || '-' }}<span v-if="job.error_message"> · {{ job.error_message }}</span></div></div>
          <a v-if="job.download_url" class="btn btn-xs btn-outline" :href="job.download_url">下载</a><StatusTag v-else :text="job.state" />
        </div>
        <div v-if="!jobs.length" class="empty">暂无导出任务</div>
      </div>
    </div>
  `,
  data() {
    return {
      summary: { production: { released_batches: 0, output_volume_l: 0, estimated_cost: 0 }, purchase: { orders: 0, amount_total: 0 }, outbound: { orders: 0 }, quality: { open_anomalies: 0 } },
      jobs: [], creating: false, error: "",
      exportTypes: [
        { code: "purchase", label: "采购导出", desc: "标准采购单、供应商、金额和状态" },
        { code: "inbound", label: "入库导出", desc: "受控入库移动、产品和批次" },
        { code: "outbound", label: "出库导出", desc: "受控出库移动、客户批次链路" },
        { code: "inventory", label: "库存流水", desc: "全部受控标准库存移动" }
      ]
    };
  },
  created() { this.load(); },
  methods: {
    typeLabel(code) { return this.exportTypes.find((item) => item.code === code)?.label || code; },
    async load() {
      this.error = "";
      try { [this.summary, this.jobs] = await Promise.all([brewApi.getReportSummary(), brewApi.listExports({ page_size: 50 })]); }
      catch (error) { this.error = error.message || "报表加载失败"; }
    },
    async createJob(exportType) {
      this.creating = true; this.error = "";
      try { await brewApi.createExport({ export_type: exportType, filters: {} }); await this.load(); }
      catch (error) { this.error = error.message || "导出任务创建失败"; }
      finally { this.creating = false; }
    }
  }
});

const SettingsPage = defineComponent({
  props: { permissions: { type: Array, default: () => [] } },
  template: `
    <div class="master-workspace">
      <aside class="master-nav">
        <button
          v-for="item in resources"
          :key="item.code"
          type="button"
          :class="['master-nav-item', { active: selected === item.code }]"
          @click="selectResource(item.code)"
        >{{ item.label }}</button>
      </aside>
      <div class="panel master-panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">{{ currentResource.label }}</div>
            <div class="panel-subtitle">{{ currentResource.desc }}</div>
          </div>
          <div class="master-actions">
            <button class="btn btn-sm btn-secondary" type="button" @click="load">刷新</button>
            <button v-if="canCreate" class="btn btn-sm btn-primary" type="button" @click="startCreate">新增</button>
          </div>
        </div>
        <div v-if="error" class="master-error">{{ error }}</div>
        <form v-if="creating" class="master-form" @submit.prevent="submitCreate">
          <label v-for="field in currentResource.fields" :key="field.key">
            <span>{{ field.label }}</span>
            <select v-if="field.type === 'select'" v-model="draft[field.key]" :required="field.required !== false">
              <option value="">请选择</option>
              <option v-for="option in optionsFor(field)" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <textarea v-else-if="field.type === 'textarea'" v-model="draft[field.key]" :required="field.required !== false"></textarea>
            <input v-else v-model="draft[field.key]" :type="field.type || 'text'" :required="field.required !== false">
          </label>
          <div class="master-form-actions">
            <button class="btn btn-sm btn-secondary" type="button" @click="creating = false">取消</button>
            <button class="btn btn-sm btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
        </form>
        <div class="panel-body master-list">
          <div v-if="loading" class="empty">正在加载...</div>
          <div v-else-if="!items.length" class="empty">暂无数据</div>
          <template v-else>
            <div v-for="item in items" :key="item.id" class="master-row">
              <div>
                <div class="task-title">{{ item.name }}</div>
                <div class="task-desc">{{ describe(item) }}</div>
              </div>
              <div class="master-actions">
                <button v-if="currentResource.rule && canCreate && item.state !== 'active'" class="btn btn-xs btn-outline" type="button" @click="changeRuleState(item, 'activate')">启用</button>
                <button v-if="currentResource.rule && canCreate && item.state === 'active'" class="btn btn-xs btn-secondary" type="button" @click="changeRuleState(item, 'deactivate')">停用</button>
                <span :class="['master-state', item.active === false || item.state === 'inactive' ? 'muted' : 'enabled']">
                  {{ item.state ? stateLabel(item.state) : (item.active === false ? '已归档' : '启用') }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const commonFields = [{ key: "name", label: "名称" }];
    const factoryField = { key: "brew_factory_id", label: "所属厂区", type: "select", options: "factories" };
    const resources = [
      { code: "factories", label: "厂区", desc: "企业内厂区、编码和地址", fields: [...commonFields, { key: "code", label: "厂区编码" }, { key: "address", label: "地址", required: false }] },
      { code: "equipment", label: "设备", desc: "生产设备容量与运行状态", fields: [...commonFields, factoryField, { key: "brew_equipment_type", label: "设备类型", type: "select", values: [["mash","糖化"],["fermentation","发酵"],["bright","清酒"],["packaging","包装"],["centrifuge","离心"],["cleaning","清洗"],["other","其他"]] }, { key: "brew_capacity_l", label: "容量(L)", type: "number" }] },
      { code: "tanks", label: "罐体", desc: "发酵罐、清酒罐和清洗状态", fields: [...commonFields, { ...factoryField, key: "factory_id" }, { key: "tank_type", label: "罐体类型", type: "select", values: [["fermentation","发酵罐"],["bright","清酒罐"]] }, { key: "capacity_l", label: "容量(L)", type: "number" }] },
      { code: "warehouses", label: "仓库", desc: "厂区创建时自动建立的标准仓库", readonly: true, fields: [] },
      { code: "locations", label: "库位", desc: "原料、包装、待检、半成品、成品和损耗库位", fields: [...commonFields, factoryField, { key: "brew_location_type", label: "库位类型", type: "select", values: [["raw_material","原料"],["packaging","包装"],["qc","待检"],["semi_finished","半成品"],["finished","成品"],["loss","损耗"]] }] },
      { code: "products", label: "产品", desc: "半成品和成品主数据", fields: [...commonFields, { key: "default_code", label: "产品编码" }, { key: "brew_item_type", label: "产品类型", type: "select", values: [["semi_finished","半成品"],["finished_product","成品"]] }, { key: "brew_specification", label: "规格", required: false }] },
      { code: "materials", label: "物料", desc: "原料与包装物标准主数据", fields: [...commonFields, { key: "default_code", label: "物料编码" }, { key: "brew_item_type", label: "物料类型", type: "select", values: [["raw_material","原料"],["packaging_material","包装物"]] }, { key: "brew_material_category", label: "原料分类", type: "select", values: [["malt","麦芽"],["hop","酒花"],["yeast","酵母"],["adjunct","辅料"],["packaging","包装物"]] }, { key: "brew_shelf_life_days", label: "保质期(天)", type: "number", required: false }] },
      { code: "suppliers", label: "供应商", desc: "供应商联系信息与供货品类", fields: [...commonFields, { key: "phone", label: "电话", required: false }, { key: "brew_supply_category", label: "供货品类", required: false }] },
      { code: "customers", label: "客户", desc: "客户联系信息与等级", fields: [...commonFields, { key: "phone", label: "电话", required: false }, { key: "brew_customer_level", label: "客户等级", type: "select", values: [["normal","普通"],["key","重点"],["vip","VIP"]] }] },
      { code: "number-rules", label: "编号规则", desc: "单据编号和批次编码版本", rule: true, fields: [...commonFields, { key: "code", label: "规则编码" }, { key: "config", label: "规则配置(JSON)", type: "textarea" }] },
      { code: "barcode-rules", label: "条码规则", desc: "批次码、桶码和箱码规则", rule: true, fields: [...commonFields, { key: "code", label: "规则编码" }, { key: "config", label: "规则配置(JSON)", type: "textarea" }] },
      { code: "alert-rules", label: "预警规则", desc: "库存、效期、任务和工艺参数阈值", rule: true, fields: [...commonFields, { key: "code", label: "规则编码" }, { key: "config", label: "规则配置(JSON)", type: "textarea" }] },
      { code: "approval-rules", label: "审批规则", desc: "采购、超领、超收等审批阈值与节点", rule: true, fields: [...commonFields, { key: "code", label: "规则编码" }, { key: "config", label: "规则配置(JSON)", type: "textarea" }] }
    ];
    const selected = ref("factories");
    const items = ref([]);
    const factories = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const creating = ref(false);
    const error = ref("");
    const draft = ref({});
    const currentResource = computed(() => resources.find(item => item.code === selected.value));
    const writePermissions = {
      factories: ["base.master_data.manage"],
      equipment: ["base.master_data.manage", "base.equipment.manage"],
      tanks: ["base.master_data.manage", "base.equipment.manage"],
      locations: ["base.master_data.manage", "base.location.manage"],
      products: ["base.master_data.manage", "base.product.manage"],
      materials: ["base.master_data.manage", "base.product.manage", "base.material.manage"],
      suppliers: ["base.master_data.manage", "base.supplier.manage"],
      customers: ["base.master_data.manage", "base.customer.manage"],
      "number-rules": ["base.master_data.manage"],
      "barcode-rules": ["base.master_data.manage"],
      "alert-rules": ["base.master_data.manage"],
      "approval-rules": ["base.master_data.manage", "admin.rule.manage"]
    };
    const canCreate = computed(() => {
      if (currentResource.value.readonly) return false;
      return (writePermissions[currentResource.value.code] || []).some(permission => props.permissions.includes(permission));
    });

    async function load() {
      loading.value = true;
      error.value = "";
      try {
        const current = currentResource.value;
        items.value = current.rule
          ? await brewApi.listRules(current.code)
          : await brewApi.listMaster(current.code, { page_size: 100 });
        if (current.code !== "factories" && !factories.value.length) {
          factories.value = await brewApi.listMaster("factories", { page_size: 100, active: true });
        }
      } catch (cause) {
        error.value = cause.message || "数据加载失败。";
      } finally {
        loading.value = false;
      }
    }

    function selectResource(code) {
      selected.value = code;
      creating.value = false;
      items.value = [];
      load();
    }

    function startCreate() {
      draft.value = currentResource.value.rule ? { config: "{}" } : {};
      creating.value = true;
      error.value = "";
    }

    function optionsFor(field) {
      if (field.options === "factories") return factories.value.map(item => ({ value: item.id, label: item.name }));
      return (field.values || []).map(([value, label]) => ({ value, label }));
    }

    async function submitCreate() {
      saving.value = true;
      error.value = "";
      try {
        const current = currentResource.value;
        const payload = { ...draft.value };
        current.fields.filter(field => field.type === "number").forEach((field) => {
          if (payload[field.key] !== undefined && payload[field.key] !== "") payload[field.key] = Number(payload[field.key]);
        });
        if (current.rule) {
          try { payload.config = JSON.parse(payload.config || "{}"); } catch { throw new Error("规则配置必须是有效的 JSON 对象。"); }
          await brewApi.createRule(current.code, payload);
        } else {
          await brewApi.createMaster(current.code, payload);
        }
        creating.value = false;
        await load();
      } catch (cause) {
        error.value = cause.message || "保存失败。";
      } finally {
        saving.value = false;
      }
    }

    async function changeRuleState(item, action) {
      saving.value = true;
      error.value = "";
      try {
        await brewApi.ruleAction(currentResource.value.code, item.id, action, item.record_version);
        await load();
      } catch (cause) {
        error.value = cause.message || "规则状态更新失败。";
      } finally {
        saving.value = false;
      }
    }

    function describe(item) {
      const parts = [item.code, item.default_code, item.brew_specification, item.address, item.phone, item.rule_kind && `版本 ${item.version}`, item.factory_id?.name, item.brew_factory_id?.name].filter(Boolean);
      return parts.join(" · ") || `ID ${item.id}`;
    }

    function stateLabel(state) {
      return { draft: "草稿", active: "生效", inactive: "停用" }[state] || state;
    };

    onMounted(load);
    return { resources, selected, items, loading, saving, creating, error, draft, currentResource, canCreate, load, selectResource, startCreate, optionsFor, submitCreate, changeRuleState, describe, stateLabel };
  }
});

const TasksPage = defineComponent({
  components: { StatCard, TaskCard },
  setup() {
    const tasks = ref([]);
    const loading = ref(false);
    const error = ref("");
    async function load() {
      loading.value = true;
      error.value = "";
      try { tasks.value = await brewApi.getTasks(); }
      catch (cause) { error.value = cause.message || "任务加载失败。"; }
      finally { loading.value = false; }
    }
    function stateLabel(state) { return ({ pending: "待领取", claimed: "已领取", in_progress: "进行中", done: "已完成", returned: "已退回", cancelled: "已取消" })[state] || state; }
    onMounted(load);
    return { tasks, loading, error, load, stateLabel };
  },
  template: `
    <div class="stats-grid">
      <StatCard label="待处理" :value="tasks.filter(t => ['pending','claimed','in_progress','returned'].includes(t.state)).length" change="当前账号可处理" tone="warn" />
      <StatCard label="紧急任务" :value="tasks.filter(t => t.priority === '2').length" change="按优先级统计" tone="down" />
      <StatCard label="已完成" :value="tasks.filter(t => t.state === 'done').length" change="当前查询范围" tone="up" />
      <StatCard label="全部任务" :value="tasks.length" change="角色与本人范围" tone="up" />
    </div>
    <div class="panel"><div class="panel-header"><div class="panel-title">我的待办</div><button class="btn btn-sm btn-secondary" @click="load">刷新</button></div><div class="panel-body task-list"><div v-if="loading" class="empty">正在加载...</div><div v-else-if="error" class="master-error">{{ error }}</div><TaskCard v-for="task in tasks" v-else :key="task.id" :title="task.name" :desc="[task.task_type, task.due_at, task.assignee?.name].filter(Boolean).join(' · ')" :state="stateLabel(task.state)" /><div v-if="!loading && !error && !tasks.length" class="empty">当前角色暂无待办</div></div></div>
  `
});

const requestColumns = [
  { key: "id", label: "需求号", mono: true },
  { key: "product", label: "产品" },
  { key: "package", label: "包装" },
  { key: "qty", label: "数量" },
  { key: "liquid", label: "酒液需求", format: (row) => `${row.liquid}L` },
  { key: "customer", label: "客户" },
  { key: "date", label: "要求日期" },
  { key: "state", label: "状态", tag: true }
];

const planColumns = [
  { key: "id", label: "计划号", mono: true },
  { key: "type", label: "类型" },
  { key: "product", label: "产品", format: (row) => row.product || "-" },
  { key: "volume", label: "体积", format: (row) => row.volume ? `${row.volume}L` : "-" },
  { key: "recipe", label: "工艺版本", mono: true, format: (row) => row.recipe || "-" },
  { key: "date", label: "日期" },
  { key: "factory", label: "厂区" },
  { key: "device", label: "设备" },
  { key: "tank", label: "罐号" },
  { key: "owner", label: "负责人" },
  { key: "state", label: "状态", tag: true }
];

const stockColumns = [
  { key: "location", label: "库位" },
  { key: "name", label: "物料" },
  { key: "batch", label: "批次", mono: true },
  { key: "qty", label: "账面" },
  { key: "reserved", label: "预占" },
  { key: "available", label: "可用", format: (row) => Number(row.qty - row.reserved).toFixed(1) },
  { key: "unit", label: "单位" },
  { key: "expire", label: "保质期" },
  { key: "status", label: "状态", tag: true }
];

const purchaseColumns = [
  { key: "id", label: "单号", mono: true },
  { key: "source", label: "来源计划", mono: true },
  { key: "material", label: "物料" },
  { key: "need", label: "需求量" },
  { key: "stock", label: "账面库存" },
  { key: "reserve", label: "本次预占" },
  { key: "shortage", label: "采购缺口" },
  { key: "supplier", label: "建议供应商" },
  { key: "state", label: "状态", tag: true }
];

const recipeColumns = [
  { key: "code", label: "工艺编号", mono: true },
  { key: "name", label: "产品" },
  { key: "style", label: "风格" },
  { key: "og", label: "OG", format: (row) => `${row.og}°P` },
  { key: "ibu", label: "IBU" },
  { key: "color", label: "色度", format: (row) => `${row.color} EBC` },
  { key: "abv", label: "酒精度" },
  { key: "state", label: "状态", tag: true },
  { key: "owner", label: "负责人" }
];
</script>
