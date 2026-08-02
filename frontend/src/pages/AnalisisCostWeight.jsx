// pages/AnalisisCostWeight.jsx — Analisis Cost Weight per iDRG
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { AlertTriangle, Search } from 'lucide-react';
import { api } from '../utils/api';
import { fmtRp, fmtKasus } from '../utils/formatters';

export default function AnalisisCostWeight({ dataset, simulasi, drgType }) {
  const [data,       setData]       = useState([]);
  const [byKelompok, setByKelompok] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState('');
  const [sortCol,    setSortCol]    = useState('total_kasus');
  const [sortAsc,    setSortAsc]    = useState(false);
  const [viewMode,   setViewMode]   = useState('drg'); // 'drg' | 'kelompok'

  const params = { dataset, simulasi, drg_type: drgType };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [drg, kel] = await Promise.all([
        api.costweight.list(params),
        api.costweight.byKelompok(params),
      ]);
      setData(drg);
      setByKelompok(kel);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataset, simulasi, drgType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(false); }
  };

  const filtered = data
    .filter(r => !search ||
      r.idrg_code_1363?.toLowerCase().includes(search.toLowerCase()) ||
      r.deskripsi?.toLowerCase().includes(search.toLowerCase()) ||
      r.kelompok?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const va = Number(a[sortCol]), vb = Number(b[sortCol]);
      return sortAsc ? va - vb : vb - va;
    });

  // Top 15 untuk chart
  const chartData = byKelompok.slice(0, 12).map(k => ({
    name: (k.kelompok || 'Lainnya').slice(0, 25),
    rasio: +(Number(k.rasio_cw) * 100 - 100).toFixed(1),
    kasus: fmtKasus(k.total_kasus),
  }));

  if (error) return (
    <div className="state-container">
      <AlertTriangle size={36} color="var(--accent-red)"/>
      <div className="error-box">{error}</div>
    </div>
  );

  return (
    <>
      {/* Chart rasio CW per kelompok */}
      <div className="section" style={{ marginBottom: 16 }}>
        <div className="section-title">📊 % Perubahan Tarif vs INA-CBG per Kelompok Layanan (Sim {simulasi})</div>
        {loading ? <div className="state-container" style={{ minHeight:180 }}><div className="loading-spinner"/></div> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top:4, right:8, left:0, bottom:80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:10 }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8 }}
                formatter={(v) => [`${v}%`, '% Perubahan']}
              />
              <Bar dataKey="rasio" radius={[4,4,0,0]} label={{ position:'top', fill:'var(--text-muted)', fontSize:10, formatter: v => `${v}%` }}>
                {chartData.map((e, i) => (
                  <Cell key={i} fill={e.rasio >= 0 ? '#00B1A9' : '#EF4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Toggle view */}
      <div className="filter-row" style={{ marginBottom: 12 }}>
        <div style={{ display:'flex', gap:4 }}>
          {[['drg','Per iDRG Code'],['kelompok','Per Kelompok']].map(([v,l]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding:'5px 14px', borderRadius:6, fontSize:12, cursor:'pointer',
              background: viewMode===v ? 'var(--accent-blue)' : 'var(--bg-card)',
              color: viewMode===v ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${viewMode===v ? 'var(--accent-blue)' : 'var(--border)'}`,
            }}>{l}</button>
          ))}
        </div>
        {viewMode === 'drg' && (
          <div style={{ position:'relative', marginLeft: 8 }}>
            <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari kode atau deskripsi..."
              style={{
                paddingLeft:28, padding:'6px 10px 6px 28px',
                background:'var(--bg-card)', border:'1px solid var(--border)',
                borderRadius:8, color:'var(--text-primary)', fontSize:12,
                outline:'none', fontFamily:'inherit', width:260
              }}
            />
          </div>
        )}
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-dim)' }}>
          {viewMode === 'drg' ? `${filtered.length} kode iDRG` : `${byKelompok.length} kelompok`}
        </span>
      </div>

      {/* Tabel */}
      <div className="section">
        <div className="table-wrap" style={{ maxHeight: 500, overflowY: 'auto' }}>
          {loading ? <div className="state-container" style={{ minHeight:100 }}><div className="loading-spinner"/></div> : (

            viewMode === 'kelompok' ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kelompok Layanan</th>
                    <th className="num">iDRG</th>
                    <th className="num">Kasus</th>
                    <th className="num">INA-CBG</th>
                    <th className="num">iDRG Sim 2</th>
                    <th className="num">Rasio CW</th>
                    <th className="num">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {byKelompok.map((k, i) => {
                    const s = Number(k.selisih);
                    const rasio = Number(k.rasio_cw);
                    return (
                      <tr key={i}>
                        <td style={{ fontSize:12 }}>{k.kelompok || '—'}</td>
                        <td className="num">{k.jumlah_idrg}</td>
                        <td className="num">{fmtKasus(k.total_kasus)}</td>
                        <td className="num">{fmtRp(k.total_inacbg)}</td>
                        <td className="num">{fmtRp(k.total_idrg_sim2)}</td>
                        <td className={`num ${rasio >= 1 ? 'positive':'negative'}`} style={{ fontWeight:600 }}>
                          {rasio.toFixed(3)}×
                        </td>
                        <td className={`num ${s >= 0 ? 'positive':'negative'}`}>{fmtRp(s)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('idrg_code_1363')} style={{ cursor:'pointer' }}>Kode iDRG</th>
                    <th>Deskripsi</th>
                    <th>Kelompok</th>
                    <th className="num" onClick={() => handleSort('total_kasus')} style={{ cursor:'pointer' }}>
                      Kasus {sortCol==='total_kasus' ? (sortAsc?'↑':'↓') : ''}
                    </th>
                    <th className="num" onClick={() => handleSort('avg_cw_unit')} style={{ cursor:'pointer' }}>
                      CW Unit {sortCol==='avg_cw_unit' ? (sortAsc?'↑':'↓') : ''}
                    </th>
                    <th className="num" onClick={() => handleSort('total_inacbg')} style={{ cursor:'pointer' }}>INA-CBG</th>
                    <th className="num" onClick={() => handleSort('total_idrg_sim2')} style={{ cursor:'pointer' }}>iDRG Sim 2</th>
                    <th className="num" onClick={() => handleSort('rasio_cw_sim2')} style={{ cursor:'pointer' }}>
                      Rasio {sortCol==='rasio_cw_sim2' ? (sortAsc?'↑':'↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 300).map((r, i) => {
                    const rasio = Number(r.rasio_cw_sim2);
                    return (
                      <tr key={i}>
                        <td><span className="badge blue" style={{ fontSize:10 }}>{r.idrg_code_1363}</span></td>
                        <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 }}>
                          {r.deskripsi}
                        </td>
                        <td style={{ fontSize:10, color:'var(--text-muted)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {r.kelompok}
                        </td>
                        <td className="num">{fmtKasus(r.total_kasus)}</td>
                        <td className="num">{fmtRp(r.avg_cw_unit)}</td>
                        <td className="num">{fmtRp(r.total_inacbg)}</td>
                        <td className="num">{fmtRp(r.total_idrg_sim2)}</td>
                        <td className={`num ${rasio >= 1 ? 'positive':'negative'}`} style={{ fontWeight:600 }}>
                          {isNaN(rasio) ? '—' : rasio.toFixed(3) + '×'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </>
  );
}
