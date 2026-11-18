@echo off
cd /d "%~dp0"
start "" http://localhost:4173
python scripts/serve_app.py
pause
