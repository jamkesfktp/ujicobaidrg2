// utils/api.js — Centralized API client
const BASE = '/api';

export async function apiFetch(endpoint, params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null && v !== '' && v !== 'all')
  );
  const q   = new URLSearchParams(clean).toString();
  const url = q ? `${BASE}${endpoint}?${q}` : `${BASE}${endpoint}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  nasional: {
    summary:       (p) => apiFetch('/nasional/summary',       p),
    byProvinsi:    (p) => apiFetch('/nasional/by-provinsi',   p),
    byDrg:         (p) => apiFetch('/nasional/by-drg',        p),
    byKompetensi:  (p) => apiFetch('/nasional/by-kompetensi', p),
    byKelompok:    (p) => apiFetch('/nasional/by-kelompok',   p),
    byKelas:       (p) => apiFetch('/nasional/by-kelas',      p),
    filterOptions: (p) => apiFetch('/nasional/filter-options', p),
    inacbgDetail:  (p) => apiFetch('/nasional/inacbg-detail',  p),
  },
  peta: {
    inacbgList: (p)       => apiFetch('/peta/inacbg-list', p),
    inacbg:     (p)       => apiFetch('/peta/inacbg',      p),
    byIdrg:     (p)       => apiFetch('/peta/by-idrg',     p),
    byRs:       (p)       => apiFetch('/peta/by-rs',       p),
  },
  strategis: {
    rsList:   (p)       => apiFetch('/strategis/rs-list', p),
    rsDetail: (kode, p) => apiFetch(`/strategis/rs/${kode}`, p),
    compare:  (p)       => apiFetch('/strategis/compare', p),
  },
  shifting: {
    list:    (p) => apiFetch('/shifting',        p),
    byDrg:   (p) => apiFetch('/shifting/by-drg', p),
    summary: (p) => apiFetch('/shifting/summary', p),
  },
  tren: {
    bulanan:        (p) => apiFetch('/tren/bulanan',          p),
    byKelompokBulan:(p) => apiFetch('/tren/by-kelompok-bulan',p),
    bulanList:      (p) => apiFetch('/tren/bulan-list',       p),
  },
  costweight: {
    list:       (p) => apiFetch('/costweight',            p),
    byKelompok: (p) => apiFetch('/costweight/by-kelompok',p),
    heatmap:    (p) => apiFetch('/costweight/heatmap',    p),
  },
  anggaran: {
    perbandingan: (p) => apiFetch('/anggaran/perbandingan', p),
    byProvinsi:   (p) => apiFetch('/anggaran/by-provinsi',  p),
    byKelas:      (p) => apiFetch('/anggaran/by-kelas',     p),
  },
};
