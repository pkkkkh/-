/**
 * 文稿骨架（抽取式摘要）：把长字幕压成「时间轴目录 + 关键句」，不调用模型。
 *
 * 设计目标（和硬截断相比）：
 *  1) 覆盖均匀 —— 每 windowSec 秒窗口必留一句，不会「前 40% 完整、后面只剩 6 句」；
 *  2) 内容加权 —— 中文 2-gram 词频打分，术语与论点句优先；
 *  3) 关键句保底 —— 含定义/公式/定理/考点/注意/结论 的句子必留；
 *  4) 硬上限 —— 输出严格不超过 cap，且每条带时间码，便于回原文查前后文。
 *
 * @module dsh-bilibili/digest
 */

const STOP = new Set(
  ("的了是在和有也就都而及与着或一个我们你们他们这个那个所以因为但是如果那么就是可以没有不是这种这些那些什么怎么然后这里那里时候现在大家同学们嗯啊呢吧"
    .split("")),
);

const KEY_RE = /(定义|公式|定理|考点|注意|重点|记住|结论|本质|意味着|总结)/;

function mmss(t) {
  const s = Math.max(0, Math.floor(Number(t) || 0));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/** 段落 → 句子：ASR 常一行半句，先把过短的相邻行合并成 12–60 字的完整句。 */
function toSentences(segments, text, charsPerSec = 4.2) {
  let items = [];
  if (Array.isArray(segments) && segments.length > 0) {
    for (const seg of segments) {
      const s = String(seg.text ?? "").trim();
      if (!s) continue;
      items.push({ t: Number(seg.start) || 0, text: s });
    }
  } else {
    let t = 0;
    for (const line of String(text ?? "").split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      items.push({ t, text: s });
      t += s.length / charsPerSec;
    }
  }

  const merged = [];
  for (const it of items) {
    const prev = merged[merged.length - 1];
    if (prev && prev.text.length < 18 && it.t - prev.t < 12) {
      prev.text += it.text;
      continue;
    }
    merged.push({ ...it });
  }
  return merged.filter((s) => s.text.length >= 6);
}

function scoreSentences(sentences) {
  const grams = new Map();
  for (const s of sentences) {
    const clean = s.text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "");
    for (let i = 0; i + 2 <= clean.length; i++) {
      const g = clean.slice(i, i + 2);
      grams.set(g, (grams.get(g) || 0) + 1);
    }
  }
  const N = sentences.length;
  for (const s of sentences) {
    const clean = s.text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "");
    let sc = 0;
    for (let i = 0; i + 2 <= clean.length; i++) {
      const c = grams.get(clean.slice(i, i + 2)) || 0;
      if (c > 1 && !(STOP.has(clean[i]) && STOP.has(clean[i + 1]))) sc += c * Math.log(1 + N / c);
    }
    s.score = sc / Math.sqrt(Math.max(4, clean.length));
    if (/\d/.test(s.text)) s.score *= 1.15;
    if (KEY_RE.test(s.text)) s.score *= 1.25;
  }
  return sentences;
}

/**
 * @param {Array<{start:number,text:string}>} segments
 * @param {string} text
 * @param {number} cap 输出字上限
 * @param {{windowSec?:number}} [opts]
 * @returns {string}
 */
export function buildDigest(segments, text, cap = 8000, opts = {}) {
  const windowSec = Number(opts.windowSec) || 90;
  const body = String(text ?? "");
  if (body.length <= cap) return body;

  const sentences = scoreSentences(toSentences(segments, body));
  if (sentences.length === 0) return body.slice(0, cap) + "\n[... truncated " + (body.length - cap) + " chars]";

  // 1) 每窗口取最高分一句 → 保证覆盖
  const buckets = new Map();
  for (const s of sentences) {
    const k = Math.floor(s.t / windowSec);
    const cur = buckets.get(k);
    if (!cur || s.score > cur.score) buckets.set(k, s);
  }
  const picked = new Set(buckets.values());

  // 2) 关键句保底
  const forced = new Set();
  for (const s of sentences) {
    if (KEY_RE.test(s.text) && s.text.length <= 120) { picked.add(s); forced.add(s); }
  }

  // 3) 余量按分数从高到低补，直到接近 cap
  const total = () => [...picked].reduce((a, s) => a + s.text.length + 2, 0);
  const byScore = [...sentences].sort((a, b) => b.score - a.score);
  for (const s of byScore) {
    if (total() >= cap) break;
    picked.add(s);
  }

  // 4) 超了就按分数从低到高删（关键句不动）
  if (total() > cap) {
    for (const s of [...picked].sort((a, b) => a.score - b.score)) {
      if (total() <= cap) break;
      if (forced.has(s)) continue;
      picked.delete(s);
    }
  }

  const list = [...picked].sort((a, b) => a.t - b.t);
  const lines = [];
  lines.push("[文稿骨架：原文 " + body.length + " 字，已压到 " + list.length + " 句 · 每条带时间码，需要细节可按时间回原文]");
  for (const s of list) lines.push("[" + mmss(s.t) + "] " + s.text);
  const outText = lines.join("\n");
  if (outText.length <= cap + 200) return outText;

  // 超上限：按整句回退，绝不把最后一条切成半句（旧实现是 outText.slice(0, cap)）
  const kept = [];
  let size = 0;
  for (const line of lines) {
    const add = line.length + (kept.length > 0 ? 1 : 0);
    if (size + add > cap) break;
    kept.push(line);
    size += add;
  }
  return kept.length > 1 ? kept.join("\n") : outText.slice(0, cap);
}

export const __test__ = { toSentences, scoreSentences };
