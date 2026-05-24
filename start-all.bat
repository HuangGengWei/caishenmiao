@echo off

REM 0. 先确保 MySQL80 在运行
sc query MySQL80 | findstr /I "RUNNING" >nul
if errorlevel 1 (
  echo [INFO] MySQL80 not running, starting...
  sc start MySQL80 >nul
  timeout /t 3 /nobreak >nul
)

sc query MySQL80 | findstr /I "RUNNING" >nul
if errorlevel 1 (
  echo [ERROR] MySQL80 failed to start. Please check:
  echo         C:\ProgramData\MySQL\MySQL Server 8.0\Data\SK-JARHMJZUMTML.err
  pause
  exit /b 1
)

REM 1. 启动 nginx（后台）
cd /d F:\nginx-1.28.2
start "" nginx.exe

REM 2. 启动 Next.js，监听 3000
cd /d F:\caishenmiao
call npm run start -- -p 3000