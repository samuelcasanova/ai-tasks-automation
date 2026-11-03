// Run one task now, outside its schedule:
//   docker exec ai-tasks-automation node src/run-once.js youtube-digest [--dry-run]
import { loadTasks, reportFailure, runTask } from './tasks.js'

const [id, flag] = process.argv.slice(2)
const dryRun = flag === '--dry-run'
if (!id || (flag && !dryRun)) {
  console.error('Usage: node src/run-once.js <task> [--dry-run]')
  process.exit(2)
}

const tasks = await loadTasks()
if (!tasks[id]) {
  console.error(`${id} is not enabled in tasks.json`)
  process.exit(2)
}
try {
  console.log(`${id}: ${await runTask(id, tasks[id], { dryRun })}`)
} catch (error) {
  console.error(`${id}: ${error.message}`)
  if (!dryRun) await reportFailure(id, error)
  process.exitCode = 1
}
