@echo off
title Gold Candle Timers - Windows build
echo [1/2] npm install ...
call npm install
if errorlevel 1 goto err
echo [2/2] .exe ban raha hai (dist\) ...
call npm run dist
if errorlevel 1 goto err
echo.
echo DONE! dist\ folder me "Gold Candle Timers Setup 1.0.0.exe" (installer)
echo aur "Gold Candle Timers 1.0.0.exe" (portable) milenge.
goto end
:err
echo BUILD FAIL ho gaya — upar ki error dekho. Node.js LTS install hai ya nahi check karo.
:end
pause
