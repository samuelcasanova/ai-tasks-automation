import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isRunOwed, nextRun, parseDailyAt } from '../src/schedule.js'

const at1630 = parseDailyAt('16:30')

test('parseDailyAt rejects anything but HH:MM', () => {
  assert.deepEqual(parseDailyAt('07:05'), { hours: 7, minutes: 5 })
  for (const bad of ['7:05', '24:00', '16:60', '', undefined]) {
    assert.throws(() => parseDailyAt(bad))
  }
})

test('nextRun is later today before the time, tomorrow after it', () => {
  assert.equal(nextRun(at1630, new Date(2026, 10, 3, 9, 0)).getTime(), new Date(2026, 10, 3, 16, 30).getTime())
  assert.equal(nextRun(at1630, new Date(2026, 10, 3, 16, 30)).getTime(), new Date(2026, 10, 4, 16, 30).getTime())
})

test('a run is owed on first start and after missing the scheduled time', () => {
  assert.equal(isRunOwed(at1630, undefined, new Date(2026, 10, 3, 9, 0)), true)
  const yesterday = new Date(2026, 10, 2, 16, 31).toISOString()
  assert.equal(isRunOwed(at1630, yesterday, new Date(2026, 10, 3, 18, 0)), true)
})

test('no run is owed when the last one already covers the latest scheduled time', () => {
  const today = new Date(2026, 10, 3, 16, 31).toISOString()
  assert.equal(isRunOwed(at1630, today, new Date(2026, 10, 3, 18, 0)), false)
  const yesterday = new Date(2026, 10, 2, 16, 31).toISOString()
  assert.equal(isRunOwed(at1630, yesterday, new Date(2026, 10, 3, 9, 0)), false)
})
