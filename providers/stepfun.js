const StepFunProvider = {
  id: 'stepfun',
  name: '阶跃星辰',

  getConfigFields() {
    return [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
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

  pushMoney(items, label, value, primary = false) {
    const parsed = this.toNumber(value);
    if (parsed === null) return;
    items.push({ label, value: parsed.toFixed(4), unit: '元', primary });
  },

  async fetchSummary(config) {
    const { apiKey } = config;
    if (!apiKey) throw new Error('NO_KEY');

    const [accountRes, modelsRes] = await Promise.all([
      this.fetchJson('https://api.stepfun.com/v1/accounts', apiKey),
      this.fetchJson('https://api.stepfun.com/v1/models', apiKey),
    ]);

    if (accountRes?.error) {
      throw accountRes.error === 401
        ? 'AUTH_FAILED'
        : { status: accountRes.error, body: '账户查询失败' };
    }

    const items = [];
    if (accountRes.object) items.push({ label: '对象类型', value: accountRes.object, unit: '' });
    if (accountRes.type) {
      const typeText = accountRes.type === 'prepaid' ? '预付费' : accountRes.type === 'postpaid' ? '后付费' : accountRes.type;
      items.push({ label: '计费类型', value: typeText, unit: '' });
    }

    this.pushMoney(items, '账户额度', accountRes.balance, true);
    this.pushMoney(items, '充值余额', accountRes.total_cash_balance);
    this.pushMoney(items, '赠送余额', accountRes.total_voucher_balance);

    const models = Array.isArray(modelsRes?.data) ? modelsRes.data : [];
    if (models.length > 0) {
      items.push({ label: '可用模型数量', value: String(models.length), unit: '' });
      items.push({ label: '示例模型', value: models.slice(0, 4).map((model) => model.id).join(', '), unit: '' });
    } else if (modelsRes?.error) {
      items.push({ label: '模型列表', value: `查询失败 (${modelsRes.error})`, unit: '' });
    }

    if (items.length === 0) {
      return { items: [], rawJson: JSON.stringify(accountRes, null, 2) };
    }

    return { items, rawJson: null, models };
  },

  formatError(error) {
    if (error === 'NO_KEY') return '未配置 API Key';
    if (typeof error === 'object' && error !== null) {
      if (error.status === 401) return 'API Key 无效或已过期（401）';
      if (error.status === 429) return '请求过于频繁，请稍后重试（429）';
      if (error.status === 403) return '无权限访问（403）';
      return `请求失败（${error.status}）`;
    }
    if (error instanceof TypeError) return '网络错误，请检查网络连接';
    return String(error);
  }
};
