// pages/UjiCobaNasional.jsx — Halaman Laporan Nasional
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Users, Building2, MapPin, AlertTriangle, DollarSign } from 'lucide-react';
import { api } from '../utils/api';
import { fmtRp, fmtKasus, fmtPct, fmtB } from '../utils/formatters';

const COLORS = ['#00B1A9','#059669','#0284C7','#38BDF8','#34D399','#818CF8','#0EA5E9','#10B981'];

function StatCard({ label, value, sub, color = 'blue', Icon }) {
  return (
    <div className={`stat-card ${color}`}>
      {Icon && <div className="icon"><Icon size={22}/></div>}
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="state-container">
      <div className="loading-spinner"/>
      <span>Memuat data dari database...</span>
    </div>
  );
}

function ErrorState({ msg, onRetry }) {
  return (
    <div className="state-container">
      <AlertTriangle size={36} color="var(--accent-red)"/>
      <div className="error-box">{msg}</div>
      <button onClick={onRetry} style={{
        background:'var(--accent-blue)', color:'#fff', border:'none',
        padding:'8px 20px', borderRadius:'8px', cursor:'pointer', marginTop:8
      }}>Coba Lagi</button>
    </div>
  );
}

export default function UjiCobaNasional({ dataset, simulasi, drgType }) {
  const [summary,     setSummary]     = useState(null);
  const [byProvinsi,  setByProvinsi]  = useState([]);
  const [byKelompok,  setByKelompok]  = useState([]);
  const [byKompetensi,setByKompetensi]= useState([]);
  const [byKelas,     setByKelas]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [filterProv,  setFilterProv]  = useState('all');
  const [provOptions, setProvOptions] = useState([]);

  const params = { dataset, simulasi, drg_type: drgType };
  const pAll   = filterProv !== 'all' ? { ...params, propinsi: filterProv } : params;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, prov, kel, komp, kelas, opts] = await Promise.all([
        api.nasional.summary(pAll),
        api.nasional.byProvinsi(params),
        api.nasional.byKelompok(pAll),
        api.nasional.byKompetensi(pAll),
        api.nasional.byKelas(pAll),
        api.nasional.filterOptions({ dataset }),
      ]);
      setSummary(sum);
      setByProvinsi(prov.slice(0, 20));
      setByKelompok(kel.slice(0, 10));
      setByKompetensi(komp);
      setByKelas(kelas);
      setProvOptions(opts.provinsi_list || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataset, simulasi, drgType, filterProv]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState msg={error} onRetry={fetchAll} />;
  if (!summary) return null;

  const selisih = Number(summary.selisih);

  // Data untuk bar chart provinsi
  const provChartData = byProvinsi.map(p => ({
    name: p.propinsi?.replace('Kepulauan ', 'Kep. ')?.replace('Kalimantan', 'Kal.')?.slice(0,15) || '?',
    inacbg: fmtB(p.total_tarif_inacbg),
    idrg:   fmtB(p.total_tarif_idrg),
    kasus:  Number(p.total_kasus),
  }));

  // Data pie kelompok
  const kelPieData = byKelompok.map((k, i) => ({
    name:  k.kelompok_idrg || 'Lainnya',
    value: Number(k.total_kasus),
    fill:  COLORS[i % COLORS.length],
  }));

  return (
    <>
      {/* Filter bar */}
      <div className="filter-row">
        <span className="filter-label">Filter Provinsi:</span>
        <select
          className="styled-select"
          value={filterProv}
          onChange={e => setFilterProv(e.target.value)}
        >
          <option value="all">Semua Provinsi</option>
          {provOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>
          Sim {simulasi} | {drgType} DRG | {dataset === 'jan_des_v11' ? 'Jan–Des 2025' : 'Okt–Jun 2026'}
        </span>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          label="Total Kasus"
          value={fmtKasus(summary.total_kasus)}
          sub={`${summary.jumlah_rs?.toLocaleString()} Rumah Sakit`}
          color="blue" Icon={Users}
        />
        <StatCard
          label="Tarif INA-CBG"
          value={fmtRp(summary.total_tarif_inacbg)}
          sub="Baseline referensi"
          color="purple" Icon={DollarSign}
        />
        <StatCard
          label={`Tarif iDRG (Sim ${simulasi})`}
          value={fmtRp(summary.total_tarif_idrg)}
          sub={`${summary.jumlah_idrg_1363} kode iDRG 1363`}
          color="teal" Icon={TrendingUp}
        />
        <StatCard
          label="Selisih vs INA-CBG"
          value={fmtRp(selisih)}
          sub={fmtPct(summary.pct_selisih)}
          color={selisih >= 0 ? 'green' : 'red'} Icon={AlertTriangle}
        />
        <StatCard
          label="Jumlah Provinsi"
          value={summary.jumlah_provinsi}
          sub={`${summary.jumlah_inacbg} kode INA-CBG`}
          color="orange" Icon={MapPin}
        />
        <StatCard
          label="RS Aktif"
          value={summary.jumlah_rs?.toLocaleString()}
          sub="dalam dataset"
          color="blue" Icon={Building2}
        />
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Bar chart provinsi */}
        <div className="section">
          <div className="section-title">Tarif per Provinsi (Miliar Rp) — Top 20</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={provChartData} margin={{ top: 4, right: 8, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                formatter={(v, n) => [`${v} M`, n === 'inacbg' ? 'INA-CBG' : 'iDRG']}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
              <Bar dataKey="inacbg" name="INA-CBG" fill="#0284C7" radius={[3,3,0,0]} />
              <Bar dataKey="idrg"   name="iDRG"    fill="#00B1A9" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie kelompok */}
        <div className="section">
          <div className="section-title">Distribusi Kasus per Kelompok Layanan</div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={kelPieData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={110} innerRadius={50}
                label={({ name, percent }) => percent > 0.03 ? `${(percent*100).toFixed(0)}%` : ''}
                labelLine={false}
              >
                {kelPieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(v) => [fmtKasus(v), 'Kasus']}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom tables */}
      <div className="grid-2">
        {/* Tabel Provinsi */}
        <div className="section">
          <div className="section-title">Rincian per Provinsi</div>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provinsi</th>
                  <th className="num">RS</th>
                  <th className="num">Kasus</th>
                  <th className="num">INA-CBG</th>
                  <th className="num">iDRG</th>
                  <th className="num">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {byProvinsi.map((p, i) => {
                  const s = Number(p.selisih);
                  return (
                    <tr key={i}>
                      <td>{p.propinsi || '—'}</td>
                      <td className="num">{p.jumlah_rs?.toLocaleString()}</td>
                      <td className="num">{fmtKasus(p.total_kasus)}</td>
                      <td className="num">{fmtRp(p.total_tarif_inacbg)}</td>
                      <td className="num">{fmtRp(p.total_tarif_idrg)}</td>
                      <td className={`num ${s >= 0 ? 'positive' : 'negative'}`}>{fmtRp(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel Kompetensi + Kelas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section" style={{ flex: 1 }}>
            <div className="section-title">Distribusi per Level Kompetensi</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kompetensi</th>
                    <th className="num">RS</th>
                    <th className="num">Kasus</th>
                    <th className="num">iDRG</th>
                  </tr>
                </thead>
                <tbody>
                  {byKompetensi.map((k, i) => (
                    <tr key={i}>
                      <td>{k.klaim_kompetensi || '—'}</td>
                      <td className="num">{k.jumlah_rs?.toLocaleString()}</td>
                      <td className="num">{fmtKasus(k.total_kasus)}</td>
                      <td className="num">{fmtRp(k.total_tarif_idrg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section" style={{ flex: 1 }}>
            <div className="section-title">Distribusi per Kelas RS</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kelas</th>
                    <th className="num">RS</th>
                    <th className="num">Kasus</th>
                    <th className="num">iDRG</th>
                  </tr>
                </thead>
                <tbody>
                  {byKelas.map((k, i) => (
                    <tr key={i}>
                      <td><span className="badge blue">Kelas {k.kelas_faskes}</span></td>
                      <td className="num">{k.jumlah_rs?.toLocaleString()}</td>
                      <td className="num">{fmtKasus(k.total_kasus)}</td>
                      <td className="num">{fmtRp(k.total_tarif_idrg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
