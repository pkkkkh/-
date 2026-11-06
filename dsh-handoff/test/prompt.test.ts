import { describe, expect, it } from 'vitest'
import { buildPrompt, buildRepairPrompt, expectedSections, missingSections } from '../src/prompt.ts'

const base = {
  language: 'zh' as const,
  cwd: 'C:\\ws',
  sessionId: 'session-1',
  createdAt: '2026-10-25T22:00:00+08:00',
  model: 'deepseek-account/deepseek-flash',
  messageCount: 12,
  focus: '',
  extraInstructions: '',
  transcript: '[用户 #1] 修登录\n[助手 #1] 看下代码',
  truncated: false,
}

describe('buildPrompt', () => {
  it('names every required section in order', () => {
    const prompt = buildPrompt(base)
    const sections = expectedSections('zh')
    let cursor = -1
    for (const section of sections) {
      const index = prompt.system.indexOf(section)
      expect(index).toBeGreaterThan(cursor)
      cursor = index
    }
  })

  it('puts the handoff summary first and the opening line last', () => {
    const sections = expectedSections('zh')
    expect(sections[0]).toBe('## 接手摘要')
    expect(sections[sections.length - 1]).toBe('## 给下一个会话的开场白')
    expect(sections).toContain('## 已确认的决定')
    expect(sections).toContain('## 关键文件、命令与环境')
  })

  it('tells the writer that the reader has no conversation context', () => {
    const prompt = buildPrompt(base)
    expect(prompt.system).toContain('没有这段对话的任何记录')
    expect(prompt.system).toContain('最新要求推翻了')
    expect(prompt.system).toContain('逐字保留')
    expect(prompt.system).toContain('决定要连理由一起写')
  })

  it('uses the English contract for an English session', () => {
    const prompt = buildPrompt({ ...base, language: 'en' })
    expect(prompt.system).toContain('## Opening message for the next session')
    expect(prompt.system).not.toContain('## 给下一个会话的开场白')
    expect(prompt.user).toContain('Previous document attached: no')
  })

  it('carries session facts and the transcript into the user message', () => {
    const prompt = buildPrompt(base)
    expect(prompt.user).toContain('C:\\ws')
    expect(prompt.user).toContain('session-1')
    expect(prompt.user).toContain('deepseek-account/deepseek-flash')
    expect(prompt.user).toContain('[用户 #1] 修登录')
    expect(prompt.user).toContain('记录是否被截断：否')
    expect(prompt.user).toContain('是否附带旧文档：否')
  })

  it('attaches the previous document when one exists', () => {
    const prompt = buildPrompt({
      ...base,
      previous: { name: 'handoff-v1.md', content: '## 接手摘要\n旧状态' },
    })
    expect(prompt.user).toContain('是否附带旧文档：是（handoff-v1.md）')
    expect(prompt.user).toContain('<上一份交接文档>')
    expect(prompt.user).toContain('## 接手摘要\n旧状态')
    expect(prompt.user).toContain('不要整段照抄')
  })

  it('injects the tool activity digest when the session used tools', () => {
    const prompt = buildPrompt({ ...base, activity: '- 修改过：src/a.ts\n- 执行过：pnpm test' })
    expect(prompt.user).toContain('工具活动')
    expect(prompt.user).toContain('修改过：src/a.ts')
    expect(prompt.user).toContain('执行过：pnpm test')
    expect(prompt.system).toContain('权威清单')
  })

  it('omits the activity block when there is nothing to report', () => {
    expect(buildPrompt(base).user).not.toContain('工具活动')
  })

  it('adds the focus and extra instructions only when present', () => {
    const plain = buildPrompt(base)
    expect(plain.user).not.toContain('关注点')
    expect(plain.user).not.toContain('额外要求')

    const focused = buildPrompt({ ...base, focus: '重点写测试', extraInstructions: '少于 800 字' })
    expect(focused.user).toContain('本次关注点：重点写测试')
    expect(focused.user).toContain('额外要求：少于 800 字')
  })

  it('says so when the transcript was truncated', () => {
    expect(buildPrompt({ ...base, truncated: true }).user).toContain('记录是否被截断：是')
  })

  it('wraps the transcript in its own delimiters', () => {
    const prompt = buildPrompt(base)
    expect(prompt.user).toContain('<会话记录>')
    expect(prompt.user).toContain('</会话记录>')
  })
})

describe('missingSections / buildRepairPrompt', () => {
  const complete = expectedSections('zh').map((section) => `${section}\n内容`).join('\n\n')

  it('accepts a document that has every section', () => {
    expect(missingSections(complete, 'zh')).toEqual([])
  })

  it('names what the model skipped', () => {
    const missing = missingSections('## 接手摘要\n现在做到一半\n\n## 当前状态\n还在改', 'zh')
    expect(missing).toContain('任务与目标')
    expect(missing).toContain('给下一个会话的开场白')
    expect(missing).not.toContain('接手摘要')
  })

  it('asks for a complete rewrite, not just the missing parts', () => {
    const repair = buildRepairPrompt('原始提示', ['## 接手摘要'], 'zh')
    expect(repair).toContain('原始提示')
    expect(repair).toContain('## 接手摘要')
    expect(repair).toContain('重新输出完整文档')
  })
})
