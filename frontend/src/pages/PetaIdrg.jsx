import React, { useState, useEffect } from 'react';
import { Download, Search, AlertCircle, Network, Layers, ListTree, Activity, CheckCircle2, Presentation, AlertTriangle } from 'lucide-react';
import Tree from 'react-d3-tree';
import Select from 'react-select';
import DownloadExcelButton from '../components/DownloadExcelButton';
import { formatFullCurrency, KELOMPOK_LAYANAN } from '../utils/formatters';
import { useSortableTable } from '../hooks/useSortableTable';
import PresentationModeView from './PresentationModeView';
import { loadDatasetFile } from '../utils/dataLoader';


const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;
  const tokenize = (str) => {
    return new Set(str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  };
  const set1 = tokenize(str1);
  const set2 = tokenize(str2);
  if (set1.size === 0 || set2.size === 0) return 0;
  
  let intersection = 0;
  for (let word of set1) {
    if (set2.has(word)) intersection++;
  }
  return intersection / Math.max(set1.size, set2.size);
};

export const getExcelData = (selectedData, globalTarifMap) => {
  if (!selectedData) return [];
  const wsData = [
    ['Kode INA-CBG', 'Deskripsi INA-CBG', 'Kelompok Layanan', 'Total Kasus Induk', 'Tarif INA-CBG (RS Kelas A Reg 1)']
  ];
  const idrgsToUse = selectedData.filteredIdrgs || selectedData.idrgs;
  const totalCases = Object.values(idrgsToUse).reduce((sum, i) => sum + i.kasus, 0);
  const rsATarifIna = globalTarifMap.inacbg[selectedData.inacbg] || 0;
  
  // Ambil kelompok dari idrg pertama jika ada, atau gabungkan
  const idrgValues = Object.values(idrgsToUse);
  const firstKelompok = idrgValues.length > 0 ? idrgValues[0].kelompok : 'Unknown';

  wsData.push([
    selectedData.inacbg,
    selectedData.desc_inacbg !== '-' ? selectedData.desc_inacbg : 'Deskripsi tidak tersedia',
    firstKelompok,
    totalCases,
    rsATarifIna
  ]);
  
  wsData.push([]);
  wsData.push(['Kode iDRG', 'Deskripsi iDRG', 'Jumlah Kasus', 'Proporsi (%)', 'Tarif iDRG']);
  
  const sortedIdrgs = Object.entries(idrgsToUse).sort((a,b) => b[1].kasus - a[1].kasus);
  sortedIdrgs.forEach(([idrgCode, idrgData]) => {
    const prop = totalCases > 0 ? ((idrgData.kasus / totalCases) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0;
    const rsATarifIdrg = globalTarifMap.idrg[idrgCode] || 0;
    wsData.push([
      idrgCode,
      idrgData.deskripsi || idrgData.desc_idrg || '-',
      idrgData.kasus,
      prop,
      rsATarifIdrg
    ]);
  });
  return wsData;
};

const DetailModeView = ({ selectedDetailInacbg, setSelectedDetailInacbg, inacbgOptions, globalTarifMap, tarifLabel, exportToExcel, kelompokOptions, selectedKelompok, setSelectedKelompok , globalMonth, globalDrg}) => {
  const selectedData = selectedDetailInacbg?.item;

  React.useEffect(() => {
    if (selectedDetailInacbg && inacbgOptions.length > 0) {
       const stillExists = inacbgOptions.find(o => o.value === selectedDetailInacbg.value);
       if (!stillExists) {
          setSelectedDetailInacbg(null);
       }
    }
  }, [inacbgOptions, selectedDetailInacbg, setSelectedDetailInacbg]);

  const idrgList = React.useMemo(() => {
    if (!selectedData) return [];
    const idrgsToUse = selectedData.filteredIdrgs || selectedData.idrgs;
    const totalCases = Object.values(idrgsToUse).reduce((sum, i) => sum + i.kasus, 0);
    return Object.entries(idrgsToUse).map(([idrgCode, idrgData]) => {
      const prop = totalCases > 0 ? ((idrgData.kasus / totalCases) * 100) : 0;
      const rsATarifIdrg = globalTarifMap.idrg[idrgCode] || 0;
      const idrgDesc = idrgData.deskripsi || idrgData.desc_idrg || '-';
      const isDifferent = selectedData.desc_inacbg !== '-' && calculateSimilarity(selectedData.desc_inacbg, idrgDesc) < 0.2;
      return {
        idrgCode,
        ...idrgData,
        prop,
        rsATarifIdrg,
        idrgDesc,
        isDifferent
      };
    });
  }, [selectedData, globalTarifMap]);

  const { items: sortedTableData, requestSort, getSortIndicator } = useSortableTable(idrgList, { key: 'kasus', direction: 'descending' });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1 }}>
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={20} color="var(--primary-color)" />
          Pilih INA-CBG untuk Rincian Detail
        </h3>
        
        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '250px', flex: '1 1 250px' }}>
            <Select 
              options={kelompokOptions}
              value={kelompokOptions.find(o => o.value === selectedKelompok) || kelompokOptions[0]}
              onChange={opt => setSelectedKelompok(opt ? opt.value : '')}
              isSearchable
              styles={{ 
                control: (base) => ({ ...base, minHeight: '42px', borderRadius: '8px', borderColor: 'var(--border-color)', boxShadow: 'none', '&:hover': { borderColor: 'var(--primary-color)' } }),
                option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'var(--bg-app)' : 'white', color: 'var(--text-primary)' }),
                menu: (base) => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>
          
          <div style={{ flex: '2 1 400px' }}>
            <Select 
              options={inacbgOptions}
              value={selectedDetailInacbg}
              onChange={setSelectedDetailInacbg}
              placeholder="Ketik Kode atau Deskripsi INA-CBG..."
              isSearchable
              styles={{ 
                control: (base) => ({ ...base, minHeight: '42px', borderRadius: '8px', borderColor: 'var(--border-color)', boxShadow: 'none', '&:hover': { borderColor: 'var(--primary-color)' } }),
                option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'var(--bg-app)' : 'white', color: 'var(--text-primary)' }),
                menu: (base) => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>
        </div>
      </div>

      {!selectedData ? (
        <div className="card fade-in" style={{ flexGrow: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
           <h4 style={{ margin: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Activity size={18} />
             Menampilkan {inacbgOptions.length} Group INA-CBG 
             {selectedKelompok ? ` untuk kompetensi ${selectedKelompok}` : ''}
           </h4>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', overflowY: 'auto', maxHeight: '600px', paddingRight: '8px', marginTop: '12px' }}>
             {inacbgOptions.map(opt => (
               <div 
                 key={opt.value} 
                 className="card hover-elevate" 
                 onClick={() => setSelectedDetailInacbg(opt)}
                 style={{ padding: '16px', cursor: 'pointer', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
               >
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <strong style={{ color: 'var(--primary-color)', fontSize: '1.2rem', letterSpacing: '0.5px' }}>{opt.item.inacbg}</strong>
                   <span className="badge badge-outline" style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '12px' }}>{opt.item.kelompoks ? opt.item.kelompoks[0] : 'Unknown'}{opt.item.kelompoks && opt.item.kelompoks.length > 1 ? ', ...' : ''}</span>
                 </div>
                 <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                   {opt.item.desc_inacbg !== '-' ? opt.item.desc_inacbg : 'Tanpa Deskripsi'}
                 </span>
                 <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                   <span>Total Kasus:</span>
                   <strong style={{ color: 'var(--text-primary)' }}>{Object.values(opt.item.idrgs).reduce((s, i) => s + i.kasus, 0).toLocaleString()}</strong>
                 </div>
               </div>
             ))}
           </div>
        </div>
      ) : (
        <div className="card fade-in" style={{ padding: '0', flexGrow: 1, overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(41, 128, 185, 0.05) 0%, rgba(142, 68, 173, 0.05) 100%)', padding: '32px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ flex: '1 1 400px' }}>
                <button 
                  onClick={() => setSelectedDetailInacbg(null)} 
                  style={{ marginBottom: '16px', padding: '8px 16px', background: 'var(--primary-color)', borderRadius: '6px', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                  Kembali ke Menu Awal Peta iDRG
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h2 style={{ color: 'var(--primary-color)', margin: 0, fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-1px' }}>{selectedData.inacbg}</h2>
                  <span className="badge badge-outline" style={{ fontSize: '14px', padding: '6px 14px', borderRadius: '20px', background: 'white' }}>
                    <CheckCircle2 size={14} style={{ marginRight: '6px', color: '#27ae60' }} />
                    {selectedKelompok || 'Multi-Layanan'}
                  </span>
                </div>
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.4 }}>
                  {selectedData.desc_inacbg !== '-' ? selectedData.desc_inacbg : 'Deskripsi tidak tersedia'}
                </h4>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '40px', background: 'white', padding: '16px 24px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Total Kasus Induk</p>
                  <h3 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                    {(() => {
                      const totalCases = Object.values(selectedData.filteredIdrgs || selectedData.idrgs).reduce((sum, i) => sum + i.kasus, 0);
                      return totalCases.toLocaleString();
                    })()}
                  </h3>
                </div>
                <div style={{ paddingLeft: '40px', borderLeft: '2px dashed var(--border-color)' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{tarifLabel || "Tarif INA-CBG (RS A, Reg 1, Kelas 3)"}</p>
                  <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#e67e22', fontWeight: 800 }}>
                    {formatFullCurrency(globalTarifMap.inacbg[selectedData.inacbg] || 0)}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.4rem' }}>
                <Layers size={24} color="var(--primary-color)" />
                Rincian Pemetaan ke iDRG
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>({Object.keys(selectedData.filteredIdrgs || selectedData.idrgs).length} Group)</span>
              </h3>
              <DownloadExcelButton headers={[]} data={getExcelData(selectedData, globalTarifMap)} filename={`Pemetaan_${selectedData.inacbg}.xlsx`} />
            </div>
            
            <div className="table-container" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}><tr style={{ borderBottom: '1px solid var(--glass-border)' }}> <th onClick={() => requestSort('idrgCode')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Kode iDRG {getSortIndicator('idrgCode')}</th>
                  <th onClick={() =>requestSort('idrgDesc')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Deskripsi {getSortIndicator('idrgDesc')}</th>
                  <th onClick={() =>requestSort('rsATarifIdrg')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Tarif iDRG {getSortIndicator('rsATarifIdrg')}</th>
                  <th onClick={() => requestSort('kasus')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Jumlah Kasus {getSortIndicator('kasus')}</th>
                  <th onClick={() => requestSort('prop')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', userSelect: 'none' }}>Proporsi {getSortIndicator('prop')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedTableData.map((d) => {
                    return (
                      <tr key={d.idrgCode} style={{ transition: 'all 0.2s ease', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(41, 128, 185, 0.02)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ fontWeight: 800, color: 'var(--primary-color)', padding: '16px 24px', fontSize: '1.05rem' }}>{d.idrgCode}</td>
                        <td style={{ fontWeight: 500, color: 'var(--text-secondary)', padding: '16px 24px', lineHeight: 1.5 }}>
                          {d.idrgDesc}
                          {d.isDifferent && (
                            <div style={{ marginTop: '8px' }}>
                              <span style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#fee2e2', color: '#ef4444', borderRadius: '4px', fontWeight: 600, border: '1px solid #fca5a5' }}>
                                ⚠️ Deskripsi Berbeda dari INA-CBG
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#e67e22', padding: '16px 24px', fontSize: '1.05rem' }}>{formatFullCurrency(d.rsATarifIdrg)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, padding: '16px 24px', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{d.kasus.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                            <span style={{ fontWeight: 700, minWidth: '45px', color: 'var(--text-primary)' }}>{d.prop.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</span>
                            <div style={{ width: '100px', height: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                              <div style={{ width: `${d.prop}%`, height: '100%', background: 'linear-gradient(90deg, #3498db, #2980b9)', borderRadius: '6px' }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

const PetaIdrg = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter, globalMonth, globalDrg }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInacbg, setSearchInacbg] = useState('');
  const [selectedKelompok, setSelectedKelompok] = useState('');
  
  // View mode state
  const [viewMode, setViewMode] = useState('presentation'); // 'presentation' | 'detail' | 'mindmap'
  const [selectedDetailInacbg, setSelectedDetailInacbg] = useState(null);
  const [globalTarifMap, setGlobalTarifMap] = useState({ inacbg: {}, idrg: {} });
  
  // Regional Tarif
  const [selectedKepemilikan, setSelectedKepemilikan] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('');
  const [selectedKelasRawat, setSelectedKelasRawat] = useState('');
  const [regionalTarifMap, setRegionalTarifMap] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'inacbg_to_drg', globalMonth, globalDrg),
      fetch(`/data/inacbg_desc_map.json?v=${Date.now()}`).then(res => res.json()).catch(() => ({})),
      fetch(`/data/tarif_map.json?v=${Date.now()}`).then(res => res.json()).catch(() => ({ inacbg: {}, idrg: {} })),
      loadDatasetFile(dataset, 'drg_analysis', globalMonth, globalDrg).catch(() => ({})),
      fetch(`/data/tarif_inacbg_regional.json?v=${Date.now()}`).then(res => res.json()).catch(() => ({}))
    ])
      .then(([json, descMap, tarifMap, drgAnalysis, regionalMap]) => {
        if (!json) {
          console.error('inacbg_to_drg data failed to load (null)');
          setLoading(false);
          return;
        }
        const transformedData = Object.entries(json).map(([inacbgCode, idrgMap]) => {
          const kelompokSet = new Set();
          Object.entries(idrgMap).forEach(([drgCode, i]) => {
             if (i.kelompok && i.kelompok !== 'Unknown') kelompokSet.add(i.kelompok);
             // Also include all kelompok from drg_analysis byKelompok for this DRG
             const drgNode = drgAnalysis[drgCode];
             if (drgNode && drgNode.byKelompok) {
               Object.keys(drgNode.byKelompok).forEach(k => kelompokSet.add(k));
             }
          });
          return {
            inacbg: inacbgCode,
            desc_inacbg: descMap[inacbgCode] || '-',
            kelompoks: Array.from(kelompokSet),
            idrgs: idrgMap
          };
        });
        
        setData(transformedData);
        setGlobalTarifMap(tarifMap);
        setRegionalTarifMap(regionalMap);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [dataset]);

  const effectiveTarifMap = React.useMemo(() => {
    let inacbgMap = { ...globalTarifMap.inacbg };
    if (selectedKepemilikan && selectedKelas && regionalTarifMap) {
      const key = selectedKelasRawat ? `${selectedKepemilikan}_${selectedKelas}_${selectedKelasRawat}` : null;
      const fallbackKey = `${selectedKepemilikan}_${selectedKelas}_KELAS0`;
      
      const specificMap = key ? (regionalTarifMap[key] || {}) : {};
      const kelas0Map = regionalTarifMap[fallbackKey] || {};
      
      Object.keys(inacbgMap).forEach(k => {
        if (specificMap[k] !== undefined) {
          inacbgMap[k] = specificMap[k];
        } else if (kelas0Map[k] !== undefined) {
          inacbgMap[k] = kelas0Map[k];
        }
      });
    }
    return {
      inacbg: inacbgMap,
      idrg: globalTarifMap.idrg
    };
  }, [globalTarifMap, selectedKepemilikan, selectedKelas, selectedKelasRawat, regionalTarifMap]);

  const tarifLabel = React.useMemo(() => {
    if (selectedKepemilikan && selectedKelas) {
      const kep = selectedKepemilikan === 'P' ? 'Pemerintah' : 'Swasta';
      const kr = selectedKelasRawat ? ` ${selectedKelasRawat.replace('KELAS', 'Kelas ')}` : '';
      return `INA-CBG (RS ${kep} Reg 1 Kelas ${selectedKelas}${kr})`;
    }
    return "INA-CBG (Tarif PMK 3/2023 RS A Reg 1 Kelas 3)";
  }, [selectedKepemilikan, selectedKelas, selectedKelasRawat]);

  const kelompokOptions = React.useMemo(() => {
    const opts = KELOMPOK_LAYANAN.map(k => ({ value: k, label: k }));
    if (data) {
      const existing = new Set(KELOMPOK_LAYANAN.map(k => k.toLowerCase()));
      const extras = new Set();
      data.forEach(d => {
        if (d.kelompoks) d.kelompoks.forEach(k => extras.add(k));
        else if (d.kelompok && d.kelompok !== 'Unknown') extras.add(d.kelompok);
      });
      [...extras].filter(k => k && !existing.has(k.toLowerCase())).sort().forEach(k => {
        opts.push({ value: k, label: k });
      });
    }
    return [{ value: '', label: 'Semua Kompetensi (24 Layanan)' }, ...opts];
  }, [data]);

  // Options for Detail Mode Dropdown
  const inacbgOptions = React.useMemo(() => {
    if (!data) return [];
    let filtered = data;
    if (selectedKelompok) {
      filtered = filtered.filter(d => d.kelompoks && d.kelompoks.includes(selectedKelompok));
    }
    return filtered
      .sort((a,b) => {
        const totalA = Object.values(a.idrgs).reduce((sum, i) => sum + (i.kasus || 0), 0);
        const totalB = Object.values(b.idrgs).reduce((sum, i) => sum + (i.kasus || 0), 0);
        return totalB - totalA;
      })
      .map(d => ({
        value: d.inacbg,
        label: `${d.inacbg} - ${d.desc_inacbg !== '-' ? d.desc_inacbg : 'Tanpa Deskripsi'}`,
        item: d
      }));
  }, [data, selectedKelompok]);

  if (loading || !data) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Peta iDRG...</span>
      </div>
    );
  }

  // Filter Data (For Mindmap)
  let filteredData = [...data];
  if (selectedKelompok) {
    const sKel = selectedKelompok.toLowerCase();
    filteredData = filteredData.filter(d => d.kelompoks && d.kelompoks.some(k => k.toLowerCase() === sKel));
  }
  if (searchInacbg) {
    const q = searchInacbg.toLowerCase();
    filteredData = filteredData.filter(d => {
      if (d.inacbg.toLowerCase().includes(q)) return true;
      if (d.desc_inacbg && d.desc_inacbg.toLowerCase().includes(q)) return true;
      
      if (d.idrgs) {
        for (const [idrgCode, idrgData] of Object.entries(d.idrgs)) {
          if (idrgCode.toLowerCase().includes(q)) return true;
          const idrgDesc = idrgData.deskripsi || idrgData.desc_idrg || '';
          if (idrgDesc.toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }

  // Sort by Total Cases across all its mapped iDRGs (Descending)
  filteredData.sort((a, b) => {
    const totalCasesA = Object.values(a.idrgs).reduce((sum, i) => sum + i.kasus, 0);
    const totalCasesB = Object.values(b.idrgs).reduce((sum, i) => sum + i.kasus, 0);
    return totalCasesB - totalCasesA;
  });

  const treeData = {
    name: 'INA-CBG',
    attributes: { subtitle: `${filteredData.length} Group Ditampilkan` },
    nodeType: 'root',
    children: filteredData.slice(0, 50).map(item => {
      const idrgs = Object.entries(item.idrgs).sort((a,b) => b[1].kasus - a[1].kasus);
      const totalCases = idrgs.reduce((sum, [, idrgData]) => sum + idrgData.kasus, 0);
      const totalInacbg = idrgs.reduce((sum, [, idrgData]) => sum + (idrgData.inacbg || 0), 0);
      const meanInacbg = totalCases > 0 ? totalInacbg / totalCases : 0;
      const rsATarifIna = effectiveTarifMap.inacbg[item.inacbg] || 0;
      
      return {
        name: item.inacbg,
        attributes: {
          desc: item.desc_inacbg !== '-' ? item.desc_inacbg : 'Tanpa Deskripsi',
          kasus: totalCases,
          tarif: formatFullCurrency(rsATarifIna),
          meanTarif: formatFullCurrency(meanInacbg)
        },
        nodeType: 'inacbg',
        children: idrgs.map(([idrgCode, idrgData]) => {
          const prop = totalCases > 0 ? ((idrgData.kasus / totalCases) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0;
          const rsATarifIdrg = globalTarifMap.idrg[idrgCode] || 0;
          const simulasiKey = `tarif_${simulasi}`;
          const totalSim = idrgData[simulasiKey] || 0;
          const meanIdrg = idrgData.kasus > 0 ? totalSim / idrgData.kasus : 0;
          
          return {
            name: idrgCode,
            attributes: {
              desc: idrgData.deskripsi || idrgData.desc_idrg || '-',
              descInacbg: item.desc_inacbg !== '-' ? item.desc_inacbg : '',
              kasus: idrgData.kasus,
              proporsi: `${prop}%`,
              tarif: formatFullCurrency(rsATarifIdrg),
              meanTarif: formatFullCurrency(meanIdrg)
            },
            nodeType: 'idrg'
          };
        })
      };
    })
  };

  const renderCustomNode = ({ nodeDatum, toggleNode }) => {
    const isRoot = nodeDatum.nodeType === 'root';
    const isInacbg = nodeDatum.nodeType === 'inacbg';
    const isIdrg = nodeDatum.nodeType === 'idrg';
    
    // Gradient colors
    const fill = isRoot ? 'var(--primary-color)' : isInacbg ? '#27ae60' : '#8e44ad';
    const width = 260;
    const height = 110;
    const rx = 12;

    return (
      <g>
        <rect 
          width={width} height={height} x={-width/2} y={-height/2} 
          fill={fill} rx={rx} 
          onClick={toggleNode} 
          style={{ cursor: 'pointer', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }} 
        />
        <text fill="#ffffff" strokeWidth="0" x="0" y="-22" textAnchor="middle" style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'Quattrocento Sans, sans-serif' }} onClick={toggleNode}>
          {nodeDatum.name}
        </text>
        {(nodeDatum.attributes?.desc || nodeDatum.attributes?.subtitle) && (
          <text fill="rgba(255,255,255,0.9)" strokeWidth="0" x="0" y="-4" textAnchor="middle" style={{ fontSize: '11px', fontFamily: 'Quattrocento Sans, sans-serif' }} onClick={toggleNode}>
            {nodeDatum.attributes.desc ? 
              (nodeDatum.attributes.desc.length > 35 ? nodeDatum.attributes.desc.substring(0, 35) + '...' : nodeDatum.attributes.desc)
              : nodeDatum.attributes.subtitle}
          </text>
        )}
        {isInacbg && (
          <>
            <text fill="#f1c40f" strokeWidth="0" x="0" y="16" textAnchor="middle" style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'Quattrocento Sans, sans-serif' }} onClick={toggleNode}>
              Total: {nodeDatum.attributes.kasus?.toLocaleString()} Kasus
            </text>
            <text fill="#a8e6cf" strokeWidth="0" x="0" y="32" textAnchor="middle" style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'Quattrocento Sans, sans-serif' }} onClick={toggleNode}>
              Tarif Dasar: {nodeDatum.attributes.tarif}
            </text>
            <text fill="#3498db" strokeWidth="0" x="0" y="48" textAnchor="middle" style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'Quattrocento Sans, sans-serif' }} onClick={toggleNode}>
              Mean Tarif: {nodeDatum.attributes.meanTarif}
            </text>
          </>
        )}
        {isIdrg && (
          <>
            <text fill="#f1c40f" strokeWidth="0" x="0" y="16" textAnchor="middle" style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'Quattrocento Sans, sans-serif' }} onClick={toggleNode}>
              {nodeDatum.attributes.proporsi} ➔ {nodeDatum.attributes.kasus?.toLocaleString()} Kasus
            </text>
            <text fill="#a8e6cf" strokeWidth="0" x="0" y="32" textAnchor="middle" style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'Quattrocento Sans, sans-serif' }} onClick={toggleNode}>
              Tarif Dasar: {nodeDatum.attributes.tarif}
            </text>
            <text fill="#3498db" strokeWidth="0" x="0" y="48" textAnchor="middle" style={{ fontSize: '12px', fontWeight: 800, fontFamily: 'Quattrocento Sans, sans-serif' }} onClick={toggleNode}>
              Mean Tarif: {nodeDatum.attributes.meanTarif}
            </text>
            {nodeDatum.attributes.descInacbg && calculateSimilarity(nodeDatum.attributes.descInacbg, nodeDatum.attributes.desc) < 0.2 && (
              <text fill="#ef4444" strokeWidth="0" x="0" y="64" textAnchor="middle" style={{ fontSize: '10px', fontWeight: 800, fontFamily: 'Quattrocento Sans, sans-serif', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
                ⚠️ BEDA DESKRIPSI
              </text>
            )}
          </>
        )}
        {nodeDatum.children && (
          <g transform={`translate(${width/2}, 0)`} onClick={toggleNode} style={{ cursor: 'pointer' }}>
            <circle r="12" fill="#ffffff" stroke={fill} strokeWidth="2" />
            <text x="0" y="4" textAnchor="middle" fill={fill} style={{ fontSize: '14px', fontWeight: 800 }}>
              {nodeDatum.__rd3t.collapsed ? '+' : '-'}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Alert Banner */}
      <div style={{
        background: 'var(--bg-card)',
        borderLeft: '4px solid #f39c12',
        padding: '16px 24px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        marginBottom: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        flexShrink: 0
      }}>
        <AlertCircle size={24} color="#f39c12" style={{ marginTop: '2px' }} />
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            Informasi Ketersediaan Data Diagnosa & Tindakan
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Saat ini, database yang diunggah adalah data agregat level INA-CBG & iDRG. Data spesifik mengenai <strong>Diagnosa Utama, Diagnosa Sekunder, dan Tindakan (ICD-10 / ICD-9-CM) belum tersedia</strong> di raw data saat ini. 
          </p>
        </div>
      </div>

      {/* Header & View Mode Switch */}
      <div className="card" style={{ marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Network size={24} color="var(--primary-color)" />
              Pemetaan INA-CBG ke iDRG
            </h2>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button 
                className={`btn ${viewMode === 'presentation' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('presentation')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
              >
                <Presentation size={18} />
                Mode Presentasi (Flowchart)
              </button>
              <button 
                className={`btn ${viewMode === 'detail' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('detail')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
              >
                <Layers size={18} />
                Mode Detail per CBG
              </button>
              <button 
                className={`btn ${viewMode === 'mindmap' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('mindmap')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
              >
                <ListTree size={18} />
                Mode Mindmap
              </button>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: '180px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Kepemilikan RS</div>
              <Select
                options={[{value:'', label:'Nasional (Default)'}, {value:'P', label:'Pemerintah'}, {value:'S', label:'Swasta'}]}
                value={[{value:'', label:'Nasional (Default)'}, {value:'P', label:'Pemerintah'}, {value:'S', label:'Swasta'}].find(o => o.value === selectedKepemilikan) || {value:'', label:'Nasional (Default)'}}
                onChange={opt => setSelectedKepemilikan(opt ? opt.value : '')}
                styles={{ control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px' }), menu: (base) => ({ ...base, zIndex: 9999 }) }}
              />
            </div>
            <div style={{ minWidth: '180px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Kelas RS</div>
              <Select
                options={[{value:'', label:'Semua Kelas'}, {value:'A', label:'Kelas A'}, {value:'B', label:'Kelas B'}, {value:'C', label:'Kelas C'}, {value:'D', label:'Kelas D'}]}
                value={[{value:'', label:'Semua Kelas'}, {value:'A', label:'Kelas A'}, {value:'B', label:'Kelas B'}, {value:'C', label:'Kelas C'}, {value:'D', label:'Kelas D'}].find(o => o.value === selectedKelas) || {value:'', label:'Semua Kelas'}}
                onChange={opt => setSelectedKelas(opt ? opt.value : '')}
                styles={{ control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px' }), menu: (base) => ({ ...base, zIndex: 9999 }) }}
              />
            </div>
            <div style={{ minWidth: '180px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Kelas Rawat</div>
              <Select
                options={[{value:'', label:'Semua Kelas Rawat'}, {value:'KELAS1', label:'Kelas 1'}, {value:'KELAS2', label:'Kelas 2'}, {value:'KELAS3', label:'Kelas 3'}]}
                value={[{value:'', label:'Semua Kelas Rawat'}, {value:'KELAS1', label:'Kelas 1'}, {value:'KELAS2', label:'Kelas 2'}, {value:'KELAS3', label:'Kelas 3'}].find(o => o.value === selectedKelasRawat) || {value:'', label:'Semua Kelas Rawat'}}
                onChange={opt => setSelectedKelasRawat(opt ? opt.value : '')}
                styles={{ control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px' }), menu: (base) => ({ ...base, zIndex: 9999 }) }}
              />
            </div>
          </div>

          {viewMode === 'mindmap' && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-box">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Cari Kode/Deskripsi INA-CBG atau iDRG..." 
                  value={searchInacbg}
                  onChange={e => setSearchInacbg(e.target.value)}
                  style={{ width: '250px' }}
                />
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                Filter Kompetensi Layanan:
              </div>
              
              <div style={{ minWidth: '250px' }}>
                <Select 
                  options={kelompokOptions}
                  value={kelompokOptions.find(o => o.value === selectedKelompok) || kelompokOptions[0]}
                  onChange={opt => setSelectedKelompok(opt ? opt.value : '')}
                  isSearchable
                  styles={{ 
                    control: (base) => ({ ...base, minHeight: '38px', borderRadius: '6px', borderColor: 'var(--glass-border)' }),
                    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'var(--bg-app)' : 'white', color: 'var(--text-primary)' }),
                    menu: (base) => ({ ...base, zIndex: 9999 })
                  }}
                />
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Filter Warning --- */}
      {(groupFilter?.length > 0 || wilayahFilter?.length > 0 || rsFilter) && (
        <div style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--accent-yellow)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={24} color="var(--accent-yellow)" />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Peta iDRG Bersifat Nasional</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Menu Peta iDRG menampilkan seluruh mapping INA-CBG ke iDRG secara global. Filter Rumah Sakit atau Wilayah yang Anda pilih di atas <strong>tidak berlaku</strong> pada menu ini.
            </div>
          </div>
        </div>
      )}

      {/* --- Content Area --- */}
      {viewMode === 'mindmap' ? (
        <div className="card fade-in" style={{ flexGrow: 1, padding: 0, minHeight: '700px', position: 'relative', overflow: 'hidden' }}>
          {filteredData.length === 0 ? (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>
              <p>Tidak ada data pemetaan yang sesuai dengan filter.</p>
            </div>
          ) : (
            <Tree 
              data={treeData} 
              orientation="horizontal"
              pathFunc="bezier"
              translate={{ x: 200, y: 350 }}
              nodeSize={{ x: 320, y: 160 }}
              renderCustomNodeElement={renderCustomNode}
              separation={{ siblings: 1.2, nonSiblings: 1.5 }}
              zoomable={true}
              initialDepth={1}
              transitionDuration={400}
            />
          )}
        </div>
      ) : viewMode === 'detail' ? (
        <DetailModeView 
          selectedDetailInacbg={selectedDetailInacbg}
          setSelectedDetailInacbg={setSelectedDetailInacbg}
          inacbgOptions={inacbgOptions}
          globalTarifMap={effectiveTarifMap}
          tarifLabel={tarifLabel}
          kelompokOptions={kelompokOptions}
          selectedKelompok={selectedKelompok}
          setSelectedKelompok={setSelectedKelompok}
          globalMonth={globalMonth}
          globalDrg={globalDrg}
        />
      ) : (
        <PresentationModeView 
          data={data} 
          globalTarifMap={effectiveTarifMap}
          tarifLabel={tarifLabel}
          kelompokOptions={kelompokOptions}
          selectedKelompok={selectedKelompok} 
          setSelectedKelompok={setSelectedKelompok}
          globalMonth={globalMonth}
          globalDrg={globalDrg}
        />
      )}
    </div>
  );
};

export default PetaIdrg;
