# 🏥 PROJECT PLAN — Dashboard Analisis iDRG (PostgreSQL Edition)

**Versi:** 1.0 | **Dibuat:** 2026-08-02 | **Status:** SIAP DIEKSEKUSI

> **UNTUK AI AGENT YANG MELANJUTKAN**: Baca seluruh dokumen ini sebelum memulai.
> Setiap tahap memiliki checkpoint `[ ]` yang harus ditandai `[x]` setelah selesai.
> Mulailah dari item `[ ]` pertama yang belum ditandai.

---

## 📋 KONTEKS PROYEK

### Tujuan
Membangun sistem dashboard analisis iDRG (Indonesian Diagnosis Related Groups) baru dengan:
- **Backend**: PostgreSQL sebagai database utama (menggantikan file JSON statis)
- **API**: Node.js + Express REST API  
- **Frontend**: React + Vite dashboard
- **Lokasi output**: `D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\`

### Folder Penting
| Path | Keterangan |
|------|-----------|
| `D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\` | **Workspace utama** — tempat sistem baru dibangun |
| `D:\Analsisi Uji Coba\dashboard\` | **Dashboard referensi** — salin komponen dari sini |
| `D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\spending_jan_des_v11_gabungan.csv` | Data Jan-Des 2025, ~3.8 GB, 6.5 juta baris |
| `D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\spending_okt_jun_v3_gabungan.csv` | Data Okt-Jun 2026, ~8.5 GB, 13.9 juta baris |

### Kolom CSV (kedua file sama, kecuali `bulan_data_uji_coba` hanya ada di okt_jun)
```
kode_rs, nama_rs, propinsi, kabupaten, PEMILIK, JENIS, jenis_faskes,
pemilik_faskes, kelas_faskes, regional_2023, blu_non_blu, rs_vertikal,
ptd, kelas_rawat, kelompok_idrg, kelompok_icd, faskes_kompetensi,
klaim_kompetensi, inacbg, desc_inacbg, idrg_mdc, idrg_dc_1370,
idrg_code_1370, desc_idrg_1370, idrg_dc_1363, idrg_code_1363,
desc_idrg_1363, [bulan_data_uji_coba — hanya di okt_jun],
jml_kasus, total_tarif_inacbg, tarif_inacbg, tarif_inacbg_1,
total_tarifrs, idrg_tarif_1363_tanpa_af, idrg_total_tarif_1363_tanpa_af,
idrg_total_tarif_1363_dengan_af, idrg_total_tarif_1363_dengan_af_afreg,
idrg_total_tarif_1363_dengan_af_afreg_afkep,
idrg_tarif_1370_tanpa_af, idrg_total_tarif_1370_tanpa_af,
idrg_total_tarif_1370_dengan_af, idrg_total_tarif_1370_dengan_af_afreg,
idrg_total_tarif_1370_dengan_af_afreg_afkep,
idrg_total_tarif_1363_tanpa_af_juknistopup,
idrg_total_tarif_1363_dengan_af_juknistopup,
idrg_total_tarif_1363_dengan_af_afreg_juknistopup,
idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup,
idrg_total_tarif_1370_tanpa_af_juknistopup,
idrg_total_tarif_1370_dengan_af_juknistopup,
idrg_total_tarif_1370_dengan_af_afreg_juknistopup,
idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup
```

### Menu Dashboard yang Dibangun
| # | Nama Menu | Route | Status |
|---|-----------|-------|--------|
| 1 | Uji Coba Nasional | `/nasional` | Migrasi dari LaporanNasional.jsx |
| 2 | Peta iDRG | `/peta` | Migrasi dari PetaIdrg.jsx |
| 3 | Dashboard Strategis | `/strategis` | Migrasi dari DashboardStrategis.jsx |
| 4 | Simulasi Shifting | `/shifting` | Migrasi dari AnalisisShifting.jsx |
| 5 | Analisis Cost Weight | `/cost-weight` | **BARU** |
| 6 | Tren Bulanan | `/tren` | **BARU** |
| 7 | Simulasi Anggaran | `/anggaran` | **BARU** |

### Pemetaan Simulasi ke Kolom CSV
| Simulasi | Deskripsi | Kolom CSV (1363) |
|----------|-----------|------------------|
| Sim 1 | CW × NBR | `idrg_total_tarif_1363_tanpa_af` |
| Sim 2 | CW × NBR + Top Up (default) | `idrg_total_tarif_1363_dengan_af` |
| Sim 3 | CW × NBR × AF Regional + Top Up | `idrg_total_tarif_1363_dengan_af_afreg` |
| Sim 5 | + AF Kompetensi RS | `idrg_total_tarif_1363_dengan_af_afreg_afkep` |
| Sim 26 | Top Up Juknis 1363 | `idrg_total_tarif_1363_tanpa_af_juknistopup` |
| Sim 54 | Top Up BPJS 1363 | `idrg_total_tarif_1363_dengan_af_juknistopup` |
| Sim 41 | Top Up BPJS 1370 | `idrg_total_tarif_1370_dengan_af_juknistopup` |

---

## 🗂️ STRUKTUR FOLDER TARGET

```
D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\
├── PROJECT_PLAN.md                    ← File ini (panduan eksekusi)
├── backend\
│   ├── package.json
│   ├── .env                           ← DB credentials
│   ├── server.js                      ← Entry point Express
│   ├── db.js                          ← PostgreSQL connection pool
│   ├── routes\
│   │   ├── nasional.js
│   │   ├── peta.js
│   │   ├── strategis.js
│   │   ├── shifting.js
│   │   ├── costweight.js
│   │   ├── tren.js
│   │   └── anggaran.js
│   └── scripts\
│       ├── 01_create_schema.sql
│       └── 02_import_csv.js
└── frontend\
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src\
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── components\
        │   ├── Sidebar.jsx
        │   ├── StatCard.jsx
        │   └── MapIndonesia.jsx
        ├── pages\
        │   ├── UjiCobaNasional.jsx
        │   ├── PetaIdrg.jsx
        │   ├── DashboardStrategis.jsx
        │   ├── SimulasiShifting.jsx
        │   ├── AnalisisCostWeight.jsx
        │   ├── TrenBulanan.jsx
        │   └── SimulasiAnggaran.jsx
        └── utils\
            ├── api.js
            ├── formatters.js
            ├── rsGroups.js
            └── filterUtils.js
```

---

## ✅ CHECKLIST EKSEKUSI

> Tandai `[x]` setiap item yang sudah selesai.
> AI agent baru: mulai dari `[ ]` pertama.

### FASE 0 — Persiapan Lingkungan

- [ ] **F0.1** Verifikasi PostgreSQL: `psql --version` (min v14)
  - Jika belum install: `winget install PostgreSQL.PostgreSQL.14`
- [ ] **F0.2** Buat database dan user PostgreSQL:
  ```sql
  CREATE DATABASE idrg_dashboard;
  CREATE USER idrg_user WITH ENCRYPTED PASSWORD 'idrg_pass_2026';
  GRANT ALL PRIVILEGES ON DATABASE idrg_dashboard TO idrg_user;
  ```
- [ ] **F0.3** Verifikasi Node.js: `node --version` (min v18)
- [ ] **F0.4** Buat folder struktur:
  ```powershell
  cd "D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX"
  New-Item -ItemType Directory -Path backend, backend\routes, backend\scripts, frontend -Force
  ```

---

### FASE 1 — Database Schema & Import

#### F1.1 — Buat dan jalankan schema SQL

Buat file `backend\scripts\01_create_schema.sql`:

```sql
-- iDRG Dashboard Database Schema
-- Jalankan: psql -U idrg_user -d idrg_dashboard -f backend\scripts\01_create_schema.sql

DROP TABLE IF EXISTS spending_data CASCADE;

CREATE TABLE spending_data (
  id                    BIGSERIAL,
  dataset               VARCHAR(30) NOT NULL,
  kode_rs               VARCHAR(20),
  propinsi              VARCHAR(100),
  kabupaten             VARCHAR(100),
  pemilik               VARCHAR(10),
  jenis                 VARCHAR(50),
  jenis_faskes          VARCHAR(50),
  pemilik_faskes        VARCHAR(10),
  kelas_faskes          VARCHAR(5),
  regional_2023         VARCHAR(10),
  blu_non_blu           VARCHAR(30),
  rs_vertikal           VARCHAR(10),
  ptd                   SMALLINT,
  kelas_rawat           SMALLINT,
  kelompok_idrg         VARCHAR(150),
  kelompok_icd          VARCHAR(300),
  faskes_kompetensi     VARCHAR(30),
  klaim_kompetensi      VARCHAR(30),
  inacbg                VARCHAR(20),
  desc_inacbg           VARCHAR(400),
  idrg_mdc              SMALLINT,
  idrg_dc_1370          INTEGER,
  idrg_code_1370        VARCHAR(20),
  desc_idrg_1370        VARCHAR(400),
  idrg_dc_1363          INTEGER,
  idrg_code_1363        VARCHAR(20),
  desc_idrg_1363        VARCHAR(400),
  bulan_data_uji_coba   VARCHAR(80),
  jml_kasus             BIGINT,
  total_tarif_inacbg    NUMERIC(22,2),
  tarif_inacbg          NUMERIC(22,2),
  tarif_inacbg_1        NUMERIC(22,2),
  total_tarifrs         NUMERIC(22,2),
  idrg_tarif_1363_tanpa_af                          NUMERIC(22,2),
  idrg_total_tarif_1363_tanpa_af                    NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af                   NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_afreg             NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_afreg_afkep       NUMERIC(22,2),
  idrg_tarif_1370_tanpa_af                          NUMERIC(22,2),
  idrg_total_tarif_1370_tanpa_af                    NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af                   NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_afreg             NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_afreg_afkep       NUMERIC(22,2),
  idrg_total_tarif_1363_tanpa_af_juknistopup                NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_juknistopup               NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_afreg_juknistopup         NUMERIC(22,2),
  idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup   NUMERIC(22,2),
  idrg_total_tarif_1370_tanpa_af_juknistopup                NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_juknistopup               NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_afreg_juknistopup         NUMERIC(22,2),
  idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup   NUMERIC(22,2),
  PRIMARY KEY (id, dataset)
) PARTITION BY LIST (dataset);

CREATE TABLE spending_jan_des PARTITION OF spending_data FOR VALUES IN ('jan_des_v11');
CREATE TABLE spending_okt_jun PARTITION OF spending_data FOR VALUES IN ('okt_jun_v3');

-- Views untuk query cepat
CREATE OR REPLACE VIEW v_rs_summary AS
SELECT dataset, kode_rs,
  MAX(propinsi) as propinsi, MAX(kabupaten) as kabupaten,
  MAX(pemilik) as pemilik, MAX(jenis) as jenis,
  MAX(kelas_faskes) as kelas_faskes, MAX(regional_2023) as regional_2023,
  MAX(faskes_kompetensi) as faskes_kompetensi,
  SUM(jml_kasus) as total_kasus,
  SUM(total_tarif_inacbg) as total_tarif_inacbg,
  SUM(idrg_total_tarif_1363_dengan_af) as total_idrg_sim2
FROM spending_data GROUP BY dataset, kode_rs;

CREATE OR REPLACE VIEW v_provinsi_summary AS
SELECT dataset, propinsi,
  COUNT(DISTINCT kode_rs) as jumlah_rs,
  SUM(jml_kasus) as total_kasus,
  SUM(total_tarif_inacbg) as total_tarif_inacbg,
  SUM(idrg_total_tarif_1363_dengan_af) as total_idrg_sim2
FROM spending_data GROUP BY dataset, propinsi;

-- CATATAN: Buat indexes SETELAH import selesai untuk performa optimal
-- CREATE INDEX idx_sd_kode_rs  ON spending_data(kode_rs, dataset);
-- CREATE INDEX idx_sd_propinsi ON spending_data(propinsi, dataset);
-- CREATE INDEX idx_sd_idrg     ON spending_data(idrg_code_1363, dataset);
-- CREATE INDEX idx_sd_inacbg   ON spending_data(inacbg, dataset);
-- CREATE INDEX idx_sd_kelompok ON spending_data(kelompok_idrg, dataset);
-- CREATE INDEX idx_sd_bulan    ON spending_data(bulan_data_uji_coba, dataset);
-- CREATE INDEX idx_sd_komp     ON spending_data(klaim_kompetensi, dataset);
```

Jalankan:
```powershell
psql -U idrg_user -d idrg_dashboard -f "D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\backend\scripts\01_create_schema.sql"
```

- [ ] **F1.1** Schema berhasil dibuat (tidak ada error merah)

---

#### F1.2 — Import CSV menggunakan psql COPY (METODE TERCEPAT)

Cara paling cepat import CSV besar ke PostgreSQL adalah via perintah `\COPY` langsung dari psql:

```powershell
# Import Jan-Des (TANPA kolom bulan_data_uji_coba — isi NULL)
# Buat file SQL bantu dulu untuk import
$sql = @"
-- Buat tabel staging sementara
CREATE TEMP TABLE staging_jan_des (LIKE spending_data INCLUDING DEFAULTS);

-- Import CSV langsung
\COPY staging_jan_des (kode_rs,propinsi,kabupaten,pemilik,jenis,jenis_faskes,pemilik_faskes,kelas_faskes,regional_2023,blu_non_blu,rs_vertikal,ptd,kelas_rawat,kelompok_idrg,kelompok_icd,faskes_kompetensi,klaim_kompetensi,inacbg,desc_inacbg,idrg_mdc,idrg_dc_1370,idrg_code_1370,desc_idrg_1370,idrg_dc_1363,idrg_code_1363,desc_idrg_1363,jml_kasus,total_tarif_inacbg,tarif_inacbg,tarif_inacbg_1,total_tarifrs,idrg_tarif_1363_tanpa_af,idrg_total_tarif_1363_tanpa_af,idrg_total_tarif_1363_dengan_af,idrg_total_tarif_1363_dengan_af_afreg,idrg_total_tarif_1363_dengan_af_afreg_afkep,idrg_tarif_1370_tanpa_af,idrg_total_tarif_1370_tanpa_af,idrg_total_tarif_1370_dengan_af,idrg_total_tarif_1370_dengan_af_afreg,idrg_total_tarif_1370_dengan_af_afreg_afkep,idrg_total_tarif_1363_tanpa_af_juknistopup,idrg_total_tarif_1363_dengan_af_juknistopup,idrg_total_tarif_1363_dengan_af_afreg_juknistopup,idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup,idrg_total_tarif_1370_tanpa_af_juknistopup,idrg_total_tarif_1370_dengan_af_juknistopup,idrg_total_tarif_1370_dengan_af_afreg_juknistopup,idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup) FROM 'D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\spending_jan_des_v11_gabungan.csv' CSV HEADER;
"@
```

**ALTERNATIF LEBIH MUDAH**: Buat script Python untuk import (lebih toleran error):

Buat file `backend\scripts\02_import_csv.py`:
```python
"""
Import CSV ke PostgreSQL menggunakan COPY protocol (tercepat).
Install: pip install psycopg2-binary pandas
Jalankan: python backend/scripts/02_import_csv.py
Estimasi: 30-90 menit per file
"""
import psycopg2
import csv
import sys
import time
from io import StringIO

DB_CONFIG = {
    'host': 'localhost', 'port': 5432,
    'dbname': 'idrg_dashboard',
    'user': 'idrg_user', 'password': 'idrg_pass_2026'
}

# Kolom target di DB (urutan harus sama dengan CSV setelah mapping)
COLS_JAN_DES = [
    'kode_rs', 'propinsi', 'kabupaten', 'pemilik', 'jenis',
    'jenis_faskes', 'pemilik_faskes', 'kelas_faskes', 'regional_2023',
    'blu_non_blu', 'rs_vertikal', 'ptd', 'kelas_rawat',
    'kelompok_idrg', 'kelompok_icd', 'faskes_kompetensi', 'klaim_kompetensi',
    'inacbg', 'desc_inacbg', 'idrg_mdc', 'idrg_dc_1370', 'idrg_code_1370',
    'desc_idrg_1370', 'idrg_dc_1363', 'idrg_code_1363', 'desc_idrg_1363',
    'jml_kasus', 'total_tarif_inacbg', 'tarif_inacbg', 'tarif_inacbg_1', 'total_tarifrs',
    'idrg_tarif_1363_tanpa_af', 'idrg_total_tarif_1363_tanpa_af',
    'idrg_total_tarif_1363_dengan_af', 'idrg_total_tarif_1363_dengan_af_afreg',
    'idrg_total_tarif_1363_dengan_af_afreg_afkep',
    'idrg_tarif_1370_tanpa_af', 'idrg_total_tarif_1370_tanpa_af',
    'idrg_total_tarif_1370_dengan_af', 'idrg_total_tarif_1370_dengan_af_afreg',
    'idrg_total_tarif_1370_dengan_af_afreg_afkep',
    'idrg_total_tarif_1363_tanpa_af_juknistopup', 'idrg_total_tarif_1363_dengan_af_juknistopup',
    'idrg_total_tarif_1363_dengan_af_afreg_juknistopup',
    'idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup',
    'idrg_total_tarif_1370_tanpa_af_juknistopup', 'idrg_total_tarif_1370_dengan_af_juknistopup',
    'idrg_total_tarif_1370_dengan_af_afreg_juknistopup',
    'idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup',
]

COLS_OKT_JUN = COLS_JAN_DES.copy()
COLS_OKT_JUN.insert(COLS_OKT_JUN.index('jml_kasus'), 'bulan_data_uji_coba')

CSV_HEADER_MAP = {
    'PEMILIK': 'pemilik',
    'JENIS': 'jenis',
}

BATCH = 100_000

def import_file(csv_path, dataset, target_cols):
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()
    
    print(f"\n📂 Import: {csv_path}")
    print(f"   Dataset: {dataset}")
    start = time.time()
    total = 0
    
    with open(csv_path, 'r', encoding='utf-8-sig', errors='replace') as f:
        reader = csv.DictReader(f)
        
        # Normalize header
        reader.fieldnames = [CSV_HEADER_MAP.get(h, h) for h in reader.fieldnames]
        
        buf = StringIO()
        writer = csv.writer(buf, delimiter='\t', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        
        batch_count = 0
        for row in reader:
            vals = []
            for col in target_cols:
                v = row.get(col, '') or ''
                vals.append(v if v not in ('', 'nan', 'NaN', 'NULL') else '\\N')
            writer.writerow(vals)
            batch_count += 1
            total += 1
            
            if batch_count >= BATCH:
                buf.seek(0)
                cur.copy_from(buf, 'spending_data',
                    columns=['dataset'] + target_cols,
                    sep='\t', null='\\N')
                # Inject dataset value
                # NOTE: Perlu pendekatan berbeda - gunakan temp table
                conn.commit()
                buf = StringIO()
                writer = csv.writer(buf, delimiter='\t', quotechar='"', quoting=csv.QUOTE_MINIMAL)
                batch_count = 0
                elapsed = time.time() - start
                rate = total / elapsed
                print(f"\r  ✅ {total:,} baris | {rate:.0f} baris/dtk | ~{(6_500_000-total)/rate/60:.0f} mnt tersisa", end='', flush=True)
        
        # Flush sisa
        if batch_count > 0:
            buf.seek(0)
            cur.copy_from(buf, 'spending_data', columns=['dataset'] + target_cols, sep='\t', null='\\N')
            conn.commit()
    
    cur.close()
    conn.close()
    print(f"\n✅ Selesai! {total:,} baris dalam {(time.time()-start)/60:.1f} menit")

def create_indexes():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_sd_kode_rs  ON spending_data(kode_rs, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_propinsi ON spending_data(propinsi, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_idrg     ON spending_data(idrg_code_1363, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_inacbg   ON spending_data(inacbg, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_kelompok ON spending_data(kelompok_idrg, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_bulan    ON spending_data(bulan_data_uji_coba, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_komp     ON spending_data(klaim_kompetensi, dataset)",
    ]
    for sql in indexes:
        print(f"  Membuat: {sql[:60]}...")
        cur.execute(sql)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Semua indexes selesai!")

if __name__ == '__main__':
    BASE = r"D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX"
    import_file(f"{BASE}\\spending_jan_des_v11_gabungan.csv", 'jan_des_v11', COLS_JAN_DES)
    import_file(f"{BASE}\\spending_okt_jun_v3_gabungan.csv",  'okt_jun_v3',  COLS_OKT_JUN)
    create_indexes()
    print("\n🎉 Import selesai! Verifikasi: psql -U idrg_user -d idrg_dashboard -c \"SELECT dataset, COUNT(*) FROM spending_data GROUP BY dataset;\"")
```

Jalankan:
```powershell
pip install psycopg2-binary
python "D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\backend\scripts\02_import_csv.py"
```

- [ ] **F1.2a** Import jan_des selesai — verifikasi: `SELECT COUNT(*) FROM spending_jan_des;` → ~6,540,369
- [ ] **F1.2b** Import okt_jun selesai — verifikasi: `SELECT COUNT(*) FROM spending_okt_jun;` → ~13,947,908
- [ ] **F1.2c** Indexes berhasil dibuat

---

### FASE 2 — Backend API (Node.js + Express)

#### F2.1 — Setup Project Backend

Buat `backend\package.json`:
```json
{
  "name": "idrg-dashboard-api",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "npx nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "pg": "^8.11.3"
  }
}
```

Buat `backend\.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=idrg_dashboard
DB_USER=idrg_user
DB_PASSWORD=idrg_pass_2026
API_PORT=3001
FRONTEND_URL=http://localhost:5173
```

Buat `backend\db.js`:
```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('Unexpected DB error', err));
module.exports = { pool };
```

```powershell
cd "D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\backend"
npm install
```

- [ ] **F2.1** `npm install` selesai, folder `node_modules` terbentuk

---

#### F2.2 — server.js

Buat `backend\server.js`:
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/nasional',   require('./routes/nasional'));
app.use('/api/peta',       require('./routes/peta'));
app.use('/api/strategis',  require('./routes/strategis'));
app.use('/api/shifting',   require('./routes/shifting'));
app.use('/api/costweight', require('./routes/costweight'));
app.use('/api/tren',       require('./routes/tren'));
app.use('/api/anggaran',   require('./routes/anggaran'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API: http://localhost:${PORT}`));
```

- [ ] **F2.2** `node server.js` berjalan, `/api/health` → `{"status":"ok"}`

---

#### F2.3 — Helper functions (dipakai semua routes)

Buat `backend\routes\_helpers.js`:
```javascript
// Mapping simulasi ke nama kolom tarif
function getTarifCol(simulasi, drgType = '1363') {
  const sim = parseInt(simulasi) || 2;
  const dt = drgType === '1370' ? '1370' : '1363';
  const map = {
    1:  `idrg_total_tarif_${dt}_tanpa_af`,
    2:  `idrg_total_tarif_${dt}_dengan_af`,
    3:  `idrg_total_tarif_${dt}_dengan_af_afreg`,
    5:  `idrg_total_tarif_${dt}_dengan_af_afreg_afkep`,
    26: `idrg_total_tarif_1363_tanpa_af_juknistopup`,
    54: `idrg_total_tarif_1363_dengan_af_juknistopup`,
    41: `idrg_total_tarif_1370_dengan_af_juknistopup`,
  };
  return map[sim] || `idrg_total_tarif_${dt}_dengan_af`;
}

// Build WHERE clause dari query params
function buildWhere(q, startIdx = 1) {
  const conditions = [];
  const params = [];
  let idx = startIdx;

  params.push(q.dataset || 'jan_des_v11');
  conditions.push(`dataset = $${idx++}`);

  if (q.propinsi) {
    params.push(q.propinsi.split(','));
    conditions.push(`propinsi = ANY($${idx++})`);
  }
  if (q.kabupaten) {
    params.push(q.kabupaten.split(','));
    conditions.push(`kabupaten = ANY($${idx++})`);
  }
  if (q.kelas_faskes) {
    params.push(q.kelas_faskes.split(','));
    conditions.push(`kelas_faskes = ANY($${idx++})`);
  }
  if (q.pemilik) {
    params.push(q.pemilik);
    conditions.push(`pemilik = $${idx++}`);
  }
  if (q.klaim_kompetensi && q.klaim_kompetensi !== 'all') {
    params.push(q.klaim_kompetensi);
    conditions.push(`klaim_kompetensi = $${idx++}`);
  }
  if (q.drg_type === '1363') {
    conditions.push(`idrg_code_1363 IS NOT NULL`);
  }
  if (q.bulan && q.bulan !== 'all') {
    params.push(`%${q.bulan}%`);
    conditions.push(`bulan_data_uji_coba ILIKE $${idx++}`);
  }
  if (q.kelompok) {
    params.push(q.kelompok);
    conditions.push(`kelompok_idrg = $${idx++}`);
  }

  return { where: conditions.join(' AND '), params };
}

module.exports = { getTarifCol, buildWhere };
```

---

#### F2.4 — Routes Lengkap

**`backend\routes\nasional.js`** — 5 endpoints:
- `GET /api/nasional/summary` — ringkasan total nasional
- `GET /api/nasional/by-provinsi` — per provinsi
- `GET /api/nasional/by-drg` — per iDRG code
- `GET /api/nasional/by-kompetensi` — per level kompetensi
- `GET /api/nasional/by-kelompok` — per kelompok layanan

Query dasar untuk semua:
```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getTarifCol, buildWhere } = require('./_helpers');

router.get('/summary', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT kode_rs)::int            AS jumlah_rs,
        SUM(jml_kasus)::bigint                  AS total_kasus,
        SUM(total_tarif_inacbg)                 AS total_tarif_inacbg,
        SUM(total_tarifrs)                       AS total_tarif_rs,
        SUM(${col})                              AS total_tarif_idrg,
        SUM(${col}) - SUM(total_tarif_inacbg)   AS selisih,
        COUNT(DISTINCT propinsi)::int            AS jumlah_provinsi,
        COUNT(DISTINCT inacbg)::int              AS jumlah_inacbg,
        COUNT(DISTINCT idrg_code_1363)::int      AS jumlah_idrg_1363
      FROM spending_data WHERE ${where}`, params);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/by-provinsi', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const { rows } = await pool.query(`
      SELECT propinsi,
        COUNT(DISTINCT kode_rs)::int AS jumlah_rs,
        SUM(jml_kasus)::bigint       AS total_kasus,
        SUM(total_tarif_inacbg)      AS total_tarif_inacbg,
        SUM(${col})                  AS total_tarif_idrg,
        SUM(${col})-SUM(total_tarif_inacbg) AS selisih
      FROM spending_data WHERE ${where}
      GROUP BY propinsi ORDER BY total_kasus DESC`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/by-drg', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const drgCol = req.query.drg_type === '1370' ? 'idrg_code_1370' : 'idrg_code_1363';
    const descCol = req.query.drg_type === '1370' ? 'desc_idrg_1370' : 'desc_idrg_1363';
    const lim = parseInt(req.query.limit) || 100;
    const { rows } = await pool.query(`
      SELECT ${drgCol} AS idrg_code, MAX(${descCol}) AS deskripsi,
        MAX(kelompok_idrg) AS kelompok,
        SUM(jml_kasus)::bigint AS total_kasus,
        SUM(total_tarif_inacbg) AS total_tarif_inacbg,
        SUM(${col}) AS total_tarif_idrg,
        SUM(${col})-SUM(total_tarif_inacbg) AS selisih,
        COUNT(DISTINCT kode_rs)::int AS jumlah_rs
      FROM spending_data WHERE ${where} AND ${drgCol} IS NOT NULL
      GROUP BY ${drgCol} ORDER BY total_kasus DESC LIMIT ${lim}`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/by-kompetensi', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const { rows } = await pool.query(`
      SELECT klaim_kompetensi,
        COUNT(DISTINCT kode_rs)::int AS jumlah_rs,
        SUM(jml_kasus)::bigint       AS total_kasus,
        SUM(${col})                  AS total_tarif_idrg,
        SUM(total_tarif_inacbg)      AS total_tarif_inacbg
      FROM spending_data WHERE ${where}
      GROUP BY klaim_kompetensi ORDER BY total_kasus DESC`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/by-kelompok', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query);
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const { rows } = await pool.query(`
      SELECT kelompok_idrg,
        SUM(jml_kasus)::bigint  AS total_kasus,
        SUM(${col})             AS total_tarif_idrg,
        SUM(total_tarif_inacbg) AS total_tarif_inacbg,
        COUNT(DISTINCT kode_rs)::int AS jumlah_rs
      FROM spending_data WHERE ${where}
      GROUP BY kelompok_idrg ORDER BY total_kasus DESC`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

**`backend\routes\peta.js`** — 3 endpoints:
- `GET /api/peta/inacbg-list` — list semua INA-CBG
- `GET /api/peta/inacbg?inacbg=Q-5-44-0` — mapping INA-CBG → iDRG
- `GET /api/peta/by-idrg` — distribusi per provinsi

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { buildWhere } = require('./_helpers');

router.get('/inacbg-list', async (req, res) => {
  try {
    const dataset = req.query.dataset || 'jan_des_v11';
    const { rows } = await pool.query(`
      SELECT inacbg, MAX(desc_inacbg) AS deskripsi,
        MAX(kelompok_icd) AS kelompok, SUM(jml_kasus)::bigint AS total_kasus
      FROM spending_data WHERE dataset=$1 AND inacbg IS NOT NULL
      GROUP BY inacbg ORDER BY total_kasus DESC`, [dataset]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/inacbg', async (req, res) => {
  try {
    const { dataset = 'jan_des_v11', inacbg } = req.query;
    if (!inacbg) return res.status(400).json({ error: 'inacbg wajib diisi' });
    const { rows } = await pool.query(`
      SELECT idrg_code_1363 AS idrg_code, MAX(desc_idrg_1363) AS deskripsi,
        MAX(kelompok_idrg) AS kelompok, SUM(jml_kasus)::bigint AS total_kasus,
        COUNT(DISTINCT kode_rs)::int AS jumlah_rs
      FROM spending_data WHERE dataset=$1 AND inacbg=$2
      GROUP BY idrg_code_1363 ORDER BY total_kasus DESC`, [dataset, inacbg]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/by-idrg', async (req, res) => {
  try {
    const { dataset = 'jan_des_v11', idrg_code, tarif_col = 'idrg_total_tarif_1363_dengan_af' } = req.query;
    const params = [dataset];
    let extra = '';
    if (idrg_code) { params.push(idrg_code); extra = `AND idrg_code_1363 = $${params.length}`; }
    const { rows } = await pool.query(`
      SELECT propinsi, SUM(jml_kasus)::bigint AS total_kasus,
        SUM(${tarif_col}) AS total_tarif,
        COUNT(DISTINCT kode_rs)::int AS jumlah_rs
      FROM spending_data WHERE dataset=$1 ${extra}
      GROUP BY propinsi ORDER BY total_kasus DESC`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

**`backend\routes\strategis.js`** — 2 endpoints:
- `GET /api/strategis/rs-list` — list semua RS
- `GET /api/strategis/rs/:kode` — detail satu RS

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getTarifCol } = require('./_helpers');

router.get('/rs-list', async (req, res) => {
  try {
    const dataset = req.query.dataset || 'jan_des_v11';
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const { rows } = await pool.query(`
      SELECT kode_rs, MAX(propinsi) AS propinsi, MAX(kabupaten) AS kabupaten,
        MAX(pemilik) AS pemilik, MAX(jenis) AS jenis,
        MAX(kelas_faskes) AS kelas_faskes, MAX(regional_2023) AS regional,
        MAX(faskes_kompetensi) AS faskes_kompetensi,
        SUM(jml_kasus)::bigint AS total_kasus,
        SUM(total_tarif_inacbg) AS total_tarif_inacbg,
        SUM(${col}) AS total_tarif_idrg
      FROM spending_data WHERE dataset=$1
      GROUP BY kode_rs ORDER BY total_kasus DESC`, [dataset]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/rs/:kode', async (req, res) => {
  try {
    const { kode } = req.params;
    const dataset = req.query.dataset || 'jan_des_v11';
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const [info, kelompok, topDrg] = await Promise.all([
      pool.query(`SELECT kode_rs, MAX(propinsi) AS propinsi, MAX(kabupaten) AS kabupaten,
        MAX(pemilik) AS pemilik, MAX(kelas_faskes) AS kelas_faskes, MAX(regional_2023) AS regional,
        MAX(faskes_kompetensi) AS faskes_kompetensi,
        SUM(jml_kasus)::bigint AS total_kasus, SUM(total_tarif_inacbg) AS total_tarif_inacbg,
        SUM(total_tarifrs) AS total_tarif_rs, SUM(${col}) AS total_tarif_idrg
        FROM spending_data WHERE dataset=$1 AND kode_rs=$2 GROUP BY kode_rs`, [dataset, kode]),
      pool.query(`SELECT kelompok_idrg, klaim_kompetensi,
        SUM(jml_kasus)::bigint AS kasus, SUM(${col}) AS tarif_idrg,
        SUM(total_tarif_inacbg) AS tarif_inacbg
        FROM spending_data WHERE dataset=$1 AND kode_rs=$2
        GROUP BY kelompok_idrg, klaim_kompetensi ORDER BY kasus DESC`, [dataset, kode]),
      pool.query(`SELECT idrg_code_1363, MAX(desc_idrg_1363) AS deskripsi,
        SUM(jml_kasus)::bigint AS kasus, SUM(${col}) AS tarif_idrg
        FROM spending_data WHERE dataset=$1 AND kode_rs=$2 AND idrg_code_1363 IS NOT NULL
        GROUP BY idrg_code_1363 ORDER BY kasus DESC LIMIT 20`, [dataset, kode]),
    ]);
    res.json({ info: info.rows[0], kelompok: kelompok.rows, top_drg: topDrg.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

**`backend\routes\shifting.js`**:
```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getTarifCol } = require('./_helpers');

router.get('/', async (req, res) => {
  try {
    const dataset = req.query.dataset || 'jan_des_v11';
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const threshold = parseFloat(req.query.threshold) || 1.2;
    const { rows } = await pool.query(`
      SELECT kode_rs, MAX(propinsi) AS propinsi, MAX(kabupaten) AS kabupaten,
        MAX(pemilik) AS pemilik, MAX(kelas_faskes) AS kelas_faskes,
        MAX(faskes_kompetensi) AS faskes_kompetensi,
        SUM(jml_kasus)::bigint AS total_kasus,
        SUM(total_tarif_inacbg) AS total_tarif_inacbg,
        SUM(${col}) AS total_tarif_idrg,
        SUM(${col}) / NULLIF(SUM(total_tarif_inacbg),0) AS rasio,
        SUM(${col}) - SUM(total_tarif_inacbg) AS selisih_absolut
      FROM spending_data WHERE dataset=$1
      GROUP BY kode_rs
      HAVING SUM(${col}) / NULLIF(SUM(total_tarif_inacbg),0) > $2
      ORDER BY selisih_absolut DESC LIMIT 300`, [dataset, threshold]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

**`backend\routes\tren.js`**:
```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getTarifCol } = require('./_helpers');

router.get('/bulanan', async (req, res) => {
  try {
    const col = getTarifCol(req.query.simulasi, req.query.drg_type);
    const params = ['okt_jun_v3'];
    let extra = '';
    if (req.query.propinsi) { params.push(req.query.propinsi); extra += ` AND propinsi=$${params.length}`; }
    if (req.query.kelompok) { params.push(req.query.kelompok); extra += ` AND kelompok_idrg=$${params.length}`; }
    const { rows } = await pool.query(`
      SELECT bulan_data_uji_coba AS bulan,
        COUNT(DISTINCT kode_rs)::int AS jumlah_rs,
        SUM(jml_kasus)::bigint       AS total_kasus,
        SUM(total_tarif_inacbg)      AS total_tarif_inacbg,
        SUM(${col})                  AS total_tarif_idrg
      FROM spending_data WHERE dataset=$1 AND bulan_data_uji_coba IS NOT NULL ${extra}
      GROUP BY bulan_data_uji_coba ORDER BY bulan_data_uji_coba`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

**`backend\routes\costweight.js`**:
```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const dataset = req.query.dataset || 'jan_des_v11';
    const { rows } = await pool.query(`
      SELECT idrg_code_1363, MAX(desc_idrg_1363) AS deskripsi,
        MAX(kelompok_idrg) AS kelompok,
        SUM(jml_kasus)::bigint AS total_kasus,
        AVG(idrg_tarif_1363_tanpa_af) AS avg_tarif_per_kasus,
        SUM(total_tarif_inacbg) AS total_inacbg,
        SUM(idrg_total_tarif_1363_dengan_af) AS total_idrg_sim2,
        SUM(idrg_total_tarif_1363_dengan_af)/NULLIF(SUM(total_tarif_inacbg),0) AS rasio_cw
      FROM spending_data WHERE dataset=$1 AND idrg_code_1363 IS NOT NULL
      GROUP BY idrg_code_1363 ORDER BY total_kasus DESC`, [dataset]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

**`backend\routes\anggaran.js`**:
```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/perbandingan', async (req, res) => {
  try {
    const dataset = req.query.dataset || 'jan_des_v11';
    const { rows } = await pool.query(`
      SELECT
        SUM(jml_kasus)::bigint                               AS total_kasus,
        SUM(total_tarif_inacbg)                              AS tarif_inacbg,
        SUM(total_tarifrs)                                   AS tarif_rs_aktual,
        -- 1363 DRG
        SUM(idrg_total_tarif_1363_tanpa_af)                 AS sim1_1363,
        SUM(idrg_total_tarif_1363_dengan_af)                AS sim2_1363,
        SUM(idrg_total_tarif_1363_dengan_af_afreg)          AS sim3_1363,
        SUM(idrg_total_tarif_1363_dengan_af_afreg_afkep)    AS sim5_1363,
        SUM(idrg_total_tarif_1363_tanpa_af_juknistopup)     AS sim26_1363,
        SUM(idrg_total_tarif_1363_dengan_af_juknistopup)    AS sim54_1363,
        -- 1370 DRG
        SUM(idrg_total_tarif_1370_tanpa_af)                 AS sim1_1370,
        SUM(idrg_total_tarif_1370_dengan_af)                AS sim2_1370,
        SUM(idrg_total_tarif_1370_dengan_af_afreg)          AS sim3_1370,
        SUM(idrg_total_tarif_1370_dengan_af_afreg_afkep)    AS sim5_1370,
        SUM(idrg_total_tarif_1370_dengan_af_juknistopup)    AS sim41_1370,
        -- Meta
        COUNT(DISTINCT kode_rs)::int    AS jumlah_rs,
        COUNT(DISTINCT propinsi)::int   AS jumlah_provinsi
      FROM spending_data WHERE dataset=$1`, [dataset]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
```

- [ ] **F2.3** Semua 7 route files berhasil dibuat
- [ ] **F2.4** Test semua endpoint dengan curl/Invoke-WebRequest (lihat Fase 4)

---

### FASE 3 — Frontend React + Vite

#### F3.1 — Inisialisasi Project

```powershell
cd "D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX"
npm create vite@latest frontend -- --template react
cd frontend
npm install

# Install dependencies
npm install react-router-dom react-select recharts react-plotly.js plotly.js-dist-min leaflet react-leaflet lucide-react d3-format react-d3-tree
```

- [ ] **F3.1** `npm run dev` berjalan di http://localhost:5173

---

#### F3.2 — Copy Assets dari Dashboard Referensi

```powershell
$REF = "D:\Analsisi Uji Coba\dashboard\src"
$NEW = "D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\frontend\src"
$REFPUB = "D:\Analsisi Uji Coba\dashboard\public"
$NEWPUB = "D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX\frontend\public"

# Copy utilities
New-Item -ItemType Directory -Path "$NEW\utils", "$NEW\hooks", "$NEW\components", "$NEW\pages" -Force
Copy-Item "$REF\utils\formatters.js"       "$NEW\utils\formatters.js"     -Force
Copy-Item "$REF\utils\rsGroups.js"         "$NEW\utils\rsGroups.js"       -Force
Copy-Item "$REF\utils\filterUtils.js"      "$NEW\utils\filterUtils.js"    -Force
Copy-Item "$REF\hooks\useSortableTable.js" "$NEW\hooks\useSortableTable.js" -Force

# Copy components yang bisa dipakai ulang
Copy-Item "$REF\components\StatCard.jsx"        "$NEW\components\StatCard.jsx"   -Force
Copy-Item "$REF\components\MapIndonesia.jsx"    "$NEW\components\MapIndonesia.jsx" -Force
Copy-Item "$REF\components\HospitalProfileCard.jsx" "$NEW\components\HospitalProfileCard.jsx" -Force

# Copy CSS (akan dimodifikasi)
Copy-Item "$REF\index.css" "$NEW\index.css" -Force

# Copy public assets
Copy-Item "$REFPUB\indonesia-prov.geojson" "$NEWPUB\indonesia-prov.geojson" -Force
Copy-Item "$REFPUB\logo-kemenkes.png"      "$NEWPUB\logo-kemenkes.png"      -Force
```

- [ ] **F3.2** Assets berhasil dicopy

---

#### F3.3 — Buat file utama frontend

Buat `frontend\src\utils\api.js`:
```javascript
const BASE = 'http://localhost:3001/api';

export async function apiFetch(endpoint, params = {}) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([,v]) => v != null && v !== ''))
  ).toString();
  const url = q ? `${BASE}${endpoint}?${q}` : `${BASE}${endpoint}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  return res.json();
}

export const api = {
  nasional: {
    summary:      (p) => apiFetch('/nasional/summary', p),
    byProvinsi:   (p) => apiFetch('/nasional/by-provinsi', p),
    byDrg:        (p) => apiFetch('/nasional/by-drg', p),
    byKompetensi: (p) => apiFetch('/nasional/by-kompetensi', p),
    byKelompok:   (p) => apiFetch('/nasional/by-kelompok', p),
  },
  peta: {
    inacbgList: (p) => apiFetch('/peta/inacbg-list', p),
    inacbg:     (p) => apiFetch('/peta/inacbg', p),
    byIdrg:     (p) => apiFetch('/peta/by-idrg', p),
  },
  strategis: {
    rsList:   (p)       => apiFetch('/strategis/rs-list', p),
    rsDetail: (kode, p) => apiFetch(`/strategis/rs/${kode}`, p),
  },
  shifting:  (p) => apiFetch('/shifting', p),
  tren: {
    bulanan: (p) => apiFetch('/tren/bulanan', p),
  },
  costweight: (p) => apiFetch('/costweight', p),
  anggaran: {
    perbandingan: (p) => apiFetch('/anggaran/perbandingan', p),
  },
};
```

Buat `frontend\src\App.jsx`:
```jsx
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Map, TrendingUp, ArrowRightLeft,
  BarChart2, Calendar, Wallet, ChevronLeft, ChevronRight
} from 'lucide-react';
import UjiCobaNasional   from './pages/UjiCobaNasional';
import PetaIdrg          from './pages/PetaIdrg';
import DashboardStrategis from './pages/DashboardStrategis';
import SimulasiShifting  from './pages/SimulasiShifting';
import AnalisisCostWeight from './pages/AnalisisCostWeight';
import TrenBulanan       from './pages/TrenBulanan';
import SimulasiAnggaran  from './pages/SimulasiAnggaran';
import './index.css';

const MENU = [
  { to: '/nasional',    label: 'Uji Coba Nasional',   Icon: LayoutDashboard },
  { to: '/peta',        label: 'Peta iDRG',            Icon: Map },
  { to: '/strategis',   label: 'Dashboard Strategis',  Icon: TrendingUp },
  { to: '/shifting',    label: 'Simulasi Shifting',     Icon: ArrowRightLeft },
  { to: '/cost-weight', label: 'Analisis Cost Weight',  Icon: BarChart2 },
  { to: '/tren',        label: 'Tren Bulanan',          Icon: Calendar },
  { to: '/anggaran',    label: 'Simulasi Anggaran',     Icon: Wallet },
];

const SIM_LIST = [
  { v: 2,  l: 'Sim 2: CW×NBR+TopUp (Default)' },
  { v: 1,  l: 'Sim 1: CW×NBR' },
  { v: 3,  l: 'Sim 3: +AF Regional' },
  { v: 5,  l: 'Sim 5: +AF Regional+Komp' },
  { v: 26, l: 'Sim 26: Juknis TopUp 1363' },
  { v: 54, l: 'Sim 54: BPJS TopUp 1363' },
  { v: 41, l: 'Sim 41: BPJS TopUp 1370' },
];

export default function App() {
  const [dataset,  setDataset]  = useState('jan_des_v11');
  const [simulasi, setSimulasi] = useState(2);
  const [drgType,  setDrgType]  = useState('1363');
  const [collapsed, setCollapsed] = useState(false);

  const gp = { dataset, simulasi, drgType };

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
          <div className="logo-container">
            <img src="/logo-kemenkes.png" alt="Kemenkes" className="logo-img" />
            {!collapsed && <span className="logo-text">Dashboard iDRG</span>}
          </div>
          <nav className="nav-menu">
            {MENU.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} title={label}
                className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <Icon size={20} />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
          </button>
          <div className="sidebar-footer">Kemenkes RI © 2026</div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          <div className="top-header-container">
            <div style={{ display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap', padding:'12px 24px' }}>
              <h1 style={{ margin:0, fontSize:'1.2rem' }}>Dashboard Analisis iDRG</h1>
              <select value={dataset} onChange={e=>setDataset(e.target.value)} className="styled-select">
                <option value="jan_des_v11">📊 Jan–Des 2025 (v11)</option>
                <option value="okt_jun_v3">📋 Okt–Jun 2026 (v3)</option>
              </select>
              <select value={simulasi} onChange={e=>setSimulasi(+e.target.value)} className="styled-select">
                {SIM_LIST.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
              <select value={drgType} onChange={e=>setDrgType(e.target.value)} className="styled-select">
                <option value="1363">1363 DRG (Eksisting)</option>
                <option value="1370">1370 DRG (MST Baru)</option>
              </select>
            </div>
          </div>
          <Routes>
            <Route path="/"            element={<UjiCobaNasional   {...gp}/>} />
            <Route path="/nasional"    element={<UjiCobaNasional   {...gp}/>} />
            <Route path="/peta"        element={<PetaIdrg          {...gp}/>} />
            <Route path="/strategis"   element={<DashboardStrategis {...gp}/>} />
            <Route path="/shifting"    element={<SimulasiShifting  {...gp}/>} />
            <Route path="/cost-weight" element={<AnalisisCostWeight {...gp}/>} />
            <Route path="/tren"        element={<TrenBulanan       {...gp}/>} />
            <Route path="/anggaran"    element={<SimulasiAnggaran  {...gp}/>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **F3.3** App.jsx dan api.js berhasil dibuat

---

#### F3.4 — Halaman-halaman Frontend

Untuk setiap halaman, **adaptasi dari file referensi** dengan mengganti:
- `loadDatasetFile(dataset, 'distribution', ...)` → `api.nasional.summary(params)`
- `loadDatasetFile(dataset, 'hospitals', ...)` → `api.strategis.rsList(params)`
- `loadDatasetFile(dataset, 'shifting', ...)` → `api.shifting(params)`
- dll sesuai tabel di bawah

| Halaman | File Baru | Referensi | API yang digunakan |
|---------|-----------|-----------|-------------------|
| UjiCobaNasional | `pages/UjiCobaNasional.jsx` | `LaporanNasional.jsx` | `api.nasional.*` |
| PetaIdrg | `pages/PetaIdrg.jsx` | `PetaIdrg.jsx` | `api.peta.*` |
| DashboardStrategis | `pages/DashboardStrategis.jsx` | `DashboardStrategis.jsx` | `api.strategis.*` |
| SimulasiShifting | `pages/SimulasiShifting.jsx` | `AnalisisShifting.jsx` | `api.shifting` |
| AnalisisCostWeight | `pages/AnalisisCostWeight.jsx` | *(baru)* | `api.costweight` |
| TrenBulanan | `pages/TrenBulanan.jsx` | *(baru)* | `api.tren.bulanan` |
| SimulasiAnggaran | `pages/SimulasiAnggaran.jsx` | *(baru)* | `api.anggaran.perbandingan` |

**Pola dasar setiap halaman:**
```jsx
import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function NamaHalaman({ dataset, simulasi, drgType }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.nasional.summary({ dataset, simulasi, drg_type: drgType })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [dataset, simulasi, drgType]);

  if (loading) return <div className="loading">Memuat data...</div>;
  if (error)   return <div className="error">Error: {error}</div>;
  if (!data)   return null;

  return (
    <div className="page-container">
      {/* render data */}
    </div>
  );
}
```

- [ ] **F3.4a** UjiCobaNasional.jsx berhasil menampilkan data
- [ ] **F3.4b** PetaIdrg.jsx berhasil menampilkan peta
- [ ] **F3.4c** DashboardStrategis.jsx berhasil menampilkan profil RS
- [ ] **F3.4d** SimulasiShifting.jsx berhasil menampilkan tabel shifting
- [ ] **F3.4e** AnalisisCostWeight.jsx berhasil menampilkan analisis CW
- [ ] **F3.4f** TrenBulanan.jsx berhasil menampilkan grafik tren
- [ ] **F3.4g** SimulasiAnggaran.jsx berhasil menampilkan perbandingan skenario

---

### FASE 4 — Testing & Validasi

#### F4.1 — Validasi Data DB
```sql
-- Jumlah baris per dataset
SELECT dataset, COUNT(*) as baris FROM spending_data GROUP BY dataset;

-- Total kasus (bandingkan dengan CSV)
SELECT dataset, SUM(jml_kasus) as total_kasus FROM spending_data GROUP BY dataset;

-- Cek NULL di kode_rs
SELECT COUNT(*) FROM spending_data WHERE kode_rs IS NULL;

-- Sample data
SELECT * FROM spending_data LIMIT 5;
```

- [ ] **F4.1** Jumlah baris dan total kasus sesuai CSV

#### F4.2 — Validasi API
```powershell
$B = "http://localhost:3001/api"
(Invoke-WebRequest "$B/health").StatusCode  # harus 200
(Invoke-WebRequest "$B/nasional/summary?dataset=jan_des_v11").Content | ConvertFrom-Json
(Invoke-WebRequest "$B/nasional/by-provinsi?dataset=jan_des_v11").Content | ConvertFrom-Json | Measure-Object
(Invoke-WebRequest "$B/peta/inacbg-list?dataset=jan_des_v11").Content | ConvertFrom-Json | Measure-Object
(Invoke-WebRequest "$B/strategis/rs-list?dataset=jan_des_v11").Content | ConvertFrom-Json | Measure-Object
(Invoke-WebRequest "$B/shifting?dataset=jan_des_v11").Content | ConvertFrom-Json | Measure-Object
(Invoke-WebRequest "$B/tren/bulanan").Content | ConvertFrom-Json
(Invoke-WebRequest "$B/costweight?dataset=jan_des_v11").Content | ConvertFrom-Json | Measure-Object
(Invoke-WebRequest "$B/anggaran/perbandingan?dataset=jan_des_v11").Content | ConvertFrom-Json
```

- [ ] **F4.2** Semua 9 endpoint mengembalikan HTTP 200 dan data valid

#### F4.3 — Validasi Frontend
- [ ] **F4.3a** Semua 7 halaman load tanpa error di browser console
- [ ] **F4.3b** Ganti dataset → data refresh
- [ ] **F4.3c** Ganti simulasi → angka berubah sesuai
- [ ] **F4.3d** Peta Indonesia tampil dengan warna choropleth
- [ ] **F4.3e** Dropdown pilih RS di Dashboard Strategis berfungsi

---

## 🔧 TROUBLESHOOTING

| Masalah | Solusi |
|---------|--------|
| Import CSV lambat | Gunakan `psql \COPY` langsung, bukan INSERT |
| Out of memory saat import | Kurangi batch size di script |
| Query lambat | Pastikan indexes sudah dibuat setelah import |
| CORS error di frontend | Cek origin di `backend/server.js` |
| Port conflict | Backend: 3001, Frontend: 5173 |
| Kolom NULL setelah import | Cek mapping header CSV vs kolom DB |

---

## 📎 REFERENSI FILE

| File | Lokasi | Keterangan |
|------|--------|-----------|
| LaporanNasional.jsx | `D:\Analsisi Uji Coba\dashboard\src\pages\` | Referensi halaman Nasional (1605 baris) |
| DashboardStrategis.jsx | `D:\Analsisi Uji Coba\dashboard\src\pages\` | Referensi Dashboard RS (1674 baris) |
| AnalisisShifting.jsx | `D:\Analsisi Uji Coba\dashboard\src\pages\` | Referensi Shifting (2364 baris) |
| PetaIdrg.jsx | `D:\Analsisi Uji Coba\dashboard\src\pages\` | Referensi Peta (748 baris) |
| filterUtils.js | `D:\Analsisi Uji Coba\dashboard\src\utils\` | Logic filter RS |
| rsGroups.js | `D:\Analsisi Uji Coba\dashboard\src\utils\` | Kelompok RS + regex |
| formatters.js | `D:\Analsisi Uji Coba\dashboard\src\utils\` | Format angka |
| indonesia-prov.geojson | `D:\Analsisi Uji Coba\dashboard\public\` | GeoJSON peta Indonesia |

---

## 🚀 URUTAN EKSEKUSI CEPAT

```
[F0] Setup PostgreSQL + Node.js + buat folder
[F1.1] psql → jalankan 01_create_schema.sql
[F1.2] pip install psycopg2-binary → python 02_import_csv.py  ← 1-3 jam
[F2.1] cd backend → npm install
[F2.2] Buat server.js + db.js + .env
[F2.3] Buat semua routes (7 file) + _helpers.js
[F2.4] node server.js → test /api/health
[F3.1] cd frontend → npm create vite → npm install
[F3.2] Copy assets dari referensi (powershell commands di F3.2)
[F3.3] Buat App.jsx + utils/api.js
[F3.4] Buat 7 halaman pages/*.jsx
[F4]   Testing semua endpoint dan halaman
```

---

*Dokumen ini dibuat oleh Antigravity AI — 2026-08-02*
*Untuk melanjutkan: buka dokumen ini, cari `[ ]` pertama, dan eksekusi dari sana.*
