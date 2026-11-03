import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isRunOwed, nextRun, parseSchedule } from '../src/schedule.js'

const daily = parseSchedule({ dailyAt: '16:30' })
const weekdays = parseSchedule({ dailyAt: '16:30', days: ['mon', 'tue', 'wed', 'thu', 'fri'] })

// November 2026: the 3rd is a Tuesday, the 6th a Friday, the 7th–8th a weekend, the 9th a Monday.
const local = (day, hours, minutes = 0) => new Date(2026, 10, day, hours, minutes)

test('parseSchedule rejects bad times and day names', () => {
  assert.deepEqual(parseSchedule({ dailyAt: '07:05' }).hours, 7)
  for (const dailyAt of ['7:05', '24:00', '16:60', '', undefined]) {
    assert.throws(() => parseSchedule({ dailyAt }))
  }
  assert.throws(() => parseSchedule({ dailyAt: '16:30', days: [] }))
  assert.throws(() => parseSchedule({ dailyAt: '16:30', days: ['monday'] }))
})

test('nextRun is later today before the time, tomorrow after it', () => {
  assert.equal(nextRun(daily, local(3, 9)).getTime(), local(3, 16, 30).getTime())
  assert.equal(nextRun(daily, local(3, 16, 30)).getTime(), local(4, 16, 30).getTime())
})

test('nextRun skips days off', () => {
  assert.equal(nextRun(weekdays, local(6, 17)).getTime(), local(9, 16, 30).getTime())
  assert.equal(nextRun(weekdays, local(7, 9)).getTime(), local(9, 16, 30).getTime())
})

test('a run is owed on first start and after missing the scheduled time', () => {
  assert.equal(isRunOwed(daily, undefined, local(3, 9)), true)
  assert.equal(isRunOwed(daily, local(2, 16, 31).toISOString(), local(3, 18)), true)
})

test('no run is owed when the last one already covers the latest scheduled time', () => {
  assert.equal(isRunOwed(daily, local(3, 16, 31).toISOString(), local(3, 18)), false)
  assert.equal(isRunOwed(daily, local(2, 16, 31).toISOString(), local(3, 9)), false)
})

test('a missed run is never caught up on a day off', () => {
  const thursday = local(5, 16, 31).toISOString()
  assert.equal(isRunOwed(weekdays, thursday, local(7, 10)), false)
  assert.equal(isRunOwed(weekdays, undefined, local(8, 10)), false)
  assert.equal(isRunOwed(weekdays, thursday, local(9, 10)), true)
  assert.equal(isRunOwed(weekdays, local(6, 16, 31).toISOString(), local(9, 10)), false)
})
