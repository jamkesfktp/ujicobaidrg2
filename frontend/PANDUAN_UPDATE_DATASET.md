# Panduan Update Dataset Simulasi iDRG

Dokumen ini adalah panduan lengkap agar ketika Anda mengupdate dataset baru (misal: *Dataset 4*, *Dataset 5*), aplikasi tidak mengalami *error* (seperti `prop is not defined`) dan nilai pada **Tabel Kertas Kerja** maupun **Profil RS** tidak kembali menjadi 0.

---

## 1. Masalah Utama yang Sering Terjadi (Root Causes)
1. **Nilai Profil RS / Layanan 0**: Terjadi karena dataset mentah (CSV) *tidak diagregasi secara spesifik berdasarkan Kelompok Layanan (Mata, THT, Gigi, dll)*. UI aplikasi (seperti `RsProfileModal.jsx` dan `SimulasiLayananKhusus.jsx`) membutuhkan struktur data yang *exact* hingga 6 tingkat: 
   `crosstab -> byLayanan -> [Nama Layanan] -> byKompetensi -> [Kelas Faskes] -> [Kelas Rawat] -> [Kompetensi]`.
2. **Aplikasi Crash saat Filter Regional**: Biasanya karena ada variabel UI yang bentrok dengan *minifier* (misalnya variabel `prop`). 

## 2. Alur Standar Pemrosesan Dataset Baru
Jika ada dataset baru berukuran giga-byte, langkah yang harus dilakukan oleh *AI Assistant* adalah:
1. **Split Data (Opsional tapi disarankan)**: Memecah file CSV raksasa menjadi per-bulan (contoh: menggunakan skrip `split_csv.py`).
2. **Agregasi Python**: Membuat / menduplikasi skrip `process_datasetX.py` yang memproses chunk CSV. Di sinilah **kunci utamanya**: AI harus memastikan kolom `kelompok_idrg` diekstrak dan dipetakan ke dalam variabel JSON `byLayanan`.
3. **Run in Background**: Menjalankan skrip Python di latar belakang karena akan memakan waktu 1-2 jam.
4. **Merge JSON**: Menjalankan `merge_datasetX.py` untuk menggabungkan file *chunk* menjadi 1 file akhir berekstensi `.json.gz`.
5. **Update State UI**: Memperbarui *pointer* dataset (contoh: di `App.jsx` atau context) agar mengarah ke folder dataset yang baru.

---

## 3. Template Prompt untuk AI Assistant
Simpan teks di bawah ini. Ketika Anda memiliki dataset baru dan ingin saya (atau AI lain) memprosesnya, cukup **Copy - Paste** prompt ini:

> **PROMPT UNTUK UPDATE DATASET:**
> 
> "Bro, saya ingin menambahkan dataset baru ke dalam dashboard. Tolong lakukan pemrosesan end-to-end dengan pedoman wajib berikut agar UI Kertas Kerja dan Profil RS tidak error atau bernilai 0:
> 
> 1. **Agregasi Python (Krusial)**: Buat skrip agregasi Python (misal `process_dataset_baru.py`). Kamu **WAJIB** memastikan bahwa kolom `kelompok_idrg` (Mata, THT, dll) dari CSV diekstrak, dan dimasukkan ke dalam objek `crosstab['byLayanan']` dengan hierarki bersarang persis seperti ini:
>    `byLayanan[nama_layanan]['byKompetensi'][kelas_faskes][kelas_rawat][kompetensi] = { kasus, inacbg, sim }`
>    Ini wajib dilakukan, jangan sampai menggunakan kolom `ptd` (bernilai 1 atau 2) sebagai key layanan, karena akan membuat Tabel Kertas Kerja di UI gagal membaca nilainya (menjadi 0).
> 2. **Proses Background**: Karena file-nya sangat besar, gunakan *chunking* (Pandas) di Python dan jalankan prosesnya di background task agar tidak terputus.
> 3. **Merge**: Setelah agregasi selesai, buat dan jalankan skrip `merge_dataset_baru.py` untuk mengkompres hasil agregasi per bulan menjadi JSON utuh (`.json.gz`).
> 4. **Update UI & Backward Compatibility**: Setelah JSON selesai di-push, update path file di aplikasi (misalnya di `App.jsx` atau pemanggilan data terkait) agar mengambil data terbaru. Tolong review komponen `RsProfileModal.jsx`, `SimulasiLayananKhusus.jsx`, dan fungsi `exportKertasKerjaExcel` agar variabel atau struktur filternya (terutama wilayah/provinsi) tidak error saat minifikasi."

---
*Catatan Tambahan: Proses ekstraksi dictionary 6 level di Python (seperti poin 1) terbukti memakan waktu komputasi yang tinggi (~20-25 menit per bulan data). Bersabarlah saat AI sedang menjalankannya di latar belakang.*
