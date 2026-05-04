/** 个人主页「加入 / 活跃」时间展示：YYYY年M月 */
export function formatJoinedMonthZh(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}
