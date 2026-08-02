-- =============================================================
-- Schema: iDRG Dashboard Database
-- File  : backend/scripts/01_create_schema.sql
-- Cara  : psql -U idrg_user -d idrg_dashboard -f backend/scripts/01_create_schema.sql
-- =============================================================

-- Bersihkan jika sudah ada
DROP TABLE IF EXISTS spending_data CASCADE;
DROP VIEW  IF EXISTS v_rs_summary       CASCADE;
DROP VIEW  IF EXISTS v_provinsi_summary CASCADE;

-- Tabel utama (partitioned by dataset)
CREATE TABLE spending_data (
  id                    BIGSERIAL,
  dataset               VARCHAR(30)   NOT NULL,
  kode_rs               VARCHAR(20),
  propinsi              VARCHAR(100),
  kabupaten             VARCHAR(150),
  pemilik               VARCHAR(10),
  jenis                 VARCHAR(50),
  jenis_faskes          VARCHAR(50),
  pemilik_faskes        VARCHAR(10),
  kelas_faskes          VARCHAR(5),
  regional_2023         VARCHAR(10),
  blu_non_blu           VARCHAR(30),
  rs_vertikal           VARCHAR(10),
  ptd                   SMALLINT,
  kelas_rawat           SMALLINT,
  kelompok_idrg         VARCHAR(150),
  kelompok_icd          VARCHAR(300),
  faskes_kompetensi     VARCHAR(30),
  klaim_kompetensi      VARCHAR(30),
  inacbg                VARCHAR(20),
  desc_inacbg           VARCHAR(400),
  idrg_mdc              SMALLINT,
  idrg_dc_1370          INTEGER,
  idrg_code_1370        VARCHAR(20),
  desc_idrg_1370        VARCHAR(400),
  idrg_dc_1363          INTEGER,
  idrg_code_1363        VARCHAR(20),
  desc_idrg_1363        VARCHAR(400),
  bulan_data_uji_coba   VARCHAR(80),  -- hanya okt_jun_v3, NULL untuk jan_des_v11
  jml_kasus             BIGINT,
  total_tarif_inacbg    NUMERIC(22,2),
  tarif_inacbg          NUMERIC(22,2),
  tarif_inacbg_1        NUMERIC(22,2),
  total_tarifrs         NUMERIC(22,2),
  -- iDRG 1363
  idrg_tarif_1363_tanpa_af                          NUMERIC(22,2),
  idrg_total_tarif_1363_tanpa_af                    NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af                   NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_afreg             NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_afreg_afkep       NUMERIC(22,2),
  -- iDRG 1370
  idrg_tarif_1370_tanpa_af                          NUMERIC(22,2),
  idrg_total_tarif_1370_tanpa_af                    NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af                   NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_afreg             NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_afreg_afkep       NUMERIC(22,2),
  -- Juknis Top Up 1363
  idrg_total_tarif_1363_tanpa_af_juknistopup                NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_juknistopup               NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_afreg_juknistopup         NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup   NUMERIC(22,2),
  -- Juknis Top Up 1370
  idrg_total_tarif_1370_tanpa_af_juknistopup                NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_juknistopup               NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_afreg_juknistopup         NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup   NUMERIC(22,2),
  PRIMARY KEY (id, dataset)
) PARTITION BY LIST (dataset);

-- Partisi per dataset
CREATE TABLE spending_jan_des PARTITION OF spending_data
  FOR VALUES IN ('jan_des_v11');

CREATE TABLE spending_okt_jun PARTITION OF spending_data
  FOR VALUES IN ('okt_jun_v3');

-- ─── Views untuk query cepat ─────────────────────────────────────────────

CREATE OR REPLACE VIEW v_rs_summary AS
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

CREATE OR REPLACE VIEW v_provinsi_summary AS
SELECT
  dataset,
  propinsi,
  COUNT(DISTINCT kode_rs)    AS jumlah_rs,
  SUM(jml_kasus)             AS total_kasus,
  SUM(total_tarif_inacbg)    AS total_tarif_inacbg,
  SUM(idrg_total_tarif_1363_dengan_af) AS total_idrg_sim2_1363
FROM spending_data
GROUP BY dataset, propinsi;

-- ─── Indexes (jalankan SETELAH import selesai!) ──────────────────────────
-- Uncomment dan jalankan setelah kedua CSV selesai diimport:

-- CREATE INDEX idx_sd_kode_rs  ON spending_data(kode_rs,  dataset);
-- CREATE INDEX idx_sd_propinsi ON spending_data(propinsi, dataset);
-- CREATE INDEX idx_sd_idrg1363 ON spending_data(idrg_code_1363, dataset);
-- CREATE INDEX idx_sd_idrg1370 ON spending_data(idrg_code_1370, dataset);
-- CREATE INDEX idx_sd_inacbg   ON spending_data(inacbg,   dataset);
-- CREATE INDEX idx_sd_kelompok ON spending_data(kelompok_idrg, dataset);
-- CREATE INDEX idx_sd_bulan    ON spending_data(bulan_data_uji_coba, dataset);
-- CREATE INDEX idx_sd_komp     ON spending_data(klaim_kompetensi, dataset);
-- CREATE INDEX idx_sd_pemilik  ON spending_data(pemilik, dataset);
-- CREATE INDEX idx_sd_kelas    ON spending_data(kelas_faskes, dataset);

SELECT 'Schema berhasil dibuat! ✅' AS status;
SELECT 'Langkah berikutnya: jalankan 02_import_csv.py' AS next_step;
