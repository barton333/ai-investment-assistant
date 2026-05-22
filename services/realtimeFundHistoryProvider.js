// ============ 天天基金历史净值 (全年) ============
// 从历史净值数据计算各周期涨跌幅（近1周~近1年）
const { fetchText } = require('./fetcher');
const cache = require('./cacheManager');

const HIST_URL = 'https://api.fund.eastmoney.com/f10/lsjz';
const PAGES_PER_FUND = 13; // 13页 × 20条 ≈ 260个交易日 ≈ 1年
const PAGE_SIZE = 20;

// 缓存配置：历史净值盘中不变，缓存 1 小时
const CACHE_TTL = 60 * 60 * 1000; // 1 小时

/**
 * 计算基金的各周期涨跌幅（近1周/1月/3月/6月/1年）
 * @param {string[]} fundCodes - 基金代码数组
 * @returns {Promise<Object<string, {week, month, quarter, halfYear, year, source}>>}
 */
async function fetchFundHistory(fundCodes) {
  if (!fundCodes || fundCodes.length === 0) return {};

  const cacheKey = 'fundHistory_' + fundCodes.sort().join(',');
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 每只基金并行拉取 13 页（260 条 ≈ 1 年交易数据）
  const allResults = await Promise.allSettled(
    fundCodes.map(code => fetchFundPages(code))
  );

  const map = {};
  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    if (r.status === 'fulfilled' && r.value) {
      map[r.value.code] = r.value;
    }
  }

  if (Object.keys(map).length > 0) {
    cache.set(cacheKey, map, CACHE_TTL);
  }
  return map;
}

/**
 * 拉取单只基金的多页历史净值
 */
async function fetchFundPages(code) {
  const requests = [];
  for (let i = 1; i <= PAGES_PER_FUND; i++) {
    const url = `${HIST_URL}?callback=jQuery&fundCode=${code}&pageIndex=${i}&pageSize=${PAGE_SIZE}`;
    requests.push(
      fetchText(url, {
        headers: { Referer: 'https://fund.eastmoney.com/' },
        timeout: 8000,
        retries: 1,
      })
    );
  }

  const responses = await Promise.allSettled(requests);
  const allRecords = [];

  for (const resp of responses) {
    if (resp.status !== 'fulfilled') continue;
    const m = resp.value.match(/jQuery\((.+)\)/);
    if (!m) continue;
    try {
      const data = JSON.parse(m[1]);
      const list = data?.Data?.LSJZList || [];
      allRecords.push(...list);
    } catch { /* skip parse errors */ }
  }

  if (allRecords.length < 5) return null;

  const latest = parseFloat(allRecords[0].DWJZ);
  if (isNaN(latest)) return null;

  // --- 计算各周期 ---
  // 交易日偏移: 1周≈4, 1月≈21, 3月≈63, 6月≈126, 1年≈252
  const PERIODS = {
    week: 4,
    month: 21,
    quarter: 63,
    halfYear: 126,
    year: 252,
  };

  const result = { code, recordCount: allRecords.length, source: {} };
  const dates = {};

  for (const [key, offset] of Object.entries(PERIODS)) {
    const calc = calcChange(latest, allRecords, offset);
    result[key] = calc?.value ?? null;
    if (key === 'week') dates.weekDate = calc?.date ?? null;
    if (key === 'month') dates.monthDate = calc?.date ?? null;
    result.source[key] = calc !== null;
  }

  // 用于走势图的净值序列（最近 60 个交易日，按时间正序）
  const navHistory = allRecords
    .slice(0, 60)
    .map(r => parseFloat(r.DWJZ))
    .filter(v => !isNaN(v))
    .reverse(); // 从远到近 → 适合图表

  return { ...result, ...dates, navHistory };
}

/**
 * 计算从最新净值到 N 个交易日前的涨跌幅
 */
function calcChange(latest, records, offset) {
  if (offset < records.length) {
    const prevVal = parseFloat(records[offset].DWJZ);
    if (!isNaN(prevVal) && prevVal > 0) {
      const pct = ((latest / prevVal) - 1) * 100;
      return {
        value: pct.toFixed(2),
        date: records[offset].FSRQ,
      };
    }
  }
  return null;
}

module.exports = { fetchFundHistory };
