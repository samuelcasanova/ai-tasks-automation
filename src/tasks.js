import { join } from 'node:path'
import { readJson, writeJson } from './json-file.js'
import { pushToKuma } from './notify.js'
import * as youtubeDigest from './tasks/youtube-digest/index.js'

const TASKS = { 'youtube-digest': youtubeDigest }
const CONFIG_DIR = process.env.CONFIG_DIR ?? '/config'
const DATA_DIR = process.env.DATA_DIR ?? '/data'

const pushUrlOf = id => process.env[`${id.toUpperCase().replaceAll('-', '_')}_KUMA_PUSH_URL`]
export const lastRunPath = id => join(DATA_DIR, id, 'schedule.json')

export async function loadTasks () {
  const path = join(CONFIG_DIR, 'tasks.json')
  const tasks = await readJson(path, null)
  if (!tasks) throw new Error(`${path} not found`)
  for (const id of Object.keys(tasks)) {
    if (!TASKS[id]) throw new Error(`Unknown task in tasks.json: ${id}`)
  }
  return tasks
}

// A dry run only prints what it would send: no delivery, no history, no last-run time, no Kuma push.
export async function runTask (id, config, { dryRun = false } = {}) {
  const now = new Date()
  const summary = await TASKS[id].run({ config, configDir: join(CONFIG_DIR, id), dataDir: join(DATA_DIR, id), now, dryRun })
  if (dryRun) return summary
  await writeJson(lastRunPath(id), { lastRunAt: now.toISOString() })
  await pushToKuma(pushUrlOf(id), 'up', summary)
  return summary
}

export const reportFailure = (id, error) => pushToKuma(pushUrlOf(id), 'down', error.message)
