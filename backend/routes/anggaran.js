// routes/anggaran.js — Simulasi Anggaran Nasional
const express = require('express');
const router  = express.Router();
const { pool }       = require('../db');
const { buildWhere } = require('./_helpers');

// GET /api/anggaran/perbandingan — Perbandingan semua skenario simulasi
router.get('/perbandingan', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);

    const { rows } = await pool.query(`
      SELECT
        SUM(jml_kasus)::bigint                               AS total_kasus,
        SUM(total_tarif_inacbg)                              AS tarif_inacbg,
        SUM(total_tarifrs)                                   AS tarif_rs_aktual,
        -- ── 1363 DRG ──────────────────────────────────────
        SUM(idrg_total_tarif_1363_tanpa_af)                  AS sim1_1363,
        SUM(idrg_total_tarif_1363_dengan_af)                 AS sim2_1363,
        SUM(idrg_total_tarif_1363_dengan_af_afreg)           AS sim3_1363,
        SUM(idrg_total_tarif_1363_dengan_af_afreg_afkep)     AS sim5_1363,
        SUM(idrg_total_tarif_1363_tanpa_af_juknistopup)      AS sim26_1363,
        SUM(idrg_total_tarif_1363_dengan_af_juknistopup)     AS sim54_1363,
        SUM(idrg_total_tarif_1363_dengan_af_afreg_juknistopup)       AS sim3j_1363,
        SUM(idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup) AS sim5j_1363,
        -- ── 1370 DRG ──────────────────────────────────────
        SUM(idrg_total_tarif_1370_tanpa_af)                  AS sim1_1370,
        SUM(idrg_total_tarif_1370_dengan_af)                 AS sim2_1370,
        SUM(idrg_total_tarif_1370_dengan_af_afreg)           AS sim3_1370,
        SUM(idrg_total_tarif_1370_dengan_af_afreg_afkep)     AS sim5_1370,
        SUM(idrg_total_tarif_1370_tanpa_af_juknistopup)      AS sim41_1370,
        SUM(idrg_total_tarif_1370_dengan_af_juknistopup)     AS sim41af_1370,
        SUM(idrg_total_tarif_1370_dengan_af_afreg_juknistopup)       AS sim3j_1370,
        SUM(idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup) AS sim5j_1370,
        -- ── Meta ──────────────────────────────────────────
        COUNT(DISTINCT kode_rs)::int                         AS jumlah_rs,
        COUNT(DISTINCT propinsi)::int                        AS jumlah_provinsi,
        COUNT(DISTINCT idrg_code_1363)::int                  AS jumlah_idrg_1363,
        COUNT(DISTINCT idrg_code_1370)::int                  AS jumlah_idrg_1370
      FROM mv_spending_data
      WHERE ${where}
    `, params);

    res.json(rows[0]);
  } catch (e) {
    console.error('/anggaran/perbandingan error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/anggaran/by-provinsi — Perbandingan anggaran per provinsi
router.get('/by-provinsi', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);

    const { rows } = await pool.query(`
      SELECT
        propinsi,
        SUM(jml_kasus)::bigint                           AS total_kasus,
        SUM(total_tarif_inacbg)                          AS tarif_inacbg,
        SUM(idrg_total_tarif_1363_dengan_af)             AS sim2_1363,
        SUM(idrg_total_tarif_1363_dengan_af_afreg)       AS sim3_1363,
        SUM(idrg_total_tarif_1370_dengan_af)             AS sim2_1370,
        SUM(idrg_total_tarif_1363_dengan_af_juknistopup) AS sim54_1363,
        COUNT(DISTINCT kode_rs)::int                     AS jumlah_rs
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY propinsi
      ORDER BY tarif_inacbg DESC
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/anggaran/by-kelas — Perbandingan anggaran per kelas RS
router.get('/by-kelas', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);

    const { rows } = await pool.query(`
      SELECT
        COALESCE(kelas_faskes, '?')                      AS kelas_faskes,
        SUM(jml_kasus)::bigint                           AS total_kasus,
        SUM(total_tarif_inacbg)                          AS tarif_inacbg,
        SUM(idrg_total_tarif_1363_dengan_af)             AS sim2_1363,
        SUM(idrg_total_tarif_1370_dengan_af)             AS sim2_1370,
        SUM(idrg_total_tarif_1363_dengan_af_juknistopup) AS sim54_1363,
        COUNT(DISTINCT kode_rs)::int                     AS jumlah_rs
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY kelas_faskes
      ORDER BY kelas_faskes
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
