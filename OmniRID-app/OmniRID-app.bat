@echo off
rem ======================================================
rem  OmniRID App - local launcher (Nuxt 3 PWA)
rem  Prerequisito: Node.js 18+ (npm incluso)
rem ======================================================
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERRORE] Node.js non trovato. Installa Node.js 18+ da https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Prima installazione: installo le dipendenze...
    call npm install
    if errorlevel 1 (
        echo [ERRORE] npm install fallito.
        pause
        exit /b 1
    )
)

echo Avvio OmniRID App all'indirizzo http://localhost:3000 ...

rem Nuxt dev server sul socket 3000.
rem npm run dev -- -p 3000 richiede NUXT_APP_BASE_URL=/ in locale (default: la PWA usa baseURL di produzione).
set NUXT_APP_BASE_URL=/

rem Avvia il server in sotto-processo silenzioso
start "" /b cmd /c "npm run dev"

rem Aspetta che la porta risponda (max ~60s), poi apre il browser
setlocal EnableExtensions
set tries=0
:waitloop
set /a tries+=1
if %tries% gtr 60 goto timeout
ping -n 2 127.0.0.1 >nul
powershell -NoProfile -Command "try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',3000); $c.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 goto waitloop

start "" http://localhost:3000
echo Fatto. Porta 3000 attiva, browser aperto.
pause
exit /b 0

:timeout
echo [ERRORE] Il server non risponde sulla porta 3000 dopo 60 secondi.
echo Controlla la finestra del server o la porta (netstat -ano ^| findstr :3000).
pause