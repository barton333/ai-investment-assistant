// ============ 多源交叉验证引擎 ============
// 对同一指数/汇率从多个数据源的结果进行比对、去离群值、取中位数

const OUTLIER_THRESHOLD = 0.01; // 1% 偏离视为离群

/**
 * 对多个数据源返回的指数行情进行交叉验证
 *
 * @param {Object<string, Object>[]} sourcesResults
 *   每个元素的格式：{ '上证指数': { value: '3250.18', change: '-8.92', changePercent: '-0.28', trend: 'down' }, ... }
 *   数组中每个元素对应一个数据源的返回
 *
 * @param {string[]} sourceNames
 *   数据源名称数组，与 sourcesResults 一一对应，仅用于日志
 *
 * @returns {Object<string, {value:string, change:string, changePercent:string, trend:'up'|'down', source_quality:string, verified:boolean}>}
 *   验证后的统一输出
 */
function validateIndices(sourcesResults, sourceNames = []) {
  // 收集所有出现的指数名称
  const allNames = new Set();
  for (const src of sourcesResults) {
    if (src && typeof src === 'object') {
      Object.keys(src).forEach(k => allNames.add(k));
    }
  }

  const output = {};

  for (const name of allNames) {
    // 收集该指数在所有数据源中的有效数值
    const values = [];
    const changes = [];

    for (let i = 0; i < sourcesResults.length; i++) {
      const src = sourcesResults[i];
      if (!src || !src[name]) continue;
      const v = parseFloat(src[name].value);
      if (!isNaN(v)) {
        values.push({
          source: sourceNames[i] || `source_${i}`,
          value: v,
          change: parseFloat(src[name].change) || 0,
          changePercent: parseFloat(src[name].changePercent) || 0,
        });
      }
    }

    if (values.length === 0) {
      // 无任何数据源提供该指数
      continue;
    }

    // --- 离群值剔除 ---
    const numericValues = values.map(v => v.value);
    const median = computeMedian(numericValues);
    const filtered = values.filter(v => {
      if (median === 0) return true;
      return Math.abs(v.value - median) / Math.abs(median) < OUTLIER_THRESHOLD;
    });

    const finalValues = filtered.length >= 2 ? filtered : values; // 至少保留2个
    const finalNums = finalValues.map(v => v.value);

    // --- 计算最终数值 ---
    const finalMedian = computeMedian(finalNums);
    const avgChange = finalValues.reduce((s, v) => s + v.change, 0) / finalValues.length;
    const avgChangePercent = finalValues.reduce((s, v) => s + v.changePercent, 0) / finalValues.length;

    // 被剔除的数量
    const outliersCount = values.length - filtered.length;

    // --- 数据质量标记 ---
    let source_quality;
    if (finalValues.length >= 3 && outliersCount === 0) {
      source_quality = 'cross_validated';       // 3源完全一致
    } else if (finalValues.length >= 2) {
      source_quality = 'cross_validated';       // 2源以上（可能有离群）
    } else if (finalValues.length === 1) {
      source_quality = 'single_source';         // 仅有1源可用
    }

    output[name] = {
      value: finalMedian.toFixed(2),
      change: (avgChange >= 0 ? '+' : '') + avgChange.toFixed(2),
      changePercent: (avgChangePercent >= 0 ? '+' : '') + avgChangePercent.toFixed(2),
      trend: avgChange >= 0 ? 'up' : 'down',
      source_quality,
      verified: outliersCount === 0 && finalValues.length >= 2,
    };
  }

  return output;
}

/**
 * 对汇率数据的交叉验证（汇率字段较少，使用平均策略）
 */
function validateFX(sourcesResults, sourceNames = []) {
  return validateIndices(sourcesResults, sourceNames);
}

/**
 * 计算中位数
 */
function computeMedian(nums) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

module.exports = { validateIndices, validateFX };
