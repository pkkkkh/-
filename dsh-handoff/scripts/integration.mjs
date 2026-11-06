// Integration check: mount the REAL 0.2.1-rc.3 session and command services in a
// real Cordis app, then load this plugin and drive it through them (not stubs).
//
//   node --expose-internals scripts/integration.mjs
//
// `tools` and `llm` are provided as minimal services here: the registry and the
// model provider are the two seams a headless harness would own, and both are
// already covered by the unit tests and the apply smoke test. What this script
// adds is the plugin's own wiring against the real `ctx.effect`, `ctx.inject`
// and `CommandRuntime` — including the durable command lifecycle it appends.
process.noAsar = true
import { readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import * as sessionModule from '@deepseek-ai/dsh-session'
import * as commandModule from '@deepseek-ai/dsh-commands'
import * as handoff from '../lib/index.js'

const pluginOf = (module) => module.default ?? module
const report = (label, value) => console.log(`${label}: ${value}`)

const registered = []
const routes = new Map()
let request
let liveAgent
const SECTIONS = [
  '接手摘要',
  '任务与目标',
  '已确认的决定',
  '当前状态',
  '下一步',
  '未完成与风险',
  '踩过的坑',
  '关键文件、命令与环境',
  '给下一个会话的开场白',
]
const DOCUMENT = SECTIONS.map((title) => `## ${title}\n集成验证`).join('\n\n')
const ctx = new Context()
ctx.provide('tools', { register: (definition) => (registered.push(definition.name), () => {}) })
ctx.provide('agents', {
  get: (id) => (liveAgent?.id === id ? liveAgent : undefined),
  list: () => (liveAgent === undefined ? [] : [liveAgent]),
})
ctx.provide('connection', {
  registerFetchRoute: (_owner, route) => (
    routes.set(route.path, route),
    () => {
      routes.delete(route.path)
    }
  ),
})
ctx.provide('llm', {
  stream: (options) => {
    request ??= options
    return (async function* () {
      yield { type: 'text-delta', index: 0, text: DOCUMENT }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })()
  },
})
ctx.plugin(pluginOf(sessionModule), {})
ctx.plugin(pluginOf(commandModule), {})
await new Promise((resolve) => setTimeout(resolve, 50))

const session = ctx.get('sessions').create('session-integration', { meta: { cwd: process.cwd() } })
const injected = []
const agent = { id: 'session-integration', session, inject: (input) => injected.push(input) }
liveAgent = agent
session.append(
  'user/message',
  { role: 'user', content: [{ type: 'text', text: '重构登录模块' }], source: { kind: 'user' } },
  { surfaceOp: 'append' },
)

const outputDir = join(tmpdir(), 'dsh-handoff-integration')
ctx.plugin(handoff, { provider: 'test', model: 'test-model', outputDir })
await new Promise((resolve) => setTimeout(resolve, 100))

report('tools registered by the plugin', registered.join(',') || '(none)')
report('sessions service', typeof ctx.get('sessions'))
report('commands service', typeof ctx.get('commands'))
report('handoff command discovered', ctx.get('commands').find(agent, 'handoff') !== undefined)

const execution = await ctx.get('commands').execute(agent, '/handoff 集成', [], new AbortController().signal)
console.log('command result:', JSON.stringify(execution?.result))

const events = session.snapshotEvents().map((event) => event.type)
report('log has command/run', events.includes('command/run'))
report('log has command/done', events.includes('command/done'))
report('no turn was opened', !events.includes('turn/start'))

const written = await readdir(outputDir).catch(() => [])
report('documents written', written.join(',') || '(none)')

const promptText = request?.messages?.[0]?.content?.[0]?.text ?? ''
report('prompt carries the 9-section contract', String(request?.system ?? '').includes('## 接手摘要'))
report('prompt numbers turns', promptText.includes('[用户 #1]'))
const documentName = written.find((name) => name.startsWith('handoff-'))
const documentText =
  documentName === undefined ? '' : await readFile(join(outputDir, documentName), 'utf8').catch(() => '')
report('document keeps the summary section', documentText.includes('## 接手摘要'))

// Second half of the product: hand the document to the next session.
const resumed = await ctx.get('commands').execute(agent, '/handoff resume', [], new AbortController().signal)
console.log('resume result:', JSON.stringify(resumed?.result))
report('injected one context', injected.length === 1)
const injectedText = injected[0]?.content?.[0]?.text ?? ''
report('injected the document', injectedText.includes('<handoff>') && injectedText.includes('## 接手摘要'))
report('resume frames it as prior context', injectedText.includes('既有上下文') && injectedText.includes('接手摘要'))
report('injected source is the plugin', injected[0]?.source?.kind === 'dsh-handoff')

// A named document can be injected instead of latest.md.
const named = written.find((name) => name.startsWith('handoff-') && name.endsWith('.md'))
if (named !== undefined) {
  const picked = await ctx.get('commands').execute(agent, `/handoff resume ${named}`, [], new AbortController().signal)
  report('named resume names the file', String(picked?.result?.text ?? '').includes(named))
}

// The panel's "接续到会话" route: real session store, real document read, real
// framing; only the agent registry is the script's stand-in.
if (documentName !== undefined) {
  const attachRoute = routes.get('/api/dsh-handoff/attach')
  report('attach route registered', attachRoute !== undefined)
  if (attachRoute !== undefined) {
    const before = injected.length
    const response = await attachRoute.fetch(
      new Request('http://127.0.0.1/api/dsh-handoff/attach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-integration', name: documentName }),
      }),
    )
    const body = await response.json()
    report('attach succeeded', body.ok === true)
    report('attach returned the file name and size', body.value?.name === documentName && body.value?.chars > 0)
    report('attach injected exactly one framed context', injected.length === before + 1)
    report('attach source is the plugin', injected.at(-1)?.source?.kind === 'dsh-handoff')
    report('attach framed the document', String(injected.at(-1)?.content?.[0]?.text ?? '').includes('<handoff>'))
  }
}

await rm(outputDir, { recursive: true, force: true })
