/* =========================================================
   MilestoneGate (PayGate.io) — Data Layer
   ========================================================= */

/**
 * Generate a short unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Format currency amount
 */
function formatCurrency(amount, currency = 'USD') {
  const symbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
  const sym = symbols[currency] || '$';
  return `${sym}${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

/**
 * Format date to readable string
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Time ago helper
 */
function timeAgo(dateStr) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ---------------------------------------------------------
   SAMPLE MILESTONES (Pre-seeded demo data)
   --------------------------------------------------------- */
const SAMPLE_MILESTONES = [
  {
    id: 'ms_demo_001',
    title: 'Brand Identity — Logo Package',
    description: 'Complete brand identity design including primary logo, secondary mark, favicon, and brand guidelines document.',
    clientName: 'Sarah Mitchell',
    clientEmail: 'sarah@acmecorp.io',
    freelancerName: 'Alex Rivera',
    amount: 2400,
    currency: 'USD',
    status: 'reviewing', // pending | reviewing | paid
    fileType: 'design',  // design | code | document
    previewEmoji: '🎨',
    previewLabel: 'Logo Design Package',
    thumbnailGradient: ['#6366f1', '#06b6d4'],
    comments: [
      { id: 'c1', pinX: 35, pinY: 42, text: 'Can we try a bolder font for the wordmark?', author: 'Sarah M.', createdAt: '2026-05-22T14:30:00Z' },
      { id: 'c2', pinX: 68, pinY: 25, text: 'Love the icon concept — keep this direction.', author: 'Sarah M.', createdAt: '2026-05-22T15:10:00Z' },
    ],
    createdAt: '2026-05-20T10:00:00Z',
    dueDate: '2026-05-27T10:00:00Z',
  },
  {
    id: 'ms_demo_002',
    title: 'Landing Page — Next.js Codebase',
    description: 'Responsive landing page built with Next.js 14, Tailwind CSS, and Framer Motion. Includes contact form with email integration.',
    clientName: 'David Chen',
    clientEmail: 'david@startupxyz.com',
    freelancerName: 'Alex Rivera',
    amount: 4800,
    currency: 'USD',
    status: 'pending',
    fileType: 'code',
    previewEmoji: '💻',
    previewLabel: 'Landing Page Codebase',
    thumbnailGradient: ['#10b981', '#06b6d4'],
    comments: [],
    createdAt: '2026-05-18T08:00:00Z',
    dueDate: '2026-05-30T10:00:00Z',
  },
  {
    id: 'ms_demo_003',
    title: 'SEO Copywriting — Blog Articles (5x)',
    description: 'Five long-form SEO-optimized blog articles (2,000+ words each) with keyword research, meta descriptions, and internal linking strategy.',
    clientName: 'Emily Watson',
    clientEmail: 'emily@contentfirst.co',
    freelancerName: 'Alex Rivera',
    amount: 1500,
    currency: 'USD',
    status: 'paid',
    fileType: 'document',
    previewEmoji: '📝',
    previewLabel: 'SEO Blog Articles',
    thumbnailGradient: ['#f59e0b', '#f43f5e'],
    comments: [
      { id: 'c3', pinX: 50, pinY: 30, text: 'Could we add more statistics to the intro section?', author: 'Emily W.', createdAt: '2026-05-15T09:20:00Z' },
    ],
    createdAt: '2026-05-10T12:00:00Z',
    dueDate: '2026-05-20T10:00:00Z',
  },
];

/* ---------------------------------------------------------
   OUTREACH TEMPLATES
   --------------------------------------------------------- */
const OUTREACH_TEMPLATES = [
  {
    id: 'ot_scope',
    title: 'Scope Creep Discovery',
    category: 'Customer Discovery',
    subject: 'Quick question about your post on scope creep',
    body: `Hi [Username],

I came across your post about dealing with "just one quick change" from clients. I really resonated with your point about working unpaid hours just to avoid appearing difficult — it's such a common trap.

I'm currently researching tools to help freelancers automatically flag and manage out-of-scope requests without having awkward conversations with clients.

I'm not selling anything (just trying to understand if this is a solvable problem). Would you be open to a quick 10-minute chat or a few questions over DM about how you currently handle these boundary conversations?

Either way, thanks for sharing your story!

Best,
[Your Name]`,
  },
  {
    id: 'ot_ghosting',
    title: 'Client Ghosting Outreach',
    category: 'Customer Discovery',
    subject: 'Resonated with your post — Quick question',
    body: `Hi [Username],

I saw your post about the client ghosting you after you sent over the final files. That is incredibly frustrating, and it's a nightmare scenario that happens to way too many of us.

I'm building a small tool to help freelancers secure their deliverables (like locking files or repositories) until payment is verified, so clients can't just run off with the work.

I'm trying to make sure I build something that actually solves this rather than adding more admin overhead. Would you be open to sharing your thoughts on this? I'd love to ask a couple of questions over DM or a quick 10-minute feedback call (absolutely no pitch).

No worries if you're too busy, and I hope you got that invoice sorted out!

Best,
[Your Name]`,
  },
  {
    id: 'ot_invite',
    title: 'Client Portal Invitation',
    category: 'Client Communication',
    subject: 'Your project deliverables are ready for review',
    body: `Hi [Client Name],

Great news — your [Project Name] deliverables are ready for your review!

I've uploaded everything to a secure review portal where you can:
✅ Preview the deliverables in full detail
✅ Leave feedback by clicking directly on the design/document
✅ Approve and complete the invoice when you're happy

Here's your private review link:
🔗 [Review Link]

The portal is password-protected and the files are watermarked until the invoice is settled, at which point you'll get instant access to all source files.

Let me know if you have any questions!

Best,
[Your Name]`,
  },
];

/* ---------------------------------------------------------
   FILE TYPE CONFIGURATIONS
   --------------------------------------------------------- */
const FILE_TYPE_CONFIG = {
  design: {
    label: 'Design / Creative',
    emoji: '🎨',
    lockMethod: 'Watermarked preview with blurred source details',
    extensions: '.psd, .ai, .fig, .sketch, .png, .jpg',
    gradientClass: 'type-design',
    gradientColors: ['#6366f1', '#06b6d4'],
  },
  code: {
    label: 'Code / Repository',
    emoji: '💻',
    lockMethod: 'Staging link preview — source access locked until payment',
    extensions: '.zip, .git, GitHub repo',
    gradientClass: 'type-code',
    gradientColors: ['#10b981', '#06b6d4'],
  },
  document: {
    label: 'Document / Copy',
    emoji: '📝',
    lockMethod: 'Blurred PDF preview with visible headers only',
    extensions: '.pdf, .docx, .md, .txt',
    gradientClass: 'type-doc',
    gradientColors: ['#f59e0b', '#f43f5e'],
  },
};

/* ---------------------------------------------------------
   PRICING TIERS
   --------------------------------------------------------- */
const PRICING_TIERS = [
  {
    name: 'Starter',
    price: 9,
    period: '/mo',
    features: [
      '3 active client portals',
      'Standard file watermarking',
      'Basic Stripe integration',
      'Email notifications',
      'Community support',
    ],
    featured: false,
    cta: 'Start Free Trial',
  },
  {
    name: 'Pro',
    price: 29,
    period: '/mo',
    features: [
      'Unlimited client portals',
      'GitHub & Figma integration',
      'Custom branded watermarks',
      'White-labeled client portal',
      'Pin-comment review system',
      'Priority support',
    ],
    featured: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Agency',
    price: 79,
    period: '/mo',
    features: [
      'Up to 5 team members',
      'Shared asset library',
      'API access',
      'Custom domain (portal.yourbrand.com)',
      'Advanced analytics',
      'Dedicated account manager',
    ],
    featured: false,
    cta: 'Contact Sales',
  },
];

/* ---------------------------------------------------------
   LANDING PAGE FEATURES
   --------------------------------------------------------- */
const LANDING_FEATURES = [
  {
    icon: '🔒',
    iconClass: 'icon-indigo',
    title: 'Secure Deliverable Vault',
    description: 'Upload design files, codebases, or documents. Clients see watermarked previews — source assets stay locked until payment clears.',
  },
  {
    icon: '💬',
    iconClass: 'icon-cyan',
    title: 'Interactive Review Portal',
    description: 'Clients pin feedback directly on your deliverables. No more email threads or lost revision notes — everything in one view.',
  },
  {
    icon: '⚡',
    iconClass: 'icon-amber',
    title: 'One-Click Checkout',
    description: 'A sleek "Approve & Pay" button embedded in the portal. Integrates Stripe, PayPal, and Wise for seamless invoice settlement.',
  },
  {
    icon: '🚀',
    iconClass: 'icon-emerald',
    title: 'Instant Auto-Release',
    description: 'The moment payment confirms, watermarks vanish. Clients get high-res downloads or GitHub repo invitations automatically.',
  },
];

/* ---------------------------------------------------------
   LANDING PAGE STATS
   --------------------------------------------------------- */
const LANDING_STATS = [
  { value: '$0', label: 'Platform Fees', note: 'Just Stripe processing' },
  { value: '< 3s', label: 'Auto-Release', note: 'After payment confirms' },
  { value: '100%', label: 'File Security', note: 'Until invoice is paid' },
];
