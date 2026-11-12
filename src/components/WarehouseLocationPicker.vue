<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { groupWarehouseLocations } from "../location-groups";
const props = defineProps({
  modelValue: { type: [String, Number], default: "" },
  locations: { type: Array, default: () => [] },
  warehouses: { type: Array, default: () => [] },
  label: { type: String, default: "入库库位" }
});
const emit = defineEmits(["update:modelValue"]);
const groups = computed(() => groupWarehouseLocations(props.locations, props.warehouses));
const warehouse = ref("");
const currentGroup = computed(() => groups.value.find(group => group.id === warehouse.value));
const selected = computed(() => {
  for (const group of groups.value) {
    const location = group.locations.find(item => String(item.id) === String(props.modelValue));
    if (location) return { group, location };
  }
  return null;
});
const open = ref(false), keyword = ref(""), trigger = ref(null), search = ref(null), panelStyle = ref({});
const filteredLocations = computed(() => (currentGroup.value?.locations || []).filter(location =>
  (location.label + " " + (location.complete_name || "")).toLowerCase().includes(keyword.value.trim().toLowerCase())
));
watch([() => props.modelValue, groups], () => {
  if (selected.value) warehouse.value = selected.value.group.id;
  else if (props.modelValue) emit("update:modelValue", "");
  if (!groups.value.some(group => group.id === warehouse.value)) warehouse.value = groups.value[0]?.id || "";
}, { immediate: true });
function close() {
  open.value = false;
  window.removeEventListener("resize", close);
  window.removeEventListener("scroll", onScroll, true);
}
function onScroll(event) {
  if (!event.target?.closest?.('.warehouse-picker-panel')) close();
}
async function toggle() {
  if (open.value) { close(); return; }
  keyword.value = "";
  const rect = trigger.value.getBoundingClientRect();
  const width = Math.min(460, window.innerWidth - 24);
  const below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  const down = below >= 260 || below >= above;
  panelStyle.value = {
    width: width + "px", left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) + "px",
    ...(down ? { top: (rect.bottom + 6) + "px" } : { bottom: (window.innerHeight - rect.top + 6) + "px" }),
    maxHeight: Math.max(80, Math.min(360, down ? below : above)) + "px"
  };
  open.value = true;
  window.addEventListener("resize", close);
  window.addEventListener("scroll", onScroll, true);
  await nextTick();
  search.value?.focus();
}
function choose(location) {
  emit("update:modelValue", location.id);
  close();
  trigger.value?.focus();
}
function dismiss() { close(); trigger.value?.focus(); }
onBeforeUnmount(() => { if (open.value) close(); });
</script>
<template>
  <button ref="trigger" class="warehouse-picker-trigger" type="button" :aria-label="label" aria-haspopup="dialog" :aria-expanded="open" @click="toggle"><span :class="{ placeholder: !selected }">{{ selected ? selected.group.name + ' / ' + selected.location.label : '选择仓库 / 具体库位' }}</span><b aria-hidden="true">⌄</b></button>
  <Teleport to="body">
    <div v-if="open" class="warehouse-picker-dismiss" @click="dismiss" @keydown.esc="dismiss">
      <section class="warehouse-picker-panel" :style="panelStyle" role="dialog" :aria-label="'选择' + label" @click.stop>
        <div class="warehouse-picker-search"><input ref="search" v-model="keyword" aria-label="搜索库位" placeholder="搜索当前仓库的库位"><button type="button" aria-label="关闭库位选择" @click="dismiss">×</button></div>
        <div class="warehouse-picker-columns"><div class="warehouse-picker-warehouses"><button v-for="group in groups" :key="group.id" type="button" :class="{ active: warehouse === group.id }" :aria-pressed="warehouse === group.id" @click="warehouse = group.id; keyword = ''">{{ group.name }}<span>›</span></button></div>
          <div class="warehouse-picker-bins"><button v-for="location in filteredLocations" :key="location.id" type="button" :class="{ selected: String(modelValue) === String(location.id) }" @click="choose(location)"><span>{{ location.label }}</span><b v-if="String(modelValue) === String(location.id)">✓</b></button><p v-if="!filteredLocations.length">{{ keyword ? '没有匹配的库位' : currentGroup ? '该仓库暂无可用库位' : '暂无可用仓库' }}</p></div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.warehouse-picker-trigger { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-width: 0; height: 34px; padding: 0 10px; border: 1px solid #4a4338; border-radius: 5px; background: #292621; color: var(--text-primary); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.warehouse-picker-trigger > span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.warehouse-picker-trigger .placeholder { color: var(--text-muted); }
.warehouse-picker-trigger:hover, .warehouse-picker-trigger[aria-expanded="true"] { border-color: var(--accent-gold); }
.warehouse-picker-trigger b { color: var(--text-muted); }
.warehouse-picker-dismiss { position: fixed; inset: 0; z-index: 1100; }
.warehouse-picker-panel { position: fixed; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #514633; border-radius: 8px; background: #24211d; box-shadow: 0 12px 40px #0008; color: var(--text-primary); }
.warehouse-picker-search { display: flex; align-items: center; gap: 6px; padding: 10px; border-bottom: 1px solid #ffffff12; }
.warehouse-picker-search input { flex: 1; min-width: 0; height: 32px; padding: 0 9px; border: 1px solid #4a4338; border-radius: 4px; background: #1d1b18; color: var(--text-primary); font-size: 12px; }
.warehouse-picker-search button { border: 0; background: transparent; color: var(--text-muted); font-size: 22px; cursor: pointer; }
.warehouse-picker-columns { display: grid; grid-template-columns: 145px minmax(0,1fr); min-height: 0; overflow: hidden; }
.warehouse-picker-warehouses, .warehouse-picker-bins { overflow-y: auto; padding: 6px; min-height: 150px; }
.warehouse-picker-warehouses { background: #1e1c19; border-right: 1px solid #ffffff12; }
.warehouse-picker-columns button { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 10px; border: 0; border-radius: 4px; background: transparent; color: var(--text-secondary); font-size: 12px; text-align: left; cursor: pointer; overflow-wrap: anywhere; }
.warehouse-picker-columns button:hover { background: #ffffff08; }
.warehouse-picker-columns button.active, .warehouse-picker-columns button.selected { background: #d4a85315; color: var(--accent-gold); }
.warehouse-picker-bins p { padding: 12px; color: var(--text-muted); font-size: 12px; }
@media (max-width: 460px) { .warehouse-picker-columns { grid-template-columns: 110px minmax(0,1fr); } }
</style>
