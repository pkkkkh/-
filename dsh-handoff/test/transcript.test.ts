import { describe, expect, it } from 'vitest'
import type { Message } from '@deepseek-ai/dsh-llm'
import { buildTranscript, dominantLanguage, firstUserLine, renderActivity, summarizeActivity } from '../src/transcript.ts'

function user(text: string, kind: 'user' | 'plugin' = 'user'): Message {
  return {
    id: `u-${text.slice(0, 8)}` as never,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind } as never,
  } as unknown as Message
}

function assistant(content: Message['content']): Message {
  return {
    id: 'a-1' as never,
    role: 'assistant',
    content,
    source: { kind: 'model', provider: 'p', model: 'm' },
  } as unknown as Message
}

function toolResult(text: string, callId = 'call-1'): Message {
  return {
    id: 't-1' as never,
    role: 'tool',
    content: [{ type: 'text', text }],
    source: { kind: 'tool', callId },
    toolCallId: callId,
  } as unknown as Message
}

function system(text: string): Message {
  return { id: 's-1' as never, role: 'system', content: [{ type: 'text', text }], source: { kind: 'system-prompt' } } as unknown as Message
}

const options = { maxChars: 48_000, includeToolResults: true, includeInjectedContext: false, includeReasoning: false }

describe('buildTranscript', () => {
  it('renders user and assistant turns with role tags and turn numbers', () => {
    const transcript = buildTranscript([user('修复登录 bug'), assistant([{ type: 'text', text: '我来看看' }])], options)
    expect(transcript.text).toContain('[用户 #1] 修复登录 bug')
    expect(transcript.text).toContain('[助手 #1] 我来看看')
    expect(transcript.stats.truncated).toBe(false)
  })

  it('advances the turn number for each human message', () => {
    const transcript = buildTranscript(
      [user('第一件事'), assistant([{ type: 'text', text: '好' }]), user('改主意了'), assistant([{ type: 'text', text: '收到' }])],
      options,
    )
    expect(transcript.text).toContain('[用户 #1] 第一件事')
    expect(transcript.text).toContain('[用户 #2] 改主意了')
    expect(transcript.text).toContain('[助手 #2] 收到')
  })

  it('skips the system prompt and, by default, injected user-role context', () => {
    const transcript = buildTranscript([system('SECRET PROMPT'), user('<skill>', 'plugin'), user('真正的问题')], options)
    expect(transcript.text).not.toContain('SECRET PROMPT')
    expect(transcript.text).not.toContain('<skill>')
    expect(transcript.text).toContain('[用户 #1] 真正的问题')
  })

  it('keeps injected context visible when asked to', () => {
    const transcript = buildTranscript([user('<skill>', 'plugin')], { ...options, includeInjectedContext: true })
    expect(transcript.text).toContain('[上下文] <skill>')
  })

  it('pairs tool results with their call name', () => {
    const messages = [
      user('列目录'),
      assistant([{ type: 'tool-call', id: 'call-1' as never, name: 'pwsh', arguments: '{"command":"ls"}' }]),
      toolResult('a.txt\nb.txt'),
    ]
    const transcript = buildTranscript(messages, options)
    expect(transcript.text).toContain('[调用 #1] pwsh command=ls')
    expect(transcript.text).toContain('[结果 #1] ← pwsh a.txt')
  })

  it('lifts the path out of a write call instead of dumping its body', () => {
    const messages = [
      user('写文件'),
      assistant([
        {
          type: 'tool-call',
          id: 'call-1' as never,
          name: 'write',
          arguments: JSON.stringify({ path: 'src/login.ts', content: 'x'.repeat(4_000) }),
        },
      ]),
      toolResult('wrote 4000 bytes'),
    ]
    const transcript = buildTranscript(messages, options)
    expect(transcript.text).toContain('[调用 #1] write path=src/login.ts content(4000ch)')
    expect(transcript.text).not.toContain('x'.repeat(100))
  })

  it('marks failing tool results', () => {
    const messages = [
      assistant([{ type: 'tool-call', id: 'call-1' as never, name: 'pwsh', arguments: '{}' }]),
      { ...toolResult('boom'), isError: true } as Message,
    ]
    expect(buildTranscript(messages, options).text).toContain('[结果] ✗ pwsh boom')
  })

  it('omits tool results when disabled', () => {
    const messages = [
      assistant([{ type: 'tool-call', id: 'call-1' as never, name: 'pwsh', arguments: '{}' }]),
      toolResult('noise'),
    ]
    const transcript = buildTranscript(messages, { ...options, includeToolResults: false })
    expect(transcript.text).not.toContain('noise')
  })

  it('keeps the head and the tail while dropping the middle under budget', () => {
    const messages: Message[] = [user('TASK-START')]
    for (let index = 0; index < 200; index++) messages.push(assistant([{ type: 'text', text: `step ${index} `.repeat(60) }]))
    messages.push(user('TASK-END'))
    const transcript = buildTranscript(messages, { ...options, maxChars: 6_000 })
    expect(transcript.stats.truncated).toBe(true)
    expect(transcript.stats.omitted).toBeGreaterThan(0)
    expect(transcript.text).toContain('TASK-START')
    expect(transcript.text).toContain('TASK-END')
    expect(transcript.text).toContain('会话中段省略')
    expect(transcript.text.length).toBeLessThan(7_500)
  })
})

describe('summarizeActivity', () => {
  function call(name: string, args: unknown, id = 'call-1'): Message {
    return assistant([{ type: 'tool-call', id: id as never, name, arguments: typeof args === 'string' ? args : JSON.stringify(args) }])
  }

  it('collects edited files, commands, searches and failures', () => {
    const messages = [
      user('做点事'),
      call('write', { path: 'src/a.ts', content: 'xx' }, 'c1'),
      call('pwsh', { command: 'pnpm test' }, 'c2'),
      call('grep', { pattern: 'TODO', path: 'src' }, 'c3'),
      { ...toolResult('boom', 'c2'), isError: true } as Message,
    ]
    const activity = summarizeActivity(messages)
    expect(activity.edited).toEqual([{ text: 'src/a.ts', count: 1 }])
    expect(activity.commands).toEqual([{ text: 'pnpm test', count: 1 }])
    expect(activity.searches[0]?.text).toBe('grep TODO')
    expect(activity.failures[0]?.text).toContain('pwsh: boom')

    const text = renderActivity(activity, 'zh')
    expect(text).toContain('修改过：src/a.ts')
    expect(text).toContain('执行过：pnpm test')
  })

  it('counts repeats and skips malformed arguments', () => {
    const messages = [
      user('x'),
      call('read', { path: 'a.ts' }, 'c1'),
      call('read', 'not json', 'c2'),
      call('read', { path: 'a.ts' }, 'c3'),
    ]
    expect(summarizeActivity(messages).read).toEqual([{ text: 'a.ts', count: 2 }])
  })

  it('renders an empty digest when the session had no tool calls', () => {
    const activity = summarizeActivity([user('只说了一句话')])
    expect(renderActivity(activity, 'zh')).toBe('')
    expect(renderActivity(activity, 'en')).toBe('')
  })

  it('labels the digest in the document language', () => {
    const activity = summarizeActivity([user('x'), call('write', { path: 'a.ts' }, 'c1')])
    expect(renderActivity(activity, 'en')).toContain('Edited: a.ts')
    expect(renderActivity(activity, 'zh')).toContain('修改过：a.ts')
  })
})

describe('firstUserLine / dominantLanguage', () => {
  it('uses the first user line as a title anchor', () => {
    expect(firstUserLine([system('x'), user('  帮我重构  登录模块 '), user('第二句')])).toBe('帮我重构 登录模块')
  })

  it('ignores injected context when picking a title', () => {
    expect(firstUserLine([user('AVAILABLE SKILLS: office, pptx', 'plugin'), user('真正的问题')])).toBe('真正的问题')
  })

  it('detects Chinese and English sessions', () => {
    expect(dominantLanguage([user('请帮我修复这个问题')])).toBe('zh')
    expect(dominantLanguage([user('please fix the failing test')])).toBe('en')
  })

  it('does not let injected English context flip the language of a Chinese session', () => {
    const english = user('AVAILABLE SKILLS: office, pptx, docx. Use the skill tool before acting. '.repeat(20), 'plugin')
    expect(dominantLanguage([english, user('把这个插件装好并验证')])).toBe('zh')
  })

  it('falls back to every user-role message when the session has no human message', () => {
    expect(dominantLanguage([user('the only message is injected', 'plugin')])).toBe('en')
  })
})
