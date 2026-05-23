/**
 * MilestoneGate (PayGate.io) — Dashboard Controller
 *
 * Renders milestone stats, cards, outreach templates, and manages
 * the "Create Milestone" modal workflow.
 *
 * Depends on: App (app.js), data.js globals
 */

const Dashboard = (() => {
  /* ------------------------------------------------------------------ */
  /*  Initialization                                                     */
  /* ------------------------------------------------------------------ */

  /** Set up the entire dashboard view. */
  const init = () => {
    renderStats();
    renderMilestones();
    renderOutreach();
    setupCreateModal();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  /* ------------------------------------------------------------------ */
  /*  Stats                                                              */
  /* ------------------------------------------------------------------ */

  /** Render four summary stat cards into #dashStats. */
  const renderStats = () => {
    const container = document.getElementById('dashStats');
    if (!container) return;

    const milestones = App.state.milestones;
    const totalMilestones = milestones.length;
    const pendingReview = milestones.filter((m) => m.status !== 'paid').length;
    const revenueCollected = milestones
      .filter((m) => m.status === 'paid')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const activeClients = new Set(milestones.map((m) => m.clientName)).size;

    const stats = [
      { label: 'Total Milestones', value: totalMilestones, cls: 'text-primary' },
      { label: 'Pending Review', value: pendingReview, cls: 'text-amber' },
      { label: 'Revenue Collected', value: formatCurrency(revenueCollected), cls: 'text-emerald' },
      { label: 'Active Clients', value: activeClients, cls: 'text-cyan' },
    ];

    container.innerHTML = stats
      .map(
        (s) => `
      <div class="stat-card">
        <div class="stat-value ${s.cls}">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`
      )
      .join('');
  };

  /* ------------------------------------------------------------------ */
  /*  Milestone Cards                                                    */
  /* ------------------------------------------------------------------ */

  /** Render all milestone cards or an empty-state placeholder. */
  const renderMilestones = () => {
    const container = document.getElementById('milestoneGrid');
    if (!container) return;

    const milestones = App.state.milestones;

    if (milestones.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3 class="empty-state-title">No milestones yet</h3>
          <p>Create your first milestone to get started.</p>
          <button class="btn btn-primary" id="btnCreateFirstMilestone">Create Milestone</button>
        </div>`;

      const btn = document.getElementById('btnCreateFirstMilestone');
      if (btn) btn.addEventListener('click', () => openCreateModal());
      return;
    }

    container.innerHTML = milestones
      .map((ms) => {
        const cfg = FILE_TYPE_CONFIG[ms.fileType] || FILE_TYPE_CONFIG['design'] || {};
        const gradientClass = cfg.gradientClass || '';
        const statusText = ms.status.charAt(0).toUpperCase() + ms.status.slice(1);

        return `
        <div class="milestone-card">
          <div class="milestone-card-preview ${gradientClass}">
            <span class="preview-emoji">${ms.previewEmoji || '📄'}</span>
          </div>
          <div class="milestone-card-body">
            <h3 class="milestone-card-title">${ms.title}</h3>
            <p class="milestone-card-client">For ${ms.clientName} • ${formatDate(ms.createdAt)}</p>
            <div class="milestone-card-meta">
              <span class="milestone-amount">${formatCurrency(ms.amount)}</span>
              <span class="milestone-status status-${ms.status}">
                <span class="status-dot"></span>
                ${statusText}
              </span>
            </div>
            <div class="milestone-card-actions">
              <button class="btn btn-sm btn-secondary btn-copy-link" data-id="${ms.id}">Copy Link</button>
              <button class="btn btn-sm btn-primary btn-open-portal" data-id="${ms.id}">Open Portal</button>
            </div>
          </div>
        </div>`;
      })
      .join('');

    // Attach event listeners via delegation
    container.addEventListener('click', handleCardClick);
  };

  /**
   * Delegated click handler for milestone card action buttons.
   * @param {MouseEvent} e
   */
  const handleCardClick = (e) => {
    const copyBtn = e.target.closest('.btn-copy-link');
    const portalBtn = e.target.closest('.btn-open-portal');

    if (copyBtn) {
      const id = copyBtn.dataset.id;
      const link = `${window.location.origin}${window.location.pathname}#portal/${id}`;
      copyToClipboard(link);
      App.toast.show('Portal link copied to clipboard!', 'success');
    }

    if (portalBtn) {
      const id = portalBtn.dataset.id;
      App.router.navigate(`#portal/${id}`);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Outreach Templates                                                 */
  /* ------------------------------------------------------------------ */

  /** Render outreach template cards into #outreachSection. */
  const renderOutreach = () => {
    const container = document.getElementById('outreachSection');
    if (!container) return;

    container.innerHTML = OUTREACH_TEMPLATES
      .map(
        (tpl, i) => `
      <div class="outreach-card">
        <div class="outreach-header">
          <h4 class="outreach-title">${tpl.title}</h4>
          <button class="btn btn-sm btn-ghost btn-copy-outreach" data-index="${i}">Copy</button>
        </div>
        <div class="outreach-body">${tpl.body}</div>
      </div>`
      )
      .join('');

    // Copy handlers
    container.querySelectorAll('.btn-copy-outreach').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        const body = OUTREACH_TEMPLATES[idx]?.body || '';
        copyToClipboard(body);
        App.toast.show('Template copied to clipboard!', 'success');
      });
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Create Milestone Modal                                             */
  /* ------------------------------------------------------------------ */

  let listenersSetup = false;

  /** Attach modal open/close/submit handlers once. */
  const setupCreateModal = () => {
    if (listenersSetup) return;
    listenersSetup = true;

    const btnOpen = document.getElementById('btnCreateMilestone');
    if (btnOpen) btnOpen.addEventListener('click', openCreateModal);

    const btnClose = document.getElementById('closeCreateModal');
    if (btnClose) btnClose.addEventListener('click', closeCreateModal);

    const btnCancel = document.getElementById('cancelCreateModal');
    if (btnCancel) btnCancel.addEventListener('click', closeCreateModal);

    const btnSubmit = document.getElementById('submitCreateMilestone');
    if (btnSubmit) btnSubmit.addEventListener('click', handleCreateSubmit);
  };

  /** Show the create-milestone modal. */
  const openCreateModal = () => {
    const modal = document.getElementById('createMilestoneModal');
    if (modal) modal.classList.add('active');
  };

  /** Hide the create-milestone modal. */
  const closeCreateModal = () => {
    const modal = document.getElementById('createMilestoneModal');
    if (modal) modal.classList.remove('active');
  };

  /** Validate form, create milestone, and refresh. */
  const handleCreateSubmit = () => {
    const title = (document.getElementById('msTitle')?.value || '').trim();
    const clientName = (document.getElementById('msClient')?.value || '').trim();
    const clientEmail = (document.getElementById('msClientEmail')?.value || '').trim();
    const amountRaw = (document.getElementById('msAmount')?.value || '').trim();
    const fileType = document.getElementById('msFileType')?.value || 'design';
    const description = (document.getElementById('msDescription')?.value || '').trim();
    const previewEmoji = (document.getElementById('msEmoji')?.value || '🎨').trim();
    const dueDate = (document.getElementById('msDueDate')?.value || '');
    const previewLabel = (document.getElementById('msPreviewLabel')?.value || title).trim();

    // Validation
    if (!title || !clientName || !amountRaw) {
      App.toast.show('Please fill in Title, Client Name, and Amount.', 'error');
      return;
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0) {
      App.toast.show('Amount must be a positive number.', 'error');
      return;
    }

    const milestone = {
      id: generateId(),
      title,
      clientName,
      clientEmail,
      amount,
      fileType,
      description,
      previewEmoji: previewEmoji || '🎨',
      previewLabel: previewLabel || title,
      status: 'pending',
      comments: [],
      createdAt: new Date().toISOString(),
      dueDate: dueDate || null,
    };

    App.addMilestone(milestone);

    // Clear form
    ['msTitle', 'msClient', 'msClientEmail', 'msAmount', 'msDescription', 'msEmoji', 'msDueDate', 'msPreviewLabel'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    closeCreateModal();
    App.toast.show('Milestone created successfully!', 'success');
    init(); // refresh dashboard
  };

  /* ------------------------------------------------------------------ */
  /*  Clipboard Utility                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Copy text to the system clipboard.
   * @param {string} text
   */
  const copyToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  /** Fallback copy using a temporary textarea. */
  const fallbackCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (_) {
      /* noop */
    }
    document.body.removeChild(ta);
  };

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return { init };
})();
