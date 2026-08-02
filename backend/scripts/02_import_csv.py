"""
02_import_csv.py — Import CSV besar ke PostgreSQL
================================================
Menggunakan psycopg2 COPY FROM STDIN (tercepat, lebih baik dari INSERT batch).
Estimasi: 30-90 menit per file CSV.

Install: pip install psycopg2-binary
Jalankan: python backend/scripts/02_import_csv.py
"""

import psycopg2
import psycopg2.extras
import csv
import sys
import time
import os
from io import StringIO

# ─── Konfigurasi ─────────────────────────────────────────────────────────────
DB_CONFIG = {
    'host':     'localhost',
    'port':     5432,
    'dbname':   'idrg_dashboard',
    'user':     'idrg_user',
    'password': 'idrg_pass_2026',
}

BASE_DIR = r"D:\KERJAAN PUSBIKES\Analisis Ujicoba\UJICOBA IDRG FIX"

FILES = [
    {
        'path':    os.path.join(BASE_DIR, 'spending_jan_des_v11_gabungan.csv'),
        'dataset': 'jan_des_v11',
        'has_bulan': False,
        'expected_rows': 6_540_000,
    },
    {
        'path':    os.path.join(BASE_DIR, 'spending_okt_jun_v3_gabungan.csv'),
        'dataset': 'okt_jun_v3',
        'has_bulan': True,
        'expected_rows': 13_900_000,
    },
]

# Kolom target di DB (urutan mapping dari CSV header)
# Catatan: nama_rs di CSV tapi tidak disimpan di spending_data (disimpan di RS master)
CSV_TO_DB = {
    'kode_rs':            'kode_rs',
    'nama_rs':            None,       # skip — tidak ada di spending_data
    'propinsi':           'propinsi',
    'kabupaten':          'kabupaten',
    'PEMILIK':            'pemilik',
    'JENIS':              'jenis',
    'jenis_faskes':       'jenis_faskes',
    'pemilik_faskes':     'pemilik_faskes',
    'kelas_faskes':       'kelas_faskes',
    'regional_2023':      'regional_2023',
    'blu_non_blu':        'blu_non_blu',
    'rs_vertikal':        'rs_vertikal',
    'ptd':                'ptd',
    'kelas_rawat':        'kelas_rawat',
    'kelompok_idrg':      'kelompok_idrg',
    'kelompok_icd':       'kelompok_icd',
    'faskes_kompetensi':  'faskes_kompetensi',
    'klaim_kompetensi':   'klaim_kompetensi',
    'inacbg':             'inacbg',
    'desc_inacbg':        'desc_inacbg',
    'idrg_mdc':           'idrg_mdc',
    'idrg_dc_1370':       'idrg_dc_1370',
    'idrg_code_1370':     'idrg_code_1370',
    'desc_idrg_1370':     'desc_idrg_1370',
    'idrg_dc_1363':       'idrg_dc_1363',
    'idrg_code_1363':     'idrg_code_1363',
    'desc_idrg_1363':     'desc_idrg_1363',
    'bulan_data_uji_coba':'bulan_data_uji_coba',  # hanya okt_jun
    'jml_kasus':                          'jml_kasus',
    'total_tarif_inacbg':                 'total_tarif_inacbg',
    'tarif_inacbg':                       'tarif_inacbg',
    'tarif_inacbg_1':                     'tarif_inacbg_1',
    'total_tarifrs':                      'total_tarifrs',
    'idrg_tarif_1363_tanpa_af':                          'idrg_tarif_1363_tanpa_af',
    'idrg_total_tarif_1363_tanpa_af':                    'idrg_total_tarif_1363_tanpa_af',
    'idrg_total_tarif_1363_dengan_af':                   'idrg_total_tarif_1363_dengan_af',
    'idrg_total_tarif_1363_dengan_af_afreg':             'idrg_total_tarif_1363_dengan_af_afreg',
    'idrg_total_tarif_1363_dengan_af_afreg_afkep':       'idrg_total_tarif_1363_dengan_af_afreg_afkep',
    'idrg_tarif_1370_tanpa_af':                          'idrg_tarif_1370_tanpa_af',
    'idrg_total_tarif_1370_tanpa_af':                    'idrg_total_tarif_1370_tanpa_af',
    'idrg_total_tarif_1370_dengan_af':                   'idrg_total_tarif_1370_dengan_af',
    'idrg_total_tarif_1370_dengan_af_afreg':             'idrg_total_tarif_1370_dengan_af_afreg',
    'idrg_total_tarif_1370_dengan_af_afreg_afkep':       'idrg_total_tarif_1370_dengan_af_afreg_afkep',
    'idrg_total_tarif_1363_tanpa_af_juknistopup':                'idrg_total_tarif_1363_tanpa_af_juknistopup',
    'idrg_total_tarif_1363_dengan_af_juknistopup':               'idrg_total_tarif_1363_dengan_af_juknistopup',
    'idrg_total_tarif_1363_dengan_af_afreg_juknistopup':         'idrg_total_tarif_1363_dengan_af_afreg_juknistopup',
    'idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup':   'idrg_total_tarif_1363_dengan_af_afreg_afkep_juknistopup',
    'idrg_total_tarif_1370_tanpa_af_juknistopup':                'idrg_total_tarif_1370_tanpa_af_juknistopup',
    'idrg_total_tarif_1370_dengan_af_juknistopup':               'idrg_total_tarif_1370_dengan_af_juknistopup',
    'idrg_total_tarif_1370_dengan_af_afreg_juknistopup':         'idrg_total_tarif_1370_dengan_af_afreg_juknistopup',
    'idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup':   'idrg_total_tarif_1370_dengan_af_afreg_afkep_juknistopup',
}

BATCH_SIZE = 50_000  # baris per commit


def clean_val(v):
    """Bersihkan nilai: kosong / nan → None (akan jadi NULL di DB)"""
    if v is None:
        return None
    sv = str(v).strip()
    if sv in ('', 'nan', 'NaN', 'NULL', 'None', '#N/A'):
        return None
    return sv


def import_file(cfg):
    path    = cfg['path']
    dataset = cfg['dataset']
    has_bulan = cfg['has_bulan']

    print(f"\n{'='*60}")
    print(f"📂  File   : {os.path.basename(path)}")
    print(f"    Dataset: {dataset}")
    print(f"    has bulan_data_uji_coba: {has_bulan}")
    print(f"{'='*60}")

    if not os.path.exists(path):
        print(f"❌ File tidak ditemukan: {path}")
        return

    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur  = conn.cursor()

    # Hapus data lama untuk dataset ini
    print(f"🗑️   Menghapus data lama untuk dataset '{dataset}'...")
    cur.execute("DELETE FROM spending_data WHERE dataset = %s", (dataset,))
    conn.commit()

    start   = time.time()
    total   = 0
    errors  = 0
    buf     = StringIO()
    batch   = 0

    with open(path, 'r', encoding='utf-8-sig', errors='replace', newline='') as f:
        reader = csv.DictReader(f)

        # Normalisasi header: PEMILIK → pemilik, JENIS → jenis
        raw_headers = reader.fieldnames
        norm = {}
        for h in raw_headers:
            norm[h] = CSV_TO_DB.get(h, h)

        # Tentukan kolom DB yang akan diisi (urutkan agar konsisten)
        db_cols = ['dataset']
        for h in raw_headers:
            db_col = CSV_TO_DB.get(h)
            if db_col is not None:
                # Lewati bulan jika tidak ada di file ini
                if db_col == 'bulan_data_uji_coba' and not has_bulan:
                    continue
                db_cols.append(db_col)

        col_str = ', '.join(db_cols)
        print(f"📋  Kolom DB yang diisi ({len(db_cols)}): {col_str[:100]}...")

        for row in reader:
            try:
                vals = [dataset]
                for h in raw_headers:
                    db_col = CSV_TO_DB.get(h)
                    if db_col is None:
                        continue
                    if db_col == 'bulan_data_uji_coba' and not has_bulan:
                        continue
                    v = clean_val(row.get(h))
                    # Tab-separated: tab dan newline harus di-escape
                    if v is not None:
                        v = v.replace('\t', ' ').replace('\n', ' ').replace('\r', '')
                    vals.append(v)

                # Tulis ke buffer (TSV format untuk COPY FROM STDIN)
                line = '\t'.join('\\N' if v is None else v for v in vals) + '\n'
                buf.write(line)
                batch += 1
                total += 1

                if batch >= BATCH_SIZE:
                    buf.seek(0)
                    cur.copy_expert(
                        f"COPY spending_data ({col_str}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')",
                        buf
                    )
                    conn.commit()
                    buf = StringIO()
                    batch = 0

                    elapsed = time.time() - start
                    rate = total / elapsed if elapsed > 0 else 0
                    est_remain = (cfg['expected_rows'] - total) / rate / 60 if rate > 0 else 0
                    print(f"\r  ✅ {total:>10,} baris | {rate:>6.0f} baris/dtk | ~{est_remain:>4.0f} mnt tersisa    ",
                          end='', flush=True)

            except Exception as row_err:
                errors += 1
                if errors <= 5:
                    print(f"\n  ⚠️  Baris error (baris ~{total}): {str(row_err)[:100]}")

        # Flush sisa
        if batch > 0:
            buf.seek(0)
            cur.copy_expert(
                f"COPY spending_data ({col_str}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N')",
                buf
            )
            conn.commit()

    elapsed = time.time() - start
    print(f"\n\n✅ Selesai! {total:,} baris dalam {elapsed/60:.1f} menit | {errors} error")

    # Verifikasi
    cur.execute("SELECT COUNT(*) FROM spending_data WHERE dataset = %s", (dataset,))
    db_count = cur.fetchone()[0]
    print(f"   Verifikasi DB: {db_count:,} baris tersimpan untuk '{dataset}'")

    cur.close()
    conn.close()


def create_indexes():
    print("\n📊  Membuat indexes (mungkin 5-15 menit)...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    cur  = conn.cursor()

    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_sd_kode_rs  ON spending_data(kode_rs, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_propinsi ON spending_data(propinsi, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_idrg1363 ON spending_data(idrg_code_1363, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_idrg1370 ON spending_data(idrg_code_1370, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_inacbg   ON spending_data(inacbg, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_kelompok ON spending_data(kelompok_idrg, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_bulan    ON spending_data(bulan_data_uji_coba, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_komp     ON spending_data(klaim_kompetensi, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_pemilik  ON spending_data(pemilik, dataset)",
        "CREATE INDEX IF NOT EXISTS idx_sd_kelas    ON spending_data(kelas_faskes, dataset)",
    ]

    for sql in indexes:
        name = sql.split('idx_')[1].split(' ')[0]
        print(f"  Membuat: idx_{name}...", end='', flush=True)
        t0 = time.time()
        cur.execute(sql)
        print(f" ✅ ({time.time()-t0:.1f}s)")

    cur.close()
    conn.close()
    print("✅ Semua indexes selesai!")


def verify_all():
    print("\n🔍  Verifikasi akhir...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()

    cur.execute("SELECT dataset, COUNT(*) as baris, SUM(jml_kasus) as total_kasus FROM spending_data GROUP BY dataset ORDER BY dataset")
    rows = cur.fetchall()
    print(f"\n  {'Dataset':<20} {'Baris':>12} {'Total Kasus':>15}")
    print(f"  {'-'*50}")
    for r in rows:
        print(f"  {r[0]:<20} {r[1]:>12,} {r[2]:>15,}")

    cur.close()
    conn.close()


if __name__ == '__main__':
    print("🚀  iDRG Dashboard — Import CSV ke PostgreSQL")
    print(f"    Waktu mulai: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    # Test koneksi
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.close()
        print("✅  Koneksi PostgreSQL berhasil\n")
    except Exception as e:
        print(f"❌  Gagal koneksi ke PostgreSQL: {e}")
        print("    Pastikan PostgreSQL berjalan dan kredensial di script benar")
        sys.exit(1)

    # Import kedua file
    for f in FILES:
        import_file(f)

    # Buat indexes
    create_indexes()

    # Verifikasi
    verify_all()

    print(f"\n🎉  Semua selesai! Waktu: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("    Langkah berikutnya: cd backend && npm install && node server.js")
