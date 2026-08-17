export const roles = {
  gm: { label: "总经理", avatar: "总", desc: "全局视图", pages: ["dashboard", "factory", "production", "recipe", "inventory", "trace", "reports", "settings", "tasks"] },
  director: { label: "生产总监", avatar: "监", desc: "生产统筹", pages: ["dashboard", "factory", "production", "recipe", "inventory", "trace", "reports", "settings", "tasks"] },
  brewer: { label: "酿酒师", avatar: "酿", desc: "工艺与品控", pages: ["dashboard", "factory", "production", "recipe", "inventory", "trace", "reports", "tasks"] },
  operator: { label: "操作工", avatar: "工", desc: "现场执行", pages: ["factory", "production", "tasks"] },
  warehouse: { label: "库管", avatar: "库", desc: "库存作业", pages: ["dashboard", "factory", "inventory", "trace", "reports", "tasks"] },
  purchase: { label: "采购", avatar: "采", desc: "供应链", pages: ["dashboard", "inventory", "trace", "reports", "settings", "tasks"] },
  sales: { label: "销售", avatar: "销", desc: "需求与出库", pages: ["dashboard", "production", "trace", "reports", "settings", "tasks"] },
  finance: { label: "财务", avatar: "财", desc: "付款与成本", pages: ["dashboard", "inventory", "reports", "tasks"] }
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

export const demoData = {
  tanks: [
    { id: "FV-01", factory: "铜陵厂", type: "发酵罐", status: "fermenting", product: "婴儿肥 IPA", batch: "FER20260805001", volume: 1900, capacity: 2000, day: 12, temp: 19.2, pressure: 0.7, gravity: 6.8, tasks: "测糖、排渣", warning: false },
    { id: "FV-02", factory: "铜陵厂", type: "发酵罐", status: "cold", product: "桂花小麦", batch: "FER20260803002", volume: 1450, capacity: 1500, day: 15, temp: 4.2, pressure: 1.8, gravity: 3.1, tasks: "品鉴", warning: false },
    { id: "FV-03", factory: "铜陵厂", type: "发酵罐", status: "alert", product: "浑浊 IPA", batch: "FER20260728001", volume: 930, capacity: 1000, day: 20, temp: 18.9, pressure: 0.9, gravity: 4.2, tasks: "复测双乙酰", warning: true },
    { id: "FV-04", factory: "溧水厂", type: "发酵罐", status: "empty", product: "", batch: "", volume: 0, capacity: 1000, day: 0, temp: 0, pressure: 0, gravity: 0, tasks: "待清洗确认", warning: false },
    { id: "BT-01", factory: "溧水厂", type: "清酒罐", status: "ready", product: "德式小麦", batch: "BRI20260808001", volume: 760, capacity: 1000, day: 8, temp: 2.8, pressure: 2.0, gravity: 2.8, tasks: "待包装", warning: false }
  ],
  requests: [
    { id: "REQ-260817-001", product: "婴儿肥 IPA", package: "20L 桶", qty: "80 桶", liquid: 1600, customer: "醉猫酒馆", date: "2026-08-28", state: "待排产" },
    { id: "REQ-260817-002", product: "桂花小麦", package: "330ml 瓶 / 24", qty: "300 箱", liquid: 2376, customer: "啤酒便利", date: "2026-09-02", state: "已排产" },
    { id: "REQ-260817-003", product: "浑浊 IPA", package: "500ml 听 / 12", qty: "240 箱", liquid: 1440, customer: "城市精酿节", date: "2026-08-25", state: "逾期风险" }
  ],
  plans: [
    { id: "PLN-260818-001", type: "糖化", product: "桂花小麦", volume: 3000, recipe: "GHX-1-2-1", date: "2026-08-18 08:00", factory: "铜陵厂", device: "糖化线 A", tank: "FV-05", owner: "王酿酒师", state: "待备料" },
    { id: "PLN-260819-002", type: "包装", product: "婴儿肥 IPA", volume: 1200, recipe: "YEF-2-2-1", date: "2026-08-19 09:30", factory: "铜陵厂", device: "灌装线 1", tank: "FV-01", owner: "李班长", state: "待执行" },
    { id: "PLN-260820-003", type: "清洗", product: "", volume: 0, recipe: "", date: "2026-08-20 16:00", factory: "溧水厂", device: "FV-04", tank: "FV-04", owner: "赵工", state: "已下发" }
  ],
  materials: [
    { location: "铜陵原料仓", name: "澳麦基础麦芽", batch: "MAT-260801-A01", qty: 320, reserved: 260, unit: "kg", expire: "2027-02-01", status: "正常" },
    { location: "铜陵原料仓", name: "卡斯卡特酒花", batch: "MAT-260805-H03", qty: 4.2, reserved: 3.6, unit: "kg", expire: "2026-11-03", status: "低库存" },
    { location: "溧水包装仓", name: "330ml 棕瓶", batch: "PKG-260810-B01", qty: 4200, reserved: 3200, unit: "个", expire: "-", status: "正常" },
    { location: "成品库 A", name: "德式小麦 20L桶", batch: "FIN-260812-W01", qty: 36, reserved: 12, unit: "桶", expire: "2026-12-12", status: "可售" }
  ],
  purchases: [
    { id: "PR-260817-001", source: "PLN-260818-001", material: "小麦芽", need: 600, stock: 210, reserve: 210, shortage: 390, supplier: "宝红", state: "待生成订单" },
    { id: "PR-260817-002", source: "PLN-260818-001", material: "卡斯卡特酒花", need: 5, stock: 4.2, reserve: 3.6, shortage: 1.4, supplier: "巴特", state: "待审核" },
    { id: "PO-260816-003", source: "PLN-260819-002", material: "20L 不锈钢桶", need: 80, stock: 36, reserve: 36, shortage: 44, supplier: "桶匠", state: "待付款" }
  ],
  tasks: [
    { role: "operator", title: "FV-01 测糖并记录压力", source: "FER20260805001", due: "今天 10:00", desc: "填写糖度、温度、压力，确认是否排渣", state: "待处理" },
    { role: "brewer", title: "FV-03 复测双乙酰", source: "FER20260728001", due: "今天 11:30", desc: "结果低于 0.15ppm 后可进入降温", state: "紧急" },
    { role: "warehouse", title: "PLN-260818-001 备料", source: "糖化计划", due: "今天 16:00", desc: "按先进先出锁定小麦芽、酒花、酵母", state: "待处理" },
    { role: "purchase", title: "卡斯卡特酒花采购下单", source: "PR-260817-002", due: "今天 18:00", desc: "选择供应商、包装规格、预计到货日期", state: "待审核" },
    { role: "finance", title: "PO-260816-003 付款确认", source: "采购订单", due: "明天 12:00", desc: "确认对公付款后通知采购和库管", state: "待处理" },
    { role: "sales", title: "城市精酿节订单排产跟进", source: "REQ-260817-003", due: "今天 15:00", desc: "交付日期接近，需要确认包装计划", state: "逾期风险" }
  ],
  recipes: [
    { code: "YEF-2-2-1", name: "婴儿肥 IPA", style: "美式 IPA", og: "15.2", ibu: 58, color: 18, abv: "6.3%", state: "使用中", owner: "高岩" },
    { code: "GHX-1-2-1", name: "桂花小麦", style: "比利时小麦", og: "12.6", ibu: 18, color: 9, abv: "4.8%", state: "已审核", owner: "高岩" },
    { code: "NEI-1-1-3", name: "浑浊 IPA", style: "NEIPA", og: "16.4", ibu: 42, color: 14, abv: "6.8%", state: "待审核", owner: "陈酿酒师" }
  ]
};
