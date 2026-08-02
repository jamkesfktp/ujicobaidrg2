// pages/SimulasiAnggaran.jsx — Perbandingan Semua Skenario Anggaran
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell
} from 'recharts';
import { AlertTriangle, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../utils/api';
import { fmtRp, fmtKasus, fmtB } from '../utils/formatters';

const SIMS_1363 = [
  { key:'tarif_inacbg', label:'INA-CBG (Baseline)', color:'#5a6385', desc:'Tarif INA-CBG saat ini' },
  { key:'sim1_1363',    label:'Sim 1',  color:'#0284C7', desc:'CW×NBR' },
  { key:'sim2_1363',    label:'Sim 2',  color:'#00B1A9', desc:'CW×NBR+TopUp (Default)' },
  { key:'sim3_1363',    label:'Sim 3',  color:'#059669', desc:'+AF Regional' },
  { key:'sim5_1363',    label:'Sim 5',  color:'#F59E0B', desc:'+AF Regional+Komp' },
  { key:'sim26_1363',   label:'Sim 26', color:'#38BDF8', desc:'Juknis TopUp 1363' },
  { key:'sim54_1363',   label:'Sim 54', color:'#EF4444', desc:'BPJS TopUp 1363' },
];

const SIMS_1370 = [
  { key:'tarif_inacbg', label:'INA-CBG (Baseline)', color:'#5a6385', desc:'Tarif INA-CBG saat ini' },
  { key:'sim1_1370',    label:'Sim 1',  color:'#0284C7', desc:'CW×NBR' },
  { key:'sim2_1370',    label:'Sim 2',  color:'#00B1A9', desc:'CW×NBR+TopUp' },
  { key:'sim3_1370',    label:'Sim 3',  color:'#059669', desc:'+AF Regional' },
  { key:'sim5_1370',    label:'Sim 5',  color:'#F59E0B', desc:'+AF Regional+Komp' },
  { key:'sim41_1370',   label:'Sim 41', color:'#EF4444', desc:'BPJS TopUp 1370' },
];

function SimRow({ sim, baseline, value }) {
  const base = Number(baseline);
  const val  = Number(value);
  const diff = val - base;
  const pct  = base > 0 ? ((val / base - 1) * 100).toFixed(1) : 0;

  return (
    <tr>
      <td>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:10, height:10, borderRadius:3, background: sim.color, flexShrink:0 }}/>
          <span className="badge blue" style={{ fontSize:11 }}>{sim.label}</span>
        </div>
      </td>
      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{sim.desc}</td>
      <td className="num">{fmtRp(value)}</td>
      <td className={`num ${diff >= 0 ? 'positive':'negative'}`}>
        {fmtRp(diff)}
      </td>
      <td className={`num ${diff >= 0 ? 'positive':'negative'}`} style={{ fontWeight:600 }}>
        {diff >= 0 ? '+' : ''}{pct}%
      </td>
    </tr>
  );
}

export default function SimulasiAnggaran({ dataset, simulasi, drgType }) {
  const [data,      setData]      = useState(null);
  const [byProv,    setByProv]    = useState([]);
  const [byKelas,   setByKelas]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [activeTab, setActiveTab] = useState('1363');

  const params = { dataset };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, prov, kelas] = await Promise.all([
        api.anggaran.perbandingan(params),
        api.anggaran.byProvinsi(params),
        api.anggaran.byKelas(params),
      ]);
      setData(sum);
      setByProv(prov.slice(0,15));
      setByKelas(kelas);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) return (
    <div className="state-container">
      <AlertTriangle size={36} color="var(--accent-red)"/>
      <div className="error-box">{error}</div>
    </div>
  );
  if (loading) return (
    <div className="state-container">
      <div className="loading-spinner"/>
      <span>Menghitung semua skenario anggaran...</span>
    </div>
  );
  if (!data) return null;

  const sims = activeTab === '1363' ? SIMS_1363 : SIMS_1370;
  const baseline = Number(data.tarif_inacbg);

  // Chart data — miliar
  const chartData = sims.map(s => ({
    name: s.label,
    value: fmtB(data[s.key] || data.tarif_inacbg),
    color: s.color,
  }));

  // Provinsi chart
  const provChart = byProv.map(p => ({
    name: p.propinsi?.slice(0, 15) || '?',
    inacbg: fmtB(p.tarif_inacbg),
    sim2:   fmtB(activeTab === '1363' ? p.sim2_1363 : p.sim2_1370),
    sim54:  fmtB(p.sim54_1363),
  }));

  return (
    <>
      {/* Summary stats */}
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card purple">
          <div className="icon"><Wallet size={22}/></div>
          <div className="label">Total Kasus</div>
          <div className="value">{fmtKasus(data.total_kasus)}</div>
          <div className="sub">{data.jumlah_rs} RS · {data.jumlah_provinsi} Provinsi</div>
        </div>
        <div className="stat-card blue">
          <div className="label">Baseline INA-CBG</div>
          <div className="value">{fmtRp(data.tarif_inacbg)}</div>
          <div className="sub">Referensi perbandingan</div>
        </div>
        <div className="stat-card green">
          <div className="icon"><TrendingUp size={22}/></div>
          <div className="label">iDRG Sim 2 (1363)</div>
          <div className="value">{fmtRp(data.sim2_1363)}</div>
          <div className="sub">Selisih: {fmtRp(Number(data.sim2_1363) - Number(data.tarif_inacbg))}</div>
        </div>
        <div className="stat-card teal">
          <div className="label">iDRG Sim 2 (1370)</div>
          <div className="value">{fmtRp(data.sim2_1370)}</div>
          <div className="sub">Selisih: {fmtRp(Number(data.sim2_1370) - Number(data.tarif_inacbg))}</div>
        </div>
      </div>

      {/* Toggle 1363 / 1370 */}
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {[['1363','1363 DRG (Eksisting)'],['1370','1370 DRG (MST Baru)']].map(([v,l]) => (
          <button key={v} onClick={() => setActiveTab(v)} style={{
            padding:'6px 18px', borderRadius:8, fontSize:13, cursor:'pointer',
            background: activeTab===v ? 'var(--accent-blue)' : 'var(--bg-card)',
            color: activeTab===v ? '#fff' : 'var(--text-muted)',
            border: `1px solid ${activeTab===v ? 'var(--accent-blue)' : 'var(--border)'}`,
          }}>{l}</button>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Bar chart semua simulasi */}
        <div className="section">
          <div className="section-title">Perbandingan Anggaran Semua Skenario (Miliar Rp)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top:8, right:8, bottom:8, left:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:10 }} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} />
              <Tooltip
                contentStyle={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8 }}
                formatter={(v) => [`${v} M`, 'Total Tarif']}
              />
              <Bar dataKey="value" radius={[4,4,0,0]} label={{ position:'top', fill:'var(--text-muted)', fontSize:9, formatter: v => `${v}M` }}>
                {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabel perbandingan skenario */}
        <div className="section">
          <div className="section-title">Tabel Perbandingan vs Baseline INA-CBG</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Skenario</th>
                  <th>Deskripsi</th>
                  <th className="num">Total Tarif</th>
                  <th className="num">Selisih</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {sims.slice(1).map((s, i) => (
                  <SimRow key={i} sim={s} baseline={data.tarif_inacbg} value={data[s.key]} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Provinsi chart */}
      <div className="section">
        <div className="section-title">Perbandingan Anggaran per Provinsi — Top 15 (Miliar Rp)</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={provChart} margin={{ top:4, right:8, bottom:80, left:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:10 }} angle={-40} textAnchor="end" interval={0} />
            <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} />
            <Tooltip
              contentStyle={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8 }}
              formatter={(v, n) => [`${v} M`, n]}
            />
            <Legend wrapperStyle={{ paddingTop:8, fontSize:12 }} />
            <Bar dataKey="inacbg" name="INA-CBG"   fill="#0284C7" radius={[3,3,0,0]} />
            <Bar dataKey="sim2"   name={`Sim 2 (${activeTab})`} fill="#00B1A9" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
