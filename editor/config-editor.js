class ConfigEditor {
  constructor() {
    this.config = null;
    this.defaultConfig = null;
    this.previewDebounce = null;
  }

  async init() {
    // Load default config structure
    await this.loadDefaults();
    // Try to load existing config
    await this.loadConfig();
    // Bind UI
    this.bindSectionTabs();
    this.bindFormInputs();
    this.bindCacheRules();
    this.bindButtons();
    // Initial preview
    this.updatePreview();
  }

  async loadDefaults() {
    try {
      const res = await fetch('/pwa.config.json');
      if (res.ok) {
        this.defaultConfig = await res.json();
      }
    } catch {
      this.defaultConfig = this.getMinimalDefaults();
    }
  }

  getMinimalDefaults() {
    return {
      app: {
        name: 'My PWA App', short_name: 'App', description: '',
        start_url: '/app.html', scope: '/', theme_color: '#ffffff', background_color: '#ffffff',
        display: 'standalone', orientation: 'portrait-primary',
        developer: 'Developer Name'
      },
      installPage: {
        title: '安装应用', subtitle: '添加到主屏幕以获得完整体验',
        icon: '/assets/icons/icon-512.png', screenshots: [],
        rating: 4.5, reviewCount: 1200, badges: ['安全', '无广告'],
        size: '2.5 MB', category: '工具', updatedDate: '2026-06-08',
        about: '这是一个使用 PWA Manager 构建的渐进式 Web 应用。',
        whatsNew: '初始版本', dataSafety: '此应用不会收集或分享任何用户数据。',
        privacyUrl: '',
        features: ['离线可用', '推送通知', '快速启动'],
        progressSteps: ['正在下载资源...', '正在缓存数据...', '完成安装'],
        progressDuration: 3000,
        theme: {
          primary: '#01875f', primaryHover: '#016843', primaryDark: '#016843',
          surface: '#ffffff', surfaceBg: '#f5f5f5',
          onSurface: '#1f1f1f', onSurfaceVariant: '#5f6368',
          onPrimary: '#ffffff', primaryContainer: '#e8f5e9',
          outlineVariant: '#e0e0e0', starColor: '#faaf00',
          badgeBg: '#e8f5e9', badgeText: '#2e7d32',
          skeleton: '#e0e0e0', skeletonShine: '#f0f0f0'
        }
      },
      cache: { version: '1.0.0', precache: [], runtimeCache: [], offlineFallback: '/offline.html' },
      update: { autoUpdate: false, promptUser: true, checkInterval: 3600000 }
    };
  }

  async loadConfig() {
    // Try loading saved config from localStorage first, then from server
    const saved = localStorage.getItem('__pwa_config_draft');
    if (saved) {
      try { this.config = JSON.parse(saved); return; } catch {}
    }
    this.config = JSON.parse(JSON.stringify(this.defaultConfig));
  }

  getValue(path) {
    return path.split('.').reduce((o, k) => (o || {})[k], this.config);
  }

  setValue(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const obj = keys.reduce((o, k) => {
      if (!o[k]) o[k] = {};
      return o[k];
    }, this.config);
    obj[last] = value;
  }

  // ── Section Tabs ──
  bindSectionTabs() {
    document.querySelectorAll('.section-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const section = tab.dataset.section;
        document.querySelectorAll('.form-section').forEach(s => {
          s.classList.toggle('hidden', s.dataset.section !== section);
        });
      });
    });
  }

  // ── Form Binding ──
  bindFormInputs() {
    // Text / number / select / textarea
    document.querySelectorAll('[data-path]').forEach(input => {
      const path = input.dataset.path;
      const val = this.getValue(path);

      if (input.tagName === 'TEXTAREA' && Array.isArray(val)) {
        input.value = val.join('\n');
      } else if (input.type === 'checkbox') {
        input.checked = !!val;
      } else if (input.tagName === 'SELECT' || input.tagName === 'INPUT') {
        input.value = val !== undefined ? val : '';
      }

      input.addEventListener('input', () => {
        if (input.type === 'checkbox') {
          this.setValue(path, input.checked);
        } else if (input.tagName === 'TEXTAREA') {
          const arrPaths = ['installPage.features', 'installPage.progressSteps', 'cache.precache'];
          if (arrPaths.includes(path)) {
            this.setValue(path, input.value.split('\n').filter(s => s.trim()));
          } else {
            this.setValue(path, input.value);
          }
        } else if (input.type === 'number') {
          this.setValue(path, parseInt(input.value, 10) || 0);
        } else {
          this.setValue(path, input.value);
        }
        this.onConfigChanged();
      });

      input.addEventListener('change', () => this.onConfigChanged());
    });

    // Color pairs: color input ↔ text input
    document.querySelectorAll('input[type="color"]').forEach(colorInput => {
      colorInput.addEventListener('input', () => {
        const path = colorInput.dataset.path;
        this.setValue(path, colorInput.value);
        const textInput = document.querySelector(`input[data-linked="${path}"]`);
        if (textInput) textInput.value = colorInput.value;
        this.onConfigChanged();
      });
    });

    document.querySelectorAll('.color-text').forEach(textInput => {
      textInput.addEventListener('input', () => {
        const linked = textInput.dataset.linked;
        if (!linked) return;
        const val = textInput.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
          this.setValue(linked, val);
          const colorInput = document.querySelector(`input[type="color"][data-path="${linked}"]`);
          if (colorInput) colorInput.value = val;
          this.onConfigChanged();
        }
      });
    });
  }

  // ── Cache Rules ──
  bindCacheRules() {
    this.renderCacheRules();
    document.getElementById('addCacheRule').addEventListener('click', () => {
      if (!this.config.cache.runtimeCache) this.config.cache.runtimeCache = [];
      this.config.cache.runtimeCache.push({
        urlPattern: '',
        strategy: 'cache-first',
        maxEntries: 50,
        maxAge: 604800
      });
      this.renderCacheRules();
      this.onConfigChanged();
    });
  }

  renderCacheRules() {
    const container = document.getElementById('cacheRules');
    const rules = this.config.cache.runtimeCache || [];
    container.innerHTML = rules.map((rule, i) => `
      <div class="cache-rule" data-index="${i}">
        <div>
          <label>URL 匹配</label>
          <input type="text" value="${rule.urlPattern || ''}" data-rule-field="urlPattern" data-rule-index="${i}" placeholder="/api/">
        </div>
        <div>
          <label>策略</label>
          <select data-rule-field="strategy" data-rule-index="${i}">
            <option value="cache-first" ${rule.strategy === 'cache-first' ? 'selected' : ''}>Cache First</option>
            <option value="network-first" ${rule.strategy === 'network-first' ? 'selected' : ''}>Network First</option>
            <option value="stale-while-revalidate" ${rule.strategy === 'stale-while-revalidate' ? 'selected' : ''}>Stale While Revalidate</option>
          </select>
        </div>
        <div>
          <label>最大条目</label>
          <input type="number" value="${rule.maxEntries || 50}" data-rule-field="maxEntries" data-rule-index="${i}" min="1">
        </div>
        <button class="cache-rule-remove" data-rule-remove="${i}" title="删除规则">×</button>
      </div>
    `).join('');

    // Bind rule inputs
    container.querySelectorAll('[data-rule-field]').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.ruleIndex, 10);
        const field = input.dataset.ruleField;
        const value = input.type === 'number' ? parseInt(input.value, 10) || 0 : input.value;
        if (this.config.cache.runtimeCache[idx]) {
          this.config.cache.runtimeCache[idx][field] = value;
          this.onConfigChanged();
        }
      });
    });

    // Bind remove buttons
    container.querySelectorAll('[data-rule-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.ruleRemove, 10);
        this.config.cache.runtimeCache.splice(idx, 1);
        this.renderCacheRules();
        this.onConfigChanged();
      });
    });
  }

  // ── Toolbar Buttons ──
  bindButtons() {
    document.getElementById('importBtn').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(reader.result);
            this.config = json;
            this.rebindAllInputs();
            this.updatePreview();
            this.showToast('配置已导入', 'success');
          } catch {
            this.showToast('JSON 格式错误', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    document.getElementById('exportBtn').addEventListener('click', async () => {
      this.showToast('正在构建...', 'success');
      try {
        const res = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.config)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Export failed' }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const version = (this.config.cache && this.config.cache.version) || '1.0.0';
        a.download = `pwa-${version}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('完整 PWA 部署包已导出', 'success');
      } catch (err) {
        this.showToast(`导出失败: ${err.message}`, 'error');
      }
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      if (!confirm('确定要重置所有配置为默认值吗？')) return;
      this.config = JSON.parse(JSON.stringify(this.defaultConfig));
      this.rebindAllInputs();
      this.updatePreview();
      this.showToast('已重置为默认配置', 'success');
    });

    document.getElementById('saveBtn').addEventListener('click', () => {
      this.saveConfig();
    });

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        this.saveConfig();
      }
    });
  }

  rebindAllInputs() {
    document.querySelectorAll('[data-path]').forEach(input => {
      const path = input.dataset.path;
      const val = this.getValue(path);
      if (input.tagName === 'TEXTAREA' && Array.isArray(val)) {
        input.value = val.join('\n');
      } else if (input.type === 'checkbox') {
        input.checked = !!val;
      } else if (input.tagName === 'SELECT' || input.tagName === 'INPUT') {
        input.value = val !== undefined ? val : '';
      }
    });
    // Sync color inputs with text inputs
    document.querySelectorAll('input[type="color"]').forEach(ci => {
      const ti = document.querySelector(`.color-text[data-linked="${ci.dataset.path}"]`);
      if (ti) ti.value = ci.value;
    });
    this.renderCacheRules();
  }

  // ── Save ──
  saveConfig() {
    localStorage.setItem('__pwa_config_draft', JSON.stringify(this.config));
    // Also try to copy to the active config
    const json = JSON.stringify(this.config, null, 2);
    localStorage.setItem('__pwa_config_active', json);
    this.showToast('配置已保存（受限于浏览器环境，请在部署时替换 pwa.config.json）', 'success');
  }

  // ── Preview ──
  onConfigChanged() {
    if (this.previewDebounce) clearTimeout(this.previewDebounce);
    this.previewDebounce = setTimeout(() => this.updatePreview(), 300);
    // Auto-save draft
    localStorage.setItem('__pwa_config_draft', JSON.stringify(this.config));
  }

  updatePreview() {
    const c = this.config;
    const ip = c.installPage;

    // App info
    document.getElementById('previewName').textContent = c.app.name;
    document.getElementById('previewDesc').textContent = ip.subtitle;
    document.getElementById('previewIcon').src = ip.icon;

    // Features
    const featuresEl = document.getElementById('previewFeatures');
    const features = ip.features || [];
    featuresEl.innerHTML = features.map(f =>
      `<div class="preview-feature">
        <span class="preview-feature-dot" style="background: var(--pwa-success, ${ip.theme.success})"></span>
        <span>${f}</span>
      </div>`
    ).join('');

    // Progress steps
    const steps = ip.progressSteps || [];
    document.getElementById('previewSteps').innerHTML = steps.map(s =>
      `<span class="preview-step-item">${s}</span>`
    ).join('');

    // Theme — inject into phone screen as inline vars
    const screen = document.getElementById('phoneScreen');
    const t = ip.theme;
    screen.style.setProperty('--pwa-primary', t.primary);
    screen.style.setProperty('--pwa-primary-hover', t.primaryHover);
    screen.style.setProperty('--pwa-surface', t.surface);
    screen.style.setProperty('--pwa-surface-bg', t.surfaceBg);
    screen.style.setProperty('--pwa-on-surface', t.onSurface);
    screen.style.setProperty('--pwa-on-surface-variant', t.onSurfaceVariant);
    screen.style.setProperty('--pwa-on-primary', t.onPrimary);
    screen.style.setProperty('--pwa-primary-container', t.primaryContainer);
    screen.style.setProperty('--pwa-outline-variant', t.outlineVariant);
    screen.style.setProperty('--pwa-star-color', t.starColor);
    screen.style.setProperty('--pwa-badge-bg', t.badgeBg);
    screen.style.setProperty('--pwa-badge-text', t.badgeText);

    // Button text
    document.getElementById('previewBtn').textContent = ip.title || '安装应用';
  }

  // ── Toast ──
  showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('hidden'), 2500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.configEditor = new ConfigEditor();
  window.configEditor.init();
});
