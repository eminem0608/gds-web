// Keep warehouse codes and technical paths out of visible location labels.
const technicalNames = {
  Stock: '主库存区', Input: '收货区', Output: '出库区',
  'Quality Control': '质检区', 'Packing Zone': '包装区',
  'Virtual Locations': '虚拟库位', 'Partner Locations': '往来库位',
  Vendors: '供应商', Customers: '客户', Production: '生产区',
  'Inventory adjustment': '库存调整', Scrap: '报废区',
};
function displayPart(part) {
  const name = part.trim().replace(/(?:[A-Z][A-Z0-9]*-)+\d+\s+(?=[\u3400-\u9fff])/g, '');
  return technicalNames[name] || name;
}
export function locationPathLabel(location) {
  const name = typeof location === 'string' ? location : location?.complete_name || location?.location_name || location?.name;
  const parts = String(name || '').split('/').map(part => part.trim()).filter(Boolean);
  if (parts.length > 1 && /^[A-Za-z0-9_-]+$/.test(parts[0])) parts.shift();
  return parts.map(displayPart).join('/');
}
export function locationLabel(location, fallback = '未设置') {
  const name = typeof location === 'string' ? location : location?.location_name || location?.name || location?.complete_name;
  return locationPathLabel(name).split('/').filter(Boolean).pop() || fallback;
}
