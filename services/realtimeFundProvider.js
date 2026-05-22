// ============ 天天基金实时净值数据源 ============
// 接口: https://fundgz.1234567.com.cn/js/{基金代码}.js
// 返回 JSONP: jsonpgz({fundcode, name, jzrq, dwjz, gsz, gszzl, gztime})
const { fetchText } = require('./fetcher');
const cache = require('./cacheManager');

// 实时净值缓存 30 秒（盘间波动频繁）
const CACHE_TTL = 30 * 1000;

const FUND_GZ_URL = 'https://fundgz.1234567.com.cn/js';

/**
 * 批量获取基金实时估算净值
 * @param {string[]} fundCodes - 基金代码数组
 * @returns {Promise<Object<string, {nav:string, todayChange:string, navDate:string, gzTime:string, source_quality:string}>>}
 *   返回 code → 实时数据 的映射
 */
async function fetchFundsNAV(fundCodes) {
  if (!fundCodes || fundCodes.length === 0) return {};

  const cacheKey = 'fundNAV_' + fundCodes.sort().join(',');
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 并发请求所有基金
  const results = await Promise.allSettled(
    fundCodes.map(code => fetchSingleFund(code))
  );

  const map = {};
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value) {
      map[r.value.code] = r.value;
    } else {
      console.log(`  ⚠️ 基金 ${fundCodes[i]} 净值获取失败`);
    }
  }

  if (Object.keys(map).length > 0) {
    cache.set(cacheKey, map, CACHE_TTL);
  }
  return map;
}

/**
 * 获取单只基金实时净值
 */
async function fetchSingleFund(code) {
  const url = `${FUND_GZ_URL}/${code}.js`;
  const text = await fetchText(url, {
    headers: { 'Referer': 'https://fund.eastmoney.com/' },
    timeout: 6000,
    retries: 1,
  });

  const match = text.match(/jsonpgz\((.+)\)/);
  if (!match) throw new Error(`无法解析基金 ${code} 数据`);

  const data = JSON.parse(match[1]);

  // 字段说明:
  //   fundcode - 基金代码
  //   name     - 基金名称 (GBK, 可能乱码)
  //   jzrq     - 净值日期 (上一交易日)
  //   dwjz     - 单位净值 (上一交易日)
  //   gsz      - 实时估算净值
  //   gszzl    - 实时估算涨跌幅 (%)
  //   gztime   - 估算时间
  const gsz = parseFloat(data.gsz);
  const gszzl = parseFloat(data.gszzl);
  const dwjz = parseFloat(data.dwjz);

  if (isNaN(gsz)) throw new Error(`基金 ${code} 净值数值无效`);

  return {
    code: data.fundcode,
    nav: gsz.toFixed(4),
    navPrev: isNaN(dwjz) ? undefined : dwjz.toFixed(4),
    todayChange: (isNaN(gszzl) ? 0 : gszzl).toFixed(2),
    navDate: data.jzrq || '未知',
    gzTime: data.gztime || '未知',
    source_quality: 'realtime',
  };
}

module.exports = { fetchFundsNAV };
