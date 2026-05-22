// ============ 智能内存缓存 ============
// TTL 自动过期，用于减少免费 API 调用频率
// 各数据源缓存策略：
//   基金历史数据  → 1 小时（日净值，盘间不变）
//   基金实时净值  → 60 秒（盘间波动）
//   全球指数      → 60 秒
//   板块动量      → 60 秒
//   实时新闻      → 3 分钟
//   指数实时行情  → 30 秒（realtimeManager 已有独立缓存）

class CacheManager {
  constructor() {
    /** @type {Map<string, {value: any, expires: number}>} */
    this._store = new Map();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {any|null} 未命中或已过期返回 null
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }
    if (Date.now() > entry.expires) {
      this._store.delete(key);
      this._misses++;
      return null;
    }
    this._hits++;
    return entry.value;
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 要缓存的值
   * @param {number} ttlMs - 过期时间（毫秒）
   */
  set(key, value, ttlMs) {
    this._store.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  }

  /**
   * 获取或创建缓存（函数式）
   * @param {string} key - 缓存键
   * @param {Function} fetchFn - 缓存未命中时的获取函数
   * @param {number} ttlMs - 过期时间
   * @returns {Promise<any>}
   */
  async getOrFetch(key, fetchFn, ttlMs) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const fresh = await fetchFn();
    this.set(key, fresh, ttlMs);
    return fresh;
  }

  /** 清除指定缓存 */
  invalidate(key) {
    this._store.delete(key);
  }

  /** 清除全部缓存 */
  invalidateAll() {
    this._store.clear();
  }

  /** 缓存统计 */
  stats() {
    return {
      size: this._store.size,
      hits: this._hits,
      misses: this._misses,
      rate: this._hits + this._misses > 0
        ? (this._hits / (this._hits + this._misses) * 100).toFixed(1) + '%'
        : '0%',
    };
  }
}

// 全局单例
const cacheManager = new CacheManager();

module.exports = cacheManager;
