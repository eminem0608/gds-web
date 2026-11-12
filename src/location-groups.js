import { locationLabel, locationPathLabel } from "./location-label.js";

export const locationDisplayName = locationPathLabel;
const relationId = value => String(value?.id ?? value ?? "");

export function groupWarehouseLocations(locations, warehouses = []) {
  const byId = new Map(locations.map(location => [String(location.id), location]));
  if (warehouses.length) {
    return warehouses.map(warehouse => {
      const rootId = relationId(warehouse.lot_stock_id);
      const rootPath = String(warehouse.lot_stock_id?.name || "");
      const members = locations.filter(location => {
        if (String(location.id) === rootId) return false;
        let parent = relationId(location.location_id);
        const visited = new Set();
        while (parent && !visited.has(parent)) {
          if (parent === rootId) return true;
          visited.add(parent);
          parent = relationId(byId.get(parent)?.location_id);
        }
        // Ancestors can be absent from the API when they are technical locations.
        return rootPath && String(location.complete_name || "").startsWith(rootPath + "/");
      });
      const leaves = members.filter(location => !members.some(other => relationId(other.location_id) === String(location.id)));
      return {
        id: String(warehouse.id), name: warehouse.name,
        locations: leaves.map(location => {
          const path = [], visited = new Set();
          let current = location;
          while (current && String(current.id) !== rootId && !visited.has(String(current.id))) {
            visited.add(String(current.id));
            path.unshift(locationLabel(current));
            current = byId.get(relationId(current.location_id));
          }
          return { ...location, label: path.join(" / ") };
        })
      };
    });
  }
  const groups = new Map();
  for (const location of locations) {
    const parts = locationDisplayName(location).split(/\s*\/\s*/).filter(Boolean);
    const name = parts[0] || "其他仓库";
    if (!groups.has(name)) groups.set(name, { id: name, name, locations: [] });
    groups.get(name).locations.push({ ...location, label: parts.slice(1).join(" / ") || location.location_name || name });
  }
  for (const group of groups.values()) {
    group.locations = group.locations.filter(location => !group.locations.some(other =>
      other.id !== location.id && (location.label === group.name || other.label.startsWith(location.label + " / "))
    ));
  }
  return [...groups.values()];
}
