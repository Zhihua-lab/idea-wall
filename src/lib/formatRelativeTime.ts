/** 相对时间，用于列表卡片（zh-CN）。 */
export function formatRelativeTime(iso: string, locale = 'zh-CN'): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const sec = Math.floor((Date.now() - then) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (sec < 60) return rtf.format(-sec, 'second')
  const min = Math.floor(sec / 60)
  if (min < 60) return rtf.format(-min, 'minute')
  const hr = Math.floor(min / 60)
  if (hr < 24) return rtf.format(-hr, 'hour')
  const day = Math.floor(hr / 24)
  if (day < 7) return rtf.format(-day, 'day')
  const week = Math.floor(day / 7)
  if (week < 5) return rtf.format(-week, 'week')
  const month = Math.floor(day / 30)
  if (month < 12) return rtf.format(-month, 'month')
  const year = Math.floor(day / 365)
  return rtf.format(-year, 'year')
}
