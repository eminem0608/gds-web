<template>
  <div class="app">
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
        <div class="role-label">当前角色</div>
        <select v-model="currentRole" class="role-select">
          <option v-for="(role, key) in roles" :key="key" :value="key">{{ role.label }}</option>
        </select>
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
            <span v-if="item.id === 'tasks'" class="nav-badge">{{ visibleTasks.length }}</span>
          </button>
        </template>
      </nav>

      <div class="sidebar-footer">
        <div class="avatar">{{ roleConfig.avatar }}</div>
        <div>
          <div class="user-name">{{ roleConfig.label }}</div>
          <div class="user-role">{{ roleConfig.desc }}</div>
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
          <button class="btn btn-secondary" type="button" @click="openQuickCreate">快速录入</button>
          <button class="btn btn-primary" type="button" @click="showToast('已刷新当前页面数据')">刷新</button>
        </div>
      </header>

      <section class="content">
        <DashboardPage v-if="currentPage === 'dashboard'" :data="data" @go="go" />
        <FactoryPage v-else-if="currentPage === 'factory'" :data="data" @open-tank="openTankDetail" @toast="showToast" />
        <ProductionPage v-else-if="currentPage === 'production'" :data="data" @modal="openModal" />
        <RecipePage v-else-if="currentPage === 'recipe'" :recipes="data.recipes" @modal="openModal" />
        <InventoryPage v-else-if="currentPage === 'inventory'" :data="data" @toast="showToast" />
        <TracePage v-else-if="currentPage === 'trace'" />
        <ReportsPage v-else-if="currentPage === 'reports'" />
        <SettingsPage v-else-if="currentPage === 'settings'" />
        <TasksPage v-else-if="currentPage === 'tasks'" :tasks="visibleTasks" />
      </section>
    </main>

    <div v-if="toastMessage" class="toast">{{ toastMessage }}</div>

    <div v-if="modal.show" class="modal-mask" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ modal.title }}</div>
          <button class="btn btn-xs btn-secondary" type="button" @click="closeModal">关闭</button>
        </div>
        <div class="modal-body" v-html="modal.body"></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" type="button" @click="closeModal">取消</button>
          <button class="btn btn-primary" type="button" @click="saveModal">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, ref, watch } from "vue";
import { demoData, navSections, pageMeta, roles } from "./data";

const currentRole = ref("gm");
const currentPage = ref("dashboard");
const keyword = ref("");
const data = ref(demoData);
const toastMessage = ref("");
const modal = ref({ show: false, title: "", body: "" });

const roleConfig = computed(() => roles[currentRole.value]);
const currentMeta = computed(() => pageMeta[currentPage.value]);

const visibleNavSections = computed(() => {
  const pages = roleConfig.value.pages;
  return navSections
    .map((section) => ({
      title: section.title,
      items: section.items
        .filter(([id]) => pages.includes(id))
        .map(([id, label]) => ({ id, label }))
    }))
    .filter((section) => section.items.length);
});

const visibleTasks = computed(() => {
  if (["gm", "director"].includes(currentRole.value)) return data.value.tasks;
  return data.value.tasks.filter((task) => task.role === currentRole.value);
});

watch(currentRole, () => {
  if (!roleConfig.value.pages.includes(currentPage.value)) {
    currentPage.value = roleConfig.value.pages[0];
  }
});

function go(page) {
  currentPage.value = page;
}

function showToast(message) {
  toastMessage.value = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastMessage.value = "";
  }, 1800);
}

function openModal(title, body) {
  modal.value = { show: true, title, body };
}

function closeModal() {
  modal.value.show = false;
}

function saveModal() {
  showToast("已保存演示数据");
  closeModal();
}

function openQuickCreate() {
  openModal("快速录入", formHtml([
    ["单据类型", "产品需求"],
    ["产品名称", "婴儿肥 IPA"],
    ["数量", "80 桶"],
    ["要求日期", "2026-08-28"],
    ["客户", "醉猫酒馆"],
    ["备注", "特殊渠道订单，优先安排包装。"]
  ]));
}

function openTankDetail(tank) {
  openModal(`${tank.id} 发酵罐详情`, `
    <div class="stats-grid modal-stats">
      ${statHtml("体积", `${tank.volume}L`, `容量 ${tank.capacity}L`, "up")}
      ${statHtml("发酵天数", tank.day || "-", "从进罐日起", "warn")}
      ${statHtml("温度", tank.volume ? `${tank.temp}℃` : "-", "最新记录", "")}
      ${statHtml("糖度", tank.volume ? `${tank.gravity}°P` : "-", "最新记录", "")}
    </div>
    <div class="panel modal-panel">
      <div class="panel-header"><div class="panel-title">今日任务与历史趋势</div></div>
      <div class="panel-body">
        ${taskHtml(tank.tasks, `${tank.batch || "无批次"} · ${tank.product || "空罐"} · ${tank.factory}`, tank.warning ? "紧急" : "待处理")}
        ${barHtml([15.2, 12.8, 10.4, 8.6, 6.8], ["D1", "D3", "D6", "D9", "D12"])}
      </div>
    </div>
  `);
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
    待付款: "tag-warning",
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

function formHtml(rows) {
  return `<div class="form-grid">${rows.map(([label, value]) => `<div class="form-group"><label class="form-label">${label}</label><input class="form-input" value="${value}"></div>`).join("")}</div>`;
}

function statHtml(label, value, change, cls = "") {
  return `<div class="stat-card"><div class="stat-head"><div class="stat-label">${label}</div><div class="mono">●</div></div><div class="stat-value">${value}</div><div class="stat-change ${cls}">${change}</div></div>`;
}

function taskHtml(title, desc, state) {
  return `<div class="task-card"><div><div class="task-title">${title}</div><div class="task-desc">${desc}</div></div><div><span class="tag ${tagClass(state)}">${state}</span></div></div>`;
}

function barHtml(values, labels) {
  const max = Math.max(...values);
  return `<div class="chart-bars">${values.map((value, index) => `<div class="chart-bar"><div class="bar-fill" style="height:${Math.max(12, value / max * 100)}%"></div><div>${labels[index]}</div></div>`).join("")}</div>`;
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
      return Math.max(...this.values);
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
  props: { data: Object },
  emits: ["go"],
  computed: {
    activeTanks() {
      return this.data.tanks.filter((tank) => ["fermenting", "cold", "alert"].includes(tank.status));
    },
    warningMaterials() {
      return this.data.materials.filter((material) => material.status === "低库存");
    },
    workflowItems() {
      return [
        { title: "产品需求", desc: "3 单", state: "done" },
        { title: "配方确认", desc: "2 个版本", state: "done" },
        { title: "生产计划", desc: "3 项", state: "active" },
        { title: "库存预占", desc: "6 批次", state: "active" },
        { title: "采购需求", desc: "3 项", state: "active" },
        { title: "糖化执行", desc: "1 批待投" },
        { title: "发酵管理", desc: "3 罐", state: "active" },
        { title: "包装出库", desc: "2 单" }
      ];
    }
  },
  template: `
    <div class="stats-grid">
      <StatCard label="今日待办" :value="data.tasks.length" change="6 项需要今天处理" tone="warn" />
      <StatCard label="发酵中批次" :value="activeTanks.length" change="1 个参数异常" tone="down" />
      <StatCard label="待包装酒液" value="2,210L" change="覆盖 3 个需求单" tone="up" />
      <StatCard label="库存预警" :value="warningMaterials.length" change="酒花低于安全库存" tone="warn" />
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><div><div class="panel-title">生产闭环进度</div><div class="panel-subtitle">需求到出库的关键状态</div></div><button class="btn btn-sm btn-outline" @click="$emit('go','production')">查看生产</button></div>
        <div class="panel-body"><Workflow :items="workflowItems" /></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title">异常提醒</div><button class="btn btn-sm btn-outline" @click="$emit('go','factory')">处理</button></div>
        <div class="panel-body task-list">
          <TaskCard title="FV-03 双乙酰复测" desc="浑浊 IPA 第 20 天，需确认是否可降温" state="紧急" />
          <TaskCard title="卡斯卡特酒花低库存" desc="可用库存 0.6kg，不足 PLN-260818-001" state="低库存" />
          <TaskCard title="城市精酿节订单逾期风险" desc="要求 2026-08-25 出品，包装计划未确认" state="逾期风险" />
        </div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">发酵罐摘要</div><button class="btn btn-sm btn-outline" @click="$emit('go','factory')">进入酒厂</button></div>
        <div class="panel-body"><div class="tank-grid"><TankCard v-for="tank in data.tanks.slice(0, 3)" :key="tank.id" :tank="tank" /></div></div>
      </div>
      <div class="panel"><div class="panel-header"><div class="panel-title">本周生产与采购</div></div><div class="panel-body"><BarChart :values="[7,9,5,11,8,6,4]" :labels="['一','二','三','四','五','六','日']" /></div></div>
    </div>
  `
});

const FactoryPage = defineComponent({
  components: { Tabs, StatCard, TankCard, DataTable, TaskCard },
  props: { data: Object },
  emits: ["open-tank", "toast"],
  data() {
    return { tab: "tanks" };
  },
  computed: {
    stockRows() {
      return this.data.materials.filter((item) => item.location.includes("成品") || item.name.includes("IPA") || item.name.includes("小麦"));
    },
    stockColumns() {
      return stockColumns;
    },
    planColumns() {
      return planColumns;
    }
  },
  template: `
    <Tabs v-model="tab" :tabs="[{id:'tanks',label:'发酵罐状态'},{id:'plans',label:'生产计划'},{id:'stock',label:'库存视图'},{id:'site',label:'现场任务'}]" />
    <template v-if="tab === 'tanks'">
      <div class="stats-grid">
        <StatCard label="发酵中" value="3" change="主发酵/冷贮/异常" tone="warn" />
        <StatCard label="空罐" value="1" change="FV-04 待清洗确认" tone="up" />
        <StatCard label="待包装" value="760L" change="德式小麦" tone="up" />
        <StatCard label="异常罐" value="1" change="FV-03 需复测" tone="down" />
      </div>
      <div class="panel">
        <div class="panel-header"><div><div class="panel-title">按厂区展示发酵罐</div><div class="panel-subtitle">点击罐体查看每日任务和历史曲线</div></div><button class="btn btn-sm btn-primary" @click="$emit('toast','已打开发酵数据录入')">录入发酵数据</button></div>
        <div class="panel-body"><div class="tank-grid"><TankCard v-for="tank in data.tanks" :key="tank.id" :tank="tank" @open="$emit('open-tank', $event)" /></div></div>
      </div>
    </template>
    <div v-else-if="tab === 'plans'" class="panel"><div class="panel-header"><div class="panel-title">生产计划</div></div><div class="panel-body no-padding"><DataTable :columns="planColumns" :rows="data.plans" /></div></div>
    <div v-else-if="tab === 'stock'" class="panel"><div class="panel-header"><div class="panel-title">半成品与成品库存</div></div><div class="panel-body no-padding"><DataTable :columns="stockColumns" :rows="stockRows" /></div></div>
    <div v-else class="panel"><div class="panel-header"><div class="panel-title">现场任务</div></div><div class="panel-body task-list"><TaskCard v-for="task in data.tasks.filter(t => t.role === 'operator')" :key="task.title" :title="task.title" :desc="task.source + ' · ' + task.due + ' · ' + task.desc" :state="task.state" /></div></div>
  `
});

const ProductionPage = defineComponent({
  components: { Tabs, DataTable, Workflow, TaskCard },
  props: { data: Object },
  emits: ["modal"],
  data() {
    return { tab: "requests" };
  },
  computed: {
    requestColumns() {
      return requestColumns;
    },
    planColumns() {
      return planColumns;
    }
  },
  methods: {
    openRequest() {
      this.$emit("modal", "新建产品需求", formHtml([["产品名称", "桂花小麦"], ["数量", "300 箱"], ["包装方式", "330ml 瓶 / 24"], ["要求出品日期", "2026-09-02"], ["客户名称", "啤酒便利"], ["酒液需求", "2376L"]]));
    },
    openPlan() {
      this.$emit("modal", "新建生产计划", formHtml([["计划类型", "糖化"], ["产品名称", "桂花小麦"], ["工艺版本", "GHX-1-2-1"], ["计划体积", "3000L"], ["厂区", "铜陵厂"], ["目标发酵罐", "FV-05"], ["计划时间", "2026-08-18 08:00"], ["负责人", "王酿酒师"]]));
    }
  },
  template: `
    <Tabs v-model="tab" :tabs="[{id:'requests',label:'产品需求'},{id:'plans',label:'生产计划'},{id:'mash',label:'糖化执行'},{id:'fermentation',label:'发酵执行'},{id:'package',label:'包装品鉴'}]" />
    <div v-if="tab === 'requests'" class="panel"><div class="panel-header"><div class="panel-title">产品需求</div><button class="btn btn-sm btn-primary" @click="openRequest">新建需求</button></div><div class="panel-body no-padding"><DataTable :columns="requestColumns" :rows="data.requests" /></div></div>
    <div v-else-if="tab === 'plans'" class="panel"><div class="panel-header"><div class="panel-title">生产计划</div><button class="btn btn-sm btn-primary" @click="openPlan">新建计划</button></div><div class="panel-body no-padding"><DataTable :columns="planColumns" :rows="data.plans" /></div></div>
    <div v-else-if="tab === 'mash'" class="panel"><div class="panel-header"><div class="panel-title">糖化执行</div><button class="btn btn-sm btn-primary">开始执行</button></div><div class="panel-body"><Workflow :items="['确认物料批次','糖化水升温','混入麦芽','分段糖化','过滤洗糟','煮沸投花','冷却进罐'].map((title, index) => ({ title, desc: index < 2 ? '已确认' : '待执行', state: index < 2 ? 'done' : index === 2 ? 'active' : '' }))" /></div></div>
    <div v-else-if="tab === 'fermentation'" class="panel"><div class="panel-header"><div class="panel-title">发酵执行</div></div><div class="panel-body task-list"><TaskCard v-for="task in data.tasks.filter(t => ['operator','brewer'].includes(t.role))" :key="task.title" :title="task.title" :desc="task.source + ' · ' + task.due + ' · ' + task.desc" :state="task.state" /></div></div>
    <div v-else class="panel"><div class="panel-header"><div class="panel-title">包装与品鉴</div></div><div class="panel-body"><Workflow :items="['来源罐确认','包装物领用','灌装执行','成品入库','生成条码','品鉴归档'].map((title, index) => ({ title, desc: index < 2 ? '已确认' : '待执行', state: index < 2 ? 'done' : index === 2 ? 'active' : '' }))" /></div></div>
  `
});

const RecipePage = defineComponent({
  components: { DataTable, StatCard, TaskCard },
  props: { recipes: Array },
  emits: ["modal"],
  computed: {
    recipeColumns() {
      return recipeColumns;
    }
  },
  methods: {
    openRecipe() {
      this.$emit("modal", "配方详情", formHtml([["产品名称", "婴儿肥 IPA"], ["工艺编号", "YEF-2-2-1"], ["目标体积", "1000L"], ["原始糖度", "15.2°P"], ["苦味值", "58 IBU"], ["酒精度", "6.3%"]]));
    }
  },
  template: `
    <div class="panel">
      <div class="panel-header"><div><div class="panel-title">配方版本库</div><div class="panel-subtitle">生产计划必须引用已审核的具体版本</div></div><button class="btn btn-sm btn-primary" @click="openRecipe">新建配方</button></div>
      <div class="panel-body no-padding"><DataTable :columns="recipeColumns" :rows="recipes" /></div>
    </div>
    <div class="grid-2">
      <div class="panel"><div class="panel-header"><div class="panel-title">工艺审核任务</div></div><div class="panel-body"><TaskCard title="NEI-1-1-3 待审核" desc="修改了发酵时间和双乙酰阈值" state="待审核" /></div></div>
      <div class="panel"><div class="panel-header"><div class="panel-title">配方计算结果</div></div><div class="panel-body"><div class="stats-grid compact-stats"><StatCard label="目标酒精度" value="6.3%" change="YEF-2-2-1" tone="up" /><StatCard label="预计用水" value="1,420L" change="1000L 批次" tone="warn" /></div></div></div>
    </div>
  `
});

const InventoryPage = defineComponent({
  components: { Tabs, DataTable, Workflow },
  props: { data: Object },
  emits: ["toast"],
  data() {
    return { tab: "stock" };
  },
  computed: {
    stockColumns() {
      return stockColumns;
    },
    purchaseColumns() {
      return purchaseColumns;
    }
  },
  template: `
    <Tabs v-model="tab" :tabs="[{id:'stock',label:'库存清单'},{id:'purchase',label:'采购需求'},{id:'receive',label:'收货质检'},{id:'requisition',label:'领料退库'}]" />
    <div v-if="tab === 'stock'" class="panel"><div class="panel-header"><div><div class="panel-title">库存清单</div><div class="panel-subtitle">账面库存、预占库存、可用库存必须分开</div></div><button class="btn btn-sm btn-primary">库存操作</button></div><div class="panel-body no-padding"><DataTable :columns="stockColumns" :rows="data.materials" /></div></div>
    <div v-else-if="tab === 'purchase'" class="panel"><div class="panel-header"><div><div class="panel-title">采购需求</div><div class="panel-subtitle">生产计划确认后自动生成，按可用库存计算缺口</div></div><button class="btn btn-sm btn-primary">生成采购订单</button></div><div class="panel-body no-padding"><DataTable :columns="purchaseColumns" :rows="data.purchases" /></div></div>
    <div v-else-if="tab === 'receive'" class="panel"><div class="panel-header"><div class="panel-title">收货与质检</div></div><div class="panel-body"><div class="form-grid"><div class="form-group" v-for="item in ['采购订单号','物流单号','供应商','实际到达数量','合格数量','保质期']" :key="item"><label class="form-label">{{ item }}</label><input class="form-input"></div></div><button class="btn btn-primary form-action" @click="$emit('toast','已生成入库记录')">质检合格入库</button></div></div>
    <div v-else class="panel"><div class="panel-header"><div class="panel-title">领料与退库</div></div><div class="panel-body"><Workflow :items="[{title:'选择生产计划',desc:'PLN-260818-001',state:'active'},{title:'FIFO 推荐批次',desc:'小麦芽 3 批',state:'active'},{title:'确认实领',desc:'库管执行'},{title:'生产现场库存',desc:'自动转移'},{title:'剩余退库',desc:'记录损耗'}]" /></div></div>
  `
});

const TracePage = defineComponent({
  template: `
    <div class="trace-layout">
      <div class="panel">
        <div class="panel-header"><div class="panel-title">成品条码</div></div>
        <div class="panel-body">
          <div class="barcode-box"><div class="fake-barcode"><span v-for="(width, index) in [2,4,3,5,2,6,3,4,2,5,3,6,2,4,3,5]" :key="index" :style="{ width: width + 'px' }"></span></div><div class="mono">BJ20260805IPA0001</div></div>
          <div class="task-list trace-info">
            <div class="tank-line"><span>产品</span><strong>婴儿肥 IPA 20L桶</strong></div>
            <div class="tank-line"><span>包装批次</span><strong>FIN-260812-YEF01</strong></div>
            <div class="tank-line"><span>物流单号</span><strong>SF2608178891</strong></div>
            <div class="tank-line"><span>客户</span><strong>醉猫酒馆</strong></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><div class="panel-title">批次追溯链路</div><div class="panel-subtitle">成品 → 包装 → 发酵 → 糖化 → 原料 → 采购 → 质检</div></div><button class="btn btn-sm btn-outline">导出</button></div>
        <div class="panel-body"><div class="timeline">
          <div v-for="item in timeline" :key="item.title" class="timeline-item"><div class="timeline-time">{{ item.time }}</div><div class="timeline-title">{{ item.title }}</div><div class="timeline-desc">{{ item.desc }}</div></div>
        </div></div>
      </div>
    </div>
  `,
  data() {
    return {
      timeline: [
        { time: "2026-08-17", title: "销售出库", desc: "客户：醉猫酒馆 · 物流单号 SF2608178891 · 状态：运输中" },
        { time: "2026-08-12", title: "包装完成", desc: "来源 FV-01 · 实际包装 60 桶 · 损耗 18L · 条码已生成" },
        { time: "2026-08-05 ~ 08-12", title: "发酵管理", desc: "发酵罐 FV-01 · 温度 18-20℃ · 压力 0.5-1.8bar · 品鉴合格" },
        { time: "2026-08-05", title: "糖化进罐", desc: "糖化批次 MAS-260805-YEF01 · 原始糖度 15.2°P · 进罐 1900L" },
        { time: "2026-08-03", title: "原料质检入库", desc: "澳麦、卡斯卡特、US-05 · 质检合格 · 采购订单 PO-260801-001" }
      ]
    };
  }
});

const ReportsPage = defineComponent({
  components: { StatCard, BarChart },
  template: `
    <div class="stats-grid">
      <StatCard label="计划达成率" value="86%" change="本月 18/21 批" tone="up" />
      <StatCard label="酒液损耗率" value="3.8%" change="低于目标 5%" tone="up" />
      <StatCard label="采购金额" value="¥42,600" change="本月累计" tone="warn" />
      <StatCard label="质检合格率" value="97.2%" change="1 批包装破损" tone="up" />
    </div>
    <div class="grid-2">
      <div class="panel"><div class="panel-header"><div class="panel-title">生产趋势</div></div><div class="panel-body"><BarChart :values="[8,12,10,15,13,16,14]" :labels="['2月','3月','4月','5月','6月','7月','8月']" /></div></div>
      <div class="panel"><div class="panel-header"><div class="panel-title">成本结构</div></div><div class="panel-body"><BarChart :values="[48,18,12,9,13]" :labels="['麦芽','酒花','酵母','包装','损耗']" /></div></div>
    </div>
    <div class="panel"><div class="panel-header"><div class="panel-title">报表目录</div></div><div class="panel-body"><div class="grid-3"><div v-for="item in reports" :key="item.title" class="setting-card"><div class="task-title">{{ item.title }}</div><div class="task-desc">{{ item.desc }}</div><button class="btn btn-xs btn-outline card-action">进入</button></div></div></div></div>
  `,
  data() {
    return {
      reports: [
        { title: "生产报表", desc: "计划量、进罐量、成品量、生产周期、设备利用率" },
        { title: "发酵报表", desc: "温度、压力、糖度、双乙酰、任务完成率" },
        { title: "库存报表", desc: "账面库存、预占库存、可用库存、保质期预警" },
        { title: "采购报表", desc: "采购金额、到货及时率、供应商合格率" },
        { title: "成本报表", desc: "批次原料成本、包装成本、每升成本" },
        { title: "质量追溯", desc: "批次完整记录、问题批次影响范围" }
      ]
    };
  }
});

const SettingsPage = defineComponent({
  template: `
    <div class="grid-3">
      <div v-for="item in settings" :key="item.title" class="setting-card">
        <div class="task-title">{{ item.title }}</div>
        <div class="task-desc">{{ item.desc }}</div>
        <button class="btn btn-xs btn-outline card-action">进入</button>
      </div>
    </div>
  `,
  data() {
    return {
      settings: [
        { title: "厂区设置", desc: "铜陵厂、溧水厂、地址、负责人、启用状态" },
        { title: "设备设置", desc: "糖化设备、发酵罐、清酒罐、包装线、离心机" },
        { title: "仓库设置", desc: "原料仓、包装仓、待检库、半成品库、成品库" },
        { title: "原料设置", desc: "麦芽、酒花、酵母、辅料、包装物" },
        { title: "供应商设置", desc: "联系人、银行信息、供货品类、资格状态" },
        { title: "客户设置", desc: "客户联系人、收货地址、客户等级" },
        { title: "人员权限", desc: "总经理、生产总监、酿酒师、操作工、库管、采购、销售、财务" },
        { title: "批次规则", desc: "厂区码、日期、流水号、产品缩写" },
        { title: "预警规则", desc: "低库存、保质期、任务逾期、发酵参数异常" }
      ]
    };
  }
});

const TasksPage = defineComponent({
  components: { StatCard, TaskCard },
  props: { tasks: Array },
  template: `
    <div class="stats-grid">
      <StatCard label="待处理" :value="tasks.length" change="按当前角色过滤" tone="warn" />
      <StatCard label="逾期风险" :value="tasks.filter(t => ['逾期风险','紧急'].includes(t.state)).length" change="需要优先处理" tone="down" />
      <StatCard label="今日完成" value="9" change="演示数据" tone="up" />
      <StatCard label="本周任务" value="42" change="完成率 78%" tone="up" />
    </div>
    <div class="panel"><div class="panel-header"><div class="panel-title">我的待办</div></div><div class="panel-body task-list"><TaskCard v-for="task in tasks" :key="task.title" :title="task.title" :desc="task.source + ' · ' + task.due + ' · ' + task.desc" :state="task.state" /><div v-if="!tasks.length" class="empty">当前角色暂无待办</div></div></div>
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
