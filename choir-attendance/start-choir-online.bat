@echo off
title Children's Choir ZD - ONLINE (close this window to stop)
cd /d "%~dp0"

:askpin
if exist choir-pin.txt goto havepin
echo.
echo Choose a teacher PIN. You will type it on your phone to open the teacher pages.
echo Use 8 or more LETTERS and DIGITS only (no spaces). Keep it private.
set /p NEWPIN=Teacher PIN: 
>choir-pin.txt echo %NEWPIN%

:havepin
set /p CHOIR_PIN=<choir-pin.txt
echo %CHOIR_PIN%| findstr /R /C:"^[A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9][A-Za-z0-9]*$" >nul
if errorlevel 1 goto badpin
goto go

:badpin
echo.
echo That PIN is too short or has spaces or symbols. Please choose a new one.
del choir-pin.txt
goto askpin

:go
set CHOIR_PUBLIC=1
set CHOIR_TRUST_PROXY=1

echo.
echo Making the app reachable on the internet with Tailscale Funnel...
tailscale funnel --bg 3000
tailscale funnel status
echo.
echo Share the https://....ts.net address shown above with parents.
echo Keep this window open. Closing it stops the app.
echo.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000/teacher"
node server.js
pause
