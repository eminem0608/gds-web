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
        <div v-if="createDesignTab === 'recipe'" class="recipe-select-design-panel"><div class="recipe-design-section"><div class="recipe-section-title">麦芽与可发酵物 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('fermentables')">＋ 添加原料</button></div><div v-for="(line,index) in designDraft.fermentables" :key="'select-f'+index" class="recipe-select-row"><select v-model="line.subcategory"><option value="">选择种类</option><option v-for="item in materialCategoryOptions('malt','adjunct')" :key="item.id" :value="item.code">{{ item.material_group === 'malt' ? '麦芽 · ' : '其他可发酵物 · ' }}{{ item.name }}</option></select><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择系统物料</option><option v-for="item in designMaterials('malt','adjunct')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(KG)"><input v-model.number="line.ratio" type="number" placeholder="比例(%)"><input v-model="line.notes" placeholder="备注"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('fermentables', index)">删除</button></div><div v-if="!designDraft.fermentables.length" class="recipe-create-empty">还没有添加原料，从系统分类和物料中选择</div></div><div class="recipe-design-section"><div class="recipe-section-title">啤酒花 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('hops')">＋ 添加酒花</button></div><div v-for="(line,index) in designDraft.hops" :key="'select-h'+index" class="recipe-select-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择系统物料</option><option v-for="item in designMaterials('hop')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model="line.time" placeholder="投放时间"><input v-model.number="line.bitterness" type="number" placeholder="苦味值"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('hops', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">酵母 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('yeast')">＋ 添加酵母</button></div><div v-for="(line,index) in designDraft.yeast" :key="'select-y'+index" class="recipe-select-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择系统物料</option><option v-for="item in designMaterials('yeast')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model.number="line.temperature" type="number" placeholder="发酵温度(℃)"><input v-model="line.flavor" placeholder="风味描述" readonly><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('yeast', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">理化指标</div><div class="recipe-metrics-grid"><label><span>酒精度(% vol)</span><input v-model.number="designDraft.metrics.abv" type="number" step="0.1"></label><label><span>色度(EBC)</span><input v-model.number="designDraft.metrics.color_ebc" type="number" step="0.1"></label><label><span>苦味值(IBU)</span><input v-model.number="designDraft.metrics.ibu" type="number" step="0.1"></label><label><span>原麦汁浓度(°P)</span><input v-model.number="designDraft.metrics.original_gravity" type="number" step="0.1"></label></div></div></div>
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

const recipeDesignMarkup = `
    <div v-if="versionDetail" class="recipe-design-panel">
      <div class="recipe-design-header"><strong>配方设计</strong><span>麦芽与可发酵物、啤酒花、酵母和技术指标</span></div>
      <div class="recipe-design-section"><div class="recipe-section-title">麦芽与可发酵物 <button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-xs btn-outline" type="button" @click="addDesignLine('fermentables')">＋ 添加原料</button></div><div v-for="(line,index) in designDraft.fermentables" :key="'f'+index" class="recipe-design-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择物料</option><option v-for="item in designMaterials('malt','adjunct')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(KG)"><input v-model.number="line.ratio" type="number" placeholder="比例(%)"><input v-model.number="line.extract_rate" type="number" placeholder="浸出率(%)" readonly><input v-model.number="line.color" type="number" placeholder="色度" readonly><input v-model="line.notes" placeholder="备注"><button v-if="canManage" class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('fermentables', index)">删除</button></div><div v-if="!designDraft.fermentables.length" class="empty">暂无麦芽与可发酵物</div></div>
      <div class="recipe-design-section"><div class="recipe-section-title">啤酒花 <button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-xs btn-outline" type="button" @click="addDesignLine('hops')">＋ 添加酒花</button></div><div v-for="(line,index) in designDraft.hops" :key="'h'+index" class="recipe-design-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择酒花</option><option v-for="item in designMaterials('hop')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model.number="line.alpha_acid" type="number" placeholder="Alpha酸(%)" readonly><input v-model="line.time" placeholder="投放时间"><input v-model.number="line.bitterness" type="number" placeholder="苦味值"><input v-model.number="line.utilization" type="number" placeholder="异构率(%)"><button v-if="canManage" class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('hops', index)">删除</button></div><div v-if="!designDraft.hops.length" class="empty">暂无啤酒花</div></div>
      <div class="recipe-design-section"><div class="recipe-section-title">酵母 <button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-xs btn-outline" type="button" @click="addDesignLine('yeast')">＋ 添加酵母</button></div><div v-for="(line,index) in designDraft.yeast" :key="'y'+index" class="recipe-design-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择酵母</option><option v-for="item in designMaterials('yeast')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model.number="line.attenuation" type="number" placeholder="发酵度(%)" readonly><input v-model="line.flavor" placeholder="风味描述" readonly><input v-model.number="line.temperature" type="number" placeholder="发酵温度(℃)"><button v-if="canManage" class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('yeast', index)">删除</button></div><div v-if="!designDraft.yeast.length" class="empty">暂无酵母</div></div>
      <div class="recipe-design-section"><div class="recipe-section-title">指标</div><div class="recipe-metrics-grid"><label><span>酒精度(% vol)</span><input v-model.number="designDraft.metrics.abv" type="number" step="0.1"></label><label><span>色度(EBC)</span><input v-model.number="designDraft.metrics.color_ebc" type="number" step="0.1"></label><label><span>苦味值(IBU)</span><input v-model.number="designDraft.metrics.ibu" type="number" step="0.1"></label><label><span>原麦汁浓度(°P)</span><input v-model.number="designDraft.metrics.original_gravity" type="number" step="0.1"></label><label><span>终点残糖(g/L)</span><input v-model.number="designDraft.metrics.final_residual_sugar" type="number" step="0.1"></label><label><span>表观发酵度(%)</span><input v-model.number="designDraft.metrics.apparent_attenuation" type="number" step="0.1"></label><label><span>pH</span><input v-model.number="designDraft.metrics.ph" type="number" step="0.01"></label><label><span>二氧化碳(% m/m)</span><input v-model.number="designDraft.metrics.co2" type="number" step="0.01"></label><label><span>酸度(ml/100ml)</span><input v-model.number="designDraft.metrics.acidity" type="number" step="0.01"></label><label><span>双乙酰(mg/L)</span><input v-model.number="designDraft.metrics.diacetyl" type="number" step="0.01"></label><label><span>浑浊度(NTU)</span><input v-model.number="designDraft.metrics.turbidity" type="number" step="0.1"></label></div></div>
      <div v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="recipe-design-footer"><button class="btn btn-sm btn-primary" type="button" :disabled="saving" @click="saveVersion">保存配方设计</button></div>
    </div>`;

const RecipePage = defineComponent({
  components: { DataTable, StatusTag },
  props: { permissions: { type: Array, default: () => [] } },
  setup(props) {
    const recipes = ref([]);
    const products = ref([]);
    const brewSystems = ref([]);
    const materials = ref([]);
    const materialCategories = ref([]);
    const beerCategories = ref([]);
    const selectedRecipe = ref(null);
    const versions = ref([]);
    const versionDetail = ref(null);
    const materialDrafts = ref([]);
    const stepDrafts = ref([]);
    const designDraft = ref({ fermentables: [], hops: [], yeast: [], metrics: {}, mash: {}, fermentation: {} });
    const loading = ref(false);
    const saving = ref(false);
    const creating = ref(false);
    const createDesignTab = ref("recipe");
    const calculatedMetrics = computed(() => {
      const design = designDraft.value;
      const metrics = design.metrics || {};
      const fermentables = Array.isArray(design.fermentables) ? design.fermentables : [];
      const totalQuantity = fermentables.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
      const originalGravity = Number(metrics.original_gravity) || fermentables.reduce((sum, line) => sum + (Number(line.gravity) || 0), 0);
      const color = Number(metrics.color_ebc) || fermentables.reduce((sum, line) => sum + (Number(line.color_contribution || line.color) || 0), 0);
      const ibu = Number(metrics.ibu) || (Array.isArray(design.hops) ? design.hops.reduce((sum, line) => sum + (Number(line.bitterness) || 0), 0) : 0);
      const attenuation = Number(metrics.apparent_attenuation) || 0;
      const alcohol = Number(metrics.abv) || (originalGravity && attenuation ? originalGravity * attenuation / 2 : 0);
      return { totalQuantity, originalGravity, finalGravity: Number(metrics.final_gravity) || 0, color, ibu, alcohol };
    });
    const error = ref("");
    const draft = ref({ code: "", name: "", product_tmpl_id: "", beer_style: "", base_volume_l: 1000, original_gravity: "", final_gravity: "", bitterness_ibu: "", color_ebc: "", alcohol_abv: "", notes: "" });
    const canManage = computed(() => props.permissions.some(item => ["recipe.version.manage", "base.master_data.manage"].includes(item)));
    const beerCategoryOptions = computed(() => beerCategories.value.filter(item => !item.parent_id));
    const beerSubcategoryOptions = computed(() => beerCategories.value.filter(item => Number(item.parent_id?.id || item.parent_id || 0) === Number(draft.value.beer_category_id || 0)));
    const selectedBrewSystem = computed(() => brewSystems.value.find(item => String(item.id) === String(draft.value.brew_equipment_id)) || null);
    const columns = [
      { key: "code", label: "配方编码", mono: true },
      { key: "name", label: "配方名称" },
      { key: "beer_style", label: "啤酒风格", format: row => row.beer_style || "-" },
      { key: "active_version_id", label: "启用版本", format: row => row.active_version_id || "未启用" },
      { key: "state", label: "状态", tag: true }
    ];

    async function load() {
      loading.value = true;
      error.value = "";
      try {
        const [recipeRows, materialRows, materialCategoryRows, beerCategoryRows, equipmentRows] = await Promise.all([
          brewApi.listRecipes({ page_size: 100 }),
          brewApi.listMaster("materials", { page_size: 200, active: true }),
          brewApi.listMaster("material-categories", { page_size: 200, active: true }),
          brewApi.listMaster("beer-categories", { page_size: 200, active: true }),
          brewApi.listMaster("equipment", { page_size: 200, active: true })
        ]);
        recipes.value = recipeRows.map(item => ({ ...item, state: item.active ? (item.active_version_id ? "使用中" : "待启用") : "已归档" }));
        materials.value = materialRows;
        materialCategories.value = materialCategoryRows;
        beerCategories.value = beerCategoryRows;
        brewSystems.value = equipmentRows.filter(item => item.brew_equipment_type === "mash");
      } catch (cause) {
        error.value = cause.message || "配方加载失败。";
      } finally {
        loading.value = false;
      }
    }

    function resetDraft() { draft.value = { name: "", product_tmpl_id: "", beer_category_id: "", beer_subcategory_id: "", beer_style: "", base_volume_l: 1000, brew_equipment_id: "", brew_volume_l: 1000, original_gravity: "", final_gravity: "", bitterness_ibu: "", color_ebc: "", alcohol_abv: "", notes: "" }; designDraft.value = emptyDesign(); createDesignTab.value = "recipe"; }
    function selectBrewSystem() { const max = Number(selectedBrewSystem.value?.brew_capacity_l) || 0; if (max) { draft.value.base_volume_l = max; draft.value.brew_volume_l = max; } else syncBrewVolume(); }
    function syncBrewVolume() { const max = Number(selectedBrewSystem.value?.brew_capacity_l) || 0; const base = Number(draft.value.base_volume_l) || 0; draft.value.brew_volume_l = max ? Math.min(base || max, max) : (base || ""); }
    function updateBrewVolume() { const max = Number(selectedBrewSystem.value?.brew_capacity_l) || 0; const volume = Number(draft.value.brew_volume_l) || 0; draft.value.brew_volume_l = max ? Math.min(Math.max(volume, 1), max) : volume; draft.value.base_volume_l = draft.value.brew_volume_l; }
    function emptyDesign() { return { fermentables: [], hops: [], yeast: [], metrics: { abv: "", color_ebc: "", ibu: "", original_gravity: "", final_residual_sugar: "", ph: "", co2: "", acidity: "", diacetyl: "", turbidity: "", apparent_attenuation: "" }, mash: { boil_strength: "", water_grain_ratio: "", boil_time_min: "", sparge_count: "", steps: [] }, fermentation: { target_temperature: "", target_days: "", cold_storage_temperature: "", notes: "" } }; }
    function defaultSteps() {
      return [
        { sequence: 10, name: "糖化", phase: "mash", action_type: "record", mandatory_confirmation: false, target_duration_hours: "", target_temperature: "", config: {} },
        { sequence: 20, name: "进罐", phase: "fermentation", action_type: "enter_tank", mandatory_confirmation: true, target_duration_hours: "", target_temperature: "", config: {} },
        { sequence: 30, name: "转罐", phase: "fermentation", action_type: "transfer", mandatory_confirmation: true, target_duration_hours: "", target_temperature: "", config: {} },
        { sequence: 40, name: "包装放行", phase: "packaging", action_type: "packaging_release", mandatory_confirmation: true, target_duration_hours: "", target_temperature: "", config: {} }
      ];
    }
    async function submit() {
      saving.value = true;
      error.value = "";
      try {
        const recipe = await brewApi.createRecipe({ name: draft.value.name, beer_style: draft.value.beer_style, beer_category_id: Number(draft.value.beer_category_id), beer_subcategory_id: Number(draft.value.beer_subcategory_id) });
        const version = await brewApi.createRecipeVersion(recipe.id, { base_volume_l: Number(draft.value.base_volume_l) || 1000, original_gravity: Number(draft.value.original_gravity) || 0, final_gravity: Number(draft.value.final_gravity) || 0, bitterness_ibu: Number(draft.value.bitterness_ibu) || 0, color_ebc: Number(draft.value.color_ebc) || 0, alcohol_abv: Number(draft.value.alcohol_abv) || 0, notes: draft.value.notes, design: { ...designDraft.value, brew_equipment_id: draft.value.brew_equipment_id, brew_volume_l: Number(draft.value.brew_volume_l) || 0 } });
        await brewApi.replaceRecipeSteps(version.id, { record_version: version.record_version, process_steps: defaultSteps() });
        resetDraft();
        creating.value = false;
        await load();
        await openRecipe(recipes.value.find(item => item.id === recipe.id) || recipe);
      } catch (cause) {
        error.value = cause.message || "配方保存失败。";
      } finally {
        saving.value = false;
      }
    }

    async function openRecipe(recipe) {
      selectedRecipe.value = recipe;
      versionDetail.value = null;
      versions.value = await brewApi.listRecipeVersions(recipe.id);
    }
    async function openVersion(version) {
      versionDetail.value = await brewApi.getRecipeVersion(version.id);
      materialDrafts.value = (versionDetail.value.materials || []).map(item => ({ ...item }));
      stepDrafts.value = (versionDetail.value.process_steps || []).map(item => ({ ...item }));
      designDraft.value = { ...emptyDesign(), ...(versionDetail.value.design || {}), metrics: { ...emptyDesign().metrics, ...(versionDetail.value.design?.metrics || {}) }, mash: { ...emptyDesign().mash, ...(versionDetail.value.design?.mash || {}) }, fermentation: { ...emptyDesign().fermentation, ...(versionDetail.value.design?.fermentation || {}) } };
    }
    async function createVersion() {
      if (!selectedRecipe.value) return;
      saving.value = true; error.value = "";
      try {
        const version = await brewApi.createRecipeVersion(selectedRecipe.value.id, { base_volume_l: 1000 });
        await brewApi.replaceRecipeSteps(version.id, { record_version: version.record_version, process_steps: defaultSteps() });
        versions.value = await brewApi.listRecipeVersions(selectedRecipe.value.id);
        await openVersion(versions.value.find(item => Number(item.id) === Number(version.id)) || version);
      } catch (cause) { error.value = cause.message || "草稿版本创建失败。"; }
      finally { saving.value = false; }
    }
    function addMaterial() { materialDrafts.value.push({ product_id: "", quantity: 0, stage: "mash", notes: "" }); }
    function removeMaterial(index) { materialDrafts.value.splice(index, 1); }
    function addStep() { stepDrafts.value.push({ sequence: (stepDrafts.value.length + 1) * 10, name: "", phase: "mash", action_type: "record", mandatory_confirmation: false, target_duration_hours: "", target_temperature: "", config: {} }); }
    function removeStep(index) { stepDrafts.value.splice(index, 1); }
    function designMaterials(...categories) { return materials.value.filter(item => categories.includes(item.brew_material_category)); }
    function materialCategoryOptions(...groups) {
      return materialCategories.value.filter(item => groups.includes(item.material_group) && item.parent_id);
    }
    function fillDesignMaterial(line) {
      const item = materials.value.find(row => Number(row.id) === Number(line.material_id));
      if (!item) return;
      line.name = item.name;
      line.category = item.brew_material_category || "";
      line.extract_rate = item.brew_extract_rate || 0;
      line.attenuation = item.brew_extract_rate || 0;
      line.color = item.brew_color_ebc || 0;
      line.alpha_acid = item.brew_alpha_acid || 0;
      line.flavor = item.brew_flavor_desc || "";
    }
    function addDesignLine(type) { designDraft.value[type].push(type === "hops" ? { material_id: "", category: "", name: "", quantity: "", alpha_acid: "", time: "", bitterness: "", utilization: "", notes: "" } : type === "yeast" ? { material_id: "", category: "", name: "", quantity: "", attenuation: "", flavor: "", temperature: "", notes: "" } : { material_id: "", category: "", name: "", quantity: "", ratio: "", extract_rate: "", color: "", notes: "" }); }
    function removeDesignLine(type, index) { designDraft.value[type].splice(index, 1); }
    async function saveVersion() {
      if (!versionDetail.value) return;
      saving.value = true; error.value = "";
      try {
        let current = await brewApi.updateRecipeVersion(versionDetail.value.id, { record_version: versionDetail.value.record_version, base_volume_l: Number(versionDetail.value.base_volume_l), original_gravity: Number(versionDetail.value.original_gravity) || 0, final_gravity: Number(versionDetail.value.final_gravity) || 0, bitterness_ibu: Number(versionDetail.value.bitterness_ibu) || 0, color_ebc: Number(versionDetail.value.color_ebc) || 0, alcohol_abv: Number(versionDetail.value.alcohol_abv) || 0, notes: versionDetail.value.notes || "", design: designDraft.value });
        if (materialDrafts.value.length) current = await brewApi.replaceRecipeMaterials(versionDetail.value.id, { record_version: current.record_version, materials: materialDrafts.value.map((item, index) => ({ ...item, sequence: (index + 1) * 10, quantity: Number(item.quantity) || 0 })) });
        if (stepDrafts.value.length) current = await brewApi.replaceRecipeSteps(versionDetail.value.id, { record_version: current.record_version, process_steps: stepDrafts.value.map((item, index) => ({ ...item, sequence: (index + 1) * 10, target_duration_hours: item.target_duration_hours === "" ? null : Number(item.target_duration_hours), target_temperature: item.target_temperature === "" ? null : Number(item.target_temperature) })) });
        await openVersion(current);
        versions.value = await brewApi.listRecipeVersions(selectedRecipe.value.id);
      } catch (cause) { error.value = cause.message || "配方工艺保存失败。"; }
      finally { saving.value = false; }
    }
    async function versionAction(action) {
      saving.value = true; error.value = "";
      try { await brewApi.recipeVersionAction(versionDetail.value.id, action, versionDetail.value.record_version); await openRecipe(selectedRecipe.value); const latest = versions.value.find(item => Number(item.id) === Number(versionDetail.value.id)); if (latest) await openVersion(latest); }
      catch (cause) { error.value = cause.message || "版本状态更新失败。"; }
      finally { saving.value = false; }
    }

    onMounted(load);
    return { recipes, products, materials, brewSystems, beerCategories, beerCategoryOptions, beerSubcategoryOptions, selectedBrewSystem, selectedRecipe, versions, versionDetail, materialDrafts, stepDrafts, designDraft, calculatedMetrics, loading, saving, creating, createDesignTab, error, draft, canManage, columns, load, submit, resetDraft, syncBrewVolume, openRecipe, openVersion, createVersion, addMaterial, removeMaterial, addStep, removeStep, designMaterials, materialCategoryOptions, fillDesignMaterial, addDesignLine, removeDesignLine, saveVersion, versionAction };
  },
  template: `${recipeDesignMarkup}
    <div class="panel">
      <div class="panel-header">
        <div><div class="panel-title">配方版本库</div><div class="panel-subtitle">生产计划只能引用已启用的具体版本</div></div>
        <div class="master-actions"><button class="btn btn-sm btn-secondary" @click="load">刷新</button><button v-if="canManage" class="btn btn-sm btn-primary" @click="resetDraft(); creating = true">新建配方工艺</button></div>
      </div>
      <div v-if="error" class="master-error">{{ error }}</div>
      <form v-if="creating" class="equipment-modal-mask" @submit.prevent="submit">
       <div class="equipment-modal recipe-create-modal"><div class="equipment-modal-header"><div><div class="modal-title">新增配方工艺</div><div class="modal-subtitle">完成基础信息、原料配方和工艺指标后保存为草稿版本</div></div><button class="equipment-close" type="button" @click="creating = false">×</button></div><div class="equipment-modal-body recipe-create-body">
        <label><span>啤酒名称</span><input v-model.trim="draft.name" placeholder="请输入啤酒名称" required></label>
        <label><span>啤酒分类</span><select v-model="draft.beer_category_id" required @change="draft.beer_subcategory_id = ''"><option value="">请选择啤酒大类</option><option v-for="item in beerCategoryOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label><span>啤酒种类</span><select v-model="draft.beer_subcategory_id" required :disabled="!draft.beer_category_id"><option value="">{{ draft.beer_category_id ? '请选择啤酒小类' : '请先选择啤酒大类' }}</option><option v-for="item in beerSubcategoryOptions" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
        <label><span>使用设备</span><select v-model="draft.brew_equipment_id" required @change="selectBrewSystem"><option value="">请选择酿造系统</option><option v-for="item in brewSystems" :key="item.id" :value="item.id">{{ item.name }} · 最大 {{ item.brew_capacity_l || '—' }} L</option></select></label>
        <label><span>酿造体积(L)</span><input v-model.number="draft.brew_volume_l" type="number" min="1" :max="selectedBrewSystem?.brew_capacity_l || undefined" required @input="updateBrewVolume"><small v-if="selectedBrewSystem" class="recipe-field-hint">最大 {{ selectedBrewSystem.brew_capacity_l }} L</small></label>
        <label><span>原始糖度(°P)</span><input v-model.number="draft.original_gravity" type="number" step="0.1"></label>
        <label><span>终点糖度(°P)</span><input v-model.number="draft.final_gravity" type="number" step="0.1"></label>
        <label><span>苦度(IBU)</span><input v-model.number="draft.bitterness_ibu" type="number" step="0.1"></label>
        <label><span>色度(EBC)</span><input v-model.number="draft.color_ebc" type="number" step="0.1"></label>
        <label class="field-wide"><span>工艺备注</span><textarea v-model.trim="draft.notes"></textarea></label>
        <div v-if="createDesignTab === 'recipe'" class="recipe-calculated-metrics"><div class="recipe-calculated-heading"><strong>配方计算结果</strong><span>根据原料、投放参数和酵母参数自动计算</span></div><div class="recipe-calculated-grid"><div><span>原始糖度(°P)</span><strong>{{ calculatedMetrics.originalGravity ? calculatedMetrics.originalGravity.toFixed(1) : '待计算' }}</strong></div><div><span>终点糖度(°P)</span><strong>{{ calculatedMetrics.finalGravity ? calculatedMetrics.finalGravity.toFixed(1) : '待计算' }}</strong></div><div><span>苦度(IBU)</span><strong>{{ calculatedMetrics.ibu ? calculatedMetrics.ibu.toFixed(1) : '待计算' }}</strong></div><div><span>色度(EBC)</span><strong>{{ calculatedMetrics.color ? calculatedMetrics.color.toFixed(1) : '待计算' }}</strong></div><div><span>酒精度(% ABV)</span><strong>{{ calculatedMetrics.alcohol ? calculatedMetrics.alcohol.toFixed(1) : '待计算' }}</strong></div></div></div>
        <div v-if="createDesignTab === 'recipe'" class="recipe-select-design-panel"><div class="recipe-design-section"><div class="recipe-section-title">麦芽与可发酵物 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('fermentables')">＋ 添加原料</button></div><div v-for="(line,index) in designDraft.fermentables" :key="'select-f'+index" class="recipe-select-row"><select v-model="line.subcategory"><option value="">选择种类</option><option v-for="item in materialCategoryOptions('malt','adjunct')" :key="item.id" :value="item.code">{{ item.material_group === 'malt' ? '麦芽 · ' : '其他可发酵物 · ' }}{{ item.name }}</option></select><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择系统物料</option><option v-for="item in designMaterials('malt','adjunct')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(KG)"><input v-model.number="line.ratio" type="number" placeholder="比例(%)"><input v-model="line.notes" placeholder="备注"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('fermentables', index)">删除</button></div><div v-if="!designDraft.fermentables.length" class="recipe-create-empty">还没有添加原料，从系统分类和物料中选择</div></div><div class="recipe-design-section"><div class="recipe-section-title">啤酒花 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('hops')">＋ 添加酒花</button></div><div v-for="(line,index) in designDraft.hops" :key="'select-h'+index" class="recipe-select-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择系统物料</option><option v-for="item in designMaterials('hop')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model="line.time" placeholder="投放时间"><input v-model.number="line.bitterness" type="number" placeholder="苦味值"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('hops', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">酵母 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('yeast')">＋ 添加酵母</button></div><div v-for="(line,index) in designDraft.yeast" :key="'select-y'+index" class="recipe-select-row"><select v-model="line.material_id" @change="fillDesignMaterial(line)"><option value="">选择系统物料</option><option v-for="item in designMaterials('yeast')" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model.number="line.temperature" type="number" placeholder="发酵温度(℃)"><input v-model="line.flavor" placeholder="风味描述" readonly><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('yeast', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">理化指标</div><div class="recipe-metrics-grid"><label><span>酒精度(% vol)</span><input v-model.number="designDraft.metrics.abv" type="number" step="0.1"></label><label><span>色度(EBC)</span><input v-model.number="designDraft.metrics.color_ebc" type="number" step="0.1"></label><label><span>苦味值(IBU)</span><input v-model.number="designDraft.metrics.ibu" type="number" step="0.1"></label><label><span>原麦汁浓度(°P)</span><input v-model.number="designDraft.metrics.original_gravity" type="number" step="0.1"></label></div></div></div>
        <div class="recipe-create-tabs"><button type="button" :class="['recipe-create-tab', { active: createDesignTab === 'recipe' }]" @click="createDesignTab = 'recipe'"><span>01</span><strong>配方设计</strong><small>原料与理化指标</small></button><button type="button" :class="['recipe-create-tab', { active: createDesignTab === 'mash' }]" @click="createDesignTab = 'mash'"><span>02</span><strong>糖化工艺设计</strong><small>糖化、煮沸与洗糟</small></button><button type="button" :class="['recipe-create-tab', { active: createDesignTab === 'fermentation' }]" @click="createDesignTab = 'fermentation'"><span>03</span><strong>发酵工艺设计</strong><small>温度、天数与储藏</small></button></div>
        <div class="recipe-create-design"><div class="recipe-design-header"><strong>配方设计明细</strong><span>保存后可继续编辑草稿版本</span></div><div class="recipe-design-section"><div class="recipe-section-title">麦芽与可发酵物 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('fermentables')">＋ 添加</button></div><div v-for="(line,index) in designDraft.fermentables" :key="'cf'+index" class="recipe-design-row"><input v-model="line.category" placeholder="种类"><input v-model="line.name" placeholder="名称"><input v-model.number="line.quantity" type="number" placeholder="数量(KG)"><input v-model.number="line.ratio" type="number" placeholder="比例(%)"><input v-model.number="line.extract_rate" type="number" placeholder="浸出率(%)"><input v-model.number="line.color" type="number" placeholder="色度"><input v-model="line.notes" placeholder="备注"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('fermentables', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">啤酒花 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('hops')">＋ 添加</button></div><div v-for="(line,index) in designDraft.hops" :key="'ch'+index" class="recipe-design-row"><input v-model="line.category" placeholder="种类"><input v-model="line.name" placeholder="名称"><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model.number="line.alpha_acid" type="number" placeholder="Alpha酸(%)"><input v-model="line.time" placeholder="投放时间"><input v-model.number="line.bitterness" type="number" placeholder="苦味值"><input v-model.number="line.utilization" type="number" placeholder="异构率(%)"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('hops', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">酵母 <button class="btn btn-xs btn-outline" type="button" @click="addDesignLine('yeast')">＋ 添加</button></div><div v-for="(line,index) in designDraft.yeast" :key="'cy'+index" class="recipe-design-row"><input v-model="line.category" placeholder="种类"><input v-model="line.name" placeholder="名称"><input v-model.number="line.quantity" type="number" placeholder="数量(G)"><input v-model.number="line.attenuation" type="number" placeholder="发酵度(%)"><input v-model="line.flavor" placeholder="风味描述"><input v-model.number="line.temperature" type="number" placeholder="发酵温度(℃)"><button class="btn btn-xs btn-danger" type="button" @click="removeDesignLine('yeast', index)">删除</button></div></div><div class="recipe-design-section"><div class="recipe-section-title">指标</div><div class="recipe-metrics-grid"><label><span>酒精度(% vol)</span><input v-model.number="designDraft.metrics.abv" type="number" step="0.1"></label><label><span>色度(EBC)</span><input v-model.number="designDraft.metrics.color_ebc" type="number" step="0.1"></label><label><span>苦味值(IBU)</span><input v-model.number="designDraft.metrics.ibu" type="number" step="0.1"></label><label><span>原麦汁浓度(°P)</span><input v-model.number="designDraft.metrics.original_gravity" type="number" step="0.1"></label><label><span>终点残糖(g/L)</span><input v-model.number="designDraft.metrics.final_residual_sugar" type="number" step="0.1"></label><label><span>表观发酵度(%)</span><input v-model.number="designDraft.metrics.apparent_attenuation" type="number" step="0.1"></label><label><span>pH</span><input v-model.number="designDraft.metrics.ph" type="number" step="0.01"></label><label><span>二氧化碳(% m/m)</span><input v-model.number="designDraft.metrics.co2" type="number" step="0.01"></label><label><span>酸度(ml/100ml)</span><input v-model.number="designDraft.metrics.acidity" type="number" step="0.01"></label><label><span>双乙酰(mg/L)</span><input v-model.number="designDraft.metrics.diacetyl" type="number" step="0.01"></label><label><span>浑浊度(NTU)</span><input v-model.number="designDraft.metrics.turbidity" type="number" step="0.1"></label></div></div></div></div><div class="equipment-modal-footer"><button class="btn btn-secondary" type="button" @click="creating = false">取消</button><button class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存草稿' }}</button></div></div>
      </form>
      <div v-if="loading" class="panel-body empty">正在加载...</div>
      <div v-else class="panel-body recipe-list"><div v-for="recipe in recipes" :key="recipe.id" class="recipe-card"><div class="recipe-card-main"><strong>{{ recipe.name }}</strong><span>{{ recipe.code }} · {{ recipe.product?.name || '未关联成品' }} · {{ recipe.beer_style || '未设置风格' }}</span></div><StatusTag :text="recipe.state" /><button class="btn btn-xs btn-outline" type="button" @click="openRecipe(recipe)">查看版本</button></div><div v-if="!recipes.length" class="empty">暂无配方，请先新增配方工艺</div></div>
      <div v-if="selectedRecipe" class="panel recipe-editor"><div class="panel-header"><div><div class="panel-title">{{ selectedRecipe.name }} · 配方版本</div><div class="panel-subtitle">版本发布前可修改；启用后将作为生产计划引用的配方快照</div></div><button v-if="canManage" class="btn btn-sm btn-primary" type="button" @click="createVersion">＋ 新建草稿版本</button></div><div class="recipe-version-list"><button v-for="version in versions" :key="version.id" type="button" :class="['recipe-version-chip', { active: versionDetail?.id === version.id }]" @click="openVersion(version)">{{ version.name }} · {{ ({ draft: '草稿', submitted: '待审核', approved: '已审核', active: '使用中', inactive: '已停用', returned: '已退回' })[version.state] || version.state }}</button></div><div v-if="versionDetail" class="recipe-editor-body"><div class="recipe-editor-toolbar"><strong>{{ versionDetail.name }}</strong><div class="master-actions"><button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-sm btn-primary" type="button" @click="saveVersion">保存版本</button><button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-sm btn-outline" type="button" @click="versionAction('submit')">提交审核</button><button v-if="canManage && versionDetail.state === 'submitted'" class="btn btn-sm btn-outline" type="button" @click="versionAction('approve')">审核通过</button><button v-if="canManage && versionDetail.state === 'approved'" class="btn btn-sm btn-primary" type="button" @click="versionAction('activate')">启用版本</button><button v-if="canManage && versionDetail.state === 'active'" class="btn btn-sm btn-outline" type="button" @click="versionAction('deactivate')">停用版本</button></div></div><div class="recipe-editor-grid"><label><span>基准产量(L)</span><input v-model.number="versionDetail.base_volume_l" type="number" min="1"></label><label><span>原始糖度(°P)</span><input v-model.number="versionDetail.original_gravity" type="number" step="0.1"></label><label><span>终点糖度(°P)</span><input v-model.number="versionDetail.final_gravity" type="number" step="0.1"></label><label><span>苦度(IBU)</span><input v-model.number="versionDetail.bitterness_ibu" type="number" step="0.1"></label><label><span>色度(EBC)</span><input v-model.number="versionDetail.color_ebc" type="number" step="0.1"></label><label><span>酒精度(% ABV)</span><input v-model.number="versionDetail.alcohol_abv" type="number" step="0.1"></label></div><div class="recipe-editor-section"><div class="recipe-section-title">原料明细<button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-xs btn-outline" type="button" @click="addMaterial">＋ 添加原料</button></div><div v-for="(line, index) in materialDrafts" :key="index" class="recipe-line"><select v-model="line.product_id"><option value="">选择原料</option><option v-for="item in materials" :key="item.id" :value="item.id">{{ item.name }}</option></select><input v-model.number="line.quantity" type="number" min="0.001" step="0.001" placeholder="数量"><select v-model="line.stage"><option value="mash">糖化</option><option value="boil">煮沸</option><option value="fermentation">发酵</option><option value="packaging">包装</option></select><button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-xs btn-danger" type="button" @click="removeMaterial(index)">删除</button></div><div v-if="!materialDrafts.length" class="empty">暂无原料，提交审核前至少添加一条</div></div><div class="recipe-editor-section"><div class="recipe-section-title">工艺节点<button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-xs btn-outline" type="button" @click="addStep">＋ 添加节点</button></div><div v-for="(step, index) in stepDrafts" :key="index" class="recipe-line recipe-step-line"><input v-model.trim="step.name" placeholder="节点名称"><select v-model="step.phase"><option value="mash">糖化</option><option value="boil">煮沸</option><option value="fermentation">发酵</option><option value="packaging">包装</option></select><select v-model="step.action_type"><option value="record">记录</option><option value="enter_tank">进罐确认</option><option value="transfer">转罐确认</option><option value="packaging_release">包装放行</option></select><label class="checkbox-field"><input v-model="step.mandatory_confirmation" type="checkbox">强制确认</label><button v-if="canManage && ['draft','returned'].includes(versionDetail.state)" class="btn btn-xs btn-danger" type="button" @click="removeStep(index)">删除</button></div><div v-if="!stepDrafts.length" class="empty">暂无工艺节点</div></div></div></div>
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
            <button v-if="canCreate && !(selected === 'equipment' && equipmentFactory)" class="btn btn-sm btn-primary" type="button" @click.prevent.stop="isCategoryResource(selected) ? startCategoryCreate() : startCreate()">{{ isCategoryResource(selected) && materialCategoryParent ? '新增小类' : '新增' }}</button>
          </div>
        </div>
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
                    <div v-for="tank in draft.tank_specs.filter(item => item.tank_type === 'fermentation')" :key="tank._key || tank.name" class="system-tank-row">
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
                    <div v-for="tank in draft.tank_specs.filter(item => item.tank_type === 'bright')" :key="tank._key || tank.name" class="system-tank-row">
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
              <label><span>排序</span><input v-model.number="draft.sequence" type="number" min="0" step="1"></label>
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
            <div v-for="item in displayedItems" :key="item.id" class="master-row">
              <div>
                <div class="task-title">{{ item.name }}</div>
                <div class="task-desc">{{ describe(item) }}</div>
              </div>
              <div class="master-actions">
                <button v-if="selected === 'equipment' && canCreate" class="btn btn-xs btn-outline" type="button" @click="startEdit(item)">编辑</button>
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
      { code: "equipment", label: "设备", desc: "生产设备容量、技术参数与运行状态", fields: [...commonFields, factoryField, { key: "brew_equipment_type", label: "设备类型", type: "select", values: [["mash","糖化"],["fermentation","发酵"],["bright","清酒"],["packaging","包装"],["centrifuge","离心"],["cleaning","清洗"],["other","其他"]] }, { key: "brew_capacity_l", label: "容量(L)", type: "number" }] },
      { code: "tanks", label: "罐体", desc: "发酵罐、清酒罐和清洗状态", fields: [...commonFields, { ...factoryField, key: "factory_id" }, { key: "tank_type", label: "罐体类型", type: "select", values: [["fermentation","发酵罐"],["bright","清酒罐"]] }, { key: "capacity_l", label: "容量(L)", type: "number" }] },
      { code: "warehouses", label: "仓库", desc: "按厂区管理仓库，并查看仓库下的库位", fields: [...commonFields, factoryField, { key: "code", label: "仓库编码" }] },
      { code: "products", label: "产品", desc: "半成品和成品主数据", fields: [...commonFields, { key: "default_code", label: "产品编码" }, { key: "brew_item_type", label: "产品类型", type: "select", values: [["semi_finished","半成品"],["finished_product","成品"]] }, { key: "brew_specification", label: "规格", required: false }] },
      { code: "materials", label: "物料", desc: "原料与包装物标准主数据", fields: [...commonFields, { key: "default_code", label: "物料编码" }, { key: "brew_item_type", label: "物料类型", type: "select", values: [["raw_material","原料"],["packaging_material","包装物"]] }, { key: "brew_material_category", label: "原料分类", type: "select", values: [["malt","麦芽"],["hop","酒花"],["yeast","酵母"],["adjunct","辅料"],["packaging","包装物"]] }, { key: "brew_shelf_life_days", label: "保质期(天)", type: "number", required: false }] },
      { code: "material-categories", label: "原料种类", desc: "系统级原料大类和细分类，不绑定厂区", fields: [...commonFields, { key: "code", label: "种类编码" }, { key: "material_group", label: "原料大类", type: "select", values: [["malt","麦芽"],["hop","啤酒花"],["yeast","酵母"],["adjunct","其他可发酵物"],["packaging","包装材料"]] }, { key: "parent_id", label: "所属大类", type: "select", required: false }, { key: "sequence", label: "排序", type: "number", required: false }] },
      { code: "beer-categories", label: "啤酒分类", desc: "系统级啤酒大类和小分类，不绑定厂区", fields: [...commonFields, { key: "code", label: "分类编码" }, { key: "parent_id", label: "所属大类", type: "select", required: false }, { key: "sequence", label: "排序", type: "number", required: false }] },
      { code: "suppliers", label: "供应商", desc: "供应商联系信息与供货品类", fields: [...commonFields, { key: "phone", label: "电话", required: false }, { key: "brew_supply_category", label: "供货品类", required: false }] },
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
    const currentResource = computed(() => resources.find(item => item.code === selected.value));
    function isCategoryResource(code) { return ["material-categories", "beer-categories"].includes(code); }
    function isBeerCategory(code) { return code === "beer-categories"; }
    const materialCategoryRows = computed(() => {
      if (!isCategoryResource(selected.value)) return [];
      return materialCategories.value
        .filter(item => materialCategoryParent.value ? Number(item.parent_id?.id || item.parent_id || 0) === Number(materialCategoryParent.value.id) : !item.parent_id)
        .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0) || String(a.name).localeCompare(String(b.name), "zh-CN"));
    });
    const displayedItems = computed(() => {
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
        items.value = current.rule
          ? await brewApi.listRules(current.code)
        : await brewApi.listMaster(current.code, { page_size: 100, active: true });
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
        if (["materials", "material-categories"].includes(current.code) || !materialCategories.value.length) {
          materialCategories.value = await brewApi.listMaster("material-categories", { page_size: 200 });
        }
        if (current.code === "beer-categories") {
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
      draft.value = currentResource.value.code === "equipment"
          ? { brew_factory_id: equipmentFactory.value?.id || equipmentFactoryFilter.value || "", brew_equipment_type: "mash", name: "", brew_capacity_l: "", brew_tank_volume_l: "", brew_tank_count: 0, tank_specs: [], brew_saccharification_efficiency: 0, brew_screen_water_l: 0, brew_whirlpool_time_min: 0, brew_filtration_speed_l_min: 0 }
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
      if (isCategoryResource(currentResource.value.code)) {
        draft.value = { name: item.name || "", code: item.code || "", ...(isBeerCategory(currentResource.value.code) ? {} : { material_group: item.material_group || "" }), parent_id: item.parent_id?.id || item.parent_id || "", sequence: item.sequence || 10, version: item.version };
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
        tank_specs: (item.tank_specs || []).map(tank => ({ tank_type: tank.tank_type || (item.brew_equipment_type === "bright" ? "bright" : "fermentation"), name: tank.name || "", location_name: tank.location_name || "", capacity_l: tank.capacity_l || item.brew_tank_volume_l || 0 })),
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
      while (specs.length < count) specs.push({ name: "", location_name: "", capacity_l: Number(draft.value.brew_tank_volume_l) || 0 });
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
      draft.value.tank_specs.push({ tank_type: type, name: "", location_name: "", capacity_l: "" });
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
          payload.tank_specs = (payload.tank_specs || []).map((item, index) => ({ ...item, location_name: item.location_name || autoTankLocation(item, index) }));
        } else if (current.code === "equipment" && ["fermentation", "bright"].includes(payload.brew_equipment_type)) {
          // 发酵罐/清酒罐表单填写的是“设备体积”，提交时同步为后台使用的“罐体体积”。
          payload.brew_tank_volume_l = Number(payload.brew_tank_volume_l) || Number(payload.brew_capacity_l) || 0;
          payload.brew_tank_count = Number(payload.brew_tank_count) || 1;
          if (payload.brew_tank_volume_l <= 0) throw new Error("请填写发酵罐或清酒罐体积。");
          const invalidTank = (payload.tank_specs || []).find((item) => !String(item.name || "").trim());
          if (invalidTank) throw new Error("请填写每个罐体的罐号。");
          payload.tank_specs = (payload.tank_specs || []).slice(0, payload.brew_tank_count).map(item => ({
            ...item,
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
      const parts = [item.code, item.default_code, item.brew_specification, item.address, item.phone, item.rule_kind && `版本 ${item.version}`, item.factory_id?.name, item.brew_factory_id?.name].filter(Boolean);
      return parts.join(" · ") || `ID ${item.id}`;
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
      if (deleting && !window.confirm(`确定要删除“${item.name}”吗？删除后将不再显示。`)) return;
      saving.value = true;
      error.value = "";
      try {
        await brewApi.masterAction(resource, item.id, action, item.version);
        if (resource === "warehouses") {
          if (deleting) items.value = items.value.filter(row => Number(row.id) !== Number(item.id));
          else await load();
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
    return { resources, selected, items, displayedItems, materialCategoryRows, materialCategoryParent, categoryNotice, materialGroupOptions, warehouseFactoryRows, warehouseFactory, warehouseSelected, locationCreating, locationEditing, locationDetail, locationDraft, locationTypeOptions, warehouseTypeOptions, equipmentFactory, equipmentWarehouse, equipmentLocation, equipmentFactoryRows, equipmentFactoryEquipment, equipmentFactorySystems, equipmentFactoryOther, equipmentFactoryWarehouses, equipmentFactoryGeneral, loading, saving, creating, error, draft, factories, materialCategories, equipmentFactoryFilter, equipmentTypeOptions, newEquipmentType, editingItem, currentResource, canCreate, load, selectResource, startCreate, startCategoryCreate, startEdit, startAddSystemTank, isSystemExpanded, toggleSystemExpanded, addEquipmentType, handleEquipmentTypeChange, syncTankSpecs, adjustTankCount, addTankSpec, addSystemTank, removeSystemTank, autoTankLocation, removeTankSpec, adjustEquipmentNumber, optionsFor, submitCreate, submitLocation, changeRuleState, changeEquipmentState, changeCategoryState, toggleEquipmentStatus, equipmentStatusLabel, describe, stateLabel, openMaterialCategory, clearMaterialCategoryParent, materialGroupLabel, materialCategoryChildCount, startCategoryDrag, dropCategory, openWarehouseFactory, clearWarehouseSelection, openWarehouse, goWarehouseLevel, warehouseLocationCount, warehouseLocationsFor, startLocationCreate, startLocationEdit, editLocation, openLocationDetail, warehouseLocationTypeLabel, warehouseTypeLabel, formatDateTime, tankTypeLabel, tankStatusLabel, changeMasterState, toggleWarehouseStatus, toggleLocationStatus, isCategoryResource, isBeerCategory, openEquipmentFactory, openEquipmentWarehouse, openEquipmentLocation, goEquipmentLevel, equipmentWarehouseLocations, equipmentLocationEquipment, equipmentTypeLabel };
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
