// routes/strategis.js — Dashboard Strategis per RS
const express = require('express');
const router  = express.Router();
const { pool }             = require('../db');
const { getTarifCol, buildWhere } = require('./_helpers');

// GET /api/strategis/rs-list — Daftar semua RS dengan aggregasi
router.get('/rs-list', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT
        kode_rs,
        MAX(propinsi)                          AS propinsi,
        MAX(kabupaten)                         AS kabupaten,
        MAX(pemilik)                           AS pemilik,
        MAX(jenis)                             AS jenis,
        MAX(jenis_faskes)                      AS jenis_faskes,
        MAX(kelas_faskes)                      AS kelas_faskes,
        MAX(regional_2023)                     AS regional,
        MAX(faskes_kompetensi)                 AS faskes_kompetensi,
        MAX(blu_non_blu)                       AS blu_non_blu,
        MAX(rs_vertikal)                       AS rs_vertikal,
        SUM(jml_kasus)::bigint                 AS total_kasus,
        SUM(total_tarif_inacbg)                AS total_tarif_inacbg,
        SUM(total_tarifrs)                     AS total_tarif_rs,
        SUM(${col})                            AS total_tarif_idrg,
        SUM(${col}) - SUM(total_tarif_inacbg)  AS selisih,
        CASE WHEN SUM(total_tarif_inacbg) > 0
          THEN ROUND((SUM(${col}) / SUM(total_tarif_inacbg) - 1) * 100, 2)
          ELSE 0 END                           AS pct_selisih,
        COUNT(DISTINCT inacbg)::int            AS jumlah_inacbg,
        COUNT(DISTINCT idrg_code_1363)::int    AS jumlah_idrg
      FROM mv_spending_data
      WHERE ${where}
      GROUP BY kode_rs
      ORDER BY total_kasus DESC
    `, params);

    res.json(rows);
  } catch (e) {
    console.error('/strategis/rs-list error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/strategis/rs/:kode — Detail satu rumah sakit
router.get('/rs/:kode', async (req, res) => {
  try {
    const { kode } = req.params;
    const dataset  = req.query.dataset || 'jan_des_v11';
    const col      = getTarifCol(req.query.simulasi, req.query.drg_type);
    const p        = [dataset, kode];

    const [info, kelompok, topDrg, topInacbg, byKompetensi, allSims] = await Promise.all([
      // Info dasar RS + total
      pool.query(`
        SELECT kode_rs,
          MAX(propinsi) AS propinsi, MAX(kabupaten) AS kabupaten,
          MAX(pemilik) AS pemilik, MAX(jenis) AS jenis,
          MAX(jenis_faskes) AS jenis_faskes, MAX(kelas_faskes) AS kelas_faskes,
          MAX(regional_2023) AS regional, MAX(faskes_kompetensi) AS faskes_kompetensi,
          MAX(blu_non_blu) AS blu_non_blu, MAX(rs_vertikal) AS rs_vertikal,
          SUM(jml_kasus)::bigint AS total_kasus,
          SUM(total_tarif_inacbg) AS total_tarif_inacbg,
          SUM(total_tarifrs) AS total_tarif_rs,
          SUM(${col}) AS total_tarif_idrg,
          SUM(${col}) - SUM(total_tarif_inacbg) AS selisih
        FROM mv_spending_data WHERE dataset=$1 AND kode_rs=$2 GROUP BY kode_rs
      `, p),

      // Breakdown per kelompok layanan
      pool.query(`
        SELECT kelompok_idrg, klaim_kompetensi,
          SUM(jml_kasus)::bigint AS kasus,
          SUM(${col}) AS tarif_idrg,
          SUM(total_tarif_inacbg) AS tarif_inacbg,
          SUM(${col}) - SUM(total_tarif_inacbg) AS selisih
        FROM mv_spending_data WHERE dataset=$1 AND kode_rs=$2
        GROUP BY kelompok_idrg, klaim_kompetensi ORDER BY kasus DESC
      `, p),

      // Top 20 iDRG
      pool.query(`
        SELECT idrg_code_1363, MAX(desc_idrg_1363) AS deskripsi,
          MAX(kelompok_idrg) AS kelompok,
          SUM(jml_kasus)::bigint AS kasus,
          SUM(${col}) AS tarif_idrg,
          SUM(total_tarif_inacbg) AS tarif_inacbg
        FROM mv_spending_data WHERE dataset=$1 AND kode_rs=$2 AND idrg_code_1363 IS NOT NULL
        GROUP BY idrg_code_1363 ORDER BY kasus DESC LIMIT 20
      `, p),

      // Top 20 INA-CBG
      pool.query(`
        SELECT inacbg, MAX(desc_inacbg) AS deskripsi,
          SUM(jml_kasus)::bigint AS kasus,
          SUM(${col}) AS tarif_idrg
        FROM mv_spending_data WHERE dataset=$1 AND kode_rs=$2 AND inacbg IS NOT NULL
        GROUP BY inacbg ORDER BY kasus DESC LIMIT 20
      `, p),

      // Distribusi per kompetensi
      pool.query(`
        SELECT klaim_kompetensi,
          SUM(jml_kasus)::bigint AS kasus,
          SUM(${col}) AS tarif_idrg,
          SUM(total_tarif_inacbg) AS tarif_inacbg
        FROM mv_spending_data WHERE dataset=$1 AND kode_rs=$2
        GROUP BY klaim_kompetensi ORDER BY kasus DESC
      `, p),

      // Semua simulasi sekaligus (untuk tabel perbandingan)
      pool.query(`
        SELECT
          SUM(idrg_total_tarif_1363_tanpa_af) AS sim1_1363,
          SUM(idrg_total_tarif_1363_dengan_af) AS sim2_1363,
          SUM(idrg_total_tarif_1363_dengan_af_afreg) AS sim3_1363,
          SUM(idrg_total_tarif_1363_dengan_af_afreg_afkep) AS sim5_1363,
          SUM(idrg_total_tarif_1370_tanpa_af) AS sim1_1370,
          SUM(idrg_total_tarif_1370_dengan_af) AS sim2_1370,
          SUM(idrg_total_tarif_1370_dengan_af_afreg) AS sim3_1370,
          SUM(idrg_total_tarif_1363_tanpa_af_juknistopup) AS sim26,
          SUM(idrg_total_tarif_1363_dengan_af_juknistopup) AS sim54,
          SUM(idrg_total_tarif_1370_dengan_af_juknistopup) AS sim41,
          SUM(total_tarif_inacbg) AS baseline_inacbg
        FROM mv_spending_data WHERE dataset=$1 AND kode_rs=$2
      `, p),
    ]);

    res.json({
      info:         info.rows[0],
      kelompok:     kelompok.rows,
      top_drg:      topDrg.rows,
      top_inacbg:   topInacbg.rows,
      by_kompetensi:byKompetensi.rows,
      simulasi_all: allSims.rows[0],
    });
  } catch (e) {
    console.error('/strategis/rs/:kode error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/strategis/compare?kode_rs=xxx,yyy — Bandingkan beberapa RS
router.get('/compare', async (req, res) => {
  try {
    const { dataset = 'jan_des_v11', kode_rs } = req.query;
    if (!kode_rs) return res.status(400).json({ error: 'kode_rs wajib diisi (pisahkan dengan koma)' });

    const kodes = kode_rs.split(',').map(s => s.trim()).filter(Boolean);
    const col   = getTarifCol(req.query.simulasi, req.query.drg_type);

    const { rows } = await pool.query(`
      SELECT kode_rs,
        MAX(propinsi) AS propinsi, MAX(pemilik) AS pemilik,
        MAX(kelas_faskes) AS kelas_faskes, MAX(faskes_kompetensi) AS faskes_kompetensi,
        SUM(jml_kasus)::bigint AS total_kasus,
        SUM(total_tarif_inacbg) AS total_tarif_inacbg,
        SUM(${col}) AS total_tarif_idrg,
        SUM(${col}) - SUM(total_tarif_inacbg) AS selisih
      FROM mv_spending_data WHERE dataset=$1 AND kode_rs = ANY($2)
      GROUP BY kode_rs ORDER BY total_kasus DESC
    `, [dataset, kodes]);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
