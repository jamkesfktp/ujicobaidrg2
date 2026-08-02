import React, { useState, useEffect } from 'react';
import { Activity, Stethoscope, Download } from 'lucide-react';
import DownloadExcelButton from '../components/DownloadExcelButton';
import { formatCompactCurrency, formatCurrency , formatTableMiliar} from '../utils/formatters';
import GenericScatterPlot from '../components/GenericScatterPlot';
import { useSortableTable } from '../hooks/useSortableTable';
import { matchesGroup, RS_GROUPS } from '../utils/rsGroups';
import { loadDatasetFile } from '../utils/dataLoader';


const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const SimulationDetail = ({ dataset, simulasi, groupFilter, wilayahFilter = [], rsFilter = '' , globalMonth, globalDrg}) => {
  const [data, setData] = useState(null);
  const [hospitalsData, setHospitalsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'drgs', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
    ]).then(([drgs, hosp]) => {
        setData(drgs);
        setHospitalsData(hosp);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [dataset]);

  const simulasiKey = `tarif_${simulasi}`;
  const isFiltered = !!(groupFilter || (wilayahFilter && wilayahFilter.length > 0) || rsFilter);
  const activeGroup = null /* removed single active group logic */ || null;

  // Build DRG array — either from raw drgs.json or reaggregated from hospitals
  let drgArray = [];
  if (isFiltered && hospitalsData) {
    // Reaggregate from hospitals byKelompok is per-service, not per-DRG
    // drg_analysis has byGroup/byProp. For this page (drgs.json) there's no per-RS DRG data.
    // We use drgs.json but show a filter-info banner.
    drgArray = Object.keys(data || {}).map(kode => {
      const d = data[kode];
      const delta = d[simulasiKey] - d.inacbg;
      return { kode, ...d, simulasiVal: d[simulasiKey], delta, deltaPercent: d.inacbg > 0 ? (delta / d.inacbg) * 100 : 0 };
    });
  } else {
    drgArray = Object.keys(data || {}).map(kode => {
      const d = data[kode];
      const delta = d[simulasiKey] - d.inacbg;
      return { kode, ...d, simulasiVal: d[simulasiKey], delta, deltaPercent: d.inacbg > 0 ? (delta / d.inacbg) * 100 : 0 };
    });
  }

  drgArray.sort((a, b) => b.inacbg - a.inacbg);

  const filteredDrgs = drgArray.filter(d =>
    d.kode.toLowerCase().includes(search.toLowerCase()) ||
    d.kelompok.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 100);

  const { items: sortedTableData, requestSort, getSortIndicator } = useSortableTable(filteredDrgs, { key: 'inacbg', direction: 'descending' });

  if (loading || !data) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Data DRG...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Tarif iDRG Detail</h1>
          <p className="text-secondary">Dampak Finansial per DRG (Diagnosis Related Group)</p>
          {isFiltered && (
            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(255,165,0,0.12)', border: '1px solid rgba(255,165,0,0.4)', fontSize: '0.8rem', color: '#e67e22' }}>
              <span>⚠️</span>
              <span>Data DRG di halaman ini adalah agregat nasional — filter Grup/Wilayah/RS tidak mengubah tabel ini. Gunakan menu <b>Analisis iDRG</b> untuk data per grup/wilayah.</span>
            </div>
          )}
        </div>
        <div>
          <input 
            type="text" 
            placeholder="Cari Kode DRG atau Layanan..." 
            className="select-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '300px' }}
          />
        </div>
      </div>

      {filteredDrgs.length > 0 && (
        <div style={{ height: '600px', width: '100%', marginBottom: '32px' }}>
          <GenericScatterPlot 
            title={`Sebaran Shifting per DRG (Top ${filteredDrgs.length})`}
            data={filteredDrgs.map(d => ({
              label: `${d.kode} - ${d.deskripsi || '-'}`,
              extra: `Kelompok: ${d.kelompok}`,
              inacbg: d.inacbg,
              simulasiVal: d.simulasiVal,
              delta: d.delta,
              kasus: d.kasus
            }))}
          />
        </div>
      )}

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>Detail Tabel Simulasi</h3>
          <DownloadExcelButton 
            headers={["Kode DRG", "Deskripsi iDRG", "Kelompok Layanan", "Jml Kasus", "Tarif INA-CBG", "Tarif iDRG", "Delta (Rp)", "Delta (%)"]}
            data={sortedTableData.map(d => [d.kode, d.deskripsi, d.kelompok, d.kasus, d.inacbg, d.simulasiVal, d.delta, d.deltaPercent])}
            filename={`Simulasi_${simulasi}.xlsx`}
          />
        </div>
        <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                <th onClick={() => requestSort('kode')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Kode DRG {getSortIndicator('kode')}</th>
                <th onClick={() =>requestSort('deskripsi')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Deskripsi iDRG {getSortIndicator('deskripsi')}</th>
                <th onClick={() => requestSort('kelompok')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Kelompok Layanan {getSortIndicator('kelompok')}</th>
                <th onClick={() => requestSort('kasus')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Jml Kasus {getSortIndicator('kasus')}</th>
                <th onClick={() =>requestSort('inacbg')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Tarif INA-CBG (Rp Miliar) {getSortIndicator('inacbg')}</th>
                <th onClick={() =>requestSort('simulasiVal')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Tarif iDRG (Rp Miliar) {getSortIndicator('simulasiVal')}</th>
                <th onClick={() =>requestSort('delta')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Delta (Rp Miliar) {getSortIndicator('delta')}</th>
                <th onClick={() => requestSort('deltaPercent')} style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}>Delta (%) {getSortIndicator('deltaPercent')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedTableData.map((d, idx) => (
                <tr key={d.kode} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px', fontWeight: 600, color: 'var(--accent-primary)' }}>{d.kode}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontSize: '0.9rem' }}>{d.deskripsi || '-'}</span>
                  </td>
                  <td style={{ padding: '16px', fontWeight: 500, color: 'var(--text-muted)' }}>
                    {d.kelompok}
                  </td>
                  <td style={{ padding: '16px' }}>{d.kasus.toLocaleString()}</td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{formatTableMiliar(d.inacbg)}</td>
                  <td style={{ padding: '16px' }}>{formatTableMiliar(d.simulasiVal)}</td>
                  <td style={{ padding: '16px', color: d.delta > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {d.delta > 0 ? '+' : ''}{formatTableMiliar(d.delta)}
                  </td>
                  <td style={{ padding: '16px', color: d.deltaPercent > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {d.deltaPercent > 0 ? '+' : ''}{d.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SimulationDetail;
