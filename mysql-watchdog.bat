@echo off
REM Keep MySQL80 alive: if stopped, start it.
sc query MySQL80 | findstr /I "RUNNING" >nul
if errorlevel 1 (
  sc start MySQL80 >nul
)
