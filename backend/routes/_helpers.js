// routes/_helpers.js — Shared helper functions for all routes

/**
 * Map simulasi number ke nama kolom tarif di database
 */
function getTarifCol(simulasi, drgType = '1363') {
  const sim = parseInt(simulasi) || 2;
  const dt  = drgType === '1370' ? '1370' : '1363';

  const map = {
    1:  `idrg_total_tarif_${dt}_tanpa_af`,
    2:  `idrg_total_tarif_${dt}_dengan_af`,
    3:  `idrg_total_tarif_${dt}_dengan_af_afreg`,
    4:  `idrg_total_tarif_${dt}_dengan_af`,
    5:  `idrg_total_tarif_${dt}_dengan_af_afreg_afkep`,
    6:  `idrg_total_tarif_${dt}_dengan_af`,
    7:  `idrg_total_tarif_${dt}_dengan_af_afreg`,
    8:  `idrg_total_tarif_${dt}_dengan_af_afreg_afkep`,
    26: `idrg_total_tarif_1363_tanpa_af_juknistopup`,
    54: `idrg_total_tarif_1363_dengan_af_juknistopup`,
    41: `idrg_total_tarif_1370_dengan_af_juknistopup`,
  };

  return map[sim] || `idrg_total_tarif_${dt}_dengan_af`;
}

/**
 * Build parameterized WHERE clause dari query params request
 * Returns { where: string, params: array }
 */
function buildWhere(q) {
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  // Dataset (wajib)
  params.push(q.dataset || 'jan_des_v11');
  conditions.push(`dataset = $${idx++}`);

  if (q.propinsi && q.propinsi !== 'all') {
    params.push(q.propinsi.split(',').map(s => s.trim()));
    conditions.push(`propinsi = ANY($${idx++})`);
  }
  if (q.kabupaten) {
    params.push(q.kabupaten.split(',').map(s => s.trim()));
    conditions.push(`kabupaten = ANY($${idx++})`);
  }
  if (q.kelas_faskes) {
    params.push(q.kelas_faskes.split(',').map(s => s.trim()));
    conditions.push(`kelas_faskes = ANY($${idx++})`);
  }
  if (q.pemilik && q.pemilik !== 'all') {
    params.push(q.pemilik);
    conditions.push(`pemilik = $${idx++}`);
  }
  if (q.klaim_kompetensi && q.klaim_kompetensi !== 'all') {
    params.push(q.klaim_kompetensi);
    conditions.push(`klaim_kompetensi = $${idx++}`);
  }
  if (q.kelompok && q.kelompok !== 'all') {
    params.push(q.kelompok);
    conditions.push(`kelompok_idrg = $${idx++}`);
  }
  if (q.regional && q.regional !== 'all') {
    params.push(q.regional);
    conditions.push(`regional_2023 = $${idx++}`);
  }
  if (q.bulan && q.bulan !== 'all') {
    params.push(`%${q.bulan}%`);
    conditions.push(`bulan_data_uji_coba ILIKE $${idx++}`);
  }
  if (q.drg_type === '1363') {
    conditions.push(`idrg_code_1363 IS NOT NULL`);
  }
  if (q.drg_type === '1370') {
    conditions.push(`idrg_code_1370 IS NOT NULL`);
  }

  return {
    where:  conditions.join(' AND '),
    params: params,
    nextIdx: idx
  };
}

module.exports = { getTarifCol, buildWhere };
