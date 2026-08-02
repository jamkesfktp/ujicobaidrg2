@echo off
title Perbaikan Sistem PostgreSQL
color 0E
echo.
echo =======================================================
echo MEMPERBAIKI FILE DLL POSTGRESQL YANG HILANG (CORRUPT)
echo =======================================================
echo.
echo Sedang menyalin ulang file sistem yang hilang...
copy /Y "%~dp0pg_extract_tar\pgsql\bin\*.dll" "C:\Program Files\PostgreSQL\17\bin\"
echo.
echo =======================================================
echo PERBAIKAN SELESAI!
echo =======================================================
echo Silakan tutup jendela hitam ini dan jalankan aplikasi.
pause
