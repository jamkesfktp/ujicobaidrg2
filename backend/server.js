// server.js — Express API entry point
const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────
app.use('/api/nasional',   require('./routes/nasional'));
app.use('/api/peta',       require('./routes/peta'));
app.use('/api/strategis',  require('./routes/strategis'));
app.use('/api/shifting',   require('./routes/shifting'));
app.use('/api/costweight', require('./routes/costweight'));
app.use('/api/tren',       require('./routes/tren'));
app.use('/api/anggaran',   require('./routes/anggaran'));

// ─── Health check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), service: 'iDRG Dashboard API' });
});

// ─── 404 handler ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} tidak ditemukan` });
});

// ─── Error handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 iDRG Dashboard API berjalan di http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
