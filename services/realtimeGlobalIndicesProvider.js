// ============ 全球指数实时数据源 ============
// 组合多个 API 获取全球市场指数
const { fetchText, fetchJSON } = require('./fetcher');
const cache = require('./cacheManager');

// 全球指数缓存 30 秒
const CACHE_TTL = 30 * 1000;

// ============ 指数定义 ============

const GLOBAL_INDICES = [
  // [显示名称, 来源, 来源参数]
  { name: '恒生指数',   source: 'eastmoney', secid: '100.HSI' },
  { name: '标普500',    source: 'eastmoney', secid: '100.SPX' },
  { name: '日经225',    source: 'eastmoney', secid: '100.N225' },
  { name: '道琼斯',     source: 'sina_gb',   code: 'gb_dji' },
  { name: '纳斯达克',   source: 'sina_gb',   code: 'gb_ixic' },
  { name: '黄金',       source: 'sina_hf',   code: 'hf_GC',   decimals: 2, label: '美元/盎司' },
  { name: '原油',       source: 'sina_hf',   code: 'hf_CL',   decimals: 2, label: '美元/桶' },
  { name: '白银',       source: 'sina_hf',   code: 'hf_SI',   decimals: 2, label: '美元/盎司' },
  { name: '上证50',     source: 'sina_index', code: 'sh000016' },
  { name: '中证500',    source: 'sina_index', code: 'sh000905' },
  { name: '中证1000',   source: 'sina_index', code: 'sh000852' },
];

// ============ 获取函数 ============

/**
 * 获取所有全球指数实时行情
 * @returns {Promise<Object<string, {value, change, changePercent, trend}>>}
 */
async function fetchGlobalIndices() {
  const cacheKey = 'globalIndices';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 按来源分组请求
  const emSecids = GLOBAL_INDICES.filter(i => i.source === 'eastmoney').map(i => i.secid);
  const sinaGbCodes = GLOBAL_INDICES.filter(i => i.source === 'sina_gb').map(i => i.code);
  const sinaHfCodes = GLOBAL_INDICES.filter(i => i.source === 'sina_hf').map(i => i.code);
  const sinaIndexCodes = GLOBAL_INDICES.filter(i => i.source === 'sina_index').map(i => i.code);

  // 并行请求所有来源
  const [emData, sinaGbData, sinaHfData, sinaIndexData] = await Promise.allSettled([
    fetchEastMoneyGlobal(emSecids),
    fetchSinaGB(sinaGbCodes),
    fetchSinaHF(sinaHfCodes),
    fetchSinaIndex(sinaIndexCodes),
  ]);

  // 合并结果
  const result = {};

  // Helper to merge
  const merge = (data) => {
    if (data.status === 'fulfilled' && data.value) {
      Object.assign(result, data.value);
    }
  };

  merge(emData);
  merge(sinaGbData);
  merge(sinaHfData);
  merge(sinaIndexData);

  if (Object.keys(result).length > 0) {
    cache.set(cacheKey, result, CACHE_TTL);
  }
  return result;
}

/**
 * 东方财富全球指数 (JSON)
 * secids 格式: 100.HSI, 100.SPX, 100.N225
 */
async function fetchEastMoneyGlobal(secids) {
  if (!secids.length) return {};
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=${secids.join(',')}`;
  const json = await fetchJSON(url, {
    headers: { Referer: 'https://quote.eastmoney.com/' },
    timeout: 8000,
  });

  const result = {};
  const items = json?.data?.diff || [];
  for (const item of items) {
    const name = GLOBAL_INDICES.find(i => i.secid === `${item.f12}` || i.secid.endsWith(item.f12))?.name || item.f14;
    const current = item.f2;
    const changePct = item.f3;
    const changeAmt = item.f4;
    if (current == null || isNaN(current)) continue;

    result[name] = {
      value: current.toFixed(2),
      change: (changeAmt >= 0 ? '+' : '') + (changeAmt ?? 0).toFixed(2),
      changePercent: (changePct >= 0 ? '+' : '') + (changePct ?? 0).toFixed(2),
      trend: changeAmt >= 0 ? 'up' : 'down',
      source_quality: 'single_source',
    };
  }
  return result;
}

/**
 * 新浪美股指数 (gb_ 前缀)
 * 格式: "道琼斯,50285.6602,0.55,2026-05-22 05:10:44,276.3100,..."
 * fields: name, price, change%, datetime, change, ...
 */
async function fetchSinaGB(codes) {
  if (!codes.length) return {};
  const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
  const text = await fetchText(url, {
    headers: { Referer: 'https://finance.sina.com.cn/' },
    timeout: 8000,
  });

  const result = {};
  for (const code of codes) {
    const match = text.match(new RegExp(`hq_str_${code}="([^"]*)"`));
    if (!match) continue;
    const fields = match[1].split(',');
    const name = fields[0];
    const current = parseFloat(fields[1]);
    const changePct = parseFloat(fields[2]);
    const change = parseFloat(fields[4]);

    if (isNaN(current)) continue;

    // 从 GLOBAL_INDICES 找显示名称
    const displayName = GLOBAL_INDICES.find(i => i.code === code)?.name || name;

    result[displayName] = {
      value: current.toFixed(2),
      change: (change >= 0 ? '+' : '') + (change ?? 0).toFixed(2),
      changePercent: (changePct >= 0 ? '+' : '') + (changePct ?? 0).toFixed(2),
      trend: change >= 0 ? 'up' : 'down',
      source_quality: 'single_source',
    };
  }
  return result;
}

/**
 * 新浪期货指数 (hf_ 前缀)
 * 格式: "4529.179,,4528.900,4529.500,4547.000,4528.200,..."
 * fields: 0=当前, 1=(空), 2=今开, 3=昨收, 4=最高, 5=最低, ...
 */
async function fetchSinaHF(codes) {
  if (!codes.length) return {};
  const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
  const text = await fetchText(url, {
    headers: { Referer: 'https://finance.sina.com.cn/' },
    timeout: 8000,
  });

  const result = {};
  for (const code of codes) {
    const match = text.match(new RegExp(`hq_str_${code}="([^"]*)"`));
    if (!match) continue;
    const fields = match[1].split(',');
    const current = parseFloat(fields[0]);      // 当前价
    const prevClose = parseFloat(fields[3]);    // 昨收
    if (isNaN(current)) continue;

    const change = prevClose ? current - prevClose : 0;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    const meta = GLOBAL_INDICES.find(i => i.code === code) || {};
    const decimals = meta.decimals ?? 2;

    result[meta.name || code] = {
      value: current.toFixed(decimals),
      change: (change >= 0 ? '+' : '') + change.toFixed(decimals),
      changePercent: (changePct >= 0 ? '+' : '') + changePct.toFixed(2),
      trend: change >= 0 ? 'up' : 'down',
      source_quality: 'single_source',
    };
  }
  return result;
}

/**
 * 新浪 A 股指数 (同现有 sinaProvider 格式)
 * fields: 0=名称, 1=今开, 2=昨收, 3=当前, 4=最高, 5=最低, ...
 */
async function fetchSinaIndex(codes) {
  if (!codes.length) return {};
  const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
  const text = await fetchText(url, {
    headers: { Referer: 'https://finance.sina.com.cn/' },
    timeout: 8000,
  });

  const result = {};
  for (const code of codes) {
    const match = text.match(new RegExp(`hq_str_${code}="([^"]*)"`));
    if (!match) continue;
    const fields = match[1].split(',');
    const current = parseFloat(fields[3]);
    const prevClose = parseFloat(fields[2]);
    if (isNaN(current) || isNaN(prevClose)) continue;

    const change = current - prevClose;
    const changePct = (change / prevClose) * 100;
    const meta = GLOBAL_INDICES.find(i => i.code === code) || {};
    const displayName = meta.name || fields[0];

    result[displayName] = {
      value: current.toFixed(2),
      change: (change >= 0 ? '+' : '') + change.toFixed(2),
      changePercent: (changePct >= 0 ? '+' : '') + changePct.toFixed(2),
      trend: change >= 0 ? 'up' : 'down',
      source_quality: 'single_source',
    };
  }
  return result;
}

module.exports = { fetchGlobalIndices, GLOBAL_INDICES };
