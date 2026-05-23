const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'milestonegate.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper to run queries with promises
const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

/**
 * Initialize SQLite database tables
 */
async function initDb() {
  // 1. Create milestones table
  await query.run(`
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      clientName TEXT NOT NULL,
      clientEmail TEXT,
      amount INTEGER NOT NULL,
      fileType TEXT NOT NULL,
      description TEXT,
      previewEmoji TEXT DEFAULT '🎨',
      previewLabel TEXT,
      status TEXT DEFAULT 'pending',
      filePath TEXT,
      fileName TEXT,
      createdAt TEXT NOT NULL,
      dueDate TEXT
    )
  `);

  // 2. Create comments table
  await query.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      milestoneId TEXT NOT NULL,
      pinX REAL NOT NULL,
      pinY REAL NOT NULL,
      text TEXT NOT NULL,
      author TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (milestoneId) REFERENCES milestones(id) ON DELETE CASCADE
    )
  `);

  console.log('SQLite database tables verified.');

  // 3. Seed database if empty
  const count = await query.get('SELECT COUNT(*) AS count FROM milestones');
  if (count.count === 0) {
    console.log('Seeding database with default milestones...');
    
    // Seed 1: Brand Identity Logo
    await query.run(`
      INSERT INTO milestones (id, title, clientName, clientEmail, amount, fileType, description, previewEmoji, previewLabel, status, createdAt, dueDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'ms_demo_001',
      'Brand Identity — Logo Package',
      'Sarah Mitchell',
      'sarah@acmecorp.io',
      2400,
      'design',
      'Complete brand identity design including primary logo, secondary mark, favicon, and brand guidelines document.',
      '🎨',
      'Logo Design Package',
      'reviewing',
      '2026-05-20T10:00:00Z',
      '2026-05-27T10:00:00Z'
    ]);

    // Seed 1 Comments
    await query.run(`
      INSERT INTO comments (id, milestoneId, pinX, pinY, text, author, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['c1', 'ms_demo_001', 35, 42, 'Can we try a bolder font for the wordmark?', 'Sarah M.', '2026-05-22T14:30:00Z']);
    await query.run(`
      INSERT INTO comments (id, milestoneId, pinX, pinY, text, author, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['c2', 'ms_demo_001', 68, 25, 'Love the icon concept — keep this direction.', 'Sarah M.', '2026-05-22T15:10:00Z']);

    // Seed 2: Landing Page Codebase
    await query.run(`
      INSERT INTO milestones (id, title, clientName, clientEmail, amount, fileType, description, previewEmoji, previewLabel, status, createdAt, dueDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'ms_demo_002',
      'Landing Page — Next.js Codebase',
      'David Chen',
      'david@startupxyz.com',
      4800,
      'code',
      'Responsive landing page built with Next.js 14, Tailwind CSS, and Framer Motion. Includes contact form with email integration.',
      '💻',
      'Landing Page Codebase',
      'pending',
      '2026-05-18T08:00:00Z',
      '2026-05-30T10:00:00Z'
    ]);

    // Seed 3: SEO Copywriting
    await query.run(`
      INSERT INTO milestones (id, title, clientName, clientEmail, amount, fileType, description, previewEmoji, previewLabel, status, createdAt, dueDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'ms_demo_003',
      'SEO Copywriting — Blog Articles (5x)',
      'Emily Watson',
      'emily@contentfirst.co',
      1500,
      'document',
      'Five long-form SEO-optimized blog articles (2,000+ words each) with keyword research, meta descriptions, and internal linking strategy.',
      '📝',
      'SEO Blog Articles',
      'paid',
      '2026-05-10T12:00:00Z',
      '2026-05-20T10:00:00Z'
    ]);

    await query.run(`
      INSERT INTO comments (id, milestoneId, pinX, pinY, text, author, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['c3', 'ms_demo_003', 50, 30, 'Could we add more statistics to the intro section?', 'Emily W.', '2026-05-15T09:20:00Z']);

    console.log('Database successfully seeded.');
  }
}

module.exports = {
  db,
  query,
  initDb
};
