import axios from 'axios'
import * as cheerio from 'cheerio'
import { kv } from '@vercel/kv'

// Hybrid caching: In-memory (hot) + KV (persistent global)
const memoryCache = new Map()
const CACHE_TTL_SECONDS = 60 * 30 // 30 minutes
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000
const MAX_MEMORY_CACHE_SIZE = 50 // Smaller in-memory cache (hot songs only)

/**
 * Normalize text for URL slug format
 */
function normalizeForUrl(text) {
	return text
		.toLowerCase()
		.trim()
		.replace(/\(feat\.?.*?\)/gi, '')
		.replace(/\(ft\.?.*?\)/gi, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}

/**
 * Extract song info from SongBPM.com HTML
 */
function extractSongInfo(html) {
	const $ = cheerio.load(html)
	const result = { bpm: null, key: null, genre: null }
	
	// Find all dd tags
	const ddTags = $('dd')
	
	ddTags.each((i, elem) => {
		const text = $(elem).text().trim()
		
		if (!text) return
		
		// Extract BPM (numeric, 40-240 range)
		if (text.match(/^\d+$/) && !text.includes(':')) {
			const bpm = parseInt(text)
			if (bpm >= 40 && bpm <= 240 && !result.bpm) {
				result.bpm = bpm
			}
		}
		
		// Extract Key (contains "major" or "minor")
		if ((text.toLowerCase().includes('major') || text.toLowerCase().includes('minor')) && !result.key) {
			result.key = text
		}
		
		// Extract Genre
		const genres = ['pop', 'rock', 'r&b', 'hip hop', 'electronic', 'dance', 'jazz', 'classical', 'soul', 'indie', 'alternative']
		const textLower = text.toLowerCase()
		if (!result.genre && genres.some(g => textLower.includes(g))) {
			result.genre = text
		}
	})
	
	return result
}

/**
 * Hybrid cache helpers (Memory + KV)
 */
function getCacheKey(artist, title) {
	return `song:${artist.toLowerCase()}:${title.toLowerCase()}`
}

async function getCache(key) {
	// 🔥 1. Check in-memory cache first (fastest)
	const memEntry = memoryCache.get(key)
	if (memEntry) {
		const isExpired = Date.now() - memEntry.timestamp > CACHE_TTL_MS
		if (!isExpired) {
			console.log('[cache] Memory hit:', key)
			return { ...memEntry.data, cacheLayer: 'memory' }
		}
		memoryCache.delete(key)
	}
	
	// 🌐 2. Check Vercel KV (global persistent)
	try {
		const kvData = await kv.get(key)
		if (kvData) {
			console.log('[cache] KV hit:', key)
			
			// Promote to memory cache for next request
			memoryCache.set(key, {
				data: kvData,
				timestamp: Date.now()
			})
			
			return { ...kvData, cacheLayer: 'kv' }
		}
	} catch (error) {
		console.warn('[cache] KV read error:', error.message)
	}
	
	return null
}

async function setCache(key, data) {
	// 🔥 1. Store in memory cache (hot cache)
	if (memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
		const oldestKey = memoryCache.keys().next().value
		memoryCache.delete(oldestKey)
		console.log('[cache] Evicted from memory:', oldestKey)
	}
	
	memoryCache.set(key, {
		data,
		timestamp: Date.now()
	})
	
	// 🌐 2. Store in Vercel KV (persistent global)
	try {
		await kv.set(key, data, { ex: CACHE_TTL_SECONDS })
		console.log('[cache] Stored in KV:', key)
	} catch (error) {
		console.warn('[cache] KV write error:', error.message)
	}
}

/**
 * Fetch song info from SongBPM.com with hybrid caching
 */
async function fetchSongInfo(artist, title) {
	const cacheKey = getCacheKey(artist, title)
	
	// Check hybrid cache (memory → KV → scrape)
	const cached = await getCache(cacheKey)
	if (cached) {
		return { ...cached, fromCache: true }
	}
	
	console.log('[song-info] Cache miss, scraping:', cacheKey)
	
	try {
		// Try direct URL first
		const artistSlug = normalizeForUrl(artist)
		const titleSlug = normalizeForUrl(title)
		const directUrl = `https://songbpm.com/@${artistSlug}/${titleSlug}`
		
		console.log('[song-info] Fetching:', directUrl)
		
		const response = await axios.get(directUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			timeout: 10000,
			validateStatus: (status) => status < 500
		})
		
		if (response.status === 200) {
			const info = extractSongInfo(response.data)
			
			if (info.bpm) {
				// Cache result in both memory and KV
				await setCache(cacheKey, info)
				console.log('[song-info] Success (direct URL):', info)
				return info
			}
		}
		
		// If direct URL failed, try artist page fallback
		console.log('[song-info] Direct URL failed, trying artist page...')
		const artistUrl = `https://songbpm.com/@${artistSlug}`
		
		const artistResponse = await axios.get(artistUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
			},
			timeout: 10000
		})
		
		if (artistResponse.status === 200) {
			const $ = cheerio.load(artistResponse.data)
			
			// Find song link on artist page
			const links = $('a[href*="/@' + artistSlug + '/"]')
			let songUrl = null
			
			links.each((i, elem) => {
				const href = $(elem).attr('href')
				const linkText = $(elem).text().toLowerCase()
				
				if (href && (href.toLowerCase().includes(titleSlug) || linkText.includes(titleSlug))) {
					songUrl = `https://songbpm.com${href}`
					return false // break
				}
			})
			
			if (songUrl) {
				console.log('[song-info] Found song URL:', songUrl)
				
				const songResponse = await axios.get(songUrl, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
					},
					timeout: 10000
				})
				
				const info = extractSongInfo(songResponse.data)
				
				if (info.bpm) {
					await setCache(cacheKey, info)
					console.log('[song-info] Success (artist page):', info)
					return info
				}
			}
		}
		
	} catch (error) {
		console.error('[song-info] Error:', error.message)
	}
	
	return { bpm: null, key: null, genre: null }
}

/**
 * Vercel Serverless Function Handler
 */
export default async function handler(req, res) {
	// Enable CORS
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
	
	if (req.method === 'OPTIONS') {
		return res.status(200).end()
	}
	
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' })
	}
	
	try {
		const { artist, title } = req.query
		
		console.log('[song-info] Request:', { artist, title })
		
		if (!artist || !title) {
			return res.status(400).json({
				error: 'Missing required parameters',
				required: ['artist', 'title'],
				example: '/api/song-info?artist=The%20Weeknd&title=Blinding%20Lights'
			})
		}
		
		const info = await fetchSongInfo(artist, title)
		
		return res.status(200).json({
			artist,
			title,
			bpm: info.bpm,
			key: info.key,
			genre: info.genre,
			source: 'songbpm-scraper',
			cached: info.fromCache || false,
			cacheLayer: info.cacheLayer || 'fresh',
			cacheStats: {
				memorySize: memoryCache.size,
				maxMemorySize: MAX_MEMORY_CACHE_SIZE,
				ttl: CACHE_TTL_SECONDS / 60 + ' minutes'
			}
		})
		
	} catch (error) {
		console.error('[song-info] Handler error:', error)
		return res.status(500).json({
			error: 'Internal server error',
			message: error.message
		})
	}
}

