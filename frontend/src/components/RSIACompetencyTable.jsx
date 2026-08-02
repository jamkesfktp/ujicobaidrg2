import React from 'react';
import { formatTableMiliar } from '../utils/formatters';
import DownloadExcelButton from './DownloadExcelButton';
import { exportToExcel } from '../utils/exportExcel';

// Map current competency mappings for selected services based on BPJS Monitoring Data 3 Juni 2026
const SERVICE_COMPETENCY_MAPPING = {
  'musculoskeletal dan jaringan lunak': 'Dasar',
  'jantung dan pembuluh darah': 'Madya',
  'uro nefro': 'Utama',
  'paru dan pernafasan': 'Paripurna',
  'saraf/ neuroscience': 'Dasar',
  'pencernaan dan hepatobilier': 'Madya',
  'endokrin, nutrisi dan metabolik': 'Utama',
  'ibu dan ginekologi': 'Paripurna',
  'mata': 'Dasar',
  'neoplasma': 'Madya',
  'infeksi dan parasit': 'Utama',
  'kulit & penyakit kelamin': 'Paripurna',
  'tht': 'Dasar',
  'gigi dan mulut': 'Madya',
  'jiwa': 'Utama',
  'neonatus': 'Paripurna',
  'hematologi': 'Dasar',
  'rekonstruksi dan estetika': 'Madya',
  'rehabilitasi': 'Utama',
  'trauma': 'Paripurna',
  'alergi imunologi dan rheumatologi': 'Dasar',
  'forensik': 'Madya',
  'luka bakar': 'Utama',
  'keracunan': 'Paripurna',
  'Unknown': 'Unknown'
};

const RSIACompetencyTable = ({ rsProfile, targetRsObj, simulasi, regionalServiceDemand, excludeNonKomp, activeLayananFilters, isSkenario1 = true, onExportData, rsKompetensiOnline }) => {
  if (!rsProfile || !targetRsObj) return null;

  const simulasiKey = `tarif_${simulasi}`;
  const svc = rsProfile.svc || {};
  const byKelompok = rsProfile.scorecard?.byKelompok || {};

  // All 24 Services + Unknown as per prompt request
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

  // Config contains level-specific percentages for simulation
  const [rowConfig, setRowConfig] = React.useState({});
  
  // Global quick-set inputs
  const [globalTambahInput1, setGlobalTambahInput1] = React.useState(100);
  const [globalTambahInput2, setGlobalTambahInput2] = React.useState(100);
  const [globalKurangInput1, setGlobalKurangInput1] = React.useState(100);
  const [globalKurangInput2, setGlobalKurangInput2] = React.useState(100);

  const applyGlobalTambah = () => {
    const next = { ...rowConfig };
    filteredServicesList.forEach(s => {
      if (!next[s]) next[s] = {};
      if (isSkenario1) {
        next[s].pctUtamaTambah = globalTambahInput1;
        next[s].pctParipurnaTambah = globalTambahInput2;
      } else {
        next[s].pctDasarTambah = globalTambahInput1;
        next[s].pctMadyaTambah = globalTambahInput2;
      }
    });
    setRowConfig(next);
  };

  const applyGlobalKurang = () => {
    const next = { ...rowConfig };
    filteredServicesList.forEach(s => {
      if (!next[s]) next[s] = {};
      if (isSkenario1) {
        next[s].pctDasarKurang = globalKurangInput1;
        next[s].pctMadyaKurang = globalKurangInput2;
      } else {
        next[s].pctUtamaKurang = globalKurangInput1;
        next[s].pctParipurnaKurang = globalKurangInput2;
      }
    });
    setRowConfig(next);
  };

  const resetAll = () => {
    setRowConfig({});
    setGlobalTambahInput1(100);
    setGlobalTambahInput2(100);
    setGlobalKurangInput1(100);
    setGlobalKurangInput2(100);
  };

  // Extract hospital's own cases by level
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

  // Get hospital average simulated rates
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

  const filteredServicesList = React.useMemo(() => {
    return servicesList.filter(s => {
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
  }, [servicesList, excludeNonKomp, targetRsObj, rsProfile]);

  const calculateSkenarioRow = (svcName, isSkenario1) => {
    const currentComp = getHospitalCompetencyForService(svcName);
    
    // Group level mappings
    const lvl1 = isSkenario1 ? 'utama' : 'dasar';
    const lvl2 = isSkenario1 ? 'paripurna' : 'madya';
    const red1 = isSkenario1 ? 'dasar' : 'utama';
    const red2 = isSkenario1 ? 'madya' : 'paripurna';

    // Eksisting RS Level-specific
    const eksLvl1 = getSvcLevelData(svcName, lvl1);
    const eksLvl2 = getSvcLevelData(svcName, lvl2);
    
    // Total Eksisting RS
    const kelompokData = byKelompok[svcName] || {};
    const eksistingKasus = (kelompokData.sesuai?.kasus || 0) + (kelompokData.loss?.kasus || 0);
    const eksistingInacbg = (kelompokData.sesuai?.inacbg || 0) + (kelompokData.loss?.inacbg || 0);

    // Potensi Regional
    const normSvcName = svcName.toLowerCase().trim();
    const regDemandData = regionalServiceDemand?.[normSvcName] || {};
    
    const regLvl1Cases = regDemandData[lvl1]?.kasus || 0;
    const regLvl1Sim = regDemandData[lvl1]?.sim || 0;
    const regLvl2Cases = regDemandData[lvl2]?.kasus || 0;
    const regLvl2Sim = regDemandData[lvl2]?.sim || 0;

    // Simulation Percentages
    const pctLvl1Tambah = rowConfig[svcName]?.[`pct${lvl1.charAt(0).toUpperCase() + lvl1.slice(1)}Tambah`] !== undefined 
      ? rowConfig[svcName][`pct${lvl1.charAt(0).toUpperCase() + lvl1.slice(1)}Tambah`] 
      : 100;
    const pctLvl2Tambah = rowConfig[svcName]?.[`pct${lvl2.charAt(0).toUpperCase() + lvl2.slice(1)}Tambah`] !== undefined 
      ? rowConfig[svcName][`pct${lvl2.charAt(0).toUpperCase() + lvl2.slice(1)}Tambah`] 
      : 100;

    const pctRed1Kurang = rowConfig[svcName]?.[`pct${red1.charAt(0).toUpperCase() + red1.slice(1)}Kurang`] !== undefined 
      ? rowConfig[svcName][`pct${red1.charAt(0).toUpperCase() + red1.slice(1)}Kurang`] 
      : 100;
    const pctRed2Kurang = rowConfig[svcName]?.[`pct${red2.charAt(0).toUpperCase() + red2.slice(1)}Kurang`] !== undefined 
      ? rowConfig[svcName][`pct${red2.charAt(0).toUpperCase() + red2.slice(1)}Kurang`] 
      : 100;

    // Tambahan Kasus
    const tambahLvl1Kasus = Math.round(regLvl1Cases * (pctLvl1Tambah / 100));
    const tambahLvl1Pendapatan = tambahLvl1Kasus * (regLvl1Cases > 0 ? (regLvl1Sim / regLvl1Cases) : 0);

    const tambahLvl2Kasus = Math.round(regLvl2Cases * (pctLvl2Tambah / 100));
    const tambahLvl2Pendapatan = tambahLvl2Kasus * (regLvl2Cases > 0 ? (regLvl2Sim / regLvl2Cases) : 0);

    const totalTambahKasus = tambahLvl1Kasus + tambahLvl2Kasus;
    const totalTambahPendapatan = tambahLvl1Pendapatan + tambahLvl2Pendapatan;

    // Pengurangan Kasus
    const kurangRed1KasusMax = getSvcLevelData(svcName, red1).kasus;
    const kurangRed1AvgTarif = getSvcAvgTarifSim(svcName, [red1]);
    const kurangRed1Kasus = Math.round(kurangRed1KasusMax * (pctRed1Kurang / 100));
    const kurangRed1Pendapatan = kurangRed1Kasus * kurangRed1AvgTarif;

    const kurangRed2KasusMax = getSvcLevelData(svcName, red2).kasus;
    const kurangRed2AvgTarif = getSvcAvgTarifSim(svcName, [red2]);
    const kurangRed2Kasus = Math.round(kurangRed2KasusMax * (pctRed2Kurang / 100));
    const kurangRed2Pendapatan = kurangRed2Kasus * kurangRed2AvgTarif;

    const totalKurangKasus = kurangRed1Kasus + kurangRed2Kasus;
    const totalKurangPendapatan = kurangRed1Pendapatan + kurangRed2Pendapatan;

    // Net
    const netKasus = totalTambahKasus - totalKurangKasus;
    const netKasusPct = eksistingKasus > 0 ? (netKasus / eksistingKasus) * 100 : 0;
    const netPendapatan = totalTambahPendapatan - totalKurangPendapatan;
    const pctKenaikan = eksistingInacbg > 0 ? (netPendapatan / eksistingInacbg) * 100 : 0;

    return {
      svcName,
      currentComp,
      eksLvl1,
      eksLvl2,
      regLvl1Cases,
      regLvl1Sim,
      regLvl2Cases,
      regLvl2Sim,
      pctLvl1Tambah,
      pctLvl2Tambah,
      tambahLvl1Kasus,
      tambahLvl1Pendapatan,
      tambahLvl2Kasus,
      tambahLvl2Pendapatan,
      totalTambahKasus,
      totalTambahPendapatan,
      pctRed1Kurang,
      pctRed2Kurang,
      kurangRed1Kasus,
      kurangRed1Pendapatan,
      kurangRed2Kasus,
      kurangRed2Pendapatan,
      totalKurangKasus,
      totalKurangPendapatan,
      netKasus,
      netKasusPct,
      netPendapatan,
      eksistingInacbg,
      pctKenaikan
    };
  };

  const renderTable = (isSkenario1) => {
    const rows = filteredServicesList.map(s => calculateSkenarioRow(s, isSkenario1));
    
    // Sum aggregates
    const totalRow = rows.reduce((acc, curr) => {
      acc.eksLvl1Kasus += curr.eksLvl1.kasus;
      acc.eksLvl1Inacbg += curr.eksLvl1.inacbg;
      acc.eksLvl2Kasus += curr.eksLvl2.kasus;
      acc.eksLvl2Inacbg += curr.eksLvl2.inacbg;
      acc.regLvl1Cases += curr.regLvl1Cases;
      acc.regLvl1Sim += curr.regLvl1Sim;
      acc.regLvl2Cases += curr.regLvl2Cases;
      acc.regLvl2Sim += curr.regLvl2Sim;
      acc.tambahLvl1Kasus += curr.tambahLvl1Kasus;
      acc.tambahLvl1Pendapatan += curr.tambahLvl1Pendapatan;
      acc.tambahLvl2Kasus += curr.tambahLvl2Kasus;
      acc.tambahLvl2Pendapatan += curr.tambahLvl2Pendapatan;
      acc.totalTambahKasus += curr.totalTambahKasus;
      acc.totalTambahPendapatan += curr.totalTambahPendapatan;
      acc.kurangRed1Kasus += curr.kurangRed1Kasus;
      acc.kurangRed1Pendapatan += curr.kurangRed1Pendapatan;
      acc.kurangRed2Kasus += curr.kurangRed2Kasus;
      acc.kurangRed2Pendapatan += curr.kurangRed2Pendapatan;
      acc.totalKurangKasus += curr.totalKurangKasus;
      acc.totalKurangPendapatan += curr.totalKurangPendapatan;
      acc.netKasus += curr.netKasus;
      acc.netPendapatan += curr.netPendapatan;
      acc.eksistingInacbg += curr.eksistingInacbg;
      return acc;
    }, {
      eksLvl1Kasus: 0, eksLvl1Inacbg: 0,
      eksLvl2Kasus: 0, eksLvl2Inacbg: 0,
      regLvl1Cases: 0, regLvl1Sim: 0,
      regLvl2Cases: 0, regLvl2Sim: 0,
      tambahLvl1Kasus: 0, tambahLvl1Pendapatan: 0,
      tambahLvl2Kasus: 0, tambahLvl2Pendapatan: 0,
      totalTambahKasus: 0, totalTambahPendapatan: 0,
      kurangRed1Kasus: 0, kurangRed1Pendapatan: 0,
      kurangRed2Kasus: 0, kurangRed2Pendapatan: 0,
      totalKurangKasus: 0, totalKurangPendapatan: 0,
      netKasus: 0, netPendapatan: 0,
      eksistingInacbg: 0
    });

    const totalKasusEksisting = rows.reduce((sum, r) => {
      const kel = byKelompok[r.svcName] || {};
      return sum + (kel.sesuai?.kasus || 0) + (kel.loss?.kasus || 0);
    }, 0);

    const totalNetKasusPct = totalKasusEksisting > 0 ? (totalRow.netKasus / totalKasusEksisting) * 100 : 0;
    const totalPctKenaikan = totalRow.eksistingInacbg > 0 ? (totalRow.netPendapatan / totalRow.eksistingInacbg) * 100 : 0;

    const labelLvl1 = isSkenario1 ? 'Utama' : 'Dasar';
    const labelLvl2 = isSkenario1 ? 'Paripurna' : 'Madya';
    const labelRed1 = isSkenario1 ? 'Dasar' : 'Utama';
    const labelRed2 = isSkenario1 ? 'Madya' : 'Paripurna';

    React.useEffect(() => {
      if (onExportData && rows.length > 0) {
        const subHeaders = [
          "NO",
          "Kelompok Layanan RS",
          "Kompetensi RS Saat Ini",
          `${labelLvl1} (Kasus)`,
          `${labelLvl1} (Rp M)`,
          `${labelLvl2} (Kasus)`,
          `${labelLvl2} (Rp M)`,
          `${labelLvl1} (Kasus)`,
          `${labelLvl1} (Rp M)`,
          `${labelLvl2} (Kasus)`,
          `${labelLvl2} (Rp M)`,
          `${labelLvl1} (%)`,
          `${labelLvl1} (Kasus)`,
          `${labelLvl2} (%)`,
          `${labelLvl2} (Kasus)`,
          `Total Tambah (Kasus)`,
          `Total Tambah (Rp M)`,
          `${labelRed1} (%)`,
          `${labelRed1} (Kasus)`,
          `${labelRed2} (%)`,
          `${labelRed2} (Kasus)`,
          `Total Kurang (Kasus)`,
          `Total Kurang (Rp M)`,
          `+/- Jumlah Kasus`,
          `% thd total kasus eksisting`,
          `+/- Pendapatan (Rp M)`,
          `Total Eksisting INA-CBG (Rp M)`,
          `% Kenaikan thd Eksisting`
        ];

        const groupHeaders = [
          { label: "NO", colSpan: 1, rowSpan: 2, fill: "#0f766e" },
          { label: "Kelompok Layanan RS", colSpan: 1, rowSpan: 2, fill: "#0f766e" },
          { label: "Kompetensi RS Saat Ini", colSpan: 1, rowSpan: 2, fill: "#0f766e" },
          { label: `Eksisting RS (${labelLvl1} & ${labelLvl2})`, colSpan: 4, rowSpan: 1, fill: "#1e3a8a" },
          { label: `Potensi Regional (${labelLvl1} & ${labelLvl2})`, colSpan: 4, rowSpan: 1, fill: "#1e3a8a" },
          { label: `Tambahan (${labelLvl1} & ${labelLvl2})`, colSpan: 6, rowSpan: 1, fill: "#047857" },
          { label: `Pengurangan (${labelRed1} & ${labelRed2})`, colSpan: 6, rowSpan: 1, fill: "#be123c" },
          { label: "Net +/- Pasca iDRG & RBKP", colSpan: 3, rowSpan: 1, fill: "#0f766e" },
          { label: "Total Eksisting (Rp M)", colSpan: 1, rowSpan: 2, fill: "#0f766e" },
          { label: "% Kenaikan", colSpan: 1, rowSpan: 2, fill: "#0f766e" }
        ];

        const dataRows = rows.map((row, index) => [
          index + 1,
          row.svcName,
          row.currentComp,
          row.eksLvl1.kasus,
          row.eksLvl1.inacbg / 1000000000,
          row.eksLvl2.kasus,
          row.eksLvl2.inacbg / 1000000000,
          row.regLvl1Cases,
          row.regLvl1Sim / 1000000000,
          row.regLvl2Cases,
          row.regLvl2Sim / 1000000000,
          row.pctLvl1Tambah / 100,
          row.tambahLvl1Kasus,
          row.pctLvl2Tambah / 100,
          row.tambahLvl2Kasus,
          row.totalTambahKasus,
          row.totalTambahPendapatan / 1000000000,
          row.pctRed1Kurang / 100,
          row.kurangRed1Kasus,
          row.pctRed2Kurang / 100,
          row.kurangRed2Kasus,
          row.totalKurangKasus,
          row.totalKurangPendapatan / 1000000000,
          row.netKasus,
          row.netKasusPct / 100,
          row.netPendapatan / 1000000000,
          row.eksistingInacbg / 1000000000,
          row.pctKenaikan / 100
        ]);

        const totRow = [
          "Total", "", "",
          totalRow.eksLvl1Kasus, totalRow.eksLvl1Inacbg / 1000000000,
          totalRow.eksLvl2Kasus, totalRow.eksLvl2Inacbg / 1000000000,
          totalRow.regLvl1Cases, totalRow.regLvl1Sim / 1000000000,
          totalRow.regLvl2Cases, totalRow.regLvl2Sim / 1000000000,
          "", totalRow.tambahLvl1Kasus, "", totalRow.tambahLvl2Kasus,
          totalRow.totalTambahKasus, totalRow.totalTambahPendapatan / 1000000000,
          "", totalRow.kurangRed1Kasus, "", totalRow.kurangRed2Kasus,
          totalRow.totalKurangKasus, totalRow.totalKurangPendapatan / 1000000000,
          totalRow.netKasus, "", totalRow.netPendapatan / 1000000000,
          totalRow.eksistingInacbg / 1000000000, totalRow.eksistingInacbg > 0 ? (totalRow.netPendapatan / totalRow.eksistingInacbg) : 0
        ];
        dataRows.push(totRow);

        onExportData({
          type: 'standard',
          sheetName: isSkenario1 ? 'Kompetensi_RS_Skenario_1' : 'Kompetensi_RS_Skenario_2',
          headers: subHeaders,
          dataRows,
          groupHeaders
        });
      }
    }, [rows, totalRow, isSkenario1, labelLvl1, labelLvl2, labelRed1, labelRed2, onExportData]);

    const handleDownloadExcel = async (password) => {
      const subHeaders = [
        "NO",
        "Kelompok Layanan RS",
        "Kompetensi RS Saat Ini",
        `${labelLvl1} (Kasus)`,
        `${labelLvl1} (Rp M)`,
        `${labelLvl2} (Kasus)`,
        `${labelLvl2} (Rp M)`,
        `${labelLvl1} (Kasus)`,
        `${labelLvl1} (Rp M)`,
        `${labelLvl2} (Kasus)`,
        `${labelLvl2} (Rp M)`,
        `${labelLvl1} (%)`,
        `${labelLvl1} (Kasus)`,
        `${labelLvl2} (%)`,
        `${labelLvl2} (Kasus)`,
        `Total Tambah (Kasus)`,
        `Total Tambah (Rp M)`,
        `${labelRed1} (%)`,
        `${labelRed1} (Kasus)`,
        `${labelRed2} (%)`,
        `${labelRed2} (Kasus)`,
        `Total Kurang (Kasus)`,
        `Total Kurang (Rp M)`,
        `+/- Jumlah Kasus`,
        `% thd total kasus eksisting`,
        `+/- Pendapatan (Rp M)`,
        `Total Eksisting INA-CBG (Rp M)`,
        `% Kenaikan thd Eksisting`
      ];

      const groupHeaders = [
        { label: "NO", colSpan: 1, rowSpan: 2, fill: "#0f766e" },
        { label: "Kelompok Layanan RS", colSpan: 1, rowSpan: 2, fill: "#0f766e" },
        { label: "Kompetensi RS Saat Ini", colSpan: 1, rowSpan: 2, fill: "#0f766e" },
        { label: `Eksisting RS (${labelLvl1} & ${labelLvl2})`, colSpan: 4, rowSpan: 1, fill: "#1e3a8a" },
        { label: `Potensi Regional (${labelLvl1} & ${labelLvl2})`, colSpan: 4, rowSpan: 1, fill: "#1e3a8a" },
        { label: `Tambahan (${labelLvl1} & ${labelLvl2})`, colSpan: 6, rowSpan: 1, fill: "#047857" },
        { label: `Pengurangan (${labelRed1} & ${labelRed2})`, colSpan: 6, rowSpan: 1, fill: "#be123c" },
        { label: "Net +/- Pasca iDRG & RBKP", colSpan: 3, rowSpan: 1, fill: "#0f766e" },
        { label: "Total Eksisting (Rp M)", colSpan: 1, rowSpan: 2, fill: "#0f766e" },
        { label: "% Kenaikan", colSpan: 1, rowSpan: 2, fill: "#0f766e" }
      ];

      const dataRows = rows.map((row, index) => [
        index + 1,
        row.svcName,
        row.currentComp,
        row.eksLvl1.kasus,
        row.eksLvl1.inacbg / 1000000000,
        row.eksLvl2.kasus,
        row.eksLvl2.inacbg / 1000000000,
        row.regLvl1Cases,
        row.regLvl1Sim / 1000000000,
        row.regLvl2Cases,
        row.regLvl2Sim / 1000000000,
        row.pctLvl1Tambah / 100,
        row.tambahLvl1Kasus,
        row.pctLvl2Tambah / 100,
        row.tambahLvl2Kasus,
        row.totalTambahKasus,
        row.totalTambahPendapatan / 1000000000,
        row.pctRed1Kurang / 100,
        row.kurangRed1Kasus,
        row.pctRed2Kurang / 100,
        row.kurangRed2Kasus,
        row.totalKurangKasus,
        row.totalKurangPendapatan / 1000000000,
        row.netKasus,
        row.netKasusPct / 100,
        row.netPendapatan / 1000000000,
        row.eksistingInacbg / 1000000000,
        row.pctKenaikan / 100
      ]);

      dataRows.push([
        "TOTAL",
        "",
        "",
        totalRow.eksLvl1Kasus,
        totalRow.eksLvl1Inacbg / 1000000000,
        totalRow.eksLvl2Kasus,
        totalRow.eksLvl2Inacbg / 1000000000,
        totalRow.regLvl1Cases,
        totalRow.regLvl1Sim / 1000000000,
        totalRow.regLvl2Cases,
        totalRow.regLvl2Sim / 1000000000,
        "",
        totalRow.tambahLvl1Kasus,
        "",
        totalRow.tambahLvl2Kasus,
        totalRow.totalTambahKasus,
        totalRow.totalTambahPendapatan / 1000000000,
        "",
        totalRow.kurangRed1Kasus,
        "",
        totalRow.kurangRed2Kasus,
        totalRow.totalKurangKasus,
        totalRow.totalKurangPendapatan / 1000000000,
        totalRow.netKasus,
        totalNetKasusPct / 100,
        totalRow.netPendapatan / 1000000000,
        totalRow.eksistingInacbg / 1000000000,
        totalPctKenaikan / 100
      ]);

      const fn = `Simulasi_24KompetensiDetail_${isSkenario1 ? 'Skenario1' : 'Skenario2'}_${(targetRsObj?.nama || 'RS').replace(/\s+/g, '_')}.xlsx`;
      await exportToExcel(subHeaders, dataRows, fn, password, groupHeaders);
    };

    return (
      <div className="table-container animate-fade-in-up" style={{ padding: '16px', overflowX: 'auto', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '24px' }}>
        
        {/* Quick Simulation Global Config Panel */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px', padding: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: '#1e293b' }}>⚡ Simulasi Cepat (Global):</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Tambahan {labelLvl1}:</span>
            <input 
              type="number" 
              min="0" 
              max="100" 
              value={globalTambahInput1} 
              onChange={(e) => setGlobalTambahInput1(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '50px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }} 
            />
            <span>%</span>
            <span>{labelLvl2}:</span>
            <input 
              type="number" 
              min="0" 
              max="100" 
              value={globalTambahInput2} 
              onChange={(e) => setGlobalTambahInput2(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '50px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }} 
            />
            <span>%</span>
            <button onClick={applyGlobalTambah} style={{ padding: '2px 8px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Set Semua</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Pengurangan {labelRed1}:</span>
            <input 
              type="number" 
              min="0" 
              max="100" 
              value={globalKurangInput1} 
              onChange={(e) => setGlobalKurangInput1(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '50px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }} 
            />
            <span>%</span>
            <span>{labelRed2}:</span>
            <input 
              type="number" 
              min="0" 
              max="100" 
              value={globalKurangInput2} 
              onChange={(e) => setGlobalKurangInput2(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
              style={{ width: '50px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center' }} 
            />
            <span>%</span>
            <button onClick={applyGlobalKurang} style={{ padding: '2px 8px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Set Semua</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
            <button onClick={resetAll} style={{ padding: '6px 12px', background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>Reset Simulasi</button>
            <DownloadExcelButton 
              customExportFn={handleDownloadExcel} 
              filename={`Simulasi_24KompetensiDetail_${isSkenario1 ? 'Skenario1' : 'Skenario2'}.xlsx`} 
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.70rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}>NO</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700, textAlign: 'left', minWidth: '150px' }}>Kelompok Layanan RS</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700, minWidth: '80px' }}>Kompetensi RS Saat Ini</th>
              <th colSpan="4" style={{ padding: '6px', border: '1px solid #cbd5e1', color: '#1e3a8a', fontWeight: 700 }}>Eksisting RS ({labelLvl1} & {labelLvl2})</th>
              <th colSpan="4" style={{ padding: '6px', border: '1px solid #cbd5e1', color: '#1e3a8a', fontWeight: 700 }}>Potensi Regional ({labelLvl1} & {labelLvl2})</th>
              <th colSpan="6" style={{ padding: '6px', border: '1px solid #cbd5e1', color: '#047857', fontWeight: 700 }}>Tambahan ({labelLvl1} & {labelLvl2})</th>
              <th colSpan="6" style={{ padding: '6px', border: '1px solid #cbd5e1', color: '#be123c', fontWeight: 700 }}>Pengurangan ({labelRed1} & {labelRed2})</th>
              <th colSpan="3" style={{ padding: '6px', border: '1px solid #cbd5e1', color: '#0f766e', fontWeight: 700 }}>Net +/- Pasca iDRG & RBKP</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700, minWidth: '80px' }}>Total Eksisting INA-CBG (Rp M)</th>
              <th rowSpan="2" style={{ padding: '8px', border: '1px solid #cbd5e1', fontWeight: 700, minWidth: '80px' }}>% Kenaikan</th>
            </tr>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
              {/* Eksisting */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl1} (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl1} (M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl2} (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl2} (M)</th>
              
              {/* Potensi Regional */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl1} (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl1} (M)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl2} (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl2} (M)</th>
              
              {/* Tambahan */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl1} (%)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl1} (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl2} (%)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelLvl2} (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#047857', fontWeight: 'bold' }}>T-Jml (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#047857', fontWeight: 'bold' }}>T-Rp (M)</th>
              
              {/* Pengurangan */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelRed1} (%)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelRed1} (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelRed2} (%)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>{labelRed2} (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#be123c', fontWeight: 'bold' }}>K-Jml (K)</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#be123c', fontWeight: 'bold' }}>K-Rp (M)</th>
              
              {/* Net */}
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>+/- Kasus</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>% thd total</th>
              <th style={{ padding: '4px', border: '1px solid #cbd5e1', color: '#64748b' }}>+/- Pendapatan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const netKasusColor = row.netKasus >= 0 ? '#0f766e' : '#be123c';
              const netPendColor = row.netPendapatan >= 0 ? '#0f766e' : '#be123c';
              const isEvenRow = index % 2 === 0;

              return (
                <tr key={row.svcName} style={{ borderBottom: '1px solid #e2e8f0', background: isEvenRow ? 'white' : '#f8fafc' }}>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontWeight: 600 }}>{index + 1}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'left', textTransform: 'capitalize', fontWeight: 500 }}>{row.svcName}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', fontWeight: 600, color: '#334155' }}>{row.currentComp}</td>
                  
                  {/* Eksisting RS */}
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>{row.eksLvl1.kasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>{formatTableMiliar(row.eksLvl1.inacbg).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>{row.eksLvl2.kasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>{formatTableMiliar(row.eksLvl2.inacbg).replace('Rp', '')}</td>

                  {/* Potensi Regional */}
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#1e3a8a' }}>{row.regLvl1Cases.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#1e3a8a' }}>{formatTableMiliar(row.regLvl1Sim).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#1e3a8a' }}>{row.regLvl2Cases.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#1e3a8a' }}>{formatTableMiliar(row.regLvl2Sim).replace('Rp', '')}</td>

                  {/* Tambahan */}
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                      <input 
                        type="number" min="0" max="100" value={row.pctLvl1Tambah} 
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setRowConfig(prev => ({
                            ...prev,
                            [row.svcName]: { ...prev[row.svcName], [`pct${lvl1.charAt(0).toUpperCase() + lvl1.slice(1)}Tambah`]: val }
                          }));
                        }}
                        style={{ width: '38px', textAlign: 'center', padding: '1px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.65rem' }}
                      />
                      <span>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857' }}>{row.tambahLvl1Kasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                      <input 
                        type="number" min="0" max="100" value={row.pctLvl2Tambah} 
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setRowConfig(prev => ({
                            ...prev,
                            [row.svcName]: { ...prev[row.svcName], [`pct${lvl2.charAt(0).toUpperCase() + lvl2.slice(1)}Tambah`]: val }
                          }));
                        }}
                        style={{ width: '38px', textAlign: 'center', padding: '1px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.65rem' }}
                      />
                      <span>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857' }}>{row.tambahLvl2Kasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857', fontWeight: 'bold' }}>{row.totalTambahKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#047857', fontWeight: 'bold' }}>{formatTableMiliar(row.totalTambahPendapatan).replace('Rp', '')}</td>

                  {/* Pengurangan */}
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                      <input 
                        type="number" min="0" max="100" value={row.pctRed1Kurang} 
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setRowConfig(prev => ({
                            ...prev,
                            [row.svcName]: { ...prev[row.svcName], [`pct${red1.charAt(0).toUpperCase() + red1.slice(1)}Kurang`]: val }
                          }));
                        }}
                        style={{ width: '38px', textAlign: 'center', padding: '1px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.65rem' }}
                      />
                      <span>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#be123c' }}>{row.kurangRed1Kasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                      <input 
                        type="number" min="0" max="100" value={row.pctRed2Kurang} 
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setRowConfig(prev => ({
                            ...prev,
                            [row.svcName]: { ...prev[row.svcName], [`pct${red2.charAt(0).toUpperCase() + red2.slice(1)}Kurang`]: val }
                          }));
                        }}
                        style={{ width: '38px', textAlign: 'center', padding: '1px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.65rem' }}
                      />
                      <span>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#be123c' }}>{row.kurangRed2Kasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#be123c', fontWeight: 'bold' }}>{row.totalKurangKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#be123c', fontWeight: 'bold' }}>{formatTableMiliar(row.totalKurangPendapatan).replace('Rp', '')}</td>

                  {/* Net */}
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: netKasusColor, fontWeight: 700 }}>
                    {row.netKasus > 0 ? '+' : ''}{row.netKasus.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>{row.netKasusPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: netPendColor, fontWeight: 700 }}>
                    {row.netPendapatan > 0 ? '+' : ''}{formatTableMiliar(row.netPendapatan).replace('Rp', '')}
                  </td>

                  {/* Eksisting & Kenaikan */}
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: '#475569' }}>{formatTableMiliar(row.eksistingInacbg).replace('Rp', '')}</td>
                  <td style={{ padding: '6px', border: '1px solid #e2e8f0', color: netPendColor, fontWeight: 700 }}>
                    {row.pctKenaikan > 0 ? '+' : ''}{row.pctKenaikan.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>TOTAL</td>
              
              {/* Eksisting */}
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{totalRow.eksLvl1Kasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{formatTableMiliar(totalRow.eksLvl1Inacbg).replace('Rp', '')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{totalRow.eksLvl2Kasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{formatTableMiliar(totalRow.eksLvl2Inacbg).replace('Rp', '')}</td>

              {/* Potensi Regional */}
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#1e3a8a' }}>{totalRow.regLvl1Cases.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#1e3a8a' }}>{formatTableMiliar(totalRow.regLvl1Sim).replace('Rp', '')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#1e3a8a' }}>{totalRow.regLvl2Cases.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#1e3a8a' }}>{formatTableMiliar(totalRow.regLvl2Sim).replace('Rp', '')}</td>

              {/* Tambahan */}
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>-</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#047857' }}>{totalRow.tambahLvl1Kasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>-</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#047857' }}>{totalRow.tambahLvl2Kasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#047857', fontWeight: 'bold' }}>{totalRow.totalTambahKasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#047857', fontWeight: 'bold' }}>{formatTableMiliar(totalRow.totalTambahPendapatan).replace('Rp', '')}</td>

              {/* Pengurangan */}
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>-</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#be123c' }}>{totalRow.kurangRed1Kasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>-</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#be123c' }}>{totalRow.kurangRed2Kasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#be123c', fontWeight: 'bold' }}>{totalRow.totalKurangKasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#be123c', fontWeight: 'bold' }}>{formatTableMiliar(totalRow.totalKurangPendapatan).replace('Rp', '')}</td>

              {/* Net */}
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: totalRow.netKasus >= 0 ? '#0f766e' : '#be123c' }}>{totalRow.netKasus > 0 ? '+' : ''}{totalRow.netKasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{totalNetKasusPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: totalRow.netPendapatan >= 0 ? '#0f766e' : '#be123c' }}>{totalRow.netPendapatan > 0 ? '+' : ''}{formatTableMiliar(totalRow.netPendapatan).replace('Rp', '')}</td>
              
              {/* Eksisting Total & Kenaikan */}
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#475569' }}>{formatTableMiliar(totalRow.eksistingInacbg).replace('Rp', '')}</td>
              <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: totalRow.netPendapatan >= 0 ? '#0f766e' : '#be123c', fontWeight: 'bold' }}>{totalPctKenaikan.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ color: '#0f172a', fontWeight: 800, margin: '0 0 4px 0', fontSize: '1rem', textTransform: 'uppercase' }}>
          {isSkenario1 ? 'SKENARIO 1: Tambahan Kasus Utama & Paripurna & Pengurangan Kasus Dasar & Madya' : 'SKENARIO 2: Tambahan Kasus Dasar & Madya & Pengurangan Kasus Utama & Paripurna'}
        </h4>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
          Analisis proyeksi serapan demand regional dan shifting internal RS berdasarkan profil 24 kelompok kompetensi layanan (Detail per Tingkat Kompetensi).
        </p>
      </div>
      {renderTable(isSkenario1)}
    </div>
  );
};

export default RSIACompetencyTable;
