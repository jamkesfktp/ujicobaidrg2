// routes/nasional.js — Laporan / Uji Coba Nasional endpoints
const express = require('express');
const router  = express.Router();
const { pool }             = require('../db');
const { getTarifCol, buildWhere } = require('./_helpers');

// GET /api/nasional/summary — Ringkasan total nasional
router.get('/summary', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT kode_rs)::int          AS jumlah_rs,
        SUM(jml_kasus)::bigint                AS total_kasus,
        SUM(total_tarif_inacbg)               AS total_tarif_inacbg,
        SUM(total_tarifrs)                    AS total_tarif_rs,
        SUM(${col})                           AS total_tarif_idrg,
        SUM(${col}) - SUM(total_tarif_inacbg) AS selisih,
        CASE WHEN SUM(total_tarif_inacbg) > 0
          THEN ROUND((SUM(${col}) / SUM(total_tarif_inacbg) - 1) * 100, 2)
          ELSE 0 END                          AS pct_selisih,
        COUNT(DISTINCT propinsi)::int         AS jumlah_provinsi,
        COUNT(DISTINCT inacbg)::int           AS jumlah_inacbg,
        COUNT(DISTINCT idrg_code_1363)::int   AS jumlah_idrg_1363,
        COUNT(DISTINCT idrg_code_1370)::int   AS jumlah_idrg_1370
      FROM mv_spending_data
      WHERE ${where}
    `, params);

    res.json(rows[0]);
  } catch (e) {
    console.error('/nasional/summary error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nasional/by-provinsi — Agregasi per provinsi
router.get('/by-provinsi', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        propinsi,
        COUNT(DISTINCT kode_rs)::int          AS jumlah_rs,
        SUM(jml_kasus)::bigint                AS total_kasus,
        SUM(total_tarif_inacbg)               AS total_tarif_inacbg,
        SUM(${col})                           AS total_tarif_idrg,
        SUM(${col}) - SUM(total_tarif_inacbg) AS selisih,
        CASE WHEN SUM(total_tarif_inacbg) > 0
          THEN ROUND((SUM(${col}) / SUM(total_tarif_inacbg) - 1) * 100, 2)
          ELSE 0 END                          AS pct_selisih
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY propinsi
      ORDER BY total_kasus DESC
    `, params);

    res.json(rows);
  } catch (e) {
    console.error('/nasional/by-provinsi error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nasional/by-drg — Top DRG berdasarkan kasus
router.get('/by-drg', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col    = getTarifCol(req.query.simulasi, req.query.drg_type);
    const drgCol = req.query.drg_type === '1370' ? 'idrg_code_1370' : 'idrg_code_1363';
    const descCol= req.query.drg_type === '1370' ? 'desc_idrg_1370' : 'desc_idrg_1363';
    const lim    = Math.min(parseInt(req.query.limit) || 100, 1000);

    const { rows } = await pool.query(`
      SELECT
        ${drgCol}                              AS idrg_code,
        MAX(${descCol})                        AS deskripsi,
        MAX(kelompok_idrg)                     AS kelompok,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(${col}) - SUM(total_tarif_inacbg)  AS selisih,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs,
        COUNT(DISTINCT propinsi)::int          AS jumlah_provinsi
      FROM mv_spending_data
      WHERE ${where} AND ${drgCol} IS NOT NULL
      GROUP BY ${drgCol}
      ORDER BY total_kasus DESC
      LIMIT ${lim}
    `, params);

    res.json(rows);
  } catch (e) {
    console.error('/nasional/by-drg error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nasional/by-kompetensi — Distribusi per level kompetensi klaim
router.get('/by-kompetensi', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        COALESCE(klaim_kompetensi, 'N/A')     AS klaim_kompetensi,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        SUM(${col}) - SUM(total_tarif_inacbg)  AS selisih
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY klaim_kompetensi
      ORDER BY total_kasus DESC
    `, params);

    res.json(rows);
  } catch (e) {
    console.error('/nasional/by-kompetensi error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nasional/by-kelompok — Distribusi per kelompok layanan
router.get('/by-kelompok', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        COALESCE(kelompok_idrg, 'Lainnya')    AS kelompok_idrg,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        SUM(${col}) - SUM(total_tarif_inacbg)  AS selisih,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY kelompok_idrg
      ORDER BY total_kasus DESC
    `, params);

    res.json(rows);
  } catch (e) {
    console.error('/nasional/by-kelompok error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nasional/by-kelas — Distribusi per kelas faskes (A/B/C/D)
router.get('/by-kelas', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        COALESCE(kelas_faskes, '?')            AS kelas_faskes,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY kelas_faskes
      ORDER BY kelas_faskes
    `, params);

    res.json(rows);
  } catch (e) {
    console.error('/nasional/by-kelas error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nasional/inacbg-detail?inacbg=Q-5-44-0 — Lookup satu INA-CBG
router.get('/inacbg-detail', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col    = getTarifCol(req.query.simulasi, req.query.drg_type);
    const inacbg = req.query.inacbg;
    if (!inacbg) return res.status(400).json({ error: 'Parameter inacbg wajib diisi' });

    params.push(inacbg);
    const extraWhere = `AND inacbg = $${params.length}`;

    const { rows } = await pool.query(`
      SELECT
        idrg_code_1363                         AS idrg_code,
        MAX(desc_idrg_1363)                    AS deskripsi,
        MAX(kelompok_idrg)                     AS kelompok,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs,
        COUNT(DISTINCT propinsi)::int          AS jumlah_provinsi
      FROM mv_spending_data
      WHERE ${where} ${extraWhere} AND idrg_code_1363 IS NOT NULL
      GROUP BY idrg_code_1363
      ORDER BY total_kasus DESC
    `, params);

    res.json(rows);
  } catch (e) {
    console.error('/nasional/inacbg-detail error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nasional/filter-options — Semua opsi dropdown filter
router.get('/filter-options', async (req, res) => {
  try {
    const dataset = req.query.dataset || 'jan_des_v11';
    const { rows } = await pool.query(`
      SELECT
        ARRAY_AGG(DISTINCT propinsi ORDER BY propinsi)          AS provinsi_list,
        ARRAY_AGG(DISTINCT kelas_faskes ORDER BY kelas_faskes)  AS kelas_list,
        ARRAY_AGG(DISTINCT pemilik ORDER BY pemilik)            AS pemilik_list,
        ARRAY_AGG(DISTINCT klaim_kompetensi ORDER BY klaim_kompetensi) AS kompetensi_list,
        ARRAY_AGG(DISTINCT kelompok_idrg ORDER BY kelompok_idrg) AS kelompok_list,
        ARRAY_AGG(DISTINCT regional_2023 ORDER BY regional_2023) AS regional_list,
        ARRAY_AGG(DISTINCT bulan_data_uji_coba ORDER BY bulan_data_uji_coba) FILTER (WHERE bulan_data_uji_coba IS NOT NULL) AS bulan_list
      FROM mv_spending_data
      WHERE dataset = $1
    `, [dataset]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
