import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Target, MapPin, Building, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import Select from 'react-select';
import MapIndonesia from '../components/MapIndonesia';
import HospitalProfileCard from '../components/HospitalProfileCard';
import { exportMapRegionToPPTX } from '../utils/exportPptx';
import { matchesGroup, RS_GROUPS } from '../utils/rsGroups';
import DownloadExcelButton from '../components/DownloadExcelButton';
import { exportMatriksExcel, exportLayananExcel } from '../utils/excelStyledExport';
import { formatCompactCurrency, formatCurrency , formatTableMiliar} from '../utils/formatters';
import { filterHospital } from '../utils/filterUtils';
import './SimulasiRujukan.css';
import { loadDatasetFile } from '../utils/dataLoader';


const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const SimulasiRujukan = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg, rsKompetensiOnline }) => {
  const [hospitalsData, setHospitalsData] = useState(null);
  const [rsProfilesData, setRsProfilesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvs, setSelectedProvs] = useState([]);
  const [selectedKabs, setSelectedKabs] = useState([]);
  const [virtualTargetKomp, setVirtualTargetKomp] = useState('paripurna');
  const [localTargetRs, setLocalTargetRs] = useState(null);
  const [selectedMapProvinces, setSelectedMapProvinces] = useState([]);
  const [selectedMapHospital, setSelectedMapHospital] = useState(null);
  const [isExportingPPT, setIsExportingPPT] = useState(false);

  // Sliders for Market Share Capture
  const [customGlobalMarketShare, setCustomGlobalMarketShare] = useState({});
  const [customServiceMarketShare, setCustomServiceMarketShare] = useState({});

  // Reset custom sliders when context changes
  useEffect(() => {
    setCustomGlobalMarketShare({});
    setCustomServiceMarketShare({});
  }, [localTargetRs, rsFilter, selectedProvs, selectedKabs, groupFilter, wilayahFilter]);

  const localRsOptions = React.useMemo(() => {
    if (!hospitalsData) return [];
    const filteredOptions = [];
    Object.entries(hospitalsData).forEach(([kode, rs]) => {
      let localDropdownMatch = true;
      if (selectedProvs.length > 0 && !selectedProvs.some(p => p.value === rs.prop)) localDropdownMatch = false;
      if (selectedKabs.length > 0 && !selectedKabs.some(k => k.value === rs.kab)) localDropdownMatch = false;

      if (!localDropdownMatch) return;
      if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;

      filteredOptions.push({
        value: kode,
        label: `${rs.nama || 'Unknown'} (${kode})`
      });
    });
    return [{ value: 'ALL', label: 'Semua RS (Sesuai Filter Global)' }, ...filteredOptions];
  }, [hospitalsData, groupFilter, wilayahFilter, selectedProvs, selectedKabs]);

  useEffect(() => {
    if (wilayahFilter && wilayahFilter.length > 0) {
      setSelectedProvs(wilayahFilter.map(p => ({ value: p, label: p })));
    } else {
      setSelectedProvs([]);
    }
  }, [wilayahFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'rs_profiles', globalMonth, globalDrg)
    ])
      .then(([hospData, profData]) => {
        setHospitalsData(hospData);
        setRsProfilesData(profData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [dataset]);

  const handleSliderChange = (serviceKey, level, value) => {
    let v = parseInt(value, 10);
    if (isNaN(v)) v = 0;
    if (v > 100) v = 100;
    if (v < 0) v = 0;
    
    if (serviceKey === 'GLOBAL') {
      setCustomGlobalMarketShare(prev => ({ ...prev, [level]: v }));
    } else {
      setCustomServiceMarketShare(prev => ({
        ...prev,
        [serviceKey]: {
          ...(prev[serviceKey] || {}),
          [level]: v
        }
      }));
    }
  };

  const handleMapRegionClick = (p) => {
    if (p === null) {
      setSelectedMapProvinces([]);
    } else {
      setSelectedMapProvinces(prev => {
        if (prev.includes(p)) return prev.filter(x => x !== p);
        if (prev.length >= 5) return prev;
        return [...prev, p];
      });
    }
    setSelectedMapHospital(null);
  };

  const handleMapMarkerClick = (rs) => {
    setSelectedMapHospital(rs);
  };

  const handleExportPPT = async () => {
    setIsExportingPPT(true);
    try {
      let title = selectedMapProvinces.length > 0 ? selectedMapProvinces.join(', ') : 'Global';
      if (selectedMapHospital) {
        title = selectedMapHospital.nama;
      }
      // Kita kirimkan rData mentah agar dapat digambar native PPTX
      const regionDataRaw = combinedRegionData; 
      const topHospitals = regionDataRaw ? [...regionDataRaw.rsList].sort((a,b) => b.kasus - a.kasus).slice(0, 10) : [];
      await exportMapRegionToPPTX(title, { 
        type: 'native', 
        selectedProvinces: selectedMapProvinces, 
        regionalData: regionDataRaw, 
        topHospitals: topHospitals,
        rsProfilesData: rsProfilesData,
        simulasi: simulasi
      });
    } catch (e) {
      console.error(e);
      alert('Gagal mengekspor PPT. Coba lagi.');
    } finally {
      setIsExportingPPT(false);
    }
  };

  if (loading || !hospitalsData) {
  
  return (

      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Data Rumah Sakit...</span>
      </div>
    );
  }

  // 1. Identify Target Hospital
  let targetHospital = null;
  let targetKode = null;

  const activeRsFilter = localTargetRs ? localTargetRs.value : rsFilter;

  if (activeRsFilter === 'ALL') {
    targetKode = 'ALL';
    targetHospital = { nama: 'Semua RS (Agregat)' };
  } else if (activeRsFilter) {
    const filterLower = activeRsFilter.toLowerCase();
    for (const [kode, rs] of Object.entries(hospitalsData)) {
      if ((rs.nama && rs.nama.toLowerCase().includes(filterLower)) || kode.toLowerCase().includes(filterLower)) {
        targetHospital = rs;
        targetKode = kode;
        break; // Pick the first match
      }
    }
  }

  const validLevels = ['dasar', 'madya', 'utama', 'paripurna'];
  const levelWeights = {
    paripurna: 1.00,
    utama: 0.85,
    madya: 0.75,
    dasar: 0.65
  };

  const isVirtual = !targetHospital;
  if (isVirtual) {
    targetHospital = {
      nama: "Simulasi Nasional/Regional Bebas",
      kasus: 0,
      inacbg: 0
    };
    targetKode = "VIRTUAL_RS";
  }

  const simulasiKey = `tarif_${simulasi}`;

  // 2. Identify Available Provinces and Kabupaten for the selected Province
  const availableProvs = new Set();
  const availableKabs = new Set();
  Object.entries(hospitalsData).forEach(([kode, rs]) => {
    if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;

    if (true) {
      if (rs.prop) availableProvs.add(rs.prop);
      if (selectedProvs.length > 0) {
         if (selectedProvs.some(p => p.value === rs.prop) && rs.kab) {
            availableKabs.add(rs.kab);
         }
      } else {
         if (rs.kab) availableKabs.add(rs.kab);
      }
    }
  });
  const provOptions = Array.from(availableProvs).sort().map(p => ({ value: p, label: p }));
  const kabOptions = Array.from(availableKabs).sort().map(k => ({ 
    value: k, 
    label: (k && k.toLowerCase() === 'others') ? 'Lain-lain' : k 
  }));

  // 3. Aggregate Regional Market
  const regionalStats = {
    paripurna: { kasus: 0, inacbg: 0, idrg: 0 },
    utama: { kasus: 0, inacbg: 0, idrg: 0 },
    madya: { kasus: 0, inacbg: 0, idrg: 0 },
    dasar: { kasus: 0, inacbg: 0, idrg: 0 },
    unclassified: { kasus: 0, inacbg: 0, idrg: 0 }
  };

  const serviceMap = {};
  const initService = (k) => {
    if (!serviceMap[k]) {
      serviceMap[k] = {
        regKasus: { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 },
        regInacbg: { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 },
        regIdrg: { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 },
        existKasus: { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 },
        existInacbg: { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 },
        existIdrg: { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 }
      };
    }
  };

  let totalRegionalHospitals = 0;
  
  let existingKasus = 0;
  let existingInacbg = 0;
  let existingIdrg = 0;
  const targetBreakdown = {
    dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0
  };

  Object.entries(hospitalsData).forEach(([kode, rs]) => {
    let localDropdownMatch = true;
    if (selectedProvs.length > 0 && !selectedProvs.some(p => p.value === rs.prop)) localDropdownMatch = false;
    if (selectedKabs.length > 0 && !selectedKabs.some(k => k.value === rs.kab)) localDropdownMatch = false;

    if (!localDropdownMatch) return;
    if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;

    totalRegionalHospitals++;
    const pScore = rsProfilesData[kode]?.scorecard;
    const pSvc = rsProfilesData[kode]?.svc;
    
    // --- 1. Regional Market Aggregation (UNFILTERED by Group) ---
    if (pScore) {
      Object.entries(pScore.byKompetensi).forEach(([komp, data]) => {
        const k = komp.toLowerCase();
        if (excludeNonKomp && (k.includes('belum ada') || k.includes('unknown') || k.includes('unclassified') || k === 'n/a')) return;
        if (regionalStats[k]) {
          regionalStats[k].kasus += (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
          regionalStats[k].inacbg += (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
          regionalStats[k].idrg += (data.sesuai?.[simulasiKey] || 0) + (data.loss?.[simulasiKey] || 0);
        } else {
          regionalStats.unclassified.kasus += (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
          regionalStats.unclassified.inacbg += (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
          regionalStats.unclassified.idrg += (data.sesuai?.[simulasiKey] || 0) + (data.loss?.[simulasiKey] || 0);
        }
      });
    } else {
      regionalStats.unclassified.kasus += (rs.kasus || 0);
      regionalStats.unclassified.inacbg += (rs.inacbg || 0);
      regionalStats.unclassified.idrg += (rs[simulasiKey] || 0);
    }
    
    if (pSvc) {
      Object.entries(pSvc).forEach(([kelompok, ptds]) => {
        initService(kelompok);
        Object.values(ptds).forEach(komps => {
          Object.entries(komps).forEach(([kompKey, arr]) => {
             const k = kompKey.toLowerCase().replace('belum ada komp. icd', 'unclassified');
             const validK = ['dasar', 'madya', 'utama', 'paripurna'].includes(k) ? k : 'unclassified';
             serviceMap[kelompok].regKasus[validK] += arr[0] || 0;
             serviceMap[kelompok].regInacbg[validK] += arr[1] || 0;
             serviceMap[kelompok].regIdrg[validK] += arr[1 + parseInt(simulasi)] || 0;
          });
        });
      });
    }

    // --- 2. Existing Target Aggregation (FILTERED by Group & TargetKode) ---
    // groupFilter is already handled above in filterHospital for the region. Wait!
    // The previous code had UNFILTERED regional market (by group), and FILTERED target!
    // BUT the new Exclude Mode means we exclude across everything!
    // If the user selects a group, they WANT to see ONLY that group.
    // wait, line 326 of old code: `const matchesGroupFilter = !(groupFilter && !matchesGroup(groupFilter, rs.nama, kode, rs));`
    // If I used filterHospital, it ALREADY filtered by groupFilter!
    // So `matchesGroupFilter` is naturally true here.
    const matchesGroupFilter = true;
    if (!matchesGroupFilter) return;

    const isTarget = targetKode === 'ALL' ? true : (kode === targetKode);
    if (isTarget) {
      existingKasus += rs.kasus || 0;
      existingInacbg += rs.inacbg || 0;
      existingIdrg += rs[simulasiKey] || 0;

      if (pScore) {
        Object.entries(pScore.byKompetensi).forEach(([komp, data]) => {
          const k = komp.toLowerCase();
          if (targetBreakdown[k] !== undefined) {
            targetBreakdown[k] += (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
          } else {
            targetBreakdown.unclassified += (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
          }
        });
      }

      if (pSvc) {
        Object.entries(pSvc).forEach(([kelompok, ptds]) => {
          initService(kelompok);
          Object.values(ptds).forEach(komps => {
            Object.entries(komps).forEach(([kompKey, arr]) => {
               const k = kompKey.toLowerCase().replace('belum ada komp. icd', 'unclassified');
               const validK = ['dasar', 'madya', 'utama', 'paripurna'].includes(k) ? k : 'unclassified';
               serviceMap[kelompok].existKasus[validK] += arr[0] || 0;
               serviceMap[kelompok].existInacbg[validK] += arr[1] || 0;
               serviceMap[kelompok].existIdrg[validK] += arr[1 + parseInt(simulasi)] || 0;
            });
          });
        });
      }
    }
  });

  const regionalTotalKasus = regionalStats.dasar.kasus + regionalStats.madya.kasus + regionalStats.utama.kasus + regionalStats.paripurna.kasus + regionalStats.unclassified.kasus;
  const regionalTotalInacbg = regionalStats.dasar.inacbg + regionalStats.madya.inacbg + regionalStats.utama.inacbg + regionalStats.paripurna.inacbg + regionalStats.unclassified.inacbg;
  const regionalTotalIdrg = regionalStats.dasar.idrg + regionalStats.madya.idrg + regionalStats.utama.idrg + regionalStats.paripurna.idrg + regionalStats.unclassified.idrg;

  // --- Calculate Default Market Shares based on existing cases ---
  const getTargetMarketShare = (exist, reg) => reg > 0 ? Math.round((exist / reg) * 100) : 0;

  const defaultGlobalMarketShare = {
    dasar: getTargetMarketShare(targetBreakdown.dasar, regionalStats.dasar.kasus),
    madya: getTargetMarketShare(targetBreakdown.madya, regionalStats.madya.kasus),
    utama: getTargetMarketShare(targetBreakdown.utama, regionalStats.utama.kasus),
    paripurna: getTargetMarketShare(targetBreakdown.paripurna, regionalStats.paripurna.kasus)
  };

  const globalMarketShare = { ...defaultGlobalMarketShare, ...customGlobalMarketShare };

  const getServiceMarketShare = (kelompok) => {
    const s = serviceMap[kelompok];
    if (!s) return globalMarketShare;
    
    const defaultSvc = {
      dasar: getTargetMarketShare(s.existKasus.dasar, s.regKasus.dasar),
      madya: getTargetMarketShare(s.existKasus.madya, s.regKasus.madya),
      utama: getTargetMarketShare(s.existKasus.utama, s.regKasus.utama),
      paripurna: getTargetMarketShare(s.existKasus.paripurna, s.regKasus.paripurna)
    };
    
    const finalSvc = {};
    validLevels.forEach(lvl => {
      if (customServiceMarketShare[kelompok] && customServiceMarketShare[kelompok][lvl] !== undefined) {
        finalSvc[lvl] = customServiceMarketShare[kelompok][lvl];
      } else if (customGlobalMarketShare[lvl] !== undefined) {
        finalSvc[lvl] = customGlobalMarketShare[lvl];
      } else {
        finalSvc[lvl] = defaultSvc[lvl];
      }
    });
    
    return finalSvc;
  };

  // 5. Build Table Data (Aggregated per Service first)
  const serviceTableData = Object.keys(serviceMap).sort().map(kelompok => {
    const s = serviceMap[kelompok];
    let capturedKasus = 0;
    let capturedIdrg = 0;
    let regTotalKasus = 0;
    let existTotalKasus = 0;
    let existTotalInacbg = 0;
    const capturedKasusRinci = { dasar: 0, madya: 0, utama: 0, paripurna: 0 };

    const activeRates = getServiceMarketShare(kelompok);
    validLevels.forEach(lvl => {
       const rate = activeRates[lvl] / 100;
       
       const capKasusLvl = s.regKasus[lvl] * rate;
       capturedKasus += capKasusLvl;
       capturedKasusRinci[lvl] = capKasusLvl;
       capturedIdrg += s.regIdrg[lvl] * rate; // Multiplier is exactly 1
       
       regTotalKasus += s.regKasus[lvl];
       existTotalKasus += s.existKasus[lvl];
       existTotalInacbg += s.existInacbg[lvl];
    });

    regTotalKasus += s.regKasus.unclassified;
    existTotalKasus += s.existKasus.unclassified;
    existTotalInacbg += s.existInacbg.unclassified;

    const growthKasus = capturedKasus - existTotalKasus;
    
    return {
       kelompok,
       s,
       regTotalKasus,
       existTotalKasus,
       existTotalInacbg,
       capturedKasus,
       capturedKasusRinci,
       capturedIdrg,
       growthKasus
    };
  });

  const filteredServiceTableData = serviceTableData.filter(s => s.regTotalKasus > 0 || s.existTotalKasus > 0);

  // Aggregate totals per level across all valid services
  const aggregatedLevels = {
    dasar: { capturedKasus: 0, capturedIdrg: 0, existKasus: 0, existInacbg: 0, regKasus: 0, regIdrg: 0 },
    madya: { capturedKasus: 0, capturedIdrg: 0, existKasus: 0, existInacbg: 0, regKasus: 0, regIdrg: 0 },
    utama: { capturedKasus: 0, capturedIdrg: 0, existKasus: 0, existInacbg: 0, regKasus: 0, regIdrg: 0 },
    paripurna: { capturedKasus: 0, capturedIdrg: 0, existKasus: 0, existInacbg: 0, regKasus: 0, regIdrg: 0 },
  };

  filteredServiceTableData.forEach(row => {
    const activeRates = getServiceMarketShare(row.kelompok);
    validLevels.forEach(lvl => {
       const rate = activeRates[lvl] / 100;
       
       aggregatedLevels[lvl].regKasus += row.s.regKasus[lvl];
       aggregatedLevels[lvl].regIdrg += row.s.regIdrg[lvl];
       aggregatedLevels[lvl].capturedKasus += row.s.regKasus[lvl] * rate;
       aggregatedLevels[lvl].capturedIdrg += row.s.regIdrg[lvl] * rate;
       aggregatedLevels[lvl].existKasus += row.s.existKasus[lvl];
       aggregatedLevels[lvl].existInacbg += row.s.existInacbg[lvl];
    });
  });

  const tableData = [...validLevels].map(lvl => {
    const regKasus = regionalStats[lvl].kasus;
    const targetP = regKasus > 0 ? ((aggregatedLevels[lvl].capturedKasus / regKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0;
    return {
      lvlLabel: lvl.charAt(0).toUpperCase() + lvl.slice(1),
      regKasus: regKasus,
      capturedKasus: aggregatedLevels[lvl].capturedKasus,
      capturedIdrg: aggregatedLevels[lvl].capturedIdrg,
      existKasus: aggregatedLevels[lvl].existKasus,
      existInacbg: aggregatedLevels[lvl].existInacbg,
      growthKasus: aggregatedLevels[lvl].capturedKasus - aggregatedLevels[lvl].existKasus,
      targetP: targetP
    };
  });

  const chartData = validLevels.map(lvl => {
    return {
      name: lvl.charAt(0).toUpperCase() + lvl.slice(1),
      'Total Potensi Regional (iDRG)': regionalStats[lvl].idrg,
      'Serapan Target RS (iDRG)': aggregatedLevels[lvl].capturedIdrg,
      'Kasus Regional': regionalStats[lvl].kasus,
      'Kasus Diserap': aggregatedLevels[lvl].capturedKasus
    };
  });

  const grandTotalRegKasus = filteredServiceTableData.reduce((acc, row) => acc + row.regTotalKasus, 0);
  const grandTotalTargetKasus = filteredServiceTableData.reduce((acc, row) => acc + row.capturedKasus, 0);
  const grandTotalTargetIdrg = filteredServiceTableData.reduce((acc, row) => acc + row.capturedIdrg, 0);
  const grandTotalExistKasus = filteredServiceTableData.reduce((acc, row) => acc + row.existTotalKasus, 0);
  const grandTotalGrowthKasus = grandTotalTargetKasus - grandTotalExistKasus;
  const idrgDiff = grandTotalTargetIdrg - existingIdrg;



  const top5Services = [...filteredServiceTableData]
    .filter(a => a.kelompok.toLowerCase() !== 'unknown')
    .sort((a, b) => b.capturedIdrg - a.capturedIdrg).slice(0, 5);

  const sortedServiceTableData = [...filteredServiceTableData].sort((a, b) => {
    const isAUnknown = a.kelompok.toLowerCase() === 'unknown';
    const isBUnknown = b.kelompok.toLowerCase() === 'unknown';
    if (isAUnknown && !isBUnknown) return 1;
    if (!isAUnknown && isBUnknown) return -1;
    return a.kelompok.localeCompare(b.kelompok);
  });

  const top5ChartData = top5Services.map(s => ({
     name: s.kelompok,
     'Potensi iDRG': s.capturedIdrg
  }));

  const top1 = top5Services[0];
  const insightText = top1 
    ? `Berdasarkan simulasi persentase serapan Anda, layanan **${top1.kelompok}** menjadi penyumbang potensi pendapatan baru tertinggi mencapai **${formatCurrency(top1.capturedIdrg)}**, dengan proyeksi penambahan sebesar **${(top1.growthKasus).toLocaleString('en-US', {maximumFractionDigits:0})} kasus** dari kapasitas saat ini. Fokus pengembangan kompetensi dan pemasaran di area ini akan memberikan dampak finansial yang sangat signifikan.`
    : '';

  const serviceTotals = {
    existTotalKasus: 0,
    existDasar: 0, existMadya: 0, existUtama: 0, existParipurna: 0,
    existTotalInacbg: 0,
    regTotalKasus: 0,
    regDasar: 0, regMadya: 0, regUtama: 0, regParipurna: 0,
    capturedKasus: 0,
    capturedDasar: 0, capturedMadya: 0, capturedUtama: 0, capturedParipurna: 0,
    capturedIdrg: 0,
    growthKasus: 0
  };

  sortedServiceTableData.forEach(row => {
    serviceTotals.existTotalKasus += row.existTotalKasus;
    serviceTotals.existDasar += row.s.existKasus.dasar;
    serviceTotals.existMadya += row.s.existKasus.madya;
    serviceTotals.existUtama += row.s.existKasus.utama;
    serviceTotals.existParipurna += row.s.existKasus.paripurna;
    serviceTotals.existTotalInacbg += row.existTotalInacbg;

    serviceTotals.regTotalKasus += row.regTotalKasus;
    serviceTotals.regDasar += row.s.regKasus.dasar;
    serviceTotals.regMadya += row.s.regKasus.madya;
    serviceTotals.regUtama += row.s.regKasus.utama;
    serviceTotals.regParipurna += row.s.regKasus.paripurna;

    serviceTotals.capturedKasus += row.capturedKasus;
    serviceTotals.capturedDasar += row.capturedKasusRinci.dasar;
    serviceTotals.capturedMadya += row.capturedKasusRinci.madya;
    serviceTotals.capturedUtama += row.capturedKasusRinci.utama;
    serviceTotals.capturedParipurna += row.capturedKasusRinci.paripurna;
    serviceTotals.capturedIdrg += row.capturedIdrg;
    serviceTotals.growthKasus += row.growthKasus;
  });

  // --- Compute regionsMapData for Map ---
  const regionsMapData = {};
  Object.entries(hospitalsData).forEach(([kode, rs]) => {
     let matchesWilayah = filterHospital(rs, kode, groupFilter, selectedProvs.length > 0 ? selectedProvs.map(p => p.value) : wilayahFilter, rsFilter, false, selectedKabs.length > 0 ? selectedKabs.map(k => k.value) : kabFilter, false);
     
     if (!matchesWilayah) return;

     if (!rs.prop) return;

     if (!regionsMapData[rs.prop]) {
       regionsMapData[rs.prop] = { kasus: 0, inacbg: 0, sim: 0, selisih: 0, rsList: [] };
     }
     regionsMapData[rs.prop].kasus += rs.kasus || 0;
     regionsMapData[rs.prop].inacbg += rs.inacbg || 0;
     regionsMapData[rs.prop].sim += rs[simulasiKey] || 0;
     regionsMapData[rs.prop].selisih += (rs[simulasiKey] || 0) - (rs.inacbg || 0);

     const pScore = rsProfilesData[kode]?.scorecard;
     let lvlKasus = { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 };
     let lvlInacbg = { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 };
     
     if (pScore) {
       Object.entries(pScore.byKompetensi).forEach(([komp, data]) => {
         const k = komp.toLowerCase();
         if (lvlKasus[k] !== undefined) {
           lvlKasus[k] += (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
           lvlInacbg[k] += (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
         } else {
           lvlKasus.unclassified += (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
           lvlInacbg.unclassified += (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
         }
       });
     } else {
       lvlKasus.unclassified = rs.kasus || 0;
       lvlInacbg.unclassified = rs.inacbg || 0;
     }

      regionsMapData[rs.prop].rsList.push({
        kode,
        nama: rs.nama,
        kelas: rs.kelasFaskes,
        faskesKomp: rs.faskesKomp,
        kasus: rs.kasus || 0,
        inacbg: rs.inacbg || 0,
        sim: rs[simulasiKey] || 0,
        byKelompok: rs.byKelompok,
        lvlKasus,
        lvlInacbg
      });
  });

  let combinedRegionData = null;
  if (selectedMapProvinces.length > 0) {
    const rData = { kasus: 0, inacbg: 0, sim: 0, selisih: 0, rsList: [] };
    selectedMapProvinces.forEach(p => {
       const pd = regionsMapData[p];
       if (pd) {
         rData.kasus += pd.kasus || 0;
         rData.inacbg += pd.inacbg || 0;
         rData.sim += pd.sim || 0;
         rData.selisih += pd.selisih || 0;
         rData.rsList.push(...(pd.rsList || []));
       }
    });
    combinedRegionData = rData;
  }

  return (
    <div className="simulasi-container animate-fade-in-up">
      <header className="simulasi-header">
        <h1>Simulasi Serapan Pasar (Market Share)</h1>
        <p>
          Menganalisis potensi pendapatan <strong>{targetHospital.nama}</strong> jika berhasil menyerap sekian persen kasus dari total keseluruhan pasar di tingkat regional.
        </p>
      </header>

      {Object.keys(regionsMapData).length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div id="export-map-container" className="card glass-panel" style={{ marginBottom: '24px' }}>
            <MapIndonesia 
              regionsData={regionsMapData} 
              metric="selisih" 
              simulasi={simulasi} 
              onRegionClick={handleMapRegionClick} 
              onMarkerClick={handleMapMarkerClick}
              onExport={handleExportPPT}
              isExporting={isExportingPPT}
              selectedProvinces={selectedMapProvinces}
            />
          </div>
          
          <HospitalProfileCard 
            rs={selectedMapHospital} 
            profile={selectedMapHospital ? rsProfilesData[selectedMapHospital.kode] : null}
            simulasi={simulasi}
            excludeNonKomp={excludeNonKomp}
            onClose={() => setSelectedMapHospital(null)}
            rsKompetensiOnline={rsKompetensiOnline}
          />

          {selectedMapProvinces.length > 0 && !selectedMapHospital && combinedRegionData && (() => {
            const rData = combinedRegionData;
            const classCounts = { A: 0, B: 0, C: 0, D: 0, Lainya: 0 };
            const levelStats = {
              dasar: { kasus: 0, inacbg: 0 },
              madya: { kasus: 0, inacbg: 0 },
              utama: { kasus: 0, inacbg: 0 },
              paripurna: { kasus: 0, inacbg: 0 },
              unclassified: { kasus: 0, inacbg: 0 }
            };

            rData.rsList.forEach(rs => {
              const kl = (rs.kelas || '').toUpperCase();
              if (['A','B','C','D'].includes(kl)) classCounts[kl]++;
              else classCounts['Lainya']++;

              ['dasar', 'madya', 'utama', 'paripurna', 'unclassified'].forEach(lvl => {
                levelStats[lvl].kasus += rs.lvlKasus?.[lvl] || 0;
                levelStats[lvl].inacbg += rs.lvlInacbg?.[lvl] || 0;
              });
            });

            const topRs = [...rData.rsList].sort((a,b) => b.kasus - a.kasus).slice(0, 5);
            const titleName = selectedMapProvinces.join(', ');

            return (
              <div id="export-region-profile" data-rs-name={titleName} className="card glass-panel animate-fade-in-up" style={{ marginTop: '24px', borderTop: '4px solid #3b82f6' }}>
                <div data-html2canvas-ignore="true" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Detail Regional: {titleName}</h3>
                  <button 
                    onClick={() => setSelectedMapProvinces([])} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}
                  >&times;</button>
                </div>
                
                <div className="grid-3" style={{ gap: '20px' }}>
                  {/* Kolom 1: Sebaran Kelas RS */}
                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Sebaran Kelas RS Aktif</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {['A', 'B', 'C', 'D'].map(kls => classCounts[kls] > 0 && (
                        <div key={kls} style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', padding: '8px 12px', borderRadius: '6px', textAlign: 'center', flex: '1 1 40%' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kelas {kls}</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{classCounts[kls]} <span style={{ fontSize: '0.75rem', fontWeight: 'normal'}}>RS</span></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kolom 2: Rincian Level Kompetensi */}
                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Rincian Tingkat Kompetensi</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                      {Object.entries(levelStats).map(([lvl, stats]) => stats.kasus > 0 && (
                        <div key={lvl} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '4px' }}>
                          <span style={{ textTransform: 'capitalize' }}>{lvl}</span>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600 }}>{stats.kasus.toLocaleString('en-US')} Kasus</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatCompactCurrency(stats.inacbg)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kolom 3: Top 5 RS */}
                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Top 5 Rumah Sakit</h4>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {topRs.map((rs, idx) => (
                        <li key={idx} style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', borderLeft: `3px solid ${idx===0 ? '#f59e0b' : idx===1 ? '#94a3b8' : idx===2 ? '#cd7f32' : '#cbd5e1'}` }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rs.nama}>{rs.nama}</div>
                            {rs.kelas && <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>KLS {rs.kelas.toUpperCase()}</span>}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: 'var(--text-secondary)' }}>
                            <span>{rs.kasus.toLocaleString('en-US')} Kasus</span>
                            <span>{formatCompactCurrency(rs.inacbg)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="simulasi-grid">
        {/* Left Column: Controls */}
        <div className="simulasi-controls glass-panel" style={{ background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#00B1A0', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>1</div>
              <h3 style={{ color: '#00B1A0', margin: 0, fontSize: '1.1rem' }}>Target Rumah Sakit</h3>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Cari & Pilih RS Target (Lokal):</label>
              <Select 
                isClearable
                value={localTargetRs}
                onChange={setLocalTargetRs}
                options={localRsOptions}
                placeholder={rsFilter ? "Menggunakan Filter Global..." : "Kosongkan untuk Simulasi Bebas..."}
                menuPortalTarget={document.body}
                styles={{
                  control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px', borderColor: '#cbd5e1', fontSize: '0.9rem' }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  menu: (base) => ({ ...base, fontSize: '0.9rem', zIndex: 9999 })
                }}
              />
            </div>

            <div style={{ padding: '12px', background: isVirtual ? '#f1f5f9' : '#f0fdfa', borderRadius: '8px', border: `1px solid ${isVirtual ? '#cbd5e1' : '#ccfbf1'}` }}>
              <p style={{ fontWeight: 600, fontSize: '1.05rem', margin: 0, color: isVirtual ? '#334155' : '#00B1A0' }}>{targetHospital.nama}</p>
            </div>
          </div>

          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#0284c7', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>2</div>
              <h3 style={{ color: '#0284c7', margin: 0, fontSize: '1.1rem' }}>Lingkup Wilayah</h3>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Filter Provinsi (Regional):</label>
              <Select 
                isMulti
                value={selectedProvs}
                onChange={v => {
                  setSelectedProvs(v || []);
                  // Optional: clear kabs when prov changes? We'll leave it as is so it naturally filters invalid ones
                  setSelectedKabs([]); 
                }}
                options={provOptions}
                placeholder="Semua Provinsi (Sesuai Filter Global)..."
                menuPortalTarget={document.body}
                styles={{
                  control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px', borderColor: '#cbd5e1', fontSize: '0.9rem' }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  menu: (base) => ({ ...base, fontSize: '0.9rem', zIndex: 9999 })
                }}
              />
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Filter Kab/Kota:</label>
              <Select 
                isMulti
                value={selectedKabs}
                onChange={v => setSelectedKabs(v || [])}
                options={kabOptions}
                placeholder={selectedProvs.length > 0 ? "Semua Kab/Kota di Provinsi Terpilih..." : "Semua Kab/Kota..."}
                menuPortalTarget={document.body}
                styles={{
                  control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px', borderColor: '#cbd5e1', fontSize: '0.9rem' }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  menu: (base) => ({ ...base, fontSize: '0.9rem', zIndex: 9999 })
                }}
              />
            </div>

            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
              Total <strong>{totalRegionalHospitals} RS</strong> tergabung dalam kolam wilayah ini.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#8b5cf6', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>3</div>
              <h3 style={{ color: '#8b5cf6', margin: 0, fontSize: '1.1rem' }}>Target Serapan Kasus (%)</h3>
            </div>
            <p className="help-text" style={{ marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Tentukan target persentase serapan. Ubah di baris <strong>Global</strong> untuk merubah semua sekaligus, atau isi pada baris spesifik per-layanan untuk kustomisasi presisi.
            </p>
            
            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 2, borderBottom: '2px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', color: '#475569' }}>Layanan</th>
                    {validLevels.map(lvl => <th key={lvl} style={{ padding: '8px', textAlign: 'center', textTransform: 'capitalize', color: '#475569' }}>{lvl}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #cbd5e1', position: 'sticky', top: '35px', zIndex: 1 }}>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: '#16a34a' }}>Semua (Global)</td>
                    {validLevels.map(lvl => (
                      <td key={lvl} style={{ padding: '8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input 
                            type="number" min="0" max="100"
                            value={globalMarketShare[lvl]}
                            onChange={e => handleSliderChange('GLOBAL', lvl, e.target.value)}
                            style={{ width: '45px', padding: '4px', textAlign: 'center', border: '1px solid #16a34a', borderRadius: '4px', fontWeight: 'bold' }}
                          /> <span style={{marginLeft: '2px', color: '#16a34a'}}>%</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                  {Object.keys(serviceMap).sort().map(kelompok => (
                    <tr key={kelompok} style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#334155' }}>{kelompok}</td>
                      {validLevels.map(lvl => {
                        const svcRates = getServiceMarketShare(kelompok);
                        const isCustom = (customServiceMarketShare[kelompok] && customServiceMarketShare[kelompok][lvl] !== undefined) || (customGlobalMarketShare[lvl] !== undefined);
                        const val = svcRates[lvl];
                        return (
                          <td key={lvl} style={{ padding: '8px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <input 
                                type="number" min="0" max="100"
                                value={val}
                                onChange={e => handleSliderChange(kelompok, lvl, e.target.value)}
                                style={{ width: '45px', padding: '4px', textAlign: 'center', border: `1px solid ${isCustom ? '#0ea5e9' : '#cbd5e1'}`, borderRadius: '4px', background: isCustom ? '#f0f9ff' : '#fff', color: isCustom ? '#0284c7' : 'inherit' }}
                              /> <span style={{marginLeft: '2px', color: isCustom ? '#0284c7' : '#94a3b8'}}>%</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="simulasi-results">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div className="card-sim" style={{ borderLeft: '4px solid #8b5cf6' }}>
              <h5>Total Kasus Regional</h5>
              <h2 style={{ color: '#6d28d9', fontSize: '1.5rem' }}>{regionalTotalKasus.toLocaleString('en-US')} Kasus</h2>
              
              <div style={{ marginTop: '12px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom: '4px'}}><span>Pend. Eksisting Regional:</span> <strong style={{color: '#334155'}}>{formatCurrency(regionalTotalInacbg)}</strong></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Potensi iDRG Regional:</span> <strong style={{color: '#8b5cf6'}}>{formatCurrency(regionalTotalIdrg)}</strong></div>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.875rem' }}>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Dasar:</span> <span>{regionalStats.dasar.kasus.toLocaleString('en-US')} ({regionalTotalKasus ? ((regionalStats.dasar.kasus/regionalTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Madya:</span> <span>{regionalStats.madya.kasus.toLocaleString('en-US')} ({regionalTotalKasus ? ((regionalStats.madya.kasus/regionalTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Utama:</span> <span>{regionalStats.utama.kasus.toLocaleString('en-US')} ({regionalTotalKasus ? ((regionalStats.utama.kasus/regionalTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Paripurna:</span> <span>{regionalStats.paripurna.kasus.toLocaleString('en-US')} ({regionalTotalKasus ? ((regionalStats.paripurna.kasus/regionalTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between', color:'var(--text-muted)', paddingTop: '4px', borderTop: '1px dashed #e2e8f0', marginTop: '4px'}}><span>Belum Diklasifikasi:</span> <span>{regionalStats.unclassified.kasus.toLocaleString('en-US')} ({regionalTotalKasus ? ((regionalStats.unclassified.kasus/regionalTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
              </div>
            </div>
            <div className="card-sim" style={{ borderLeft: '4px solid #f59e0b' }}>
              <h5>Pendapatan INA-CBG {targetHospital.nama || 'Eksisting'}</h5>
              <h2 style={{ color: '#b45309', fontSize: '1.5rem' }}>{formatCurrency(existingInacbg)}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>Dari {existingKasus.toLocaleString('en-US')} Kasus RS</p>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#64748b' }}>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Dasar:</span> <span>{targetBreakdown.dasar.toLocaleString('en-US')} ({existingKasus ? ((targetBreakdown.dasar/existingKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Madya:</span> <span>{targetBreakdown.madya.toLocaleString('en-US')} ({existingKasus ? ((targetBreakdown.madya/existingKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Utama:</span> <span>{targetBreakdown.utama.toLocaleString('en-US')} ({existingKasus ? ((targetBreakdown.utama/existingKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Paripurna:</span> <span>{targetBreakdown.paripurna.toLocaleString('en-US')} ({existingKasus ? ((targetBreakdown.paripurna/existingKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
              </div>
            </div>
            <div className="card-sim" style={{ borderLeft: '4px solid #0ea5e9' }}>
              <h5>Pendapatan iDRG {targetHospital.nama || 'Eksisting'}</h5>
              <h2 style={{ color: '#0369a1', fontSize: '1.5rem' }}>{formatCurrency(existingIdrg)}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>Dari {existingKasus.toLocaleString('en-US')} Kasus RS</p>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#64748b' }}>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Dasar:</span> <span>{targetBreakdown.dasar.toLocaleString('en-US')} ({existingKasus ? ((targetBreakdown.dasar/existingKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Madya:</span> <span>{targetBreakdown.madya.toLocaleString('en-US')} ({existingKasus ? ((targetBreakdown.madya/existingKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Utama:</span> <span>{targetBreakdown.utama.toLocaleString('en-US')} ({existingKasus ? ((targetBreakdown.utama/existingKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span>Paripurna:</span> <span>{targetBreakdown.paripurna.toLocaleString('en-US')} ({existingKasus ? ((targetBreakdown.paripurna/existingKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)</span></div>
              </div>
            </div>
            <div className="card-sim highlight">
              <h5>Pendapatan Simulasi (Market Share)</h5>
              <h2 style={{fontSize: '1.5rem'}}>{formatCurrency(grandTotalTargetIdrg)}</h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', marginTop: '8px' }}>Dari {grandTotalTargetKasus.toLocaleString('en-US', {maximumFractionDigits:0})} Kasus Terserap</p>
              
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} />
                <span>Selisih: <strong>{idrgDiff > 0 ? '+' : ''}{formatCurrency(idrgDiff)}</strong></span>
              </div>
            </div>
          </div>

          <div className="chart-panel glass-panel">
            <h3>Porsi Serapan iDRG dari Total Regional</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Grafik membandingkan total potensi pendapatan di wilayah vs jumlah yang berhasil diserap oleh {targetHospital.nama}.
            </p>
            <div style={{ width: '100%', height: 350, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(val) => `Rp ${(val/1000000000).toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} M`} width={100} />
                  <RechartsTooltip 
                    formatter={(val, name) => [formatCurrency(val), name]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="Total Potensi Regional (iDRG)" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Serapan Target RS (iDRG)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-panel glass-panel" style={{ marginTop: '24px' }}>
            <h3>Top 5 Layanan dengan Potensi Pendapatan Terbesar</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              <span dangerouslySetInnerHTML={{ __html: insightText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </p>
            <div style={{ width: '100%', height: 350, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={top5ChartData} layout="vertical" margin={{ top: 20, right: 30, left: 160, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                  <XAxis type="number" tickFormatter={(val) => `Rp ${(val/1000000000).toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} M`} />
                  <YAxis type="category" dataKey="name" width={160} tick={{fontSize: 11, fill: 'var(--text-secondary)'}} />
                  <RechartsTooltip 
                    formatter={(val) => [formatCurrency(val), 'Potensi iDRG']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="Potensi iDRG" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="table-panel glass-panel" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Tabel Matriks Komparasi Serapan</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rincian perhitungan proyeksi dibandingkan dengan kapasitas/kasus eksisting RS saat ini.</p>
              </div>
              <DownloadExcelButton 
                customExportFn={(pwd) => {
                  const data = [
                    ...tableData.map(r => [
                      r.lvlLabel,
                      r.existKasus,
                      r.existInacbg,
                      r.regKasus,
                      r.targetP + '%',
                      r.capturedKasus, // Keep as raw number if possible, or string format
                      r.capturedIdrg,
                      r.growthKasus
                    ]),
                    ['TOTAL', grandTotalExistKasus, existingInacbg, grandTotalRegKasus, '-', grandTotalTargetKasus, grandTotalTargetIdrg, grandTotalGrowthKasus]
                  ];
                  exportMatriksExcel(data, `Matriks_MarketShare_${(targetHospital.nama || 'Semua_RS').replace(/\s+/g, '_')}.xlsx`, pwd);
                }}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Tingkat Kesulitan (ICD)</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Kasus RS Eksisting</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Total Kasus Regional</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Target Serapan</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Proyeksi Kasus Diserap</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Pendapatan Eksisting (INA-CBG) (Rp Miliar)</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Proyeksi Pendapatan iDRG (Rp Miliar)</th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>Pertumbuhan Kasus</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: row.lvlLabel === 'Belum Diklasifikasi' ? '#f8fafc' : '#fff' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#334155' }}>{row.lvlLabel}</td>
                      <td style={{ padding: '12px 16px' }}>{row.existKasus.toLocaleString('en-US')}</td>
                      <td style={{ padding: '12px 16px' }}>{row.regKasus.toLocaleString('en-US')}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {row.lvlLabel !== 'Belum Diklasifikasi' ? <span className="badge" style={{background: '#e0f2fe', color: '#0369a1'}}>{row.targetP}%</span> : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#00B1A0' }}>{row.capturedKasus.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>{formatTableMiliar(row.existInacbg)}</td>
                      <td style={{ padding: '12px 16px', color: '#0369a1' }}>{formatTableMiliar(row.capturedIdrg)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: row.growthKasus > 0 ? '#16a34a' : (row.growthKasus < 0 ? '#dc2626' : '#64748b') }}>
                        {row.growthKasus > 0 ? '+' : ''}{row.growthKasus.toLocaleString('en-US', {maximumFractionDigits:0})}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                    <td style={{ padding: '16px', color: '#1e293b' }}>TOTAL KESELURUHAN</td>
                    <td style={{ padding: '16px' }}>{grandTotalExistKasus.toLocaleString('en-US')}</td>
                    <td style={{ padding: '16px' }}>{regionalTotalKasus.toLocaleString('en-US')}</td>
                    <td style={{ padding: '16px' }}>-</td>
                    <td style={{ padding: '16px', color: '#00B1A0' }}>{grandTotalTargetKasus.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                    <td style={{ padding: '16px', color: '#334155' }}>{formatTableMiliar(existingInacbg)}</td>
                    <td style={{ padding: '16px', color: '#0369a1' }}>{formatTableMiliar(grandTotalTargetIdrg)}</td>
                    <td style={{ padding: '16px', color: grandTotalGrowthKasus > 0 ? '#16a34a' : (grandTotalGrowthKasus < 0 ? '#dc2626' : '#64748b') }}>
                      {grandTotalGrowthKasus > 0 ? '+' : ''}{grandTotalGrowthKasus.toLocaleString('en-US', {maximumFractionDigits:0})}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-panel glass-panel" style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0 }}>Analisis 24 Layanan (Simulasi Shifting)</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Rincian proyeksi pendapatan berdasarkan 24 layanan KJSU.
                </p>
              </div>
              <DownloadExcelButton 
                customExportFn={(pwd) => {
                  const data = [
                    ...serviceTableData.map(r => {
                      const rates = getServiceMarketShare(r.kelompok);
                      return [
                        r.kelompok,
                        r.existTotalKasus, 
                        `${r.s.existKasus.dasar} (${r.existTotalKasus ? ((r.s.existKasus.dasar/r.existTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`, 
                        `${r.s.existKasus.madya} (${r.existTotalKasus ? ((r.s.existKasus.madya/r.existTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`, 
                        `${r.s.existKasus.utama} (${r.existTotalKasus ? ((r.s.existKasus.utama / r.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                        `${r.s.existKasus.paripurna} (${r.existTotalKasus ? ((r.s.existKasus.paripurna / r.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                        r.regTotalKasus, 
                        `${r.s.regKasus.dasar} (${r.regTotalKasus ? ((r.s.regKasus.dasar/r.regTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`, 
                        `${r.s.regKasus.madya} (${r.regTotalKasus ? ((r.s.regKasus.madya/r.regTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`, 
                        `${r.s.regKasus.utama} (${r.regTotalKasus ? ((r.s.regKasus.utama/r.regTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`, 
                        `${r.s.regKasus.paripurna} (${r.regTotalKasus ? ((r.s.regKasus.paripurna/r.regTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                        r.capturedKasus,
                        `${r.capturedKasusRinci.dasar.toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} (${rates.dasar}%)`,
                        `${r.capturedKasusRinci.madya.toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} (${rates.madya}%)`,
                        `${r.capturedKasusRinci.utama.toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} (${rates.utama}%)`,
                        `${r.capturedKasusRinci.paripurna.toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} (${rates.paripurna}%)`,
                        r.existTotalInacbg,
                        r.capturedIdrg,
                        (r.capturedIdrg - r.existTotalInacbg),
                        `${r.existTotalInacbg ? (((r.capturedIdrg - r.existTotalInacbg) / r.existTotalInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : (r.capturedIdrg - r.existTotalInacbg > 0 ? 100 : 0)}%`,
                        `${r.growthKasus > 0 ? '+' : ''}${r.growthKasus.toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} (${r.existTotalKasus ? ((r.growthKasus/r.existTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : (r.growthKasus > 0 ? 100 : 0)}%)`
                      ];
                    }),
                    [
                      'TOTAL 24 LAYANAN', 
                      serviceTotals.existTotalKasus,
                      `${serviceTotals.existDasar} (${serviceTotals.existTotalKasus ? ((serviceTotals.existDasar/serviceTotals.existTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                      `${serviceTotals.existMadya} (${serviceTotals.existTotalKasus ? ((serviceTotals.existMadya/serviceTotals.existTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                      `${serviceTotals.existUtama} (${serviceTotals.existTotalKasus ? ((serviceTotals.existUtama/serviceTotals.existTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                      `${serviceTotals.existParipurna} (${serviceTotals.existTotalKasus ? ((serviceTotals.existParipurna/serviceTotals.existTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                      serviceTotals.regTotalKasus,
                      `${serviceTotals.regDasar} (${serviceTotals.regTotalKasus ? ((serviceTotals.regDasar/serviceTotals.regTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                      `${serviceTotals.regMadya} (${serviceTotals.regTotalKasus ? ((serviceTotals.regMadya/serviceTotals.regTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                      `${serviceTotals.regUtama} (${serviceTotals.regTotalKasus ? ((serviceTotals.regUtama/serviceTotals.regTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                      `${serviceTotals.regParipurna} (${serviceTotals.regTotalKasus ? ((serviceTotals.regParipurna/serviceTotals.regTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%)`,
                      serviceTotals.capturedTotalKasus,
                      serviceTotals.capturedDasar,
                      serviceTotals.capturedMadya,
                      serviceTotals.capturedUtama,
                      serviceTotals.capturedParipurna,
                      serviceTotals.existTotalInacbg,
                      serviceTotals.capturedIdrg,
                      (serviceTotals.capturedIdrg - serviceTotals.existTotalInacbg),
                      `${serviceTotals.existTotalInacbg ? (((serviceTotals.capturedIdrg - serviceTotals.existTotalInacbg) / serviceTotals.existTotalInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : (serviceTotals.capturedIdrg - serviceTotals.existTotalInacbg > 0 ? 100 : 0)}%`,
                      `${(serviceTotals.capturedTotalKasus - serviceTotals.existTotalKasus) > 0 ? '+' : ''}${(serviceTotals.capturedTotalKasus - serviceTotals.existTotalKasus).toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} (${serviceTotals.existTotalKasus ? (((serviceTotals.capturedTotalKasus - serviceTotals.existTotalKasus)/serviceTotals.existTotalKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : ((serviceTotals.capturedTotalKasus - serviceTotals.existTotalKasus) > 0 ? 100 : 0)}%)`
                    ]
                  ];
                  exportLayananExcel(data, `Simulasi_24Layanan_${(targetHospital.nama || 'Semua_RS').replace(/\s+/g, '_')}.xlsx`, pwd);
                }}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <tr>
                    <th rowSpan={2} style={{ background: '#008080', color: '#fff', padding: '12px 16px', position: 'sticky', left: 0, zIndex: 2 }}>Layanan</th>
                    <th colSpan={5} style={{ background: '#3498db', color: '#fff', padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Kapasitas RS Eksisting</th>
                    <th colSpan={5} style={{ background: '#1abc9c', color: '#fff', padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Pasar Regional</th>
                    <th colSpan={10} style={{ background: '#f39c12', color: '#fff', padding: '8px', textAlign: 'center' }}>Proyeksi (Simulasi Shifting)</th>
                  </tr>
                  <tr>
                    {/* Eksisting */}
                    <th style={{ background: '#2980b9', color: '#fff', padding: '8px', textAlign: 'center' }}>Total</th>
                    <th style={{ background: '#2980b9', color: '#fff', padding: '8px', textAlign: 'center' }}>Dasar</th>
                    <th style={{ background: '#2980b9', color: '#fff', padding: '8px', textAlign: 'center' }}>Madya</th>
                    <th style={{ background: '#2980b9', color: '#fff', padding: '8px', textAlign: 'center' }}>Utama</th>
                    <th style={{ background: '#2980b9', color: '#fff', padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Paripurna</th>
                    {/* Regional */}
                    <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>Total</th>
                    <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>Dasar</th>
                    <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>Madya</th>
                    <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>Utama</th>
                    <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Paripurna</th>
                    {/* Proyeksi */}
                    <th style={{ background: '#d35400', color: '#fff', padding: '8px', textAlign: 'center' }}>Total Diserap</th>
                    <th style={{ background: '#e67e22', color: '#fff', padding: '8px', textAlign: 'center' }}>Dasar</th>
                    <th style={{ background: '#e67e22', color: '#fff', padding: '8px', textAlign: 'center' }}>Madya</th>
                    <th style={{ background: '#e67e22', color: '#fff', padding: '8px', textAlign: 'center' }}>Utama</th>
                    <th style={{ background: '#e67e22', color: '#fff', padding: '8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Paripurna</th>
                    
                    <th style={{ background: '#d35400', color: '#fff', padding: '8px', textAlign: 'center' }}>INA-CBG Eksisting (Rp Miliar)</th>
                    <th style={{ background: '#d35400', color: '#fff', padding: '8px', textAlign: 'center' }}>Potensi iDRG (Rp Miliar)</th>
                    <th style={{ background: '#d35400', color: '#fff', padding: '8px', textAlign: 'center' }}>Selisih Pendapatan (Rp Miliar)</th>
                    <th style={{ background: '#d35400', color: '#fff', padding: '8px', textAlign: 'center' }}>% Selisih (Rp Miliar)</th>
                    <th style={{ background: '#d35400', color: '#fff', padding: '8px', textAlign: 'center' }}>Growth Kasus</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedServiceTableData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                      <td style={{ padding: '8px 16px', fontWeight: 600, color: '#334155', position: 'sticky', left: 0, background: '#fff', zIndex: 1, borderRight: '1px solid #e2e8f0' }}>
                        <div>{row.kelompok}</div>
                        {(() => {
                           const r = getServiceMarketShare(row.kelompok);
                           const isCustom = !!customServiceMarketShare[row.kelompok];
                           return (
                             <div style={{ fontSize: '0.7rem', marginTop: '4px', color: isCustom ? '#0ea5e9' : '#94a3b8', display: 'flex', gap: '6px' }}>
                               <span>D: {r.dasar}%</span>|<span>M: {r.madya}%</span>|<span>U: {r.utama}%</span>|<span>P: {r.paripurna}%</span>
                               {isCustom && <span style={{background: '#e0f2fe', color: '#0369a1', padding: '0 4px', borderRadius: '4px'}}>Custom</span>}
                             </div>
                           );
                        })()}
                      </td>
                      
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, background: '#f0f9ff' }}>{row.existTotalKasus.toLocaleString('en-US')}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div>{row.s.existKasus.dasar.toLocaleString('en-US')}</div>
                        {row.existTotalKasus > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({((row.s.existKasus.dasar / row.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div>{row.s.existKasus.madya.toLocaleString('en-US')}</div>
                        {row.existTotalKasus > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({((row.s.existKasus.madya / row.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div>{row.s.existKasus.utama.toLocaleString('en-US')}</div>
                        {row.existTotalKasus > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({((row.s.existKasus.utama / row.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <div>{row.s.existKasus.paripurna.toLocaleString('en-US')}</div>
                        {row.existTotalKasus > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({((row.s.existKasus.paripurna / row.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                      </td>
                      
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, background: '#f8fafc' }}>{row.regTotalKasus.toLocaleString('en-US')}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div>{row.s.regKasus.dasar.toLocaleString('en-US')}</div>
                        {row.regTotalKasus > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({((row.s.regKasus.dasar / row.regTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div>{row.s.regKasus.madya.toLocaleString('en-US')}</div>
                        {row.regTotalKasus > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({((row.s.regKasus.madya / row.regTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div>{row.s.regKasus.utama.toLocaleString('en-US')}</div>
                        {row.regTotalKasus > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({((row.s.regKasus.utama / row.regTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <div>{row.s.regKasus.paripurna.toLocaleString('en-US')}</div>
                        {row.regTotalKasus > 0 && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>({((row.s.regKasus.paripurna / row.regTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                      </td>
                      
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: '#b45309', background: '#fffbeb' }}>{row.capturedKasus.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                      
                      {(() => {
                        const r = getServiceMarketShare(row.kelompok);
                        return (
                          <>
                            <td style={{ padding: '8px', textAlign: 'center', background: '#fef3c7' }}>
                              <div>{row.capturedKasusRinci.dasar.toLocaleString('en-US', {maximumFractionDigits:0})}</div>
                              <div style={{ fontSize: '0.7rem', color: '#d97706' }}>({r.dasar}%)</div>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', background: '#fef3c7' }}>
                              <div>{row.capturedKasusRinci.madya.toLocaleString('en-US', {maximumFractionDigits:0})}</div>
                              <div style={{ fontSize: '0.7rem', color: '#d97706' }}>({r.madya}%)</div>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', background: '#fef3c7' }}>
                              <div>{row.capturedKasusRinci.utama.toLocaleString('en-US', {maximumFractionDigits:0})}</div>
                              <div style={{ fontSize: '0.7rem', color: '#d97706' }}>({r.utama}%)</div>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', background: '#fef3c7', borderRight: '1px solid #e2e8f0' }}>
                              <div>{row.capturedKasusRinci.paripurna.toLocaleString('en-US', {maximumFractionDigits:0})}</div>
                              <div style={{ fontSize: '0.7rem', color: '#d97706' }}>({r.paripurna}%)</div>
                            </td>
                          </>
                        );
                      })()}
                      
                      <td style={{ padding: '8px', textAlign: 'right', color: '#475569', background: '#fdf4ff' }}>{formatTableMiliar(row.existTotalInacbg)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#0369a1', fontWeight: 600, background: '#fdf4ff' }}>{formatTableMiliar(row.capturedIdrg)}</td>
                      
                      {(() => {
                         const selisih = row.capturedIdrg - row.existTotalInacbg;
                         const isPositive = selisih > 0;
                         const isNegative = selisih < 0;
                         const persen = row.existTotalInacbg > 0 ? (selisih / row.existTotalInacbg) * 100 : (isPositive ? 100 : 0);
                         return (
                           <>
                             <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, background: '#fdf4ff', color: isPositive ? '#16a34a' : (isNegative ? '#dc2626' : '#64748b') }}>
                               {isPositive ? '+' : ''}{formatTableMiliar(selisih)}
                             </td>
                             <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, background: '#fdf4ff', color: isPositive ? '#16a34a' : (isNegative ? '#dc2626' : '#64748b') }}>
                               {isPositive ? '+' : ''}{persen.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%
                             </td>
                           </>
                         );
                      })()}

                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, background: '#fdf4ff', color: row.growthKasus > 0 ? '#16a34a' : (row.growthKasus < 0 ? '#dc2626' : '#64748b') }}>
                        <div>{row.growthKasus > 0 ? '+' : ''}{row.growthKasus.toLocaleString('en-US', {maximumFractionDigits:0})}</div>
                        <div style={{ fontSize: '0.7rem' }}>
                          ({row.growthKasus > 0 ? '+' : ''}{row.existTotalKasus ? ((row.growthKasus / row.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : (row.growthKasus > 0 ? 100 : 0)}%)
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                    <td style={{ padding: '12px 16px', color: '#1e293b', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1, borderRight: '1px solid #cbd5e1' }}>TOTAL 24 LAYANAN</td>
                    
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#0369a1' }}>{serviceTotals.existTotalKasus.toLocaleString('en-US')}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div>{serviceTotals.existDasar.toLocaleString('en-US')}</div>
                      {serviceTotals.existTotalKasus > 0 && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({((serviceTotals.existDasar / serviceTotals.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div>{serviceTotals.existMadya.toLocaleString('en-US')}</div>
                      {serviceTotals.existTotalKasus > 0 && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({((serviceTotals.existMadya / serviceTotals.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div>{serviceTotals.existUtama.toLocaleString('en-US')}</div>
                      {serviceTotals.existTotalKasus > 0 && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({((serviceTotals.existUtama / serviceTotals.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                      <div>{serviceTotals.existParipurna.toLocaleString('en-US')}</div>
                      {serviceTotals.existTotalKasus > 0 && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({((serviceTotals.existParipurna / serviceTotals.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                    </td>
                    
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#00B1A0' }}>{serviceTotals.regTotalKasus.toLocaleString('en-US')}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div>{serviceTotals.regDasar.toLocaleString('en-US')}</div>
                      {serviceTotals.regTotalKasus > 0 && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({((serviceTotals.regDasar / serviceTotals.regTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div>{serviceTotals.regMadya.toLocaleString('en-US')}</div>
                      {serviceTotals.regTotalKasus > 0 && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({((serviceTotals.regMadya / serviceTotals.regTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div>{serviceTotals.regUtama.toLocaleString('en-US')}</div>
                      {serviceTotals.regTotalKasus > 0 && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({((serviceTotals.regUtama / serviceTotals.regTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                      <div>{serviceTotals.regParipurna.toLocaleString('en-US')}</div>
                      {serviceTotals.regTotalKasus > 0 && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>({((serviceTotals.regParipurna / serviceTotals.regTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)</div>}
                    </td>
                    
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#b45309' }}>{serviceTotals.capturedKasus.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{serviceTotals.capturedDasar.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{serviceTotals.capturedMadya.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>{serviceTotals.capturedUtama.toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>
                      <div>{serviceTotals.capturedParipurna.toLocaleString('en-US', {maximumFractionDigits:0})}</div>
                    </td>
                    
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: '#334155' }}>{formatTableMiliar(serviceTotals.existTotalInacbg)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: '#0369a1' }}>{formatTableMiliar(serviceTotals.capturedIdrg)}</td>
                    
                    {(() => {
                       const selisih = serviceTotals.capturedIdrg - serviceTotals.existTotalInacbg;
                       const isPositive = selisih > 0;
                       const isNegative = selisih < 0;
                       const persen = serviceTotals.existTotalInacbg > 0 ? (selisih / serviceTotals.existTotalInacbg) * 100 : (isPositive ? 100 : 0);
                       return (
                         <>
                           <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: isPositive ? '#16a34a' : (isNegative ? '#dc2626' : '#64748b') }}>
                             {isPositive ? '+' : ''}{formatTableMiliar(selisih)}
                           </td>
                           <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: isPositive ? '#16a34a' : (isNegative ? '#dc2626' : '#64748b') }}>
                             {isPositive ? '+' : ''}{persen.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%
                           </td>
                         </>
                       );
                    })()}

                    <td style={{ padding: '12px 8px', textAlign: 'center', color: serviceTotals.growthKasus > 0 ? '#16a34a' : (serviceTotals.growthKasus < 0 ? '#dc2626' : '#64748b') }}>
                      <div>{serviceTotals.growthKasus > 0 ? '+' : ''}{serviceTotals.growthKasus.toLocaleString('en-US', {maximumFractionDigits:0})}</div>
                      <div style={{ fontSize: '0.75rem' }}>
                        ({serviceTotals.growthKasus > 0 ? '+' : ''}{serviceTotals.existTotalKasus ? ((serviceTotals.growthKasus / serviceTotals.existTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : (serviceTotals.growthKasus > 0 ? 100 : 0)}%)
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
    {/* HIDDEN CONTAINER FOR PPT EXPORT OF TOP 10 RS PROFILES */}
    <div id="export-hidden-profiles" style={{ position: 'absolute', left: '-9999px', top: 0, width: '900px' }}>
      {combinedRegionData && 
        [...combinedRegionData.rsList]
          .sort((a,b) => b.kasus - a.kasus)
          .slice(0, 10)
          .map(rs => (
            <div key={`export-${rs.kode}`} data-rs-name={rs.nama} style={{ marginBottom: '20px' }}>
              <HospitalProfileCard 
                rs={rs} 
                profile={rsProfilesData ? rsProfilesData[rs.kode] : null} 
                simulasi={simulasi} 
                isExportMode={true} 
                excludeNonKomp={excludeNonKomp}
                rsKompetensiOnline={rsKompetensiOnline}
              />
            </div>
      ))}
    </div>

    </div>
    </div>
  );
};

export default SimulasiRujukan;
