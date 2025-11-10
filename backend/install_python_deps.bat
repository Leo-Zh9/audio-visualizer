@echo off
REM Installation script for Python BPM scraper dependencies (Windows)

echo ============================================
echo Python BPM Scraper - Dependency Installation
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo.
    echo Please install Python 3.8+ from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo [OK] Python is installed
python --version
echo.

REM Install requirements
echo Installing Python dependencies...
echo.
python -m pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ============================================
echo Installation Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Test the scraper: python test_bpm_scraper.py
echo 2. Start the backend: npm run dev
echo.
pause

