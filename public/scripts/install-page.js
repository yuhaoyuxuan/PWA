class InstallPage {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.config = null;
    this.ringLength = 2 * Math.PI * 54; // r=54
  }

  async init() {
    this.config = await configLoader.load();
    this.populateContent();
    this.initScreenshots();
    this.initStickyHeader();
    this.listenInstallPrompt();
    this.detectPlatform();
    this.bindButtons();
  }

  // ── Content Population ──
  populateContent() {
    const c = this.config;
    const ip = c.installPage;
    const app = c.app;

    // Hero
    this.setText('appName', app.name);
    this.setText('appDev', app.developer || app.short_name);
    this.setImage('appIcon', ip.icon);
    this.setImage('stickyIcon', ip.icon);
    this.setText('stickyName', app.name);
    this.setText('stickyDev', app.developer || app.short_name);

    // Rating
    const rating = ip.rating || 4.5;
    const reviewCount = ip.reviewCount || 0;
    this.setText('ratingStars', this.renderStars(rating));
    this.setText('ratingValue', rating.toFixed(1));
    if (reviewCount > 0) {
      this.setText('ratingCount', `(${this.formatCount(reviewCount)} reviews)`);
    } else {
      this.setText('ratingCount', '');
    }

    // Badges
    document.getElementById('badgesRow').innerHTML = (ip.badges || ['安全']).map(b =>
      `<span class="badge badge-safe">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        ${b}
      </span>`
    ).join('');

    // Install button
    this.setText('btnLabel', '安装');
    if (ip.size) this.setText('btnSize', ip.size);

    // About
    document.getElementById('aboutCard').classList.toggle('hidden', !ip.about);
    this.setText('aboutText', ip.about || '');

    // What's New
    const hasWhatsNew = c.cache && c.cache.version;
    document.getElementById('whatsNewCard').classList.toggle('hidden', !hasWhatsNew);
    this.setText('versionValue', (c.cache && c.cache.version) || '');
    this.setText('whatsNewText', ip.whatsNew || '初始版本');

    // App Info
    this.setText('infoVersion', (c.cache && c.cache.version) || '');
    this.setText('infoDate', ip.updatedDate || '2026-06-08');
    this.setText('infoSize', ip.size || '2.5 MB');
    this.setText('infoCategory', ip.category || '工具');

    // Data Safety
    this.setText('dataSafety', ip.dataSafety || '此应用不会收集或分享任何用户数据。');
    const privacyEl = document.getElementById('privacyLink');
    if (ip.privacyUrl) {
      privacyEl.href = ip.privacyUrl;
      privacyEl.classList.remove('hidden');
    } else {
      privacyEl.classList.add('hidden');
    }

    // Page title
    document.title = `${app.name} — ${ip.subtitle || '安装应用'}`;
  }

  renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  }

  formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return n.toString();
  }

  // ── Screenshots Carousel ──
  initScreenshots() {
    const screenshots = this.config.installPage.screenshots || [];
    const section = document.getElementById('screenshotsSection');
    if (!screenshots.length) { section.classList.add('hidden'); return; }

    const scroll = document.getElementById('screenshotsScroll');
    const dots = document.getElementById('screenshotDots');

    scroll.innerHTML = screenshots.map((url, i) =>
      `<div class="screenshot-item" data-index="${i}">
        <img src="${url}" alt="Screenshot ${i + 1}" loading="lazy">
      </div>`
    ).join('');

    dots.innerHTML = screenshots.map((_, i) =>
      `<button class="screenshot-dot${i === 0 ? ' active' : ''}" data-index="${i}"></button>`
    ).join('');

    // Scroll tracking
    let scrollTimeout;
    scroll.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => this.updateDots(scroll), 100);
    });

    // Dot click navigation
    dots.querySelectorAll('.screenshot-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.index);
        const item = scroll.querySelector(`[data-index="${idx}"]`);
        if (item) item.scrollIntoView({ behavior: 'smooth', inline: 'start' });
      });
    });
  }

  updateDots(scroll) {
    const items = scroll.querySelectorAll('.screenshot-item');
    if (!items.length) return;
    const scrollCenter = scroll.scrollLeft + scroll.offsetWidth / 2;
    let closest = 0, closestDist = Infinity;
    items.forEach((item, i) => {
      const dist = Math.abs(item.offsetLeft + item.offsetWidth / 2 - scrollCenter);
      if (dist < closestDist) { closest = i; closestDist = dist; }
    });
    document.querySelectorAll('.screenshot-dot').forEach((d, i) => {
      d.classList.toggle('active', i === closest);
    });
  }

  // ── Sticky Header ──
  initStickyHeader() {
    const header = document.getElementById('stickyHeader');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('visible', window.scrollY > 200);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ── Install Flow ──
  listenInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.enableInstallButtons();
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.completeInstallUI();
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      this.redirectToStart();
    }
  }

  detectPlatform() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isIOS && isSafari) {
      this.disableInstallButtons();
      document.getElementById('iosGuide').classList.remove('hidden');
    }
  }

  bindButtons() {
    const handler = () => this.startInstall();
    document.getElementById('installBtn').addEventListener('click', handler);
    document.getElementById('stickyInstallBtn').addEventListener('click', handler);

    document.getElementById('iosGuideClose').addEventListener('click', () => {
      document.getElementById('iosGuide').classList.add('hidden');
    });
  }

  enableInstallButtons() {
    document.getElementById('installBtn').disabled = false;
    document.getElementById('stickyInstallBtn').disabled = false;
  }

  disableInstallButtons() {
    document.getElementById('installBtn').classList.add('hidden');
    document.getElementById('stickyInstallBtn').classList.add('hidden');
  }

  async startInstall() {
    if (!this.deferredPrompt) return;

    // Start progress animation
    this.animateProgress();

    try {
      await this.deferredPrompt.prompt();
      const result = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      if (result.outcome !== 'accepted') {
        this.resetUI();
      }
    } catch {
      this.resetUI();
    }
  }

  // ── Progress Animation ──
  animateProgress() {
    const steps = this.config.installPage.progressSteps || ['下载中', '安装中', '完成'];
    const duration = this.config.installPage.progressDuration || 3000;
    const stepCount = steps.length;
    const perStep = duration / stepCount;

    // Show progress elements
    this.setButtonState('installing');
    document.getElementById('progressRing').classList.add('active');
    document.getElementById('installProgressBar').classList.add('active');
    document.getElementById('stickyProgressBar').classList.add('active');

    let currentStep = 0;

    const advanceStep = () => {
      if (currentStep >= stepCount) return;
      document.getElementById('installStepText').textContent = steps[currentStep];

      const startPct = (currentStep / stepCount) * 100;
      const endPct = ((currentStep + 1) / stepCount) * 100;
      const startTime = performance.now();
      const segDuration = perStep + (currentStep === stepCount - 1 ? 300 : 0);

      const tick = (now) => {
        const elapsed = now - startTime;
        const ratio = Math.min(elapsed / segDuration, 1);
        const eased = this.easeOutCubic(ratio);
        const current = startPct + (endPct - startPct) * eased;

        this.setProgress(current);

        if (ratio < 1) {
          requestAnimationFrame(tick);
        } else {
          currentStep++;
          if (currentStep < stepCount) {
            advanceStep();
          } else {
            this.finishProgress();
          }
        }
      };
      requestAnimationFrame(tick);
    };

    advanceStep();
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  setProgress(pct) {
    // Ring
    const offset = this.ringLength - (pct / 100) * this.ringLength;
    document.getElementById('ringFill').style.strokeDashoffset = offset;

    // Bottom bar
    document.getElementById('installProgressFill').style.width = pct + '%';
    // Sticky bar
    document.getElementById('stickyProgressFill').style.width = pct + '%';
  }

  finishProgress() {
    this.setProgress(100);
    document.getElementById('installStepText').textContent = '安装完成';
    document.getElementById('installCheck').classList.add('show');
    this.setButtonState('success');

    setTimeout(() => {
      this.completeInstallUI();
    }, 600);
  }

  completeInstallUI() {
    localStorage.setItem('__pwa_launched', '1');
    sessionStorage.removeItem('__pwa_routed');
    document.getElementById('installStepText').textContent = '✓ 即将跳转到应用';
    setTimeout(() => this.redirectToStart(), 400);
  }

  setButtonState(state) {
    const btn = document.getElementById('installBtn');
    const stickyBtn = document.getElementById('stickyInstallBtn');
    const label = document.getElementById('btnLabel');

    btn.classList.remove('installing', 'success');
    stickyBtn.classList.remove('installing', 'success');

    switch (state) {
      case 'installing':
        btn.classList.add('installing');
        stickyBtn.classList.add('installing');
        label.textContent = '安装中...';
        stickyBtn.textContent = '安装中';
        btn.disabled = true;
        stickyBtn.disabled = true;
        break;
      case 'success':
        btn.classList.add('success');
        label.textContent = '✓ 已安装';
        stickyBtn.textContent = '已安装';
        break;
      default:
        label.textContent = '安装';
        stickyBtn.textContent = '安装';
        btn.disabled = false;
        stickyBtn.disabled = false;
    }
  }

  resetUI() {
    this.setButtonState('default');
    this.setProgress(0);
    document.getElementById('progressRing').classList.remove('active');
    document.getElementById('installProgressBar').classList.remove('active');
    document.getElementById('stickyProgressBar').classList.remove('active');
    document.getElementById('installCheck').classList.remove('show');
    document.getElementById('installStepText').textContent = '安装已取消';
  }

  redirectToStart() {
    localStorage.setItem('__pwa_launched', '1');
    sessionStorage.removeItem('__pwa_routed');
    window.location.replace(this.config.app.start_url || '/app.html');
  }

  // ── Helpers ──
  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  setImage(id, src) {
    const el = document.getElementById(id);
    if (el && src) el.src = src;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.installPage = new InstallPage();
  window.installPage.init();
});
