// ============ 热门板块实时动量 ============
// 从东方财富概念板块 API 获取真实板块涨跌幅
const { fetchJSON } = require('./fetcher');
const cache = require('./cacheManager');

// 板块数据缓存 30 秒
const CACHE_TTL = 30 * 1000;

// 需要追踪的热门板块关键字
const TARGET_SECTORS = [
  { keywords: ['AI应用','人工智能','AI概念','AI'], label: 'AI应用', primary: true },
  { keywords: ['半导体','芯片','集成电路'], label: '半导体/芯片', primary: true },
  { keywords: ['机器人','人形机器人','机器人概念'], label: '机器人', primary: true },
  { keywords: ['新能源','光伏','风电','氢能源'], label: '新能源', primary: true },
  { keywords: ['智能驾驶','自动驾驶','新能源汽车','汽车'], label: '新能源汽车', primary: true },
  { keywords: ['创新药','医药','生物医药','CRO'], label: '创新药', primary: true },
  { keywords: ['消费电子','消费'], label: '消费电子', primary: true },
  { keywords: ['白酒'], label: '白酒', primary: true },
  { keywords: ['券商'], label: '券商', primary: true },
  { keywords: ['银行'], label: '银行', primary: true },
];

// 根据涨跌幅生成分析文字
function generateReason(name, changePct) {
  if (changePct > 3) return `${name}板块强势领涨，资金大幅流入，市场情绪积极`;
  if (changePct > 1) return `${name}板块持续走强，近期资金关注度提升`;
  if (changePct > 0.3) return `${name}板块小幅走高，整体趋势向好`;
  if (changePct > -0.3) return `${name}板块窄幅震荡，多空力量均衡`;
  if (changePct > -1) return `${name}板块小幅回调，短期获利盘流出`;
  if (changePct > -3) return `${name}板块调整中，注意风险控制`;
  return `${name}板块大幅下跌，市场情绪偏弱，观望为宜`;
}

/**
 * 获取热门板块动量排行
 * @returns {Promise<{hotSectors: Array, summary: string}>}
 */
async function fetchHotSectors() {
  const cacheKey = 'hotSectors';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 获取所有概念板块(t:3)
  const url = 'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=500&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:3&fields=f12,f14,f2,f3,f4';
  const json = await fetchJSON(url, {
    headers: { Referer: 'https://quote.eastmoney.com/' },
    timeout: 8000,
  });

  const allSectors = json?.data?.diff || [];
  if (allSectors.length === 0) throw new Error('未获取到板块数据');

  // 匹配目标板块
  const matched = [];
  for (const target of TARGET_SECTORS) {
    const found = allSectors.find(s =>
      target.keywords.some(kw => s.f14 && s.f14.includes(kw))
    );
    if (found) {
      matched.push({
        name: target.label,
        code: found.f12,
        changePct: found.f3 || 0,
        current: found.f2 || 0,
        keywords: target.keywords,
      });
    }
  }

  // 按涨跌幅绝对值排序，取前 8 个
  const sorted = matched
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 8);

  // 转换为前端所需格式
  const hotSectors = sorted.map((s, i) => {
    // 动量分数：基于今日涨跌幅 + 排名加成
    const baseScore = 50 + (s.changePct || 0) * 6;
    const rankBonus = Math.max(0, (8 - i) * 2);
    const momentum = Math.min(99, Math.max(1, Math.round(baseScore + rankBonus)));

    return {
      name: s.name,
      code: s.code,
      momentum,
      changePct: s.changePct,
      reason: generateReason(s.name, s.changePct),
    };
  });

  // 生成市场情绪摘要
  const avgChange = sorted.reduce((s, x) => s + x.changePct, 0) / sorted.length;
  const posCount = sorted.filter(s => s.changePct > 0).length;
  const negCount = sorted.filter(s => s.changePct < 0).length;

  let sentiment;
  if (posCount > negCount * 2) sentiment = '积极偏多';
  else if (posCount > negCount) sentiment = '中性偏多';
  else if (negCount > posCount * 2) sentiment = '偏弱';
  else if (negCount > posCount) sentiment = '中性偏弱';
  else sentiment = '中性震荡';

  const maxSector = sorted.reduce((max, s) => Math.abs(s.changePct) > Math.abs(max.changePct) ? s : max, sorted[0] || {});
  const summary = `热门板块整体表现${sentiment}，${maxSector.name ? maxSector.name + '板块波动最为显著' : '各板块涨跌互现'}`;

  const result = { hotSectors, summary, sentiment };
  cache.set(cacheKey, result, CACHE_TTL);
  return result;
}

module.exports = { fetchHotSectors };
