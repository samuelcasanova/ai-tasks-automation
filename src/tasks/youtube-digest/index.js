import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { askClaude } from '../../claude.js'
import { readJson, writeJson } from '../../json-file.js'
import { sendTelegram } from '../../notify.js'
import { PICKS_SCHEMA, buildPrompt, formatDigest, pruneHistory, selectCandidates } from './digest.js'
import { recentUploads } from './youtube.js'

export async function run ({ config, configDir, dataDir, now }) {
  const { windowHours, historyDays, model = 'sonnet' } = config
  const historyPath = join(dataDir, 'history.json')
  const history = pruneHistory(await readJson(historyPath, []), historyDays, now)
  const criteria = await readFile(join(configDir, 'criteria.md'), 'utf8')

  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000)
  const { channels, videos } = await recentUploads({
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN
  }, since)
  const candidates = selectCandidates(videos, history)

  let picks = []
  if (candidates.length) {
    const answer = await askClaude({ prompt: buildPrompt({ criteria, candidates, history }), schema: PICKS_SCHEMA, model })
    const byId = new Map(candidates.map(video => [video.id, video]))
    picks = answer.picks
      .filter(pick => byId.has(pick.id))
      .map(pick => ({ ...byId.get(pick.id), reason: pick.reason }))
  }

  await sendTelegram(formatDigest({ picks, candidates, windowHours }))
  const pickedAt = now.toISOString()
  await writeJson(historyPath, [
    ...history,
    ...picks.map(({ id, channelId, channel, title, reason }) => ({ pickedAt, id, channelId, channel, title, reason }))
  ])
  return `${picks.length} picks from ${candidates.length} candidates across ${channels} channels`
}
