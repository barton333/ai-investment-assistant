// ============ Investment Assistant - Frontend Application ============
const App = {
  data: null,
  fetchTimer: null,
  countdownTimer: null,
  countdownSeconds: 300,
  remainingSeconds: 300,
  isRefreshing: false,
  currentSection: 'dashboard',

  // DOM Cache
  els: {},

  init() {
    this.cacheElements();
    this.bindEvents();
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
    this.renderTopFunds();
    this.renderAIAnalysis();
    this.renderGlobalNews();
    this.renderInvestmentAdvice();
    this.renderUSDProducts();
    this.renderAIInsights();
    this.renderNewsTicker();
  },

  // --- Market Overview ---
  renderMarketOverview() {
    const container = document.getElementById('marketCards');
    if (!container || !this.data.marketOverview) return;

    container.innerHTML = Object.entries(this.data.marketOverview).map(([name, info]) => `
      <div class="card market-card fade-in">
        <div class="index-name">${name}</div>
        <div class="index-value">${info.value}</div>
        <div class="index-change ${info.trend}">
          <i class="fas fa-${info.trend === 'up' ? 'arrow-up' : 'arrow-down'}"></i>
          ${info.trend === 'up' ? '+' : ''}${info.change} (${info.changePercent}%)
        </div>
      </div>
    `).join('');
  },

  // --- Top 5 Funds ---
  renderTopFunds() {
    const container = document.getElementById('topFunds');
    if (!container || !this.data.topFunds) return;

    container.innerHTML = this.data.topFunds.map((fund, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
      const actionClass = fund.advice.action.includes('买入') ? 'buy' : fund.advice.action.includes('持有') || fund.advice.action.includes('加仓') ? 'hold' : 'watch';
      
      return `
        <div class="card fund-card fade-in stagger-${i+1}" onclick="App.openFundDetail(${i})">
          <div class="fund-rank ${rankClass}">${fund.rank}</div>
          <div class="fund-body">
            <div class="fund-header">
              <div class="fund-name">
                ${fund.name}
                <span class="fund-code">${fund.code} · ${fund.type} · ${fund.fundSize}</span>
              </div>
              <div class="fund-rating">${'★'.repeat(fund.rating)}${'☆'.repeat(5-fund.rating)}</div>
            </div>
            <div class="fund-stats">
              <div class="fund-stat">
                <div class="label">今日</div>
                <div class="value ${parseFloat(fund.todayChange) >= 0 ? 'up' : 'down'}">
                  ${parseFloat(fund.todayChange) >= 0 ? '+' : ''}${fund.todayChange}%
                </div>
              </div>
              <div class="fund-stat">
                <div class="label">近1周</div>
                <div class="value up">+${fund.week}%</div>
              </div>
              <div class="fund-stat">
                <div class="label">近1月</div>
                <div class="value up">+${fund.month}%</div>
              </div>
              <div class="fund-stat">
                <div class="label">近1年</div>
                <div class="value up">+${fund.year}%</div>
              </div>
            </div>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
              <strong style="color:var(--accent-cyan);">AI综合评分：${fund.score}/100</strong> · 
              风险等级：${fund.risk} · 策略：${fund.focus}
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

    container.innerHTML = this.data.globalNews.map((news, i) => {
      const impactClass = news.impact.includes('利好') ? '利好' : news.impact.includes('利空') ? '利空' : news.impact.includes('中性') ? '中性' : '中性';
      const highlightClass = news.impact.includes('利好') && i < 2 ? 'news-highlight' : news.impact.includes('利空') ? 'news-warning' : '';
      
      return `
        <div class="card news-card fade-in stagger-${Math.min(i+1, 5)} ${highlightClass}">
          <div class="news-header">
            <span class="news-impact ${impactClass}">${news.impact}</span>
            <div style="flex:1;">
              <div class="news-topic">${news.topic}</div>
            </div>
          </div>
          <p class="news-detail">${news.detail}</p>
          <div class="news-sectors">
            ${news.affectedSectors.map(s => `<span class="sector-tag">${s}</span>`).join('')}
          </div>
          <div class="news-meta">
            <span><i class="far fa-building"></i> ${news.source}</span>
            <span><i class="far fa-clock"></i> ${news.time}</span>
            <span><i class="far fa-calendar"></i> ${news.date}</span>
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

  // --- News Ticker ---
  renderNewsTicker() {
    const container = document.getElementById('newsTicker');
    if (!container || !this.data.globalNews) return;

    const tickerItems = this.data.globalNews.slice(0, 6).map(news => {
      const dotColor = news.impact.includes('利好') ? 'green' : news.impact.includes('利空') ? 'red' : 'orange';
      return `
        <span class="ticker-item">
          <span class="ticker-dot ${dotColor}"></span>
          ${news.topic}
        </span>
      `;
    }).join('');

    container.innerHTML = tickerItems;
  },

  // ============ FUND DETAIL MODAL ============

  openFundDetail(index) {
    const fund = this.data.topFunds[index];
    if (!fund) return;

    const modal = document.getElementById('fundModal');
    const body = document.getElementById('fundModalBody');
    
    body.innerHTML = `
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px;">${fund.code} · ${fund.type}</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px;">${fund.name}</div>
        <div style="display:flex;gap:12px;font-size:13px;color:var(--text-secondary);">
          <span>规模: ${fund.fundSize}</span>
          <span>风险: ${fund.risk}</span>
          <span>策略: ${fund.focus}</span>
          <span>AI评分: <strong style="color:var(--accent-green);">${fund.score}/100</strong></span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">
        <div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:var(--text-tertiary);">单位净值</div>
          <div style="font-size:22px;font-weight:700;color:var(--accent-cyan);">${fund.nav}</div>
        </div>
        <div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:var(--text-tertiary);">今日涨跌</div>
          <div style="font-size:22px;font-weight:700;color:${parseFloat(fund.todayChange) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">
            ${parseFloat(fund.todayChange) >= 0 ? '+' : ''}${fund.todayChange}%
          </div>
        </div>
        <div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:var(--text-tertiary);">近1周</div>
          <div style="font-size:18px;font-weight:600;color:var(--accent-green);">+${fund.week}%</div>
        </div>
        <div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:8px;text-align:center;">
          <div style="font-size:12px;color:var(--text-tertiary);">近1年</div>
          <div style="font-size:18px;font-weight:600;color:var(--accent-green);">+${fund.year}%</div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">
          <i class="fas fa-robot" style="color:var(--accent-cyan);"></i> AI深度分析
        </div>
        <div style="font-size:14px;line-height:1.8;color:var(--text-secondary);padding:12px;background:rgba(0,0,0,0.15);border-radius:8px;border-left:3px solid var(--accent-cyan);">
          ${fund.aiAnalysis}
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">
          <i class="fas fa-lightbulb" style="color:var(--accent-orange);"></i> 投资建议
        </div>
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(16,185,129,0.05);border-radius:8px;border:1px solid rgba(16,185,129,0.15);">
          <span style="padding:4px 12px;border-radius:20px;font-weight:600;font-size:13px;background:rgba(16,185,129,0.15);color:var(--accent-green);">${fund.advice.action}</span>
          <span style="font-size:13px;color:var(--text-secondary);flex:1;">${fund.advice.reason}</span>
          <span style="font-size:13px;color:var(--accent-orange);">${fund.advice.confidence}</span>
        </div>
      </div>

      <div style="font-size:12px;color:var(--text-tertiary);padding-top:12px;border-top:1px solid var(--border-color);">
        <i class="fas fa-info-circle"></i> 以上分析仅供参考，不构成投资建议。基金有风险，投资需谨慎。
      </div>
    `;

    modal.classList.add('show');
  },

  closeFundModal() {
    document.getElementById('fundModal').classList.remove('show');
  }
};

// ============ INITIALIZE ============
document.addEventListener('DOMContentLoaded', () => App.init());

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    App.closeFundModal();
  }
});
// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') App.closeFundModal();
});
