@echo off
color 0A
echo ========================================================
echo      ONE-CLICK INSTALLER: WINDOWS MONITOR AGENT
echo ========================================================
echo.

:: 1. Memeriksa akses Administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Akses Administrator terdeteksi.
) else (
    echo [ERROR] Script ini harus dijalankan sebagai Administrator!
    echo Klik kanan file install.bat lalu pilih "Run as administrator".
    pause
    exit /b 1
)

:: 2. Memeriksa Node.js
node -v >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan! 
    echo Harap install Node.js terlebih dahulu dari https://nodejs.org/
    pause
    exit /b 1
)

:: 3. Pindah ke direktori tempat script ini berada
cd /d "%~dp0"

:: 4. Menginstall PM2
echo.
echo [INFO] Menginstall PM2 secara global (jika belum ada)...
call npm install -g pm2

:: 5. Menginstall dependencies lokal (jika ada)
echo.
echo [INFO] Menginstall dependensi proyek...
call npm install

:: 6. Menjalankan program menggunakan PM2
echo.
echo [INFO] Menjalankan Monitoring Agent...
call pm2 start "%~dp0ecosystem.config.cjs"

:: 7. Menyimpan state PM2
echo.
echo [INFO] Menyimpan konfigurasi PM2...
call pm2 save

:: 8. Menambahkan auto-start ke Windows Task Scheduler (Agar otomatis jalan saat PC restart tanpa perlu login)
echo.
echo [INFO] Menambahkan ke Windows Task Scheduler (Auto-start saat boot)...
set PROJECT_DIR=%~dp0
set ECOSYSTEM_FILE=%PROJECT_DIR%ecosystem.config.cjs

:: Hapus task lama jika ada, lalu buat task baru yang dijalankan oleh akun SYSTEM saat PC dinyalakan
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-ScheduledTask -TaskName 'WindowsMonitorAgent_AutoStart' -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName 'WindowsMonitorAgent_AutoStart' -Confirm:$false }; $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c pm2 start \"\"%ECOSYSTEM_FILE%\"\"'; $trigger = New-ScheduledTaskTrigger -AtStartup; Register-ScheduledTask -TaskName 'WindowsMonitorAgent_AutoStart' -Action $action -Trigger $trigger -RunLevel Highest -User 'NT AUTHORITY\SYSTEM' | Out-Null"

echo.
echo ========================================================
echo [SUCCESS] INSTALASI SELESAI!
echo ========================================================
echo Aplikasi monitoring kini sudah berjalan di latar belakang.
echo Aplikasi akan OTOMATIS berjalan kembali setiap PC di-restart,
echo bahkan sebelum user Windows login.
echo.
echo Anda dapat mengecek status aplikasi dengan mengetikkan:
echo pm2 status
echo pm2 logs windows-monitor-agent
echo ========================================================
pause
