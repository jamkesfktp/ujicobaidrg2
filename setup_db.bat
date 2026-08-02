@echo off
REM ================================================================
REM setup_db.bat — Setup database iDRG Dashboard setelah PostgreSQL install
REM Jalankan sebagai: setup_db.bat
REM ================================================================

echo.
echo ========================================
echo  iDRG Dashboard — Database Setup
echo ========================================
echo.

REM Cari psql di lokasi PostgreSQL yang umum
SET PSQL=""
IF EXIST "C:\Program Files\PostgreSQL\17\bin\psql.exe" SET PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
IF EXIST "C:\Program Files\PostgreSQL\16\bin\psql.exe" SET PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
IF EXIST "C:\Program Files\PostgreSQL\15\bin\psql.exe" SET PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"

IF %PSQL%=="" (
  echo [ERROR] psql.exe tidak ditemukan!
  echo Pastikan PostgreSQL sudah terinstall.
  pause
  exit /b 1
)

echo [1] Menggunakan: %PSQL%
echo.

REM Buat user dan database (login sebagai postgres)
echo [2] Membuat user idrg_user dan database idrg_dashboard...
echo     (akan diminta password untuk user postgres)
echo.

%PSQL% -U postgres -c "CREATE USER idrg_user WITH ENCRYPTED PASSWORD 'idrg_pass_2026';" 2>NUL
%PSQL% -U postgres -c "CREATE DATABASE idrg_dashboard OWNER idrg_user;" 2>NUL
%PSQL% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE idrg_dashboard TO idrg_user;"

echo.
echo [3] Menjalankan schema SQL...
%PSQL% -U idrg_user -d idrg_dashboard -f "backend\scripts\01_create_schema.sql"

echo.
echo ========================================
echo  Setup selesai!
echo.
echo  Langkah berikutnya:
echo  1. python backend\scripts\02_import_csv.py
echo     (estimasi 1-3 jam untuk kedua CSV)
echo.
echo  2. cd backend ^& npm install ^& node server.js
echo.
echo  3. cd frontend ^& npm run dev
echo ========================================
pause
