@echo off
cd /d "%~dp0"
title OTT Content Recommender
color 0A

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║   OTT CONTENT RECOMMENDER                   ║
echo  ║   DMGT + ADSA + OOPJ + Python k-NN         ║
echo  ╚════════════════════════════════════════════╝
echo.

REM ── Step 1: Compile Java ────────────────────────────────────────
echo [1/3] Compiling Java (DMGT + ADSA + OOPJ)...
javac java\GenreEquivalence.java java\CoWatchGraph.java java\WatchHistoryProcessor.java java\Main.java -d java\out 2>nul

if %errorlevel% neq 0 (
    echo [WARN] Java compilation failed or Java not installed.
    echo [INFO] Using pre-generated processed_data.json instead.
    echo.
) else (
    echo [OK]  Java compiled successfully.

    REM ── Step 2: Run Java to generate processed_data.json ──────────
    echo [2/3] Running Java data processor...
    java -cp java\out Main
    if %errorlevel% neq 0 (
        echo [WARN] Java run failed. Using pre-generated data.
    ) else (
        echo [OK]  processed_data.json generated.
    )
    echo.
)

REM ── Step 3: Install Flask if needed, then start Python server ───
echo [3/3] Starting Python k-NN server...
python -c "import flask" 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Installing Flask...
    pip install flask -q
)

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  Open http://localhost:5000 in your browser  ║
echo  ║  If the port is already busy, the app is     ║
echo  ║  already running in the background           ║
echo  ╚══════════════════════════════════════════════╝
echo.

REM Prevent duplicate server launches on repeated runs.
python -c "import socket; s=socket.socket(); s.settimeout(1); print(s.connect_ex(('127.0.0.1', 5000)))" > temp_port_check.txt 2>nul
set /p port_status=<temp_port_check.txt
del temp_port_check.txt 2>nul

if "%port_status%" == "0" (
    echo [INFO] Python server already running on http://localhost:5000
) else (
    start "OTT Recommender Server" /b python app.py
)

echo [INFO] Waiting for the server to become ready...
set "server_ready=0"
for /l %%i in (1,1,20) do (
    powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5000/' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 (
        set "server_ready=1"
        goto :server_ready
    )
    timeout /t 1 /nobreak >nul
)

:server_ready
if "%server_ready%" == "1" (
    echo [OK] Server is ready. Opening the app...
    start "" "http://localhost:5000"
) else (
    echo [ERROR] The Python server did not start. Run "python app.py" to see the error.
)
