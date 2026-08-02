// pages/TrenBulanan.jsx — Tren bulanan dari dataset okt_jun_v3
import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  AreaChart, Area
} from 'recharts';
import { AlertTriangle, Calendar } from 'lucide-react';
import { api } from '../utils/api';
import { fmtRp, fmtKasus, fmtB } from '../utils/formatters';

export default function TrenBulanan({ dataset, simulasi, drgType }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filterProv, setFilterProv] = useState('all');
  const [provOptions, setProvOptions] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tren, opts] = await Promise.all([
        api.tren.bulanan({
          simulasi, drg_type: drgType,
          ...(filterProv !== 'all' ? { propinsi: filterProv } : {}),
        }),
        api.nasional.filterOptions({ dataset: 'okt_jun_v3' }),
      ]);
      setData(tren);
      setProvOptions(opts.provinsi_list || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [simulasi, drgType, filterProv]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Format bulan untuk label
  const chartData = data.map(r => ({
    bulan: r.bulan?.slice(0, 12) || '?',
    inacbg: fmtB(r.total_tarif_inacbg),
    idrg:   fmtB(r.total_tarif_idrg),
    selisih: fmtB(Number(r.total_tarif_idrg) - Number(r.total_tarif_inacbg)),
    kasus:   Number(r.total_kasus),
    rs:      r.jumlah_rs,
  }));

  if (error) return (
    <div className="state-container">
      <AlertTriangle size={36} color="var(--accent-red)"/>
      <div className="error-box">{error}</div>
    </div>
  );

  if (dataset === 'jan_des_v11' && data.length === 0 && !loading) return (
    <div className="state-container">
      <Calendar size={48} color="var(--text-dim)"/>
      <p style={{ color:'var(--text-muted)', textAlign:'center' }}>
        Tren Bulanan hanya tersedia untuk dataset <strong>Okt–Jun 2026</strong>.<br/>
        Silakan ganti dataset di header atas.
      </p>
    </div>
  );

  return (
    <>
      <div className="filter-row" style={{ marginBottom: 16 }}>
        <span className="filter-label">Provinsi:</span>
        <select className="styled-select" value={filterProv} onChange={e => setFilterProv(e.target.value)}>
          <option value="all">Semua Provinsi</option>
          {provOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-dim)' }}>
          Data: Okt–Jun 2026 (v3) | Sim {simulasi}
        </span>
      </div>

      {/* Area chart tarif */}
      <div className="section" style={{ marginBottom:16 }}>
        <div className="section-title">📈 Tren Tarif Bulanan (Miliar Rp)</div>
        {loading ? <div className="state-container" style={{ minHeight:220 }}><div className="loading-spinner"/></div> : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top:8, right:16, bottom:8, left:0 }}>
              <defs>
                <linearGradient id="gInacbg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0284C7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0284C7" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gIdrg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00B1A9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00B1A9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="bulan" tick={{ fill:'var(--text-muted)', fontSize:10 }} angle={-20} textAnchor="end" height={40} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} />
              <Tooltip
                contentStyle={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8 }}
                formatter={(v, n) => [`${v} M`, n]}
              />
              <Legend wrapperStyle={{ fontSize:12 }} />
              <Area type="monotone" dataKey="inacbg" name="INA-CBG" stroke="#0284C7" fill="url(#gInacbg)" strokeWidth={2} dot={{ r:3 }} />
              <Area type="monotone" dataKey="idrg"   name={`iDRG Sim ${simulasi}`} stroke="#00B1A9" fill="url(#gIdrg)"   strokeWidth={2} dot={{ r:3 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Line chart selisih */}
      <div className="section" style={{ marginBottom:16 }}>
        <div className="section-title">📉 Selisih Tarif iDRG − INA-CBG per Bulan (Miliar Rp)</div>
        {loading ? <div className="state-container" style={{ minHeight:180 }}><div className="loading-spinner"/></div> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top:8, right:16, bottom:8, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="bulan" tick={{ fill:'var(--text-muted)', fontSize:10 }} angle={-20} textAnchor="end" height={40} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} />
              <Tooltip
                contentStyle={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8 }}
                formatter={(v) => [`${v} M`, 'Selisih']}
              />
              <ReferenceLine y={0} stroke="var(--text-dim)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="selisih" name="Selisih" stroke="#059669" strokeWidth={2} dot={{ r:4 }}
                dot={{ fill:'#f5a623', stroke:'var(--bg-primary)', strokeWidth:2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabel ringkasan bulanan */}
      <div className="section">
        <div className="section-title">Rincian per Bulan</div>
        <div className="table-wrap">
          {loading ? <div className="state-container" style={{ minHeight:80 }}><div className="loading-spinner"/></div> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th className="num">RS Aktif</th>
                  <th className="num">Kasus</th>
                  <th className="num">INA-CBG</th>
                  <th className="num">iDRG</th>
                  <th className="num">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => {
                  const s = Number(r.total_tarif_idrg) - Number(r.total_tarif_inacbg);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight:500 }}>{r.bulan}</td>
                      <td className="num">{r.jumlah_rs}</td>
                      <td className="num">{fmtKasus(r.total_kasus)}</td>
                      <td className="num">{fmtRp(r.total_tarif_inacbg)}</td>
                      <td className="num">{fmtRp(r.total_tarif_idrg)}</td>
                      <td className={`num ${s >= 0 ? 'positive':'negative'}`}>{fmtRp(s)}</td>
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
