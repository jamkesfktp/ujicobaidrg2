// utils/formatters.js — Number and currency formatters

const IDR_BILLION = 1_000_000_000;
const IDR_TRILLION = 1_000_000_000_000;
const IDR_MILLION = 1_000_000;

/**
 * Format angka sebagai Rupiah singkat: T (triliun), M (miliar), jt (juta)
 */
export function fmtRp(val) {
  const n = Number(val);
  if (isNaN(n) || val == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= IDR_TRILLION)
    return `${sign}Rp ${(abs / IDR_TRILLION).toFixed(2)} T`;
  if (abs >= IDR_BILLION)
    return `${sign}Rp ${(abs / IDR_BILLION).toFixed(2)} M`;
  if (abs >= IDR_MILLION)
    return `${sign}Rp ${(abs / IDR_MILLION).toFixed(1)} jt`;
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

/**
 * Format angka sebagai Rupiah penuh (untuk tabel detail)
 */
export function fmtRpFull(val) {
  const n = Number(val);
  if (isNaN(n) || val == null) return '—';
  return `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}

/**
 * Format jumlah kasus (K untuk ribuan)
 */
export function fmtKasus(val) {
  const n = Number(val);
  if (isNaN(n) || val == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}jt`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('id-ID');
}

/**
 * Format persen
 */
export function fmtPct(val, digits = 1) {
  const n = Number(val);
  if (isNaN(n) || val == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

/**
 * Format rasio (misal 1.23×)
 */
export function fmtRasio(val) {
  const n = Number(val);
  if (isNaN(n) || val == null) return '—';
  return `${n.toFixed(3)}×`;
}

/**
 * Format miliar langsung (untuk grafik)
 */
export function fmtB(val) {
  const n = Number(val);
  if (isNaN(n)) return 0;
  return +(n / IDR_BILLION).toFixed(3);
}

/**
 * Selisih dengan warna: positif = hijau, negatif = merah
 */
export function getSelisihClass(val) {
  const n = Number(val);
  if (n > 0) return 'positive';
  if (n < 0) return 'negative';
  return '';
}
