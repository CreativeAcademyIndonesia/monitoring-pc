@echo off
color 0A
echo ========================================================
echo   REGISTER ^& START WINDOWS MONITOR AGENT (TANPA PM2)
echo ========================================================
echo.

:: 1. Memeriksa akses Administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Akses Administrator terdeteksi.
) else (
    echo [ERROR] Script ini harus dijalankan sebagai Administrator!
    echo Klik kanan file start.bat lalu pilih "Run as administrator".
    pause
    exit /b 1
)

:: 2. Memastikan masuk ke direktori script
cd /d "%~dp0"
set SCRIPT_PATH=%~dp0server.js
set WORKING_DIR=%~dp0

:: 3. Menghapus Service/Task lama jika sudah ada
echo [INFO] Menyiapkan Windows Task Scheduler...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-ScheduledTask -TaskName 'WindowsMonitorAgent_Native' -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName 'WindowsMonitorAgent_Native' -Confirm:$false }"

:: 4. Mendaftarkan Task baru yang berjalan otomatis di background sebagai akun SYSTEM
echo [INFO] Mendaftarkan aplikasi agar otomatis hidup saat PC dinyalakan...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$action = New-ScheduledTaskAction -Execute 'node.exe' -Argument '\"\"%SCRIPT_PATH%\"\"' -WorkingDirectory '\"\"%WORKING_DIR%\"\"'; $trigger = New-ScheduledTaskTrigger -AtStartup; Register-ScheduledTask -TaskName 'WindowsMonitorAgent_Native' -Action $action -Trigger $trigger -RunLevel Highest -User 'NT AUTHORITY\SYSTEM' | Out-Null"

:: 5. Menyalakan aplikasinya sekarang juga!
echo [INFO] Menjalankan aplikasi di latar belakang (Hidden) detik ini juga...
schtasks /Run /TN "WindowsMonitorAgent_Native"

echo.
echo ========================================================
echo [SUCCESS] SERVICE BERJALAN DI BACKGROUND!
echo ========================================================
echo Aplikasi telah berhasil dijalankan murni menggunakan Node.js
echo Tidak akan ada jendela CMD yang terbuka (berjalan tersembunyi).
echo Aplikasi otomatis hidup (Autostart) setiap kali PC di-restart.
echo.
echo [CARA MEMATIKANNYA]:
echo Buka "Task Manager" -^> Tab "Details" -^> Cari "node.exe" -^> End Task.
echo Atau buka aplikasi "Task Scheduler" bawaan Windows untuk
echo menghapus/mematikan task 'WindowsMonitorAgent_Native'.
echo ========================================================
pause
