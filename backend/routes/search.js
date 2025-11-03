import { Router } from 'express'
import fetch from 'node-fetch'
import { getAccessToken } from '../utils/spotifyAuth.js'

const router = Router()

/**
 * GET /api/search
 *
 * Query parameter:
 * - query: User input text (e.g., "blinding lights the weeknd")
 *
 * Returns parsed song information from user input
 */
router.get('/', async (req, res) => {
	try {
		const query = req.query.query?.trim()

		if (!query) {
			return res.status(400).json({
				error: 'bad_request',
				details: 'Missing query parameter'
			})
		}

		console.log('[search] Parsing query:', query)

		// Simple parsing logic: try to extract artist and song title
		const result = await parseSongQuery(query)

		console.log('[search] Parsed result:', result)

		// Return as an array with one result (to match frontend expectations)
		res.json([result])

	} catch (error) {
		console.error('[search] Error:', error.message)
		res.status(500).json({
			error: 'parse_error',
			details: error.message
		})
	}
})

// Parse user input into artist and title - fully dynamic using iTunes API
async function parseSongQuery(query) {
	// Normalize input: handle missing spaces, extra spaces, etc.
	let cleanQuery = query
		.toLowerCase()
		.replace(/\s+/g, ' ') // Normalize multiple spaces to single space
		.trim()
	
	// Try to add spaces between numbers and letters (handles "2soon" → "2 soon")
	cleanQuery = cleanQuery.replace(/(\d)([a-z])/g, '$1 $2')
	cleanQuery = cleanQuery.replace(/([a-z])(\d)/g, '$1 $2')
	
	console.log('[search] Normalized query:', cleanQuery)

	// Check for explicit separators first
	if (cleanQuery.includes(' - ')) {
		const parts = cleanQuery.split(' - ')
		const title = parts[0].trim()
		const artist = parts[1].trim()
		return {
			title: title,
			artist: artist,
			trackId: `parsed_${Date.now()}`,
			spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + artist)}`,
			source: 'user-input-parsing'
		}
	}

	if (cleanQuery.includes(' by ')) {
		const parts = cleanQuery.split(' by ')
		const title = parts[0].trim()
		const artist = parts[1].trim()
		return {
			title: title,
			artist: artist,
			trackId: `parsed_${Date.now()}`,
			spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + artist)}`,
			source: 'user-input-parsing'
		}
	}

	// No explicit separator - use Spotify API to find the song dynamically
	// This handles ALL cases: typos, different orderings, missing artist, etc.
	console.log('[search] No separator found, searching Spotify API for:', cleanQuery)
	
	try {
		const spotifyResult = await searchSpotifyAPI(cleanQuery)
		if (spotifyResult) {
			console.log(`[search] Spotify API found: "${spotifyResult.title}" by ${spotifyResult.artist}`)
			return spotifyResult
		}
	} catch (error) {
		console.error('[search] Spotify API error:', error.message)
	}
	
	// No match found - return the query as-is and let user refine
	console.warn('[search] Could not find song:', cleanQuery)
	
	return {
		title: cleanQuery,
		artist: 'UNKNOWN',
		trackId: `error_${Date.now()}`,
		spotifyUrl: null,
		source: 'not-found',
		error: `Could not find "${cleanQuery}". Try refining your search.`
	}
}

// Search Spotify API for song title - PRIORITIZES SONG TITLE OVER ARTIST
async function searchSpotifyAPI(query) {
	try {
		const token = await getAccessToken()
		
		// Search with track priority
		const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`
		console.log('[spotify] Searching:', query)
		
		const response = await fetch(url, {
			headers: {
				'Authorization': `Bearer ${token}`
			}
		})
		
		if (!response.ok) {
			throw new Error(`Spotify API returned ${response.status}`)
		}
		
		const data = await response.json()
		
		if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
			const tracks = data.tracks.items
			
			console.log(`[spotify] Found ${tracks.length} results:`)
			tracks.slice(0, 5).forEach((t, i) => {
				console.log(`  ${i+1}. "${t.name}" by ${t.artists[0].name} (popularity: ${t.popularity})`)
			})
			
			// Smart matching: prioritize song title matches AND popularity
			let bestTrack = tracks[0] // Default to first (most popular)
			let bestScore = -1
			const queryWords = query.toLowerCase().split(/\s+/)
			
			for (const track of tracks) {
				let score = 0
				const trackTitle = track.name.toLowerCase()
				const trackArtist = track.artists[0].name.toLowerCase()
				
				// PRIORITIZE TITLE MATCHES (higher scores)
				queryWords.forEach(word => {
					if (word.length >= 2) {
						if (trackTitle.includes(word)) score += 20 // High priority for title
						if (trackArtist.includes(word)) score += 5  // Lower priority for artist
						if (trackTitle.startsWith(word)) score += 10
					}
				})
				
				// Exact title match = huge bonus
				if (trackTitle === query.toLowerCase()) score += 100
				if (trackTitle.includes(query.toLowerCase())) score += 30
				
				// HEAVILY favor popular songs (helps with typos)
				// Popular songs (90-100) get +18-20 points
				// Obscure songs (0-10) get 0-2 points
				score += track.popularity / 5
				
				// Extra bonus for very popular tracks (>= 80 popularity)
				if (track.popularity >= 80) {
					score += 30 // Major boost for hits
				}
				
				// Penalize results with many unmatched words (likely wrong song)
				const trackWords = trackTitle.split(/\s+/)
				const unmatchedWords = trackWords.filter(word => 
					word.length >= 3 && !queryWords.some(qw => qw.includes(word) || word.includes(qw))
				)
				score -= unmatchedWords.length * 8
				
				console.log(`[spotify] "${track.name}" by ${track.artists[0].name} - Score: ${score} (pop: ${track.popularity})`)
				
				if (score > bestScore) {
					bestScore = score
					bestTrack = track
				}
			}
			
			const track = bestTrack
			console.log(`[spotify] ✅ Best match: "${track.name}" by ${track.artists[0].name} (score: ${bestScore}, popularity: ${track.popularity})`)
			
			// If best match is very obscure (popularity < 30) and has low score, it might be wrong
			// Return the most popular track instead
			if (track.popularity < 30 && bestScore < 40) {
				const mostPopular = tracks.reduce((prev, current) => 
					(current.popularity > prev.popularity) ? current : prev
				)
				
				if (mostPopular.popularity >= 60) {
					console.log(`[spotify] ⚠️ Low-score match is obscure, using most popular: "${mostPopular.name}" by ${mostPopular.artists[0].name}`)
					return {
						title: mostPopular.name.toLowerCase(),
						artist: mostPopular.artists[0].name.toLowerCase(),
						trackId: mostPopular.id,
						spotifyUrl: mostPopular.external_urls.spotify,
						source: 'spotify-api',
						spotifyId: mostPopular.id,
						popularity: mostPopular.popularity,
						confidence: 'medium'
					}
				}
			}
			
			return {
				title: track.name.toLowerCase(),
				artist: track.artists[0].name.toLowerCase(),
				trackId: track.id,
				spotifyUrl: track.external_urls.spotify,
				source: 'spotify-api',
				spotifyId: track.id,
				popularity: track.popularity,
				confidence: bestScore > 50 ? 'high' : 'medium'
			}
		}
		
		return null
	} catch (error) {
		console.error('[spotify] Search error:', error.message)
		return null
	}
}

export default router