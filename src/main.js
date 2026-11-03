import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { readJson, writeJson } from './json-file.js'
import { pushToKuma } from './notify.js'
import { isRunOwed, nextRun, parseDailyAt } from './schedule.js'
import * as youtubeDigest from './tasks/youtube-digest/index.js'

const TASKS = { 'youtube-digest': youtubeDigest }
const CONFIG_DIR = process.env.CONFIG_DIR ?? '/config'
const DATA_DIR = process.env.DATA_DIR ?? '/data'
const ATTEMPTS = 3
const RETRY_DELAY_MS = 10 * 60 * 1000

const pushUrlOf = id => process.env[`${id.toUpperCase().replaceAll('-', '_')}_KUMA_PUSH_URL`]

async function attempt (id, task, config) {
  const dataDir = join(DATA_DIR, id)
  for (let n = 1; n <= ATTEMPTS; n++) {
    const now = new Date()
    try {
      const summary = await task.run({ config, configDir: join(CONFIG_DIR, id), dataDir, now })
      await writeJson(join(dataDir, 'schedule.json'), { lastRunAt: now.toISOString() })
      console.log(`${id}: ${summary}`)
      await pushToKuma(pushUrlOf(id), 'up', summary)
      return
    } catch (error) {
      console.error(`${id}: attempt ${n}/${ATTEMPTS} failed: ${error.message}`)
      if (n === ATTEMPTS) {
        await pushToKuma(pushUrlOf(id), 'down', error.message)
        return
      }
      await setTimeout(RETRY_DELAY_MS)
    }
  }
}

async function schedule (id, task, config) {
  const dailyAt = parseDailyAt(config.dailyAt)
  const { lastRunAt } = await readJson(join(DATA_DIR, id, 'schedule.json'), {})
  if (isRunOwed(dailyAt, lastRunAt, new Date())) {
    console.log(`${id}: run owed since ${lastRunAt ?? 'never'}, running now`)
    await attempt(id, task, config)
  }
  while (true) {
    const next = nextRun(dailyAt, new Date())
    console.log(`${id}: next run at ${next.toString()}`)
    await setTimeout(next.getTime() - Date.now())
    await attempt(id, task, config)
  }
}

const tasks = await readJson(join(CONFIG_DIR, 'tasks.json'), null)
if (!tasks) {
  throw new Error(`${join(CONFIG_DIR, 'tasks.json')} not found`)
}
for (const id of Object.keys(tasks)) {
  if (!TASKS[id]) throw new Error(`Unknown task in tasks.json: ${id}`)
}
await Promise.all(Object.entries(tasks).map(([id, config]) => schedule(id, TASKS[id], config)))
