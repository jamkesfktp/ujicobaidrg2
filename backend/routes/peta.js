// routes/peta.js — Peta iDRG endpoints
const express = require('express');
const router  = express.Router();
const { pool }             = require('../db');
const { getTarifCol, buildWhere, normalizeDbDataset } = require('./_helpers');

// GET /api/peta/inacbg-list — Daftar semua INA-CBG (untuk dropdown)
router.get('/inacbg-list', async (req, res) => {
  try {
    const dataset = normalizeDbDataset(req.query.dataset);
    const { rows } = await pool.query(`
      SELECT
        inacbg,
        MAX(desc_inacbg)     AS deskripsi,
        MAX(kelompok_idrg)    AS kelompok,
        SUM(jml_kasus)::bigint AS total_kasus
      FROM mv_spending_data
      WHERE dataset = $1 AND inacbg IS NOT NULL
      GROUP BY inacbg
      ORDER BY total_kasus DESC
    `, [dataset]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/peta/inacbg?inacbg=Q-5-44-0 — Mapping satu INA-CBG ke iDRG
router.get('/inacbg', async (req, res) => {
  try {
    const dataset = normalizeDbDataset(req.query.dataset);
    const { inacbg } = req.query;
    const is1370 = (req.query.drg_type === '1370') || (req.query.dataset && req.query.dataset.includes('1370'));
    const drgCol = is1370 ? 'idrg_code_1370' : 'idrg_code_1363';
    const descCol = is1370 ? 'desc_idrg_1370' : 'desc_idrg_1363';
    const simCol = is1370 ? 'idrg_total_tarif_1370_dengan_af' : 'idrg_total_tarif_1363_dengan_af';

    if (!inacbg) return res.status(400).json({ error: 'inacbg wajib diisi' });

    const { rows } = await pool.query(`
      SELECT
        ${drgCol}                              AS idrg_code,
        MAX(${descCol})                        AS deskripsi,
        MAX(kelompok_idrg)                     AS kelompok,
        MAX(idrg_mdc)                          AS mdc,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs,
        COUNT(DISTINCT propinsi)::int          AS jumlah_provinsi,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        SUM(${simCol})                         AS total_tarif_idrg_sim2
      FROM mv_spending_data
      WHERE dataset = $1 AND inacbg = $2 AND ${drgCol} IS NOT NULL
      GROUP BY ${drgCol}
      ORDER BY total_kasus DESC
    `, [dataset, inacbg]);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/peta/by-idrg — Distribusi per provinsi (untuk choropleth map)
router.get('/by-idrg', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    let extraWhere = '';
    const { idrg_code } = req.query;
    if (idrg_code) {
      params.push(idrg_code);
      extraWhere = `AND idrg_code_1363 = $${params.length}`;
    }
    if (req.query.inacbg) {
      params.push(req.query.inacbg);
      extraWhere += ` AND inacbg = $${params.length}`;
    }

    const { rows } = await pool.query(`
      SELECT
        propinsi,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(${col})                            AS total_tarif,
        SUM(total_tarif_inacbg)                AS total_inacbg,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs
      FROM mv_spending_data
      WHERE ${where} ${extraWhere}
      GROUP BY propinsi
      ORDER BY total_kasus DESC
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/peta/by-rs?idrg_code=... — RS yang punya kode iDRG tertentu
router.get('/by-rs', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        kode_rs,
        MAX(propinsi)                          AS propinsi,
        MAX(kabupaten)                         AS kabupaten,
        MAX(pemilik)                           AS pemilik,
        MAX(kelas_faskes)                      AS kelas_faskes,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY kode_rs
      ORDER BY total_kasus DESC
      LIMIT 500
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
