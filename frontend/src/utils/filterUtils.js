import { matchesGroup } from './rsGroups';

const TRIAL_KABS = [
  'KOTA BANDUNG', 'KOTA MAKASSAR', 
  'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 
  'KABUPATEN MUARA ENIM', 'MUARA ENIM'
];

const JABODETABEK_KABS = [
  'KOTA JAKARTA PUSAT', 'KOTA JAKARTA UTARA', 'KOTA JAKARTA BARAT', 'KOTA JAKARTA SELATAN', 'KOTA JAKARTA TIMUR',
  'BOGOR', 'KOTA BOGOR', 'DEPOK', 'KOTA DEPOK', 'TANGERANG', 'KOTA TANGERANG', 'KOTA TANGERANG SELATAN', 'BEKASI', 'KOTA BEKASI'
];

export const filterHospital = (rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter = null, excludeNonKomp = false) => {
  const hasGroupFilter = groupFilter && groupFilter.length > 0;
  const hasWilayahFilter = wilayahFilter && wilayahFilter.length > 0;
  const hasRsFilter = rsFilter && rsFilter.trim() !== '';
  const hasKabFilter = kabFilter && kabFilter.length > 0;

  if (!hasGroupFilter && !hasWilayahFilter && !hasRsFilter && !hasKabFilter) return true;

  // 1. Evaluate Group Match
  let groupMatch = false;
  if (hasGroupFilter) {
    groupMatch = matchesGroup(groupFilter, rs.nama, kode, rs);
  }

  // 2. Evaluate Wilayah Match
  let wilayahMatch = false;
  if (hasWilayahFilter) {
    const wilayahFilterUpper = wilayahFilter.map(w => (w || '').toUpperCase());
    const hasUji = wilayahFilterUpper.includes('UJI_COBA');
    let isUji = false;
    if (hasUji) {
      const kabUpper = (rs.kab || '').toUpperCase();
      isUji = TRIAL_KABS.some(k => kabUpper.includes(k) || kabUpper === 'KOTA BANDUNG' || kabUpper === 'KOTA MAKASSAR');
    }
    const hasJabo = wilayahFilterUpper.includes('JABODETABEK');
    let isJabo = false;
    if (hasJabo) {
      const kabUpper = (rs.kab || '').toUpperCase();
      const propUpper = (rs.prop || '').toUpperCase();
      isJabo = JABODETABEK_KABS.some(k => kabUpper.includes(k) || kabUpper === k) || propUpper === 'DKI JAKARTA';
    }

    const hasJabarExBebo = wilayahFilterUpper.includes('JABAR EX BEBODEPOK');
    let isJabarExBebo = false;
    if (hasJabarExBebo) {
      const propUpper = (rs.prop || '').toUpperCase();
      const kabUpper = (rs.kab || '').toUpperCase();
      const BEBODEPOK = ['BEKASI', 'KOTA BEKASI', 'BOGOR', 'KABUPATEN BOGOR', 'DEPOK', 'KOTA DEPOK'];
      if (propUpper === 'JAWA BARAT' && !BEBODEPOK.some(k => kabUpper.includes(k) || kabUpper === k)) {
        isJabarExBebo = true;
      }
    }

    const propUpper = (rs.prop || '').toUpperCase();
    const hasProp = wilayahFilterUpper.includes(propUpper);
    wilayahMatch = isUji || isJabo || isJabarExBebo || hasProp;
  }

  // 3. Evaluate RS Match
  let rsMatch = false;
  if (hasRsFilter) {
    const filterLower = rsFilter.toLowerCase();
    rsMatch = (rs.nama && rs.nama.toLowerCase().includes(filterLower)) || (kode && kode.toLowerCase().includes(filterLower));
  }

  // 4. Evaluate Kab Match
  let kabMatch = false;
  if (hasKabFilter) {
    const kabFilterUpper = kabFilter.map(k => (k || '').toUpperCase());
    const kabUpper = (rs.kab || '').toUpperCase();
    kabMatch = kabFilterUpper.includes(kabUpper);
  }

  if (isExcludeMode) {
    if (hasGroupFilter && groupMatch) return false;
    if (hasWilayahFilter && wilayahMatch) return false;
    if (hasRsFilter && rsMatch) return false;
    if (hasKabFilter && kabMatch) return false;
    return true; 
  } else {
    if (hasGroupFilter && !groupMatch) return false;
    if (hasWilayahFilter && !wilayahMatch) return false;
    if (hasRsFilter && !rsMatch) return false;
    if (hasKabFilter && !kabMatch) return false;
    return true; 
  }
};

