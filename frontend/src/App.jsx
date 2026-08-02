import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Overview from './pages/Overview';
import LevelKompetensi from './pages/LevelKompetensi';
import AnalisisWilayah from './pages/AnalisisWilayah';
import HospitalDetail from './pages/HospitalDetail';
import SimulationDetail from './pages/Simulation';
import AnalisisShifting from './pages/AnalisisShifting';
import LaporanNasional from './pages/LaporanNasional';
import AnalisisMarketShare from './pages/AnalisisMarketShare';
import AnalisisIdrg from './pages/AnalisisIdrg';
import PetaIdrg from './pages/PetaIdrg';
import AnalisisInflasi from './pages/AnalisisInflasi';
import SimulasiRujukan from './pages/SimulasiRujukan';
import DashboardStrategis from './pages/DashboardStrategis';
import SimulasiKasus from './pages/SimulasiKasus';
import SimulasiLayananKhusus from './pages/SimulasiLayananKhusus';
import { RS_GROUPS, PROVINCES } from './utils/rsGroups';
import { filterHospital } from './utils/filterUtils';
import Select from 'react-select';
import { loadDatasetFile } from './utils/dataLoader';

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dataset, setDataset] = useState('jan_des_v11_1363');
  const [simulasi, setSimulasi] = useState(2);
  const [groupFilter, setGroupFilter] = useState([]);
  const [wilayahFilter, setWilayahFilter] = useState([]);
  const [kabFilter, setKabFilter] = useState([]);
  const [excludeNA, setExcludeNA] = useState(false);
  const [excludeNonKomp, setExcludeNonKomp] = useState(false);
  const [isExcludeMode, setIsExcludeMode] = useState(false);
  const [rsFilter, setRsFilter] = useState('');
  const [selectedRsObj, setSelectedRsObj] = useState(null);
  const [rsOptions, setRsOptions] = useState([]);
  const [jenisOptions, setJenisOptions] = useState([]);
  const [jenisFaskesOptions, setJenisFaskesOptions] = useState([]);
  const [kabOptions, setKabOptions] = useState([]);
  const [hospitalsData, setHospitalsData] = useState(null);
  const [globalMonth, setGlobalMonth] = useState('all');
  const [globalDrg, setGlobalDrg] = useState('all');
  const [rsKompetensiOnline, setRsKompetensiOnline] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('auth') === 'true';
  });

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setIsAuthenticated(false);
    document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  };
  
  const effectiveDataset = excludeNA ? `${dataset}_filtered` : dataset;

  useEffect(() => {
    if (!isAuthenticated) return;
    loadDatasetFile(effectiveDataset, 'hospitals')
      .then(data => {
        setHospitalsData(data);
        const options = Object.entries(data).map(([kode, rs]) => ({
          value: kode,
          label: `${rs.nama || 'Unknown'} (${kode})`
        }));
        setRsOptions(options);

        const uniqueJenis = [...new Set(Object.values(data).map(rs => rs.jenis).filter(j => j && j !== 'UNKNOWN'))].sort();
        setJenisOptions(uniqueJenis.map(j => ({ value: 'jenis_' + j, label: `Jenis: ${j}` })));
        
        const uniqueJenisFaskes = [...new Set(Object.values(data).map(rs => rs.jenisFaskes).filter(j => j && j !== 'UNKNOWN'))].sort();
        setJenisFaskesOptions(uniqueJenisFaskes.map(j => ({ value: 'jenisfaskes_' + j, label: `Faskes: ${j}` })));
      })
      .catch(console.error);

    fetch('/data/rs_kompetensi_online.json.gz')
      .then(async r => {
        if (!r.ok) {
          return fetch('/data/rs_kompetensi_online.json').then(res => res.json());
        }
        try {
          const ds = new DecompressionStream('gzip');
          const blob = await r.blob();
          const decompressed = blob.stream().pipeThrough(ds);
          const text = await new Response(decompressed).text();
          return JSON.parse(text);
        } catch (e) {
          // If browser or server already decompressed it or error
          return fetch('/data/rs_kompetensi_online.json').then(res => res.json());
        }
      })
      .then(data => setRsKompetensiOnline(data || {}))
      .catch(err => console.error("Failed to load rs_kompetensi_online:", err));
  }, [effectiveDataset, isAuthenticated]);

  useEffect(() => {
    if (!hospitalsData) return;
    let filtered = Object.values(hospitalsData);
    
    if (wilayahFilter && wilayahFilter.length > 0) {
      filtered = filtered.filter(rs => filterHospital(rs, rs.kode || '', [], wilayahFilter, '', false, null, false));
    }
    
    const uniqueKab = [...new Set(filtered.map(rs => rs.kab).filter(k => k && k !== 'UNKNOWN'))].sort();
    setKabOptions(uniqueKab.map(k => ({ value: k, label: k })));
  }, [hospitalsData, wilayahFilter]);

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <React.Fragment>
      <div className="app-container">
        <Sidebar 
          mobileMenuOpen={mobileMenuOpen} 
          setMobileMenuOpen={setMobileMenuOpen}
          globalMonth={globalMonth}
          setGlobalMonth={setGlobalMonth}
          globalDrg={globalDrg}
          setGlobalDrg={setGlobalDrg}
        />
        <div className="main-content">
          {/* ── Header ── */}
          <div className="top-header-container">
            <div className="header-top-row">
              <div className="header-title-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="mobile-menu-btn mobile-only" onClick={() => setMobileMenuOpen(true)}>
                    <Menu size={24} />
                  </button>
                  <div className="header-title-text">
                    <h1>Dashboard Analisis</h1>
                    <p>Simulasi Perubahan Tarif INA-CBG</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', marginLeft: 'auto'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
              <div className="filters-container">
                <select className="styled-select" value={dataset} onChange={(e) => {
                  const val = e.target.value;
                  setDataset(val);
                  if (val.includes('1363')) setSimulasi(54);
                  if (val.includes('1370')) setSimulasi(41);
                }}>
                  <option value="jan_des_v11_1363">📊 Jan-Des 2025 (jan_des_v11) — 1363 DRG</option>
                  <option value="jan_des_v11_1370">📊 Jan-Des 2025 (jan_des_v11) — 1370 DRG</option>
                  <option value="okt_jun_v3_1363">📋 Okt-Jun (okt_jun_v3) — 1363 DRG</option>
                  <option value="okt_jun_v3_1370">📋 Okt-Jun (okt_jun_v3) — 1370 DRG</option>
                </select>
                <select className="styled-select" value={simulasi} onChange={(e) => setSimulasi(Number(e.target.value))}>
                  <option value={1}>Sim 1: CW × NBR</option>
                  <option value={2}>Sim 2: CW × NBR + Top Up</option>
                  <option value={3}>Sim 3: CW × NBR × AF Regional + Top Up</option>
                  <option value={4}>Sim 4: CW × NBR × AF Komp. Layanan + Top Up</option>
                  <option value={5}>Sim 5: CW × NBR × AF Regional × AF Komp. RS + Top Up</option>
                  <option value={6}>Sim 6: CW × NBR × AF Kepemilikan RS + Top Up</option>
                  <option value={7}>Sim 7: CW × NBR × AF Regional × AF Kepemilikan RS + Top Up</option>
                  <option value={8}>Sim 8: CW × NBR × AF Regional × AF Komp. RS × AF Kepemilikan RS + Top Up</option>
                  {Array.from({length: 52}, (_, i) => i + 9).map(num => {
                    let label = `Sim ${num}`;
                    if (num === 54) label += ' (Top Up BPJS 1363)';
                    if (num === 26) label += ' (Top Up Juknis 1363)';
                    if (num === 41) label += ' (Top Up BPJS 1370)';
                    if (num === 10) label += ' (Top Up Juknis 1370)';
                    return <option key={num} value={num}>{label}</option>;
                  })}
                  <option value={61}>Sim 61: Tarifbaru (Tarif 2 × Adj Factor)</option>
                </select>
                <div style={{ width: '250px', zIndex: 100 }}>
                  <Select
                    isMulti
                    isClearable
                    placeholder="Semua Wilayah"
                    options={[
                      { value: 'UJI_COBA', label: 'Wilayah Uji Coba' },
                      { value: 'JABODETABEK', label: 'JABODETABEK' },
                      { value: 'Jabar ex Bebodepok', label: 'Jabar ex Bebodepok' },
                      ...PROVINCES.map(prov => ({ value: prov, label: prov }))
                    ]}
                    value={wilayahFilter.map(w => ({ value: w, label: w === 'UJI_COBA' ? 'Wilayah Uji Coba' : (w === 'JABODETABEK' ? 'JABODETABEK' : (w === 'Jabar ex Bebodepok' ? 'Jabar ex Bebodepok' : w)) }))}
                    onChange={(selected) => {
                      setWilayahFilter(selected ? selected.map(s => s.value) : []);
                    }}
                    menuPortalTarget={document.body}
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        fontSize: '0.85rem',
                        background: 'rgba(255,255,255,0.8)',
                        minHeight: '36px'
                      }),
                      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                      menu: (base) => ({ ...base, fontSize: '0.85rem' })
                    }}
                  />
                </div>
                <div style={{ width: '250px', zIndex: 99 }}>
                  <Select
                    isMulti
                    isClearable
                    placeholder="Semua Kab/Kota"
                    options={kabOptions}
                    value={kabFilter.map(k => ({ value: k, label: k }))}
                    onChange={(selected) => {
                      setKabFilter(selected ? selected.map(s => s.value) : []);
                    }}
                    menuPortalTarget={document.body}
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        fontSize: '0.85rem',
                        background: 'rgba(255,255,255,0.8)',
                        minHeight: '36px'
                      }),
                      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                      menu: (base) => ({ ...base, fontSize: '0.85rem' })
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ── Simulasi Info Banner ── */}
            {(() => {
              const simDesc = {
                1: { label: 'Simulasi 1', formula: 'CW × NBR', color: '#1abc9c' },
                2: { label: 'Simulasi 2', formula: 'CW × NBR + Top Up', color: '#3498db' },
                3: { label: 'Simulasi 3', formula: 'CW × NBR × AF Regionalisasi + Top Up', color: '#9b59b6' },
                4: { label: 'Simulasi 4', formula: 'CW × NBR × AF Kompetensi Layanan + Top Up', color: '#e67e22' },
                5: { label: 'Simulasi 5', formula: 'CW × NBR × AF Regionalisasi × AF Kompetensi Layanan RS + Top Up', color: '#e74c3c' },
                6: { label: 'Simulasi 6', formula: 'CW × NBR × AF Kepemilikan RS + Top Up', color: '#27ae60' },
                7: { label: 'Simulasi 7', formula: 'CW × NBR × AF Regionalisasi × AF Kepemilikan RS + Top Up', color: '#2980b9' },
                8: { label: 'Simulasi 8', formula: 'CW × NBR × AF Regionalisasi × AF Kompetensi Layanan RS × AF Kepemilikan RS + Top Up', color: '#c0392b' },
                61: { label: 'Simulasi 61: Tarifbaru', formula: 'Tarif 2 × Adjustment Factor (per DRG)', color: '#8e44ad' },
              };
              for (let i = 9; i <= 60; i++) {
                simDesc[i] = { label: `Simulasi ${i}`, formula: 'Dari dataset', color: '#607d8b' };
              }
              const info = simDesc[simulasi];
              if (!info) return null;
              return (
                <div style={{
                  background: `${info.color}18`,
                  border: `1px solid ${info.color}55`,
                  borderRadius: '8px',
                  padding: '6px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.82rem',
                  margin: '0 24px 0 24px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 800, color: info.color, whiteSpace: 'nowrap' }}>{info.label}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>= {info.formula}</span>
                </div>
              );
            })()}

            {/* ── Checkboxes Row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.4)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--glass-border)', marginTop: '16px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '8px' }}>Penyaringan Tambahan:</div>
              <label className={`custom-checkbox-label ${excludeNA ? 'active' : ''}`}>
                <input 
                  type="checkbox" 
                  className="custom-checkbox-input"
                  checked={excludeNA} 
                  onChange={(e) => setExcludeNA(e.target.checked)} 
                />
                Kecualikan N/A (Klaim)
              </label>

              <label className={`custom-checkbox-label ${excludeNonKomp ? 'active' : ''}`}>
                <input 
                  type="checkbox" 
                  className="custom-checkbox-input"
                  checked={excludeNonKomp} 
                  onChange={(e) => setExcludeNonKomp(e.target.checked)} 
                />
                Kecualikan Belum Ada Kompetensi
              </label>
            </div>

            {/* ── Additional Filters Row ── */}
            <div className="filters-row" style={{ marginTop: '16px' }}>
              <label className={`custom-checkbox-label ${isExcludeMode ? 'active' : ''}`}>
                <input 
                  type="checkbox" 
                  className="custom-checkbox-input"
                  checked={isExcludeMode} 
                  onChange={(e) => setIsExcludeMode(e.target.checked)} 
                />
                Mode Exclude RS/Kelompok
              </label>

              <div style={{ width: '300px', zIndex: 50 }}>
                <Select
                  isClearable
                  placeholder="Cari & Pilih RS..."
                  options={rsOptions}
                  value={selectedRsObj}
                  onChange={(selected) => {
                    setSelectedRsObj(selected);
                    setRsFilter(selected ? selected.value : '');
                  }}
                  menuPortalTarget={document.body}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      fontSize: '0.85rem',
                      background: 'rgba(255,255,255,0.8)',
                      minHeight: '36px'
                    }),
                    menuPortal: (base) => ({
                      ...base,
                      zIndex: 9999
                    }),
                    menu: (base) => ({
                      ...base,
                      fontSize: '0.85rem'
                    })
                  }}
                />
              </div>
              <div style={{ width: '220px', marginLeft: '12px', zIndex: 50 }}>
                <Select
                  isMulti
                  isClearable
                  placeholder="Semua Kepemilikan"
                  options={RS_GROUPS.map(g => ({ value: g.key, label: g.label }))}
                  value={
                    groupFilter
                      .filter(val => !val.startsWith('jenis_') && !val.startsWith('jenisfaskes_'))
                      .map(val => {
                        const groupMatch = RS_GROUPS.find(g => g.key === val);
                        return { value: val, label: groupMatch ? groupMatch.label : val };
                      })
                  }
                  onChange={(selected) => {
                    const newGroups = selected ? selected.map(s => s.value) : [];
                    const existingJenis = groupFilter.filter(k => k.startsWith('jenis_') || k.startsWith('jenisfaskes_'));
                    setGroupFilter([...newGroups, ...existingJenis]);
                  }}
                  menuPortalTarget={document.body}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      fontSize: '0.85rem',
                      background: 'rgba(255,255,255,0.8)',
                      minHeight: '36px'
                    }),
                    menuPortal: (base) => ({ zIndex: 9999, ...base }),
                    menu: (base) => ({ ...base, fontSize: '0.85rem' }),
                    multiValue: (base) => ({ ...base, backgroundColor: 'rgba(41, 128, 185, 0.1)', borderRadius: '4px' })
                  }}
                />
              </div>
              <div style={{ width: '200px', marginLeft: '8px', zIndex: 50 }}>
                <Select
                  isMulti
                  isClearable
                  placeholder="Semua Jenis RS"
                  options={jenisOptions}
                  value={
                    groupFilter
                      .filter(val => val.startsWith('jenis_'))
                      .map(val => ({ value: val, label: `Jenis: ${val.replace('jenis_', '')}` }))
                  }
                  onChange={(selected) => {
                    const newJenis = selected ? selected.map(s => s.value) : [];
                    const existingGroups = groupFilter.filter(k => !k.startsWith('jenis_'));
                    setGroupFilter([...existingGroups, ...newJenis]);
                  }}
                  menuPortalTarget={document.body}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      fontSize: '0.85rem',
                      background: 'rgba(255,255,255,0.8)',
                      minHeight: '36px'
                    }),
                    menuPortal: (base) => ({ zIndex: 9999, ...base }),
                    menu: (base) => ({ ...base, fontSize: '0.85rem' }),
                    multiValue: (base) => ({ ...base, backgroundColor: 'rgba(41, 128, 185, 0.1)', borderRadius: '4px' })
                  }}
                />
              </div>
              <div style={{ width: '200px', marginLeft: '8px', zIndex: 50 }}>
                <Select
                  isMulti
                  isClearable
                  placeholder="Semua Jenis Faskes"
                  options={jenisFaskesOptions}
                  value={
                    groupFilter
                      .filter(val => val.startsWith('jenisfaskes_'))
                      .map(val => ({ value: val, label: `Faskes: ${val.replace('jenisfaskes_', '')}` }))
                  }
                  onChange={(selected) => {
                    const newJenisFaskes = selected ? selected.map(s => s.value) : [];
                    const existingGroups = groupFilter.filter(k => !k.startsWith('jenisfaskes_'));
                    setGroupFilter([...existingGroups, ...newJenisFaskes]);
                  }}
                  menuPortalTarget={document.body}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      fontSize: '0.85rem',
                      background: 'rgba(255,255,255,0.8)',
                      minHeight: '36px'
                    }),
                    menuPortal: (base) => ({ zIndex: 9999, ...base }),
                    menu: (base) => ({ ...base, fontSize: '0.85rem' }),
                    multiValue: (base) => ({ ...base, backgroundColor: 'rgba(46, 204, 113, 0.1)', borderRadius: '4px' })
                  }}
                />
              </div>

              <div style={{ width: '200px', marginLeft: '8px', zIndex: 50 }}>
                <Select
                  isMulti
                  isClearable
                  placeholder="Semua Layanan Klinis"
                  options={[
                    'Alergi Imunologi dan Rheumatologi', 'Endokrin, Nutrisi dan Metabolik', 'Forensik', 'Gigi dan Mulut',
                    'Hematologi', 'Ibu dan Ginekologi', 'Infeksi dan Parasit', 'Jantung dan Pembuluh Darah',
                    'Jiwa', 'Keracunan', 'Kulit & Penyakit Kelamin', 'Luka Bakar', 'Mata',
                    'Musculoskeletal dan Jaringan Lunak', 'Neonatus', 'Neoplasma', 'Paru dan Pernafasan',
                    'Pencernaan dan Hepatobilier', 'Rehabilitasi', 'Rekonstruksi dan Estetika',
                    'Saraf/ Neuroscience', 'THT', 'Trauma', 'Uro Nefro'
                  ].map(l => ({ value: 'layanan_' + l.toLowerCase(), label: l }))}
                  value={
                    groupFilter
                      .filter(val => val.startsWith('layanan_'))
                      .map(val => {
                        const raw = val.replace('layanan_', '');
                        const label = raw.replace(/\b\w/g, c => c.toUpperCase()).replace('Tht', 'THT');
                        return { value: val, label: label };
                      })
                  }
                  onChange={(selected) => {
                    const newLayanan = selected ? selected.map(s => s.value) : [];
                    const existingGroups = groupFilter.filter(k => !k.startsWith('layanan_'));
                    setGroupFilter([...existingGroups, ...newLayanan]);
                  }}
                  menuPortalTarget={document.body}
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      fontSize: '0.85rem',
                      background: 'rgba(255,255,255,0.8)',
                      minHeight: '36px'
                    }),
                    menuPortal: (base) => ({ zIndex: 9999, ...base }),
                    menu: (base) => ({ ...base, fontSize: '0.85rem' }),
                    multiValue: (base) => ({ ...base, backgroundColor: 'rgba(243, 156, 18, 0.1)', borderRadius: '4px' })
                  }}
                />
              </div>
{groupFilter && groupFilter.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: isExcludeMode ? '#e74c3c' : '#8e44ad', fontStyle: 'italic', fontWeight: 600 }}>
                  — {isExcludeMode ? 'Mengecualikan' : 'Menampilkan'} data untuk: <b>{
                    groupFilter.map(val => {
                      const match = RS_GROUPS.find(g => g.key === val);
                      return match ? match.label : val.replace('jenis_', '');
                    }).join(', ')
                  }</b>
                </span>
              )}
            </div>
          </div>

          {/* ── Routes ── */}
          <Routes>
            <Route path="/" element={<Overview dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/nasional" element={<LaporanNasional dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/kompetensi" element={<LevelKompetensi dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/market-share" element={<AnalisisMarketShare dataset={dataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/wilayah" element={<AnalisisWilayah dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/shifting" element={<AnalisisShifting dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/layanan" element={<HospitalDetail dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/simulasi" element={<SimulationDetail dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/idrg" element={<AnalisisIdrg dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/peta" element={<PetaIdrg dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/inflasi" element={<AnalisisInflasi excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/rujukan" element={<SimulasiRujukan dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/strategis-rs" element={<DashboardStrategis dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/simulasi-kasus" element={<SimulasiKasus dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
            <Route path="/layanan-khusus" element={<SimulasiLayananKhusus dataset={effectiveDataset} simulasi={simulasi} groupFilter={groupFilter} wilayahFilter={wilayahFilter} rsFilter={rsFilter} isExcludeMode={isExcludeMode} kabFilter={kabFilter} excludeNonKomp={excludeNonKomp} globalMonth={globalMonth} globalDrg={globalDrg} rsKompetensiOnline={rsKompetensiOnline} />} />
          </Routes>
        </div>
      </div>
    </React.Fragment>
  );
}

export default App;
