/**
 * MilestoneGate (PayGate.io) — Main Application Controller
 *
 * Provides global state management, hash-based routing, landing page
 * rendering, localStorage persistence, toast notifications, and
 * mobile navigation toggling.
 *
 * Depends on data.js globals:
 *   SAMPLE_MILESTONES, OUTREACH_TEMPLATES, FILE_TYPE_CONFIG,
 *   PRICING_TIERS, LANDING_FEATURES, LANDING_STATS,
 *   generateId, formatCurrency, formatDate, timeAgo
 */

const App = (() => {
  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  const STORAGE_KEY = 'paygate_milestones';

  /** @type {{ milestones: Array, currentView: string, activePortalId: string|null }} */
  const state = {
    milestones: [],
    currentView: 'home',
    activePortalId: null,
  };

  /* ------------------------------------------------------------------ */
  /*  Storage Helpers                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Fetch all milestones from the server database.
   */
  const loadMilestones = async () => {
    try {
      const res = await fetch('/api/milestones');
      if (res.ok) {
        state.milestones = await res.json();
      } else {
        console.error('Failed to load milestones from server');
      }
    } catch (err) {
      console.error('Network error loading milestones:', err);
    }
  };

  /**
   * Find a milestone in the local state.
   * @param {string} id
   * @returns {object|undefined}
   */
  const getMilestone = (id) => state.milestones.find((m) => m.id === id);

  /**
   * Merge partial updates into a milestone in the local state.
   * @param {string} id
   * @param {object} updates
   */
  const updateMilestone = (id, updates) => {
    const ms = getMilestone(id);
    if (!ms) return;
    Object.assign(ms, updates);
  };



  /* ------------------------------------------------------------------ */
  /*  Toast Notification System                                          */
  /* ------------------------------------------------------------------ */

  const toast = {
    /**
     * Display a brief toast message.
     * @param {string} message
     * @param {'success'|'error'|'info'} [type='info']
     */
    show(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.textContent = message;
      container.appendChild(el);

      // Trigger entrance (allow paint before adding .active for transitions)
      requestAnimationFrame(() => el.classList.add('active'));

      setTimeout(() => {
        el.classList.remove('active');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        // Fallback removal in case transitionend doesn't fire
        setTimeout(() => el.remove(), 500);
      }, 3000);
    },
  };

  /* ------------------------------------------------------------------ */
  /*  Router                                                             */
  /* ------------------------------------------------------------------ */

  const router = {
    /**
     * Programmatically navigate to a hash route.
     * @param {string} hash — e.g. '#dashboard', '#portal/abc123'
     */
    navigate(hash) {
      window.location.hash = hash;
    },

    /** Parse current hash and activate the matching view. */
    handleRoute() {
      const hash = window.location.hash || '#home';
      const parts = hash.replace('#', '').split('/');
      const route = parts[0] || 'home';

      // Resolve target view id
      let viewId;
      switch (route) {
        case 'dashboard':
          viewId = 'dashboard';
          break;
        case 'portal':
          viewId = 'portal';
          break;
        case 'home':
        default:
          viewId = 'home';
          break;
      }

      // Toggle .active on view elements
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      const targetView = document.getElementById(`${viewId}View`) ||
                         document.getElementById(viewId);
      if (targetView) targetView.classList.add('active');

      // Toggle theme-light class on body for client portal
      if (route === 'portal') {
        document.body.classList.add('theme-light');
      } else {
        document.body.classList.remove('theme-light');
      }

      // Update navbar active states
      document.querySelectorAll('.navbar-links a').forEach((link) => {
        const linkHash = link.getAttribute('href') || '';
        if (linkHash === `#${route}` || (route === 'home' && linkHash === '#home')) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      state.currentView = route;

      // Close mobile nav when navigating
      const navLinks = document.getElementById('navLinks');
      if (navLinks) navLinks.classList.remove('mobile-open');

      // Delegate to sub-controllers
      if (route === 'portal') {
        const idWithQuery = parts[1] || '';
        const milestoneId = idWithQuery.split('?')[0];
        state.activePortalId = milestoneId;
        if (typeof Portal !== 'undefined') Portal.init(idWithQuery);
      } else if (route === 'dashboard') {
        if (typeof Dashboard !== 'undefined') Dashboard.init();
      } else {
        renderLanding();
      }

      // Refresh Lucide icons for newly rendered DOM
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },
  };

  /* ------------------------------------------------------------------ */
  /*  Landing Page Rendering                                             */
  /* ------------------------------------------------------------------ */

  /** Render the home / landing page sections. */
  const renderLanding = () => {
    renderLandingStats();
    renderFeatures();
    renderPricing();
    initROICalculator();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  /** Populate #landingStats with stat cards. */
  const renderLandingStats = () => {
    const container = document.getElementById('landingStats');
    if (!container) return;

    container.innerHTML = LANDING_STATS
      .map(
        (stat) => `
      <div class="stat-card">
        <div class="stat-value text-gradient">${stat.value}</div>
        <div class="stat-label">${stat.label}</div>
      </div>`
      )
      .join('');
  };

  /** Populate #featuresGrid with feature cards. */
  const renderFeatures = () => {
    const container = document.getElementById('featuresGrid');
    if (!container) return;

    container.innerHTML = LANDING_FEATURES
      .map(
        (feat) => `
      <div class="feature-card">
        <div class="feature-icon">${feat.icon}</div>
        <div class="feature-title">${feat.title}</div>
        <div class="feature-desc">${feat.description}</div>
      </div>`
      )
      .join('');
  };

  /** Populate #pricingGrid with pricing tier cards. */
  const renderPricing = () => {
    const container = document.getElementById('pricingGrid');
    if (!container) return;

    container.innerHTML = PRICING_TIERS
      .map(
        (tier) => `
      <div class="pricing-card${tier.featured ? ' featured' : ''}">
        <h3 class="pricing-title">${tier.name}</h3>
        <div class="pricing-price">${tier.price}</div>
        <p class="pricing-desc">${tier.description || ''}</p>
        <ul class="pricing-features">
          ${(tier.features || []).map((f) => `<li>${f}</li>`).join('')}
        </ul>
        <button class="btn ${tier.featured ? 'btn-primary' : 'btn-secondary'}">${tier.cta || 'Get Started'}</button>
      </div>`
      )
      .join('');
  };

  /** Initialize the interactive ROI calculator on the landing page. */
  const initROICalculator = () => {
    const sliderIncome = document.getElementById('roiMonthlyIncome');
    const sliderHours = document.getElementById('roiChasingHours');
    const sliderScope = document.getElementById('roiScopeCreepPct');

    if (!sliderIncome || !sliderHours || !sliderScope) return;

    const valIncome = document.getElementById('valMonthlyIncome');
    const valHours = document.getElementById('valChasingHours');
    const valScope = document.getElementById('valScopeCreepPct');

    const resLeaked = document.getElementById('resRevenueLeaked');
    const resTimeLost = document.getElementById('resTimeLost');
    const resRecovered = document.getElementById('resRevenueRecovered');

    const updateCalc = () => {
      const income = parseInt(sliderIncome.value);
      const hours = parseInt(sliderHours.value);
      const scopePct = parseInt(sliderScope.value);

      // Display values
      if (valIncome) valIncome.textContent = `$${income.toLocaleString()}`;
      if (valHours) valHours.textContent = `${hours}h`;
      if (valScope) valScope.textContent = `${scopePct}%`;

      // Leakage logic:
      const hourlyRate = income / 160;
      const annualTimeLost = hours * 12;
      const annualRevenueLeaked = Math.round(income * (scopePct / 100) * 1.5 * 12);
      
      const annualTimeValue = Math.round(annualTimeLost * hourlyRate);
      const annualRecovered = Math.round(annualRevenueLeaked * 0.95 + annualTimeValue);

      // Render results
      if (resLeaked) resLeaked.textContent = `$${annualRevenueLeaked.toLocaleString()}`;
      if (resTimeLost) resTimeLost.textContent = `${annualTimeLost} hrs`;
      if (resRecovered) resRecovered.textContent = `$${annualRecovered.toLocaleString()}`;
    };

    sliderIncome.addEventListener('input', updateCalc);
    sliderHours.addEventListener('input', updateCalc);
    sliderScope.addEventListener('input', updateCalc);

    // Initial run
    updateCalc();
  };

  /* ------------------------------------------------------------------ */
  /*  Mobile Navigation                                                  */
  /* ------------------------------------------------------------------ */

  const setupMobileNav = () => {
    const toggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    if (toggle && navLinks) {
      toggle.addEventListener('click', () => {
        navLinks.classList.toggle('mobile-open');
      });
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Initialization                                                     */
  /* ------------------------------------------------------------------ */

  /** Boot the application. */
  const init = async () => {
    // Load milestones from server
    await loadMilestones();

    // Wire up hashchange
    window.addEventListener('hashchange', () => router.handleRoute());

    // Mobile nav
    setupMobileNav();

    // Initial route
    router.handleRoute();
  };

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    state,
    router,
    toast,
    init,
    renderLanding,
    loadMilestones,
    getMilestone,
    updateMilestone,
  };
})();

// App object is exported to the global scope. App.init() is called in index.html.
