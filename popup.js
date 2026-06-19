// ==============================
// Registry
// ==============================
registerProvider(DeepSeekProvider);
registerProvider(StepFunProvider);

// ==============================
// DOM helpers
// ==============================
const $ = (sel) => document.querySelector(sel);

const els = {
  brandText: $('#brand-text'),
  providerTabs: $('#provider-tabs'),
  refresh: $('#btn-refresh'),
  settings: $('#btn-settings'),
  theme: $('#btn-theme'),
  closeSettings: $('#btn-close-settings'),
  balanceLabel: $('.balance-label'),
  balanceHint: $('.balance-hint'),
  balanceAmount: $('#balance-amount'),
  dailyAmount: $('#daily-amount'),
  monthAmount: $('#month-amount'),
  flashModelName: $('#flash-model-name'),
  flashTokens: $('#flash-tokens'),
  flashPrice: $('#flash-price'),
  flashSpeed: $('#flash-speed'),
  flashBar: $('#flash-bar'),
  flashCache: $('#flash-cache'),
  flashRequests: $('#flash-requests'),
  flashTokenTotal: $('#flash-token-total'),
  flashCardPrice: $('#flash-card-price'),
  flashMetricTitle: $('#flash-metric-title'),
  proModelName: $('#pro-model-name'),
  proTokens: $('#pro-tokens'),
  proPrice: $('#pro-price'),
  proSpeed: $('#pro-speed'),
  proBar: $('#pro-bar'),
  proCache: $('#pro-cache'),
  proRequests: $('#pro-requests'),
  proTokenTotal: $('#pro-token-total'),
  proCardPrice: $('#pro-card-price'),
  proMetricTitle: $('#pro-metric-title'),
  tokenRange: $('#token-range'),
  cacheChart: $('#cache-chart'),
  tokenChart: $('#token-chart'),
  cacheSummary: $('#cache-summary'),
  detailTitle: $('#provider-detail-title'),
  providerUpdated: $('#provider-updated'),
  providerDetails: $('#provider-details'),
  settingsBrandText: $('#settings-brand-text'),
  apiKeyDesc: $('#api-key-desc'),
  usageTokenSection: $('#usage-token-section'),
  verifyStatus: $('#verify-status'),
  apiKey: $('#api-key'),
  toggleKey: $('#btn-toggle-key'),
  verify: $('#btn-verify'),
  clearKey: $('#btn-clear-key'),
  browserSync: $('#btn-browser-sync'),
  clearSync: $('#btn-clear-sync'),
  syncToken: $('#sync-token'),
  toggleToken: $('#btn-toggle-token'),
  saveToken: $('#btn-save-token'),
  autostart: $('#autostart-toggle'),
  autoupdate: $('#autoupdate-toggle'),
  appVersion: $('#app-version'),
  loading: $('#loading'),
};

// ==============================
// State
// ==============================
let activeProviderId = 'deepseek';
let results = {};
let lastUpdated = {};
let configs = {};
let settingsOpen = false;

const providerMeta = {
  deepseek: {
    brand: 'DeepSeek Monitor',
    balanceLabel: '账户余额',
    balanceHint: '可用',
    detailTitle: '账户与用量',
    modelA: 'DeepSeek Chat',
    modelB: 'DeepSeek Reasoner',
    apiKeyDesc: '用于调用 DeepSeek API 获取余额；用量数据需要额外登录 Token。',
  },
  stepfun: {
    brand: '阶跃星辰 Monitor',
    balanceLabel: '账户额度',
    balanceHint: '可用',
    detailTitle: '账户与模型',
    modelA: 'Step 3.7 Flash',
    modelB: 'Step Router',
    apiKeyDesc: '用于调用阶跃星辰 accounts 和 models API 获取账户余额与可用模型。',
  },
};

// ==============================
// Storage
// ==============================
function storageGet(keys, callback) {
  if (window.chrome?.storage?.local) {
    chrome.storage.local.get(keys, callback);
    return;
  }
  callback({});
}

function storageSet(data, callback) {
  if (window.chrome?.storage?.local) {
    chrome.storage.local.set(data, callback || (() => {}));
    return;
  }
  callback?.();
}

function loadData() {
  return new Promise((resolve) => {
    storageGet(['activeTab', 'results', 'lastUpdated', 'configs'], (data) => {
      activeProviderId = data.activeTab || 'deepseek';
      if (!getProvider(activeProviderId)) activeProviderId = 'deepseek';
      results = data.results || {};
      lastUpdated = data.lastUpdated || {};
      configs = data.configs || {};
      resolve();
    });
  });
}

function saveData(cb) {
  storageSet({
    activeTab: activeProviderId,
    results,
    lastUpdated,
    configs,
  }, cb || (() => {}));
}

// ==============================
// Helpers
// ==============================
function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '¥0.00';
  return '¥' + num.toFixed(2);
}

function formatToken(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

function formatDate(dateLike) {
  if (!dateLike) return '';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function getProviderMeta(providerId) {
  return providerMeta[providerId] || {
    brand: 'MyApiMonitor',
    balanceLabel: '账户余额',
    balanceHint: '可用',
    detailTitle: '账户信息',
    modelA: '模型 A',
    modelB: '模型 B',
    apiKeyDesc: '用于调用当前供应商 API 获取账户信息。',
  };
}

function formatItemValue(item) {
  if (!item) return '';
  const value = item.value ?? '';
  return item.unit ? `${value} ${item.unit}` : String(value);
}

function formatUpdated(dateLike) {
  if (!dateLike) return '未查询';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '未查询';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} 更新`;
}

// ==============================
// Mini chart renderer
// ==============================
function renderBarChart(container, values, maxValue = 1) {
  if (!container) return;
  container.innerHTML = '';
  values.forEach((value) => {
    const height = Math.max(0, Math.min(100, (value / maxValue) * 100));
    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = `${height}%`;
    bar.title = `${height.toFixed(1)}%`;
    container.appendChild(bar);
  });
}

function renderGroupedChart(container, rows, maxValue = 1) {
  if (!container) return;
  container.innerHTML = '';
  rows.forEach((group) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-bar-group';
    wrapper.style.flex = '1';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '3px';
    wrapper.style.alignItems = 'center';
    ['hit', 'miss', 'output'].forEach((key) => {
      const bar = document.createElement('div');
      bar.className = `chart-bar ${key}`;
      const value = Number(group[key] || 0);
      const height = maxValue > 0 ? Math.max(2, Math.min(100, (value / maxValue) * 100)) : 2;
      bar.style.height = `${height}%`;
      bar.title = `${key}: ${value.toLocaleString()}`;
      wrapper.appendChild(bar);
    });
    container.appendChild(wrapper);
  });
}

function clearCharts() {
  if (els.cacheChart) els.cacheChart.innerHTML = '';
  if (els.tokenChart) els.tokenChart.innerHTML = '';
  setText(els.cacheSummary, '暂无真实用量数据');
  setText(els.tokenRange, '暂无真实用量数据');
}

function renderProviderTabs() {
  if (!els.providerTabs) return;
  els.providerTabs.innerHTML = '';
  getAllProviders().forEach((provider) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `provider-tab${provider.id === activeProviderId ? ' active' : ''}`;
    button.textContent = provider.name;
    button.title = provider.name;
    button.addEventListener('click', () => switchProvider(provider.id));
    els.providerTabs.appendChild(button);
  });
}

function renderProviderChrome() {
  const meta = getProviderMeta(activeProviderId);
  setText(els.brandText, meta.brand);
  setText(els.settingsBrandText, meta.brand);
  setText(els.balanceLabel, meta.balanceLabel);
  setText(els.balanceHint, meta.balanceHint);
  setText(els.detailTitle, meta.detailTitle);
  setText(els.flashModelName, meta.modelA);
  setText(els.flashMetricTitle, meta.modelA);
  setText(els.proModelName, meta.modelB);
  setText(els.proMetricTitle, meta.modelB);
}

function renderProviderDetails() {
  if (!els.providerDetails) return;
  const result = results[activeProviderId];
  els.providerDetails.innerHTML = '';
  setText(els.providerUpdated, formatUpdated(lastUpdated[activeProviderId]));

  if (!result) {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const label = document.createElement('span');
    label.className = 'detail-label';
    label.textContent = '状态';
    const value = document.createElement('span');
    value.className = 'detail-value';
    value.textContent = '尚未查询';
    row.append(label, value);
    els.providerDetails.appendChild(row);
    return;
  }

  if (result.error) {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const label = document.createElement('span');
    label.className = 'detail-label';
    label.textContent = '查询失败';
    const value = document.createElement('span');
    value.className = 'detail-value';
    value.textContent = result.error;
    row.append(label, value);
    els.providerDetails.appendChild(row);
    return;
  }

  const items = Array.isArray(result.items) ? result.items : [];
  if (items.length === 0) {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const label = document.createElement('span');
    label.className = 'detail-label';
    label.textContent = '返回数据';
    const value = document.createElement('span');
    value.className = 'detail-value';
    value.textContent = '暂无可解析字段';
    row.append(label, value);
    els.providerDetails.appendChild(row);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const label = document.createElement('span');
    label.className = 'detail-label';
    label.textContent = item.label;
    const value = document.createElement('span');
    value.className = 'detail-value';
    value.textContent = formatItemValue(item);
    value.title = value.textContent;
    row.append(label, value);
    els.providerDetails.appendChild(row);
  });
}

// ==============================
// Provider data shaping
// ==============================
function buildModelSummary(providerId) {
  const summary = {
    balance: 0,
    daily: 0,
    month: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    hasUsage: false,
    flash: { tokens: 0, price: 0, speed: 0, cache: 0, requests: 0 },
    pro: { tokens: 0, price: 0, speed: 0, cache: 0, requests: 0 },
    cacheChart: [],
    tokenChart: [],
  };

  const result = results[providerId];
  if (!result || result.error || !Array.isArray(result.items)) {
    return summary;
  }

  const findValue = (matcher) => parseNumber(result.items.find((item) => matcher(item.label))?.value);

  summary.balance = findValue((label) => label === '总余额' || label === '账户额度');
  summary.month = findValue((label) => label.includes('本月费用'));
  summary.daily = summary.month > 0 ? summary.month / 30 : 0;
  summary.totalTokens = findValue((label) => label.includes('本月 Token 用量'));
  summary.promptTokens = findValue((label) => label.includes('输入 Token'));
  summary.completionTokens = findValue((label) => label.includes('输出 Token'));
  summary.hasUsage = summary.totalTokens > 0 || summary.month > 0;

  // DeepSeek public balance API does not return model-level Flash/Pro usage.
  // Keep model cards empty unless a provider explicitly returns model-specific fields later.
  return summary;
}

// ==============================
// Render
// ==============================
function renderDashboard() {
  renderProviderChrome();
  renderProviderTabs();
  renderProviderDetails();
  const summary = buildModelSummary(activeProviderId);

  setText(els.balanceAmount, formatMoney(summary.balance));
  setText(els.dailyAmount, formatMoney(summary.daily));
  setText(els.monthAmount, formatMoney(summary.month));

  setText(els.flashTokens, '暂无真实数据');
  setText(els.flashPrice, '¥0.00');
  setText(els.flashSpeed, '0 M T/s');
  if (els.flashBar) els.flashBar.style.width = '0%';
  setText(els.flashCache, '0%');
  setText(els.flashRequests, '0');
  setText(els.flashTokenTotal, '0');
  setText(els.flashCardPrice, '¥0.00');

  setText(els.proTokens, '暂无真实数据');
  setText(els.proPrice, '¥0.00');
  setText(els.proSpeed, '0 M T/s');
  if (els.proBar) els.proBar.style.width = '0%';
  setText(els.proCache, '0%');
  setText(els.proRequests, '0');
  setText(els.proTokenTotal, '0');
  setText(els.proCardPrice, '¥0.00');

  clearCharts();

  if (summary.hasUsage) {
    setText(els.tokenRange, '本月汇总');
    setText(els.cacheSummary, '当前接口无缓存命中明细');
    const total = summary.totalTokens || summary.promptTokens + summary.completionTokens;
    if (total > 0) {
      renderGroupedChart(els.tokenChart, [{
        hit: 0,
        miss: summary.promptTokens || total,
        output: summary.completionTokens || 0,
      }], Math.max(1, total));
      renderBarChart(els.cacheChart, [0], 100);
    }
  }
}

function renderSettings(provider) {
  if (!provider) return;
  const meta = getProviderMeta(provider.id);
  const fields = provider.getConfigFields();
  const hasUsageToken = fields.some((field) => field.key === 'usageToken');
  const config = configs[provider.id] || {};
  setText(els.apiKeyDesc, meta.apiKeyDesc);
  els.apiKey.value = config.apiKey || '';
  els.syncToken.value = config.usageToken || '';
  if (els.usageTokenSection) {
    els.usageTokenSection.classList.toggle('hidden', !hasUsageToken);
  }
}

function switchProvider(providerId) {
  if (providerId === activeProviderId || !getProvider(providerId)) return;
  activeProviderId = providerId;
  saveData(() => {
    renderDashboard();
    renderSettings(getProvider(activeProviderId));
  });
}

// ==============================
// Settings
// ==============================
function toggleSettings() {
  settingsOpen = !settingsOpen;
  $('#settings-panel').classList.toggle('hidden', !settingsOpen);
  els.settings.classList.toggle('active', settingsOpen);
  renderSettings(getProvider(activeProviderId));
}

function saveSettings() {
  const provider = getProvider(activeProviderId);
  if (!provider) return;
  const fields = provider.getConfigFields();
  const newConfig = { ...(configs[provider.id] || {}) };
  fields.forEach((field) => {
    if (field.key === 'apiKey') newConfig.apiKey = els.apiKey.value.trim();
    if (field.key === 'usageToken') newConfig.usageToken = els.syncToken.value.trim();
  });
  configs[provider.id] = newConfig;
  delete results[provider.id];
  delete lastUpdated[provider.id];
  saveData(() => {
    els.verifyStatus.textContent = '已配置，正在刷新';
    els.verifyStatus.className = 'status-badge success';
    renderDashboard();
    doRefresh();
  });
}

function clearSettings() {
  const provider = getProvider(activeProviderId);
  if (!provider) return;
  configs[provider.id] = {};
  delete results[provider.id];
  delete lastUpdated[provider.id];
  saveData(() => {
    els.verifyStatus.textContent = '已清除';
    els.verifyStatus.className = 'status-badge success';
    renderSettings(provider);
    renderDashboard();
  });
}

// ==============================
// Refresh
// ==============================
async function doRefresh() {
  const provider = getProvider(activeProviderId);
  if (!provider) return;
  const config = configs[activeProviderId] || {};
  if (!config.apiKey) {
    els.verifyStatus.textContent = '未配置 API Key';
    els.verifyStatus.className = 'status-badge success';
    return;
  }

  els.loading.classList.remove('hidden');
  try {
    const summary = await provider.fetchSummary(config);
    results[activeProviderId] = summary;
    lastUpdated[activeProviderId] = new Date().toISOString();
    saveData();
    renderDashboard();
    const hasUsageToken = provider.getConfigFields().some((field) => field.key === 'usageToken');
    els.verifyStatus.textContent = hasUsageToken && !config.usageToken ? '已更新余额，未配置用量 Token' : '已更新';
    els.verifyStatus.className = 'status-badge success';
  } catch (err) {
    results[activeProviderId] = { error: provider.formatError(err) };
    saveData();
    renderDashboard();
    els.verifyStatus.textContent = provider.formatError(err);
    els.verifyStatus.className = 'status-badge success';
  } finally {
    els.loading.classList.add('hidden');
  }
}

// ==============================
// Init
// ==============================
async function init() {
  await loadData();
  renderDashboard();
  renderSettings(getProvider(activeProviderId));

  els.refresh.addEventListener('click', doRefresh);
  els.settings.addEventListener('click', toggleSettings);
  els.closeSettings.addEventListener('click', toggleSettings);
  els.theme.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
  });
  els.toggleKey.addEventListener('click', () => {
    const isPassword = els.apiKey.type === 'password';
    els.apiKey.type = isPassword ? 'text' : 'password';
    els.toggleKey.textContent = isPassword ? '🙈' : '👁';
  });
  els.toggleToken.addEventListener('click', () => {
    const isPassword = els.syncToken.type === 'password';
    els.syncToken.type = isPassword ? 'text' : 'password';
    els.toggleToken.textContent = isPassword ? '🙈' : '👁';
  });
  els.verify.addEventListener('click', saveSettings);
  els.clearKey.addEventListener('click', clearSettings);
  els.browserSync.addEventListener('click', () => {
    els.verifyStatus.textContent = '请粘贴用量 Token 后保存';
    els.verifyStatus.className = 'status-badge success';
  });
  els.clearSync.addEventListener('click', () => {
    els.syncToken.value = '';
    saveSettings();
  });
  els.saveToken.addEventListener('click', saveSettings);
  els.autostart.addEventListener('change', () => {
    els.verifyStatus.textContent = els.autostart.checked ? '已配置' : '已关闭';
    els.verifyStatus.className = 'status-badge success';
  });
  els.autoupdate.addEventListener('change', () => {
    els.verifyStatus.textContent = els.autoupdate.checked ? '已配置' : '已关闭';
    els.verifyStatus.className = 'status-badge success';
  });
}

document.addEventListener('DOMContentLoaded', init);
