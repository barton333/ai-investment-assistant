// ============ 实时数据调度中心 ============
// 统一调度多数据源 → 交叉验证 → 缓存 → 输出
const sinaProvider = require('./sinaProvider');
const tencentProvider = require('./tencentProvider');
const eastmoneyProvider = require('./eastmoneyProvider');
const { validateIndices, validateFX } = require('./crossValidator');

const REFRESH_INTERVAL = 5 * 60 * 1000;   // 5 分钟全量刷新
const CACHE_TTL = 30 * 1000;              // 30 秒内不重复拉取
const FETCH_TIMEOUT = 20000;              // 单次请求 20s 超时（海外访问国内API较慢）

const SOURCE_NAMES = ['新浪财经', '腾讯财经', '东方财富'];

// ============ 内部状态 ============

let cachedData = {
  indices: null,   // 交叉验证后的指数数据
  fx: null,        // 交叉验证后的汇率数据
  timestamp: null,
  raw: {           // 各源原始数据（调试用）
    sina: null,
    tencent: null,
    eastmoney: null,
  },
};

let lastFetchTime = 0;
let refreshTimer = null;

// ============ 核心刷新逻辑 ============

/**
 * 并行拉取所有数据源并进行交叉验证
 */
async function refreshAll() {
  const now = Date.now();

  // TTL 内不重复拉取
  if (now - lastFetchTime < CACHE_TTL && cachedData.timestamp) {
    return cachedData;
  }

  console.log(`[${new Date().toISOString()}] 🔄 实时数据刷新中...`);

  // --- 并行拉取指数（3 源） ---
  let sinaIndices = null, tencentIndices = null, eastmoneyIndices = null;
  let sinaFX = null, tencentFX = null;

  try {
    const results = await Promise.allSettled([
      sinaProvider.fetchIndices().then(d => { sinaIndices = d; return d; }),
      tencentProvider.fetchIndices().then(d => { tencentIndices = d; return d; }),
      eastmoneyProvider.fetchIndices().then(d => { eastmoneyIndices = d; return d; }),
      sinaProvider.fetchFX().then(d => { sinaFX = d; return d; }),
      tencentProvider.fetchFX().then(d => { tencentFX = d; return d; }),
    ]);

    // 记录每个源的状态
    const status = results.map((r, i) => {
      const names = ['新浪指数', '腾讯指数', '东方财富指数', '新浪汇率', '腾讯汇率'];
      return r.status === 'fulfilled' ? `✓${names[i]}` : `✗${names[i]}`;
    });
    console.log(`  ${status.join(' ')}`);

  } catch (err) {
    console.error('  数据拉取异常:', err.message);
  }

  // --- 保存原始数据 ---
  cachedData.raw = {
    sina: sinaIndices,
    tencent: tencentIndices,
    eastmoney: eastmoneyIndices,
    sinaFX,
    tencentFX,
  };

  // --- 交叉验证指数 ---
  const indicesSources = [sinaIndices, tencentIndices, eastmoneyIndices];
  const validatedIndices = validateIndices(indicesSources, SOURCE_NAMES);

  // --- 交叉验证汇率 ---
  const fxSources = [sinaFX, tencentFX];
  const validatedFX = validateFX(fxSources, ['新浪汇率', '腾讯汇率']);

  // --- 缓存更新 ---
  cachedData.indices = validatedIndices;
  cachedData.fx = validatedFX;
  cachedData.timestamp = new Date().toISOString();
  lastFetchTime = now;

  // 输出摘要
  const indexCount = Object.keys(validatedIndices).length;
  const fxCount = Object.keys(validatedFX).length;
  const qualities = Object.values(validatedIndices).map(v => v.source_quality);
  const verifiedCount = qualities.filter(q => q === 'cross_validated').length;
  console.log(`  📊 指数 ${indexCount} 项已更新 (交叉验证通过 ${verifiedCount}/${indexCount})`);
  if (fxCount > 0) console.log(`  💱 汇率 ${fxCount} 项已更新`);

  return cachedData;
}

/**
 * 获取当前缓存的最新实时数据
 * 如果缓存过期（>REFRESH_INTERVAL 未刷新）则触发后台刷新
 */
async function getData() {
  const now = Date.now();

  // 无缓存或缓存过期 → 同步刷新
  if (!cachedData.timestamp || (now - lastFetchTime) > REFRESH_INTERVAL) {
    return await refreshAll();
  }

  // 缓存有效但接近过期 → 后台异步刷新，立即返回当前缓存
  if ((now - lastFetchTime) > (REFRESH_INTERVAL - CACHE_TTL)) {
    refreshAll().catch(err => {
      console.error('  后台刷新失败（使用缓存）:', err.message);
    });
  }

  return cachedData;
}

/**
 * 强制刷新（忽略 TTL）
 */
async function forceRefresh() {
  lastFetchTime = 0;
  return await refreshAll();
}

// ============ 启动定时刷新 ============

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refreshAll().catch(err => {
      console.error('  定时刷新失败:', err.message);
    });
  }, REFRESH_INTERVAL);
  console.log(`  ⏰ 自动刷新已启动 (每 ${REFRESH_INTERVAL / 60000} 分钟)`);
}

// ============ 模块导出 ============

module.exports = {
  getData,
  forceRefresh,
  refreshAll,
  startAutoRefresh,
};
