import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPrompt, formatDigest, pruneHistory, selectCandidates } from '../src/tasks/youtube-digest/digest.js'
import { parseDuration } from '../src/tasks/youtube-digest/youtube.js'

const video = (id, overrides = {}) => ({
  id, title: `Title ${id}`, description: '', channelId: 'UC1', channel: 'Channel', live: 'none', seconds: 1500, ...overrides
})

test('parseDuration reads ISO 8601 durations', () => {
  assert.equal(parseDuration('PT25M3S'), 1503)
  assert.equal(parseDuration('PT1H'), 3600)
  assert.equal(parseDuration('P1DT2H'), 93600)
  assert.equal(parseDuration('P0D'), 0)
  assert.equal(parseDuration(undefined), null)
})

test('selectCandidates drops premieres, live streams and past picks', () => {
  const videos = [video('a'), video('b', { live: 'upcoming' }), video('c', { live: 'live' }), video('d')]
  const ids = selectCandidates(videos, [{ id: 'd' }]).map(v => v.id)
  assert.deepEqual(ids, ['a'])
})

test('pruneHistory keeps only the last N days', () => {
  const now = new Date('2026-11-10T16:30:00Z')
  const history = [{ pickedAt: '2026-11-02T16:30:00Z' }, { pickedAt: '2026-11-04T16:30:00Z' }]
  assert.deepEqual(pruneHistory(history, 7, now), [{ pickedAt: '2026-11-04T16:30:00Z' }])
})

test('buildPrompt carries the criteria, recent picks and trimmed descriptions', () => {
  const prompt = buildPrompt({
    criteria: 'Prefer politics.',
    candidates: [video('a', { description: 'x'.repeat(5000) })],
    history: [{ pickedAt: '2026-11-02T16:30:00Z', channel: 'Old', title: 'Old pick' }]
  })
  assert.match(prompt, /Prefer politics\./)
  assert.match(prompt, /2026-11-02 · Old · Old pick/)
  assert.ok(!prompt.includes('x'.repeat(1001)))
})

test('formatDigest escapes HTML from titles and reasons', () => {
  const text = formatDigest({
    picks: [{ ...video('a', { title: 'A <b> & B' }), reason: 'Why <i>' }],
    candidates: [video('a')],
    windowHours: 8
  })
  assert.match(text, /A &lt;b&gt; &amp; B/)
  assert.match(text, /Why &lt;i&gt;/)
  assert.match(text, /https:\/\/youtu\.be\/a/)
})
