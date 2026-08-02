// pages/PetaIdrg.jsx — Peta distribusi iDRG per provinsi
import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { api } from '../utils/api';
import { fmtRp, fmtKasus } from '../utils/formatters';

// Peta sederhana berbasis tabel provinsi (tanpa leaflet untuk menghindari dependency kompleks)
// Bisa diupgrade ke Leaflet choropleth dengan menambah: npm install leaflet react-leaflet

function ProvinceBar({ prov, maxKasus, color }) {
  const pct = maxKasus > 0 ? (Number(prov.total_kasus) / maxKasus) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--text-primary)', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prov.propinsi}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtKasus(prov.total_kasus)} kasus
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color || 'var(--accent-blue)' }} />
      </div>
    </div>
  );
}

export default function PetaIdrg({ dataset, simulasi, drgType }) {
  const [provData,   setProvData]   = useState([]);
  const [inacbgList, setInacbgList] = useState([]);
  const [mapping,    setMapping]    = useState([]);
  const [selInacbg,  setSelInacbg]  = useState('');
  const [searchIna,  setSearchIna]  = useState('');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const params = { dataset, simulasi, drg_type: drgType };

  const fetchBase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prov, ina] = await Promise.all([
        api.peta.byIdrg(params),
        api.peta.inacbgList({ dataset }),
      ]);
      setProvData(prov);
      setInacbgList(ina);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataset, simulasi, drgType]);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  const handleSelectInacbg = async (inacbg) => {
    setSelInacbg(inacbg);
    if (!inacbg) { setMapping([]); return; }
    try {
      const data = await api.peta.inacbg({ dataset, inacbg });
      setMapping(data);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <div className="state-container">
      <div className="loading-spinner"/>
      <span>Memuat data peta...</span>
    </div>
  );
  if (error) return (
    <div className="state-container">
      <AlertTriangle size={36} color="var(--accent-red)"/>
      <div className="error-box">{error}</div>
    </div>
  );

  const maxKasus = Math.max(...provData.map(p => Number(p.total_kasus)));
  const filteredIna = inacbgList.filter(i =>
    !searchIna ||
    i.inacbg?.toLowerCase().includes(searchIna.toLowerCase()) ||
    i.deskripsi?.toLowerCase().includes(searchIna.toLowerCase())
  );

  const BLUES = ['#1a52b3','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe'];

  return (
    <>
      <div className="grid-2">
        {/* Kiri: distribusi provinsi */}
        <div className="section">
          <div className="section-title">🗺️ Distribusi Kasus per Provinsi</div>
          <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 8 }}>
            {provData.map((p, i) => (
              <ProvinceBar
                key={p.propinsi}
                prov={p}
                maxKasus={maxKasus}
                color={BLUES[Math.min(i, BLUES.length-1)]}
              />
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Provinsi</th>
                  <th className="num">RS</th>
                  <th className="num">Kasus</th>
                  <th className="num">Total Tarif</th>
                </tr>
              </thead>
              <tbody>
                {provData.slice(0, 10).map((p, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-dim)' }}>{i+1}</td>
                    <td>{p.propinsi}</td>
                    <td className="num">{p.jumlah_rs}</td>
                    <td className="num">{fmtKasus(p.total_kasus)}</td>
                    <td className="num">{fmtRp(p.total_tarif)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kanan: lookup INA-CBG → iDRG */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section">
            <div className="section-title">🔍 Lookup INA-CBG → iDRG</div>

            {/* Search INA-CBG */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}/>
              <input
                type="text"
                placeholder="Cari kode atau nama INA-CBG..."
                value={searchIna}
                onChange={e => setSearchIna(e.target.value)}
                style={{
                  width: '100%', paddingLeft: 32, padding: '7px 12px 7px 32px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
                  outline: 'none', fontFamily: 'inherit'
                }}
              />
            </div>

            <select
              className="styled-select"
              style={{ width: '100%', maxWidth: '100%' }}
              value={selInacbg}
              onChange={e => handleSelectInacbg(e.target.value)}
              size={6}
            >
              <option value="">(Pilih INA-CBG)</option>
              {filteredIna.slice(0, 200).map(i => (
                <option key={i.inacbg} value={i.inacbg}>
                  {i.inacbg} — {i.deskripsi?.slice(0, 50)} ({fmtKasus(i.total_kasus)})
                </option>
              ))}
            </select>
          </div>

          {/* Hasil mapping */}
          {mapping.length > 0 && (
            <div className="section">
              <div className="section-title">
                iDRG untuk INA-CBG: <span style={{ color: 'var(--accent-blue)' }}>{selInacbg}</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Kode iDRG</th>
                      <th>Deskripsi</th>
                      <th>Kelompok</th>
                      <th className="num">Kasus</th>
                      <th className="num">RS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapping.map((m, i) => (
                      <tr key={i}>
                        <td><span className="badge blue">{m.idrg_code}</span></td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.deskripsi}
                        </td>
                        <td style={{ fontSize: 11 }}>{m.kelompok}</td>
                        <td className="num">{fmtKasus(m.total_kasus)}</td>
                        <td className="num">{m.jumlah_rs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selInacbg && mapping.length === 0 && (
            <div className="section" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
              Tidak ada mapping iDRG untuk {selInacbg} di dataset ini
            </div>
          )}
        </div>
      </div>
    </>
  );
}
