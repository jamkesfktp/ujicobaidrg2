import React, { useState, useMemo } from 'react';
import { formatTableMiliar } from '../utils/formatters';
import DownloadExcelButton from './DownloadExcelButton';
import { exportToExcel } from '../utils/exportExcel';

/**
 * ShiftingDasarMadyaUtamaTable
 * Simulasi Penambahan Kasus Dasar, Madya, & Utama — Faktor Pengurang Paripurna
 *
 * Tambahan: Dasar + Madya + Utama (dari demand regional)
 * Pengurang: Paripurna (eksisting RS)
 */
const ShiftingDasarMadyaUtamaTable = ({ rsProfile, targetRsObj, simulasi, regionalServiceDemand, excludeNonKomp, activeLayananFilters = [], rsKompetensiOnline }) => {
  if (!rsProfile || !targetRsObj) return null;

  const [minPct, setMinPct] = useState(5);
  const [maxPct, setMaxPct] = useState(10);
  const [pctRed, setPctRed] = useState(100);

  const svc = rsProfile.svc || {};
  const byKelompok = rsProfile.scorecard?.byKelompok || {};

  const servicesList = [
    'musculoskeletal dan jaringan lunak',
    'jantung dan pembuluh darah',
    'uro nefro',
    'paru dan pernafasan',
    'saraf/ neuroscience',
    'pencernaan dan hepatobilier',
    'endokrin, nutrisi dan metabolik',
    'ibu dan ginekologi',
    'mata',
    'neoplasma',
    'infeksi dan parasit',
    'kulit & penyakit kelamin',
    'tht',
    'gigi dan mulut',
    'jiwa',
    'neonatus',
    'hematologi',
    'rekonstruksi dan estetika',
    'rehabilitasi',
    'trauma',
    'alergi imunologi dan rheumatologi',
    'forensik',
    'luka bakar',
    'keracunan',
    'Unknown'
  ];

  // Get cases & inacbg for a specific level in a service
  const getSvcLevelData = (svcName, level) => {
    const data = svc[svcName];
    if (!data) return { kasus: 0, inacbg: 0 };
    let totalKasus = 0;
    let totalInacbg = 0;
    ['ri', 'rj'].forEach(t => {
      if (data[t] && data[t][level]) {
        totalKasus += data[t][level][0] || 0;
        totalInacbg += data[t][level][1] || 0;
      }
    });
    return { kasus: totalKasus, inacbg: totalInacbg };
  };

  // Get average simulated tariff for a set of levels
  const getSvcAvgTarifSim = (svcName, types) => {
    const data = svc[svcName];
    if (!data) return 0;
    let totalKasus = 0;
    let totalTarifSim = 0;
    ['ri', 'rj'].forEach(t => {
      if (data[t]) {
        Object.entries(data[t]).forEach(([lvl, arr]) => {
          if (types.includes(lvl.toLowerCase().trim())) {
            totalKasus += arr[0] || 0;
            totalTarifSim += arr[simulasi + 1] || 0;
          }
        });
      }
    });
    return totalKasus > 0 ? (totalTarifSim / totalKasus) : 0;
  };

  const getHospitalCompetencyForService = (svcName) => {
    const svcData = svc[svcName] || {};
    const kelompokData = byKelompok[svcName] || {};
    const sesuaiKasus = kelompokData.sesuai?.kasus || 0;



    const kodeRs = targetRsObj?.kode || targetRsObj?.value;
    if (rsKompetensiOnline && kodeRs && rsKompetensiOnline[kodeRs]) {
       const rsData = rsKompetensiOnline[kodeRs];
       const svcLowerClean = svcName.toLowerCase().replace(/\s+/g, '');
       const matchedKey = Object.keys(rsData).find(k => k.replace(/\s+/g, '') === svcLowerClean);
       if (matchedKey && rsData[matchedKey]) {
           return rsData[matchedKey];
       }
    }

    if (sesuaiKasus === 0) {
      return 'Tidak Kompeten';
    }

    const counts = { dasar: 0, madya: 0, utama: 0, paripurna: 0 };
    ['ri', 'rj'].forEach(t => {
      if (svcData[t]) {
        Object.entries(svcData[t]).forEach(([lvl, arr]) => {
          const normLvl = lvl.toLowerCase().trim();
          if (counts[normLvl] !== undefined) {
            counts[normLvl] += arr[0] || 0;
          }
        });
      }
    });

    if (counts.paripurna > 0) return 'Paripurna';
    if (counts.utama > 0) return 'Utama';
    if (counts.madya > 0) return 'Madya';
    if (counts.dasar > 0) return 'Dasar';
    return 'Tidak Kompeten';
  };

  // Filtered services list
  const filteredServices = useMemo(() => {
    return servicesList.filter(s => {
      const normKel = s.toLowerCase().trim();
      if (activeLayananFilters && activeLayananFilters.length > 0) {
        if (!activeLayananFilters.includes(normKel)) return false;
      }
      /* excludeNonKomp filter removed to ensure total matches 58k */
      return true;
    }).sort((a, b) => {
      const COMP_ORDER = { 'Paripurna': 5, 'Utama': 4, 'Madya': 3, 'Dasar': 2, 'Tidak Kompeten': 1, 'Unknown': 0 };
      
      if (a === 'Unknown' && b !== 'Unknown') return 1;
      if (b === 'Unknown' && a !== 'Unknown') return -1;
      
      const compA = getHospitalCompetencyForService(a) || 'Unknown';
      const compB = getHospitalCompetencyForService(b) || 'Unknown';
      const compScoreA = COMP_ORDER[compA] || 0;
      const compScoreB = COMP_ORDER[compB] || 0;
      if (compScoreA !== compScoreB) return compScoreB - compScoreA;

      const kelA = byKelompok[a] || {};
      const kasusA = (kelA.sesuai?.kasus || 0) + (kelA.loss?.kasus || 0);
      const kelB = byKelompok[b] || {};
      const kasusB = (kelB.sesuai?.kasus || 0) + (kelB.loss?.kasus || 0);
      if (kasusA !== kasusB) return kasusB - kasusA;

      const inacbgA = (kelA.sesuai?.inacbg || 0) + (kelA.loss?.inacbg || 0);
      const inacbgB = (kelB.sesuai?.inacbg || 0) + (kelB.loss?.inacbg || 0);
      return inacbgB - inacbgA;
    });
  }, [servicesList, excludeNonKomp, targetRsObj, rsProfile, activeLayananFilters]);

  // Generate percentage range
  const percentRange = useMemo(() => {
    const range = [];
    const min = Math.min(minPct, maxPct);
    const max = Math.max(minPct, maxPct);
    for (let i = min; i <= max; i++) {
      range.push(i);
    }
    return range.length > 0 ? range : [5];
  }, [minPct, maxPct]);

  // Process table data
  const tableData = useMemo(() => {
    return filteredServices.map(svcName => {
      const currentComp = getHospitalCompetencyForService(svcName);
      const kelompokData = byKelompok[svcName] || {};
      const eksistingKasus = (kelompokData.sesuai?.kasus || 0) + (kelompokData.loss?.kasus || 0);
      const eksistingInacbg = (kelompokData.sesuai?.inacbg || 0) + (kelompokData.loss?.inacbg || 0);

      // Pengurangan: HANYA Paripurna (faktor pengurang)
      const paripurnaKasus = getSvcLevelData(svcName, 'paripurna').kasus;
      const redAvgTarif = getSvcAvgTarifSim(svcName, ['paripurna']);
      const kurangKasus = Math.round(paripurnaKasus * (pctRed / 100));
      const kurangPendapatan = kurangKasus * redAvgTarif;

      // Tambahan: Dasar + Madya + Utama dari demand regional
      const normSvcName = svcName.toLowerCase().trim();
      const regDemandData = regionalServiceDemand?.[normSvcName] || {};

      const regDasarCases = regDemandData['dasar']?.kasus || 0;
      const regDasarSim   = regDemandData['dasar']?.sim   || 0;
      const regMadyaCases = regDemandData['madya']?.kasus || 0;
      const regMadyaSim   = regDemandData['madya']?.sim   || 0;
      const regUtamaCases = regDemandData['utama']?.kasus || 0;
      const regUtamaSim   = regDemandData['utama']?.sim   || 0;

      const avgDasarTarif = regDasarCases > 0 ? (regDasarSim / regDasarCases) : 0;
      const avgMadyaTarif = regMadyaCases > 0 ? (regMadyaSim / regMadyaCases) : 0;
      const avgUtamaTarif = regUtamaCases > 0 ? (regUtamaSim / regUtamaCases) : 0;

      // Per-percentage rows
      const percentRows = percentRange.map(pct => {
        const tambahDasarKasus      = Math.round(regDasarCases * (pct / 100));
        const tambahDasarPendapatan = tambahDasarKasus * avgDasarTarif;
        const tambahMadyaKasus      = Math.round(regMadyaCases * (pct / 100));
        const tambahMadyaPendapatan = tambahMadyaKasus * avgMadyaTarif;
        const tambahUtamaKasus      = Math.round(regUtamaCases * (pct / 100));
        const tambahUtamaPendapatan = tambahUtamaKasus * avgUtamaTarif;

        const totalTambahKasus      = tambahDasarKasus + tambahMadyaKasus + tambahUtamaKasus;
        const totalTambahPendapatan = tambahDasarPendapatan + tambahMadyaPendapatan + tambahUtamaPendapatan;

        const netKasus      = totalTambahKasus - kurangKasus;
        const netKasusPct   = eksistingKasus > 0 ? (netKasus / eksistingKasus) * 100 : 0;
        const netPendapatan = totalTambahPendapatan - kurangPendapatan;
        const totalPendapatan = eksistingInacbg + netPendapatan;
        const pctKenaikan   = eksistingInacbg > 0 ? (netPendapatan / eksistingInacbg) * 100 : 0;

        return {
          pct,
          tambahDasarKasus, tambahDasarPendapatan,
          tambahMadyaKasus, tambahMadyaPendapatan,
          tambahUtamaKasus, tambahUtamaPendapatan,
          totalTambahKasus, totalTambahPendapatan,
          netKasus, netKasusPct,
          netPendapatan, totalPendapatan, pctKenaikan
        };
      });

      return {
        svcName,
        currentComp,
        eksistingKasus,
        eksistingInacbg,
        paripurnaKasus,
        kurangKasus,
        kurangPendapatan,
        regDasarCases,
        regMadyaCases,
        regUtamaCases,
        percentRows
      };
    });
  }, [filteredServices, pctRed, percentRange, regionalServiceDemand, byKelompok, svc, simulasi]);

  // Correct aggregate totals
  const totalRows = useMemo(() => {
    return percentRange.map(pct => {
      let tambahDasarKasus = 0, tambahDasarPendapatan = 0;
      let tambahMadyaKasus = 0, tambahMadyaPendapatan = 0;
      let tambahUtamaKasus = 0, tambahUtamaPendapatan = 0;
      let totalTambahKasus = 0, totalTambahPendapatan = 0;
      let kurangKasus = 0, kurangPendapatan = 0;
      let eksistingInacbg = 0, eksistingKasus = 0;

      tableData.forEach(row => {
        const pr = row.percentRows.find(p => p.pct === pct);
        if (!pr) return;
        tambahDasarKasus       += pr.tambahDasarKasus;
        tambahDasarPendapatan  += pr.tambahDasarPendapatan;
        tambahMadyaKasus       += pr.tambahMadyaKasus;
        tambahMadyaPendapatan  += pr.tambahMadyaPendapatan;
        tambahUtamaKasus       += pr.tambahUtamaKasus;
        tambahUtamaPendapatan  += pr.tambahUtamaPendapatan;
        totalTambahKasus       += pr.totalTambahKasus;
        totalTambahPendapatan  += pr.totalTambahPendapatan;
        kurangKasus            += row.kurangKasus;
        kurangPendapatan       += row.kurangPendapatan;
        eksistingInacbg        += row.eksistingInacbg;
        eksistingKasus         += row.eksistingKasus;
      });

      const netKasus      = totalTambahKasus - kurangKasus;
      const netKasusPct   = eksistingKasus > 0 ? (netKasus / eksistingKasus) * 100 : 0;
      const netPendapatan = totalTambahPendapatan - kurangPendapatan;
      const totalPendapatan = eksistingInacbg + netPendapatan;
      const pctKenaikan   = eksistingInacbg > 0 ? (netPendapatan / eksistingInacbg) * 100 : 0;

      return {
        pct,
        tambahDasarKasus, tambahDasarPendapatan,
        tambahMadyaKasus, tambahMadyaPendapatan,
        tambahUtamaKasus, tambahUtamaPendapatan,
        totalTambahKasus, totalTambahPendapatan,
        kurangKasus, kurangPendapatan,
        netKasus, netKasusPct, netPendapatan,
        eksistingInacbg, totalPendapatan, pctKenaikan
      };
    });
  }, [tableData, percentRange]);

  // Excel download
  const handleDownloadExcel = async (password) => {
    const headers = [
      "NO", "Kelompok Layanan RS", "Kompetensi RS",
      "% Tambahan",
      "Tambahan Dasar (Kasus)", "Tambahan Dasar (Rp M)",
      "Tambahan Madya (Kasus)", "Tambahan Madya (Rp M)",
      "Tambahan Utama (Kasus)", "Tambahan Utama (Rp M)",
      "Total Tambah (Kasus)", "Total Tambah (Rp M)",
      `Pengurangan (%)`, "Pengurangan Paripurna (Kasus)", "Kurang Pendapatan (Rp M)",
      "+/- Kasus", "% thd Eksisting", "+/- Pendapatan (Rp M)",
      "Pendapatan Eksisting (Rp M)", "Total Pendapatan Pasca iDRG (Rp M)", "% Kenaikan"
    ];

    const dataRows = [];
    let no = 1;
    tableData.forEach(row => {
      row.percentRows.forEach((pctRow, index) => {
        dataRows.push([
          index === 0 ? no : "",
          index === 0 ? row.svcName : "",
          index === 0 ? row.currentComp : "",
          `${pctRow.pct}%`,
          pctRow.tambahDasarKasus,
          pctRow.tambahDasarPendapatan / 1e9,
          pctRow.tambahMadyaKasus,
          pctRow.tambahMadyaPendapatan / 1e9,
          pctRow.tambahUtamaKasus,
          pctRow.tambahUtamaPendapatan / 1e9,
          pctRow.totalTambahKasus,
          pctRow.totalTambahPendapatan / 1e9,
          index === 0 ? `${pctRed}%` : "",
          index === 0 ? row.paripurnaKasus : "",
          index === 0 ? row.kurangPendapatan / 1e9 : "",
          pctRow.netKasus,
          pctRow.netKasusPct / 100,
          pctRow.netPendapatan / 1e9,
          index === 0 ? row.eksistingInacbg / 1e9 : "",
          pctRow.totalPendapatan / 1e9,
          pctRow.pctKenaikan / 100
        ]);
      });
      no++;
    });

    const groupHeaders = [
      { label: "SIMULASI SHIFTING: TAMBAHAN KASUS DASAR, MADYA & UTAMA — FAKTOR PENGURANG PARIPURNA", colSpan: 21, rowSpan: 1, fill: "#7c3aed" }
    ];

    await exportToExcel(headers, dataRows, `Simulasi_Shifting_DasarMadyaUtama_${(targetRsObj?.nama || 'RS').replace(/\s+/g, '_')}.xlsx`, password, groupHeaders);
  };

  // ── Warna tema: ungu/violet untuk membedakan dari tabel hijau ──
  const clrHeader   = '#4c1d95'; // violet-900
  const clrTambah   = '#5b21b6'; // violet-800
  const clrTambahSub= '#6d28d9'; // violet-700
  const clrKurang   = '#be123c'; // rose-700 (sama seperti tabel sebelumnya)
  const clrKurangSub= '#9f1239';
  const clrNet      = '#0369a1'; // sky-700
  const clrTotal    = '#1e40af';
  const clrEksisting= '#475569';
  const clrKenaikan = '#065f46';

  return (
    <div className="card fade-in" style={{ padding: '24px', marginTop: '32px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h4 style={{ color: '#0f172a', fontWeight: 800, margin: '0 0 4px 0', fontSize: '1rem', textTransform: 'uppercase' }}>
            Simulasi Shifting: Tambahan Kasus Dasar, Madya &amp; Utama — Faktor Pengurang Paripurna
          </h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            Proyeksi penambahan kasus Dasar, Madya &amp; Utama dari demand regional dengan variasi persentase, dan pengurangan kasus Paripurna eksisting RS.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* % Tambahan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569' }}>
            <span>% Tambahan:</span>
            <input
              type="number" min="0" max="100" value={minPct}
              onChange={e => setMinPct(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '45px', padding: '3px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
            />
            <span>s/d</span>
            <input
              type="number" min="0" max="100" value={maxPct}
              onChange={e => setMaxPct(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '45px', padding: '3px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
            />
          </div>

          {/* % Pengurangan Paripurna */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569' }}>
            <span>% Pengurangan (Paripurna):</span>
            <input
              type="number" min="0" max="100" value={pctRed}
              onChange={e => setPctRed(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '45px', padding: '3px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
            />
            <span>%</span>
          </div>

          <DownloadExcelButton
            customExportFn={handleDownloadExcel}
            filename={`Simulasi_Shifting_DasarMadyaUtama.xlsx`}
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-container" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: clrHeader, color: 'white' }}>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', minWidth: '130px' }}>Kelompok Layanan RS</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Kompetensi RS</th>
              {/* Tambahan — 8 sub-cols */}
              <th colSpan="8" style={{ padding: '6px', border: '1px solid #cbd5e1', background: clrTambah }}>Tambahan Kasus Dasar, Madya &amp; Utama</th>
              {/* Pengurangan Paripurna — 3 sub-cols */}
              <th colSpan="3" style={{ padding: '6px', border: '1px solid #cbd5e1', background: clrKurang }}>Pengurangan Kasus Paripurna</th>
              {/* Net — 3 sub-cols */}
              <th colSpan="3" style={{ padding: '6px', border: '1px solid #cbd5e1', background: clrNet }}>Net +/- Pasca iDRG &amp; RBKP</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', background: clrEksisting, minWidth: '80px' }}>Pendapatan Eksisting (Rp M)</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', background: clrTotal, minWidth: '80px' }}>Total Pendapatan Pasca iDRG (Rp M)</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', background: clrKenaikan, minWidth: '70px' }}>% Kenaikan thd Eksisting</th>
            </tr>
            <tr style={{ background: clrTambahSub, color: 'white' }}>
              {/* Tambahan */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrTambahSub }}>%</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrTambahSub }}>Dasar (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrTambahSub }}>Dasar (Rp M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrTambahSub }}>Madya (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrTambahSub }}>Madya (Rp M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrTambahSub }}>Utama (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrTambahSub }}>Utama (Rp M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrTambah, fontWeight: 'bold' }}>Total T (K)</th>
              {/* Pengurangan */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrKurangSub }}>%</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrKurangSub }}>Paripurna (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: clrKurang, fontWeight: 'bold' }}>Total K (Rp M)</th>
              {/* Net */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#0369a1' }}>+/- Kasus</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#0369a1' }}>% thd Total</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#0369a1' }}>+/- Pendapatan (Rp M)</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr>
                <td colSpan="18" style={{ padding: '20px', color: '#64748b' }}>Tidak ada data layanan tersedia.</td>
              </tr>
            ) : (
              tableData.map(row => {
                return row.percentRows.map((pctRow, index) => {
                  const netKasusColor = pctRow.netKasus >= 0 ? '#0f766e' : '#be123c';
                  const netPendColor  = pctRow.netPendapatan >= 0 ? '#0f766e' : '#be123c';

                  return (
                    <tr
                      key={`${row.svcName}-${pctRow.pct}`}
                      style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#ffffff' : '#f5f3ff' }}
                    >
                      {index === 0 && (
                        <>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'capitalize', textAlign: 'left', verticalAlign: 'middle' }}>
                            {row.svcName}
                          </td>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 600, verticalAlign: 'middle' }}>
                            {row.currentComp}
                          </td>
                        </>
                      )}

                      {/* % Tambahan */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#7c3aed' }}>{pctRow.pct}%</td>
                      {/* Dasar */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#6d28d9' }}>{pctRow.tambahDasarKasus.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#6d28d9' }}>{formatTableMiliar(pctRow.tambahDasarPendapatan).replace('Rp', '')}</td>
                      {/* Madya */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#7c3aed' }}>{pctRow.tambahMadyaKasus.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#7c3aed' }}>{formatTableMiliar(pctRow.tambahMadyaPendapatan).replace('Rp', '')}</td>
                      {/* Utama */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#8b5cf6' }}>{pctRow.tambahUtamaKasus.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#8b5cf6' }}>{formatTableMiliar(pctRow.tambahUtamaPendapatan).replace('Rp', '')}</td>
                      {/* Total Tambah */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#4c1d95', fontWeight: 'bold' }}>{pctRow.totalTambahKasus.toLocaleString('id-ID')}</td>

                      {/* Pengurangan Paripurna (fixed per service) */}
                      {index === 0 && (
                        <>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#be123c', fontWeight: 'bold' }}>{pctRed}%</td>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#be123c' }}>{row.paripurnaKasus.toLocaleString('id-ID')}</td>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#be123c', fontWeight: 'bold' }}>{formatTableMiliar(row.kurangPendapatan).replace('Rp', '')}</td>
                        </>
                      )}

                      {/* Net */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: netKasusColor, fontWeight: 700 }}>
                        {pctRow.netKasus > 0 ? '+' : ''}{pctRow.netKasus.toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>
                        {pctRow.netKasusPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: netPendColor, fontWeight: 700 }}>
                        {pctRow.netPendapatan > 0 ? '+' : ''}{formatTableMiliar(pctRow.netPendapatan).replace('Rp', '')}
                      </td>

                      {/* Pendapatan Eksisting */}
                      {index === 0 && (
                        <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#475569' }}>
                          {formatTableMiliar(row.eksistingInacbg).replace('Rp', '')}
                        </td>
                      )}

                      {/* Total Pendapatan & % Kenaikan */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#1e40af' }}>{formatTableMiliar(pctRow.totalPendapatan).replace('Rp', '')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: netPendColor, fontWeight: 700 }}>
                        {pctRow.pctKenaikan > 0 ? '+' : ''}{pctRow.pctKenaikan.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                      </td>
                    </tr>
                  );
                });
              })
            )}

            {/* ── TOTAL ROWS ── */}
            {tableData.length > 0 && totalRows.map((t, idx) => {
              const netKasusColor = t.netKasus >= 0 ? '#34d399' : '#f87171';
              const netPendColor  = t.netPendapatan >= 0 ? '#34d399' : '#f87171';
              return (
                <tr key={`total-${t.pct}`} style={{ background: '#1e1b4b', color: 'white', borderTop: idx === 0 ? '3px solid #7c3aed' : '1px solid #312e81', fontWeight: 700 }}>
                  {idx === 0 && (
                    <>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #312e81', color: '#fbbf24', fontWeight: 800, verticalAlign: 'middle', textAlign: 'left' }}>
                        TOTAL SEMUA LAYANAN
                      </td>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #312e81', color: '#94a3b8', verticalAlign: 'middle' }}>-</td>
                    </>
                  )}
                  {/* Tambahan */}
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#c4b5fd' }}>{t.pct}%</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#c4b5fd' }}>{t.tambahDasarKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#c4b5fd' }}>{formatTableMiliar(t.tambahDasarPendapatan).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#c4b5fd' }}>{t.tambahMadyaKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#c4b5fd' }}>{formatTableMiliar(t.tambahMadyaPendapatan).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#ddd6fe' }}>{t.tambahUtamaKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#ddd6fe' }}>{formatTableMiliar(t.tambahUtamaPendapatan).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#a78bfa', fontWeight: 800 }}>{t.totalTambahKasus.toLocaleString('id-ID')}</td>
                  {/* Pengurangan */}
                  {idx === 0 && (
                    <>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #312e81', color: '#f87171', verticalAlign: 'middle' }}>{pctRed}%</td>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #312e81', color: '#f87171', verticalAlign: 'middle' }}>
                        {tableData.reduce((s, r) => s + r.paripurnaKasus, 0).toLocaleString('id-ID')}
                      </td>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #312e81', color: '#f87171', verticalAlign: 'middle', fontWeight: 800 }}>
                        {formatTableMiliar(tableData.reduce((s, r) => s + r.kurangPendapatan, 0)).replace('Rp', '')}
                      </td>
                    </>
                  )}
                  {/* Net */}
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: netKasusColor, fontWeight: 800 }}>
                    {t.netKasus > 0 ? '+' : ''}{t.netKasus.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#e2e8f0' }}>{t.netKasusPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: netPendColor, fontWeight: 800 }}>
                    {t.netPendapatan > 0 ? '+' : ''}{formatTableMiliar(t.netPendapatan).replace('Rp', '')}
                  </td>
                  {/* Eksisting */}
                  {idx === 0 && (
                    <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #312e81', color: '#94a3b8', verticalAlign: 'middle' }}>
                      {formatTableMiliar(t.eksistingInacbg).replace('Rp', '')}
                    </td>
                  )}
                  {/* Total Pendapatan & % Kenaikan */}
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: '#93c5fd', fontWeight: 800 }}>{formatTableMiliar(t.totalPendapatan).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #312e81', color: netPendColor, fontWeight: 800 }}>
                    {t.pctKenaikan > 0 ? '+' : ''}{t.pctKenaikan.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShiftingDasarMadyaUtamaTable;
