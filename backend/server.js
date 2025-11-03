import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import searchRouter from './routes/search.js'
import featuresRouter from './routes/features.js'
import bpmRouter from './routes/bpm.js'

// Testing helpers:
// PowerShell example to call Spotify API directly (replace <TOKEN> and <id>):
//   $h = @{ Authorization = "Bearer <TOKEN>" }
//   Invoke-RestMethod -Uri "https://api.spotify.com/v1/audio-features/<id>" -Headers $h
// curl example:
//   curl -H "Authorization: Bearer <TOKEN>" https://api.spotify.com/v1/audio-features/<id>

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Simple request log (path + query)
app.use((req, _res, next) => {
	console.log(`[server] ${req.method} ${req.path}`, Object.keys(req.query).length ? req.query : '')
	next()
})

app.get('/health', (_req, res) => res.json({ ok: true }))

// Dev-only debug endpoint for token status
if (process.env.NODE_ENV !== 'production') {
	app.get('/api/debug/token', (_req, res) => {
		res.json({ message: 'Token debug not available (Spotify auth removed)' })
	})
}

app.use('/api/search', searchRouter)
app.use('/api/features', featuresRouter)
app.use('/api/bpm', bpmRouter)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
	console.log(`Backend listening on http://localhost:${PORT}`)
})