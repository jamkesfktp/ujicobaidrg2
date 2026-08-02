// pages/DashboardStrategis.jsx — Dashboard per Rumah Sakit
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { Search, Building2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../utils/api';
import { fmtRp, fmtKasus, fmtPct } from '../utils/formatters';

const KELAS_COLOR = { A:'#0284C7', B:'#00B1A9', C:'#059669', D:'#F59E0B' };

function RsCard({ rs, onClick, selected }) {
  const s = Number(rs.selisih);
  return (
    <div
      onClick={() => onClick(rs.kode_rs)}
      style={{
        background: selected ? 'rgba(79,142,247,0.1)' : 'var(--bg-secondary)',
        border: `1px solid ${selected ? 'var(--accent-blue)' : 'var(--border)'}`,
        borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
        transition: 'all 0.15s', marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {rs.kode_rs}
          </span>
          <span className="badge blue" style={{ marginLeft: 6, fontSize: 10 }}>
            Kelas {rs.kelas_faskes}
          </span>
        </div>
        <span style={{ fontSize: 11, color: s >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {s >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
        {rs.propinsi} · {fmtKasus(rs.total_kasus)} kasus
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        iDRG: {fmtRp(rs.total_tarif_idrg)} | Selisih: <span style={{ color: s >= 0 ? 'var(--accent-green)':'var(--accent-red)' }}>{fmtRp(s)}</span>
      </div>
    </div>
  );
}

export default function DashboardStrategis({ dataset, simulasi, drgType }) {
  const [rsList,   setRsList]   = useState([]);
  const [selRs,    setSelRs]    = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [detLoading,setDetLoad] = useState(false);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState('');
  const [sortBy,   setSortBy]   = useState('total_kasus');
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterProv,  setFilterProv]  = useState('all');

  const params = { dataset, simulasi, drg_type: drgType };

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.strategis.rsList({
        ...params,
        ...(filterKelas !== 'all' ? { kelas_faskes: filterKelas } : {}),
        ...(filterProv  !== 'all' ? { propinsi: filterProv }      : {}),
      });
      setRsList(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [dataset, simulasi, drgType, filterKelas, filterProv]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSelectRs = async (kode) => {
    setSelRs(kode);
    setDetLoad(true);
    try {
      const d = await api.strategis.rsDetail(kode, params);
      setDetail(d);
    } catch (e) { console.error(e); }
    finally { setDetLoad(false); }
  };

  const sorted = [...rsList]
    .sort((a, b) => Number(b[sortBy]) - Number(a[sortBy]));
  const filtered = sorted.filter(r =>
    !search ||
    r.kode_rs?.toLowerCase().includes(search.toLowerCase()) ||
    r.propinsi?.toLowerCase().includes(search.toLowerCase())
  );

  const provList  = [...new Set(rsList.map(r => r.propinsi))].sort();
  const kelasList = [...new Set(rsList.map(r => r.kelas_faskes))].filter(Boolean).sort();

  if (error) return (
    <div className="state-container">
      <AlertTriangle size={36} color="var(--accent-red)"/>
      <div className="error-box">{error}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 130px)' }}>
      {/* ─── Panel kiri: daftar RS ─── */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Filters */}
        <div className="filter-row" style={{ flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari kode RS atau provinsi..."
              style={{
                width:'100%', paddingLeft:28, padding:'7px 10px 7px 28px',
                background:'var(--bg-secondary)', border:'1px solid var(--border)',
                borderRadius:8, color:'var(--text-primary)', fontSize:12,
                outline:'none', fontFamily:'inherit'
              }}
            />
          </div>
          <div style={{ display:'flex', gap:6, width:'100%' }}>
            <select className="styled-select" value={filterKelas} onChange={e=>setFilterKelas(e.target.value)} style={{ flex:1 }}>
              <option value="all">Semua Kelas</option>
              {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
            <select className="styled-select" value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ flex:1 }}>
              <option value="total_kasus">Sort: Kasus</option>
              <option value="total_tarif_idrg">Sort: Tarif</option>
              <option value="selisih">Sort: Selisih</option>
            </select>
          </div>
          <div style={{ fontSize:11, color:'var(--text-dim)' }}>
            {filtered.length} RS {loading ? '(loading...)' : ''}
          </div>
        </div>

        {/* Daftar RS */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            <div className="state-container" style={{ minHeight: 200 }}>
              <div className="loading-spinner"/>
            </div>
          ) : filtered.slice(0, 200).map(rs => (
            <RsCard key={rs.kode_rs} rs={rs} onClick={handleSelectRs} selected={selRs === rs.kode_rs}/>
          ))}
        </div>
      </div>

      {/* ─── Panel kanan: detail RS ─── */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {!selRs ? (
          <div className="state-container">
            <Building2 size={48} color="var(--text-dim)"/>
            <p style={{ color:'var(--text-muted)' }}>Pilih rumah sakit dari daftar kiri</p>
          </div>
        ) : detLoading ? (
          <div className="state-container"><div className="loading-spinner"/></div>
        ) : detail ? (
          <>
            {/* Header RS */}
            <div className="section" style={{ marginBottom: 14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                <div>
                  <h2 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>{detail.info?.kode_rs}</h2>
                  <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                    {detail.info?.propinsi} · {detail.info?.kabupaten} ·
                    <span className="badge blue" style={{ marginLeft:6 }}>Kelas {detail.info?.kelas_faskes}</span>
                    <span className="badge purple" style={{ marginLeft:4 }}>{detail.info?.pemilik}</span>
                    <span className="badge green" style={{ marginLeft:4 }}>{detail.info?.faskes_kompetensi}</span>
                  </div>
                </div>
              </div>

              {/* Mini stat row */}
              <div className="stats-grid" style={{ marginTop:14, marginBottom:0 }}>
                {[
                  { label:'Total Kasus', value: fmtKasus(detail.info?.total_kasus), color:'blue' },
                  { label:'INA-CBG',     value: fmtRp(detail.info?.total_tarif_inacbg), color:'purple' },
                  { label:'Tarif RS',    value: fmtRp(detail.info?.total_tarif_rs), color:'teal' },
                  { label:'iDRG',        value: fmtRp(detail.info?.total_tarif_idrg), color:'green' },
                  { label:'Selisih',     value: fmtRp(detail.info?.selisih), color: Number(detail.info?.selisih)>=0?'green':'red' },
                ].map((s,i) => (
                  <div key={i} className={`stat-card ${s.color}`} style={{ padding:'12px 14px' }}>
                    <div className="label">{s.label}</div>
                    <div className="value" style={{ fontSize:16 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabel semua simulasi */}
            {detail.simulasi_all && (
              <div className="section" style={{ marginBottom:14 }}>
                <div className="section-title">Perbandingan Semua Simulasi</div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Simulasi</th><th>Deskripsi</th><th className="num">1363 DRG</th><th className="num">1370 DRG</th></tr>
                    </thead>
                    <tbody>
                      {[
                        { sim:'Baseline', desc:'INA-CBG', v1363: detail.simulasi_all.baseline_inacbg, v1370: detail.simulasi_all.baseline_inacbg },
                        { sim:'Sim 1', desc:'CW×NBR', v1363: detail.simulasi_all.sim1_1363, v1370: detail.simulasi_all.sim1_1370 },
                        { sim:'Sim 2', desc:'CW×NBR+TopUp', v1363: detail.simulasi_all.sim2_1363, v1370: detail.simulasi_all.sim2_1370 },
                        { sim:'Sim 3', desc:'+AF Regional', v1363: detail.simulasi_all.sim3_1363, v1370: detail.simulasi_all.sim3_1370 },
                        { sim:'Sim 5', desc:'+AF Komp', v1363: detail.simulasi_all.sim5_1363, v1370: null },
                        { sim:'Sim 26', desc:'Juknis TopUp', v1363: detail.simulasi_all.sim26, v1370: null },
                        { sim:'Sim 54', desc:'BPJS TopUp', v1363: detail.simulasi_all.sim54, v1370: null },
                        { sim:'Sim 41', desc:'BPJS 1370', v1363: null, v1370: detail.simulasi_all.sim41 },
                      ].map((r,i) => (
                        <tr key={i}>
                          <td><span className="badge blue">{r.sim}</span></td>
                          <td>{r.desc}</td>
                          <td className="num">{r.v1363 ? fmtRp(r.v1363) : '—'}</td>
                          <td className="num">{r.v1370 ? fmtRp(r.v1370) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top DRG */}
            <div className="grid-2">
              <div className="section">
                <div className="section-title">Top 20 iDRG</div>
                <div className="table-wrap" style={{ maxHeight:280, overflowY:'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Kode</th><th>Deskripsi</th><th className="num">Kasus</th><th className="num">Tarif</th></tr>
                    </thead>
                    <tbody>
                      {(detail.top_drg||[]).map((d,i) => (
                        <tr key={i}>
                          <td><span className="badge blue" style={{ fontSize:10 }}>{d.idrg_code_1363}</span></td>
                          <td style={{ maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 }}>{d.deskripsi}</td>
                          <td className="num">{fmtKasus(d.kasus)}</td>
                          <td className="num">{fmtRp(d.tarif_idrg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="section">
                <div className="section-title">Top 20 INA-CBG</div>
                <div className="table-wrap" style={{ maxHeight:280, overflowY:'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Kode</th><th>Deskripsi</th><th className="num">Kasus</th></tr>
                    </thead>
                    <tbody>
                      {(detail.top_inacbg||[]).map((d,i) => (
                        <tr key={i}>
                          <td style={{ fontSize:11 }}>{d.inacbg}</td>
                          <td style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 }}>{d.deskripsi}</td>
                          <td className="num">{fmtKasus(d.kasus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
