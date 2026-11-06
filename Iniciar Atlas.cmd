@echo off
cd /d "%~dp0"
if exist "C:\Python314\python.exe" (
  "C:\Python314\python.exe" serve.py
) else (
  python serve.py
)
pause
