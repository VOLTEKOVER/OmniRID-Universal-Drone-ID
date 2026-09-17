@echo off
rem ======================================================
rem  OmniRID App - local launcher (PWA)
rem  Prerequisito: Node.js 18+ (npx incluso)
rem ======================================================
cd /d "%~dp0"

where npx >nul 2>nul
if errorlevel 1 (
    echo [ERRORE] Node.js non trovato. Installa Node.js 18+ da https://nodejs.org
    pause
    exit /b 1
)

echo Avvio OmniRID App all'indirizzo http://localhost:8080 ...

rem Avvia il server in sotto-processo silenzioso
start "" /b cmd /c "npx --yes http-server . -p 8080 -c-1"

rem Aspetta che la porta risponda (max ~30s), poi apre il browser
setlocal EnableExtensions
set /a tries=0
:waitloop
set /a tries+=1
if %tries% gtr 30 goto timeout
powershell -NoProfile -Command "try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',8080); $c.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto waitloop
)

start "" http://localhost:8080
echo Fatto. Porta 8080 attiva, browser aperto.
pause
exit /b 0

:timeout
echo [ERRORE] Il server non risponde sulla porta 8080 dopo 30 secondi.
echo Controlla che la porta non sia occupata (netstat -ano ^| findstr :8080).
pause