import { setTimeout } from 'node:timers/promises'
import { readJson } from './json-file.js'
import { isRunOwed, nextRun, parseSchedule } from './schedule.js'
import { lastRunPath, loadTasks, reportFailure, runTask } from './tasks.js'

const ATTEMPTS = 3
const RETRY_DELAY_MS = 10 * 60 * 1000

async function attempt (id, config) {
  for (let n = 1; n <= ATTEMPTS; n++) {
    try {
      console.log(`${id}: ${await runTask(id, config)}`)
      return
    } catch (error) {
      console.error(`${id}: attempt ${n}/${ATTEMPTS} failed: ${error.message}`)
      if (n === ATTEMPTS) {
        await reportFailure(id, error)
        return
      }
      await setTimeout(RETRY_DELAY_MS)
    }
  }
}

async function runOnSchedule (id, config) {
  const schedule = parseSchedule(config)
  const { lastRunAt } = await readJson(lastRunPath(id), {})
  if (isRunOwed(schedule, lastRunAt, new Date())) {
    console.log(`${id}: run owed since ${lastRunAt ?? 'never'}, running now`)
    await attempt(id, config)
  }
  while (true) {
    const next = nextRun(schedule, new Date())
    console.log(`${id}: next run at ${next.toString()}`)
    await setTimeout(next.getTime() - Date.now())
    await attempt(id, config)
  }
}

const tasks = await loadTasks()
await Promise.all(Object.entries(tasks).map(([id, config]) => runOnSchedule(id, config)))
