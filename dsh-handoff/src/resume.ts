import type { Session } from '@deepseek-ai/dsh-session'
import type { HandoffConfig } from './config.ts'
import { HandoffError } from './errors.ts'
import { parseLatestPointer, splitFrontMatter } from './markdown.ts'
import { listDocuments, readDocument, resolveOutputDir } from './store.ts'

/** Injected context is bounded: a handoff is a brief, not a transcript. */
const MAX_INJECTED_CHARS = 30_000

/** One document loaded for injection. */
export interface ResumeResult {
  readonly name: string
  readonly content: string
  /** The document was longer than the injection budget. */
  readonly truncated: boolean
  /** Working directory the document was written for. */
  readonly cwd?: string
  /** Generation time recorded in the front matter. */
  readonly createdAt?: string
}

/**
 * Load the document a new session should continue from.
 *
 * `latest.md` wins because it is the file the generator maintains for exactly
 * this purpose; a directory that only has timestamped files falls back to the
 * newest one. An explicit name is used verbatim (and must be a bare file name).
 */
export async function loadHandoffForResume(
  session: Session,
  config: HandoffConfig,
  requested: string,
): Promise<ResumeResult> {
  const dir = resolveOutputDir(session.header.cwd ?? process.cwd(), config.outputDir)
  const name = await pickDocument(dir, requested)
  const raw = await readDocument(dir, name)
  const truncated = raw.length > MAX_INJECTED_CHARS
  const content = truncated
    ? `${raw.slice(0, MAX_INJECTED_CHARS)}\n\n…（文档超过 ${MAX_INJECTED_CHARS} 字符，以上为前半部分）…`
    : raw
  const { meta } = splitFrontMatter(raw)
  return {
    name,
    content,
    truncated,
    ...(session.header.cwd === undefined ? {} : { cwd: session.header.cwd }),
    ...(meta.created === undefined ? {} : { createdAt: meta.created }),
  }
}

async function pickDocument(dir: string, requested: string): Promise<string> {
  if (requested !== '' && requested !== 'latest.md') return requested
  const latest = await latestTarget(dir)
  if (latest !== undefined) return latest
  const documents = await listDocuments(dir)
  const newest = documents[0]
  if (newest === undefined) {
    throw new HandoffError('NO_DOCUMENT', `还没有交接文档（目录 ${dir}）。先运行 /handoff 生成一份。`)
  }
  return newest.name
}

/**
 * Resolve `latest.md` to the document it names.
 *
 * Current builds write a pointer; older builds wrote a full copy. The copy is
 * still a valid document, so it is returned as-is (`latest.md` itself), and a
 * pointer that names a missing file reports the break instead of injecting the
 * pointer text as if it were a handoff.
 */
async function latestTarget(dir: string): Promise<string | undefined> {
  let content: string
  try {
    content = await readDocument(dir, 'latest.md')
  } catch {
    return undefined
  }
  const target = parseLatestPointer(content)
  if (target === undefined) return 'latest.md'
  try {
    await readDocument(dir, target)
  } catch {
    throw new HandoffError('BROKEN_POINTER', `latest.md 指向的 ${target} 不存在，改用 /handoff resume <文件名>。`)
  }
  return target
}

/** Frame the document as model-facing context rather than a bare dump. */
export function frameForInjection(result: ResumeResult): string {
  const where = [result.createdAt === undefined ? '' : `生成于 ${result.createdAt}`, result.cwd === undefined ? '' : `工作目录 ${result.cwd}`]
    .filter((part) => part !== '')
    .join(' · ')
  const tail = result.truncated ? '\n\n（文档已截断，需要时可以读取原文件补全。）' : ''
  return [
    `以下是上一个会话留下的交接文档：${result.name}${where === '' ? '' : `（${where}）`}。`,
    '把它当作当前任务的既有上下文，而不是一条新的用户请求。动手前先按它对齐状态：',
    '- 从「接手摘要」「当前状态」「下一步」读起，那就是默认的继续点；',
    '- 已经确认的决定不要重新讨论，也不要顺手扩大范围；',
    '- 文档与工作区不一致时，以工作区为准，并把差异说出来；',
    '- 需要用户拍板的问题直接问，不要替用户猜。',
    '',
    '<handoff>',
    result.content.trimEnd(),
    '</handoff>',
    tail,
  ].join('\n')
}
