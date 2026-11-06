/**
 * The bundle's card on the Host's Plugins page.
 *
 * It answers two questions a reader arrives with: what this plugin does, and
 * which configuration this process actually loaded. Values are grouped by the
 * decision they belong to instead of being dumped as one flat table.
 */
import { createElement as h, useEffect, useState } from 'react'
import { API, apiGet, describeError } from './api.ts'
import { CSS } from './styles.ts'
import { IconCheck, IconInfo } from './ui.ts'

interface SettingRow {
  readonly key: string
  readonly label: string
  readonly hint: string
}

interface SettingGroup {
  readonly title: string
  readonly rows: readonly SettingRow[]
}

const GROUPS: readonly SettingGroup[] = [
  {
    title: '输出',
    rows: [
      { key: 'outputDir', label: '输出目录', hint: '相对会话工作目录；也可以写绝对路径' },
      { key: 'filenamePrefix', label: '文件名前缀', hint: '配合时间戳与标题生成文件名' },
      { key: 'writeLatest', label: '维护 latest.md', hint: '写一个指向最新文档的指针，供 /handoff resume' },
    ],
  },
  {
    title: '模型',
    rows: [
      { key: 'provider', label: '服务商', hint: '留空则沿用会话里最后一条回复实际使用的模型' },
      { key: 'model', label: '模型', hint: '与上面一项同时留空，或同时填写' },
      { key: 'maxOutputTokens', label: '输出上限', hint: '生成文档时的最大 token 数' },
    ],
  },
  {
    title: '记录',
    rows: [
      { key: 'maxInputChars', label: '输入预算', hint: '会话记录超过预算时保留头尾、省略中段' },
      { key: 'includeToolResults', label: '工具结果', hint: '把工具输出写进交给模型的记录' },
      { key: 'includeInjectedContext', label: '注入上下文', hint: '把技能、工作区说明等注入内容写进记录' },
      { key: 'includeReasoning', label: '思考过程', hint: '把模型的推理内容写进记录' },
    ],
  },
  {
    title: '写作',
    rows: [
      { key: 'language', label: '文档语言', hint: 'auto 跟随对话语言，也可以固定 zh / en' },
      { key: 'extraInstructions', label: '追加要求', hint: '追加给撰写模型的额外指示' },
    ],
  },
]

function valueNode(value: unknown): ReturnType<typeof h> {
  if (typeof value === 'boolean') {
    return h('span', { className: value ? 'dh-flag dh-flag-on' : 'dh-flag' }, value ? '开' : '关')
  }
  if (value === '' || value === undefined || value === null) {
    return h('span', { className: 'dh-row-value', 'data-empty': 'true' }, '未设置')
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return h('span', { className: 'dh-row-value', title: text }, text)
}

/** Card rendered inside the plugin page (`view: 'page'`) and the list (`summary`). */
export function SettingsCard(props?: unknown) {
  const view = (props as { view?: string } | undefined)?.view
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void apiGet<{ config: Record<string, unknown> }>(`${API}/config`)
      .then((value) => {
        if (alive) setConfig(value.config)
      })
      .catch((cause: unknown) => {
        if (alive) setError(describeError(cause).text)
      })
    return () => {
      alive = false
    }
  }, [])

  if (view === 'summary') {
    return h('div', null, '把当前会话整理成交接文档，写给下一个会话；生成 / 历史 / 预览都在侧边栏的「交接文档」页。')
  }

  return h(
    'div',
    { className: 'dh-root dh-card' },
    h('style', { key: 'dh-style' }, CSS),
    h(
      'p',
      { className: 'dh-card-intro' },
      '下面这些值来自 profile 的插件配置（',
      h('code', { className: 'dh-inline-code' }, 'cordis.patch.yml'),
      ' 里的 dsh-handoff 条目），是这次运行实际加载的结果。改动配置后重新加载插件或重启 Harness 才会生效。',
    ),
    error === '' ? null : h('div', { className: 'dh-banner dh-banner-error' }, error),
    config === null && error === ''
      ? h('div', { className: 'dh-card-loading', 'aria-busy': true }, '正在读取配置…')
      : null,
    ...GROUPS.map((group) =>
      h(
        'section',
        { className: 'dh-card-group', key: group.title },
        h('div', { className: 'dh-card-group-title' }, group.title),
        ...group.rows.map((row) =>
          h(
            'div',
            { className: 'dh-row', key: row.key },
            h(
              'div',
              { className: 'dh-row-label' },
              h('span', { className: 'dh-row-name' }, row.label),
              h('span', { className: 'dh-row-key' }, row.key),
              h('span', { className: 'dh-row-hint' }, row.hint),
            ),
            valueNode(config?.[row.key]),
          ),
        ),
      ),
    ),
    h(
      'p',
      { className: 'dh-card-note' },
      h(IconInfo, { size: 12 }),
      '侧边栏页里的「生成交接文档」使用同一份配置；关注点只影响这一次生成，不会写回配置。',
    ),
    h(
      'p',
      { className: 'dh-card-note' },
      h(IconCheck, { size: 12 }),
      '文档保存在会话工作目录的 .dsh/handoff/ 下，同时维护 latest.md 指针，新会话用 /handoff resume 接续。',
    ),
  )
}
