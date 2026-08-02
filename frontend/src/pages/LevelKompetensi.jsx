import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Download, Search, AlertCircle, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '../components/StatCard';
import SpendingShiftChart from '../components/SpendingShiftChart';
import GenericScatterPlot from '../components/GenericScatterPlot';
import DownloadExcelButton from '../components/DownloadExcelButton';
import DownloadPptxButton from '../components/DownloadPptxButton';
import TabelLaporanKompetensi from '../components/TabelLaporanKompetensi';
import { formatCompactCurrency , formatTableMiliar} from '../utils/formatters';
import { matchesGroup, RS_GROUPS } from '../utils/rsGroups';
import { filterHospital } from '../utils/filterUtils';
import { loadDatasetFile } from '../utils/dataLoader';


const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const LevelKompetensi = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg } ) => {
  const [levelsData, setLevelsData] = useState(null);
  const [hospitalsData, setHospitalsData] = useState(null);
  const [rsProfilesData, setRsProfilesData] = useState(null);
  const [crossData, setCrossData] = useState(null);
  const [servicesData, setServicesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLimit, setChartLimit] = useState('all');

  useEffect(() => {
    setLoading(true);
    const ts = Date.now();
    Promise.all([
      loadDatasetFile(dataset, 'levels', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'rs_profiles', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'crosstab', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'services', globalMonth, globalDrg),
    ]).then(([lvl, hosp, prof, cross, svc]) => {
      setLevelsData(lvl);
      setHospitalsData(hosp);
      setRsProfilesData(prof);
      setCrossData(cross);
      setServicesData(svc);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [dataset]);

  if (loading || !levelsData || !hospitalsData || !rsProfilesData || !crossData || !servicesData) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Data Kompetensi...</span>
      </div>
    );
  }

  const simulasiKey = `tarif_${simulasi}`;
  const validLevels = ['dasar', 'madya', 'utama', 'paripurna'];
  const activeGroup = null /* removed single active group logic */ || null;
  
  let chartData = [];
  let totalKasusLvl = 0;
  
  let activeScorecard = crossData.scorecard;

  if (rsFilter || (groupFilter && groupFilter.length > 0) || wilayahFilter || excludeNonKomp) {
    activeScorecard = {
      total: { sesuai: { kasus: 0, inacbg: 0 }, loss: { kasus: 0, inacbg: 0 } },
      byKompetensi: {}
    };
    for (let i = 1; i <= 11; i++) {
      activeScorecard.total.sesuai[`tarif_${i}`] = 0;
      activeScorecard.total.loss[`tarif_${i}`] = 0;
    }

    const levelMap = {};
    validLevels.forEach(lvl => {
      levelMap[lvl] = { kasus: 0, inacbg: 0, sim: 0 };
    });

    Object.entries(hospitalsData).forEach(([kode, rs]) => {
      if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;
      if (!rsProfilesData[kode]?.crosstab?.byLayanan) return;

      Object.entries(rsProfilesData[kode].crosstab.byLayanan).forEach(([layananName, lData]) => {
         let officialComp = 'Tidak Kompeten';
         if (rsKompetensiOnline && rsKompetensiOnline[kode] && rsKompetensiOnline[kode][layananName.toLowerCase()]) {
             officialComp = rsKompetensiOnline[kode][layananName.toLowerCase()];
         }

         let matchedLvl = validLevels.find(l => officialComp.toLowerCase().includes(l));
         if (matchedLvl && lData.nasional) {
             levelMap[matchedLvl].kasus += lData.nasional.kasus || 0;
             levelMap[matchedLvl].inacbg += lData.nasional.inacbg || 0;
             levelMap[matchedLvl].sim += lData.nasional[simulasiKey] || 0;
         }

         // Calculate Kesesuaian (Scorecard)
         if (lData.byKompetensi && officialComp.toLowerCase() !== 'tidak kompeten') {
             const compOrder = { 'dasar': 1, 'madya': 2, 'utama': 3, 'paripurna': 4 };
             const hospLvl = compOrder[officialComp.toLowerCase()] || 0;

             Object.values(lData.byKompetensi).forEach(kelasData => {
                 ['ri', 'rj'].forEach(tipe => {
                     if (kelasData[tipe]) {
                         Object.entries(kelasData[tipe]).forEach(([caseKomp, caseData]) => {
                             const caseLvl = compOrder[caseKomp.toLowerCase()] || 0;
                             const category = caseLvl <= hospLvl ? 'sesuai' : 'loss';
                             
                             activeScorecard.total[category].kasus += caseData.kasus || 0;
                             activeScorecard.total[category].inacbg += caseData.inacbg || 0;
                             for (let i = 1; i <= 11; i++) {
                                 activeScorecard.total[category][`tarif_${i}`] += caseData.sim?.[`tarif_${i}`] || 0;
                             }

                             if (!activeScorecard.byKompetensi[caseKomp.toLowerCase()]) {
                                 activeScorecard.byKompetensi[caseKomp.toLowerCase()] = {
                                     sesuai: { kasus: 0, inacbg: 0 },
                                     loss: { kasus: 0, inacbg: 0 }
                                 };
                                 for (let i = 1; i <= 11; i++) {
                                     activeScorecard.byKompetensi[caseKomp.toLowerCase()].sesuai[`tarif_${i}`] = 0;
                                     activeScorecard.byKompetensi[caseKomp.toLowerCase()].loss[`tarif_${i}`] = 0;
                                 }
                             }

                             activeScorecard.byKompetensi[caseKomp.toLowerCase()][category].kasus += caseData.kasus || 0;
                             activeScorecard.byKompetensi[caseKomp.toLowerCase()][category].inacbg += caseData.inacbg || 0;
                             for (let i = 1; i <= 11; i++) {
                                 activeScorecard.byKompetensi[caseKomp.toLowerCase()][category][`tarif_${i}`] += caseData.sim?.[`tarif_${i}`] || 0;
                             }
                         });
                     }
                 });
             });
         }
      });
    });

    chartData = validLevels.map(lvl => {
      const d = levelMap[lvl];
      totalKasusLvl += d.kasus;
      return {
        name: lvl.charAt(0).toUpperCase() + lvl.slice(1),
        inacbg: d.inacbg,
        simulasi: d.sim,
        delta: d.sim - d.inacbg,
        kasus: d.kasus
      };
    });

    chartData = validLevels.map(lvl => {
      const d = levelMap[lvl];
      totalKasusLvl += d.kasus;
      return {
        name: lvl.charAt(0).toUpperCase() + lvl.slice(1),
        inacbg: d.inacbg,
        simulasi: d.sim,
        delta: d.sim - d.inacbg,
        kasus: d.kasus
      };
    });
  } else {
    validLevels.forEach(lvl => {
      const key = Object.keys(levelsData).find(k => k.includes(lvl));
      if (key && levelsData[key]) {
        const inacbg = levelsData[key].inacbg || 0;
        const sim = levelsData[key][simulasiKey] || 0;
        totalKasusLvl += levelsData[key].kasus || 0;
        chartData.push({
          name: lvl.charAt(0).toUpperCase() + lvl.slice(1),
          inacbg: inacbg,
          simulasi: sim,
          delta: sim - inacbg,
          kasus: levelsData[key].kasus || 0
        });
      } else {
        chartData.push({
          name: lvl.charAt(0).toUpperCase() + lvl.slice(1),
          inacbg: 0,
          simulasi: 0,
          delta: 0,
          kasus: 0
        });
      }
    });
  }

  if (excludeNonKomp && activeScorecard && activeScorecard.byKompetensi) {
    const cloned = JSON.parse(JSON.stringify(activeScorecard));
    if (cloned.byKompetensi['belum ada komp. icd']) {
      delete cloned.byKompetensi['belum ada komp. icd'];
    }
    cloned.total = { sesuai: {kasus:0, inacbg:0}, loss: {kasus:0, inacbg:0} };
    for (let i = 1; i <= 11; i++) {
      cloned.total.sesuai[`tarif_${i}`] = 0;
      cloned.total.loss[`tarif_${i}`] = 0;
    }
    Object.values(cloned.byKompetensi).forEach(d => {
      cloned.total.sesuai.kasus += d.sesuai?.kasus || 0;
      cloned.total.sesuai.inacbg += d.sesuai?.inacbg || 0;
      cloned.total.loss.kasus += d.loss?.kasus || 0;
      cloned.total.loss.inacbg += d.loss?.inacbg || 0;
      for (let i = 1; i <= 11; i++) {
        cloned.total.sesuai[`tarif_${i}`] += d.sesuai?.[`tarif_${i}`] || 0;
        cloned.total.loss[`tarif_${i}`] += d.loss?.[`tarif_${i}`] || 0;
      }
    });
    activeScorecard = cloned;
  }

  const excelHeaders = [
    "Kompetensi Layanan ICD / Klaim JKN",
    "Total Kasus Klaim", "Total INA CBG (Rp)", "Total iDRG (Rp)",
    "Kasus Sesuai", "INA CBG Sesuai (Rp)", "iDRG Sesuai (Rp)",
    "Kasus Loss", "INA CBG Loss (Rp)", "iDRG Loss (Rp)",
    "% Kasus Loss", "% INA CBG Loss", "% iDRG Loss"
  ];

  const excelData = (() => {
    let rows = ['dasar', 'madya', 'utama', 'paripurna', 'belum ada komp. icd'].map(komp => {
      const data = activeScorecard.byKompetensi[komp] || { sesuai: { kasus:0, inacbg:0 }, loss: { kasus:0, inacbg:0 } };
      const simSesuai = (data.sesuai?.[simulasiKey] || 0) || 0;
      const simLoss = (data.loss?.[simulasiKey] || 0) || 0;
      const totalKasus = (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
      const totalInacbg = (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
      const totalIdrg = simSesuai + simLoss;
      const pctKasus = totalKasus > 0 ? ((data.loss?.kasus || 0) / totalKasus) * 100 : 0;
      const pctInacbg = totalInacbg > 0 ? ((data.loss?.inacbg || 0) / totalInacbg) * 100 : 0;
      const pctIdrg = totalIdrg > 0 ? (simLoss / totalIdrg) * 100 : 0;
      return [
        komp.toUpperCase(),
        totalKasus, totalInacbg, totalIdrg,
        (data.sesuai?.kasus || 0), (data.sesuai?.inacbg || 0), simSesuai,
        (data.loss?.kasus || 0), (data.loss?.inacbg || 0), simLoss,
        pctKasus.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%', pctInacbg.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%', pctIdrg.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%'
      ];
    });

    const tSesuaiK = activeScorecard.total.sesuai.kasus;
    const tSesuaiI = activeScorecard.total.sesuai.inacbg;
    const tSesuaiD = activeScorecard.total.sesuai[simulasiKey];
    const tLossK = activeScorecard.total.loss.kasus;
    const tLossI = activeScorecard.total.loss.inacbg;
    const tLossD = activeScorecard.total.loss[simulasiKey];
    const tKasus = tSesuaiK + tLossK;
    const tInacbg = tSesuaiI + tLossI;
    const tIdrg = tSesuaiD + tLossD;
    const pK = tKasus > 0 ? ((tLossK / tKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
    const pI = tInacbg > 0 ? ((tLossI / tInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
    const pD = tIdrg > 0 ? ((tLossD / tIdrg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';

    rows.push([
      'TOTAL',
      tKasus, tInacbg, tIdrg,
      tSesuaiK, tSesuaiI, tSesuaiD,
      tLossK, tLossI, tLossD,
      pK, pI, pD
    ]);

    return rows;
  })();

  // Build Kelompok Layanan Scorecard (aggregated from per-RS byKelompok)
  const kelompokScorecard = (() => {
    const result = {};
    if (!rsProfilesData || !hospitalsData) return result;
    
    Object.entries(hospitalsData).forEach(([kode, rs]) => {
      if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;
      
      const prof = rsProfilesData[kode];
      if (!prof || !prof.scorecard || !prof.scorecard.byKelompok) return;

      Object.entries(prof.scorecard.byKelompok).forEach(([kelompok, data]) => {
        if (!result[kelompok]) {
          result[kelompok] = {
            sesuai: { kasus: 0, inacbg: 0 },
            loss: { kasus: 0, inacbg: 0 }
          };
          for (let i = 1; i <= 11; i++) {
            result[kelompok].sesuai[`tarif_${i}`] = 0;
            result[kelompok].loss[`tarif_${i}`] = 0;
          }
        }
        ['sesuai', 'loss'].forEach(key => {
          result[kelompok][key].kasus += data[key].kasus || 0;
          result[kelompok][key].inacbg += data[key].inacbg || 0;
          for (let i = 1; i <= 11; i++) {
            result[kelompok][key][`tarif_${i}`] += data[key][`tarif_${i}`] || 0;
          }
        });
      });
    });
    return result;
  })();

  // Sort kelompok by total kasus descending
  const kelompokSorted = Object.keys(kelompokScorecard).sort((a, b) => {
    const totalA = kelompokScorecard[a].sesuai.kasus + kelompokScorecard[a].loss.kasus;
    const totalB = kelompokScorecard[b].sesuai.kasus + kelompokScorecard[b].loss.kasus;
    return totalB - totalA;
  });

  const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];

  let serviceKompData = [];
  if (rsProfilesData && hospitalsData) {
    const sMap = {};
    Object.entries(hospitalsData).forEach(([kode, rs]) => {
      if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;

      const prof = rsProfilesData[kode];
      if (!prof) return;

      const kompRaw = (rs.faskesKomp || '').toLowerCase();
      const komp = validLevels.find(l => kompRaw.includes(l)) || 'lainnya';

      Object.entries(rs.byKelompok || {}).forEach(([layanan, dataObj]) => {
        if (activeLayananFilters.length > 0 && !activeLayananFilters.includes(layanan)) return;
        const kasus = dataObj.kasus || 0;
        if (!sMap[layanan]) sMap[layanan] = { layanan, dasar: 0, madya: 0, utama: 0, paripurna: 0, lainnya: 0, total: 0 };
        sMap[layanan][komp] += kasus;
        sMap[layanan].total += kasus;
      });
    });

    serviceKompData = Object.values(sMap).sort((a, b) => b.total - a.total);
  }

  let activeServicesData = servicesData;
  if (rsFilter || (groupFilter && groupFilter.length > 0) || wilayahFilter || excludeNonKomp) {
    activeServicesData = {};
    const codes = Object.keys(hospitalsData).filter(kode => {
      const rs = hospitalsData[kode];
      return filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp);
    });

    codes.forEach(kode => {
      const prof = rsProfilesData[kode];
      if (!prof || !prof.svc) return;
      
      Object.entries(prof.svc).forEach(([kelompok, ptds]) => {
         if (activeLayananFilters.length > 0 && !activeLayananFilters.includes(kelompok)) return;
         if (!activeServicesData[kelompok]) activeServicesData[kelompok] = { ri: { byKomp: {} }, rj: { byKomp: {} } };
         Object.entries(ptds).forEach(([ptdKey, komps]) => {
            const targetPtd = activeServicesData[kelompok][ptdKey];
            Object.entries(komps).forEach(([kompKey, arr]) => {
               if (!targetPtd.byKomp) targetPtd.byKomp = {};
               if (!targetPtd.byKomp[kompKey]) {
                 targetPtd.byKomp[kompKey] = { kasus: 0, inacbg: 0 };
                 for(let i=1; i<=11; i++) targetPtd.byKomp[kompKey][`tarif_${i}`] = 0;
               }
               
               if (targetPtd.kasus === undefined) {
                 targetPtd.kasus = 0;
                 targetPtd.inacbg = 0;
                 for(let i=1; i<=11; i++) targetPtd[`tarif_${i}`] = 0;
               }

               targetPtd.byKomp[kompKey].kasus += arr[0];
               targetPtd.byKomp[kompKey].inacbg += arr[1];
               for(let i=1; i<=11; i++) targetPtd.byKomp[kompKey][`tarif_${i}`] += arr[1+i];

               targetPtd.kasus += arr[0];
               targetPtd.inacbg += arr[1];
               for(let i=1; i<=11; i++) targetPtd[`tarif_${i}`] += arr[1+i];

            });
         });
      });
    });
  }

  console.log('DEBUG: kelompokSorted length =', kelompokSorted.length, 'kelompokScorecard:', kelompokScorecard);

  return (
    <div className="animate-fade-in-up">
      <div style={{ marginBottom: '32px', position: 'relative' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BarChart2 size={32} /> Analisis Rujukan Berbasis Kompetensi
        </h1>
        <div style={{ position: 'absolute', top: '0px', right: '0px' }}>
          <DownloadPptxButton title="Level Kompetensi iDRG" />
        </div>
          <p className="text-secondary">
            Analisis Shifting Spending per Tingkat Kompetensi Rumah Sakit
            <span>{isExcludeMode ? 'Mengecualikan' : 'Menampilkan'} data khusus {activeGroup ? `grup ${activeGroup.label}` : ''} {activeGroup && wilayahFilter ? 'di' : ''} {wilayahFilter?.length > 0 ? `wilayah ${wilayahFilter.join(", ")}` : ""} {rsFilter ? `pencarian "${rsFilter}"` : ''}</span>
          </p>
          {(activeGroup || wilayahFilter || rsFilter) && (
            <div style={{
              marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 14px', borderRadius: '20px',
              background: activeGroup ? `${activeGroup.color}22` : 'rgba(56, 189, 248, 0.1)', 
              border: activeGroup ? `1px solid ${activeGroup.color}88` : '1px solid rgba(56, 189, 248, 0.4)',
              fontSize: '0.82rem', color: activeGroup ? activeGroup.color : '#0284c7', fontWeight: 600
            }}>
              <span>🎯</span>
              <span>Menampilkan data terfilter — {totalKasusLvl.toLocaleString()} kasus</span>
            </div>
          )}
        </div>

      {/* --- SCORECARD KOMPETENSI --- */}
      {activeScorecard && (
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '2px solid var(--glass-border)', marginBottom: '24px' }}>
            <h2 style={{ color: 'var(--accent-primary)', margin: 0 }}>
              📊 Scorecard Rujukan Berbasis Kompetensi Layanan
            </h2>
            <DownloadExcelButton 
              headers={excelHeaders} 
              data={excelData} 
              filename={`Matriks_Kompetensi_${simulasiKey}.xlsx`}
              groupHeaders={[
                { label: 'Kompetensi Layanan ICD / Klaim JKN', colSpan: 1, rowSpan: 2, fill: '#008080' },
                { label: 'Sesuai Kompetensi', colSpan: 3, fill: '#1abc9c' },
                { label: 'Potensi Loss', colSpan: 3, fill: '#e74c3c' },
                { label: '% Potensi Loss', colSpan: 3, fill: '#f39c12' }
              ]}
            />
          </div>
          
          <div style={{ padding: '12px 16px', background: 'rgba(2, 132, 199, 0.05)', borderLeft: '4px solid #0284c7', borderRadius: '4px', marginBottom: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong>Catatan Pembacaan Data:</strong>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
              <li><strong>Scorecard (Atas):</strong> Menampilkan <b>Total Agregat</b> dari seluruh level kompetensi.</li>
              <li><strong>Tabel Matriks (Bawah):</strong> Dikelompokkan berdasarkan <b>Tingkat Kesulitan Penyakit/ICD</b>. Menunjukkan apakah RS menangani kasus yang sesuai dengan kapasitasnya atau melebihi kapasitasnya (Potensi Loss).</li>
              <li><strong>Grafik Bar (Bawah Tabel):</strong> Dikelompokkan murni berdasarkan <b>Level Izin/Kompetensi Rumah Sakit</b> yang bersangkutan.</li>
            </ul>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #e67e22' }}>
              <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '8px' }}>Total Pendapatan INA-CBG (Rp Miliar)</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#e67e22' }}>
                {formatCompactCurrency(activeScorecard.total.sesuai.inacbg + activeScorecard.total.loss.inacbg)}
              </p>
              <p style={{ fontSize: '0.875rem', marginTop: '8px', color: 'var(--text-muted)' }}>
                Baseline Eksisting
              </p>
            </div>
            
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #0284c7' }}>
              <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '8px' }}>Total Pendapatan iDRG (Rp Miliar)</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0284c7' }}>
                {formatCompactCurrency(activeScorecard.total.sesuai[simulasiKey] + activeScorecard.total.loss[simulasiKey])}
              </p>
              <p style={{ fontSize: '0.875rem', marginTop: '8px', color: 'var(--text-muted)' }}>
                Sesuai Kompetensi + Loss
              </p>
            </div>

            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-success)' }}>
              <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '12px' }}>Pendapatan Sesuai Kompetensi</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                <div>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>INA-CBG</p>
                   <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-success)', lineHeight: 1 }}>
                     {formatCompactCurrency(activeScorecard.total.sesuai.inacbg)}
                   </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>iDRG</p>
                   <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0284c7', lineHeight: 1 }}>
                     {formatCompactCurrency(activeScorecard.total.sesuai[simulasiKey])}
                   </p>
                </div>
              </div>
              <p style={{ fontSize: '0.875rem', marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                Kasus: {activeScorecard.total.sesuai.kasus.toLocaleString()}
              </p>
            </div>
            
            <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-danger)' }}>
              <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '12px' }}>Potensi Loss (Di Atas Kompetensi)</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                <div>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>INA-CBG</p>
                   <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-danger)', lineHeight: 1 }}>
                     {formatCompactCurrency(activeScorecard.total.loss.inacbg)}
                   </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>iDRG</p>
                   <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e74c3c', lineHeight: 1 }}>
                     {formatCompactCurrency(activeScorecard.total.loss[simulasiKey])}
                   </p>
                </div>
              </div>
              <p style={{ fontSize: '0.875rem', marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                Kasus: {activeScorecard.total.loss.kasus.toLocaleString()}
              </p>
            </div>
          </div>

          {/* --- SUMMARY TABLE TINGKAT KOMPETENSI --- */}
          <div className="glass-panel" style={{ overflowX: 'auto', marginBottom: '32px' }}>
            <div style={{ padding: '16px', background: '#e6f2f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#008a70' }}>Ringkasan Shifting per Tingkat Kompetensi</h3>
              <DownloadExcelButton 
                headers={["TINGKAT KOMPETENSI", "KASUS", "% Kasus RS", "INA-CBG (M)", "iDRG (M)", "SELISIH (M)", "% Selisih"]} 
                data={(() => {
                  const exportData = [];
                  const komps = excludeNonKomp ? ['dasar', 'madya', 'utama', 'paripurna'] : ['dasar', 'madya', 'utama', 'paripurna', 'belum ada komp. icd'];
                  komps.forEach(komp => {
                    const data = activeScorecard.byKompetensi[komp] || { sesuai: { kasus:0, inacbg:0 }, loss: { kasus:0, inacbg:0 } };
                    const simSesuai = (data.sesuai?.[simulasiKey] || 0) || 0;
                    const simLoss = (data.loss?.[simulasiKey] || 0) || 0;
                    const tKasus = (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
                    const tInacbg = (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
                    const tIdrg = simSesuai + simLoss;
                    const tSelisih = tIdrg - tInacbg;
                    const tKasusTotal = activeScorecard.total.sesuai.kasus + activeScorecard.total.loss.kasus;
                    const pctKasus = tKasusTotal > 0 ? (tKasus / tKasusTotal * 100) : 0;
                    const pctSelisih = tInacbg > 0 ? (tSelisih / tInacbg * 100) : 0;
                    
                    exportData.push([
                      komp === 'belum ada komp. icd' ? 'Belum ada komp. ICD' : komp,
                      tKasus,
                      `${pctKasus.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.', ',')}%`,
                      tInacbg / 1000000000,
                      tIdrg / 1000000000,
                      tSelisih / 1000000000,
                      `${pctSelisih.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.', ',')}%`
                    ]);
                  });
                  
                  const tSesuaiK = activeScorecard.total.sesuai.kasus;
                  const tSesuaiI = activeScorecard.total.sesuai.inacbg;
                  const tSesuaiD = activeScorecard.total.sesuai[simulasiKey];
                  const tLossK = activeScorecard.total.loss.kasus;
                  const tLossI = activeScorecard.total.loss.inacbg;
                  const tLossD = activeScorecard.total.loss[simulasiKey];
                  const tKasus = tSesuaiK + tLossK;
                  const tInacbg = tSesuaiI + tLossI;
                  const tIdrg = tSesuaiD + tLossD;
                  const tSelisih = tIdrg - tInacbg;
                  const pctSelisih = tInacbg > 0 ? (tSelisih / tInacbg * 100) : 0;
                  
                  exportData.push([
                    'Total',
                    tKasus,
                    '100,0%',
                    tInacbg / 1000000000,
                    tIdrg / 1000000000,
                    tSelisih / 1000000000,
                    `${pctSelisih.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.', ',')}%`
                  ]);
                  
                  return exportData;
                })()} 
                filename="Ringkasan_Tingkat_Kompetensi.xlsx"
              />
            </div>
            <table className="kemenkes-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ background: '#008080', color: '#fff', padding: '12px', textAlign: 'center' }}>TINGKAT KOMPETENSI</th>
                  <th style={{ background: '#0284c7', color: '#fff', padding: '12px', textAlign: 'center' }}>KASUS</th>
                  <th style={{ background: '#0284c7', color: '#fff', padding: '12px', textAlign: 'center' }}>% Kasus RS</th>
                  <th style={{ background: '#1abc9c', color: '#fff', padding: '12px', textAlign: 'center' }}>INA-CBG (M)</th>
                  <th style={{ background: '#1abc9c', color: '#fff', padding: '12px', textAlign: 'center' }}>iDRG (M)</th>
                  <th style={{ background: '#e74c3c', color: '#fff', padding: '12px', textAlign: 'center' }}>SELISIH (M)</th>
                  <th style={{ background: '#f39c12', color: '#fff', padding: '12px', textAlign: 'center' }}>% Selisih</th>
                </tr>
              </thead>
              <tbody>
                {(excludeNonKomp ? ['dasar', 'madya', 'utama', 'paripurna'] : ['dasar', 'madya', 'utama', 'paripurna', 'belum ada komp. icd']).map(komp => {
                  const data = activeScorecard.byKompetensi[komp] || { sesuai: { kasus:0, inacbg:0 }, loss: { kasus:0, inacbg:0 } };
                  const simSesuai = (data.sesuai?.[simulasiKey] || 0) || 0;
                  const simLoss = (data.loss?.[simulasiKey] || 0) || 0;
                  const tKasus = (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
                  const tInacbg = (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
                  const tIdrg = simSesuai + simLoss;
                  const tSelisih = tIdrg - tInacbg;
                  const tKasusTotal = activeScorecard.total.sesuai.kasus + activeScorecard.total.loss.kasus;
                  const pctKasus = tKasusTotal > 0 ? (tKasus / tKasusTotal * 100) : 0;
                  const pctSelisih = tInacbg > 0 ? (tSelisih / tInacbg * 100) : 0;
                  
                  return (
                    <tr key={`summary_${komp}`}>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textTransform: 'capitalize' }}>{komp === 'belum ada komp. icd' ? 'Belum ada komp. ICD' : komp}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{tKasus.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{pctKasus.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.', ',')}%</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(tInacbg)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(tIdrg)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: tSelisih < 0 ? 'var(--accent-danger)' : 'inherit' }}>{formatTableMiliar(tSelisih)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: tSelisih < 0 ? 'var(--accent-danger)' : 'inherit' }}>{pctSelisih.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.', ',')}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const tSesuaiK = activeScorecard.total.sesuai.kasus;
                  const tSesuaiI = activeScorecard.total.sesuai.inacbg;
                  const tSesuaiD = activeScorecard.total.sesuai[simulasiKey];
                  const tLossK = activeScorecard.total.loss.kasus;
                  const tLossI = activeScorecard.total.loss.inacbg;
                  const tLossD = activeScorecard.total.loss[simulasiKey];
                  const tKasus = tSesuaiK + tLossK;
                  const tInacbg = tSesuaiI + tLossI;
                  const tIdrg = tSesuaiD + tLossD;
                  const tSelisih = tIdrg - tInacbg;
                  const pctSelisih = tInacbg > 0 ? (tSelisih / tInacbg * 100) : 0;
                  
                  return (
                    <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                      <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', textTransform: 'uppercase' }}>Total</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{tKasus.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>100,0%</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(tInacbg)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: '#0284c7' }}>{formatTableMiliar(tIdrg)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: tSelisih < 0 ? 'var(--accent-danger)' : 'inherit' }}>{formatTableMiliar(tSelisih)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: tSelisih < 0 ? 'var(--accent-danger)' : 'inherit' }}>{pctSelisih.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}).replace('.', ',')}%</td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>

          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table className="kemenkes-table export-pptx-table" data-title="Scorecard Berbasis Kompetensi Layanan" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th rowSpan="2" style={{ background: '#008080', color: '#fff', padding: '12px', textAlign: 'center', minWidth: '180px' }}>Kompetensi<br/>Layanan ICD<br/>Klaim JKN</th>
                  <th colSpan="3" style={{ background: '#0284c7', color: '#fff', padding: '8px', textAlign: 'center' }}>Total Kasus Klaim</th>
                  <th colSpan="3" style={{ background: '#1abc9c', color: '#fff', padding: '8px', textAlign: 'center' }}>Sesuai Kompetensi</th>
                  <th colSpan="3" style={{ background: '#e74c3c', color: '#fff', padding: '8px', textAlign: 'center' }}>Potensi Loss (Rp Miliar)</th>
                  <th colSpan="3" style={{ background: '#f39c12', color: '#fff', padding: '8px', textAlign: 'center' }}>% Potensi Loss</th>
                </tr>
                <tr>
                  <th style={{ background: '#0369a1', color: '#fff', padding: '8px', textAlign: 'center' }}>Kasus</th>
                  <th style={{ background: '#0369a1', color: '#fff', padding: '8px', textAlign: 'center' }}>INA CBG<br/>(Rp) (M)</th>
                  <th style={{ background: '#0369a1', color: '#fff', padding: '8px', textAlign: 'center' }}>iDRG<br/>(Rp Miliar) (M)</th>
                  <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>Kasus</th>
                  <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>INA CBG<br/>(Rp) (M)</th>
                  <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>iDRG<br/>(Rp Miliar) (M)</th>
                  <th style={{ background: '#c0392b', color: '#fff', padding: '8px', textAlign: 'center' }}>Kasus</th>
                  <th style={{ background: '#c0392b', color: '#fff', padding: '8px', textAlign: 'center' }}>INA CBG<br/>(Rp) (M)</th>
                  <th style={{ background: '#c0392b', color: '#fff', padding: '8px', textAlign: 'center' }}>iDRG<br/>(Rp Miliar) (M)</th>
                  <th style={{ background: '#e08e0b', color: '#fff', padding: '8px', textAlign: 'center' }}>Kasus</th>
                  <th style={{ background: '#e08e0b', color: '#fff', padding: '8px', textAlign: 'center' }}>INA CBG<br/>(Rp) (M)</th>
                  <th style={{ background: '#e08e0b', color: '#fff', padding: '8px', textAlign: 'center' }}>iDRG<br/>(Rp Miliar) (M)</th>
                </tr>
              </thead>
              <tbody>
                {(excludeNonKomp ? ['dasar', 'madya', 'utama', 'paripurna'] : ['dasar', 'madya', 'utama', 'paripurna', 'belum ada komp. icd']).map(komp => {
                  const data = activeScorecard.byKompetensi[komp] || { sesuai: { kasus:0, inacbg:0 }, loss: { kasus:0, inacbg:0 } };
                  const simSesuai = (data.sesuai?.[simulasiKey] || 0) || 0;
                  const simLoss = (data.loss?.[simulasiKey] || 0) || 0;
                  const totalKasus = (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
                  const totalInacbg = (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
                  const totalIdrg = simSesuai + simLoss;
                  const pctKasus = totalKasus > 0 ? (((data.loss?.kasus || 0) / totalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                  const pctInacbg = totalInacbg > 0 ? (((data.loss?.inacbg || 0) / totalInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                  const pctIdrg = totalIdrg > 0 ? ((simLoss / totalIdrg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                  return (
                    <tr key={komp}>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textTransform: 'capitalize', fontWeight: 'bold' }}>{komp}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>{totalKasus.toLocaleString()}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>{formatTableMiliar(totalInacbg)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, color: '#0284c7' }}>{formatTableMiliar(totalIdrg)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{(data.sesuai?.kasus || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'var(--text-muted)' }}>{formatTableMiliar((data.sesuai?.inacbg || 0))}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, color: 'var(--accent-success)' }}>{formatTableMiliar(simSesuai)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{(data.loss?.kasus || 0) > 0 ? (data.loss?.kasus || 0).toLocaleString() : '-'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'var(--text-muted)' }}>{(data.loss?.kasus || 0) > 0 ? formatTableMiliar((data.loss?.inacbg || 0)) : '-'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, color: 'var(--accent-danger)' }}>{(data.loss?.kasus || 0) > 0 ? formatTableMiliar(simLoss) : '-'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', color: parseFloat(pctKasus) > 50 ? 'var(--accent-danger)' : '#f39c12' }}>{pctKasus}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', color: parseFloat(pctInacbg) > 50 ? 'var(--accent-danger)' : '#f39c12' }}>{pctInacbg}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', color: parseFloat(pctIdrg) > 50 ? 'var(--accent-danger)' : '#f39c12' }}>{pctIdrg}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 'bold' }}>
                <tr>
                  <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', textTransform: 'uppercase' }}>Total</td>
                  {(() => {
                    const tKasus = activeScorecard.total.sesuai.kasus + activeScorecard.total.loss.kasus;
                    const tInacbg = activeScorecard.total.sesuai.inacbg + activeScorecard.total.loss.inacbg;
                    const tIdrg = activeScorecard.total.sesuai[simulasiKey] + activeScorecard.total.loss[simulasiKey];
                    const pK = tKasus > 0 ? ((activeScorecard.total.loss.kasus / tKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                    const pI = tInacbg > 0 ? ((activeScorecard.total.loss.inacbg / tInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                    const pD = tIdrg > 0 ? ((activeScorecard.total.loss[simulasiKey] / tIdrg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                    return (
                      <>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{tKasus.toLocaleString()}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(tInacbg)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right', color: '#0284c7' }}>{formatTableMiliar(tIdrg)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{activeScorecard.total.sesuai.kasus.toLocaleString()}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(activeScorecard.total.sesuai.inacbg)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right', color: 'var(--accent-success)' }}>{formatTableMiliar(activeScorecard.total.sesuai[simulasiKey])}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{activeScorecard.total.loss.kasus.toLocaleString()}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(activeScorecard.total.loss.inacbg)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right', color: 'var(--accent-danger)' }}>{formatTableMiliar(activeScorecard.total.loss[simulasiKey])}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', color: '#f39c12' }}>{pK}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', color: '#f39c12' }}>{pI}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', color: '#f39c12' }}>{pD}</td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* --- LAPORAN ANALISIS KOMPETENSI PER KELOMPOK LAYANAN RS --- */}
      <div style={{ marginBottom: '48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '2px solid var(--glass-border)', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, padding: '16px', borderBottom: '1px solid var(--glass-border)', fontSize: '1rem', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📋 Laporan Analisis Kompetensi Layanan RS {kelompokSorted.length === 0 ? '(Data Kosong)' : ''}
            </h3>
          <DownloadExcelButton 
              headers={[
                "Kelompok Layanan RS",
                "Total Kasus Klaim", "Total INA CBG (Rp)", "Total iDRG (Rp)",
                "Kasus Sesuai", "INA CBG Sesuai (Rp)", "iDRG Sesuai (Rp)",
                "Kasus Loss", "INA CBG Loss (Rp)", "iDRG Loss (Rp)",
                "% Kasus Loss", "% INA CBG Loss", "% iDRG Loss"
              ]}
              data={(() => {
                let rows = kelompokSorted.map(kelompok => {
                  const d = kelompokScorecard[kelompok];
                  const simS = d.sesuai[simulasiKey] || 0;
                  const simL = d.loss[simulasiKey] || 0;
                  const tK = d.sesuai.kasus + d.loss.kasus;
                  const tI = d.sesuai.inacbg + d.loss.inacbg;
                  const tD = simS + simL;
                  return [
                    kelompok.toUpperCase(),
                    tK, tI, tD,
                    d.sesuai.kasus, d.sesuai.inacbg, simS,
                    d.loss.kasus, d.loss.inacbg, simL,
                    (tK > 0 ? (d.loss.kasus / tK * 100) : 0).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%',
                    (tI > 0 ? (d.loss.inacbg / tI * 100) : 0).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%',
                    (tD > 0 ? (simL / tD * 100) : 0).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%'
                  ];
                });
                
                const tSesuaiK = activeScorecard.total.sesuai.kasus;
                const tSesuaiI = activeScorecard.total.sesuai.inacbg;
                const tSesuaiD = activeScorecard.total.sesuai[simulasiKey];
                const tLossK = activeScorecard.total.loss.kasus;
                const tLossI = activeScorecard.total.loss.inacbg;
                const tLossD = activeScorecard.total.loss[simulasiKey];
                const tKasus = tSesuaiK + tLossK;
                const tInacbg = tSesuaiI + tLossI;
                const tIdrg = tSesuaiD + tLossD;
                
                rows.push([
                  'TOTAL',
                  tKasus, tInacbg, tIdrg,
                  tSesuaiK, tSesuaiI, tSesuaiD,
                  tLossK, tLossI, tLossD,
                  tKasus > 0 ? ((tLossK / tKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%',
                  tInacbg > 0 ? ((tLossI / tInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%',
                  tIdrg > 0 ? ((tLossD / tIdrg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%'
                ]);
                return rows;
              })()}
              filename={`Laporan_Kelompok_Layanan_${simulasiKey}.xlsx`}
              groupHeaders={[
                { label: 'Kelompok Layanan RS', colSpan: 1, rowSpan: 2, fill: '#008080' },
                { label: 'Total Kasus Klaim', colSpan: 3, fill: '#0284c7' },
                { label: 'Sesuai Kompetensi', colSpan: 3, fill: '#1abc9c' },
                { label: 'Potensi Loss', colSpan: 3, fill: '#e74c3c' },
                { label: '% Potensi Loss', colSpan: 3, fill: '#f39c12' }
              ]}
            />
          </div>

          <div className="glass-panel" style={{ overflowX: 'auto' }}>
            <table className="kemenkes-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th rowSpan="2" style={{ background: '#008080', color: '#fff', padding: '12px', textAlign: 'center', minWidth: '200px' }}>Kelompok<br/>Layanan RS</th>
                  <th colSpan="3" style={{ background: '#0284c7', color: '#fff', padding: '8px', textAlign: 'center' }}>Total Kasus Klaim</th>
                  <th colSpan="3" style={{ background: '#1abc9c', color: '#fff', padding: '8px', textAlign: 'center' }}>Sesuai Kompetensi</th>
                  <th colSpan="3" style={{ background: '#e74c3c', color: '#fff', padding: '8px', textAlign: 'center' }}>Potensi Loss (Rp Miliar)</th>
                  <th colSpan="3" style={{ background: '#f39c12', color: '#fff', padding: '8px', textAlign: 'center' }}>% Potensi Loss</th>
                </tr>
                <tr>
                  <th style={{ background: '#0369a1', color: '#fff', padding: '8px', textAlign: 'center' }}>Kasus</th>
                  <th style={{ background: '#0369a1', color: '#fff', padding: '8px', textAlign: 'center' }}>INA CBG<br/>(Rp) (M)</th>
                  <th style={{ background: '#0369a1', color: '#fff', padding: '8px', textAlign: 'center' }}>iDRG<br/>(Rp Miliar) (M)</th>
                  <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>Kasus</th>
                  <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>INA CBG<br/>(Rp) (M)</th>
                  <th style={{ background: '#16a085', color: '#fff', padding: '8px', textAlign: 'center' }}>iDRG<br/>(Rp Miliar) (M)</th>
                  <th style={{ background: '#c0392b', color: '#fff', padding: '8px', textAlign: 'center' }}>Kasus</th>
                  <th style={{ background: '#c0392b', color: '#fff', padding: '8px', textAlign: 'center' }}>INA CBG<br/>(Rp) (M)</th>
                  <th style={{ background: '#c0392b', color: '#fff', padding: '8px', textAlign: 'center' }}>iDRG<br/>(Rp Miliar) (M)</th>
                  <th style={{ background: '#e08e0b', color: '#fff', padding: '8px', textAlign: 'center' }}>Kasus</th>
                  <th style={{ background: '#e08e0b', color: '#fff', padding: '8px', textAlign: 'center' }}>INA CBG<br/>(Rp) (M)</th>
                  <th style={{ background: '#e08e0b', color: '#fff', padding: '8px', textAlign: 'center' }}>iDRG<br/>(Rp Miliar) (M)</th>
                </tr>
              </thead>
              <tbody>
                {kelompokSorted.map(kelompok => {
                  const data = kelompokScorecard[kelompok];
                  const simSesuai = (data.sesuai?.[simulasiKey] || 0) || 0;
                  const simLoss = (data.loss?.[simulasiKey] || 0) || 0;
                  const totalKasus = (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
                  const totalInacbg = (data.sesuai?.inacbg || 0) + (data.loss?.inacbg || 0);
                  const totalIdrg = simSesuai + simLoss;
                  const pctKasus = totalKasus > 0 ? (((data.loss?.kasus || 0) / totalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                  const pctInacbg = totalInacbg > 0 ? (((data.loss?.inacbg || 0) / totalInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                  const pctIdrg = totalIdrg > 0 ? ((simLoss / totalIdrg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%';
                  return (
                    <tr key={kelompok}>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textTransform: 'capitalize', fontWeight: 'bold' }}>{kelompok}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600 }}>{totalKasus.toLocaleString()}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>{formatTableMiliar(totalInacbg)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, color: '#0284c7' }}>{formatTableMiliar(totalIdrg)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{(data.sesuai?.kasus || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'var(--text-muted)' }}>{formatTableMiliar((data.sesuai?.inacbg || 0))}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, color: 'var(--accent-success)' }}>{formatTableMiliar(simSesuai)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>{(data.loss?.kasus || 0) > 0 ? (data.loss?.kasus || 0).toLocaleString() : '-'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: 'var(--text-muted)' }}>{(data.loss?.kasus || 0) > 0 ? formatTableMiliar((data.loss?.inacbg || 0)) : '-'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 600, color: 'var(--accent-danger)' }}>{(data.loss?.kasus || 0) > 0 ? formatTableMiliar(simLoss) : '-'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', color: parseFloat(pctKasus) > 50 ? 'var(--accent-danger)' : '#f39c12' }}>{pctKasus}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', color: parseFloat(pctInacbg) > 50 ? 'var(--accent-danger)' : '#f39c12' }}>{pctInacbg}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold', color: parseFloat(pctIdrg) > 50 ? 'var(--accent-danger)' : '#f39c12' }}>{pctIdrg}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 'bold' }}>
                <tr>
                  <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', textTransform: 'uppercase' }}>Total</td>
                  {(() => {
                    let tSesuaiKasus = 0, tSesuaiInacbg = 0, tSesuaiIdrg = 0;
                    let tLossKasus = 0, tLossInacbg = 0, tLossIdrg = 0;
                    kelompokSorted.forEach(k => {
                      const d = kelompokScorecard[k];
                      tSesuaiKasus += d.sesuai.kasus;
                      tSesuaiInacbg += d.sesuai.inacbg;
                      tSesuaiIdrg += d.sesuai[simulasiKey] || 0;
                      tLossKasus += d.loss.kasus;
                      tLossInacbg += d.loss.inacbg;
                      tLossIdrg += d.loss[simulasiKey] || 0;
                    });
                    const tK = tSesuaiKasus + tLossKasus;
                    const tI = tSesuaiInacbg + tLossInacbg;
                    const tD = tSesuaiIdrg + tLossIdrg;
                    return (
                      <>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{tK.toLocaleString()}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(tI)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right', color: '#0284c7' }}>{formatTableMiliar(tD)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{tSesuaiKasus.toLocaleString()}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(tSesuaiInacbg)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right', color: 'var(--accent-success)' }}>{formatTableMiliar(tSesuaiIdrg)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{tLossKasus.toLocaleString()}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right' }}>{formatTableMiliar(tLossInacbg)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'right', color: 'var(--accent-danger)' }}>{formatTableMiliar(tLossIdrg)}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', color: '#f39c12' }}>{tK > 0 ? ((tLossKasus / tK) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%'}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', color: '#f39c12' }}>{tI > 0 ? ((tLossInacbg / tI) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%'}</td>
                        <td style={{ padding: '12px 8px', border: '1px solid #ddd', textAlign: 'center', color: '#f39c12' }}>{tD > 0 ? ((tLossIdrg / tD) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%'}</td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      <div className="grid-2" style={{ marginBottom: '32px' }}>
        {chartData.map(lvl => (
          <div key={lvl.name} className="glass-card" style={{ padding: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck className="text-accent" color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Kompetensi {lvl.name}</h3>
              </div>
              <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                {lvl.kasus.toLocaleString()} Kasus
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '4px' }}>Tarif INA-CBG (Rp Miliar)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {formatCompactCurrency(lvl.inacbg)}
                </div>
              </div>
              <div>
                <div className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '4px' }}>Tarif iDRG (Rp Miliar)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {formatCompactCurrency(lvl.simulasi)}
                </div>
              </div>
            </div>
            
            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span className="text-secondary">Delta (Shifting)</span>
              <span style={{ 
                fontWeight: 600, 
                color: lvl.delta > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' 
              }}>
                {lvl.delta > 0 ? '+' : ''}{formatCompactCurrency(lvl.delta)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: '400px', marginBottom: '32px' }}>
        <SpendingShiftChart 
          title={`Perbandingan Tarif per Tingkat Kompetensi (iDRG)${activeGroup ? ` - ${activeGroup.label}` : ''}`} 
          data={chartData} 
        />
      </div>

      <div style={{ height: '500px', width: '100%', marginBottom: '32px' }}>
        <GenericScatterPlot 
          title={`Sebaran Shifting per Tingkat Kompetensi${activeGroup ? ` (${activeGroup.label})` : ''}`}
          data={chartData.map(d => ({
            label: d.name,
            inacbg: d.inacbg,
            simulasiVal: d.simulasi,
            delta: d.delta,
            kasus: d.kasus
          }))}
        />
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div className="flex-between" style={{ marginBottom: '24px' }}>
          <h3 className="text-secondary" style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            Sebaran Kasus 24 Layanan Berdasarkan Kompetensi RS {activeGroup ? ` (${activeGroup.label})` : ''}
          </h3>
          <select className="select-input" value={chartLimit} onChange={(e) => setChartLimit(e.target.value)}>
            <option value="all">Semua Layanan (24)</option>
            <option value="10">Top 10 Layanan Teratas</option>
          </select>
        </div>
        <div style={{ height: chartLimit === '10' ? '500px' : '800px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart layout="vertical" data={chartLimit === '10' ? serviceKompData.slice(0, 10) : serviceKompData} margin={{ top: 20, right: 30, left: 160, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" />
              <YAxis dataKey="layanan" type="category" width={160} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <RechartsTooltip 
                formatter={(val) => val.toLocaleString() + ' Kasus'}
                contentStyle={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
              />
              <Legend />
              <Bar dataKey="dasar" stackId="a" fill="#1abc9c" name="Kompetensi Dasar" />
              <Bar dataKey="madya" stackId="a" fill="#008080" name="Kompetensi Madya" />
              <Bar dataKey="utama" stackId="a" fill="#3498db" name="Kompetensi Utama" />
              <Bar dataKey="paripurna" stackId="a" fill="#2980b9" name="Kompetensi Paripurna" />
              {!excludeNonKomp && <Bar dataKey="lainnya" stackId="a" fill="#95a5a6" name="Lainnya / Tidak Diketahui" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <TabelLaporanKompetensi servicesData={activeServicesData} simulasiKey={simulasiKey} />
    </div>
  );
};

export default LevelKompetensi;
