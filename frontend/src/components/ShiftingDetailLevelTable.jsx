import React, { useState, useMemo } from 'react';
import { formatTableMiliar } from '../utils/formatters';
import DownloadExcelButton from './DownloadExcelButton';
import { exportToExcel } from '../utils/exportExcel';

const JABODETABEK_KABS = [
  'KOTA JAKARTA PUSAT', 'KOTA JAKARTA UTARA', 'KOTA JAKARTA BARAT', 'KOTA JAKARTA SELATAN', 'KOTA JAKARTA TIMUR',
  'BOGOR', 'KOTA BOGOR', 'DEPOK', 'KOTA DEPOK', 'TANGERANG', 'KOTA TANGERANG', 'KOTA TANGERANG SELATAN', 'BEKASI', 'KOTA BEKASI'
];

const ShiftingDetailLevelTable = ({ rsProfile, targetRsObj, simulasi, regionalServiceDemand, excludeNonKomp, activeLayananFilters = [], rsKompetensiOnline }) => {
  if (!rsProfile || !targetRsObj) return null;

  const [selectedLevel, setSelectedLevel] = useState('Utama');
  const [minPct, setMinPct] = useState(5);
  const [maxPct, setMaxPct] = useState(10);
  const [pctRed, setPctRed] = useState(100);

  const simulasiKey = `tarif_${simulasi}`;
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

  // Helper functions
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

  const isJabo = (kab, prop) => {
    const kabUpper = (kab || '').toUpperCase();
    const propUpper = (prop || '').toUpperCase();
    return JABODETABEK_KABS.some(k => kabUpper.includes(k) || kabUpper === k) || propUpper === 'DKI JAKARTA';
  };

  const filteredServices = useMemo(() => {
    return servicesList.filter(s => {
      const normKel = s.toLowerCase().trim();
      if (activeLayananFilters && activeLayananFilters.length > 0) {
        if (!activeLayananFilters.includes(normKel)) return false;
      }
      
      const currentComp = getHospitalCompetencyForService(s);
      
      /* excludeNonKomp filter removed to ensure total matches 58k */
      
      // Show only services matching selected level
      if (selectedLevel && selectedLevel !== 'ALL') {
        const isCombo = selectedLevel.toLowerCase() === 'utama & paripurna';
        if (isCombo) {
          if (!['utama', 'paripurna'].includes(currentComp.toLowerCase())) return false;
        } else {
          if (currentComp.toLowerCase() !== selectedLevel.toLowerCase()) return false;
        }
      }

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
  }, [servicesList, excludeNonKomp, selectedLevel, targetRsObj, rsProfile, activeLayananFilters]);

  // Determine reduction levels based on selected level
  const reductionLevels = useMemo(() => {
    const lvl = selectedLevel.toLowerCase();
    let levels = [];
    let label = '';
    
    if (lvl === 'dasar') {
      levels = ['madya', 'utama', 'paripurna'];
      label = 'Madya, Utama & Paripurna';
    } else if (lvl === 'madya') {
      levels = ['dasar', 'utama', 'paripurna'];
      label = 'Dasar, Utama & Paripurna';
    } else if (lvl === 'utama') {
      levels = ['dasar', 'madya', 'paripurna'];
      label = 'Dasar, Madya & Paripurna';
    } else if (lvl === 'paripurna') {
      levels = ['dasar', 'madya', 'utama'];
      label = 'Dasar, Madya & Utama';
    } else if (lvl === 'utama & paripurna') {
      levels = ['dasar', 'madya'];
      label = 'Dasar & Madya';
    }
    
    return { levels, label };
  }, [selectedLevel]);

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

  // Process data rows
  const tableData = useMemo(() => {
    return filteredServices.map(svcName => {
      const currentComp = getHospitalCompetencyForService(svcName);
      const kelompokData = byKelompok[svcName] || {};
      const eksistingKasus = (kelompokData.sesuai?.kasus || 0) + (kelompokData.loss?.kasus || 0);
      const eksistingInacbg = (kelompokData.sesuai?.inacbg || 0) + (kelompokData.loss?.inacbg || 0);

      // Reductions (spans across percent rows)
      let eksRedCases = 0;
      reductionLevels.levels.forEach(lvl => {
        eksRedCases += getSvcLevelData(svcName, lvl).kasus;
      });
      const redAvgTarif = getSvcAvgTarifSim(svcName, reductionLevels.levels);
      const kurangKasus = Math.round(eksRedCases * (pctRed / 100));
      const kurangPendapatan = kurangKasus * redAvgTarif;

      // Regional demand - support combined level (Utama & Paripurna)
      const normSvcName = svcName.toLowerCase().trim();
      const regDemandData = regionalServiceDemand?.[normSvcName] || {};
      const isCombo = selectedLevel.toLowerCase() === 'utama & paripurna';
      let regLvlCases, regLvlSim;
      if (isCombo) {
        const utama = regDemandData['utama'] || { kasus: 0, sim: 0 };
        const paripurna = regDemandData['paripurna'] || { kasus: 0, sim: 0 };
        regLvlCases = (utama.kasus || 0) + (paripurna.kasus || 0);
        regLvlSim = (utama.sim || 0) + (paripurna.sim || 0);
      } else {
        regLvlCases = regDemandData[selectedLevel.toLowerCase()]?.kasus || 0;
        regLvlSim = regDemandData[selectedLevel.toLowerCase()]?.sim || 0;
      }

      // Map through each percent row
      const percentRows = percentRange.map(pct => {
        // Only add regional demand if current competency matches selected level(s)
        const isComboCheck = selectedLevel.toLowerCase() === 'utama & paripurna';
        const isCompetent = isComboCheck
          ? ['utama', 'paripurna'].includes(currentComp.toLowerCase())
          : currentComp.toLowerCase() === selectedLevel.toLowerCase();
        const effectiveRegCases = isCompetent ? regLvlCases : 0;
        const effectiveRegSim = isCompetent ? regLvlSim : 0;

        const tambahKasus = Math.round(effectiveRegCases * (pct / 100));
        const tambahPendapatan = tambahKasus * (effectiveRegCases > 0 ? (effectiveRegSim / effectiveRegCases) : 0);

        const netKasus = tambahKasus - kurangKasus;
        const netKasusPct = eksistingKasus > 0 ? (netKasus / eksistingKasus) * 100 : 0;
        
        // Net Pendapatan is the result of what we gain minus what we lose
        const netPendapatan = tambahPendapatan - kurangPendapatan;
        const totalPendapatan = eksistingInacbg + netPendapatan;
        const pctKenaikan = eksistingInacbg > 0 ? (netPendapatan / eksistingInacbg) * 100 : 0;

        return {
          pct,
          tambahKasus,
          tambahPendapatan,
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
        kurangKasus,
        kurangPendapatan,
        percentRows
      };
    });
  }, [filteredServices, selectedLevel, reductionLevels, pctRed, percentRange, regionalServiceDemand, byKelompok, simulasiKey]);

  // Excel exporter
  const handleDownloadExcel = async (password) => {
    const headers = [
      "NO", "Kelompok Layanan RS", "Kompetensi RS", "Persentase (%)", "Jumlah Kasus Tambahan", "Tambahan Pendapatan (Rp M)",
      `Pengurangan (%)`, "Jumlah Kasus Pengurangan", "Pengurangan Pendapatan (Rp M)",
      "+/- Jumlah Kasus", "% thd total kasus eksisting", "+/- Pendapatan (Rp M)",
      "Pendapatan Eksisting (Rp M)", "Total Pendapatan Pasca iDRG & RBKP (Rp M)", "% Kenaikan thd Eksisting"
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
          pctRow.tambahKasus,
          pctRow.tambahPendapatan / 1000000000,
          index === 0 ? `${pctRed}%` : "",
          index === 0 ? row.kurangKasus : "",
          index === 0 ? row.kurangPendapatan / 1000000000 : "",
          pctRow.netKasus,
          pctRow.netKasusPct / 100,
          pctRow.netPendapatan / 1000000000,
          index === 0 ? row.eksistingInacbg / 1000000000 : "",
          pctRow.totalPendapatan / 1000000000,
          pctRow.pctKenaikan / 100
        ]);
      });
      no++;
    });

    const options = {
      sheetName: `Detail Shifting ${selectedLevel}`,
      groupHeaders: [
        { label: `DETAIL SHIFTING LEVEL ${selectedLevel.toUpperCase()}`, colSpan: 15, rowSpan: 1, fill: "#0f766e" }
      ]
    };

    exportToExcel(headers, dataRows, `Potensi_Shifting_Detail_${selectedLevel}.xlsx`, "", options.groupHeaders);
  };

  return (
    <div className="card fade-in" style={{ padding: '24px', marginTop: '32px', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h4 style={{ color: '#0f172a', fontWeight: 800, margin: '0 0 4px 0', fontSize: '1rem', textTransform: 'uppercase' }}>
            Potensi Shifting Detail Kompetensi Layanan {selectedLevel}
          </h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            Simulasi detail step-by-step dengan variasi persentase tambahan kasus regional.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select 
            className="styled-select" 
            value={selectedLevel} 
            onChange={(e) => setSelectedLevel(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '0.75rem', height: '34px' }}
          >
            <option value="Dasar">Dasar</option>
            <option value="Madya">Madya</option>
            <option value="Utama">Utama</option>
            <option value="Paripurna">Paripurna</option>
            <option value="Utama & Paripurna">Utama &amp; Paripurna (Gabungan)</option>
          </select>

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
            <span>% Pengurangan:</span>
            <input 
              type="number" min="0" max="100" value={pctRed} 
              onChange={e => setPctRed(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '45px', padding: '3px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }}
            />
            <span>%</span>
          </div>

          <DownloadExcelButton 
            customExportFn={handleDownloadExcel} 
            filename={`Potensi_Shifting_Detail_${selectedLevel}.xlsx`} 
          />
        </div>
      </div>

      <div className="table-container" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#0f766e', color: 'white' }}>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Layanan</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Kompetensi RS</th>
              <th colSpan="3" style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Tambahan Kasus {selectedLevel}</th>
              <th colSpan="3" style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Pengurangan Kasus {reductionLevels.label}</th>
              <th colSpan="3" style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Net +/- Pasca iDRG & RBKP</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Pendapatan Eksisting (Rp M)</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1' }}>Total Pendapatan Pasca iDRG (Rp M)</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1' }}>% Kenaikan thd Eksisting</th>
            </tr>
            <tr style={{ background: '#115e59', color: 'white' }}>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>%</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>Kasus</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>Pendapatan (Rp M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>%</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>Kasus</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>Pendapatan (Rp M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>Kasus</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>%</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1' }}>Pendapatan (Rp M)</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr>
                <td colSpan="15" style={{ padding: '20px', color: '#64748b' }}>Tidak ada layanan RS terpilih dengan kompetensi {selectedLevel}.</td>
              </tr>
            ) : (
              tableData.map(row => {
                return row.percentRows.map((pctRow, index) => {
                  const netKasusColor = pctRow.netKasus >= 0 ? '#0f766e' : '#be123c';
                  const netPendColor = pctRow.netPendapatan >= 0 ? '#0f766e' : '#be123c';

                  return (
                    <tr key={`${row.svcName}-${pctRow.pct}`} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      {index === 0 && (
                        <>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'capitalize', textAlign: 'left', minWidth: '130px', verticalAlign: 'middle' }}>
                            {row.svcName}
                          </td>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 600, verticalAlign: 'middle' }}>
                            {row.currentComp}
                          </td>
                        </>
                      )}
                      
                      {/* Tambahan */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{pctRow.pct}%</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857' }}>{pctRow.tambahKasus.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857' }}>{formatTableMiliar(pctRow.tambahPendapatan).replace('Rp', '')}</td>

                      {/* Pengurangan */}
                      {index === 0 && (
                        <>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#be123c', fontWeight: 'bold' }}>{pctRed}%</td>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#be123c' }}>{row.kurangKasus.toLocaleString('id-ID')}</td>
                          <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#be123c' }}>{formatTableMiliar(row.kurangPendapatan).replace('Rp', '')}</td>
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

                      {/* Eksisting */}
                      {index === 0 && (
                        <td rowSpan={row.percentRows.length} style={{ padding: '8px', border: '1px solid #cbd5e1', verticalAlign: 'middle', color: '#475569' }}>
                          {formatTableMiliar(row.eksistingInacbg).replace('Rp', '')}
                        </td>
                      )}

                      {/* Total */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{formatTableMiliar(pctRow.totalPendapatan).replace('Rp', '')}</td>
                      
                      {/* % Kenaikan */}
                      <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: netPendColor, fontWeight: 700 }}>
                        {pctRow.pctKenaikan > 0 ? '+' : ''}{pctRow.pctKenaikan.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                      </td>
                    </tr>
                  );
                });
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShiftingDetailLevelTable;
