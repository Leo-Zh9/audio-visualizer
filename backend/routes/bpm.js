import { Router } from 'express'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = Router()

/**
 * Execute Python BPM scraper script
 * 
 * This function spawns a Python process to run the robust BPM scraper.
 * The Python script handles:
 * - URL normalization and construction
 * - Web scraping with proper headers
 * - HTML parsing to extract BPM
 * - Caching to avoid redundant requests
 * - Comprehensive error handling
 * 
 * @param {string} artist - Artist name
 * @param {string} songTitle - Song title
 * @returns {Promise<Object>} - Object with {bpm: number|null, key: string|null}
 */
async function getBPMFromPython(artist, songTitle) {
	return new Promise((resolve, reject) => {
		const pythonScriptPath = join(__dirname, '..', 'utils', 'bpm_scraper.py')
		
		console.log('[bpm-python] Calling Python scraper:', {
			artist,
			song: songTitle,
			scriptPath: pythonScriptPath
		})
		
		// Spawn Python process with --json flag for structured output
		const pythonProcess = spawn('python', [pythonScriptPath, '--json', artist, songTitle])
		
		let stdout = ''
		let stderr = ''
		
		pythonProcess.stdout.on('data', (data) => {
			stdout += data.toString()
		})
		
		pythonProcess.stderr.on('data', (data) => {
			stderr += data.toString()
		})
		
		pythonProcess.on('close', (code) => {
			if (code !== 0) {
				console.error('[bpm-python] Python script failed:', stderr)
				reject(new Error(`Python script exited with code ${code}: ${stderr}`))
				return
			}
			
			try {
				// Python logging goes to stderr, JSON result goes to stdout
				// Find the JSON line (starts with { and ends with })
				const lines = stdout.split('\n')
				const jsonLine = lines.find(line => line.trim().startsWith('{') && line.trim().endsWith('}'))
				
				if (!jsonLine) {
					console.error('[bpm-python] No JSON found in output:', stdout)
					reject(new Error('No JSON output from Python script'))
					return
				}
				
				// Parse JSON output from Python script
				const result = JSON.parse(jsonLine.trim())
				
				console.log('[bpm-python] Python result:', result)
				
				if (!result.success || result.bpm === null) {
					reject(new Error('BPM not found on SongBPM.com'))
					return
				}
				
				// Return in the format expected by the route handler
				resolve({
					bpm: result.bpm,
					key: result.key || null,
					genre: result.genre || null
				})
				
			} catch (error) {
				console.error('[bpm-python] Failed to parse Python output:', stdout)
				reject(new Error('Failed to parse Python script output'))
			}
		})
		
		pythonProcess.on('error', (error) => {
			console.error('[bpm-python] Failed to spawn Python process:', error.message)
			reject(new Error('Failed to execute Python script. Is Python installed?'))
		})
	})
}

/**
 * Main BPM detection function using Python scraper
 * 
 * @param {string} songTitle - Song title
 * @param {string} artistName - Artist name
 * @returns {Promise<Object>} - Object with {bpm: number, key: string|null}
 */
async function getBPM(songTitle, artistName) {
	try {
		console.log('[bpm] Getting BPM for:', songTitle, 'by', artistName)

		const result = await getBPMFromPython(artistName, songTitle)

		console.log('[bpm] Successfully got BPM:', result.bpm)
		return result

	} catch (error) {
		console.error('[bpm] BPM detection failed:', error.message)
		throw new Error(`Failed to get BPM: ${error.message}`)
	}
}

/**
 * GET /api/bpm
 *
 * Query parameters:
 * - song: Song title (required)
 * - artist: Artist name (required)
 *
 * Returns BPM using robust Python scraper from SongBPM.com
 */
router.get('/', async (req, res) => {
	try {
		const song = req.query.song?.trim()
		const artist = req.query.artist?.trim()

		console.log('[bpm] GET /api/bpm - Song:', song, 'Artist:', artist || 'Unknown')

		if (!song) {
			return res.status(400).json({
				error: 'bad_request',
				details: 'Missing required parameter: song',
				example: '/api/bpm?song=Blinding%20Lights&artist=The%20Weeknd'
			})
		}

		if (!artist) {
			return res.status(400).json({
				error: 'bad_request',
				details: 'Missing required parameter: artist',
				example: '/api/bpm?song=Blinding%20Lights&artist=The%20Weeknd'
			})
		}

		// Get BPM using Python scraper
		const result = await getBPM(song, artist)

		// Return song info response (BPM, key, genre)
		res.json({
			song: song,
			artist: artist,
			bpm: result.bpm,
			key: result.key || null,
			genre: result.genre || null,
			queried_at: new Date().toISOString(),
			source: 'songbpm-python-scraper'
		})

	} catch (error) {
		console.error('[bpm] Error:', error.message)

		res.status(500).json({
			error: 'detection_failed',
			details: error.message,
			song: req.query.song,
			artist: req.query.artist,
			message: 'Could not scrape BPM from SongBPM.com'
		})
	}
})

export default router
