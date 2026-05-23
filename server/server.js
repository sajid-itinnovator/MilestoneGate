require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// -------------------------------------------------------------
// Stripe Webhook Endpoint (requires raw body parser)
// -------------------------------------------------------------
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Print raw body for debugging if keys are placeholders
  if (process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder_key_replace_me') {
    console.warn('⚠️ Webhook received but Stripe is running in placeholder mode. Bypassing signature verification.');
    return res.json({ received: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const milestoneId = session.metadata.milestoneId;

    try {
      const milestone = await query.get('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
      if (milestone) {
        await query.run('UPDATE milestones SET status = "paid" WHERE id = ?', [milestoneId]);
        console.log(`✅ Webhook Fulfillment: Milestone ${milestoneId} ("${milestone.title}") updated to PAID.`);
      } else {
        console.error(`❌ Webhook Error: Milestone ${milestoneId} not found in database.`);
      }
    } catch (err) {
      console.error('❌ Webhook database update error:', err);
      return res.status(500).send('Database update failed');
    }
  }

  res.json({ received: true });
});

// -------------------------------------------------------------
// Standard Middlewares (for all other endpoints)
// -------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend statically from the public folder
app.use(express.static(path.join(__dirname, '../public')));

// Configure Multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.zip', '.pdf', '.png', '.jpg', '.jpeg', '.docx', '.fig', '.psd', '.md', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed extensions: ${allowedExtensions.join(', ')}`));
    }
  }
});

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

/**
 * GET /api/milestones
 * Fetch all milestones (without hidden file paths)
 */
app.get('/api/milestones', async (req, res) => {
  try {
    const rows = await query.all('SELECT * FROM milestones ORDER BY createdAt DESC');
    const safeRows = rows.map(r => {
      const { filePath, ...meta } = r;
      return meta;
    });
    res.json(safeRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch milestones.' });
  }
});

/**
 * GET /api/milestones/:id
 * Fetch a single milestone, including its comments.
 */
app.get('/api/milestones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const milestone = await query.get('SELECT * FROM milestones WHERE id = ?', [id]);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    const comments = await query.all('SELECT * FROM comments WHERE milestoneId = ? ORDER BY createdAt ASC', [id]);
    
    // Safety check: hide filepath on client response
    const { filePath, ...safeMilestone } = milestone;
    safeMilestone.comments = comments;

    res.json(safeMilestone);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch milestone details.' });
  }
});

/**
 * POST /api/milestones
 * Create a new milestone with deliverable file upload
 */
app.post('/api/milestones', upload.single('sourceFile'), async (req, res) => {
  const {
    title,
    clientName,
    clientEmail,
    amount,
    fileType,
    description,
    previewEmoji,
    previewLabel,
    dueDate
  } = req.body;

  if (!title || !clientName || !amount) {
    return res.status(400).json({ error: 'Title, clientName, and amount are required.' });
  }

  const amountInt = parseInt(amount);
  if (isNaN(amountInt) || amountInt <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive integer.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Source deliverable file is required.' });
  }

  const filePath = req.file.path;
  const fileName = req.file.originalname;

  const milestoneId = 'ms_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const createdAt = new Date().toISOString();

  try {
    await query.run(`
      INSERT INTO milestones (id, title, clientName, clientEmail, amount, fileType, description, previewEmoji, previewLabel, status, filePath, fileName, createdAt, dueDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      milestoneId,
      title,
      clientName,
      clientEmail || null,
      amountInt,
      fileType || 'design',
      description || '',
      previewEmoji || '🎨',
      previewLabel || title,
      'pending',
      filePath,
      fileName,
      createdAt,
      dueDate || null
    ]);

    console.log(`🆕 Created fullstack milestone in DB: ${milestoneId} ("${title}")`);
    res.status(201).json({ id: milestoneId, title, clientName, amount: amountInt, status: 'pending' });
  } catch (err) {
    console.error(err);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ error: 'Failed to create milestone.' });
  }
});

/**
 * POST /api/milestones/:id/comments
 * Add comment to a milestone
 */
app.post('/api/milestones/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { pinX, pinY, text, author } = req.body;

  if (pinX === undefined || pinY === undefined || !text) {
    return res.status(400).json({ error: 'Coordinates pinX, pinY, and text are required.' });
  }

  const commentId = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const createdAt = new Date().toISOString();

  try {
    const milestone = await query.get('SELECT id, status FROM milestones WHERE id = ?', [id]);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    if (milestone.status === 'paid') {
      return res.status(400).json({ error: 'Comments cannot be added to a settled invoice.' });
    }

    await query.run(`
      INSERT INTO comments (id, milestoneId, pinX, pinY, text, author, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      commentId,
      id,
      parseFloat(pinX),
      parseFloat(pinY),
      text,
      author || 'Client',
      createdAt
    ]);

    res.status(201).json({ id: commentId, milestoneId: id, pinX, pinY, text, author: author || 'Client', createdAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

/**
 * POST /api/milestones/:id/checkout
 * Create Stripe Checkout session for a milestone
 */
app.post('/api/milestones/:id/checkout', async (req, res) => {
  const { id } = req.params;

  try {
    const milestone = await query.get('SELECT * FROM milestones WHERE id = ?', [id]);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    if (milestone.status === 'paid') {
      return res.status(400).json({ error: 'Milestone is already paid.' });
    }

    const origin = req.headers.origin || 'http://localhost:5000';

    // Fail-safe demo bypass if Stripe key is placeholder
    if (process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder_key_replace_me') {
      console.log(`⚠️ Stripe Sandbox: Placeholder secret key detected. Simulating checkout url callback.`);
      const mockCheckoutUrl = `${origin}/#portal/${milestone.id}?payment=success&session_id=mock_session_id`;
      return res.json({ url: mockCheckoutUrl });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: milestone.title,
            description: milestone.description || 'Secure deliverable release vault',
          },
          unit_amount: milestone.amount * 100, // Cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${origin}/#portal/${milestone.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#portal/${milestone.id}`,
      metadata: {
        milestoneId: milestone.id
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

/**
 * GET /api/milestones/:id/download
 * Validate payment and download the secure deliverable file
 */
app.get('/api/milestones/:id/download', async (req, res) => {
  const { id } = req.params;

  try {
    const milestone = await query.get('SELECT * FROM milestones WHERE id = ?', [id]);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    if (milestone.status !== 'paid') {
      return res.status(403).json({ error: 'Access Denied: Invoice must be settled before files are unlocked.' });
    }

    if (!milestone.filePath || !fs.existsSync(milestone.filePath)) {
      // Seed deliverables placeholder fallback for pre-seeded milestones
      if (id.startsWith('ms_demo_')) {
        const dummyFile = path.join(__dirname, 'uploads', `demo_${id}.txt`);
        if (!fs.existsSync(dummyFile)) {
          fs.writeFileSync(dummyFile, `--- ${milestone.title} Source File ---\nThank you for settling the invoice via PayGate.io.\n`);
        }
        return res.download(dummyFile, `${milestone.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_final.txt`);
      }
      return res.status(404).json({ error: 'Deliverable file not found on server.' });
    }

    res.download(milestone.filePath, milestone.fileName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed.' });
  }
});

// -------------------------------------------------------------
// Express Global Error Handler
// -------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// -------------------------------------------------------------
// Server Bootstrap
// -------------------------------------------------------------
async function bootstrap() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`\n=========================================================`);
    console.log(`🚀 MilestoneGate Fullstack Server running on port ${PORT}`);
    console.log(`   Local URL: http://localhost:${PORT}`);
    console.log(`=========================================================\n`);
  });
}

bootstrap().catch(err => {
  console.error('❌ Server startup failure:', err);
  process.exit(1);
});
