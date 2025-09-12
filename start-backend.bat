@echo off
echo Starting Amify Backend Server...
echo.
cd /d "c:\Users\ebito\workspace\web\personal\amify\backend"
echo Installing dependencies...
npm install
echo.
echo Starting development server...
npm run dev
pause
