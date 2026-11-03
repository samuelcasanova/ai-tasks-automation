# ai-tasks-automation

A container that runs small scheduled tasks whose judgement step is Claude. Each task gathers its
own data, hands it to [Claude Code](https://code.claude.com) in print mode (`claude -p`) with
structured output and no tools, and delivers the answer to Telegram. Images are published to
`ghcr.io/samuelcasanova/ai-tasks-automation` on every `v*` tag.

This repository is public: it holds code only. Schedules, criteria and every secret live with the
deployment.

## Tasks

### youtube-digest

Once a day, the videos from your YouTube subscriptions uploaded in the last `windowHours` that are
most worth watching, chosen against a criteria file you write in plain language and sent to
Telegram with a one-line reason each.

The YouTube Data API has no subscriptions-feed endpoint, so the feed is rebuilt:
`subscriptions.list` → `channels.list` (uploads playlist) → `playlistItems.list` per channel,
filtered on `videoPublishedAt` → `videos.list` for length and description. That is roughly one
quota unit per subscribed channel per run. Premieres, live streams and anything picked in the last
`historyDays` are dropped in code; everything else is for Claude to judge. The picks of the last
`historyDays` are also in the prompt, so it can avoid a story already covered.

## Configuration

The container reads `/config` (read-only) and writes `/data`.

```
/config/tasks.json                     which tasks run, and their settings
/config/youtube-digest/criteria.md     pasted into the prompt as it is, read on every run
/data/<task>/schedule.json             last successful run
/data/youtube-digest/history.json      recent picks
```

```json
{
  "youtube-digest": {
    "dailyAt": "16:30",
    "days": ["mon", "tue", "wed", "thu", "fri"],
    "windowHours": 8,
    "historyDays": 7,
    "model": "sonnet"
  }
}
```

`dailyAt` is local time, set by `TZ`. `days` is optional (`sun` to `sat`) and defaults to every
day. `model` is optional and defaults to `sonnet`. A task whose last successful run is older than
its latest scheduled time runs as soon as the container starts on a scheduled day, so downtime at
run time doesn't skip a day, and never adds a run on a day off. A failed run is retried twice,
10 minutes apart.

Environment:

| Variable | |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | From `claude setup-token`; bills a Claude subscription. Don't also set `ANTHROPIC_API_KEY`, which takes precedence |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | The bot that sends the results, and your chat with it |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` | A Desktop app OAuth client and its `youtube.readonly` refresh token |
| `<TASK>_KUMA_PUSH_URL` | Optional, e.g. `YOUTUBE_DIGEST_KUMA_PUSH_URL`: an Uptime Kuma push URL that gets `up` with a summary or `down` with the error after each run |

Run it read-only as the image's `node` user, with tmpfs on `/tmp` and `/home/node` for Claude
Code's own files.

## Running a task by hand

```bash
docker exec ai-tasks-automation node src/run-once.js youtube-digest --dry-run
```

Runs the task now with the current config. `--dry-run` prints what it would send and touches
nothing: no Telegram message, no history, no last-run time, no Kuma push. Without it, it is a real
run, recorded like a scheduled one. Tuning criteria is then: edit, deploy, dry run, repeat.

## YouTube authorisation

In Google Cloud Console: create a project, enable **YouTube Data API v3**, configure the OAuth
consent screen (External, yourself as user) and set it **In production**. In Testing, Google
expires refresh tokens after 7 days. Create an OAuth client of type **Desktop app**, then on a
machine with a browser:

```bash
YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... npm run youtube-auth
```

It prints a URL to approve and then the refresh token. The app is unverified, so Google shows a
warning screen before the approval.

## Privacy

This is self-hosted software with no service behind it: each deployment runs on its owner's own
machine with its own Google OAuth client, and only its owner authorises it. With the
`youtube.readonly` scope it reads the authorising account's subscriptions and the public details of
their recent uploads. It cannot change anything on the account. That data goes only to the
deployment itself, to the Claude model the owner configures, and as the chosen videos to the
owner's own Telegram chat. The only thing stored is a short list of recent picks on the owner's
machine, pruned after a few days. Nothing is collected by, or shared with, the author of this
software. To revoke access: Google Account → Security → Third-party connections.

## Development

```bash
npm test
docker build -t ai-tasks-automation:local .
```

No runtime dependencies besides Claude Code, which the Dockerfile pins with
`CLAUDE_CODE_VERSION`. To release, bump `version` in `package.json`, then tag `v<version>` and push
the tag.

A new task is a folder under `src/tasks/<id>/` exporting
`run({ config, configDir, dataDir, now, dryRun })`, which returns a one-line summary and, on a dry
run, prints instead of delivering or saving anything, plus an entry in the `TASKS` map in
`src/tasks.js`.
