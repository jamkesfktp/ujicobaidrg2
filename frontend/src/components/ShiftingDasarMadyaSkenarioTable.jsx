import React, { useState, useMemo } from 'react';
import { formatTableMiliar } from '../utils/formatters';
import { Download, Copy, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * ShiftingDasarMadyaSkenarioTable
 * Format mirip SkenarioShiftingTable tapi dengan:
 *   - Tambahan Kasus Dasar & Madya (dari demand regional)
 *   - Pengurangan Kasus Utama & Paripurna (dari eksisting RS)
 */
import { exportToExcel } from '../utils/exportExcel';
const ShiftingDasarMadyaSkenarioTable = ({
  rsProfile,
  targetRsObj,
  simulasi,
  regionalServiceDemand,
  excludeNonKomp,
  activeLayananFilters = [],
  onExportData,
  rsKompetensiOnline
}) => {
  if (!rsProfile || !targetRsObj) return null;

  const [skenarioList, setSkenarioList] = useState([
    { label: 'Skenario 1', pctTambah: 100, pctKurang: 100 },
    { label: 'Skenario 2', pctTambah: 75,  pctKurang: 75  },
    { label: 'Skenario 3', pctTambah: 50,  pctKurang: 50  },
    { label: 'Skenario 4', pctTambah: 25,  pctKurang: 25  },
    { label: 'Skenario 5', pctTambah: 5,   pctKurang: 100 },
  ]);
  const [copied, setCopied] = useState(false);

  const svc = rsProfile.svc || {};
  const byKelompok = rsProfile.scorecard?.byKelompok || {};

  const servicesList = [
    'musculoskeletal dan jaringan lunak', 'jantung dan pembuluh darah', 'uro nefro',
    'paru dan pernafasan', 'saraf/ neuroscience', 'pencernaan dan hepatobilier',
    'endokrin, nutrisi dan metabolik', 'ibu dan ginekologi', 'mata', 'neoplasma',
    'infeksi dan parasit', 'kulit & penyakit kelamin', 'tht', 'gigi dan mulut',
    'jiwa', 'neonatus', 'hematologi', 'rekonstruksi dan estetika', 'rehabilitasi',
    'trauma', 'alergi imunologi dan rheumatologi', 'forensik', 'luka bakar',
    'keracunan', 'Unknown'
  ];

  const getSvcLevelData = (svcName, level) => {
    const data = svc[svcName];
    if (!data) return { kasus: 0, inacbg: 0 };
    let totalKasus = 0; let totalInacbg = 0;
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
    let totalKasus = 0; let totalTarifSim = 0;
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

  const getHospComp = (svcName) => {
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

  // Filtered list
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
      
      const compA = getHospComp(a) || 'Unknown';
      const compB = getHospComp(b) || 'Unknown';
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

  // Pre-compute totals per service that are skenario-independent
  const serviceBaselines = useMemo(() => {
    let totalPotensiTambahKasus = 0;
    let totalPotensiTambahPend = 0;
    let totalPotensiKurangKasus = 0;
    let totalPotensiKurangPend = 0;
    let totalEksistingInacbg = 0;
    let totalEksistingKasus = 0;
    let rawDetails = [];

    filteredServices.forEach((svcName, index) => {
      const kelompokData = byKelompok[svcName] || {};
      const eksistingInacbg = (kelompokData.sesuai?.inacbg || 0) + (kelompokData.loss?.inacbg || 0);
      const eksistingKasus = (kelompokData.sesuai?.kasus || 0) + (kelompokData.loss?.kasus || 0);

      // Tambahan: Dasar + Madya regional
      const normSvcName = svcName.toLowerCase().trim();
      const reg = regionalServiceDemand?.[normSvcName] || {};
      const regDasarCases = reg['dasar']?.kasus || 0;
      const regDasarSim = reg['dasar']?.sim || 0;
      const regMadyaCases = reg['madya']?.kasus || 0;
      const regMadyaSim = reg['madya']?.sim || 0;
      const totalRegCases = regDasarCases + regMadyaCases;
      const totalRegSim = regDasarSim + regMadyaSim;

      // Pengurangan: Utama + Paripurna eksisting RS
      const utamaKasus = getSvcLevelData(svcName, 'utama').kasus;
      const paripurnaKasus = getSvcLevelData(svcName, 'paripurna').kasus;
      const totalKurangKasusSrc = utamaKasus + paripurnaKasus;
      const redAvgTarif = getSvcAvgTarifSim(svcName, ['utama', 'paripurna']);
      const totalKurangPend = totalKurangKasusSrc * redAvgTarif;

      totalPotensiTambahKasus += totalRegCases;
      totalPotensiTambahPend += totalRegSim;
      totalPotensiKurangKasus += totalKurangKasusSrc;
      totalPotensiKurangPend += totalKurangPend;
      totalEksistingInacbg += eksistingInacbg;
      totalEksistingKasus += eksistingKasus;

      rawDetails.push([
        index + 1,
        svcName,
        eksistingKasus,
        eksistingInacbg,
        totalRegCases,
        totalRegSim,
        totalKurangKasusSrc,
        totalKurangPend
      ]);
    });

    rawDetails.push([
      'TOTAL',
      '',
      totalEksistingKasus,
      totalEksistingInacbg,
      totalPotensiTambahKasus,
      totalPotensiTambahPend,
      totalPotensiKurangKasus,
      totalPotensiKurangPend
    ]);

    return {
      potensiTambahKasus: totalPotensiTambahKasus,
      potensiTambahPend: totalPotensiTambahPend,
      potensiKurangKasus: totalPotensiKurangKasus,
      potensiKurangPend: totalPotensiKurangPend,
      eksistingInacbg: totalEksistingInacbg,
      eksistingKasus: totalEksistingKasus,
      rawDetails
    };
  }, [filteredServices, byKelompok, regionalServiceDemand, svc, simulasi]);

  const handlePctChange = (idx, field, val) => {
    const newList = [...skenarioList];
    let num = parseFloat(val);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    if (num < 0) num = 0;
    newList[idx][field] = num;
    setSkenarioList(newList);
  };

  const formatM = (val) => {
    if (val === undefined || val === null) return '-';
    return (val / 1e9).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const generateTableData = () => {
    const { potensiTambahKasus, potensiTambahPend, potensiKurangKasus, potensiKurangPend,
            eksistingInacbg, eksistingKasus } = serviceBaselines;

    return skenarioList.map(sken => {
      const ratioT = sken.pctTambah / 100;
      const ratioK = sken.pctKurang / 100;

      const tambahanKasus = Math.round(potensiTambahKasus * ratioT);
      const tambahanPend = potensiTambahPend * ratioT;

      const kurangKasus = Math.round(potensiKurangKasus * ratioK);
      const kurangPend = potensiKurangPend * ratioK;

      const netKasus = tambahanKasus - kurangKasus;
      const pctNetKasusEksisting = eksistingKasus > 0 ? (netKasus / eksistingKasus) * 100 : 0;
      const netPend = tambahanPend - kurangPend;
      const totalPasca = eksistingInacbg + netPend;
      const pctKenaikanInacbg = eksistingInacbg > 0 ? (netPend / eksistingInacbg) * 100 : 0;

      return {
        label: sken.label,
        pctTambah: sken.pctTambah,
        pctKurang: sken.pctKurang,
        tambahanKasus, tambahanPend,
        kurangKasus, kurangPend,
        netKasus, pctNetKasusEksisting,
        netPend, eksistingInacbg, totalPasca, pctKenaikanInacbg
      };
    });
  };

  const tableData = generateTableData();

  React.useEffect(() => {
    if (onExportData && tableData.length > 0) {
      const exportData = tableData.map(row => [
        row.label,
        row.pctTambah / 100,
        row.tambahanKasus,
        row.tambahanPend / 1e9,
        row.pctKurang / 100,
        row.kurangKasus,
        row.kurangPend / 1e9,
        row.netKasus,
        row.pctNetKasusEksisting / 100,
        row.netPend / 1e9,
        row.eksistingInacbg / 1e9,
        row.pctKenaikanInacbg / 100
      ]);

      const headers = [
        'Skenario',
        '% Tambahan Dasar & Madya',
        'Tambahan Kasus',
        'Tambahan Pendapatan (Rp M)',
        '% Pengurangan Utama & Paripurna',
        'Pengurangan Kasus',
        'Pengurangan Pendapatan (Rp M)',
        'Net +/- Kasus',
        '% thd Total Kasus Eksisting',
        'Net +/- Pendapatan (Rp M)',
        'Pendapatan Eksisting INA-CBG (Rp M)',
        '% Kenaikan thd INA-CBG Eksisting'
      ];

      onExportData({
        type: 'standard',
        sheetName: 'Skenario_DasarMadya',
        headers,
        dataRows: exportData,
        groupHeaders: null
      });
    }
  }, [tableData, onExportData]);

  const handleCopy = () => {
    const headers = [
      'Skenario',
      '% Tambahan Dasar & Madya', 'Tambahan Kasus', 'Tambahan Pendapatan (Rp M)',
      '% Pengurangan Utama & Paripurna', 'Pengurangan Kasus', 'Pengurangan Pendapatan (Rp M)',
      'Net +/- Kasus', '% thd Total Kasus Eksisting', 'Net +/- Pendapatan (Rp M)',
      'Pendapatan Eksisting INA-CBG (Rp M)', '% Kenaikan thd INA-CBG Eksisting'
    ];
    let tsv = headers.join('\t') + '\n';
    tableData.forEach(row => {
      tsv += [
        row.label,
        row.pctTambah,
        row.tambahanKasus,
        (row.tambahanPend / 1e9).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        row.pctKurang,
        row.kurangKasus,
        (row.kurangPend / 1e9).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        row.netKasus,
        row.pctNetKasusEksisting.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        (row.netPend / 1e9).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        (row.eksistingInacbg / 1e9).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        row.pctKenaikanInacbg.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})
      ].join('\t') + '\n';
    });
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExcel = () => {
    const exportData = tableData.map(row => ({
      'Skenario': row.label,
      '% Tambahan Dasar & Madya': row.pctTambah,
      'Tambahan Kasus': row.tambahanKasus,
      'Tambahan Pendapatan (Rp M)': row.tambahanPend / 1e9,
      '% Pengurangan Utama & Paripurna': row.pctKurang,
      'Pengurangan Kasus': row.kurangKasus,
      'Pengurangan Pendapatan (Rp M)': row.kurangPend / 1e9,
      'Net +/- Kasus': row.netKasus,
      '% thd Total Kasus Eksisting': row.pctNetKasusEksisting / 100,
      'Net +/- Pendapatan (Rp M)': row.netPend / 1e9,
      'Pendapatan Eksisting INA-CBG (Rp M)': row.eksistingInacbg / 1e9,
      '% Kenaikan thd INA-CBG Eksisting': row.pctKenaikanInacbg / 100,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    for (let col of ['I', 'L']) {
      for (let i = 2; i <= tableData.length + 1; i++) {
        const cell = worksheet[`${col}${i}`];
        if (cell) cell.z = '0.00%';
      }
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Simulasi Shifting DasarMadya');
    XLSX.writeFile(workbook, `Simulasi_Shifting_DasarMadya_${(targetRsObj?.nama || 'RS').replace(/\s+/g, '_')}.xlsx`);
  };

  const handleDownloadKertasKerja = async () => {
    const headers = [
      "NO",
      "Kelompok Layanan RS",
      "Eksisting Kasus",
      "Eksisting INA-CBG (Rp)",
      "Potensi Regional Dasar & Madya (Kasus)",
      "Potensi Regional Dasar & Madya (Rp)",
      "Eksisting Utama & Paripurna (Kasus)",
      "Eksisting Utama & Paripurna (Rp)"
    ];
    await exportToExcel(
       headers,
       serviceBaselines.rawDetails,
       `KertasKerja_Skenario1_${(targetRsObj?.nama || 'RS').replace(/\s+/g, '_')}.xlsx`,
       null
    );
  };

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', marginTop: '24px' }}>
      {/* Header */}
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', color: '#0f172a', fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase' }}>
            Tabel Simulasi Shifting: Tambahan Kasus Dasar &amp; Madya — Pengurangan Kasus Utama &amp; Paripurna
          </h4>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
            Simulasi Perubahan Kasus &amp; Pendapatan berdasarkan demand regional (Dasar &amp; Madya) dan pengurangan eksisting RS (Utama &amp; Paripurna).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownloadExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
          >
            <Download size={14} />
            Summary Excel
          </button>
          <button
            onClick={handleDownloadKertasKerja}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
          >
            <Download size={14} />
            Kertas Kerja
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container" style={{ padding: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle' }}>Skenario</th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#047857', fontWeight: 700 }}>Tambahan Kasus Dasar &amp; Madya</th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#be123c', fontWeight: 700 }}>Pengurangan Kasus Utama &amp; Paripurna</th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#0f766e', fontWeight: 700 }}>Net +/- Pasca iDRG &amp; RBKP</th>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle', minWidth: '120px' }}>
                Pendapatan Eksisting INA-CBG (Rp M)
              </th>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle', minWidth: '100px' }}>
                % Kenaikan thd INA-CBG Eksisting
              </th>
            </tr>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Persentase (%)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Tambahan Pendapatan (Rp M)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Persentase (%)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Pengurangan Pendapatan (Rp M)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>+/- Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>% thd total kasus eksisting</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>+/- Pendapatan (Rp M)</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => {
              const netKasusColor = row.netKasus >= 0 ? '#047857' : '#be123c';
              const netPendColor = row.netPend >= 0 ? '#0f766e' : '#be123c';
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#334155' }}>{row.label}</td>

                  {/* Tambahan Dasar & Madya */}
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="number" value={row.pctTambah}
                        onChange={e => handlePctChange(idx, 'pctTambah', e.target.value)}
                        style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.85rem' }}
                      />
                      <span style={{ marginLeft: '4px', color: '#64748b' }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#047857', fontWeight: 600 }}>{row.tambahanKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#047857', fontWeight: 600 }}>{formatM(row.tambahanPend)}</td>

                  {/* Pengurangan Utama & Paripurna */}
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="number" value={row.pctKurang}
                        onChange={e => handlePctChange(idx, 'pctKurang', e.target.value)}
                        style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.85rem' }}
                      />
                      <span style={{ marginLeft: '4px', color: '#64748b' }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#be123c', fontWeight: 600 }}>{row.kurangKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#be123c', fontWeight: 600 }}>{formatM(row.kurangPend)}</td>

                  {/* Net */}
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 700, color: netKasusColor }}>
                    {row.netKasus > 0 ? '+' : ''}{row.netKasus.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155' }}>
                    {row.pctNetKasusEksisting.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 700, color: netPendColor }}>
                    {row.netPend > 0 ? '+' : ''}{formatM(row.netPend)}
                  </td>

                  {/* Eksisting & % Kenaikan */}
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                    {formatM(row.eksistingInacbg)}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 700, color: row.pctKenaikanInacbg >= 0 ? '#0f766e' : '#be123c' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span>{row.pctKenaikanInacbg > 0 ? '+' : ''}{row.pctKenaikanInacbg.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</span>
                      {row.eksistingInacbg === 0 && <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 'normal' }}>(N/A)</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '12px 16px', background: '#f8fafc', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
        * <b>% Kenaikan thd INA-CBG Eksisting</b> = <code>(Net +/- Pendapatan Pasca iDRG & RBKP) / Pendapatan INA-CBG Eksisting RS</code>.
        Potensi tambahan dihitung dari demand regional Dasar &amp; Madya; pengurangan dari kasus Utama &amp; Paripurna eksisting RS.
      </div>
    </div>
  );
};

export default ShiftingDasarMadyaSkenarioTable;
