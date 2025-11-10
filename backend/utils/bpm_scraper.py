#!/usr/bin/env python3
"""
SongBPM.com Scraper with Hash URL Support
==========================================

A robust web scraper to fetch BPM (beats per minute) information from songbpm.com.
Handles songs with unique hash URLs by using artist page fallback.

Features:
- Direct URL attempt for standard song pages
- Fallback to artist page for hash URLs (e.g., superpowers-CyBjWG7f7w)
- In-memory caching to avoid redundant requests
- Comprehensive error handling and timeouts
- Production-ready logging and validation

Usage:
    bpm = get_bpm_from_songbpm("Daniel Caesar", "Superpowers")
    print(bpm)  # Output: 130 or None

Author: Auto-generated
"""

import re
import requests
from bs4 import BeautifulSoup
import logging
from typing import Optional
import sys
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Simple in-memory cache: {(artist, song_name): bpm}
_bpm_cache = {}


def normalize_for_url(text: str) -> str:
    """
    Normalize text for URL slug format used by songbpm.com.
    
    Transformation rules:
    1. Convert to lowercase
    2. Remove non-alphanumeric characters (except hyphens)
    3. Replace spaces with hyphens
    4. Remove duplicate hyphens
    5. Strip leading/trailing hyphens
    
    Args:
        text (str): The input string to normalize
        
    Returns:
        str: Normalized URL slug
        
    Examples:
        >>> normalize_for_url("Daniel Caesar")
        'daniel-caesar'
        >>> normalize_for_url("2 Soon!")
        '2-soon'
    """
    text = text.strip().lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', ' ', text)
    text = text.replace(' ', '-')
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text


def fetch_page(url: str, timeout: int = 10) -> Optional[str]:
    """
    Fetch HTML content from a URL with realistic headers and timeout.
    
    Args:
        url (str): The URL to fetch
        timeout (int): Request timeout in seconds (default: 10)
        
    Returns:
        Optional[str]: HTML content if successful, None otherwise
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
    }
    
    try:
        logger.info(f"Fetching: {url}")
        response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        
        if response.status_code == 404:
            logger.warning(f"Page not found (404): {url}")
            return None
        
        if response.status_code != 200:
            logger.error(f"HTTP {response.status_code}: {url}")
            return None
        
        logger.info(f"Successfully fetched page (status: {response.status_code})")
        return response.text
        
    except requests.exceptions.Timeout:
        logger.error(f"Request timeout for: {url}")
        return None
    except requests.exceptions.ConnectionError:
        logger.error(f"Connection error for: {url}")
        return None
    except Exception as e:
        logger.error(f"Request failed: {e}")
        return None


def extract_song_info_from_html(html: str) -> dict:
    """
    Parse HTML and extract BPM, key, and genre from songbpm.com page structure.
    
    The page uses <dd> tags for metrics. Attempts to extract:
    - BPM (numeric, 40-240 range)
    - Key (e.g., "F minor", "C major")
    - Genre (e.g., "Pop", "R&B")
    
    Args:
        html (str): HTML content of the page
        
    Returns:
        dict: {'bpm': int|None, 'key': str|None, 'genre': str|None}
    """
    result = {'bpm': None, 'key': None, 'genre': None}
    
    try:
        soup = BeautifulSoup(html, 'lxml')
        
        # Find all dt/dd pairs
        dt_tags = soup.find_all('dt')
        dd_tags = soup.find_all('dd')
        
        if not dd_tags:
            logger.warning("No <dd> tags found on page")
            return result
        
        logger.debug(f"Found {len(dd_tags)} dd elements")
        
        # Try to match dt labels with dd values
        for i, dd_tag in enumerate(dd_tags):
            text = dd_tag.get_text(strip=True)
            
            if not text:
                continue
            
            # Get corresponding dt label if available
            label = ""
            if i < len(dt_tags):
                label = dt_tags[i].get_text(strip=True).lower()
            
            # Extract BPM (numeric, in valid range)
            if text.isdigit() and ':' not in text and result['bpm'] is None:
                bpm = int(text)
                if 40 <= bpm <= 240:
                    result['bpm'] = bpm
                    logger.info(f"Found BPM: {bpm}")
            
            # Extract Key (contains "major" or "minor")
            if ('major' in text.lower() or 'minor' in text.lower()) and result['key'] is None:
                result['key'] = text
                logger.info(f"Found Key: {text}")
            
            # Extract Genre (common genres)
            genres = ['pop', 'rock', 'r&b', 'hip hop', 'electronic', 'dance', 'jazz', 'classical', 'soul', 'indie', 'alternative']
            text_lower = text.lower()
            if any(genre in text_lower for genre in genres) and result['genre'] is None:
                result['genre'] = text
                logger.info(f"Found Genre: {text}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error parsing HTML: {e}")
        return result


def extract_bpm_from_html(html: str) -> Optional[int]:
    """
    Legacy function - extracts only BPM for backward compatibility.
    
    Args:
        html (str): HTML content of the page
        
    Returns:
        Optional[int]: BPM value if found, None otherwise
    """
    info = extract_song_info_from_html(html)
    return info['bpm']


def find_song_url_on_artist_page(artist: str, song_name: str) -> Optional[str]:
    """
    Fallback method: Search the artist's page for the correct song URL.
    
    This handles cases where songs have hash URLs (e.g., superpowers-CyBjWG7f7w).
    
    Workflow:
    1. Fetch artist page: https://songbpm.com/@{artist}
    2. Find all <a> links
    3. Match links containing the song name slug
    4. Return the first matching song URL
    
    Args:
        artist (str): Artist name (already normalized)
        song_name (str): Song name (already normalized)
        
    Returns:
        Optional[str]: Full URL to song page, or None if not found
    """
    artist_slug = normalize_for_url(artist)
    song_slug = normalize_for_url(song_name)
    artist_url = f"https://songbpm.com/@{artist_slug}"
    
    logger.info(f"Fallback: Searching artist page for '{song_name}'")
    
    html = fetch_page(artist_url)
    if not html:
        logger.error(f"Failed to fetch artist page: {artist_url}")
        return None
    
    try:
        soup = BeautifulSoup(html, 'lxml')
        
        # Find all links that start with /@artist/
        artist_song_links = soup.find_all('a', href=re.compile(rf'^/@{re.escape(artist_slug)}/'))
        
        if not artist_song_links:
            logger.warning(f"No song links found on artist page")
            return None
        
        logger.info(f"Found {len(artist_song_links)} song links on artist page")
        
        # Look for a link whose slug contains the song name
        for link in artist_song_links:
            href = link.get('href', '')
            link_text = link.get_text(strip=True).lower()
            
            # Check if song name appears in the URL slug or link text
            if song_slug in href.lower() or song_slug in link_text:
                full_url = f"https://songbpm.com{href}"
                logger.info(f"Found matching song URL: {full_url}")
                return full_url
        
        logger.warning(f"No matching song found for '{song_name}' on artist page")
        return None
        
    except Exception as e:
        logger.error(f"Error parsing artist page: {e}")
        return None


def get_song_info_from_songbpm(artist: str, song_name: str, use_cache: bool = True) -> dict:
    """
    Fetch BPM, key, and genre for a given song from songbpm.com.
    
    This function implements a robust two-step approach:
    
    Step 1: Try direct URL
    - Construct URL: https://songbpm.com/@{artist}/{song}
    - Attempt to fetch and extract song info
    
    Step 2: Fallback to artist page (if Step 1 fails)
    - Fetch artist page: https://songbpm.com/@{artist}
    - Find all song links
    - Match the song name (substring matching)
    - Fetch the correct song page and extract info
    
    Args:
        artist (str): Artist name (e.g., "Daniel Caesar")
        song_name (str): Song title (e.g., "Superpowers")
        use_cache (bool): Whether to use cached results (default: True)
        
    Returns:
        dict: {'bpm': int|None, 'key': str|None, 'genre': str|None}
        
    Examples:
        >>> get_song_info_from_songbpm("Daniel Caesar", "Superpowers")
        {'bpm': 130, 'key': 'F minor', 'genre': 'R&B'}
        
        >>> get_song_info_from_songbpm("The Weeknd", "Blinding Lights")
        {'bpm': 171, 'key': 'F minor', 'genre': 'Pop'}
    """
    # Input validation
    if not artist or not song_name:
        logger.error("Both artist and song_name are required")
        return {'bpm': None, 'key': None, 'genre': None}
    
    artist = artist.strip()
    song_name = song_name.strip()
    
    if not artist or not song_name:
        logger.error("Artist and song_name cannot be empty")
        return {'bpm': None, 'key': None, 'genre': None}
    
    # Check cache
    cache_key = (artist.lower(), song_name.lower())
    if use_cache and cache_key in _bpm_cache:
        cached_info = _bpm_cache[cache_key]
        logger.info(f"Cache hit: Info for '{song_name}' by {artist}")
        return cached_info
    
    logger.info(f"Fetching song info for: '{song_name}' by {artist}")
    
    # Step 1: Try direct URL
    artist_slug = normalize_for_url(artist)
    song_slug = normalize_for_url(song_name)
    direct_url = f"https://songbpm.com/@{artist_slug}/{song_slug}"
    
    logger.info(f"Step 1: Trying direct URL")
    html = fetch_page(direct_url)
    
    if html:
        info = extract_song_info_from_html(html)
        if info['bpm'] is not None:
            logger.info(f"Success: Found song info (direct URL)")
            if use_cache:
                _bpm_cache[cache_key] = info
            return info
        else:
            logger.warning("Direct URL loaded but BPM not found")
    else:
        logger.warning("Direct URL failed (likely 404 or hash URL)")
    
    # Step 2: Fallback to artist page
    logger.info(f"Step 2: Falling back to artist page search")
    song_url = find_song_url_on_artist_page(artist, song_name)
    
    empty_result = {'bpm': None, 'key': None, 'genre': None}
    
    if not song_url:
        logger.error(f"Failed to find song on artist page")
        if use_cache:
            _bpm_cache[cache_key] = empty_result
        return empty_result
    
    # Fetch the correct song URL
    html = fetch_page(song_url)
    if not html:
        logger.error(f"Failed to fetch song page: {song_url}")
        if use_cache:
            _bpm_cache[cache_key] = empty_result
        return empty_result
    
    info = extract_song_info_from_html(html)
    
    if info['bpm'] is not None:
        logger.info(f"Success: Found song info (via artist page)")
    else:
        logger.error(f"Song page loaded but info not found")
    
    # Cache result (even if empty)
    if use_cache:
        _bpm_cache[cache_key] = info
    
    return info


def get_bpm_from_songbpm(artist: str, song_name: str, use_cache: bool = True) -> Optional[int]:
    """
    Legacy function - fetches only BPM for backward compatibility.
    
    Args:
        artist (str): Artist name
        song_name (str): Song title
        use_cache (bool): Whether to use cache
        
    Returns:
        Optional[int]: BPM value if found, None otherwise
    """
    info = get_song_info_from_songbpm(artist, song_name, use_cache)
    return info['bpm'] if info else None


def clear_cache() -> None:
    """Clear the BPM cache."""
    global _bpm_cache
    _bpm_cache.clear()
    logger.info("Cache cleared")


def get_cache_stats() -> dict:
    """
    Get statistics about the current cache.
    
    Returns:
        dict: Cache statistics
    """
    return {
        'size': len(_bpm_cache),
        'entries': len(_bpm_cache)
    }


def main():
    """
    CLI interface for the BPM scraper.
    
    Usage:
        python bpm_scraper.py "Artist Name" "Song Name"
        python bpm_scraper.py --json "Artist Name" "Song Name"
    """
    if len(sys.argv) < 3:
        print("Usage: python bpm_scraper.py [--json] \"Artist Name\" \"Song Name\"", file=sys.stderr)
        sys.exit(1)
    
    # Check for --json flag
    json_output = False
    start_idx = 1
    if sys.argv[1] == '--json':
        json_output = True
        start_idx = 2
    
    if len(sys.argv) < start_idx + 2:
        print("Usage: python bpm_scraper.py [--json] \"Artist Name\" \"Song Name\"", file=sys.stderr)
        sys.exit(1)
    
    artist = sys.argv[start_idx]
    song_name = sys.argv[start_idx + 1]
    
    # Fetch song info (BPM, key, genre)
    info = get_song_info_from_songbpm(artist, song_name)
    
    if json_output:
        # Output as JSON for easy parsing by Node.js
        result = {
            'artist': artist,
            'song': song_name,
            'bpm': info['bpm'],
            'key': info['key'],
            'genre': info['genre'],
            'success': info['bpm'] is not None
        }
        print(json.dumps(result))
    else:
        # Human-readable output
        if info['bpm']:
            print(f"BPM: {info['bpm']}")
            if info['key']:
                print(f"Key: {info['key']}")
            if info['genre']:
                print(f"Genre: {info['genre']}")
        else:
            print("Song info not found", file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()
