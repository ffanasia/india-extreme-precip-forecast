const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function parseIso(iso: string): { year: number; month: number; day: number } {
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
  }
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseIso(iso)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function diffDays(start: string, end: string): number {
  const a = parseIso(start)
  const b = parseIso(end)
  const ua = Date.UTC(a.year, a.month - 1, a.day)
  const ub = Date.UTC(b.year, b.month - 1, b.day)
  return Math.round((ub - ua) / 86_400_000)
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function formatDay(iso: string): string {
  const { day, month } = parseIso(iso)
  return `${day} ${MONTHS[month - 1]}`
}

export function formatDayYear(iso: string): string {
  const { year } = parseIso(iso)
  return `${formatDay(iso)} ${year}`
}

export function formatRange(start: string, end: string): string {
  if (start === end) return formatDayYear(start)
  const a = parseIso(start)
  const b = parseIso(end)
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${MONTHS[a.month - 1]} ${a.year}`
  }
  if (a.year === b.year) {
    return `${formatDay(start)} – ${formatDay(end)} ${a.year}`
  }
  return `${formatDayYear(start)} – ${formatDayYear(end)}`
}

export function todayInKolkata(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

export function formatIssued(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

export function assertDailyContinuity(dates: string[]): void {
  for (let index = 1; index < dates.length; index++) {
    const step = diffDays(dates[index - 1], dates[index])
    if (step !== 1) {
      throw new Error(`Date series breaks between ${dates[index - 1]} and ${dates[index]}`)
    }
  }
}
