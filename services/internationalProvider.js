// ============ 国际数据源提供器 ============
// 聚合多个国际数据源，自动适配网络环境
// 无论服务器在中国还是国外，总有一部分源可用
const { fetchJSON } = require('./fetcher');

// ===== 全球指数映射：Yahoo Symbol → 中文名 =====
const YAHOO_SYMBOLS = {
  '000001.SS': '上证指数',
  '399001.SZ': '深证成指',
  '000300.SS': '沪深300',
  '399006.SZ': '创业板指',
  '000688.SS': '科创50',
  '^HSI': '恒生指数',
  '^GSPC': '标普500',
  '^IXIC': '纳斯达克',
  '^DJI': '道琼斯',
  '^N225': '日经225',
  'CNY=X': '美元/人民币',
  'GC=F': '黄金',
  'SI=F': '白银',
  'CL=F': '原油',
  'BTC-USD': '比特币',
};

// ===== 汇率备选源（永远可用） =====

/**
 * 从 open.er-api.com 获取汇率（免费，无需key，永远可用）
 */
async function fetchForexOpenER() {
  const url = 'https://open.er-api.com/v6/latest/USD';
  const data = await fetchJSON(url, { timeout: 5000 });
  if (data?.result === 'success' && data.rates?.CNY) {
    const cny = data.rates.CNY;
    return {
      '美元/人民币': {
        value: cny.toFixed(2),
        change: '0.00',
        changePercent: '0.00',
        trend: 'flat',
        source: 'open.er-api.com',
      },
    };
  }
  return null;
}

/**
 * 从 exchangerate-api.com 获取汇率（免费，无需key）
 */
async function fetchForexExchangeRate() {
  const url = 'https://api.exchangerate-api.com/v4/latest/USD';
  const data = await fetchJSON(url, { timeout: 5000 });
  if (data?.rates?.CNY) {
    const cny = data.rates.CNY;
    return {
      '美元/人民币': {
        value: cny.toFixed(2),
        change: '0.00',
        changePercent: '0.00',
        trend: 'flat',
        source: 'exchangerate-api.com',
      },
    };
  }
  return null;
}

/**
 * 获取国际汇率（尝试所有可用源）
 */
async function fetchInternationalForex() {
  for (const fn of [fetchForexOpenER, fetchForexExchangeRate]) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (err) {
      // 继续尝试下一个源
    }
  }
  return null;
}

// ===== Yahoo Finance（通过 Python yfinance） =====

/**
 * 通过 Python yfinance 获取指数数据（国外环境可用）
 * 使用子进程调用 Python，隔离网络栈
 */
async function fetchYahooIndices() {

    // 用文件方式调用 Python（避免命令行注入，使用 execFileSync 参数数组）
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');

  // 写入临时脚本
  const tmpScript = path.join(__dirname, '..', 'scripts', '_yf_cache.py');
  const pyCode = `
import json, sys, os, time
os.environ['YF_CACHE'] = '1'
import yfinance as yf

symbols = ${JSON.stringify(Object.keys(YAHOO_SYMBOLS))}
result = {}
for sym in symbols:
    try:
        t = yf.Ticker(sym)
        info = t.info
        price = info.get("regularMarketPrice") or info.get("previousClose")
        prev = info.get("regularMarketPreviousClose") or info.get("previousClose")
        if price and prev:
            change = price - prev
            pct = (change / prev) * 100
            result[sym] = {"price": round(price, 4), "change": round(change, 4), "changePct": round(pct, 4), "trend": "up" if change >= 0 else "down"}
        else:
            result[sym] = None
    except:
        result[sym] = None
print(json.dumps({"status":"ok","data":result}))
  `;

  try {
    fs.writeFileSync(tmpScript, pyCode, 'utf-8');
    // 对路径加双引号处理空格
    // Use execFileSync with argument array to avoid shell injection
    const stdout = execFileSync('python', [tmpScript], {
      timeout: 60000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout.trim());
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    try { fs.unlinkSync(tmpScript); } catch {}
  }
}

/**
 * 解析 Yahoo Finance 返回为统一格式
 */
function parseYahooResult(data) {
  if (!data || data.status !== 'ok' || !data.data) return null;

  const indices = {};
  for (const [sym, info] of Object.entries(data.data)) {
    const name = YAHOO_SYMBOLS[sym];
    if (!info || !name) continue;
    indices[name] = {
      value: String(info.price),
      change: (info.change >= 0 ? '+' : '') + info.change.toFixed(2),
      changePercent: (info.changePct >= 0 ? '+' : '') + info.changePct.toFixed(2),
      trend: info.trend,
      source: 'yahoo_finance',
      source_quality: 'realtime',
    };
  }
  return indices;
}

// ===== 公开接口 =====

/**
 * 获取所有国际数据源的结果
 * 返回统一格式的 indices 对象，和国内源格式一致
 * 失败返回 null
 */
async function fetchInternationalIndices() {
  const yahooResult = await fetchYahooIndices();
  const parsed = parseYahooResult(yahooResult);
  return parsed;
}

/**
 * 获取国际汇率数据
 */
async function fetchInternationalFX() {
  return await fetchInternationalForex();
}

module.exports = {
  fetchInternationalIndices,
  fetchInternationalFX,
  fetchForexOpenER,
  fetchForexExchangeRate,
  YAHOO_SYMBOLS,
};
