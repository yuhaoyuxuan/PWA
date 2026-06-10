class InstallPage {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.config = null;
    this.ringLength = 2 * Math.PI * 54; // r=54
    this.installAccepted = false; // user accepted native prompt
    this.animDone = false;        // progress animation finished
  }

  async init() {
    this.config = await configLoader.load();

    // Already installed (standalone mode) → redirect to start_url
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      this.redirectToStart();
      return;
    }

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
      this.setText('ratingCount', `(${this.formatCount(reviewCount)} avaliações)`);
    } else {
      this.setText('ratingCount', '');
    }

    // Ratings & Reviews card
    this.setText('ratingScoreValue', rating.toFixed(1));
    this.setText('ratingScoreStars', this.renderStars(rating));
    this.renderRatingDistribution(ip.ratingDistribution);
    this.renderReviews(ip.reviews);
    this.renderReviewAge(ip.reviewAgeRating);

    // Badges
    document.getElementById('badgesRow').innerHTML = (ip.badges || ['Seguro']).map(b =>
      `<span class="badge badge-safe">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        ${b}
      </span>`
    ).join('');

    // Install button
    this.setText('btnLabel', 'Instalar');
    if (ip.size) this.setText('btnSize', ip.size);

    // About
    document.getElementById('aboutCard').classList.toggle('hidden', !ip.about);
    this.setText('aboutText', ip.about || '');

    // What's New
    const hasWhatsNew = c.cache && c.cache.version;
    document.getElementById('whatsNewCard').classList.toggle('hidden', !hasWhatsNew);
    this.setText('versionValue', (c.cache && c.cache.version) || '');
    this.setText('whatsNewText', ip.whatsNew || 'Versão inicial');

    // App Info
    this.setText('infoVersion', (c.cache && c.cache.version) || '');
    this.setText('infoDate', ip.updatedDate || '2026-06-08');
    this.setText('infoSize', ip.size || '2.5 MB');
    this.setText('infoCategory', ip.category || 'Ferramentas');

    // Data Safety
    this.setText('dataSafety', ip.dataSafety || 'Este app não coleta nem compartilha nenhum dado do usuário.');
    const privacyEl = document.getElementById('privacyLink');
    if (ip.privacyUrl) {
      privacyEl.href = ip.privacyUrl;
      privacyEl.classList.remove('hidden');
    } else {
      privacyEl.classList.add('hidden');
    }

    // Page title
    document.title = `${app.name} — ${ip.subtitle || 'Instalar App'}`;
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

  renderRatingDistribution(distribution) {
    const bars = document.getElementById('ratingBars');
    if (!bars) return;
    const dist = distribution || [0, 0, 0, 0, 0];
    const max = Math.max(...dist, 1);
    // Render from 5 stars down to 1
    bars.innerHTML = [5, 4, 3, 2, 1].map(star => {
      const count = dist[star - 1];
      const pct = (count / max) * 100;
      return `<div class="rating-bar-row">
        <span class="rating-bar-label">${star}</span>
        <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${pct}%"></div></div>
        <span class="rating-bar-count">${count}</span>
      </div>`;
    }).join('');
  }

  renderReviews(reviews) {
    const list = document.getElementById('reviewsList');
    if (!list) return;
    const items = reviews || [];
    list.innerHTML = items.map((r, i) => {
      const initial = (r.user || 'U').charAt(0);
      return `<div class="review-item">
        <div class="review-header">
          <div class="review-avatar">${initial}</div>
          <div class="review-meta">
            <div class="review-user">${r.user || 'Usuário anônimo'}</div>
            <div class="review-date">${r.date || ''}</div>
          </div>
          <span class="review-stars">${this.renderStars(r.rating || 0)}</span>
        </div>
        <div class="review-content">${r.content || ''}</div>
        <button class="review-helpful" data-review-index="${i}">
          Útil (${r.helpful || 0})
        </button>
      </div>`;
    }).join('');

    // Bind helpful buttons
    list.querySelectorAll('.review-helpful').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('voted')) return;
        btn.classList.add('voted');
        const idx = parseInt(btn.dataset.reviewIndex, 10);
        const items = this.config.installPage.reviews || [];
        if (items[idx]) {
          items[idx].helpful = (items[idx].helpful || 0) + 1;
          btn.textContent = `Útil (${items[idx].helpful})`;
        }
      });
    });
  }

  renderReviewAge(ageRating) {
    const el = document.getElementById('reviewAge');
    if (!el) return;
    if (ageRating) {
      el.innerHTML = `<span class="review-age-badge">${ageRating}</span> Classificação etária`;
    } else {
      el.innerHTML = '';
    }
  }

  // ── Screenshots Carousel ──
  initScreenshots() {
    const screenshots = this.config.installPage.screenshots || [];
    const section = document.getElementById('screenshotsSection');
    if (!screenshots.length) { section.classList.add('hidden'); return; }

    const scroll = document.getElementById('screenshotsScroll');
    const dots = document.getElementById('screenshotDots');

    scroll.innerHTML = screenshots.map((url, i) => {
      const isGif = /\.gif(\?.*)?$/i.test(url);
      return `<div class="screenshot-item${isGif ? ' is-gif' : ''}" data-index="${i}">
        <img src="${url}" alt="Screenshot ${i + 1}" loading="lazy">
      </div>`;
    }).join('');

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
      this.installAccepted = true;
      this.tryComplete();
    });

    // If no beforeinstallprompt fires within 2s, enable button as redirect
    setTimeout(() => {
      if (!this.deferredPrompt) {
        this.enableInstallButtons();
      }
    }, 2000);
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
    // No native prompt available → redirect to start_url directly
    if (!this.deferredPrompt) {
      this.redirectToStart();
      return;
    }

    // Start progress animation
    this.animateProgress();

    try {
      await this.deferredPrompt.prompt();
      const result = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      if (result.outcome === 'accepted') {
        this.installAccepted = true;
        this.tryComplete();
      } else {
        this.resetUI();
      }
    } catch {
      this.resetUI();
    }
  }

  // ── Progress Animation ──
  animateProgress() {
    const steps = this.config.installPage.progressSteps || ['Baixando...', 'Instalando...', 'Concluído'];
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
    document.getElementById('installStepText').textContent = 'Instalação concluída';
    document.getElementById('installCheck').classList.add('show');
    this.setButtonState('success');
    this.animDone = true;
    this.tryComplete();
  }

  tryComplete() {
    // Only redirect when both animation is done AND user accepted install
    if (this.animDone && this.installAccepted) {
      this.completeInstallUI();
    }
  }

  completeInstallUI() {
    localStorage.setItem('__pwa_launched', '1');
    sessionStorage.removeItem('__pwa_routed');
    document.getElementById('installStepText').textContent = '✓ Redirecionando para o app...';
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
        label.textContent = 'Instalando...';
        stickyBtn.textContent = 'Instalando';
        btn.disabled = true;
        stickyBtn.disabled = true;
        break;
      case 'success':
        btn.classList.add('success');
        label.textContent = '✓ Instalado';
        stickyBtn.textContent = 'Instalado';
        break;
      default:
        label.textContent = 'Instalar';
        stickyBtn.textContent = 'Instalar';
        btn.disabled = false;
        stickyBtn.disabled = false;
    }
  }

  resetUI() {
    this.installAccepted = false;
    this.animDone = false;
    this.setButtonState('default');
    this.setProgress(0);
    document.getElementById('progressRing').classList.remove('active');
    document.getElementById('installProgressBar').classList.remove('active');
    document.getElementById('stickyProgressBar').classList.remove('active');
    document.getElementById('installCheck').classList.remove('show');
    document.getElementById('installStepText').textContent = 'Instalação cancelada';
  }

  redirectToStart() {
    localStorage.setItem('__pwa_launched', '1');
    sessionStorage.removeItem('__pwa_routed');
    window.location.replace(this.config.app.start_url || './app.html');
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
