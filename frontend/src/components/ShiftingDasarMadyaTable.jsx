import React, { useState, useMemo } from 'react';
import { formatTableMiliar } from '../utils/formatters';
import DownloadExcelButton from './DownloadExcelButton';
import { exportToExcel } from '../utils/exportExcel';

const ShiftingDasarMadyaTable = ({ rsProfile, targetRsObj, simulasi, regionalServiceDemand, excludeNonKomp, activeLayananFilters = [], rsKompetensiOnline }) => {
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

      // Pengurangan: Utama & Paripurna (fixed, per-service)
      const utamaKasus = getSvcLevelData(svcName, 'utama').kasus;
      const paripurnaKasus = getSvcLevelData(svcName, 'paripurna').kasus;
      const totalKurangKasusSrc = utamaKasus + paripurnaKasus;
      const redAvgTarif = getSvcAvgTarifSim(svcName, ['utama', 'paripurna']);
      const kurangKasus = Math.round(totalKurangKasusSrc * (pctRed / 100));
      const kurangPendapatan = kurangKasus * redAvgTarif;

      // Tambahan: Dasar + Madya from regional demand
      const normSvcName = svcName.toLowerCase().trim();
      const regDemandData = regionalServiceDemand?.[normSvcName] || {};
      const regDasarCases = regDemandData['dasar']?.kasus || 0;
      const regDasarSim = regDemandData['dasar']?.sim || 0;
      const regMadyaCases = regDemandData['madya']?.kasus || 0;
      const regMadyaSim = regDemandData['madya']?.sim || 0;

      const totalRegCases = regDasarCases + regMadyaCases;
      const totalRegSim = regDasarSim + regMadyaSim;
      const avgRegTarif = totalRegCases > 0 ? (totalRegSim / totalRegCases) : 0;

      // Per-percentage rows
      const percentRows = percentRange.map(pct => {
        const tambahDasarKasus = Math.round(regDasarCases * (pct / 100));
        const tambahDasarPendapatan = tambahDasarKasus * (regDasarCases > 0 ? (regDasarSim / regDasarCases) : 0);
        const tambahMadyaKasus = Math.round(regMadyaCases * (pct / 100));
        const tambahMadyaPendapatan = tambahMadyaKasus * (regMadyaCases > 0 ? (regMadyaSim / regMadyaCases) : 0);

        const totalTambahKasus = tambahDasarKasus + tambahMadyaKasus;
        const totalTambahPendapatan = tambahDasarPendapatan + tambahMadyaPendapatan;

        const netKasus = totalTambahKasus - kurangKasus;
        const netKasusPct = eksistingKasus > 0 ? (netKasus / eksistingKasus) * 100 : 0;
        const netPendapatan = totalTambahPendapatan - kurangPendapatan;
        const totalPendapatan = eksistingInacbg + netPendapatan;
        const pctKenaikan = eksistingInacbg > 0 ? (netPendapatan / eksistingInacbg) * 100 : 0;

        return {
          pct,
          tambahDasarKasus,
          tambahDasarPendapatan,
          tambahMadyaKasus,
          tambahMadyaPendapatan,
          totalTambahKasus,
          totalTambahPendapatan,
          netKasus,
          netKasusPct,
          netPendapatan,
          totalPendapatan,
          pctKenaikan
        };
      });

      return {
        svcName,
        currentComp,
        eksistingKasus,
        eksistingInacbg,
        utamaKasus,
        paripurnaKasus,
        kurangKasus,
        kurangPendapatan,
        regDasarCases,
        regMadyaCases,
        percentRows
      };
    });
  }, [filteredServices, pctRed, percentRange, regionalServiceDemand, byKelompok, svc, simulasi]);

  // Compute aggregate TOTAL row per percentage step
  const totalByPct = useMemo(() => {
    const map = {};
    percentRange.forEach(pct => {
      map[pct] = {
        pct,
        tambahDasarKasus: 0, tambahDasarPendapatan: 0,
        tambahMadyaKasus: 0, tambahMadyaPendapatan: 0,
        totalTambahKasus: 0, totalTambahPendapatan: 0,
        kurangKasus: 0, kurangPendapatan: 0,
        netKasus: 0, netPendapatan: 0,
        eksistingInacbg: 0, totalPendapatan: 0,
        eksistingKasus: 0
      };
    });
    tableData.forEach(row => {
      row.percentRows.forEach(pr => {
        const t = map[pr.pct];
        if (!t) return;
        t.tambahDasarKasus += pr.tambahDasarKasus;
        t.tambahDasarPendapatan += pr.tambahDasarPendapatan;
        t.tambahMadyaKasus += pr.tambahMadyaKasus;
        t.tambahMadyaPendapatan += pr.tambahMadyaPendapatan;
        t.totalTambahKasus += pr.totalTambahKasus;
        t.totalTambahPendapatan += pr.totalTambahPendapatan;
        t.kurangKasus += row.kurangKasus;
        t.kurangPendapatan += row.kurangPendapatan;
        t.netKasus += pr.netKasus;
        t.netPendapatan += pr.netPendapatan;
        t.eksistingInacbg += row.eksistingInacbg;
        t.totalPendapatan += pr.totalPendapatan;
        t.eksistingKasus += row.eksistingKasus;
      });
    });
    // deduplicate pengurangan (it's per-service, not per-pct row)
    // Actually kurangKasus is added once per row × percentRows.length, fix: only add once per row
    return map;
  }, [tableData, percentRange]);

  // Recompute totals correctly (kurang is constant per service, not per pct)
  const totalRows = useMemo(() => {
    return percentRange.map(pct => {
      let tambahDasarKasus = 0, tambahDasarPendapatan = 0;
      let tambahMadyaKasus = 0, tambahMadyaPendapatan = 0;
      let totalTambahKasus = 0, totalTambahPendapatan = 0;
      let kurangKasus = 0, kurangPendapatan = 0;
      let eksistingInacbg = 0, eksistingKasus = 0;

      tableData.forEach(row => {
        const pr = row.percentRows.find(p => p.pct === pct);
        if (!pr) return;
        tambahDasarKasus += pr.tambahDasarKasus;
        tambahDasarPendapatan += pr.tambahDasarPendapatan;
        tambahMadyaKasus += pr.tambahMadyaKasus;
        tambahMadyaPendapatan += pr.tambahMadyaPendapatan;
        totalTambahKasus += pr.totalTambahKasus;
        totalTambahPendapatan += pr.totalTambahPendapatan;
        kurangKasus += row.kurangKasus;
        kurangPendapatan += row.kurangPendapatan;
        eksistingInacbg += row.eksistingInacbg;
        eksistingKasus += row.eksistingKasus;
      });

      const netKasus = totalTambahKasus - kurangKasus;
      const netKasusPct = eksistingKasus > 0 ? (netKasus / eksistingKasus) * 100 : 0;
      const netPendapatan = totalTambahPendapatan - kurangPendapatan;
      const totalPendapatan = eksistingInacbg + netPendapatan;
      const pctKenaikan = eksistingInacbg > 0 ? (netPendapatan / eksistingInacbg) * 100 : 0;

      return {
        pct, tambahDasarKasus, tambahDasarPendapatan,
        tambahMadyaKasus, tambahMadyaPendapatan,
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
      "Total Tambah (Kasus)", "Total Tambah (Rp M)",
      `Pengurangan (%)`, "Pengurangan Utama (Kasus)", "Pengurangan Paripurna (Kasus)",
      "Total Kurang (Kasus)", "Kurang Pendapatan (Rp M)",
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
          pctRow.totalTambahKasus,
          pctRow.totalTambahPendapatan / 1e9,
          index === 0 ? `${pctRed}%` : "",
          index === 0 ? row.utamaKasus : "",
          index === 0 ? row.paripurnaKasus : "",
          index === 0 ? row.kurangKasus : "",
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
      { label: "SIMULASI SHIFTING: TAMBAHAN KASUS DASAR & MADYA — PENGURANGAN KASUS UTAMA & PARIPURNA", colSpan: 21, rowSpan: 1, fill: "#0f766e" }
    ];

    await exportToExcel(headers, dataRows, `Simulasi_Shifting_DasarMadya_${(targetRsObj?.nama || 'RS').replace(/\s+/g, '_')}.xlsx`, password, groupHeaders);
  };

  return (
    <div className="card fade-in" style={{ padding: '24px', marginTop: '32px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h4 style={{ color: '#0f172a', fontWeight: 800, margin: '0 0 4px 0', fontSize: '1rem', textTransform: 'uppercase' }}>
            Simulasi Shifting: Tambahan Kasus Dasar &amp; Madya — Pengurangan Kasus Utama &amp; Paripurna
          </h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            Proyeksi penambahan kasus Dasar &amp; Madya dari demand regional dengan variasi persentase, dan pengurangan kasus Utama &amp; Paripurna eksisting RS.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569' }}>
            <span>% Pengurangan (Utama &amp; Paripurna):</span>
            <input
              type="number" min="0" max="100" value={pctRed}
              onChange={e => setPctRed(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '45px', padding: '3px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
            />
            <span>%</span>
          </div>

          <DownloadExcelButton
            customExportFn={handleDownloadExcel}
            filename={`Simulasi_Shifting_DasarMadya.xlsx`}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-container" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#0f766e', color: 'white' }}>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', minWidth: '130px' }}>Kelompok Layanan RS</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Kompetensi RS</th>
              <th colSpan="6" style={{ padding: '6px', border: '1px solid #cbd5e1', background: '#047857' }}>Tambahan Kasus Dasar &amp; Madya</th>
              <th colSpan="4" style={{ padding: '6px', border: '1px solid #cbd5e1', background: '#be123c' }}>Pengurangan Kasus Utama &amp; Paripurna</th>
              <th colSpan="3" style={{ padding: '6px', border: '1px solid #cbd5e1', background: '#0284c7' }}>Net +/- Pasca iDRG &amp; RBKP</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', background: '#475569', minWidth: '80px' }}>Pendapatan Eksisting (Rp M)</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', background: '#1e40af', minWidth: '80px' }}>Total Pendapatan Pasca iDRG (Rp M)</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', background: '#065f46', minWidth: '70px' }}>% Kenaikan thd Eksisting</th>
            </tr>
            <tr style={{ background: '#115e59', color: 'white' }}>
              {/* Tambahan */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#065f46' }}>%</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#065f46' }}>Dasar (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#065f46' }}>Dasar (Rp M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#065f46' }}>Madya (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#065f46' }}>Madya (Rp M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#047857', fontWeight: 'bold' }}>Total T (K)</th>
              {/* Pengurangan */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#9f1239' }}>%</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#9f1239' }}>Utama (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#9f1239' }}>Paripurna (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#be123c', fontWeight: 'bold' }}>Total K (Rp M)</th>
              {/* Net */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#0369a1' }}>+/- Kasus</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#0369a1' }}>% thd Total</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', background: '#0369a1' }}>+/- Pendapatan (Rp M)</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr>
                <td colSpan="16" style={{ padding: '20px', color: '#64748b' }}>Tidak ada data layanan tersedia.</td>
              </tr>
            ) : (
              tableData.map(row => {
                return row.percentRows.map((pctRow, index) => {
                  const netKasusColor = pctRow.netKasus >= 0 ? '#0f766e' : '#be123c';
                  const netPendColor = pctRow.netPendapatan >= 0 ? '#0f766e' : '#be123c';

                  return (
                    <tr
                      key={`${row.svcName}-${pctRow.pct}`}
                      style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}
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

                      {/* Tambahan Dasar & Madya */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#047857' }}>{pctRow.pct}%</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857' }}>{pctRow.tambahDasarKasus.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857' }}>{formatTableMiliar(pctRow.tambahDasarPendapatan).replace('Rp', '')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857' }}>{pctRow.tambahMadyaKasus.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857' }}>{formatTableMiliar(pctRow.tambahMadyaPendapatan).replace('Rp', '')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857', fontWeight: 'bold' }}>{pctRow.totalTambahKasus.toLocaleString('id-ID')}</td>

                      {/* Pengurangan Utama & Paripurna (fixed per service) */}
                      {index === 0 && (
                        <>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#be123c', fontWeight: 'bold' }}>{pctRed}%</td>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#be123c' }}>{row.utamaKasus.toLocaleString('id-ID')}</td>
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

            {/* TOTAL ROWS */}
            {tableData.length > 0 && totalRows.map((t, idx) => {
              const netKasusColor = t.netKasus >= 0 ? '#0f766e' : '#be123c';
              const netPendColor = t.netPendapatan >= 0 ? '#0f766e' : '#be123c';
              return (
                <tr key={`total-${t.pct}`} style={{ background: '#0f172a', color: 'white', borderTop: idx === 0 ? '3px solid #0f766e' : '1px solid #1e293b', fontWeight: 700 }}>
                  {idx === 0 && (
                    <>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #1e293b', color: '#fbbf24', fontWeight: 800, verticalAlign: 'middle', textAlign: 'left' }}>
                        TOTAL SEMUA LAYANAN
                      </td>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #1e293b', color: '#94a3b8', verticalAlign: 'middle' }}>-</td>
                    </>
                  )}
                  {/* Tambahan */}
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: '#34d399' }}>{t.pct}%</td>
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: '#34d399' }}>{t.tambahDasarKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: '#34d399' }}>{formatTableMiliar(t.tambahDasarPendapatan).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: '#34d399' }}>{t.tambahMadyaKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: '#34d399' }}>{formatTableMiliar(t.tambahMadyaPendapatan).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: '#34d399', fontWeight: 800 }}>{t.totalTambahKasus.toLocaleString('id-ID')}</td>
                  {/* Pengurangan */}
                  {idx === 0 && (
                    <>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #1e293b', color: '#f87171', verticalAlign: 'middle' }}>{pctRed}%</td>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #1e293b', color: '#f87171', verticalAlign: 'middle' }}>
                        {tableData.reduce((s, r) => s + r.utamaKasus, 0).toLocaleString('id-ID')}
                      </td>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #1e293b', color: '#f87171', verticalAlign: 'middle' }}>
                        {tableData.reduce((s, r) => s + r.paripurnaKasus, 0).toLocaleString('id-ID')}
                      </td>
                      <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #1e293b', color: '#f87171', verticalAlign: 'middle', fontWeight: 800 }}>
                        {formatTableMiliar(tableData.reduce((s, r) => s + r.kurangPendapatan, 0)).replace('Rp', '')}
                      </td>
                    </>
                  )}
                  {/* Net */}
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: netKasusColor === '#0f766e' ? '#34d399' : '#f87171', fontWeight: 800 }}>
                    {t.netKasus > 0 ? '+' : ''}{t.netKasus.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: '#e2e8f0' }}>{t.netKasusPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: netPendColor === '#0f766e' ? '#34d399' : '#f87171', fontWeight: 800 }}>
                    {t.netPendapatan > 0 ? '+' : ''}{formatTableMiliar(t.netPendapatan).replace('Rp', '')}
                  </td>
                  {/* Eksisting */}
                  {idx === 0 && (
                    <td rowSpan={totalRows.length} style={{ padding: '8px', border: '1px solid #1e293b', color: '#94a3b8', verticalAlign: 'middle' }}>
                      {formatTableMiliar(t.eksistingInacbg).replace('Rp', '')}
                    </td>
                  )}
                  {/* Total Pendapatan & % Kenaikan */}
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: '#93c5fd', fontWeight: 800 }}>{formatTableMiliar(t.totalPendapatan).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #1e293b', color: netPendColor === '#0f766e' ? '#34d399' : '#f87171', fontWeight: 800 }}>
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

export default ShiftingDasarMadyaTable;
