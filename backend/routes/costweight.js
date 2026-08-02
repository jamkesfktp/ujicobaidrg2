// routes/costweight.js — Analisis Cost Weight iDRG
const express = require('express');
const router  = express.Router();
const { pool }        = require('../db');
const { buildWhere }  = require('./_helpers');

// GET /api/costweight — Distribusi cost weight per iDRG code
router.get('/', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);

    const { rows } = await pool.query(`
      SELECT
        idrg_code_1363,
        MAX(desc_idrg_1363)                    AS deskripsi,
        MAX(kelompok_idrg)                     AS kelompok,
        MAX(idrg_mdc)                          AS mdc,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        -- Cost weight = tarif_idrg / (NBR nasional) — direpresentasikan dengan tarif per kasus
        ROUND(AVG(NULLIF(idrg_tarif_1363_tanpa_af,0))::numeric, 2) AS avg_cw_unit,
        SUM(total_tarif_inacbg)                AS total_inacbg,
        SUM(idrg_total_tarif_1363_tanpa_af)    AS total_idrg_sim1,
        SUM(idrg_total_tarif_1363_dengan_af)   AS total_idrg_sim2,
        SUM(idrg_total_tarif_1363_dengan_af_afreg) AS total_idrg_sim3,
        ROUND(SUM(idrg_total_tarif_1363_dengan_af) / NULLIF(SUM(total_tarif_inacbg),0)::numeric, 4) AS rasio_cw_sim2,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs,
        COUNT(DISTINCT propinsi)::int          AS jumlah_provinsi
      FROM mv_spending_data
      WHERE ${where} AND idrg_code_1363 IS NOT NULL
      GROUP BY idrg_code_1363
      ORDER BY total_kasus DESC
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/costweight/by-kelompok — Agregasi CW per kelompok layanan
router.get('/by-kelompok', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);

    const { rows } = await pool.query(`
      SELECT
        COALESCE(kelompok_idrg, 'Lainnya')     AS kelompok,
        COUNT(DISTINCT idrg_code_1363)::int     AS jumlah_idrg,
        SUM(jml_kasus)::bigint                  AS total_kasus,
        SUM(total_tarif_inacbg)                 AS total_inacbg,
        SUM(idrg_total_tarif_1363_dengan_af)    AS total_idrg_sim2,
        ROUND(SUM(idrg_total_tarif_1363_dengan_af) / NULLIF(SUM(total_tarif_inacbg),0)::numeric, 4) AS rasio_cw,
        SUM(idrg_total_tarif_1363_dengan_af) - SUM(total_tarif_inacbg) AS selisih
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY kelompok_idrg
      ORDER BY total_kasus DESC
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/costweight/heatmap — MDC vs Regional (avg rasio CW)
router.get('/heatmap', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);

    const { rows } = await pool.query(`
      SELECT
        COALESCE(regional_2023, 'unknown')     AS regional,
        COALESCE(klaim_kompetensi, 'N/A')      AS kompetensi,
        ROUND(SUM(idrg_total_tarif_1363_dengan_af) / NULLIF(SUM(total_tarif_inacbg),0)::numeric, 4) AS rasio_cw,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY regional_2023, klaim_kompetensi
      ORDER BY regional_2023, klaim_kompetensi
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
