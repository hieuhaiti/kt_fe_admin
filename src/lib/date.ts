const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh'

const parseDate = (value?: string | Date | null): Date | null => {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function formatDate(value?: string | Date | null, locale = 'vi-VN'): string {
  void locale
  if (!value) return '-'
  const raw = String(value)

  if (DATE_ONLY_REGEX.test(raw)) {
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  const d = parseDate(value)
  if (!d) return '-'

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)

  return formatted
}

export function formatDateTime(value?: string | Date | null, locale = 'vi-VN'): string {
  void locale
  if (!value) return '-'
  const d = parseDate(value)
  if (!d) return '-'

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)

  return formatted.replace(',', '')
}

export function formatPeriod(
  period: string | undefined,
  groupBy: 'day' | 'week' | 'month'
): string {
  if (!period) return '-'
  if (groupBy === 'day') return formatDate(period)
  if (groupBy === 'month') {
    const parts = period.split('-')
    if (parts.length === 2) return `${parts[1]}/${parts[0]}`
    return period
  }
  if (groupBy === 'week') {
    const match = period.match(/^(\d{4})-W(\d{1,2})$/)
    if (match) return `Tuần ${match[2]}/${match[1]}`
    return period
  }
  return period
}
