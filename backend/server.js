// server.js — Express API entry point
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { Pool } = require('pg');
const { loadDatasetFromDb, getDataset } = require('./services/dataGenerator');
require('dotenv').config();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Initialize Postgres Pool
const pool = new Pool({
    user: process.env.DB_USER || 'idrg_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'idrg_dashboard',
    password: process.env.DB_PASSWORD || 'idrg_pass_2026',
    port: process.env.DB_PORT || 5432
});

// Pre-load datasets on startup
(async () => {
    try {
        await loadDatasetFromDb(pool, 'jan_des_v11_1363');
        await loadDatasetFromDb(pool, 'jan_des_v11_1370');
        await loadDatasetFromDb(pool, 'okt_jun_v3_1363');
        await loadDatasetFromDb(pool, 'okt_jun_v3_1370');
    } catch (err) {
        console.error('Failed to pre-load datasets:', err);
    }
})();

// ─── Legacy Data Routes (Serve dynamic JSON & static files) ───
const fs = require('fs');
app.get('/data/*', (req, res) => {
    const rawPath = req.params[0] || req.path.replace(/^\/data\//, '');
    const staticPath = path.join(__dirname, '../frontend/public/data', rawPath);
    
    // 1. Check if physical file exists in frontend/public/data
    if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
        if (rawPath.endsWith('.gz')) {
            // If the client expects raw gz stream or decompressed
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Encoding', 'gzip');
            return fs.createReadStream(staticPath).pipe(res);
        }
        return res.sendFile(staticPath);
    }

    // 2. URL format: /data/jan_des_v11_hospitals.json or /data/dataset3_1363_hospitals.json
    const filename = req.path.split('/').pop().replace('.json', '').replace('.gz', '');
    
    let datasetId = 'jan_des_v11_1363';
    const is1370 = filename.includes('1370') || (req.query && req.query.drg_type === '1370');
    const isOktJun = filename.includes('okt_jun') || filename.includes('dataset3');

    if (isOktJun) {
        datasetId = is1370 ? 'okt_jun_v3_1370' : 'okt_jun_v3_1363';
    } else {
        datasetId = is1370 ? 'jan_des_v11_1370' : 'jan_des_v11_1363';
    }
    
    const data = getDataset(datasetId);
    if (!data) return res.status(503).json({ error: `Dataset ${datasetId} is still loading or not found` });
    
    // Find matching key
    let actualFileType = filename;
    ['hospitals', 'rs_profiles', 'distribution', 'crosstab', 'drgs', 'drg_analysis', 'levels', 'regions', 'services', 'shifting'].forEach(t => {
        if (filename.includes(t)) actualFileType = t;
    });
    
    if (data[actualFileType]) {
        res.json(data[actualFileType]);
    } else {
        res.status(404).json({ error: `File type ${actualFileType} not found in memory for ${datasetId}` });
    }
});

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
