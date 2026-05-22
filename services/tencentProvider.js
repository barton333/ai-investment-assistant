// ============ 腾讯财经数据源 (qt.gtimg.cn) ============
// 返回 GBK 编码，格式：v_code="fields~separated~by~tilde";
const { fetchText } = require('./fetcher');

const INDEX_MAP = {
  'sh000001': '上证指数',
  'sz399001': '深证成指',
  'sh000300': '沪深300',
  'sz399006': '创业板指',
  'sh000688': '科创50',
};

const INDEX_CODES = Object.keys(INDEX_MAP);

/**
 * 腾讯指数格式 (~ 分隔):
 *   0:市场, 1:名称, 2:代码, 3:当前价, 4:昨收, 5:今开, 6:成交量(手), ...
 */
async function fetchIndices() {
  const url = `http://qt.gtimg.cn/q=${INDEX_CODES.join(',')}`;
  const text = await fetchText(url, {
    headers: { 'Referer': 'https://gu.qq.com/' },
  });

  const result = {};
  for (const code of INDEX_CODES) {
    const match = text.match(new RegExp(`v_${code}="([^"]*)"`));
    if (!match) continue;

    const fields = match[1].split('~');
    const current   = parseFloat(fields[3]); // 当前价
    const prevClose = parseFloat(fields[4]); // 昨收

    if (isNaN(current) || isNaN(prevClose)) continue;

    const change = current - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    result[INDEX_MAP[code]] = {
      value: current.toFixed(2),
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
 * 腾讯汇率
 * 使用 fx_ 前缀的外汇代码
 */
async function fetchFX() {
  // 腾讯外汇代码格式: USDCNY 或 fx_sUSDCNY
  const url = 'http://qt.gtimg.cn/q=fx_susdcny';
  const text = await fetchText(url, {
    headers: { 'Referer': 'https://gu.qq.com/' },
  });

  const match = text.match(/v_fx_susdcny="([^"]*)"/);
  if (!match) throw new Error('无法解析腾讯汇率数据');

  const fields = match[1].split('~');
  const value = parseFloat(fields[3] || fields[1]);
  const prevClose = parseFloat(fields[4] || fields[2]);

  if (isNaN(value)) throw new Error('腾讯汇率数值无效');

  const change = !isNaN(prevClose) ? value - prevClose : 0;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;

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
