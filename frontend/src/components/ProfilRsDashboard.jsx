import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Users, MapPin, PieChart as PieIcon, TrendingUp, Award, BarChart2 } from 'lucide-react';
import './ProfilRsDashboard.css';
import SimulasiSkenarioTable from './SimulasiSkenarioTable';

const MAIN_LEVELS = ['Dasar', 'Madya', 'Utama', 'Paripurna'];

const ProfilRsDashboard = ({ selectedRs, selectedLayanan, targetKomp, regKomp, activeTambahLevels, rsKompetensiOnline }) => {
    if (!selectedRs) return null;

    // Determine target levels for dynamic analysis (fallback to MAIN_LEVELS)
    const targetLevels = activeTambahLevels && activeTambahLevels.length > 0 ? activeTambahLevels : MAIN_LEVELS;
    const targetLevelsStr = targetLevels.join(' & ');

    // Calculate Highest Competence Level from Hospital Metadata
    let topLayanan = '-';
    let topKomp = 'TIDAK KOMPETEN';
    let topLayananCases = -1;

    if (selectedRs && selectedRs.crosstab && selectedRs.crosstab.byLayanan) {
        for (const [layananName, layananData] of Object.entries(selectedRs.crosstab.byLayanan)) {
            const kasus = layananData.nasional?.kasus || 0;
            if (kasus > topLayananCases) {
                topLayananCases = kasus;
                topLayanan = layananName;
                
                let hKomp = 'TIDAK KOMPETEN';
                const kodeRs = selectedRs.kode || selectedRs.value;
                if (rsKompetensiOnline && kodeRs && rsKompetensiOnline[kodeRs] && rsKompetensiOnline[kodeRs][layananName.toLowerCase()]) {
                    hKomp = rsKompetensiOnline[kodeRs][layananName.toLowerCase()].toUpperCase();
                } else {
                    const order = ['PARIPURNA', 'UTAMA', 'MADYA', 'DASAR'];
                    for (const k of order) {
                        const rawK = k.toLowerCase();
                        let riCases = 0;
                        let rjCases = 0;
                        
                        if (layananData.byKompetensi) {
                            for (const type of ['A', 'B', 'C', 'D']) {
                                if (layananData.byKompetensi[type]) {
                                    riCases += layananData.byKompetensi[type].ri?.[rawK]?.kasus || 0;
                                    rjCases += layananData.byKompetensi[type].rj?.[rawK]?.kasus || 0;
                                }
                            }
                        }
                        
                        if (riCases + rjCases > 0) {
                            hKomp = k;
                            break;
                        }
                    }
                }
                topKomp = hKomp;
            }
        }
    }

    const formatTitleCase = (str) => {
        return str.split(/[\s/]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };
    
    const displayTopKompText = topLayanan !== '-' 
        ? `Layanan ${formatTitleCase(topLayanan)} kompetensi ${formatTitleCase(topKomp)}`
        : 'Tidak Kompeten';

    // Calculate Aggregates for Target Levels
    let totalEksisting = 0;
    let totalRegional = 0;
    let totalPotensiTambahan = 0;

    const eksistingData = [];
    const regionalData = [];

    const colors = {
        'Paripurna': '#0369a1', // Dark blue
        'Utama': '#0ea5e9',     // Light blue
        'Madya': '#65a30d',     // Green
        'Dasar': '#eab308'      // Yellow
    };

    targetLevels.forEach(lvl => {
        const eks = targetKomp[lvl]?.kasus || 0;
        const reg = regKomp[lvl]?.kasus || 0;
        const selisih = Math.max(0, reg - eks);

        totalEksisting += eks;
        totalRegional += reg;
        totalPotensiTambahan += selisih;

        if (eks > 0) eksistingData.push({ name: lvl, value: eks, fill: colors[lvl] || '#94a3b8' });
        if (reg > 0) regionalData.push({ name: lvl, value: reg, fill: colors[lvl] || '#94a3b8' });
    });

    const pangsaPasar = totalRegional > 0 ? (totalEksisting / totalRegional) * 100 : 0;
    const potensiTerserapPct = totalRegional > 0 ? (totalPotensiTambahan / totalRegional) * 100 : 0;

    const formatNum = (num) => num.toLocaleString('id-ID');

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
        const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                {`${(percent * 100).toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})}%`}
            </text>
        );
    };

    return (
        <div className="profil-rs-dashboard">
            {/* Header */}
            <div className="prd-header">
                <div className="prd-title-group">
                    <h1 className="prd-title">PROFIL KOMPETENSI LAYANAN {selectedRs.label.toUpperCase()}</h1>
                    <h2 className="prd-subtitle">DAN POTENSI REGIONAL PELAYANAN {selectedLayanan && selectedLayanan.length > 0 ? selectedLayanan.map(l => l.label.toUpperCase()).join(', ') : 'KESELURUHAN'}</h2>
                    <p className="prd-desc">Distribusi kasus berdasarkan kompetensi layanan iDRG wilayah regional</p>
                </div>
                <div className="prd-period">
                    <div className="period-icon">📅</div>
                    <div className="period-text">
                        <div className="period-label">Periode Data Mirroring uji coba iDRG</div>
                        <div className="period-val">15 Okt 2025 - 14 Mar 2026</div>
                    </div>
                </div>
            </div>

            {/* Top KPI Cards */}
            <div className="prd-kpi-grid">
                <div className="prd-kpi-card">
                    <div className="kpi-icon-wrap" style={{backgroundColor: '#0d9488'}}><Users size={24} color="white" /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">KASUS EKSISTING<br/>{selectedRs.label}</div>
                        <div className="kpi-val">{formatNum(totalEksisting)} <span className="kpi-unit">kasus</span></div>
                        <div className="kpi-sub">({targetLevels.map(l => `${l} ${formatNum(targetKomp[l]?.kasus || 0)}`).join(' + ')})</div>
                    </div>
                </div>
                <div className="prd-kpi-card">
                    <div className="kpi-icon-wrap" style={{backgroundColor: '#1d4ed8'}}><MapPin size={24} color="white" /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">POTENSI REGIONAL<br/>({targetLevelsStr.toUpperCase()})</div>
                        <div className="kpi-val" style={{color: '#1d4ed8'}}>{formatNum(totalRegional)} <span className="kpi-unit">kasus</span></div>
                        <div className="kpi-sub">({targetLevels.map(l => `${l} ${formatNum(regKomp[l]?.kasus || 0)}`).join(' + ')})</div>
                    </div>
                </div>
                <div className="prd-kpi-card">
                    <div className="kpi-icon-wrap" style={{backgroundColor: '#65a30d'}}><PieIcon size={24} color="white" /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">PANGSA SAAT INI<br/>({targetLevelsStr.toUpperCase()})</div>
                        <div className="kpi-val" style={{color: '#65a30d'}}>{pangsaPasar.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</div>
                        <div className="kpi-sub">({formatNum(totalEksisting)} / {formatNum(totalRegional)})</div>
                    </div>
                </div>
                <div className="prd-kpi-card">
                    <div className="kpi-icon-wrap" style={{backgroundColor: '#65a30d'}}><TrendingUp size={24} color="white" /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">POTENSI TAMBAHAN<br/>(DAPAT DITARIK)</div>
                        <div className="kpi-val" style={{color: '#65a30d'}}>{formatNum(totalPotensiTambahan)} <span className="kpi-unit">kasus</span></div>
                    </div>
                </div>
                <div className="prd-kpi-card">
                    <div className="kpi-icon-wrap" style={{backgroundColor: '#0d9488'}}><Award size={24} color="white" /></div>
                    <div className="kpi-content">
                        <div className="kpi-label">LAYANAN KOMPETENSI RS<br/>TERBANYAK</div>
                        <div className="kpi-val" style={{color: '#0d9488', fontSize: '1rem', lineHeight: '1.2', marginTop: '4px'}}>{displayTopKompText}</div>
                    </div>
                </div>
            </div>

            {/* Middle Section: Charts */}
            <div className="prd-middle-grid">
                {/* Kompetensi RS Profile */}
                <div className="prd-chart-card">
                    <div className="prd-card-header">PROFIL KOMPETENSI {selectedRs.label.toUpperCase()}</div>
                    <div className="prd-komp-list">
                        {['Paripurna', 'Utama', 'Madya', 'Dasar'].map(lvl => (
                            <div className="komp-row" key={lvl}>
                                <div className="komp-name" style={{color: colors[lvl]}}>{lvl.toUpperCase()}</div>
                                <div className="komp-bar-wrap">
                                    <div className="komp-bar" style={{
                                        width: targetKomp[lvl]?.kasus > 0 ? '100%' : '0%',
                                        backgroundColor: colors[lvl]
                                    }}></div>
                                    <div className="komp-bg-bar"></div>
                                </div>
                            </div>
                        ))}
                        <div className="komp-row">
                            <div className="komp-name" style={{color: '#ef4444'}}>TIDAK KOMPETEN</div>
                            <div className="komp-bar-wrap">
                                <div className="komp-bg-bar"></div>
                            </div>
                        </div>
                    </div>
                    <div className="prd-komp-badge">
                        <div className="badge-label">LAYANAN KOMPETENSI RS TERBANYAK</div>
                        <div className="badge-val" style={{fontSize: '1rem', marginTop: '4px'}}>{displayTopKompText}</div>
                    </div>
                </div>

                {/* Donut Chart Eksisting */}
                <div className="prd-chart-card">
                    <div className="prd-card-header">KOMPOSISI KASUS {selectedRs.label.toUpperCase()} ({targetLevelsStr.toUpperCase()})</div>
                    <div className="prd-donut-wrap">
                        <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                            <PieChart>
                                <Pie
                                    data={eksistingData}
                                    cx="50%" cy="50%"
                                    innerRadius={50} outerRadius={80}
                                    dataKey="value"
                                    labelLine={false}
                                    label={renderCustomLabel}
                                >
                                    {eksistingData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val) => formatNum(val) + ' Kasus'} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center-label">
                            <div className="dl-title">TOTAL</div>
                            <div className="dl-val">{formatNum(totalEksisting)}</div>
                            <div className="dl-sub">KASUS</div>
                        </div>
                    </div>
                    <div className="prd-legend">
                        {eksistingData.map(d => (
                            <div className="legend-item" key={d.name}>
                                <span className="legend-dot" style={{backgroundColor: d.fill}}></span>
                                {d.name} ({formatNum(d.value)})
                            </div>
                        ))}
                    </div>
                </div>

                {/* Donut Chart Regional */}
                <div className="prd-chart-card">
                    <div className="prd-card-header">POTENSI REGIONAL ({targetLevelsStr.toUpperCase()})</div>
                    <div className="prd-donut-wrap">
                        <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                            <PieChart>
                                <Pie
                                    data={regionalData}
                                    cx="50%" cy="50%"
                                    innerRadius={50} outerRadius={80}
                                    dataKey="value"
                                    labelLine={false}
                                    label={renderCustomLabel}
                                >
                                    {regionalData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val) => formatNum(val) + ' Kasus'} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center-label">
                            <div className="dl-title">TOTAL</div>
                            <div className="dl-val">{formatNum(totalRegional)}</div>
                            <div className="dl-sub">KASUS</div>
                        </div>
                    </div>
                    <div className="prd-legend">
                        {regionalData.map(d => (
                            <div className="legend-item" key={d.name}>
                                <span className="legend-dot" style={{backgroundColor: d.fill}}></span>
                                {d.name} ({formatNum(d.value)})
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Section: Tables and Bars */}
            <div className="prd-bottom-grid">
                <div className="prd-chart-card">
                    <div className="prd-card-header">PERBANDINGAN KASUS: {selectedRs.label.toUpperCase()} VS POTENSI REGIONAL</div>
                    <table className="prd-table">
                        <thead>
                            <tr>
                                <th>KOMPETENSI</th>
                                <th>{selectedRs.label.toUpperCase()}<br/>(EKSISTING)</th>
                                <th>POTENSI REGIONAL<br/>({targetLevelsStr.toUpperCase()})</th>
                                <th>SELISIH<br/>(POTENSI TAMBAHAN)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {targetLevels.map(lvl => {
                                const eks = targetKomp[lvl]?.kasus || 0;
                                const reg = regKomp[lvl]?.kasus || 0;
                                const selisih = Math.max(0, reg - eks);
                                return (
                                    <tr key={lvl}>
                                        <td style={{fontWeight: 'bold', color: colors[lvl]}}>{lvl}</td>
                                        <td>{formatNum(eks)}</td>
                                        <td style={{color: '#0d9488', fontWeight: 600}}>{formatNum(reg)}</td>
                                        <td style={{color: '#65a30d', fontWeight: 600}}>{formatNum(selisih)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td><Users size={16} style={{display: 'inline', marginRight: 4, verticalAlign: 'text-bottom'}}/> TOTAL</td>
                                <td>{formatNum(totalEksisting)}</td>
                                <td style={{color: '#0d9488'}}>{formatNum(totalRegional)}</td>
                                <td style={{color: '#65a30d'}}>{formatNum(totalPotensiTambahan)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="prd-chart-card">
                    <div className="prd-card-header">PERBANDINGAN TOTAL KASUS</div>
                    <div className="prd-bar-wrap">
                        <div className="bar-labels">
                            <span className="bl-title">POTENSI REGIONAL ({formatNum(totalRegional)} KASUS)</span>
                            <span className="bl-pct">100%</span>
                        </div>
                        <div className="progress-bg"><div className="progress-fill" style={{width: '100%', backgroundColor: '#84cc16'}}></div></div>
                        
                        <div className="bar-labels" style={{marginTop: 24}}>
                            <span className="bl-title">KASUS {selectedRs.label.toUpperCase()} ({formatNum(totalEksisting)} KASUS)</span>
                            <span className="bl-pct">{pangsaPasar.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</span>
                        </div>
                        <div className="progress-bg"><div className="progress-fill" style={{width: `${pangsaPasar}%`, backgroundColor: '#1e3a8a'}}></div></div>

                        <div className="pangsa-box">
                            <div className="pb-title">Pangsa Pasar Saat Ini</div>
                            <div className="pb-val">{pangsaPasar.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</div>
                        </div>
                    </div>
                </div>

                <div className="prd-chart-card flex-center-col" style={{border: '2px solid #e2e8f0'}}>
                    <div className="prd-card-header" style={{width: '100%'}}>POTENSI BELUM TERSERAP</div>
                    <div className="tbs-icon"><BarChart2 size={48} color="#65a30d" /></div>
                    <div className="tbs-title">POTENSI BELUM TERSERAP</div>
                    <div className="tbs-val">{formatNum(totalPotensiTambahan)} <span className="tbs-unit">KASUS</span></div>
                    <div className="tbs-pct">{potensiTerserapPct.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</div>
                    <div className="tbs-desc">Dari total potensi regional</div>
                </div>
            </div>

            {/* Footer */}
            <div className="prd-footer">
                <div className="footer-item">
                    <div className="fi-icon">🗄️</div>
                    <div>
                        <div className="fi-label">SUMBER DATA</div>
                        <div className="fi-val">Data Mirroring uji coba iDRG & RBKP</div>
                    </div>
                </div>
                <div className="footer-item">
                    <div className="fi-icon">📍</div>
                    <div>
                        <div className="fi-label">WILAYAH</div>
                        <div className="fi-val">Regional Berdasarkan Filter Aktif</div>
                    </div>
                </div>
                <div className="footer-item">
                    <div className="fi-icon">📅</div>
                    <div>
                        <div className="fi-label">PERIODE</div>
                        <div className="fi-val">15 Okt 2025 - 14 Mar 2026</div>
                    </div>
                </div>
            </div>

            {/* Simulasi Skenario Tables */}
            <SimulasiSkenarioTable targetKomp={targetKomp} regKomp={regKomp} />

        </div>
    );
};

export default ProfilRsDashboard;
