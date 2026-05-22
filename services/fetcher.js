// ============ 通用 HTTP 请求封装 ============
// 支持 GBK→UTF-8 解码、超时、自动重试、HTTP代理
const iconv = require('iconv-lite');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

const DEFAULT_TIMEOUT = 15000;  // 15s（海外访问国内API较慢）
const MAX_RETRIES = 2;

/**
 * 读取环境变量中的代理配置（仅用于国内数据源）
 * 优先级：INVEST_PROXY > HTTPS_PROXY > HTTP_PROXY
 */
function getProxyAgent(targetUrl) {
  const proxyUrl = process.env.INVEST_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxyUrl) return null;
  const isHttps = targetUrl.startsWith('https:');
  return isHttps ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl);
}

/**
 * 代理感知的 fetch，支持通过 INVEST_PROXY 环境变量配置代理
 */
async function proxiedFetch(url, options = {}) {
  const agent = getProxyAgent(url);
  if (!agent) {
    // 无代理，直接用原生 fetch
    return fetch(url, options);
  }

  // 有代理，通过 http/https 模块 + proxy agent 发起请求
  const urlObj = new URL(url);
  const mod = urlObj.protocol === 'https:' ? https : http;
  const headers = { ...options.headers };

  return new Promise((resolve, reject) => {
    const req = mod.request(url, {
      agent,
      method: 'GET',
      headers,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      signal: options.signal,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        res.body = {
          arrayBuffer: async () => Buffer.concat(chunks),
          text: async () => Buffer.concat(chunks).toString('utf-8'),
        };
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          arrayBuffer: async () => Buffer.concat(chunks),
          text: async () => {
            const buf = Buffer.concat(chunks);
            // 尝试检测编码
            return buf.toString('utf-8');
          },
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

/**
 * 发起 HTTP GET 请求，自动处理 GBK 编码
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeout=DEFAULT_TIMEOUT]  超时毫秒
 * @param {number} [opts.retries=MAX_RETRIES]       重试次数
 * @param {string} [opts.encoding='gbk']             源编码
 * @param {object} [opts.headers]                    额外请求头
 * @returns {Promise<string>}  解码后的文本
 */
async function fetchText(url, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const retries = opts.retries ?? MAX_RETRIES;
  const encoding = opts.encoding ?? 'gbk';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://finance.sina.com.cn/',
    ...opts.headers,
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const resp = await proxiedFetch(url, {
        signal: controller.signal,
        headers,
        timeout,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      // 读取原始 Buffer 并解码
      const buffer = Buffer.from(await resp.arrayBuffer());
      const text = encoding !== 'utf-8'
        ? iconv.decode(buffer, encoding)
        : buffer.toString('utf-8');

      return text;
    } catch (err) {
      if (attempt < retries) {
        // 指数退避：重试前等待 2s
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * 发起 HTTP GET 请求，返回解析后的 JSON
 * @param {string} url
 * @param {object} [opts]  同 fetchText，但 encoding 固定为 utf-8
 * @returns {Promise<object>}
 */
async function fetchJSON(url, opts = {}) {
  const text = await fetchText(url, { ...opts, encoding: 'utf-8' });
  return JSON.parse(text);
}

module.exports = { fetchText, fetchJSON };
