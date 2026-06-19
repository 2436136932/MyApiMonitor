const DeepSeekProvider = {
  id: 'deepseek',
  name: 'DeepSeek',

  getConfigFields() {
    return [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      { key: 'usageToken', label: '用量 Token', type: 'password', placeholder: '从浏览器 DevTools 复制' },
    ];
  },

  async fetchJson(url, token) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { error: res.status };
    return res.json();
  },

  toNumber(value) {
    if (typeof value === 'number') return value;
    const parsed = Number(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  },

  firstNumber(source, keys) {
    if (!source || typeof source !== 'object') return null;
    for (const key of keys) {
      const value = this.toNumber(source[key]);
      if (value !== null) return value;
    }
    return null;
  },

  sumNumbers(list, keys) {
    if (!Array.isArray(list)) return null;
    let sum = 0;
    let found = false;
    list.forEach((item) => {
      const value = this.firstNumber(item, keys);
      if (value !== null) {
        sum += value;
        found = true;
      }
    });
    return found ? sum : null;
  },

  extractBalance(balanceRes) {
    const balanceInfo = Array.isArray(balanceRes?.balance_infos)
      ? (balanceRes.balance_infos.find((item) => item.currency === 'CNY') || balanceRes.balance_infos[0])
      : balanceRes;

    return {
      total: this.firstNumber(balanceInfo, ['total_balance', 'balance', 'total', 'amount']),
      granted: this.firstNumber(balanceInfo, ['granted_balance', 'granted']),
      toppedUp: this.firstNumber(balanceInfo, ['topped_up_balance', 'toppedUpBalance', 'recharged_balance']),
    };
  },

  extractUsage(usageRes) {
    const data = usageRes?.data ?? usageRes;
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : null);
    return {
      promptTokens: this.firstNumber(data, ['prompt_tokens', 'input_tokens', 'inputTokenCount'])
        ?? this.sumNumbers(rows, ['prompt_tokens', 'input_tokens', 'inputTokenCount']),
      completionTokens: this.firstNumber(data, ['completion_tokens', 'output_tokens', 'outputTokenCount'])
        ?? this.sumNumbers(rows, ['completion_tokens', 'output_tokens', 'outputTokenCount']),
      totalTokens: this.firstNumber(data, ['total_tokens', 'tokens', 'totalTokenCount'])
        ?? this.sumNumbers(rows, ['total_tokens', 'tokens', 'totalTokenCount']),
    };
  },

  extractCost(costRes) {
    const data = costRes?.data ?? costRes;
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : null);
    return this.firstNumber(data, ['total_cost', 'cost', 'amount', 'totalAmount'])
      ?? this.sumNumbers(rows, ['total_cost', 'cost', 'amount', 'totalAmount']);
  },

  async fetchSummary(config) {
    const { apiKey, usageToken } = config;
    if (!apiKey) throw new Error('NO_KEY');

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const balancePromise = this.fetchJson('https://api.deepseek.com/user/balance', apiKey);
    const usagePromise = usageToken
      ? this.fetchJson(`https://platform.deepseek.com/api/v0/usage/amount?month=${month}&year=${year}`, usageToken)
      : Promise.resolve(null);
    const costPromise = usageToken
      ? this.fetchJson(`https://platform.deepseek.com/api/v0/usage/cost?month=${month}&year=${year}`, usageToken)
      : Promise.resolve(null);

    const [balanceRes, usageRes, costRes] = await Promise.all([balancePromise, usagePromise, costPromise]);

    if (balanceRes?.error) {
      throw balanceRes.error === 401
        ? 'AUTH_FAILED'
        : { status: balanceRes.error, body: '余额查询失败' };
    }

    const items = [];
    const balance = this.extractBalance(balanceRes);

    if (balance.total !== null) {
      items.push({ label: '总余额', value: balance.total.toFixed(4), unit: '元', primary: true });
    }
    if (balance.granted !== null) {
      items.push({ label: '赠送余额', value: balance.granted.toFixed(4), unit: '元' });
    }
    if (balance.toppedUp !== null) {
      items.push({ label: '充值余额', value: balance.toppedUp.toFixed(4), unit: '元' });
    }

    if (usageRes && !usageRes.error) {
      const usage = this.extractUsage(usageRes);
      const summedTokens = (usage.promptTokens || 0) + (usage.completionTokens || 0);
      const totalTokens = usage.totalTokens ?? (summedTokens > 0 ? summedTokens : null);
      if (totalTokens !== null) {
        items.push({ label: `本月 Token 用量 (${year}-${month})`, value: totalTokens.toLocaleString(), unit: '' });
      }
      if (usage.promptTokens !== null) {
        items.push({ label: '输入 Token', value: usage.promptTokens.toLocaleString(), unit: '' });
      }
      if (usage.completionTokens !== null) {
        items.push({ label: '输出 Token', value: usage.completionTokens.toLocaleString(), unit: '' });
      }
    }

    if (costRes && !costRes.error) {
      const totalCost = this.extractCost(costRes);
      if (totalCost !== null) {
        items.push({ label: `本月费用 (${year}-${month})`, value: totalCost.toFixed(4), unit: '元' });
      }
    }

    if (items.length === 0) {
      return { items: [], rawJson: JSON.stringify(balanceRes, null, 2) };
    }

    return { items, rawJson: null };
  },

  formatError(error) {
    if (error === 'NO_KEY') return '未配置 API Key';
    if (error === 'AUTH_FAILED') return 'API Key 无效或已过期（401）';
    if (error === 'USAGE_NO_KEY') return '未配置用量 Token';
    if (typeof error === 'object' && error !== null) {
      if (error.status === 429) return '请求过于频繁，请稍后重试（429）';
      if (error.status === 403) return '无权限访问（403）';
      return `请求失败（${error.status}）`;
    }
    if (error instanceof TypeError) return '网络错误，请检查网络连接';
    return String(error);
  }
};

