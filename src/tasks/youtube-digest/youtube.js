const API = 'https://www.googleapis.com/youtube/v3'
const PAGE = 50

export async function getAccessToken ({ clientId, clientSecret, refreshToken }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }),
    signal: AbortSignal.timeout(30_000)
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Google token: status ${response.status} ${body.error ?? ''}`.trim())
  }
  return body.access_token
}

class ApiError extends Error {
  constructor (path, status, reason) {
    super(`YouTube ${path}: status ${status} ${reason}`.trim())
    this.status = status
  }
}

async function api (token, path, params) {
  const url = new URL(`${API}/${path}`)
  url.search = new URLSearchParams(params)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000)
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(path, response.status, body.error?.errors?.[0]?.reason ?? '')
  }
  return body
}

function chunks (items, size) {
  const result = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

async function subscribedChannelIds (token) {
  const ids = []
  let pageToken = ''
  do {
    const page = await api(token, 'subscriptions', { part: 'snippet', mine: 'true', maxResults: PAGE, pageToken })
    ids.push(...page.items.map(item => item.snippet.resourceId.channelId))
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return ids
}

async function uploadPlaylistIds (token, channelIds) {
  const ids = []
  for (const batch of chunks(channelIds, PAGE)) {
    const page = await api(token, 'channels', { part: 'contentDetails', id: batch.join(','), maxResults: PAGE })
    ids.push(...page.items.map(item => item.contentDetails.relatedPlaylists.uploads))
  }
  return ids
}

async function videoIdsSince (token, playlistId, since) {
  try {
    const page = await api(token, 'playlistItems', { part: 'contentDetails', playlistId, maxResults: PAGE })
    return page.items
      .filter(item => new Date(item.contentDetails.videoPublishedAt) >= since)
      .map(item => item.contentDetails.videoId)
  } catch (error) {
    // A channel that has never uploaded has an uploads playlist the API reports as not found.
    if (error.status === 404) return []
    throw error
  }
}

export function parseDuration (iso) {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '')
  if (!match) return null
  const [days, hours, minutes, seconds] = match.slice(1).map(part => Number(part ?? 0))
  return ((days * 24 + hours) * 60 + minutes) * 60 + seconds
}

async function videoDetails (token, videoIds) {
  const videos = []
  for (const batch of chunks(videoIds, PAGE)) {
    const page = await api(token, 'videos', { part: 'snippet,contentDetails', id: batch.join(','), maxResults: PAGE })
    for (const item of page.items) {
      videos.push({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        channelId: item.snippet.channelId,
        channel: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        live: item.snippet.liveBroadcastContent,
        seconds: parseDuration(item.contentDetails.duration)
      })
    }
  }
  return videos
}

export async function recentUploads (credentials, since) {
  const token = await getAccessToken(credentials)
  const channelIds = await subscribedChannelIds(token)
  const playlists = await uploadPlaylistIds(token, channelIds)
  const videoIds = []
  for (const playlistId of playlists) {
    videoIds.push(...await videoIdsSince(token, playlistId, since))
  }
  return { channels: channelIds.length, videos: await videoDetails(token, videoIds) }
}
