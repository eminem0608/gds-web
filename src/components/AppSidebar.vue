<script setup>
import { ref, watch } from 'vue';
defineProps({ sections: { type: Array, default: () => [] }, currentPage: String, pendingTaskCount: { type: Number, default: 0 } });
defineEmits(['select']);
const preferenceKey = 'craft-brew.sidebar-collapsed';
function savedPreference() { try { const saved=window.localStorage.getItem(preferenceKey); return saved === null ? window.matchMedia('(max-width:900px)').matches : saved === 'true'; } catch { return false; } }
const collapsed = ref(savedPreference());
watch(collapsed, value => { try { window.localStorage.setItem(preferenceKey, String(value)); } catch { /* Navigation also works when storage is unavailable. */ } });
const icons = {
  dashboard: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  tasks: ['M9 4h6v4H9z', 'M9 6H6v15h12V6h-3M9 12h6M9 16h4'],
  factory: ['M3 21V10l6 3V7l6 3V3h5v18zM7 17h1M12 17h1M17 17h1'],
  production: ['M3 6h18M3 12h18M3 18h18', 'M7 3v6M16 9v6M10 15v6'],
  recipe: ['M5 3h14v18H5zM9 7h6M9 11h6M9 15h3'],
  inventory: ['m3 7 9-4 9 4v10l-9 4-9-4z', 'm3 7 9 4 9-4M12 11v10M7 5l9 4'],
  trace: ['M3 7h11v11H3zM14 11h4l3 4v3h-7', 'M7 18a2 2 0 1 0 0 .1M17 18a2 2 0 1 0 0 .1'],
  reports: ['M4 3v18h17M8 16v-5M13 16V7M18 16V4'],
  settings: ['M4 7h16M4 17h16', 'M9 4v6M15 14v6'],
  supplier_catalog: ['M4 8h16v13H4zM3 8l2-5h14l2 5M8 12h8M8 16h5']
};
</script>
<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': collapsed }" aria-label="主导航">
    <div class="brand">
      <div class="brand-row">
        <div class="brand-icon" :title="collapsed ? '发啦啦精酿' : undefined">发</div>
        <div class="sidebar-brand-copy"><div class="brand-name">发啦啦精酿</div><div class="brand-sub">生产管理</div></div>
        <button type="button" class="sidebar-toggle" :aria-label="collapsed ? '展开导航' : '收起导航'" :title="collapsed ? '展开导航' : '收起导航'" :aria-expanded="!collapsed" aria-controls="main-navigation" @click="collapsed = !collapsed">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path :d="collapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'"/></svg>
        </button>
      </div>
    </div>
    <nav id="main-navigation" class="nav">
      <section v-for="section in sections" :key="section.title" class="sidebar-nav-group" :aria-label="section.title">
        <div class="nav-title">{{ section.title }}</div>
        <button v-for="item in section.items" :key="item.id" class="nav-item" :class="{active: currentPage === item.id}" type="button" :aria-current="currentPage === item.id ? 'page' : undefined" :aria-label="item.label + (item.id === 'tasks' && pendingTaskCount ? '，' + pendingTaskCount + '项未完成任务' : '')" :title="collapsed ? item.label + (item.id === 'tasks' && pendingTaskCount ? ' · ' + pendingTaskCount + '项待办' : '') : undefined" @click="$emit('select', item.id)">
          <svg class="sidebar-page-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="(d,index) in (icons[item.id] || icons.recipe)" :key="index" :d="d"/></svg>
          <span class="sidebar-page-label">{{ item.label }}</span>
          <span v-if="item.id === 'tasks' && pendingTaskCount" class="nav-task-count" aria-hidden="true">{{ pendingTaskCount > 99 ? '99+' : pendingTaskCount }}</span>
        </button>
      </section>
    </nav>
    <slot />
  </aside>
</template>
<style scoped>
.sidebar{width:240px;min-width:240px;overflow:visible;transition:width .18s ease,min-width .18s ease;flex-shrink:0}.brand{padding:18px 14px 14px}.brand-row{gap:10px}.brand-icon{flex-shrink:0}.sidebar-brand-copy{min-width:0;flex:1}.brand-name{white-space:nowrap;font-size:15px}.sidebar-toggle{display:grid;place-items:center;width:28px;height:30px;flex:none;padding:5px;border:0;border-radius:5px;color:var(--text-muted);background:none;cursor:pointer}.sidebar-toggle:hover{color:var(--text-primary);background:var(--bg-hover)}.sidebar-toggle svg,.sidebar-page-icon{fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.sidebar-toggle svg{width:18px;height:18px}.nav{min-height:0;overflow-y:auto;padding:14px 10px}.sidebar-nav-group+.sidebar-nav-group{margin-top:14px}.nav-title{font-weight:500;letter-spacing:1px;padding-bottom:6px}.nav-item{min-height:42px;font-size:13px;position:relative}.sidebar-page-icon{width:19px;height:19px;flex:none;opacity:.85}.sidebar-page-label{white-space:nowrap}.sidebar-toggle:focus-visible,.nav-item:focus-visible{outline:2px solid var(--accent-gold);outline-offset:-2px}.sidebar-collapsed{width:64px;min-width:64px}.sidebar-collapsed .brand{padding:14px 0 8px}.sidebar-collapsed .brand-row{flex-direction:column;gap:8px}.sidebar-collapsed .brand-icon{width:32px;height:32px;font-size:15px}.sidebar-collapsed .sidebar-brand-copy,.sidebar-collapsed .sidebar-page-label{display:none}.sidebar-collapsed .nav{padding:4px 8px}.sidebar-collapsed .nav-title{display:none}.sidebar-collapsed .sidebar-nav-group+.sidebar-nav-group{border-top:1px solid var(--border-subtle);padding-top:10px;margin-top:10px}.sidebar-collapsed .nav-item{justify-content:center;padding:10px 0;min-height:42px}.sidebar-collapsed .nav-task-count{position:absolute;top:4px;right:4px;min-width:6px;width:6px;height:6px;padding:0;font-size:0;background:var(--accent-gold)}.sidebar-collapsed :slotted(.account-area){padding:8px}.sidebar-collapsed :deep(.current-account-trigger){padding:6px 0;justify-content:center}.sidebar-collapsed :deep(.current-account-info),.sidebar-collapsed :deep(.current-account-chevron){display:none}.sidebar-collapsed :deep(.current-account-menu){width:230px;left:8px;right:auto}.sidebar-collapsed :deep(.current-account-menu button){flex-wrap:wrap;gap:5px}
@media(max-width:900px){.sidebar:not(.sidebar-collapsed){width:204px;min-width:204px}.brand-name{font-size:13px}.brand-icon{width:32px;height:32px}.brand-row{gap:7px}}@media(max-width:600px){.sidebar{max-height:none}.sidebar:not(.sidebar-collapsed){width:188px;min-width:188px}.brand{padding-left:10px;padding-right:8px}.brand-name{font-size:12px}}@media(prefers-reduced-motion:reduce){.sidebar{transition:none}}
</style>
