class ConfigLoader {
  constructor() {
    this.config = null;
    this.defaultConfigPath = './pwa.config.json';
  }

  async load(configPath) {
    const path = configPath || this.defaultConfigPath;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(path, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Config load failed: ${res.status}`);
      this.config = await res.json();
      this.injectCSSVariables();
      this.injectMetaTags();
      return this.config;
    } catch (err) {
      console.error('Failed to load PWA config, using defaults:', err.message);
      this.config = this.getDefaults();
      this.injectCSSVariables();
      return this.config;
    }
  }

  injectCSSVariables() {
    const t = this.config.installPage.theme;
    const root = document.documentElement;
    const vars = {
      '--pwa-primary': t.primary,
      '--pwa-primary-hover': t.primaryHover,
      '--pwa-primary-dark': t.primaryDark || t.primaryHover,
      '--pwa-surface': t.surface,
      '--pwa-surface-bg': t.surfaceBg,
      '--pwa-on-surface': t.onSurface,
      '--pwa-on-surface-variant': t.onSurfaceVariant,
      '--pwa-on-primary': t.onPrimary,
      '--pwa-primary-container': t.primaryContainer,
      '--pwa-outline-variant': t.outlineVariant,
      '--pwa-star-color': t.starColor,
      '--pwa-badge-bg': t.badgeBg,
      '--pwa-badge-text': t.badgeText,
      '--pwa-skeleton': t.skeleton,
      '--pwa-skeleton-shine': t.skeletonShine,
      '--pwa-theme-color': this.config.app.theme_color,
    };
    Object.entries(vars).forEach(([k, v]) => {
      if (v) root.style.setProperty(k, v);
    });
  }

  injectMetaTags() {
    const setMeta = (name, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };
    setMeta('theme-color', this.config.app.theme_color);
    setMeta('description', this.config.app.description);
    document.title = this.config.installPage.title;
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && this.config.installPage.icon) {
      favicon.href = this.config.installPage.icon;
    }
  }

  get(key) {
    if (!this.config) return undefined;
    return key.split('.').reduce((o, k) => (o || {})[k], this.config);
  }

  getDefaults() {
    return {
      app: {
        name: 'PWA App', short_name: 'App', developer: 'Developer',
        description: '', start_url: './app.html', scope: '.',
        theme_color: '#ffffff', background_color: '#ffffff',
        display: 'standalone', orientation: 'portrait-primary'
      },
      installPage: {
        title: 'Install App', subtitle: 'Add to home screen',
        icon: './assets/icons/icon-512.png', screenshots: [],
        rating: 4.5, reviewCount: 0, badges: ['Seguro'],
        size: '2.5 MB', category: 'Ferramentas', updatedDate: '',
        about: '', whatsNew: '', dataSafety: 'Este app não coleta nem compartilha nenhum dado do usuário.',
        privacyUrl: '',
        features: [], progressSteps: ['Downloading', 'Installing', 'Done'],
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
      cache: { version: '1.0.0', precache: [], runtimeCache: [], offlineFallback: './offline.html' },
      update: { autoUpdate: false, promptUser: true, checkInterval: 3600000 }
    };
  }
}

window.configLoader = new ConfigLoader();
