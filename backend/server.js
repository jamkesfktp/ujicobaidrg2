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
        await loadDatasetFromDb(pool, 'jan_des_v11');
        await loadDatasetFromDb(pool, 'okt_jun_v3');
    } catch (err) {
        console.error('Failed to pre-load datasets:', err);
    }
})();

// ─── Legacy Data Routes (Serve dynamic JSON) ──────────────────
app.get('/data/*', (req, res) => {
    // URL format: /data/dataset3/dataset3_hospitals.json or /data/dataset1_rs_profiles.json
    const filename = req.path.split('/').pop().replace('.json', '').replace('.gz', '');
    
    let datasetId = 'dataset1'; // default mapping
    let fileType = filename;
    
    if (filename.includes('jan_des_v11')) { datasetId = 'jan_des_v11'; fileType = filename.replace('jan_des_v11_', ''); }
    else if (filename.includes('okt_jun_v3')) { datasetId = 'okt_jun_v3'; fileType = filename.replace('okt_jun_v3_', ''); }
    // Add backward compatibility for old dataset names in UI
    else if (filename.includes('dataset4_1363')) { datasetId = 'jan_des_v11'; fileType = filename.replace('dataset4_1363_', ''); }
    else if (filename.includes('dataset4_1370')) { datasetId = 'jan_des_v11'; fileType = filename.replace('dataset4_1370_', ''); }
    else if (filename.includes('dataset3_1363')) { datasetId = 'okt_jun_v3'; fileType = filename.replace('dataset3_1363_', ''); }
    else if (filename.includes('dataset3_1370')) { datasetId = 'okt_jun_v3'; fileType = filename.replace('dataset3_1370_', ''); }
    // if UI still asks for dataset4_hospitals instead of dataset4_1363_hospitals
    else if (filename.includes('dataset4')) { datasetId = 'jan_des_v11'; fileType = filename.replace('dataset4_', ''); }
    else if (filename.includes('dataset3')) { datasetId = 'okt_jun_v3'; fileType = filename.replace('dataset3_', ''); }
    
    const data = getDataset(datasetId);
    if (!data) return res.status(503).json({ error: 'Dataset is still loading or not found' });
    
    // Some fileTypes might have trailing month/drg like `_all_1363` which we don't use
    let actualFileType = fileType;
    ['hospitals', 'rs_profiles', 'distribution', 'crosstab', 'drgs', 'drg_analysis', 'levels', 'regions', 'services', 'shifting'].forEach(t => {
        if (fileType.startsWith(t)) actualFileType = t;
    });
    
    if (data[actualFileType]) {
        res.json(data[actualFileType]);
    } else {
        res.status(404).json({ error: `File type ${actualFileType} not found in memory` });
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
