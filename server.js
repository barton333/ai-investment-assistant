const express = require('express');
const path = require('path');
const realtimeManager = require('./services/realtimeManager');
const realtimeFundProvider = require('./services/realtimeFundProvider');
const realtimeFundHistoryProvider = require('./services/realtimeFundHistoryProvider');
const realtimeNewsProvider = require('./services/realtimeNewsProvider');
const realtimeGlobalIndicesProvider = require('./services/realtimeGlobalIndicesProvider');
const realtimeHotSectorsProvider = require('./services/realtimeHotSectorsProvider');
const cache = require('./services/cacheManager');
const app = express();
const PORT = process.env.PORT || 3000;

// ============ 代理配置检测 ============
const proxyUrl = process.env.INVEST_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
  console.log(`  🔗 代理已配置: ${proxyUrl.replace(/\/\/.*@/, '//***@')}`);
} else {
  console.log(`  ⚠️  未配置代理，从海外访问国内数据源可能失败`);
  console.log(`  💡 建议设置环境变量 INVEST_PROXY 指向国内代理服务器`);
}

// ============ MOCK DATA GENERATORS ============

// Realistic Chinese fund data
const fundTemplates = [
  { name: '易方达消费行业股票', code: '110022', type: '股票型', focus: '消费/白酒/食品饮料' },
  { name: '中欧医疗健康混合A', code: '003095', type: '混合型', focus: '医疗/医药/生物' },
  { name: '富国天惠成长混合A', code: '161005', type: '混合型', focus: '成长型/大盘' },
  { name: '景顺长城新兴成长混合', code: '260108', type: '混合型', focus: '消费/互联网/AI' },
  { name: '招商中证白酒指数A', code: '161725', type: '指数型', focus: '白酒/消费' },
  { name: '华夏能源革新股票A', code: '003834', type: '股票型', focus: '新能源/光伏/电池' },
  { name: '广发科技先锋混合', code: '008903', type: '混合型', focus: '科技/半导体/AI' },
  { name: '天弘沪深300指数A', code: '515330', type: '指数型', focus: '沪深300/大盘' },
  { name: '南方中证500ETF联接A', code: '160119', type: '指数型', focus: '中证500/中小盘' },
  { name: '工银瑞信前沿医疗股票', code: '001717', type: '股票型', focus: '医疗/创新药' },
  { name: '汇添富创新医药主题混合', code: '006113', type: '混合型', focus: '医药/器械/服务' },
  { name: '嘉实智能汽车股票', code: '002168', type: '股票型', focus: '新能源汽车/智能驾驶' },
  { name: '农银新能源主题', code: '002190', type: '混合型', focus: '新能源/光伏/风电' },
  { name: '国泰CES半导体芯片ETF联接A', code: '008281', type: '指数型', focus: '半导体/芯片/国产替代' },
  { name: '华安创业板50指数A', code: '160420', type: '指数型', focus: '创业板/成长' },
  { name: '中欧时代先锋股票A', code: '001938', type: '股票型', focus: '科技/互联网/消费' },
  { name: '易方达蓝筹精选混合', code: '005827', type: '混合型', focus: '蓝筹/港股/消费' },
  { name: '前海开源稀缺资产混合', code: '001679', type: '混合型', focus: '稀缺资产/消费/医疗' },
  { name: '广发科技动力股票', code: '005777', type: '股票型', focus: '科技/AI/云计算' },
  { name: '华夏科技创新混合A', code: '007349', type: '混合型', focus: '科技创新/半导体/AI' },
];

// USD investment options from Chinese banks
const usdProducts = [
  { name: '中国银行美元结构性存款', bank: '中国银行', type: '结构性存款', term: '3-12个月', yield: '3.8%-4.5%', risk: '低', minAmount: '2000美元' },
  { name: '工商银行美元定期存款', bank: '工商银行', type: '定期存款', term: '1-24个月', yield: '4.0%-4.8%', risk: '极低', minAmount: '1000美元' },
  { name: '招行美元理财-聚益生金', bank: '招商银行', type: '理财产品', term: '3-24个月', yield: '4.2%-5.0%', risk: 'R2中低', minAmount: '1000美元' },
  { name: '建设银行汇得盈', bank: '建设银行', type: '结构性产品', term: '1-12个月', yield: '3.5%-5.2%', risk: 'R2中低', minAmount: '5000美元' },
  { name: '交通银行得利宝美元', bank: '交通银行', type: '理财产品', term: '3-18个月', yield: '4.0%-4.6%', risk: 'R2中低', minAmount: '1000美元' },
  { name: '中银美元QDII基金', bank: '中国银行', type: 'QDII基金', term: '灵活申赎', yield: '5%-15%', risk: '中高', minAmount: '1000美元' },
];

// AI news analysis templates
const newsAnalysis = [
  {
    topic: '美联储降息预期增强',
    impact: '利好',
    detail: '美联储最新会议纪要显示通胀持续回落，市场预计9月降息概率升至78%。美元走弱预期下，人民币资产吸引力提升，北向资金有望加速流入A股。',
    affectedSectors: ['大消费', '金融', '地产'],
    date: '2025-01-15'
  },
  {
    topic: '国家大基金三期成立',
    impact: '利好',
    detail: '国家集成电路产业投资基金三期正式成立，注册资本超3000亿元，重点投向半导体设备、材料和先进制造。国产替代进程加速，半导体产业链迎来长期政策红利。',
    affectedSectors: ['半导体', '芯片', '高端制造'],
    date: '2025-01-14'
  },
  {
    topic: 'AI大模型商业化加速',
    impact: '利好',
    detail: '多家头部科技企业发布AI大模型商业应用，AI+医疗、AI+金融、AI+制造等场景落地加速。Gartner预测2025年全球AI市场规模将突破5000亿美元。',
    affectedSectors: ['AI', '云计算', '软件服务'],
    date: '2025-01-13'
  },
  {
    topic: '新能源产业链全球布局',
    impact: '中性偏利好',
    detail: '中国新能源车企海外建厂加速，光伏组件出口同比增35%。欧盟碳关税政策短期影响有限，中长期利好具备海外产能的龙头企业。',
    affectedSectors: ['新能源汽车', '光伏', '储能'],
    date: '2025-01-12'
  },
  {
    topic: '消费复苏政策再加码',
    impact: '利好',
    detail: '国务院印发《促进消费稳定增长若干措施》，涵盖家电以旧换新、新能源汽车下乡、文旅消费券等。社零数据有望在Q2迎来拐点。',
    affectedSectors: ['消费', '家电', '旅游'],
    date: '2025-01-11'
  },
  {
    topic: '人民币国际化新进展',
    impact: '中性',
    detail: '中国与沙特签署500亿人民币互换协议，人民币跨境结算占比提升至28%。短期对汇率影响有限，长期利好跨境金融和贸易企业。',
    affectedSectors: ['银行', '跨境支付', '贸易'],
    date: '2025-01-10'
  },
  {
    topic: '创新药出海加速',
    impact: '利好',
    detail: '2024年国产创新药海外授权交易金额超400亿美元，多家药企PD-1、ADC药物获FDA批准。创新药国际化进入收获期。',
    affectedSectors: ['创新药', '生物医药', 'CXO'],
    date: '2025-01-09'
  },
  {
    topic: '全球地缘局势紧张',
    impact: '利空',
    detail: '中东地缘冲突持续，红海航运受阻推升能源与航运成本。避险情绪升温，黄金价格维持高位，短期对风险资产形成压制。',
    affectedSectors: ['黄金', '能源', '航运'],
    date: '2025-01-08'
  }
];

// Seeded random for stable mock data
let dataSeed = Date.now();
function seededRandom() {
  dataSeed = (dataSeed * 9301 + 49297) % 233280;
  return dataSeed / 233280;
}

function generateMarketOverview(realtimeData) {
  // 默认 mock 基准值（当实时数据缺失时降级使用）
  const mockBaseValues = {
    '上证指数': { base: 3250, vol: 3 },
    '深证成指': { base: 10800, vol: 5 },
    '沪深300': { base: 3950, vol: 3.5 },
    '创业板指': { base: 2150, vol: 4 },
    '科创50': { base: 980, vol: 3 },
    '美元/人民币': { base: 7.18, vol: 0.05 },
    '黄金': { base: 2330, vol: 20 },
    '白银': { base: 29.50, vol: 0.8 },
    '比特币': { base: 67500, vol: 2000 },
    '原油': { base: 78.5, vol: 2.5 },
  };

  const indices = {};

  // 优先使用实时数据（经过交叉验证的）
  if (realtimeData?.indices) {
    for (const [name, info] of Object.entries(realtimeData.indices)) {
      indices[name] = {
        value: info.value,
        change: info.change,
        changePercent: info.changePercent,
        trend: info.trend,
        source: 'realtime',
        source_quality: info.source_quality,
      };
    }
  }

  // 合并实时汇率
  if (realtimeData?.fx) {
    for (const [name, info] of Object.entries(realtimeData.fx)) {
      indices[name] = {
        value: info.value,
        change: info.change,
        changePercent: info.changePercent,
        trend: info.trend,
        source: 'realtime',
        source_quality: info.source_quality,
      };
    }
  }

  // 对缺失的指数使用 mock 数据降级
  for (const [name, config] of Object.entries(mockBaseValues)) {
    if (indices[name]) continue;

    const change = (seededRandom() - 0.5) * config.vol;
    const changePercent = (change / config.base * 100);
    indices[name] = {
      value: (config.base + change).toFixed(name.includes('美元') ? 4 : 2),
      change: change.toFixed(name.includes('美元') ? 4 : 2),
      changePercent: changePercent.toFixed(2),
      trend: change >= 0 ? 'up' : 'down',
      source: 'mock',
      source_quality: 'fallback_mock',
    };

    console.log(`  ⚠️  ${name} 无实时数据，使用模拟值降级`);
  }

  return indices;
}

function generateTopFunds(count = 5) {
  // Pick 5 random funds and rank them
  const shuffled = [...fundTemplates].sort(() => seededRandom() - 0.5);
  const top = shuffled.slice(0, count);
  
  // Recent performance data (realistic ranges for Chinese funds)
  const perf = [
    { rank: 1, week: 3.2, month: 8.5, quarter: 15.2, halfYear: 22.8, year: 45.6, score: 92, risk: '中高', rating: 5 },
    { rank: 2, week: 2.8, month: 7.2, quarter: 13.5, halfYear: 19.4, year: 38.2, score: 88, risk: '中', rating: 5 },
    { rank: 3, week: 2.1, month: 6.8, quarter: 11.8, halfYear: 17.6, year: 32.5, score: 85, risk: '中', rating: 4 },
    { rank: 4, week: 1.9, month: 5.9, quarter: 10.5, halfYear: 15.8, year: 28.9, score: 82, risk: '中高', rating: 4 },
    { rank: 5, week: 1.6, month: 5.2, quarter: 9.8, halfYear: 14.2, year: 25.4, score: 78, risk: '中', rating: 4 },
  ];

  // AI analysis will be generated dynamically in generateFullData after merging real data

  // Investment advice specific to each fund
  const advices = [
    { action: '推荐买入', reason: '政策利好+资金流入+技术突破，三因子共振上行', confidence: '★★★★★', target: '6-12个月持有' },
    { action: '推荐持有', reason: '基本面稳健+估值合理+行业景气度向上', confidence: '★★★★☆', target: '中长期配置' },
    { action: '逢低加仓', reason: '短期回调不改长期趋势，当前PEG<1具有安全边际', confidence: '★★★★☆', target: '分3批建仓' },
    { action: '关注等待', reason: '等待行业催化剂出现，右侧确认后介入更稳妥', confidence: '★★★☆☆', target: '观察1-2周' },
    { action: '推荐持有', reason: '均衡配置，抵御市场波动，适合作为组合底仓', confidence: '★★★★☆', target: '长期持有' },
  ];

  return top.map((fund, i) => ({
    rank: i + 1,
    ...fund,
    ...perf[i],
    todayChange: (seededRandom() * 4 - 1).toFixed(2),
    nav: (seededRandom() * 5 + 1.5).toFixed(4),
    fundSize: `${(seededRandom() * 80 + 10).toFixed(1)}亿`,
    // aiAnalysis will be generated in generateFullData after merging real data
    advice: advices[i],
  }));
}

/**
 * 基于真实基金数据生成动态 AI 分析文本
 */
function generateDynamicAnalysis(fund) {
  const { name, focus, week, month, quarter, halfYear, year, score, risk, type, todayChange, nav } = fund;
  
  // 确定各周期的涨跌描述
  const trendWord = (val) => {
    if (val == null) return '暂无数据';
    if (val > 5) return `强势上涨 +${val}%`;
    if (val > 2) return `显著上涨 +${val}%`;
    if (val > 0.5) return `小幅上涨 +${val}%`;
    if (val > -0.5) return `基本持平 ${val}%`;
    if (val > -2) return `小幅回调 ${val}%`;
    if (val > -5) return `明显下跌 ${val}%`;
    return `大幅下跌 ${val}%`;
  };

  const weekStr = week != null ? trendWord(week) : '暂无数据';
  const monthStr = month != null ? trendWord(month) : '暂无数据';
  const yearStr = year != null ? trendWord(year) : '暂无数据';

  // 判断近期表现方向
  const recentPositive = (week || 0) + (month || 0) > 0;
  const longTermPositive = (year || 0) > 0;

  // 表现评级
  let perfRating = '一般';
  if (recentPositive && longTermPositive) perfRating = '优秀';
  else if (recentPositive) perfRating = '短期偏强';
  else if (longTermPositive) perfRating = '长期稳健';

  // 今日表现
  const todayNum = parseFloat(todayChange);
  const todayStr = todayNum >= 0 ? `今日上涨 ${todayNum}%` : `今日下跌 ${Math.abs(todayNum)}%`;

  // 组合建议
  let suggestion;
  const scoreNum = parseInt(score);
  if (scoreNum >= 90) suggestion = '建议作为核心配置持有，占比不超过总投资组合的20%';
  else if (scoreNum >= 80) suggestion = '建议作为卫星配置，关注回调后的布局机会';
  else if (scoreNum >= 70) suggestion = '建议保持观望，等待更明确的入场信号';
  else suggestion = '建议谨慎参与，控制仓位风险';

  // 风险提示
  let riskNote;
  if (risk && risk.includes('高')) riskNote = '该基金风险等级较高，净值波动较大，建议设置5-8%止损线';
  else riskNote = '该基金风险适中，适合中长期持有';

  return `AI深度分析：${name}（${type}）重仓${focus || '核心赛道'}领域。近期表现方面，近1周${weekStr}，近1月${monthStr}，近1年${yearStr}，整体呈现${perfRating}态势。${todayStr}，当前净值为${nav}元。AI综合评分${scoreNum}分，${riskNote}。${suggestion}。`;
}

/**
 * 基于真实数据生成投资建议理由
 */
function generateDynamicAdvice(fund) {
  const { week, month, score } = fund;
  const w = week || 0;
  const m = month || 0;
  const s = parseInt(score);

  // 综合判断：近期表现+评分
  if (w > 0 && m > 0 && s >= 85) {
    return { action: '推荐买入', reason: '短期走强+中期向上+高评分，三因子共振', confidence: '★★★★★', target: '6-12个月持有' };
  }
  if (w > -1 && m > -2 && s >= 80) {
    return { action: '推荐持有', reason: '基本面稳健+估值合理+行业景气度向上', confidence: '★★★★☆', target: '中长期配置' };
  }
  if (w < -2 && m < -3 && s >= 80) {
    return { action: '逢低加仓', reason: '短期回调不改长期趋势，当前具备安全边际', confidence: '★★★★☆', target: '分3批建仓' };
  }
  if (s >= 70) {
    return { action: '关注等待', reason: '等待行业催化剂出现，右侧确认后介入更稳妥', confidence: '★★★☆☆', target: '观察1-2周' };
  }
  return { action: '观望', reason: '市场不确定性较高，建议控制仓位', confidence: '★★☆☆☆', target: '等待信号' };
}

function generateGlobalNews() {
  return newsAnalysis.map(item => ({
    ...item,
    importance: seededRandom() > 0.6 ? 'high' : seededRandom() > 0.3 ? 'medium' : 'low',
    source: ['Reuters', 'Bloomberg', 'Xinhua', '财联社', '华尔街见闻', '证券时报'][Math.floor(seededRandom() * 6)],
    time: `${Math.floor(seededRandom() * 24)}小时前`
  }));
}

function generateInvestmentAdvice(topFunds) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getDate().toString().padStart(2,'0')}`;

  return [
    {
      type: 'short',
      title: '短期策略 (1-3个月)',
      color: '#f59e0b',
      advice: [
        '关注消费复苏和AI应用落地两条主线，逢低布局优质标的',
        '控制仓位在6-7成，保留现金应对市场波动',
        '关注美联储议息会议节点，提前做好汇率对冲',
        `重点配置：${topFunds[0]?.name || '消费类基金'}、半导体ETF`,
      ],
      risk: '市场情绪波动较大，注意仓位管理'
    },
    {
      type: 'medium',
      title: '中期策略 (3-12个月)',
      color: '#10b981',
      advice: [
        '中国经济温和复苏确定性强，外资回流趋势明显',
        '科技创新和产业升级是核心主线，科技基金可逢跌加仓',
        '美元理财产品可配置20-30%资产，实现汇率分散',
        '关注沪深300及科创50指数的定投机会',
      ],
      risk: '关注全球通胀反复和地缘政治风险'
    },
    {
      type: 'long',
      title: '长期策略 (1-3年)',
      color: '#3b82f6',
      advice: [
        '中国资本市场改革深化，长期看好权益资产配置价值',
        '老龄化主题（医疗、养老）和AI革命是长期大趋势',
        '建议采用核心-卫星策略：60%宽基指数+40%行业主题基金',
        '美元资产配置比例建议提升至家庭金融资产的15-25%',
      ],
      risk: '短期波动是长期投资的成本，保持定投纪律'
    },
    {
      type: 'usd',
      title: '美元现汇投资建议',
      color: '#8b5cf6',
      advice: [
        '美联储降息周期临近，建议锁定当前高利率美元定存/理财',
        '中国银行美元结构性存款年化3.8%-4.5%，保本保息',
        'QDII美元基金可配置美股科技和全球医疗主题，分散单一市场风险',
        '建议美元资产占投资组合15-25%，实现币种多元化',
      ],
      risk: '汇率波动影响实际收益，建议分批兑换'
    }
  ];
}

function generateAIInsights(topFunds) {
  return {
    marketSentiment: seededRandom() > 0.5 ? '谨慎乐观' : '中性偏多',
    aiConfidenceIndex: (seededRandom() * 20 + 65).toFixed(1),
    keyTheme: 'AI+消费双主线驱动',
    prediction: `基于深度学习模型分析，未来1个月A股市场大概率维持震荡上行格局。上证指数核心波动区间3150-3400点。${topFunds[0]?.name || '核心基金'}等消费主题基金有望受益于政策刺激和消费复苏，建议作为进攻型配置。同时关注半导体ETF在国产替代逻辑下的中期布局机会。量化模型显示，当前市场风险溢价处于历史中高水平，权益类资产具备较好的配置性价比。`,
    hotSectors: [
      { name: 'AI应用', momentum: 92, reason: '大模型商业化落地加速，AI+医疗/金融/制造全面开花' },
      { name: '消费复苏', momentum: 85, reason: '政策持续发力，社零数据有望触底反弹' },
      { name: '半导体', momentum: 80, reason: '国家大基金三期+国产替代，长期逻辑清晰' },
      { name: '创新药', momentum: 78, reason: '国际化突破，海外授权交易持续创新高' },
      { name: '新能源', momentum: 72, reason: '海外布局加速，估值处于历史低位' },
    ],
    topPicks: topFunds.map((f, i) => ({
      rank: i + 1,
      name: f.name,
      code: f.code,
      aiScore: (seededRandom() * 15 + 80).toFixed(1),
      reason: f.advice.reason,
      action: f.advice.action,
    })),
    riskWarning: '短期关注：①美联储降息节奏不及预期 ②地缘政治风险升温 ③部分板块估值偏高需警惕回调。建议设置止损纪律，单一基金仓位不超过20%。'
  };
}

// ============ API ROUTES ============

// Cache the last generated data
let cachedData = null;
let lastGenerate = 0;

async function generateFullData(realtimeData) {
  // 生成基金排名（mock），然后尝试融合实时净值
  const topFunds = generateTopFunds(5);
  const fundCodes = topFunds.map(f => f.code);

  let fundNavData = null;
  try {
    fundNavData = await realtimeFundProvider.fetchFundsNAV(fundCodes);
    if (fundNavData && Object.keys(fundNavData).length > 0) {
      // 融合实时净值到基金数据中
      for (const fund of topFunds) {
        const real = fundNavData[fund.code];
        if (real) {
          fund.nav = real.nav;
          fund.todayChange = real.todayChange;
          fund.navPrev = real.navPrev;
          fund.navDate = real.navDate;
          fund.gzTime = real.gzTime;
          fund.source = 'realtime';
        }
      }
      console.log(`  💰 基金净值: ${Object.keys(fundNavData).length}/${fundCodes.length} 只已更新`);
    }
  } catch (err) {
    console.error('  ⚠️ 基金净值获取失败（将使用模拟值）:', err.message);
  }

  // 获取基金历史业绩（近1周/近1月等）
  let fundHistoryData = null;
  try {
    fundHistoryData = await realtimeFundHistoryProvider.fetchFundHistory(fundCodes);
    if (fundHistoryData && Object.keys(fundHistoryData).length > 0) {
      // 融合真实历史业绩到基金数据中
      let merged = 0;
      for (const fund of topFunds) {
        const hist = fundHistoryData[fund.code];
        if (hist) {
          if (hist.week !== null) {
            fund.week = parseFloat(hist.week);
            fund.weekDate = hist.weekDate;
            merged++;
          }
          if (hist.month !== null) {
            fund.month = parseFloat(hist.month);
            fund.monthDate = hist.monthDate;
          }
          if (hist.quarter !== null) {
            fund.quarter = parseFloat(hist.quarter);
          }
          if (hist.halfYear !== null) {
            fund.halfYear = parseFloat(hist.halfYear);
          }
          if (hist.year !== null) {
            fund.year = parseFloat(hist.year);
          }
          if (hist.navHistory && hist.navHistory.length > 10) {
            fund.navHistory = hist.navHistory;
          }
          fund.historySource = hist.source;
        }
      }
      console.log(`  📈 历史业绩: ${merged}/${fundCodes.length} 只已更新`);
    }
  } catch (err) {
    console.error('  ⚠️ 历史业绩获取失败（将使用模拟值）:', err.message);
  }

  // 用真实数据重新生成 AI 分析文本
  for (const fund of topFunds) {
    fund.aiAnalysis = generateDynamicAnalysis(fund);
    fund.advice = generateDynamicAdvice(fund);
  }

  // 获取全球指数
  let globalIndicesData = null;
  try {
    globalIndicesData = await realtimeGlobalIndicesProvider.fetchGlobalIndices();
    if (globalIndicesData && Object.keys(globalIndicesData).length > 0) {
      console.log(`  🌍 全球指数: ${Object.keys(globalIndicesData).length} 个已获取`);
    }
  } catch (err) {
    console.error('  ⚠️ 全球指数获取失败:', err.message);
  }

  // 获取热门板块动量
  let hotSectorsData = null;
  try {
    const sectorsResult = await realtimeHotSectorsProvider.fetchHotSectors();
    if (sectorsResult && sectorsResult.hotSectors && sectorsResult.hotSectors.length > 0) {
      hotSectorsData = sectorsResult;
      console.log(`  🔥 板块动量: ${sectorsResult.hotSectors.length} 个已更新 (${sectorsResult.sentiment})`);
    }
  } catch (err) {
    console.error('  ⚠️ 板块动量获取失败（将使用模拟值）:', err.message);
  }

  // 获取实时快讯新闻（华尔街见闻）
  let realtimeNews = null;
  try {
    realtimeNews = await realtimeNewsProvider.fetchNews();
    if (realtimeNews && realtimeNews.length > 0) {
      console.log(`  📰 实时新闻: ${realtimeNews.length} 条已获取`);
    }
  } catch (err) {
    console.error('  ⚠️ 实时新闻获取失败（将使用模拟值）:', err.message);
  }

  // 生成市场概览（A股指数 + 全球指数）
  const marketOverview = generateMarketOverview(realtimeData || {});
  // 合并全球指数
  if (globalIndicesData) {
    for (const [name, info] of Object.entries(globalIndicesData)) {
      marketOverview[name] = {
        value: info.value,
        change: info.change,
        changePercent: info.changePercent,
        trend: info.trend,
        source: 'realtime',
        source_quality: info.source_quality,
      };
    }
  }

  const data = {
    timestamp: new Date().toISOString(),
    marketOverview: marketOverview,
    topFunds: topFunds,
    usdProducts: usdProducts,
    globalNews: realtimeNews && realtimeNews.length >= 4 ? realtimeNews : generateGlobalNews(),
    investmentAdvice: generateInvestmentAdvice(topFunds),
    aiInsights: (() => {
      const insights = generateAIInsights(topFunds);
      // 替换热门板块为真实数据
      if (hotSectorsData && hotSectorsData.hotSectors && hotSectorsData.hotSectors.length >= 3) {
        insights.hotSectors = hotSectorsData.hotSectors;
        insights.marketSentiment = hotSectorsData.sentiment;
        // 更新预测摘要加入板块信息
        insights.prediction = `基于真实板块数据，当前市场情绪${hotSectorsData.sentiment}。${
          hotSectorsData.hotSectors[0]?.name || '热门板块'
        }板块表现最为活跃，短期可重点关注。量化模型显示，市场风险溢价处于历史中高水平，权益类资产具备较好的配置性价比。`;
      }
      return insights;
    })(),
    _meta: {
      generated_at: new Date().toISOString(),
      indices_source: realtimeData?.indices ? 'realtime' : 'mock',
      indices_quality: realtimeData?.indices
        ? Object.values(realtimeData.indices).some(v => v.source_quality === 'cross_validated')
          ? 'cross_validated'
          : 'single_source'
        : 'fallback_mock',
      global_indices_source: globalIndicesData && Object.keys(globalIndicesData).length > 0 ? 'realtime' : 'mock',
      sectors_source: hotSectorsData && hotSectorsData.hotSectors?.length >= 3 ? 'realtime' : 'mock',
      funds_source: fundNavData && Object.keys(fundNavData).length > 0 ? 'realtime' : 'mock',
      funds_history_source: fundHistoryData && Object.values(fundHistoryData).some(v => v.week !== null) ? 'realtime' : 'mock',
      news_source: realtimeNews && realtimeNews.length >= 4 ? 'realtime' : 'mock',
    },
    // 各数据组的新鲜度（秒）
    _age: {
      indices: realtimeData?.timestamp ? Math.round((Date.now() - new Date(realtimeData.timestamp).getTime()) / 1000) : -1,
      funds: fundNavData ? 0 : -1,
      fund_history: fundHistoryData ? 0 : -1,
      global_indices: globalIndicesData ? 0 : -1,
      sectors: hotSectorsData ? 0 : -1,
      news: realtimeNews ? 0 : -1,
      generated: 0,
    },
  };
  cachedData = data;
  lastGenerate = Date.now();
  return data;
}

// Initialize: load realtime data + start auto-refresh
async function initialize() {
  try {
    // 启动实时数据源的定时刷新
    realtimeManager.startAutoRefresh();
    // 首次拉取实时数据
    const realtimeData = await realtimeManager.forceRefresh();
    await generateFullData(realtimeData);
    console.log(`[${new Date().toISOString()}] ✅ 实时数据初始化完成`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ⚠️ 实时数据初始化失败，使用模拟数据:`, err.message);
    await generateFullData();
  }
}

initialize();

// 定期全量刷新（每120秒）
setInterval(async () => {
  try {
    // 强制刷新：清除所有缓存
    cache.invalidateAll();
    const realtimeData = await realtimeManager.forceRefresh();
    await generateFullData(realtimeData);
    console.log(`[${new Date().toISOString()}] 🔄 数据已更新 (指数: ${realtimeData?.indices ? '实时' : '模拟'})`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] 数据刷新失败:`, err.message);
  }
}, 2 * 60 * 1000);

// API endpoint — 返回完整数据
app.get('/api/data', async (req, res) => {
  try {
    if (req.query.refresh === 'true') {
      // 强制刷新：清除缓存 + 重新拉取实时数据 + 重新生成衍生数据
      cache.invalidateAll();
      const realtimeData = await realtimeManager.forceRefresh();
      const data = await generateFullData(realtimeData);
      return res.json(data);
    }
    res.json(cachedData);
  } catch (err) {
    console.error('API /api/data error:', err.message);
    // 出错时返回缓存（如果有）或降级 mock
    if (cachedData) return res.json(cachedData);
    const data = await generateFullData();
    return res.json(data);
  }
});

// 缓存状态 — 查看各数据源缓存命中率
app.get('/api/cache', (req, res) => {
  res.json(cache.stats());
});

// 清除缓存
app.post('/api/cache/flush', (req, res) => {
  cache.invalidateAll();
  res.json({ ok: true, message: '缓存已清除' });
});

// Debug endpoint — 查看各数据源原始返回
app.get('/api/debug', async (req, res) => {
  try {
    const realtimeData = await realtimeManager.getData();
    res.json({
      timestamp: new Date().toISOString(),
      indices: realtimeData.indices,
      fx: realtimeData.fx,
      raw: {
        sina: realtimeData.raw?.sina ? '[已获取]' : '[未获取]',
        tencent: realtimeData.raw?.tencent ? '[已获取]' : '[未获取]',
        eastmoney: realtimeData.raw?.eastmoney ? '[已获取]' : '[未获取]',
      },
      _meta: cachedData?._meta || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const meta = cachedData?._meta || {};
  res.json({
    status: 'ok',
    lastUpdate: cachedData?.timestamp || null,
    indicesSource: meta.indices_source || 'unknown',
    indicesQuality: meta.indices_quality || 'unknown',
    globalIndicesSource: meta.global_indices_source || 'mock',
    sectorsSource: meta.sectors_source || 'mock',
    fundsSource: meta.funds_source || 'mock',
    fundsHistorySource: meta.funds_history_source || 'mock',
    newsSource: meta.news_source || 'mock',
    realtimeProviders: '新浪财经 + 腾讯财经 + 东方财富(指数+全球) + 天天基金(净值+历史) + 华尔街见闻(新闻)',
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  🔮 Investment Assistant Server`);
  console.log(`  ─────────────────────────────`);
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log(`  📊 API: http://localhost:${PORT}/api/data`);
  console.log(`  🔍 Debug: http://localhost:${PORT}/api/debug`);
  console.log(`  📡 A股指数: 新浪+腾讯+东方财富 (交叉验证)`);
  console.log(`  🌍 全球指数: 东方财富+新浪 (恒生/美股/日经/黄金/原油)`);
  console.log(`  💰 基金数据: 天天基金 (净值+全周期历史)`);
  console.log(`  📰 实时新闻: 华尔街见闻 (关键字情绪分析)`);
  console.log(`  ⏰ 自动刷新: 每2分钟\n`);
});
