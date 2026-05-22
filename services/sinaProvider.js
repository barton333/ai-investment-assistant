// ============ 新浪财经数据源 (sinajs.cn) ============
// 返回 GBK 编码的 CSV 格式：var hq_str_code="fields...";
const { fetchText } = require('./fetcher');

// 指数代码 → 系统内的显示名称
const INDEX_MAP = {
  'sh000001': '上证指数',
  'sz399001': '深证成指',
  'sh000300': '沪深300',
  'sz399006': '创业板指',
  'sh000688': '科创50',
};

const INDEX_CODES = Object.keys(INDEX_MAP);

/**
 * 新浪指数格式 (逗号分隔)：
 *   0:名称, 1:今开, 2:昨收, 3:当前, 4:最高, 5:最低, 6-7:保留, 8:成交量, 9:成交额, ...
 */
async function fetchIndices() {
  const url = `https://hq.sinajs.cn/list=${INDEX_CODES.join(',')}`;
  const text = await fetchText(url, {
    headers: { 'Referer': 'https://finance.sina.com.cn/' },
  });

  const result = {};
  for (const code of INDEX_CODES) {
    const match = text.match(new RegExp(`hq_str_${code}="([^"]*)"`));
    if (!match) continue;

    const fields = match[1].split(',');
    const name = fields[0] || INDEX_MAP[code];
    const current  = parseFloat(fields[3]); // 当前价
    const prevClose = parseFloat(fields[2]); // 昨收
    const open     = parseFloat(fields[1]); // 今开

    if (isNaN(current) || isNaN(prevClose)) continue;

    const change = current - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    result[INDEX_MAP[code]] = {
      value: current.toFixed(2),
      _open: open.toFixed(2),
      _prevClose: prevClose.toFixed(2),
      change: (change >= 0 ? '+' : '') + change.toFixed(2),
      changePercent: (changePercent >= 0 ? '+' : '') + changePercent.toFixed(2),
      trend: change >= 0 ? 'up' : 'down',
      source_quality: 'cross_validated',
    };
  }

  return result;
}

/**
 * 新浪汇率格式:
 *   var hq_str_USDCNY="美元人民币,7.2465,7.2465,7.2455,7.2475,7.2465,7.2465,7.2465,7.2465,..."
 *   0:名称, 1:当前价, 2:买入价, 3:卖出价, ...
 */
async function fetchFX() {
  const url = 'https://hq.sinajs.cn/list=USDCNY';
  const text = await fetchText(url, {
    headers: { 'Referer': 'https://finance.sina.com.cn/' },
  });

  const match = text.match(/hq_str_USDCNY="([^"]*)"/);
  if (!match) throw new Error('无法解析新浪汇率数据');

  const fields = match[1].split(',');
  const value = parseFloat(fields[1]); // 当前价
  const open = parseFloat(fields[2]);  // 开盘/参考价
  if (isNaN(value)) throw new Error('汇率数值无效');

  const change = open ? value - open : 0;
  const changePercent = open ? (change / open) * 100 : 0;

  return {
    '美元/人民币': {
      value: value.toFixed(4),
      change: (change >= 0 ? '+' : '') + change.toFixed(4),
      changePercent: (changePercent >= 0 ? '+' : '') + changePercent.toFixed(2),
      trend: change >= 0 ? 'up' : 'down',
      source_quality: 'single_source',
    }
  };
}

module.exports = { fetchIndices, fetchFX, INDEX_MAP };
