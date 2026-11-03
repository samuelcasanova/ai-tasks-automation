import { spawn } from 'node:child_process'

const TIMEOUT_MS = 10 * 60 * 1000

// No tools at all: the prompt carries text anyone on the internet can write, so the model may only answer.
export function askClaude ({ prompt, schema, model }) {
  const args = [
    '-p',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(schema),
    '--tools', '',
    '--no-session-persistence',
    '--model', model
  ]
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], timeout: TIMEOUT_MS })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => {
      let envelope
      try {
        envelope = JSON.parse(stdout)
      } catch {
        reject(new Error(`claude exited ${code}: ${(stderr || stdout).trim().split('\n').pop()}`))
        return
      }
      if (envelope.is_error || !envelope.structured_output) {
        reject(new Error(`claude ${envelope.subtype}: ${envelope.result ?? 'no structured output'}`))
        return
      }
      resolve(envelope.structured_output)
    })
    child.stdin.end(prompt)
  })
}
