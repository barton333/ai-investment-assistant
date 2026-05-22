// ============ 华尔街见闻实时财经快讯 ============
// API: https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=N
const { fetchJSON } = require('./fetcher');
const cache = require('./cacheManager');

// 快讯新闻缓存 3 分钟（时效性较长）
const CACHE_TTL = 3 * 60 * 1000;

const NEWS_API = 'https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=12';
const NEWS_SOURCE = '华尔街见闻';

// ============ 关键词分析引擎 ============

// 利好关键词 → 权重
const POSITIVE_KEYWORDS = [
  { word: '上涨', weight: 2 }, { word: '增长', weight: 2 },
  { word: '利好', weight: 3 }, { word: '突破', weight: 2 },
  { word: '创新高', weight: 3 }, { word: '扩大', weight: 1 },
  { word: '提振', weight: 2 }, { word: '反弹', weight: 1 },
  { word: '牛市', weight: 3 }, { word: '看多', weight: 2 },
  { word: '买入', weight: 2 }, { word: '加仓', weight: 2 },
  { word: '降息', weight: 2 }, { word: '放量', weight: 1 },
  { word: '走高', weight: 1 }, { word: '高开', weight: 1 },
  { word: '涨幅', weight: 2 }, { word: '涨', weight: 1 },
  { word: '批准', weight: 1 }, { word: '支持', weight: 1 },
  { word: '加速', weight: 1 }, { word: '复苏', weight: 2 },
  { word: '注资', weight: 2 }, { word: '成立', weight: 1 },
];

// 利空关键词 → 权重
const NEGATIVE_KEYWORDS = [
  { word: '下跌', weight: 2 }, { word: '下降', weight: 2 },
  { word: '利空', weight: 3 }, { word: '减持', weight: 2 },
  { word: '卖出', weight: 2 }, { word: '看空', weight: 2 },
  { word: '熊市', weight: 3 }, { word: '风险', weight: 2 },
  { word: '回落', weight: 1 }, { word: '收缩', weight: 2 },
  { word: '跌', weight: 1 }, { word: '挫', weight: 1 },
  { word: '降级', weight: 2 }, { word: '取消', weight: 1 },
  { word: '加息', weight: 2 }, { word: '制裁', weight: 2 },
  { word: '冲突', weight: 2 }, { word: '紧张', weight: 1 },
  { word: '关税', weight: 1 }, { word: '下滑', weight: 2 },
  { word: '亏损', weight: 2 }, { word: '违约', weight: 3 },
  { word: '调查', weight: 1 }, { word: '限制', weight: 1 },
];

// 行业/板块关键词映射
const SECTOR_KEYWORDS = [
  { sector: 'AI/科技', words: ['AI','人工智能','科技','芯片','半导体','机器人','大模型','软件','云计算','数据','算力','算法','智能'] },
  { sector: '金融', words: ['银行','金融','保险','证券','基金','降息','加息','利率','汇率','债券','货币','信贷','央行','美联储','财政'] },
  { sector: '新能源', words: ['新能源','光伏','风电','储能','电池','电动车','新能源汽车','锂','氢能','碳'] },
  { sector: '消费', words: ['消费','白酒','食品','零售','旅游','家电','餐饮','电商','免税'] },
  { sector: '医疗/医药', words: ['医疗','医药','药','生物','创新药','CXO','器械','健康'] },
  { sector: '半导体/芯片', words: ['半导体','芯片','集成电路','光刻','EDA','封测'] },
  { sector: '房地产', words: ['房地产','地产','楼市','住房','物业','基建'] },
  { sector: '军工', words: ['军工','国防','航天','卫星','船舶'] },
  { sector: '能源/资源', words: ['能源','原油','石油','天然气','煤炭','黄金','有色','大宗商品'] },
  { sector: '汽车', words: ['汽车','整车','自动驾驶','智能驾驶'] },
  { sector: '农业', words: ['农业','粮食','种业','猪肉','养殖'] },
  { sector: '航运/物流', words: ['航运','物流','港口','海运','空运'] },
];

/**
 * 分析新闻文本，判断利好/利空影响力
 */
function analyzeImpact(text) {
  let posScore = 0, negScore = 0;

  for (const { word, weight } of POSITIVE_KEYWORDS) {
    if (text.includes(word)) posScore += weight;
  }
  for (const { word, weight } of NEGATIVE_KEYWORDS) {
    if (text.includes(word)) negScore += weight;
  }

  const diff = posScore - negScore;
  const total = posScore + negScore;

  if (total === 0) return '中性';
  if (diff > 2) return '利好';
  if (diff > 0) return '中性偏利好';
  if (diff < -2) return '利空';
  if (diff < 0) return '中性偏利空';
  return '中性';
}

/**
 * 分析新闻文本，提取相关行业板块
 */
function analyzeSectors(text) {
  const matched = [];
  for (const { sector, words } of SECTOR_KEYWORDS) {
    for (const w of words) {
      if (text.includes(w)) {
        if (!matched.includes(sector)) matched.push(sector);
        break; // 一个板块只匹配一次
      }
    }
  }
  return matched.length > 0 ? matched : ['综合'];
}

/**
 * 判断重要程度
 */
function analyzeImportance(text) {
  const highSignals = ['突发', '重大', '紧急', '央行', '美联储', '降息', '加息', '崩盘', '救市', '改革', '政策'];
  for (const s of highSignals) {
    if (text.includes(s)) return 'high';
  }
  if (text.length > 40) return 'medium';
  return 'low';
}

// ============ 核心获取逻辑 ============

/**
 * 从华尔街见闻获取实时财经快讯
 * @returns {Promise<Array>} 格式化后的新闻数组
 */
async function fetchNews() {
  const cacheKey = 'realtimeNews';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchJSON(NEWS_API, {
    headers: {
      'Referer': 'https://wallstreetcn.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    timeout: 8000,
  });

  const items = data?.data?.items || [];
  if (items.length === 0) throw new Error('华尔街见闻未返回新闻数据');

  const now = Date.now();

  return items.map((item) => {
    const text = item.content_text || item.title || '';
    const title = item.title || text.substring(0, 40) + (text.length > 40 ? '...' : '');
    const timestamp = item.display_time
      ? (typeof item.display_time === 'number' ? item.display_time * 1000 : new Date(item.display_time).getTime())
      : now;
    const dateObj = new Date(timestamp);
    const hoursAgo = Math.floor((now - timestamp) / (1000 * 60 * 60));
    const timeText = hoursAgo < 1 ? '刚刚' : hoursAgo < 24 ? `${hoursAgo}小时前` : dateObj.toLocaleDateString('zh-CN');

    return {
      topic: title,
      impact: analyzeImpact(text),
      detail: text,
      affectedSectors: analyzeSectors(text),
      date: dateObj.toISOString().split('T')[0],
      importance: analyzeImportance(text),
      source: item.source || NEWS_SOURCE,
      time: timeText,
      uri: item.uri || '',
      _raw: { timestamp },
    };
  });

  cache.set(cacheKey, result, CACHE_TTL);
  return result;
}

module.exports = { fetchNews };
