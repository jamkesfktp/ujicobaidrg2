@echo off
chcp 65001 >nul
color 0A
title iDRG Dashboard — Launcher

REM ================================================================
REM  iDRG Dashboard Launcher
REM  Klik dua kali file ini untuk menjalankan aplikasi
REM ================================================================

:MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║       DASHBOARD ANALISIS iDRG — KEMENKES RI             ║
echo  ║       Sistem Analisis Indonesian DRG                    ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  ┌─────────────────────────────────────────────────────────┐
echo  │  [1]  Jalankan Aplikasi  (Backend + Frontend)           │
echo  │  [2]  Setup Database     (Buat DB + Schema)             │
echo  │  [3]  Import Data CSV    (Estimasi 1-3 jam)             │
echo  │  [4]  Cek Status Sistem                                 │
echo  │  [5]  Buka Browser       http://localhost:5173          │
echo  │  [0]  Keluar                                            │
echo  └─────────────────────────────────────────────────────────┘
echo.
set /p PILIH="  Pilih menu [0-5]: "

if "%PILIH%"=="1" goto JALANKAN
if "%PILIH%"=="2" goto SETUP_DB
if "%PILIH%"=="3" goto IMPORT_CSV
if "%PILIH%"=="4" goto CEK_STATUS
if "%PILIH%"=="5" goto BUKA_BROWSER
if "%PILIH%"=="0" goto KELUAR

echo  [ERROR] Pilihan tidak valid.
timeout /t 2 >nul
goto MENU

REM ================================================================
:JALANKAN
cls
echo.
echo  ▶ Menjalankan Backend + Frontend...
echo  ═══════════════════════════════════════════════════
echo.

REM Cek dan jalankan PostgreSQL jika belum jalan
netstat -ano | findstr :5432 >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
  echo  [0/3] Menghidupkan Server Database ^(PostgreSQL^)...
  IF EXIST "C:\Program Files\PostgreSQL\17\bin\postgres.exe" (
    start "PostgreSQL Server" /MIN cmd /c """C:\Program Files\PostgreSQL\17\bin\postgres.exe"" -D ""C:\Program Files\PostgreSQL\17\data"""
  ) ELSE IF EXIST "C:\Program Files\PostgreSQL\16\bin\postgres.exe" (
    start "PostgreSQL Server" /MIN cmd /c """C:\Program Files\PostgreSQL\16\bin\postgres.exe"" -D ""C:\Program Files\PostgreSQL\16\data"""
  )
  echo  Menunggu database siap...
  timeout /t 3 >nul
)


REM Cek node_modules backend
IF NOT EXIST "backend\node_modules" (
  echo  [!] node_modules backend belum ada. Install dulu...
  cd backend
  call npm install
  cd ..
)

REM Cek node_modules frontend
IF NOT EXIST "frontend\node_modules" (
  echo  [!] node_modules frontend belum ada. Install dulu...
  cd frontend
  call npm install
  cd ..
)

echo  [1/2] Menjalankan Backend API  (port 3001)...
start "iDRG Backend API" cmd /k "title iDRG Backend API (port 3001) && cd /d "%~dp0backend" && echo. && echo Memulai server... && node server.js"

echo  Menunggu backend siap (3 detik)...
timeout /t 3 >nul

echo  [2/2] Menjalankan Frontend     (port 5173)...
start "iDRG Frontend" cmd /k "title iDRG Frontend (port 5173) && cd /d "%~dp0frontend" && echo. && echo Memulai Vite... && npm run dev"

echo  Menunggu frontend siap (4 detik)...
timeout /t 4 >nul

echo  Membuka browser...
start "" "http://localhost:5173"

echo.
echo  ✅ Aplikasi berjalan!
echo.
echo  Backend : http://localhost:3001/api/health
echo  Frontend: http://localhost:5173
echo.
echo  (Tutup window CMD yang terbuka untuk menghentikan aplikasi)
echo.
pause
goto MENU

REM ================================================================
:SETUP_DB
cls
echo.
echo  ▶ Setup Database PostgreSQL
echo  ═══════════════════════════════════════════════════

REM Temukan psql
SET PSQL_PATH=""
IF EXIST "C:\Program Files\PostgreSQL\17\bin\psql.exe" SET PSQL_PATH=C:\Program Files\PostgreSQL\17\bin\psql.exe
IF EXIST "C:\Program Files\PostgreSQL\16\bin\psql.exe" SET PSQL_PATH=C:\Program Files\PostgreSQL\16\bin\psql.exe
IF EXIST "C:\Program Files\PostgreSQL\15\bin\psql.exe" SET PSQL_PATH=C:\Program Files\PostgreSQL\15\bin\psql.exe
IF EXIST "C:\Program Files\PostgreSQL\14\bin\psql.exe" SET PSQL_PATH=C:\Program Files\PostgreSQL\14\bin\psql.exe

IF "%PSQL_PATH%"=="" (
  echo.
  echo  [ERROR] PostgreSQL tidak ditemukan!
  echo.
  echo  Install PostgreSQL dulu:
  echo  winget install PostgreSQL.PostgreSQL.17
  echo.
  pause
  goto MENU
)

echo.
echo  Menggunakan: %PSQL_PATH%
echo.

REM Pastikan service PostgreSQL berjalan
echo  Memastikan service PostgreSQL berjalan...
net start postgresql-x64-17 2>nul
net start postgresql-x64-16 2>nul
net start postgresql-x64-15 2>nul
net start postgresql-x64-14 2>nul

echo.
echo  Membuat user idrg_user dan database idrg_dashboard...
echo  (Akan diminta password untuk user 'postgres')
echo.

"%PSQL_PATH%" -U postgres -c "CREATE USER idrg_user WITH ENCRYPTED PASSWORD 'idrg_pass_2026';" 2>nul
"%PSQL_PATH%" -U postgres -c "CREATE DATABASE idrg_dashboard OWNER idrg_user;" 2>nul
"%PSQL_PATH%" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE idrg_dashboard TO idrg_user;" 2>nul

echo.
echo  Menjalankan schema SQL...
"%PSQL_PATH%" -U idrg_user -d idrg_dashboard -f "backend\scripts\01_create_schema.sql"

IF %ERRORLEVEL%==0 (
  echo.
  echo  ✅ Database berhasil dibuat!
  echo  Langkah berikutnya: Pilih menu [3] untuk import CSV
) ELSE (
  echo.
  echo  [ERROR] Gagal membuat schema. Cek output di atas.
)
echo.
pause
goto MENU

REM ================================================================
:IMPORT_CSV
cls
echo.
echo  ▶ Import Data CSV ke PostgreSQL
echo  ═══════════════════════════════════════════════════
echo.
echo  PERINGATAN: Proses ini membutuhkan waktu 1-3 jam!
echo  Pastikan:
echo    1. Database sudah di-setup (menu [2])
echo    2. File CSV ada di folder ini:
echo       - spending_jan_des_v11_gabungan.csv (3.6 GB)
echo       - spending_okt_jun_v3_gabungan.csv  (7.9 GB)
echo.

IF NOT EXIST "spending_jan_des_v11_gabungan.csv" (
  echo  [ERROR] spending_jan_des_v11_gabungan.csv tidak ditemukan!
  pause
  goto MENU
)
IF NOT EXIST "spending_okt_jun_v3_gabungan.csv" (
  echo  [ERROR] spending_okt_jun_v3_gabungan.csv tidak ditemukan!
  pause
  goto MENU
)

set /p LANJUT="  Lanjutkan import? (y/n): "
if /i not "%LANJUT%"=="y" goto MENU

echo.
echo  Menjalankan import di window baru...
start "iDRG Import CSV" cmd /k "title Import CSV ke PostgreSQL && cd /d "%~dp0" && python backend\scripts\02_import_csv.py && echo. && echo IMPORT SELESAI! && pause"

echo.
echo  ✅ Import CSV berjalan di window terpisah.
echo  Pantau progressnya di window 'Import CSV ke PostgreSQL'.
echo.
pause
goto MENU

REM ================================================================
:CEK_STATUS
cls
echo.
echo  ▶ Cek Status Sistem
echo  ═══════════════════════════════════════════════════
echo.

REM Node.js
node --version >nul 2>&1
IF %ERRORLEVEL%==0 (
  for /f %%i in ('node --version') do echo  ✅ Node.js: %%i
) ELSE (
  echo  ❌ Node.js: TIDAK DITEMUKAN
)

REM npm
npm --version >nul 2>&1
IF %ERRORLEVEL%==0 (
  for /f %%i in ('npm --version') do echo  ✅ npm: %%i
) ELSE (
  echo  ❌ npm: TIDAK DITEMUKAN
)

REM Python
python --version >nul 2>&1
IF %ERRORLEVEL%==0 (
  for /f "tokens=*" %%i in ('python --version') do echo  ✅ %%i
) ELSE (
  echo  ❌ Python: TIDAK DITEMUKAN
)

REM psycopg2
python -c "import psycopg2; print('psycopg2 ' + psycopg2.__version__)" >nul 2>&1
IF %ERRORLEVEL%==0 (
  for /f "tokens=*" %%i in ('python -c "import psycopg2; print(psycopg2.__version__)"') do echo  ✅ psycopg2: %%i
) ELSE (
  echo  ❌ psycopg2: pip install psycopg2-binary
)

REM PostgreSQL
SET PSQL_FOUND=NO
FOR %%v IN (17 16 15 14) DO (
  IF EXIST "C:\Program Files\PostgreSQL\%%v\bin\psql.exe" (
    for /f "tokens=*" %%i in ('"C:\Program Files\PostgreSQL\%%v\bin\psql.exe" --version') do echo  ✅ PostgreSQL: %%i
    SET PSQL_FOUND=YES
  )
)
IF "%PSQL_FOUND%"=="NO" echo  ❌ PostgreSQL: TIDAK DITEMUKAN (winget install PostgreSQL.PostgreSQL.17)

REM File CSV
echo.
IF EXIST "spending_jan_des_v11_gabungan.csv" (
  for %%F in ("spending_jan_des_v11_gabungan.csv") do echo  ✅ jan_des CSV: %%~zF bytes
) ELSE (
  echo  ❌ jan_des CSV: TIDAK ADA
)
IF EXIST "spending_okt_jun_v3_gabungan.csv" (
  for %%F in ("spending_okt_jun_v3_gabungan.csv") do echo  ✅ okt_jun CSV: %%~zF bytes
) ELSE (
  echo  ❌ okt_jun CSV: TIDAK ADA
)

REM node_modules
echo.
IF EXIST "backend\node_modules" (echo  ✅ backend/node_modules: ADA) ELSE (echo  ⚠  backend/node_modules: BELUM — jalankan cd backend ^& npm install)
IF EXIST "frontend\node_modules" (echo  ✅ frontend/node_modules: ADA) ELSE (echo  ⚠  frontend/node_modules: BELUM — jalankan cd frontend ^& npm install)

REM Cek apakah backend berjalan
echo.
curl -s http://localhost:3001/api/health >nul 2>&1
IF %ERRORLEVEL%==0 (
  echo  ✅ Backend API: BERJALAN  (http://localhost:3001)
) ELSE (
  echo  ⚠  Backend API: TIDAK BERJALAN
)

REM Cek apakah frontend berjalan
curl -s http://localhost:5173 >nul 2>&1
IF %ERRORLEVEL%==0 (
  echo  ✅ Frontend: BERJALAN  (http://localhost:5173)
) ELSE (
  echo  ⚠  Frontend: TIDAK BERJALAN
)

echo.
pause
goto MENU

REM ================================================================
:BUKA_BROWSER
start "" "http://localhost:5173"
echo  Browser dibuka ke http://localhost:5173
timeout /t 2 >nul
goto MENU

REM ================================================================
:KELUAR
cls
echo.
echo  Terima kasih. Sampai jumpa!
echo.
timeout /t 2 >nul
exit
