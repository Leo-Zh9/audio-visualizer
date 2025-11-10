#!/bin/bash
# Installation script for Python BPM scraper dependencies (Unix/Mac)

echo "============================================"
echo "Python BPM Scraper - Dependency Installation"
echo "============================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed"
    echo ""
    echo "Please install Python 3.8+ from:"
    echo "  Mac:   brew install python3"
    echo "  Linux: apt-get install python3 python3-pip"
    echo ""
    exit 1
fi

echo "[OK] Python is installed"
python3 --version
echo ""

# Install requirements
echo "Installing Python dependencies..."
echo ""
python3 -m pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi

echo ""
echo "============================================"
echo "Installation Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Test the scraper: python3 test_bpm_scraper.py"
echo "2. Start the backend: npm run dev"
echo ""

