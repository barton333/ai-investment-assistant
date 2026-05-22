// ============ 东方财富数据源 (eastmoney.com) ============
// 返回 JSON 格式
const { fetchJSON } = require('./fetcher');

// secid = market.code  (1=上海, 0=深圳)
const SECIDS = [
  { secid: '1.000001', name: '上证指数' },
  { secid: '0.399001', name: '深证成指' },
  { secid: '1.000300', name: '沪深300' },   // 000300 在上交所
  { secid: '0.399006', name: '创业板指' },
  { secid: '1.000688', name: '科创50' },
];

// 代码 → 名称的快速映射（用于匹配 API 返回的 f12）
const CODE_TO_NAME = {};
SECIDS.forEach(s => {
  const code = s.secid.split('.')[1]; // "000001", "399001", etc.
  CODE_TO_NAME[code] = s.name;
});

/**
 * 东方财富 JSON 字段说明:
 *   f2 = 现价
 *   f3 = 涨跌幅(%)
 *   f4 = 涨跌额
 *   f12 = 代码
 *   f14 = 名称
 */
async function fetchIndices() {
  const secidStr = SECIDS.map(s => s.secid).join(',');
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=${secidStr}`;

  const json = await fetchJSON(url, {
    headers: { 'Referer': 'https://quote.eastmoney.com/' },
  });

  const result = {};
  const items = json?.data?.diff;
  if (!items || !Array.isArray(items)) {
    throw new Error('东方财富返回数据格式异常');
  }

  for (const item of items) {
    const current    = item.f2;  // 现价
    const changePct  = item.f3;  // 涨跌幅(%)
    const changeAmt  = item.f4;  // 涨跌额
    const code       = item.f12; // 代码
    const apiName    = item.f14; // API 返回的名称

    if (current == null || isNaN(current)) continue;

    const name = CODE_TO_NAME[code] || apiName || code;

    result[name] = {
      value: current.toFixed(2),
      change: (changeAmt >= 0 ? '+' : '') + (changeAmt ?? 0).toFixed(2),
      changePercent: (changePct >= 0 ? '+' : '') + (changePct ?? 0).toFixed(2),
      trend: changeAmt >= 0 ? 'up' : 'down',
      source_quality: 'cross_validated',
    };
  }

  return result;
}

module.exports = { fetchIndices };
