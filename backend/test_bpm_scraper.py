#!/usr/bin/env python3
"""
Test script for BPM scraper

This script tests the BPM scraper with various songs to verify it works correctly.
"""

import sys
import os

# Add the utils directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'utils'))

from bpm_scraper import get_bpm_from_songbpm, clear_cache, get_cache_stats

def test_song(artist, song_name, expected_bpm=None):
    """Test a single song"""
    print(f"\n{'='*60}")
    print(f"Testing: '{song_name}' by {artist}")
    print(f"{'='*60}")
    
    bpm = get_bpm_from_songbpm(artist, song_name)
    
    if bpm:
        print(f"✅ SUCCESS: Found BPM = {bpm}")
        if expected_bpm and bpm == expected_bpm:
            print(f"   Matches expected BPM ({expected_bpm})")
        elif expected_bpm:
            print(f"   ⚠️  Expected BPM = {expected_bpm}, got {bpm}")
    else:
        print(f"❌ FAILED: BPM not found")
    
    return bpm is not None

def main():
    """Run all tests"""
    print("BPM Scraper Test Suite")
    print("=" * 60)
    
    # Clear cache to ensure fresh tests
    clear_cache()
    
    tests = [
        ("The Weeknd", "Blinding Lights", 171),
        ("Drake", "Hotline Bling", 135),
        ("Dua Lipa", "Levitating", 103),
        ("Ed Sheeran", "Shape of You", 96),
        ("Post Malone", "Circles", 120),
    ]
    
    results = []
    for artist, song, expected_bpm in tests:
        success = test_song(artist, song, expected_bpm)
        results.append((artist, song, success))
    
    # Print summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for _, _, success in results if success)
    total = len(results)
    
    for artist, song, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: '{song}' by {artist}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    # Show cache stats
    cache_stats = get_cache_stats()
    print(f"\nCache: {cache_stats['entries']} entries")
    
    # Exit with error if any tests failed
    if passed < total:
        sys.exit(1)

if __name__ == '__main__':
    main()

