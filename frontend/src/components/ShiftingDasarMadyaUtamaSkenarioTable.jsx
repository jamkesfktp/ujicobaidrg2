import React, { useState, useMemo } from 'react';
import { formatTableMiliar } from '../utils/formatters';
import { Download, Copy, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * ShiftingDasarMadyaUtamaSkenarioTable
 * Mode: Skenario (mirip ShiftingDasarMadyaSkenarioTable) tapi dengan:
 *   - Tambahan Kasus Dasar, Madya & Utama (dari demand regional)
 *   - Pengurangan Kasus Paripurna saja (dari eksisting RS)
 */
import { exportToExcel } from '../utils/exportExcel';
const ShiftingDasarMadyaUtamaSkenarioTable = ({
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

  const filteredServices = useMemo(() => {
    return servicesList.filter(s => {
      const normKel = s.toLowerCase().trim();
      if (activeLayananFilters && activeLayananFilters.length > 0) {
        if (!activeLayananFilters.includes(normKel)) return false;
      }
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

  const serviceBaselines = useMemo(() => {
    let totalPotensiTambahKasus = 0;
    let totalPotensiTambahPend  = 0;
    let totalPotensiKurangKasus = 0;
    let totalPotensiKurangPend  = 0;
    let totalEksistingInacbg    = 0;
    let totalEksistingKasus     = 0;
    let rawDetails              = [];

    filteredServices.forEach((svcName, index) => {
      const kelompokData   = byKelompok[svcName] || {};
      const eksistingInacbg = (kelompokData.sesuai?.inacbg || 0) + (kelompokData.loss?.inacbg || 0);
      const eksistingKasus  = (kelompokData.sesuai?.kasus  || 0) + (kelompokData.loss?.kasus  || 0);

      const normSvcName  = svcName.toLowerCase().trim();
      const reg          = regionalServiceDemand?.[normSvcName] || {};
      const regDasarCases = reg['dasar']?.kasus || 0;
      const regDasarSim   = reg['dasar']?.sim   || 0;
      const regMadyaCases = reg['madya']?.kasus || 0;
      const regMadyaSim   = reg['madya']?.sim   || 0;
      const regUtamaCases = reg['utama']?.kasus || 0;
      const regUtamaSim   = reg['utama']?.sim   || 0;

      const totalRegCases = regDasarCases + regMadyaCases + regUtamaCases;
      const totalRegSim   = regDasarSim   + regMadyaSim   + regUtamaSim;

      const paripurnaKasus = getSvcLevelData(svcName, 'paripurna').kasus;
      const redAvgTarif    = getSvcAvgTarifSim(svcName, ['paripurna']);
      const totalKurangPend = paripurnaKasus * redAvgTarif;

      totalPotensiTambahKasus += totalRegCases;
      totalPotensiTambahPend  += totalRegSim;
      totalPotensiKurangKasus += paripurnaKasus;
      totalPotensiKurangPend  += totalKurangPend;
      totalEksistingInacbg    += eksistingInacbg;
      totalEksistingKasus     += eksistingKasus;

      rawDetails.push([
        index + 1,
        svcName,
        eksistingKasus,
        eksistingInacbg,
        totalRegCases,
        totalRegSim,
        paripurnaKasus,
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
      potensiTambahPend:  totalPotensiTambahPend,
      potensiKurangKasus: totalPotensiKurangKasus,
      potensiKurangPend:  totalPotensiKurangPend,
      eksistingInacbg:    totalEksistingInacbg,
      eksistingKasus:     totalEksistingKasus,
      rawDetails
    };
  }, [filteredServices, byKelompok, regionalServiceDemand, svc, simulasi]);

  const handlePctChange = (idx, field, val) => {
    const newList = [...skenarioList];
    let num = parseFloat(val);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    if (num < 0)   num = 0;
    newList[idx][field] = num;
    setSkenarioList(newList);
  };

  const formatM = (val) => {
    if (val === undefined || val === null) return '-';
    return (val / 1e9).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const generateTableData = () => {
    const {
      potensiTambahKasus, potensiTambahPend,
      potensiKurangKasus, potensiKurangPend,
      eksistingInacbg, eksistingKasus
    } = serviceBaselines;

    return skenarioList.map(sken => {
      const ratioT = sken.pctTambah / 100;
      const ratioK = sken.pctKurang / 100;

      const tambahanKasus = Math.round(potensiTambahKasus * ratioT);
      const tambahanPend  = potensiTambahPend * ratioT;

      const kurangKasus = Math.round(potensiKurangKasus * ratioK);
      const kurangPend  = potensiKurangPend * ratioK;

      const netKasus               = tambahanKasus - kurangKasus;
      const pctNetKasusEksisting   = eksistingKasus > 0 ? (netKasus / eksistingKasus) * 100 : 0;
      const netPend                = tambahanPend - kurangPend;
      const totalPasca             = eksistingInacbg + netPend;
      const pctKenaikanInacbg      = eksistingInacbg > 0 ? (netPend / eksistingInacbg) * 100 : 0;

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
        '% Tambahan Dasar, Madya & Utama',
        'Tambahan Kasus',
        'Tambahan Pendapatan (Rp M)',
        '% Pengurangan Paripurna',
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
        sheetName: 'Skenario_DasarMadyaUtama',
        headers,
        dataRows: exportData,
        groupHeaders: null
      });
    }
  }, [tableData, onExportData]);

  const handleCopy = () => {
    const headers = [
      'Skenario',
      '% Tambahan Dasar, Madya & Utama', 'Tambahan Kasus', 'Tambahan Pendapatan (Rp M)',
      '% Pengurangan Paripurna', 'Pengurangan Kasus', 'Pengurangan Pendapatan (Rp M)',
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
      '% Tambahan Dasar, Madya & Utama': row.pctTambah,
      'Tambahan Kasus': row.tambahanKasus,
      'Tambahan Pendapatan (Rp M)': row.tambahanPend / 1e9,
      '% Pengurangan Paripurna': row.pctKurang,
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Simulasi Skenario 2');
    XLSX.writeFile(workbook, `Simulasi_Shifting_Skenario2_${(targetRsObj?.nama || 'RS').replace(/\s+/g, '_')}.xlsx`);
  };

  const handleDownloadKertasKerja = async () => {
    const headers = [
      "NO",
      "Kelompok Layanan RS",
      "Eksisting Kasus",
      "Eksisting INA-CBG (Rp)",
      "Potensi Regional Dasar, Madya, Utama (Kasus)",
      "Potensi Regional Dasar, Madya, Utama (Rp)",
      "Eksisting Paripurna (Kasus)",
      "Eksisting Paripurna (Rp)"
    ];
    await exportToExcel(
       headers,
       serviceBaselines.rawDetails,
       `KertasKerja_Skenario2_${(targetRsObj?.nama || 'RS').replace(/\s+/g, '_')}.xlsx`,
       null
    );
  };

  const clrTambah = '#7c3aed';
  const clrKurang = '#be123c';
  const clrNet    = '#0f766e';

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', marginTop: '24px' }}>

      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', background: '#f5f3ff' }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', color: '#0f172a', fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase' }}>
            Tabel Simulasi Shifting: Tambahan Kasus Dasar, Madya &amp; Utama — Pengurangan Kasus Paripurna
          </h4>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
            Simulasi Perubahan Kasus &amp; Pendapatan berdasarkan demand regional (Dasar, Madya &amp; Utama) dan pengurangan eksisting RS (Paripurna).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Tabel'}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', padding: '16px', background: '#faf5ff', borderBottom: '1px solid #e2e8f0' }}>
        {[
          { label: 'Potensi Tambahan Kasus', value: serviceBaselines.potensiTambahKasus.toLocaleString('id-ID'), color: clrTambah, sub: 'Dasar + Madya + Utama' },
          { label: 'Potensi Tambahan Pendapatan', value: `Rp ${formatM(serviceBaselines.potensiTambahPend)} M`, color: clrTambah, sub: '@ 100% capture' },
          { label: 'Potensi Kurang Kasus', value: serviceBaselines.potensiKurangKasus.toLocaleString('id-ID'), color: clrKurang, sub: 'Paripurna eksisting' },
          { label: 'Potensi Kurang Pendapatan', value: `Rp ${formatM(serviceBaselines.potensiKurangPend)} M`, color: clrKurang, sub: '@ 100% pengurangan' },
          { label: 'Pendapatan Eksisting INA-CBG', value: `Rp ${formatM(serviceBaselines.eksistingInacbg)} M`, color: '#475569', sub: 'baseline' },
        ].map((item, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '10px 14px', border: `1px solid ${item.color}33` }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '2px' }}>{item.label}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="table-container" style={{ padding: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle' }}>Skenario</th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: clrTambah, fontWeight: 700, background: '#f5f3ff' }}>
                Tambahan Kasus Dasar, Madya &amp; Utama
              </th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: clrKurang, fontWeight: 700, background: '#fff1f2' }}>
                Pengurangan Kasus Paripurna
              </th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: clrNet, fontWeight: 700, background: '#f0fdf4' }}>
                Net +/- Pasca iDRG &amp; RBKP
              </th>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle', minWidth: '120px' }}>
                Pendapatan Eksisting INA-CBG (Rp M)
              </th>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle', minWidth: '100px' }}>
                % Kenaikan thd INA-CBG Eksisting
              </th>
            </tr>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: clrTambah, fontWeight: 600 }}>Persentase (%)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: clrTambah, fontWeight: 600 }}>Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: clrTambah, fontWeight: 600 }}>Tambahan Pendapatan (Rp M)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: clrKurang, fontWeight: 600 }}>Persentase (%)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: clrKurang, fontWeight: 600 }}>Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: clrKurang, fontWeight: 600 }}>Pengurangan Pendapatan (Rp M)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>+/- Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>% thd total kasus eksisting</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>+/- Pendapatan (Rp M)</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => {
              const netKasusColor = row.netKasus >= 0 ? clrNet    : clrKurang;
              const netPendColor  = row.netPend  >= 0 ? '#0f766e' : clrKurang;
              const rowBg = idx % 2 === 0 ? 'white' : '#faf5ff';

              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: rowBg }}>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#334155' }}>{row.label}</td>

                  {/* Tambahan Dasar + Madya + Utama */}
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="number" value={row.pctTambah}
                        onChange={e => handlePctChange(idx, 'pctTambah', e.target.value)}
                        style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${clrTambah}55`, textAlign: 'center', fontSize: '0.85rem', color: clrTambah, fontWeight: 700 }}
                      />
                      <span style={{ marginLeft: '4px', color: '#64748b' }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: clrTambah, fontWeight: 600 }}>
                    {row.tambahanKasus.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: clrTambah, fontWeight: 600 }}>
                    {formatM(row.tambahanPend)}
                  </td>

                  {/* Pengurangan Paripurna */}
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input
                        type="number" value={row.pctKurang}
                        onChange={e => handlePctChange(idx, 'pctKurang', e.target.value)}
                        style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${clrKurang}55`, textAlign: 'center', fontSize: '0.85rem', color: clrKurang, fontWeight: 700 }}
                      />
                      <span style={{ marginLeft: '4px', color: '#64748b' }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: clrKurang, fontWeight: 600 }}>
                    {row.kurangKasus.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: clrKurang, fontWeight: 600 }}>
                    {formatM(row.kurangPend)}
                  </td>

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
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 700, color: row.pctKenaikanInacbg >= 0 ? '#0f766e' : clrKurang }}>
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

      {/* ── Footer note ── */}
      <div style={{ padding: '12px 16px', background: '#faf5ff', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
        * <b>% Kenaikan thd INA-CBG Eksisting</b> = <code>(Net +/- Pendapatan Pasca iDRG &amp; RBKP) / Pendapatan INA-CBG Eksisting RS</code>.
        Potensi tambahan dihitung dari demand regional Dasar, Madya &amp; Utama; pengurangan dari kasus Paripurna eksisting RS.
      </div>
    </div>
  );
};

export default ShiftingDasarMadyaUtamaSkenarioTable;
