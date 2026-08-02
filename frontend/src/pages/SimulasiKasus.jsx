import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { Download, Building, Users, TrendingUp, Target, Briefcase, Activity } from 'lucide-react';
import ProfilRsDashboard from '../components/ProfilRsDashboard';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { formatCompactCurrency, formatTableMiliar } from '../utils/formatters';
import { filterHospital } from '../utils/filterUtils';
import { loadDatasetFile } from '../utils/dataLoader';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import './SimulasiKasus.css';

const ALL_KOMPETENSI_LEVELS = ['Dasar', 'Madya', 'Utama', 'Paripurna', 'Lainnya'];
const MAIN_LEVELS = ['Dasar', 'Madya', 'Utama', 'Paripurna'];

const isJabo = (kab, prop) => {
  const JABODETABEK_KABS = [
    'KOTA JAKARTA PUSAT', 'KOTA JAKARTA UTARA', 'KOTA JAKARTA BARAT', 'KOTA JAKARTA SELATAN', 'KOTA JAKARTA TIMUR',
    'BOGOR', 'KOTA BOGOR', 'DEPOK', 'KOTA DEPOK', 'TANGERANG', 'KOTA TANGERANG', 'KOTA TANGERANG SELATAN', 'BEKASI', 'KOTA BEKASI'
  ];
  const kabUpper = (kab || '').toUpperCase();
  const propUpper = (prop || '').toUpperCase();
  return JABODETABEK_KABS.some(k => kabUpper.includes(k) || kabUpper === k) || propUpper === 'DKI JAKARTA';
};

const isJabarExBebo = (kab, prop) => {
  const BEBODEPOK_KABS = ['BEKASI', 'KOTA BEKASI', 'BOGOR', 'KABUPATEN BOGOR', 'DEPOK', 'KOTA DEPOK'];
  const kabUpper = (kab || '').toUpperCase();
  const propUpper = (prop || '').toUpperCase();
  return propUpper === 'JAWA BARAT' && !BEBODEPOK_KABS.some(k => kabUpper.includes(k) || kabUpper === k);
};

const SimulasiKasus = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg, rsKompetensiOnline } ) => {
  const [data, setData] = useState(null);
  const [rsProfilesData, setRsProfilesData] = useState(null);
  const [shiftingData, setShiftingData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [rsOptions, setRsOptions] = useState([]);
  const [layananOptions, setLayananOptions] = useState([]);
  
  const [selectedProvinsi, setSelectedProvinsi] = useState([]);
  const [selectedKabupaten, setSelectedKabupaten] = useState([]);
  const [selectedRs, setSelectedRs] = useState(null);
  const [selectedLayanan, setSelectedLayanan] = useState([]);
  
  const [pctTambah, setPctTambah] = useState({ Dasar: 0, Madya: 0, Utama: 100, Paripurna: 100 });
  const [pctKurang, setPctKurang] = useState({ Dasar: 100, Madya: 100, Utama: 0, Paripurna: 0 });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'rs_profiles', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'shifting', globalMonth, globalDrg)
    ]).then(([hospJson, profilesJson, shiftingJson]) => {
      setData(hospJson);
      setRsProfilesData(profilesJson);
      setShiftingData(shiftingJson);
      
      const layanans = new Set();
      if (profilesJson) {
          Object.values(profilesJson).forEach(prof => {
              if (prof?.crosstab?.byLayanan) {
                  Object.keys(prof.crosstab.byLayanan).forEach(l => layanans.add(l));
              }
          });
      }
      const lOpts = Array.from(layanans).sort().map(l => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) }));
      setLayananOptions(lOpts);
      
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [dataset]);

  useEffect(() => {
    if (data) {
      const opts = Object.entries(data).filter(([kode, rs]) => {
        if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return false;
        return true;
      }).map(([kode, rs]) => ({
        ...rs,
        crosstab: rsProfilesData && rsProfilesData[kode] ? rsProfilesData[kode].crosstab : undefined,
        value: kode,
        label: `${rs.nama || 'Unknown'} (${kode})`,
        prop: rs.prop || 'Lainnya',
        kab: rs.kab || 'Lainnya',
        faskesKomp: rs.faskesKomp || 'Tidak Kompeten'
      }));
      setRsOptions(opts);
    }
  }, [data, rsProfilesData, groupFilter, wilayahFilter, rsFilter, kabFilter, isExcludeMode]);

  useEffect(() => {
    if (wilayahFilter && wilayahFilter.length > 0) {
      setSelectedProvinsi(wilayahFilter.map(p => ({ value: p, label: p })));
    } else {
      if (selectedRs && selectedRs.prop) {
        setSelectedProvinsi([{ value: selectedRs.prop, label: selectedRs.prop }]);
      } else {
        setSelectedProvinsi([]);
      }
    }

    if (kabFilter && kabFilter.length > 0) {
      setSelectedKabupaten(kabFilter.map(k => ({ value: k, label: k })));
    } else {
      setSelectedKabupaten([]);
    }
  }, [selectedRs, wilayahFilter, kabFilter]);

  let provOpts = [];
  let kabOpts = [];
  if (data) {
    const provSet = new Set();
    const kabSet = new Set();
    Object.values(data).forEach(rs => {
      if (rs.prop) provSet.add(rs.prop);
      if (rs.kab && rs.prop) {
        const isSelectedProv = selectedProvinsi.length === 0 || selectedProvinsi.some(p => p.value === rs.prop);
        const isSelectedJabo = selectedProvinsi.some(p => p.value === 'JABODETABEK') && isJabo(rs.kab, rs.prop);
        const isSelectedJabarExBebo = selectedProvinsi.some(p => p.value === 'Jabar ex Bebodepok') && isJabarExBebo(rs.kab, rs.prop);
        if (isSelectedProv || isSelectedJabo || isSelectedJabarExBebo) {
          kabSet.add(`${rs.kab} (${rs.prop})`);
        }
      }
    });
    provOpts = [
      { value: 'JABODETABEK', label: 'JABODETABEK' },
      { value: 'Jabar ex Bebodepok', label: 'Jabar ex Bebodepok' },
      ...Array.from(provSet).sort().map(p => ({value: p, label: p}))
    ];
    kabOpts = Array.from(kabSet).sort().map(k => ({value: k, label: k}));
  }

  const simulasiKey = `tarif_${simulasi}`;

  // Calculate Base Data (Eksisting) for RS
  const targetKomp = { Dasar: {kasus:0, ina:0, sim:0}, Madya: {kasus:0, ina:0, sim:0}, Utama: {kasus:0, ina:0, sim:0}, Paripurna: {kasus:0, ina:0, sim:0} };
  let targetKasusTotal = 0;
  let targetInaTotal = 0;
  let targetSimTotal = 0;

  if (selectedRs && rsProfilesData && rsProfilesData[selectedRs.value]) {
    const prof = rsProfilesData[selectedRs.value];
    if (prof.crosstab) {
      const processPtdMap = (ptdMap) => {
        Object.entries(ptdMap || {}).forEach(([ptd, kompMap]) => {
          Object.entries(kompMap || {}).forEach(([komp, cObj]) => {
            let safeKomp = komp.charAt(0).toUpperCase() + komp.slice(1);
            if (!MAIN_LEVELS.includes(safeKomp)) return;

            const srcSim = cObj.sim || cObj;
            const simVal = srcSim[simulasiKey] || 0;

            targetKasusTotal += cObj.kasus || 0;
            targetInaTotal += cObj.inacbg || 0;
            targetSimTotal += simVal;

            if (targetKomp[safeKomp]) {
              targetKomp[safeKomp].kasus += cObj.kasus || 0;
              targetKomp[safeKomp].ina += cObj.inacbg || 0;
              targetKomp[safeKomp].sim += simVal;
            }
          });
        });
      };

      let activeLayananFilters = selectedLayanan && selectedLayanan.length > 0 ? selectedLayanan.map(opt => opt.value) : [];
      if (activeLayananFilters.length === 0 && groupFilter) {
          activeLayananFilters = groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', ''));
      }

      if (activeLayananFilters.length > 0) {
        if (prof.crosstab.byLayanan) {
          activeLayananFilters.forEach(layanan => {
            const lData = prof.crosstab.byLayanan[layanan];
            if (lData && lData.byKompetensi) {
              Object.values(lData.byKompetensi).forEach(ptdMap => {
                processPtdMap(ptdMap);
              });
            }
          });
        }
      } else {
        if (prof.crosstab.byKompetensi) {
          Object.values(prof.crosstab.byKompetensi).forEach(ptdMap => {
            processPtdMap(ptdMap);
          });
        }
      }
    }
  }

  // Calculate Regional Maximum Potential (Tambahan)
  const regKomp = { Dasar: {kasus:0, ina:0, sim:0}, Madya: {kasus:0, ina:0, sim:0}, Utama: {kasus:0, ina:0, sim:0}, Paripurna: {kasus:0, ina:0, sim:0} };
  if (shiftingData && selectedRs) {
    const hasJaboSel = selectedProvinsi.length > 0 && selectedProvinsi.some(p => p.value === 'JABODETABEK');
    const hasJabarExBeboSel = selectedProvinsi.length > 0 && selectedProvinsi.some(p => p.value === 'Jabar ex Bebodepok');
    
    let activeLayananFilters = selectedLayanan && selectedLayanan.length > 0 ? selectedLayanan.map(opt => opt.value) : [];
    if (activeLayananFilters.length === 0 && groupFilter) {
        activeLayananFilters = groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', ''));
    }

    for (const prop in shiftingData) {
      if (prop === 'UJI_COBA' && (selectedProvinsi.length === 0 || !selectedProvinsi.some(p => p.value === 'UJI_COBA'))) continue;
      for (const kab in shiftingData[prop]) {
        const isJaboKab = isJabo(kab, prop);
        const isJabarExBeboKab = isJabarExBebo(kab, prop);
        const matchProv = selectedProvinsi.length > 0 && (selectedProvinsi.some(p => p.value === prop) || (hasJaboSel && isJaboKab) || (hasJabarExBeboSel && isJabarExBeboKab));
        const matchKabStr = `${kab} (${prop})`;
        const matchKab = selectedKabupaten.length > 0 && selectedKabupaten.some(k => k.value === matchKabStr);
        let isIncluded = false;
        if (selectedProvinsi.length === 0 && selectedKabupaten.length === 0) isIncluded = true;
        else if (selectedProvinsi.length > 0 && selectedKabupaten.length === 0) isIncluded = matchProv;
        else if (selectedProvinsi.length === 0 && selectedKabupaten.length > 0) isIncluded = matchKab;
        else isIncluded = matchKab;

        if (isIncluded) {
          for (const kel in shiftingData[prop][kab]) {
            const shiftNode = shiftingData[prop][kab][kel];
            const normKel = kel.toLowerCase().trim();
            if (activeLayananFilters.length > 0 && !activeLayananFilters.includes(normKel)) continue;

            const hasActiveFilter = rsFilter || (groupFilter && groupFilter.length > 0) || (wilayahFilter && wilayahFilter.length > 0) || (kabFilter && kabFilter.length > 0) || excludeNonKomp;
            if (hasActiveFilter && shiftNode.demandByRs) {
                for (const rsId in shiftNode.demandByRs) {
                    const rsObj = data && data[rsId];
                    if (rsObj && filterHospital(rsObj, rsId, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) {
                        for (const komp in shiftNode.demandByRs[rsId].kasusByKlaim || {}) {
                            let safeKomp = komp.charAt(0).toUpperCase() + komp.slice(1).toLowerCase();
                            if (!MAIN_LEVELS.includes(safeKomp)) continue;
                            const d = shiftNode.demandByRs[rsId].kasusByKlaim[komp];
                            regKomp[safeKomp].kasus += d.kasus || 0;
                            regKomp[safeKomp].ina += d.inacbg || 0;
                            regKomp[safeKomp].sim += d.sim?.[simulasiKey] || 0;
                        }
                    }
                }
            } else {
                for (const komp in shiftNode.demand || {}) {
                    let safeKomp = komp.charAt(0).toUpperCase() + komp.slice(1).toLowerCase();
                    if (!MAIN_LEVELS.includes(safeKomp)) continue;
                    const d = shiftNode.demand[komp];
                    regKomp[safeKomp].kasus += d.kasus || 0;
                    regKomp[safeKomp].ina += d.inacbg || 0;
                    regKomp[safeKomp].sim += d.sim?.[simulasiKey] || 0;
                }
            }
          }
        }
      }
    }
  }

  // Simulation Calculations
  let totalTambahKasus = 0;
  let totalTambahPendapatan = 0;
  let totalKurangKasus = 0;
  let totalKurangPendapatan = 0;

  MAIN_LEVELS.forEach(lvl => {
      // Penambahan diambil dari regKomp (Total Regional) dikurangi targetKomp (Eksisting RS)
      const maxTambahKasus = Math.max(0, (regKomp[lvl].kasus || 0) - (targetKomp[lvl].kasus || 0));
      let maxTambahSim = 0;
      if (regKomp[lvl].kasus > 0) {
          const avgSim = regKomp[lvl].sim / regKomp[lvl].kasus;
          maxTambahSim = maxTambahKasus * avgSim;
      }
      
      const valTambahKasus = Math.round(maxTambahKasus * (pctTambah[lvl] / 100));
      const valTambahSim = maxTambahSim * (pctTambah[lvl] / 100);
      totalTambahKasus += valTambahKasus;
      totalTambahPendapatan += valTambahSim;

      // Pengurangan diambil dari targetKomp (Kasus eksisting RS yang dilepas)
      const maxKurang = targetKomp[lvl];
      const valKurangKasus = Math.round((maxKurang.kasus || 0) * (pctKurang[lvl] / 100));
      const valKurangIna = (maxKurang.ina || 0) * (pctKurang[lvl] / 100); // Dilepas berdasar INA eksisting
      totalKurangKasus += valKurangKasus;
      totalKurangPendapatan += valKurangIna;
  });

  const netKasus = totalTambahKasus - totalKurangKasus;
  const netPendapatan = totalTambahPendapatan - totalKurangPendapatan;
  
  const pendapatanSimulasiTotal = targetInaTotal + netPendapatan;
  const selisihPendapatan = targetSimTotal - targetInaTotal; // Selisih iDRG eksisting
  const selisihPersentase = targetInaTotal > 0 ? (selisihPendapatan / targetInaTotal) * 100 : 0;
  
  const netPersentase = targetKasusTotal > 0 ? (netKasus / targetKasusTotal) * 100 : 0;
  const kenaikanPendapatanPct = targetInaTotal > 0 ? (netPendapatan / targetInaTotal) * 100 : 0;

  // Calculate Skenario 1-5 based on active slider components
  let activeTambahLevels = MAIN_LEVELS.filter(lvl => pctTambah[lvl] > 0);
  if (activeTambahLevels.length === 0) {
      activeTambahLevels = MAIN_LEVELS.filter(lvl => {
          const eks = targetKomp[lvl]?.kasus || 0;
          const reg = regKomp[lvl]?.kasus || 0;
          return (reg - eks) > 0;
      });
      if (activeTambahLevels.length === 0) activeTambahLevels = MAIN_LEVELS;
  }
  const activeKurangLevels = MAIN_LEVELS.filter(lvl => pctKurang[lvl] > 0);

  const scenarioMultipliers = [1, 0.75, 0.5, 0.25, 0];
  const scenariosData = scenarioMultipliers.map((multiplier, idx) => {
      let sTambahKasus = 0;
      let sTambahPendapatan = 0;
      let sKurangKasus = 0;
      let sKurangPendapatan = 0;

      activeTambahLevels.forEach(lvl => {
          const maxTambahKasus = Math.max(0, (regKomp[lvl].kasus || 0) - (targetKomp[lvl].kasus || 0));
          let maxTambahSim = 0;
          if (regKomp[lvl].kasus > 0) {
              const avgSim = regKomp[lvl].sim / regKomp[lvl].kasus;
              maxTambahSim = maxTambahKasus * avgSim;
          }
          sTambahKasus += Math.round(maxTambahKasus * multiplier);
          sTambahPendapatan += maxTambahSim * multiplier;
      });

      activeKurangLevels.forEach(lvl => {
          const maxKurang = targetKomp[lvl];
          sKurangKasus += Math.round((maxKurang.kasus || 0) * multiplier);
          sKurangPendapatan += (maxKurang.ina || 0) * multiplier;
      });

      const sNetKasus = sTambahKasus - sKurangKasus;
      const sNetPendapatan = sTambahPendapatan - sKurangPendapatan;
      const sNetPersentase = targetKasusTotal > 0 ? (sNetKasus / targetKasusTotal) * 100 : 0;
      const sKenaikanPct = targetInaTotal > 0 ? (sNetPendapatan / targetInaTotal) * 100 : 0;

      return {
          name: `Skenario ${idx + 1}`,
          multiplier: multiplier * 100,
          tambahKasus: sTambahKasus,
          tambahPendapatan: sTambahPendapatan,
          kurangKasus: sKurangKasus,
          kurangPendapatan: sKurangPendapatan,
          netKasus: sNetKasus,
          netPendapatan: sNetPendapatan,
          netPersentase: sNetPersentase,
          kenaikanPct: sKenaikanPct
      };
  });

  const handleSliderChange = (type, level, value) => {
      if (type === 'tambah') {
          setPctTambah(prev => ({...prev, [level]: parseInt(value)}));
      } else {
          setPctKurang(prev => ({...prev, [level]: parseInt(value)}));
      }
  };

  const donutData = [
      { name: 'Tambahan Kasus', value: totalTambahKasus, fill: '#10b981' },
      { name: 'Pengurangan Kasus', value: totalKurangKasus, fill: '#ef4444' }
  ];

  const barData = [
      { name: 'Eksisting (INA-CBGs)', Pendapatan: targetInaTotal, fill: '#1d4ed8' },
      { name: 'Simulasi', Pendapatan: pendapatanSimulasiTotal, fill: '#10b981' }
  ];
  
  
  const exportToExcel = () => {
      const wb = XLSX.utils.book_new();
      
      const summaryData = [
          ['SKENARIO', 'TAMBAHAN KASUS', 'TAMBAHAN PENDAPATAN', 'PENGURANGAN KASUS', 'PENGURANGAN PENDAPATAN', 'NET KASUS', 'NET PENDAPATAN', 'EKSISTING INA', 'SIMULASI TOTAL'],
          [
              'Kustom (Aktif)', 
              totalTambahKasus, 
              totalTambahPendapatan, 
              totalKurangKasus, 
              totalKurangPendapatan, 
              netKasus, 
              netPendapatan, 
              targetInaTotal, 
              pendapatanSimulasiTotal
          ]
      ];
      scenariosData.forEach(s => {
          summaryData.push([
              s.name,
              s.tambahKasus,
              s.tambahPendapatan,
              s.kurangKasus,
              s.kurangPendapatan,
              s.netKasus,
              s.netPendapatan,
              targetInaTotal,
              targetInaTotal + s.netPendapatan
          ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, "Simulasi");
      
      const detailData = [['Kompetensi', 'Tambahan %', 'Pengurangan %']];
      MAIN_LEVELS.forEach(lvl => {
          detailData.push([lvl, pctTambah[lvl] + '%', pctKurang[lvl] + '%']);
      });
      const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, wsDetail, "Parameter");

      XLSX.writeFile(wb, `Simulasi_Kasus_${selectedRs?.label || 'RS'}.xlsx`);
  };

  const exportToPPT = () => {
      let pres = new pptxgen();
      pres.layout = 'LAYOUT_16x9';
      let slide = pres.addSlide();
      
      slide.addText(`SIMULASI MARKET SHARE: ${selectedRs?.label || 'RS'}`, { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 20, bold: true, color: '00B1A0' });
      slide.addText(`Layanan: ${selectedLayanan && selectedLayanan.value !== 'ALL' ? selectedLayanan.label : 'Semua Layanan'}`, { x: 0.5, y: 0.8, w: '90%', h: 0.3, fontSize: 14, color: '334155' });
      
      // KPI Cards
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.5, w: 2, h: 1, fill: 'f1f5f9' });
      slide.addText('KASUS EKSISTING\n' + targetKasusTotal.toLocaleString(), { x: 0.5, y: 1.5, w: 2, h: 1, align: 'center', fontSize: 12, bold: true });
      
      slide.addShape(pres.ShapeType.rect, { x: 2.7, y: 1.5, w: 2.5, h: 1, fill: 'f1f5f9' });
      slide.addText('PENDAPATAN EKSISTING\nRp ' + formatTableMiliar(targetInaTotal) + ' M', { x: 2.7, y: 1.5, w: 2.5, h: 1, align: 'center', fontSize: 12, bold: true });
      
      slide.addShape(pres.ShapeType.rect, { x: 5.4, y: 1.5, w: 2, h: 1, fill: 'f1f5f9' });
      slide.addText('NET KASUS\n' + (netKasus >= 0 ? '+' : '') + netKasus.toLocaleString(), { x: 5.4, y: 1.5, w: 2, h: 1, align: 'center', fontSize: 12, bold: true, color: netKasus >= 0 ? '16a34a' : 'dc2626' });

      slide.addShape(pres.ShapeType.rect, { x: 7.6, y: 1.5, w: 2.2, h: 1, fill: 'f1f5f9' });
      slide.addText('NET PENDAPATAN\n' + (netPendapatan >= 0 ? '+' : '') + 'Rp ' + formatTableMiliar(netPendapatan) + ' M', { x: 7.6, y: 1.5, w: 2.2, h: 1, align: 'center', fontSize: 12, bold: true, color: netPendapatan >= 0 ? '16a34a' : 'dc2626' });

      // Table Parameter
      const paramRows = [
          [{ text: 'KOMPETENSI', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'TAMBAHAN', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'PENGURANGAN', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }]
      ];
      MAIN_LEVELS.forEach(lvl => {
          paramRows.push([lvl, pctTambah[lvl] + '%', pctKurang[lvl] + '%']);
      });
      slide.addText('PARAMETER SIMULASI', { x: 0.5, y: 3.0, w: 4, h: 0.3, fontSize: 12, bold: true });
      slide.addTable(paramRows, { x: 0.5, y: 3.4, w: 4, fill: 'ffffff', fontSize: 10, border: { pt: 1, color: 'e2e8f0' } });

      // Table Hasil
      const resultRows = [
          [{ text: 'SKENARIO', options: { bold: true, fill: '1d4ed8', color: 'ffffff' } }, { text: 'TAMBAHAN KASUS', options: { bold: true, fill: '1d4ed8', color: 'ffffff' } }, { text: 'NET PENDAPATAN', options: { bold: true, fill: '1d4ed8', color: 'ffffff' } }, { text: '% KENAIKAN', options: { bold: true, fill: '1d4ed8', color: 'ffffff' } }],
          ['Kustom (Aktif)', totalTambahKasus.toLocaleString(), (netPendapatan >= 0 ? '+' : '') + 'Rp ' + formatTableMiliar(netPendapatan) + ' M', (kenaikanPendapatanPct >= 0 ? '+' : '') + kenaikanPendapatanPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%']
      ];
      scenariosData.forEach(s => {
          resultRows.push([
              s.name, 
              s.tambahKasus.toLocaleString(), 
              (s.netPendapatan >= 0 ? '+' : '') + 'Rp ' + formatTableMiliar(s.netPendapatan) + ' M', 
              (s.kenaikanPct >= 0 ? '+' : '') + s.kenaikanPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%'
          ]);
      });
      slide.addText('HASIL SIMULASI SEMUA SKENARIO', { x: 5.4, y: 3.0, w: 4, h: 0.3, fontSize: 12, bold: true });
      slide.addTable(resultRows, { x: 5.4, y: 3.4, w: 4.5, fill: 'ffffff', fontSize: 9, border: { pt: 1, color: 'e2e8f0' } });

      pres.writeFile({ fileName: `Simulasi_Kasus_${selectedRs?.label || 'RS'}.pptx` });
  };

  const titleLayanan = selectedLayanan && selectedLayanan.length > 0 ? `LAYANAN ${selectedLayanan.map(l => l.label.toUpperCase()).join(', ')}` : 'SEMUA LAYANAN';

  const titleRs = selectedRs ? selectedRs.label.toUpperCase() : 'PILIH RUMAH SAKIT';

  if (loading) {
      return <div className="loading-container" style={{padding: '40px', textAlign: 'center'}}>Memuat data simulasi...</div>;
  }

  return (
    <div className="simulasi-kasus-container">
      <div className="header-section" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
            <h1>SIMULASI MARKET SHARE {titleLayanan}</h1>
            <h2>{titleRs}</h2>
            <p>Simulasi redistribusi pendapatan berdasarkan skenario iDRG & perubahan komposisi kasus</p>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
            <button className="btn-export-excel" onClick={exportToExcel}><Download size={16}/> Excel</button>
            <button className="btn-export-ppt" onClick={exportToPPT}><Download size={16}/> PPT</button>
        </div>
      </div>

      <div className="filter-section card">
        <div className="filter-grid">
            <div className="filter-item">
                <label>Regional Provinsi</label>
                <Select
                    isMulti
                    options={provOpts}
                    value={selectedProvinsi}
                    onChange={setSelectedProvinsi}
                    placeholder="Pilih Provinsi..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                />
            </div>
            <div className="filter-item">
                <label>Regional Kab/Kota</label>
                <Select
                    isMulti
                    options={kabOpts}
                    value={selectedKabupaten}
                    onChange={setSelectedKabupaten}
                    placeholder="Pilih Kabupaten..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                />
            </div>
            <div className="filter-item">
                <label>Rumah Sakit</label>
                <Select
                    options={rsOptions}
                    value={selectedRs}
                    onChange={setSelectedRs}
                    placeholder="Pilih Rumah Sakit..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                />
            </div>
            <div className="filter-item">
                <label>Layanan</label>
                <Select
                    isMulti
                    options={layananOptions}
                    value={selectedLayanan}
                    onChange={setSelectedLayanan}
                    placeholder="Semua Layanan..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                />
            </div>
        </div>
      </div>

      <ProfilRsDashboard 
          selectedRs={selectedRs} 
          selectedLayanan={selectedLayanan} 
          targetKomp={targetKomp} 
          regKomp={regKomp} 
          activeTambahLevels={activeTambahLevels}
          rsKompetensiOnline={rsKompetensiOnline}
      />
      <div className="kpi-section">
          <div className="kpi-card">
              <div className="kpi-icon"><Users size={24} color="#00b1a0" /></div>
              <div className="kpi-content">
                  <span className="kpi-label">TOTAL KASUS EKSISTING</span>
                  <span className="kpi-value">{targetKasusTotal.toLocaleString()}</span>
                  <span className="kpi-sub">Jumlah kasus klaim</span>
              </div>
          </div>
          <div className="kpi-card">
              <div className="kpi-icon"><Briefcase size={24} color="#1d4ed8" /></div>
              <div className="kpi-content">
                  <span className="kpi-label">PENDAPATAN INA-CBGs</span>
                  <span className="kpi-value">Rp{formatTableMiliar(targetInaTotal)} M</span>
                  <span className="kpi-sub">Data aktual</span>
              </div>
          </div>
          <div className="kpi-card">
              <div className="kpi-icon"><Activity size={24} color="#10b981" /></div>
              <div className="kpi-content">
                  <span className="kpi-label">PENDAPATAN iDRG</span>
                  <span className="kpi-value">Rp{formatTableMiliar(targetSimTotal)} M</span>
                  <span className="kpi-sub">Klaim simulasi iDRG</span>
              </div>
          </div>
          <div className="kpi-card">
              <div className="kpi-icon" style={{backgroundColor: selisihPendapatan >= 0 ? '#dcfce7' : '#fee2e2'}}><TrendingUp size={24} color={selisihPendapatan >= 0 ? '#16a34a' : '#dc2626'} /></div>
              <div className="kpi-content">
                  <span className="kpi-label">SELISIH PENDAPATAN (Eksisting)</span>
                  <span className="kpi-value" style={{color: selisihPendapatan >= 0 ? '#16a34a' : '#dc2626'}}>
                      {selisihPendapatan >= 0 ? '+' : ''}Rp{formatTableMiliar(selisihPendapatan)} M
                  </span>
                  <span className="kpi-sub">iDRG - INA-CBGs</span>
              </div>
          </div>
      </div>

      <div className="main-content-grid">
          <div className="simulasi-sliders card">
              <div className="card-header">
                  <h3>PENGATURAN SKENARIO KASUS</h3>
              </div>
              <div className="sliders-container">
                  <div className="slider-group tambah">
                      <h4>Penambahan Kasus (Target Shifting)</h4>
                      <p className="slider-desc">Tarik kasus dari RS lain di regional</p>
                      {MAIN_LEVELS.map(lvl => (
                          <div className="slider-row" key={`tambah-${lvl}`}>
                              <div className="slider-label">
                                  <span>{lvl}</span>
                                  <span className="potensi">Potensi: {Math.max(0, (regKomp[lvl].kasus || 0) - (targetKomp[lvl].kasus || 0)).toLocaleString()}</span>
                              </div>
                              <input 
                                  type="range" 
                                  min="0" max="100" 
                                  value={pctTambah[lvl]} 
                                  onChange={(e) => handleSliderChange('tambah', lvl, e.target.value)}
                              />
                              <span className="pct-value">{pctTambah[lvl]}%</span>
                          </div>
                      ))}
                  </div>
                  <div className="slider-group kurang">
                      <h4>Pengurangan Kasus (Dilepas)</h4>
                      <p className="slider-desc">Lepas kasus eksisting RS ini</p>
                      {MAIN_LEVELS.map(lvl => (
                          <div className="slider-row" key={`kurang-${lvl}`}>
                              <div className="slider-label">
                                  <span>{lvl}</span>
                                  <span className="potensi">Eksisting: {targetKomp[lvl].kasus.toLocaleString()}</span>
                              </div>
                              <input 
                                  type="range" 
                                  min="0" max="100" 
                                  value={pctKurang[lvl]} 
                                  onChange={(e) => handleSliderChange('kurang', lvl, e.target.value)}
                              />
                              <span className="pct-value">{pctKurang[lvl]}%</span>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="summary-table-container">
                  <table className="summary-table">
                      <thead>
                          <tr>
                              <th>SKENARIO</th>
                              <th>TAMBAHAN KASUS</th>
                              <th>PENGURANGAN KASUS</th>
                              <th>NET +/- PASCA iDRG & RBKP</th>
                              <th>PENDAPATAN INA-CBG EKSISTING</th>
                              <th>% KENAIKAN thd EKSISTING</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr style={{backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0'}}>
                              <td><span className="badge" style={{backgroundColor: '#0f172a'}}>KUSTOM (Aktif)</span></td>
                              <td>
                                  <div className="td-stack">
                                      <span>{totalTambahKasus.toLocaleString()} Kasus</span>
                                      <span className="td-sub">+ Rp{formatTableMiliar(totalTambahPendapatan)} M</span>
                                  </div>
                              </td>
                              <td>
                                  <div className="td-stack">
                                      <span>{totalKurangKasus.toLocaleString()} Kasus</span>
                                      <span className="td-sub">- Rp{formatTableMiliar(totalKurangPendapatan)} M</span>
                                  </div>
                              </td>
                              <td>
                                  <div className="td-stack">
                                      <span style={{color: netKasus >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold'}}>{netKasus >= 0 ? '+' : ''}{netKasus.toLocaleString()} Kasus ({netPersentase > 0 ? '+' : ''}{netPersentase.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%)</span>
                                      <span style={{color: netPendapatan >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold'}}>{netPendapatan >= 0 ? '+' : ''}Rp{formatTableMiliar(netPendapatan)} M</span>
                                  </div>
                              </td>
                              <td className="bold">Rp{formatTableMiliar(targetInaTotal)} M</td>
                              <td>
                                  <span className="badge" style={{backgroundColor: kenaikanPendapatanPct >= 0 ? '#dcfce7' : '#fee2e2', color: kenaikanPendapatanPct >= 0 ? '#16a34a' : '#dc2626'}}>
                                      {kenaikanPendapatanPct >= 0 ? '+' : ''}{kenaikanPendapatanPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                                  </span>
                              </td>
                          </tr>
                          {scenariosData.map((s, i) => (
                              <tr key={i}>
                                  <td>
                                      <div style={{fontWeight: 600, color: '#334155'}}>{s.name}</div>
                                      <div style={{fontSize: '0.7rem', color: '#64748b'}}>Porsi {s.multiplier}%</div>
                                  </td>
                                  <td>
                                      <div className="td-stack">
                                          <span>{s.tambahKasus.toLocaleString()} Kasus</span>
                                          <span className="td-sub">+ Rp{formatTableMiliar(s.tambahPendapatan)} M</span>
                                      </div>
                                  </td>
                                  <td>
                                      <div className="td-stack">
                                          <span>{s.kurangKasus.toLocaleString()} Kasus</span>
                                          <span className="td-sub">- Rp{formatTableMiliar(s.kurangPendapatan)} M</span>
                                      </div>
                                  </td>
                                  <td>
                                      <div className="td-stack">
                                          <span style={{color: s.netKasus >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold'}}>{s.netKasus >= 0 ? '+' : ''}{s.netKasus.toLocaleString()} Kasus ({s.netPersentase > 0 ? '+' : ''}{s.netPersentase.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%)</span>
                                          <span style={{color: s.netPendapatan >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold'}}>{s.netPendapatan >= 0 ? '+' : ''}Rp{formatTableMiliar(s.netPendapatan)} M</span>
                                      </div>
                                  </td>
                                  <td className="bold">Rp{formatTableMiliar(targetInaTotal)} M</td>
                                  <td>
                                      <span className="badge" style={{backgroundColor: s.kenaikanPct >= 0 ? '#dcfce7' : '#fee2e2', color: s.kenaikanPct >= 0 ? '#16a34a' : '#dc2626'}}>
                                          {s.kenaikanPct >= 0 ? '+' : ''}{s.kenaikanPct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                                      </span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          <div className="charts-sidebar">
              <div className="card">
                  <div className="card-header">
                      <h3>KOMPOSISI PERUBAHAN KASUS</h3>
                  </div>
                  <div className="chart-wrapper" style={{height: 250}}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <PieChart>
                              <Pie
                                  data={donutData}
                                  cx="50%" cy="50%"
                                  innerRadius={60} outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                              >
                                  {donutData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                              </Pie>
                              <RechartsTooltip formatter={(value) => value.toLocaleString()} />
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
                  <div className="chart-stats">
                      <div className="stat-item">
                          <span className="stat-dot" style={{backgroundColor: '#10b981'}}></span>
                          <span className="stat-val">{totalTambahKasus.toLocaleString()}</span>
                          <span className="stat-lbl">Tambahan</span>
                      </div>
                      <div className="stat-item">
                          <span className="stat-dot" style={{backgroundColor: '#ef4444'}}></span>
                          <span className="stat-val">{totalKurangKasus.toLocaleString()}</span>
                          <span className="stat-lbl">Pengurangan</span>
                      </div>
                  </div>
              </div>

              <div className="card">
                  <div className="card-header">
                      <h3>PERBANDINGAN PENDAPATAN</h3>
                  </div>
                  <div className="chart-wrapper" style={{height: 250}}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <BarChart data={barData} layout="vertical" margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" tickFormatter={(v) => (v/1000000000).toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})} />
                              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                              <RechartsTooltip cursor={{fill: 'transparent'}} formatter={(value) => `Rp${formatTableMiliar(value)} M`} />
                              <Bar dataKey="Pendapatan" radius={[0, 4, 4, 0]} barSize={30}>
                                  {barData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  <div className="chart-footer">
                      <span className="footer-label">Selisih Simulasi:</span>
                      <span className="footer-value" style={{color: netPendapatan >= 0 ? '#16a34a' : '#dc2626'}}>
                          {netPendapatan >= 0 ? '+' : ''}Rp{formatTableMiliar(netPendapatan)} M
                      </span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default SimulasiKasus;
