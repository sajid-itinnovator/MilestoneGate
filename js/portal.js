/**
 * MilestoneGate (PayGate.io) — Portal Controller
 *
 * Manages the client-facing portal view: file preview with watermark,
 * pin-based commenting, invoice rendering, and the checkout / payment
 * flow with confetti celebration.
 *
 * Depends on: App (app.js), data.js globals
 */

const Portal = (() => {
  /* ------------------------------------------------------------------ */
  /*  Portal State                                                       */
  /* ------------------------------------------------------------------ */

  /** @type {object|null} Current milestone being viewed. */
  let milestone = null;

  /** @type {{ x: number, y: number }|null} Pending pin coordinates (%). */
  let pendingPin = null;

  /* ------------------------------------------------------------------ */
  /*  Initialization                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Boot the portal for a given milestone.
   * @param {string} milestoneId
   */
  const init = (milestoneId) => {
    milestone = App.getMilestone(milestoneId);

    if (!milestone) {
      App.toast.show('Milestone not found.', 'error');
      App.router.navigate('#dashboard');
      return;
    }

    pendingPin = null;

    renderPreview();
    renderInvoice();
    renderComments();
    setupEventListeners();

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  /* ------------------------------------------------------------------ */
  /*  Preview Rendering                                                  */
  /* ------------------------------------------------------------------ */

  /** Render the file preview area and watermark overlay. */
  const renderPreview = () => {
    const titleEl = document.getElementById('portalPreviewTitle');
    if (titleEl) titleEl.textContent = milestone.title;

    // Status badge
    updateStatusBadge();

    // Build preview canvas content
    const canvas = document.getElementById('previewCanvas');
    if (!canvas) return;

    // Remove previous preview content (keep #watermarkOverlay)
    canvas.querySelectorAll(':scope > :not(#watermarkOverlay)').forEach((el) => el.remove());

    const cfg = FILE_TYPE_CONFIG[milestone.fileType] || {};
    const gradientColors = milestone.thumbnailGradient || cfg.gradientColors || ['#6C5CE7', '#a855f7'];

    const preview = document.createElement('div');
    preview.className = 'preview-display';
    preview.style.cssText = `
      width: 500px;
      max-width: 100%;
      height: 400px;
      background: linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]});
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      margin: 0 auto;
      user-select: none;
    `;

    const emoji = document.createElement('span');
    emoji.style.fontSize = '4rem';
    emoji.textContent = milestone.previewEmoji || '📄';

    const label = document.createElement('p');
    label.style.cssText = 'color: rgba(255,255,255,0.85); margin-top: 1rem; font-size: 1rem;';
    label.textContent = milestone.previewLabel || milestone.title;

    preview.appendChild(emoji);
    preview.appendChild(label);

    // Insert before watermark so it sits behind
    const watermark = document.getElementById('watermarkOverlay');
    canvas.insertBefore(preview, watermark);

    renderWatermark();
  };

  /** Generate the repeating diagonal watermark overlay. */
  const renderWatermark = () => {
    const overlay = document.getElementById('watermarkOverlay');
    if (!overlay) return;

    overlay.innerHTML = '';

    if (milestone.status === 'paid') {
      overlay.classList.add('removed');
      return;
    }

    overlay.classList.remove('removed');

    // Generate tiles on a 120×80 grid
    const cols = Math.ceil(overlay.clientWidth / 120) || 6;
    const rows = Math.ceil(overlay.clientHeight / 80) || 6;

    const fragment = document.createDocumentFragment();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tile = document.createElement('div');
        tile.className = 'watermark-tile';
        tile.textContent = 'PAYGATE.IO • PREVIEW ONLY';
        tile.style.cssText = `
          position: absolute;
          left: ${col * 120}px;
          top: ${row * 80}px;
          transform: rotate(-25deg);
          white-space: nowrap;
        `;
        fragment.appendChild(tile);
      }
    }

    overlay.appendChild(fragment);
  };

  /* ------------------------------------------------------------------ */
  /*  Invoice Rendering                                                  */
  /* ------------------------------------------------------------------ */

  /** Render invoice line items and control the pay button state. */
  const renderInvoice = () => {
    const container = document.getElementById('invoiceDetails');
    if (!container) return;

    const dueText = milestone.dueDate ? formatDate(milestone.dueDate) : 'Upon approval';

    container.innerHTML = `
      <div class="invoice-row">
        <span>Project</span>
        <span>${milestone.title}</span>
      </div>
      <div class="invoice-row">
        <span>Client</span>
        <span>${milestone.clientName}</span>
      </div>
      <div class="invoice-row">
        <span>Due Date</span>
        <span>${dueText}</span>
      </div>
      <div class="invoice-divider"></div>
      <div class="invoice-row">
        <span>Subtotal</span>
        <span>${formatCurrency(milestone.amount)}</span>
      </div>
      <div class="invoice-row">
        <span>Platform Fee</span>
        <span>$0.00</span>
      </div>
      <div class="invoice-row total">
        <span>Total</span>
        <span>${formatCurrency(milestone.amount)}</span>
      </div>`;

    // Pay button state
    const payBtn = document.getElementById('btnPayInvoice');
    if (payBtn) {
      if (milestone.status === 'paid') {
        payBtn.disabled = true;
        payBtn.textContent = '✓ Paid';
      } else {
        payBtn.disabled = false;
        payBtn.textContent = 'Pay Invoice';
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Comments & Pins                                                    */
  /* ------------------------------------------------------------------ */

  /** Render comment pins on the canvas and the comment list. */
  const renderComments = () => {
    const canvas = document.getElementById('previewCanvas');
    const list = document.getElementById('commentsList');
    const countEl = document.getElementById('commentCount');

    // Clear existing pins
    if (canvas) {
      canvas.querySelectorAll('.comment-pin').forEach((pin) => pin.remove());
    }
    if (list) list.innerHTML = '';

    const comments = milestone.comments || [];
    if (countEl) countEl.textContent = `(${comments.length})`;

    comments.forEach((comment, idx) => {
      const pinNum = idx + 1;

      // Pin on canvas
      if (canvas) {
        const pin = document.createElement('div');
        pin.className = 'comment-pin';
        pin.textContent = pinNum;
        pin.style.left = `${comment.pinX}%`;
        pin.style.top = `${comment.pinY}%`;
        pin.dataset.commentIndex = idx;
        pin.addEventListener('click', (e) => {
          e.stopPropagation(); // prevent canvas click
          highlightComment(idx);
        });
        canvas.appendChild(pin);
      }

      // Comment list item
      if (list) {
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.id = `comment-item-${idx}`;
        item.innerHTML = `
          <span class="pin-number">${pinNum}</span>
          <span class="comment-text"><strong>${comment.author}:</strong> ${comment.text}</span>`;
        list.appendChild(item);
      }
    });
  };

  /**
   * Scroll a comment into view and briefly flash its background.
   * @param {number} idx — zero-based comment index
   */
  const highlightComment = (idx) => {
    const item = document.getElementById(`comment-item-${idx}`);
    if (!item) return;

    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    item.classList.add('highlight');
    setTimeout(() => item.classList.remove('highlight'), 800);
  };

  /* ------------------------------------------------------------------ */
  /*  Canvas Click → Pin Placement                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Handle clicks on the preview canvas to place comment pins.
   * @param {MouseEvent} event
   */
  const handleCanvasClick = (event) => {
    // Check if a pin was clicked
    const pin = event.target.closest('.comment-pin');
    if (pin) {
      if (pin.classList.contains('temp-pin')) return;
      const idx = Number(pin.dataset.commentIndex);
      highlightComment(idx);
      return;
    }

    if (!milestone || milestone.status === 'paid') return;

    const canvas = document.getElementById('previewCanvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const percentX = ((event.clientX - rect.left) / rect.width) * 100;
    const percentY = ((event.clientY - rect.top) / rect.height) * 100;

    pendingPin = { x: percentX, y: percentY };

    // Remove any previous temporary pin
    canvas.querySelectorAll('.comment-pin.temp-pin').forEach((p) => p.remove());

    // Show temporary "?" pin
    const tempPin = document.createElement('div');
    tempPin.className = 'comment-pin temp-pin';
    tempPin.textContent = '?';
    tempPin.style.left = `${percentX}%`;
    tempPin.style.top = `${percentY}%`;
    canvas.appendChild(tempPin);

    const commentInput = document.getElementById('commentInput');
    if (commentInput) commentInput.focus();
  };

  /* ------------------------------------------------------------------ */
  /*  Add Comment                                                        */
  /* ------------------------------------------------------------------ */

  /** Submit a new comment using the pending pin location. */
  const addComment = () => {
    const input = document.getElementById('commentInput');
    const text = (input?.value || '').trim();

    if (!text || !pendingPin) return;

    const comment = {
      id: generateId(),
      pinX: pendingPin.x,
      pinY: pendingPin.y,
      text,
      author: 'Client',
      createdAt: new Date().toISOString(),
    };

    milestone.comments.push(comment);
    App.updateMilestone(milestone.id, { comments: milestone.comments });

    // Cleanup
    input.value = '';
    pendingPin = null;

    // Remove temp pin
    const canvas = document.getElementById('previewCanvas');
    if (canvas) canvas.querySelectorAll('.comment-pin.temp-pin').forEach((p) => p.remove());

    renderComments();
    App.toast.show('Comment added', 'success');
  };

  /* ------------------------------------------------------------------ */
  /*  Status Badge                                                       */
  /* ------------------------------------------------------------------ */

  /** Update the portal status badge text and class. */
  const updateStatusBadge = () => {
    const badge = document.getElementById('portalStatusBadge');
    if (!badge) return;

    // Remove old status classes
    badge.className = badge.className.replace(/status-\w+/g, '').trim();
    badge.classList.add(`status-${milestone.status}`);

    const label = milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1);
    badge.textContent = label;
  };

  /* ------------------------------------------------------------------ */
  /*  Checkout Flow                                                      */
  /* ------------------------------------------------------------------ */

  /** Open the checkout modal. */
  const openCheckout = () => {
    if (!milestone || milestone.status === 'paid') return;

    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.add('active');

    const amountEl = document.getElementById('checkoutAmount');
    if (amountEl) amountEl.textContent = formatCurrency(milestone.amount);

    // Reset checkout to form state
    resetCheckoutStates();
  };

  /** Close the checkout modal and reset internal states. */
  const closeCheckout = () => {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.classList.remove('active');
    resetCheckoutStates();
  };

  /** Ensure only the form step is visible. */
  const resetCheckoutStates = () => {
    const form = document.getElementById('checkoutForm');
    const processing = document.getElementById('checkoutProcessing');
    const success = document.getElementById('checkoutSuccess');

    if (form) { form.classList.add('active'); form.style.display = ''; }
    if (processing) { processing.classList.remove('active'); processing.style.display = ''; }
    if (success) { success.classList.remove('active'); success.style.display = ''; }
  };

  /** Process the simulated payment. */
  const processPayment = () => {
    // Basic validation — ensure card fields are non-empty
    const fields = ['cardName', 'cardNumber', 'cardExpiry', 'cardCvc'];
    for (const fieldId of fields) {
      const el = document.getElementById(fieldId);
      if (!el || !el.value.trim()) {
        App.toast.show('Please fill in all card details.', 'error');
        return;
      }
    }

    // Transition: form → processing
    const form = document.getElementById('checkoutForm');
    const processing = document.getElementById('checkoutProcessing');
    if (form) form.classList.remove('active');
    if (processing) processing.classList.add('active');

    // Simulate payment processing delay
    setTimeout(() => {
      // Transition: processing → success
      if (processing) processing.classList.remove('active');
      const success = document.getElementById('checkoutSuccess');
      if (success) success.classList.add('active');

      // Mark milestone as paid
      App.updateMilestone(milestone.id, { status: 'paid' });
      milestone = App.getMilestone(milestone.id); // refresh reference

      // Remove watermark (CSS transition)
      const overlay = document.getElementById('watermarkOverlay');
      if (overlay) overlay.classList.add('removed');

      // Update status badge
      updateStatusBadge();

      // Disable pay button
      const payBtn = document.getElementById('btnPayInvoice');
      if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = '✓ Paid';
      }

      // 🎉 Celebration
      fireConfetti();
      App.toast.show('Payment successful! Files unlocked.', 'success');
    }, 2500);
  };

  /* ------------------------------------------------------------------ */
  /*  Confetti 🎉                                                       */
  /* ------------------------------------------------------------------ */

  /** Launch a burst of colorful confetti pieces. */
  const fireConfetti = () => {
    const container = document.getElementById('confettiContainer');
    if (!container) return;

    const colors = [
      'var(--primary, #6C5CE7)',
      'var(--cyan, #00cec9)',
      'var(--amber, #f59e0b)',
      'var(--emerald, #10b981)',
      'var(--rose, #f43f5e)',
    ];

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 40; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';

      const color = colors[Math.floor(Math.random() * colors.length)];
      const leftPos = Math.random() * 100;
      const delay = Math.random() * 500;

      piece.style.left = `${leftPos}%`;
      piece.style.top = '-10px';
      piece.style.backgroundColor = color;
      piece.style.animationDelay = `${delay}ms`;

      fragment.appendChild(piece);
    }

    container.appendChild(fragment);

    // Cleanup after animation
    setTimeout(() => {
      container.innerHTML = '';
    }, 2000);
  };

  /* ------------------------------------------------------------------ */
  /*  Event Listener Setup                                               */
  /* ------------------------------------------------------------------ */

  let listenersSetup = false;

  /**
   * Wire up all portal event listeners once.
   */
  const setupEventListeners = () => {
    if (listenersSetup) return;
    listenersSetup = true;

    // Canvas click → pin placement or pin click (via event delegation)
    const canvas = document.getElementById('previewCanvas');
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
    }

    // Add comment button
    const btnAddComment = document.getElementById('btnAddComment');
    if (btnAddComment) {
      btnAddComment.addEventListener('click', addComment);
    }

    // Enter key in comment input
    const commentInput = document.getElementById('commentInput');
    if (commentInput) {
      commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addComment();
        }
      });
    }

    // Pay invoice
    const btnPayInvoice = document.getElementById('btnPayInvoice');
    if (btnPayInvoice) {
      btnPayInvoice.addEventListener('click', openCheckout);
    }

    // Checkout modal controls
    const closeCheckoutModal = document.getElementById('closeCheckoutModal');
    if (closeCheckoutModal) {
      closeCheckoutModal.addEventListener('click', closeCheckout);
    }

    const btnProcessPayment = document.getElementById('btnProcessPayment');
    if (btnProcessPayment) {
      btnProcessPayment.addEventListener('click', processPayment);
    }

    const btnDownloadFiles = document.getElementById('btnDownloadFiles');
    if (btnDownloadFiles) {
      btnDownloadFiles.addEventListener('click', () => {
        App.toast.show('Download started — source files delivered!', 'success');
        closeCheckout();
      });
    }

    const btnCloseSuccess = document.getElementById('btnCloseSuccess');
    if (btnCloseSuccess) {
      btnCloseSuccess.addEventListener('click', closeCheckout);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  return {
    /** @type {object|null} */
    get milestone() {
      return milestone;
    },
    /** @type {{ x: number, y: number }|null} */
    get pendingPin() {
      return pendingPin;
    },
    init,
    renderPreview,
    renderWatermark,
    renderInvoice,
    renderComments,
    handleCanvasClick,
    addComment,
    fireConfetti,
  };
})();
