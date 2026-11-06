/**
 * 商单（口播广告）识别：把混在正文里的带货段落标出来，避免摘要时当成 UP 的观点。
 *
 * 纯规则、零模型：在文稿上滑窗统计「营销词」密度。
 *  - 营销词（下单、优惠、旗舰店、评论区链接…）权重 3
 *  - 品类词（套装、洁面、精华…）权重 1
 * 窗口累计 >= minScore 判定为疑似商单，再把相邻窗口合并成区间。
 *
 * 只做「标记 + 折叠」，从不删除信息：关掉 DSH_BILIBILI_ADS=0 即可看回原文。
 *
 * @module dsh-bilibili/ads
 */

/** 营销词：本身就是强信号 */
const MARKET_WORDS = [
  "下单", "优惠", "折扣", "优惠券", "领券", "旗舰店", "天猫", "京东", "到手价",
  "回购率", "品牌方", "赞助", "广告", "购买", "限时", "评论区链接", "链接",
  "点击", "小黄车", "橱窗", "专属价", "粉丝价", "囤货",
];

/** 品类词：单独出现不算，需要和营销词一起 */
const CATEGORY_WORDS = [
  "套装", "洁面", "爽肤", "精华", "面霜", "护肤", "控油", "保湿", "屏障", "肤感",
];

const W_MARKET = 3;
const W_CATEGORY = 1;

/** 一段文本的商单得分（同词最多计 2 次，防刷分） */
export function scoreAdText(text) {
  const s = String(text ?? "");
  if (!s) return 0;
  let score = 0;
  for (const w of MARKET_WORDS) {
    let n = 0;
    let i = 0;
    while ((i = s.indexOf(w, i)) !== -1 && n < 2) {
      n++;
      i += w.length;
    }
    score += n * W_MARKET;
  }
  let cat = 0;
  for (const w of CATEGORY_WORDS) {
    if (s.includes(w)) cat++;
  }
  score += Math.min(cat, 4) * W_CATEGORY;
  return score;
}

/**
 * 连续段识别：把「含营销词/品类词」的相邻句子聚成一段（允许中间夹几句零分的过渡句），
 * 段内累计分 ≥ minScore、且至少有一句营销词（≥3 分）、持续 ≥ minLen 秒，才算商单。
 *
 * 早期用「60 秒滑窗 + 只保留高分句」的写法，在真实 ASR 上会失败：
 * 口播广告大部分句子只命中品类词（套装/洁面），被收缩成 8 秒后整段丢弃。
 *
 * @param {Array<{start:number,end:number,text:string}>} segments
 * @param {{minScore?:number, minLen?:number, gapSegments?:number}} [opts]
 * @returns {Array<{start:number,end:number,score:number}>} 按时间排序、互不重叠的区间
 */
export function detectAdSegments(segments, opts = {}) {
  const minScore = Number(opts.minScore) || 8;
  const minLen = Number(opts.minLen) || 15;
  const gapSec = Number(opts.gapSec) || 30;

  const list = (Array.isArray(segments) ? segments : [])
    .map((s) => ({ t: Number(s?.start) || 0, e: Number(s?.end) || 0, text: String(s?.text ?? "").trim() }))
    .filter((s) => s.text.length > 0);
  if (list.length === 0) return [];

  const hits = list.map((s) => scoreAdText(s.text));
  const out = [];
  let runStart = -1;
  let lastHit = -1;
  let total = 0;
  let hasMarket = false;

  const flush = () => {
    if (runStart < 0) return;
    const start = list[runStart].t;
    const end = list[lastHit].e || list[lastHit].t;
    if (total >= minScore && hasMarket && end - start >= minLen) {
      out.push({ start, end, score: total });
    }
    runStart = -1;
    lastHit = -1;
    total = 0;
    hasMarket = false;
  };

  for (let i = 0; i < list.length; i++) {
    if (hits[i] <= 0) continue;
    if (runStart >= 0 && list[i].t - list[lastHit].t > gapSec) flush();
    if (runStart < 0) runStart = i;
    total += hits[i];
    if (hits[i] >= 3) hasMarket = true;
    lastHit = i;
  }
  flush();
  return out;
}

/** 时刻是否落在任一区间内 */
export function inAdRanges(time, ranges) {
  const t = Number(time) || 0;
  return (ranges ?? []).some((r) => t >= r.start && t <= r.end);
}
