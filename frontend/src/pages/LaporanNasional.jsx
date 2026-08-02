import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { Activity, LayoutDashboard, PieChart, BarChart2, Table as TableIcon, Search, Download } from 'lucide-react';
import DownloadExcelButton from '../components/DownloadExcelButton';
import DownloadPptxButton from '../components/DownloadPptxButton';
import PlotlyChart from 'react-plotly.js';
const Plot = PlotlyChart.default || PlotlyChart;
import { formatCompactCurrency, formatCurrency, formatCmgLabel, formatCompactNumber , formatTableMiliar, formatMdcLabel} from '../utils/formatters';
import { matchesGroup, RS_GROUPS } from '../utils/rsGroups';
import { filterHospital } from '../utils/filterUtils';
import PlotWithSave from '../components/PlotWithSave';
import { loadDatasetFile } from '../utils/dataLoader';



const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];
const kompLabel = { paripurna: 'Paripurna', utama: 'Utama', madya: 'Madya', dasar: 'Dasar', 'belum ada komp. icd': 'Belum ada komp. ICD' };

const LaporanNasional = ({ dataset, simulasi, groupFilter, wilayahFilter = [], rsFilter, isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg } ) => {
  const [distData, setDistData] = useState(null);
  const [crossData, setCrossData] = useState(null);
  const [hospitalsData, setHospitalsData] = useState(null);
  const [rsProfilesData, setRsProfilesData] = useState(null);
  const [regionsData, setRegionsData] = useState(null);
  const [inacbgToDrgData, setInacbgToDrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  // INA-CBG lookup states
  const [inacbgSearch, setInacbgSearch] = useState('Q-5-44-0');
  const [inacbgResult, setInacbgResult] = useState(null);
  const [inacbgSort, setInacbgSort] = useState({ key: 'kasus', direction: 'descending' });

  const requestInacbgSort = (key) => {
    setInacbgSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'descending' ? 'ascending' : 'descending'
    }));
  };
  const getInacbgSortIndicator = (key) => {
    if (inacbgSort.key !== key) return ' \u2195';
    return inacbgSort.direction === 'ascending' ? ' \u2191' : ' \u2193';
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'distribution', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'crosstab', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'rs_profiles', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'regions', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'inacbg_to_drg', globalMonth, globalDrg).catch(() => null)
    ])
    .then(([dist, cross, hosp, prof, reg, inacbgMapping]) => {
      setDistData(dist);
      setCrossData(cross);
      setHospitalsData(hosp);
      setRsProfilesData(prof);
      setRegionsData(reg);
      setInacbgToDrgData(inacbgMapping);
      
      if (inacbgSearch) {
        const indexData = inacbgMapping;
        const searchCode = inacbgSearch.trim().toUpperCase();
        if (indexData) {
          const exactKey = Object.keys(indexData).find(k => k.toUpperCase() === searchCode);
          if (exactKey && indexData[exactKey]) {
            const realDataset = dataset.includes('_') ? dataset.split('_')[0] : dataset;
            fetch(`/data/${realDataset}/inacbg/${dataset}_${exactKey}.json?v=${Date.now()}`)
              .then(res => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
              })
              .then(data => {
                setInacbgResult({ code: exactKey, rawData: data, fetchError: false });
              })
              .catch(() => {
                setInacbgResult({ code: exactKey, rawData: { global: indexData[exactKey], byRs: null }, fetchError: true });
              })
              .finally(() => setInacbgLoading(false));
          }
        }
      }
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [dataset]);

  const [inacbgLoading, setInacbgLoading] = useState(false);

  const handleInacbgSearch = async (eOrCode = null, indexData = inacbgToDrgData) => {
    if (!indexData) return;
    const searchCode = typeof eOrCode === 'string' ? eOrCode : inacbgSearch;
    const code = searchCode.trim().toUpperCase();
    const exactKey = Object.keys(indexData).find(k => k.toUpperCase() === code);
    
    if (exactKey && indexData[exactKey]) {
      setInacbgLoading(true);
      const realDataset = dataset.includes('_') ? dataset.split('_')[0] : dataset;
      fetch(`/data/${realDataset}/inacbg/${dataset}_${exactKey}.json?v=${Date.now()}`)
        .then(res => {
          if (!res.ok) throw new Error('Not found');
          return res.json();
        })
        .then(data => {
           setInacbgResult({ code: exactKey, rawData: data, fetchError: false });
        })
        .catch(() => {
           setInacbgResult({ code: exactKey, rawData: { global: indexData[exactKey], byRs: null }, fetchError: true });
        })
        .finally(() => setInacbgLoading(false));
    } else {
      setInacbgResult({ code, rawData: null });
    }
  };

  if (loading || !distData || !crossData || !hospitalsData || !rsProfilesData || !regionsData) {
  
  return (

      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Laporan Nasional...</span>
      </div>
    );
  }

  let activeDistData = distData;
  let activeCrossData = crossData;
  let matchedCount = 0;
  let matchingCodes = [];

  const hasKabFilter = kabFilter && kabFilter.length > 0;

  if (rsFilter || (groupFilter && groupFilter.length > 0) || (wilayahFilter && wilayahFilter.length > 0) || hasKabFilter || excludeNonKomp) {
    matchingCodes = Object.keys(hospitalsData).filter(kode => {
       const rs = hospitalsData[kode];
       return filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp);
    });

    if (matchingCodes.length > 0) {
       matchedCount = matchingCodes.length;
       activeDistData = {
         pie: { ri: 0, rj: 0 }, cmg_ri: {}, cmg_rj: {}, mdc_ri: {}, mdc_rj: {},
         severity_inacbg: { 'I':0, 'II':0, 'III':0 }, severity_idrg: {}
       };
       activeCrossData = {
         nasional: { kasus: 0, inacbg: 0 },
         byTipeRs: {}, byKelasRawat: {}, byKompetensi: {}
       };

       const sumSim = (targetObj, srcObj) => {
         const srcSim = srcObj?.sim || srcObj;
         for (let i = 1; i <= 11; i++) {
           if (!targetObj[`tarif_${i}`]) targetObj[`tarif_${i}`] = 0;
           targetObj[`tarif_${i}`] += srcSim?.[`tarif_${i}`] || 0;
         }
       };

       const subSim = (targetObj, srcObj) => {
         const srcSim = srcObj?.sim || srcObj;
         for (let i = 1; i <= 11; i++) {
           if (!targetObj[`tarif_${i}`]) targetObj[`tarif_${i}`] = 0;
           targetObj[`tarif_${i}`] -= srcSim?.[`tarif_${i}`] || 0;
         }
       };

       const initSimNode = () => { const s = {}; for (let i = 1; i <= 11; i++) s[`tarif_${i}`] = 0; return { kasus: 0, inacbg: 0, sim: s }; };

       matchingCodes.forEach(kode => {
         const prof = rsProfilesData[kode];
         if (!prof) return;

         activeDistData.pie.ri += prof.pie?.ri || 0;
         activeDistData.pie.rj += prof.pie?.rj || 0;

         ['cmg_ri', 'cmg_rj', 'mdc_ri', 'mdc_rj', 'severity_inacbg', 'severity_idrg'].forEach(dictKey => {
           Object.entries(prof[dictKey] || {}).forEach(([k, v]) => {
             if (!activeDistData[dictKey][k]) activeDistData[dictKey][k] = 0;
             activeDistData[dictKey][k] += v;
           });
         });

         if (prof.crosstab) {
           let crossSource = prof.crosstab;
           const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];
            if (activeLayananFilters.length > 0) {
              const merged = { nasional: initSimNode(), byTipeRs: {}, byKelasRawat: {}, byKompetensi: {} };
              let hasAny = false;

              const rsTipeRaw = hospitalsData[kode]?.kelasFaskes || 'Lainnya';
              const tipeRsList = ['A', 'B', 'C', 'D'];
              const rsTipe = tipeRsList.includes(rsTipeRaw) ? rsTipeRaw : 'Lainnya';

              if (prof.svc) {
                activeLayananFilters.forEach(lay => {
                  const laySvc = prof.svc[lay];
                  if (laySvc) {
                    hasAny = true;
                    Object.entries(laySvc || {}).forEach(([ptd, kompMap]) => {
                      Object.entries(kompMap || {}).forEach(([komp, arr]) => {
                        const c_kasus = arr[0] || 0;
                        const c_ina = arr[1] || 0;

                        // Accumulate nasional
                        merged.nasional.kasus += c_kasus;
                        merged.nasional.inacbg += c_ina;
                        for(let i=1; i<=11; i++) merged.nasional.sim[`tarif_${i}`] += (arr[1+i]||0);

                        // Accumulate byTipeRs
                        if (!merged.byTipeRs[rsTipe]) merged.byTipeRs[rsTipe] = { ri: initSimNode(), rj: initSimNode() };
                        merged.byTipeRs[rsTipe][ptd].kasus += c_kasus;
                        merged.byTipeRs[rsTipe][ptd].inacbg += c_ina;
                        for(let i=1; i<=11; i++) merged.byTipeRs[rsTipe][ptd].sim[`tarif_${i}`] += (arr[1+i]||0);

                        // Accumulate byKompetensi
                        if (!merged.byKompetensi[rsTipe]) merged.byKompetensi[rsTipe] = {};
                        if (!merged.byKompetensi[rsTipe][ptd]) merged.byKompetensi[rsTipe][ptd] = {};
                        if (!merged.byKompetensi[rsTipe][ptd][komp]) merged.byKompetensi[rsTipe][ptd][komp] = initSimNode();
                        const cNode = merged.byKompetensi[rsTipe][ptd][komp];
                        cNode.kasus += c_kasus;
                        cNode.inacbg += c_ina;
                        for(let i=1; i<=11; i++) cNode.sim[`tarif_${i}`] += (arr[1+i]||0);
                      });
                    });
                  }
                });
              }
              if (hasAny) {
                  crossSource = merged;
              } else {
                  crossSource = { nasional: initSimNode(), byTipeRs: {}, byKelasRawat: {}, byKompetensi: {} };
              }
            }
           
           let rsBelumKomp = initSimNode();
           let rsBelumKompTipe = {};

           if (excludeNonKomp && crossSource?.byKompetensi) {
             Object.entries(crossSource.byKompetensi || {}).forEach(([tipe, ptdMap]) => {
               if (!rsBelumKompTipe[tipe]) rsBelumKompTipe[tipe] = { ri: initSimNode(), rj: initSimNode() };
               Object.entries(ptdMap || {}).forEach(([ptd, kompMap]) => {
                 Object.entries(kompMap || {}).forEach(([komp, cObj]) => {
                   if (komp.toLowerCase() === 'belum ada komp. icd') {
                     rsBelumKomp.kasus += cObj.kasus || 0;
                     rsBelumKomp.inacbg += cObj.inacbg || 0;
                     sumSim(rsBelumKomp.sim, cObj.sim);

                     rsBelumKompTipe[tipe][ptd].kasus += cObj.kasus || 0;
                     rsBelumKompTipe[tipe][ptd].inacbg += cObj.inacbg || 0;
                     sumSim(rsBelumKompTipe[tipe][ptd].sim, cObj.sim);
                   }
                 });
               });
             });
           }

           activeCrossData.nasional.kasus += (crossSource.nasional.kasus || 0) - rsBelumKomp.kasus;
           activeCrossData.nasional.inacbg += (crossSource.nasional.inacbg || 0) - rsBelumKomp.inacbg;
           sumSim(activeCrossData.nasional, crossSource.nasional);
           subSim(activeCrossData.nasional, rsBelumKomp.sim);

           Object.entries(crossSource.byTipeRs || {}).forEach(([tipe, tObj]) => {
             if (!activeCrossData.byTipeRs[tipe]) {
               activeCrossData.byTipeRs[tipe] = { ri: initSimNode(), rj: initSimNode() };
             }
             ['ri', 'rj'].forEach(ptd => {
               if (tObj[ptd]) {
                 const subKasus = rsBelumKompTipe[tipe]?.[ptd]?.kasus || 0;
                 const subIna = rsBelumKompTipe[tipe]?.[ptd]?.inacbg || 0;
                 const subSimObj = rsBelumKompTipe[tipe]?.[ptd]?.sim || {};

                 activeCrossData.byTipeRs[tipe][ptd].kasus += (tObj[ptd].kasus || 0) - subKasus;
                 activeCrossData.byTipeRs[tipe][ptd].inacbg += (tObj[ptd].inacbg || 0) - subIna;
                 sumSim(activeCrossData.byTipeRs[tipe][ptd].sim, tObj[ptd].sim);
                 subSim(activeCrossData.byTipeRs[tipe][ptd].sim, subSimObj);
               }
             });
           });

           Object.entries(crossSource.byKelasRawat || {}).forEach(([tipe, krisMap]) => {
             if (!activeCrossData.byKelasRawat[tipe]) activeCrossData.byKelasRawat[tipe] = {};
             Object.entries(krisMap || {}).forEach(([kris, kObj]) => {
               if (!activeCrossData.byKelasRawat[tipe][kris]) {
                 activeCrossData.byKelasRawat[tipe][kris] = { ri: initSimNode(), rj: initSimNode() };
               }
               ['ri', 'rj'].forEach(ptd => {
                 if (kObj[ptd]) {
                   activeCrossData.byKelasRawat[tipe][kris][ptd].kasus += kObj[ptd].kasus;
                   activeCrossData.byKelasRawat[tipe][kris][ptd].inacbg += kObj[ptd].inacbg;
                   sumSim(activeCrossData.byKelasRawat[tipe][kris][ptd].sim, kObj[ptd].sim);
                 }
               });
             });
           });

           Object.entries(crossSource.byKompetensi || {}).forEach(([tipe, ptdMap]) => {
             if (!activeCrossData.byKompetensi[tipe]) activeCrossData.byKompetensi[tipe] = {};
             Object.entries(ptdMap || {}).forEach(([ptd, kompMap]) => {
               if (!activeCrossData.byKompetensi[tipe][ptd]) activeCrossData.byKompetensi[tipe][ptd] = {};
               Object.entries(kompMap || {}).forEach(([komp, cObj]) => {
                 if (excludeNonKomp && komp.toLowerCase() === 'belum ada komp. icd') return;
                 if (!activeCrossData.byKompetensi[tipe][ptd][komp]) {
                   activeCrossData.byKompetensi[tipe][ptd][komp] = initSimNode();
                 }
                 activeCrossData.byKompetensi[tipe][ptd][komp].kasus += cObj.kasus || 0;
                 activeCrossData.byKompetensi[tipe][ptd][komp].inacbg += cObj.inacbg || 0;
                 sumSim(activeCrossData.byKompetensi[tipe][ptd][komp].sim, cObj.sim);
               });
              });
            });
          }
       });
    }
  }

  // Derive filtered INA-CBG results dynamically
  let derivedInacbgData = null;
  if (inacbgResult && inacbgResult.rawData) {
    if ((rsFilter || (groupFilter && groupFilter.length > 0) || (wilayahFilter && wilayahFilter.length > 0) || excludeNonKomp) && matchingCodes.length > 0) {
      derivedInacbgData = {};
      const { byRs, global } = inacbgResult.rawData;
      console.log("matchingCodes length:", matchingCodes.length, "byRs keys:", byRs ? Object.keys(byRs).length : 0);
      if (matchingCodes.length > 0 && byRs) {
        console.log("First match code:", matchingCodes[0], "is in byRs:", !!byRs[matchingCodes[0]]);
      }
      let matchesInByRs = 0;
      matchingCodes.forEach(kode => {
        if (byRs && byRs[kode]) {
          matchesInByRs++;
          Object.entries(byRs[kode] || {}).forEach(([drg, drgArr]) => {
            if (!derivedInacbgData[drg]) {
              derivedInacbgData[drg] = { kasus: 0, inacbg: 0, deskripsi: global[drg]?.deskripsi || '-', kelompok: global[drg]?.kelompok || '-' };
              for(let i=1; i<=61; i++) derivedInacbgData[drg][`tarif_${i}`] = 0;
            }
            derivedInacbgData[drg].kasus += drgArr[0] || 0;
            derivedInacbgData[drg].inacbg += drgArr[1] || 0;
            for(let i=1; i<=61; i++) derivedInacbgData[drg][`tarif_${i}`] += drgArr[i+1] || 0;
          });
        }
      });
      console.log("Total matchesInByRs:", matchesInByRs, "Derived keys:", Object.keys(derivedInacbgData).length);
    } else {
      derivedInacbgData = {};
      const global = inacbgResult.rawData.global || {};
      Object.entries(global).forEach(([drg, drgObj]) => {
         const isArr = Array.isArray(drgObj);
         const isNested = !isArr && drgObj.all;
         const source = isArr ? drgObj : (isNested ? drgObj.all : null);
         
         if (source) {
             derivedInacbgData[drg] = {
               kasus: source[0] || 0,
               inacbg: source[1] || 0,
               deskripsi: (isNested ? drgObj.deskripsi : '-') || '-',
               kelompok: (isNested ? drgObj.kelompok : '-') || '-'
             };
             for(let i=1; i<=61; i++) derivedInacbgData[drg][`tarif_${i}`] = source[i+1] || 0;
         } else {
             derivedInacbgData[drg] = {
               kasus: drgObj.kasus || 0,
               inacbg: drgObj.inacbg || 0,
               deskripsi: drgObj.deskripsi || '-',
               kelompok: drgObj.kelompok || '-'
             };
             for(let i=1; i<=61; i++) derivedInacbgData[drg][`tarif_${i}`] = drgObj[`tarif_${i}`] || 0;
         }
      });
    }
  }

  const { pie = {ri: 0, rj: 0}, cmg_rj = {}, mdc_rj = {}, cmg_ri = {}, mdc_ri = {}, severity_inacbg = {}, severity_idrg = {} } = activeDistData;
  
  const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];
  const { nasional, byTipeRs, byKelasRawat, byKompetensi } = activeCrossData;

  const getTipeNode = (tip, jenis) => byTipeRs[tip]?.[jenis] || null;

  const simKey = `tarif_${simulasi}`;
  const getSimVal = (node) => {
    if (!node) return 0;
    if (typeof node[simKey] === 'number') return node[simKey];
    if (node.sim && typeof node.sim[simKey] === 'number') return node.sim[simKey];
    return 0;
  };

  const getPercent = (val, total) => total > 0 ? ((val / total) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
  const totalPie = pie.rj + pie.ri;

  const pieTrace = {
    values: [pie.rj, pie.ri],
    labels: ['Rawat Jalan', 'Rawat Inap'],
    type: 'pie',
    hole: 0,
    marker: { colors: ['#00B1A9', '#FFC000'] },
    textinfo: 'percent',
    textposition: 'inside',
    insidetextorientation: 'horizontal',
    hoverinfo: 'label+value+percent'
  };

  const getTop10 = (dict, formatterFunc) => {
    return Object.entries(dict || {})
      .filter(([k, v]) => {
        const keyLower = k.toLowerCase();
        return true;
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => [formatterFunc ? formatterFunc(k) : k, v])
      .reverse();
  };

  const cmgRjTop = getTop10(cmg_rj, formatCmgLabel);
  const mdcRjTop = getTop10(mdc_rj, formatMdcLabel);
  const cmgRiTop = getTop10(cmg_ri, formatCmgLabel);
  const mdcRiTop = getTop10(mdc_ri, formatMdcLabel);

  const cmgRjTotal = Object.values(cmg_rj || {}).reduce((a, b) => a + b, 0);
  const mdcRjTotal = Object.values(mdc_rj || {}).reduce((a, b) => a + b, 0);
  const cmgRiTotal = Object.values(cmg_ri || {}).reduce((a, b) => a + b, 0);
  const mdcRiTotal = Object.values(mdc_ri || {}).reduce((a, b) => a + b, 0);

  const wrapText = (text, maxLength) => {
    if (typeof text !== 'string' || text.length <= maxLength) return text;
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
      if ((currentLine + word).length > maxLength && currentLine.length > 0) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    if (currentLine.trim().length > 0) lines.push(currentLine.trim());
    return lines.join('<br>');
  };

  const createBarTrace = (dataArr, total, color, isLeft = true) => ({
    x: dataArr.map(d => d[1]),
    y: dataArr.map(d => wrapText(d[0], 35)),
    type: 'bar',
    orientation: 'h',
    marker: { 
      color: color,
      line: { color: 'rgba(255, 255, 255, 0.8)', width: 1.5 } 
    },
    text: dataArr.map(d => getPercent(d[1], total)),
    textposition: 'auto',
    hovertext: dataArr.map(d => `${d[0]}<br>Kasus: ${(d[1] || 0).toLocaleString()} (${getPercent(d[1] || 0, total)})`),
    hoverinfo: 'text',
    name: ''
  });

  // Severity
  const sevInacbgList = [['III', severity_inacbg['III'] || 0], ['II', severity_inacbg['II'] || 0], ['I', severity_inacbg['I'] || 0]];
  const sevIdrgList = [['Tingkat 3', severity_idrg['3'] || 0], ['Tingkat 2', severity_idrg['2'] || 0], ['Tingkat 1', severity_idrg['1'] || 0], ['Tingkat 0/9', severity_idrg['0/9'] || 0]];
  
  const sevInacbgTotal = Object.values(severity_inacbg || {}).reduce((a, b) => a + b, 0);
  const sevIdrgTotal = Object.values(severity_idrg || {}).reduce((a, b) => a + b, 0);



  

  // -- 2. Crosstab Data Prep --
  const tipeList = ['A', 'B', 'C', 'D'];
  
  const renderCell = (val, isMoney = false, colorize = false) => {
    let formatted = isMoney ? formatCompactCurrency(val) : val.toLocaleString();
    if (colorize) {
      const color = val > 0 ? 'var(--accent-success)' : (val < 0 ? 'var(--accent-danger)' : 'inherit');
      return <span style={{ color }}>{val > 0 ? '+' : ''}{formatted}</span>;
    }
    return formatted;
  };

  const renderPercent = (a, b) => {
    if (b === 0) return '0%';
    const pct = ((a - b) / b) * 100;
    const color = pct > 0 ? 'var(--accent-success)' : (pct < 0 ? 'var(--accent-danger)' : 'inherit');
    return <span style={{ color }}>{pct > 0 ? '+' : ''}{pct.toFixed(3)}%</span>;
  };

  // Helper to get sim value from a crosstab node
  const getNodeSim = (node) => node ? getSimVal(node) : 0;

// --- EXCEL DATA GENERATION ---
  const excelHeadersSL = ["Severity Level", "Jumlah Kasus"];
  const excelDataSL = [
    ["SL I - Ringan", severity_inacbg['I'] || 0],
    ["SL II - Sedang", severity_inacbg['II'] || 0],
    ["SL III - Berat", severity_inacbg['III'] || 0],
    ["Total", sevInacbgTotal]
  ];

  const excelHeadersCL = ["Complexity Level", "Jumlah Kasus"];
  const excelDataCL = [
    ["CL 0 - No CC", severity_idrg['0'] || 0],
    ["CL 1 - Mild CC", severity_idrg['1'] || 0],
    ["CL 2 - Moderate CC", severity_idrg['2'] || 0],
    ["CL 3 - Severe CC", severity_idrg['3'] || 0],
    ["CL 4 - Catastropic CC", severity_idrg['4'] || 0],
    ["CL 9 - Merge CC", severity_idrg['9'] || 0],
    ["Total", sevIdrgTotal]
  ];

  const excelHeadersTipeRs = [
    "Jenis Layanan", "Keterangan", "Total Kasus", "Total Spending (Rp)", 
    "RS A", "RS B", "RS C", "RS D", "Total",
    "RS A", "RS B", "RS C", "RS D", "Total"
  ];
  
  const excelDataTipeRs = (() => {
    const data = [];
    const getSim = (node) => getNodeSim(node);

    ['ri', 'rj'].forEach(ptd => {
      const labelPtd = ptd === 'ri' ? 'Rawat Inap' : 'Rawat Jalan';
      
      const inaRow = [labelPtd, `Spending ${ptd === 'ri' ? 'Ranap' : 'Rajal'} INA-CBG`];
      const kasusTotal = tipeList.reduce((a, t) => a + (byTipeRs[t]?.[ptd]?.kasus || 0), 0);
      const inaTotal = tipeList.reduce((a, t) => a + (byTipeRs[t]?.[ptd]?.inacbg || 0), 0);
      const simTotal = tipeList.reduce((a, t) => a + getSim(byTipeRs[t]?.[ptd]), 0);
      inaRow.push(kasusTotal);
      inaRow.push(inaTotal);
      tipeList.forEach(t => inaRow.push(byTipeRs[t]?.[ptd]?.inacbg || 0));
      inaRow.push(inaTotal);
      tipeList.forEach(t => {
        const i = byTipeRs[t]?.[ptd]?.inacbg || 0;
        const s = getSim(byTipeRs[t]?.[ptd]);
        inaRow.push(i > 0 ? ((s - i) / i * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%');
      });
      inaRow.push(inaTotal > 0 ? ((simTotal - inaTotal) / inaTotal * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%');
      data.push(inaRow);

      const simRow = [labelPtd, `Spending ${ptd === 'ri' ? 'Ranap' : 'Rajal'} iDRG`];
      simRow.push(kasusTotal);
      simRow.push(simTotal);
      tipeList.forEach(t => simRow.push(getSim(byTipeRs[t]?.[ptd])));
      simRow.push(simTotal);
      tipeList.forEach(t => simRow.push("-"));
      simRow.push("-");
      data.push(simRow);
    });

    const totInaRow = ['Total', 'Total INA-CBG'];
    const kasusGrand = tipeList.reduce((a, t) => a + (getTipeNode(t, "ri")?.kasus || 0) + (getTipeNode(t, "rj")?.kasus || 0), 0);
    const totIna = tipeList.reduce((a, t) => a + (getTipeNode(t, "ri")?.inacbg || 0) + (getTipeNode(t, "rj")?.inacbg || 0), 0);
    const totSim = tipeList.reduce((a, t) => a + getSim(getTipeNode(t, "ri")) + getSim(getTipeNode(t, "rj")), 0);
    totInaRow.push(kasusGrand);
    totInaRow.push(totIna);
    tipeList.forEach(t => totInaRow.push((getTipeNode(t, "ri")?.inacbg || 0) + (getTipeNode(t, "rj")?.inacbg || 0)));
    totInaRow.push(totIna);
    tipeList.forEach(t => {
       const i = (getTipeNode(t, "ri")?.inacbg || 0) + (getTipeNode(t, "rj")?.inacbg || 0);
       const s = getSim(getTipeNode(t, "ri")) + getSim(getTipeNode(t, "rj"));
       totInaRow.push(i > 0 ? ((s - i) / i * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%');
    });
    totInaRow.push(totIna > 0 ? ((totSim - totIna) / totIna * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%');
    data.push(totInaRow);

    const totSimRow = ['Total', 'Total iDRG'];
    totSimRow.push(kasusGrand);
    totSimRow.push(totSim);
    tipeList.forEach(t => totSimRow.push(getSim(getTipeNode(t, "ri")) + getSim(getTipeNode(t, "rj"))));
    totSimRow.push(totSim);
    tipeList.forEach(t => totSimRow.push("-"));
    totSimRow.push("-");
    data.push(totSimRow);

    return data;
  })();

  const excelHeadersKelasRawat = (() => {
    const headers = ["Jenis Layanan", "Kelas Rawat"];
    [...tipeList, 'Total'].forEach(t => {
      headers.push(`Kasus`, `INA CBG (Rp)`, `iDRG (Rp)`, `Selisih (Rp)`, `% Selisih`);
    });
    return headers;
  })();

  const excelDataKelasRawat = (() => {
    const data = [];
    const allKris = ['KRIS A', 'KRIS B', 'KRIS C'];

    allKris.forEach((kris, i) => {
      const row = [i === 0 ? 'Rawat Inap' : '', kris];
      [...tipeList, 'Total'].forEach(t => {
        const getRaw = (tip) => byKelasRawat[tip]?.[kris]?.ri || null;
        const sim   = t === 'Total' ? tipeList.reduce((s, tip) => s + getSimVal(getRaw(tip)), 0) : getSimVal(getRaw(t));
        const ina   = t === 'Total' ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.inacbg || 0), 0) : (getRaw(t)?.inacbg || 0);
        const kasus = t === 'Total' ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.kasus || 0), 0) : (getRaw(t)?.kasus || 0);
        row.push(kasus, ina, sim, sim - ina, ina > 0 ? (sim - ina) / ina : 0);
      });
      data.push(row);
    });

    const totRiRow = ['Total Rawat Inap', ''];
    [...tipeList, 'Total'].forEach(t => {
      const getKR = (tip, k) => byKelasRawat[tip]?.[k]?.ri || null;
      const sim   = t === 'Total' ? tipeList.reduce((s, tip) => s + allKris.reduce((ss, k) => ss + getSimVal(getKR(tip, k)), 0), 0) : allKris.reduce((ss, k) => ss + getSimVal(getKR(t, k)), 0);
      const ina   = t === 'Total' ? tipeList.reduce((s, tip) => s + allKris.reduce((ss, k) => ss + (getKR(tip, k)?.inacbg || 0), 0), 0) : allKris.reduce((ss, k) => ss + (getKR(t, k)?.inacbg || 0), 0);
      const kasus = t === 'Total' ? tipeList.reduce((s, tip) => s + allKris.reduce((ss, k) => ss + (getKR(tip, k)?.kasus || 0), 0), 0) : allKris.reduce((ss, k) => ss + (getKR(t, k)?.kasus || 0), 0);
      totRiRow.push(kasus, ina, sim, sim - ina, ina > 0 ? (sim - ina) / ina : 0);
    });
    data.push(totRiRow);

    const rjRow = ['Rawat Jalan', 'Rawat Jalan'];
    [...tipeList, 'Total'].forEach(t => {
      const getRaw = (tip) => getTipeNode(tip, "rj") || null;
      const sim   = t === 'Total' ? tipeList.reduce((s, tip) => s + getSimVal(getRaw(tip)), 0) : getSimVal(getRaw(t));
      const ina   = t === 'Total' ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.inacbg || 0), 0) : (getRaw(t)?.inacbg || 0);
      const kasus = t === 'Total' ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.kasus || 0), 0) : (getRaw(t)?.kasus || 0);
      rjRow.push(kasus, ina, sim, sim - ina, ina > 0 ? (sim - ina) / ina : 0);
    });
    data.push(rjRow);

    const totRow = ['Total Seluruh Kasus', ''];
    [...tipeList, 'Total'].forEach(t => {
      const getTot = (tip) => byTipeRs[tip] || null;
      const sim   = t === 'Total' ? tipeList.reduce((s, tip) => s + getSimVal(getTot(tip)?.ri) + getSimVal(getTot(tip)?.rj), 0) : getSimVal(getTot(t)?.ri) + getSimVal(getTot(t)?.rj);
      const ina   = t === 'Total' ? tipeList.reduce((s, tip) => s + (getTot(tip)?.ri?.inacbg || 0) + (getTot(tip)?.rj?.inacbg || 0), 0) : (getTot(t)?.ri?.inacbg || 0) + (getTot(t)?.rj?.inacbg || 0);
      const kasus = t === 'Total' ? tipeList.reduce((s, tip) => s + (getTot(tip)?.ri?.kasus || 0) + (getTot(tip)?.rj?.kasus || 0), 0) : (getTot(t)?.ri?.kasus || 0) + (getTot(t)?.rj?.kasus || 0);
      totRow.push(kasus, ina, sim, sim - ina, ina > 0 ? (sim - ina) / ina : 0);
    });
    data.push(totRow);

    return data;
  })();

  const excelHeadersKomp = (() => {
    const headers = ["Jenis Layanan", "Kompetensi ICD"];
    [...tipeList, 'Total'].forEach(t => {
      headers.push(`Kasus`, `INA CBG (Rp)`, `iDRG (Rp)`, `Selisih (Rp)`, `% Selisih`);
    });
    return headers;
  })();

  const excelDataKomp = (() => {
    const data = [];
    const komps = excludeNonKomp ? ['paripurna', 'utama', 'madya', 'dasar'] : ['paripurna', 'utama', 'madya', 'dasar', 'belum ada komp. icd'];

    ['ri', 'rj'].forEach(ptd => {
      const labelPtd = ptd === 'ri' ? 'Rawat Inap' : 'Rawat Jalan';

      // Per kompetensi rows (urutan sama: paripurna, utama, madya, dasar, Belum ada)
      komps.forEach((komp, i) => {
        const row = [i === 0 ? labelPtd : '', kompLabel[komp]];
        [...tipeList, 'Total'].forEach(t => {
          const getRaw = (tip) => byKompetensi[tip]?.[ptd]?.[komp] || null;
          const sim   = t === 'Total' ? tipeList.reduce((s, tip) => s + getSimVal(getRaw(tip)), 0) : getSimVal(getRaw(t));
          const ina   = t === 'Total' ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.inacbg || 0), 0) : (getRaw(t)?.inacbg || 0);
          const kasus = t === 'Total' ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.kasus || 0), 0) : (getRaw(t)?.kasus || 0);
          row.push(kasus, ina, sim, sim - ina, ina > 0 ? (sim - ina) / ina : 0);
        });
        data.push(row);
      });

      // Total per PTD
      const totPtdRow = [`Total ${labelPtd}`, ''];
      [...tipeList, 'Total'].forEach(t => {
        const getRaw = (tip, k) => byKompetensi[tip]?.[ptd]?.[k] || null;
        const sim   = t === 'Total' ? tipeList.reduce((s, tip) => s + komps.reduce((ss, k) => ss + getSimVal(getRaw(tip, k)), 0), 0) : komps.reduce((ss, k) => ss + getSimVal(getRaw(t, k)), 0);
        const ina   = t === 'Total' ? tipeList.reduce((s, tip) => s + komps.reduce((ss, k) => ss + (getRaw(tip, k)?.inacbg || 0), 0), 0) : komps.reduce((ss, k) => ss + (getRaw(t, k)?.inacbg || 0), 0);
        const kasus = t === 'Total' ? tipeList.reduce((s, tip) => s + komps.reduce((ss, k) => ss + (getRaw(tip, k)?.kasus || 0), 0), 0) : komps.reduce((ss, k) => ss + (getRaw(t, k)?.kasus || 0), 0);
        totPtdRow.push(kasus, ina, sim, sim - ina, ina > 0 ? (sim - ina) / ina : 0);
      });
      data.push(totPtdRow);
    });

    // Grand Total (semua kompetensi, semua PTD)
    const allPtds = ['ri', 'rj'];
    const grandRow = ['Total Semua Kompetensi', ''];
    [...tipeList, 'Total'].forEach(t => {
      const getRaw = (tip, ptd, k) => byKompetensi[tip]?.[ptd]?.[k] || null;
      const sim   = t === 'Total' ? tipeList.reduce((s, tip) => s + allPtds.reduce((ss, ptd) => ss + komps.reduce((sss, k) => sss + getSimVal(getRaw(tip, ptd, k)), 0), 0), 0) : allPtds.reduce((ss, ptd) => ss + komps.reduce((sss, k) => sss + getSimVal(getRaw(t, ptd, k)), 0), 0);
      const ina   = t === 'Total' ? tipeList.reduce((s, tip) => s + allPtds.reduce((ss, ptd) => ss + komps.reduce((sss, k) => sss + (getRaw(tip, ptd, k)?.inacbg || 0), 0), 0), 0) : allPtds.reduce((ss, ptd) => ss + komps.reduce((sss, k) => sss + (getRaw(t, ptd, k)?.inacbg || 0), 0), 0);
      const kasus = t === 'Total' ? tipeList.reduce((s, tip) => s + allPtds.reduce((ss, ptd) => ss + komps.reduce((sss, k) => sss + (getRaw(tip, ptd, k)?.kasus || 0), 0), 0), 0) : allPtds.reduce((ss, ptd) => ss + komps.reduce((sss, k) => sss + (getRaw(t, ptd, k)?.kasus || 0), 0), 0);
      grandRow.push(kasus, ina, sim, sim - ina, ina > 0 ? (sim - ina) / ina : 0);
    });
    data.push(grandRow);

    return data;
  })();
  const statsCodes = (rsFilter || (groupFilter && groupFilter.length > 0) || (wilayahFilter && wilayahFilter.length > 0) || hasKabFilter || excludeNonKomp)
    ? matchingCodes
    : Object.keys(hospitalsData);

  const totalRsCount = statsCodes.length;
  const totalProvCount = new Set(statsCodes.map(c => hospitalsData[c]?.prop).filter(Boolean)).size;
  const totalKabCount = new Set(statsCodes.map(c => hospitalsData[c]?.kab).filter(Boolean)).size;

  return (
    <div className="animate-fade-in-up">
      <div style={{ marginBottom: '32px', position: 'relative' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LayoutDashboard color="var(--accent-primary)" /> Distribusi Data & Laporan Nasional
        </h1>
        <div style={{ position: 'absolute', top: '0px', right: '0px' }}>
          <DownloadPptxButton title="Laporan Nasional iDRG" />
        </div>
        <p className="text-secondary">
          Ringkasan eksekutif persebaran kasus, tingkat keparahan, dan crosstab spending per tipe RS.
        </p>

        {(rsFilter || (groupFilter && groupFilter.length > 0) || (kabFilter && kabFilter.length > 0)) && (
          <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 14px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.4)', fontSize: '0.82rem', color: '#0284c7', fontWeight: 600 }}>
            <span>🎯</span>
            <span>Menampilkan agregasi {matchedCount} RS yang cocok dengan filter {groupFilter ? `grup ${null /* removed single active group logic */?.label || groupFilter}` : ''} {rsFilter ? `pencarian "${rsFilter}"` : ''}</span>
          </div>
        )}
      </div>



      {/* --- BAGIAN 1: DISTRIBUSI KASUS --- */}
      {activeLayananFilters.length > 0 && (
        <div style={{ padding: '16px', background: 'rgba(234, 88, 12, 0.1)', border: '1px solid #ea580c', borderRadius: '8px', marginBottom: '32px', color: '#9a3412', fontWeight: 500 }}>
          Grafik Distribusi (Pie, Top 10 CMG/MDC, Severity Level) tidak tersedia saat menggunakan filter spesifik Layanan Klinis. Data di bawah ini hanya merangkum ringkasan nasional per Tipe RS.
        </div>
      )}
      <>
          <h2 style={{ paddingBottom: '8px', borderBottom: '2px solid var(--glass-border)', color: 'var(--accent-primary)', marginBottom: '24px' }}>
            <BarChart2 size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Distribusi Kasus & Karakteristik
          </h2>

          <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 className="text-primary" style={{ textAlign: 'center', marginBottom: '16px' }}>Jumlah Data Masuk menurut Jenis Rawat</h3>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <table style={{ textAlign: 'left', fontSize: '1.1rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
            <tbody>
              <tr>
                <td style={{ paddingRight: '24px', fontWeight: '500' }}>Jumlah Kasus</td>
                <td>: <strong>{totalPie.toLocaleString('en-US')}</strong> Kasus</td>
              </tr>
              <tr>
                <td style={{ paddingRight: '24px', fontWeight: '500' }}>Jumlah Rumah Sakit</td>
                <td>: <strong>{totalRsCount.toLocaleString('en-US')}</strong> Rumah Sakit</td>
              </tr>
              <tr>
                <td style={{ paddingRight: '24px', fontWeight: '500' }}>Jumlah Provinsi</td>
                <td>: <strong>{totalProvCount.toLocaleString('en-US')}</strong> Provinsi</td>
              </tr>
              <tr>
                <td style={{ paddingRight: '24px', fontWeight: '500' }}>Jumlah Kab/Kota</td>
                <td>: <strong>{totalKabCount.toLocaleString('en-US')}</strong> Kab/Kota</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="export-pptx-chart" data-title="Jumlah Data Masuk menurut Jenis Rawat" style={{ height: '350px', background: '#fff' }}>
          <PlotWithSave
            data={[pieTrace]}
            layout={{
              autosize: true,
              margin: { t: 10, b: 60, l: 10, r: 10 },
              showlegend: true,
              legend: { orientation: 'h', y: -0.12 }
            }}
            config={{ responsive: true }}
            style={{ width: '100%', height: '100%' }}
            exportTitle={`Jumlah Data Masuk menurut Jenis Rawat<br><span style="font-size:13px;color:#475569;">Total Kasus: ${totalPie.toLocaleString()}</span>`}
            filename="Distribusi_Jenis_Rawat"
            width={900}
            height={620}
          />
        </div>
      </div>

      {/* Top 10 RJ */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 className="text-primary" style={{ textAlign: 'center', marginBottom: '24px' }}>10 Besar Kasus Rawat Jalan (CMG vs MDC)</h3>
        <div className="grid-2 export-pptx-chart" data-title="10 Besar Kasus Rawat Jalan (CMG vs MDC)" style={{ height: '600px', gap: '20px', background: '#fff', padding: '10px' }}>
          <PlotWithSave
            data={[createBarTrace(cmgRjTop, cmgRjTotal, '#00B1A9')]}
            layout={{ margin: { l: 200, r: 80, t: 20, b: 40 }, xaxis: { visible: true, title: 'Jumlah Kasus' }, yaxis: { automargin: true, tickfont: { size: 11, color: '#475569' } }, plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)' }}
            config={{ responsive: true }}
            style={{ width: '100%', height: '100%' }}
            exportTitle="10 Besar Kasus Rawat Jalan — Kelompok CMG"
            filename="10_Besar_RJ_CMG"
            width={1100}
            height={700}
          />
          <PlotWithSave
            data={[createBarTrace(mdcRjTop, mdcRjTotal, '#FFC000', false)]}
            layout={{ margin: { l: 200, r: 80, t: 20, b: 40 }, xaxis: { visible: true, title: 'Jumlah Kasus' }, yaxis: { automargin: true, tickfont: { size: 11, color: '#475569' } }, plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)' }}
            config={{ responsive: true }}
            style={{ width: '100%', height: '100%' }}
            exportTitle="10 Besar Kasus Rawat Jalan — Kelompok MDC"
            filename="10_Besar_RJ_MDC"
            width={1100}
            height={700}
          />
        </div>
      </div>

      {/* Top 10 RI */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 className="text-primary" style={{ textAlign: 'center', marginBottom: '24px' }}>10 Besar Kasus Rawat Inap (CMG vs MDC)</h3>
        <div className="grid-2 export-pptx-chart" data-title="10 Besar Kasus Rawat Inap (CMG vs MDC)" style={{ height: '600px', gap: '20px', background: '#fff', padding: '10px' }}>
          <PlotWithSave
            data={[createBarTrace(cmgRiTop, cmgRiTotal, '#00B1A9')]}
            layout={{ margin: { l: 200, r: 80, t: 20, b: 40 }, xaxis: { visible: true, title: 'Jumlah Kasus' }, yaxis: { automargin: true, tickfont: { size: 11, color: '#475569' } }, plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)' }}
            config={{ responsive: true }}
            style={{ width: '100%', height: '100%' }}
            exportTitle="10 Besar Kasus Rawat Inap — Kelompok CMG"
            filename="10_Besar_RI_CMG"
            width={1100}
            height={700}
          />
          <PlotWithSave
            data={[createBarTrace(mdcRiTop, mdcRiTotal, '#FFB000', false)]}
            layout={{ margin: { l: 200, r: 80, t: 20, b: 40 }, xaxis: { visible: true, title: 'Jumlah Kasus' }, yaxis: { automargin: true, tickfont: { size: 11, color: '#475569' } }, plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)' }}
            config={{ responsive: true }}
            style={{ width: '100%', height: '100%' }}
            exportTitle="10 Besar Kasus Rawat Inap — Kelompok MDC"
            filename="10_Besar_RI_MDC"
            width={1100}
            height={700}
          />
        </div>
      </div>

      {/* Severity & Complexity */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '40px' }}>
        <h3 className="text-primary" style={{ textAlign: 'center', marginBottom: '24px' }}>Tingkat Keparahan (Severity Level) & Kompleksitas (Complexity Level)</h3>
        <div className="grid-2">
          {/* SL INA-CBG */}
          <div>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
                <h4 style={{ color: 'var(--accent-primary)', margin: 0 }}>Tabel Severity Level (INA-CBG)</h4>
                <DownloadExcelButton headers={excelHeadersSL} data={excelDataSL} filename="Severity_Level_INACBG.xlsx" />
              </div>
            <table className="kemenkes-table export-pptx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ background: '#008080', color: '#fff', padding: '8px', textAlign: 'center' }}>Severity Level</th>
                  <th style={{ background: '#008080', color: '#fff', padding: '8px', textAlign: 'center' }}>Jumlah Kasus</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>SL I - Ringan</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_inacbg['I'] || 0)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>SL II - Sedang</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_inacbg['II'] || 0)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>SL III - Berat</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_inacbg['III'] || 0)}</td>
                </tr>
                <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Total</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(sevInacbgTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CL iDRG */}
          <div>
            <div className="flex-between" style={{ marginBottom: '8px' }}>
              <h4 style={{ color: 'var(--accent-primary)', margin: 0 }}>Tabel Complexity Level (iDRG)</h4>
              <DownloadExcelButton headers={excelHeadersCL} data={excelDataCL} filename="Complexity_Level_iDRG.xlsx" />
            </div>
            <table className="kemenkes-table export-pptx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ background: '#20b2aa', color: '#fff', padding: '8px', textAlign: 'center' }}>Complexity Level</th>
                  <th style={{ background: '#20b2aa', color: '#fff', padding: '8px', textAlign: 'center' }}>Jumlah Kasus</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>CL 0 - No CC</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_idrg['0'] || 0)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>CL 1 - Mild CC</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_idrg['1'] || 0)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>CL 2 - Moderate CC</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_idrg['2'] || 0)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>CL 3 - Severe CC</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_idrg['3'] || 0)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>CL 4 - Catastropic CC</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_idrg['4'] || 0)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>CL 9 - Merge CC</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(severity_idrg['9'] || 0)}</td>
                </tr>
                <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Total</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(sevIdrgTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      </>

      {/* --- BAGIAN 2: LAPORAN NASIONAL (CROSSTAB) --- */}
      <h2 style={{ paddingBottom: '8px', borderBottom: '2px solid var(--glass-border)', color: 'var(--accent-primary)', marginBottom: '24px' }}>
        <TableIcon size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
        2. Perbandingan Simulasi Spending iDRG Nasional
      </h2>

      {/* Macro Summary */}
      <div className="grid-5" style={{ marginBottom: '24px', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Total Kasus</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#c00000' }}>{(nasional?.kasus || 0).toLocaleString()}</p>
        </div>
        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Biaya INA CBG</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e67e22' }}>{formatCompactCurrency(nasional.inacbg)}</p>
        </div>
        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Biaya iDRG</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f1c40f' }}>{formatCompactCurrency(getSimVal(nasional))}</p>
        </div>
        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Selisih Biaya</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#27ae60' }}>+{formatCompactCurrency(getSimVal(nasional) - nasional.inacbg)}</p>
        </div>
        <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
          <p className="text-secondary" style={{ fontSize: '0.875rem' }}>Persentase Kenaikan</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a085' }}>{renderPercent(getSimVal(nasional), nasional.inacbg)}</p>
        </div>
      </div>

      {/* Table 1: Tipe RS (ABCD) */}
      <div className="glass-panel" style={{ marginBottom: '32px', overflowX: 'auto' }}>
        <div className="flex-between" style={{ padding: '16px', background: '#e6f2f0' }}>
          <h3 style={{ margin: 0, color: '#008a70' }}>Berdasarkan Tipe RS (ABCD)</h3>
          <DownloadExcelButton 
            headers={excelHeadersTipeRs} 
            data={excelDataTipeRs} 
            filename="Laporan_Tipe_RS.xlsx"
            groupHeaders={[
              { label: 'Jenis Layanan', colSpan: 1, rowSpan: 2, fill: '#1abc9c' },
              { label: 'Total Seluruhnya', colSpan: 3, fill: '#16a085' },
              { label: 'Spending menurut Kelas (Rp)', colSpan: 5, fill: '#27ae60' },
              { label: 'Kenaikan/Penurunan iDRG (%)', colSpan: 5, fill: '#2980b9' }
            ]}
          />
        </div>
        <table className="kemenkes-table export-pptx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ background: '#1abc9c', color: '#fff', padding: '8px' }}>Jenis Layanan</th>
              <th colSpan="3" style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>Total Seluruhnya</th>
              <th colSpan="5" style={{ background: '#27ae60', color: '#fff', padding: '8px', textAlign: 'center' }}>Spending menurut Kelas (Rp)</th>
              <th colSpan="5" style={{ background: '#2980b9', color: '#fff', padding: '8px', textAlign: 'center' }}>Kenaikan/Penurunan iDRG (%)</th>
            </tr>
            <tr>
              <th style={{ background: '#16a085', color: '#fff', padding: '8px' }}>Keterangan</th>
              <th style={{ background: '#16a085', color: '#fff', padding: '8px' }}>Total Kasus</th>
              <th style={{ background: '#16a085', color: '#fff', padding: '8px' }}>Total Spending (Rp)</th>
              <th style={{ background: '#e74c3c', color: '#fff', padding: '8px' }}>RS A</th>
              <th style={{ background: '#f1c40f', color: '#fff', padding: '8px' }}>RS B</th>
              <th style={{ background: '#3498db', color: '#fff', padding: '8px' }}>RS C</th>
              <th style={{ background: '#9b59b6', color: '#fff', padding: '8px' }}>RS D</th>
              <th style={{ background: '#e67e22', color: '#fff', padding: '8px' }}>Total</th>
              <th style={{ background: '#e74c3c', color: '#fff', padding: '8px' }}>RS A</th>
              <th style={{ background: '#f1c40f', color: '#fff', padding: '8px' }}>RS B</th>
              <th style={{ background: '#3498db', color: '#fff', padding: '8px' }}>RS C</th>
              <th style={{ background: '#9b59b6', color: '#fff', padding: '8px' }}>RS D</th>
              <th style={{ background: '#e67e22', color: '#fff', padding: '8px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {/* Rawat Inap */}
            <tr>
              <td rowSpan="2" style={{ fontWeight: 'bold', textAlign: 'center', border: '1px solid #ddd' }}>Rawat Inap</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Spending Ranap INA-CBG</td>
              <td rowSpan="2" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', verticalAlign: 'middle', fontWeight: 'bold' }}>{tipeList.reduce((acc, t) => acc + (getTipeNode(t, "ri")?.kasus || 0), 0).toLocaleString('en-US')}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + (getTipeNode(t, "ri")?.inacbg || 0), 0), true)}</td>
              {tipeList.map(t => <td key={'ina_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(getTipeNode(t, "ri")?.inacbg || 0, true)}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + (getTipeNode(t, "ri")?.inacbg || 0), 0), true)}</td>
              {tipeList.map(t => <td key={'pct_ina_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', color: '#ccc' }}>-</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', color: '#ccc' }}>-</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Spending Ranap iDRG</td>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "ri")), 0), true)}</td>
              {tipeList.map(t => <td key={'sim_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(getNodeSim(getTipeNode(t, "ri")), true)}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "ri")), 0), true)}</td>
              {tipeList.map(t => <td key={'pct_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderPercent(getNodeSim(getTipeNode(t, "ri")), getTipeNode(t, "ri")?.inacbg || 0)}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderPercent(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "ri")), 0), tipeList.reduce((acc, t) => acc + (getTipeNode(t, "ri")?.inacbg || 0), 0))}</td>
            </tr>
            {/* Rawat Jalan */}
            <tr>
              <td rowSpan="2" style={{ fontWeight: 'bold', textAlign: 'center', border: '1px solid #ddd' }}>Rawat Jalan</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Spending Rajal INA-CBG</td>
              <td rowSpan="2" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', verticalAlign: 'middle', fontWeight: 'bold' }}>{tipeList.reduce((acc, t) => acc + (getTipeNode(t, "rj")?.kasus || 0), 0).toLocaleString('en-US')}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + (getTipeNode(t, "rj")?.inacbg || 0), 0), true)}</td>
              {tipeList.map(t => <td key={'ina_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(getTipeNode(t, "rj")?.inacbg || 0, true)}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + (getTipeNode(t, "rj")?.inacbg || 0), 0), true)}</td>
              {tipeList.map(t => <td key={'pct_ina_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', color: '#ccc' }}>-</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', color: '#ccc' }}>-</td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Spending Rajal iDRG</td>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "rj")), 0), true)}</td>
              {tipeList.map(t => <td key={'sim_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(getNodeSim(getTipeNode(t, "rj")), true)}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "rj")), 0), true)}</td>
              {tipeList.map(t => <td key={'pct_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderPercent(getNodeSim(getTipeNode(t, "rj")), getTipeNode(t, "rj")?.inacbg || 0)}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderPercent(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "rj")), 0), tipeList.reduce((acc, t) => acc + (getTipeNode(t, "rj")?.inacbg || 0), 0))}</td>
            </tr>
            {/* Total */}
            <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
              <td rowSpan="2" style={{ textAlign: 'center', border: '1px solid #ddd' }}>Total</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Spending INA-CBG</td>
              <td rowSpan="2" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', verticalAlign: 'middle', fontWeight: 'bold' }}>
                {tipeList.reduce((acc, t) => acc + (getTipeNode(t, "ri")?.kasus || 0) + (getTipeNode(t, "rj")?.kasus || 0), 0).toLocaleString('en-US')}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{renderCell(tipeList.reduce((acc, t) => acc + (getTipeNode(t, "ri")?.inacbg || 0) + (getTipeNode(t, "rj")?.inacbg || 0), 0), true)}</td>
              {tipeList.map(t => <td key={'ina_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell((getTipeNode(t, "ri")?.inacbg || 0) + (getTipeNode(t, "rj")?.inacbg || 0), true)}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + (getTipeNode(t, "ri")?.inacbg || 0) + (getTipeNode(t, "rj")?.inacbg || 0), 0), true)}</td>
              {tipeList.map(t => <td key={'pct_ina_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', color: '#ccc' }}>-</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', color: '#ccc' }}>-</td>
            </tr>
            <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>Spending iDRG</td>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "ri")) + getNodeSim(getTipeNode(t, "rj")), 0), true)}</td>
              {tipeList.map(t => <td key={'sim_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderCell(getNodeSim(getTipeNode(t, "ri")) + getNodeSim(getTipeNode(t, "rj")), true)}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderCell(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "ri")) + getNodeSim(getTipeNode(t, "rj")), 0), true)}</td>
              {tipeList.map(t => <td key={'pct_'+t} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{renderPercent(getNodeSim(getTipeNode(t, "ri")) + getNodeSim(getTipeNode(t, "rj")), (getTipeNode(t, "ri")?.inacbg || 0) + (getTipeNode(t, "rj")?.inacbg || 0))}</td>)}
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderPercent(tipeList.reduce((acc, t) => acc + getNodeSim(getTipeNode(t, "ri")) + getNodeSim(getTipeNode(t, "rj")), 0), tipeList.reduce((acc, t) => acc + (getTipeNode(t, "ri")?.inacbg || 0) + (getTipeNode(t, "rj")?.inacbg || 0), 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
      {/* Table 2: Tipe RS & Kelas Rawat */}
      <div className="glass-panel" style={{ marginBottom: '32px', overflowX: 'auto' }}>
        <div className="flex-between" style={{ padding: '16px', background: '#e6f2f0' }}>
          <h3 style={{ margin: 0, color: '#008a70' }}>Berdasarkan Tipe RS (ABCD) - Kelas Rawat</h3>
          <DownloadExcelButton 
            headers={excelHeadersKelasRawat} 
            data={excelDataKelasRawat} 
            filename="Laporan_Kelas_Rawat.xlsx"
            groupHeaders={[
              { label: 'Jenis Layanan', colSpan: 1, rowSpan: 2, fill: '#1abc9c' },
              { label: 'Kelas Rawat', colSpan: 1, rowSpan: 2, fill: '#1abc9c' },
              { label: 'RS A', colSpan: 5, fill: '#e74c3c' },
              { label: 'RS B', colSpan: 5, fill: '#f1c40f' },
              { label: 'RS C', colSpan: 5, fill: '#3498db' },
              { label: 'RS D', colSpan: 5, fill: '#9b59b6' },
              { label: 'Total', colSpan: 5, fill: '#d35400' }
            ]}
          />
        </div>
        <table className="kemenkes-table export-pptx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'right' }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ background: '#1abc9c', color: '#fff', padding: '8px', textAlign: 'center' }}>Jenis Layanan</th>
              <th rowSpan="2" style={{ background: '#1abc9c', color: '#fff', padding: '8px', textAlign: 'center' }}>Kelas Rawat</th>
              {tipeList.map(t => <th key={t} colSpan="5" style={{ background: t === 'A' ? '#e74c3c' : t === 'B' ? '#f1c40f' : t === 'C' ? '#3498db' : '#9b59b6', color: '#fff', padding: '8px', textAlign: 'center' }}>RS {t}</th>)}
              <th colSpan="5" style={{ background: '#d35400', color: '#fff', padding: '8px', textAlign: 'center' }}>Total</th>
            </tr>
            <tr>
              {[...tipeList, 'Total'].map(t => (
                <React.Fragment key={t}>
                  <th style={{ background: t === 'Total' ? '#e67e22' : '#7f8c8d', color: '#fff', padding: '4px', textAlign: 'center' }}>Jumlah Kasus</th>
                  <th style={{ background: t === 'Total' ? '#e67e22' : '#7f8c8d', color: '#fff', padding: '4px', textAlign: 'center' }}>INA-CBG (Rp)</th>
                  <th style={{ background: t === 'Total' ? '#e67e22' : '#7f8c8d', color: '#fff', padding: '4px', textAlign: 'center' }}>iDRG (Rp)</th>
                  <th style={{ background: t === 'Total' ? '#e67e22' : '#7f8c8d', color: '#fff', padding: '4px', textAlign: 'center' }}>Selisih (Rp)</th>
                  <th style={{ background: t === 'Total' ? '#e67e22' : '#7f8c8d', color: '#fff', padding: '4px', textAlign: 'center' }}>% Selisih</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {['KRIS A', 'KRIS B', 'KRIS C'].map((kris, i) => (
              <tr key={kris}>
                {i === 0 && <td rowSpan="4" style={{ fontWeight: 'bold', textAlign: 'center', border: '1px solid #ddd' }}>Rawat Inap</td>}
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{kris}</td>
                {[...tipeList, 'Total'].map(t => {
                  const getRaw = (tip) => byKelasRawat[tip]?.[kris]?.ri || null;
                  const simAgg = t === 'Total'
                    ? tipeList.reduce((s, tip) => s + (getSimVal(getRaw(tip))), 0)
                    : getSimVal(getRaw(t));
                  const inacbgAgg = t === 'Total'
                    ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.inacbg || 0), 0)
                    : (getRaw(t)?.inacbg || 0);
                  const kasusAgg = t === 'Total'
                    ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.kasus || 0), 0)
                    : (getRaw(t)?.kasus || 0);
                  return (
                    <React.Fragment key={t+'_'+kris}>
                      <td style={{ border: '1px solid #ddd', padding: '4px', whiteSpace: 'nowrap' }}>{renderCell(kasusAgg)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', color: '#7f8c8d', whiteSpace: 'nowrap' }}>{renderCell(inacbgAgg, true)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', whiteSpace: 'nowrap' }}>{renderCell(simAgg, true)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderCell(simAgg - inacbgAgg, true, true)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderPercent(simAgg, inacbgAgg)}</td>
                    </React.Fragment>
                  )
                })}
              </tr>
            ))}
            {/* Total Rawat Inap */}
            <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Total Rawat Inap</td>
              {[...tipeList, 'Total'].map(t => {
                const allKris = ['KRIS A', 'KRIS B', 'KRIS C'];
                const getKrisRaw = (tip, k) => byKelasRawat[tip]?.[k]?.ri || null;
                const simAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + allKris.reduce((ss, k) => ss + getSimVal(getKrisRaw(tip, k)), 0), 0)
                  : allKris.reduce((ss, k) => ss + getSimVal(getKrisRaw(t, k)), 0);
                const inacbgAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + allKris.reduce((ss, k) => ss + (getKrisRaw(tip, k)?.inacbg || 0), 0), 0)
                  : allKris.reduce((ss, k) => ss + (getKrisRaw(t, k)?.inacbg || 0), 0);
                const kasusAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + allKris.reduce((ss, k) => ss + (getKrisRaw(tip, k)?.kasus || 0), 0), 0)
                  : allKris.reduce((ss, k) => ss + (getKrisRaw(t, k)?.kasus || 0), 0);
                return (
                  <React.Fragment key={'tot_ri_'+t}>
                    <td style={{ border: '1px solid #ddd', padding: '4px', whiteSpace: 'nowrap' }}>{renderCell(kasusAgg)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', color: '#7f8c8d', whiteSpace: 'nowrap' }}>{renderCell(inacbgAgg, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', whiteSpace: 'nowrap' }}>{renderCell(simAgg, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderCell(simAgg - inacbgAgg, true, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{renderPercent(simAgg, inacbgAgg)}</td>
                  </React.Fragment>
                )
              })}
            </tr>
            {/* Rawat Jalan */}
            <tr>
              <td rowSpan="2" style={{ fontWeight: 'bold', textAlign: 'center', border: '1px solid #ddd' }}>Rawat Jalan</td>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Rawat Jalan</td>
              {[...tipeList, 'Total'].map(t => {
                // For Rawat Jalan, just use byTipeRs directly as we already calculated it
                const getRaw = (tip) => getTipeNode(tip, "rj") || null;
                const simAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + (getSimVal(getRaw(tip))), 0)
                  : getSimVal(getRaw(t));
                const inacbgAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.inacbg || 0), 0)
                  : (getRaw(t)?.inacbg || 0);
                const kasusAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.kasus || 0), 0)
                  : (getRaw(t)?.kasus || 0);
                return (
                  <React.Fragment key={t+'_rj'}>
                    <td style={{ border: '1px solid #ddd', padding: '4px' }}>{renderCell(kasusAgg)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', color: '#7f8c8d' }}>{renderCell(inacbgAgg, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px' }}>{renderCell(simAgg, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold' }}>{renderCell(simAgg - inacbgAgg, true, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold' }}>{renderPercent(simAgg, inacbgAgg)}</td>
                  </React.Fragment>
                )
              })}
            </tr>
            {/* Total Rawat Jalan */}
            <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
              <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Total Rawat Jalan</td>
              {[...tipeList, 'Total'].map(t => {
                const getRaw = (tip) => getTipeNode(tip, "rj") || null;
                const simAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + (getSimVal(getRaw(tip))), 0)
                  : getSimVal(getRaw(t));
                const inacbgAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.inacbg || 0), 0)
                  : (getRaw(t)?.inacbg || 0);
                const kasusAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.kasus || 0), 0)
                  : (getRaw(t)?.kasus || 0);
                return (
                  <React.Fragment key={'tot_rj_'+t}>
                    <td style={{ border: '1px solid #ddd', padding: '4px' }}>{renderCell(kasusAgg)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', color: '#7f8c8d' }}>{renderCell(inacbgAgg, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px' }}>{renderCell(simAgg, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold' }}>{renderCell(simAgg - inacbgAgg, true, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold' }}>{renderPercent(simAgg, inacbgAgg)}</td>
                  </React.Fragment>
                )
              })}
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ background: '#e6f2f0', fontWeight: 'bold' }}>
              <td colSpan="2" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Total Seluruh Kasus</td>
              {[...tipeList, 'Total'].map(t => {
                const getTotRaw = (tip) => byTipeRs[tip] || null;
                const simAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + (getSimVal(getTotRaw(tip)?.ri) + getSimVal(getTotRaw(tip)?.rj)), 0)
                  : (getSimVal(getTotRaw(t)?.ri) + getSimVal(getTotRaw(t)?.rj));
                const inacbgAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + ((getTotRaw(tip)?.ri?.inacbg || 0) + (getTotRaw(tip)?.rj?.inacbg || 0)), 0)
                  : ((getTotRaw(t)?.ri?.inacbg || 0) + (getTotRaw(t)?.rj?.inacbg || 0));
                const kasusAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + ((getTotRaw(tip)?.ri?.kasus || 0) + (getTotRaw(tip)?.rj?.kasus || 0)), 0)
                  : ((getTotRaw(t)?.ri?.kasus || 0) + (getTotRaw(t)?.rj?.kasus || 0));
                return (
                  <React.Fragment key={'t2_tot_'+t}>
                    <td style={{ border: '1px solid #ddd', padding: '4px' }}>{renderCell(kasusAgg)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', color: '#7f8c8d' }}>{renderCell(inacbgAgg, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px' }}>{renderCell(simAgg, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold' }}>{renderCell(simAgg - inacbgAgg, true, true)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '4px', fontWeight: 'bold' }}>{renderPercent(simAgg, inacbgAgg)}</td>
                  </React.Fragment>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Table 3: Tipe RS & Kompetensi ICD */}
      <div className="glass-panel" style={{ marginBottom: '32px', overflowX: 'auto' }}>
        <div className="flex-between" style={{ padding: '16px', background: '#e6f2f0' }}>
          <h3 style={{ margin: 0, color: '#008a70' }}>Berdasarkan Tipe RS (ABCD) - Kompetensi ICD</h3>
          <DownloadExcelButton 
            headers={excelHeadersKomp} 
            data={excelDataKomp} 
            filename="Laporan_Kompetensi_ICD.xlsx"
            groupHeaders={[
              { label: 'Jenis Layanan', colSpan: 1, rowSpan: 2, fill: '#21a57c' },
              { label: 'Komp. ICD', colSpan: 1, rowSpan: 2, fill: '#21a57c' },
              { label: 'RS A', colSpan: 5, fill: '#e65c5c' },
              { label: 'RS B', colSpan: 5, fill: '#e3b814' },
              { label: 'RS C', colSpan: 5, fill: '#14a3b8' },
              { label: 'RS D', colSpan: 5, fill: '#a55ea3' },
              { label: 'Total', colSpan: 5, fill: '#c08f00' }
            ]}
          />
        </div>
        <table className="export-pptx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt', textAlign: 'right', border: '1px solid #ccc', fontFamily: "'Century Gothic', sans-serif" }}>
          <thead>
            <tr>
              <th rowSpan="2" style={{ background: '#21a57c', color: '#fff', padding: '4px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>Jenis<br/>Layanan</th>
              <th rowSpan="2" style={{ background: '#21a57c', color: '#fff', padding: '4px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>Komp.<br/>ICD</th>
              {tipeList.map(t => <th key={t} colSpan="5" style={{ background: t === 'A' ? '#e65c5c' : t === 'B' ? '#e3b814' : t === 'C' ? '#14a3b8' : '#a55ea3', color: '#fff', padding: '4px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>RS {t}</th>)}
              <th colSpan="5" style={{ background: '#c08f00', color: '#fff', padding: '4px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>Total</th>
            </tr>
            <tr>
              {[...tipeList, 'Total'].map(t => {
                const bg = t === 'A' ? '#e65c5c' : t === 'B' ? '#e3b814' : t === 'C' ? '#14a3b8' : t === 'D' ? '#a55ea3' : '#c08f00';
                return (
                  <React.Fragment key={t}>
                    <th style={{ background: bg, color: '#fff', padding: '2px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>Jumlah<br/>Kasus</th>
                    <th style={{ background: bg, color: '#fff', padding: '2px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>INA-CBG<br/>(Rp)</th>
                    <th style={{ background: bg, color: '#fff', padding: '2px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>iDRG<br/>(Rp)</th>
                    <th style={{ background: bg, color: '#fff', padding: '2px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>Selisih<br/>(Rp)</th>
                    <th style={{ background: bg, color: '#fff', padding: '2px', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>% Selisih</th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {['ri', 'rj'].map(ptd => {
              const labelPtd = ptd === 'ri' ? 'Rawat Inap' : 'Rawat Jalan';
              const komps = excludeNonKomp ? ['paripurna', 'utama', 'madya', 'dasar'] : ['paripurna', 'utama', 'madya', 'dasar', 'belum ada komp. icd'];
              
              const renderMoney = (val) => {
                if (!val) return '-';
                const num = val / 1000000000;
                const formatted = Math.abs(num).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return <span style={{ color: num < 0 ? '#cc0000' : 'inherit' }}>{num < 0 ? '-' : ''}{formatted}</span>;
              };
              const renderPct = (a, b) => {
                if (!b) return '0,00%';
                const pct = ((a - b) / b) * 100;
                const formatted = Math.abs(pct).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return <span style={{ color: pct < 0 ? '#cc0000' : 'inherit' }}>{pct < 0 ? '-' : ''}{formatted}%</span>;
              };
              
              return (
                <React.Fragment key={ptd}>
                  {komps.map((komp, i) => (
                    <tr key={ptd+'_'+komp} style={{ background: '#fff' }}>
                      {i === 0 && <td rowSpan={komps.length} style={{ fontWeight: 'bold', textAlign: 'center', border: '1px solid #ccc', background: '#fff' }}>{labelPtd}</td>}
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: 'center' }}>{kompLabel[komp] || komp}</td>
                      {[...tipeList, 'Total'].map(t => {
                        const getRaw = (tip) => byKompetensi[tip]?.[ptd]?.[komp] || null;
                        const simAgg = t === 'Total'
                          ? tipeList.reduce((s, tip) => s + getSimVal(getRaw(tip)), 0)
                          : getSimVal(getRaw(t));
                        const inacbgAgg = t === 'Total'
                          ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.inacbg || 0), 0)
                          : (getRaw(t)?.inacbg || 0);
                        const kasusAgg = t === 'Total'
                          ? tipeList.reduce((s, tip) => s + (getRaw(tip)?.kasus || 0), 0)
                          : (getRaw(t)?.kasus || 0);
                        return (
                          <React.Fragment key={t+'_'+komp}>
                            <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{kasusAgg === 0 ? '-' : kasusAgg.toLocaleString('id-ID')}</td>
                            <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(inacbgAgg)}</td>
                            <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(simAgg)}</td>
                            <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(simAgg - inacbgAgg)}</td>
                            <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderPct(simAgg, inacbgAgg)}</td>
                          </React.Fragment>
                        )
                      })}
                    </tr>
                  ))}
                  <tr style={{ background: '#e0e0e0', fontWeight: 'bold' }}>
                    <td colSpan="2" style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>Total {ptd === 'ri' ? 'RI' : 'RJ'}</td>
                    {[...tipeList, 'Total'].map(t => {
                      const getRaw = (tip, k) => byKompetensi[tip]?.[ptd]?.[k] || null;
                      const simAgg = t === 'Total'
                        ? tipeList.reduce((s, tip) => s + komps.reduce((ss, k) => ss + getSimVal(getRaw(tip, k)), 0), 0)
                        : komps.reduce((ss, k) => ss + getSimVal(getRaw(t, k)), 0);
                      const inacbgAgg = t === 'Total'
                        ? tipeList.reduce((s, tip) => s + komps.reduce((ss, k) => ss + (getRaw(tip, k)?.inacbg || 0), 0), 0)
                        : komps.reduce((ss, k) => ss + (getRaw(t, k)?.inacbg || 0), 0);
                      const kasusAgg = t === 'Total'
                        ? tipeList.reduce((s, tip) => s + komps.reduce((ss, k) => ss + (getRaw(tip, k)?.kasus || 0), 0), 0)
                        : komps.reduce((ss, k) => ss + (getRaw(t, k)?.kasus || 0), 0);
                      return (
                        <React.Fragment key={'tot_komp_'+ptd+'_'+t}>
                          <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{kasusAgg === 0 ? '-' : kasusAgg.toLocaleString('id-ID')}</td>
                          <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(inacbgAgg)}</td>
                          <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(simAgg)}</td>
                          <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(simAgg - inacbgAgg)}</td>
                          <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderPct(simAgg, inacbgAgg)}</td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#c9daf8', fontWeight: 'bold' }}>
              <td colSpan="2" style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center' }}>Grand Total</td>
              {[...tipeList, 'Total'].map(t => {
                const allKomps = excludeNonKomp ? ['paripurna', 'utama', 'madya', 'dasar'] : ['paripurna', 'utama', 'madya', 'dasar', 'belum ada komp. icd'];
                const allPtds = ['ri', 'rj'];
                const getRaw = (tip, ptd, komp) => byKompetensi[tip]?.[ptd]?.[komp] || null;
                const simAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + allPtds.reduce((ss, ptd) => ss + allKomps.reduce((sss, komp) => sss + getSimVal(getRaw(tip, ptd, komp)), 0), 0), 0)
                  : allPtds.reduce((ss, ptd) => ss + allKomps.reduce((sss, komp) => sss + getSimVal(getRaw(t, ptd, komp)), 0), 0);
                const inacbgAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + allPtds.reduce((ss, ptd) => ss + allKomps.reduce((sss, komp) => sss + (getRaw(tip, ptd, komp)?.inacbg || 0), 0), 0), 0)
                  : allPtds.reduce((ss, ptd) => ss + allKomps.reduce((sss, komp) => sss + (getRaw(t, ptd, komp)?.inacbg || 0), 0), 0);
                const kasusAgg = t === 'Total'
                  ? tipeList.reduce((s, tip) => s + allPtds.reduce((ss, ptd) => ss + allKomps.reduce((sss, komp) => sss + (getRaw(tip, ptd, komp)?.kasus || 0), 0), 0), 0)
                  : allPtds.reduce((ss, ptd) => ss + allKomps.reduce((sss, komp) => sss + (getRaw(t, ptd, komp)?.kasus || 0), 0), 0);
                  
                const renderMoney = (val) => {
                  if (!val) return '-';
                  const num = val / 1000000000;
                  const formatted = Math.abs(num).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return <span style={{ color: num < 0 ? '#cc0000' : 'inherit' }}>{num < 0 ? '-' : ''}{formatted}</span>;
                };
                const renderPct = (a, b) => {
                  if (!b) return '0,00%';
                  const pct = ((a - b) / b) * 100;
                  const formatted = Math.abs(pct).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return <span style={{ color: pct < 0 ? '#cc0000' : 'inherit' }}>{pct < 0 ? '-' : ''}{formatted}%</span>;
                };
                
                return (
                  <React.Fragment key={'t3_tot_'+t}>
                    <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{kasusAgg === 0 ? '-' : kasusAgg.toLocaleString('id-ID')}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(inacbgAgg)}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(simAgg)}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderMoney(simAgg - inacbgAgg)}</td>
                    <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>{renderPct(simAgg, inacbgAgg)}</td>
                  </React.Fragment>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      </div>
{/* --- SECTION: INA-CBG → iDRG Lookup --- */}
      <h2 style={{ paddingBottom: '8px', borderBottom: '2px solid var(--glass-border)', color: 'var(--accent-primary)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Search size={20} />
        Pencarian Kode INA-CBG → 10 Besar iDRG
      </h2>
      <div className="glass-card" style={{ padding: '24px', marginBottom: '40px' }}>
        <p className="text-secondary" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
          Cari kode INA-CBG untuk melihat 10 besar kode iDRG yang dihasilkan dari kode tersebut, lengkap dengan kelompok dan deskripsinya.
        </p>
        {/* Search bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
          <input
            id="inacbg-search-input"
            type="text"
            value={inacbgSearch}
            onChange={e => setInacbgSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInacbgSearch()}
            placeholder="Contoh: Q-5-44-0"
            style={{
              flex: 1, padding: '10px 16px', borderRadius: '8px',
              border: '1px solid var(--glass-border)', background: 'var(--glass-bg)',
              color: 'var(--text-primary)', fontSize: '1rem', fontFamily: 'monospace'
            }}
          />
          <button
            id="inacbg-search-btn"
            onClick={handleInacbgSearch}
            style={{
              padding: '10px 24px', borderRadius: '8px', border: 'none',
              background: 'var(--accent-primary)', color: '#fff',
              fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Search size={16} /> Cari
          </button>
        </div>

        {/* Result */}
        {inacbgResult && (() => {
          if (!derivedInacbgData || Object.keys(derivedInacbgData).length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                {inacbgResult.fetchError ? (
                  <>
                    <div style={{ color: 'var(--accent-red)', marginBottom: '8px', fontWeight: 600 }}>⚠️ Gagal memuat data detail RS untuk kode INA-CBG {inacbgResult.code}</div>
                    <div style={{ fontSize: '0.9rem' }}>File data mungkin terlalu besar atau tidak ditemukan. Hasil filter Rumah Sakit tidak dapat ditampilkan.</div>
                  </>
                ) : (
                  <>⚠️ Kode INA-CBG <strong>{inacbgResult.code}</strong> tidak ditemukan dalam data dengan filter yang dipilih.</>
                )}
              </div>
            );
          }
          // Map to objects
          const objectsArray = Object.entries(derivedInacbgData || {}).map(([code, v]) => ({
             code, ...v,
             sim: v[`tarif_${simulasi}`] || 0,
             pct: v.kasus // will calculate proper percent below
          }));
          
          const totalKasus = Object.values(derivedInacbgData).reduce((s, v) => s + v.kasus, 0);
          objectsArray.forEach(obj => obj.pct = totalKasus > 0 ? (obj.kasus / totalKasus) * 100 : 0);

          objectsArray.sort((a, b) => {
             let valA = a[inacbgSort.key];
             let valB = b[inacbgSort.key];
             if (typeof valA === 'string') {
                const res = valA.localeCompare(valB || '');
                return inacbgSort.direction === 'ascending' ? res : -res;
             }
             const res = (valA || 0) < (valB || 0) ? -1 : ((valA || 0) > (valB || 0) ? 1 : 0);
             return inacbgSort.direction === 'ascending' ? res : -res;
          });

          const sorted = objectsArray.slice(0, 10);
          const totalInacbg = Object.values(derivedInacbgData).reduce((s, v) => s + v.inacbg, 0);
          const totalSim = Object.values(derivedInacbgData).reduce((s, v) => s + (v[`tarif_${simulasi}`] || 0), 0);

          const barLabels = sorted.map((v) => wrapText(`${v.code} - ${v.deskripsi || '-'}`, 35));
          const barKasus = sorted.map((v) => v.kasus);
          const barColors = sorted.map((_, i) => [
            '#1abc9c','#3498db','#9b59b6','#e67e22','#e74c3c',
            '#27ae60','#2980b9','#8e44ad','#d35400','#c0392b'
          ][i]);

          return (
            <div>
              <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
                Hasil untuk kode INA-CBG: <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontSize: '1.1em' }}>{inacbgResult.code}</span>
              </h4>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center', minWidth: '140px' }}>
                  <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Total Kode iDRG</p>
                  <p style={{ fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--accent-primary)' }}>{Object.keys(derivedInacbgData).length}</p>
                </div>
                <div className="glass-card" style={{ padding: '16px', textAlign: 'center', background: '#fffcf5' }}>
                  <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Total Kasus</p>
                  <p style={{ fontWeight: 'bold', fontSize: '1.4rem', color: '#e67e22' }}>{(totalKasus || 0).toLocaleString()}</p>
                </div>
                <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center', minWidth: '140px' }}>
                  <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Total INA-CBG</p>
                  <p style={{ fontWeight: 'bold', fontSize: '1.4rem', color: '#3498db' }}>{formatCompactCurrency(totalInacbg)}</p>
                </div>
                <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center', minWidth: '140px' }}>
                  <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Total iDRG</p>
                  <p style={{ fontWeight: 'bold', fontSize: '1.4rem', color: '#27ae60' }}>{formatCompactCurrency(totalSim)}</p>
                </div>
              </div>

              {/* Bar Chart */}
              <div style={{ height: '420px', marginBottom: '24px' }}>
                <PlotWithSave
                  data={[{
                    x: barKasus.slice().reverse(),
                    y: barLabels.slice().reverse(),
                    type: 'bar',
                    orientation: 'h',
                    marker: { color: barColors.slice().reverse() },
                    text: barKasus.slice().reverse().map(v => formatCompactNumber(v)),
                    textposition: 'outside',
                    cliponaxis: false,
                    hovertemplate: '<b>%{y}</b><br>Kasus: %{x:,}<extra></extra>'
                  }]}
                  layout={{
                    autosize: true,
                    margin: { l: 260, r: 150, t: 20, b: 50 },
                    xaxis: { title: 'Jumlah Kasus', color: '#1e293b' },
                    yaxis: { automargin: true, color: '#1e293b' },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    font: { color: '#1e293b' }
                  }}
                  config={{ responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                  exportTitle={`10 Besar iDRG dari INA-CBG: ${inacbgResult.code}`}
                  filename={`iDRG_dari_${inacbgResult.code}`}
                  width={1200}
                  height={700}
                />
              </div>

              {/* Detail Table */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <DownloadExcelButton
                  headers={['No', 'Kode iDRG', 'Deskripsi iDRG', 'Kelompok Layanan Khusus', 'Jumlah Kasus', '% Kasus', 'INA-CBG (Rp)', 'Tarif iDRG (Rp)']}
                  data={objectsArray.map((v, idx) => [
                    idx + 1,
                    v.code,
                    v.deskripsi || '-',
                    v.kelompok || '-',
                    v.kasus,
                    (v.pct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})) + '%',
                    v.inacbg,
                    v.sim
                  ])}
                  filename={`INA_CBG_${inacbgResult.code}_iDRG.xlsx`}
                />
              </div>
              <table className="kemenkes-table export-pptx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#16a085', color: '#fff', padding: '8px' }}>No</th>
                    <th onClick={() =>requestInacbgSort('code')} style={{ background: '#16a085', color: '#fff', padding: '8px', cursor: 'pointer', userSelect: 'none' }}>Kode iDRG {getInacbgSortIndicator('code')}</th>
                    <th onClick={() =>requestInacbgSort('deskripsi')} style={{ background: '#16a085', color: '#fff', padding: '8px', cursor: 'pointer', userSelect: 'none' }}>Deskripsi iDRG {getInacbgSortIndicator('deskripsi')}</th>
                    <th onClick={() =>requestInacbgSort('kelompok')} style={{ background: '#27ae60', color: '#fff', padding: '8px', cursor: 'pointer', userSelect: 'none' }}>Kelompok Layanan Khusus {getInacbgSortIndicator('kelompok')}</th>
                    <th onClick={() => requestInacbgSort('kasus')} style={{ background: '#2980b9', color: '#fff', padding: '8px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>Jumlah Kasus {getInacbgSortIndicator('kasus')}</th>
                    <th onClick={() => requestInacbgSort('pct')} style={{ background: '#e67e22', color: '#fff', padding: '8px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>% Kasus {getInacbgSortIndicator('pct')}</th>
                    <th onClick={() => requestInacbgSort('inacbg')} style={{ background: '#7f8c8d', color: '#fff', padding: '8px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>INA-CBG (Rp Miliar) {getInacbgSortIndicator('inacbg')}</th>
                    <th onClick={() => requestInacbgSort('sim')} style={{ background: '#1abc9c', color: '#fff', padding: '8px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>Tarif iDRG (Rp Miliar) {getInacbgSortIndicator('sim')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((v, idx) => (
                    <tr key={v.code} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{v.code}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{v.deskripsi}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(26,188,156,0.15)', color: '#16a085', fontSize: '0.8rem' }}>{kompLabel[v.kelompok] || v.kelompok}</span>
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#2980b9' }}>{v.kasus.toLocaleString()}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', color: '#e67e22' }}>{v.pct.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatTableMiliar(v.inacbg)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#1abc9c' }}>{formatTableMiliar(v.sim)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f0f9f7', fontWeight: 'bold' }}>
                    <td colSpan="4" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>TOTAL (seluruh {Object.keys(derivedInacbgData).length} kode iDRG)</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{(totalKasus || 0).toLocaleString()}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>100%</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatTableMiliar(totalInacbg)}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatTableMiliar(totalSim)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}

        {!inacbgResult && (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
            {inacbgToDrgData ? '🔍 Masukkan kode INA-CBG di atas lalu tekan Cari' : '⏳ Data lookup belum tersedia. Pastikan pipeline data sudah dijalankan.'}
          </div>
        )}
      </div>

    </div>
  );
};

export default LaporanNasional;
