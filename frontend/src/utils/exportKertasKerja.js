import * as XLSX from 'xlsx';

const formatTableMiliar = (val) => {
  if (!val || isNaN(val)) return '0';
  return (val / 1000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const exportKertasKerja = (
  selectedRs, hospitalsData, profilesData, simulasiKey, wilayahFilter, kabFilter, currentRows, h1, h2
) => {
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // Sheet 1: Profil RS
  // -------------------------------------------------------------
  const rsInfo = hospitalsData && selectedRs ? hospitalsData[selectedRs.value] : null;
  const profile = profilesData && selectedRs ? profilesData[selectedRs.value] : null;

  let sheet1AOA = [['Tingkat Kompetensi', 'Jumlah Kasus', '% Kasus RS', 'INA-CBG (Rp M)', 'iDRG (Rp M)', 'Selisih (Rp M)', '% Selisih']];
  
  if (profile && profile.crosstab && profile.crosstab.byKompetensi) {
    const levels = ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'];
    const lblMap = {
      'dasar': 'Dasar',
      'madya': 'Madya',
      'utama': 'Utama',
      'paripurna': 'Paripurna',
      'Belum ada komp. ICD': 'Lainnya*'
    };
    const tableData = levels.map(lvl => ({ lvl, kasus: 0, ina: 0, idrg: 0 }));
    let totalKasus = 0;

    Object.values(profile.crosstab.byKompetensi).forEach(classMap => {
      ['rj', 'ri'].forEach(t => {
        if (classMap[t]) {
          levels.forEach((lvl, idx) => {
            const d = classMap[t][lvl];
            if (d) {
              const cases = d.kasus || 0;
              let inacbg = d.inacbg || 0;
              let sim = 0;
              if (d.sim && simulasiKey) {
                sim = d.sim[simulasiKey] || d.sim[simulasiKey.replace('tarif', 'sim')] || 0;
              }
              tableData[idx].kasus += cases;
              tableData[idx].ina += inacbg;
              tableData[idx].idrg += sim;
              totalKasus += cases;
            }
          });
        }
      });
    });

    let sumIna = 0, sumIdrg = 0;
    tableData.forEach(row => {
      row.selisih = row.idrg - row.ina;
      row.pctSelisih = row.ina > 0 ? (row.selisih / row.ina) * 100 : 0;
      row.pctKasus = totalKasus > 0 ? (row.kasus / totalKasus) * 100 : 0;
      sumIna += row.ina;
      sumIdrg += row.idrg;

      sheet1AOA.push([
        lblMap[row.lvl],
        row.kasus,
        (row.pctKasus).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%',
        row.ina / 1000000000,
        row.idrg / 1000000000,
        row.selisih / 1000000000,
        (row.pctSelisih > 0 ? '+' : '') + (row.pctSelisih).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%'
      ]);
    });

    const totalSelisih = sumIdrg - sumIna;
    const totalPct = sumIna > 0 ? (totalSelisih / sumIna) * 100 : 0;
    
    sheet1AOA.push([
      'Total',
      totalKasus,
      '100.0%',
      sumIna / 1000000000,
      sumIdrg / 1000000000,
      totalSelisih / 1000000000,
      (totalPct > 0 ? '+' : '') + (totalPct).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%'
    ]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1AOA);
  XLSX.utils.book_append_sheet(wb, ws1, 'Profil RS');

  // -------------------------------------------------------------
  // Sheet 2: Profil Kasus Regional
  // -------------------------------------------------------------
  let sheet2AOA = [
    ['Data Regional'],
    [],
    ['Top 5 RS Regional', 'Kelas', 'Jumlah Kasus']
  ];
  
  if (hospitalsData && selectedRs) {
    const regHospitals = [];
    Object.keys(hospitalsData).forEach(id => {
      const h = hospitalsData[id];
      if (wilayahFilter && wilayahFilter.length > 0 && !wilayahFilter.includes(h.prop)) return;
      if (kabFilter && kabFilter.length > 0 && !kabFilter.includes(h.kab)) return;
      if ((!wilayahFilter || wilayahFilter.length === 0) && (!kabFilter || kabFilter.length === 0)) {
        if (!selectedRs || !hospitalsData[selectedRs.value] || h.prop !== hospitalsData[selectedRs.value].prop) return;
      }
      regHospitals.push({ id, ...h });
    });

    const topHospitals = [...regHospitals].sort((a, b) => (b.kasus || 0) - (a.kasus || 0)).slice(0, 5);
    topHospitals.forEach(h => {
      sheet2AOA.push([h.nama, h.kelasFaskes, h.kasus]);
    });

    sheet2AOA.push([]);
    sheet2AOA.push(['Sebaran Tingkat Kompetensi Regional', 'Kasus', '%']);
    
    const compCases = { dasar: 0, madya: 0, utama: 0, paripurna: 0, lainnya: 0 };
    let regTotalKasus = 0;
    
    regHospitals.forEach(h => {
      const p = profilesData[h.id];
      if (!p || !p.crosstab || !p.crosstab.byKompetensi) return;
      Object.values(p.crosstab.byKompetensi).forEach(classMap => {
        ['rj', 'ri'].forEach(t => {
          if (classMap[t]) {
            compCases.dasar += (classMap[t]['dasar']?.kasus || 0);
            compCases.madya += (classMap[t]['madya']?.kasus || 0);
            compCases.utama += (classMap[t]['utama']?.kasus || 0);
            compCases.paripurna += (classMap[t]['paripurna']?.kasus || 0);
            compCases.lainnya += (classMap[t]['Belum ada komp. ICD']?.kasus || 0);
          }
        });
      });
    });
    
    regTotalKasus = compCases.dasar + compCases.madya + compCases.utama + compCases.paripurna + compCases.lainnya;
    
    const cData = [
      { lbl: 'Dasar', val: compCases.dasar },
      { lbl: 'Madya', val: compCases.madya },
      { lbl: 'Utama', val: compCases.utama },
      { lbl: 'Paripurna', val: compCases.paripurna },
      { lbl: 'Lainnya', val: compCases.lainnya }
    ];
    
    cData.forEach(c => {
      sheet2AOA.push([c.lbl, c.val, regTotalKasus > 0 ? (c.val/regTotalKasus*100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})+'%' : '0%']);
    });
    sheet2AOA.push(['Total', regTotalKasus, '100.0%']);
  }
  
  const ws2 = XLSX.utils.aoa_to_sheet(sheet2AOA);
  XLSX.utils.book_append_sheet(wb, ws2, 'Profil Regional');

  // -------------------------------------------------------------
  // Sheet 3: Kompetensi ICD Regional
  // -------------------------------------------------------------
  let sheet3AOA = [['Kompetensi', 'Total Kasus', '%', 'Estimasi Nilai Rujukan (Miliar)']];
  
  if (hospitalsData && selectedRs) {
    const regHospitals = [];
    Object.keys(hospitalsData).forEach(id => {
      const h = hospitalsData[id];
      if (wilayahFilter && wilayahFilter.length > 0 && !wilayahFilter.includes(h.prop)) return;
      if (kabFilter && kabFilter.length > 0 && !kabFilter.includes(h.kab)) return;
      if ((!wilayahFilter || wilayahFilter.length === 0) && (!kabFilter || kabFilter.length === 0)) {
        if (!selectedRs || !hospitalsData[selectedRs.value] || h.prop !== hospitalsData[selectedRs.value].prop) return;
      }
      regHospitals.push({ id, ...h });
    });

    const compDataExt = {
      dasar: { c: 0, t: 0 },
      madya: { c: 0, t: 0 },
      utama: { c: 0, t: 0 },
      paripurna: { c: 0, t: 0 },
      lainnya: { c: 0, t: 0 }
    };

    regHospitals.forEach(h => {
      const p = profilesData[h.id];
      if (!p || !p.crosstab || !p.crosstab.byKompetensi) return;
      Object.values(p.crosstab.byKompetensi).forEach(classMap => {
        ['rj', 'ri'].forEach(type => {
          if (classMap[type]) {
            ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(k => {
              const d = classMap[type][k];
              if (d) {
                const mapK = k === 'Belum ada komp. ICD' ? 'lainnya' : k;
                compDataExt[mapK].c += (d.kasus || 0);
                compDataExt[mapK].t += ((d.sim && d.sim[simulasiKey]) || 0);
              }
            });
          }
        });
      });
    });

    const regTotal = Object.values(compDataExt).reduce((acc, curr) => acc + curr.c, 0);
    const order = ['dasar', 'madya', 'utama', 'paripurna', 'lainnya'];
    const lblMap = { dasar: 'Dasar', madya: 'Madya', utama: 'Utama', paripurna: 'Paripurna', lainnya: 'Lainnya' };

    order.forEach(k => {
      const d = compDataExt[k];
      sheet3AOA.push([
        lblMap[k],
        d.c,
        regTotal > 0 ? (d.c/regTotal*100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})+'%' : '0%',
        d.t / 1000000000
      ]);
    });
  }
  
  const ws3 = XLSX.utils.aoa_to_sheet(sheet3AOA);
  XLSX.utils.book_append_sheet(wb, ws3, 'Komp ICD Regional');

  // -------------------------------------------------------------
  // Sheet 4: Simulasi
  // -------------------------------------------------------------
  const fmtM = (val) => val / 1000000000;
  
  const toArr = (lbl, r) => [
    lbl, 
    r.pA+'%', r.kasusA, fmtM(r.pendA), 
    r.pB+'%', r.kasusB, fmtM(r.pendB), 
    r.pC+'%', r.kasusC, fmtM(r.pendC), 
    r.pD+'%', r.kasusD, fmtM(r.pendD), 
    r.netKasus, r.pctThd.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})+'%', 
    fmtM(r.netPendapatan), fmtM(r.eksisting), r.pctKenaikan.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})+'%'
  ];
  
  const sheet4AOA = [h1, h2, ...currentRows.map((r, i) => toArr(i+1, r))];
  const ws4 = XLSX.utils.aoa_to_sheet(sheet4AOA);
  XLSX.utils.book_append_sheet(wb, ws4, 'Simulasi Kasus');

  // Download
  XLSX.writeFile(wb, `Kertas_Kerja_${selectedRs?.label?.split(' (')[0] || 'RS'}.xlsx`);
};
