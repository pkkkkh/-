export interface PromptInput {
  readonly language: 'zh' | 'en'
  readonly cwd: string
  readonly sessionId: string
  readonly createdAt: string
  readonly model: string
  readonly messageCount: number
  readonly focus: string
  readonly extraInstructions: string
  readonly transcript: string
  readonly truncated: boolean
  /** Pre-rendered tool activity digest; empty when the session had no tool calls. */
  readonly activity?: string
  /** The document this one supersedes, when the directory already has one. */
  readonly previous?: { readonly name: string; readonly content: string }
}

export interface Prompt {
  readonly system: string
  readonly user: string
}

/**
 * The document contract.
 *
 * Order is deliberate: the summary comes first so a reader that only sees the
 * head of the file (injection is capped, and people skim) still gets the state
 * and the next action. Decisions sit above execution detail because the next
 * session's most expensive mistake is re-litigating a settled choice.
 */
const SECTIONS_ZH = [
  '## 接手摘要',
  '## 任务与目标',
  '## 已确认的决定',
  '## 当前状态',
  '## 下一步',
  '## 未完成与风险',
  '## 踩过的坑',
  '## 关键文件、命令与环境',
  '## 给下一个会话的开场白',
] as const

const SECTIONS_EN = [
  '## Handoff summary',
  '## Task and goals',
  '## Decisions already made',
  '## Where things stand',
  '## Next steps',
  '## Open items and risks',
  '## Traps hit and how to avoid them',
  '## Key files, commands, and environment',
  '## Opening message for the next session',
] as const

const SYSTEM_ZH = `你是 DeepSeek Harness 的交接文档撰写器。用户会给你一段编程会话记录（用户原话、助手的回答、工具调用与结果），有时还会附上一份旧的交接文档。

你的读者是「下一个接手这个任务的 AI 会话」：它没有这段对话的任何记录，只拿到你写的文档，就要能接着干。判断写得好不好的唯一标准是——它读完不需要再问「之前到底发生了什么、为什么这样做、我该从哪开始」。

写作规则：
1. 只写记录能证实的事实。不确定的写「待确认」；有依据的推断标「推测：」并给出依据，不要当成事实。
2. 用户原话里的硬性要求、禁止项、验收标准、偏好要保留原意并尽量引用关键词；后来的消息改变了要求时，写明「最新要求推翻了……」。这一条最容易被漏掉，也最影响接手。
3. 逐字保留路径、命令、版本号、接口/函数名、报错原文和关键数值。不要改写或概括报错。「工具活动」是自动统计的权威清单，写「关键文件、命令与环境」时以它为准，不要写出它没有的路径。
4. 决定要连理由一起写：选了什么、为什么、否掉了什么。下一个人最需要知道「哪条路已经走不通」。
5. 「当前状态」逐条给证据（文件、命令输出、测试名），不要写「基本完成」「差不多了」。
6. 「下一步」按顺序写，每步可执行、带验证方式；第一步要小到可以立刻动手。
7. 「接手摘要」必须能单独使用：在做什么、现在到哪、下一个动作、绝对不能做什么。控制在 200 字内。
8. 不复述对话过程，不写寒暄、情绪和「我们讨论了……」；同一件事只写一次。
9. 提供旧文档时：保留仍然成立的事实与决定，更新状态，删掉已被推翻的结论，不要整段照抄。
10. 总长度控制在 1800 字以内，信息密度优先。
11. 只输出 markdown 正文：不要一级标题，不要 front matter，不要用代码块包住整篇。
12. 严格按下面小节与顺序输出，一个都不能少；确实没有内容时写「（无）」：
${SECTIONS_ZH.join('\n')}
13. 「给下一个会话的开场白」是一段可直接粘贴的话：先读哪些文件、当前状态、第一件事做什么。`

const SYSTEM_EN = `You write handoff documents for DeepSeek Harness. The user gives you a programming session transcript (the user's own words, assistant replies, tool calls and results), sometimes with a previous handoff document attached.

Your reader is "the next AI session that takes over this work". It has none of this conversation, only your document, and must be able to continue. The only test that matters: after reading it, the reader never has to ask "what happened, why was it done this way, where do I start?".

Rules:
1. State only what the transcript supports. Mark unknowns as "unconfirmed"; label an inference as "inference:" with its evidence instead of presenting it as fact.
2. Preserve the user's hard requirements, prohibitions, acceptance criteria and preferences, quoting their wording where it matters. When a later message changes direction, say so explicitly: "the latest request overrides ...". This is the most commonly missed and most costly detail.
3. Keep paths, commands, versions, API/function names, verbatim error text and key numbers exactly as written. Never paraphrase an error. The "tool activity" digest is the authoritative list of paths and commands; never introduce a path that is not in it.
4. Record decisions with their reasons: what was chosen, why, what was rejected. The next session most needs to know which roads are already closed.
5. "Where things stand" gives evidence per item (files, command output, test names). No "mostly done".
6. "Next steps" is ordered, each step actionable and verifiable; the first step is small enough to start immediately.
7. "Handoff summary" must stand alone: what this is, where it stopped, the next action, and what must not be done. Keep it under 120 words.
8. Do not retell the conversation; no pleasantries, no emotion, no "we discussed"; state each fact once.
9. When a previous document is attached, keep the facts and decisions that still hold, update the state, drop superseded conclusions, and never copy it wholesale.
10. Keep the whole document under 1200 words. Density beats completeness.
11. Output markdown body only: no top-level heading, no front matter, no code fence around the document.
12. Follow these sections in this exact order. Never skip one; write "(none)" when a section genuinely has nothing:
${SECTIONS_EN.join('\n')}
13. "Opening message for the next session" is a ready-to-paste paragraph: which files to read, where things stand, and the first action.`

function line(label: string, value: string | number): string {
  return `- ${label}：${value}`
}

function lineEn(label: string, value: string | number): string {
  return `- ${label}: ${value}`
}

/** Build the summarizer prompt for one session. */
export function buildPrompt(input: PromptInput): Prompt {
  const zh = input.language === 'zh'
  const system = zh ? SYSTEM_ZH : SYSTEM_EN
  const meta: string[] = zh
    ? [
        line('工作目录', input.cwd),
        line('会话 ID', input.sessionId),
        line('生成时间', input.createdAt),
        line('模型', input.model),
        line('消息数', input.messageCount),
        line('记录是否被截断', input.truncated ? '是（中间部分已省略）' : '否'),
        line('是否附带旧文档', input.previous === undefined ? '否' : `是（${input.previous.name}）`),
      ]
    : [
        lineEn('Working directory', input.cwd),
        lineEn('Session', input.sessionId),
        lineEn('Generated at', input.createdAt),
        lineEn('Model', input.model),
        lineEn('Messages', input.messageCount),
        lineEn('Transcript truncated', input.truncated ? 'yes (middle omitted)' : 'no'),
        lineEn('Previous document attached', input.previous === undefined ? 'no' : `yes (${input.previous.name})`),
      ]

  if (input.focus !== '') meta.push(zh ? `- 本次关注点：${input.focus}` : `- Focus for this handoff: ${input.focus}`)
  if (input.extraInstructions !== '') {
    meta.push(zh ? `- 额外要求：${input.extraInstructions}` : `- Extra requirements: ${input.extraInstructions}`)
  }

  const header = zh ? '会话信息' : 'Session facts'
  const recordLabel = zh ? '会话记录' : 'Session transcript'
  const activity = input.activity ?? ''
  const activityBlock =
    activity === ''
      ? ''
      : zh
        ? [
            '',
            '工具活动（自动统计，覆盖全部消息、不受截断影响；「关键文件、命令与环境」以它为准，记录里没出现过的路径不要写）：',
            activity,
          ].join('\n')
        : [
            '',
            'Tool activity (counted over every message, unaffected by truncation; use it as the source of truth for "Key files, commands, and environment", and never invent a path that does not appear):',
            activity,
          ].join('\n')
  const previousBlock =
    input.previous === undefined
      ? ''
      : zh
        ? [
            '',
            `下面是上一份交接文档（${input.previous.name}）。只用于延续：保留仍然成立的事实，更新变化，删掉已经被推翻的结论，不要整段照抄。`,
            '<上一份交接文档>',
            input.previous.content.trimEnd(),
            '</上一份交接文档>',
          ].join('\n')
        : [
            '',
            `Below is the previous handoff (${input.previous.name}). Use it only to continue: keep facts that still hold, update what changed, drop superseded conclusions, and do not copy it wholesale.`,
            '<previous-handoff>',
            input.previous.content.trimEnd(),
            '</previous-handoff>',
          ].join('\n')
  const footer = zh
    ? '请按要求的格式输出交接文档正文。'
    : 'Write the handoff document body in the required format.'

  return {
    system,
    user: `${header}\n${meta.join('\n')}\n${activityBlock}${previousBlock}\n\n<${recordLabel}>\n${input.transcript}\n</${recordLabel}>\n\n${footer}`,
  }
}

/** Section headings the model is asked to emit, exported for tests and doc tooling. */
export function expectedSections(language: 'zh' | 'en'): readonly string[] {
  return language === 'zh' ? SECTIONS_ZH : SECTIONS_EN
}

function sectionPattern(title: string): RegExp {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  return new RegExp(`^#{2,3}[ \\t]*${escaped}[ \\t]*$`, 'mu')
}

/**
 * Section headings the model failed to emit.
 *
 * A handoff without its summary is much worse than a slow one: the next
 * session reads the top first, and a missing "接手摘要" leaves it without the
 * one paragraph that says where to start. The generator retries once when this
 * is non-empty.
 */
export function missingSections(body: string, language: 'zh' | 'en'): string[] {
  return expectedSections(language)
    .map((section) => section.replace(/^##[ \t]*/u, ''))
    .filter((title) => !sectionPattern(title).test(body))
}

/** Ask for the same document again, naming the sections the first attempt skipped. */
export function buildRepairPrompt(user: string, missing: readonly string[], language: 'zh' | 'en'): string {
  const list = missing.map((title) => `## ${title}`).join('\n')
  const note =
    language === 'zh'
      ? `你上一版漏掉了下面这些小節：\n${list}\n\n请重新输出完整文档，包含全部小节且顺序不变；不要只输出补充部分，也不要解释。`
      : `Your previous answer skipped these sections:\n${list}\n\nWrite the complete document again, with every section in order. Do not output only the missing parts and do not explain.`
  return `${user}\n\n${note}`
}
