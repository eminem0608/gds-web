export function formatMoney(value) {
  const amount = Number(value || 0);
  const formattedAmount = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
  return `¥${formattedAmount}`;
}
