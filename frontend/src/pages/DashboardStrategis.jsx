import React, { useState, useEffect, useRef, useMemo } from 'react';
import Select from 'react-select';
import { Download, Building, Users, TrendingUp, Target, Briefcase, ArrowUpRight, ArrowDownRight, CheckCircle, Navigation, Copy } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import html2canvas from 'html2canvas';
import pptxgen from 'pptxgenjs';
import MapRujukan from '../components/MapRujukan';
import { formatCompactCurrency , formatTableMiliar} from '../utils/formatters';
import { filterHospital } from '../utils/filterUtils';
import SkenarioShiftingTable from '../components/SkenarioShiftingTable';
import RSIACompetencyTable from '../components/RSIACompetencyTable';
import HospitalProfileCard from '../components/HospitalProfileCard';
import ShiftingDetailLevelTable from '../components/ShiftingDetailLevelTable';
import ShiftingDasarMadyaTable from '../components/ShiftingDasarMadyaTable';
import ShiftingDasarMadyaSkenarioTable from '../components/ShiftingDasarMadyaSkenarioTable';
import ShiftingDasarMadyaUtamaTable from '../components/ShiftingDasarMadyaUtamaTable';
import ShiftingDasarMadyaUtamaSkenarioTable from '../components/ShiftingDasarMadyaUtamaSkenarioTable';
import '../assets/DashboardStrategis.css';
import { loadDatasetFile } from '../utils/dataLoader';


const ALL_KOMPETENSI_LEVELS = ['Dasar', 'Madya', 'Utama', 'Paripurna', 'Lainnya'];

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

const DashboardStrategis = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg, rsKompetensiOnline } ) => {
  const [data, setData] = useState(null);
  const [shiftingData, setShiftingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rsOptions, setRsOptions] = useState([]);
  const [regionOptions, setRegionOptions] = useState([]);
  
  const [selectedRs, setSelectedRs] = useState(null);
  const [selectedProvinsi, setSelectedProvinsi] = useState([]);
  const [selectedKabupaten, setSelectedKabupaten] = useState([]);
  const [arrowsReady, setArrowsReady] = useState(false);
  const [activeTipeSimulasi, setActiveTipeSimulasi] = useState(2);
  
  // Custom scenario percentages per competency
  const [skenarioList, setSkenarioList] = useState([
    { label: 'Skenario 1', pctTambah: 100, pctKurang: 100 },
    { label: 'Skenario 2', pctTambah: 75, pctKurang: 75 },
    { label: 'Skenario 3', pctTambah: 50, pctKurang: 50 },
    { label: 'Skenario 4', pctTambah: 25, pctKurang: 25 },
    { label: 'Skenario 5', pctTambah: 5, pctKurang: 100 },
  ]);
  
  // Dynamic RS Options based on all active filters (ignoring local competitor filters so RS search is global)
  useEffect(() => {
    if (data) {
      const opts = Object.entries(data).filter(([kode, rs]) => {
        // Global Filters
        if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return false;
        return true;
      }).map(([kode, rs]) => ({
        value: kode,
        label: `${rs.nama || 'Unknown'} (${kode})`,
        prop: rs.prop || 'Lainnya',
        kab: rs.kab || 'Lainnya'
      }));
      setRsOptions(opts);
    }
  }, [data, groupFilter, wilayahFilter, rsFilter, kabFilter, isExcludeMode]);

const [pcts, setPcts] = useState({
    s1: { Dasar: 0, Madya: 20, Utama: 100, Paripurna: 100, Lainnya: 0 },
    s2: { Dasar: 0, Madya: 20, Utama: 75, Paripurna: 75, Lainnya: 0 },
    s3: { Dasar: 0, Madya: 20, Utama: 50, Paripurna: 50, Lainnya: 0 },
    s4: { Dasar: 0, Madya: 20, Utama: 25, Paripurna: 25, Lainnya: 0 }
  });

  const dashboardRef = useRef(null);
  const exportDataRef = useRef({});

  const handleDownloadExcelKertasKerjaStrategis = async () => {
    const { exportDashboardStrategisMaster } = await import('../utils/exportDashboardStrategis');

    const generateRegionalKompetensiExcel = (demandData, simulasiIdx) => {
      const validKomp = ['dasar', 'madya', 'utama', 'paripurna'];
      const grandTotal = { dasar: {kasus:0, ina:0, sim:0}, madya: {kasus:0, ina:0, sim:0}, utama: {kasus:0, ina:0, sim:0}, paripurna: {kasus:0, ina:0, sim:0}, total: {kasus:0, ina:0, sim:0} };
      
      const dataRows = [];
      const keys = Object.keys(demandData).sort();

      keys.forEach((k, i) => {
        const item = demandData[k];
        let rowTotal = {kasus:0, ina:0, sim:0};
        const rowData = [i+1, k];
        
        validKomp.forEach(komp => {
          const compData = item[komp] || {kasus:0, inacbg:0, sim:0};
          const cKas = compData.kasus || 0;
          const cIna = (compData.inacbg || 0) / 1e9;
          const cSim = (compData.sim || 0) / 1e9;

          rowData.push(cKas, cIna, cSim);

          rowTotal.kasus += cKas;
          rowTotal.ina += cIna;
          rowTotal.sim += cSim;

          grandTotal[komp].kasus += cKas;
          grandTotal[komp].ina += cIna;
          grandTotal[komp].sim += cSim;
        });

        rowData.push(rowTotal.kasus, rowTotal.ina, rowTotal.sim);
        dataRows.push(rowData);

        grandTotal.total.kasus += rowTotal.kasus;
        grandTotal.total.ina += rowTotal.ina;
        grandTotal.total.sim += rowTotal.sim;
      });

      const totRow = ['Total', ''];
      validKomp.forEach(komp => {
         totRow.push(grandTotal[komp].kasus, grandTotal[komp].ina, grandTotal[komp].sim);
      });
      totRow.push(grandTotal.total.kasus, grandTotal.total.ina, grandTotal.total.sim);
      dataRows.push(totRow);

      const headers = [
        'NO', 'Kelompok Layanan',
        'Dasar (Kasus)', 'Dasar INA-CBG (Rp M)', 'Dasar iDRG (Rp M)',
        'Madya (Kasus)', 'Madya INA-CBG (Rp M)', 'Madya iDRG (Rp M)',
        'Utama (Kasus)', 'Utama INA-CBG (Rp M)', 'Utama iDRG (Rp M)',
        'Paripurna (Kasus)', 'Paripurna INA-CBG (Rp M)', 'Paripurna iDRG (Rp M)',
        'Total (Kasus)', 'Total INA-CBG (Rp M)', 'Total iDRG (Rp M)'
      ];

      const groupHeaders = [
        { label: 'NO', colSpan: 1, rowSpan: 2, fill: '#0f766e' },
        { label: 'Kelompok Layanan', colSpan: 1, rowSpan: 2, fill: '#0f766e' },
        { label: 'Dasar', colSpan: 3, rowSpan: 1, fill: '#1e3a8a' },
        { label: 'Madya', colSpan: 3, rowSpan: 1, fill: '#1e3a8a' },
        { label: 'Utama', colSpan: 3, rowSpan: 1, fill: '#1e3a8a' },
        { label: 'Paripurna', colSpan: 3, rowSpan: 1, fill: '#1e3a8a' },
        { label: 'Total', colSpan: 3, rowSpan: 1, fill: '#047857' },
        { label: 'Kasus', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'INA-CBG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'iDRG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'Kasus', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'INA-CBG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'iDRG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'Kasus', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'INA-CBG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'iDRG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'Kasus', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'INA-CBG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'iDRG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'Kasus', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'INA-CBG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' },
        { label: 'iDRG (Rp M)', colSpan: 1, rowSpan: 1, fill: '#0f766e' }
      ];

      return {
        type: 'standard',
        sheetName: 'Analisis_Kompetensi_ICD',
        headers,
        groupHeaders,
        dataRows
      };
    };

    const sheetsToExport = [
      exportDataRef.current.Skenario_DasarMadya,
      generateRegionalKompetensiExcel(regionalServiceDemand, simulasi),
      exportDataRef.current.Skenario_DasarMadyaUtama,
      exportDataRef.current.Rincian_Level_Kompetensi,
      exportDataRef.current.Kompetensi_RS_Skenario_1,
      exportDataRef.current.Kompetensi_RS_Skenario_2
    ].filter(Boolean);

    await exportDashboardStrategisMaster(sheetsToExport, `Kertas_Kerja_Strategis_${selectedRs?.label || 'RS'}_${simulasi}.xlsx`);
  };

  useEffect(() => {
    setArrowsReady(false);
    const tm = setTimeout(() => setArrowsReady(true), 150);
    return () => clearTimeout(tm);
  }, [selectedRs, selectedProvinsi, selectedKabupaten]);

  const [rsProfilesData, setRsProfilesData] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'shifting', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'rs_profiles', globalMonth, globalDrg)
    ])
      .then(([hospJson, shiftingJson, profilesJson]) => {
        setData(hospJson);
        setShiftingData(shiftingJson);
        
        const lowerProfiles = {};
        for (const [rsId, pData] of Object.entries(profilesJson)) {
          const newProf = { ...pData };
          if (newProf.svc) {
            const newSvc = {};
            for (const [k, v] of Object.entries(newProf.svc)) {
              newSvc[k.toLowerCase().trim()] = v;
            }
            newProf.svc = newSvc;
          }
          if (newProf.scorecard && newProf.scorecard.byKelompok) {
            const newByKelompok = {};
            for (const [k, v] of Object.entries(newProf.scorecard.byKelompok)) {
              newByKelompok[k.toLowerCase().trim()] = v;
            }
            newProf.scorecard = { ...newProf.scorecard, byKelompok: newByKelompok };
          }
          lowerProfiles[rsId] = newProf;
        }
        setRsProfilesData(lowerProfiles);
        
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [dataset]);

  // When RS changes, auto-select its province if both are empty
  useEffect(() => {
    if (selectedRs && selectedProvinsi.length === 0 && selectedKabupaten.length === 0) {
      setSelectedProvinsi([{ value: selectedRs.prop, label: selectedRs.prop }]);
    }
  }, [selectedRs]);

  // Generate options based on data
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

  const exportToPNG = async () => {
    if (!dashboardRef.current) return;
    
    // Save original styles
    const originalStyle = dashboardRef.current.style.cssText;
    
    // Add landscape class to force 4 columns for scenarios and 3840px width
    dashboardRef.current.classList.add('exporting-landscape');
    dashboardRef.current.style.backgroundColor = '#f8fafc'; // Matches background
    dashboardRef.current.style.padding = '40px';
    
    // Give the browser a moment to recalculate layout
    await new Promise(resolve => setTimeout(resolve, 300));

    const canvas = await html2canvas(dashboardRef.current, { 
      scale: 2, // 3840px * 2 = 7680px (Ultra high density)
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f8fafc',
      windowWidth: 3840,
      ignoreElements: (element) => {
        return element.classList && element.classList.contains('no-export');
      }
    });
    
    // Restore original styles
    dashboardRef.current.classList.remove('exporting-landscape');
    dashboardRef.current.style.cssText = originalStyle;

    const link = document.createElement('a');
    link.download = `Dashboard_Strategis_${selectedRs?.label || 'RS'}_Landscape_UHD.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportToPPT = async () => {
    if (!dashboardRef.current) return;
    
    let pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';

    const mapElement = document.getElementById('map-container-export');
    let mapImgData = null;
    if (mapElement) {
      const mapCanvas = await html2canvas(mapElement, { scale: 2, useCORS: true, allowTaint: true });
      mapImgData = mapCanvas.toDataURL('image/png');
    }

    const shiftingElement = document.getElementById('shifting-table-export');
    let shiftingImgData = null;
    if (shiftingElement) {
      const shiftingCanvas = await html2canvas(shiftingElement, { scale: 2, useCORS: true, allowTaint: true });
      shiftingImgData = shiftingCanvas.toDataURL('image/png');
    }

    // ========== SLIDE 1: OVERVIEW ==========
    let slide1 = pres.addSlide();
    slide1.addText(`PROFIL & KASUS REGIONAL: ${targetRsObj?.nama || 'RS'}`, { x: 0.5, y: 0.2, w: '90%', h: 0.4, fontSize: 20, bold: true, color: '00B1A0' });
    slide1.addText(`Berdasarkan data INA-CBG dan iDRG untuk wilayah regional terpilih.`, { x: 0.5, y: 0.6, w: '90%', h: 0.2, fontSize: 11, color: '64748b' });
    
    if (mapImgData) {
      slide1.addImage({ data: mapImgData, x: 0.5, y: 0.8, w: 4.0, h: 4.5, sizing: { type: 'contain' } });
    }

    // Top 5 RS Table
    slide1.addText('TOP 5 RUMAH SAKIT', { x: 4.8, y: 0.8, w: 4.5, h: 0.3, fontSize: 10, bold: true, color: '334155' });
    const top5Rows = [
      [{ text: 'NO', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'RUMAH SAKIT', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'KELAS', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'KASUS', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }]
    ];
    top5RS.forEach((rs, i) => {
      top5Rows.push([
        i+1, 
        rs.nama || rs.label || rs.value, 
        rs.kelasFaskes || '-', 
        rs.kasus?.toLocaleString()
      ]);
    });
    slide1.addTable(top5Rows, { x: 4.8, y: 1.1, w: 4.5, fill: 'ffffff', fontSize: 8, border: { pt: 1, color: 'e2e8f0' }, colW: [0.5, 2.0, 0.8, 1.0] });

    // Gambaran Kasus Wilayah Table
    const wilayahRows = [
      [{ text: 'TINGKAT', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'KASUS', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: '%', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'PENDAPATAN (INA)', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }]
    ];
    KOMPETENSI_LEVELS.forEach(k => {
      const pct = regKasus > 0 ? (kompCount[k].kasus / regKasus)*100 : 0;
      wilayahRows.push([
        k, 
        kompCount[k].kasus.toLocaleString(), 
        `${pct.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`, 
        formatCompactCurrency(kompCount[k].ina)
      ]);
    });
    wilayahRows.push([
      { text: 'TOTAL REGIONAL', options: { bold: true, fill: 'f1f5f9' } }, 
      { text: regKasus.toLocaleString(), options: { bold: true, fill: 'f1f5f9' } }, 
      { text: '100.0%', options: { bold: true, fill: 'f1f5f9' } }, 
      { text: formatCompactCurrency(regIna), options: { bold: true, fill: 'f1f5f9' } }
    ]);
    
    slide1.addText('GAMBARAN KASUS WILAYAH', { x: 4.8, y: 3.2, w: 4.5, h: 0.3, fontSize: 10, bold: true, color: '334155' });
    slide1.addTable(wilayahRows, { x: 4.8, y: 3.5, w: 4.5, fill: 'ffffff', fontSize: 8, border: { pt: 1, color: 'e2e8f0' }, colW: [1.2, 1.0, 0.8, 1.5] });

    // Profil RS Table
    const rsRows = [
      [{ text: 'TINGKAT', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'KASUS', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: '% RS', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: '% REGIONAL', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'INA-CBG', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'iDRG', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'SELISIH', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }]
    ];
    KOMPETENSI_LEVELS.forEach(k => {
      const pctRs = targetKasusTotal > 0 ? (targetKomp[k].kasus / targetKasusTotal)*100 : 0;
      const pctReg = kompCount[k].kasus > 0 ? (targetKomp[k].kasus / kompCount[k].kasus)*100 : 0;
      const ina = targetKomp[k].ina;
      const idrg = targetKomp[k].sim;
      const diff = idrg - ina;
      rsRows.push([
        k, 
        targetKomp[k].kasus.toLocaleString(), 
        `${pctRs.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`,
        `${pctReg.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`,
        formatCompactCurrency(ina),
        formatCompactCurrency(idrg),
        { text: (diff > 0 ? '+' : '') + formatCompactCurrency(diff), options: { color: diff > 0 ? '16a34a' : diff < 0 ? 'dc2626' : '64748b' } }
      ]);
    });
    const totalPctReg = regKasus > 0 ? (targetKasusTotal / regKasus)*100 : 0;
    rsRows.push([
      { text: 'TOTAL RS', options: { bold: true, fill: 'f1f5f9' } }, 
      { text: targetKasusTotal.toLocaleString(), options: { bold: true, fill: 'f1f5f9' } }, 
      { text: '100.0%', options: { bold: true, fill: 'f1f5f9' } }, 
      { text: `${totalPctReg.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`, options: { bold: true, fill: 'f1f5f9', color: '0ea5e9' } }, 
      { text: formatCompactCurrency(targetInaTotal), options: { bold: true, fill: 'f1f5f9' } }, 
      { text: formatCompactCurrency(targetSimTotal), options: { bold: true, fill: 'f1f5f9', color: '1d4ed8' } },
      { text: ((targetSimTotal - targetInaTotal) > 0 ? '+' : '') + formatCompactCurrency(targetSimTotal - targetInaTotal), options: { bold: true, fill: 'f1f5f9', color: (targetSimTotal - targetInaTotal) > 0 ? '16a34a' : 'dc2626' } }
    ]);
    
    // ========== SLIDE 2: RINGKASAN & INSIGHT REGIONAL ==========
    let slide2 = pres.addSlide();
    slide2.addText('RINGKASAN & INSIGHT REGIONAL', { x: 0.5, y: 0.2, w: '90%', h: 0.4, fontSize: 20, bold: true, color: '00B1A0' });

    // Sebaran Kelas RS Aktif
    slide2.addText('SEBARAN KELAS RS AKTIF', { x: 0.5, y: 0.8, w: 4.0, h: 0.3, fontSize: 12, bold: true, color: '334155' });
    const kelasRows = [
      [{ text: 'KELAS', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }, { text: 'JUMLAH RS', options: { bold: true, fill: '00B1A0', color: 'ffffff' } }]
    ];
    ['A', 'B', 'C', 'D', 'Lainnya'].forEach(k => {
      kelasRows.push([`Kelas ${k}`, (kelasCount[k] || 0).toLocaleString()]);
    });
    const totalKelas = ['A', 'B', 'C', 'D', 'Lainnya'].reduce((sum, k) => sum + (kelasCount[k] || 0), 0);
    kelasRows.push([{ text: 'TOTAL RS', options: { bold: true, fill: 'f1f5f9' } }, { text: totalKelas.toLocaleString(), options: { bold: true, fill: 'f1f5f9' } }]);
    slide2.addTable(kelasRows, { x: 0.5, y: 1.2, w: 4.0, fill: 'ffffff', fontSize: 10, border: { pt: 1, color: 'e2e8f0' }, colW: [2.0, 2.0] });

    // Total Ringkasan Regional
    slide2.addText('TOTAL RINGKASAN REGIONAL', { x: 5.0, y: 0.8, w: 4.5, h: 0.3, fontSize: 12, bold: true, color: '334155' });
    
    slide2.addShape(pres.ShapeType.rect, { x: 5.0, y: 1.2, w: 4.5, h: 0.8, fill: 'f8fafc', line: { color: 'e2e8f0', width: 1 } });
    slide2.addText('TOTAL KASUS REGIONAL', { x: 5.1, y: 1.3, w: 4.3, h: 0.2, fontSize: 10, color: '64748b' });
    slide2.addText(regKasus.toLocaleString(), { x: 5.1, y: 1.5, w: 4.3, h: 0.4, fontSize: 18, bold: true, color: '00B1A0' });

    slide2.addShape(pres.ShapeType.rect, { x: 5.0, y: 2.1, w: 4.5, h: 0.8, fill: 'f8fafc', line: { color: 'e2e8f0', width: 1 } });
    slide2.addText('PENDAPATAN INA-CBG REGIONAL', { x: 5.1, y: 2.2, w: 4.3, h: 0.2, fontSize: 10, color: '64748b' });
    slide2.addText(formatCompactCurrency(regIna), { x: 5.1, y: 2.4, w: 4.3, h: 0.4, fontSize: 18, bold: true, color: '00B1A0' });

    slide2.addShape(pres.ShapeType.rect, { x: 5.0, y: 3.0, w: 4.5, h: 0.8, fill: 'f8fafc', line: { color: 'e2e8f0', width: 1 } });
    slide2.addText('POTENSI iDRG REGIONAL', { x: 5.1, y: 3.1, w: 4.3, h: 0.2, fontSize: 10, color: '64748b' });
    slide2.addText(formatCompactCurrency(regSim), { x: 5.1, y: 3.3, w: 4.3, h: 0.4, fontSize: 18, bold: true, color: '1d4ed8' });

    // Insight Regional
    slide2.addText('INSIGHT REGIONAL', { x: 0.5, y: 4.0, w: 4.0, h: 0.3, fontSize: 12, bold: true, color: '334155' });
    const idrgDiff = regSim - regIna;
    const diffPct = regIna > 0 ? (idrgDiff / regIna) * 100 : 0;
    const topKomp = [...KOMPETENSI_LEVELS].sort((a, b) => kompCount[b].kasus - kompCount[a].kasus)[0];
    const bullet1 = `Terdapat ${regKasus.toLocaleString()} total kasus pada layanan regional yang dianalisis.`;
    const bullet2 = `Penyebaran kasus terbanyak berada pada kompetensi ${topKomp} (${kompCount[topKomp]?.kasus.toLocaleString()} kasus).`;
    const bullet3 = `Secara keseluruhan, sistem iDRG memberikan ${idrgDiff > 0 ? 'potensi kenaikan' : 'penurunan'} pendapatan regional sebesar ${formatCompactCurrency(Math.abs(idrgDiff))} (${diffPct > 0 ? '+' : ''}${diffPct.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%).`;

    slide2.addText(
      [
        { text: bullet1, options: { bullet: true } },
        { text: bullet2, options: { bullet: true } },
        { text: bullet3, options: { bullet: true } }
      ],
      { x: 0.5, y: 4.3, w: 9.0, h: 1.0, fontSize: 11, color: '334155', valign: 'top' }
    );

    // ========== SLIDE 3: PROFIL RS ==========
    let slide3 = pres.addSlide();
    slide3.addText('PROFIL PENDAPATAN RS (EKSISTING VS iDRG)', { x: 0.5, y: 0.4, w: '90%', h: 0.5, fontSize: 22, bold: true, color: '00B1A0' });
    slide3.addTable(rsRows, { x: 0.5, y: 1.2, w: 9, fill: 'ffffff', fontSize: 12, border: { pt: 1, color: 'e2e8f0' } });

    // ========== SLIDE 4: SIMULASI SHIFTING ==========
    if (shiftingImgData) {
      let slideShifting = pres.addSlide();
      slideShifting.addText('SIMULASI PERUBAHAN KASUS & PENDAPATAN', { x: 0.5, y: 0.2, w: '90%', h: 0.4, fontSize: 20, bold: true, color: '00B1A0' });
      slideShifting.addText('Analisis shifting layanan berdasarkan kompetensi RS', { x: 0.5, y: 0.6, w: '90%', h: 0.2, fontSize: 11, color: '64748b' });
      slideShifting.addImage({ data: shiftingImgData, x: 0.5, y: 1.0, w: 9.0, h: 4.0, sizing: { type: 'contain' } });
    }


    // Helper to generate scenario tables
    const generateScenarioSlide = (slide, scenIds, title, startY) => {
      slide.addText(title, { x: 0.5, y: 0.2, w: '90%', h: 0.4, fontSize: 20, bold: true, color: '00B1A0' });
      
      scenIds.forEach((scenId, index) => {
        const yOffset = startY + (index * 2.5); // Increased from 2.3 to 2.5 to give more space
        const scenNum = scenId === 's1' ? 1 : scenId === 's2' ? 2 : scenId === 's3' ? 3 : 4;
        
        slide.addText(`SKENARIO ${scenNum}`, { x: 0.5, y: yOffset, w: '90%', h: 0.3, fontSize: 12, bold: true, color: 'ffffff', fill: scenNum===1?'00B1A0':scenNum===2?'0369a1':scenNum===3?'b45309':'b91c1c', align: 'center' });
        
        const scenRows = [
          [{ text: 'TINGKAT', options: { bold: true, fill: 'f1f5f9' } }, { text: 'TOTAL REGIONAL', options: { bold: true, fill: 'f1f5f9' } }, { text: 'TARGET', options: { bold: true, fill: 'f1f5f9' } }, { text: 'PROYEKSI DISERAP', options: { bold: true, fill: 'f1f5f9' } }, { text: 'PENDAPATAN EKSISTING', options: { bold: true, fill: 'f1f5f9' } }, { text: 'PROYEKSI PENDAPATAN', options: { bold: true, fill: 'f1f5f9' } }]
        ];
        
        let sumReg = 0;
        let sumDiserap = 0;
        let sumPendEksisting = 0;
        let sumProyPend = 0;

        KOMPETENSI_LEVELS.forEach(k => {
          const regionalKasus = kompCount[k].kasus;
          const pct = pcts[scenId][k];
          const targetDiserap = Math.round(regionalKasus * (pct/100));
          const avgSim = regionalKasus > 0 ? (kompCount[k].sim / regionalKasus) : 0;
          const proyPendapatan = targetDiserap * avgSim;

          sumReg += regionalKasus;
          sumDiserap += targetDiserap;
          sumPendEksisting += targetKomp[k].ina;
          sumProyPend += proyPendapatan;

          scenRows.push([
            k, 
            regionalKasus.toLocaleString(), 
            `${pct}%`, 
            targetDiserap.toLocaleString(), 
            formatCompactCurrency(targetKomp[k].ina),
            { text: formatCompactCurrency(proyPendapatan), options: { color: '00B1A0', bold: true } }
          ]);
        });
        
        scenRows.push([
          { text: 'TOTAL', options: { bold: true, fill: 'f1f5f9' } }, 
          { text: sumReg.toLocaleString(), options: { bold: true, fill: 'f1f5f9' } }, 
          { text: '-', options: { bold: true, fill: 'f1f5f9' } }, 
          { text: sumDiserap.toLocaleString(), options: { bold: true, fill: 'f1f5f9', color: '00B1A0' } },
          { text: formatCompactCurrency(sumPendEksisting), options: { bold: true, fill: 'f1f5f9' } },
          { text: formatCompactCurrency(sumProyPend), options: { bold: true, fill: 'f1f5f9', color: '00B1A0' } }
        ]);

        slide.addTable(scenRows, { x: 0.5, y: yOffset + 0.35, w: 9, fill: 'ffffff', fontSize: 8, border: { pt: 1, color: 'e2e8f0' }, colW: [1.0, 1.5, 1.0, 1.5, 2.0, 2.0] });
        
        const diff = sumProyPend - sumPendEksisting;
        const msg = diff > 0 ? 'Proyeksi Pendapatan Naik' : diff < 0 ? 'Proyeksi Pendapatan Turun' : 'Pendapatan Tetap';
        const color = diff > 0 ? '16a34a' : diff < 0 ? 'dc2626' : '64748b';
        slide.addText(`${msg}  |  ${diff > 0 ? '+' : ''}${formatCompactCurrency(diff)}`, { x: 0.5, y: yOffset + 2.1, w: 9, h: 0.25, fontSize: 10, bold: true, color: color, align: 'right' });
      });
    };

    // ========== SLIDE 4: SCENARIO 1 & 2 ==========
    let slide4 = pres.addSlide();
    generateScenarioSlide(slide4, ['s1', 's2'], `SIMULASI MARKET SHARE (SKENARIO 1 & 2)`, 0.6);

    // ========== SLIDE 5: SCENARIO 3 & 4 ==========
    let slide5 = pres.addSlide();
    generateScenarioSlide(slide5, ['s3', 's4'], `SIMULASI MARKET SHARE (SKENARIO 3 & 4)`, 0.6);

    pres.writeFile({ fileName: `Dashboard_Strategis_${selectedRs?.label || 'RS'}.pptx` });
  };

  const simulasiKey = `tarif_${simulasi}`;

  const filteredHospitalTotals = useMemo(() => {
    if (!shiftingData) return {};
    let totals = {};
    const hasJaboSel = selectedProvinsi.some(p => p.value === 'JABODETABEK');
    const hasJabarExBeboSel = selectedProvinsi.some(p => p.value === 'Jabar ex Bebodepok');
    const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];
    
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
            const normKel = kel.toLowerCase().trim();
            if (activeLayananFilters.length > 0 && !activeLayananFilters.includes(normKel)) continue;
            
            const shiftNode = shiftingData[prop][kab][kel];
            if (shiftNode.demandByRs) {
              for (const rsId in shiftNode.demandByRs) {
                if (!totals[rsId]) totals[rsId] = { kasus: 0, inacbg: 0, sim: 0 };
                const d = shiftNode.demandByRs[rsId].kasusByKlaim;
                if (d) {
                  for (const komp in d) {
                    let safeKomp = komp.charAt(0).toUpperCase() + komp.slice(1);
                    if (excludeNonKomp && !['Dasar', 'Madya', 'Utama', 'Paripurna'].includes(safeKomp)) continue;
                    totals[rsId].kasus += d[komp].kasus || 0;
                    totals[rsId].inacbg += d[komp].inacbg || 0;
                    totals[rsId].sim += d[komp].sim?.[simulasiKey] || 0;
                  }
                }
              }
            }
          }
        }
      }
    }
    return totals;
  }, [shiftingData, excludeNonKomp, simulasiKey, selectedProvinsi, selectedKabupaten, groupFilter]);

  if (loading || !data || !shiftingData) return <div style={{padding: 40, textAlign: 'center'}}>Mempersiapkan Data Regional (membutuhkan beberapa detik)...</div>;

  const targetRsObj = selectedRs && data[selectedRs.value] ? { ...data[selectedRs.value], kode: selectedRs.value } : null;

  // Build Regional Data
  const regionalRS = Object.entries(data).filter(([kode, rs]) => {
    const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];
    if (activeLayananFilters.length > 0 && (!filteredHospitalTotals[kode] || filteredHospitalTotals[kode].kasus === 0)) return false;
    if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return false;
    const hasJabo = selectedProvinsi.some(p => p.value === 'JABODETABEK');
    const hasJabarExBebo = selectedProvinsi.some(p => p.value === 'Jabar ex Bebodepok');
    const matchProv = selectedProvinsi.length > 0 && (selectedProvinsi.some(p => p.value === rs.prop) || (hasJabo && isJabo(rs.kab, rs.prop)) || (hasJabarExBebo && isJabarExBebo(rs.kab, rs.prop)));
    const matchKab = selectedKabupaten.length > 0 && selectedKabupaten.some(k => k.value === `${rs.kab} (${rs.prop})`);
    
    if (selectedProvinsi.length === 0 && selectedKabupaten.length === 0) return true;
    if (selectedProvinsi.length > 0 && selectedKabupaten.length === 0) return matchProv;
    if (selectedProvinsi.length === 0 && selectedKabupaten.length > 0) return matchKab;
    // When Kab is selected, it takes priority — filter by kab regardless of prov
    return selectedKabupaten.length > 0 ? matchKab : matchProv;
  }).map(e => {
    const rsId = e[0];
    const originalRs = e[1];
    let copy = { ...originalRs, kode: rsId };
    if (filteredHospitalTotals[rsId]) {
      copy.kasus = filteredHospitalTotals[rsId].kasus;
      copy.inacbg = filteredHospitalTotals[rsId].inacbg;
      copy.sim = filteredHospitalTotals[rsId].sim;
    } else if (activeLayananFilters.length === 0) {
      copy.kasus = (originalRs.ri?.kasus || 0) + (originalRs.rj?.kasus || 0);
      copy.inacbg = (originalRs.ri?.inacbg || 0) + (originalRs.rj?.inacbg || 0);
      copy.sim = 0;
    } else {
      copy.kasus = 0;
      copy.inacbg = 0;
      copy.sim = 0;
    }
    return copy;
  });

  // Calculate Regional Stats from shiftingData (to use klaim_kompetensi)
  let regKasus = 0;
  let regIna = 0;
  let regSim = 0;
  const kelasCount = { A: 0, B: 0, C: 0, D: 0, Lainnya: 0 };
  const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];
  const KOMPETENSI_LEVELS = activeLayananFilters.length > 0 ? ['Dasar', 'Madya', 'Utama', 'Paripurna'] : ALL_KOMPETENSI_LEVELS;
  const kompCount = { Dasar: {kasus:0, ina:0, sim:0}, Madya: {kasus:0, ina:0, sim:0}, Utama: {kasus:0, ina:0, sim:0}, Paripurna: {kasus:0, ina:0, sim:0}, Lainnya: {kasus:0, ina:0, sim:0} };

  regionalRS.forEach(rs => {
    const kelas = (rs.kelasFaskes || '').toUpperCase();
    if (kelasCount[kelas] !== undefined) kelasCount[kelas]++;
    else kelasCount.Lainnya++;
  });

  const hasJaboSel = selectedProvinsi.length > 0 && selectedProvinsi.some(p => p.value === 'JABODETABEK');
  const hasJabarExBeboSel = selectedProvinsi.length > 0 && selectedProvinsi.some(p => p.value === 'Jabar ex Bebodepok');

  // New structure to store regional service potential dynamically
  const regionalServiceDemand = {};

  if (shiftingData) {
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

            const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];
            if (activeLayananFilters.length > 0 && !activeLayananFilters.includes(normKel)) {
              continue;
            }
            if (!regionalServiceDemand[normKel]) {
              regionalServiceDemand[normKel] = {
                dasar: { kasus: 0, inacbg: 0, sim: 0 },
                madya: { kasus: 0, inacbg: 0, sim: 0 },
                utama: { kasus: 0, inacbg: 0, sim: 0 },
                paripurna: { kasus: 0, inacbg: 0, sim: 0 }
              };
            }

            const hasActiveFilter = rsFilter || (groupFilter && groupFilter.length > 0) || (wilayahFilter && wilayahFilter.length > 0) || (kabFilter && kabFilter.length > 0) || excludeNonKomp;
            let activeDemand = {};
            if (hasActiveFilter && shiftNode.demandByRs) {
              for (const rsId in shiftNode.demandByRs) {
                const rsObj = data[rsId];
                if (rsObj && filterHospital(rsObj, rsId, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) {
                  for (const komp in shiftNode.demandByRs[rsId].kasusByKlaim || {}) {
                    const compKey = komp.toLowerCase().trim();
                    if (!activeDemand[compKey]) activeDemand[compKey] = { kasus: 0, inacbg: 0, sim: 0 };
                    const d = shiftNode.demandByRs[rsId].kasusByKlaim[komp];
                    activeDemand[compKey].kasus += d.kasus || 0;
                    activeDemand[compKey].inacbg += d.inacbg || 0;
                    activeDemand[compKey].sim += d.sim?.[simulasiKey] || 0;
                  }
                }
              }
            } else {
              for (const komp in shiftNode.demand || {}) {
                const compKey = komp.toLowerCase().trim();
                if (!activeDemand[compKey]) activeDemand[compKey] = { kasus: 0, inacbg: 0, sim: 0 };
                const d = shiftNode.demand[komp];
                activeDemand[compKey].kasus += d.kasus || 0;
                activeDemand[compKey].inacbg += d.inacbg || 0;
                activeDemand[compKey].sim += d.sim?.[simulasiKey] || 0;
              }
            }

            for (const compKey in activeDemand) {
              let safeKomp = compKey.charAt(0).toUpperCase() + compKey.slice(1);
              if (excludeNonKomp && !['Dasar', 'Madya', 'Utama', 'Paripurna'].includes(safeKomp)) continue;
              
              if (regionalServiceDemand[normKel]) {
                const targetKey = ['dasar', 'madya', 'utama', 'paripurna'].includes(compKey) ? compKey : 'lainnya';
                if (!regionalServiceDemand[normKel][targetKey]) regionalServiceDemand[normKel][targetKey] = { kasus: 0, inacbg: 0, sim: 0 };
                regionalServiceDemand[normKel][targetKey].kasus += activeDemand[compKey].kasus || 0;
                regionalServiceDemand[normKel][targetKey].inacbg += activeDemand[compKey].inacbg || 0;
                regionalServiceDemand[normKel][targetKey].sim += activeDemand[compKey].sim || 0;
              }
            }

            if (activeDemand) {
              for (const compKey in activeDemand) {
                let safeKomp = compKey.charAt(0).toUpperCase() + compKey.slice(1);
                if (excludeNonKomp && !['Dasar', 'Madya', 'Utama', 'Paripurna'].includes(safeKomp)) continue;

                const dataKomp = activeDemand[compKey];
                regKasus += dataKomp.kasus || 0;
                regIna += dataKomp.inacbg || 0;
                regSim += dataKomp.sim || 0;
                
                if (kompCount[safeKomp]) {
                  kompCount[safeKomp].kasus += dataKomp.kasus || 0;
                  kompCount[safeKomp].ina += dataKomp.inacbg || 0;
                  kompCount[safeKomp].sim += dataKomp.sim || 0;
                } else {
                  kompCount.Lainnya.kasus += dataKomp.kasus || 0;
                  kompCount.Lainnya.ina += dataKomp.inacbg || 0;
                  kompCount.Lainnya.sim += dataKomp.sim || 0;
                }
              }
            }
          }
        }
      }
    }
  }

  const top5RS = [...regionalRS].sort((a,b) => (b.kasus||0) - (a.kasus||0)).slice(0, 5);

  // Helper for Infographic Map Nodes
  let displayRegions = [];
  if (selectedProvinsi.length === 0 && selectedKabupaten.length === 0) {
    displayRegions = ['Semua Wilayah'];
  } else {
    displayRegions = [
      ...selectedProvinsi.map(p => p.value),
      ...selectedKabupaten.map(k => k.value.split(' (')[0])
    ];
  }

  // Target RS Profil
  const targetKomp = { Dasar: {kasus:0, ina:0, sim:0}, Madya: {kasus:0, ina:0, sim:0}, Utama: {kasus:0, ina:0, sim:0}, Paripurna: {kasus:0, ina:0, sim:0}, Lainnya: {kasus:0, ina:0, sim:0} };
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
            if (excludeNonKomp && !['Dasar', 'Madya', 'Utama', 'Paripurna'].includes(safeKomp)) return;

            const srcSim = cObj.sim || cObj;
            const simVal = srcSim[simulasiKey] || 0;

            targetKasusTotal += cObj.kasus || 0;
            targetInaTotal += cObj.inacbg || 0;
            targetSimTotal += simVal;

            if (targetKomp[safeKomp]) {
              targetKomp[safeKomp].kasus += cObj.kasus || 0;
              targetKomp[safeKomp].ina += cObj.inacbg || 0;
              targetKomp[safeKomp].sim += simVal;
            } else {
              targetKomp.Lainnya.kasus += cObj.kasus || 0;
              targetKomp.Lainnya.ina += cObj.inacbg || 0;
              targetKomp.Lainnya.sim += simVal;
            }
          });
        });
      };

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

  let tambahanKasus = 0;
  let tambahanPendapatan = 0;
  let penguranganKasus = 0;
  let penguranganPendapatan = 0;
  let targetTambahArr = [];
  let targetKurangArr = [];

  if (activeTipeSimulasi === 1) {
    targetTambahArr = ['Paripurna'];
    targetKurangArr = ['Dasar', 'Madya', 'Utama'];
  } else if (activeTipeSimulasi === 2) {
    targetTambahArr = ['Utama', 'Paripurna'];
    targetKurangArr = ['Dasar', 'Madya'];
  } else if (activeTipeSimulasi === 3) {
    targetTambahArr = ['Madya', 'Utama', 'Paripurna'];
    targetKurangArr = ['Dasar'];
  } else if (activeTipeSimulasi === 4) {
    targetTambahArr = ['Dasar'];
    targetKurangArr = ['Madya', 'Utama', 'Paripurna'];
  } else if (activeTipeSimulasi === 5) {
    targetTambahArr = ['Dasar', 'Madya'];
    targetKurangArr = ['Utama', 'Paripurna'];
  } else if (activeTipeSimulasi === 6) {
    targetTambahArr = ['Utama'];
    targetKurangArr = ['Dasar', 'Madya', 'Paripurna'];
  } else if (activeTipeSimulasi === 7) {
    targetTambahArr = ['Dasar', 'Madya', 'Utama'];
    targetKurangArr = ['Paripurna'];
  } else if (activeTipeSimulasi === 8) {
    targetTambahArr = ['Madya'];
    targetKurangArr = ['Dasar', 'Utama', 'Paripurna'];
  }

  Object.keys(regionalServiceDemand).forEach(layanan => {
    let rsLvl = 'Tidak Kompeten';
    if (rsKompetensiOnline && selectedRs?.value && rsKompetensiOnline[selectedRs.value] && rsKompetensiOnline[selectedRs.value][layanan]) {
      rsLvl = rsKompetensiOnline[selectedRs.value][layanan];
    }
    const safeKomp = rsLvl.charAt(0).toUpperCase() + rsLvl.slice(1);

    // Hitung penambahan (hanya jika RS memiliki kompetensi yang masuk dalam skenario Tambah)
    if (targetTambahArr.includes(safeKomp)) {
      targetTambahArr.forEach(k => {
        const kLower = k.toLowerCase();
        // Cari ketersediaan regional untuk layanan & level kasus tersebut
        const regCases = regionalServiceDemand[layanan][kLower]?.kasus || 0;
        const regSim = regionalServiceDemand[layanan][kLower]?.sim || 0;
        
        // Cari berapa yang sudah dihandle RS
        let eksCases = 0;
        let eksSim = 0;
        if (targetRsObj?.crosstab?.byLayanan?.[layanan]?.byKompetensi) {
          const lData = targetRsObj.crosstab.byLayanan[layanan].byKompetensi;
          Object.values(lData).forEach(kelasMap => {
            ['ri', 'rj'].forEach(tipe => {
              if (kelasMap[tipe] && kelasMap[tipe][kLower]) {
                 eksCases += kelasMap[tipe][kLower].kasus || 0;
                 eksSim += kelasMap[tipe][kLower].sim?.[simulasiKey] || 0;
              }
            });
          });
        }
        
        const availableCases = Math.max(0, regCases - eksCases);
        tambahanKasus += availableCases;
        if (regCases > 0) {
          const avgSim = regSim / regCases;
          tambahanPendapatan += availableCases * avgSim;
        }
      });
    }

    // Hitung pengurangan (jika RS memiliki kasus pada level yang masuk dalam skenario Kurang)
    targetKurangArr.forEach(k => {
      const kLower = k.toLowerCase();
      if (targetRsObj?.crosstab?.byLayanan?.[layanan]?.byKompetensi) {
        const lData = targetRsObj.crosstab.byLayanan[layanan].byKompetensi;
        Object.values(lData).forEach(kelasMap => {
          ['ri', 'rj'].forEach(tipe => {
            if (kelasMap[tipe] && kelasMap[tipe][kLower]) {
               penguranganKasus += kelasMap[tipe][kLower].kasus || 0;
               penguranganPendapatan += kelasMap[tipe][kLower].sim?.[simulasiKey] || 0;
            }
          });
        });
      }
    });
  });

  const copyPromptToClipboard = () => {
    let prompt = `Tolong lakukan analisis strategis dan berikan rekomendasi bisnis untuk Rumah Sakit berikut berdasarkan data market share regional.\n\n`;
    prompt += `**PROFIL RUMAH SAKIT UTAMA**\n`;
    prompt += `- Nama RS: ${targetRsObj?.nama || 'RS'}\n`;
    prompt += `- Total Kasus: ${targetKasusTotal.toLocaleString('id-ID')}\n`;
    prompt += `- Pendapatan INA-CBG: ${formatCompactCurrency(targetInaTotal)}\n`;
    prompt += `- Potensi Pendapatan iDRG (Simulasi ${simulasi}): ${formatCompactCurrency(targetSimTotal)}\n`;
    prompt += `- Selisih (iDRG - INA-CBG): ${formatCompactCurrency(targetSimTotal - targetInaTotal)}\n\n`;

    prompt += `**DATA REGIONAL & KOMPETITOR**\n`;
    prompt += `- Total Kasus Regional: ${regKasus.toLocaleString('id-ID')}\n`;
    prompt += `- Total Pendapatan INA-CBG Regional: ${formatCompactCurrency(regIna)}\n`;
    prompt += `- Potensi Pendapatan iDRG Regional: ${formatCompactCurrency(regSim)}\n\n`;
    
    prompt += `**TOP 5 RS KOMPETITOR DI REGIONAL**\n`;
    top5RS.forEach((rs, i) => {
      prompt += `${i + 1}. ${rs.nama || rs.label || rs.value} (Kelas ${rs.kelasFaskes || '-'}): Kasus = ${rs.kasus?.toLocaleString('id-ID')}, INA-CBG = ${formatCompactCurrency(rs.inacbg)}, iDRG = ${formatCompactCurrency(rs.sim)}\n`;
    });
    
    prompt += `\n**SIMULASI MARKET SHARE (Berdasarkan Setting Persentase - Tipe ${activeTipeSimulasi})**\n`;
    skenarioList.forEach(sken => {
      const pctTambah = sken.pctTambah / 100;
      const pctKurang = sken.pctKurang / 100;
      const netKasus = Math.round(tambahanKasus * pctTambah) - Math.round(penguranganKasus * pctKurang);
      const netPendapatan = (tambahanPendapatan * pctTambah) - (penguranganPendapatan * pctKurang);
      prompt += `- ${sken.label} (Serap ${sken.pctTambah}% ${targetTambahArr.join('/')}, Lepas ${sken.pctKurang}% ${targetKurangArr.join('/')}): Net Kasus = ${netKasus > 0 ? '+' : ''}${netKasus.toLocaleString('id-ID')}, Net Pendapatan = ${netPendapatan >= 0 ? '+' : ''}${formatCompactCurrency(netPendapatan)}\n`;
    });

    prompt += `\n**INSTRUKSI UNTUK AI:**\n`;
    prompt += `1. Analisis posisi kompetitif ${targetRsObj?.nama || 'RS'} dibandingkan dengan Top 5 kompetitor.\n`;
    prompt += `2. Berikan rekomendasi strategis berdasarkan skenario simulasi di atas (Skenario mana yang paling menguntungkan / feasible?).\n`;
    prompt += `3. Evaluasi apakah sistem iDRG menguntungkan atau merugikan RS ini, serta strategi mitigasi/optimalisasi yang bisa dilakukan.\n`;

    navigator.clipboard.writeText(prompt)
      .then(() => alert('Prompt berhasil disalin ke clipboard! Silakan paste ke AI seperti ChatGPT atau Claude.'))
      .catch(err => console.error('Gagal menyalin:', err));
  };
  
  return (
    <div style={{background: '#f8fafc', minHeight: '100vh', padding: '16px'}}>
      
      {/* ── CONTROLS ── */}
      <div className="strategic-controls" style={{ marginBottom: '16px' }}>
        <div className="control-group">
          <span className="control-label">Pilih Rumah Sakit Analisis</span>
          <Select
            options={rsOptions}
            value={selectedRs}
            onChange={setSelectedRs}
            placeholder="Ketik & Pilih RS..."
          />
        </div>
        <div className="control-group" style={{ flex: 1 }}>
          <span className="control-label">Provinsi Kompetitor</span>
          <Select
            options={provOpts}
            value={selectedProvinsi}
            onChange={setSelectedProvinsi}
            isMulti
            placeholder="Pilih Provinsi..."
          />
        </div>
        <div className="control-group" style={{ flex: 1 }}>
          <span className="control-label">Kab/Kota Kompetitor</span>
          <Select
            options={kabOpts}
            value={selectedKabupaten}
            onChange={setSelectedKabupaten}
            isMulti
            placeholder="Pilih Kab/Kota..."
          />
        </div>
        <div className="export-buttons">
          <button className="btn-export" style={{ background: '#6366f1', borderColor: '#4f46e5', color: 'white' }} onClick={copyPromptToClipboard}>
            <Copy size={15}/> Copy Prompt AI
          </button>
          <button className="btn-export btn-export-excel" onClick={handleDownloadExcelKertasKerjaStrategis} style={{background: '#10b981', borderColor: '#059669', color: 'white'}}><Download size={15}/> Kertas Kerja (Excel)</button>
          <button className="btn-export btn-export-png" onClick={exportToPNG}><Download size={15}/> Export PNG</button>
          <button className="btn-export btn-export-ppt" onClick={exportToPPT}><Download size={15}/> Export PPT</button>
        </div>
      </div>

      {!selectedRs ? (
        <div style={{textAlign:'center', padding: '120px 0', color: '#94a3b8'}}>
          <Target size={56} style={{margin: '0 auto 16px', opacity: 0.3, display:'block'}} />
          <h3 style={{margin:0, fontWeight:700, fontSize:'1.1rem'}}>Pilih Rumah Sakit terlebih dahulu</h3>
          <p style={{margin:'8px 0 0', fontSize:'0.9rem'}}>Gunakan dropdown di atas untuk memilih rumah sakit dan wilayah kompetitor</p>
        </div>
      ) : loading ? (
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'80vh', flexDirection:'column'}}>
          <div className="loader" style={{width:'50px', height:'50px', border:'5px solid #e2e8f0', borderTopColor:'#00B1A0', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div>
          <p style={{margin:'16px 0 0', fontWeight:600, color:'#0f766e'}}>Memuat Dashboard Analisis Regional...</p>
        </div>
      ) : (
        <div className="strategic-dashboard-container" ref={dashboardRef} style={{fontFamily:"'Inter','Segoe UI',sans-serif", background:'white', color:'#1e293b', padding:'20px', minWidth:'1400px', display:'flex', flexDirection:'column', gap:'12px', borderRadius:'12px', boxShadow:'0 4px 12px rgba(0,0,0,0.05)'}}>

          {/* ── HEADER ── */}
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px'}}>
            {/* Left: Titles */}
            <div style={{display:'flex', alignItems:'center', gap:'16px', flex:1}}>
              <div>
                <div style={{fontSize:'1.1rem', fontWeight:800, color:'#0f172a', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.5px'}}>ANALISIS KASUS REGIONAL & POTENSI PENGEMBANGAN</div>
                <div style={{fontSize:'2.2rem', fontWeight:900, color:'#00B1A0', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'-0.5px', lineHeight:1.1}}>{targetRsObj?.nama || 'RS'}</div>
                <div style={{color:'#0f172a', fontSize:'0.9rem', fontWeight:600}}>Berdasarkan data INA-CBG dan iDRG untuk wilayah regional terpilih</div>
              </div>
            </div>

            {/* Right: 4 Stat Cards */}
            <div style={{display:'flex', gap:'12px', flexShrink:0}}>
              {/* Card 1: Total Kasus Regional */}
              <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', display:'flex', minWidth:'250px', overflow:'hidden'}}>
                <div style={{background:'white', padding:'12px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <Users size={32} color="#0f766e" />
                </div>
                <div style={{padding:'8px 16px', display:'flex', flexDirection:'column', justifyContent:'center', flex:1}}>
                  <div style={{fontSize:'0.65rem', fontWeight:700, color:'#475569', textTransform:'uppercase'}}>TOTAL KASUS REGIONAL</div>
                  <div style={{fontSize:'1.6rem', fontWeight:900, color:'#0f766e', lineHeight:1.1}}>{regKasus >= 1000000 ? (regKasus/1000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' JUTA' : regKasus >= 1000 ? (regKasus/1000).toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})+'K' : regKasus}</div>
                  <div style={{fontSize:'0.75rem', fontWeight:700, color:'#0f172a', marginTop:'2px'}}>{regKasus.toLocaleString('id-ID')} Kasus</div>
                  <div className="custom-scrollbar" style={{maxHeight: '85px', overflowY: 'auto', marginTop: '6px', fontSize: '0.65rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px'}}>
                    {Object.entries(regionalServiceDemand).map(([svc, levels]) => {
                      if (svc === 'unknown') return null;
                      const title = svc.replace(/\b\w/g, l => l.toUpperCase());
                      const badges = ['dasar', 'madya', 'utama', 'paripurna'].map(k => {
                         const val = levels[k]?.kasus || 0;
                         if (val === 0) return null;
                         return (
                           <div key={k} style={{background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap', display: 'inline-block'}}>
                             <span style={{fontWeight: 700}}>{k.charAt(0).toUpperCase() + k.slice(1)}</span> {val.toLocaleString('id-ID')}
                           </div>
                         );
                      }).filter(Boolean);
                      
                      if (badges.length === 0) return null;
                      return (
                        <div key={svc} style={{display: 'flex', flexDirection: 'column', gap: '3px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '6px'}}>
                          <div style={{fontWeight: 800, color: '#0f766e'}}>{title}</div>
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                            {badges}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {/* Card 2: Pendapatan Eksisting */}
              <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', display:'flex', minWidth:'220px', overflow:'hidden'}}>
                <div style={{background:'white', padding:'12px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <Briefcase size={32} color="#475569" />
                </div>
                <div style={{padding:'8px 16px', display:'flex', flexDirection:'column', justifyContent:'center', flex:1}}>
                  <div style={{fontSize:'0.65rem', fontWeight:700, color:'#475569', textTransform:'uppercase'}}>PENDAPATAN EKSISTING</div>
                  <div style={{fontSize:'1.6rem', fontWeight:900, color:'#334155', lineHeight:1.1}}>{regIna >= 1000000000000 ? (regIna/1000000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' T' : formatCompactCurrency(regIna)}</div>
                  <div style={{fontSize:'0.75rem', fontWeight:700, color:'#0f172a', marginTop:'2px'}}>{new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}).format(regIna).replace(',00', '')}</div>
                </div>
              </div>

              {/* Card 3: Potensi iDRG */}
              <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', display:'flex', minWidth:'220px', overflow:'hidden'}}>
                <div style={{background:'white', padding:'12px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <TrendingUp size={32} color="#0369a1" />
                </div>
                <div style={{padding:'8px 16px', display:'flex', flexDirection:'column', justifyContent:'center', flex:1}}>
                  <div style={{fontSize:'0.65rem', fontWeight:700, color:'#475569', textTransform:'uppercase'}}>POTENSI iDRG</div>
                  <div style={{fontSize:'1.6rem', fontWeight:900, color:'#0369a1', lineHeight:1.1}}>{regSim >= 1000000000000 ? (regSim/1000000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' T' : formatCompactCurrency(regSim)}</div>
                  <div style={{fontSize:'0.75rem', fontWeight:700, color:'#0f172a', marginTop:'2px'}}>{new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', minimumFractionDigits:0}).format(regSim).replace(',00', '')}</div>
                </div>
              </div>

              {/* Card 4: Potensi Tambahan */}
              <div style={{border:'1.5px solid #00B1A0', borderRadius:'8px', display:'flex', minWidth:'220px', overflow:'hidden'}}>
                <div style={{background:'white', padding:'12px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <ArrowUpRight size={38} color="#00B1A0" style={{background:'#f0fdfa', borderRadius:'50%', padding:'6px'}}/>
                </div>
                <div style={{padding:'8px 16px', display:'flex', flexDirection:'column', justifyContent:'center', flex:1}}>
                  <div style={{fontSize:'0.65rem', fontWeight:700, color:'#475569', textTransform:'uppercase'}}>POTENSI TAMBAHAN</div>
                  <div style={{fontSize:'1.4rem', fontWeight:900, color:'#00B1A0', lineHeight:1.1}}>{(regSim-regIna) >= 1000000000 ? ((regSim-regIna)/1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' M' : formatCompactCurrency(regSim-regIna)}</div>
                  <div style={{fontSize:'0.85rem', fontWeight:800, color:'#0f172a', marginTop:'2px'}}>(+{regIna>0 ? (((regSim-regIna)/regIna)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',',') : 0}%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 1: PETA, WILAYAH, PROFIL RS ── */}
          <div style={{display:'grid', gridTemplateColumns:'0.8fr 1fr 2.4fr', gap:'12px'}}>
            
            {/* COL 1: Peta Regional */}
            <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', overflow:'hidden', display:'flex', flexDirection:'column'}}>
              <div style={{background:'#0f172a', color:'white', padding:'8px 12px', fontSize:'0.8rem', fontWeight:800, display:'flex', alignItems:'center', gap:'8px'}}>
                <div style={{background:'white', color:'#0f172a', width:'18px', height:'18px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem'}}>1</div>
                PETA REGIONAL WILAYAH
              </div>
              <div style={{padding:'12px', flex:1, display:'flex', flexDirection:'column', gap:'12px', background:'#f8fafc'}}>
                <div style={{fontSize:'0.75rem', fontWeight:700, color:'#0f172a'}}>REGIONAL: {displayRegions.join(', ').toUpperCase()}</div>
                <div id="map-container-export" style={{flex:1, minHeight:'380px', borderRadius:'8px', overflow:'hidden', border:'1px solid #e2e8f0'}}>
                  <MapRujukan
                    selectedProvinces={selectedProvinsi}
                    selectedHospital={selectedRs}
                    shiftingData={shiftingData}
                  />
                </div>
                {/* Sebaran Kelas RS Aktif */}
                <div>
                  <div style={{background:'#0f766e', color:'white', fontSize:'0.65rem', fontWeight:700, padding:'4px 8px', display:'inline-block'}}>SEBARAN KELAS RS AKTIF</div>
                  <div style={{display:'flex', border:'1px solid #cbd5e1', background:'white'}}>
                    {['A','B','C','D'].map(k => (
                      <div key={k} style={{flex:1, borderRight:'1px solid #cbd5e1', textAlign:'center', padding:'4px 0'}}>
                        <div style={{background: k==='A'?'#0369a1':k==='B'?'#0f766e':k==='C'?'#4d7c0f':'#ea580c', color:'white', fontSize:'0.55rem', fontWeight:800, padding:'2px 0'}}>KELAS {k}</div>
                        <div style={{fontSize:'1.2rem', fontWeight:900, color:'#0f172a', margin:'4px 0 0'}}>{kelasCount[k]||0}</div>
                        <div style={{fontSize:'0.55rem', fontWeight:700, color:'#64748b'}}>RS</div>
                      </div>
                    ))}
                    <div style={{flex:1, borderRight:'1px solid #cbd5e1', textAlign:'center', padding:'4px 0'}}>
                        <div style={{background:'#64748b', color:'white', fontSize:'0.55rem', fontWeight:800, padding:'2px 0'}}>KELAS LAINNYA</div>
                        <div style={{fontSize:'1.2rem', fontWeight:900, color:'#0f172a', margin:'4px 0 0'}}>0</div>
                        <div style={{fontSize:'0.55rem', fontWeight:700, color:'#64748b'}}>RS</div>
                    </div>
                    <div style={{flex:1, textAlign:'center', padding:'4px 0'}}>
                        <div style={{background:'#0f172a', color:'white', fontSize:'0.55rem', fontWeight:800, padding:'2px 0'}}>TOTAL RS</div>
                        <div style={{fontSize:'1.2rem', fontWeight:900, color:'#0f172a', margin:'4px 0 0'}}>{regionalRS.length}</div>
                        <div style={{fontSize:'0.55rem', fontWeight:700, color:'#64748b'}}>RS</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COL 2: Gambaran Kasus Wilayah */}
            <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', overflow:'hidden', display:'flex', flexDirection:'column'}}>
              <div style={{background:'#0f172a', color:'white', padding:'8px 12px', fontSize:'0.8rem', fontWeight:800, display:'flex', alignItems:'center', gap:'8px'}}>
                <div style={{background:'white', color:'#0f172a', width:'18px', height:'18px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem'}}>2</div>
                GAMBARAN KASUS WILAYAH
              </div>
              <div style={{padding:'12px', flex:1, display:'flex', flexDirection:'column', gap:'12px', background:'white'}}>
                <div style={{fontSize:'0.75rem', fontWeight:800, color:'#0f172a', textAlign:'center', borderBottom:'2px solid #e2e8f0', paddingBottom:'4px'}}>RINCIAN TINGKAT KOMPETENSI (REGIONAL)</div>
                <table style={{width:'100%', fontSize:'0.75rem', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{borderBottom:'2px solid #cbd5e1'}}>
                      <th style={{padding:'6px 4px', textAlign:'left'}}>TINGKAT</th>
                      <th style={{padding:'6px 4px', textAlign:'center'}}>KASUS</th>
                      <th style={{padding:'6px 4px', textAlign:'center'}}>%</th>
                      <th style={{padding:'6px 4px', textAlign:'right'}}>EKSISTING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KOMPETENSI_LEVELS.map(k => {
                      const pct = regKasus > 0 ? (kompCount[k].kasus / regKasus)*100 : 0;
                      const colors = {'Dasar':'#0369a1', 'Madya':'#0f766e', 'Utama':'#4d7c0f', 'Paripurna':'#ea580c', 'Lainnya':'#64748b'};
                      return (
                        <tr key={k} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={{padding:'6px 4px', fontWeight:700, color:colors[k], display:'flex', alignItems:'center', gap:'6px'}}><span style={{width:'10px', height:'10px', borderRadius:'50%', background:colors[k]}}></span>{k}</td>
                          <td style={{padding:'6px 4px', textAlign:'center', fontWeight:800}}>{kompCount[k].kasus.toLocaleString().replace(/,/g,'.')}</td>
                          <td style={{padding:'6px 4px', textAlign:'center', fontWeight:700}}>{pct.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',',')}%</td>
                          <td style={{padding:'6px 4px', textAlign:'right', fontWeight:800}}>{formatTableMiliar(kompCount[k].ina).replace('Rp','Rp ').replace('.',',')}</td>
                        </tr>
                      );
                    })}
                    <tr style={{background:'#f8fafc', borderTop:'2px solid #cbd5e1'}}>
                      <td style={{padding:'8px 4px', fontWeight:800, color:'#0f172a'}}>TOTAL REGIONAL</td>
                      <td style={{padding:'8px 4px', textAlign:'center', fontWeight:900, color:'#0f172a'}}>{regKasus.toLocaleString().replace(/,/g,'.')}</td>
                      <td style={{padding:'8px 4px', textAlign:'center', fontWeight:800, color:'#0f172a'}}>100,0%</td>
                      <td style={{padding:'8px 4px', textAlign:'right', fontWeight:900, color:'#0f172a'}}>{regIna >= 1000000000000 ? 'Rp '+(regIna/1000000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' T' : formatTableMiliar(regIna)}</td>
                    </tr>
                  </tbody>
                </table>
                
                {/* Donut Chart Distribusi Kasus */}
                <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
                  <div style={{fontSize:'0.75rem', fontWeight:800, color:'#0f172a', textAlign:'center', marginBottom:'8px'}}>DISTRIBUSI KASUS REGIONAL</div>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', width:'100%', minHeight:'220px', gap:'16px', padding: '10px 0'}}>
                    <div style={{width:'180px', height:'180px'}}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <PieChart>
                          <Pie
                            data={KOMPETENSI_LEVELS.map(k => ({name: k, value: kompCount[k].kasus, color: {'Dasar':'#0369a1', 'Madya':'#0f766e', 'Utama':'#4d7c0f', 'Paripurna':'#ea580c', 'Lainnya':'#64748b'}[k]}))}
                            cx="50%" cy="50%"
                            innerRadius={55} outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {KOMPETENSI_LEVELS.map((k, index) => (
                              <Cell key={`cell-${index}`} fill={{'Dasar':'#0369a1', 'Madya':'#0f766e', 'Utama':'#4d7c0f', 'Paripurna':'#ea580c', 'Lainnya':'#64748b'}[k]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => val.toLocaleString()} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div style={{display:'flex', flexDirection:'column', gap:'6px'}}>
                      {KOMPETENSI_LEVELS.map(k => {
                        const pct = regKasus > 0 ? (kompCount[k].kasus / regKasus)*100 : 0;
                        const colors = {'Dasar':'#0369a1', 'Madya':'#0f766e', 'Utama':'#4d7c0f', 'Paripurna':'#ea580c', 'Lainnya':'#64748b'};
                        return (
                          <div key={k} style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'0.65rem'}}>
                            <span style={{width:'10px', height:'10px', background:colors[k], borderRadius:'2px'}}></span>
                            <span style={{fontWeight:700, width:'50px'}}>{k}</span>
                            <span style={{fontWeight:800}}>{kompCount[k].kasus.toLocaleString().replace(/,/g,'.')}</span>
                            <span style={{color:'#64748b'}}>({pct.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',',')}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COL 3: Profil RS & Top 5 RS */}
            <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', overflow:'hidden', display:'flex', flexDirection:'column'}}>
              <div style={{background:'#0f172a', color:'white', padding:'8px 12px', fontSize:'0.8rem', fontWeight:800, display:'flex', alignItems:'center', gap:'8px'}}>
                <div style={{background:'white', color:'#0f172a', width:'18px', height:'18px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem'}}>3</div>
                PROFIL {targetRsObj?.nama?.toUpperCase() || 'RS'}
              </div>
              <div style={{padding:'12px', flex:1, display:'flex', gap:'16px', background:'white'}}>
                {/* Left side of Col 3: Profil RS Table & Incomes */}
                <div style={{flex:1.4, display:'flex', flexDirection:'column', gap:'12px'}}>
                  {/* Income Boxes Side by Side */}
                  <div style={{display:'flex', gap:'12px'}}>
                    <div style={{flex:1, border:'1px solid #cbd5e1', borderRadius:'6px', padding:'12px', textAlign:'center', background:'#f8fafc'}}>
                      <div style={{fontSize:'0.7rem', fontWeight:800, color:'#0f172a', marginBottom:'4px'}}>PENDAPATAN INA-CBG</div>
                      <div style={{fontSize:'1.6rem', fontWeight:900, color:'#0f172a', lineHeight:1.1}}>{targetInaTotal >= 1000000000 ? (targetInaTotal/1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' M' : formatCompactCurrency(targetInaTotal)}</div>
                      <div style={{fontSize:'0.7rem', fontWeight:700, color:'#475569', marginTop:'4px'}}>Dari {targetKasusTotal.toLocaleString().replace(/,/g,'.')} Kasus RS</div>
                    </div>
                    <div style={{flex:1, border:'1px solid #cbd5e1', borderRadius:'6px', padding:'12px', textAlign:'center', background:'#f0fdfa'}}>
                      <div style={{fontSize:'0.7rem', fontWeight:800, color:'#0f172a', marginBottom:'4px'}}>PENDAPATAN iDRG</div>
                      <div style={{fontSize:'1.6rem', fontWeight:900, color:'#0f172a', lineHeight:1.1}}>{targetSimTotal >= 1000000000 ? (targetSimTotal/1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' M' : formatCompactCurrency(targetSimTotal)}</div>
                      <div style={{fontSize:'0.7rem', fontWeight:700, color:'#475569', marginTop:'4px'}}>Dari {targetKasusTotal.toLocaleString().replace(/,/g,'.')} Kasus RS</div>
                    </div>
                  </div>
                  {/* Table Rincian RS vs Regional */}
                  <div style={{flex:1}}>
                    <div style={{fontSize:'0.7rem', fontWeight:800, color:'#0f172a', textAlign:'center', borderBottom:'2px solid #e2e8f0', paddingBottom:'4px'}}>RINCIAN TINGKAT KOMPETENSI RS vs REGIONAL</div>
                    <table style={{width:'100%', fontSize:'0.65rem', borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{borderBottom:'2px solid #cbd5e1'}}>
                          <th style={{padding:'6px 2px', textAlign:'left'}}>TINGKAT</th>
                          <th style={{padding:'6px 2px', textAlign:'center'}}>KASUS RS</th>
                          <th style={{padding:'6px 2px', textAlign:'center'}}>% DARI RS</th>
                          <th style={{padding:'6px 2px', textAlign:'center'}}>% DARI REGIONAL</th>
                          <th style={{padding:'6px 2px', textAlign:'right'}}>EKSISTING</th>
                          <th style={{padding:'6px 2px', textAlign:'right'}}>PROYEKSI</th>
                          <th style={{padding:'6px 2px', textAlign:'right'}}>SELISIH (Rp Miliar)</th>
                          <th style={{padding:'6px 2px', textAlign:'right'}}>% SELISIH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {KOMPETENSI_LEVELS.map(k => {
                          const pctRs = targetKasusTotal > 0 ? (targetKomp[k].kasus / targetKasusTotal)*100 : 0;
                          const pctReg = kompCount[k].kasus > 0 ? (targetKomp[k].kasus / kompCount[k].kasus)*100 : 0;
                          const diff = targetKomp[k].sim - targetKomp[k].ina;
                          const pctDiff = targetKomp[k].ina > 0 ? (diff / targetKomp[k].ina) * 100 : 0;
                          const colors = {'Dasar':'#0369a1', 'Madya':'#0f766e', 'Utama':'#4d7c0f', 'Paripurna':'#ea580c', 'Lainnya':'#64748b'};
                          return (
                            <tr key={k} style={{borderBottom:'1px solid #f1f5f9'}}>
                              <td style={{padding:'6px 2px', fontWeight:700, color:colors[k], display:'flex', alignItems:'center', gap:'4px'}}><span style={{width:'8px', height:'8px', borderRadius:'50%', background:colors[k]}}></span>{k}</td>
                              <td style={{padding:'6px 2px', textAlign:'center', fontWeight:800}}>{targetKomp[k].kasus.toLocaleString().replace(/,/g,'.')}</td>
                              <td style={{padding:'6px 2px', textAlign:'center', fontWeight:700}}>{pctRs.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',',')}%</td>
                              <td style={{padding:'6px 2px', textAlign:'center', fontWeight:700}}>{pctReg.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',',')}%</td>
                              <td style={{padding:'6px 2px', textAlign:'right', fontWeight:700, color:'#475569'}}>{formatTableMiliar(targetKomp[k].ina)}</td>
                              <td style={{padding:'6px 2px', textAlign:'right', fontWeight:800, color:'#0f172a'}}>{formatTableMiliar(targetKomp[k].sim)}</td>
                              <td style={{padding:'6px 2px', textAlign:'right', fontWeight:800, color:diff>0?'#16a34a':'#dc2626'}}>{diff>0?'+':''}{formatTableMiliar(Math.abs(diff))}</td>
                              <td style={{padding:'6px 2px', textAlign:'right', fontWeight:800, color:diff>0?'#16a34a':'#dc2626'}}>{diff>0?'+':''}{pctDiff.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',',')}%</td>
                            </tr>
                          );
                        })}
                        <tr style={{background:'#f8fafc', borderTop:'2px solid #cbd5e1'}}>
                          <td style={{padding:'6px 2px', fontWeight:800, color:'#0f172a'}}>TOTAL RS</td>
                          <td style={{padding:'6px 2px', textAlign:'center', fontWeight:900, color:'#0f172a'}}>{targetKasusTotal.toLocaleString().replace(/,/g,'.')}</td>
                          <td style={{padding:'6px 2px', textAlign:'center', fontWeight:800, color:'#0f172a'}}>100,0%</td>
                          <td style={{padding:'6px 2px', textAlign:'center', fontWeight:800, color:'#0f172a'}}>{regKasus>0?((targetKasusTotal/regKasus)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',','):0}%</td>
                          <td style={{padding:'6px 2px', textAlign:'right', fontWeight:800, color:'#0f172a'}}>{formatTableMiliar(targetInaTotal)}</td>
                          <td style={{padding:'6px 2px', textAlign:'right', fontWeight:900, color:'#0f172a'}}>{formatTableMiliar(targetSimTotal)}</td>
                          <td style={{padding:'6px 2px', textAlign:'right', fontWeight:900, color:(targetSimTotal-targetInaTotal)>0?'#16a34a':'#dc2626'}}>{(targetSimTotal-targetInaTotal)>0?'+':''}{formatTableMiliar(Math.abs(targetSimTotal-targetInaTotal))}</td>
                          <td style={{padding:'6px 2px', textAlign:'right', fontWeight:900, color:(targetSimTotal-targetInaTotal)>0?'#16a34a':'#dc2626'}}>{(targetSimTotal-targetInaTotal)>0?'+':''}{(targetInaTotal>0?((targetSimTotal-targetInaTotal)/targetInaTotal)*100:0).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',',')}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right side of Col 3: Top 5 RS */}
                <div style={{flex:0.8, border:'1.5px solid #cbd5e1', borderRadius:'8px', overflow:'hidden', display:'flex', flexDirection:'column'}}>
                  <div style={{background:'#0f766e', color:'white', padding:'8px', fontSize:'0.65rem', fontWeight:800, textAlign:'center'}}>TOP 5 RUMAH SAKIT (BERDASARKAN KASUS)</div>
                  <div className='custom-scrollbar' style={{padding:'8px', flex:1, background:'#f8fafc', overflowX:'auto', overflowY:'auto', maxHeight:'none'}}>
                    <table style={{width:'100%', fontSize:'0.65rem', borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{borderBottom:'2px solid #cbd5e1'}}>
                          <th style={{padding:'6px 2px', textAlign:'center', width:'20px'}}>NO</th>
                          <th style={{padding:'6px 2px', textAlign:'left'}}>RUMAH SAKIT</th>
                          <th style={{padding:'6px 2px', textAlign:'center'}}>KELAS</th>
                          <th style={{padding:'6px 2px', textAlign:'center'}}>KASUS</th>
                          <th style={{padding:'6px 2px', textAlign:'right'}}>EKSISTING</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top5RS.map((rs,i) => (
                          <tr key={i} style={{borderBottom:'1px solid #e2e8f0'}}>
                            <td style={{padding:'6px 2px', textAlign:'center', fontWeight:800, color:'#0f172a'}}>{i+1}</td>
                            <td style={{padding:'6px 2px', fontWeight:800, color:'#0f172a', maxWidth:'100px'}}>{rs.nama}</td>
                            <td style={{padding:'6px 2px', textAlign:'center', fontWeight:800, color:'#0f172a'}}>{rs.kelasFaskes}</td>
                            <td style={{padding:'6px 2px', textAlign:'center', fontWeight:800, color:'#0f172a'}}>{rs.kasus?.toLocaleString().replace(/,/g,'.')}</td>
                            <td style={{padding:'6px 2px', textAlign:'right', fontWeight:800, color:'#0f172a'}}>{formatTableMiliar(rs.inacbg)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 2: RINGKASAN & SKENARIO ── */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 3fr', gap:'12px'}}>
            
            {/* COL 1: Ringkasan & Insight Regional */}
            <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', overflow:'hidden', display:'flex', flexDirection:'column'}}>
              <div style={{background:'#0f766e', color:'white', padding:'8px 12px', fontSize:'0.8rem', fontWeight:800, display:'flex', alignItems:'center', gap:'8px'}}>
                RINGKASAN & INSIGHT REGIONAL
              </div>
              <div style={{display:'flex', padding:'12px', gap:'12px', background:'white', flex:1}}>
                {/* 3 Stats vertically */}
                <div style={{flex:0.8, display:'flex', flexDirection:'column', gap:'12px'}}>
                  <div>
                    <div style={{fontSize:'0.6rem', fontWeight:800, color:'#0f172a', textTransform:'uppercase'}}>TOTAL RINGKASAN REGIONAL</div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px', marginTop:'4px'}}>
                      <Users size={20} color="#0f766e" />
                      <div>
                        <div style={{fontSize:'0.55rem', fontWeight:700, color:'#475569'}}>TOTAL KASUS REGIONAL</div>
                        <div style={{fontSize:'1.1rem', fontWeight:900, color:'#0f172a', lineHeight:1}}>{regKasus.toLocaleString().replace(/,/g,'.')}</div>
                        <div style={{fontSize:'0.55rem', fontWeight:700, color:'#0f172a'}}>Kasus</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <Briefcase size={20} color="#0f766e" />
                      <div>
                        <div style={{fontSize:'0.55rem', fontWeight:700, color:'#475569'}}>PENDAPATAN INA-CBG REGIONAL<br/>EKSISTING</div>
                        <div style={{fontSize:'1.1rem', fontWeight:900, color:'#0f766e', lineHeight:1}}>{regIna >= 1000000000000 ? (regIna/1000000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' T' : formatCompactCurrency(regIna)}</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <TrendingUp size={20} color="#0369a1" />
                      <div>
                        <div style={{fontSize:'0.55rem', fontWeight:700, color:'#475569'}}>POTENSI iDRG REGIONAL</div>
                        <div style={{fontSize:'1.1rem', fontWeight:900, color:'#0369a1', lineHeight:1}}>{regSim >= 1000000000000 ? (regSim/1000000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',',')+' T' : formatCompactCurrency(regSim)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Insight bullets */}
                <div style={{flex:1, borderLeft:'1px solid #cbd5e1', paddingLeft:'12px', display:'flex', flexDirection:'column', gap:'12px'}}>
                  <div style={{fontSize:'0.6rem', fontWeight:800, color:'#0f172a', textTransform:'uppercase'}}>INSIGHT REGIONAL</div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <CheckCircle size={16} color="#0f766e" style={{flexShrink:0, marginTop:'2px'}}/>
                    <div style={{fontSize:'0.65rem', fontWeight:600, color:'#0f172a', lineHeight:1.4}}>Terdapat <strong>{regKasus.toLocaleString().replace(/,/g,'.')}</strong> total kasus pada layanan regional yang dianalisis.</div>
                  </div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <CheckCircle size={16} color="#0f766e" style={{flexShrink:0, marginTop:'2px'}}/>
                    <div style={{fontSize:'0.65rem', fontWeight:600, color:'#0f172a', lineHeight:1.4}}>Penyebaran kasus terbanyak berada pada kompetensi Dasar (<strong>{kompCount.Dasar.kasus.toLocaleString().replace(/,/g,'.')} Kasus</strong>).</div>
                  </div>
                  <div style={{display:'flex', gap:'8px'}}>
                    <CheckCircle size={16} color="#0f766e" style={{flexShrink:0, marginTop:'2px'}}/>
                    <div style={{fontSize:'0.65rem', fontWeight:600, color:'#0f172a', lineHeight:1.4}}>Secara keseluruhan, sistem iDRG memberikan potensi kenaikan pendapatan regional sebesar <strong>Rp {(regSim-regIna)>=1000000000?((regSim-regIna)/1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.',','):formatCompactCurrency(regSim-regIna)} M (+{regIna>0 ? (((regSim-regIna)/regIna)*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.',',') : 0}%)</strong>.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* COL 2: 4 Skenario */}
            <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', overflow:'hidden', display:'flex', flexDirection:'column'}}>
              <div style={{background:'#0f172a', color:'white', padding:'8px 12px', fontSize:'0.8rem', fontWeight:800, display:'flex', alignItems:'center', gap:'8px'}}>
                <div style={{background:'white', color:'#0f172a', width:'18px', height:'18px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem'}}>4</div>
                SIMULASI MARKET SHARE & PROYEKSI SERAPAN KASUS UTAMA & PARIPURNA
              </div>
              <div style={{display:'flex', background:'white', flex:1, overflowX:'auto'}}>
                {[
                  {id:'s1', title:'SKENARIO 1', subtitle:'OPTIMISTIK', color:'#0f766e'},
                  {id:'s2', title:'SKENARIO 2', subtitle:'SANGAT BAIK', color:'#0369a1'},
                  {id:'s3', title:'SKENARIO 3', subtitle:'MODERAT', color:'#d97706'},
                  {id:'s4', title:'SKENARIO 4', subtitle:'KONSERVATIF', color:'#dc2626'}
                ].map((s, idx) => {
                  const targetPcts = pcts[s.id];
                  let sumDiserap = 0;
                  let sumTargetIna = 0;
                  let sumTargetSim = 0;
                  KOMPETENSI_LEVELS.forEach(k => {
                    const available = Math.max(0, kompCount[k].kasus - targetKomp[k].kasus);
                    const diserap = Math.round(available * (targetPcts[k]/100));
                    sumDiserap += diserap;
                    if(kompCount[k].kasus > 0) {
                      const avgIna = kompCount[k].ina / kompCount[k].kasus;
                      const avgSim = kompCount[k].sim / kompCount[k].kasus;
                      sumTargetIna += (targetKomp[k].kasus + diserap) * avgIna;
                      sumTargetSim += (targetKomp[k].kasus + diserap) * avgSim;
                    }
                  });
                  const targetSimNet = sumTargetSim;
                  const deltaSim = targetSimNet - targetInaTotal;

                  return (
                    <div key={s.id} style={{flex:1, minWidth:'300px', display:'flex', flexDirection:'column', borderRight: idx<3 ? '1px solid #cbd5e1' : 'none'}}>
                      <div style={{background:s.color, color:'white', textAlign:'center', padding:'6px', fontSize:'0.7rem', fontWeight:800, display:'flex', flexDirection:'column', position:'relative'}}>
                        <span>{s.title}</span>
                        <span style={{fontSize:'0.55rem', fontWeight:600}}>{s.subtitle}</span>
                        
                        <div data-html2canvas-ignore="true" style={{marginTop:'4px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px', padding:'4px', background:'rgba(255,255,255,0.15)', borderRadius:'4px'}}>
                           {['Dasar', 'Madya', 'Utama', 'Paripurna'].map(level => (
                             <div key={level} style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'2px'}}>
                               <span style={{fontSize:'0.5rem', fontWeight:600}}>{level.substring(0,4)}:</span>
                               <div style={{display:'flex', alignItems:'center', background:'white', borderRadius:'2px', padding:'0 2px'}}>
                                 <input type="number" min="0" max="100" step="1" value={targetPcts[level]} 
                                   onChange={(e) => {
                                     let val = parseInt(e.target.value);
                                     if (isNaN(val)) val = 0;
                                     if (val > 100) val = 100;
                                     if (val < 0) val = 0;
                                     setPcts(prev => ({
                                       ...prev,
                                       [s.id]: { ...prev[s.id], [level]: val }
                                     }));
                                   }}
                                   style={{width:'24px', height:'14px', fontSize:'0.55rem', fontWeight:'bold', textAlign:'center', color:'#0f172a', border:'none', padding:'0'}}
                                 />
                                 <span style={{fontSize:'0.5rem', color:'#0f172a', fontWeight:800}}>%</span>
                               </div>
                             </div>
                           ))}
                        </div>
                      </div>
                      <div style={{padding:'8px', flex:1}}>
                        <table style={{width:'100%', fontSize:'0.55rem', borderCollapse:'collapse'}}>
                          <thead>
                            <tr style={{borderBottom:'1px solid #cbd5e1'}}>
                              <th style={{padding:'4px 2px', textAlign:'left'}}>TINGKAT</th>
                              <th style={{padding:'4px 2px', textAlign:'center'}}>TOTAL<br/>KASUS</th>
                              <th style={{padding:'4px 2px', textAlign:'center'}}>TARGET</th>
                              <th style={{padding:'4px 2px', textAlign:'center'}}>KASUS<br/>DISERAP</th>
                              <th style={{padding:'4px 2px', textAlign:'right'}}>EKSISTING<br/>(Rp)</th>
                              <th style={{padding:'4px 2px', textAlign:'right'}}>PROYEKSI<br/>(Rp)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {KOMPETENSI_LEVELS.map(k => {
                              const available = Math.max(0, kompCount[k].kasus - targetKomp[k].kasus);
                              const diserap = Math.round(available * (targetPcts[k]/100));
                              let pIna = 0, pSim = 0;
                              if(kompCount[k].kasus > 0) {
                                const avgIna = kompCount[k].ina / kompCount[k].kasus;
                                const avgSim = kompCount[k].sim / kompCount[k].kasus;
                                pIna = (targetKomp[k].kasus) * avgIna;
                                pSim = (targetKomp[k].kasus + diserap) * avgSim;
                              }
                              const colors = {'Dasar':'#0369a1', 'Madya':'#0f766e', 'Utama':'#4d7c0f', 'Paripurna':'#ea580c', 'Lainnya':'#64748b'};
                              return (
                                <tr key={k} style={{borderBottom:'1px solid #f1f5f9'}}>
                                  <td style={{padding:'4px 2px', fontWeight:700, color:colors[k]}}>{k}</td>
                                  <td style={{padding:'4px 2px', textAlign:'center', fontWeight:700}}>{kompCount[k].kasus.toLocaleString().replace(/,/g,'.')}</td>
                                  <td style={{padding:'4px 2px', textAlign:'center', fontWeight:800}}>{targetPcts[k]}%</td>
                                  <td style={{padding:'4px 2px', textAlign:'center', fontWeight:800}}>{diserap.toLocaleString().replace(/,/g,'.')}</td>
                                  <td style={{padding:'4px 2px', textAlign:'right', fontWeight:700}}>{formatTableMiliar(pIna)}</td>
                                  <td style={{padding:'4px 2px', textAlign:'right', fontWeight:800}}>{formatTableMiliar(pSim)}</td>
                                </tr>
                              );
                            })}
                            <tr style={{borderTop:'1px solid #cbd5e1', background:'#f8fafc'}}>
                              <td style={{padding:'4px 2px', fontWeight:800}}>TOTAL</td>
                              <td style={{padding:'4px 2px', textAlign:'center', fontWeight:800}}>{regKasus.toLocaleString().replace(/,/g,'.')}</td>
                              <td style={{padding:'4px 2px', textAlign:'center'}}>-</td>
                              <td style={{padding:'4px 2px', textAlign:'center', fontWeight:800}}>{sumDiserap.toLocaleString().replace(/,/g,'.')}</td>
                              <td style={{padding:'4px 2px', textAlign:'right', fontWeight:800}}>{formatTableMiliar(targetInaTotal)}</td>
                              <td style={{padding:'4px 2px', textAlign:'right', fontWeight:800}}>{formatTableMiliar(sumTargetSim)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {/* Box Kenaikan */}
                      <div style={{margin:'8px', border:`2px solid ${deltaSim > 0 ? (idx<2?'#0f766e':(idx===2?'#d97706':'#00B1A0')) : '#dc2626'}`, borderRadius:'6px', padding:'8px', textAlign:'center'}}>
                        <div style={{fontSize:'0.6rem', fontWeight:800, color:deltaSim > 0 ? (idx<2?'#0f766e':(idx===2?'#d97706':'#00B1A0')) : '#dc2626', textTransform:'uppercase'}}>{deltaSim > 0 ? 'PROYEKSI PENDAPATAN NAIK' : 'PROYEKSI PENDAPATAN TURUN'}</div>
                        <div style={{fontSize:'1.1rem', fontWeight:900, color:deltaSim > 0 ? (idx<2?'#0f766e':(idx===2?'#d97706':'#00B1A0')) : '#dc2626', marginTop:'4px'}}>
                          {deltaSim > 0 ? '+' : ''}{formatCompactCurrency(Math.abs(deltaSim))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── ROW 3: KESIMPULAN UTAMA ── */}
          <div style={{border:'1.5px solid #cbd5e1', borderRadius:'8px', overflow:'hidden', display:'flex', flexDirection:'row', background:'white'}}>
            <div style={{background:'#0f766e', color:'white', padding:'16px', display:'flex', gap:'12px', alignItems:'center', flex:1}}>
              <Target size={40} color="white" />
              <div>
                <div style={{fontSize:'1rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px'}}>KESIMPULAN UTAMA</div>
                <div style={{fontSize:'0.75rem', fontWeight:500, lineHeight:1.4, marginTop:'4px'}}>Dengan optimalisasi serapan kasus Utama & Paripurna,<br/>{targetRsObj?.nama || 'RS'} memiliki potensi meningkatkan<br/>pendapatan iDRG hingga <strong style={{color:'#fde047'}}>{formatCompactCurrency(regSim-regIna)}</strong> (skenario 100%)<br/>dibandingkan pendapatan eksisting.</div>
              </div>
            </div>
            {/* Box 2 */}
            <div style={{flex:0.7, borderLeft:'1px solid #cbd5e1', display:'flex', alignItems:'center', gap:'12px', padding:'16px'}}>
               <Users size={32} color="#0f172a" />
               <div>
                 <div style={{fontSize:'0.6rem', fontWeight:800, color:'#0f766e'}}>POTENSI TAMBAHAN KASUS<br/>(SKENARIO 100%) HINGGA</div>
                 <div style={{fontSize:'1.4rem', fontWeight:900, color:'#0f172a'}}>+206.190</div>
                 <div style={{fontSize:'0.65rem', fontWeight:700, color:'#64748b'}}>Kasus</div>
               </div>
            </div>
            {/* Box 3 */}
            <div style={{flex:1, borderLeft:'1px solid #cbd5e1', display:'flex', alignItems:'center', gap:'12px', padding:'16px'}}>
               <div style={{background:'#0f766e', borderRadius:'50%', padding:'8px'}}><Briefcase size={24} color="white" /></div>
               <div>
                 <div style={{fontSize:'0.6rem', fontWeight:800, color:'#0f766e'}}>POTENSI TAMBAHAN PENDAPATAN iDRG<br/>(SKENARIO 100%) HINGGA</div>
                 <div style={{fontSize:'1.4rem', fontWeight:900, color:'#0f766e'}}>+436,43 M</div>
                 <div style={{fontSize:'0.65rem', fontWeight:700, color:'#64748b'}}>Dibandingkan Eksisting</div>
               </div>
            </div>
            {/* Box 4 */}
            <div style={{flex:0.7, borderLeft:'1px solid #cbd5e1', display:'flex', alignItems:'center', gap:'12px', padding:'16px'}}>
               <TrendingUp size={32} color="#0f172a" />
               <div>
                 <div style={{fontSize:'0.6rem', fontWeight:800, color:'#0f766e'}}>KENAIKAN vs EKSISTING<br/>(PENDAPATAN)</div>
                 <div style={{fontSize:'1.4rem', fontWeight:900, color:'#0f172a'}}>+121,1%</div>
                 <div style={{fontSize:'0.65rem', fontWeight:700, color:'#64748b'}}>(Skenario 100%)</div>
               </div>
            </div>
            {/* Box 5 */}
            <div style={{flex:1, borderLeft:'1px solid #cbd5e1', display:'flex', alignItems:'center', gap:'12px', padding:'16px'}}>
               <CheckCircle size={32} color="#0f172a" />
               <div>
                 <div style={{fontSize:'0.6rem', fontWeight:800, color:'#0f766e'}}>REKOMENDASI</div>
                 <div style={{fontSize:'0.75rem', fontWeight:700, color:'#0f172a', marginTop:'4px', lineHeight:1.4}}>Perkuat layanan & kapabilitas<br/>kasus Utama & Paripurna untuk<br/>daya saing dan keberlanjutan.</div>
               </div>
            </div>
          </div>

        </div>
      )}

      {/* Skenario Shifting Table added as requested */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid var(--glass-border)', paddingBottom: '8px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 className="text-primary" style={{ margin: 0 }}>Simulasi Perubahan Kasus & Pendapatan (Tabel Shifting)</h3>
          <select 
            value={activeTipeSimulasi} 
            onChange={e => setActiveTipeSimulasi(Number(e.target.value))} 
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#0f172a', fontWeight: 'bold', fontSize: '0.85rem' }}
          >
            <option value={1}>Tipe 1: Tambahan Paripurna — Faktor Pengurang Dasar, Madya & Utama</option>
            <option value={2}>Tipe 2: Tambahan Utama & Paripurna — Faktor Pengurang Dasar & Madya</option>
            <option value={3}>Tipe 3: Tambahan Madya, Utama & Paripurna — Faktor Pengurang Dasar</option>
            <option value={4}>Tipe 4: Tambahan Dasar — Faktor Pengurang Madya, Utama & Paripurna</option>
            <option value={5}>Tipe 5: Tambahan Dasar & Madya — Faktor Pengurang Utama & Paripurna</option>
            <option value={6}>Tipe 6: Tambahan Utama — Faktor Pengurang Dasar, Madya & Paripurna</option>
            <option value={7}>Tipe 7: Tambahan Dasar, Madya & Utama — Faktor Pengurang Paripurna</option>
            <option value={8}>Tipe 8: Tambahan Madya — Faktor Pengurang Dasar, Utama & Paripurna</option>
          </select>
        </div>
        <div id="shifting-table-export">
          <SkenarioShiftingTable
            potensiKasusShifting={tambahanKasus}
            potensiPendapatanShifting={tambahanPendapatan}
            penguranganKasus={penguranganKasus}
            penguranganPendapatanInacbg={penguranganPendapatan} 
            pendapatanEksisting={targetSimTotal} // <-- "Pendapatan Eksisting iDRG" means the iDRG total without shifting
            pendapatanInacbgEksisting={targetInaTotal}
            totalKasusEksisting={targetKasusTotal}
            targetRsName={targetRsObj?.nama || 'RS'}
            skenarioList={skenarioList}
            setSkenarioList={setSkenarioList}
            labelTambah={targetTambahArr.join(' & ')}
            labelKurang={targetKurangArr.join(' & ')}
          />
        </div>
      </div>

      {/* 24 Competency Table for Scenario 1 & 2 */}
      {selectedRs && rsProfilesData && rsProfilesData[selectedRs.value] && (
        <div style={{ marginTop: '32px' }}>
          <HospitalProfileCard 
            rs={targetRsObj}
            profile={rsProfilesData[selectedRs.value]}
            simulasi={simulasi}
            isExportMode={false}
            excludeNonKomp={excludeNonKomp}
            rsKompetensiOnline={rsKompetensiOnline}
          />
          <RSIACompetencyTable 
            rsProfile={rsProfilesData[selectedRs.value]}
            targetRsObj={targetRsObj}
            simulasi={simulasi}
            isSkenario1={true}
            regionalServiceDemand={regionalServiceDemand}
            excludeNonKomp={excludeNonKomp}
            rsKompetensiOnline={rsKompetensiOnline}
            onExportData={(data) => { exportDataRef.current[data.sheetName] = data; }}
          />
          <RSIACompetencyTable 
            rsProfile={rsProfilesData[selectedRs.value]}
            targetRsObj={targetRsObj}
            simulasi={simulasi}
            isSkenario1={false}
            regionalServiceDemand={regionalServiceDemand}
            excludeNonKomp={excludeNonKomp}
            rsKompetensiOnline={rsKompetensiOnline}
            onExportData={(data) => { exportDataRef.current[data.sheetName] = data; }}
          />
          <ShiftingDetailLevelTable 
            rsProfile={rsProfilesData[selectedRs.value]}
            targetRsObj={targetRsObj}
            simulasi={simulasi}
            regionalServiceDemand={regionalServiceDemand}
            excludeNonKomp={excludeNonKomp}
            activeLayananFilters={activeLayananFilters}
            rsKompetensiOnline={rsKompetensiOnline}
            onExportData={(data) => { exportDataRef.current[data.sheetName] = data; }}
          />
          <ShiftingDasarMadyaTable
            rsProfile={rsProfilesData[selectedRs.value]}
            targetRsObj={targetRsObj}
            simulasi={simulasi}
            regionalServiceDemand={regionalServiceDemand}
            excludeNonKomp={excludeNonKomp}
            activeLayananFilters={activeLayananFilters}
            rsKompetensiOnline={rsKompetensiOnline}
          />
          <ShiftingDasarMadyaSkenarioTable
            rsProfile={rsProfilesData[selectedRs.value]}
            targetRsObj={targetRsObj}
            simulasi={simulasi}
            regionalServiceDemand={regionalServiceDemand}
            excludeNonKomp={excludeNonKomp}
            activeLayananFilters={activeLayananFilters}
            rsKompetensiOnline={rsKompetensiOnline}
            onExportData={(data) => { exportDataRef.current[data.sheetName] = data; }}
          />
          <ShiftingDasarMadyaUtamaTable
            rsProfile={rsProfilesData[selectedRs.value]}
            targetRsObj={targetRsObj}
            simulasi={simulasi}
            regionalServiceDemand={regionalServiceDemand}
            excludeNonKomp={excludeNonKomp}
            activeLayananFilters={activeLayananFilters}
            rsKompetensiOnline={rsKompetensiOnline}
          />
          <ShiftingDasarMadyaUtamaSkenarioTable
            rsProfile={rsProfilesData[selectedRs.value]}
            targetRsObj={targetRsObj}
            simulasi={simulasi}
            regionalServiceDemand={regionalServiceDemand}
            excludeNonKomp={excludeNonKomp}
            activeLayananFilters={activeLayananFilters}
            rsKompetensiOnline={rsKompetensiOnline}
            onExportData={(data) => { exportDataRef.current[data.sheetName] = data; }}
          />
        </div>
      )}
    </div>
  );
}

export default DashboardStrategis;