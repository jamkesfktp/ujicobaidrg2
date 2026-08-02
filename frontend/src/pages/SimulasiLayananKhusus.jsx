import React, { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { Eye, TrendingUp, Download, Sliders, Info, MapPin, Activity, PieChart } from 'lucide-react';
import * as XLSX from 'xlsx';
import { loadDatasetFile } from '../utils/dataLoader';
import { filterHospital } from '../utils/filterUtils';
import { formatTableMiliar } from '../utils/formatters';
import { exportKertasKerja } from '../utils/exportKertasKerja';
import RsProfileModal from '../components/RsProfileModal';
import KertasKerjaModal from '../components/KertasKerjaModal';
import RsComparisonSection from '../components/RsComparisonSection';
import RegionalProfileSection from '../components/RegionalProfileSection';
import RegionalCompetencySection from '../components/RegionalCompetencySection';
import './SimulasiLayananKhusus.css';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS & PRESETS
// ─────────────────────────────────────────────────────────────
const MAIN_LEVELS = ['Dasar', 'Madya', 'Utama', 'Paripurna'];
const ALL_LEVELS = ['Dasar', 'Madya', 'Utama', 'Paripurna', 'Lainnya'];

const KOMP_OPTIONS = [
  { value: 'Dasar', label: 'Dasar' },
  { value: 'Madya', label: 'Madya' },
  { value: 'Utama', label: 'Utama' },
  { value: 'Paripurna', label: 'Paripurna' },
  { value: 'Lainnya', label: 'Lainnya / Tdk Kompeten' },
];

const INITIAL_SCENARIOS = [
  { id: 1, pA: 100, pB: 30, pC: 100, pD: 100 },
  { id: 2, pA: 75,  pB: 20, pC: 75,  pD: 100 },
  { id: 3, pA: 50,  pB: 10, pC: 50,  pD: 100 },
  { id: 4, pA: 25,  pB: 5,  pC: 25,  pD: 100 },
  { id: 5, pA: 10,  pB: 5,  pC: 10,  pD: 100 },
  { id: 6, pA: 5,   pB: 2,  pC: 5,   pD: 100 },
  { id: 7, pA: 0,   pB: 0,  pC: 0,   pD: 100 },
  { id: 8, pA: 0,   pB: 0,  pC: 0,   pD: 100 },
];

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
const fmtM  = (n) => formatTableMiliar(n || 0);
const fmtN  = (n) => (Math.round(n || 0)).toLocaleString('id-ID');

const isJabo = (kab, prop) => {
  const JABODETABEK_KABS = [
    'KOTA JAKARTA PUSAT', 'KOTA JAKARTA UTARA', 'KOTA JAKARTA BARAT', 'KOTA JAKARTA SELATAN', 'KOTA JAKARTA TIMUR',
    'BOGOR', 'KOTA BOGOR', 'DEPOK', 'KOTA DEPOK', 'TANGERANG', 'KOTA TANGERANG', 'KOTA TANGERANG SELATAN', 'BEKASI', 'KOTA BEKASI'
  ];
  return JABODETABEK_KABS.some(k => (kab||'').toUpperCase().includes(k) || (kab||'').toUpperCase() === k) || (prop||'').toUpperCase() === 'DKI JAKARTA';
};

const isJabarExBebo = (kab, prop) => {
  const BEBODEPOK_KABS = ['BEKASI', 'KOTA BEKASI', 'BOGOR', 'KABUPATEN BOGOR', 'DEPOK', 'KOTA DEPOK'];
  return (prop||'').toUpperCase() === 'JAWA BARAT' && !BEBODEPOK_KABS.some(k => (kab||'').toUpperCase().includes(k) || (kab||'').toUpperCase() === k);
};

const makePtdProcessor = (simulasiKey, excludeNonKomp) => (ptdMap, result, levelFilter) => {
  Object.entries(ptdMap || {}).forEach(([ptd, kompMap]) => {
    Object.entries(kompMap || {}).forEach(([komp, cObj]) => {
      let k = komp.charAt(0).toUpperCase() + komp.slice(1);
      if (komp.toLowerCase().includes('belum ada komp')) {
        k = 'Lainnya';
      }
      if (excludeNonKomp && !MAIN_LEVELS.includes(k)) return;
      if (!MAIN_LEVELS.includes(k) && !excludeNonKomp && k !== 'Lainnya') return;
      if (levelFilter && !levelFilter.includes(k)) return;

      const simVal = (cObj.sim || cObj)[simulasiKey] || 0;
      result.kasus += cObj.kasus || 0;
      result.ina   += cObj.inacbg || 0;
      result.sim   += simVal;
    });
  });
};

// ─────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
const SimulasiLayananKhusus = ({ dataset, simulasi, groupFilter = [], wilayahFilter = [], rsFilter = '', isExcludeMode = false, kabFilter = [], excludeNonKomp = false, globalMonth, globalDrg, rsKompetensiOnline }) => {
  const [hospData, setHospData] = useState(null);
  const [profilesData, setProfilesData] = useState(null);
  const [shiftingData, setShiftingData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Selections
  const [rsOptions, setRsOptions] = useState([]);
  const [layananOptions, setLayananOptions] = useState([]);
  const [selectedRs, setSelectedRs] = useState(null);
  const [selectedLayanan, setSelectedLayanan] = useState([]);
  const [selectedProvinsi, setSelectedProvinsi] = useState([]);
  const [selectedKabupaten, setSelectedKabupaten] = useState([]);
  
  // Dynamic Headers Configurations
  const [selTambahUtama, setSelTambahUtama] = useState([KOMP_OPTIONS[2], KOMP_OPTIONS[3]]);
  const [selTambahLain, setSelTambahLain] = useState([KOMP_OPTIONS[0]]);
  const [selKurangUtama, setSelKurangUtama] = useState([KOMP_OPTIONS[0], KOMP_OPTIONS[1]]);
  const [selKurangLain, setSelKurangLain] = useState([KOMP_OPTIONS[4], KOMP_OPTIONS[1], KOMP_OPTIONS[2], KOMP_OPTIONS[3]]);
  
  // Modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showKertasKerja, setShowKertasKerja] = useState(false);

  const [pendapatanRef, setPendapatanRef] = useState('all'); // 'all' or 'layanan'

  // Table Inputs
  const [scenarioRows, setScenarioRows] = useState(INITIAL_SCENARIOS);

  const simulasiKey = `tarif_${simulasi || 2}`;
  const processPtdMap = useMemo(() => makePtdProcessor(simulasiKey, excludeNonKomp), [simulasiKey, excludeNonKomp]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'rs_profiles', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'shifting', globalMonth, globalDrg)
    ]).then(([hosp, prof, shift]) => {
      setHospData(hosp); setProfilesData(prof); setShiftingData(shift);
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });
  }, [dataset]);

  useEffect(() => {
    if (selectedRs && profilesData && profilesData[selectedRs.value]) {
      const byLay = profilesData[selectedRs.value].crosstab?.byLayanan || {};
      const opts = Object.keys(byLay).map(k => ({ label: k.charAt(0).toUpperCase() + k.slice(1), value: k }));
      setLayananOptions([{ label: '=== PILIH SEMUA LAYANAN ===', value: 'ALL' }, ...opts]);
      
      // Auto-select if there's exactly 1 service for this hospital
      if (opts.length === 1) {
        if (!selectedLayanan || selectedLayanan.length === 0 || selectedLayanan[0].value !== opts[0].value) {
          setSelectedLayanan([opts[0]]);
        }
      }
    } else {
      setLayananOptions([]);
      setSelectedLayanan([]);
    }
  }, [selectedRs, profilesData]);

  let provOpts = [], kabOpts = [];
  if (hospData) {
    const provSet = new Set(), kabSet = new Set();
    Object.values(hospData).forEach(rs => {
      if (rs.prop) provSet.add(rs.prop);
      if (rs.kab && rs.prop) {
        const matchProv = selectedProvinsi.length === 0 || selectedProvinsi.some(p => p.value === rs.prop) || (selectedProvinsi.some(p => p.value === 'JABODETABEK') && isJabo(rs.kab, rs.prop)) || (selectedProvinsi.some(p => p.value === 'Jabar ex Bebodepok') && isJabarExBebo(rs.kab, rs.prop));
        if (matchProv) kabSet.add(`${rs.kab} (${rs.prop})`);
      }
    });
    provOpts = [{ value: 'JABODETABEK', label: 'JABODETABEK' }, { value: 'Jabar ex Bebodepok', label: 'Jabar ex Bebodepok' }, ...Array.from(provSet).sort().map(p => ({value: p, label: p}))];
    kabOpts = Array.from(kabSet).sort().map(k => ({value: k, label: k}));
  }

  useEffect(() => {
    if (!hospData) return;
    setRsOptions(Object.entries(hospData)
      .filter(([kode, rs]) => filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp))
      .map(([kode, rs]) => ({ value: kode, label: `${rs.nama || 'Unknown'} (${kode})`, prop: rs.prop, kab: rs.kab })));
  }, [hospData, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp]);

  useEffect(() => {
    if (wilayahFilter && wilayahFilter.length > 0) {
      setSelectedProvinsi(wilayahFilter.map(p => ({ value: p, label: p })));
    } else {
      if (selectedRs && selectedRs.prop) {
        setSelectedProvinsi([{ value: selectedRs.prop, label: selectedRs.prop }]);
      } else {
        setSelectedProvinsi([]);
      }
    }

    if (kabFilter && kabFilter.length > 0) {
      setSelectedKabupaten(kabFilter.map(k => ({ value: k, label: k })));
    } else {
      setSelectedKabupaten([]);
    }
  }, [selectedRs, wilayahFilter, kabFilter]);

  const updateScenario = (id, field, val) => {
    const newVal = Math.max(0, Math.min(100, Number(val) || 0));
    setScenarioRows(prev => prev.map(r => r.id === id ? { ...r, [field]: newVal } : r));
  };

  // ─────────────────────────────────────────────────────────────
  //  COMPUTE
  // ─────────────────────────────────────────────────────────────
  const computed = useMemo(() => {
    const zeroResult = () => ({ kasus: 0, ina: 0, sim: 0 });
    let totalKasusEks = 0, totalInaEks = 0, totalSimEks = 0;
    let layKasusEks = 0, layInaEks = 0, laySimEks = 0;
    let rincianLayanan = { Dasar: 0, Madya: 0, Utama: 0, Paripurna: 0, Lainnya: 0, total: 0 };
    let rincianSelainLayanan = { Dasar: 0, Madya: 0, Utama: 0, Paripurna: 0, Lainnya: 0, total: 0 };
    let colA = zeroResult(), colB = zeroResult(), colC = zeroResult(), colD = zeroResult();

    if (!selectedRs || !selectedLayanan || selectedLayanan.length === 0 || !profilesData || !hospData) {
      return { colA, colB, colC, colD, totalKasusEks, totalInaEks, totalSimEks, layKasusEks, layInaEks, laySimEks, rincianLayanan, rincianSelainLayanan };
    }

    const layananKeys = selectedLayanan.map(o => o.value.toLowerCase().trim());
    const prof = profilesData[selectedRs.value];
    const byLayanan = prof?.crosstab?.byLayanan || {};

    const tambahUtamaKomp = selTambahUtama.map(o => o.value);
    const tambahLainKomp = selTambahLain.map(o => o.value);
    const kurangUtamaKomp = selKurangUtama.map(o => o.value);
    const kurangLainKomp = selKurangLain.map(o => o.value);

    // Iterate over ALL services to compute totals and subtractions
    Object.entries(byLayanan).forEach(([ptd, ptdData]) => {
      const isSelectedLayanan = layananKeys.includes(ptd.toLowerCase().trim());
      let isTidakKompeten = false;
      let rsLvl = 'tidak kompeten';
      if (rsKompetensiOnline && selectedRs && selectedRs.value && rsKompetensiOnline[selectedRs.value] && rsKompetensiOnline[selectedRs.value][ptd.toLowerCase().trim()]) {
         rsLvl = rsKompetensiOnline[selectedRs.value][ptd.toLowerCase().trim()].toLowerCase();
      }
      if (rsLvl === 'tidak kompeten' || rsLvl === 'belum ada komp. icd') {
        isTidakKompeten = true;
      } else {
        let hasKomp = false;
           if (ptdData?.byKompetensi) {
             Object.values(ptdData.byKompetensi).forEach(ptdMap => {
               ['rj', 'ri'].forEach(t => {
                 if (ptdMap[t]) {
                   if ((ptdMap[t].dasar?.kasus || 0) > 0) hasKomp = true;
                   if ((ptdMap[t].madya?.kasus || 0) > 0) hasKomp = true;
                   if ((ptdMap[t].utama?.kasus || 0) > 0) hasKomp = true;
                   if ((ptdMap[t].paripurna?.kasus || 0) > 0) hasKomp = true;
                 }
               });
             });
           }
           isTidakKompeten = !hasKomp;
      }

      if (ptdData?.byKompetensi) {
        Object.values(ptdData.byKompetensi).forEach(ptdMap => {
          ALL_LEVELS.forEach(k => {
             const tempRes = zeroResult();
             processPtdMap(ptdMap, tempRes, [k]);
             
             totalKasusEks += tempRes.kasus;
             totalInaEks += tempRes.ina;
             totalSimEks += tempRes.sim;

             if (isSelectedLayanan) {
               layKasusEks += tempRes.kasus;
               layInaEks += tempRes.ina;
               laySimEks += tempRes.sim;
               rincianLayanan[k] += tempRes.kasus;
               rincianLayanan.total += tempRes.kasus;
             } else {
               rincianSelainLayanan[k] += tempRes.kasus;
               rincianSelainLayanan.total += tempRes.kasus;
             }
          });
          
          if (isSelectedLayanan) {
             if (kurangUtamaKomp.length > 0) {
                processPtdMap(ptdMap, colC, kurangUtamaKomp);
             }
          } else {
             if (isTidakKompeten) {
                processPtdMap(ptdMap, colD, ALL_LEVELS);
             } else if (kurangLainKomp.length > 0) {
                processPtdMap(ptdMap, colD, kurangLainKomp);
             }
          }
        });
      }
    });

    // 4. SHIFTING REGIONAL
    if (shiftingData) {
      const hasJaboSel = selectedProvinsi.some(p => p.value === 'JABODETABEK');
      const hasJabarExBeboSel = selectedProvinsi.some(p => p.value === 'Jabar ex Bebodepok');

      for (const prop in shiftingData) {
        for (const kab in shiftingData[prop]) {
          const matchProv = selectedProvinsi.length > 0 && (selectedProvinsi.some(p => p.value === prop) || (hasJaboSel && isJabo(kab, prop)) || (hasJabarExBeboSel && isJabarExBebo(kab, prop)));
          const matchKab = selectedKabupaten.length > 0 && selectedKabupaten.some(k => k.value === `${kab} (${prop})`);
          
          let isIncluded = false;
          if (selectedProvinsi.length === 0 && selectedKabupaten.length === 0) isIncluded = true;
          else if (selectedProvinsi.length > 0 && selectedKabupaten.length === 0) isIncluded = matchProv;
          else if (selectedProvinsi.length === 0 && selectedKabupaten.length > 0) isIncluded = matchKab;
          else isIncluded = matchKab;

          if (isIncluded) {
            for (const kel in shiftingData[prop][kab]) {
              const normKel = kel.toLowerCase().trim();
              const shiftNode = shiftingData[prop][kab][kel];
              
              let hospLevelsForService = new Set();
              let isCompetent = false;
              let officialComp = null;
              let isExplicitlyIncompetent = false;

              if (rsKompetensiOnline && selectedRs && selectedRs.value && rsKompetensiOnline[selectedRs.value] && rsKompetensiOnline[selectedRs.value][normKel]) {
                const cmp = rsKompetensiOnline[selectedRs.value][normKel].toLowerCase();
                if (cmp === 'tidak kompeten' || cmp === 'belum ada komp. icd') {
                   isExplicitlyIncompetent = true;
                } else if (cmp !== 'unknown') {
                   officialComp = cmp.charAt(0).toUpperCase() + cmp.slice(1);
                   isCompetent = true;
                }
              }

              const scorecardKey = Object.keys(prof?.scorecard?.byKelompok || {}).find(k => k.toLowerCase().trim() === normKel);
              if (scorecardKey && !isExplicitlyIncompetent) {
                const sesuaiKasus = prof.scorecard.byKelompok[scorecardKey]?.sesuai?.kasus || 0;
                if (sesuaiKasus > 0) isCompetent = true;
              }

              if (isCompetent && !isExplicitlyIncompetent) {
                if (officialComp) {
                  if (officialComp === 'Paripurna') ['Dasar', 'Madya', 'Utama', 'Paripurna'].forEach(l => hospLevelsForService.add(l));
                  if (officialComp === 'Utama') ['Dasar', 'Madya', 'Utama'].forEach(l => hospLevelsForService.add(l));
                  if (officialComp === 'Madya') ['Dasar', 'Madya'].forEach(l => hospLevelsForService.add(l));
                  if (officialComp === 'Dasar') hospLevelsForService.add('Dasar');
                } else if (prof?.crosstab?.byLayanan) {
                  const exactKey = Object.keys(prof.crosstab.byLayanan).find(k => k.toLowerCase().trim() === normKel);
                  if (exactKey) {
                    const lData = prof.crosstab.byLayanan[exactKey];
                    if (lData?.byKompetensi) {
                      Object.values(lData.byKompetensi).forEach(ptdMap => {
                        Object.values(ptdMap || {}).forEach(kompMap => {
                          Object.keys(kompMap || {}).forEach(komp => {
                            const k = komp.charAt(0).toUpperCase() + komp.slice(1);
                            if (MAIN_LEVELS.includes(k)) hospLevelsForService.add(k);
                          });
                        });
                      });
                    }
                  }
                }
              }

              if (hospLevelsForService.size === 0) continue;

              const hasActiveRsFilter = rsFilter || (groupFilter && groupFilter.length > 0) || excludeNonKomp;
              
              let activeDemand = {};
              if (shiftNode.demandByRs) {
                for (const rsId in shiftNode.demandByRs) {
                  if (rsId === String(selectedRs.value)) continue;
                  const rsObj = hospData[rsId];
                  if (hasActiveRsFilter && (!rsObj || !filterHospital(rsObj, rsId, groupFilter, [], rsFilter, isExcludeMode, [], excludeNonKomp))) continue;
                  
                  for (const komp in shiftNode.demandByRs[rsId].kasusByKlaim || {}) {
                    const compKey = komp.toLowerCase().trim();
                    if (!activeDemand[compKey]) activeDemand[compKey] = { kasus: 0, inacbg: 0, sim: 0 };
                    const d = shiftNode.demandByRs[rsId].kasusByKlaim[komp];
                    activeDemand[compKey].kasus += d.kasus || 0;
                    activeDemand[compKey].inacbg += d.inacbg || 0;
                    activeDemand[compKey].sim += d.sim?.[simulasiKey] || 0;
                  }
                }
              } else {
                for (const komp in shiftNode.demand || {}) {
                  const compKey = komp.toLowerCase().trim();
                  if (!activeDemand[compKey]) activeDemand[compKey] = { kasus: 0, inacbg: 0, sim: 0 };
                  const d = shiftNode.demand[komp];
                  activeDemand[compKey].kasus += d.kasus || 0;
                  activeDemand[compKey].inacbg += d.inacbg || 0;
                  activeDemand[compKey].sim += d.sim?.[simulasiKey] || 0;
                }
              }
              const isSelectedLayanan = layananKeys.includes('all') || layananKeys.includes(normKel);

              if (isSelectedLayanan) {
                for (const compKey in activeDemand) {
                  const k = compKey.charAt(0).toUpperCase() + compKey.slice(1);
                  if (excludeNonKomp && !MAIN_LEVELS.includes(k)) continue;
                  if (!hospLevelsForService.has(k)) continue;
                  if (tambahUtamaKomp.includes(k)) {
                    const d = activeDemand[compKey];
                    colA.kasus += d.kasus || 0;
                    colA.ina   += d.inacbg || 0;
                    colA.sim   += d.sim || 0;
                  }
                }
              } else {
                for (const compKey in activeDemand) {
                  const k = compKey.charAt(0).toUpperCase() + compKey.slice(1);
                  if (excludeNonKomp && !MAIN_LEVELS.includes(k)) continue;
                  if (!hospLevelsForService.has(k)) continue;
                  if (tambahLainKomp.includes(k)) {
                    const d = activeDemand[compKey];
                    colB.kasus += d.kasus || 0;
                    colB.ina   += d.inacbg || 0;
                    colB.sim   += d.sim || 0;
                  }
                }
              }
            }
          }
        }
      }
    }

    return { colA, colB, colC, colD, totalKasusEks, totalInaEks, totalSimEks, layKasusEks, layInaEks, laySimEks, rincianLayanan, rincianSelainLayanan };
  }, [selectedRs, selectedLayanan, profilesData, shiftingData, hospData, processPtdMap, simulasiKey, selectedProvinsi, selectedKabupaten, excludeNonKomp, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, selTambahUtama, selTambahLain, selKurangUtama, selKurangLain]);

  const refInaEks = pendapatanRef === 'all' ? computed.totalInaEks : computed.layInaEks;
  const refSimEks = pendapatanRef === 'all' ? computed.totalSimEks : computed.laySimEks;
  const refKasusEks = pendapatanRef === 'all' ? computed.totalKasusEks : computed.layKasusEks;

  const computeRow = (pA, pB, pC, pD) => {
    const { colA, colB, colC, colD } = computed;
    const kasusA  = Math.round(colA.kasus * pA / 100);
    const avgSimA = colA.kasus > 0 ? colA.sim / colA.kasus : 0;
    const pendA   = kasusA * avgSimA;

    const kasusB  = Math.round(colB.kasus * pB / 100);
    const avgSimB = colB.kasus > 0 ? colB.sim / colB.kasus : 0;
    const pendB   = kasusB * avgSimB;

    const kasusC  = Math.round(colC.kasus * pC / 100);
    const avgInaC = colC.kasus > 0 ? colC.ina / colC.kasus : 0;
    const pendC   = kasusC * avgInaC;

    const kasusD  = Math.round(colD.kasus * pD / 100);
    const avgInaD = colD.kasus > 0 ? colD.ina / colD.kasus : 0;
    const pendD   = kasusD * avgInaD;

    const netKasus      = kasusA + kasusB - kasusC - kasusD;
    const netPendapatan = pendA  + pendB  - pendC  - pendD;
    const pctThd        = refKasusEks > 0 ? (netKasus / refKasusEks) * 100 : 0;
    const pctKenaikan   = refInaEks   > 0 ? (netPendapatan / refInaEks) * 100 : 0;

    return { pA, pB, pC, pD, kasusA, pendA, kasusB, pendB, kasusC, pendC, kasusD, pendD,
             netKasus, netPendapatan, pctThd, pctKenaikan, eksisting: refInaEks };
  };

  const currentRows = useMemo(() => scenarioRows.map(r => ({ ...r, ...computeRow(r.pA, r.pB, r.pC, r.pD) })), [scenarioRows, computed, pendapatanRef]);

  const exportExcel = () => {
    const lbl = selectedLayanan.length > 0 
      ? (selectedLayanan.length >= layananOptions.length - 1 ? 'Semua Layanan' : selectedLayanan.length === 1 ? selectedLayanan[0].label : `${selectedLayanan.length} Layanan`)
      : 'Layanan';
    
    const thTambah = selTambahUtama.length ? selTambahUtama.map(o=>o.label).join(', ') : 'None';
    const thTambahL = selTambahLain.length ? selTambahLain.map(o=>o.label).join(', ') : 'None';
    const thKurang = selKurangUtama.length ? selKurangUtama.map(o=>o.label).join(', ') : 'None';
    const thKurangL = selKurangLain.length ? selKurangLain.map(o=>o.label).join(', ') : 'None';

    const h1  = ['Skenario',
      `Tambahan Kasus Layanan ${lbl} (${thTambah})`,'','',
      `Tambahan Kasus Selain Layanan ${lbl} (${thTambahL})`,'','',
      `Pengurangan Kasus Layanan ${lbl} (${thKurang})`,'','',
      `Pengurangan Layanan Non ${lbl} (${thKurangL})`,'','',
      'Net +/- Pasca iDRG & RBKP','','',
      `Pendapatan Eksisting INA-CBG RS (Rp. M)`,
      '% Kenaikan thd INA-CBG Eksisting*',
    ];
    const h2 = ['','Persentase (%)','Jumlah Kasus','Tambahan Pendapatan (Rp M)','Persentase (%)','Jumlah Kasus','Tambahan Pendapatan (Rp M)','Persentase (%)','Jumlah Kasus','Pengurangan Pendapatan (Rp M)','Persentase (%)','Jumlah Kasus','Pengurangan Pendapatan (Rp M)','+/- Jumlah Kasus','% thd total kasus eksisting','+/- Pendapatan (Rp M)','',''];
      exportKertasKerja(
        selectedRs, hospData, profilesData, simulasiKey, wilayahFilter, kabFilter, currentRows, h1, h2
      );
    };

    React.useEffect(() => {
      window.handleExportKertasKerjaExcel = exportExcel;
      return () => { delete window.handleExportKertasKerjaExcel; };
    }, [exportExcel]);

    if (loading) return <div className="slk-container" style={{ textAlign:'center', padding:60, color:'#64748b' }}>Memuat data...</div>;

  const lbl = selectedLayanan.length > 0 
    ? (selectedLayanan.length >= layananOptions.length - 1 ? 'Semua Layanan' : selectedLayanan.length === 1 ? selectedLayanan[0].label : `${selectedLayanan.length} Layanan`)
    : 'Layanan';
  const ready = selectedRs && selectedLayanan.length > 0;
  const rsNameForHeader = selectedRs ? selectedRs.label.split(' (')[0] : 'RS';

  return (
    <div className="slk-container">
      <div className="slk-header">
        <div className="slk-header-inner">
          <div className="slk-header-badge"><Eye size={12}/> Simulasi Layanan Khusus</div>
          <h1 className="slk-header-title">
            Simulasi iDRG &amp; RBKP — {selectedRs ? selectedRs.label : 'Pilih Rumah Sakit'}
          </h1>
          <p className="slk-header-subtitle">
            Proyeksi dampak perubahan tarif berdasarkan skenario tambah/kurang kasus per layanan &amp; kompetensi.
          </p>
        </div>
      </div>

      <div className="slk-controls-panel" style={{ marginBottom:20 }}>
        <div className="slk-controls-title"><Sliders size={18} color="#0891b2"/> Filter Utama & Skenario</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16, marginBottom:16 }}>
          <div>
            <label style={LST}>Rumah Sakit</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <Select options={rsOptions} value={selectedRs} onChange={setSelectedRs} placeholder="Cari RS..." isClearable styles={SST}/>
              </div>
              {selectedRs && profilesData?.[selectedRs.value] && (
                <button 
                  onClick={() => setShowProfileModal(true)}
                  style={{ background: '#14b8a6', color: 'white', border: 'none', borderRadius: '4px', padding: '0 16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Profil RS
                </button>
              )}
            </div>
          </div>
            <div>
              <label style={LST}>Layanan Utama RS</label>
              <Select 
                isMulti
                options={layananOptions} 
                value={selectedLayanan} 
                onChange={(vals) => {
                  if (vals && vals.find(v => v.value === 'ALL')) {
                     setSelectedLayanan(layananOptions.filter(o => o.value !== 'ALL'));
                  } else {
                     setSelectedLayanan(vals || []);
                  }
                }}
                placeholder="Pilih Layanan..." 
                isClearable 
                styles={SST}
              />
            </div>
        </div>
        
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16, marginBottom:16, padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
          <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            Pengaturan Kompetensi Skenario (Kolom Dinamis)
          </div>
          <div>
            <label style={LST}>Tambahan Kasus Layanan {lbl}</label>
            <Select isMulti options={KOMP_OPTIONS} value={selTambahUtama} onChange={setSelTambahUtama} styles={SST} placeholder="Pilih..." />
          </div>
          <div>
            <label style={LST}>Tambahan Kasus Selain Layanan {lbl}</label>
            <Select isMulti options={KOMP_OPTIONS} value={selTambahLain} onChange={setSelTambahLain} styles={SST} placeholder="Pilih..." />
          </div>
          <div>
            <label style={LST}>Pengurangan Kasus Layanan {lbl}</label>
            <Select isMulti options={KOMP_OPTIONS} value={selKurangUtama} onChange={setSelKurangUtama} styles={SST} placeholder="Pilih..." />
          </div>
          <div>
            <label style={LST}>Pengurangan Layanan Non {lbl}</label>
            <Select isMulti options={KOMP_OPTIONS} value={selKurangLain} onChange={setSelKurangLain} styles={SST} placeholder="Pilih..." />
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px', fontStyle: 'italic', lineHeight: 1.2 }}>
              *Otomatis mengurangi seluruh kasus jika RS Tidak Kompeten di layanan terkait.
            </p>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16, marginBottom:16, paddingTop: 16, borderTop: '1px dashed #cbd5e1' }}>
          <div>
            <label style={LST}><MapPin size={14} style={{display:'inline', marginRight:4}}/> Provinsi Shifting</label>
            <Select options={provOpts} value={selectedProvinsi} onChange={(val) => { setSelectedProvinsi(val); setSelectedKabupaten([]); }} isMulti placeholder="Semua Provinsi..." styles={SST}/>
          </div>
          <div>
            <label style={LST}>Kabupaten Shifting</label>
            <Select options={kabOpts} value={selectedKabupaten} onChange={setSelectedKabupaten} isMulti placeholder="Semua Kabupaten..." styles={SST}/>
          </div>
          <div>
            <label style={LST}>Referensi Pendapatan Eksisting (Denominator)</label>
            <select style={{...SST.control({}), width:'100%', padding:'8px 12px'}} value={pendapatanRef} onChange={e => setPendapatanRef(e.target.value)}>
              <option value="all">Seluruh Layanan RS (Total)</option>
              <option value="layanan">Hanya Layanan Terpilih ({lbl})</option>
            </select>
          </div>
        </div>

        {!ready && (
          <div style={{ marginTop: 24, padding: '12px 16px', background: '#fefce8', borderRadius: 8, border: '1px solid #fef08a', color: '#a16207', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem' }}>
            <Info size={18} />
            Silakan pilih <b>Rumah Sakit</b> dan <b>Layanan Utama RS</b> terlebih dahulu agar tabel simulasi dapat ditampilkan.
          </div>
        )}

        {/* PROFILE MODAL */}
        {showProfileModal && selectedRs && profilesData?.[selectedRs.value] && (
          <RsProfileModal 
            rs={selectedRs}
            profile={profilesData[selectedRs.value]}
            onClose={() => setShowProfileModal(false)}
            simulasiKey={simulasiKey}
            rsKompetensiOnline={rsKompetensiOnline}
          />
        )}

        {/* KERTAS KERJA MODAL */}
        {showKertasKerja && ready && (
          <KertasKerjaModal 
            computed={computed}
            onClose={() => setShowKertasKerja(false)}
          />
        )}
      </div>

      {/* ── KPI & Scorecards ── */}
      {ready && (
        <>
          {/* Laporan Komprehensif Tambahan */}
          <RsComparisonSection 
            selectedRs={selectedRs} 
            profile={profilesData[selectedRs.value]} 
            simulasiKey={simulasiKey} 
          />
          <RegionalProfileSection 
            selectedRs={selectedRs} 
            hospitalsData={hospData} 
            profilesData={profilesData} 
            simulasiKey={simulasiKey} 
            wilayahFilter={selectedProvinsi.map(p => p.value)}
            kabFilter={selectedKabupaten.map(k => k.value)}
          />
          <RegionalCompetencySection 
            selectedRs={selectedRs} 
            hospitalsData={hospData} 
            profilesData={profilesData} 
            simulasiKey={simulasiKey} 
            wilayahFilter={selectedProvinsi.map(p => p.value)}
            kabFilter={selectedKabupaten.map(k => k.value)}
          />

          {/* Top Scorecards (Totals) */}
          <div className="slk-kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
             <div className="slk-kpi-card" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                <div className="slk-kpi-icon-label" style={{ color:'#0369a1' }}><Activity size={14}/> Total Kasus Seluruh Layanan</div>
                <div className="slk-kpi-value" style={{ color:'#0369a1', fontSize: '1.8rem' }}>{fmtN(computed.totalKasusEks)}</div>
                <div className="slk-kpi-sub">Seluruh pelayanan di RS</div>
             </div>
             <div className="slk-kpi-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div className="slk-kpi-icon-label" style={{ color:'#15803d' }}><PieChart size={14}/> Total Kasus Layanan {lbl}</div>
                <div className="slk-kpi-value" style={{ color:'#15803d', fontSize: '1.8rem' }}>{fmtN(computed.layKasusEks)}</div>
                <div className="slk-kpi-sub">Hanya pelayanan {lbl}</div>
             </div>
             <div className="slk-kpi-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                <div className="slk-kpi-icon-label" style={{ color:'#b45309' }}><TrendingUp size={14}/> Referensi Pendapatan INA-CBG</div>
                <div className="slk-kpi-value" style={{ color:'#b45309', fontSize: '1.8rem' }}>Rp {fmtM(refInaEks)} M</div>
                <div className="slk-kpi-sub">{pendapatanRef === 'all' ? 'Dari Seluruh Layanan' : `Dari Layanan ${lbl}`}</div>
             </div>
             <div className="slk-kpi-card" style={{ background: '#f5f3ff', borderColor: '#ddd6fe' }}>
                <div className="slk-kpi-icon-label" style={{ color:'#6d28d9' }}><Activity size={14}/> Referensi Pendapatan iDRG</div>
                <div className="slk-kpi-value" style={{ color:'#6d28d9', fontSize: '1.8rem' }}>Rp {fmtM(refSimEks)} M</div>
                <div className="slk-kpi-sub">{pendapatanRef === 'all' ? 'Dari Seluruh Layanan' : `Dari Layanan ${lbl}`}</div>
             </div>
          </div>

          {/* Rincian Kompetensi Layanan Terpilih */}
          <div className="slk-controls-panel" style={{ marginBottom: 24, padding: '16px 20px', background: 'white' }}>
             <div className="slk-controls-title" style={{ marginBottom: 12 }}><Info size={16} color="#0891b2"/> Rincian Kasus Layanan {lbl} (Eksisting)</div>
             <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {ALL_LEVELS.map(k => {
                  const val = computed.rincianLayanan[k] || 0;
                  const pct = computed.rincianLayanan.total > 0 ? (val / computed.rincianLayanan.total) * 100 : 0;
                  return (
                    <div key={k} style={{ flex: 1, minWidth: '100px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                       <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                          {k === 'Lainnya' ? 'Lainnya / Tdk Kompeten' : k}
                       </div>
                       <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{fmtN(val)}</div>
                       <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0891b2', marginTop: 2 }}>{pct.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</div>
                    </div>
                  );
                })}
             </div>
          </div>

          {/* Rincian Kompetensi Selain Layanan Terpilih */}
          <div className="slk-controls-panel" style={{ marginBottom: 24, padding: '16px 20px', background: 'white' }}>
             <div className="slk-controls-title" style={{ marginBottom: 12 }}><Info size={16} color="#ea580c"/> Rincian Kasus Selain Layanan {lbl} (Eksisting)</div>
             <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {ALL_LEVELS.map(k => {
                  const val = computed.rincianSelainLayanan[k] || 0;
                  const pct = computed.rincianSelainLayanan.total > 0 ? (val / computed.rincianSelainLayanan.total) * 100 : 0;
                  return (
                    <div key={k} style={{ flex: 1, minWidth: '100px', padding: '12px', background: '#fff7ed', borderRadius: '8px', border: '1px solid #ffedd5', textAlign: 'center' }}>
                       <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9a3412', marginBottom: 4 }}>
                          {k === 'Lainnya' ? 'Lainnya / Tdk Kompeten' : k}
                       </div>
                       <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#9a3412' }}>{fmtN(val)}</div>
                       <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ea580c', marginTop: 2 }}>{pct.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</div>
                    </div>
                  );
                })}
             </div>
          </div>
        </>
      )}

      {/* ── TABEL UTAMA ── */}
      {ready && (
        <div className="slk-table-section">
          <div className="slk-table-header">
            <h3 className="slk-table-title">Tabel Skenario — {selectedRs.label}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="slk-btn-export" 
                style={{ background: '#2563eb', color: 'white', borderColor: '#1d4ed8' }} 
                onClick={() => setShowKertasKerja(true)}
              >
                <Info size={14}/> Kertas Kerja
              </button>
              <button className="slk-btn-export slk-btn-excel" onClick={exportExcel}>
                <Download size={14}/> Export Excel
              </button>
            </div>
          </div>

          <div className="slk-table-wrapper" style={{ overflowX: 'auto', paddingBottom: '16px' }}>
            <table className="slk-main-table" style={{ borderCollapse: 'collapse', width: '100%', minWidth: '1600px' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ minWidth:60 }}>Skenario</th>
                  <th colSpan={3}>
                    Tambahan Kasus Layanan {lbl}<br/>
                    {selTambahUtama.length ? selTambahUtama.map(o=>o.label).join(' & ') : '(Tidak Ada)'}
                  </th>
                  <th colSpan={3}>
                    Tambahan Kasus Selain Layanan {lbl}<br/>
                    {selTambahLain.length ? selTambahLain.map(o=>o.label).join(' & ') : '(Tidak Ada)'}
                  </th>
                  <th colSpan={3}>
                    Pengurangan Kasus Layanan {lbl}<br/>
                    {selKurangUtama.length ? selKurangUtama.map(o=>o.label).join(' & ') : '(Tidak Ada)'}
                  </th>
                  <th colSpan={3}>
                    Pengurangan Layanan Non {lbl}*<br/>
                    {selKurangLain.length ? selKurangLain.map(o=>o.label).join(' & ') : '(Tidak Ada)'}
                  </th>
                  <th colSpan={3}>Net +/- Pasca iDRG &amp; RBKP</th>
                  <th rowSpan={2} style={{ minWidth:110 }}>
                    Pendapatan Eksisting<br/>INA-CBG {rsNameForHeader} (Rp. M)
                  </th>
                  <th rowSpan={2} style={{ minWidth:90 }}>
                    % Kenaikan<br/>thd INA-CBG<br/>Eksisting*
                  </th>
                </tr>
                <tr>
                  <th>Persentase<br/>(%)</th>
                  <th>Jumlah Kasus</th>
                  <th>Tambahan<br/>Pendapatan<br/>(Rp M)</th>
                  <th>Persentase<br/>(%)</th>
                  <th>Jumlah Kasus</th>
                  <th>Tambahan<br/>Pendapatan<br/>(Rp M)</th>
                  <th>Persentase<br/>(%)</th>
                  <th>Jumlah Kasus</th>
                  <th>Pengurangan<br/>Pendapatan<br/>(Rp M)</th>
                  <th>Persentase<br/>(%)</th>
                  <th>Jumlah Kasus</th>
                  <th>Pengurangan<br/>Pendapatan<br/>(Rp M)</th>
                  <th>+/- Jumlah Kasus</th>
                  <th>% thd total kasus eksisting</th>
                  <th>+/- Pendapatan (Rp M)</th>
                </tr>
              </thead>

              <tbody>
                {currentRows.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="td-skenario">{r.id}</td>

                    {/* INPUT Dinamis persentase */}
                    <td style={{ padding: '6px' }}>
                       <input type="number" min="0" max="100" value={r.pA} onChange={e => updateScenario(r.id, 'pA', e.target.value)}
                              style={{ width: '50px', textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                    </td>
                    <td className="td-cases">{fmtN(r.kasusA)}</td>
                    <td className="td-tambah">{fmtM(r.pendA)}</td>

                    <td style={{ padding: '6px' }}>
                       <input type="number" min="0" max="100" value={r.pB} onChange={e => updateScenario(r.id, 'pB', e.target.value)}
                              style={{ width: '50px', textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                    </td>
                    <td className="td-cases">{fmtN(r.kasusB)}</td>
                    <td className="td-tambah">{fmtM(r.pendB)}</td>

                    <td style={{ padding: '6px' }}>
                       <input type="number" min="0" max="100" value={r.pC} onChange={e => updateScenario(r.id, 'pC', e.target.value)}
                              style={{ width: '50px', textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                    </td>
                    <td className="td-cases">{fmtN(r.kasusC)}</td>
                    <td className="td-kurang">{fmtM(r.pendC)}</td>

                    {/* D — Pengurangan Layanan Non (Dinamic pD) */}
                    <td style={{ padding: '6px' }}>
                       <input type="number" min="0" max="100" value={r.pD} onChange={e => updateScenario(r.id, 'pD', e.target.value)}
                              style={{ width: '50px', textAlign: 'center', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                    </td>
                    <td className="td-cases">{fmtN(r.kasusD)}</td>
                    <td className="td-kurang">{fmtM(r.pendD)}</td>

                    <td style={{ color: r.netKasus >= 0 ? '#11b09b' : '#ea580c', fontWeight: 600 }}>{r.netKasus}</td>
                    <td style={{ color: r.pctThd >= 0 ? '#11b09b' : '#ea580c', fontWeight: 600 }}>{r.pctThd.toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})}%</td>
                    <td style={{ color: r.netPendapatan >= 0 ? '#11b09b' : '#ea580c', fontWeight: 800 }}>{fmtM(r.netPendapatan)}</td>

                    {/* Eksisting — rowspan=8 di baris pertama saja */}
                    {idx === 0 ? (
                      <td rowSpan={currentRows.length} className="td-existing" style={{ verticalAlign:'middle', fontWeight: 800, fontSize: '1.1rem', background: '#f8fafc' }}>
                        {fmtM(r.eksisting)}
                      </td>
                    ) : null}

                    <td className="td-pct-kenaikan" style={{ color: r.pctKenaikan >= 0 ? '#11b09b' : '#ea580c' }}>
                      {r.pctKenaikan.toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const LST = { display:'block', fontSize:'0.75rem', fontWeight:600, color:'#475569', marginBottom:4 };
const SST = {
  control:    (b) => ({ ...b, borderRadius:'8px', border:'1px solid #e2e8f0', fontSize:'0.83rem', background:'white', minHeight:'36px' }),
  menuPortal: (b) => ({ ...b, zIndex:9999 }),
  menu:       (b) => ({ ...b, fontSize:'0.83rem' }),
  multiValue: (b) => ({ ...b, backgroundColor:'rgba(14,116,144,0.1)', borderRadius:'4px' }),
};

export default SimulasiLayananKhusus;
