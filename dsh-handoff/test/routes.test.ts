import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import type { HandoffConfig } from '../src/config.ts'
import { mountRoutes } from '../src/routes.ts'

const dirs: string[] = []

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
})

const config: HandoffConfig = {
  outputDir: '.dsh/handoff',
  filenamePrefix: 'handoff',
  writeLatest: true,
  provider: '',
  model: '',
  maxInputChars: 48_000,
  maxOutputTokens: 4_096,
  includeToolResults: true,
  includeInjectedContext: false,
  includeReasoning: false,
  language: 'auto',
  extraInstructions: '',
}

interface Route {
  path: string
  methods: readonly string[]
  requestBody: string
  fetch: (request: Request) => Promise<Response>
}

/**
 * Build the route table over one fake session, exactly as `apply()` would.
 *
 * `agent: false` models a live session without a live agent instance, while
 * `agentsService: false` models a host that never provided `ctx.agents`; both
 * must surface as a clean `NO_AGENT` instead of an uncaught throw.
 */
async function harness(options: { agent?: boolean; agentsService?: boolean } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'handoff-routes-'))
  dirs.push(dir)
  const messages = [
    { id: 'u1', role: 'user', content: [{ type: 'text', text: '重构登录模块' }], source: { kind: 'user' } },
    { id: 'a1', role: 'assistant', content: [{ type: 'text', text: '好的' }], source: { kind: 'model', provider: 'p', model: 'm' } },
  ]
  const session = { id: 'session-1', header: { cwd: dir }, deriveMessages: () => messages }
  const routes = new Map<string, Route>()
  const connection = {
    // Current Host API: the registry owns the effect on the calling fiber.
    registerFetchRoute: (_owner: unknown, route: Route) => {
      routes.set(route.path, route)
      return () => {}
    },
  }
  const injected: { content: { type: string; text: string }[]; source: { kind: string } }[] = []
  const agent = {
    id: 'session-1',
    inject: (message: { content: { type: string; text: string }[]; source: { kind: string } }) => {
      injected.push(message)
    },
  }
  const agents = {
    get: (id: string) => (options.agent === false ? undefined : id === 'session-1' ? agent : undefined),
    list: () => [agent],
  }
  const scoped = {
    effect: (callback: () => unknown) => callback(),
    get: (name: string) =>
      name === 'connection' ? connection : name === 'agents' && options.agentsService !== false ? agents : undefined,
    sessions: { list: () => [session], get: (id: string) => (id === 'session-1' ? session : undefined) },
    llm: {
      stream: () =>
        (async function* () {
          yield { type: 'text-delta', index: 0, text: '## 任务\n重构登录模块' }
          yield { type: 'finish', reason: { kind: 'stop' } }
        })(),
    },
  }
  const ctx = {
    effect: (callback: () => unknown) => callback(),
    tools: { register: () => () => {} },
    inject: (deps: string[], callback: (value: unknown) => void) => callback(scoped),
    llm: scoped.llm,
  }
  mountRoutes(ctx as unknown as Context, config)

  const call = async (path: string, init?: RequestInit): Promise<{ ok: boolean; value?: any; error?: { code: string; message: string } }> => {
    const url = new URL(`http://127.0.0.1${path}`)
    const route = routes.get(url.pathname)
    if (route === undefined) throw new Error(`missing route ${url.pathname}`)
    const response = await route.fetch(new Request(url, init))
    return response.json() as never
  }
  return { call, dir, routes, injected }
}

describe('plugin HTTP routes', () => {
  it('registers the whole surface', async () => {
    const { routes } = await harness()
    expect([...routes.keys()]).toEqual([
      '/api/dsh-handoff/config',
      '/api/dsh-handoff/sessions',
      '/api/dsh-handoff/docs',
      '/api/dsh-handoff/doc',
      '/api/dsh-handoff/generate',
      '/api/dsh-handoff/attach',
    ])
    for (const route of routes.values()) expect(route.requestBody).toBe('buffered')
  })

  // The Host's exact-route registry rejects any path outside its `/api` channel
  // or any segment that fails `[A-Za-z0-9_$.-]+`. That rejection happens at
  // registration time (the plugin then loads without routes at all and every
  // call 404s), so the rule is asserted here instead of discovered in the app.
  it('keeps every route inside the Host API channel with valid segments', async () => {
    const { routes } = await harness()
    for (const path of routes.keys()) {
      expect(path.startsWith('/api/')).toBe(true)
      const segments = path.slice('/api/'.length).split('/')
      expect(segments.length).toBeGreaterThan(1)
      for (const segment of segments) {
        expect(segment).not.toBe('')
        expect(segment).not.toBe('..')
        expect(segment).toMatch(/^[A-Za-z0-9_$.-]+$/u)
      }
    }
  })

  it('lists sessions with a title and message count', async () => {
    const { call } = await harness()
    const body = await call('/api/dsh-handoff/sessions')
    expect(body.ok).toBe(true)
    expect(body.value.sessions).toEqual([{ id: 'session-1', cwd: expect.any(String), title: '重构登录模块', messages: 2 }])
  })

  it('generates a document, then serves it from the list and the reader', async () => {
    const { call } = await harness()
    const generated = await call('/api/dsh-handoff/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', focus: '登录' }),
    })
    expect(generated.ok).toBe(true)
    expect(generated.value.path).toMatch(/^\.dsh\/handoff\/handoff-.+\.md$/u)
    expect(generated.value.model).toBe('p/m')

    const docs = await call('/api/dsh-handoff/docs?sessionId=session-1')
    expect(docs.ok).toBe(true)
    expect(docs.value.docs).toHaveLength(1)
    expect(docs.value.docs[0]).toMatchObject({
      title: '重构登录模块',
      version: 1,
      provider: 'p',
      model: 'm',
      focus: '登录',
    })

    const name = docs.value.docs[0].name as string
    const doc = await call(`/api/dsh-handoff/doc?sessionId=session-1&name=${encodeURIComponent(name)}`)
    expect(doc.ok).toBe(true)
    expect(doc.value.content).toContain('# 交接文档')
    expect(doc.value.content).toContain('## 任务')
  })

  it('answers a missing session with a stable code', async () => {
    const { call } = await harness()
    const body = await call('/api/dsh-handoff/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'missing' }),
    })
    expect(body.ok).toBe(false)
    expect(body.error?.code).toBe('NO_SESSION')
  })

  it('rejects a non-object body', async () => {
    const { call } = await harness()
    const body = await call('/api/dsh-handoff/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([1, 2, 3]),
    })
    expect(body.ok).toBe(false)
    expect(body.error?.code).toBe('BAD_REQUEST')
  })

  it('serves the effective configuration', async () => {
    const { call } = await harness()
    const body = await call('/api/dsh-handoff/config')
    expect(body.ok).toBe(true)
    expect(body.value.config.outputDir).toBe('.dsh/handoff')
    expect(Object.keys(body.value.config)).toHaveLength(12)
  })

  it('refuses to read a file outside the output directory', async () => {
    const { call } = await harness()
    const body = await call('/api/dsh-handoff/doc?sessionId=session-1&name=..%2F..%2Fsecret.md')
    expect(body.ok).toBe(false)
    expect(body.error?.code).toBe('BAD_NAME')
  })

  /** Generate one document and return its bare file name. */
  async function generateName(call: (path: string, init?: RequestInit) => Promise<{ ok: boolean; value?: any; error?: unknown }>): Promise<string> {
    const generated = await call('/api/dsh-handoff/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1' }),
    })
    expect(generated.ok).toBe(true)
    return String(generated.value.path).split('/').pop() ?? ''
  }

  it('injects one document into the selected live session', async () => {
    const { call, injected } = await harness()
    const name = await generateName(call)

    const body = await call('/api/dsh-handoff/attach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', name }),
    })
    expect(body.ok).toBe(true)
    expect(body.value).toEqual({ name, chars: expect.any(Number), truncated: false })
    expect(body.value.chars).toBeGreaterThan(0)

    // One injection, framed as handoff context rather than a user message.
    expect(injected).toHaveLength(1)
    expect(injected[0]?.source).toEqual({ kind: 'dsh-handoff' })
    const text = injected[0]?.content[0]?.text ?? ''
    expect(text).toContain(`以下是上一个会话留下的交接文档：${name}`)
    expect(text).toContain('<handoff>')
    expect(text).toContain('## 任务')
  })

  it('answers /attach with NO_SESSION for an unknown session', async () => {
    const { call } = await harness()
    const body = await call('/api/dsh-handoff/attach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'missing', name: 'handoff-20260101-000000-x.md' }),
    })
    expect(body.ok).toBe(false)
    expect(body.error?.code).toBe('NO_SESSION')
  })

  it('answers /attach with NO_AGENT when the session has no live instance', async () => {
    const { call, injected } = await harness({ agent: false })
    const name = await generateName(call)
    const body = await call('/api/dsh-handoff/attach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', name }),
    })
    expect(body.ok).toBe(false)
    expect(body.error?.code).toBe('NO_AGENT')
    expect(body.error?.message).toContain('没有活动实例')
    expect(injected).toHaveLength(0)
  })

  it('degrades to NO_AGENT on a host without the agents service', async () => {
    const { call } = await harness({ agentsService: false })
    const name = await generateName(call)
    const body = await call('/api/dsh-handoff/attach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', name }),
    })
    expect(body.ok).toBe(false)
    expect(body.error?.code).toBe('NO_AGENT')
  })

  it('rejects a document name that escapes the output directory', async () => {
    const { call } = await harness()
    const body = await call('/api/dsh-handoff/attach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-1', name: '..\\..\\secret.md' }),
    })
    expect(body.ok).toBe(false)
    expect(body.error?.code).toBe('BAD_NAME')
  })
})
