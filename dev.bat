@echo off
chcp 65001 > nul
cd /d "%~dp0"

REM ─────────────────────────────────────────────
REM  마인드맵 프로젝트 - Vite 로컬 dev 서버 실행
REM  더블클릭으로 실행
REM ─────────────────────────────────────────────

if not exist node_modules (
  echo [INFO] node_modules not found - running "npm install" first...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. See messages above.
    pause
    exit /b 1
  )
)

REM ── 5173 점유 프로세스 자동 정리 (이전 dev 서버 좀비 등) ──
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
  echo [INFO] Port 5173 is held by PID %%a - terminating...
  taskkill /PID %%a /F > nul 2>&1
)

echo.
echo ============================================
echo  Vite dev server starting...
echo  URL:    http://localhost:5173/mindmap-project/
echo  Stop:   Ctrl+C  or close this window
echo ============================================
echo.

call npm run dev

echo.
echo [INFO] Dev server exited.
pause
