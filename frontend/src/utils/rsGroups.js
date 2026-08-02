// Shared RS Group Filter constants
export const RS_VERTIKAL_KODES = new Set([
  '1275655','1371010','1375036','1671013','1671072',
  '3171012','3171435','3172013','3172749','3173014',
  '3174041','3174063','3174260','3174282','3175064',
  '3201024','3271046','3273015','3273191','3273201',
  '3310015','3371040','3372051','3372063','3373042',
  '3374010','3404015','3507026','3578811','3671032',
  '5171016','5303056','7109028','7171013','7371314',
  '7371325','7371436','7371453','8171123'
]);

export const RS_GROUPS = [
  { key: 'muhammadiyah', label: 'Muhammadiyah', color: '#27ae60', match: (nama, kode) => /muham[m]?adiyah|'?[aA]isyiyah|\bpku\b|universitas ahmad dahlan|fatimah banyuwangi|aisyah madiun|aminah blitar|roemani|siti khadijah.*gorontalo|islam jakarta|islam kendal|islam purwokerto|islam banjarmasin|islam klender/i.test(nama) },
  { key: 'hermina',      label: 'Hermina',       color: '#2980b9', match: (nama, kode) => /hermina/i.test(nama) },
  { key: 'siloam',       label: 'Siloam',        color: '#8e44ad', match: (nama, kode) => /siloam/i.test(nama) },
  { key: 'primaya',      label: 'Primaya',        color: '#e67e22', match: (nama, kode) => /primaya/i.test(nama) },
  { key: 'mitrakeluarga', label: 'Mitra Keluarga', color: '#16a085', match: (nama, kode) => /mitra keluarga/i.test(nama) },
  { 
    key: 'pemerintah', 
    label: 'RSUD (Pemerintah)', 
    color: '#2980b9', 
    match: (nama, kode, rs) => rs?.pemilik === 'P' && !RS_VERTIKAL_KODES.has(kode) && !/\b(TNI|POLRI|BHAYANGKARA|RSPAD|RSAL|RSAU|RSAD|DKT|LANUD|LANTAMAL|RUMKIT TK|RS AL(?!\s*[-]?\s*(FUADI|ISLAM|HUDA|ROHMAH|AZIZ|IRSYAD|FATAH|IHSAN|KHAIRIYAH|MULIA|AMIN|ARIFIN|MUKMIN|SYIFA|HIKMAH|MADINAH|HASAN|HUSAIN|ILYAS)))\b/i.test(nama) 
  },
  {
    key: 'pemerintah_all',
    label: 'RS Pemerintah (Semua P)',
    color: '#0284c7',
    match: (nama, kode, rs) => rs?.pemilik === 'P'
  },
  { 
    key: 'swasta', 
    label: 'RS Swasta', 
    color: '#27ae60', 
    match: (nama, kode, rs) => rs?.pemilik === 'S' 
  },
  { 
    key: 'tni', 
    label: 'RS TNI', 
    color: '#8e44ad', 
    match: (nama, kode, rs) => /\b(TNI|RSPAD|RSAL|RSAU|RSAD|DKT|LANUD|LANTAMAL|RUMKIT TK|RS AL(?!\s*[-]?\s*(FUADI|ISLAM|HUDA|ROHMAH|AZIZ|IRSYAD|FATAH|IHSAN|KHAIRIYAH|MULIA|AMIN|ARIFIN|MUKMIN|SYIFA|HIKMAH|MADINAH|HASAN|HUSAIN|ILYAS)))\b/i.test(nama) 
  },
  { 
    key: 'polri', 
    label: 'RS POLRI', 
    color: '#34495e', 
    match: (nama, kode, rs) => /\b(POLRI|BHAYANGKARA)\b/i.test(nama) 
  },
  { 
    key: 'vertikal', 
    label: 'RS Vertikal', 
    color: '#c0392b', 
    match: (nama, kode) => RS_VERTIKAL_KODES.has(kode) 
  },
];

/**
 * Check if a hospital matches ANY of the group filter keys.
 * @param {string[]} groupKeys - Array of group filter keys
 * @param {string} nama - Hospital name
 * @param {string} kode - Hospital code
 * @param {object} rs - Hospital object containing pemilik
 * @returns {boolean}
 */
export const matchesGroup = (groupKeys, nama, kode, rs) => {
  if (!groupKeys || groupKeys.length === 0) return true; // 'Semua RS' — no filter
  
  // Categorize selected filters
  const facets = {
    jenis: [],
    jenisfaskes: [],
    kelas: [],
    pemilik: [],
    layanan: []
  };

  groupKeys.forEach(key => {
    if (key.startsWith('jenisfaskes_')) facets.jenisfaskes.push(key);
    else if (key.startsWith('jenis_')) facets.jenis.push(key);
    else if (key.startsWith('kelas_')) facets.kelas.push(key);
    else if (key.startsWith('pemilik_')) facets.pemilik.push(key);
    else if (key.startsWith('layanan_')) facets.layanan.push(key);
    else facets.pemilik.push(key); // Fallback for old group keys
  });

  // Check each facet: if a facet has selected filters, the RS MUST match AT LEAST ONE of them
  
  // 1. Jenis Facet
  if (facets.jenis.length > 0) {
    const matchJenis = facets.jenis.some(groupKey => {
      const targetJenis = groupKey.replace('jenis_', '');
      return rs?.jenis === targetJenis;
    });
    if (!matchJenis) return false;
  }

  // 1b. Jenis Faskes Facet
  if (facets.jenisfaskes.length > 0) {
    const matchJenisFaskes = facets.jenisfaskes.some(groupKey => {
      const targetJenisFaskes = groupKey.replace('jenisfaskes_', '');
      return rs?.jenisFaskes === targetJenisFaskes;
    });
    if (!matchJenisFaskes) return false;
  }

  // 2. Kelas Facet
  if (facets.kelas.length > 0) {
    const matchKelas = facets.kelas.some(groupKey => {
      const group = RS_GROUPS.find(g => g.key === groupKey);
      return group ? group.match(nama, kode, rs) : false;
    });
    if (!matchKelas) return false;
  }

  // 3. Pemilik Facet
  if (facets.pemilik.length > 0) {
    const matchPemilik = facets.pemilik.some(groupKey => {
      const group = RS_GROUPS.find(g => g.key === groupKey);
      return group ? group.match(nama, kode, rs) : false;
    });
    if (!matchPemilik) return false;
  }

  return true;
};

export const PROVINCES = [
  'NAD', 'SUMATERA UTARA', 'SUMATERA BARAT', 'RIAU', 'JAMBI', 'SUMATERA SELATAN',
  'BENGKULU', 'LAMPUNG', 'BANGKA BELITUNG', 'KEPULAUAN RIAU', 'DKI JAKARTA',
  'JAWA BARAT', 'JAWA TENGAH', 'DIY', 'JAWA TIMUR', 'BANTEN', 'BALI', 'NTB', 'NTT',
  'KALIMANTAN BARAT', 'KALIMANTAN TENGAH', 'KALIMANTAN SELATAN', 'KALIMANTAN TIMUR',
  'KALIMANTAN UTARA', 'SULAWESI UTARA', 'SULAWESI TENGAH', 'SULAWESI SELATAN',
  'SULAWESI TENGGARA', 'GORONTALO', 'SULAWESI BARAT', 'MALUKU', 'MALUKU UTARA',
  'PAPUA BARAT', 'PAPUA', 'PAPUA TENGAH', 'PAPUA PEGUNUNGAN'
].sort();
