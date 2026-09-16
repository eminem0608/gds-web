export const roles = {
  gm: { label: "总经理", avatar: "总", desc: "全局视图", pages: ["dashboard", "factory", "production", "recipe", "inventory", "trace", "reports", "settings", "tasks"] },
  director: { label: "生产总监", avatar: "监", desc: "生产统筹", pages: ["dashboard", "factory", "production", "recipe", "inventory", "trace", "reports", "settings", "tasks"] },
  operator: { label: "操作工", avatar: "工", desc: "现场执行", pages: ["factory", "production", "tasks"] },
  warehouse: { label: "库管", avatar: "库", desc: "库存作业", pages: ["dashboard", "factory", "inventory", "trace", "reports", "tasks"] },
  purchase: { label: "采购", avatar: "采", desc: "供应链", pages: ["dashboard", "inventory", "trace", "reports", "settings", "tasks"] },
  sales: { label: "销售", avatar: "销", desc: "需求与出库", pages: ["dashboard", "production", "trace", "reports", "settings", "tasks"] },
  finance: { label: "财务", avatar: "财", desc: "数据导出", pages: ["dashboard", "inventory", "reports", "tasks"] },
  admin: { label: "系统管理员", avatar: "管", desc: "系统配置", pages: ["settings", "tasks"] }
};

export const pageMeta = {
  dashboard: { title: "总数据看板", subtitle: "经营、生产、库存、采购和异常的统一入口", icon: "01" },
  factory: { title: "酒厂", subtitle: "发酵罐状态、现场计划、半成品和成品库存", icon: "02" },
  production: { title: "生产管理", subtitle: "产品需求、生产计划、糖化、发酵、包装和品鉴", icon: "03" },
  recipe: { title: "配方工艺", subtitle: "配方设计、糖化工艺、发酵规则和版本审核", icon: "04" },
  inventory: { title: "库存采购", subtitle: "采购需求、采购订单、入库、领料、盘点和库存预警", icon: "05" },
  trace: { title: "物流追溯", subtitle: "条码、批次、出库、物流和客户签收", icon: "06" },
  reports: { title: "报表分析", subtitle: "生产、发酵、库存、采购、成本和质量报表", icon: "07" },
  settings: { title: "系统设置", subtitle: "厂区、设备、原料、供应商、客户和权限", icon: "08" },
  tasks: { title: "我的任务", subtitle: "按角色聚合今日待办、逾期和已完成任务", icon: "09" }
};

export const navSections = [
  { title: "总览", items: [["dashboard", "总数据看板"], ["tasks", "我的任务"]] },
  { title: "业务", items: [["factory", "酒厂"], ["production", "生产管理"], ["recipe", "配方工艺"], ["inventory", "库存采购"]] },
  { title: "分析", items: [["trace", "物流追溯"], ["reports", "报表分析"], ["settings", "系统设置"]] }
];
