@echo off
title Debug Jalankan PostgreSQL
echo.
echo Menjalankan PostgreSQL Engine...
"C:\Program Files\PostgreSQL\17\bin\postgres.exe" -D "C:\Program Files\PostgreSQL\17\data"
echo.
echo [Selesai atau Error]
pause
