import axios from 'axios'

// Spotify token cache
let cachedToken = null
let tokenExpiresAt = 0

/**
 * Get Spotify access token
 */
async function getSpotifyToken() {
	const now = Date.now()
	if (cachedToken && now < tokenExpiresAt) {
		return cachedToken
	}
	
	const clientId = process.env.SPOTIFY_CLIENT_ID
	const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
	
	if (!clientId || !clientSecret) {
		throw new Error('Spotify credentials not configured')
	}
	
	try {
		const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
		const response = await axios.post(
			'https://accounts.spotify.com/api/token',
			'grant_type=client_credentials',
			{
				headers: {
					'Authorization': `Basic ${basic}`,
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			}
		)
		
		cachedToken = response.data.access_token
		const expiresInMs = (response.data.expires_in || 3600) * 1000
		tokenExpiresAt = Date.now() + expiresInMs - 60000
		
		console.log('[spotify] Token acquired')
		return cachedToken
	} catch (error) {
		console.error('[spotify] Token error:', error.message)
		throw error
	}
}

/**
 * Search Spotify for a track
 */
async function searchSpotify(query) {
	try {
		const token = await getSpotifyToken()
		
		const response = await axios.get(
			`https://api.spotify.com/v1/search`,
			{
				params: {
					q: query,
					type: 'track',
					limit: 10
				},
				headers: {
					'Authorization': `Bearer ${token}`
				}
			}
		)
		
		if (response.data.tracks && response.data.tracks.items.length > 0) {
			const tracks = response.data.tracks.items
			const track = tracks[0] // Best match
			
			return {
				title: track.name,
				artist: track.artists[0].name,
				trackId: track.id,
				spotifyUrl: track.external_urls.spotify,
				popularity: track.popularity,
				source: 'spotify-api'
			}
		}
		
		return null
	} catch (error) {
		console.error('[spotify] Search error:', error.message)
		return null
	}
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
		const { query } = req.query
		
		if (!query) {
			return res.status(400).json({
				error: 'Missing query parameter',
				example: '/api/search?query=Blinding%20Lights'
			})
		}
		
		console.log('[search] Query:', query)
		
		const result = await searchSpotify(query)
		
		if (!result) {
			return res.status(200).json([{
				title: query,
				artist: 'Not found',
				trackId: '',
				spotifyUrl: null,
				source: 'not-found'
			}])
		}
		
		// Return as array for frontend compatibility
		return res.status(200).json([result])
		
	} catch (error) {
		console.error('[search] Handler error:', error)
		return res.status(500).json({
			error: 'Internal server error',
			message: error.message
		})
	}
}

