export function escapeHtml (text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export async function sendTelegram (html) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: html,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }
    }),
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) {
    const { description } = await response.json().catch(() => ({}))
    throw new Error(`Telegram: status ${response.status} ${description ?? ''}`.trim())
  }
}

export async function pushToKuma (url, status, msg) {
  if (!url) return
  const push = new URL(url)
  push.search = new URLSearchParams({ status, msg, ping: '' })
  try {
    await fetch(push, { signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    console.error(`Kuma push failed: ${error.message}`)
  }
}
