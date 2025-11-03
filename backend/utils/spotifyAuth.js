import fetch from 'node-fetch'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const clientId = (process.env.SPOTIFY_CLIENT_ID || '').trim()
const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET || '').trim()

console.log(
	'[spotifyAuth] Spotify credentials:',
	clientId ? `${clientId.slice(0, 6)}...` : '(missing)',
	clientSecret ? '***present***' : '(missing)'
)

if (!clientId || !clientSecret) {
	console.warn('[spotifyAuth] Warning: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET missing in .env')
	console.warn('[spotifyAuth] Spotify search will not work. Add credentials to backend/.env:')
	console.warn('[spotifyAuth] SPOTIFY_CLIENT_ID=your_client_id')
	console.warn('[spotifyAuth] SPOTIFY_CLIENT_SECRET=your_client_secret')
}

let cachedToken = null
let tokenExpiresAt = 0

export async function getAccessToken(force = false) {
	const now = Date.now()
	if (!force && cachedToken && now < tokenExpiresAt) {
		return cachedToken
	}

	if (!clientId || !clientSecret) {
		throw new Error('Spotify credentials not configured')
	}

	try {
		console.log('[spotifyAuth] Requesting new token...')
		const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
		const res = await fetch('https://accounts.spotify.com/api/token', {
			method: 'POST',
			headers: {
				'Authorization': `Basic ${basic}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({ grant_type: 'client_credentials' })
		})

		if (!res.ok) {
			const text = await res.text()
			console.error('[spotifyAuth] Token fetch failed:', res.status, text)
			throw new Error('Failed to fetch Spotify token')
		}

		const data = await res.json()
		cachedToken = data.access_token
		const expiresInMs = Number(data.expires_in ?? 3600) * 1000
		tokenExpiresAt = Date.now() + expiresInMs - 60000 // Refresh 1 min early
		console.log('[spotifyAuth] Token acquired, expires in', Math.round(expiresInMs / 1000), 's')
		return cachedToken
	} catch (err) {
		console.error('[spotifyAuth] Token request error:', err?.message || err)
		throw err
	}
}

