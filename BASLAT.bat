@echo off
title Muhasebe Demo
echo ===================================================
echo     MUHASEBE DEMO UYGULAMASI BASLATILIYOR...
echo ===================================================
echo.
cd /d "%~dp0"
start http://localhost:3000
node server.js
pause
