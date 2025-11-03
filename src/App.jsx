// Required: react, react-dom, three, @react-three/fiber, @react-three/drei, @react-three/postprocessing
// Tune constants:
// (A) Morph duration: MORPH_DURATION_MS
// (B) Bloom intensity: BLOOM_INTENSITY (threshold/smoothing as well)
// (C) Star density & radius & rotation: STAR_COUNT, STARFIELD_RADIUS, STAR_ROTATION_SPEED
// (D) Meteor pool & frequency: METEOR_POOL_SIZE, METEOR_SPAWN_INTERVAL_MIN, METEOR_SPAWN_INTERVAL_MAX
// (E) BPM pulse: BPM_PULSE_SCALE (how much to scale on beat), BPM_ATTACK_TIME (beat attack phase)

import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import { OrbitControls } from '@react-three/drei'

// Backend API: Use relative URL so Vite proxy can forward to http://localhost:5000
// In production, set VITE_API_BASE environment variable to your backend domain
const API_BASE = import.meta.env.VITE_API_BASE || ''

// Helper function to capitalize song/artist names properly
function toTitleCase(str) {
	if (!str) return ''
	
	// List of words that should stay lowercase (unless at start of string)
	const lowercaseWords = ['a', 'an', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'feat', 'ft']
	
	return str
		.toLowerCase()
		.split(' ')
		.map((word, index) => {
			// Always capitalize first word
			if (index === 0) {
				return word.charAt(0).toUpperCase() + word.slice(1)
			}
			
			// Keep small words lowercase unless they're important
			if (lowercaseWords.includes(word)) {
				return word
			}
			
			// Capitalize all other words
			return word.charAt(0).toUpperCase() + word.slice(1)
		})
		.join(' ')
}

// ===================== Aesthetic + Motion Constants =====================
const ICO_RADIUS = 2
const ICO_DETAIL = 2 // sphere density (low keeps it elegant/minimal)

// (A) Morph duration (ms) with easing
const MORPH_DURATION_MS = 900

// Sculpture motion
const ROTATION_SPEED = 0.24 // slow, graceful global rotation
const TILT_FACTOR = 0.18 // subtle static tilt
const MOUSE_PARALLAX = 0.10 // gentle mouse tilt

// (B) Bloom tuning for soft diffused glow
const BLOOM_INTENSITY = 0.5
const BLOOM_THRESHOLD = 0.25
const BLOOM_SMOOTHING = 0.9

// (C) Stars configuration
const STAR_COUNT = 1600
const STARFIELD_RADIUS = 48 // radius of star shell around its own center
const STARFIELD_Z = 60 // keep full starfield behind sculpture (group positioned at -STARFIELD_Z)
const STAR_ROTATION_SPEED = 0.08 // base angular speed (radians/sec) counter-clockwise
const STAR_PARALLAX_FACTOR = 0.35 // near stars rotate a bit faster than far stars
const STAR_SIZE_MIN = 0.55 // min point size multiplier for stars (smaller)
const STAR_SIZE_MAX = 1.25 // max point size multiplier for stars (smaller)

// (D) Meteors configuration
const METEOR_POOL_SIZE = 6
const METEOR_SPAWN_INTERVAL_MIN = 10 // seconds
const METEOR_SPAWN_INTERVAL_MAX = 30 // seconds
const METEOR_TRAIL_POINTS = 24
const METEOR_HEAD_SIZE = 0.095
const METEOR_TRAIL_SIZE = 0.032
const COLOR_SHOOTING_BLUE = '#9ad4ff'
const COLOR_METEOR_PURPLE = '#cda5ff'

// (E) BPM pulse configuration
const BPM_PULSE_SCALE = 0.25 // How much to scale (1.0 + 0.25 = 1.25x at peak)
const BPM_ATTACK_TIME = 0.3 // Attack phase as fraction of beat (0.3 = 30% of beat time)
const BPM_DECAY_TIME = 0.7 // Decay phase as fraction of beat

// Derive colors from input text for wireframe and glow
function hslToHex(h, s, l) {
	// h [0,360], s/l [0,100]
	s /= 100; l /= 100
	const c = (1 - Math.abs(2 * l - 1)) * s
	const x = c * (1 - Math.abs((h / 60) % 2 - 1))
	const m = l - c / 2
	let r = 0, g = 0, b = 0
	if (0 <= h && h < 60) { r = c; g = x; b = 0 }
	else if (60 <= h && h < 120) { r = x; g = c; b = 0 }
	else if (120 <= h && h < 180) { r = 0; g = c; b = x }
	else if (180 <= h && h < 240) { r = 0; g = x; b = c }
	else if (240 <= h && h < 300) { r = x; g = 0; b = c }
	else { r = c; g = 0; b = x }
	const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
function colorFromText(text, salt = 0) {
	let hash = 0
	for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
	// Inject salt so repeated identical inputs still cycle colors
	hash = (hash + (salt * 2654435761)) >>> 0 // mix with Knuth multiplicative constant
	// Full rainbow coverage
	const hue = hash % 360
	// Occasionally force pure white palette
	if ((hash % 12) === 0) {
		return { main: '#ffffff', glow: '#f5fbff' }
	}
	// Vary saturation/lightness for more variety
	const sChoices = [55, 65, 75, 85]
	const lChoices = [68, 74, 80, 86]
	const s = sChoices[(hash >> 3) % sChoices.length]
	const l = lChoices[(hash >> 5) % lChoices.length]
	// Choose glow hue strategy: analogous / triadic / split-complement
	const scheme = (hash >> 7) % 3
	let glowHue = hue
	switch (scheme) {
		case 0: glowHue = (hue + 12) % 360; break // analogous
		case 1: glowHue = (hue + 120) % 360; break // triadic
		default: glowHue = (hue + 200) % 360; break // split-like
	}
	const main = hslToHex(hue, s, l)
	const glow = hslToHex(glowHue, Math.min(95, s + 10), Math.min(95, l + 10))
	return { main, glow }
}

// ===================== Easing Helper (A) =====================
function easeInOutCubic(t) {
	if (t < 0.5) return 4 * t * t * t
	const f = (2 * t) - 2
	return 0.5 * f * f * f + 1
}

// ===================== Morph Target Builder =====================
// Compute sphere/cube/tetra target positions from a single base (Icosahedron) vertex set
// This preserves vertex count and indexing for stable interpolation.
function createMorphTargets(baseGeom, radius) {
	const basePos = baseGeom.getAttribute('position')
	const count = basePos.count

	const readVec = (i) => new THREE.Vector3(basePos.getX(i), basePos.getY(i), basePos.getZ(i))
	const writeVec = (arr, i, v) => {
		const idx = i * 3
		arr[idx + 0] = v.x
		arr[idx + 1] = v.y
		arr[idx + 2] = v.z
	}

	const spherePositions = new Float32Array(count * 3)
	const cubePositions = new Float32Array(count * 3)
	const tetraPositions = new Float32Array(count * 3)

	const sphereRadius = radius
	// Perfect cube scale: circumsphere radius = sphereRadius => half edge = sphereRadius / sqrt(3)
	const cubeHalf = sphereRadius / Math.sqrt(3)

	// Perfect equilateral tetrahedron, centered and inscribed in the same sphere
	const tetVs = [
		new THREE.Vector3(1, 1, 1),
		new THREE.Vector3(-1, -1, 1),
		new THREE.Vector3(-1, 1, -1),
		new THREE.Vector3(1, -1, -1),
	]
	const tetScale = sphereRadius / Math.sqrt(3)
	for (let v of tetVs) v.multiplyScalar(tetScale)

	// Tetra faces CCW (outward)
	const tetFaces = [
		[0, 2, 1],
		[0, 1, 3],
		[0, 3, 2],
		[1, 2, 3],
	]
	const tetPlanes = tetFaces.map(([a, b, c]) => {
		const va = tetVs[a], vb = tetVs[b], vc = tetVs[c]
		const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va)).normalize()
		// flip inward normals
		if (n.dot(va.clone().add(vb).add(vc).multiplyScalar(1 / 3)) < 0) n.multiplyScalar(-1)
		const d = -n.dot(va)
		return { n, d }
	})

	for (let i = 0; i < count; i++) {
		const dir = readVec(i).normalize()

		// Sphere: radial projection
		const sp = dir.clone().multiplyScalar(sphereRadius)
		writeVec(spherePositions, i, sp)

		// Cube: scale direction so max axis magnitude equals cubeHalf
		const maxAbs = Math.max(Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)) || 1e-6
		const cp = dir.clone().multiplyScalar(cubeHalf / maxAbs)
		writeVec(cubePositions, i, cp)

		// Tetra: intersect ray with tetra faces
		let tMin = Infinity
		let hit = null
		for (const { n, d } of tetPlanes) {
			const denom = n.dot(dir)
			if (Math.abs(denom) < 1e-6) continue
			const t = -d / denom
			if (t > 0 && t < tMin) {
				tMin = t
				hit = dir.clone().multiplyScalar(t)
			}
		}
		writeVec(tetraPositions, i, hit ?? sp)
	}

	return { spherePositions, cubePositions, tetraPositions }
}

// ===================== Starfield (single Points, shader-rotated layers, no lateral drift) =====================
// - Single BufferGeometry created once (STAR_COUNT points)
// - GPU rotates stars counter-clockwise around Y, with slight speed variance by radius (depth parallax)
// - Group is positioned at z = -STARFIELD_Z so stars remain behind sculpture at origin
function Starfield({ transitionActive = false, transitionProgress = 0, fadeProgress = 0 }) {
	const groupRef = useRef()

	// Build star positions/colors/radii/sizes once
	const starData = useMemo(() => {
		const positions = new Float32Array(STAR_COUNT * 3)
		const colors = new Float32Array(STAR_COUNT * 3)
		const radii = new Float32Array(STAR_COUNT)
		const sizes = new Float32Array(STAR_COUNT)

		for (let i = 0; i < STAR_COUNT; i++) {
			const i3 = i * 3
			// Random point on a spherical shell with jittered radius (kept around STARFIELD_RADIUS)
			const theta = Math.random() * Math.PI * 2
			const phi = Math.acos(THREE.MathUtils.lerp(-1, 1, Math.random()))
			const r = STARFIELD_RADIUS * (0.75 + Math.random() * 0.5) // [0.75, 1.25] * R

			const x = r * Math.sin(phi) * Math.cos(theta)
			const y = r * Math.cos(phi)
			const z = r * Math.sin(phi) * Math.sin(theta)

			positions[i3 + 0] = x
			positions[i3 + 1] = y
			positions[i3 + 2] = z

			// Slight brightness variation
			const b = 0.7 + Math.random() * 0.3
			colors[i3 + 0] = b
			colors[i3 + 1] = b
			colors[i3 + 2] = b

			radii[i] = r
			sizes[i] = THREE.MathUtils.lerp(STAR_SIZE_MIN, STAR_SIZE_MAX, Math.random()) // random size
		}

		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)) // for bounds
		geometry.setAttribute('position0', new THREE.BufferAttribute(positions, 3)) // original positions (read in shader)
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
		geometry.setAttribute('radius', new THREE.BufferAttribute(radii, 1))
		geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
		return { geometry }
	}, [])

	// Custom shader material to rotate points around Y with radius-based parallax speed
	const material = useMemo(() => {
		const uniforms = {
			uTime: { value: 0 },
			uBaseSpeed: { value: STAR_ROTATION_SPEED }, // radians/sec
			uParallax: { value: STAR_PARALLAX_FACTOR },
			uMaxRadius: { value: STARFIELD_RADIUS * 1.25 },
			uOpacity: { value: 0.9 },
			uTransitionProgress: { value: 0 }, // Black hole pull strength
			uFadeProgress: { value: 0 }, // Fade-out after convergence
		}
		const vertexShader = `
			attribute vec3 position0;
			attribute vec3 color;
			attribute float radius;
			attribute float size;
			uniform float uTime;
			uniform float uBaseSpeed;
			uniform float uParallax;
			uniform float uMaxRadius;
			uniform float uTransitionProgress;
			uniform float uFadeProgress;
			varying vec3 vColor;
			varying float vAlpha;

			void main(){
				// Depth parallax factor: nearer stars (smaller radius) rotate slightly faster
				float rNorm = clamp(radius / uMaxRadius, 0.0, 1.0);
				
				// Speed up rotation during transition (exponential acceleration)
				float speedMultiplier = 1.0 + uTransitionProgress * uTransitionProgress * 5.0;
				float speed = uBaseSpeed * speedMultiplier * (1.0 + uParallax * (1.0 - rNorm));
				float angle = uTime * speed;

				// Rotate around Y axis (counter-clockwise when looking from +Z towards origin)
				float c = cos(angle);
				float s = sin(angle);
				vec3 p = position0;
				vec3 rotated = vec3(
					p.x * c - p.z * s,
					p.y,
					p.x * s + p.z * c
				);
				
				// Shrink orbital radius during transition - converge to center
				vec3 finalPos = rotated;
				if (uTransitionProgress > 0.01) {
					// Shrink the orbital radius (distance from center) to zero
					float radiusShrink = 1.0 - (uTransitionProgress * uTransitionProgress * uTransitionProgress);
					finalPos *= radiusShrink;
				}

				vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
				
				// Shrink and fade stars as they approach center
				float distToCenter = length(finalPos);
				float fadeOut = smoothstep(0.0, 3.0, distToCenter); // Fade when closer than 3 units
				float shrink = 1.0 - uTransitionProgress * 0.7;
				
				gl_PointSize = size * 2.8 * (300.0 / -mvPosition.z) * shrink;
				gl_Position = projectionMatrix * mvPosition;

				vColor = color;
				// Fade during convergence, then additional fade-out over 2 seconds
				float convergenceFade = fadeOut * (1.0 - uTransitionProgress * 0.5);
				float finalAlpha = convergenceFade * (1.0 - uFadeProgress);
				vAlpha = finalAlpha;
			}
		`
		const fragmentShader = `
			precision mediump float;
			varying vec3 vColor;
			varying float vAlpha;

			void main(){
				// Soft round point
				vec2 uv = gl_PointCoord.xy - vec2(0.5);
				float d = length(uv);
				float alpha = smoothstep(0.5, 0.45, d) * vAlpha; // soft edge
				gl_FragColor = vec4(vColor, alpha);
			}
		`
		const mat = new THREE.ShaderMaterial({
			uniforms,
			vertexShader,
			fragmentShader,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		})
		return mat
	}, [])

	// Time update for shader with transition
	useFrame((state) => {
		material.uniforms.uTime.value = state.clock.getElapsedTime()
		material.uniforms.uTransitionProgress.value = transitionActive ? transitionProgress : 0
		material.uniforms.uFadeProgress.value = transitionActive ? fadeProgress : 0
	})

	useEffect(() => {
		return () => {
			starData.geometry.dispose()
			material.dispose()
		}
	}, [starData, material])

	return (
		<group ref={groupRef} position-z={-STARFIELD_Z}>
			<points geometry={starData.geometry} material={material} />
		</group>
	)
}

// ===================== Meteor Pool (bright head + fading particle trail, recycled) =====================
function MeteorPool({ color = COLOR_SHOOTING_BLUE }) {
	const groupRef = useRef()
	const pool = useRef([])
	const nextSpawnAt = useRef(
		performance.now() + (METEOR_SPAWN_INTERVAL_MIN + Math.random() * (METEOR_SPAWN_INTERVAL_MAX - METEOR_SPAWN_INTERVAL_MIN)) * 1000
	)

	// Build pool once
	useEffect(() => {
		const arr = []
		for (let i = 0; i < METEOR_POOL_SIZE; i++) {
			// Head (bright dot)
			const headGeom = new THREE.SphereGeometry(METEOR_HEAD_SIZE, 8, 8)
			const headMat = new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			})
			const head = new THREE.Mesh(headGeom, headMat)

			// Trail: Points with fixed length, we update positions/colors per frame
			const trailPositions = new Float32Array(METEOR_TRAIL_POINTS * 3)
			const trailColors = new Float32Array(METEOR_TRAIL_POINTS * 3)
			for (let j = 0; j < METEOR_TRAIL_POINTS; j++) {
				const t = j / (METEOR_TRAIL_POINTS - 1)
				// Fade out along trail
				const a = (1.0 - t)
				const c = new THREE.Color(color).multiplyScalar(0.6 + 0.4 * a)
				const idx = j * 3
				trailPositions[idx + 0] = 0
				trailPositions[idx + 1] = 0
				trailPositions[idx + 2] = 0
				trailColors[idx + 0] = c.r
				trailColors[idx + 1] = c.g
				trailColors[idx + 2] = c.b
			}
			const trailGeom = new THREE.BufferGeometry()
			trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3))
			trailGeom.setAttribute('color', new THREE.BufferAttribute(trailColors, 3))
			const trailMat = new THREE.PointsMaterial({
				size: METEOR_TRAIL_SIZE,
				vertexColors: true,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				sizeAttenuation: true,
			})
			const trail = new THREE.Points(trailGeom, trailMat)

			const g = new THREE.Group()
			g.visible = false
			g.add(trail)
			g.add(head)

			arr.push({
				group: g,
				head,
				trail,
				headMat,
				trailMat,
				trailGeom,
				vel: new THREE.Vector3(),
				active: false,
				lifeMs: 0,
				bornAt: 0,
				// ring buffer for trail
				lastPositions: Array(METEOR_TRAIL_POINTS).fill().map(() => new THREE.Vector3()),
			})
		}
		pool.current = arr
		if (groupRef.current) for (const m of arr) groupRef.current.add(m.group)

		return () => {
			for (const m of pool.current) {
				m.head.geometry.dispose()
				m.head.material.dispose()
				m.trail.geometry.dispose()
				m.trail.material.dispose()
			}
			pool.current = []
		}
	}, [color])

	const spawn = useCallback(() => {
		const m = pool.current.find(o => !o.active)
		if (!m) return

		// Spawn off-screen behind sculpture: diagonal path
		const startZ = -STARFIELD_Z + (-8 - Math.random() * 10) // deep behind
		const start = new THREE.Vector3(-12 - Math.random() * 6, 6 + Math.random() * 4, startZ)
		const vel = new THREE.Vector3(6.6 + Math.random() * 3.4, -4.0 - Math.random() * 2.4, -0.5 - Math.random() * 0.35)

		m.group.position.copy(start)
		m.vel.copy(vel)
		m.lifeMs = 1400 + Math.random() * 1100
		m.bornAt = performance.now()
		m.group.visible = true
		m.active = true
		m.headMat.opacity = 0.0
		m.trailMat.opacity = 0.0

		// Reset trail buffer
		for (let j = 0; j < METEOR_TRAIL_POINTS; j++) {
			m.lastPositions[j].set(0, 0, 0)
		}
	}, [])

	useFrame((_, delta) => {
		const now = performance.now()

		// Schedule spawns
		if (now >= nextSpawnAt.current) {
			spawn()
			nextSpawnAt.current = now + (METEOR_SPAWN_INTERVAL_MIN + Math.random() * (METEOR_SPAWN_INTERVAL_MAX - METEOR_SPAWN_INTERVAL_MIN)) * 1000
		}

		// Animate active meteors
		for (const m of pool.current) {
			if (!m.active) continue

			const life = now - m.bornAt
			const t = life / m.lifeMs
			if (t >= 1) {
				m.active = false
				m.group.visible = false
				m.headMat.opacity = 0
				m.trailMat.opacity = 0
				continue
			}

			// Move meteor
			m.group.position.addScaledVector(m.vel, delta)

			// Fade in/out head/trail
			const fadeIn = t < 0.25 ? (t / 0.25) : 1.0
			const fadeOut = t > 0.8 ? (1.0 - t) / 0.2 : 1.0
			const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)))
			m.headMat.opacity = alpha * 1.0
			m.trailMat.opacity = alpha * 0.9

			// Update trail positions along -velocity for a tapered streak
			const posAttr = m.trailGeom.getAttribute('position')
			for (let j = 0; j < METEOR_TRAIL_POINTS; j++) {
				const idx = j * 3
				const back = j / (METEOR_TRAIL_POINTS - 1)
				const offset = m.vel.clone().normalize().multiplyScalar(-back * 0.9)
				posAttr.array[idx + 0] = offset.x
				posAttr.array[idx + 1] = offset.y
				posAttr.array[idx + 2] = offset.z
			}
			posAttr.needsUpdate = true
		}
	})

	return <group ref={groupRef} />
}

// ===================== Morphing Wireframe Sculpture (webbed) =====================
function MorphingWireframe({ shapeIndex, setShapeIndex, wireColor, glowColor, bpm, transitionActive = false, transitionProgress = 0, fadeProgress = 0 }) {
	const groupRef = useRef()
	const mainWireRef = useRef()
	const glowWireRef = useRef()
	const { size } = useThree()
	const mouseRef = useRef({ x: 0, y: 0 })

	// Base + surface geometry (mutated per-frame)
	const baseGeom = useMemo(() => new THREE.IcosahedronGeometry(ICO_RADIUS, ICO_DETAIL), [])
	const surfaceGeom = useMemo(() => baseGeom.clone(), [baseGeom])
	const targets = useMemo(() => createMorphTargets(baseGeom, ICO_RADIUS), [baseGeom])

	// Initial wireframe for the morphing surface
	const [wireGeom, setWireGeom] = useState(() => new THREE.WireframeGeometry(surfaceGeom))

	// Morph state references derived from shapeIndex
	const morph = useRef({
		from: new Float32Array(surfaceGeom.getAttribute('position').array),
		to: targets.spherePositions,
		start: 0,
		duration: MORPH_DURATION_MS,
		progress: 1,
	})

	const nextShape = useCallback(() => {
		const next = (shapeIndex + 1) % 3
		setShapeIndex(next)
		// Pure geometric morph; keep object centered/steady
		const pos = surfaceGeom.getAttribute('position').array
		morph.current.from = new Float32Array(pos)
		morph.current.to =
			next === 0 ? targets.spherePositions :
			next === 1 ? targets.tetraPositions :
			targets.cubePositions
		morph.current.start = performance.now()
		morph.current.progress = 0
	}, [shapeIndex, setShapeIndex, surfaceGeom, targets])

	// NEW: When parent updates shapeIndex (e.g., after search submit), begin a morph here as well
	useEffect(() => {
		const pos = surfaceGeom.getAttribute('position').array
		morph.current.from = new Float32Array(pos)
		morph.current.to =
			shapeIndex === 0 ? targets.spherePositions :
			shapeIndex === 1 ? targets.tetraPositions :
			targets.cubePositions
		morph.current.start = performance.now()
		morph.current.progress = 0
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shapeIndex])

	// Mouse parallax (very gentle)
	useEffect(() => {
		const onMove = (e) => {
			const x = (e.clientX / size.width) * 2 - 1
			const y = (e.clientY / size.height) * 2 - 1
			mouseRef.current.x = x
			mouseRef.current.y = y
		}
		window.addEventListener('pointermove', onMove)
		return () => window.removeEventListener('pointermove', onMove)
	}, [size.width, size.height])

	// Per-frame: rotation, parallax tilt, morph interpolation, wireframe rebuild, BPM pulse
	useFrame((state, delta) => {
		// Steady rotation; keep centered and scale 1
		if (groupRef.current) {
			// During transition: spin on y=x plane (diagonal axis)
			if (transitionActive && transitionProgress > 0) {
				// Accelerating spin as it gets pulled in
				const spinMultiplier = 1 + transitionProgress * transitionProgress * 15
				const spinSpeed = delta * 2 * spinMultiplier
				groupRef.current.rotation.y += spinSpeed
				groupRef.current.rotation.x += spinSpeed // Equal rotation for y=x plane
				
				// Shrink toward center
				const shrinkAmount = 1 - (transitionProgress * transitionProgress * transitionProgress * 0.99)
				groupRef.current.scale.setScalar(Math.max(shrinkAmount, 0.01))
				
				// Fade out materials - during convergence and then additional fade
				const fadeStrength = Math.pow(transitionProgress, 0.8)
				const additionalFade = Math.pow(1 - fadeProgress, 0.5) // Faster fade with square root
				const finalOpacity = (1 - fadeStrength) * additionalFade
				
				if (mainWireRef.current) {
					mainWireRef.current.opacity = finalOpacity
				}
				if (glowWireRef.current) {
					glowWireRef.current.opacity = finalOpacity * 0.18
				}
				
				// Also hide the entire group when fully faded
				if (fadeProgress >= 0.95) {
					groupRef.current.visible = false
				}
			} else {
				// Normal rotation and pulsing
				groupRef.current.visible = true // Ensure visible when not transitioning
				groupRef.current.rotation.y += ROTATION_SPEED * delta
				const targetX = TILT_FACTOR + (-mouseRef.current.y * MOUSE_PARALLAX)
				const targetZ = mouseRef.current.x * MOUSE_PARALLAX
				groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.08)
				groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetZ, 0.08)
				
				// Reset opacity
				if (mainWireRef.current) mainWireRef.current.opacity = 0.95
				if (glowWireRef.current) glowWireRef.current.opacity = 0.18
				
				// ✨ BPM-based pulse effect - defaults to 60 BPM when no song
				const activeBPM = (bpm && bpm > 0 && bpm !== 'BPM unavailable') ? bpm : 60 // Default to 60 BPM
				const beatDuration = 60 / activeBPM // seconds per beat
				const elapsedTime = state.clock.getElapsedTime()
				
				// Get position within current beat (0 to 1)
				const beatProgress = (elapsedTime % beatDuration) / beatDuration
				
				// Create pulsing effect using easing
				// Fast attack (0.3), slow decay (0.7)
				let pulse
				if (beatProgress < BPM_ATTACK_TIME) {
					// Attack: 0 to 1 in first portion of beat
					pulse = beatProgress / BPM_ATTACK_TIME
				} else {
					// Decay: 1 to 0.7 in remaining portion of beat
					const decayProgress = (beatProgress - BPM_ATTACK_TIME) / BPM_DECAY_TIME
					pulse = 1 - (decayProgress * BPM_PULSE_SCALE)
				}
				
				// Apply pulse to scale (1.0 to 1.0 + BPM_PULSE_SCALE)
				const scaleAmount = 1 + (pulse * BPM_PULSE_SCALE)
				groupRef.current.scale.setScalar(scaleAmount)
			}
			
			groupRef.current.position.set(0, 0, 0)
		}

		// Morph interpolation (vertex buffer lerp)
		const { from, to, start, duration, progress } = morph.current
		if (progress < 1) {
			const now = performance.now()
			const t = Math.min(1, (now - start) / duration)
			const et = easeInOutCubic(t)
			const attr = surfaceGeom.getAttribute('position')
			const arr = attr.array
			for (let i = 0; i < arr.length; i++) {
				arr[i] = THREE.MathUtils.lerp(from[i], to[i], et)
			}
			attr.needsUpdate = true
			morph.current.progress = t

			// Rebuild wireframe so all internal triangle lines update (webbed look)
			const newWire = new THREE.WireframeGeometry(surfaceGeom)
			if (wireGeom) wireGeom.dispose()
			setWireGeom(newWire)
		}
	})

	// Cleanup
	useEffect(() => {
		return () => {
			baseGeom.dispose()
			surfaceGeom.dispose()
			if (wireGeom) wireGeom.dispose()
		}
	}, [baseGeom, surfaceGeom, wireGeom])

	return (
		<group ref={groupRef} onClick={nextShape}>
			{/* Webbed wireframe (full triangulation) */}
			{wireGeom && (
				<lineSegments ref={mainWireRef} geometry={wireGeom}>
					<lineBasicMaterial color={wireColor} transparent opacity={0.95} />
				</lineSegments>
			)}
			{/* Subtle bluish glow layer to feed bloom softly */}
			{wireGeom && (
				<lineSegments ref={glowWireRef} geometry={wireGeom}>
					<lineBasicMaterial color={glowColor} transparent opacity={0.18} />
				</lineSegments>
			)}
		</group>
	)
}

// ===================== Background Overlays (Vignette + Faint Noise) =====================
function BackdropOverlays() {
	return (
		<>
			{/* Cinematic radial vignette to avoid flat black */}
			<div
				style={{
					pointerEvents: 'none',
					position: 'absolute',
					inset: 0,
					background:
						'radial-gradient(ellipse at center, rgba(255,255,255,0.035) 0%, rgba(0,0,0,0.0) 45%, rgba(0,0,0,0.6) 100%)',
				}}
			/>
			{/* Very faint film grain */}
			<div
				style={{
					pointerEvents: 'none',
					position: 'absolute',
					inset: 0,
					opacity: 0.045,
					backgroundImage:
						'radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.0) 60%), url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"128\" height=\"128\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"2\" stitchTiles=\"stitch\"/></filter><rect width=\"100%\" height=\"100%\" filter=\"url(%23n)\" opacity=\"0.14\"/></svg>")',
					backgroundSize: 'cover, 128px 128px',
					mixBlendMode: 'screen',
				}}
			/>
		</>
	)
}

// ===================== Minimal UI Overlay (labels/instructions + search) =====================
function UIOverlay({ shapeIndex, onSubmitQuery, trackTitle, trackArtist, trackUrl, isLoading, bpm, transitionActive }) {
	const label = shapeIndex === 0 ? 'Sphere' : shapeIndex === 1 ? 'Tetrahedron' : 'Cube'
	const [value, setValue] = useState('')
	const [isHovered, setIsHovered] = useState(false)
	return (
		<>
			<style>{`
				@keyframes dotPulse { 0%, 100% { opacity: .25 } 50% { opacity: .9 } }
				@keyframes spin { to { transform: rotate(360deg); } }
				.cosmo-input::placeholder { color: rgba(255,255,255,0.6); font-style: italic; }
				.header-link:hover { opacity: .95; box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 8px 28px rgba(0,0,0,.35) }
				.loading-spinner { animation: spin 0.8s linear infinite; }
				.bpm-badge { 
					font-size: 12px; 
					font-weight: 600;
					opacity: 0.85; 
					margin-left: 10px; 
					padding: 3px 8px; 
					background: rgba(29, 185, 84, 0.25); 
					border: 1px solid rgba(29, 185, 84, 0.4);
					border-radius: 6px; 
					letter-spacing: 0.5px;
				}
			`}</style>
			<div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
				{/* Top center header with best match link to Spotify */}
				<div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'auto' }}>
					<a
						className="header-link"
						href={trackUrl || '#'}
						target={trackUrl ? '_blank' : undefined}
						rel={trackUrl ? 'noopener noreferrer' : undefined}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 10,
							padding: '8px 14px',
							borderRadius: 9999,
							border: '1px solid rgba(255,255,255,0.25)',
							background: 'rgba(0,0,0,0.35)',
							backdropFilter: 'blur(6px)',
							color: '#ffffff',
							opacity: .9,
							textDecoration: 'none',
							maxWidth: '80vw',
							whiteSpace: 'nowrap',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
						}}
					>
						{/* Spotify glyph or loading spinner */}
						{isLoading ? (
							<svg className="loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none"/>
								<path d="M12 2 A 10 10 0 0 1 22 12" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
							</svg>
						) : (
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
								<circle cx="12" cy="12" r="10" stroke="#1DB954" strokeWidth="1.5"/>
								<path d="M7 10c3-1 7-.8 10 1M7 13c2.6-.7 5.6-.6 8 1M7 16c2-.5 4-.4 6 .5" stroke="#1DB954" strokeWidth="1.5" strokeLinecap="round"/>
							</svg>
						)}
						<span style={{ letterSpacing: '.02em', display: 'flex', alignItems: 'center' }}>
							{isLoading ? 'Searching...' : (trackTitle && trackArtist ? `${toTitleCase(trackTitle)} — ${toTitleCase(trackArtist)}` : 'No match yet')}
							{trackTitle && trackArtist && bpm > 0 && (
								<span className="bpm-badge">♪ {Math.round(bpm)} BPM</span>
							)}
						</span>
					</a>
				</div>

				{/* Top-left title */}
				<div style={{ position: 'absolute', top: 18, left: 20, color: 'white', opacity: .8, letterSpacing: '.12em', fontSize: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
					<span style={{ width: 6, height: 6, borderRadius: 9999, background: '#9ad4ff', animation: 'dotPulse 2s ease-in-out infinite' }} />
					<span>Audio Visualization</span>
				</div>

				{/* Search bar - glides to bottom on transition */}
				<div 
					style={{ 
						position: 'absolute', 
						top: transitionActive ? 'auto' : '50%',
						bottom: transitionActive ? '30px' : 'auto',
						left: '50%', 
						transform: transitionActive ? 'translateX(-50%)' : 'translate(-50%, -50%)', 
						width: 'min(640px, 76vw)', 
						pointerEvents: 'auto', 
						zIndex: 30,
						opacity: transitionActive ? (isHovered ? 1 : 0.3) : 1,
						transition: 'top 1.3s ease, bottom 1.3s ease, transform 1.3s ease, opacity 0.8s ease'
					}}
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
				>
					<div style={{ position: 'relative' }}>
						{/* Icon */}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
							style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }}>
							<path d="M21 21L16.65 16.65" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
							<circle cx="11" cy="11" r="7" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.5"/>
						</svg>
						<input
							className="cosmo-input"
							type="text"
							placeholder="Levitating by Dua Lipa..."
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
								padding: '12px 48px 12px 44px',
								background: 'rgba(0,0,0,0.4)',
								border: '1px solid rgba(255,255,255,0.55)',
								borderRadius: 9999,
								color: '#ffffff',
								outline: 'none',
								caretColor: '#9ad4ff',
								backdropFilter: 'blur(6px)',
								boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.35), inset 0 0 24px rgba(255,255,255,0.06)',
								opacity: isLoading ? 0.5 : 1,
								cursor: isLoading ? 'not-allowed' : 'text',
								transition: 'opacity 0.2s, cursor 0.2s',
							}}
						/>
					</div>
				</div>

				{/* Bottom-left instruction */}
				<div style={{ position: 'absolute', bottom: 18, left: 20, color: 'white', opacity: .55, fontSize: 12, letterSpacing: '.04em' }}>
					Click anywhere to morph — Sphere → Tetrahedron → Cube
				</div>
			</div>
		</>
	)
}

// ===================== Helper: Fetch Audio Features =====================
async function fetchAudioFeatures(trackId, songTitle, artistName) {
	try {
		// Pass song info as query params so backend can query GetSongBPM API
		const url = `${API_BASE}/api/features/${trackId}?title=${encodeURIComponent(songTitle)}&artist=${encodeURIComponent(artistName)}`
		console.log('[frontend] Fetching audio features for trackId:', trackId)
		console.log('[frontend] Song: ', songTitle, ' - ', artistName)
		console.log('[frontend] Full URL:', url)
		
		const resp = await fetch(url)
		console.log('[frontend] Features response status:', resp.status)
		
		if (resp.ok) {
			const features = await resp.json()
			console.log('[frontend] Audio features received:', features)
			console.log('[frontend] Tempo (BPM):', features.tempo)
			return features.tempo || 120
		} else {
			const errorBody = await resp.text()
			console.warn('[frontend] Features request failed:', resp.status, errorBody)
		}
	} catch (e) {
		console.error('[frontend] Error fetching features:', e?.message || e)
	}
	console.log('[frontend] Returning default BPM: 120')
	return 120 // Default fallback BPM
}

// ===================== App =====================
export default function App() {
	const [shapeIndex, setShapeIndex] = useState(0)
	const [wireColor, setWireColor] = useState('#ffffff')
	const [glowColor, setGlowColor] = useState('#a5d8ff')
	const [submitCount, setSubmitCount] = useState(0)
	const [trackTitle, setTrackTitle] = useState('')
	const [trackArtist, setTrackArtist] = useState('')
	const [trackId, setTrackId] = useState('')
	const [spotifyUrl, setSpotifyUrl] = useState(null) // NEW: Store actual Spotify URL from backend
	const [isLoading, setIsLoading] = useState(false)
	const [bpm, setBpm] = useState(120) // ✨ NEW: BPM state for audio visualization
	const [transitionActive, setTransitionActive] = useState(false) // Black hole transition state
	const [transitionProgress, setTransitionProgress] = useState(0) // 0 to 1 (convergence)
	const [fadeProgress, setFadeProgress] = useState(0) // 0 to 1 (fade-out after convergence)
	const trackUrl = spotifyUrl || null // Use backend-provided Spotify URL

	const handleSubmitQuery = useCallback(async (text) => {
		if (!text.trim()) return

		setIsLoading(true)
		
		// Start black hole transition
		setTransitionActive(true)
		setTransitionProgress(0)

		try {
			// Use API_BASE for production deployment
			const url = `${API_BASE}/api/search?query=${encodeURIComponent(text)}`
			console.log('[frontend] Calling:', url)
			const resp = await fetch(url)

			if (resp.ok) {
				const results = await resp.json()
				console.log('[frontend] Search results:', results)

				if (Array.isArray(results) && results.length > 0) {
					const track = results[0]
					setTrackTitle(track.title || '')
					setTrackArtist(track.artist || '')
					setTrackId(track.trackId || '')
					setSpotifyUrl(track.spotifyUrl || null) // Store Spotify URL from backend
					console.log('[frontend] Updated display:', track.title, '—', track.artist)

					// ✨ NEW: Fetch audio features to get BPM
					const tempo = await fetchAudioFeatures(track.trackId, track.title, track.artist)
					setBpm(tempo)
					console.log('[frontend] BPM set to:', tempo)
				} else {
					// No match: still show user's input as a best-effort label
					setTrackTitle(text)
					setTrackArtist('No exact match found')
					setTrackId('')
					setBpm(120) // Reset to default
					console.warn('[frontend] No results returned from backend')
				}
			} else {
				// Backend error: graceful fallback
				const errBody = await resp.text()
				console.error('[frontend] Backend error:', resp.status, errBody)
				setTrackTitle(text)
				setTrackArtist('Lookup error')
				setTrackId('')
				setBpm(120) // Reset to default
			}
		} catch (e) {
			console.error('[frontend] Network error:', e?.message || e)
			setTrackTitle(text)
			setTrackArtist('Offline or backend unavailable')
			setTrackId('')
			setBpm(120) // Reset to default
		} finally {
			setIsLoading(false)
		}

		// Color change each submit (even if identical input)
		setSubmitCount((c) => {
			const next = c + 1
			const { main, glow } = colorFromText(text, next)
			setWireColor(main)
			setGlowColor(glow)
			return next
		})

		// Morph to next shape
		setShapeIndex((prev) => (prev + 1) % 3)
	}, [])
	
	// Manage black hole transition progress (8s convergence + 2s fade)
	useEffect(() => {
		if (!transitionActive) return
		
		const startTime = performance.now()
		const convergeDuration = 8000 // 8 seconds convergence
		const fadeDuration = 2000 // 2 seconds fade-out
		const totalDuration = convergeDuration + fadeDuration
		
		const animate = () => {
			const elapsed = performance.now() - startTime
			
			if (elapsed < convergeDuration) {
				// Phase 1: Convergence (0-8s)
				const progress = Math.min(elapsed / convergeDuration, 1)
				setTransitionProgress(progress)
				setFadeProgress(0)
			} else {
				// Phase 2: Fade-out (8-10s)
				setTransitionProgress(1) // Keep at full convergence
				const fadeElapsed = elapsed - convergeDuration
				const fade = Math.min(fadeElapsed / fadeDuration, 1)
				setFadeProgress(fade)
			}
			
			if (elapsed < totalDuration) {
				requestAnimationFrame(animate)
			}
		}
		
		requestAnimationFrame(animate)
	}, [transitionActive])

	return (
		<div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
			<BackdropOverlays />
			<UIOverlay shapeIndex={shapeIndex} onSubmitQuery={handleSubmitQuery} trackTitle={trackTitle} trackArtist={trackArtist} trackUrl={trackUrl} isLoading={isLoading} bpm={bpm} transitionActive={transitionActive} />
			<Canvas
				camera={{ position: [0, 0, 7], fov: 50 }}
				dpr={Math.min(window.devicePixelRatio, 2)}
				gl={{ antialias: true, alpha: false }}
			>
				{/* Subtle depth lights (no solid surfaces, only for ambient cues) */}
				<ambientLight intensity={0.18} />
				<directionalLight position={[5, 5, 6]} intensity={0.34} />
				<directionalLight position={[-4, -3, -5]} intensity={0.2} />

				{/* Cosmic background */}
				<Starfield transitionActive={transitionActive} transitionProgress={transitionProgress} fadeProgress={fadeProgress} />
				{/* Two meteor pools with different hues */}
				<MeteorPool color={COLOR_SHOOTING_BLUE} />
				<MeteorPool color={COLOR_METEOR_PURPLE} />

				{/* Morphing, centered webbed wireframe sculpture */}
				{/* ✨ NEW: Pass BPM prop for audio-reactive visualization */}
				<MorphingWireframe shapeIndex={shapeIndex} setShapeIndex={setShapeIndex} wireColor={wireColor} glowColor={glowColor} bpm={bpm} transitionActive={transitionActive} transitionProgress={transitionProgress} fadeProgress={fadeProgress} />

				{/* Postprocessing: soft bloom + vignette + faint noise */}
				<EffectComposer multisampling={0}>
					{/* (B) Bloom intensity tuned here */}
					<Bloom
						intensity={BLOOM_INTENSITY}
						luminanceThreshold={BLOOM_THRESHOLD}
						luminanceSmoothing={BLOOM_SMOOTHING}
						mipmapBlur
					/>
					<Vignette eskil={false} offset={0.2} darkness={0.7} />
					<Noise premultiply opacity={0.035} />
				</EffectComposer>

				{/* Dev-only control (disabled) to ensure stable camera framing */}
				<OrbitControls enabled={false} />
			</Canvas>
		</div>
	)
}