class SWRegister {
  constructor() {
    this.registration = null;
    this.updateAvailable = false;
    this.promptEl = null;
  }

  async register() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('SW registered:', this.registration.scope);
    } catch (err) {
      console.error('SW registration failed:', err);
      return;
    }

    this.listenUpdates();
  }

  listenUpdates() {
    if (!this.registration) return;

    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.onUpdateAvailable();
        }
      });
    });

    // Periodic check
    const config = window.configLoader ? window.configLoader.config : null;
    const interval = (config && config.update && config.update.checkInterval) || 3600000;
    if (interval > 0) {
      setInterval(() => {
        if (this.registration) this.registration.update();
      }, interval);
    }
  }

  onUpdateAvailable() {
    if (window.configLoader && window.configLoader.config) {
      const updateCfg = window.configLoader.config.update;
      if (updateCfg && updateCfg.autoUpdate) {
        this.applyUpdate();
        return;
      }
      if (updateCfg && !updateCfg.promptUser) return;
    }

    this.showUpdateBanner();
  }

  showUpdateBanner() {
    if (this.promptEl) return;
    this.promptEl = document.createElement('div');
    this.promptEl.className = 'update-banner';
    Object.assign(this.promptEl.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '10000',
      background: 'var(--pwa-card-bg, #1e293b)',
      color: 'var(--pwa-text, #f8fafc)',
      padding: '16px 24px',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      fontFamily: 'var(--pwa-font, sans-serif)',
      fontSize: '14px',
      animation: 'slideUp 0.3s ease-out'
    });
    this.promptEl.innerHTML = `
      <span>新版本可用</span>
      <button class="update-apply-btn" style="
        background: var(--pwa-primary, #3b82f6);
        color: #fff; border: none;
        padding: 8px 16px; border-radius: 6px;
        cursor: pointer; font-weight: 600; font-size: 13px;
      ">立即更新</button>
      <button class="update-dismiss-btn" style="
        background: transparent; color: var(--pwa-text-secondary, #94a3b8);
        border: 1px solid var(--pwa-text-secondary, #94a3b8);
        padding: 8px 16px; border-radius: 6px;
        cursor: pointer; font-size: 13px;
      ">稍后</button>
    `;

    this.promptEl.querySelector('.update-apply-btn').addEventListener('click', () => {
      this.applyUpdate();
    });
    this.promptEl.querySelector('.update-dismiss-btn').addEventListener('click', () => {
      this.promptEl.remove();
      this.promptEl = null;
    });

    // Inject keyframes if not present
    if (!document.getElementById('sw-update-style')) {
      const style = document.createElement('style');
      style.id = 'sw-update-style';
      style.textContent = '@keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }';
      document.head.appendChild(style);
    }

    document.body.appendChild(this.promptEl);
  }

  applyUpdate() {
    if (this.promptEl) {
      this.promptEl.remove();
      this.promptEl = null;
    }
    if (!this.registration || !this.registration.waiting) return;

    // Listen for the new worker to become active, then reload
    this.registration.waiting.addEventListener('statechange', (e) => {
      if (e.target.state === 'activated') {
        window.location.reload();
      }
    });

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Auto-register on pages that need it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.swRegister = new SWRegister();
    window.swRegister.register();
  });
} else {
  window.swRegister = new SWRegister();
  window.swRegister.register();
}
