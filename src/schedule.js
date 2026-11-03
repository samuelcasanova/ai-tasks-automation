const DAILY_AT = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseDailyAt (value) {
  const match = DAILY_AT.exec(value ?? '')
  if (!match) {
    throw new Error(`dailyAt must be HH:MM, got ${JSON.stringify(value)}`)
  }
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

// Local time, so TZ decides what "16:30" means and DST shifts are absorbed by setDate.
function atTime (day, { hours, minutes }) {
  const date = new Date(day)
  date.setHours(hours, minutes, 0, 0)
  return date
}

export function nextRun (dailyAt, now) {
  const today = atTime(now, dailyAt)
  if (today > now) return today
  today.setDate(today.getDate() + 1)
  return today
}

export function previousRun (dailyAt, now) {
  const today = atTime(now, dailyAt)
  if (today <= now) return today
  today.setDate(today.getDate() - 1)
  return today
}

export function isRunOwed (dailyAt, lastRunAt, now) {
  return !lastRunAt || new Date(lastRunAt) < previousRun(dailyAt, now)
}
