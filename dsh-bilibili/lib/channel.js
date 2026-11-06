/**
 * 文稿通道探针：判断这条视频的「文字通道」值不值得读。
 *
 * 动机：ASR 失败 / 纯 BGM / 纯画面类视频，导出的「字幕」是噪声——
 * 既花 token，又会误导模型把胡话当内容。判定在本地完成，零模型调用。
 *
 * 四个结论：
 *   text   正常口播稿，直接读
 *   sparse 话很少（<1.2 字/秒），文字只覆盖很小一部分，建议看画面
 *   lyric  歌词/BGM（♪ 标记或高度重复），文字价值低
 *   noise  疑似 ASR 失败（2-gram 唯一率异常高），文字是噪声
 *
 * @module dsh-bilibili/channel
 */

const LYRIC_MARK = /[♪♫🎵🎶]/;
const STOP_CHARS = new Set("的了是在和有也就都而及与着或".split(""));
const PUNCT_RE = /[，。！？、；：,.!?;:"'（）()《》…—]/g;

/**
 * 文稿「可用性」旁证：判断这条字幕是不是 AI 直转的半成品。
 *
 * 通道探针只看 2-gram 唯一率，抓不到「系统性同音错字」——AI 字幕把「民主党」
 * 听成「明朗」这类错误，唯一率完全正常。这里换一组信号：
 *   1) 通篇没有标点（人工字幕几乎一定带标点）；
 *   2) 混入纯外文乱码行（ASR 开头常见的串词）；
 *   3) 断句过碎（半数以上句子 ≤8 字）。
 * 命中任一条就给 warn，提示模型「专有名词别照抄」。
 */
function probeQuality(text, lines) {
  const punct = (text.match(PUNCT_RE) || []).length;
  const punctRatio = text.length > 0 ? punct / text.length : 0;
  const latinLines = lines.filter((l) => /^[\x20-\x7E]{6,}$/.test(l)).length;
  const shortLines = lines.filter((l) => l.length <= 8).length;
  const fragRatio = lines.length > 0 ? shortLines / lines.length : 0;
  const suspects = [];
  if (text.length >= 600 && punctRatio < 0.003) suspects.push("通篇无标点（AI 字幕直转特征）");
  if (text.length >= 300 && latinLines >= 1) suspects.push("混入 " + latinLines + " 行纯外文乱码");
  if (fragRatio >= 0.6 && lines.length >= 20) suspects.push("断句过碎（" + Math.round(fragRatio * 100) + "% 的句子 ≤8 字）");
  return {
    punctRatio: Number(punctRatio.toFixed(4)),
    latinLines,
    fragRatio: Number(fragRatio.toFixed(2)),
    suspects,
    warn: suspects.length > 0,
  };
}

function grams(text) {
  const clean = String(text ?? "").replace(/[^\u4e00-\u9fa5A-Za-z]/g, "");
  const m = new Map();
  let total = 0;
  for (let i = 0; i + 2 <= clean.length; i++) {
    const g = clean.slice(i, i + 2);
    if (STOP_CHARS.has(g[0]) && STOP_CHARS.has(g[1])) continue;
    m.set(g, (m.get(g) || 0) + 1);
    total++;
  }
  let uniq = 0, once = 0;
  for (const v of m.values()) { uniq++; if (v === 1) once++; }
  return { total, uniq, once };
}

/**
 * @param {{segments?:Array, text?:string, durationSec?:number}} input
 * @returns {{channel:'text'|'sparse'|'lyric'|'noise', note:string, metrics:object}}
 */
export function probeTranscript(input = {}) {
  const text = String(input.text ?? "");
  const segments = Array.isArray(input.segments) ? input.segments : [];
  const duration = Number(input.durationSec) || 0;
  const chars = text.replace(/\s/g, "").length;
  const cps = duration > 0 ? chars / duration : 0;

  const lines = segments.length > 0
    ? segments.map((s) => String(s.text ?? "").trim()).filter(Boolean)
    : text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lyricLines = lines.filter((l) => LYRIC_MARK.test(l)).length;
  const lyricShare = lines.length > 0 ? lyricLines / lines.length : 0;
  const markCount = (text.match(new RegExp(LYRIC_MARK.source, "g")) || []).length;

  const g = grams(text);
  const uniqRatio = g.total > 0 ? g.uniq / g.total : 0;
  const onceRatio = g.uniq > 0 ? g.once / g.uniq : 0;

  const metrics = {
    chars, cps: Number(cps.toFixed(2)), lines: lines.length,
    lyricShare: Number(lyricShare.toFixed(2)), markCount,
    uniqRatio: Number(uniqRatio.toFixed(3)), onceRatio: Number(onceRatio.toFixed(3)),
  };
  const quality = probeQuality(text, lines);

  // 歌词特征先判：♪ 标记本身就是强信号，不依赖文本长度
  if (markCount >= 3 || lyricShare >= 0.2) {
    return {
      channel: "lyric",
      note: "歌词/BGM 为主（♪×" + markCount + "，占比 " + Math.round(lyricShare * 100) + "%）；文字通道价值低，画面才是主要内容",
      metrics, quality,
    };
  }

  // 太短或没有时长信息：不判，直接当正常
  if (chars < 80 || duration <= 0) {
    return { channel: "text", note: "", metrics, quality };
  }

  if (uniqRatio >= 0.85 && onceRatio >= 0.9 && chars >= 200) {
    return {
      channel: "noise",
      note: "疑似转写失败（2-gram 唯一率 " + uniqRatio.toFixed(2) + "）；文本是噪声，不要基于它总结，建议直接抓 2–3 帧看画面",
      metrics, quality,
    };
  }
  if (cps > 0 && cps < 1.2) {
    return {
      channel: "sparse",
      note: "话很少（" + cps.toFixed(1) + " 字/秒）；文字只覆盖片段，主信息可能在画面里",
      metrics, quality,
    };
  }
  return { channel: "text", note: "", metrics, quality };
}
