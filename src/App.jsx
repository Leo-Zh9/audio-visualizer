import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import CloudVisualizerContainer from './components/CloudVisualizerContainer'

// Backend API configuration
const API_BASE = import.meta.env.VITE_API_BASE || ''

/**
 * Helper: Capitalize song/artist names properly
 */
function toTitleCase(str) {
	if (!str) return ''
	
	const lowercaseWords = ['a', 'an', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'feat', 'ft']
	
	return str
		.toLowerCase()
		.split(' ')
		.map((word, index) => {
			if (index === 0) {
				return word.charAt(0).toUpperCase() + word.slice(1)
			}
			if (lowercaseWords.includes(word)) {
				return word
			}
			return word.charAt(0).toUpperCase() + word.slice(1)
		})
		.join(' ')
}

/**
 * Map musical key and genre to color
 * Returns a hex color string based on mood/tonality
 */
function mapKeyGenreToColor(key, genre) {
	// Default purple
	const defaultColor = '#9b83f7'
	
	// Musical key to color mapping (emotional association)
	const keyColorMap = {
		// Major keys - bright, warm colors
		'C Major': '#FFD580',      // Golden yellow
		'G Major': '#80DFFF',      // Sky blue
		'D Major': '#99FFCC',      // Mint green
		'A Major': '#FFB3BA',      // Soft pink
		'E Major': '#FFDFBA',      // Peach
		'B Major': '#BAFFC9',      // Light green
		'F Major': '#BAE1FF',      // Soft blue
		'Bb Major': '#FFB3D9',     // Rose pink
		'Eb Major': '#FFCCBC',     // Coral
		'Ab Major': '#E1BEE7',     // Lavender
		'Db Major': '#B2EBF2',     // Aqua
		'Gb Major': '#DCEDC8',     // Lime
		
		// Minor keys - deep, emotional colors
		'A Minor': '#B380FF',      // Purple
		'E Minor': '#8080FF',      // Blue-purple
		'B Minor': '#5A9FFF',      // Deep blue
		'F# Minor': '#4A7BA7',     // Teal
		'C# Minor': '#6B5B95',     // Deep purple
		'G# Minor': '#7986CB',     // Periwinkle
		'D Minor': '#9575CD',      // Violet
		'G Minor': '#7E57C2',      // Purple-violet
		'C Minor': '#5E35B1',      // Deep violet
		'F Minor': '#673AB7',      // Purple
		'Bb Minor': '#9C27B0',     // Magenta
		'Eb Minor': '#8E24AA',     // Deep magenta
	}
	
	// Genre to color mapping
	const genreColorMap = {
		'Pop': '#FFB3E6',          // Bright pink
		'Rock': '#FF8566',         // Orange-red
		'R&B': '#C77DFF',          // Purple-pink
		'Hip Hop': '#9D4EDD',      // Deep purple
		'Electronic': '#00F5FF',   // Cyan
		'Dance': '#FF006E',        // Hot pink
		'Jazz': '#8D5B4C',         // Warm brown
		'Classical': '#F5F5DC',    // Cream
		'Soul': '#D4AF37',         // Gold
		'Indie': '#90BE6D',        // Sage green
		'Alternative': '#577590',  // Blue-gray
	}
	
	// Try key first (more specific)
	if (key) {
		// Normalize key string
		const normalizedKey = key.trim()
		if (keyColorMap[normalizedKey]) {
			return keyColorMap[normalizedKey]
		}
		
		// Check if it contains 'major' or 'minor'
		const keyLower = normalizedKey.toLowerCase()
		if (keyLower.includes('major')) {
			return '#FFD580' // Default major: golden
		} else if (keyLower.includes('minor')) {
			return '#B380FF' // Default minor: purple
		}
	}
	
	// Fall back to genre
	if (genre) {
		const genreLower = genre.toLowerCase()
		for (const [genreKey, color] of Object.entries(genreColorMap)) {
			if (genreLower.includes(genreKey.toLowerCase())) {
				return color
			}
		}
	}
	
	// Ultimate fallback
	return defaultColor
}


/**
 * BackdropOverlays - Gradient background with subtle grid
 */
function BackdropOverlays() {
	return (
		<>
			{/* Subtle thin-lined grid pattern */}
			<div
				style={{
					pointerEvents: 'none',
					position: 'absolute',
					inset: 0,
					backgroundImage: `
						linear-gradient(to right, rgba(220, 215, 240, 0.12) 1px, transparent 1px),
						linear-gradient(to bottom, rgba(220, 215, 240, 0.12) 1px, transparent 1px)
					`,
					backgroundSize: '60px 60px',
					opacity: 0.6,
				}}
			/>
		</>
	)
}

/**
 * UIOverlay - Search interface and status display
 */
function UIOverlay({ onSubmitQuery, trackTitle, trackArtist, trackUrl, isLoading, bpm, transitionActive }) {
	const [value, setValue] = useState('')
	const [isHovered, setIsHovered] = useState(false)
	
	return (
		<>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
				
				@keyframes dotPulse { 0%, 100% { opacity: .3 } 50% { opacity: .8 } }
				@keyframes spin { to { transform: rotate(360deg); } }
				
				.light-input {
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
				}
				.light-input::placeholder { 
					color: rgba(0, 0, 0, 0.35); 
					font-style: normal;
					font-weight: 400;
					transition: color 0.3s ease;
				}
				.light-input:focus {
					outline: none;
					transform: scale(1.02);
					box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06);
				}
				.light-input:focus::placeholder {
					color: rgba(0, 0, 0, 0.25);
				}
				.search-icon {
					transition: all 0.3s ease;
				}
				.header-link:hover { 
					box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
					transform: translateY(-1px);
				}
				.loading-spinner { 
					animation: spin 0.8s linear infinite; 
				}
				.bpm-badge { 
					font-size: 11px; 
					font-weight: 600;
					margin-left: 10px; 
					padding: 4px 10px; 
					background: rgba(34, 197, 94, 0.1);
					color: rgba(21, 128, 61, 1);
					border-radius: 999px; 
					letter-spacing: 0.3px;
				}
				.bpm-badge-unavailable {
					font-size: 11px;
					font-weight: 600;
					margin-left: 10px;
					padding: 4px 10px;
					background: rgba(0, 0, 0, 0.04);
					color: rgba(0, 0, 0, 0.4);
					border-radius: 999px;
					letter-spacing: 0.3px;
				}
			`}</style>
			
			<div className="absolute inset-0 pointer-events-none" style={{ 
				fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
				zIndex: 100
			}}>
				{/* Top center header with song info - FIXED at top */}
				<div className="fixed top-0 left-0 right-0 flex justify-center pointer-events-auto" style={{ 
					padding: window.innerWidth < 768 ? '16px' : '24px 16px',
					zIndex: 50,
				}}>
					<a
						className="header-link"
						href={trackUrl || '#'}
						target={trackUrl ? '_blank' : undefined}
						rel={trackUrl ? 'noopener noreferrer' : undefined}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: window.innerWidth < 768 ? 8 : 10,
							padding: window.innerWidth < 768 ? '8px 16px' : '10px 20px',
							borderRadius: 999,
							background: 'rgba(255, 255, 255, 0.75)',
							backdropFilter: 'blur(8px) saturate(120%)',
							WebkitBackdropFilter: 'blur(8px) saturate(120%)',
							color: '#202020',
							textDecoration: 'none',
							maxWidth: '90vw',
							whiteSpace: 'nowrap',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							boxShadow: '0 2px 20px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04)',
							transition: 'all 0.2s ease',
						}}
					>
						{isLoading ? (
							<svg className="loading-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none"/>
								<path d="M12 2 A 10 10 0 0 1 22 12" stroke="rgba(0,0,0,0.6)" strokeWidth="2" fill="none" strokeLinecap="round"/>
							</svg>
						) : (
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
								<circle cx="12" cy="12" r="10" fill="#1DB954"/>
								<path d="M7 10c3-1 7-.8 10 1M7 13c2.6-.7 5.6-.6 8 1M7 16c2-.5 4-.4 6 .5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
							</svg>
						)}
						<span style={{ 
							letterSpacing: '-0.01em', 
							display: 'flex', 
							alignItems: 'center', 
							fontSize: window.innerWidth < 768 ? '13px' : '14px', 
							fontWeight: 500 
						}}>
							{isLoading ? 'Searching...' : (trackTitle && trackArtist ? `${toTitleCase(trackTitle)} — ${toTitleCase(trackArtist)}` : 'Search for a song')}
							{trackTitle && trackArtist && window.innerWidth >= 640 && (
								bpm > 0 ? (
								<span className="bpm-badge">♪ {Math.round(bpm)} BPM</span>
								) : (
									<span className="bpm-badge-unavailable">BPM UNAVAILABLE</span>
								)
							)}
						</span>
					</a>
				</div>

				{/* Top-left minimal branding - FIXED at top-left */}
				{window.innerWidth >= 640 && (
					<div className="fixed pointer-events-none" style={{ 
						top: window.innerWidth < 768 ? 20 : 28, 
						left: window.innerWidth < 768 ? 20 : 28, 
						color: 'rgba(0,0,0,0.35)', 
						letterSpacing: '0.05em', 
						fontSize: window.innerWidth < 768 ? 10 : 11, 
						textTransform: 'uppercase', 
						display: 'flex', 
						alignItems: 'center', 
						gap: 8, 
						fontWeight: 600,
						zIndex: 50,
					}}>
						<span style={{ width: 5, height: 5, borderRadius: 9999, background: 'rgba(0,0,0,0.2)', animation: 'dotPulse 2s ease-in-out infinite' }} />
						<span>Audio Visualizer</span>
				</div>
				)}

				{/* Central search bar - FIXED position, never moves */}
				<div 
					className="fixed"
					style={{ 
						top: '50%',
						left: '50%', 
						transform: 'translate(-50%, -50%)',
						width: window.innerWidth < 768 ? 'min(100%, calc(100vw - 32px))' : 'min(560px, 85vw)',
						pointerEvents: 'auto', 
						opacity: transitionActive ? (isHovered ? 1 : 0.4) : 1,
						transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
					}}
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
				>
					<div style={{ 
						position: 'relative',
						transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					}}>
						{/* Music note icon */}
						<svg 
							className="search-icon"
							width="22" 
							height="22" 
							viewBox="0 0 24 24" 
							fill="none" 
							xmlns="http://www.w3.org/2000/svg"
							style={{ 
								position: 'absolute', 
								left: 22, 
								top: '50%', 
								transform: 'translateY(-50%)', 
								opacity: 0.35,
								color: '#1a1a1a',
								pointerEvents: 'none',
								zIndex: 2,
							}}
						>
							<path 
								d="M9 18V5l12-2v13" 
								stroke="currentColor" 
								strokeWidth="2" 
								strokeLinecap="round" 
								strokeLinejoin="round"
							/>
							<circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
							<circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2"/>
						</svg>
						
						{/* Search input */}
						<input
							className="light-input"
							type="text"
							placeholder="Search for a song..."
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && value.trim().length > 0) {
									onSubmitQuery?.(value)
									setValue('')
								}
							}}
							disabled={isLoading}
							style={{
								width: '100%',
								padding: window.innerWidth < 768 ? '16px 24px 16px 48px' : '20px 28px 20px 56px',
								background: 'rgba(255, 255, 255, 0.65)',
								backdropFilter: 'blur(8px) saturate(120%)',
								WebkitBackdropFilter: 'blur(8px) saturate(120%)',
								border: '1px solid rgba(255, 255, 255, 0.9)',
								borderRadius: 999,
								color: '#1a1a1a',
								fontSize: window.innerWidth < 768 ? '15px' : '16px',
								fontWeight: 400,
								letterSpacing: '-0.01em',
								caretColor: '#1a1a1a',
								boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04), inset 0 1px 2px rgba(255, 255, 255, 0.8)',
								opacity: isLoading ? 0.6 : 1,
								cursor: isLoading ? 'not-allowed' : 'text',
							}}
						/>
						
						{/* Loading indicator */}
						{isLoading && (
							<div style={{
								position: 'absolute',
								right: 24,
								top: '50%',
								transform: 'translateY(-50%)',
							}}>
								<svg 
									className="loading-spinner" 
									width="20" 
									height="20" 
									viewBox="0 0 24 24" 
									fill="none" 
									xmlns="http://www.w3.org/2000/svg"
								>
									<circle 
										cx="12" 
										cy="12" 
										r="9" 
										stroke="rgba(0,0,0,0.1)" 
										strokeWidth="2" 
										fill="none"
									/>
									<path 
										d="M12 3 A 9 9 0 0 1 21 12" 
										stroke="rgba(0,0,0,0.4)" 
										strokeWidth="2" 
										fill="none" 
										strokeLinecap="round"
									/>
								</svg>
							</div>
						)}
					</div>
					
					{/* Helper text */}
					{window.innerWidth >= 480 && (
						<div className="subtitle" style={{ 
							textAlign: 'center', 
							marginTop: window.innerWidth < 768 ? '10px' : '14px', 
							color: '#808080', 
							fontSize: window.innerWidth < 768 ? '11px' : '12px',
							fontWeight: 400,
							letterSpacing: '0.02em',
							transition: 'all 0.3s ease',
						}}>
							Try "Levitating by Dua Lipa" or "Hotline Bling"
						</div>
					)}
				</div>

				{/* Bottom instruction - FIXED at bottom-left */}
				{window.innerWidth >= 768 && (
					<div className="fixed pointer-events-none" style={{ 
						bottom: 24, 
						left: 28, 
						color: 'rgba(0,0,0,0.25)', 
						fontSize: 11, 
						letterSpacing: '0.02em', 
						fontWeight: 400,
						zIndex: 50,
					}}>
						Audio-reactive visualization
				</div>
				)}
			</div>
		</>
	)
}

/**
 * Fetch BPM, key, and genre from backend
 */
async function fetchAudioFeatures(trackId, songTitle, artistName) {
	try {
		const url = `${API_BASE}/api/features/${trackId}?title=${encodeURIComponent(songTitle)}&artist=${encodeURIComponent(artistName)}`
		console.log('[frontend] Fetching audio features:', songTitle, '-', artistName)
		
		const resp = await fetch(url)
		
		if (resp.ok) {
			const features = await resp.json()
			console.log('[frontend] Song info received:', features)
			return {
				bpm: features.tempo && features.tempo > 0 ? features.tempo : null,
				key: features.key || null,
				genre: features.genre || null
			}
		} else {
			console.warn('[frontend] Features request failed:', resp.status)
		}
	} catch (e) {
		console.error('[frontend] Error fetching features:', e?.message || e)
	}
	return { bpm: null, key: null, genre: null }
}

/**
 * Main App Component
 */
export default function App() {
	const [trackTitle, setTrackTitle] = useState('')
	const [trackArtist, setTrackArtist] = useState('')
	const [trackId, setTrackId] = useState('')
	const [spotifyUrl, setSpotifyUrl] = useState(null)
	const [isLoading, setIsLoading] = useState(false)
	const [bpm, setBpm] = useState(null)
	const [key, setKey] = useState(null)
	const [genre, setGenre] = useState(null)
	const [transitionActive, setTransitionActive] = useState(false)
	
	const trackUrl = spotifyUrl || null
	const cloudColor = mapKeyGenreToColor(key, genre)

	const handleSubmitQuery = useCallback(async (text) => {
		if (!text.trim()) return

		setIsLoading(true)
		setTransitionActive(true)

		try {
			const url = `${API_BASE}/api/search?query=${encodeURIComponent(text)}`
			console.log('[frontend] Searching:', text)
			const resp = await fetch(url)

			if (resp.ok) {
				const results = await resp.json()
				console.log('[frontend] Results:', results)

				if (Array.isArray(results) && results.length > 0) {
					const track = results[0]
					setTrackTitle(track.title || '')
					setTrackArtist(track.artist || '')
					setTrackId(track.trackId || '')
					setSpotifyUrl(track.spotifyUrl || null)

					// Fetch BPM, key, and genre
					const features = await fetchAudioFeatures(track.trackId, track.title, track.artist)
					setBpm(features.bpm)
					setKey(features.key)
					setGenre(features.genre)
				} else {
					setTrackTitle(text)
					setTrackArtist('No exact match found')
					setTrackId('')
					setBpm(null)
					setKey(null)
					setGenre(null)
				}
			} else {
				const errBody = await resp.text()
				console.error('[frontend] Backend error:', resp.status, errBody)
				setTrackTitle(text)
				setTrackArtist('Lookup error')
				setTrackId('')
				setBpm(null)
			}
		} catch (e) {
			console.error('[frontend] Network error:', e?.message || e)
			setTrackTitle(text)
			setTrackArtist('Offline or backend unavailable')
			setTrackId('')
			setBpm(null)
		} finally {
			setIsLoading(false)
		}
	}, [])
	
	// Transition animation
	useEffect(() => {
		if (!transitionActive) return
		
		const duration = 2000
		const startTime = performance.now()
		
		const animate = () => {
			const elapsed = performance.now() - startTime
			const progress = Math.min(elapsed / duration, 1)

			if (progress >= 1) {
				setTransitionActive(false)
				return
			}

				requestAnimationFrame(animate)
		}
		
		requestAnimationFrame(animate)
	}, [transitionActive])

	return (
		<div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
			<BackdropOverlays />
			
			{/* Cloud visualization - background layer */}
			<div 
				className="absolute inset-0 z-0"
				style={{ 
					pointerEvents: 'none',
				}}
			>
					<CloudVisualizerContainer 
						isActive={!!trackTitle && !!trackArtist} 
						bpm={bpm}
						color={cloudColor}
					/>
			</div>
			
			{/* Main UI - animated entrance with stable positioning */}
			<motion.main 
				className="z-10 relative flex flex-col items-center justify-center w-full h-full"
				initial={{ opacity: 0, y: 40 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 1.2, ease: "easeOut" }}
			>
				<UIOverlay 
					onSubmitQuery={handleSubmitQuery} 
					trackTitle={trackTitle} 
					trackArtist={trackArtist} 
					trackUrl={trackUrl} 
					isLoading={isLoading} 
					bpm={bpm} 
					transitionActive={transitionActive} 
				/>
			</motion.main>
		</div>
	)
}
