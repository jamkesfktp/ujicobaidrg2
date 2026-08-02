// routes/tren.js — Tren Bulanan (hanya dataset okt_jun_v3)
const express = require('express');
const router  = express.Router();
const { pool }        = require('../db');
const { getTarifCol } = require('./_helpers');

// GET /api/tren/bulanan — Tren per bulan
router.get('/bulanan', async (req, res) => {
  try {
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const params  = ['okt_jun_v3'];
    let   extra   = '';
    let   idx     = 2;

    if (req.query.propinsi && req.query.propinsi !== 'all') {
      params.push(req.query.propinsi.split(',').map(s => s.trim()));
      extra += ` AND propinsi = ANY($${idx++})`;
    }
    if (req.query.kelompok && req.query.kelompok !== 'all') {
      params.push(req.query.kelompok);
      extra += ` AND kelompok_idrg = $${idx++}`;
    }
    if (req.query.kelas_faskes) {
      params.push(req.query.kelas_faskes.split(','));
      extra += ` AND kelas_faskes = ANY($${idx++})`;
    }
    if (req.query.pemilik) {
      params.push(req.query.pemilik);
      extra += ` AND pemilik = $${idx++}`;
    }

    const { rows } = await pool.query(`
      SELECT
        bulan_data_uji_coba                    AS bulan,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(${col}) - SUM(total_tarif_inacbg)  AS selisih,
        COUNT(DISTINCT idrg_code_1363)::int    AS jumlah_idrg_aktif
      FROM mv_spending_data
      WHERE dataset = $1 AND bulan_data_uji_coba IS NOT NULL ${extra}
      GROUP BY bulan_data_uji_coba
      ORDER BY bulan_data_uji_coba
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tren/by-kelompok-bulan — Tren per kelompok per bulan
router.get('/by-kelompok-bulan', async (req, res) => {
  try {
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        bulan_data_uji_coba AS bulan,
        COALESCE(kelompok_idrg, 'Lainnya') AS kelompok,
        SUM(jml_kasus)::bigint AS total_kasus,
        SUM(${col}) AS total_tarif_idrg,
        SUM(total_tarif_inacbg) AS total_tarif_inacbg
      FROM mv_spending_data
      WHERE dataset = 'okt_jun_v3' AND bulan_data_uji_coba IS NOT NULL
      GROUP BY bulan_data_uji_coba, kelompok_idrg
      ORDER BY bulan_data_uji_coba, total_kasus DESC
    `);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tren/bulan-list — Daftar bulan yang tersedia
router.get('/bulan-list', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT bulan_data_uji_coba AS bulan
      FROM mv_spending_data
      WHERE dataset = 'okt_jun_v3' AND bulan_data_uji_coba IS NOT NULL
      ORDER BY bulan_data_uji_coba
    `);
    res.json(rows.map(r => r.bulan));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
