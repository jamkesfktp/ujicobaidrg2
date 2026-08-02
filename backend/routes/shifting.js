// routes/shifting.js — Simulasi Shifting RS
const express = require('express');
const router  = express.Router();
const { pool }             = require('../db');
const { getTarifCol, buildWhere } = require('./_helpers');

// GET /api/shifting — RS yang berpotensi shifting (tarif iDRG vs INA-CBG)
router.get('/', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col       = getTarifCol(req.query.simulasi, req.query.drg_type);
    const threshold = parseFloat(req.query.threshold) || 1.0;
    const mode      = req.query.mode || 'all'; // 'naik', 'turun', 'all'
    const lim       = Math.min(parseInt(req.query.limit) || 500, 2000);

    let havingClause = '';
    if (mode === 'naik')  havingClause = `HAVING SUM(${col}) / NULLIF(SUM(total_tarif_inacbg),0) > ${threshold}`;
    if (mode === 'turun') havingClause = `HAVING SUM(${col}) / NULLIF(SUM(total_tarif_inacbg),0) < ${threshold}`;

    const { rows } = await pool.query(`
      SELECT
        kode_rs,
        MAX(propinsi)                          AS propinsi,
        MAX(kabupaten)                         AS kabupaten,
        MAX(pemilik)                           AS pemilik,
        MAX(jenis_faskes)                      AS jenis_faskes,
        MAX(kelas_faskes)                      AS kelas_faskes,
        MAX(regional_2023)                     AS regional,
        MAX(faskes_kompetensi)                 AS faskes_kompetensi,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        SUM(total_tarifrs)                     AS total_tarif_rs,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(${col}) - SUM(total_tarif_inacbg)  AS selisih_absolut,
        SUM(${col}) - SUM(total_tarifrs)       AS selisih_vs_aktual,
        ROUND(SUM(${col}) / NULLIF(SUM(total_tarif_inacbg),0)::numeric, 4) AS rasio_idrg_inacbg,
        ROUND(SUM(${col}) / NULLIF(SUM(total_tarifrs),0)::numeric, 4)      AS rasio_idrg_aktual,
        COUNT(DISTINCT idrg_code_1363)::int    AS jumlah_idrg
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY kode_rs
      ${havingClause}
      ORDER BY selisih_absolut DESC
      LIMIT ${lim}
    `, params);

    res.json(rows);
  } catch (e) {
    console.error('/shifting error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/shifting/by-drg — iDRG yang paling banyak menyebabkan shifting
router.get('/by-drg', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const lim = Math.min(parseInt(req.query.limit) || 50, 200);

    const { rows } = await pool.query(`
      SELECT
        idrg_code_1363,
        MAX(desc_idrg_1363)                    AS deskripsi,
        MAX(kelompok_idrg)                     AS kelompok,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(${col}) - SUM(total_tarif_inacbg)  AS selisih_total,
        ROUND(AVG(${col} / NULLIF(total_tarif_inacbg,0))::numeric, 4) AS avg_rasio,
        COUNT(DISTINCT kode_rs)::int           AS jumlah_rs
      FROM mv_spending_data
      WHERE ${where} AND idrg_code_1363 IS NOT NULL
      GROUP BY idrg_code_1363
      ORDER BY ABS(SUM(${col}) - SUM(total_tarif_inacbg)) DESC
      LIMIT ${lim}
    `, params);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/shifting/summary — Ringkasan nasional potensi shifting
router.get('/summary', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN ${col} > total_tarif_inacbg THEN kode_rs END)::int AS rs_naik,
        COUNT(DISTINCT CASE WHEN ${col} < total_tarif_inacbg THEN kode_rs END)::int AS rs_turun,
        COUNT(DISTINCT CASE WHEN ${col} = total_tarif_inacbg THEN kode_rs END)::int AS rs_sama,
        SUM(CASE WHEN ${col} > total_tarif_inacbg THEN ${col} - total_tarif_inacbg ELSE 0 END) AS total_kenaikan,
        SUM(CASE WHEN ${col} < total_tarif_inacbg THEN total_tarif_inacbg - ${col} ELSE 0 END) AS total_penurunan
      FROM (
        SELECT kode_rs,
          SUM(${col}) AS ${col.replace(/\./g,'_')}_sum,
          SUM(total_tarif_inacbg) AS inacbg_sum
        FROM mv_spending_data WHERE ${where}
        GROUP BY kode_rs
      ) sub
      CROSS JOIN LATERAL (
        SELECT sub."${col.replace(/\./g,'_')}_sum" AS ${col},
               sub.inacbg_sum AS total_tarif_inacbg
      ) v
    `, params);

    // Fallback query yang lebih sederhana
    const simple = await pool.query(`
      WITH rs_totals AS (
        SELECT kode_rs,
          SUM(${col}) AS tarif_idrg,
          SUM(total_tarif_inacbg) AS tarif_inacbg
        FROM mv_spending_data WHERE ${where}
        GROUP BY kode_rs
      )
      SELECT
        COUNT(CASE WHEN tarif_idrg > tarif_inacbg THEN 1 END)::int AS rs_naik,
        COUNT(CASE WHEN tarif_idrg < tarif_inacbg THEN 1 END)::int AS rs_turun,
        COUNT(CASE WHEN tarif_idrg = tarif_inacbg THEN 1 END)::int AS rs_sama,
        SUM(CASE WHEN tarif_idrg > tarif_inacbg THEN tarif_idrg - tarif_inacbg ELSE 0 END) AS total_kenaikan,
        SUM(CASE WHEN tarif_idrg < tarif_inacbg THEN tarif_inacbg - tarif_idrg ELSE 0 END) AS total_penurunan
      FROM rs_totals
    `, params);

    res.json(simple.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
