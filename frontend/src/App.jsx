// App.jsx — Main application with sidebar navigation
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, TrendingUp, ArrowRightLeft,
  BarChart2, Calendar, Wallet, ChevronLeft, ChevronRight,
  Activity, Menu, X
} from 'lucide-react';

import UjiCobaNasional    from './pages/UjiCobaNasional';
import PetaIdrg           from './pages/PetaIdrg';
import DashboardStrategis from './pages/DashboardStrategis';
import SimulasiShifting   from './pages/SimulasiShifting';
import AnalisisCostWeight from './pages/AnalisisCostWeight';
import TrenBulanan        from './pages/TrenBulanan';
import SimulasiAnggaran   from './pages/SimulasiAnggaran';
import './index.css';

const MENU = [
  { to: '/nasional',    label: 'Uji Coba Nasional',   Icon: LayoutDashboard },
  { to: '/peta',        label: 'Peta iDRG',            Icon: Map             },
  { to: '/strategis',   label: 'Dashboard Strategis',  Icon: TrendingUp      },
  { to: '/shifting',    label: 'Simulasi Shifting',     Icon: ArrowRightLeft  },
  { to: '/cost-weight', label: 'Analisis Cost Weight',  Icon: BarChart2       },
  { to: '/tren',        label: 'Tren Bulanan',          Icon: Calendar        },
  { to: '/anggaran',    label: 'Simulasi Anggaran',     Icon: Wallet          },
];

const DATASETS = [
  { v: 'jan_des_v11', l: '📊 Jan–Des 2025 (v11)' },
  { v: 'okt_jun_v3',  l: '📋 Okt–Jun 2026 (v3)'  },
];

const SIMULASI = [
  { v: 2,  l: 'Sim 2 — CW×NBR+TopUp (Default)'   },
  { v: 1,  l: 'Sim 1 — CW×NBR'                   },
  { v: 3,  l: 'Sim 3 — +AF Regional'              },
  { v: 5,  l: 'Sim 5 — +AF Regional+Komp'         },
  { v: 26, l: 'Sim 26 — Juknis TopUp 1363'        },
  { v: 54, l: 'Sim 54 — BPJS TopUp 1363'          },
  { v: 41, l: 'Sim 41 — BPJS TopUp 1370'          },
];

export default function App() {
  const [dataset,   setDataset]   = useState('jan_des_v11');
  const [simulasi,  setSimulasi]  = useState(2);
  const [drgType,   setDrgType]   = useState('1363');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Global params passed to all pages
  const gp = { dataset, simulasi, drgType };

  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Mobile Backdrop */}
        {mobileOpen && <div className="mobile-backdrop" onClick={() => setMobileOpen(false)}></div>}

        {/* ─── Sidebar ─────────────────────────────────────── */}
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="logo-container">
            <img 
              src="/logo-kemenkes.png" 
              alt="Logo Kemenkes" 
              style={{ height: 36, maxWidth: '100%', objectFit: 'contain', flexShrink: 0 }}
            />
            {(!collapsed || mobileOpen) && <span className="logo-text" style={{ marginLeft: 8 }}>Dashboard iDRG</span>}
            <button className="mobile-close-btn" onClick={() => setMobileOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <nav className="nav-menu">
            {MENU.map(({ to, label, Icon }) => (
              <NavLink
                key={to} to={to} title={label}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              >
                <Icon size={18} />
                {(!collapsed || mobileOpen) && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>

          <button className="collapse-btn" onClick={() => setCollapsed(c => !c)} title="Toggle sidebar">
            {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>

          {!collapsed && (
            <div className="sidebar-footer">Kemenkes RI © 2026</div>
          )}
        </aside>

        {/* ─── Main ────────────────────────────────────────── */}
        <div className="main-content">
          {/* Top header with global filters */}
          <header className="top-header">
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
              <Menu size={24} />
            </button>
            <h1>Dashboard Analisis iDRG</h1>

            <select
              id="sel-dataset"
              value={dataset}
              onChange={e => setDataset(e.target.value)}
              className="styled-select"
            >
              {DATASETS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
            </select>

            <select
              id="sel-simulasi"
              value={simulasi}
              onChange={e => setSimulasi(+e.target.value)}
              className="styled-select"
            >
              {SIMULASI.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>

            <select
              id="sel-drg-type"
              value={drgType}
              onChange={e => setDrgType(e.target.value)}
              className="styled-select"
            >
              <option value="1363">1363 DRG (Eksisting)</option>
              <option value="1370">1370 DRG (MST Baru)</option>
            </select>
          </header>

          {/* Page content */}
          <div className="page-body">
            <Routes>
              <Route path="/"            element={<Navigate to="/nasional" replace />} />
              <Route path="/nasional"    element={<UjiCobaNasional    {...gp} />} />
              <Route path="/peta"        element={<PetaIdrg           {...gp} />} />
              <Route path="/strategis"   element={<DashboardStrategis {...gp} />} />
              <Route path="/shifting"    element={<SimulasiShifting   {...gp} />} />
              <Route path="/cost-weight" element={<AnalisisCostWeight  {...gp} />} />
              <Route path="/tren"        element={<TrenBulanan        {...gp} />} />
              <Route path="/anggaran"    element={<SimulasiAnggaran   {...gp} />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}
