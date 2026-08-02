import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, TrendingUp, BarChart2, Map, Stethoscope, ArrowRightLeft, LayoutDashboard, ChevronLeft, ChevronRight, LayoutTemplate, Eye } from 'lucide-react';

const Sidebar = ({ mobileMenuOpen, setMobileMenuOpen, globalMonth, setGlobalMonth, globalDrg, setGlobalDrg }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {mobileMenuOpen && <div className="mobile-overlay" onClick={closeMobileMenu}></div>}
      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button className="collapse-btn desktop-only" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <button className="collapse-btn mobile-only" onClick={closeMobileMenu}>
            <ChevronLeft size={20} />
          </button>
        </div>
      <div className="logo-container">
        <img 
          src="/logo-kemenkes.png" 
          alt="Logo Kemenkes" 
          className="logo-img"
        />
        <span className="logo-text">Dashboard Simulasi INA-CBG</span>
      </div>
      
      {!isCollapsed && (
        <div style={{ padding: '0 16px 16px 16px', borderBottom: '1px solid #334155', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Filter Global</div>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.7rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Bulan Data</label>
            <select 
              value={globalMonth} 
              onChange={(e) => setGlobalMonth(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: '#334155', color: '#f8fafc', border: '1px solid #475569', fontSize: '0.8rem' }}
            >
              <option value="all">Semua Bulan</option>
              <option value="okt">Oktober 2025</option>
              <option value="nov">November 2025</option>
              <option value="des">Desember 2025</option>
              <option value="jan">Januari 2026</option>
              <option value="feb">Februari 2026</option>
              <option value="mar">Maret 2026</option>
              <option value="apr">April 2026</option>
              <option value="mei">Mei 2026</option>
              <option value="jun">Juni 2026</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Jenis DRG</label>
            <select 
              value={globalDrg} 
              onChange={(e) => setGlobalDrg(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', background: '#334155', color: '#f8fafc', border: '1px solid #475569', fontSize: '0.8rem' }}
            >
              <option value="all">Semua DRG</option>
              <option value="1363">1363 DRG (Eksisting)</option>
              <option value="mst">DRG MST Baru</option>
            </select>
          </div>
        </div>
      )}
      
      <nav className="nav-menu">
        <NavLink to="/" title="Overview" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <BarChart2 size={20} />
          <span>Overview</span>
        </NavLink>
        <NavLink to="/nasional" title="Laporan Nasional" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <LayoutDashboard size={20} />
          <span>Laporan Nasional</span>
        </NavLink>
        <NavLink to="/kompetensi" title="Analisis Kompetensi" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <TrendingUp size={20} />
          <span>Analisis Kompetensi</span>
        </NavLink>
        <NavLink to="/wilayah" title="Analisis Wilayah" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <Map size={20} />
          <span>Analisis Wilayah</span>
        </NavLink>
        <NavLink to="/shifting" title="Potensi Shifting RS" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <ArrowRightLeft size={20} />
          <span>Potensi Shifting RS</span>
        </NavLink>
        <NavLink to="/layanan" title="Detail Rumah Sakit" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <Stethoscope size={20} />
          <span>Detail Rumah Sakit</span>
        </NavLink>
        <NavLink to="/idrg" title="Analisis iDRG" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <Activity size={20} />
          <span>Analisis iDRG</span>
        </NavLink>
        <NavLink to="/peta" title="Peta iDRG" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <Map size={20} />
          <span>Peta iDRG</span>
        </NavLink>
        <NavLink to="/market-share" title="Simulasi Market Share" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <TrendingUp size={20} />
          <span>Simulasi Market Share</span>
        </NavLink>
        <NavLink to="/inflasi" title="GAP INACBG-IDRG" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <TrendingUp size={20} />
          <span>GAP INACBG-IDRG</span>
        </NavLink>
        <NavLink to="/rujukan" title="Simulasi Shifting RS" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <ArrowRightLeft size={20} />
          <span>Simulasi Shifting RS</span>
        </NavLink>
        <NavLink to="/strategis-rs" title="Dashboard Strategis RS" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <LayoutTemplate size={20} />
          <span>Dashboard Strategis RS</span>
        </NavLink>
        <NavLink to="/simulasi-kasus" title="Simulasi Kasus" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <LayoutTemplate size={20} />
          <span>Simulasi Kasus</span>
        </NavLink>
        <NavLink to="/layanan-khusus" title="Simulasi Layanan Khusus" className={({isActive}) => isActive ? "nav-item active" : "nav-item"} onClick={closeMobileMenu}>
          <Eye size={20} />
          <span>Simulasi Layanan Khusus</span>
        </NavLink>
      </nav>
      
      <div className="sidebar-footer" style={{ marginTop: 'auto', padding: '24px 0', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Kemenkes RI © 2026<br/>Data Mirorring Klaim
      </div>
    </div>
    </>
  );
};

export default Sidebar;
