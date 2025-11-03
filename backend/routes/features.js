import { Router } from 'express'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

const router = Router()

// Default features structure
function getDefaultFeatures() {
	return {
		tempo: 'BPM unavailable', // Will be replaced by scraping result
		time_signature: 4,
		energy: 0.7,
		valence: 0.6,
		danceability: 0.7,
		key: 0,
		mode: 1,
	}
}

// Helper function to create SongBPM URL slug
function createSlug(text) {
	// Clean up the text first (remove featured artists, parentheses, etc.)
	let cleaned = text
		.toLowerCase()
		.replace(/\(feat\.?.*?\)/gi, '') // Remove (feat. Artist)
		.replace(/\(ft\.?.*?\)/gi, '') // Remove (ft. Artist)
		.replace(/feat\.?.*$/gi, '') // Remove feat. at end
		.replace(/ft\.?.*$/gi, '') // Remove ft. at end
		.replace(/[^a-z0-9\s]/g, '') // Remove special characters
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/-+/g, '-') // Remove multiple hyphens
		.replace(/^-|-$/g, '') // Remove leading/trailing hyphens
		.trim()
	
	return cleaned
}

// Search SongBPM.com to find the actual URL (handles hash URLs)
async function findSongBPMUrl(songTitle, artistName) {
	try {
		// Try direct URL first (works for most songs)
		const artistSlug = createSlug(artistName)
		const songSlug = createSlug(songTitle)
		const directUrl = `https://songbpm.com/@${artistSlug}/${songSlug}`
		
		console.log('[songbpm] Trying direct URL:', directUrl)
		
		const directResponse = await fetch(directUrl, {
			method: 'HEAD', // Just check if it exists
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
			},
			redirect: 'follow'
		})
		
		if (directResponse.ok) {
			console.log('[songbpm] Direct URL works!')
			return directUrl
		}
		
		// Direct URL failed - search SongBPM.com to find the correct URL
		console.log('[songbpm] Direct URL failed, searching SongBPM.com...')
		const searchUrl = `https://songbpm.com/searches?query=${encodeURIComponent(songTitle + ' ' + artistName)}`
		console.log('[songbpm] Search URL:', searchUrl)
		
		const searchResponse = await fetch(searchUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
			},
			redirect: 'follow'
		})
		
		if (!searchResponse.ok) {
			throw new Error('Search failed on SongBPM.com')
		}
		
		const searchHtml = await searchResponse.text()
		const $search = cheerio.load(searchHtml)
		
		// Look for links to song pages (format: /@artist/song or /@artist/song-hash)
		// Also check the actual final redirected URL
		let foundUrl = null
		
		// Check if search redirected us directly to a song page
		if (searchResponse.url && searchResponse.url.includes('/@')) {
			foundUrl = searchResponse.url
			console.log('[songbpm] Search redirected to song page:', foundUrl)
		}
		
		// If not redirected, parse search results
		if (!foundUrl) {
			$search('a[href^="/@"]').each((i, elem) => {
				const href = $search(elem).attr('href')
				if (href && !foundUrl) {
					// Get the full URL
					const fullUrl = `https://songbpm.com${href}`
					
					// Check if this link matches our search (look in surrounding text too)
					const linkText = $search(elem).text().toLowerCase()
					const parentText = $search(elem).parent().text().toLowerCase()
					
					const matchesSong = linkText.includes(songTitle.toLowerCase()) || parentText.includes(songTitle.toLowerCase())
					const matchesArtist = linkText.includes(artistName.toLowerCase()) || parentText.includes(artistName.toLowerCase())
					
					if (matchesSong && matchesArtist) {
						foundUrl = fullUrl
						console.log('[songbpm] Found exact match via search:', foundUrl)
						return false // break
					} else if (matchesSong || matchesArtist) {
						// Partial match - store as backup but keep looking
						if (!foundUrl) {
							foundUrl = fullUrl
							console.log('[songbpm] Found partial match (will use if no better match):', fullUrl)
						}
					}
				}
			})
		}
		
		if (foundUrl) {
			return foundUrl
		}
		
		// If still not found, return direct URL and let it fail later
		return directUrl
		
	} catch (error) {
		console.error('[songbpm] URL lookup error:', error.message)
		// Return direct URL as fallback
		const artistSlug = createSlug(artistName)
		const songSlug = createSlug(songTitle)
		return `https://songbpm.com/@${artistSlug}/${songSlug}`
	}
}

// Scrape SongBPM.com for BPM and key
async function scrapeSongBPM(songTitle, artistName) {
	try {
		console.log('[songbpm] Scraping SongBPM for:', songTitle, 'by', artistName)

		// Find the correct URL (handles hash URLs)
		const url = await findSongBPMUrl(songTitle, artistName)
		console.log('[songbpm] Using URL:', url)

		// Fetch the page
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
			}
		})

		if (!response.ok) {
			if (response.status === 404) {
				throw new Error('Song not found on SongBPM.com')
			}
			throw new Error(`HTTP ${response.status}: ${response.statusText}`)
		}

		const html = await response.text()
		const $ = cheerio.load(html)

		let bpm = null
		let key = null

		// Scrape BPM from <dd class="text-card-foreground mt-1 text-3xl font-semibold"> element
		// This is where SongBPM.com displays the tempo in the Song Metrics section
		$('dd.text-card-foreground').each((i, elem) => {
			const text = $(elem).text().trim()
			const numberMatch = text.match(/^\s*(\d{1,3})\s*$/)
			
			if (numberMatch) {
				const value = parseInt(numberMatch[1], 10)
				
				// Check the label in the previous dt element
				const prevDt = $(elem).prev('dt')
				const labelText = prevDt.text().trim().toLowerCase()
				
				// If this is the Tempo/BPM field
				if (labelText.includes('tempo') || labelText.includes('bpm')) {
					if (value >= 40 && value <= 240) {
						bpm = value
						console.log('[songbpm] Found BPM:', bpm)
						return false // break
					}
				}
				
				// If this is the Key field
				if (labelText.includes('key') && value < 40) {
					// This might be a numeric key value, skip it
					return true // continue
				}
			}
			
			// Check for key (musical keys are letters like "C", "F#", etc.)
			const keyMatch = text.match(/^\s*([A-G][#b♯♭]?)\s*$/i)
			if (keyMatch) {
				const prevDt = $(elem).prev('dt')
				const labelText = prevDt.text().trim().toLowerCase()
				if (labelText.includes('key')) {
					key = keyMatch[1].toUpperCase()
					console.log('[songbpm] Found key:', key)
				}
			}
		})

		// Validate BPM range
		if (bpm && (bpm < 40 || bpm > 240)) {
			console.warn('[songbpm] Invalid BPM detected:', bpm)
			bpm = null
		}

		console.log('[songbpm] Extracted - BPM:', bpm, 'Key:', key)

		if (!bpm) {
			throw new Error('Could not find BPM on the page')
		}

		return { bpm, key }

	} catch (error) {
		console.error('[songbpm] Scraping error:', error.message)
		throw error
	}
}

// YOUR SINGLE BPM METHOD: SongBPM.com scraping
async function getBPM(songTitle, artistName) {
	try {
		console.log('[features] Getting BPM for:', songTitle, 'by', artistName)

		const result = await scrapeSongBPM(songTitle, artistName)

		console.log('[features] Successfully got BPM:', result.bpm, 'Key:', result.key)
		return result

	} catch (error) {
		console.error('[features] BPM detection failed:', error.message)
		// Return "unavailable" instead of throwing error
		return {
			bpm: 'BPM unavailable',
			key: null
		}
	}
}

router.get('/:id', async (req, res) => {
	const id = (req.params.id || '').trim()
	console.log(`[features] GET /api/features/${id}`)

	try {
		if (!id) {
			console.warn('[features] Empty track ID provided')
			return res.status(400).json({ error: 'bad_request', details: 'Missing track id' })
		}

		const songTitle = req.query.title || 'Unknown'
		const artistName = req.query.artist || 'Unknown'

		console.log('[features] Song info - Title:', songTitle, 'Artist:', artistName)

		// Get BPM and key using SongBPM scraping
		const result = await getBPM(songTitle, artistName)

		// Return features with detected BPM and key
		const features = getDefaultFeatures()
		features.tempo = result.bpm

		// Add key information to response
		features.key_info = result.key || 'Unknown'

		console.log('[features] Returning features - BPM:', result.bpm, 'Key:', result.key)
		res.json(features)

	} catch (e) {
		console.error('[features] error', e)
		res.status(500).json({ error: 'server_error', details: e?.message || String(e) })
	}
})

export default router