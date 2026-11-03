const DAILY_AT = /^([01]\d|2[0-3]):([0-5]\d)$/
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function parseSchedule ({ dailyAt, days = DAY_NAMES }) {
  const match = DAILY_AT.exec(dailyAt ?? '')
  if (!match) {
    throw new Error(`dailyAt must be HH:MM, got ${JSON.stringify(dailyAt)}`)
  }
  if (!Array.isArray(days) || !days.length) {
    throw new Error(`days must be a non-empty list like ["mon", "tue"], got ${JSON.stringify(days)}`)
  }
  const weekdays = days.map(name => {
    const index = DAY_NAMES.indexOf(name)
    if (index === -1) throw new Error(`Unknown day ${JSON.stringify(name)}, expected one of ${DAY_NAMES.join(', ')}`)
    return index
  })
  return { hours: Number(match[1]), minutes: Number(match[2]), weekdays: new Set(weekdays) }
}

// Local time, so TZ decides what "16:30" means and DST shifts are absorbed by setDate.
function atTime (day, { hours, minutes }) {
  const date = new Date(day)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function step (date, schedule, direction) {
  do {
    date.setDate(date.getDate() + direction)
  } while (!schedule.weekdays.has(date.getDay()))
  return date
}

export function nextRun (schedule, now) {
  const today = atTime(now, schedule)
  if (today > now && schedule.weekdays.has(today.getDay())) return today
  return step(today, schedule, 1)
}

export function previousRun (schedule, now) {
  const today = atTime(now, schedule)
  if (today <= now && schedule.weekdays.has(today.getDay())) return today
  return step(today, schedule, -1)
}

// A missed run is only caught up on a scheduled day, so downtime never produces a run on a day off.
export function isRunOwed (schedule, lastRunAt, now) {
  if (!schedule.weekdays.has(now.getDay())) return false
  return !lastRunAt || new Date(lastRunAt) < previousRun(schedule, now)
}
