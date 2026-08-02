const { Pool } = require('pg');

const KOMP_LVL = { 'dasar': 1, 'madya': 2, 'utama': 3, 'paripurna': 4 };

function initSim() {
    const sim = {};
    for (let i = 1; i <= 61; i++) sim[`tarif_${i}`] = 0.0;
    return sim;
}

function initMetric() {
    return { kasus: 0.0, inacbg: 0.0, sim: initSim() };
}

class Aggregator {
    constructor() {
        this.hospitals = {};
        this.profiles = {};
        this.crosstab = {
            nasional: initMetric(),
            byTipeRs: {},
            byKelasRawat: {},
            byKompetensi: {},
            byLayanan: {}
        };
        this.distribution = {
            pie: { ri: 0.0, rj: 0.0 },
            cmg_ri: {}, cmg_rj: {},
            mdc_ri: {}, mdc_rj: {},
            severity_inacbg: {}, severity_idrg: {}
        };
    }
}

const globalCache = {};

async function loadDatasetFromDb(pool, datasetId) {
    console.log(`[DataGenerator] Loading dataset ${datasetId} using SQL Aggregations...`);
    const t0 = Date.now();
    const agg = new Aggregator();
    
    const dbDataset = (datasetId.startsWith('jan_des_v11') || datasetId.startsWith('dataset4') || datasetId.startsWith('dataset1'))
        ? 'jan_des_v11'
        : 'okt_jun_v3';

    const is1370 = datasetId.includes('1370');
    const tCol1 = is1370 ? 'idrg_total_tarif_1370_tanpa_af' : 'idrg_total_tarif_1363_tanpa_af';
    const tCol2 = is1370 ? 'idrg_total_tarif_1370_tanpa_af_juknistopup' : 'idrg_total_tarif_1363_tanpa_af_juknistopup';
    const tCol3 = is1370 ? 'idrg_total_tarif_1370_dengan_af' : 'idrg_total_tarif_1363_dengan_af';
    const tCol4 = is1370 ? 'idrg_total_tarif_1370_dengan_af_juknistopup' : 'idrg_total_tarif_1363_dengan_af_juknistopup';
    const tCol5 = is1370 ? 'idrg_total_tarif_1370_dengan_af_afreg' : 'idrg_total_tarif_1363_dengan_af_afreg';
    const tCol6 = is1370 ? 'idrg_total_tarif_1370_dengan_af_afreg_juknistopup' : 'idrg_total_tarif_1363_dengan_af_afreg_juknistopup';
    const tCol7 = is1370 ? 'idrg_total_tarif_1370_dengan_af_afreg_afkep' : 'idrg_total_tarif_1363_dengan_af_afreg_afkep';
    const tCol8 = is1370 ? 'idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup' : 'idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup';

    // 1. Fetch Hospitals (~3k rows)
    const qHosp = `
        SELECT 
            kode_rs, propinsi, kabupaten, kelas_faskes, jenis, jenis_faskes, regional_2023, pemilik,
            SUM(jml_kasus) as kasus,
            SUM(total_tarif_inacbg) as inacbg,
            SUM(${tCol1}) as t1, SUM(${tCol2}) as t2, SUM(${tCol3}) as t3, SUM(${tCol4}) as t4,
            SUM(${tCol5}) as t5, SUM(${tCol6}) as t6, SUM(${tCol7}) as t7, SUM(${tCol8}) as t8
        FROM mv_spending_data
        WHERE dataset = $1
        GROUP BY kode_rs, propinsi, kabupaten, kelas_faskes, jenis, jenis_faskes, regional_2023, pemilik
    `;
    const resHosp = await pool.query(qHosp, [dbDataset]);
    console.log(`[DataGenerator] Loaded ${resHosp.rows.length} hospitals in ${Date.now() - t0}ms`);

    resHosp.rows.forEach(row => {
        const rs_id = (row.kode_rs || 'UNKNOWN').trim();
        const k_faskes_raw = (row.kelas_faskes || '').trim().toUpperCase();
        const k_faskes = ['A', 'B', 'C', 'D'].includes(k_faskes_raw) ? k_faskes_raw : 'Lainnya';
        
        const sim = {};
        for(let i=1; i<=8; i++) sim[`tarif_${i}`] = parseFloat(row[`t${i}`]) || 0;
        for(let i=9; i<=61; i++) sim[`tarif_${i}`] = sim['tarif_8'];

        agg.hospitals[rs_id] = {
            id: rs_id, label: `RS ${rs_id} (${rs_id})`, nama: `RS ${rs_id}`,
            prov: (row.propinsi || '').trim(), prop: (row.propinsi || '').trim(), kab: (row.kabupaten || '').trim(), 
            kelasFaskes: k_faskes, jenis: row.jenis || '',
            jenisFaskes: row.jenis_faskes || '', regional: row.regional_2023 || '', pemilik: row.pemilik || '',
            kasus: parseFloat(row.kasus) || 0,
            inacbg: parseFloat(row.inacbg) || 0,
            sim
        };
    });

    // 2. Fetch Global Crosstab (~500 rows)
    const qCross = `
        SELECT 
            kelas_faskes, kelas_rawat, ptd, klaim_kompetensi,
            SUM(jml_kasus) as kasus,
            SUM(total_tarif_inacbg) as inacbg,
            SUM(${tCol1}) as t1, SUM(${tCol2}) as t2, SUM(${tCol3}) as t3, SUM(${tCol4}) as t4,
            SUM(${tCol5}) as t5, SUM(${tCol6}) as t6, SUM(${tCol7}) as t7, SUM(${tCol8}) as t8
        FROM mv_spending_data
        WHERE dataset = $1
        GROUP BY kelas_faskes, kelas_rawat, ptd, klaim_kompetensi
    `;
    const resCross = await pool.query(qCross, [dbDataset]);
    console.log(`[DataGenerator] Loaded ${resCross.rows.length} crosstab groups in ${Date.now() - t0}ms`);

    resCross.rows.forEach(row => {
        const k_faskes_raw = (row.kelas_faskes || '').trim().toUpperCase();
        const k_faskes = ['A', 'B', 'C', 'D'].includes(k_faskes_raw) ? k_faskes_raw : 'Lainnya';
        const kelas_rawat = (row.kelas_rawat !== null && String(row.kelas_rawat).trim() === '1') ? 'ri' : 'rj';
        const lowered_komp = (row.klaim_kompetensi || 'dasar').trim().toLowerCase();
        
        const kasus = parseFloat(row.kasus) || 0;
        const inacbg = parseFloat(row.inacbg) || 0;
        const tarifs = {};
        for(let i=1; i<=8; i++) tarifs[i] = parseFloat(row[`t${i}`]) || 0;
        for(let i=9; i<=61; i++) tarifs[i] = tarifs[8];

        // National
        agg.crosstab.nasional.kasus += kasus;
        agg.crosstab.nasional.inacbg += inacbg;
        for(let i=1; i<=61; i++) agg.crosstab.nasional.sim[`tarif_${i}`] += tarifs[i];

        // byTipeRs
        if (!agg.crosstab.byTipeRs[k_faskes]) agg.crosstab.byTipeRs[k_faskes] = {};
        if (!agg.crosstab.byTipeRs[k_faskes][kelas_rawat]) agg.crosstab.byTipeRs[k_faskes][kelas_rawat] = initMetric();
        agg.crosstab.byTipeRs[k_faskes][kelas_rawat].kasus += kasus;
        agg.crosstab.byTipeRs[k_faskes][kelas_rawat].inacbg += inacbg;
        for(let i=1; i<=61; i++) agg.crosstab.byTipeRs[k_faskes][kelas_rawat].sim[`tarif_${i}`] += tarifs[i];

        // byKompetensi
        if (!agg.crosstab.byKompetensi[k_faskes]) agg.crosstab.byKompetensi[k_faskes] = {};
        if (!agg.crosstab.byKompetensi[k_faskes][kelas_rawat]) agg.crosstab.byKompetensi[k_faskes][kelas_rawat] = {};
        if (!agg.crosstab.byKompetensi[k_faskes][kelas_rawat][lowered_komp]) agg.crosstab.byKompetensi[k_faskes][kelas_rawat][lowered_komp] = initMetric();
        agg.crosstab.byKompetensi[k_faskes][kelas_rawat][lowered_komp].kasus += kasus;
        agg.crosstab.byKompetensi[k_faskes][kelas_rawat][lowered_komp].inacbg += inacbg;
        for(let i=1; i<=61; i++) agg.crosstab.byKompetensi[k_faskes][kelas_rawat][lowered_komp].sim[`tarif_${i}`] += tarifs[i];
    });

    // 3. Fetch Global Distribution
    const qDist = `
        SELECT 
            kelas_rawat, inacbg, idrg_mdc, 
            ${is1370 ? 'idrg_code_1370' : 'idrg_code_1363'} as drg_code,
            SUM(jml_kasus) as kasus
        FROM mv_spending_data
        WHERE dataset = $1
        GROUP BY kelas_rawat, inacbg, idrg_mdc, ${is1370 ? 'idrg_code_1370' : 'idrg_code_1363'}
    `;
    const resDist = await pool.query(qDist, [dbDataset]);
    console.log(`[DataGenerator] Loaded ${resDist.rows.length} distribution groups in ${Date.now() - t0}ms`);

    resDist.rows.forEach(row => {
        const kelas_rawat = (row.kelas_rawat !== null && String(row.kelas_rawat).trim() === '1') ? 'ri' : 'rj';
        const kasus = parseFloat(row.kasus) || 0;
        const ina_code = (row.inacbg || '').trim();
        const cmg = ina_code.length > 0 ? ina_code[0] : 'U';
        const mdc = (row.idrg_mdc || '').toString().trim();
        const drg = (row.drg_code || '').trim();
        const sev_idrg = drg.length > 0 ? drg.slice(-1) : '';
        const sev_ina = ina_code.includes('-') ? ina_code.split('-').pop() : '';

        agg.distribution.pie[kelas_rawat] += kasus;
        if (kelas_rawat === 'ri') {
            if (sev_idrg) agg.distribution.severity_idrg[sev_idrg] = (agg.distribution.severity_idrg[sev_idrg] || 0) + kasus;
            if (sev_ina) agg.distribution.severity_inacbg[sev_ina] = (agg.distribution.severity_inacbg[sev_ina] || 0) + kasus;
            agg.distribution.cmg_ri[cmg] = (agg.distribution.cmg_ri[cmg] || 0) + kasus;
            if (mdc) agg.distribution.mdc_ri[mdc] = (agg.distribution.mdc_ri[mdc] || 0) + kasus;
        } else {
            agg.distribution.cmg_rj[cmg] = (agg.distribution.cmg_rj[cmg] || 0) + kasus;
            if (mdc) agg.distribution.mdc_rj[mdc] = (agg.distribution.mdc_rj[mdc] || 0) + kasus;
        }
    });

    // 4. Fetch RS Profiles (~100k rows)
    const qProf = `
        SELECT 
            kode_rs, kelas_faskes, kelas_rawat, ptd, klaim_kompetensi,
            SUM(jml_kasus) as kasus,
            SUM(total_tarif_inacbg) as inacbg,
            SUM(${tCol1}) as t1, SUM(${tCol2}) as t2, SUM(${tCol3}) as t3, SUM(${tCol4}) as t4,
            SUM(${tCol5}) as t5, SUM(${tCol6}) as t6, SUM(${tCol7}) as t7, SUM(${tCol8}) as t8
        FROM mv_spending_data
        WHERE dataset = $1
        GROUP BY kode_rs, kelas_faskes, kelas_rawat, ptd, klaim_kompetensi
    `;
    const resProf = await pool.query(qProf, [dbDataset]);
    console.log(`[DataGenerator] Loaded ${resProf.rows.length} RS Profile groups in ${Date.now() - t0}ms`);

    resProf.rows.forEach(row => {
        const rs_id = (row.kode_rs || 'UNKNOWN').trim();
        const k_faskes_raw = (row.kelas_faskes || '').trim().toUpperCase();
        const k_faskes = ['A', 'B', 'C', 'D'].includes(k_faskes_raw) ? k_faskes_raw : 'Lainnya';
        const kelas_rawat = (row.kelas_rawat !== null && String(row.kelas_rawat).trim() === '1') ? 'ri' : 'rj';
        const lowered_komp = (row.klaim_kompetensi || 'dasar').trim().toLowerCase();
        const ptd = (row.ptd || 'lainnya').toString().trim().toLowerCase();

        const kasus = parseFloat(row.kasus) || 0;
        const inacbg = parseFloat(row.inacbg) || 0;
        const tarifs = {};
        for(let i=1; i<=8; i++) tarifs[i] = parseFloat(row[`t${i}`]) || 0;
        for(let i=9; i<=61; i++) tarifs[i] = tarifs[8];

        if (!agg.profiles[rs_id]) {
            agg.profiles[rs_id] = {
                crosstab: { byKompetensi: {}, byLayanan: {} },
                pie: { ri: 0, rj: 0 },
                cmg_ri: {}, cmg_rj: {}, mdc_ri: {}, mdc_rj: {},
                severity_inacbg: {}, severity_idrg: {}
            };
        }
        const prof = agg.profiles[rs_id];
        prof.pie[kelas_rawat] += kasus;

        // Crosstab byKompetensi
        if (!prof.crosstab.byKompetensi[k_faskes]) prof.crosstab.byKompetensi[k_faskes] = {};
        if (!prof.crosstab.byKompetensi[k_faskes][kelas_rawat]) prof.crosstab.byKompetensi[k_faskes][kelas_rawat] = {};
        if (!prof.crosstab.byKompetensi[k_faskes][kelas_rawat][lowered_komp]) {
            prof.crosstab.byKompetensi[k_faskes][kelas_rawat][lowered_komp] = initMetric();
        }
        const mKomp = prof.crosstab.byKompetensi[k_faskes][kelas_rawat][lowered_komp];
        mKomp.kasus += kasus;
        mKomp.inacbg += inacbg;
        for(let i=1; i<=61; i++) mKomp.sim[`tarif_${i}`] += tarifs[i];

        // Crosstab byLayanan
        if (!prof.crosstab.byLayanan[ptd]) prof.crosstab.byLayanan[ptd] = { byKompetensi: {} };
        if (!prof.crosstab.byLayanan[ptd].byKompetensi[k_faskes]) prof.crosstab.byLayanan[ptd].byKompetensi[k_faskes] = {};
        if (!prof.crosstab.byLayanan[ptd].byKompetensi[k_faskes][kelas_rawat]) prof.crosstab.byLayanan[ptd].byKompetensi[k_faskes][kelas_rawat] = {};
        if (!prof.crosstab.byLayanan[ptd].byKompetensi[k_faskes][kelas_rawat][lowered_komp]) {
            prof.crosstab.byLayanan[ptd].byKompetensi[k_faskes][kelas_rawat][lowered_komp] = initMetric();
        }
        const mLay = prof.crosstab.byLayanan[ptd].byKompetensi[k_faskes][kelas_rawat][lowered_komp];
        mLay.kasus += kasus;
        mLay.inacbg += inacbg;
        for(let i=1; i<=61; i++) mLay.sim[`tarif_${i}`] += tarifs[i];
    });

    // 5. Compute regions aggregation from hospitals
    const regions = {};
    Object.values(agg.hospitals).forEach(h => {
        const p = (h.prop || 'Lainnya').trim().toUpperCase();
        if (!regions[p]) {
            regions[p] = {
                kasus: 0,
                inacbg: 0,
                sim: initSim(),
                rsCount: 0
            };
        }
        regions[p].kasus += h.kasus || 0;
        regions[p].inacbg += h.inacbg || 0;
        regions[p].rsCount += 1;
        if (h.sim) {
            for (let i = 1; i <= 61; i++) {
                regions[p].sim[`tarif_${i}`] += (h.sim[`tarif_${i}`] || 0);
            }
        }
    });

    const datasetPayload = {
        hospitals: agg.hospitals,
        rs_profiles: agg.profiles,
        distribution: agg.distribution,
        crosstab: agg.crosstab,
        regions: regions,
        inacbg_to_drg: {}
    };

    globalCache[datasetId] = datasetPayload;
    
    // Also save aliases
    if (datasetId === 'jan_des_v11_1363') {
        globalCache['jan_des_v11'] = datasetPayload;
        globalCache['dataset4_1363'] = datasetPayload;
        globalCache['dataset4'] = datasetPayload;
        globalCache['dataset1'] = datasetPayload;
    } else if (datasetId === 'jan_des_v11_1370') {
        globalCache['dataset4_1370'] = datasetPayload;
    } else if (datasetId === 'okt_jun_v3_1363') {
        globalCache['okt_jun_v3'] = datasetPayload;
        globalCache['dataset3_1363'] = datasetPayload;
        globalCache['dataset3'] = datasetPayload;
    } else if (datasetId === 'okt_jun_v3_1370') {
        globalCache['dataset3_1370'] = datasetPayload;
    }

    console.log(`[DataGenerator] Finished SQL-based aggregation for dataset ${datasetId} in ${Date.now() - t0}ms!`);
}

function getDataset(datasetId) {
    if (globalCache[datasetId]) return globalCache[datasetId];
    
    // Normalization fallback
    const is1370 = datasetId.includes('1370');
    if (datasetId.includes('jan_des') || datasetId.includes('dataset4') || datasetId.includes('dataset1')) {
        return is1370 ? (globalCache['jan_des_v11_1370'] || globalCache['jan_des_v11']) : (globalCache['jan_des_v11_1363'] || globalCache['jan_des_v11']);
    }
    if (datasetId.includes('okt_jun') || datasetId.includes('dataset3')) {
        return is1370 ? (globalCache['okt_jun_v3_1370'] || globalCache['okt_jun_v3']) : (globalCache['okt_jun_v3_1363'] || globalCache['okt_jun_v3']);
    }

    return globalCache['jan_des_v11_1363'] || Object.values(globalCache)[0];
}

module.exports = {
    loadDatasetFromDb,
    getDataset
};

