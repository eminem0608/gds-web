<template>
  <main v-if="!authContext" class="login-shell">
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
        <!--
        <div v-if="createDesignTab === 'recipe'" class="recipe-select-design-panel"><div class="recipe-design-section"><div class="recipe-section-title">麦芽与可发酵物 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('fermentables')">＋ 添加原料</button></div><div v-for="(line,index) in designDraft.fermentables" :key="'select-f'+index" class="recipe-select-row"><button class="recipe-material-picker-button" type="button" @click="openSupplierPicker(line)">{{ line.name || '选择具体供应商麦芽/可发酵物' }}</button><input v-model.number="line.quantity" type="number" placeholder="数量(KG)"><input v-model.number="line.ratio" type="number" placeholder="比例(%)"><input v-model="line.notes" placeholder="备注"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('fermentables', index)">删除</button></div><div v-if="!designDraft.fermentables.length" class="recipe-create-empty">还没有添加原料，从系统分类和物料中选择</div></div><div class="recipe-design-section"><div class="recipe-section-title">啤酒花 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('hops')">＋ 添加酒花</button></div><div v-for="(line,index) in designDraft.hops" :key="'select-h'+index" class="recipe-select-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择系统物料</option><option v-for="item in designMaterials('hop')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model="line.time" placeholder="投放时间"><input v-model.number="line.bitterness" type="number" placeholder="苦味值"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('hops', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">酵母 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('yeast')">＋ 添加酵母</button></div><div v-for="(line,index) in designDraft.yeast" :key="'select-y'+index" class="recipe-select-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择系统物料</option><option v-for="item in designMaterials('yeast')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model.number="line.temperature" type="number" placeholder="发酵温度(℃)"><input v-model="line.flavor" placeholder="风味描述" readonly><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('yeast', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">理化指标</div><div class="recipe-metrics-grid"><label><span>酒精度(% vol)</span><input v-model.number="designDraft.metrics.abv" type="number" step="0.1"></label><label><span>色度(EBC)</span><input v-model.number="designDraft.metrics.color_ebc" type="number" step="0.1"></label><label><span>苦味值(IBU)</span><input v-model.number="designDraft.metrics.ibu" type="number" step="0.1"></label><label><span>原麦汁浓度(°P)</span><input v-model.number="designDraft.metrics.original_gravity" type="number" step="0.1"></label></div></div></div>
        <div v-if="createDesignTab === 'mash'" class="recipe-process-panel"><div class="recipe-process-heading"><strong>糖化工艺设计</strong><span>设置糖化、煮沸和洗糟的目标参数</span></div><div class="recipe-process-grid"><label><span>煮沸强度(%)</span><input v-model.number="designDraft.mash.boil_strength" type="number" step="0.1" placeholder="如 8.5"></label><label><span>水料比(L/KG)</span><input v-model.number="designDraft.mash.water_grain_ratio" type="number" step="0.1" placeholder="如 3.2"></label><label><span>煮沸时长(min)</span><input v-model.number="designDraft.mash.boil_time_min" type="number" placeholder="如 60"></label><label><span>洗糟次数</span><input v-model.number="designDraft.mash.sparge_count" type="number" placeholder="如 2"></label></div><div class="recipe-process-note"><span>工艺说明</span><textarea v-model.trim="designDraft.mash.notes" placeholder="记录糖化温度曲线、升温节点、洗糟终点等要求"></textarea></div></div>
        <div v-if="createDesignTab === 'fermentation'" class="recipe-process-panel"><div class="recipe-process-heading"><strong>发酵工艺设计</strong><span>设置主发酵和冷储的目标条件</span></div><div class="recipe-process-grid"><label><span>目标发酵温度(℃)</span><input v-model.number="designDraft.fermentation.target_temperature" type="number" step="0.1" placeholder="如 18"></label><label><span>目标发酵天数(day)</span><input v-model.number="designDraft.fermentation.target_days" type="number" step="0.5" placeholder="如 7"></label><label><span>冷储温度(℃)</span><input v-model.number="designDraft.fermentation.cold_storage_temperature" type="number" step="0.1" placeholder="如 2"></label></div><div class="recipe-process-note"><span>发酵要求</span><textarea v-model.trim="designDraft.fermentation.notes" placeholder="记录接种量、降温节点、压力控制和冷储要求"></textarea></div></div>
      -->
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
            <span v-if="item.id === 'recipe'" class="nav-icon nav-icon-svg" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z"/><path d="M14 3.75v4h4M8.5 12h7M8.5 15.5h5M8.5 8.5h2"/></svg></span>
            <span v-else class="nav-icon">{{ pageMeta[item.id].icon }}</span>
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
        <RecipePage v-else-if="currentPage === 'recipe'" :permissions="authContext.permissions" :review-version-id="pendingRecipeReviewId" @review-opened="pendingRecipeReviewId = ''" />
        <InventoryProcurementPage v-else-if="currentPage === 'inventory'" :permissions="authContext.permissions" @toast="showToast" />
        <TracePage v-else-if="currentPage === 'trace'" />
        <ReportsPage v-else-if="currentPage === 'reports'" />
        <SettingsPage v-else-if="currentPage === 'settings'" :permissions="authContext.permissions" />
        <div v-else-if="currentPage === 'supplier_catalog'"><div class="ferm-tabs" style="display:flex;gap:12px;margin-bottom:20px"><button class="btn btn-sm" :class="supplierCatalogTab === 'raw' ? 'btn-primary' : 'btn-outline'" @click="supplierCatalogTab='raw'">酿造原料</button><button class="btn btn-sm" :class="supplierCatalogTab === 'packaging' ? 'btn-primary' : 'btn-outline'" @click="supplierCatalogTab='packaging'">包装材料</button></div><SupplierCatalogPage v-if="supplierCatalogTab === 'raw'" :permissions="authContext.permissions" @toast="showToast" /><PackagingMaterialsPage v-else :supplier="true" /></div>
        <TasksPage v-else-if="currentPage === 'tasks'" @open-recipe-review="openRecipeReview" />
      </section>
    </main>

    <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>

  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, onUnmounted, onUpdated, reactive, ref, watch } from "vue";
import { brewApi } from "./api";
import RecipePage from "./components/RecipePage.vue";
import ProductionPlanDetail from "./components/ProductionPlanDetail.vue";
import ProductionRecipeEditor from "./components/ProductionRecipeEditor.vue";
import InventoryProcurementPage from "./components/InventoryProcurementPage.vue";
import PackagingMaterialsPage from "./components/PackagingMaterialsPage.vue";
import { calculateRecipe } from "./recipe-calculations";
import { navSections, pageMeta, roles } from "./data";

const supplierCatalogTab = ref("raw");
const currentRole = ref("gm");
const currentPage = ref("dashboard");
const keyword = ref("");
const toastMessage = ref("");
const pageRevision = ref(0);
const pendingRecipeReviewId = ref("");
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
  ,supplier: "supplier"
};

const currentCompanyName = computed(() => {
  const company = authContext.value?.companies.find(
    item => item.id === authContext.value.current_company_id
  );
  return company?.name || "未选择企业";
});

const roleConfig = computed(() => roles[currentRole.value]);
const currentMeta = computed(() => pageMeta[currentPage.value] || pageMeta.tasks);

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

function openRecipeReview(versionId) {
  pendingRecipeReviewId.value = String(versionId || "");
  currentPage.value = "recipe";
  pageRevision.value += 1;
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
        state: ({ draft: "待下发", checked: "待下发", stocking: "原料备货中", pending_approval: "待下发", submitted: "待下发", approved: "待下发", dispatched: "已下发", in_progress: "执行中", done: "已完成", cancelled: "已取消", terminated: "已终止" })[item.state] || item.state
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

function freshDemandDraft() {
  return { customer_id: "", product_tmpl_id: "", packaging_id: "", packaging_method: "", package_container_type: "",
    package_unit_volume_l: "", package_units_per_box: "", packaging_description: "", package_qty: "",
    requested_volume_l: "", requested_delivery_date: "", customer_reference: "", notes: "" };
}
function demandPackagingSummary(item) {
  if (item.packaging_method === "keg") return `${item.package_unit_volume_l} L / 桶`;
  if (item.packaging_method === "box") return `${item.package_container_type === "can" ? "罐" : "瓶"}装 · ${Number((Number(item.package_unit_volume_l) * 1000).toFixed(1))} ml × ${item.package_units_per_box} / 箱`;
  if (item.packaging_method === "other") return item.packaging_description || "其他包装";
  return item.packaging?.name || "未指定包装";
}

const ProductionPage = defineComponent({
  components: { Tabs, DataTable, Workflow, TaskCard, StatusTag, ProductionRecipeEditor, ProductionPlanDetail },
  props: { permissions: { type: Array, default: () => [] } },
  data() {
    return {
      tab: "requests",
      demands: [],
      customers: [],
      products: [],
      packagingSpecs: [],
      demandLoading: false,
      demandOptionsLoading: false,
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
      selectedDemand: null,
      demandDetailLoading: false,
      demandDetailError: "",
      editingDemand: null,
      demandSubmitMode: "submit",
      demandVolumeManual: false,
      showPlanForm: false,
      showPlanRecipeEditor: false,
      planRecipeDesign: null,
      planRecipeDesignSaved: false,
      planInventory: null,
      planInventoryLoading: false,
      planInventoryError: "",
      planInventoryTimer: null,
      planInventorySequence: 0,
      selectedPlanId: null,
      planSaving: false,
      planError: "",
      planAssignees: [],
      demandDraft: freshDemandDraft(),
      planDraft: { demand_id: "", product_tmpl_id: "", process_source_type: "base", source_production_batch_id: "", factory_id: "", recipe_version_id: "", equipment_id: "", tank_id: "", planned_volume_l: "", planned_start: "", planned_end: "", owner_id: "", mash_owner_id: "", fermentation_owner_id: "" }
    };
  },
  computed: {
    tabs() {
      const result = [];
      if (this.canReadDemands) result.push({ id: "requests", label: "产品需求" });
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
    packagingOptions() {
      const product = this.products.find(item => String(item.id) === String(this.demandDraft.product_tmpl_id));
      return this.packagingSpecs.filter(item => item.active !== false && String(item.product_id?.id || "") === String(product?.product_variant_id || ""));
    },
    packagedVolume() {
      const draft = this.demandDraft;
      const qty = Number(draft.package_qty);
      const unit = Number(draft.package_unit_volume_l);
      const perBox = draft.packaging_method === "box" ? Number(draft.package_units_per_box) : 1;
      if (!["keg", "box"].includes(draft.packaging_method) || !Number.isFinite(qty * unit * perBox) || !Number.isInteger(qty) || qty <= 0 || unit <= 0 || perBox <= 0 || (draft.packaging_method === "box" && (!draft.package_container_type || !Number.isInteger(perBox)))) return null;
      return Number((qty * unit * perBox).toFixed(6));
    },
    packagingCalculation() {
      const draft = this.demandDraft;
      if (this.packagedVolume === null) return "";
      if (draft.packaging_method === "keg") return `${draft.package_qty} 桶 × ${draft.package_unit_volume_l} L / 桶 = ${this.packagedVolume} L`;
      const milliliters = Number((Number(draft.package_unit_volume_l) * 1000).toFixed(1));
      return `${draft.package_qty} 箱 × ${draft.package_units_per_box} ${draft.package_container_type === "can" ? "罐" : "瓶"} / 箱 × ${milliliters} ml = ${this.packagedVolume} L`;
    },
    matchedPackagingSpec() {
      const method = this.demandDraft.packaging_method;
      if (!["keg", "box"].includes(method) || (method === "box" && !this.demandDraft.package_container_type)) return null;
      const unit = Number(this.demandDraft.package_unit_volume_l);
      const count = Number(this.demandDraft.package_units_per_box);
      const volume = unit * (method === "box" ? count : 1);
      return this.packagingOptions.find(item => item.brew_barcode_level === method && Math.abs(Number(item.brew_volume_l) - volume) < 0.001 && (method !== "box" || Number(item.qty) === count) && (method !== "box" || !/[瓶罐]/.test(item.name) || item.name.includes(this.demandDraft.package_container_type === "can" ? "罐" : "瓶"))) || null;
    },
    canReadDemands() {
      return this.permissions.some(item => ["demand.product.manage_own", "demand.product.confirm", "dashboard.overview.read"].includes(item));
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
    confirmedDemands() {
      return this.demands.filter(item => item.state === "confirmed" && !this.productionPlans.some(plan => String(plan.demand_id) === String(item.id) && !["cancelled", "terminated"].includes(plan.state)));
    },
    planRecipes() {
      const demand = this.demands.find(item => String(item.id) === String(this.planDraft.demand_id));
      const productId = demand?.product?.id || this.planDraft.product_tmpl_id;
      if (!productId) return [];
      return this.activeRecipes.filter(item => {
        if (String(item.product?.id || "") !== String(productId)) return false;
        if (!demand?.factory_id) return true;
        const system = this.equipment.find(equipment => String(equipment.id) === String(item.equipment?.id));
        return String(system?.brew_factory_id?.id || "") === String(demand.factory_id);
      });
    },
    planSourceRuns() {
      const demand = this.demands.find(item => String(item.id) === String(this.planDraft.demand_id));
      const productId = demand?.product?.id || this.planDraft.product_tmpl_id;
      if (!productId) return [];
      return this.productionBatches.filter(item => ["in_tank", "completed"].includes(item.state)
        && item.source_version?.id
        && String(item.product?.id || "") === String(productId)
        && (!demand?.factory_id || String(item.factory?.id || "") === String(demand.factory_id)));
    },
    selectedPlanProduct() {
      const demand = this.demands.find(item => String(item.id) === String(this.planDraft.demand_id));
      return demand?.product || this.products.find(item => String(item.id) === String(this.planDraft.product_tmpl_id)) || null;
    },
    selectedPlanSystem() {
      if (this.planDraft.process_source_type === "production") {
        const run = this.planSourceRuns.find(item => String(item.id) === String(this.planDraft.source_production_batch_id));
        const system = run?.brew_system || run?.equipment;
        return system ? { ...system, factory_name: run.factory?.name || "", factory_id: run.factory?.id || "", reference_volume_l: run.planned_volume_l || run.actual_volume_l || null } : null;
      }
      const recipe = this.planRecipes.find(item => String(item.active_version_id) === String(this.planDraft.recipe_version_id));
      if (!recipe?.equipment) return null;
      const equipment = this.equipment.find(item => String(item.id) === String(recipe.equipment.id));
      return { ...recipe.equipment, factory_name: equipment?.brew_factory_id?.name || "", factory_id: equipment?.brew_factory_id?.id || "", reference_volume_l: recipe.active_version_base_volume_l || null };
    },
    filteredEquipment() {
      return this.equipment.filter(item => String(item.brew_factory_id?.id || "") === String(this.planDraft.factory_id));
    },
    filteredPlanTanks() {
      const volume = Number(this.planDraft.planned_volume_l || 0);
      return this.planTanks.filter(item => String(item.factory_id?.id || "") === String(this.planDraft.factory_id) && item.tank_type === "fermentation" && Number(item.capacity_l || 0) >= volume);
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
    planHasShortage() { return this.planInventory && !this.planInventory.ok; },
    planInventoryKey() {
      return JSON.stringify([this.planDraft.demand_id, this.planDraft.factory_id, this.planDraft.recipe_version_id, this.planDraft.source_production_batch_id, this.planDraft.planned_volume_l, this.planRecipeDesignSaved ? this.planRecipeDesign : null]);
    },
    planRows() {
      return this.productionPlans.map(item => ({
        id: item.name,
        type: "生产",
        product: item.product?.name || "-",
        volume: item.planned_volume_l,
        recipe: item.recipe_version_type === "production"
          ? item.recipe_version?.version_label
          : item.source_production_batch
            ? `生产批次版 · ${item.source_production_batch.name}（${item.recipe_version?.version_label || "基础工艺"}）`
            : item.recipe_version?.version_label || item.recipe_version?.name || "-",
        date: item.planned_start?.replace("T", " ").slice(0, 16),
        factory: item.factory?.name || "-",
        device: item.equipment?.name || "-",
        tank: item.tank?.name || "-",
        mash_owner: item.mash_owner?.name || "-",
        fermentation_owner: item.fermentation_owner?.name || "-",
        state: ({ draft: "待下发", checked: "待下发", stocking: "原料备货中", pending_approval: "待下发", submitted: "待下发", approved: "待下发", dispatched: "已下发", in_progress: "执行中", done: "已完成", cancelled: "已取消", terminated: "已终止" })[item.state] || item.state
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
  watch: {
    planInventoryKey() { this.schedulePlanInventory(); },
    showPlanForm(visible) { if (visible) this.schedulePlanInventory(); else { clearTimeout(this.planInventoryTimer); this.planInventorySequence++; } }
  },
  beforeUnmount() { clearTimeout(this.planInventoryTimer); this.planInventorySequence++; },
  mounted() {
    this.tab = !this.canReadDemands && !this.canReadPlans && this.canExecuteProduction
      ? "fermentation"
      : (this.tabs[0]?.id || "mash");
    if (this.canReadDemands) this.loadDemands();
    this.loadExecution();
  },
  methods: {
    async loadDemands() {
      this.demandLoading = true;
      this.demandError = "";
      this.loadDemandOptions();
      try {
        this.demands = await brewApi.listDemands({ page_size: 100 });
      } catch (cause) {
        this.demandError = cause.message || "产品需求加载失败。";
      } finally {
        this.demandLoading = false;
      }
    },
    async loadDemandOptions() {
      this.demandOptionsLoading = true;
      try {
        const [customers, products, packagingSpecs] = await Promise.all([
          brewApi.listMaster("customers", { page_size: 100, active: true }),
          brewApi.listMaster("products", { page_size: 100, active: true }),
          brewApi.listMaster("packaging-specs", { page_size: 100, active: true })
        ]);
        this.customers = customers;
        this.products = products;
        this.packagingSpecs = packagingSpecs;
      } catch (cause) {
        this.demandError = cause.message || "需求所需的客户、产品或包装资料加载失败。";
      } finally {
        this.demandOptionsLoading = false;
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
    canPlanDemand(item) {
      return this.canManagePlans
        && !this.executionLoading
        && item.state === "confirmed"
        && !this.productionPlans.some(plan => String(plan.demand_id) === String(item.id) && !["cancelled", "terminated"].includes(plan.state));
    },
    openRequest(item = null) {
      if (this.demandOptionsLoading) {
        this.demandError = "客户、产品和包装资料仍在加载，请稍后再试。";
        return;
      }
      this.showDemandForm = true;
      this.demandError = "";
      this.demandSubmitMode = "submit";
      this.editingDemand = item;
      this.demandDraft = item ? {
        customer_id: item.customer?.id || "", product_tmpl_id: item.product?.id || "", packaging_id: item.packaging?.id || "",
        packaging_method: item.packaging_method || "", package_container_type: item.package_container_type || "",
        package_unit_volume_l: item.package_unit_volume_l || "", package_units_per_box: item.package_units_per_box || "",
        packaging_description: item.packaging_description || "",
        package_qty: item.package_qty, requested_volume_l: item.requested_volume_l,
        requested_delivery_date: item.requested_delivery_date || "", customer_reference: item.customer_reference || "", notes: item.notes || ""
      } : freshDemandDraft();
      const draft = this.demandDraft;
      const estimated = Number(draft.package_qty) * Number(draft.package_unit_volume_l) * (draft.packaging_method === "box" ? Number(draft.package_units_per_box) : 1);
      this.demandVolumeManual = Boolean(item && (draft.packaging_method === "other" || Math.abs(Number(draft.requested_volume_l) - estimated) > 0.0001));
    },
    async openDemandDetail(item) {
      this.selectedDemand = item;
      this.demandDetailLoading = true;
      this.demandDetailError = "";
      try {
        const detail = await brewApi.getDemand(item.id);
        if (String(this.selectedDemand?.id) === String(item.id)) this.selectedDemand = detail;
      } catch (cause) {
        if (String(this.selectedDemand?.id) === String(item.id)) this.demandDetailError = cause.message || "产品需求详情加载失败。";
      } finally {
        if (String(this.selectedDemand?.id) === String(item.id)) this.demandDetailLoading = false;
      }
    },
    demandPackagingSummary,
    setPackagingMethod(method) {
      this.demandDraft.packaging_method = method;
      this.demandDraft.package_container_type = "";
      this.demandDraft.package_unit_volume_l = "";
      this.demandDraft.package_units_per_box = "";
      this.demandDraft.packaging_description = "";
      this.demandDraft.packaging_id = "";
      this.demandDraft.requested_volume_l = "";
      this.demandVolumeManual = method === "other";
    },
    updateDemandEstimate() {
      if (!this.demandVolumeManual) this.demandDraft.requested_volume_l = this.packagedVolume ?? "";
    },
    setBoxUnitVolumeFromMl(event) {
      const value = event.target.value;
      this.demandDraft.package_unit_volume_l = value === "" ? "" : Number(value) / 1000;
      this.updateDemandEstimate();
    },
    useDemandEstimate() {
      if (this.packagedVolume !== null) {
        this.demandVolumeManual = false;
        this.demandDraft.requested_volume_l = this.packagedVolume;
      }
    },
    async submitExistingDemand(item) {
      this.demandSaving = true;
      this.demandError = "";
      try {
        await brewApi.demandAction(item.id, "submit", item.version);
        await this.loadDemands();
      } catch (cause) {
        this.demandError = cause.message || "产品需求提交失败。";
      } finally {
        this.demandSaving = false;
      }
    },
    async submitDemand() {
      this.demandSaving = true;
      this.demandError = "";
      let created = null;
      let savedAndSubmitted = false;
      try {
        if (!this.demandDraft.packaging_method) throw new Error("请选择包装方式。");
        if (!Number.isInteger(Number(this.demandDraft.package_qty)) || Number(this.demandDraft.package_qty) <= 0) throw new Error("包装数量须为正整数。");
        if (this.demandDraft.packaging_method === "other" && !this.demandDraft.packaging_description.trim()) throw new Error("请填写其他包装说明。");
        if (this.demandDraft.packaging_method !== "other" && this.packagedVolume === null) throw new Error("请补全包装容量与数量。");
        if (this.packagedVolume !== null && Number(this.demandDraft.requested_volume_l) + 0.0001 < this.packagedVolume) throw new Error("所需酒液不能少于包装成品的总容量。");
        const payload = {
          ...this.demandDraft,
          customer_id: Number(this.demandDraft.customer_id),
          product_tmpl_id: Number(this.demandDraft.product_tmpl_id),
          packaging_id: this.matchedPackagingSpec ? Number(this.matchedPackagingSpec.id) : null,
          package_qty: Number(this.demandDraft.package_qty),
          requested_volume_l: Number(this.demandDraft.requested_volume_l)
        };
        created = this.editingDemand
          ? await brewApi.updateDemand(this.editingDemand.id, { ...payload, version: this.editingDemand.version })
          : await brewApi.createDemand(payload);
        if (this.demandSubmitMode === "submit") await brewApi.demandAction(created.id, "submit", created.version);
        savedAndSubmitted = true;
        this.showDemandForm = false;
        this.editingDemand = null;
        this.demandDraft = freshDemandDraft();
        await this.loadDemands();
      } catch (cause) {
        if (created && !savedAndSubmitted) {
          await this.loadDemands();
          this.editingDemand = created;
          this.demandError = `需求草稿已保存，但提交确认失败：${cause.message || "请从列表重新提交。"}`;
        } else {
          this.demandError = cause.message || "产品需求列表刷新失败。";
        }
      } finally {
        this.demandSaving = false;
      }
    },
    schedulePlanInventory() {
      clearTimeout(this.planInventoryTimer);
      this.planInventorySequence++;
      this.planInventory = null;
      this.planInventoryError = "";
      this.planInventoryLoading = false;
      if (!this.showPlanForm || !this.planDraft.recipe_version_id || !this.planDraft.factory_id || !(Number(this.planDraft.planned_volume_l) > 0)) return;
      this.planInventoryLoading = true;
      this.planInventoryTimer = setTimeout(() => this.checkPlanInventory(), 250);
    },
    async checkPlanInventory() {
      const sequence = ++this.planInventorySequence;
      this.planInventoryLoading = true;
      this.planInventoryError = "";
      try {
        const result = await brewApi.previewPlanInventory({ demand_id: this.planDraft.demand_id || undefined, factory_id: Number(this.planDraft.factory_id), recipe_version_id: Number(this.planDraft.recipe_version_id), source_production_batch_id: this.planDraft.process_source_type === "production" ? Number(this.planDraft.source_production_batch_id) : undefined, planned_volume_l: Number(this.planDraft.planned_volume_l), production_design: this.planRecipeDesignSaved ? this.planRecipeDesign : undefined });
        if (sequence === this.planInventorySequence) this.planInventory = result;
      } catch (cause) { if (sequence === this.planInventorySequence) this.planInventoryError = cause.message || "库存对比失败，请重试"; }
      finally { if (sequence === this.planInventorySequence) this.planInventoryLoading = false; }
    },
    stockNumber(value) { return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 4 }); },
    openPlan() {
      this.planDraft = { demand_id: "", product_tmpl_id: "", process_source_type: "base", source_production_batch_id: "", factory_id: "", recipe_version_id: "", equipment_id: "", tank_id: "", planned_volume_l: "", planned_start: "", planned_end: "", owner_id: "", mash_owner_id: "", fermentation_owner_id: "" };
      this.planAssignees = [];
      this.planRecipeDesign = null;
      this.planRecipeDesignSaved = false;
      this.planError = "";
      this.showPlanForm = true;
      this.demandError = "";
    },
    openPlanForDemand(item) {
      if (!this.canPlanDemand(item)) return;
      this.tab = "plans";
      this.planDraft = { demand_id: String(item.id), product_tmpl_id: String(item.product?.id || ""), process_source_type: "base", source_production_batch_id: "", factory_id: "", recipe_version_id: "", equipment_id: "", tank_id: "", planned_volume_l: "", planned_start: "", planned_end: "", owner_id: "", mash_owner_id: "", fermentation_owner_id: "" };
      this.choosePlanDemand();
      this.planAssignees = [];
      this.planRecipeDesign = null;
      this.planRecipeDesignSaved = false;
      this.planError = "";
      this.showPlanForm = true;
      this.demandError = "";
    },
    choosePlanDemand() {
      const demand = this.demands.find(item => String(item.id) === String(this.planDraft.demand_id));
      this.planDraft.product_tmpl_id = demand?.product?.id || "";
      this.planDraft.recipe_version_id = "";
      this.planDraft.source_production_batch_id = "";
      this.planDraft.equipment_id = "";
      this.planDraft.factory_id = "";
      this.planDraft.tank_id = "";
      this.planDraft.mash_owner_id = "";
      this.planDraft.fermentation_owner_id = "";
      this.planAssignees = [];
      this.planRecipeDesign = null;
      this.planRecipeDesignSaved = false;
      if (demand) {
        this.planDraft.planned_volume_l = demand.requested_volume_l;
      } else {
        this.planDraft.planned_volume_l = "";
      }
    },
    choosePlanProduct() {
      this.planDraft.demand_id = "";
      this.planDraft.recipe_version_id = "";
      this.planDraft.source_production_batch_id = "";
      this.planDraft.equipment_id = "";
      this.planDraft.factory_id = "";
      this.planDraft.tank_id = "";
      this.planDraft.planned_volume_l = "";
      this.planDraft.mash_owner_id = "";
      this.planDraft.fermentation_owner_id = "";
      this.planRecipeDesign = null;
      this.planRecipeDesignSaved = false;
      this.planAssignees = [];
    },
    choosePlanProcessSource() {
      this.planDraft.recipe_version_id = "";
      this.planDraft.source_production_batch_id = "";
      this.planDraft.equipment_id = "";
      this.planDraft.factory_id = "";
      this.planDraft.tank_id = "";
      this.planDraft.mash_owner_id = "";
      this.planDraft.fermentation_owner_id = "";
      this.planRecipeDesign = null;
      this.planRecipeDesignSaved = false;
      this.planAssignees = [];
    },
    async choosePlanRecipe() {
      this.planRecipeDesign = null; this.planRecipeDesignSaved = false;
      const recipe = this.planRecipes.find(item => String(item.active_version_id) === String(this.planDraft.recipe_version_id));
      this.planDraft.equipment_id = recipe?.equipment?.id || "";
      this.planDraft.factory_id = this.equipment.find(item => String(item.id) === String(this.planDraft.equipment_id))?.brew_factory_id?.id || "";
      this.planDraft.tank_id = "";
      this.planDraft.mash_owner_id = "";
      this.planDraft.fermentation_owner_id = "";
      await this.loadPlanAssignees(this.planDraft.factory_id);
    },
    async choosePlanProductionRun() {
      this.planRecipeDesign = null; this.planRecipeDesignSaved = false;
      const batch = this.planSourceRuns.find(item => String(item.id) === String(this.planDraft.source_production_batch_id));
      this.planDraft.recipe_version_id = batch?.source_version?.id || "";
      this.planDraft.equipment_id = batch?.brew_system?.id || batch?.equipment?.id || "";
      this.planDraft.factory_id = batch?.factory?.id || "";
      this.planDraft.tank_id = "";
      this.planDraft.mash_owner_id = "";
      this.planDraft.fermentation_owner_id = "";
      if (batch && !this.planDraft.demand_id) this.planDraft.planned_volume_l = batch.planned_volume_l || "";
      await this.loadPlanAssignees(this.planDraft.factory_id);
    },
    async loadPlanAssignees(factoryId) {
      this.planAssignees = [];
      if (!factoryId) return;
      try {
        this.planAssignees = await brewApi.listProductionPlanAssignees(factoryId);
      } catch (cause) {
        this.planError = cause.message || "生产人员列表加载失败。";
      }
    },
    openPlanRecipeEditor() {
      if (!this.planDraft.recipe_version_id || !this.planDraft.planned_volume_l) {
        this.planError = "请先选择配方并填写计划产量，再查看配方设计。";
        return;
      }
      this.planError = "";
      this.showPlanRecipeEditor = true;
    },
    savePlanRecipeDesign(design) {
      this.planRecipeDesign = design;
      this.planRecipeDesignSaved = true;
      this.showPlanRecipeEditor = false;
    },
    ensurePlanTankCapacity() {
      const tank = this.planTanks.find(item => String(item.id) === String(this.planDraft.tank_id));
      if (tank && Number(tank.capacity_l) < Number(this.planDraft.planned_volume_l)) this.planDraft.tank_id = "";
    },
    closePlan() {
      this.showPlanForm = false;
      this.showPlanRecipeEditor = false;
      this.planError = "";
    },
    async submitPlan() {
      this.planSaving = true;
      this.planError = "";
      try {
        let productionDesign;
        if (this.planRecipeDesignSaved && this.planRecipeDesign) {
          productionDesign = JSON.parse(JSON.stringify(this.planRecipeDesign));
          const originalVolume = Number(productionDesign.brew_volume_l) || Number(this.planDraft.planned_volume_l);
          const targetVolume = Number(this.planDraft.planned_volume_l);
          const factor = originalVolume > 0 ? targetVolume / originalVolume : 1;
          for (const key of ["fermentables", "hops", "yeast"]) productionDesign[key].forEach(line => { line.quantity = Number((Number(line.quantity || 0) * factor).toFixed(4)); });
          productionDesign.brew_volume_l = targetVolume;
          productionDesign.mash.sparge_mode = "auto";
          productionDesign.mash.sparge_water_liters = [...calculateRecipe(productionDesign).spargeWaters];
        }
        if (!this.planInventory || this.planInventoryLoading || this.planInventoryError) throw new Error("请等待库存对比完成后再保存。 ");
        const created = await brewApi.createProductionPlan({
          demand_id: this.planDraft.demand_id ? Number(this.planDraft.demand_id) : undefined,
          factory_id: Number(this.planDraft.factory_id),
          recipe_version_id: Number(this.planDraft.recipe_version_id),
          source_production_batch_id: this.planDraft.process_source_type === "production" ? Number(this.planDraft.source_production_batch_id) : undefined,
          equipment_id: Number(this.planDraft.equipment_id),
          tank_id: Number(this.planDraft.tank_id),
          planned_volume_l: Number(this.planDraft.planned_volume_l),
          planned_start: new Date(this.planDraft.planned_start).toISOString(),
          planned_end: new Date(this.planDraft.planned_end).toISOString(),
          owner_id: this.planDraft.owner_id ? Number(this.planDraft.owner_id) : undefined,
          mash_owner_id: Number(this.planDraft.mash_owner_id),
          fermentation_owner_id: Number(this.planDraft.fermentation_owner_id),
          production_design: productionDesign,
          submit_stock_request: Boolean(this.planHasShortage)
        });
        this.showPlanForm = false;
        this.selectedPlanId = created.id;
        this.planDraft = { demand_id: "", product_tmpl_id: "", process_source_type: "base", source_production_batch_id: "", factory_id: "", recipe_version_id: "", equipment_id: "", tank_id: "", planned_volume_l: "", planned_start: "", planned_end: "", owner_id: "", mash_owner_id: "", fermentation_owner_id: "" };
        this.planRecipeDesign = null;
        this.planRecipeDesignSaved = false;
        await this.loadExecution();
      } catch (cause) {
        this.planError = cause.message || "生产计划保存失败。";
      } finally {
        this.planSaving = false;
      }
    }
  },
  template: `
    <Tabs v-model="tab" :tabs="tabs" />
    <div v-if="demandError" class="master-error">{{ demandError }}</div>
    <div v-if="tab === 'requests'" class="panel">
      <div class="panel-header"><div class="panel-title">产品需求</div><div class="master-actions"><button class="btn btn-sm btn-secondary" @click="loadDemands">刷新</button><button v-if="canCreateDemand" class="btn btn-sm btn-primary" @click="openRequest()">新建需求</button></div></div>
      <div v-if="demandLoading" class="panel-body empty">正在加载...</div>
      <div v-else-if="!demands.length" class="panel-body empty">暂无产品需求。销售可以点击“新建需求”录入客户订单。</div>
      <div v-else class="demand-list"><article v-for="item in demands" :key="item.id" class="demand-list-card"><button class="demand-list-main demand-list-open" type="button" @click="openDemandDetail(item)"><span class="demand-list-title"><strong>{{ item.product?.name || '未选产品' }}</strong><StatusTag :text="({ draft: '草稿', submitted: '待确认', confirmed: '已确认', returned: '已退回', planned: '已排产', cancelled: '已取消' })[item.state] || item.state" /></span><span class="demand-list-subtitle">{{ demandPackagingSummary(item) }} · {{ item.package_qty }} {{ item.packaging_method === 'keg' ? '桶' : item.packaging_method === 'box' ? '箱' : '件' }}</span><span class="demand-list-facts"><span><small>酒液需求</small><strong>{{ item.requested_volume_l || 0 }} L</strong></span><span><small>客户</small><strong>{{ item.customer?.name || '—' }}</strong></span><span><small>要求出品</small><strong>{{ item.requested_delivery_date || '—' }}</strong></span></span><span v-if="item.decision_reason" class="demand-list-decision">处理意见：{{ item.decision_reason }}</span></button><div class="demand-list-actions"><button v-if="canPlanDemand(item)" class="btn btn-xs btn-primary" type="button" @click="openPlanForDemand(item)">创建生产计划</button><button class="demand-list-detail-action" type="button" @click="openDemandDetail(item)">查看详情 →</button><button v-if="canCreateDemand && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-outline" type="button" @click="openRequest(item)">编辑需求</button><button v-if="canCreateDemand && ['draft','returned'].includes(item.state)" class="btn btn-xs btn-primary" type="button" :disabled="demandSaving" @click="submitExistingDemand(item)">提交确认</button></div></article></div>
      <div v-if="selectedDemand" class="equipment-modal-mask" @click.self="selectedDemand = null"><section class="equipment-modal demand-detail-modal" role="dialog" aria-modal="true" :aria-label="'产品需求详情 ' + (selectedDemand.product?.name || '')"><div class="equipment-modal-header"><div><div class="modal-title">{{ selectedDemand.product?.name || '产品需求详情' }}</div><div class="modal-subtitle">产品需求详情</div></div><div class="demand-detail-header-actions"><StatusTag :text="({ draft: '草稿', submitted: '待确认', confirmed: '已确认', returned: '已退回', planned: '已排产', cancelled: '已取消' })[selectedDemand.state] || selectedDemand.state" /><button class="equipment-close" type="button" aria-label="关闭" @click="selectedDemand = null">×</button></div></div><div class="equipment-modal-body demand-detail-body"><div v-if="demandDetailLoading" class="empty">正在加载完整详情…</div><template v-else><div v-if="demandDetailError" class="master-error">{{ demandDetailError }}</div><div class="demand-review-summary"><div><span>产品</span><strong>{{ selectedDemand.product?.name || '—' }}</strong></div><div><span>客户</span><strong>{{ selectedDemand.customer?.name || '—' }}</strong></div><div><span>包装规格</span><strong>{{ demandPackagingSummary(selectedDemand) }}</strong></div><div><span>包装数量</span><strong>{{ selectedDemand.package_qty ?? '—' }} {{ selectedDemand.packaging_method === 'keg' ? '桶' : selectedDemand.packaging_method === 'box' ? '箱' : '件' }}</strong></div><div><span>成品酒液</span><strong>{{ selectedDemand.packaging_method === 'box' ? (Number(selectedDemand.package_qty || 0) * Number(selectedDemand.package_unit_volume_l || 0) * Number(selectedDemand.package_units_per_box || 0)).toFixed(1) : selectedDemand.packaging_method === 'keg' ? (Number(selectedDemand.package_qty || 0) * Number(selectedDemand.package_unit_volume_l || 0)).toFixed(1) : '—' }}{{ ['keg', 'box'].includes(selectedDemand.packaging_method) ? ' L' : '' }}</strong></div><div><span>计划所需酒液</span><strong>{{ selectedDemand.requested_volume_l ?? '—' }} L</strong></div><div><span>要求出品日期</span><strong>{{ selectedDemand.requested_delivery_date || '—' }}</strong></div><div><span>客户参考号</span><strong>{{ selectedDemand.customer_reference || '—' }}</strong></div></div><div v-if="selectedDemand.notes" class="demand-review-notes"><span>备注与特殊要求</span><p>{{ selectedDemand.notes }}</p></div><div v-if="selectedDemand.decision_reason" class="demand-review-notes"><span>处理意见</span><p>{{ selectedDemand.decision_reason }}</p></div></template></div><div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="selectedDemand = null">关闭</button></div></section></div>
      <div v-if="showDemandForm" class="equipment-modal-mask" @click.self="showDemandForm = false">
        <form class="equipment-modal demand-editor-modal" @submit.prevent="submitDemand">
          <div class="equipment-modal-header"><div><div class="modal-title">{{ editingDemand ? '编辑产品需求' : '新建产品需求' }}</div><div class="modal-subtitle">确认成品包装与交付量，再提交生产确认</div></div><button class="equipment-close" type="button" aria-label="关闭" @click="showDemandForm = false">×</button></div>
          <div class="equipment-modal-body demand-editor-body">
            <label><span><i>*</i>客户</span><select v-model="demandDraft.customer_id" required><option value="">请选择客户</option><option v-for="item in customers" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
            <label><span><i>*</i>产品</span><select v-model="demandDraft.product_tmpl_id" required><option value="">请选择成品</option><option v-for="item in products.filter(row => row.brew_item_type === 'finished_product')" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
            <div class="demand-packaging-field demand-editor-wide">
              <span><i>*</i>包装方式</span>
              <div class="demand-method-options">
                <button type="button" :class="{ selected: demandDraft.packaging_method === 'keg' }" @click="setPackagingMethod('keg')"><strong>桶装</strong><small>按单桶容量计算</small></button>
                <button type="button" :class="{ selected: demandDraft.packaging_method === 'box' }" @click="setPackagingMethod('box')"><strong>箱装</strong><small>瓶/罐 × 每箱数量</small></button>
                <button type="button" :class="{ selected: demandDraft.packaging_method === 'other' }" @click="setPackagingMethod('other')"><strong>其他</strong><small>自定义包装说明</small></button>
              </div>
            </div>
            <div v-if="demandDraft.packaging_method === 'keg'" class="demand-packaging-field demand-editor-wide">
              <span><i>*</i>单桶容量</span>
              <div class="demand-preset-options"><button v-for="size in [5, 10, 20]" :key="size" type="button" :class="{ selected: Number(demandDraft.package_unit_volume_l) === size }" @click="demandDraft.package_unit_volume_l = size; updateDemandEstimate()">{{ size }} L</button></div>
              <label class="demand-inline-custom"><span>自定义容量（L）</span><input v-model.number="demandDraft.package_unit_volume_l" type="number" min="0.001" step="0.001" placeholder="如 30" @input="updateDemandEstimate"></label>
            </div>
            <template v-if="demandDraft.packaging_method === 'box'">
              <div class="demand-packaging-field demand-editor-wide"><span><i>*</i>包装类型</span><div class="demand-preset-options"><button v-for="type in [{ value: 'bottle', label: '瓶' }, { value: 'can', label: '罐' }]" :key="type.value" type="button" :class="{ selected: demandDraft.package_container_type === type.value }" @click="demandDraft.package_container_type = type.value; updateDemandEstimate()">{{ type.label }}</button></div></div>
              <div class="demand-packaging-field"><span><i>*</i>单{{ demandDraft.package_container_type === 'can' ? '罐' : '瓶' }}容量</span><div class="demand-preset-options"><button v-for="size in [330, 500, 1000]" :key="size" type="button" :class="{ selected: Math.round(Number(demandDraft.package_unit_volume_l) * 1000) === size }" @click="demandDraft.package_unit_volume_l = size / 1000; updateDemandEstimate()">{{ size }} ml</button></div><label class="demand-inline-custom"><span>自定义容量（ml）</span><input :value="demandDraft.package_unit_volume_l ? Number((Number(demandDraft.package_unit_volume_l) * 1000).toFixed(1)) : ''" type="number" min="1" step="0.1" placeholder="如 440" @input="setBoxUnitVolumeFromMl"></label></div>
              <div class="demand-packaging-field"><span><i>*</i>每箱数量</span><div class="demand-preset-options"><button v-for="count in [12, 24]" :key="count" type="button" :class="{ selected: Number(demandDraft.package_units_per_box) === count }" @click="demandDraft.package_units_per_box = count; updateDemandEstimate()">{{ count }} 件</button></div><label class="demand-inline-custom"><span>自定义每箱数量</span><input v-model.number="demandDraft.package_units_per_box" type="number" min="1" step="1" placeholder="如 6" @input="updateDemandEstimate"></label></div>
            </template>
            <label v-if="demandDraft.packaging_method === 'other'" class="demand-editor-wide"><span><i>*</i>包装说明</span><input v-model.trim="demandDraft.packaging_description" maxlength="100" required placeholder="例如：散装酒液、定制礼盒或客户自备容器"></label>
            <label v-if="demandDraft.packaging_method"><span><i>*</i>{{ demandDraft.packaging_method === 'keg' ? '桶数' : demandDraft.packaging_method === 'box' ? '箱数' : '包装数量' }}</span><input v-model.number="demandDraft.package_qty" type="number" min="1" step="1" required placeholder="请输入数量" @input="updateDemandEstimate"></label>
            <label v-if="demandDraft.packaging_method"><span><i>*</i>计划所需酒液（L）</span><input v-model.number="demandDraft.requested_volume_l" type="number" min="0.001" step="any" required placeholder="可调整，需覆盖包装量与损耗" @input="demandVolumeManual = true"></label>
            <div v-if="packagedVolume !== null" class="demand-volume-hint demand-editor-wide"><span>成品酒液：<strong>{{ packagingCalculation }}</strong>。计划所需酒液可增加损耗预留，但不能低于此容量。</span><button v-if="demandVolumeManual" type="button" @click="useDemandEstimate">恢复建议值</button></div>
            <div v-if="demandDraft.packaging_method && matchedPackagingSpec" class="demand-spec-note demand-editor-wide">已匹配产品包装规格：{{ matchedPackagingSpec.name }}</div>
            <div v-else-if="demandDraft.packaging_method && demandDraft.packaging_method !== 'other' && demandDraft.product_tmpl_id" class="demand-spec-note demand-editor-wide">这是自定义包装组合，将随需求一同保存，请在生产确认时核对。</div>
            <label><span><i>*</i>要求出品日期</span><input v-model="demandDraft.requested_delivery_date" type="date" required></label>
            <label><span>客户参考号</span><input v-model.trim="demandDraft.customer_reference" placeholder="客户订单号，选填"></label>
            <label class="demand-editor-wide"><span>备注与特殊要求</span><textarea v-model.trim="demandDraft.notes" rows="3" placeholder="填写包装、出品或交付的特殊要求"></textarea></label>
          </div>
          <div class="equipment-modal-footer"><div v-if="demandError" class="master-error demand-modal-error">{{ demandError }}</div><button class="btn btn-secondary" type="button" @click="showDemandForm = false">取消</button><button class="btn btn-secondary" type="submit" :disabled="demandSaving" @click="demandSubmitMode = 'draft'">保存草稿</button><button class="btn btn-primary" type="submit" :disabled="demandSaving" @click="demandSubmitMode = 'submit'">{{ demandSaving ? '处理中...' : '提交生产确认' }}</button></div>
        </form>
      </div>
    </div>
    <div v-else-if="tab === 'plans'" class="panel">
      <div class="panel-header"><div class="panel-title">生产计划</div><div class="master-actions"><button class="btn btn-sm btn-secondary" @click="loadExecution">刷新</button><button v-if="canManagePlans" class="btn btn-sm btn-primary" @click="openPlan">新建计划</button></div></div>
      <div v-if="showPlanForm" class="equipment-modal-mask" @click.self="closePlan">
        <form class="equipment-modal plan-editor-modal" @submit.prevent="submitPlan">
          <div class="equipment-modal-header">
            <div><div class="modal-title">新建生产计划</div></div>
            <button class="equipment-close" type="button" aria-label="关闭" @click="closePlan">×</button>
          </div>
          <div class="equipment-modal-body plan-editor-body">
            <div class="plan-section-title plan-editor-wide"><b>01</b> 需求与工艺</div>
            <label class="plan-editor-wide"><span>来源产品需求</span><select v-model="planDraft.demand_id" @change="choosePlanDemand"><option value="">自定义生产 / 试生产</option><option v-for="item in confirmedDemands" :key="item.id" :value="item.id">{{ item.name }} · {{ item.product?.name }} · 需求 {{ item.requested_volume_l }} L</option></select></label>
            <label v-if="!planDraft.demand_id" class="plan-editor-wide"><span><i>*</i>啤酒产品</span><select v-model="planDraft.product_tmpl_id" required @change="choosePlanProduct"><option value="">请选择啤酒产品</option><option v-for="item in products.filter(row => row.brew_item_type === 'finished_product')" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
            <div class="plan-recipe-picker plan-editor-wide">
              <span>选择配方来源 <i>*</i></span>
              <div class="plan-source-options"><button type="button" :class="{ selected: planDraft.process_source_type === 'base' }" @click="planDraft.process_source_type = 'base'; choosePlanProcessSource()"><strong>基础工艺</strong></button><button type="button" :class="{ selected: planDraft.process_source_type === 'production' }" @click="planDraft.process_source_type = 'production'; choosePlanProcessSource()"><strong>历史生产工艺</strong></button></div>
            </div>
            <label v-if="planDraft.process_source_type === 'base'" class="plan-editor-wide"><span><i>*</i>基础工艺版本</span><select v-model="planDraft.recipe_version_id" required :disabled="!selectedPlanProduct" @change="choosePlanRecipe"><option value="">{{ selectedPlanProduct ? (planRecipes.length ? '请选择与该产品关联的基础工艺' : '该产品暂无可用基础工艺') : '请先选择啤酒产品' }}</option><option v-for="item in planRecipes" :key="item.active_version_id" :value="item.active_version_id">{{ item.active_version_label }} · {{ item.equipment?.name || '未设置酿造系统' }}</option></select></label>
            <label v-else class="plan-editor-wide"><span><i>*</i>历史生产批次工艺</span><select v-model="planDraft.source_production_batch_id" required :disabled="!selectedPlanProduct" @change="choosePlanProductionRun"><option value="">{{ selectedPlanProduct ? (planSourceRuns.length ? '请选择历史生产批次' : '该产品暂无可复用的生产批次工艺') : '请先选择啤酒产品' }}</option><option v-for="item in planSourceRuns" :key="item.id" :value="item.id">{{ item.name }} · {{ item.source_version?.label }} · {{ item.brew_system?.name || item.equipment?.name || '酿造系统未记录' }} · {{ item.actual_volume_l || item.planned_volume_l }} L</option></select></label>
            <div v-if="selectedPlanSystem" class="plan-design-action plan-editor-wide"><div><strong>{{ selectedPlanSystem.name }}</strong><small>{{ selectedPlanSystem.factory_name }} · {{ planRecipeDesignSaved ? '已调整生产配方' : '使用来源配方' }}</small></div><button class="btn btn-sm btn-outline" type="button" :disabled="!Number(planDraft.planned_volume_l)" @click="openPlanRecipeEditor">查看 / 调整配方</button></div>
            <div class="plan-section-title plan-editor-wide"><b>02</b> 生产安排</div>
            <label><span><i>*</i>目标发酵罐</span><select v-model="planDraft.tank_id" required :disabled="!planDraft.factory_id"><option value="">{{ planDraft.factory_id ? '选择满足计划产量的发酵罐' : '先选择配方以确定厂区' }}</option><option v-for="item in filteredPlanTanks" :key="item.id" :value="item.id">{{ item.name }} · {{ item.capacity_l }} L</option></select></label>
            <label><span><i>*</i>计划产量（L）</span><input v-model.number="planDraft.planned_volume_l" type="number" min="0.001" step="0.001" required placeholder="输入本次实际计划酿造量" @input="ensurePlanTankCapacity"></label>
            <label><span><i>*</i>计划投料 / 开始时间</span><input v-model="planDraft.planned_start" type="datetime-local" required></label>
            <label><span><i>*</i>预计结束时间</span><input v-model="planDraft.planned_end" type="datetime-local" required></label>
            <label><span><i>*</i>糖化负责人</span><select v-model="planDraft.mash_owner_id" required :disabled="!planDraft.factory_id || !planAssignees.length"><option value="">{{ !planDraft.factory_id ? '先确定酿造系统和厂区' : (planAssignees.length ? '选择糖化操作人员' : '本厂区暂无可分配的操作人员') }}</option><option v-for="person in planAssignees" :key="person.id" :value="person.id">{{ person.name }}</option></select></label>
            <label><span><i>*</i>发酵负责人</span><select v-model="planDraft.fermentation_owner_id" required :disabled="!planDraft.factory_id || !planAssignees.length"><option value="">{{ !planDraft.factory_id ? '先确定酿造系统和厂区' : (planAssignees.length ? '选择发酵操作人员' : '本厂区暂无可分配的操作人员') }}</option><option v-for="person in planAssignees" :key="person.id" :value="person.id">{{ person.name }}</option></select></label>
            <section class="plan-stock-panel plan-editor-wide">
              <header><div class="plan-section-title"><b>03</b> 生产需求与库存对比</div><button v-if="planDraft.recipe_version_id && planDraft.planned_volume_l" class="btn btn-xs btn-outline" type="button" :disabled="planInventoryLoading" @click="checkPlanInventory">刷新库存</button></header>
              <div v-if="planInventoryLoading" class="empty">正在核对原料库存…</div>
              <div v-else-if="planInventoryError" class="master-error">{{ planInventoryError }}</div>
              <div v-else-if="!planInventory" class="empty">选择配方和计划产量后，自动核对所需原料</div>
              <template v-else><div v-if="planInventory.demand_inventory" class="plan-demand-stock"><div class="plan-stock-table"><table><thead><tr><th>产品</th><th>需求酒液</th><th>可用成品</th><th>待生产缺口</th><th>交付日期</th></tr></thead><tbody><tr><td>{{ planInventory.demand_inventory.product }}</td><td>{{ stockNumber(planInventory.demand_inventory.required_l) }} L</td><td>{{ stockNumber(planInventory.demand_inventory.available_l) }} L</td><td>{{ stockNumber(planInventory.demand_inventory.shortage_l) }} L</td><td>{{ planInventory.demand_inventory.delivery_date || '—' }}</td></tr></tbody></table></div><small v-if="planInventory.demand_inventory.unknown_packaging">部分历史库存缺少包装信息，未计入可用酒液。</small></div><div class="plan-stock-table"><table><thead><tr><th>原料</th><th>本次需要</th><th>可用库存</th><th>缺口</th><th>状态</th></tr></thead><tbody><tr v-for="row in planInventory.materials" :key="row.product.id"><td>{{ row.product.name }}</td><td>{{ stockNumber(row.required) }} {{ row.uom }}</td><td>{{ stockNumber(row.available) }} {{ row.uom }}</td><td :class="{ 'stock-shortage': row.shortage > 0 }">{{ row.shortage > 0 ? stockNumber(row.shortage) + ' ' + row.uom : '—' }}</td><td><span class="stock-result" :class="{ shortage: row.shortage > 0 }">{{ row.shortage > 0 ? '待备货' : '充足' }}</span></td></tr></tbody></table></div><div class="plan-stock-message" :class="{ shortage: planHasShortage }">{{ planHasShortage ? '原料不足，提交后生成备货需求，计划进入备货中。' : '原料充足，保存后可直接下发。' }}</div></template>
            </section>
            <div v-if="planError" class="master-error plan-editor-wide">{{ planError }}</div>
          </div>
          <div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="closePlan">取消</button><button class="btn btn-primary" type="submit" :disabled="planSaving || !planDraft.equipment_id || planInventoryLoading || !planInventory || !!planInventoryError">{{ planSaving ? '提交中…' : planHasShortage ? '保存并提交备货需求' : '保存生产计划' }}</button></div>
        </form>
      </div>
      <ProductionRecipeEditor :visible="showPlanRecipeEditor" :source-type="planDraft.process_source_type" :recipe-version-id="planDraft.recipe_version_id" :production-batch-id="planDraft.source_production_batch_id" :equipment-id="planDraft.equipment_id" :planned-volume="Number(planDraft.planned_volume_l)" :product-name="selectedPlanProduct?.name || ''" @close="showPlanRecipeEditor = false" @save="savePlanRecipeDesign" />
      <div class="panel-body plan-batch-grid"><button v-for="plan in productionPlans" :key="plan.id" class="plan-batch-card" type="button" @click="selectedPlanId = plan.id"><header><strong>{{ plan.batch?.name || plan.name }}</strong><StatusTag :text="planRows.find(row => row.id === plan.name)?.state || plan.state" /></header><h3>{{ plan.product?.name }}</h3><div class="plan-batch-facts"><span>{{ plan.planned_volume_l }} L · {{ plan.tank?.name }}</span><span>{{ plan.planned_start?.replace('T',' ').slice(0,16) }}</span></div><footer><span>糖化 {{ plan.mash_owner?.name || '待分配' }} · 发酵 {{ plan.fermentation_owner?.name || '待分配' }}</span><b>任务与流程 →</b></footer></button><div v-if="!productionPlans.length" class="empty">暂无生产计划</div></div>
      <ProductionPlanDetail :plan-id="selectedPlanId" @close="selectedPlanId = null" @changed="loadExecution" />
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

const AccountSettings = defineComponent({
  props: { permissions: { type: Array, default: () => [] } },
  template: `
    <div class="account-settings">
      <div class="account-tabs">
        <button v-for="tab in tabs" :key="tab.code" type="button" :class="{ active: activeTab === tab.code }" @click="activeTab = tab.code">{{ tab.label }}<small>{{ tabCount(tab.code) }}</small></button>
      </div>
      <div v-if="error" class="master-error">{{ error }}</div>
      <div v-if="notice" class="master-notice">{{ notice }}</div>

      <template v-if="activeTab === 'users'">
        <div class="account-toolbar"><div><strong>用户管理</strong><span>维护登录账号、组织归属、岗位、角色和厂区数据范围</span></div><div class="master-actions"><input v-model.trim="keyword" class="account-search" placeholder="搜索姓名或账号"><button class="btn btn-sm btn-secondary" type="button" @click="load">刷新</button><button class="btn btn-sm btn-primary" type="button" @click="openUser()">新增用户</button></div></div>
        <div v-if="loading" class="empty">正在加载...</div>
        <div v-else class="account-card-list">
          <article v-for="user in filteredUsers" :key="user.id" class="account-card">
            <div class="account-avatar">{{ user.name.slice(0,1) }}</div>
            <div class="account-card-main"><div class="account-card-title"><strong>{{ user.name }}</strong><span :class="['master-state', user.active ? 'enabled' : 'muted']">{{ user.active ? '启用' : '停用' }}</span><em v-if="user.is_organization_manager">负责人</em></div><div class="account-card-meta">{{ user.login }} · {{ user.organization_name || '未分配组织' }}<template v-if="user.job_title"> · {{ user.job_title }}</template></div><div class="account-tags"><span v-for="code in user.role_codes" :key="'d'+code">{{ roleName(code) }}</span><span v-for="code in user.inherited_role_codes" :key="'i'+code" class="inherited">{{ roleName(code) }}（组织）</span><i v-if="!user.effective_role_codes?.length">暂无角色</i></div></div>
            <div class="master-actions"><button class="btn btn-xs btn-outline" type="button" @click="openUser(user)">编辑</button><button class="btn btn-xs btn-outline" type="button" @click="resetPassword(user)">重置密码</button><button class="btn btn-xs btn-outline" type="button" @click="toggleUser(user)">{{ user.active ? '停用' : '启用' }}</button></div>
          </article>
          <div v-if="!filteredUsers.length" class="empty">没有符合条件的用户</div>
        </div>
      </template>

      <template v-else-if="activeTab === 'roles'">
        <div class="account-toolbar"><div><strong>角色管理</strong><span>角色使用系统权限模板，可配置名称、菜单、组织继承和直接用户</span></div><button class="btn btn-sm btn-secondary" type="button" @click="load">刷新</button></div>
        <div v-if="loading" class="empty">正在加载...</div>
        <div v-else class="role-card-grid"><article v-for="role in roleItems" :key="role.code" class="role-manage-card"><div class="role-card-head"><div class="role-card-icon">{{ role.label.slice(0,1) }}</div><div><strong>{{ role.label }}</strong><small>{{ role.code }}</small></div><span :class="['master-state', role.active ? 'enabled' : 'muted']">{{ role.active ? '启用' : '停用' }}</span></div><p>{{ role.description || '系统内置权限模板' }}</p><div class="role-card-stats"><span><b>{{ role.menu_codes.length }}</b> 个菜单</span><span><b>{{ role.organization_ids.length }}</b> 个组织</span><span><b>{{ role.effective_user_count }}</b> 位用户</span></div><div class="account-tags"><span v-for="name in role.organization_names" :key="name" class="inherited">{{ name }}</span><i v-if="!role.organization_names.length">未配置组织继承</i></div><button class="btn btn-sm btn-outline role-configure" type="button" @click="openRole(role)">配置角色</button></article></div>
      </template>

      <template v-else>
        <div class="account-toolbar"><div><strong>组织机构管理</strong><span>建立总部、厂区、部门、车间和班组层级；用户只能归属一个组织节点</span></div><div class="master-actions"><button class="btn btn-sm btn-secondary" type="button" @click="load">刷新</button><button class="btn btn-sm btn-primary" type="button" @click="openOrganization()">新增组织</button></div></div>
        <div class="organization-overview"><article><span>组织节点</span><strong>{{ organizationStats.total }}</strong><small>当前企业架构</small></article><article><span>厂区</span><strong>{{ organizationStats.factories }}</strong><small>生产地点</small></article><article><span>部门与车间</span><strong>{{ organizationStats.units }}</strong><small>业务组织单元</small></article><article><span>已归属用户</span><strong>{{ organizationStats.users }}</strong><small>按用户所属节点统计</small></article></div>
        <div v-if="loading" class="empty">正在加载...</div>
        <div v-else class="organization-list"><article v-for="item in organizationRows" :key="item.id" class="organization-row" :class="['org-type-' + item.type, { 'org-root': !item.parent_id }]" :style="{ '--org-depth': item.depth }"><div class="organization-tree-line"><button v-if="item.hasChildren" class="organization-toggle" type="button" :aria-label="collapsedOrganizations.has(item.id) ? '展开' : '折叠'" @click="toggleOrganization(item.id)">{{ collapsedOrganizations.has(item.id) ? '＋' : '−' }}</button><span v-else class="organization-toggle-placeholder"></span><span class="organization-type-icon">{{ organizationTypeIcon(item.type) }}</span></div><div class="organization-main"><div><strong>{{ item.name }}</strong><span :class="['master-state', item.active ? 'enabled' : 'muted']">{{ item.active ? '启用' : '停用' }}</span><span class="organization-kind">{{ organizationTypeLabel(item.type) }}</span></div></div><div class="organization-summary"><span class="organization-user-count"><b>{{ item.user_count }}</b> 位用户</span><span v-if="item.role_names.length" class="organization-role-tags"><i v-for="role in item.role_names" :key="role">{{ role }}</i></span></div><button class="btn btn-xs btn-outline" type="button" @click="openOrganization(item)">编辑</button></article></div>
      </template>

      <form v-if="editor === 'user'" class="equipment-modal-mask" @submit.prevent="saveUser"><div class="equipment-modal account-editor-modal"><div class="equipment-modal-header"><div><div class="modal-title">{{ editing ? '编辑用户' : '新增用户' }}</div><div class="modal-subtitle">基础信息、组织归属、角色和厂区范围集中配置</div></div><button class="equipment-close" type="button" @click="closeEditor">×</button></div><div class="account-editor-body"><section><h3>账号信息</h3><div class="account-form-grid"><label><span><i>*</i>姓名</span><input v-model.trim="draft.name" required></label><label><span><i>*</i>登录账号</span><input v-model.trim="draft.login" required></label><label v-if="!editing"><span><i>*</i>初始密码</span><input v-model="draft.password" type="password" minlength="8" required></label><label><span>岗位</span><input v-model.trim="draft.job_title" placeholder="如：糖化操作工"></label></div></section><section><h3>组织归属</h3><div class="account-form-grid"><label><span>所属组织</span><button class="org-picker-trigger" type="button" @click="openOrganizationPicker"><span>{{ selectedOrganization?.path || '暂不分配' }}</span><b>选择组织⌄</b></button></label><label class="account-check-line"><input v-model="draft.is_organization_manager" type="checkbox"><span>设为该组织负责人</span></label></div></section><section><h3>直接角色 <small>组织继承的角色会自动叠加</small></h3><div class="permission-check-grid"><label v-for="role in activeRoles" :key="role.code"><input v-model="draft.role_codes" type="checkbox" :value="role.code"><span><strong>{{ role.label }}</strong><small>{{ role.description || role.code }}</small></span></label></div></section><section><h3>厂区数据范围</h3><div class="permission-check-grid compact"><label v-for="factory in factories" :key="factory.id"><input v-model="draft.factory_ids" type="checkbox" :value="String(factory.id)"><span><strong>{{ factory.name }}</strong><small>{{ factory.code }}</small></span></label></div><label class="account-default-factory"><span>默认厂区</span><select v-model="draft.default_factory_id"><option value="">不设置</option><option v-for="factory in selectedFactories" :key="factory.id" :value="String(factory.id)">{{ factory.name }}</option></select></label></section><section v-if="draft.role_codes.includes('supplier')"><h3>供应商账号</h3><label><span><i>*</i>关联供应商</span><select v-model="draft.supplier_id" required><option value="">请选择供应商</option><option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option></select></label></section></div><div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="closeEditor">取消</button><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存用户' }}</button></div></div>
        <div v-if="organizationPickerOpen" class="org-picker-mask" @click.self="closeOrganizationPicker"><section class="org-picker-modal" role="dialog" aria-modal="true" aria-label="选择所属组织"><header class="org-picker-header"><div><strong>选择所属组织</strong><small>展开厂区查看部门、车间和班组</small></div><button type="button" class="equipment-close" @click="closeOrganizationPicker">×</button></header><div class="org-picker-current"><small>当前选择</small><strong>{{ selectedOrganization?.path || '暂不分配' }}</strong></div><div class="org-picker-tree"><button type="button" class="org-picker-none" :class="{ selected: !draft.organization_id }" @click="chooseOrganization('')">暂不分配组织</button><div v-for="item in organizationPickerRows" :key="item.id" class="org-picker-row" :style="{ '--picker-depth': item.depth }"><button v-if="item.hasChildren" type="button" class="org-picker-toggle" :aria-label="pickerCollapsedOrganizations.has(item.id) ? '展开' : '折叠'" @click="togglePickerOrganization(item.id)">{{ pickerCollapsedOrganizations.has(item.id) ? '＋' : '−' }}</button><span v-else class="org-picker-toggle-placeholder"></span><button type="button" class="org-picker-node" :class="{ selected: String(draft.organization_id) === String(item.id) }" @click="chooseOrganization(item.id)"><span class="organization-type-icon">{{ organizationTypeIcon(item.type) }}</span><span><strong>{{ item.name }}</strong><small>{{ organizationTypeLabel(item.type) }} · {{ item.code }}</small></span><b v-if="String(draft.organization_id) === String(item.id)">已选</b></button></div></div><footer class="org-picker-footer"><button type="button" class="btn btn-secondary" @click="closeOrganizationPicker">取消</button></footer></section></div></form>

      <form v-if="editor === 'role'" class="equipment-modal-mask" @submit.prevent="saveRole"><div class="equipment-modal account-editor-modal"><div class="equipment-modal-header"><div><div class="modal-title">配置角色 · {{ draft.name }}</div><div class="modal-subtitle">{{ draft.code }} · 权限模板固定，菜单和适用范围可配置</div></div><button class="equipment-close" type="button" @click="closeEditor">×</button></div><div class="account-editor-body"><section><h3>基本信息</h3><div class="account-form-grid"><label><span><i>*</i>角色名称</span><input v-model.trim="draft.name" required></label><label class="account-check-line"><input v-model="draft.active" type="checkbox"><span>启用该角色</span></label><label class="account-wide"><span>角色说明</span><textarea v-model.trim="draft.description" rows="2"></textarea></label></div></section><section><h3>菜单权限</h3><div class="permission-check-grid"><label v-for="menu in menuOptions" :key="menu.code"><input v-model="draft.menu_codes" type="checkbox" :value="menu.code"><span><strong>{{ menu.label }}</strong><small>{{ menu.code }}</small></span></label></div></section><section><h3>适用组织 <small>选择后，该组织及其下级组织用户自动继承此角色</small></h3><div class="permission-check-grid"><label v-for="item in activeOrganizations" :key="item.id"><input v-model="draft.organization_ids" type="checkbox" :value="String(item.id)"><span><strong>{{ item.name }}</strong><small>{{ item.path }}</small></span></label></div></section><section><h3>直接用户 <small>适合跨组织兼职或特殊授权</small></h3><div class="permission-check-grid"><label v-for="user in users" :key="user.id"><input v-model="draft.direct_user_ids" type="checkbox" :value="String(user.id)"><span><strong>{{ user.name }}</strong><small>{{ user.organization_name || user.login }}</small></span></label></div></section></div><div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="closeEditor">取消</button><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存角色配置' }}</button></div></div></form>

      <form v-if="editor === 'organization'" class="equipment-modal-mask" @submit.prevent="saveOrganization"><div class="equipment-modal material-category-modal"><div class="equipment-modal-header"><div><div class="modal-title">{{ editing ? '编辑组织' : '新增组织' }}</div><div class="modal-subtitle">维护组织层级和基础信息</div></div><button class="equipment-close" type="button" @click="closeEditor">×</button></div><div class="equipment-modal-body material-category-form"><label><span><i>*</i>组织名称</span><input v-model.trim="draft.name" required></label><label><span><i>*</i>组织编码</span><input v-model.trim="draft.code" required></label><label><span>上级组织</span><select v-model="draft.parent_id"><option value="">无上级组织</option><option v-for="item in organizationParentOptions" :key="item.id" :value="item.id">{{ item.path }}</option></select></label><label><span><i>*</i>组织类型</span><select v-model="draft.type" required><option v-for="type in organizationTypes" :key="type.value" :value="type.value">{{ type.label }}</option></select></label><label><span>地址</span><input v-model.trim="draft.address"></label><label v-if="editing" class="account-check-line"><input v-model="draft.active" type="checkbox"><span>启用该组织</span></label></div><div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="closeEditor">取消</button><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存组织' }}</button></div></div></form>
    </div>
  `,
  setup() {
    const tabs = [{ code: "users", label: "用户管理" }, { code: "roles", label: "角色管理" }, { code: "organizations", label: "组织机构" }];
    const menuOptions = Object.entries(pageMeta).map(([code, item]) => ({ code, label: item.title }));
    const organizationTypes = [{ value: "company", label: "总部" }, { value: "factory", label: "厂区" }, { value: "department", label: "部门" }, { value: "workshop", label: "车间" }, { value: "team", label: "班组" }];
    const activeTab = ref("users"), loading = ref(false), saving = ref(false), error = ref(""), notice = ref(""), keyword = ref(""), editor = ref(""), editing = ref(null), draft = ref({});
    const users = ref([]), roleItems = ref([]), organizations = ref([]), factories = ref([]), suppliers = ref([]);
    const collapsedOrganizations = ref(new Set());
    const organizationPickerOpen = ref(false), pickerCollapsedOrganizations = ref(new Set());
    const activeRoles = computed(() => roleItems.value.filter(item => item.active || draft.value.role_codes?.includes(item.code)));
    const activeOrganizations = computed(() => organizations.value.filter(item => item.active || item.id === draft.value.organization_id || draft.value.organization_ids?.includes(String(item.id))));
    const selectedOrganization = computed(() => activeOrganizations.value.find(item => String(item.id) === String(draft.value.organization_id)) || null);
    const filteredUsers = computed(() => { const value = keyword.value.toLowerCase(); return users.value.filter(item => !value || [item.name,item.login,item.organization_name,item.job_title].some(field => String(field || '').toLowerCase().includes(value))); });
    const selectedFactories = computed(() => factories.value.filter(item => draft.value.factory_ids?.includes(String(item.id))));
    const organizationParentOptions = computed(() => { if(!editing.value) return organizations.value.filter(item=>item.active); const blocked=new Set([editing.value.id]); let changed=true; while(changed){ changed=false; organizations.value.forEach(item=>{ if(!blocked.has(item.id)&&blocked.has(item.parent_id)){ blocked.add(item.id); changed=true; } }); } return organizations.value.filter(item=>item.active&&!blocked.has(item.id)); });
    const organizationRows = computed(() => { const byParent = new Map(); organizations.value.forEach(item => { const key = String(item.parent_id || 'root'); if (!byParent.has(key)) byParent.set(key, []); byParent.get(key).push(item); }); const rows=[]; const visit=(parent,depth)=>{ (byParent.get(String(parent || 'root')) || []).sort((a,b)=>a.sequence-b.sequence||a.name.localeCompare(b.name,'zh-CN')).forEach(item=>{ const children=byParent.get(String(item.id))||[]; rows.push({...item,depth,hasChildren:children.length>0}); if(!collapsedOrganizations.value.has(item.id)) visit(item.id,depth+1); }); }; visit(null,0); return rows; });
    const organizationStats = computed(() => ({ total: organizations.value.length, factories: organizations.value.filter(item=>item.type==='factory').length, units: organizations.value.filter(item=>['department','workshop','team'].includes(item.type)).length, users: organizations.value.reduce((sum,item)=>sum+Number(item.user_count||0),0) }));
    const organizationPickerRows = computed(() => { const byParent = new Map(); activeOrganizations.value.forEach(item => { const key=String(item.parent_id||'root'); if(!byParent.has(key)) byParent.set(key,[]); byParent.get(key).push(item); }); const rows=[]; const visit=(parent,depth)=>{ (byParent.get(String(parent||'root'))||[]).sort((a,b)=>a.sequence-b.sequence||a.name.localeCompare(b.name,'zh-CN')).forEach(item=>{ const children=byParent.get(String(item.id))||[]; rows.push({...item,depth,hasChildren:children.length>0}); if(!pickerCollapsedOrganizations.value.has(item.id)) visit(item.id,depth+1); }); }; visit(null,0); return rows; });
    function toggleOrganization(id){ const next=new Set(collapsedOrganizations.value); if(next.has(id)) next.delete(id); else next.add(id); collapsedOrganizations.value=next; }
    function openOrganizationPicker(){ const children=new Set(activeOrganizations.value.filter(item=>item.parent_id).map(item=>String(item.parent_id))); pickerCollapsedOrganizations.value=new Set(activeOrganizations.value.filter(item=>children.has(String(item.id))&&item.type!=='company').map(item=>item.id)); organizationPickerOpen.value=true; }
    function closeOrganizationPicker(){ organizationPickerOpen.value=false; }
    function togglePickerOrganization(id){ const next=new Set(pickerCollapsedOrganizations.value); if(next.has(id)) next.delete(id); else next.add(id); pickerCollapsedOrganizations.value=next; }
    function chooseOrganization(id){ draft.value.organization_id=String(id||''); closeOrganizationPicker(); }
    async function load() { loading.value=true; error.value=""; try { [users.value,roleItems.value,organizations.value,factories.value,suppliers.value] = await Promise.all([brewApi.listAdminUsers({page_size:100}),brewApi.listAdminRoles(),brewApi.listAdminOrganizations(),brewApi.listMaster("factories",{page_size:100,active:true}),brewApi.listMaster("suppliers",{page_size:200,active:true})]); const children=new Set(organizations.value.filter(item=>item.parent_id).map(item=>String(item.parent_id))); const depths=new Map(); organizations.value.forEach(item=>{let depth=0,parent=item.parent_id; while(parent){depth++; parent=organizations.value.find(node=>String(node.id)===String(parent))?.parent_id||null;} depths.set(String(item.id),depth);}); collapsedOrganizations.value=new Set(organizations.value.filter(item=>children.has(String(item.id))&&(depths.get(String(item.id))||0)>=1).map(item=>item.id)); } catch(cause){ error.value=cause.message||"账号配置加载失败。"; } finally { loading.value=false; } }
    function tabCount(code){ return code==='users'?users.value.length:code==='roles'?roleItems.value.length:organizations.value.length; }
    function roleName(code){ return roleItems.value.find(item=>item.code===code)?.label || code; }
    function closeEditor(){ editor.value=""; editing.value=null; draft.value={}; organizationPickerOpen.value=false; }
    function openUser(user=null){ editing.value=user; draft.value=user?{...user,role_codes:[...(user.role_codes||[])],factory_ids:[...(user.factory_ids||[])],default_factory_id:user.default_factory_id||"",organization_id:user.organization_id||"",password:""}:{name:"",login:"",password:"",job_title:"",organization_id:"",is_organization_manager:false,role_codes:[],factory_ids:[],default_factory_id:"",supplier_id:""}; editor.value='user'; error.value=""; }
    function openRole(role){ editing.value=role; draft.value={...role,name:role.label,menu_codes:[...(role.menu_codes||[])],organization_ids:[...(role.organization_ids||[])],direct_user_ids:[...(role.direct_user_ids||[])]}; editor.value='role'; error.value=""; }
    function openOrganization(item=null){ editing.value=item; draft.value=item?{...item,parent_id:item.parent_id||""}:{name:"",code:"",parent_id:"",type:"department",address:"",active:true,sequence:10}; editor.value='organization'; error.value=""; }
    async function saveUser(){ saving.value=true; error.value=""; try { const payload={name:draft.value.name,login:draft.value.login,organization_id:draft.value.organization_id||null,job_title:draft.value.job_title||"",is_organization_manager:!!draft.value.is_organization_manager,supplier_id:draft.value.supplier_id||null}; let user; if(editing.value){ user=await brewApi.updateAdminUser(editing.value.id,{...payload,version:editing.value.version}); user=await brewApi.updateAdminUserRoles(editing.value.id,{role_codes:draft.value.role_codes,version:user.version}); await brewApi.updateAdminUserDataScopes(editing.value.id,{factory_ids:draft.value.factory_ids,default_factory_id:draft.value.default_factory_id||null,version:user.version}); } else { user=await brewApi.createAdminUser({...payload,password:draft.value.password,role_codes:draft.value.role_codes}); if(draft.value.factory_ids.length) await brewApi.updateAdminUserDataScopes(user.id,{factory_ids:draft.value.factory_ids,default_factory_id:draft.value.default_factory_id||null,version:user.version}); } notice.value="用户配置已保存。"; closeEditor(); await load(); } catch(cause){ error.value=cause.message||"用户保存失败。"; } finally { saving.value=false; } }
    async function saveRole(){ saving.value=true; error.value=""; try { await brewApi.updateAdminRole(draft.value.code,{name:draft.value.name,description:draft.value.description,active:draft.value.active,menu_codes:draft.value.menu_codes,organization_ids:draft.value.organization_ids,direct_user_ids:draft.value.direct_user_ids,version:editing.value.version}); notice.value="角色配置已保存，组织用户权限已同步。"; closeEditor(); await load(); } catch(cause){ error.value=cause.message||"角色保存失败。"; } finally { saving.value=false; } }
    async function saveOrganization(){ saving.value=true; error.value=""; try { const payload={name:draft.value.name,code:draft.value.code,parent_id:draft.value.parent_id||null,type:draft.value.type,address:draft.value.address||"",active:draft.value.active,sequence:draft.value.sequence||10}; if(editing.value) await brewApi.updateAdminOrganization(editing.value.id,{...payload,version:editing.value.version}); else await brewApi.createAdminOrganization(payload); notice.value="组织机构已保存。"; closeEditor(); await load(); } catch(cause){ error.value=cause.message||"组织保存失败。"; } finally { saving.value=false; } }
    async function toggleUser(user){ if(user.active && !window.confirm(`确定停用“${user.name}”吗？停用后其登录会话将失效。`)) return; try { await brewApi.adminUserAction(user.id,user.active?'disable':'enable',user.version); await load(); } catch(cause){ error.value=cause.message||"用户状态更新失败。"; } }
    async function resetPassword(user){ const password=window.prompt(`为“${user.name}”设置新密码（至少 8 位）`); if(!password) return; if(password.length<8){ error.value="新密码至少 8 位。"; return; } try { await brewApi.resetAdminUserPassword(user.id,{password}); notice.value="密码已重置，原登录会话已失效。"; } catch(cause){ error.value=cause.message||"密码重置失败。"; } }
    function organizationTypeLabel(type){ return organizationTypes.find(item=>item.value===type)?.label||type; }
    function organizationTypeIcon(type){ return ({company:'总',factory:'厂',department:'部',workshop:'间',team:'组'})[type]||'组'; }
    onMounted(load);
    return { tabs,menuOptions,organizationTypes,activeTab,loading,saving,error,notice,keyword,editor,editing,draft,users,roleItems,organizations,factories,suppliers,activeRoles,activeOrganizations,selectedOrganization,filteredUsers,selectedFactories,organizationParentOptions,organizationRows,organizationStats,collapsedOrganizations,organizationPickerOpen,pickerCollapsedOrganizations,organizationPickerRows,load,tabCount,roleName,closeEditor,openUser,openRole,openOrganization,openOrganizationPicker,closeOrganizationPicker,togglePickerOrganization,chooseOrganization,saveUser,saveRole,saveOrganization,toggleOrganization,toggleUser,resetPassword,organizationTypeLabel,organizationTypeIcon };
  }
});

const SettingsPage = defineComponent({
  components: { AccountSettings, PackagingMaterialsPage },
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
        <div v-if="!['accounts','packaging_materials'].includes(selected)" class="panel-header">
          <div>
            <div class="panel-title">{{ currentResource.label }}</div>
            <div class="panel-subtitle">{{ currentResource.desc }}</div>
          </div>
          <div class="master-actions">
            <button class="btn btn-sm btn-secondary" type="button" @click="load">刷新</button>
            <button v-if="canCreate && !(selected === 'equipment' && equipmentFactory)" class="btn btn-sm btn-primary" type="button" @click.prevent.stop="isCategoryResource(selected) ? startCategoryCreate() : startCreate()">{{ isCategoryResource(selected) && materialCategoryParent ? '新增小类' : '新增' }}</button>
          </div>
        </div>
        <AccountSettings v-if="selected === 'accounts'" :permissions="permissions" /><PackagingMaterialsPage v-else-if="selected === 'packaging_materials'" style="padding:20px" />
        <template v-else>
        <div v-if="error" class="master-error">{{ error }}</div>
        <div v-if="categoryNotice" class="master-notice">{{ categoryNotice }}</div>
        <form v-if="creating && selected === 'equipment'" class="equipment-modal-mask" @submit.prevent="submitCreate">
          <div class="equipment-modal">
            <div class="equipment-modal-header">
              <div>
                <div class="modal-title">{{ editingItem ? '编辑酿造系统' : '新增酿造系统' }}</div>
                <div class="modal-subtitle">维护糖化参数，并配置该系统下的发酵罐和清酒罐</div>
              </div>
              <button class="equipment-close" type="button" aria-label="关闭" @click="creating = false">×</button>
            </div>
            <div class="equipment-modal-body">
              <label v-if="false">
                <span><i>*</i>所属工厂</span>
                <select v-model="draft.brew_factory_id" required>
                  <option value="">请选择工厂</option>
                  <option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option>
                </select>
              </label>
              <label v-if="false">
                <span><i>*</i>设备类型</span>
                <div class="equipment-type-control">
                  <select v-model="draft.brew_equipment_type" required @change="handleEquipmentTypeChange">
                    <option value="">请选择设备类型</option>
                    <option v-for="item in equipmentTypeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                  <input v-model.trim="newEquipmentType" placeholder="请输入">
                  <button class="btn btn-secondary" type="button" @click="addEquipmentType">添加类型</button>
                </div>
              </label>
              <label>
                <span><i>*</i>酿造系统名称</span>
                <input v-model.trim="draft.name" maxlength="100" required placeholder="例如：铜陵厂 · 5000L 酿造系统">
              </label>
              <label>
                <span><i>*</i>糖化最大体积(L)</span>
                <div class="equipment-number-control">
                  <button type="button" @click="adjustEquipmentNumber('brew_capacity_l', -1)">−</button>
                  <input v-model.number="draft.brew_capacity_l" type="number" min="0" step="1" required>
                  <em>L</em>
                  <button type="button" @click="adjustEquipmentNumber('brew_capacity_l', 1)">＋</button>
                </div>
              </label>
              <template v-if="['fermentation', 'bright'].includes(draft.brew_equipment_type)">
                <label>
                  <span><i>*</i>数量</span>
                  <div class="equipment-number-control equipment-count-control">
                    <button type="button" @click="adjustTankCount(-1)">−</button>
                    <input v-model.number="draft.brew_tank_count" type="number" min="1" step="1" required @input="syncTankSpecs">
                    <em>个</em>
                    <button type="button" @click="adjustTankCount(1)">＋</button>
                  </div>
                </label>
                <div class="tank-specs-section">
                  <div class="equipment-section-title">{{ draft.brew_equipment_type === 'fermentation' ? '发酵罐配置' : '清酒罐配置' }}</div>
                  <div v-for="(tank, index) in draft.tank_specs" :key="index" class="tank-spec-row">
                    <span class="tank-spec-index">{{ index + 1 }}</span>
                    <input v-model.trim="tank.name" placeholder="罐号，如 F-01" required>
                    <input :value="tank.location_name || autoTankLocation(tank, index)" readonly placeholder="保存后自动生成库存位置">
                    <button v-if="draft.tank_specs.length > 1" type="button" class="tank-remove" @click="removeTankSpec(index)">×</button>
                  </div>
                  <button type="button" class="tank-add" @click="addTankSpec">＋ 添加罐体</button>
                </div>
              </template>
              <template v-if="draft.brew_equipment_type === 'mash'">
                <div class="equipment-section-title">配套罐体</div>
                <div class="equipment-section-hint">罐体隶属于当前酿造系统；库存位置会根据厂区、系统名称和罐号自动生成。</div>
                <div class="system-tank-group">
                  <div class="system-tank-group-header"><strong>发酵罐</strong><span>用于啤酒发酵与成熟</span></div>
                  <div class="system-tank-specs">
                    <div v-for="tank in draft.tank_specs.filter(item => item.tank_type === 'fermentation')" :key="tank._key" class="system-tank-row">
                      <span class="tank-spec-index">发</span>
                      <input v-model.trim="tank.name" placeholder="罐号，如 F-01" required>
                      <input v-model.number="tank.capacity_l" type="number" min="1" placeholder="容量(L)" required>
                      <input v-model.trim="tank.location_name" :placeholder="autoTankLocation(tank, draft.tank_specs.indexOf(tank))">
                      <button type="button" class="tank-remove" aria-label="删除发酵罐" @click="removeSystemTank(tank)">×</button>
                    </div>
                    <button type="button" class="tank-add" @click="addSystemTank('fermentation')">＋ 添加发酵罐</button>
                  </div>
                </div>
                <div class="system-tank-group">
                  <div class="system-tank-group-header"><strong>清酒罐</strong><span>用于储酒与待灌装</span></div>
                  <div class="system-tank-specs">
                    <div v-for="tank in draft.tank_specs.filter(item => item.tank_type === 'bright')" :key="tank._key" class="system-tank-row">
                      <span class="tank-spec-index">清</span>
                      <input v-model.trim="tank.name" placeholder="罐号，如 BBT-01" required>
                      <input v-model.number="tank.capacity_l" type="number" min="1" placeholder="容量(L)" required>
                      <input v-model.trim="tank.location_name" :placeholder="autoTankLocation(tank, draft.tank_specs.indexOf(tank))">
                      <button type="button" class="tank-remove" aria-label="删除清酒罐" @click="removeSystemTank(tank)">×</button>
                    </div>
                    <button type="button" class="tank-add" @click="addSystemTank('bright')">＋ 添加清酒罐</button>
                  </div>
                </div>
              </template>
              <template v-if="draft.brew_equipment_type === 'mash'">
                <div class="equipment-section-title">技术参数</div>
                <div class="equipment-tech-grid">
                <label><span>糖化效率(%)</span><div class="equipment-number-control"><button type="button" @click="adjustEquipmentNumber('brew_saccharification_efficiency', -1)">−</button><input v-model.number="draft.brew_saccharification_efficiency" type="number" min="0" step="0.1"><button type="button" @click="adjustEquipmentNumber('brew_saccharification_efficiency', 1)">＋</button></div></label>
                <label><span>筛板余水(L)</span><div class="equipment-number-control"><button type="button" @click="adjustEquipmentNumber('brew_screen_water_l', -1)">−</button><input v-model.number="draft.brew_screen_water_l" type="number" min="0" step="0.1"><button type="button" @click="adjustEquipmentNumber('brew_screen_water_l', 1)">＋</button></div></label>
                <label><span>回旋时间(分钟)</span><div class="equipment-number-control"><button type="button" @click="adjustEquipmentNumber('brew_whirlpool_time_min', -1)">−</button><input v-model.number="draft.brew_whirlpool_time_min" type="number" min="0" step="1"><button type="button" @click="adjustEquipmentNumber('brew_whirlpool_time_min', 1)">＋</button></div></label>
                <label><span>过滤速度(L/min)</span><div class="equipment-number-control"><button type="button" @click="adjustEquipmentNumber('brew_filtration_speed_l_min', -1)">−</button><input v-model.number="draft.brew_filtration_speed_l_min" type="number" min="0" step="0.1"><button type="button" @click="adjustEquipmentNumber('brew_filtration_speed_l_min', 1)">＋</button></div></label>
                </div>
              </template>
            </div>
            <div class="equipment-modal-footer">
              <div v-if="error" class="master-error equipment-save-error" role="alert">{{ error }}</div>
              <button class="btn btn-secondary" type="button" @click="creating = false">取消</button>
              <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
            </div>
          </div>
        </form>
        <form v-else-if="creating && isCategoryResource(selected)" class="equipment-modal-mask" @submit.prevent="submitCreate">
          <div class="equipment-modal material-category-modal">
            <div class="equipment-modal-header">
              <div>
                <div class="modal-title">{{ editingItem ? (isBeerCategory(selected) ? '编辑啤酒分类' : '编辑原料种类') : (materialCategoryParent ? '新增小类' : (isBeerCategory(selected) ? '新增啤酒大类' : '新增原料大类')) }}</div>
                <div class="modal-subtitle">{{ materialCategoryParent ? '所属大类：' + materialCategoryParent.name : (isBeerCategory(selected) ? '先建立啤酒大类，再配置该大类下的小分类' : '先建立原料大类，再配置该大类下的小类') }}</div>
              </div>
              <button class="equipment-close" type="button" aria-label="关闭" @click="creating = false">×</button>
            </div>
            <div class="equipment-modal-body material-category-form">
              <label><span><i>*</i>名称</span><input v-model.trim="draft.name" maxlength="100" required placeholder="请输入名称"></label>
              <div class="auto-code-field"><span>系统编码</span><strong>{{ draft.code || '保存时自动生成' }}</strong><small>由系统自动生成，不可编辑</small></div>
              <label v-if="!materialCategoryParent && !isBeerCategory(selected)"><span><i>*</i>原料大类</span><select v-model="draft.material_group" required><option value="">请选择大类</option><option v-for="option in materialGroupOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
              <div v-else-if="materialCategoryParent" class="material-category-parent"><span>所属大类</span><strong>{{ materialCategoryParent.name }}</strong></div>
              <label v-if="!isBeerCategory(selected) && materialCategoryParent?.material_group === 'packaging'"><span>包装表单类型</span><select v-model="draft.brew_packaging_type" required><option value="">请选择</option><option v-for="[code,label] in [['bottle','玻璃瓶'],['can','易拉罐'],['keg','桶'],['cap','瓶盖'],['can_lid','罐盖'],['keg_seal','桶盖 / 封签'],['label','标签'],['carton','纸箱 / 礼盒'],['divider','隔板 / 纸托'],['film','缠绕膜'],['strap','打包带']]" :key="code" :value="code">{{ label }}</option></select></label><label><span>排序</span><input v-model.number="draft.sequence" type="number" min="0" step="1"></label>
            </div>
            <div class="equipment-modal-footer">
              <button class="btn btn-secondary" type="button" @click="creating = false">取消</button>
              <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : (editingItem ? '保存' : '保存并配置小类') }}</button>
            </div>
          </div>
        </form>
        <form v-else-if="creating && selected === 'warehouses'" class="equipment-modal-mask" @submit.prevent="submitCreate">
          <div class="equipment-modal material-category-modal">
            <div class="equipment-modal-header"><div><div class="modal-title">{{ editingItem ? '编辑仓库' : '新增仓库' }}</div><div class="modal-subtitle">{{ editingItem ? '修改仓库基础信息' : '为厂区增加一个独立仓库' }}</div></div><button class="equipment-close" type="button" @click="creating = false">×</button></div>
            <div class="equipment-modal-body material-category-form"><label><span><i>*</i>所属厂区</span><select v-model="draft.brew_factory_id" required :disabled="!!editingItem"><option value="">请选择厂区</option><option v-for="item in factories" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span><i>*</i>仓库类型</span><select v-model="draft.brew_warehouse_type" required><option value="">请选择仓库类型</option><option v-for="option in warehouseTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label><label><span><i>*</i>仓库名称</span><input v-model.trim="draft.name" maxlength="100" required placeholder="例如：原料仓库"></label><div class="auto-code-field"><span>仓库编码</span><strong>{{ draft.code || '保存时自动生成' }}</strong><small>由系统自动生成，不可编辑</small></div></div>
            <div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="creating = false">取消</button><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : (editingItem ? '保存修改' : '保存') }}</button></div>
          </div>
        </form>
        <form v-else-if="creating && selected === 'suppliers'" class="equipment-modal-mask" @submit.prevent="submitCreate">
          <div class="equipment-modal supplier-editor-modal">
            <div class="equipment-modal-header"><div><div class="modal-title">{{ editingItem ? '编辑供应商' : '新增供应商' }}</div><div class="modal-subtitle">维护供应商主体、付款信息和登录账号</div></div><button class="equipment-close" type="button" @click="creating = false">×</button></div>
            <div class="supplier-editor-body">
              <section class="supplier-editor-section"><h3>基本信息</h3><div class="supplier-editor-grid"><label><span><i>*</i>供应商名称</span><input v-model.trim="draft.name" maxlength="100" required placeholder="请输入供应商名称"></label><label><span>供应商编码</span><input :value="draft.brew_supplier_code || '系统自动生成'" disabled></label><label><span><i>*</i>联系人</span><input v-model.trim="draft.brew_contact_name" maxlength="50" required placeholder="请输入联系人姓名"></label><label><span><i>*</i>联系电话</span><input v-model.trim="draft.phone" maxlength="30" required placeholder="请输入手机号或座机号"></label><label><span><i>*</i>电子邮箱</span><input v-model.trim="draft.email" type="email" maxlength="100" required placeholder="请输入电子邮箱"></label><label><span><i>*</i>状态</span><div class="supplier-status-control"><label><input v-model="draft.active" type="radio" :value="true">启用</label><label><input v-model="draft.active" type="radio" :value="false">停用</label></div></label><label class="supplier-editor-wide"><span><i>*</i>地址</span><input v-model.trim="draft.street" maxlength="200" required placeholder="请输入详细地址"></label><label class="supplier-editor-wide"><span>备注</span><textarea v-model.trim="draft.comment" maxlength="500" rows="3" placeholder="请输入备注信息（可选）"></textarea></label></div></section>
              <section class="supplier-editor-section"><h3>付款信息</h3><div class="supplier-editor-grid"><label><span><i>*</i>统一社会信用代码</span><input v-model.trim="draft.brew_social_credit_code" maxlength="18" required placeholder="请输入统一社会信用代码"></label><label><span><i>*</i>账户名</span><input v-model.trim="draft.brew_bank_account_name" maxlength="100" required placeholder="请输入账户名"></label><label><span><i>*</i>银行名称</span><input v-model.trim="draft.brew_bank_name" maxlength="100" required placeholder="请输入银行名称"></label><label><span><i>*</i>分行名称</span><input v-model.trim="draft.brew_bank_branch" maxlength="100" required placeholder="请输入分行名称"></label><label><span><i>*</i>银行账号</span><input v-model.trim="draft.brew_bank_account" maxlength="50" required placeholder="请输入银行账号"></label></div></section>
              <section class="supplier-editor-section"><h3>登录账号 <small>{{ editingItem && editingItem.account?.login ? '账号保持不变；新密码留空则不修改' : editingItem ? '可补充创建供应商登录账号' : '可选；填写后供应商可登录商品录入端' }}</small></h3><div class="supplier-editor-grid"><div v-if="editingItem && editingItem.account?.login" class="supplier-account-display"><span>当前登录账号</span><strong>{{ editingItem.account.login }}</strong></div><label v-else><span>登录账号</span><input v-model.trim="draft.supplier_account_login" maxlength="100" placeholder="请输入登录账号"></label><label><span>{{ editingItem && editingItem.account?.login ? '设置新密码' : '初始密码' }}</span><input v-model="draft.supplier_account_password" type="password" minlength="8" :placeholder="editingItem && editingItem.account?.login ? '留空保持原密码；新密码至少 8 位' : '至少 8 位'"></label></div></section>
            </div>
            <div class="equipment-modal-footer"><div v-if="error" class="master-error">{{ error }}</div><button class="btn btn-secondary" type="button" @click="creating = false">取消</button><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button></div>
          </div>
        </form>
        <form v-else-if="creating && selected === 'products'" class="equipment-modal-mask" @click.self="closeProductEditor" @submit.prevent="submitCreate">
          <section class="equipment-modal product-editor-modal" role="dialog" aria-modal="true" :aria-label="editingItem ? '编辑产品' : '新建产品'">
            <div class="equipment-modal-header">
              <div><div class="modal-title">{{ editingItem ? '编辑产品' : '新建产品' }}</div><div class="modal-subtitle">维护啤酒产品资料；包装容量在“包装规格”中单独维护</div></div>
              <button class="equipment-close" type="button" aria-label="关闭" @click="closeProductEditor">×</button>
            </div>
            <div class="equipment-modal-body product-editor-body">
              <section class="product-editor-section">
                <h3>产品信息</h3>
                <div class="product-editor-grid">
                  <label class="product-editor-wide"><span><i>*</i>产品名称</span><input v-model.trim="draft.name" maxlength="100" required placeholder="例如：经典拉格"></label>
                  <label><span><i>*</i>产品类型</span><select v-model="draft.brew_item_type"><option value="finished_product">成品啤酒</option><option value="semi_finished">半成品酒液</option></select></label>
                  <label><span>产品编码</span><input v-model.trim="draft.default_code" maxlength="64" placeholder="可选，留空由系统管理"></label>
                  <template v-if="draft.brew_item_type === 'finished_product'">
                    <label><span><i>*</i>啤酒大类</span><select v-model="draft.brew_beer_category_id" required @change="draft.brew_beer_subcategory_id = ''"><option value="">请选择大类</option><option v-for="category in materialCategories.filter(item => !item.parent_id)" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select></label>
                    <label><span><i>*</i>啤酒小类</span><select v-model="draft.brew_beer_subcategory_id" required :disabled="!draft.brew_beer_category_id"><option value="">{{ draft.brew_beer_category_id ? '请选择小类' : '请先选择大类' }}</option><option v-for="category in productBeerSubcategories" :key="category.id" :value="String(category.id)">{{ category.name }}</option></select></label>
                  </template>
                  <label class="product-editor-wide"><span>产品说明</span><textarea v-model.trim="draft.brew_specification" rows="3" maxlength="200" placeholder="可填写产品特点或补充说明；不要填写酿造批量或包装规格"></textarea></label>
                </div>
                <p v-if="draft.brew_item_type === 'finished_product'" class="product-editor-note">配方预计 OG、酒精度、色度和 IBU 属于配方版本数据；桶、瓶、罐的容量属于包装规格。</p>
                <p v-else class="product-editor-note">半成品用于记录未包装的酒液，不需要设置啤酒销售分类。</p>
              </section>
              <div v-if="error" class="master-error" role="alert">{{ error }}</div>
            </div>
            <div class="equipment-modal-footer">
              <button class="btn btn-secondary" type="button" @click="closeProductEditor">取消</button>
              <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : editingItem ? '保存修改' : '保存产品' }}</button>
            </div>
          </section>
        </form>
        <div v-if="productDetail" class="equipment-modal-mask" @click.self="productDetail = null">
          <section class="equipment-modal product-editor-modal" role="dialog" aria-modal="true" aria-label="产品详情">
            <div class="equipment-modal-header"><div><div class="modal-title">{{ productDetail.name }}</div><div class="modal-subtitle">产品主数据详情</div></div><button class="equipment-close" type="button" aria-label="关闭详情" @click="productDetail = null">×</button></div>
            <div class="equipment-modal-body detail-grid">
              <div class="detail-field"><span>产品类型</span><strong>{{ productDetail.brew_item_type === 'finished_product' ? '成品啤酒' : '半成品酒液' }}</strong></div>
              <div class="detail-field"><span>产品编码</span><strong>{{ productDetail.default_code || '—' }}</strong></div>
              <template v-if="productDetail.brew_item_type === 'finished_product'">
                <div class="detail-field"><span>啤酒大类</span><strong>{{ productDetail.brew_beer_category_id?.name || '—' }}</strong></div>
                <div class="detail-field"><span>啤酒小类</span><strong>{{ productDetail.brew_beer_subcategory_id?.name || '—' }}</strong></div>
              </template>
              <div class="detail-field detail-field-wide"><span>产品说明</span><strong>{{ productDetail.brew_specification || '—' }}</strong></div>
              <div class="detail-field"><span>状态</span><strong>{{ productDetail.active === false ? '已归档' : '启用' }}</strong></div>
            </div>
            <div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="productDetail = null">关闭</button><button v-if="canCreate" class="btn btn-primary" type="button" @click="startEdit(productDetail)">编辑产品</button></div>
          </section>
        </div>
        <form v-else-if="creating && selected === 'users'" class="equipment-modal-mask" @submit.prevent="submitCreate">
          <div class="equipment-modal material-category-modal"><div class="equipment-modal-header"><div><div class="modal-title">{{ editingItem ? '编辑账号' : '新增账号' }}</div><div class="modal-subtitle">统一管理登录账号、角色和启停状态</div></div><button class="equipment-close" type="button" @click="creating = false">×</button></div><div class="equipment-modal-body material-category-form"><label><span><i>*</i>姓名</span><input v-model.trim="draft.name" required></label><label><span><i>*</i>登录账号</span><input v-model.trim="draft.login" required></label><label v-if="!editingItem"><span><i>*</i>初始密码</span><input v-model="draft.password" type="password" minlength="8" required></label><label><span><i>*</i>角色</span><select v-model="draft.role_code" required><option value="">请选择角色</option><option v-for="role in accountRoles" :key="role.code" :value="role.code">{{ role.label }}</option></select></label><label v-if="draft.role_code === 'supplier'"><span><i>*</i>关联供应商</span><select v-model="draft.supplier_id" required><option value="">请选择供应商</option><option v-for="supplier in supplierItems" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option></select></label></div><div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="creating = false">取消</button><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : '保存账号' }}</button></div></div>
        </form>
        <form v-if="locationCreating" class="equipment-modal-mask" @submit.prevent="submitLocation">
          <div class="equipment-modal material-category-modal">
            <div class="equipment-modal-header"><div><div class="modal-title">{{ locationEditing ? '编辑库位' : '新增库位' }}</div><div class="modal-subtitle">{{ warehouseSelected?.name }} · 设置仓库内的存放位置</div></div><button class="equipment-close" type="button" @click="locationCreating = false">×</button></div>
            <div class="equipment-modal-body material-category-form"><label><span><i>*</i>库位名称</span><input v-model.trim="locationDraft.name" maxlength="100" required placeholder="例如：麦芽区、发酵罐 F-01"></label><label><span><i>*</i>库位类型</span><select v-model="locationDraft.brew_location_type" required><option value="">请选择类型</option><option v-for="option in locationTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label></div>
            <div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="locationCreating = false">取消</button><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? '保存中...' : (locationEditing ? '保存修改' : '保存库位') }}</button></div>
          </div>
        </form>
        <div v-if="locationDetail" class="equipment-modal-mask" @click.self="locationDetail = null">
          <div class="equipment-modal material-category-modal">
            <div class="equipment-modal-header"><div><div class="modal-title">库位详情</div><div class="modal-subtitle">查看库位基础信息</div></div><button class="equipment-close" type="button" @click="locationDetail = null">×</button></div>
            <div class="equipment-modal-body detail-grid"><div class="detail-field"><span>所属厂区</span><strong>{{ warehouseFactory?.name || '—' }}</strong></div><div class="detail-field"><span>仓库名称</span><strong>{{ warehouseSelected?.name || '—' }}</strong></div><div class="detail-field"><span>仓库编号</span><strong>{{ warehouseSelected?.code || '—' }}</strong></div><div class="detail-field"><span>库位名称</span><strong>{{ locationDetail.location_name || locationDetail.name }}</strong></div><div class="detail-field"><span>库位编号</span><strong>{{ locationDetail.location_code || ('LOC-' + String(locationDetail.id).padStart(6, '0')) }}</strong></div><div class="detail-field"><span>库位类型</span><strong>{{ locationDetail.tank ? tankTypeLabel(locationDetail.tank.tank_type) : warehouseLocationTypeLabel(locationDetail.brew_location_type) }}</strong></div><template v-if="locationDetail.tank"><div class="detail-section-title detail-field-wide">关联罐体</div><div class="detail-field"><span>罐号</span><strong>{{ locationDetail.tank.name }}</strong></div><div class="detail-field"><span>罐体类型</span><strong>{{ tankTypeLabel(locationDetail.tank.tank_type) }}</strong></div><div class="detail-field"><span>罐体容量</span><strong>{{ locationDetail.tank.capacity_l || 0 }} L</strong></div><div class="detail-field"><span>所属设备</span><strong>{{ locationDetail.tank.equipment_name || '—' }}</strong></div><div class="detail-field"><span>罐体状态</span><strong>{{ tankStatusLabel(locationDetail.tank.status) }}</strong></div></template><div class="detail-field"><span>状态</span><strong>{{ locationDetail.active === false ? '已停用' : '已启用' }}</strong></div><div class="detail-field"><span>创建时间</span><strong>{{ formatDateTime(locationDetail.created_at) }}</strong></div></div>
            <div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="locationDetail = null">关闭</button></div>
          </div>
        </div>
        <form v-else-if="creating" class="master-form" @submit.prevent="submitCreate">
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
        <div v-if="false && selected === 'equipment'" class="panel-body warehouse-hierarchy">
          <div class="warehouse-level-nav">
            <button type="button" :class="['warehouse-level-step', { active: !equipmentFactory, done: !!equipmentFactory }]" @click="goEquipmentLevel('factory')"><span>1</span><strong>厂区</strong><small>{{ equipmentFactory ? equipmentFactory.name : '选择厂区' }}</small></button><i>›</i>
            <button type="button" :class="['warehouse-level-step', { active: !!equipmentFactory && !equipmentWarehouse, done: !!equipmentWarehouse }]" :disabled="!equipmentFactory" @click="goEquipmentLevel('warehouse')"><span>2</span><strong>仓库</strong><small>{{ equipmentWarehouse ? equipmentWarehouse.name : (equipmentFactory ? '选择仓库' : '待选择') }}</small></button><i>›</i>
            <button type="button" :class="['warehouse-level-step', { active: !!equipmentWarehouse }]" :disabled="!equipmentWarehouse" @click="goEquipmentLevel('location')"><span>3</span><strong>库位</strong><small>{{ equipmentLocation ? equipmentLocation.name : (equipmentWarehouse ? '选择库位' : '待选择') }}</small></button>
          </div>
          <div v-if="loading" class="empty">正在加载...</div>
          <template v-else-if="!equipmentFactory"><div class="warehouse-section-heading"><div><strong>选择厂区</strong><span>查看厂区下的设备、仓库和库位</span></div></div><div class="warehouse-factory-grid"><button v-for="row in equipmentFactoryRows" :key="row.factory.id" type="button" class="warehouse-factory-card" @click="openEquipmentFactory(row.factory)"><div class="warehouse-card-icon">设</div><div class="warehouse-card-main"><strong>{{ row.factory.name }}</strong><span>{{ row.equipmentCount }} 个设备 · {{ row.warehouseCount }} 个仓库</span></div><em>→</em></button></div></template>
          <template v-else-if="!equipmentWarehouse"><div class="warehouse-section-heading"><div><strong>{{ equipmentFactory.name }} -- 仓库设置</strong><span>选择仓库查看对应库位设备</span></div></div><div class="warehouse-card-grid"><button v-for="warehouse in equipmentFactoryWarehouses" :key="warehouse.id" type="button" class="warehouse-card" @click="openEquipmentWarehouse(warehouse)"><div><strong>{{ warehouse.name }}</strong><span>{{ warehouse.code || '标准仓库' }}</span></div><b>{{ equipmentWarehouseLocations(warehouse).length }}<small> 个库位</small></b></button></div><div v-if="!equipmentFactoryWarehouses.length" class="empty">该厂区暂无仓库</div><div v-if="equipmentFactoryGeneral.length" class="warehouse-location-panel"><div class="warehouse-section-heading"><div><strong>厂区设备</strong><span>糖化设备等不绑定具体罐位的设备</span></div></div><div class="warehouse-location-grid"><div v-for="item in equipmentFactoryGeneral" :key="item.id" class="warehouse-location-card"><span class="location-dot"></span><div><strong>{{ item.name }}</strong><small>{{ equipmentTypeLabel(item.brew_equipment_type) }} · {{ item.brew_capacity_l || 0 }} L</small></div><button v-if="canCreate" class="btn btn-xs btn-outline" type="button" @click="startEdit(item)">编辑</button></div></div></div></template>
          <template v-else-if="!equipmentLocation"><div class="warehouse-section-heading"><div><strong>{{ equipmentFactory.name }} -- {{ equipmentWarehouse.name }} -- 库位设置</strong><span>选择库位查看对应罐体设备</span></div></div><div class="warehouse-location-grid"><button v-for="location in equipmentWarehouseLocations(equipmentWarehouse)" :key="location.id" type="button" class="warehouse-location-card warehouse-location-button" @click="openEquipmentLocation(location)"><span class="location-dot"></span><div><strong>{{ location.name }}</strong><small>{{ warehouseLocationTypeLabel(location.brew_location_type) }} · {{ equipmentLocationEquipment(location).length }} 个关联设备</small></div></button></div><div v-if="!equipmentWarehouseLocations(equipmentWarehouse).length" class="empty">该仓库暂无库位</div></template>
          <template v-else><div class="warehouse-section-heading"><div><strong>{{ equipmentFactory.name }} -- {{ equipmentWarehouse.name }} -- {{ equipmentLocation.name }}</strong><span>该库位对应的发酵罐、清酒罐设备</span></div><button v-if="canCreate" class="btn btn-sm btn-primary" type="button" @click="startCreate">＋ 新增设备</button></div><div v-if="!equipmentLocationEquipment(equipmentLocation).length" class="empty">该库位暂无关联设备</div><div v-else class="warehouse-location-grid"><div v-for="item in equipmentLocationEquipment(equipmentLocation)" :key="item.id" class="warehouse-location-card"><span class="location-dot"></span><div><strong>{{ item.name }}</strong><small>{{ equipmentTypeLabel(item.brew_equipment_type) }} · {{ item.brew_capacity_l || 0 }} L</small></div><button v-if="canCreate" class="btn btn-xs btn-outline" type="button" @click="startEdit(item)">编辑</button></div></div></template>
        </div>
        <div v-if="false && selected === 'equipment'" class="panel-body warehouse-hierarchy">
          <div class="warehouse-level-nav equipment-level-nav">
            <button type="button" :class="['warehouse-level-step', { active: !equipmentFactory, done: !!equipmentFactory }]" @click="goEquipmentLevel('factory')"><span>1</span><strong>厂区</strong><small>{{ equipmentFactory ? equipmentFactory.name : '选择厂区' }}</small></button><i>›</i>
            <button type="button" :class="['warehouse-level-step', { active: !!equipmentFactory }]" :disabled="!equipmentFactory" @click="goEquipmentLevel('equipment')"><span>2</span><strong>设备</strong><small>{{ equipmentFactory ? '查看设备列表' : '待选择' }}</small></button>
          </div>
          <div v-if="loading" class="empty">正在加载...</div>
          <template v-else-if="!equipmentFactory"><div class="warehouse-section-heading"><div><strong>选择厂区</strong><span>查看该厂区下的生产设备</span></div></div><div class="warehouse-factory-grid"><button v-for="row in equipmentFactoryRows" :key="row.factory.id" type="button" class="warehouse-factory-card" @click="openEquipmentFactory(row.factory)"><div class="warehouse-card-icon">设</div><div class="warehouse-card-main"><strong>{{ row.factory.name }}</strong><span>{{ row.equipmentCount }} 个设备</span></div><em>→</em></button></div></template>
          <template v-else><div class="warehouse-section-heading"><div><strong>{{ equipmentFactory.name }} -- 设备设置</strong><span>该厂区下的生产设备</span></div><button v-if="canCreate" class="btn btn-sm btn-primary" type="button" @click="startCreate">＋ 新增设备</button></div><div v-if="!equipmentFactoryEquipment.length" class="empty">该厂区暂无设备</div><div v-else class="equipment-card-list"><div v-for="item in equipmentFactoryEquipment" :key="item.id" class="equipment-card-row"><span :class="['equipment-card-status', item.active === false ? 'archived' : (item.brew_status === 'disabled' ? 'disabled' : '')]">{{ equipmentStatusLabel(item.brew_status, item.active) }}</span><div class="equipment-card-mark">{{ equipmentTypeLabel(item.brew_equipment_type).slice(0, 1) }}</div><div class="equipment-card-info"><strong>{{ item.name }}</strong><span>{{ equipmentTypeLabel(item.brew_equipment_type) }} · {{ item.brew_capacity_l || 0 }} L</span></div><div class="equipment-card-meta"><small>{{ item.brew_equipment_type === 'fermentation' || item.brew_equipment_type === 'bright' ? (item.tank_specs?.length || 0) + ' 个罐体' : '技术设备' }}</small><button v-if="canCreate && item.active !== false" class="btn btn-xs btn-outline" type="button" @click="startEdit(item)">编辑</button><button v-if="canCreate && item.active !== false" class="btn btn-xs btn-outline" type="button" @click="toggleEquipmentStatus(item)">{{ item.brew_status === 'disabled' ? '启用' : '停用' }}</button><button v-if="canCreate && item.active === false" class="btn btn-xs btn-outline" type="button" @click="changeEquipmentState(item, 'restore')">恢复</button><button v-if="canCreate && item.active !== false" class="btn btn-xs btn-danger" type="button" @click="changeEquipmentState(item, 'archive', true)">删除</button></div></div></div></template>
        </div>
        <div v-if="selected === 'equipment'" class="panel-body warehouse-hierarchy equipment-system-view">
          <div class="warehouse-level-nav equipment-level-nav">
            <button type="button" :class="['warehouse-level-step', { active: !equipmentFactory, done: !!equipmentFactory }]" @click="goEquipmentLevel('factory')"><span>1</span><strong>厂区</strong><small>{{ equipmentFactory ? equipmentFactory.name : '选择厂区' }}</small></button><i>›</i>
            <button type="button" :class="['warehouse-level-step', { active: !!equipmentFactory }]" :disabled="!equipmentFactory" @click="goEquipmentLevel('equipment')"><span>2</span><strong>酿造系统</strong><small>{{ equipmentFactory ? '查看系统与罐体' : '待选择' }}</small></button>
          </div>
          <div v-if="loading" class="empty">正在加载...</div>
          <template v-else-if="!equipmentFactory"><div class="warehouse-section-heading"><div><strong>选择厂区</strong><span>查看厂区下的酿造系统</span></div></div><div class="warehouse-factory-grid"><button v-for="row in equipmentFactoryRows" :key="row.factory.id" type="button" class="warehouse-factory-card" @click="openEquipmentFactory(row.factory)"><div class="warehouse-card-icon">酿</div><div class="warehouse-card-main"><strong>{{ row.factory.name }}</strong><span>{{ items.filter(item => Number(item.brew_factory_id?.id || item.brew_factory_id || 0) === Number(row.factory.id) && item.brew_equipment_type === 'mash').length }} 套酿造系统</span></div><em>→</em></button></div></template>
          <template v-else>
            <div class="warehouse-section-heading"><div><strong>{{ equipmentFactory.name }} -- 酿造系统</strong><span>先新增酿造系统，再在系统下配置发酵罐和清酒罐</span></div><button v-if="canCreate" class="btn btn-sm btn-primary" type="button" @click="startCreate">＋ 新增酿造系统</button></div>
            <div v-if="!equipmentFactorySystems.length" class="equipment-system-empty"><strong>还没有酿造系统</strong><span>请先新增一套酿造系统，再添加配套罐体</span><button v-if="canCreate" class="btn btn-sm btn-primary" type="button" @click="startCreate">＋ 新增酿造系统</button></div>
            <div v-for="system in equipmentFactorySystems" :key="system.id" class="equipment-system-card">
              <div class="equipment-system-card-header"><div class="equipment-card-mark">酿</div><div class="equipment-system-title"><strong>{{ system.name }}</strong><span>{{ system.brew_capacity_l || '—' }} L 糖化最大体积 · 糖化效率 {{ system.brew_saccharification_efficiency || '—' }}%</span></div><span :class="['equipment-card-status', system.active === false ? 'archived' : (system.brew_status === 'disabled' ? 'disabled' : '')]">{{ equipmentStatusLabel(system.brew_status, system.active) }}</span><button class="btn btn-xs btn-outline" type="button" @click="toggleSystemExpanded(system.id)">{{ isSystemExpanded(system.id) ? '收起罐体' : '查看罐体' }}</button><button v-if="canCreate && system.active !== false" class="btn btn-xs btn-outline" type="button" @click.stop="startEdit(system)">编辑系统</button><button v-if="canCreate && system.active !== false" class="btn btn-xs btn-outline" type="button" @click.stop="toggleEquipmentStatus(system)">{{ system.brew_status === 'disabled' ? '启用' : '停用' }}</button><button v-if="canCreate && system.active !== false" class="btn btn-xs btn-danger" type="button" @click.stop="changeEquipmentState(system, 'archive', true)">删除</button></div>
              <div class="equipment-system-params"><div class="equipment-system-param"><span>筛板余水</span><strong>{{ system.brew_screen_water_l || '—' }}<em>L</em></strong></div><div class="equipment-system-param"><span>回旋时间</span><strong>{{ system.brew_whirlpool_time_min || '—' }}<em>分钟</em></strong></div><div class="equipment-system-param"><span>过滤速度</span><strong>{{ system.brew_filtration_speed_l_min || '—' }}<em>L/min</em></strong></div></div>
              <div v-if="isSystemExpanded(system.id)" class="equipment-tank-groups"><section class="equipment-tank-group"><div class="equipment-tank-group-header"><strong>发酵罐</strong><span>{{ (system.tank_specs || []).filter(tank => tank.tank_type === 'fermentation').length }} 个</span><button v-if="canCreate && system.active !== false" class="btn btn-xs btn-outline" type="button" @click="startAddSystemTank(system, 'fermentation')">＋ 添加发酵罐</button></div><div v-for="tank in (system.tank_specs || []).filter(tank => tank.tank_type === 'fermentation')" :key="tank.id || tank.name" class="equipment-tank-card"><div class="equipment-tank-icon">发</div><div><strong>{{ tank.name }}</strong><span>{{ tank.capacity_l || '—' }} L · {{ tank.location_name || '库存位置自动生成' }}</span></div><button v-if="canCreate && system.active !== false" class="btn btn-xs btn-outline" type="button" @click="startEdit(system)">编辑</button></div></section><section class="equipment-tank-group"><div class="equipment-tank-group-header"><strong>清酒罐</strong><span>{{ (system.tank_specs || []).filter(tank => tank.tank_type === 'bright').length }} 个</span><button v-if="canCreate && system.active !== false" class="btn btn-xs btn-outline" type="button" @click="startAddSystemTank(system, 'bright')">＋ 添加清酒罐</button></div><div v-for="tank in (system.tank_specs || []).filter(tank => tank.tank_type === 'bright')" :key="tank.id || tank.name" class="equipment-tank-card"><div class="equipment-tank-icon bright">清</div><div><strong>{{ tank.name }}</strong><span>{{ tank.capacity_l || '—' }} L · {{ tank.location_name || '库存位置自动生成' }}</span></div><button v-if="canCreate && system.active !== false" class="btn btn-xs btn-outline" type="button" @click="startEdit(system)">编辑</button></div></section></div>
            </div>
            <div v-if="equipmentFactoryOther.length" class="equipment-legacy-section"><div class="equipment-tank-group-header"><strong>其他独立设备</strong><span>历史设备记录</span></div><div class="equipment-card-list"><div v-for="item in equipmentFactoryOther" :key="item.id" class="equipment-card-row"><div class="equipment-card-mark">设</div><div class="equipment-card-info"><strong>{{ item.name }}</strong><span>{{ equipmentTypeLabel(item.brew_equipment_type) }} · {{ item.brew_capacity_l || 0 }} L</span></div><button v-if="canCreate" class="btn btn-xs btn-outline" type="button" @click="startEdit(item)">编辑</button></div></div></div>
          </template>
        </div>
        <div v-if="isCategoryResource(selected)" class="panel-body master-list material-category-list">
          <div class="material-category-toolbar">
            <button v-if="materialCategoryParent" class="btn btn-sm btn-secondary" type="button" @click="clearMaterialCategoryParent">← 返回大类</button>
            <div class="material-category-heading">
              <span class="material-category-breadcrumb">{{ materialCategoryParent ? materialCategoryParent.name + ' · 小类' : (isBeerCategory(selected) ? '啤酒大类' : '原料大类') }}</span>
              <span class="material-category-hint">{{ materialCategoryParent ? (isBeerCategory(selected) ? '管理当前啤酒大类下的小分类' : '管理当前大类下的具体原料种类') : '选择一个大类查看或编辑它的小类' }}</span>
            </div>
          </div>
          <div v-if="loading" class="empty">正在加载...</div>
          <div v-else-if="!materialCategoryRows.length" class="empty">暂无数据</div>
          <template v-else>
            <div v-for="item in materialCategoryRows" :key="item.id" draggable="true" class="material-category-card" :class="{ clickable: !materialCategoryParent }" @dragstart="startCategoryDrag(item)" @dragover.prevent @drop.prevent="dropCategory(item)" @click="!materialCategoryParent && openMaterialCategory(item)">
              <div>
                <div class="material-category-card-title">{{ item.name }}</div>
                <div class="task-desc">{{ item.code }}<template v-if="!isBeerCategory(selected)"> · {{ materialGroupLabel(item.material_group) }}</template></div>
                <div v-if="!materialCategoryParent" class="material-category-count">{{ materialCategoryChildCount(item.id) }} 个小类</div>
                <div v-else class="material-category-count">排序 {{ item.sequence || 0 }}</div>
              </div>
              <span :class="['material-category-card-status', item.active === false ? 'muted' : 'enabled']">{{ item.active === false ? '已停用' : '已启用' }}</span>
              <div class="master-actions">
                <button v-if="!materialCategoryParent" class="btn btn-xs btn-outline" type="button" @click.stop="openMaterialCategory(item)">查看小类 →</button>
                <button v-if="canCreate" class="btn btn-xs btn-outline" type="button" @click.stop="startEdit(item)">编辑</button>
                <button v-if="canCreate && item.active !== false" class="btn btn-xs btn-outline" type="button" @click.stop="changeCategoryState(item, 'archive')">停用</button>
                <button v-if="canCreate && item.active === false" class="btn btn-xs btn-outline" type="button" @click.stop="changeCategoryState(item, 'restore')">启用</button>
                <button v-if="canCreate && item.active !== false" class="btn btn-xs btn-danger" type="button" @click.stop="changeCategoryState(item, 'archive', true)">删除</button>
              </div>
            </div>
          </template>
        </div>
        <div v-else-if="selected === 'suppliers'" class="panel-body supplier-master-list">
          <div v-if="loading" class="empty">正在加载...</div>
          <div v-else-if="!displayedItems.length" class="empty">暂无供应商</div>
          <div v-else class="supplier-master-cards">
            <div v-for="item in displayedItems" :key="item.id" class="supplier-master-card">
              <span :class="['supplier-master-status', item.active === false ? 'muted' : 'enabled']">{{ item.active === false ? '已停用' : '已启用' }}</span>
              <div class="supplier-master-main"><strong>{{ item.name }}</strong><span>{{ item.brew_supplier_code || '编码生成中' }} · {{ item.brew_contact_name || '未填写联系人' }} · {{ item.phone || '未填写电话' }}</span><small>{{ item.email || '未填写邮箱' }} · {{ item.street || '未填写地址' }}</small></div>
              <div class="supplier-master-actions"><button v-if="canCreate" class="btn btn-xs btn-outline" type="button" @click="startEdit(item)">详情/编辑</button><button v-if="canCreate && item.active !== false" class="btn btn-xs btn-outline" type="button" @click="changeMasterState('suppliers', item, 'archive')">停用</button><button v-if="canCreate && item.active === false" class="btn btn-xs btn-outline" type="button" @click="changeMasterState('suppliers', item, 'restore')">启用</button><button v-if="canCreate && item.active !== false" class="btn btn-xs btn-danger" type="button" @click="changeMasterState('suppliers', item, 'archive', true)">删除</button></div>
            </div>
          </div>
        </div>
        <div v-else-if="selected === 'warehouses'" class="panel-body warehouse-hierarchy">
          <div class="warehouse-level-nav">
            <button type="button" :class="['warehouse-level-step', { active: !warehouseFactory, done: !!warehouseFactory }]" @click="goWarehouseLevel('factory')"><span>1</span><strong>厂区</strong><small>{{ warehouseFactory ? warehouseFactory.name : '选择厂区' }}</small></button>
            <i>›</i>
            <button type="button" :class="['warehouse-level-step', { active: !!warehouseFactory && !warehouseSelected, done: !!warehouseSelected }]" :disabled="!warehouseFactory" @click="goWarehouseLevel('warehouse')"><span>2</span><strong>仓库</strong><small>{{ warehouseSelected ? warehouseSelected.name : (warehouseFactory ? '选择仓库' : '待选择') }}</small></button>
            <i>›</i>
            <button type="button" :class="['warehouse-level-step', { active: !!warehouseSelected }]" :disabled="!warehouseSelected" @click="goWarehouseLevel('location')"><span>3</span><strong>库位</strong><small>{{ warehouseSelected ? '查看库位列表' : '待选择' }}</small></button>
          </div>
          <div v-if="loading" class="empty">正在加载...</div>
          <template v-else-if="!warehouseFactory">
            <div class="warehouse-section-heading"><div><strong>厂区仓储总览</strong><span>点击厂区查看该厂区下的仓库和库位</span></div></div>
            <div class="warehouse-factory-grid">
              <button v-for="row in warehouseFactoryRows" :key="row.factory.id" type="button" class="warehouse-factory-card" @click="openWarehouseFactory(row.factory)">
                <div class="warehouse-card-icon">仓</div><div class="warehouse-card-main"><strong>{{ row.factory.name }}</strong><span>{{ row.factory.code || '未设置编码' }}</span></div><div class="warehouse-card-count"><b>{{ row.warehouseCount }}</b><small>个仓库</small><b>{{ row.locationCount }}</b><small>个库位</small></div><em>→</em>
              </button>
            </div>
          </template>
          <template v-else>
            <template v-if="!warehouseSelected">
              <div class="warehouse-section-heading"><div><strong>{{ warehouseFactory.name }} -- 仓库设置</strong><span>{{ warehouseFactoryRows.find(row => row.factory.id === warehouseFactory.id)?.warehouseCount || 0 }} 个仓库</span></div></div>
              <div v-if="!warehouseFactoryRows.find(row => row.factory.id === warehouseFactory.id)?.warehouses.length" class="empty">该厂区暂无仓库</div>
              <div v-else class="warehouse-card-grid"><div v-for="warehouse in warehouseFactoryRows.find(row => row.factory.id === warehouseFactory.id).warehouses" :key="warehouse.id" class="warehouse-card" @click="openWarehouse(warehouse)"><div class="warehouse-card-icon">仓</div><div class="warehouse-card-main"><strong>{{ warehouse.name }}</strong><span>{{ warehouseTypeLabel(warehouse.brew_warehouse_type) }}</span></div><b>{{ warehouseLocationCount(warehouse) }}<small>个库位</small></b><div class="warehouse-card-actions"><button v-if="canCreate" class="btn btn-xs btn-outline" type="button" @click.stop="startEdit(warehouse)">编辑</button><button v-if="canCreate && warehouse.brew_warehouse_type !== 'tank'" class="btn btn-xs btn-outline" type="button" @click.stop="toggleWarehouseStatus(warehouse)">{{ warehouse.active === false ? '启用' : '停用' }}</button><button v-if="canCreate && warehouse.brew_warehouse_type !== 'tank'" class="btn btn-xs btn-danger" type="button" @click.stop="changeMasterState('warehouses', warehouse, 'archive', true)">删除</button></div></div></div>
            </template>
            <div v-else class="warehouse-location-panel"><div class="warehouse-section-heading"><div><strong>{{ warehouseFactory.name }} -- {{ warehouseSelected.name }} -- 库位设置</strong><span>该仓库下的库存存放位置</span></div><button v-if="canCreate" class="btn btn-sm btn-primary" type="button" @click="startLocationCreate">＋ 新增库位</button></div><div v-if="!warehouseLocationsFor(warehouseSelected).length" class="empty">该仓库暂无库位</div><div v-else class="warehouse-location-grid"><div v-for="location in warehouseLocationsFor(warehouseSelected)" :key="location.id" class="warehouse-location-card" @click="openLocationDetail(location)"><span class="location-dot"></span><div><strong>{{ location.location_name || location.name }}</strong><small>{{ location.tank ? tankTypeLabel(location.tank.tank_type) + ' · ' + location.tank.name : warehouseLocationTypeLabel(location.brew_location_type) }} · {{ location.active === false ? '已停用' : '已启用' }}</small></div><div class="warehouse-card-actions"><button v-if="canCreate" class="btn btn-xs btn-outline" type="button" @click.stop="editLocation(location)">编辑</button><button v-if="canCreate" class="btn btn-xs btn-outline" type="button" @click.stop="toggleLocationStatus(location)">{{ location.active === false ? '启用' : '停用' }}</button><button v-if="canCreate" class="btn btn-xs btn-danger" type="button" @click.stop="changeMasterState('locations', location, 'archive', true)">删除</button></div></div></div></div>
          </template>
        </div>
        <div v-else-if="selected !== 'equipment' && !isCategoryResource(selected)" class="panel-body master-list">
          <div v-if="loading" class="empty">正在加载...</div>
          <div v-else-if="!displayedItems.length" class="empty">暂无数据</div>
          <template v-else>
            <div v-for="item in displayedItems" :key="item.id" class="master-row" :class="{ 'master-row-clickable': selected === 'products' }" @click="selected === 'products' && openProductDetail(item)">
              <div>
                <div class="task-title">{{ item.name }}</div>
                <div class="task-desc">{{ describe(item) }}</div>
              </div>
              <div class="master-actions">
                <button v-if="selected === 'products'" class="btn btn-xs btn-outline" type="button" @click.stop="openProductDetail(item)">查看详情</button>
                <button v-if="selected === 'products' && canCreate" class="btn btn-xs btn-outline" type="button" @click.stop="startEdit(item)">编辑</button>
                <button v-if="selected === 'products' && canCreate && item.active !== false" class="btn btn-xs btn-danger" type="button" @click.stop="changeMasterState('products', item, 'archive', true)">删除</button>
                <button v-if="selected === 'products' && canCreate && item.active === false" class="btn btn-xs btn-outline" type="button" @click.stop="changeMasterState('products', item, 'restore')">恢复</button>
                <button v-if="(selected === 'equipment' || selected === 'users' || selected === 'suppliers') && canCreate" class="btn btn-xs btn-outline" type="button" @click="startEdit(item)">{{ selected === 'suppliers' ? '详情/编辑' : '编辑' }}</button>
                <button v-if="selected === 'users' && canCreate" class="btn btn-xs btn-outline" type="button" @click="changeUserState(item)">{{ item.active === false ? '启用' : '停用' }}</button>
                <button v-if="selected === 'suppliers' && canCreate && item.active !== false" class="btn btn-xs btn-outline" type="button" @click="changeMasterState('suppliers', item, 'archive')">停用</button>
                <button v-if="selected === 'suppliers' && canCreate && item.active === false" class="btn btn-xs btn-outline" type="button" @click="changeMasterState('suppliers', item, 'restore')">启用</button>
                <button v-if="selected === 'suppliers' && canCreate && item.active !== false" class="btn btn-xs btn-danger" type="button" @click="changeMasterState('suppliers', item, 'archive', true)">删除</button>
                <button v-if="currentResource.rule && canCreate && item.state !== 'active'" class="btn btn-xs btn-outline" type="button" @click="changeRuleState(item, 'activate')">启用</button>
                <button v-if="currentResource.rule && canCreate && item.state === 'active'" class="btn btn-xs btn-secondary" type="button" @click="changeRuleState(item, 'deactivate')">停用</button>
                <span :class="['master-state', item.active === false || item.state === 'inactive' ? 'muted' : 'enabled']">
                  {{ item.state ? stateLabel(item.state) : (item.active === false ? '已归档' : '启用') }}
                </span>
              </div>
            </div>
          </template>
        </div>
        </template>
      </div>
    </div>
  `,
  setup(props) {
    const commonFields = [{ key: "name", label: "名称" }];
    const factoryField = { key: "brew_factory_id", label: "所属厂区", type: "select", options: "factories" };
    const resources = [
      { code: "packaging_materials", label: "包装材料", desc: "包装材料与供应商商品", fields: [] },
      { code: "factories", label: "厂区", desc: "企业内厂区、编码和地址", fields: [...commonFields, { key: "code", label: "厂区编码" }, { key: "address", label: "地址", required: false }] },
      { code: "equipment", label: "设备", desc: "生产设备容量、技术参数与运行状态", fields: [...commonFields, factoryField, { key: "brew_equipment_type", label: "设备类型", type: "select", values: [["mash","糖化"],["fermentation","发酵"],["bright","清酒"],["packaging","包装"],["centrifuge","离心"],["cleaning","清洗"],["other","其他"]] }, { key: "brew_capacity_l", label: "容量(L)", type: "number" }] },
      { code: "tanks", label: "罐体", desc: "发酵罐、清酒罐和清洗状态", fields: [...commonFields, { ...factoryField, key: "factory_id" }, { key: "tank_type", label: "罐体类型", type: "select", values: [["fermentation","发酵罐"],["bright","清酒罐"]] }, { key: "capacity_l", label: "容量(L)", type: "number" }] },
      { code: "warehouses", label: "仓库", desc: "按厂区管理仓库，并查看仓库下的库位", fields: [...commonFields, factoryField, { key: "code", label: "仓库编码" }] },
      { code: "products", label: "产品", desc: "啤酒产品及半成品主数据", fields: [...commonFields, { key: "default_code", label: "产品编码" }, { key: "brew_item_type", label: "产品类型", type: "select", values: [["semi_finished","半成品"],["finished_product","成品"]] }, { key: "brew_specification", label: "产品说明", required: false }] },
      { code: "materials", label: "物料", desc: "原料与包装物标准主数据", fields: [...commonFields, { key: "default_code", label: "物料编码" }, { key: "brew_item_type", label: "物料类型", type: "select", values: [["raw_material","原料"],["packaging_material","包装物"]] }, { key: "brew_material_category", label: "原料分类", type: "select", values: [["malt","麦芽"],["hop","酒花"],["yeast","酵母"],["adjunct","辅料"],["packaging","包装物"]] }, { key: "brew_shelf_life_days", label: "保质期(天)", type: "number", required: false }] },
      { code: "material-categories", label: "原料种类", desc: "系统级原料大类和细分类，不绑定厂区", fields: [...commonFields, { key: "code", label: "种类编码" }, { key: "material_group", label: "原料大类", type: "select", values: [["malt","麦芽"],["hop","啤酒花"],["yeast","酵母"],["adjunct","其他可发酵物"],["packaging","包装材料"]] }, { key: "parent_id", label: "所属大类", type: "select", required: false }, { key: "sequence", label: "排序", type: "number", required: false }] },
      { code: "beer-categories", label: "啤酒分类", desc: "系统级啤酒大类和小分类，不绑定厂区", fields: [...commonFields, { key: "code", label: "分类编码" }, { key: "parent_id", label: "所属大类", type: "select", required: false }, { key: "sequence", label: "排序", type: "number", required: false }] },
      { code: "suppliers", label: "供应商", desc: "供应商主体、联系方式和登录账号", fields: [...commonFields, { key: "phone", label: "电话", required: false }, { key: "email", label: "邮箱", required: false }, { key: "supplier_account_login", label: "登录账号", required: false }, { key: "supplier_account_password", label: "初始密码(至少8位)", type: "password", required: false }] },
      { code: "accounts", label: "账号与权限", desc: "统一管理用户、角色、组织机构和菜单权限", fields: [] },
      { code: "customers", label: "客户", desc: "客户联系信息与等级", fields: [...commonFields, { key: "phone", label: "电话", required: false }, { key: "brew_customer_level", label: "客户等级", type: "select", values: [["normal","普通"],["key","重点"],["vip","VIP"]] }] },
      { code: "number-rules", label: "编号规则", desc: "单据编号和批次编码版本", rule: true, fields: [...commonFields, { key: "code", label: "规则编码" }, { key: "config", label: "规则配置(JSON)", type: "textarea" }] },
      { code: "barcode-rules", label: "条码规则", desc: "批次码、桶码和箱码规则", rule: true, fields: [...commonFields, { key: "code", label: "规则编码" }, { key: "config", label: "规则配置(JSON)", type: "textarea" }] },
      { code: "alert-rules", label: "预警规则", desc: "库存、效期、任务和工艺参数阈值", rule: true, fields: [...commonFields, { key: "code", label: "规则编码" }, { key: "config", label: "规则配置(JSON)", type: "textarea" }] },
      { code: "approval-rules", label: "审批规则", desc: "采购、超领、超收等审批阈值与节点", rule: true, fields: [...commonFields, { key: "code", label: "规则编码" }, { key: "config", label: "规则配置(JSON)", type: "textarea" }] }
    ];
    const selected = ref("factories");
    const items = ref([]);
    const equipmentItems = ref([]);
    const factories = ref([]);
    const materialCategories = ref([]);
    const productDetail = ref(null);
    const materialCategoryParent = ref(null);
    const warehouseLocations = ref([]);
    const warehouseFactory = ref(null);
    const warehouseSelected = ref(null);
    const locationCreating = ref(false);
    const locationEditing = ref(null);
    const locationDetail = ref(null);
    const locationDraft = ref({ name: "", brew_location_type: "" });
    const locationTypeOptions = [
      { value: "raw_material", label: "原料" }, { value: "packaging", label: "包装" }, { value: "qc", label: "待检" },
      { value: "semi_finished", label: "半成品" }, { value: "finished", label: "成品" }, { value: "loss", label: "损耗" }
    ];
    const warehouseTypeOptions = [
      { value: "raw_material", label: "原料仓" }, { value: "packaging", label: "包装物仓" },
      { value: "semi_finished", label: "半成品仓" }, { value: "finished", label: "成品仓" },
      { value: "qc", label: "待检仓" }, { value: "loss", label: "损耗仓" }, { value: "tank", label: "罐体仓" }
    ];
    const categoryNotice = ref("");
    const draggedCategory = ref(null);
    const materialGroupOptions = [
      { value: "malt", label: "麦芽" }, { value: "hop", label: "啤酒花" }, { value: "yeast", label: "酵母" },
      { value: "adjunct", label: "其他可发酵物" }, { value: "packaging", label: "包装材料" }
    ];
    const equipmentFactoryFilter = ref("");
    const equipmentFactory = ref(null);
    const expandedSystems = ref(new Set());
    const equipmentWarehouse = ref(null);
    const equipmentLocation = ref(null);
    const equipmentWarehouses = ref([]);
    const equipmentLocations = ref([]);
    const editingItem = ref(null);
    const equipmentTypeOptions = ref([
      { value: "mash", label: "酿造系统" },
      { value: "fermentation", label: "发酵罐" },
      { value: "bright", label: "清酒罐" },
      { value: "other", label: "其他" }
    ]);
    const newEquipmentType = ref("");
    const loading = ref(false);
    const saving = ref(false);
    const creating = ref(false);
    const error = ref("");
    const draft = ref({});
    let nextTankDraftKey = 0;
    function tankDraftKey() { return `draft-${++nextTankDraftKey}`; }
    const accountRoles = ref([]);
    const supplierItems = ref([]);
    const currentResource = computed(() => resources.find(item => item.code === selected.value));
    function isCategoryResource(code) { return ["material-categories", "beer-categories"].includes(code); }
    function isBeerCategory(code) { return code === "beer-categories"; }
    const materialCategoryRows = computed(() => {
      if (!isCategoryResource(selected.value)) return [];
      return materialCategories.value
        .filter(item => materialCategoryParent.value ? Number(item.parent_id?.id || item.parent_id || 0) === Number(materialCategoryParent.value.id) : !item.parent_id)
        .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0) || String(a.name).localeCompare(String(b.name), "zh-CN"));
    });
    const productBeerSubcategories = computed(() => materialCategories.value.filter(item => String(item.parent_id?.id || item.parent_id || "") === String(draft.value.brew_beer_category_id || "")));
    const displayedItems = computed(() => {
      if (selected.value === "products") {
        return [...items.value].sort((a, b) => Number(a.active === false) - Number(b.active === false) || String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"));
      }
      if (selected.value !== "equipment" || !equipmentFactoryFilter.value) return items.value;
      return items.value.filter(item => String(item.brew_factory_id?.id || "") === String(equipmentFactoryFilter.value));
    });
    const warehouseFactoryRows = computed(() => factories.value.map(factory => {
      const warehouses = items.value.filter(item => Number(item.brew_factory_id?.id || item.brew_factory_id || 0) === Number(factory.id));
      const locationCount = warehouses.reduce((total, warehouse) => total + warehouseLocationsFor(warehouse).length, 0);
      return { factory, warehouses, warehouseCount: warehouses.length, locationCount };
    }));
    const equipmentFactoryWarehouses = computed(() => equipmentWarehouses.value.filter(item => Number(item.brew_factory_id?.id || item.brew_factory_id || 0) === Number(equipmentFactory.value?.id || 0)));
    const equipmentFactoryGeneral = computed(() => items.value.filter(item => Number(item.brew_factory_id?.id || item.brew_factory_id || 0) === Number(equipmentFactory.value?.id || 0) && !(item.tank_specs || []).length));
    const equipmentFactoryRows = computed(() => factories.value.map(factory => ({
      factory,
      equipmentCount: items.value.filter(item => Number(item.brew_factory_id?.id || item.brew_factory_id || 0) === Number(factory.id)).length,
      warehouseCount: equipmentWarehouses.value.filter(item => Number(item.brew_factory_id?.id || item.brew_factory_id || 0) === Number(factory.id)).length
    })));
    const equipmentFactoryEquipment = computed(() => items.value.filter(item => Number(item.brew_factory_id?.id || item.brew_factory_id || 0) === Number(equipmentFactory.value?.id || 0)));
    const equipmentFactorySystems = computed(() => equipmentFactoryEquipment.value.filter(item => item.brew_equipment_type === "mash"));
    const equipmentFactoryOther = computed(() => equipmentFactoryEquipment.value.filter(item => item.brew_equipment_type !== "mash"));
    const writePermissions = {
      factories: ["base.master_data.manage"],
      equipment: ["base.master_data.manage", "base.equipment.manage"],
      tanks: ["base.master_data.manage", "base.equipment.manage"],
      warehouses: ["base.master_data.manage"],
      locations: ["base.master_data.manage", "base.location.manage"],
      products: ["base.master_data.manage", "base.product.manage"],
      materials: ["base.master_data.manage", "base.product.manage", "base.material.manage"],
      "material-categories": ["admin.user.manage"],
      suppliers: ["base.master_data.manage", "base.supplier.manage"],
      accounts: ["admin.user.manage"],
      customers: ["base.master_data.manage", "base.customer.manage"],
      "beer-categories": ["base.master_data.manage", "base.beer_category.manage"],
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
        if (["accounts","packaging_materials"].includes(current.code)) return;
        if (current.code === "users") {
          items.value = await brewApi.listAdminUsers({ page_size: 100 });
          accountRoles.value = await brewApi.listAdminRoles();
          supplierItems.value = await brewApi.listMaster("suppliers", { page_size: 200, active: true });
        } else {
        items.value = current.rule
            ? await brewApi.listRules(current.code)
          : await brewApi.listMaster(current.code, { page_size: 100, active: ["suppliers", "products"].includes(current.code) ? "all" : true });
        }
        if (current.code === "warehouses") {
          warehouseLocations.value = await brewApi.listMaster("locations", { page_size: 500 });
          equipmentItems.value = await brewApi.listMaster("equipment", { page_size: 500, active: true });
        }
        if (current.code === "equipment") {
          equipmentWarehouses.value = await brewApi.listMaster("warehouses", { page_size: 200, active: true });
          equipmentLocations.value = await brewApi.listMaster("locations", { page_size: 500 });
        }
        if (current.code !== "factories" && !factories.value.length) {
          factories.value = await brewApi.listMaster("factories", { page_size: 100, active: true });
        }
        if (["materials", "material-categories"].includes(current.code) || (!materialCategories.value.length && current.code !== "products")) {
          materialCategories.value = await brewApi.listMaster("material-categories", { page_size: 200 });
        }
        if (["beer-categories", "products"].includes(current.code)) {
          materialCategories.value = await brewApi.listMaster("beer-categories", { page_size: 200 });
        }
      } catch (cause) {
        error.value = cause.message || "数据加载失败。";
      } finally {
        loading.value = false;
      }
    }

    function selectResource(code) {
      selected.value = code;
      materialCategoryParent.value = null;
      categoryNotice.value = "";
      warehouseFactory.value = null;
      warehouseSelected.value = null;
      equipmentFactory.value = null;
      equipmentWarehouse.value = null;
      equipmentLocation.value = null;
      creating.value = false;
      editingItem.value = null;
      items.value = [];
      load();
    }

    function startCreate() {
      draft.value = currentResource.value.code === "users"
          ? { name: "", login: "", password: "", role_code: "", supplier_id: "" }
        : currentResource.value.code === "suppliers"
          ? { name: "", brew_supplier_code: "", brew_contact_name: "", phone: "", email: "", active: true, street: "", comment: "", brew_social_credit_code: "", brew_bank_account_name: "", brew_bank_name: "", brew_bank_branch: "", brew_bank_account: "", supplier_account_login: "", supplier_account_password: "" }
        : currentResource.value.code === "equipment"
          ? { brew_factory_id: equipmentFactory.value?.id || equipmentFactoryFilter.value || "", brew_equipment_type: "mash", name: "", brew_capacity_l: "", brew_tank_volume_l: "", brew_tank_count: 0, tank_specs: [], brew_saccharification_efficiency: 0, brew_screen_water_l: 0, brew_whirlpool_time_min: 0, brew_filtration_speed_l_min: 0 }
        : currentResource.value.code === "products"
          ? { name: "", default_code: "", brew_item_type: "finished_product", brew_beer_category_id: "", brew_beer_subcategory_id: "", brew_specification: "" }
        : (currentResource.value.code === "warehouses"
          ? { brew_factory_id: warehouseFactory.value?.id || "", brew_warehouse_type: "", name: "", code: "" }
        : (isCategoryResource(currentResource.value.code)
          ? { name: "", code: generateCategoryCode(isBeerCategory(currentResource.value.code) ? "beer" : "material"), ...(isBeerCategory(currentResource.value.code) ? {} : { material_group: materialCategoryParent.value?.material_group || "" }), parent_id: materialCategoryParent.value?.id || "", sequence: 10 }
          : (currentResource.value.rule ? { config: "{}" } : {})));
      newEquipmentType.value = "";
      editingItem.value = null;
      creating.value = true;
      error.value = "";
      categoryNotice.value = "";
    }

    function startCategoryCreate() {
      const beerCategory = isBeerCategory(selected.value);
      draft.value = {
        name: "",
        code: generateCategoryCode(beerCategory ? "beer" : "material"),
        ...(beerCategory ? {} : { material_group: materialCategoryParent.value?.material_group || "" }),
        parent_id: materialCategoryParent.value?.id || "",
        sequence: 10
      };
      editingItem.value = null;
      creating.value = true;
      error.value = "";
      categoryNotice.value = "";
    }

    function startEdit(item) {
      if (currentResource.value.code === "products") {
        draft.value = {
          name: item.name || "",
          default_code: item.default_code || "",
          brew_item_type: item.brew_item_type || "finished_product",
          brew_beer_category_id: item.brew_beer_category_id?.id || "",
          brew_beer_subcategory_id: item.brew_beer_subcategory_id?.id || "",
          brew_specification: item.brew_specification || ""
        };
        editingItem.value = item;
        productDetail.value = null;
        creating.value = true;
        error.value = "";
        return;
      }
      if (currentResource.value.code === "users") {
        draft.value = { ...item, role_code: item.role_codes?.[0] || "", password: "" };
        editingItem.value = item; creating.value = true; error.value = ""; return;
      }
      if (currentResource.value.code === "suppliers") {
        draft.value = { name: item.name || "", brew_supplier_code: item.brew_supplier_code || "", brew_contact_name: item.brew_contact_name || "", phone: item.phone || "", email: item.email || "", active: item.active !== false, street: item.street || "", comment: item.comment || "", brew_social_credit_code: item.brew_social_credit_code || "", brew_bank_account_name: item.brew_bank_account_name || "", brew_bank_name: item.brew_bank_name || "", brew_bank_branch: item.brew_bank_branch || "", brew_bank_account: item.brew_bank_account || "", supplier_account_login: item.account?.login || "", supplier_account_password: "", version: item.version };
        editingItem.value = item; creating.value = true; error.value = ""; return;
      }
      if (isCategoryResource(currentResource.value.code)) {
        draft.value = { name: item.name || "", code: item.code || "", ...(isBeerCategory(currentResource.value.code) ? {} : { material_group: item.material_group || "", brew_packaging_type: item.brew_packaging_type || "" }), parent_id: item.parent_id?.id || item.parent_id || "", sequence: item.sequence || 10, version: item.version };
        editingItem.value = item;
        creating.value = true;
        error.value = "";
        categoryNotice.value = "";
        return;
      }
      if (currentResource.value.code === "warehouses") {
        draft.value = {
          version: item.version,
          brew_factory_id: item.brew_factory_id?.id || item.brew_factory_id || "",
          brew_warehouse_type: item.brew_warehouse_type || "",
          name: item.name || "",
          code: item.code || ""
        };
        editingItem.value = item;
        creating.value = true;
        error.value = "";
        return;
      }
      const typeValue = item.brew_equipment_type_custom
        ? `custom:${item.brew_equipment_type_custom}`
        : (item.brew_equipment_type || "");
      if (item.brew_equipment_type_custom && !equipmentTypeOptions.value.some(option => option.value === typeValue)) {
        equipmentTypeOptions.value.push({ value: typeValue, label: item.brew_equipment_type_custom });
      }
      draft.value = {
        version: item.version,
        brew_factory_id: item.brew_factory_id?.id || "",
        brew_equipment_type: typeValue,
        brew_equipment_type_custom: item.brew_equipment_type_custom || "",
        name: item.name || "",
        brew_capacity_l: item.brew_capacity_l || 0,
        brew_tank_volume_l: item.brew_tank_volume_l || 0,
        brew_tank_count: item.brew_tank_count || item.tank_specs?.length || 1,
        tank_specs: (item.tank_specs || []).map(tank => ({ _key: tank.id ? `existing-${tank.id}` : tankDraftKey(), tank_type: tank.tank_type || (item.brew_equipment_type === "bright" ? "bright" : "fermentation"), name: tank.name || "", location_name: tank.location_name || "", capacity_l: tank.capacity_l || item.brew_tank_volume_l || 0 })),
        brew_saccharification_efficiency: item.brew_saccharification_efficiency || 0,
        brew_screen_water_l: item.brew_screen_water_l || 0,
        brew_whirlpool_time_min: item.brew_whirlpool_time_min || 0,
        brew_filtration_speed_l_min: item.brew_filtration_speed_l_min || 0
      };
      newEquipmentType.value = "";
      if (["fermentation", "bright"].includes(typeValue)) syncTankSpecs();
      editingItem.value = item;
      creating.value = true;
      error.value = "";
    }

    function addEquipmentType() {
      const label = newEquipmentType.value.trim();
      if (!label) return;
      const value = `custom:${label}`;
      if (!equipmentTypeOptions.value.some(item => item.value === value)) equipmentTypeOptions.value.push({ value, label });
      draft.value.brew_equipment_type = value;
      newEquipmentType.value = "";
    }

    function handleEquipmentTypeChange() {
      if (["fermentation", "bright"].includes(draft.value.brew_equipment_type)) syncTankSpecs();
    }

    function syncTankSpecs() {
      const count = Math.max(1, Number(draft.value.brew_tank_count) || 1);
      const specs = Array.isArray(draft.value.tank_specs) ? draft.value.tank_specs : [];
      while (specs.length < count) specs.push({ _key: tankDraftKey(), name: "", location_name: "", capacity_l: Number(draft.value.brew_tank_volume_l) || 0 });
      draft.value.tank_specs = specs.slice(0, count).map(item => ({ ...item, capacity_l: Number(draft.value.brew_tank_volume_l) || Number(item.capacity_l) || 0 }));
      draft.value.brew_tank_count = count;
    }

    function adjustTankCount(delta) {
      draft.value.brew_tank_count = Math.max(1, (Number(draft.value.brew_tank_count) || 1) + delta);
      syncTankSpecs();
    }

    function addTankSpec() {
      draft.value.brew_tank_count = (Number(draft.value.brew_tank_count) || 0) + 1;
      syncTankSpecs();
    }

    function addSystemTank(type = "fermentation") {
      draft.value.tank_specs.push({ _key: tankDraftKey(), tank_type: type, name: "", location_name: "", capacity_l: "" });
      draft.value.brew_tank_count = draft.value.tank_specs.length;
    }

    function removeSystemTank(tank) {
      const index = draft.value.tank_specs.indexOf(tank);
      if (index >= 0) draft.value.tank_specs.splice(index, 1);
      draft.value.brew_tank_count = draft.value.tank_specs.length;
    }

    function startAddSystemTank(system, type) {
      startEdit(system);
      addSystemTank(type);
    }

    function isSystemExpanded(systemId) {
      return expandedSystems.value.has(String(systemId));
    }

    function toggleSystemExpanded(systemId) {
      const next = new Set(expandedSystems.value);
      const key = String(systemId);
      if (next.has(key)) next.delete(key); else next.add(key);
      expandedSystems.value = next;
    }

    function autoTankLocation(tank, index = 0) {
      const factory = factories.value.find(item => Number(item.id) === Number(draft.value.brew_factory_id));
      const factoryName = factory?.name || "厂区";
      const systemName = String(draft.value.name || "酿造系统").trim();
      const tankName = String(tank?.name || `罐${index + 1}`).trim();
      return `${factoryName}-${systemName}-${tankName}`;
    }

    function removeTankSpec(index) {
      draft.value.tank_specs.splice(index, 1);
      draft.value.brew_tank_count = draft.value.tank_specs.length;
    }

    function adjustEquipmentNumber(field, delta) {
      const current = Number(draft.value[field]) || 0;
      draft.value[field] = Math.max(0, Number((current + delta).toFixed(2)));
    }

    function optionsFor(field) {
      if (field.options === "factories") return factories.value.map(item => ({ value: item.id, label: item.name }));
      if (isCategoryResource(currentResource.value.code) && field.key === "parent_id") return materialCategories.value.filter(item => !item.parent_id).map(item => ({ value: item.id, label: item.name }));
      if (field.key === "brew_material_category") return materialCategories.value.map(item => ({ value: item.code, label: item.name }));
      return (field.values || []).map(([value, label]) => ({ value, label }));
    }

    function generateMaterialCategoryCode(group = "category") {
      const suffix = window.crypto?.randomUUID ? window.crypto.randomUUID().replaceAll("-", "").slice(0, 12) : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      return `material_${group || "category"}_${suffix}`;
    }
    function generateCategoryCode(prefix = "category") {
      const suffix = window.crypto?.randomUUID ? window.crypto.randomUUID().replaceAll("-", "").slice(0, 12) : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      return `${prefix}_category_${suffix}`;
    }
    function generateWarehouseCode(type = "warehouse") {
      const suffix = window.crypto?.randomUUID ? window.crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase() : Date.now().toString(36).slice(-6).toUpperCase();
      return `WH-${type.slice(0, 3).toUpperCase()}-${suffix}`;
    }

    async function submitCreate() {
      saving.value = true;
      error.value = "";
      try {
        const current = currentResource.value;
        const payload = { ...draft.value };
        if (current.code === "users") {
          if (editingItem.value) {
            const updated = await brewApi.updateAdminUser(editingItem.value.id, { name: payload.name, login: payload.login, version: editingItem.value.version });
            await brewApi.updateAdminUserRoles(editingItem.value.id, { role_codes: [payload.role_code], version: updated.version });
          } else {
            await brewApi.createAdminUser({ name: payload.name, login: payload.login, password: payload.password, role_codes: [payload.role_code], supplier_id: payload.supplier_id || undefined });
          }
          creating.value = false; editingItem.value = null; await load(); return;
        }
        const isCategory = isCategoryResource(current.code);
        const isNewTopCategory = isCategory && !editingItem.value && !payload.parent_id;
        if (isCategory && !editingItem.value) payload.code = generateCategoryCode(isBeerCategory(current.code) ? "beer" : "material");
        if (current.code === "warehouses" && !editingItem.value) payload.code = generateWarehouseCode(payload.brew_warehouse_type);
        if (current.code === "equipment" && String(payload.brew_equipment_type).startsWith("custom:")) {
          payload.brew_equipment_type_custom = payload.brew_equipment_type.slice(7);
          payload.brew_equipment_type = "other";
        } else if (current.code === "equipment") {
          payload.brew_equipment_type_custom = "";
        }
        if (current.code === "equipment" && payload.brew_equipment_type === "mash") {
          payload.brew_tank_count = (payload.tank_specs || []).length;
          payload.brew_tank_volume_l = 0;
          const invalidSystemTank = (payload.tank_specs || []).find((item) => !["fermentation", "bright"].includes(item.tank_type) || !String(item.name || "").trim() || Number(item.capacity_l) <= 0);
          if (invalidSystemTank) throw new Error("请填写酿造系统下每个发酵罐/清酒罐的类型、罐号和容量。");
          const tankNames = new Set();
          for (const tank of payload.tank_specs || []) {
            const tankName = String(tank.name).trim();
            if (tankNames.has(tankName)) throw new Error(`罐号 ${tankName} 在当前酿造系统中重复。`);
            tankNames.add(tankName);
            const occupiedBy = items.value.find(item =>
              Number(item.id) !== Number(editingItem.value?.id) &&
              Number(item.brew_factory_id?.id || item.brew_factory_id) === Number(payload.brew_factory_id) &&
              (item.tank_specs || []).some(existing => String(existing.name || "").trim() === tankName)
            );
            if (occupiedBy) throw new Error(`厂区内罐号 ${tankName} 已属于“${occupiedBy.name}”，请使用其他罐号。`);
          }
          payload.tank_specs = (payload.tank_specs || []).map((item, index) => ({ tank_type: item.tank_type, name: item.name, capacity_l: Number(item.capacity_l), location_name: item.location_name || autoTankLocation(item, index) }));
        } else if (current.code === "equipment" && ["fermentation", "bright"].includes(payload.brew_equipment_type)) {
          // 发酵罐/清酒罐表单填写的是“设备体积”，提交时同步为后台使用的“罐体体积”。
          payload.brew_tank_volume_l = Number(payload.brew_tank_volume_l) || Number(payload.brew_capacity_l) || 0;
          payload.brew_tank_count = Number(payload.brew_tank_count) || 1;
          if (payload.brew_tank_volume_l <= 0) throw new Error("请填写发酵罐或清酒罐体积。");
          const invalidTank = (payload.tank_specs || []).find((item) => !String(item.name || "").trim());
          if (invalidTank) throw new Error("请填写每个罐体的罐号。");
          payload.tank_specs = (payload.tank_specs || []).slice(0, payload.brew_tank_count).map(item => ({
            tank_type: item.tank_type,
            name: item.name,
            location_name: item.location_name || autoTankLocation(item),
            capacity_l: Number(payload.brew_tank_volume_l) || 0
          }));
        } else if (current.code === "equipment") {
          payload.tank_specs = [];
          payload.brew_tank_count = 0;
          payload.brew_tank_volume_l = 0;
        }
        current.fields.filter(field => field.type === "number").forEach((field) => {
          if (payload[field.key] !== undefined && payload[field.key] !== "") payload[field.key] = Number(payload[field.key]);
        });
        if (current.rule) {
          try { payload.config = JSON.parse(payload.config || "{}"); } catch { throw new Error("规则配置必须是有效的 JSON 对象。"); }
          await brewApi.createRule(current.code, payload);
        } else {
          if (editingItem.value) {
            if (current.code === "products") payload.version = editingItem.value.version;
            await brewApi.updateMaster(current.code, editingItem.value.id, payload);
          } else {
            await brewApi.createMaster(current.code, payload);
          }
        }
        creating.value = false;
        editingItem.value = null;
        await load();
        if (isNewTopCategory) {
          const created = materialCategories.value.find(item => item.code === payload.code);
          if (created) {
            materialCategoryParent.value = created;
            startCreate();
          }
        }
      } catch (cause) {
        error.value = cause.message || "保存失败。";
      } finally {
        saving.value = false;
      }
    }
    function openProductDetail(item) { productDetail.value = item; }
    function closeProductEditor() { creating.value = false; editingItem.value = null; error.value = ""; }

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

    async function changeEquipmentState(item, action, deleting = false) {
      if (deleting && !window.confirm(`确定要删除设备“${item.name}”吗？删除后可通过启用恢复。`)) return;
      saving.value = true;
      error.value = "";
      try { await brewApi.masterAction("equipment", item.id, action, item.version); await load(); }
      catch (cause) { error.value = cause.message || "设备状态更新失败。"; }
      finally { saving.value = false; }
    }
    async function changeCategoryState(item, action, deleting = false) {
      if (deleting && !window.confirm(`确定要删除分类“${item.name}”吗？删除后可通过启用恢复。`)) return;
      saving.value = true;
      error.value = "";
      try {
        await brewApi.masterAction(selected.value, item.id, action, item.version);
        await load();
      } catch (cause) {
        error.value = cause.message || "分类状态更新失败。";
      } finally {
        saving.value = false;
      }
    }
    async function toggleEquipmentStatus(item) {
      if (item.active === false) {
        await changeEquipmentState(item, "restore");
        return;
      }
      saving.value = true;
      error.value = "";
      try { await brewApi.updateMaster("equipment", item.id, { brew_status: item.brew_status === "disabled" ? "available" : "disabled", version: item.version }); await load(); }
      catch (cause) { error.value = cause.message || "设备状态更新失败。"; }
      finally { saving.value = false; }
    }
    function equipmentStatusLabel(status, active = true) { return active === false ? "已删除" : (status === "disabled" ? "已停用" : "已启用"); }

    function describe(item) {
      const parts = [item.login, item.role_codes?.map(code => accountRoles.value.find(role => role.code === code)?.label || code).join("、"), item.supplier_name, item.code, item.default_code, item.brew_item_type === "finished_product" ? "成品啤酒" : item.brew_item_type === "semi_finished" ? "半成品酒液" : "", item.brew_beer_category_id?.name, item.brew_beer_subcategory_id?.name, item.brew_specification, item.address, item.phone, item.rule_kind && `版本 ${item.version}`, item.factory_id?.name, item.brew_factory_id?.name].filter(Boolean);
      return parts.join(" · ") || `ID ${item.id}`;
    }
    async function changeUserState(item) {
      saving.value = true; error.value = "";
      try { await brewApi.adminUserAction(item.id, item.active === false ? "enable" : "disable", item.version); await load(); }
      catch (cause) { error.value = cause.message || "账号状态更新失败。"; }
      finally { saving.value = false; }
    }

    function openMaterialCategory(item) { materialCategoryParent.value = item; }
    function clearMaterialCategoryParent() { materialCategoryParent.value = null; }
    function materialGroupLabel(value) { return { malt: "麦芽", hop: "啤酒花", yeast: "酵母", adjunct: "其他可发酵物", packaging: "包装材料" }[value] || value; }
    function materialCategoryChildCount(id) { return materialCategories.value.filter(item => Number(item.parent_id?.id || item.parent_id || 0) === Number(id)).length; }
    function openWarehouseFactory(factory) { warehouseFactory.value = factory; warehouseSelected.value = null; }
    function clearWarehouseSelection() { warehouseFactory.value = null; warehouseSelected.value = null; }
    function openWarehouse(warehouse) { warehouseSelected.value = warehouse; }
    function goWarehouseLevel(level) {
      if (level === "factory") clearWarehouseSelection();
      if (level === "warehouse" && warehouseFactory.value) warehouseSelected.value = null;
    }
    function warehouseLocationCount(warehouse) { return warehouseLocationsFor(warehouse).length; }
    function warehouseLocationsFor(warehouse) {
      const factoryId = Number(warehouse.brew_factory_id?.id || warehouse.brew_factory_id || 0);
      const rootId = Number(warehouse.lot_stock_id?.id || warehouse.lot_stock_id || 0);
      return warehouseLocations.value.filter(item => {
        const itemFactoryId = Number(item.brew_factory_id?.id || item.brew_factory_id || 0);
        const parentId = Number(item.location_id?.id || item.location_id || 0);
        // 仓库的 lot_stock_id 是 Odoo 自动生成的技术根库位，不作为业务库位展示；这里只显示它下面实际配置的库位。
        return itemFactoryId === factoryId && (!rootId || parentId === rootId) && Number(item.id) !== rootId;
      });
    }
    function startLocationCreate() { locationDraft.value = { name: "", brew_location_type: "" }; locationEditing.value = null; locationCreating.value = true; error.value = ""; }
    function startLocationEdit(location) {
      locationDraft.value = { name: location.location_name || location.name || "", brew_location_type: location.brew_location_type || "", version: location.version };
      locationEditing.value = location;
      locationCreating.value = true;
      error.value = "";
    }
    function editLocation(location) {
      if (location.tank?.equipment_id) {
        const equipment = equipmentItems.value.find(item => Number(item.id) === Number(location.tank.equipment_id));
        if (equipment) {
          startEdit(equipment);
          return;
        }
      }
      startLocationEdit(location);
    }
    function openLocationDetail(location) { locationDetail.value = location; }
    async function submitLocation() {
      saving.value = true;
      error.value = "";
      try {
        const payload = { ...locationDraft.value, brew_factory_id: warehouseFactory.value.id, usage: "internal" };
        if (!locationEditing.value) {
          payload.location_id = warehouseSelected.value.lot_stock_id?.id || warehouseSelected.value.lot_stock_id || "";
          await brewApi.createMaster("locations", payload);
        } else {
          await brewApi.updateMaster("locations", locationEditing.value.id, payload);
        }
        locationCreating.value = false;
        locationEditing.value = null;
        warehouseLocations.value = await brewApi.listMaster("locations", { page_size: 500 });
      } catch (cause) { error.value = cause.message || "库位保存失败。"; }
      finally { saving.value = false; }
    }
    function warehouseLocationTypeLabel(value) { return locationTypeOptions.find(option => option.value === value)?.label || value || "普通库位"; }
    function warehouseTypeLabel(value) { return warehouseTypeOptions.find(option => option.value === value)?.label || value || "仓库"; }
    function formatDateTime(value) { return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—"; }
    function tankTypeLabel(value) { return ({ fermentation: "发酵罐", bright: "清酒罐" })[value] || value || "罐体"; }
    function tankStatusLabel(value) { return ({ empty: "空罐", fermenting: "发酵中", conditioning: "后发酵", cold_crash: "冷贮", ready: "待包装", cleaning: "清洗中", maintenance: "维护中", abnormal: "异常" })[value] || value || "未知"; }
    async function changeMasterState(resource, item, action, deleting = false) {
      const confirmMessage = resource === "products"
        ? `确定归档产品“${item.name}”吗？归档后将无法用于新需求和生产计划，但可在产品列表恢复。`
        : `确定要删除“${item.name}”吗？删除后将不再显示。`;
      if (deleting && !window.confirm(confirmMessage)) return;
      saving.value = true;
      error.value = "";
      try {
        await brewApi.masterAction(resource, item.id, action, item.version);
        if (resource === "products") {
          await load();
        } else if (resource === "warehouses") {
          if (deleting) items.value = items.value.filter(row => Number(row.id) !== Number(item.id));
          else await load();
        } else if (resource === "suppliers") {
          await load();
        } else if (deleting) {
          warehouseLocations.value = warehouseLocations.value.filter(row => Number(row.id) !== Number(item.id));
        } else {
          warehouseLocations.value = await brewApi.listMaster("locations", { page_size: 500 });
        }
      } catch (cause) { error.value = cause.message || "状态更新失败。"; }
      finally { saving.value = false; }
    }
    function toggleWarehouseStatus(item) { return changeMasterState("warehouses", item, item.active === false ? "restore" : "archive"); }
    function toggleLocationStatus(item) { return changeMasterState("locations", item, item.active === false ? "restore" : "archive"); }
    function openEquipmentFactory(factory) { equipmentFactory.value = factory; equipmentWarehouse.value = null; equipmentLocation.value = null; }
    function openEquipmentWarehouse(warehouse) { equipmentWarehouse.value = warehouse; equipmentLocation.value = null; }
    function openEquipmentLocation(location) { equipmentLocation.value = location; }
    function goEquipmentLevel(level) {
      if (level === "factory") { equipmentFactory.value = null; equipmentWarehouse.value = null; equipmentLocation.value = null; }
      if (level === "warehouse" && equipmentFactory.value) { equipmentWarehouse.value = null; equipmentLocation.value = null; }
    }
    function equipmentWarehouseLocations(warehouse) {
      const factoryId = Number(warehouse.brew_factory_id?.id || warehouse.brew_factory_id || 0);
      const rootId = Number(warehouse.lot_stock_id?.id || warehouse.lot_stock_id || 0);
      return equipmentLocations.value.filter(item => {
        const itemFactoryId = Number(item.brew_factory_id?.id || item.brew_factory_id || 0);
        const parentId = Number(item.location_id?.id || item.location_id || 0);
        return itemFactoryId === factoryId && (!rootId || parentId === rootId) && Number(item.id) !== rootId;
      });
    }
    function equipmentLocationEquipment(location) {
      return items.value.filter(item => (item.tank_specs || []).some(tank => Number(tank.location_id) === Number(location.id)));
    }
    function equipmentTypeLabel(value) { return equipmentTypeOptions.value.find(option => option.value === value)?.label || value || "设备"; }
    function startCategoryDrag(item) { draggedCategory.value = item; }
    async function dropCategory(target) {
      const source = draggedCategory.value;
      draggedCategory.value = null;
      if (!source || source.id === target.id) return;
      const rows = [...materialCategoryRows.value];
      const from = rows.findIndex(item => item.id === source.id);
      const to = rows.findIndex(item => item.id === target.id);
      if (from < 0 || to < 0) return;
      rows.splice(from, 1);
      rows.splice(to, 0, source);
      rows.forEach((item, index) => { item.sequence = (index + 1) * 10; });
      materialCategories.value = [...materialCategories.value];
      saving.value = true;
      try {
        await Promise.all(rows.map(item => brewApi.updateMaster(selected.value, item.id, { sequence: item.sequence, version: item.version })));
        categoryNotice.value = "排序已保存。";
      } catch (cause) {
        error.value = cause.message || "排序保存失败。";
        await load();
      } finally { saving.value = false; }
    }

    function stateLabel(state) {
      return { draft: "草稿", active: "生效", inactive: "停用" }[state] || state;
    };

    onMounted(load);
    return { resources, selected, items, displayedItems, materialCategoryRows, productBeerSubcategories, productDetail, materialCategoryParent, categoryNotice, materialGroupOptions, warehouseFactoryRows, warehouseFactory, warehouseSelected, locationCreating, locationEditing, locationDetail, locationDraft, locationTypeOptions, warehouseTypeOptions, equipmentFactory, equipmentWarehouse, equipmentLocation, equipmentFactoryRows, equipmentFactoryEquipment, equipmentFactorySystems, equipmentFactoryOther, equipmentFactoryWarehouses, equipmentFactoryGeneral, loading, saving, creating, error, draft, factories, materialCategories, equipmentFactoryFilter, equipmentTypeOptions, newEquipmentType, editingItem, currentResource, canCreate, accountRoles, supplierItems, load, selectResource, startCreate, startCategoryCreate, startEdit, openProductDetail, closeProductEditor, startAddSystemTank, isSystemExpanded, toggleSystemExpanded, addEquipmentType, handleEquipmentTypeChange, syncTankSpecs, adjustTankCount, addTankSpec, addSystemTank, removeSystemTank, autoTankLocation, removeTankSpec, adjustEquipmentNumber, optionsFor, submitCreate, submitLocation, changeRuleState, changeEquipmentState, changeCategoryState, toggleEquipmentStatus, equipmentStatusLabel, describe, changeUserState, stateLabel, openMaterialCategory, clearMaterialCategoryParent, materialGroupLabel, materialCategoryChildCount, startCategoryDrag, dropCategory, openWarehouseFactory, clearWarehouseSelection, openWarehouse, goWarehouseLevel, warehouseLocationCount, warehouseLocationsFor, startLocationCreate, startLocationEdit, editLocation, openLocationDetail, warehouseLocationTypeLabel, warehouseTypeLabel, formatDateTime, tankTypeLabel, tankStatusLabel, changeMasterState, toggleWarehouseStatus, toggleLocationStatus, isCategoryResource, isBeerCategory, openEquipmentFactory, openEquipmentWarehouse, openEquipmentLocation, goEquipmentLevel, equipmentWarehouseLocations, equipmentLocationEquipment, equipmentTypeLabel };
  }
});

const SupplierCatalogPage = defineComponent({
  props: { permissions: { type: Array, default: () => [] } },
  emits: ["toast"],
  template: `
    <div class="supplier-catalog-page">
      <div class="supplier-catalog-toolbar"><div><strong>我的商品</strong><span>维护供应商的麦芽、可发酵物、啤酒花和酵母商品</span></div><button v-if="canManage" class="btn btn-primary" type="button" @click="showCreateModal = true">＋ 录入商品</button></div>
      <div class="supplier-catalog-grid">
        <form v-if="showCreateModal" class="equipment-modal-mask" @submit.prevent="submit">
          <div class="panel supplier-product-form supplier-product-modal">
          <div class="panel-header"><div><div class="panel-title">{{ editingItem ? '编辑商品' : '录入商品' }}</div><div class="panel-subtitle">{{ draft.group === 'yeast' ? '维护酵母商品信息，发酵度和风味描述将带入配方' : '选择系统已配置的原料分类，填写商品参数' }}</div></div></div>
          <div class="supplier-form-body">
            <div class="supplier-form-note">带 <i>*</i> 的项目为必填项。当前登录账号已绑定供应商，商品提交后会自动归属该供应商，酒厂端可在配方和采购环节使用。</div>
            <div class="supplier-form-section supplier-form-wide">基础必填信息</div>
            <label><span><i>*</i>大类</span><select v-model="draft.group" required @change="onGroupChange"><option value="">请选择大类</option><option v-for="item in groupOptions" :key="item.material_group" :value="item.material_group">{{ item.name }}</option></select></label>
            <label><span><i>*</i>小类</span><select v-model="draft.category" required :disabled="!draft.group"><option value="">请选择小类</option><option v-for="item in subcategoryOptions" :key="item.code" :value="item.code">{{ item.name }}</option></select></label>
            <label><span><i>*</i>商品名称</span><input v-model.trim="draft.name" required maxlength="100" :placeholder="draft.group === 'yeast' ? '请输入酵母商品名称' : '例如：进口澳麦'"></label>
            <label><span><i>*</i>品牌/生产商</span><input v-model.trim="draft.brand" required maxlength="100" :placeholder="draft.group === 'yeast' ? '请输入酵母品牌或生产商' : '例如：江苏新蕾麦芽'"></label>
            <label><span><i>*</i>{{ draft.group === 'yeast' ? '包装规格（克）' : '规格' }}</span><input v-model.trim="draft.specification" required maxlength="100" :placeholder="draft.group === 'yeast' ? '例如：500g/包' : '例如：25kg/袋'"></label>
            <label><span><i>*</i>{{ metricLabel }}</span><input v-model.number="draft.extract_rate" required type="number" min="0" max="100" step="0.1" :placeholder="draft.group === 'yeast' ? '例如：75（填写百分数）' : draft.group === 'hop' ? '例如：6.5' : '例如：81.5'"></label>
            <label v-if="['malt', 'adjunct'].includes(draft.group)"><span><i>*</i>色度(EBC)</span><input v-model.number="draft.color_ebc" required type="number" min="0" step="0.1" placeholder="例如：4.4"></label>
            <label v-if="draft.group === 'yeast'" class="supplier-form-wide"><span>风味描述（选填）</span><textarea v-model.trim="draft.flavor_desc" maxlength="500" rows="3" placeholder="请按产品资料填写酵母的香气和风味特征，例如：果香、酯香、口感等。选择该商品时会自动带入配方。"></textarea></label>
            <label><span><i>*</i>库存计量单位</span><select v-model="draft.weight_uom" required><option value="">请确认原商品计量单位</option><option value="kg">kg</option><option value="g">g</option></select></label>
            <div v-if="editingItem && !editingItem.is_weight_uom" class="supplier-form-note supplier-form-wide">该旧商品使用非重量单位。请先核对商品数量、价格对应的单位；已有库存业务的商品不能直接更换单位，应建立正确单位的新商品。</div>
            <label><span><i>*</i>商品价格(元/{{ draft.weight_uom || '单位' }})</span><input v-model.number="draft.price" required type="number" min="0" step="0.01" placeholder="例如：3200"></label>
            <label><span><i>*</i>商品数量</span><input v-model.number="draft.quantity" required type="number" min="0" step="0.01" placeholder="例如：1000"></label>
            <div class="supplier-form-section supplier-form-wide">补充信息（选填）</div>
            <label><span>产品编号</span><input v-model.trim="draft.code" maxlength="64" placeholder="供应商内部编号"></label>
            <label><span>保质期(天)</span><input v-model.number="draft.shelf_life_days" type="number" min="0" step="1" placeholder="选填"></label>
            <label><span>批次号</span><input v-model.trim="draft.batch_no" maxlength="64" placeholder="例如：184"></label>
            <label><span>生产日期</span><input v-model="draft.production_date" type="date"></label>
            <label><span>出厂日期</span><input v-model="draft.release_date" type="date"></label>
            <template v-if="draft.group !== 'yeast'">
              <label><span>水分(%)</span><input v-model.number="draft.moisture_pct" type="number" min="0" step="0.1" placeholder="例如：4.4"></label>
              <label><span>总蛋白(%)</span><input v-model.number="draft.total_protein_pct" type="number" min="0" step="0.1" placeholder="麦芽检测值"></label>
              <label><span>浸出物(干基)(%)</span><input v-model.number="draft.extract_dry_pct" type="number" min="0" max="100" step="0.1" placeholder="例如：81.5"></label>
              <label><span>风味描述/备注</span><input v-model.trim="draft.flavor_desc" maxlength="500" placeholder="原料香气、风味或质量说明"></label>
            </template>
            <template v-if="draft.group === 'malt'">
              <div class="supplier-form-section supplier-form-wide">麦芽分析指标（选填）</div>
              <label><span>麦芽级别</span><input v-model.trim="draft.malt_class" placeholder="例如：优等品"></label>
              <label><span>大麦品种</span><input v-model.trim="draft.barley_variety" placeholder="例如：进口澳麦"></label>
              <label><span>糖化力(WK)</span><input v-model.number="draft.diastatic_power_wk" type="number" min="0" step="1" placeholder="例如：318"></label>
              <label><span>脆度(%)</span><input v-model.number="draft.friability_pct" type="number" min="0" max="100" step="0.1" placeholder="例如：83"></label>
              <label><span>库尔巴哈值(%)</span><input v-model.number="draft.kolbach_index_pct" type="number" min="0" max="100" step="0.1" placeholder="例如：42.7"></label>
              <label><span>β-葡聚糖(mg/L)</span><input v-model.number="draft.beta_dextran_mg_l" type="number" min="0" step="0.1" placeholder="例如：69"></label>
              <label><span>α-氨基氮(mg/100g)</span><input v-model.number="draft.fan_mg_100g" type="number" min="0" step="0.1" placeholder="例如：162"></label>
              <label><span>总氮(%)</span><input v-model.number="draft.total_nitrogen_pct" type="number" min="0" step="0.001" placeholder="选填"></label>
              <label><span>可溶性氮(%)</span><input v-model.number="draft.soluble_nitrogen_pct" type="number" min="0" step="0.001" placeholder="选填"></label>
              <label><span>过滤时间(min/300ml)</span><input v-model.number="draft.filtration_time_min" type="number" min="0" step="0.1" placeholder="例如：30"></label>
              <label><span>糖化时间(min)</span><input v-model.number="draft.saccharification_time_min" type="number" min="0" step="0.1" placeholder="例如：9"></label>
              <label><span>夹杂物(%)</span><input v-model.number="draft.impurity_pct" type="number" min="0" step="0.1" placeholder="例如：0.3"></label>
              <label><span>粗细粉差(F/C)(%)</span><input v-model.number="draft.fc_difference_pct" type="number" min="0" step="0.1" placeholder="例如：1.1"></label>
              <label><span>发芽率(%)</span><input v-model.number="draft.germination_rate_pct" type="number" min="0" max="100" step="0.1" placeholder="例如：95"></label>
              <label><span>pH</span><input v-model.number="draft.ph" type="number" min="0" max="14" step="0.01" placeholder="例如：5.95"></label>
              <label><span>总酸(ml/100ml)</span><input v-model.number="draft.total_acidity" type="number" min="0" step="0.01" placeholder="例如：1.04"></label>
              <label><span>煮沸色度(EBC)</span><input v-model.number="draft.boiled_color_ebc" type="number" min="0" step="0.1" placeholder="例如：8.5"></label>
              <label><span>浊度(EBC)</span><input v-model.number="draft.turbidity_ebc" type="number" min="0" step="0.1" placeholder="例如：1.0"></label>
              <label><span>OTA(μg/kg)</span><input v-model.number="draft.ota_ug_kg" type="number" min="0" step="0.01" placeholder="未检出可不填"></label>
              <label><span>脱氧雪腐镰刀菌烯醇(μg/kg)</span><input v-model.number="draft.fusarium_ug_kg" type="number" min="0" step="0.01" placeholder="未检出可不填"></label>
              <label><span>样品来源</span><input v-model.trim="draft.sample_source" placeholder="例如：澳麦麦芽"></label>
              <label class="supplier-form-wide"><span>口感品评</span><textarea v-model.trim="draft.sensory_desc" rows="2" placeholder="香气、口感、是否有酸味/泥味等"></textarea></label>
            </template>
          </div>
          <div class="supplier-form-footer"><div v-if="error" class="master-error">{{ error }}</div><button class="btn btn-secondary" type="button" @click="closeEditor">取消</button><button class="btn btn-primary" type="submit" :disabled="saving || !canManage">{{ saving ? '保存中...' : (editingItem ? '保存修改' : '保存商品') }}</button></div>
          </div>
        </form>
        <section class="panel supplier-product-list">
          <div class="panel-header"><div><div class="panel-title">已录入商品</div><div class="panel-subtitle">当前账号创建的商品</div></div><button class="btn btn-sm btn-secondary" type="button" @click="load">刷新</button></div>
          <div v-if="loading" class="empty">正在加载...</div>
          <div v-else-if="listError" class="master-error">{{ listError }}</div>
          <div v-else-if="!materials.length" class="supplier-empty"><strong>还没有商品</strong><span>从左侧开始录入第一条商品</span></div>
          <div v-else class="supplier-product-table"><div class="supplier-product-row supplier-product-head"><span>商品名称</span><span>大类/小类</span><span>价格</span><span>数量</span><span>色度</span><span>操作</span></div><div v-for="item in materials" :key="item.id" class="supplier-product-row"><strong>{{ item.name }}</strong><span>{{ groupLabel(item.brew_material_category) }} · {{ categoryLabel(item.brew_material_category) }}</span><span>¥{{ item.brew_supplier_price ?? '—' }}</span><span>{{ item.brew_supplier_quantity ?? '—' }}</span><span>{{ item.brew_color_ebc ?? '—' }} EBC</span><span class="supplier-product-actions"><button class="btn btn-xs btn-outline" type="button" @click="startEdit(item)">编辑</button><button class="btn btn-xs btn-danger" type="button" @click="remove(item)">删除</button></span></div></div>
        </section>
      </div>
    </div>
  `,
  setup(props, { emit }) {
    const materials = ref([]);
    const categories = ref([]);
    const loading = ref(false);
    const saving = ref(false);
    const listError = ref("");
    const error = ref("");
    const showCreateModal = ref(false);
    const editingItem = ref(null);
    const draft = reactive({ weight_uom: "kg", group: "", category: "", name: "", brand: "", code: "", specification: "", extract_rate: "", color_ebc: "", price: "", quantity: "", shelf_life_days: "", batch_no: "", production_date: "", release_date: "", moisture_pct: "", total_protein_pct: "", extract_dry_pct: "", flavor_desc: "", malt_class: "", barley_variety: "", diastatic_power_wk: "", friability_pct: "", kolbach_index_pct: "", beta_dextran_mg_l: "", fan_mg_100g: "", total_nitrogen_pct: "", soluble_nitrogen_pct: "", filtration_time_min: "", saccharification_time_min: "", impurity_pct: "", fc_difference_pct: "", germination_rate_pct: "", ph: "", total_acidity: "", boiled_color_ebc: "", turbidity_ebc: "", ota_ug_kg: "", fusarium_ug_kg: "", sample_source: "", sensory_desc: "" });
    const canManage = computed(() => props.permissions.includes("supplier.catalog.manage"));
    const groupOptions = computed(() => categories.value.filter(item => !item.parent_id && item.code === item.material_group && ["malt", "adjunct", "hop", "yeast"].includes(item.material_group)));
    const subcategoryOptions = computed(() => categories.value.filter(item => item.material_group === draft.group && String(item.parent_id?.id || item.parent_id || "") === String(groupOptions.value.find(group => group.material_group === draft.group)?.id || "")));
    const metricLabel = computed(() => ({ malt: "浸出率(%)", adjunct: "浸出率/发酵度(%)", hop: "Alpha酸(%)", yeast: "发酵度(%)" })[draft.group] || "浸出率/发酵度(%)");
    function onGroupChange() { draft.category = subcategoryOptions.value[0]?.code || ""; if (!["malt", "adjunct"].includes(draft.group)) draft.color_ebc = 0; }
    function categoryLabel(code) { return categories.value.find(item => item.code === code)?.name || code || "—"; }
    function groupLabel(code) { const item = categories.value.find(row => row.code === code); return { malt: "麦芽", adjunct: "其他可发酵物", hop: "啤酒花", yeast: "酵母" }[item?.material_group] || "—"; }
    function reset() { Object.assign(draft, { weight_uom: "kg", group: "", category: "", name: "", brand: "", code: "", specification: "", extract_rate: "", color_ebc: "", price: "", quantity: "", shelf_life_days: "", batch_no: "", production_date: "", release_date: "", moisture_pct: "", total_protein_pct: "", extract_dry_pct: "", flavor_desc: "", malt_class: "", barley_variety: "", diastatic_power_wk: "", friability_pct: "", kolbach_index_pct: "", beta_dextran_mg_l: "", fan_mg_100g: "", total_nitrogen_pct: "", soluble_nitrogen_pct: "", filtration_time_min: "", saccharification_time_min: "", impurity_pct: "", fc_difference_pct: "", germination_rate_pct: "", ph: "", total_acidity: "", boiled_color_ebc: "", turbidity_ebc: "", ota_ug_kg: "", fusarium_ug_kg: "", sample_source: "", sensory_desc: "" }); }
    function closeEditor() { showCreateModal.value = false; editingItem.value = null; error.value = ""; reset(); }
    function startEdit(item) {
      editingItem.value = item;
      draft.weight_uom = item.weight_uom || '';
      Object.assign(draft, { group: categories.value.find(row => row.code === item.brew_material_category)?.material_group || "", category: item.brew_material_category || "", name: item.name || "", brand: item.brew_brand || "", code: item.default_code || "", specification: item.brew_specification || "", extract_rate: item.brew_extract_rate ?? "", color_ebc: item.brew_color_ebc ?? "", price: item.brew_supplier_price ?? "", quantity: item.brew_supplier_quantity ?? "", shelf_life_days: item.brew_shelf_life_days ?? "", batch_no: item.brew_batch_no || "", production_date: item.brew_production_date || "", release_date: item.brew_release_date || "", moisture_pct: item.brew_moisture_pct ?? "", total_protein_pct: item.brew_total_protein_pct ?? "", extract_dry_pct: item.brew_extract_dry_pct ?? "", flavor_desc: item.brew_flavor_desc || "", malt_class: item.brew_malt_class || "", barley_variety: item.brew_barley_variety || "", diastatic_power_wk: item.brew_diastatic_power_wk ?? "", friability_pct: item.brew_friability_pct ?? "", kolbach_index_pct: item.brew_kolbach_index_pct ?? "", beta_dextran_mg_l: item.brew_beta_dextran_mg_l ?? "", fan_mg_100g: item.brew_fan_mg_100g ?? "", total_nitrogen_pct: item.brew_total_nitrogen_pct ?? "", soluble_nitrogen_pct: item.brew_soluble_nitrogen_pct ?? "", filtration_time_min: item.brew_filtration_time_min ?? "", saccharification_time_min: item.brew_saccharification_time_min ?? "", impurity_pct: item.brew_impurity_pct ?? "", fc_difference_pct: item.brew_fc_difference_pct ?? "", germination_rate_pct: item.brew_germination_rate_pct ?? "", ph: item.brew_ph ?? "", total_acidity: item.brew_total_acidity ?? "", boiled_color_ebc: item.brew_boiled_color_ebc ?? "", turbidity_ebc: item.brew_turbidity_ebc ?? "", ota_ug_kg: item.brew_ota_ug_kg ?? "", fusarium_ug_kg: item.brew_fusarium_ug_kg ?? "", sample_source: item.brew_sample_source || "", sensory_desc: item.brew_sensory_desc || "" });
      showCreateModal.value = true;
    }
    async function load() {
      loading.value = true; listError.value = "";
      try { [materials.value, categories.value] = await Promise.all([brewApi.listMaster("materials", { page_size: 100, active: true }), brewApi.listMaster("material-categories", { page_size: 200, active: true })]); materials.value = materials.value.filter(item => item.brew_item_type === "raw_material"); }
      catch (cause) { listError.value = cause.message || "商品加载失败。"; }
      finally { loading.value = false; }
    }
    async function submit() {
      saving.value = true; error.value = "";
      try {
        const requiredFields = [
          ["商品名称", draft.name],
          ["品牌/生产商", draft.brand],
          ["规格", draft.specification],
          ["商品价格", draft.price],
          ["商品数量", draft.quantity],
        ];
        requiredFields.push([metricLabel.value, draft.extract_rate]);
        if (["malt", "adjunct"].includes(draft.group)) requiredFields.push(["色度", draft.color_ebc]);
        const missing = requiredFields.find(([, value]) => value === "" || value === null || value === undefined || (typeof value === "string" && !value.trim()));
        if (missing) throw new Error(`${missing[0]}不能为空。`);
        if (!draft.category || !subcategoryOptions.value.some(item => item.code === draft.category)) throw new Error("请选择系统已有的小类。");
        const optional = (value, type = "number") => value === "" || value === null || value === undefined ? undefined : type === "number" ? Number(value) : value;
        const payload = { name: draft.name, default_code: draft.code, brew_item_type: "raw_material", brew_material_category: draft.category, brew_brand: draft.brand, brew_specification: draft.specification, brew_extract_rate: Number(draft.extract_rate), brew_color_ebc: Number(draft.color_ebc || 0), brew_alpha_acid: draft.group === "hop" ? Number(draft.extract_rate) : 0, brew_supplier_price: Number(draft.price), brew_supplier_quantity: Number(draft.quantity), brew_shelf_life_days: optional(draft.shelf_life_days), brew_batch_no: draft.batch_no, brew_production_date: draft.production_date || undefined, brew_release_date: draft.release_date || undefined, brew_moisture_pct: optional(draft.moisture_pct), brew_total_protein_pct: optional(draft.total_protein_pct), brew_extract_dry_pct: optional(draft.extract_dry_pct), brew_flavor_desc: draft.flavor_desc, brew_malt_class: draft.malt_class, brew_barley_variety: draft.barley_variety, brew_diastatic_power_wk: optional(draft.diastatic_power_wk), brew_friability_pct: optional(draft.friability_pct), brew_kolbach_index_pct: optional(draft.kolbach_index_pct), brew_beta_dextran_mg_l: optional(draft.beta_dextran_mg_l), brew_fan_mg_100g: optional(draft.fan_mg_100g), brew_total_nitrogen_pct: optional(draft.total_nitrogen_pct), brew_soluble_nitrogen_pct: optional(draft.soluble_nitrogen_pct), brew_filtration_time_min: optional(draft.filtration_time_min), brew_saccharification_time_min: optional(draft.saccharification_time_min), brew_impurity_pct: optional(draft.impurity_pct), brew_fc_difference_pct: optional(draft.fc_difference_pct), brew_germination_rate_pct: optional(draft.germination_rate_pct), brew_ph: optional(draft.ph), brew_total_acidity: optional(draft.total_acidity), brew_boiled_color_ebc: optional(draft.boiled_color_ebc), brew_turbidity_ebc: optional(draft.turbidity_ebc), brew_ota_ug_kg: optional(draft.ota_ug_kg), brew_fusarium_ug_kg: optional(draft.fusarium_ug_kg), brew_sample_source: draft.sample_source, brew_sensory_desc: draft.sensory_desc };
        const wasEditing = Boolean(editingItem.value);
        payload.weight_uom = draft.weight_uom;
        if (wasEditing) await brewApi.updateMaster("materials", editingItem.value.id, { ...payload, version: editingItem.value.version });
        else await brewApi.createMaster("materials", payload);
        closeEditor(); await load(); emit("toast", wasEditing ? "商品已更新" : "商品已保存");
      } catch (cause) { error.value = cause.message || "商品保存失败。"; }
      finally { saving.value = false; }
    }
    async function remove(item) {
      if (!window.confirm(`确定要删除“${item.name}”吗？删除后将不再显示。`)) return;
      try { await brewApi.masterAction("materials", item.id, "archive", item.version); await load(); emit("toast", "商品已删除"); }
      catch (cause) { error.value = cause.message || "商品删除失败。"; }
    }
    onMounted(load);
    return { materials, loading, saving, listError, error, draft, showCreateModal, editingItem, canManage, metricLabel, groupOptions, subcategoryOptions, onGroupChange, categoryLabel, groupLabel, load, submit, startEdit, closeEditor, remove };
  }
});

const TasksPage = defineComponent({
  components: { StatCard, TaskCard, StatusTag, ProductionPlanDetail },
  emits: ["open-recipe-review"],
  setup(_props, { emit }) {
    const tasks = ref([]);
    const approvals = ref([]);
    const loading = ref(false);
    const error = ref("");
    const reviewDemand = ref(null);
    const reviewReason = ref("");
    const reviewError = ref("");
    const reviewSaving = ref(false);
    const executionTask = ref(null);
    const executionError = ref("");
    const executionSaving = ref(false);
    const executionValues = ref({});
    const checkpointNow = ref(Date.now());
    const openTasks = computed(() => tasks.value.filter(task => !["done", "cancelled"].includes(task.state)));
    const finishedTasks = computed(() => tasks.value.filter(task => ["done", "cancelled"].includes(task.state)));
    const taskFilter = ref("pending");
    const taskFilterLabels = { pending: "待处理", urgent: "紧急任务", done: "已完成", all: "全部任务" };
    const visibleTasks = computed(() => {
      if (taskFilter.value === "pending") return openTasks.value;
      if (taskFilter.value === "urgent") return openTasks.value.filter(task => task.priority === "2");
      if (taskFilter.value === "done") return finishedTasks.value;
      return tasks.value;
    });
    const selectedBatchPlan = ref(null);
    const selectedProductionTask = ref(null);
    const batchTaskGroups = computed(() => {
      const groups = new Map();
      for (const task of visibleTasks.value.filter(item => item.target_model === 'brew.production.plan' && ['mashing','fermentation','material_preparation'].includes(item.task_type))) {
        const group = groups.get(task.target_id) || { planId: task.target_id, name: task.batch?.name || task.plan?.name || task.name, product: task.plan?.product, volume: task.plan?.planned_volume_l, state: task.plan?.state, tasks: [] };
        group.tasks.push(task); groups.set(task.target_id, group);
      }
      return [...groups.values()];
    });
    const otherTasks = computed(() => visibleTasks.value.filter(item => item.target_model !== 'brew.production.plan' || !['mashing','fermentation','material_preparation'].includes(item.task_type)));
    function approvalTask(item) {
      return {
        id: 'approval-' + item.id,
        name: item.name || item.approval_type,
        task_type: '采购审批',
        approval_type: item.approval_type,
        approval_id: item.id,
        role_code: item.role_code,
        target_model: item.target_model,
        target_id: item.target_id,
        return_reason: item.return_reason || (item.target_model === 'purchase.order' ? item.comment : ''),
        priority: item.request_type === 'emergency' ? '2' : '1',
        state: item.state === 'pending' ? 'pending' : 'done',
        approval_state: item.instance_state || item.state,
        assignee: null,
        due_at: null,
        last_comment: item.comment || item.return_reason || '',
        version: item.version,
      };
    }
    async function load() {
      loading.value = true;
      error.value = "";
      try {
        const [taskData, approvalData] = await Promise.all([brewApi.getTasks(), brewApi.listApprovals()]);
        approvals.value = approvalData || [];
        tasks.value = [...(taskData || []), approvals.value.map(approvalTask)];
        tasks.value = tasks.value.flat();
      }
      catch (cause) { error.value = cause.message || "任务加载失败。"; }
      finally { loading.value = false; }
    }
    function stateLabel(task) {
      if (task.target_model === 'brew.production.plan' && ['mashing','fermentation'].includes(task.task_type) && ['pending','claimed'].includes(task.state)) return '待执行';
      if (task.approval_id) return ({ pending: '待审批', done: task.approval_state === 'returned' ? '已退回' : '已同意' })[task.state] || task.state;
      if (task.state === "done" && ["recipe_review", "demand_review"].includes(task.task_type) && task.last_comment?.startsWith("退回修改：")) return "已退回修改";
      if (task.state === "pending" && task.task_type === "recipe_revision") return "待修改";
      return ({ pending: "待领取", claimed: "已领取", in_progress: "进行中", done: "已完成", returned: "已退回", cancelled: "已取消" })[task.state] || task.state;
    }
    function taskTypeLabel(task) { return ({ recipe_review: "配方审核", recipe_revision: "配方修改", demand_review: "产品需求确认", mashing: "糖化执行", fermentation: "发酵执行", material_preparation: "备料" })[task.task_type] || task.task_type; }
    function taskComment(task) { return (task.last_comment || "").replace(/^(退回修改：|审核通过：)/, ""); }
    function checkpointCompletedTime(value) {
      if (!value) return '';
      const raw = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`;
      const date = new Date(raw);
      return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }) : '';
    }
    function checkpointDate(node, checkpoints) {
      if (!node?.timer_from || node.due_after_min === undefined) return "";
      const anchor = checkpoints.find(item => item.code === node.timer_from);
      if (!anchor?.completed_at) return "等待计时开始";
      const raw = anchor.completed_at;
      const start = Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
      return Number.isFinite(start) ? new Date(start + Number(node.due_after_min) * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "等待计时开始";
    }
    function openMashExecution(task) { executionError.value = ""; executionValues.value = {}; executionTask.value = task; }
    async function confirmMashCheckpoint(node, value = "") {
      if (!executionTask.value) return;
      executionError.value = "";
      if (node.input_mode === "number" && (value === "" || !Number.isFinite(Number(value)))) { executionError.value = "请输入有效数字后再确认。"; return; }
      executionSaving.value = true;
      try {
        const updated = await brewApi.taskAction(executionTask.value.id, "checkpoint", { version: executionTask.value.version, checkpoint_key: node.code, value });
        executionTask.value = updated;
        const index = tasks.value.findIndex(item => item.id === updated.id);
        if (index >= 0) tasks.value[index] = updated;
        executionValues.value[node.code] = "";
      } catch (cause) {
        executionError.value = cause.message || "节点确认失败。";
        try { await load(); executionTask.value = tasks.value.find(item => item.id === executionTask.value?.id) || executionTask.value; } catch (_) {}
      } finally { executionSaving.value = false; }
    }
    async function completeMashExecution() {
      if (!executionTask.value) return;
      executionSaving.value = true; executionError.value = "";
      try {
        await brewApi.taskAction(executionTask.value.id, "submit", { version: executionTask.value.version, comment: "糖化执行节点已全部确认" });
        executionTask.value = null; await load();
      } catch (cause) { executionError.value = cause.message || "糖化任务完成失败。"; }
      finally { executionSaving.value = false; }
    }
    async function resolveApproval(task, action) {
      let comment = '';
      if (action === 'return') {
        comment = window.prompt('请输入退回原因', '');
        if (comment === null || !comment.trim()) return;
      }
      try {
        await brewApi.approvalAction(task.approval_id, action, { version: task.version, comment: comment.trim() });
        await load();
      } catch (cause) { error.value = cause.message || '审批处理失败'; }
    }    async function openDemandReview(id) {
      reviewReason.value = "";
      reviewError.value = "";
      try { reviewDemand.value = await brewApi.getDemand(id); }
      catch (cause) { error.value = cause.message || "产品需求加载失败。"; }
    }
    async function resolveDemand(action) {
      if (!reviewDemand.value) return;
      if (action === "return" && !reviewReason.value.trim()) { reviewError.value = "请填写退回原因。"; return; }
      reviewSaving.value = true;
      reviewError.value = "";
      try {
        await brewApi.demandAction(reviewDemand.value.id, action, reviewDemand.value.version, reviewReason.value.trim());
        reviewDemand.value = null;
        await load();
      } catch (cause) { reviewError.value = cause.message || "处理需求失败。"; }
      finally { reviewSaving.value = false; }
    }
    let checkpointTicker;
    onMounted(() => { load(); checkpointTicker = window.setInterval(() => { checkpointNow.value = Date.now(); }, 15000); });
    onUnmounted(() => window.clearInterval(checkpointTicker));
    return { selectedProductionTask, selectedBatchPlan, batchTaskGroups, otherTasks, tasks, openTasks, finishedTasks, taskFilter, taskFilterLabels, visibleTasks, loading, error, reviewDemand, reviewReason, reviewError, reviewSaving, executionTask, executionError, executionSaving, executionValues, checkpointNow, checkpointDate, checkpointCompletedTime, openMashExecution, confirmMashCheckpoint, completeMashExecution, load, stateLabel, taskTypeLabel, taskComment, demandPackagingSummary, openDemandReview, resolveDemand, resolveApproval, openRecipeReview: (id) => emit("open-recipe-review", id) };
  },
  template: `
    <div class="stats-grid">
      <button class="stat-card task-stat-card" :class="{ active: taskFilter === 'pending' }" @click="taskFilter = 'pending'"><div class="stat-head"><div class="stat-label">待处理</div><div class="mono">●</div></div><div class="stat-value">{{ openTasks.length }}</div><div class="stat-change warn">当前账号可处理</div></button>
      <button class="stat-card task-stat-card" :class="{ active: taskFilter === 'urgent' }" @click="taskFilter = 'urgent'"><div class="stat-head"><div class="stat-label">紧急任务</div><div class="mono">●</div></div><div class="stat-value">{{ openTasks.filter(t => t.priority === '2').length }}</div><div class="stat-change down">按优先级统计</div></button>
      <button class="stat-card task-stat-card" :class="{ active: taskFilter === 'done' }" @click="taskFilter = 'done'"><div class="stat-head"><div class="stat-label">已完成</div><div class="mono">●</div></div><div class="stat-value">{{ finishedTasks.length }}</div><div class="stat-change up">含已退回审核记录</div></button>
      <button class="stat-card task-stat-card" :class="{ active: taskFilter === 'all' }" @click="taskFilter = 'all'"><div class="stat-head"><div class="stat-label">全部任务</div><div class="mono">●</div></div><div class="stat-value">{{ tasks.length }}</div><div class="stat-change up">角色与本人范围</div></button>
    </div>
    <section v-if="batchTaskGroups.length" class="panel"><div class="panel-header"><div class="panel-title">我的生产任务</div><button class="btn btn-sm btn-secondary" @click="load">刷新</button></div><div class="panel-body production-own-batches"><article v-for="group in batchTaskGroups" :key="group.planId" class="production-own-batch"><header><div><strong>{{ group.name }}</strong><span>{{ group.product }} · {{ group.volume }} L</span></div><button class="btn btn-xs btn-outline" @click="selectedProductionTask = null; selectedBatchPlan = group.planId">查看批次流程</button></header><button v-for="task in group.tasks" :key="task.id" class="production-own-task" @click="selectedProductionTask = task.id; selectedBatchPlan = group.planId"><div class="production-own-task-icon" :class="task.task_type">{{ task.task_type === 'mashing' ? '糖' : task.task_type === 'fermentation' ? '酵' : '料' }}</div><div class="production-own-task-main"><strong>{{ task.name }}</strong><span>{{ task.assignee?.name || '仓库人员' }}<template v-if="task.task_type === 'fermentation' && task.fermentation_execution?.started_at && task.state === 'in_progress'"> · 发酵第 {{ task.fermentation_execution.day }} 天 · 待办 {{ task.fermentation_execution.entries.filter(entry => ['pending','overdue'].includes(entry.status)).length }} 项</template><template v-if="task.execution_blocked_reason && !['done','cancelled'].includes(task.state)"> · {{ task.execution_blocked_reason }}</template></span></div><StatusTag :text="stateLabel(task)" /><b>查看 / 执行 →</b></button></article></div></section>
    <ProductionPlanDetail :plan-id="selectedBatchPlan" :focus-task-id="selectedProductionTask" :allow-execution="true" @close="selectedBatchPlan = null" @changed="load" @open-task="selectedBatchPlan = null; openMashExecution($event)" />
    <div class="panel"><div class="panel-header"><div class="panel-title">{{ taskFilterLabels[taskFilter] }}</div><button class="btn btn-sm btn-secondary" @click="load">刷新</button></div><div class="panel-body task-list"><div v-if="loading" class="empty">正在加载...</div><div v-else-if="error" class="master-error">{{ error }}</div><div v-for="task in otherTasks" v-else :key="task.id" class="task-card task-card-rich"><div class="task-kind-icon" :class="['recipe_review','recipe_revision'].includes(task.task_type) ? 'recipe-review-icon' : 'generic-task-icon'"><svg v-if="['recipe_review','recipe_revision'].includes(task.task_type)" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1-2-2Z"/><path d="M14 3.75v4h4M8.5 12h7M8.5 15.5h5M8.5 8.5h2"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v13H5zM8 9h8M8 12h8M8 15h5"/></svg></div><div class="task-card-content"><div class="task-title">{{ task.name }}</div><div class="task-meta"><span class="task-type-pill" :class="{ recipe: ['recipe_review','recipe_revision'].includes(task.task_type) }">{{ taskTypeLabel(task) }}</span><span v-if="task.due_at">截止 {{ task.due_at.replace('T',' ').slice(0,16) }}</span><span v-if="task.assignee?.name">处理人 {{ task.assignee.name }}</span></div><div v-if="task.last_comment" class="task-review-note"><strong>{{ task.task_type === 'recipe_revision' || (task.state === 'done' && task.last_comment.startsWith('退回修改：')) ? '退回意见' : '处理备注' }}</strong><span>{{ taskComment(task) }}</span></div></div><div class="task-card-actions"><StatusTag :text="stateLabel(task)" /><button v-if="task.task_type === 'mashing'" class="btn btn-xs btn-outline" @click="openMashExecution(task)">打开糖化执行清单</button><button v-else-if="task.task_type === 'recipe_review' && !['done','cancelled'].includes(task.state)" class="btn btn-xs btn-outline" @click="openRecipeReview(task.target_id)">查看配方并审核</button><button v-else-if="task.task_type === 'recipe_review'" class="btn btn-xs btn-outline" @click="openRecipeReview(task.target_id)">查看审核流程</button><button v-else-if="task.task_type === 'recipe_revision' && !['done','cancelled'].includes(task.state)" class="btn btn-xs btn-outline" @click="openRecipeReview(task.target_id)">修改配方并重新提交</button><button v-else-if="task.task_type === 'recipe_revision'" class="btn btn-xs btn-outline" @click="openRecipeReview(task.target_id)">查看配方版本</button><button v-else-if="task.task_type === 'demand_review'" class="btn btn-xs btn-outline" @click="openDemandReview(task.target_id)">{{ ['done','cancelled'].includes(task.state) ? '查看需求' : '查看并确认需求' }}</button><template v-else-if="task.approval_id && task.state === 'pending'"><button class="btn btn-xs btn-outline" @click="resolveApproval(task, 'return')">退回</button><button class="btn btn-xs btn-primary" @click="resolveApproval(task, 'approve')">通过</button></template></div></div><div v-if="!loading && !error && !visibleTasks.length" class="empty">{{ taskFilter === 'pending' ? '当前角色暂无待办' : taskFilter === 'urgent' ? '当前没有紧急任务' : taskFilter === 'done' ? '暂无已完成任务' : '暂无任务记录' }}</div></div></div>
    <div v-if="reviewDemand" class="equipment-modal-mask" @click.self="reviewDemand = null"><section class="equipment-modal demand-review-modal" role="dialog" aria-modal="true" aria-label="确认产品需求"><div class="equipment-modal-header"><div><div class="modal-title">确认产品需求 · {{ reviewDemand.product?.name || '' }}</div><div class="modal-subtitle">核对产品、包装和交付要求后给出结论</div></div><button class="equipment-close" type="button" aria-label="关闭" @click="reviewDemand = null">×</button></div><div class="equipment-modal-body demand-review-body"><div class="demand-review-summary"><div><span>客户</span><strong>{{ reviewDemand.customer?.name || '—' }}</strong></div><div><span>产品</span><strong>{{ reviewDemand.product?.name || '—' }}</strong></div><div><span>包装方式</span><strong>{{ demandPackagingSummary(reviewDemand) }}</strong></div><div><span>包装数量</span><strong>{{ reviewDemand.package_qty }} {{ reviewDemand.packaging_method === 'keg' ? '桶' : reviewDemand.packaging_method === 'box' ? '箱' : '件' }}</strong></div><div><span>所需酒液</span><strong>{{ reviewDemand.requested_volume_l }} L</strong></div><div><span>要求出品日期</span><strong>{{ reviewDemand.requested_delivery_date || '—' }}</strong></div></div><div v-if="reviewDemand.customer_reference || reviewDemand.notes" class="demand-review-notes"><span>客户要求</span><p>{{ reviewDemand.customer_reference ? '参考号：' + reviewDemand.customer_reference : '' }} {{ reviewDemand.notes }}</p></div><div v-if="reviewDemand.decision_reason" class="demand-review-notes"><span>处理意见</span><p>{{ reviewDemand.decision_reason }}</p></div><label v-if="reviewDemand.state === 'submitted'" class="demand-review-reason"><span>退回原因 <small>退回修改时必填</small></span><textarea v-model.trim="reviewReason" rows="3" placeholder="说明需要销售修改的内容"></textarea></label><div v-if="reviewError" class="master-error">{{ reviewError }}</div></div><div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="reviewDemand = null">关闭</button><template v-if="reviewDemand.state === 'submitted'"><button class="btn btn-outline" type="button" :disabled="reviewSaving" @click="resolveDemand('return')">退回修改</button><button class="btn btn-primary" type="button" :disabled="reviewSaving" @click="resolveDemand('confirm')">{{ reviewSaving ? '处理中...' : '确认需求' }}</button></template></div></section></div>
    <div v-if="executionTask" class="equipment-modal-mask" @click.self="executionTask = null"><section class="equipment-modal mash-execution-modal" role="dialog" aria-modal="true" aria-label="糖化执行清单"><div class="equipment-modal-header"><div><div class="modal-title">{{ executionTask.name }} · 糖化执行清单</div><div class="modal-subtitle">按配方顺序逐项确认；保温时间从对应节点确认后开始计算</div></div><button class="equipment-close" type="button" aria-label="关闭清单" @click="executionTask = null">×</button></div><div class="equipment-modal-body mash-execution-body"><div v-if="executionError" class="master-error">{{ executionError }}</div><ol class="mash-checkpoint-list"><li v-for="(node, index) in executionTask.execution_checkpoints || []" :key="node.code" class="mash-checkpoint" :class="{ done: node.state === 'done', current: node.state !== 'done' && !(executionTask.execution_checkpoints || []).slice(0,index).some(item => item.state !== 'done') }"><div class="mash-checkpoint-number">{{ node.state === 'done' ? '✓' : String(index + 1).padStart(2,'0') }}</div><div class="mash-checkpoint-main"><div class="mash-checkpoint-title">{{ node.title }}</div><div v-if="node.state === 'done' && node.completed_at" class="mash-checkpoint-meta">完成时间：{{ checkpointCompletedTime(node.completed_at) }}<span v-if="node.completed_by"> · {{ node.completed_by }}</span></div><div v-if="node.target" class="mash-checkpoint-meta">{{ node.temperature !== undefined ? '目标 ' + node.temperature + '℃ · ' + node.duration_min + ' 分钟' : node.quantity !== undefined ? '用量 ' + node.quantity + (node.unit || '') : node.target }}</div><div v-if="node.last_result" class="mash-checkpoint-warning">上次检查：{{ node.last_result }}。处理后重新检查，合格才能继续。</div><div v-if="node.timer_from" class="mash-checkpoint-timer">{{ node.state === 'done' ? '已确认' : (checkpointDate(node, executionTask.execution_checkpoints) ? '预计完成 ' + checkpointDate(node, executionTask.execution_checkpoints) : '确认开始后计时 ' + node.due_after_min + ' 分钟') }}</div><div v-if="node.state !== 'done' && !(executionTask.execution_checkpoints || []).slice(0,index).some(item => item.state !== 'done')" class="mash-checkpoint-control"><template v-if="node.input_mode === 'choice'"><button v-for="choice in node.choices || []" :key="choice" class="btn btn-xs btn-outline" type="button" :disabled="executionSaving" @click="confirmMashCheckpoint(node, choice)">{{ choice }}</button></template><template v-else-if="node.input_mode === 'number'"><input v-model="executionValues[node.code]" type="number" step="any" :placeholder="'输入' + (node.title || '实测值')"><span>{{ node.unit || (node.target === '℃' || node.target?.startsWith('℃') ? '℃' : node.target === 'L' ? 'L' : '') }}</span><button class="btn btn-xs btn-primary" type="button" :disabled="executionSaving" @click="confirmMashCheckpoint(node, executionValues[node.code])">确认</button></template><template v-else-if="node.input_mode === 'text'"><input v-model="executionValues[node.code]" type="text" placeholder="填写记录"><button class="btn btn-xs btn-primary" type="button" :disabled="executionSaving || !executionValues[node.code]?.trim()" @click="confirmMashCheckpoint(node, executionValues[node.code])">确认</button></template><button v-else class="btn btn-xs btn-primary" type="button" :disabled="executionSaving" @click="confirmMashCheckpoint(node)">{{ executionSaving ? '提交中…' : '确认并继续' }}</button></div></div><StatusTag v-if="node.state === 'done'" text="已完成" /><span v-else-if="index === 0 || !(executionTask.execution_checkpoints || []).slice(0,index).some(item => item.state !== 'done')" class="mash-current-tag">当前节点</span></li></ol></div><div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="executionTask = null">关闭</button><button class="btn btn-primary" type="button" :disabled="executionSaving || ['done','cancelled'].includes(executionTask.state) || !(executionTask.execution_checkpoints || []).length || (executionTask.execution_checkpoints || []).some(node => node.state !== 'done')" @click="completeMashExecution">{{ executionSaving ? '提交中…' : executionTask.state === 'done' ? '糖化任务已完成' : '完成糖化任务' }}</button></div></section></div>
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
  { key: "mash_owner", label: "糖化负责人" },
  { key: "fermentation_owner", label: "发酵负责人" },
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
