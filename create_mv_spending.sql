DROP MATERIALIZED VIEW IF EXISTS mv_spending_data CASCADE;

CREATE MATERIALIZED VIEW mv_spending_data AS
SELECT
  dataset, propinsi, kabupaten, pemilik, jenis, jenis_faskes, kelas_faskes, regional_2023, blu_non_blu, rs_vertikal,
  klaim_kompetensi, kelompok_idrg, bulan_data_uji_coba,
  ptd, kelas_rawat,
  inacbg, MAX(desc_inacbg) AS desc_inacbg, 
  idrg_code_1363, MAX(desc_idrg_1363) AS desc_idrg_1363, 
  idrg_code_1370, MAX(desc_idrg_1370) AS desc_idrg_1370, 
  MAX(idrg_mdc) AS idrg_mdc, 
  kode_rs,
  SUM(jml_kasus) AS jml_kasus,
  SUM(total_tarif_inacbg) AS total_tarif_inacbg,
  SUM(total_tarifrs) AS total_tarifrs,
  SUM(idrg_total_tarif_1363_tanpa_af) AS idrg_total_tarif_1363_tanpa_af,
  SUM(idrg_total_tarif_1363_dengan_af) AS idrg_total_tarif_1363_dengan_af,
  SUM(idrg_total_tarif_1363_dengan_af_afreg) AS idrg_total_tarif_1363_dengan_af_afreg,
  SUM(idrg_total_tarif_1363_dengan_af_afreg_afkep) AS idrg_total_tarif_1363_dengan_af_afreg_afkep,
  SUM(idrg_total_tarif_1370_tanpa_af) AS idrg_total_tarif_1370_tanpa_af,
  SUM(idrg_total_tarif_1370_dengan_af) AS idrg_total_tarif_1370_dengan_af,
  SUM(idrg_total_tarif_1370_dengan_af_afreg) AS idrg_total_tarif_1370_dengan_af_afreg,
  SUM(idrg_total_tarif_1370_dengan_af_afreg_afkep) AS idrg_total_tarif_1370_dengan_af_afreg_afkep,
  SUM(idrg_total_tarif_1363_tanpa_af_juknistopup) AS idrg_total_tarif_1363_tanpa_af_juknistopup,
  SUM(idrg_total_tarif_1363_dengan_af_juknistopup) AS idrg_total_tarif_1363_dengan_af_juknistopup,
  SUM(idrg_total_tarif_1363_dengan_af_afreg_juknistopup) AS idrg_total_tarif_1363_dengan_af_afreg_juknistopup,
  SUM(idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup) AS idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup,
  SUM(idrg_total_tarif_1370_tanpa_af_juknistopup) AS idrg_total_tarif_1370_tanpa_af_juknistopup,
  SUM(idrg_total_tarif_1370_dengan_af_juknistopup) AS idrg_total_tarif_1370_dengan_af_juknistopup,
  SUM(idrg_total_tarif_1370_dengan_af_afreg_juknistopup) AS idrg_total_tarif_1370_dengan_af_afreg_juknistopup,
  SUM(idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup) AS idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup
FROM spending_data
GROUP BY 
  dataset, propinsi, kabupaten, pemilik, jenis, jenis_faskes, kelas_faskes, regional_2023, blu_non_blu, rs_vertikal,
  klaim_kompetensi, kelompok_idrg, bulan_data_uji_coba, ptd, kelas_rawat,
  inacbg, idrg_code_1363, idrg_code_1370, kode_rs;

CREATE INDEX idx_mv2_dataset ON mv_spending_data(dataset);
CREATE INDEX idx_mv2_propinsi ON mv_spending_data(propinsi, dataset);
CREATE INDEX idx_mv2_kode_rs ON mv_spending_data(kode_rs, dataset);
CREATE INDEX idx_mv2_1363 ON mv_spending_data(idrg_code_1363, dataset);
CREATE INDEX idx_mv2_1370 ON mv_spending_data(idrg_code_1370, dataset);
CREATE INDEX idx_mv2_inacbg ON mv_spending_data(inacbg, dataset);
