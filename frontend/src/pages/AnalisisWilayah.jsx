import React, { useState, useEffect, useMemo } from 'react';
import { Activity, MapPin, Download } from 'lucide-react';
import DownloadExcelButton from '../components/DownloadExcelButton';
import { formatCompactCurrency , formatTableMiliar} from '../utils/formatters';
import SpendingShiftChart from '../components/SpendingShiftChart';
import GenericScatterPlot from '../components/GenericScatterPlot';
import IndonesiaMap from '../components/IndonesiaMap';
import { matchesGroup, RS_GROUPS } from '../utils/rsGroups';
import { useSortableTable } from '../hooks/useSortableTable';
import { filterHospital } from '../utils/filterUtils';
import { loadDatasetFile } from '../utils/dataLoader';


const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const AnalisisWilayah = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter = '', isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg } ) => {
  const [data, setData] = useState(null); // hospitals data (per-RS)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Load hospitals data so we can filter by RS group and re-aggregate per provinsi
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
  const activeGroup = null /* removed single active group logic */ || null;

  const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];

  // Re-aggregate hospitals data by provinsi, applying all filters
  const regionMap = {};
  Object.entries(data || {}).forEach(([kode, originalRs]) => {
    if (!filterHospital(originalRs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;

    let rs = { ...originalRs };
    if (activeLayananFilters.length > 0) {
      if (!rs.byKelompok) return;
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
      if (!hasValid) return;
      rs.kasus = sumKasus;
      rs.inacbg = sumIna;
      rs[simulasiKey] = sumSim;
      rs.ri = null;
      rs.rj = null;
    }

    const prop = rs.prop || 'Tidak Diketahui';
    const kab = rs.kab || 'Tidak Diketahui';
    const regionKey = `${prop} - ${kab}`;
    if (!regionMap[regionKey]) {
      regionMap[regionKey] = { 
        kasus: 0, inacbg: 0, sim: 0,
        rj: { kasus: 0, inacbg: 0, sim: 0 },
        ri: { kasus: 0, inacbg: 0, sim: 0 }
      };
    }
    regionMap[regionKey].kasus += rs.kasus || 0;
    regionMap[regionKey].inacbg += rs.inacbg || 0;
    regionMap[regionKey].sim += rs[simulasiKey] || 0;

    if (rs.rj) {
      regionMap[regionKey].rj.kasus += rs.rj.kasus || 0;
      regionMap[regionKey].rj.inacbg += rs.rj.inacbg || 0;
      regionMap[regionKey].rj.sim += rs.rj[simulasiKey] || 0;
    }
    if (rs.ri) {
      regionMap[regionKey].ri.kasus += rs.ri.kasus || 0;
      regionMap[regionKey].ri.inacbg += rs.ri.inacbg || 0;
      regionMap[regionKey].ri.sim += rs.ri[simulasiKey] || 0;
    }
  });

  const regionArray = Object.entries(regionMap)
    .map(([name, r]) => {
      const delta = r.sim - r.inacbg;
      const deltaRj = r.rj.sim - r.rj.inacbg;
      const deltaRi = r.ri.sim - r.ri.inacbg;
      return {
        name,
        inacbg: r.inacbg, simulasi: r.sim, delta, kasus: r.kasus,
        deltaPercent: r.inacbg > 0 ? (delta / r.inacbg) * 100 : 0,
        rj: { ...r.rj, simulasi: r.rj.sim, delta: deltaRj, deltaPercent: r.rj.inacbg > 0 ? (deltaRj / r.rj.inacbg) * 100 : 0 },
        ri: { ...r.ri, simulasi: r.ri.sim, delta: deltaRi, deltaPercent: r.ri.inacbg > 0 ? (deltaRi / r.ri.inacbg) * 100 : 0 }
      };
    })
    .filter(r => r.kasus > 0);

  const { items: sortedTableData, requestSort, getSortIndicator } = useSortableTable(regionArray, { key: 'kasus', direction: 'descending' });

  if (loading || !data) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Data Wilayah...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Analisis Per Wilayah</h1>
          <p className="text-secondary">
            Dampak Finansial per Provinsi (Wilayah) untuk Simulasi {simulasi}
            {activeGroup ? ` — Grup: ${activeGroup.label}` : ' — Semua RS'}
          </p>
          {activeGroup && (
            <div style={{
              marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 14px', borderRadius: '20px',
              background: `${activeGroup.color}22`, border: `1px solid ${activeGroup.color}88`,
              fontSize: '0.82rem', color: activeGroup.color, fontWeight: 600
            }}>
              <span>🏥</span>
              <span>Menampilkan {regionArray.length} provinsi dengan RS grup <b>{activeGroup.label}</b> — {regionArray.reduce((s, r) => s + r.kasus, 0).toLocaleString()} total kasus</span>
            </div>
          )}
        </div>
      </div>

      {regionArray.length === 0 ? (
        <div className="flex-center" style={{ padding: '60px 0', border: '2px dashed var(--glass-border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
          <p>Tidak ada data wilayah untuk grup RS yang dipilih.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '32px' }}>
            <SpendingShiftChart 
              title={`Perbandingan Tarif per Provinsi${activeGroup ? ` (${activeGroup.label})` : ''}`}
              data={regionArray.slice(0, 15)}
            />
          </div>

          <div style={{ height: '600px', width: '100%', marginBottom: '32px' }}>
            <GenericScatterPlot 
              title={`Sebaran Shifting per Provinsi${activeGroup ? ` (${activeGroup.label})` : ''}`}
              data={regionArray.map(r => ({
                label: r.name,
                inacbg: r.inacbg,
                simulasiVal: r.simulasi,
                delta: r.delta,
                kasus: r.kasus
              }))}
            />
          </div>

          <div style={{ marginBottom: '32px' }}>
            <IndonesiaMap data={regionArray} />
          </div>

          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>Detail Tabel Wilayah</h3>
              <DownloadExcelButton 
                headers={[
                  "Provinsi (Wilayah)", 
                  "Kasus RJ", "Kasus RI", "Kasus Total", 
                  "INA-CBG RJ", "INA-CBG RI", "INA-CBG Total", 
                  "iDRG RJ", "iDRG RI", "iDRG Total", 
                  "Selisih RJ", "Selisih RI", "Selisih Total", 
                  "Perubahan RJ", "Perubahan RI", "Perubahan Total"
                ]}
                data={sortedTableData.map(r => [
                  r.name, 
                  r.rj.kasus, r.ri.kasus, r.kasus,
                  r.rj.inacbg, r.ri.inacbg, r.inacbg,
                  r.rj.simulasi, r.ri.simulasi, r.simulasi,
                  r.rj.delta, r.ri.delta, r.delta,
                  (r.rj.deltaPercent || 0).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%', 
                  (r.ri.deltaPercent || 0).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%', 
                  (r.deltaPercent || 0).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%'
                ])}
                filename={`Analisis_Wilayah_${simulasi}.xlsx`}
                groupHeaders={[
                  { label: 'Provinsi - Kab/Kota', colSpan: 1, rowSpan: 2, fill: '#008080' },
                  { label: 'Total Kasus', colSpan: 3, fill: '#1abc9c' },
                  { label: 'Tarif INA-CBG', colSpan: 3, fill: '#16a085' },
                  { label: 'Tarif iDRG', colSpan: 3, fill: '#f1c40f' },
                  { label: 'Selisih (Rp)', colSpan: 3, fill: '#e67e22' },
                  { label: 'Perubahan (%)', colSpan: 3, fill: '#e74c3c' }
                ]}
              />
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1400px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th rowSpan="2" style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, borderRight: '1px solid var(--glass-border)' }}>No</th>
                    <th rowSpan="2" onClick={() => requestSort('name')} style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', userSelect: 'none', borderRight: '1px solid var(--glass-border)' }}>Provinsi - Kab/Kota {getSortIndicator('name')}</th>
                    <th colSpan="3" style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, borderRight: '1px solid var(--glass-border)' }}>Total Kasus</th>
                    <th colSpan="3" style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, borderRight: '1px solid var(--glass-border)' }}>Tarif INA-CBG (Rp Miliar)</th>
                    <th colSpan="3" style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, borderRight: '1px solid var(--glass-border)' }}>Tarif iDRG (Rp Miliar)</th>
                    <th colSpan="3" style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600, borderRight: '1px solid var(--glass-border)' }}>Selisih (Rp Miliar)</th>
                    <th colSpan="3" style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>Perubahan (%)</th>
                  </tr>
                  <tr style={{ borderBottom: '2px solid var(--glass-border)', fontSize: '0.85rem' }}>
                    {/* Kasus */}
                    <th onClick={() => requestSort('rj.kasus')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Jalan {getSortIndicator('rj.kasus')}</th>
                    <th onClick={() => requestSort('ri.kasus')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Inap {getSortIndicator('ri.kasus')}</th>
                    <th onClick={() => requestSort('kasus')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', borderRight: '1px solid var(--glass-border)' }}>Total {getSortIndicator('kasus')}</th>
                    {/* INA-CBG */}
                    <th onClick={() =>requestSort('rj.inacbg')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Jalan (Rp Miliar) {getSortIndicator('rj.inacbg')}</th>
                    <th onClick={() =>requestSort('ri.inacbg')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Inap (Rp Miliar) {getSortIndicator('ri.inacbg')}</th>
                    <th onClick={() =>requestSort('inacbg')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', borderRight: '1px solid var(--glass-border)' }}>Total (Rp Miliar) {getSortIndicator('inacbg')}</th>
                    {/* iDRG */}
                    <th onClick={() => requestSort('rj.simulasi')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Jalan {getSortIndicator('rj.simulasi')}</th>
                    <th onClick={() => requestSort('ri.simulasi')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Inap {getSortIndicator('ri.simulasi')}</th>
                    <th onClick={() => requestSort('simulasi')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', borderRight: '1px solid var(--glass-border)' }}>Total {getSortIndicator('simulasi')}</th>
                    {/* Selisih */}
                    <th onClick={() =>requestSort('rj.delta')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Jalan (Rp Miliar) {getSortIndicator('rj.delta')}</th>
                    <th onClick={() =>requestSort('ri.delta')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Inap (Rp Miliar) {getSortIndicator('ri.delta')}</th>
                    <th onClick={() =>requestSort('delta')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', borderRight: '1px solid var(--glass-border)' }}>Total (Rp Miliar) {getSortIndicator('delta')}</th>
                    {/* Perubahan */}
                    <th onClick={() =>requestSort('rj.deltaPercent')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Jalan (Rp Miliar) {getSortIndicator('rj.deltaPercent')}</th>
                    <th onClick={() =>requestSort('ri.deltaPercent')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Rawat Inap (Rp Miliar) {getSortIndicator('ri.deltaPercent')}</th>
                    <th onClick={() =>requestSort('deltaPercent')} style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>Total (Rp Miliar) {getSortIndicator('deltaPercent')}</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '0.9rem' }}>
                  {sortedTableData.map((r, idx) => (
                    <tr key={r.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px', borderRight: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, borderRight: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={16} className="text-muted" />
                          {r.name}
                        </div>
                      </td>
                      {/* Kasus */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.rj.kasus.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{r.ri.kasus.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid var(--glass-border)' }}>{r.kasus.toLocaleString()}</td>
                      {/* INA-CBG */}
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', textAlign: 'right' }}>{formatTableMiliar(r.rj.inacbg)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', textAlign: 'right' }}>{formatTableMiliar(r.ri.inacbg)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600, borderRight: '1px solid var(--glass-border)' }}>{formatTableMiliar(r.inacbg)}</td>
                      {/* iDRG */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatTableMiliar(r.rj.simulasi)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatTableMiliar(r.ri.simulasi)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid var(--glass-border)' }}>{formatTableMiliar(r.simulasi)}</td>
                      {/* Selisih */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: r.rj.delta > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {r.rj.delta > 0 ? '+' : ''}{formatTableMiliar(r.rj.delta)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: r.ri.delta > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {r.ri.delta > 0 ? '+' : ''}{formatTableMiliar(r.ri.delta)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, borderRight: '1px solid var(--glass-border)', color: r.delta > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {r.delta > 0 ? '+' : ''}{formatTableMiliar(r.delta)}
                      </td>
                      {/* Perubahan */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: r.rj.deltaPercent > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {r.rj.deltaPercent > 0 ? '+' : ''}{r.rj.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: r.ri.deltaPercent > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {r.ri.deltaPercent > 0 ? '+' : ''}{r.ri.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: r.deltaPercent > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {r.deltaPercent > 0 ? '+' : ''}{r.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalisisWilayah;
