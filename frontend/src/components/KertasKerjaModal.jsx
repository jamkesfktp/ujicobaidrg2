import React from 'react';
import { X, Calculator, ArrowRight, Info } from 'lucide-react';

const formatRp = (num) => {
  if (!num || isNaN(num)) return 'Rp 0';
  if (num >= 1000000000) return `Rp ${(num / 1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Miliar`;
  if (num >= 1000000) return `Rp ${(num / 1000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Juta`;
  return `Rp ${num.toLocaleString('id-ID')}`;
};

const KertasKerjaModal = ({ computed, onClose }) => {
  const { colA, colB, colC, colD } = computed;

  const getAvg = (kasus, val) => kasus > 0 ? (val / kasus) : 0;

  const renderBaseCol = (title, data, isSim) => {
    const avg = getAvg(data.kasus, isSim ? data.sim : data.ina);
    return (
      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' }}>{title}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Total Kasus Basis</div>
            <div style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>{data.kasus.toLocaleString('id-ID')} Kasus</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Total {isSim ? 'SIM' : 'INA-CBG'} Basis</div>
            <div style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>{formatRp(isSim ? data.sim : data.ina)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Rata-rata per Kasus</div>
            <div style={{ fontSize: '1.1rem', color: '#2563eb', fontWeight: 700 }}>{formatRp(avg)}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '900px', maxHeight: '90vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        {/* HEADER */}
        <div style={{ background: '#2563eb', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={24} /> Kertas Kerja Perhitungan Simulasi
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}>
            <X size={28} />
          </button>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#ffffff' }}>
          
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '16px', borderRadius: '8px', color: '#1e3a8a', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Info size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '4px', fontSize: '1.05rem' }}>Bagaimana nilai di Tabel Skenario dihitung?</strong>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                Tabel skenario dihitung secara otomatis dengan mengalikan <strong>Persentase Skenario</strong> dengan <strong>Total Kasus Basis</strong> untuk setiap kolom. Nilai pendapatan kemudian didapat dari perkalian antara kasus baru (hasil persentase) dengan <strong>Rata-rata Pendapatan per Kasus</strong> dari data basis tersebut.
              </p>
            </div>
          </div>

          <h3 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            1. Nilai Basis Kolom Dinamis (Sebelum Persentase)
          </h3>
          
          {renderBaseCol('Kolom A: Tambahan Kasus Layanan Utama', colA, true)}
          {renderBaseCol('Kolom B: Tambahan Kasus Selain Layanan Utama', colB, true)}
          {renderBaseCol('Kolom C: Pengurangan Kasus Layanan Utama', colC, false)}
          {renderBaseCol('Kolom D: Pengurangan Kasus Selain Layanan Utama', colD, false)}

          <h3 style={{ fontSize: '1.2rem', color: '#0f172a', marginTop: '32px', marginBottom: '16px' }}>
            2. Rumus Matematika Perhitungan Skenario
          </h3>
          
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem' }}>
                <div style={{ background: '#e2e8f0', padding: '4px 12px', borderRadius: '4px', fontWeight: 700, minWidth: '150px' }}>Kasus Baru (A/B/C/D)</div>
                <ArrowRight size={16} color="#64748b" />
                <div><code>Math.round( Total Kasus Basis &times; Persentase Skenario )</code></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem' }}>
                <div style={{ background: '#e2e8f0', padding: '4px 12px', borderRadius: '4px', fontWeight: 700, minWidth: '150px' }}>Pendapatan Baru</div>
                <ArrowRight size={16} color="#64748b" />
                <div><code>Kasus Baru &times; Rata-rata per Kasus (Basis)</code></div>
              </div>
              <div style={{ height: '1px', background: '#cbd5e1', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem' }}>
                <div style={{ background: '#dbeafe', color: '#1e3a8a', padding: '4px 12px', borderRadius: '4px', fontWeight: 800, minWidth: '150px' }}>Net +/- Kasus</div>
                <ArrowRight size={16} color="#64748b" />
                <div><code style={{ fontWeight: 700, color: '#15803d' }}>(Kasus A + Kasus B)</code> <code style={{ fontWeight: 700, color: '#b91c1c' }}>- (Kasus C + Kasus D)</code></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.95rem' }}>
                <div style={{ background: '#dbeafe', color: '#1e3a8a', padding: '4px 12px', borderRadius: '4px', fontWeight: 800, minWidth: '150px' }}>Net +/- Pendapatan</div>
                <ArrowRight size={16} color="#64748b" />
                <div><code style={{ fontWeight: 700, color: '#15803d' }}>(Pendapatan A + Pendapatan B)</code> <code style={{ fontWeight: 700, color: '#b91c1c' }}>- (Pendapatan C + Pendapatan D)</code></div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default KertasKerjaModal;
