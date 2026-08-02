export const formatCurrency = (value) => {
  return formatCompactCurrency(value);
};

export const formatCompactCurrency = (value) => {
  if (value === null || value === undefined) return 'Rp 0';
  return 'Rp ' + formatCompactNumber(value);
};

export const formatFullCurrency = (value) => {
  if (value === null || value === undefined) return 'Rp 0';
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
};

export const formatTableMiliar = (value) => {
  if (value === null || value === undefined) return '-';
  const valMiliar = value / 1000000000;
  const absVal = Math.abs(valMiliar);
  if (absVal > 0 && absVal < 1) {
    return valMiliar.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  return valMiliar.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatCompactNumber = (value) => {
  if (value === null || value === undefined) return '0';
  
  const absValue = Math.abs(value);
  let formattedValue = value;
  let suffix = '';

  if (absValue >= 1e12) {
    formattedValue = value / 1e12;
    suffix = ' T';
  } else if (absValue >= 1e9) {
    formattedValue = value / 1e9;
    suffix = ' M';
  } else if (absValue >= 1e6) {
    formattedValue = value / 1e6;
    suffix = ' Jt';
  } else if (absValue >= 1e3) {
    formattedValue = value / 1e3;
    suffix = ' Rb';
  }

  return formattedValue.toLocaleString('en-US', { maximumFractionDigits: 2 }) + suffix;
};

export const CMG_NAMES = {
  'G': 'Central nervous system',
  'H': 'Eye and adnexa',
  'U': 'Ear, nose, mouth & throat',
  'J': 'Respiratory system',
  'I': 'Cardiovascular system',
  'K': 'Digestive system',
  'B': 'Hepatobiliary & pancreatic system',
  'M': 'Musculoskeletal system & connective tissue',
  'L': 'Skin, subcutaneous tissue & breast',
  'E': 'Endocrine system, nutrition & metabolism',
  'N': 'Nephro-urinary system',
  'V': 'Male reproductive system',
  'W': 'Female reproductive system',
  'O': 'Deliveries',
  'P': 'Newborns & neonates',
  'D': 'Haemopoietic & immune system',
  'C': 'Myeloproliferative system & neoplasm',
  'A': 'Infectious & parasitic diseases',
  'F': 'Mental health and behavioural',
  'T': 'Substance abuse & dependence',
  'S': 'Injuries, poisonings & toxic effects of drugs',
  'Z': 'Factors influencing health status & other contacts',
  'Q': 'Rawat Jalan'
};

export const KELOMPOK_LAYANAN = [
  'saraf/ neuroscience', 'mata', 'tht', 'gigi dan mulut', 'paru dan pernafasan',
  'jantung dan pembuluh darah', 'pencernaan dan hepatobilier', 'musculoskeletal dan jaringan lunak',
  'kulit & penyakit kelamin', 'luka bakar', 'endokrin, nutrisi dan metabolik', 'uro nefro',
  'ibu dan ginekologi', 'neonatus', 'hematologi', 'alergi imunologi dan rheumatologi',
  'neoplasma', 'infeksi dan parasit', 'jiwa', 'keracunan', 'trauma', 'rehabilitasi',
  'forensik', 'rekonstruksi dan estetika'
];

export const KELOMPOK_TO_CMG = {
  'saraf/ neuroscience': 'G',
  'mata': 'H',
  'tht': 'U',
  'gigi dan mulut': 'U',
  'paru dan pernafasan': 'J',
  'jantung dan pembuluh darah': 'I',
  'pencernaan dan hepatobilier': 'K', // B is hepato, K is digestive. Let's use K
  'musculoskeletal dan jaringan lunak': 'M',
  'kulit & penyakit kelamin': 'L',
  'luka bakar': 'L',
  'endokrin, nutrisi dan metabolik': 'E',
  'uro nefro': 'N',
  'ibu dan ginekologi': 'O', // O, V, W
  'neonatus': 'P',
  'hematologi': 'D',
  'alergi imunologi dan rheumatologi': 'D',
  'neoplasma': 'C',
  'infeksi dan parasit': 'A',
  'jiwa': 'F',
  'keracunan': 'T',
  'trauma': 'S',
  'rehabilitasi': 'Z',
  'forensik': 'Z',
  'rekonstruksi dan estetika': 'Z',
  'rawat jalan': 'Q'
};

export const formatCmgLabel = (code) => {
  if (!code) return 'Unknown';
  let cleanCode = code.trim().toLowerCase();
  
  // If it's a kelompok string, get its CMG letter
  if (KELOMPOK_TO_CMG[cleanCode]) {
    cleanCode = KELOMPOK_TO_CMG[cleanCode];
  } else {
    cleanCode = cleanCode.toUpperCase();
  }

  // Look up English description
  if (CMG_NAMES[cleanCode]) {
    let label = CMG_NAMES[cleanCode];
    if (label.length > 30) label = label.substring(0, 30) + '...';
    return `${label} (${cleanCode})`;
  }
  return code.trim().toUpperCase();
};

export const MDC_NAMES = {
  '00': 'Pre MDC',
  '10': 'Pre MDC',
  '11': 'Diseases and Disorders of the Nervous System',
  '12': 'Diseases and Disorders of the Eye',
  '13': 'Diseases and Disorders of the Ear, Nose, Mouth and Throat',
  '14': 'Diseases and Disorders of the Respiratory System',
  '15': 'Diseases and Disorders of the Circulatory System',
  '16': 'Diseases and Disorders of the Digestive System',
  '17': 'Diseases and Disorders of the Hepatobiliary System and Pancreas',
  '18': 'Diseases and Disorders of the Musculoskeletal System and Connective Tissue',
  '19': 'Diseases and Disorders of the Skin, Subcutaneous Tissue and Breast',
  '20': 'Endocrine, Nutritional and Metabolic Diseases and Disorders',
  '21': 'Diseases and Disorders of the Kidney and Urinary Tract',
  '22': 'Diseases and Disorders of the Male Reproductive System',
  '23': 'Diseases and Disorders of the Female Reproductive System',
  '24': 'Pregnancy, Childbirth and the Puerperium',
  '25': 'Newborns & Other Neonates',
  '26': 'Diseases and Disorders of the Blood, Blood Forming Organs, Immunological',
  '27': 'Myeloproliferative Diseases and Disorders',
  '28': 'Infectious and Parasitic Diseases',
  '29': 'Mental Diseases and Disorders',
  '30': 'Alcohol/Drug Use or Induced Mental Disorders',
  '31': 'Injuries, Poisonings and Toxic Effects of Drugs',
  '32': 'Factors Influencing Health Status'
};

export const formatMdcLabel = (code) => {
  if (!code) return 'Unknown';
  const cleanCode = code.trim();
  if (MDC_NAMES[cleanCode]) {
    // Truncate if too long to prevent chart squeezing
    let label = MDC_NAMES[cleanCode];
    if (label.length > 35) label = label.substring(0, 35) + '...';
    return `${label} (${cleanCode})`;
  }
  return cleanCode;
};
