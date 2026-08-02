import React from 'react';
import './SimulasiSkenarioTable.css';

const formatNum = (num) => Math.round(num).toLocaleString('id-ID');
const formatM = (num) => num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPct = (num) => (num > 0 ? '+' : '') + num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const formatPosNeg = (num) => (num > 0 ? '+' : '') + formatNum(num);
const formatPosNegM = (num) => (num > 0 ? '+' : '') + num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SimulasiSkenarioTable = ({ targetKomp = {}, regKomp = {} }) => {
    // Helper to calculate average iDRG tarif
    const getAvgTarif = (lvl) => {
        const k = targetKomp[lvl]?.kasus || 0;
        const s = targetKomp[lvl]?.sim || 0;
        return k > 0 ? s / k : 0;
    };

    const avgTarif = {
        Dasar: getAvgTarif('Dasar'),
        Madya: getAvgTarif('Madya'),
        Utama: getAvgTarif('Utama'),
        Paripurna: getAvgTarif('Paripurna'),
    };

    const totalEksistingKasus = Object.values(targetKomp).reduce((acc, curr) => acc + (curr.kasus || 0), 0);
    const pendapatanEksistingInaM = Object.values(targetKomp).reduce((acc, curr) => acc + (curr.ina || 0), 0) / 1e9;

    // SCENARIO 1 LOGIC
    let s1KurangKasus = 0;
    let s1KurangSimM = 0;
    ['Dasar', 'Madya', 'Paripurna'].forEach(lvl => {
        const k = targetKomp[lvl]?.kasus || 0;
        const s = targetKomp[lvl]?.sim || 0;
        s1KurangKasus += k;
        s1KurangSimM += s / 1e9;
    });

    const s1Rows = [1, 2, 3, 4, 5].map(pct => {
        const tKasus = Math.round((regKomp['Utama']?.kasus || 0) * (pct / 100));
        const tPendapatanM = (tKasus * avgTarif.Utama) / 1e9;

        const netKasus = tKasus - s1KurangKasus;
        const netPct = totalEksistingKasus > 0 ? (netKasus / totalEksistingKasus) * 100 : 0;
        const netPendapatanM = tPendapatanM - s1KurangSimM;

        const totalPascaM = pendapatanEksistingInaM + netPendapatanM;
        const kenaikanPct = pendapatanEksistingInaM > 0 ? ((totalPascaM - pendapatanEksistingInaM) / pendapatanEksistingInaM) * 100 : 0;

        return { pct, tKasus, tPendapatanM, kurangKasus: s1KurangKasus, kurangSimM: s1KurangSimM, netKasus, netPct, netPendapatanM, totalPascaM, kenaikanPct };
    });

    // SCENARIO 2 LOGIC
    const s2KurangKasus = targetKomp['Paripurna']?.kasus || 0;
    const s2KurangSimM = (targetKomp['Paripurna']?.sim || 0) / 1e9;

    const s2Rows = [1, 2, 3, 4, 5].map(pct => {
        let tTotalKasus = 0;
        let tTotalPendapatanM = 0;
        const detail = {};
        
        ['Dasar', 'Madya', 'Utama'].forEach(lvl => {
            const k = Math.round((regKomp[lvl]?.kasus || 0) * (pct / 100));
            const p = (k * avgTarif[lvl]) / 1e9;
            tTotalKasus += k;
            tTotalPendapatanM += p;
            detail[lvl] = { k, p };
        });

        const netKasus = tTotalKasus - s2KurangKasus;
        const netPct = totalEksistingKasus > 0 ? (netKasus / totalEksistingKasus) * 100 : 0;
        const netPendapatanM = tTotalPendapatanM - s2KurangSimM;

        const totalPascaM = pendapatanEksistingInaM + netPendapatanM;
        const kenaikanPct = pendapatanEksistingInaM > 0 ? ((totalPascaM - pendapatanEksistingInaM) / pendapatanEksistingInaM) * 100 : 0;

        return { pct, detail, tTotalKasus, tTotalPendapatanM, kurangKasus: s2KurangKasus, kurangSimM: s2KurangSimM, netKasus, netPct, netPendapatanM, totalPascaM, kenaikanPct };
    });

    return (
        <div className="sst-container">
            <div className="sst-grid">
                <div className="sst-box">
                    <div className="sst-header">
                        SIMULASI SKENARIO 1<br/>
                        <span style={{fontSize: '0.75rem', fontWeight: 500}}>(PENAMBAHAN KASUS UTAMA vs PENGURANGAN KASUS DASAR, MADYA & PARIPURNA)</span>
                    </div>
                    <table className="sst-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="sst-col-pct">%</th>
                                <th colSpan="2" style={{color: '#1e3a8a'}}>TAMBAHAN KASUS UTAMA</th>
                                <th colSpan="3" style={{color: '#ef4444'}}>PENGURANGAN KASUS<br/>DASAR, MADYA & PARIPURNA</th>
                                <th colSpan="3" style={{color: '#1e3a8a'}}>NET +/- PASCA iDRG & RBKP</th>
                                <th rowSpan="2" className="sst-col-border">PENDAPATAN<br/>EKSISTING<br/>(Rp M)</th>
                                <th rowSpan="2">TOTAL PENDAPATAN<br/>PASCA iDRG<br/>(Rp M)</th>
                                <th rowSpan="2">% KENAIKAN<br/>thd EKSISTING</th>
                            </tr>
                            <tr>
                                <th>KASUS</th>
                                <th>PENDAPATAN<br/>(Rp M)</th>
                                <th>%</th>
                                <th>KASUS</th>
                                <th>PENDAPATAN<br/>(Rp M)</th>
                                <th>+/- KASUS</th>
                                <th>% thd total<br/>kasus eksisting</th>
                                <th>+/- PENDAPATAN<br/>(Rp M)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {s1Rows.map((row, i) => (
                                <tr key={i}>
                                    <td className="dark-circle-cell"><div className="dark-circle">{row.pct}</div> <span className="pct-text">{row.pct}%</span></td>
                                    <td className="font-bold" style={{color: '#65a30d'}}>{formatNum(row.tKasus)}</td>
                                    <td className="font-bold" style={{color: '#1e3a8a'}}>{formatM(row.tPendapatanM)}</td>
                                    <td className="font-bold" style={{color: '#ef4444'}}>100%</td>
                                    <td className="font-bold" style={{color: '#ef4444'}}>{formatNum(row.kurangKasus)}</td>
                                    <td className="font-bold" style={{color: '#ef4444'}}>{formatM(row.kurangSimM)}</td>
                                    <td className="font-bold" style={{color: '#1e3a8a'}}>{formatPosNeg(row.netKasus)}</td>
                                    <td className="font-bold" style={{color: '#1e3a8a'}}>{formatPct(row.netPct)}</td>
                                    <td className="font-bold" style={{color: '#65a30d'}}>{formatPosNegM(row.netPendapatanM)}</td>
                                    {i === 0 && <td className="font-bold sst-col-border" rowSpan="5" style={{verticalAlign: 'middle', backgroundColor: '#f8fafc'}}>{formatM(pendapatanEksistingInaM)}</td>}
                                    <td className="font-bold" style={{color: '#0d9488'}}>{formatM(row.totalPascaM)}</td>
                                    <td className="font-bold" style={{color: '#65a30d'}}>{formatPct(row.kenaikanPct)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="sst-footer">
                        <sup>1</sup> Skenario 1 fokus penambahan kasus Utama. Skenario 2 fokus penambahan kasus Dasar, Madya & Utama sekaligus.
                    </div>
                </div>

                <div className="sst-box">
                    <div className="sst-header">
                        SIMULASI SKENARIO 2<br/>
                        <span style={{fontSize: '0.75rem', fontWeight: 500}}>(PENAMBAHAN KASUS DASAR, MADYA & UTAMA vs PENGURANGAN KASUS PARIPURNA)</span>
                    </div>
                    <table className="sst-table">
                        <thead>
                            <tr>
                                <th rowSpan="2" className="sst-col-pct">%</th>
                                <th colSpan="4" style={{color: '#65a30d'}}>TAMBAHAN KASUS<br/>DASAR, MADYA & UTAMA</th>
                                <th colSpan="3" style={{color: '#ef4444'}}>PENGURANGAN KASUS<br/>PARIPURNA</th>
                                <th colSpan="3" style={{color: '#1e3a8a'}}>NET +/- PASCA iDRG & RBKP</th>
                                <th rowSpan="2" className="sst-col-border">PENDAPATAN<br/>EKSISTING<br/>(Rp M)</th>
                                <th rowSpan="2">TOTAL PENDAPATAN<br/>PASCA iDRG<br/>(Rp M)</th>
                                <th rowSpan="2">% KENAIKAN<br/>thd EKSISTING</th>
                            </tr>
                            <tr>
                                <th>Dasar (K)<br/>(Rp M)</th>
                                <th>Madya (K)<br/>(Rp M)</th>
                                <th>Utama (K)<br/>(Rp M)</th>
                                <th>TOTAL T<br/>(K)</th>
                                <th>%</th>
                                <th>Paripurna (K)</th>
                                <th>TOTAL K<br/>(Rp M)</th>
                                <th>+/- KASUS</th>
                                <th>% thd total<br/>kasus eksisting</th>
                                <th>+/- PENDAPATAN<br/>(Rp M)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {s2Rows.map((row, i) => (
                                <tr key={i}>
                                    <td className="dark-circle-cell"><div className="dark-circle">{row.pct}</div></td>
                                    <td>
                                        <div className="font-bold" style={{color: '#eab308'}}>{formatNum(row.detail.Dasar.k)}</div>
                                        <div className="font-bold" style={{color: '#65a30d'}}>{formatM(row.detail.Dasar.p)}</div>
                                    </td>
                                    <td>
                                        <div className="font-bold" style={{color: '#65a30d'}}>{formatNum(row.detail.Madya.k)}</div>
                                        <div className="font-bold" style={{color: '#65a30d'}}>{formatM(row.detail.Madya.p)}</div>
                                    </td>
                                    <td>
                                        <div className="font-bold" style={{color: '#1e3a8a'}}>{formatNum(row.detail.Utama.k)}</div>
                                        <div className="font-bold" style={{color: '#1e3a8a'}}>{formatM(row.detail.Utama.p)}</div>
                                    </td>
                                    <td className="font-bold" style={{color: '#65a30d', verticalAlign: 'middle'}}>{formatNum(row.tTotalKasus)}</td>
                                    <td className="font-bold" style={{color: '#ef4444', verticalAlign: 'middle'}}>100%</td>
                                    <td className="font-bold" style={{color: '#1e3a8a', verticalAlign: 'middle'}}>{formatNum(row.kurangKasus)}</td>
                                    <td className="font-bold" style={{color: '#1e3a8a', verticalAlign: 'middle'}}>{formatM(row.kurangSimM)}</td>
                                    <td className="font-bold" style={{color: '#1e3a8a', verticalAlign: 'middle'}}>{formatPosNeg(row.netKasus)}</td>
                                    <td className="font-bold" style={{color: '#1e3a8a', verticalAlign: 'middle'}}>{formatPct(row.netPct)}</td>
                                    <td className="font-bold" style={{color: '#65a30d', verticalAlign: 'middle'}}>{formatPosNegM(row.netPendapatanM)}</td>
                                    {i === 0 && <td className="font-bold sst-col-border" rowSpan="5" style={{verticalAlign: 'middle', backgroundColor: '#f8fafc'}}>{formatM(pendapatanEksistingInaM)}</td>}
                                    <td className="font-bold" style={{color: '#0d9488', verticalAlign: 'middle'}}>{formatM(row.totalPascaM)}</td>
                                    <td className="font-bold" style={{color: '#65a30d', verticalAlign: 'middle'}}>{formatPct(row.kenaikanPct)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SimulasiSkenarioTable;
