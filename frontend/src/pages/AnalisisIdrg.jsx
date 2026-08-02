import React, { useState, useEffect, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, Stethoscope, Search, Download } from 'lucide-react';
import Select from 'react-select';
import GenericScatterPlot from '../components/GenericScatterPlot';
import { formatCompactCurrency, formatCurrency, KELOMPOK_LAYANAN , formatTableMiliar} from '../utils/formatters';
import { matchesGroup, RS_GROUPS } from '../utils/rsGroups';
import { useSortableTable } from '../hooks/useSortableTable';
import DownloadExcelButton from '../components/DownloadExcelButton';
import DownloadPptxButton from '../components/DownloadPptxButton';
import { filterHospital } from '../utils/filterUtils';
import { loadDatasetFile } from '../utils/dataLoader';


const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const AnalisisIdrg = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter = '', isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg } ) => {
  const [data, setData] = useState(null);
  const [hospitalsData, setHospitalsData] = useState(null);
  const [detailedHospitals, setDetailedHospitals] = useState({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'ri', 'rj'
  const [search, setSearch] = useState('');
  const [selectedKelompok, setSelectedKelompok] = useState('');

  const kelompokOptions = useMemo(() => {
    const opts = KELOMPOK_LAYANAN.map(k => ({ value: k, label: k }));
    if (data) {
      const existing = new Set(KELOMPOK_LAYANAN.map(k => k.toLowerCase()));
      const extras = [...new Set(Object.values(data).map(d => d.kelompok))].filter(k => k && !existing.has(k.toLowerCase())).sort();
      extras.forEach(k => opts.push({ value: k, label: k }));
    }
    return [{ value: '', label: 'Semua Kompetensi (24 Layanan)' }, ...opts];
  }, [data]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'drg_analysis', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
    ]).then(([drg, hosp]) => {
        setData(drg);
        setHospitalsData(hosp);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [dataset]);

  // Effect for fetching detailed hospital data when rsFilter matches
  useEffect(() => {
    const hasRsFilter = !!(rsFilter && rsFilter.trim());
    if (hasRsFilter && hospitalsData) {
      const filterLower = rsFilter.toLowerCase();
      // Find all matching hospital codes based on current filters
      const matchingCodes = Object.keys(hospitalsData).filter(kode => {
        const rs = hospitalsData[kode];
        return filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp);
      });

      // Filter out those we already fetched
      const missingCodes = matchingCodes.filter(kode => !detailedHospitals[kode]);
      
      if (missingCodes.length > 0) {
        setDetailsLoading(true);
        // Fetch them all at once
        const realDataset = dataset.includes('_') ? dataset.split('_')[0] : dataset;
        Promise.all(
          missingCodes.map(kode => 
            fetch(`/data/hospitals/${realDataset}_${kode}.json`)
              .then(res => res.json())
              .catch(() => null)
          )
        ).then(results => {
          setDetailedHospitals(prev => {
            const next = { ...prev };
            results.forEach((res, i) => {
              if (res) next[missingCodes[i]] = res;
            });
            return next;
          });
          setDetailsLoading(false);
        });
      }
    }
  }, [rsFilter, groupFilter, wilayahFilter, hospitalsData, dataset]);

  const simulasiKey = `tarif_${simulasi}`;
  const activeGroup = null /* removed single active group logic */ || null;

  const { riDrgs, rjDrgs, combinedDrgs } = useMemo(() => {
    if (!data) return { riDrgs: [], rjDrgs: [], combinedDrgs: [] };

    const riMap = {};
    const rjMap = {};
    const combinedMap = {};

    // Helper to add to maps from a source object with ri/rj
    const addFromSource = (drg, kelompok, deskripsi, source) => {
      const addObj = (obj, ptdKey, src) => {
        if (!src[ptdKey] || src[ptdKey].kasus <= 0) return;
        obj.kasus += src[ptdKey].kasus;
        obj.inacbg += src[ptdKey].inacbg;
        obj.sim += src[ptdKey][simulasiKey] || 0;
      };
      if (!riMap[drg]) riMap[drg] = { drg, kelompok, deskripsi, kasus: 0, inacbg: 0, sim: 0 };
      if (!rjMap[drg]) rjMap[drg] = { drg, kelompok, deskripsi, kasus: 0, inacbg: 0, sim: 0 };
      if (!combinedMap[drg]) combinedMap[drg] = { drg, kelompok, deskripsi, kasus: 0, inacbg: 0, sim: 0 };
      addObj(riMap[drg], 'ri', source);
      addObj(combinedMap[drg], 'ri', source);
      addObj(rjMap[drg], 'rj', source);
      addObj(combinedMap[drg], 'rj', source);
    };

    // Determine if we need per-RS aggregation (rsFilter) or pre-aggregated (byGroup/byProp)
    const hasRsFilter = !!(rsFilter && rsFilter.trim());
    const simIdx = parseInt(simulasi) - 1; // 0-based index for tarif array

    if ((hasRsFilter || excludeNonKomp) && hospitalsData) {
      // Aggregate from individual hospital byDrg data
      const filterLower = rsFilter.toLowerCase();
      const drgMeta = {}; // drg -> { kelompok, kelompoks, deskripsi }
      // Build meta from drg_analysis
      Object.values(data).forEach(d => { drgMeta[d.drg] = { kelompok: d.kelompok, kelompoks: Object.keys(d.byKelompok || {}), deskripsi: d.deskripsi }; });

      Object.entries(hospitalsData).forEach(([kode, rs]) => {
        // Apply all filters
        if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;

        // Check if detailed data is available (from lazy load)
        const detailedRs = detailedHospitals[kode];
        if (detailedRs && detailedRs.byDrg) {
          Object.entries(detailedRs.byDrg).forEach(([drg, arr]) => {
            // arr: [kasus_ri, inacbg_ri, t1_ri..t11_ri, kasus_rj, inacbg_rj, t1_rj..t11_rj]
            const meta = drgMeta[drg] || { kelompok: 'Unknown', kelompoks: [], deskripsi: '-' };
            if (selectedKelompok && meta.kelompoks && !meta.kelompoks.some(k => k.toLowerCase() === selectedKelompok.toLowerCase())) {
              return;
            }
            const simKeyIdx = parseInt(simulasi); // tarif_1 = index 2, tarif_2 = index 3, etc.

            const riKasus = arr[0] || 0;
            const riInacbg = arr[1] || 0;
            const riSim = arr[1 + simKeyIdx] || 0; // arr[2] = tarif_1_ri, arr[3] = tarif_2_ri, ...

            const rjKasus = arr[13] || 0;
            const rjInacbg = arr[14] || 0;
            const rjSim = arr[14 + simKeyIdx] || 0; // arr[15] = tarif_1_rj, ...

            if (!riMap[drg]) riMap[drg] = { drg, kelompok: meta.kelompok, kelompoks: meta.kelompoks, deskripsi: meta.deskripsi, kasus: 0, inacbg: 0, sim: 0 };
            if (!rjMap[drg]) rjMap[drg] = { drg, kelompok: meta.kelompok, kelompoks: meta.kelompoks, deskripsi: meta.deskripsi, kasus: 0, inacbg: 0, sim: 0 };
            if (!combinedMap[drg]) combinedMap[drg] = { drg, kelompok: meta.kelompok, kelompoks: meta.kelompoks, deskripsi: meta.deskripsi, kasus: 0, inacbg: 0, sim: 0 };

            if (riKasus > 0) {
              riMap[drg].kasus += riKasus;
              riMap[drg].inacbg += riInacbg;
              riMap[drg].sim += riSim;
              combinedMap[drg].kasus += riKasus;
              combinedMap[drg].inacbg += riInacbg;
              combinedMap[drg].sim += riSim;
            }
            if (rjKasus > 0) {
              rjMap[drg].kasus += rjKasus;
              rjMap[drg].inacbg += rjInacbg;
              rjMap[drg].sim += rjSim;
              combinedMap[drg].kasus += rjKasus;
              combinedMap[drg].inacbg += rjInacbg;
              combinedMap[drg].sim += rjSim;
            }
          });
        } else if (detailedRs && detailedRs.byKelompok) {
          // Fallback: byDrg not available yet, use byKelompok as best effort (approximate)
          Object.entries(detailedRs.byKelompok).forEach(([kelompok, kObj]) => {
            const pseudo = `KELOMPOK-${kelompok}`; // dummy DRG code for grouping
            const meta = { kelompok: kelompok, kelompoks: [kelompok], deskripsi: `Semua Kasus ${kelompok}` };
            const simKeyIdx = parseInt(simulasi);

            if (!riMap[pseudo]) riMap[pseudo] = { drg: pseudo, kelompok: meta.kelompok, kelompoks: meta.kelompoks, deskripsi: meta.deskripsi, kasus: 0, inacbg: 0, sim: 0 };
            if (!rjMap[pseudo]) rjMap[pseudo] = { drg: pseudo, kelompok: meta.kelompok, kelompoks: meta.kelompoks, deskripsi: meta.deskripsi, kasus: 0, inacbg: 0, sim: 0 };
            if (!combinedMap[pseudo]) combinedMap[pseudo] = { drg: pseudo, kelompok: meta.kelompok, kelompoks: meta.kelompoks, deskripsi: meta.deskripsi, kasus: 0, inacbg: 0, sim: 0 };

            if (kObj.ri && kObj.ri.kasus > 0) {
              riMap[pseudo].kasus += kObj.ri.kasus;
              riMap[pseudo].inacbg += kObj.ri.inacbg;
              riMap[pseudo].sim += kObj.ri[`tarif_${simKeyIdx}`] || 0;
              combinedMap[pseudo].kasus += kObj.ri.kasus;
              combinedMap[pseudo].inacbg += kObj.ri.inacbg;
              combinedMap[pseudo].sim += kObj.ri[`tarif_${simKeyIdx}`] || 0;
            }
            if (kObj.rj && kObj.rj.kasus > 0) {
              rjMap[pseudo].kasus += kObj.rj.kasus;
              rjMap[pseudo].inacbg += kObj.rj.inacbg;
              rjMap[pseudo].sim += kObj.rj[`tarif_${simKeyIdx}`] || 0;
              combinedMap[pseudo].kasus += kObj.rj.kasus;
              combinedMap[pseudo].inacbg += kObj.rj.inacbg;
              combinedMap[pseudo].sim += kObj.rj[`tarif_${simKeyIdx}`] || 0;
            }
          });
        }
      });
    } else {
      // No rsFilter — use pre-aggregated drg_analysis data (byGroup/byProp)
      Object.values(data).forEach((drgNode) => {
        const drgKelompoks = drgNode.byKelompok ? Object.keys(drgNode.byKelompok) : (drgNode.kelompok && drgNode.kelompok !== 'Unknown' ? [drgNode.kelompok] : []);
        if (selectedKelompok && drgKelompoks.length > 0 && !drgKelompoks.some(k => k.toLowerCase() === selectedKelompok.toLowerCase())) {
           return;
        }

        let sources = [];

        // Determine which aggregation node(s) to read from
        if (wilayahFilter && wilayahFilter.length > 0) {
          if (groupFilter && groupFilter.length > 0) {
            wilayahFilter.forEach(w => { if (drgNode.byGroupProp[`${groupFilter}_${w}`]) sources.push(drgNode.byGroupProp[`${groupFilter}_${w}`]); });
          } else {
            wilayahFilter.forEach(w => { if (drgNode.byProp[w]) sources.push(drgNode.byProp[w]); });
          }
        } else if (groupFilter && groupFilter.length > 0) {
          if (drgNode.byGroup[groupFilter]) sources.push(drgNode.byGroup[groupFilter]);
        } else {
          if (drgNode.all) sources.push(drgNode.all);
        }

        if (sources.length === 0) return;

        const drg = drgNode.drg;
        const addObjSrc = (obj, ptdKey, src) => {
          if (!src[ptdKey] || src[ptdKey].kasus <= 0) return;
          obj.kasus += src[ptdKey].kasus;
          obj.inacbg += src[ptdKey].inacbg;
          obj.tarifRs += src[ptdKey].tarifRs || 0;
          obj.sim += src[ptdKey][simulasiKey] || 0;
        };

        const allKelompoks = Object.keys(drgNode.byKelompok || {});
        const riObj = { drg, kelompok: drgNode.kelompok, kelompoks: allKelompoks, deskripsi: drgNode.deskripsi, kasus: 0, inacbg: 0, tarifRs: 0, sim: 0, ptd: 'ri' };
        const rjObj = { drg, kelompok: drgNode.kelompok, kelompoks: allKelompoks, deskripsi: drgNode.deskripsi, kasus: 0, inacbg: 0, tarifRs: 0, sim: 0, ptd: 'rj' };
        const combinedObj = { drg, kelompok: drgNode.kelompok, kelompoks: allKelompoks, deskripsi: drgNode.deskripsi, kasus: 0, inacbg: 0, tarifRs: 0, sim: 0, ptd: 'combined' };

        sources.forEach(source => {
          addObjSrc(riObj, 'ri', source);
          addObjSrc(combinedObj, 'ri', source);
          addObjSrc(rjObj, 'rj', source);
          addObjSrc(combinedObj, 'rj', source);
        });

        if (riObj.kasus > 0) riMap[drg] = riObj;
        if (rjObj.kasus > 0) rjMap[drg] = rjObj;
        if (combinedObj.kasus > 0) combinedMap[drg] = combinedObj;
      });
    }

    const formatArr = (map) => Object.values(map)
      .filter(d => d.kasus > 0)
      .filter(d => {
        if (!selectedKelompok) return true;
        if (d.kelompoks && d.kelompoks.length > 0) {
           return d.kelompoks.some(k => k.toLowerCase() === selectedKelompok.toLowerCase());
        }
        return d.kelompok && d.kelompok.toLowerCase() === selectedKelompok.toLowerCase();
      })
      .map(d => {
        let topInacbgStr = '';
        if (data && data[d.drg] && data[d.drg].inacbgStats) {
           const stats = data[d.drg].inacbgStats;
           let sourceStats = null;
           if (d.ptd === 'ri') sourceStats = stats.ri;
           else if (d.ptd === 'rj') sourceStats = stats.rj;
           else if (d.ptd === 'combined') {
              sourceStats = {};
              if (stats.ri) Object.entries(stats.ri).forEach(([k, v]) => { sourceStats[k] = { ...v }; });
              if (stats.rj) Object.entries(stats.rj).forEach(([k, v]) => { 
                 if (!sourceStats[k]) sourceStats[k] = { ...v };
                 else { sourceStats[k].kasus += v.kasus; sourceStats[k].inacbg += v.inacbg; }
              });
           }
           if (sourceStats && Object.keys(sourceStats).length > 0) {
             const top = Object.entries(sourceStats).reduce((prev, [code, val]) => {
                return (val.kasus > prev.val.kasus) ? {code, val} : prev;
             }, { code: '', val: { kasus: -1 } });
             if (top.code) {
               const avgTarif = Math.round(top.val.inacbg / top.val.kasus);
               topInacbgStr = `<br><br><b>Kasus INA-CBG Terbanyak:</b><br>${top.code} - ${top.val.desc}<br>Total Kasus: ${top.val.kasus.toLocaleString()}<br>Rata-rata Tarif: ${formatCurrency(avgTarif)}`;
             }
           }
        }

        return {
          ...d,
          meanInacbg: d.kasus > 0 ? Math.round(d.inacbg / d.kasus) : 0,
          meanSim: d.kasus > 0 ? Math.round(d.sim / d.kasus) : 0,
          meanTarifRs: (d.kasus > 0 && d.tarifRs > 0) ? Math.round(d.tarifRs / d.kasus) : 0,
          delta: d.sim - d.inacbg,
          deltaPercent: d.inacbg > 0 ? ((d.sim - d.inacbg) / d.inacbg) * 100 : 0,
          topInacbgStr
        };
      })
      .sort((a, b) => b.inacbg - a.inacbg);

    return {
      riDrgs: formatArr(riMap),
      rjDrgs: formatArr(rjMap),
      combinedDrgs: formatArr(combinedMap)
    };
  }, [data, hospitalsData, groupFilter, wilayahFilter, rsFilter, simulasiKey, simulasi, selectedKelompok]);



  // Get Top Insights for RI
  const riSurplus = [...riDrgs].sort((a, b) => b.delta - a.delta)[0];
  const riDefisit = [...riDrgs].sort((a, b) => a.delta - b.delta)[0];

  // Get Top Insights for RJ
  const rjSurplus = [...rjDrgs].sort((a, b) => b.delta - a.delta)[0];
  const rjDefisit = [...rjDrgs].sort((a, b) => a.delta - b.delta)[0];

  const currentTableData = viewMode === 'ri' ? riDrgs : (viewMode === 'rj' ? rjDrgs : combinedDrgs);
  const fullyFilteredData = currentTableData
    .filter(d => {
      const matchSearch = d.drg.toLowerCase().includes(search.toLowerCase()) || (d.kelompok && d.kelompok.toLowerCase().includes(search.toLowerCase()));
      let matchKelompok = true;
      if (selectedKelompok && selectedKelompok !== 'semua') {
        const sKel = selectedKelompok.toLowerCase();
        matchKelompok = false;
        if (d.kelompoks && d.kelompoks.some(k => k.toLowerCase().includes(sKel))) matchKelompok = true;
        else if (d.kelompok && d.kelompok.toLowerCase().includes(sKel)) matchKelompok = true;
      }
      return matchSearch && matchKelompok;
    });

  const totalInacbg = fullyFilteredData.reduce((sum, d) => sum + d.inacbg, 0);
  const totalIdrg = fullyFilteredData.reduce((sum, d) => sum + d.sim, 0);
  const totalKasus = fullyFilteredData.reduce((sum, d) => sum + d.kasus, 0);
  const selisihTotal = totalIdrg - totalInacbg;

  const { items: sortedTableData, requestSort, getSortIndicator } = useSortableTable(fullyFilteredData, { key: 'kasus', direction: 'descending' });
  const displayTableData = sortedTableData.slice(0, 100); // Limit to top 100 to prevent lagging

  if (loading || !data) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Data iDRG...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div style={{ marginBottom: '32px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '0px', right: '0px' }}>
          <DownloadPptxButton title="Analisis Shifting iDRG" />
        </div>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Analisis Shifting iDRG</h1>
          <p className="text-secondary">
            Perbandingan Kasus dan Biaya Penyakit (Rawat Inap vs Rawat Jalan)
            {activeGroup ? ` | Grup: ${activeGroup.label}` : ''}
            {wilayahFilter ? ` | Wilayah: ${wilayahFilter}` : ''}
          </p>
          {(activeGroup || wilayahFilter) && (
            <div style={{
              marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 14px', borderRadius: '20px',
              background: activeGroup ? `${activeGroup.color}22` : 'rgba(56, 189, 248, 0.1)', 
              border: activeGroup ? `1px solid ${activeGroup.color}88` : '1px solid rgba(56, 189, 248, 0.4)',
              fontSize: '0.82rem', color: activeGroup ? activeGroup.color : '#0284c7', fontWeight: 600
            }}>
              <span>🎯</span>
              <span>Menampilkan data khusus {activeGroup ? `grup ${activeGroup.label}` : ''} {activeGroup && wilayahFilter ? 'di' : ''} {wilayahFilter ? `wilayah ${wilayahFilter}` : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #94a3b8' }}>
          <h5 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Kasus</h5>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>{totalKasus.toLocaleString('en-US')}</h2>
        </div>
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <h5 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Tarif INA-CBG (Rp Miliar)</h5>
          <h2 style={{ fontSize: '1.8rem', color: '#b45309' }}>{formatCompactCurrency(totalInacbg)}</h2>
        </div>
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid #0ea5e9' }}>
          <h5 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Total Tarif iDRG (Rp Miliar)</h5>
          <h2 style={{ fontSize: '1.8rem', color: '#0369a1' }}>{formatCompactCurrency(totalIdrg)}</h2>
        </div>
        <div className="glass-card" style={{ padding: '20px', borderLeft: selisihTotal > 0 ? '4px solid #10b981' : '4px solid #ef4444' }}>
          <h5 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Selisih Pendapatan</h5>
          <h2 style={{ fontSize: '1.8rem', color: selisihTotal > 0 ? '#047857' : '#b91c1c' }}>{selisihTotal > 0 ? '+' : ''}{formatCompactCurrency(selisihTotal)}</h2>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '24px', borderTop: '4px solid #3b82f6' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#3b82f6' }}>Insight Rawat Inap (Top)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Penyumbang Surplus Terbesar</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '4px' }}>{riSurplus?.drg || '-'}</div>
              <div className="text-success" style={{ fontSize: '0.9rem' }}>{riSurplus ? '+' + formatCompactCurrency(riSurplus.delta) : '0'}</div>
            </div>
            <div>
              <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Penyumbang Defisit Terbesar</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '4px' }}>{riDefisit?.drg || '-'}</div>
              <div className="text-danger" style={{ fontSize: '0.9rem' }}>{riDefisit ? formatCompactCurrency(riDefisit.delta) : '0'}</div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '24px', borderTop: '4px solid #10b981' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', color: '#10b981' }}>Insight Rawat Jalan (Top)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Penyumbang Surplus Terbesar</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '4px' }}>{rjSurplus?.drg || '-'}</div>
              <div className="text-success" style={{ fontSize: '0.9rem' }}>{rjSurplus ? '+' + formatCompactCurrency(rjSurplus.delta) : '0'}</div>
            </div>
            <div>
              <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Penyumbang Defisit Terbesar</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '4px' }}>{rjDefisit?.drg || '-'}</div>
              <div className="text-danger" style={{ fontSize: '0.9rem' }}>{rjDefisit ? formatCompactCurrency(rjDefisit.delta) : '0'}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
        <div className="export-pptx-chart" data-title="Sebaran Shifting DRG Rawat Inap" style={{ height: '500px', width: '100%' }}>
          <GenericScatterPlot 
            title={`Sebaran Shifting DRG Rawat Inap (RI)`}
            data={riDrgs.map(d => ({
              label: `${d.drg} - ${d.deskripsi}`, extra: `Kelompok: ${d.kelompok}`, inacbg: d.inacbg, simulasiVal: d.sim, delta: d.delta, kasus: d.kasus, topInacbgStr: d.topInacbgStr
            }))}
          />
        </div>
        <div className="export-pptx-chart" data-title="Sebaran Shifting DRG Rawat Jalan" style={{ height: '500px', width: '100%' }}>
          <GenericScatterPlot 
            title={`Sebaran Shifting DRG Rawat Jalan (RJ)`}
            data={rjDrgs.map(d => ({
              label: `${d.drg} - ${d.deskripsi}`, extra: `Kelompok: ${d.kelompok}`, inacbg: d.inacbg, simulasiVal: d.sim, delta: d.delta, kasus: d.kasus, topInacbgStr: d.topInacbgStr
            }))}
          />
        </div>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafa' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Stethoscope size={18} className="text-accent" /> Tabel Detail Kasus iDRG
          </h3>
          <div style={{ display: 'flex', gap: '16px' }}>
            <select className="select-input" value={viewMode} onChange={e => setViewMode(e.target.value)}>
              <option value="all">Semua (RI + RJ)</option>
              <option value="ri">Hanya Rawat Inap</option>
              <option value="rj">Hanya Rawat Jalan</option>
            </select>
            <div style={{ width: '250px' }}>
              <Select 
                options={kelompokOptions}
                value={kelompokOptions.find(o => o.value === selectedKelompok) || kelompokOptions[0]}
                onChange={opt => setSelectedKelompok(opt.value)}
                isSearchable
                styles={{ 
                  control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px', borderColor: 'var(--glass-border)' }),
                  option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'var(--bg-app)' : 'white', color: 'var(--text-primary)' }),
                  menu: (base) => ({ ...base, zIndex: 9999 })
                }}
              />
            </div>
            <input type="text" placeholder="Cari Kode DRG/Kelompok..." className="select-input" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '220px' }} />
            <DownloadExcelButton 
                headers={["Kode DRG", "Deskripsi iDRG", "Kelompok Layanan", "Kasus", "Tarif INA-CBG", "Mean INA-CBG", "Tarif iDRG", "Mean iDRG", "Total Tarif RS", "Mean Tarif RS", "Delta (Rp)", "Delta (%)"]} 
                data={sortedTableData.map(d => [d.drg, d.deskripsi, d.kelompok, d.kasus, d.inacbg, d.meanInacbg, d.sim, d.meanSim, d.tarifRs, d.meanTarifRs, d.delta, d.deltaPercent])}
                filename={`Distribusi_Tarif_${viewMode.toUpperCase()}.xlsx`} 
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
          <table className="kemenkes-table export-pptx-table" data-title="Tabel Analisis iDRG" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <th onClick={() => requestSort('drg')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Kode DRG {getSortIndicator('drg')}</th>
                <th onClick={() =>requestSort('deskripsi')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Deskripsi iDRG {getSortIndicator('deskripsi')}</th>
                <th onClick={() => requestSort('kelompok')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Kelompok Layanan {getSortIndicator('kelompok')}</th>
                <th onClick={() => requestSort('kasus')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Kasus {getSortIndicator('kasus')}</th>
                <th onClick={() =>requestSort('inacbg')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Tarif INA-CBG (Rp Miliar) {getSortIndicator('inacbg')}</th>
                <th onClick={() =>requestSort('meanInacbg')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Mean INA-CBG (Rp Miliar) {getSortIndicator('meanInacbg')}</th>
                <th onClick={() =>requestSort('sim')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Tarif iDRG (Rp Miliar) {getSortIndicator('sim')}</th>
                <th onClick={() =>requestSort('meanSim')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Mean iDRG (Rp Miliar) {getSortIndicator('meanSim')}</th>
                <th onClick={() =>requestSort('tarifRs')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Total Tarif RS (Rp Miliar) {getSortIndicator('tarifRs')}</th>
                <th onClick={() =>requestSort('meanTarifRs')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Mean Tarif RS (Rp Miliar) {getSortIndicator('meanTarifRs')}</th>
                <th onClick={() =>requestSort('delta')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Delta (Rp Miliar) {getSortIndicator('delta')}</th>
                <th onClick={() => requestSort('deltaPercent')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Delta (%) {getSortIndicator('deltaPercent')}</th>
              </tr>
            </thead>
            <tbody>
              {displayTableData.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Tidak ada data yang cocok dengan filter saat ini.</td>
                </tr>
              ) : (
                displayTableData.map(d => (
                  <tr key={d.drg} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>{d.drg}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '0.9rem' }}>{d.deskripsi}</span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {selectedKelompok && selectedKelompok !== 'semua' 
                        ? selectedKelompok 
                        : d.kelompok}
                    </td>
                    <td style={{ padding: '16px' }}>{d.kasus.toLocaleString()}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{formatTableMiliar(d.inacbg)}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{formatTableMiliar(d.meanInacbg)}</td>
                    <td style={{ padding: '16px', fontWeight: 500 }}>{formatTableMiliar(d.sim)}</td>
                    <td style={{ padding: '16px', fontWeight: 500, fontSize: '0.9rem' }}>{formatTableMiliar(d.meanSim)}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{d.tarifRs ? formatTableMiliar(d.tarifRs) : '-'}</td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{d.meanTarifRs ? formatTableMiliar(d.meanTarifRs) : '-'}</td>
                    <td style={{ padding: '16px', color: d.delta > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {d.delta > 0 ? '+' : ''}{formatTableMiliar(d.delta)}
                    </td>
                    <td style={{ padding: '16px', color: d.deltaPercent > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {d.deltaPercent > 0 ? '+' : ''}{d.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalisisIdrg;
