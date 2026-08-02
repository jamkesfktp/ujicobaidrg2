// pages/SimulasiShifting.jsx — Analisis RS yang mengalami shifting tarif
import React, { useState, useEffect, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '../utils/api';
import { fmtRp, fmtKasus, fmtRasio } from '../utils/formatters';

export default function SimulasiShifting({ dataset, simulasi, drgType }) {
  const [data,    setData]    = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [mode,    setMode]    = useState('all');
  const [threshold, setThreshold] = useState(1.0);
  const [filterKelas, setFilterKelas] = useState('all');
  const [sortCol, setSortCol] = useState('selisih_absolut');
  const [sortAsc, setSortAsc] = useState(false);

  const params = { dataset, simulasi, drg_type: drgType, mode, threshold, limit: 500 };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        api.shifting.list({ ...params, ...(filterKelas !== 'all' ? { kelas_faskes: filterKelas } : {}) }),
        api.shifting.summary({ dataset, simulasi, drg_type: drgType }),
      ]);
      setData(list);
      setSummary(sum);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataset, simulasi, drgType, mode, threshold, filterKelas]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(false); }
  };

  const sorted = [...data].sort((a,b) => {
    const va = Number(a[sortCol]), vb = Number(b[sortCol]);
    return sortAsc ? va - vb : vb - va;
  });

  const kelasList = [...new Set(data.map(r => r.kelas_faskes))].filter(Boolean).sort();

  // Data untuk scatter plot (tarif inacbg vs idrg, dalam miliar)
  const scatterData = data.slice(0, 300).map(r => ({
    x: +(Number(r.total_tarif_inacbg) / 1e9).toFixed(3),
    y: +(Number(r.total_tarif_idrg)   / 1e9).toFixed(3),
    name: r.kode_rs,
    kelas: r.kelas_faskes,
  }));

  const KELAS_COL = { A:'#0284C7', B:'#00B1A9', C:'#059669', D:'#F59E0B', '?':'#9CA3AF' };

  if (error) return (
    <div className="state-container">
      <AlertTriangle size={36} color="var(--accent-red)"/>
      <div className="error-box">{error}</div>
    </div>
  );

  return (
    <>
      {/* Summary cards */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card green">
            <div className="icon"><TrendingUp size={22}/></div>
            <div className="label">RS Naik Tarif</div>
            <div className="value">{Number(summary.rs_naik).toLocaleString()}</div>
            <div className="sub">Total kenaikan: {fmtRp(summary.total_kenaikan)}</div>
          </div>
          <div className="stat-card red">
            <div className="icon"><TrendingDown size={22}/></div>
            <div className="label">RS Turun Tarif</div>
            <div className="value">{Number(summary.rs_turun).toLocaleString()}</div>
            <div className="sub">Total penurunan: {fmtRp(summary.total_penurunan)}</div>
          </div>
          <div className="stat-card blue">
            <div className="icon"><Minus size={22}/></div>
            <div className="label">RS Sama Tarif</div>
            <div className="value">{Number(summary.rs_sama).toLocaleString()}</div>
            <div className="sub">Tidak ada shifting</div>
          </div>
          <div className="stat-card orange">
            <div className="label">Net Shifting</div>
            <div className="value">{fmtRp(Number(summary.total_kenaikan) - Number(summary.total_penurunan))}</div>
            <div className="sub">Kenaikan − Penurunan</div>
          </div>
        </div>
      )}

      {/* Filter row */}
      <div className="filter-row" style={{ marginBottom: 16 }}>
        <span className="filter-label">Mode:</span>
        <select className="styled-select" value={mode} onChange={e => setMode(e.target.value)}>
          <option value="all">Semua RS</option>
          <option value="naik">RS Naik Tarif</option>
          <option value="turun">RS Turun Tarif</option>
        </select>

        <span className="filter-label">Threshold Rasio:</span>
        <input
          type="number" step="0.05" min="0" max="5"
          value={threshold}
          onChange={e => setThreshold(+e.target.value)}
          style={{
            width:80, padding:'6px 8px', background:'var(--bg-card)',
            border:'1px solid var(--border)', borderRadius:8,
            color:'var(--text-primary)', fontSize:13, fontFamily:'inherit'
          }}
        />

        <span className="filter-label">Kelas:</span>
        <select className="styled-select" value={filterKelas} onChange={e => setFilterKelas(e.target.value)}>
          <option value="all">Semua</option>
          {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
        </select>

        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-dim)' }}>
          {data.length} RS | Sim {simulasi}
        </span>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Scatter plot */}
        <div className="section">
          <div className="section-title">Scatter: INA-CBG vs iDRG (Miliar Rp)</div>
          {loading ? <div className="state-container" style={{ minHeight:200 }}><div className="loading-spinner"/></div> : (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top:8, right:16, bottom:24, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="x" name="INA-CBG" type="number"
                  tick={{ fill:'var(--text-muted)', fontSize:10 }}
                  label={{ value:'INA-CBG (M)', position:'insideBottom', offset:-10, fill:'var(--text-muted)', fontSize:11 }}
                />
                <YAxis dataKey="y" name="iDRG" type="number"
                  tick={{ fill:'var(--text-muted)', fontSize:10 }}
                />
                <Tooltip
                  contentStyle={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8 }}
                  cursor={{ strokeDasharray:'3 3' }}
                  formatter={(v, name) => [`${v} M`, name]}
                  labelFormatter={(l) => ''}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="custom-tooltip">
                        <div className="ct-label">{d?.name}</div>
                        <div className="ct-value">INA-CBG: {d?.x} M</div>
                        <div className="ct-value">iDRG: {d?.y} M</div>
                        <div style={{ color: d?.y > d?.x ? 'var(--accent-green)':'var(--accent-red)', fontSize:11, marginTop:4 }}>
                          {d?.y > d?.x ? '↑ Naik' : '↓ Turun'}
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Scatter data={scatterData}
                  fill="#00B1A9" fillOpacity={0.7}
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    const color = payload.y > payload.x ? '#3ecf8e' : '#f16063';
                    return <circle cx={cx} cy={cy} r={4} fill={color} fillOpacity={0.75}/>;
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
            🟢 Naik &nbsp; 🔴 Turun &nbsp; (diagonal = tidak ada shifting)
          </div>
        </div>

        {/* Info box */}
        <div className="section">
          <div className="section-title">📖 Tentang Simulasi Shifting</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            Simulasi Shifting menganalisis perubahan tarif yang dialami setiap rumah sakit
            ketika beralih dari sistem INA-CBG ke iDRG.
          </p>
          <br/>
          <table className="data-table">
            <thead><tr><th>Metrik</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr><td>Rasio</td><td>Total iDRG ÷ Total INA-CBG</td></tr>
              <tr><td>Selisih Absolut</td><td>Total iDRG − Total INA-CBG (Rp)</td></tr>
              <tr><td>RS Naik</td><td>Rasio &gt; 1.0 (iDRG lebih tinggi)</td></tr>
              <tr><td>RS Turun</td><td>Rasio &lt; 1.0 (iDRG lebih rendah)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabel detail */}
      <div className="section">
        <div className="section-title">Rincian Per Rumah Sakit ({sorted.length} RS)</div>
        <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
          {loading ? (
            <div className="state-container" style={{ minHeight:100 }}><div className="loading-spinner"/></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('kode_rs')} style={{ cursor:'pointer' }}>Kode RS</th>
                  <th>Provinsi</th>
                  <th>Kelas</th>
                  <th>Kompetensi</th>
                  <th className="num" onClick={() => handleSort('total_kasus')} style={{ cursor:'pointer' }}>Kasus</th>
                  <th className="num" onClick={() => handleSort('total_tarif_inacbg')} style={{ cursor:'pointer' }}>INA-CBG</th>
                  <th className="num" onClick={() => handleSort('total_tarif_idrg')} style={{ cursor:'pointer' }}>iDRG</th>
                  <th className="num" onClick={() => handleSort('rasio_idrg_inacbg')} style={{ cursor:'pointer' }}>Rasio</th>
                  <th className="num" onClick={() => handleSort('selisih_absolut')} style={{ cursor:'pointer' }}>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0,300).map((r, i) => {
                  const s = Number(r.selisih_absolut);
                  const rasio = Number(r.rasio_idrg_inacbg);
                  return (
                    <tr key={i}>
                      <td style={{ fontSize:11, fontWeight:600 }}>{r.kode_rs}</td>
                      <td style={{ fontSize:11 }}>{r.propinsi}</td>
                      <td><span className="badge blue" style={{ fontSize:10 }}>Kelas {r.kelas_faskes}</span></td>
                      <td style={{ fontSize:11 }}>{r.faskes_kompetensi || '—'}</td>
                      <td className="num">{fmtKasus(r.total_kasus)}</td>
                      <td className="num">{fmtRp(r.total_tarif_inacbg)}</td>
                      <td className="num">{fmtRp(r.total_tarif_idrg)}</td>
                      <td className={`num ${rasio >= 1 ? 'positive' : 'negative'}`} style={{ fontWeight:600 }}>
                        {rasio.toFixed(3)}×
                      </td>
                      <td className={`num ${s >= 0 ? 'positive' : 'negative'}`}>{fmtRp(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
