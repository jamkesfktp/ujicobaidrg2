import React, { useState } from 'react';
import Select from 'react-select';
import { Network, AlertCircle } from 'lucide-react';
import xarrowsModule from 'react-xarrows';
const Xarrow = xarrowsModule.default || xarrowsModule;
const Xwrapper = xarrowsModule.Xwrapper || React.Fragment;
import { formatFullCurrency } from '../utils/formatters';

const PresentationModeView = ({ data, globalTarifMap, tarifLabel, kelompokOptions, selectedKelompok, setSelectedKelompok , globalMonth, globalDrg}) => {
  const [selectedBase, setSelectedBase] = useState('');
  const [filterPtd, setFilterPtd] = useState('all');
  
  const baseGroups = React.useMemo(() => {
    if (!data) return {};
    let filteredData = data;
     if (selectedKelompok) {
        const sKel = selectedKelompok.toLowerCase();
        filteredData = data.filter(d => d.kelompoks && d.kelompoks.some(k => k.toLowerCase() === sKel));
     }
    const groups = {};
    filteredData.forEach(d => {
      const match = d.inacbg.match(/(.+)-(I|II|III|IV|V|VI)$/i);
      const base = match ? match[1] : d.inacbg;
      if (!groups[base]) groups[base] = [];
      groups[base].push(d);
    });
    return groups;
  }, [data, selectedKelompok]);

  const baseOptions = React.useMemo(() => {
    return Object.entries(baseGroups).map(([base, items]) => {
       return { value: base, label: `${base} - ${items[0].desc_inacbg !== '-' ? items[0].desc_inacbg.split(' (')[0] : 'Tanpa Deskripsi'}` };
    }).sort((a,b) => a.label.localeCompare(b.label));
  }, [baseGroups]);

  const leftItems = React.useMemo(() => {
    if (!selectedBase || !baseGroups[selectedBase]) return [];
    return [...baseGroups[selectedBase]].sort((a, b) => a.inacbg.localeCompare(b.inacbg));
  }, [selectedBase, baseGroups]);

  React.useEffect(() => {
    if (selectedBase && Object.keys(baseGroups).length > 0 && !baseGroups[selectedBase]) {
      setSelectedBase('');
    }
  }, [baseGroups, selectedBase]);

  // Helper to get kasus based on ptd filter
  const getKasusByFilter = (idrgData, filter) => {
    if (filter === 'ri') {
      if (idrgData.ri && typeof idrgData.ri === 'object' && 'kasus' in idrgData.ri) {
        return idrgData.ri.kasus || 0;
      }
      // fallback: total kasus - rj.kasus (or just total if no rj)
      const rjKasus = (idrgData.rj && typeof idrgData.rj === 'object') ? (idrgData.rj.kasus || 0) : 0;
      return Math.max(0, (idrgData.kasus || 0) - rjKasus);
    }
    if (filter === 'rj') {
      if (idrgData.rj && typeof idrgData.rj === 'object' && 'kasus' in idrgData.rj) {
        return idrgData.rj.kasus || 0;
      }
      // fallback: total kasus - ri.kasus (or 0 if no ri)
      const riKasus = (idrgData.ri && typeof idrgData.ri === 'object') ? (idrgData.ri.kasus || 0) : 0;
      return Math.max(0, (idrgData.kasus || 0) - riKasus);
    }
    return idrgData.kasus || 0;
  };

  const rightGroups = React.useMemo(() => {
    if (!selectedBase) return [];
    const idrgs = {};
    leftItems.forEach(leftItem => {
      let filteredIdrgs = leftItem.idrgs;
      if (selectedKelompok) {
        const sKel = selectedKelompok.toLowerCase();
        filteredIdrgs = Object.fromEntries(
          Object.entries(leftItem.idrgs).filter(([_, iData]) => iData.kelompok && iData.kelompok.toLowerCase() === sKel)
        );
      }
      Object.entries(filteredIdrgs).forEach(([idrgCode, idrgData]) => {
         if (!idrgs[idrgCode]) {
           idrgs[idrgCode] = { ...idrgData, code: idrgCode, sources: new Set(), totalKasus: 0 };
         }
         idrgs[idrgCode].sources.add(leftItem.inacbg);
         idrgs[idrgCode].totalKasus += getKasusByFilter(idrgData, filterPtd);
      });
    });
    
    const grouped = {};
    Object.values(idrgs).forEach(i => {
       const baseIdrg = i.code.substring(0, 6);
       if (!grouped[baseIdrg]) grouped[baseIdrg] = { base: baseIdrg, items: [], totalKasus: 0 };
       grouped[baseIdrg].items.push(i);
       grouped[baseIdrg].totalKasus += i.totalKasus;
    });

    Object.values(grouped).forEach(g => {
       g.items.sort((a, b) => a.code.localeCompare(b.code));
    });
    
    return Object.values(grouped).sort((a, b) => b.totalKasus - a.totalKasus).map(g => [g.base, g.items]);
  }, [selectedBase, leftItems, filterPtd]);

  const palette = [
    { bg: 'var(--kemenkes-orange)', text: '#fff' },
    { bg: '#2ecc71', text: '#fff' },
    { bg: '#3498db', text: '#fff' },
    { bg: '#9b59b6', text: '#fff' },
    { bg: '#34495e', text: '#fff' }
  ];

  return (
    <div className="card fade-in" style={{ padding: '32px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '24px' }}>
         <h3 style={{ margin: '0 0 16px 0', color: 'var(--primary-color)' }}>Pilih Basis Kasus untuk Visualisasi Flowchart</h3>
         <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
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
            <select 
              className="styled-select" 
              value={filterPtd} 
              onChange={e => setFilterPtd(e.target.value)}
              style={{ padding: '8px 16px', flex: '1 1 200px' }}
            >
              <option value="all">Semua Kasus (RI & RJ)</option>
              <option value="ri">Hanya Rawat Inap</option>
              <option value="rj">Hanya Rawat Jalan</option>
            </select>
         </div>
         <Select 
            options={baseOptions}
            value={baseOptions.find(o => o.value === selectedBase)}
            onChange={v => setSelectedBase(v ? v.value : '')}
            placeholder="Ketik untuk mencari Grup Kasus (Misal: Septikemia)..."
            isSearchable
            menuPortalTarget={document.body}
            styles={{ 
              control: (base) => ({ ...base, minHeight: '42px', borderRadius: '8px', borderColor: 'var(--border-color)', boxShadow: 'none', '&:hover': { borderColor: 'var(--primary-color)' } }),
              option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'var(--bg-app)' : 'white', color: 'var(--text-primary)' }),
              menuPortal: base => ({ ...base, zIndex: 9999 })
            }}
         />
         {selectedBase && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
               <button 
                 onClick={() => setSelectedBase('')}
                 style={{ padding: '10px 20px', background: 'var(--primary-color)', borderRadius: '6px', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                 &larr; Kembali / Tutup Flowchart Ini
               </button>
            </div>
         )}
      </div>

      {!selectedBase ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {Object.keys(baseGroups).length > 0 ? (
             <div style={{ textAlign: 'left', marginTop: '10px' }}>
                <h4 style={{ marginBottom: '16px', color: 'var(--primary-color)' }}>
                  Top 10 Grup Kasus {selectedKelompok ? `Kompetensi: ${selectedKelompok}` : '(Semua 24 Layanan)'}
                  {filterPtd !== 'all' && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>— {filterPtd === 'ri' ? 'Rawat Inap' : 'Rawat Jalan'}</span>}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {(() => {
                        const allBases = Object.entries(baseGroups).map(([base, items]) => {
                          const total = items.reduce((sum, item) => {
                             const idrgsToSum = selectedKelompok 
                               ? Object.values(item.idrgs).filter(i => i.kelompok && i.kelompok.toLowerCase() === selectedKelompok.toLowerCase())
                               : Object.values(item.idrgs);
                             return sum + idrgsToSum.reduce((s, i) => {
                                return s + getKasusByFilter(i, filterPtd);
                             }, 0);
                         }, 0);
                           return { base, items, total, desc: items[0].desc_inacbg !== '-' ? items[0].desc_inacbg.split(' (')[0] : 'Tanpa Deskripsi' };
                        });
                        
                        // Filter out bases with 0 total cases
                        const validBases = allBases.filter(b => b.total > 0);
                        const grandTotalCases = validBases.reduce((acc, b) => acc + b.total, 0);
                        const sortedBases = validBases.sort((a,b) => b.total - a.total).slice(0, 10);
                        
                        return sortedBases.map((b, i) => {
                        const pct = grandTotalCases > 0 ? ((b.total / grandTotalCases) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0;
                        return (
                        <div 
                          key={b.base} 
                          onClick={() => setSelectedBase(b.base)}
                          className="card hover-elevate"
                          style={{ cursor: 'pointer', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}
                        >
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '800', color: 'var(--primary-color)', fontSize: '1.2rem' }}>{b.base}</span>
                              <span style={{ fontSize: '0.85rem', padding: '2px 8px', background: 'rgba(0,0,0,0.05)', borderRadius: '12px', fontWeight: 'bold' }}>#{i+1}</span>
                           </div>
                           <span style={{ fontSize: '0.95rem', lineHeight: '1.3', color: 'var(--text-secondary)' }}>{b.desc}</span>
                           <span style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', fontWeight: 'bold', fontSize: '1rem', color: 'var(--kemenkes-orange)' }}>
                             {b.total.toLocaleString()} Kasus <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({pct}%)</span>
                           </span>
                        </div>
                      )});
                   })()}
                </div>
             </div>
          ) : (
            <div style={{ padding: '60px' }}>
              <Network size={64} style={{ opacity: 0.2, marginBottom: '16px', display: 'inline-block' }} />
              <h3>Pilih Grup Kasus di Atas</h3>
            </div>
          )}
        </div>
      ) : leftItems.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertCircle size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <h3>Tidak Ada Data untuk Filter Ini</h3>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', width: '100%', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', padding: '20px 0', minHeight: '500px', minWidth: '1000px' }}>
          <Xwrapper>
           <div style={{ width: '48%', minWidth: '480px', display: 'flex', flexDirection: 'column', gap: '40px', zIndex: 2 }}>
             <h4 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--kemenkes-teal-dark)', fontWeight: 800 }}>{tarifLabel || "INA-CBG (Tarif Nasional - RS A Reg 1 Kelas 3)"}</h4>
             {leftItems.map((item, idx) => {
               const tarif = globalTarifMap.inacbg[item.inacbg] || 0;
               // Filter idrgs
               let filteredIdrgs = item.idrgs;
                if (selectedKelompok) {
                  const sKel = selectedKelompok.toLowerCase();
                  filteredIdrgs = Object.fromEntries(
                    Object.entries(item.idrgs).filter(([_, iData]) => iData.kelompok && iData.kelompok.toLowerCase() === sKel)
                  );
                }
               const totalKasusInacbg = Object.values(filteredIdrgs || {}).reduce((sum, i) => {
                 return sum + getKasusByFilter(i, filterPtd);
               }, 0);
               return (
                 <div id={`left-${item.inacbg}`} key={item.inacbg} style={{ display: 'grid', gridTemplateColumns: '100px minmax(0, 1fr) max-content max-content', background: 'var(--kemenkes-teal-dark)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', textAlign: 'center' }}>
                       {item.inacbg}
                    </div>
                    <div style={{ padding: '12px 16px', color: 'white', fontSize: '0.95rem', display: 'flex', alignItems: 'center', fontWeight: '600', lineHeight: '1.4', minWidth: '120px', wordBreak: 'break-word' }}>
                       {item.desc_inacbg !== '-' ? item.desc_inacbg : 'Deskripsi Tidak Tersedia'}
                    </div>
                    <div style={{ padding: '12px 16px', background: '#f8fafc', color: 'var(--text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderLeft: '2px solid var(--kemenkes-teal-dark)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                       {totalKasusInacbg.toLocaleString()} Kasus
                    </div>
                    <div style={{ padding: '12px 16px', background: 'white', color: 'var(--kemenkes-red)', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                       {formatFullCurrency(tarif)}
                    </div>
                 </div>
               );
             })}
           </div>

           <div style={{ width: '48%', minWidth: '480px', display: 'flex', flexDirection: 'column', gap: '40px', zIndex: 2 }}>
             <h4 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--kemenkes-orange)', fontWeight: 800 }}>iDRG (Rancangan Tarif iDRG = CW * NBR)</h4>
             {(() => {
               const grandTotalRightKasus = rightGroups.reduce((acc, [b, items]) => acc + items.reduce((s, i) => s + i.totalKasus, 0), 0);
               return rightGroups.map(([baseIdrg, items], groupIdx) => {
                 const theme = palette[groupIdx % palette.length];
                 const groupTotalKasus = items.reduce((sum, i) => sum + i.totalKasus, 0);
                 const groupPct = grandTotalRightKasus > 0 ? ((groupTotalKasus / grandTotalRightKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0;
                 return (
                   <div key={baseIdrg} style={{ border: `3px solid ${theme.bg}`, padding: '6px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px', background: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                      <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', color: theme.bg, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                         <span>Grup Base iDRG: {baseIdrg}</span>
                         <span>Total: {groupTotalKasus.toLocaleString()} Kasus ({groupPct}%)</span>
                      </div>
                    {items.map((item, idx) => {
                       const tarif = globalTarifMap.idrg[item.code] || 0;
                       const proporsi = groupTotalKasus > 0 ? ((item.totalKasus / groupTotalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0;
                       return (
                         <div id={`right-${item.code}`} key={item.code} style={{ display: 'grid', gridTemplateColumns: '100px minmax(0, 1fr) max-content max-content', background: theme.bg, color: theme.text, borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.15)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>#{idx + 1}</span>
                              {item.code}
                            </div>
                            <div style={{ padding: '12px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', fontWeight: '700', lineHeight: '1.3', minWidth: '120px', wordBreak: 'break-word' }}>
                              {item.deskripsi || item.desc_idrg || '-'}
                            </div>
                            <div style={{ padding: '12px 16px', background: '#f8fafc', color: 'var(--text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderLeft: `2px solid ${theme.bg}`, fontSize: '0.9rem', gap: '6px', whiteSpace: 'nowrap' }}>
                              {item.totalKasus.toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({proporsi}%)</span>
                            </div>
                            <div style={{ padding: '12px 16px', background: 'white', color: 'var(--kemenkes-red)', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                              {formatFullCurrency(tarif)}
                            </div>
                         </div>
                       );
                    })}
                   </div>
                 );
               });
             })()}
           </div>

           {rightGroups.map(([baseIdrg, items], groupIdx) => {
              const theme = palette[groupIdx % palette.length];
              return items.flatMap(item => {
                 return Array.from(item.sources).map(source => (
                    <Xarrow 
                      key={`${source}-${item.code}`}
                      start={`left-${source}`} 
                      end={`right-${item.code}`}
                      color={theme.bg}
                      strokeWidth={3}
                      path="smooth"
                      startAnchor="right"
                      endAnchor="left"
                      zIndex={1}
                      curveness={0.4}
                    />
                 ));
              });
           })}
          </Xwrapper>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresentationModeView;
