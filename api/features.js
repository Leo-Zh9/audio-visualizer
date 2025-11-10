import axios from 'axios'

// Song info cache (shared with song-info endpoint via import)
let songInfoCache = null

/**
 * Vercel Serverless Function Handler
 * Returns BPM and key for a track by calling our song-info endpoint
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
		const { title, artist } = req.query
		const trackId = req.url.match(/\/api\/features\/([^?]+)/)?.[1]
		
		if (!title || !artist) {
			return res.status(400).json({
				error: 'Missing required parameters',
				required: ['title', 'artist']
			})
		}
		
		console.log('[features] Getting info for:', title, 'by', artist)
		
		// Call our song-info endpoint internally
		const baseUrl = process.env.VERCEL_URL 
			? `https://${process.env.VERCEL_URL}`
			: 'http://localhost:3000'
		
		const songInfoUrl = `${baseUrl}/api/song-info?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
		
		const response = await axios.get(songInfoUrl)
		
		if (response.data) {
			return res.status(200).json({
				tempo: response.data.bpm,
				key: response.data.key,
				genre: response.data.genre,
				trackId: trackId,
				source: 'internal-song-info'
			})
		}
		
		return res.status(404).json({
			error: 'Song info not found'
		})
		
	} catch (error) {
		console.error('[features] Handler error:', error.message)
		return res.status(500).json({
			error: 'Internal server error',
			message: error.message
		})
	}
}

