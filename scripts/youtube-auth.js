// One-off, on a machine with a browser: authorise read-only access to your YouTube account and
// print the refresh token the youtube-digest task needs.
//   YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... npm run youtube-auth
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'

const { YOUTUBE_CLIENT_ID: clientId, YOUTUBE_CLIENT_SECRET: clientSecret } = process.env
if (!clientId || !clientSecret) {
  console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET (a Desktop app OAuth client).')
  process.exit(1)
}

const verifier = randomBytes(32).toString('base64url')
const state = randomBytes(16).toString('hex')

const server = createServer()
server.listen(0, '127.0.0.1', () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}`
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  auth.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256'
  })
  console.log(`Open this URL and approve access:\n\n${auth}\n`)

  server.on('request', async (request, response) => {
    const params = new URL(request.url, redirectUri).searchParams
    if (params.get('state') !== state || !params.get('code')) {
      response.end('Unexpected request, ignored.')
      return
    }
    const token = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: params.get('code'),
        code_verifier: verifier,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    }).then(res => res.json())
    response.end(token.refresh_token ? 'Done, you can close this tab.' : 'Failed, see the terminal.')
    if (token.refresh_token) {
      console.log(`Refresh token (store it as vault_youtube_refresh_token):\n\n${token.refresh_token}`)
    } else {
      console.error(`No refresh token in the response: ${token.error ?? JSON.stringify(token)}`)
      process.exitCode = 1
    }
    server.close()
  })
})
