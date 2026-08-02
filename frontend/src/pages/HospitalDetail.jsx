import React, { useState, useEffect } from 'react';
import { Activity, Building2, TrendingUp, TrendingDown, MapPin, Lightbulb, Download } from 'lucide-react';
import { formatCompactCurrency, formatCurrency , formatTableMiliar} from '../utils/formatters';
import HospitalScatterPlot from '../components/HospitalScatterPlot';
import { matchesGroup, RS_GROUPS } from '../utils/rsGroups';
import { useSortableTable } from '../hooks/useSortableTable';
import DownloadExcelButton from '../components/DownloadExcelButton';
import { filterHospital } from '../utils/filterUtils';
import { loadDatasetFile } from '../utils/dataLoader';


const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const HospitalDetail = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter = '', isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg } ) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProp, setSelectedProp] = useState('');
  const [selectedKab, setSelectedKab] = useState('');
  const [ptdFilter, setPtdFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg)
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [dataset]);



  const simulasiKey = `tarif_${simulasi}`;

  const allHospitalsRaw = Object.values(data || {});
  const provinces = [...new Set(allHospitalsRaw.map(h => h.prop))].sort();
  const kabupatens = selectedProp 
    ? [...new Set(allHospitalsRaw.filter(h => h.prop === selectedProp).map(h => h.kab))].sort()
    : [];

  // Data processing helper for combined table
  const processCombinedData = () => {
    let arr = Object.keys(data || {}).map(kode => {
      const rs = data[kode];
      
      const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];
      let currentRs = rs;

      if (activeLayananFilters.length > 0) {
        if (!rs.byKelompok) return null;
        let sumKasus = 0, sumIna = 0, sumSim = 0;
        let hasValid = false;
        activeLayananFilters.forEach(lay => {
          if (rs.byKelompok[lay]) {
            hasValid = true;
            sumKasus += rs.byKelompok[lay].kasus || 0;
            sumIna += rs.byKelompok[lay].inacbg || 0;
            sumSim += rs.byKelompok[lay][simulasiKey] || 0;
          }
        });
        if (!hasValid) return null;
        currentRs = { ...rs, kasus: sumKasus, inacbg: sumIna, [simulasiKey]: sumSim, ri: null, rj: null };
      }

      const getStats = (src) => {
        if (!src) return { kasus: 0, inacbg: 0, simulasiVal: 0, delta: 0, deltaPercent: 0 };
        const delta = (src[simulasiKey] || 0) - (src.inacbg || 0);
        return {
          kasus: src.kasus || 0,
          inacbg: src.inacbg || 0,
          simulasiVal: src[simulasiKey] || 0,
          delta,
          deltaPercent: src.inacbg > 0 ? (delta / src.inacbg) * 100 : 0
        };
      };

      const allStats = getStats(currentRs);
      const rjStats = getStats(currentRs.rj);
      const riStats = getStats(currentRs.ri);

      if (allStats.kasus === 0) return null;

      return {
        kode,
        nama: rs.nama,
        prop: rs.prop,
        kab: rs.kab,
        pemilik: rs.pemilik,
        jenis: rs.jenis,
        jenisFaskes: rs.jenisFaskes,
        kelasFaskes: rs.kelasFaskes,
        blu: rs.blu,
        all: allStats,
        rj: rjStats,
        ri: riStats
      };
    }).filter(Boolean);

    arr = arr.filter(h => filterHospital(h, h.kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp));

    if (selectedProp) arr = arr.filter(h => h.prop === selectedProp);
    if (selectedKab) arr = arr.filter(h => h.kab === selectedKab);

    if (search) {
      arr = arr.filter(h => 
        h.nama.toLowerCase().includes(search.toLowerCase()) || 
        h.kode.toLowerCase().includes(search.toLowerCase())
      );
    }

    return arr;
  };

  const combinedTableData = processCombinedData();

  // Create derived data for legacy components (scatter plots and top cards)
  const mapDerivedData = (type) => {
    return combinedTableData.map(h => {
      let stats = h.all;
      if (type === '1') stats = h.ri;
      else if (type === '2') stats = h.rj;
      
      if (stats.kasus === 0) return null;
      
      return {
        ...h,
        kasus: stats.kasus,
        inacbg: stats.inacbg,
        simulasiVal: stats.simulasiVal,
        delta: stats.delta,
        deltaPercent: stats.deltaPercent
      };
    }).filter(Boolean);
  };

  const rawTableData = mapDerivedData('all');
  const riData = mapDerivedData('1');
  const rjData = mapDerivedData('2');
  const { items: sortedTableData, requestSort, getSortIndicator } = useSortableTable(combinedTableData, { key: 'all.delta', direction: 'descending' });

  const topSurplus = [...rawTableData].sort((a, b) => b.delta - a.delta)[0];
  const topDefisit = [...rawTableData].sort((a, b) => a.delta - b.delta)[0];

  // Auto-generate insights
  const generateInsights = (ri, rj, all) => {
    const totalHospitals = all.length;
    if (totalHospitals === 0) return null;

    let riSurplusCount = ri.filter(d => d.delta > 0).length;
    let riDefisitCount = ri.filter(d => d.delta < 0).length;
    let riTetapCount = ri.filter(d => d.delta === 0).length;
    let riNoCaseCount = totalHospitals - ri.length;

    let rjSurplusCount = rj.filter(d => d.delta > 0).length;
    let rjDefisitCount = rj.filter(d => d.delta < 0).length;
    let rjTetapCount = rj.filter(d => d.delta === 0).length;
    let rjNoCaseCount = totalHospitals - rj.length;

    let riTotalDelta = ri.reduce((sum, d) => sum + d.delta, 0);
    let rjTotalDelta = rj.reduce((sum, d) => sum + d.delta, 0);

    const formatExtra = (tetap, noCase) => {
      let parts = [];
      if (tetap > 0) parts.push(`${tetap} RS impas/tetap`);
      if (noCase > 0) parts.push(`${noCase} RS tanpa kasus`);
      if (parts.length === 0) return '';
      return ` (serta ${parts.join(', ')})`;
    };

    return (
      <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        <li>Pada <b>Rawat Inap</b> (dari total {totalHospitals} RS), terdapat {riSurplusCount} RS surplus dan {riDefisitCount} RS defisit{formatExtra(riTetapCount, riNoCaseCount)}. Secara agregat, Rawat Inap mengalami <b>{riTotalDelta > 0 ? 'Surplus' : (riTotalDelta < 0 ? 'Defisit' : 'Tetap')} sebesar {formatCurrency(Math.abs(riTotalDelta))}</b>.</li>
        <li>Pada <b>Rawat Jalan</b> (dari total {totalHospitals} RS), terdapat {rjSurplusCount} RS surplus dan {rjDefisitCount} RS defisit{formatExtra(rjTetapCount, rjNoCaseCount)}. Secara agregat, Rawat Jalan mengalami <b>{rjTotalDelta > 0 ? 'Surplus' : (rjTotalDelta < 0 ? 'Defisit' : 'Tetap')} sebesar {formatCurrency(Math.abs(rjTotalDelta))}</b>.</li>
        {riTotalDelta > 0 && rjTotalDelta < 0 && (
          <li style={{ color: 'var(--accent-warning)', fontWeight: 600 }}>Terdapat pola subsidi silang, di mana Rawat Inap menghasilkan surplus namun Rawat Jalan defisit.</li>
        )}
      </ul>
    );
  };

  if (loading || !data) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Data Rumah Sakit...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Analisis Dampak Per Rumah Sakit</h1>
          <p className="text-secondary">Tarif iDRG vs Tarif INA-CBG (Rp Miliar)</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select className="select-input" value={selectedProp} onChange={e => { setSelectedProp(e.target.value); setSelectedKab(''); }}>
            <option value="">Semua Provinsi</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select-input" value={selectedKab} onChange={e => setSelectedKab(e.target.value)} disabled={!selectedProp}>
            <option value="">Semua Kabupaten</option>
            {kabupatens.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <input type="text" placeholder="Cari Kode/Nama RS..." className="select-input" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '180px' }} />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <div className="flex-between">
            <h3 className="text-secondary" style={{ margin: 0, fontWeight: 500 }}>RS Surplus Terbesar</h3>
            <TrendingUp className="text-success" />
          </div>
          <div style={{ marginTop: '16px', fontSize: '1.25rem', fontWeight: 700 }}>
            {topSurplus ? topSurplus.nama : '-'}
          </div>
          <div className="text-muted" style={{ marginTop: '8px', fontSize: '0.875rem' }}>
            Surplus: <span style={{ color: 'var(--accent-success)' }}>{topSurplus ? '+' + formatCompactCurrency(topSurplus.delta) : '0'}</span>
          </div>
        </div>
        
        <div className="glass-card" style={{ padding: '24px' }}>
          <div className="flex-between">
            <h3 className="text-secondary" style={{ margin: 0, fontWeight: 500 }}>RS Defisit Terbesar</h3>
            <TrendingDown className="text-danger" />
          </div>
          <div style={{ marginTop: '16px', fontSize: '1.25rem', fontWeight: 700 }}>
            {topDefisit && topDefisit.delta < 0 ? topDefisit.nama : '-'}
          </div>
          <div className="text-muted" style={{ marginTop: '8px', fontSize: '0.875rem' }}>
            Defisit: <span style={{ color: 'var(--accent-danger)' }}>{topDefisit && topDefisit.delta < 0 ? formatCompactCurrency(topDefisit.delta) : '0'}</span>
          </div>
        </div>
      </div>

      {/* NEW: Insight & Scatter Plots Side by Side */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', background: '#f8fdfb', borderLeft: '4px solid var(--accent-primary)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-primary)' }}>
          <Lightbulb size={20} /> Executive Insight Analisis
        </h3>
        {generateInsights(riData, rjData, combinedTableData)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
        <div style={{ height: '500px', width: '100%' }}>
          <HospitalScatterPlot data={riData} title="Sebaran Rawat Inap (PTD 1)" />
        </div>
        <div style={{ height: '500px', width: '100%' }}>
          <HospitalScatterPlot data={rjData} title="Sebaran Rawat Jalan (PTD 2)" />
        </div>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafa' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Tabel Kasus Rumah Sakit</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <DownloadExcelButton 
              headers={[
                "Kode", "Nama RS", "Wilayah", "Kepemilikan", "Jenis Institusi", "Jenis Faskes", "Grup Spesifik", "Tipe RS", "Status BLU",
                "Total Kasus - RJ", "Total Kasus - RI", "Total Kasus - RJ & RI",
                "Tarif INACBG - RJ", "Tarif INACBG - RI", "Tarif INACBG - RJ & RI",
                "Tarif iDRG - RJ", "Tarif iDRG - RI", "Tarif iDRG - RJ & RI",
                "Selisih (Rp) - RJ", "Selisih (Rp) - RI", "Selisih (Rp) - RJ & RI",
                "Perubahan (%) - RJ", "Perubahan (%) - RI", "Perubahan (%) - RJ & RI"
              ]}
              data={sortedTableData.map(rs => {
                const specificGroupKeys = ['muhammadiyah', 'hermina', 'siloam', 'primaya', 'mitrakeluarga'];
                const specificGroups = RS_GROUPS.filter(g => specificGroupKeys.includes(g.key) && g.match(rs.nama, rs.kode, rs)).map(g => g.label).join(', ');
                
                const kepemilikan = rs.pemilik === 'P' ? 'Pemerintah' : (rs.pemilik === 'S' ? 'Swasta' : rs.pemilik || '-');
                
                const isVertikal = RS_GROUPS.find(g => g.key === 'vertikal').match(rs.nama, rs.kode);
                let jenisInstitusi = '-';
                if (rs.pemilik === 'P') {
                    jenisInstitusi = isVertikal ? 'RS Vertikal' : 'RSUD';
                } else if (rs.pemilik === 'S') {
                    jenisInstitusi = 'RS Swasta';
                }

                const statusBlu = rs.blu && rs.blu.trim() !== '' ? rs.blu : 'Non BLU';

                return [
                  rs.kode, rs.nama, `${rs.kab}, ${rs.prop}`, 
                  kepemilikan, jenisInstitusi, rs.jenisFaskes || '-', specificGroups || '-', rs.kelasFaskes || '-', statusBlu,
                  rs.rj.kasus, rs.ri.kasus, rs.all.kasus,
                  rs.rj.inacbg, rs.ri.inacbg, rs.all.inacbg,
                  rs.rj.simulasiVal, rs.ri.simulasiVal, rs.all.simulasiVal,
                  rs.rj.delta, rs.ri.delta, rs.all.delta,
                  (rs.rj.deltaPercent/100).toFixed(4), (rs.ri.deltaPercent/100).toFixed(4), (rs.all.deltaPercent/100).toFixed(4)
                ];
              })}
              filename="Hospital_Detail_Table.xlsx"
            />
          </div>
        </div>
        <div className="table-container" style={{ overflowX: 'auto', maxHeight: '500px' }}>
          <table className="data-table-bordered" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <tr>
                <th rowSpan="2" onClick={() => requestSort('kode')} style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', verticalAlign: 'middle', borderRight: '1px solid var(--glass-border)' }}>Kode RS {getSortIndicator('kode')}</th>
                <th rowSpan="2" onClick={() => requestSort('nama')} style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', verticalAlign: 'middle', borderRight: '1px solid var(--glass-border)', textAlign: 'left' }}>Nama RS {getSortIndicator('nama')}</th>
                <th rowSpan="2" onClick={() => requestSort('kab')} style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', verticalAlign: 'middle', borderRight: '1px solid var(--glass-border)', textAlign: 'left' }}>KAB/Kota {getSortIndicator('kab')}</th>
                
                <th colSpan="3" style={{ padding: '8px', color: 'var(--text-secondary)', fontWeight: 600, borderRight: '1px solid var(--glass-border)', background: '#e2e8f0' }}>Total Kasus</th>
                <th colSpan="3" style={{ padding: '8px', color: '#000', fontWeight: 600, borderRight: '1px solid var(--glass-border)', background: '#0ea5e9' }}>Tarif INA-CBG (Rp Miliar)</th>
                <th colSpan="3" style={{ padding: '8px', color: '#000', fontWeight: 600, borderRight: '1px solid var(--glass-border)', background: '#f59e0b' }}>Tarif iDRG (Rp Miliar)</th>
                <th colSpan="3" style={{ padding: '8px', color: '#000', fontWeight: 600, borderRight: '1px solid var(--glass-border)', background: '#86efac' }}>Selisih (Rp Miliar)</th>
                <th colSpan="3" style={{ padding: '8px', color: '#000', fontWeight: 600, background: '#a7f3d0' }}>Perubahan (%)</th>
              </tr>
              <tr>
                {/* Total Kasus */}
                <th onClick={() => requestSort('rj.kasus')} style={{ cursor: 'pointer', background: '#f8fafc', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan {getSortIndicator('rj.kasus')}</th>
                <th onClick={() => requestSort('ri.kasus')} style={{ cursor: 'pointer', background: '#f8fafc', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Inap {getSortIndicator('ri.kasus')}</th>
                <th onClick={() => requestSort('all.kasus')} style={{ cursor: 'pointer', background: '#f8fafc', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan & Rawat Inap {getSortIndicator('all.kasus')}</th>
                
                {/* Tarif INACBG */}
                <th onClick={() =>requestSort('rj.inacbg')} style={{ cursor: 'pointer', background: '#bae6fd', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan (Rp Miliar) {getSortIndicator('rj.inacbg')}</th>
                <th onClick={() =>requestSort('ri.inacbg')} style={{ cursor: 'pointer', background: '#bae6fd', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Inap (Rp Miliar) {getSortIndicator('ri.inacbg')}</th>
                <th onClick={() =>requestSort('all.inacbg')} style={{ cursor: 'pointer', background: '#bae6fd', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan & Rawat Inap (Rp Miliar) {getSortIndicator('all.inacbg')}</th>
                
                {/* Tarif iDRG */}
                <th onClick={() => requestSort('rj.simulasiVal')} style={{ cursor: 'pointer', background: '#fde68a', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan {getSortIndicator('rj.simulasiVal')}</th>
                <th onClick={() => requestSort('ri.simulasiVal')} style={{ cursor: 'pointer', background: '#fde68a', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Inap {getSortIndicator('ri.simulasiVal')}</th>
                <th onClick={() => requestSort('all.simulasiVal')} style={{ cursor: 'pointer', background: '#fde68a', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan & Rawat Inap {getSortIndicator('all.simulasiVal')}</th>

                {/* Selisih */}
                <th onClick={() =>requestSort('rj.delta')} style={{ cursor: 'pointer', background: '#bbf7d0', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan (Rp Miliar) {getSortIndicator('rj.delta')}</th>
                <th onClick={() =>requestSort('ri.delta')} style={{ cursor: 'pointer', background: '#bbf7d0', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Inap (Rp Miliar) {getSortIndicator('ri.delta')}</th>
                <th onClick={() =>requestSort('all.delta')} style={{ cursor: 'pointer', background: '#bbf7d0', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan & Rawat Inap (Rp Miliar) {getSortIndicator('all.delta')}</th>

                {/* Perubahan */}
                <th onClick={() =>requestSort('rj.deltaPercent')} style={{ cursor: 'pointer', background: '#d1fae5', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Jalan (Rp Miliar) {getSortIndicator('rj.deltaPercent')}</th>
                <th onClick={() =>requestSort('ri.deltaPercent')} style={{ cursor: 'pointer', background: '#d1fae5', padding: '8px', borderRight: '1px solid var(--glass-border)' }}>Rawat Inap (Rp Miliar) {getSortIndicator('ri.deltaPercent')}</th>
                <th onClick={() =>requestSort('all.deltaPercent')} style={{ cursor: 'pointer', background: '#d1fae5', padding: '8px' }}>Rawat Jalan & Rawat Inap (Rp Miliar) {getSortIndicator('all.deltaPercent')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedTableData.slice(0, 100).map((rs) => {
                const getDeltaColor = (val) => val > 0 ? 'var(--accent-success)' : (val < 0 ? 'var(--accent-danger)' : 'inherit');
                
                return (
                  <tr key={rs.kode} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>{rs.kode}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', fontWeight: 500, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={14} className="text-muted" />
                        {rs.nama}
                      </div>
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      {(rs.kab && rs.kab.toLowerCase() === 'others') ? 'Lain-lain' : rs.kab}
                    </td>
                    
                    {/* Total Kasus */}
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{rs.rj.kasus.toLocaleString()}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{rs.ri.kasus.toLocaleString()}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', fontWeight: 600 }}>{rs.all.kasus.toLocaleString()}</td>
                    
                    {/* INACBG */}
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>{formatTableMiliar(rs.rj.inacbg)}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>{formatTableMiliar(rs.ri.inacbg)}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', fontWeight: 600 }}>{formatTableMiliar(rs.all.inacbg)}</td>
                    
                    {/* iDRG */}
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{formatTableMiliar(rs.rj.simulasiVal)}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{formatTableMiliar(rs.ri.simulasiVal)}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', fontWeight: 600 }}>{formatTableMiliar(rs.all.simulasiVal)}</td>

                    {/* Selisih */}
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: getDeltaColor(rs.rj.delta) }}>
                      {rs.rj.delta > 0 ? '+' : ''}{formatTableMiliar(rs.rj.delta)}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: getDeltaColor(rs.ri.delta) }}>
                      {rs.ri.delta > 0 ? '+' : ''}{formatTableMiliar(rs.ri.delta)}
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', fontWeight: 600, color: getDeltaColor(rs.all.delta) }}>
                      {rs.all.delta > 0 ? '+' : ''}{formatTableMiliar(rs.all.delta)}
                    </td>

                    {/* Perubahan */}
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: getDeltaColor(rs.rj.deltaPercent) }}>
                      {rs.rj.deltaPercent > 0 ? '+' : ''}{rs.rj.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                    </td>
                    <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: getDeltaColor(rs.ri.deltaPercent) }}>
                      {rs.ri.deltaPercent > 0 ? '+' : ''}{rs.ri.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600, color: getDeltaColor(rs.all.deltaPercent) }}>
                      {rs.all.deltaPercent > 0 ? '+' : ''}{rs.all.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HospitalDetail;
