@echo off
title Choir app (close this window to stop the app)
cd /d "%~dp0"
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000/teacher"
echo Starting the choir app. Keep this window open while you use it.
node server.js
pause
