// ============ Investment Assistant - Frontend Application ============
const App = {
  data: null,
  fetchTimer: null,
  countdownTimer: null,
  countdownSeconds: 300,
  remainingSeconds: 300,
  isRefreshing: false,
  currentSection: 'dashboard',
  portfolio: [],

  // DOM Cache
  els: {},

  init() {
    this.cacheElements();
    this.bindEvents();
    this.loadPortfolio();
    this.initScrollSpy();
    this.startAutoRefresh();
    this.fetchData().then(() => {
      this.renderAll();
    });
    this.animateCountdown();
  },

  cacheElements() {
    this.els = {
      // Main containers
      content: document.getElementById('mainContent'),
      dataUpdated: document.getElementById('dataUpdated'),
      
      // Header
      updateTime: document.getElementById('updateTime'),
      timerDisplay: document.getElementById('timerDisplay'),
      countdownFill: document.querySelector('.countdown-bar .fill'),
      
      // Navigation
      navItems: document.querySelectorAll('.nav-item[data-section]'),
      mobileToggle: document.getElementById('mobileNavToggle'),
      sidebar: document.querySelector('.sidebar'),
      sidebarOverlay: document.getElementById('sidebarOverlay'),
      
      // Loading
      loadingOverlay: document.getElementById('loadingOverlay'),
    };
  },

  bindEvents() {
    // Section navigation
    this.els.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const section = item.dataset.section;
        this.switchSection(section);
        this.closeMobileNav();
      });
    });

    // Mobile nav toggle
    if (this.els.mobileToggle) {
      this.els.mobileToggle.addEventListener('click', () => {
        this.els.sidebar.classList.toggle('open');
        this.els.sidebarOverlay.classList.toggle('show');
      });
    }
    if (this.els.sidebarOverlay) {
      this.els.sidebarOverlay.addEventListener('click', () => {
        this.closeMobileNav();
      });
    }

    // Manual refresh
    document.querySelectorAll('.nav-item.refresh-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.manualRefresh();
      });
    });

    // Resize handler
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        this.els.sidebar.classList.remove('open');
        if (this.els.sidebarOverlay) this.els.sidebarOverlay.classList.remove('show');
      }
    });
  },

  closeMobileNav() {
    this.els.sidebar.classList.remove('open');
    if (this.els.sidebarOverlay) this.els.sidebarOverlay.classList.remove('show');
  },

  switchSection(sectionId) {
    this.currentSection = sectionId;
    
    // Update nav active state
    this.els.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // Scroll to section
    const sectionEl = document.getElementById(`section-${sectionId}`);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  // ============ DATA FETCHING ============

  async fetchData(showLoading = false) {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      if (showLoading && this.els.loadingOverlay) {
        this.els.loadingOverlay.style.display = 'flex';
      }

      const resp = await fetch('/api/data');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.data = await resp.json();

      // Update timestamp
      const ts = new Date(this.data.timestamp);
      this.els.updateTime.textContent = ts.toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      // Show updated notification
      this.showDataUpdated();

      // Reset countdown
      this.remainingSeconds = this.countdownSeconds;

    } catch (err) {
      console.error('Fetch error:', err);
      this.showToast('数据获取失败，请检查网络连接', 'error');
    } finally {
      this.isRefreshing = false;
      if (this.els.loadingOverlay) {
        this.els.loadingOverlay.style.display = 'none';
      }
    }
  },

  async manualRefresh() {
    const btn = document.querySelector('.nav-item.refresh-btn i');
    if (btn) btn.classList.add('refresh-spin');
    await this.fetchData(true);
    this.renderAll();
    if (btn) btn.classList.remove('refresh-spin');
    this.showToast('数据已刷新 ✓', 'success');
  },

  showDataUpdated() {
    const el = this.els.dataUpdated;
    el.classList.add('show');
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => el.classList.remove('show'), 2000);
  },

  showToast(msg, type = 'info') {
    // Simple toast using the data-updated element
    const el = this.els.dataUpdated;
    el.textContent = msg;
    el.style.background = type === 'error' ? 'var(--accent-red)' : type === 'success' ? 'var(--accent-green)' : 'var(--accent-blue)';
    el.classList.add('show');
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => el.classList.remove('show'), 2500);
  },

  // ============ AUTO REFRESH ============

  startAutoRefresh() {
    this.fetchTimer = setInterval(() => {
      this.fetchData().then(() => this.renderAll());
    }, this.countdownSeconds * 1000);
  },

  animateCountdown() {
    this.countdownTimer = setInterval(() => {
      this.remainingSeconds--;
      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = this.countdownSeconds;
      }
      const mins = Math.floor(this.remainingSeconds / 60);
      const secs = this.remainingSeconds % 60;
      this.els.timerDisplay.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }, 1000);
  },

  // ============ RENDER ENGINE ============

  renderAll() {
    if (!this.data) return;
    
    this.renderMarketOverview();
    this.renderGlobalIndices();
    this.renderTopFunds();
    this.renderAIAnalysis();
    this.renderGlobalNews();
    this.renderInvestmentAdvice();
    this.renderUSDProducts();
    this.renderAIInsights();
    this.renderNewsTicker();
    this.renderPortfolio();
  },

  // --- Market Overview ---
  renderMarketOverview() {
    const container = document.getElementById('marketCards');
    if (!container || !this.data.marketOverview) return;

    // A 股核心指数
    const aShareIndices = ['上证指数','深证成指','沪深300','创业板指','科创50','美元/人民币'];
    const entries = Object.entries(this.data.marketOverview).filter(([name]) => aShareIndices.includes(name));

    container.innerHTML = entries.map(([name, info]) => {
      const isRealtime = info.source === 'realtime';
      const isCrossValidated = info.source_quality === 'cross_validated';
      const badgeLabel = isCrossValidated ? '三源验证' : isRealtime ? '实时' : '模拟';
      const badgeClass = isCrossValidated ? 'badge-green' : isRealtime ? 'badge-blue' : 'badge-gray';
      const pct = parseFloat(info.changePercent) || 0;
      const barWidth = Math.min(100, Math.abs(pct) * 10);
      return `
        <div class="card market-card fade-in">
          <div class="market-badge ${badgeClass}">${badgeLabel}</div>
          <div class="index-name">${name}</div>
          <div class="index-value">${info.value}</div>
          <div class="index-change ${info.trend}">
            <i class="fas fa-${info.trend === 'up' ? 'arrow-up' : 'arrow-down'}"></i>
            ${info.trend === 'up' ? '+' : ''}${info.change} (${info.changePercent}%)
          </div>
          <div class="trend-bar"><div class="trend-fill ${info.trend}" style="width:${barWidth}%"></div></div>
        </div>
      `;
    }).join('');
  },

  // --- Global Indices ---
  renderGlobalIndices() {
    const container = document.getElementById('globalMarketCards');
    if (!container || !this.data.marketOverview) return;

    // 全球指数列表（排除 A 股核心指数和汇率）
    const aShareIndices = ['上证指数','深证成指','沪深300','创业板指','科创50','美元/人民币'];
    const globalEntries = Object.entries(this.data.marketOverview).filter(
      ([name]) => !aShareIndices.includes(name)
    );

    if (globalEntries.length === 0) {
      container.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-tertiary);"><i class="fas fa-globe"></i> 暂无全球指数数据</div>';
      return;
    }

    container.innerHTML = globalEntries.map(([name, info]) => {
      const badgeLabel = '实时';
      const badgeClass = 'badge-blue';
      const pct = parseFloat(info.changePercent) || 0;
      const barWidth = Math.min(100, Math.abs(pct) * 10);
      return `
        <div class="card market-card fade-in">
          <div class="market-badge ${badgeClass}">${badgeLabel}</div>
          <div class="index-name">${name}</div>
          <div class="index-value">${info.value}</div>
          <div class="index-change ${info.trend}">
            <i class="fas fa-${info.trend === 'up' ? 'arrow-up' : 'arrow-down'}"></i>
            ${info.trend === 'up' ? '+' : ''}${info.change} (${info.changePercent}%)
          </div>
          <div class="trend-bar"><div class="trend-fill ${info.trend}" style="width:${barWidth}%"></div></div>
        </div>
      `;
    }).join('');
  },

  // --- Top 5 Funds ---
  renderTopFunds() {
    const container = document.getElementById('topFunds');
    if (!container || !this.data.topFunds) return;

    container.innerHTML = this.data.topFunds.map((fund, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
      const actionClass = fund.advice.action.includes('买入') ? 'buy' : fund.advice.action.includes('持有') || fund.advice.action.includes('加仓') ? 'hold' : 'watch';
      const isRealtime = fund.source === 'realtime';
      const fundBadge = isRealtime ? '<span class="fund-source-badge">实时净值</span>' : '';
      const navDateInfo = fund.navDate ? `<span style="font-size:11px;color:var(--text-tertiary);margin-left:6px;">${fund.navDate}</span>` : '';
      
      return `
        <div class="card fund-card fade-in stagger-${i+1}" onclick="App.openFundDetail(${i})">
          <div class="fund-rank ${rankClass}">${fund.rank}</div>
          <div class="fund-body">
            <div class="fund-header">
              <div class="fund-name">
                ${fund.name}
                <span class="fund-code">${fund.code} · ${fund.type} · ${fund.fundSize}</span>
                ${fundBadge}
              </div>
              <div class="fund-rating">${'★'.repeat(fund.rating)}${'☆'.repeat(5-fund.rating)}</div>
            </div>
            <div class="fund-stats">
              <div class="fund-stat">
                <div class="label">今日 <span style="font-size:10px;color:var(--text-tertiary);">实时</span></div>
                <div class="value ${parseFloat(fund.todayChange) >= 0 ? 'up' : 'down'}">
                  ${parseFloat(fund.todayChange) >= 0 ? '+' : ''}${fund.todayChange}%
                </div>
              </div>
              <div class="fund-stat">
                <div class="label">近1周</div>
                <div class="value ${fund.week >= 0 ? 'up' : 'down'}">${fund.week >= 0 ? '+' : ''}${fund.week}%</div>
              </div>
              <div class="fund-stat">
                <div class="label">近1月</div>
                <div class="value ${fund.month >= 0 ? 'up' : 'down'}">${fund.month >= 0 ? '+' : ''}${fund.month}%</div>
              </div>
              <div class="fund-stat">
                <div class="label">近1年</div>
                <div class="value ${fund.year >= 0 ? 'up' : 'down'}">${fund.year >= 0 ? '+' : ''}${fund.year}%</div>
              </div>
            </div>
            <div class="fund-sparkline">
              ${fund.navHistory ? renderSparkline(fund.navHistory, 140, 36) : ''}
            </div>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
              <strong style="color:var(--accent-cyan);">AI综合评分：${fund.score}/100</strong> · 
              风险等级：${fund.risk} · 策略：${fund.focus}
              ${navDateInfo}
            </div>
          </div>
          <div class="fund-action">
            <span class="action-tag ${actionClass}">${fund.advice.action}</span>
            <span class="confidence">${fund.advice.confidence} ${fund.advice.target}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  // --- AI Analysis ---
  renderAIAnalysis() {
    const container = document.getElementById('aiAnalysis');
    if (!container || !this.data.topFunds) return;

    container.innerHTML = this.data.topFunds.map((fund, i) => `
      <div class="card ai-analysis fade-in stagger-${i+1}" style="margin-bottom:12px;">
        <div class="ai-header">
          <i class="fas fa-robot" style="color:var(--accent-cyan);font-size:16px;"></i>
          <strong style="font-size:14px;">TOP ${fund.rank} · ${fund.name}</strong>
          <span class="ai-badge">AI深度分析</span>
        </div>
        <div class="ai-body">
          ${fund.aiAnalysis}
        </div>
        <div class="ai-footer">
          <i class="far fa-clock"></i>
          分析基于多因子模型 + 舆情NLP + 技术面量化
          <span style="margin-left:auto;color:var(--accent-green);">
            <i class="fas fa-chart-line"></i> 置信度${fund.score}%
          </span>
        </div>
      </div>
    `).join('');
  },

  // --- Global News ---
  renderGlobalNews() {
    const container = document.getElementById('globalNews');
    if (!container || !this.data.globalNews) return;

    const isRealtime = this.data._meta?.news_source === 'realtime';
    const newsBadge = isRealtime ? '<span class="news-source-badge">实时快讯</span>' : '';

    container.innerHTML = this.data.globalNews.map((news, i) => {
      const impactClass = news.impact.includes('利好') ? '利好' : news.impact.includes('利空') ? '利空' : news.impact.includes('中性') ? '中性' : '中性';
      const highlightClass = news.impact.includes('利好') && i < 2 ? 'news-highlight' : news.impact.includes('利空') ? 'news-warning' : '';
      
      return `
        <div class="card news-card fade-in stagger-${Math.min(i+1, 5)} ${highlightClass}"
             onclick="App.openNewsDetail(${i})" style="cursor:pointer;">
          <div class="news-header">
            <span class="news-impact ${impactClass}">${news.impact}</span>
            <div style="flex:1;">
              <div class="news-topic">${news.topic}</div>
            </div>
            ${newsBadge}
          </div>
          <p class="news-detail">${news.detail}</p>
          <div class="news-sectors">
            ${news.affectedSectors.map(s => `<span class="sector-tag">${s}</span>`).join('')}
          </div>
          <div class="news-meta">
            <span><i class="far fa-building"></i> ${news.source}</span>
            <span><i class="far fa-clock"></i> ${news.time}</span>
            <span><i class="far fa-calendar"></i> ${news.date}</span>
            ${news.uri ? `<span><i class="fas fa-external-link-alt"></i> <a href="${news.uri}" target="_blank" onclick="event.stopPropagation();" style="color:var(--accent-cyan);text-decoration:none;">查看原文</a></span>` : ''}
          </div>
          <div class="news-click-hint">
            <i class="fas fa-chevron-right"></i> 点击查看深度分析
          </div>
        </div>
      `;
    }).join('');
  },

  // --- Investment Advice ---
  renderInvestmentAdvice() {
    const container = document.getElementById('investmentAdvice');
    if (!container || !this.data.investmentAdvice) return;

    container.innerHTML = this.data.investmentAdvice.map((advice, i) => `
      <div class="card advice-card fade-in stagger-${i+1}">
        <div class="advice-type-bar" style="background:${advice.color};"></div>
        <div class="advice-title" style="padding-left:8px;">
          <i class="fas fa-${advice.type === 'short' ? 'bolt' : advice.type === 'medium' ? 'chart-line' : advice.type === 'long' ? 'bullseye' : 'shield-alt'}" 
             style="color:${advice.color};"></i>
          ${advice.title}
        </div>
        <ul>
          ${advice.advice.map(a => `<li>${a}</li>`).join('')}
        </ul>
        ${advice.risk ? `
          <div class="advice-risk">
            <i class="fas fa-exclamation-triangle"></i>
            ${advice.risk}
          </div>
        ` : ''}
      </div>
    `).join('');
  },

  // --- USD Products ---
  renderUSDProducts() {
    const container = document.getElementById('usdProducts');
    if (!container || !this.data.usdProducts) return;

    container.innerHTML = this.data.usdProducts.map((p, i) => {
      const riskClass = p.risk.includes('低') || p.risk.includes('极') ? 'risk-low' : p.risk.includes('中') && !p.risk.includes('低') ? 'risk-mid' : 'risk-high';
      return `
        <div class="card usd-card fade-in stagger-${i+1}">
          <div class="usd-bank"><i class="fas fa-university"></i> ${p.bank}</div>
          <div class="usd-name">${p.name}</div>
          <div class="usd-details">
            <span class="detail-tag">${p.type}</span>
            <span class="detail-tag">${p.term}</span>
            <span class="detail-tag yield">${p.yield}</span>
            <span class="detail-tag ${riskClass}">${p.risk}风险</span>
            <span class="detail-tag">起购${p.minAmount}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  // --- AI Insights ---
  renderAIInsights() {
    const container = document.getElementById('aiInsights');
    if (!container || !this.data.aiInsights) return;

    const insights = this.data.aiInsights;
    const sentClass = insights.marketSentiment.includes('乐观') || insights.marketSentiment.includes('偏多') 
      ? 'positive' : insights.marketSentiment.includes('谨慎') ? 'neutral' : 'negative';

    container.innerHTML = `
      <div class="card insight-card fade-in">
        <div class="insight-header">
          <i class="fas fa-brain" style="font-size:24px;color:var(--accent-cyan);"></i>
          <div>
            <div style="font-size:16px;font-weight:600;">AI市场研判</div>
            <div style="font-size:13px;color:var(--text-secondary);">
              综合信心指数: <strong style="color:var(--accent-green);">${insights.aiConfidenceIndex}%</strong>
            </div>
          </div>
          <span class="sentiment-badge ${sentClass}" style="margin-left:auto;">
            <i class="fas fa-${sentClass === 'positive' ? 'smile' : sentClass === 'neutral' ? 'meh' : 'frown'}"></i>
            ${insights.marketSentiment}
          </span>
        </div>

        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">
          <i class="fas fa-bullhorn" style="color:var(--accent-orange);"></i>
          核心主题: ${insights.keyTheme}
        </div>

        <div class="insight-prediction">
          <i class="fas fa-robot" style="color:var(--accent-cyan);margin-right:8px;"></i>
          ${insights.prediction}
        </div>

        <div style="margin-bottom:8px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:10px;">
            <i class="fas fa-fire" style="color:var(--accent-orange);"></i>
            热门板块动量排行
          </div>
          <div class="hot-sectors">
            ${insights.hotSectors.map(s => `
              <div class="hot-sector">
                <div class="sector-name">${s.name}</div>
                <div class="sector-momentum">动量指数: ${s.momentum}/100</div>
                <div class="momentum-bar">
                  <div class="fill" style="width:${s.momentum}%;"></div>
                </div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">${s.reason}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:10px;">
            <i class="fas fa-trophy" style="color:var(--accent-orange);"></i>
            AI精选TOP 5推荐
          </div>
          ${insights.topPicks.map(pick => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;margin-bottom:6px;background:rgba(255,255,255,0.03);border-radius:8px;">
              <span style="font-weight:700;color:var(--accent-cyan);font-size:13px;width:24px;">#${pick.rank}</span>
              <span style="flex:1;font-size:13px;font-weight:500;">${pick.name}</span>
              <span style="font-size:12px;color:var(--accent-green);font-weight:600;">${pick.aiScore}分</span>
              <span style="font-size:12px;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.1);color:var(--accent-green);">${pick.action}</span>
            </div>
          `).join('')}
        </div>

        <div class="insight-risk">
          <i class="fas fa-shield-alt"></i>
          <div>
            <strong>风险提示：</strong>${insights.riskWarning}
          </div>
        </div>
      </div>
    `;
  },

  // --- News Ticker (自动滚动) ---
  renderNewsTicker() {
    const container = document.getElementById('newsTicker');
    if (!container || !this.data.globalNews) return;

    const items = this.data.globalNews.slice(0, 8).map((news, i) => {
      const dotColor = news.impact.includes('利好') ? 'green' : news.impact.includes('利空') ? 'red' : 'orange';
      return `
        <span class="ticker-item" onclick="App.openNewsDetail(${i})" title="点击查看详情">
          <span class="ticker-dot ${dotColor}"></span>
          ${news.topic}
        </span>
      `;
    });

    // 复制一份实现无缝滚动
    container.innerHTML = `
      <div class="ticker-track">
        <div class="ticker-group">${items.join('')}</div>
        <div class="ticker-group">${items.join('')}</div>
      </div>
    `;
  },

  // ============ NEWS DETAIL MODAL ============

  openNewsDetail(index) {
    const news = this.data.globalNews[index];
    if (!news) return;

    const modal = document.getElementById('newsModal');
    const body = document.getElementById('newsModalBody');

    const impactClass = news.impact.includes('利好') ? '利好' : news.impact.includes('利空') ? '利空' : '中性';
    const impactIcon = impactClass === '利好' ? 'arrow-up' : impactClass === '利空' ? 'arrow-down' : 'minus';
    const impactColor = impactClass === '利好' ? 'var(--accent-green)' : impactClass === '利空' ? 'var(--accent-red)' : 'var(--accent-orange)';

    body.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <span class="news-impact ${impactClass}" style="font-size:14px;padding:4px 14px;">${news.impact}</span>
          <span style="font-size:12px;color:var(--text-tertiary);"><i class="far fa-building"></i> ${news.source} · ${news.time}</span>
        </div>
        <div style="font-size:22px;font-weight:700;margin-bottom:8px;">${news.topic}</div>
        <div style="font-size:13px;color:var(--text-secondary);"><i class="far fa-calendar"></i> ${news.date}</div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:${impactColor};">
          <i class="fas fa-${impactIcon}"></i> 市场影响分析
        </div>
        <div style="font-size:14px;line-height:1.9;color:var(--text-secondary);padding:16px;background:rgba(0,0,0,0.15);border-radius:8px;border-left:3px solid ${impactColor};">
          ${news.detail}
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px;">
          <i class="fas fa-tags" style="color:var(--accent-cyan);"></i> 受影响板块
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${news.affectedSectors.map(s => `<span style="padding:6px 14px;border-radius:20px;font-size:13px;background:rgba(59,130,246,0.1);color:var(--accent-blue);border:1px solid rgba(59,130,246,0.15);">${s}</span>`).join('')}
        </div>
      </div>

      <div style="margin-bottom:16px;padding:16px;background:rgba(16,185,129,0.05);border-radius:8px;border:1px solid rgba(16,185,129,0.12);">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">
          <i class="fas fa-robot" style="color:var(--accent-cyan);"></i> AI 策略建议
        </div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.7;">
          ${impactClass === '利好' 
            ? '该消息对市场形成正面催化，建议关注相关板块龙头标的的布局机会。可适当增加配置比例，但需注意短期情绪过热风险。建议结合技术面确认入场时机。'
            : impactClass === '利空' 
              ? '该消息对市场形成短期压力，建议降低相关板块仓位或使用对冲工具。等待风险充分释放后再考虑介入，关注政策面可能出台的缓冲措施。'
              : '该消息对市场影响中性，建议维持当前配置不变。关注后续进展，等待更明确的信号出现后再做调整。'}
        </div>
      </div>

      <div style="font-size:12px;color:var(--text-tertiary);padding-top:12px;border-top:1px solid var(--border-color);">
        <i class="fas fa-info-circle"></i> AI分析基于NLP情感分析模型，仅供参考，不构成投资建议。
        ${news.uri ? `<span style="margin-left:12px;"><a href="${news.uri}" target="_blank" style="color:var(--accent-cyan);">查看原文 <i class="fas fa-external-link-alt"></i></a></span>` : ''}
      </div>
    `;

    modal.classList.add('show');
  },

  closeNewsModal() {
    document.getElementById('newsModal').classList.remove('show');
  },

  // ============ FUND DETAIL MODAL ============

  openFundDetail(index) {
    const fund = this.data.topFunds[index];
    if (!fund) return;

    const modal = document.getElementById('fundModal');
    const body = document.getElementById('fundModalBody');

    var h = '';

    // Header
    h += '<div style="margin-bottom:20px;">';
    h += '<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px;">' + fund.code + ' · ' + fund.type + '</div>';
    h += '<div style="font-size:20px;font-weight:700;margin-bottom:4px;">' + fund.name + '</div>';
    h += '<div style="display:flex;gap:12px;font-size:13px;color:var(--text-secondary);">';
    h += '<span>规模: ' + fund.fundSize + '</span>';
    h += '<span>风险: ' + fund.risk + '</span>';
    h += '<span>策略: ' + fund.focus + '</span>';
    h += '<span>AI评分: <strong style="color:var(--accent-green);">' + fund.score + '/100</strong></span>';
    h += '</div></div>';

    // Stats grid
    var todayColor = parseFloat(fund.todayChange) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    var todaySign = parseFloat(fund.todayChange) >= 0 ? '+' : '';
    var weekColor = fund.week >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    var weekSign = fund.week >= 0 ? '+' : '';
    var yearColor = fund.year >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    var yearSign = fund.year >= 0 ? '+' : '';
    var yearVal = fund.year || 0;

    h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">';
    h += '<div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;"><div style="font-size:12px;color:var(--text-tertiary);">单位净值</div><div style="font-size:22px;font-weight:700;color:var(--accent-cyan);">' + fund.nav + '</div></div>';
    h += '<div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;"><div style="font-size:12px;color:var(--text-tertiary);">今日涨跌</div><div style="font-size:22px;font-weight:700;color:' + todayColor + '">' + todaySign + fund.todayChange + '%</div></div>';
    h += '<div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;"><div style="font-size:12px;color:var(--text-tertiary);">近1周</div><div style="font-size:18px;font-weight:600;color:' + weekColor + '">' + weekSign + fund.week + '%</div></div>';
    h += '<div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;"><div style="font-size:12px;color:var(--text-tertiary);">近1年</div><div style="font-size:18px;font-weight:600;color:' + yearColor + '">' + yearSign + yearVal + '%</div></div>';
    h += '</div>';

    // Chart section
    if (fund.navHistory) {
      h += '<div style="margin-bottom:20px;">';
      h += '<div style="font-size:14px;font-weight:600;margin-bottom:8px;"><i class="fas fa-chart-line" style="color:var(--accent-green);"></i> 净值走势（近60个交易日）</div>';
      h += '<div style="background:rgba(0,0,0,0.15);border-radius:8px;padding:12px;">';
      h += renderDetailedChart(fund.navHistory, fund.name);
      h += '</div></div>';
    }

    // AI Analysis
    h += '<div style="margin-bottom:20px;">';
    h += '<div style="font-size:14px;font-weight:600;margin-bottom:8px;"><i class="fas fa-robot" style="color:var(--accent-cyan);"></i> AI深度分析</div>';
    h += '<div style="font-size:14px;line-height:1.8;color:var(--text-secondary);padding:12px;background:rgba(0,0,0,0.15);border-radius:8px;border-left:3px solid var(--accent-cyan);">' + fund.aiAnalysis + '</div>';
    h += '</div>';

    // Advice
    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-size:14px;font-weight:600;margin-bottom:8px;"><i class="fas fa-lightbulb" style="color:var(--accent-orange);"></i> 投资建议</div>';
    h += '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(16,185,129,0.05);border-radius:8px;border:1px solid rgba(16,185,129,0.15);">';
    h += '<span style="padding:4px 12px;border-radius:20px;font-weight:600;font-size:13px;background:rgba(16,185,129,0.15);color:var(--accent-green);">' + fund.advice.action + '</span>';
    h += '<span style="font-size:13px;color:var(--text-secondary);flex:1;">' + fund.advice.reason + '</span>';
    h += '<span style="font-size:13px;color:var(--accent-orange);">' + fund.advice.confidence + '</span>';
    h += '</div></div>';

    // Disclaimer
    h += '<div style="font-size:12px;color:var(--text-tertiary);padding-top:12px;border-top:1px solid var(--border-color);">';
    h += '<i class="fas fa-info-circle"></i> 以上分析仅供参考，不构成投资建议。基金有风险，投资需谨慎。</div>';

    body.innerHTML = h;

    modal.classList.add('show');
  },

  closeFundModal() {
    document.getElementById('fundModal').classList.remove('show');
  },

  // ============ SCROLL SPY ============

  initScrollSpy() {
    const sectionEls = document.querySelectorAll('.section[id^="section-"]');
    if (!sectionEls.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id.replace('section-', '');
          this.currentSection = sectionId;
          this.updateNavActive(sectionId);
        }
      });
    }, { threshold: 0.25, rootMargin: '-60px 0px -40% 0px' });

    sectionEls.forEach(s => observer.observe(s));
  },

  updateNavActive(sectionId) {
    this.els.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.section === sectionId);
    });
  },

  // ============ PORTFOLIO ============

  loadPortfolio() {
    try {
      const saved = localStorage.getItem('investment_portfolio');
      this.portfolio = saved ? JSON.parse(saved) : [];
    } catch {
      this.portfolio = [];
    }
  },

  savePortfolio() {
    localStorage.setItem('investment_portfolio', JSON.stringify(this.portfolio));
  },

  findFundByCode(code) {
    if (!this.data || !this.data.topFunds) return null;
    // 精确匹配 fund code
    const exact = this.data.topFunds.find(f => f.code === code);
    if (exact) return { ...exact, currentNav: parseFloat(exact.nav) };

    // 模糊匹配 fundTemplate 数据（从 server 端完整列表）
    // 也检查所有全球市场指数
    if (this.data.marketOverview) {
      for (const [name, info] of Object.entries(this.data.marketOverview)) {
        if (name.includes(code) || code.includes(name)) {
          return { name, code: '--', currentNav: parseFloat(info.value), nav: info.value, isIndex: true, trend: info.trend };
        }
      }
    }
    return null;
  },

  addPortfolioItem() {
    const codeInput = document.getElementById('portfolioCodeInput');
    const priceInput = document.getElementById('portfolioPriceInput');
    const sharesInput = document.getElementById('portfolioSharesInput');

    const code = codeInput.value.trim();
    const price = parseFloat(priceInput.value);
    const shares = parseFloat(sharesInput.value);

    if (!code) {
      this.showToast('请输入基金/股票代码', 'error');
      return;
    }
    if (!price || price <= 0) {
      this.showToast('请输入有效的买入价格', 'error');
      return;
    }
    if (!shares || shares <= 0) {
      this.showToast('请输入有效的持有份额', 'error');
      return;
    }

    // 检查是否已添加
    if (this.portfolio.some(p => p.code === code && p.purchasePrice === price)) {
      this.showToast('该持仓已存在，请勿重复添加', 'error');
      return;
    }

    // 查找匹配的基金信息
    const matched = this.findFundByCode(code);

    this.portfolio.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      code: code,
      name: matched ? matched.name : code + '(未匹配)',
      purchasePrice: price,
      shares: shares,
      addedAt: new Date().toISOString(),
      matchedCode: matched ? matched.code : null,
      isIndex: matched ? matched.isIndex : false,
    });

    this.savePortfolio();
    this.renderPortfolio();

    // 清空输入
    codeInput.value = '';
    priceInput.value = '';
    sharesInput.value = '';

    this.showToast('✅ ' + code + ' 已添加到投资组合', 'success');

    // 滚动到组合列表
    document.getElementById('section-portfolio').scrollIntoView({ behavior: 'smooth' });
  },

  removePortfolioItem(id) {
    if (!confirm('确定移除此持仓？')) return;
    this.portfolio = this.portfolio.filter(p => p.id !== id);
    this.savePortfolio();
    this.renderPortfolio();
    this.showToast('已移除', 'success');
  },

  renderPortfolio() {
    const listContainer = document.getElementById('portfolioList');
    const countEl = document.getElementById('portfolioCount');
    const analysisSection = document.getElementById('portfolioAnalysis');
    if (!listContainer) return;

    countEl.textContent = this.portfolio.length;

    if (this.portfolio.length === 0) {
      listContainer.innerHTML = `
        <div class="card" style="text-align:center;padding:40px;color:var(--text-tertiary);">
          <i class="fas fa-inbox" style="font-size:40px;display:block;margin-bottom:12px;opacity:0.4;"></i>
          <p>还没有持仓记录，输入基金/股票代码开始追踪</p>
          <p style="font-size:12px;">支持：公募基金代码（6位）或 A股股票代码（6位）</p>
        </div>
      `;
      analysisSection.style.display = 'none';
      return;
    }

    analysisSection.style.display = 'block';

    // 计算每项的当前价格和盈亏
    const items = this.portfolio.map(p => {
      const matched = this.findFundByCode(p.code);
      const currentNav = matched ? matched.currentNav : null;
      const pnl = currentNav != null ? ((currentNav - p.purchasePrice) / p.purchasePrice * 100) : null;
      const costTotal = p.purchasePrice * p.shares;
      const currentTotal = currentNav != null ? currentNav * p.shares : null;
      const pnlTotal = currentTotal != null ? currentTotal - costTotal : null;
      return { ...p, matched, currentNav, pnl, costTotal, currentTotal, pnlTotal };
    });

    // 汇总
    const totalCost = items.reduce((s, i) => s + i.costTotal, 0);
    const totalCurrent = items.reduce((s, i) => s + (i.currentTotal || 0), 0);
    const totalPnl = totalCurrent - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;
    const positiveCount = items.filter(i => i.pnl != null && i.pnl > 0).length;
    const negativeCount = items.filter(i => i.pnl != null && i.pnl < 0).length;

    // 汇总卡片
    let html = `
      <div class="portfolio-summary">
        <div class="portfolio-summary-item">
          <div class="label">总投资成本</div>
          <div class="value" style="color:var(--text-primary);">¥${totalCost.toFixed(2)}</div>
        </div>
        <div class="portfolio-summary-item">
          <div class="label">当前市值</div>
          <div class="value" style="color:var(--text-primary);">¥${totalCurrent.toFixed(2)}</div>
        </div>
        <div class="portfolio-summary-item">
          <div class="label">总盈亏</div>
          <div class="value ${totalPnl >= 0 ? 'positive' : 'negative'}">${totalPnl >= 0 ? '+' : ''}¥${totalPnl.toFixed(2)}</div>
        </div>
        <div class="portfolio-summary-item">
          <div class="label">总收益率</div>
          <div class="value ${totalPnlPct >= 0 ? 'positive' : 'negative'}">${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%</div>
        </div>
        <div class="portfolio-summary-item">
          <div class="label">盈利/亏损产品</div>
          <div class="value" style="font-size:16px;">
            <span style="color:var(--accent-green);">${positiveCount}</span>
            /
            <span style="color:var(--accent-red);">${negativeCount}</span>
          </div>
        </div>
        <div class="portfolio-summary-item">
          <div class="label">持仓数量</div>
          <div class="value" style="color:var(--accent-cyan);">${items.length}</div>
        </div>
      </div>

      <div class="card" style="overflow-x:auto;padding:0;">
        <table class="portfolio-table">
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th style="text-align:right;">买入价</th>
              <th style="text-align:right;">最新价</th>
              <th style="text-align:right;">持仓</th>
              <th style="text-align:right;">成本</th>
              <th style="text-align:right;">市值</th>
              <th style="text-align:right;">盈亏</th>
              <th style="text-align:right;">收益率</th>
              <th style="text-align:center;">操作</th>
            </tr>
          </thead>
          <tbody>
    `;

    items.forEach(i => {
      const pnlClass = i.pnl == null ? 'pl-neutral' : i.pnl >= 0 ? 'pl-positive' : 'pl-negative';
      const pnlStr = i.pnl == null ? 'N/A' : (i.pnl >= 0 ? '+' : '') + i.pnl.toFixed(2) + '%';
      const pnlAmount = i.pnlTotal != null ? ((i.pnlTotal >= 0 ? '+' : '') + '¥' + i.pnlTotal.toFixed(2)) : 'N/A';
      const currentNavStr = i.currentNav != null ? i.currentNav.toFixed(4) : '--';

      html += `
        <tr>
          <td><span class="portfolio-code">${i.code}</span></td>
          <td><span class="portfolio-name">${i.name}</span></td>
          <td style="text-align:right;">¥${i.purchasePrice.toFixed(4)}</td>
          <td style="text-align:right;font-weight:600;">${currentNavStr}</td>
          <td style="text-align:right;">${i.shares.toFixed(0)}</td>
          <td style="text-align:right;">¥${i.costTotal.toFixed(2)}</td>
          <td style="text-align:right;">${i.currentTotal != null ? '¥' + i.currentTotal.toFixed(2) : '--'}</td>
          <td style="text-align:right;" class="${pnlClass}">${pnlAmount}</td>
          <td style="text-align:right;" class="${pnlClass}">${pnlStr}</td>
          <td style="text-align:center;">
            <button class="btn btn-danger btn-sm" onclick="App.removePortfolioItem('${i.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';

    listContainer.innerHTML = html;

    // === AI 组合分析 ===
    this.renderPortfolioAnalysis(items, totalPnlPct, positiveCount, negativeCount);
  },

  renderPortfolioAnalysis(items, totalPnlPct, positiveCount, negativeCount) {
    const container = document.getElementById('portfolioAnalysisContent');
    if (!container) return;

    const marketSentiment = this.data?.aiInsights?.marketSentiment || '中性';
    const confidence = this.data?.aiInsights?.aiConfidenceIndex || '--';

    let html = '<div style="margin-bottom:16px;">';
    html += '<div style="font-size:14px;font-weight:600;margin-bottom:10px;"><i class="fas fa-chart-pie" style="color:var(--accent-cyan);"></i> 持仓诊断报告</div>';
    html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.8;margin-bottom:12px;">';
    html += '当前市场情绪：<strong>' + marketSentiment + '</strong> · ';
    html += 'AI信心指数：<strong style="color:var(--accent-green);">' + confidence + '%</strong></div>';
    html += '</div>';

    // 逐一分析持仓项
    html += '<div style="margin-bottom:12px;"><div style="font-size:14px;font-weight:600;margin-bottom:10px;"><i class="fas fa-search" style="color:var(--accent-blue);"></i> 逐项诊断</div>';

    items.forEach((item) => {
      if (item.pnl == null) {
        html += '<div class="portfolio-advice-item hold">';
        html += '<span class="advice-icon">⚪</span>';
        html += '<div class="advice-text"><div class="advice-title">' + item.name + ' (' + item.code + ')</div>';
        html += '<div class="advice-detail">当前无匹配价格数据，无法计算盈亏。建议确认代码是否正确。</div></div></div>';
        return;
      }

      let action, icon, adviceText;

      if (item.pnl > 20) {
        action = 'reduce';
        icon = '⚠️';
        adviceText = '盈利超过20%，建议考虑部分止盈锁定收益。市场上没有只涨不跌的资产，落袋为安是稳健策略。';
      } else if (item.pnl > 10) {
        action = 'hold';
        icon = '✅';
        adviceText = '盈利状况良好，建议继续持有。结合当前' + marketSentiment + '的市场情绪，该仓位表现符合预期。';
      } else if (item.pnl > 0) {
        action = 'hold';
        icon = '📈';
        adviceText = '小幅盈利中。建议保持持有，关注该基金后续表现和市场整体走势，设置5%的回撤止盈线。';
      } else if (item.pnl > -10) {
        action = 'hold';
        icon = '📉';
        adviceText = '小幅亏损，属于正常波动范围。建议继续持有观察，无需恐慌清仓。可结合定投策略摊低成本。';
      } else if (item.pnl > -20) {
        action = 'reduce';
        icon = '🔻';
        adviceText = '亏损超过10%，建议评估是否继续持有。检查该基金的基本面是否发生变化，考虑减仓控制风险。';
      } else {
        action = 'sell';
        icon = '🚨';
        adviceText = '亏损超过20%，触发风险预警。建议认真分析持仓原因：是否行业整体下行？是否基金本身出现问题？必要时止损离场。';
      }

      // 结合热点新闻的影响
      const sentimentBoost = item.pnl > 0 && this.data?.aiInsights?.marketSentiment?.includes('乐观') ? '（当前市场情绪积极，有助于继续上行）' : '';
      const sentimentRisk = item.pnl < 0 && this.data?.aiInsights?.marketSentiment?.includes('谨慎') ? '（市场情绪偏谨慎，建议控制仓位）' : '';

      html += '<div class="portfolio-advice-item ' + action + '">';
      html += '<span class="advice-icon">' + icon + '</span>';
      html += '<div class="advice-text">';
      html += '<div class="advice-title">' + item.name + ' (' + item.code + ') · ' + (item.pnl >= 0 ? '+' : '') + item.pnl.toFixed(2) + '%</div>';
      html += '<div class="advice-detail">' + adviceText + sentimentBoost + sentimentRisk;
      html += ' 买入价 ¥' + item.purchasePrice.toFixed(4) + ' → 最新价 ¥' + (item.currentNav || 0).toFixed(4);
      html += '</div></div></div>';
    });

    html += '</div>';

    // 组合层面的建议
    html += '<div style="margin-top:12px;"><div style="font-size:14px;font-weight:600;margin-bottom:10px;"><i class="fas fa-lightbulb" style="color:var(--accent-orange);"></i> 组合优化建议</div>';

    if (items.length < 3) {
      html += '<div class="portfolio-advice-item buy">';
      html += '<span class="advice-icon">💡</span>';
      html += '<div class="advice-text"><div class="advice-title">持仓分散度不足</div>';
      html += '<div class="advice-detail">当前仅持有' + items.length + '只产品，建议分散到3-5只不同行业的基金/股票，降低单一品种风险。可参考TOP 5推荐中的基金进行配置。</div></div></div>';
    }

    if (negativeCount > positiveCount && negativeCount >= 2) {
      html += '<div class="portfolio-advice-item reduce">';
      html += '<span class="advice-icon">⚠️</span>';
      html += '<div class="advice-text"><div class="advice-title">亏损面偏大</div>';
      html += '<div class="advice-detail">超过一半的持仓处于亏损状态。建议重新评估投资策略：检查是否追高买入、是否行业集中度过高、是否需要部分止损。</div></div></div>';
    }

    if (totalPnlPct > 15) {
      html += '<div class="portfolio-advice-item reduce">';
      html += '<span class="advice-icon">💰</span>';
      html += '<div class="advice-text"><div class="advice-title">整体盈利丰厚</div>';
      html += '<div class="advice-detail">总收益率超过15%，建议考虑部分止盈，将利润落袋为安。可适当降低仓位至6-7成，保留现金应对市场波动。</div></div></div>';
    }

    if (totalPnlPct < -10) {
      html += '<div class="portfolio-advice-item sell">';
      html += '<span class="advice-icon">🔴</span>';
      html += '<div class="advice-text"><div class="advice-title">整体亏损超10%</div>';
      html += '<div class="advice-detail">组合整体亏损较大，建议：1)检查持仓是否集中在单一行业 2)评估是否需要止损部分仓位 3)考虑定投摊低成本 4)等待市场情绪回暖后调整。</div></div></div>';
    }

    // 基于新闻热点的建议
    if (this.data?.aiInsights?.hotSectors) {
      const topSectors = this.data.aiInsights.hotSectors.slice(0, 3).map(s => s.name).join('、');
      html += '<div class="portfolio-advice-item buy">';
      html += '<span class="advice-icon">🔥</span>';
      html += '<div class="advice-text"><div class="advice-title">热点板块关注</div>';
      html += '<div class="advice-detail">当前市场热点板块：' + topSectors + '。可关注这些方向的配置机会，增配不超过总仓位30%的热点主题基金。</div></div></div>';
    }

    // 风险提示
    html += '<div style="margin-top:12px;padding:12px;background:rgba(245,158,11,0.06);border-radius:8px;border:1px solid rgba(245,158,11,0.12);">';
    html += '<div style="font-size:12px;color:var(--accent-orange);"><i class="fas fa-exclamation-triangle"></i> 风险提示</div>';
    html += '<div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">以上分析基于AI模型生成，仅供参考，不构成投资建议。市场有风险，投资需谨慎。建议结合自身风险承受能力做出决策。</div></div>';

    container.innerHTML = html;
  }
};

// ============ 详情页大图 ============

/**
 * 基金详情页的走势图（带刻度标签）
 * @param {number[]} values - 净值序列
 * @param {string} fundName - 基金名称
 * @returns {string} SVG HTML
 */
function renderDetailedChart(values, fundName) {
  if (!values || values.length < 5) return '';

  const W = 600, H = 220, pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // 坐标点
  const pts = values.map((v, i) => ({
    x: pad.left + (i / (values.length - 1)) * pw,
    y: pad.top + ph - ((v - min) / range) * ph,
    v,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const isUp = values[values.length - 1] >= values[0];
  const stroke = isUp ? '#10b981' : '#ef4444';

  // 填充区域
  const fillD = pathD + ` L${pts[pts.length-1].x.toFixed(1)},${pad.top + ph} L${pts[0].x.toFixed(1)},${pad.top + ph} Z`;

  // Y 轴刻度
  const yTicks = 5;
  const yLabels = [];
  for (let i = 0; i <= yTicks; i++) {
    const val = min + (range * i) / yTicks;
    const y = pad.top + ph - (ph * i) / yTicks;
    yLabels.push({ y, label: val.toFixed(3) });
  }

  // X 轴刻度（首尾+中间）
  const xLabels = [
    { x: pts[0].x, label: '60日前' },
    { x: pts[Math.floor(pts.length / 2)].x, label: '30日前' },
    { x: pts[pts.length - 1].x, label: '今日' },
  ];

  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;">
    <defs>
      <linearGradient id="chartFill_${isUp ? 'up' : 'down'}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${stroke}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>

    <!-- 网格线 + Y轴标签 -->
    ${yLabels.map(({ y, label }) => `
      <line x1="${pad.left}" y1="${y}" x2="${pad.left + pw}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="rgba(255,255,255,0.4)" font-size="11">${label}</text>
    `).join('')}

    <!-- X轴标签 -->
    ${xLabels.map(({ x, label }) => `
      <text x="${x}" y="${H - 6}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="11">${label}</text>
    `).join('')}

    <!-- 填充区域 -->
    <path d="${fillD}" fill="url(#chartFill_${isUp ? 'up' : 'down'})" />

    <!-- 走势线 -->
    <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- 最新值标点 -->
    <circle cx="${pts[pts.length-1].x}" cy="${pts[pts.length-1].y}" r="4" fill="${stroke}" stroke="#1a1a2e" stroke-width="2"/>
    <text x="${pts[pts.length-1].x + 8}" y="${pts[pts.length-1].y + 4}" fill="${stroke}" font-size="12" font-weight="600">
      ${values[values.length-1].toFixed(4)}
    </text>
  </svg>`;
}

// ============ SVG 走势微图 ============

/**
 * 生成 SVG 走势线图（sparkline）
 * @param {number[]} values - 净值序列（从远到近）
 * @param {number} width - SVG 宽度
 * @param {number} height - SVG 高度
 * @returns {string} SVG HTML
 */
let sparklineIdCounter = 0;

function renderSparkline(values, width, height) {
  if (!values || values.length < 3) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const plotW = width - padding * 2;
  const plotH = height - padding * 2;

  // 计算点坐标
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * plotW;
    const y = padding + plotH - ((v - min) / range) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M${points.join(' L')}`;
  const isUp = values[values.length - 1] >= values[0];
  const strokeColor = isUp ? '#10b981' : '#ef4444';
  const gradId = `sparkGrad_${sparklineIdCounter++}`;

  // 填充区域
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const fillD = `${pathD} L${lastPt},${padding + plotH} L${firstPt.split(',')[0]},${padding + plotH} Z`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;">
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <path d="${fillD}" fill="url(#${gradId})" />
    <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

// ============ INITIALIZE ============
document.addEventListener('DOMContentLoaded', () => App.init());

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    App.closeFundModal();
    App.closeNewsModal();
  }
});
// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    App.closeFundModal();
    App.closeNewsModal();
  }
});
