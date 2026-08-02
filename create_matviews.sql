DROP VIEW IF EXISTS v_rs_summary CASCADE;
DROP VIEW IF EXISTS v_provinsi_summary CASCADE;

CREATE MATERIALIZED VIEW v_rs_summary AS
SELECT
  dataset,
  kode_rs,
  MAX(propinsi)              AS propinsi,
  MAX(kabupaten)             AS kabupaten,
  MAX(pemilik)               AS pemilik,
  MAX(jenis)                 AS jenis,
  MAX(kelas_faskes)          AS kelas_faskes,
  MAX(regional_2023)         AS regional,
  MAX(faskes_kompetensi)     AS faskes_kompetensi,
  SUM(jml_kasus)             AS total_kasus,
  SUM(total_tarif_inacbg)    AS total_tarif_inacbg,
  SUM(idrg_total_tarif_1363_dengan_af) AS total_idrg_sim2_1363,
  SUM(idrg_total_tarif_1370_dengan_af) AS total_idrg_sim2_1370
FROM spending_data
GROUP BY dataset, kode_rs;

CREATE MATERIALIZED VIEW v_provinsi_summary AS
SELECT
  dataset,
  propinsi,
  COUNT(DISTINCT kode_rs)    AS jumlah_rs,
  SUM(jml_kasus)             AS total_kasus,
  SUM(total_tarif_inacbg)    AS total_tarif_inacbg,
  SUM(idrg_total_tarif_1363_dengan_af) AS total_idrg_sim2_1363
FROM spending_data
GROUP BY dataset, propinsi;

CREATE UNIQUE INDEX idx_mv_rs_summary ON v_rs_summary(dataset, kode_rs);
CREATE UNIQUE INDEX idx_mv_provinsi_summary ON v_provinsi_summary(dataset, propinsi);
